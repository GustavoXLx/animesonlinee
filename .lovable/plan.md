# Refazer Cozinha a Dois

## Objetivo
Transformar o jogo atual numa cozinha cooperativa top-down clara, bonita e fluida, feita primeiro para celular deitado. As fotos enviadas serão usadas como referência de composição e legibilidade, sem copiar arte ou personagens.

## O que será mudado
- Exigir orientação horizontal ao abrir o jogo e aproveitar toda a tela em modo paisagem.
- Redesenhar a cozinha com corredores, ilhas, bancadas e estações visualmente distintas.
- Substituir todos os emojis por desenhos próprios renderizados no jogo para ingredientes, pratos, utensílios e avisos.
- Criar personagens de cozinheiro mais expressivos, com animação direcional, passos, sombra e item carregado visível.
- Refazer a interface: pedidos no topo com etapas ilustradas e tempo, placar e cronômetro compactos, ação contextual e controles que não cobrem a cozinha.
- Melhorar o toque: joystick com centro móvel, zona morta, resposta imediata e botão de ação grande com indicação do que acontecerá.
- Exibir claramente ingredientes nas bancadas, progresso de corte/cozimento, comida pronta e risco de queimar.
- Adicionar feedback profissional para pegar, cortar, cozinhar, montar, entregar, errar, completar sequência e perder pedido.
- Manter a cooperação online existente e reduzir trabalho por quadro para buscar 60 FPS estáveis em aparelhos compatíveis.

## Validação
- Conferir a tela horizontal em proporções comuns de celular e desktop.
- Testar movimentação, colisões, estações, preparo completo, entrega, pausa e fim da partida.
- Confirmar ausência de emojis no jogo e verificar erros e desempenho no preview.

## Detalhes técnicos
- Manter Phaser e o modelo atual em que cada aparelho simula o próprio movimento e bb gu confirma o estado compartilhado.
- Gerar a arte vetorial diretamente em texturas leves do jogo, evitando downloads pesados e mantendo nitidez.
- Separar apresentação, controles e regras para reduzir recriações e facilitar ajustes futuros.