import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL_TEST;
test('same login across applications keeps independent Meta credentials, scopes and OAuth refresh grants', {
  skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated PostgreSQL database',
}, async t => {
  const database = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && /test/.test(database.pathname));
  process.env.DATABASE_URL = databaseUrl;
  process.env.MCP_ENCRYPTION_KEY = 'c'.repeat(64);
  process.env.META_ACCESS_TOKEN = 'synthetic-offline-environment-token';
  const { oauthRouter } = await import('../../dist/routes/oauth.js');
  const { resolveBearer } = await import('../../dist/transports/http-server.js');
  const { getPrisma, disconnectPrisma } = await import('../../dist/db/prisma.js');
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const prisma = getPrisma();
  const originalFetch = globalThis.fetch;
  const app = express();
  app.use(express.json());
  app.use('/oauth', oauthRouter);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.MCP_BASE_URL = base;
  const resource = base + '/mcp';
  const redirect = 'https://synthetic-multi-client.example/callback';
  const suffix = randomUUID();
  const email = `multi-client-${suffix}@example.test`;
  const password = 'synthetic-multi-client-password';
  const verifier = 'd'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const clients = [];
  const users = [];

  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname !== 'graph.facebook.com') return originalFetch(input, options);
    assert.ok(url.pathname.endsWith('/me') || url.pathname.endsWith('/me/permissions') || url.pathname.endsWith('/me/adaccounts'));
    const data = url.pathname.endsWith('/me') ? { id: '900001' }
      : url.pathname.endsWith('/permissions') ? { data: [{ permission: 'ads_read', status: 'granted' }, { permission: 'ads_management', status: 'granted' }] }
        : { data: [{ id: 'act_100', name: 'Synthetic A' }, { id: 'act_200', name: 'Synthetic B' }] };
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await prisma.oAuthFlow.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.oAuthAccessToken.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.authorizationCode.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.metaToken.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.oAuthClient.deleteMany({ where: { id: { in: clients } } });
    await new Promise(resolve => server.close(resolve));
    await disconnectPrisma();
  });
  async function post(path, body, cookie) {
    return originalFetch(base + path, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
      body: new URLSearchParams(body),
    });
  }
  async function register(name) {
    const response = await originalFetch(base + '/oauth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: name, redirect_uris: [redirect] }),
    });
    assert.equal(response.status, 201);
    const value = await response.json();
    clients.push(value.client_id);
    return value.client_id;
  }
  async function login(clientId, action = 'login') {
    const query = new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'code', code_challenge: challenge,
      code_challenge_method: 'S256', resource, scope: 'ads_read ads_management',
    });
    const response = await originalFetch(base + '/oauth/authorize?' + query, { redirect: 'manual' });
    assert.equal(response.status, 200);
    const html = await response.text();
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const fields = {
      flow: html.match(/name="flow" value="([^"]+)"/)[1],
      csrf: html.match(/name="csrf" value="([^"]+)"/)[1],
    };
    assert.equal((await post('/oauth/authorize', { ...fields, email, password, action }, cookie)).status, 303);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    if (!users.includes(user.id)) users.push(user.id);
    return { fields, cookie };
  }
  async function connect(clientId, metaToken, accountId, accessMode, action) {
    const browser = await login(clientId, action);
    const settings = { ...browser.fields, ...(metaToken ? { meta_access_token: metaToken } : { use_saved: 'yes' }) };
    assert.equal((await post('/oauth/settings', settings, browser.cookie)).status, 303);
    const consent = await post('/oauth/consent', {
      ...browser.fields, consent: 'yes', account_ids: accountId, access_mode: accessMode,
    }, browser.cookie);
    assert.equal(consent.status, 303);
    const code = new URL(consent.headers.get('location')).searchParams.get('code');
    const exchange = await post('/oauth/token', {
      grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect, code_verifier: verifier, code, resource,
    });
    assert.equal(exchange.status, 200);
    return exchange.json();
  }
  async function refresh(clientId, tokens) {
    const response = await post('/oauth/token', { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token, resource });
    assert.equal(response.status, 200);
    return response.json();
  }

  const firstClient = await register('Synthetic first application');
  const secondClient = await register('Synthetic second application');
  const firstMeta = 'SYNTHETIC_META_FIRST_APPLICATION';
  const secondMeta = 'SYNTHETIC_META_SECOND_APPLICATION';
  let first = await connect(firstClient, firstMeta, 'act_100', 'readwrite', 'register');
  const firstGrant = await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(first.access_token) } });
  let second = await connect(secondClient, secondMeta, 'act_200', 'read');

  await t.test('settings lists other applications and all their accounts after one family accumulates over 100 access tokens', async () => {
    await prisma.oAuthAccessToken.createMany({ data: Array.from({ length: 105 }, (_, index) => ({
      ...firstGrant,
      token: hashSecret(`synthetic-settings-overlap-${suffix}-${index}`),
      refreshToken: null, refreshExpiresAt: null,
    })) });
    // Both a second account for the first application and a new application
    // appear after its many overlap rows. They must remain visible to the user.
    await connect(firstClient, undefined, 'act_200', 'readwrite');
    const additionalClient = await register('Synthetic additional application');
    await connect(additionalClient, undefined, 'act_200', 'read');
    const browser = await login(firstClient);
    const response = await originalFetch(base + '/oauth/settings?' + new URLSearchParams({ flow: browser.fields.flow }), {
      headers: { cookie: browser.cookie }, redirect: 'manual',
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    const connections = [...html.matchAll(/<div class="connection">([\s\S]*?)<\/form><\/div>/g)].map(match => match[1]);
    assert.ok(connections.some(connection => /<strong>Synthetic first application<\/strong><small>2 conta\(s\) autorizada\(s\)<\/small>/.test(connection)),
      'The settings page must count both authorized accounts even when the second grant follows many overlap rows');
    assert.ok(connections.some(connection => /<strong>Synthetic additional application<\/strong><small>1 conta\(s\) autorizada\(s\)<\/small>/.test(connection)),
      'The settings page must still expose the other application and its authorized account');
  });

  await t.test('second app login and distinct Meta credential leave the first app unchanged', async () => {
    const firstContext = await resolveBearer(first.access_token);
    const secondContext = await resolveBearer(second.access_token);
    assert.equal(firstContext.userId, secondContext.userId);
    assert.equal(firstContext.accessToken, firstMeta);
    assert.equal(secondContext.accessToken, secondMeta);
    assert.deepEqual(firstContext.allowedAccountIds, ['act_100']);
    assert.deepEqual(secondContext.allowedAccountIds, ['act_200']);
    assert.equal(firstContext.permissions, 'readwrite');
    assert.equal(secondContext.permissions, 'read');
    assert.notEqual(firstContext.operationOwnerId, secondContext.operationOwnerId);
    assert.deepEqual(await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: firstGrant.token } }), firstGrant);
  });

  await t.test('using the latest saved token creates another grant without replacing older credentials', async () => {
    const reconnected = await connect(secondClient, undefined, 'act_200', 'read');
    assert.equal((await resolveBearer(reconnected.access_token)).accessToken, secondMeta);
    assert.equal((await resolveBearer(first.access_token)).accessToken, firstMeta);
    assert.equal((await resolveBearer(second.access_token)).accessToken, secondMeta);
  });

  await t.test('each application refreshes independently with unchanged account and permission scope', async () => {
    first = await refresh(firstClient, first);
    assert.ok(await resolveBearer(second.access_token));
    second = await refresh(secondClient, second);
    assert.equal((await resolveBearer(first.access_token)).accessToken, firstMeta);
    assert.deepEqual((await resolveBearer(first.access_token)).allowedAccountIds, ['act_100']);
    assert.equal((await resolveBearer(second.access_token)).permissions, 'read');
    assert.equal((await resolveBearer(first.access_token)).operationOwnerId, firstGrant.operationOwnerId);
  });

  await t.test('the same saved Meta token supports independent full-access and readonly applications', async () => {
    let fullWithSaved = await connect(firstClient, undefined, 'act_200', 'readwrite');
    const fullContext = await resolveBearer(fullWithSaved.access_token);
    const readContext = await resolveBearer(second.access_token);
    assert.equal(fullContext.accessToken, secondMeta);
    assert.equal(readContext.accessToken, secondMeta);
    assert.equal(fullContext.permissions, 'readwrite');
    assert.equal(readContext.permissions, 'read');
    assert.notEqual(fullContext.operationOwnerId, readContext.operationOwnerId);
    fullWithSaved = await refresh(firstClient, fullWithSaved);
    second = await refresh(secondClient, second);
    assert.equal((await resolveBearer(fullWithSaved.access_token)).permissions, 'readwrite');
    assert.equal((await resolveBearer(second.access_token)).permissions, 'read');
    assert.equal((await resolveBearer(first.access_token)).accessToken, firstMeta);
  });

  await t.test('explicit browser revocation of the second app preserves the first app and its refresh', async () => {
    const browser = await login(firstClient);
    const revoked = await post('/oauth/connections/revoke', { ...browser.fields, client_id: secondClient }, browser.cookie);
    assert.equal(revoked.status, 200);
    assert.equal(await resolveBearer(second.access_token), null);
    assert.ok(await resolveBearer(first.access_token));
    first = await refresh(firstClient, first);
    assert.equal((await resolveBearer(first.access_token)).accessToken, firstMeta);
    assert.equal((await prisma.oAuthAccessToken.count({ where: { userId: users[0], clientId: secondClient } })), 0);
  });
});
