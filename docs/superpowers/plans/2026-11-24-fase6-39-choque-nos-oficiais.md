# Choque na escala dos oficiais (6.39): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lançar JES ou Saldo na escala dos oficiais confere o choque de horário como as outras escalas (choque universal, 6.37), e o Saldo no expediente se resolve com a mesma confirmação da 6.38.

**Architecture:** o `POST /unidades/:u/oficiais/:mes/lancamentos` grava a alocação direto, sem conferir choque (lacuna achada pela DESENVOLVIMENTO na 6.37). Ele passa a usar a mesma conferência do `escalar` (6.37), e a aceitar `resolverChoque: { expediente: true }` (6.38) para o serviço que tira do expediente.

**Tech Stack:** Hono, zod, React, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-choque-universal-design.md` (decisão do usuário de 24/11/2026: a escala dos oficiais também confere o choque, numa entrega logo depois da 6.38).

## Global Constraints

- Branch `fase6-39-choque-nos-oficiais`, a partir da `main` depois da 6.38. Sem migração.
- O expediente vale para o oficial **com jornada Adm** no período que vale no dia, como para qualquer militar; oficial sem jornada Adm não tem expediente.
- A troca de nome num lugar já lançado (e a cobertura com a escala fechada) também confere o choque de quem entra.
- Textos: os motivos da 6.37 ("Já escalado neste horário", "De expediente neste dia"), na mensagem de recusa de hoje da tela; a confirmação do expediente da spec.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador.

## Review Focus

1. **Oficial com JES lançado em outra escala** (da unidade ou de outra) no mesmo horário: a escala dos oficiais recusa.
2. **Cliques rápidos em vários dias** (6.29): um clique recusado por choque não impede os seguintes nem duplica lançamento.
3. **Recalcular as cotas** (lançar JES refaz as cotas) só acontece quando o lançamento foi gravado.

---

### Task 1: a API confere o choque

**Files:** Modify `apps/api/src/oficiais/rotas.ts` (lançar e trocar o nome no lugar), e o ponto da 6.37 que confere o choque de uma alocação nova (reusar, não copiar); Test `apps/api/test/oficiais*.test.ts`

- [ ] **Step 1: testes:** oficial já escalado em outra escala no mesmo horário → 409 "Já escalado neste horário" e nada muda (Review Focus 1); oficial com jornada Adm, JES no turno do dia em dia útil → 409 "De expediente neste dia"; Saldo no mesmo turno → 409 sem `resolverChoque` e 201 com `resolverChoque: { expediente: true }`; oficial sem jornada Adm → 201; trocar o nome do lugar para um oficial em choque → 409; JES recusado não refaz as cotas (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.39: a escala dos oficiais confere o choque`.

### Task 2: a tela

**Files:** Modify `apps/web/src/componentes/oficiais/EscalaDoMes.tsx` (o clique no turno); Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:** o clique recusado por choque mostra o motivo no aviso de erro e o turno continua livre; Saldo no expediente abre a confirmação da spec e, confirmado, lança; cliques seguidos com um recusado no meio lançam os outros (Review Focus 2).
- [ ] **Step 2:** FAIL. **Step 3:** implementar (skill `frontend-design:frontend-design`). **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador. **Step 5:** commit `Fase 6.39: o choque na tela dos oficiais` e enviar a branch à PLANEJAMENTO.
