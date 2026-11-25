# Pecúlio Geral (6.50): as três telas, a ficha no lugar e a lista — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o módulo passa a se chamar "Pecúlio Geral", com as telas "Pecúlio da unidade", "Pesquisar militares" e "Aniversários"; a ficha completa abre dentro do Pecúlio, sem passar pela aba Militares das escalas; a lista ganha divisória entre os itens.

**Architecture:** reorganização de rotas do site e um parâmetro na API. As rotas novas ficam sob `/peculio`; `/consulta` e `/consulta/$id` passam a redirecionar; a ficha em `/peculio/militar/$id` escolhe, pela permissão, entre a ficha completa (os componentes de `componentes/militares/*`) e a de consulta. Nesta entrega a pesquisa continua a de hoje (texto e unidade): os filtros e a seleção são a 6.51.

**Tech Stack:** Hono, zod, React, TanStack Router e Query, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-peculio-geral-e-atualizacao-em-lote-design.md` (decisões 1 a 3; "A ficha no Pecúlio"; "Aniversários"; "A lista").

## Global Constraints

- Branch `fase6-50-peculio-geral-as-telas`, a partir da `main`. Sem migração.
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; `EscolherUnidade` (6.45); a guarda de estilo e a de unidades continuam passando.
- A borda de visão não muda: o que cada conta vê de cada militar é o de hoje.
- Textos fixos: "Pecúlio Geral"; "Pecúlio da unidade"; "Pesquisar militares"; "Aniversários"; "Incluir as unidades de baixo"; "Nenhum aniversário em {mês}.".
- **A lista** (escolha da PLANEJAMENTO, a DESIGN pode ajustar depois): linhas com divisória de 1 px no token `linha`, dentro de um painel só; a mesma peça na lista da unidade e no resultado da pesquisa.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px, com uma conta com nível de acesso e uma de militar comum. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Endereços antigos:** `/consulta`, `/consulta/$id` e `/militares/$id?de=peculio` (favoritos, links nas telas) levam à tela nova equivalente, sem tela em branco (Task 1 e 2).
2. **Militar comum:** entra direto em "Pesquisar militares", não vê "Pecúlio da unidade", e a ficha que abre é a de consulta (Task 1 e 2).
3. **Quem tem nível de acesso sobre uns e não sobre outros:** a ficha completa para os primeiros e a de consulta para os outros, na mesma rota (Task 2).
4. **"Incluir as unidades de baixo" desligado numa unidade sem militares lotados direto nela** (o 2º GB): lista vazia com a frase "Nenhum militar lotado direto em {unidade}. Ligue "Incluir as unidades de baixo"." (Task 3).
5. **29 de fevereiro:** o aniversariante aparece em 28/02 nos anos sem o dia 29 (Task 4).

---

### Task 1: o módulo, o trilho e os endereços

**Files:** Modify `apps/web/src/lib/modulos.ts` (nome "Pecúlio Geral"; itens "Pecúlio da unidade" `/peculio`, "Pesquisar militares" `/peculio/pesquisar`, "Aniversários" `/peculio/aniversarios`; `moduloDoEndereco`); Create `apps/web/src/routes/_app/peculio_.pesquisar.tsx` (a tela de `consulta.tsx`, movida); Modify `apps/web/src/routes/_app/consulta.tsx` e `consulta_.$id.tsx` (redirecionam); Test `apps/web/src/__testes__/modulos*.test.tsx`, `consulta*.test.tsx`

- [ ] **Step 1: testes:** o atalho e o trilho com os nomes novos; Review Focus 1 (os dois endereços de consulta) e 2.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.50: o Pecúlio Geral e as suas telas no trilho`.

### Task 2: a ficha dentro do Pecúlio

**Files:** Create `apps/web/src/routes/_app/peculio_.militar.$id.tsx`, `apps/web/src/componentes/militares/FichaCompleta.tsx` (o miolo de `routes/_app/militares/$id.tsx`, com `completa: boolean`); Modify `apps/web/src/routes/_app/militares/$id.tsx` (usa `FichaCompleta` sem os blocos do Pecúlio; `?de=peculio` redireciona para a rota nova), `peculio.tsx` e a pesquisa (os links das linhas); Test `apps/web/src/__testes__/peculio*.test.tsx`, `militares.test.tsx`

**Interfaces (Produces):** `FichaCompleta({ ficha, unidadeId, completa, voltarPara })`; a rota nova pede `consultaFicha(id)` e, se a API recusar (403) ou a ficha vier sem `podeEditar.peculio` e sem nível de acesso, mostra a ficha de consulta (`consulta_.$id.tsx` vira o componente `FichaDeConsulta`, reaproveitado).

- [ ] **Step 1: testes:** a ficha completa (com Dados pessoais e Comportamento) abre em `/peculio/militar/$id` e o "Voltar" leva à tela de onde veio (unidade ou pesquisa); Review Focus 1 (`?de=peculio`), 2 e 3; a ficha da escala (`/militares/$id`) continua enxuta.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.50: a ficha completa abre no Pecúlio`.

### Task 3: Pecúlio da unidade e a lista com divisória

**Files:** Modify `apps/api/src/cadastros/militares.ts` (`GET /unidades/:u/peculio` aceita `?abaixo=nao`: só os lotados direto na unidade; o padrão continua trazendo as de baixo), `apps/web/src/routes/_app/peculio.tsx`, `apps/web/src/api/militares.ts`; Create `apps/web/src/componentes/peculio/ListaDeMilitares.tsx` (a lista com divisória, usada também pela pesquisa); Test os da rota e `peculio.test.tsx`

- [ ] **Step 1: testes:** a API com e sem `abaixo`; o interruptor "Incluir as unidades de baixo" começa ligado e fica lembrado no navegador (`localStorage`, com `try/catch`); Review Focus 4; a lista da unidade e a da pesquisa usam a mesma peça; sai o painel de aniversariantes do lado da lista.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.50: o Pecúlio da unidade com as de baixo à escolha`.

### Task 4: Aniversários

**Files:** Create `apps/web/src/routes/_app/peculio_.aniversarios.tsx`, `apps/web/src/lib/aniversarios.ts`; Modify `apps/api/src/cadastros/militares.ts` (a lista do Pecúlio já devolve `aniversariantes` do mês pedido; conferir que o parâmetro de mês serve a qualquer mês); Test `apps/web/src/__testes__/aniversarios.test.tsx`

**Interfaces (Produces):** `diasDoMesComAniversariantes(mes: string, aniversariantes: AniversarianteDoMes[]): { data: string; quem: AniversarianteDoMes[] }[]` (Review Focus 5 mora aqui).

- [ ] **Step 1: testes:** o calendário do mês (o mesmo modelo de mês da Escala do mês) com patente e nome de guerra em cada dia, as setas de mês, o alcance da unidade de trabalho e das de baixo; só quem a pessoa pode ver o nascimento; Review Focus 5; o vazio com o texto fixo; no celular, vira lista por dia.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.50: o calendário de aniversários` e enviar a branch à PLANEJAMENTO.
