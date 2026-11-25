# Módulo Visualização (7.5): Minha escala e Escalas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** qualquer militar com conta vê os próprios serviços do mês, com quem compõe cada guarnição, e abre as escalas que pode ver (prévia da sua unidade e das de baixo; publicadas de toda a corporação), só para leitura, sempre com o estado.

**Architecture:** só o site, sobre as leituras da 7.3.1 (`/api/visualizacao/…` e `/api/eu/escala/:mes`). O módulo `visualizacao` (que a 7.2 abriu com "Meu voluntariado") ganha "Minha escala", que passa a ser a rota do atalho, e "Escalas". A escala aberta reaproveita os componentes de leitura da Escala do mês (a tela já tem o modo só leitura das unidades de consulta), sem os controles de montagem.

**Tech Stack:** React, TanStack Router e Query, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 10 a 12, 17 e 18, e "Escolhas › Visualização"). Sem mockup da DESIGN: a skill de design adequa ao sistema, com painéis sucintos; o usuário valida depois.

## Global Constraints

- Branch `fase7-5-minha-escala-e-escalas`, a partir da `main` com a 7.3.1 mesclada (a 7.2 também, por causa do módulo; se não estiverem, a partir das branches delas, e diga no resumo).
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; `EscolherUnidade` (6.45) para escolher a unidade; nada de lista plana de unidades (a guarda de unidades cobra).
- As rotas `/minha-escala`, `/escalas-da-corporacao` e `/escalas-da-corporacao/$id` são do módulo `visualizacao` em `lib/modulos.ts`; o militar comum continua sem o módulo de escalas.
- Textos fixos: "Minha escala"; "Escalas"; "Você não tem serviço em {mês} nas escalas que já foram abertas."; "Nenhuma escala de {mês} está aberta para você."; "Você" (na composição, no lugar do próprio nome).
- O estado, em cada serviço e em cada escala: a etiqueta "Prévia" com "Pode mudar até o dia do serviço."; "Publicada"; "Retificada"; "Remessada"; e a etiqueta "Escala em retificação" quando `emRetificacao`. A escala aberta traz a linha do estado: prévia "Prévia lançada em {dd/mm}. Pode mudar até o dia do serviço."; publicada "Publicada em {dd/mm}."; retificada "Republicada em {dd/mm}."; remessada "Remessada em {dd/mm}.".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px com uma conta de militar comum. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Serviço que passa da meia-noite** (20:00 às 08:00): aparece no dia em que começa, com "até 08:00 do dia seguinte" (Task 1).
2. **Dois serviços no mesmo dia:** os dois aparecem, em ordem de hora (Task 1).
3. **Serviço sem guarnição** (só no turno, da pré-escala): aparece sem a composição, com "Guarnição a definir" (Task 1).
4. **A escala deixa de estar aberta com a tela aberta** (a unidade a tirou do alcance, ou ainda é rascunho): a leitura responde 404, e a tela diz "Esta escala não está aberta para você." com o caminho de volta (Task 2).
5. **Celular (390 px):** a Minha escala é uma lista por dia, sem tabela larga nem rolagem de lado (Task 1).

---

### Task 1: Minha escala

**Files:** Create `apps/web/src/routes/_app/minha-escala.tsx`, `apps/web/src/api/visualizacao.ts`; Modify `apps/web/src/lib/modulos.ts` (o módulo `visualizacao`: rota `/minha-escala`; o trilho com "Minha escala", "Meu voluntariado" e "Escalas"; `moduloDoEndereco`); Test `apps/web/src/__testes__/minha-escala.test.tsx`, `modulos*.test.tsx`

- [ ] **Step 1: testes:** a tela mostra o mês com as setas, e os serviços agrupados por dia (dia e dia da semana; horário; serviço; escala e unidade; o estado; a guarnição e a função; a composição com patente, nome de guerra e função, e "Você" no próprio); o serviço de prévia mostra "Prévia" e o de escala em retificação mostra a etiqueta; o vazio com o texto fixo; Review Focus 1, 2, 3 e 5; conta sem militar não vê o item.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.5: a Minha escala`.

### Task 2: Escalas da corporação

**Files:** Create `apps/web/src/routes/_app/escalas-da-corporacao.tsx`, `apps/web/src/routes/_app/escalas-da-corporacao_.$id.tsx`; Modify os componentes de leitura da Escala do mês que precisarem aceitar a origem da leitura (sem duplicar a tela); Test `apps/web/src/__testes__/escalas-da-corporacao.test.tsx`

- [ ] **Step 1: testes:** a lista mostra as escalas do mês que a conta pode ver, agrupadas por unidade, cada uma com o estado, e começa filtrada na unidade de lotação da pessoa e nas de baixo; a árvore troca a unidade, e "Limpar" mostra todas; a escala dos oficiais publicada aparece para o militar comum, e a em prévia não; abrir uma escala mostra a Escala do mês só para leitura (nenhum botão de escalar, tirar, trocar, lançar, publicar ou republicar) com a linha do estado; Review Focus 4; o vazio com o texto fixo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 7.5: as escalas abertas à vista da corporação` e enviar a branch à PLANEJAMENTO.
