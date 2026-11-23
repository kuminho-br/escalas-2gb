# Sistema de estilo — valores e medidas

23/11/2026 · design · **mockup em revisão pelo usuário.** É a fundação da refatoração da interface: os blocos N1 (sistema de estilo) e N2 (resposta do sistema).

- Mockup: `docs/telas/sistema-de-estilo/mockup.html` e https://claude.ai/artifact/GNMQKUXn463nYqDLErXE6X
- Análise, direção e necessidades: `docs/superpowers/specs/2026-11-23-refatoracao-da-interface-design.md`

## Para que serve

Dá à DESENVOLVIMENTO os valores exatos, para implementar sem adivinhar. O mockup mostra as peças funcionando; este documento lista as medidas. Os valores daqui são os do mockup: se um dia divergirem, quem acha avisa a DESIGN.

Nada aqui muda regra de negócio. Os nomes dos tokens são os que já existem em `apps/web/src/estilo.css`; só `alerta-fundo` é novo.

## Cores

| Token | Valor | Papel único |
|---|---|---|
| `vinho` | `#8E1B1B` | A marca (menu, brasão) e a ação principal da tela |
| `vinho-escuro` | `#6F1414` | O vinho com o mouse em cima |
| `tinta` | `#1C2430` | Texto, ações secundárias, item escolhido e contorno de foco |
| `apagado` | `#5B6675` | Texto de apoio |
| `encaixe` | `#7D8A9C` | Contorno: borda de campo e de botão secundário, vaga opcional |
| `linha` | `#D8DDE4` | Divisórias e o fundo do botão apagado |
| `fundo` | `#EDEFF2` | A página |
| `passa` | `#F3F5F8` | O único cinza de painel: mouse em cima, fim de semana, etiqueta neutra |
| `superficie` | `#FFFFFF` | Quadros, campos e diálogos |
| `pendencia` sobre `pendencia-fundo` | `#8A5A00` sobre `#FCF1D6` | O que falta: vaga obrigatória vazia, pendência de cadastro, alteração não salva |
| `alerta` sobre `alerta-fundo` | `#B3261E` sobre `#FBEAE8` | Só erro e choque, sempre com ícone |
| véu | `tinta` a 45% | Atrás do diálogo e do painel no celular |

- **Saem:** `encaixe-claro`, os rosados do botão de contorno (`#D8B9B9`, `#FBF3F3`), o `#F6F7F9` do painel de função e o verde de "completa".
- **Variáveis da biblioteca de componentes:** `secondary`, `muted` e `accent` passam a valer `passa`; `input` passa a valer `encaixe`; `ring` continua `tinta`.
- **Cor do serviço:** continua vindo do cadastro. Aparece em três lugares: a faixa da placa, a faixa da marca na Grade e o quadradinho da etiqueta. Nunca fica atrás de texto.
- **Contraste, por cálculo:** `apagado` dá 5,8 sobre branco e 5,0 sobre `fundo`; `pendencia` dá 5,3 sobre o seu fundo; `alerta` dá 5,6 sobre o seu fundo; branco sobre `vinho` dá 9,0; `encaixe` dá 3,5 sobre branco.

## Letra

Barlow no texto (pesos 400, 500 e 600). Barlow Semi Condensed, peso 600, em nomes de guerra, números e títulos. Algarismos da mesma largura (`tabular-nums`) em todo o site.

| Tamanho e entrelinha | Família e peso | Uso |
|---|---|---|
| 40 / 44 px | estreita, 600 | Abertura da tela inicial e número grande |
| 28 / 32 px | estreita, 600 | Título da tela: um por tela, vindo da moldura |
| 20 / 26 px | estreita, 600 | Título de bloco, de painel e de diálogo; o dia; o título da tela no celular |
| 17 / 24 px | estreita, 600 | Nome de guerra, guarnição, turno e número em destaque |
| 15 / 22 px | Barlow, 400 (rótulo e botão em 500) | Texto, campos, botões e tabelas |
| 13 / 18 px | Barlow, 400 ou 500 | Apoio: posto, matrícula, rótulo da função, cabeçalho de tabela |

Nenhum texto fica abaixo de 13 px.

## Forma e medidas

| Item | Valor |
|---|---|
| Raio de controle | 6 px: botões, campos, placas, etiquetas, listas abertas e avisos |
| Raio de superfície | 12 px: quadros, painéis, diálogos e a barra de salvar |
| Sombra apoiada | `0 1px 2px rgba(28,36,48,.12)`: placas |
| Sombra por cima | `0 18px 44px rgba(28,36,48,.22), 0 2px 8px rgba(28,36,48,.10)`: painel, lista aberta, diálogo, aviso e barra de salvar |
| Contorno de foco | 2 px de `tinta`, afastado 2 px; branco sobre o menu e sobre o aviso escuro |
| Altura de controle | 36 px; 44 px no toque (`pointer: coarse`) e na largura de celular |
| Menor alvo de clique | 32 px, só na marca da Grade |
| Espaços | 4, 8, 12, 16, 24, 32 e 48 px |
| Movimento | Painel e aviso entram em 180 ms; a placa pousa em 220 ms; a espera corre em 1,3 s. Tudo para com `prefers-reduced-motion` |
| Largura de celular | O ponto de quebra que o site já usa (768 px); o mockup troca em 720 px por causa do quadro em que está |

## Placa, encaixe e guarnição

| Peça | Medidas |
|---|---|
| Placa | Altura de controle; borda de 1 px `linha`; raio 6; fundo `superficie`; sombra apoiada; faixa do serviço de 5 px à esquerda, na altura toda; folga de 15 px à esquerda e 4 px à direita |
| Texto da placa | Posto em 13 px, peso 500, `apagado`; nome em 17 px estreita, espaçamento de 0,01 em; os dois pela linha de base, com 6 px entre eles; o nome longo corta com reticências e a dica traz posto, nome, matrícula e serviço |
| Serviço na placa | Em 13 px `apagado`, à direita, só quando a origem não é Pronto. "Acumula com X" ocupa o mesmo lugar |
| Sinal de ações | Três pontos numa área de 28 px, só em placa com 228 px ou mais de largura; aparece com o mouse em cima e no foco, e sempre no toque |
| Estados da placa | Mouse em cima: fundo `passa`, borda `encaixe`. Menu aberto ou escolhida: borda e contorno de 1 px `tinta`. Choque: borda e contorno de 1 px `alerta`, ícone e a frase embaixo |
| Linha (listas) | Placa de 44 px, com a matrícula em 13 px `apagado` e a etiqueta do serviço |
| Marca (Grade) | 32 por 32 px, borda de 1 px `linha`, raio 6, letra do turno em 15 px estreita, faixa do serviço de 4 px embaixo |
| Encaixe obrigatório | A caixa da placa; fundo `pendencia-fundo`; borda tracejada de 1,5 px `pendencia`; texto em 15 px, peso 500, `pendencia`; ícone de mais e "Escolher militar" |
| Encaixe opcional | Sem fundo; borda tracejada de 1 px `encaixe`; texto `apagado`, peso 400; ícone de mais e "Vaga opcional" |
| Encaixe com o mouse | O tracejado vira linha cheia; no opcional, fundo `superficie` e texto e borda em `tinta` |
| Guarnição | Fundo `superficie`, borda de 1 px `linha`, raio 12, folga de 12 px (14 embaixo); nome em 17 px estreita, viatura em 13 px `apagado` |
| Estado da guarnição | À direita do nome: etiqueta "Falta 1" ou "Faltam N", ou um visto de 16 px em `encaixe` com "Completa" para leitor de tela |
| Função | Rótulo numa coluna de 84 px (nome em 13 px, peso 500; a CNH embaixo, `apagado`) e os lugares em coluna, com 6 px entre eles |
| Menu da placa | Lista colada à placa (4 px), com "Trocar militar" e "Remover da vaga"; abre para cima quando falta espaço; fecha com Esc e devolve o foco |

Uma caixa por nível: só a guarnição tem moldura. Dia e turno são títulos, e a função é um rótulo.

## Componentes

| Componente | Medidas e estados |
|---|---|
| Botão | Altura de controle, folga lateral de 14 px, raio 6, Barlow 500 em 15 px, ícone de 16 px a 8 px do texto. Só ícone: quadrado na altura de controle |
| Botão principal | Fundo `vinho`, texto branco; mouse em cima, `vinho-escuro`. Um por tela |
| Botão secundário | Fundo `superficie`, texto `tinta`, borda de 1 px `encaixe`; mouse em cima, fundo `passa` e borda `tinta` |
| Botão discreto | Sem fundo, texto `tinta`; mouse em cima, `tinta` a 8% |
| Botão perigoso | Fundo `superficie`, texto e borda `alerta`; mouse em cima, `alerta-fundo`. Cheio (fundo `alerta`, texto branco) só dentro da confirmação de apagar |
| Botão apagado e ocupado | Apagado: fundo `linha`, texto `apagado`, sem borda. Ocupado: ícone girando e o verbo ("Salvando…") |
| Link | `tinta`, peso 500, sublinhado |
| Campo | Rótulo em 15 px, peso 500, a 6 px da entrada; entrada na altura de controle, folga de 12 px, borda de 1 px `encaixe`, raio 6; mouse em cima, borda `tinta`; ajuda em 13 px `apagado`; o opcional diz "(opcional)" no rótulo |
| Campo com erro | Borda de 2 px `alerta` e a frase em 13 px, peso 500, `alerta`, com ícone, ligada ao campo por `aria-describedby` |
| Lista de opções | Gatilho igual ao campo, com seta; lista com borda `linha`, raio 6, sombra por cima e folga de 4 px; opção na altura de controle; a escolhida em peso 600 com visto; abre para cima quando falta espaço |
| Data | Gatilho igual ao campo; calendário de 272 px; dia de 32 por 32 px; hoje com contorno de 1 px `tinta`; escolhido com fundo `tinta`; fim de semana em `apagado`; feriado com um ponto de 4 px |
| Mês | Grupo com borda `encaixe` e duas setas; nome em 17 px estreita; o nome abre os 12 meses em 4 colunas, com o escolhido em fundo `tinta` |
| Marcar e escolher | Caixa e círculo de 20 px, borda de 1 px `encaixe`; marcados com fundo `tinta`; a linha inteira clicável, na altura de controle |
| Contador | Grupo como o do mês, com menos, valor em 17 px estreita e mais |
| Envio de arquivo | Vazio: borda tracejada de 1 px `encaixe` e botão secundário. Com arquivo: borda cheia `linha`, o nome em peso 600 e "Trocar" |
| Abas | Linha de 1 px embaixo da faixa; aba na altura de controle, `apagado`, peso 500; a escolhida em `tinta`, peso 600, com 2 px embaixo; a faixa rola dentro dela mesma |
| Tabela | Cabeçalho em 13 px, peso 500, `apagado`; linha de 44 px; mouse em cima, `passa`; números à direita; a tabela rola dentro do próprio quadro |
| Etiqueta | Altura de 24 px, folga de 8 px, raio 6, 13 px, peso 500. Serviço: quadradinho de 8 px com a cor e texto `tinta`. Falta: `pendencia`. Erro: `alerta`, com ícone. Neutra: `passa` e `apagado` |

## Resposta do sistema

| Peça | Medidas e comportamento |
|---|---|
| Aviso de resultado | Embaixo, no meio da área de trabalho, a 16 px da borda (no celular, acima da barra de ação). Fundo `tinta`, texto branco, raio 6, sombra por cima, 44 px de altura mínima. `role="status"` |
| Tempo do aviso | 8 s com "Desfazer", 4 s sem; não some com o mouse em cima nem em foco; o de erro espera a pessoa |
| Aviso de erro | Fundo `superficie`, borda de 1 px `alerta`, ícone de 20 px, texto `tinta` e "Tentar de novo" |
| Confirmação | Diálogo de até 440 px, folga de 24 px, raio 12, sombra por cima, sobre o véu; título em 20 px; "Cancelar" (secundário) e o verbo (principal) à direita |
| Confirmação de apagar | O verbo em botão perigoso cheio, apagado até a pessoa digitar a matrícula |
| Barra de salvar | No lugar do aviso: etiqueta "N alterações não salvas" em âmbar, "Descartar" e "Salvar ficha". Fundo `superficie`, raio 12, sombra por cima |
| Espera | Blocos de raio 6 no lugar e na altura do que vai aparecer, com um brilho de `linha` a `passa`; texto "Carregando…" só para leitor de tela |
| Erro junto | Na linha ou no campo que o causou, nunca no pé do formulário |
| Vazio | Um por tela: título em 20 px, uma frase em `apagado` e o próximo passo num botão secundário |

## Moldura da tela

| Parte | Medidas |
|---|---|
| Cabeçalho | Título em 28 px à esquerda; mês e ação principal à direita; folga de 16 px em cima, 24 dos lados e 12 embaixo |
| Filtros | Faixa `superficie` com linha em cima e embaixo, 52 px de altura mínima, parada ao rolar; o total do que falta fica à direita |
| Área de trabalho | Folga de 16 px em cima e 24 dos lados; usa a largura toda; as guarnições em colunas de 248 px no mínimo, com 12 px entre elas |
| Tela de leitura | Conteúdo com até 720 px de largura |
| Painel de detalhe | 384 px, por cima da área de trabalho e só dela: título, mês, ação e filtros continuam à vista. Fecha com Esc e devolve o foco |
| Celular | Título em 20 px; o mês na largura toda; a ação principal numa barra embaixo; o painel sobe de baixo, até 84% da altura, com o véu |

O menu, o topo e o seletor de unidade aparecem no mockup só para situar. O desenho deles é do bloco N3.

## Decisões de desenho

Tomadas pela DESIGN dentro da direção aprovada. O usuário vê todas no mockup.

1. Remover da vaga não pede confirmação: responde com o aviso e "Desfazer". O aviso diz o que a confirmação de hoje diz, que o militar não volta ao turno na próxima pré-escala.
2. O item escolhido (aba, caixa marcada, dia do calendário) é marcado em `tinta`. O vinho fica para a marca e a ação principal.
3. A etiqueta do serviço deixa de ter a cor atrás do texto: qualquer cor que o usuário escolher continua legível.
4. A borda dos campos e dos botões secundários escurece para `encaixe`, que dá 3,5 de contraste.
5. "Completa" deixa de ser um visto verde, igual ao do Pronto, e vira um visto cinza.
6. A matrícula sai da placa do quadro. Fica na dica da placa, na lista de escolha e na ficha.
7. No vazio, o próximo passo é um botão secundário. O principal continua no alto.
8. No celular, a ação principal vai para uma barra embaixo.

## Fora deste documento

- O desenho de cada tela: Grade geral (N4.1), Escala do mês (N4.2 e N4.3), navegação e tela inicial (N3), fichas (N5).
- O teste que recusa cor e tamanho fora dos tokens (N1.5): é da DESENVOLVIMENTO, com os valores das tabelas acima.

## Pendências

- Aprovação do mockup pelo usuário.
- Confirmar que o cartão da guarnição traz a origem do serviço, para a regra do nome do serviço na placa.
- Conferir o contraste e o foco com ferramenta e com leitor de tela, no site, depois da implementação.
- `2026-11-16-telas.md` descreve a identidade de hoje: a DOCUMENTAÇÃO atualiza quando a fundação entrar no código.
