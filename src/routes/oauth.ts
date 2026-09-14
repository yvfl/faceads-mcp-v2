import express, { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { OAuthClient, OAuthFlow } from '../generated/prisma/client.js';
import { getPrisma } from '../db/prisma.js';
import { encryptToken, decryptToken } from '../db/crypto.js';
import { generateClientSecret, generateAuthCode, generateToken, generateFlowId, hashPassword, verifyPassword, verifyPkceS256, scopeToPermission, ACCESS_TOKEN_TTL, REFRESH_TOKEN_IDLE_TTL, AUTH_CODE_TTL, AUTH_FLOW_TTL, resolveMcpResource, hashSecret, constantEqual, parseScopes, isAllowedRedirectUri } from '../auth/oauth-utils.js';
import { lockOAuthConnection, rotateRefreshGrant, revokeOAuthToken } from '../auth/refresh-grants.js';
import { getBrowserFlow, setFlowCookie, clearFlowCookie } from '../auth/web-session.js';
import { validateMetaConnection, MetaValidationError } from '../auth/meta-validation.js';
import { renderLoginPage, renderSettingsPage, renderErrorPage, type AdAccountChoice, type PageContext } from '../ui/pages.js';

export const oauthRouter = Router();
const router = oauthRouter;
router.use(express.urlencoded({ extended: false, limit: '24kb', parameterLimit: 1100 }));
router.use((_req, res, next) => {
  // same-origin hides flow parameters on the external callback while preserving browser POST Origin.
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
  next();
});
const rateMessage = { error: 'temporarily_unavailable', error_description: 'Muitas tentativas. Aguarde alguns minutos.' };
router.use('/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: rateMessage }));
router.use(['/authorize', '/settings', '/consent', '/connections'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false, message: rateMessage }));
router.use(['/token', '/revoke'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: rateMessage }));
function invalidFlow(res: Response): void { res.status(400).type('html').send(renderErrorPage()); }
function oauthError(res: Response, error: string, status = 400): void { res.status(status).json({ error }); }
function safeFailure(res: Response): void { res.status(500).type('html').send(renderErrorPage('Não foi possível concluir a conexão. Tente novamente em instantes.')); }
function string(value: unknown, max = 2048): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function context(input: { flow: OAuthFlow; csrf: string; clientName: string }): PageContext {
  return { flow: input.flow.id, csrf: input.csrf, clientName: input.clientName, scope: input.flow.scope };
}
async function showSettings(res: Response, input: { flow: OAuthFlow; csrf: string; clientName: string }, status = 200, error?: string, notice?: string, selection: Pick<PageContext, 'accessMode' | 'selectedAccountIds'> = {}): Promise<void> {
  const prisma = getPrisma();
  const [saved, grants] = await Promise.all([
    prisma.metaToken.findFirst({ where: { userId: input.flow.userId! }, select: { id: true } }),
    prisma.oAuthAccessToken.findMany({ where: { userId: input.flow.userId!, OR: [{ expiresAt: { gt: new Date() } }, { refreshExpiresAt: { gt: new Date() } }] }, select: { clientId: true, selectedAccountIds: true, client: { select: { clientName: true } } }, take: 100 }),
  ]);
  const unique = new Map<string, { clientId: string; clientName: string; accounts: Set<string> }>();
  for (const grant of grants) {
    const entry = unique.get(grant.clientId) || { clientId: grant.clientId, clientName: grant.client.clientName, accounts: new Set<string>() };
    grant.selectedAccountIds.forEach(id => entry.accounts.add(id)); unique.set(grant.clientId, entry);
  }
  // Browsers apply form-action to the final OAuth POST redirect as well.
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(input.flow.redirectUri).origin}; frame-ancestors 'none'; base-uri 'none'`);
  res.status(status).type('html').send(renderSettingsPage({ ...context(input), ...selection, error, notice, hasSavedToken: !!saved, accounts: input.flow.pendingMetaToken && Array.isArray(input.flow.accounts) ? input.flow.accounts as unknown as AdAccountChoice[] : undefined, connections: [...unique.values()].map(value => ({ clientId: value.clientId, clientName: value.clientName, accountCount: value.accounts.size })) }));
}

router.post('/register', async (req: Request, res: Response) => {
  const body = req.body || {};
  const { client_name, redirect_uris } = body;
  const grants = body.grant_types ?? ['authorization_code', 'refresh_token'];
  const authMethod = body.token_endpoint_auth_method ?? 'none';
  if (!string(client_name, 120) || !client_name.trim() || !Array.isArray(redirect_uris) || !redirect_uris.length || redirect_uris.length > 10 || !redirect_uris.every(isAllowedRedirectUri) || !Array.isArray(grants) || !grants.includes('authorization_code') || grants.some(value => !['authorization_code', 'refresh_token'].includes(value)) || !['none', 'client_secret_post'].includes(authMethod) || (body.response_types !== undefined && (!Array.isArray(body.response_types) || body.response_types.length !== 1 || body.response_types[0] !== 'code'))) {
    oauthError(res, 'invalid_client_metadata'); return;
  }
  try {
    const secret = authMethod === 'client_secret_post' ? generateClientSecret() : null;
    const client = await getPrisma().oAuthClient.create({ data: { clientName: client_name.trim(), clientSecret: secret ? hashSecret(secret) : null, tokenEndpointAuthMethod: authMethod, redirectUris: [...new Set(redirect_uris)] as string[], grantTypes: [...new Set(grants)] as string[] } });
    res.status(201).json({ client_id: client.id, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}), client_name: client.clientName, redirect_uris: client.redirectUris, grant_types: client.grantTypes, response_types: ['code'], token_endpoint_auth_method: authMethod });
  } catch { oauthError(res, 'server_error', 500); }
});

router.get('/authorize', async (req: Request, res: Response) => {
  const query = req.query;
  const scope = parseScopes(query.scope);
  if (query.response_type !== 'code') { oauthError(res, 'unsupported_response_type'); return; }
  if (!string(query.client_id, 128) || !isAllowedRedirectUri(query.redirect_uri) || !string(query.code_challenge, 43) || !/^[A-Za-z0-9_-]{43}$/.test(query.code_challenge) || query.code_challenge_method !== 'S256' || (query.state !== undefined && (typeof query.state !== 'string' || query.state.length > 2048))) { oauthError(res, 'invalid_request'); return; }
  if (!scope) { oauthError(res, 'invalid_scope'); return; }
  const resource = resolveMcpResource(query.resource);
  if (!resource) { oauthError(res, 'invalid_target'); return; }
  try {
    const prisma = getPrisma();
    const client = await prisma.oAuthClient.findUnique({ where: { id: query.client_id } });
    if (!client || !client.redirectUris.includes(query.redirect_uri) || !client.grantTypes.includes('authorization_code')) { oauthError(res, 'invalid_request'); return; }
    // Bounded cleanup keeps expired browser state and any encrypted pending token short-lived.
    await prisma.oAuthFlow.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const secret = generateToken();
    const flow = await prisma.oAuthFlow.create({ data: { id: generateFlowId(), browserSecretHash: hashSecret(secret), clientId: client.id, redirectUri: query.redirect_uri, scope, resource, codeChallenge: query.code_challenge, state: query.state as string | undefined, expiresAt: new Date(Date.now() + AUTH_FLOW_TTL) } });
    setFlowCookie(res, flow.id, secret);
    res.type('html').send(renderLoginPage({ flow: flow.id, csrf: secret, clientName: client.clientName, scope }));
  } catch { safeFailure(res); }
});

router.post('/authorize', async (req: Request, res: Response) => {
  try {
    const input = await getBrowserFlow(req);
    if (!input) { invalidFlow(res); return; }
    if (input.flow.userId) { res.redirect(303, `/oauth/settings?flow=${input.flow.id}`); return; }
    const { password, action } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !string(password, 256) || password.length < 8 || !['login', 'register'].includes(action)) {
      res.status(400).type('html').send(renderLoginPage({ ...context(input), error: 'Informe um e-mail válido e uma senha com pelo menos 8 caracteres.' })); return;
    }
    const prisma = getPrisma();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && action === 'register') {
      try { user = await prisma.user.create({ data: { email, passwordHash: hashPassword(password) } }); }
      catch { user = await prisma.user.findUnique({ where: { email } }); }
    }
    // A dummy scrypt keeps unknown-user login and wrong-password work comparable.
    const passwordHash = user?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = verifyPassword(password, passwordHash);
    if (!user || !valid) { res.status(401).type('html').send(renderLoginPage({ ...context(input), error: 'Não foi possível entrar. Confira o e-mail e a senha.' })); return; }
    const bound = await prisma.oAuthFlow.updateMany({ where: { id: input.flow.id, userId: null, expiresAt: { gt: new Date() } }, data: { userId: user.id } });
    if (bound.count !== 1) { invalidFlow(res); return; }
    res.redirect(303, `/oauth/settings?flow=${input.flow.id}`);
  } catch { safeFailure(res); }
});

router.get('/settings', async (req: Request, res: Response) => {
  try { const input = await getBrowserFlow(req, true); if (!input) { invalidFlow(res); return; } await showSettings(res, input); }
  catch { safeFailure(res); }
});
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const input = await getBrowserFlow(req, true);
    if (!input) { invalidFlow(res); return; }
    let token = typeof req.body.meta_access_token === 'string' ? req.body.meta_access_token.trim() : '';
    if (req.body.use_saved === 'yes') {
      const saved = await getPrisma().metaToken.findFirst({ where: { userId: input.flow.userId! }, orderBy: { createdAt: 'desc' } });
      if (saved) token = decryptToken(saved.accessToken);
    }
    try {
      // The user chooses the final access level after seeing the available accounts.
      const validated = await validateMetaConnection(token, false);
      const updated = await getPrisma().oAuthFlow.updateMany({ where: { id: input.flow.id, expiresAt: { gt: new Date() } }, data: { pendingMetaToken: encryptToken(token), metaUserId: validated.metaUserId, accounts: JSON.parse(JSON.stringify(validated.accounts)) } });
      if (updated.count !== 1) { invalidFlow(res); return; }
      res.redirect(303, `/oauth/settings?flow=${input.flow.id}`);
    } catch (error) {
      if (!(error instanceof MetaValidationError)) throw error;
      await showSettings(res, input, 400, error.message);
    }
  } catch { safeFailure(res); }
});
router.post('/settings/reset', async (req: Request, res: Response) => {
  try {
    const input = await getBrowserFlow(req, true); if (!input) { invalidFlow(res); return; }
    await getPrisma().oAuthFlow.updateMany({ where: { id: input.flow.id }, data: { pendingMetaToken: null, metaUserId: null } });
    res.redirect(303, `/oauth/settings?flow=${input.flow.id}`);
  } catch { safeFailure(res); }
});
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const input = await getBrowserFlow(req, true);
    if (!input || !input.flow.pendingMetaToken || !Array.isArray(input.flow.accounts)) { invalidFlow(res); return; }
    const selected: unknown[] = Array.isArray(req.body.account_ids) ? req.body.account_ids : typeof req.body.account_ids === 'string' ? [req.body.account_ids] : [];
    // A missing choice safely defaults to read, including forms opened before this update.
    const accessMode = req.body.access_mode === undefined ? 'read' : req.body.access_mode;
    if (accessMode !== 'read' && accessMode !== 'readwrite') { await showSettings(res, input, 400, 'Escolha somente leitura ou leitura e gerenciamento.'); return; }
    if (accessMode === 'readwrite' && scopeToPermission(input.flow.scope) !== 'readwrite') { await showSettings(res, input, 400, 'Este aplicativo solicitou somente leitura. Inicie uma nova conexão com permissão de gerenciamento.'); return; }
    const selection = { accessMode, selectedAccountIds: selected.filter((id): id is string => typeof id === 'string') };
    const available = new Set((input.flow.accounts as unknown as AdAccountChoice[]).map(account => account.id));
    if (req.body.consent !== 'yes' || !selected.length || selected.some(id => typeof id !== 'string' || !available.has(id))) { await showSettings(res, input, 400, 'Selecione pelo menos uma conta disponível e confirme a autorização.', undefined, selection); return; }
    try {
      const validated = await validateMetaConnection(decryptToken(input.flow.pendingMetaToken), accessMode === 'readwrite');
      if (validated.metaUserId !== input.flow.metaUserId || selected.some(id => !validated.accounts.some(account => account.id === id))) {
        throw new MetaValidationError('O acesso às contas mudou na Meta. Verifique o token e selecione as contas novamente.');
      }
    } catch (error) {
      if (!(error instanceof MetaValidationError)) throw error;
      await showSettings(res, input, 400, error.message, undefined, selection); return;
    }
    // ads_management includes read operations; choosing read always narrows that capability.
    const grantedScope = accessMode === 'readwrite' ? input.flow.scope : 'ads_read';
    const code = generateAuthCode();
    const created = await getPrisma().$transaction(async tx => {
      const claimed = await tx.oAuthFlow.deleteMany({ where: { id: input.flow.id, expiresAt: { gt: new Date() }, pendingMetaToken: input.flow.pendingMetaToken } });
      if (claimed.count !== 1) return false;
      const metaToken = await tx.metaToken.create({ data: { userId: input.flow.userId!, accessToken: input.flow.pendingMetaToken!, metaUserId: input.flow.metaUserId, scopes: grantedScope } });
      await tx.authorizationCode.create({ data: { code: hashSecret(code), clientId: input.flow.clientId, userId: input.flow.userId!, redirectUri: input.flow.redirectUri, scope: grantedScope, codeChallenge: input.flow.codeChallenge, codeChallengeMethod: 'S256', resource: input.flow.resource, selectedAccountIds: [...new Set(selected)] as string[], metaTokenId: metaToken.id, expiresAt: new Date(Date.now() + AUTH_CODE_TTL) } });
      return true;
    });
    if (!created) { invalidFlow(res); return; }
    clearFlowCookie(res, input.flow.id);
    const target = new URL(input.flow.redirectUri);
    target.searchParams.set('code', code);
    if (input.flow.state !== null) target.searchParams.set('state', input.flow.state);
    res.redirect(303, target.toString());
  } catch { safeFailure(res); }
});

async function authenticateClient(req: Request): Promise<OAuthClient | null> {
  if (!string(req.body?.client_id, 128) || req.headers.authorization) return null;
  const client = await getPrisma().oAuthClient.findUnique({ where: { id: req.body.client_id } });
  if (!client) return null;
  if (client.tokenEndpointAuthMethod === 'none') return req.body.client_secret ? null : client;
  if (client.tokenEndpointAuthMethod !== 'client_secret_post' || !string(req.body.client_secret, 256) || !client.clientSecret || !constantEqual(hashSecret(req.body.client_secret), client.clientSecret)) return null;
  return client;
}
router.post('/token', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!['authorization_code', 'refresh_token'].includes(body.grant_type)) { oauthError(res, 'unsupported_grant_type'); return; }
    const client = await authenticateClient(req);
    if (!client) { oauthError(res, 'invalid_client', 401); return; }
    if (!client.grantTypes.includes(body.grant_type)) { oauthError(res, 'unauthorized_client'); return; }
    const resource = resolveMcpResource(body.resource);
    if (!resource) { oauthError(res, 'invalid_target'); return; }
    const accessToken = generateToken(); const refreshToken = generateToken(); const now = new Date();
    const issueRefresh = client.grantTypes.includes('refresh_token');
    const result = await getPrisma().$transaction(async tx => {
      if (body.grant_type === 'authorization_code') {
        if (!string(body.code, 128) || !string(body.code_verifier, 128) || !string(body.redirect_uri)) return null;
        const code = await tx.authorizationCode.findUnique({ where: { code: hashSecret(body.code) } });
        if (!code || code.used || code.expiresAt <= now || code.clientId !== client.id || code.redirectUri !== body.redirect_uri || !client.redirectUris.includes(code.redirectUri) || code.resource !== resource || !code.selectedAccountIds.length || !verifyPkceS256(body.code_verifier, code.codeChallenge)) return null;
        await lockOAuthConnection(tx, code.userId, client.id);
        const claimed = await tx.authorizationCode.updateMany({ where: { code: code.code, used: false, expiresAt: { gt: now } }, data: { used: true } });
        if (claimed.count !== 1) return null;
        return tx.oAuthAccessToken.create({ data: { token: hashSecret(accessToken), clientId: client.id, userId: code.userId, scope: code.scope, resource: code.resource, selectedAccountIds: code.selectedAccountIds, metaTokenId: code.metaTokenId, createdAt: now, expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL), refreshToken: issueRefresh ? hashSecret(refreshToken) : null, refreshExpiresAt: issueRefresh ? new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL) : null } });
      }
      if (!string(body.refresh_token, 128)) return null;
      return rotateRefreshGrant(tx, { clientId: client.id, resource, refreshHash: hashSecret(body.refresh_token), requestedScope: body.scope, accessHash: hashSecret(accessToken), nextRefreshHash: hashSecret(refreshToken), now });
    });
    if (!result) { oauthError(res, 'invalid_grant'); return; }
    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL / 1000, scope: result.scope, ...(result.refreshToken ? { refresh_token: refreshToken } : {}) });
  } catch { oauthError(res, 'server_error', 500); }
});
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const client = await authenticateClient(req);
    if (!client) { oauthError(res, 'invalid_client', 401); return; }
    if (!string(req.body.token, 128)) { oauthError(res, 'invalid_request'); return; }
    const token = hashSecret(req.body.token);
    await getPrisma().$transaction(tx => revokeOAuthToken(tx, client.id, token));
    res.status(200).json({});
  } catch { oauthError(res, 'server_error', 500); }
});
router.post('/connections/revoke', async (req: Request, res: Response) => {
  try {
    const input = await getBrowserFlow(req, true);
    if (!input || !string(req.body.client_id, 128)) { invalidFlow(res); return; }
    await getPrisma().$transaction(async tx => {
      await lockOAuthConnection(tx, input.flow.userId!, req.body.client_id);
      await tx.oAuthAccessToken.deleteMany({ where: { userId: input.flow.userId!, clientId: req.body.client_id } });
      await tx.authorizationCode.updateMany({ where: { userId: input.flow.userId!, clientId: req.body.client_id }, data: { used: true } });
    });
    await showSettings(res, input, 200, undefined, 'Acesso revogado. Esse assistente precisa de uma nova autorização para acessar suas contas.');
  } catch { safeFailure(res); }
});
