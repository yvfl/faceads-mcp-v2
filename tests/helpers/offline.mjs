import assert from 'node:assert/strict';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Set this BEFORE dynamically importing dist: config.ts otherwise loads the
// developer's .env at import time. Every credential used below is synthetic.
process.env.META_ACCESS_TOKEN = 'offline-env-token-never-valid';
delete process.env.META_API_VERSION;
globalThis.fetch = async () => {
  throw new Error('Offline test attempted an unmocked fetch; real network is disabled');
};

export const { MetaClient, MetaClientError } = await import('../../dist/meta-client.js');
export const { withAuthContext, getAuthContext } = await import('../../dist/utils/auth-context.js');
export const { apiTools, handleApiTool, isApiTool } = await import('../../dist/api-tools.js');
export const { apiSchemas } = await import('../../dist/schemas/api-schemas.js');

export const ACCOUNT = 'act_100001';
export const TOKEN = 'offline-request-token-never-valid';
export const textOf = (result) => result.content.map((block) => block.text ?? '').join('\n');
export const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

/** Installs a strict fake; there is deliberately no fallback to the real fetch. */
export function fakeFetch(t, responder = () => ({ data: [], id: '900001', success: true })) {
  const journalRoot = resolve('.audit-results/test-operation-journals');
  mkdirSync(journalRoot, { recursive: true });
  const journalDirectory = mkdtempSync(join(journalRoot, 'test-'));
  const previousJournalDirectory = process.env.FACEADS_OPERATIONS_DIR;
  process.env.FACEADS_OPERATIONS_DIR = journalDirectory;
  t.after(() => {
    if (previousJournalDirectory === undefined) delete process.env.FACEADS_OPERATIONS_DIR;
    else process.env.FACEADS_OPERATIONS_DIR = previousJournalDirectory;
    rmSync(journalDirectory, { recursive: true, force: true });
  });
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const call = {
      url,
      path: url.pathname,
      method: init.method ?? 'GET',
      body: new URLSearchParams(init.body ?? ''),
      headers: init.headers ?? {},
    };
    calls.push(call);
    const result = await responder(call, calls.length);
    return result instanceof Response ? result : jsonResponse(result);
  };
  t.mock.method(dns.promises, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  for (const transport of [http, https]) t.mock.method(transport, 'request', (url, options, callback) => {
    const request = new EventEmitter();
    request.end = () => { void (async () => {
      try {
        const response = await globalThis.fetch(String(url), options);
        const stream = Readable.from([Buffer.from(await response.arrayBuffer())]);
        stream.statusCode = response.status;
        stream.headers = Object.fromEntries(response.headers.entries());
        callback(stream);
      } catch (error) { request.emit('error', error); }
    })(); };
    return request;
  });
  t.after(() => { globalThis.fetch = previous; });
  return calls;
}

export function callTool(name, args, context = {}) {
  return withAuthContext({ accessToken: TOKEN, permissions: 'readwrite', ...context },
    () => handleApiTool(name, structuredClone(args)));
}

export function assertSuccess(result) {
  assert.notEqual(result.isError, true, textOf(result));
  assert.doesNotMatch(textOf(result), /# Erro|Tool desconhecida|NaN|undefined/, textOf(result));
}

export const adsetArgs = (overrides = {}) => ({
  account_id: ACCOUNT,
  campaign_id: '200001',
  name: 'Offline audit ad set',
  billing_event: 'IMPRESSIONS',
  optimization_goal: 'LINK_CLICKS',
  daily_budget: 1000,
  targeting: { geo_locations: { countries: ['BR'] } },
  ...overrides,
});

export const wrapperArgs = {
  create_threads_ad_set: adsetArgs(),
  create_click_to_message_ad_set: adsetArgs({
    destination: 'WHATSAPP', page_id: '300001',
    whatsapp_phone_number: '+5511999990000', optimization_goal: 'CONVERSATIONS',
  }),
  create_partnership_ad_creative: {
    account_id: ACCOUNT, name: 'Offline partnership', mode: 'use_new_creative',
    object_story_spec: { page_id: '300001', link_data: { link: 'https://example.test/product', message: 'Offline' } },
    facebook_branded_content: { sponsor_page_id: '300002' },
  },
};
