import { z } from 'zod';

export const paginationFields = {
  pagination_mode: z.enum(['all', 'page']).optional().describe('all (padrão): percorre páginas automaticamente. page: retorna uma página. Confira sempre pagination.complete antes de concluir totais.'),
  max_pages: z.number().int().min(1).max(50).optional().describe('Máximo de páginas por consulta (padrão 10, máximo 50). Ao atingir o limite, o resultado fica explicitamente incompleto.'),
  limit: z.number().int().min(1).max(1000).optional().describe('Quantidade solicitada por página (padrão 100). Não representa o total de objetos existentes.'),
  after: z.string().min(1).optional().describe('Cursor de continuação retornado pelo MCP. Use next.tool com next.arguments para continuar pela ferramenta de leitura, preservando filtros e período.'),
};

export const collectionTools = new Set([
  'discover_ad_accounts', 'list_facebook_pages', 'list_campaigns', 'list_adsets', 'list_ads',
  'list_campaign_ads', 'list_creatives', 'get_account_insights', 'get_campaign_insights',
  'get_adset_insights', 'get_ad_insights', 'get_attribution_comparison', 'get_performance_summary',
  'list_campaign_ads_with_insights', 'list_custom_audiences', 'list_pixels', 'list_value_rule_sets',
  'list_ad_labels', 'get_budget_schedules', 'search_geolocation', 'diagnose_connection',
]);

/** Location search is a ranked selection aid, not a stable inventory to exhaust. */
export function usesAutomaticPagination(tool: string): boolean {
  return collectionTools.has(tool) && tool !== 'search_geolocation';
}

export interface ContinuationCall { tool: string; arguments: Record<string, unknown> }
export interface Continuation {
  endpoint: string;
  params: Record<string, string>;
  tool?: string;
  arguments?: Record<string, unknown>;
}

/** Translate only known read routes; the dispatcher validates the destination schema. */
export function continuationCall(name: string, input: Record<string, unknown>, next: Continuation): ContinuationCall | undefined {
  if (!next.params.after) return undefined;
  const pagination = {
    pagination_mode: input.pagination_mode ?? (usesAutomaticPagination(name) ? 'all' : 'page'),
    max_pages: input.max_pages ?? 10,
  };
  if (name === 'execute_api' && input.method === 'GET') {
    return { tool: name, arguments: {
      ...(input.account_id !== undefined ? { account_id: input.account_id } : {}),
      ...pagination, method: 'GET', endpoint: next.endpoint, params: { ...next.params },
    } };
  }
  if (!collectionTools.has(name) || name === 'diagnose_connection') return undefined;

  const controls = { ...pagination, limit: Number(next.params.limit), after: next.params.after };
  if (name === 'list_campaign_ads_with_insights') {
    if (next.endpoint === `${input.campaign_id}/ads`) {
      return { tool: 'list_campaign_ads', arguments: {
        campaign_id: input.campaign_id, fields: next.params.fields.split(','), ...controls,
      } };
    }
    if (next.endpoint === `${input.campaign_id}/insights`) {
      const fields = [...new Set(['ad_id', ...(input.fields as string[])])];
      // These fields came from the validated report input, including its defaults.
      if (fields.join(',') !== next.params.fields) return undefined;
      const args: Record<string, unknown> = { campaign_id: input.campaign_id, fields, level: 'ad', ...controls };
      if (next.params.date_preset !== undefined) args.date_preset = next.params.date_preset;
      for (const key of ['time_range', 'action_attribution_windows', 'use_unified_attribution_setting']) {
        if (next.params[key] !== undefined) args[key] = JSON.parse(next.params[key]);
      }
      return { tool: 'get_campaign_insights', arguments: args };
    }
    return undefined;
  }

  const { request_id, ...original } = input;
  const hasFixedFields = name === 'get_attribution_comparison' || name === 'get_performance_summary';
  return { tool: name, arguments: {
    ...original,
    ...(!hasFixedFields && input.fields === undefined && next.params.fields !== undefined ? { fields: next.params.fields.split(',') } : {}),
    ...controls,
  } };
}
export interface CollectionProgress {
  endpoint: string;
  complete: boolean;
  pages: number;
  returned_count: number;
  started_after?: string;
  reason?: 'page_requested' | 'page_limit' | 'time_limit' | 'cursor_missing' | 'cursor_repeated' | 'page_error';
  next?: Continuation;
  error?: { code?: number; type?: string; message: string; errorSubcode?: number; httpStatus?: number; isTransient?: boolean };
}

export interface PaginationOptions {
  mode?: 'all' | 'page';
  maxPages?: number;
  budgetMs?: number;
  /** Applied to the first tool read only, never to ownership probes or nested queries. */
  initialQuery?: { limit?: number; after?: string };
}
