# Telas do voluntariado (7.2): Meu voluntariado, o botão do dia, a coleta e o registro — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o militar marca o próprio voluntariado na área pessoal, com o mesmo calendário do escalante e um botão em cada dia para horários fora dos blocos; o gestor abre e fecha a coleta nas Configurações da escala; o escalante vê quem preencheu e o registro das correções.

**Architecture:** só o site, sobre a API da 7.1. O calendário `CalendarioDoVoluntariado` é reaproveitado na rota nova `/meu-voluntariado`, do módulo "Visualização de escalas" (que deixa de dizer "Chega com a fase 7"). O botão do dia entra no próprio calendário, e por isso aparece também para o escalante.

**Tech Stack:** React, TanStack Router e Query, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md`. O botão do dia é **proposta da PLANEJAMENTO**, sem mockup da DESIGN: a skill de design adequa ao sistema, e o usuário valida depois.

## Global Constraints

- Branch `fase7-2-telas-do-voluntariado`, a partir da `main` com a 7.1 mesclada (se a 7.1 ainda não estiver mesclada, a partir da branch dela, e diga isso no resumo).
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20 (guarda de estilo); nada de cor solta.
- O militar comum não entra no módulo de escalas: `/meu-voluntariado` é do módulo `visualizacao` em `lib/modulos.ts` (`moduloDoEndereco` inclusive).
- Textos fixos: "Meu voluntariado"; "A coleta de {mês} está aberta. Marque os dias e horários em que você aceita tirar serviço extra."; a mensagem de coleta fechada que a API devolve em `motivo`; "Outro horário"; "das" / "às"; "Adicionar horário"; "Aceitar o voluntariado de {mês}" (o interruptor); "Preenchido pelo militar"; "Corrigido {n} vez(es)"; "Você não tem o atributo de voluntário JES: o que marcar vale para diárias. Para JES e PJES, fale com quem cuida do seu cadastro."; no atalho da tela inicial, "O voluntariado de {mês} está aberto".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px, com uma conta de militar comum e uma de escalante (site local com dados fictícios). Enviar a branch uma vez só, no fim.

## Review Focus

1. **Coleta fechada:** o militar vê o que marcou, com tudo desabilitado e a frase do motivo; nenhum botão de salvar (Task 2).
2. **Faixa fora dos blocos já gravada** (pelo militar ou vinda de importação): aparece no dia como "09:30 às 11:00", e não some ao salvar outra mudança (Task 1).
3. **"Outro horário" que encosta ou cobre um bloco:** a tela não duplica; ao salvar, a API une as faixas, e o dia volta mostrando o resultado (Task 1).
4. **Horário inválido** (fim antes do começo, fora de HH:MM): o erro aparece no campo, e o salvar não sai (Task 1).
5. **Celular (390 px):** o botão do dia tem alvo de 44 px e o painel "Outro horário" cabe sem rolar de lado (Task 1).

---

### Task 1: o botão do dia no calendário

**Files:** Modify `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`, `GuiaComoMarcar.tsx`; Create `apps/web/src/componentes/voluntariado/OutroHorario.tsx`; Test `apps/web/src/__testes__/voluntariado*.test.tsx`

**Interfaces (Produces):** `OutroHorario({ data, faixas, aoMudar, soLeitura })`, onde `faixas` são as do dia que não batem com nenhum bloco; o calendário passa a separar, por dia, as faixas que são blocos das "outras", e devolve as duas juntas no `aoSalvar` que já existe.

- [ ] **Step 1: testes:** cada dia tem um botão "Outro horário de {dia}" do lado oposto ao número; abre um painel com os pares "das/às" e "Adicionar horário"; a faixa marcada aparece no dia como linha de texto; Review Focus 2, 3, 4; com `soLeitura`, o botão só mostra.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.2: outro horário no dia do voluntariado`.

### Task 2: Meu voluntariado

**Files:** Create `apps/web/src/routes/_app/meu-voluntariado.tsx`, `apps/web/src/api/meu-voluntariado.ts`; Modify `apps/web/src/lib/modulos.ts` (o módulo `visualizacao` ganha a rota `/meu-voluntariado`, o item "Meu voluntariado" no trilho, `ve` só para conta com militar, e a situação "O voluntariado de {mês} está aberto" quando `eu.coletasAbertas` tem mês; senão "Seu voluntariado"), `apps/web/src/api/eu.ts`; Test `apps/web/src/__testes__/meu-voluntariado.test.tsx`, `modulos*.test.tsx`

- [ ] **Step 1: testes:** a tela mostra o mês (com as setas de mês do sistema; começa no primeiro mês de `coletasAbertas`, ou no mês atual), o calendário com os blocos e o que já foi marcado, e salva pelo `PUT /api/eu/voluntariado/:mes`; Review Focus 1; o aviso do voluntário JES quando `voluntarioJes` é falso; o militar comum abre a tela e continua sem ver o módulo de escalas; conta sem militar não vê o item.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.2: o militar marca o próprio voluntariado`.

### Task 3: a coleta e o registro na tela do escalante

**Files:** Modify `apps/web/src/routes/_app/configuracoes-da-escala.tsx` (aba Voluntariado: o interruptor "Aceitar o voluntariado de {mês}" para o mês atual e os dois seguintes, só para quem é gestor na unidade), `apps/web/src/routes/_app/voluntariado.tsx`, `apps/web/src/componentes/voluntariado/ListaDoVoluntariado.tsx` (a marca "Preenchido pelo militar" e "Corrigido n vez(es)"), `apps/web/src/api/voluntariado.ts`; Create `apps/web/src/componentes/voluntariado/RegistroDeCorrecoes.tsx`; Test os de cada tela

- [ ] **Step 1: testes:** o interruptor grava na hora e mostra o estado; o escalante vê o estado sem poder mudar; a lista marca quem preencheu; ao abrir um militar com correções, a seção "Correções" lista quando, quem e a frase do registro; ao salvar por cima do que o militar preencheu, a tela avisa antes "Este mês foi preenchido pelo militar. A sua alteração fica registrada." com "Alterar" e "Cancelar".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 7.2: a coleta e o registro das correções` e enviar a branch à PLANEJAMENTO.
