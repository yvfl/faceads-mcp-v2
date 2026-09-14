import { MetaClient } from '../meta-client.js';
import { type DiscoverAdAccountsArgs, type ListFacebookPagesArgs, type GetInstagramAccountArgs } from '../schemas/index.js';
import { formatEntityList, formatObject } from './shared.js';

export async function handleDiscoverAdAccounts(
  client: MetaClient,
  args: DiscoverAdAccountsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.discoverAdAccounts(args.fields);
  
  const accountsText = result.data.length > 0
    ? result.data.map(acc => {
        const statusMap: Record<number, string> = {
          1: 'ACTIVE',
          2: 'DISABLED',
          3: 'UNSETTLED',
          7: 'PENDING_RISK_REVIEW',
          8: 'PENDING_SETTLEMENT',
          9: 'IN_GRACE_PERIOD',
          100: 'PENDING_CLOSURE',
          101: 'CLOSED',
          201: 'ANY_ACTIVE',
          202: 'ANY_CLOSED',
        };
        const status = acc.account_status == null
          ? undefined
          : statusMap[acc.account_status] ? `${statusMap[acc.account_status]} (${acc.account_status})` : `UNKNOWN (${acc.account_status})`;
        return formatEntityList([{ ...acc, ...(status ? { account_status: status } : {}) }], '', {
          id: 'ID', ...(status ? { account_status: 'Status' } : {}), currency: 'Moeda', timezone_name: 'Timezone',
        });
      }).join('\n\n')
    : 'Nenhuma conta de anúncios encontrada.';

  return {
    content: [
      {
        type: 'text',
        text: `# Contas de Anúncios Disponíveis\n\nEncontradas ${result.data.length} conta(s):\n\n${accountsText}\n\n---\n\n**Passe o \`account_id\` desejado em cada chamada de tool.** Ex: \`account_id: "act_123456789"\``,
      },
    ],
  };
}

export async function handleListFacebookPages(
  client: MetaClient,
  args: ListFacebookPagesArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.listFacebookPages(args.fields);
  
  const pagesText = formatEntityList(result.data, 'Nenhuma página encontrada.', { id: 'ID', category: 'Categoria' });

  return {
    content: [
      {
        type: 'text',
        text: `# Páginas do Facebook\n\nEncontradas ${result.data.length} página(s):\n\n${pagesText}\n\n**Dica:** Use o ID da página para criar criativos ou obter a conta do Instagram vinculada.`,
      },
    ],
  };
}

export async function handleGetInstagramAccount(
  client: MetaClient,
  args: GetInstagramAccountArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.getInstagramAccount(args.page_id, args.fields);
  
  const igBusinessId = result.instagram_business_account?.id;
  const igConnectedId = result.connected_instagram_account?.id;
  const igId = igBusinessId || igConnectedId;
  
  let text: string;
  if (igId) {
    text = `# Conta do Instagram

**Page ID:** ${result.id ?? args.page_id}
**Instagram ID:** ${igId}
${igBusinessId ? `- Tipo: Business Account` : ''}
${igConnectedId && !igBusinessId ? `- Tipo: Connected Account` : ''}

**Como usar:**
Ao criar um criativo, use este ID no campo \`instagram_user_id\` dentro de \`object_story_spec\`:

\`\`\`json
{
  "object_story_spec": {
    "page_id": "${result.id ?? args.page_id}",
    "instagram_user_id": "${igId}",
    "link_data": { ... }
  }
}
\`\`\`

**Importante:** NÃO use o ID que aparece na UI do Meta Ads (formato antigo, depreciado na v22.0+).`;
  } else {
    text = `# Conta do Instagram

**Page ID:** ${result.id ?? args.page_id}

A Meta não retornou um ID de conta do Instagram nos campos consultados. Isso não comprova ausência de vínculo.

Para verificar o vínculo, solicite instagram_business_account e connected_instagram_account e confira as permissões da conexão.`;
  }

  return {
    content: [{ type: 'text', text: `${text}\n\n**Dados retornados:**\n${formatObject(result)}` }],
  };
}

// ==================== CAMPAIGN HANDLERS ====================
