import { MetaClient } from '../meta-client.js';
import { type CreateCampaignArgs, type UpdateCampaignArgs, type GetCampaignArgs, type ListCampaignsArgs, type PauseCampaignArgs, type ActivateCampaignArgs } from '../schemas/index.js';
import { normalizeAccountId, formatCampaigns, formatObject, formatEntityValue } from './shared.js';

export async function handleListCampaigns(
  client: MetaClient,
  args: ListCampaignsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listCampaigns(accountId, args.fields, args.effective_status);

  const filterNote = args.effective_status 
    ? `\n**Filtro:** ${args.effective_status.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Campanhas${filterNote}\nEncontradas ${result.data.length} campanha(s):\n\n${formatCampaigns(result.data)}`,
      },
    ],
  };
}

export async function handleGetCampaign(
  client: MetaClient,
  args: GetCampaignArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const campaign = await client.getCampaign(args.campaign_id, args.fields);
  
  const budgets = [campaign.daily_budget, campaign.lifetime_budget].map(value =>
    (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))
      ? Number(value) : undefined);
  const budgetType = budgets.some(value => value !== undefined && value > 0)
    ? 'CBO (Campaign Budget Optimization)'
    : 'Não disponível nos campos retornados';
  
  let budgetInfo = '';
  if (campaign.daily_budget !== undefined) {
    budgetInfo = `\n**Orçamento Diário:** ${formatEntityValue(campaign.daily_budget)} (unidade mínima da moeda da conta)`;
  }
  if (campaign.lifetime_budget !== undefined) {
    budgetInfo += `\n**Orçamento Vitalício:** ${formatEntityValue(campaign.lifetime_budget)} (unidade mínima da moeda da conta)`;
  }
  if (campaign.budget_remaining !== undefined) {
    budgetInfo += `\n**Orçamento Restante:** ${formatEntityValue(campaign.budget_remaining)} (unidade mínima da moeda da conta)`;
  }

  return {
    content: [
      {
        type: 'text',
        text: `# Campanha: ${formatEntityValue(campaign.name ?? campaign.id ?? args.campaign_id)}

**ID:** ${campaign.id ?? args.campaign_id}
${campaign.status !== undefined ? `**Status:** ${formatEntityValue(campaign.status)}` : ''}
${campaign.objective !== undefined ? `**Objetivo:** ${formatEntityValue(campaign.objective)}` : ''}
**Tipo de Orçamento:** ${budgetType}${budgetInfo}
${campaign.created_time ? `**Criada em:** ${campaign.created_time}` : ''}
${campaign.updated_time ? `**Atualizada em:** ${campaign.updated_time}` : ''}

---

**Dados completos:**
${formatObject(campaign)}`,
      },
    ],
  };
}

export async function handleCreateCampaign(
  client: MetaClient,
  args: CreateCampaignArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Validação: daily_budget e lifetime_budget são mutuamente exclusivos
  if (args.daily_budget && args.lifetime_budget) {
    return { isError: true,
      content: [{
        type: 'text',
        text: `# Erro de Validação\n\n**daily_budget** e **lifetime_budget** são mutuamente exclusivos. Use apenas um deles.\n\n- daily_budget: orçamento por dia (CBO)\n- lifetime_budget: orçamento total no período (requer start_time e stop_time)`,
      }],
    };
  }

  const accountId = normalizeAccountId(args.account_id);

  // Sempre incluir is_adset_budget_sharing_enabled para evitar erro 4834011
  const is_adset_budget_sharing_enabled = args.is_adset_budget_sharing_enabled ?? false;

  // G-04: Default inteligente para bid_strategy em campanhas CBO
  const hasBudget = args.daily_budget || args.lifetime_budget;
  const bid_strategy = args.bid_strategy ?? (hasBudget ? 'LOWEST_COST_WITHOUT_CAP' : undefined);

  const result = await client.createCampaign(accountId, {
    name: args.name,
    objective: args.objective,
    status: args.status,
    daily_budget: args.daily_budget,
    lifetime_budget: args.lifetime_budget,
    spend_cap: args.spend_cap,
    buying_type: args.buying_type,
    bid_strategy,
    special_ad_categories: args.special_ad_categories,
    is_adset_budget_sharing_enabled,
    start_time: args.start_time,
    stop_time: args.stop_time,
    is_skadnetwork_attribution: args.is_skadnetwork_attribution,
    promoted_object: args.promoted_object,
  });

  let successMessage = `# Campanha Criada\n\n**ID:** ${result.id}\n**Nome:** ${args.name}\n**Objetivo:** ${args.objective}\n**Status:** ${args.status}\n**Budget Sharing:** ${is_adset_budget_sharing_enabled}`;
  if (bid_strategy) {
    successMessage += `\n**Bid Strategy:** ${bid_strategy}`;
  }
  if (args.daily_budget) {
    successMessage += `\n**Daily Budget:** ${args.daily_budget} (unidade mínima da moeda da conta)`;
  }
  if (args.lifetime_budget) {
    successMessage += `\n**Lifetime Budget:** ${args.lifetime_budget} (unidade mínima da moeda da conta)`;
  }
  if (args.spend_cap) {
    successMessage += `\n**Spend Cap:** ${args.spend_cap} (unidade mínima da moeda da conta)`;
  }
  if (args.buying_type) {
    successMessage += `\n**Buying Type:** ${args.buying_type}`;
  }
  if (args.start_time || args.stop_time) {
    successMessage += `\n**Agendamento:** ${args.start_time || 'imediato'} até ${args.stop_time || 'indefinido'}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: successMessage,
      },
    ],
  };
}

export async function handleUpdateCampaign(
  client: MetaClient,
  args: UpdateCampaignArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { campaign_id, ...updateParams } = args;
  await client.updateCampaign(campaign_id, updateParams);
  return {
    content: [
      {
        type: 'text',
        text: `# Campanha Atualizada\n\n**ID:** ${campaign_id}\n\nAlterações aplicadas com sucesso.`,
      },
    ],
  };
}

export async function handlePauseCampaign(
  client: MetaClient,
  args: PauseCampaignArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateCampaign(args.campaign_id, { status: 'PAUSED' });
  return {
    content: [
      {
        type: 'text',
        text: `# Campanha Pausada\n\n**ID:** ${args.campaign_id}\n\nA campanha foi pausada com sucesso.`,
      },
    ],
  };
}

export async function handleActivateCampaign(
  client: MetaClient,
  args: ActivateCampaignArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateCampaign(args.campaign_id, { status: 'ACTIVE' });
  return {
    content: [
      {
        type: 'text',
        text: `# Campanha Ativada\n\n**ID:** ${args.campaign_id}\n\nA campanha foi ativada com sucesso.`,
      },
    ],
  };
}

// ==================== ADSET HANDLERS ====================
