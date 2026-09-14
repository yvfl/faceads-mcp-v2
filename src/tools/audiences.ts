import { MetaClient } from '../meta-client.js';
import { formatValidationError, type ListCustomAudiencesArgs, type CreateCustomAudienceArgs, type GetReachEstimateArgs } from '../schemas/index.js';
import { normalizeAccountId, formatAudiences } from './shared.js';

export async function handleListCustomAudiences(
  client: MetaClient,
  args: ListCustomAudiencesArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listCustomAudiences(accountId, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Audiências Customizadas\n\nEncontradas ${result.data.length} audiência(s):\n\n${formatAudiences(result.data)}`,
      },
    ],
  };
}

export async function handleCreateCustomAudience(
  client: MetaClient,
  args: CreateCustomAudienceArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Validação de campos obrigatórios por subtipo
  if (args.subtype === 'CUSTOM' && !args.customer_file_source) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text: `# Erro de Validação\n\nPara audiências do tipo CUSTOM, o campo \`customer_file_source\` é obrigatório.\n\nValores aceitos: USER_PROVIDED_ONLY, PARTNER_PROVIDED_ONLY, BOTH_USER_AND_PARTNER_PROVIDED`,
        },
      ],
    };
  }
  
  if (['WEBSITE', 'APP', 'ENGAGEMENT'].includes(args.subtype) && !args.rule) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text: `# Erro de Validação\n\nPara audiências do tipo ${args.subtype}, o campo \`rule\` é obrigatório.\n\nConsulte a documentação para exemplos de regras.`,
        },
      ],
    };
  }

  if (args.subtype === 'LOOKALIKE') {
    const spec = args.lookalike_spec;
    if (!args.origin_audience_id || !spec) return formatValidationError('LOOKALIKE exige origin_audience_id e lookalike_spec.');
    if (!spec.type && spec.ratio === undefined) return formatValidationError('lookalike_spec exige type ou ratio.');
    if (spec.type && spec.ratio !== undefined) return formatValidationError('Informe type ou ratio, não os dois.');
    if (!spec.country && !spec.location_spec) return formatValidationError('lookalike_spec exige country ou location_spec.');
    if (spec.country && spec.location_spec) return formatValidationError('Informe country ou location_spec, não os dois.');
    if (spec.location_spec && !spec.location_spec.geo_locations.countries?.length && !spec.location_spec.geo_locations.country_groups?.length) return formatValidationError('location_spec exige countries ou country_groups.');
    if (spec.starting_ratio !== undefined && (spec.ratio === undefined || spec.starting_ratio >= spec.ratio)) return formatValidationError('starting_ratio deve ser menor que ratio.');
  } else if (args.origin_audience_id || args.lookalike_spec) return formatValidationError('origin_audience_id e lookalike_spec só se aplicam a LOOKALIKE.');

  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createCustomAudience(accountId, {
    name: args.name,
    subtype: args.subtype,
    description: args.description,
    customer_file_source: args.customer_file_source,
    rule: args.rule,
    pixel_id: args.pixel_id,
    prefill: args.prefill,
    origin_audience_id: args.origin_audience_id,
    lookalike_spec: args.lookalike_spec,
  });
  return {
    content: [
      {
        type: 'text',
        text: `# Audiência Criada\n\n**ID:** ${result.id}\n**Nome:** ${args.name}\n**Subtipo:** ${args.subtype}`,
      },
    ],
  };
}

export async function handleGetReachEstimate(
  client: MetaClient,
  args: GetReachEstimateArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.getReachEstimate(accountId, {
    targeting_spec: args.targeting_spec,
  });
  return {
    content: [
      {
        type: 'text',
        text: `# Estimativa de Alcance\n\n**Alcance estimado:** ${result.data.users_lower_bound.toLocaleString()} - ${result.data.users_upper_bound.toLocaleString()} pessoas`,
      },
    ],
  };
}

// ==================== PIXELS HANDLERS ====================
