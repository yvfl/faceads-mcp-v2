# API offline da v2

Execute `npm run test:offline` da raiz. A bateria compila `dist/`, usa tokens
sintéticos e substitui os transportes Graph, DNS e HTTP de imagens por fixtures
locais. Não precisa de token real e não tem fallback para chamadas externas.

| Arquivo | Cobertura |
| --- | --- |
| `contract.test.mjs` | Nomes, campos e enums da main original; schemas executáveis; diferenças v2 explícitas. |
| `handlers.test.mjs` | Dispatch dos 60 nomes de API/contexto, endpoint, método, payload, defaults e permissões. |
| `meta-client.test.mjs` | Isolamento entre tenants, serialização e erros de transporte. |
| `v26-wrappers.test.mjs` | Placements, SAC, Threads, mensagens e Partnership. |
| `audit-regressions.test.mjs` | Reproduções originais da auditoria, agora como regressões permanentes. |
| `v2-hardening.test.mjs` | Registro e permissão fail-closed, bypass de método/token, timeout, datas, versões, lookalikes, métricas ausentes, paginação e sigilo de credenciais. |

Os 57 nomes públicos da main registrada em `../helpers/main-api-contract.json`
continuam presentes. Diferenças intencionais de contrato na v2:

- `update_budget_schedule` e `delete_budget_schedule` exigem `campaign_id` para
  comprovar que o agendamento pertence a uma campanha autorizada. Esse campo
  não é encaminhado ao endpoint Graph do agendamento.
- O orçamento diário de criação do ad set usa número inteiro na unidade mínima
  da moeda. O mínimo universal de R$5,33 foi removido.
- A opção de audiência precisa ser exatamente 0 ou 1. Os formatos de primeiro
  nível e aninhado são aceitos, mas valores conflitantes são recusados.
- Threads exige targeting explícito e anuncia todas as opções compartilhadas
  com criação de ad sets. As duas wrappers passam pela validação canônica.
- Erros locais retornam `isError`. Campos de data exigem formato ISO com fuso e
  calendário válido. O download de imagem exige raster público e limitado.
- Lookalikes usam audiência customizada como fonte: `origin_audience_id` e
  `lookalike_spec` são obrigatórios nessa modalidade. Outras origens não são
  anunciadas pela wrapper.
- Resultados de insights preservam linhas e dimensões. Métricas ausentes e
  divisões sem denominador válido aparecem como indisponíveis. Não há diagnóstico
  causal baseado em limiares fixos de atribuição incremental.

A coleta e a autorização HTTP têm baterias próprias. Resultados offline
comprovam contratos locais; aceitação remota, elegibilidade da conta,
permissões empresariais, revisão e entrega continuam dependendo da conta real.
