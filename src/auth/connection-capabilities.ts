import type { AuthContext } from '../utils/auth-context.js';

/** Only permission names relevant to this MCP are returned; arbitrary provider fields stay private. */
export const DIAGNOSTIC_PERMISSIONS = new Set([
  'ads_read', 'ads_management', 'business_management', 'pages_show_list',
  'pages_read_engagement', 'pages_manage_ads', 'instagram_basic',
  'instagram_manage_insights', 'instagram_branded_content_ads_brand',
  'instagram_branded_content_brand', 'instagram_branded_content_creator',
]);

export interface PermissionObservation {
  permission: string;
  status: 'granted' | 'declined' | 'expired';
}

export interface ConnectionFailure {
  code?: number;
  reason: string;
  action: string;
}

/** Provider error text may contain credentials. Explain known codes without echoing that text. */
export function describeConnectionFailure(error: unknown): ConnectionFailure {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'number'
    ? error.code : undefined;
  const detail = code === 190
    ? { reason: 'A Meta recusou a credencial desta conexão.', action: 'O token pode ter expirado, sido revogado ou invalidado. Atualize a credencial pela tela de conexão; não envie tokens no chat.' }
    : code === 10 || code === 200
      ? { reason: 'A Meta negou esta consulta por autorização.', action: 'Confira as permissões do aplicativo e os ativos atribuídos ao usuário ou usuário do sistema na Meta. Esse erro não comprova que o token expirou.' }
      : [4, 17, 32, 613, 80004].includes(code ?? -1)
        ? { reason: 'A Meta limitou temporariamente as consultas.', action: 'Aguarde a liberação do limite antes de fazer novas consultas.' }
        : { reason: 'Não foi possível verificar as permissões na Meta.', action: 'Tente o diagnóstico novamente. Se a falha continuar, confira a conexão e a resposta da Meta pelos canais locais de diagnóstico.' };
  return { ...(code !== undefined ? { code } : {}), ...detail };
}

interface CapabilityRule {
  family: 'ads' | 'pages' | 'instagram';
  operation: string;
  tools: string[];
  write: boolean;
  /** Each group is required; any permission within a group satisfies it. */
  permission_groups: string[][];
}

const RULES: CapabilityRule[] = [
  { family: 'ads', operation: 'read', tools: ['discover_ad_accounts', 'list_campaigns', 'list_ads', 'get_account_insights'], write: false, permission_groups: [['ads_read', 'ads_management']] },
  { family: 'ads', operation: 'manage', tools: ['create_campaign', 'create_adset', 'create_ad', 'activate_ad'], write: true, permission_groups: [['ads_management']] },
  { family: 'pages', operation: 'discover', tools: ['list_facebook_pages'], write: false, permission_groups: [['pages_show_list']] },
  { family: 'instagram', operation: 'read_linked_account', tools: ['get_instagram_account'], write: false, permission_groups: [['instagram_basic'], ['pages_read_engagement']] },
];

/** Scope evidence is a prerequisite check, never proof of asset access, eligibility or rollout. */
export function connectionCapabilities(context: AuthContext | null, permissions: PermissionObservation[], complete: boolean) {
  const granted = new Set(permissions.filter(item => item.status === 'granted').map(item => item.permission));
  const local = context?.permissions ?? 'readwrite';
  const noAccounts = context?.allowedAccountIds?.length === 0;
  return RULES.map(rule => {
    const missing = rule.permission_groups.filter(group => !group.some(permission => granted.has(permission)));
    const locallyAllowed = !noAccounts && (!rule.write || local === 'readwrite');
    const status = !locallyAllowed ? 'blocked_locally' : missing.length === 0 ? 'scope_present' : complete ? 'missing_scope' : 'unknown';
    const action = !locallyAllowed
      ? noAccounts ? 'Selecione ao menos uma conta na conexão.' : 'Para gerenciar anúncios, habilite acesso de gerenciamento na conexão. A leitura continua autorizada.'
      : status === 'scope_present'
        ? 'Valide a operação no ativo autorizado. Permissões presentes não comprovam acesso ao ativo, elegibilidade ou liberação do recurso pela Meta.'
        : status === 'missing_scope'
          ? `Confira as permissões Meta exigidas para esta operação: ${missing.map(group => group.join(' ou ')).join('; ')}. Se precisar da operação, atualize a credencial localmente com essas permissões e as atribuições dos ativos.`
          : 'Repita o diagnóstico para verificar as permissões. Sem uma resposta completa da Meta, não é possível concluir quais permissões estão ausentes.';
    return {
      family: rule.family, operation: rule.operation, tools: rule.tools, status,
      local_authorized: locallyAllowed, required_permission_groups: rule.permission_groups,
      ...(complete ? { missing_permission_groups: missing } : {}),
      asset_access: 'not_tested', meta_rollout: 'not_tested', action,
    };
  });
}
