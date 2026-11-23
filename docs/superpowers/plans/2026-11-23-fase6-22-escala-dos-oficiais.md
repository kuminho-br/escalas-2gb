# Entrega 6.22 — Escala dos oficiais refeita: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a tela da Escala dos oficiais mostra com destaque quem foi lançado em cada turno, com menos peso no fundo dos dias, e um painel de cotas largo, que mostra todos os dados de cada oficial sem rolagem.

**Architecture:** só o site. Mudam `CalendarioDosOficiais.tsx`, `ListaDeCotas.tsx`, `EscalaDoMes.tsx` (a divisão entre calendário e painel) e o cartão "Vez de escolher". Nenhuma rota, contrato ou regra muda.

**Tech Stack:** React, Tailwind 4 com os tokens de `apps/web/src/estilo.css`, Vitest e Testing Library.

**Spec:** pedido urgente do usuário de 23/11/2026 (registrado em `docs/decisoes.md`), mais as diretrizes gerais aprovadas em `docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md` (letra, placa, cores).

## Global Constraints

- **Urgente:** é a próxima entrega depois da 6.16, antes da 6.17. Branch `fase6-22-escala-dos-oficiais`, a partir da `main`. Sem migração.
- Ative a skill `frontend-design:frontend-design`. As diretrizes gerais são guia; adeque ao que a tela tem hoje e registre as escolhas no resumo do PR.
- Use os tokens que já existem (a 6.20 troca depois pelos definitivos). Nenhum texto abaixo de 13 px; hoje há `text-[11px]` e `text-xs` na tela, que saem.
- Dia e noite continuam se distinguindo pela cor (decisão do usuário de 22/11/2026), mas sem o bloco preto: a cor diz o turno, não domina a tela.
- "Patente" nas telas, sem "BM".
- Não mudar o comportamento: clicar no turno livre lança a escolha da vez; com a escala fechada o clique abre a troca; "Tirar" continua; "Subir" e "Descer" continuam.
- Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador, com dados fictícios, em 1440, 1280 e 390 px.

## Review Focus

1. **Nome longo e patente longa no turno** (SUB TEN, ASP, nome de 12 letras): corta o nome com reticências, nunca a patente, e a dica mostra tudo.
2. **Quatro ou mais oficiais na lista:** o painel cresce para baixo, sem rolagem de lado.
3. **Turno com alerta e turno "cobriu X"** (troca): o destaque do nome continua legível com a marca de alerta e a linha extra.
4. **Tela de 1280 px:** o painel continua sem rolagem de lado; o calendário cede.
5. **Celular (390 px):** o painel vai para cima do calendário, como hoje, e nada rola de lado.

---

### Task 1: o calendário com o nome em destaque

**Files:** Modify `apps/web/src/componentes/oficiais/CalendarioDosOficiais.tsx`; Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:**
  - O turno com nome mostra a patente (13 px, `apagado`) e o nome (17 px, estreita, peso 600, `tinta`) numa placa clara, com uma faixa de 4 px à esquerda na cor do turno; o turno livre mostra só "livre" em 13 px `apagado`, com borda tracejada, sem fundo cheio.
  - Dia e Noite se distinguem pela faixa e por um fundo leve (Noite em `passa` ou um tom claro de `tinta`), e nenhum turno tem fundo preto.
  - A caixa do dia perde a borda e o fundo próprios; o número do dia fica em 15 px peso 600; o nome do dia da semana sai de cada dia (o cabeçalho das colunas já diz).
  - O turno que acabou de ser lançado fica marcado (contorno de 2 px `tinta`) até o próximo lançamento, e o aviso "{patente} {nome} ficou com o turno {Dia|Noite} de {dd/mm}." aparece em `role="status"`.
  - Os turnos do oficial da vez ficam com o contorno de 1 px `vinho`, para ele ver o que já tem.
  - Review Focus 1 e 3.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `Fase 6.22: o nome escalado em destaque no calendário dos oficiais`.

### Task 2: o painel largo, com todos os dados

**Files:** Modify `apps/web/src/componentes/oficiais/EscalaDoMes.tsx`, `ListaDeCotas.tsx` e o cartão "Vez de escolher"; Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:**
  - Em 1440 e 1280 px, a divisão é calendário `minmax(0,1fr)` e painel de 30 rem (480 px) no mínimo; o painel não tem rolagem de lado (Review Focus 2 e 4).
  - A tabela de cotas vira uma lista de linhas por oficial, cada uma com: a marca "Participa", a ordem, a patente e o nome (17 px estreita), o quadro e a lotação; e, em números grandes (17 px, `tabular-nums`), Saldo, Dias, Cota (com "+1 sobra" embaixo) e Escolhidos como "{n} de {cota}", com uma barra fina do quanto falta; os afastamentos embaixo, em `pendencia`; "Subir" e "Descer" onde já aparecem hoje.
  - O oficial da vez tem a linha marcada (fundo `pendencia-fundo` ou contorno `vinho`), e o cartão "Vez de escolher" diz o nome em 20 px e "Faltam {n} turnos para ele".
  - Escolhidos acima da cota continua dizendo "{n} a mais" em `pendencia`.
  - Review Focus 5.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar. O texto de rodapé ("62 turnos no mês…") fica, em 13 px.
- [ ] **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar as três larguras para o PR.
- [ ] **Step 5:** commit `Fase 6.22: o painel de cotas largo, com todos os dados do oficial` e abrir o PR.

O item 28 da 6.17 (Cotas sem rolagem) passa para esta entrega.
