import { MetaClient } from '../meta-client.js';
import { type UploadVideoArgs, type GetVideoStatusArgs, type CreateValueRuleSetArgs, type ListValueRuleSetsArgs, type GetValueRuleSetArgs, type UpdateValueRuleSetArgs, type DeleteValueRuleSetArgs, type CreateAdLabelArgs, type ListAdLabelsArgs, type PreviewCreativeArgs, type CreateBudgetScheduleArgs, type GetBudgetSchedulesArgs, type UpdateBudgetScheduleArgs, type DeleteBudgetScheduleArgs } from '../schemas/index.js';
import { formatValidationError } from '../schemas/index.js';
import { normalizeAccountId, formatObject, formatEntityList, formatEntityValue } from './shared.js';

export async function handleUploadVideo(
  client: MetaClient,
  args: UploadVideoArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.uploadVideo(accountId, {
    file_url: args.file_url,
    title: args.title,
    description: args.description,
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Vídeo Enviado

**Video ID:** ${result.id}
${args.title ? `**Título:** ${args.title}` : ''}

**Próximos passos:**
1. Use \`get_video_status\` para verificar o processamento
2. Após processado, use o video_id no \`create_creative\`:

\`\`\`json
{
  "object_story_spec": {
    "page_id": "ID_DA_PAGINA",
    "video_data": {
      "video_id": "${result.id}",
      "message": "Texto do post"
    }
  }
}
\`\`\``,
      },
    ],
  };
}

export async function handleGetVideoStatus(
  client: MetaClient,
  args: GetVideoStatusArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getVideoStatus(args.video_id);
  const resultObj = result as Record<string, unknown>;

  const status = resultObj.status as Record<string, unknown> | undefined;
  const processingPhase = status?.video_status as string || 'unknown';

  return {
    content: [
      {
        type: 'text',
        text: `# Status do Vídeo

**Video ID:** ${args.video_id}
**Status:** ${processingPhase}
${resultObj.title ? `**Título:** ${resultObj.title}` : ''}
${resultObj.length ? `**Duração:** ${resultObj.length}s` : ''}
${resultObj.source ? `**Source:** ${resultObj.source}` : ''}

${formatObject(resultObj)}`,
      },
    ],
  };
}

// ==================== VALUE RULES HANDLERS ====================

export async function handleCreateValueRuleSet(
  client: MetaClient,
  args: CreateValueRuleSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createValueRuleSet(accountId, {
    name: args.name,
    rules: args.rules,
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Value Rule Set Criado\n\n**ID:** ${result.id}\n**Nome:** ${args.name}\n**Regras:** ${args.rules.length} regra(s)\n\n**Próximo passo:** Use \`update_adset\` com \`value_rule_set_id: "${result.id}"\` e \`value_rules_applied: true\` para aplicar ao ad set.`,
      },
    ],
  };
}

export async function handleListValueRuleSets(
  client: MetaClient,
  args: ListValueRuleSetsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listValueRuleSets(accountId, args.fields);
  const data = result.data || [];

  return {
    content: [
      {
        type: 'text',
        text: `# Value Rule Sets\n\nEncontrados ${data.length} rule set(s):\n\n${formatEntityList(data, 'Nenhum rule set encontrado.')}`,
      },
    ],
  };
}

export async function handleGetValueRuleSet(
  client: MetaClient,
  args: GetValueRuleSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getValueRuleSet(args.value_rule_set_id, args.fields);
  const resultObj = result as Record<string, unknown>;

  return {
    content: [
      {
        type: 'text',
        text: `# Value Rule Set: ${formatEntityValue(resultObj.name ?? resultObj.id ?? args.value_rule_set_id)}\n\n${formatObject(resultObj)}`,
      },
    ],
  };
}

export async function handleUpdateValueRuleSet(
  client: MetaClient,
  args: UpdateValueRuleSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateValueRuleSet(args.value_rule_set_id, {
    name: args.name,
    rules: args.rules,
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Value Rule Set Atualizado\n\n**ID:** ${args.value_rule_set_id}\n\nAlterações aplicadas com sucesso.`,
      },
    ],
  };
}

export async function handleDeleteValueRuleSet(
  client: MetaClient,
  args: DeleteValueRuleSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.deleteValueRuleSet(args.value_rule_set_id);

  return {
    content: [
      {
        type: 'text',
        text: `# Value Rule Set Excluído\n\n**ID:** ${args.value_rule_set_id}\n\nO rule set foi excluído com sucesso.`,
      },
    ],
  };
}

// ==================== AD LABELS HANDLERS ====================

export async function handleCreateAdLabel(
  client: MetaClient,
  args: CreateAdLabelArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createAdLabel(accountId, { name: args.name });

  return {
    content: [
      {
        type: 'text',
        text: `# Ad Label Criado\n\n**ID:** ${result.id}\n**Nome:** ${args.name}\n\n**Uso:** Adicione este label a campanhas, ad sets ou ads usando o campo \`adlabels: [{name: "${args.name}"}]\` ao criar ou atualizar.`,
      },
    ],
  };
}

export async function handleListAdLabels(
  client: MetaClient,
  args: ListAdLabelsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listAdLabels(accountId, args.fields);
  const data = result.data || [];

  return {
    content: [
      {
        type: 'text',
        text: `# Ad Labels\n\nEncontrados ${data.length} label(s):\n\n${formatEntityList(data, 'Nenhum label encontrado.')}`,
      },
    ],
  };
}

// ==================== CREATIVE PREVIEW HANDLER ====================

export async function handlePreviewCreative(
  client: MetaClient,
  args: PreviewCreativeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.previewCreative(args.creative_id, args.ad_format);
  const data = (result as { data?: Array<Record<string, unknown>> }).data || [];

  if (data.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `# Preview do Criativo\n\n**Creative ID:** ${args.creative_id}\n**Formato:** ${args.ad_format}\n\nNenhum preview disponível para este formato.`,
        },
      ],
    };
  }

  const preview = data[0];
  return {
    content: [
      {
        type: 'text',
        text: `# Preview do Criativo\n\n**Creative ID:** ${args.creative_id}\n**Formato:** ${args.ad_format}\n\n**HTML Preview:**\n\`\`\`html\n${preview.body || 'N/A'}\n\`\`\``,
      },
    ],
  };
}

// ==================== BUDGET SCHEDULE HANDLERS ====================

export async function handleCreateBudgetSchedule(
  client: MetaClient,
  args: CreateBudgetScheduleArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (Date.parse(args.time_end) <= Date.parse(args.time_start)) return formatValidationError('time_end precisa ser posterior a time_start.');
  const result = await client.createBudgetSchedule(args.campaign_id, {
    budget_value: args.budget_value,
    budget_value_type: args.budget_value_type,
    time_start: args.time_start,
    time_end: args.time_end,
  });

  return {
    content: [
      {
        type: 'text',
        text: `# Budget Schedule Criado\n\n**ID:** ${result.id}\n**Campanha:** ${args.campaign_id}\n**Budget:** ${args.budget_value} (${args.budget_value_type === 'MULTIPLIER' ? 'multiplicador' : 'unidade mínima da moeda da conta'})\n**Período:** ${args.time_start} até ${args.time_end}`,
      },
    ],
  };
}

export async function handleGetBudgetSchedules(
  client: MetaClient,
  args: GetBudgetSchedulesArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getBudgetSchedules(args.campaign_id);
  const data = (result as { data?: Array<Record<string, unknown>> }).data || [];

  return {
    content: [
      {
        type: 'text',
        text: `# Budget Schedules da Campanha ${args.campaign_id}\n\nEncontrados ${data.length} schedule(s):\n\n${data.length > 0 ? data.map((s: Record<string, unknown>) => `- **ID:** ${s.id} | **Budget:** ${s.budget_value} | **Período:** ${s.time_start} - ${s.time_end}`).join('\n') : 'Nenhum schedule encontrado.'}`,
      },
    ],
  };
}

export async function handleUpdateBudgetSchedule(
  client: MetaClient,
  args: UpdateBudgetScheduleArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.time_start && args.time_end && Date.parse(args.time_end) <= Date.parse(args.time_start)) return formatValidationError('time_end precisa ser posterior a time_start.');
  await client.updateBudgetSchedule(args.budget_schedule_id, {
    budget_value: args.budget_value,
    time_start: args.time_start,
    time_end: args.time_end,
  }, args.campaign_id);

  return {
    content: [
      {
        type: 'text',
        text: `# Budget Schedule Atualizado\n\n**ID:** ${args.budget_schedule_id}\n\nAlterações aplicadas com sucesso.`,
      },
    ],
  };
}

export async function handleDeleteBudgetSchedule(
  client: MetaClient,
  args: DeleteBudgetScheduleArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.deleteBudgetSchedule(args.budget_schedule_id, args.campaign_id);

  return {
    content: [
      {
        type: 'text',
        text: `# Budget Schedule Excluído\n\n**ID:** ${args.budget_schedule_id}\n\nO schedule foi excluído com sucesso.`,
      },
    ],
  };
}

// ==================== FORMATTERS ====================
