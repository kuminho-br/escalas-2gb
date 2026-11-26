# A unidade pelo caminho de siglas e a planilha das linhas com problema (6.57) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** nas planilhas, a unidade é identificada pelo caminho de siglas ("2º GB / 1ª SB"), na importação e na exportação; toda importação devolve, quando há linhas com problema, uma planilha com essas linhas e o motivo, para corrigir e enviar de novo; os ícones apagados "Histórico" e "Ajuda" saem do trilho.

**Architecture:** uma peça única (`apps/api/src/importacao/caminho-da-unidade.ts`) lê e escreve o caminho, usada pela importação do Pecúlio e pela exportação (6.54), no lugar de `comRotulo` e do "SIGLA (MÃE)". A planilha de erros é gerada pela mesma rota da importação (`POST /unidades/:u/importacao/:cadastro`), com `?erros=1`: ela relê o arquivo, faz a prévia só de leitura e devolve as linhas que têm problema, com as colunas do arquivo e duas a mais. Vale para todo importador, sem mudar nenhum.

**Tech Stack:** Hono, exceljs, Postgres com ltree (PGlite nos testes), React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-unidade-pelo-caminho-de-siglas-design.md` (aprovado em 25/11/2026). A planilha de erros: pool, item 33, com a forma aprovada pelo usuário em 25/11/2026 (nas Global Constraints). Os ícones: pool, item 32, e `docs/decisoes.md` (25/11).

## Global Constraints

- Branch `fase6-57-caminho-de-siglas-e-planilha-de-erros`, a partir da `main`. Sem migração.
- **Importação é contrato:** o caminho substitui o "SIGLA (MÃE)", que deixa de ser aceito; nenhum outro formato muda.
- **O separador:** a barra só separa unidades quando tem espaço de pelo menos um lado (`/\s+\/\s*|\s*\/\s+/`); "DInter/1" é uma sigla só. Ao escrever, " / ".
- **Ler:** vale o pedaço final do caminho que aponte uma unidade só no alcance da importação (a unidade e as de baixo, em vigor); sem diferenciar maiúsculas nem acentos (`normalizar`). Mensagens fixas:
  - mais de uma: `Há mais de uma "{texto}". Escreva com a unidade de cima: {caminhos}.` (os menores caminhos únicos das candidatas, separados por vírgula);
  - nenhuma: `Lotação "{texto}" não é desta importação. A lista está na aba AJUDA do modelo.`
- **Escrever:** cada unidade sai com o menor pedaço final do caminho que é único entre as unidades em vigor da corporação inteira (na exportação, no modelo e na AJUDA).
- **A planilha das linhas com problema:**
  - o botão "Baixar as linhas com problema" aparece na prévia e no resultado de toda importação que tenha linha em `problemas` ou célula em `ignoradas`;
  - o arquivo tem as mesmas abas e o mesmo cabeçalho do enviado, só com essas linhas, na ordem original, e mais duas colunas no fim: "MOTIVO" e "COMO CORRIGIR";
  - linha recusada: "MOTIVO" = `mensagem`, "COMO CORRIGIR" = `solucao` do problema; linha com célula ignorada (Pecúlio): "MOTIVO" = `{coluna}: {motivo}`, "COMO CORRIGIR" vazio; com mais de um motivo na mesma linha, um por linha da célula (quebra de linha);
  - abas sem linha com problema saem só com o cabeçalho (o arquivo tem que ter todas as abas para voltar); a aba AJUDA não entra;
  - toda célula sai como texto (`numFmt '@'`), com o texto como foi lido;
  - problema sem linha (da planilha inteira) não entra no arquivo: já aparece na tela;
  - nome: `{cadastro}-linhas-com-problema-{aaaa-mm-dd}.xlsx`.
- O trilho do módulo de escala perde "Histórico" e "Ajuda" (`apps/web/src/lib/modulos.ts`).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **"DInter/1" e "2º GB / DInter/1":** a primeira é uma sigla; a segunda, um caminho de duas (Task 1).
2. **Volta da exportação:** o arquivo exportado (6.54) com uma unidade de sigla repetida, importado por um grupamento onde a sigla é única, reconhece a LOTAÇÃO sem célula ignorada (Task 1).
3. **Volta da planilha de erros:** corrigir uma linha no arquivo baixado e enviá-lo de novo: as colunas "MOTIVO" e "COMO CORRIGIR" não atrapalham, e a linha entra (Task 2).
4. **Arquivo com muitas abas** (Serviços e escalas, Guarnições): só as linhas com problema saem, cada uma na sua aba, e as abas sem problema saem com o cabeçalho (Task 2).
5. **Célula que o Excel transformou em data** (NASCIMENTO): sai como o texto lido, e a pessoa vê o que precisa corrigir (Task 2).

---

### Task 1: o caminho de siglas

**Files:** Create `apps/api/src/importacao/caminho-da-unidade.ts`; Modify `apps/api/src/importacao/peculio.ts` (`catalogos`, a leitura da LOTAÇÃO, a AJUDA; sai `comRotulo`), `apps/api/src/importacao/peculio-colunas.ts` (`lerSigla` para posto e quadro continua; a lotação passa a usar a peça nova), `apps/api/src/visao/exportar.ts`; Test `apps/api/test/caminho-da-unidade.test.ts`, os testes da importação do Pecúlio e da exportação

**Interfaces (Produces):**
- `type UnidadeDoCaminho = { id: string; siglas: string[] }` (da raiz até a unidade).
- `unidadesDoCaminho(c: Consulta, hoje: string): Promise<UnidadeDoCaminho[]>`: as em vigor da corporação.
- `menorCaminhoUnico(u: UnidadeDoCaminho, todas: UnidadeDoCaminho[]): string`.
- `acharPeloCaminho(texto: string, alcance: UnidadeDoCaminho[], todas: UnidadeDoCaminho[]): Leitura<UnidadeDoCaminho>` (o `Leitura` de `peculio-colunas.ts`), com as mensagens fixas.

- [ ] **Step 1: testes:** com a árvore CBMPE › DGO › DInter/1 › 2º GB › 1ª SB e CBMPE › DGO › DInter/1 › 3º GB › 1ª SB › 1ª Seção e 2º GB › 1ª SB › 1ª Seção: `menorCaminhoUnico` dá "2º GB / 1ª SB" e "2º GB / 1ª SB / 1ª Seção", e "DInter/1" para a própria; `acharPeloCaminho("1ª SB")` no alcance do 2º GB acha a do 2º GB; no alcance do DInter/1, ambígua com a mensagem fixa listando "2º GB / 1ª SB, 3º GB / 1ª SB"; "2º gb/ 1ª sb" acha (caixa e espaço); "DInter/1" é uma sigla (Review Focus 1); "1ª SB (2º GB)" não é aceito (contrato); a LOTAÇÃO exportada volta reconhecida (Review Focus 2); a AJUDA do modelo lista os caminhos.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (os `siglas` com uma consulta só, pelos ancestrais no `caminho` ltree). **Step 4:** PASS. **Step 5:** commit `Fase 6.57: a unidade pelo caminho de siglas`.

### Task 2: a planilha das linhas com problema

**Files:** Create `apps/api/src/importacao/linhas-com-problema.ts`; Modify `apps/api/src/importacao/rotas.ts` (o `?erros=1`), `apps/web/src/componentes/ImportarPlanilha.tsx`, `apps/web/src/api/cliente.ts` (baixar a resposta de um envio de arquivo); Test `apps/api/test/linhas-com-problema.test.ts`, `apps/web/src/__testes__/` (o teste da importação)

**Interfaces (Produces):**
- `planilhaDasLinhasComProblema(abas: Record<string, Aba>, ordem: string[], previa: Previa, abaDasIgnoradas: string | null): Promise<ArrayBuffer>` (`ordem` = `imp.abas`; `abaDasIgnoradas` = a aba do Pecúlio, onde caem as `ignoradas`).
- `POST /api/unidades/:u/importacao/:cadastro?erros=1` (o mesmo corpo da importação) → o .xlsx; sem nenhuma linha com problema, 400 "Nenhuma linha com problema nesta planilha.". Mesmas permissões da importação, e nunca grava (transação só de leitura).
- No site: `baixarEnvio(caminho: string, arquivo: File, nome: string): Promise<void>`.

- [ ] **Step 1: testes:** Pecúlio com uma linha recusada e uma com célula ignorada: o arquivo tem as duas, com "MOTIVO" e "COMO CORRIGIR" pelas regras das Global Constraints, e o cabeçalho igual ao enviado; Serviços e escalas com problema numa aba só (Review Focus 4); célula de data sai como o texto lido (Review Focus 5); a volta: o arquivo baixado, com a linha corrigida, entra na importação (Review Focus 3); sem problema, 400 com a mensagem fixa; quem não pode importar leva 403; na tela, o botão aparece na prévia e no resultado só quando há problema ou célula ignorada, e baixa com o nome fixo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.57: a planilha das linhas com problema`.

### Task 3: o trilho sem Histórico e Ajuda

**Files:** Modify `apps/web/src/lib/modulos.ts:90-91`; Test `apps/web/src/__testes__/modulos*.test.tsx`

- [ ] **Step 1: teste:** o trilho do módulo de escala não tem "Histórico" nem "Ajuda". **Step 2:** FAIL. **Step 3:** tirar os dois itens (e os ícones que ficarem sem uso). **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador a importação do Pecúlio com uma planilha com problemas, em 1440 e 390 px. **Step 5:** commit `Fase 6.57: o trilho sem Histórico e Ajuda` e enviar a branch à PLANEJAMENTO.
