import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, TOKEN, MetaClient, callTool, fakeFetch, jsonResponse, textOf, withAuthContext } from '../helpers/offline.mjs';
import { handleDiagnoseConnection, diagnoseConnectionSchema } from '../../dist/tools/connection-diagnostics.js';
import { connectionCapabilities, describeConnectionFailure } from '../../dist/auth/connection-capabilities.js';
import { authorizeGraphRequest } from '../../dist/auth/account-authorization.js';
import { validateMetaConnection, MetaValidationError } from '../../dist/auth/meta-validation.js';

const readGrant = { accessToken: TOKEN, permissions: 'read', allowedAccountIds: [ACCOUNT], grantId: 'private-grant-id' };
const permission = (name, status = 'granted') => ({ permission: name, status });
const capability = (report, family, operation) => report.capabilities.find(item => item.family === family && item.operation === operation);
const invoke = (changes = {}, pagination = { mode: 'all' }) => withAuthContext({ ...readGrant, ...changes }, async () => JSON.parse(textOf(await handleDiagnoseConnection(new MetaClient({ pagination }), {}))));

test('diagnostic reads current permissions through the authorized Graph transport and exposes no credentials', async t => {
  const calls = fakeFetch(t, call => {
    assert.equal(call.path, '/v26.0/me/permissions');
    return { data: [permission('ads_read'), permission('pages_show_list'), permission('instagram_basic'), permission('pages_read_engagement'), { ...permission('ads_management', 'declined'), access_token: 'provider-secret' }, permission('provider-secret', 'granted')], access_token: 'provider-secret' };
  });
  const report = await invoke();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url.searchParams.get('fields'), 'permission,status');
  assert.equal(calls[0].url.searchParams.get('access_token'), TOKEN);
  assert.deepEqual(report.local_authorization, { permissions: 'read', account_scope: 'selected_accounts', allowed_account_ids: [ACCOUNT], accounts_access: 'not_tested' });
  assert.equal(report.meta_permissions.status, 'verified');
  assert.equal(report.meta_permissions.complete, true);
  assert.equal(capability(report, 'ads', 'read').status, 'scope_present');
  assert.equal(capability(report, 'ads', 'manage').status, 'blocked_locally');
  assert.equal(capability(report, 'pages', 'discover').status, 'scope_present');
  assert.equal(capability(report, 'instagram', 'read_linked_account').status, 'scope_present');
  for (const row of report.capabilities) {
    assert.equal(row.asset_access, 'not_tested');
    assert.equal(row.meta_rollout, 'not_tested');
  }
  assert.doesNotMatch(JSON.stringify(report), /provider-secret|offline-request-token|private-grant-id|access_token/);
});

test('scope evidence keeps local read grants separate from Meta management permissions', () => {
  const rows = connectionCapabilities(readGrant, [permission('ads_management')], true);
  assert.equal(rows.find(row => row.family === 'ads' && row.operation === 'read').status, 'scope_present');
  assert.equal(rows.find(row => row.operation === 'manage').status, 'blocked_locally');
  assert.equal(rows.find(row => row.family === 'pages').status, 'missing_scope');
  assert.match(rows.find(row => row.family === 'pages').action, /pages_show_list/);
  assert.equal(connectionCapabilities({ ...readGrant, permissions: 'readwrite' }, [], true).find(row => row.operation === 'manage').status, 'missing_scope');
  assert.deepEqual(connectionCapabilities(readGrant, [permission('ads_management')], true).find(row => row.operation === 'read').missing_permission_groups, []);
});

test('incomplete permission evidence never asserts missing scopes or available asset access', () => {
  const rows = connectionCapabilities({ ...readGrant, permissions: 'readwrite' }, [permission('ads_read')], false);
  assert.equal(rows.find(row => row.operation === 'read').status, 'scope_present');
  for (const row of rows.filter(row => row.operation !== 'read')) {
    assert.equal(row.status, 'unknown');
    assert.equal('missing_permission_groups' in row, false);
    assert.equal(row.asset_access, 'not_tested');
  }
});

test('declined and expired scopes are missing when the permission list is complete', async t => {
  fakeFetch(t, () => ({ data: [permission('ads_read', 'declined'), permission('ads_management', 'expired')] }));
  const report = await invoke({ permissions: 'readwrite' });
  assert.equal(capability(report, 'ads', 'read').status, 'missing_scope');
  assert.equal(capability(report, 'ads', 'manage').status, 'missing_scope');
  assert.deepEqual(capability(report, 'ads', 'read').missing_permission_groups, [['ads_read', 'ads_management']]);
});

for (const code of [190, 200, 10, 613]) test(`Meta permission error ${code} has a safe actionable explanation and unknown capabilities`, async t => {
  fakeFetch(t, () => jsonResponse({ error: { code, type: 'OAuthException', message: 'provider-secret access_token=provider-secret', error_user_msg: TOKEN } }, 400));
  const report = await invoke({ permissions: 'readwrite' });
  assert.equal(report.meta_permissions.status, 'unavailable');
  assert.equal(report.meta_permissions.complete, false);
  assert.equal(report.meta_permissions.failure.code, code);
  assert.ok(report.capabilities.every(row => row.status === 'unknown'));
  assert.doesNotMatch(JSON.stringify(report), /provider-secret|offline-request-token/);
  assert.match(report.meta_permissions.failure.action, code === 190 ? /tela de conexão/ : code === 613 ? /Aguarde/ : /ativos atribuídos/);
});

test('malformed permission payload and unknown scope status remain inconclusive', async t => {
  for (const payload of [{}, { data: [null] }, { data: [permission('ads_read', 'unknown-provider-state')] }]) {
    fakeFetch(t, () => payload);
    const report = await invoke({ permissions: 'readwrite' });
    assert.equal(report.meta_permissions.complete, false);
    assert.equal(capability(report, 'ads', 'read').status, 'unknown');
  }
});

test('diagnostic follows opaque permission cursors on the fixed Graph host and removes raw continuations', async t => {
  const calls = fakeFetch(t, call => call.url.searchParams.has('after')
    ? { data: [permission('pages_show_list')] }
    : { data: [permission('ads_read')], paging: { next: 'https://evil.example/?access_token=provider-secret', cursors: { after: 'cursor +/=' } } });
  const client = new MetaClient({ pagination: { mode: 'all' } });
  const report = await withAuthContext(readGrant, async () => JSON.parse(textOf(await handleDiagnoseConnection(client, {}))));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('after'), 'cursor +/=');
  assert.ok(calls.every(call => call.url.hostname === 'graph.facebook.com' && call.method === 'GET'));
  assert.equal(report.meta_permissions.complete, true);
  assert.equal(report.meta_permissions.checked_pages, 2);
  assert.equal(capability(report, 'pages', 'discover').status, 'scope_present');
  assert.deepEqual(client.nextPages.filter(page => page.endpoint === 'me/permissions'), []);
  assert.doesNotMatch(JSON.stringify(report), /provider-secret|evil.example/);
});

test('repeated permission cursor cannot loop or make missing scopes look confirmed', async t => {
  const calls = fakeFetch(t, () => ({ data: [permission('ads_read')], paging: { next: 'opaque', cursors: { after: 'repeat' } } }));
  const report = await invoke();
  assert.equal(calls.length, 2);
  assert.equal(report.meta_permissions.complete, false);
  assert.equal(capability(report, 'pages', 'discover').status, 'unknown');
});

test('permission page limit is explicit and never confirms missing scopes', async t => {
  const calls = fakeFetch(t, (_, index) => ({ data: [permission('ads_read')], paging: { next: 'opaque', cursors: { after: `cursor-${index}` } } }));
  const report = await invoke({}, { mode: 'all', maxPages: 2 });
  assert.equal(calls.length, 2);
  assert.equal(report.meta_permissions.status, 'partial');
  assert.equal(report.meta_permissions.complete, false);
  assert.equal(capability(report, 'pages', 'discover').status, 'unknown');
  assert.match(report.meta_permissions.failure.action, /desde o início/);
});

test('a final permission page fetched after a caller cursor cannot prove absent earlier scopes', async t => {
  fakeFetch(t, () => ({ data: [permission('pages_show_list')] }));
  const report = await invoke({}, { mode: 'all', initialQuery: { after: 'page2' } });
  assert.equal(report.meta_permissions.status, 'partial');
  assert.equal(report.meta_permissions.complete, false);
  assert.equal(capability(report, 'ads', 'read').status, 'unknown');
  assert.equal(capability(report, 'pages', 'discover').status, 'scope_present');
});

test('failure on a later permission page preserves only known scope evidence and safe failure details', async t => {
  fakeFetch(t, (_, index) => index === 1
    ? { data: [permission('ads_read')], paging: { next: 'opaque', cursors: { after: 'page2' } } }
    : jsonResponse({ error: { code: 200, type: 'OAuthException', message: 'provider-secret access_token=provider-secret' } }, 400));
  const report = await invoke();
  assert.equal(report.meta_permissions.status, 'partial');
  assert.equal(report.meta_permissions.failure.code, 200);
  assert.equal(capability(report, 'pages', 'discover').status, 'unknown');
  assert.doesNotMatch(JSON.stringify(report), /provider-secret/);
});

test('no selected accounts means locally blocked capabilities and no provider access', async t => {
  const calls = fakeFetch(t);
  const report = await invoke({ allowedAccountIds: [] });
  assert.equal(calls.length, 0);
  assert.ok(report.capabilities.every(row => row.status === 'blocked_locally'));
  assert.ok(report.capabilities.every(row => /Selecione/.test(row.action)));
});

test('diagnostic schema rejects caller credentials and account scope overrides', () => {
  assert.equal(diagnoseConnectionSchema.safeParse({}).success, true);
  for (const value of [{ access_token: 'ignored' }, { account_id: 'act_999999' }, { permissions: 'readwrite' }]) assert.equal(diagnoseConnectionSchema.safeParse(value).success, false);
});

test('permission Graph gate is GET-only and allows only minimal fields and cursor controls', async () => {
  const read = async () => { throw new Error('The identity permission edge should require no ownership probes'); };
  const run = (method, params) => withAuthContext(readGrant, () => authorizeGraphRequest('me/permissions', method, params, read));
  await run('GET', { fields: 'permission,status', limit: '100', after: 'opaque' });
  for (const method of ['POST', 'DELETE']) await assert.rejects(run(method, {}));
  for (const params of [{ fields: 'access_token' }, { fields: 'permission,accounts' }, { extra: 'value' }, { ids: '123' }, { method: 'POST' }, { fields: 'permissions{permission}' }]) await assert.rejects(run('GET', params));
});

test('registered diagnostic is callable by a read-only grant', async t => {
  fakeFetch(t, () => ({ data: [permission('ads_read')] }));
  const result = await callTool('diagnose_connection', {}, readGrant);
  assert.notEqual(result.isError, true, textOf(result));
  assert.equal(JSON.parse(textOf(result)).meta_permissions.status, 'verified');
});

for (const code of [190, 200]) test(`login validation preserves the error type and explains Meta ${code} without echoing secrets`, async t => {
  fakeFetch(t, () => jsonResponse({ error: { code, message: 'provider-secret' } }, 400));
  await assert.rejects(validateMetaConnection('synthetic-meta-token', false), error => {
    assert.ok(error instanceof MetaValidationError);
    assert.doesNotMatch(error.message, /provider-secret|synthetic-meta-token/);
    assert.match(error.message, code === 190 ? /tela de conexão/ : /ativos atribuídos/);
    return true;
  });
});

test('unknown provider exceptions do not become token-expiry diagnoses', () => {
  const failure = describeConnectionFailure(new Error('secret access_token=secret'));
  assert.equal(failure.code, undefined);
  assert.doesNotMatch(JSON.stringify(failure), /secret|expirou|revogado/);
});

test('login accepts a required Ads scope found only on a later permission page', async t => {
  const calls = fakeFetch(t, call => call.path.endsWith('/me') ? { id: '123' }
    : call.path.endsWith('/permissions') ? call.url.searchParams.has('after')
      ? { data: [permission('ads_read')] }
      : { data: [permission('pages_show_list')], paging: { next: 'https://untrusted.example/?access_token=provider-secret', cursors: { after: 'page2' } } }
    : { data: [{ id: ACCOUNT, name: 'Authorized' }] });
  const result = await validateMetaConnection('synthetic-meta-token', false);
  assert.deepEqual(result.accounts.map(account => account.id), [ACCOUNT]);
  const permissionCalls = calls.filter(call => call.path.endsWith('/permissions'));
  assert.equal(permissionCalls.length, 2);
  assert.equal(permissionCalls[1].url.searchParams.get('after'), 'page2');
  assert.ok(calls.every(call => call.url.hostname === 'graph.facebook.com' && call.method === 'GET'));
});

test('login does not call an incomplete permission list missing permissions or accept cyclic pages', async t => {
  const calls = fakeFetch(t, call => call.path.endsWith('/me') ? { id: '123' }
    : { data: [permission('ads_read')], paging: { next: 'opaque', cursors: { after: 'repeat' } } });
  await assert.rejects(validateMetaConnection('synthetic-meta-token', false), /concluir a consulta de permissões/);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => !call.path.endsWith('/adaccounts')));
});
