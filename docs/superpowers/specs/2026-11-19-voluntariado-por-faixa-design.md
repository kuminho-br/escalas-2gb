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
