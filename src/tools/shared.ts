import { MetaClient, redactMetaSecrets } from '../meta-client.js';
export function normalizeAccountId(accountId: string): string {
  return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
}

/**
 * Placements que a v26.0 removeu.
 *
 * Instagram Explore devolve erro quando pedido explicitamente; Messenger
 * Stories é descartado em silêncio, o que entregaria menos posicionamento do
 * que o pedido sem avisar ninguém. Os dois viram erro de validação aqui.
 *
 * Ref: developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26
 * (a Meta ainda não publicou o changelog v26.0 em markdown — a página devolve 500)
 */
export function validateV26Placements(targeting: unknown, apiVersion: string): string | null {
  const v26 = Number(apiVersion.replace(/^v/, "").split(".")[0]) >= 26;
  if (!targeting || typeof targeting !== 'object' || Array.isArray(targeting)) return null;

  const removed: string[] = [];
  const spec = targeting as Record<string, unknown>;

  const instagram = spec.instagram_positions;
  if (v26 && Array.isArray(instagram) && instagram.includes('explore')) {
    removed.push(
      '`instagram_positions: explore` — o feed da seção Explorar saiu na v26.0. ' +
        'A API rejeita a chamada. Remova o valor e a entrega migra sozinha para os outros posicionamentos.'
    );
  }

  const messenger = spec.messenger_positions;
  if ((v26 || Date.now() >= Date.parse('2026-10-27T00:00:00Z')) && Array.isArray(messenger) && messenger.includes('story')) {
    removed.push(
      '`messenger_positions: story` — Messenger Stories saiu na v26.0. ' +
        'A API aceita a chamada mas descarta o valor sem avisar, então o ad set rodaria com menos posicionamento do que você pediu. ' +
        'Vale para todas as versões a partir de 27/10/2026.'
    );
  }

  if (removed.length === 0) return null;

  return `# Erro de Validação\n\nPlacement removido na Marketing API v26.0:\n\n${removed
    .map((item) => `- ${item}`)
    .join('\n')}`;
}

/**
 * Componentes de enquete, descontinuados na v26.0.
 *
 * `poll_spec` e `interactive_components_spec` com `type: poll` deixaram de ser
 * aceitos na criação e na atualização de criativo. Vale para todas as versões
 * a partir de 27/10/2026.
 *
 * Ref: developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26
 * (a Meta ainda não publicou o changelog v26.0 em markdown — a página devolve 500)
 */
export function validateV26PollComponents(objectStorySpec: unknown, apiVersion: string): string | null {
  if (Number(apiVersion.replace(/^v/, '').split('.')[0]) < 26 && Date.now() < Date.parse('2026-10-27T00:00:00Z')) return null;
  if (!objectStorySpec || typeof objectStorySpec !== 'object') return null;

  const found = new Set<string>();

  const visit = (node: unknown, depth: number, inInteractive = false): void => {
    if (depth > 6 || !node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1, inInteractive);
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'poll_spec') {
        found.add('`poll_spec`');
      } else if (inInteractive && key === 'type' && typeof value === 'string' && value.toLowerCase() === 'poll') {
        found.add('`interactive_components_spec.type: poll`');
      }
      visit(value, depth + 1, inInteractive || key === 'interactive_components_spec');
    }
  };

  visit(objectStorySpec, 0);

  if (found.size === 0) return null;

  return (
    `# Erro de Validação\n\n` +
    `Componente de enquete descontinuado na Marketing API v26.0: ${[...found].join(', ')}.\n\n` +
    `A Meta parou de aceitar enquete na criação e na atualização de criativo, e o bloqueio vale para todas as versões a partir de 27/10/2026. ` +
    `Remova o campo do \`object_story_spec\` e crie o criativo sem o componente.`
  );
}

/**
 * Categorias em que a v26.0 exige advantage_audience explícito: moradia,
 * emprego e crédito/serviços financeiros. Política (ISSUES_ELECTIONS_POLITICS)
 * não entra na regra.
 */
const RESTRICTED_TARGETING_CATEGORIES = new Set([
  'HOUSING',
  'EMPLOYMENT',
  'CREDIT',
  'FINANCIAL_PRODUCTS_SERVICES',
]);

/**
 * Lê as categorias restritas da campanha. Se a consulta falhar, a criação
 * interrompe: não inferimos a opção de audiência quando falta a informação.
 */
export async function fetchSpecialAdCategories(client: MetaClient, campaignId: string): Promise<string[]> {
  const campaign = await client.getCampaign(campaignId, ['id', 'special_ad_categories']);
  const categories = campaign.special_ad_categories;
  if (!Array.isArray(categories)) return [];
  return categories.filter((category): category is string => typeof category === 'string' && RESTRICTED_TARGETING_CATEGORIES.has(category));
}

const sensitiveOutputKey = /(?:(?:access|refresh|user)token|appsecretproof|clientsecret|password)$/;

/** Redact by key before Markdown/JSON formatting, including nested objects and arrays. */
function redactOutputValue(value: unknown): unknown {
  if (typeof value === 'string') return redactMetaSecrets(value);
  if (Array.isArray(value)) return value.map(redactOutputValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, detail]) => [
    key,
    sensitiveOutputKey.test(key.toLowerCase().replace(/[^a-z0-9]/g, '')) ? '[redacted]' : redactOutputValue(detail),
  ]));
}

export function formatEntityValue(value: unknown): string {
  const safeValue = redactOutputValue(value);
  return typeof safeValue === 'object' ? JSON.stringify(safeValue) : String(safeValue);
}

export function formatEntityList(
  entities: Array<Record<string, unknown>>,
  emptyMessage: string,
  labels: Record<string, string> = { id: 'ID' },
): string {
  if (entities.length === 0) return emptyMessage;

  return entities.map((rawEntity, index) => {
    const entity = redactOutputValue(rawEntity) as Record<string, unknown>;
    const title = entity.name ?? entity.id ?? `Resultado ${index + 1}`;
    const lines = [`### ${formatEntityValue(title)}`];
    const shown = new Set(entity.name == null ? [] : ['name']);
    // Keep familiar labels first, then preserve every other returned field.
    for (const key of [...Object.keys(labels), ...Object.keys(entity)]) {
      if (shown.has(key) || entity[key] === undefined) continue;
      shown.add(key);
      let value = formatEntityValue(entity[key]);
      if (key === 'daily_budget' && (typeof entity[key] === 'string' || typeof entity[key] === 'number')) {
        value += ' (unidade mínima da moeda da conta)';
      }
      lines.push(`- **${Object.hasOwn(labels, key) ? labels[key] : key}:** ${value}`);
    }
    return `${lines.join('\n')}\n`;
  }).join('\n');
}

export function formatCampaigns(campaigns: Array<Record<string, unknown>>): string {
  return formatEntityList(campaigns, 'Nenhuma campanha encontrada.', {
    id: 'ID', status: 'Status', objective: 'Objetivo',
  });
}

export function formatAdSets(adsets: Array<Record<string, unknown>>): string {
  return formatEntityList(adsets, 'Nenhum ad set encontrado.', {
    id: 'ID', status: 'Status', campaign_id: 'Campanha', daily_budget: 'Orçamento diário',
  });
}

export function formatAds(ads: Array<Record<string, unknown>>): string {
  return formatEntityList(ads, 'Nenhum anúncio encontrado.', {
    id: 'ID', status: 'Status', effective_status: 'Effective Status', adset_id: 'Ad Set', creative: 'Creative',
  });
}

function insightNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function insightMoney(value: unknown): string {
  const number = insightNumber(value);
  if (number === null) return 'Não disponível';
  // A positive/negative cost smaller than one cent must not become measured zero.
  return number !== 0 && Number(number.toFixed(2)) === 0 ? String(value) : number.toFixed(2);
}

export function formatInsights(insights: Array<Record<string, unknown>>, hasAttribution: boolean = false): string {
  if (!insights || insights.length === 0) return 'Nenhum dado de insights disponível.';

  if (insights.length > 1) return insights.map((row, index) => `### Resultado ${index + 1}\n\n${formatInsights([row], hasAttribution)}`).join('\n\n');
  const data = insights[0];
  const lines: string[] = ['Valores monetários na moeda da conta.'];

  if (data.date_start && data.date_stop) {
    lines.push(`**Período:** ${data.date_start} a ${data.date_stop}\n`);
  }

  const metrics = [
    { key: 'impressions', label: 'Impressões' },
    { key: 'reach', label: 'Alcance' },
    { key: 'clicks', label: 'Cliques' },
    { key: 'spend', label: 'Gasto' },
    { key: 'cpc', label: 'CPC' },
    { key: 'cpm', label: 'CPM' },
    { key: 'ctr', label: 'CTR' },
  ];

  for (const { key, label } of metrics) {
    if (data[key] !== undefined) {
      const number = insightNumber(data[key]);
      let value: string;
      if (number === null) value = 'Não disponível';
      else if (key === 'spend' || key === 'cpc' || key === 'cpm') {
        value = insightMoney(data[key]);
      } else if (key === 'ctr') {
        value = `${number.toFixed(2)}%`;
      } else {
        value = number.toLocaleString('pt-BR');
      }
      lines.push(`- **${label}:** ${value}`);
    }
  }

  const shown = new Set([...metrics.map(({key}) => key), 'date_start', 'date_stop', 'actions', 'cost_per_action_type']);
  for (const [key, value] of Object.entries(data)) {
    if (!shown.has(key)) lines.push(`- **${key}:** ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  }

  // Formatar actions com breakdown por janela de atribuição
  if (data.actions && Array.isArray(data.actions)) {
    lines.push('\n## Conversões (Actions)\n');
    const actions = data.actions as Array<Record<string, unknown>>;
    
    for (const action of actions) {
      const actionType = action.action_type ?? 'Ação';
      const value = action.value ?? 'Não disponível';
      const shownActionFields = new Set(['action_type', 'value']);
      
      if (hasAttribution) {
        // Mostrar breakdown por janela
        lines.push(`### ${actionType}`);
        lines.push(`- **Total:** ${value}`);
        
        for (const window of ['1d_click', '7d_click', '28d_click', '1d_view', '7d_view']) {
          if (action[window] !== undefined) {
            lines.push(`- **${window.replace('_', ' ')}:** ${action[window]}`);
            shownActionFields.add(window);
          }
        }
        
        // Incremental
        if (action['incrementality'] !== undefined) {
          const incremental = insightNumber(action['incrementality']);
          const total = insightNumber(value);
          const pct = incremental !== null && total !== null && total > 0
            ? ` (${((incremental / total) * 100).toFixed(1)}% do total)` : '';
          lines.push(`- **Incremental:** ${action['incrementality']}${pct}`);
          shownActionFields.add('incrementality');
        }
      } else {
        lines.push(`- **${actionType}:** ${value}`);
      }
      // A dimensão pertence a esta entrada, mesmo se action_type se repetir.
      // Inclui também novas janelas retornadas pela Meta, sem lista fechada.
      for (const [key, detail] of Object.entries(action)) {
        if (!shownActionFields.has(key)) lines.push(`  - **${key}:** ${typeof detail === 'object' ? JSON.stringify(detail) : String(detail)}`);
      }
      if (hasAttribution) lines.push('');
    }
  }

  // Formatar cost_per_action_type
  if (data.cost_per_action_type && Array.isArray(data.cost_per_action_type)) {
    lines.push('\n## Custo por Conversão (CPA)\n');
    const costs = data.cost_per_action_type as Array<Record<string, unknown>>;
    
    for (const cost of costs) {
      const actionType = cost.action_type ?? 'Ação';
      const money = insightMoney;
      const shownCostFields = new Set(['action_type', 'value']);
      
      if (hasAttribution) {
        lines.push(`### CPA - ${actionType}`);
        lines.push(`- **CPA Total:** ${money(cost.value)}`);
        
        for (const [key, label] of [['1d_click', '1d click'], ['7d_click', '7d click'], ['incrementality', 'Incremental']]) {
          if (cost[key] !== undefined) {
            lines.push(`- **CPA ${label}:** ${money(cost[key])}`);
            shownCostFields.add(key);
          }
        }
      } else {
        lines.push(`- **CPA ${actionType}:** ${money(cost.value)}`);
      }
      for (const [key, detail] of Object.entries(cost)) {
        if (!shownCostFields.has(key)) lines.push(`  - **${key}:** ${typeof detail === 'object' ? JSON.stringify(detail) : String(detail)}`);
      }
      if (hasAttribution) lines.push('');
    }
  }

  return lines.join('\n');
}

export function formatCreatives(
  creatives: Array<Record<string, unknown>>
): string {
  return formatEntityList(creatives, 'Nenhum criativo encontrado.', { id: 'ID', thumbnail_url: 'Thumbnail' });
}

export function getCreativeType(objectStorySpec: object): string {
  const spec = objectStorySpec as Record<string, unknown>;
  if (spec.link_data) return 'Link Ad';
  if (spec.video_data) return 'Video Ad';
  if (spec.photo_data) return 'Image Ad';
  if (spec.text_data) return 'Text Ad';
  return 'Unknown';
}

export function formatAudiences(
  audiences: Array<Record<string, unknown>>
): string {
  return formatEntityList(audiences, 'Nenhuma audiência encontrada.', {
    id: 'ID', subtype: 'Subtipo',
    approximate_count_lower_bound: 'Tamanho aproximado (limite inferior)',
    approximate_count_upper_bound: 'Tamanho aproximado (limite superior)',
  });
}

export function formatObject(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(redactOutputValue(obj) as Record<string, unknown>)) {
    if (value !== undefined) {
      const formattedValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      lines.push(`- **${key}:** ${formattedValue}`);
    }
  }
  return lines.join('\n');
}

// ==================== HANDLERS DE CONTEXTO ====================

/** Default and individually relaxed audiences do not require the explicit SAC choice. */
export function hasConstrainedAudience(targeting: Record<string, unknown>): boolean {
  const relaxation = (targeting.targeting_relaxation_types ?? {}) as Record<string, unknown>;
  const nonEmpty = (key: string) => Array.isArray(targeting[key]) && (targeting[key] as unknown[]).length > 0;
  return ((typeof targeting.age_max === 'number' && targeting.age_max < 65) && relaxation.age !== 1)
    || (nonEmpty('genders') && (targeting.genders as unknown[]).length < 2 && relaxation.gender !== 1)
    || (nonEmpty('custom_audiences') && relaxation.custom_audience !== 1)
    || (['flexible_spec', 'interests', 'behaviors'].some(nonEmpty) && relaxation.detailed_targeting !== 1);
}

/** Resolve both supported caller formats; never silently discard a conflicting choice. */
export function normalizeTargeting(targeting: Record<string, unknown>, explicit?: number, defaultChoice?: number): Record<string, unknown> {
  const rawAutomation = targeting.targeting_automation;
  if (rawAutomation !== undefined && (!rawAutomation || typeof rawAutomation !== 'object' || Array.isArray(rawAutomation))) {
    throw new Error('Erro de Validação: targeting_automation precisa ser um objeto.');
  }
  const automation = (rawAutomation ?? {}) as Record<string, unknown>;
  const nested = automation.advantage_audience;
  if (nested !== undefined && nested !== 0 && nested !== 1) throw new Error('Erro de Validação: advantage_audience precisa ser 0 ou 1.');
  if (explicit !== undefined && nested !== undefined && explicit !== nested) throw new Error('Erro de Validação: advantage_audience diverge do valor em targeting.targeting_automation.');
  const choice = explicit ?? nested ?? defaultChoice;
  return { ...targeting, ...(choice === undefined ? {} : { targeting_automation: { ...automation, advantage_audience: choice } }) };
}
