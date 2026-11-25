# Pecúlio Geral (6.51): a pesquisa com filtros, a árvore, o arquivo e a seleção — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** "Pesquisar militares" acha qualquer militar da corporação por vários filtros, pela árvore de unidades ou por um arquivo de matrículas, e deixa marcar militares numa seleção que se acumula entre buscas.

**Architecture:** a rota da Consulta (`GET /consulta/militares`) vira `POST /api/consulta/militares/buscar`, com os filtros no corpo (várias unidades e centenas de matrículas não cabem no endereço); a rota antiga continua para a busca por texto. A seleção vive só na tela (um provedor React), e é a entrada da 6.52.

**Tech Stack:** Hono, Postgres (ltree), zod, React, TanStack Query, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-peculio-geral-e-atualizacao-em-lote-design.md` ("A busca, uma só"; "A seleção"). **Os filtros foram confirmados pelo usuário em 25/11/2026.**

## Global Constraints

- Branch `fase6-51-peculio-geral-pesquisa-e-selecao`, a partir da `main` com a 6.50. Sem migração.
- Skill `frontend-design:frontend-design`; componentes e tokens da 6.20; `EscolherUnidade` e `lib/arvore-de-unidades.ts` (6.45) para a árvore.
- **Filtros** (somam-se): texto (nome, nome de guerra ou matrícula); lotação (uma ou mais unidades, cada uma com "e as de baixo"); posto/graduação; quadro; jornada; equipe; situação do militar; voluntário JES; no quadro de motoristas e categoria de CNH; função; afastado hoje; cadastro incompleto.
- **Borda de visão:** a Consulta é de toda conta. Os filtros além de texto e lotação, as colunas de contato e "cadastro incompleto" só existem para quem tem nível de acesso em alguma unidade; para o militar comum a API os ignora (não devolve erro, e nunca filtra por um campo que ele não vê).
- **Teto:** no máximo 500 linhas; passando disso, `haMais: true` e a tela diz "Mais de 500 militares. Afine a busca.". O limite de 30 buscas por minuto vale para a rota nova.
- **Arquivo:** `.txt` ou `.csv`, uma matrícula por linha na primeira coluna, cabeçalho opcional, até 2.000 linhas; lido no navegador (nada de planilha binária nesta entrega; a spec admitia planilha, e fica para depois se fizer falta). Nenhum arquivo de dados reais no repositório nem nos testes: matrículas fictícias `990xxx-x`.
- Textos fixos: "Buscar"; "Limpar filtros"; "Mais filtros"; "Pela árvore"; "Por arquivo de matrículas"; "Selecionar estes {n}"; "Selecionados ({n})"; "Tirar"; "Limpar"; "{n} matrículas não encontradas".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Seleção que acumula:** marcar três, mudar os filtros, marcar mais dois: "Selecionados (5)", e quem saiu do resultado continua selecionado (Task 3).
2. **"Selecionar estes {n}" com `haMais`:** seleciona só as 500 linhas na tela, e a tela diz isso; nunca "todos" (Task 3).
3. **Matrícula com e sem pontuação no arquivo** ("990012-3" e "9900123"), linhas vazias e repetidas: acha uma vez só (Task 2).
4. **Militar comum mandando filtro restrito pela API:** o filtro é ignorado, sem vazar quem tem cadastro incompleto ou quem é voluntário (Task 1).
5. **Unidade marcada "e as de baixo" junto com uma filha marcada sozinha:** o militar aparece uma vez (Task 1).

---

### Task 1: a busca com filtros na API

**Files:** Modify `apps/api/src/visao/consulta.ts`, `apps/api/src/visao/rotas.ts`, `pacotes/contratos/src/consulta.ts`; Test `apps/api/test/consulta.test.ts`, `consulta-limite.test.ts`

**Interfaces (Produces):**
```ts
export const FiltrosDaBusca = z.object({
  texto: z.string().trim().max(80).optional(),
  unidades: z.array(z.object({ id: z.string().uuid(), comAsDeBaixo: z.boolean() })).max(200).optional(),
  matriculas: z.array(z.string().trim().min(1).max(20)).max(2000).optional(),
  postoGradIds: z.array(z.string().uuid()).optional(), quadroIds: z.array(z.string().uuid()).optional(),
  jornada: z.enum(['pronto', 'adm']).optional(), equipe: z.string().trim().max(40).optional(),
  situacaoIds: z.array(z.string().uuid()).optional(), voluntarioJes: z.boolean().optional(),
  motorista: z.boolean().optional(), cnh: z.array(CategoriaCnh).optional(), funcaoIds: z.array(z.string().uuid()).optional(),
  afastadoHoje: z.boolean().optional(), cadastroIncompleto: z.boolean().optional(),
});
export type ResultadoDaBusca = { militares: LinhaDaBusca[]; haMais: boolean; naoEncontradas: string[] };
export type LinhaDaBusca = LinhaDaConsulta & { equipe: string | null; jornada: 'pronto' | 'adm' | null; situacao: string | null; unidadeId: string | null; podeAlterar: boolean };
export const LIMITE_DA_BUSCA_COM_FILTROS = 500;
```
`POST /api/consulta/militares/buscar` (corpo `FiltrosDaBusca`) → `ResultadoDaBusca`. `podeAlterar` diz se quem pede tem nível de acesso acima da lotação daquele militar (a 6.52 usa). Sem nenhum filtro: 400 "Escolha pelo menos um filtro.".

- [ ] **Step 1: testes:** cada filtro sozinho e dois somados; o teto de 500 e `haMais`; `naoEncontradas` para o arquivo; Review Focus 4 e 5; a rota antiga continua respondendo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.51: a busca de militares com filtros`.

### Task 2: os filtros, a árvore e o arquivo na tela

**Files:** Modify `apps/web/src/routes/_app/peculio_.pesquisar.tsx`, `apps/web/src/api/consulta.ts`; Create `apps/web/src/componentes/peculio/FiltrosDaPesquisa.tsx`, `ArvoreDeMarcar.tsx` (a árvore com uma marca por nó e o controle "e as de baixo"), `ArquivoDeMatriculas.tsx`, `apps/web/src/lib/matriculas-do-arquivo.ts`; Test `apps/web/src/__testes__/pesquisar*.test.tsx`

**Interfaces (Produces):** `lerMatriculas(texto: string): string[]` (primeira coluna, sem cabeçalho, sem vazias, sem repetidas).

- [ ] **Step 1: testes:** texto e lotação à vista, o resto em "Mais filtros"; os filtros restritos não aparecem para o militar comum; a árvore preenche o filtro de lotação com vários nós; o arquivo mostra quantas matrículas leu e as não encontradas; Review Focus 3; "Limpar filtros"; a busca só sai no "Buscar".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.51: pesquisar pela árvore, por filtros e por arquivo`.

### Task 3: a seleção

**Files:** Create `apps/web/src/componentes/peculio/Selecao.tsx` (provedor `SelecaoDeMilitares`, o painel "Selecionados"); Modify `ListaDeMilitares.tsx` (a marca por linha, só na pesquisa e só para quem tem nível de acesso), `peculio_.pesquisar.tsx`; Test `apps/web/src/__testes__/selecao*.test.tsx`

**Interfaces (Produces):** `useSelecao(): { selecionados: LinhaDaBusca[]; tem(id): boolean; alternar(linha): void; incluir(linhas): void; tirar(id): void; limpar(): void }`.

- [ ] **Step 1: testes:** Review Focus 1 e 2; "Tirar" e "Limpar"; a seleção some ao sair da tela; o militar comum não vê marca nem painel; o leitor de tela ouve "Selecionar {patente} {nome}".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.51: a seleção que acumula entre buscas` e enviar a branch à PLANEJAMENTO.
