import type { Prisma } from '../generated/prisma/client.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_IDLE_TTL, parseScopes, authorizationReference } from './oauth-utils.js';

/** Serialize refresh/issuance/revocation for this user and app, including replacement rows. */
export async function lockOAuthConnection(tx: Prisma.TransactionClient, userId: string, clientId: string): Promise<void> {
  const key = `oauth:${JSON.stringify([userId, clientId])}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

function allowedScope(original: string, requested: unknown): string | null {
  const scope = requested === undefined ? original : parseScopes(requested);
  return scope && scope.split(' ').every(value => original.split(' ').includes(value)) ? scope : null;
}

type RefreshInput = {
  clientId: string; resource: string; refreshHash: string; requestedScope: unknown;
  accessHash: string; nextRefreshHash: string; now: Date;
};

type RefreshDenialReason = 'missing' | 'expired' | 'reused' | 'client_mismatch' | 'resource_mismatch' | 'invalid_scope' | 'reused_scope_mismatch';
function denied(reason: RefreshDenialReason, operationOwnerId?: string, revokedAccessTokens?: number) {
  return { error: reason === 'invalid_scope' ? 'invalid_scope' : 'invalid_grant', reason,
    diagnostics: {
      ...(operationOwnerId ? { authorization_ref: authorizationReference(operationOwnerId) } : {}),
      ...(revokedAccessTokens !== undefined ? { revoked_access_tokens: revokedAccessTokens } : {}),
    },
  } as const;
}

export async function rotateRefreshGrant(tx: Prisma.TransactionClient, input: RefreshInput) {
  const { clientId, resource, refreshHash, requestedScope, now } = input;
  // Find the lock identity without accepting the token. Re-read after acquiring the lock.
  const candidate = await tx.oAuthAccessToken.findUnique({ where: { refreshToken: refreshHash } })
    ?? await tx.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: refreshHash } });
  if (!candidate) return denied('missing');
  if (candidate.clientId !== clientId) return denied('client_mismatch');
  if (candidate.resource !== resource) return denied('resource_mismatch');
  await lockOAuthConnection(tx, candidate.userId, clientId);
  const previous = await tx.oAuthAccessToken.findUnique({ where: { refreshToken: refreshHash } });
  if (!previous) {
    const used = await tx.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: refreshHash } });
    if (!used) return denied('missing', candidate.operationOwnerId);
    if (used.clientId !== clientId) return denied('client_mismatch');
    if (used.resource !== resource) return denied('resource_mismatch');
    if (used.retainUntil <= now) return denied('expired', used.operationOwnerId);
    if (!allowedScope(used.scope, requestedScope)) return denied('reused_scope_mismatch', used.operationOwnerId);
    // Never authorize a consumed token. Reuse invalidates only its own successor family.
    const revoked = await tx.oAuthAccessToken.deleteMany({ where: { operationOwnerId: used.operationOwnerId, clientId, userId: used.userId, resource } });
    return denied('reused', used.operationOwnerId, revoked.count);
  }
  if (previous.clientId !== clientId) return denied('client_mismatch');
  if (previous.resource !== resource) return denied('resource_mismatch');
  if (!previous.refreshExpiresAt || previous.refreshExpiresAt <= now) return denied('expired', previous.operationOwnerId);
  // invalid_scope describes only a valid, current grant belonging to this client.
  const scope = allowedScope(previous.scope, requestedScope);
  if (!scope) return denied('invalid_scope', previous.operationOwnerId);
  const deadline = new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL);
  await tx.oAuthUsedRefreshToken.create({ data: {
    refreshToken: refreshHash, operationOwnerId: previous.operationOwnerId,
    clientId, userId: previous.userId, resource, scope: previous.scope, retainUntil: deadline,
  } });
  // Rotation consumes the refresh, not an otherwise valid access token. Parallel
  // requests may still carry that access until its original expiry. A scope
  // reduction must revoke every older access in this family immediately.
  const scopeReduced = new Set(scope.split(/\s+/)).size < new Set(previous.scope.split(/\s+/)).size;
  if (scopeReduced) {
    await tx.oAuthAccessToken.deleteMany({ where: { operationOwnerId: previous.operationOwnerId, clientId, userId: previous.userId, resource } });
  } else if (previous.expiresAt <= now) {
    await tx.oAuthAccessToken.delete({ where: { token: previous.token } });
  } else {
    await tx.oAuthAccessToken.update({ where: { token: previous.token }, data: { refreshToken: null, refreshExpiresAt: null } });
  }
  const renewed = await tx.oAuthAccessToken.create({ data: {
    token: input.accessHash, refreshToken: input.nextRefreshHash,
    clientId, userId: previous.userId, resource, scope,
    selectedAccountIds: previous.selectedAccountIds, metaTokenId: previous.metaTokenId,
    operationOwnerId: previous.operationOwnerId, createdAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL), refreshExpiresAt: deadline,
  } });
  // Bound opportunistic cleanup work. No raw bearer or Meta token is retained here.
  await tx.$executeRaw`DELETE FROM "oauth_used_refresh_tokens" WHERE "refresh_token" IN
    (SELECT "refresh_token" FROM "oauth_used_refresh_tokens" WHERE "retain_until" <= ${now}
     ORDER BY "retain_until", "refresh_token" LIMIT 100 FOR UPDATE SKIP LOCKED)`;
  // Access-only overlap rows cannot renew. Never remove an expired access that
  // still carries a refresh grant, and bound cleanup work independently of load.
  await tx.$executeRaw`DELETE FROM "oauth_access_tokens" WHERE "token" IN
    (SELECT "token" FROM "oauth_access_tokens" WHERE "operation_owner_id" = ${previous.operationOwnerId}
     AND "expires_at" <= ${now} AND "refresh_token" IS NULL
     ORDER BY "expires_at", "token" LIMIT 100 FOR UPDATE SKIP LOCKED)`;
  return renewed;
}

/** RFC 7009 success is deliberately indistinguishable for absent or foreign tokens. */
export async function revokeOAuthToken(tx: Prisma.TransactionClient, clientId: string, tokenHash: string): Promise<void> {
  const candidate = await tx.oAuthAccessToken.findFirst({ where: { clientId, OR: [{ token: tokenHash }, { refreshToken: tokenHash }] } })
    ?? await tx.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: tokenHash } });
  if (!candidate || candidate.clientId !== clientId
    || ('retainUntil' in candidate && candidate.retainUntil <= new Date())) return;
  await lockOAuthConnection(tx, candidate.userId, clientId);
  await tx.oAuthAccessToken.deleteMany({ where: { operationOwnerId: candidate.operationOwnerId, userId: candidate.userId, clientId } });
}
