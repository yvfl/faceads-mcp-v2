#!/usr/bin/env node
/**
 * Teste de fumaça do MCP em modo stdio.
 *
 * Sobe dist/index.js, fala JSON-RPC pela stdin/stdout e confere que as tools
 * de documentação, os resources e as validações locais respondem. Roda com um
 * token falso só para destravar o gate de configuração: nenhuma verificação
 * daqui chega a fazer request à Graph API.
 *
 * Uso: npm run smoke
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.join(__dirname, '..', 'dist', 'index.js');
const REQUEST_TIMEOUT_MS = 30000;

class McpStdioClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';

    this.child = spawn(process.execPath, [SERVER_ENTRY], {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Token falso: destrava o gate de configuração para exercitar as
      // validações locais. Nenhuma verificação daqui chega a fazer request —
      // todas param na validação antes de montar a chamada à Graph API.
      env: { ...process.env, META_ACCESS_TOKEN: 'smoke-test-nao-e-um-token-real' },
    });

    this.child.stdout.on('data', (chunk) => this.onData(chunk));
    this.child.on('exit', (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`Servidor encerrou com código ${code}`));
      }
      this.pending.clear();
    });
  }

  onData(chunk) {
    this.buffer += chunk.toString();
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      const entry = this.pending.get(message.id);
      if (!entry) continue;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);

      if (message.error) {
        entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        entry.resolve(message.result);
      }
    }
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout em ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? '✅' : '❌';
  process.stdout.write(`${mark} ${name}${detail ? ` — ${detail}` : ''}\n`);
}

function textOf(result) {
  return (result?.content || []).map((part) => part.text || '').join('\n');
}

async function main() {
  const client = new McpStdioClient();

  try {
    const init = await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0.0' },
    });
    client.notify('notifications/initialized');
    check('initialize', Boolean(init?.serverInfo?.name), init?.serverInfo?.name);

    // ---- Tools ----
    const toolList = await client.request('tools/list');
    const toolNames = (toolList.tools || []).map((t) => t.name);
    check('tools/list responde', toolNames.length > 0, `${toolNames.length} tools`);

    for (const expected of [
      'search_documentation',
      'get_document_by_path',
      'list_sections',
      'create_adset',
      'create_creative',
      'create_threads_ad_set',
      'create_click_to_message_ad_set',
      'create_partnership_ad_creative',
    ]) {
      check(`tool registrada: ${expected}`, toolNames.includes(expected));
    }

    // ---- Busca na documentação ----
    const queries = ['criar campanha', 'breakdowns', 'custom audience', 'threads', 'erro 1870189'];
    for (const query of queries) {
      const result = await client.request('tools/call', {
        name: 'search_documentation',
        arguments: { query, limit: 5 },
      });
      const text = textOf(result);
      const hasHits = text.includes('.md') && !/nenhum resultado/i.test(text);
      check(`search_documentation("${query}")`, hasHits, `${text.length} chars`);
    }

    // ---- Sinônimos PT para as áreas novas (docs vêm em inglês) ----
    const synonymCases = [
      { query: 'clique para whatsapp', expect: 'click-to-whatsapp' },
      { query: 'threads', expect: 'threads-ads' },
      { query: 'advantage creative ia', expect: 'advantage' },
    ];
    for (const { query, expect } of synonymCases) {
      const result = await client.request('tools/call', {
        name: 'search_documentation',
        arguments: { query, limit: 3 },
      });
      const text = textOf(result);
      check(`busca PT alcança doc em inglês: "${query}" → ${expect}`, text.includes(expect));
    }

    // ---- Seções ----
    const sections = await client.request('tools/call', { name: 'list_sections', arguments: {} });
    const sectionsText = textOf(sections);
    check('list_sections lista seções', sectionsText.length > 100, `${sectionsText.length} chars`);

    // ---- Documento específico ----
    const doc = await client.request('tools/call', {
      name: 'get_document_by_path',
      arguments: { path: 'reference/ad-campaign-group.md' },
    });
    const docText = textOf(doc);
    check(
      'get_document_by_path("reference/ad-campaign-group.md")',
      docText.includes('Campaign') && docText.length > 2000,
      `${docText.length} chars`
    );
    check('documento sem entidades HTML cruas', !/&lt;|&#12[35];|&quot;/.test(docText));

    // ---- Endpoint reference ----
    const endpoint = await client.request('tools/call', {
      name: 'get_endpoint_reference',
      arguments: { endpoint: 'adsets' },
    });
    const endpointText = textOf(endpoint);
    check('get_endpoint_reference("adsets")', endpointText.length > 200, `${endpointText.length} chars`);

    // ---- Resources ----
    const resources = await client.request('resources/list');
    const uris = (resources.resources || []).map((r) => r.uri);
    check('resources/list responde', uris.length > 0, `${uris.length} resources`);
    for (const slug of ['skill', 'playbook', 'andromeda']) {
      const uri = `fb-marketing-docs://guides/${slug}`;
      check(`resource listado: ${slug}`, uris.includes(uri));

      const read = await client.request('resources/read', { uri });
      const content = read?.contents?.[0]?.text || '';
      check(`resource legível: ${slug}`, content.length > 1000, `${content.length} chars`);
    }

    // ---- Validações locais da v26 (não chamam a Graph API) ----
    const pollCreative = await client.request('tools/call', {
      name: 'create_creative',
      arguments: {
        account_id: 'act_000',
        name: 'smoke poll',
        object_story_spec: {
          page_id: '123',
          poll_spec: { question: 'qual?' },
        },
      },
    });
    check(
      'create_creative recusa poll_spec (v26.0)',
      /poll_spec/.test(textOf(pollCreative)) && /v26\.0/.test(textOf(pollCreative))
    );

    const ctmNoTargeting = await client.request('tools/call', {
      name: 'create_click_to_message_ad_set',
      arguments: {
        account_id: 'act_000',
        campaign_id: '123',
        name: 'smoke ctm',
        destination: 'WHATSAPP',
        page_id: '123',
        whatsapp_phone_number: '+5511999999999',
        optimization_goal: 'CONVERSATIONS',
        billing_event: 'IMPRESSIONS',
        targeting: {},
      },
    });
    check(
      'create_click_to_message_ad_set exige targeting',
      /targeting.*obrigat/is.test(textOf(ctmNoTargeting))
    );

    const prompts = await client.request('prompts/list');
    check('prompts/list responde', Array.isArray(prompts?.prompts), `${prompts?.prompts?.length ?? 0} prompts`);
  } finally {
    client.close();
  }

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} verificações passaram\n`);

  if (failed.length > 0) {
    process.stdout.write('\nFalhas:\n');
    failed.forEach((f) => process.stdout.write(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}\n`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`💥 ${error.stack || error.message || error}\n`);
  process.exit(1);
});
