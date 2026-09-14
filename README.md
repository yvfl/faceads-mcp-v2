# FaceAds MCP v2

MCP para consultar documentação e operar Meta Ads. Esta versão é um projeto independente: novo repositório, serviço Railway, domínio e PostgreSQL. As conexões antigas continuam no projeto original.

As ferramentas são organizadas por domínio, com schemas executados na entrada e permissões no mesmo registro. Incluem campanhas, conjuntos, anúncios, criativos, audiências, insights, ativos, orçamento, diagnóstico da conexão, histórico de operações e documentação. Consulte `tools/list` para o catálogo da versão servida. A API padrão é v26.0; a versão pode ser configurada por `META_API_VERSION`.

## Conexão

No modo remoto, adicione `https://SEU-DOMINIO/mcp` ao cliente MCP. O cliente inicia o OAuth e abre a interface:

1. Entre ou crie sua conta FaceAds.
2. Informe seu token Meta. O servidor verifica identidade, permissões e contas na Graph API.
3. Selecione as contas e autorize o acesso solicitado pelo assistente.

Prévia da interface: [login no computador](audit/ui/login-desktop.png) e [seleção de contas no celular](audit/ui/contas-mobile.png).

O token manual foi mantido. Não há Login com Facebook nem cadastro de um novo app Meta no fluxo da v2. O token precisa ser válido e ter acesso aos ativos usados. Tokens temporários precisam ser substituídos quando expiram.

Cada conexão guarda a seleção de contas e uma referência ao token validado naquele consentimento. Uma conexão posterior não troca silenciosamente o token de uma conexão anterior. Revogar o acesso na tela de conexão invalida os tokens MCP daquele assistente para o usuário.

O acesso MCP dura uma hora e o aplicativo deve renová-lo automaticamente. A renovação pode ocorrer por até **90 dias desde a emissão ou última renovação bem-sucedida**. Cada renovação reinicia esse prazo; conexões em uso não exigem login mensal. Após 90 dias sem renovar, é necessário conectar novamente. A validade e as permissões do token Meta continuam independentes.

Renovar o acesso preserva a sessão MCP quando a autorização permanece a mesma. Novo consentimento ou redução de permissões exige outra sessão; reinício do servidor também pode exigir inicialização, sem necessariamente pedir novo login. Aplicativos diferentes podem reutilizar o token Meta salvo e mantêm conexões OAuth independentes.

Uma renovação antecipada mantém os access tokens anteriores válidos até seus vencimentos originais, permitindo concluir chamadas paralelas. Esses tokens perdem a capacidade de renovar. Redução de permissões, revogação e reutilização de refresh invalidam todos os acessos da autorização afetada.

O transporte remoto usa Streamable HTTP com respostas JSON por POST. O canal SSE independente é opcional no protocolo e não é oferecido: GET autenticado em `/mcp` retorna 405. A v2 não implementa notificações iniciadas pelo servidor. Isso também evita uma falha reproduzida em clientes Codex legados, cuja reconexão SSE pode renovar tokens em segundo plano sem persistir o novo refresh. As ferramentas, a descoberta OAuth por 401 e o encerramento de sessão por DELETE continuam disponíveis. Veja a [especificação de transporte MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#listening-for-messages-from-the-server).

Refresh tokens são de uso único. A reutilização de um refresh consumido reconhecido pelo servidor revoga a autorização correspondente, incluindo seu sucessor; outras conexões permanecem válidas. O aplicativo deve coordenar a renovação e guardar o novo refresh antes de reutilizar a conexão. Hashes consumidos são retidos por 90 dias para essa detecção, sem armazenar os tokens em claro.

Na renovação, o aplicativo pode omitir `scope` para manter as permissões concedidas. Pedir permissões adicionais com um refresh ainda válido retorna `invalid_scope` e preserva a autorização existente. Por exemplo, uma conexão de leitura não pode renovar pedindo gerenciamento. Refreshes expirados, consumidos ou incompatíveis com o cliente ou destino continuam retornando `invalid_grant`.

Nos logs do servidor, `oauth_refresh_rejected` identifica recusas após a validação do cliente e do destino. O campo `reason` distingue token não encontrado (`missing`), malformado (`malformed`), expirado (`expired`), reutilizado (`reused`), vínculo de cliente ou destino incompatível (`client_mismatch` / `resource_mismatch`) e escopo incompatível (`invalid_scope` / `reused_scope_mismatch`). `missing` também pode ocorrer após revogação; sozinho, não comprova perda de dados.

`oauth_token_issued` distingue emissão inicial e renovação pelo `grant_type`. Os eventos incluem o horário da aplicação (`timestamp`) e, quando a autorização é conhecida e pertence ao cliente e destino, uma referência pseudônima (`authorization_ref`). Ela permite relacionar eventos do mesmo consentimento, mas não identifica qual processo recebeu ou salvou a credencial. Em `reused`, `revoked_access_tokens` informa quantos registros de acesso foram removidos, incluindo acessos sobrepostos; zero significa que nenhum acesso dessa família foi removido nessa tentativa. Não são registrados tokens, hashes de tokens, corpos de requisição ou IDs de usuários e contas. Esses eventos são emitidos somente após commit; falhas de transação não registram emissão ou recusa confirmada.

## Executar localmente

Requer Node 22.12+ e npm. O modo stdio dispensa PostgreSQL:

```sh
npm ci
npx prisma generate
npm run build
```

Configure no cliente MCP:

```json
{
  "mcpServers": {
    "faceads-v2": {
      "command": "node",
      "args": ["/CAMINHO/faceads-mcp-v2/dist/index.js"],
      "env": { "META_ACCESS_TOKEN": "SEU_TOKEN", "META_API_VERSION": "v26.0" }
    }
  }
}
```

No stdio, o token e o processo local definem o acesso. A seleção de contas por consentimento aplica-se ao modo HTTP.

No OAuth HTTP, clientes que omitem `resource` usam o único destino configurado, `${MCP_BASE_URL}/mcp`, na autorização, troca de código e renovação. Valores explícitos devem corresponder exatamente a esse destino; vazio, nulo, múltiplos destinos ou outro endereço são rejeitados. O código e os tokens continuam vinculados ao recurso, cliente, usuário e contas consentidas. Essa compatibilidade usa o destino padrão previsto na [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html#section-2.1).

Para HTTP local, use um banco novo. `docker compose up -d postgres` oferece PostgreSQL local em `127.0.0.1:55437`, com os dados de exemplo de `docker-compose.yml`. Copie `.env.example` para `.env`, preencha `DATABASE_URL` e gere `MCP_ENCRYPTION_KEY` com `openssl rand -hex 32`. Depois:

```sh
npm run db:migrate
npm run start:http
```

A página inicial mostra a URL do conector. O login começa pelo cliente MCP, que fornece destino e PKCE. HTTP exige Bearer OAuth emitido pela v2; o token Meta pertence à conexão do usuário.

A negociação inicial anuncia `ads_read ads_management`. Na tela de autorização, a pessoa escolhe **Somente leitura** (padrão) ou **Leitura e gerenciamento**, além das contas permitidas. A escolha de leitura restringe o acesso mesmo se o token Meta permitir alterações. Para gerenciamento, o servidor revalida `ads_management` e o acesso às contas na Meta antes de emitir a autorização. O código e os tokens guardam apenas a permissão escolhida. Clientes que solicitam apenas `ads_read` continuam com acesso somente leitura. Conexões já autorizadas não ganham permissões com uma atualização: para mudar o acesso, inicie uma nova autorização no cliente MCP.

## Deploy Railway

O arquivo [.railway/railway.ts](.railway/railway.ts) declara a aplicação e um PostgreSQL persistente, com a conexão entre ambos. O [roteiro Railway](RAILWAY.md) explica a primeira aplicação por `railway config apply` e a migração do serviço já criado. Importar o GitHub ou fazer push sozinho não cria o banco. Use **projeto, banco, domínio e chave próprios** para a v2.

Uma réplica é suficiente: as sessões MCP ficam em memória, e os grants OAuth ficam no PostgreSQL. Após reinício, o cliente inicializa uma sessão nova. Não habilite várias réplicas sem implementar compartilhamento ou afinidade das sessões.

## Contratos e limites

- Toda tool operacional possui schema e permissão explícitos. Acesso `ads_read` não executa mutações; `ads_management` permite gerenciamento nas contas selecionadas.
- Argumentos desconhecidos na raiz da chamada são rejeitados antes da Graph API. Um filtro não suportado ou escrito incorretamente não é descartado silenciosamente. Objetos JSON aninhados mantêm o contrato do campo correspondente.
- `list_ads` aceita `effective_status` e `updated_since` (Unix timestamp em segundos), preservados durante a paginação. `ACTIVE` descreve status efetivo e, isoladamente, não comprova entrega no período.
- Chamadas por ID verificam a conta do objeto. Pages, pixels e outros ativos sem `account_id` precisam estar associados a uma conta autorizada. Audiências compartilhadas podem ser lidas e referenciadas após comprovar associação à conta, sem permitir mutações na conta proprietária. A busca de associação é limitada a 1.000 ativos por família/conta e 60 consultas/20 segundos por verificação; quando não é possível comprovar o acesso, a chamada falha.
- `execute_api` mantém flexibilidade dentro das operações suportadas pelo controle de acesso. Não aceita batch, substituição de credenciais/método ou expansões arbitrárias de campos no HTTP. Endpoints novos precisam entrar na política de autorização antes de uso remoto.
- Parcerias podem referenciar conteúdo de criadores externos mediante o ad code e os controles da própria Meta. A seleção de contas restringe as contas de anúncios operadas; não representa propriedade de todo conteúdo usado numa parceria.
- `update_budget_schedule` e `delete_budget_schedule` exigem também `campaign_id`, para comprovar que o agendamento pertence à campanha autorizada.
- Orçamentos usam unidades mínimas da moeda da conta; não há mínimo universal em reais. Campos de métricas seguem a unidade/moeda da Graph API. Ausência de atribuição incremental é indicada como indisponível.
- Listas tipadas e consultas de Insights percorrem páginas automaticamente por padrão (`pagination_mode: "all"`). O padrão é 10 páginas, configurável por `max_pages` até 50, com orçamento interno de 25 segundos por coleção. `limit` define o tamanho de cada página. Para obter apenas uma página, use `pagination_mode: "page"`; `execute_api` continua com uma página por padrão.
- Consulte `structuredContent.pagination`: `complete` informa se a consulta inteira foi concluída; `scope: "from_cursor"` identifica uma continuação que não inclui as páginas anteriores. Cada coleção registra endpoint, páginas, quantidade retornada e motivo de interrupção. Resultados parciais começam com `RESULTADO INCOMPLETO`. Limite, timeout ou falha durante a continuação impedem que um recorte seja anunciado como total.
- `search_geolocation` retorna uma página de 25 sugestões por padrão, com continuação por `after` ou `pagination_mode: "all"`. Buscas podem repetir locais entre páginas. Os exemplos de targeting usam a chave do tipo correspondente; uma chave de cidade não serve como chave de região.
- Nas ferramentas de leitura paginadas, cada `structuredContent.pagination.collections[].next` indica `tool` e `arguments` para a próxima chamada. Execute a ferramenta indicada com esses argumentos; campos, filtros, período, atribuição e cursor são preservados. Esse fluxo funciona em clientes que expõem apenas ferramentas com `readOnlyHint: true`, sem depender de `execute_api`. Reúna as páginas da mesma coleção antes de concluir quantidade ou desempenho global.
- O relatório de anúncios com métricas pode retornar dois cursores: `list_campaign_ads` continua a listagem; `get_campaign_insights`, em nível de anúncio, continua as métricas. Cada cursor pertence à sua coleção. Ambos os caminhos respeitam o limite por página solicitado.
- Os campos legados `next.endpoint` e `next.params` continuam disponíveis. Chamadas feitas diretamente por `execute_api` com GET continuam pela mesma ferramenta; leituras sem uma rota tipada de paginação não anunciam uma chamada tipada inexistente. No servidor, GET é permitido com acesso de leitura, mas o catálogo de `execute_api` tem `readOnlyHint: false` por também oferecer escrita.
- Relatórios preservam todas as linhas, períodos e dimensões de Insights, incluindo dimensões dentro de ações e CPA. Métrica ausente continua indisponível; falha de consulta não vira zero nem ausência de entrega.
- Listas e detalhes preservam os campos retornados, inclusive JSON, `null`, zero e `false`; credenciais são ocultadas também em objetos aninhados. Campos não consultados não comprovam ausência de vínculo Instagram, inatividade de pixel ou orçamento no conjunto. Custos menores que um centavo não são arredondados para zero.
- Erros de consulta, acesso, limite da Meta e timeout têm orientações distintas em `error.action`, inclusive em páginas parciais. Siga essa orientação antes de continuar. Ao alterar campos, filtros ou período, reinicie a consulta; não misture páginas de recortes diferentes. Escritas de resultado incerto continuam bloqueadas e encaminham para `get_operation_status`.
- `diagnose_connection` separa permissões da conexão MCP, escopos do token Meta e seleção local de contas. O diagnóstico consulta permissões; acesso efetivo aos ativos, elegibilidade, rollout e escrita continuam sem teste. Um escopo presente não prova sucesso de toda operação da família. Valide depois a leitura na conta autorizada.
- Criação de campanhas, conjuntos e anúncios sempre usa `PAUSED`, inclusive cópias. Solicitar criação `ACTIVE` é rejeitado. Ative depois em uma operação separada com intenção explícita do usuário.
- Escritas aceitam `request_id` para acompanhar e repetir com segurança a mesma intenção. `get_operation_status` consulta o histórico; `inspect: true` permite conferir o objeto de uma operação pendente ou incerta quando seu ID é conhecido. Uma escrita pendente ou de resultado incerto bloqueia a repetição idêntica, inclusive com outro `request_id`. Se uma criação perder a resposta antes de devolver o ID, o sistema não pode confirmar automaticamente se o objeto existe.
- O histórico persiste no PostgreSQL em HTTP e em arquivo local no stdio, sem gravar credenciais ou payloads pessoais. Registra operação, responsável, endpoint, entidade conhecida, campos alterados e resultado; cada conexão acessa seus próprios registros. É o histórico das operações que passaram por esta instalação, não o histórico completo do Ads Manager.
- Downloads de imagem têm limite de 10 MB, 30 segundos e três redirects, com validação de DNS/IP público. Não aceitam SVG.
- A interface pede consentimento para gerenciamento. O MCP não adiciona uma confirmação humana por operação: a aprovação de alterações deve fazer parte do fluxo do assistente. Ativar anúncios pode gerar gastos.

## Testes e documentação

```sh
npm test
npm audit
```

A bateria padrão testa payloads, protocolo MCP, documentação, pacote, autenticação e segurança sem token Meta real. Testes de integração com PostgreSQL só rodam quando `DATABASE_URL_TEST` aponta para banco local isolado com `test` no nome. O [plano de testes](TEST_PLAN.md) inclui browser real e a bateria posterior de leitura/escrita PAUSED na conta real.

A coleta usa o Markdown oficial, com proveniência, cache, retomada e publicação de índice ao finalizar:

```sh
npm run discover
npm run scrape -- --no-prune
```

Para retomar uma coleta interrompida, use `npm run scrape:resume -- --no-prune`. A retomada reaproveita páginas válidas do cache; uma atualização completa deve usar `scrape`.

Inclui Marketing API, Conversions API, Catalog, Gateway e referências públicas selecionadas do MCP oficial em `ads-ai-connectors/`. A presença de uma operação no corpus não significa que ela esteja implementada no FaceAds. `tools/list`, os schemas e a autorização da conexão definem as operações executáveis. As regras do MCP oficial não são herdadas pelas nossas chamadas Graph.

Para atualizar apenas referências específicas, use `npm run scrape -- --path=https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-get-started`. `--path` aceita repetição, consulta somente os caminhos indicados e desabilita expansão e poda. O índice preserva os documentos anteriores e a retomada pontual usa cache separado do manifesto de uma coleta completa. Nenhum catálogo autenticado é incorporado por esse comando.

Falhas da fonte ficam registradas no índice e preservam os documentos existentes, com suas datas de coleta anteriores. A busca destaca arquivos marcados `stale: true`. Arquivos `AGENTS.md` internos não são expostos como documentação.

O [relatório da v2](VALIDACAO-V2.md) separa evidência local, browser, container e validação pendente na Meta. A [auditoria original](AUDITORIA-MCP-2026-09-12.md) é histórica e descreve a branch anterior às correções.
