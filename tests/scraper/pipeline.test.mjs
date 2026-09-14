import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDocPath, docPathToFile, decodeEntities, fetchWithLimit, fetchWithRetry,
} from '../../scripts/lib/docs-http.js';
import { sandbox, canonical, url, markdown, oldDoc, page, ORIGIN } from './helpers.mjs';

test('normalizes legacy Marketing API URLs and rejects paths outside the collection', () => {
  assert.equal(normalizeDocPath(`${ORIGIN}/docs/marketing-api/reference/ad-account/?locale=en_US#fields`), canonical('reference/ad-account'));
  assert.equal(docPathToFile(canonical()), 'index.md');
  assert.equal(docPathToFile(canonical('reference/ad-account')), 'reference/ad-account.md');
  for (const input of ['https://example.test/docs/marketing-api', '/docs/graph-api', canonical('../secret'), null]) {
    assert.equal(normalizeDocPath(input), null);
  }
  assert.equal(docPathToFile(canonical('reference//ad-account')), null);
});

test('decodes API examples once and preserves invalid Unicode entities', () => {
  assert.equal(decodeEntities('&lt;ID&gt; &quot;value&quot; &#123; &#x1F600; &amp;lt;'), '<ID> "value" { 😀 &lt;');
  assert.equal(decodeEntities('&#0; &#xD800; &#x110000; &unknown;'), '&#0; &#xD800; &#x110000; &unknown;');
});

test('HTTP collector sends markdown negotiation, retries transient errors, and does not retry 404', async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.equal(init.headers.Accept, 'text/markdown');
    assert.equal(init.headers['User-Agent'], 'Mozilla/5.0');
    assert.equal(init.redirect, 'follow');
    return new Response('body', { status: [429, 500, 200][calls - 1], headers: { 'content-type': 'text/markdown' } });
  };
  const response = await fetchWithRetry('https://fixture.test/doc', { accept: 'text/markdown', backoffMs: 0 });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('gone', { status: 404 }); };
  assert.equal((await fetchWithRetry('https://fixture.test/gone', { backoffMs: 0 })).status, 404);
  assert.equal(calls, 1);
});

test('HTTP collector aborts an unresponsive request', async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('fixture aborted')), { once: true });
  });
  await assert.rejects(fetchWithLimit('https://fixture.test/stuck', { timeoutMs: 5 }), /fixture aborted/);
});

test('discovery combines official navigation with prior edges and unavailable pages', (t) => {
  const nav = Array.from({ length: 300 }, (_, i) => ({ href: canonical(`nav-${i}`), text: `Page ${i}` }));
  nav.push(nav[0], { href: '/documentation/other-product', text: 'Not Marketing' });
  const box = sandbox(t, { index: {
    urlToFile: { '/docs/marketing-api/reference/edge': 'reference/edge.md' },
    unavailable: [{ path: canonical('reference/retry') }],
  } });
  const result = box.run('discover-urls.js', [], { [url()]: { contentType: 'text/html', body: JSON.stringify(nav) } });
  assert.equal(result.status, 0, result.stderr);
  const discovered = box.json('discovered-urls.json');
  assert.equal(discovered.counts.nav, 300);
  assert.equal(discovered.counts.total, 302);
  assert.ok(discovered.pages.some((entry) => entry.path === canonical('reference/edge') && entry.origin === 'baseline'));
  assert.ok(discovered.pages.some((entry) => entry.path === canonical('reference/retry')));
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].headers.Accept, 'text/html');
});

test('discovery refuses truncated navigation without overwriting the previous discovery', (t) => {
  const box = sandbox(t, { pages: [page('preserved')] });
  const result = box.run('discover-urls.js', [], { [url()]: { contentType: 'text/html', body: '[]' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mínimo esperado/);
  assert.equal(box.json('discovered-urls.json').pages[0].file, 'preserved.md');
});

test('scraping rewrites local links, expands missing edges, and keeps both index directions consistent', (t) => {
  const box = sandbox(t, { pages: [page('reference/seed')] });
  const result = box.run('scrape-docs.js', [], {
    [url('reference/seed')]: { body: markdown('Seed', `[Edge](${url('reference/edge')}#fields) and &lt;ID&gt; with enough text to retain this page.`) },
    [url('reference/edge')]: { body: markdown('Edge', '[External](/docs/graph-api) reference content with sufficient descriptive detail.') },
  });
  assert.equal(result.status, 0, result.stderr);
  const index = box.json('url-index.json');
  assert.equal(index.stats.totalFiles, 2);
  for (const [source, file] of Object.entries(index.urlToFile)) {
    assert.equal(index.fileToUrl[file], source);
    assert.ok(box.exists(`docs/${file}`));
  }
  assert.match(box.read('docs/reference/seed.md'), /\]\(reference\/edge\.md#fields\)/);
  assert.match(box.read('docs/reference/seed.md'), /<ID>/);
  assert.match(box.read('docs/reference/edge.md'), /https:\/\/developers\.facebook\.com\/docs\/graph-api/);
});

test('pruning removes obsolete scraped files while preserving curated and explicitly stale files', (t) => {
  const names = ['one', 'two', 'three'];
  const box = sandbox(t, { pages: names.map(page), docs: {
    'obsolete.md': oldDoc('obsolete'),
    'stale.md': oldDoc('stale').replace('---\n\n', 'stale: true\n---\n\n'),
    'AGENTS.md': '# Curated local instructions\n',
  } });
  const result = box.run('scrape-docs.js', ['--no-expand'], Object.fromEntries(names.map((name) => [url(name), { body: markdown(name) }])));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.exists('docs/obsolete.md'), false);
  assert.equal(box.exists('docs/stale.md'), true);
  assert.equal(box.exists('docs/AGENTS.md'), true);
  assert.deepEqual(box.json('scrape-report.json').removed, ['obsolete.md']);
});

test('partial scraping leaves existing documents untouched outside the requested limit', (t) => {
  const box = sandbox(t, { pages: [page('one'), page('two')], docs: { 'two.md': oldDoc('two') } });
  const result = box.run('scrape-docs.js', ['--limit=1'], { [url('one')]: { body: markdown('one') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 1);
  assert.equal(box.read('docs/two.md'), oldDoc('two'));
  assert.match(result.stdout, /coleta parcial/);
});

test('HTTP errors preserve old documents and remain discoverable for the next collection', (t) => {
  const names = Array.from({ length: 20 }, (_, i) => `ok-${i}`);
  const box = sandbox(t, { pages: [...names.map(page), page('unavailable')], docs: { 'unavailable.md': oldDoc('unavailable') } });
  const fixture = Object.fromEntries(names.map((name) => [url(name), { body: markdown(name) }]));
  fixture[url('unavailable')] = { status: 500, body: 'provider failure' };
  const result = box.run('scrape-docs.js', ['--no-expand'], fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.read('docs/unavailable.md'), oldDoc('unavailable'));
  assert.equal(box.json('url-index.json').unavailable[0].path, canonical('unavailable'));
  assert.equal(box.json('scrape-report.json').counts.errors, 1);
  assert.equal(result.requests.filter((entry) => entry.url === url('unavailable')).length, 4);
});

test('resume retries discovered network failures without fetching successful cached pages', (t) => {
  const box = sandbox(t, {
    pages: [page('one'), page('two')],
    manifest: { pages: {
      [canonical('one')]: { status: 'ok', file: 'one.md' },
      [canonical('two')]: { status: 'error', reason: 'network', detail: 'temporary failure' },
    } }, cache: { 'one.md': markdown('one') },
  });
  const result = box.run('scrape-docs.js', ['--resume', '--no-expand'], { [url('two')]: { body: markdown('two') } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests.map((entry) => entry.url), [url('two')]);
  assert.equal(box.json('url-index.json').stats.totalFiles, 2);
});

test('an endpoint returning only HTML cannot prune a previous healthy corpus', (t) => {
  const box = sandbox(t, { pages: [page('one'), page('two')], docs: { 'one.md': oldDoc('one'), 'two.md': oldDoc('two') } });
  const fixture = Object.fromEntries(['one', 'two'].map((name) => [url(name), { body: '<html>Temporary HTML shell</html>', contentType: 'text/html' }]));
  const result = box.run('scrape-docs.js', ['--no-expand'], fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.read('docs/one.md'), oldDoc('one'));
  assert.equal(box.read('docs/two.md'), oldDoc('two'));
  assert.match(result.stdout, /Limpeza de órfãos pulada/);
});
