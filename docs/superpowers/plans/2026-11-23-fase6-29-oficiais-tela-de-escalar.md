# Escala do oficial de operações: a tela de escalar (6.29) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a tela dos oficiais escala por serviço escolhido (JES ou Saldo), oficial escolhido e cliques nos dias, mostra os JES que restam na cota da unidade e segue as diretrizes gerais.

**Architecture:** a API ganha a cota de JES no mês e deixa de exigir voluntário JES na escala de rodada; o site troca o diálogo de lançamento por seleção (serviço + oficial) e clique no turno, e reorganiza a tela (faixa de etapas no cabeçalho, explicação recolhida, calendário compacto).

**Tech Stack:** Hono, zod, React, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-oficiais-tela-de-escalar-design.md`.

## Global Constraints

- **Urgente:** próxima entrega. Branch `fase6-29-oficiais-tela-de-escalar`, a partir da `main`. Sem migração.
- Ative a skill `frontend-design:frontend-design`; siga as diretrizes gerais (`docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md`); nenhum texto abaixo de 13 px; um só botão principal na tela.
- Textos fixos: "Escalar:"; "JES restam {n} de {cota}"; "Sem cota de JES cadastrada no mês."; "A cota de JES do mês acabou."; "Escolha um oficial na lista."; "Trocar {patente} {nome} por {patente} {nome}?"; "Como funciona o mês".
- Nada bloqueia o escalante: cota de JES acabada, fora da vez e sem cota são avisos.
- Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador, com dados fictícios, em 1440, 1280 e 390 px.

## Review Focus

1. **Clique rápido em vários dias seguidos:** cada clique lança uma vez, na ordem, sem lançamento duplicado nem perdido (os cliques esperam o anterior ou entram numa fila).
2. **Oficial da vez completa a cota no meio dos cliques:** a escolha passa ao próximo só com Saldo; com JES não muda.
3. **Cota de JES com JES lançado em outra escala da unidade:** o "restam" conta os JES da unidade inteira no mês, não só os da escala dos oficiais.
4. **Clique num turno com afastamento do oficial escolhido:** recusado com a mensagem de hoje, sem lançar.
5. **Celular (390 px):** o seletor de serviço, a lista e o calendário cabem sem rolagem de lado; a lista fica acima do calendário e recolhe.

---

### Task 1: a API

**Files:** Modify `apps/api/src/oficiais/rotas.ts` (sai a recusa `MSG_SO_VOLUNTARIO` na escala de rodada), `apps/api/src/oficiais/leitura.ts` (a cota de JES), `pacotes/contratos/src/oficiais.ts`; Test `apps/api/test/oficiais*.test.ts`

**Interfaces:**
- Produces: o `GET /api/unidades/:u/oficiais/:mes` ganha `jes: { cota: number | null; usados: number }` — `cota` = soma de `cota.quantidade` da unidade, do serviço JES da escala, no mês (null sem cadastro); `usados` = alocações do serviço JES da unidade no mês, em todas as escalas dela.

- [ ] **Step 1: testes:** lançar JES para um elegível que não é voluntário JES → 201; `jes.cota` e `jes.usados` com JES lançado na escala dos oficiais e em outra escala da unidade (Review Focus 3); sem cota cadastrada → `cota: null`; com a cota acabada, lançar JES continua 201.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.29: JES para todos os elegíveis e a cota de JES no mês`.

### Task 2: escalar por serviço, oficial e clique

**Files:** Modify `apps/web/src/componentes/oficiais/EscalaDoMes.tsx`, `CalendarioDosOficiais.tsx`, `ListaDeCotas.tsx`; Create `apps/web/src/componentes/oficiais/SeletorDeServico.tsx`; Test `apps/web/src/__testes__/oficiais.test.tsx`

**Interfaces:**
- Produces: `SeletorDeServico({ servico: 'jes' | 'saldo'; aoMudar; jes: { cota: number | null; usados: number } })`; o estado da tela guarda `servico` e `oficialId` escolhidos; sai o diálogo de lançamento por turno.

- [ ] **Step 1: testes:** "Escalar: JES | Saldo" no alto, com o restante de JES e os textos da spec; com Saldo, o oficial da vez vem escolhido e, ao completar a cota, passa ao próximo (Review Focus 2); com JES, a lista mostra todos os participantes e nenhum vem escolhido; clicar num turno livre lança o escolhido no serviço escolhido; clicar no próprio lançamento tira; clicar no de outro pergunta "Trocar…"; sem oficial escolhido, "Escolha um oficial na lista."; cliques seguidos em vários dias lançam todos (Review Focus 1); afastado é recusado (Review Focus 4); o aviso "Fora da ordem…" continua com Saldo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.29: escalar por serviço, oficial e clique nos dias`.

### Task 3: a tela nas diretrizes gerais

**Files:** Modify `apps/web/src/componentes/oficiais/EscalaDoMes.tsx`, `CalendarioDosOficiais.tsx`, `MensagensDoMes.tsx` (a linha de etapas), `RegrasDosOficiais.tsx`, `apps/web/src/routes/_app/oficiais.tsx`; Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:** a etapa atual em texto e o botão da próxima ação no cabeçalho (um só principal); "Como funciona o mês" abre e fecha a explicação das quatro etapas; o calendário sem caixa por dia, com os dois turnos colados; nome em 15 px e patente em 13 px; a placa do turno sem a etiqueta "Saldo" escrita (a faixa de cor diz o serviço, e a dica e o leitor de tela dizem o nome); os dias vermelhos com a legenda acima do calendário; nenhuma rolagem de lado em 390 px (Review Focus 5).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar as três larguras para o PR. **Step 5:** commit `Fase 6.29: a tela dos oficiais nas diretrizes gerais` e abrir o PR.

---

# Entrega 6.29.1 — Ajustes do usuário na tela dos oficiais (23/11/2026)

Branch `fase6-29-1-ajustes-oficiais`, a partir da `main`. Sem migração. Antes de seguir a 6.20.

### Task 4: três ajustes

**Files:** `apps/api/src/oficiais/participantes.ts` e `leitura.ts`, `apps/web/src/componentes/oficiais/ListaDeCotas.tsx` e `EscalaDoMes.tsx`; Test `apps/api/test/oficiais*.test.ts`, `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:**
  - Sai o texto "cota menor: …" da linha do oficial (a cota continua a mesma).
  - **Elegíveis só da unidade da escala e das de baixo.** Um oficial QOC lotado numa unidade **acima** da unidade da escala (ex.: na DInter/1, com a escala na 1ª SB) não aparece na lista nem é aceito na participação (400 "Este oficial não é elegível neste mês."). A unidade de referência é a da escala, não a escolhida no seletor. Conferir também o mês já gravado: quem está fora deixa de aparecer como elegível (os lançamentos já feitos ficam).
  - **Como as cotas foram calculadas:** sai o parágrafo solto do pé da lista ("56 turnos para a rodada de Saldo…") e entra o botão discreto "Como as cotas foram calculadas", que abre um painel recolhível com a conta do mês, em frases curtas: turnos do mês; menos os de JES; turnos para a rodada de Saldo; quantos participam; a divisão (inteira e quebrada); quantos sobraram depois do arredondamento e para quem foram (os mais modernos); os dias de afastamento que reduziram a cota de alguém (o que saiu da linha do oficial); e "O saldo aparece na lista, mas ainda não entra na conta.".
- [ ] **Step 2:** FAIL. **Step 3:** implementar (skill `frontend-design:frontend-design`). **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador. **Step 5:** commit `Fase 6.29.1: ajustes da tela dos oficiais` e abrir o PR.

---

# Entrega 6.29.2 — Segundo retorno do usuário na tela dos oficiais (23/11/2026)

Branch `fase6-29-2-oficiais`, a partir da `main`. Sem migração. Antes de seguir a 6.20. Skill `frontend-design:frontend-design`.

### Task 5: seleção, cliques e lançamento

**Files:** `apps/web/src/componentes/oficiais/EscalaDoMes.tsx`, `CalendarioDosOficiais.tsx`, `ListaDeCotas.tsx`, `SeletorDeServico.tsx`; Create `apps/web/src/componentes/oficiais/EscolherOficial.tsx`; Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:**
  - O serviço que já vem escolhido ao abrir a tela é **Saldo**.
  - Qualquer oficial da lista pode ser escolhido, em qualquer ordem (nada trava depois de quem está na vez). O oficial da vez só fica destacado: fundo avermelhado claro e borda escura.
  - Depois de cada lançamento, nenhum contorno de foco fica preso no último turno clicado (o contorno aparece só na navegação pelo teclado, `:focus-visible`).
  - Clicar em qualquer área da tela que não seja uma placa do calendário **tira a escolha do oficial**.
  - **Sem oficial escolhido:** clicar numa placa preenchida pergunta "Remover {patente} {nome} do dia {dd/mm} ({Dia|Noite})?" e, confirmando, tira o lançamento; clicar numa placa livre abre `EscolherOficial`: a lista dos participantes com uma busca por nome (filtra enquanto digita, sem diferenciar maiúsculas e acentos); escolher lança o oficial no serviço escolhido.
  - Sai o aviso que diz quem foi o último lançado ("X ficou com o turno…").
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.29.2: escolher, tirar e lançar sem travar a ordem`.

### Task 6: painel, saldo do mês, dias vermelhos e legenda

**Files:** os mesmos, mais `apps/api/src/oficiais/leitura.ts` e `pacotes/contratos/src/oficiais.ts` (a prévia do saldo); Test os de oficiais da API e do site

**Interfaces:**
- Produces: na linha de cada oficial, `saldoPrevisto: number` = saldo acumulado até o mês anterior + (turnos de Saldo tirados no mês − devido no mês, com a parte quebrada); ex.: saldo 0, devido 1,5, tirou 1 → −0,50.

- [ ] **Step 1: testes:**
  - Sai a marca "novo" do nome do oficial.
  - A linha do oficial mostra o saldo do mês já durante a montagem: "Saldo 0,00 → −0,50 no mês" (a prévia muda a cada lançamento; o acumulado só muda ao encerrar, como hoje).
  - **Tela na altura da janela:** a página termina pouco depois do calendário (com uma folga de 24 px embaixo do calendário), e o painel da direita rola sozinho, por dentro, enquanto o calendário fica parado.
  - **Dias vermelhos à vista:** um botão "Marcar dias vermelhos" ao lado do seletor de serviço liga um modo em que clicar no dia marca ou tira o dia vermelho (o botão fica ligado e diz "Concluir"); o dia vermelho tem a faixa vermelha à esquerda das duas placas e "Dia vermelho" para leitor de tela.
  - **A legenda vai para baixo do calendário**: Dia, Noite, JES, Saldo e Dia vermelho.
  - Sem rolagem de lado em 1440, 1280 e 390 px (no celular a página volta a rolar inteira).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.29.2: painel rolando, saldo do mês, dias vermelhos e legenda` e abrir o PR.
