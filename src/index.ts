#!/usr/bin/env node

/**
 * MCP Server para Facebook Marketing API
 *
 * Duas camadas de funcionalidade:
 * 1. Camada de Consulta (read-only): Busca e navegação na documentação
 * 2. Camada de Execução (operacional): Tools que executam ações na API da Meta
 *
 * Dois modos de transporte:
 * - stdio (default): Para uso local via MCP clients
 * - HTTP (--http): Para hospedagem remota via Streamable HTTP
 */

import { createMcpServer } from './server.js';
/**
 * Parse CLI args para determinar modo de transporte.
 */
function parseArgs(): { mode: 'stdio' | 'http'; port: number } {
  const args = process.argv.slice(2);
  const isHttp = args.includes('--http');

  let port = Number(process.env.PORT || 3000);
  const portEqArg = args.find(a => a.startsWith('--port='));
  if (portEqArg) {
    port = parseInt(portEqArg.split('=')[1], 10);
  } else {
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10);
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  return { mode: isHttp ? 'http' : 'stdio', port };
}

async function main() {
  const { mode, port } = parseArgs();

  if (mode === 'http') {
    // Dynamic import para não carregar Express no modo stdio
    const { startHttpServer } = await import('./transports/http-server.js');
    await startHttpServer({
      port,
      createServer: createMcpServer,
    });
  } else {
    // Modo stdio (compatibilidade com uso local)
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('FaceAds MCP v2 iniciado (stdio)');
  }
}

main().catch(() => {
  console.error('Falha ao iniciar o MCP. Verifique a configuração e a disponibilidade do banco.');
  process.exit(1);
});
