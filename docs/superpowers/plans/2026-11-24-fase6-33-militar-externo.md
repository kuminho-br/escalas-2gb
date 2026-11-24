# O militar externo (6.33): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o gestor traz um militar de outra unidade para a escala da sua unidade, pela Consulta; ele aparece na equipe "Externo" e pode ser lançado à mão nos serviços extras (JES, Diária, PJES), até alguém tirá-lo.

**Architecture:** a tabela `vinculo_externo` (migração 0001, sem uso até hoje) guarda o vínculo, com `ate` vazio enquanto vale; rotas novas trazem, listam e tiram; a avaliação dos candidatos de uma vaga (`avaliarFaixa`) passa a incluir os externos vigentes no dia, só elegíveis nos turnos de serviço extra; a Consulta ganha o botão e a lista de Militares mostra os externos.

**Tech Stack:** Hono, zod, Postgres, React, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-ficha-da-escala-e-militar-externo-design.md`, parte 3.

## Global Constraints

- Branch `fase6-33-militar-externo`, a partir da `main` depois da 6.32. **Sem migração** (a tabela já existe); se precisar de índice ou coluna, a migração é a 0040 (ou a seguinte livre) e o PR leva "tem migração" no título.
- Ative a skill `frontend-design:frontend-design` e use os componentes da 6.20.
- **Serviço extra** = turno de serviço com `tipo` `pjes` ou `diaria` (o JES é `pjes` em `SERVICOS_FIXOS`). Pronto, Saldo e Expediente (`ordinario`) não aceitam externo.
- Quem traz e tira: `GESTAO` (gestor, quinto nível, administrador) na unidade que recebe ou acima. O auxiliar (escalante) só vê.
- O vínculo não muda a lotação nem tira o militar da escala da unidade de origem.
- Tirar não apaga os lançamentos já feitos.
- Textos fixos: botão "Trazer para a escala de {sigla}"; botão "Tirar da escala de {sigla}"; confirmação "Tirar {patente} {nome} da escala de {sigla}? Os serviços já lançados ficam."; equipe "Externo"; etiqueta na lista "Externo · {sigla da lotação}"; motivos de vaga "Externo só em serviço extra"; recusas "Este militar já é desta unidade.", "Já está na escala de {sigla}.", "Trazer e tirar militar externo é do gestor da unidade."
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios.

## Review Focus

1. **Externo com lançamento na própria unidade no mesmo horário ou colado:** o choque de horário e o descanso olham também as alocações dele na unidade de origem (hoje a janela só olha a unidade da escala).
2. **Pré-escala do Pronto e distribuições:** nunca põem um externo, mesmo vínculo vigente e voluntariado marcado.
3. **Vínculo tirado no meio do mês:** antes da data de saída ele é candidato; depois, não ("Não está lotado na seção neste dia" vira o motivo de hoje para quem não tem vínculo no dia); os lançamentos antigos continuam na tela.
4. **Trazer de novo depois de tirar:** abre um vínculo novo (o antigo fica com o fim); trazer duas vezes no mesmo dia, ou com um vínculo aberto, é 409, nunca erro de banco (a tabela tem `exclude` de sobreposição).
5. **Militar lotado numa unidade de baixo da que recebe:** já é dela; 400 "Este militar já é desta unidade.".

---

### Task 1: a API do vínculo

**Files:** Create `apps/api/src/cadastros/externos.ts` (rotas montadas junto das de cadastros), `pacotes/contratos/src/externos.ts` (exportado no índice); Test `apps/api/test/externos.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/unidades/:u/externos` → `MilitarExterno[]`, os vínculos vigentes hoje, por posto e antiguidade: `{ vinculoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; lotacaoSigla: string; desde: string }`. Quem tem `CADASTRO` em `:u` ou acima.
  - `POST /api/unidades/:u/externos` corpo `{ militarId: uuid }` → 201 `MilitarExterno`; grava `desde = hoje`, `ate = null`.
  - `DELETE /api/unidades/:u/externos/:vinculoId` → 204; grava `ate = hoje` (com `desde = hoje`, `ate = desde`).
  - Auditoria como nas outras gravações (`comUsuario`).

- [ ] **Step 1: testes:** o gestor da unidade traz → 201 e aparece no GET; o escalante traz → 403 com a frase fixa; o administrador traz em qualquer unidade; trazer quem está lotado na unidade ou numa de baixo → 400 (Review Focus 5); trazer com vínculo aberto → 409 "Já está na escala de {sigla}." (Review Focus 4); tirar → 204, some do GET, e trazer de novo depois → 201 com vínculo novo; o escalante tira → 403.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.33: trazer e tirar o militar externo`.

### Task 2: o externo como candidato nas vagas

**Files:** Modify `apps/api/src/escala/elegibilidade.ts` (`avaliarFaixa`), conferir `apps/api/src/escala/pre-escala.ts` e `apps/api/src/grade/dia.ts`; Test `apps/api/test/elegibilidade*.test.ts` (ou o arquivo de testes da escolha de militar de hoje)

**Interfaces:** Consumes: `vinculo_externo` (Task 1).

- O `pool` ganha os militares com vínculo vigente em algum dia do mês da vaga na unidade da escala; os dados dele (jornada, situação, quadro) vêm do período de rastreio que vale no dia, na lotação dele; `equipe = 'Externo'`; `lotado_no_dia` = o vínculo cobre o dia.
- Por turno: tipo fora de `pjes`/`diaria` → "Externo só em serviço extra". O resto das regras vale igual (afastamento, CNH, voluntário JES no JES e no PJES, descanso), **menos o voluntariado marcado**: quem o gestor trouxe já veio para isso (a tela de voluntariado da unidade não o lista).
- A janela de alocações do externo, para choque e descanso, olha todas as unidades (Review Focus 1).

- [ ] **Step 1: testes:** externo vigente aparece na vaga de JES e na de Diária com `equipe: 'Externo'`, elegível sem voluntariado marcado; na vaga de Pronto/Saldo tem o motivo "Externo só em serviço extra"; externo não voluntário JES numa vaga de JES → "Não é voluntário JES"; externo escalado na própria unidade no mesmo horário → "Já escalado neste horário" (Review Focus 1); a pré-escala do mês com um externo vigente não o aloca (Review Focus 2); vínculo tirado no dia 10 → candidato no dia 9, motivo de não lotado no dia 11 (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.33: o externo entra nas vagas de serviço extra`.

### Task 3: as telas

**Files:** Modify `apps/web/src/routes/_app/consulta_.$id.tsx` (o botão), `apps/web/src/routes/_app/militares.tsx` (os externos na lista), `apps/api/src/cadastros/militares.ts` (`GET /unidades/:u/militares` devolve também os externos vigentes, com `externo: { lotacaoSigla }`), `pacotes/contratos/src/militares.ts` (`LinhaMilitar.externo?: { lotacaoSigla: string } | null`); Create `apps/web/src/api/externos.ts`; Test `apps/web/src/__testes__/consulta.test.tsx` (ou o de hoje da Consulta), `militares.test.tsx`

**Interfaces:** Consumes: as rotas da Task 1.

- [ ] **Step 1: testes:**
  - Na Consulta, o gestor abre um militar de outra unidade: "Trazer para a escala de {sigla da unidade de trabalho}"; depois de trazer, o botão vira "Tirar da escala de {sigla}", que pede a confirmação fixa.
  - O escalante não vê nenhum dos dois botões; quem é da própria unidade (ou de baixo) também não tem o botão.
  - Na lista de Militares, o externo aparece com a equipe "Externo" e a etiqueta "Externo · {sigla da lotação}"; o filtro de equipe tem "Externo"; clicar nele abre a ficha da Consulta (a ficha da escala é da lotação dele).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador como gestor e como auxiliar. **Step 5:** commit `Fase 6.33: o militar externo na Consulta e na lista de Militares` e enviar a branch à PLANEJAMENTO.
