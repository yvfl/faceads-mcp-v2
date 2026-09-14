# Parecer independente da v2

Data: 12/09/2026. Repositório auditado: `faceads-mcp-v2`.

## Resultado

Os bloqueios concretos encontrados nesta auditoria foram corrigidos e suas reproduções passaram após recompilar o projeto. Não identifiquei bloqueio local restante nos cenários abaixo. O projeto está apto a seguir para os testes controlados com uma conta Meta real, sem que isso represente comprovação de funcionamento de todas as modalidades da API em produção.

A revisão foi realizada por um agente separado dos implementadores. O auditor leu a implementação, executou reproduções próprias e repetiu os testes relevantes. Não implementou as correções. A única alteração persistida por este agente é este parecer.

## Achados e confirmação das correções

| Problema encontrado | Correção observada e evidência independente |
| --- | --- |
| JSON com espaço ou quebra de linha inicial escapava da autorização de referências. `creative: ' {"id":"222"}'` era aceito, embora a mesma estrutura sem espaço fosse negada. | A identificação de JSON considera espaços iniciais. Foram negadas 12 variantes independentes combinando espaços, tabulação e quebras de linha com `creative`, `targeting` e regras de pixel de outra conta. |
| Referências em `event_sources[].id`, audiência fonte e publicação existente não comprovavam a conta ou associação autorizada. | Os testes próprios negaram pixel externo em `rule.inclusions.rules[].event_sources`, `origin_audience_id` externo, `object_story_id` cuja Página está fora da autorização e referência externa em `adlabels`. |
| Audiências legitimamente compartilhadas eram bloqueadas pelo proprietário estar em outra conta. | A associação comprovada em `act_ID/customaudiences` permite leitura e uso da audiência. Os mesmos testes negaram `POST` e `DELETE` diretamente no objeto pertencente à outra conta. |
| Durante a primeira correção de compartilhamento, a prova permissiva era reaproveitada para uma referência estrita do mesmo ID. O resultado dependia da ordem das propriedades. | O cache de provas diferencia propriedade e compartilhamento. As duas ordens de `targeting.custom_audiences` e `creative` foram novamente executadas e ambas negaram a referência estrita externa. |
| Exclusão de Value Rule Set usava uma edge que o próprio guard bloqueava. | `POST /ID/delete_rule_set` passou no teste próprio quando o objeto pertence à conta autorizada. A leitura da documentação local confirma essa edge. |
| Atualização e exclusão de orçamento tentavam descobrir `account_id` em `HighDemandPeriod`, que não oferece esse campo. | As ferramentas exigem a campanha, comprovam a conta dessa campanha e a presença do agendamento em sua edge `budget_schedules`. Os testes próprios aceitaram vínculo correto e negaram campanha externa, agendamento de outro vínculo e ausência da campanha. Via `handleApiTool`, o contexto da campanha não foi encaminhado indevidamente ao corpo da requisição Graph. |
| A ferramenta de audiência anunciava `LOOKALIKE`, mas não preservava os parâmetros necessários. | Uma chamada própria a `handleApiTool` confirmou `origin_audience_id` e `lookalike_spec` no corpo final enviado ao transporte Graph simulado. |
| Ausência de métricas incrementais era apresentada como zero e gerava recomendações por cortes arbitrários de 30% e 50%. | Nos dois relatórios, respostas simuladas sem incrementality produziram `Não disponível`. Não produziram os alertas ou interpretações arbitrárias anteriormente identificados. |
| A comprovação de ativos podia multiplicar consultas por contas, famílias de ativos e páginas. | Teste próprio interrompeu a busca após exatamente 60 consultas. Outro teste com uma leitura que nunca resolve terminou em 20.000 ms. A filtragem de três Páginas reutilizou uma única consulta de associação. |

Arquivos centrais revisados: `src/auth/account-authorization.ts`, `src/meta-client.ts`, `src/api-tools.ts`, `src/schemas/api-schemas.ts`, `src/tools/audiences.ts`, `src/tools/management.ts` e `src/tools/insights.ts`.

## HTTP, OAuth e isolamento entre conexões

Foram revisados os caminhos de login, validação do token Meta, seleção de contas, consentimento, troca de código, renovação, revogação e resolução de bearer. O grant preserva o token Meta e as contas daquela autorização, em vez de escolher o token mais recente do usuário. As sessões MCP são vinculadas ao grant e o bearer é revalidado nos pedidos HTTP.

Além dos testes do repositório, foi executada uma prova independente com o transporte HTTP do SDK e PostgreSQL local isolado: dois usuários, dois grants, dois tokens e duas sessões receberam 16 chamadas concorrentes. O contexto de autenticação permaneceu correto antes e depois de uma espera assíncrona em todas as chamadas. As fixtures próprias foram removidas ao terminar.

Também foram revisados a criptografia AES-256-GCM, o armazenamento de segredos OAuth por hash, o vínculo do fluxo ao navegador, CSRF e o downloader de imagens. Não encontrei bypass concreto adicional nesses caminhos durante esta revisão. Isso é uma conclusão sobre os cenários examinados, não uma garantia de ausência de vulnerabilidades.

## Execuções de confirmação

1. `npm run build`: passou.
2. `node --test tests/security/*.test.mjs tests/auth/*.test.mjs`, com `DATABASE_URL_TEST` apontando para PostgreSQL local isolado: **53 testes passaram, zero falhas e zero testes ignorados**.
3. Reproduções próprias executadas com Node, importando a compilação atual: variantes de JSON, referências externas, compartilhamento e referências mistas, vínculo de orçamento, limite e cache de consultas, timeout real, encaminhamento de LOOKALIKE e apresentação de métricas ausentes: passaram conforme a tabela.
4. Prova HTTP concorrente independente descrita acima: 16 de 16 chamadas mantiveram seu próprio contexto.

As respostas Graph dessas execuções foram simuladas. O PostgreSQL e o transporte HTTP utilizados nos testes foram reais e locais. Nenhum banco ou deploy antigo foi utilizado.

## Limites para publicação e validação externa

- Este parecer confirma as correções locais identificadas. Um token real ainda precisa comprovar identidade, permissões e leitura de uma conta real.
- Criação, edição, exclusão e modalidades como parceria, Threads, mensagens, audiências compartilhadas e agendamento precisam ser exercitadas com ativos e permissões compatíveis. Uma resposta simulada não comprova que uma conta específica terá acesso a essas modalidades.
- O limite de 60 consultas e 20 segundos é aplicado à operação de autorização/filtragem. Não representa um prazo global de qualquer ferramenta que execute várias consultas sucessivas.
- O guard aceita um conjunto explícito de endpoints, expansões e referências. `execute_api` não deve ser apresentado como acesso irrestrito a toda a Graph API.
- Esta auditoria não executou publicação no Railway nem certificou o comportamento de um container publicado. Preparação do deploy e execução local devem ser reportadas separadamente da validação externa.

## Identificação do código conferido

O repositório ainda estava sem commit no momento da confirmação. SHA-256 de arquivos centrais após a recompilação e as reproduções finais:

```text
8bc40883228d309a3444d5ed30636cd53ef71fdbfee4123f31c783194f09a9ff  src/auth/account-authorization.ts
6b45bfa47f45e39088800829905f4ec2237725c52af1bdb580998ac7554e582a  src/meta-client.ts
e7fc882848f972a1dffe694b635d4b83a71747b7594bcba97177c8a6fc060738  src/transports/http-server.ts
2e682849a7164a419dae8a5b240354de51eb5d11f78d55f0bb1bd15294b50404  src/routes/oauth.ts
76d3b575ad2dcfc932ea5edf0eae7ace828c5bde2d1a7073d9ba7d2137b1cd53  src/utils/safe-download.ts
d8a3ca52b0e523bba0b9dd9d0ab67ee54f1b2f852c6c68326cf8e8867fc1edec  src/schemas/api-schemas.ts
90ca7ef2d68704b83793e0b106cb652e049172265dcfe6cdbed732c3b5ddbe2c  src/tools/insights.ts
eb735825422db250aa121ddfe7183fcfa08f7bf24237c0a8b936356a39a3592a  src/tools/audiences.ts
bb099e19e115cd363cec730c00d12a8f6359c8677c5d9ae77f20a5a1b98e126f  src/tools/management.ts
```
