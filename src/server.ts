import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { docsTools, handleDocsTool, isDocsTool } from './docs-tools.js';
import { apiTools, handleApiTool, isApiTool } from './api-tools.js';
import { MetaClientError } from './meta-client.js';
import { registerResourceHandlers } from './resources.js';
import { registerPromptHandlers } from './prompts.js';

// Informações do pacote
const packageInfo = {
  name: 'faceads-mcp-v2',
  version: '2.0.0',
};

/**
 * Cria e configura um MCP Server com todos os handlers.
 * Reutilizado por ambos os transportes (stdio e HTTP).
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: packageInfo.name,
      version: packageInfo.version,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Registrar handlers de resources e prompts
  registerResourceHandlers(server);
  registerPromptHandlers(server);

  // Registrar handler para listar todas as tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...docsTools, ...apiTools],
    };
  });

  // Registrar handler para executar tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;


    try {
      let result;

      if (isDocsTool(name)) {
        result = await handleDocsTool(name, args || {});
      } else if (isApiTool(name)) {
        result = await handleApiTool(name, args || {});
      } else {
        result = {
          content: [
            {
              type: 'text' as const,
              text: `Tool não encontrada: ${name}`,
            },
          ],
          isError: true,
        };
      }

      // No tool declares outputSchema, so structuredContent has no contract here. Clients such as
      // Claude.ai forward structuredContent instead of content, which dropped the rows of every
      // paginated read and left only the pagination summary. Content already carries that summary.
      const { structuredContent: _structured, ...wireResult } = result as typeof result & { structuredContent?: unknown };
      return wireResult;
    } catch (error) {

      let errorText: string;

      if (error instanceof MetaClientError) {
        errorText = `# Erro da API Meta

**Código:** ${error.code}
**Tipo:** ${error.type}
**Mensagem:** ${error.message}
${error.errorSubcode ? `**Subcódigo:** ${error.errorSubcode}` : ''}
${error.errorUserTitle ? `\n**${error.errorUserTitle}**` : ''}
${error.errorUserMsg ? `${error.errorUserMsg}` : ''}
${error.errorData ? `**Dados:** ${error.errorData}` : ''}
${error.fbtraceId ? `\n**FB Trace ID:** ${error.fbtraceId}` : ''}

Consulte a documentação de erros com \`get_error_code_info\` para mais detalhes.`;
      } else if (error instanceof Error) {
        errorText = `Falha ao executar ${name}: ${error.message}`;
      } else {
        errorText = 'Falha desconhecida ao executar a tool.';
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: errorText,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

