# Auditoria do MCP Meta Ads

> Registro histórico anterior à implementação da v2. Consulte [VALIDACAO-V2.md](VALIDACAO-V2.md) para o estado desta base corrigida.

**Parecer: não promover esta branch para main no estado auditado.** A adoção do endpoint Markdown faz sentido e funciona; a atualização ainda perde documentação válida e introduz falhas nas tools. Build e smoke verdes não demonstram compatibilidade com as contas das empresas que usam o serviço.

Base: `update/docs-md-v26` em `1a3bac5`, comparada à main `fa8fa4024b4b861fd51cfcf650a9c7af8089ee85`. Data: 12/09/2026. O pedido foi interpretado como validação do **MCP**, incluindo stdio e HTTP; SMTP não participa deste projeto.

## Como a auditoria foi isolada

Antes da implementação dos testes, dois auditores receberam um checkout separado, congelado no commit `1a3bac5`, em `/tmp/faceads-mcp-audit-1a3bac5`. Um examinou ferramentas/contratos; outro, scraping/documentação. Ambos fecharam seus pareceres sobre esse snapshot antes de revisar ou implementar testes no workspace. Não participaram do trabalho original da branch.

- [Parecer independente das tools/API](audit/2026-09-12-api-isolada.md).
- [Parecer independente da coleta/documentação](audit/2026-09-12-coleta-isolada.md).
- A implementação do executor para conta real recebeu ainda revisão independente, com correções e testes de propriedade dos recursos, limpeza e conferência dos dados persistidos.

As mudanças desta auditoria são testes, executor de validação futura, comandos npm, exemplos de configuração, regras para ignorar credenciais/resultados locais e estes relatórios. O código de produção e a coleta original permanecem como foram auditados. O `PLANO-ATUALIZACAO-MCP.md` que já estava untracked foi preservado. Não houve commit, push, merge, deploy ou escrita na Meta.

## O que está correto

- A Meta entrega Markdown limpo com `Accept: text/markdown`. Amostras oficiais responderam 200, incluindo Click-to-WhatsApp. Substituir Puppeteer por este caminho reduz complexidade e evita coletar o menu HTML como conteúdo.
- A mudança de versão padrão para v26 é coerente com o [lançamento oficial da Meta](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/?locale=en_US). A publicação oficial também limita quais mudanças valem imediatamente em v26 e quais atingem versões anteriores depois.
- O envelope `degrees_of_freedom_spec.creative_features_spec` corrige a montagem anterior sem mudar o argumento público do MCP.
- As 57 tools antigas de API/contexto continuam declaradas. A branch tem 60 nessa camada e seis de documentação, totalizando 66. A bateria compara nomes, obrigatoriedade, tipos e enums de primeiro nível com snapshot fixo da main.
- Os 646 resources anunciados podem ser lidos no checkout completo: 643 documentos e três guias. As oito definições de prompts respondem. Isto não comprova a validade de todos os links internos.
- Os 630 arquivos indexados existem e os dois sentidos do índice são consistentes. A busca em português encontra as referências em inglês nos cenários testados.
- As proteções contra apagar arquivos curados, páginas indisponíveis e o corpus inteiro funcionam nos cenários testados. A publicação do índice e a retomada ainda têm os problemas descritos abaixo.

## Problemas que impedem aprovar a atualização

| Contexto e consequência | Evidência no código | Recomendação |
| --- | --- | --- |
| **Permissão somente leitura permite criar objetos pelas três tools novas.** Se o token Meta associado tiver `ads_management`, a restrição MCP deixa de proteger a conta. As wrappers de ad set também aceitam ACTIVE. | `src/auth/permissions.ts:96` permite nomes não classificados; as três adições não estão no mapa. `src/api-tools.ts:2140` aplica esse mapa. POST comprovado com contexto `read` e transporte falso. | Classificar todas as tools de API explicitamente e bloquear qualquer escrita para leitura. Este é o primeiro bloqueio. |
| **Partnership envia os ad codes no nível errado e bloqueia uma alternativa oficial válida.** O caminho por código não corresponde ao contrato publicado. | `src/api-tools.ts:5134` e `:5140` enviam tokens na raiz; o contrato exige `branded_content`. `:5088` exige media ID mesmo com código Instagram. | Montar o envelope correto e aceitar media ID ou ad code conforme a modalidade. Conferir depois na conta com autorização real do criador. |
| **A regra nova de categoria especial rejeita payloads válidos.** Quem já enviava `targeting.targeting_automation.advantage_audience: 0/1` pode parar de criar ad sets. Targeting só por localização também é bloqueado além da regra Meta. | `src/api-tools.ts:2922` olha apenas a opção de primeiro nível antes da normalização nativa. | Resolver a opção efetiva nos dois formatos, tratar conflitos e aplicar a exigência somente aos cenários da regra oficial. |
| **As wrappers não executam o mesmo contrato do caminho principal.** Campos obrigatórios e enums são apenas anunciados, valores inválidos chegam ao POST, targeting perde a preparação canônica e Threads aceita COST_CAP sem conseguir enviar `bid_amount`. | Dispatch direto em `src/api-tools.ts:2496`; Threads em `:4911` e `:4947`; Messaging em `:5040`. | Usar schemas executáveis e preparação compartilhada; encaminhar o lance ou retirar a estratégia sem suporte. Testar as diferenças intencionais de destino e placement. |
| **A coleta removeu famílias que mudaram de endereço.** Foram removidas 55 páginas CAPI e 39 Catalog. Consultas às raízes e à referência CAPI parameters confirmaram que as famílias continuam disponíveis em novos caminhos; cada página removida ainda precisa ser reconciliada. | `scripts/lib/docs-http.js:41` troca o prefixo mecanicamente e rejeita famílias irmãs; o scraper classifica o endereço inventado como soft-404 e poda. | Seguir os redirects corretos, suportar as famílias canônicas e recolher o conteúdo antes da poda. Preservar os caminhos locais públicos ou oferecer aliases. |
| **Guias e caminhos públicos ficaram quebrados.** Seis referências antes válidas do ANDROMEDA não abrem; há também 73 ocorrências de links locais inválidos nos AGENTS curados do corpus. | `ANDROMEDA.md:893`; leitura literal em `src/docs-tools.ts:203`. Exemplos removidos: `advantage-campaigns/index.md` e guias CAPI. | Reparar links e manter compatibilidade de caminhos cujo conteúdo apenas mudou de nome. Não usar o total de resultados de busca como prova de cobertura documental. |
| **Uma atualização parcial ou falha da fonte pode substituir o índice completo por parcial/vazio.** A poda é bloqueada, mas a descoberta seguinte perde a base de páginas fora do menu. | `scripts/scrape-docs.js:517` protege poda; `:538` publica o índice incondicionalmente. | Publicar índice completo apenas após coleta saudável ou mesclar entradas não processadas com estado explícito. |
| **O comando de retomada não recupera três estados reais de falha.** Cache ausente, erro de página da expansão e HTML transitório permanecem fora da fila de fetch. | `scripts/scrape-docs.js:137`, `:223`, `:321`, `:488`. Três reproduções herméticas falham. | Reconstruir a fila a partir de cache validado e erros do manifesto; reabrir páginas afetadas por indisponibilidade em massa. |
| **Os três guias novos são anunciados no deploy, mas não entram na imagem Docker.** O sucesso no checkout não se repete no artefato descrito pelo Dockerfile. | `Dockerfile:33` copia dist e docs; não copia SKILL, PLAYBOOK e ANDROMEDA. Leitura dos três resources falha na simulação desse conteúdo. | Copiar os guias no estágio de produção e verificar o artefato. Revalidar com build Docker real no gate de deploy. |

Fontes oficiais verificadas por GET, sem token: [Partnership Instagram](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post), [Partnership Facebook](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-fb-post), [Advantage+ Audience](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience), [Conversions API](https://developers.facebook.com/documentation/ads-commerce/conversions-api) e [Catalog](https://developers.facebook.com/documentation/ads-commerce/catalog). Os pareceres isolados detalham as respostas e os exemplos confrontados.

## Outras lacunas da atualização

- As validações v26 são incondicionais, embora exista configuração para escolher versão anterior. Em 12/09/2026 isso rejeita localmente comportamentos que ainda têm janela oficial em versões anteriores. Aplicar regras pela versão efetiva e pelo prazo oficial.
- A validação de enquete trata qualquer `interactive_components_spec` como poll. A remoção oficial é específica ao tipo poll. O predicado está incorreto; não foi comprovada em conta real a elegibilidade de uma modalidade alternativa específica.
- `update_adset` e Partnership contornam validações aplicadas às tools principais; erros locais frequentemente retornam sem `isError`, levando clientes MCP a interpretar falha como sucesso de execução.
- `package-lock.json` ainda menciona Puppeteer e Turndown como dependências diretas antigas. **Não reproduzi falha de npm ci**: o planejamento offline passou e não incluiu esses pacotes. É ajuste de consistência, não evidência de deploy bloqueado.
- HTTP autenticado exige Bearer OAuth do MCP e banco configurado. Só `META_ACCESS_TOKEN` ou `X-Meta-Access-Token` não autentica esse transporte. Esse comportamento já estava na main; parte da documentação de onboarding sugere um modo HTTP de token único que não existe no código atual.

## Problemas herdados da main, relevantes para as empresas atuais

Não atribuo estes defeitos ao autor da branch. Eles foram observados durante a auditoria e merecem correção própria:

1. **Leitura de arquivos fora de docs por resources/read.** O handler concatena `../` sem verificar o diretório final. A reprodução leu somente um arquivo sentinela sintético temporário; nenhum segredo foi acessado. Dependendo dos arquivos disponíveis ao processo, o risco inclui configuração e credenciais. Corrigir a contenção do caminho é prioritário também na versão atual.
2. `update_budget_schedule` também está fora do mapa de permissões e permite escrita com contexto de leitura.
3. Data inválida de budget schedule vira `NaN` no corpo enviado.
4. GET, POST e DELETE aceitam HTTP 503 com JSON sem envelope `error` como sucesso. Validar status HTTP, além do envelope Meta.

Há ainda limites antigos de formatação em reais, paginação e suposições de relatórios. Não fiz auditoria integral de todos os fluxos OAuth/banco nem de todas as métricas de cada conta.

## Resultado executado

| Verificação | Resultado e limite |
| --- | --- |
| `npm run build` | Passou com as dependências e Prisma gerado presentes no workspace. |
| `npm run smoke` original | 32/32. Demonstra arranque e alguns cenários locais; não detecta os bloqueios acima. |
| API, contratos e regressões offline | 268 testes: 245 passaram, 23 falharam. Todas as 60 tools API/contexto têm cenário de dispatch. |
| MCP, planejamento live e executor contra MCP falso | 24 testes: 23 passaram, um falhou por leitura fora de docs herdada. Inclui 646 leituras de resources e seis cenários do executor futuro. |
| Empacotamento/planejamento de instalação | Três testes: dois passaram, um falhou pelos guias Docker ausentes. Não foi feito build Docker real. |
| Scraper isolado | 17 testes: 12 passaram, cinco falharam. Rede simulada e arquivos temporários. |
| **Bateria completa** | **312 testes, 282 passaram, 30 falharam; zero skip/TODO.** Cerca de 3,7 segundos após build nesta execução. |
| Meta oficial sem autenticação | Amostras de documentação consultadas com sucesso. Não é validação da Marketing API autenticada. |
| Conta real e HTTP OAuth com banco | **Pendentes.** Nenhum token real utilizado, nenhum objeto criado na Meta. |

As 30 falhas são cenários, não 30 bugs independentes. Seis cenários demonstram dívidas herdadas; os demais demonstram regressões ou lacunas da atualização e das tools novas. Os testes vermelhos foram mantidos com asserções do comportamento esperado. Tornar a suite verde exige corrigir o código, não ignorar os testes.

Os fixtures de Graph API provam roteamento, argumentos e processamento local. Mesmo um teste de dispatch verde não comprova aceitação remota, elegibilidade da conta, permissões empresariais ou funcionamento de todos os modos de uma tool.

## Ordem recomendada

1. Corrigir permissões das tools novas e dos agendamentos, e a leitura de arquivos fora de docs. São proteções de conta e de credenciais.
2. Corrigir Partnership, audiência, lance e validação compartilhada das wrappers; alinhar a semântica de erros MCP.
3. Recuperar CAPI/Catalog e compatibilidade dos caminhos; corrigir publicação do índice e retomada.
4. Incluir os guias no Docker, completar os ajustes herdados cobertos e executar a bateria até zerar as falhas.
5. Com credencial configurada localmente pelo responsável pela conta, executar leitura real na conta escolhida. O [plano de testes](TEST_PLAN.md) já contém o comando e a configuração.
6. Com autorização específica da conta para escrita, executar o ciclo PAUSED, conferir os dados persistidos e limpar os IDs comprovadamente criados pelo teste. Validar também o deploy HTTP com seu Bearer OAuth, não somente stdio.
7. Reavaliar merge e deploy com essas evidências. Acesso a creator/Threads/WhatsApp e entrega de anúncios permanecem critérios específicos, não inferências de build verde.

Não é necessária uma decisão de produto para corrigir os contratos e regressões comprovados. O parecer técnico para este merge é **aguardar correções e validação autenticada**.
