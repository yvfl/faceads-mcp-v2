import { MetaClient } from '../meta-client.js';
import { type CreateThreadsAdSetArgs, type CreateClickToMessageAdSetArgs, type CreatePartnershipAdCreativeArgs, formatValidationError } from '../schemas/index.js';
import { normalizeAccountId, validateV26Placements, validateV26PollComponents } from './shared.js';
import { handleCreateAdset } from './adsets.js';

export async function handleCreateThreadsAdSet(
  client: MetaClient,
  args: CreateThreadsAdSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const userTargeting = (args.targeting ?? {}) as Record<string, unknown>;

  // Os placements de Threads são fixos nesta tool. Se o chamador mandou os
  // dele, avisa em vez de sobrescrever calado.
  const overridden = ['publisher_platforms', 'instagram_positions', 'threads_positions', 'facebook_positions', 'messenger_positions', 'audience_network_positions'].filter(
    (key) => userTargeting[key] !== undefined
  );

  const { facebook_positions, messenger_positions, audience_network_positions, ...compatibleTargeting } = userTargeting;
  const targeting = {
    ...compatibleTargeting,
    publisher_platforms: ['instagram', 'threads'],
    instagram_positions: ['stream'],
    threads_positions: ['threads_stream'],
  };

  const result = await handleCreateAdset(client, { ...args, targeting });
  if (result.isError) return result;

  return {
    content: [
      {
        type: 'text',
        text:
          `# Threads Ad Set criado\n\n${result.content[0].text}\n**Placements:** instagram/stream + threads/threads_stream\n**Status:** ${args.status ?? 'PAUSED'}` +
          (overridden.length > 0
            ? `\n\n⚠️ Esta tool fixa os placements de Threads, então ${overridden
                .map((key) => `\`${key}\``)
                .join(', ')} que você passou foi substituído. Para placements próprios, use \`create_adset\`.`
            : '') +
          `\n\n**Próximo passo:** criar criativo com create_creative (passe instagram_user_id e threads_user_id no object_story_spec) e depois create_ad.`,
      },
    ],
  };
}

export async function handleCreateClickToMessageAdSet(
  client: MetaClient,
  args: CreateClickToMessageAdSetArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  if (args.destination === 'WHATSAPP' && !args.whatsapp_phone_number) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text: '# Erro de Validação\n\n`whatsapp_phone_number` é obrigatório quando `destination = WHATSAPP`.',
        },
      ],
    };
  }

  // Targeting é obrigatório: um default escondido gastaria verba no país errado.
  if (!args.targeting || Object.keys(args.targeting).length === 0) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text:
            '# Erro de Validação\n\n`targeting` é obrigatório.\n\n' +
            'Informe pelo menos `geo_locations`, por exemplo `{"geo_locations": {"countries": ["BR"]}}`. ' +
            'Use `search_geolocation` para achar as keys de cidade, região ou raio.',
        },
      ],
    };
  }

  const placementError = validateV26Placements(args.targeting, client.apiVersion);
  if (placementError) {
    return { isError: true, content: [{ type: 'text', text: placementError }] };
  }

  const promotedObject: { page_id: string; whatsapp_phone_number?: string } = {
    page_id: args.page_id,
  };
  if (args.destination === 'WHATSAPP' && args.whatsapp_phone_number) {
    promotedObject.whatsapp_phone_number = args.whatsapp_phone_number;
  }

  const result = await handleCreateAdset(client, { ...args, destination_type: args.destination, promoted_object: promotedObject });
  if (result.isError) return result;

  const ctaHint =
    args.destination === 'WHATSAPP'
      ? 'WHATSAPP_MESSAGE'
      : args.destination === 'MESSENGER'
        ? 'MESSAGE_PAGE'
        : 'INSTAGRAM_MESSAGE';

  return {
    content: [
      {
        type: 'text',
        text: `# Click-to-Message Ad Set criado\n\n${result.content[0].text}\n**Destino:** ${args.destination}\n**Page ID:** ${args.page_id}${args.whatsapp_phone_number ? `\n**WhatsApp:** ${args.whatsapp_phone_number}` : ''}\n**Status:** ${args.status ?? 'PAUSED'}\n\n**Próximo passo:** create_creative com call_to_action.type = \`${ctaHint}\` (ou similar) e depois create_ad.`,
      },
    ],
  };
}

export async function handleCreatePartnershipAdCreative(
  client: MetaClient,
  args: CreatePartnershipAdCreativeArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Validações específicas por modo
  if (args.mode === 'boost_existing_post') {
    if (!args.object_id || (!args.source_instagram_media_id && !args.instagram_boost_post_access_token)) {
      return { isError: true,
        content: [
          {
            type: 'text',
            text: '# Erro de Validação\n\nNo modo `boost_existing_post`: `object_id` (Brand Page ID) e `source_instagram_media_id` ou `instagram_boost_post_access_token` são obrigatórios.',
          },
        ],
      };
    }
  } else if (args.mode === 'boost_existing_fb_post') {
    if (!args.object_id || !args.facebook_boost_post_access_token) {
      return { isError: true,
        content: [
          {
            type: 'text',
            text: '# Erro de Validação\n\nNo modo `boost_existing_fb_post`: `object_id` e `facebook_boost_post_access_token` são obrigatórios.',
          },
        ],
      };
    }
  } else if (args.mode === 'use_new_creative') {
    if (!args.object_story_spec) {
      return { isError: true,
        content: [
          {
            type: 'text',
            text: '# Erro de Validação\n\nNo modo `use_new_creative`: `object_story_spec` é obrigatório.',
          },
        ],
      };
    }
  }

  if (args.mode === 'use_new_creative' && !args.facebook_branded_content?.sponsor_page_id && !args.instagram_branded_content?.sponsor_id) return formatValidationError('Informe sponsor_page_id (Facebook) ou sponsor_id (Instagram) para identificar o parceiro.');
  const pollError = validateV26PollComponents(args.object_story_spec, client.apiVersion);
  if (pollError) return formatValidationError(pollError);
  if (args.object_story_spec && !args.object_story_spec.page_id) return formatValidationError('page_id é obrigatório em object_story_spec.');
  const accountId = normalizeAccountId(args.account_id);

  const params: Record<string, unknown> = { name: args.name };

  if (args.mode === 'boost_existing_post') {
    params.object_id = args.object_id;
    params.source_instagram_media_id = args.source_instagram_media_id;
    if (args.instagram_boost_post_access_token) {
      params.branded_content = { instagram_boost_post_access_token: args.instagram_boost_post_access_token, ...(args.ad_format ? { ad_format: args.ad_format } : {}) };
    }
    if (args.facebook_branded_content) params.facebook_branded_content = args.facebook_branded_content;
    if (args.instagram_branded_content) params.instagram_branded_content = args.instagram_branded_content;
  } else if (args.mode === 'boost_existing_fb_post') {
    params.object_id = args.object_id;
    params.branded_content = { facebook_boost_post_access_token: args.facebook_boost_post_access_token, ...(args.ad_format ? { ad_format: args.ad_format } : {}) };
    if (args.facebook_branded_content) params.facebook_branded_content = args.facebook_branded_content;
  } else {
    params.object_story_spec = args.object_story_spec;
    if (args.facebook_branded_content) params.facebook_branded_content = args.facebook_branded_content;
    if (args.instagram_branded_content) params.instagram_branded_content = args.instagram_branded_content;
  }

  if (args.ad_format && !params.branded_content) params.branded_content = { ad_format: args.ad_format };

  if (args.creative_features_spec) {
    params.degrees_of_freedom_spec = { creative_features_spec: args.creative_features_spec };
  }

  const result = await client.createCreative(accountId, params as Parameters<typeof client.createCreative>[1]);

  return {
    content: [
      {
        type: 'text',
        text: `# Partnership Ad Creative criado\n\n**ID:** ${result.id}\n**Modo:** ${args.mode}\n**Nome:** ${args.name}\n\n**Próximo passo:** use este creative_id em create_ad para gerar o anúncio.`,
      },
    ],
  };
}

