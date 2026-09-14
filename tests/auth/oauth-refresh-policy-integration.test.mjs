import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL_TEST;
const isolated = { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated PostgreSQL database' };
const DAY = 24 * 60 * 60 * 1000;
const IDLE = 90 * DAY;
const HOUR = 60 * 60 * 1000;

function verifyDatabase() {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname),
    'Refresh integration tests require a local database named test');
}

test('OAuth refresh follows inactivity, preserves grants and rejects replay without grace', isolated, async t => {
  verifyDatabase();
  const warnings = t.mock.method(console, 'warn', () => {});
  const issuances = t.mock.method(console, 'info', () => {});
  const authorizationRefs = new Map();
  const originalFetch = globalThis.fetch;
  const databaseName = `faceads_refresh_test_${randomUUID().replaceAll('-', '')}`;
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
      if (server) await new Promise(resolve => server.close(resolve));
      if (disconnectPrisma) await disconnectPrisma();
    } finally {
      try {
        if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally { await admin.end(); }
    }
  });
  // A distinct database is necessary: a virtual clock cannot share global
  // expiry cleanup with other test processes using the current wall clock.
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
  process.env.MCP_ENCRYPTION_KEY = 'e'.repeat(64);
  process.env.META_ACCESS_TOKEN = 'synthetic-refresh-policy-environment';
  const { oauthRouter } = await import('../../dist/routes/oauth.js');
  const { resolveBearer } = await import('../../dist/transports/http-server.js');
  const databaseModule = await import('../../dist/db/prisma.js');
  const { getPrisma } = databaseModule;
  disconnectPrisma = databaseModule.disconnectPrisma;
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const { encryptToken } = await import('../../dist/db/crypto.js');
  const prisma = getPrisma();
  globalThis.fetch = async () => { throw new Error('Refresh policy must not call the Meta API'); };
  const app = express();
  app.use(express.json());
  app.use('/oauth', oauthRouter);
  server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.MCP_BASE_URL = base;
  const resource = base + '/mcp';
  const redirect = 'https://synthetic-refresh-policy.example/callback';
  const verifier = 'f'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const suffix = randomUUID();
  let userId;
  const clockStart = Date.UTC(2020, 0, 1);
  let now = clockStart;
  t.mock.timers.enable({ apis: ['Date'], now: clockStart });
  clockEnabled = true;
  const advance = milliseconds => { now += milliseconds; t.mock.timers.setTime(now); };

  userId = (await prisma.user.create({ data: { email: `refresh-policy-${suffix}@example.test` } })).id;
  const meta = await prisma.metaToken.create({ data: { userId, accessToken: encryptToken('SYNTHETIC_REFRESH_POLICY_META'), scopes: 'ads_read ads_management', metaUserId: '900001' } });
  async function createClient(name) {
    const client = await prisma.oAuthClient.create({ data: {
      clientName: `${name} ${suffix}`, redirectUris: [redirect], grantTypes: ['authorization_code', 'refresh_token'],
    } });
    return client.id;
  }
  const mainClient = await createClient('Primary');
  const otherClient = await createClient('Independent');
  async function post(path, body) {
    return originalFetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body), redirect: 'manual',
    });
  }
  async function stored(tokens) {
    return prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
  }
  async function issue({ clientId = mainClient, scope = 'ads_read ads_management', accounts = ['act_100', 'act_200'] } = {}) {
    const code = `synthetic-code-${randomUUID()}`;
    await prisma.authorizationCode.create({ data: {
      code: hashSecret(code), clientId, userId, redirectUri: redirect, scope,
      codeChallenge: challenge, codeChallengeMethod: 'S256', resource, selectedAccountIds: accounts,
      metaTokenId: meta.id, expiresAt: new Date(now + 5 * 60 * 1000),
    } });
    const start = issuances.mock.calls.length;
    const response = await post('/oauth/token', {
      grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect,
      code_verifier: verifier, code, resource,
    });
    assert.equal(response.status, 200);
    const tokens = await response.json();
    assert.equal(tokens.expires_in, HOUR / 1000);
    const grant = await stored(tokens);
    assert.equal(grant.expiresAt.getTime(), now + HOUR);
    assert.equal(grant.refreshExpiresAt.getTime(), now + IDLE);
    const ref = assertIssued(start, 'authorization_code');
    assert.ok(![...authorizationRefs.values()].includes(ref), 'New consent must get a distinct diagnostic reference');
    authorizationRefs.set(grant.operationOwnerId, ref);
    return tokens;
  }
  async function refresh(tokens, changes = {}) {
    return post('/oauth/token', {
      grant_type: 'refresh_token', client_id: mainClient, refresh_token: tokens.refresh_token, resource, ...changes,
    });
  }
  async function renew(tokens, changes = {}) {
    const previous = await stored(tokens);
    const start = issuances.mock.calls.length;
    const response = await refresh(tokens, changes);
    assert.equal(response.status, 200);
    const renewed = await response.json();
    const grant = await stored(renewed);
    assert.equal(renewed.expires_in, 3600);
    assert.equal(grant.expiresAt.getTime(), now + HOUR);
    assert.equal(grant.refreshExpiresAt.getTime(), now + IDLE);
    assert.equal(grant.clientId, previous.clientId);
    assert.equal(grant.resource, previous.resource);
    assert.equal(grant.metaTokenId, previous.metaTokenId);
    assert.equal(grant.userId, previous.userId);
    assert.equal(grant.operationOwnerId, previous.operationOwnerId);
    assert.deepEqual(grant.selectedAccountIds, previous.selectedAccountIds);
    assert.notEqual(renewed.access_token, tokens.access_token);
    assert.notEqual(renewed.refresh_token, tokens.refresh_token);
    const retained = await stored(tokens);
    const sameScope = [...new Set(previous.scope.split(/\s+/))].sort().join(' ') === [...new Set(grant.scope.split(/\s+/))].sort().join(' ');
    if (previous.expiresAt.getTime() > now && sameScope) {
      assert.deepEqual(retained, { ...previous, refreshToken: null, refreshExpiresAt: null });
    } else {
      assert.equal(retained, null);
    }
    assert.equal(assertIssued(start, 'refresh_token'), authorizationRefs.get(previous.operationOwnerId));
    const used = await prisma.oAuthUsedRefreshToken.findUniqueOrThrow({ where: { refreshToken: hashSecret(tokens.refresh_token) } });
    assert.equal(used.retainUntil.getTime(), now + IDLE);
    assert.equal(used.operationOwnerId, previous.operationOwnerId);
    assert.equal(used.clientId, previous.clientId);
    assert.equal(used.userId, previous.userId);
    assert.equal(used.scope, previous.scope);
    assert.equal(used.resource, previous.resource);
    return renewed;
  }
  function assertIssued(start, grantType) {
    const calls = issuances.mock.calls.slice(start);
    assert.equal(calls.length, 1);
    const log = JSON.parse(calls[0].arguments[0]);
    assert.deepEqual(Object.keys(log).sort(), ['authorization_ref', 'event', 'grant_type', 'timestamp']);
    assert.equal(log.event, 'oauth_token_issued');
    assert.equal(log.grant_type, grantType);
    assert.equal(log.timestamp, new Date(now).toISOString());
    assert.match(log.authorization_ref, /^[a-f0-9]{32}$/);
    return log.authorization_ref;
  }
  function assertDiagnostic(start, reason) {
    const calls = warnings.mock.calls.slice(start);
    assert.equal(calls.length, 1);
    const log = JSON.parse(calls[0].arguments[0]);
    assert.equal(log.event, 'oauth_refresh_rejected');
    assert.equal(log.reason, reason);
    assert.equal(log.timestamp, new Date(now).toISOString());
    assert.ok(Object.keys(log).every(key => ['event', 'reason', 'timestamp', 'authorization_ref', 'revoked_access_tokens'].includes(key)));
    if (log.authorization_ref) assert.ok([...authorizationRefs.values()].includes(log.authorization_ref));
    if (reason === 'reused') assert.ok(Number.isSafeInteger(log.revoked_access_tokens) && log.revoked_access_tokens >= 0);
    return log;
  }
  async function deniedUnchanged(tokens, changes, expectedError = 'invalid_grant', reason) {
    const before = await stored(tokens);
    const usedBefore = await prisma.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: hashSecret(tokens.refresh_token) } });
    const start = warnings.mock.calls.length;
    const response = await refresh(tokens, changes);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: expectedError });
    assert.deepEqual(await stored(tokens), before);
    assert.deepEqual(await prisma.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: hashSecret(tokens.refresh_token) } }), usedBefore);
    if (reason) {
      const log = assertDiagnostic(start, reason);
      if (['expired', 'invalid_scope'].includes(reason)) {
        assert.equal(log.authorization_ref, authorizationRefs.get((before || usedBefore).operationOwnerId));
      } else if (['client_mismatch', 'resource_mismatch', 'malformed', 'missing'].includes(reason)) {
        assert.ok(!Object.hasOwn(log, 'authorization_ref'), 'Unbound or unknown requests must not identify an authorization');
      }
    }
  }

  await t.test('initial grant has 60 minutes of access and 90 days of refresh inactivity', async () => {
    const tokens = await issue();
    const grant = await stored(tokens);
    assert.equal(grant.refreshExpiresAt.getTime() - now, IDLE);
    advance(HOUR - 1);
    assert.ok(await resolveBearer(tokens.access_token));
    assert.equal((await stored(tokens)).refreshExpiresAt.getTime(), grant.refreshExpiresAt.getTime(),
      'Ordinary access validation must not silently change the refresh deadline');
    advance(1);
    assert.equal(await resolveBearer(tokens.access_token), null);
  });

  await t.test('committed diagnostics correlate one authorization without exposing credentials or raw identities', async () => {
    const original = await issue();
    const originalGrant = await stored(original);
    const independent = await issue();
    const successor = await renew(original);
    const expectedRef = authorizationRefs.get(originalGrant.operationOwnerId);
    for (const expectedRevoked of [2, 0]) {
      const start = warnings.mock.calls.length;
      assert.equal((await refresh(original)).status, 400);
      const log = assertDiagnostic(start, 'reused');
      assert.equal(log.authorization_ref, expectedRef);
      assert.equal(log.revoked_access_tokens, expectedRevoked);
    }
    assert.ok(await stored(independent));
    const logs = JSON.stringify([
      ...warnings.mock.calls.map(call => call.arguments), ...issuances.mock.calls.map(call => call.arguments),
    ]);
    for (const value of [original.access_token, original.refresh_token, successor.access_token, successor.refresh_token]) {
      assert.ok(!logs.includes(value));
      assert.ok(!logs.includes(hashSecret(value).slice(0, 32)), 'Diagnostic references must not be token fingerprints');
    }
    for (const value of [originalGrant.operationOwnerId, originalGrant.userId, originalGrant.clientId, originalGrant.metaTokenId, ...originalGrant.selectedAccountIds]) {
      assert.ok(!logs.includes(value), 'Raw grant, user, client, Meta and account identities stay out of diagnostics');
    }
  });

  await t.test('regular refresh works beyond 30 days and beyond one year without a new authorization', async () => {
    const startedAt = now;
    let tokens = await issue();
    const initial = await stored(tokens);
    for (const days of [45, 89, 89, 89, 89]) {
      advance(days * DAY);
      assert.equal(await resolveBearer(tokens.access_token), null);
      tokens = await renew(tokens);
      const current = await stored(tokens);
      assert.equal(current.operationOwnerId, initial.operationOwnerId);
      assert.equal(current.scope, initial.scope);
      assert.ok(current.refreshExpiresAt.getTime() > initial.refreshExpiresAt.getTime());
    }
    assert.ok(now - startedAt > 365 * DAY);
    assert.equal((await resolveBearer(tokens.access_token)).accessToken, 'SYNTHETIC_REFRESH_POLICY_META');
  });

  await t.test('refresh one millisecond before the inactivity deadline succeeds', async () => {
    const tokens = await issue();
    advance(IDLE - 1);
    await renew(tokens);
  });

  for (const excess of [0, DAY]) {
    await t.test(`refresh at 90 days${excess ? ' plus one day' : ' exactly'} of inactivity is rejected`, async () => {
      const tokens = await issue();
      advance(IDLE + excess);
      await deniedUnchanged(tokens, {}, 'invalid_grant', 'expired');
    });
  }

  await t.test('wrong client, resource or scope do not extend or consume a still-valid refresh', async () => {
    let tokens = await issue({ scope: 'ads_read' });
    advance(40 * DAY);
    await deniedUnchanged(tokens, { client_id: otherClient }, 'invalid_grant', 'client_mismatch');
    await deniedUnchanged(tokens, { resource: 'https://different.example/mcp' }, 'invalid_target');
    await deniedUnchanged(tokens, { scope: 'ads_read ads_management' }, 'invalid_scope', 'invalid_scope');
    await deniedUnchanged(tokens, { scope: 'unknown_scope' }, 'invalid_scope', 'invalid_scope');
    tokens = await renew(tokens);
    assert.equal((await stored(tokens)).scope, 'ads_read');
  });

  await t.test('scope may narrow while accounts, resource, Meta token and family remain fixed', async () => {
    let tokens = await issue();
    advance(DAY);
    tokens = await renew(tokens, { scope: 'ads_read' });
    assert.equal((await stored(tokens)).scope, 'ads_read');
    await deniedUnchanged(tokens, { scope: 'ads_read ads_management' }, 'invalid_scope', 'invalid_scope');
  });

  await t.test('invalid scope is reported only for a current, unexpired grant bound to this client and resource', async () => {
    const tokens = await issue({ scope: 'ads_read' });
    const wideScope = { scope: 'ads_read ads_management', diagnostic_canary: `private-request-${randomUUID()}` };
    await deniedUnchanged(tokens, { ...wideScope, client_id: otherClient }, 'invalid_grant', 'client_mismatch');
    await prisma.oAuthAccessToken.update({ where: { token: hashSecret(tokens.access_token) }, data: { resource: 'https://previous-resource.example/mcp' } });
    await deniedUnchanged(tokens, wideScope, 'invalid_grant', 'resource_mismatch');
    await prisma.oAuthAccessToken.update({ where: { token: hashSecret(tokens.access_token) }, data: { resource } });
    advance(IDLE);
    await deniedUnchanged(tokens, wideScope, 'invalid_grant', 'expired');
    await deniedUnchanged(tokens, { ...wideScope, refresh_token: `unknown-refresh-${randomUUID()}` }, 'invalid_grant', 'missing');
    await deniedUnchanged(tokens, { ...wideScope, refresh_token: '' }, 'invalid_grant', 'malformed');
  });

  await t.test('an explicitly revoked refresh cannot be renewed or recreated', async () => {
    const tokens = await issue();
    const response = await post('/oauth/revoke', { client_id: mainClient, token: tokens.refresh_token });
    assert.equal(response.status, 200);
    advance(DAY);
    await deniedUnchanged(tokens, {}, 'invalid_grant', 'missing');
    assert.equal(await stored(tokens), null);
  });

  for (const generations of [1, 2]) {
    await t.test(`replay after ${generations} rotation(s) revokes only that family`, async () => {
      const original = await issue();
      const sameClient = await issue({ scope: 'ads_read', accounts: ['act_200'] });
      const anotherApp = await issue({ clientId: otherClient, scope: 'ads_read' });
      const initial = await stored(original);
      let successor = original;
      for (let generation = 0; generation < generations; generation++) {
        advance(DAY);
        successor = await renew(successor);
      }
      const start = warnings.mock.calls.length;
      const replay = await refresh(original);
      assert.equal(replay.status, 400);
      assert.deepEqual(await replay.json(), { error: 'invalid_grant' });
      assert.equal(assertDiagnostic(start, 'reused').authorization_ref, authorizationRefs.get(initial.operationOwnerId));
      assert.equal(await stored(successor), null);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: initial.operationOwnerId } }), 0);
      assert.ok(await stored(sameClient));
      assert.ok(await stored(anotherApp));
    });
  }

  await t.test('invalid client, resource or scope on a consumed token do not revoke its successor', async () => {
    const original = await issue({ scope: 'ads_read' });
    advance(DAY);
    const successor = await renew(original);
    const before = await stored(successor);
    for (const [changes, error, reason] of [
      [{ client_id: otherClient }, 'invalid_grant', 'client_mismatch'],
      [{ resource: 'https://different.example/mcp' }, 'invalid_target'],
      [{ scope: 'ads_read ads_management' }, 'invalid_grant', 'reused_scope_mismatch'],
    ]) {
      const start = warnings.mock.calls.length;
      const response = await refresh(original, changes);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error });
      if (reason) {
        const log = assertDiagnostic(start, reason);
        assert.equal(log.authorization_ref, reason === 'reused_scope_mismatch' ? authorizationRefs.get(before.operationOwnerId) : undefined);
      }
      assert.deepEqual(await stored(successor), before);
    }
  });

  await t.test('replay after the consumed-token retention deadline cannot revoke an actively renewed family', async () => {
    const original = await issue();
    advance(45 * DAY);
    let current = await renew(original);
    advance(45 * DAY);
    current = await renew(current);
    advance(45 * DAY + 1);
    const before = await stored(current);
    const response = await refresh(original);
    assert.equal(response.status, 400);
    assert.deepEqual(await stored(current), before);
  });

  await t.test('revocation using a consumed token terminates its family but not another application', async () => {
    const original = await issue();
    const independent = await issue({ clientId: otherClient });
    advance(DAY);
    const successor = await renew(original);
    const wrongClient = await post('/oauth/revoke', { client_id: otherClient, token: original.refresh_token });
    assert.equal(wrongClient.status, 200);
    assert.ok(await stored(successor));
    const revoked = await post('/oauth/revoke', { client_id: mainClient, token: original.refresh_token });
    assert.equal(revoked.status, 200);
    assert.equal(await stored(successor), null);
    assert.ok(await stored(independent));
    assert.equal((await refresh(successor)).status, 400);
  });

  await t.test('revocation using a consumed token at its retention deadline is a no-op', async () => {
    const original = await issue();
    advance(DAY);
    let current = await renew(original);
    advance(45 * DAY);
    current = await renew(current);
    advance(45 * DAY);
    const used = await prisma.oAuthUsedRefreshToken.findUniqueOrThrow({ where: { refreshToken: hashSecret(original.refresh_token) } });
    assert.equal(used.retainUntil.getTime(), now);
    const before = await stored(current);
    const response = await post('/oauth/revoke', { client_id: mainClient, token: original.refresh_token });
    assert.equal(response.status, 200);
    assert.deepEqual(await stored(current), before);
  });

  await t.test('successor insertion failure rolls back both consumption and deletion of the original refresh', async () => {
    const original = await issue();
    const before = await stored(original);
    advance(DAY);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION policy_reject_successor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic successor rejection'; END $$`);
    let installed = false;
    try {
      await prisma.$executeRawUnsafe('CREATE TRIGGER policy_reject_successor BEFORE INSERT ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION policy_reject_successor()');
      installed = true;
      const start = warnings.mock.calls.length;
      const issuedStart = issuances.mock.calls.length;
      const response = await refresh(original);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'server_error' });
      assert.deepEqual(await stored(original), before);
      assert.equal(await prisma.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: hashSecret(original.refresh_token) } }), null);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: before.operationOwnerId } }), 1);
      assert.equal(warnings.mock.calls.length, start, 'A rolled-back transaction must not emit a committed refresh denial');
      assert.equal(issuances.mock.calls.length, issuedStart, 'A rolled-back transaction must not log a token issuance');
    } finally {
      if (installed) await prisma.$executeRawUnsafe('DROP TRIGGER policy_reject_successor ON oauth_access_tokens');
      await prisma.$executeRawUnsafe('DROP FUNCTION policy_reject_successor()');
    }
    await renew(original);
  });

  await t.test('replay diagnostics are emitted only after family revocation commits', async () => {
    const original = await issue();
    const successor = await renew(original);
    const before = await stored(successor);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION policy_reject_replay_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic replay commit rejection'; END $$`);
    let installed = false;
    try {
      await prisma.$executeRawUnsafe('CREATE CONSTRAINT TRIGGER policy_reject_replay_commit AFTER DELETE ON oauth_access_tokens DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION policy_reject_replay_commit()');
      installed = true;
      const start = warnings.mock.calls.length;
      const issuedStart = issuances.mock.calls.length;
      const response = await refresh(original);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'server_error' });
      assert.deepEqual(await stored(successor), before);
      assert.equal(warnings.mock.calls.length, start, 'A replay revocation rolled back at commit must not be logged as committed');
      assert.equal(issuances.mock.calls.length, issuedStart);
    } finally {
      if (installed) await prisma.$executeRawUnsafe('DROP TRIGGER policy_reject_replay_commit ON oauth_access_tokens');
      await prisma.$executeRawUnsafe('DROP FUNCTION policy_reject_replay_commit()');
    }
    const start = warnings.mock.calls.length;
    const response = await refresh(original);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_grant' });
    assert.equal(await stored(successor), null);
    assert.equal(assertDiagnostic(start, 'reused').authorization_ref, authorizationRefs.get(before.operationOwnerId));
  });

  await t.test('refresh racing explicit revocation always ends with the family revoked', async () => {
    const original = await issue();
    const initial = await stored(original);
    const independent = await issue({ clientId: otherClient });
    advance(DAY);
    const [refreshed, revoked] = await Promise.all([
      refresh(original),
      post('/oauth/revoke', { client_id: mainClient, token: original.refresh_token }),
    ]);
    assert.ok([200, 400].includes(refreshed.status));
    assert.equal(revoked.status, 200);
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: initial.operationOwnerId } }), 0);
    assert.ok(await stored(independent));
  });

  await t.test('old-token replay racing current refresh cannot leave a surviving successor', async () => {
    const original = await issue();
    const initial = await stored(original);
    advance(DAY);
    const current = await renew(original);
    const independent = await issue({ accounts: ['act_200'], scope: 'ads_read' });
    advance(DAY);
    const [refreshed, replayed] = await Promise.all([refresh(current), refresh(original)]);
    assert.ok([200, 400].includes(refreshed.status));
    assert.equal(replayed.status, 400);
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: initial.operationOwnerId } }), 0);
    assert.ok(await stored(independent));
  });

  await t.test('concurrent refresh issues once and treats the other use as replay without a grace window', async () => {
    const original = await issue();
    const originalGrant = await stored(original);
    advance(DAY);
    const responses = await Promise.all([refresh(original), refresh(original)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
    const emitted = await responses.find(response => response.status === 200).json();
    assert.equal(emitted.expires_in, 3600);
    assert.equal(await stored(original), null);
    assert.equal(await stored(emitted), null, 'The replay revokes the newly emitted member of the same family');
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: originalGrant.operationOwnerId } }), 0);
  });
});

test('the real refresh migration extends only eligible rows inside a temporary PostgreSQL table', isolated, async () => {
  verifyDatabase();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path = pg_temp');
    await client.query('CREATE TEMP TABLE oauth_access_tokens (token TEXT PRIMARY KEY, refresh_token TEXT, created_at TIMESTAMP NOT NULL, refresh_expires_at TIMESTAMP) ON COMMIT DROP');
    const resolved = await client.query("SELECT to_regclass('oauth_access_tokens')::oid = to_regclass('pg_temp.oauth_access_tokens')::oid AS isolated");
    assert.equal(resolved.rows[0].isolated, true);
    await client.query(`INSERT INTO oauth_access_tokens VALUES
      ('active', 'refresh-active', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '20 days'),
      ('rotated', 'refresh-rotated', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '29 days'),
      ('longer', 'refresh-longer', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '150 days'),
      ('old-but-valid', 'refresh-old', CURRENT_TIMESTAMP - INTERVAL '120 days', CURRENT_TIMESTAMP + INTERVAL '1 day'),
      ('expired', 'refresh-expired', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '1 millisecond'),
      ('boundary', 'refresh-boundary', CURRENT_TIMESTAMP - INTERVAL '90 days', CURRENT_TIMESTAMP),
      ('null-deadline', 'refresh-null', CURRENT_TIMESTAMP, NULL),
      ('revoked', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')`);
    const snapshot = async () => (await client.query('SELECT token, refresh_token, created_at, refresh_expires_at FROM oauth_access_tokens ORDER BY token')).rows;
    const before = await snapshot();
    const migration = await readFile(new URL('../../prisma/migrations/20260915000000_oauth_refresh_inactivity/migration.sql', import.meta.url), 'utf8');
    const statement = migration.replace(/--[^\n]*(?:\n|$)/g, '').trim();
    assert.match(statement, /^UPDATE\s+"?oauth_access_tokens"?\s+SET\b/i, 'Migration must target the unqualified table resolved through pg_temp');
    assert.equal((statement.match(/;/g) ?? []).length, 1, 'Only the scoped UPDATE may run against this fixture');
    await client.query(migration);
    const after = await snapshot();
    const previous = new Map(before.map(row => [row.token, row]));
    for (const row of after) {
      const old = previous.get(row.token);
      if (['active', 'rotated'].includes(row.token)) {
        assert.equal(row.refresh_expires_at.getTime(), row.created_at.getTime() + IDLE);
        assert.ok(row.refresh_expires_at > old.refresh_expires_at);
      } else assert.deepEqual(row, old, `${row.token} must remain unchanged`);
    }
    await client.query(migration);
    assert.deepEqual(await snapshot(), after, 'Migration is idempotent');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
