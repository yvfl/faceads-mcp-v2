# Validação da FaceAds MCP v2

Síntese das verificações realizadas até 13/09/2026. Este documento publica os cenários, resultados e limites técnicos. Identidades, IDs de ativos, valores de desempenho, respostas autenticadas e relatórios detalhados de contas ficam em artefatos privados fora do Git.

## Evidência por camada

| Camada | Verificação realizada | Limite da conclusão |
| --- | --- | --- |
| Testes locais | Contratos, payloads Graph simulados, protocolo MCP, documentação, autenticação, autorização e segurança | Respostas simuladas não comprovam elegibilidade ou aceitação pela Meta |
| HTTP e PostgreSQL locais | Login, consentimento, isolamento entre conexões, rotação de refresh, revogação e continuidade da sessão | O cliente externo precisa persistir e renovar suas próprias credenciais corretamente |
| Navegador local | Login, token inválido, seleção de contas, consentimento e callback OAuth | As imagens de interface usam dados sintéticos; não representam contas reais |
| Container local | Build, migração em banco vazio, inicialização, health e protocolo MCP | A compilação local não comprova a versão servida por um deployment |
| Deployment autenticado | Descoberta de contas, inventário, detalhes e consultas de Insights com dados | Validação de leitura restrita aos ativos, permissões e períodos efetivamente exercitados |
| Paginação real | Continuação de listagens e métricas, preservação de campos, ausência de duplicatas no inventário e coerência das somas nos recortes verificados | Não autoriza generalizar o resultado para toda combinação de dimensão, filtro ou atribuição |
| Conexão somente leitura | Consultas tipadas e continuação sem depender de `execute_api`; bloqueio de gerenciamento | Um token Meta com mais permissões não amplia o consentimento MCP escolhido |
| MCP oficial da Meta | Inicialização, catálogo autenticado, descoberta e leitura de entidades | Contrato próprio; a comparação de métricas depende da habilitação e dos mesmos ativos/períodos nos dois conectores |

As evidências de cada rodada distinguem código local, deployment e provedor. Uma atualização no GitHub não demonstra, sozinha, que o servidor passou a executar essa versão. A validação de leitura também não homologa operações de escrita.

## Regressões permanentes

- Os parâmetros aceitos por Insights são verificados no pedido efetivamente enviado à Graph simulada. Linhas, períodos e dimensões são preservados, inclusive dentro de ações e custos por tipo de ação.
- Listagens completas percorrem páginas dentro de limites explícitos. Interrupções retornam resultado incompleto e uma continuação com a ferramenta e os argumentos necessários. Uma continuação não é apresentada como o total da consulta original.
- Campos solicitados, JSON, `null`, zero e `false` são preservados. Falha de consulta ou métrica ausente não vira zero ou ausência de entrega.
- Autorização por conta e escopo é aplicada às ferramentas tipadas e às rotas genéricas. Os testes cobrem referências externas, audiências compartilhadas, isolamento e redução de permissões.
- Refresh tokens rotacionam; reutilização reconhecida revoga a família correspondente. Uma renovação válida mantém a sessão quando a autorização não muda. Os testes de prazo longo usam relógio controlado, não meses de observação em produção.
- Criações são pausadas e escritas de resultado incerto têm proteção contra repetição. Essa cobertura local não substitui uma bateria autorizada de escrita real.

Os contratos atuais e limites estão no [README](README.md). O [plano de testes](TEST_PLAN.md) descreve os ambientes e comandos reproduzíveis.

## Validações que continuam específicas de cada instalação

1. Verificar o catálogo e realizar uma leitura autenticada depois de cada deployment relevante.
2. Confirmar a renovação automática no cliente MCP escolhido, inclusive em máquinas remotas. Login concluído não comprova renovação de longo prazo.
3. Para comparar com o MCP oficial, usar ativos habilitados e os mesmos campos, períodos e janelas de atribuição.
4. Executar escrita somente com autorização e ativos de teste definidos, seguida de leitura e limpeza dos objetos criados. Não ativar anúncios para homologar o conector.
5. Exercitar separadamente as permissões e modalidades necessárias, como Pages, Instagram, mensagens, parcerias, audiências compartilhadas e agendamentos.

## Dados de teste e publicação

Testes padrão usam fixtures sintéticas. Configurações e respostas reais pertencem a `.env.test`, `tests/live/*.local.json` e `.audit-results/`, ignorados pelo Git. Relatórios operacionais de contas não devem ser adicionados como documentação pública; publique somente uma síntese anonimizada dos cenários e limites.

Nomes e números de exemplos da documentação pública da Meta não são evidência de acesso a esses ativos. A presença de uma operação no corpus de documentação também não significa que ela esteja implementada no FaceAds. Consulte o registro de ferramentas e a autorização da conexão.
