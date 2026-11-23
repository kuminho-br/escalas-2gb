# Escala dos oficiais como escala comum (6.27) e dias vermelhos (6.28): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** os lançamentos da escala dos oficiais viram alocações de uma escala comum (JES à mão, Saldo pela rodada), com "Abrir o mês" e cotas automáticas, ordem só sugerida, e os dias vermelhos contados por oficial.

**Architecture:** migração 0036 liga a rodada (`oficiais_*`) a uma escala com `distribuicao = 'rodada_de_cotas'` e passa os lançamentos para `alocacao`. A API dos oficiais lê e grava alocações; as cotas são refeitas a cada mudança entre "Abrir o mês" e "Fechar a escala". O site troca o campo "Serviço" por "Escala".

**Tech Stack:** Postgres, Hono, zod, React, Vitest; motor em `pacotes/dominio` (a conta da cota, sem mudar a regra).

**Spec:** `docs/superpowers/specs/2026-11-23-oficiais-escala-comum-design.md` (e a de 22/11, que continua valendo no que não muda).

## Global Constraints

- **Urgente:** próxima entrega depois da 6.26. Fila: 6.26 → 6.27 → 6.28 → 6.17 (parte 2) → 6.18 → 6.20 → 6.21. Branches `fase6-27-oficiais-escala-comum` e `fase6-28-dias-vermelhos`.
- **A 6.27 tem migração: 0036.** O PR leva "tem migração" no título. A 6.28 tem a 0037 (dias vermelhos). Outras entregas usam o próximo número livre.
- Nenhum lançamento, cobertura ou saldo dos meses gravados se perde (teste de migração com um mês completo: escolhas, coberturas, mês encerrado com saldo).
- Mensagens: "Fora da ordem: a vez era de {patente} {nome}." (aviso, não bloqueia); "JES só para voluntário JES." (400); "Abra o mês para lançar." (409, antes de abrir); "Com a escala fechada, trocar o nome é uma cobertura." (como hoje).
- Ative a skill `frontend-design:frontend-design` nas telas. Nenhum texto abaixo de 13 px.
- Nenhum dado pessoal real. Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios.

## Review Focus

1. **Lançar JES num lugar já tomado por Saldo** (ou o contrário): recusado, nada muda.
2. **Tirar um JES com o mês aberto:** o lugar volta para a rodada e as cotas se refazem, mantendo as escolhas de quem continua (e devolvendo `liberados` como na P1.5).
3. **Mudar a antiguidade com participantes marcados:** a ordem se refaz na hora (o defeito de hoje), sem perder a ordem manual (Subir/Descer) entre os sem antiguidade.
4. **Afastamento lançado depois de fechar:** não muda a cota (regra de hoje), só avisa.
5. **Mês gravado antes da migração:** abre igual, com as escolhas, as coberturas e o saldo.

---

# Entrega 6.27 — A escala dos oficiais como escala comum

### Task 1: a migração 0036

**Files:** Create `apps/api/banco/migracoes/0036_oficiais_escala_comum.sql`, `apps/api/test/migracao-0036.test.ts`; Modify o esquema do banco

**Interfaces:**
- Produces: `escala.distribuicao text not null default 'pre_escala' check (distribuicao in ('pre_escala','rodada_de_cotas'))`; `oficiais_mes.escala_id uuid references escala` (no lugar de `servico_id`; único por escala e mês), `oficiais_mes.aberto_em timestamptz` (no lugar de `cotas_em`; os meses com cotas viram abertos); `oficiais_cobertura (alocacao_id uuid pk references alocacao on delete cascade, saiu_militar_id uuid not null references militar)`; sai `oficiais_turno` depois de copiado para `alocacao`.
- A migração cria, por unidade com mês gravado, a escala "Oficiais de operações" (`rodada_de_cotas`) com o serviço que o mês usava, e copia cada turno com nome para `alocacao` (`origem = 'distribuicao'`), com as coberturas.

- [ ] **Step 1:** teste da migração (Review Focus 5): um mês com escolhas, uma cobertura e saldo encerrado passa igual; roda de novo sem duplicar.
- [ ] **Step 2:** FAIL. **Step 3:** escrever. **Step 4:** PASS. **Step 5:** commit `Fase 6.27: migração da escala dos oficiais para escala comum`.

### Task 2: a API dos oficiais sobre alocações

**Files:** Modify `apps/api/src/oficiais/*.ts`, `pacotes/contratos/src/oficiais.ts`, `apps/api/src/cadastros/escalas.ts` (campo `distribuicao`); Test `apps/api/test/oficiais*.test.ts`

**Interfaces:**
- Produces: `GET /api/unidades/:u/oficiais/:mes?escala={id}`; `POST .../abrir` (cria o mês e calcula as cotas; sai `.../cotas`); `POST .../lancamentos` `{ dia, letra, servico: 'jes' | 'saldo', militarId }` e `DELETE .../lancamentos/:alocacaoId`; a resposta do mês traz os lugares do dia (por letra) com o serviço e o militar, a vez sugerida e as cotas de saldo.

- [ ] **Step 1: testes:** JES à mão só para voluntário JES; Saldo pela rodada; cota de saldo = lugares que sobram depois dos JES; entre abrir e fechar, mudar participação, afastamento ou JES refaz as cotas sozinho; antes de abrir, 409 "Abra o mês para lançar."; lançar fora da vez grava e devolve o aviso; Review Focus 1 a 4; a escala com `rodada_de_cotas` não aparece na pré-escala nem na Escala do mês das praças.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (a conta da cota é a do motor, sem mudar). **Step 4:** PASS. **Step 5:** commit `Fase 6.27: os oficiais lançam alocações de uma escala`.

### Task 3: a tela

**Files:** Modify `apps/web/src/routes/_app/oficiais.tsx`, `apps/web/src/componentes/oficiais/*.tsx`, o cadastro da escala em `componentes/escalas/`; Test `apps/web/src/__testes__/oficiais.test.tsx`, o teste do cadastro de escala

- [ ] **Step 1: testes:** o campo "Escala" no lugar de "Serviço" (só as escalas da unidade com rodada); o cadastro da escala tem "Jeito de distribuir: pré-escala ou rodada de cotas"; o botão "Abrir o mês" no lugar de "Calcular cotas" (a linha de etapas começa em "Abrir o mês"); o lugar do turno mostra JES ou Saldo na placa; lançar JES pede o oficial e só lista os voluntários JES; o diálogo de lançamento vem com a vez escolhida e aceita outro, com o aviso "Fora da ordem…".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; verificações; conferir no navegador. **Step 5:** commit `Fase 6.27: a tela dos oficiais por escala` e abrir o PR ("tem migração 0036").

---

# Entrega 6.28 — Dias vermelhos e acabamento

Branch a partir da 6.27. **Migração 0037.**

### Task 4: dias vermelhos e acabamento

**Files:** Create `apps/api/banco/migracoes/0037_dias_vermelhos.sql`; Modify `apps/api/src/oficiais/*.ts`, `pacotes/contratos/src/oficiais.ts`, `apps/web/src/componentes/oficiais/*.tsx`, `apps/web/src/routes/_app/oficiais.tsx`; Test os de oficiais e `migracao-0037.test.ts`

**Interfaces:**
- Produces: `dia_vermelho (escala_id uuid references escala, dia date, primary key (escala_id, dia))` (ligado à escala, para servir às outras depois); `PUT .../dias-vermelhos` `{ dias: string[] }` enquanto o mês não está encerrado; no mês, por oficial, `vermelhos: number`; no Painel de saldo, o acumulado.

- [ ] **Step 1: testes:** marcar e desmarcar dias vermelhos ao abrir o mês e depois (até encerrar); o calendário mostra o dia vermelho com uma marca discreta na cor de alerta e "Dia vermelho" para leitor de tela; a contagem por oficial no painel e no acumulado; os dias vermelhos não mudam a cota; o painel se chama "Cota de saldo"; a aba "Regras" do alto sai (o botão à direita fica).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; verificações; conferir no navegador. **Step 5:** commit `Fase 6.28: dias vermelhos e acabamento dos oficiais` e abrir o PR ("tem migração 0037").
