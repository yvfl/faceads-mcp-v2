import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { withAuthContext, MetaClientError, fakeFetch, callTool, jsonResponse, textOf, assertSuccess, ACCOUNT } from '../helpers/offline.mjs';
import { FileOperationStore } from '../../dist/operations/store.js';
import { withOperationContext, trackMutation, getOperationStatus, inspectOperation, sanitizeChangedFields, sanitizeWriteResponse } from '../../dist/operations/journal.js';

const OWNER = { accessToken: 'synthetic-write-journal-token', userId: 'synthetic-owner' };
const mutation = { method: 'POST', endpoint: 'act_100001/campaigns', params: { name: 'Private client campaign', status: 'PAUSED' } };
async function fixture(t) {
  const root = resolve('.audit-results/operation-tests');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'journal-'));
  const store = new FileOperationStore(directory);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = (requestId, execute, options = {}) => withAuthContext(options.owner ?? OWNER,
    () => withOperationContext({ tool: options.tool ?? 'create_campaign', requestId, store: options.store ?? store }, execute));
  return { directory, store, run };
}
const fail = type => new MetaClientError({ message: 'Private original Graph diagnostic', type, code: type === 'HttpError' ? 503 : -1 });

test('journal is durable across store instances and replays an explicit successful request once', async t => {
  const { directory, run } = await fixture(t);
  let writes = 0;
  const first = await run('create-1', () => trackMutation(mutation, async () => { writes++; return { id: '12345', access_token: 'secret-response-token', private_data: 'Jane Client' }; }));
  assert.equal(first.result.id, '12345');
  assert.equal(first.operations[0].status, 'succeeded');
  const second = await run('create-1', () => trackMutation(mutation, async () => { writes++; return { id: '99999' }; }), { store: new FileOperationStore(directory) });
  assert.deepEqual(second.result, { id: '12345' });
  assert.equal(second.operations[0].replayed, true);
  assert.equal(writes, 1);
  const status = await run('status', () => getOperationStatus('create-1'), { store: new FileOperationStore(directory) });
  assert.equal(status.result.operations[0].entity_id, '12345');
  const ownerDirectory = join(directory, (await readdir(directory))[0]);
  const records = (await readdir(ownerDirectory)).filter(name => name.endsWith('.json'));
  const content = (await Promise.all(records.map(name => readFile(join(ownerDirectory, name), 'utf8')))).join('\n');
  assert.doesNotMatch(content, /synthetic-write-journal-token|secret-response-token|Jane Client|Private client campaign/);
  assert.equal((await stat(ownerDirectory)).mode & 0o777, 0o700);
  for (const name of records) assert.equal((await stat(join(ownerDirectory, name))).mode & 0o777, 0o600);
});

test('successful identical creations may intentionally use a fresh request ID', async t => {
  const { run } = await fixture(t);
  let writes = 0;
  const execute = () => trackMutation(mutation, async () => ({ id: String(++writes) }));
  await run('intentional-1', execute);
  await run('intentional-2', execute);
  assert.equal(writes, 2);
});

test('reusing a request ID with another payload or tool never dispatches', async t => {
  const { run } = await fixture(t);
  await run('conflict', () => trackMutation(mutation, async () => ({ id: '12345' })));
  let writes = 0;
  await assert.rejects(run('conflict', () => trackMutation({ ...mutation, params: { ...mutation.params, name: 'Different' } }, async () => { writes++; })), /request_id já usado/);
  await assert.rejects(run('conflict', () => trackMutation(mutation, async () => { writes++; }), { tool: 'execute_api' }), /request_id já usado/);
  assert.equal(writes, 0);
});

for (const type of ['TimeoutError', 'NetworkError', 'ParseError', 'HttpError']) {
  test(`${type} persists unknown and blocks same creation with same, new or omitted request_id`, async t => {
    const { directory, run } = await fixture(t);
    let writes = 0;
    await assert.rejects(run('uncertain-1', () => trackMutation(mutation, async () => { writes++; throw fail(type); })), /resultado.*incerto|Resultado.*incerto/s);
    for (const request of ['uncertain-1', 'uncertain-2', undefined]) {
      await assert.rejects(run(request, () => trackMutation(mutation, async () => { writes++; return { id: '12345' }; }), { store: new FileOperationStore(directory) }), /Escrita bloqueada/);
    }
    const status = await run('status', () => getOperationStatus('uncertain-1'));
    assert.equal(status.result.operations[0].status, 'unknown');
    assert.equal(status.result.operations[0].error.type, type);
    assert.equal(writes, 1);
  });
}

test('the fingerprint guard crosses wrapper/raw tools and canonicalizes JSON and numeric values', async t => {
  const { run } = await fixture(t);
  const input = { ...mutation, params: { status: 'PAUSED', daily_budget: 1000, targeting: { geo_locations: { countries: ['BR'] }, age_min: 21 } } };
  await assert.rejects(run('wrapper', () => trackMutation(input, async () => { throw fail('TimeoutError'); })));
  let writes = 0;
  await assert.rejects(run('raw', () => trackMutation({ ...input, params: { daily_budget: '1000', targeting: '{"age_min":21,"geo_locations":{"countries":["BR"]}}', status: 'PAUSED' } }, async () => { writes++; }), { tool: 'execute_api' }), /Escrita bloqueada/);
  assert.equal(writes, 0);
});

test('concurrent identical requests cannot both dispatch, including across store instances', async t => {
  const { directory, run } = await fixture(t);
  let started;
  const began = new Promise(resolve => { started = resolve; });
  let finish;
  const delayed = new Promise(resolve => { finish = resolve; });
  let writes = 0;
  const first = run('parallel-1', () => trackMutation(mutation, async () => { writes++; started(); await delayed; return { id: '12345' }; }));
  await began;
  await assert.rejects(run('parallel-2', () => trackMutation(mutation, async () => { writes++; return { id: '23456' }; }), { store: new FileOperationStore(directory) }), /Escrita bloqueada/);
  finish();
  await first;
  assert.equal(writes, 1);
});

test('definitive Graph rejection is durable and does not block a corrected new request', async t => {
  const { run } = await fixture(t);
  const error = new MetaClientError({ message: 'Invalid budget', type: 'OAuthException', code: 100 });
  await assert.rejects(run('rejected', () => trackMutation(mutation, async () => { throw error; })), /Invalid budget/);
  const state = await run('read', () => getOperationStatus('rejected'));
  assert.equal(state.result.operations[0].status, 'failed');
  assert.deepEqual(state.result.operations[0].error, { type: 'GraphError', code: 100 });
  await assert.rejects(run('rejected', () => trackMutation(mutation, async () => assert.fail('must not dispatch'))), /já falhou/);
  const next = await run('new-attempt', () => trackMutation(mutation, async () => ({ id: '12345' })));
  assert.equal(next.result.id, '12345');
});

test('identities isolate receipts and idempotency', async t => {
  const { run } = await fixture(t);
  await assert.rejects(run('private-operation', () => trackMutation(mutation, async () => { throw fail('TimeoutError'); })));
  const secondOwner = { accessToken: 'synthetic-another-owner-token', userId: 'another-owner' };
  const state = await run('reader', () => getOperationStatus('private-operation'), { owner: secondOwner });
  assert.deepEqual(state.result.operations, []);
  const independent = await run('private-operation', () => trackMutation(mutation, async () => ({ id: '23456' })), { owner: secondOwner });
  assert.equal(independent.result.id, '23456');
});

test('one tool request records and replays multiple Graph writes with separate ordinals', async t => {
  const { run } = await fixture(t);
  let writes = 0;
  const execute = async () => {
    const campaign = await trackMutation(mutation, async () => { writes++; return { id: '12345' }; });
    const child = await trackMutation({ method: 'POST', endpoint: 'act_100001/adsets', params: { campaign_id: campaign.id, name: 'Child', status: 'PAUSED' } }, async () => { writes++; return { id: '23456' }; });
    return { campaign, child };
  };
  await run('multi', execute);
  const replay = await run('multi', execute);
  assert.equal(writes, 2);
  assert.deepEqual(replay.operations.map(receipt => receipt.operation), [1, 2]);
  assert.ok(replay.operations.every(receipt => receipt.replayed));
  const state = await run('status', () => getOperationStatus('multi'));
  assert.deepEqual(state.result.operations.map(receipt => receipt.entity_id), ['12345', '23456']);
});

test('unavailable persistence fails closed before sending any Graph write', async t => {
  const { run } = await fixture(t);
  let writes = 0;
  const store = { reserve: async () => { throw new Error('database password must not leak'); }, finish: async () => {}, list: async () => [] };
  await assert.rejects(run('unavailable', () => trackMutation(mutation, async () => { writes++; }), { store }), error => {
    assert.match(error.message, /nenhuma escrita foi enviada/);
    assert.doesNotMatch(error.message, /database password/);
    return true;
  });
  assert.equal(writes, 0);
});

test('failure to save the success receipt preserves the pending duplicate blocker and returns known ID', async t => {
  const { run, store } = await fixture(t);
  const failing = { reserve: record => store.reserve(record), list: (...args) => store.list(...args), finish: async () => { throw new Error('disk full'); } };
  let writes = 0;
  await assert.rejects(run('lost-receipt', () => trackMutation(mutation, async () => { writes++; return { id: '12345' }; }), { store: failing }), error => {
    assert.match(error.message, /recibo não pôde ser persistido/);
    assert.equal(error.operation.entity_id, '12345');
    assert.equal(error.operation.status, 'unknown');
    return true;
  });
  await assert.rejects(run('try-again', () => trackMutation(mutation, async () => { writes++; })), /Escrita bloqueada/);
  const state = await run('read', () => getOperationStatus('lost-receipt'));
  assert.equal(state.result.operations[0].status, 'pending');
  assert.equal(writes, 1);
});

test('read reconciliation compares known IDs and intended fields but never clears unknown', async t => {
  const { run } = await fixture(t);
  const update = { method: 'POST', endpoint: '12345', params: { status: 'PAUSED', daily_budget: 1000 } };
  await assert.rejects(run('update', () => trackMutation(update, async () => { throw fail('TimeoutError'); })));
  const calls = [];
  const observed = await run('inspect', () => inspectOperation('update', async (endpoint, params) => { calls.push({ endpoint, params }); return { id: '12345', status: 'PAUSED', daily_budget: '1000' }; }));
  assert.deepEqual(calls, [{ endpoint: '12345', params: { fields: 'id,status,daily_budget' } }]);
  assert.equal(observed.result.operations[0].observation.all_intended_fields_match, true);
  assert.equal(observed.result.operations[0].status, 'unknown');
  await assert.rejects(run('retry', () => trackMutation(update, async () => assert.fail('must not retry'))), /Escrita bloqueada/);
  const mismatch = await run('inspect', () => inspectOperation('update', async () => ({ id: '99999', status: 'PAUSED', daily_budget: '1000' })));
  assert.equal(mismatch.result.operations[0].observation.all_intended_fields_match, false);
});

test('private unrecorded fields and delete access errors cannot prove reconciliation', async t => {
  const { run } = await fixture(t);
  await assert.rejects(run('update-private', () => trackMutation({ method: 'POST', endpoint: '12345', params: { status: 'PAUSED', name: 'Private Name' } }, async () => { throw fail('NetworkError'); })));
  const observed = await run('inspect', () => inspectOperation('update-private', async () => ({ id: '12345', status: 'PAUSED', name: 'Private Name' })));
  assert.equal(observed.result.operations[0].observation.all_intended_fields_match, false);
  await assert.rejects(run('delete', () => trackMutation({ method: 'DELETE', endpoint: '12345' }, async () => { throw fail('TimeoutError'); })));
  const deleted = await run('inspect', () => inspectOperation('delete', async () => { throw new MetaClientError({ type: 'GraphMethodException', code: 100, message: 'Cannot access object' }); }));
  assert.equal(deleted.result.operations[0].observation.read_failed, true);
  assert.equal(deleted.result.operations[0].status, 'unknown');
});

test('unknown creation without returned ID cannot trigger a guessed read by name', async t => {
  const { run } = await fixture(t);
  await assert.rejects(run('creation', () => trackMutation(mutation, async () => { throw fail('TimeoutError'); })));
  const inspected = await run('inspect', () => inspectOperation('creation', async () => assert.fail('no identity is known')));
  assert.match(inspected.result.operations[0].next_step, /resposta perde o ID/);
  assert.equal(inspected.result.operations[0].observation, undefined);
});

test('write receipts preserve image hashes and IDs while removing URLs, text and credentials', () => {
  assert.deepEqual(sanitizeWriteResponse({ images: { 'private-person.jpg': { hash: 'a'.repeat(32), url: 'https://example.test/private?access_token=secret' } }, id: '12345', success: true, token: 'secret' }), { id: '12345', success: true, images: { image_0: { hash: 'a'.repeat(32) } } });
  assert.deepEqual(sanitizeChangedFields({ status: 'PAUSED', daily_budget: '1000', campaign_id: '12345', name: 'PII', targeting: { addresses: ['PII'] }, access_token: 'secret' }), { status: 'PAUSED', daily_budget: '1000', campaign_id: '12345', name: '[redacted]', targeting: '[redacted]', access_token: '[redacted]' });
});

test('invalid request IDs are rejected before reserving or dispatching', async t => {
  const { run } = await fixture(t);
  for (const id of ['', '../private', 'secret\nvalue', 'a'.repeat(129)]) {
    await assert.rejects(run(id, () => assert.fail('must not execute')), /request_id/);
  }
});

test('false success and missing creation ID cannot become successful receipts', async t => {
  const { run } = await fixture(t);
  await assert.rejects(run('false', () => trackMutation(mutation, async () => ({ success: false }))), /success=false/);
  const failed = await run('status', () => getOperationStatus('false'));
  assert.equal(failed.result.operations[0].status, 'failed');
  await assert.rejects(run('missing-id', () => trackMutation(mutation, async () => ({}))), /incerto/);
  const unknown = await run('status', () => getOperationStatus('missing-id'));
  assert.equal(unknown.result.operations[0].status, 'unknown');
  await assert.rejects(run('retry', () => trackMutation(mutation, async () => assert.fail('must not dispatch'))), /Escrita bloqueada/);
});

test('Graph validation-only acknowledgement does not require a creation ID', async t => {
  const { run } = await fixture(t);
  const result = await run('validate', () => trackMutation({ ...mutation, params: { ...mutation.params, execution_options: ['validate_only'] } }, async () => ({ success: true })));
  assert.equal(result.operations[0].status, 'succeeded');
});

test('copy receipts preserve parent and child ID mappings without private fields', async t => {
  const { run } = await fixture(t);
  const response = { copied_campaign_id: '12345', ad_object_ids: [{ source_id: '34567', copied_id: '45678', ad_object_type: 'ad_set', name: 'Private child' }] };
  await run('copy', () => trackMutation({ method: 'POST', endpoint: '200001/copies', params: { status_option: 'PAUSED' } }, async () => response));
  const replay = await run('copy', () => trackMutation({ method: 'POST', endpoint: '200001/copies', params: { status_option: 'PAUSED' } }, async () => assert.fail('must not dispatch')));
  assert.deepEqual(replay.result, { copied_campaign_id: '12345', ad_object_ids: [{ source_id: '34567', copied_id: '45678', ad_object_type: 'ad_set' }] });
  assert.equal(replay.operations[0].entity_id, '12345');
});

test('MCP handler forwards request_id only to journal and replays without a second POST', async t => {
  const calls = fakeFetch(t, () => ({ id: '12345' }));
  const args = { account_id: ACCOUNT, name: 'Journal integration', objective: 'OUTCOME_TRAFFIC', request_id: 'mcp-create' };
  const first = await callTool('create_campaign', args);
  assertSuccess(first);
  assert.equal(first.structuredContent.operations[0].request_id, 'mcp-create');
  const second = await callTool('create_campaign', args);
  assertSuccess(second);
  assert.equal(second.structuredContent.operations[0].replayed, true);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(calls[0].body.has('request_id'), false);
  const status = await callTool('get_operation_status', { request_id: 'mcp-create' }, { permissions: 'read' });
  assertSuccess(status);
  assert.match(textOf(status), /12345/);
});

test('MCP denies an unauthorized account before reserving or writing', async t => {
  const calls = fakeFetch(t);
  const context = { allowedAccountIds: ['act_99999'] };
  const result = await callTool('create_campaign', { account_id: ACCOUNT, name: 'Denied', objective: 'OUTCOME_TRAFFIC', request_id: 'denied-write' }, context);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
  const status = await callTool('get_operation_status', { request_id: 'denied-write' }, context);
  assertSuccess(status);
  assert.deepEqual(JSON.parse(textOf(status)).operations, []);
});

for (const scenario of [
  { name: 'update_campaign', args: { campaign_id: '200001', daily_budget: 1000 } },
  { name: 'update_adset', args: { adset_id: '400001', daily_budget: 1000 } },
  { name: 'update_ad', args: { ad_id: '500001', status: 'PAUSED' } },
]) {
  test(`${scenario.name} never forwards request_id or lets a changed ID bypass unknown`, async t => {
    const calls = fakeFetch(t, () => { throw new Error('synthetic network failure'); });
    const first = await callTool(scenario.name, { ...scenario.args, request_id: 'update-unknown' });
    assert.equal(first.isError, true);
    const second = await callTool(scenario.name, { ...scenario.args, request_id: 'update-again' });
    assert.equal(second.isError, true);
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    assert.equal(calls[0].body.has('request_id'), false);
  });
}

test('typed update without acknowledgement remains unknown instead of claiming success', async t => {
  const calls = fakeFetch(t, () => ({}));
  const result = await callTool('pause_campaign', { campaign_id: '200001', request_id: 'missing-ack' });
  assert.equal(result.isError, true);
  const status = await callTool('get_operation_status', { request_id: 'missing-ack' });
  assert.equal(JSON.parse(textOf(status)).operations[0].status, 'unknown');
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

for (const scenario of [
  { name: 'Graph code 2', status: 400, error: { code: 2, type: 'OAuthException', message: 'Temporary unavailable' } },
  { name: 'Graph HTTP 500 with code 100', status: 500, error: { code: 100, type: 'OAuthException', message: 'Internal failure' } },
  { name: 'Graph is_transient with code 100', status: 400, error: { code: 100, type: 'OAuthException', message: 'Transient failure', is_transient: true } },
]) {
  test(`${scenario.name} reaches journal as unknown through the actual transport`, async t => {
    const calls = fakeFetch(t, () => jsonResponse({ error: scenario.error }, scenario.status));
    const args = { account_id: ACCOUNT, name: 'Unknown response', objective: 'OUTCOME_TRAFFIC', request_id: 'transport-unknown' };
    const result = await callTool('create_campaign', args);
    assert.equal(result.isError, true);
    const status = await callTool('get_operation_status', { request_id: args.request_id });
    assertSuccess(status);
    assert.equal(JSON.parse(textOf(status)).operations[0].status, 'unknown');
    const retry = await callTool('create_campaign', { ...args, request_id: 'transport-retry' });
    assert.equal(retry.isError, true);
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  });
}
