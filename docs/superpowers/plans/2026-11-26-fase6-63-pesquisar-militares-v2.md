# Pesquisar militares, segunda versão (6.63) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** a tela Pecúlio › Pesquisar militares fica como no mockup aprovado:
- "Selecionados" vira um painel lateral sempre à vista, com a matrícula na frente do nome e "Agrupar por";
- "Critérios de pesquisa" vira um botão só, com abas, a marca âmbar e as etiquetas dos critérios em uso;
- o nome completo sai da busca por padrão, e o trecho achado fica marcado na linha;
- Importar e Exportar ficam juntos no alto.

**Architecture:**
- **Na API:** a busca da 6.51 (`apps/api/src/visao/busca.ts`) ganha um campo que diz onde o texto procura. É a única mudança.
- **No site:** o resto é a tela (`apps/web/src/routes/_app/peculio_.pesquisar.tsx` e `apps/web/src/componentes/peculio/`).
  - Os três botões de filtro de hoje (`FiltrosDaPesquisa`, `ArvoreDeMarcar`, `ArquivoDeMatriculas`) passam a viver como abas de um painel só.
  - A seleção (`Selecao.tsx`) passa a ser desenhada num painel lateral.
  - A lógica de seleção, exportação e lote não muda.

**Tech Stack:** Hono, Postgres/PGlite, zod (`contratos`), React, TanStack Query, Radix, Tailwind com os tokens da 6.20, Vitest.

**Spec:** o mockup aprovado pelo usuário em 26/11/2026, em `docs/telas/refatoracao/pesquisar/index.html` (com `pesquisar.css` e `pesquisar.js`), com a tabela "O que muda" e a seção "O que você decidiu"; o pool, itens 37 a 42; `docs/decisoes.md` (26/11). Mockup é guia, não gabarito.

## Global Constraints

- Branch `fase6-63-pesquisar-militares-v2`, a partir da `main` **com a 6.62 mesclada** (ela traz a lotação pelo caminho, `lotacaoCaminho`, e a unidade do Pecúlio pelo Topo). Sem migração.
- **Onde o texto procura:** matrícula e nome de guerra ligados, nome completo desligado por padrão. A pessoa liga ou desliga cada um na aba "Nome e matrícula". O rótulo do campo acompanha os ligados ("Matrícula ou nome de guerra"; com o nome completo, "Matrícula, nome de guerra ou nome completo"). Pelo menos um fica ligado. Nada disso fica lembrado entre visitas: cada visita começa no padrão.
- **O trecho achado** fica marcado na linha da lista, sem diferenciar maiúsculas nem acentos, como a busca. Marca só nos campos ligados.
- **"Critérios de pesquisa":** um botão só, com quatro abas: "Nome e matrícula", "Pela árvore", "Arquivo de matrículas" e "Outros filtros" (o conteúdo de hoje de cada filtro, sem mudar o que ele faz). Cada aba mostra quantos critérios dela estão em uso. O painel tem "Buscar" embaixo. **O campo principal fica na barra, fora do botão** (decisão do usuário).
- **Critérios em uso:** marca âmbar no botão com a quantidade. Embaixo da barra, uma etiqueta por critério ("Equipe: ALFA", "Lotação: 2º GB / 1ª SB e as de baixo"), com x para tirar; tirar busca de novo. Com dois ou mais, "Limpar critérios". O nome completo ligado conta como critério; o padrão não conta.
- **Painel "Selecionados":**
  - lateral, à direita, parado enquanto a lista rola;
  - **sempre à vista** para quem tem nível de acesso, mesmo vazio, com a orientação do mockup; o militar comum não o vê, como hoje;
  - a linha tem a matrícula na frente do nome, em coluna alinhada;
  - "Agrupar por" no alto do painel: "Sem grupo", "Unidade", "Equipe" e "Posto". Começa em "Unidade". Cada grupo tem o título com a quantidade. Agrupado por unidade, a lotação sai da linha. **Vale só para o painel:** a lista segue em ordem de nome de guerra e matrícula;
  - no celular, uma barra embaixo ("{n} selecionados" e "Ver") abre o painel numa folha. Os critérios também abrem numa folha.
- **Importar e Exportar** ficam no alto, ao lado do título, sempre no mesmo lugar.
  - O Exportar é o da 6.54, sem mudança.
  - O Importar é a importação do Pecúlio (`ImportarPlanilha cadastro="peculio"`), na unidade do Pecúlio (`unidadeDoPeculio(eu)`, corrigida na 6.62).
  - O Importar só aparece para quem pode importar nessa unidade (a mesma regra do Pecúlio da unidade). Ao concluir, a busca atual é refeita.
- **Agrupar por equipe** usa a equipe como ela é hoje (texto). A 6.64 (equipes como cadastro) vai trocar a fonte; não antecipar nada dela.
- **Não mudam:** a janela de exportar, a atualização em lote, a ficha e quem pode selecionar quem.
- **Textos:** os do mockup, inclusive a orientação do painel vazio, os rótulos das abas, "Limpar critérios", "Agrupar por" e a barra do celular.
- Skill `frontend-design:frontend-design`; tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **O caso que motivou o pedido:** buscar "JÚLIO" com o padrão traz só quem tem JÚLIO no nome de guerra (ou na matrícula), e não quem tem Júlio no nome completo; ligando o nome completo, os outros aparecem com o trecho marcado (Task 1 e Task 2).
2. **Tirar a última etiqueta:** a busca volta a pedir um critério ("Escolha pelo menos um filtro.") sem apagar o texto da barra nem a seleção (Task 2).
3. **Seleção grande agrupada:** 300 selecionados agrupados por unidade, em 12 unidades, com o painel rolando por dentro e a página sem rolagem de lado em 1440 e 390 px (Task 3).
4. **Militar sem equipe ou sem lotação** no agrupamento: cai num grupo "Sem equipe" ou "Sem lotação", no fim, e não some (Task 3).
5. **Importar pela tela e a seleção:** importar uma planilha que muda a lotação de um selecionado o mantém selecionado, com o dado novo (o mesmo cuidado da 6.62) (Task 4).

---

### Task 1: onde o texto procura, na API

**Files:** Modify `pacotes/contratos/src/consulta.ts` (`FiltrosDaBusca`), `apps/api/src/visao/busca.ts`; Test o teste da busca da 6.51

**Interfaces (Produces):** em `FiltrosDaBusca`, `procurarEm: z.object({ matricula: z.boolean(), nomeDeGuerra: z.boolean(), nomeCompleto: z.boolean() }).optional()`. Ausente, vale `{ matricula: true, nomeDeGuerra: true, nomeCompleto: false }`; todos falsos é 400 "Ligue pelo menos um lugar para o texto procurar.". A condição de cada palavra só olha os campos ligados (hoje ela junta os três); a matrícula continua achada com ou sem o traço.

- [ ] **Step 1: testes:** o caso do Review Focus 1, com três militares fictícios (JÚLIO de guerra; dois com Júlio só no nome completo); `procurarEm` ausente igual ao padrão; só a matrícula ligada acha "9900123" e "990012-3"; todos desligados, 400 com a frase fixa; a busca sem corte (6.54) e a exportação aceitam o campo do mesmo jeito.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.63: o texto procura só onde a pessoa escolher`.

### Task 2: a barra, "Critérios de pesquisa" e as etiquetas

**Files:** Create `apps/web/src/componentes/peculio/CriteriosDePesquisa.tsx`, `apps/web/src/componentes/peculio/EtiquetasDosCriterios.tsx`, `apps/web/src/lib/marcar-trecho.ts`; Modify `apps/web/src/routes/_app/peculio_.pesquisar.tsx`, `FiltrosDaPesquisa.tsx`, `ArvoreDeMarcar.tsx`, `ArquivoDeMatriculas.tsx` (viram o conteúdo das abas), `ListaDeMilitares.tsx` (o trecho marcado); Test `apps/web/src/__testes__/pesquisar-criterios.test.tsx`

**Interfaces (Produces):** `marcarTrecho(texto: string, palavras: string[]): { texto: string; marcado: boolean }[]` (puro, sem diferenciar maiúsculas nem acentos, devolvendo os pedaços na grafia original).

- [ ] **Step 1: testes:** um botão "Critérios de pesquisa" com as quatro abas e a contagem de cada uma; "Buscar" no painel; o campo principal continua na barra; o padrão de "onde procurar" e o rótulo do campo mudando com o que está ligado; não dá para desligar os três; a marca âmbar com a quantidade; uma etiqueta por critério, o x tira e busca de novo; "Limpar critérios" só com dois ou mais; o Review Focus 2; `marcarTrecho` com acento e caixa ("júlio" marca "JÚLIO"); a linha marca o trecho só nos campos ligados (Review Focus 1); celular: os critérios abrem numa folha.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.63: Critérios de pesquisa, com as etiquetas do que está em uso`.

### Task 3: o painel "Selecionados" ao lado, com o agrupamento

**Files:** Create `apps/web/src/componentes/peculio/PainelDeSelecionados.tsx`, `apps/web/src/lib/agrupar-selecionados.ts`; Modify `apps/web/src/componentes/peculio/Selecao.tsx` (o desenho sai daqui; o estado da seleção continua), `apps/web/src/routes/_app/peculio_.pesquisar.tsx`; Test `apps/web/src/__testes__/pesquisar-selecionados.test.tsx`

**Interfaces (Produces):** `agruparSelecionados(linhas: LinhaDaBusca[], por: 'nenhum' | 'unidade' | 'equipe' | 'posto'): { titulo: string; linhas: LinhaDaBusca[] }[]`. Os grupos saem em ordem: unidade pela ordem da árvore; equipe em ordem alfabética; posto pela ordem dos postos. Dentro do grupo, a ordem é nome de guerra e matrícula. "Sem lotação" e "Sem equipe" vão por último.

- [ ] **Step 1: testes:**
  - o painel aparece vazio, com a orientação, para quem tem nível de acesso, e não aparece para o militar comum;
  - a matrícula vem na frente do nome;
  - "Agrupar por" começa em "Unidade"; cada grupo tem o título com a quantidade; agrupado por unidade, a lotação sai da linha;
  - trocar o agrupamento não mexe na lista de resultados nem na seleção;
  - os casos dos Review Focus 3 e 4;
  - no celular, a barra "{n} selecionados" e "Ver" abre o painel numa folha;
  - as ações de hoje (atualizar em lote, limpar a seleção, tirar um) continuam no painel.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.63: Selecionados num painel ao lado, com o agrupamento`.

### Task 4: Importar e Exportar no alto

**Files:** Modify `apps/web/src/routes/_app/peculio_.pesquisar.tsx`, `apps/web/src/componentes/peculio/ExportarMilitares.tsx` (só o lugar do botão); Test `apps/web/src/__testes__/pesquisar-importar.test.tsx`

- [ ] **Step 1: testes:** Importar e Exportar ao lado do título, presentes antes da primeira busca. O Exportar continua com as regras da 6.54 (só quem tem nível de acesso; sem busca e sem seleção, desabilitado com a dica do mockup, se houver). O Importar aparece só para quem pode importar na unidade do Pecúlio e usa essa unidade. Ao concluir a importação, a busca é refeita. O Review Focus 5.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Rodar as verificações do fim de entrega. Conferir no navegador, em 1440 e 390 px:
  - buscar "JÚLIO" com e sem o nome completo;
  - usar as quatro abas;
  - tirar etiquetas;
  - selecionar e agrupar;
  - exportar e importar o mesmo arquivo.
- [ ] **Step 5:** commit `Fase 6.63: Importar e Exportar no alto da pesquisa`. Enviar a branch à PLANEJAMENTO.
