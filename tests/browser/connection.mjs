/** Real Chrome, disposable browser profile, isolated local PostgreSQL, mocked Meta network only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { chromium } from 'playwright';
import { createHash, randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL_TEST;
assert.ok(databaseUrl, 'Set DATABASE_URL_TEST to an isolated local PostgreSQL test database.');
const database = new URL(databaseUrl);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && /test/.test(database.pathname), 'Browser tests require a local database named test.');
process.env.DATABASE_URL = databaseUrl;
process.env.MCP_ENCRYPTION_KEY = 'c'.repeat(64);
const { startHttpServer } = await import('../../dist/transports/http-server.js');
const { createMcpServer } = await import('../../dist/server.js');
const { getPrisma, disconnectPrisma } = await import('../../dist/db/prisma.js');
const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
const prisma = getPrisma();
const output = path.resolve('.audit-results/visual');
await fs.mkdir(output, { recursive: true });
const savedFetch = globalThis.fetch;
let metaReads = 0; let metaWrites = 0;
globalThis.fetch = async (url, options) => {
  if (new URL(url).hostname !== 'graph.facebook.com') return savedFetch(url, options);
  if (options?.headers?.Authorization === 'Bearer invalid-token') return new Response(JSON.stringify({ error: { code: 190, message: 'provider-secret-must-stay-private' } }), { status: 401 });
  const pathname = new URL(url).pathname;
  if (options?.method === 'POST') {
    assert.ok(pathname.endsWith('/act_8000001/campaigns'));
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('access_token'), 'browser-fixture-meta-token');
    assert.equal(body.get('status'), 'PAUSED');
    metaWrites++;
    return new Response(JSON.stringify({ id: '8000003' }));
  }
  assert.equal(options?.headers?.Authorization, 'Bearer browser-fixture-meta-token');
  metaReads++;
  const payload = pathname.endsWith('/me') ? { id: '98888001' } : pathname.endsWith('/permissions') ? { data: [{ permission: 'ads_read', status: 'granted' }, { permission: 'ads_management', status: 'granted' }] } : { data: [{ id: 'act_8000001', name: 'Operação Brasil', currency: 'BRL', account_status: 1 }, { id: 'act_8000002', name: 'Loja internacional', currency: 'USD', account_status: 1 }] };
  return new Response(JSON.stringify(payload));
};
let mainServer, callbackServer, browser;
const clients = []; const emails = []; const results = [];
async function listen(app) { return new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); }); }
try {
  const callbackApp = express();
  callbackApp.get('/callback', (req, res) => res.type('html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Cliente de teste conectado</title><h1>Conexão recebida pelo assistente de teste</h1></html>'));
  callbackApp.get('/favicon.ico', (_req, res) => res.sendStatus(204));
  callbackServer = await listen(callbackApp);
  const callbackUrl = `http://127.0.0.1:${callbackServer.address().port}/callback`;
  // Resolve an available local port before startup so the production server's origin is exact.
  const portProbe = await listen(express());
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  process.env.MCP_BASE_URL = base;
  mainServer = await startHttpServer({ port, createServer: createMcpServer });
  if (!mainServer.listener.listening) await new Promise(resolve => mainServer.listener.once('listening', resolve));
  const resource = `${base}/mcp`;
  // Follow the same scope negotiation as an MCP client instead of bypassing discovery with fixed scopes.
  const challengeResponse = await savedFetch(resource);
  assert.equal(challengeResponse.status, 401);
  const requestedScope = challengeResponse.headers.get('www-authenticate')?.match(/\bscope="([^"]+)"/)?.[1];
  assert.equal(requestedScope, 'ads_read ads_management');
  let executable = process.env.PLAYWRIGHT_CHROME_PATH;
  if (!executable) {
    const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    try { await fs.access(localChrome); executable = localChrome; } catch { /* Use Playwright's installed Chromium in Linux CI. */ }
  }
  browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage(); const consoleErrors = []; const pageErrors = []; const expectedHttpErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() !== 'error') return; if (/Failed to load resource: the server responded with a status of 400/.test(message.text())) expectedHttpErrors.push(message.text()); else consoleErrors.push(message.text()); });
    const clientRes = await savedFetch(`${base}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Assistente da equipe', redirect_uris: [callbackUrl], token_endpoint_auth_method: 'none' }) });
    assert.equal(clientRes.status, 201); const client = await clientRes.json(); clients.push(client.client_id);
    const verifier = 'browser-proof-verifier-that-has-at-least-43-characters';
    const state = `state-${viewport.name}-${randomUUID()}`;
    // Exercise a client with an explicit audience and the legacy Claude request that omits it.
    const resourceParameters = viewport.name === 'desktop' ? { resource } : {};
    const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: callbackUrl, response_type: 'code', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', scope: requestedScope, state, ...resourceParameters });
    await page.goto(`${base}/oauth/authorize?${params}`);
    async function screenshot(stage) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${viewport.name}/${stage}: horizontal overflow`);
      await page.screenshot({ path: path.join(output, `${viewport.name}-${stage}.png`), fullPage: true });
    }
    await page.getByRole('heading', { name: 'Sua conta do conector FaceAds' }).waitFor();
    await screenshot('01-login');
    const email = `browser-${viewport.name}-${randomUUID()}@example.com`; emails.push(email);
    await page.getByLabel('E-mail da conta FaceAds', { exact: true }).fill(email);
    await page.getByLabel('Senha exclusiva do FaceAds').fill('synthetic-browser-password');
    const loginResponse = await Promise.all([page.waitForResponse(response => response.url().endsWith('/oauth/authorize') && response.request().method() === 'POST'), page.getByRole('button', { name: 'Criar conta FaceAds', exact: true }).click()]);
    assert.equal(loginResponse[0].status(), 303, 'Login form must redirect to the account settings');
    await page.waitForURL('**/oauth/settings?flow=*');
    await page.getByRole('heading', { name: 'Conecte a Meta' }).waitFor();
    await screenshot('02-token');
    await page.getByLabel('Token de acesso da Meta', { exact: true }).fill('invalid-token');
    await Promise.all([page.waitForResponse(response => response.url().endsWith('/oauth/settings') && response.request().method() === 'POST' && response.status() === 400), page.getByRole('button', { name: 'Verificar e escolher contas' }).click()]);
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(), /A Meta recusou a credencial/);
    assert.match(await page.getByRole('alert').textContent(), /Atualize a credencial pela tela de conexão/);
    assert.ok(!(await page.content()).includes('provider-secret'));
    await screenshot('03-token-error');
    await page.getByLabel('Token de acesso da Meta', { exact: true }).fill('browser-fixture-meta-token');
    await Promise.all([page.waitForURL('**/oauth/settings?flow=*'), page.getByRole('button', { name: 'Verificar e escolher contas' }).click()]);
    await page.getByRole('heading', { name: 'Escolha o acesso' }).waitFor();
    await page.getByText('Leitura e gerenciamento', { exact: true }).waitFor();
    const readChoice = page.locator('input[name="access_mode"][value="read"]');
    const managementChoice = page.locator('input[name="access_mode"][value="readwrite"]');
    assert.equal(await readChoice.isChecked(), true, 'read must be selected by default');
    assert.equal(await managementChoice.isChecked(), false, 'management requires an explicit choice');
    await screenshot('04-accounts');
    await page.getByLabel('Operação Brasil', { exact: false }).check();
    const selectedAccess = viewport.name === 'desktop' ? 'read' : 'readwrite';
    if (selectedAccess === 'readwrite') await managementChoice.check();
    await page.getByLabel('Autorizo este acesso', { exact: false }).check();
    await screenshot('05-consent');
    await Promise.all([page.waitForURL(`${callbackUrl}?**`), page.getByRole('button', { name: 'Autorizar e voltar ao assistente' }).click()]);
    const callback = new URL(page.url());
    assert.equal(callback.searchParams.get('state'), state);
    assert.ok(callback.searchParams.get('code'));
    const exchange = await savedFetch(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: callbackUrl, code: callback.searchParams.get('code'), code_verifier: verifier, ...resourceParameters }) });
    assert.equal(exchange.status, 200); const tokens = await exchange.json();
    const grant = await prisma.oAuthAccessToken.findUnique({ where: { token: hashSecret(tokens.access_token) } });
    assert.deepEqual(grant.selectedAccountIds, ['act_8000001']);
    const grantedScope = selectedAccess === 'readwrite' ? requestedScope : 'ads_read';
    assert.equal(tokens.scope, grantedScope);
    assert.equal(grant.scope, grantedScope);
    assert.equal(grant.resource, resource);
    const mcpHeaders = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', Origin: base };
    const initialized = await savedFetch(resource, { method: 'POST', headers: mcpHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'Browser fixture', version: '1.0.0' } } }) });
    assert.equal(initialized.status, 200);
    const initResult = await initialized.json();
    assert.ok(initResult.result.serverInfo.name);
    const sessionId = initialized.headers.get('mcp-session-id');
    assert.ok(sessionId);
    const sessionHeaders = { ...mcpHeaders, 'mcp-session-id': sessionId };
    const acknowledged = await savedFetch(resource, { method: 'POST', headers: sessionHeaders, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    assert.equal(acknowledged.status, 202);
    const toolsResponse = await savedFetch(resource, { method: 'POST', headers: sessionHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) });
    assert.equal(toolsResponse.status, 200);
    const availableTools = (await toolsResponse.json()).result.tools;
    assert.ok(availableTools.length > 0);
    const writesBefore = metaWrites;
    const mutation = await savedFetch(resource, { method: 'POST', headers: sessionHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'execute_api', arguments: { method: 'POST', endpoint: 'act_8000001/campaigns', params: { name: 'browser-synthetic-campaign', status: 'PAUSED' } } } }) });
    const mutationResult = (await mutation.json()).result;
    assert.equal(Boolean(mutationResult.isError), selectedAccess === 'read');
    assert.equal(metaWrites - writesBefore, selectedAccess === 'readwrite' ? 1 : 0);
    assert.equal((await savedFetch(resource, { method: 'DELETE', headers: sessionHeaders })).status, 200);
    assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []);
    results.push({ viewport: viewport.name, width: viewport.width, screens: 5, horizontalOverflow: false, pageErrors, consoleErrors, expectedInvalidTokenResponses: expectedHttpErrors.length, completeOAuthRoundTrip: true, resourceParameter: viewport.name === 'desktop' ? 'explicit' : 'omitted', resourceAudienceBound: true, accountSelectionEnforced: true, selectedAccess, grantedScope, mutationPermissionEnforced: true, productionHttpServer: true, mcpInitializeAndToolsList: true });
    await context.close();
  }
  const report = { checkedAt: new Date().toISOString(), browser: await browser.version(), metaProvider: 'Fixture responses; no real Meta token', metaReads, metaWrites, results };
  await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = savedFetch;
  await browser?.close();
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.oAuthFlow.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.oAuthAccessToken.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.authorizationCode.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.metaToken.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.oAuthClient.deleteMany({ where: { id: { in: clients } } });
  if (mainServer) await mainServer.close();
  if (callbackServer) await new Promise(resolve => callbackServer.close(resolve));
  await disconnectPrisma();
}
