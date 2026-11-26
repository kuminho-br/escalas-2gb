# Pecúlio: os dois defeitos, a unidade pelo caminho e remover do rastreio (6.62) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Nos dois defeitos, use também superpowers:systematic-debugging antes de corrigir.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:**
- Corrigir o Pecúlio da unidade, que abre com a árvore inteira em vez da unidade escolhida no Topo.
- Corrigir a atualização em lote, que desfaz a seleção.
- Mostrar a unidade dos militares pelo menor caminho que a identifica ("2º GB / 1ª SB").
- Permitir remover uma linha do histórico de rastreio: o gestor remove o que ainda não vale, o administrador remove qualquer linha.

**Architecture:** quatro peças pequenas, independentes, cada uma com o seu teste:
- **Unidade do Pecúlio:** `unidadeDoPeculio` (`apps/web/src/api/peculio.ts`) passa a partir da unidade de trabalho.
- **Seleção:** a seleção (`apps/web/src/componentes/peculio/Selecao.tsx`) sobrevive ao fim do lote.
- **Placa da unidade:** reaproveita o `menorCaminhoUnico` da 6.57 (`apps/api/src/importacao/caminho-da-unidade.ts`), calculado na API.
- **Remover do rastreio:** uma rota nova de remoção, com a regra de acesso e o motivo na auditoria.

**Tech Stack:** Hono, Postgres/PGlite (ltree), zod (`contratos`), React, TanStack Query, Vitest.

**Spec:** o pool de feedbacks da validação de 26/11/2026 (`docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`, itens 43, 44, 45 e 46) e as decisões do usuário de 26/11/2026 em `docs/decisoes.md` (quem remove do rastreio).

## Global Constraints

- Branch `fase6-62-peculio-defeitos-e-rastreio`, a partir da `main`. Sem migração, se a auditoria já registrar a remoção (ela grava `delete` com o usuário); se faltar coluna para o motivo, **parar e relatar** antes de criar migração.
- **Pecúlio da unidade:** abre na **unidade de trabalho** escolhida no Topo (a 1ª SB, se é ela que está no Topo), com "Incluir as unidades de baixo" como a pessoa deixou. Nunca sobe sozinho para uma unidade acima só porque a pessoa tem nível de acesso nela. Hoje `unidadeDoPeculio` escolhe, entre os papéis no caminho da unidade de trabalho, o **mais alto** (o primeiro do caminho): para o administrador da raiz, o CBMPE inteiro ("100 de 2652"). O caso do militar comum e do só consulta continua como hoje.
- **Seleção depois do lote:** aplicar a atualização em lote não esvazia a seleção. A lista de selecionados continua com os mesmos militares, e os dados de cada um atualizados (a 6.52 guardava a seleção acima das rotas; achar onde ela se perde: remontagem do provedor, troca de chave ou limpeza explícita).
- **A placa da unidade** na lista da busca e no painel "Selecionados" (Pesquisar militares) mostra o menor caminho que identifica a unidade na corporação inteira (`menorCaminhoUnico`, separador " / "), como na exportação da 6.57: "2º GB / 1ª SB"; "CBMPE" continua "CBMPE". O campo vem pronto da API (`lotacaoCaminho`, ao lado da `lotacao` de hoje); o site não recalcula.
- **Remover do rastreio** (decisão do usuário de 26/11/2026):
  - quem tem nível de gestão na unidade do registro (`GESTAO`, na unidade ou acima) remove só a linha que **ainda não vale** (início depois de hoje, Recife);
  - o administrador (`ehAdministrador`) remove **qualquer** linha;
  - sempre com o motivo (1 a 200 caracteres), que fica na auditoria com quem removeu;
  - a linha que não pode ser removida não mostra o botão, e a API responde 403 com a frase "Só o administrador remove uma mudança que já vale." (para o gestor numa linha que já vale) ou "Você não tem nível de acesso para remover esta mudança." (sem nível);
  - remover a única linha que cobre hoje não pode deixar o militar sem situação: 400 "Esta é a situação de hoje: altere em vez de remover.";
  - textos da tela: botão "Remover" na linha; janela "Remover esta mudança?" com o campo "Motivo" e os botões "Remover" e "Cancelar".
- Nenhum dado pessoal real em repositório, teste ou CI (matrículas `990xxx-x`). Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Administrador da raiz com a 1ª SB no Topo:** o Pecúlio da unidade abre só com a 1ª SB (e as de baixo, se ligado); trocar o Topo para o 2º GB muda a lista (Task 1).
2. **Gestor lotado na unidade, com papel também acima:** continua abrindo na unidade do Topo, não na de cima (Task 1).
3. **Lote que muda a lotação de um selecionado:** depois de aplicar, ele continua na seleção, com a lotação nova (Task 2).
4. **Duas unidades com a mesma sigla em GBs diferentes** na mesma busca: as placas se distinguem ("2º GB / 1ª SB" e "3º GB / 1ª SB") (Task 3).
5. **Gestor tenta remover pela API uma linha que já vale:** 403 com a frase fixa, e nada muda (Task 4).

---

### Task 1: o Pecúlio da unidade na unidade do Topo

**Files:** Modify `apps/web/src/api/peculio.ts` (`unidadeDoPeculio`); Test `apps/web/src/__testes__/` (o teste do Pecúlio da unidade; criar `unidade-do-peculio.test.ts` se não houver)

- [ ] **Step 1: testes:** `unidadeDoPeculio` com: administrador da raiz e unidade de trabalho 1ª SB → 1ª SB (Review Focus 1); gestor com papel na 1ª SB e no 2º GB, Topo na 1ª SB → 1ª SB (Review Focus 2); Topo no 2º GB → 2º GB; militar comum → a unidade dele (como hoje); só consulta (como hoje). Na tela, a lista do Pecúlio da unidade com o administrador mostra só os militares da 1ª SB.
- [ ] **Step 2:** FAIL. **Step 3:** corrigir (a unidade de trabalho, quando a pessoa tem papel nela ou acima; o resto como hoje). **Step 4:** PASS. **Step 5:** commit `Fase 6.62: o Pecúlio da unidade abre na unidade do Topo`.

### Task 2: a seleção sobrevive ao lote

**Files:** Modify `apps/web/src/componentes/peculio/AtualizarEmLote.tsx`, `apps/web/src/componentes/peculio/Selecao.tsx` (e onde o provedor é montado); Test o teste da atualização em lote da 6.52

- [ ] **Step 1: diagnóstico** (systematic-debugging): reproduzir no teste: selecionar 3, aplicar o lote, a seleção some. Achar a causa antes de mexer, e escrever no commit qual era.
- [ ] **Step 2: teste:** depois de aplicar, os 3 continuam selecionados, com os dados novos (Review Focus 3); cancelar a janela também não mexe na seleção; "Limpar seleção" continua limpando.
- [ ] **Step 3:** FAIL. **Step 4:** corrigir. **Step 5:** PASS e commit `Fase 6.62: aplicar o lote não desfaz a seleção`.

### Task 3: a unidade pelo menor caminho na busca e na seleção

**Files:** Modify `apps/api/src/visao/busca.ts` (o campo novo), `pacotes/contratos/src/consulta.ts` (`LinhaDaBusca` ganha `lotacaoCaminho: string | null`), a lista e o painel de Pesquisar militares (`ListaDeMilitares.tsx`, `Selecao.tsx`); Test `apps/api/test/` (o da busca da 6.51) e o teste da pesquisa no site

- [ ] **Step 1: testes:** API: `lotacaoCaminho` igual ao `menorCaminhoUnico` da unidade, calculado uma vez por busca para as unidades da resposta (não por militar); duas "1ª SB" em GBs diferentes saem distintas (Review Focus 4). Site: a placa mostra `lotacaoCaminho`, e cai em `lotacao` quando vier `null`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (aproveitar a correção do desempenho do pool, item 34 (d), se ficar simples: normalizar as siglas uma vez e agrupar pela última). **Step 4:** PASS. **Step 5:** commit `Fase 6.62: a unidade pelo menor caminho na pesquisa`.

### Task 4: remover uma linha do histórico de rastreio

**Files:** Create a rota de remoção junto das rotas que gravam o rastreio (ler `apps/api/src/cadastros/alterar-situacao.ts` e `apps/api/src/cadastros/militares.ts` para achar a tabela e o padrão); Modify `apps/web/src/componentes/militares/Rastreio.tsx`, `pacotes/contratos/src/militares.ts` (o corpo `{ motivo }`); Test `apps/api/test/rastreio-remover.test.ts` e o teste do rastreio no site

**Interfaces (Produces):** `DELETE /api/militares/:id/rastreio/:registroId` com corpo `{ motivo: string }` → 204; as regras e as frases das Global Constraints; a resposta da ficha passa a dizer, por linha, `podeRemover: boolean`.

- [ ] **Step 1: testes:** gestor remove a linha que ainda não vale; gestor numa linha que já vale: 403 com a frase (Review Focus 5); administrador remove uma linha passada; sem nível: 403; a única linha que cobre hoje: 400; sem motivo ou com 201 caracteres: 400; a auditoria guarda quem removeu e o motivo; `podeRemover` certo por linha e por conta; na tela, o botão só onde pode, a janela com o motivo, e a linha some depois de remover.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador em 1440 e 390 px: o Pecúlio da unidade como administrador, o lote mantendo a seleção, as placas com o caminho e remover uma mudança marcada para dezembro. **Step 5:** commit `Fase 6.62: remover uma mudança do histórico de rastreio` e enviar a branch à PLANEJAMENTO.
