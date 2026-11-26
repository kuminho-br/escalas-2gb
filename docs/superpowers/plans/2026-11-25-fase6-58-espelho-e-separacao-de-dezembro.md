# O espelho do banco e a separação dos dados de teste (6.58) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o banco ganha uma área à parte, o **espelho** (schema `laboratorio`), com a mesma estrutura do real e só dados de teste; os militares fictícios (`990…`) e tudo o que for de teste saem do banco real e vão para o espelho, **antes da montagem das escalas de dezembro**.

**Architecture:** o executor de migrações (`apps/api/src/banco/migrar.ts`) passa a aplicar cada arquivo `.sql` duas vezes, uma em cada schema, cada um com o seu registro de migrações aplicadas. Assim a estrutura do espelho é igual à do real **por construção** (mesmos arquivos, mesma ordem, inclusive gatilhos, funções e chaves), e nenhuma migração vale só de um lado. Um papel de banco `laboratorio_app`, sem acesso às tabelas do real, é o que a API vai assumir ao falar com o espelho (6.59): o isolamento é do banco, não só do código. Um script (`separar-teste`) lista, leva ao espelho e tira do real os registros de teste.

**Tech Stack:** Postgres (Supabase) e PGlite nos testes, `pg`, Kysely, Vitest.

**Spec:** `docs/ideias/laboratorio.md` (requisitos fechados com o usuário em 25/11/2026). Decisões do usuário: espelho no mesmo banco; estrutura sempre igual à do real; dados de dezembro reais e separados dos de teste. Este é o primeiro de três planos: 6.58 (este), 6.59 (entrar no Laboratório), 6.60 (ferramentas e retorno).

## Global Constraints

- Branch `fase6-58-espelho-e-separacao`, a partir da `main`. **Esta entrega tem a única parte com prazo da ideia: a separação precisa estar aplicada no banco de teste antes de começar a montagem de dezembro.**
- **Migração e limpeza no banco de teste só com autorização explícita do usuário, cada uma.** O executor passa a criar o schema `laboratorio` e a repetir as migrações 0001 a 0046 nele na primeira execução: isso é uma migração, e o PR **não** deve ser mesclado pelo roteiro automático (`mesclar-e-migrar.sh`) sem essa autorização. A limpeza (`--aplicar`) é um passo à parte, depois da conferência da lista.
- **O real nunca recebe dado de teste, e o espelho nunca recebe dado real:** a carga do espelho usa só a carga fictícia (`apps/api/src/carga/exemplo.ts`); não há cópia de registros do real para o espelho, nem anonimizada.
- **Estrutura igual:** todo arquivo de migração vale para os dois schemas, no mesmo passo. Não existe migração só de um lado. Cada arquivo continua numa transação por schema.
- **Nome do schema:** `laboratorio`. O schema do real continua o `public`; as extensões (`ltree`, `btree_gist`) continuam no `public`.
- **Papel de banco `laboratorio_app`:** sem privilégio algum sobre as tabelas do `public`; todos os privilégios sobre as do `laboratorio`; uso do schema `public` só para os tipos e operadores das extensões (`ltree`, `btree_gist`). O usuário que conecta recebe o direito de assumi-lo (`grant laboratorio_app to current_user`).
- **Usuários de teste:** o espelho tem, na carga, um usuário por nível de acesso, já lotado e com o nível dado: "Administrador de teste", "Gestor de teste", "Quinto nível de teste", "Auxiliar administrativo de teste" e "Militar de teste" (militar comum). Nomes, matrículas `990xxx-x` fictícias, sem senha (ninguém entra com eles: a 6.59 injeta a sessão). Os níveis de acesso são os que o sistema já tem; ler `apps/api/src/acesso.ts`.
- Nenhum dado pessoal real em repositório, teste ou CI. Nunca ler nem imprimir `.env*`.
- Antes de enviar: `pnpm test && pnpm typecheck`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Primeira execução em banco que já tem as 46 migrações no `public`:** o executor cria o `laboratorio` e aplica as 46 lá, sem mexer em nada do `public`; uma segunda execução não aplica nada (Task 1).
2. **Migração nova:** um arquivo `.sql` novo entra nos dois schemas, e se falhar no espelho a transação desse arquivo naquele schema volta atrás sem sujar o outro (Task 1).
3. **Papel sem acesso ao real:** com `set local role laboratorio_app`, `select` em tabela do `public` é negado e em tabela do `laboratorio` funciona (Task 2). Se o PGlite não aplicar permissões de papel, a prova roda como verificação contra o banco de teste remoto, só leitura, e o teste automático confere a definição dos privilégios (`has_table_privilege`).
4. **Limpeza que esbarra na auditoria:** a auditoria é imutável (`auditoria_imutavel`); a limpeza não pode ficar pela metade nem tentar apagá-la (Task 3).
5. **Limpeza repetida:** rodar `--aplicar` duas vezes não faz mal e a segunda não encontra nada (Task 3).

---

### Task 1: as migrações valem para os dois schemas

**Files:** Modify `apps/api/src/banco/migrar.ts`, `apps/api/scripts/migrar.ts`, `apps/api/src/banco/pglite.ts` (se criar o banco de testes); Test `apps/api/test/migrar-espelho.test.ts`

**Interfaces (Produces):**
- `export const SCHEMA_ESPELHO = 'laboratorio'`.
- `migrar(banco: Banco, pasta?: string): Promise<string[]>` continua devolvendo os arquivos aplicados **no real** (compatível com os chamadores de hoje) e passa a aplicar também no espelho. Novo: `migrarEspelho(banco, pasta?): Promise<string[]>`, chamada por `migrar`, que cria o schema se não existir e aplica os arquivos pendentes dele, com `migracao_aplicada` própria dentro do `laboratorio`. Cada arquivo roda numa transação com `set local search_path to laboratorio, public`.
- `estruturaDoSchema(c: Consulta, schema: string): Promise<{ tabelas: string[]; colunas: string[]; gatilhos: string[] }>`, ordenadas, usada pelo teste de estrutura (e pela 6.59).

- [ ] **Step 1: testes (`migrar-espelho.test.ts`):** (a) banco novo: depois de `migrar`, `estruturaDoSchema` do `public` e do `laboratorio` são **iguais** (tabelas, colunas com tipo e nulidade, gatilhos), exceto `migracao_aplicada`; (b) segunda execução: devolve `[]` e nada muda; (c) banco que já tem o `public` migrado (simule aplicando as migrações só no `public` e apagando o schema): `migrar` cria o espelho sem tocar nas linhas do `public`; (d) pasta de migrações temporária com um `.sql` novo (`create table zz_prova (id int)`) aparece nos dois; (e) um `.sql` que falha no espelho (por exemplo, referência inexistente só lá) desfaz aquele arquivo no espelho e não deixa a tabela pela metade; (f) uma migração que usa `ltree` funciona no espelho (o `search_path` inclui o `public`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Cuidados a conferir nas migrações existentes, que rodam sem schema escrito: nada pode estar escrito como `public.…`; `create extension if not exists` é inofensivo na segunda vez; funções e gatilhos criados sem schema caem no primeiro do `search_path`, o `laboratorio`. Se alguma das 46 não rodar no espelho, **parar e relatar**, não adaptar a migração. **Step 4:** PASS. **Step 5:** commit `Fase 6.58: as migrações valem para o real e para o espelho`.

### Task 2: o papel do espelho e a carga de teste

**Files:** Create `apps/api/src/laboratorio/espelho.ts`; Modify `apps/api/src/banco/migrar.ts` (criar o papel e conceder os privilégios depois de migrar o espelho), `apps/api/src/carga/exemplo.ts`, `apps/api/scripts/carga-exemplo.ts`; Test `apps/api/test/espelho.test.ts`

**Interfaces (Produces):**
- `prepararPapelDoEspelho(c: Consulta): Promise<void>`: cria `laboratorio_app` se não existir, `revoke all` no `public`, `grant usage` no `public` e `grant all` no `laboratorio` (tabelas, sequências, funções), `alter default privileges` para o que as próximas migrações criarem no `laboratorio`. Idempotente; chamada ao fim de `migrar`.
- `cargaDoEspelho(banco: Banco, mes: string): Promise<{ militares: number; perfis: number }>`: roda a carga fictícia **no espelho** (por `set local search_path to laboratorio, public`) e cria os cinco usuários de teste. Recusa se o schema alvo não for o espelho (a carga fictícia continua proibida no `public`).
- `perfisDeTeste(c: Consulta): Promise<{ usuarioId: string; nome: string; nivel: string }[]>`: lê do espelho os usuários de teste com o nível (usada pela 6.59).
- `motivoParaRecusarExemplo` ganha a regra do espelho: no ambiente de teste, a carga só roda se for no schema `laboratorio`.

- [ ] **Step 1: testes (`espelho.test.ts`):** (a) `cargaDoEspelho` põe 53 militares `990…` e os 5 perfis no `laboratorio` e **nenhum registro novo no `public`**; (b) `perfisDeTeste` devolve os 5, cada um com o seu nível, e o administrador de teste é administrador na raiz **do espelho**; (c) a carga recusa rodar com o schema `public`; (d) com `set local role laboratorio_app`: `select` em `laboratorio.militar` funciona e em `public.militar` é negado (Review Focus 3); (e) tabela criada por migração nova depois do papel já nasce acessível ao papel (privilégio padrão); (f) a carga é repetível sobre o espelho vazio.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. A carga reaproveita `cargaExemplo`; os perfis são linhas de usuário, lotação e nível de acesso do **espelho**, criadas pelo mesmo caminho que a carga já usa para os papéis. **Step 4:** PASS. **Step 5:** commit `Fase 6.58: o papel do espelho e a carga de teste`.

### Task 3: tirar o teste do banco real

**Files:** Create `apps/api/scripts/separar-teste.ts`, `apps/api/src/laboratorio/separar.ts`; Test `apps/api/test/separar-teste.test.ts`

**Interfaces (Produces):**
- `listarRegistrosDeTeste(c: Consulta): Promise<{ tabela: string; quantidade: number }[]>`: no `public`, o que é de teste: militares com matrícula `990…`, e tudo o que depende deles (lotação, rastreio, afastamentos, alocações, voluntariado, vínculos de escala, contas e níveis de acesso ligados a eles), mais contas de usuário cujo militar é de teste. A ordem de tabela segue as dependências.
- `removerRegistrosDeTeste(banco: Banco): Promise<{ tabela: string; removidos: number }[]>`: tira do `public`, numa transação só, na ordem das dependências. **Não** toca em `auditoria` (imutável): as linhas dela que citam os militares removidos ficam (só carregam dados fictícios) e a limpeza as conta à parte no relatório.
- Script `pnpm --filter api separar-teste`: por padrão **só lista** (nada é apagado) e termina com o resumo; `--aplicar` remove. Sempre imprime a lista antes. Não imprime dado pessoal (só tabela e contagem, e as matrículas `990…`). Recusa rodar sem `DATABASE_URL`.
- Depois da limpeza, imprime a conferência: a contagem de matrículas `990…` no `public` (deve ser 0).

- [ ] **Step 1: testes (`separar-teste.test.ts`):** banco com 53 militares `990…` e 3 militares de matrícula real fictícia (`880xxx-x`, para parecer real) com lotação, escala e voluntariado: `listarRegistrosDeTeste` conta só os de teste e o que depende deles; `removerRegistrosDeTeste` deixa o `public` **sem nenhuma `990…`** e os três militares intactos, com tudo o que era deles (Review Focus 5 dos dados de dezembro); a auditoria não é apagada nem faz a transação falhar (Review Focus 4); segunda chamada não encontra nada (Review Focus 5); se uma exclusão falha no meio, nada fica pela metade; o script sem `--aplicar` não muda uma linha.
- [ ] **Step 2:** FAIL. **Step 3:** implementar sobre as chaves estrangeiras do próprio banco (ler `information_schema`/`pg_constraint` para a ordem, em vez de listar tabela por tabela à mão, para não esquecer tabela criada depois). **Step 4:** PASS. **Step 5:** commit `Fase 6.58: tirar os registros de teste do banco real`.

### Task 4: fechamento

**Files:** só o texto que já existir sobre como migrar, se houver (a frase passa a dizer: "as migrações valem para o real e para o espelho").

- [ ] **Step 1:** `pnpm test && pnpm typecheck` (a entrega mexe só na API; `pnpm build:vercel` só se tocar o que a Vercel empacota). **Step 2:** conferir no banco de teste **só depois de autorizado pelo usuário, e só leitura**: `separar-teste` sem `--aplicar`; relatar a lista à PLANEJAMENTO. **Step 3:** commit `Fase 6.58: fechamento` e enviar a branch à PLANEJAMENTO com o resumo e a lista da conferência. **Não** rodar a migração nem `--aplicar` no banco de teste.
