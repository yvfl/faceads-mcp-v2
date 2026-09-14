import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MetaClient, MetaClientError, withAuthContext, getAuthContext, fakeFetch,
  jsonResponse, TOKEN, ACCOUNT, callTool, textOf, assertSuccess,
} from '../helpers/offline.mjs';

test('stdio and request auth default to v26.0; request can select an explicit version', async (t) => {
  const calls = fakeFetch(t);
  await new MetaClient().get('me');
  await withAuthContext({ accessToken: TOKEN }, () => new MetaClient().get('me'));
  await withAuthContext({ accessToken: TOKEN, apiVersion: 'v25.0' }, () => new MetaClient().get('me'));
  assert.deepEqual(calls.map((c) => c.path), ['/v26.0/me', '/v26.0/me', '/v25.0/me']);
  assert.deepEqual(calls.map((c) => c.url.searchParams.get('access_token')), [
    'offline-env-token-never-valid', TOKEN, TOKEN,
  ]);
});

test('concurrent tenants preserve their tokens and versions through async continuations', async (t) => {
  const calls = fakeFetch(t, async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return { data: [] };
  });
  assert.equal(getAuthContext(), null);
  await Promise.all(Array.from({ length: 12 }, (_, index) => withAuthContext({
    accessToken: `fake-tenant-${index}`, apiVersion: index % 2 ? 'v25.0' : 'v26.0',
  }, async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const client = new MetaClient();
    await client.get(`tenant-${index}`);
    await client.post(`tenant-${index}`, { name: `tenant-${index}` });
    assert.equal(getAuthContext().accessToken, `fake-tenant-${index}`);
  })));
  assert.equal(calls.length, 24);
  for (const call of calls) {
    const index = Number(call.path.split('tenant-')[1]);
    const credentials = call.method === 'POST' ? call.body : call.url.searchParams;
    assert.equal(credentials.get('access_token'), `fake-tenant-${index}`);
    assert.ok(call.path.startsWith(index % 2 ? '/v25.0/' : '/v26.0/'));
  }
  assert.equal(getAuthContext(), null);
});

test('nested and failed auth contexts restore the caller context', async () => {
  await withAuthContext({ accessToken: 'fake-outer' }, async () => {
    await assert.rejects(withAuthContext({ accessToken: 'fake-inner' }, async () => {
      await Promise.resolve();
      assert.equal(getAuthContext().accessToken, 'fake-inner');
      throw new Error('intentional failure');
    }), /intentional failure/);
    assert.equal(getAuthContext().accessToken, 'fake-outer');
  });
  assert.equal(getAuthContext(), null);
});

test('POST encodes objects once, preserves false and zero, omits null and undefined', async (t) => {
  const calls = fakeFetch(t);
  await withAuthContext({ accessToken: TOKEN }, () => new MetaClient().post(`${ACCOUNT}/campaigns`, {
    name: 'Café + ação & sale=1', enabled: false, amount: 0, nothing: null, absent: undefined,
    targeting: { geo_locations: { countries: ['BR'] } }, labels: [{ id: '1' }],
  }));
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, `/v26.0/${ACCOUNT}/campaigns`);
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  const body = calls[0].body;
  assert.equal(body.get('name'), 'Café + ação & sale=1');
  assert.equal(body.get('enabled'), 'false');
  assert.equal(body.get('amount'), '0');
  assert.equal(body.has('nothing'), false);
  assert.equal(body.has('absent'), false);
  assert.deepEqual(JSON.parse(body.get('targeting')), { geo_locations: { countries: ['BR'] } });
  assert.deepEqual(JSON.parse(body.get('labels')), [{ id: '1' }]);
});

test('GET keeps Unicode query and structured insight filters intact', async (t) => {
  const calls = fakeFetch(t);
  const client = new MetaClient();
  await client.searchGeolocation({ q: 'São Paulo & região', location_types: ['city'], country_code: 'BR', limit: 25 });
  await client.getInsights('200001', {
    fields: ['spend', 'actions'], time_range: { since: '2026-09-01', until: '2026-09-12' },
    breakdowns: ['age', 'gender'], action_attribution_windows: ['1d_click', '7d_click'], use_unified_attribution_setting: false,
  });
  assert.equal(calls[0].url.searchParams.get('q'), 'São Paulo & região');
  assert.deepEqual(JSON.parse(calls[0].url.searchParams.get('location_types')), ['city']);
  const query = calls[1].url.searchParams;
  assert.equal(query.get('fields'), 'spend,actions');
  assert.equal(query.get('breakdowns'), 'age,gender');
  assert.equal(query.get('use_unified_attribution_setting'), 'false');
  assert.deepEqual(JSON.parse(query.get('action_attribution_windows')), ['1d_click', '7d_click']);
  assert.deepEqual(JSON.parse(query.get('time_range')), { since: '2026-09-01', until: '2026-09-12' });
});

for (const method of ['get', 'post', 'delete']) {
  test(`${method.toUpperCase()} exposes the structured Graph error, including subcode and trace`, async (t) => {
    fakeFetch(t, () => jsonResponse({ error: {
      message: 'Synthetic permission failure', type: 'OAuthException', code: 190, error_subcode: 463,
      error_user_title: 'Session expired', error_user_msg: 'Replace the test token', fbtrace_id: 'offline-trace',
    } }, 400));
    await assert.rejects(new MetaClient()[method]('200001'), (error) => {
      assert.ok(error instanceof MetaClientError);
      assert.equal(error.code, 190);
      assert.equal(error.errorSubcode, 463);
      assert.equal(error.fbtraceId, 'offline-trace');
      assert.match(String(error), /Session expired/);
      return true;
    });
  });

  test(`${method.toUpperCase()} wraps network errors`, async (t) => {
    const calls = fakeFetch(t, () => { throw new TypeError('synthetic DNS failure'); });
    await assert.rejects(new MetaClient()[method]('200001'), (error) => {
      const diagnostic = method === 'get' ? error : error.operation?.error;
      assert.equal(diagnostic?.type, 'NetworkError');
      assert.equal(diagnostic?.code, -1);
      if (method !== 'get') {
        assert.equal(error.name, 'WriteOperationError');
        assert.equal(error.operation.status, 'unknown');
        assert.equal(error.operation.method, method.toUpperCase());
        assert.equal(error.operation.endpoint, '200001');
      }
      return true;
    });
    assert.equal(calls.length, 1, 'A network failure must never retry a write');
  });

  test(`${method.toUpperCase()} wraps non-JSON provider errors with HTTP status`, async (t) => {
    const calls = fakeFetch(t, () => new Response('<html>unavailable</html>', { status: 503 }));
    await assert.rejects(new MetaClient()[method]('200001'), (error) => {
      const diagnostic = method === 'get' ? error : error.operation?.error;
      assert.equal(diagnostic?.type, 'ParseError');
      assert.equal(diagnostic?.code, 503);
      if (method !== 'get') {
        assert.equal(error.name, 'WriteOperationError');
        assert.equal(error.operation.status, 'unknown');
        assert.equal(error.operation.method, method.toUpperCase());
        assert.equal(error.operation.endpoint, '200001');
      }
      return true;
    });
    assert.equal(calls.length, 1, 'A malformed response must never retry a write');
  });
}

test('tool result marks Graph errors as errors and retains diagnostics', async (t) => {
  fakeFetch(t, () => jsonResponse({ error: { message: 'Offline invalid token', type: 'OAuthException', code: 190, fbtrace_id: 'offline-123' } }, 401));
  const result = await callTool('list_campaigns', { account_id: ACCOUNT });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /190/);
  assert.match(textOf(result), /offline-123/);
});

test('image upload downloads bytes then sends base64, without forwarding auth to image host', async (t) => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const calls = fakeFetch(t, (call) => call.url.hostname === 'assets.example.test'
    ? new Response(bytes, {headers: {'content-type': 'image/png'}}) : { images: { bytes: { hash: 'fake-hash', url: 'https://example.test/image.png' } } });
  const result = await callTool('upload_image', { account_id: ACCOUNT, image_url: 'https://assets.example.test/image.png' });
  assertSuccess(result);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.has('access_token'), false);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].headers.Accept, 'image/*');
  assert.equal(calls[1].body.get('bytes'), bytes.toString('base64'));
  assert.equal(calls[1].path, `/v26.0/${ACCOUNT}/adimages`);
});

for (const [label, response] of [['missing', () => new Response('', { status: 404 })], ['empty', () => new Response('', {headers: {'content-type': 'image/png'}})]]) {
  test(`image upload does not POST a ${label} image`, async (t) => {
    const calls = fakeFetch(t, response);
    await assert.rejects(new MetaClient().uploadImageFromUrl(ACCOUNT, 'https://assets.example.test/image.png'), /imagem|Imagem/i);
    assert.equal(calls.length, 1);
  });
}
