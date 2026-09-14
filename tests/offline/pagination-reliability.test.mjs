import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, TOKEN, MetaClient, callTool, fakeFetch, textOf, assertSuccess, jsonResponse, adsetArgs } from '../helpers/offline.mjs';

const grant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };
const next = (after) => ({ next: `https://graph.facebook.com/v26.0/act_999/ads?access_token=never-expose&after=wrong`, cursors: { after } });

test('list_ads automatically retrieves every page and reports the complete authorized count', async t => {
  const calls = fakeFetch(t, call => {
    const after = call.url.searchParams.get('after');
    return !after ? { data: [{ id: '1', name: 'First', status: 'PAUSED' }, { id: '2', name: 'Second', status: 'PAUSED' }], paging: next('page-2') }
      : after === 'page-2' ? { data: [{ id: '3', name: 'Third', status: 'PAUSED' }, { id: '4', name: 'Fourth', status: 'PAUSED' }], paging: next('page-3') }
      : { data: [{ id: '5', name: 'Fifth', status: 'PAUSED' }] };
  });
  const result = await callTool('list_ads', { account_id: ACCOUNT, fields: ['id', 'name', 'status'], limit: 2 }, grant);
  assertSuccess(result);
  assert.equal(calls.length, 3);
  assert.equal(result.structuredContent.pagination.complete, true);
  assert.deepEqual(result.structuredContent.pagination.collections.map(p => [p.pages, p.returned_count]), [[3, 5]]);
  assert.match(textOf(result), /Encontrados 5/);
  assert.match(textOf(result), /Fifth/);
  assert.doesNotMatch(textOf(result), /never-expose|act_999|wrong/);
  for (const call of calls) {
    assert.equal(call.path, `/v26.0/${ACCOUNT}/ads`);
    assert.equal(call.url.searchParams.get('limit'), '2');
    assert.equal(call.url.searchParams.get('fields'), 'id,name,status');
    assert.equal(call.url.searchParams.get('access_token'), TOKEN);
    assert.equal(call.method, 'GET');
  }
});

test('discovery continues past an empty filtered page to an authorized account', async t => {
  const calls = fakeFetch(t, call => call.url.searchParams.has('after')
    ? { data: [{ id: ACCOUNT, name: 'Allowed', account_status: 1 }] }
    : { data: [{ id: 'act_999', name: 'Other account', account_status: 1 }], paging: next('next-allowed') });
  const result = await callTool('discover_ad_accounts', {}, grant);
  assertSuccess(result);
  assert.equal(calls.length, 2);
  assert.match(textOf(result), /Allowed/);
  assert.doesNotMatch(textOf(result), /Other account/);
  assert.equal(result.structuredContent.pagination.collections[0].returned_count, 1);
});

test('page budget cannot return a successful complete total and supplies exact continuation', async t => {
  fakeFetch(t, call => ({ data: [{ id: call.url.searchParams.has('after') ? '2' : '1', name: 'Ad', status: 'PAUSED' }], paging: next(call.url.searchParams.has('after') ? 'page-3' : 'page-2') }));
  const result = await callTool('list_ads', { account_id: ACCOUNT, max_pages: 2, limit: 1 }, grant);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /^RESULTADO INCOMPLETO/);
  const pagination = result.structuredContent.pagination;
  assert.equal(pagination.complete, false);
  assert.equal(pagination.collections[0].reason, 'page_limit');
  assert.equal(pagination.collections[0].next.params.after, 'page-3');
  assert.equal(pagination.collections[0].next.params.limit, '1');
});

test('an explicitly requested page and a continuation never claim whole-query completeness', async t => {
  const calls = fakeFetch(t, call => call.url.searchParams.has('after') ? { data: [{ id: '2', name: 'Second', status: 'PAUSED' }] } : { data: [{ id: '1', name: 'First', status: 'PAUSED' }], paging: next('page-2') });
  const first = await callTool('list_ads', { account_id: ACCOUNT, pagination_mode: 'page' }, grant);
  assertSuccess(first);
  assert.equal(calls.length, 1);
  assert.equal(first.structuredContent.pagination.complete, false);
  const last = await callTool('list_ads', { account_id: ACCOUNT, after: 'page-2' }, grant);
  assertSuccess(last);
  assert.equal(last.structuredContent.pagination.complete, false);
  assert.equal(last.structuredContent.pagination.scope, 'from_cursor');
  assert.equal(last.structuredContent.pagination.collections[0].complete, true);
  assert.match(textOf(last), /não inclui as páginas anteriores/);
});

for (const reason of ['cursor_repeated', 'cursor_missing', 'page_error']) {
  test(`pagination fails visibly on ${reason} while preserving already received rows`, async t => {
    const calls = fakeFetch(t, call => {
      if (reason === 'cursor_missing') return { data: [{ id: '1', name: 'Kept', status: 'PAUSED' }], paging: { next: 'https://graph.facebook.com/malformed' } };
      if (call.url.searchParams.has('after') && reason === 'page_error') return jsonResponse({ error: { code: 613, type: 'RateLimitException', message: 'rate limit' } }, 429);
      return { data: [{ id: '1', name: 'Kept', status: 'PAUSED' }], paging: next('same-cursor') };
    });
    const result = await callTool('list_ads', { account_id: ACCOUNT }, grant);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.pagination.complete, false);
    assert.equal(result.structuredContent.pagination.collections[0].reason, reason);
    assert.match(textOf(result), /Kept/);
    assert.ok(calls.length <= 2);
  });
}

test('collection time budget stops before another page without dropping the first page', async t => {
  const calls = fakeFetch(t, async () => { await new Promise(resolve => setTimeout(resolve, 10)); return { data: [{ id: '1' }], paging: next('next') }; });
  const client = new MetaClient({ pagination: { mode: 'all', budgetMs: 1 } });
  const result = await client.get(`${ACCOUNT}/ads`);
  assert.equal(result.data.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(client.collections[0].reason, 'time_limit');
});

test('a malformed later page preserves the earlier rows and the failed-page cursor', async t => {
  fakeFetch(t, call => call.url.searchParams.has('after') ? { data: null }
    : { data: [{ id: '1', name: 'Kept', status: 'PAUSED' }], paging: next('malformed-page') });
  const result = await callTool('list_ads', { account_id: ACCOUNT }, grant);
  assert.equal(result.isError, true);
  assert.match(textOf(result), /Kept/);
  const progress = result.structuredContent.pagination.collections[0];
  assert.equal(progress.reason, 'page_error');
  assert.equal(progress.returned_count, 1);
  assert.equal(progress.next.params.after, 'malformed-page');
});

test('invalid numeric metrics remain unavailable while actual zero remains zero', async t => {
  fakeFetch(t, () => ({ data: [{ spend: null, cpc: '', ctr: 'invalid', impressions: null, clicks: '0' }] }));
  const result = await callTool('get_account_insights', { account_id: ACCOUNT });
  assertSuccess(result);
  assert.equal((textOf(result).match(/Não disponível/g) || []).length, 4);
  assert.match(textOf(result), /\*\*Cliques:\*\* 0/);
  assert.doesNotMatch(textOf(result), /NaN|0\.00/);
});

test('each next page rechecks object ownership and cannot switch to a disallowed account', async t => {
  let checks = 0;
  const calls = fakeFetch(t, call => {
    if (call.path === '/v26.0/200001') return { id: '200001', account_id: ++checks === 1 ? ACCOUNT.slice(4) : '999' };
    if (call.path.endsWith('/customaudiences')) return { data: [] };
    return { data: [{ id: '1', name: 'Kept', status: 'PAUSED' }], paging: next('page-2') };
  });
  const result = await callTool('list_campaign_ads', { campaign_id: '200001' }, grant);
  assert.equal(result.isError, true);
  assert.equal(checks, 2);
  assert.equal(calls.filter(c => c.path.endsWith('/ads')).length, 1);
});

test('campaign report preserves all insight rows across pages with two collection queries, without per-ad fanout', async t => {
  const calls = fakeFetch(t, call => {
    if (call.path.endsWith('/ads')) return { data: [{ id: '1', name: 'First', status: 'PAUSED' }, { id: '2', name: 'Second', status: 'PAUSED' }] };
    assert.equal(call.path, '/v26.0/200001/insights');
    assert.equal(call.url.searchParams.get('level'), 'ad');
    assert.ok(call.url.searchParams.get('fields').split(',').includes('ad_id'));
    return call.url.searchParams.has('after') ? { data: [{ ad_id: '1', age: '25-34', spend: '22' }, { ad_id: '3', spend: '33' }] }
      : { data: [{ ad_id: '1', age: '18-24', spend: '11' }], paging: next('insights-2') };
  });
  const result = await callTool('list_campaign_ads_with_insights', { account_id: ACCOUNT, campaign_id: '200001' });
  assertSuccess(result);
  assert.equal(calls.length, 3);
  for (const value of ['18-24', '25-34', '11.00', '22.00', '33.00']) assert.ok(textOf(result).includes(value));
  assert.match(textOf(result), /ausentes da listagem/);
  assert.equal(result.structuredContent.report.insight_rows_returned, 3);
  assert.equal(result.structuredContent.pagination.complete, true);
});

test('campaign report queries historical insights even with no current ad entities', async t => {
  const calls = fakeFetch(t, call => ({ data: call.path.endsWith('/ads') ? [] : [{ ad_id: '123', spend: '77' }] }));
  const result = await callTool('list_campaign_ads_with_insights', { account_id: ACCOUNT, campaign_id: '200001' });
  assertSuccess(result);
  assert.equal(calls.length, 2);
  assert.match(textOf(result), /77.00/);
});

test('campaign report distinguishes provider failure from no metrics and never invents zero', async t => {
  fakeFetch(t, call => call.path.endsWith('/ads') ? { data: [{ id: '1', name: 'First', status: 'PAUSED' }] }
    : jsonResponse({ error: { code: 200, type: 'PermissionsException', message: 'No metrics permission' } }, 400));
  const result = await callTool('list_campaign_ads_with_insights', { account_id: ACCOUNT, campaign_id: '200001' });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.report.metrics_complete, false);
  assert.match(textOf(result), /Métricas não verificadas/);
  assert.doesNotMatch(textOf(result), /0\.00|\| 0 \|/);
});

test('campaign report treats malformed insights as a failed query, not absence of metrics', async t => {
  fakeFetch(t, call => call.path.endsWith('/ads') ? { data: [{ id: '1', name: 'Kept', status: 'PAUSED' }] } : { data: {} });
  const result = await callTool('list_campaign_ads_with_insights', { account_id: ACCOUNT, campaign_id: '200001' });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.report.metrics_complete, false);
  assert.match(textOf(result), /Métricas não verificadas/);
  assert.doesNotMatch(textOf(result), /0\.00|Nenhum dado de insights/);
});

test('creation is always paused through typed and generic writes; activation remains separate', async t => {
  const calls = fakeFetch(t);
  for (const [name, args] of [
    ['create_campaign', { account_id: ACCOUNT, name: 'Test', objective: 'OUTCOME_TRAFFIC' }],
    ['create_adset', adsetArgs()],
    ['create_ad', { account_id: ACCOUNT, name: 'Test', adset_id: '400001', creative_id: '600001' }],
  ]) {
    const before = calls.length;
    assert.equal((await callTool(name, { ...args, status: 'ACTIVE' })).isError, true);
    assert.equal(calls.length, before);
    assertSuccess(await callTool(name, args));
    assert.equal(calls.at(-1).body.get('status'), 'PAUSED');
  }
  for (const edge of ['campaigns', 'adsets', 'ads']) {
    const before = calls.length;
    assert.equal((await callTool('execute_api', { endpoint: `${ACCOUNT}/${edge}`, method: 'POST', params: { status: 'ACTIVE' } })).isError, true);
    assert.equal(calls.length, before);
    assertSuccess(await callTool('execute_api', { endpoint: `${ACCOUNT}/${edge}`, method: 'POST', params: { name: 'Raw' } }));
    assert.equal(calls.at(-1).body.get('status'), 'PAUSED');
  }
  assert.equal((await callTool('execute_api', { endpoint: '200001/copies', method: 'POST', params: { status_option: 'INHERITED_FROM_SOURCE' } })).isError, true);
  assertSuccess(await callTool('execute_api', { endpoint: '200001/copies', method: 'POST' }));
  assert.equal(calls.at(-1).body.get('status_option'), 'PAUSED');
  assertSuccess(await callTool('activate_campaign', { campaign_id: '200001' }));
  assert.equal(calls.at(-1).body.get('status'), 'ACTIVE');
});
