#!/usr/bin/env node
/**
 * Coleta da documentação da Marketing API — sem browser.
 *
 * A Meta serve cada página em markdown quando o request manda
 * `Accept: text/markdown`. O pipeline é:
 *
 *   1. fetch     — baixa cada URL de discovered-urls.json para .scrape-cache/
 *                  (resumível; descarta soft-404, que vem como text/html)
 *   2. expansão  — varre os links encontrados no markdown e busca páginas
 *                  válidas que não estavam no índice (edges da referência)
 *   3. finalize  — reescreve links para caminhos locais, grava docs/ só
 *                  onde o conteúdo mudou e monta url-index.json
 *
 * Flags: --resume, --limit=N, --no-expand, --no-prune, --path=URL (repetível)
 * --path coleta somente as páginas indicadas, sem expansão nem poda.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';
import {
  ORIGIN,
  docPathToFile,
  docPathToUrl,
  decodeEntities,
  fetchWithRetry,
  normalizeDocPath,
  redactCredentialExamples,
  sleep,
} from './lib/docs-http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DOCS_DIR = path.join(ROOT, 'docs');
const CACHE_DIR = path.join(ROOT, '.scrape-cache');
const CACHE_PAGES_DIR = path.join(CACHE_DIR, 'pages');
const DISCOVERED_PATH = path.join(ROOT, 'discovered-urls.json');
const INDEX_PATH = path.join(ROOT, 'url-index.json');
const REPORT_PATH = path.join(ROOT, 'scrape-report.json');

const RATE_LIMIT_MS = 500;
const MAX_EXPANSION_ROUNDS = 2;
// Acima disso a coleta é considerada quebrada e a limpeza de órfãos não roda.
const MAX_ERROR_RATIO_FOR_PRUNE = 0.05;
// Abaixo disso a coleta regravou pouco do que já existia — endpoint mudou ou
// devolveu HTML para tudo — e a limpeza também não roda.
const MIN_WRITTEN_RATIO_FOR_PRUNE = 0.7;

const args = new Set(process.argv.slice(2));
const isResume = args.has('--resume');
const noExpand = args.has('--no-expand');
const noPrune = args.has('--no-prune');
const limitArg = process.argv.slice(2).find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;
if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT < 1)) throw new Error('--limit deve ser um inteiro positivo');
const selectedPaths = process.argv.slice(2).filter((arg) => arg.startsWith('--path=')).map((arg) => {
  const value = normalizeDocPath(arg.slice('--path='.length));
  if (!value) throw new Error('--path deve indicar uma página das famílias oficiais coletadas');
  return value;
});
const isTargeted = selectedPaths.length > 0;
const MANIFEST_PATH = path.join(CACHE_DIR, isTargeted ? 'targeted-manifest.json' : 'manifest.json');

function log(message) {
  process.stdout.write(`${message}\n`);
}

// ============================================
// CACHE
// ============================================

function loadManifest() {
  if (!isResume || !fs.existsSync(MANIFEST_PATH)) {
    return { startedAt: new Date().toISOString(), pages: {} };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    if (manifest && typeof manifest.pages === 'object') return manifest;
  } catch (error) {
    log(`⚠️  Manifesto do cache ilegível (${error.message}). Recomeçando do zero.`);
  }
  return { startedAt: new Date().toISOString(), pages: {} };
}

function saveManifest(manifest) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  writeJsonAtomic(MANIFEST_PATH, manifest);
}

function safeFile(root, file) {
  if (typeof file !== 'string' || !file.endsWith('.md') || file.includes('\\') || /(^|\/)AGENTS\.md$/i.test(file)) return null;
  const target = path.resolve(root, file);
  if (!target.startsWith(`${root}${path.sep}`)) return null;
  // Never follow a cache or docs symlink outside the collection root.
  let cursor = target;
  while (cursor !== root) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) return null;
    cursor = path.dirname(cursor);
  }
  return target;
}

function writeJsonAtomic(target, value) {
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, target);
}

function cachePathFor(file) {
  const target = safeFile(CACHE_PAGES_DIR, file);
  if (!target) throw new Error(`Caminho de cache inválido: ${file}`);
  return target;
}

function writeCache(file, markdown) {
  const target = cachePathFor(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, markdown);
}

function readCache(file) {
  try {
    const target = cachePathFor(file);
    return fs.statSync(target).isFile() ? fs.readFileSync(target, 'utf-8') : null;
  } catch { return null; }
}

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

// ============================================
// FASE 1 — FETCH
// ============================================

/**
 * Busca uma página em markdown.
 * Devolve { ok: true, markdown } ou { ok: false, reason }.
 */
async function fetchDocPage(docPath) {
  const url = docPathToUrl(docPath);

  let response;
  try {
    response = await fetchWithRetry(url, { accept: 'text/markdown' });
  } catch (error) {
    return { ok: false, reason: 'network', detail: error.message };
  }

  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: 'not-found', detail: `HTTP ${response.status}` };
  }
  if (response.status !== 200) {
    return { ok: false, reason: 'http-error', detail: `HTTP ${response.status}` };
  }

  // Soft-404: path inexistente devolve 200 com o shell HTML do site.
  if (!response.contentType.includes('text/markdown') || /^\s*(?:<!doctype html|<html)/i.test(response.body)) {
    return { ok: false, reason: 'no-markdown', detail: response.contentType || 'sem content-type' };
  }

  const markdown = redactCredentialExamples(decodeEntities(response.body).trim());
  if (markdown.length < 40) {
    return { ok: false, reason: 'empty', detail: `${markdown.length} bytes` };
  }

  const canonicalPath = normalizeDocPath(response.url || url);
  if (!canonicalPath) return { ok: false, reason: 'redirect-outside-docs', detail: response.url };
  return { ok: true, markdown, canonicalPath };
}

async function fetchPhase(pages, manifest) {
  const pending = pages.filter((page) => {
    const entry = manifest.pages[page.path];
    if (!entry) return true;
    if (entry.status === 'ok') {
      if (!entry.file || !safeFile(CACHE_PAGES_DIR, entry.file)) return true;
      const cached = readCache(entry.file);
      return cached === null || cached.trim().length < 40 || (entry.bytes !== undefined && entry.bytes !== cached.length) || (entry.sha256 !== undefined && entry.sha256 !== contentHash(cached));
    }
    // A 200 HTML response can be transient; only explicit 404/410 is final.
    return entry.status === 'error' || entry.reason !== 'not-found';
  });

  const queue = LIMIT ? pending.slice(0, LIMIT) : pending;

  const cached = pages.length - pending.length;
  const deferred = pending.length - queue.length;
  log(
    `📥 A buscar: ${queue.length} páginas` +
      (cached > 0 ? ` · ${cached} já no cache` : '') +
      (deferred > 0 ? ` · ${deferred} fora do limite` : '')
  );
  if (queue.length === 0) return { fetched: 0, skipped: 0, failed: 0 };

  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const page of queue) {
    processed++;
    const result = await fetchDocPage(page.path);

    if (result.ok) {
      page.file = docPathToFile(result.canonicalPath);
      writeCache(page.file, result.markdown);
      manifest.pages[page.path] = {
        status: 'ok',
        file: page.file,
        canonicalPath: result.canonicalPath,
        title: page.title,
        bytes: result.markdown.length,
        sha256: contentHash(result.markdown),
        fetchedAt: new Date().toISOString(),
      };
      fetched++;
      log(`[${processed}/${queue.length}] ✅ ${page.path} (${(result.markdown.length / 1024).toFixed(1)} KB)`);
    } else if (result.reason !== 'not-found') {
      manifest.pages[page.path] = { status: 'error', reason: result.reason, detail: result.detail };
      failed++;
      log(`[${processed}/${queue.length}] ❌ ${page.path} — ${result.detail}`);
    } else {
      manifest.pages[page.path] = { status: 'skipped', reason: result.reason, detail: result.detail };
      skipped++;
      log(`[${processed}/${queue.length}] ⏭️  ${page.path} — ${result.reason}`);
    }

    if (processed % 25 === 0) saveManifest(manifest);
    await sleep(RATE_LIMIT_MS);
  }

  saveManifest(manifest);
  return { fetched, skipped, failed };
}

// ============================================
// FASE 2 — EXPANSÃO PELOS LINKS DO MARKDOWN
// ============================================

function collectDocLinks(markdown) {
  // Regex local: com a flag /g o lastIndex é estado, e um objeto compartilhado
  // entre chamadas perderia links se algum loop parasse no meio.
  const pattern = /\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;
  const found = new Set();

  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const docPath = normalizeDocPath(match[1]);
    if (docPath) found.add(docPath);
  }
  return found;
}

async function expansionPhase(pages, manifest) {
  const known = new Set(pages.map((p) => p.path));
  const added = [];

  for (let round = 1; round <= MAX_EXPANSION_ROUNDS; round++) {
    const candidates = new Set();

    for (const entry of Object.values(manifest.pages)) {
      if (entry.status !== 'ok' || !entry.file) continue;
      const markdown = readCache(entry.file);
      if (!markdown) continue;

      for (const link of collectDocLinks(markdown)) {
        if (!known.has(link) && !manifest.pages[link]) candidates.add(link);
      }
    }

    if (candidates.size === 0) {
      log(`🔗 Expansão ${round}: nenhum link novo`);
      break;
    }

    log(`🔗 Expansão ${round}: ${candidates.size} paths novos vindos dos links`);

    const newPages = [...candidates]
      .map((docPath) => ({ path: docPath, file: docPathToFile(docPath), title: '', origin: 'link' }))
      .filter((page) => page.file !== null);

    const result = await fetchPhase(newPages, manifest);
    log(`   ↳ ${result.fetched} válidas, ${result.skipped} inexistentes, ${result.failed} com erro`);

    for (const page of newPages) {
      known.add(page.path);
      if (manifest.pages[page.path]?.status === 'ok') added.push(page);
    }

    if (result.fetched === 0) break;
  }

  return added;
}

// ============================================
// FASE 3 — FINALIZE
// ============================================

/**
 * Reescreve links para caminhos aceitos por get_document_by_path.
 * Link de página que existe localmente vira "reference/ad-campaign.md".
 * Link relativo para fora da Marketing API vira URL absoluta, para não quebrar.
 */
function rewriteLinks(markdown, pathToFile) {
  return markdown.replace(/\]\(\s*([^)\s]+?)\s*(("[^"]*")?)\)/g, (match, target, titlePart) => {
    const suffix = titlePart ? ` ${titlePart}` : '';

    const hashIndex = target.indexOf('#');
    const anchor = hashIndex >= 0 ? target.slice(hashIndex) : '';
    const bare = hashIndex >= 0 ? target.slice(0, hashIndex) : target;

    const docPath = normalizeDocPath(bare);
    if (docPath) {
      const file = pathToFile.get(docPath);
      if (file) return `](${file}${anchor}${suffix})`;
      return `](${ORIGIN}${docPath}${anchor}${suffix})`;
    }

    // Link relativo ao site que não é da Marketing API: torna absoluto
    if (bare.startsWith('/') && !bare.startsWith('//')) {
      return `](${ORIGIN}${bare}${anchor}${suffix})`;
    }

    return match;
  });
}

function extractTitle(markdown, fallback, file) {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  if (fallback) return fallback;
  return path.basename(file, '.md').replace(/-/g, ' ');
}

function buildFileContent({ title, source, markdown, fetchedAt }) {
  const safeTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
  return `---\ntitle: "${safeTitle}"\nsource: "${source}"\nscraped_at: "${fetchedAt || new Date().toISOString()}"\n---\n\n${markdown}\n`;
}

/**
 * Ignora scraped_at e ruído de espaçamento ao comparar versões.
 */
function normalizeForComparison(content) {
  return content
    .replace(/^scraped_at:.*$/m, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finalizePhase(manifest) {
  const baseline = fs.existsSync(INDEX_PATH) ? JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')) : {};
  const pathToFile = new Map();
  // Merge all extant baseline entries, including unprocessed pages in limited runs.
  for (const [rawPath, file] of Object.entries(baseline.urlToFile || {})) {
    const docPath = normalizeDocPath(rawPath);
    const target = safeFile(DOCS_DIR, file);
    if (docPath && target && fs.existsSync(target)) pathToFile.set(docPath, file);
  }
  for (const [docPath, entry] of Object.entries(manifest.pages)) {
    if (entry.status === 'ok' && entry.file && safeFile(CACHE_PAGES_DIR, entry.file) && readCache(entry.file)) {
      pathToFile.set(entry.canonicalPath || docPath, entry.file);
      pathToFile.set(docPath, entry.file);
    }
  }

  const index = { urlToFile: {}, fileToUrl: {}, lastUpdated: new Date().toISOString(), stats: {} };
  const stats = { new: 0, modified: 0, unchanged: 0, failed: 0 };
  const written = new Set();
  for (const [docPath, entry] of Object.entries(manifest.pages)) {
    if (entry.status !== 'ok' || !entry.file) continue;
    const target = safeFile(DOCS_DIR, entry.file);
    const raw = safeFile(CACHE_PAGES_DIR, entry.file) ? readCache(entry.file) : null;
    if (!target || !raw) { stats.failed++; continue; }
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    // A collector must never overwrite hand-authored files.
    if (existing !== null && !wasScraped(target)) {
      log(`Arquivo curado preservado: ${entry.file}`);
      pathToFile.delete(docPath);
      pathToFile.delete(entry.canonicalPath || docPath);
      continue;
    }
    const body = rewriteLinks(redactCredentialExamples(raw), pathToFile);
    const title = extractTitle(body, entry.title, entry.file);
    const content = buildFileContent({ title, source: docPathToUrl(entry.canonicalPath || docPath), markdown: body, fetchedAt: entry.fetchedAt });
    if (existing === null) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      stats.new++;
    } else if (normalizeForComparison(existing) === normalizeForComparison(content)) {
      stats.unchanged++;
    } else {
      fs.writeFileSync(target, content);
      stats.modified++;
    }
    written.add(entry.file);
  }
  // Canonical redirect destinations own the bidirectional index.
  for (const [docPath, file] of pathToFile) {
    const canonical = manifest.pages[docPath]?.canonicalPath || docPath;
    const target = safeFile(DOCS_DIR, file);
    if (!target || !fs.existsSync(target)) continue;
    if (index.fileToUrl[file]) delete index.urlToFile[index.fileToUrl[file]];
    index.urlToFile[canonical] = file;
    index.fileToUrl[file] = canonical;
  }
  const unavailable = new Map((baseline.unavailable || []).map((entry) => [normalizeDocPath(entry.path), entry]));
  for (const [docPath, entry] of Object.entries(manifest.pages)) {
    unavailable.delete(docPath);
    if (entry.status !== 'ok') unavailable.set(docPath, { path: docPath, reason: entry.reason, detail: entry.detail });
  }
  index.unavailable = [...unavailable.values()].filter((item) => normalizeDocPath(item.path)).sort((a, b) => a.path.localeCompare(b.path));
  updateIndexStats(index);
  return { index, stats, written };
}

function updateIndexStats(index) {
  index.stats = {
    totalUrls: Object.keys(index.urlToFile).length,
    totalFiles: Object.keys(index.fileToUrl).length,
    unavailable: index.unavailable.length,
  };
}

/**
 * Um arquivo só pode ser apagado pela limpeza se foi a coleta que o criou.
 * Arquivo curado à mão (AGENTS.md, QUICK_REFERENCE.md) não tem o frontmatter
 * `source:` apontando para developers.facebook.com e fica de fora.
 */
function wasScraped(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf-8').slice(0, 500);
    return /^source:\s*"https:\/\/developers\.facebook\.com/m.test(head);
  } catch {
    return false;
  }
}

/**
 * Arquivo marcado à mão como defasado (página que a Meta parou de servir em
 * markdown, mantida com o conteúdo da coleta anterior). Nunca é apagado pela
 * limpeza; some só quando a página voltar e for regravada por cima.
 */
function isStale(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf-8').slice(0, 500);
    return /^stale:\s*true$/m.test(head);
  } catch {
    return false;
  }
}

function listScrapedFiles() {
  const found = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md') && wasScraped(full)) found.push(full);
    }
  }
  walk(DOCS_DIR);
  return found;
}

/**
 * Apaga .md em docs/ que não existem mais na documentação.
 *
 * Só remove arquivo que a própria coleta gerou. Página que deu erro nesta
 * rodada também é preservada: um 500 passageiro da Meta não pode apagar
 * documentação boa que já estava no repo.
 */
function prunePhase(written, manifest) {
  const removed = [];

  const protectedFiles = new Set();
  for (const [docPath, entry] of Object.entries(manifest.pages)) {
    if (entry.status === 'ok' || entry.reason === 'not-found') continue;
    const file = entry.file || docPathToFile(docPath);
    if (file) protectedFiles.add(file);
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relative = path.relative(DOCS_DIR, full);
        if (
          !written.has(relative) &&
          !protectedFiles.has(relative) &&
          wasScraped(full) &&
          !isStale(full)
        ) {
          fs.unlinkSync(full);
          removed.push(relative);
        }
      }
    }
  }

  walk(DOCS_DIR);
  return removed;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const startedAt = Date.now();

  if (!isTargeted && !fs.existsSync(DISCOVERED_PATH)) {
    throw new Error('discovered-urls.json não encontrado. Rode `npm run discover` primeiro.');
  }

  const discovered = isTargeted
    ? { pages: [...new Set(selectedPaths)].map((docPath) => ({ path: docPath })) }
    : JSON.parse(fs.readFileSync(DISCOVERED_PATH, 'utf-8'));
  const pages = (discovered.pages || [])
    .map((page) => ({ ...page, path: normalizeDocPath(page.path), file: docPathToFile(page.path) }))
    .filter((page) => page.path && page.file);

  if (pages.length === 0) {
    throw new Error('discovered-urls.json não tem páginas válidas.');
  }

  log('🚀 Coleta da documentação da Marketing API');
  log(`📚 Índice: ${pages.length} URLs`);
  log(`⏱️  Rate limit: ${RATE_LIMIT_MS}ms${LIMIT ? ` · limite: ${LIMIT}` : ''}`);
  log(`🔄 Modo: ${isTargeted ? 'coleta pontual' : 'coleta completa'}${isResume ? ' (resume)' : ''}`);
  log('');

  fs.mkdirSync(CACHE_PAGES_DIR, { recursive: true });
  const manifest = loadManifest();
  // A targeted resume can reuse selected cache entries, never fetch or rewrite
  // unrelated pages from a previous full collection.
  if (isTargeted) {
    for (const docPath of Object.keys(manifest.pages)) {
      if (!selectedPaths.includes(normalizeDocPath(docPath))) delete manifest.pages[docPath];
    }
  }

  // Resume must include failures first discovered during link expansion as well.
  const known = new Set(pages.map((page) => page.path));
  for (const rawPath of Object.keys(manifest.pages)) {
    const docPath = normalizeDocPath(rawPath);
    if (!docPath) { delete manifest.pages[rawPath]; continue; }
    if (docPath !== rawPath) { manifest.pages[docPath] = manifest.pages[rawPath]; delete manifest.pages[rawPath]; }
    if (!known.has(docPath)) { pages.push({ path: docPath, file: docPathToFile(docPath) }); known.add(docPath); }
  }
  const fetchResult = await fetchPhase(pages, manifest);
  if (isTargeted) saveManifest(manifest);
  log('');
  log(`📥 Fetch: ${fetchResult.fetched} ok · ${fetchResult.skipped} inexistentes · ${fetchResult.failed} com erro`);

  if (!noExpand && !LIMIT && !isTargeted) {
    log('');
    await expansionPhase(pages, manifest);
    saveManifest(manifest);
  }

  log('');
  log('📝 Gravando docs/…');
  const scrapedBefore = listScrapedFiles().length;
  const { index, stats, written } = finalizePhase(manifest);

  // Algumas páginas da Meta existem em HTML mas quebram no renderizador de
  // markdown (HTTP 500 fixo). Elas não podem travar a limpeza para sempre, mas
  // uma falha em massa — rede caindo, bloqueio — tem que travar.
  const totalPages = Object.keys(manifest.pages).length;
  const errorCount = Object.values(manifest.pages).filter((e) => e.status === 'error').length;
  const errorRatio = totalPages > 0 ? errorCount / totalPages : 1;

  // Segunda guarda: se o endpoint markdown parar de responder, as páginas
  // viram "skipped" (200 com HTML), não "error" — a taxa de erro fica em zero
  // e a limpeza apagaria docs/ inteiro. Por isso a coleta também precisa ter
  // regravado uma fração mínima do que já existia.
  const writtenRatio = scrapedBefore > 0 ? written.size / scrapedBefore : 1;

  const pruneBlockers = [];
  if (LIMIT) pruneBlockers.push('coleta parcial (--limit)');
  if (isTargeted) pruneBlockers.push('coleta pontual (--path)');
  if (totalPages === 0) pruneBlockers.push('índice vazio');
  if (errorRatio >= MAX_ERROR_RATIO_FOR_PRUNE) {
    pruneBlockers.push(
      `${errorCount} de ${totalPages} páginas com erro (${(errorRatio * 100).toFixed(1)}%, limite ${(MAX_ERROR_RATIO_FOR_PRUNE * 100).toFixed(0)}%)`
    );
  }
  if (writtenRatio < MIN_WRITTEN_RATIO_FOR_PRUNE) {
    pruneBlockers.push(
      `só ${written.size} de ${scrapedBefore} arquivos existentes foram regravados (${(writtenRatio * 100).toFixed(0)}%, mínimo ${(MIN_WRITTEN_RATIO_FOR_PRUNE * 100).toFixed(0)}%)`
    );
  }

  let removed = [];
  if (pruneBlockers.length === 0 && !noPrune) {
    removed = prunePhase(written, manifest);
  } else if (!noPrune) {
    log(`⚠️  Limpeza de órfãos pulada — ${pruneBlockers.join('; ')}.`);
    log('   Rode `npm run scrape:resume` antes de confiar no conteúdo de docs/.');
  }

  for (const file of removed) {
    delete index.urlToFile[index.fileToUrl[file]];
    delete index.fileToUrl[file];
  }
  index.collection = { partial: Boolean(LIMIT || isTargeted), ...(isTargeted ? { selectedPaths: [...new Set(selectedPaths)] } : {}), pruningDisabled: noPrune || isTargeted, pruneBlocked: pruneBlockers, attempted: totalPages, written: written.size };
  updateIndexStats(index);
  writeJsonAtomic(INDEX_PATH, index);

  const skipped = Object.entries(manifest.pages)
    .filter(([, e]) => e.status === 'skipped')
    .map(([docPath, e]) => ({ path: docPath, reason: e.reason, detail: e.detail }));
  const errors = Object.entries(manifest.pages)
    .filter(([, e]) => e.status === 'error')
    .map(([docPath, e]) => ({ path: docPath, reason: e.reason, detail: e.detail }));

  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        collection: index.collection,
        counts: { ...stats, skipped: skipped.length, errors: errors.length, removed: removed.length },
        skipped,
        errors,
        removed,
      },
      null,
      2
    )}\n`
  );

  log('');
  log('✅ Coleta finalizada');
  log(`   Novos:        ${stats.new}`);
  log(`   Modificados:  ${stats.modified}`);
  log(`   Inalterados:  ${stats.unchanged}`);
  log(`   Removidos:    ${removed.length}`);
  log(`   Sem markdown: ${skipped.length}`);
  log(`   Com erro:     ${errors.length}`);
  log(`   Total docs/:  ${index.stats.totalFiles}`);
  log(`   Relatório:    ${path.relative(ROOT, REPORT_PATH)}`);
  log(`⏱️  ${((Date.now() - startedAt) / 1000 / 60).toFixed(1)} min`);

  if (errors.length > 0) {
    log('');
    log('⚠️  Páginas com erro (rode de novo com --resume):');
    errors.slice(0, 20).forEach((e) => log(`   ${e.path} — ${e.detail}`));
  }
}

main().catch((error) => {
  process.stderr.write(`💥 ${error.stack || error.message || error}\n`);
  process.exit(1);
});
