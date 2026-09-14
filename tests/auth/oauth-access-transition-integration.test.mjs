import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL_TEST;
const isolated = { skip: !databaseUrl && 'Set DATABASE_URL_TEST to an isolated PostgreSQL database' };
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

test('OAuth access remains usable during proactive refresh without extending its authority', isolated, async t => {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname),
    'Access transition integration tests require a local database named test');
  const originalFetch = globalThis.fetch;
  const databaseName = `faceads_transition_test_${randomUUID().replaceAll('-', '')}`;
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
  // Date is virtual, so expiry cleanup must not share a database with any
  // concurrently running suite that observes the real wall clock.
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
  process.env.MCP_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.META_ACCESS_TOKEN = 'synthetic-access-transition-environment';
  const { oauthRouter } = await import('../../dist/routes/oauth.js');
  const { resolveBearer } = await import('../../dist/transports/http-server.js');
  const databaseModule = await import('../../dist/db/prisma.js');
  disconnectPrisma = databaseModule.disconnectPrisma;
  const prisma = databaseModule.getPrisma();
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const { encryptToken } = await import('../../dist/db/crypto.js');
  globalThis.fetch = async () => { throw new Error('Access transition tests must not call the Meta API'); };
  const warnings = t.mock.method(console, 'warn', () => {});
  const issuances = t.mock.method(console, 'info', () => {});
  const app = express();
  app.use(express.json());
  app.use('/oauth', oauthRouter);
  server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.MCP_BASE_URL = base;
  const resource = base + '/mcp';
  const redirect = 'https://synthetic-access-transition.example/callback';
  const verifier = 'v'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const suffix = randomUUID();
  let now = Date.UTC(2020, 0, 1);
  t.mock.timers.enable({ apis: ['Date'], now });
  clockEnabled = true;
  const advance = milliseconds => { now += milliseconds; t.mock.timers.setTime(now); };
  const user = await prisma.user.create({ data: { email: `access-transition-${suffix}@example.test` } });
  const meta = await prisma.metaToken.create({ data: {
    userId: user.id, accessToken: encryptToken('SYNTHETIC_ACCESS_TRANSITION_META'),
    scopes: 'ads_read ads_management', metaUserId: '900002',
  } });
  async function createClient(name) {
    return (await prisma.oAuthClient.create({ data: {
      clientName: `${name} ${suffix}`, redirectUris: [redirect], grantTypes: ['authorization_code', 'refresh_token'],
    } })).id;
  }
  const mainClient = await createClient('Access transition');
  const otherClient = await createClient('Independent app');
  function post(path, body) {
    return originalFetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body), redirect: 'manual',
    });
  }
  function stored(tokens) {
    return prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
  }
  async function issue({ clientId = mainClient, scope = 'ads_read ads_management', accounts = ['act_100'] } = {}) {
    const code = `synthetic-access-code-${randomUUID()}`;
    await prisma.authorizationCode.create({ data: {
      code: hashSecret(code), clientId, userId: user.id, redirectUri: redirect, scope,
      codeChallenge: challenge, codeChallengeMethod: 'S256', resource, selectedAccountIds: accounts,
      metaTokenId: meta.id, expiresAt: new Date(now + 5 * MINUTE),
    } });
    const response = await post('/oauth/token', {
      grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect,
      code_verifier: verifier, code, resource,
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  function refresh(tokens, changes = {}) {
    return post('/oauth/token', {
      grant_type: 'refresh_token', client_id: mainClient, refresh_token: tokens.refresh_token, resource, ...changes,
    });
  }
  async function renew(tokens, changes = {}) {
    const response = await refresh(tokens, changes);
    assert.equal(response.status, 200);
    const successor = await response.json();
    assert.notEqual(successor.access_token, tokens.access_token);
    assert.notEqual(successor.refresh_token, tokens.refresh_token);
    assert.equal(successor.expires_in, HOUR / 1000);
    assert.equal((await stored(successor)).expiresAt.getTime(), now + HOUR);
    return successor;
  }
  async function assertIndependent(tokens) {
    assert.ok(await resolveBearer(tokens.access_token), 'An independent authorization must remain usable');
    assert.equal((await refresh(tokens)).status, 200, 'An independent authorization must still renew');
  }

  await t.test('a client refreshing five minutes early does not invalidate a parallel reader until the original expiry', async () => {
    const original = await issue();
    const initialGrant = await stored(original);
    const initialContext = await resolveBearer(original.access_token);
    advance(55 * MINUTE);
    const successor = await renew(original);
    const previous = await stored(original);
    assert.ok(previous, 'Proactive refresh must retain a not-yet-expired access token');
    assert.equal(previous.expiresAt.getTime(), initialGrant.expiresAt.getTime());
    assert.equal(previous.refreshToken, null, 'The retained access token must not retain refresh authority');
    assert.equal(previous.refreshExpiresAt, null);
    assert.deepEqual(await resolveBearer(original.access_token), initialContext,
      'A parallel reader with the original bearer must keep the same authority and session binding');
    const renewedContext = await resolveBearer(successor.access_token);
    assert.equal(renewedContext.connectionBinding, initialContext.connectionBinding);
    assert.equal(renewedContext.sessionBinding, initialContext.sessionBinding);
    advance(5 * MINUTE - 1);
    assert.ok(await resolveBearer(original.access_token));
    advance(1);
    assert.equal(await resolveBearer(original.access_token), null, 'Overlap must not extend the original access expiry');
    assert.ok(await resolveBearer(successor.access_token));
  });

  await t.test('refresh one millisecond before access expiry preserves only that remaining millisecond', async () => {
    const original = await issue({ scope: 'ads_read' });
    advance(HOUR - 1);
    const successor = await renew(original);
    assert.equal((await resolveBearer(original.access_token))?.permissions, 'read',
      'The original read-only bearer is valid until its advertised expiry');
    advance(1);
    assert.equal(await resolveBearer(original.access_token), null);
    assert.equal((await resolveBearer(successor.access_token)).permissions, 'read');
  });

  await t.test('multiple early rotations preserve each advertised access expiry and only one live refresh', async () => {
    const first = await issue();
    const family = (await stored(first)).operationOwnerId;
    advance(20 * MINUTE);
    const second = await renew(first);
    advance(20 * MINUTE);
    const third = await renew(second);
    for (const tokens of [first, second, third]) {
      assert.ok(await resolveBearer(tokens.access_token), 'Every unexpired bearer must survive a same-scope rotation');
    }
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: family, refreshToken: { not: null } } }), 1);
    advance(20 * MINUTE);
    assert.equal(await resolveBearer(first.access_token), null);
    assert.ok(await resolveBearer(second.access_token));
    assert.ok(await resolveBearer(third.access_token));
    advance(20 * MINUTE);
    assert.equal(await resolveBearer(second.access_token), null);
    assert.ok(await resolveBearer(third.access_token));
  });

  await t.test('reordering or repeating identical scopes does not invalidate an unexpired bearer', async () => {
    const original = await issue();
    const initialContext = await resolveBearer(original.access_token);
    advance(MINUTE);
    const successor = await renew(original, { scope: 'ads_management ads_read ads_management' });
    assert.deepEqual(await resolveBearer(original.access_token), initialContext,
      'Scope order and duplicates do not narrow the consented authority');
    const context = await resolveBearer(successor.access_token);
    assert.equal(context.permissions, initialContext.permissions);
    assert.equal(context.sessionBinding, initialContext.sessionBinding);
  });

  await t.test('replaying an old refresh revokes every overlapping access token in its family only', async () => {
    const original = await issue();
    const family = (await stored(original)).operationOwnerId;
    const independent = await issue({ scope: 'ads_read', accounts: ['act_200'] });
    const anotherApp = await issue({ clientId: otherClient, scope: 'ads_read' });
    advance(MINUTE);
    const second = await renew(original);
    advance(MINUTE);
    const third = await renew(second);
    const response = await refresh(original);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_grant' });
    for (const tokens of [original, second, third]) assert.equal(await resolveBearer(tokens.access_token), null);
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: family } }), 0);
    await assertIndependent(independent);
    assert.ok(await resolveBearer(anotherApp.access_token));
    assert.equal((await refresh(anotherApp, { client_id: otherClient })).status, 200);
  });

  await t.test('revocation by an older unexpired access token revokes the current refresh and all family members', async () => {
    const original = await issue();
    const family = (await stored(original)).operationOwnerId;
    const independent = await issue({ scope: 'ads_read', accounts: ['act_200'] });
    advance(MINUTE);
    const second = await renew(original);
    advance(MINUTE);
    const current = await renew(second);
    const foreign = await post('/oauth/revoke', { client_id: otherClient, token: original.access_token });
    assert.equal(foreign.status, 200);
    assert.ok(await resolveBearer(current.access_token), 'A different OAuth client cannot revoke this family');
    const response = await post('/oauth/revoke', { client_id: mainClient, token: original.access_token });
    assert.equal(response.status, 200);
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: family } }), 0,
      'An original bearer must still identify its family throughout its advertised lifetime');
    for (const tokens of [original, second, current]) assert.equal(await resolveBearer(tokens.access_token), null);
    assert.equal((await refresh(current)).status, 400);
    await assertIndependent(independent);
  });

  await t.test('scope narrowing removes every older access token with wider authority, preserving independent consent', async () => {
    const original = await issue();
    const family = (await stored(original)).operationOwnerId;
    const originalContext = await resolveBearer(original.access_token);
    const independent = await issue({ accounts: ['act_200'] });
    advance(MINUTE);
    const second = await renew(original);
    advance(MINUTE);
    const current = await renew(second, { scope: 'ads_read' });
    for (const tokens of [original, second]) {
      assert.equal(await stored(tokens), null, 'Downscoping must remove all earlier family members with wider scopes');
      assert.equal(await resolveBearer(tokens.access_token), null);
    }
    const context = await resolveBearer(current.access_token);
    assert.equal(context.permissions, 'read');
    assert.deepEqual(context.allowedAccountIds, originalContext.allowedAccountIds);
    assert.equal(context.connectionBinding, originalContext.connectionBinding);
    assert.notEqual(context.sessionBinding, originalContext.sessionBinding,
      'The narrowed scope must require a new MCP session binding');
    assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: family } }), 1);
    assert.equal((await resolveBearer(independent.access_token)).permissions, 'readwrite');
    const denied = await refresh(current, { scope: 'ads_read ads_management' });
    assert.equal(denied.status, 400);
    assert.deepEqual(await denied.json(), { error: 'invalid_scope' });
    assert.equal((await resolveBearer(current.access_token)).permissions, 'read');
  });

  await t.test('refresh after access expiry never restores the expired bearer', async () => {
    const original = await issue();
    advance(HOUR);
    assert.equal(await resolveBearer(original.access_token), null);
    const successor = await renew(original);
    assert.equal(await resolveBearer(original.access_token), null);
    assert.equal(await stored(original), null, 'Expired access tokens need no overlap row');
    assert.ok(await resolveBearer(successor.access_token));
  });

  await t.test('failed successor insertion restores the original access and refresh without logging committed outcomes', async () => {
    const original = await issue();
    const before = await stored(original);
    const context = await resolveBearer(original.access_token);
    advance(55 * MINUTE);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION transition_reject_successor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic transition successor rejection'; END $$`);
    let installed = false;
    try {
      await prisma.$executeRawUnsafe('CREATE TRIGGER transition_reject_successor BEFORE INSERT ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION transition_reject_successor()');
      installed = true;
      const warningsBefore = warnings.mock.calls.length;
      const issuancesBefore = issuances.mock.calls.length;
      const response = await refresh(original);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'server_error' });
      assert.deepEqual(await stored(original), before, 'A failed refresh must restore the original refresh authority and expiry');
      assert.deepEqual(await resolveBearer(original.access_token), context, 'The original access must remain usable after rollback');
      assert.equal(await prisma.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: hashSecret(original.refresh_token) } }), null);
      assert.equal(await prisma.oAuthAccessToken.count({ where: { operationOwnerId: before.operationOwnerId } }), 1);
      assert.equal(warnings.mock.calls.length, warningsBefore, 'A rolled-back refresh must not log a committed rejection');
      assert.equal(issuances.mock.calls.length, issuancesBefore, 'A rolled-back refresh must not log a successful issuance');
    } finally {
      if (installed) await prisma.$executeRawUnsafe('DROP TRIGGER transition_reject_successor ON oauth_access_tokens');
      await prisma.$executeRawUnsafe('DROP FUNCTION transition_reject_successor()');
    }
    const successor = await renew(original);
    assert.ok(await resolveBearer(original.access_token), 'Retry after rollback must preserve the unexpired original access');
    assert.ok(await resolveBearer(successor.access_token));
  });

  await t.test('overlap cleanup removes at most 100 expired access-only rows in its family and preserves other grants', async () => {
    const expiredButRenewable = await issue({ clientId: otherClient });
    await prisma.oAuthAccessToken.update({ where: { token: hashSecret(expiredButRenewable.access_token) }, data: { expiresAt: new Date(now - 1) } });
    const expiredSnapshot = await stored(expiredButRenewable);
    const validOverlap = await issue({ clientId: otherClient });
    const validSuccessor = await renew(validOverlap, { client_id: otherClient });
    const validSnapshot = await stored(validOverlap);
    assert.equal(validSnapshot.refreshToken, null, 'The protected control row has access authority only');
    const original = await issue();
    const template = await stored(original);
    const cleanupFamily = template.operationOwnerId;
    const expiredAt = new Date(Date.UTC(2010, 0, 1));
    await prisma.oAuthAccessToken.createMany({ data: Array.from({ length: 105 }, (_, index) => ({
      token: hashSecret(`synthetic-expired-overlap-${cleanupFamily}-${index}`),
      clientId: template.clientId, userId: template.userId, resource: template.resource,
      metaTokenId: template.metaTokenId, selectedAccountIds: template.selectedAccountIds,
      scope: template.scope, operationOwnerId: cleanupFamily,
      createdAt: new Date(expiredAt.getTime() - HOUR), expiresAt: expiredAt,
      refreshToken: null, refreshExpiresAt: null,
    })) });
    const foreignToken = hashSecret(`synthetic-foreign-expired-overlap-${randomUUID()}`);
    const foreignSnapshot = await prisma.oAuthAccessToken.create({ data: {
      token: foreignToken, clientId: otherClient, userId: template.userId, resource: template.resource,
      metaTokenId: template.metaTokenId, selectedAccountIds: template.selectedAccountIds,
      scope: template.scope, operationOwnerId: randomUUID(),
      createdAt: new Date(now - HOUR), expiresAt: new Date(now - 1),
      refreshToken: null, refreshExpiresAt: null,
    } });
    const expiredOverlaps = { operationOwnerId: cleanupFamily, refreshToken: null, expiresAt: { lte: new Date(now) } };
    const current = await renew(original);
    assert.equal(await prisma.oAuthAccessToken.count({ where: expiredOverlaps }), 5,
      'One refresh must clean exactly one bounded batch of the oldest 100 eligible rows');
    assert.deepEqual(await stored(expiredButRenewable), expiredSnapshot,
      'An expired access token carrying a valid refresh must survive overlap cleanup');
    assert.deepEqual(await stored(validOverlap), validSnapshot,
      'Access-only tokens remain usable until their original expiry');
    assert.ok(await resolveBearer(validOverlap.access_token));
    assert.ok(await resolveBearer(validSuccessor.access_token));
    assert.ok(await resolveBearer(current.access_token));
    await renew(current);
    assert.equal(await prisma.oAuthAccessToken.count({ where: expiredOverlaps }), 0,
      'A later refresh may clean the remaining expired overlap rows');
    assert.deepEqual(await prisma.oAuthAccessToken.findUnique({ where: { token: foreignToken } }), foreignSnapshot,
      'Refreshing this family must not clean expired overlap rows from another authorization');
    assert.equal((await refresh(expiredButRenewable, { client_id: otherClient })).status, 200,
      'Cleanup must preserve the ability to refresh after access expiry');
  });
});
