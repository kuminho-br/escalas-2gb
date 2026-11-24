# Choque universal (6.37) e resolver o choque com a cota de saldo à vista (6.38): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** choque de horário vale para todos, em todas as unidades e com o expediente do Adm, sem exceção; o serviço diz se pode tirar o militar do expediente; na escolha do militar, o escalante resolve o choque tirando de lá e escalando aqui; a cota de saldo do Adm fica à vista.

**Architecture:** no motor, `detectarChoques` ganha a regra nova por opção (o expediente choca com tudo; some só sob um serviço com `tiraDoExpediente`), e os casos gravados do protótipo continuam com a antiga; a API passa a lista de serviços que tiram do expediente e a janela de todas as unidades; a 6.38 acrescenta à alocação o pedido de resolver o choque numa transação e devolve o que o "Desfazer" precisa.

**Tech Stack:** TypeScript (motor puro), Postgres, Hono, zod, React, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-choque-universal-design.md`.

## Global Constraints

- Antes da fase 7. Duas entregas, uma depois da outra: branch `fase6-37-choque-universal` (da `main`; **tem migração 0042**) e branch `fase6-38-resolver-choque` (da `main` depois da 6.37; sem migração prevista).
- O escalante nunca é bloqueado de fechar a escala; o choque trava **a alocação** (já é assim), não o fechamento.
- Casos gravados do protótipo (`casos/detectarChoques_.json`) não mudam: a regra nova é do sistema novo e é testada em `pacotes/dominio/test` (CLAUDE.md).
- Textos fixos: opção do serviço "Pode tirar o militar do Adm do expediente" com a ajuda "Ligada: lançar este serviço no horário do expediente tira o militar do expediente do dia, depois de confirmar. Desligada: é choque."; motivo "De expediente neste dia"; botão "Tirar de {serviço} e escalar aqui" e, no expediente, "Tirar do expediente e escalar aqui"; confirmações e leitor de tela como na spec.
- Front-end: skill `frontend-design:frontend-design`, componentes da 6.20 e aviso, confirmação e "Desfazer" da 6.21.
- Antes de enviar cada uma: `pnpm test && pnpm typecheck && pnpm build:vercel` (e `pnpm --filter dominio test`); conferir no navegador com dados fictícios.

## Review Focus

1. **Troca, acúmulo, importação e "Desfazer" da 6.21** também respeitam o choque universal: nenhum caminho deixa um militar em dois lugares.
2. **Adm com Saldo no turno A já gravado** antes da entrega: continua sem choque na Grade e no painel do dia (o expediente some pelo cálculo).
3. **Choque com escala de outra unidade** aparece com o nome da escala e da unidade; de ramo de cima ou irmão, sem botão.
4. **Falha no meio de "tirar de lá e escalar aqui"** (a vaga daqui foi ocupada nesse meio tempo): nada muda dos dois lados.
5. **Saldo acima da cota** ("7/6"): barra cheia em âmbar, sem travar.

---

# Entrega 6.37 — choque universal (tem migração 0042)

### Task 1: o motor

**Files:** Modify `pacotes/dominio/src/choques.ts` (`detectarChoques`, `expedienteChocaCom`, `SUBSTITUEM_EXPEDIENTE`), `pacotes/dominio/src/parametros.ts` (sai `ADM_CUMPRE_CARGA`); Test `pacotes/dominio/test/choques-universal.test.ts`

**Interfaces:**
- Produces: `detectarChoques(alocs, horarios, op?: { mes?; tipos?; tiramDoExpediente?: string[] | null })`. Com `tiramDoExpediente` (lista de nomes de serviço), vale a regra nova: o expediente implícito choca com **qualquer** serviço; some do dia só sob uma alocação real de um serviço da lista que se sobrepõe a ele (e sob o próprio Adm real do dia). Sem a opção, a regra antiga (casos do protótipo).

- [ ] **Step 1: testes:** com `tiramDoExpediente: ['Saldo']`: JES às 10h num dia útil de um Adm → choque `expediente`; PJES e Pronto também; Saldo sobreposto ao expediente → sem choque (e o expediente some); Diária → choque; fim de semana → sem expediente; sem a opção, os casos gravados continuam passando.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (`pnpm --filter dominio test`). **Step 5:** commit `Fase 6.37: o choque com o expediente vale para qualquer serviço`.

### Task 2: o banco e o cadastro do serviço

**Files:** Create `apps/api/banco/migracoes/0042_choque_universal.sql`; Modify `apps/api/src/cadastros/configuracoes.ts` (`CHAVES_SISTEMA` sem `ADM_CUMPRE_CARGA`), as rotas e o contrato de serviços (`pacotes/contratos/src/servicos.ts`: `tiraDoExpediente: boolean`), a tela de cadastro do serviço em `apps/web/src/routes/_app/servicos*`, a importação de serviços se ela grava o serviço inteiro; Test `apps/api/test/servicos*.test.ts`, `apps/api/test/configuracoes.test.ts`, `apps/web/src/__testes__/servicos*.test.tsx`, `configuracoes.test.tsx`

- Migração: `servico.tira_do_expediente boolean not null default false`; liga nos serviços cujo nome normalizado é `saldo`; apaga os valores gravados do parâmetro `ADM_CUMPRE_CARGA`.
- [ ] **Step 1: testes:** o serviço novo nasce com a opção desligada; ligar e desligar grava; o Saldo vem ligado depois da migração; o parâmetro "Adm cumpre a carga mensal" não aparece mais em Configurações e a importação de configurações recusa ou ignora a chave como as chaves desconhecidas de hoje.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.37: a opção do serviço e sai o parâmetro do Adm`.

### Task 3: a API usa a regra nova em todo lugar

**Files:** Modify `apps/api/src/escala/elegibilidade.ts` (a janela olha alocações de todas as unidades, como a 6.33 fazia para o externo; motivo "De expediente neste dia" no choque com o expediente), `apps/api/src/grade/grade.ts`, `apps/api/src/grade/dia.ts`, e o que mais chamar `detectarChoques` (passar `tiramDoExpediente` com os nomes dos serviços com a opção ligada, e os horários dos serviços das outras unidades); Test `apps/api/test/elegibilidade*.test.ts`, `grade*.test.ts`

- [ ] **Step 1: testes:** Adm numa vaga de JES às 10h de dia útil → motivo "De expediente neste dia" e 409 ao gravar; Saldo no mesmo horário → candidato com o motivo e o tipo de choque `expediente` resolvível (o 409 sem pedir a resolução continua, e o pedido vem na 6.38); militar do Pronto escalado em outra unidade no mesmo horário → "Já escalado neste horário"; Saldo já gravado sobre o expediente → sem choque na Grade e no painel do dia (Review Focus 2); troca e acúmulo recusam o choque com o expediente (Review Focus 1).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.37: o choque olha todas as unidades e o expediente sem exceção`.

### Task 4: as regras escritas

**Files:** Modify `docs/negocio/regras/carga-expediente-choques.md` (RN-17, RN-20, RN-23, RN-25, RN-91 conforme a spec; a coluna "No sistema novo"), `docs/negocio/regras/normativo-a-validar.md` (sai a P-34; entra a P-36 da spec, se a PLANEJAMENTO ainda não tiver posto)

- [ ] **Step 1:** conferir o texto contra o que a entrega faz. **Step 2:** commit `Fase 6.37: regras do choque universal` e enviar a branch à PLANEJAMENTO.

---

# Entrega 6.38 — resolver o choque e a cota de saldo à vista

### Task 5: a API de resolver

**Files:** Modify `apps/api/src/escala/rotas.ts` (`POST /escalas/:id/alocacoes` aceita `resolverChoque`), `apps/api/src/escala/elegibilidade.ts` (o candidato em choque traz o que choca e se dá para resolver), `pacotes/contratos/src/escala*.ts`; Create a rota de desfazer a resolução; Test `apps/api/test/resolver-choque.test.ts`

**Interfaces:**
- Produces:
  - O candidato em choque ganha `choque?: { tipo: 'alocacao'; alocacaoId: string; servico: string; data: string; inicio: string; fim: string; escala: string; unidadeSigla: string; podeResolver: boolean } | { tipo: 'expediente'; data: string; podeResolver: boolean }`.
  - `podeResolver` (alocação): quem pede pode escalar na escala de lá, que é da unidade de quem pede ou de uma de baixo (ramo de cima ou irmão: falso). (Expediente): o serviço da vaga tem `tiraDoExpediente` e quem pede tem poder na lotação do militar.
  - `POST /escalas/:id/alocacoes` com `resolverChoque: { alocacaoId: string } | { expediente: true }`: numa transação, tira a alocação de lá (pela remoção devolvível da 6.21) e grava a daqui; com `expediente`, grava a daqui. Resposta: a alocação nova e `desfazer: { alocacaoId: string; remocaoId: string | null }`.
  - `POST /resolucoes/desfazer { alocacaoId, remocaoId }`: numa transação, tira a alocação nova e devolve a de lá (409 com a frase da 6.21 quando não dá).
- [ ] **Step 1: testes:** resolver na mesma escala, em outra escala da unidade e numa de baixo → 201; numa escala de cima ou irmã → 403 e nada muda (Review Focus 3); a vaga daqui ocupada no meio → 409 e nada muda dos dois lados (Review Focus 4); expediente com Saldo → 201; expediente com JES → 409 (não resolve); desfazer devolve as duas pontas.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.38: resolver o choque ao escalar`.

### Task 6: a tela de resolver

**Files:** Modify o diálogo de escolher militar da Escala do mês (`apps/web/src/componentes/escala-do-mes/`), e o do Efetivo por dia se ele usar a mesma escolha; Test `apps/web/src/__testes__/escala-do-mes.test.tsx`

- [ ] **Step 1: testes:** o militar em choque aparece com o serviço, o dia, o horário, a escala e a unidade; com `podeResolver`, o botão da spec abre a confirmação da spec; confirmar escala e mostra o aviso com "Desfazer", que desfaz as duas pontas; sem `podeResolver`, só o motivo; no expediente com JES, só "De expediente neste dia".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.38: tirar de lá e escalar aqui`.

### Task 7: a cota de saldo à vista

**Files:** Modify a API dos candidatos, da Escala do mês e da Grade geral (cada militar do Adm traz `saldos: { feitos: number; total: number }` do mês: os Saldos dele no mês em qualquer escala e o parâmetro `SALDOS_ADM_POR_MILITAR`); Create `apps/web/src/componentes/CotaDeSaldo.tsx` (a barra); Modify a lista de candidatos, a placa da Escala do mês (o número "2/6" ao lado da etiqueta do Saldo) e a linha da Grade geral; Test os de cada tela

- [ ] **Step 1: testes:** a barra aparece só para militar do Adm, na frente da matrícula, na escolha do militar e na Grade; o leitor de tela diz "{n} de {total} saldos no mês"; a placa de Saldo mostra "2/6"; acima do total, barra cheia em âmbar e "7/6" (Review Focus 5); nenhuma tela rola de lado em 390 px.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador. **Step 5:** commit `Fase 6.38: a cota de saldo do Adm à vista` e enviar a branch à PLANEJAMENTO.
