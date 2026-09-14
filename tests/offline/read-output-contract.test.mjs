import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, callTool, fakeFetch, textOf, assertSuccess } from '../helpers/offline.mjs';

const listCases = [
  { name: 'list_creatives', args: { account_id: ACCOUNT }, endpoint: `${ACCOUNT}/adcreatives`, values: { body: 'Requested creative body', object_story_spec: { page_id: '300001', link_data: { message: 'Requested story', link: 'https://example.test' } }, asset_feed_spec: { bodies: [{ text: 'Dynamic body' }] } } },
  { name: 'list_custom_audiences', args: { account_id: ACCOUNT }, endpoint: `${ACCOUNT}/customaudiences`, values: { subtype: 'WEBSITE', approximate_count_lower_bound: 12001, approximate_count_upper_bound: 14567, rule: { event_name: 'Purchase' }, delivery_status: { code: 200, description: 'Audience ready' } } },
  { name: 'list_pixels', args: { account_id: ACCOUNT }, endpoint: `${ACCOUNT}/adspixels`, values: { is_created_by_business: false, owner_business: { id: '700001', name: 'Pixel business' }, last_fired_time: '2026-09-01T10:00:00+0000' } },
  { name: 'list_value_rule_sets', args: { account_id: ACCOUNT }, endpoint: `${ACCOUNT}/value_rule_set`, values: { rules: [{ name: 'Value rule', value: 20 }], status: 'ACTIVE' } },
  { name: 'list_ad_labels', args: { account_id: ACCOUNT }, endpoint: `${ACCOUNT}/adlabels`, values: { created_time: '2026-09-02T10:11:12+0000' } },
  { name: 'discover_ad_accounts', args: {}, endpoint: 'me/adaccounts', values: { business: { id: '700002', name: 'Account business' }, disable_reason: 0, currency: 'BRL' } },
  { name: 'list_facebook_pages', args: {}, endpoint: 'me/accounts', values: { category: 'Software', tasks: ['ADVERTISE', 'ANALYZE'], instagram_business_account: { id: '700003', username: 'example_page' } } },
];

for (const scenario of listCases) {
  test(`${scenario.name} delivers requested fields and false/null/zero through later pages in read mode`, async t => {
    const fields = ['id', ...Object.keys(scenario.values)];
    const rows = [
      { id: '500001', ...scenario.values, provider_extra: { enabled: false, amount: 0, absent: null, items: [] } },
      { id: '500002', ...scenario.values, provider_extra: { enabled: true, amount: 7, absent: null, items: [{ later: 'Later page value' }] } },
    ];
    const calls = fakeFetch(t, call => call.url.searchParams.has('after')
      ? { data: [rows[1]] }
      : { data: [rows[0]], paging: { next: 'https://graph.facebook.com/next', cursors: { after: 'later-page' } } });
    const result = await callTool(scenario.name, { ...scenario.args, fields, limit: 1 }, { permissions: 'read' });

    assertSuccess(result);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.method, 'GET');
      assert.equal(call.path, `/v26.0/${scenario.endpoint}`);
      assert.equal(call.url.searchParams.get('fields'), fields.join(','));
      assert.equal(call.url.searchParams.get('limit'), '1');
    }
    assert.equal(calls[1].url.searchParams.get('after'), 'later-page');
    assert.equal(result.structuredContent.pagination.complete, true);
    const sections = textOf(result).split(/### /).slice(1);
    assert.equal(sections.length, 2);
    for (const [index, row] of rows.entries()) {
      assert.ok(sections[index].startsWith(`${row.id}\n`));
      for (const value of Object.values(row)) {
        assert.ok(sections[index].includes(typeof value === 'object' ? JSON.stringify(value) : String(value)), `Missing ${JSON.stringify(value)}`);
      }
    }
    assert.doesNotMatch(textOf(result), /N\/A|undefined|Nunca/);
  });

  test(`${scenario.name} retains name titles with default fields`, async t => {
    fakeFetch(t, () => ({ data: [{ id: '500001', name: 'Named result', ...scenario.values }] }));
    const result = await callTool(scenario.name, scenario.args, { permissions: 'read' });
    assertSuccess(result);
    assert.match(textOf(result), /### Named result\n- \*\*ID:\*\* 500001/);
  });
}

test('custom audience fields remain available under selected account authorization', async t => {
  const calls = fakeFetch(t, () => ({ data: [{ id: '500001', approximate_count_lower_bound: 0, approximate_count_upper_bound: 100 }] }));
  const result = await callTool('list_custom_audiences', {
    account_id: ACCOUNT, fields: ['id', 'approximate_count_lower_bound', 'approximate_count_upper_bound'],
  }, { permissions: 'read', allowedAccountIds: [ACCOUNT] });
  assertSuccess(result);
  assert.equal(calls.length, 1);
  assert.match(textOf(result), /limite inferior\):\*\* 0/);
  assert.match(textOf(result), /limite superior\):\*\* 100/);
});

for (const budgets of [{}, { daily_budget: '0', lifetime_budget: '0' }, { daily_budget: 0, lifetime_budget: 0 }, { daily_budget: null }]) {
  test(`campaign budget classification does not assume a budget from ${JSON.stringify(budgets)}`, async t => {
    const calls = fakeFetch(t, () => ({ id: '200001', ...budgets }));
    const fields = ['id', ...Object.keys(budgets)];
    const result = await callTool('get_campaign', { campaign_id: '200001', fields }, { permissions: 'read' });
    assertSuccess(result);
    assert.equal(calls[0].url.searchParams.get('fields'), fields.join(','));
    assert.match(textOf(result), /# Campanha: 200001/);
    assert.match(textOf(result), /Tipo de Orçamento:\*\* Não disponível nos campos retornados/);
    assert.doesNotMatch(textOf(result), /\b(?:ABO|CBO)\b|\*\*Status:\*\*|N\/A/);
  });
}

test('a returned positive campaign budget still identifies CBO', async t => {
  fakeFetch(t, () => ({ id: '200001', name: 'Campaign', daily_budget: '1500', lifetime_budget: '0', budget_remaining: 0 }));
  const result = await callTool('get_campaign', { campaign_id: '200001' }, { permissions: 'read' });
  assertSuccess(result);
  assert.match(textOf(result), /Tipo de Orçamento:\*\* CBO/);
  assert.match(textOf(result), /Orçamento Diário:\*\* 1500/);
  assert.match(textOf(result), /Orçamento Restante:\*\* 0/);
});

test('omitted pixel activity does not become Never', async t => {
  fakeFetch(t, () => ({ data: [{ id: '600001', name: 'Pixel' }] }));
  const result = await callTool('list_pixels', { account_id: ACCOUNT, fields: ['id', 'name'] }, { permissions: 'read' });
  assertSuccess(result);
  assert.doesNotMatch(textOf(result), /Nunca|Último Disparo/);
});

for (const id of [undefined, null, '']) {
  test(`pixel examples require a returned ID instead of ${String(id)}`, async t => {
    const calls = fakeFetch(t, () => ({ data: [{ name: 'Named pixel', ...(id !== undefined ? { id } : {}) }] }));
    const result = await callTool('list_pixels', { account_id: ACCOUNT, fields: ['name'] }, { permissions: 'read' });
    assertSuccess(result);
    assert.equal(calls[0].url.searchParams.get('fields'), 'name');
    assert.match(textOf(result), /### Named pixel/);
    assert.match(textOf(result), /solicite o campo id/);
    assert.doesNotMatch(textOf(result), /"pixel_id"|"promoted_object"/);
  });
}

test('pixel usage can use a valid ID from a later returned entity', async t => {
  fakeFetch(t, () => ({ data: [{ name: 'No ID returned' }, { id: '600002', name: 'Usable pixel' }] }));
  const result = await callTool('list_pixels', { account_id: ACCOUNT, fields: ['id', 'name'] }, { permissions: 'read' });
  assertSuccess(result);
  assert.match(textOf(result), /"pixel_id": "600002"/);
  assert.doesNotMatch(textOf(result), /solicite o campo id/);
});

for (const linkage of [{}, { instagram_business_account: null, connected_instagram_account: null }]) {
  test(`Instagram does not claim a missing link from ${JSON.stringify(linkage)}`, async t => {
    const calls = fakeFetch(t, () => ({ id: '300001', ...linkage, category: 'Page category' }));
    const fields = ['id', ...Object.keys(linkage), 'category'];
    const result = await callTool('get_instagram_account', { page_id: '300001', fields }, { permissions: 'read' });
    assertSuccess(result);
    assert.equal(calls[0].url.searchParams.get('fields'), fields.join(','));
    assert.match(textOf(result), /não comprova ausência de vínculo/);
    assert.match(textOf(result), /Page category/);
    assert.doesNotMatch(textOf(result), /Nenhuma conta do Instagram vinculada|Conecte a conta/);
    if (Object.keys(linkage).length) assert.match(textOf(result), /instagram_business_account:\*\* null/);
  });
}

test('Instagram preserves linked account details when an ID is returned', async t => {
  fakeFetch(t, () => ({ id: '300001', instagram_business_account: { id: '700001', username: 'actual_username', followers_count: 0 } }));
  const result = await callTool('get_instagram_account', { page_id: '300001', fields: ['id', 'instagram_business_account{id,username,followers_count}'] }, { permissions: 'read' });
  assertSuccess(result);
  assert.match(textOf(result), /Instagram ID:\*\* 700001/);
  assert.match(textOf(result), /actual_username/);
  assert.match(textOf(result), /"followers_count": 0/);
});

for (const [name, idKey, title] of [['get_ad', 'ad_id', 'Anúncio'], ['get_adset', 'adset_id', 'Ad Set'], ['get_creative', 'creative_id', 'Criativo'], ['get_campaign', 'campaign_id', 'Campanha'], ['get_value_rule_set', 'value_rule_set_id', 'Value Rule Set']]) {
  test(`${name} preserves explicit nulls and falls back to ID`, async t => {
    fakeFetch(t, () => ({ id: '500001', name: null, issues_info: null, enabled: false, budget_remaining: 0 }));
    const result = await callTool(name, { [idKey]: '500001', fields: ['id', 'name', 'issues_info', 'enabled', 'budget_remaining'] }, { permissions: 'read' });
    assertSuccess(result);
    assert.ok(textOf(result).includes(`# ${title}: 500001`));
    assert.match(textOf(result), /name:\*\* null/);
    assert.match(textOf(result), /issues_info:\*\* null/);
    assert.match(textOf(result), /enabled:\*\* false/);
    assert.match(textOf(result), /budget_remaining:\*\* 0/);
  });
}

const secretKeys = ['access_token', 'refresh_token', 'appsecret_proof', 'client_secret', 'password', 'user_token', 'Meta.user_token', 'instagram_boost_post_access_token', 'facebook_boost_post_access_token'];
for (const name of ['list_facebook_pages', 'list_ads', 'get_ad', 'get_instagram_account']) {
  test(`${name} hides secrets by key before formatting fields and nested arrays`, async t => {
    const secrets = Object.fromEntries(secretKeys.map((key, index) => [key, `fake-secret-${index}-never-an-auth-token`]));
    const record = { id: '500001', name: 'Safe name', ...secrets, nested: [{ ...secrets, visible: 'Keep nested data', empty: null, count: 0, enabled: false }] };
    fakeFetch(t, () => name.startsWith('list_') ? { data: [record] } : record);
    const args = name === 'list_ads' ? { account_id: ACCOUNT } : name === 'get_ad' ? { ad_id: '500001' } : name === 'get_instagram_account' ? { page_id: '500001' } : {};
    const result = await callTool(name, { ...args, fields: Object.keys(record) }, { permissions: 'read' });
    assertSuccess(result);
    const output = JSON.stringify(result);
    for (const secret of Object.values(secrets)) assert.ok(!output.includes(secret), 'Provider token must never appear in an MCP response');
    assert.match(textOf(result), /Keep nested data/);
    assert.match(textOf(result), /\[redacted\]/);
    assert.doesNotMatch(output, /offline-request-token-never-valid/);
  });
}

test('tiny nonzero monetary values stay nonzero while ordinary money retains two decimals', async t => {
  fakeFetch(t, () => ({ data: [{
    spend: '12.3', cpc: '0.0041666667', cpm: '-0.00042',
    actions: [{ action_type: 'link_click', value: '240', '7d_click': '240' }],
    cost_per_action_type: [{ action_type: 'link_click', value: '0.0041666667', '7d_click': '0.00042', '1d_click': '0', incrementality: '1.236' }],
  }] }));
  const result = await callTool('get_account_insights', {
    account_id: ACCOUNT, fields: ['spend', 'cpc', 'cpm', 'actions', 'cost_per_action_type'], action_attribution_windows: ['7d_click'],
  }, { permissions: 'read' });
  assertSuccess(result);
  assert.match(textOf(result), /Gasto:\*\* 12\.30/);
  assert.match(textOf(result), /CPC:\*\* 0\.0041666667/);
  assert.match(textOf(result), /CPM:\*\* -0\.00042/);
  assert.match(textOf(result), /CPA Total:\*\* 0\.0041666667/);
  assert.match(textOf(result), /CPA 7d click:\*\* 0\.00042/);
  assert.match(textOf(result), /CPA 1d click:\*\* 0\.00/);
  assert.match(textOf(result), /CPA Incremental:\*\* 1\.24/);
});
