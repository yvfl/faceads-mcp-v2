import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { withAuthContext, type AuthContext } from '../utils/auth-context.js';
import { usageLogger } from '../middleware/usage-logger.js';
import { isDatabaseConfigured, getPrisma, disconnectPrisma } from '../db/prisma.js';
import { decryptToken } from '../db/crypto.js';
import { oauthRouter } from '../routes/oauth.js';
import { scopeToPermission, hashSecret, getMcpResourceUri, parseScopes, SUPPORTED_SCOPES } from '../auth/oauth-utils.js';

interface HttpServerOptions { port: number; createServer: () => Server; }
interface HttpAuthContext extends AuthContext {
  grantId: string;
  operationOwnerId: string;
  connectionBinding: string;
  sessionBinding: string;
}
interface Session { transport: StreamableHTTPServerTransport; server: Server; connectionBinding: string; binding: string; ownerId: string; lastUsed: number; }

/** Resolve one immutable grant, including the Meta token and accounts consented to. */
export async function resolveBearer(bearer: string): Promise<HttpAuthContext | null> {
  if (!isDatabaseConfigured() || !/^[A-Za-z0-9_-]{43}$/.test(bearer)) return null;
  try {
    const prisma = getPrisma();
    const grantId = hashSecret(bearer);
    const grant = await prisma.oAuthAccessToken.findUnique({ where: { token: grantId } });
    if (!grant || grant.expiresAt <= new Date() || grant.resource !== getMcpResourceUri()
      || !grant.scope || !parseScopes(grant.scope) || grant.selectedAccountIds.length === 0
      || !grant.selectedAccountIds.every(id => /^act_\d+$/.test(id))) return null;
    const meta = await prisma.metaToken.findFirst({ where: { id: grant.metaTokenId, userId: grant.userId } });
    if (!meta || (meta.expiresAt && meta.expiresAt <= new Date())) return null;
    // Access tokens rotate, but the consented connection and its exact authority stay stable.
    // A new authorization or changed authority must initialize a separate MCP session.
    const connectionBinding = hashSecret(JSON.stringify([
      grant.operationOwnerId, grant.clientId, grant.userId, grant.resource, grant.metaTokenId,
    ]));
    const sessionBinding = hashSecret(JSON.stringify([
      connectionBinding,
      [...new Set(grant.scope.split(/\s+/).filter(Boolean))].sort(),
      [...new Set(grant.selectedAccountIds)].sort(),
    ]));
    return { accessToken: decryptToken(meta.accessToken), userId: grant.userId, grantId, operationOwnerId: grant.operationOwnerId,
      connectionBinding, sessionBinding,
      permissions: scopeToPermission(grant.scope), allowedAccountIds: grant.selectedAccountIds,
      apiVersion: process.env.META_API_VERSION || 'v26.0' };
  } catch { return null; }
}

export async function startHttpServer({ port, createServer }: HttpServerOptions) {
  const app = express();
  const base = (process.env.MCP_BASE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${port}`)).replace(/\/+$/, '');
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('MCP_BASE_URL must be an origin without a path');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('MCP_BASE_URL must use HTTPS outside localhost');
  process.env.MCP_BASE_URL = base;
  if (isDatabaseConfigured() && !/^[a-fA-F0-9]{64}$/.test(process.env.MCP_ENCRYPTION_KEY || '')) throw new Error('MCP_ENCRYPTION_KEY must contain 64 hex characters');
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) throw new Error('DATABASE_URL is required in production HTTP mode');
  app.disable('x-powered-by');
  if (process.env.RAILWAY_ENVIRONMENT_ID || process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const sessions = new Map<string, Session>();
  const pendingSessions = new Map<string, number>();
  let pendingSessionCount = 0;
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const origin = req.headers.origin;
    const allowedOrigins = new Set([base, ...(process.env.MCP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)]);
    if (origin && !allowedOrigins.has(origin)) { res.status(403).json({ error: 'origin_not_allowed' }); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.use(express.json({ limit: '1mb', type: req => !req.headers['content-type'] || req.headers['content-type'].includes('json') }));
  app.use(usageLogger());
  app.get('/health', async (_req, res) => {
    try {
      if (isDatabaseConfigured()) await getPrisma().$queryRaw`SELECT 1`;
      res.json({ status: 'ok', service: 'faceads-mcp-v2', version: '2.0.0' });
    } catch { res.status(503).json({ status: 'unavailable' }); }
  });
  const resourceMetadata = (_req: Request, res: Response) => res.json({
    resource: getMcpResourceUri(), authorization_servers: [base], bearer_methods_supported: ['header'],
    scopes_supported: SUPPORTED_SCOPES, resource_name: 'FaceAds MCP v2',
  });
  app.get('/.well-known/oauth-protected-resource', resourceMetadata);
  app.get('/.well-known/oauth-protected-resource/mcp', resourceMetadata);
  app.get('/.well-known/oauth-authorization-server', (_req, res) => res.json({
    issuer: base, authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`, revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: SUPPORTED_SCOPES, response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'], code_challenge_methods_supported: ['S256'],
  }));
  if (isDatabaseConfigured()) app.use('/oauth', oauthRouter);
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FaceAds MCP v2</title><style>body{font:18px system-ui;background:#f4f6fa;color:#152139;max-width:660px;margin:15vh auto;padding:24px;line-height:1.6}code{background:#e1e8f3;padding:6px 12px;border-radius:6px}h1{font-size:40px}a{color:#175cd3}</style><main><p>FACEADS / MCP v2</p><h1>Sua conta Meta no assistente que você usa.</h1><p>Adicione esta URL como um conector MCP remoto:</p><p><code>${getMcpResourceUri()}</code></p><p>O assistente abrirá a conexão. Entre, valide seu token Meta e escolha as contas que ele poderá acessar.</p></main></html>`));
  app.get('/favicon.ico', (_req, res) => res.type('image/svg+xml').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#175cd3"/><path d="M10 24V8h14v4H14v3h8v4h-8v5z" fill="white"/></svg>'));

  const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
  async function handle(req: Request, res: Response) {
    // Every request, including SSE and DELETE, revalidates the current grant.
    const bearer = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(req.headers.authorization || '')?.[1];
    const auth = bearer ? await resolveBearer(bearer) : null;
    if (!auth?.grantId) {
      // Request the connector's read/write capabilities; the browser flow validates Meta access and requires consent.
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="${SUPPORTED_SCOPES.join(' ')}"`);
      res.status(401).json({ error: 'invalid_token' }); return;
    }
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId !== undefined && typeof sessionId !== 'string') { res.sendStatus(400); return; }
    let session = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    if (sessionId && (!session || session.binding !== auth.sessionBinding)) {
      res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found; initialize a new session.' }, id: null }); return;
    }
    let releaseReservation: (() => void) | undefined;
    let initializingServer: Server | undefined;
    let sessionRegistered = false;
    try {
      await withAuthContext(auth, async () => {
        if (!session) {
          if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
            res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Initialize a session first.' }, id: null }); return;
          }
          // Narrowed consent invalidates earlier sessions. Release their slots so the
          // same connection can initialize immediately with its current authority.
          for (const [id, previous] of sessions) {
            if (previous.connectionBinding === auth.connectionBinding && previous.binding !== auth.sessionBinding) {
              sessions.delete(id); void previous.server.close().catch(() => {});
            }
          }
          const pendingForOwner = pendingSessions.get(auth.operationOwnerId) ?? 0;
          if (sessions.size + pendingSessionCount >= 1000
            || [...sessions.values()].filter(s => s.ownerId === auth.operationOwnerId).length + pendingForOwner >= 5) {
            res.status(429).json({ error: 'session_limit' }); return;
          }
          // Reserve before connect() yields so concurrent initialization cannot exceed either limit.
          pendingSessionCount++;
          pendingSessions.set(auth.operationOwnerId, pendingForOwner + 1);
          let reserved = true;
          releaseReservation = () => {
            if (!reserved) return;
            reserved = false;
            pendingSessionCount--;
            const remaining = (pendingSessions.get(auth.operationOwnerId) ?? 1) - 1;
            if (remaining) pendingSessions.set(auth.operationOwnerId, remaining);
            else pendingSessions.delete(auth.operationOwnerId);
          };
          const server = initializingServer = createServer();
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), enableJsonResponse: true,
            onsessioninitialized: id => {
              sessions.set(id, session!); sessionRegistered = true; releaseReservation?.();
            } });
          session = { transport, server, connectionBinding: auth.connectionBinding, binding: auth.sessionBinding, ownerId: auth.operationOwnerId, lastUsed: Date.now() };
          transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
          await server.connect(transport);
        }
        session.lastUsed = Date.now();
        await session.transport.handleRequest(req, res, req.method === 'POST' ? req.body : undefined);
      });
    } catch {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Request failed.' }, id: null });
    } finally {
      releaseReservation?.();
      if (initializingServer && !sessionRegistered) await initializingServer.close().catch(() => {});
    }
  }
  app.all('/mcp', limiter, handle);
  // POST / remains an authenticated alias for clients which probe the origin.
  app.post('/', limiter, handle);
  app.use((error: { status?: number }, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: 'invalid_request' });
  });
  const cleanup = setInterval(() => {
    for (const [id, session] of sessions) if (Date.now() - session.lastUsed > 30 * 60_000) {
      sessions.delete(id); void session.server.close().catch(() => {});
    }
  }, 60_000).unref();
  const listener = app.listen(port, '0.0.0.0', () => console.error(`FaceAds MCP v2 listening on port ${port}`));
  const shutdown = async () => {
    clearInterval(cleanup); listener.close();
    await Promise.allSettled([...sessions.values()].map(s => s.server.close()));
    await disconnectPrisma();
  };
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
  return { listener, close: shutdown };
}
