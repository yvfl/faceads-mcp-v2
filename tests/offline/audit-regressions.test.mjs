import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT, MetaClient, adsetArgs, wrapperArgs, callTool, fakeFetch, textOf, assertSuccess, jsonResponse,
} from '../helpers/offline.mjs';

// These are expected-behavior tests, intentionally NOT skipped/todo/inverted.
// They originally reproduced the audit defects and remain permanent regression
// checks. Assertions describe the intended caller contract and wire behavior.

for (const [name, args] of Object.entries(wrapperArgs)) {
  test(`AUDIT permission: a read-only tenant cannot execute ${name}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, args, { permissions: 'read' });
    assert.deepEqual({ isError: result.isError === true, writes: calls.filter((call) => call.method !== 'GET').length },
      { isError: true, writes: 0 }, 'Read-only request must fail before creating remote resources');
    assert.match(textOf(result), /Permission denied/);
  });
}

test('AUDIT permission: read-only tenant cannot update a legacy budget schedule', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('update_budget_schedule', { budget_schedule_id: '820001', campaign_id: '200001', budget_value: 1500 }, { permissions: 'read' });
  assert.deepEqual({ isError: result.isError === true, writes: calls.filter((call) => call.method !== 'GET').length },
    { isError: true, writes: 0 });
});

for (const choice of [0, 1]) {
  test(`AUDIT v26: nested explicit advantage_audience=${choice} remains valid for HOUSING`, async (t) => {
    const calls = fakeFetch(t, (call) => call.method === 'GET'
      ? { id: '200001', special_ad_categories: ['HOUSING'] } : { id: '900001' });
    const result = await callTool('create_adset', adsetArgs({ targeting: {
      geo_locations: { countries: ['BR'] }, targeting_automation: { advantage_audience: choice },
    } }));
    assertSuccess(result);
    const post = calls.find((call) => call.method === 'POST');
    assert.ok(post, 'The API targeting payload already contains the explicit choice');
    assert.equal(JSON.parse(post.body.get('targeting')).targeting_automation.advantage_audience, choice);
  });
}

test('AUDIT v26: special category with only geography does not need a constrained-audience opt-in', async (t) => {
  const calls = fakeFetch(t, (call) => call.method === 'GET'
    ? { id: '200001', special_ad_categories: ['HOUSING'] } : { id: '900001' });
  const result = await callTool('create_adset', adsetArgs());
  assertSuccess(result);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
});

for (const [name, overrides] of [
  ['create_threads_ad_set', { campaign_id: undefined }],
  ['create_click_to_message_ad_set', { page_id: undefined }],
  ['create_partnership_ad_creative', { mode: 'not_a_valid_mode' }],
]) {
  test(`AUDIT validation: runtime enforces advertised required fields/enums for ${name}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, { ...wrapperArgs[name], ...overrides });
    assert.deepEqual({ isError: result.isError === true, calls: calls.length }, { isError: true, calls: 0 },
      'JSON Schema exposed in tools/list does not itself validate tools/call arguments');
  });
}

for (const name of ['create_threads_ad_set', 'create_click_to_message_ad_set']) {
  test(`AUDIT validation: ${name} rejects simultaneous daily and lifetime budgets`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, { ...wrapperArgs[name], daily_budget: 1000, lifetime_budget: 10000 });
    assert.equal(calls.length, 0, 'A wrapper advertised over create_adset must enforce its budget contract');
    assert.equal(result.isError, true);
  });
}

test('AUDIT Threads: COST_CAP preserves the caller bid_amount needed by the selected bid strategy', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('create_threads_ad_set', adsetArgs({ bid_strategy: 'COST_CAP', bid_amount: 1000 })));
  assert.equal(calls[0].body.get('bid_strategy'), 'COST_CAP');
  assert.equal(calls[0].body.get('bid_amount'), '1000');
});

// Contract evidence: scraped official docs under
// docs/ad-creative/partnership-ads/ads-creation/boost-existing-post.md:219-241
// docs/ad-creative/partnership-ads/ads-creation/boost-existing-fb-post.md:141-164
// Both examples send ad codes inside branded_content.
for (const [mode, tokenField] of [
  ['boost_existing_post', 'instagram_boost_post_access_token'],
  ['boost_existing_fb_post', 'facebook_boost_post_access_token'],
]) {
  test(`AUDIT Partnership: ${mode} puts the ad code inside branded_content`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool('create_partnership_ad_creative', {
      account_id: ACCOUNT, name: 'Offline boost', mode, object_id: '300001',
      source_instagram_media_id: '350001', [tokenField]: 'fake-partnership-code',
    }));
    const body = calls[0].body;
    const brandedContent = JSON.parse(body.get('branded_content') ?? '{}');
    assert.equal(brandedContent[tokenField], 'fake-partnership-code');
    assert.equal(body.has(tokenField), false, 'Ad code must not be flattened into the creative root');
  });
}

test('AUDIT Partnership: Instagram ad-code creation does not require source_instagram_media_id', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_partnership_ad_creative', {
    account_id: ACCOUNT, name: 'Offline code boost', mode: 'boost_existing_post', object_id: '300001',
    instagram_boost_post_access_token: 'fake-partnership-code',
  });
  assertSuccess(result);
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
});

test('AUDIT v26: update_adset must also stop removed placements before Graph', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('update_adset', {
    adset_id: '400001', targeting: { geo_locations: { countries: ['BR'] }, instagram_positions: ['explore'] },
  });
  assert.equal(calls.length, 0);
  assert.equal(result.isError, true);
});

test('AUDIT MCP result: v26 placement validation failure is marked isError', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_adset', adsetArgs({ targeting: { instagram_positions: ['explore'] } }));
  assert.equal(calls.length, 0);
  assert.match(textOf(result), /Erro de Validação/);
  assert.equal(result.isError, true, 'MCP consumers should not treat failed creation as a successful tool call');
});

test('AUDIT Partnership: new creative receives the same v26 poll guard as create_creative', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_partnership_ad_creative', {
    ...wrapperArgs.create_partnership_ad_creative,
    object_story_spec: { page_id: '300001', video_data: { video_id: '700001', poll_spec: { question: 'Poll?' } } },
  });
  assert.equal(calls.length, 0);
  assert.equal(result.isError, true);
});

test('AUDIT date validation: invalid budget schedule time never becomes NaN on the wire', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_budget_schedule', {
    campaign_id: '200001', budget_value: 1000, time_start: 'not-a-date', time_end: '2026-10-02T12:00:00Z',
  });
  assert.equal(calls.length, 0, 'Invalid date must be rejected before creating a schedule');
  assert.equal(result.isError, true);
});

for (const method of ['get', 'post', 'delete']) {
  test(`AUDIT HTTP errors: ${method.toUpperCase()} must reject non-2xx JSON even without a Graph error envelope`, async (t) => {
    fakeFetch(t, () => jsonResponse({ message: 'Upstream unavailable' }, 503));
    await assert.rejects(new MetaClient()[method]('200001'), /503|unavailable/i);
  });
}
