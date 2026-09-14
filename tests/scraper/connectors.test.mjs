import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeDocPath, docPathToFile } from '../../scripts/lib/docs-http.js';
import { sandbox, canonical, url, markdown, oldDoc, page } from './helpers.mjs';

const connectorPath = '/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server';
const connectorUrl = `https://developers.facebook.com${connectorPath}`;

test('public AI connector paths have a separate namespace with one canonical owner', () => {
  assert.equal(normalizeDocPath(connectorUrl), connectorPath);
  assert.equal(docPathToFile(connectorPath), 'ads-ai-connectors/ads-mcp-server.md');
  assert.equal(docPathToFile(`${connectorPath}/guide`), 'ads-ai-connectors/ads-mcp-server/guide.md');
  assert.equal(normalizeDocPath(canonical('ads-ai-connectors/ads-mcp-server')), connectorPath);
  for (const invalid of [`${connectorPath}/../secrets`, `${connectorPath}/%2e%2e`, `${connectorPath}-outside/../../x`, 'https://mcp.facebook.com/ads']) {
    assert.equal(normalizeDocPath(invalid), null);
  }
});

test('discovery retains connector pages from navigation and from the collection baseline', (t) => {
  const nav = Array.from({ length: 300 }, (_, i) => ({ href: canonical(`nav-${i}`), text: `Page ${i}` }));
  nav.push({ href: connectorPath, text: 'Meta Ads MCP' });
  const box = sandbox(t, { index: { urlToFile: { [`${connectorPath}/guide`]: 'ads-ai-connectors/ads-mcp-server/guide.md' } } });
  const result = box.run('discover-urls.js', [], { [url()]: { contentType: 'text/html', body: JSON.stringify(nav) } });
  assert.equal(result.status, 0, result.stderr);
  const pages = box.json('discovered-urls.json').pages;
  assert.equal(pages.find(p => p.path === connectorPath).file, 'ads-ai-connectors/ads-mcp-server.md');
  assert.equal(pages.find(p => p.path === `${connectorPath}/guide`).origin, 'baseline');
});

test('targeted collection fetches only selected public references and preserves the corpus and full-run cache', (t) => {
  const baseline = { urlToFile: { [canonical('one')]: 'one.md' }, fileToUrl: { 'one.md': canonical('one') } };
  const manifest = { pages: { [canonical('one')]: { status: 'ok', file: 'one.md' } } };
  const box = sandbox(t, { pages: [page('one')], index: baseline, docs: { 'one.md': oldDoc('one') }, manifest, cache: { 'one.md': markdown('One') } });
  const result = box.run('scrape-docs.js', [`--path=${connectorUrl}`, `--path=${connectorPath}`], {
    [connectorUrl]: { body: markdown('Meta Ads MCP', `[Other page](${connectorUrl}/unrequested) and publicly documented connector instructions.`) },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests.map(r => r.url), [connectorUrl]);
  assert.equal(result.requests[0].headers.Accept, 'text/markdown');
  assert.equal(box.read('docs/one.md'), oldDoc('one'));
  assert.deepEqual(box.json('.scrape-cache/manifest.json'), manifest);
  const index = box.json('url-index.json');
  assert.equal(index.urlToFile[canonical('one')], 'one.md');
  assert.equal(index.fileToUrl['ads-ai-connectors/ads-mcp-server.md'], connectorPath);
  assert.equal(index.collection.partial, true);
  assert.equal(index.collection.pruningDisabled, true);
  assert.match(box.read('docs/ads-ai-connectors/ads-mcp-server.md'), /source: "https:\/\/developers.facebook.com\/documentation\/ads-commerce\/ads-ai-connectors\/ads-mcp-server"/);
  assert.match(box.read('docs/ads-ai-connectors/ads-mcp-server.md'), /scraped_at:/);
});

test('targeted resume skips cached selected pages and never replays unselected manifest entries', (t) => {
  const box = sandbox(t, { cache: { 'ads-ai-connectors/ads-mcp-server.md': markdown('Meta Ads MCP'), 'one.md': markdown('One') } });
  fs.writeFileSync(path.join(box.dir, '.scrape-cache/targeted-manifest.json'), JSON.stringify({ pages: {
    [connectorPath]: { status: 'ok', file: 'ads-ai-connectors/ads-mcp-server.md' },
    [canonical('one')]: { status: 'ok', file: 'one.md' },
  } }));
  const result = box.run('scrape-docs.js', ['--resume', `--path=${connectorPath}`]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests, []);
  assert.equal(box.exists('docs/one.md'), false);
  assert.deepEqual(Object.keys(box.json('.scrape-cache/targeted-manifest.json').pages), [connectorPath]);
});

test('targeted collection rejects an authenticated endpoint before any network or index mutation', (t) => {
  const box = sandbox(t, { pages: [page('one')] });
  const result = box.run('scrape-docs.js', ['--path=https://mcp.facebook.com/ads']);
  assert.notEqual(result.status, 0);
  assert.equal(result.requests.length, 0);
  assert.equal(box.exists('url-index.json'), false);
});
