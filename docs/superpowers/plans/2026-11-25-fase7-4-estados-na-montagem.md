# Os estados na montagem (7.4): o estado da escala, "Lançar prévia", "Publicar", "Republicar", o motivo do passado e as alterações no passado — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** na Escala do mês, a pessoa vê em que estado a escala está (rascunho, prévia, publicada, retificada ou remessada); o escalante lança a prévia, o gestor publica e republica; mexer num turno que já começou pede o motivo a quem pode e explica a quem não pode; a tela mostra as alterações feitas no passado.

**Architecture:** só o site, sobre a API da 7.3.1. Um provedor único (`JustificarPassado`) intercepta as chamadas que mudam alocação: quando a API responde 400 no campo `justificativa`, abre o diálogo e repete a chamada com o texto. Assim nenhuma tela precisa saber de antemão se o turno é passado. O estado vem na `EscalaDoMes` (`estado`, `podePublicar`); depois de qualquer mudança a tela recarrega a escala e a etiqueta acende sozinha.

**Tech Stack:** React, TanStack Query, Radix (o diálogo que já existe), Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 9 a 17 e "Escolhas › Estados da escala").

## Global Constraints

- Branch `fase7-4-estados-na-montagem`, a partir da `main` com a 7.3.1 mesclada (ou da branch dela; diga no resumo).
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; a ação principal da tela continua uma só (decisão de desenho 1): "Lançar prévia" e "Publicar" são botões secundários e **nunca são bloqueados** por vaga obrigatória vazia (o escalante nunca é impedido de fechar a escala).
- Textos fixos:
  - Estado, ao lado do título: "Rascunho", "Prévia", "Publicada", "Retificada", "Remessada"; a etiqueta "Escala em retificação" junto, quando `estado.emRetificacao`.
  - Linhas de apoio: rascunho "Só quem monta esta escala a vê."; prévia "Prévia lançada em {dd/mm} por {patente nome}. A sua unidade e as de baixo veem. Pode mudar até o dia do serviço."; publicada "Publicada em {dd/mm}. Toda a corporação vê. Qualquer mudança agora é uma retificação."; retificada "Republicada em {dd/mm}."; remessada "Remessada em {dd/mm}. Só o administrador altera."; em retificação "Em retificação. O gestor republica quando terminar." (e, para quem não publica, "Quem publica é o gestor da unidade.").
  - Botões e confirmações: "Lançar prévia" ("Lançar a prévia de {escala}, {mês}? A sua unidade e as de baixo passam a ver esta escala. Você continua podendo alterar."); "Publicar" ("Publicar {escala}, {mês}? Toda a corporação passa a ver esta escala. Daqui em diante, qualquer mudança é uma retificação."); "Republicar" ("Republicar {escala}, {mês}? A corporação passa a ver a escala corrigida, sem a marca de retificação."); cada confirmação com o botão da ação e "Cancelar".
  - Depois da primeira mudança numa escala publicada: o aviso curto "Esta escala está publicada. Ela ficou em retificação até o gestor republicar.", uma vez, sem pedir confirmação antes.
  - O diálogo "Alterar o passado": "Este turno já começou. Diga o motivo da alteração: ele fica registrado." com o campo "Motivo"; "Alterações no passado ({n})"; a mensagem do escalante e a da escala remessada vêm da API.
- Quem vê o quê: "Lançar prévia" para quem altera a escala (nível de acesso de edição na unidade) em rascunho; "Publicar" só com `podePublicar`, em rascunho ou prévia; "Republicar" só com `podePublicar` e a escala em retificação. Escala remessada: nenhum botão de ação. Unidade só de consulta: nenhum botão, só o estado.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px com escalante e gestor, nos cinco estados. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Cancelar o diálogo da justificativa:** nada muda na escala, e a tela volta ao estado de antes (sem alocação fantasma) (Task 2).
2. **"Desfazer" (a faixa de desfazer que já existe) num turno passado:** também abre o diálogo (Task 2).
3. **Grade geral e painel do dia:** as trocas e remoções feitas por lá passam pelo mesmo provedor, e a Escala do mês recarrega o estado depois delas (Task 2).
4. **A etiqueta acende na hora:** o escalante muda um turno futuro de escala publicada e, sem recarregar a página, aparece "Escala em retificação" com o aviso; depois do "Republicar" ela some e o estado vira "Retificada" (Task 1).
5. **Rascunho:** nenhuma chamada em dia passado abre o diálogo de motivo; depois de "Lançar prévia", a mesma chamada abre (Task 2).

---

### Task 1: o estado e as passagens

**Files:** Modify `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/api/escala-do-mes.ts` (ou o arquivo de API da escala do mês); Create `apps/web/src/componentes/escala-do-mes/EstadoDaEscala.tsx`; Test `apps/web/src/__testes__/escala-do-mes*.test.tsx`

**Interfaces (Consumes):** `EscalaDoMes.estado: EstadoDoMes`, `EscalaDoMes.podePublicar`, `POST …/previa`, `POST …/publicar`, `POST …/republicar` (7.3.1).

- [ ] **Step 1: testes:** cada um dos cinco estados mostra o nome e a linha de apoio com os textos fixos; os botões certos para escalante e gestor em cada estado (tabela das Global Constraints); a confirmação de cada passagem e o recarregamento do estado depois dela; com vaga obrigatória vazia "Lançar prévia" e "Publicar" continuam ativos; unidade só de consulta sem botões; Review Focus 4.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.4: o estado da escala, lançar a prévia, publicar e republicar`.

### Task 2: a justificativa do passado

**Files:** Create `apps/web/src/componentes/JustificarPassado.tsx` (provedor e diálogo); Modify as funções de API que mudam alocação em `apps/web/src/api/` (escalar, tirar, trocar, voltar ao turno, acumular, desfazer), `apps/web/src/routes/_app.tsx` (o provedor na casca); Test `apps/web/src/__testes__/justificar-passado.test.tsx`

**Interfaces (Produces):** `useComJustificativa(): <T>(chamar: (justificativa?: string) => Promise<T>) => Promise<T>`: tenta sem; se a API responder 400 com `campos.justificativa`, abre o diálogo e repete com o texto; cancelado, rejeita com um erro `Cancelado` que as telas ignoram em silêncio. Depois de qualquer mudança bem-sucedida a escala do mês é invalidada (o estado e a etiqueta voltam da API).

- [ ] **Step 1: testes:** a chamada comum passa direto; o 400 da justificativa abre o diálogo e, confirmado, a segunda chamada leva o texto; justificativa curta: o erro da API aparece no campo e o diálogo continua aberto com o texto digitado; o 403 do escalante e o da escala remessada aparecem como a mensagem de erro normal da tela; Review Focus 1, 2, 3 e 5.
- [ ] **Step 2:** FAIL. **Step 3:** implementar e passar cada chamada de mudança de alocação por `useComJustificativa`. **Step 4:** PASS. **Step 5:** commit `Fase 7.4: alterar o passado pede o motivo`.

### Task 3: as alterações no passado

**Files:** Create `apps/web/src/componentes/escala-do-mes/AlteracoesNoPassado.tsx`; Modify `apps/web/src/routes/_app/escala-do-mes.tsx`; Test `apps/web/src/__testes__/escala-do-mes*.test.tsx`

- [ ] **Step 1: testes:** com registro, um botão discreto "Alterações no passado (n)" abre um painel com a lista (quando, quem, a frase do registro e o motivo), da mais nova para a mais velha; sem registro, o botão não aparece; a lista recarrega depois de uma alteração justificada.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar os cinco estados. **Step 5:** commit `Fase 7.4: as alterações no passado à vista` e enviar a branch à PLANEJAMENTO.
