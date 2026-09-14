# Estrutura, criativos e mensuração

Guia curado do FaceAds MCP v2. Não é um documento publicado ou aprovado pela Meta. O nome Andromeda descreve o contexto estratégico deste guia; não cria um endpoint especial nem garante um comportamento da API ou um resultado de campanha.

A execução deve seguir o schema da ferramenta, a versão configurada da Graph API, as permissões da conexão e a resposta real do provedor. Páginas coletadas podem conter exemplos antigos. Confira a fonte e a data antes de tratar um exemplo como contrato vigente.

Documentação de Catalog, CAPI, Gateway ou do MCP oficial não habilita essas operações no FaceAds. O catálogo de ferramentas da conexão determina o que está implementado; referências e guias servem para consulta.

## Criativos

Diversificar mensagens, demonstrações e formatos é uma hipótese útil de teste. Variações cosméticas, por si só, não demonstram diversidade de demanda ou intenção. Defina o que cada criativo testa e acompanhe o resultado na janela acordada.

Recursos de automação de criativo dependem do formato, da conta e das combinações aceitas pela Meta. Não presuma que um campo aceito em um exemplo de catálogo funciona em qualquer anúncio. Consulte:

- [Advantage+ Creative](docs/creative/advantage-creative/get-started.md)
- [Asset Feed Spec](docs/ad-creative/asset-feed-spec.md)
- [Dynamic Creative](docs/ad-creative/asset-feed-spec/dynamic-creative.md)

## Audiências

Expansão de audiência e targeting amplo devem ser avaliados no contexto do objetivo e das restrições do negócio. Eles não eliminam as regras de elegibilidade, localização ou categorias especiais.

Confirme os campos atuais de targeting na documentação e no schema. Não mova exclusões ou automações entre o nível do conjunto e o objeto de targeting com base em um exemplo de outra versão. Consulte:

- [Advantage+ Audience](docs/audiences/reference/targeting-expansion/advantage-audience.md)
- [Advantage Targeting](docs/audiences/reference/advantage-targeting.md)
- [Advantage+ Campaigns](docs/advantage-campaigns.md)

## Mensuração

A Conversions API complementa a integração de eventos do negócio. Antes de usar seus dados para decisões de mídia, valide evento, horário, origem, deduplicação e qualidade dos dados enviados.

Não envie eventos de produção em uma bateria técnica sem aprovação específica. Dados de cliente e identificadores pessoais exigem tratamento adequado; um hash continua sendo dado a proteger. Não devolva esses valores em respostas de diagnóstico.

- [CAPI: boas práticas](docs/conversions-api/best-practices.md)
- [Deduplicação entre Pixel e servidor](docs/conversions-api/deduplicate-pixel-and-server-events.md)
- [Qualidade da integração](docs/conversions-api/integration-quality-api.md)

## Estrutura e orçamento

Consolidar conjuntos ou distribuir orçamento automaticamente são alternativas de implementação, não regras universais. Considere volume, restrições e a capacidade de comparar resultados antes de mudar a estrutura.

Nenhum valor fixo deste projeto deve ser interpretado como orçamento mínimo aceito pela Meta. Confirme moeda, unidade monetária, objetivo, restrições e resposta da API da conta concreta.

- [Advantage Campaign Budget](docs/bidding/guides/advantage-campaign-budget.md)
- [Estratégias de lance](docs/bidding/overview/bid-strategy.md)
- [Referência de Advantage+ Shopping](docs/advantage-shopping-campaigns.md)

Uma página preservada pode descrever um recurso em retirada. Sua presença no corpus não significa que criação ou alteração ainda esteja habilitada. Consulte o changelog oficial e teste somente a operação autorizada.

## Aplicação prática

Use [PLAYBOOK.md](PLAYBOOK.md) para transformar observação em hipótese e proposta verificável. Use [SKILL.md](SKILL.md) para navegar pelas ferramentas. Leia os objetos atuais, respeite a conta selecionada, prepare testes pausados e confira o estado remoto depois de uma escrita. Separe sempre análise, autorização, execução e resultado confirmado.
