import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ORIGIN = 'https://developers.facebook.com';
export const PREFIX = '/documentation/ads-commerce/marketing-api';
export const canonical = (suffix = '') => `${PREFIX}${suffix ? `/${suffix}` : ''}`;
export const url = (suffix = '') => `${ORIGIN}${canonical(suffix)}`;
export const markdown = (title, body = 'Reference content with sufficient detail to be accepted by the collector.') => `# ${title}\n\n${body}`;
export const oldDoc = (name) => `---\ntitle: "${name}"\nsource: "${url(name.replace(/\.md$/, ''))}"\nscraped_at: "2026-01-01T00:00:00.000Z"\n---\n\n# ${name}\n\nPreviously collected content.\n`;
export const page = (name) => ({ path: canonical(name), file: `${name}.md`, title: name, origin: 'nav' });

export function sandbox(t, { pages = [], docs = {}, manifest, cache = {}, index } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faceads-scraper-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  write(dir, 'package.json', { type: 'module' });
  write(dir, 'discovered-urls.json', { pages });
  if (index) write(dir, 'url-index.json', index);
  if (manifest) write(dir, '.scrape-cache/manifest.json', manifest);
  for (const [name, content] of Object.entries(docs)) write(dir, `docs/${name}`, content);
  for (const [name, content] of Object.entries(cache)) write(dir, `.scrape-cache/pages/${name}`, content);
  return {
    dir,
    read: (name) => fs.readFileSync(path.join(dir, name), 'utf8'),
    json: (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')),
    exists: (name) => fs.existsSync(path.join(dir, name)),
    run(script = 'scrape-docs.js', args = [], fixture = {}) {
      write(dir, 'fixture.json', fixture);
      write(dir, 'requests.jsonl', '');
      const result = spawnSync(process.execPath, [
        '--import', fileURLToPath(new URL('./fixture-http.mjs', import.meta.url)),
        path.join(dir, 'scripts', script), ...args,
      ], {
        cwd: dir,
        // Deliberately omit the parent environment, credentials, and .env.
        env: {
          PATH: process.env.PATH ?? '',
          SCRAPER_FIXTURE_FILE: path.join(dir, 'fixture.json'),
          SCRAPER_REQUEST_LOG: path.join(dir, 'requests.jsonl'),
        },
        encoding: 'utf8', timeout: 20000,
      });
      return {
        ...result,
        requests: fs.readFileSync(path.join(dir, 'requests.jsonl'), 'utf8').trim()
          .split('\n').filter(Boolean).map((line) => JSON.parse(line)),
      };
    },
  };
}

function write(dir, name, content) {
  const target = path.join(dir, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
}
