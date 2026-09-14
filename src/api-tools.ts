import { MetaClient, MetaClientError, redactMetaSecrets } from './meta-client.js';
import { getAuthContext } from './utils/auth-context.js';
import { checkPermission } from './auth/permissions.js';
import { validateArgs, formatValidationError } from './schemas/index.js';
import { toolRegistry, type ToolResult } from './tools/registry.js';
import { collectionTools, continuationCall, usesAutomaticPagination } from './pagination.js';
import { withOperationContext, WriteOperationError } from './operations/journal.js';
import { describeToolFailure, type ToolErrorContext } from './tool-errors.js';
export { apiTools } from './tools/registry.js';

export function isApiTool(name: string): boolean {
  return Object.hasOwn(toolRegistry, name);
}

export async function handleApiTool(name: string, args: unknown): Promise<ToolResult> {
  const errorContext: ToolErrorContext = { tool: name, readOnly: false };
  try {
    if (!isApiTool(name)) return formatValidationError(`Tool desconhecida: ${name}`);
    const entry = toolRegistry[name];
    const method = (args as Record<string, unknown> | null)?.method;
    const permissions = getAuthContext()?.permissions ?? 'readwrite';
    if (!checkPermission(name, permissions, typeof method === 'string' ? method : undefined)) {
      return { content: [{type: 'text', text: `Permission denied: "${name}" requires write access. Your API key has read-only permissions.`}], isError: true };
    }
    const validated = validateArgs(entry.schema, args);
    if (!validated.success) return formatValidationError(validated.error);
    const input = validated.data as Record<string, unknown>;
    errorContext.readOnly = entry.permission === 'read' || entry.permission === 'method' && input.method === 'GET';
    errorContext.requestId = typeof input.request_id === 'string' ? input.request_id : undefined;
    const paginated = collectionTools.has(name);
    const client = entry.requiresApi === false ? undefined : new MetaClient({ pagination: {
      mode: input.pagination_mode === 'all' || input.pagination_mode === 'page' ? input.pagination_mode : usesAutomaticPagination(name) ? 'all' : 'page',
      maxPages: typeof input.max_pages === 'number' ? input.max_pages : 10,
      ...(paginated ? { initialQuery: { limit: typeof input.limit === 'number' ? input.limit : name === 'search_geolocation' ? 25 : 100, after: typeof input.after === 'string' ? input.after : undefined } } : {}),
    } });
    const { request_id, pagination_mode, max_pages, ...handlerArgs } = input;
    // Control fields belong to the MCP envelope, never to a Graph mutation payload.
    const execution = await withOperationContext({ tool: name, requestId: typeof request_id === 'string' ? request_id : undefined }, () => entry.execute(client!, name === 'get_operation_status' ? { ...handlerArgs, request_id } : handlerArgs));
    const result = execution.result;
    if (execution.operations.length) {
      result.structuredContent = { ...result.structuredContent, operations: execution.operations };
      result.content.push({ type: 'text', text: `Recibo das operações:\n${JSON.stringify(execution.operations)}` });
    }
    for (const next of client?.nextPages ?? []) {
      const call = continuationCall(name, input, next);
      if (!call || !Object.hasOwn(toolRegistry, call.tool)) continue;
      const target = toolRegistry[call.tool];
      if (target.permission !== 'read' && !(name === 'execute_api' && call.tool === name && input.method === 'GET')) continue;
      const validatedNext = validateArgs(target.schema, call.arguments);
      if (validatedNext.success) Object.assign(next, { tool: call.tool, arguments: validatedNext.data });
    }
    if (client?.collections.length) {
      for (const collection of client.collections) {
        if (collection.error) Object.assign(collection.error, describeToolFailure(collection.error, errorContext));
      }
      const incomplete = client.collections.filter(page => !page.complete);
      const continued = client.collections.some(page => page.started_after);
      const complete = !incomplete.length && !continued && !result.isError;
      result.structuredContent = { ...result.structuredContent, pagination: { complete, scope: continued ? 'from_cursor' : 'entire_query', collections: client.collections } };
      const unexpected = incomplete.some(page => page.reason !== 'page_requested');
      const status = complete ? 'Consulta completa para os filtros informados.' : 'RESULTADO INCOMPLETO: os resultados são parciais. Não use esta resposta isolada para afirmar o total existente ou concluir desempenho global.';
      result.content.unshift({ type: 'text', text: `${status}${continued ? '\nA consulta começou em um cursor e não inclui as páginas anteriores.' : ''}\n${JSON.stringify({ pagination: result.structuredContent.pagination })}` });
      if (unexpected) result.isError = true;
    }
    if (client?.nextPages.length) {
      result.content.push({type: 'text', text: `Há mais páginas. Os resultados acima são parciais. Se a coleção registrar erro, siga primeiro a orientação error.action antes de continuar. Para cada continuação com tool e arguments, chame next.tool usando exatamente next.arguments. Cada cursor pertence à sua coleção; combine as páginas anteriores antes de concluir totais. Endpoint e params também são preservados quando não há rota tipada disponível:\n${JSON.stringify(client.nextPages)}`});
    }
    return { ...result, content: result.content.map((block) => ({ ...block, text: redactMetaSecrets(block.text) })) };
  } catch (error) {
    if (error instanceof MetaClientError) {
      const recovery = describeToolFailure(error, errorContext);
      return { isError: true, structuredContent: { error: { code: error.code, type: error.type, ...recovery } }, content: [{type: 'text', text: `# Erro da API Meta

**Código:** ${error.code}
**Tipo:** ${error.type}
**Mensagem:** ${error.message}
**Próximo passo:** ${recovery.action}${error.errorSubcode ? `
**Subcódigo:** ${error.errorSubcode}` : ''}${error.errorUserTitle ? `
**${error.errorUserTitle}**` : ''}${error.errorUserMsg ? `
${error.errorUserMsg}` : ''}${error.fbtraceId ? `
**FB Trace ID:** ${error.fbtraceId}` : ''}`} ] };
    }
    if (error instanceof WriteOperationError && error.operation) {
      const operation = error.operation;
      const next = { tool: 'get_operation_status', arguments: { request_id: operation.request_id, ...(operation.entity_id ? { inspect: true } : {}) } };
      return {
        isError: true,
        structuredContent: { operations: [operation], error: { category: ['pending', 'unknown'].includes(operation.status) ? 'write_outcome_unknown' : 'write_blocked', next } },
        content: [{ type: 'text', text: `# Erro\n\n${redactMetaSecrets(error.message)}\n\nConfira o recibo com ${next.tool}: ${JSON.stringify(next.arguments)}. Uma operação pending ou unknown não pode ser repetida.` }],
      };
    }
    return { isError: true, content: [{type: 'text', text: `# Erro

${error instanceof Error ? redactMetaSecrets(error.message) : 'Falha inesperada ao executar a ferramenta.'}`}] };
  }
}
