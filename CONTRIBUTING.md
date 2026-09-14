# Desenvolvimento

Node 22.12+, `npm ci`, `npx prisma generate`, `npm test`. Não use credenciais reais nos testes padrão.

## Estrutura

- `src/tools/`: handlers por domínio e registro central de schemas/permissões.
- `src/meta-client.ts`: chamadas Graph, timeout, erros e paginação.
- `src/auth/account-authorization.ts`: autorização de contas/objetos, também aplicada a chamadas genéricas.
- `src/routes/oauth.ts`, `src/auth/`, `src/ui/pages.ts`: conexão manual, consentimento e tokens MCP.
- `src/server.ts`, `src/transports/http-server.ts`: protocolo e transporte.
- `scripts/`: coleta e executor opcional para conta real.
- `tests/`: regressões, protocolo, auth, segurança, browser, pacote e coleta.

Uma tool nova precisa entrar em `toolRegistry` com schema executável e permissão explícita. O catálogo e a execução usam essa mesma fonte. Mudanças de endpoints remotos precisam incluir prova da conta na política de autorização. Nunca use o token do cliente para definir método, host, identidade ou conta fora do consentimento.

Teste o comportamento observável: payload aceito/rejeitado, chamada Graph, retorno MCP e autorização. Fixtures devem cobrir sucesso e falha relevantes; não substitua uma asserção de proteção apenas para manter a suite verde. Mudanças deliberadas de contrato da v2 são documentadas nos testes de compatibilidade.

O banco de integração deve ser local e conter `test` no nome. Cada teste remove apenas seus próprios registros. Tokens e dados reais pertencem a `.env.test`, `tests/live/*.local.json` e `.audit-results`, ignorados pelo Git.

Antes de enviar alterações, execute `npm run check:publication`. A verificação bloqueia arquivos privados conhecidos e formatos reconhecíveis de credenciais nos arquivos rastreados. Ela não identifica todo dado pessoal ou comercial: revise também nomes, IDs de ativos, métricas, screenshots e textos de PR. Exemplos devem ser sintéticos; resultados de contas reais ficam nos artefatos privados. Remover um dado do arquivo atual não o remove do histórico Git nem de versões anteriores dos textos no GitHub.

Prisma 7.10 usa overrides pontuais para `deepmerge-ts` 8.0.0 e `mysql2` 3.24.4 por correções de segurança. A configuração deste projeto usa objetos simples, sem os tipos Map cujo merge mudou em deepmerge-ts 8. Ao atualizar Prisma, confira se esses overrides ainda são necessários e rode geração, migração e build de container.

Atualize documentação com `npm run discover` e `npm run scrape -- --no-prune`. Para retomar uma execução interrompida, use `npm run scrape:resume -- --no-prune`; páginas válidas do cache são reutilizadas nessa modalidade. Confira `scrape-report.json`; conteúdo indisponível preservado deve continuar marcado como stale. Não rode dois scrapers no mesmo diretório simultaneamente.
