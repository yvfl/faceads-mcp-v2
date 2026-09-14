import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyPkceS256, parseScopes, scopeToPermission, isAllowedRedirectUri, hashPassword, verifyPassword, hashSecret } from '../../dist/auth/oauth-utils.js';
import { renderLoginPage } from '../../dist/ui/pages.js';
import { validateMetaConnection, MetaValidationError } from '../../dist/auth/meta-validation.js';

test('PKCE accepts S256 and rejects short, malformed and different verifiers', () => {
  const verifier = 'a'.repeat(43); const challenge = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(verifyPkceS256(verifier, challenge), true);
  for (const value of ['short', 'a'.repeat(129), 'b'.repeat(43), '*'.repeat(43)]) assert.equal(verifyPkceS256(value, challenge), false);
});
test('only exact supported scopes permit management', () => {
  assert.equal(parseScopes(undefined), 'ads_read');
  assert.equal(parseScopes('ads_read ads_read ads_management'), 'ads_read ads_management');
  for (const value of ['write', 'ads_management_extra', ['ads_read'], 'unknown']) assert.equal(parseScopes(value), null);
  assert.equal(scopeToPermission('ads_management_extra'), 'read');
  assert.equal(scopeToPermission('ads_read ads_management'), 'readwrite');
});
test('callback validation excludes cleartext public origins, credentials and fragments', () => {
  for (const value of ['https://client.example/callback', 'http://localhost:3001/callback', 'http://127.0.0.1:8000/cb']) assert.equal(isAllowedRedirectUri(value), true);
  for (const value of ['http://client.example/cb', 'javascript:alert(1)', 'https://client.example/cb#hash', 'https://user:pass@client.example', ['https://safe.example']]) assert.equal(isAllowedRedirectUri(value), false);
});
test('password hashes are salted, bounded and tolerate malformed stored hashes', () => {
  const first = hashPassword('long-test-password');
  assert.notEqual(first, hashPassword('long-test-password'));
  assert.equal(verifyPassword('long-test-password', first), true);
  assert.equal(verifyPassword('wrong-password', first), false);
  assert.equal(verifyPassword('password', 'zz:zz'), false);
  assert.equal(verifyPassword('a'.repeat(257), first), false);
  assert.notEqual(hashSecret('opaque-token'), 'opaque-token');
});
test('login HTML escapes client metadata and preserves accessible form semantics', () => {
  const html = renderLoginPage({ flow: 'id', csrf: 'secret', clientName: '<script>alert("x")</script>', scope: 'ads_read' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('lang="pt-BR"'));
  assert.ok(html.includes('autocomplete="current-password"'));
  assert.ok(html.includes('prefers-reduced-motion'));
});
test('Meta validation reads provider identity, permissions and paginated real accounts', async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url.toString(), options]);
    const path = new URL(url).pathname;
    const data = path.endsWith('/me') ? { id: '123' } : path.endsWith('/permissions') ? { data: [{ permission: 'ads_read', status: 'granted' }] } : new URL(url).searchParams.has('after') ? { data: [{ id: 'act_2', name: 'Second' }] } : { data: [{ id: 'act_1', name: 'First' }], paging: { next: 'https://evil.example/?access_token=leak', cursors: { after: 'cursor' } } };
    return new Response(JSON.stringify(data));
  };
  try {
    const result = await validateMetaConnection('synthetic-meta-token', false);
    assert.deepEqual(result.accounts.map(value => value.id), ['act_1', 'act_2']);
    assert.equal(result.metaUserId, '123');
    assert.ok(calls.every(([url, options]) => url.startsWith('https://graph.facebook.com/') && !url.includes('synthetic-meta-token') && options.headers.Authorization === 'Bearer synthetic-meta-token' && options.redirect === 'error'));
    await assert.rejects(() => validateMetaConnection('synthetic-meta-token', true), MetaValidationError);
  } finally { globalThis.fetch = original; }
});
test('Meta errors never echo the provider token and empty ad account lists are rejected', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'secret-provider-token' } }), { status: 401 });
    await assert.rejects(() => validateMetaConnection('test-token', false), error => error instanceof MetaValidationError && !error.message.includes('secret-provider-token'));
    globalThis.fetch = async url => new Response(JSON.stringify(new URL(url).pathname.endsWith('/me') ? { id: '123' } : new URL(url).pathname.endsWith('/permissions') ? { data: [{ permission: 'ads_read', status: 'granted' }] } : { data: [] }));
    await assert.rejects(() => validateMetaConnection('test-token', false), /contas de anúncios/);
  } finally { globalThis.fetch = original; }
});
