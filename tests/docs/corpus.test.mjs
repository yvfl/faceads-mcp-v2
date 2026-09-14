import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllDocuments, loadMarkdownFile, resolveDocumentPath, getDocsPath, countFilesInSection } from '../../dist/utils/fileLoader.js';
import { searchDocuments } from '../../dist/utils/search.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('public document paths reject traversal, hidden files, internal instructions and non-Markdown', () => {
  for (const input of ['../README.md', '../../.env', '/etc/passwd', 'AGENTS.md', 'catalog/AGENTS.md', 'catalog/../AGENTS.md', 'catalog\\AGENTS.md', '%2e%2e/README.md', '.private.md', 'reference/ad-account.md?x', 'README.txt']) {
    assert.equal(resolveDocumentPath(input), null, input);
  }
  assert.equal(countFilesInSection('../'), 0);
  assert.equal(loadMarkdownFile(path.join(root, 'README.md')), null);
});

test('a symlink inside docs cannot expose external Markdown', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'faceads-doc-boundary-'));
  const outside = path.join(temporary, 'sentinel.md');
  const link = path.join(getDocsPath(), `containment-${process.pid}.md`);
  t.after(() => { fs.rmSync(link, { force: true }); fs.rmSync(temporary, { recursive: true, force: true }); });
  fs.writeFileSync(outside, '# Private synthetic sentinel');
  fs.symlinkSync(outside, link);
  assert.equal(resolveDocumentPath(path.basename(link)), null);
  assert.equal(loadMarkdownFile(link), null);
});

test('pre-migration public paths resolve to their current document', () => {
  for (const [alias, canonical] of [
    ['advantage-campaigns/index.md', 'advantage-campaigns.md'],
    ['advantage-shopping-campaigns/index.md', 'advantage-shopping-campaigns.md'],
    ['bidding-and-optimization/campaign-budget-optimization.md', 'bidding/guides/advantage-campaign-budget.md'],
    ['conversions-api/get-started/index.md', 'conversions-api/get-started.md'],
  ]) {
    assert.ok(resolveDocumentPath(canonical), canonical);
    assert.equal(resolveDocumentPath(alias), resolveDocumentPath(canonical), alias);
  }
});

test('the search corpus excludes AGENTS instructions and retains both migrated families', () => {
  const docs = loadAllDocuments();
  assert.ok(docs.length > 600);
  assert.ok(docs.every(doc => path.basename(doc.relativePath).toLowerCase() !== 'agents.md'));
  for (const family of ['catalog', 'conversions-api']) {
    assert.ok(docs.filter(doc => doc.relativePath.startsWith(`${family}/`)).length > 20, family);
    const results = searchDocuments(docs, family === 'catalog' ? 'catalog' : 'conversions api', { section: family, limit: 5 });
    assert.ok(results.length > 0, family);
    assert.ok(results.every(result => result.document.relativePath.startsWith(`${family}/`) || result.document.relativePath === `${family}.md`));
  }
  assert.deepEqual(searchDocuments(docs, '   '), []);
});

test('all local document links in published curated guides resolve', () => {
  for (const filename of ['ANDROMEDA.md', 'PLAYBOOK.md', 'SKILL.md']) {
    const content = fs.readFileSync(path.join(root, filename), 'utf8');
    for (const [, target] of content.matchAll(/\]\((docs\/[^)#]+)(?:#[^)]*)?\)/g)) {
      assert.ok(resolveDocumentPath(target.slice('docs/'.length)), `${filename}: ${target}`);
    }
    assert.doesNotMatch(content, /"args":\s*\["-y",\s*"fb-marketing-mcp"\]/, 'v2 must not install v1');
  }
});

test('documentation schemas expose the same limits accepted at runtime', async () => {
  const { docsTools, handleDocsTool } = await import('../../dist/docs-tools.js');
  const search = docsTools.find(tool => tool.name === 'search_documentation');
  assert.equal(search.inputSchema.properties.limit.maximum, 50);
  assert.equal(search.inputSchema.properties.limit.type, 'integer');
  assert.ok(!search.inputSchema.required.includes('limit'));
  assert.equal(search.annotations.readOnlyHint, true);
  for (const arguments_ of [{ query: '   ' }, { query: 'ads', limit: 1.5 }, { query: 'ads', limit: 51 }, { query: 'ads', extra: 'unadvertised' }]) {
    assert.equal((await handleDocsTool('search_documentation', arguments_)).isError, true);
  }
});

test('resource pagination lists every public document once and never exposes internal files', async () => {
  const { startStdio } = await import('../support/mcp-client.mjs');
  const client = await startStdio();
  try {
    const seen = new Set();
    let cursor;
    do {
      const page = await client.listResources(cursor ? { cursor } : {});
      assert.ok(page.resources.length <= 100);
      for (const resource of page.resources) {
        assert.ok(!seen.has(resource.uri), resource.uri);
        assert.doesNotMatch(resource.uri, /AGENTS\.md$/i);
        seen.add(resource.uri);
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.ok(seen.size > 600);
    await assert.rejects(client.listResources({ cursor: '-1' }));
    await assert.rejects(client.readResource({ uri: 'fb-marketing-docs://docs/catalog/AGENTS.md' }));
    await assert.rejects(client.readResource({ uri: 'fb-marketing-docs://docs/%2e%2e/README.md' }));
  } finally { await client.close(); }
});

test('published URL index is bidirectional and every indexed document is readable', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'url-index.json'), 'utf8'));
  assert.ok(Object.keys(index.fileToUrl).length > 600);
  for (const [url, file] of Object.entries(index.urlToFile)) {
    assert.equal(index.fileToUrl[file], url, `Reverse mapping for ${url}`);
    assert.ok(resolveDocumentPath(file), `Indexed file missing or not public: ${file}`);
  }
  for (const [file, url] of Object.entries(index.fileToUrl)) assert.equal(index.urlToFile[url], file);
});

test('connector references are searchable without claiming their tools run in FaceAds', async () => {
  const { handleDocsTool } = await import('../../dist/docs-tools.js');
  const result = await handleDocsTool('search_documentation', { query: 'MCP', section: 'ads-ai-connectors', limit: 3 });
  assert.notEqual(result.isError, true);
  const text = result.content[0].text;
  assert.match(text, /ads-ai-connectors\//);
  assert.match(text, /não a torna executável no FaceAds MCP v2/);
  assert.match(text, /tools\/list/);
  assert.match(text, /Fonte:.*developers\.facebook\.com/);
  assert.match(text, /Coletado em:/);
});

test('document reads and navigation retain the distinction between references and executable tools', async () => {
  const { handleDocsTool } = await import('../../dist/docs-tools.js');
  for (const [name, args] of [
    ['get_document_by_path', { path: 'ads-ai-connectors/ads-mcp-server/ads-mcp-server-get-started.md' }],
    ['get_endpoint_reference', { endpoint: 'campaigns' }],
    ['get_quick_reference', {}],
    ['list_sections', {}],
  ]) {
    const response = await handleDocsTool(name, args);
    assert.notEqual(response.isError, true, name);
    assert.match(response.content[0].text, /não a torna executável no FaceAds MCP v2/, name);
    assert.match(response.content[0].text, /MCP oficial da Meta tem contrato próprio/, name);
    if (name === 'get_document_by_path') {
      assert.match(response.content[0].text, /Coletado em:/);
      assert.match(response.content[0].text, /Fonte:.*developers\.facebook\.com/);
    }
  }
});

test('MCP prompts require complete evidence and explicit changes instead of automatic optimization thresholds', async () => {
  const { startStdio } = await import('../support/mcp-client.mjs');
  const client = await startStdio();
  try {
    const { prompts } = await client.listPrompts();
    for (const { name } of prompts) {
      const result = await client.getPrompt({ name });
      const text = result.messages.map(message => message.content.text ?? '').join('\n');
      assert.match(text, /structuredContent\.pagination\.complete/, name);
      assert.match(text, /collections\[\]\.next/, name);
      assert.match(text, /Documentação.*não habilita essas operações no FaceAds/, name);
      assert.match(text, /get_operation_status/, name);
    }
    const quick = (await client.getPrompt({ name: 'quick_optimization' })).messages[0].content.text;
    assert.doesNotMatch(quick, /CTR\s*<\s*0\.5|frequência\s*>\s*3|# Pausar campanha ruim/);
    assert.match(quick, /Não existe um corte universal/);
    const manager = (await client.getPrompt({ name: 'traffic_manager_mode' })).messages[0].content.text;
    assert.doesNotMatch(manager, /Use async batch requests|para endpoints sem tool específica/);
    assert.match(manager, /Batch e endpoints arbitrários não são suportados no HTTP/);
  } finally { await client.close(); }
});
