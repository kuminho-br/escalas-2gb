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
