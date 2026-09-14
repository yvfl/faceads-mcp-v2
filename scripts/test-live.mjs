#!/usr/bin/env node
/** Real-account validation. Default: reads only. Never run from npm test. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { root, startStdio } from '../tests/support/mcp-client.mjs';
import { validateConfig, readCases, campaignArgs, adsetArgs, parseApiJson, createdId, assertToolSuccess } from '../tests/live/plan.mjs';

const argv = process.argv.slice(2);
const value = flag => { const i = argv.indexOf(flag); return i < 0 ? undefined : argv[i + 1]; };
const write = argv.includes('--write');
const dryRun = argv.includes('--dry-run');
const configPath = value('--config');
const known = new Set(['--config', '--confirm-account', '--write', '--dry-run', '--help']);
for (let i = 0; i < argv.length; i++) {
  if (!known.has(argv[i])) throw new Error(`Argumento desconhecido: ${argv[i]}`);
  if (['--config', '--confirm-account'].includes(argv[i])) i++;
}
if (argv.includes('--help') || !configPath) {
  console.log('Uso: npm run test:live -- --config tests/live/account.local.json [--dry-run] [--write --confirm-account act_ID]');
  console.log('Credenciais: META_LIVE_ACCESS_TOKEN (stdio) ou META_LIVE_MCP_URL + META_LIVE_MCP_BEARER (HTTP OAuth).');
  if (!argv.includes('--help')) process.exitCode = 2;
} else {
  await main().catch(() => {
    console.error('Falha ao preparar a validação. Confira configuração, autorização da conta e credenciais locais.');
    process.exitCode = 1;
  });
}

async function main() {
  const config = validateConfig(JSON.parse(await readFile(configPath, 'utf8')), write);
  if (write && value('--confirm-account') !== config.account_id) throw new Error('Confirmação da conta não coincide.');
  const cases = readCases(config);
  if (dryRun) {
    console.log(JSON.stringify({ mode: write ? 'read-and-paused-write' : 'read', account_id: config.account_id,
      reads: cases.map(([tool]) => tool),
      writes: write ? ['paused campaign, adset, creative, ad + update/readback', 'Threads', ...(config.messaging ? ['Click-to-Message'] : []), ...(config.partnership ? ['Partnership'] : []), ...(config.special_ad_category ? ['special category'] : []), 'cleanup of IDs created in this run'] : [],
    }, null, 2));
    return;
  }
  const token = process.env.META_LIVE_ACCESS_TOKEN;
  const url = process.env.META_LIVE_MCP_URL;
  const bearer = process.env.META_LIVE_MCP_BEARER;
  if (url ? !bearer : !token) throw new Error('Credenciais ausentes.');
  if (url) {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL MCP deve ser limpa, sem credenciais ou query.');
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) throw new Error('HTTP remoto deve usar HTTPS.');
  }
  const secrets = [token, bearer, config.partnership?.instagram_boost_post_access_token, config.partnership?.facebook_boost_post_access_token].filter(Boolean);
  const redact = text => {
    let result = String(text ?? '');
    for (const secret of secrets) result = result.split(secret).join('[REDACTED]');
    return result.replace(/(access_token|authorization)(["'\s:=]+)[^\s&"'<>]+/gi, '$1$2[REDACTED]');
  };
  const run = `mcp-audit-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const directory = path.join(root, '.audit-results');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const reportPath = path.join(directory, `${run}.json`);
  const report = { run, account_id: config.account_id, transport: url ? 'http' : 'stdio', mode: write ? 'paused-write' : 'read', started_at: new Date().toISOString(), checks: [], objects: [], pending: null };
  const persist = () => writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  let client;
  async function call(tool, args) {
    const started = Date.now();
    try {
      const result = assertToolSuccess(await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 60000 }));
      report.checks.push({ tool, status: 'pass', duration_ms: Date.now() - started });
      await persist();
      console.log(`PASS ${tool}`);
      return result;
    } catch (error) {
      report.checks.push({ tool, status: 'fail', duration_ms: Date.now() - started, detail: redact(error.toolText ?? error.message).slice(0, 5000) });
      await persist();
      console.log(`FAIL ${tool}`);
      throw error;
    }
  }
  async function raw(id, fields) {
    return parseApiJson(await call('execute_api', { method: 'GET', endpoint: id, params: { fields: fields.join(',') } }));
  }
  async function verify(id, expected) {
    const data = await raw(id, [...new Set(['id', ...Object.keys(expected)])]);
    for (const [key, value] of Object.entries(expected)) {
      if (String(data[key]) !== String(value)) {
        report.checks.push({ tool: `readback:${id}:${key}`, status: 'fail', detail: 'Valor persistido difere do esperado.' });
        await persist();
        throw new Error('Readback mismatch');
      }
    }
    return data;
  }
  async function create(tool, args, kind) {
    report.pending = { tool, name: args.name, started_at: new Date().toISOString() };
    await persist(); // Durable intent before a possibly ambiguous network failure.
    const id = createdId(await call(tool, args));
    const object = { id, kind, name: args.name, cleanup_eligible: false, cleaned: false };
    report.objects.push(object);
    report.pending = null;
    await persist();
    await verify(id, { account_id: config.account_id.slice(4), name: args.name });
    object.cleanup_eligible = true;
    await persist();
    if (kind !== 'creative') await verify(id, { status: 'PAUSED' });
    return id;
  }
  try {
    if (url) {
      client = new Client({ name: 'faceads-live-audit', version: '1.0.0' });
      await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } }), { timeout: 15000 });
    } else {
      client = await startStdio({ offline: false, env: { META_ACCESS_TOKEN: token, META_API_VERSION: process.env.META_LIVE_API_VERSION ?? 'v26.0' } });
    }
    // Prove access to the selected account before any object creation.
    const account = await raw(config.account_id, ['id', 'account_id', 'account_status', 'currency', 'timezone_name']);
    if (account.id !== config.account_id) throw new Error('Account mismatch');
    report.account = account;
    const catalog = await client.listTools();
    if (catalog.tools.length < 66) throw new Error('Expected tools missing');
    for (const [tool, args] of cases) {
      try { await call(tool, args); } catch { /* record each independent read failure */ }
    }
    if (write) {
      if (report.checks.some(check => check.status === 'fail')) throw new Error('Corrija falhas de leitura antes de escrever.');
      if (account.account_status !== 1) throw new Error('Conta precisa estar ativa.');
      const campaign = await create('create_campaign', campaignArgs(config, `${run}-traffic`), 'campaign');
      const adset = await create('create_adset', adsetArgs(config, campaign, `${run}-base`), 'adset');
      await verify(adset, { campaign_id: campaign, daily_budget: config.daily_budget });
      const creativeArgs = {
        account_id: config.account_id, name: `${run}-creative`,
        object_story_spec: { page_id: config.page_id, link_data: { image_hash: config.image_hash, link: config.landing_url, message: 'Validação técnica do MCP', call_to_action: { type: 'LEARN_MORE', value: { link: config.landing_url } } } },
        creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } },
      };
      const creative = await create('create_creative', creativeArgs, 'creative');
      const ad = await create('create_ad', { account_id: config.account_id, name: `${run}-ad`, adset_id: adset, creative_id: creative, status: 'PAUSED' }, 'ad');
      await verify(ad, { adset_id: adset });
      const storedAd = await raw(ad, ['creative']);
      if (storedAd.creative?.id !== creative) throw new Error('Creative association mismatch');
      for (const [kind, id] of [['campaign', campaign], ['adset', adset], ['ad', ad]]) {
        const name = `${run}-${kind}-updated`;
        await call(`update_${kind}`, { [`${kind}_id`]: id, name });
        await call(`pause_${kind}`, { [`${kind}_id`]: id });
        await verify(id, { name, status: 'PAUSED' });
      }
      const threads = await create('create_threads_ad_set', adsetArgs(config, campaign, `${run}-threads`), 'adset');
      const threadsStored = await raw(threads, ['targeting']);
      for (const [field, expected] of Object.entries({ publisher_platforms: ['instagram', 'threads'], instagram_positions: ['stream'], threads_positions: ['threads_stream'] })) {
        if (JSON.stringify([...(threadsStored.targeting?.[field] ?? [])].sort()) !== JSON.stringify([...expected].sort())) throw new Error(`Threads readback mismatch: ${field}`);
      }
      if (config.messaging) {
        const parent = await create('create_campaign', campaignArgs(config, `${run}-messages`, 'OUTCOME_ENGAGEMENT'), 'campaign');
        const messaging = await create('create_click_to_message_ad_set', { ...adsetArgs(config, parent, `${run}-ctm`), destination: config.messaging.destination, whatsapp_phone_number: config.messaging.whatsapp_phone_number, page_id: config.page_id, optimization_goal: 'CONVERSATIONS' }, 'adset');
        await verify(messaging, { destination_type: config.messaging.destination });
        const messagingStored = await raw(messaging, ['promoted_object']);
        if (messagingStored.promoted_object?.page_id !== config.page_id) throw new Error('Messaging Page readback mismatch');
      }
      if (config.special_ad_category) {
        const parent = await create('create_campaign', campaignArgs(config, `${run}-special`, 'OUTCOME_TRAFFIC', [config.special_ad_category]), 'campaign');
        const args = adsetArgs(config, parent, `${run}-special-adset`);
        delete args.advantage_audience; // The documented nested flag must work.
        await create('create_adset', args, 'adset');
      }
      if (config.partnership) {
        const p = config.partnership;
        await create('create_partnership_ad_creative', {
          account_id: config.account_id, name: `${run}-partnership`, mode: p.mode,
          object_id: config.page_id, source_instagram_media_id: p.source_instagram_media_id,
          instagram_boost_post_access_token: p.instagram_boost_post_access_token,
          facebook_boost_post_access_token: p.facebook_boost_post_access_token,
        }, 'creative');
      }
    }
  } catch (error) {
    report.failure = redact(error.toolText ?? error.message).slice(0, 5000);
    process.exitCode = 1;
  } finally {
    // No caller-supplied object ID is ever eligible for cleanup.
    for (const object of [...report.objects].reverse()) {
      if (!object.cleanup_eligible) {
        object.cleanup_error = 'Não foi possível comprovar conta e nome do objeto criado. Revisão manual necessária.';
        process.exitCode = 1;
        continue;
      }
      try {
        const deleted = parseApiJson(await call('execute_api', { method: 'DELETE', endpoint: object.id }));
        if (deleted.success !== true) throw new Error('Delete did not confirm success');
        object.cleaned = true;
      } catch (error) {
        object.cleanup_error = redact(error.message);
        process.exitCode = 1;
      }
      await persist();
    }
    report.finished_at = new Date().toISOString();
    report.status = report.failure || report.checks.some(check => check.status === 'fail') || report.pending || report.objects.some(object => !object.cleaned) ? 'fail' : 'pass';
    if (report.status === 'fail') process.exitCode = 1;
    await persist();
    await client?.close();
    console.log(`Resultado: ${report.status}. Relatório local: ${reportPath}`);
    if (report.pending) console.log('Criação com resultado incerto. Revise pending no relatório e procure pelo nome exato na conta antes de repetir.');
  }
}
