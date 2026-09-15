import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL_TEST;
const isolated = { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated PostgreSQL database' };
const ACCESS_TTL = 120 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const REFRESH_IDLE_TTL = 90 * DAY;

test('configured short access TTL survives repeated refresh through the HTTP OAuth and MCP routes', isolated, async t => {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname),
    'Short TTL integration tests require a local database named test');
  const originalFetch = globalThis.fetch;
  const databaseName = `faceads_access_ttl_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: databaseUrl });
  let databaseCreated = false;
  let server;
  let disconnectPrisma;
  let clockEnabled = false;
  await admin.connect();
  t.after(async () => {
    if (clockEnabled) t.mock.timers.reset();
    globalThis.fetch = originalFetch;
    try {
      if (server) await server.close();
      if (disconnectPrisma) await disconnectPrisma();
    } finally {
      try {
        if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally { await admin.end(); }
    }
  });
  // The suite advances Date and must not expose its expiry cleanup to another
  // integration suite using the real wall clock or a different token lifetime.
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  const fixtureUrl = new URL(databaseUrl);
  fixtureUrl.pathname = `/${databaseName}`;
  const schema = new pg.Client({ connectionString: fixtureUrl.toString() });
  await schema.connect();
  try {
    const migrations = new URL('../../prisma/migrations/', import.meta.url);
    const folders = (await readdir(migrations, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && /^\d{14}_/.test(entry.name))
      .map(entry => entry.name).sort();
    for (const folder of folders) {
      await schema.query(await readFile(new URL(`${folder}/migration.sql`, migrations), 'utf8'));
    }
  } finally { await schema.end(); }
  process.env.DATABASE_URL = fixtureUrl.toString();
  process.env.MCP_ENCRYPTION_KEY = 'd'.repeat(64);
  process.env.META_ACCESS_TOKEN = 'synthetic-short-access-environment';
  process.env.MCP_BASE_URL = 'http://127.0.0.1:0';
  // Set before any application module import: this is a startup setting.
  process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS = '120';
  const { startHttpServer } = await import('../../dist/transports/http-server.js');
  const databaseModule = await import('../../dist/db/prisma.js');
  disconnectPrisma = databaseModule.disconnectPrisma;
  const prisma = databaseModule.getPrisma();
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const { encryptToken } = await import('../../dist/db/crypto.js');
  globalThis.fetch = async () => { throw new Error('Short TTL tests must not call an external API'); };
  t.mock.method(console, 'info', () => {});
  server = await startHttpServer({ port: 0, createServer: () => new Server({ name: 'synthetic-short-ttl', version: '1' }) });
  if (!server.listener.listening) await once(server.listener, 'listening');
  const base = `http://127.0.0.1:${server.listener.address().port}`;
  process.env.MCP_BASE_URL = base;
  const resource = `${base}/mcp`;
  const redirect = 'https://synthetic-short-ttl.example/callback';
  const verifier = 'v'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let now = Date.UTC(2020, 0, 1);
  t.mock.timers.enable({ apis: ['Date'], now });
  clockEnabled = true;
  const advance = milliseconds => {
    assert.ok(milliseconds >= 0, 'The test clock only moves forward');
    now += milliseconds;
    t.mock.timers.setTime(now);
  };
  const user = await prisma.user.create({ data: { email: `short-ttl-${randomUUID()}@example.test` } });
  const meta = await prisma.metaToken.create({ data: {
    userId: user.id, accessToken: encryptToken('SYNTHETIC_SHORT_TTL_META'),
    scopes: 'ads_read', metaUserId: '900003',
  } });
  const client = await prisma.oAuthClient.create({ data: {
    clientName: `Short TTL ${randomUUID()}`, redirectUris: [redirect],
    grantTypes: ['authorization_code', 'refresh_token'],
  } });
  function tokenRequest(body) {
    return originalFetch(`${base}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: client.id, resource, ...body }), redirect: 'manual',
    });
  }
  function stored(tokens) {
    return prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(tokens.access_token) } });
  }
  async function assertIssued(response) {
    assert.equal(response.status, 200);
    const tokens = await response.json();
    assert.equal(tokens.token_type, 'Bearer');
    assert.equal(tokens.expires_in, 120, 'The response advertises the configured lifetime in seconds');
    assert.equal(tokens.scope, 'ads_read');
    const row = await stored(tokens);
    assert.equal(row.expiresAt.getTime(), now + ACCESS_TTL, 'The stored bearer lifetime agrees with expires_in');
    assert.equal(row.refreshExpiresAt.getTime(), now + REFRESH_IDLE_TTL,
      'Short access lifetime must not shorten the 90-day refresh inactivity window');
    return tokens;
  }
  async function issue() {
    const code = `synthetic-short-ttl-code-${randomUUID()}`;
    await prisma.authorizationCode.create({ data: {
      code: hashSecret(code), clientId: client.id, userId: user.id, redirectUri: redirect, scope: 'ads_read',
      codeChallenge: challenge, codeChallengeMethod: 'S256', resource, selectedAccountIds: ['act_100'],
      metaTokenId: meta.id, expiresAt: new Date(now + 5 * 60 * 1000),
    } });
    return assertIssued(await tokenRequest({
      grant_type: 'authorization_code', redirect_uri: redirect, code_verifier: verifier, code,
    }));
  }
  async function renew(previous) {
    const tokens = await assertIssued(await tokenRequest({ grant_type: 'refresh_token', refresh_token: previous.refresh_token }));
    assert.notEqual(tokens.access_token, previous.access_token);
    assert.notEqual(tokens.refresh_token, previous.refresh_token);
    return tokens;
  }
  function mcp(tokens, session, method = 'ping', params = {}) {
    return originalFetch(resource, {
      method: 'POST', headers: {
        authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session, 'mcp-protocol-version': '2025-11-25' } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  }
  async function initialize(tokens) {
    const response = await mcp(tokens, undefined, 'initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic-short-ttl', version: '1' },
    });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).result);
    const session = response.headers.get('mcp-session-id');
    assert.ok(session);
    return session;
  }
  async function ping(tokens, session, status = 200) {
    const response = await mcp(tokens, session);
    assert.equal(response.status, status, `Bearer authentication must return HTTP ${status}`);
    const payload = await response.json();
    if (status === 200) assert.deepEqual(payload.result, {});
    else {
      assert.deepEqual(payload, { error: 'invalid_token' });
      assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
    }
  }

  await t.test('authorization-code issuance and three sequential refreshes advertise and enforce 120 seconds', async () => {
    let tokens = await issue();
    const first = tokens;
    const firstRow = await stored(first);
    const session = await initialize(tokens);
    await ping(tokens, session);
    for (let rotation = 0; rotation < 3; rotation++) {
      const previous = tokens;
      const previousRow = await stored(previous);
      advance(previousRow.expiresAt.getTime() - now - 30_000);
      tokens = await renew(previous);
      const retained = await stored(previous);
      assert.equal(retained.expiresAt.getTime(), previousRow.expiresAt.getTime(),
        'Proactive rotation must not extend the previous bearer beyond its original expiry');
      assert.equal(retained.refreshToken, null);
      assert.equal(retained.refreshExpiresAt, null);
      assert.equal((await stored(tokens)).operationOwnerId, firstRow.operationOwnerId,
        'All refreshes preserve the same consented authorization');
      await ping(previous, session);
      await ping(tokens, session);
      advance(29_999);
      await ping(previous, session);
      advance(1);
      await ping(previous, session, 401);
      await ping(tokens, session);
      assert.equal(await prisma.oAuthAccessToken.count({ where: {
        operationOwnerId: firstRow.operationOwnerId, refreshToken: { not: null },
      } }), 1, 'Only the latest successor keeps refresh authority');
    }
    assert.equal(await prisma.oAuthUsedRefreshToken.count({ where: { operationOwnerId: firstRow.operationOwnerId } }), 3);
    await ping(first, session, 401);
  });

  await t.test('an expired two-minute bearer can still renew a day later without another authorization', async () => {
    const tokens = await issue();
    const session = await initialize(tokens);
    const row = await stored(tokens);
    advance(ACCESS_TTL - 1);
    await ping(tokens, session);
    advance(1);
    await ping(tokens, session, 401);
    assert.equal((await stored(tokens)).refreshExpiresAt.getTime(), row.refreshExpiresAt.getTime());
    advance(DAY - ACCESS_TTL);
    const successor = await renew(tokens);
    assert.equal((await stored(successor)).operationOwnerId, row.operationOwnerId);
    assert.equal(await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } }), null,
      'Refresh after access expiry must not restore the expired bearer');
    await ping(tokens, session, 401);
    await ping(successor, await initialize(successor));
  });
});
