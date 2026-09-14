import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type { LookupAddress } from 'node:dns';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList(); globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) blockedV6.addSubnet(address, prefix, 'ipv6');

/** Only globally routed unicast addresses, including explicit IPv6 handling. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
  return false;
}
export function parsePublicImageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Informe uma URL pública válida para a imagem.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || value.length > 4096 || (url.port && url.port !== '80' && url.port !== '443')) throw new Error('A imagem precisa de uma URL HTTP ou HTTPS pública, sem credenciais.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new Error('Endereços locais e redes privadas não podem ser usados para imagens.');
  return url;
}
async function resolvePublicAddresses(url: URL, remaining: number): Promise<LookupAddress[]> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      dns.promises.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Tempo limite ao localizar a imagem.')), remaining); }),
    ]);
    if (!addresses.length || addresses.some(record => !isPublicAddress(record.address))) throw new Error('A URL da imagem aponta para uma rede local, privada ou reservada.');
    return addresses;
  } finally { if (timeout) clearTimeout(timeout); }
}
function downloadStep(url: URL, addresses: LookupAddress[], remaining: number): Promise<{ redirect: string } | { data: Buffer }> {
  return new Promise((resolve, reject) => {
    // The socket uses only the already-validated DNS answers. TLS still verifies the original hostname.
    const pinnedLookup = ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    }) as LookupFunction;
    const request = (url.protocol === 'https:' ? https : http).request(url, { method: 'GET', lookup: pinnedLookup, agent: false, headers: { Accept: 'image/*', 'User-Agent': 'FaceAds/2.0', 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(remaining) }, response => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location; response.destroy();
        if (!location) { reject(new Error('A URL da imagem redirecionou sem um destino válido.')); return; }
        resolve({ redirect: location }); return;
      }
      if (status < 200 || status >= 300) { response.destroy(); reject(new Error('Não foi possível baixar a imagem na URL informada.')); return; }
      const type = response.headers['content-type']?.split(';')[0].trim().toLowerCase();
      if (!type?.startsWith('image/') || type === 'image/svg+xml') { response.destroy(); reject(new Error('A URL precisa retornar uma imagem raster, como PNG, JPEG ou WebP.')); return; }
      const length = Number(response.headers['content-length']);
      if (length > MAX_IMAGE_BYTES) { response.destroy(); reject(new Error('A imagem deve ter no máximo 10 MB.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) { response.destroy(); reject(new Error('A imagem deve ter no máximo 10 MB.')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (!size) { reject(new Error('A URL retornou uma imagem vazia.')); return; }
        resolve({ data: Buffer.concat(chunks) });
      });
      response.on('error', () => reject(new Error('O download da imagem foi interrompido.')));
    });
    request.on('error', () => reject(new Error('Não foi possível baixar a imagem. Verifique a URL ou tente novamente.')));
    request.end();
  });
}
/** Bounded public download; every redirect revalidates DNS and pins the next socket. */
export async function downloadPublicImage(value: string): Promise<Buffer> {
  let url = parsePublicImageUrl(value);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    let remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Tempo limite ao baixar a imagem.');
    const addresses = await resolvePublicAddresses(url, remaining);
    remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Tempo limite ao baixar a imagem.');
    const result = await downloadStep(url, addresses, remaining);
    if ('data' in result) return result.data;
    url = parsePublicImageUrl(new URL(result.redirect, url).toString());
  }
  throw new Error('A URL da imagem redirecionou muitas vezes.');
}
