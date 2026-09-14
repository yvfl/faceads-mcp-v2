# Auditoria independente dos contratos da API

Data: 2026-09-12. Snapshot isolado: `/tmp/faceads-mcp-audit-1a3bac5`, commit `1a3bac5`, comparado com `main` em `fa8fa40`.

Conclusão: não recomendo promover a branch como funcional e compatível. A atualização de referências e o envelope de Advantage+ fazem sentido, mas há falhas novas de autorização, payload de Partnership e compatibilidade de targeting. Nenhuma chamada real de escrita foi feita; aceitação e entrega pela Meta continuam pendentes de conta/token autorizados.

## Método e limites

- Li apenas o snapshot durante a auditoria original, sem incorporar alterações/testes da raiz.
- Comparei o diff com main, docs regeneradas e páginas oficiais consultadas novamente.
- Executei o código original TypeScript em memória com `transpileModule`, módulos isolados e `fetch` falso. Não alterei o runtime nem instalei dependências. As respostas de sucesso eram simuladas, usadas exclusivamente para inspecionar métodos/payloads emitidos.
- A ferramenta web recebeu 429 em páginas oficiais. Consultas GET com `Accept: text/markdown` retornaram HTTP 200 para os guias de Partnership e Advantage+; o blog v26 retornou HTML 200 com `?locale=en_US`. Nenhuma fonte de terceiros foi necessária para as conclusões.

## 1. As três novas ferramentas contornam a permissão de leitura

Evidência: `src/api-tools.ts:2140-2149`, `2496-2504`; `src/auth/permissions.ts:96-99` e ausência dos três nomes no mapa.

Reprodução: chamar qualquer nova ferramenta sob `withAuthContext({accessToken:'audit-offline-only',permissions:'read'})`. O transporte falso recebeu POST em `/act_123/adsets` para Threads e Messaging, e POST em `/act_123/adcreatives` para Partnership. `create_adset` e `create_creative` antigas são corretamente bloqueadas no mesmo contexto.

Impacto: chave MCP de leitura consegue escrever quando o token Meta associado permite gerenciamento. Os dois ad sets também aceitam `status:'ACTIVE'`, agravando a consequência. A falha do fallback já existia, mas a introdução das ferramentas sem cadastro a torna explorável por estes novos caminhos.

Recomendação: registrar as três como write e exigir classificação explícita de qualquer ferramenta API nova. Testar que nenhuma escrita chama o transporte sob permissão read. Este é um bloqueio para promoção.

## 2. Partnership ad codes são enviados no nível errado

Evidência: `src/api-tools.ts:5130-5141`, `src/meta-client.ts:637-640`.

Reprodução: `create_partnership_ad_creative` com modo `boost_existing_fb_post`, `object_id:'456'` e `facebook_boost_post_access_token:'fake-ad-code'` emite campos raiz `name`, `object_id`, `facebook_boost_post_access_token`. O campo `branded_content` inexiste. O modo Instagram faz o mesmo com seu token.

O contrato documentado coloca ambos os ad codes dentro de `branded_content`. Evidência local: `docs/ad-creative/partnership-ads/ads-creation/boost-existing-post.md:219-241` e `boost-existing-fb-post.md:139-164`. Ambas as fontes oficiais foram verificadas com HTTP 200 no momento da auditoria: [Instagram](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post), [Facebook](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-fb-post).

Impacto: o payload emitido não corresponde ao contrato de autorização via ad code. Não é possível declarar este caminho funcional; erro remoto ou ausência da autorização esperada precisa ser resolvido antes da validação live.

Recomendação: montar `branded_content` com o ad code e suportar `ad_format` quando apropriado, mantendo os dados de sponsor separados. Testar o corpo HTTP final, não apenas argumentos do mock de `createCreative`.

## 3. O caminho documentado de Instagram com ad code sozinho é bloqueado

Evidência: `src/api-tools.ts:5088-5100` exige `source_instagram_media_id` em todos os casos de boost Instagram.

Reprodução: fornecer `account_id`, `name`, `mode:'boost_existing_post'`, `object_id` e `instagram_boost_post_access_token`, sem media ID, retorna erro antes de qualquer requisição.

A documentação diferencia criação por media ID e criação por ad code; o exemplo por ad code não requer media ID. Mesma [fonte oficial Instagram](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post), seção “Using a partnership ad code”.

Recomendação: representar as duas alternativas no schema e validar que ao menos uma fonte de conteúdo foi fornecida; não obrigar um media ID para usar o código do criador.

## 4. Nova validação de categorias especiais rejeita chamadas válidas anteriores

Evidência: `src/api-tools.ts:2921-2939`; código antigo de normalização em `2945-2952` já aceita a opção aninhada.

Reprodução confirmada: campanha fake com `special_ad_categories:['HOUSING']`; `targeting:{geo_locations:{countries:['BR']},targeting_automation:{advantage_audience:0}}`; sem a opção redundante de nível superior. Há GET da campanha e erro local, sem POST, embora o valor requerido já esteja explícito no local correto do payload Meta.

O mesmo bloqueio ocorre com targeting inteiramente padrão. A Meta exige a opção explícita nas configurações restritas; mantém o default nas configurações padrão ou relaxadas. Verificação atual: [lançamento oficial v26](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/?locale=en_US) e [guia Advantage+](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience).

Impacto: consumidores existentes que usavam corretamente a representação nativa passam a falhar ao atualizar o MCP. A mensagem também descreve a regra Meta de forma mais abrangente que o contrato real.

Recomendação: resolver uma opção efetiva a partir dos dois locais suportados, rejeitar conflitos explícitos, respeitar configurações padrão/relaxadas e condicionar regras por versão. A leitura da campanha também deve ser evitada quando desnecessária.

## 5. Novas wrappers não preservam a normalização do create_adset

Evidência: `src/api-tools.ts:4947-4960` e `5040-5053` chamam `client.createAdSet` diretamente, em vez do caminho canônico. Não fornecem `targeting_automation` nem tratam `advantage_audience` de nível superior. O cliente só injeta `bid_strategy`, em `src/meta-client.ts:495-500`.

Reprodução confirmada em Threads: targeting com `age_min:30` e `age_max:50` emite POST sem `targeting_automation`. Messaging usa a mesma montagem direta. Segundo o guia oficial atual, configurações restritas sem opção explícita são rejeitadas pela API, inclusive fora de categorias especiais desde v23. [Fonte oficial](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience).

Impacto: opções comuns anunciadas como “targeting extra” produzem payload inválido por uma ferramenta vendida como wrapper do caminho existente. Passar manualmente a opção nativa dentro de targeting contorna este caso, mas a tool não mantém o comportamento prometido.

Recomendação: compartilhar preparação/validação canônica dos ad sets e testar paridade do corpo final, preservando apenas diferenças intencionais de destino/posicionamento.

## 6. Threads anuncia estratégias de lance que não consegue completar

Evidência: schema `src/api-tools.ts:1877-1880` oferece `LOWEST_COST_WITH_BID_CAP` e `COST_CAP`, mas tipo `4911-4925` e montagem `4947-4960` omitem `bid_amount`.

Reprodução confirmada: chamar com `bid_strategy:'COST_CAP',bid_amount:1000` emite `bid_strategy=COST_CAP` sem `bid_amount`, mesmo que o consumidor tente fornecer o campo extra.

O valor é requerido para essas estratégias. Evidência documental local: `docs/ad-creative/messaging-ads/click-to-whatsapp.md:131`, além da referência geral de bidding. [Guia oficial](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp).

Recomendação: expor, validar e encaminhar o valor do lance ou retirar as estratégias não suportadas. Não recomendar promover enquanto um caso anunciado produz payload incompleto.

## 7. As validações v26 ignoram a versão escolhida pelo cliente

Evidência: `src/api-tools.ts:1999-2026` e `2039-2071` não recebem versão; são chamadas incondicionalmente por create_adset/create_creative. O cliente continua permitindo versão explícita, em `src/meta-client.ts:120` e `src/utils/config.ts:74`.

Cenário: consumidor mantém `v25.0` e Messenger Stories ou enquete em setembro/2026. O MCP passa a rejeitar localmente mesmo quando a Meta ainda preserva o comportamento anterior até a data de mudança entre versões. O [lançamento oficial v26](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/?locale=en_US) delimita v26 inicialmente e 27/10/2026 para a mudança de Messenger Stories e enquete em todas as versões.

Recomendação: tornar as validações conscientes da versão efetiva e da data relevante, ou documentar e impor formalmente que o MCP só suporta v26. Manter override que é ignorado pelas regras locais causa incompatibilidade desnecessária.

## 8. Detecção de enquete é mais ampla que a remoção documentada

Evidência: `src/api-tools.ts:2055-2056` marca qualquer presença de `interactive_components_spec` como enquete, sem ler `type`.

Reprodução local confirmada: mesmo um objeto sem qualquer `poll_spec` nem `type:'poll'` é bloqueado com mensagem de enquete. A [fonte v26](https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/?locale=en_US) remove especificamente o tipo poll, não todo o container.

Limite: não usei uma conta real para comprovar um tipo alternativo elegível neste posicionamento da estrutura; o defeito de predicate é certo, a abrangência prática de criativos afetados exige fixture oficial adicional. Não usei isto como único bloqueio de release.

Recomendação: verificar conteúdo/tipo, adicionar fixture sem enquete e preservar outros componentes aceitos. A validação também não é aplicada pelo handler Partnership, que chama o cliente diretamente.

## Observações de escopo e legado

- A correção de `creative_features_spec` para `degrees_of_freedom_spec.creative_features_spec` faz sentido e mantém a interface pública antiga. Os schemas preservam campos extras nas estruturas internas relevantes; `threads_user_id` dentro de `object_story_spec` não é apagado.
- Os placements fixados para Threads correspondem ao guia regenerado. O problema está nos campos/validações não compartilhados.
- `whatsapp_phone_number` é opcional no guia oficial, embora a wrapper o exija. Pode ser uma escolha explícita do produto, mas deve ser documentada como restrição do MCP; não é requisito geral da Meta.
- O mínimo fixo em reais para qualquer conta e alguns avisos de idade Advantage+ já existiam na main. A documentação nova permite certos valores de idade mínima que o aviso antigo chama de erro. São débitos anteriores, não regressões criadas pelo diff.
- A referência de Partnership com criativo novo mostra campos adicionais em `degrees_of_freedom_spec`, e ambos os sponsors podem ser omitidos pela wrapper. Isto merece teste live por modalidade; não concluo aceitação remota a partir de respostas falsas.
- Não identifiquei remoção de nomes antigos de tools no escopo auditado. Manter os nomes não basta para compatibilidade se validações novas bloqueiam payloads antes aceitos.

## Critérios mínimos de reavaliação

1. Zero POST/DELETE sob permissão MCP read em todos os caminhos de escrita.
2. Payloads Partnership correspondendo às duas alternativas oficiais, com ad codes no container correto.
3. Paridade de normalização entre create_adset, Threads e Messaging, incluindo lance e opção de audiência.
4. Payloads legados com opção aninhada continuam funcionais; validações respeitam versão efetiva.
5. Após gates offline, validar token/conta/permissões com leitura real; só então criar recursos PAUSED em conta explicitamente autorizada, ler de volta e limpar apenas IDs do próprio run.

Uma suite offline pode provar os contratos locais e detectar estes defeitos. Não pode provar permissões empresariais, elegibilidade de conta/creator, revisão, entrega nem sucesso real da Marketing API.
