import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT, TOKEN, apiTools, callTool, fakeFetch, textOf, assertSuccess, adsetArgs, wrapperArgs,
} from '../helpers/offline.mjs';

// Deliberately authored examples rather than synthesizing inputs from the schema:
// a schema regression must not automatically alter the test's caller contract.
const scenarios = {
  diagnose_connection: [{}, 'GET', 'me/permissions'],
  get_operation_status: [{ request_id: 'no-previous-operation' }, null, null],
  discover_ad_accounts: [{}, 'GET', 'me/adaccounts'],
  list_facebook_pages: [{}, 'GET', 'me/accounts'],
  get_instagram_account: [{ page_id: '300001' }, 'GET', '300001'],
  list_campaigns: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/campaigns`],
  get_campaign: [{ campaign_id: '200001' }, 'GET', '200001'],
  create_campaign: [{ account_id: ACCOUNT, name: 'Offline campaign', objective: 'OUTCOME_TRAFFIC' }, 'POST', `${ACCOUNT}/campaigns`],
  update_campaign: [{ campaign_id: '200001', name: 'Renamed' }, 'POST', '200001'],
  pause_campaign: [{ campaign_id: '200001' }, 'POST', '200001'],
  activate_campaign: [{ campaign_id: '200001' }, 'POST', '200001'],
  list_adsets: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/adsets`],
  get_adset: [{ adset_id: '400001' }, 'GET', '400001'],
  create_adset: [adsetArgs({ advantage_audience: 0 }), 'POST', `${ACCOUNT}/adsets`],
  update_adset: [{ adset_id: '400001', name: 'Renamed' }, 'POST', '400001'],
  pause_adset: [{ adset_id: '400001' }, 'POST', '400001'],
  activate_adset: [{ adset_id: '400001' }, 'POST', '400001'],
  list_ads: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/ads`],
  list_campaign_ads: [{ campaign_id: '200001' }, 'GET', '200001/ads'],
  get_ad: [{ ad_id: '500001' }, 'GET', '500001'],
  create_ad: [{ account_id: ACCOUNT, name: 'Offline ad', adset_id: '400001', creative_id: '600001' }, 'POST', `${ACCOUNT}/ads`],
  update_ad: [{ ad_id: '500001', name: 'Renamed' }, 'POST', '500001'],
  pause_ad: [{ ad_id: '500001' }, 'POST', '500001'],
  activate_ad: [{ ad_id: '500001' }, 'POST', '500001'],
  list_creatives: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/adcreatives`],
  get_creative: [{ creative_id: '600001' }, 'GET', '600001'],
  create_creative: [{ account_id: ACCOUNT, name: 'Offline creative', object_story_id: '300001_700001' }, 'POST', `${ACCOUNT}/adcreatives`],
  get_account_insights: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/insights`],
  get_campaign_insights: [{ campaign_id: '200001' }, 'GET', '200001/insights'],
  get_adset_insights: [{ adset_id: '400001' }, 'GET', '400001/insights'],
  get_ad_insights: [{ ad_id: '500001' }, 'GET', '500001/insights'],
  get_attribution_comparison: [{ object_id: '200001', object_type: 'campaign' }, 'GET', '200001/insights'],
  get_performance_summary: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/insights`],
  list_campaign_ads_with_insights: [{ account_id: ACCOUNT, campaign_id: '200001' }, 'GET', '200001/ads'],
  list_custom_audiences: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/customaudiences`],
  create_custom_audience: [{ account_id: ACCOUNT, name: 'Offline audience', subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY' }, 'POST', `${ACCOUNT}/customaudiences`],
  get_reach_estimate: [{ account_id: ACCOUNT, targeting_spec: { geo_locations: { countries: ['BR'] } } }, 'GET', `${ACCOUNT}/reachestimate`],
  list_pixels: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/adspixels`],
  upload_image: [{ account_id: ACCOUNT, image_url: 'https://assets.example.test/image.png' }, 'POST', `${ACCOUNT}/adimages`],
  get_dataset_quality: [{ pixel_id: '800001' }, 'GET', 'dataset_quality'],
  search_geolocation: [{ q: 'Barueri', country_code: 'BR' }, 'GET', 'search'],
  execute_api: [{ method: 'GET', endpoint: 'me', params: { fields: 'id' } }, 'GET', 'me'],
  upload_video: [{ account_id: ACCOUNT, file_url: 'https://assets.example.test/video.mp4' }, 'POST', `${ACCOUNT}/advideos`],
  get_video_status: [{ video_id: '700001' }, 'GET', '700001'],
  create_value_rule_set: [{ account_id: ACCOUNT, name: 'Offline rules', rules: [{ name: 'Rule', value: 10 }] }, 'POST', `${ACCOUNT}/value_rule_set`],
  list_value_rule_sets: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/value_rule_set`],
  get_value_rule_set: [{ value_rule_set_id: '810001' }, 'GET', '810001'],
  update_value_rule_set: [{ value_rule_set_id: '810001', name: 'Renamed' }, 'POST', '810001'],
  delete_value_rule_set: [{ value_rule_set_id: '810001' }, 'POST', '810001/delete_rule_set'],
  create_ad_label: [{ account_id: ACCOUNT, name: 'Offline label' }, 'POST', `${ACCOUNT}/adlabels`],
  list_ad_labels: [{ account_id: ACCOUNT }, 'GET', `${ACCOUNT}/adlabels`],
  preview_creative: [{ creative_id: '600001', ad_format: 'MOBILE_FEED_STANDARD' }, 'GET', '600001/previews'],
  create_budget_schedule: [{ campaign_id: '200001', budget_value: 1000, time_start: '2026-10-01T12:00:00Z', time_end: '2026-10-02T12:00:00Z' }, 'POST', '200001/budget_schedules'],
  get_budget_schedules: [{ campaign_id: '200001' }, 'GET', '200001/budget_schedules'],
  update_budget_schedule: [{ budget_schedule_id: '820001', campaign_id: '200001', budget_value: 1200 }, 'POST', '820001'],
  delete_budget_schedule: [{ budget_schedule_id: '820001', campaign_id: '200001' }, 'DELETE', '820001'],
  get_skill: [{}, null, null],
  get_playbook: [{}, null, null],
  get_andromeda: [{}, null, null],
  create_threads_ad_set: [wrapperArgs.create_threads_ad_set, 'POST', `${ACCOUNT}/adsets`],
  create_click_to_message_ad_set: [wrapperArgs.create_click_to_message_ad_set, 'POST', `${ACCOUNT}/adsets`],
  create_partnership_ad_creative: [wrapperArgs.create_partnership_ad_creative, 'POST', `${ACCOUNT}/adcreatives`],
};

test('every advertised API/context tool has an explicit executable dispatch scenario', () => {
  assert.deepEqual(Object.keys(scenarios).sort(), apiTools.map((tool) => tool.name).sort());
});

for (const [name, [args, method, endpoint]] of Object.entries(scenarios)) {
  test(`dispatch and wire route: ${name}`, async (t) => {
    const calls = fakeFetch(t, (call) => {
      if (call.url.hostname === 'assets.example.test') return new Response(Buffer.from('fake-image-bytes'), {headers: {'content-type': 'image/png'}});
      if (call.path.endsWith('/permissions')) return { data: [{ permission: 'ads_read', status: 'granted' }] };
      if (call.path.endsWith('/reachestimate')) return { data: { users_lower_bound: 100, users_upper_bound: 200 } };
      return {
        data: [], id: '900001', name: 'Offline object', status: 'PAUSED', success: true,
        special_ad_categories: [], objective: 'OUTCOME_TRAFFIC',
      };
    });
    const result = await callTool(name, args);
    if (name === 'get_operation_status') {
      assertSuccess(result);
    } else if (method === null) {
      assert.notEqual(result.isError, true, textOf(result));
      assert.match(textOf(result), /^# /);
      assert.doesNotMatch(textOf(result), /^# Erro/);
      assert.ok(textOf(result).length > 200);
    } else {
      assertSuccess(result);
    }
    assert.ok(textOf(result).length > 20);
    if (method === null) {
      assert.equal(calls.length, 0);
    } else {
      const graphCalls = calls.filter((call) => call.url.hostname === 'graph.facebook.com');
      assert.ok(graphCalls.some((call) => call.method === method && call.path === `/v26.0/${endpoint}`),
        `Expected ${method} /v26.0/${endpoint}; got ${graphCalls.map((call) => `${call.method} ${call.path}`).join(', ')}`);
      for (const call of graphCalls) {
        const params = call.method === 'POST' ? call.body : call.url.searchParams;
        assert.equal(params.get('access_token'), TOKEN);
      }
    }
  });
}

test('account IDs normalize without double act_ prefix', async (t) => {
  const calls = fakeFetch(t);
  for (const account_id of ['100001', ACCOUNT]) await callTool('list_campaigns', { account_id });
  assert.deepEqual(calls.map((call) => call.path), [`/v26.0/${ACCOUNT}/campaigns`, `/v26.0/${ACCOUNT}/campaigns`]);
});

test('ordinary writes default to PAUSED; campaign and ad set API defaults reach the wire', async (t) => {
  const calls = fakeFetch(t);
  for (const name of ['create_campaign', 'create_adset', 'create_ad']) assertSuccess(await callTool(name, scenarios[name][0]));
  for (const call of calls) assert.equal(call.body.get('status'), 'PAUSED');
  assert.equal(calls[0].body.get('is_adset_budget_sharing_enabled'), 'false');
  assert.deepEqual(JSON.parse(calls[0].body.get('special_ad_categories')), []);
  assert.equal(calls[1].body.get('bid_strategy'), 'LOWEST_COST_WITHOUT_CAP');
  assert.deepEqual(JSON.parse(calls[2].body.get('creative')), { creative_id: '600001' });
});

test('effective status filters are JSON Graph filtering for campaigns and ad sets', async (t) => {
  const calls = fakeFetch(t);
  for (const name of ['list_campaigns', 'list_adsets']) await callTool(name, { account_id: ACCOUNT, effective_status: ['ACTIVE', 'PAUSED'] });
  for (const call of calls) assert.deepEqual(JSON.parse(call.url.searchParams.get('filtering')), [
    { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
  ]);
});

test('creative features are wrapped once and WhatsApp identity and URL tags survive', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_creative', {
    account_id: ACCOUNT, name: 'Offline creative', object_story_id: '300001_700001',
    creative_features_spec: { text_generation: { enroll_status: 'OPT_IN' } },
    wamo_whatsapp_identity_spec: { whatsapp_business_account_id: '850001' },
    url_tags: 'utm_source=meta&utm_campaign=a+b',
  });
  assertSuccess(result);
  assert.deepEqual(JSON.parse(calls[0].body.get('degrees_of_freedom_spec')), {
    creative_features_spec: { text_generation: { enroll_status: 'OPT_IN' } },
  });
  assert.deepEqual(JSON.parse(calls[0].body.get('wamo_whatsapp_identity_spec')), { whatsapp_business_account_id: '850001' });
  assert.equal(calls[0].body.get('creative_features_spec'), null);
  assert.equal(calls[0].body.get('url_tags'), 'utm_source=meta&utm_campaign=a+b');
});

test('custom audience rules are encoded once and false prefill survives', async (t) => {
  const calls = fakeFetch(t);
  const rule = { inclusions: { operator: 'or', rules: [{ event_sources: [{ id: '800001', type: 'pixel' }] }] } };
  assertSuccess(await callTool('create_custom_audience', {
    account_id: ACCOUNT, name: 'Offline website audience', subtype: 'WEBSITE', rule, pixel_id: '800001', prefill: false,
  }));
  assert.deepEqual(JSON.parse(calls[0].body.get('rule')), rule);
  assert.equal(calls[0].body.get('prefill'), 'false');
});

test('budget schedule converts timezone-bearing dates to Unix seconds', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('create_budget_schedule', {
    campaign_id: '200001', budget_value: 1000,
    time_start: '2026-10-01T09:00:00-03:00', time_end: '2026-10-02T09:00:00-03:00',
  }));
  assert.equal(calls[0].body.get('time_start'), String(Date.parse('2026-10-01T12:00:00Z') / 1000));
  assert.equal(calls[0].body.get('time_end'), String(Date.parse('2026-10-02T12:00:00Z') / 1000));
});

test('execute_api serializes structured GET values and removes tokens from nested paging URLs', async (t) => {
  const calls = fakeFetch(t, () => ({
    data: [{ id: '1', children: { paging: { next: 'https://graph.facebook.com/v26.0/1?after=A&access_token=fake-page-token' } } }],
    paging: { next: 'https://graph.facebook.com/v26.0/me?access_token=fake-page-token&after=B', cursors: { after: 'B' } },
  }));
  const result = await callTool('execute_api', {
    account_id: '100001', method: 'GET', endpoint: '{ad_account_id}/campaigns',
    params: { filtering: [{ field: 'name', operator: 'CONTAIN', value: 'ação' }], enabled: false, limit: 0 },
  });
  assertSuccess(result);
  assert.equal(calls[0].path, `/v26.0/${ACCOUNT}/campaigns`);
  assert.deepEqual(JSON.parse(calls[0].url.searchParams.get('filtering')), [{ field: 'name', operator: 'CONTAIN', value: 'ação' }]);
  assert.equal(calls[0].url.searchParams.get('enabled'), 'false');
  assert.equal(calls[0].url.searchParams.get('limit'), '0');
  assert.doesNotMatch(textOf(result), /fake-page-token/);
  assert.match(textOf(result), /after=A/);
  assert.equal(result.structuredContent.pagination.collections[0].next.params.after, 'B');
});

for (const [name, [args, method]] of Object.entries(scenarios)) {
  if (!['POST', 'DELETE'].includes(method) || name.startsWith('create_threads') || name.startsWith('create_click') || name.startsWith('create_partnership') || name === 'update_budget_schedule') continue;
  test(`read-only authorization denies existing write tool: ${name}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, args, { permissions: 'read' });
    assert.equal(result.isError, true, textOf(result));
    assert.match(textOf(result), /Permission denied/);
    assert.equal(calls.length, 0);
  });
}

for (const method of ['POST', 'DELETE']) {
  test(`read-only execute_api denies ${method} before any request`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('execute_api', { method, endpoint: '200001' }, { permissions: 'read' });
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  });
}
