import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
const databaseUrl = process.env.DATABASE_URL_TEST;
test('HTTP MCP enforces immutable grants, session ownership and revocation', { skip: !databaseUrl && 'Requires isolated PostgreSQL via DATABASE_URL_TEST' }, async t => {
  const parsed = new URL(databaseUrl);
  assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname) && /test/.test(parsed.pathname));
  process.env.DATABASE_URL = databaseUrl; process.env.MCP_ENCRYPTION_KEY = 'c'.repeat(64);
  const { startHttpServer } = await import('../../dist/transports/http-server.js');
  const { createMcpServer } = await import('../../dist/server.js');
  const { getPrisma } = await import('../../dist/db/prisma.js');
  const { hashSecret } = await import('../../dist/auth/oauth-utils.js');
  const { encryptToken } = await import('../../dist/db/crypto.js');
  const server = await startHttpServer({ port: 0, createServer: createMcpServer });
  if (!server.listener.listening) await once(server.listener, 'listening');
  const base = `http://127.0.0.1:${server.listener.address().port}`; process.env.MCP_BASE_URL = base;
  const prisma = getPrisma(); const suffix = randomUUID();
  const client = await prisma.oAuthClient.create({ data: { clientName: `HTTP test ${suffix}`, redirectUris: ['https://example.com/callback'], grantTypes: ['authorization_code','refresh_token'] } });
  const user = await prisma.user.create({ data: { email: `http-${suffix}@example.com`, passwordHash: 'not-a-real-password' } });
  const meta = await prisma.metaToken.create({ data: { userId: user.id, accessToken: encryptToken('synthetic-original-token') } });
  // A later connection must not replace the Meta token attached to the first grant.
  await prisma.metaToken.create({ data: { userId: user.id, accessToken: encryptToken('synthetic-later-token') } });
  const token = randomBytes(32).toString('base64url'); const secondToken = randomBytes(32).toString('base64url');
  const data = { clientId: client.id, userId: user.id, scope: 'ads_read', expiresAt: new Date(Date.now()+60000), resource: `${base}/mcp`, selectedAccountIds: ['act_100'], metaTokenId: meta.id };
  await prisma.oAuthAccessToken.create({ data: { ...data, token: hashSecret(token) } });
  await prisma.oAuthAccessToken.create({ data: { ...data, token: hashSecret(secondToken) } });
  const nativeFetch = globalThis.fetch; const graphRequests = [];
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname !== 'graph.facebook.com') return nativeFetch(url, options);
    graphRequests.push({ url: String(url), options });
    if (options?.method === 'POST') return new Response(JSON.stringify({ id: '100003' }));
    return new Response(JSON.stringify(new URL(url).pathname.endsWith('/222') ? { id: '222', account_id: '200' } : { data: [{ id: 'act_100' }, { id: 'act_200' }] }));
  };
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    await prisma.oAuthFlow.deleteMany({ where: { clientId: client.id } });
    await prisma.oAuthAccessToken.deleteMany({ where: { clientId: client.id } });
    await prisma.metaToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.oAuthClient.delete({ where: { id: client.id } });
    await server.close();
  });
  const headers = (bearer = token, session) => ({ Authorization: `Bearer ${bearer}`, 'Content-Type':'application/json', Accept:'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) });
  const post = (method, params, bearer = token, session, extra = {}) => nativeFetch(`${base}/mcp`, { method:'POST', headers: { ...headers(bearer,session), ...extra }, body:JSON.stringify({ jsonrpc:'2.0', id:1, method, params }) });
  const beginAuthorization = async scope => {
    const query = new URLSearchParams({ client_id: client.id, redirect_uri: client.redirectUris[0], response_type: 'code', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256', resource: `${base}/mcp`, scope });
    const response = await nativeFetch(`${base}/oauth/authorize?${query}`, { redirect: 'manual' });
    assert.equal(response.status, 200);
    const flowId = /name="flow" value="([^"]+)"/.exec(await response.text())?.[1];
    assert.ok(flowId);
    return prisma.oAuthFlow.findUniqueOrThrow({ where: { id: flowId } });
  };
  await t.test('the MCP challenge advertises management and its scopes reach OAuth unchanged', async () => {
    const response = await nativeFetch(`${base}/mcp`);
    assert.equal(response.status, 401);
    const scope = /(?:^|,\s*)scope="([^"]+)"/.exec(response.headers.get('www-authenticate'))?.[1];
    assert.equal(scope, 'ads_read ads_management');
    for (const path of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server']) {
      const metadata = await (await nativeFetch(`${base}${path}`)).json();
      assert.deepEqual(metadata.scopes_supported, scope.split(' '));
    }
    const flow = await beginAuthorization(scope);
    assert.equal(flow.scope, scope);
    assert.equal(flow.clientId, client.id);
    assert.equal(flow.resource, `${base}/mcp`);
    assert.equal(flow.userId, null);
    assert.equal(await prisma.authorizationCode.count({ where: { clientId: client.id } }), 0);
  });
  await t.test('a client explicitly requesting read access still receives a read-only flow', async () => {
    const flow = await beginAuthorization('ads_read');
    assert.equal(flow.scope, 'ads_read');
    assert.equal((await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(token) } })).scope, 'ads_read');
  });
  let session;
  await t.test('initialize and list the actual catalog over SDK Streamable HTTP', async () => {
    const res = await post('initialize',{ protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'http-test',version:'1'} });
    assert.equal(res.status,200); session = res.headers.get('mcp-session-id'); assert.ok(session);
    const listed = await post('tools/list',{},token,session); assert.equal((await listed.json()).result.tools.length,68);
  });
  await t.test('requests from unapproved browser origins are rejected', async () => {
    const res = await post('tools/list',{},token,session,{Origin:'https://unapproved.example'});
    assert.equal(res.status,403);
  });
  await t.test('a different grant cannot reuse the session for POST, GET or DELETE', async () => {
    for (const method of ['POST','GET','DELETE']) {
      const res = await nativeFetch(`${base}/mcp`, { method, headers: headers(secondToken,session), ...(method==='POST'?{body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}:{}) });
      assert.equal(res.status,404);
    }
  });
  await t.test('Meta token snapshot and selected account filter survive later connections and debug headers', async () => {
    const res = await post('tools/call', { name:'discover_ad_accounts', arguments:{} }, token,session,{'X-Meta-Access-Token':'injected'});
    const payload = await res.json(); assert.ok(!payload.result.isError); assert.doesNotMatch(JSON.stringify(payload),/act_200/);
    assert.ok(graphRequests.length); assert.ok(graphRequests.every(call => JSON.stringify(call.options).includes('synthetic-original-token') || call.url.includes('synthetic-original-token')));
    assert.ok(!JSON.stringify(graphRequests).includes('synthetic-later-token')); assert.ok(!JSON.stringify(graphRequests).includes('injected'));
  });
  await t.test('raw mutations and cross-account objects are denied through real MCP calls', async () => {
    for (const args of [{ method:'POST',endpoint:'act_100/campaigns',params:{name:'blocked'} }, { method:'GET',endpoint:'222',params:{} }]) {
      const res = await post('tools/call',{name:'execute_api',arguments:args},token,session); assert.equal((await res.json()).result.isError,true);
    }
  });
  await t.test('a separate management grant can mutate its selected account without upgrading read grants', async () => {
    const managementToken = randomBytes(32).toString('base64url');
    await prisma.oAuthAccessToken.create({ data: { ...data, token: hashSecret(managementToken), scope: 'ads_read ads_management' } });
    const initialized = await post('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'management-test', version: '1' } }, managementToken);
    assert.equal(initialized.status, 200);
    const managementSession = initialized.headers.get('mcp-session-id');
    assert.ok(managementSession);
    const args = { name: 'execute_api', arguments: { method: 'POST', endpoint: 'act_100/campaigns', params: { name: 'synthetic-paused-campaign', status: 'PAUSED' } } };
    const written = await post('tools/call', args, managementToken, managementSession);
    assert.ok(!(await written.json()).result.isError);
    assert.ok(graphRequests.some(call => new URL(call.url).pathname.endsWith('/act_100/campaigns') && call.options.method === 'POST'));
    const count = graphRequests.length;
    assert.equal((await (await post('tools/call', args, token, session)).json()).result.isError, true);
    assert.equal(graphRequests.length, count, 'read-only mutation must be blocked before calling Meta');
    assert.equal((await prisma.oAuthAccessToken.findUniqueOrThrow({ where: { token: hashSecret(token) } })).scope, 'ads_read');
  });
  await t.test('deleted grants stop every existing session request', async () => {
    await prisma.oAuthAccessToken.delete({ where:{token:hashSecret(token)} });
    for (const method of ['GET','DELETE']) assert.equal((await nativeFetch(`${base}/mcp`,{method,headers:headers(token,session)})).status,401);
    assert.equal((await post('tools/list',{},token,session)).status,401);
  });
  await t.test('a token for another resource or invalid scope cannot initialize', async () => {
    await prisma.oAuthAccessToken.update({where:{token:hashSecret(secondToken)},data:{resource:'https://elsewhere.example/mcp'}});
    assert.equal((await post('initialize',{},secondToken)).status,401);
    await prisma.oAuthAccessToken.update({where:{token:hashSecret(secondToken)},data:{resource:`${base}/mcp`,scope:'ads_management_evil'}});
    assert.equal((await post('initialize',{},secondToken)).status,401);
  });
});
