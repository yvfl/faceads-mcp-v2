import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, apiSchemas, apiTools, callTool, fakeFetch, textOf, assertSuccess } from '../helpers/offline.mjs';
import { validateArgs } from '../../dist/schemas/index.js';

const grant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };

test('list_ads advertises and forwards status/update filters on every page and typed continuation', async t => {
  const catalog = apiTools.find(tool => tool.name === 'list_ads');
  assert.equal(catalog.annotations.readOnlyHint, true);
  assert.ok(catalog.inputSchema.properties.effective_status);
  assert.ok(catalog.inputSchema.properties.updated_since);
  const calls = fakeFetch(t, call => {
    assert.equal(call.method, 'GET');
    assert.equal(call.path, `/v26.0/${ACCOUNT}/ads`);
    const statuses = JSON.parse(call.url.searchParams.get('effective_status'));
    assert.equal(call.url.searchParams.get('updated_since'), '0');
    const rows = [{ id: '500001', name: 'Active ad', effective_status: 'ACTIVE' }, { id: '500002', name: 'Paused ad', effective_status: 'PAUSED' }];
    return {
      data: rows.filter(row => statuses.includes(row.effective_status)),
      ...(call.url.searchParams.has('after') ? {} : { paging: { next: 'https://graph.facebook.com/ignored', cursors: { after: '[opaque] +/=' } } }),
    };
  });
  const first = await callTool('list_ads', {
    account_id: ACCOUNT, effective_status: '["ACTIVE"]', updated_since: 0,
    fields: ['id', 'name', 'effective_status'], limit: 1, pagination_mode: 'page',
  }, grant);
  assertSuccess(first);
  assert.match(textOf(first), /Active ad/);
  assert.doesNotMatch(textOf(first), /Paused ad/);
  const next = first.structuredContent.pagination.collections[0].next;
  assert.equal(next.tool, 'list_ads');
  assert.deepEqual(next.arguments.effective_status, ['ACTIVE']);
  assert.equal(next.arguments.updated_since, 0);
  assert.equal(next.arguments.after, '[opaque] +/=');
  assertSuccess(await callTool(next.tool, next.arguments, grant));
  assert.equal(calls.length, 2);
  assert.deepEqual(Object.fromEntries(calls[1].url.searchParams), { ...Object.fromEntries(calls[0].url.searchParams), after: '[opaque] +/=' });
});

test('list_ads forwards the update timestamp without adding absent filters', async t => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('list_ads', { account_id: ACCOUNT, updated_since: 1788220800 }, grant));
  assert.equal(calls[0].url.searchParams.get('updated_since'), '1788220800');
  assert.equal(calls[0].url.searchParams.has('effective_status'), false);
});

test('unknown root parameters and invalid root types fail before Graph instead of broadening a read', async t => {
  const calls = fakeFetch(t);
  for (const [name, args, unknown] of [
    ['list_ads', { account_id: ACCOUNT, effectiveStatus: ['ACTIVE'] }, 'effectiveStatus'],
    ['list_ads', { account_id: ACCOUNT, filtering: [{ field: 'name', operator: 'CONTAIN', value: 'Launch' }] }, 'filtering'],
    ['get_account_insights', { account_id: ACCOUNT, date_from: '2026-09-01' }, 'date_from'],
    ['discover_ad_accounts', { request_id: 'unused-read-id' }, 'request_id'],
    ['discover_ad_accounts', [], undefined],
  ]) {
    const result = await callTool(name, args, grant);
    assert.equal(result.isError, true);
    assert.match(textOf(result), /Parâmetros inválidos/);
    if (unknown) assert.ok(textOf(result).includes(unknown));
  }
  assert.equal(calls.length, 0);
});

test('invalid status or updated_since is rejected before Graph', async t => {
  const calls = fakeFetch(t);
  for (const invalid of [{ effective_status: ['RUNNING'] }, ...[-1, 0.1, null, true, 'yesterday'].map(updated_since => ({ updated_since }))]) {
    const result = await callTool('list_ads', { account_id: ACCOUNT, ...invalid }, grant);
    assert.equal(result.isError, true);
  }
  assert.equal(calls.length, 0);
});

test('strict root validation retains nested Graph extensions, defaults and query refinements', () => {
  const params = { filtering: [{ field: 'ad.effective_status', operator: 'IN', value: ['ACTIVE'] }], provider_extension: { future: false } };
  const generic = validateArgs(apiSchemas.execute_api, { method: 'GET', endpoint: `${ACCOUNT}/ads`, params });
  assert.equal(generic.success, true);
  assert.deepEqual(generic.data.params, params);
  const targeting = { geo_locations: { countries: ['BR'] }, future_graph_feature: { value: 0 } };
  const update = validateArgs(apiSchemas.update_adset, { adset_id: '400001', targeting });
  assert.equal(update.success, true);
  assert.deepEqual(update.data.targeting, targeting);
  const report = validateArgs(apiSchemas.get_performance_summary, { account_id: ACCOUNT });
  assert.equal(report.success, true);
  assert.equal(report.data.date_preset, 'last_30d');
  const refined = validateArgs(apiSchemas.get_account_insights, { account_id: ACCOUNT, fields: ['spend'], action_breakdowns: ['action_device'] });
  assert.equal(refined.success, false);
});
