# As ferramentas em teste e o retorno do Laboratório (6.60) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** dentro do Laboratório, a pessoa vê a lista das ferramentas em teste, com o que testar, e deixa um retorno (texto e nota de 1 a 5); o administrador cadastra as ferramentas e lê os retornos, com o nome de quem os deixou.

**Architecture:** duas tabelas **no banco real** (não no espelho): a ferramenta em teste e o retorno. São as únicas exceções ao isolamento do Laboratório: a lista é lida e o retorno é gravado **pelas rotas do real** (`/api/laboratorio/*`), com a conta real e o perfil de teste usado como dado do retorno. O site em modo Laboratório chama essas rotas pelo cliente, que já sabe tratar o `/api/laboratorio` como rota do real (6.59). Por estarem no real, o "Recomeçar" nunca apaga um retorno.

**Tech Stack:** Hono, Postgres/PGlite, zod (`contratos`), React, TanStack, Vitest.

**Spec:** `docs/ideias/laboratorio.md`; planos 6.58 e 6.59 (o espelho, o isolamento, a sessão no Laboratório e a faixa). Decisões do usuário (25/11/2026): retorno no real, ligado à conta real; administrador cadastra e lê.

## Global Constraints

- Branch `fase6-60-ferramentas-e-retorno`, a partir da `main` com a 6.59 mesclada. Migração `0049` (as duas tabelas), só com autorização do usuário.
- **No real:** `ferramenta_teste` e `retorno_laboratorio`. As migrações valem para os dois schemas (6.58), então as duas tabelas existem também no espelho, **vazias e sem uso**; as rotas só leem e gravam as do real.
- **Quem cadastra, muda a situação e lê a lista de retornos:** o administrador **real**. **Quem lê as ferramentas e deixa retorno:** todo militar com conta, no Laboratório (exige a sessão no Laboratório).
- **Situação da ferramenta:** `em teste`, `encerrada` ou `virou módulo`. Só `em teste` aceita retorno; as outras aparecem na lista, apagadas, para consulta.
- **O retorno guarda:** a ferramenta, a **conta real** de quem o deixou, o perfil de teste em uso (nome), a tela (a rota em que a pessoa estava, sem os parâmetros), o texto (1 a 2000 caracteres), a nota (inteiro de 1 a 5) e quando. O retorno é imutável depois de enviado (sem editar, sem apagar pela tela).
- **Textos fixos:** "Ferramentas em teste"; "O que testar"; botão "Deixar retorno"; campos "O que você achou?" e "Nota"; confirmação "Retorno enviado. Obrigado."; vazio "Nenhuma ferramenta em teste agora."; a lista do administrador: "Retornos", com filtros "Ferramenta" e "Período".
- **O que a ferramenta é:** só um texto e uma situação, nesta entrega: um módulo ou versão nova de tela continua sendo feito pela DESENVOLVIMENTO; a ferramenta aponta, opcionalmente, o caminho dentro do Laboratório onde está (`caminho`, texto livre que começa com `/`).
- Skill `frontend-design:frontend-design`; tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Retorno sobrevive ao "Recomeçar":** depois de recomeçar o espelho, todos os retornos e ferramentas continuam (Task 1).
2. **O retorno vem de dentro do Laboratório:** sem sessão no Laboratório, deixar retorno é 409 "Entre no Laboratório para deixar um retorno."; a conta real fica registrada, mesmo com o perfil de administrador de teste (Task 1).
3. **Perfil de administrador de teste não administra:** com o perfil "Administrador de teste", a conta de um militar comum não cadastra ferramenta nem lê a lista de retornos (Task 1).
4. **Retorno em ferramenta encerrada:** 400 "Esta ferramenta não está mais em teste." (Task 1).
5. **Nota e texto no limite:** nota 0 e 6, texto vazio e com 2001 caracteres são recusados com frase amigável; 1, 5 e 2000 passam (Task 1).

---

### Task 1: as ferramentas e o retorno na API

**Files:** Create `apps/api/banco/migracoes/0049_laboratorio_ferramentas_e_retorno.sql`, `apps/api/src/laboratorio/ferramentas.ts`, `apps/api/src/laboratorio/retornos.ts`, `pacotes/contratos/src/laboratorio.ts`; Modify as rotas do real (onde a 6.59 pôs o `/api/laboratorio`), `pacotes/contratos/src/index.ts`; Test `apps/api/test/laboratorio-retorno.test.ts`

**Interfaces (Produces):**
- Tabelas: `ferramenta_teste (id uuid pk, nome text not null, o_que_testar text not null, caminho text null, situacao text not null check (situacao in ('em_teste','encerrada','virou_modulo')) default 'em_teste', inicio date not null default current_date, fim date null)`; `retorno_laboratorio (id uuid pk, ferramenta_id uuid not null references ferramenta_teste, usuario_id uuid not null references usuario(id), perfil_de_teste text not null, tela text not null, texto text not null check (char_length(texto) between 1 and 2000), nota smallint not null check (nota between 1 and 5), criado_em timestamptz not null default now())`; índice por `(ferramenta_id, criado_em desc)`. Auditoria na `ferramenta_teste` (mesmo gatilho das outras); `retorno_laboratorio` sem edição nem exclusão (gatilho que recusa `update` e `delete`).
- Contratos: `FerramentaDeTeste`, `NovaFerramenta`, `MudarSituacao`, `NovoRetorno = { ferramentaId, tela, texto, nota }`, `RetornoListado`, com as frases fixas nos erros do zod.
- Rotas do real: `GET /api/laboratorio/ferramentas` (todos com conta, em modo Laboratório); `POST /api/laboratorio/ferramentas` e `PATCH /api/laboratorio/ferramentas/:id` (administrador real); `POST /api/laboratorio/retornos` (exige a sessão no Laboratório; o `perfil_de_teste` vem da sessão, não do corpo); `GET /api/laboratorio/retornos?ferramenta=&de=&ate=` (administrador real; devolve também o nome da conta e a matrícula).

- [ ] **Step 1: testes (`laboratorio-retorno.test.ts`):** o ciclo (cadastrar, listar, mudar a situação, deixar retorno, o administrador lê); os cinco pontos do Review Focus; `update` e `delete` no retorno recusados pelo banco; o filtro por ferramenta e por período; "Recomeçar" (6.59) não apaga nada (Review Focus 1); ferramenta `encerrada` e `virou_modulo` aparecem na lista com a situação, e só `em_teste` aceita retorno; a tela é gravada sem parâmetros de rota; contratos validam os limites.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.60: as ferramentas em teste e o retorno`.

### Task 2: no site: a lista, o botão e a lista de retornos

**Files:** Create `apps/web/src/laboratorio/FerramentasEmTeste.tsx`, `apps/web/src/laboratorio/DeixarRetorno.tsx`, `apps/web/src/routes/_app/laboratorio_.retornos.tsx` (ou o caminho que o padrão do site pedir) e o cadastro das ferramentas (para o administrador, dentro da mesma tela de retornos, em uma aba "Ferramentas"); Modify a tela inicial **do Laboratório** (o ponto de partida da 6.59), `apps/web/src/api/` (as chamadas de `/api/laboratorio/*`, que o cliente sabe mandar ao real); Test `apps/web/src/__testes__/laboratorio-retorno.test.tsx`

- [ ] **Step 1: testes:** em modo Laboratório, a tela inicial mostra "Ferramentas em teste" com nome, "O que testar" e a situação; ferramenta com `caminho` tem um atalho que leva até ele; "Deixar retorno" abre a janela com "O que você achou?" e "Nota" (1 a 5), grava a tela de onde a pessoa estava (a rota atual) e mostra "Retorno enviado. Obrigado."; erros da API aparecem na janela, que continua aberta; fora do Laboratório, a lista e o botão não aparecem; só o administrador real vê "Retornos", com os filtros e a coluna de quem deixou, o perfil usado, a tela e a nota; o cadastro de ferramenta (nome, o que testar, caminho, situação) é só do administrador; vazio com a frase fixa; celular (390 px) sem rolagem de lado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador em 1440 e 390 px: cadastrar uma ferramenta, entrar no Laboratório com outra conta, deixar o retorno, e ler a lista como administrador; **recomeçar o espelho e conferir que o retorno continua**. **Step 5:** commit `Fase 6.60: a lista das ferramentas e o retorno no site` e enviar a branch à PLANEJAMENTO.
