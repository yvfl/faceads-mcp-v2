import { describeConnectionFailure } from './auth/connection-capabilities.js';

type ErrorDetails = { code?: number; type?: string; httpStatus?: number; isTransient?: boolean; errorSubcode?: number };
export type ToolErrorContext = { tool: string; readOnly: boolean; requestId?: string };
export type RecoveryCall = { tool: string; arguments: Record<string, unknown> };
export type ToolErrorRecovery = { category: string; action: string; next?: RecoveryCall };

/** Recovery describes a next step; it never retries a request or changes its query. */
export function describeToolFailure(error: ErrorDetails, context: ToolErrorContext): ToolErrorRecovery {
  const operation = context.requestId
    ? `get_operation_status com ${JSON.stringify({ request_id: context.requestId, inspect: true })}`
    : 'get_operation_status com o request_id do recibo';
  const writeGuard = context.readOnly ? ''
    : ` Antes de uma nova tentativa de escrita, consulte ${operation}. Não repita uma operação pending ou unknown, inclusive com outro request_id.`;
  const finish = (recovery: ToolErrorRecovery): ToolErrorRecovery => ({ ...recovery, action: recovery.action + writeGuard });

  if (error.code === 190) return finish({ category: 'meta_authentication', action: describeConnectionFailure(error).action });
  if ([4, 17, 32, 613, 80004].includes(error.code ?? -1) || error.httpStatus === 429 || error.type === 'HttpError' && error.code === 429) {
    return finish({ category: 'rate_limit', action: context.readOnly
      ? 'A Meta limitou as consultas. Aguarde a liberação do limite antes de continuar; não repita a consulta nem execute diagnose_connection durante o bloqueio. Se houver páginas anteriores, preserve-as e use next.tool com next.arguments após a liberação.'
      : 'A Meta limitou a operação. Aguarde a liberação do limite e confira o recibo antes de tentar outra escrita; não execute diagnose_connection durante o bloqueio.' });
  }
  if (error.type === 'TimeoutError') return finish({
    category: 'timeout',
    action: context.readOnly
      ? `A leitura ${context.tool} excedeu o tempo disponível. Reduza limit quando a ferramenta oferecer paginação. Se mantiver campos, filtros e período, preserve as páginas já obtidas e continue pelo after retornado. Se precisar reduzir fields ou o período, reinicie a consulta e identifique o novo recorte; não misture suas páginas com as da consulta anterior.`
      : 'A chamada excedeu o tempo disponível. O timeout não comprova que a escrita falhou.',
  });
  if (error.type === 'NetworkError' || error.type === 'ParseError' || error.isTransient || [1, 2].includes(error.code ?? -1) || (error.httpStatus ?? 0) >= 500 || error.type === 'HttpError' && (error.code ?? 0) >= 500) {
    return finish({ category: 'temporary_failure', action: context.readOnly
      ? `A leitura ${context.tool} falhou no transporte ou na resposta da Meta. Aguarde e tente novamente a leitura; se houver continuação, preserve as páginas anteriores e use next.tool com next.arguments. Uma falha de leitura não equivale a resultado vazio.`
      : 'A resposta da Meta não confirma o resultado da escrita.' });
  }
  if (error.code === 10 || error.code === 200) return finish({ category: 'authorization', action: describeConnectionFailure(error).action });
  if (error.code === 100 && error.errorSubcode === 33) return finish({
    category: 'object_unavailable',
    action: 'Confira o ID, a conta autorizada e o acesso ao objeto na Meta. Objeto inexistente e objeto sem acesso podem produzir esta resposta; o erro não comprova ausência nem exclusão.',
    next: { tool: 'get_error_code_info', arguments: { error_code: '100' } },
  });
  if (error.code === 100 || error.code === 2500) return finish({
    category: 'invalid_query',
    action: `Confira a mensagem da Meta e corrija os parâmetros de ${context.tool}, incluindo fields, filtros, dimensões e período quando aplicáveis. Se a mensagem indicar objeto indisponível, verifique o ID e o acesso; objeto inexistente e objeto sem acesso podem produzir o mesmo erro. Consulte get_error_code_info para o código ${error.code} e a referência do endpoint. Se mudar a consulta, reinicie a paginação; não reutilize o cursor de outra consulta.`,
    next: { tool: 'get_error_code_info', arguments: { error_code: String(error.code) } },
  });
  return finish({
    category: 'provider_error',
    action: 'Confira a mensagem e o código da Meta na referência da operação antes de alterar a consulta. Esse erro, isoladamente, não comprova falha de autenticação.',
    ...(error.code !== undefined && error.code > 0 ? { next: { tool: 'get_error_code_info', arguments: { error_code: String(error.code) } } } : {}),
  });
}
