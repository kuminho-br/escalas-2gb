# Fase 1 — Fundação: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** banco, API e site no ar no ambiente de teste, com login por e-mail e senha e auditoria gravada pelo banco, com o protótipo do Apps Script reorganizado em `prototipo/` sem mudar o `clasp push`.

**Architecture:** monorepo pnpm. `prototipo/` guarda o Apps Script. `apps/api` é uma API Hono sobre Postgres, com migrações em SQL puro, auditoria por gatilho e login com Better Auth. `apps/web` é um site React (Vite) com o login e a casca vazia das telas. No teste, site e API ficam num único projeto Vercel, no mesmo endereço; o banco é o Postgres do Supabase em São Paulo. Em desenvolvimento e nos testes, o banco é o PGlite (Postgres embutido), sem instalar Postgres nem Docker.

**Tech Stack:** Node 24 LTS (CI e Vercel; local funciona no 26), pnpm 10+, TypeScript strict, Hono 4, `pg`, `@electric-sql/pglite`, Better Auth 1.x, Kysely (só como dialeto do Better Auth), Vitest, React 19 + Vite, Tailwind 4, shadcn/ui, TanStack Router/Query, GitHub Actions, Vercel, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-16-migracao-design.md` (D1–D7), `docs/superpowers/specs/2026-11-16-esquema-banco.md` (esquema v0.1), `docs/superpowers/specs/2026-11-16-telas.md` (identidade visual e navegação). Roadmap: `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`, fase 1.

## Global Constraints

- Postgres 15+; extensões `ltree` e `btree_gist`. `gen_random_uuid()` é nativo do Postgres 13+, então `pgcrypto` não é criada.
- Nomes de tabelas e colunas em português, minúsculas, sem acento, com `_`. Chave primária `id uuid default gen_random_uuid()`; exceção `auditoria.id bigint generated always as identity`.
- Mês de referência é `date` no dia 1 (`check (extract(day from x) = 1)`). Períodos `desde date not null`, `ate date null`, sem sobreposição por `exclude using gist`.
- "Hoje" é calculado na API com fuso `America/Recife` e passado como parâmetro. O SQL não usa `current_date` nem `now()::date` para regra de negócio.
- Supabase só como Postgres: sem Supabase Auth, sem funções do Supabase, o navegador nunca fala com o banco (D2).
- Sem cadastro aberto: o cadastro público do Better Auth fica desligado (D3).
- Região São Paulo: Supabase `sa-east-1`, Vercel `gru1` (D2).
- Nenhum dado pessoal real no repositório, nos testes, no CI nem nas prévias. Militares de exemplo têm matrícula começando em `990` (D7). TELEFONE não existe.
- Arquivos em `prototipo/` continuam sendo Apps Script: escopo global único, sem `require()` nem `import` (CLAUDE.md).
- `clasp push` continua sendo rodado de `C:\projetos\escalas-2gb`, com `C:` maiúsculo. Quem roda é o usuário, e merge na `main` só com a anuência dele (CLAUDE.md).
- Commits terminam com a linha `Co-Authored-By` que a sessão indicar.

## Review Focus

1. **Lista de arquivos do `clasp push` depois do `rootDir`.** Tem que ser idêntica à de hoje: nenhum arquivo de teste, de `docs/` ou de `apps/`, e `appsscript.json` presente. Coberto pela tarefa 1, passos 2 e 6.
2. **Usuário desativado ou sem papel tentando entrar.** Desativado não recebe sessão; sem papel vigente entra, mas `/api/eu` devolve `papeis: []`. Coberto pela tarefa 8, testes `inativo nao entra` e `eu sem papel`.
3. **Usuário de uma requisição gravado na auditoria de outra.** Com conexões reaproveitadas, o `app.usuario_id` não pode sobrar de uma transação para a seguinte. Coberto pela tarefa 5, teste `nao vaza usuario entre transacoes`.
4. **Carga de exemplo rodando no banco do teste.** Ela mistura militares fictícios com os reais. O script recusa quando `AMBIENTE=teste`. Coberto pela tarefa 6, teste `recusa no ambiente de teste`.
5. **Virada do dia em UTC.** Entre 21h e 0h de Recife já é o dia seguinte em UTC, e um papel com `desde` "hoje" sumiria. Papéis começam no dia 1 do mês, e "hoje" vem de `hojeRecife()`. Coberto pela tarefa 6, teste `hojeRecife usa o fuso de Recife`, e pela tarefa 8, teste `eu com sessao`.

## Decisões deste plano (do construtor, não da especificação)

- **PGlite em desenvolvimento e nos testes.** A máquina não tem Docker nem Postgres. Cada arquivo de teste ganha um banco novo em memória. Se o PGlite falhar em algum recurso (extensão ou gatilho), a alternativa é instalar o PostgreSQL local; nesse caso, parar e avisar.
- **Migrações próprias, em SQL puro.** Um executor de ~40 linhas e a tabela `migracao_aplicada`. Sem ferramenta externa, para levar ao servidor do Estado sem dependência.
- **Auditoria só de acréscimo garantida por gatilhos**, inclusive contra `TRUNCATE`. O papel de banco dedicado sem `update`/`delete` (esquema, seção 8) fica para a fase 7, junto com a ida ao servidor do Estado, porque o Supabase grátis usa um único usuário. `conta` também fica fora da auditoria, para não copiar o hash das senhas.
- **Convite fica para a fase 3**, junto com o cadastro de militares, porque todo usuário precisa ser um militar já cadastrado. Na fase 1, o administrador é criado por comando.
- **A cópia semanal criptografada do banco fica para a fase 3**, antes da primeira carga de dados reais. Até lá, o banco do teste só tem a estrutura e o administrador.
- **Site e API no mesmo endereço**, num projeto Vercel: `api/index.ts` na raiz é um adaptador fino para `apps/api`. Isso dispensa CORS e cookie entre domínios.
- **Prévias da Vercel não recebem banco.** As variáveis ficam só em Production, e a API das prévias responde 503. Isso honra a D7 (prévias sem dados reais).
- **Manter o banco acordado** com um cron da Vercel a cada 3 dias em `/api/saude/banco`.
- **Testes do protótipo vão para `prototipo/testes/`.** Eles leem os fontes com `path.join(__dirname, '..')`, então funcionam sem mudança. A troca da matrícula real `707170-1` continua na criação de `casos/` (fase 2, D7).

---

### Task 1: Protótipo em `prototipo/` (branch própria, validada pelo usuário)

**Files:**
- Move (`git mv`): todos os `*.js`, `*.html` e `appsscript.json` da raiz → `prototipo/`; `testes/` → `prototipo/testes/`
- Move: `.claspignore` → conforme o passo 4
- Modify: `.clasp.json` (`"rootDir": ""` → `"rootDir": "prototipo"`)
- Modify: `CLAUDE.md` (fica sem commit, como hoje, salvo pedido do usuário)

**Interfaces:**
- Produces: `prototipo/` com os fontes do Apps Script, e `prototipo/testes/teste_*.js` rodando com `node`.

- [ ] **Passo 1: Partir da `main` atualizada.** O PR `fase0-design` tem que estar mergeado (`gh pr list --state all --head fase0-design`). Se não estiver, perguntar ao usuário antes de seguir. Depois: `git checkout main && git pull && git checkout -b fase1-reorganizacao`.
- [ ] **Passo 2: Guardar a lista atual do push.** `clasp show-file-status > "$SCRATCH/clasp-antes.txt"`, onde `$SCRATCH` é a pasta de rascunho da sessão. Esperado: 22 `.js`, 6 `.html` e `appsscript.json`. Se o comando pedir login, pedir ao usuário que rode e cole a saída.
- [ ] **Passo 3: Mover os arquivos.** `git mv` de cada `*.js`, `*.html` e `appsscript.json` da raiz para `prototipo/`, e `git mv testes prototipo/testes`. Na raiz não sobra nenhum `.js`.
- [ ] **Passo 4: Apontar o clasp.** Trocar o `rootDir` para `"prototipo"`. Rodar `clasp show-file-status`. Se aparecer algo de `testes/`, copiar o `.claspignore` para `prototipo/.claspignore`, porque o clasp 3 resolve os padrões a partir do `rootDir`. Manter na raiz só se a conferência mostrar que é lá que ele lê.
- [ ] **Passo 5: Rodar os testes do protótipo.** `for f in prototipo/testes/teste_*.js; do node "$f" | tail -1; done`. Esperado: cotas 32, p13 26, p15 72, p16 209, p17 53, p18 43, p19 68. Total 503 ok, 0 falha.
- [ ] **Passo 6: Comparar o push.** `clasp show-file-status` tem que listar os mesmos nomes do passo 2, sem o prefixo `prototipo/`. Com `diff`, a única diferença aceitável é a ordem.
- [ ] **Passo 7: Atualizar o CLAUDE.md.** Fontes em `prototipo/`, testes em `prototipo/testes/`, total de testes 503, `clasp push` igual a antes.
- [ ] **Passo 8: Commit, push e PR.**
```bash
git add -A prototipo .clasp.json .claspignore
git commit -m "Fase 1: protótipo do Apps Script em prototipo/ (rootDir do clasp)"
git push -u origin fase1-reorganizacao
gh pr create --title "Fase 1: protótipo em prototipo/" --body "<o que mudou; como validar: clasp push da raiz e conferir a sandbox>"
```
- [ ] **Passo 9: PARAR.** O usuário roda `clasp push` de `C:\projetos\escalas-2gb`, confere a sandbox e mergeia. Só depois seguir para a tarefa 2.

---

### Task 2: Monorepo pnpm e CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `scripts/testes-prototipo.mjs`, `.github/workflows/ci.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: na raiz, `pnpm test` (protótipo e pacotes), `pnpm typecheck` e `pnpm build`. Workspaces em `apps/*` e `pacotes/*`.

- [ ] **Passo 1:** `git checkout main && git pull && git checkout -b fase1-fundacao`. Instalar o pnpm com `npm i -g pnpm` (o Node 26 não traz corepack) e anotar a versão.
- [ ] **Passo 2: Escrever o executor dos testes do protótipo.** `scripts/testes-prototipo.mjs` roda cada `prototipo/testes/teste_*.js` (ou os caminhos passados como argumento) com `node`, mostra a última linha de cada um e sai com 1 se algum sair com código diferente de 0.
- [ ] **Passo 3: Provar que ele falha.** Criar na pasta de rascunho um `teste_falha.js` com `process.exit(1)` e rodar `node scripts/testes-prototipo.mjs <caminho>`. Esperado: código de saída 1.
- [ ] **Passo 4: Arquivos da raiz.**
  - `package.json`: `private: true`, `packageManager: "pnpm@<versão>"`, `engines.node: ">=22"`.
  - Scripts:
    - `test`: `node scripts/testes-prototipo.mjs && pnpm -r --if-present test`
    - `typecheck`: `pnpm -r --if-present typecheck`
    - `build`: `pnpm -r --if-present build`
    - `dev`: `pnpm --parallel --filter api --filter web dev`
  - `tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `verbatimModuleSyntax`, `skipLibCheck`.
  - `.gitignore`: acrescentar `node_modules/`, `dist/`, `.dados/`, `.env*` (exceto `.env.exemplo`) e `.vercel/`.
- [ ] **Passo 5: Rodar `pnpm install && pnpm test`.** Esperado: 503 ok e código de saída 0.
- [ ] **Passo 6: CI.** `.github/workflows/ci.yml` roda em `push` e `pull_request`, com `ubuntu-latest`, `pnpm/action-setup` e `actions/setup-node` (Node 24, cache do pnpm). Passos: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [ ] **Passo 7: Commit e push.** `git commit -m "Fase 1: monorepo pnpm e CI"` e `git push -u origin fase1-fundacao`. Conferir com `gh run watch` que o CI passa.

---

### Task 3: API base, executor de migrações e esquema da estrutura e das pessoas

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/banco/banco.ts`, `apps/api/src/banco/migrar.ts`, `apps/api/scripts/migrar.ts`
- Create: `apps/api/banco/migracoes/0001_estrutura_pessoas.sql`
- Test: `apps/api/test/banco-teste.ts` (auxiliar), `apps/api/test/migrar.test.ts`, `apps/api/test/esquema-estrutura.test.ts`

**Interfaces:**
- Produces (`src/banco/banco.ts`):
```ts
export interface Consulta {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>; // vários comandos, sem parâmetros
}
export interface Banco extends Consulta {
  transacao<T>(fn: (tx: Consulta) => Promise<T>): Promise<T>;
  fechar(): Promise<void>;
}
export function bancoPg(url: string): Banco;                  // pg.Pool, max 3
export async function bancoPglite(pasta?: string): Promise<Banco>; // sem pasta = memória; carrega ltree e btree_gist
```
- Produces (`src/banco/migrar.ts`): `export async function migrar(banco: Banco, pasta?: string): Promise<string[]>`. A pasta padrão é `apps/api/banco/migracoes`. Aplica, em ordem de nome, os `.sql` que ainda não estão em `migracao_aplicada(nome text primary key, aplicada_em timestamptz not null default now())`, cada um numa transação, e devolve os nomes aplicados.
- Produces (`test/banco-teste.ts`): `export async function bancoDeTeste(): Promise<Banco>`, que é `bancoPglite()` em memória já migrado.
- Produces: script `pnpm --filter api db:migrar`, que lê `DATABASE_URL`.

- [ ] **Passo 1: Testes do executor.**
  - `aplica em ordem e registra`: com uma pasta temporária contendo `0001_a.sql` e `0002_b.sql`, `migrar` devolve `['0001_a.sql','0002_b.sql']`.
  - `segunda vez nao aplica nada`: devolve `[]`.
  - `falha desfaz o arquivo inteiro`: um `.sql` com erro no segundo comando não deixa a tabela do primeiro comando nem a linha em `migracao_aplicada`.
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FAIL, módulo não encontrado.
- [ ] **Passo 3: Implementar.** `banco.ts` e `migrar.ts`. No PGlite, `transacao` usa `pg.transaction`; no `pg`, usa `BEGIN`/`COMMIT`/`ROLLBACK` num cliente reservado. Scripts do pacote: `test: vitest run`, `typecheck: tsc --noEmit`, `db:migrar: tsx scripts/migrar.ts`.
- [ ] **Passo 4:** os testes do executor passam.
- [ ] **Passo 5: Testes do esquema** (`esquema-estrutura.test.ts`, com `bancoDeTeste()`). Cada caso abaixo termina em erro do banco:
  - `matricula fora do formato`: inserir militar com `'99001-1'`;
  - `cnh sem motorista`: militar com `motorista = false` e `cnh = '{B}'`;
  - `cnh invalida`: `cnh = '{F}'`;
  - `lotacao sobreposta`: duas lotações do mesmo militar, uma de 2026-11-01 sem fim e outra de 2026-12-01;
  - `mes fora do dia 1`: lotação com `desde = '2026-11-15'`;
  - `afastamento com fim antes do inicio`;
  - `mae de nivel maior`: unidade `corporacao` filha de uma `secao`.

  E dois casos de sucesso:
  - `caminho da unidade`: a filha de CBMPE tem `caminho` = caminho da mãe + rótulo próprio, e `caminho <@ (caminho da raiz)` é verdadeiro;
  - `mover unidade move os descendentes`: trocar o `mae_id` de um GB atualiza o `caminho` da seção filha.
- [ ] **Passo 6:** FAIL (tabelas inexistentes).
- [ ] **Passo 7: Escrever `0001_estrutura_pessoas.sql`.**
  - `create extension if not exists ltree; create extension if not exists btree_gist;`
  - Tabelas `tipo_unidade` (com as 5 linhas e níveis 0 a 4 da especificação), `unidade`, `posto_grad`, `militar`, `equipe`, `lotacao`, `vinculo_externo`, `afastamento`, com as colunas e regras do esquema, seção 1.
  - O rótulo do `caminho` é `replace(id::text, '-', '_')`.
  - Gatilho `before insert or update of mae_id` monta o `caminho` e recusa mãe de nível maior ou igual. Gatilho `after update of caminho` regrava o caminho dos descendentes.
  - A regra "equipe da mesma unidade" da lotação também é gatilho.
- [ ] **Passo 8:** `pnpm --filter api test`. Esperado: PASS.
- [ ] **Passo 9: Commit.** `git add apps/api && git commit -m "Fase 1: executor de migrações e esquema de estrutura e pessoas"`.

---

### Task 4: Restante do esquema (usuários, serviços, guarnições, escalas, mês, configurações)

**Files:**
- Create: `apps/api/banco/migracoes/0002_usuarios.sql`, `0003_servicos_guarnicoes_escalas.sql`, `0004_mes.sql`, `0005_configuracoes_documentos.sql`
- Test: `apps/api/test/esquema-operacao.test.ts`

**Interfaces:**
- Produces: tabelas das seções 2 a 7 do esquema. As tabelas do Better Auth têm os nomes e colunas abaixo, que a tarefa 8 configura igual.

| Tabela | Colunas (todas `not null`, salvo marcação) |
|---|---|
| `usuario` | `id uuid pk`, `nome text`, `email text unique`, `email_verificado boolean default false`, `imagem text null`, `criado_em timestamptz`, `atualizado_em timestamptz`, `militar_id uuid unique fk militar`, `ativo boolean default true` |
| `sessao` | `id uuid pk`, `usuario_id uuid fk usuario on delete cascade`, `token text unique`, `expira_em timestamptz`, `ip text null`, `agente text null`, `criado_em`, `atualizado_em` |
| `conta` | `id uuid pk`, `usuario_id uuid fk`, `conta_id text`, `provedor_id text`, `senha text null`, `token_acesso text null`, `token_renovacao text null`, `token_id text null`, `expira_token_acesso timestamptz null`, `expira_token_renovacao timestamptz null`, `escopo text null`, `criado_em`, `atualizado_em` |
| `verificacao` | `id uuid pk`, `identificador text`, `valor text`, `expira_em timestamptz`, `criado_em`, `atualizado_em` |

- [ ] **Passo 1: Testes** (`esquema-operacao.test.ts`). Casos que terminam em erro:
  - `turno repetido no servico`: duas letras `A` no mesmo serviço;
  - `operacao so em diaria`: serviço `pjes` com `operacao` preenchida;
  - `voluntariado so A ou B`: `turno_padrao = 'C'`;
  - `alocacao de servico fora da escala`: o serviço não está em `escala_servico`;
  - `alocacao com turno de outro servico`;
  - `alocacao repetida`: mesma chave (militar, data, serviço, turno);
  - `permuta com um item so`: inserir a permuta e um `permuta_item` numa transação e fazer commit;
  - `cota sem dia 1`;
  - `cota de servico ordinario`;
  - `usuario sem militar`;
  - `composicao com maximo menor que minimo`;
  - `cnh_exigida invalida`: `'F'`.

  E casos de sucesso:
  - `permuta com dois itens`;
  - `turno que atravessa a meia-noite`: `inicio 16:00`, `fim 00:00`.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3: Escrever as migrações 0002 a 0005** com as colunas e regras das seções 2 a 7 do esquema e a tabela acima.
  - Regras entre tabelas por gatilho:
    - alocação: o serviço está em `escala_servico` da escala, e o turno pertence ao serviço;
    - cota: o serviço é do tipo `pjes` ou `diaria`;
    - permuta: exatamente 2 itens, com `constraint trigger ... deferrable initially deferred`.
  - `escala_servico` tem a chave primária composta da especificação.
- [ ] **Passo 4:** PASS, junto com os testes da tarefa 3.
- [ ] **Passo 5: Commit.** `git commit -m "Fase 1: esquema completo (usuários, serviços, guarnições, escalas, mês, configurações)"`.

---

### Task 5: Auditoria gravada pelo banco

**Files:**
- Create: `apps/api/banco/migracoes/0006_auditoria.sql`
- Modify: `apps/api/src/banco/banco.ts` (acrescenta `comUsuario`)
- Test: `apps/api/test/auditoria.test.ts`

**Interfaces:**
- Produces: `export async function comUsuario<T>(banco: Banco, usuarioId: string, fn: (tx: Consulta) => Promise<T>): Promise<T>`. Abre a transação, roda `select set_config('app.usuario_id', $1, true)` e depois `fn`.
- Produces: tabela `auditoria` (esquema, seção 8) e função `registrar_auditoria()`.

- [ ] **Passo 1: Testes.**
  - `insert, update e delete geram tres linhas`: com um militar, `acao` sai como `insert`, `update` e `delete`. `antes` é null no insert, `depois` é null no delete, e `registro_id` é o id do militar.
  - `usuario da transacao`: dentro de `comUsuario(banco, X, ...)`, a linha guarda `usuario_id = X`.
  - `nao vaza usuario entre transacoes`: depois de um `comUsuario`, um insert fora dele grava `usuario_id` null.
  - `unidade direta e pela escala`: `servico.unidade_id` vai para `auditoria.unidade_id`, e numa `alocacao` vem de `escala.unidade_id`.
  - `chave composta`: em `escala_servico`, `registro_id = '<escala_id>:<servico_id>'`.
  - `auditoria nao aceita update`, `nao aceita delete`, `nao aceita truncate`: cada um termina em erro.
  - `sessao, verificacao e conta nao sao auditadas`: inserir nelas não gera linha.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3: Escrever `0006_auditoria.sql`.**
  - Tabela e índices `(unidade_id, em)` e `(tabela, registro_id)`.
  - `registrar_auditoria()` em plpgsql:
    - `usuario_id` vem de `nullif(current_setting('app.usuario_id', true), '')::uuid`;
    - `registro_id` vem de `coalesce(r->>'id', (r->>'escala_id') || ':' || (r->>'servico_id'))`;
    - `unidade_id` vem de `r->>'unidade_id'` ou, se a linha tem `escala_id`, de `escala.unidade_id`; senão fica null.
  - Um bloco `do` liga o gatilho `after insert or update or delete ... for each row` a todas as tabelas das seções 1 a 7, menos `sessao`, `verificacao`, `conta` e `migracao_aplicada`.
  - Gatilhos `before update or delete` (por linha) e `before truncate` (por comando) em `auditoria` lançam exceção.
  - Implementar `comUsuario`.
- [ ] **Passo 4:** PASS (todos os testes da API).
- [ ] **Passo 5: Commit.** `git commit -m "Fase 1: auditoria por gatilho, só de acréscimo"`.

---

### Task 6: Carga base e carga de exemplo

**Files:**
- Create: `apps/api/banco/migracoes/0007_carga_base.sql`
- Create: `apps/api/src/carga/exemplo.ts`, `apps/api/scripts/carga-exemplo.ts`, `apps/api/src/datas.ts`
- Test: `apps/api/test/carga.test.ts`, `apps/api/test/datas.test.ts`

**Interfaces:**
- Produces: as unidades reais CBMPE (corporacao) › DGO (diretoria_geral) › DIM, DInter/1, DInter/2 (diretoria_integrada) › 2º GB (grupamento, abaixo da DInter/1) › 1ª SB (secao), com `desde = '2026-11-01'`. Postos em ordem de hierarquia:

  SD BM, CB BM, 3º SGT BM, 2º SGT BM, 1º SGT BM, ST BM, ASP OF BM, 2º TEN BM, 1º TEN BM, CAP BM, MAJ BM, TEN CEL BM, CEL BM

  Cada posto tem o nome por extenso, e o campo `ordem` vai de 1 a 13 nessa sequência.
- Produces (`src/datas.ts`):
```ts
export function hojeRecife(agora?: Date): string; // 'aaaa-mm-dd' no fuso America/Recife
export function inicioDoMes(dia: string): string; // '2026-11-17' -> '2026-11-01'
```
- Produces: `export async function cargaExemplo(banco: Banco, ambiente: string | undefined, mes: string): Promise<{ militares: number }>`. Lança `Error('Carga de exemplo recusada no ambiente de teste')` quando `ambiente === 'teste'`. Script: `pnpm --filter api carga-exemplo`.

- [ ] **Passo 1: Testes.**
  - `carga base`: existe uma única unidade sem mãe (CBMPE), e o caminho da 1ª SB contém o do 2º GB, que contém o da DInter/1.
  - `exemplo cria 53 militares`, com 17 no Adm e 36 no Pronto. As equipes da 1ª SB são Alfa 9, Bravo 10, Charlie 9 e Delta 8, com `ordem_ciclo` de 1 a 4. Todas as matrículas casam `^990\d{3}-\d$`.
  - `exemplo e idempotente`: rodar duas vezes deixa 53 militares.
  - `recusa no ambiente de teste`.
  - `hojeRecife usa o fuso de Recife` (`datas.test.ts`): `hojeRecife(new Date('2026-11-17T01:30:00Z')) === '2026-11-16'`; e `inicioDoMes('2026-11-17') === '2026-11-01'`.
  - `servicos de exemplo`, com nome, tipo, cor e turnos:
    - Pronto: ordinario, `#2F8F5B`, A 08–20 e B 20–08;
    - Expediente: ordinario, `#8A94A1`, U 08–16;
    - JES: pjes, `#6E56A8`, A 08–20 e B 20–08;
    - Saldo: ordinario, `#2B7BB9`, A 08–20 e B 20–08;
    - Bioma: diaria, operação "Guardiões do Bioma", `#C08A1E`, A 00–08, B 08–16 e C 16–00;
    - PE Seguro: diaria, operação "PE Seguro", `#3C5F9C`, A 00–08, B 08–16 e C 16–00;
    - Defensoria: pjes, `#8C4A7A`, U 07–19.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3: Implementar.**
  - `0007` insere as unidades e os postos.
  - `cargaExemplo` insere, numa única `banco.transacao` sem `comUsuario` (a auditoria registra usuário null, como carga), os 53 militares com nomes de guerra inventados e distintos, distribuídos pelos postos conforme a proporção da sandbox:
    - Adm: 2 ST, 3 2º SGT, 6 3º SGT, 4 CB e 2 SD;
    - Pronto: Alfa com 1 2º SGT, 3 3º SGT e 5 SD; Bravo, Charlie e Delta na mesma linha.
  - Os militares recebem lotação desde `mes` na 1ª SB, 8 deles motoristas (5 com `{B}`, 3 com `{D}`) e 10 voluntários JES.
  - Também insere os serviços e turnos acima, na 1ª SB.
  - O script lê `DATABASE_URL` (sem ela, o PGlite de `apps/api/.dados/pglite`), `AMBIENTE` e o mês atual de `inicioDoMes(hojeRecife())`.
- [ ] **Passo 4:** PASS.
- [ ] **Passo 5: Commit.** `git commit -m "Fase 1: carga base (unidades, postos) e carga de exemplo fictícia"`.

---

### Task 7: Aplicativo Hono, saúde e servidor local

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/rotas/saude.ts`, `apps/api/src/servidor.ts`
- Test: `apps/api/test/saude.test.ts`

**Interfaces:**
- Produces:
```ts
// src/app.ts
export interface Dependencias { banco: Banco; cronSecret?: string; auth?: Auth } // Auth: tarefa 8
export function criarApp(dep: Dependencias): Hono;
```
- Rotas:
  - `GET /api/saude` → `200 {"ok":true}`;
  - `GET /api/saude/banco` com `Authorization: Bearer <cronSecret>` → roda `select 1` e responde `200 {"ok":true,"banco":"ok"}`;
  - sem o cabeçalho, ou com o valor errado → `401`.
- `src/servidor.ts`: na porta 8787, usa `bancoPg(DATABASE_URL)` ou, sem ela, `bancoPglite('apps/api/.dados/pglite')`; roda `migrar`; sobe com `@hono/node-server`. Script: `dev: tsx watch src/servidor.ts`.

- [ ] **Passo 1: Testes.**
  - `saude responde ok`.
  - `saude do banco exige segredo`: 401 sem cabeçalho e 401 com segredo errado.
  - `saude do banco com segredo`: 200 e `banco: "ok"`.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** PASS. Rodar `pnpm --filter api dev` e `curl localhost:8787/api/saude`. Esperado: `{"ok":true}`.
- [ ] **Passo 5: Commit.** `git commit -m "Fase 1: app Hono, saúde e servidor local"`.

---

### Task 8: Login (Better Auth), `/api/eu` e criação do administrador

**Files:**
- Create: `apps/api/src/auth.ts`, `apps/api/src/rotas/eu.ts`, `apps/api/src/usuarios/criar-admin.ts`, `apps/api/scripts/criar-admin.ts`
- Modify: `apps/api/src/banco/banco.ts` (o `Banco` passa a expor `dialeto: Dialect` do Kysely; `PostgresDialect` no pg, `PGliteDialect` de `kysely-pglite-dialect` no PGlite)
- Modify: `apps/api/src/app.ts` (monta o auth e o `/api/eu`)
- Test: `apps/api/test/login.test.ts`

**Interfaces:**
- Produces:
```ts
// src/auth.ts
export function criarAuth(cfg: { banco: Banco; segredo: string; urlBase: string }): Auth; // Auth = ReturnType<typeof betterAuth>
// src/usuarios/criar-admin.ts
export interface DadosAdmin { matricula: string; postoSigla: string; nomeGuerra: string; email: string; senha: string; hoje: string }
export async function criarAdmin(banco: Banco, d: DadosAdmin): Promise<{ usuarioId: string; militarId: string }>;
// resposta de GET /api/eu
export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  papeis: { papel: 'administrador' | 'chefe' | 'escalante'; unidadeId: string; unidadeSigla: string }[];
}
```
- Configuração do Better Auth:
  - `basePath: '/api/auth'`;
  - `emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 }`;
  - modelos `usuario`, `sessao`, `conta` e `verificacao`, com os campos mapeados para as colunas da tabela da tarefa 4 e `additionalFields` `militarId → militar_id` e `ativo` (`input: false`);
  - ids gerados com `crypto.randomUUID()` (opção de geração de id da versão instalada);
  - `databaseHooks.session.create.before` recusa usuário com `ativo = false`;
  - `trustedOrigins: [urlBase]`.
- Montagem: `app.on(['GET','POST'], '/api/auth/*', c => auth.handler(c.req.raw))`.
- `/api/eu`:
  - sem sessão → 401;
  - papéis vigentes são os com `desde <= hojeRecife()` e (`ate` null ou `ate >= hojeRecife()`).
- `criarAdmin`:
  - cria o militar se a matrícula não existir;
  - cria o usuário (`nome` = posto + nome de guerra);
  - cria a `conta` com `provedor_id = 'credential'`, `conta_id` = id do usuário e `senha` = `hashPassword` de `better-auth/crypto`;
  - cria o papel `administrador` na unidade sem mãe, com `desde = inicioDoMes(hoje)`;
  - tudo numa transação; e-mail repetido lança `Error('Já existe usuário com este e-mail')`.
- Script `pnpm --filter api criar-admin -- --matricula --posto --nome-guerra --email`: lê a senha de `SENHA_ADMIN` ou pede no terminal, e usa `DATABASE_URL`.

- [ ] **Passo 1: Testes** (`login.test.ts`, com `bancoDeTeste()`, `criarApp` com auth e `app.request`).
  - `entra com senha certa`: `POST /api/auth/sign-in/email` → 200 e `set-cookie` presente.
  - `senha errada`: 401.
  - `cadastro aberto desligado`: `POST /api/auth/sign-up/email` não devolve 200, e a contagem de `usuario` não muda.
  - `eu com sessao`: devolve a matrícula do militar e `papeis[0].papel === 'administrador'`, com `unidadeSigla === 'CBMPE'`.
  - `eu sem sessao`: 401.
  - `eu sem papel`: com o papel apagado, devolve 200 e `papeis: []`.
  - `inativo nao entra`: com `usuario.ativo = false`, o sign-in não devolve cookie de sessão.
  - `admin com email repetido`: lança o erro acima.
  - `criar admin fica na auditoria`: há linhas de `insert` para `militar`, `usuario` e `papel_usuario`, e nenhuma para `conta`.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar. Se a versão instalada do Better Auth tiver outro nome para alguma opção, seguir a documentação dela, mantendo os mesmos nomes de coluna.
- [ ] **Passo 4:** PASS.
- [ ] **Passo 5: Commit.** `git commit -m "Fase 1: login por e-mail e senha, /api/eu e criação do administrador"`.

---

### Task 9: Site — login e casca das telas

**Files:**
- Create: `apps/web/` (Vite React TS), `apps/web/src/estilo.css` (Tailwind e tokens), `apps/web/src/api/eu.ts`, `apps/web/src/auth-cliente.ts`
- Create: rotas TanStack Router baseadas em arquivo, `apps/web/src/routes/`: `__root.tsx`, `entrar.tsx`, `_app.tsx`, `_app/index.tsx`
- Create: `apps/web/src/componentes/Trilho.tsx` (barra lateral), `apps/web/src/componentes/Topo.tsx`
- Test: `apps/web/src/__testes__/entrar.test.tsx`, `apps/web/src/__testes__/casca.test.tsx`

**Interfaces:**
- Consumes: `GET /api/eu` (tipo `Eu` da tarefa 8, copiado em `apps/web/src/api/eu.ts`), e o Better Auth em `/api/auth`.
- Produces:
  - `buscarEu(): Promise<Eu | null>` (401 → null);
  - `authCliente = createAuthClient()` de `better-auth/react`, com o `basePath` padrão `/api/auth`.
- Rotas:
  - `/entrar`;
  - `_app`, com `beforeLoad` que chama `queryClient.ensureQueryData({ queryKey: ['eu'], queryFn: buscarEu })` e redireciona para `/entrar` se o resultado for null;
  - `/`, que é a Grade geral vazia.
- Tokens: vinho `#8E1B1B`, fundo `#EDEFF2`, superfície `#FFFFFF`, tinta `#1C2430` e apagado `#5B6675`, todos em `@theme`. Fontes Barlow e Barlow Semi Condensed via `@fontsource`, sem Google Fonts, para funcionar no servidor do Estado.
- Textos:
  - Tela de entrar:
    - título "Escalas 2º GB";
    - campos "E-mail" e "Senha";
    - botão "Entrar";
    - erro "E-mail ou senha incorretos.";
    - erro de rede "Não foi possível falar com o servidor. Tente de novo.".
  - Barra lateral, nos blocos da especificação de telas:
    - Grade geral · Escala do mês · Efetivo do dia;
    - Voluntariado · Cotas;
    - Militares · Serviços · Guarnições · Escalas · Feriados;
    - no pé: Configurações · Estrutura · Histórico · Ajuda.

    Só "Grade geral" fica ativa; as demais aparecem desabilitadas.
  - Topo: caminho fixo "CBMPE › DGO › DInter/1 › 2º GB › 1ª SB" e um menu com posto e nome de guerra, com a opção "Sair".
  - Grade geral vazia: título "Grade geral" e o texto "A grade aparece aqui quando houver uma escala cadastrada."
- Desenvolvimento: o proxy do Vite manda `/api` para `http://localhost:8787`. Scripts `dev`, `build`, `test` (Vitest + jsdom + Testing Library) e `typecheck`.

- [ ] **Passo 1: Testes, com `fetch` simulado.**
  - `entrar mostra erro com senha errada`: com 401 do sign-in, aparece "E-mail ou senha incorretos.".
  - `sem sessao vai para entrar`: com `buscarEu` devolvendo null, a rota `/` vai para `/entrar`.
  - `casca mostra o militar`: com um `Eu` de exemplo, o topo mostra "SD BM Andrade" e a barra lateral tem "Grade geral" ativa e "Escala do mês" desabilitada.
- [ ] **Passo 2:** FAIL.
- [ ] **Passo 3:** implementar, com componentes shadcn `button`, `input`, `label`, `card` e `dropdown-menu`.
- [ ] **Passo 4:** PASS, mais `pnpm --filter web typecheck` e `pnpm --filter web build`.
- [ ] **Passo 5: Conferência visual.** Com `pnpm dev`, rodar `pnpm --filter api carga-exemplo` e `criar-admin` no PGlite local. Entrar em `http://localhost:5173` e conferir, com capturas de tela se o ambiente permitir:
  - a tela de entrar e a casca, em 1280 px e em 375 px;
  - em 375 px, a barra lateral recolhe num botão de menu;
  - o foco aparece no teclado;
  - "Sair" volta para `/entrar`.
- [ ] **Passo 6: Commit.** `git commit -m "Fase 1: site com login e casca das telas"`.

---

### Task 10: Publicação no ambiente de teste

**Files:**
- Create: `api/index.ts` (raiz), `vercel.json`, `apps/api/src/app-ambiente.ts`, `apps/api/.env.exemplo`
- Test: `apps/api/test/app-ambiente.test.ts`

**Interfaces:**
- Produces: `export function criarAppDoAmbiente(env: Record<string, string | undefined>): Hono`.
  - Com `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`: `criarApp` com `bancoPg`, auth e `cronSecret = env.CRON_SECRET`.
  - Sem `DATABASE_URL`: um app em que `/api/saude` responde 200 e qualquer outra rota `/api/*` responde `503 {"erro":"Ambiente sem banco configurado"}`. É o caso das prévias.
- `api/index.ts`: `export default handle(criarAppDoAmbiente(process.env))`, com `handle` de `hono/vercel`, em runtime Node.
- `vercel.json`:
```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "regions": ["gru1"],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "crons": [{ "path": "/api/saude/banco", "schedule": "0 12 */3 * *" }]
}
```

- [ ] **Passo 1: Testes.**
  - `sem banco responde 503`: `/api/eu` → 503.
  - `sem banco a saude responde`: `/api/saude` → 200.
  - `com banco monta o app`: com `DATABASE_URL` de mentira, `/api/saude` → 200, sem conectar.
- [ ] **Passo 2:** FAIL. **Passo 3:** implementar. **Passo 4:** PASS. Fazer commit e push, e conferir o CI verde.
- [ ] **Passo 5 (usuário, com ajuda): Supabase.**
  - Criar o projeto `escalas-2gb-teste` na região South America (São Paulo).
  - Copiar a conexão do *Transaction pooler* (porta 6543).
  - Gerar `BETTER_AUTH_SECRET` e `CRON_SECRET` com `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`.
  - Guardar tudo em `apps/api/.env.teste`, que fica fora do Git.
- [ ] **Passo 6 (usuário): migrar e criar o administrador no teste.** Com as variáveis do `.env.teste`, rodar `pnpm --filter api db:migrar`. Esperado: `0001` a `0007` aplicadas. Depois, `pnpm --filter api criar-admin -- ...` com os dados reais do usuário. **Não** rodar a carga de exemplo (com `AMBIENTE=teste` ela recusa).
- [ ] **Passo 7 (usuário, com ajuda): Vercel.**
  - Importar o repositório `kuminho-br/escalas-2gb`, com framework "Other", raiz do repositório e Node 24.
  - Variáveis **só em Production**:
    - `DATABASE_URL`;
    - `BETTER_AUTH_SECRET`;
    - `BETTER_AUTH_URL=https://<projeto>.vercel.app`;
    - `CRON_SECRET`;
    - `AMBIENTE=teste`.
  - Publicar a partir da `main` depois do merge do PR da fase 1, com a anuência do usuário.
- [ ] **Passo 8: Conferência da entrega.**
  - `curl https://<projeto>.vercel.app/api/saude` → `{"ok":true}`.
  - `curl -H "Authorization: Bearer $CRON_SECRET" .../api/saude/banco` → `"banco":"ok"`; sem o cabeçalho → 401.
  - No navegador: entrar com o administrador, ver a casca vazia e sair.
  - No SQL Editor do Supabase:
    - `select tabela, acao, usuario_id from auditoria order by id desc limit 10` mostra a criação do administrador;
    - `update militar set nome_guerra = nome_guerra where matricula = '<do admin>'` gera uma linha nova de `update`.
  - Na prévia de uma branch qualquer, `/api/eu` → 503.
- [ ] **Passo 9: PR da fase 1.** `gh pr create` de `fase1-fundacao` para a `main`, com o resumo e os passos de conferência. O merge é do usuário.

---

## Fora deste plano

- Convite de usuários por e-mail e telas de usuários: fase 3.
- Cópia semanal criptografada do banco (D2/D7): fase 3, antes da primeira carga de dados reais.
- `pacotes/dominio` e `casos/`, incluindo a troca da matrícula real nos testes: fase 2.
- Papel de banco dedicado sem `update`/`delete` em `auditoria`: fase 7.
- Serviço de PDF (Gotenberg): fase 4.
