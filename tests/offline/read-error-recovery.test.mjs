import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, TOKEN, callTool, fakeFetch, jsonResponse, textOf } from '../helpers/offline.mjs';

const readGrant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };
const insights = { account_id: ACCOUNT, date_preset: 'last_7d', fields: ['impressions'] };
const graphError = (code, details = {}, status = 400) => jsonResponse({
  error: { code, type: 'OAuthException', message: 'Synthetic Graph error', ...details },
}, status);

function abortRequests(t) {
  const Controller = globalThis.AbortController;
  t.mock.method(globalThis, 'AbortController', function () {
    const controller = new Controller();
    controller.abort();
    return controller;
  });
}

test('invalid fields keep the Graph message and return a documentation read, not connection retries', async t => {
  const calls = fakeFetch(t, () => graphError(100, {
    message: '(#100) Nonexisting field unknown_metric',
    error_user_msg: 'Check fields access_token=synthetic-provider-secret',
  }));
  const result = await callTool('get_account_insights', { ...insights, fields: ['unknown_metric'] }, readGrant);
  assert.equal(result.isError, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('fields'), 'unknown_metric');
  assert.equal(result.structuredContent.error.category, 'invalid_query');
  assert.deepEqual(result.structuredContent.error.next, { tool: 'get_error_code_info', arguments: { error_code: '100' } });
  assert.match(textOf(result), /Nonexisting field unknown_metric/);
  assert.match(textOf(result), /fields.*filtros.*período/);
  assert.match(textOf(result), /reinicie a paginação/);
  assert.doesNotMatch(textOf(result), /diagnóstico novamente|tela de conexão|synthetic-provider-secret/);
});

test('error 100 subcode 33 does not claim the object is absent or recommend fixing fields', async t => {
  fakeFetch(t, () => graphError(100, { error_subcode: 33, message: 'Unsupported get request' }));
  const result = await callTool('get_account_insights', insights, readGrant);
  assert.equal(result.structuredContent.error.category, 'object_unavailable');
  assert.match(result.structuredContent.error.action, /inexistente.*sem acesso/);
  assert.match(result.structuredContent.error.action, /não comprova ausência nem exclusão/);
  assert.doesNotMatch(result.structuredContent.error.action, /corrija.*fields/);
});

for (const code of [4, 17, 32, 613, 80004]) {
  test(`rate limit ${code} tells the caller to wait and makes no diagnostic or retry request`, async t => {
    const calls = fakeFetch(t, () => graphError(code));
    const result = await callTool('get_account_insights', insights, readGrant);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.category, 'rate_limit');
    assert.match(result.structuredContent.error.action, /Aguarde/);
    assert.match(result.structuredContent.error.action, /não repita a consulta nem execute diagnose_connection/);
    assert.equal(result.structuredContent.error.next, undefined);
    assert.equal(calls.length, 1);
  });
}

test('HTTP 429 without a Graph error envelope is still a rate limit', async t => {
  const calls = fakeFetch(t, () => jsonResponse({}, 429));
  const result = await callTool('get_account_insights', insights, readGrant);
  assert.equal(result.structuredContent.error.category, 'rate_limit');
  assert.equal(calls.length, 1);
});

for (const laterPage of [false, true]) {
  test(`HTTP 429 with a text body is a rate limit on ${laterPage ? 'a later' : 'the first'} page`, async t => {
    const calls = fakeFetch(t, call => laterPage && !call.url.searchParams.has('after')
      ? { data: [{ impressions: '10' }], paging: { next: 'opaque', cursors: { after: 'second-page' } } }
      : new Response('Too many requests', { status: 429 }));
    const result = await callTool('get_account_insights', { ...insights, limit: 1 }, readGrant);
    const failure = laterPage ? result.structuredContent.pagination.collections[0].error : result.structuredContent.error;
    assert.equal(failure.category, 'rate_limit');
    assert.match(failure.action, /Aguarde/);
    assert.doesNotMatch(failure.action, /tente novamente a leitura/);
    assert.equal(calls.length, laterPage ? 2 : 1);
  });
}

test('diagnose_connection itself recognizes quota 80004 without sending another diagnostic', async t => {
  const calls = fakeFetch(t, () => graphError(80004));
  const result = await callTool('diagnose_connection', {}, readGrant);
  const report = JSON.parse(textOf(result));
  assert.equal(report.meta_permissions.status, 'unavailable');
  assert.equal(report.meta_permissions.failure.code, 80004);
  assert.match(report.meta_permissions.failure.action, /Aguarde/);
  assert.doesNotMatch(report.meta_permissions.failure.action, /diagnóstico novamente/);
  assert.equal(calls.length, 1);
});

test('first-page timeout keeps the read context and explains how a smaller query changes pagination', async t => {
  abortRequests(t);
  const calls = fakeFetch(t, () => { throw new Error('synthetic aborted fetch'); });
  const result = await callTool('get_account_insights', { ...insights, limit: 500 }, readGrant);
  assert.equal(result.structuredContent.error.category, 'timeout');
  assert.equal(result.structuredContent.error.type, 'TimeoutError');
  assert.match(result.structuredContent.error.action, /get_account_insights/);
  assert.match(result.structuredContent.error.action, /Reduza limit/);
  assert.match(result.structuredContent.error.action, /continue pelo after/);
  assert.match(result.structuredContent.error.action, /reduzir fields ou o período, reinicie/);
  assert.doesNotMatch(result.structuredContent.error.action, /diagnose_connection|execute_api/);
  assert.equal(calls.length, 1);
});

test('a quota on a later page keeps earlier rows and the exact typed continuation with wait guidance', async t => {
  const calls = fakeFetch(t, call => call.url.searchParams.has('after')
    ? graphError(80004)
    : { data: [{ impressions: '10' }], paging: { next: 'opaque', cursors: { after: 'second-page' } } });
  const args = { ...insights, limit: 1, level: 'campaign', filtering: [{ field: 'campaign.id', operator: 'IN', value: ['200001'] }] };
  const result = await callTool('get_account_insights', args, readGrant);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.pagination.complete, false);
  const page = result.structuredContent.pagination.collections[0];
  assert.equal(page.pages, 1);
  assert.equal(page.returned_count, 1);
  assert.equal(page.reason, 'page_error');
  assert.equal(page.error.category, 'rate_limit');
  assert.match(page.error.action, /Aguarde/);
  assert.equal(page.next.tool, 'get_account_insights');
  assert.equal(page.next.arguments.after, 'second-page');
  assert.equal(page.next.arguments.date_preset, args.date_preset);
  assert.deepEqual(page.next.arguments.filtering, args.filtering);
  assert.deepEqual(page.next.arguments.fields, args.fields);
  assert.match(textOf(result), /siga primeiro a orientação error.action/);
  assert.equal(calls.length, 2);
});

test('a later-page timeout has the same recovery category as a first-page timeout', async t => {
  abortRequests(t);
  const calls = fakeFetch(t, call => {
    if (call.url.searchParams.has('after')) throw new Error('synthetic page timeout');
    return { data: [{ impressions: '10' }], paging: { next: 'opaque', cursors: { after: 'second-page' } } };
  });
  const result = await callTool('get_account_insights', { ...insights, limit: 1 }, readGrant);
  const page = result.structuredContent.pagination.collections[0];
  assert.equal(page.error.category, 'timeout');
  assert.equal(page.next.tool, 'get_account_insights');
  assert.equal(page.next.arguments.after, 'second-page');
  assert.equal(calls.length, 2);
});

for (const scenario of [
  { name: 'missing or inaccessible object', details: { error_subcode: 33 }, status: 400, category: 'object_unavailable', preserved: { errorSubcode: 33 } },
  { name: 'transient Graph response', details: { is_transient: true }, status: 400, category: 'temporary_failure', preserved: { isTransient: true } },
  { name: 'HTTP server failure with code 100', details: {}, status: 500, category: 'temporary_failure', preserved: { httpStatus: 500 } },
]) {
  test(`later-page ${scenario.name} preserves the information needed for recovery`, async t => {
    const calls = fakeFetch(t, call => call.url.searchParams.has('after')
      ? graphError(100, scenario.details, scenario.status)
      : { data: [{ impressions: '10' }], paging: { next: 'opaque', cursors: { after: 'second-page' } } });
    const result = await callTool('get_account_insights', { ...insights, limit: 1 }, readGrant);
    const page = result.structuredContent.pagination.collections[0];
    assert.equal(result.isError, true);
    assert.equal(page.error.category, scenario.category);
    for (const [key, value] of Object.entries(scenario.preserved)) assert.equal(page.error[key], value);
    assert.equal(page.next.tool, 'get_account_insights');
    assert.equal(page.next.arguments.after, 'second-page');
    assert.equal(calls.length, 2);
  });
}

test('GET through execute_api receives read recovery without suggesting a write operation receipt', async t => {
  abortRequests(t);
  const calls = fakeFetch(t, () => { throw new Error('synthetic timeout'); });
  const result = await callTool('execute_api', { method: 'GET', endpoint: ACCOUNT + '/insights', params: { fields: 'impressions', limit: 50 } }, readGrant);
  assert.equal(result.structuredContent.error.category, 'timeout');
  assert.match(result.structuredContent.error.action, /A leitura execute_api/);
  assert.doesNotMatch(result.structuredContent.error.action, /get_operation_status/);
  assert.equal(calls.length, 1);
});

for (const code of [10, 200, 190]) {
  test(`Meta ${code} retains the correct permission or credential guidance`, async t => {
    const calls = fakeFetch(t, () => graphError(code, { message: TOKEN }));
    const result = await callTool('get_account_insights', insights, readGrant);
    assert.equal(result.structuredContent.error.category, code === 190 ? 'meta_authentication' : 'authorization');
    assert.match(result.structuredContent.error.action, code === 190 ? /tela de conexão.*não envie tokens no chat/ : /permissões.*ativos atribuídos/);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN));
    assert.equal(calls.length, 1);
  });
}

test('a transient read with code 100 is not treated as a fields validation error', async t => {
  const calls = fakeFetch(t, () => graphError(100, { is_transient: true }));
  const result = await callTool('get_account_insights', insights, readGrant);
  assert.equal(result.structuredContent.error.category, 'temporary_failure');
  assert.equal(calls.length, 1);
});

test('invalid JSON with HTTP 200 is a transport failure, not Graph permission code 200', async t => {
  const calls = fakeFetch(t, () => new Response('{invalid', { status: 200 }));
  const result = await callTool('get_account_insights', insights, readGrant);
  assert.equal(result.structuredContent.error.type, 'ParseError');
  assert.equal(result.structuredContent.error.category, 'temporary_failure');
  assert.doesNotMatch(result.structuredContent.error.action, /ativos atribuídos|permissões do aplicativo/);
  assert.equal(calls.length, 1);
});

test('a definitive write rejection recommends its receipt and never automatically resubmits', async t => {
  const calls = fakeFetch(t, () => graphError(100, { message: 'Invalid budget' }));
  const args = { account_id: ACCOUNT, name: 'Synthetic campaign', objective: 'OUTCOME_TRAFFIC', request_id: 'recovery-write-rejected' };
  const result = await callTool('create_campaign', args, { allowedAccountIds: [ACCOUNT] });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error.category, 'invalid_query');
  assert.match(result.structuredContent.error.action, /get_operation_status.*recovery-write-rejected/);
  assert.match(result.structuredContent.error.action, /Não repita.*pending ou unknown/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  const status = await callTool('get_operation_status', { request_id: args.request_id }, readGrant);
  assert.equal(JSON.parse(textOf(status)).operations[0].status, 'failed');
  assert.equal(calls.length, 1);
});

test('a write rate limit does not recommend resuming a read query or blindly retrying the mutation', async t => {
  const calls = fakeFetch(t, () => graphError(80004));
  const result = await callTool('create_campaign', {
    account_id: ACCOUNT, name: 'Synthetic quota campaign', objective: 'OUTCOME_TRAFFIC', request_id: 'write-quota',
  }, { allowedAccountIds: [ACCOUNT] });
  assert.equal(result.structuredContent.error.category, 'rate_limit');
  assert.match(result.structuredContent.error.action, /Aguarde.*recibo/);
  assert.match(result.structuredContent.error.action, /Não repita.*pending ou unknown/);
  assert.doesNotMatch(result.structuredContent.error.action, /next.tool|after|Reduza limit/);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

test('an uncertain write points to a read tool, preserves unknown, and blocks retry under a new request ID', async t => {
  abortRequests(t);
  const calls = fakeFetch(t, call => {
    if (call.method === 'POST') throw new Error('synthetic write timeout');
    return { id: '200001', account_id: '100001', status: 'PAUSED' };
  });
  const args = { ad_id: '200001', status: 'PAUSED', request_id: 'recovery-unknown-write' };
  const result = await callTool('update_ad', args, { allowedAccountIds: [ACCOUNT] });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error.category, 'write_outcome_unknown');
  assert.equal(result.structuredContent.operations[0].status, 'unknown');
  assert.deepEqual(result.structuredContent.error.next, { tool: 'get_operation_status', arguments: { request_id: args.request_id, inspect: true } });
  assert.doesNotMatch(textOf(result), /execute_api|Reduza limit/);
  assert.match(result.structuredContent.operations[0].next_step, /não comprova a alteração nem libera repetir/);
  const next = result.structuredContent.error.next;
  const inspected = await callTool(next.tool, next.arguments, readGrant);
  const operation = JSON.parse(textOf(inspected)).operations[0];
  assert.equal(operation.status, 'unknown');
  assert.equal(operation.observation.all_intended_fields_match, true);
  assert.match(operation.observation.note, /não libera automaticamente/);
  const attemptedRetry = await callTool('update_ad', { ...args, request_id: 'recovery-unknown-new-id' }, { allowedAccountIds: [ACCOUNT] });
  assert.equal(attemptedRetry.isError, true);
  assert.match(textOf(attemptedRetry), /Escrita bloqueada/);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

test('read-only permission denial sends no write and no recovery request', async t => {
  const calls = fakeFetch(t);
  const result = await callTool('update_ad', { ad_id: '200001', status: 'PAUSED' }, readGrant);
  assert.equal(result.isError, true);
  assert.match(textOf(result), /read-only permissions/);
  assert.equal(calls.length, 0);
});
