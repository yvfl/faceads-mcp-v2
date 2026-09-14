# Auditoria independente: coleta, documentação e resources

Snapshot auditado: `/tmp/faceads-mcp-audit-1a3bac5`, HEAD `1a3bac5`, comparação `fa8fa40` (main). Data: 2026-09-12. A leitura dos scripts e do corpus ocorreu em snapshot isolado antes de escrever testes na raiz. Nenhum arquivo de produção foi modificado. A execução dos testes copia os scripts para diretórios descartáveis e bloqueia rede; consultas oficiais abaixo foram uma amostra separada, somente leitura, sem token.

## Parecer

A troca do browser por negociação `Accept: text/markdown` faz sentido e funciona na amostra oficial. A branch não está pronta para substituir main sem corrigir a perda de famílias migradas e a compatibilidade dos caminhos documentais. Os mecanismos de proteção contra poda em massa existem e funcionam, porém a publicação do índice e o comando de recuperação têm lacunas reproduzidas.

## 1. A migração elimina CAPI e Catalog apesar de ambas continuarem disponíveis

**Regressão introduzida, recomendação: bloquear merge.**

Responsáveis: `scripts/lib/docs-http.js:41-45` troca mecanicamente `/docs/marketing-api` por `/documentation/ads-commerce/marketing-api` e rejeita qualquer outra família. `scripts/discover-urls.js:93-95` aplica isso ao baseline; `scripts/scrape-docs.js:124-125` classifica o resultado HTML como página ausente e `scripts/scrape-docs.js:443-448` remove os arquivos na coleta saudável. O mesmo filtro impede expansão pelos links oficiais para a família correta.

Evidência atual, obtida com o próprio helper HTTP sem credenciais:

| Requisição | Destino final | Resultado |
|---|---|---|
| `https://developers.facebook.com/docs/marketing-api/conversions-api/` | `https://developers.facebook.com/documentation/ads-commerce/conversions-api` | 200, text/markdown, 3632 caracteres |
| `https://developers.facebook.com/docs/marketing-api/conversions-api/parameters` | `https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters` | 200, text/markdown, 11837 caracteres |
| `https://developers.facebook.com/docs/marketing-api/catalog` | `https://developers.facebook.com/documentation/ads-commerce/catalog` | 200, text/markdown, 2149 caracteres |
| URL inventada pela troca de prefixo: `https://developers.facebook.com/documentation/ads-commerce/marketing-api/conversions-api` | mesma URL | 200, text/html, shell de 1331859 caracteres |

O diff removeu 55 páginas de `docs/conversions-api/` e 39 de `docs/catalog/`. Nessas pastas restaram apenas AGENTS.md. README.md:279-280 ainda promete essas seções. `search_documentation({query:'CAPI',section:'conversions-api'})` retorna somente `conversions-api/AGENTS.md` com relevância 100%, levando a links inexistentes; a tool `get_document_by_path` falha ao ler `conversions-api/best-practices.md`.

Correção recomendada: tratar destinos de redirect e famílias canônicas explicitamente, manter mapeamento de caminho local estável para CAPI/catalog, redescobrir/recolher as famílias migradas e só então podar. Não inferir que todos os subpaths de Marketing API mantiveram o mesmo pai após a migração.

Cobertura: `tests/scraper/regressions.test.mjs`, teste de migração de famílias, falha como gate.

## 2. Resources/guias entregam referências antes válidas que agora não abrem

**Regressão introduzida, recomendação: corrigir antes do merge.**

`ANDROMEDA.md:893-899` tem seis destinos locais inexistentes entre doze referências distintas a docs. Todos os doze existiam em main. Três são CAPI; os demais:

- `docs/advantage-campaigns/index.md`, agora existe `docs/advantage-campaigns.md`.
- `docs/advantage-shopping-campaigns/index.md`, agora existe `docs/advantage-shopping-campaigns.md`.
- `docs/bidding-and-optimization/campaign-budget-optimization.md`, removido; há o novo guia `docs/bidding/guides/advantage-campaign-budget.md`.

Os arquivos são devolvidos integralmente por `get_andromeda` e pelo novo resource de guia (`src/resources.ts:144-150`). `src/docs-tools.ts:203-215` faz apenas leitura literal do path, sem aliases. Reprodução: `get_document_by_path({path:'advantage-campaigns/index.md'})` falha; a mesma chamada com `advantage-campaigns.md` funciona.

Também há 73 ocorrências de links Markdown locais sem destino, 70 destinos distintos, nos AGENTS.md curados do corpus. Esses arquivos são incluídos em busca e resources porque `src/utils/fileLoader.ts:67-68,205-219` carrega todo `.md`. Essa indexação já existia, mas as referências ficaram quebradas com as remoções da branch.

Correção recomendada: atualizar referências internas, preservar aliases das URIs/caminhos anteriormente públicos quando o conteúdo apenas mudou de nome e adicionar integridade de links dos documentos curados ao gate. Resolver CAPI/catalog de fato, sem trocar seus links por um guia local vazio.

## 3. `--limit` preserva arquivos, mas destrói o baseline do índice

**Regressão no pipeline novo, recomendação: corrigir antes de usar atualização parcial.**

`scripts/scrape-docs.js:308-314,351-353` constrói um índice novo só a partir do manifesto atual; `:517` bloqueia apenas a poda para coleta limitada; `:538` grava esse índice parcial sobre o índice completo incondicionalmente. Isso também ocorre se a coleta em massa receber HTML e não baixar nenhuma página.

Cenário reproduzido: índice e docs têm `one.md` e `two.md`; coleta `--limit=1` busca one e preserva two fisicamente, mas apaga a entrada de two do url-index. O discover seguinte usa esse índice como fonte das edges fora da navegação (`scripts/discover-urls.js:88-108`), podendo perder de vez páginas válidas não ligadas pelo conjunto limitado da expansão.

Correção recomendada: publicar índice apenas quando a coleta estiver completa/saudável, ou mesclar o baseline preservando entradas não processadas e sua condição explícita. Gravar resultado de uma coleta parcial em artefato separado.

Cobertura: `a limited collection preserves the authoritative index for untouched documents`, falha como gate.

## 4. `scrape:resume` não recupera três estados que o próprio pipeline pode produzir

**Regressões no pipeline novo; recuperação operacional incompleta.**

### Cache ausente

`scripts/scrape-docs.js:137-142` ignora entradas `status: ok` sem validar o arquivo no cache. A finalização detecta a ausência em `:321-325`, mas apenas incrementa failed; não muda o estado para tentativa e não mantém a entrada no índice. Todo resume seguinte repete o problema. Arquivo existente pode ainda ser podado se a perda for pequena e a razão de gravação ficar acima de 70%.

Correção: validar a presença/integração do cache antes de decidir pending; rebaixar entrada inválida e buscar novamente. A finalização não deve criar links locais para um arquivo sem cache válido.

### Erro de página encontrada na expansão

Uma edge descoberta somente por link que falhou fica em manifest.pages como error, mas não em discovered-urls.json. O resume chama fetchPhase apenas para as páginas descobertas em `:488`; em `:223` a expansão exclui qualquer URL já presente no manifesto, inclusive com error. O comando recomendado `scrape:resume` nunca retenta a edge. Um discover adicional pode recuperá-la por unavailable, mas não faz parte do comando de recuperação informado ao usuário.

Correção: mesclar os erros do manifesto na fila de resume ou fazer a expansão retentar esses candidatos.

### HTML transitório / indisponibilidade geral de markdown

O pipeline protege o corpus quando a fonte retorna 200 HTML em massa, e em `:535` manda executar `scrape:resume`. Porém essas páginas ficaram `status: skipped, reason: no-markdown` em `:178-180`; `:137-142` nunca as retenta. Mesmo depois de o endpoint voltar, o resume permanece vazio e regrava o índice vazio.

Correção: separar soft-404 confirmado de indisponibilidade de negociação markdown; quando o guard indicar falha em massa, preservar índice e reabrir tais entradas para retry. No mínimo fornecer uma recuperação correta e explícita, que force revalidação.

Cobertura: três testes de recuperação em `tests/scraper/regressions.test.mjs`, todos falham como gates.

## Aspectos corretos verificados

- Nova coleta sem browser, UA simples e Accept markdown funcionaram para a página CTWA oficial (`https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp`): 200 text/markdown, 32408 caracteres. A referência Business também respondeu markdown pelo redirect legado.
- Índice atual possui 630 URLs/630 arquivos, todas as referências do índice existem em disco e o mapeamento é bidirecional.
- Corpus: main tinha 722 arquivos `.md`, a branch tem 643. Destes, 630 são indexados, nove são curados e quatro são páginas stale preservadas. O índice registra 19 indisponíveis, predominantemente HTTP 500, incluindo a família ads-webhooks e o changelog v26.
- Guard de navegação com mínimo de 300 URLs evita sobrescrever descoberta truncada.
- Helper faz timeout e retry para rede/429/5xx. 404 não é retentado.
- Entidades são decodificadas uma vez; links locais de páginas coletadas são adequados ao path esperado pela tool.
- Poda preserva conteúdo curado, stale e páginas com HTTP error, e bloqueia poda quando a resposta inteira passa a ser HTML.
- Resume recupera erros de rede de páginas que estão em discovered-urls.json e não baixa novamente páginas ok com cache íntegro.
- Busca WhatsApp retorna primeiro a referência CTWA e encontra a documentação nova de WhatsApp Status.
- A assinatura das seis tools de documentação não mudou. src/docs-tools.ts e src/utils/fileLoader.ts são idênticos à main.
- Os três guias adicionados aos resources estão incluídos no `files` do package.json e seu caminho relativo a dist está coerente.

## Dívidas anteriores e limites

- `src/resources.ts:132-135` aceita path traversal ao concatenar a URI de docs sem containment. A vulnerabilidade já existia no handler antigo; a adição de guias não a introduziu. Informada separadamente ao executor para cobertura/risco da versão usada por empresas.
- `src/api-tools.ts:4095` já orientava `conversions-api/get-started/index.md`, que não existia em main; não confundir com as seis regressões de ANDROMEDA.
- Guia Andromeda contém afirmações e thresholds estratégicos herdados que esta auditoria não validou. Fonte oficial nova ainda pode conter exemplos de versão/objetivo antigos; scraping atualizado não prova contrato executável atualizado.
- Nenhuma chamada autenticada à Graph API, alteração em conta, coleta completa, push ou publicação foi feita.
- Ferramenta web tentou abrir a documentação oficial e recebeu throttling. A evidência oficial positiva foi obtida por HTTP direto com o helper do projeto, sem credenciais.

## Testes entregues

Arquivos adicionados exclusivamente em `tests/scraper/`: `helpers.mjs`, `fixture-http.mjs`, `pipeline.test.mjs`, `regressions.test.mjs`.

Comando executado na raiz: `node --test tests/scraper/*.test.mjs`.

Resultado: **17 testes, 12 passaram, 5 falharam**, duração aproximada 0,7 segundo. As cinco falhas são os gates descritos acima, sem skip/TODO ou variável para ocultá-las. O fake HTTP lança erro em qualquer URL não provisionada, os processos não recebem ambiente/credenciais do pai, e todos os scripts escrevem apenas nos diretórios temporários removidos ao término.
