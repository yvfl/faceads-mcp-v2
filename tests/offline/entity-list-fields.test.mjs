import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, callTool, fakeFetch, textOf, assertSuccess } from '../helpers/offline.mjs';

const cases = [
  { name: 'list_campaigns', args: { account_id: ACCOUNT }, path: `${ACCOUNT}/campaigns`, known: { objective: 'OUTCOME_TRAFFIC' }, label: 'Objetivo' },
  { name: 'list_adsets', args: { account_id: ACCOUNT }, path: `${ACCOUNT}/adsets`, known: { campaign_id: '200001', daily_budget: 0 }, label: 'Campanha' },
  { name: 'list_ads', args: { account_id: ACCOUNT }, path: `${ACCOUNT}/ads`, known: { adset_id: '400001', effective_status: 'PAUSED' }, label: 'Ad Set' },
  { name: 'list_campaign_ads', args: { campaign_id: '200001' }, path: '200001/ads', known: { adset_id: '400001', effective_status: 'PAUSED' }, label: 'Ad Set' },
];

for (const scenario of cases) {
  test(`${scenario.name} preserves requested fields and nested values across every page`, async t => {
    const rows = [
      {
        id: '500001', ...scenario.known,
        campaign_id: '200001', budget_remaining: 0, is_dynamic_creative: false, issues_info: null,
        adlabels: [{ id: '800001', name: 'Label one' }],
        creative: { id: '600001', object_story_spec: { page_id: '300001', link_data: { message: 'Full creative', child_attachments: [{ link: 'https://example.test/one' }] } } },
      },
      {
        id: '500002', ...scenario.known,
        campaign_id: '200002', budget_remaining: 7, is_dynamic_creative: true, issues_info: [],
        adlabels: [{ id: '800002', name: 'Label two' }],
        creative: { id: '600002', asset_feed_spec: { bodies: [{ text: 'Later page creative' }], additional_data: { enabled: false, count: 0, nullable: null } } },
      },
    ];
    const fields = [...new Set(['id', ...Object.keys(scenario.known), 'campaign_id', 'budget_remaining', 'is_dynamic_creative', 'issues_info', 'adlabels', 'creative{id,object_story_spec,asset_feed_spec}'])];
    const calls = fakeFetch(t, call => call.url.searchParams.has('after')
      ? { data: [rows[1]] }
      : { data: [rows[0]], paging: { next: 'https://graph.facebook.com/next', cursors: { after: 'second-page' } } });

    const result = await callTool(scenario.name, { ...scenario.args, fields, limit: 1 }, { permissions: 'read' });

    assertSuccess(result);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.method, 'GET');
      assert.equal(call.path, `/v26.0/${scenario.path}`);
      assert.equal(call.url.searchParams.get('fields'), fields.join(','));
      assert.equal(call.url.searchParams.get('limit'), '1');
    }
    assert.equal(calls[1].url.searchParams.get('after'), 'second-page');
    assert.equal(result.structuredContent.pagination.complete, true);
    assert.equal(result.structuredContent.pagination.collections[0].pages, 2);
    assert.equal(result.structuredContent.pagination.collections[0].returned_count, 2);

    const output = textOf(result);
    const sections = output.split(/### /).slice(1);
    assert.equal(sections.length, 2);
    for (const [index, row] of rows.entries()) {
      const section = sections[index];
      assert.ok(section.startsWith(`${row.id}\n`));
      assert.equal((section.match(/\*\*ID:\*\*/g) ?? []).length, 1);
      assert.ok(section.includes(`**${scenario.label}:** ${row[Object.keys(scenario.known)[0]]}`));
      assert.ok(section.includes(row.campaign_id));
      assert.ok(section.includes(`**budget_remaining:** ${row.budget_remaining}`));
      assert.ok(section.includes(`**is_dynamic_creative:** ${row.is_dynamic_creative}`));
      assert.ok(section.includes(`**issues_info:** ${JSON.stringify(row.issues_info)}`));
      assert.ok(section.includes(JSON.stringify(row.adlabels)));
      assert.ok(section.includes(JSON.stringify(row.creative)));
      assert.equal((section.match(new RegExp(row.creative.id, 'g')) ?? []).length, 1, 'creative ID is not duplicated');
    }
    assert.doesNotMatch(output, /\*\*Status:\*\*|\*\*name:\*\*|\*\*id:\*\*|N\/A|undefined|\[object Object\]/);
    if (scenario.name === 'list_adsets') assert.match(output, /\*\*Orçamento diário:\*\* 0 \(unidade mínima da moeda da conta\)/);
  });

  test(`${scenario.name} keeps familiar default formatting without repeating known fields`, async t => {
    fakeFetch(t, () => ({ data: [{ id: '500001', name: 'Named entity', status: 'PAUSED', ...scenario.known }] }));

    const result = await callTool(scenario.name, scenario.args, { permissions: 'read' });

    assertSuccess(result);
    const output = textOf(result);
    assert.match(output, /### Named entity\n- \*\*ID:\*\* 500001\n- \*\*Status:\*\* PAUSED/);
    assert.equal((output.match(/Named entity/g) ?? []).length, 1);
    assert.equal((output.match(/\*\*Status:\*\*/g) ?? []).length, 1);
    assert.doesNotMatch(output, /\*\*(name|id|status|objective|adset_id|effective_status):\*\*/);
  });
}

test('explicit nulls and empty nested values remain distinguishable from omitted fields', async t => {
  fakeFetch(t, () => ({ data: [{ id: '500001', status: null, campaign_id: null, daily_budget: null, targeting: {}, adlabels: [] }] }));

  const result = await callTool('list_adsets', {
    account_id: ACCOUNT, fields: ['id', 'status', 'campaign_id', 'daily_budget', 'targeting', 'adlabels'],
  }, { permissions: 'read' });

  assertSuccess(result);
  assert.match(textOf(result), /\*\*Status:\*\* null/);
  assert.match(textOf(result), /\*\*Campanha:\*\* null/);
  assert.match(textOf(result), /\*\*Orçamento diário:\*\* null/);
  assert.match(textOf(result), /\*\*targeting:\*\* \{\}/);
  assert.match(textOf(result), /\*\*adlabels:\*\* \[\]/);
  assert.doesNotMatch(textOf(result), /N\/A|unidade mínima/);
});

test('a page budget stop preserves requested fields and exact continuation parameters', async t => {
  const fields = ['id', 'campaign_id', 'creative{id,object_story_spec}'];
  fakeFetch(t, () => ({
    data: [{ id: '500001', campaign_id: '200001', creative: { id: '600001', object_story_spec: { page_id: '300001' } } }],
    paging: { next: 'https://graph.facebook.com/next', cursors: { after: 'second-page' } },
  }));

  const result = await callTool('list_ads', { account_id: ACCOUNT, fields, limit: 1, max_pages: 1 }, { permissions: 'read' });

  assert.equal(result.isError, true);
  assert.match(textOf(result), /\*\*campaign_id:\*\* 200001/);
  assert.ok(textOf(result).includes('{"id":"600001","object_story_spec":{"page_id":"300001"}}'));
  const progress = result.structuredContent.pagination.collections[0];
  assert.equal(progress.complete, false);
  assert.equal(progress.next.params.fields, fields.join(','));
  assert.equal(progress.next.params.after, 'second-page');
});
