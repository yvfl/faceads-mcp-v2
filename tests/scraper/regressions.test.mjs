import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, canonical, url, markdown, oldDoc, page } from './helpers.mjs';

// These are merge gates, not snapshots of known defects. Each assertion states
// the recovery/compatibility contract expected from the documentation pipeline.

test('migration keeps the CAPI and Catalog families served at their new official locations', (t) => {
  // Official destinations independently observed on 2026-09-12 by following
  // /docs/marketing-api/conversions-api and /docs/marketing-api/catalog redirects.
  const migrated = [
    '/documentation/ads-commerce/conversions-api',
    '/documentation/ads-commerce/catalog',
  ];
  const nav = Array.from({ length: 300 }, (_, i) => ({ href: canonical(`nav-${i}`), text: `Page ${i}` }));
  nav.push(...migrated.map((href) => ({ href, text: href.split('/').at(-1) })));
  const box = sandbox(t, { index: {
    urlToFile: {
      '/docs/marketing-api/conversions-api': 'conversions-api.md',
      '/docs/marketing-api/catalog': 'catalog.md',
    },
  } });
  const result = box.run('discover-urls.js', [], { [url()]: { contentType: 'text/html', body: JSON.stringify(nav) } });
  assert.equal(result.status, 0, result.stderr);
  const discovered = box.json('discovered-urls.json');
  for (const destination of migrated) {
    assert.ok(discovered.pages.some((entry) => entry.path === destination), `Migration lost live documentation: ${destination}`);
  }
});

test('a limited collection preserves the authoritative index for untouched documents', (t) => {
  const existingIndex = {
    urlToFile: { [canonical('one')]: 'one.md', [canonical('two')]: 'two.md' },
    fileToUrl: { 'one.md': canonical('one'), 'two.md': canonical('two') },
  };
  const box = sandbox(t, {
    pages: [page('one'), page('two')], index: existingIndex,
    docs: { 'one.md': oldDoc('one'), 'two.md': oldDoc('two') },
  });
  const result = box.run('scrape-docs.js', ['--limit=1'], { [url('one')]: { body: markdown('one') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.json('url-index.json').urlToFile[canonical('two')], 'two.md', 'A partial run discarded an untouched baseline edge');
});

test('resume recovers cache files missing from an otherwise successful manifest', (t) => {
  const box = sandbox(t, {
    pages: [page('one'), page('two')],
    docs: { 'one.md': oldDoc('one'), 'two.md': oldDoc('two') },
    manifest: { pages: {
      [canonical('one')]: { status: 'ok', file: 'one.md' },
      [canonical('two')]: { status: 'ok', file: 'two.md' },
    } }, cache: { 'one.md': markdown('one') },
  });
  const result = box.run('scrape-docs.js', ['--resume', '--no-expand'], { [url('two')]: { body: markdown('two') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.json('url-index.json').urlToFile[canonical('two')], 'two.md', 'Resume permanently excludes a page whose cache file is missing');
  assert.deepEqual(result.requests.map((entry) => entry.url), [url('two')]);
});

test('resume retries an edge that failed during markdown link expansion', (t) => {
  const box = sandbox(t, {
    pages: [page('seed')],
    manifest: { pages: {
      [canonical('seed')]: { status: 'ok', file: 'seed.md' },
      [canonical('edge')]: { status: 'error', reason: 'network', detail: 'HTTP 500' },
    } }, cache: { 'seed.md': markdown('Seed', `[Edge](${url('edge')}) with sufficient detail to retain this page.`) },
  });
  const result = box.run('scrape-docs.js', ['--resume'], { [url('edge')]: { body: markdown('Edge') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.json('url-index.json').urlToFile[canonical('edge')], 'edge.md', 'Resume ignored a failed expanded edge outside discovered-urls.json');
});

test('the documented resume command recovers after widespread temporary HTML responses', (t) => {
  const box = sandbox(t, {
    pages: [page('one')], docs: { 'one.md': oldDoc('one') },
    manifest: { pages: {
      [canonical('one')]: { status: 'skipped', reason: 'no-markdown', detail: 'text/html' },
    } },
  });
  const result = box.run('scrape-docs.js', ['--resume', '--no-expand'], { [url('one')]: { body: markdown('Recovered') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.json('url-index.json').urlToFile[canonical('one')], 'one.md', 'The recovery command still skips a recovered markdown endpoint');
});

test('an isolated transient HTML response preserves its baseline index and source content', (t) => {
  const names = Array.from({ length: 21 }, (_, i) => `ok-${i}`);
  const existingIndex = {
    urlToFile: { [canonical('transient')]: 'transient.md' },
    fileToUrl: { 'transient.md': canonical('transient') },
  };
  const box = sandbox(t, { pages: [...names.map(page), page('transient')], index: existingIndex, docs: { 'transient.md': oldDoc('transient') } });
  const fixture = Object.fromEntries(names.map(name => [url(name), { body: markdown(name) }]));
  fixture[url('transient')] = { contentType: 'text/html', body: '<html>Provider shell</html>' };
  const result = box.run('scrape-docs.js', ['--no-expand'], fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.read('docs/transient.md'), oldDoc('transient'));
  assert.equal(box.json('url-index.json').urlToFile[canonical('transient')], 'transient.md');
  assert.ok(box.json('url-index.json').unavailable.some(entry => entry.path === canonical('transient') && entry.reason === 'no-markdown'));
});

test('curated pages cannot be overwritten by a matching collected URL', (t) => {
  const curated = '# Editorial guide\n\nHand-authored local context.\n';
  const box = sandbox(t, { pages: [page('QUICK_REFERENCE')], docs: { 'QUICK_REFERENCE.md': curated } });
  const result = box.run('scrape-docs.js', ['--no-expand'], { [url('QUICK_REFERENCE')]: { body: markdown('Remote replacement') } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(box.read('docs/QUICK_REFERENCE.md'), curated);
  assert.equal(box.json('url-index.json').stats.totalFiles, 0);
});

test('resume reuses the cache source timestamp rather than claiming a new collection', (t) => {
  const fetchedAt = '2026-01-02T03:04:05.000Z';
  const box = sandbox(t, {
    pages: [page('one')], manifest: { pages: { [canonical('one')]: { status: 'ok', file: 'one.md', fetchedAt } } },
    cache: { 'one.md': markdown('One') },
  });
  const result = box.run('scrape-docs.js', ['--resume', '--no-expand'], {});
  assert.equal(result.status, 0, result.stderr);
  assert.match(box.read('docs/one.md'), new RegExp(fetchedAt.replaceAll('.', '\\.')));
  assert.equal(result.requests.length, 0);
});

test('a malformed collection limit fails before fetching or changing the index', (t) => {
  for (const limit of ['0', '-1', '1junk', 'NaN', '1.5']) {
    const box = sandbox(t, { pages: [page('one')] });
    const result = box.run('scrape-docs.js', [`--limit=${limit}`], {});
    assert.notEqual(result.status, 0);
    assert.equal(result.requests.length, 0);
  }
});

test('resume detects corrupted cache content using the recorded digest', (t) => {
  const box = sandbox(t, {
    pages: [page('one')], manifest: { pages: { [canonical('one')]: { status: 'ok', file: 'one.md', sha256: 'invalid-digest' } } },
    cache: { 'one.md': markdown('Corrupted') },
  });
  const result = box.run('scrape-docs.js', ['--resume', '--no-expand'], { [url('one')]: { body: markdown('Recovered') } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(box.read('docs/one.md'), /Recovered/);
  assert.equal(result.requests.length, 1);
  assert.match(box.json('.scrape-cache/manifest.json').pages[canonical('one')].sha256, /^[a-f0-9]{64}$/);
});

test('official redirects determine the canonical file and provenance', (t) => {
  const destination = 'https://developers.facebook.com/documentation/ads-commerce/catalog/new-reference';
  const box = sandbox(t, { pages: [page('old-reference')] });
  const result = box.run('scrape-docs.js', ['--no-expand'], {
    [url('old-reference')]: { body: markdown('New reference'), finalUrl: destination },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(box.read('docs/catalog/new-reference.md'), /source: "https:\/\/developers.facebook.com\/documentation\/ads-commerce\/catalog\/new-reference"/);
  assert.equal(box.json('url-index.json').fileToUrl['catalog/new-reference.md'], '/documentation/ads-commerce/catalog/new-reference');
  assert.equal(box.json('url-index.json').stats.totalFiles, 1);
});
