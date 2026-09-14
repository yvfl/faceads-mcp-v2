/**
 * Cliente para a API da Meta (Facebook Marketing API)
 *
 * Abstrai chamadas HTTP para a Graph API da Meta.
 */

import { getMetaConfig, getConfigurationError, MetaConfig } from './utils/config.js';
import { getAuthContext } from './utils/auth-context.js';
import { authorizeGraphRequest, scopeGraphResponse } from './auth/account-authorization.js';
import { downloadPublicImage } from './utils/safe-download.js';
import type { PaginationOptions, CollectionProgress } from './pagination.js';
import { trackMutation } from './operations/journal.js';

const META_GRAPH_URL = 'https://graph.facebook.com';

export function redactMetaSecrets(value: string): string {
  let text = value.replace(/((?:access_token|refresh_token|appsecret_proof)[=\s:"']+)[^\s&"'<>]+/gi, '$1[redacted]');
  const secret = getAuthContext()?.accessToken ?? getMetaConfig()?.accessToken;
  if (secret) text = text.split(secret).join('[redacted]').split(encodeURIComponent(secret)).join('[redacted]');
  return text;
}
function safeErrorField(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return redactMetaSecrets(typeof value === 'string' ? value : JSON.stringify(value));
}


/**
 * Tipos de resposta da API
 */
export interface MetaApiResponse<T = unknown> {
  data?: T;
  error?: MetaApiError;
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_data?: string;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
  is_transient?: boolean;
}

/**
 * Tipos para objetos da API
 */
export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  [key: string]: unknown;
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: object;
  [key: string]: unknown;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: object;
  [key: string]: unknown;
}

export interface AdCreative {
  id: string;
  name: string;
  object_story_spec?: object;
  [key: string]: unknown;
}

export interface InsightAction {
  action_type?: string;
  value?: string;
  [key: string]: unknown;
}

export interface InsightsParams {
  fields?: string[];
  date_preset?: string;
  time_range?: { since: string; until: string };
  level?: 'account' | 'campaign' | 'adset' | 'ad';
  breakdowns?: string[];
  action_breakdowns?: string[];
  time_increment?: 'all_days' | 'monthly' | number;
  filtering?: Array<{ field: string; operator: string; value: unknown }>;
  sort?: string[];
  limit?: number;
  after?: string;
  action_attribution_windows?: string[];
  use_unified_attribution_setting?: boolean;
}

export interface InsightsResult {
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: InsightAction[];
  cost_per_action_type?: InsightAction[];
  date_start?: string;
  date_stop?: string;
  [key: string]: unknown;
}

export interface CustomAudience {
  id: string;
  name: string;
  subtype: string;
  approximate_count?: number;
  [key: string]: unknown;
}

/**
 * Cliente para a Meta Marketing API
 */
export class MetaClient {
  private config: MetaConfig;
  private readonly timeoutMs: number;
  private readonly pagination: PaginationOptions;
  private firstRead = true;
  readonly collections: CollectionProgress[] = [];
  readonly nextPages: Array<{ endpoint: string; params: Record<string, string> }> = [];

  /**
   * Cria MetaClient com resolução de credenciais:
   * 1. Auth context (HTTP multi-tenant, via AsyncLocalStorage)
   * 2. Env vars / .env (modo stdio)
   */
  constructor(options: { timeoutMs?: number; pagination?: PaginationOptions } = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.pagination = options.pagination ?? { mode: 'page' };
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Timeout HTTP inválido');
    // Prioridade 1: Auth context do request HTTP
    const authCtx = getAuthContext();
    if (authCtx) {
      this.config = {
        accessToken: authCtx.accessToken,
        apiVersion: authCtx.apiVersion || 'v26.0',
      };
      return;
    }

    // Prioridade 2: Env vars (modo stdio)
    const config = getMetaConfig();
    if (!config) {
      throw new Error(getConfigurationError());
    }
    this.config = config;
  }

  /**
   * Verifica se o cliente está configurado (via auth context ou env vars)
   */
  static isConfigured(): boolean {
    return getAuthContext() !== null || getMetaConfig() !== null;
  }

  /**
   * Retorna mensagem de erro de configuração
   */
  static getConfigError(): string {
    return getConfigurationError();
  }

  /**
   * URL base da API
   */
  private get baseUrl(): string {
    return `${META_GRAPH_URL}/${this.config.apiVersion}`;
  }

  get apiVersion(): string { return this.config.apiVersion; }

  /** Shared transport, including authorization probes. No retries for writes. */
  private async requestRaw<T>(endpoint: string, method: string, params: Record<string, unknown> = {}, timeoutMs = this.timeoutMs): Promise<T> {
    // No URLs, traversal, query injection or Graph method/token overrides.
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(endpoint)) {
      throw new Error('Endpoint inválido. Informe somente o caminho relativo da Graph API.');
    }
    for (const key of Object.keys(params)) {
      if (['access_token', 'method', 'batch', 'appsecret_proof'].includes(key.toLowerCase())) {
        throw new Error(`Parâmetro reservado não permitido: ${key}`);
      }
    }
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const encoded = new URLSearchParams({ access_token: this.config.accessToken });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) encoded.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init: RequestInit = { method, signal: controller.signal, redirect: 'error' };
      if (method === 'POST') {
        init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        init.body = encoded.toString();
      } else {
        url.search = encoded.toString();
      }
      let response: Response;
      try { response = await fetch(url.toString(), init); }
      catch (error) {
        throw new MetaClientError({ message: controller.signal.aborted ? `Timeout da Graph API após ${timeoutMs}ms` : `Erro de rede: ${error instanceof Error ? error.message : String(error)}`, type: controller.signal.aborted ? 'TimeoutError' : 'NetworkError', code: -1 });
      }
      let data: MetaApiResponse<T>;
      try { data = await response.json() as MetaApiResponse<T>; }
      catch (error) {
        throw new MetaClientError({ message: controller.signal.aborted ? `Timeout da Graph API após ${timeoutMs}ms` : `Erro ao processar resposta (HTTP ${response.status})`, type: controller.signal.aborted ? 'TimeoutError' : 'ParseError', code: response.status }, response.status);
      }
      if (data && typeof data === 'object' && data.error) throw new MetaClientError(data.error, response.status);
      if (!response.ok) throw new MetaClientError({ message: `Graph API HTTP ${response.status}: ${response.statusText || 'requisição recusada'}`, type: 'HttpError', code: response.status }, response.status);
      if (data === null || typeof data !== 'object') throw new MetaClientError({ message: 'Resposta JSON inesperada da Graph API', type: 'ParseError', code: response.status }, response.status);
      return data as T;
    } finally { clearTimeout(timer); }
  }

  private async authorize(endpoint: string, method: string, params: Record<string, unknown>, budgetScheduleParent?: string): Promise<void> {
    // Defense in depth: Graph can execute writes via a GET method override.
    if (Object.keys(params).some((key) => ['method', 'access_token', 'batch', 'appsecret_proof'].includes(key.toLowerCase()))) throw new Error('Parâmetro reservado não permitido');
    if (getAuthContext()?.permissions === 'read' && method !== 'GET') throw new Error('Permission denied: write requires readwrite access.');
    await authorizeGraphRequest(endpoint, method, params, (path, query) => this.requestRaw(path, 'GET', query), budgetScheduleParent);
  }

  async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const query = { ...params };
    if (this.firstRead) {
      const initial = this.pagination.initialQuery;
      if (initial?.limit !== undefined) query.limit = String(initial.limit);
      if (initial?.after !== undefined) query.after = initial.after;
      this.firstRead = false;
    }
    const mode = this.pagination.mode ?? 'page';
    const maxPages = this.pagination.maxPages ?? 10;
    const deadline = Date.now() + (this.pagination.budgetMs ?? 25_000);
    const seen = new Set<string>(query.after ? [query.after] : []);
    let pageQuery = query;
    let combined: T | undefined;
    let progress: CollectionProgress | undefined;
    for (;;) {
      try {
        await this.authorize(endpoint, 'GET', pageQuery);
        if (progress && Date.now() >= deadline) { progress.reason = 'time_limit'; break; }
        const response = await this.requestRaw<T>(endpoint, 'GET', pageQuery, Math.min(this.timeoutMs, Math.max(1, deadline - Date.now())));
        const paging = (response as MetaApiResponse<T>).paging;
        const scoped = await scopeGraphResponse(endpoint, response, (path, fields) => this.requestRaw(path, 'GET', fields));
        const rows = (scoped as { data?: unknown }).data;
        if (!Array.isArray(rows)) {
          if (progress) throw new MetaClientError({ message: 'A próxima página não retornou um array data válido.', type: 'ParseError', code: 200 });
          return scoped;
        }
        if (!progress) {
          progress = { endpoint, complete: false, pages: 0, returned_count: 0, ...(query.after ? { started_after: query.after } : {}) };
          this.collections.push(progress);
          combined = { ...scoped, data: [] };
        }
        (combined as { data: unknown[] }).data.push(...rows);
        progress.pages++;
        progress.returned_count += rows.length;
        // Never follow provider URLs. Only reuse the authorized endpoint/query and opaque cursor.
        if (!paging?.next) { progress.complete = true; delete progress.next; break; }
        const after = paging.cursors?.after;
        if (!after) { progress.reason = 'cursor_missing'; delete progress.next; break; }
        if (seen.has(after)) { progress.reason = 'cursor_repeated'; delete progress.next; break; }
        seen.add(after);
        progress.next = { endpoint, params: { ...query, after } };
        if (mode === 'page') { progress.reason = 'page_requested'; break; }
        if (progress.pages >= maxPages) { progress.reason = 'page_limit'; break; }
        if (Date.now() >= deadline) { progress.reason = 'time_limit'; break; }
        pageQuery = progress.next.params;
      } catch (error) {
        if (!progress) throw error;
        progress.reason = 'page_error';
        progress.error = {
          message: redactMetaSecrets(error instanceof Error ? error.message : 'Falha ao buscar próxima página'),
          ...(error instanceof MetaClientError ? {
            code: error.code, type: error.type, errorSubcode: error.errorSubcode,
            httpStatus: error.httpStatus, isTransient: error.isTransient,
          } : {}),
        };
        break;
      }
    }
    if (progress?.next) this.nextPages.push(progress.next);
    // Retain only safe final-page cursors; stale first-page URLs must never escape.
    delete (combined as MetaApiResponse<unknown>).paging;
    return combined!;
  }

  async post<T>(endpoint: string, body: Record<string, unknown> = {}, budgetScheduleParent?: string): Promise<T> {
    if (/^act_\d+\/(campaigns|adsets|ads)$/.test(endpoint)) {
      if (body.status !== undefined && body.status !== 'PAUSED') throw new Error('Criação exige status PAUSED. Ative o objeto em uma operação separada após revisão.');
      body = { ...body, status: 'PAUSED' };
    }
    if (/^\d+\/copies$/.test(endpoint)) {
      if (body.status_option !== undefined && body.status_option !== 'PAUSED') throw new Error('Cópias exigem status_option PAUSED. Ative os objetos em uma operação separada.');
      if (body.status !== undefined && body.status !== 'PAUSED') throw new Error('Cópias não podem criar objetos ativos.');
      body = { ...body, status_option: 'PAUSED' };
    }
    await this.authorize(endpoint, 'POST', body, budgetScheduleParent);
    return trackMutation({ endpoint, method: 'POST', params: body }, () => this.requestRaw<T>(endpoint, 'POST', body));
  }

  async delete(endpoint: string, budgetScheduleParent?: string): Promise<{ success: boolean }> {
    await this.authorize(endpoint, 'DELETE', {}, budgetScheduleParent);
    return trackMutation({ endpoint, method: 'DELETE' }, () => this.requestRaw(endpoint, 'DELETE'));
  }

  private unixTime(value: string): number {
    const millis = Date.parse(value);
    if (!Number.isFinite(millis)) throw new Error('Data inválida no agendamento.');
    return Math.floor(millis / 1000);
  }

  // ==================== DESCOBERTA DE RECURSOS ====================

  /**
   * Descobre contas de anúncios do usuário
   * Deve ser a primeira chamada para obter o ID real da conta
   */
  async discoverAdAccounts(
    fields: string[] = ['id', 'name', 'account_status', 'currency', 'timezone_name']
  ): Promise<{ data: Array<{ id: string; name: string; account_status: number; [key: string]: unknown }> }> {
    const allowed = getAuthContext()?.allowedAccountIds;
    const result = await this.get<{ data: Array<{ id: string; name: string; account_status: number; [key: string]: unknown }> }>('me/adaccounts', { fields: [...new Set(['id', ...fields])].join(',') });
    if (allowed !== undefined) result.data = result.data.filter((account) => allowed.includes(account.id.startsWith('act_') ? account.id : `act_${account.id}`));
    return result;
  }

  /**
   * Lista páginas do Facebook do usuário
   * Necessário para obter page_id para criar criativos
   */
  async listFacebookPages(
    fields: string[] = ['id', 'name', 'category']
  ): Promise<{ data: Array<{ id: string; name: string; access_token?: string; [key: string]: unknown }> }> {
    return this.get('me/accounts', { fields: fields.join(',') });
  }

  /**
   * Obtém conta do Instagram vinculada a uma página
   * Retorna o ID correto do Instagram (formato novo) para usar em criativos
   */
  async getInstagramAccount(
    pageId: string,
    fields: string[] = ['instagram_business_account', 'connected_instagram_account']
  ): Promise<{
    id: string;
    instagram_business_account?: { id: string };
    connected_instagram_account?: { id: string };
  }> {
    return this.get(pageId, { fields: fields.join(',') });
  }

  // ==================== CAMPANHAS ====================

  /**
   * Lista campanhas da conta
   */
  async listCampaigns(
    accountId: string,
    fields: string[] = ['id', 'name', 'status', 'objective', 'created_time'],
    effectiveStatus?: string[]
  ): Promise<{ data: Campaign[] }> {
    const params: Record<string, string> = {
      fields: fields.join(','),
    };

    // Adiciona filtro por effective_status se especificado
    if (effectiveStatus && effectiveStatus.length > 0) {
      params.filtering = JSON.stringify([{
        field: 'effective_status',
        operator: 'IN',
        value: effectiveStatus,
      }]);
    }

    return this.get<{ data: Campaign[] }>(`${accountId}/campaigns`, params);
  }

  /**
   * Obtém uma campanha específica
   * Inclui campos de orçamento por default para verificar se é CBO
   */
  async getCampaign(
    campaignId: string,
    fields: string[] = ['id', 'name', 'status', 'objective', 'daily_budget', 'lifetime_budget', 'budget_remaining', 'created_time', 'updated_time', 'spend_cap', 'bid_strategy', 'buying_type', 'effective_status', 'special_ad_categories', 'is_adset_budget_sharing_enabled', 'issues_info', 'start_time', 'stop_time']
  ): Promise<Campaign> {
    return this.get<Campaign>(campaignId, { fields: fields.join(',') });
  }

  /**
   * Cria uma nova campanha
   */
  async createCampaign(accountId: string, params: {
    name: string;
    objective: string;
    status?: string;
    special_ad_categories?: string[];
    daily_budget?: number;
    lifetime_budget?: number;
    spend_cap?: number;
    buying_type?: string;
    bid_strategy?: string;
    is_adset_budget_sharing_enabled?: boolean;
    start_time?: string;
    stop_time?: string;
    is_skadnetwork_attribution?: boolean;
    promoted_object?: object;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/campaigns`, {
      ...params,
      special_ad_categories: params.special_ad_categories || [],
      // Campo obrigatório a partir da v24.0 para campanhas sem CBO
      is_adset_budget_sharing_enabled: params.is_adset_budget_sharing_enabled ?? false,
    });
  }

  /**
   * Atualiza uma campanha
   */
  async updateCampaign(
    campaignId: string,
    params: {
      name?: string;
      status?: string;
      daily_budget?: number;
      lifetime_budget?: number;
      spend_cap?: number;
      bid_strategy?: string;
      is_adset_budget_sharing_enabled?: boolean;
      special_ad_categories?: string[];
      start_time?: string;
      stop_time?: string;
    }
  ): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(campaignId, params);
  }

  // ==================== AD SETS ====================

  /**
   * Lista ad sets da conta
   */
  async listAdSets(
    accountId: string,
    fields: string[] = ['id', 'name', 'status', 'campaign_id', 'daily_budget'],
    effectiveStatus?: string[]
  ): Promise<{ data: AdSet[] }> {
    const params: Record<string, string> = {
      fields: fields.join(','),
    };

    // Adiciona filtro por effective_status se especificado
    if (effectiveStatus && effectiveStatus.length > 0) {
      params.filtering = JSON.stringify([{
        field: 'effective_status',
        operator: 'IN',
        value: effectiveStatus,
      }]);
    }

    return this.get<{ data: AdSet[] }>(`${accountId}/adsets`, params);
  }

  /**
   * Obtém um ad set específico
   */
  async getAdSet(
    adsetId: string,
    fields: string[] = ['id', 'name', 'status', 'campaign_id', 'daily_budget', 'targeting', 'is_incremental_attribution_enabled', 'attribution_spec', 'effective_status', 'issues_info', 'created_time', 'updated_time', 'lifetime_budget', 'destination_type', 'learning_stage_info', 'promoted_object', 'optimization_goal', 'billing_event', 'bid_strategy']
  ): Promise<AdSet> {
    return this.get<AdSet>(adsetId, { fields: fields.join(',') });
  }

  /**
   * Cria um novo ad set
   */
  async createAdSet(accountId: string, params: {
    name: string;
    campaign_id: string;
    billing_event: string;
    optimization_goal: string;
    bid_amount?: number;
    bid_strategy?: string;
    bid_constraints?: object;
    daily_budget?: number;
    lifetime_budget?: number;
    targeting: object;
    status?: string;
    start_time?: string;
    end_time?: string;
    promoted_object?: {
      pixel_id?: string;
      custom_event_type?: string;
      application_id?: string;
      object_store_url?: string;
      page_id?: string;
      event_id?: string;
      custom_conversion_id?: string;
      offline_conversion_data_set_id?: string;
      product_set_id?: string;
    };
    attribution_spec?: Array<{
      event_type: string;
      window_days: number;
    }>;
    is_incremental_attribution_enabled?: boolean;
    excluded_custom_audiences?: Array<{ id: string }>;
    destination_type?: string;
    is_dynamic_creative?: boolean;
    adset_schedule?: Array<{
      start_minute: number;
      end_minute: number;
      days: number[];
      timezone_type?: string;
    }>;
    pacing_type?: string[];
    frequency_control_specs?: Array<{
      event: string;
      interval_days: number;
      max_frequency: number;
    }>;
    daily_min_spend_target?: number;
    daily_spend_cap?: number;
    value_rule_set_id?: string;
    value_rules_applied?: boolean;
    dsa_beneficiary?: string;
    dsa_payor?: string;
    adlabels?: Array<{ id: string }>;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/adsets`, {
      ...params,
      // Campo obrigatório a partir da v24.0
      bid_strategy: params.bid_strategy ?? 'LOWEST_COST_WITHOUT_CAP',
    });
  }

  /**
   * Atualiza um ad set
   */
  async updateAdSet(
    adsetId: string,
    params: {
      name?: string;
      status?: string;
      daily_budget?: number;
      lifetime_budget?: number;
      targeting?: object;
      bid_strategy?: string;
      bid_amount?: number;
      bid_constraints?: object;
      start_time?: string;
      end_time?: string;
      optimization_goal?: string;
      promoted_object?: object;
      attribution_spec?: Array<{ event_type: string; window_days: number }>;
      value_rule_set_id?: string;
      value_rules_applied?: boolean;
      dsa_beneficiary?: string;
      dsa_payor?: string;
      adlabels?: Array<{ id: string }>;
    }
  ): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(adsetId, params);
  }

  // ==================== ADS ====================

  /**
   * Lista anúncios da conta
   */
  async listAds(
    accountId: string,
    fields: string[] = ['id', 'name', 'status', 'adset_id', 'effective_status'],
    options: { effective_status?: string[]; updated_since?: number } = {},
  ): Promise<{ data: Ad[] }> {
    return this.get<{ data: Ad[] }>(`${accountId}/ads`, {
      fields: fields.join(','),
      ...(options.effective_status !== undefined ? { effective_status: JSON.stringify(options.effective_status) } : {}),
      ...(options.updated_since !== undefined ? { updated_since: String(options.updated_since) } : {}),
    });
  }

  /**
   * Lista anúncios de uma campanha específica
   */
  async listCampaignAds(
    campaignId: string,
    fields: string[] = ['id', 'name', 'status', 'effective_status', 'adset_id', 'creative']
  ): Promise<{ data: Ad[] }> {
    return this.get<{ data: Ad[] }>(`${campaignId}/ads`, {
      fields: fields.join(','),
    });
  }

  /**
   * Obtém um anúncio específico
   */
  async getAd(
    adId: string,
    fields: string[] = ['id', 'name', 'status', 'effective_status', 'adset_id', 'creative', 'created_time', 'tracking_specs', 'conversion_domain', 'updated_time', 'ad_review_feedback', 'issues_info']
  ): Promise<Ad> {
    return this.get<Ad>(adId, { fields: fields.join(',') });
  }

  /**
   * Cria um novo anúncio
   */
  async createAd(accountId: string, params: {
    name: string;
    adset_id: string;
    creative: { creative_id: string } | object;
    status?: string;
    tracking_specs?: Array<Record<string, unknown>>;
    ad_schedule_start_time?: string;
    ad_schedule_end_time?: string;
    conversion_domain?: string;
    adlabels?: Array<{ id: string }>;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/ads`, params);
  }

  /**
   * Atualiza um anúncio
   */
  async updateAd(
    adId: string,
    params: {
      name?: string;
      status?: string;
      creative?: { creative_id: string };
      tracking_specs?: Array<Record<string, unknown>>;
      conversion_domain?: string;
      adlabels?: Array<{ id: string }>;
    }
  ): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(adId, params);
  }

  // ==================== CRIATIVOS ====================

  /**
   * Lista criativos da conta
   */
  async listCreatives(accountId: string, fields: string[] = ['id', 'name', 'object_story_spec', 'thumbnail_url']): Promise<{ data: AdCreative[] }> {
    return this.get<{ data: AdCreative[] }>(`${accountId}/adcreatives`, {
      fields: fields.join(','),
    });
  }

  /**
   * Obtém um criativo específico
   */
  async getCreative(
    creativeId: string,
    fields: string[] = ['id', 'name', 'object_story_spec', 'thumbnail_url', 'effective_object_story_id', 'url_tags', 'image_hash', 'image_url', 'object_story_id', 'body', 'title', 'link_url']
  ): Promise<AdCreative> {
    return this.get<AdCreative>(creativeId, { fields: fields.join(',') });
  }

  /**
   * Cria um novo criativo
   */
  async createCreative(accountId: string, params: {
    name: string;
    object_story_spec?: object;
    object_story_id?: string;
    image_hash?: string;
    image_url?: string;
    url_tags?: string;
    asset_feed_spec?: object;
    degrees_of_freedom_spec?: object;
    creative_features_spec?: object;
    platform_customizations?: object;
    // v26.0: identidade obrigatória em anúncios no status do WhatsApp
    wamo_whatsapp_identity_spec?: object;
    // Partnership ads
    object_id?: string;
    source_instagram_media_id?: string;
    branded_content?: { instagram_boost_post_access_token?: string; facebook_boost_post_access_token?: string; ad_format?: number };
    facebook_branded_content?: object;
    instagram_branded_content?: object;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/adcreatives`, params);
  }

  // ==================== UPLOAD DE IMAGEM ====================

  /**
   * Faz upload de uma imagem via URL para a conta de anúncios.
   * Fluxo: download da URL → conversão para base64 → POST com parâmetro 'bytes'.
   * A API da Meta aceita APENAS 'bytes' (base64) ou 'copy_from', NÃO aceita URL direta.
   */
  async uploadImageFromUrl(accountId: string, imageUrl: string): Promise<unknown> {
    // Validate the grant before downloading any bytes, then use the public-only downloader.
    await this.authorize(`${accountId}/adimages`, 'POST', {});
    const bytes = await downloadPublicImage(imageUrl);
    const base64Data = bytes.toString('base64');

    // 3. Enviar como 'bytes' (parâmetro correto da API Meta)
    return this.post(`${accountId}/adimages`, {
      bytes: base64Data,
    });
  }

  // ==================== DATASET QUALITY (EMQ) ====================

  /**
   * Consulta a qualidade do dataset (EMQ) de um pixel.
   */
  async getDatasetQuality(pixelId: string): Promise<unknown> {
    return this.get(`dataset_quality`, {
      dataset_id: pixelId,
    });
  }

  // ==================== INSIGHTS ====================

  /**
   * Obtém insights de um objeto (conta, campanha, adset, ad)
   */
  async getInsights(
    objectId: string,
    params: InsightsParams = {}
  ): Promise<{ data: InsightsResult[] }> {
    const defaultFields = ['impressions', 'clicks', 'spend', 'reach', 'cpc', 'cpm', 'ctr'];
    if (params.action_breakdowns?.length) defaultFields.push('actions');

    const queryParams: Record<string, string> = {
      fields: (params.fields || defaultFields).join(','),
    };

    if (params.date_preset) {
      queryParams.date_preset = params.date_preset;
    }

    if (params.time_range) {
      queryParams.time_range = JSON.stringify(params.time_range);
    }

    if (params.level) {
      queryParams.level = params.level;
    }

    if (params.breakdowns) {
      queryParams.breakdowns = params.breakdowns.join(',');
    }

    if (params.action_breakdowns?.length) {
      queryParams.action_breakdowns = params.action_breakdowns.join(',');
    }
    if (params.time_increment !== undefined) queryParams.time_increment = String(params.time_increment);
    if (params.filtering !== undefined) queryParams.filtering = JSON.stringify(params.filtering);
    if (params.sort !== undefined) queryParams.sort = JSON.stringify(params.sort);
    if (params.limit !== undefined) queryParams.limit = String(params.limit);
    if (params.after !== undefined) queryParams.after = params.after;

    // Suporte a janelas de atribuicao para quebrar conversoes
    if (params.action_attribution_windows && params.action_attribution_windows.length > 0) {
      queryParams.action_attribution_windows = JSON.stringify(params.action_attribution_windows);
    }

    // Controla se usa config de atribuicao do ad set ou permite override
    if (params.use_unified_attribution_setting !== undefined) {
      queryParams.use_unified_attribution_setting = String(params.use_unified_attribution_setting);
    }

    return this.get<{ data: InsightsResult[] }>(`${objectId}/insights`, queryParams);
  }

  /**
   * Obtém insights da conta de anúncios
   */
  async getAccountInsights(
    accountId: string,
    params: InsightsParams = {}
  ): Promise<{ data: InsightsResult[] }> {
    return this.getInsights(accountId, params);
  }

  // ==================== AUDIÊNCIAS ====================

  /**
   * Lista audiências customizadas
   * NOTA: O campo approximate_count foi removido da API v24.0.
   * Use approximate_count_lower_bound e approximate_count_upper_bound se precisar do tamanho.
   */
  async listCustomAudiences(
    accountId: string,
    fields: string[] = ['id', 'name', 'subtype']
  ): Promise<{ data: CustomAudience[] }> {
    return this.get<{ data: CustomAudience[] }>(`${accountId}/customaudiences`, {
      fields: fields.join(','),
    });
  }

  /**
   * Cria uma audiência customizada
   */
  async createCustomAudience(accountId: string, params: {
    name: string;
    subtype: string;
    description?: string;
    customer_file_source?: string;
    rule?: object;
    pixel_id?: string;
    prefill?: boolean;
    origin_audience_id?: string;
    lookalike_spec?: object;
  }): Promise<{ id: string }> {
    // Construir params, convertendo rule para JSON string se necessário
    const apiParams: Record<string, unknown> = {
      name: params.name,
      subtype: params.subtype,
      ...(params.description && { description: params.description }),
      ...(params.customer_file_source && { customer_file_source: params.customer_file_source }),
      ...(params.rule && { rule: JSON.stringify(params.rule) }),
      ...(params.pixel_id && { pixel_id: params.pixel_id }),
      ...(params.prefill !== undefined && { prefill: params.prefill }),
      ...(params.origin_audience_id && { origin_audience_id: params.origin_audience_id }),
      ...(params.lookalike_spec && { lookalike_spec: params.lookalike_spec }),
    };
    return this.post<{ id: string }>(`${accountId}/customaudiences`, apiParams);
  }

  /**
   * Obtém estimativa de alcance
   */
  async getReachEstimate(accountId: string, params: { targeting_spec: object; optimize_for?: string }): Promise<{
    data: {
      users_lower_bound: number;
      users_upper_bound: number;
    };
  }> {
    return this.get(`${accountId}/reachestimate`, {
      targeting_spec: JSON.stringify(params.targeting_spec),
      ...(params.optimize_for && { optimize_for: params.optimize_for }),
    });
  }

  // ==================== PIXELS ====================

  /**
   * Lista pixels da conta de anúncios
   * Essencial para obter pixel_id ao criar ad sets com OFFSITE_CONVERSIONS
   */
  async listPixels(
    accountId: string,
    fields: string[] = ['id', 'name', 'last_fired_time', 'is_created_by_business']
  ): Promise<{ data: Array<{ id: string; name: string; last_fired_time?: string; [key: string]: unknown }> }> {
    return this.get<{ data: Array<{ id: string; name: string; last_fired_time?: string; [key: string]: unknown }> }>(
      `${accountId}/adspixels`,
      { fields: fields.join(',') }
    );
  }

  // ==================== GEOLOCALIZAÇÃO ====================

  /**
   * Busca localizações para targeting
   * IMPORTANTE: Use esta tool para obter os keys corretos de localização!
   * Keys são específicos do Meta e não correspondem a IDs geográficos padrão.
   */
  async searchGeolocation(params: {
    q: string;
    location_types?: string[];
    country_code?: string;
    limit?: number;
  }): Promise<{
    data: Array<{
      key: string;
      name: string;
      type: string;
      country_code?: string;
      country_name?: string;
      region?: string;
      region_id?: number;
      primary_city?: string;
      primary_city_id?: number;
      supports_city?: boolean;
      supports_region?: boolean;
      [key: string]: unknown;
    }>;
  }> {
    const queryParams: Record<string, string> = {
      q: params.q,
      type: 'adgeolocation',
    };

    if (params.location_types && params.location_types.length > 0) {
      queryParams.location_types = JSON.stringify(params.location_types);
    }

    if (params.country_code) {
      queryParams.country_code = params.country_code;
    }

    if (params.limit) {
      queryParams.limit = String(params.limit);
    }

    return this.get('search', queryParams);
  }

  // ==================== VÍDEO ====================

  /**
   * Faz upload de um vídeo via URL
   */
  async uploadVideo(accountId: string, params: {
    file_url: string;
    title?: string;
    description?: string;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/advideos`, params);
  }

  /**
   * Obtém status de processamento de um vídeo
   */
  async getVideoStatus(
    videoId: string,
    fields: string[] = ['id', 'status', 'length', 'source', 'title', 'created_time']
  ): Promise<Record<string, unknown>> {
    return this.get(videoId, { fields: fields.join(',') });
  }

  // ==================== VALUE RULES ====================

  async createValueRuleSet(accountId: string, params: {
    name: string;
    rules: Array<Record<string, unknown>>;
  }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/value_rule_set`, params);
  }

  async listValueRuleSets(
    accountId: string,
    fields: string[] = ['id', 'name', 'rules']
  ): Promise<{ data: Array<Record<string, unknown>> }> {
    return this.get(`${accountId}/value_rule_set`, { fields: fields.join(',') });
  }

  async getValueRuleSet(
    ruleSetId: string,
    fields: string[] = ['id', 'name', 'rules', 'status']
  ): Promise<Record<string, unknown>> {
    return this.get(ruleSetId, { fields: fields.join(',') });
  }

  async updateValueRuleSet(
    ruleSetId: string,
    params: { name?: string; rules?: Array<Record<string, unknown>> }
  ): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(ruleSetId, params);
  }

  async deleteValueRuleSet(ruleSetId: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(`${ruleSetId}/delete_rule_set`, {});
  }

  // ==================== AD LABELS ====================

  async createAdLabel(accountId: string, params: { name: string }): Promise<{ id: string }> {
    return this.post<{ id: string }>(`${accountId}/adlabels`, params);
  }

  async listAdLabels(
    accountId: string,
    fields: string[] = ['id', 'name', 'created_time']
  ): Promise<{ data: Array<Record<string, unknown>> }> {
    return this.get(`${accountId}/adlabels`, { fields: fields.join(',') });
  }

  // ==================== CREATIVE PREVIEW ====================

  async previewCreative(
    creativeId: string,
    adFormat: string
  ): Promise<{ data: Array<{ body: string }> }> {
    return this.get(`${creativeId}/previews`, { ad_format: adFormat });
  }

  // ==================== BUDGET SCHEDULE ====================

  async createBudgetSchedule(
    campaignId: string,
    params: { budget_value: number; budget_value_type: string; time_start: string; time_end: string }
  ): Promise<{ id: string }> {
    const apiParams = {
      budget_value: params.budget_value,
      budget_value_type: params.budget_value_type,
      time_start: this.unixTime(params.time_start),
      time_end: this.unixTime(params.time_end),
    };
    return this.post<{ id: string }>(`${campaignId}/budget_schedules`, apiParams);
  }

  async getBudgetSchedules(
    campaignId: string
  ): Promise<{ data: Array<Record<string, unknown>> }> {
    return this.get(`${campaignId}/budget_schedules`, {});
  }

  async updateBudgetSchedule(
    scheduleId: string,
    params: { budget_value?: number; time_start?: string; time_end?: string },
    campaignId: string
  ): Promise<{ success: boolean }> {
    const apiParams: Record<string, unknown> = {};
    if (params.budget_value !== undefined) apiParams.budget_value = params.budget_value;
    if (params.time_start) apiParams.time_start = this.unixTime(params.time_start);
    if (params.time_end) apiParams.time_end = this.unixTime(params.time_end);
    return this.post<{ success: boolean }>(scheduleId, apiParams, campaignId);
  }

  async deleteBudgetSchedule(scheduleId: string, campaignId: string): Promise<{ success: boolean }> {
    return this.delete(scheduleId, campaignId);
  }
}

/**
 * Erro customizado para erros da API da Meta
 */
export class MetaClientError extends Error {
  code: number;
  errorSubcode?: number;
  errorData?: string;
  errorUserTitle?: string;
  errorUserMsg?: string;
  fbtraceId?: string;
  type: string;
  httpStatus?: number;
  isTransient?: boolean;

  constructor(error: MetaApiError, httpStatus?: number) {
    super(redactMetaSecrets(error.message));
    this.name = 'MetaClientError';
    this.code = error.code;
    this.errorSubcode = error.error_subcode;
    this.errorData = safeErrorField(error.error_data);
    this.errorUserTitle = safeErrorField(error.error_user_title);
    this.errorUserMsg = safeErrorField(error.error_user_msg);
    this.fbtraceId = safeErrorField(error.fbtrace_id);
    this.type = safeErrorField(error.type) ?? 'MetaError';
    this.httpStatus = httpStatus;
    this.isTransient = error.is_transient;
  }

  /**
   * Formata o erro para exibição
   */
  toString(): string {
    let msg = `Erro da API Meta (${this.code}): ${this.message}`;
    if (this.errorSubcode) {
      msg += `\nSubcódigo: ${this.errorSubcode}`;
    }
    if (this.errorUserTitle) {
      msg += `\n\n**${this.errorUserTitle}**`;
    }
    if (this.errorUserMsg) {
      msg += `\n${this.errorUserMsg}`;
    }
    if (this.errorData) {
      msg += `\nDados: ${this.errorData}`;
    }
    if (this.fbtraceId) {
      msg += `\n\nFB Trace ID: ${this.fbtraceId}`;
    }
    return msg;
  }
}
