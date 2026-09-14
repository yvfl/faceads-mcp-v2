# Operação do FaceAds MCP v2

Guia do projeto para agentes que consultam documentação e operam contas de anúncios Meta. O catálogo disponível em `tools/list` e o schema de cada ferramenta são o contrato executável. Os exemplos das páginas coletadas são referências e podem citar versões anteriores da API.

## Conectar

Use o endereço HTTPS do deploy v2 no cliente MCP. Conclua o login, selecione as contas e conceda apenas o acesso necessário. A conexão antiga pertence ao deploy v1 e continua separada.

Para desenvolvimento local, instale as dependências, gere o build e execute `node dist/index.js`. Não instale o pacote antigo como forma de acessar esta versão. Siga o README para variáveis, banco e autenticação do ambiente escolhido.

Consultar documentação não exige um token Meta. Executar chamadas autenticadas exige uma conexão válida e autorização para a operação e a conta.

## Começar pela leitura

1. Consulte `tools/list` para conhecer as operações e seus argumentos atuais.
2. Use `discover_ad_accounts` para identificar as contas realmente acessíveis. Selecione a conta com o usuário quando houver ambiguidade.
3. Leia os objetos atuais antes de propor mudanças. Confirme nome, ID, moeda, fuso, orçamento e status.
4. Busque a referência com `search_documentation` ou `get_endpoint_reference` quando houver dúvida de contrato.
5. Explique o que os dados demonstram, a janela analisada e o que ainda depende de validação.

Não invente IDs nem copie IDs dos exemplos. A permissão concedida à conexão limita o que a ferramenta pode fazer, mas não substitui a intenção do usuário para uma alteração específica.

## Consultar todos os resultados

Listas e Insights usam paginação automática por padrão, limitada a 10 páginas e 25 segundos por coleção. `max_pages` permite até 50 páginas; `limit` é o tamanho de cada página. Use `pagination_mode: "page"` apenas quando a tarefa pedir uma amostra ou uma página. `execute_api` mantém uma página por padrão.

Antes de afirmar quantos anúncios existem ou comparar desempenho global, confira `structuredContent.pagination.complete`. Se for `false`, apresente o recorte como parcial e chame `collections[].next.tool` com `collections[].next.arguments`. Se houver erro na coleção, siga primeiro `error.action`. `scope: "from_cursor"` informa que a resposta exclui as páginas anteriores; reúna essas páginas antes de fechar a análise. Não use o número de itens retornados como total da conta.

Use somente argumentos anunciados no schema: parâmetros desconhecidos são rejeitados. `list_ads` aceita `effective_status` e `updated_since` em segundos Unix. Se mudar campos, filtros ou período após um erro, reinicie a paginação e identifique o novo recorte. Campo não retornado não comprova ausência de configuração ou de vínculo.

Não descarte linhas de Insights por quebra, ação ou período. Métrica indisponível e erro de consulta são estados distintos de zero. Uma resposta com `RESULTADO INCOMPLETO` pode conter dados úteis, mas não permite concluir que os itens ausentes não existem.

Na busca `search_geolocation`, o padrão é uma página de 25 sugestões. Continue apenas se precisar de outros locais. Use a chave no tipo correspondente e preserve os tipos retornados pela Meta; uma busca por cidade pode incluir locais reclassificados como bairros.

## Ferramentas de documentação

| Ferramenta | Uso |
|---|---|
| `search_documentation` | Busca em português ou inglês, com seção e limite |
| `get_document_by_path` | Abre um caminho retornado pela busca |
| `list_sections` | Lista seções e quantidade de arquivos públicos |
| `get_endpoint_reference` | Localiza referência técnica de um objeto ou endpoint |
| `get_error_code_info` | Busca contexto de um código de erro |
| `get_quick_reference` | Resume a navegação e a hierarquia dos objetos |

Os documentos coletados registram fonte e data de coleta. `stale: true` indica conteúdo preservado de uma coleta anterior quando a atualização não pôde ser confirmada. Não apresente esse conteúdo como validação atual da API. Os arquivos AGENTS.md são instruções locais de manutenção e não fazem parte do corpus público.

O corpus inclui referências de Catalog, CAPI, Gateway e do MCP oficial da Meta. Encontrar uma operação nessas páginas não significa que o FaceAds a execute. Catálogos e experimentos, por exemplo, exigem ferramentas e políticas específicas antes de poderem ser operados. Confira o catálogo desta conexão. As regras e permissões do MCP oficial não se aplicam automaticamente às chamadas Graph feitas pelo FaceAds.

## Alterar com intenção explícita

Antes de criar, editar, ativar ou remover objetos, apresente a conta, os objetos, os campos, os valores e o efeito esperado. Use a autorização já dada pelo usuário quando ela cobrir a ação concreta. Uma autorização genérica de acesso não autoriza alterações arbitrárias de orçamento ou ativação de anúncios.

Campanhas, conjuntos e anúncios são sempre criados ou copiados pausados. A criação rejeita `ACTIVE`; a ativação ocorre depois, em uma operação separada. Confirme a resposta e releia os campos relevantes.

Forneça um `request_id` estável para cada intenção de escrita. Guarde o identificador retornado e consulte `get_operation_status` após perda de conexão ou timeout. Use `inspect: true` para conferir o estado quando o histórico tiver o ID remoto. Repetir a mesma requisição confirmada reutiliza seu resultado; uma operação pendente ou incerta impede nova escrita idêntica, inclusive se o identificador for trocado. Não use um novo ID para contornar esse bloqueio.

Quando a Meta não devolve o ID de uma criação, nomes iguais ou uma listagem vazia não bastam para determinar se ela aconteceu. Informe a incerteza e verifique o histórico da conta antes de propor qualquer nova criação. O histórico do FaceAds só contém operações executadas por esta instalação, não todas as alterações feitas na Meta.

Não exponha tokens, dados pessoais de leads ou listas de clientes em logs ou respostas. Retorne apenas os campos necessários à tarefa.

## Diagnosticar falhas

Diferencie argumento inválido, permissão da conexão MCP, escopo Meta, acesso à conta e indisponibilidade do provedor. Preserve o código e a mensagem úteis da Meta sem devolver credenciais. Não prometa sucesso antes de receber e conferir a resposta.

Comece por `diagnose_connection` quando a falha envolver acesso. O diagnóstico verifica permissões e seleção local de contas; não testa acesso efetivo aos ativos, elegibilidade ou rollout. Valide depois a leitura na conta autorizada. Uma permissão concedida não comprova disponibilidade de todas as operações de Ads, Pages ou Instagram. Não refaça autenticação ainda válida nem solicite tokens pelo chat.

Consulte [PLAYBOOK.md](PLAYBOOK.md) para decisões de otimização e [ANDROMEDA.md](ANDROMEDA.md) para referências sobre estrutura e criativos. Esses guias são conteúdo do projeto; não representam uma política oficial nem garantia de performance da Meta.
