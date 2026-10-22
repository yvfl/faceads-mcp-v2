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
  const text = textOf(result);
  assert.match(text, /Consulta completa/);
  assert.match(text, /"returned_count":2/);
  assert.match(text, /1234\.56/);
  assert.match(text, /789\.01/);
});
