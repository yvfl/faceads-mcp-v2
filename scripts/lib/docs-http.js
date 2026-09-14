/**
 * Helpers compartilhados pelos scripts de coleta da documentação da Meta.
 *
 * A Meta serve a documentação em markdown quando o request manda
 * `Accept: text/markdown`. Um User-Agent de navegador completo (sem os
 * headers Sec-Fetch-*) é rejeitado com 400, então usamos um UA simples.
 * Path inexistente devolve 200 com o shell HTML do site (soft-404): quem
 * chama precisa conferir o content-type antes de gravar qualquer coisa.
 */

export const ORIGIN = 'https://developers.facebook.com';
export const DOC_PREFIX = '/documentation/ads-commerce/marketing-api';
export const DOC_FAMILIES = [DOC_PREFIX, '/documentation/ads-commerce/conversions-api', '/documentation/ads-commerce/catalog', '/documentation/ads-commerce/gateway-products', '/documentation/ads-commerce/ads-ai-connectors'];
export const LEGACY_PREFIX = '/docs/marketing-api';
export const USER_AGENT = 'Mozilla/5.0';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Normaliza um path ou URL da documentação para o prefixo canônico.
 * Devolve null para URLs fora das famílias oficiais coletadas.
 */
export function normalizeDocPath(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  let value = input.trim().split('#')[0].split('?')[0];
  // Reject encoded separators/traversal before URL parsing can normalize them.
  if (/[\\\x00-\x20]/.test(value) || /%/i.test(value) || value.includes('..')) return null;
  if (/^https?:\/\//i.test(value)) {
    let parsed;
    try { parsed = new URL(value); } catch { return null; }
    if (parsed.origin !== ORIGIN) return null;
    value = parsed.pathname;
  }
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  value = value.replace(/\/+$/, '');
  if (value === LEGACY_PREFIX || value.startsWith(`${LEGACY_PREFIX}/`)) {
    value = DOC_PREFIX + value.slice(LEGACY_PREFIX.length);
  }
  for (const family of ['conversions-api', 'catalog', 'ads-ai-connectors']) {
    const old = `${DOC_PREFIX}/${family}`;
    if (value === old || value.startsWith(`${old}/`)) {
      value = `/documentation/ads-commerce/${family}` + value.slice(old.length);
    }
  }
  if (!DOC_FAMILIES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return null;
  if (value.split('/').slice(1).some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return value;
}

/** Canonical family URLs retain the public paths under docs/. */
export function docPathToFile(docPath) {
  const normalized = normalizeDocPath(docPath);
  if (!normalized) return null;
  const relative = normalized === DOC_PREFIX || normalized.startsWith(`${DOC_PREFIX}/`)
    ? normalized.slice(DOC_PREFIX.length).replace(/^\//, '')
    : normalized.slice('/documentation/ads-commerce/'.length);
  return relative ? `${relative}.md` : 'index.md';
}

export function docPathToUrl(docPath) {
  return `${ORIGIN}${docPath}`;
}

/**
 * Busca uma URL com timeout e limite de tamanho.
 * Devolve { status, contentType, body } — nunca lança por status HTTP.
 */
export async function fetchWithLimit(url, { accept, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'User-Agent': USER_AGENT };
    if (accept) headers.Accept = accept;

    const response = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    const chunks = [];
    let bytes = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) throw new Error(`Resposta acima do limite de ${MAX_BYTES} bytes (${bytes})`);
        chunks.push(chunk);
      }
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }

    return {
      status: response.status,
      contentType,
      body: new TextDecoder('utf-8').decode(buffer),
      url: response.url || url,
      retryAfter: response.headers.get('retry-after'),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca com retry e backoff. Só repete em erro de rede ou status 5xx/429.
 */
export async function fetchWithRetry(url, options = {}) {
  const { retries = 3, backoffMs = 2000, ...rest } = options;

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * attempt);
    }

    try {
      const result = await fetchWithLimit(url, rest);
      if (result.status >= 500 || result.status === 429) {
        lastError = new Error(`HTTP ${result.status}`);
        if (attempt < retries && result.retryAfter) {
          const seconds = Number(result.retryAfter);
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(result.retryAfter) - Date.now();
          if (delay > 0) await sleep(delay);
        }
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Falha desconhecida no fetch');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘',
  rsquo: '’', ldquo: '“', rdquo: '”', middot: '·',
  copy: '©', reg: '®', trade: '™', times: '×',
  divide: '÷', laquo: '«', raquo: '»', deg: '°',
  euro: '€', pound: '£', yen: '¥', cent: '¢',
  sect: '§', para: '¶', dagger: '†', bull: '•',
  prime: '′', minus: '−', plusmn: '±', frac12: '½',
  larr: '←', rarr: '→', harr: '↔', hyphen: '-', shy: '',
};

/**
 * Decodifica entidades HTML em uma passada só.
 * O markdown da Meta vem com &lt; &#123; &quot; etc. dentro dos exemplos.
 */
export function decodeEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);

      if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;

      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }

    const named = NAMED_ENTITIES[body];
    return named === undefined ? match : named;
  });
}

/** Do not republish credential-shaped values present in third-party documentation examples. */
export function redactCredentialExamples(markdown) {
  return markdown
    .replace(/\bEAA[A-Za-z0-9]{75,}\b/g, '<YOUR_META_ACCESS_TOKEN>')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g, '<YOUR_GITHUB_TOKEN>')
    .replace(/-----BEGIN ((?:RSA |EC |OPENSSH )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g, '<YOUR_PRIVATE_KEY>');
}
