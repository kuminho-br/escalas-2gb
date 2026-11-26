# Entrar no Laboratório: o cartão, o perfil de teste, a faixa e o isolamento (6.59) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** todo militar com conta abre o **Laboratório** pelo cartão da tela inicial, escolhe um perfil de teste e usa o sistema inteiro sobre o espelho (6.58), com uma faixa fixa que diz onde ele está. Nada do que faz ali chega ao banco real, e a conta real não ganha acesso nenhum no real.

**Architecture:** a API ganha um segundo ponto de entrada, `/api/lab/*`, que monta **as mesmas rotas** do sistema, mas sobre uma conexão que assume o papel `laboratorio_app` (6.58) e age como o perfil de teste escolhido, não como a conta real. O isolamento tem três camadas: (1) o papel do banco, que não enxerga o `public`; (2) o prefixo `/api/lab` contra o real e o cabeçalho `x-laboratorio` do site em modo Laboratório, conferidos nos dois sentidos; (3) testes que provam que nenhuma escrita cruza. A ligação "conta real ↔ perfil de teste" é a **sessão no Laboratório**, uma tabela do real.

**Tech Stack:** Hono, Better Auth, Postgres/PGlite, React, TanStack Router e Query, Vitest.

**Spec:** `docs/ideias/laboratorio.md`; plano anterior `docs/superpowers/plans/2026-11-25-fase6-58-espelho-e-separacao-de-dezembro.md` (o espelho, o papel `laboratorio_app`, `perfisDeTeste`). Decisões do usuário de 25/11/2026: entra com a própria conta e escolhe o perfil; o perfil só vale no espelho; a faixa em toda tela.

## Global Constraints

- Branch `fase6-59-entrar-no-laboratorio`, a partir da `main` com a 6.58 mesclada **e a migração/limpeza dela já aplicadas**. Migração `0048` (a sessão no Laboratório), aplicada nos dois schemas pelo executor da 6.58; **só com autorização do usuário**, como sempre.
- **O que cruza (únicas exceções ao isolamento):** a lista das ferramentas em teste (leitura) e o retorno (gravação), ambos no real, na 6.60. Nesta entrega não cruza nada.
- **Quem entra:** todo militar que tem conta (proposta da CONCEPÇÃO, aceita). Qualquer um escolhe qualquer perfil, inclusive o de administrador.
- **Quem age no Laboratório:** o perfil de teste, com o nível dele. A conta real não vale ali, e o perfil não vale no real.
- **Textos fixos:** cartão "Laboratório" com a linha "Experimente as ferramentas novas com dados de teste."; a faixa "Laboratório: dados de teste. Nada aqui vale."; "Testando como: {perfil}"; botão "Sair do Laboratório"; no menu do perfil, os cinco nomes da 6.58.
- **A faixa:** fixa no topo de toda tela do Laboratório, com cor e lugar próprios (diferentes de qualquer aviso do sistema real, de qualquer cor de serviço ou de estado), sempre visível, também no celular (390 px). Skill `frontend-design:frontend-design`; tokens e componentes da 6.20; mockup da DESIGN, se houver, é guia, não gabarito.
- **Modo do site por aba:** o modo vive na aba (`sessionStorage`), não no navegador inteiro; duas abas, uma no real e outra no Laboratório, não se misturam. Ao abrir uma aba nova, sempre no real.
- Nenhum dado pessoal real em repositório, teste ou CI. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

**Herança da 6.58 (notas da DESENVOLVIMENTO, 26/11).** O que ficou para esta entrega decidir e cobrir com teste:
- **Toda conexão do espelho** assume o papel `laboratorio_app` e fixa `search_path = laboratorio, public` (Task 1/2). Nada de pedido ao espelho com o papel da API real.
- **Espelho atrasado:** `migracoes-pendentes.ts` só olha o `public`. Passa a olhar também o `laboratorio`. Se o espelho estiver atrás, o Laboratório responde "O Laboratório está em manutenção." e o real segue normal (Task 2).
- **Leitura do catálogo:** o "apagar militar" e o `estrutura.ts` leem o catálogo pelo caminho da sessão, e o `tabelasLigadas` fica em cache de módulo com o caminho da primeira chamada. No espelho, as tabelas do `public` aparecem qualificadas. O cache passa a ter uma entrada por schema, e há teste de "apagar militar" no espelho que não toca o real (Task 2).
- **Migração nova:** a 0048 (e toda migração daqui em diante) é escrita sem `public.` e, quando consulta o catálogo, usa `current_schema()` (ex.: `to_regclass(current_schema() || '.x')`). Quem garante é o teste de estrutura igual da 6.58.

## Review Focus

1. **Escrita que cruza (a falha que não pode acontecer):** pedido ao `/api/lab/*` que grava (cadastro, escala, importação) deixa o `public` **idêntico** antes e depois; pedido ao real não deixa marca no `laboratorio` (Task 2).
2. **Pedido sem o prefixo ou sem o cabeçalho:** `x-laboratorio` num pedido ao `/api/*` real é recusado (409, "Este pedido é do Laboratório."); `/api/lab/*` sem o cabeçalho é recusado; `/api/lab/*` sem sessão no Laboratório ou de quem não tem conta é recusado (Task 2).
3. **Perfil de administrador não dá acesso ao real:** conta de militar comum com o perfil "Administrador de teste" no Laboratório; no real, pedidos de administrador continuam 403 (Task 2).
4. **Conta real que deixou de existir ou perdeu o acesso:** a sessão no Laboratório morre junto; o pedido seguinte é 401 (Task 2).
5. **Esquecer o prefixo no site:** nenhum pedido do site em modo Laboratório sai para `/api/` sem o `/lab`, e nenhum pedido do site fora do modo leva o prefixo (Task 4).

---

### Task 1: a sessão no Laboratório

**Files:** Create `apps/api/banco/migracoes/0048_laboratorio_sessao.sql`, `apps/api/src/laboratorio/sessao.ts`; Test `apps/api/test/laboratorio-sessao.test.ts`

**Interfaces (Produces):**
- Tabela `laboratorio_sessao (usuario_id uuid primary key references usuario(id) on delete cascade, perfil_id uuid not null, desde timestamptz not null default now())`. **Usuario e perfil são de mundos diferentes**: `usuario_id` é a conta real; `perfil_id` é um usuário do espelho e, por isso, **sem chave estrangeira** (a tabela existe também no espelho, sem uso lá).
- `entrarNoLaboratorio(c: Consulta, usuarioId: string, perfilId: string): Promise<{ perfilId: string; nome: string }>`: confere que `perfilId` é um dos `perfisDeTeste`; grava (troca de perfil é o mesmo comando); erro 400 "Perfil de teste não encontrado.".
- `perfilDoLaboratorio(c, usuarioId): Promise<{ perfilId: string; nome: string; nivel: string } | null>`; `sairDoLaboratorio(c, usuarioId): Promise<void>`.
- Rotas do **real**: `GET /api/laboratorio/perfis` (os cinco), `PUT /api/laboratorio/perfil` (`{ perfilId }`), `DELETE /api/laboratorio/perfil` (sair), `GET /api/laboratorio/eu` (o perfil em uso ou `null`). Só quem tem conta (mesma regra de acesso do site).

- [ ] **Step 1: testes:** entrar com cada um dos cinco perfis; perfil que não existe → 400 com a frase fixa; trocar de perfil mantém uma linha só; sair apaga; conta apagada leva a sessão (cascade); sem login, 401; a lista de perfis traz o nome e o nível de cada um.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.59: a sessão no Laboratório`.

### Task 2: as rotas sobre o espelho

**Files:** Create `apps/api/src/laboratorio/rotas-lab.ts`, `apps/api/src/laboratorio/banco-do-espelho.ts`; Modify `apps/api/src/app.ts` (montar o `/api/lab` e o guarda do real), possivelmente `apps/api/src/auth.ts` / `acesso.ts` (ponto onde o usuário chega às rotas: **ler antes**); Test `apps/api/test/laboratorio-isolamento.test.ts`

**Interfaces (Produces):**
- `bancoDoEspelho(real: Banco): Banco`: uma visão do banco em que **toda** consulta, inclusive a transação, roda com `set local role laboratorio_app` e `set local search_path to laboratorio, public` (consulta avulsa vira uma transação curta). Não reaproveita conexão sem esses dois comandos. `dialeto` (Better Auth) não é usado no `/api/lab`.
- `montarRotasDoLaboratorio(real: Banco): Hono`: monta, sobre `bancoDoEspelho`, o **mesmo conjunto de rotas** do sistema (cadastros, escala, efetivo, grade, voluntariado, importação, visão…), reutilizando a função que hoje monta as rotas (extrair dela, em vez de copiar). O ator de cada pedido é o `perfil_id` da sessão no Laboratório, no lugar do usuário do login; auditoria e permissões leem o espelho. Rotas de conta e senha, de contas de usuário reais e de administração do banco **não** entram no Laboratório (404).
- Guarda do real (middleware em `/api/*` exceto `/api/lab`): se o cabeçalho `x-laboratorio` vier, 409 "Este pedido é do Laboratório.". Guarda do Laboratório (em `/api/lab/*`): sem o cabeçalho, 409 "Este pedido não é do Laboratório."; sem login real, 401; sem sessão no Laboratório, 409 "Escolha um perfil de teste."; a sessão vale só para o dono da conta.

- [ ] **Step 1: testes (`laboratorio-isolamento.test.ts`):** (a) com a carga do espelho, uma conta real de militar comum entra com o perfil de gestor, **cria uma escala e importa uma planilha de Pecúlio** pelo `/api/lab/*`; um instantâneo (contagem e soma de hash por tabela) do `public` é o mesmo antes e depois, e as linhas aparecem no `laboratorio` (Review Focus 1); (b) a mesma conta faz uma gravação no real; o instantâneo do `laboratorio` não muda; (c) os três cenários de recusa do Review Focus 2; (d) o perfil de administrador do Laboratório e a mesma conta no real: 403 nas rotas de administrador (Review Focus 3); (e) conta apagada ou sem acesso: o pedido seguinte ao `/api/lab` é 401 (Review Focus 4); (f) auditoria: a gravação do Laboratório fica na auditoria do **espelho**, com o usuário do perfil; (g) listar as rotas do `/api/lab` e do real e conferir que as de conta e senha não existem no `/api/lab`; (h) consulta avulsa e transação passam pelo papel (provar com `current_user` e `current_schemas`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Se uma rota usar `public.…` por escrito ou uma conexão própria que fure o `bancoDoEspelho`, **corrigir a rota** (o teste (a) pega isso). **Step 4:** PASS. **Step 5:** commit `Fase 6.59: o sistema sobre o espelho, com o isolamento provado`.

### Task 3: "Recomeçar"

**Files:** Modify `apps/api/src/laboratorio/espelho.ts` (da 6.58), `apps/api/src/laboratorio/rotas.ts` (ou o arquivo das rotas do real); Test `apps/api/test/laboratorio-recomecar.test.ts`

**Interfaces (Produces):**
- `recomecarEspelho(banco: Banco, mes: string): Promise<void>`: numa transação, esvazia todas as tabelas do `laboratorio` (menos `migracao_aplicada`) e roda `cargaDoEspelho`. As sessões no Laboratório (no real) **continuam valendo**, e os perfis voltam com os **mesmos ids** (a carga fixa os ids dos cinco usuários de teste, para a sessão de quem está testando não quebrar).
- `POST /api/laboratorio/recomecar` (real): só o administrador **real** (nível de administrador na raiz, na conta real). Resposta: `{ militares, perfis }`.

- [ ] **Step 1: testes:** depois de bagunçar o espelho, `recomecarEspelho` devolve exatamente o estado da carga; os ids dos perfis são os mesmos de antes; a sessão no Laboratório de quem testava continua válida; nenhum registro do `public` muda; só administrador real recomeça (militar comum e gestor, 403); falha no meio não deixa o espelho vazio (a transação volta).
- [ ] **Step 2:** FAIL. **Step 3:** implementar (ids fixos dos perfis: ajustar a carga da 6.58 se ela os sortear). **Step 4:** PASS. **Step 5:** commit `Fase 6.59: recomeçar o espelho`.

### Task 4: o site: o cartão, a escolha do perfil e a faixa

**Files:** Create `apps/web/src/laboratorio/` (`modo.ts`, `Faixa.tsx`, `EscolherPerfil.tsx`, `CartaoLaboratorio.tsx`); Modify `apps/web/src/api/cliente.ts` (o único lugar que monta o endereço dos pedidos), a tela inicial (o cartão), o layout raiz do site (a faixa); Test `apps/web/src/__testes__/laboratorio.test.tsx`

**Interfaces (Produces):**
- `modo.ts`: `emLaboratorio(): boolean` (lê `sessionStorage`), `entrarNoModo()`, `sairDoModo()`.
- Em `cliente.ts`: com o modo ligado, **todo** pedido vai para `/api/lab/…` e leva o cabeçalho `x-laboratorio: 1`; com o modo desligado, nunca. É o único ponto que decide o prefixo.
- `CartaoLaboratorio`: o cartão da tela inicial para quem tem conta. Abre `EscolherPerfil` (lista os cinco, vinda de `GET /api/laboratorio/perfis`); escolher chama `PUT /api/laboratorio/perfil`, liga o modo, limpa o cache de consultas e leva à tela inicial **do Laboratório**.
- `Faixa`: em todo layout, quando o modo está ligado: o texto fixo, o perfil em uso ("Testando como: {nome}", com o menu de troca) e "Sair do Laboratório" (chama `DELETE /api/laboratorio/perfil`, desliga o modo, limpa o cache e volta ao real). Se `GET /api/laboratorio/eu` disser que não há sessão (por exemplo, expirou ou foi trocada em outra aba), o modo desliga e a pessoa volta ao real com um aviso "O Laboratório foi encerrado.".

- [ ] **Step 1: testes:** o cartão aparece na tela inicial; escolher o perfil liga o modo e a faixa aparece com o nome; **todo pedido em modo Laboratório vai para `/api/lab/` e leva o cabeçalho**, e fora do modo nenhum leva (varrer os pedidos feitos pelo cliente de teste nos dois modos, Review Focus 5); duas abas de teste (dois `sessionStorage`) não se misturam; trocar de perfil mantém o modo; sair desliga o modo e limpa o cache; a faixa tem o texto fixo e aparece em todas as rotas do layout; sessão encerrada em outra aba volta ao real; celular (390 px) sem rolagem de lado e com a faixa visível; a faixa é diferente de qualquer outra faixa de aviso do site (cor e posição próprias, pelo token).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador, em 1440 e 390 px, entrar, trocar de perfil, criar algo e sair, e **abrir o real em outra aba para ver que nada do Laboratório apareceu**. **Step 5:** commit `Fase 6.59: o cartão, o perfil de teste e a faixa` e enviar a branch à PLANEJAMENTO.
