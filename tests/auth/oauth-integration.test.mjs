import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL_TEST;
test('OAuth browser, consent and token lifecycle with isolated PostgreSQL', { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated PostgreSQL database' }, async t => {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname), 'Integration test database must be local and named test');
  process.env.DATABASE_URL = databaseUrl;
  process.env.MCP_ENCRYPTION_KEY = 'b'.repeat(64);
  const { oauthRouter } = await import('../../dist/routes/oauth.js');
  const { getPrisma, disconnectPrisma } = await import('../../dist/db/prisma.js');
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const prisma = getPrisma();
  const app = express(); app.use(express.json()); app.use('/oauth', oauthRouter);
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.MCP_BASE_URL = base;
  const resource = `${base}/mcp`; const redirect = 'https://client.example/callback?existing=1';
  const originalFetch = globalThis.fetch;
  let metaMode = 'good'; let graphCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname !== 'graph.facebook.com') return originalFetch(url, options);
    graphCalls++;
    if (metaMode === 'bad') return new Response(JSON.stringify({ error: { message: 'must-not-leak-REAL_TOKEN' } }), { status: 401 });
    const path = new URL(url).pathname;
    const permissions = [{ permission: 'ads_read', status: 'granted' }, ...(metaMode === 'readonly' ? [] : [{ permission: 'ads_management', status: 'granted' }])];
    const accounts = [{ id: 'act_100', name: 'Conta A', currency: 'BRL', account_status: 1 }, { id: 'act_200', name: 'Conta B', currency: 'USD', account_status: 1 }].filter(account => metaMode !== 'account-removed' || account.id !== 'act_100');
    return new Response(JSON.stringify(path.endsWith('/me') ? { id: '9001' } : path.endsWith('/permissions') ? { data: permissions } : { data: accounts }));
  };
  const suffix = randomUUID(); const createdClients = []; const createdUsers = [];
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await prisma.oAuthFlow.deleteMany({ where: { clientId: { in: createdClients } } });
    await prisma.oAuthAccessToken.deleteMany({ where: { clientId: { in: createdClients } } });
    await prisma.authorizationCode.deleteMany({ where: { clientId: { in: createdClients } } });
    await prisma.metaToken.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.oAuthClient.deleteMany({ where: { id: { in: createdClients } } });
    await new Promise(resolve => server.close(resolve)); await disconnectPrisma();
  });
  async function post(path, body, cookie) {
    return originalFetch(`${base}${path}`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) }, body: new URLSearchParams(Object.entries(body).filter(([, value]) => value !== undefined).flatMap(([key,value]) => Array.isArray(value) ? value.map(item => [key,item]) : [[key,value]])) });
  }
  async function assertInvalidTokenResources(request, assertUnconsumed) {
    for (const invalid of ['', 'https://elsewhere.example/mcp', '/mcp', `${resource}#fragment`, [resource, resource], [resource, 'https://elsewhere.example/mcp']]) {
      const response = await post('/oauth/token', { ...request, resource: invalid });
      assert.equal(response.status, 400, `Form resource ${JSON.stringify(invalid)}`);
      assert.deepEqual(await response.json(), { error: 'invalid_target' });
      await assertUnconsumed();
    }
    for (const invalid of [null, {}, { value: resource }, [resource], [], 0, false]) {
      const response = await originalFetch(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, resource: invalid }) });
      assert.equal(response.status, 400, `JSON resource ${JSON.stringify(invalid)}`);
      assert.deepEqual(await response.json(), { error: 'invalid_target' });
      await assertUnconsumed();
    }
  }
  async function register(authMethod = 'none') {
    const res = await originalFetch(`${base}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: `Integration ${suffix}`, redirect_uris: [redirect], token_endpoint_auth_method: authMethod }) });
    assert.equal(res.status, 201); const client = await res.json(); createdClients.push(client.client_id); return client;
  }
  const client = await register(); const confidential = await register('client_secret_post');
  const verifier = 'a'.repeat(43); const challenge = createHash('sha256').update(verifier).digest('base64url');
  async function begin(overrides = {}) {
    const values = { client_id: client.client_id, redirect_uri: redirect, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', resource, scope: 'ads_read ads_management', state: 'original-state', ...overrides };
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined).flatMap(([key, value]) => Array.isArray(value) ? value.map(item => [key, item]) : [[key, value]]));
    const res = await originalFetch(`${base}/oauth/authorize?${query}`, { redirect: 'manual' });
    const html = await res.text();
    return { res, html, cookie: res.headers.get('set-cookie')?.split(';')[0], flow: html.match(/name="flow" value="([^"]+)"/)?.[1], csrf: html.match(/name="csrf" value="([^"]+)"/)?.[1] };
  }
  const auth = await begin();
  const form = { flow: auth.flow, csrf: auth.csrf };
  let code, tokens, userId;
  try {
    await t.test('authorize without a resource parameter binds the flow to this MCP server', async () => {
      const omitted = await begin({ resource: undefined });
      assert.equal(omitted.res.status, 200, omitted.html);
      const stored = await prisma.oAuthFlow.findUnique({ where: { id: omitted.flow } });
      assert.equal(stored.resource, resource);
      assert.equal(stored.clientId, client.client_id);
      assert.equal(stored.redirectUri, redirect);
      assert.equal(stored.codeChallenge, challenge);
    });
    await t.test('registration rejects unsafe redirect metadata and stores confidential secret as a hash', async () => {
      const response = await originalFetch(`${base}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Bad', redirect_uris: ['javascript:alert(1)'] }) });
      assert.equal(response.status, 400);
      const stored = await prisma.oAuthClient.findUnique({ where: { id: confidential.client_id } });
      assert.equal(stored.clientSecret, hashSecret(confidential.client_secret));
    });
    await t.test('authorize validates registered redirect, resource, scope and explicit PKCE method', async () => {
      for (const changes of [{ redirect_uri: 'https://evil.example/cb' }, { resource: 'https://elsewhere.example/mcp' }, { scope: 'ads_management_evil' }, { code_challenge_method: '' }, { client_id: 'missing' }, { code_challenge: 'short' }]) assert.equal((await begin(changes)).res.status, 400);
      assert.equal(auth.res.status, 200);
      assert.ok(auth.res.headers.get('set-cookie').includes('HttpOnly'));
      assert.ok(auth.res.headers.get('set-cookie').includes('SameSite=Lax'));
      assert.equal(auth.res.headers.get('referrer-policy'), 'same-origin');
    });
    await t.test('authorize rejects explicitly empty, malformed and repeated resources without creating a flow', async () => {
      const before = await prisma.oAuthFlow.count({ where: { clientId: client.client_id } });
      for (const invalid of ['', '/mcp', `${resource}#fragment`, [resource, resource], [resource, 'https://elsewhere.example/mcp']]) {
        const response = await begin({ resource: invalid });
        assert.equal(response.res.status, 400, `Resource ${JSON.stringify(invalid)}`);
        assert.deepEqual(JSON.parse(response.html), { error: 'invalid_target' });
      }
      assert.equal(await prisma.oAuthFlow.count({ where: { clientId: client.client_id } }), before);
    });
    await t.test('login POST requires flow cookie and CSRF and enforces minimum password on server', async () => {
      const credentials = { ...form, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'register' };
      assert.equal((await post('/oauth/authorize', credentials)).status, 400);
      assert.equal((await post('/oauth/authorize', { ...credentials, csrf: 'wrong' }, auth.cookie)).status, 400);
      assert.equal((await post('/oauth/authorize', { ...credentials, password: 'short' }, auth.cookie)).status, 400);
      assert.equal(await prisma.user.count({ where: { email: credentials.email } }), 0);
    });
    await t.test('successful first login preserves server-side request and never issues a pre-consent code', async () => {
      const response = await post('/oauth/authorize', { ...form, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'register', redirect_uri: 'https://evil.example', state: 'injected', scope: 'unknown' }, auth.cookie);
      assert.equal(response.status, 303);
      assert.equal(response.headers.get('location'), `/oauth/settings?flow=${auth.flow}`);
      const user = await prisma.user.findUnique({ where: { email: `test-${suffix}@example.com` } }); userId = user.id; createdUsers.push(userId);
      assert.equal(await prisma.authorizationCode.count({ where: { userId } }), 0);
      assert.equal((await originalFetch(`${base}/oauth/settings?flow=${auth.flow}`)).status, 400);
    });
    await t.test('invalid Meta token cannot be stored and provider errors are not exposed', async () => {
      metaMode = 'bad'; const response = await post('/oauth/settings', { ...form, meta_access_token: 'REAL_TOKEN' }, auth.cookie);
      assert.equal(response.status, 400); assert.ok(!(await response.text()).includes('must-not-leak'));
      assert.equal(await prisma.metaToken.count({ where: { userId } }), 0);
      assert.equal((await prisma.oAuthFlow.findUnique({ where: { id: auth.flow } })).pendingMetaToken, null);
      metaMode = 'good';
    });
    await t.test('real-account validation stores encrypted pending token, before consent', async () => {
      const response = await post('/oauth/settings', { ...form, meta_access_token: 'SYNTHETIC_META_TOKEN' }, auth.cookie);
      assert.equal(response.status, 303); assert.ok(graphCalls >= 4);
      const stored = await prisma.oAuthFlow.findUnique({ where: { id: auth.flow } });
      assert.ok(stored.pendingMetaToken.startsWith('enc:')); assert.ok(!stored.pendingMetaToken.includes('SYNTHETIC'));
      assert.deepEqual(stored.accounts.map(account => account.id), ['act_100','act_200']);
      assert.equal(await prisma.metaToken.count({ where: { userId } }), 0);
    });
    await t.test('consent rejects arbitrary accounts, missing checkbox and absent account selection', async () => {
      for (const extra of [{ account_ids: 'act_999', consent: 'yes' }, { account_ids: 'act_100' }, { consent: 'yes' }]) assert.equal((await post('/oauth/consent', { ...form, ...extra }, auth.cookie)).status, 400);
      assert.equal(await prisma.authorizationCode.count({ where: { userId } }), 0);
    });
    await t.test('consent returns to registered client with original state and immutable selected-account snapshot', async () => {
      const response = await post('/oauth/consent', { ...form, account_ids: 'act_100', consent: 'yes', access_mode: 'readwrite', redirect_uri: 'https://evil.example', state: 'injected', scope: 'ads_read' }, auth.cookie);
      assert.equal(response.status, 303);
      const location = new URL(response.headers.get('location'));
      assert.equal(location.origin, 'https://client.example'); assert.equal(location.searchParams.get('state'), 'original-state'); assert.equal(location.searchParams.get('existing'), '1');
      code = location.searchParams.get('code');
      const stored = await prisma.authorizationCode.findUnique({ where: { code: hashSecret(code) } });
      assert.equal(stored.scope, 'ads_read ads_management'); assert.deepEqual(stored.selectedAccountIds, ['act_100']); assert.equal(stored.resource, resource);
      assert.equal(await prisma.oAuthFlow.count({ where: { id: auth.flow } }), 0);
      assert.equal((await post('/oauth/consent', { ...form, account_ids: 'act_100', consent: 'yes' }, auth.cookie)).status, 400);
    });
    const exchange = () => ({ grant_type: 'authorization_code', client_id: client.client_id, code, redirect_uri: redirect, code_verifier: verifier, resource });
    await t.test('code exchange rejects wrong verifier, redirect, audience and unauthenticated confidential client', async () => {
      for (const patch of [{ code_verifier: 'b'.repeat(43) }, { redirect_uri: 'https://evil.example' }, { resource: 'https://evil.example/mcp' }]) assert.equal((await post('/oauth/token', { ...exchange(), ...patch })).status, 400);
      assert.equal((await post('/oauth/token', { ...exchange(), client_id: confidential.client_id })).status, 401);
      assert.equal((await post('/oauth/token', { ...exchange(), client_id: confidential.client_id, client_secret: 'wrong' })).status, 401);
    });
    await t.test('invalid explicit token resources do not consume the authorization code', async () => {
      await assertInvalidTokenResources(exchange(), async () => {
        assert.equal((await prisma.authorizationCode.findUnique({ where: { code: hashSecret(code) } })).used, false);
      });
    });
    await t.test('omitting resource cannot redeem a code stored for another audience', async () => {
      const where = { code: hashSecret(code) };
      await prisma.authorizationCode.update({ where, data: { resource: 'https://elsewhere.example/mcp' } });
      try {
        const response = await post('/oauth/token', { ...exchange(), resource: undefined });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'invalid_grant' });
        assert.equal((await prisma.authorizationCode.findUnique({ where })).used, false);
      } finally { await prisma.authorizationCode.update({ where, data: { resource } }); }
    });
    await t.test('concurrent code redemption succeeds exactly once, retaining hashes and scopes', async () => {
      const responses = await Promise.all([post('/oauth/token', exchange()), post('/oauth/token', exchange())]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200,400]);
      tokens = await responses.find(response => response.status === 200).json();
      const stored = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
      assert.equal(stored.refreshToken, hashSecret(tokens.refresh_token)); assert.equal(stored.scope, 'ads_read ads_management'); assert.deepEqual(stored.selectedAccountIds, ['act_100']);
    });
    await t.test('refresh rejects other clients, wrong resource and scope escalation', async () => {
      const request = { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource };
      assert.equal((await post('/oauth/token', { ...request, client_id: confidential.client_id, client_secret: confidential.client_secret })).status, 400);
      assert.equal((await post('/oauth/token', { ...request, scope: 'unknown_write' })).status, 400);
      assert.equal((await post('/oauth/token', { ...request, resource: 'https://evil.example/mcp' })).status, 400);
    });
    await t.test('invalid explicit token resources do not consume the refresh grant', async () => {
      await assertInvalidTokenResources({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token }, async () => {
        const stored = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
        assert.equal(stored.refreshToken, hashSecret(tokens.refresh_token));
        assert.equal(stored.resource, resource);
      });
    });
    await t.test('omitting resource cannot renew a refresh grant stored for another audience', async () => {
      const where = { token: hashSecret(tokens.access_token) };
      await prisma.oAuthAccessToken.update({ where, data: { resource: 'https://elsewhere.example/mcp' } });
      try {
        const response = await post('/oauth/token', { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'invalid_grant' });
        assert.equal((await prisma.oAuthAccessToken.findUnique({ where })).refreshToken, hashSecret(tokens.refresh_token));
      } finally { await prisma.oAuthAccessToken.update({ where, data: { resource } }); }
    });
    await t.test('refresh rotates once and can reduce scope without expanding selected accounts', async () => {
      const previousAccess = tokens.access_token;
      const previousGrant = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(previousAccess) } });
      const request = { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource, scope: 'ads_read' };
      const response = await post('/oauth/token', request);
      assert.equal(response.status, 200);
      tokens = await response.json();
      assert.equal(tokens.scope, 'ads_read');
      const renewedGrant = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
      assert.ok(previousGrant.operationOwnerId);
      assert.equal(renewedGrant.operationOwnerId, previousGrant.operationOwnerId);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { token: hashSecret(previousAccess) } }), 0);
      assert.equal((await post('/oauth/token', { ...request, refresh_token: tokens.refresh_token, scope: 'ads_read ads_management' })).status, 400);
    });
    await t.test('refresh inactivity expiry is enforced even when the access token exists', async () => {
      await prisma.oAuthAccessToken.update({ where: { token: hashSecret(tokens.access_token) }, data: { refreshExpiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await post('/oauth/token', { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource })).status, 400);
    });
    await t.test('RFC7009 revocation is bound to the client and revokes access plus refresh', async () => {
      assert.equal((await post('/oauth/revoke', { client_id: confidential.client_id, client_secret: confidential.client_secret, token: tokens.access_token })).status, 200);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { token: hashSecret(tokens.access_token) } }), 1);
      assert.equal((await post('/oauth/revoke', { client_id: client.client_id, token: tokens.refresh_token })).status, 200);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { token: hashSecret(tokens.access_token) } }), 0);
    });
    await t.test('saved-token reconnect and confidential client finish the complete flow', async () => {
      const next = await begin({ client_id: confidential.client_id, scope: 'ads_read' });
      const fields = { flow: next.flow, csrf: next.csrf };
      assert.equal((await post('/oauth/authorize', { ...fields, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'login' }, next.cookie)).status, 303);
      const settings = await originalFetch(`${base}/oauth/settings?flow=${next.flow}`, { headers: { Cookie: next.cookie } });
      assert.ok((await settings.text()).includes('Usar o token já salvo'));
      assert.equal((await post('/oauth/settings', { ...fields, use_saved: 'yes' }, next.cookie)).status, 303);
      const consentPage = await originalFetch(`${base}/oauth/settings?flow=${next.flow}`, { headers: { Cookie: next.cookie } });
      assert.ok(consentPage.headers.get('content-security-policy').includes('https://client.example'));
      const response = await post('/oauth/consent', { ...fields, consent: 'yes', account_ids: 'act_200' }, next.cookie);
      assert.equal(response.status, 303);
      const nextCode = new URL(response.headers.get('location')).searchParams.get('code');
      const exchangeResponse = await post('/oauth/token', { grant_type: 'authorization_code', client_id: confidential.client_id, client_secret: confidential.client_secret, redirect_uri: redirect, code_verifier: verifier, code: nextCode, resource });
      assert.equal(exchangeResponse.status, 200);
      tokens = await exchangeResponse.json();
      const saved = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
      assert.deepEqual(saved.selectedAccountIds, ['act_200']); assert.equal(saved.scope, 'ads_read');
    });
    await t.test('browser revocation requires CSRF and preserves a different user connection', async () => {
      const other = await prisma.user.create({ data: { email: `other-${suffix}@example.com` } }); createdUsers.push(other.id);
      const original = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
      await prisma.oAuthAccessToken.create({ data: { token: hashSecret(`other-${suffix}`), clientId: confidential.client_id, userId: other.id, scope: 'ads_read', resource, selectedAccountIds: ['act_200'], metaTokenId: original.metaTokenId, expiresAt: new Date(Date.now() + 60_000) } });
      const next = await begin(); const fields = { flow: next.flow, csrf: next.csrf, client_id: confidential.client_id };
      assert.equal((await post('/oauth/authorize', { ...fields, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'login' }, next.cookie)).status, 303);
      assert.equal((await post('/oauth/connections/revoke', { ...fields, csrf: 'wrong' }, next.cookie)).status, 400);
      assert.equal((await post('/oauth/connections/revoke', fields, next.cookie)).status, 200);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { token: hashSecret(tokens.access_token) } }), 0);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { userId: other.id } }), 1);
      assert.equal((await post('/oauth/token', { grant_type: 'refresh_token', client_id: confidential.client_id, client_secret: confidential.client_secret, refresh_token: tokens.refresh_token, resource })).status, 400);
    });
    await t.test('expired browser state cannot authenticate or continue settings', async () => {
      const expired = await begin();
      await prisma.oAuthFlow.update({ where: { id: expired.flow }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await post('/oauth/authorize', { flow: expired.flow, csrf: expired.csrf, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'login' }, expired.cookie)).status, 400);
      assert.equal((await originalFetch(`${base}/oauth/settings?flow=${expired.flow}`, { headers: { Cookie: expired.cookie } })).status, 400);
    });
    async function readyForConsent(overrides = {}) {
      const next = await begin(overrides);
      assert.equal(next.res.status, 200, next.html);
      const fields = { flow: next.flow, csrf: next.csrf };
      assert.equal((await post('/oauth/authorize', { ...fields, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'login' }, next.cookie)).status, 303);
      assert.equal((await post('/oauth/settings', { ...fields, use_saved: 'yes' }, next.cookie)).status, 303);
      return { ...next, fields };
    }
    for (const accessMode of [undefined, 'read']) {
      await t.test(`${accessMode === undefined ? 'omitted' : 'explicit read'} access mode grants only read despite requested and Meta management permissions`, async () => {
        const next = await readyForConsent();
        assert.equal((await prisma.oAuthFlow.findUniqueOrThrow({ where: { id: next.flow } })).scope, 'ads_read ads_management');
        const response = await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: accessMode, scope: 'ads_read ads_management' }, next.cookie);
        assert.equal(response.status, 303);
        const selectedCode = new URL(response.headers.get('location')).searchParams.get('code');
        const storedCode = await prisma.authorizationCode.findUniqueOrThrow({ where: { code: hashSecret(selectedCode) } });
        assert.equal(storedCode.scope, 'ads_read');
        assert.equal((await prisma.metaToken.findUniqueOrThrow({ where: { id: storedCode.metaTokenId } })).scopes, 'ads_read');
        const exchanged = await post('/oauth/token', { grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: redirect, code_verifier: verifier, code: selectedCode, resource });
        assert.equal(exchanged.status, 200);
        const initial = await exchanged.json();
        assert.equal(initial.scope, 'ads_read');
        const storedGrant = await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(initial.access_token) } });
        assert.equal(storedGrant.scope, 'ads_read');
        assert.deepEqual(storedGrant.selectedAccountIds, ['act_100']);
        const refresh = { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: initial.refresh_token, resource };
        assert.equal((await post('/oauth/token', { ...refresh, scope: 'ads_read ads_management' })).status, 400);
        const renewed = await post('/oauth/token', refresh);
        assert.equal(renewed.status, 200);
        const renewedTokens = await renewed.json();
        assert.equal(renewedTokens.scope, 'ads_read');
        assert.equal((await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(renewedTokens.access_token) } })).scope, 'ads_read');
      });
    }
    await t.test('a read-only OAuth request cannot be upgraded through consent form fields', async () => {
      const next = await readyForConsent({ scope: 'ads_read' });
      const before = await prisma.authorizationCode.count({ where: { userId } });
      const response = await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: 'readwrite', scope: 'ads_read ads_management' }, next.cookie);
      assert.equal(response.status, 400);
      assert.equal(await prisma.authorizationCode.count({ where: { userId } }), before);
      assert.equal((await prisma.oAuthFlow.findUniqueOrThrow({ where: { id: next.flow } })).scope, 'ads_read');
      assert.equal((await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: 'read' }, next.cookie)).status, 303);
    });
    await t.test('a Meta token with read access passes settings but cannot authorize management', async () => {
      metaMode = 'readonly';
      try {
        const next = await readyForConsent();
        const before = await prisma.authorizationCode.count({ where: { userId } });
        const response = await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: 'readwrite' }, next.cookie);
        assert.equal(response.status, 400);
        assert.match(await response.text(), /ads_management/);
        assert.equal(await prisma.authorizationCode.count({ where: { userId } }), before);
        assert.ok((await prisma.oAuthFlow.findUniqueOrThrow({ where: { id: next.flow } })).pendingMetaToken);
        const accepted = await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: 'read' }, next.cookie);
        assert.equal(accepted.status, 303);
        const codeValue = new URL(accepted.headers.get('location')).searchParams.get('code');
        assert.equal((await prisma.authorizationCode.findUniqueOrThrow({ where: { code: hashSecret(codeValue) } })).scope, 'ads_read');
      } finally { metaMode = 'good'; }
    });
    await t.test('consent rechecks selected accounts for both modes and does not consume a rejected flow', async () => {
      const next = await readyForConsent();
      const before = await prisma.authorizationCode.count({ where: { userId } });
      metaMode = 'account-removed';
      try {
        for (const access_mode of ['read', 'readwrite']) {
          const response = await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode }, next.cookie);
          assert.equal(response.status, 400);
          assert.equal(await prisma.authorizationCode.count({ where: { userId } }), before);
          assert.ok((await prisma.oAuthFlow.findUniqueOrThrow({ where: { id: next.flow } })).pendingMetaToken);
        }
      } finally { metaMode = 'good'; }
      assert.equal((await post('/oauth/consent', { ...next.fields, consent: 'yes', account_ids: 'act_100', access_mode: 'read' }, next.cookie)).status, 303);
    });
    await t.test('unknown and repeated access modes are rejected without issuing a code', async () => {
      const next = await readyForConsent();
      const before = await prisma.authorizationCode.count({ where: { userId } });
      const fields = { ...next.fields, consent: 'yes', account_ids: 'act_100' };
      for (const access_mode of ['', 'write', ['read', 'readwrite'], ['readwrite', 'readwrite']]) {
        assert.equal((await post('/oauth/consent', { ...fields, access_mode }, next.cookie)).status, 400);
      }
      for (const access_mode of [null, {}, ['readwrite']]) {
        const response = await originalFetch(`${base}/oauth/consent`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: next.cookie }, body: JSON.stringify({ ...fields, access_mode }) });
        assert.equal(response.status, 400);
      }
      assert.equal(await prisma.authorizationCode.count({ where: { userId } }), before);
      assert.ok((await prisma.oAuthFlow.findUniqueOrThrow({ where: { id: next.flow } })).pendingMetaToken);
    });
    for (const variant of [
      { name: 'resource omitted in authorize, exchange and refresh', authorize: undefined, exchange: undefined, refresh: undefined },
      { name: 'explicit authorize, omitted exchange and explicit refresh resource', authorize: resource, exchange: undefined, refresh: resource },
      { name: 'omitted authorize, explicit exchange and omitted refresh resource', authorize: undefined, exchange: resource, refresh: undefined },
    ]) {
      await t.test(`complete OAuth lifecycle with ${variant.name}`, async () => {
        const next = await begin({ resource: variant.authorize });
        assert.equal(next.res.status, 200, next.html);
        const fields = { flow: next.flow, csrf: next.csrf };
        const flow = await prisma.oAuthFlow.findUnique({ where: { id: next.flow } });
        assert.equal(flow.resource, resource);
        assert.equal((await post('/oauth/authorize', { ...fields, email: `test-${suffix}@example.com`, password: 'valid-password', action: 'login' }, next.cookie)).status, 303);
        assert.equal((await post('/oauth/settings', { ...fields, use_saved: 'yes' }, next.cookie)).status, 303);
        const consent = await post('/oauth/consent', { ...fields, consent: 'yes', account_ids: 'act_100' }, next.cookie);
        assert.equal(consent.status, 303);
        const callback = new URL(consent.headers.get('location'));
        assert.equal(callback.searchParams.get('state'), 'original-state');
        assert.equal(callback.origin, new URL(redirect).origin);
        const codeValue = callback.searchParams.get('code');
        const storedCode = await prisma.authorizationCode.findUnique({ where: { code: hashSecret(codeValue) } });
        assert.equal(storedCode.resource, resource);
        assert.equal(storedCode.clientId, client.client_id);
        assert.equal(storedCode.codeChallenge, challenge);
        const exchangeRequest = { grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: redirect, code_verifier: verifier, code: codeValue, resource: variant.exchange };
        assert.equal((await post('/oauth/token', { ...exchangeRequest, code_verifier: 'b'.repeat(43) })).status, 400);
        assert.equal((await prisma.authorizationCode.findUnique({ where: { code: hashSecret(codeValue) } })).used, false);
        const issued = await post('/oauth/token', exchangeRequest);
        assert.equal(issued.status, 200);
        const initialTokens = await issued.json();
        const initialGrant = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(initialTokens.access_token) } });
        assert.equal(initialGrant.resource, resource);
        assert.equal(initialGrant.clientId, client.client_id);
        assert.equal(initialGrant.userId, userId);
        assert.equal(initialGrant.metaTokenId, storedCode.metaTokenId);
        assert.deepEqual(initialGrant.selectedAccountIds, ['act_100']);
        const refreshed = await post('/oauth/token', { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: initialTokens.refresh_token, scope: 'ads_read', resource: variant.refresh });
        assert.equal(refreshed.status, 200);
        const refreshedTokens = await refreshed.json();
        assert.equal(refreshedTokens.scope, 'ads_read');
        const refreshedGrant = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(refreshedTokens.access_token) } });
        assert.equal(refreshedGrant.resource, resource);
        assert.equal(refreshedGrant.clientId, client.client_id);
        assert.equal(refreshedGrant.userId, userId);
        assert.equal(refreshedGrant.metaTokenId, storedCode.metaTokenId);
        assert.ok(initialGrant.operationOwnerId);
        assert.equal(refreshedGrant.operationOwnerId, initialGrant.operationOwnerId);
        assert.deepEqual(refreshedGrant.selectedAccountIds, ['act_100']);
        assert.ok(refreshedGrant.refreshExpiresAt.getTime() > initialGrant.refreshExpiresAt.getTime());
        assert.equal(initialGrant.scope, 'ads_read');
        assert.deepEqual(await prisma.oAuthAccessToken.findUnique({ where: { token: initialGrant.token } }), {
          ...initialGrant, refreshToken: null, refreshExpiresAt: null,
        });
        assert.equal((await post('/oauth/token', { grant_type: 'refresh_token', client_id: client.client_id, refresh_token: initialTokens.refresh_token })).status, 400);
        assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: initialGrant.operationOwnerId } }), 0);
      });
    }
  } finally {
    // Cleanup is registered before creating clients, including setup failures.
  }
});
