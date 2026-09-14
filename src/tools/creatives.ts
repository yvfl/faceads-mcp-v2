import { MetaClient } from '../meta-client.js';
import { type ListCreativesArgs, type GetCreativeArgs, type CreateCreativeArgs } from '../schemas/index.js';
import { normalizeAccountId, validateV26PollComponents, formatCreatives, formatObject, formatEntityValue } from './shared.js';

export async function handleListCreatives(
  client: MetaClient,
  args: ListCreativesArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listCreatives(accountId, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Criativos\n\nEncontrados ${result.data.length} criativo(s):\n\n${formatCreatives(result.data)}`,
      },
    ],
  };
}

export async function handleGetCreative(
  client: MetaClient,
  args: GetCreativeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const creative = await client.getCreative(args.creative_id, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Criativo: ${formatEntityValue(creative.name ?? creative.id ?? args.creative_id)}\n\n${formatObject(creative)}`,
      },
    ],
  };
}

export async function handleCreateCreative(
  client: MetaClient,
  args: CreateCreativeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Validação: precisa de object_story_spec OU object_story_id
  if (!args.object_story_spec && !args.object_story_id) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text: `# Erro de Validação

É obrigatório fornecer \`object_story_spec\` ou \`object_story_id\`.

**object_story_spec** — criar novo criativo:
\`\`\`json
{
  "page_id": "ID_DA_PAGINA",
  "link_data": { "link": "https://seu-site.com", "message": "Texto" }
}
\`\`\`

**object_story_id** — promover post existente:
\`\`\`
"PAGE_ID_POST_ID"
\`\`\`

**Dica:** Use \`list_facebook_pages\` para obter o page_id.`,
        },
      ],
    };
  }

  // v26.0: componentes de enquete saíram da criação e da atualização de criativo.
  const pollError = validateV26PollComponents(args.object_story_spec, client.apiVersion);
  if (pollError) {
    return { isError: true, content: [{ type: 'text', text: pollError }] };
  }

  // Se usar object_story_spec, validar page_id
  if (args.object_story_spec) {
    const spec = args.object_story_spec as { page_id?: string };
    if (!spec.page_id) {
      return { isError: true,
        content: [
          {
            type: 'text',
            text: `# Erro de Validação\n\nO campo \`page_id\` é obrigatório no \`object_story_spec\`.\n\n**Dica:** Use \`list_facebook_pages\` para obter o ID da sua página.`,
          },
        ],
      };
    }
  }

  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createCreative(accountId, {
    name: args.name,
    object_story_spec: args.object_story_spec,
    object_story_id: args.object_story_id,
    degrees_of_freedom_spec: args.creative_features_spec
      ? { creative_features_spec: args.creative_features_spec }
      : undefined,
    wamo_whatsapp_identity_spec: args.wamo_whatsapp_identity_spec,
    asset_feed_spec: args.asset_feed_spec,
    image_hash: args.image_hash,
    image_url: args.image_url,
    url_tags: args.url_tags,
    platform_customizations: args.platform_customizations,
  });

  let successMessage = `# Criativo Criado\n\n**ID:** ${result.id}\n**Nome:** ${args.name}`;

  if (args.object_story_id) {
    successMessage += `\n**Post Existente:** ${args.object_story_id}`;
  }

  if (args.object_story_spec) {
    const spec = args.object_story_spec as { page_id?: string; instagram_user_id?: string };
    if (spec.page_id) successMessage += `\n**Page ID:** ${spec.page_id}`;
    if (spec.instagram_user_id) successMessage += `\n**Instagram ID:** ${spec.instagram_user_id}`;
  }

  if (args.creative_features_spec) {
    const features = Object.keys(args.creative_features_spec);
    successMessage += `\n**Advantage+ Creative:** ${features.length} feature(s) configurada(s) (${features.join(', ')})`;
  }

  if (args.url_tags) {
    successMessage += `\n**URL Tags:** ${args.url_tags}`;
  }

  if (args.platform_customizations) {
    successMessage += `\n**Platform Customizations:** Configurado`;
  }

  successMessage += `\n\n**Próximo passo:** Use este creative_id ao criar um anúncio com \`create_ad\`.`;

  return {
    content: [{ type: 'text', text: successMessage }],
  };
}

// ==================== INSIGHTS HANDLERS ====================
