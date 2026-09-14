import { getAuthContext } from '../utils/auth-context.js';
import { describeConnectionFailure } from './connection-capabilities.js';

type Params = Record<string, unknown>;
type Read = (endpoint: string, params: Record<string, string>) => Promise<unknown>;
const ACCOUNT_EDGES = new Set(['campaigns', 'adsets', 'ads', 'adcreatives', 'adimages', 'advideos', 'customaudiences', 'adspixels', 'insights', 'reachestimate', 'delivery_estimate', 'adlabels', 'value_rule_set', 'promote_pages']);
const OBJECT_EDGES = new Set(['insights', 'ads', 'adsets', 'budget_schedules', 'previews', 'copies', 'adlabels', 'activities', 'delete_rule_set']);
const ASSET_EDGES = ['promote_pages', 'adspixels', 'advideos', 'value_rule_set', 'adlabels'];
const OBJECT_REFERENCES = new Set(['campaign_id', 'adset_id', 'ad_id', 'creative_id', 'pixel_id', 'value_rule_set_id', 'page_id', 'video_id', 'custom_audience_id', 'origin_audience_id', 'object_id']);
const PUBLIC_SEARCH_TYPES = new Set(['adgeolocation', 'adinterest', 'adinterestsuggestion', 'adTargetingCategory']);

class ProbeLimitError extends Error {}
class AssetScopeError extends Error {}

function scopeFailure(reason: string): AssetScopeError {
  return new AssetScopeError(`Não foi possível concluir a verificação de vínculo dos ativos às contas autorizadas. ${reason} A lista não pode ser considerada completa. Tente novamente.`);
}

function safeScopeFailure(error: unknown): Error {
  if (error instanceof AssetScopeError || error instanceof ProbeLimitError) return error;
  const failure = describeConnectionFailure(error);
  return scopeFailure(`${failure.reason}${failure.code !== undefined ? ` (Meta ${failure.code})` : ''} ${failure.action}`);
}
/** Bound and memoize ownership probes for this authorization call only. */
function boundedReads(read: Read): Read {
  const cache = new Map<string, Promise<unknown>>();
  const deadline = Date.now() + 20_000;
  let count = 0;
  return (endpoint, params) => {
    const key = JSON.stringify([endpoint, Object.entries(params).sort()]);
    const cached = cache.get(key);
    if (cached) return cached;
    if (++count > 60 || Date.now() >= deadline) return Promise.reject(new ProbeLimitError('Limite de verificação de ativos atingido. Reduza as contas selecionadas e tente novamente.'));
    const pending = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProbeLimitError('Tempo de verificação de ativos excedido. Tente novamente.')), deadline - Date.now());
      read(endpoint, params).then(resolve, reject).finally(() => clearTimeout(timer));
    });
    cache.set(key, pending);
    return pending;
  };
}
function rethrowLimit(error: unknown): void { if (error instanceof ProbeLimitError) throw error; }

function denied(reason: string): never {
  throw new Error(`Acesso negado: ${reason}`);
}
function accountId(id: unknown): string | null {
  const value = String(id ?? '');
  return /^(?:act_)?\d+$/.test(value) ? `act_${value.replace(/^act_/, '')}` : null;
}
function record(value: unknown): Params {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Params : {};
}
function accounts(): Set<string> | null {
  const allowed = getAuthContext()?.allowedAccountIds;
  return allowed === undefined ? null : new Set(allowed.map(accountId).filter((id): id is string => !!id));
}

async function listedAsset(account: string, edge: string, id: string, read: Read): Promise<boolean> {
  let after: string | undefined;
  const cursors = new Set<string>();
  for (let page = 0; page < 10; page++) {
    let result: Params;
    try { result = record(await read(`${account}/${edge}`, { fields: 'id', limit: '100', ...(after ? { after } : {}) })); }
    catch (error) { throw safeScopeFailure(error); }
    if (!Array.isArray(result.data)) throw scopeFailure('A Meta retornou uma lista de vínculos em formato inválido.');
    if (result.data.some(item => String(record(item).id) === id)) return true;
    if (result.data.some(item => !/^\d+$/.test(String(record(item).id ?? '')))) throw scopeFailure('A Meta retornou vínculos sem identificadores válidos.');
    const paging = record(result.paging);
    const cursor = record(paging.cursors).after;
    if (!paging.next) return false;
    if (typeof cursor !== 'string' || !cursor) throw scopeFailure('A próxima página de vínculos veio sem cursor.');
    if (cursors.has(cursor)) throw scopeFailure('A Meta repetiu um cursor na lista de vínculos.');
    cursors.add(cursor);
    after = cursor;
  }
  throw scopeFailure('A verificação de vínculos atingiu o limite de 10 páginas.');
}

async function authorizeObject(id: string, allowed: Set<string>, read: Read, allowSharedAudience = false): Promise<void> {
  if (!/^\d+$/.test(id)) denied('identificador de objeto inválido.');
  let object: Params | undefined;
  let incomplete: Error | undefined;
  try { object = record(await read(id, { fields: 'id,account_id' })); } catch (error) { rethrowLimit(error); /* Some assets have no account_id field. */ }
  if (object?.account_id !== undefined) {
    if (allowed.has(accountId(object.account_id)!)) return;
    if (allowSharedAudience) {
      for (const account of allowed) {
        try { if (await listedAsset(account, 'customaudiences', id, read)) return; }
        catch (error) { rethrowLimit(error); incomplete ??= safeScopeFailure(error); }
      }
    }
    if (incomplete) throw incomplete;
    denied('o objeto pertence a uma conta não autorizada nesta conexão.');
  }
  // Only assets actually associated with an approved account can use this fallback.
  for (const account of allowed) {
    for (const edge of ASSET_EDGES) {
      try { if (await listedAsset(account, edge, id, read)) return; }
      catch (error) { rethrowLimit(error); incomplete ??= safeScopeFailure(error); /* Another asset family can still prove membership. */ }
    }
  }
  if (incomplete) throw incomplete;
  denied('não foi possível comprovar a conta deste objeto. Selecione a conta correta ou reconecte.');
}

/** Shared gate for typed tools AND raw Graph calls. The read callback must bypass this gate. */
export async function authorizeGraphRequest(endpoint: string, method: string, params: Params, read: Read, budgetScheduleParent?: string): Promise<void> {
  const allowed = accounts();
  if (allowed === null) return;
  if (allowed.size === 0) denied('nenhuma conta foi autorizada.');
  const approved = allowed;
  read = boundedReads(read);
  const verb = method.toUpperCase();
  if (getAuthContext()?.permissions !== 'readwrite' && verb !== 'GET') denied('esta conexão permite apenas leitura.');
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(endpoint)) denied('endpoint fora do formato permitido.');
  for (const key of ['access_token', 'appsecret_proof', 'batch', 'ids', 'method', 'http_method', 'relative_url']) {
    if (Object.hasOwn(params, key)) denied(`o parâmetro ${key} não pode substituir a autorização da conexão.`);
  }
  if (typeof params.fields === 'string' && /[{}]/.test(params.fields)) {
    // This is the only legacy field expansion needed by the typed Instagram discovery tool.
    const safe = /^id,instagram_business_account\{id,username,name,profile_picture_url\},connected_instagram_account\{id,username\}$/;
    if (!safe.test(params.fields)) denied('expansão de campos não está habilitada; consulte objetos autorizados separadamente.');
  }
  const [parent, edge] = endpoint.split('/');
  if (endpoint === 'me/permissions' && verb === 'GET') {
    if (Object.keys(params).some(key => !['fields', 'limit', 'after'].includes(key)) || (params.fields !== undefined && params.fields !== 'permission,status')) denied('o diagnóstico de permissões aceita apenas permission,status e paginação.');
    return;
  }
  if (parent === 'me' && ['adaccounts', 'accounts'].includes(edge) && verb === 'GET') return;
  if (endpoint === 'search' && verb === 'GET' && PUBLIC_SEARCH_TYPES.has(String(params.type))) return;
  if (endpoint === 'dataset_quality' && verb === 'GET') {
    await authorizeObject(String(params.dataset_id ?? ''), allowed, read);
    return;
  }
  if (/^act_\d+$/.test(parent)) {
    if (!allowed.has(parent)) denied('conta não autorizada nesta conexão.');
    if ((!edge && verb !== 'GET') || (edge && !ACCOUNT_EDGES.has(edge))) denied('operação de conta não habilitada.');
    if (verb === 'DELETE') denied('a conexão não permite excluir contas de anúncios.');
  } else {
    if (edge && !OBJECT_EDGES.has(edge)) denied('operação de objeto não habilitada.');
    if (budgetScheduleParent !== undefined) {
      if (edge) denied('referência de agendamento inválida.');
      await authorizeObject(budgetScheduleParent, allowed, read);
      if (!await listedAsset(budgetScheduleParent, 'budget_schedules', parent, read)) denied('agendamento não pertence à campanha informada.');
    } else {
      await authorizeObject(parent, allowed, read, verb === 'GET');
    }
  }
  const checked = new Set<string>();
  async function references(value: unknown, depth = 0, parentKey = ''): Promise<void> {
    if (depth > 8) denied('estrutura de parâmetros muito profunda.');
    if (typeof value === 'string' && /^[\[{]/.test(value.trimStart())) {
      try { value = JSON.parse(value.trimStart()); } catch { return; }
    }
    if (Array.isArray(value)) {
      for (const item of value) await references(item, depth + 1, parentKey);
      return;
    }
    for (const [key, entry] of Object.entries(record(value))) {
      if (key === 'account_id' || key === 'ad_account_id') {
        if (!approved.has(accountId(entry)!)) denied('conta referenciada não autorizada.');
      } else if (key === 'object_story_id' && entry) {
        const match = /^(\d+)_(\d+)$/.exec(String(entry));
        if (!match) denied('object_story_id deve identificar a Página e a publicação.');
        await authorizeObject(match[1], approved, read);
      } else if ((OBJECT_REFERENCES.has(key) || (key === 'id' && ['creative', 'custom_audiences', 'excluded_custom_audiences', 'event_sources', 'adlabels'].includes(parentKey))) && entry !== undefined && entry !== null) {
        const id = String(entry);
        const shared = ['origin_audience_id', 'custom_audience_id'].includes(key) || ['custom_audiences', 'excluded_custom_audiences'].includes(parentKey);
        const proofKey = `${shared ? 'shared' : 'owned'}:${id}`;
        if (!checked.has(proofKey)) { await authorizeObject(id, approved, read, shared); checked.add(proofKey); }
      } else if (typeof entry === 'object' || (typeof entry === 'string' && /^[\[{]/.test(entry.trimStart()))) {
        await references(entry, depth + 1, key);
      }
    }
  }
  await references(params);
}

/** Discovery must not advertise accounts or Pages outside this particular OAuth grant. */
export async function scopeGraphResponse<T>(endpoint: string, response: T, read: Read): Promise<T> {
  if (endpoint === 'me/permissions') {
    const data = record(response);
    const paging = record(data.paging);
    return { ...(Array.isArray(data.data) ? { data: data.data.map(item => ({ permission: record(item).permission, status: record(item).status })) } : {}), ...(data.paging ? { paging: { cursors: paging.cursors } } : {}) } as T;
  }
  const allowed = accounts();
  if (allowed === null || !['me/adaccounts', 'me/accounts'].includes(endpoint)) return response;
  read = boundedReads(read);
  const data = record(response);
  if (!Array.isArray(data.data)) return response;
  const filtered: unknown[] = [];
  for (const item of data.data) {
    const id = String(record(item).id ?? '');
    if (endpoint === 'me/adaccounts') {
      if (allowed.has(accountId(id)!)) filtered.push(item);
    } else {
      if (!/^\d+$/.test(id)) throw scopeFailure('A Meta retornou uma Página sem identificador válido.');
      let verified = false;
      let incomplete: Error | undefined;
      for (const account of allowed) {
        try {
          if (await listedAsset(account, 'promote_pages', id, read)) { filtered.push(item); verified = true; break; }
        } catch (error) { rethrowLimit(error); incomplete ??= safeScopeFailure(error); }
      }
      // Failed/incomplete ownership checks are not evidence that a Page is absent.
      if (!verified && incomplete) throw incomplete;
    }
  }
  // Keep cursors for bounded continuation. Never expose a provider URL with its token.
  const paging = record(data.paging);
  return { ...data, data: filtered, ...(data.paging ? { paging: { cursors: paging.cursors } } : {}) } as T;
}
