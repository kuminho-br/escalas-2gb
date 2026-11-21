# Transição do login para as boas-vindas (as mangueiras)

20/11/2026 · design · mockup em revisão: o usuário pediu ajustes (ver "Retorno do usuário"), parte deles depende de um vídeo da mangueira enchendo no quartel

- Mockup: `docs/telas/transicao-login/mockup.html` (abrir no navegador) e https://claude.ai/artifact/W5RAADdsUP7Nx2QMSmmuns
- Imagem final: `docs/telas/transicao-login/img/combate.jpg`

## Por quê

Entrar no sistema hoje é uma troca seca de tela. A ideia do usuário é que entrar seja um momento do 2º GB: duas mangueiras chegam pelas laterais, os engates Storz se conectam, a linha é pressurizada e a câmera se afasta até revelar a ponta da mangueira nas mãos de uma dupla de bombeiros que já está combatendo um incêndio numa loja. Essa cena fica parada como fundo das boas-vindas.

A animação também resolve a espera: ela começa no clique em **Entrar**, e o encaixe dos engates acontece enquanto o servidor confere a senha. Ela não soma tempo ao acesso.

Ela toca inteira **uma vez a cada 12 h**. O militar a vê uma vez por dia, o que dá vontade de ver de novo no dia seguinte (decisão do usuário: a raridade é proposital).

**Fora do escopo:** "Esqueci minha senha"; a regra de quem vê cada módulo; os temas futuros (ver "Futuro").

## Decisões do usuário (20/11/2026)

| Ponto | Decisão |
|---|---|
| Quando começa | No clique em **Entrar**, antes da resposta do servidor |
| Cena | O cartão de login esmaece; a foto da bandeira fica, escurecida, e vai se transformando na cena |
| Mangueiras | Brancas (contraste com o vinho e a bandeira) |
| Engates | Storz, dourados |
| Final | As mangueiras se conectam, são pressurizadas e a câmera se afasta até a cena inteira aparecer: uma **imagem realista** de bombeiros do CBMPE combatendo, com água saindo do esguicho, um incêndio numa loja brasileira. A imagem fica parada como fundo das boas-vindas |
| Bombeiros | Imagem realista pronta, não desenhada em tempo real. Uma **dupla em linha** na ponta da mangueira (um no esguicho, o outro logo atrás, segurando a linha): aceito pelo usuário em 20/11 |
| Engate na imagem | No chão, à esquerda, em primeiro plano, longe dos bombeiros, com vários metros de mangueira até eles |
| Fotos sorteadas das boas-vindas | **Saem.** A cena final ocupa o lugar delas |
| Tela de chegada | A tela inicial com os módulos do mockup aprovado (`docs/telas/login-e-inicio/mockup.html`); a faixa de boas-vindas fica mais alta para caber a cena |
| Som | Discreto; começa **ligado**; ícone para ligar e desligar no canto da tela de login; a escolha fica salva no navegador |
| Senha errada | Os engates destravam, as mangueiras voltam para as laterais e o cartão reaparece com a mensagem de erro |
| Repetição | Inteira só se passaram mais de **12 h** desde a última vez que tocou inteira, contadas por navegador; antes disso, entrada curta |
| No site | Entra junto com a tela inicial dos módulos |

## A imagem final (aprovada em 20/11/2026)

Gerada pelo usuário no ChatGPT a partir do pedido feito nesta conversa; 1536 × 1024 px. Nenhum modelo do Claude gera imagens: eles escrevem texto e código.

O que ela mostra: rua de comércio brasileira ao anoitecer; loja de alvenaria descascada com porta de aço de enrolar em chamas; meio-fio amarelo; poste com fiação embolada; dois bombeiros de farda preta com faixas amarelo-limão, capacete fechado com viseira dourada e cilindro de ar, jogando água pela porta; a mangueira branca vem do primeiro plano, à esquerda, onde está o engate Storz dourado.

Medidas que a animação usa (em pixels da imagem inteira):
- **Engate:** centro em (318, 722), ou seja, 21% da largura e 71% da altura.
- **Corte da faixa no computador:** linhas 300 a 876 (formato 8:3). Ficam inteiros o engate, a mangueira, a dupla, o jato e o fogo da porta; o fogo da janela de cima fica na borda.
- **Corte da faixa no celular:** formato 16:9, mostrando a parte da direita (da mangueira até a loja). O engate fica fora do quadro.
- **Texto de boas-vindas:** canto superior esquerdo, sobre a fumaça escura, com um degradê escuro por baixo.

O que não saiu como pedido e ficou assim mesmo:
- os bombeiros estão um atrás do outro, não um de cada lado da mangueira (aceito);
- a aba da nuca dos capacetes não aparece com clareza (no tamanho da faixa não se nota);
- o jato é mais fino que o pedido.

## O engate Storz (o que a animação mostra)

- **Os dois engates são iguais**: não há macho e fêmea.
- Enquanto estão separados, o engate da direita mostra a **boca**, com o **anel de vedação preto** dentro do aro dourado.
- **Conectar** = as faces se encontram e **um quarto de volta trava**. Na animação, a garra de cada lado começa virada para a frente; na trava, a da esquerda sobe e a da direita desce, até as posições em que aparecem na imagem. Com a trava vem o estalo metálico e um clarão curto no dourado.
- **Vazia**, a mangueira é mais baixa e se alarga perto do engate; **pressurizada**, enche e fica redonda, com a base no chão.

## A cena, quadro a quadro

Tempos com servidor rápido, como estão no mockup. Do clique até as boas-vindas completas: cerca de **2,9 s**. A trava leva 1,1 s e acontece de qualquer jeito; se a aprovação chegar depois dela, as boas-vindas ficam completas **1,8 s** depois da aprovação.

| # | Quadro | Tempo desde o clique | O que acontece | Som |
|---|---|---|---|---|
| 1 | Clique | 0 a 0,3 s | O cartão de login, o brasão e o título esmaecem; a foto da bandeira escurece. A câmera está bem perto do ponto onde os engates vão se encontrar | — |
| 2 | Chegada | 0,10 a 0,72 s | As duas mangueiras, vazias, entram pelas laterais com os engates na frente; a da direita vem do fundo e cresce ao se aproximar | — |
| 3 | Encaixe e trava | 0,72 a 1,08 s | As faces se encontram (0,14 s), um leve tranco, e o quarto de volta trava (0,22 s) | estalo metálico |
| 3a | Espera | enquanto o servidor não responde | A cena fica no engate travado; a cada 2,6 s um brilho atravessa o dourado. Sem barra de progresso | — |
| 4 | Pressurização | 0,55 s depois da aprovação | A água corre da esquerda para a direita; onde a frente passa, a mangueira enche; o engate dá um tranco quando a água o atravessa | água subindo, curto |
| 5 | Câmera se afasta | 0,95 s | Zoom out contínuo: a bandeira escurecida dá lugar à imagem do combate, que aparece em volta da mangueira; o quadro encolhe até virar a faixa de boas-vindas, e a barra do sistema e os módulos aparecem em volta | jato ao fundo, baixo |
| 6 | Boas-vindas | 0,3 s | "Bom dia, Cb Almeida" e a data aparecem sobre a faixa. A cena fica parada | — |

**Servidor lento:** a cena fica no quadro 3a o tempo que for. Se a conexão falhar, vale o mesmo caminho da senha errada, com a mensagem atual ("Não foi possível falar com o servidor. Tente de novo.").

**Senha errada (ou servidor fora):** do quadro em que estiver, os engates fazem o quarto de volta ao contrário (se já tinham travado), as mangueiras recuam para as laterais (0,5 s), a bandeira volta ao normal e o cartão reaparece com a mensagem de erro e os campos preenchidos, como hoje.

**Aprovação antes da trava:** não há espera; da trava segue direto para a pressurização.

## Entrada curta (dentro das 12 h)

Se a animação inteira já tocou nas últimas 12 h **neste navegador**, o clique em **Entrar** não toca a sequência: o botão mostra "Entrando…" e, com a senha aprovada, a tela de login se desfaz sobre as boas-vindas já com a cena parada (0,3 s). O tempo conta a partir da última vez em que a animação **inteira** tocou. O intervalo de 12 h fica em um lugar só.

No mockup, a entrada curta é ligada por um controle; a contagem das 12 h é da implementação no site.

## Som

- Gerado pela própria página (sem arquivo de áudio): estalo metálico na trava, água subindo na pressurização e o jato baixo enquanto a câmera se afasta. Volume baixo.
- Começa **ligado**. Ícone de alto-falante no canto da tela de login para ligar e desligar.
- A escolha fica salva **no navegador** e vale para o próximo acesso. No login ainda não se sabe quem é a pessoa, então num computador compartilhado do quartel a escolha vale para todos que usam aquele navegador.

## Quem desativou animações no aparelho

Se o sistema operacional pede menos movimento (`prefers-reduced-motion`): sem mangueiras em movimento e sem som. Vale o mesmo caminho da entrada curta.

## Como é feita

- **A mangueira e o engate da animação são recortados da própria imagem final**, não desenhados. No fim do afastamento da câmera eles estão exatamente sobre a mangueira e o engate da imagem, então não há emenda nem troca de um desenho por uma foto.
- A mangueira vazia é o mesmo recorte, mais baixo; a pressurização devolve a altura coluna por coluna, acompanhando a frente da água.
- A mangueira da esquerda continua para fora da borda da imagem (a trama é repetida), porque no começo a câmera está mais perto do que a imagem alcança.
- A única peça desenhada é a boca do engate da direita, que a imagem não mostra.
- Tudo roda num `canvas`, com o estado da cena calculado a partir do tempo desde o clique. Sem biblioteca de animação.
- **Trocar a imagem** (por uma versão ampliada, ou por uma foto real) exige refazer as medidas: os contornos do engate e das garras, as bordas da mangueira e o ponto de foco. Estão juntos no começo do script do mockup.
- A imagem é carregada assim que a tela de login abre. Se o clique vier antes, a animação espera a imagem.

## Entregas

1. **Este documento.**
2. **A imagem final**, aprovada.
3. **Mockup**, com o login e a tela inicial já aprovados, no computador e no celular. Controles: senha certa ou errada; servidor rápido ou lento; entrada curta; sem movimento; repetir. O som é ligado e desligado no próprio palco. Embaixo do palco aparece o nome do quadro que está passando.

Modelo: o mockup foi feito com o **Fable**; a revisão do código é de um agente separado com o **Opus**.

## Testes (na implementação)

- Os testes atuais de entrar continuam passando (senha certa navega; senha errada mostra a mensagem; servidor fora mostra a mensagem).
- A regra das 12 h: tocou há menos de 12 h → entrada curta; há mais → animação inteira; nunca tocou → animação inteira.
- `prefers-reduced-motion` → sem animação e sem som.
- A preferência de som fica salva e é respeitada no próximo acesso.
- **O teste automático não diz se a animação ficou boa:** a aprovação é do usuário, no navegador, no computador e no celular.

## Futuro

- **Temas:** outras animações, sorteadas ou escolhidas pelo militar como personalização do seu acesso ao portal, uma para cada área dos bombeiros: APH, incêndio em vegetação, mergulho, incêndio estrutural, resgate em altura, busca de pessoas e salvamento aquático. A das mangueiras é o tema de incêndio estrutural. Cada tema é uma peça separada (cena, som e imagem final) que a tela de login escolhe; a regra das 12 h, o som, a entrada curta e o caminho de erro são comuns a todos.
- **Foto real:** uma foto de bombeiros do 2º GB em combate, com a mesma composição (engate no chão à esquerda, dupla à direita, canto superior esquerdo escuro), substitui a imagem gerada, refazendo as medidas.

## Retorno do usuário (20/11/2026, depois de ver o mockup)

| # | O que o usuário viu | O que muda | Depende do vídeo? |
|---|---|---|---|
| R1 | A mangueira chega no engate de um jeito estranho. | Refazer a chegada e o encaixe a partir do vídeo. | Sim |
| R2 | Na imagem final a mangueira está achatada; cheia, na prática, ela fica bem mais redonda. | A mangueira pressurizada precisa ficar cheia e roliça. A imagem atual não serve para isso: gerar de novo ou usar foto real. | Sim (referência) |
| R3 | O engate que aparece de frente tem uma "alcinha" só. | O Storz tem **duas garras opostas**, o anel dourado em volta e a vedação preta por dentro (fotos de referência do usuário, 20/11). A boca desenhada deve seguir isso. | Não |
| R4 | A mangueira enche de uma vez, de forma brusca. | Encher mais devagar, em etapas, com a água avançando. | Ritmo fino, sim |
| R5 | A câmera só se afasta depois que a mangueira enche toda. | A câmera começa a se afastar **enquanto** a mangueira enche. | Não |
| R6 | Som. | **Tirar todo o som** da animação (e o botão de som). Substitui a decisão anterior de som ligado por padrão. | Não |

## Pendências

1. **Aprovação do mockup** pelo usuário, no computador e no celular, depois dos ajustes R1 a R6.
2. **Ampliar a imagem** (opcional): com 1536 px de largura, o engate em primeiro plano fica um pouco mole em telas de alta densidade. Uma versão com o dobro do tamanho resolve; as medidas são multiplicadas por dois.
3. **Aba da nuca** dos capacetes: decidir se vale gerar a imagem de novo só por isso.
4. **Da revisão do código (20/11), para a implementação no site:**
   - o mockup não simula o servidor fora do ar (a mensagem "Não foi possível falar com o servidor…" segue o caminho da senha errada, mas não há controle para testá-la);
   - a taxa de quadros da pressurização em celular fraco não foi medida;
   - redimensionar a janela durante a chegada das mangueiras faz as peças saltarem;
   - se a senha errada chegar no instante exato do tranco do encaixe, as peças saltam 1,6 px.

Corrigido no mockup depois da revisão: a tela inicial não recebe foco enquanto o login está por cima; o foco vai para o campo de senha no erro e para a saudação no sucesso; se a imagem não carregar, a entrada segue sem a animação em vez de travar o botão; a saudação aparece junto com a faixa na entrada curta; a mangueira não dá um salto no fim do enchimento; os sons não disparam juntos ao voltar de outra aba.
