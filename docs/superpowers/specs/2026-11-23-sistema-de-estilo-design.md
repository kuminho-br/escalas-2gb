# Diretrizes gerais da interface — valores e medidas

23/11/2026 · design · **aprovado pelo usuário em 23/11/2026, com espaço para revisões.** É a seção "Diretrizes gerais" do Manual de Identidade Visual. É a fundação da refatoração da interface: os blocos N1 (sistema de estilo) e N2 (resposta do sistema), mais a identidade e os ícones. É a semente do brandbook do projeto.

- Mockup: a área "Diretrizes gerais", em `docs/telas/refatoracao/diretrizes-gerais/index.html`. O índice de todas as áreas está em `docs/telas/refatoracao/index.html` e em https://claude.ai/artifact/GNMQKUXn463nYqDLErXE6X
- Peças compartilhadas pelos mockups: `docs/telas/refatoracao/pecas.css` (cores, letra, componentes, moldura) e `pecas.js` (ícones)
- Análise, direção e necessidades: `docs/superpowers/specs/2026-11-23-refatoracao-da-interface-design.md`

## Para que serve

Dá à DESENVOLVIMENTO os valores exatos, para implementar sem adivinhar. O mockup mostra as peças funcionando; este documento lista as medidas. Os valores daqui são os do mockup: se um dia divergirem, quem acha avisa a DESIGN.

Nada aqui muda regra de negócio. Os nomes dos tokens são os que já existem em `apps/web/src/estilo.css`; só `alerta-fundo` é novo.

Valem acima deste documento as diretrizes do usuário de 23/11/2026, na seção "Diretrizes do usuário" da especificação da refatoração: o mockup é guia e não gabarito, o posto aparece sem "BM", a Escala do mês mostra todos os dias na mesma tela e o menu tem ícones. O que muda o comportamento de hoje está marcado em "Propostas de mudança de comportamento".

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
| 13 / 18 px | Barlow, 400 ou 500 | Apoio: patente, matrícula, rótulo da função, cabeçalho de tabela |

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
| Menor alvo de clique | 32 px na marca da Grade; na régua dos dias, a célula tem 44 px de altura e nunca menos de 26 px de largura |
| Espaços | 4, 8, 12, 16, 24, 32 e 48 px |
| Movimento | Painel e aviso entram em 180 ms; a placa pousa em 220 ms; a espera corre em 1,3 s. Tudo para com `prefers-reduced-motion` |
| Largura de celular | O ponto de quebra que o site já usa (768 px); o mockup troca em 720 px por causa do quadro em que está |

## Placa, encaixe e cartão

| Peça | Medidas |
|---|---|
| Placa | Altura de controle; borda de 1 px `linha`; raio 6; fundo `superficie`; sombra apoiada; faixa do serviço de 5 px à esquerda, na altura toda; folga de 15 px à esquerda e 4 px à direita |
| Texto da placa | Patente (posto ou graduação) sem "BM" (SD, CB, 3º SGT, SUB TEN), em 13 px, peso 500, `apagado`; nome em 17 px estreita, espaçamento de 0,01 em; os dois pela linha de base, com 6 px entre eles; o nome longo corta com reticências e a dica traz posto, nome, matrícula e serviço |
| Largura da placa | A patente mais longa (SUB TEN) ocupa perto de 48 px. Com 148 px cabem a patente, um nome de 7 letras e o botão das ações; é a largura mínima de um lugar no quadro do mês |
| Serviço na placa | Em 13 px `apagado`, à direita, só quando a origem não é Pronto. "Acumula com X" ocupa o mesmo lugar |
| Botão das ações | Três pontos numa área de 28 px, sempre à mostra (decisão do usuário de 23/11/2026), em `apagado`; com o mouse em cima, no foco e com o menu aberto, em `tinta`. Quando falta largura, quem corta é o nome, com reticências |
| Estados da placa | Mouse em cima: fundo `passa`, borda `encaixe`. Menu aberto ou escolhida: borda e contorno de 1 px `tinta`. Choque: borda e contorno de 1 px `alerta`, ícone e a frase embaixo |
| Linha (listas) | Placa de 44 px, com a matrícula em 13 px `apagado` e a etiqueta do serviço |
| Marca (Grade) | Fica como é hoje (decisão do usuário de 23/11/2026): quadrado cheio na cor do serviço, de 20 por 18 px, raio 3, com a letra do turno em 11 px estreita, peso 700; a cor da letra vem de `estiloDaCor`, que escolhe branco ou tinta pelo contraste. A letra é o turno e a cor é o serviço. É a exceção à regra de não pôr texto sobre a cor do serviço |
| Encaixe obrigatório | A caixa da placa; fundo `pendencia-fundo`; borda tracejada de 1,5 px `pendencia`; texto em 15 px, peso 500, `pendencia`; ícone de mais e "Escolher militar" |
| Encaixe opcional | Sem fundo; borda tracejada de 1 px `encaixe`; texto `apagado`, peso 400; ícone de mais e "Vaga opcional" |
| Encaixe com o mouse | O tracejado vira linha cheia; no opcional, fundo `superficie` e texto e borda em `tinta` |
| Cartão da guarnição | Junta a equipe: fundo `superficie`, borda de 1 px `linha`, raio 12, folga de 12 px (14 embaixo); nome em 17 px estreita, viatura em 13 px `apagado`. Os cartões de um turno ficam lado a lado, com 300 px no mínimo e 12 px entre eles |
| Estado da guarnição | À direita do nome: etiqueta "Falta 1" ou "Faltam N", ou um visto de 16 px em `encaixe` com "Completa" para leitor de tela |
| Função, no cartão | Rótulo numa coluna de 72 px (nome em 13 px, peso 500; a CNH embaixo, `apagado`) e os lugares em coluna, com 6 px entre eles. Em cartão com menos de 340 px, o rótulo vai para cima dos lugares, numa linha |
| Menu da placa | Lista colada à placa (4 px), nunca mais estreita que o texto, com "Trocar militar" e "Remover da vaga" (em "Sem guarnição", "Remover do turno"); abre para cima quando falta espaço; fecha com Esc e devolve o foco |

Só a guarnição tem caixa: o cartão, um por guarnição em cada turno, com a equipe que sai junta na viatura naquele turno (decisão do usuário de 23/11/2026). Dia e turno são títulos, e a função é um rótulo. Na Escala do mês os turnos ficam em colunas, com os dias um depois do outro; o desenho fica na área dela.

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
| Linha de lista de militares | Decisão da PLANEJAMENTO com aval do usuário (23/11/2026; item 32 da 6.17, `docs/decisoes.md`). Três linhas: patente (13 px, `apagado`) e nome de guerra (17 px estreita, 600); o nome completo em 15 px, `tinta`; os dados em etiquetas de dado. Pecúlio: matrícula, telefone e e-mail. Militares: matrícula, jornada e equipe, e a CNH ("Motorista B"). O dado que falta vira etiqueta âmbar ("Sem telefone"), junto do aviso de cadastro incompleto. Sem uma cor por tipo de dado |
| Linha de etapas | Decisão da PLANEJAMENTO a pedido do usuário (23/11/2026; item 33 da 6.17), primeiro uso na Escala dos oficiais. Passos numa lista, com `aria-current="step"` no atual. Círculo de 24 px: feito, com visto em `tinta`; atual, cheio de `tinta` com o número em branco; por vir, borda `encaixe` e número `apagado`. Nome em 15 px (o atual em 600, `tinta`; os outros `apagado`) e uma frase de 13 px embaixo. Entre os passos, uma linha de 2 px com ponta de seta. A ação do próximo passo, em botão principal, fica sobre a seta que sai do passo atual. No celular, em coluna. O vinho fica só no botão: o passo atual em `tinta` segue a regra do item escolhido |
| Etiqueta de dado | Como a etiqueta (24 px, raio 6, 13 px, peso 500), com fundo `passa`, borda de 1 px `linha`, texto `tinta` e um ícone de 14 px, em `apagado`, antes do texto |
| Etiqueta | Altura de 24 px, folga de 8 px, raio 6, 13 px, peso 500. Serviço: quadradinho de 8 px com a cor e texto `tinta`. Falta: `pendencia`. Erro: `alerta`, com ícone. Neutra: `passa` e `apagado` |

## Resposta do sistema

| Peça | Medidas e comportamento |
|---|---|
| Aviso de resultado | Embaixo, no meio da área de trabalho, a 16 px da borda (no celular, acima da barra do menu). Fundo `tinta`, texto branco, raio 6, sombra por cima, 44 px de altura mínima. `role="status"` |
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
| Área de trabalho | Folga de 16 px em cima e 24 dos lados; usa a largura toda |
| Tela de leitura | Conteúdo com até 720 px de largura |
| Painel de detalhe | 384 px, por cima da área de trabalho e só dela: título, mês, ação e filtros continuam à vista. Fecha com Esc e devolve o foco |
| Menu | Cada item com o ícone de 20 px antes do nome, na mesma linha, a 10 px; item de 36 px de altura; o da tela aberta em fundo branco e texto `vinho` |
| Ícones do menu | Os desenhos de hoje, refeitos num traço só: grade de 24, espessura de 1,75, pontas redondas, nada preenchido |
| Celular | Título em 20 px e a ação principal à direita dele; o mês na largura toda; a régua rola de lado, com 44 px por dia, e escolhe o dia que aparece; o painel sobe de baixo, até 84% da altura, com o véu |
| Menu no celular | Uma barra embaixo, em `vinho`: o ícone de 22 px em cima do nome, em 13 px; o item da tela aberta em fundo branco e texto `vinho` |
| Topo do menu | O brasão e o texto da unidade escolhida na árvore: o brasão inteiro, sem recorte, numa área de 40 px (32 no celular); a sigla em 17 px estreita, numa linha; o nome em 13 px, em até duas linhas (uma no celular). O que não cabe corta com reticências e aparece inteiro na dica |

O menu aparece no mockup com os ícones e a posição pedidos pelo usuário. Quais itens vão na barra de baixo do celular, o topo e o seletor de unidade são do bloco N3.

## Decisões de desenho

Tomadas pela DESIGN dentro da direção aprovada. O usuário vê todas no mockup.

1. O item escolhido (aba, caixa marcada, dia do calendário) é marcado em `tinta`. O vinho fica para a marca e a ação principal.
2. A etiqueta do serviço deixa de ter a cor atrás do texto: qualquer cor que o usuário escolher continua legível.
3. A borda dos campos e dos botões secundários escurece para `encaixe`, que dá 3,5 de contraste.
4. "Completa" deixa de ser um visto verde, igual ao do Pronto, e vira um visto cinza.
5. No vazio, o próximo passo é um botão secundário. O principal continua no alto.
6. O feriado deixa de ser escrito em vermelho, que passa a ser só de erro: fica em `apagado`, com um ponto na régua e no calendário.
7. O nível da estrutura que ainda não tem brasão usa o do nível de cima.
8. A marca da Grade não destaca o dia de hoje (decisão do usuário de 23/11/2026); o fim de semana fica em `passa`.

## Propostas de mudança de comportamento

O exemplo do mockup foi montado como a Escala do mês funciona hoje (conferido em `routes/_app/escala-do-mes.tsx` e em `componentes/escala-do-mes`). O que está abaixo é diferente de hoje e precisa de aceite antes de entrar num plano.

| # | Hoje | Proposta |
|---|---|---|
| P1 | Remover pede confirmação pela caixa do navegador. O militar vai para "Removidos", e "Permitir de novo" tira a marca sem devolver à vaga | Remover não pergunta: responde com o aviso, que diz a mesma consequência, e "Desfazer", que devolve o militar à vaga e tira a marca. "Removidos" e "Permitir de novo" continuam |
| P2 | Para trocar, remove-se um e escolhe-se outro | "Trocar militar" no menu da placa: remove e abre a escolha em seguida |
| P3 | "Escolher militar" é um diálogo no meio da tela | Abre no painel de detalhe, ao lado, com o quadro à vista. O conteúdo é o de hoje: a busca, quem pode ocupar a vaga e a frase "Ficaram de fora" |
| P5 | A matrícula aparece em cada linha da guarnição | Sai da placa do quadro. Fica na dica da placa, na lista de escolha e na ficha |
| P6 | No mês sem ninguém escalado, a tela mostra só as vagas vazias | Uma frase no alto diz o próximo passo: gerar a pré-escala |
| P7 | No celular, o menu abre de lado, por um botão | O menu fica numa barra embaixo, com o ícone em cima do nome (diretriz do usuário, posição escolhida pela PLANEJAMENTO) |

A régua dos dias e a abertura da tela no dia de hoje, que estavam aqui como P4, são da Escala do mês e vão para a área dela.

"Gerar pré-escala" continua abrindo a conferência de hoje, com a equipe do dia 1 e o resumo do que entra. "Ocultar guarnições completas" continua com o nome e o efeito de hoje.

## Organização em áreas

Pedido do usuário de 23/11/2026. Os mockups da refatoração ficam em `docs/telas/refatoracao/`:

- `index.html`: o índice, com o estado de cada área (por fazer, em revisão pelo usuário, aprovada).
- `diretrizes-gerais/`: esta área. Vale para todas as telas.
- Uma pasta para cada tela principal, criada quando a tela for desenhada: Grade geral, Escala do mês, Efetivo por dia, Escala dos oficiais, Voluntariado e Cotas, Pecúlio, Militares e ficha, Configurações, Tela inicial e moldura, e as de consulta da fase 7. Cada uma traz o mockup e a lista do que muda em relação à tela de hoje.
- `pecas.css` e `pecas.js`: as peças que todas as áreas usam. Mudou uma peça, mudou em todas.

A página de cada área é um documento completo; o índice é publicado como a página do artifact e as áreas vão junto, como arquivos dele.

## Fora deste documento

- O desenho de cada tela: fica na área dela.
- O teste que recusa cor e tamanho fora dos tokens (N1.5): é da DESENVOLVIMENTO, com os valores das tabelas acima.

## Pendências

- Grade geral: a cor do serviço sozinha pode não bastar quando há muitos serviços. Resolver na área da Grade geral.

- Aprovação do mockup pelo usuário.
- Confirmar que o cartão da guarnição traz a origem do serviço, para a regra do nome do serviço na placa.
- O exemplo do mockup é um dia só e não traz a escolha da escala, as cotas restantes nem o acúmulo: entram na área da Escala do mês.
- P1 pede que a API devolva o militar à vaga ao desfazer; hoje ela só tira a marca de remoção.
- Conferir o contraste e o foco com ferramenta e com leitor de tela, no site, depois da implementação.
- `2026-11-16-telas.md` descreve a identidade de hoje: a DOCUMENTAÇÃO atualiza quando a fundação entrar no código.
