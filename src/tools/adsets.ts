import { MetaClient } from '../meta-client.js';
import { formatValidationError, type ListAdsetsArgs, type GetAdsetArgs, type CreateAdsetArgs, type UpdateAdsetArgs, type PauseAdsetArgs, type ActivateAdsetArgs } from '../schemas/index.js';
import { normalizeAccountId, normalizeTargeting, hasConstrainedAudience, validateV26Placements, fetchSpecialAdCategories, formatAdSets, formatObject, formatEntityValue } from './shared.js';

export async function handleListAdsets(
  client: MetaClient,
  args: ListAdsetsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listAdSets(accountId, args.fields, args.effective_status);

  const filterNote = args.effective_status 
    ? `\n**Filtro:** ${args.effective_status.join(', ')}\n` 
    : '';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Conjuntos de Anúncios${filterNote}\nEncontrados ${result.data.length} ad set(s):\n\n${formatAdSets(result.data)}`,
      },
    ],
  };
}

export async function handleGetAdset(
  client: MetaClient,
  args: GetAdsetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const adset = await client.getAdSet(args.adset_id, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Ad Set: ${formatEntityValue(adset.name ?? adset.id ?? args.adset_id)}\n\n${formatObject(adset)}`,
      },
    ],
  };
}

export async function handleCreateAdset(
  client: MetaClient,
  args: CreateAdsetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Sempre incluir bid_strategy para evitar erro 2490487
  const bid_strategy = args.bid_strategy ?? 'LOWEST_COST_WITHOUT_CAP';
  
  // Local checks happen before any GET or POST.
  if (args.daily_budget !== undefined && args.lifetime_budget !== undefined) {
    return formatValidationError('daily_budget e lifetime_budget são mutuamente exclusivos.');
  }
  if (args.adset_schedule && !args.lifetime_budget) {
    return formatValidationError('adset_schedule requer lifetime_budget.');
  }
  if (bid_strategy !== 'LOWEST_COST_WITHOUT_CAP' && !args.bid_amount) {
    return formatValidationError('bid_amount é obrigatório para COST_CAP e LOWEST_COST_WITH_BID_CAP.');
  }
  if (args.start_time && args.end_time && Date.parse(args.end_time) <= Date.parse(args.start_time)) {
    return formatValidationError('end_time precisa ser posterior a start_time.');
  }
  const targeting = normalizeTargeting(args.targeting, args.advantage_audience);
  const placementError = validateV26Placements(targeting, client.apiVersion);
  if (placementError) return formatValidationError(placementError.replace(/^# Erro de Validação\n\n/, ''));
  const nested = (targeting.targeting_automation as Record<string, unknown> | undefined)?.advantage_audience;
  if (nested === undefined && hasConstrainedAudience(targeting) && Number(client.apiVersion.slice(1).split('.')[0]) >= 26) {
    const categories = await fetchSpecialAdCategories(client, args.campaign_id);
    if (categories.length) {
      return formatValidationError(`A campanha está em special ad category (${categories.join(', ')}), com público restrito. Informe advantage_audience explicitamente (0 ou 1).`);
    }
  }
  const advantageAudience = nested ?? 1;
  targeting.targeting_automation = { ...(targeting.targeting_automation as object ?? {}), advantage_audience: advantageAudience };

  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createAdSet(accountId, {
    name: args.name,
    campaign_id: args.campaign_id,
    billing_event: args.billing_event,
    optimization_goal: args.optimization_goal,
    targeting,
    daily_budget: args.daily_budget,
    lifetime_budget: args.lifetime_budget,
    status: args.status,
    bid_strategy,
    bid_amount: args.bid_amount,
    bid_constraints: args.bid_constraints,
    promoted_object: args.promoted_object,
    start_time: args.start_time,
    end_time: args.end_time,
    attribution_spec: args.attribution_spec,
    is_incremental_attribution_enabled: args.is_incremental_attribution_enabled,
    excluded_custom_audiences: args.excluded_custom_audiences,
    destination_type: args.destination_type,
    is_dynamic_creative: args.is_dynamic_creative,
    adset_schedule: args.adset_schedule,
    pacing_type: args.pacing_type,
    frequency_control_specs: args.frequency_control_specs,
    daily_min_spend_target: args.daily_min_spend_target,
    daily_spend_cap: args.daily_spend_cap,
    value_rule_set_id: args.value_rule_set_id,
    value_rules_applied: args.value_rules_applied,
    dsa_beneficiary: args.dsa_beneficiary,
    dsa_payor: args.dsa_payor,
    adlabels: args.adlabels,
  });
  
  let successMessage = `# Ad Set Criado\n\n**ID:** ${result.id}\n**Nome:** ${args.name}\n**Bid Strategy:** ${bid_strategy}\n**Advantage+ Audience:** ${advantageAudience === 1 ? 'Ativado' : 'Desativado'}`;
  
  if (args.is_incremental_attribution_enabled !== undefined) {
    successMessage += `\n**Atribuição Incremental:** ${args.is_incremental_attribution_enabled ? 'Ativada' : 'Desativada'}`;
  }
  
  if (args.excluded_custom_audiences && args.excluded_custom_audiences.length > 0) {
    successMessage += `\n**Audiências Excluídas:** ${args.excluded_custom_audiences.length} audiência(s)`;
  }
  
  if (args.promoted_object) {
    successMessage += `\n**Promoted Object:** ${JSON.stringify(args.promoted_object)}`;
  }
  
  if (args.start_time || args.end_time) {
    successMessage += `\n**Agendamento:** ${args.start_time || 'imediato'} até ${args.end_time || 'indefinido'}`;
  }
  
  if (args.attribution_spec) {
    successMessage += `\n**Attribution Spec:** ${JSON.stringify(args.attribution_spec)}`;
  }

  if (args.lifetime_budget) {
    successMessage += `\n**Lifetime Budget:** ${args.lifetime_budget} (unidade mínima da moeda da conta)`;
  }

  if (args.destination_type) {
    successMessage += `\n**Destination Type:** ${args.destination_type}`;
  }

  if (args.is_dynamic_creative) {
    successMessage += `\n**Dynamic Creative:** Ativado`;
  }

  if (args.adset_schedule) {
    successMessage += `\n**Dayparting:** ${args.adset_schedule.length} período(s) configurado(s)`;
  }

  if (args.frequency_control_specs) {
    successMessage += `\n**Frequency Control:** ${JSON.stringify(args.frequency_control_specs)}`;
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

export async function handleUpdateAdset(
  client: MetaClient,
  args: UpdateAdsetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { adset_id, ...updateParams } = args;
  if (args.daily_budget !== undefined && args.lifetime_budget !== undefined) return formatValidationError('daily_budget e lifetime_budget são mutuamente exclusivos.');
  if (args.start_time && args.end_time && Date.parse(args.end_time) <= Date.parse(args.start_time)) return formatValidationError('end_time precisa ser posterior a start_time.');
  if (args.targeting) {
    const error = validateV26Placements(args.targeting, client.apiVersion);
    if (error) return formatValidationError(error);
    // Updates preserve the current audience mode unless the caller explicitly changes it.
    updateParams.targeting = normalizeTargeting(args.targeting);
  }
  await client.updateAdSet(adset_id, updateParams);
  return {
    content: [
      {
        type: 'text',
        text: `# Ad Set Atualizado\n\n**ID:** ${adset_id}\n\nAlterações aplicadas com sucesso.`,
      },
    ],
  };
}

export async function handlePauseAdset(
  client: MetaClient,
  args: PauseAdsetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateAdSet(args.adset_id, { status: 'PAUSED' });
  return {
    content: [
      {
        type: 'text',
        text: `# Ad Set Pausado\n\n**ID:** ${args.adset_id}\n\nO ad set foi pausado com sucesso.`,
      },
    ],
  };
}

export async function handleActivateAdset(
  client: MetaClient,
  args: ActivateAdsetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateAdSet(args.adset_id, { status: 'ACTIVE' });
  return {
    content: [
      {
        type: 'text',
        text: `# Ad Set Ativado\n\n**ID:** ${args.adset_id}\n\nO ad set foi ativado com sucesso.`,
      },
    ],
  };
}

// ==================== AD HANDLERS ====================
