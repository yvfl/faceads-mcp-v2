/**
 * Configuração e validação de variáveis de ambiente
 * para a camada de execução (API Meta)
 */

import { getAuthContext } from './auth-context.js';

export interface MetaConfig {
  accessToken: string;
  apiVersion: string;
}

/**
 * Obtém a configuração da API Meta das variáveis de ambiente
 *
 * Variáveis obrigatórias:
 * - META_ACCESS_TOKEN: Token de acesso da API
 *
 * Variáveis opcionais:
 * - META_API_VERSION: Versão da API (default: v26.0)
 */
export function getMetaConfig(): MetaConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    apiVersion: process.env.META_API_VERSION || 'v26.0',
  };
}

/**
 * Verifica se a API Meta está configurada (via auth context ou env vars)
 */
export function isMetaConfigured(): boolean {
  // Check auth context first (HTTP multi-tenant with DB tokens)
  const authCtx = getAuthContext();
  if (authCtx && authCtx.accessToken) {
    return true;
  }
  // Fallback to env vars (stdio mode)
  return getMetaConfig() !== null;
}

/**
 * Retorna mensagem de erro para quando a API não está configurada
 */
export function getConfigurationError(): string {
  return `A API da Meta não está configurada. Configure as seguintes variáveis de ambiente:

- META_ACCESS_TOKEN: Token de acesso da API (obrigatório)
- META_API_VERSION: Versão da API (opcional, default: v26.0)

Exemplo de configuração no MCP:
{
  "mcpServers": {
    "faceads-v2": {
      "command": "node",
      "args": ["/CAMINHO/faceads-mcp-v2/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "seu_token_aqui"
      }
    }
  }
}

Use a tool "discover_ad_accounts" para listar as contas de anúncio disponíveis e passe o account_id em cada chamada.`;
}
