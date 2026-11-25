# Histórico de rastreio (6.49): o quadro "Hoje", uma mudança por bloco e as marcas da linha do tempo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo (decisão do usuário, 24/11/2026): front-end no Fable.** Se a sessão estiver em outro modelo, avise o usuário antes de começar e espere. Revisão final no Opus.

**Goal:** a seção "Histórico de rastreio" da ficha do militar passa a seguir o mockup da DESIGN: um quadro "Hoje" no alto, a linha do tempo com uma mudança por bloco (uma linha por campo que mudou e quem fez), marcas diferentes para cada caso, os afastamentos fora da linha e o histórico longo cortado nos 5 mais novos.

**Architecture:** só o site. O ajudante `lib/linha-do-tempo-militar.ts` deixa de produzir texto pronto e passa a produzir **eventos estruturados** (o que mudou, campo a campo, e como cada evento vale hoje); `componentes/militares/Rastreio.tsx` desenha o quadro e a linha a partir deles; `componentes/militares/Secao.tsx` esconde o texto ao lado do título quando a seção está aberta (vale para todas as seções da ficha). O formulário "Alterar situação" e a API não mudam.

**Tech Stack:** React, Tailwind 4, Vitest.

**Mockup (o que vence este plano onde diferir):** `docs/telas/refatoracao/historico-de-rastreio/index.html`, da DESIGN, **parcialmente aprovado pelo usuário em 25/11/2026** ("pode usar a versão que ele fez até o momento para construir o real"). As três perguntas do mockup ficam com a recomendação da DESIGN: o texto ao lado do título some em **todas** as seções quando abertas; o quadro se chama **"Hoje"**; o histórico longo começa com os **5** mais novos. As modificações que o usuário ainda fizer viram entrega de ajuste.

**Pedidos do usuário (24/11/2026, feedback do piloto):** mais separação entre as situações; recolhida, a seção mostra só a unidade e a jornada; o texto some quando a seção abre; manter a linha do tempo à esquerda; os afastamentos ficam só na seção Afastamentos (decisão de 24/11, `docs/decisoes.md`).

## Escolhas (do mockup, resumidas para quem implementa)

- **Quadro "Hoje":** fundo `passa`, raio 6, folga de 12 px em cima e 16 dos lados. Primeira linha, em 13 px `apagado`, com um ponto cheio de 10 px `tinta` antes: "**Hoje**, desde 12/08/2026". Depois, cinco pares rótulo (13 px, `apagado`) e valor (17 px estreita, 600): Lotação (valor em 20 px), Equipe, Jornada, Quadro, Situação. O que falta vem "Sem equipe" / "Sem quadro" em 500, `apagado`. No celular (seção com até 520 px), a lotação ocupa a linha inteira e os outros ficam em duas colunas. **Sem lotação hoje:** só a primeira linha, "**Hoje**, sem lotação", com o ponto vazado (borda de 2 px `encaixe`); havendo um período marcado para depois, a frase é "**Hoje**, sem lotação · lotação a partir de 01/01/2027".
- **Linha do tempo:** lista ordenada (`aria-label="Mudanças, da mais nova para a mais antiga"`), o trilho de 2 px `linha` à esquerda, texto a 28 px, 24 px entre eventos, sem caixas. Cada evento: a data em 15 px estreita 600 (`tinta` no que vale agora e no marcado; `apagado` nos outros); o corpo; "por MAJ BARRETO em 10/08/2026 às 09:15" em 13 px `apagado` (só quando a ficha traz o autor).
  - **Corpo do primeiro registro:** a situação inteira numa frase ("DGO · ADM · Ativa", só o que existe), com o texto "Primeiro registro" ao lado da data.
  - **Corpo das mudanças:** uma linha por campo que mudou, na ordem Lotação, Equipe, Jornada, Quadro, Situação: rótulo de 64 px em 13 px `apagado`; valor antigo em `apagado`, seta "→" (`aria-hidden`), valor novo em 600 `tinta`. Para o leitor de tela, "de X para Y". O que falta: "sem equipe", "sem quadro" (minúsculo, no meio da frase). Nenhum campo mudou: "Sem mudança na situação".
  - **Marcas (o ponto):** *vale agora* 12 px cheio `tinta` (uma só por histórico, a mesma do quadro "Hoje"); *anterior* 8 px cheio `encaixe`; *primeiro registro* 10 px vazado, borda 2 px `encaixe` (o trilho termina nele); *marcada* (data futura) 12 px vazado, borda 2 px `tinta`, com a etiqueta neutra "Ainda não vale" ao lado da data e o trilho **tracejado** em `encaixe` dela até a de agora. O leitor de tela ouve ", vale agora" no evento atual. O primeiro registro pode ser também o que vale agora: ponto cheio `tinta` de 12 px.
  - **Dias sem lotação** (entre o fim de um período e o começo do seguinte): um item sem ponto, "Sem lotação de 01/03 a 09/03/2025" (o ano nas duas datas quando o intervalo atravessa a virada), e o trilho **para antes e recomeça depois** dele.
  - **Histórico longo:** com mais de 5 itens (eventos e vãos contam juntos), mostram-se os 5 mais novos e, no fim, um botão `discreto` "Ver todo o histórico (n)" (n = total); aberto, vira "Mostrar só os mais novos". O foco fica no botão ao alternar.
  - **Vazio:** "Para lançar a primeira lotação, use "Alterar situação"." em `apagado`.
- **Afastamentos** saem da linha do tempo (ficam só na seção Afastamentos).
- **Texto ao lado do título (`resumo`):** recolhida, "1ª SB · Pronto" (unidade e jornada do período de hoje); sem período de hoje, "Sem lotação" ou "Lotação a partir de 01/01/2027". **Aberta, o texto some, em todas as seções da ficha** (`Secao.tsx`).
- Sai a frase "Situação atual: …" de cima da linha (o quadro a substitui).
- "Alterar situação" continua como ação da seção, para quem já pode; o formulário não muda.

## Global Constraints

- Branch `fase6-49-historico-de-rastreio`, a partir da `main` (depois da 6.46). Sem migração, sem API, sem mudança em `contratos`.
- Skill `frontend-design:frontend-design`; só tokens do Manual (`tinta`, `apagado`, `encaixe`, `linha`, `passa`, `superficie`); nenhuma cor solta (guarda de estilo da 6.20). O vermelho (`vinho`) sai da linha do tempo.
- Textos fixos: "Hoje", "Primeiro registro", "Ainda não vale", "Sem mudança na situação", "Sem lotação", "sem equipe", "sem quadro", "Ver todo o histórico (n)", "Mostrar só os mais novos", "Para lançar a primeira lotação, use "Alterar situação".".
- O dia de hoje vem de `hoje()` (`lib/meses`), como já é.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px, com um militar de histórico longo (mais de 5 itens), um com mudança marcada para o futuro e um sem lotação. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Mudança marcada para o futuro:** o ponto cheio fica no período que cobre hoje, não no mais novo; o quadro "Hoje" mostra o de hoje; o marcado aparece acima com "Ainda não vale" (Task 1 e 3).
2. **Período de hoje já terminado e nenhum seguinte** (`ate` passou, sem lotação agora): o quadro diz "Hoje, sem lotação"; a linha do tempo mostra o último período como *anterior* e nenhum como *vale agora* (Task 1 e 3).
3. **Histórico de exatamente 5 itens:** sem botão; de 6: botão com "(6)" e 5 à vista (Task 3).
4. **Vão entre o 5º e o 6º item** no corte: o 5º item mostrado não deve desenhar o trilho até um vão que ficou escondido (Task 3).
5. **Trocar de militar com o histórico expandido:** a ficha nova começa recolhida nos 5 (o estado "ver tudo" não vaza entre militares; a `key` da rota já troca o componente) (Task 3).

---

### Task 1: os eventos estruturados do rastreio

**Files:** Modify `apps/web/src/lib/linha-do-tempo-militar.ts`; Test `apps/web/src/__testes__/linha-do-tempo-militar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type Campo = 'lotacao' | 'equipe' | 'jornada' | 'quadro' | 'situacao';
  export const ROTULO_DO_CAMPO: Record<Campo, string>; // Lotação, Equipe, Jornada, Quadro, Situação
  export type Mudanca = { campo: Campo; antes: string; depois: string }; // já com "sem equipe"/"sem quadro" e o nome da jornada (NOME_JORNADA)
  export type EventoDoRastreio =
    | { tipo: 'inicio' | 'mudanca'; desde: string; vale: 'agora' | 'antes' | 'marcada'; inteira: string; mudancas: Mudanca[]; autor?: string }
    | { tipo: 'vao'; de: string; ate: string; texto: string }; // "Sem lotação de dd/mm a dd/mm/aaaa"
  export function periodoAtual(rastreio: Periodo[], dia: string): Periodo | null; // o que cobre `dia`
  export function eventosDoRastreio(rastreio: Periodo[], dia: string): EventoDoRastreio[]; // do mais novo para o mais velho
  export function valorDoCampo(p: Periodo, campo: Campo): string | null; // null quando falta (equipe, quadro)
  ```
- `ddmmaaaa`, `textoDoAutor` e `situacaoInteira` continuam exportados. `linhaDoTempoDoMilitar` e `ItemDaLinhaDoTempo` **saem** (o único uso é `Rastreio.tsx`, refeito na Task 3). `periodoAtual` sai de `Rastreio.tsx` e vem para cá, com o dia como parâmetro (testável sem relógio).

- [ ] **Step 1: testes** (substituem os de `linhaDoTempoDoMilitar`; os dados fictícios do mockup servem): o primeiro período vira `inicio` com `inteira` e `mudancas: []`; cada outro vira `mudanca` com só os campos que mudaram, na ordem fixa; "sem equipe"/"sem quadro" nos valores que faltam; a jornada vem pelo nome (`NOME_JORNADA`); `vale` é `agora` no que cobre `dia`, `marcada` no de `desde` futuro, `antes` nos outros; **só um `agora`** (Review Focus 1); com `ate` passado e sem seguinte, nenhum `agora` (Review Focus 2); o vão entre dois períodos vira `vao` com o texto certo (ano só na virada); os afastamentos não entram (a função não os recebe); a saída vem do mais novo para o mais velho, o vão entre os dois períodos que ele separa; `autor` como hoje.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (`pnpm --filter web test linha-do-tempo`). **Step 5:** commit `Fase 6.49: os eventos do rastreio, campo a campo`.

### Task 2: o texto ao lado do título some com a seção aberta

**Files:** Modify `apps/web/src/componentes/militares/Secao.tsx:44`; Test `apps/web/src/__testes__/militares.test.tsx` (onde já se testa a ficha)

- [ ] **Step 1: teste:** uma seção com `resumo` recolhida mostra o texto no botão do título; aberta, o texto não está na tela; o `aria-expanded` continua.
- [ ] **Step 2:** FAIL. **Step 3:** `{!aberta && resumo && …}`. **Step 4:** PASS. **Step 5:** commit `Fase 6.49: o resumo da seção só quando recolhida`.

### Task 3: a seção redesenhada

**Files:** Modify `apps/web/src/componentes/militares/Rastreio.tsx` (o componente `Rastreio`; `AlterarSituacao` fica igual); Create `apps/web/src/__testes__/rastreio.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`periodoAtual`, `eventosDoRastreio`, `valorDoCampo`, `ROTULO_DO_CAMPO`, `ddmmaaaa`), `proximoPeriodo` de `lib/militares`, `Button variant="discreto"`, `Secao` (Task 2).
- Produces, dentro do arquivo: `QuadroHoje({ atual, proximo })` e `LinhaDoTempo({ eventos })` (com o estado `tudo`), para o teste achar pelos textos e pelos papéis; a constante `MAIS_NOVOS = 5`.

- [ ] **Step 1: testes** (render com uma `FichaMilitar` fictícia e `hoje()` fixado por `vi.useFakeTimers`/`setSystemTime`, como os outros testes do site fazem):
  - o `resumo` da seção recolhida é "1ª SB · Pronto"; sem período de hoje, "Sem lotação" ou "Lotação a partir de dd/mm/aaaa";
  - o quadro tem o texto "Hoje" e os cinco rótulos com os valores; "Sem equipe" quando falta; sem lotação hoje, "Hoje, sem lotação" e nenhum rótulo;
  - a lista `Mudanças, da mais nova para a mais antiga` tem um item por evento; o item do período de hoje tem o texto "vale agora" (para o leitor); o marcado tem "Ainda não vale"; o primeiro tem "Primeiro registro"; o de mudança tem "Equipe", "de sem equipe para ALFA" na leitura e a seta escondida;
  - a frase "Situação atual:" não existe mais; nenhum afastamento na lista (a ficha de teste traz um e ele não aparece);
  - com 5 itens, não há botão; com 9, aparecem 5 e o botão "Ver todo o histórico (9)"; clicado, aparecem 9 e o botão diz "Mostrar só os mais novos", e o foco está nele (Review Focus 3);
  - o item antes de um vão escondido pelo corte não recebe a classe do trilho "até o vão" (Review Focus 4);
  - a classe/`data-vale` do ponto muda com `vale` e `tipo` (agora, antes, inicio, marcada), e o vão não tem ponto;
  - vazio: "Para lançar a primeira lotação, use "Alterar situação".";
  - "Alterar situação" continua aparecendo só com `podeEditar.peculio`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar seguindo as medidas das Escolhas (Tailwind com os tokens; o trilho por pseudo-elemento ou borda do `li`, como o mockup; o tracejado só no evento `marcada`). **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px e fotografar os três casos. **Step 5:** commit `Fase 6.49: o histórico de rastreio com o quadro Hoje e as marcas` e enviar a branch à PLANEJAMENTO.

### Fora do plano (PLANEJAMENTO, no PR de docs)

- `docs/decisoes.md`: a aprovação parcial do mockup (25/11) e as três recomendações da DESIGN adotadas.
- O pool: os itens do rastreio passam a "planejado · 6.49".
- A DESIGN tira do mockup o "Versão 1, em revisão por você" quando o usuário fechar as modificações.
