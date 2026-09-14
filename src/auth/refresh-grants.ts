import type { Prisma } from '../generated/prisma/client.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_IDLE_TTL, parseScopes } from './oauth-utils.js';

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

export async function rotateRefreshGrant(tx: Prisma.TransactionClient, input: RefreshInput) {
  const { clientId, resource, refreshHash, requestedScope, now } = input;
  // Find the lock identity without accepting the token. Re-read after acquiring the lock.
  const candidate = await tx.oAuthAccessToken.findUnique({ where: { refreshToken: refreshHash } })
    ?? await tx.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: refreshHash } });
  if (!candidate || candidate.clientId !== clientId || candidate.resource !== resource
    || !allowedScope(candidate.scope, requestedScope)) return null;
  await lockOAuthConnection(tx, candidate.userId, clientId);
  const previous = await tx.oAuthAccessToken.findUnique({ where: { refreshToken: refreshHash } });
  if (!previous) {
    const used = await tx.oAuthUsedRefreshToken.findUnique({ where: { refreshToken: refreshHash } });
    if (used && used.clientId === clientId && used.resource === resource && used.retainUntil > now
      && allowedScope(used.scope, requestedScope)) {
      // Never authorize a consumed token. Reuse invalidates only its own successor family.
      await tx.oAuthAccessToken.deleteMany({ where: { operationOwnerId: used.operationOwnerId, clientId, userId: used.userId, resource } });
    }
    return null;
  }
  const scope = allowedScope(previous.scope, requestedScope);
  if (previous.clientId !== clientId || previous.resource !== resource || !scope
    || !previous.refreshExpiresAt || previous.refreshExpiresAt <= now) return null;
  const deadline = new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL);
  await tx.oAuthUsedRefreshToken.create({ data: {
    refreshToken: refreshHash, operationOwnerId: previous.operationOwnerId,
    clientId, userId: previous.userId, resource, scope: previous.scope, retainUntil: deadline,
  } });
  await tx.oAuthAccessToken.delete({ where: { token: previous.token } });
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
