import { z } from 'zod';
import type { MetaClient } from '../meta-client.js';
import { getAuthContext } from '../utils/auth-context.js';
import { connectionCapabilities, describeConnectionFailure, DIAGNOSTIC_PERMISSIONS, type ConnectionFailure, type PermissionObservation } from '../auth/connection-capabilities.js';

export const diagnoseConnectionSchema = z.object({}).strict();
export const diagnoseConnectionDescription = 'Diagnostica em leitura as permissões da conexão para Ads, Pages e Instagram, o escopo local e as contas autorizadas. Distingue permissões ausentes de verificação inconclusiva. Não valida acesso efetivo a ativos, rollout ou escrita e nunca retorna tokens.';

interface PermissionsPage {
  data?: Array<{ permission?: unknown; status?: unknown }>;
}

export async function handleDiagnoseConnection(client: MetaClient, _args: z.infer<typeof diagnoseConnectionSchema>) {
  const context = getAuthContext();
  const observations = new Map<string, PermissionObservation>();
  let complete = false;
  let checkedPages = 0;
  let failure: ConnectionFailure | undefined;
  const firstCollection = client.collections.length;
  // Reuse the client's bounded, authorized collection reader. Partial evidence remains explicit.
  try {
    const result = await client.get<PermissionsPage>('me/permissions', { fields: 'permission,status', limit: '100' });
    const progress = client.collections.slice(firstCollection).find(item => item.endpoint === 'me/permissions');
    checkedPages = progress?.pages ?? 0;
    if (!Array.isArray(result.data)) throw new Error('Invalid permissions response');
    for (const item of result.data) {
      if (!item || typeof item.permission !== 'string' || typeof item.status !== 'string') throw new Error('Invalid permission entry');
      if (!DIAGNOSTIC_PERMISSIONS.has(item.permission)) continue;
      if (item.status !== 'granted' && item.status !== 'declined' && item.status !== 'expired') throw new Error('Unknown permission status');
      observations.set(item.permission, { permission: item.permission, status: item.status });
    }
    // A cursor supplied by the caller skips earlier scopes and cannot prove their absence.
    complete = progress?.complete === true && !progress.started_after;
    if (!complete) failure = progress?.error ? describeConnectionFailure(progress.error) : {
      reason: 'Não foi possível concluir a lista de permissões desde a primeira página.',
      action: 'Execute o diagnóstico novamente desde o início, com paginação automática. Permissões não observadas permanecem desconhecidas até uma consulta completa.',
    };
  } catch (error) {
    failure = describeConnectionFailure(error);
  }
  // This report has its own safe completeness/error contract; do not duplicate raw permission pages.
  for (let index = client.nextPages.length - 1; index >= 0; index--) {
    if (client.nextPages[index].endpoint === 'me/permissions') client.nextPages.splice(index, 1);
  }
  for (let index = client.collections.length - 1; index >= firstCollection; index--) {
    if (client.collections[index].endpoint === 'me/permissions') client.collections.splice(index, 1);
  }
  const permissions = [...observations.values()].sort((a, b) => a.permission.localeCompare(b.permission));
  const report = {
    local_authorization: {
      permissions: context?.permissions ?? 'readwrite',
      account_scope: context?.allowedAccountIds === undefined ? 'token_accounts' : 'selected_accounts',
      allowed_account_ids: context?.allowedAccountIds ?? null,
      accounts_access: 'not_tested',
    },
    meta_permissions: {
      status: complete ? 'verified' : checkedPages ? 'partial' : 'unavailable',
      source: 'me/permissions', complete, checked_pages: checkedPages, permissions,
      ...(failure ? { failure } : {}),
    },
    capabilities: connectionCapabilities(context, permissions, complete),
    limitations: [
      'Contas listadas são as autorizadas localmente; acesso atual e existência de campanhas não foram consultados.',
      'Permissões são pré-requisitos. Esta leitura não executa operações Ads, não valida escrita e não comprova atribuições, elegibilidade ou rollout.',
      'Os pré-requisitos de Instagram se referem ao fluxo via Página Facebook usado por get_instagram_account; outros fluxos e campos podem ter exigências próprias.',
    ],
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}
