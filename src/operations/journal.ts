import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { getAuthContext } from '../utils/auth-context.js';
import { getMetaConfig } from '../utils/config.js';
import { FileOperationStore, PostgresOperationStore } from './store.js';
import type { OperationReceipt, OperationRecord, OperationStore } from './types.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const requestPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safeId = (value: unknown): value is string => typeof value === 'string' && /^(?:act_)?[0-9]{1,32}$/.test(value);
const statuses = new Set(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED']);
const numericFields = new Set(['daily_budget', 'lifetime_budget', 'bid_amount', 'spend_cap', 'budget_value', 'time_start', 'time_end']);
const identityFields = new Set(['campaign_id', 'adset_id', 'creative_id', 'page_id', 'pixel_id', 'video_id', 'account_id']);

interface Context {
  tool: string;
  requestId: string;
  store?: OperationStore;
  ordinal: number;
  operations: OperationReceipt[];
}
const storage = new AsyncLocalStorage<Context>();
const postgresStore = new PostgresOperationStore();

function identity(): { ownerHash: string; userId?: string; grantId?: string } {
  const auth = getAuthContext();
  if (auth?.grantId && !auth.operationOwnerId) throw new Error('Conexão OAuth sem identidade estável para operações. Atualize o banco e a conexão antes de escrever.');
  const source = auth?.operationOwnerId ? `connection:${auth.operationOwnerId}` : `token:${auth?.accessToken ?? getMetaConfig()?.accessToken ?? ''}`;
  if (source === 'token:') throw new Error('Credencial ausente para identificar o journal de operações.');
  return { ownerHash: digest(source), ...(auth?.userId ? { userId: auth.userId } : {}), ...(auth?.grantId ? { grantId: auth.grantId } : {}) };
}
function selectedStore(): OperationStore {
  if (storage.getStore()?.store) return storage.getStore()!.store!;
  // A real remote grant must use shared durable storage, never a replica's disk.
  return getAuthContext()?.grantId ? postgresStore : new FileOperationStore(process.env.FACEADS_OPERATIONS_DIR);
}
function validateRequestId(requestId: string): void {
  if (!requestPattern.test(requestId)) throw new Error('request_id deve ter de 1 a 128 caracteres: letras, números, ponto, dois-pontos, sublinhado ou hífen.');
}

export async function withOperationContext<T>(input: { tool: string; requestId?: string; store?: OperationStore }, execute: (context: Context) => Promise<T>): Promise<{ result: T; operations: OperationReceipt[] }> {
  const requestId = input.requestId ?? randomUUID();
  validateRequestId(requestId);
  const context: Context = { tool: input.tool, requestId, store: input.store, ordinal: 0, operations: [] };
  return storage.run(context, async () => ({ result: await execute(context), operations: context.operations }));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
function fingerprint(method: string, endpoint: string, params: Record<string, unknown>): string {
  const normalized = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => {
    // Typed wrappers and execute_api JSON strings must share the same guard.
    if (typeof value === 'string' && /^[\[{]/.test(value)) {
      try { value = JSON.parse(value); } catch { /* Graph will validate the original string. */ }
    }
    return [key, typeof value === 'object' ? JSON.stringify(canonical(value)) : String(value)];
  }));
  return digest(JSON.stringify({ method, endpoint, params: canonical(normalized) }));
}

export function sanitizeChangedFields(params: Record<string, unknown>): OperationRecord['changedFields'] {
  const fields: OperationRecord['changedFields'] = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = /^[a-z][a-z0-9_]{0,63}$/.test(key) ? key : '[nonstandard_field]';
    if (key === 'status' && typeof value === 'string' && statuses.has(value)) fields[name] = value;
    else if (numericFields.has(key) && ((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && /^\d{1,20}(?:\.\d+)?$/.test(value)))) fields[name] = value;
    else if (identityFields.has(key) && safeId(value)) fields[name] = value;
    else fields[name] = '[redacted]';
  }
  return fields;
}

export function sanitizeWriteResponse(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const response = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ['id', 'video_id', 'post_id', 'creative_id', 'copied_campaign_id', 'copied_adset_id', 'copied_ad_id', 'source_id', 'copied_id']) {
    if (safeId(response[key]) || (['id', 'post_id'].includes(key) && typeof response[key] === 'string' && /^\d{1,32}_\d{1,32}$/.test(response[key] as string))) safe[key] = response[key];
  }
  if (typeof response.success === 'boolean') safe.success = response.success;
  if (typeof response.hash === 'string' && /^[a-f0-9]{16,128}$/i.test(response.hash)) safe.hash = response.hash;
  for (const key of ['ad_object_ids', 'copy_ids']) {
    if (Array.isArray(response[key])) safe[key] = response[key].flatMap<string | Record<string, unknown>>(item => {
      if (safeId(item)) return [item];
      const ids = sanitizeWriteResponse(item);
      if (!Object.keys(ids).length) return [];
      const type = item && typeof item === 'object' ? item.ad_object_type : undefined;
      if (['unique_adcreative', 'ad', 'ad_set', 'campaign', 'opportunities', 'privacy_info_center', 'topline', 'ad_account', 'product'].includes(type)) ids.ad_object_type = type;
      return [ids];
    });
  }
  if (response.images && typeof response.images === 'object' && !Array.isArray(response.images)) {
    const images = Object.values(response.images as Record<string, unknown>).flatMap(image => {
      const sanitized = sanitizeWriteResponse(image);
      return sanitized.hash ? [sanitized] : [];
    });
    if (images.length) safe.images = Object.fromEntries(images.map((image, index) => [`image_${index}`, image]));
  }
  return safe;
}

function nextStep(record: OperationRecord): string | undefined {
  if (!['pending', 'unknown'].includes(record.status)) return undefined;
  if (record.method === 'POST' && record.entityId && !record.endpoint.includes('/')) {
    return `Resultado incerto. Não repita a escrita. Consulte get_operation_status com ${JSON.stringify({ request_id: record.requestId, inspect: true })}; compare a observação do estado com a alteração pretendida. A existência do objeto não comprova a alteração nem libera repetir a escrita.`;
  }
  if (record.method === 'DELETE') return 'Resultado incerto. Não repita a exclusão. Verifique o ID no Gerenciador de Anúncios; ausência ou erro de permissão em GET não comprova exclusão.';
  return 'Resultado incerto. Não repita a criação, inclusive com outro request_id. Confira o histórico da conta e obtenha o ID gerado; nomes iguais ou uma listagem vazia não comprovam o resultado. Não há reconciliação automática segura quando a resposta perde o ID.';
}

export function operationReceipt(record: OperationRecord, replayed = false): OperationReceipt {
  return {
    request_id: record.requestId, operation: record.ordinal, tool: record.tool, method: record.method,
    endpoint: record.endpoint, ...(record.entityId ? { entity_id: record.entityId } : {}),
    changed_fields: record.changedFields, status: record.status, created_at: record.createdAt,
    ...(record.completedAt ? { completed_at: record.completedAt } : {}),
    ...(record.response ? { result: record.response } : {}), ...(record.error ? { error: record.error } : {}),
    ...(replayed ? { replayed: true } : {}), ...(nextStep(record) ? { next_step: nextStep(record) } : {}),
  };
}

export class WriteOperationError extends Error {
  constructor(message: string, readonly operation?: OperationReceipt) {
    super(`${message}${operation ? `\nOperação: ${JSON.stringify(operation)}` : ''}`);
    this.name = 'WriteOperationError';
  }
}

function classifyError(error: unknown): OperationRecord['error'] & { uncertain: boolean } {
  const value = error as { name?: string; type?: string; code?: number; httpStatus?: number; isTransient?: boolean } | null;
  const knownTransport = ['TimeoutError', 'NetworkError', 'ParseError', 'HttpError'].includes(value?.type ?? '');
  const type = knownTransport ? value!.type! : value?.name === 'MetaClientError' ? 'GraphError' : 'UnexpectedError';
  const code = typeof value?.code === 'number' && Number.isFinite(value.code) ? value.code : undefined;
  const uncertain = !value || value.name !== 'MetaClientError' || ['TimeoutError', 'NetworkError', 'ParseError'].includes(type) || (type === 'HttpError' && (code === undefined || code >= 500)) || code === 1 || code === 2 || value.isTransient === true || (typeof value.httpStatus === 'number' && value.httpStatus >= 500);
  return { type, ...(code !== undefined ? { code } : {}), uncertain };
}

/** Must be invoked only after account/scope validation and immediately around the Graph write. */
export async function trackMutation<T>(input: { endpoint: string; method: 'POST' | 'DELETE'; params?: Record<string, unknown> }, execute: () => Promise<T>): Promise<T> {
  const context = storage.getStore();
  if (!context) return (await withOperationContext({ tool: 'direct_graph_request' }, () => trackMutation(input, execute))).result;
  const ordinal = ++context.ordinal;
  const params = input.params ?? {};
  const owner = identity();
  const record: OperationRecord = {
    key: digest(`${owner.ownerHash}:${context.requestId}:${ordinal}`), ...owner,
    requestId: context.requestId, ordinal, fingerprint: fingerprint(input.method, input.endpoint, params),
    tool: context.tool, method: input.method, endpoint: input.endpoint,
    ...(!input.endpoint.includes('/') && safeId(input.endpoint) ? { entityId: input.endpoint } : {}),
    changedFields: sanitizeChangedFields(params), status: 'pending', createdAt: new Date().toISOString(),
  };
  const store = selectedStore();
  let reservation: Awaited<ReturnType<OperationStore['reserve']>>;
  try { reservation = await store.reserve(record); }
  catch { throw new WriteOperationError(`Não foi possível persistir o journal de operações; nenhuma escrita foi enviada. request_id: ${context.requestId}.`); }
  if (!reservation.created) {
    const existing = reservation.record;
    const receipt = operationReceipt(existing, true);
    context.operations.push(receipt);
    if (existing.key === record.key && (existing.fingerprint !== record.fingerprint || existing.tool !== record.tool)) throw new WriteOperationError('request_id já usado para outra operação. Nenhuma escrita foi enviada.', receipt);
    if (existing.status === 'succeeded') return structuredClone(existing.response ?? {}) as T;
    throw new WriteOperationError(existing.status === 'failed' ? 'Esta requisição já falhou de forma definitiva. Corrija a causa e use um novo request_id para uma nova tentativa.' : 'Escrita bloqueada: uma operação idêntica está em andamento ou tem resultado incerto. Não tente contornar o bloqueio trocando request_id.', receipt);
  }
  let result: T;
  try {
    result = await execute();
    const response = result && typeof result === 'object' ? result as Record<string, unknown> : {};
    if (response.success === false) throw Object.assign(new Error('A Meta retornou success=false para esta escrita.'), { name: 'MetaClientError', type: 'GraphRejectedResponse', code: 0 });
    let executionOptions = params.execution_options;
    if (typeof executionOptions === 'string') {
      try { executionOptions = JSON.parse(executionOptions); } catch { /* Leave validation to Graph. */ }
    }
    const validationOnly = Array.isArray(executionOptions) && executionOptions.includes('validate_only');
    const creationWithId = input.method === 'POST' && /\/(campaigns|adsets|ads|adcreatives|advideos|customaudiences|adlabels|value_rule_set|budget_schedules)$/.test(input.endpoint);
    if (creationWithId && !validationOnly && !safeId(response.id)) throw Object.assign(new Error('A resposta de criação não contém o ID esperado.'), { name: 'MetaClientError', type: 'ParseError' });
    const requiresSuccess = input.method === 'DELETE' || /^(?:(?:update|pause|activate)_(?:campaign|adset|ad)|(?:update|delete)_(?:value_rule_set|budget_schedule))$/.test(context.tool);
    if (requiresSuccess && response.success !== true) throw Object.assign(new Error('A resposta da alteração não confirma success=true.'), { name: 'MetaClientError', type: 'ParseError' });
  }
  catch (error) {
    const classified = classifyError(error);
    record.status = classified.uncertain ? 'unknown' : 'failed';
    record.error = { type: classified.type, ...(classified.code !== undefined ? { code: classified.code } : {}) };
    record.completedAt = new Date().toISOString();
    const receipt = operationReceipt(record);
    context.operations.push(receipt);
    try { await store.finish(record); }
    catch { throw new WriteOperationError('A Graph recebeu uma tentativa, mas não foi possível salvar seu resultado. A reserva permanece pendente; não repita a escrita.', receipt); }
    if (!classified.uncertain && error instanceof Error) {
      // Keep the existing Graph diagnostics; transport errors need the explicit unknown receipt.
      error.message += `\nOperação: ${JSON.stringify(receipt)}`;
      throw error;
    }
    throw new WriteOperationError('Resultado da escrita na Meta é incerto. A requisição não foi repetida automaticamente.', receipt);
  }
  record.status = 'succeeded';
  record.completedAt = new Date().toISOString();
  record.response = sanitizeWriteResponse(result);
  if (safeId(record.response.id)) record.entityId = record.response.id;
  else for (const key of ['copied_campaign_id', 'copied_adset_id', 'copied_ad_id']) if (safeId(record.response[key])) { record.entityId = record.response[key]; break; }
  try { await store.finish(record); }
  catch {
    // The remote effect succeeded, but durable evidence is still pending. Never resubmit.
    record.status = 'unknown';
    const receipt = operationReceipt(record);
    context.operations.push(receipt);
    throw new WriteOperationError('A Meta respondeu à escrita, mas o recibo não pôde ser persistido. Preserve o ID abaixo e não repita a operação.', receipt);
  }
  context.operations.push(operationReceipt(record));
  return result;
}

export async function getOperationStatus(requestId: string): Promise<{ request_id: string; operations: OperationReceipt[] }> {
  validateRequestId(requestId);
  let records: OperationRecord[];
  try { records = await selectedStore().list(identity().ownerHash, requestId); }
  catch { throw new WriteOperationError('Não foi possível consultar o journal de operações. Não repita uma escrita sem verificar seu resultado.'); }
  return { request_id: requestId, operations: records.map(record => operationReceipt(record)) };
}

/** Read-only observation. It intentionally cannot clear an uncertain write reservation. */
export async function inspectOperation(requestId: string, read: (endpoint: string, params: Record<string, string>) => Promise<unknown>): Promise<{ request_id: string; operations: Array<OperationReceipt & { observation?: Record<string, unknown> }> }> {
  const result = await getOperationStatus(requestId);
  const operations = [];
  for (const operation of result.operations) {
    if (!operation.entity_id || operation.status === 'succeeded' || operation.status === 'failed') { operations.push(operation); continue; }
    const comparable = Object.entries(operation.changed_fields).filter(([, value]) => value !== '[redacted]');
    const fields = ['id', ...comparable.map(([key]) => key)];
    try {
      const response = await read(operation.entity_id, { fields: fields.join(',') });
      const current = response && typeof response === 'object' ? response as Record<string, unknown> : {};
      const matchingFields = comparable.filter(([key, value]) => String(current[key]) === String(value)).map(([key]) => key);
      operations.push({ ...operation, observation: {
        identity_matches: current.id === operation.entity_id,
        matching_fields: matchingFields,
        compared_fields: comparable.map(([key]) => key),
        all_intended_fields_match: operation.method === 'POST' && current.id === operation.entity_id && comparable.length > 0 && comparable.length === Object.keys(operation.changed_fields).length && matchingFields.length === comparable.length,
        status_unchanged: 'unknown',
        note: 'Leitura do estado atual; não prova qual requisição produziu o estado e não libera automaticamente outra escrita.',
      } });
    } catch {
      operations.push({ ...operation, observation: { read_failed: true, note: 'Falha de leitura ou ausência de acesso não prova exclusão nem falha da escrita anterior.' } });
    }
  }
  return { request_id: requestId, operations };
}
