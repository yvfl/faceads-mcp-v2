import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, adsetArgs, wrapperArgs, callTool, fakeFetch, textOf, assertSuccess } from '../helpers/offline.mjs';

for (const [field, removed] of [['instagram_positions', 'explore'], ['messenger_positions', 'story']]) {
  test(`v26 creation guard blocks removed placement ${field}=${removed} without a write`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('create_adset', adsetArgs({ targeting: { geo_locations: { countries: ['BR'] }, [field]: [removed] } }));
    assert.match(textOf(result), /Erro de Validação/);
    assert.match(textOf(result), new RegExp(field));
    assert.equal(calls.length, 0);
  });
}

test('v26 allows Instagram explore_home while removing only explore', async (t) => {
  const calls = fakeFetch(t);
  assertSuccess(await callTool('create_adset', adsetArgs({
    advantage_audience: 0, targeting: { geo_locations: { countries: ['BR'] }, instagram_positions: ['stream', 'explore_home'] },
  })));
  assert.deepEqual(JSON.parse(calls[0].body.get('targeting')).instagram_positions, ['stream', 'explore_home']);
});

for (const category of ['HOUSING', 'EMPLOYMENT', 'CREDIT', 'FINANCIAL_PRODUCTS_SERVICES']) {
  test(`constrained custom audience in special category ${category} requires an explicit choice`, async (t) => {
    const calls = fakeFetch(t, () => ({ id: '200001', special_ad_categories: [category] }));
    const result = await callTool('create_adset', adsetArgs({ targeting: {
      geo_locations: { countries: ['BR'] }, custom_audiences: [{ id: '880001' }],
    } }));
    assert.match(textOf(result), /Erro de Validação/);
    assert.match(textOf(result), new RegExp(category));
    assert.deepEqual(calls.map((call) => call.method), ['GET']);
    assert.equal(calls[0].url.searchParams.get('fields'), 'id,special_ad_categories');
  });
}

for (const choice of [0, 1]) {
  test(`explicit audience choice ${choice} is passed into the Graph targeting object`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool('create_adset', adsetArgs({ advantage_audience: choice })));
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].body.get('targeting')).targeting_automation.advantage_audience, choice);
    assert.equal(calls[0].body.has('advantage_audience'), false);
  });
}

test('political campaigns do not trigger the housing/employment/credit audience restriction', async (t) => {
  const calls = fakeFetch(t, (call) => call.method === 'GET'
    ? { id: '200001', special_ad_categories: ['ISSUES_ELECTIONS_POLITICS'] } : { id: '900001' });
  assertSuccess(await callTool('create_adset', adsetArgs({ targeting: { geo_locations: { countries: ['BR'] }, custom_audiences: [{id: '880001'}] } })));
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST']);
});

for (const spec of [
  { page_id: '300001', video_data: { video_id: '700001', poll_spec: { question: 'Poll?' } } },
  { page_id: '300001', video_data: { video_id: '700001', interactive_components_spec: { components: [{ type: 'poll' }] } } },
]) {
  test(`v26 rejects poll components before creative creation: ${Object.keys(spec.video_data)[1]}`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('create_creative', { account_id: ACCOUNT, name: 'Offline poll', object_story_spec: spec });
    assert.match(textOf(result), /enquete descontinuado/);
    assert.equal(calls.length, 0);
  });
}

test('Threads preserves explicit geography, defaults PAUSED, and tells the caller about replaced placements', async (t) => {
  const calls = fakeFetch(t);
  const result = await callTool('create_threads_ad_set', adsetArgs({ targeting: {
    geo_locations: { countries: ['PT'] }, publisher_platforms: ['facebook'], instagram_positions: ['reels'],
  } }));
  assertSuccess(result);
  const target = JSON.parse(calls[0].body.get('targeting'));
  assert.deepEqual(target.geo_locations, { countries: ['PT'] });
  assert.deepEqual(target.publisher_platforms, ['instagram', 'threads']);
  assert.deepEqual(target.instagram_positions, ['stream']);
  assert.deepEqual(target.threads_positions, ['threads_stream']);
  assert.equal(calls[0].body.get('status'), 'PAUSED');
  assert.match(textOf(result), /substituído/);
});

for (const destination of ['WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT']) {
  test(`Click-to-Message serializes ${destination} and preserves user targeting`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool('create_click_to_message_ad_set', {
      ...wrapperArgs.create_click_to_message_ad_set, destination,
      targeting: { geo_locations: { countries: ['PT'] } },
    }));
    const body = calls[0].body;
    assert.equal(body.get('destination_type'), destination);
    assert.equal(body.get('status'), 'PAUSED');
    assert.deepEqual(JSON.parse(body.get('targeting')).geo_locations, { countries: ['PT'] });
    assert.deepEqual(JSON.parse(body.get('promoted_object')), {
      page_id: '300001', ...(destination === 'WHATSAPP' ? { whatsapp_phone_number: '+5511999990000' } : {}),
    });
  });
}

for (const [label, overrides] of [
  ['missing phone', { whatsapp_phone_number: undefined }],
  ['missing targeting', { targeting: undefined }],
  ['empty targeting', { targeting: {} }],
  ['removed placement', { targeting: { geo_locations: { countries: ['BR'] }, messenger_positions: ['story'] } }],
]) {
  test(`Click-to-Message rejects ${label} without issuing any request`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('create_click_to_message_ad_set', { ...wrapperArgs.create_click_to_message_ad_set, ...overrides });
    assert.match(textOf(result), /Erro de Validação/);
    assert.equal(calls.length, 0);
  });
}

test('Partnership new creative preserves sponsor fields and creative feature envelope', async (t) => {
  const calls = fakeFetch(t);
  const args = {
    ...wrapperArgs.create_partnership_ad_creative,
    instagram_branded_content: { sponsor_id: '350001' },
    creative_features_spec: { text_generation: { enroll_status: 'OPT_OUT' } },
  };
  assertSuccess(await callTool('create_partnership_ad_creative', args));
  const body = calls[0].body;
  assert.deepEqual(JSON.parse(body.get('object_story_spec')), args.object_story_spec);
  assert.deepEqual(JSON.parse(body.get('facebook_branded_content')), args.facebook_branded_content);
  assert.deepEqual(JSON.parse(body.get('instagram_branded_content')), args.instagram_branded_content);
  assert.deepEqual(JSON.parse(body.get('degrees_of_freedom_spec')), { creative_features_spec: args.creative_features_spec });
});

for (const [mode, fields] of [
  ['boost_existing_post', { object_id: '300001' }],
  ['boost_existing_fb_post', { object_id: '300001' }],
  ['use_new_creative', {}],
]) {
  test(`Partnership rejects incomplete ${mode} without a request`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool('create_partnership_ad_creative', { account_id: ACCOUNT, name: 'Offline invalid', mode, ...fields });
    assert.match(textOf(result), /Erro de Validação/);
    assert.equal(calls.length, 0);
  });
}
