# Voluntariado por faixa de horário — design

Data: 19/11/2026. Decidido em conversa com o usuário (escalante da 1ª SB), depois de conversar com os militares e testar os mockups em `docs/telas/mockup-voluntariado-faixas.html` no computador e no celular.

## Por quê

O voluntariado de hoje (entrega 2) guarda **turno padrão A (08h às 20h) e B (20h às 08h)**. Dois problemas apareceram no uso:

1. **Os serviços têm turnos de tamanhos diferentes** (12h no Pronto e no CPRH, 8h no PE Seguro e no Bioma) e no futuro podem existir de 6h. Com A e B, quem só pode das 16h às 00h precisa marcar A e B e passa a parecer disponível também para um serviço das 08h às 20h.
2. **Não se pode perguntar a operação**: há operações piores que outras no mesmo tipo de turno, e os militares só se voluntariariam para as boas. O militar diz **quando** pode; o escalante decide **onde** ele entra. (O modelo atual já respeita isso; o design novo mantém.)

## Objetivos

- O militar informa a disponibilidade por **faixas de horário do dia**, sem escolher serviço nem operação.
- As faixas sempre casam com os turnos dos serviços cadastrados, e se ajustam sozinhas quando um serviço com horário novo é cadastrado.
- O escalante lança (versão inicial); nas versões finais o próprio militar lança. O Google Forms deixa de ser necessário.
- Funciona bem no computador e no celular.

## Não objetivos

- Faixa livre (slider) ou pintura livre da régua: descartadas (ver Abordagens).
- Importação do Google Forms (fase 6) não é adaptada agora; a meta é que o militar lance direto no sistema.
- O próprio militar lançar (fase 7, institucional) fica para depois; o design só não pode impedir.

## Abordagens consideradas

1. **Faixa livre (slider por dia).** Intervalos descontínuos ruins de marcar, 30 sliders por mês, marcações quase iguais que não casam com nenhum serviço. Descartada.
2. **Blocos fixos (ex.: 3h).** 3h não alinha com 08h; 4h alinha hoje mas quebra com um serviço das 06h às 12h; 1h dá 24 quadrados por dia. Descartada.
3. **Zoom de discretização.** Marcação fina não aparece direito na escala grossa; uma configuração a mais. Descartada.
4. **Blocos derivados dos horários dos serviços** — **escolhida.** O dia é cortado em todos os horários de início e fim dos turnos cadastrados. Hoje (00h, 08h, 16h e 20h) são 4 blocos: 00–08, 08–16, 16–20 e 20–24.
5. **Régua de 24h pintável.** Livre e visual, mas permite trecho que não serve para nenhum serviço e é imprecisa no toque. Descartada como forma de marcar; **a disposição dela (um dia por linha) entra no celular**.
6. **Padrão semanal + exceções.** Pode virar um atalho no futuro; não substitui a forma de marcar.

**Guarda dos dados (aprovado):** a disponibilidade é guardada como **horários (início e fim) por dia**, não como letras de bloco. A tela só desenha os blocos; trocar a tela no futuro não exige refazer dados.

## Regras

- **Cortes do dia** (chamada da PROGRAMAÇÃO, a confirmar): os horários de início e fim dos turnos dos serviços **ativos da seção que pedem voluntariado** (PJES e diária), mais 00h e 24h. Ordinários (Pronto, Saldo, Expediente) não pedem voluntariado e não cortam. Valem os serviços de hoje, para qualquer mês aberto (turnos não têm vigência); o bloco parcial cobre um corte que some. Com os serviços de hoje: 00h, 08h e 16h (PE Seguro e Bioma) e 20h (CPRH). Um turno que atravessa a meia-noite (20h às 08h) corta em 20h e em 08h. Blocos = intervalos entre cortes consecutivos.
- **Disponibilidade**: por militar e dia, uma lista de faixas `[início, fim)` dentro do dia (00h a 24h). Faixas encostadas ou sobrepostas são unidas ao gravar.
- **Cabe no turno**: um turno de serviço `[início, fim)` vale para o militar se toda a duração estiver coberta pela disponibilidade; o que passa da meia-noite usa o dia seguinte (o turno pertence ao dia em que começa, como hoje). Ex.: Pronto B do dia 5 (20h às 08h) precisa de 20h–24h do dia 5 e 00h–08h do dia 6.
- **Consequência boa**: o serviço das 00h às 08h do dia 1 pede só o bloco 00–08 do próprio dia 1 — some o problema de depender do turno B do último dia do mês anterior.
- **Bloco "parcial"**: se um serviço for desativado e um corte sumir, um bloco maior pode ficar só em parte coberto pelo que estava gravado. A tela mostra esse bloco como parcialmente marcado (listrado) e clicar nele marca o bloco inteiro.
- **Conversão do que existe**: A do dia D vira 08h–20h do dia D; B do dia D vira 20h–24h do dia D e 00h–08h do dia D+1 — mesmo quando D+1 é de outro mês (o pedaço vai para o dia 1 do mês seguinte, sem criar "já lançado" lá; nada se perde). Daí em diante cada dia é marcado no seu mês: quem pode das 20h do dia 30 às 08h do dia 1 marca os dois dias (chamada da PROGRAMAÇÃO). O "lançado" (`voluntariado_lancamento`) continua como está.
- **Lançar** continua substituindo o mês inteiro do militar (todas as faixas com data no mês).
- As demais regras da entrega 2 continuam: quem aparece na lista, "já lançado" com 0 horas, lotação no mês, ordem por nome, atalhos (fins de semana e folgas marcam o dia inteiro; copiar do mês anterior copia as faixas pelo número do dia).
- O motivo "Não marcou voluntariado neste horário" continua sendo a frase da lista "Escolher militar".

## Telas

**Computador (decisão do usuário: a opção 4, pela precisão do clique)** — o calendário do mês como hoje; em cada dia, o número e uma faixa com os blocos **em largura proporcional à duração** (a noite sombreada). Clicar no bloco marca só ele; clicar no número marca ou desmarca o dia inteiro; arrastar marca vários (mesma ação do primeiro). **Cada bloco mostra o horário** ao passar o mouse ou receber o foco ("08h às 16h") — pedido do usuário. Acima do calendário, a régua-legenda do dia com os blocos e os horários.

**Celular (decisão do usuário: mistura das duas)** — **um dia por linha** (como a régua da opção 5), com os **mesmos blocos proporcionais** em linha; **só toque no bloco inteiro, sem arrastar** (deslizar o dedo rola a página); no topo, os **rótulos só dos limites das faixas** (00h, 08h, 16h, 20h, 00h), alinhados aos cortes e parados durante a rolagem. O número do dia continua marcando o dia inteiro.

```
celular                      00h      08h      16h  20h  00h
  1 dom   [ 00–08 ][ 08–16 ][16–20][20–24]
  2 seg   [       ][███████][     ][     ]
  3 ter   [███████][       ][█████][█████]
```

Rodapé: "N horas em M dias." (ou "Nenhum horário marcado."). Os botões, o teclado (setas, espaço, Enter) e o aviso de alteração pendente seguem a entrega 2; no teclado, as setas andam pelos dias como hoje e Tab passa pelos blocos.

## Restrições

- Sistema novo (API Hono + Postgres, site React); o protótipo não muda (a regra nova é só do sistema novo: teste no `pacotes/dominio/test`, sem caso gravado).
- Dados fictícios nos testes (D7). Migração nova avisada no PR (`db:migrar:teste`).
- O escalante nunca é bloqueado de fechar a escala; a conversão não perde nenhuma marcação existente.

## Deixado ao construtor

- Nomes de tabela, colunas e funções; formato das horas no contrato (sugestão: `"HH:MM"`, com `"24:00"` para o fim do dia).
- Como detectar o celular (largura da tela) e o ponto de corte, dentro do padrão do site.
- O desenho exato do bloco parcial e da dica de horário.

---

## Adendo de 19/11/2026 (depois da entrega 2.2): flexibilidade, blocos do gestor e celular

Conversa com o usuário depois de usar a entrega 2.2 na sandbox. O que motivou: o CPRH e as eleições têm turnos que começam ou terminam às 07h, 15h, 19h e 23h. Cada horário vira um corte, e o dia ganhou faixinhas de 1h (07–08, 15–16, 19–20, 23–24): blocos de ~8px, difíceis de acertar no clique e no toque, rótulos encavalados ("07h 08h") e oito blocos por dia, que escondem o desenho manhã–tarde–noite.

### Flexibilidade do voluntariado (decidido)

- **O que é.** Um número de horas escolhido pelo gestor. Com 0h, a regra é estrita, como hoje: o militar precisa cobrir o turno inteiro. Com N horas, também fica apto quem deixa até N horas sem cobrir **no começo ou no fim** do turno.
- **Como conta.** O turno é conferido sem as N primeiras e as N últimas horas: com 1h, o 07h–15h é conferido como 08h–14h, e quem marcou 08–16 entra. **Um buraco no meio do turno continua barrando** (decisão do usuário). A falta não é somada (reprovado: conta desnecessária).
- **Onde fica.** Um parâmetro em Configurações, com vigência, **em qualquer nível hierárquico**, não só na seção (decisão do usuário). Usa o mecanismo que já existe: tabela `parametro`, com o valor próprio ou herdado do nível de cima. O padrão é 0h.
- **Quem usa.** A escalação automática (pré-escala, entrega 3) **segue a flexibilidade** definida pelo gestor. A lista "Escolher militar" também.
- **O que ela não afrouxa.** A flexibilidade só vale para o voluntariado. Choque de horário, descanso e as outras regras de elegibilidade continuam estritos. Exemplo: quem sai do Pronto às 08h e marcou 08–16 não entra no 07h–15h, nem com 1h de flexibilidade, porque às 07h ainda está no Pronto.
- **Sem aviso de falta na lista** (reprovado: polui a tela e piora o uso).
- **Chamada da PROGRAMAÇÃO (a confirmar).** Horas inteiras, de 0 a 3, para que o turno conferido nunca fique vazio: um turno de 8h com 4h de cada lado não conferiria nada.

### O escalante sempre pode passar por cima do voluntariado (decidido; falta na tela de hoje)

O escalante pode escalar quem não se voluntariou, porque combina direto com o militar (decisão do usuário). **Hoje a tela não deixa:** o "Escolher militar" tira da lista quem não marcou voluntariado e só mostra a contagem ("Ficaram de fora: 1 sem voluntariado"). Proposta da PROGRAMAÇÃO, a confirmar:

```
Ficaram de fora: 2 sem voluntariado neste horário  [Mostrar]
  └ ao tocar: CB BM DANTAS, SD BM FALCAO — escolhíveis, num grupo à parte
```

O grupo fica fechado por padrão, para não poluir. Só o voluntariado pode ser contornado: choque de horário, afastamento e CNH continuam tirando o militar da lista.

### De onde vêm os blocos do dia (pendente: decisão do usuário)

- **Reprovado:** "divide o dia" ligado ou desligado no cadastro do serviço (parece gambiarra).
- **Ideia do usuário:** uma escala fantasma "Voluntariado", sem cotas e sem guarnições, cujos turnos desenham os blocos. A PROGRAMAÇÃO aponta três custos:
  - ela apareceria nas telas de escalas, cotas e escala do mês;
  - o sistema teria de reconhecê-la de algum jeito, e pelo nome é frágil;
  - pela regra de hoje, ela **somaria** cortes aos do CPRH em vez de substituí-los.
- **Caminhos:**
  - **A. Escala marcada "define os blocos do voluntariado".** A ideia do usuário, com uma marcação em vez do nome. Quando ela existe, os blocos vêm só dela. Precisa ser escondida nas outras telas.
  - **B. Parâmetro "Horários do voluntariado"** (recomendação da PROGRAMAÇÃO). Fica ao lado da flexibilidade, em Configurações, por nível hierárquico e com vigência, por exemplo `00h, 08h, 16h, 20h`. Vazio quer dizer automático, a partir dos serviços, como hoje. Não cria entidade fantasma, e o gestor ajusta tudo num lugar só.
  - **C. Automático pela flexibilidade.** Some o corte que cria bloco menor que a flexibilidade. Não precisa de configuração, mas o sistema teria de adivinhar qual corte apagar (07h ou 08h?).
- **Juntos, os blocos do gestor e a flexibilidade resolvem o caso do CPRH e das eleições:** o dia volta a ter 4 blocos, e 1h de flexibilidade mantém essa gente apta.

### Celular: o painel do militar abre lá embaixo (decidido: modo foco)

- **O problema.** No celular, a lista de militares vem antes do calendário. Tocar num nome abre o painel depois de todos os nomes, fora da tela.
- **Opções consideradas:**
  - **Modo foco** (ideia do usuário, escolhida). Ao abrir um militar no celular, a lista some e só o painel dele aparece, com a página no topo. Ao salvar, a lista volta. É o padrão lista → detalhe dos aplicativos, e a tela fica limpa.
  - **Painel deslizante de baixo.** Disputa o gesto de rolagem com as 31 linhas do calendário. Descartado.
  - **Abrir o calendário logo abaixo do nome tocado.** Empurra os outros nomes para fora da tela e confunde a rolagem. Descartado.
- **Complementos propostos pela PROGRAMAÇÃO (a confirmar):**
  - **"‹ Militares" no topo do painel.** Volta à lista sem salvar, respeitando o aviso de alteração pendente. O botão voltar do celular faz o mesmo, porque a tela já guarda o militar aberto no endereço (`?militar=`).
  - **Barra fixa no rodapé da tela**, com o resumo ("N horas em M dias.") e o botão de salvar. Hoje o botão fica depois das 31 linhas e dos atalhos, longe do dedo.
  - **No celular, o botão vira "Salvar" e volta à lista**, como o usuário pediu. O próximo que falta lançar fica no alto de "Faltam lançar". No computador, continua "Salvar e ir para o próximo".
- **Só no celular** (a mesma largura de corte da entrega 2.2, 767px). No computador, lista e painel continuam lado a lado.

### Outros pontos levantados

- **Dia 24 (feriado) com barra cinza, sem blocos.** A tela do voluntariado não lê feriados, então a barra não vem do feriado: é provável defeito. Investigar na entrega 2.3, com teste que reproduza.
- **Achados menores adiados da revisão da 2.2**, que entram na 2.3 porque mexem na mesma tela:
  - recolocar os testes da entrega 2 que saíram na reescrita (dois cliques em Salvar, erro mantém as marcações, pendência, atalhos, teclado, foco no dia 1, último que falta);
  - arrastar para desmarcar sobre bloco parcial marca o bloco inteiro (M1);
  - o último rótulo é "24h", mas a spec diz 00h (M2);
  - o rodapé arredonda minutos (M4);
  - `matchMedia` no Safari antigo e teste que não restaura (M5).
  
  Os demais (M3, M6, M7, M8) ficam para quando a área for tocada.
