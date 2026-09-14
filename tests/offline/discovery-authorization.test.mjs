import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, callTool, fakeFetch, jsonResponse, textOf } from '../helpers/offline.mjs';

const grant = { permissions: 'read', allowedAccountIds: [ACCOUNT] };
const pages = (...ids) => ({ data: ids.map(id => ({ id, name: `Page ${id}` })) });
const rateLimit = () => jsonResponse({ error: { code: 613, type: 'OAuthException', message: 'provider-secret access_token=provider-secret' } }, 429);
const next = after => ({ next: 'https://untrusted.example/?access_token=provider-secret', cursors: { after } });

function assertInconclusive(result) {
  assert.equal(result.isError, true, textOf(result));
  assert.notEqual(result.structuredContent?.pagination?.complete, true);
  assert.match(textOf(result), /verificação de vínculo/);
  assert.doesNotMatch(textOf(result), /Nenhuma página encontrada|Encontradas 0|provider-secret|untrusted.example/);
}

test('Page discovery does not turn a Meta rate limit in its ownership probe into an empty complete list', async t => {
  const calls = fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333') : rateLimit());
  const result = await callTool('list_facebook_pages', {}, grant);
  assertInconclusive(result);
  assert.match(textOf(result), /613/);
  assert.doesNotMatch(textOf(result), /Page 333/);
  assert.deepEqual(calls.map(call => call.path), ['/v26.0/me/accounts', `/v26.0/${ACCOUNT}/promote_pages`]);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('Page discovery preserves earlier verified rows and reports incomplete when a later ownership check fails', async t => {
  let probes = 0;
  const calls = fakeFetch(t, call => {
    if (call.path.endsWith('/me/accounts')) return call.url.searchParams.has('after') ? pages('444') : { ...pages('333'), paging: next('discovery-2') };
    return ++probes === 1 ? { data: [{ id: '333' }] } : rateLimit();
  });
  const result = await callTool('list_facebook_pages', {}, grant);
  assertInconclusive(result);
  assert.equal(result.structuredContent.pagination.complete, false);
  const collection = result.structuredContent.pagination.collections[0];
  assert.equal(collection.reason, 'page_error');
  assert.equal(collection.pages, 1);
  assert.equal(collection.returned_count, 1);
  assert.match(textOf(result), /Page 333/);
  assert.doesNotMatch(textOf(result), /Page 444/);
  assert.equal(calls.filter(call => call.path.endsWith('/me/accounts')).length, 2);
});

for (const [label, response, expectedProbes] of [
  ['missing cursor', () => ({ data: [], paging: { next: 'opaque' } }), 1],
  ['repeated cursor', () => ({ data: [], paging: next('repeat') }), 2],
  ['nonadjacent cursor cycle', index => ({ data: [], paging: next(index % 2 ? 'a' : 'b') }), 3],
  ['page limit', index => ({ data: [], paging: next(`cursor-${index}`) }), 10],
  ['invalid list payload', () => ({}), 1],
  ['invalid asset identifier', () => ({ data: [{}] }), 1],
]) test(`Page discovery distinguishes incomplete ownership (${label}) from proven absence`, async t => {
  let probes = 0;
  fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333') : response(++probes));
  const result = await callTool('list_facebook_pages', {}, grant);
  assertInconclusive(result);
  assert.equal(probes, expectedProbes);
  assert.doesNotMatch(textOf(result), /Page 333/);
});

test('Page discovery excludes a Page only after a complete negative ownership list', async t => {
  let probes = 0;
  fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333')
    : ++probes === 1 ? { data: [{ id: '999' }], paging: next('ownership-2') } : { data: [] });
  const result = await callTool('list_facebook_pages', {}, grant);
  assert.notEqual(result.isError, true, textOf(result));
  assert.equal(result.structuredContent.pagination.complete, true);
  assert.match(textOf(result), /Nenhuma página encontrada/);
  assert.equal(probes, 2);
});

test('a later approved account can prove Page membership even if another account probe failed', async t => {
  const calls = fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333')
    : call.path.includes('/act_100001/') ? rateLimit() : { data: [{ id: '333' }] });
  const result = await callTool('list_facebook_pages', {}, { ...grant, allowedAccountIds: [ACCOUNT, 'act_200001'] });
  assert.notEqual(result.isError, true, textOf(result));
  assert.equal(result.structuredContent.pagination.complete, true);
  assert.match(textOf(result), /Page 333/);
  assert.equal(calls.length, 3);
  assert.doesNotMatch(textOf(result), /provider-secret/);
});

test('a negative list on another account does not erase an inconclusive ownership check', async t => {
  fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333')
    : call.path.includes('/act_100001/') ? rateLimit() : { data: [] });
  const result = await callTool('list_facebook_pages', {}, { ...grant, allowedAccountIds: [ACCOUNT, 'act_200001'] });
  assertInconclusive(result);
});

test('raw Page discovery uses the same ownership completeness gate', async t => {
  fakeFetch(t, call => call.path.endsWith('/me/accounts') ? pages('333') : rateLimit());
  const result = await callTool('execute_api', { endpoint: 'me/accounts', method: 'GET', params: { fields: 'id,name' } }, grant);
  assertInconclusive(result);
});
