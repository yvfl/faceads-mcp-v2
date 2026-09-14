import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT, TOKEN, apiTools, callTool, fakeFetch, textOf, assertSuccess,
} from '../helpers/offline.mjs';

const cases = [
  { name: 'get_account_insights', args: { account_id: ACCOUNT }, object: ACCOUNT, levels: ['account', 'campaign', 'adset', 'ad'] },
  { name: 'get_campaign_insights', args: { campaign_id: '200001' }, object: '200001', levels: ['campaign', 'adset', 'ad'] },
  { name: 'get_adset_insights', args: { adset_id: '400001' }, object: '400001', levels: ['adset', 'ad'] },
  { name: 'get_ad_insights', args: { ad_id: '500001' }, object: '500001', levels: ['ad'] },
];
const readGrant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };
const query = {
  fields: ['impressions', 'spend', 'actions', 'cost_per_action_type'],
  date_preset: 'last_7d',
  time_range: { since: '2026-09-01', until: '2026-09-07' },
  breakdowns: ['age', 'gender'],
  action_breakdowns: ['action_type', 'action_device'],
  level: 'ad',
  time_increment: 1,
  filtering: [{ field: 'ad.effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }],
  sort: ['spend_descending'],
  limit: 2,
  action_attribution_windows: ['1d_click', '7d_click'],
  use_unified_attribution_setting: false,
};

function expectedParams(args, after) {
  return {
    fields: args.fields.join(','),
    date_preset: args.date_preset,
    time_range: JSON.stringify(args.time_range),
    breakdowns: args.breakdowns.join(','),
    action_breakdowns: args.action_breakdowns.join(','),
    level: args.level,
    time_increment: String(args.time_increment),
    filtering: JSON.stringify(args.filtering),
    sort: JSON.stringify(args.sort),
    limit: String(args.limit),
    action_attribution_windows: JSON.stringify(args.action_attribution_windows),
    use_unified_attribution_setting: String(args.use_unified_attribution_setting),
    ...(after === undefined ? {} : { after }),
  };
}

function requestParams(call) {
  return Object.fromEntries([...call.url.searchParams].filter(([key]) => key !== 'access_token'));
}

function continuationOf(result) {
  const block = result.content.find(({ text = '' }) => text.includes('chame next.tool'));
  assert.ok(block, 'A partial page must provide an explicit typed continuation');
  const entries = JSON.parse(block.text.slice(block.text.indexOf('\n') + 1));
  assert.equal(entries.length, 1);
  return entries[0];
}

for (const scenario of cases) {
  const { name, args, object, levels } = scenario;

  test(`${name} advertises every supported insights query input`, () => {
    const tool = apiTools.find((entry) => entry.name === name);
    for (const key of ['breakdowns', 'action_breakdowns', 'level', 'time_increment', 'filtering', 'sort', 'limit', 'after']) {
      assert.ok(tool.inputSchema.properties[key], `${name} does not advertise ${key}`);
      assert.ok(!(tool.inputSchema.required ?? []).includes(key), `${key} must remain optional`);
    }
  });

  test(`${name} sends the complete query to its Graph endpoint without losing existing inputs`, async (t) => {
    const calls = fakeFetch(t);
    const result = await callTool(name, { ...args, ...query, after: 'cursor +/=' });
    assertSuccess(result);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].path, `/v26.0/${object}/insights`);
    assert.deepEqual(requestParams(calls[0]), expectedParams(query, 'cursor +/='));
    assert.equal(calls[0].url.searchParams.get('access_token'), TOKEN);
  });

  test(`${name} accepts only its entity level and descendants`, async (t) => {
    const calls = fakeFetch(t);
    for (const level of levels) {
      assertSuccess(await callTool(name, { ...args, level }));
      assert.equal(calls.at(-1).url.searchParams.get('level'), level);
    }
    const count = calls.length;
    for (const level of ['account', 'campaign', 'adset', 'ad', 'creative', ''].filter((value) => !levels.includes(value))) {
      const result = await callTool(name, { ...args, level });
      assert.equal(result.isError, true, `Invalid level ${JSON.stringify(level)} was accepted`);
    }
    assert.equal(calls.length, count, 'Invalid levels must be rejected before fetching');
  });

  test(`${name} preserves opaque cursors even when they resemble JSON or booleans`, async (t) => {
    const calls = fakeFetch(t);
    for (const after of ['true', 'false', '[]', '{"next":1}', 'null', '0', 'cursor +/=']) {
      assertSuccess(await callTool(name, { ...args, after, use_unified_attribution_setting: 'false' }));
      assert.equal(calls.at(-1).url.searchParams.get('after'), after);
      assert.equal(calls.at(-1).url.searchParams.get('use_unified_attribution_setting'), 'false');
    }
  });

  test(`${name} accepts documented time increments and a single action sort`, async (t) => {
    const calls = fakeFetch(t);
    for (const time_increment of ['all_days', 'monthly', 1, 90]) {
      assertSuccess(await callTool(name, { ...args, time_increment, sort: ['actions:link_click_ascending'] }));
      assert.equal(calls.at(-1).url.searchParams.get('time_increment'), String(time_increment));
      assert.deepEqual(JSON.parse(calls.at(-1).url.searchParams.get('sort')), ['actions:link_click_ascending']);
    }
  });

  test(`${name} rejects malformed query controls before any Graph request`, async (t) => {
    const calls = fakeFetch(t);
    const invalid = [
      { time_increment: 0 }, { time_increment: 91 }, { time_increment: 1.5 },
      { time_increment: 'weekly' }, { time_increment: '7' },
      { sort: ['spend_descending', 'impressions_ascending'] }, { sort: 'spend_descending' },
      { limit: 0 }, { limit: -1 }, { limit: 1.5 },
      { after: '' }, { after: 12 },
      { breakdowns: 'age' }, { breakdowns: [12] },
      { action_breakdowns: 'action_device' }, { action_breakdowns: [true] },
      { filtering: '[invalid]' }, { filtering: [{ operator: 'IN', value: ['ACTIVE'] }] },
      { filtering: [{ field: 'spend', value: 1 }] },
      { filtering: [{ field: 'spend', operator: 'GREATER_THAN' }] },
      { fields: ['spend'], action_breakdowns: ['action_device'] },
    ];
    for (const controls of invalid) {
      const result = await callTool(name, { ...args, ...controls });
      assert.equal(result.isError, true, `Invalid controls accepted: ${JSON.stringify(controls)}`);
    }
    assert.equal(calls.length, 0);
  });

  test(`${name} supplies actions for action breakdowns only when fields are implicit`, async (t) => {
    const calls = fakeFetch(t);
    assertSuccess(await callTool(name, { ...args, action_breakdowns: ['action_device'] }));
    const defaults = calls[0].url.searchParams.get('fields').split(',');
    assert.ok(defaults.includes('actions'));
    for (const field of ['impressions', 'clicks', 'spend', 'reach', 'cpc', 'cpm', 'ctr']) assert.ok(defaults.includes(field));
    assert.equal(calls[0].url.searchParams.get('action_breakdowns'), 'action_device');

    assertSuccess(await callTool(name, { ...args, fields: ['spend'], action_breakdowns: [] }));
    assert.equal(calls[1].url.searchParams.get('fields'), 'spend');
    assertSuccess(await callTool(name, { ...args, fields: ['actions'], action_breakdowns: ['action_device'] }));
    assert.equal(calls[2].url.searchParams.get('fields'), 'actions');
    assertSuccess(await callTool(name, args));
    assert.deepEqual(calls[3].url.searchParams.get('fields').split(','), ['impressions', 'clicks', 'spend', 'reach', 'cpc', 'cpm', 'ctr']);
  });

  test(`${name} preserves rows, nested action dimensions, numeric zeros and unknown windows without an attribution flag`, async (t) => {
    fakeFetch(t, () => ({ data: [
      {
        age: '18-24', gender: 'female', spend: '12.34', impressions: '100',
        date_start: '2026-09-01', date_stop: '2026-09-01',
        actions: [
          { action_type: 'purchase', action_device: 'iphone', action_destination: 'website', value: '0', '1d_click': 0, future_click: '17' },
          { action_type: 'purchase', action_device: 'android', action_destination: 'app', value: '5' },
        ],
        cost_per_action_type: [
          { action_type: 'purchase', action_device: 'desktop', action_destination: 'messenger', value: '0', '1d_click': 0, future_click: '19' },
          { action_type: 'purchase', action_device: 'ipad', value: '2.468' },
        ],
      },
      { age: '25-34', gender: 'male', spend: '56.78', impressions: '200', date_start: '2026-09-02', date_stop: '2026-09-02' },
    ] }));
    const result = await callTool(name, {
      ...args, fields: ['spend', 'impressions', 'actions', 'cost_per_action_type'],
      breakdowns: ['age', 'gender'], action_breakdowns: ['action_device'], time_increment: 1,
    });
    assertSuccess(result);
    const output = textOf(result);
    for (const value of ['18-24', '25-34', 'female', 'male', '12.34', '56.78', '2026-09-01', '2026-09-02']) assert.ok(output.includes(value), `Missing returned dimension or metric: ${value}`);
    const actions = output.split('## Conversões (Actions)')[1]?.split('## Custo por Conversão (CPA)')[0];
    const costs = output.split('## Custo por Conversão (CPA)')[1]?.split('### Resultado 2')[0];
    assert.ok(actions, 'Missing actions section');
    assert.ok(costs, 'Missing CPA section');
    for (const value of ['action_device', 'iphone', 'android', 'action_destination', 'website', 'app']) assert.ok(actions.includes(value), `Missing action dimension ${value}`);
    for (const value of ['action_device', 'desktop', 'ipad', 'action_destination', 'messenger']) assert.ok(costs.includes(value), `Missing CPA dimension ${value}`);
    const actionEntries = actions.split(/^- \*\*purchase:\*\* /m).slice(1);
    assert.equal(actionEntries.length, 2);
    assert.match(actionEntries[0], /^0\n[\s\S]*action_device[^\n]*iphone\n[\s\S]*action_destination[^\n]*website/);
    assert.doesNotMatch(actionEntries[0], /android|\*\*action_destination:\*\* app/);
    assert.match(actionEntries[1], /^5\n[\s\S]*action_device[^\n]*android\n[\s\S]*action_destination[^\n]*app/);
    assert.doesNotMatch(actionEntries[1], /iphone|website/);
    const costEntries = costs.split(/^- \*\*CPA purchase:\*\* /m).slice(1);
    assert.equal(costEntries.length, 2);
    assert.match(costEntries[0], /^0\.00\n[\s\S]*action_device[^\n]*desktop\n[\s\S]*action_destination[^\n]*messenger/);
    assert.doesNotMatch(costEntries[0], /ipad/);
    assert.match(costEntries[1], /^2\.47\n[\s\S]*action_device[^\n]*ipad/);
    assert.doesNotMatch(costEntries[1], /desktop|messenger/);
    for (const section of [actions, costs]) assert.match(section, /1d[_ ]click[^\n]*\b0\b/);
    assert.match(actions, /future_click[^\n]*17/);
    assert.match(costs, /future_click[^\n]*19/);
    assert.doesNotMatch(output, /R\$/);
  });

  test(`${name} preserves returned windows when an action or CPA has no total value`, async (t) => {
    fakeFetch(t, () => ({ data: [{
      actions: [{ action_type: 'lead', action_device: 'iphone', '7d_click': 0, future_view: '23' }],
      cost_per_action_type: [{ action_type: 'lead', action_device: 'android', '7d_click': 0, future_view: '29' }],
    }] }));
    const result = await callTool(name, { ...args, fields: ['actions', 'cost_per_action_type'], action_attribution_windows: ['7d_click'] });
    assertSuccess(result);
    assert.match(textOf(result), /future_view[^\n]*23/);
    assert.match(textOf(result), /future_view[^\n]*29/);
    assert.equal((textOf(result).match(/7d[_ ]click[^\n]*\b0\b/g) ?? []).length, 2);
  });

  test(`${name} continues explicitly through execute_api and typed after with the same query and read grant`, async (t) => {
    const cursor = 'next +/=';
    const calls = fakeFetch(t, (call) => {
      if (!call.path.endsWith('/insights')) return { id: object, account_id: ACCOUNT.slice(4) };
      if (call.url.searchParams.has('after')) return { data: [{ age: '25-34', spend: '22' }] };
      return { data: [{ age: '18-24', spend: '11' }], paging: {
        // Continuation must come from the authorized request plus opaque cursor,
        // never by blindly following the provider's credential-bearing URL.
        next: 'https://graph.facebook.com/v26.0/act_999999/insights?access_token=offline-paging-secret&after=untrusted-url-cursor',
        cursors: { after: cursor },
      } };
    });
    const first = await callTool(name, { ...args, ...query, pagination_mode: 'page' }, readGrant);
    assertSuccess(first);
    assert.equal(calls.filter((call) => call.path.endsWith('/insights')).length, 1, 'The first call must not auto-fetch another page');
    assert.match(textOf(first), /resultados acima são parciais/);
    assert.doesNotMatch(textOf(first), /offline-paging-secret|act_999999|untrusted-url-cursor/);
    const continuation = continuationOf(first);
    assert.deepEqual({ endpoint: continuation.endpoint, params: continuation.params }, { endpoint: `${object}/insights`, params: expectedParams(query, cursor) });
    assert.equal(continuation.tool, name);
    assert.deepEqual(continuation.arguments, { ...args, ...query, after: cursor, pagination_mode: 'page', max_pages: 10 });

    const rawNext = await callTool('execute_api', { method: 'GET', endpoint: continuation.endpoint, params: continuation.params }, readGrant);
    assertSuccess(rawNext);
    assert.match(textOf(rawNext), /25-34/);
    const typedNext = await callTool(continuation.tool, continuation.arguments, readGrant);
    assertSuccess(typedNext);
    assert.match(textOf(typedNext), /25-34/);
    const pages = calls.filter((call) => call.path.endsWith('/insights'));
    assert.equal(pages.length, 3);
    assert.deepEqual(requestParams(pages[1]), expectedParams(query, cursor));
    assert.deepEqual(requestParams(pages[2]), expectedParams(query, cursor));
    assert.ok(calls.every((call) => call.method === 'GET'));
    assert.ok(pages.every((call) => call.path === `/v26.0/${object}/insights`));
    assert.ok(pages.every((call) => call.url.searchParams.get('access_token') === TOKEN));
    assert.doesNotMatch(textOf(typedNext), /Há mais páginas/);
  });
}

test('insights filtering preserves JSON values instead of coercing arrays, numbers, booleans, objects or null to text', async (t) => {
  const calls = fakeFetch(t);
  const values = [['ACTIVE', 'PAUSED'], 0, false, 'ação & teste', { nested: [0, false, null] }, null];
  for (const scenario of cases) {
    for (const value of values) {
      const filtering = [{ field: 'provider_field', operator: 'EQUAL', value }];
      assertSuccess(await callTool(scenario.name, { ...scenario.args, filtering }));
      assert.deepEqual(JSON.parse(calls.at(-1).url.searchParams.get('filtering')), filtering);
    }
    const filtering = [{ field: 'ad.effective_status', operator: 'IN', value: ['ACTIVE'] }];
    assertSuccess(await callTool(scenario.name, { ...scenario.args, filtering: JSON.stringify(filtering) }));
    assert.deepEqual(JSON.parse(calls.at(-1).url.searchParams.get('filtering')), filtering, 'Preserve existing MCP JSON-string coercion');
  }
});

test('CPA values require finite numbers or nonempty numeric strings; invalid values are never measured zero', async (t) => {
  let value;
  fakeFetch(t, () => ({ data: [{ cost_per_action_type: [{ action_type: 'purchase', value, '7d_click': value }] }] }));
  for (const scenario of cases) {
    for (const attribution of [false, true]) {
      for (const sample of [null, '', '   ', false, true, [], [1], {}, 'not-a-number', 'Infinity', 0, '0', ' 2.50 ']) {
        value = sample;
        const result = await callTool(scenario.name, {
          ...scenario.args, fields: ['cost_per_action_type'],
          ...(attribution ? { action_attribution_windows: ['7d_click'] } : {}),
        });
        assertSuccess(result);
        const expected = sample === 0 || sample === '0' ? '0.00' : sample === ' 2.50 ' ? '2.50' : 'Não disponível';
        const output = textOf(result);
        assert.ok(output.includes(`**${attribution ? 'CPA Total' : 'CPA purchase'}:** ${expected}`), `Incorrect CPA for ${JSON.stringify(sample)}: ${output}`);
        if (attribution) assert.ok(output.includes(`**CPA 7d click:** ${expected}`));
      }
    }
  }
});

test('incremental percentage requires a measured value while numeric and string zeros remain visible', async (t) => {
  let incremental;
  let total = '10';
  fakeFetch(t, () => ({ data: [{ actions: [{ action_type: 'purchase', value: total, incrementality: incremental }] }] }));
  for (const value of [null, '', '   ', false, true, [], [1], {}, 0, '0']) {
    incremental = value;
    const result = await callTool('get_account_insights', {
      account_id: ACCOUNT, fields: ['actions'], action_attribution_windows: ['incrementality'],
    });
    assertSuccess(result);
    if (value === 0 || value === '0') {
      assert.match(textOf(result), /Incremental[^\n]*0[^\n]*0\.0% do total/);
    } else {
      assert.doesNotMatch(textOf(result), /% do total/, `Unavailable value ${JSON.stringify(value)} must not become a calculated percentage`);
    }
  }
  total = '0';
  incremental = 0;
  const result = await callTool('get_account_insights', {
    account_id: ACCOUNT, fields: ['actions'], action_attribution_windows: ['incrementality'],
  });
  assertSuccess(result);
  assert.match(textOf(result), /Incremental[^\n]*0/);
  assert.doesNotMatch(textOf(result), /% do total/, 'An undefined ratio must not become a calculated zero percentage');
});

test('an insights cursor does not authorize another account for typed or raw continuation', async (t) => {
  const calls = fakeFetch(t);
  for (const [name, args] of [
    ['get_account_insights', { account_id: 'act_999999', ...query, after: 'authorized-cursor' }],
    ['execute_api', { method: 'GET', endpoint: 'act_999999/insights', params: expectedParams(query, 'authorized-cursor') }],
  ]) {
    const result = await callTool(name, args, readGrant);
    assert.equal(result.isError, true);
    assert.match(textOf(result), /conta não autorizada/);
  }
  assert.equal(calls.length, 0, 'An unapproved account must be rejected without fetching');
});

test('object insights continuation rechecks account ownership for typed and raw calls', async (t) => {
  const calls = fakeFetch(t, (call) => {
    // Read-only object access may fall back to shared-audience membership.
    if (call.path === `/v26.0/${ACCOUNT}/customaudiences`) return { data: [] };
    assert.equal(call.path, '/v26.0/999999', 'An unauthorized insights endpoint must never be fetched');
    return { id: '999999', account_id: '999998' };
  });
  for (const scenario of cases.filter(({ object }) => object !== ACCOUNT)) {
    const identity = Object.keys(scenario.args)[0];
    for (const [name, args] of [
      [scenario.name, { [identity]: '999999', ...query, after: 'authorized-cursor' }],
      ['execute_api', { method: 'GET', endpoint: '999999/insights', params: expectedParams(query, 'authorized-cursor') }],
    ]) {
      const result = await callTool(name, args, readGrant);
      assert.equal(result.isError, true);
      assert.match(textOf(result), /conta não autorizada/);
    }
  }
  const objectProbes = calls.filter((call) => call.path === '/v26.0/999999');
  assert.equal(objectProbes.length, 6);
  assert.ok(objectProbes.every((call) => call.url.searchParams.get('fields') === 'id,account_id'));
  assert.ok(calls.every((call) => call.method === 'GET'));
  assert.ok(calls.every((call) => !call.path.endsWith('/insights')));
});
