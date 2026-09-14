# Publicar FaceAds MCP v2 no Railway

O arquivo [.railway/railway.ts](.railway/railway.ts) declara a aplicação `faceads-mcp-v2`, o PostgreSQL `Postgres` e a conexão `DATABASE_URL`. O helper oficial `postgres()` inclui o provisionamento do armazenamento persistente. As tabelas são criadas pelo entrypoint da aplicação.

**Importar o repositório ou fazer push não aplica infraestrutura automaticamente.** Use `railway config apply` para criar o banco e conectar os serviços. O antigo `railway.json`, que só configurava um serviço, foi substituído pelo formato nativo de infraestrutura do Railway.

## Preparar o serviço existente ou uma instalação nova

1. Use o projeto exclusivo da v2. Para uma instalação nova, crie esse projeto e o serviço `faceads-mcp-v2` a partir de `yvfl/faceads-mcp-v2`, branch `main`. Não adicione o banco manualmente: o arquivo fará isso no apply.
2. No serviço, gere o domínio público e configure `MCP_ENCRYPTION_KEY` e `MCP_BASE_URL` conforme a tabela abaixo. Se já estiverem configurados, mantenha os valores. `preserve()` no arquivo conserva esses valores; não gera segredos nem domínios.
3. Para migrar o serviço já criado, publique esta alteração no repositório antes do apply. Ela remove o `railway.json`. Em **Settings**, limpe o campo **Railway Config File** caso ainda aponte para ele. O CLI bloqueia serviços que continuam gerenciados pelo formato antigo.
4. Esta definição cria um banco novo com PostgreSQL 18, versão usada pelo helper do SDK fixado. Se você já adicionou um banco à v2, adapte a definição ao banco existente, preservando nome, imagem/versão e volume antes de aplicar. Igualar apenas o nome pode propor troca de versão principal; não faça esse upgrade como parte deste setup. Nunca aponte para o banco da v1.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Configurada pelo arquivo, referenciando o PostgreSQL pela rede interna |
| `MCP_ENCRYPTION_KEY` | Chave exclusiva, 64 caracteres hexadecimais, gerada por `openssl rand -hex 32` |
| `MCP_BASE_URL` | `https://DOMINIO-DA-V2`, sem `/mcp`, query ou barra final |
| `META_API_VERSION` | `v26.0`, configurada pelo arquivo |
| `PORT` | Fornecida pelo Railway; fallback local 3000 |

O entrypoint também aceita `RAILWAY_PUBLIC_DOMAIN` como fallback, mas este arquivo conserva o `MCP_BASE_URL` explicitamente configurado, inclusive quando você usa domínio próprio. A chave deve permanecer estável entre deploys; perdê-la impede decifrar os tokens salvos. Guarde-a no gerenciador de segredos da empresa.

O serviço não precisa de `META_ACCESS_TOKEN` global: cada usuário informa seu token na conexão. Não copie `.env`, banco, tokens OAuth, domínio ou chave da v1.

## Criar e conectar o PostgreSQL pelo arquivo

Execute na raiz deste repositório. O SDK está fixado no lockfile; os comandos abaixo usam o CLI 5.54.0 sem instalar ou atualizar software global:

```sh
npm ci
npm run check:railway
npx --yes @railway/cli@5.54.0 login
npx --yes @railway/cli@5.54.0 link
npx --yes @railway/cli@5.54.0 config plan
npx --yes @railway/cli@5.54.0 config apply
```

No `link`, selecione o projeto e ambiente exclusivos da v2. `plan` apenas consulta o estado e mostra as mudanças; `apply` pede confirmação antes de executá-las. O `--yes` usado acima pertence ao **npx** para baixar o CLI, não ao `config apply`.

O plano esperado adiciona o PostgreSQL e atualiza a configuração da aplicação. Este arquivo representa o ambiente inteiro: recursos e variáveis omitidos podem ser removidos. Se você adicionou outros serviços ou variáveis, inclua-os no arquivo antes de aplicar; use `preserve()` para conservar valores existentes. Não aplique um plano com exclusões inesperadas nem o use no projeto da v1.

Após o apply, confira os logs do PostgreSQL e da aplicação. Se a aplicação tiver falhado enquanto o banco iniciava, faça um redeploy dela quando o PostgreSQL estiver pronto. Não é necessário criar tabelas manualmente.

As atualizações de código continuam pelo GitHub. Mudanças de infraestrutura precisam de outro `config plan`/`config apply`. Este repositório não contém automação de publicação pelo CI.

## Build e inicialização

`.railway/railway.ts` seleciona Docker, uma réplica e `/health` como health check com limite de 120 segundos. O Dockerfile usa Node 22, instala dependências pelo lockfile, gera Prisma, compila TypeScript e inclui documentação e os três guias no container. O processo roda como usuário `node`.

O entrypoint confere as variáveis, executa `prisma migrate deploy` e inicia o transporte HTTP na porta indicada. A migração inicial cria o banco da v2 vazio; migrações posteriores evoluem esse mesmo banco, incluindo o histórico de operações Ads. Em um serviço v2 já existente, `prisma migrate deploy` aplica somente as migrações pendentes e preserva dados e conexões. Não use reset nem baseline para atualizar a v2. Se a primeira instalação apontar para tabelas de outro projeto ou para o banco da v1, investigue a configuração antes de prosseguir.

Mantenha **uma réplica**. Não configure um comando de start que contorne o entrypoint, pois ele aplica as migrações. Em atualizações futuras, revise a compatibilidade das migrações antes de publicar.

## Conferir a publicação

- `GET /health` deve retornar 200 e `service: faceads-mcp-v2`; o health check consulta PostgreSQL.
- `GET /.well-known/oauth-protected-resource/mcp` deve anunciar a URL pública terminada em `/mcp`.
- A página inicial deve apresentar a mesma URL.
- Adicione essa URL no cliente MCP e complete login, validação do token, seleção e consentimento.
- Execute primeiro a leitura do [plano de testes](TEST_PLAN.md). A escrita PAUSED exige conta e ativos próprios autorizados.

Clientes HTTP sem sessão de usuário são aceitos sem header `Origin`. Clientes em navegador precisam de origem autorizada: a própria URL base já é permitida. Se necessário, configure `MCP_ALLOWED_ORIGINS=https://CLIENTE-1,https://CLIENTE-2`, com origens exatas, sem wildcard. O Railway configura a identificação do proxy; para outro proxy confiável, use `TRUST_PROXY=1`.

## Operação e reversão

Uma nova versão do container pode invalidar sessões de transporte, que o cliente recria. Tokens de acesso MCP duram uma hora; o refresh permite renovação por 90 dias desde a emissão ou última renovação bem-sucedida. Esse prazo é deslizante, sem encerramento mensal para conexões em uso. A sessão existente aceita o novo acesso quando a autorização continua igual. A conexão é vinculada ao token Meta validado no consentimento. Quando esse token expirar ou perder acesso, refaça a conexão e valide um token válido.

As migrações de continuidade estendem somente refreshes ainda válidos, calculando 90 dias a partir da emissão da linha atual e preservando prazos que já sejam maiores. Não recuperam tokens expirados, consumidos ou revogados. Também criam o histórico de hashes de refresh consumidos, necessário à detecção de reutilização. Aplique as migrações antes de iniciar a versão nova, pelo fluxo normal do container.

A reutilização de um refresh consumido dentro da retenção de 90 dias revoga a família da autorização. Tokens aleatórios, outro cliente/recurso ou escopo inválido não podem provocar essa revogação. Refresh, troca do código e revogação são serializados por usuário/aplicativo para não deixar escapar um sucessor concorrente. Cada renovação válida remove até 100 hashes com retenção vencida; o prazo vencido já impede a detecção ou revogação por aquele hash mesmo antes da limpeza física. Clientes devem coordenar renovações concorrentes e persistir o refresh novo; repetir o anterior pode exigir reconexão.

Para interromper o piloto, pare somente o serviço da v2. A v1 continua em seu serviço e banco atuais. Não substitua o domínio antigo. Caso a v2 já tenha criado anúncios, parar o servidor não pausa anúncios na Meta; sua operação deve ser acompanhada na conta autorizada.

Referências de implantação: [infraestrutura em arquivo e migração](https://docs.railway.com/infrastructure-as-code), [SDK e PostgreSQL](https://docs.railway.com/infrastructure-as-code/reference), [Docker no Railway](https://docs.railway.com/builds/dockerfiles).
