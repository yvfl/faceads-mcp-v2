import { MetaClient } from '../meta-client.js';
import { type ListAdsArgs, type ListCampaignAdsArgs, type GetAdArgs, type CreateAdArgs, type UpdateAdArgs, type PauseAdArgs, type ActivateAdArgs } from '../schemas/index.js';
import { normalizeAccountId, formatAds, formatObject, formatEntityValue } from './shared.js';

export async function handleListAds(
  client: MetaClient,
  args: ListAdsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listAds(accountId, args.fields, { effective_status: args.effective_status, updated_since: args.updated_since });
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncios\n\nEncontrados ${result.data.length} anúncio(s):\n\n${formatAds(result.data)}`,
      },
    ],
  };
}

export async function handleListCampaignAds(
  client: MetaClient,
  args: ListCampaignAdsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.listCampaignAds(args.campaign_id, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncios da Campanha ${args.campaign_id}\n\nEncontrados ${result.data.length} anúncio(s):\n\n${formatAds(result.data)}`,
      },
    ],
  };
}

export async function handleGetAd(
  client: MetaClient,
  args: GetAdArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const ad = await client.getAd(args.ad_id, args.fields);
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncio: ${formatEntityValue(ad.name ?? ad.id ?? args.ad_id)}\n\n${formatObject(ad)}`,
      },
    ],
  };
}

export async function handleCreateAd(
  client: MetaClient,
  args: CreateAdArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.createAd(accountId, {
    name: args.name,
    adset_id: args.adset_id,
    creative: { creative_id: args.creative_id },
    status: args.status,
    tracking_specs: args.tracking_specs,
    ad_schedule_start_time: args.ad_schedule_start_time,
    ad_schedule_end_time: args.ad_schedule_end_time,
    conversion_domain: args.conversion_domain,
    adlabels: args.adlabels,
  });

  let successMessage = `# Anúncio Criado\n\n**ID:** ${result.id}\n**Nome:** ${args.name}`;
  if (args.conversion_domain) {
    successMessage += `\n**Conversion Domain:** ${args.conversion_domain}`;
  }
  if (args.ad_schedule_start_time || args.ad_schedule_end_time) {
    successMessage += `\n**Agendamento:** ${args.ad_schedule_start_time || 'imediato'} até ${args.ad_schedule_end_time || 'indefinido'}`;
  }
  if (args.tracking_specs) {
    successMessage += `\n**Tracking Specs:** ${args.tracking_specs.length} spec(s) configurado(s)`;
  }
  if (args.adlabels) {
    successMessage += `\n**Labels:** ${args.adlabels.length} label(s)`;
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

export async function handleUpdateAd(
  client: MetaClient,
  args: UpdateAdArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { ad_id, ...updateParams } = args;
  await client.updateAd(ad_id, updateParams);
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncio Atualizado\n\n**ID:** ${ad_id}\n\nAlterações aplicadas com sucesso.`,
      },
    ],
  };
}

export async function handlePauseAd(
  client: MetaClient,
  args: PauseAdArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateAd(args.ad_id, { status: 'PAUSED' });
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncio Pausado\n\n**ID:** ${args.ad_id}\n\nO anúncio foi pausado com sucesso.`,
      },
    ],
  };
}

export async function handleActivateAd(
  client: MetaClient,
  args: ActivateAdArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  await client.updateAd(args.ad_id, { status: 'ACTIVE' });
  return {
    content: [
      {
        type: 'text',
        text: `# Anúncio Ativado\n\n**ID:** ${args.ad_id}\n\nO anúncio foi ativado com sucesso.`,
      },
    ],
  };
}

// ==================== CREATIVE HANDLERS ====================
