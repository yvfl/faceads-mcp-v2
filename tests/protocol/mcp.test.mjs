import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStdio, textOf, root, cleanEnv } from '../support/mcp-client.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let client;
before(async () => { client = await startStdio(); });
after(async () => { await client?.close(); });

test('stdio negocia o protocolo e preserva as 68 tools sem nomes duplicados', async () => {
  const { tools } = await client.listTools();
  assert.equal(tools.length, 68);
  assert.equal(new Set(tools.map(tool => tool.name)).size, 68);
  for (const tool of tools) assert.equal(tool.inputSchema.type, 'object', tool.name);
});

for (const [query, expected] of [
  ['clique para whatsapp', /click-to-whatsapp/],
  ['threads', /threads-ads/],
  ['criar campanha', /campaign/],
]) test(`busca MCP em português: ${query}`, async () => {
  const result = await client.callTool({ name: 'search_documentation', arguments: { query, limit: 5 } });
  assert.ok(!result.isError);
  assert.match(textOf(result), expected);
});

for (const slug of ['skill', 'playbook', 'andromeda']) {
  test(`resource e tool entregam o mesmo guia ${slug}`, async () => {
    const uri = `fb-marketing-docs://guides/${slug}`;
    const listed = await client.listResources();
    assert.ok(listed.resources.some(resource => resource.uri === uri));
    const resource = await client.readResource({ uri });
    const tool = await client.callTool({ name: `get_${slug}`, arguments: {} });
    assert.ok(resource.contents[0].text.length > 1000);
    assert.ok(textOf(tool).includes(resource.contents[0].text));
  });
}

test('todos os resources anunciados podem ser lidos no checkout', async () => {
  const { resources } = await client.listResources();
  for (const resource of resources) {
    const result = await client.readResource({ uri: resource.uri });
    assert.ok(result.contents[0]?.text?.length > 0, resource.uri);
  }
});

test('todos os prompts anunciados são executáveis', async () => {
  const { prompts } = await client.listPrompts();
  for (const prompt of prompts) {
    const args = Object.fromEntries((prompt.arguments ?? []).map(arg => [arg.name, 'campaign']));
    const result = await client.getPrompt({ name: prompt.name, arguments: args });
    assert.ok(result.messages.length > 0, prompt.name);
  }
});

test('tool desconhecida e argumentos inválidos usam isError', async () => {
  const unknown = await client.callTool({ name: 'nonexistent_audit_tool', arguments: {} });
  assert.equal(unknown.isError, true);
  const invalid = await client.callTool({ name: 'create_campaign', arguments: {} });
  assert.equal(invalid.isError, true);
});

test('MCP propaga falha da rede como erro da tool', async () => {
  const result = await client.callTool({ name: 'discover_ad_accounts', arguments: {} });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /OFFLINE_TEST_NETWORK_BLOCKED/);
});

test('LEGACY: resources/read não pode ler um arquivo fora de docs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'faceads-containment-'));
  const sentinel = path.join(directory, 'audit-only.txt');
  await writeFile(sentinel, 'SENTINELA SINTETICA SEM CREDENCIAIS');
  try {
    const relative = path.relative(path.join(root, 'docs'), sentinel);
    await assert.rejects(client.readResource({ uri: `fb-marketing-docs://docs/${relative}` }),
      'Um cliente não deve conseguir ler arquivos externos ao corpus');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('HTTP: health, OAuth metadata e bloqueio de chamadas sem Bearer válido', async () => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.js', '--http', '--port', String(port)], {
    cwd: root, env: cleanEnv({ MCP_BASE_URL: base }), stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume(); child.stderr.resume();
  const exited = once(child, 'exit');
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('HTTP server exited during startup');
      try {
        const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
        if (health.ok) { ready = true; break; }
      } catch { /* bounded startup wait */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'HTTP server did not become ready');
    const metadata = await (await fetch(`${base}/.well-known/oauth-protected-resource`)).json();
    assert.equal(metadata.resource, `${base}/mcp`);
    for (const endpoint of ['/mcp', '/']) {
      for (const headers of [{}, { Authorization: 'Bearer invalid-offline-token' }, { 'X-Meta-Access-Token': 'fake' }]) {
        const response = await fetch(`${base}${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        assert.equal(response.status, 401);
        assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
      }
    }
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});
