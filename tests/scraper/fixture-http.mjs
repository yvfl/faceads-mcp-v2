import fs from 'node:fs';

// This module is preloaded only by disposable scraper subprocesses. A missing
// fixture always throws; there is no fallback to the network or local .env.
const fixture = JSON.parse(fs.readFileSync(process.env.SCRAPER_FIXTURE_FILE, 'utf8'));
const counters = new Map();
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  fs.appendFileSync(process.env.SCRAPER_REQUEST_LOG, `${JSON.stringify({ url, headers: init.headers })}\n`);
  const route = fixture[url];
  if (!route) throw new Error(`Unmocked network request blocked: ${url}`);
  const responses = Array.isArray(route) ? route : [route];
  const count = counters.get(url) ?? 0;
  counters.set(url, count + 1);
  const response = responses[Math.min(count, responses.length - 1)];
  if (response.error) throw new Error(response.error);
  const result = new Response(response.body ?? '', {
    status: response.status ?? 200,
    headers: { 'content-type': response.contentType ?? 'text/markdown; charset=utf-8' },
  });
  Object.defineProperty(result, 'url', { value: response.finalUrl ?? url });
  return result;
};

// Remove only production rate-limit/backoff delays. Keep request timeouts intact.
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, ms, ...args) => originalSetTimeout(
  callback, [500, 2000, 4000, 6000].includes(ms) ? 0 : ms, ...args,
);
