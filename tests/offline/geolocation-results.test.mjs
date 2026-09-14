import test from 'node:test';
import assert from 'node:assert/strict';
import { callTool, fakeFetch, assertSuccess, textOf } from '../helpers/offline.mjs';
import { apiTools } from '../../dist/api-tools.js';

const city = { key: '244379', name: 'Barueri', type: 'city', country_code: 'BR' };
const neighborhood = { key: '2786409', name: 'Alphaville Industrial', type: 'neighborhood', country_code: 'BR' };
const page = (data, after) => ({ data, ...(after ? { paging: { next: 'https://graph.facebook.com/search', cursors: { after } } } : {}) });
const examples = result => [...textOf(result).matchAll(/```json\s*([\s\S]*?)```/g)].map(match => JSON.parse(match[1]).geo_locations);

test('geolocation returns one page of 25 suggestions by default without claiming completeness', async t => {
  const calls = fakeFetch(t, () => page([city, neighborhood], 'next-page'));
  const result = await callTool('search_geolocation', { q: 'Barueri', country_code: 'BR', location_types: ['city'] });
  assertSuccess(result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('limit'), '25');
  assert.equal(calls[0].url.searchParams.get('location_types'), '["city"]');
  assert.equal(result.structuredContent.pagination.complete, false);
  assert.equal(result.structuredContent.pagination.collections[0].reason, 'page_requested');
  assert.match(textOf(result), /Alphaville Industrial/);
  assert.deepEqual(examples(result), [{ cities: [{ key: city.key }] }]);
});

test('explicit geolocation pagination keeps filters and does not stop on repeated result pages', async t => {
  const calls = fakeFetch(t, call => {
    const after = call.url.searchParams.get('after');
    return !after ? page([city], 'page-2') : after === 'page-2' ? page([city], 'page-3') : page([neighborhood]);
  });
  const result = await callTool('search_geolocation', { q: 'Barueri', country_code: 'BR', location_types: ['city'], pagination_mode: 'all', limit: 1 });
  assertSuccess(result);
  assert.equal(calls.length, 3);
  assert.equal(result.structuredContent.pagination.complete, true);
  for (const call of calls) {
    assert.equal(call.url.searchParams.get('q'), 'Barueri');
    assert.equal(call.url.searchParams.get('country_code'), 'BR');
    assert.equal(call.url.searchParams.get('location_types'), '["city"]');
    assert.equal(call.url.searchParams.get('limit'), '1');
  }
  assert.match(textOf(result), /Alphaville Industrial/);
});

test('geolocation continuation forwards the opaque cursor and remains scoped to later pages', async t => {
  const calls = fakeFetch(t, () => page([neighborhood]));
  const result = await callTool('search_geolocation', { q: 'Barueri', after: 'next-page', limit: 3 });
  assertSuccess(result);
  assert.equal(calls[0].url.searchParams.get('after'), 'next-page');
  assert.equal(result.structuredContent.pagination.scope, 'from_cursor');
  assert.equal(result.structuredContent.pagination.complete, false);
});

test('targeting examples use keys from the corresponding geographic type and actual country', async t => {
  fakeFetch(t, () => page([{ key: 'CA', name: 'Canada', type: 'country' }, { key: '460', name: 'São Paulo', type: 'region' }, city]));
  const result = await callTool('search_geolocation', { q: 'Locations' });
  assertSuccess(result);
  assert.deepEqual(examples(result), [{ countries: ['CA'] }, { regions: [{ key: '460' }] }, { cities: [{ key: '244379' }] }]);
});

test('reclassified places remain visible without inventing a city or region mapping', async t => {
  fakeFetch(t, () => page([neighborhood]));
  const result = await callTool('search_geolocation', { q: 'Alphaville', location_types: ['city'] });
  assertSuccess(result);
  assert.match(textOf(result), /2786409.*Alphaville Industrial.*neighborhood/);
  assert.deepEqual(examples(result), []);
});

test('published search schema and description state the page default', () => {
  const tool = apiTools.find(tool => tool.name === 'search_geolocation');
  assert.match(tool.description, /uma página.*padrão/);
  assert.doesNotMatch(tool.description, /Percorre páginas automaticamente/);
  assert.match(tool.inputSchema.properties.pagination_mode.description, /page \(padrão\)/);
});

test('postal-code suggestions are not described as reclassified cities', async t => {
  fakeFetch(t, () => page([{ key: 'BR:06401', name: '06401', type: 'zip', country_code: 'BR' }]));
  const result = await callTool('search_geolocation', { q: '06401', location_types: ['zip'] });
  assertSuccess(result);
  assert.doesNotMatch(textOf(result), /reclassificad/);
  assert.deepEqual(examples(result), []);
});
