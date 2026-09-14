import type { AdAccountChoice } from '../ui/pages.js';
import { describeConnectionFailure } from './connection-capabilities.js';

export class MetaValidationError extends Error {}
interface MetaResponse { id?: string; data?: Array<Record<string, unknown>>; paging?: { cursors?: { after?: string }; next?: string }; error?: unknown }
/** Fixed Graph host and cursor pagination: credentials never go to a provider-supplied URL. */
export async function validateMetaConnection(token: string, management: boolean): Promise<{ metaUserId: string; accounts: AdAccountChoice[] }> {
  if (!token || token.length > 8192 || /\s/.test(token)) throw new MetaValidationError('Informe um token de acesso válido, sem espaços.');
  const version = process.env.META_API_VERSION || 'v26.0';
  if (!/^v\d+\.0$/.test(version)) throw new Error('Invalid Meta API version');
  async function read(path: string, params: Record<string, string> = {}): Promise<MetaResponse> {
    const url = new URL(`https://graph.facebook.com/${version}/${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    let response: globalThis.Response;
    try { response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new MetaValidationError('Não foi possível consultar a Meta. Tente novamente em instantes.'); }
    let payload: MetaResponse;
    try { payload = await response.json() as MetaResponse; } catch { throw new MetaValidationError('A Meta não retornou uma resposta válida. Tente novamente.'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new MetaValidationError('A Meta não retornou uma resposta válida. Tente novamente.');
    if (!response.ok || payload.error) {
      const failure = describeConnectionFailure(payload.error);
      throw new MetaValidationError(`${failure.reason} ${failure.action}`);
    }
    return payload;
  }
  const identity = await read('me', { fields: 'id' });
  if (!identity.id || !/^\d+$/.test(identity.id)) throw new MetaValidationError('Não foi possível identificar o proprietário do token na Meta.');
  const granted = new Set<string>();
  const permissionCursors = new Set<string>();
  let permissionsAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    const permissions = await read('me/permissions', { fields: 'permission,status', limit: '100', ...(permissionsAfter ? { after: permissionsAfter } : {}) });
    if (!Array.isArray(permissions.data)) throw new MetaValidationError('Não foi possível verificar as permissões na Meta. Tente novamente.');
    for (const item of permissions.data) {
      if (!item || typeof item.permission !== 'string' || typeof item.status !== 'string') throw new MetaValidationError('A Meta retornou permissões em um formato inesperado. Tente novamente.');
      if (item.status === 'granted') granted.add(item.permission);
    }
    if (!permissions.paging?.next) break;
    const cursor = permissions.paging.cursors?.after;
    if (!cursor || permissionCursors.has(cursor) || page === 9) throw new MetaValidationError('Não foi possível concluir a consulta de permissões na Meta. Tente novamente antes de alterar a conexão.');
    permissionCursors.add(cursor);
    permissionsAfter = cursor;
  }
  if (management ? !granted.has('ads_management') : !granted.has('ads_read') && !granted.has('ads_management')) {
    throw new MetaValidationError(management ? 'Este token precisa da permissão ads_management para gerenciar anúncios.' : 'Este token precisa da permissão ads_read ou ads_management para consultar anúncios.');
  }
  const accounts: AdAccountChoice[] = [];
  const seen = new Set<string>();
  const accountCursors = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const payload = await read('me/adaccounts', { fields: 'id,name,currency,account_status', limit: '100', ...(after ? { after } : {}) });
    if (!Array.isArray(payload.data)) throw new MetaValidationError('Não foi possível consultar as contas de anúncios.');
    for (const account of payload.data) {
      if (typeof account.id !== 'string' || !/^act_\d+$/.test(account.id) || seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push({ id: account.id, name: typeof account.name === 'string' ? account.name : account.id, ...(typeof account.currency === 'string' ? { currency: account.currency } : {}), ...(typeof account.account_status === 'number' ? { account_status: account.account_status } : {}) });
    }
    if (!payload.paging?.next) break;
    const cursor = payload.paging.cursors?.after;
    if (!cursor || accountCursors.has(cursor) || page === 9) throw new MetaValidationError('Não foi possível concluir a lista de contas desta conexão. Tente novamente ou use um token limitado às contas que deseja conectar.');
    accountCursors.add(cursor);
    after = cursor;
  }
  if (!accounts.length) throw new MetaValidationError('Este token não tem acesso a contas de anúncios. Confira os ativos atribuídos na Meta.');
  return { metaUserId: identity.id, accounts };
}
