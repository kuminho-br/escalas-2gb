# Ajustes da Grade geral (6.46): a fronteira da rolagem, a cota de saldo e os filtros de equipe — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo (decisão do usuário, 24/11/2026): front-end no Fable.** Se a sessão estiver em outro modelo, avise o usuário antes de começar e espere. Revisão final no Opus.

**Goal:** três ajustes pedidos pelo usuário ao usar a Grade geral para preparar dezembro: marcar onde começa a área que rola, pôr a barra da cota de saldo à direita da matrícula e dar identidade aos filtros de equipe.

**Architecture:** só o site. Um token novo de cor, `fronteira`, na régua de estilo (`apps/web/src/estilo.css`), usado nas bordas que separam a parte fixa da que rola em `TabelaDaGrade.tsx`; a célula do militar troca a ordem da matrícula e da `CotaDeSaldo`; os filtros de equipe de `routes/_app/grade.tsx` viram um grupo segmentado; o nome da jornada Adm passa a "ADM" em `lib/militares.ts`.

**Tech Stack:** React, Tailwind 4, Vitest.

**Pedidos do usuário (24/11/2026, itens 1, 2 e 3 do pool `docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`):**
1. Uma linha de cor mais forte separando o calendário das colunas de dados: marcar a área que rola (horizontal e vertical) e a que não rola, inclusive a linha de cima, que separa as datas das alocações. O padrão fica a critério da PLANEJAMENTO com a DESIGN, e vale para toda tabela com rolagem.
2. A barra de alocação de saldos do Adm fica à direita da matrícula, alinhada à direita dentro da célula do militar (hoje vem antes).
3. Os botões de equipe (Todas, ALFA, BRAVO, CHARLIE, DELTA, Adm) sem identidade visual: repensar. "Adm" vira "ADM".

**Desenho:** a DESIGN confere as três escolhas abaixo antes de a entrega começar e pode ajustá-las no Manual de Identidade Visual (`docs/telas/refatoracao/index.html`); o que ela registrar lá vence este plano.

## Escolhas (PLANEJAMENTO, a conferir pela DESIGN)

- **Fronteira da rolagem:** token `--color-fronteira: #8A94A3` (cinza mais escuro que `linha` `#D8DDE4`, mais claro que `apagado` `#5B6675`), em linha de **2 px**, nos três limites entre o fixo e o que rola: a direita da coluna do militar, a esquerda da coluna PJES (a primeira das colunas presas à direita, em 1440 px ou mais) e a base do cabeçalho das datas. As linhas internas (entre dias, entre militares, a de segunda-feira) continuam como estão. O padrão vira regra do Manual: **"tabela com rolagem: a fronteira entre o fixo e o que rola é uma linha de 2 px na cor `fronteira`"**.
- **Cota de saldo:** a célula do militar fica com a patente e o nome em cima e, embaixo, a matrícula à esquerda e a barra encostada à direita da célula (`ml-auto`). O leitor de tela continua dizendo "{n} de {total} saldos no mês".
- **Filtros de equipe:** um grupo segmentado com rótulo "Equipe" (os botões colados numa só caixa com borda, como abas pequenas); o escolhido com fundo `vinho` a 10%, texto e borda `vinho` e uma marca de visto antes do nome; os nomes em caixa alta (ALFA, BRAVO… ADM); "Todas" separado por um traço fino. Continuam multisseleção e `aria-pressed`.
- **"ADM":** `NOME_JORNADA.adm` passa a "ADM", e com ele todo lugar que mostra a jornada (Grade, ficha, lista de Militares, painel do dia, trocar serviço). "Pronto" continua "Pronto".

## Global Constraints

- Branch `fase6-46-ajustes-da-grade`, a partir da `main` (depois da 6.45). Sem migração, sem API.
- Skill `frontend-design:frontend-design`; o token novo entra na régua e passa na guarda de estilo da 6.20 (nada de cor solta; as cores soltas que a Grade ainda tem nas bordas, `#C9CED6` e `#EEF0F3`, podem virar token se a DESIGN pedir, senão ficam).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440, 1280 e 390 px, com a Grade rolada para o meio do mês. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Abaixo de 1440 px** as colunas PJES e Diárias não ficam presas: a fronteira da esquerda delas não aparece (não há o que separar), e a da coluna do militar e a do cabeçalho continuam.
2. **Grupo recolhido** (ALFA fechado): a fronteira da coluna do militar continua contínua, sem buraco na linha do grupo.
3. **Militar do Pronto** (sem barra de saldo): a matrícula fica no mesmo lugar que a do Adm, sem pular.
4. **Celular (390 px):** o grupo segmentado quebra em duas linhas sem rolar de lado.
5. **"ADM" nos textos lidos pelo leitor de tela** ("jornada ADM") e nas etiquetas: nenhum "Adm" sobrando na tela (conferência por busca no código).

---

### Task 1: a fronteira da rolagem

**Files:** Modify `apps/web/src/estilo.css` (token), `apps/web/src/componentes/grade/TabelaDaGrade.tsx`; Test `apps/web/src/__testes__/grade*.test.tsx`

- [ ] **Step 1: testes:** a célula do militar (cabeçalho e linhas, inclusive a linha do grupo) e o cabeçalho das datas têm a borda de 2 px na cor `fronteira`; a coluna PJES tem a borda esquerda `fronteira` só em `min-[1440px]` (Review Focus 1 e 2).
- [ ] **Step 2:** FAIL. **Step 3:** implementar; registrar a regra da fronteira no Manual, na seção da Grade, se a DESIGN ainda não tiver registrado. **Step 4:** PASS. **Step 5:** commit `Fase 6.46: a fronteira entre o fixo e o que rola na Grade`.

### Task 2: a cota de saldo à direita da matrícula

**Files:** Modify `apps/web/src/componentes/grade/TabelaDaGrade.tsx` (linhas 120 a 127); Test `apps/web/src/__testes__/grade*.test.tsx`

- [ ] **Step 1: testes:** na linha do Adm, a matrícula vem antes da barra na ordem do documento e a barra está encostada à direita; na linha do Pronto, a matrícula no mesmo lugar (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.46: a cota de saldo à direita da matrícula`.

### Task 3: os filtros de equipe e o "ADM"

**Files:** Modify `apps/web/src/routes/_app/grade.tsx` (o grupo de botões), `apps/web/src/lib/militares.ts` (`NOME_JORNADA`), e os lugares que escrevem "Adm" à mão (`componentes/grade/PainelDoDia.tsx:74`, `componentes/grade/TrocarServico.tsx:55`, e o que a busca achar); Test `apps/web/src/__testes__/grade*.test.tsx` e os que conferem o texto "Adm"

- [ ] **Step 1: testes:** o grupo tem o rótulo "Equipe", os nomes em caixa alta e o escolhido com `aria-pressed="true"` e a marca de visto; "Todas" continua limpando a escolha; nenhuma tela mostra "Adm" (Review Focus 5); em 390 px o grupo quebra sem rolar de lado (Review Focus 4).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.46: os filtros de equipe com identidade e ADM` e enviar a branch à PLANEJAMENTO.
