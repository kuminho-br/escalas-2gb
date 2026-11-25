# Exportar militares para Excel (6.54): a planilha com as colunas da importação e a busca sem corte — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** em Pecúlio › Pesquisar militares, quem tem nível de acesso exporta para Excel o resultado da busca, a seleção ou os dois juntos, com os campos que escolher. As colunas têm os mesmos nomes da importação do Pecúlio, para exportar, corrigir no Excel e importar de volta. "Selecionar estes N" passa a pegar o filtro inteiro, não só as linhas mostradas.

**Architecture:** a busca da 6.51 (`apps/api/src/visao/busca.ts`) ganha um modo sem o corte de 500, usado por duas rotas novas: a lista inteira da busca (para selecionar e contar) e a exportação, que monta o .xlsx com o exceljs (já usado na importação). Cada célula segue o que a ficha mostraria a quem exporta (os blocos da 6.11); o que a pessoa não vê sai vazio, e na importação célula vazia não muda nada. As colunas vêm de uma lista só, nos contratos, conferida contra a do importador.

**Tech Stack:** Hono, Postgres (PGlite nos testes), exceljs, React, TanStack Query, Vitest.

**Spec:** não há spec à parte: as decisões do usuário de 25/11/2026 (pela DESIGN, e aceitas nesta sessão) estão nas Global Constraints e em `docs/decisoes.md`. Pool, item 28.

## Global Constraints

- Branch `fase6-54-exportar-militares`, a partir da `main` com a 6.53 mesclada (ou da branch dela; diga no resumo). Sem migração.
- **Só Excel (.xlsx).** Sem PDF.
- **Quem exporta:** só quem tem nível de acesso em alguma unidade (o mesmo `nivel` da tela, `!ehMilitarComum(eu)`). O militar comum não vê o botão, e a API responde 403 "Só quem tem nível de acesso exporta militares.".
- **As colunas:** as da importação do Pecúlio (`COLUNAS` em `apps/api/src/importacao/peculio.ts`), com os mesmos rótulos e na mesma ordem, na aba `PECÚLIO`. **MATRÍCULA sai sempre**: na janela fica marcada e travada.
- **O que sai:** sem seleção, o resultado da busca inteiro. Com seleção, a janela pergunta, com a contagem de cada opção: "Selecionados ({n})" (já marcada), "Resultado da busca ({n})", "Os dois juntos, sem repetir ({n})". Sem seleção, a pergunta não aparece. Sem busca feita, só a seleção. Nunca interseção.
- **Quem vê o quê (6.11):** cada coluna pertence a um bloco da ficha, pela lotação de hoje do militar:
  - Identificação: MATRÍCULA, POSTO/GRAD, NOME COMPLETO, NOME DE GUERRA, LOTAÇÃO, QUADRO.
  - `contato`: TELEFONE, E-MAIL, E-MAIL PESSOAL.
  - `situacao`: SITUAÇÃO, JORNADA, EQUIPE, FUNÇÃO.
  - `dados_da_escala`: MOTORISTA, CNH, VOLUNTÁRIO JES.
  - `comportamento`: COMPORTAMENTO, BOLETIM DO COMPORTAMENTO.
  - Ficha completa (nível de acesso de cadastro na lotação do militar, `temPapel(…, CADASTRO, …)`): ANTIGUIDADE, SEXO, NASCIMENTO, CPF, CEP, LOGRADOURO, NÚMERO, COMPLEMENTO, BAIRRO, CIDADE, UF, ABONO DE PERMANÊNCIA.
  - Célula de um bloco que a pessoa não vê sai **vazia**.
- **Formato de volta:** cada célula sai como a importação lê: NASCIMENTO como texto "dd/mm/aaaa" (ou "dd/mm" sem ano); CNH com as letras juntas ("AD"); SIM/NÃO; JORNADA "PRONTO"/"ADM"; LOTAÇÃO com a unidade de cima quando a sigla se repete ("1ª SB (2º GB)", o `rotulo` do importador); as colunas `texto: true` do importador com o formato de texto (`numFmt '@'`). O cabeçalho reusa o estilo do modelo (`cabecalho` de `apps/api/src/importacao/modelo.ts`).
- **Teto:** a busca sem corte vai até 5000 militares; acima, 400 "Mais de 5000 militares. Afine a busca.".
- Textos fixos da janela: título "Exportar para Excel"; "O que sai"; "Campos"; "Marcar todos"; a nota de MATRÍCULA "Sem a matrícula, o arquivo não volta para o sistema."; a nota "Os campos que você não vê na ficha de um militar saem vazios."; os botões "Baixar planilha" e "Cancelar". Nome do arquivo: `militares-{aaaa-mm-dd}.xlsx`.
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; o diálogo Radix que já existe.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Volta completa:** exportar e importar o mesmo arquivo sem mexer: a prévia da importação diz que nada muda, linha por linha (Task 2).
2. **Campo que a pessoa não vê:** a célula sai vazia, e reimportar o arquivo não apaga o dado do militar (Task 2).
3. **Busca com mais de 500:** a exportação e "Selecionar todos" pegam todos os militares do filtro, não só os mostrados (Tasks 1 e 2).
4. **Os dois juntos:** o militar que está na busca e na seleção sai uma vez só; a ordem é a da busca (nome de guerra, matrícula) (Task 2).
5. **Nascimento e matrícula no Excel:** "15/03" não vira data, e "990012-3" não vira número (Task 2).

---

### Task 1: a busca sem corte e "Selecionar todos" (o defeito)

**Files:** Modify `apps/api/src/visao/busca.ts`, `apps/api/src/visao/rotas.ts`, `pacotes/contratos/src/consulta.ts`, `apps/web/src/routes/_app/peculio_.pesquisar.tsx` (`SelecionarEstes`), `apps/web/src/api/` (a função da busca); Test `apps/api/test/` (o teste da busca da 6.51), `apps/web/src/__testes__/` (o teste da pesquisa)

**Interfaces (Produces):**
- `buscarComFiltros(c, usuarioId, f, hoje, opcoes?: { semCorte?: boolean })`: com `semCorte`, o teto é `LIMITE_DA_BUSCA_SEM_CORTE = 5000` (em `contratos`) e passar dele devolve `{ ok: false, status: 400, erro: 'Mais de 5000 militares. Afine a busca.' }`.
- `POST /api/consulta/militares/buscar/todos` (corpo `FiltrosDaBusca`) → `ResultadoDaBusca` com `haMais: false`; 403 para quem não tem nível de acesso.

- [ ] **Step 1: testes:** com 520 militares no filtro, `buscar` devolve 500 e `haMais`, e `buscar/todos` devolve os 520; acima de 5000, a mensagem fixa; o militar comum leva 403; na tela, com `haMais`, o botão vira "Selecionar todos", busca a lista inteira e põe na seleção os que a pessoa pode alterar (`podeAlterar`), e some a frase "Só os N mostrados…"; sem `haMais`, "Selecionar estes {n}" como hoje.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.54: selecionar o filtro inteiro, não só o que a tela mostra`.

### Task 2: a exportação na API

**Files:** Create `apps/api/src/visao/exportar.ts`; Modify `apps/api/src/visao/rotas.ts`, `apps/api/src/importacao/modelo.ts` (exportar `cabecalho`), `apps/api/src/importacao/peculio.ts` (exportar `COLUNAS`, `ABA` e a lista de unidades com `rotulo`, sem mudar o que a importação lê), `pacotes/contratos/src/consulta.ts`; Test `apps/api/test/exportar-militares.test.ts`

**Interfaces (Produces):**
- Em `contratos`: `COLUNAS_DA_EXPORTACAO`, a lista dos rótulos na ordem da importação, cada um com o seu bloco (`'identificacao' | 'contato' | 'situacao' | 'dados_da_escala' | 'comportamento' | 'ficha_completa'`); `PedidoDeExportacao = z.object({ filtros: FiltrosDaBusca.optional(), ids: z.array(z.string().uuid()).max(5000).optional(), colunas: z.array(rótulo).min(1) })`, com pelo menos um de `filtros` e `ids` ("Escolha o que exportar."). MATRÍCULA entra sempre, mesmo se não vier em `colunas`.
- `exportarMilitares(c, usuarioId, pedido, hoje): Promise<{ ok: true; arquivo: ArrayBuffer } | { ok: false; status: 400 | 403; erro: string }>`.
- `POST /api/consulta/militares/exportar` → o .xlsx (`Content-Type` do Excel, `Content-Disposition` com `militares-{hoje}.xlsx`).

- [ ] **Step 1: testes:**
  - os rótulos de `COLUNAS_DA_EXPORTACAO` são iguais, na mesma ordem, a `Object.values(COLUNAS).map((c) => c.rotulo)` do importador (assim a lista não se separa da importação);
  - `filtros` sai a busca inteira (Review Focus 3); `ids` sai a seleção; os dois saem a união sem repetir, na ordem da busca (Review Focus 4);
  - só as colunas pedidas, mais MATRÍCULA, na ordem da importação, na aba `PECÚLIO`;
  - uma pessoa sem o bloco `contato` sobre um militar recebe TELEFONE vazio dele; sem cadastro na lotação dele, CPF e NASCIMENTO vazios (Review Focus 2);
  - os formatos da volta das Global Constraints, e NASCIMENTO e MATRÍCULA como texto (Review Focus 5);
  - **volta completa:** o arquivo exportado com todas as colunas, enviado à prévia da importação do Pecúlio, não muda nada em nenhuma linha (Review Focus 1); o exportado por quem não vê o contato, reimportado por um administrador, também não apaga o telefone;
  - o militar comum leva 403.
- [ ] **Step 2:** FAIL. **Step 3:** implementar sobre `buscarComFiltros(…, { semCorte: true })` para os filtros; os blocos por unidade lidos uma vez por lotação (não por militar). **Step 4:** PASS. **Step 5:** commit `Fase 6.54: exportar militares com as colunas da importação`.

### Task 3: o botão e a janela

**Files:** Create `apps/web/src/componentes/peculio/ExportarMilitares.tsx`; Modify `apps/web/src/routes/_app/peculio_.pesquisar.tsx`, `apps/web/src/api/cliente.ts` (baixar um arquivo de um POST: `baixarArquivo(caminho: string, corpo: unknown, nome: string): Promise<void>`, que lê o `blob` e dispara o download com o nome); Test `apps/web/src/__testes__/exportar-militares.test.tsx`

**Interfaces (Consumes):** `POST …/buscar/todos` (Task 1) para as contagens; `POST …/exportar` e `COLUNAS_DA_EXPORTACAO` (Task 2); `useSelecao()` de `Selecao.tsx`.

- [ ] **Step 1: testes:** o botão "Exportar" aparece para quem tem nível de acesso quando há resultado de busca ou seleção, e não aparece para o militar comum; sem seleção, a janela não pergunta o que sai e exporta a busca; com seleção, as três opções com as contagens (a da busca e a da união vêm da lista inteira da Task 1) e "Selecionados" já marcada; sem busca feita, sai só a seleção, sem a pergunta; MATRÍCULA marcada e travada com a nota; "Marcar todos"; "Baixar planilha" chama a exportação com o que foi escolhido e fecha a janela; erro da API aparece na janela, que continua aberta; celular (390 px) sem rolagem de lado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador em 1440 e 390 px e abrir o arquivo baixado. **Step 5:** commit `Fase 6.54: o botão Exportar e a janela dos campos` e enviar a branch à PLANEJAMENTO.
