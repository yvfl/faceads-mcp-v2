import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { root, cleanEnv } from '../support/mcp-client.mjs';

async function exercise({ write = false, failAd = false, wrongOwner = false, active = false, wrongThreads = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'faceads-live-harness-'));
  const config = { account_id: 'act_12345', page_id: '23456', targeting: { geo_locations: { countries: ['BR'] } }, daily_budget: 600, image_hash: 'fake', landing_url: 'https://example.com' };
  const configPath = path.join(directory, 'account.json');
  await writeFile(configPath, JSON.stringify(config));
  const calls = [];
  const objects = new Map();
  const sessions = new Map();
  let nextId = 80000;
  const app = express();
  app.use(express.json());
  const success = text => ({ content: [{ type: 'text', text }] });
  const json = data => success('```json\n' + JSON.stringify(data) + '\n```');
  app.all('/mcp', async (req, res) => {
    try {
      let transport = sessions.get(req.headers['mcp-session-id']);
      if (!transport && isInitializeRequest(req.body)) {
        const server = new Server({ name: 'fake-live-provider', version: '1.0.0' }, { capabilities: { tools: {} } });
        server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: Array.from({ length: 66 }, (_, i) => ({ name: `fixture_${i}`, inputSchema: { type: 'object' } })) }));
        server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
          const { name, arguments: args } = params;
          calls.push({ name, args });
          if (name === 'execute_api') {
            if (args.method === 'DELETE') return json({ success: objects.delete(args.endpoint) });
            if (args.endpoint === config.account_id) return json({ id: config.account_id, account_id: '12345', account_status: 1, currency: 'BRL', timezone_name: 'America/Sao_Paulo' });
            const object = objects.get(args.endpoint);
            if (!object) return { ...success('missing'), isError: true };
            return json({ ...object, account_id: wrongOwner ? '99999' : '12345' });
          }
          if (name.startsWith('create_')) {
            if (name === 'create_ad' && failAd) return { ...success('# Erro da API Meta\naccess_token=live-fake-secret'), isError: true };
            const id = String(++nextId);
            const object = { id, ...args, account_id: '12345' };
            if (active && name === 'create_campaign') object.status = 'ACTIVE';
            if (name === 'create_ad') object.creative = { id: args.creative_id };
            if (name === 'create_threads_ad_set') object.targeting = { ...args.targeting, publisher_platforms: wrongThreads ? ['instagram'] : ['instagram', 'threads'], instagram_positions: ['stream'], threads_positions: ['threads_stream'] };
            objects.set(id, object);
            return success(`**ID:** ${id}`);
          }
          if (name.startsWith('update_') || name.startsWith('pause_')) {
            const key = `${name.split('_')[1]}_id`;
            Object.assign(objects.get(args[key]), args);
            return success('updated');
          }
          return success('Leitura simulada válida; nenhuma Graph API chamada.');
        });
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => String(sessions.size + 1), onsessioninitialized: id => sessions.set(id, transport) });
        await server.connect(transport);
      }
      if (!transport) return res.status(400).end();
      await transport.handleRequest(req, res, req.body);
    } catch { if (!res.headersSent) res.status(500).end(); }
  });
  const http = app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const args = ['scripts/test-live.mjs', '--config', configPath];
  if (write) args.push('--write', '--confirm-account', config.account_id);
  const child = spawn(process.execPath, args, { cwd: root, env: cleanEnv({ META_LIVE_MCP_URL: `http://127.0.0.1:${http.address().port}/mcp`, META_LIVE_MCP_BEARER: 'live-fake-secret' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data.toString(); });
  child.stderr.on('data', data => { output += data.toString(); });
  const killTimer = setTimeout(() => child.kill('SIGKILL'), 15000);
  let reportPath;
  try {
    const [code] = await once(child, 'exit');
    reportPath = output.match(/Relatório local: (.+\.json)/)?.[1];
    assert.ok(reportPath, output);
    const reportText = await readFile(reportPath, 'utf8');
    assert.ok(!reportText.includes('live-fake-secret'));
    return { code, report: JSON.parse(reportText), calls, objects };
  } finally {
    clearTimeout(killTimer);
    for (const transport of sessions.values()) await transport.close();
    http.closeAllConnections();
    await new Promise(resolve => http.close(resolve));
    await rm(directory, { recursive: true, force: true });
    if (reportPath) await rm(reportPath, { force: true });
  }
}

test('runner live em MCP fake: leitura não escreve nem apaga', async () => {
  const result = await exercise();
  assert.equal(result.code, 0);
  assert.equal(result.report.status, 'pass');
  assert.ok(result.calls.every(call => !/^(create|update|pause|activate)_/.test(call.name)));
  assert.ok(result.calls.filter(call => call.name === 'execute_api').every(call => call.args.method === 'GET'));
});

test('runner live em MCP fake: ciclo pausado, conferência e limpeza dos próprios IDs', async () => {
  const result = await exercise({ write: true });
  assert.equal(result.code, 0, JSON.stringify(result.report));
  assert.equal(result.objects.size, 0);
  assert.equal(result.report.objects.length, 5);
  assert.ok(result.report.objects.every(object => object.cleaned && object.cleanup_eligible));
  for (const call of result.calls.filter(call => call.name.startsWith('create_') && call.name !== 'create_creative')) assert.equal(call.args.status, 'PAUSED');
  assert.ok(!result.calls.some(call => call.name.startsWith('activate_')));
});

test('runner live em MCP fake: falha intermediária limpa em ordem inversa e mascara token', async () => {
  const result = await exercise({ write: true, failAd: true });
  assert.equal(result.code, 1);
  assert.equal(result.objects.size, 0);
  const deleted = result.calls.filter(call => call.args.method === 'DELETE').map(call => call.args.endpoint);
  assert.deepEqual(deleted, [...result.report.objects].reverse().map(object => object.id));
  assert.ok(result.report.checks.some(check => check.status === 'fail' && check.detail.includes('[REDACTED]')));
});

test('runner live em MCP fake: ID de outra conta nunca é elegível para DELETE', async () => {
  const result = await exercise({ write: true, wrongOwner: true });
  assert.equal(result.code, 1);
  assert.equal(result.report.objects[0].cleanup_eligible, false);
  assert.ok(!result.calls.some(call => call.args.method === 'DELETE'));
});

test('runner live em MCP fake: servidor ignorando PAUSED falha e limpa objeto comprovadamente nosso', async () => {
  const result = await exercise({ write: true, active: true });
  assert.equal(result.code, 1);
  assert.equal(result.objects.size, 0);
  assert.equal(result.report.objects[0].cleanup_eligible, true);
  assert.equal(result.report.objects[0].cleaned, true);
});

test('runner live em MCP fake: Threads sem o placement pedido falha e limpa todos os recursos', async () => {
  const result = await exercise({ write: true, wrongThreads: true });
  assert.equal(result.code, 1);
  assert.match(result.report.failure, /Threads readback mismatch/);
  assert.equal(result.objects.size, 0);
  assert.ok(result.report.objects.every(object => object.cleaned));
});
