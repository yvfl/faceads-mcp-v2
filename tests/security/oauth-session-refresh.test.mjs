import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';

const databaseUrl = process.env.DATABASE_URL_TEST;

test('OAuth refresh preserves MCP sessions only for the same consented connection and authority', {
  skip: !databaseUrl && 'Requires isolated PostgreSQL via DATABASE_URL_TEST',
}, async t => {
  const database = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && /test/.test(database.pathname));
  process.env.DATABASE_URL = databaseUrl;
  process.env.MCP_ENCRYPTION_KEY = 'c'.repeat(64);
  process.env.META_ACCESS_TOKEN = 'synthetic-session-environment-token';
  const { startHttpServer } = await import('../../dist/transports/http-server.js');
  const { createMcpServer } = await import('../../dist/server.js');
  const { getPrisma } = await import('../../dist/db/prisma.js');
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const { encryptToken } = await import('../../dist/db/crypto.js');
  let beforeConnect;
  let closedServers = 0;
  const server = await startHttpServer({ port: 0, createServer: () => {
    const server = createMcpServer();
    const connect = server.connect.bind(server);
    const close = server.close.bind(server);
    server.connect = async transport => { await beforeConnect?.(); return connect(transport); };
    server.close = async () => { closedServers++; return close(); };
    return server;
  } });
  if (!server.listener.listening) await once(server.listener, 'listening');
  const base = `http://127.0.0.1:${server.listener.address().port}`;
  process.env.MCP_BASE_URL = base;
  const prisma = getPrisma();
  const clients = [];
  const users = [];
  const originalFetch = globalThis.fetch;
  const graphRequests = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname !== 'graph.facebook.com') return originalFetch(input, options);
    graphRequests.push({ url: url.toString(), options });
    assert.notEqual(options?.method, 'POST', 'these read-only checks must never mutate Meta');
    return new Response(JSON.stringify({ data: [{ id: '101', name: 'Synthetic campaign', status: 'PAUSED' }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await prisma.oAuthAccessToken.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.metaToken.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.oAuthClient.deleteMany({ where: { id: { in: clients } } });
    await server.close();
  });
  async function createClient() {
    const client = await prisma.oAuthClient.create({ data: {
      clientName: `Session refresh ${randomUUID()}`, redirectUris: ['https://synthetic.example/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
    } });
    clients.push(client.id);
    return client;
  }
  async function createUser() {
    const user = await prisma.user.create({ data: { email: `session-${randomUUID()}@example.test`, passwordHash: 'synthetic-password' } });
    users.push(user.id);
    return user;
  }
  const client = await createClient();
  const user = await createUser();
  const meta = await prisma.metaToken.create({ data: { userId: user.id, accessToken: encryptToken('synthetic-session-meta-token') } });
  const grantDefaults = {
    clientId: client.id, userId: user.id, metaTokenId: meta.id, resource: `${base}/mcp`,
    scope: 'ads_read ads_management', selectedAccountIds: ['act_100', 'act_200'],
    expiresAt: new Date(Date.now() + 60_000), refreshExpiresAt: new Date(Date.now() + 86_400_000),
  };
  async function createGrant(overrides = {}) {
    const access_token = randomBytes(32).toString('base64url');
    const refresh_token = randomBytes(32).toString('base64url');
    const row = await prisma.oAuthAccessToken.create({ data: {
      ...grantDefaults, ...overrides, token: hashSecret(access_token), refreshToken: hashSecret(refresh_token),
    } });
    return { access_token, refresh_token, owner: row.operationOwnerId };
  }
  const headers = (bearer, session) => ({
    Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
    ...(session ? { 'Mcp-Session-Id': session } : {}),
  });
  const post = (bearer, session, method, params = {}, requestOptions = {}) => originalFetch(`${base}/mcp`, {
    method: 'POST', headers: headers(bearer, session), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    ...requestOptions,
  });
  async function initialize(bearer, requestOptions) {
    return post(bearer, undefined, 'initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic-session-client', version: '1' },
    }, requestOptions);
  }
  async function newSession(bearer) {
    const response = await initialize(bearer);
    assert.equal(response.status, 200);
    const session = response.headers.get('mcp-session-id');
    assert.ok(session);
    await response.json();
    return session;
  }
  async function oauth(path, body) {
    return originalFetch(`${base}/oauth/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: client.id, ...body }),
    });
  }
  async function refresh(tokens, scope) {
    const response = await oauth('token', {
      grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource: `${base}/mcp`, ...(scope ? { scope } : {}),
    });
    assert.equal(response.status, 200);
    const next = await response.json();
    assert.notEqual(next.access_token, tokens.access_token);
    assert.notEqual(next.refresh_token, tokens.refresh_token);
    const row = await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(next.access_token) } });
    assert.equal(row.operationOwnerId, tokens.owner);
    return { ...next, owner: tokens.owner };
  }
  async function assertMethods(bearer, session, status) {
    for (const method of ['POST', 'GET', 'DELETE']) {
      const response = method === 'POST' ? await post(bearer, session, 'tools/list')
        : await originalFetch(`${base}/mcp`, { method, headers: headers(bearer, session) });
      assert.equal(response.status, status, `${method} must return ${status}`);
      await response.text();
    }
  }
  async function read(bearer, session) {
    const response = await post(bearer, session, 'tools/call', {
      name: 'list_campaigns', arguments: { account_id: 'act_100', fields: ['id', 'name', 'status'] },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(!payload.result.isError, JSON.stringify(payload));
    assert.match(JSON.stringify(payload), /Synthetic campaign/);
    assert.equal(new URL(graphRequests.at(-1).url).pathname.endsWith('/act_100/campaigns'), true);
    assert.match(JSON.stringify(graphRequests.at(-1)), /synthetic-session-meta-token/);
  }

  let tokens = await createGrant();
  const originalSession = await newSession(tokens.access_token);
  await t.test('expired access is rejected, while a valid refresh resumes the existing session and real MCP read handler', async () => {
    await read(tokens.access_token, originalSession);
    await prisma.oAuthAccessToken.update({ where: { token: hashSecret(tokens.access_token) }, data: { expiresAt: new Date(Date.now() - 1) } });
    await assertMethods(tokens.access_token, originalSession, 401);
    const previous = tokens;
    tokens = await refresh(tokens);
    await assertMethods(previous.access_token, originalSession, 401);
    await read(tokens.access_token, originalSession);
  });
  await t.test('equivalent account and scope ordering keeps the same session', async () => {
    await prisma.oAuthAccessToken.update({ where: { token: hashSecret(tokens.access_token) }, data: { selectedAccountIds: ['act_200', 'act_100'] } });
    tokens = await refresh(tokens, 'ads_management ads_read');
    await read(tokens.access_token, originalSession);
  });
  await t.test('a new authorization cannot reuse an old session even with the same application, login and saved Meta token', async () => {
    const another = await createGrant();
    assert.notEqual(another.owner, tokens.owner);
    await assertMethods(another.access_token, originalSession, 404);
  });
  await t.test('full identity binding rejects changed accounts, Meta credentials, application and user', async () => {
    const otherClient = await createClient();
    const otherUser = await createUser();
    const otherMeta = await prisma.metaToken.create({ data: { userId: user.id, accessToken: encryptToken('synthetic-alternate-meta-token') } });
    const otherUserMeta = await prisma.metaToken.create({ data: { userId: otherUser.id, accessToken: encryptToken('synthetic-other-user-meta-token') } });
    for (const overrides of [
      { selectedAccountIds: ['act_100'] },
      { metaTokenId: otherMeta.id },
      { clientId: otherClient.id },
      { userId: otherUser.id, metaTokenId: otherUserMeta.id },
    ]) {
      // Even an incorrectly reused family ID cannot cross these consent boundaries.
      const changed = await createGrant({ operationOwnerId: tokens.owner, ...overrides });
      await assertMethods(changed.access_token, originalSession, 404);
    }
  });
  let readSession;
  await t.test('scope reduction requires a new session and cannot retain management authority', async () => {
    const previous = tokens;
    tokens = await refresh(tokens, 'ads_read');
    await assertMethods(previous.access_token, originalSession, 401);
    await assertMethods(tokens.access_token, originalSession, 404);
    readSession = await newSession(tokens.access_token);
    await read(tokens.access_token, readSession);
    const requestCount = graphRequests.length;
    const response = await post(tokens.access_token, readSession, 'tools/call', {
      name: 'execute_api', arguments: { method: 'POST', endpoint: 'act_100/campaigns', params: { name: 'must-not-run', status: 'PAUSED' } },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.isError, true);
    assert.match(JSON.stringify(payload), /Permission denied/);
    assert.equal(graphRequests.length, requestCount, 'read-only mutation is denied before Graph');
  });
  await t.test('refresh cannot reset the five-session connection limit', async () => {
    for (let i = 0; i < 4; i++) await newSession(tokens.access_token);
    tokens = await refresh(tokens);
    await read(tokens.access_token, readSession);
    const limited = await initialize(tokens.access_token);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error, 'session_limit');
    const deleted = await originalFetch(`${base}/mcp`, { method: 'DELETE', headers: headers(tokens.access_token, readSession) });
    assert.equal(deleted.status, 200);
    await deleted.text();
    readSession = await newSession(tokens.access_token);
    await read(tokens.access_token, readSession);
  });
  await t.test('revocation immediately blocks every request on the retained session and subsequent refresh', async () => {
    assert.equal((await oauth('revoke', { token: tokens.refresh_token })).status, 200);
    await assertMethods(tokens.access_token, readSession, 401);
    const response = await oauth('token', { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_grant');
  });
  await t.test('replay revokes the refreshed session without invalidating a separate connection using the same saved Meta token', async () => {
    const first = await createGrant();
    const separate = await createGrant();
    const firstSession = await newSession(first.access_token);
    const separateSession = await newSession(separate.access_token);
    const current = await refresh(first);
    await read(current.access_token, firstSession);
    const replay = await oauth('token', { grant_type: 'refresh_token', refresh_token: first.refresh_token });
    assert.equal(replay.status, 400);
    assert.equal((await replay.json()).error, 'invalid_grant');
    await assertMethods(current.access_token, firstSession, 401);
    await read(separate.access_token, separateSession);
  });
  await t.test('scope reduction replaces five obsolete sessions immediately without closing another connection', async () => {
    const full = await createGrant();
    const independent = await createGrant();
    const oldSessions = [];
    for (let i = 0; i < 5; i++) oldSessions.push(await newSession(full.access_token));
    const independentSession = await newSession(independent.access_token);
    const narrow = await refresh(full, 'ads_read');
    const readSession = await newSession(narrow.access_token);
    await read(narrow.access_token, readSession);
    for (const oldSession of oldSessions) {
      const response = await post(narrow.access_token, oldSession, 'tools/list');
      assert.equal(response.status, 404);
      await response.json();
    }
    const requestCount = graphRequests.length;
    const denied = await post(narrow.access_token, readSession, 'tools/call', {
      name: 'execute_api', arguments: { method: 'POST', endpoint: 'act_100/campaigns', params: { name: 'must-not-run', status: 'PAUSED' } },
    });
    assert.equal(denied.status, 200);
    assert.equal((await denied.json()).result.isError, true);
    assert.equal(graphRequests.length, requestCount);
    await read(independent.access_token, independentSession);
  });
  await t.test('concurrent initialization reserves the connection limit before awaiting transport setup', async () => {
    const concurrent = await createGrant();
    let release;
    let ready;
    let started = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const fiveWaiting = new Promise(resolve => { ready = resolve; });
    beforeConnect = async () => { if (++started === 5) ready(); await gate; };
    const pending = Array.from({ length: 5 }, () => initialize(concurrent.access_token));
    let timeout;
    try {
      await Promise.race([
        fiveWaiting,
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Five initializations did not reach the test barrier')), 5000); }),
      ]);
      const limited = await initialize(concurrent.access_token, { signal: AbortSignal.timeout(2000) });
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).error, 'session_limit');
      assert.equal(started, 5);
    } finally {
      clearTimeout(timeout);
      beforeConnect = undefined;
      release();
      for (const response of await Promise.all(pending)) {
        assert.equal(response.status, 200);
        await response.json();
      }
    }
  });
  await t.test('failed transport setup and rejected initialization release reservations and close unused servers', async () => {
    const retryable = await createGrant();
    const closedBefore = closedServers;
    beforeConnect = async () => { throw new Error('synthetic transport setup failure'); };
    try {
      for (let i = 0; i < 6; i++) {
        const response = await initialize(retryable.access_token);
        assert.equal(response.status, 500);
        await response.json();
      }
    } finally {
      beforeConnect = undefined;
    }
    for (let i = 0; i < 6; i++) {
      const response = await initialize(retryable.access_token, { headers: { ...headers(retryable.access_token), Accept: 'application/json' } });
      assert.equal(response.status, 406);
      await response.json();
    }
    assert.ok(closedServers >= closedBefore + 12);
    const session = await newSession(retryable.access_token);
    await read(retryable.access_token, session);
  });
});
