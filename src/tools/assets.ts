import { MetaClient } from '../meta-client.js';
import { type ListPixelsArgs, type UploadImageArgs, type GetDatasetQualityArgs, type SearchGeolocationArgs } from '../schemas/index.js';
import { normalizeAccountId, formatObject, formatEntityList } from './shared.js';

export async function handleListPixels(
  client: MetaClient,
  args: ListPixelsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const accountId = normalizeAccountId(args.account_id);
  const result = await client.listPixels(accountId, args.fields);

  if (result.data.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `# Pixels da Conta\n\nNenhum pixel encontrado nesta conta.\n\n**Dica:** Crie um pixel no Facebook Business Manager ou Events Manager antes de criar ad sets com OFFSITE_CONVERSIONS.`,
        },
      ],
    };
  }
  
  const pixelsText = formatEntityList(result.data, 'Nenhum pixel encontrado.', { id: 'ID', last_fired_time: 'Último Disparo' });
  const examplePixel = result.data.find(pixel => typeof pixel.id === 'string' && /^\d+$/.test(pixel.id));
  const usage = examplePixel
    ? `**Como usar no create_adset:**
\`\`\`json
${JSON.stringify({ promoted_object: { pixel_id: examplePixel.id, custom_event_type: 'PURCHASE' } }, null, 2)}
\`\`\``
    : 'Para usar um pixel no create_adset, solicite o campo id nesta listagem. Nenhum ID válido foi retornado nesta consulta.';
  
  return {
    content: [
      {
        type: 'text',
        text: `# Pixels da Conta

Encontrados ${result.data.length} pixel(s):

${pixelsText}

${usage}`,
      },
    ],
  };
}

// ==================== UPLOAD DE IMAGEM HANDLERS ====================

export async function handleUploadImage(
  client: MetaClient,
  args: UploadImageArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const accountId = normalizeAccountId(args.account_id);
    const result = await client.uploadImageFromUrl(accountId, args.image_url);
    
    // A resposta do Meta vem como { images: { bytes: { hash, url, ... } } }
    const images = (result as Record<string, unknown>).images as Record<string, Record<string, string>> | undefined;
    
    if (images) {
      const firstKey = Object.keys(images)[0];
      const imageData = images[firstKey];
      
      return {
        content: [
          {
            type: 'text',
            text: `# Imagem Uploaded com Sucesso

**Image Hash:** ${imageData.hash}
**URL:** ${imageData.url || 'N/A'}

**Como usar no create_creative:**
\`\`\`json
{
  "object_story_spec": {
    "page_id": "ID_DA_PAGINA",
    "link_data": {
      "image_hash": "${imageData.hash}",
      "link": "https://seu-site.com",
      "message": "Texto do post"
    }
  }
}
\`\`\``,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `# Upload de Imagem\n\n**Resultado:**\n${formatObject(result as Record<string, unknown>)}`,
        },
      ],
    };
  } catch (error) {
    return { isError: true,
      content: [
        {
          type: 'text',
          text: `# Erro no Upload de Imagem\n\n${error instanceof Error ? error.message : String(error)}\n\n**Possíveis causas:**\n- URL não é acessível publicamente\n- URL não aponta para uma imagem válida (JPG, PNG)\n- Imagem muito grande (limite local: 10 MB; a Meta pode impor limites próprios)\n- Formato de imagem não suportado\n\n**Dica:** A imagem é baixada e convertida para base64 antes do upload. Certifique-se de que a URL retorna o arquivo de imagem diretamente.`,
        },
      ],
    };
  }
}

// ==================== DATASET QUALITY (EMQ) HANDLERS ====================

export async function handleGetDatasetQuality(client: MetaClient, args: GetDatasetQualityArgs) {
  const result = await client.getDatasetQuality(args.pixel_id);
  return { content: [{ type: 'text' as const, text: `# Dataset Quality (EMQ)\n\n**Pixel/Dataset ID:** ${args.pixel_id}\n\n${formatObject((result || {}) as Record<string, unknown>)}\n\nSão os dados retornados pela Meta. Uma resposta vazia não comprova falha de implementação. Confira disponibilidade e permissões do dataset antes de interpretar a qualidade dos eventos.` }] };
}

// ==================== GEOLOCALIZAÇÃO HANDLERS ====================

export async function handleSearchGeolocation(
  client: MetaClient,
  args: SearchGeolocationArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const result = await client.searchGeolocation({
    q: args.q,
    location_types: args.location_types,
    country_code: args.country_code,
    limit: args.limit,
  });
  
  if (result.data.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `# Busca de Localização

Nenhuma localização encontrada para "${args.q}".

**Dicas:**
- Tente um termo mais genérico
- Verifique a ortografia
- Use location_types para filtrar (ex: ["region", "city"])
- Use country_code para limitar a um país (ex: "BR")`,
        },
      ],
    };
  }
  
  const examples = [
    { type: 'country', field: 'countries', label: 'País' },
    { type: 'region', field: 'regions', label: 'Estado/região' },
    { type: 'city', field: 'cities', label: 'Cidade' },
  ].flatMap(({ type, field, label }) => {
    const location = result.data.find(loc => loc.type === type && loc.key);
    if (!location) return [];
    const value = type === 'country' ? [location.key] : [{ key: location.key }];
    return [`${label}: ${location.name}\n\`\`\`json\n${JSON.stringify({ geo_locations: { [field]: value } }, null, 2)}\n\`\`\``];
  });

  const locationsTable = result.data.map(loc => {
    const countryInfo = loc.country_code ? `${loc.country_name || loc.country_code}` : '-';
    const regionInfo = loc.region || '-';
    return `| ${loc.key} | ${loc.name} | ${loc.type} | ${countryInfo} | ${regionInfo} |`;
  }).join('\n');
  
  return {
    content: [
      {
        type: 'text',
        text: `# Busca de Localização: "${args.q}"

Encontradas ${result.data.length} localização(ões):

| Key | Nome | Tipo | País | Região |
|-----|------|------|------|--------|
${locationsTable}

**Como usar no targeting do create_adset:**

${examples.length ? examples.join('\n\n') : 'Esses tipos não têm exemplo automático de targeting. Consulte a referência de geolocalização antes de montar geo_locations.'}

Use a chave no tipo correspondente. Para obter uma região, busque location_types: ["region"]; uma chave de cidade não é uma chave de região.`,
      },
    ],
  };
}

// ==================== API CUSTOMIZADA HANDLER ====================

/**
 * Processa o endpoint substituindo placeholders de conta
 */
