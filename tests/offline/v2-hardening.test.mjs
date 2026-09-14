import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT, TOKEN, MetaClient, apiTools, callTool, adsetArgs, wrapperArgs,
  withAuthContext, fakeFetch, jsonResponse, assertSuccess, textOf,
} from '../helpers/offline.mjs';
import { checkPermission } from '../../dist/auth/permissions.js';
import { toolRegistry } from '../../dist/tools/registry.js';
import { validateV26Placements, validateV26PollComponents } from '../../dist/tools/shared.js';

for (const name of ['not_registered', '__proto__', 'constructor']) {
  for (const permission of ['read', 'readwrite']) test(`v2 fails closed for ${name} with ${permission}`, async (t) => {
    const calls = fakeFetch(t);
    assert.equal(checkPermission(name, permission), false);
    assert.equal((await callTool(name, {}, {permissions: permission})).isError, true);
    assert.equal(calls.length, 0);
  });
}

test('every advertised API tool has an executable schema and an explicit permission', () => {
  assert.equal(apiTools.length, Object.keys(toolRegistry).length);
  for (const tool of apiTools) {
    const entry = toolRegistry[tool.name];
    assert.ok(entry.schema);
    assert.ok(['read', 'write', 'method'].includes(entry.permission));
    assert.equal(tool.annotations.readOnlyHint, entry.permission === 'read');
    assert.equal(typeof entry.execute, 'function');
  }
});

test('invalid permission values never gain write access', async (t) => {
  const calls = fakeFetch(t);
  assert.equal(checkPermission('create_campaign', 'admin'), false);
  assert.equal((await callTool('create_threads_ad_set', wrapperArgs.create_threads_ad_set, { permissions: 'admin' })).isError, true);
  assert.equal(calls.length, 0);
});

for (const params of [{ method: 'DELETE' }, { method: 'POST' }, { Method: 'DELETE' }, { batch: [{ method: 'DELETE' }] }, { access_token: 'alternate-token' }]) {
  test(`raw GET cannot smuggle a write or credential override via ${Object.keys(params)[0]}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('execute_api', { method: 'GET', endpoint: '200001', params }, { permissions: 'read' });
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  });
}
for (const endpoint of ['200001?method=DELETE', '200001/../other', 'https://graph.facebook.com/200001', '200001%2Fcopies']) {
  test(`raw API rejects ambiguous endpoint ${endpoint}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('execute_api', {method: 'GET', endpoint});
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  });
}

test('client write permission gate also protects direct calls', async (t) => {
  const calls = fakeFetch(t);
  await withAuthContext({ accessToken: TOKEN, permissions: 'read' }, async () => {
    await assert.rejects(new MetaClient().post('200001', {name: 'Changed'}), /Permission denied/);
    await assert.rejects(new MetaClient().delete('200001'), /Permission denied/);
  });
  assert.equal(calls.length, 0);
});

for (const method of ['get', 'post', 'delete']) {
  test(`${method.toUpperCase()} aborts provider requests after the configured timeout`, async (t) => {
    // Retain the helper's isolated durable journal and cleanup while exercising AbortSignal.
    fakeFetch(t);
    let aborted = false;
    let requests = 0;
    globalThis.fetch = async (_url, init) => { requests++; return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, {once: true});
    }); };
    await assert.rejects(new MetaClient({timeoutMs: 5})[method]('200001'), (error) => {
      const diagnostic = method === 'get' ? error : error.operation?.error;
      assert.equal(diagnostic?.type, 'TimeoutError');
      assert.equal(diagnostic?.code, -1);
      if (method !== 'get') {
        assert.equal(error.name, 'WriteOperationError');
        assert.equal(error.operation.status, 'unknown');
        assert.equal(error.operation.method, method.toUpperCase());
      }
      return true;
    });
    assert.equal(aborted, true);
    assert.equal(requests, 1, 'Timeout must never automatically repeat a write');
  });
}

for (const body of [null, 'Unexpected text', 42]) {
  test(`provider JSON ${JSON.stringify(body)} cannot become a successful tool result`, async (t) => {
    fakeFetch(t, () => jsonResponse(body));
    await assert.rejects(new MetaClient().get('200001'), /JSON inesperada/);
  });
}

for (const name of ['create_adset', 'create_threads_ad_set', 'create_click_to_message_ad_set']) {
  const base = wrapperArgs[name] ?? adsetArgs();
  test(`${name} rejects conflicting audience flags before network`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, {...base, advantage_audience: 1, targeting: {geo_locations: {countries: ['BR']}, targeting_automation: {advantage_audience: 0}}});
    assert.equal(result.isError, true);
    assert.match(textOf(result), /diverge/);
    assert.equal(calls.length, 0);
  });
  test(`${name} validates the bid required by COST_CAP before network`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, {...base, bid_strategy: 'COST_CAP'});
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  });
  test(`${name} accepts relaxed SAC targeting and injects the canonical default`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool(name, {...base, targeting: {
      geo_locations: {countries: ['BR']}, custom_audiences: [{id: '880001'}], targeting_relaxation_types: {custom_audience: 1},
    }}));
    assert.deepEqual(calls.map(c=>c.method), ['POST']);
    assert.equal(JSON.parse(calls[0].body.get('targeting')).targeting_automation.advantage_audience, 1);
  });
}

test('audience choice must be exactly 0 or 1 in either supported caller format', async (t) => {
  const calls = fakeFetch(t);
  for (const args of [adsetArgs({advantage_audience: 0.5}), adsetArgs({targeting: {targeting_automation: {advantage_audience: 0.5}}})]) {
    assert.equal((await callTool('create_adset', args)).isError, true);
  }
  assert.equal(calls.length, 0);
});

test('v25 placements and polls remain valid before the global removal date', async (t) => {
  t.mock.method(Date, 'now', () => Date.parse('2026-09-12T00:00:00Z'));
  const calls = fakeFetch(t);
  assertSuccess(await callTool('create_adset', adsetArgs({targeting: {geo_locations: {countries: ['BR']}, messenger_positions: ['story']}}), {apiVersion: 'v25.0'}));
  assertSuccess(await callTool('create_creative', {account_id: ACCOUNT, name: 'Old-version poll', object_story_spec: {page_id: '300001', video_data: {video_id: '700001', poll_spec: {question: 'Poll?'}}}}, {apiVersion: 'v25.0'}));
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.path.startsWith('/v25.0/')));
});

test('global removal date applies to older API versions', (t) => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-27T00:00:00Z'));
  assert.match(validateV26Placements({messenger_positions: ['story']}, 'v25.0'), /Placement removido/);
  assert.match(validateV26PollComponents({video_data: {video_id: '700001', poll_spec: {question: 'Poll?'}}}, 'v25.0'), /enquete descontinuado/);
});

test('non-poll interactive components are not rejected as polls', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('create_creative', {account_id: ACCOUNT, name: 'Non-poll', object_story_spec: {
    page_id: '300001', video_data: {video_id: '700001', interactive_components_spec: {components: [{type: 'sticker'}]}},
  }}));
  assert.equal(calls.length, 1);
});

test('updating targeting does not silently enable Advantage+ audience', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('update_adset', {adset_id: '400001', targeting: {geo_locations: {countries: ['PT']}}}));
  assert.deepEqual(JSON.parse(calls[0].body.get('targeting')), {geo_locations: {countries: ['PT']}});
});

for (const [name, args] of [
  ['create_budget_schedule', {campaign_id: '200001', budget_value: 1000, time_start: 'not-a-date', time_end: '2026-10-02T12:00:00Z'}],
  ['create_budget_schedule', {campaign_id: '200001', budget_value: 1000, time_start: '2026-10-03T12:00:00Z', time_end: '2026-10-02T12:00:00Z'}],
  ['update_budget_schedule', {budget_schedule_id: '820001', campaign_id: '200001', time_start: 'not-a-date'}],
  ['update_budget_schedule', {budget_schedule_id: '820001', campaign_id: '200001', time_start: '2026-10-03T12:00:00Z', time_end: '2026-10-02T12:00:00Z'}],
  ['create_adset', adsetArgs({start_time: 'invalid'})],
  ['update_adset', {adset_id: '400001', end_time: 'invalid'}],
]) {
  test(`${name} rejects invalid schedule ${JSON.stringify(args)}`, async (t) => {
    const calls = fakeFetch(t);
    assert.equal((await callTool(name, args)).isError, true);
    assert.equal(calls.length, 0);
  });
}

test('direct budget schedule client never serializes NaN', async (t) => {
  const calls = fakeFetch(t);
  await assert.rejects(new MetaClient().updateBudgetSchedule('820001', {time_start: 'invalid'}), /Data inválida/);
  assert.equal(calls.length, 0);
});

for (const ad_format of [1, 2, 3]) {
  test(`Partnership ad_format=${ad_format} is serialized in branded_content`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool('create_partnership_ad_creative', {account_id: ACCOUNT, name: 'Code boost', mode: 'boost_existing_post', object_id: '300001', instagram_boost_post_access_token: 'offline-ad-code', ad_format}));
    assert.deepEqual(JSON.parse(calls[0].body.get('branded_content')), {instagram_boost_post_access_token: 'offline-ad-code', ad_format});
  });
}

test('new Partnership creative requires at least one partner identity', async (t) => {
  const calls = fakeFetch(t);
  const args = {...wrapperArgs.create_partnership_ad_creative};
  delete args.facebook_branded_content;
  assert.equal((await callTool('create_partnership_ad_creative', args)).isError, true);
  assert.equal(calls.length, 0);
});

test('raw API output redacts nested credentials and pagination tokens', async (t) => {
  fakeFetch(t, () => ({data: [{id: '300001', access_token: 'secret-page-token'}], paging: {next: 'https://graph.facebook.com/v26.0/me/accounts?access_token=secret-paging-token&after=abc', cursors: {after: 'abc'}}}));
  const result = await callTool('execute_api', {method: 'GET', endpoint: 'me/accounts'});
  assertSuccess(result);
  assert.doesNotMatch(textOf(result), /secret-page-token|secret-paging-token/);
});

test('calendar-overflow dates are not normalized into another month', async (t) => {
  const calls = fakeFetch(t);
  assert.equal((await callTool('update_budget_schedule', {budget_schedule_id: '820001', campaign_id: '200001', time_start: '2026-02-30T12:00:00Z'})).isError, true);
  assert.equal(calls.length, 0);
});

test('SAC lookup failure cannot silently default a constrained audience', async (t) => {
  const calls = fakeFetch(t, () => jsonResponse({error: {message: 'Campaign unavailable', code: 100, type: 'GraphError'}}, 400));
  const result = await callTool('create_adset', adsetArgs({targeting: {geo_locations: {countries: ['BR']}, custom_audiences: [{id: '880001'}]}}));
  assert.equal(result.isError, true);
  assert.deepEqual(calls.map(call => call.method), ['GET']);
});

test('insights preserve every returned row and its requested dimensions', async (t) => {
  fakeFetch(t, () => ({data: [
    {age: '18-24', spend: '12.34', impressions: '100'},
    {age: '25-34', spend: '56.78', impressions: '200'},
  ]}));
  const result = await callTool('get_account_insights', {account_id: ACCOUNT, breakdowns: ['age']});
  assertSuccess(result);
  assert.match(textOf(result), /18-24/);
  assert.match(textOf(result), /25-34/);
  assert.match(textOf(result), /12\.34/);
  assert.match(textOf(result), /56\.78/);
  assert.doesNotMatch(textOf(result), /R\$/);
});

test('typed list output provides a credential-free continuation for additional pages', async (t) => {
  fakeFetch(t, () => ({data: [{id: '200001', name: 'Campaign', status: 'PAUSED'}], paging: {
    next: 'https://graph.facebook.com/v26.0/act_100001/campaigns?access_token=secret-next-token&after=next-cursor',
    cursors: {after: 'next-cursor'},
  }}));
  const result = await callTool('list_campaigns', {account_id: ACCOUNT, pagination_mode: 'page'});
  assertSuccess(result);
  assert.match(textOf(result), /resultados acima são parciais/);
  assert.match(textOf(result), /next-cursor/);
  assert.doesNotMatch(textOf(result), /secret-next-token/);
});

test('Threads removes incompatible placement fields while telling the caller', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_threads_ad_set', adsetArgs({targeting: {
    geo_locations: {countries: ['BR']}, facebook_positions: ['feed'], messenger_positions: ['story'],
  }}));
  assertSuccess(result);
  const targeting = JSON.parse(calls[0].body.get('targeting'));
  assert.equal(targeting.facebook_positions, undefined);
  assert.equal(targeting.messenger_positions, undefined);
  assert.match(textOf(result), /facebook_positions/);
});

test('provider error diagnostics cannot echo credentials into MCP output', async (t) => {
  fakeFetch(t, () => jsonResponse({error: {
    message: `Request ${TOKEN} with access_token=secret-query-token failed`, code: 190, type: 'OAuthException',
    error_user_title: `Expired ${TOKEN}`, error_user_msg: `refresh_token=secret-refresh-token`,
    error_data: { access_token: TOKEN }, fbtrace_id: 'safe-trace',
  }}, 400));
  const result = await callTool('list_campaigns', {account_id: ACCOUNT});
  assert.equal(result.isError, true);
  assert.doesNotMatch(textOf(result), new RegExp(`${TOKEN}|secret-query-token|secret-refresh-token`));
  assert.match(textOf(result), /190/);
  assert.match(textOf(result), /safe-trace/);
});

test('Page discovery does not request page access tokens by default', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('list_facebook_pages', {}));
  assert.doesNotMatch(calls[0].url.searchParams.get('fields'), /access_token/);
});

for (const subtypeSpec of [
  {type: 'similarity', country: 'BR'},
  {ratio: 0.02, starting_ratio: 0.01, location_spec: {geo_locations: {countries: ['BR', 'PT']}}},
]) {
  test(`LOOKALIKE preserves source and spec ${JSON.stringify(subtypeSpec)}`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool('create_custom_audience', {account_id: ACCOUNT, name: 'Lookalike', subtype: 'LOOKALIKE', origin_audience_id: '880001', lookalike_spec: subtypeSpec}));
    assert.equal(calls[0].body.get('origin_audience_id'), '880001');
    assert.deepEqual(JSON.parse(calls[0].body.get('lookalike_spec')), subtypeSpec);
  });
}
for (const overrides of [
  {}, {origin_audience_id: '880001'}, {origin_audience_id: '880001', lookalike_spec: {type: 'similarity'}},
  {origin_audience_id: '880001', lookalike_spec: {country: 'BR', ratio: 0.01, starting_ratio: 0.02}},
]) {
  test(`LOOKALIKE rejects incomplete or inverted spec ${JSON.stringify(overrides)}`, async (t) => {
    const calls = fakeFetch(t);
    assert.equal((await callTool('create_custom_audience', {account_id: ACCOUNT, name: 'Invalid lookalike', subtype: 'LOOKALIKE', ...overrides})).isError, true);
    assert.equal(calls.length, 0);
  });
}

for (const name of ['get_attribution_comparison', 'get_performance_summary']) {
  const args = name === 'get_performance_summary' ? {account_id: ACCOUNT} : {object_type: 'campaign', object_id: '200001', actions: ['purchase']};
  test(`${name} keeps absent incremental metrics unavailable and avoids unsupported advice`, async (t) => {
    fakeFetch(t, () => ({data: [{spend: '100', actions: [{action_type: 'purchase', value: '10'}], action_values: [{action_type: 'purchase', value: '1000'}]}]}));
    const result = await callTool(name, args);
    assertSuccess(result);
    assert.match(textOf(result), /Não disponível/);
    assert.doesNotMatch(textOf(result), /30%|30-50|50%|First Conversion|alto risco|boa eficiência|orgânicas/);
    assert.match(textOf(result), /10\.00/);
    assert.doesNotMatch(textOf(result), /Incremental:\*\* 0/);
  });
  test(`${name} distinguishes measured zero conversions from unavailable CPA`, async (t) => {
    fakeFetch(t, () => ({data: [{spend: '100', actions: [{action_type: 'purchase', value: '0', incrementality: '0'}]}]}));
    const result = await callTool(name, args);
    assertSuccess(result);
    assert.match(textOf(result), /\| 0 \|/);
    assert.match(textOf(result), /Não disponível/);
    assert.doesNotMatch(textOf(result), /\| CPA \| 0\.00/);
  });
}

for (const name of ['update_budget_schedule', 'delete_budget_schedule']) {
  test(`${name} requires its parent campaign for ownership verification`, async (t) => {
    const calls = fakeFetch(t);
    assert.equal((await callTool(name, {budget_schedule_id: '820001', budget_value: 1000})).isError, true);
    assert.equal(calls.length, 0);
  });
}
