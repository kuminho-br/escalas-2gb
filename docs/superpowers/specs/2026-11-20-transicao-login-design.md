# Transição do login para as boas-vindas (as mangueiras)

22/11/2026, versão 2 em 26/11/2026 · design · **mockup aprovado pelo usuário em 22/11/2026; versão 2 (foto nova do quartel, mais brasas e pouso no quadro da tela inicial) aprovada em 26/11/2026**. A versão 1 está no site (entregas 6.4 e 6.14); a versão 2 é a entrega 6.67 (`docs/superpowers/plans/2026-11-26-fase6-67-entrada-v2.md`). A chegada e o enchimento da mangueira ficam como estão: em 25/11 o usuário deixou de lado o vídeo do quartel

- Mockup da versão 2: `docs/telas/refatoracao/entrada/index.html` (área Entrada do Manual de Identidade Visual; abrir no navegador). O mockup da versão 1 continua em `docs/telas/transicao-login/mockup.html` e https://claude.ai/artifact/W5RAADdsUP7Nx2QMSmmuns
- Imagem final: `docs/telas/transicao-login/img/combate-storz.png`

## Por quê

Entrar no sistema hoje é uma troca seca de tela. A ideia do usuário é que entrar seja um momento do 2º GB: duas mangueiras chegam pelas laterais, os engates Storz se conectam, a linha é pressurizada e a câmera se afasta até revelar uma dupla de bombeiros combatendo um incêndio numa loja. Essa cena fica parada como fundo das boas-vindas.

O clima é o de entrar num jogo online: menos simulação realista, mais impacto, com efeitos visuais em nível moderado (decisão de 22/11/2026).

A animação também resolve a espera: ela começa no clique em **Entrar**, e a batida dos engates acontece enquanto o servidor confere a senha.

Ela toca inteira **uma vez a cada 12 h**. O militar a vê uma vez por dia, o que dá vontade de ver de novo no dia seguinte (decisão do usuário: a raridade é proposital).

**Fora do escopo:** "Esqueci minha senha"; a regra de quem vê cada módulo; os temas futuros (ver "Futuro").

## Decisões do usuário

De 20/11/2026, salvo quando a linha traz outra data.

| Ponto | Decisão |
|---|---|
| Quando começa | No clique em **Entrar**, antes da resposta do servidor |
| Clima | Login de jogo online: efeitos visuais (clarão, onda de choque, faíscas, brasas no ambiente) em nível **moderado**, sem explosões grandes (22/11) |
| Cena | O cartão de login se desfaz; a foto do quartel escurece quase até o preto, com as bordas avermelhadas, e dá lugar à cena (22/11) |
| Foto do login (versão 2) | A foto do quartel ao sol, com as três bandeiras, que o usuário mandou em 23/11, **só no fundo do login**; a animação e a cena final não mudam. Um enquadramento por plataforma (25/11): no computador, as bandeiras livres no céu e a marca embaixo, sobre o véu vinho denso; no celular, sem bandeiras e sem céu (a fachada, a estátua e o jardim), com a marca encostada no cartão, o texto à esquerda e o brasão à direita. O nome e a linha de baixo têm uma sombra leve, para o branco não se perder no céu. Sem a etiqueta "Quartel do 2º GB" |
| Mangueiras | Brancas (contraste com o vinho e a bandeira) |
| Engates | Storz, dourados |
| Junta na imagem | Um anel só, de frente, com a vedação preta e duas garras. Fica assim **em teste**; pode ser melhorada depois (22/11) |
| Final | As mangueiras se conectam, são pressurizadas e a câmera se afasta até a cena inteira aparecer: uma **imagem realista** de bombeiros do CBMPE combatendo, com água saindo do esguicho, um incêndio numa loja brasileira. A imagem fica parada como fundo das boas-vindas |
| Bombeiros | Imagem realista pronta, não desenhada em tempo real. Uma **dupla em linha** na ponta da mangueira (um no esguicho, o outro logo atrás, segurando a linha) |
| Engate na imagem | No chão, à esquerda, em primeiro plano, longe dos bombeiros, com vários metros de mangueira até eles |
| Duração | Cerca de **3 s** do clique às boas-vindas, com o servidor rápido. Em teste (22/11) |
| Brasas do ambiente (versão 2) | **59** (eram 44), em três profundidades (as pequenas mais lentas e apagadas, ao fundo; as grandes mais rápidas e fortes, na frente), e **44** pontos de cinza (eram 22). Três em cada quatro brasas esfriam na subida (alaranjada, vermelha, cinza sem brilho); uma em cada quatro apaga ainda alaranjada (25/11). A primeira revisão tinha 88; o usuário pediu um terço a menos em 26/11. As brasas do botão **Entrar**: 52 (eram 26) |
| Brasas nas boas-vindas | Ficam sobre a imagem **4,2 s** depois do pouso, apagando nos últimos 1,6 s (versão 1: 4 s; a primeira revisão da versão 2 tinha 6,3 s e o usuário pediu menos em 25/11). Param (22/11) |
| Brasas sobre a saudação (versão 2) | Por cima de tudo, mas a **um terço da força** sobre o nome e a data, com a borda suave; no resto do quadro, força inteira. Depois do pouso entram **mais 43** brasas só dentro do quadro (antes, 59 no campo da tela inteira) |
| Fotos sorteadas das boas-vindas | **Saem.** A cena final ocupa o lugar delas |
| Tela de chegada | A tela inicial com os módulos do mockup aprovado (`docs/telas/login-e-inicio/mockup.html`); a faixa de boas-vindas fica mais alta para caber a cena. **Versão 2:** a câmera pousa no quadro da tela inicial v3 (3:1, até 400 px no computador, 250 no celular; margens e cantos de 12 px; a imagem a 66% na vertical), com a barra do topo e os atalhos aparecendo em volta enquanto a câmera se afasta (26/11) |
| Som | **Não há**, nem botão de som. Substitui a decisão de som ligado por padrão |
| Senha errada | Clarão vermelho, os engates destravam, as mangueiras voltam para as laterais e o cartão reaparece com a mensagem de erro |
| Repetição | Inteira só se passaram mais de **12 h** desde a última vez que tocou inteira, contadas por navegador; antes disso, entrada curta |
| Preferência | Cada pessoa escolhe, na Minha ficha: em toda entrada, uma vez a cada 12 h (padrão) ou nunca. Vale por navegador (23/11; entrega 6.14) |
| No site | Entra junto com a tela inicial dos módulos |

## A imagem final

Gerada pelo usuário no ChatGPT a partir dos pedidos feitos nesta conversa; 1536 × 1024 px. Nenhum modelo do Claude gera imagens: eles escrevem texto e código.

A versão em uso é a de junta corrigida, adotada em 22/11/2026. A versão anterior (`img/combate.jpg`, com as garras por fora) não é mais usada pelo mockup. A tela inicial do site ainda usa uma cópia dela, `apps/web/public/boas-vindas.jpg`, que precisa ser trocada na implementação.

O que a imagem mostra: rua de comércio brasileira ao anoitecer; loja de alvenaria descascada com porta de aço de enrolar em chamas; meio-fio amarelo; poste com fiação embolada; dois bombeiros de farda preta com faixas amarelo-limão, capacete fechado com viseira dourada e cilindro de ar, jogando água pela porta.

A mangueira branca, cheia e roliça, vem do primeiro plano, à esquerda, onde está a junta Storz.

Medidas que a animação usa (em pixels da imagem inteira):
- **Junta:** centro do anel em (310, 741), ou seja, 20% da largura e 72% da altura.
- **Corte da faixa no computador:** linhas 300 a 876 (formato 8:3). Ficam inteiros a junta, a mangueira, a dupla, o jato e o fogo da porta; o fogo da janela de cima fica na borda.
- **Corte da faixa no celular:** formato 16:9, mostrando a parte da direita (da mangueira até a loja). A junta fica fora do quadro.
- **Texto de boas-vindas:** canto superior esquerdo, sobre a fumaça escura, com um degradê escuro por baixo.

O que não saiu como pedido e ficou assim mesmo:
- os bombeiros estão um atrás do outro, não um de cada lado da mangueira (aceito);
- a aba da nuca dos capacetes não aparece com clareza (no tamanho da faixa não se nota);
- o jato é mais fino que o pedido;
- a junta é um anel só, com a mangueira da esquerda entrando nele. Nas fotos do quartel, a junta engatada são duas metades espelhadas (em teste, ver "Decisões do usuário").

## A junta Storz (o que a animação mostra)

- A Storz **não tem rosca**: engata com um quarto de volta, pelas garras.
- **Peça da direita:** o anel dourado com a mangueira da direita. Enquanto as peças estão separadas, ela mostra a **boca**: o aro, a **vedação preta** e o furo.
- **Peça da esquerda:** a mangueira da esquerda, com a luva dourada na ponta e as **duas garras opostas**.
- **Conectar:** as peças batem, recuam um pouco e as garras dão o **quarto de volta** até as posições em que aparecem na imagem, uma em cima e outra embaixo.
- **Vazia**, a mangueira é mais baixa e se alarga perto da junta; **pressurizada**, enche e fica redonda, com a base no chão.

## A cena, quadro a quadro

Tempos com servidor rápido, como estão no mockup. Do clique até as boas-vindas: cerca de **2,6 s**; o título termina de assentar perto dos **3 s**.

A batida acontece aos 0,5 s de qualquer jeito, e a água nunca começa antes de 0,9 s. Se a aprovação chegar depois disso, as boas-vindas aparecem **1,7 s** depois da aprovação.

| # | Quadro | Tempo desde o clique | O que acontece | Efeitos |
|---|---|---|---|---|
| 1 | Clique | 0 a 0,3 s | O cartão de login, o brasão e o título crescem um pouco, desfocam e somem; a tela escurece. A câmera está bem perto do ponto onde as peças vão se encontrar | Brasas sobem do botão **Entrar**; começam as brasas e a cinza do ambiente |
| 2 | Chegada | 0,10 a 0,50 s | As duas mangueiras, vazias, entram pelas laterais **acelerando**; a da direita vem do fundo e cresce ao se aproximar | Rastro atrás das peças, linhas de velocidade e um ponto de luz que cresce no centro |
| 3 | Batida e trava | 0,50 a 0,70 s | As peças batem, recuam um pouco (0,14 s) e as garras dão o quarto de volta (0,18 s) | Clarão, onda de choque em dois anéis, faíscas, tremor curto, franja de cor e raios de luz |
| 3a | Espera | enquanto o servidor não responde | A cena fica na junta travada. Sem barra de progresso | O anel pulsa, seis pontos de luz giram em volta e um brilho atravessa o dourado. Cerca de 1,6 s depois do clique aparece "Entrando…" |
| 4 | Pressurização | 1,05 s, a partir da aprovação | A água corre da esquerda para a direita; onde a frente passa, a mangueira enche; a junta dá um tranco quando a água a atravessa | Luz fria na frente da água e respingos |
| 5 | Câmera se afasta | começa 0,42 s depois da água; dura 1,3 s | Zoom out **enquanto a mangueira enche**: a imagem do combate aparece em volta da mangueira; o quadro encolhe até virar a faixa de boas-vindas, e a barra do sistema e os módulos aparecem em volta | As brasas continuam |
| 6 | Boas-vindas | 0,3 a 0,4 s | "Bom dia, Cb Almeida" entra um pouco maior e assenta; a data aparece junto | Lampejo, um risco de luz que cruza o quadro e brilho no título. As brasas ficam 4,2 s sobre a imagem, esfriando, e somem aos poucos |

**Servidor lento:** a cena fica no quadro 3a o tempo que for. Se a conexão falhar, vale o mesmo caminho da senha errada, com a mensagem atual ("Não foi possível falar com o servidor. Tente de novo.").

**Senha errada (ou servidor fora):** nunca antes de 0,85 s. Clarão vermelho na junta, tremor curto e poucas faíscas vermelhas; as garras fazem o quarto de volta ao contrário, as mangueiras recuam para as laterais (0,5 s), a bandeira volta ao normal e o cartão reaparece com a mensagem de erro e os campos preenchidos, como hoje.

**Aprovação antes da trava:** não há espera; a água começa aos 0,9 s.

## Efeitos

- **Sem som.** Tudo é visual.
- **Nível moderado.** O clarão não cobre a tela, o tremor é de poucos pixels e dura cerca de 0,3 s, e a onda de choque são dois anéis finos em volta da junta.
- **Ambiente:** 59 brasas sobem e 44 pontos de cinza descem durante toda a animação, por cima da cena. Três em cada quatro brasas esfriam na subida, de alaranjada a vermelha a cinza, e apagam antes de sair do quadro; uma em cada quatro apaga ainda alaranjada.
- **Nas boas-vindas:** as mesmas brasas continuam sobre o quadro por 4,2 s e param (apagando nos últimos 1,6 s), mais fracas sobre a saudação; entram mais 43 só dentro do quadro. Depois disso a tela fica parada.
- **Entrada curta e "sem movimento":** nenhum efeito.

## Entrada curta (dentro das 12 h)

Se a animação inteira já tocou nas últimas 12 h **neste navegador**, o clique em **Entrar** não toca a sequência: o botão mostra "Entrando…" e, com a senha aprovada, a tela de login se desfaz sobre as boas-vindas já com a cena parada (0,3 s). O tempo conta a partir da última vez em que a animação **inteira** tocou. O intervalo de 12 h fica em um lugar só.

No mockup, a entrada curta é ligada por um controle; a contagem das 12 h é da implementação no site.

## Quem desativou animações no aparelho

Se o sistema operacional pede menos movimento (`prefers-reduced-motion`): sem mangueiras em movimento e sem efeitos. Vale o mesmo caminho da entrada curta.

## Como é feita

- **A mangueira e a junta da animação são recortadas da própria imagem final**, não desenhadas. No fim do afastamento da câmera elas estão exatamente sobre a mangueira e a junta da imagem, então não há emenda nem troca de um desenho por uma foto.
- A mangueira vazia é o mesmo recorte, mais baixo; a pressurização devolve a altura coluna por coluna, acompanhando a frente da água.
- A mangueira da esquerda continua para fora da borda da imagem (a trama é repetida), porque no começo a câmera está mais perto do que a imagem alcança. O fundo à esquerda da imagem é a própria foto espelhada.
- A única peça desenhada é a **boca do anel**, na parte que a imagem esconde atrás da mangueira da esquerda.
- Os efeitos são desenhados na hora, no mesmo `canvas`. Cada partícula tem números fixos, então cada quadro depende só do tempo desde o clique. Sem biblioteca de animação.
- **Trocar a imagem** exige refazer as medidas: os contornos do anel, da luva e das garras, as bordas da mangueira e o ponto de foco. Estão juntos no começo do script do mockup. Isso foi feito uma vez, em 22/11, na troca para a imagem atual.
- A imagem é carregada assim que a tela de login abre. Se o clique vier antes, a animação espera a imagem.

## Entregas

1. **Este documento.**
2. **A imagem final.**
3. **Mockup**, com o login e a tela inicial já aprovados, no computador e no celular. Controles: senha certa ou errada; servidor rápido ou lento; entrada curta; sem movimento; repetir. Embaixo do palco aparece o nome do quadro que está passando.

Modelo: o mockup foi feito com o **Fable**. A primeira versão teve o código revisto por um agente separado com o **Opus**; a versão com efeitos, de 22/11, ainda não passou por revisão de código.

## Testes (na implementação)

- Os testes atuais de entrar continuam passando (senha certa navega; senha errada mostra a mensagem; servidor fora mostra a mensagem).
- A regra das 12 h: tocou há menos de 12 h → entrada curta; há mais → animação inteira; nunca tocou → animação inteira.
- `prefers-reduced-motion` → sem animação e sem efeitos.
- **O teste automático não diz se a animação ficou boa:** a aprovação é do usuário, no navegador, no computador e no celular.

## Futuro

- **Temas:** outras animações, sorteadas ou escolhidas pelo militar como personalização do seu acesso ao portal, uma para cada área dos bombeiros: APH, incêndio em vegetação, mergulho, incêndio estrutural, resgate em altura, busca de pessoas e salvamento aquático. A das mangueiras é o tema de incêndio estrutural.
- **Como os temas se encaixam:** cada tema é uma peça separada (cena, efeitos e imagem final) que a tela de login escolhe; a regra das 12 h, a entrada curta e o caminho de erro são comuns a todos.
- **Foto real:** uma foto de bombeiros do 2º GB em combate, com a mesma composição (junta no chão à esquerda, dupla à direita, canto superior esquerdo escuro), substitui a imagem gerada, refazendo as medidas.

## Retorno do usuário e situação

| # | Data | O que o usuário pediu | Situação no mockup |
|---|---|---|---|
| R1 | 20/11 | A mangueira chega na junta de um jeito estranho | **Em parte.** A chegada foi refeita (acelera, bate, as garras giram). O formato da mangueira vazia junto à junta continua o mesmo e depende do vídeo do quartel |
| R2 | 20/11 | Na imagem final a mangueira está achatada; cheia, ela fica bem mais redonda | **Feito**, com a imagem atual |
| R3 | 20/11 | A junta de frente tem uma "alcinha" só; a Storz tem duas garras opostas, o aro dourado e a vedação preta | **Feito.** As duas garras estão na peça da esquerda; a boca tem o aro e a vedação |
| R4 | 20/11 | A mangueira enche de uma vez, de forma brusca | **Em parte.** Enche em 1,05 s (eram 0,55 s). O ritmo fino depende do vídeo |
| R5 | 20/11 | A câmera só se afasta depois que a mangueira enche toda | **Feito** |
| R6 | 20/11 | Tirar todo o som e o botão de som | **Feito** |
| R7 | 22/11 | A animação está fraca; deve parecer o login de um jogo online, com efeitos na junta e partículas no ambiente | **Feito** e aprovado |
| R8 | 22/11 | Onda de choque e explosões moderadas, nada gigante | **Feito** e aprovado |
| R9 | 22/11 | Testar com cerca de 3 s e com a junta de um anel só | **Feito**, em teste |
| R10 | 23/11 | Trocar a foto do login pela do quartel ao sol; mais brasas; a animação pousa no quadro da tela inicial nova | **Feito** na versão 2 |
| R11 | 25/11 | Um enquadramento por plataforma (a marca fora das bandeiras e do céu aberto); brasas que esfriam até virar cinza, uma em cada quatro apagando alaranjada; duração menor; brasas mais fracas sobre a saudação; teto do quadro em 400 px | **Feito** na versão 2 |
| R12 | 26/11 | Um terço a menos de brasas (88 para 59); versão 2 aprovada | **Aprovada**; entrega 6.67 |

## Pendências

1. **Aprovação do mockup:** versão 1 em 22/11/2026; versão 2 em 26/11/2026.
2. **Vídeo da mangueira enchendo no quartel**, para fechar R1 e R4.
3. **Junta de um anel só:** se o teste não agradar, ajustar a imagem para as duas metades espelhadas das fotos do quartel e refazer as medidas.
4. **Defeitos conhecidos do mockup:**
   - enquanto as peças estão separadas, a boca do anel fica mais chapada que o resto e tem dois entalhes, onde as garras foram recortadas;
   - durante o afastamento da câmera, sobra uma sombra leve embaixo da mangueira, junto à borda esquerda da imagem.
5. **Imagem para o site:** a atual é um PNG de 2,1 MB; converter para JPG na implementação. Ampliar é opcional: com 1536 px de largura, a junta em primeiro plano fica um pouco mole em telas de alta densidade.
6. **Aba da nuca** dos capacetes: decidir se vale gerar a imagem de novo só por isso.
7. **Revisão do código** da versão com efeitos: fica com a revisão final da entrega 6.4.
8. **Para a implementação no site:**
   - o mockup não simula o servidor fora do ar (a mensagem "Não foi possível falar com o servidor…" segue o caminho da senha errada, mas não há controle para testá-la);
   - a taxa de quadros em celular fraco não foi medida, e a versão 2 desenha mais partículas por quadro: medir num celular lento simulado antes de fechar; se travar, reduzir as partículas **só nos aparelhos fracos** (Task 4 da 6.67);
   - redimensionar a janela durante a chegada das mangueiras faz as peças saltarem.

Corrigido no mockup depois da primeira revisão: a tela inicial não recebe foco enquanto o login está por cima; o foco vai para o campo de senha no erro e para a saudação no sucesso; se a imagem não carregar, a entrada segue sem a animação; a saudação aparece junto com a faixa na entrada curta; a mangueira não dá um salto no fim do enchimento.
