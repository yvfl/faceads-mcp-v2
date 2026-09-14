import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeGraphRequest, scopeGraphResponse } from '../../dist/auth/account-authorization.js';
import { withAuthContext } from '../../dist/utils/auth-context.js';
const ctx = { accessToken: 'synthetic', permissions: 'readwrite', allowedAccountIds: ['act_100'] };
const run = (fn, changes = {}) => withAuthContext({ ...ctx, ...changes }, fn);
const read = async (endpoint) => {
  if (endpoint === '111') return { id: '111', account_id: '100' };
  if (endpoint === '222') return { id: '222', account_id: '200' };
  if (endpoint === 'act_100/promote_pages') return { data: [{ id: '333' }] };
  return { data: [] };
};
test('allows authorized account/object and denies a sibling account/object', async () => {
  await run(() => authorizeGraphRequest('act_100/campaigns', 'GET', {}, read));
  await run(() => authorizeGraphRequest('111', 'POST', { name: 'valid' }, read));
  for (const endpoint of ['act_200/campaigns', '222', '222/insights', '999']) await assert.rejects(run(() => authorizeGraphRequest(endpoint, 'GET', {}, read)), /negado/);
});
test('every mutating method is denied for read-only remote grants', async () => {
  for (const verb of ['POST', 'DELETE', 'PATCH']) await assert.rejects(run(() => authorizeGraphRequest('111', verb, {}, read), { permissions: 'read' }), /apenas leitura/);
});
test('missing account selection fails closed, stdio remains environment-scoped', async () => {
  await assert.rejects(run(() => authorizeGraphRequest('111', 'GET', {}, read), { allowedAccountIds: [] }), /nenhuma conta/);
  await withAuthContext({ accessToken: 'synthetic', permissions: 'readwrite' }, () => authorizeGraphRequest('act_200', 'GET', {}, read));
});
test('raw endpoint/query/field escapes and method impersonation are denied', async () => {
  for (const endpoint of ['https://evil.example', 'act_100/../act_200', 'act_100?ids=222', 'act_100%2fcampaigns', '/act_100', 'act_100/campaigns/222']) await assert.rejects(run(() => authorizeGraphRequest(endpoint, 'GET', {}, read)), /negado/);
  for (const key of ['method', 'http_method', 'batch', 'access_token', 'appsecret_proof', 'relative_url', 'ids']) await assert.rejects(run(() => authorizeGraphRequest('act_100', 'GET', { [key]: '222' }, read)), /não pode/);
  await assert.rejects(run(() => authorizeGraphRequest('act_100', 'GET', { fields: 'campaigns{account{id}}' }, read)), /expansão/);
});
test('nested creative, targeting, campaign and ad-set references cannot escape account consent', async () => {
  for (const params of [{ origin_audience_id: '222' }, { object_story_id: '222_888' }, { campaign_id: '222' }, { adset_id: '222' }, { creative: { id: '222' } }, { creative: '{"id":"222"}' }, { targeting: { custom_audiences: [{ id: '222' }] } }, { targeting: JSON.stringify({ excluded_custom_audiences: [{ id: '222' }] }) }, { account_id: '200' }]) await assert.rejects(run(() => authorizeGraphRequest('act_100/ads', 'POST', params, read)), /não autorizada/);
  await run(() => authorizeGraphRequest('act_100/ads', 'POST', { creative: { id: '111' }, adset_id: '111' }, read));
});
test('Page membership is verified through an approved account and value rule deletion stays usable', async () => {
  await run(() => authorizeGraphRequest('333', 'GET', {}, read));
  await run(() => authorizeGraphRequest('111/delete_rule_set', 'POST', {}, read));
});
test('discovery filters accounts/Pages and strips token-bearing paging URLs', async () => {
  const result = await run(() => scopeGraphResponse('me/adaccounts', { data: [{ id: 'act_100' }, { id: 'act_200' }], paging: { next: 'https://graph.facebook.com/?access_token=secret', cursors: { after: 'cursor' } } }, read));
  assert.deepEqual(result, { data: [{ id: 'act_100' }], paging: { cursors: { after: 'cursor' } } });
  assert.deepEqual(await run(() => scopeGraphResponse('me/accounts', { data: [{ id: '333' }, { id: '444' }] }, read)), { data: [{ id: '333' }] });
});
test('parallel requests retain their own authorization context', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => run(async () => {
    await new Promise(resolve => setTimeout(resolve, i % 3));
    await authorizeGraphRequest(`act_${i}/campaigns`, 'GET', {}, read);
    await assert.rejects(authorizeGraphRequest(`act_${i+1000}`, 'GET', {}, read));
  }, { allowedAccountIds: [`act_${i}`] })));
});

test('schedule mutation validates its authorized parent and actual membership', async () => {
  const scheduleRead = async (path, params) => path === '111/budget_schedules' ? { data: [{ id: '555' }] } : read(path, params);
  await run(() => authorizeGraphRequest('555', 'POST', {}, scheduleRead, '111'));
  await assert.rejects(run(() => authorizeGraphRequest('666', 'DELETE', {}, scheduleRead, '111')), /agendamento/);
  await assert.rejects(run(() => authorizeGraphRequest('555', 'DELETE', {}, scheduleRead, '222')), /não autorizada/);
  await assert.rejects(run(() => authorizeGraphRequest('555', 'POST', {}, scheduleRead)), /não foi possível/);
});

test('JSON whitespace and nested rule pixel sources cannot bypass reference checks', async () => {
  for (const gap of [' ', '\n', '\t', ' \r\n ']) {
    for (const params of [{ creative: gap + '{"id":"222"}' }, { targeting: gap + '{"custom_audiences":[{"id":"222"}]}' }, { rule: gap + '{"inclusions":{"rules":[{"event_sources":[{"id":"222","type":"pixel"}]}]}}' }]) await assert.rejects(run(() => authorizeGraphRequest('act_100/ads', 'POST', params, read)), /não autorizada/);
  }
});
test('shared audience may be read/referenced through membership, never mutated in its owner account', async () => {
  const sharedRead = async (path, params) => path === 'act_100/customaudiences' ? { data: [{ id: '222' }] } : read(path, params);
  await run(() => authorizeGraphRequest('act_100/adsets', 'POST', { targeting: { custom_audiences: [{ id: '222' }] } }, sharedRead));
  await run(() => authorizeGraphRequest('222', 'GET', {}, sharedRead));
  await assert.rejects(run(() => authorizeGraphRequest('222', 'POST', { name: 'forbidden' }, sharedRead)), /não autorizada/);
  for (const params of [{ creative: { id: '222' } }, { targeting: {custom_audiences: [{id:'222'}]}, creative:{id:'222'} }, {creative:{id:'222'}, targeting:{custom_audiences:[{id:'222'}]}}]) await assert.rejects(run(() => authorizeGraphRequest('act_100/ads', 'POST', params, sharedRead)), /não autorizada/);
});
test('unprovable object has a bounded global probe budget', async () => {
  let calls = 0;
  const endlessRead = async (path, params) => { calls++; return { data: [], paging: { next: 'unused', cursors: { after: String(Number(params.after || 0) + 1) } } }; };
  await assert.rejects(run(() => authorizeGraphRequest('999', 'GET', {}, endlessRead), { allowedAccountIds: Array.from({length:100},(_, i)=>`act_${i}`) }), /Limite de verificação/);
  assert.equal(calls, 60);
});
