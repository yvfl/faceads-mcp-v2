import { MetaClient } from '../meta-client.js';
import { type ExecuteApiArgs } from '../schemas/index.js';
import { normalizeAccountId } from './shared.js';

function processEndpoint(endpoint: string, accountId?: string): { processedEndpoint: string; warnings: string[] } {
  const warnings: string[] = [];
  let processedEndpoint = endpoint;

  // Substituir placeholder {ad_account_id} se account_id fornecido
  if (accountId && processedEndpoint.includes('{ad_account_id}')) {
    processedEndpoint = processedEndpoint.replace('{ad_account_id}', accountId);
  }

  return { processedEndpoint, warnings };
}

/**
 * Remove access_token de URLs de paginação para não expor credenciais no output.
 */
function sanitizePagingUrls(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePagingUrls);

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (['access_token', 'refresh_token', 'appsecret_proof'].includes(key.toLowerCase())) { result[key] = '[redacted]'; continue; }
    if ((key === 'next' || key === 'previous') && typeof value === 'string' && value.includes('access_token=')) {
      result[key] = value.replace(/access_token=[^&]+/, 'access_token=***');
    } else {
      result[key] = sanitizePagingUrls(value);
    }
  }
  return result;
}

export async function handleExecuteApi(
  client: MetaClient,
  args: ExecuteApiArgs
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { method, endpoint, params } = args;
  const accountId = args.account_id ? normalizeAccountId(args.account_id) : undefined;

  // Processar endpoint (substituir placeholders)
  const { processedEndpoint, warnings } = processEndpoint(endpoint, accountId);

  let result: unknown;

  switch (method) {
    case 'GET': {
      // Converter params para Record<string, string> para GET
      const queryParams: Record<string, string> = {};
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            queryParams[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
        }
      }
      result = await client.get(processedEndpoint, queryParams);
      break;
    }
    case 'POST': {
      result = await client.post(processedEndpoint, (params as Record<string, unknown>) || {});
      break;
    }
    case 'DELETE': {
      result = await client.delete(processedEndpoint);
      break;
    }
  }

  // Montar resposta com avisos se houver
  const warningsText = warnings.length > 0 ? `\n\n${warnings.join('\n')}\n` : '';

  // Sanitizar tokens de URLs de paginação para não expor access_token
  const sanitizedResult = sanitizePagingUrls(result);

  return {
    content: [
      {
        type: 'text',
        text: `# Resultado da API${warningsText}\n\n**Método:** ${method}\n**Endpoint:** ${processedEndpoint}\n\n\`\`\`json\n${JSON.stringify(sanitizedResult, null, 2)}\n\`\`\``,
      },
    ],
  };
}

// ==================== VIDEO HANDLERS ====================
