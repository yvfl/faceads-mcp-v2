import { randomUUID, createHash, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_TOKEN_TTL = 60 * 60 * 1000;
// Successful refresh restarts this inactivity window; active grants have no fixed end date.
export const REFRESH_TOKEN_IDLE_TTL = 90 * 24 * 60 * 60 * 1000;
export const AUTH_CODE_TTL = 5 * 60 * 1000;
export const AUTH_FLOW_TTL = 20 * 60 * 1000;
export const SUPPORTED_SCOPES = ['ads_read', 'ads_management'] as const;

export function getMcpResourceUri(): string {
  return `${(process.env.MCP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '')}/mcp`;
}
/** Single-resource OAuth compatibility: only omission selects the configured MCP audience. */
export function resolveMcpResource(value: unknown): string | null {
  const resource = getMcpResourceUri();
  return value === undefined || value === resource ? resource : null;
}
export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
/** Pseudonymous reference for one consent, never derived from an access/refresh token. */
export function authorizationReference(operationOwnerId: string): string {
  return hashSecret(`faceads:oauth-authorization:${operationOwnerId}`).slice(0, 32);
}
export function constantEqual(a: string, b: string): boolean {
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return false;
  return constantEqual(createHash('sha256').update(verifier).digest('base64url'), challenge);
}
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, storedHash: string): boolean {
  if (password.length > 256 || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(storedHash)) return false;
  const [salt, expected] = storedHash.split(':');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 64), Buffer.from(expected, 'hex'));
}
export function generateToken(): string { return randomBytes(32).toString('base64url'); }
export function generateAuthCode(): string { return generateToken(); }
export function generateClientSecret(): string { return randomBytes(32).toString('hex'); }
export function generateFlowId(): string { return randomUUID(); }

/** Only known, exact OAuth scopes can grant management access. */
export function scopeToPermission(scope: string): 'read' | 'readwrite' {
  return scope.split(/\s+/).includes('ads_management') ? 'readwrite' : 'read';
}
export function parseScopes(scope: unknown): string | null {
  if (scope === undefined || scope === '') return 'ads_read';
  if (typeof scope !== 'string' || scope.length > 128) return null;
  const values = [...new Set(scope.split(/\s+/).filter(Boolean))];
  return values.length && values.every(value => SUPPORTED_SCOPES.includes(value as typeof SUPPORTED_SCOPES[number])) ? values.join(' ') : null;
}
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch { return false; }
}
