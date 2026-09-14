import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, apiTools, callTool, fakeFetch, textOf, assertSuccess, jsonResponse } from '../helpers/offline.mjs';

const grant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };
const cursor = 'next +/= true';
const paging = { next: 'https://graph.facebook.com/v26.0/act_999/ads?access_token=do-not-follow&after=wrong', cursors: { after: cursor } };
const queryOf = call => Object.fromEntries([...call.url.searchParams].filter(([key]) => key !== 'access_token'));
const continuations = result => result.structuredContent?.pagination?.collections.flatMap(page => page.next ? [page.next] : []) ?? [];

// Model a connector that exposes only tools annotated readOnlyHint.
async function readTool(name, args, context = grant) {
  assert.equal(apiTools.find(tool => tool.name === name)?.annotations.readOnlyHint, true, `${name} is unavailable to this read-only client`);
  return callTool(name, args, context);
}

function checkContinuation(result, name) {
  const entries = continuations(result);
  assert.equal(entries.length, 1);
  const next = entries[0];
  assert.equal(next.tool, name);
  assert.equal(next.arguments.after, cursor);
  assert.doesNotMatch(textOf(result), /Continue com execute_api|do-not-follow|act_999|access_token/);
  assert.match(textOf(result), /next.tool.*next.arguments/);
  return next;
}

const lists = [
  ['discover_ad_accounts', {}, 'me/adaccounts'],
  ['list_facebook_pages', {}, 'me/accounts'],
  ['list_campaigns', { account_id: ACCOUNT, effective_status: ['ACTIVE', 'PAUSED'] }, `${ACCOUNT}/campaigns`],
  ['list_adsets', { account_id: ACCOUNT, effective_status: ['PAUSED'] }, `${ACCOUNT}/adsets`],
  ['list_ads', { account_id: ACCOUNT }, `${ACCOUNT}/ads`],
  ['list_campaign_ads', { campaign_id: '200001' }, '200001/ads'],
  ['list_creatives', { account_id: ACCOUNT }, `${ACCOUNT}/adcreatives`],
  ['list_custom_audiences', { account_id: ACCOUNT }, `${ACCOUNT}/customaudiences`],
  ['list_pixels', { account_id: ACCOUNT }, `${ACCOUNT}/adspixels`],
  ['list_value_rule_sets', { account_id: ACCOUNT }, `${ACCOUNT}/value_rule_set`],
  ['list_ad_labels', { account_id: ACCOUNT }, `${ACCOUNT}/adlabels`],
  ['get_budget_schedules', { campaign_id: '200001' }, '200001/budget_schedules'],
];

for (const [name, args, endpoint] of lists) {
  test(`${name} follows its own read-only continuation with the same scoped Graph query`, async t => {
    const calls = fakeFetch(t, call => {
      if (call.path.endsWith('/promote_pages')) return { data: [{ id: '500001' }] };
      if (call.path !== `/v26.0/${endpoint}`) return { id: '200001', account_id: ACCOUNT.slice(4) };
      const row = {
        id: name === 'discover_ad_accounts' ? ACCOUNT : '500001', name: 'Named entity', status: 'PAUSED',
        account_status: 1, subtype: 'CUSTOM', budget_value: 500, time_start: '2026-09-01', time_end: '2026-09-02',
      };
      return { data: [row], ...(call.url.searchParams.has('after') ? {} : { paging }) };
    });
    const input = { ...args, pagination_mode: 'page', max_pages: 3, limit: 2 };
    const first = await readTool(name, input);
    assertSuccess(first);
    const next = checkContinuation(first, name);
    assert.equal(next.endpoint, endpoint);
    assert.equal(next.arguments.limit, 2);
    assert.equal(next.arguments.max_pages, 3);
    assert.equal(next.arguments.pagination_mode, 'page');
    assert.equal(Object.hasOwn(next.arguments, 'request_id'), false);
    if (args.effective_status) assert.deepEqual(next.arguments.effective_status, args.effective_status);
    if (next.params.fields) assert.equal(next.arguments.fields.join(','), next.params.fields);

    const second = await readTool(next.tool, next.arguments);
    assertSuccess(second);
    const pages = calls.filter(call => call.path === `/v26.0/${endpoint}`);
    assert.equal(pages.length, 2);
    assert.deepEqual(queryOf(pages[1]), { ...queryOf(pages[0]), after: cursor });
    assert.deepEqual(queryOf(pages[1]), next.params);
    assert.equal(second.structuredContent.pagination.complete, false);
    assert.equal(second.structuredContent.pagination.scope, 'from_cursor');
    assert.equal(second.structuredContent.pagination.collections[0].complete, true);
    assert.equal(continuations(second).length, 0);
    assert.ok(calls.every(call => call.method === 'GET'));
  });
}

test('explicit field expansions stay intact when continuing an unrestricted read grant', async t => {
  const fields = ['id', 'creative{id,name,object_story_spec{page_id,link_data{message}}}'];
  const calls = fakeFetch(t, call => ({ data: [{ id: '500001' }], ...(call.url.searchParams.has('after') ? {} : { paging }) }));
  const context = { permissions: 'read' };
  const first = await readTool('list_ads', { account_id: ACCOUNT, fields, pagination_mode: 'page' }, context);
  assertSuccess(first);
  const next = checkContinuation(first, 'list_ads');
  assert.deepEqual(next.arguments.fields, fields);
  assertSuccess(await readTool(next.tool, next.arguments, context));
  assert.equal(calls[1].url.searchParams.get('fields'), fields.join(','));
});

const insightTools = [
  ['get_account_insights', { account_id: ACCOUNT }, ACCOUNT],
  ['get_campaign_insights', { campaign_id: '200001' }, '200001'],
  ['get_adset_insights', { adset_id: '400001' }, '400001'],
  ['get_ad_insights', { ad_id: '500001' }, '500001'],
];
const insightsInput = {
  fields: ['impressions', 'spend', 'actions', 'cost_per_action_type'],
  date_preset: 'last_7d', time_range: { since: '2026-09-01', until: '2026-09-07' },
  breakdowns: ['age', 'gender'], action_breakdowns: ['action_type', 'action_device'],
  level: 'ad', time_increment: 1,
  filtering: [{ field: 'ad.effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }],
  sort: ['spend_descending'], action_attribution_windows: ['1d_click', '7d_click'],
  use_unified_attribution_setting: false, limit: 2, max_pages: 1,
};

for (const [name, args, object] of insightTools) {
  test(`${name} continues after max_pages using only read tools and retains the entire insights contract`, async t => {
    const calls = fakeFetch(t, call => {
      if (!call.path.endsWith('/insights')) return { id: object, account_id: ACCOUNT.slice(4) };
      return { data: [{ spend: '10', age: call.url.searchParams.has('after') ? '25-34' : '18-24' }], ...(call.url.searchParams.has('after') ? {} : { paging }) };
    });
    const input = { ...args, ...insightsInput };
    const first = await readTool(name, input);
    assert.equal(first.isError, true);
    assert.equal(first.structuredContent.pagination.collections[0].reason, 'page_limit');
    const next = checkContinuation(first, name);
    assert.deepEqual(next.arguments, { ...input, pagination_mode: 'all', after: cursor });
    const second = await readTool(next.tool, next.arguments);
    assertSuccess(second);
    assert.match(textOf(second), /25-34/);
    const pages = calls.filter(call => call.path.endsWith('/insights'));
    assert.equal(pages.length, 2);
    assert.deepEqual(queryOf(pages[1]), next.params);
    assert.deepEqual(queryOf(pages[1]), { ...queryOf(pages[0]), after: cursor });
  });
}

test('search continues with its page default, effective limit and public search filters', async t => {
  const calls = fakeFetch(t, call => ({
    data: [{ key: '123', name: 'Place', type: 'city' }], ...(call.url.searchParams.has('after') ? {} : { paging }),
  }));
  const input = { q: 'Barueri', country_code: 'BR', location_types: ['city'] };
  const first = await readTool('search_geolocation', input);
  assertSuccess(first);
  const next = checkContinuation(first, 'search_geolocation');
  assert.deepEqual(next.arguments, { ...input, after: cursor, limit: 25, pagination_mode: 'page', max_pages: 10 });
  assertSuccess(await readTool(next.tool, next.arguments));
  assert.deepEqual(queryOf(calls[1]), { ...queryOf(calls[0]), after: cursor });
  assert.equal(Object.hasOwn(next.arguments, 'type'), false, 'Graph-only parameters must not become tool arguments');
});

for (const [name, args] of [
  ['get_attribution_comparison', { object_id: '200001', object_type: 'campaign', actions: ['lead'] }],
  ['get_performance_summary', { account_id: ACCOUNT, action_types: ['purchase', 'lead'] }],
]) {
  test(`${name} retains its report defaults and fixed attribution query on continuation`, async t => {
    const calls = fakeFetch(t, call => !call.path.endsWith('/insights')
      ? { id: '200001', account_id: ACCOUNT.slice(4) }
      : { data: [{ spend: '10' }], ...(call.url.searchParams.has('after') ? {} : { paging }) });
    const first = await readTool(name, { ...args, pagination_mode: 'page' });
    assertSuccess(first);
    const next = checkContinuation(first, name);
    assert.equal(next.arguments.date_preset, 'last_30d');
    assert.equal(next.arguments.limit, 100);
    assertSuccess(await readTool(next.tool, next.arguments));
    const pages = calls.filter(call => call.path.endsWith('/insights'));
    assert.deepEqual(queryOf(pages[1]), { ...queryOf(pages[0]), after: cursor });
    assert.equal(pages[1].url.searchParams.get('use_unified_attribution_setting'), 'false');
    assert.equal(Object.hasOwn(next.arguments, 'fields'), false, 'Fixed report queries are reproduced by their own handler');
  });
}

test('a failed later page offers the failed cursor and succeeds through the same read tool', async t => {
  let failed = false;
  const calls = fakeFetch(t, call => {
    if (!call.url.searchParams.has('after')) return { data: [{ id: '500001' }], paging };
    if (!failed) { failed = true; return jsonResponse({ error: { code: 613, type: 'RateLimitException', message: 'Rate limit' } }, 429); }
    return { data: [{ id: '500002' }] };
  });
  const first = await readTool('list_ads', { account_id: ACCOUNT, fields: ['id'], limit: 1, max_pages: 5 });
  assert.equal(first.isError, true);
  assert.equal(first.structuredContent.pagination.collections[0].reason, 'page_error');
  const next = checkContinuation(first, 'list_ads');
  assertSuccess(await readTool(next.tool, next.arguments));
  assert.equal(calls.length, 3);
  assert.deepEqual(queryOf(calls[2]), queryOf(calls[1]));
});

for (const windows of [undefined, ['1d_click', '7d_click']]) {
  test(`the campaign report exposes independent typed continuations with ${windows ? 'manual' : 'default'} attribution`, async t => {
    const calls = fakeFetch(t, call => {
      if (!/\/(ads|insights)$/.test(call.path)) return { id: '200001', account_id: ACCOUNT.slice(4) };
      const insight = call.path.endsWith('/insights');
      const after = insight ? 'insights-only-cursor' : 'ads-only-cursor';
      return {
        data: insight ? [{ ad_id: '500001', spend: '10' }] : [{ id: '500001', name: 'Ad', status: 'PAUSED' }],
        ...(call.url.searchParams.has('after') ? {} : { paging: { ...paging, cursors: { after } } }),
      };
    });
    const input = {
      account_id: ACCOUNT, campaign_id: '200001', fields: ['spend', 'actions'],
      time_range: { since: '2026-09-01', until: '2026-09-07' },
      ...(windows ? { action_attribution_windows: windows } : {}),
      max_pages: 1, limit: 2,
    };
    const first = await readTool('list_campaign_ads_with_insights', input);
    assert.equal(first.isError, true);
    const next = continuations(first);
    assert.equal(next.length, 2);
    assert.deepEqual(next.map(item => item.tool), ['list_campaign_ads', 'get_campaign_insights']);
    assert.deepEqual(next[0].arguments.fields, ['id', 'name', 'status', 'effective_status']);
    assert.deepEqual(next[1].arguments.fields, ['ad_id', 'spend', 'actions']);
    assert.equal(next[1].arguments.level, 'ad');
    assert.equal(next[1].arguments.date_preset, 'last_30d');
    assert.deepEqual(next[1].arguments.time_range, input.time_range);
    assert.equal(next[1].arguments.use_unified_attribution_setting, windows ? false : undefined);
    for (const item of next) {
      assert.equal(item.arguments.limit, 2);
      assert.equal(item.arguments.after, item.tool === 'list_campaign_ads' ? 'ads-only-cursor' : 'insights-only-cursor');
      const result = await readTool(item.tool, item.arguments);
      assertSuccess(result);
      const pages = calls.filter(call => call.path === `/v26.0/${item.endpoint}`);
      assert.equal(pages.length, 2);
      assert.deepEqual(queryOf(pages[1]), item.params);
      assert.deepEqual(queryOf(pages[1]), { ...queryOf(pages[0]), after: item.arguments.after });
    }
  });
}

test('a continuation never authorizes another account or an object whose ownership changed', async t => {
  let allowedOwner = true;
  const calls = fakeFetch(t, call => call.path === '/v26.0/200001'
    ? { id: '200001', account_id: allowedOwner ? ACCOUNT.slice(4) : '999999' }
    : { data: [{ id: '500001' }], paging });
  const first = await readTool('list_ads', { account_id: ACCOUNT, pagination_mode: 'page', fields: ['id'] });
  const next = checkContinuation(first, 'list_ads');
  const beforeDenied = calls.length;
  assert.equal((await readTool(next.tool, { ...next.arguments, account_id: 'act_999999' })).isError, true);
  assert.equal(calls.length, beforeDenied);
  const campaign = await readTool('list_campaign_ads', { campaign_id: '200001', pagination_mode: 'page', fields: ['id'] });
  const campaignNext = checkContinuation(campaign, 'list_campaign_ads');
  allowedOwner = false;
  const beforeOwnerCheck = calls.filter(call => call.path.endsWith('/ads')).length;
  assert.equal((await readTool(campaignNext.tool, campaignNext.arguments)).isError, true);
  assert.equal(calls.filter(call => call.path.endsWith('/ads')).length, beforeOwnerCheck);
});

test('generic GET keeps its legacy endpoint/params and only announces GET continuation', async t => {
  const calls = fakeFetch(t, call => ({ data: [{ id: '500001' }], ...(call.url.searchParams.has('after') ? {} : { paging }) }));
  const first = await callTool('execute_api', {
    method: 'GET', endpoint: `${ACCOUNT}/ads`, params: { fields: 'id', limit: 3 }, request_id: 'not-a-write',
  }, grant);
  assertSuccess(first);
  const [next] = continuations(first);
  assert.equal(next.tool, 'execute_api');
  assert.equal(next.arguments.method, 'GET');
  assert.equal(Object.hasOwn(next.arguments, 'request_id'), false);
  assert.deepEqual(next.arguments.params, next.params);
  assert.equal(next.arguments.endpoint, next.endpoint);
  assertSuccess(await callTool(next.tool, next.arguments, grant));
  assert.deepEqual(queryOf(calls[1]), next.params);
  assert.equal(apiTools.find(tool => tool.name === 'execute_api').annotations.readOnlyHint, false);
  const before = calls.length;
  assert.equal((await callTool('execute_api', { ...next.arguments, method: 'POST' }, grant)).isError, true);
  assert.equal(calls.length, before);
});

test('write responses and reads without an after contract do not invent typed continuations', async t => {
  fakeFetch(t, call => {
    if (call.method === 'POST') return { id: '500001', data: [{ id: '500001' }], paging };
    if (call.path.endsWith('/previews')) return { data: [{ body: '<div>Preview</div>' }], paging };
    return { id: '600001', account_id: ACCOUNT.slice(4) };
  });
  const write = await callTool('execute_api', { method: 'POST', endpoint: `${ACCOUNT}/ads`, params: { name: 'Offline only' } });
  assertSuccess(write);
  assert.equal(continuations(write).length, 0);
  assert.doesNotMatch(textOf(write), /next\.tool/);
  const preview = await readTool('preview_creative', { creative_id: '600001', ad_format: 'MOBILE_FEED_STANDARD' });
  assertSuccess(preview);
  const [next] = continuations(preview);
  assert.equal(next.tool, undefined);
  assert.equal(next.arguments, undefined);
  assert.equal(next.params.after, cursor);
});

test('diagnostics retain their own partial evidence contract without raw or typed continuation', async t => {
  fakeFetch(t, () => ({ data: [{ permission: 'ads_read', status: 'granted' }], paging }));
  const result = await readTool('diagnose_connection', {});
  assertSuccess(result);
  assert.equal(continuations(result).length, 0);
  assert.equal(result.structuredContent?.pagination, undefined);
  assert.equal(JSON.parse(textOf(result)).meta_permissions.complete, false);
  assert.doesNotMatch(textOf(result), /next\.tool|"after"/);
});

test('the catalog teaches typed continuation without relaxing write annotations', () => {
  for (const [name] of [...lists, ...insightTools, ['search_geolocation'], ['get_attribution_comparison'], ['get_performance_summary'], ['list_campaign_ads_with_insights']]) {
    const tool = apiTools.find(tool => tool.name === name);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.match(tool.description, /next.tool.*next.arguments/);
    assert.match(tool.inputSchema.properties.after.description, /next.tool.*next.arguments/);
  }
  for (const name of ['execute_api', 'create_ad', 'activate_campaign']) {
    assert.equal(apiTools.find(tool => tool.name === name).annotations.readOnlyHint, false);
  }
});
