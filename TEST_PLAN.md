# Goal

Validar a v2 independente do MCP Meta Ads sem confundir build local, protocolo MCP, payload simulado e aceitação pela conta real. A auditoria inicial está em [AUDITORIA-MCP-2026-09-12.md](AUDITORIA-MCP-2026-09-12.md).

## Bateria sem token

Em checkout novo, com Node compatível com Prisma 7 (a execução auditada usou Node 22.23.0):

```sh
npm ci
npx prisma generate
npm test
```

Com dependências já preparadas, `npm test` compila e executa todos os testes offline. A suite não depende de banco ou token real. Os processos do servidor recebem ambiente filtrado; os testes de Graph e scraping substituem a rede por fixtures. Os testes HTTP abrem somente servidores locais de teste.

```sh
npm run test:offline
npm run test:protocol
npm run test:release
npm run test:scraper
```

O resultado histórico da branch anterior foi 312 testes, com 30 falhas. A v2 corrige essas regressões e adiciona casos de autenticação, autorização e transporte. O resultado atualizado está em [VALIDACAO-V2.md](VALIDACAO-V2.md).

Para integração, use um PostgreSQL local separado cujo nome contenha `test`, aplique a migração inicial e configure somente `DATABASE_URL_TEST`. A variável é validada pelos testes antes de qualquer escrita:

```sh
DATABASE_URL_TEST=postgresql://USUARIO:SENHA@127.0.0.1:PORTA/faceads_v2_test npm test
DATABASE_URL_TEST=postgresql://USUARIO:SENHA@127.0.0.1:PORTA/faceads_v2_test npm run test:browser
```

Os testes de banco criam e apagam seus próprios registros sintéticos. Sem essa variável, os testes de integração são explicitamente pulados. O browser usa um perfil novo com Playwright e respostas Meta simuladas; é preciso ter Chromium do Playwright (`npx playwright install chromium`) ou Chrome local instalado. Capturas ficam em `.audit-results/visual/`.

O gate de release simula o conteúdo copiado pelo Dockerfile e planeja npm ci em diretório temporário. Não substitui um build Docker real nem um deploy de homologação. O teste de manifesto npm verifica inclusão dos guias, não executa publicação npm.

## Preparar a conta real

Esta fase está pronta para execução posterior; não foi executada contra a Meta nesta auditoria. Fornecer um token não autoriza por si só criar ou alterar objetos de anúncio. Começar pela leitura.

```sh
cp .env.test.example .env.test
cp tests/live/account.example.json tests/live/account.local.json
```

Editar os dois arquivos localmente. Ambos são ignorados pelo Git. Não colocar tokens em argumentos de terminal, arquivos versionados ou mensagens de auditoria.

- `.env.test`: preencher `META_LIVE_ACCESS_TOKEN` para stdio. A variável é separada do token normal do servidor.
- `account.local.json`: preencher `account_id` no formato `act_ID` e `targeting.geo_locations`. Para escrita, também Page ID, URL HTTPS própria, hash de imagem já existente na conta e orçamento em unidades mínimas da moeda da conta.
- A fixture exemplifica BR e 600 unidades mínimas; adequar ao país, moeda e ativos reais. O executor limita orçamento de teste a 600..10000 e força status PAUSED. Isso é uma contenção do teste, não um mínimo universal da Meta.
- `page_id` ativa também testes de páginas e Instagram. Omitir esse campo se a fase de leitura deve excluir esses ativos. Resultados vazios de listas podem ser legítimos; um resultado vazio não comprova CRUD desses recursos.

Conferir o plano sem credenciais e sem conexões:

```sh
npm run test:live -- --config tests/live/account.local.json --dry-run
```

## Leitura autenticada

```sh
npm run build
node --env-file=.env.test scripts/test-live.mjs --config tests/live/account.local.json
```

O executor faz initialize e tools/list pelo SDK MCP, confere acesso ao ID exato da conta, lê status/moeda/fuso, executa descoberta, campanhas, ad sets, anúncios, criativos, audiências, pixels, labels, value rules, insights, estimativa de alcance e geolocalização. Com Page ID, lê páginas e Instagram. Cada erro fica registrado; o resultado final falha se algum cenário falhar.

Campos opcionais de fixtures existentes: `campaign_id`, `adset_id`, `ad_id`, `creative_id`, `pixel_id`, `video_id`. Eles habilitam leituras específicas e insights. Esses IDs existentes nunca entram na lista de limpeza.

O token precisa ter acesso aos ativos escolhidos. `ads_read` cobre as leituras de anúncios; páginas, Instagram e outras famílias podem exigir permissões adicionais e relações empresariais. Uma falha deve ser diagnosticada pelo código/retorno Meta antes de ser atribuída ao MCP. O executor não concede escopos nem altera a conta para fazer um teste passar.

Relatórios ficam em `.audit-results/`, ignorada pelo Git. Incluem tempos, falhas redigidas, metadados mínimos da conta e IDs dos recursos de teste. Não armazenam os resultados completos de todas as listas. Tratar esses relatórios como dados privados da conta.

## Escrita PAUSED, apenas após autorização da conta

Revisar primeiro o plano concreto:

```sh
npm run test:live -- --config tests/live/account.local.json --dry-run --write --confirm-account act_ID_REAL
```

Com autorização expressa, executar:

```sh
node --env-file=.env.test scripts/test-live.mjs --config tests/live/account.local.json --write --confirm-account act_ID_REAL
```

O ID confirmado deve coincidir exatamente com o arquivo. O executor exige leituras aprovadas antes de iniciar escrita e uma conta ativa.

Sequência:

1. Cria campanha de tráfego, ad set, criativo com envelope Advantage+ e anúncio, todos os objetos publicáveis PAUSED.
2. Lê de volta conta, nome, estado, associação campanha/ad set/anúncio/criativo e orçamento. Atualiza nomes dos objetos próprios, pausa novamente e confirma.
3. Cria ad set Threads na campanha de teste e confirma os placements persistidos.
4. Executa modalidades opcionais abaixo quando suas fixtures estiverem presentes.
5. Limpa em ordem inversa exclusivamente os IDs retornados por criação e cuja conta/nome do run foram conferidos. Exige `success:true` no DELETE. A limpeza também roda se uma etapa intermediária falhar.

O executor grava intenção antes da criação. Um timeout, processo interrompido ou resposta sem ID pode deixar resultado incerto. Nesse caso, consultar `pending` e `objects`, procurar os nomes exatos do run na conta e verificar antes de repetir. Não há retry automático de escrita. Se a conta/nome retornados não coincidem, o ID não é apagado automaticamente; o relatório exige revisão. Se o objeto é comprovadamente do teste, mas veio ACTIVE indevidamente, o teste falha e a limpeza continua elegível.

## Modalidades opcionais

Adicionar somente dados de ativos cuja validação foi autorizada:

```json
{
  "messaging": {
    "destination": "WHATSAPP",
    "whatsapp_phone_number": "+55NUMERO_REAL"
  },
  "special_ad_category": "HOUSING",
  "partnership": {
    "mode": "boost_existing_fb_post",
    "facebook_boost_post_access_token": "AD_CODE_AUTORIZADO"
  }
}
```

Esses campos complementam a fixture, não substituem seus campos obrigatórios. Messaging cria campanha própria de Engagement e confere destino e Page ID persistidos. Também aceita `MESSENGER` e `INSTAGRAM_DIRECT`.

Categoria especial cria uma campanha própria e usa a escolha de audiência na estrutura nativa `targeting.targeting_automation`. O caso confere o contrato nativo de audiência corrigido na v2. Adequar targeting às restrições reais da categoria.

Partnership Instagram usa `mode: boost_existing_post` e `instagram_boost_post_access_token`, ou `source_instagram_media_id` conforme o modo autorizado. A v2 aceita código sem media ID nesse modo. O executor cobre criação/leitura/limpeza de creative; não comprova a associação a anúncio, identidade renderizada, revisão ou entrega. `use_new_creative` não está habilitado nessa fixture live e exige roteiro adicional próprio.

O fluxo Threads cria e inspeciona ad set; entrega de criativo em Threads depende também da identidade e elegibilidade da conta. O mesmo limite vale para WhatsApp Status, upload de vídeo, audiences com dados pessoais, regras de valor, agendamento, CAPI e campanhas Advantage+ completas: não estão cobertos pela escrita live automática inicial. Nenhuma ferramenta de ativação de anúncios é chamada.

## Validar o deploy HTTP

Em `.env.test`, preencher `META_LIVE_MCP_URL=https://SEU_MCP/mcp` e `META_LIVE_MCP_BEARER` com o Bearer OAuth do próprio MCP. O token Meta vinculado àquele usuário fica no banco do servidor.

Repetir os mesmos comandos de leitura e, somente se autorizado, escrita. O executor usa Streamable HTTP do SDK e exige HTTPS para host remoto. Não envia `META_LIVE_ACCESS_TOKEN` como override. Só um token Meta não autentica o HTTP atual.

O smoke HTTP cobre health e metadata. Os testes com PostgreSQL cobrem login, consentimento, seleção, refresh concorrente, revogação, token vinculado ao grant e rejeição de sessões de outro grant. O navegador real verifica o fluxo completo até o callback. Repetir a conexão no deploy e no cliente MCP que as empresas utilizarão continua necessário: o teste local não comprova proxy, domínio, cliente remoto ou permissões reais Meta.

## Critério de liberação

Zero falhas offline; build e inspeção do artefato real; leitura autenticada aprovada; fluxos PAUSED aplicáveis aprovados com readback e limpeza; HTTP/banco validados no ambiente das empresas. O relatório deve distinguir claramente modalidades ainda não exercitadas. A publicação no Railway cabe ao responsável pela instalação. A v1 não é destino de merge desta implementação.
