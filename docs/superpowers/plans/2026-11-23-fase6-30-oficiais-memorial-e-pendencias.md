# Escala dos oficiais: memorial de cálculo e pendências (6.30) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a escala dos oficiais ganha um memorial de cálculo (como as cotas foram distribuídas e quem tirou cada serviço, mês a mês, com o histórico de cada recálculo) e fecha as pendências deixadas nas entregas 6.27 a 6.29.1.

**Architecture:** a cada recálculo das cotas, a API grava um registro do memorial com o motivo e a conta inteira; a tela ganha a aba "Memorial de cálculo", que lê esses registros e a lista de serviços do mês, e pode ser impressa. As pendências são acertos pequenos de API e de tela.

**Tech Stack:** Postgres, Hono, zod, React, Vitest.

**Spec:** pedido do usuário de 23/11/2026 ("um local para mostrar como foram as cotas distribuídas e os serviços, uma espécie de memorial de cálculo"); specs `2026-11-23-oficiais-escala-comum-design.md` e `2026-11-23-oficiais-tela-de-escalar-design.md`; e os "menores deixados" dos PRs #172, #173, #177 e #180.

## Global Constraints

- Próxima entrega depois da 6.29.2 (fila: 6.29.2 → **6.30** → 6.20 → 6.21). Branch `fase6-30-oficiais-memorial`.
- **Tem migração:** a do próximo número livre (0039, se a 6.21 ainda não a tiver usado). O PR leva "tem migração" no título.
- O memorial nunca é apagado nem editado: cada recálculo acrescenta um registro.
- Ative a skill `frontend-design:frontend-design`; diretrizes gerais; nenhum texto abaixo de 13 px.
- Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador.

## Review Focus

1. **Muitos recálculos no mesmo mês** (o escalante marca e desmarca dez vezes): o memorial guarda todos, e a tela mostra o último aberto e os anteriores recolhidos, sem pesar a tela.
2. **Mês gravado antes desta entrega:** sem registros, o memorial mostra a conta atual com a frase "Cálculo refeito agora: o histórico começa nesta versão.".
3. **Duas pessoas mexendo ao mesmo tempo:** cada uma gera o seu registro, com o nome de quem fez.
4. **Imprimir:** sai só o memorial (sem menu e sem botões), em tons de cinza legíveis.
5. **Oficial que saiu da unidade depois do mês:** o memorial continua com o nome e a patente que ele tinha.

---

### Task 1: o registro do memorial

**Files:** Create a migração `apps/api/banco/migracoes/00NN_oficiais_memorial.sql` e o seu teste; Modify `apps/api/src/oficiais/rotas.ts` e `leitura.ts` (gravar e ler), `pacotes/contratos/src/oficiais.ts`; Test `apps/api/test/oficiais-memorial.test.ts`

**Interfaces:**
- Produces, banco: `oficiais_memorial (id uuid pk, mes_id uuid not null references oficiais_mes on delete cascade, criado_em timestamptz not null default now(), usuario_id uuid references usuario, motivo text not null, conta jsonb not null)`.
- Produces, contratos: `RegistroDoMemorial = { criadoEm: string; por: { patente: string; nomeGuerra: string } | null; motivo: string; conta: ContaDasCotas }`; `ContaDasCotas = { turnos: number; jes: number; rodada: number; participantes: { militarId; patente; nomeGuerra; diasNoMes; afastamentos: { tipo; inicio; fim }[]; devido: number; cota: number; sobra: boolean }[]; sobraram: number; regraDaSobra: string }`.
- Produces, rota: `GET /api/unidades/:u/oficiais/:mes/memorial?escala={id}` → `{ registros: RegistroDoMemorial[]; servicos: { dia; letra; servico: 'jes' | 'saldo'; patente; nomeGuerra; cobriu?: string }[] }`.
- Motivos fixos: "Abriu o mês", "Mudou quem participa", "Mudou a ordem", "Lançou JES", "Tirou JES", "Afastamento de {patente nome}", "Fechou a escala", "Encerrou o mês".

- [ ] **Step 1: testes:** cada ação que refaz as cotas grava um registro com o motivo e a conta; fechar e encerrar gravam o seu; Review Focus 2, 3 e 5; a rota devolve os registros do mais novo ao mais antigo e a lista de serviços do mês com as coberturas.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.30: o registro do memorial de cálculo`.

### Task 2: a aba "Memorial de cálculo"

**Files:** Create `apps/web/src/componentes/oficiais/MemorialDeCalculo.tsx`; Modify `apps/web/src/routes/_app/oficiais.tsx` (aba nova ao lado de "Escala do mês" e "Painel de saldo"), `EscalaDoMes.tsx` (o botão "Como as cotas foram calculadas" ganha o link "Ver o memorial"); Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:** a aba mostra, para o mês e a escala escolhidos: a conta atual em frases curtas (turnos, menos JES, rodada, participantes, devido de cada um com dias e afastamentos, arredondamento, sobras e para quem) e uma tabela por oficial (devido, cota, sobra); embaixo, os serviços do mês por oficial (dias, serviço, coberturas); e o histórico dos recálculos (data, quem, motivo), com o último aberto e os outros recolhidos (Review Focus 1). O botão "Imprimir" imprime só o memorial (Review Focus 4).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.30: a aba Memorial de cálculo`.

### Task 3: pendências das entregas 6.27 a 6.29.1

**Files:** `apps/api/src/oficiais/rotas.ts`, `leitura.ts`, `apps/web/src/componentes/oficiais/*.tsx`, `apps/web/src/routes/_app/oficiais.tsx`; Test os de oficiais

- [ ] **Step 1: testes:**
  - **Dias vermelhos sem sobrescrever:** a rota aceita `{ dia, vermelho: boolean }` (uma marca por vez); duas telas abertas marcando dias diferentes guardam as duas marcas.
  - **Afastado recusado também na API:** lançar um oficial no dia de afastamento dá 409 com "{patente nome} está afastado em dd/mm ({tipo}) e não pode ficar com este turno." (hoje só a tela recusa).
  - **Botão "Regras"** aparece mesmo quando a unidade ainda não tem escala de rodada.
  - **Painel de saldo coerente:** saldo, coberturas e dias vermelhos contam a mesma coisa (a escala escolhida).
  - **Toque no celular:** a área de clique do dia, no modo de marcar dias vermelhos, tem 44 px.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; verificações do fim de entrega; conferir no navegador. **Step 5:** commit `Fase 6.30: pendências da escala dos oficiais` e abrir o PR ("tem migração").

---

## Fora desta entrega (precisam de decisão do usuário)

- **O saldo entrar na conta da cota** (a sobra ir para quem tem o menor saldo; quanto o saldo desconta da cota): era a "versão seguinte" da spec de 22/11.
- **O JES identificado pelo nome** do serviço ("JES"): fica frágil até os serviços serem padronizados pela árvore (proposta da PLANEJAMENTO, esperando aprovação).
