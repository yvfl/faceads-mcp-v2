import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL_TEST;
test('PostgreSQL write journal persists receipts, isolates owners and serializes uncertain writes', { skip: !databaseUrl && 'Requires isolated PostgreSQL via DATABASE_URL_TEST' }, async t => {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname), 'Only an isolated local test database may be used');
  process.env.DATABASE_URL = databaseUrl;
  process.env.META_ACCESS_TOKEN = 'synthetic-journal-test-env-token';
  const { withAuthContext } = await import('../../dist/utils/auth-context.js');
  const { getPrisma, disconnectPrisma } = await import('../../dist/db/prisma.js');
  const { withOperationContext, trackMutation, getOperationStatus } = await import('../../dist/operations/journal.js');
  const { PostgresOperationStore } = await import('../../dist/operations/store.js');
  const { MetaClientError } = await import('../../dist/meta-client.js');
  const prisma = getPrisma();
  const suffix = randomUUID();
  const owner = { accessToken: `synthetic-only-${suffix}`, grantId: `test-grant-${suffix}`, operationOwnerId: `connection-${suffix}`, userId: `test-owner-${suffix}`, permissions: 'readwrite' };
  const requestIds = [];
  const run = (label, execute, options = {}) => {
    const requestId = `${suffix}:${label}`;
    requestIds.push(requestId);
    return withAuthContext(options.owner ?? owner, () => withOperationContext({ tool: options.tool ?? 'create_campaign', requestId, ...(options.store ? { store: options.store } : {}) }, execute));
  };
  const mutation = { method: 'POST', endpoint: 'act_100001/campaigns', params: { name: 'Private campaign name', status: 'PAUSED' } };
  t.after(async () => { await prisma.adsOperation.deleteMany({ where: { requestId: { in: requestIds } } }); await disconnectPrisma(); });

  await t.test('real PostgreSQL persists before dispatch and replays with a new store instance', async () => {
    let writes = 0;
    await run('success', () => trackMutation(mutation, async () => {
      writes++;
      const pending = await prisma.adsOperation.findMany({ where: { requestId: `${suffix}:success` } });
      assert.equal(pending.length, 1);
      assert.equal(pending[0].status, 'pending');
      return { id: '12345', access_token: 'private-response-token' };
    }));
    const replay = await run('success', () => trackMutation(mutation, async () => { writes++; return { id: '23456' }; }), { store: new PostgresOperationStore() });
    assert.equal(writes, 1);
    assert.deepEqual(replay.result, { id: '12345' });
    assert.equal(replay.operations[0].replayed, true);
    const rows = await prisma.adsOperation.findMany({ where: { requestId: `${suffix}:success` } });
    assert.doesNotMatch(JSON.stringify(rows), /Private campaign name|private-response-token|synthetic-only/);
    assert.equal(rows[0].record.userId, owner.userId);
    assert.equal(rows[0].record.grantId, owner.grantId);
  });

  await t.test('advisory locks prevent concurrent duplicate dispatch under different request IDs', async () => {
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    let announce;
    const started = new Promise(resolve => { announce = resolve; });
    let writes = 0;
    const input = { ...mutation, params: { ...mutation.params, name: 'Concurrent' } };
    const first = run('parallel-1', () => trackMutation(input, async () => { writes++; announce(); await hold; return { id: '12345' }; }));
    await started;
    try {
      await assert.rejects(run('parallel-2', () => trackMutation(input, async () => { writes++; return { id: '23456' }; }), { store: new PostgresOperationStore() }), /Escrita bloqueada/);
    } finally { release(); }
    await first;
    assert.equal(writes, 1);
  });

  await t.test('unknown result survives a new request and owner cannot read another grant receipt', async () => {
    const input = { ...mutation, params: { ...mutation.params, name: 'Uncertain' } };
    await assert.rejects(run('unknown', () => trackMutation(input, async () => { throw new MetaClientError({ type: 'TimeoutError', code: -1, message: 'synthetic timeout' }); })), /incerto/);
    await assert.rejects(run('unknown-retry', () => trackMutation(input, async () => assert.fail('must not dispatch'))), /Escrita bloqueada/);
    const result = await run('status', () => getOperationStatus(`${suffix}:unknown`));
    assert.equal(result.result.operations[0].status, 'unknown');
    const other = await run('status-other', () => getOperationStatus(`${suffix}:unknown`), { owner: { ...owner, grantId: `other-${suffix}`, operationOwnerId: `other-connection-${suffix}` } });
    assert.deepEqual(other.result.operations, []);
    const refreshedOwner = { ...owner, grantId: `refreshed-grant-${suffix}` };
    const refreshedStatus = await run('refreshed-status', () => getOperationStatus(`${suffix}:unknown`), { owner: refreshedOwner });
    assert.equal(refreshedStatus.result.operations[0].status, 'unknown');
    await assert.rejects(run('refreshed-retry', () => trackMutation(input, async () => assert.fail('refresh must not bypass uncertainty')), { owner: refreshedOwner }), /Escrita bloqueada/);
  });

  await t.test('reuse of one request ID with different payload is serialized and rejected', async () => {
    const input = { ...mutation, params: { ...mutation.params, name: 'Request conflict' } };
    const results = await Promise.allSettled([
      run('collision', () => trackMutation(input, async () => ({ id: '12345' }))),
      run('collision', () => trackMutation({ ...input, params: { ...input.params, name: 'Other payload' } }, async () => ({ id: '23456' }))),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(results.find(result => result.status === 'rejected').reason.message, /request_id já usado/);
    assert.equal(await prisma.adsOperation.count({ where: { requestId: `${suffix}:collision` } }), 1);
  });
});
