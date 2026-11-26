# Afastados na Grade geral (6.70) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** a Grade geral mostra, em cada dia de afastamento do militar, um traço na célula do dia (dias seguidos formam uma linha contínua), e a célula inteira do nome do militar passa a ser clicável.

**Architecture:** a Grade já lê os afastamentos do mês (para tirar o expediente do Adm), mas só guarda início e fim. A API passa a mandar, por linha, os **períodos** de afastamento do mês com o tipo (`{ tipo, inicio, fim }`), já recortados aos dias que a linha cobre; o site desenha o traço na célula de cada dia coberto. Sem migração.

**Tech Stack:** Hono, zod/tipos em `contratos`, React, Tailwind, Vitest.

**Spec:** pedido do usuário de 26/11/2026 (via DESIGN): `docs/telas/refatoracao/pool-de-feedbacks-ux.md` (branch `docs-pool-feedbacks-ux`), itens 1 e 2. Sem mockup: o traço é a proposta da DESIGN, aceita aqui.

## Global Constraints

- Branch `fase6-70-afastados-na-grade`, a partir da `main`. **Sem migração.** Nada roda em banco remoto. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Fotos da Grade em 1440, 1100 e 390 px. Enviar a branch uma vez só, no fim.
- **O traço:** horizontal, no meio da célula do dia, na cor `apagado` do Manual, sem fundo; dias seguidos de um mesmo afastamento formam **uma linha contínua** de ponta a ponta (a célula não tem margem lateral para o traço, as células vizinhas se encontram). Fica **atrás** dos quadrados de serviço, nunca esconde a letra do turno nem o contorno do choque.
- **O tipo** ("Férias", "LTS"…) é o nome do tipo de afastamento cadastrado (`tipo_afastamento.nome`), nunca uma lista no código. Aparece na dica ao passar o mouse (`title` da célula) e no nome acessível da célula: `"SD ALFA, dia 12: sem serviço, afastado: Férias"`.
- Legenda da Grade ganha o item "Afastado" com o mesmo traço. O painel do dia continua como está ("Afastado: Férias").
- Nada de cor nova: tokens e componentes do Manual (`apagado`, `vinho`, `encaixe`). Skill `frontend-design:frontend-design` para o acabamento.
- Textos sem jargão. O escalante nunca é bloqueado: o traço é informação, não impede escalar (como hoje).
- Nenhum dado pessoal real em repositório, teste ou CI.

## Review Focus

1. **Afastamento que entra pelo mês vizinho:** começa no mês anterior ou termina no seguinte; o traço cobre os dias do mês que a Grade mostra, sem sobrar nem faltar (Task 1 e 2).
2. **Militar com duas linhas no mês** (mudou de equipe ou de jornada): o traço aparece só nos dias do período de cada linha, nunca nos dois (Task 1).
3. **Dois afastamentos no mesmo dia** (tipos diferentes): o traço é um só; a dica diz o primeiro por data de início (Task 1).
4. **Afastado com serviço lançado no dia:** o quadrado do serviço continua visível e o traço passa atrás; o choque continua com o contorno vermelho (Task 2).
5. **Teclado e leitor de tela:** o nome da célula diz o afastamento; a célula do nome do militar continua um só botão, com foco visível (Task 2 e 3).

---

### Task 1: a API manda os períodos de afastamento

**Files:** Modify `pacotes/contratos/src/grade.ts`, `apps/api/src/grade/grade.ts`; Test `apps/api/test/grade.test.ts` (ou o arquivo de teste da Grade que já existir; se não houver, `apps/api/test/grade-afastados.test.ts`).

**Interfaces (Produces):**
- Em `contratos`: `export type AfastamentoNaGrade = { tipo: string; inicio: string; fim: string }` (datas `aaaa-mm-dd`, já dentro do mês da Grade) e o campo `afastamentos: AfastamentoNaGrade[]` em `LinhaDaGrade` (lista vazia quando não há; sempre presente).
- Em `grade.ts` (API): a leitura de afastamentos passa a trazer o nome do tipo (`join tipo_afastamento ta on ta.id = a.tipo_afastamento_id`), em ordem de `inicio`. `montarLinha` monta `afastamentos` dia a dia pelo mês da Grade, só nos dias em que a linha vale (`dentro(d)`, a mesma regra dos blocos), e junta dias seguidos do mesmo tipo em um período. Função pura exportada: `periodosDeAfastamento(dias: string[], tipoDoDia: (d: string) => string | null): AfastamentoNaGrade[]` (dias em ordem; dia seguinte = data + 1).
- O expediente do Adm continua tirado nos dias de afastamento (a conta `afastado` de hoje não muda).

- [ ] **Step 1: testes.** (a) `periodosDeAfastamento`: dias 3 a 5 do mesmo tipo viram um período; dias 3-4 e 8 viram dois; tipos diferentes em dias seguidos viram dois períodos; sem dia, lista vazia. (b) Grade de novembro: afastamento de 28/10 a 03/11 vira período 01/11 a 03/11 (recortado ao mês); de 29/11 a 05/12 vira 29/11 a 30/11 (Review Focus 1). (c) militar com duas linhas (mudou de equipe no dia 15) e afastamento de 10 a 20: a primeira linha traz 10 a 14, a segunda 15 a 20 (Review Focus 2). (d) dois afastamentos de tipos diferentes no mesmo dia: um período só, do tipo do que começou antes (Review Focus 3). (e) sem afastamento: `afastamentos` é `[]`. (f) o tipo é o nome cadastrado: renomear o tipo muda o texto.
- [ ] **Step 2:** rodar e ver FALHAR. **Step 3:** implementar. **Step 4:** PASS e `pnpm --filter api typecheck`. **Step 5:** commit `Fase 6.70: a Grade traz os períodos de afastamento`.

### Task 2: o traço na célula do dia

**Files:** Modify `apps/web/src/componentes/grade/CelulaDaGrade.tsx`, `apps/web/src/componentes/grade/TabelaDaGrade.tsx`, `apps/web/src/componentes/grade/LegendaDaGrade.tsx`; Create `apps/web/src/lib/afastamento-na-grade.ts`; Test `apps/web/src/__testes__/grade-afastados.test.tsx` (e os testes da célula que já existirem).

**Interfaces:**
- Consumes: `LinhaDaGrade.afastamentos` (Task 1).
- Produces: `afastamentoDoDia(afastamentos: AfastamentoNaGrade[], data: string): { tipo: string; comeca: boolean; termina: boolean } | null` em `lib/afastamento-na-grade.ts` (`comeca`/`termina` dizem se o período começa ou termina neste dia, para o acabamento do traço). `CelulaDaGrade` ganha a propriedade `afastado: string | null` (o tipo, ou nulo). `nomeDaCelula(l, dia, blocos, choque, afastado?)` acrescenta `, afastado: {tipo}` no fim do nome.

- [ ] **Step 1: testes.** `afastamentoDoDia`: dia dentro, no primeiro, no último, fora; vários períodos. Célula: com `afastado="Férias"` tem `data-afastado="Férias"`, o traço (`data-traco-de-afastamento`, `aria-hidden`), `title="Afastado: Férias"` e o nome acessível termina em ", afastado: Férias"; sem `afastado` nada disso existe; com serviço no dia, a letra do turno continua no DOM e o traço vem antes dela na ordem do DOM (fica atrás); com choque, o `data-choque` e o contorno continuam. Tabela: dias 10 a 12 afastados produzem três células com `data-afastado`, e os dias 9 e 13 não (Review Focus 1, 4 e 5). Legenda: tem o item "Afastado".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. O traço é um `span` absoluto, centrado na vertical, de lado a lado da célula (`inset-x-0`), 2 px, cor `apagado`; no primeiro dia do período começa um pouco depois da borda e no último termina um pouco antes (um respiro de 3 px), para a faixa ler-se como um período e não como uma linha sem fim. A célula precisa de `relative`. Sem animação. **Step 4:** PASS, `pnpm --filter web typecheck`, e fotos em 1440, 1100 e 390 px com um militar afastado de uma semana e outro com serviço no meio do afastamento. **Step 5:** commit `Fase 6.70: o traço de afastamento na célula do dia`.

### Task 3: a célula inteira do nome é clicável

**Files:** Modify `apps/web/src/componentes/grade/TabelaDaGrade.tsx`; Test `apps/web/src/__testes__/grade.test.tsx` (ou o da tabela que já existir).

Pedido do usuário (pool de UI/UX da DESIGN, item 1): hoje o botão do nome cobre só o texto (`hover:underline`).

- [ ] **Step 1: testes.** O botão `data-abrir-ficha` ocupa a célula do militar inteira (a coluna fixa, do posto à barra de saldo): clicar na área da matrícula, do posto ou do espaço ao lado do nome abre a ficha, e há **um** só botão por linha; sem `aoAbrirFicha` (quem só consulta a unidade), nada é botão e o cursor não vira mão; nenhuma classe `hover:underline` no nome; com o mouse sobre a célula, ela ganha o fundo `FUNDO_DA_MARCA_NO_CABECALHO` (o mesmo tom vinho leve da marca; a célula é fixa e opaca, então vale a cor já misturada); o foco do teclado continua visível (`focus-visible:ring-2`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar: o botão passa a envolver a célula (`absolute inset-0` sobre a `th`, que ganha `relative`, ou o botão ocupando a grade inteira da célula; o que mantiver a barra de saldo à direita e o texto no lugar de hoje). Sem sublinhado; o hover pinta a célula. O `aria-label` continua `Abrir a ficha de {posto} {nome}`. **Step 4:** PASS e fotos (1440 e 390 px, com o mouse sobre um nome). **Step 5:** commit `Fase 6.70: a célula do nome inteira abre a ficha`.

### Task 4: fechamento

- [ ] **Step 1:** `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 2:** conferir as fotos: o traço contínuo atravessando os fins de semana, a legenda, o hover do nome. **Step 3:** commit `Fase 6.70: fechamento` e enviar a branch e o resumo à PLANEJAMENTO. Se o pool da DESENVOLVIMENTO tiver outro pedido pequeno da Grade, entra aqui na mesma entrega; avisar no resumo.

## Fora desta entrega

- O traço também na pré-escala e nas telas de escala: só se o usuário pedir.
- Mostrar o tipo do afastamento escrito dentro da célula: não cabe em 48 px; fica na dica e no painel do dia.
