# Atualização em lote (6.52): mudar vários militares de uma vez, com prévia — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** quem cuida do Pecúlio aplica a mesma mudança (lotação, equipe, jornada, quadro, situação, voluntário JES, função, abono, comportamento) a todos os militares selecionados na pesquisa, depois de ver uma prévia de quem muda e de quem fica de fora.

**Architecture:** a regra de "Alterar situação", hoje escrita dentro da rota `POST /militares/:id/situacao`, sai para uma função única, que a ficha e o lote chamam: o lote não pode dar mais poder que a ficha. Duas rotas, `previa` e `aplicar`; a segunda refaz a conferência e grava tudo numa transação só. A tela é um painel de quatro passos sobre a seleção da 6.51.

**Tech Stack:** Hono, Postgres, zod, React, TanStack Query, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-peculio-geral-e-atualizacao-em-lote-design.md` ("A atualização em lote", com as decisões de 24/11).

## Global Constraints

- Branch `fase6-52-atualizacao-em-lote`, a partir da `main` com a 6.51. Sem migração.
- **Tudo ou nada:** uma transação; qualquer erro desfaz tudo. Teto de 500 militares.
- **Permissão:** sem nível de acesso na unidade de destino, o lote inteiro é recusado (403); sem permissão sobre um militar, ele fica de fora na prévia, com o motivo.
- **Lotação marcada sem equipe marcada: todos chegam sem equipe** (decisão do usuário, 24/11/2026); a prévia diz "{n} chegam sem equipe".
- **Reconferir ao aplicar:** se quem pode mudar não é mais o mesmo conjunto da prévia, 409 "A lista mudou desde a prévia. Refaça a prévia.".
- Cada militar muda pelo mesmo caminho da ficha, com a mesma auditoria (quem fez). Não há "Desfazer" do lote.
- Fora do lote: dados pessoais, contato, acesso ao sistema, afastamentos.
- Motivos de ficar de fora (textos fixos): "Você não tem nível de acesso sobre este militar."; "Sem lotação em aberto."; "A equipe {nome} não existe em {unidade}."; "A data é anterior à lotação atual dele ({dd/mm/aaaa})."; "O quadro {sigla} não serve ao posto dele."; "Nada muda para este militar.".
- Skill `frontend-design:frontend-design` na tela. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440 e 390 px. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Mesmo resultado que a ficha:** para um militar só, o lote e o "Alterar situação" deixam o rastreio idêntico, inclusive no mesmo dia do período aberto (substitui) e em dia posterior (fecha e abre) (Task 1 e 2).
2. **Erro no meio:** o 37º militar falha no banco e nenhum dos 36 anteriores fica alterado (Task 2).
3. **Equipe por nome quando a lotação não muda:** "ALFA" vale para cada um na sua unidade; quem está numa unidade sem "ALFA" fica de fora com o motivo (Task 2).
4. **Clique duplo em "Aplicar"** ou duas pessoas aplicando ao mesmo tempo: a segunda recebe o 409 da lista que mudou, sem gravar duas vezes (Task 2 e 3).
5. **Seleção com gente que a pessoa não pode alterar:** o botão "Atualizar em lote" fica ativo se ao menos um pode, e a prévia lista os outros de fora (Task 3).

---

### Task 1: a regra de "Alterar situação" numa função só

**Files:** Create `apps/api/src/cadastros/alterar-situacao.ts`; Modify `apps/api/src/cadastros/militares.ts` (a rota `POST /militares/:id/situacao` passa a chamar a função; nenhuma resposta muda); Test os testes que já cobrem a rota (`acabamento-rastreio.test.ts`, `cadastro-no-tempo.test.ts` e os da ficha) continuam verdes, sem alteração

**Interfaces (Produces):**
```ts
export type MotivoDeRecusa = { codigo: 'sem_permissao' | 'sem_periodo' | 'equipe' | 'data' | 'quadro' | 'situacao' | 'nada_muda'; texto: string; campo?: string; status: 400 | 403 | 409 };
/** Confere se `usuarioId` pode fazer a alteração neste militar, sem gravar. null = pode. */
export async function conferirAlteracaoDeSituacao(c: Consulta, usuarioId: string, militarId: string, d: AlteracaoDeSituacao, hoje: string): Promise<MotivoDeRecusa | null>;
/** Grava, dentro da transação dada, com o período aberto travado. Lança `RecusaDaAlteracao` (com o `MotivoDeRecusa`) se algo mudou desde a conferência. */
export async function aplicarAlteracaoDeSituacao(tx: Consulta, usuarioId: string, militarId: string, d: AlteracaoDeSituacao): Promise<{ criado: boolean }>;
```

- [ ] **Step 1:** rodar os testes atuais da rota (verdes) e acrescentar testes diretos das duas funções para cada `codigo`.
- [ ] **Step 2:** FAIL nos novos. **Step 3:** extrair, sem mudar comportamento. **Step 4:** PASS em todos. **Step 5:** commit `Fase 6.52: a regra de alterar situação numa função só`.

### Task 2: a prévia e o aplicar

**Files:** Create `apps/api/src/cadastros/lote.ts`, `pacotes/contratos/src/lote.ts`, `apps/api/test/lote.test.ts`; Modify `apps/api/src/cadastros/militares.ts` (ou um arquivo de rotas próprio montado em `app.ts`), `pacotes/contratos/src/index.ts`

**Interfaces (Produces):**
```ts
export const LoteDeMilitares = z.object({
  militarIds: z.array(z.string().uuid()).min(1).max(500),
  desde: Data.optional(), // obrigatório quando algum campo do rastreio é marcado
  campos: z.object({
    unidadeId: z.string().uuid().optional(), equipe: z.string().trim().max(40).nullable().optional(), // pelo nome; null = sem equipe
    jornada: z.enum(['pronto', 'adm']).optional(), quadroId: z.string().uuid().nullable().optional(), situacaoId: z.string().uuid().optional(),
    voluntarioJes: z.boolean().optional(), funcaoMilitarId: z.string().uuid().nullable().optional(), abonoPermanencia: z.boolean().optional(), comportamento: Comportamento.optional(),
  }).refine((c) => Object.keys(c).length > 0, 'Escolha pelo menos um campo.'),
});
export type PreviaDoLote = { mudam: { id: string; posto: string; nomeGuerra: string; matricula: string; de: string; para: string }[]; ficamDeFora: { id: string; posto: string; nomeGuerra: string; matricula: string; motivo: string }[]; chegamSemEquipe: number; assinatura: string };
export const AplicarLote = LoteDeMilitares.extend({ assinatura: z.string() });
export type ResultadoDoLote = { mudaram: number; ficaramDeFora: PreviaDoLote['ficamDeFora'] };
```
`POST /api/peculio/lote/previa` → `PreviaDoLote`; `POST /api/peculio/lote/aplicar` → `ResultadoDoLote`. A `assinatura` é um resumo (hash) dos ids que mudam e dos valores; `aplicar` refaz a prévia e compara. Os campos simples do Pecúlio seguem a mesma regra de permissão do `PATCH /militares/:id` (`exigirDonoDoPeculioDoMilitar`).

- [ ] **Step 1: testes:** cada motivo de ficar de fora; lotação sem equipe (`chegamSemEquipe`); só campos simples, sem `desde`; destino sem permissão: 403 no lote todo; 501 ids: 400; Review Focus 1, 2, 3 e 4; a auditoria traz quem aplicou em cada militar.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.52: a prévia e a aplicação do lote`.

### Task 3: o painel "Atualizar em lote"

**Files:** Create `apps/web/src/componentes/peculio/AtualizarEmLote.tsx`, `apps/web/src/api/lote.ts`; Modify `apps/web/src/componentes/peculio/Selecao.tsx` (o botão "Atualizar em lote" no painel dos selecionados), `peculio_.pesquisar.tsx`; Test `apps/web/src/__testes__/lote*.test.tsx`

- [ ] **Step 1: testes:** os quatro passos: **Campos** (marcar o que muda), **Valores** (um valor por campo; a lotação pela árvore; "A partir de" quando há campo do rastreio), **Prévia** ("{n} militares vão mudar", "{n} chegam sem equipe" e a lista de quem fica de fora com o motivo) e **Resultado** ("{n} militares alterados"); o botão final é "Aplicar a {n} militares" e fica travado enquanto grava; o 409 da lista que mudou volta ao passo da prévia com o aviso; Review Focus 4 e 5; depois de aplicar, a seleção é limpa e a busca recarrega.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.52: atualizar militares em lote pela pesquisa` e enviar a branch à PLANEJAMENTO.
