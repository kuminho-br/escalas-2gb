# Fase 6.74 + 6.75: painel do dia, legenda e acabamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Trocar" no painel do dia da Grade ganha a aba "Por outra função". Saem a frase da pré-escala do painel e a letra da legenda. A lista do degrau não fica mais por trás da Grade. Entram três acabamentos soltos.

**Architecture:** "Por outra função" usa a troca que já existe (`GET /api/alocacoes/:id/trocas` e o `POST` da troca). As opções ganham `vagas`, e a `Troca` ganha a forma `{ paraVaga }`. O resto é só no site, mais um teste da API.

**Tech Stack:** Hono, zod (`contratos`), React/TanStack, Vitest, PGlite.

**Spec:** pool da VALIDAÇÃO de 28/11 (itens 4, 5, 6 e 19; artefato https://claude.ai/artifact/Vo9f3s4Y8njqFhsza73tkv), as linhas de 28/11 em `docs/decisoes.md` e as linhas 74 e 75 do roadmap.

## Global Constraints

- Branch `fase6-74-75-painel-e-acabamento`, a partir da `main`. Sem migração. Um envio só, no fim.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`, e o navegador em 1440, 768 e 390 px com dados fictícios.
- Textos fixos, com estas palavras exatas:
  - abas: "Por outro militar" e "Por outra função";
  - lista vazia: "Nenhuma outra vaga livre neste turno para ele.";
  - recusa do acúmulo: "Tire o acúmulo antes de mudar de função.";
  - confirmação: "Mudar {nome} para {função} do {guarnição}?";
  - botão: "Mudar de função";
  - aviso dos retornos: "Mostrando os 500 mais recentes. Use os filtros para ver os outros."
- Mudar de turno continua sendo "Remover" e "Adicionar serviço". A aba nova só mexe na vaga do MESMO turno e da mesma escala.
- A frase "Ele não volta para este turno quando a pré-escala for gerada de novo." sai só do painel do dia da Grade. Na Escala do mês ela fica.
- Decisões pequenas desta sessão (marcar no resumo):
  - quem tem acúmulo na alocação é recusado (o acúmulo não muda junto);
  - a lista mostra só as vagas livres onde ele cabe; a vaga ocupada (troca dos dois) fica para a 6.76.

## Review Focus

1. **Vaga atual e escala:** a vaga em que ele já está não aparece na lista. O expediente lançado (alocação sem escala) mostra a lista vazia.
2. **Vaga completa no meio do caminho:** outro escalante a ocupa entre abrir e confirmar. A API recusa com a frase de função completa que já existe, e o diálogo mostra a recusa.
3. **CNH:** a vaga de motorista não aparece para quem não tem a CNH exigida. Se o pedido vier assim mesmo, a API recusa.
4. **Sem guarnição:** a alocação no turno sem guarnição (pré-escala) também pode ir para uma vaga pela aba nova.
5. **Cota:** mudar de vaga não confere a cota (o total do serviço não muda), nem num mês sem cota cadastrada.

---

### Task 1 (6.74): "Por outra função" na API

**Files:**
- Modify: `pacotes/contratos/src/escala-do-mes.ts` (`Troca`, `OpcoesDeTroca`)
- Modify: `apps/api/src/escala/trocar.ts` (`opcoesDeTroca` e a troca)
- Test: `apps/api/test/trocar.test.ts`

**Interfaces:**
- Produces:
  - `type VagaDoTurno = { guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string }`
  - `OpcoesDeTroca = { livres: Candidatos; escalados: EscaladoNoDia[]; vagas: VagaDoTurno[] }`
  - `Troca` ganha a terceira forma `z.object({ paraVaga: z.object({ guarnicaoId: Id, funcaoId: Id }), justificativa: Justificativa })`
  - a resposta continua `ResultadoDaTroca`.

- [ ] **Step 1: testes (falham)** em `trocar.test.ts`:
  - `opções trazem as vagas livres do mesmo turno onde ele cabe`: duas guarnições na faixa. `vagas` traz as funções livres das duas, sem a vaga atual dele, sem a função completa e sem a de motorista com CNH que ele não tem.
  - `mudar de vaga move a mesma alocação`: o `POST` com `{ paraVaga }` devolve 200. A alocação tem o mesmo `id`, o mesmo turno e a guarnição e a função novas. A contagem de alocações do serviço no mês não muda.
  - `mudar de vaga sem guarnição`: a alocação da pré-escala com `guarnicao_id null` vai para a vaga.
  - `vaga completa recusa`: 409 com "A função {função} já está completa nesta guarnição." e nada muda.
  - `com acúmulo recusa`: 409 com "Tire o acúmulo antes de mudar de função.".
  - `não confere cota`: PJES num mês sem cota, alocação já gravada direto no banco. Mudar de vaga devolve 200.
  - `expediente lançado sem escala`: `vagas` vem `[]`.
- [ ] **Step 2:** rodar `pnpm --filter api test trocar`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
  - **`opcoesDeTroca`:** monta `vagas` com as vagas da escala, da data e da faixa do turno da alocação. Reusa `conferirVaga` e `ocupantesDaFuncao` de `alocacoes.ts` e `motivoDaCnh`. Tira a vaga atual.
  - **A troca com `paraVaga`:** chama uma função nova `mudarDeVaga(tx, alocacaoId, vaga)` em `alocacoes.ts`, que segue estes passos:
    - trava a linha (`for update`);
    - recusa a alocação sem escala com `NAO_DA_PARA_DESFAZER` (a recusa que já existe);
    - recusa quem tem acúmulo, com a frase fixa;
    - confere o lugar com `vagaTemLugar` (ela já cobre a vaga, a CNH, a trava da faixa e a lotação) e recusa a vaga completa com a frase que já existe;
    - faz `update alocacao set guarnicao_id, funcao_id`.

    A troca não passa por `escalar`, por isso não confere cota nem choque. A rota é a mesma, então o `comPassado` e a justificativa valem como nas outras trocas.
- [ ] **Step 4:** rodar `pnpm --filter api test trocar`. Esperado: PASS.
- [ ] **Step 5:** commit `Fase 6.74: mudar de função no mesmo turno, na API`.

### Task 2 (6.74): as abas do "Trocar", a frase e a legenda

**Files:**
- Modify: `apps/web/src/componentes/grade/TrocarServico.tsx`, `apps/web/src/componentes/grade/PainelDoDia.tsx` (l.~134), `apps/web/src/componentes/grade/LegendaDaGrade.tsx` (l.~24), `apps/web/src/api/escala-do-mes.ts` (`trocar` aceita a forma nova)
- Test: `apps/web/src/__testes__/grade-trocar.test.tsx`, `grade-painel.test.tsx`, `acabamento-da-grade.test.tsx`

**Interfaces:**
- Consumes: `OpcoesDeTroca.vagas` e `Troca` `{ paraVaga }` da Task 1.

- [ ] **Step 1: testes (falham)**:
  - **`grade-trocar`:**
    - o diálogo tem as abas `tab` "Por outro militar" (aberta) e "Por outra função";
    - a primeira mostra o que existe hoje, livres e já escalados (os testes atuais continuam passando);
    - na segunda, cada vaga aparece como botão "{função} do {guarnição}". Clicar mostra "Mudar {nome} para {função} do {guarnição}?", e "Mudar de função" envia `{ paraVaga: { guarnicaoId, funcaoId } }` e fecha;
    - com `vagas: []` aparece "Nenhuma outra vaga livre neste turno para ele.";
    - a recusa da API aparece no diálogo (`role="alert"`).
  - **`grade-painel`:** o painel do dia NÃO tem o texto "Ele não volta para este turno quando a pré-escala for gerada de novo.", e "Sai também de:" continua quando há acúmulo.
  - **`acabamento-da-grade`:** na legenda, o `[data-quadrado]` de cada serviço tem `textContent === ''` e mantém o estilo da cor. A célula da Grade continua com a letra.
- [ ] **Step 2:** rodar `pnpm --filter web test grade-trocar grade-painel acabamento-da-grade`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
  - **Abas:** usar `componentes/ui/tabs.tsx`. Fazer as abas trocarem só o corpo da lista; o passo de confirmação continua com "Voltar".
  - **Textos do diálogo:** o título continua "Trocar". A descrição vira "Ponha outro militar no lugar de {nome} ou mude {nome} de função neste turno."
  - **Legenda:** tirar `letra` do mapa e o texto do quadrado, e ajustar o comentário do componente.
  - **Escala do mês:** não mexer na frase lá.
- [ ] **Step 4:** rodar os mesmos testes. Esperado: PASS. Depois rodar `pnpm --filter web test`, também PASS.
- [ ] **Step 5:** commit `Fase 6.74: as abas do Trocar, o painel sem a frase da pré-escala e a legenda lisa`.

### Task 3 (6.75): a lista do degrau por cima da Grade, e acabamentos

**Files:**
- Modify: `apps/web/src/componentes/Topo.tsx:63`, `apps/web/src/componentes/DegrausDaUnidade.tsx` (l.~125), `apps/web/src/componentes/grade/PainelDoDia.tsx:67`, a tela `apps/web/src/routes/_app/laboratorio.retornos.tsx`, `apps/api/test/apoio-api.ts:75`
- Test: `apps/web/src/__testes__/degraus-da-unidade.test.tsx`, `grade-painel.test.tsx`, `laboratorio-retorno.test.tsx`

**Causa, lida no código:**
- O `header` do Topo é `sticky z-20`, então cria um contexto de empilhamento. A lista do degrau (`absolute z-30`) fica presa dentro dele.
- O cabeçalho fixo da Grade (`th sticky` z-20/z-30) vem depois no DOM e fica por cima.
- O "Ver todas as unidades" abre em portal (z-50) e não tem o problema.
- No tablet, o painel do dia (`md:max-lg:fixed inset-0 z-40`) começa em `top: 0`, e a faixa do Laboratório (`--faixa`) cobre o alto dele.

- [ ] **Step 1: testes (falham)**:
  - **`degraus-da-unidade`, `a lista do degrau abre acima da Grade`:** renderizar o Topo com a Grade (ou o `header` do Topo e um `th` sticky da Grade) e abrir um degrau.
    - **Correção pelo z-index do Topo:** conferir que o `header` do Topo tem z-index maior que o do cabeçalho da Grade (`z-30`) e menor que o dos diálogos (`z-50`).
    - **Correção por portal:** conferir que a `listbox` está fora do `header` e que setas, Esc e foco continuam funcionando, como nos testes atuais.
  - **`grade-painel`, `no tablet o painel começa abaixo da faixa`:** a classe do `aside` tem `md:max-lg:top-[var(--faixa)]`.
  - **`laboratorio-retorno`:** com 500 retornos vindos da API aparece "Mostrando os 500 mais recentes. Use os filtros para ver os outros.". Com 499, a frase não aparece.
- [ ] **Step 2:** rodar `pnpm --filter web test degraus-da-unidade grade-painel laboratorio-retorno`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
  - **Degrau:** a correção preferida é subir o Topo para `z-40`. Conferir no navegador:
    - a lista do degrau passa por cima da linha dos dias da Grade em 1440 px;
    - o painel do dia no tablet (z-40, que vem depois no DOM) continua por cima do Topo;
    - o menu lateral (z-50) e os diálogos continuam por cima.

    Se algum desses quebrar, a lista do degrau vai para portal (Radix Popover, como em `EscolherUnidade.tsx`), mantendo o celular (`max-md:static`) como está.
  - **Painel no tablet:** pôr `md:max-lg:top-[var(--faixa)]` no `aside`.
  - **Retornos:** mostrar a frase quando `retornos.length === 500`. O limite da API continua em `retornos.ts:45`.
  - **Matrícula de teste:** em `apoio-api.ts:75`, trocar `'990908-8'` por `'100908-8'`, porque 990xxx-x é faixa de militar real. Ajustar todo teste que espera a matrícula antiga (`git grep 990908`).
- [ ] **Step 4:** rodar os testes do Step 2. Esperado: PASS. Depois rodar `pnpm test && pnpm typecheck && pnpm build:vercel`, também PASS.
- [ ] **Step 5:** commit `Fase 6.75: a lista do degrau por cima da Grade, o painel abaixo da faixa, o aviso dos 500 retornos e a matrícula de teste`. Enviar a branch e o resumo à PLANEJAMENTO.
