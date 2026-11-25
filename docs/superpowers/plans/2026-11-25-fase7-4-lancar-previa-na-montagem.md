# "Lançar prévia" na montagem (7.4): o botão, a justificativa do passado e as alterações no passado — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** na Escala do mês, o escalante lança (e recolhe) a prévia; com a prévia lançada, mexer num turno que já começou pede a justificativa a quem pode e explica a quem não pode; a tela mostra as alterações feitas no passado.

**Architecture:** só o site, sobre a API da 7.3. Um provedor único (`JustificarPassado`) intercepta as chamadas que mudam alocação: quando a API responde 400 no campo `justificativa`, abre o diálogo, e repete a chamada com o texto. Assim nenhuma tela precisa saber de antemão se o turno é passado.

**Tech Stack:** React, TanStack Query, Radix (o diálogo que já existe), Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 9, 10, 13 e 14).

## Global Constraints

- Branch `fase7-4-lancar-previa-na-montagem`, a partir da `main` com a 7.3 mesclada (ou da branch dela; diga no resumo).
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; a ação principal da tela continua uma só (decisão de desenho 1): "Lançar prévia" é botão secundário enquanto a escala tem vaga obrigatória vazia, e nunca é bloqueado por isso (o escalante nunca é impedido de fechar a escala).
- Textos fixos: "Lançar prévia"; a confirmação "Lançar a prévia de {escala}, {mês}? Toda a corporação passa a ver esta escala. Você continua podendo alterar." com "Lançar" e "Cancelar"; "Prévia lançada em {dd/mm} por {patente nome}"; "Recolher prévia" com "Recolher a prévia? A corporação deixa de ver esta escala."; o diálogo "Alterar o passado" com "Este turno já começou. Diga o motivo da alteração: ele fica registrado." e o campo "Motivo"; "Alterações no passado ({n})"; a mensagem do escalante vem da API.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px com escalante e gestor. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Cancelar o diálogo da justificativa:** nada muda na escala, e a tela volta ao estado de antes (sem alocação fantasma) (Task 2).
2. **"Desfazer" (a faixa de desfazer que já existe) num turno passado:** também abre o diálogo (Task 2).
3. **Grade geral e painel do dia:** as trocas e remoções feitas por lá passam pelo mesmo provedor (Task 2).
4. **Unidade só de consulta:** nem "Lançar prévia" nem "Recolher" aparecem; o estado da prévia aparece (Task 1).
5. **Justificativa curta:** o erro da API aparece no campo, e o diálogo continua aberto com o texto digitado (Task 2).

---

### Task 1: lançar e recolher a prévia

**Files:** Modify `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/api/escala-do-mes.ts` (ou o arquivo de API da escala do mês); Create `apps/web/src/componentes/escala-do-mes/PreviaDaEscala.tsx`; Test `apps/web/src/__testes__/escala-do-mes*.test.tsx`

- [ ] **Step 1: testes:** sem prévia, o botão "Lançar prévia" com a confirmação; lançada, a linha "Prévia lançada em … por …" e "Recolher prévia"; Review Focus 4; com vaga obrigatória vazia o botão continua ativo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.4: lançar e recolher a prévia na Escala do mês`.

### Task 2: a justificativa do passado

**Files:** Create `apps/web/src/componentes/JustificarPassado.tsx` (provedor e diálogo); Modify `apps/web/src/api/cliente.ts` (ou as funções de API que mudam alocação: escalar, tirar, trocar, voltar ao turno, acumular, desfazer), `apps/web/src/routes/_app.tsx` (o provedor na casca); Test `apps/web/src/__testes__/justificar-passado.test.tsx`

**Interfaces (Produces):** `useComJustificativa(): <T>(chamar: (justificativa?: string) => Promise<T>) => Promise<T>`: tenta sem; se a API responder 400 com `campos.justificativa`, abre o diálogo e repete com o texto; cancelado, rejeita com um erro `Cancelado` que as telas ignoram em silêncio.

- [ ] **Step 1: testes:** a chamada comum passa direto; o 400 da justificativa abre o diálogo e, confirmado, a segunda chamada leva o texto; Review Focus 1, 2, 3 e 5; o 403 do escalante aparece como a mensagem de erro normal da tela.
- [ ] **Step 2:** FAIL. **Step 3:** implementar e passar cada chamada de mudança de alocação por `useComJustificativa`. **Step 4:** PASS. **Step 5:** commit `Fase 7.4: alterar o passado pede o motivo`.

### Task 3: as alterações no passado

**Files:** Create `apps/web/src/componentes/escala-do-mes/AlteracoesNoPassado.tsx`; Modify `apps/web/src/routes/_app/escala-do-mes.tsx`; Test `apps/web/src/__testes__/escala-do-mes*.test.tsx`

- [ ] **Step 1: testes:** com registro, um botão discreto "Alterações no passado (n)" abre um painel com a lista (quando, quem, a frase do registro e o motivo), da mais nova para a mais velha; sem registro, o botão não aparece; a lista recarrega depois de uma alteração justificada.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 7.4: as alterações no passado à vista` e enviar a branch à PLANEJAMENTO.
