import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apiTools, isApiTool, apiSchemas, callTool, fakeFetch, textOf } from '../helpers/offline.mjs';

const baseline = JSON.parse(readFileSync(new URL('../helpers/main-api-contract.json', import.meta.url), 'utf8'));

test('tool names are unique and the audited main baseline contains 57 tools', () => {
  assert.equal(baseline.tools.length, 57);
  assert.match(baseline.commit, /^[0-9a-f]{40}$/);
  assert.equal(new Set(apiTools.map((tool) => tool.name)).size, apiTools.length);
  assert.equal(isApiTool('not_a_real_tool'), false);
});

for (const previous of baseline.tools) {
  test(`legacy contract preserved: ${previous.name}`, () => {
    const current = apiTools.find((tool) => tool.name === previous.name);
    assert.ok(current, `Tool removed from main ${baseline.commit}`);
    assert.equal(isApiTool(previous.name), true);
    for (const required of current.inputSchema.required ?? []) {
      const v2OwnershipInput = ['update_budget_schedule', 'delete_budget_schedule'].includes(previous.name) && required === 'campaign_id';
      assert.ok(previous.required.includes(required) || v2OwnershipInput, `New mandatory input: ${required}`);
    }
    for (const [name, property] of Object.entries(previous.properties)) {
      const now = current.inputSchema.properties[name];
      assert.ok(now, `Existing input removed: ${name}`);
      // v2 intentionally rejects fractional minor-unit ad set budgets and audience flags.
      const expectedType = previous.name === 'create_adset' && ['daily_budget', 'advantage_audience'].includes(name) ? 'integer' : property.type;
      assert.equal(now.type, expectedType, `Type changed: ${name}`);
      if (property.enum && now.enum) {
        for (const value of property.enum) {
          if (name === 'status' && ['create_campaign', 'create_adset', 'create_ad'].includes(previous.name) && value === 'ACTIVE') continue;
          assert.ok(now.enum.includes(value), `Enum removed: ${name}=${value}`);
        }
      }
    }
  });
}

test('the additional helpers and diagnostics are advertised and recognized by dispatch', () => {
  const additions = apiTools.filter((tool) => !baseline.tools.some((old) => old.name === tool.name));
  assert.deepEqual(additions.map((tool) => tool.name).sort(), [
    'create_click_to_message_ad_set', 'create_partnership_ad_creative', 'create_threads_ad_set', 'diagnose_connection', 'get_operation_status',
  ]);
});

for (const [name, schema] of Object.entries(apiSchemas)) {
  const tool = apiTools.find((entry) => entry.name === name);
  const required = tool?.inputSchema.required ?? [];
  if (required.length === 0) continue;
  test(`missing required input is rejected before any request: ${name}`, async (t) => {
    const calls = fakeFetch(t);
    assert.equal(schema.safeParse({}).success, false);
    const result = await callTool(name, {});
    assert.equal(result.isError, true, textOf(result));
    assert.equal(calls.length, 0);
  });
}
