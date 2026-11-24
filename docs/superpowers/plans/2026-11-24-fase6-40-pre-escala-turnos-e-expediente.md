# A pré-escala só nos turnos e com o expediente (6.40): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o botão "Pré-escala" lança a equipe do dia no turno do Pronto (sem guarnição) e o Adm no expediente dos dias úteis; o escalante move quem está no turno para as vagas.

**Architecture:** `planejarPreEscala` deixa de chamar `preencherVagas` e passa a planejar também o expediente (alocações sem escala do serviço Expediente); a migração permite `alocacao.escala_id` nulo só para o Expediente; a escolha do militar da vaga ganha o "mover" de quem já está no turno sem guarnição; a resolução de choque da 6.38 passa a tirar um expediente lançado.

**Tech Stack:** Postgres, Hono, zod, React, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-pre-escala-turnos-e-expediente-design.md`.

## Global Constraints

- Branch `fase6-40-pre-escala-turnos-e-expediente`, a partir da `main` depois da 6.39. **Tem migração** (o próximo número livre depois da 0042); "tem migração" no título.
- Front-end: skill `frontend-design:frontend-design`, componentes da 6.20, aviso e "Desfazer" da 6.21.
- Textos fixos: botão "Pré-escala" (o de hoje, que já gera o Pronto); prévia "Entram {n} militares no turno do Pronto e {m} no expediente."; aviso "Sem o serviço Expediente na unidade: o expediente não foi gerado."; na escolha da vaga, "No turno, sem guarnição".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios de um mês inteiro.

## Review Focus

1. **Todas as consultas que juntam alocação com escala** (Escala do mês, Efetivo por dia, oficiais, Grade, painel do dia, apagar escala, contagens) continuam certas com alocações sem escala; nenhuma quebra nem mostra o expediente numa escala.
2. **Feriado de uma unidade de cima** (o feriado vale para as de baixo) tira o expediente do dia.
3. **Mudança de jornada no meio do mês** (Adm até o dia 15, Pronto depois): expediente só até o dia 15, Pronto só depois.
4. **Gerar a pré-escala duas vezes:** não duplica expediente nem Pronto; o expediente removido num dia não volta.
5. **Mover para a vaga quem está no turno** e depois "Desfazer": volta ao turno sem guarnição.

---

### Task 1: o banco e a pré-escala

**Files:** Create a migração (`alocacao.escala_id` aceita nulo; um `check` só permite nulo quando o serviço é o Expediente: um gatilho ou uma coluna que o diga); Modify `apps/api/src/escala/pre-escala.ts` (sai `preencherVagas`; todos os candidatos da equipe do dia vão para `guarnicaoId: null, funcaoId: null`; entra o planejamento do expediente), a rota que grava a pré-escala, `pacotes/contratos` (a prévia: `entramNoTurno`, `entramNoExpediente`, `semExpediente?: string`); Test `apps/api/test/pre-escala*.test.ts`

- [ ] **Step 1: testes:** a pré-escala de um mês põe a equipe do dia nos turnos A e B do Pronto, sem guarnição; o Adm recebe expediente em todo dia útil, menos fim de semana, feriado da unidade e de cima (Review Focus 2), afastamento e dia com Saldo no horário; jornada que muda no meio do mês (Review Focus 3); gerar duas vezes não duplica e respeita a remoção (Review Focus 4); unidade sem o serviço Expediente gera só o Pronto, com o aviso; o externo e o oficial não entram.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.40: a pré-escala só nos turnos e com o expediente`.

### Task 2: o expediente lançado no resto do sistema

**Files:** Modify as consultas que juntam `alocacao` com `escala` (buscar por `join escala` e `escala_id` em `apps/api/src`), a Grade geral e o painel do dia (o expediente aparece como serviço do dia), a resolução de choque da 6.38 (o expediente lançado só sai por um serviço que tira do expediente, com poder na lotação do militar); Test os de cada consulta tocada, `apps/api/test/resolver-choque.test.ts`

- [ ] **Step 1: testes:** a Escala do mês e o Efetivo por dia não mostram o expediente; a Grade e o painel do dia mostram; Saldo sobre um expediente lançado resolve com "Tirar do expediente e escalar aqui" e o "Desfazer" devolve o expediente; JES sobre ele não resolve; tirar o expediente lançado sem pôr nada deixa o calculado valendo (choque continua) (Review Focus 1).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.40: o expediente lançado na Grade, no painel e no choque`.

### Task 3: mover do turno para a vaga, e a prévia

**Files:** Modify `apps/api/src/escala/elegibilidade.ts` (quem está no mesmo turno sem guarnição não é "Já escalado": é candidato com `noTurno: true`), a rota de escalar (escolher alguém `noTurno` atualiza a alocação existente com a guarnição e a função), o diálogo de escolher militar e `GerarPreEscala.tsx` (a prévia nova); Test `apps/api/test/escala*.test.ts`, `apps/web/src/__testes__/escala-do-mes.test.tsx`

- [ ] **Step 1: testes:** na vaga, quem está no turno sem guarnição aparece primeiro com "No turno, sem guarnição"; escolher move (uma alocação só, agora com guarnição e função); o aviso tem "Desfazer", que o devolve ao turno sem guarnição (Review Focus 5); a prévia diz "Entram {n} militares no turno do Pronto e {m} no expediente." e não fala mais de vagas vazias.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; atualizar as regras escritas da pré-escala (`docs/negocio/regras/carga-expediente-choques.md`: RN-20, RN-22, RN-91 e a regra de preenchimento das vagas pela pré-escala, onde estiver). **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador. **Step 5:** commit `Fase 6.40: mover do turno para a vaga` e enviar a branch à PLANEJAMENTO.
