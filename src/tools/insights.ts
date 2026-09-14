import { MetaClient } from '../meta-client.js';
import { type GetAccountInsightsArgs, type GetCampaignInsightsArgs, type GetAdsetInsightsArgs, type GetAdInsightsArgs, type GetAttributionComparisonArgs, type GetPerformanceSummaryArgs, type ListCampaignAdsWithInsightsArgs } from '../schemas/index.js';
import { normalizeAccountId, formatInsights } from './shared.js';

export async function handleGetAccountInsights(
  client: MetaClient,
  args: GetAccountInsightsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.getAccountInsights(accountId, {
    date_preset: args.date_preset,
    time_range: args.time_range,
    fields: args.fields,
    breakdowns: args.breakdowns,
    action_breakdowns: args.action_breakdowns,
    level: args.level,
    time_increment: args.time_increment,
    filtering: args.filtering,
    sort: args.sort,
    limit: args.limit,
    after: args.after,
    action_attribution_windows: args.action_attribution_windows,
    use_unified_attribution_setting: args.use_unified_attribution_setting,
  });
  
  const hasAttribution = args.action_attribution_windows && args.action_attribution_windows.length > 0;
  const attributionNote = hasAttribution 
    ? `\n\n**Janelas de Atribuição:** ${args.action_attribution_windows?.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Insights da Conta${attributionNote}\n\n${formatInsights(result.data, hasAttribution)}`,
      },
    ],
  };
}

export async function handleGetCampaignInsights(
  client: MetaClient,
  args: GetCampaignInsightsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getInsights(args.campaign_id, {
    date_preset: args.date_preset,
    time_range: args.time_range,
    fields: args.fields,
    breakdowns: args.breakdowns,
    action_breakdowns: args.action_breakdowns,
    level: args.level,
    time_increment: args.time_increment,
    filtering: args.filtering,
    sort: args.sort,
    limit: args.limit,
    after: args.after,
    action_attribution_windows: args.action_attribution_windows,
    use_unified_attribution_setting: args.use_unified_attribution_setting,
  });
  
  const hasAttribution = args.action_attribution_windows && args.action_attribution_windows.length > 0;
  const attributionNote = hasAttribution 
    ? `\n\n**Janelas de Atribuição:** ${args.action_attribution_windows?.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Insights da Campanha ${args.campaign_id}${attributionNote}\n\n${formatInsights(result.data, hasAttribution)}`,
      },
    ],
  };
}

export async function handleGetAdsetInsights(
  client: MetaClient,
  args: GetAdsetInsightsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getInsights(args.adset_id, {
    date_preset: args.date_preset,
    time_range: args.time_range,
    fields: args.fields,
    breakdowns: args.breakdowns,
    action_breakdowns: args.action_breakdowns,
    level: args.level,
    time_increment: args.time_increment,
    filtering: args.filtering,
    sort: args.sort,
    limit: args.limit,
    after: args.after,
    action_attribution_windows: args.action_attribution_windows,
    use_unified_attribution_setting: args.use_unified_attribution_setting,
  });
  
  const hasAttribution = args.action_attribution_windows && args.action_attribution_windows.length > 0;
  const attributionNote = hasAttribution 
    ? `\n\n**Janelas de Atribuição:** ${args.action_attribution_windows?.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Insights do Ad Set ${args.adset_id}${attributionNote}\n\n${formatInsights(result.data, hasAttribution)}`,
      },
    ],
  };
}

export async function handleGetAdInsights(
  client: MetaClient,
  args: GetAdInsightsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getInsights(args.ad_id, {
    date_preset: args.date_preset,
    time_range: args.time_range,
    fields: args.fields,
    breakdowns: args.breakdowns,
    action_breakdowns: args.action_breakdowns,
    level: args.level,
    time_increment: args.time_increment,
    filtering: args.filtering,
    sort: args.sort,
    limit: args.limit,
    after: args.after,
    action_attribution_windows: args.action_attribution_windows,
    use_unified_attribution_setting: args.use_unified_attribution_setting,
  });
  
  const hasAttribution = args.action_attribution_windows && args.action_attribution_windows.length > 0;
  const attributionNote = hasAttribution 
    ? `\n\n**Janelas de Atribuição:** ${args.action_attribution_windows?.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Insights do Anúncio ${args.ad_id}${attributionNote}\n\n${formatInsights(result.data, hasAttribution)}`,
      },
    ],
  };
}

/** Missing provider metrics remain unavailable; absence never becomes measured zero. */
function metric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function divide(numerator: number | null, denominator: number | null): number | null {
  return numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;
}
function display(value: number | null, digits = 2): string {
  return value === null ? 'Não disponível' : value.toFixed(digits);
}
function actionRecord(items: unknown, type: string): Record<string, unknown> | undefined {
  if (!Array.isArray(items)) return undefined;
  const aliases: Record<string, string[]> = { purchase: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'], lead: ['lead', 'offsite_conversion.fb_pixel_lead'] };
  for (const name of aliases[type] ?? [type]) {
    const found = items.find(item => item?.action_type === name);
    if (found) return found;
  }
  return undefined;
}

export async function handleGetAttributionComparison(client: MetaClient, args: GetAttributionComparisonArgs) {
  const attributionWindows = ['1d_click', '7d_click', '1d_view', '7d_view', 'incrementality'];
  const result = await client.getInsights(args.object_id, {
    date_preset: args.date_preset || 'last_30d', time_range: args.time_range,
    fields: ['spend', 'actions', 'cost_per_action_type'],
    action_attribution_windows: attributionWindows, use_unified_attribution_setting: false,
  });
  const lines = [`# Comparação de Atribuição: ${args.object_type} ${args.object_id}`, 'Valores monetários na moeda da conta. Janelas podem se sobrepor; não some suas conversões.'];
  if (!result.data?.length) lines.push('Nenhum dado de insights disponível para o período selecionado.');
  for (const data of result.data ?? []) {
    const spend = metric(data.spend);
    lines.push(`\n**Período:** ${data.date_start ?? ''} a ${data.date_stop ?? ''}`, `**Gasto Total:** ${display(spend)}`);
    for (const type of args.actions ?? ['purchase', 'lead', 'initiate_checkout']) {
      const action = actionRecord(data.actions, type);
      lines.push(`\n## ${type.toUpperCase()}`, '| Janela | Conversões | CPA |', '|---|---:|---:|');
      for (const [label, field] of [['Total retornado', 'value'], ['1d Click', '1d_click'], ['7d Click', '7d_click'], ['1d View', '1d_view'], ['7d View', '7d_view'], ['Incremental', 'incrementality']]) {
        const conversions = metric(action?.[field]);
        lines.push(`| ${label} | ${display(conversions, 0)} | ${display(divide(spend, conversions))} |`);
      }
      const fraction = divide(metric(action?.incrementality), metric(action?.value));
      lines.push(`**% Incremental:** ${fraction === null ? 'Não disponível' : `${(fraction * 100).toFixed(1)}%`}`);
    }
  }
  lines.push('\nNão disponível significa que a métrica não foi retornada ou que não há denominador válido para calculá-la.');
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}

export async function handleGetPerformanceSummary(client: MetaClient, args: GetPerformanceSummaryArgs) {
  const result = await client.getAccountInsights(normalizeAccountId(args.account_id), {
    date_preset: args.date_preset || 'last_30d', time_range: args.time_range,
    fields: ['spend', 'actions', 'cost_per_action_type', 'action_values'],
    action_attribution_windows: ['1d_click', '7d_click', 'incrementality'], use_unified_attribution_setting: false,
  });
  const lines = ['# Resumo de Performance', 'Valores monetários na moeda da conta.'];
  if (!result.data?.length) lines.push('Nenhum dado de insights disponível para o período selecionado.');
  for (const data of result.data ?? []) {
    const spend = metric(data.spend);
    lines.push(`\n**Período:** ${data.date_start ?? ''} a ${data.date_stop ?? ''}`, `**Gasto Total:** ${display(spend)}`);
    for (const type of args.action_types ?? ['purchase']) {
      const action = actionRecord(data.actions, type);
      const total = metric(action?.value), incremental = metric(action?.incrementality);
      lines.push(`\n## ${type.toUpperCase()}`, '| Métrica | Total retornado | Incremental |', '|---|---:|---:|');
      lines.push(`| Conversões | ${display(total, 0)} | ${display(incremental, 0)} |`);
      lines.push(`| CPA | ${display(divide(spend, total))} | ${display(divide(spend, incremental))} |`);
      const fraction = divide(incremental, total);
      lines.push(`**% Incremental:** ${fraction === null ? 'Não disponível' : `${(fraction * 100).toFixed(1)}%`}`);
    }
    const purchaseValue = actionRecord(data.action_values, 'purchase');
    lines.push('\n## ROAS', '| Métrica | Total retornado | Incremental |', '|---|---:|---:|');
    lines.push(`| ROAS | ${display(divide(metric(purchaseValue?.value), spend))} | ${display(divide(metric(purchaseValue?.incrementality), spend))} |`);
  }
  lines.push('\nNão disponível significa que a métrica não foi retornada ou que não há denominador válido para calculá-la.');
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}

export async function handleListCampaignAdsWithInsights(
  client: MetaClient,
  args: ListCampaignAdsWithInsightsArgs
) {
  const adsResult = await client.listCampaignAds(args.campaign_id, ['id', 'name', 'status', 'effective_status']);
  if (!Array.isArray(adsResult.data)) return { isError: true, content: [{ type: 'text' as const, text: 'A Meta retornou uma listagem de anúncios inválida. Não é possível concluir quantidade de anúncios ou ausência de atividade.' }] };
  const ads = adsResult.data;
  const listing = client.collections.find(item => item.endpoint === `${args.campaign_id}/ads`);
  const lines = [
    `# Anúncios da Campanha ${args.campaign_id}`,
    `**Anúncios retornados nesta consulta:** ${ads.length}`,
    `**Período:** ${args.time_range ? `${args.time_range.since} a ${args.time_range.until}` : args.date_preset || 'last_30d'}`,
  ];
  if (!ads.length) lines.push(listing?.complete === false ? 'A listagem está incompleta; não é possível concluir que a campanha não possui anúncios.' : 'Nenhuma entidade de anúncio retornada. A consulta de métricas também verifica o histórico.');
  // Query by campaign at ad level, avoiding one request per ad and retaining every insight row.
  const fields = [...new Set(['ad_id', ...(args.fields ?? ['spend', 'impressions', 'clicks', 'actions', 'cost_per_action_type'])])];
  let rows: Array<Record<string, unknown>> = [];
  let insightError: string | undefined;
  try {
    const result = await client.getInsights(args.campaign_id, {
      date_preset: args.date_preset || 'last_30d', time_range: args.time_range, fields, level: 'ad',
      limit: args.limit ?? 100,
      action_attribution_windows: args.action_attribution_windows,
      use_unified_attribution_setting: args.action_attribution_windows?.length ? false : undefined,
    });
    if (!Array.isArray(result.data)) throw new Error('A Meta não retornou um array de métricas válido.');
    rows = result.data;
  } catch (error) {
    insightError = error instanceof Error ? error.message : 'Falha ao consultar métricas na Meta.';
  }
  const insightProgress = client.collections.find(item => item.endpoint === `${args.campaign_id}/insights`);
  const unknownRows = rows.some(row => typeof row.ad_id !== 'string');
  if (unknownRows) insightError = 'A Meta retornou linhas sem ad_id; não é possível associar todas as métricas aos anúncios.';
  const byAd = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    if (typeof row.ad_id !== 'string') continue;
    const entries = byAd.get(row.ad_id) ?? [];
    entries.push(row);
    byAd.set(row.ad_id, entries);
  }
  if (insightError) lines.unshift(`RELATÓRIO INCOMPLETO: houve erro na consulta de métricas. ${insightError}`);
  for (const ad of ads) {
    lines.push(`## ${ad.name ?? ad.id}`, `**ID:** ${ad.id} | **Status:** ${ad.effective_status ?? ad.status ?? 'Não disponível'}`);
    const insights = byAd.get(ad.id) ?? [];
    if (insights.length) lines.push(formatInsights(insights, !!args.action_attribution_windows?.length));
    else if (insightError || insightProgress?.complete === false) lines.push('Métricas não verificadas: a consulta falhou ou não terminou. Não interpretar como zero ou ausência de atividade.');
    else lines.push('A Meta não retornou métricas para este anúncio no período consultado.');
  }
  // Insight rows can include deleted/archived ads absent from the entity listing. Preserve them.
  const listedIds = new Set(ads.map(ad => ad.id));
  const unlisted = rows.filter(row => typeof row.ad_id !== 'string' || !listedIds.has(row.ad_id));
  if (unlisted.length) lines.push('## Métricas de anúncios ausentes da listagem de entidades', formatInsights(unlisted, !!args.action_attribution_windows?.length));
  return {
    ...(insightError ? { isError: true } : {}),
    content: [{ type: 'text' as const, text: lines.join('\n\n') }],
    structuredContent: { report: { ads_returned: ads.length, insight_rows_returned: rows.length, metrics_complete: !insightError && insightProgress?.complete !== false, ...(insightError ? { error: insightError } : {}) } },
  };
}
