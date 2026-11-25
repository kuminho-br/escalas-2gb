# A lista de Militares mostra quem está na unidade hoje (6.48): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:systematic-debugging, then superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** é defeito de API; pode ser feito no modelo em que a sessão estiver (para não trocar de modelo no meio da fila do Fable). Revisão final no Opus.

**Defeito (usuário, 24/11/2026, piloto de dezembro):** com a 1ª SB escolhida no Topo, a aba Militares do módulo de escalas mostrou 60 militares, entre eles oficiais (ex.: o Cap LUCIVÂNIO) que hoje estão lotados numa unidade **de cima**. "Essa parte diz quais são os militares da unidade e suas filhas, para fins de escala; aqui não é a busca por militares de fora."

**Causa provável (PLANEJAMENTO, conferir antes de mexer):** `GET /unidades/:u/militares` (`apps/api/src/cadastros/militares.ts`) pega todo período de rastreio na unidade ou nas de baixo **que toca o mês** e, entre eles, o período do dia restrito à subárvore (`PERIODO_DO_DIA('m.id', 'and alvo2.caminho @> ux.caminho')`). Quem foi importado em 01/11 numa unidade da subárvore e movido depois para uma unidade de cima continua na lista do mês. A importação de 23/11 lotou todos em 01/11 e a relotação veio depois, então o caso aparece em massa.

**Decisão do usuário (24/11/2026):** quem saiu da unidade **não aparece**: a lista mostra **só quem está lá no dia de referência** (`diaDeReferencia(mes)`: hoje, no mês corrente; o primeiro ou o último dia em outros meses). Os serviços que ele já tirou aqui continuam na escala.

**Escolha da PLANEJAMENTO:** a chegada marcada para depois do dia de referência, dentro do mês ("Lotação a partir de dd/mm", `aPartirDe`), **continua** aparecendo, como hoje: é quem vai ser escalado aqui ainda neste mês. Só some quem **saiu**.

## Global Constraints

- Branch `fase6-48-lista-de-quem-esta-hoje`, a partir da `main`. Sem migração.
- Conferir também `GET /unidades/:u/peculio` (a lista do Pecúlio) e as contagens da Grade e da Escala do mês que usem a mesma junção: a regra é a mesma ("está na subárvore no dia de referência, ou chega nela depois dele no mesmo mês"). Os candidatos de uma vaga (`avaliarFaixa`) já olham o dia da vaga e ficam como estão.
- Antes de enviar: `pnpm test && pnpm typecheck`. Enviar a branch uma vez só.

## Review Focus

1. **Saiu para uma unidade de cima no meio do mês:** some da lista da unidade de baixo; aparece na de cima.
2. **Saiu para uma unidade irmã:** some.
3. **Chega no dia 20 do mês corrente:** aparece com "Lotação a partir de 20/mm".
4. **Mês passado escolhido** (diaDeReferencia = último dia): mostra quem estava lá no último dia daquele mês.
5. **Externo (6.33/6.36):** continua aparecendo pela regra própria.

### Task 1

**Files:** Modify `apps/api/src/cadastros/militares.ts` (a rota da lista e, se tiver a mesma junção, a do Pecúlio); Test `apps/api/test/militares*.test.ts`, `apps/api/test/peculio*.test.ts`

- [ ] **Step 1:** reproduzir com dados fictícios (lotado na 1ª SB em 01/11, movido para uma unidade de cima em 24/11; dia de referência 24/11): hoje ele aparece na lista da 1ª SB (RED).
- [ ] **Step 2: testes** dos cinco casos do Review Focus.
- [ ] **Step 3:** implementar: o período que vale no dia de referência (sem restringir à subárvore) precisa estar na subárvore; ou, sem período no dia, o próximo período do mês começa na subárvore.
- [ ] **Step 4:** PASS; `pnpm test && pnpm typecheck`. **Step 5:** commit `Fase 6.48: a lista de Militares mostra quem está na unidade no dia` e enviar a branch à PLANEJAMENTO.
