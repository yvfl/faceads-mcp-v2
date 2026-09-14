#!/usr/bin/env node
/**
 * Descoberta das URLs da documentação da Marketing API — sem browser.
 *
 * O site embute a árvore de navegação inteira como JSON dentro do HTML de
 * qualquer página da seção. Um fetch basta para listar tudo que aparece no
 * menu lateral. A nav não cobre as páginas de "edge" da referência
 * (ex: reference/adgroup/insights), então unimos o resultado com o que a
 * última coleta baixou com sucesso (url-index.json). O scraper descarta o que
 * não existir mais, e o path morto sai do índice no ciclo seguinte.
 *
 * Saída: discovered-urls.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  ORIGIN,
  DOC_PREFIX,
  docPathToFile,
  docPathToUrl,
  fetchWithRetry,
  normalizeDocPath,
  decodeEntities,
} from './lib/docs-http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ENTRYPOINT = docPathToUrl(DOC_PREFIX);
const OUTPUT_PATH = path.join(ROOT, 'discovered-urls.json');
const INDEX_PATH = path.join(ROOT, 'url-index.json');

// Guarda-corpo: se a nav vier truncada (mudança de layout, bloqueio), abortar
// em vez de gravar um índice curto que faria o scraper apagar metade das docs.
const MIN_EXPECTED_NAV_URLS = 300;

function log(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * Extrai os pares href/text da árvore de navegação embutida no HTML.
 */
function extractNavEntries(html) {
  const entries = new Map();
  const pattern = /"href"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = safeJsonString(match[1]);
    const text = safeJsonString(match[2]);
    if (href === null) continue;

    const docPath = normalizeDocPath(href);
    if (!docPath) continue;

    const title = text ? decodeEntities(text).trim() : '';
    // Primeira ocorrência vence: a nav repete entradas em breadcrumbs
    if (!entries.has(docPath)) {
      entries.set(docPath, title);
    }
  }

  return entries;
}

/**
 * Converte o miolo de uma string JSON (ainda escapada) em texto.
 */
function safeJsonString(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return null;
  }
}

/**
 * Paths que a última coleta conseguiu baixar, para não perder as páginas de
 * edge da referência que não aparecem no menu.
 *
 * A base é url-index.json: o que baixou de verdade mais a lista `unavailable`
 * (páginas que existem mas falharam). Path morto — sem markdown — sai do
 * índice depois de um ciclo, em vez de ser testado a cada coleta para sempre.
 */
function loadBaselinePaths() {
  const paths = new Map();

  const index = readJsonIfExists(INDEX_PATH);
  if (index && index.urlToFile && typeof index.urlToFile === 'object') {
    for (const rawPath of Object.keys(index.urlToFile)) {
      const docPath = normalizeDocPath(rawPath);
      if (docPath) paths.set(docPath, '');
    }
  }

  // Páginas que existem mas falharam na última coleta (HTTP 500 no markdown
  // da Meta) entram de novo, para serem retentadas a cada ciclo.
  if (index && Array.isArray(index.unavailable)) {
    for (const item of index.unavailable) {
      const docPath = normalizeDocPath(item?.path);
      if (docPath) paths.set(docPath, '');
    }
  }

  return paths;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    log(`⚠️  Ignorando ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

async function main() {
  const startedAt = Date.now();

  log('🔎 Descobrindo URLs da documentação (sem browser)');
  log(`📍 Entrypoint: ${ENTRYPOINT}`);
  log('');

  const response = await fetchWithRetry(ENTRYPOINT, { accept: 'text/html' });
  if (response.status !== 200) {
    throw new Error(`Entrypoint respondeu HTTP ${response.status}`);
  }
  if (!response.contentType.includes('text/html')) {
    throw new Error(`Entrypoint devolveu ${response.contentType}, esperado text/html`);
  }

  const navEntries = extractNavEntries(response.body);
  log(`🌳 Árvore de navegação: ${navEntries.size} URLs`);

  if (navEntries.size < MIN_EXPECTED_NAV_URLS) {
    throw new Error(
      `Só ${navEntries.size} URLs extraídas da nav (mínimo esperado: ${MIN_EXPECTED_NAV_URLS}). ` +
        'O layout do site provavelmente mudou — revise extractNavEntries antes de regravar o índice.'
    );
  }

  const baseline = loadBaselinePaths();
  log(`📚 Baseline da coleta anterior: ${baseline.size} URLs`);

  const merged = new Map();
  for (const [docPath, title] of navEntries) {
    merged.set(docPath, { path: docPath, title, origin: 'nav' });
  }
  for (const [docPath, title] of baseline) {
    if (!merged.has(docPath)) {
      merged.set(docPath, { path: docPath, title, origin: 'baseline' });
    }
  }

  const pages = [...merged.values()]
    .filter((page) => docPathToFile(page.path) !== null)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((page) => ({
      path: page.path,
      title: page.title,
      url: docPathToUrl(page.path),
      file: docPathToFile(page.path),
      origin: page.origin,
    }));

  const onlyInNav = [...navEntries.keys()].filter((p) => !baseline.has(p));
  const onlyInBaseline = [...baseline.keys()].filter((p) => !navEntries.has(p));

  log('');
  log('📊 Comparação com a coleta anterior:');
  log(`   Novas na nav: ${onlyInNav.length}`);
  onlyInNav.slice(0, 25).forEach((p) => log(`     + ${p}`));
  if (onlyInNav.length > 25) log(`     … mais ${onlyInNav.length - 25}`);
  log(`   Sumiram da nav (mantidas para o scraper testar): ${onlyInBaseline.length}`);
  onlyInBaseline.slice(0, 25).forEach((p) => log(`     - ${p}`));
  if (onlyInBaseline.length > 25) log(`     … mais ${onlyInBaseline.length - 25}`);

  const output = {
    generatedAt: new Date().toISOString(),
    entrypoint: ENTRYPOINT,
    origin: ORIGIN,
    counts: {
      nav: navEntries.size,
      baseline: baseline.size,
      total: pages.length,
    },
    pages,
  };

  fs.writeFileSync(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(output, null, 2)}\n`);
  fs.renameSync(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);

  log('');
  log(`💾 ${pages.length} URLs salvas em ${path.relative(ROOT, OUTPUT_PATH)}`);
  log(`⏱️  ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  process.stderr.write(`💥 ${error.stack || error.message || error}\n`);
  process.exit(1);
});
