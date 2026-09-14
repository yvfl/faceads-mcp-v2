import type { Request, Response } from 'express';
import type { OAuthFlow } from '../generated/prisma/client.js';
import { getPrisma } from '../db/prisma.js';
import { AUTH_FLOW_TTL, constantEqual, getMcpResourceUri, hashSecret } from './oauth-utils.js';

function cookieName(id: string): string { return `faceads_flow_${id}`; }
export function setFlowCookie(res: Response, id: string, secret: string): void {
  res.cookie(cookieName(id), secret, { httpOnly: true, secure: getMcpResourceUri().startsWith('https:'), sameSite: 'lax', path: '/oauth', maxAge: AUTH_FLOW_TTL });
}
export function clearFlowCookie(res: Response, id: string): void {
  res.clearCookie(cookieName(id), { httpOnly: true, secure: getMcpResourceUri().startsWith('https:'), sameSite: 'lax', path: '/oauth' });
}
export function browserSecret(req: Request, id: string): string | null {
  const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName(id)}=`))?.slice(cookieName(id).length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function getBrowserFlow(req: Request, authenticated = false): Promise<{ flow: OAuthFlow; csrf: string; clientName: string } | null> {
  const id = req.method === 'GET' ? req.query.flow : req.body?.flow;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return null;
  const secret = browserSecret(req, id);
  if (!secret) return null;
  if (req.method !== 'GET') {
    if (typeof req.body?.csrf !== 'string' || !constantEqual(secret, req.body.csrf)) return null;
    if (req.headers.origin && req.headers.origin !== new URL(getMcpResourceUri()).origin) return null;
  }
  const prisma = getPrisma();
  const flow = await prisma.oAuthFlow.findUnique({ where: { id } });
  if (!flow || flow.expiresAt <= new Date() || !constantEqual(hashSecret(secret), flow.browserSecretHash) || (authenticated && !flow.userId)) return null;
  const client = await prisma.oAuthClient.findUnique({ where: { id: flow.clientId } });
  if (!client || !client.redirectUris.includes(flow.redirectUri) || !client.grantTypes.includes('authorization_code') || flow.resource !== getMcpResourceUri()) return null;
  return { flow, csrf: secret, clientName: client.clientName };
}
