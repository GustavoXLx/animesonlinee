# Corrigir Nossa Casa, notificações e rolagem

## O que será alterado
- Restaurar na Nossa Casa o estilo original de personagens pequenos e quadradinhos, mantendo cabelo, cores, roupas e acessórios editáveis.
- Fazer o pedido de permissão das notificações aparecer para o perfil bb gu após um toque explícito; quando estiver dentro da prévia incorporada, orientar a abrir o site em uma aba própria, pois o navegador bloqueia esse pedido dentro da prévia.
- Preservar a posição exata da conversa ao revelar mensagens antigas, evitando o salto para o começo.

## Detalhes técnicos
- Criar uma representação leve e articulada, no estilo dos modelos originais da casa, usando o mesmo visual salvo pelo editor; o jogo Desfile continuará com o boneco detalhado atual.
- Expor um controle discreto e funcional de ativação de notificações somente para bb gu, tratando estados permitido, negado, indisponível e prévia incorporada.
- Medir a altura da lista antes de inserir mensagens antigas e compensar a rolagem depois da renderização; impedir que atualizações comuns substituam essa posição.
- Validar a tela da casa, o fluxo de permissão e a conversa em celular e desktop, além de conferir os erros da prévia.
