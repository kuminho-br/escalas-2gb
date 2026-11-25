# Dia vermelho só conta no serviço ordinário (6.44): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (API e uma linha de tela); revisão final no Opus.

**Goal:** na escala dos oficiais, a contagem de dias vermelhos de cada oficial só conta os lugares tirados em serviço do tipo **ordinário** (o Saldo); JES, PJES e Diária não contam, porque são extra e pagam a mais.

**Decisão do usuário (24/11/2026):** "o dia vermelho só conta se o serviço for de tipo ordinário; o JES não conta como dia vermelho na prática, porque o PJES e a diária são extra".

**Architecture:** só a API. Em `apps/api/src/oficiais/leitura.ts`, `vermelhosDe` (a contagem do mês, linha ~196) e a contagem do acumulado dos meses encerrados (linha ~322) passam a filtrar o lançamento pelo tipo do serviço (`servico.tipo = 'ordinario'`), não pelo nome. A tela não muda: a coluna "Vermelhos" e o Painel de saldo só mostram o número.

**Spec:** `docs/superpowers/specs/2026-11-23-oficiais-escala-comum-design.md` (dias vermelhos), que esta entrega atualiza na linha da decisão 6.

## Global Constraints

- Branch `fase6-44-dia-vermelho-so-ordinario`, a partir da `main`. Sem migração.
- Pelo **tipo** do serviço, não pelo nome: um Saldo de outro nome continua contando; um JES renomeado continua não contando.
- Atualizar a spec dos oficiais (decisão 6) e a regra escrita dos dias vermelhos em `docs/negocio/regras/` (onde estiver; se não houver RN própria, a frase entra na RN dos oficiais mais próxima).
- Antes de enviar: `pnpm test && pnpm typecheck`.

## Review Focus

1. **Mês migrado de outro serviço** (a 6.27 criou escalas com o serviço que o mês usava): o serviço do mês antigo é ordinário e continua contando.
2. **Acumulado** (Painel de saldo): mesma regra que o mês.

### Task 0: a ordem da sobra no memorial (acréscimo do usuário, 24/11)

**Files:** Modify `apps/web/src/componentes/oficiais/MemorialDeCalculo.tsx` (e o painel "Como as cotas foram calculadas", se repetir a frase); Test `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1:** confirmar que quem recebe a sobra são os mais modernos (se não, parar e avisar a PLANEJAMENTO); testes: a frase "…entregues aos mais modernos da ordem: …" lista do mais moderno para o mais antigo (3 sobras). **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.44: a sobra listada a partir do mais moderno`.

### Task 1

**Files:** Modify `apps/api/src/oficiais/leitura.ts`; Test `apps/api/test/oficiais*.test.ts`

- [ ] **Step 1: testes:** oficial com Saldo num dia vermelho → `vermelhos: 1`; com JES no mesmo dia vermelho → `vermelhos: 0`; os dois → 1; o acumulado dos meses encerrados segue a mesma conta (Review Focus 2).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.44: o dia vermelho só conta no serviço ordinário` e enviar a branch à PLANEJAMENTO.
