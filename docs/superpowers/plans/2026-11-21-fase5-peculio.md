# Fase 5 — Pecúlio: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-11-20-peculio-design.md`.

**Entregas da fase** (o número é a ordem de execução; cada uma ganha as tarefas quando for começar):
1. **Rastreio e CNH:** a lotação passa a ser só a unidade; a tabela de lotação vira o rastreio do militar; o "Histórico de rastreio" com "Alterar situação" e a linha do tempo; a CNH separada do quadro de motoristas; as sete seções do 2º GB. **Detalhada abaixo.**
2. **Ficha ampliada e dono por bloco:** nome completo, sexo, nascimento, telefone, e-mail institucional, comportamento; motivo e boletim no afastamento e os tipos novos; quem edita o quê.
3. **Importação do Pecúlio e o módulo:** o modelo `PECÚLIO`, a lista e a ficha do módulo, os aniversariantes do mês.

**Fluxo:** Sonnet executa; Opus faz a revisão final do branch. Ao terminar cada entrega, a DESENVOLVIMENTO envia o branch e o resumo à PLANEJAMENTO (não abre PR nem mescla); a PLANEJAMENTO abre o PR, mescla e avisa a VALIDAÇÃO.

---

# Entrega 1 — Rastreio e CNH

**Goal:** a lotação com o sentido da corporação (só a unidade), equipe e jornada no rastreio do militar com histórico e linha do tempo, e a CNH valendo para a escala só no quadro de motoristas.

**Architecture:** uma migração renomeia `lotacao` para `rastreio` (mesmas colunas e regras) e tira a regra que apagava a CNH de quem não é motorista; a API e o site passam a usar "rastreio" no código e "lotação" só para a unidade. Uma função do motor centraliza a CNH que vale para a escala. A ficha troca o bloco de lotação pelo "Histórico de rastreio".

**Tech Stack:** Postgres (migração SQL), Hono (API), zod (contratos), `pacotes/dominio`, React + TanStack (site), Vitest.

**Branch:** `fase5-1-rastreio-e-cnh`, a partir da `main` atualizada. Commits `Fase 5.1: …`; PR "Fase 5 — Entrega 1: rastreio e CNH". **Migração 0023:** o PR avisa `pnpm --filter api db:migrar:teste`.

## Global Constraints

- "Lotação" nas telas e mensagens é só a unidade. O conjunto lotação + equipe + jornada no tempo é o **rastreio**; o bloco da ficha se chama "Histórico de rastreio" e o botão "Alterar situação".
- "A partir de" é o mês (dia 1), como hoje.
- A CNH é do militar; para a escala só vale com o militar no quadro de motoristas.
- Dados de teste que ficarem sem lugar ficam na 1ª SB. Nada de regra para acomodar dado ruim.
- No fim: atualizar `docs/superpowers/specs/2026-11-16-esquema-banco.md` (tabela `rastreio`, a regra da CNH, a migração 0023); contagens no `CLAUDE.md` local; `pnpm test && pnpm typecheck && pnpm build:vercel`.

**Decisões desta entrega** (do usuário, no design; as minhas marcadas):
- Tabela renomeada, não recriada: `alter table lotacao rename to rastreio`; colunas, índices, regra de não sobrepor e o gatilho de auditoria continuam (*minha decisão*: o menor risco para os períodos de hoje).
- A rota de transferência passa a "Alterar situação": `POST /api/militares/:id/situacao` com `{ unidadeId, equipeId, jornada, desde }`; a rota antiga sai. A ficha devolve `rastreio` no lugar de `lotacoes` (*minha decisão*).
- **Quem pode alterar a lotação nesta entrega** continua como hoje; a regra "o papel da unidade de cima edita a lotação" é da entrega 2.
- As sete seções: a migração cria 2ª a 7ª SB abaixo do 2º GB quando não existem (pela sigla); a 1ª SB já existe.
- Ao sair do quadro de motoristas, a CNH **fica** gravada; o aviso "CNH sem motorista" deixa de existir.

## Review Focus

1. **Escala de um mês passado depois da migração:** a Grade geral e a Escala do mês de um mês anterior mostram as mesmas equipes e jornadas de antes. Tarefa 1.
2. **Militar fora do quadro, com CNH D:** não aparece para a vaga de motorista (lista, escalar, acumular, trocar e painel do dia). Tarefa 2.
3. **"Alterar situação" para o mesmo mês do período aberto:** substitui o período em vez de criar um de zero dia; para um mês anterior ao período aberto, é 400 com a mensagem. Tarefa 3.
4. **Linha do tempo com afastamento que atravessa uma mudança de equipe:** aparecem os dois itens, em ordem, sem repetir. Tarefa 4.
5. **Migração rodada duas vezes** (ambiente de teste já migrado à mão): a criação das seções não duplica nada. Tarefa 1.

---

### Task 1: Migração 0023 e o rastreio na API

**Files:**
- Create: `apps/api/banco/migracoes/0023_rastreio_e_cnh.sql`
- Modify: todas as consultas com `lotacao` em `apps/api/src` (`acesso.ts`, `cadastros/militares.ts`, `carga/exemplo.ts`, `escala/elegibilidade.ts`, `escala/pre-escala.ts`, `grade/dia.ts`, `grade/grade.ts`, `importacao/militares.ts`, `voluntariado/leitura.ts`)
- Test: os testes da API que inserem em `lotacao` (`apps/api/test/*`), mais `apps/api/test/esquema-estrutura.test.ts`

**Interfaces:**
- Produces: tabela `rastreio` (colunas de `lotacao`: `id, militar_id, unidade_id, equipe_id, jornada, desde, ate`).

- [ ] **Step 1: Teste** em `esquema-estrutura.test.ts`: `it('a lotação virou rastreio, com as mesmas regras')` — a tabela `rastreio` existe e `lotacao` não; período sobreposto do mesmo militar continua barrado; equipe de outra unidade continua barrada; um militar com `motorista = false` e `cnh = '{D}'` grava sem erro; `it('as sete seções existem abaixo do 2º GB e a migração não duplica')` (Review Focus 5).
- [ ] **Step 2: Run** `pnpm --filter api test esquema-estrutura`. Expected: FAIL.
- [ ] **Step 3: Implement** a migração: `alter table lotacao rename to rastreio` (e os nomes dos índices e da restrição de não sobrepor, para ficarem com "rastreio"); tirar a restrição `check (motorista or cardinality(cnh) = 0)` procurando o nome em `pg_constraint`; inserir 2ª a 7ª SB (tipo `secao`, mãe o 2º GB, `desde` = mês de criação do 2º GB) com `where not exists` pela sigla. Trocar `lotacao` por `rastreio` em todas as consultas.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS, incluindo os testes da Grade e da Escala do mês com meses passados (Review Focus 1).
- [ ] **Step 5: Commit** `Fase 5.1: migração 0023, lotação vira rastreio e CNH sem a regra do quadro`.

### Task 2: A CNH que vale para a escala

**Files:**
- Modify: `pacotes/dominio/src/cnh.ts`; `apps/api/src/escala/elegibilidade.ts:121`, `apps/api/src/escala/alocacoes.ts:53,146`, `apps/api/src/grade/dia.ts:158` (e as consultas delas passam a trazer `motorista`)
- Test: `pacotes/dominio/test/cnh.test.ts`, `apps/api/test/escala-candidatos.test.ts`, `apps/api/test/escala-acumulo.test.ts`, `apps/api/test/trocar.test.ts`, `apps/api/test/grade-dia.test.ts`

**Interfaces:**
- Produces: `cnhParaEscala(m: { motorista: boolean; cnh: unknown[] | null | undefined }): string[]` em `pacotes/dominio/src/cnh.ts` (`cnhHabilitadas(m.cnh)` se `m.motorista`, senão `[]`).

- [ ] **Step 1: Testes** (Review Focus 2): no motor, `cnhParaEscala({ motorista: false, cnh: ['D'] })` é `[]` e `({ motorista: true, cnh: ['E'] })` é `['E','D','C','B']`; na API, um militar fora do quadro com CNH D não aparece entre os aptos da vaga de motorista (motivo "Sem a CNH exigida"), escalar e acumular nessa vaga são 409 com o motivo, a troca que o levaria para ela é 409, e o painel do dia não oferece a vaga.
- [ ] **Step 2: Run** os testes citados. Expected: FAIL.
- [ ] **Step 3: Implement:** os quatro pontos usam `cnhParaEscala`.
- [ ] **Step 4: Run** `pnpm --filter dominio test` e `pnpm --filter api test`. Expected: PASS. `pnpm casos:prototipo` continua passando (os casos não mudam).
- [ ] **Step 5: Commit** `Fase 5.1: a CNH vale para a escala só no quadro de motoristas`.

### Task 3: "Alterar situação" na API e nos contratos

**Files:**
- Modify: `pacotes/contratos/src/militares.ts` (a ficha devolve `rastreio`; contrato `AlteracaoDeSituacao`), `apps/api/src/cadastros/militares.ts:300-315` (a rota de transferência vira `POST /api/militares/:id/situacao`; o PATCH deixa de recusar CNH sem motorista; `MENSAGEM_CNH_SEM_MOTORISTA` sai)
- Test: `apps/api/test/militares.test.ts`

**Interfaces:**
- Produces: `AlteracaoDeSituacao = { unidadeId: Id; equipeId: Id | null; jornada: Jornada; desde: Mes }`; `FichaMilitar.rastreio: { id: string; unidadeSigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }[]` (do mais novo para o mais velho).

- [ ] **Step 1: Testes:** alterar só a equipe a partir do mês seguinte fecha o período aberto no fim do mês e abre outro com a mesma lotação; alterar no mesmo mês do período aberto substitui o período (Review Focus 3); mês anterior ao período aberto é 400 "Use o mês do período aberto ou um mês depois."; equipe de outra unidade é 400 no campo `equipeId`; o PATCH com `motorista: false` mantém a CNH gravada.
- [ ] **Step 2: Run** `pnpm --filter api test militares`. Expected: FAIL.
- [ ] **Step 3: Implement.** Quem pode alterar continua como a rota de transferência de hoje.
- [ ] **Step 4: Run** `pnpm --filter api test` e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.1: alterar situação na API`.

### Task 4: "Histórico de rastreio" na ficha

**Files:**
- Create: `apps/web/src/componentes/militares/Rastreio.tsx`, `apps/web/src/lib/linha-do-tempo-militar.ts`
- Delete: `apps/web/src/componentes/militares/Lotacoes.tsx`
- Modify: `apps/web/src/routes/_app/militares/$id.tsx`, `apps/web/src/api/militares.ts` (`alterarSituacao`)
- Test: `apps/web/src/__testes__/militares.test.tsx`

**Interfaces:**
- Produces: `linhaDoTempoDoMilitar(rastreio: FichaMilitar['rastreio'], afastamentos: FichaMilitar['afastamentos']): ItemDaLinhaDoTempo[]`, com `ItemDaLinhaDoTempo = { quando: string; tipo: 'situacao' | 'afastamento'; texto: string }`, do mais novo para o mais velho. O texto da situação diz só o que mudou ("Equipe Bravo → Alfa", "Lotação 2ª SB → 1ª SB · Jornada Adm → Pronto"); o primeiro período diz a situação inteira.

- [ ] **Step 1: Testes:**
  - a função: dois períodos e um afastamento entre eles saem em ordem, sem repetir (Review Focus 4); o primeiro período traz a situação inteira;
  - a tela: o bloco "Histórico de rastreio" mostra "Situação atual: 1ª SB · Equipe Alfa · Pronto (desde 03/2026)" e a linha do tempo; "Alterar situação" abre o formulário com lotação, equipe (da lotação escolhida), jornada e "A partir de" (mês, sugerido o atual); salvar manda `{ unidadeId, equipeId, jornada, desde }` e fecha; o bloco de lotação antigo não existe mais.
- [ ] **Step 2: Run** `pnpm --filter web test militares`. Expected: FAIL.
- [ ] **Step 3: Implement.** O formulário é um diálogo (`componentes/ui/dialog.tsx`), com trava contra clique duplo.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.1: histórico de rastreio na ficha`.

### Task 5: Motorista e CNH na ficha e na importação

**Files:**
- Modify: `apps/web/src/componentes/militares/Motorista.tsx`, `apps/api/src/importacao/militares.ts`
- Test: `apps/web/src/__testes__/militares.test.tsx`, `apps/api/test/importacao-militares.test.ts`

- [ ] **Step 1: Testes:** a ficha mostra as categorias da CNH com ou sem o quadro marcado; desmarcar "Está no quadro de motoristas?" não apaga a carteira e o salvar manda só `motorista: false`; o texto de ajuda diz "A CNH só vale para a escala com o militar no quadro de motoristas."; a importação aceita CNH em militar com MOTORISTA = NÃO, sem problema.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.1: CNH independente do quadro de motoristas`. No fim da entrega:
  - atualizar o esquema do banco (`rastreio`, a regra da CNH, 0023);
  - contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - **enviar o branch e o resumo à PLANEJAMENTO**, com a lista curta para a sandbox e o aviso da migração 0023.
