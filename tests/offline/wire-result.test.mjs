import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT, fakeFetch, textOf } from '../helpers/offline.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const { createMcpServer } = await import('../../dist/server.js');

// Clients may forward structuredContent in place of content. Without an outputSchema the wire
// result must carry the data only in content, or paginated reads reach the model without rows.
test('paginated reads reach the client with their rows and without structuredContent', async t => {
  fakeFetch(t, () => ({ data: [
    { spend: '1234.56', date_start: '2026-01-01', date_stop: '2026-01-31' },
    { spend: '789.01', date_start: '2026-02-01', date_stop: '2026-02-28' },
  ] }));
  const server = createMcpServer();
  const client = new Client({ name: 'wire-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(() => client.close());

  const result = await client.callTool({ name: 'execute_api', arguments: {
    account_id: ACCOUNT, endpoint: `${ACCOUNT}/insights`, method: 'GET',
    params: { fields: 'spend', level: 'account', time_increment: 'monthly' },
  } });

  assert.equal(result.isError, undefined);
  assert.equal('structuredContent' in result, false);
  // Clients that read only the first block need the rows there; the pagination summary goes last.
  const [first] = result.content;
  assert.match(first.text, /^# Resultado da API/);
  assert.match(first.text, /1234\.56/);
  assert.match(first.text, /789\.01/);
  const last = result.content.at(-1).text;
  assert.match(last, /^Consulta completa/);
  assert.match(last, /"returned_count":2/);
});

test('a partial result keeps its rows in the first block and still opens with the warning', async t => {
  fakeFetch(t, call => ({
    data: [{ spend: call.url.searchParams.has('after') ? '20.00' : '10.00' }],
    paging: { next: 'https://graph.facebook.com/next', cursors: { after: call.url.searchParams.has('after') ? 'page-3' : 'page-2' } },
  }));
  const server = createMcpServer();
  const client = new Client({ name: 'wire-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  t.after(() => client.close());

  const result = await client.callTool({ name: 'execute_api', arguments: {
    account_id: ACCOUNT, endpoint: `${ACCOUNT}/insights`, method: 'GET',
    params: { fields: 'spend' }, pagination_mode: 'all', max_pages: 2,
  } });

  const [first] = result.content;
  assert.match(first.text, /^RESULTADO INCOMPLETO/);
  assert.match(first.text, /# Resultado da API/);
  assert.match(first.text, /10\.00/);
  assert.match(first.text, /20\.00/);
  assert.match(textOf(result), /"reason":"page_limit"/);
});
