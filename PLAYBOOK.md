# Decisões de otimização Meta Ads

Guia curado do projeto. Os critérios devem ser definidos com cada negócio a partir de margem, ciclo de venda, qualidade dos leads e histórico da própria conta. Não existe um CPA, CTR, frequência ou orçamento mínimo universal que torne uma campanha boa ou ruim.

## Definir o contexto

Antes de recomendar uma mudança, identifique objetivo, produto, país, moeda, fuso da conta, orçamento autorizado, evento de conversão e período analisado. Verifique também se a decisão é de mídia ou de resultado comercial: um lead barato pode não gerar venda.

Registre a meta acordada e como ela será medida. Se faltar uma informação indispensável, explicite a lacuna. Não invente metas ou trate exemplos deste projeto como limites da plataforma.

## Diagnosticar

1. Confira se houve entrega, gasto e mudança recente de status ou orçamento.
2. Compare períodos equivalentes e informe a janela de atribuição. Não misture dias incompletos com dias completos.
3. Separe problema de mensuração de problema de performance. Eventos duplicados ou ausentes mudam a leitura do resultado.
4. Examine o resultado no nível correto: campanha, conjunto, anúncio ou criativo.
5. Considere volume, atraso de conversão e sazonalidade antes de interpretar uma variação pequena.

Confira a completude da consulta antes de contar anúncios ou comparar desempenho. As ferramentas percorrem páginas automaticamente dentro dos limites, mas `structuredContent.pagination.complete: false` indica que a consulta inteira ainda não está reunida. Continue com o cursor e os parâmetros retornados; uma resposta iniciada em `after` não inclui os resultados anteriores. Informe amostras e recortes como parciais.

Preserve as linhas por período, dimensão e tipo de ação. Um campo ausente não é zero; uma falha de Insights não demonstra ausência de entrega. Separe os anúncios cujo desempenho foi confirmado daqueles cuja consulta falhou ou ficou incompleta.

Use referências oficiais para parâmetros de Insights, métricas e restrições dos objetos. Campos disponíveis e combinações aceitas dependem da versão, do tipo da conta e da operação. Uma leitura bem-sucedida não valida uma escrita diferente.

## Recomendar uma alteração

Apresente observação, hipótese e ação separadamente. Por exemplo: houve queda de conversão na mesma janela; a hipótese é desgaste do criativo; a proposta é testar uma nova abordagem com orçamento e duração aprovados. A hipótese continua sendo hipótese até produzir evidência suficiente.

Toda proposta deve identificar a conta, o objeto, a mudança exata, o limite de gasto, a condição de avaliação e a forma de interromper o teste. Evite alterar várias dimensões ao mesmo tempo quando isso impedir a interpretação do resultado.

O acesso de gerenciamento de uma conexão não é autorização permanente para pausar campanhas, aumentar orçamento ou publicar anúncios. Use a intenção explícita do usuário para a ação concreta e respeite seus limites.

## Executar e conferir

Leia o estado atual antes da alteração. Campanhas, conjuntos e anúncios são criados ou copiados sempre pausados; a ativação exige uma operação posterior autorizada. Depois da escrita, confira o ID retornado e releia o estado relevante. Não anuncie ativação, pausa ou limpeza como concluída apenas porque a requisição foi enviada.

Use um `request_id` por intenção e consulte `get_operation_status` após timeout. Quando houver ID remoto, `inspect: true` ajuda a conferir seus campos. Uma operação pendente ou incerta bloqueia a repetição idêntica; trocar o identificador não resolve a incerteza. Se a resposta de criação perdeu o ID, verifique o histórico da conta e mantenha o resultado como incerto. Não use uma segunda criação como mecanismo automático de recuperação.

## Encerrar uma análise

Entregue o período, os dados observados, a decisão recomendada, os objetos afetados e o próximo critério de avaliação. Quando uma mudança for executada, acrescente o resultado confirmado e as limitações da validação.

Veja [SKILL.md](SKILL.md) para uso do MCP e [ANDROMEDA.md](ANDROMEDA.md) para referências de criativos, audiências e mensuração. Este playbook não promete resultado de mídia e não substitui os contratos das ferramentas ou a documentação vigente.
