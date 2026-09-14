# Goal

> Registro histórico anterior à implementação da v2. Consulte [VALIDACAO-V2.md](VALIDACAO-V2.md) para o estado desta base corrigida.

Construir uma v2 do MCP Meta Ads, com catálogo de tools revisado, autenticação e interface renovadas, corrigindo os achados da auditoria sem substituir as conexões existentes. Proposta preparada em 12/09/2026; não representa criação de repositório remoto, deploy nem implementação da v2.

## Decisão recomendada

Criar um projeto v2 separado, aproveitando código revisado e os testes existentes. Um novo repositório é adequado à intenção de mudar contratos públicos e experiência de acesso. A proteção das empresas depende também de separar serviço, domínio, banco, credenciais e publicação. Apenas duplicar o Git não produz esse isolamento.

O custo é manter duas versões durante a transição. A v1 entra em manutenção, recebendo correções compatíveis de segurança e funcionamento essencial. A v2 concentra desenvolvimento de produto. A migração ocorre por adesão, com nova conexão e autorização; o endpoint antigo só é aposentado após migração combinada.

## Evidência verificada no código

- A branch auditada `update/docs-md-v26@1a3bac5` tem a coleta Markdown, v26 e três tools novas, com os bloqueios registrados em [AUDITORIA-MCP-2026-09-12.md](AUDITORIA-MCP-2026-09-12.md).
- O login atual está em `src/routes/oauth.ts`: HTML de login/cadastro, configuração manual de token e OAuth no mesmo arquivo. A gravação do token substitui os tokens anteriores do usuário (`:499`). Compartilhar esse banco entre versões pode alterar a conexão que a versão antiga usa.
- `scripts/docker-entrypoint.sh:5` aplica migrações automaticamente antes de iniciar. A v2 não deve herdar o DATABASE_URL atual.
- A branch `feat/facebook-oauth-tech-provider@a177c3e` já possui módulos por domínio, registro de tools, catálogo visual, login Facebook e seleção de contas. É material reutilizável, ainda não aprovado como base pronta.
- Naquela branch, `prisma/migrations/20260428120000_facebook_oauth_invites/migration.sql:7-15` declara instalação nova e remove `meta_tokens` e `password_hash`. Nunca aplicar essa migração ao banco atual.
- Na mesma branch, metadados de permissão não governam o executor: `src/tools/registry.ts:173` continua usando o mapa antigo. Contas selecionadas também não são verificadas pelo auth context (`src/transports/http-server.ts:177-210`). Seleção visual não equivale a autorização.
- A revisão da branch OAuth também encontrou perda do retorno ao cliente MCP na primeira conexão: o callback consome `next`, segue para seleção de contas e não preserva o destino final nessa etapa. Esse caminho precisa de teste completo.
- Essa branch ainda usa configurações diferentes de versão para login/seleção e execução das tools (`META_GRAPH_VERSION` e `META_API_VERSION`, com defaults antigos). A v2 precisa de uma política central de versão, além de validar a introspecção do token Meta e obter consentimento explícito por cliente e escopo MCP.

Essas observações vêm do Git local. Não consultei a configuração real do Railway nem os dados de produção nesta avaliação.

## Isolamento obrigatório

| Componente | V1 existente | V2 proposta |
| --- | --- | --- |
| Repositório e releases | Mantidos para manutenção | Repositório próprio, nome a definir |
| Endpoint MCP e domínio | Permanecem iguais para clientes antigos | Novo endpoint/domínio |
| Serviço de hospedagem | Deploy atual | Serviço independente e homologação própria |
| Banco e migrações | Banco atual, com mudanças compatíveis revisadas | Banco novo com credencial própria e sem permissão sobre o banco antigo |
| Usuários, sessões e tokens MCP | Permanecem na v1 | Novo consentimento e novas sessões; sem cópia automática |
| Chaves e configuração | Credenciais atuais preservadas | Segredos próprios; nunca copiar o .env de produção como atalho |
| Distribuição npm, se houver | Nome e versões existentes preservados | Novo identificador de pacote para evitar atualizações involuntárias |
| App Meta | Configuração existente preservada | Avaliar app/ambiente de homologação; a existência de outro repo não exige por si só um novo App Meta |
| Conta de anúncios para testes | Contas usadas pelas empresas | Conta/ativos de teste explicitamente autorizados |

Uma nova base de dados não duplica os anúncios da Meta: se as duas versões recebem acesso à mesma conta, ambas operam sobre os mesmos objetos reais. O piloto deve evitar duas automações controlando simultaneamente os mesmos anúncios.

A autorização MCP deve validar tokens destinados à v2, e a autorização Meta deve continuar separada. A especificação exige vinculação ao recurso e separação dos tokens usados pelo cliente MCP e pelo provedor externo. [Especificação de autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

## Base técnica e sequência de construção

1. Preparar uma cópia local própria para v2, preservando a referência dos commits de origem e trazendo a auditoria e os testes. Não usar o workspace da v1 como diretório de implementação da v2.
2. Reaproveitar seletivamente a divisão por domínio e as telas/fluxos úteis da branch OAuth. Revalidar auth, migrações e seleção de contas antes de incorporar. O registry dessa branch é ponto de partida, não implementação final do controle de acesso.
3. Portar e corrigir a coleta Markdown e os contratos Meta da branch auditada. Resolver os destinos CAPI/Catalog, referências antigas, retomada, publicação do índice e artefatos de produção.
4. Centralizar permissões, validação, execução e formato de resposta das tools. Separar as decisões do catálogo público da lógica da API Meta.
5. Construir a experiência de acesso em componentes próprios; validar o percurso completo pelo navegador e pelo cliente MCP.
6. Executar testes locais, protocolo, banco isolado e artefato real. Depois, testes Meta autenticados e piloto antes de convidar empresas.

Não há ganho em reescrever todo o cliente Meta antes de reaproveitar os caminhos comprovados. Também não há motivo para carregar para a v2 todas as restrições de nomes da v1: as mudanças devem ser explícitas no novo contrato e no roteiro de migração.

## Revisão do catálogo de tools

O critério é o trabalho que o agente precisa realizar, com entradas claras e respostas verificáveis. A quantidade final vem do inventário de casos de uso, não de uma meta de ter mais ou menos tools.

| Ação | Direção proposta |
| --- | --- |
| Manter | Operações essenciais de descoberta, campanhas, ad sets, anúncios, criativos, insights e públicos que tenham contrato e uso claros. |
| Consolidar | Variações superficiais, como leitura de insights por diferentes níveis, quando uma operação parametrizada continuar fácil de usar e autorizar. |
| Compartilhar implementação | Threads e mensagens devem usar a mesma preparação de ad set, mesmo que continuem tendo tools próprias por clareza de intenção. |
| Preservar intenção explícita | Ativar anúncios e alterar orçamento exigem tratamento claro. Não esconder ações que geram gasto em uma operação genérica opaca. |
| Reavaliar | Tool genérica `execute_api`: fora do catálogo padrão de escrita, ou restrita a operações explicitamente autorizadas com verificação de conta e objeto. Não pode contornar os controles das demais tools. |
| Reorganizar documentação | Guias como resources e busca como tool; manter acesso alternativo somente quando os clientes-alvo precisarem. Remover arquivos internos de orientação do corpus público de referência. |
| Adicionar | Diagnóstico da conexão e capacidades, identificação das contas autorizadas e operações que preencham lacunas reais de fluxo. Cada adição precisa de contrato, permissão e teste. |
| Adiar ou excluir | Funções obsoletas, incompletas ou sem validação suficiente para serem oferecidas como estáveis. Features experimentais ficam identificadas e fora do catálogo estável até cumprir os critérios. |

Cada tool terá uma definição central com nome, descrição, schema de entrada/saída, categoria, acesso necessário e efeito operacional. O executor usará essa mesma definição para autorizar e validar. Metadados ou annotations sozinhos não substituem a checagem no servidor.

O cliente Meta compartilhado terá paginação e limites explícitos, timeout, erros consistentes, leitura correta de HTTP não-2xx, dados estruturados, moeda da conta e rastreabilidade de chamadas. Criações não podem receber retry cego depois de timeout; precisa existir reconciliação do resultado e proteção contra duplicidade.

## Login e experiência de conexão

Refazer o percurso completo, incluindo o visual:

1. Entrar na aplicação e identificar claramente qual cliente MCP solicitou conexão.
2. Conectar a Meta pelo fluxo suportado para o app, com mensagens compreensíveis de permissão e falha. Configuração manual de token, se necessária, fica em caminho técnico específico.
3. Escolher as contas permitidas, com nome e identificador suficientes para evitar confusão entre empresas.
4. Autorizar leitura ou gerenciamento, mostrando a consequência de cada opção.
5. Confirmar acesso real com leitura da conta selecionada e retornar ao cliente MCP que iniciou o fluxo, inclusive na primeira conexão.
6. Disponibilizar uma área de conexões com contas autorizadas, estado da conexão, reconexão, revogação e histórico das ações permitidas.

UI em português, responsiva, acessível e com identidade própria do produto. Erros devem orientar a recuperação; não exibir stacks, tokens, códigos OAuth ou detalhes internos ao usuário. A conta escolhida na tela deve efetivamente restringir a execução de todas as tools e o acesso a objetos por ID.

Login visual pronto não significa OAuth validado. Testar cliente/destino/state/PKCE, expiração, uso único do código, renovação e revogação, além do isolamento entre usuários. Provisionamento e aprovação do App Meta, permissões disponíveis e callbacks reais são validações externas posteriores.

## Critérios objetivos de qualidade

- Todos os achados aplicáveis da auditoria resolvidos, incluindo os herdados da main.
- Nenhuma operação fora da permissão do usuário ou das contas autorizadas, inclusive acesso por ID e chamadas genéricas.
- Catálogo e executor coerentes: schemas executáveis, erros explícitos e respostas estruturadas.
- Documentação íntegra, coleta recuperável e corpus correto dentro do artefato publicado.
- Login e reconexão completos no navegador e nos clientes MCP usados pelas empresas.
- Testes com banco isolado, testes de isolamento entre usuários, concorrência e reconstrução de sessão.
- Validação real dos fluxos que serão anunciados como estáveis: leitura e criação PAUSED, atualização, conferência e limpeza em conta autorizada.
- Visibilidade de falhas, limites e resultados incertos; fluxo de suporte e reversão do deploy.

Os 312 testes atuais são base de evidência. Os testes de comportamento e segurança permanecem; snapshots de nomes e schemas serão substituídos por contratos v2 aprovados quando houver mudança intencional. Não ignorar falhas funcionais para acomodar a reorganização.

## Transição e autorização

Primeiro homologação independente, depois piloto, depois adesão das empresas. A nova conexão recebe autorização própria. Tokens e sessões antigos não serão migrados silenciosamente. A v1 permanece operando durante o período combinado.

As correções de leitura fora de docs e de escrita com permissão de leitura merecem patches compatíveis para a v1 em trabalho separado. Fazer a v2 não corrige quem ainda usa o endpoint antigo.

Nesta etapa foi preparada a recomendação. Nome final do produto/repo, criação no GitHub, provisionamento de serviço/banco, alterações no App Meta, convites a empresas e publicação ficam para confirmação do resultado concreto. O desenvolvimento local da v2 pode preceder essas ações externas.
