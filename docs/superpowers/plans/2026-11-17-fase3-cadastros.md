# Fase 3 — Cadastros: plano de implementação

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** todos os cadastros da 1ª SB editáveis no sistema novo, com importação da planilha sandbox, para a entrega "cadastros conferidos no sistema novo, iguais aos da sandbox".

**Arquitetura:** um cadastro por vez (opção A), cada um com API (Hono), tela (React) e importação (.xlsx enviado na tela). Os contratos de entrada e saída ficam num pacote compartilhado (`pacotes/contratos`, zod) usado pela API para validar e pelo site para tipar. Toda gravação passa por `comUsuario`, para a auditoria registrar quem fez. A importação é sem estado: a prévia e a confirmação recebem o mesmo arquivo, e a confirmação refaz o plano antes de gravar.

**Tecnologia:** Hono 4, Postgres (PGlite nos testes), zod 4, ExcelJS 4.4, React 19, TanStack Router/Query, Tailwind + shadcn/ui, Vitest 5.

**Especificação:** `docs/superpowers/specs/2026-11-16-migracao-design.md` (adendo "Cadastros (fase 3)", D7), `docs/superpowers/specs/2026-11-16-esquema-banco.md`, `docs/superpowers/specs/2026-11-16-telas.md` (seções "Cadastros" e "Configurações").

## Restrições globais

- **D7:** nenhum dado pessoal real no repositório, na CI ou nos testes. Matrículas de teste no formato `990xxx-x`, nomes fictícios. Planilhas de teste são montadas com ExcelJS dentro do próprio teste.
- **Gravação:** toda escrita roda dentro de `comUsuario(banco, usuarioId, tx => …)` (`apps/api/src/banco/banco.ts`).
- **Migrações:** arquivos novos numerados (`0009_…`). Nunca se edita uma migração já aplicada. Tabela nova recebe o gatilho `auditoria_registro` na mesma migração.
- **Migração no ambiente de teste:** o deploy não aplica migrações. Todo PR com migração nova diz, no texto, "depois do merge, rodar `pnpm --filter api db:migrar:teste`" (o modelo de PR já traz a caixa). Enquanto faltar, a API responde 503 com a mensagem "banco desatualizado", e o site a mostra.
- **Vigência (RN-93):** mês sempre no dia 1. A API recusa criar ou editar versão com vigência anterior ao mês corrente (`hojeRecife()`). A importação pode gravar vigências passadas, porque é carga histórica.
- **Atores e permissões (adendo do design, "Atores"):**
  - Papéis: `escalante`, `gestor` (antigo `chefe`) e `administrador` (só na raiz).
  - O usuário sem papel vigente é **militar comum**: entra no site, mas recebe 403 em todo cadastro, até na leitura.
  - Para ler ou escrever um cadastro da unidade U, é preciso papel `escalante`, `gestor` ou `administrador` vigente em U ou numa unidade acima.
  - Parâmetros exigem `gestor` ou `administrador`.
  - Catálogos do sistema (tipos de afastamento, atividades) exigem `administrador`. Para eles, ler basta qualquer um dos três papéis.
- **Unidade da fase de teste:** fixa na 1ª SB. A API expõe a unidade em `GET /api/eu` (`unidade`), e o site não escreve sigla nem caminho fixos.
- **Respostas de erro:** `{ erro: string, campos?: Record<string, string> }`. Os códigos são 400 (entrada inválida), 401, 403, 404 e 409 (conflito com o banco). A mensagem diz o que fazer.
- **Textos de tela:** em português, sem jargão e sem siglas internas (RN-xx, Q17). Os botões dizem a ação ("Salvar a partir de dezembro", "Importar 48, pular 2").
- **O escalante nunca é bloqueado:** linha com problema na importação é pulada e o resto entra.
- **Testes:** API com `bancoDeTeste()` (PGlite em memória). Site com `simularApi`. Vitest com `maxWorkers: 2`. O comando da suíte é `pnpm test`, e o typecheck é `pnpm typecheck`.
- **Commits:** em português, no estilo `Fase 3: <o quê>`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PRs:** um por entrega, com o merge só após a anuência do usuário. O executor para ao fim de cada entrega, depois de abrir o PR.

## Foco da revisão

1. **Importar o mesmo arquivo duas vezes:** a segunda prévia mostra tudo como "igual", e a confirmação não grava nada (nem auditoria).
2. **Vigência passada na tela:** "Salvar a partir de" com um mês anterior ao corrente devolve 409 com o mês mínimo na mensagem; o mês corrente substitui a versão existente sem criar outra.
3. **Conflitos do banco:** afastamento sobreposto, nome repetido ou turno em uso devolvem 409 com uma frase legível, nunca 500 nem o texto do Postgres.
4. **Turnos que atravessam a meia-noite e de 24h:** a duração e o "Pede voluntariado em" saem certos para `16:00–00:00`, `00:00–08:00`, `08:00–08:00` e `20:00–20:00`.
5. **Usuário sem papel na unidade:** recebe 403 em toda escrita, e quem tem papel deixa o próprio `usuario_id` na auditoria.

Cada item tem teste na tarefa dona do código (marcado com **[foco]**).

## Mapa de arquivos

```
pacotes/contratos/             # novo: esquemas zod + tipos, sem dependência de banco nem tela
  src/index.ts, src/comum.ts, src/configuracoes.ts, src/militares.ts,
  src/guarnicoes.ts, src/servicos.ts, src/escalas.ts, src/cotas-feriados.ts, src/importacao.ts
pacotes/dominio/src/voluntariado.ts   # turnosPadraoExigidos (regra nova, só do sistema novo)
apps/api/banco/migracoes/0009_cadastros.sql
apps/api/src/
  acesso.ts            # sessão, papéis, unidade de um registro
  erros.ts             # erro do banco -> 409 legível; corpo inválido -> 400
  unidade-atual.ts     # unidade fixa da fase de teste
  cadastros/<cadastro>.ts   # rotas de cada cadastro
  importacao/planilha.ts, importacao/rotas.ts, importacao/tipos.ts, importacao/<cadastro>.ts
apps/api/test/apoio-api.ts  # app com banco, usuários de teste e pedir()
apps/web/src/
  api/cliente.ts, api/<cadastro>.ts
  componentes/ListaDetalhe.tsx, componentes/ImportarPlanilha.tsx, componentes/ui/* (shadcn)
  routes/_app/{configuracoes,militares,guarnicoes,servicos,escalas,feriados,cotas}…
```

---

# Entrega 1 — Base, Configurações e tipos de afastamento

Branch `fase3-1-configuracoes`, a partir da `main`.

### Task 1: Migração dos cadastros

**Arquivos:**
- Criar: `apps/api/banco/migracoes/0009_cadastros.sql`
- Criar: `apps/api/test/esquema-cadastros.test.ts`
- Modificar: `apps/api/test/auditoria.test.ts:93`, `apps/api/test/esquema-estrutura.test.ts:63` (afastamento passa a usar `tipo_afastamento_id`)

**Interfaces:**
- Produz: as tabelas `tipo_afastamento(id, nome, ativo)` e `atividade(id, nome, ativo)`, as colunas `afastamento.tipo_afastamento_id` (not null), `guarnicao.atividade_id` (null) e `feriado.fixo` (not null default true), e sai a coluna `afastamento.tipo`. O papel `chefe` vira `gestor` em `papel_usuario` e `convite` (dados e check), e um gatilho em `papel_usuario` só aceita `administrador` na unidade raiz.

- [ ] **Passo 1: testes que falham** em `esquema-cadastros.test.ts`:

```ts
it('tipos de afastamento iniciais', async () => {
  const { rows } = await banco.query<{ nome: string }>('select nome from tipo_afastamento');
  expect(rows.map((r) => r.nome).sort()).toEqual(['Curso', 'Férias', 'LTS', 'Outro']);
});
it('atividades iniciais', async () => { /* ['APH', 'Apoio operacional', 'Incêndio', 'Salvamento'] */ });
it('nome repetido sem diferenciar maiúsculas', async () => {
  await expect(inserir(banco, 'tipo_afastamento', { nome: 'férias' })).rejects.toThrow();
});
it('afastamento exige tipo', async () => { /* insert sem tipo_afastamento_id rejeita */ });
it('feriado é fixo por padrão', async () => { /* fixo = true */ });
it('papel gestor existe e chefe não', async () => { /* insert papel 'gestor' ok; 'chefe' rejeita */ });
it('administrador só na raiz', async () => {
  // papel 'administrador' na 1ª SB rejeita com 'O papel de administrador só existe na unidade raiz'
});
it('tabelas novas entram na auditoria', async () => {
  const id = await inserir(banco, 'atividade', { nome: 'Mergulho' });
  // auditoria tem (tabela 'atividade', registro_id id, acao 'insert')
});
```

- [ ] **Passo 2:** rodar `pnpm --filter api exec vitest run test/esquema-cadastros.test.ts`. Esperado: FALHA (tabela inexistente).
- [ ] **Passo 3: escrever a migração.**
  - Criar as tabelas, com unicidade por `lower(nome)` e os dados iniciais.
  - Converter o afastamento: adicionar a coluna nula, mapear `ferias→Férias`, `licenca→LTS` e `outro→Outro`, tornar `not null` e apagar `tipo`.
  - Criar `guarnicao.atividade_id` e `feriado.fixo`.
  - Ligar o gatilho `auditoria_registro` em `tipo_afastamento` e `atividade`.
  - Ajustar os dois testes antigos para buscar o id de Férias.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: migração dos cadastros (tipos de afastamento, atividades, feriado fixo)`.

### Task 2: Pacote de contratos

**Arquivos:**
- Criar: `pacotes/contratos/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/comum.ts,src/configuracoes.ts}`
- Criar: `pacotes/contratos/test/comum.test.ts`
- Modificar: `apps/api/package.json`, `apps/web/package.json` (dependência `"contratos": "workspace:*"`)

**Interfaces:**
- Produz (`comum.ts`):
  - `Mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)`
  - `Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
  - `Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)`
  - `Matricula = z.string().regex(/^\d{6}-\d$/)`
  - `Nome = z.string().trim().min(1).max(120)`
  - `type ErroApi = { erro: string; campos?: Record<string, string> }`
  - `mesParaData(mes: string): string` ('2026-12' → '2026-12-01')
- Produz (`configuracoes.ts`):
  - `ItemCatalogo = { id: string; nome: string; ativo: boolean }`
  - `NovoItemCatalogo = z.object({ nome: Nome })`
  - `EdicaoItemCatalogo = z.object({ nome: Nome.optional(), ativo: z.boolean().optional() })`
  - `NovoParametro = z.object({ chave: z.string(), valor: z.string(), vigencia: Mes, normaReferencia: z.string().trim().max(200).optional() })`
  - `Parametro = { chave, rotulo, descricao, tipo, valor: number|string|boolean, vigencia: string, normaReferencia: string|null, origem: 'padrao'|'propria'|'herdada', unidadeSigla: string|null, historico: { vigencia: string; valor: unknown; normaReferencia: string|null; unidadeSigla: string }[] }`

O pacote segue o modelo de `pacotes/dominio`: `exports: ./src/index.ts`, sem dependência de `node:*` e com zod `^4` como única dependência.

- [ ] **Passo 1: teste que falha.** `Mes.safeParse('2026-13').success === false`, `Hora.safeParse('24:00').success === false`, `Matricula.safeParse('1234567').success === false` e `mesParaData('2026-12') === '2026-12-01'`.
- [ ] **Passo 2:** `pnpm --filter contratos test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar e `pnpm install`.
- [ ] **Passo 4:** `pnpm --filter contratos test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: pacote de contratos compartilhado`.

### Task 3: Base da API (acesso, erros, unidade atual)

**Arquivos:**
- Criar: `apps/api/src/acesso.ts`, `apps/api/src/erros.ts`, `apps/api/src/unidade-atual.ts`, `apps/api/test/apoio-api.ts`, `apps/api/test/acesso.test.ts`
- Modificar: `apps/api/src/app.ts`, `apps/api/src/rotas/eu.ts`, `apps/api/test/login.test.ts` (o `eu` ganha `unidade`)

**Interfaces:**
- Produz (`acesso.ts`):
  - `type Papel = 'administrador' | 'gestor' | 'escalante'`. O tipo também é trocado em `rotas/eu.ts` e em `apps/web/src/api/eu.ts`.
  - `exigirSessao(banco: Banco, auth: Auth): MiddlewareHandler`. Põe `c.var.usuarioId` e devolve 401 sem sessão. Sem papel, o usuário é militar comum e passa.
  - `temPapel(c: Consulta, usuarioId: string, unidadeId: string, papeis: Papel[], hoje: string): Promise<boolean>`. É verdadeiro se houver papel vigente numa unidade cujo `caminho @>` o da unidade alvo.
  - `exigirPapel(c: Context, unidadeId: string, papeis: Papel[]): Promise<Response | null>`. Devolve a resposta 403 ("Você não tem permissão para alterar os cadastros de <sigla>.") ou null.
  - `CADASTRO: Papel[] = ['escalante', 'gestor', 'administrador']`, usado para ler e escrever cadastros, e `ESCREVE_PARAMETRO: Papel[] = ['gestor', 'administrador']`.
  - As leituras de cadastro também chamam `exigirPapel(c, u, CADASTRO)`; para o militar comum, a mensagem é "Esta tela é dos escalantes e gestores.".
  - `exigirAdministradorRaiz(c: Context): Promise<Response | null>`.
  - `unidadeDoRegistro(c: Consulta, tabela: 'militar' | 'afastamento' | 'funcao' | 'guarnicao' | 'servico' | 'turno' | 'escala' | 'feriado' | 'cota', id: string): Promise<string | null>`. Para militar, é a unidade da lotação mais recente.
- Produz (`erros.ts`):
  - `lerCorpo<T>(c: Context, esquema: z.ZodType<T>): Promise<{ ok: true; dados: T } | { ok: false; resposta: Response }>`. Em caso de erro, devolve 400 com `campos` por caminho.
  - `respostaDoErroDoBanco(c: Context, e: unknown): Response`, com estes códigos:

    | Código | Situação | Mensagem (409) |
    |---|---|---|
    | 23505 | nome ou chave repetida | "Já existe um cadastro com esse nome." |
    | 23P01 | período sobreposto | "As datas se sobrepõem a outro período já cadastrado." |
    | 23503 | registro em uso | "Não dá para apagar: o cadastro já está em uso." |
    | P0001 | gatilho do banco | a mensagem do gatilho |
    | outro | — | relança o erro |
- Produz (`unidade-atual.ts`): `unidadeAtual(c: Consulta): Promise<{ id: string; sigla: string; caminho: string[] }>`. A unidade fica fixa pela sigla `'1ª SB'`, e o caminho é a lista de siglas da raiz até ela.
- Produz (`app.ts`): `criarApp` monta as rotas de cadastro em `/api` só quando há `auth`. Cada entrega acrescenta o seu `rotas<Cadastro>(dep)`.
- Produz (`test/apoio-api.ts`): `montarApi(): Promise<{ banco; app; secao: string; pedir(quem: 'admin' | 'escalante' | 'semPapel', metodo: string, caminho: string, corpo?: unknown): Promise<Response> }>`. Ele cria um admin na raiz, um escalante na 1ª SB e um usuário sem papel, todos com matrículas `9909xx-x`.

- [ ] **Passo 1: testes que falham** (`acesso.test.ts`):
  - `escalante da 1ª SB pode escrever na 1ª SB e não no 2º GB`
  - `gestor do 2º GB pode escrever na 1ª SB`
  - `militar comum entra mas não tem papel de cadastro`
  - `administrador da raiz pode tudo`
  - `papel vencido não vale`
  - `unidadeDoRegistro de militar usa a lotação mais recente`
  - `eu traz a unidade da fase de teste` (sigla `'1ª SB'`, caminho `['CBMPE','DGO','DInter/1','2º GB','1ª SB']`)
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. `exigirSessao` reaproveita a consulta de papéis de `rotas/eu.ts`. Extraia a função `papeisVigentes(c, usuarioId, hoje)` e use nos dois lugares.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: base da API (sessão, papéis, erros, unidade atual)`.

### Task 4: Base da importação

**Arquivos:**
- Criar: `apps/api/src/importacao/{planilha.ts,tipos.ts,rotas.ts}`, `pacotes/contratos/src/importacao.ts`, `apps/api/test/importacao-base.test.ts`, `apps/api/test/planilha-teste.ts`
- Modificar: `apps/api/package.json` (`exceljs ^4.4.0`), `apps/api/src/app.ts`

**Interfaces:**
- Produz (`contratos/importacao.ts`):
  - `ItemPrevia = { chave: string; descricao: string; mudancas?: string[] }`
  - `ProblemaImportacao = { aba: string; linha: number; mensagem: string; solucao: string }`
  - `Previa = { novos: ItemPrevia[]; alterados: ItemPrevia[]; iguais: number; problemas: ProblemaImportacao[]; avisos: string[] }`
  - `ResultadoImportacao = Previa & { gravados: number }`
- Produz (`planilha.ts`):
  - `type Aba = { cab: string[]; linhas: { linha: number; celulas: string[] }[] }`
  - `lerPlanilha(arquivo: ArrayBuffer): Promise<Record<string, Aba>>`. Lê o texto exibido de cada célula. Datas viram `dd/mm/aaaa` e horas viram `HH:MM`. Pula linhas vazias e numera as linhas como na planilha (cabeçalho = 1).
  - `coluna(aba: Aba, rotulo: string): number`. Compara com `normalizar` do dominio, aceita prefixo como `coluna_` do protótipo (`prototipo/matriz.js:103`) e devolve -1 se não achar.
- Produz (`tipos.ts`):
  - `interface Contexto { tx: Consulta; unidadeId: string; hoje: string }`
  - `interface Importador<P> { abas: string[]; planejar(abas: Record<string, Aba>, ctx: Contexto): Promise<{ previa: Previa; plano: P }>; aplicar(plano: P, ctx: Contexto): Promise<number> }`
- Produz (`rotas.ts`):
  - `rotasImportacao(dep, importadores: Record<string, Importador<unknown>>): Hono`
  - Rota `POST /api/unidades/:u/importacao/:cadastro`, com o arquivo no campo multipart `arquivo` e `?confirmar=1` para gravar.
  - Sem `confirmar`, a rota planeja numa transação só de leitura e devolve `Previa`. Com `confirmar`, planeja e aplica dentro de `comUsuario` e devolve `ResultadoImportacao`.
  - Exige `CADASTRO` na unidade. Cadastro desconhecido devolve 404. Falta de uma aba exigida devolve 400 "A planilha não tem a aba "X". Baixe a sandbox inteira em .xlsx (Arquivo › Fazer download)."
- Produz (`test/planilha-teste.ts`): `planilha(abas: Record<string, (string | number)[][]>): Promise<ArrayBuffer>`, que monta o .xlsx com ExcelJS.

- [ ] **Passo 1: testes que falham**, com um importador falso registrado só no teste:
  - `prévia não grava`: depois da prévia, a contagem da auditoria não muda.
  - `confirmar grava e devolve gravados`
  - `aba que falta vira 400 com a instrução`
  - `cadastro desconhecido é 404`
  - `sem papel é 403`
  - `lerPlanilha lê data e hora como texto` (célula `Date` → `'01/12/2026'`; `'08:00'` fica `'08:00'`).
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. Use `c.req.parseBody()` para o multipart.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: base da importação da planilha`.

### Task 5: Base do site

**Arquivos:**
- Criar: `apps/web/src/api/cliente.ts`, `apps/web/src/componentes/ListaDetalhe.tsx`, `apps/web/src/componentes/ImportarPlanilha.tsx`, `apps/web/src/__testes__/importar.test.tsx`
- Criar com o shadcn CLI: `dialog`, `select`, `checkbox`, `tabs`, `badge`, `table`, `textarea` em `componentes/ui`
- Modificar: `apps/web/src/__testes__/apoio.tsx`, `apps/web/src/api/eu.ts` (`unidade`), `apps/web/src/componentes/Topo.tsx` (caminho vindo do `eu`), `apps/web/src/componentes/Trilho.tsx` (`para` aceita as rotas novas; cada entrega liga o seu item)

**Interfaces:**
- Produz (`cliente.ts`):
  - `class ErroApi extends Error { status: number; campos?: Record<string, string> }`
  - `pedir<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<T>`. Falha de rede vira "Sem conexão com o servidor. Tente de novo.". Uma resposta não-ok vira `ErroApi` com o `erro` do corpo.
  - `enviarArquivo<T>(caminho: string, arquivo: File): Promise<T>`
- Produz (`apoio.tsx`):
  - `simularApi(rotas)`: a chave pode ser `'/api/x'` (qualquer método) ou `'POST /api/x'`. A busca usa o caminho sem a query. Devolve o `vi.fn` para conferir o corpo enviado.
  - `EU_EXEMPLO.unidade = { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'] }`
- Produz (`ListaDetalhe.tsx`): `ListaDetalhe({ titulo, acoes, lista, detalhe })`. Lista à esquerda e detalhe à direita. No celular, o detalhe ocupa a tela quando há item escolhido.
- Produz (`ImportarPlanilha.tsx`): `ImportarPlanilha({ cadastro: string; rotulo: string; aoConcluir(): void })`.
  - É um botão "Importar da planilha" que abre um diálogo de três passos: escolher o .xlsx, ver a prévia e importar.
  - A prévia mostra os números de novos, alterados e iguais, e a lista de problemas com a solução.
  - O botão de confirmação diz "Importar N, pular M". Ao terminar, mostra "N registros gravados" e chama `aoConcluir`.

- [ ] **Passo 1: testes que falham** (`importar.test.tsx`):
  - `mostra a prévia e o botão com as contas`: simula a resposta de prévia com 2 novos e 1 problema, e espera o texto "Importar 2, pular 1" e a solução do problema.
  - `confirmar envia confirmar=1`
  - `erro da API aparece no diálogo`
  - O teste antigo `casca mostra o militar` continua passando, agora com o caminho vindo do `eu`.
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: base do site (cliente da API, lista e detalhe, importar planilha)`.

### Task 6: API de Configurações

**Arquivos:**
- Criar: `apps/api/src/cadastros/configuracoes.ts`, `apps/api/test/configuracoes.test.ts`
- Modificar: `apps/api/src/app.ts`

**Interfaces:**
- Consome: `ItemCatalogo`, `NovoItemCatalogo`, `EdicaoItemCatalogo`, `NovoParametro` e `Parametro` (Tarefa 2); `paramDef`, `paramConverter` e `PARAM_CATALOGO` do `dominio`.
- Produz (rotas):
  - `GET|POST /api/sistema/tipos-afastamento` e `PATCH /api/sistema/tipos-afastamento/:id`
  - O mesmo para `/api/sistema/atividades`
  - `GET /api/unidades/:u/parametros?mes=aaaa-mm` → `Parametro[]`
  - `POST /api/unidades/:u/parametros` (`NovoParametro`)
- Produz (constante): `CHAVES_SISTEMA = ['CARGA_MENSAL_HORAS', 'SALDOS_ADM_POR_MILITAR', 'ADM_CUMPRE_CARGA', 'LINHAS_POR_MILITAR']`. `SECAO_PADRAO` sai (esquema, `parametro`).
- Regras:
  - O valor em vigor vem da unidade mais próxima na árvore que tenha a chave, na maior vigência `<= mes`. Sem nenhuma, vale o padrão do catálogo. O `valor` é gravado como jsonb já convertido por `paramConverter`.
  - Vigência anterior ao mês corrente devolve 409 "Só dá para mudar a partir de <mês corrente por extenso>."
  - Vigência igual a uma já existente da mesma unidade substitui o valor.
  - Desativar um tipo de afastamento não apaga nada.

- [ ] **Passo 1: testes que falham:**
  - `lista os tipos e cria um novo (admin)`
  - `escalante não cria tipo (403)`
  - `renomear para nome existente é 409 legível` **[foco 3]**
  - `parâmetro sem cadastro mostra o padrão`
  - `parâmetro do 2º GB vale para a 1ª SB (herdado, com a sigla)`
  - `parâmetro com vigência passada é 409` **[foco 2]**
  - `mesma vigência substitui`
  - `valor inválido é 400 com a mensagem do catálogo` ("Use um número inteiro.")
  - `gravação deixa o usuario_id na auditoria` **[foco 5]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de configurações, tipos de afastamento e atividades`.

### Task 7: Tela de Configurações

**Arquivos:**
- Criar: `apps/web/src/api/configuracoes.ts`, `apps/web/src/routes/_app/configuracoes.tsx`, `apps/web/src/__testes__/configuracoes.test.tsx`
- Modificar: `Trilho.tsx` (liga "Configurações")

**Interfaces:**
- Consome: as rotas da Tarefa 6 e `ImportarPlanilha` (cadastro `configuracoes`).
- A tela tem três seções:
  - **Regras do processo:** tabela com valor, norma de referência e "desde", e uma marca "vem do 2º GB" quando herdado. "Mudar a partir de…" abre o formulário com valor, mês (padrão: próximo mês) e norma.
  - **Tipos de afastamento** e **Atividades:** listas com incluir, renomear e ativar/desativar. Os botões só aparecem para o administrador (`eu.papeis` tem `administrador`).

- [ ] **Passo 1: testes que falham:**
  - `mostra o valor e a origem herdada`
  - `mudar a partir de envia vigencia e norma`
  - `escalante não vê os botões dos tipos`
  - `erro 409 aparece junto do formulário`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: tela de configurações`.

### Task 8: Importação de Configurações

**Arquivos:**
- Criar: `apps/api/src/importacao/configuracoes.ts`, `apps/api/test/importacao-configuracoes.test.ts`
- Modificar: o registro de importadores em `app.ts`

**Interfaces:**
- Consome: `Importador` e `lerPlanilha` (Tarefa 4) e `paramValidarLinhas` do `dominio`.
- Regras:
  - Aba `CONFIGURAÇÕES`, com as colunas `CHAVE`, `VALOR` e `VIGÊNCIA` (por prefixo; o cabeçalho real é `VIGÊNCIA (A PARTIR DE)`).
  - Vigência vazia vira o mês de criação da unidade (`unidade.desde`).
  - `SECAO_PADRAO` gera o aviso "SECAO_PADRAO não é mais usada: o seletor de unidade substitui." e não é gravada.
  - Os avisos de `paramValidarLinhas` viram problemas com a solução "Corrija a linha na sandbox e importe de novo."
  - A chave natural é (chave, unidade, vigência). Valor diferente conta como alterado.

- [ ] **Passo 1: testes que falham:**
  - `importa as chaves e pula SECAO_PADRAO com aviso`
  - `valor inválido vira problema e o resto entra`
  - `importar duas vezes: a segunda é toda igual e não grava` **[foco 1]** (a contagem da auditoria fica igual)
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação das configurações`. Depois, abrir o PR "Fase 3 — Entrega 1: configurações e tipos de afastamento" e **parar até o merge**.
  - Antes do merge, o usuário pode conferir localmente com `pnpm --filter api dev` e `pnpm --filter web dev`.
  - Depois do merge, ele importa a aba CONFIGURAÇÕES da sandbox no ambiente de teste.

---

# Entrega 2 — Militares e afastamentos

Branch `fase3-2-militares`, a partir da `main` com a entrega 1.

### Task 9: API de Militares

**Arquivos:**
- Criar: `pacotes/contratos/src/militares.ts`, `apps/api/src/cadastros/militares.ts`, `apps/api/src/cadastros/militares-regras.ts`, `apps/api/test/militares.test.ts`, `apps/api/test/militares-regras.test.ts`

**Interfaces:**
- Produz (contratos):
  - `NovoMilitar = { matricula: Matricula; postoGradId: uuid; nomeGuerra: Nome; antiguidade: int>=1 | null; motorista: boolean; cnh: ('A'|'B'|'C'|'D'|'E')[]; voluntarioJes: boolean; lotacao: { equipeId: uuid | null; jornada: 'pronto'|'adm'; desde: Mes } }`
  - `EdicaoMilitar`: os campos de `NovoMilitar` sem `matricula` e `lotacao`, todos opcionais, mais `ativo`.
  - `NovaLotacao = { unidadeId: uuid; equipeId: uuid | null; jornada: 'pronto'|'adm'; desde: Mes }`
  - `NovoAfastamento = { tipoAfastamentoId: uuid; inicio: Data; fim: Data }`
  - `LinhaMilitar = { id; matricula; posto: string; nomeGuerra; equipe: string | null; jornada: 'pronto'|'adm'; motorista: string | null; voluntarioJes: boolean; ativo: boolean; situacao: string; pendencias: string[] }`. O campo `motorista` traz a categoria mais alta, como em "D".
  - `FichaMilitar = LinhaMilitar & { postoGradId; antiguidade; cnh: string[]; cnhPorHierarquia: string[]; lotacoes: { id; unidadeSigla; equipe; jornada; desde; ate: string | null }[]; afastamentos: { id; tipo; tipoAfastamentoId; inicio; fim }[] }`
- Produz (`militares-regras.ts`, puro):
  - `situacaoNoMes(afast: { tipo: string; inicio: string; fim: string }[], mes: string): string`. Os textos são `'Disponível'`, `'Férias até 12/12'` (termina no mês), `'LTS de 03/12 a 20/12'` (começa e termina no mês) e `'Curso desde 10/12'` (passa do mês). Mais de um período fica separado por `' · '`.
  - `pendenciasDoMilitar(m: { motorista: boolean; cnh: string[]; jornada: string | null; equipe: string | null; antiguidade: number | null }): string[]`. Os textos são `'Motorista sem categoria de CNH'`, `'Pronto sem equipe'`, `'Sem lotação'` e `'Sem antiguidade'`.
  - `categoriaMaisAlta(cnh: string[]): string | null`, na ordem E > D > C > B > A.
- Produz (rotas):
  - `GET /api/postos` (todos, em ordem de hierarquia) e `GET /api/unidades/:u/equipes`
  - `GET /api/unidades/:u/militares?mes=`: lotados em u ou abaixo no mês, ordenados por posto (`ordem` desc), antiguidade (nulos por último) e nome.
  - `POST /api/unidades/:u/militares`
  - `GET|PATCH /api/militares/:id`
  - `POST /api/militares/:id/lotacoes`: fecha a lotação aberta em `desde − 1 dia`. Um `desde` igual ou anterior ao início da lotação aberta devolve 409 "A transferência precisa ser depois de <mês>."
  - `POST /api/militares/:id/afastamentos` e `PATCH|DELETE /api/afastamentos/:id`
- A CNH só é aceita com `motorista: true`. Desmarcar o motorista limpa a CNH na mesma gravação. `cnhPorHierarquia` = `cnhHabilitadas(cnh)` do `dominio` menos as da carteira.

- [ ] **Passo 1: testes que falham:**
  - Para `militares-regras.test.ts`: os quatro textos de situação e as quatro pendências, cada um num `it` com nome igual ao texto.
  - Para `militares.test.ts`:
    - `cria militar com a primeira lotação`
    - `matrícula repetida é 409`
    - `lista do mês traz situação e pendências`
    - `transferência fecha a lotação anterior no último dia do mês`
    - `transferência antes da lotação aberta é 409`
    - `afastamento sobreposto é 409 legível` **[foco 3]**
    - `férias em duas partes no mesmo mês`
    - `desmarcar motorista limpa a CNH`
    - `ficha mostra a CNH pela hierarquia` (com D, mostra C e B)
    - `escalante de outra unidade não edita (403)` **[foco 5]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de militares, lotações e afastamentos`.

### Task 10: Tela de Militares

**Arquivos:**
- Criar: `apps/web/src/api/militares.ts`, `apps/web/src/routes/_app/militares.tsx`, `apps/web/src/routes/_app/militares/index.tsx`, `apps/web/src/routes/_app/militares/$id.tsx`, `apps/web/src/__testes__/militares.test.tsx`
- Modificar: `Trilho.tsx` (liga "Militares")

**Interfaces:**
- Consome: as rotas da Tarefa 9, `cnhHabilitadas` do `dominio` (dependência `"dominio": "workspace:*"` no site) e `ListaDetalhe`/`ImportarPlanilha` (cadastro `militares`).
- **Lista:** filtros (equipe, jornada e busca por nome ou matrícula), as colunas Motorista e "Situação no mês", e um ícone de aviso com as pendências no título.
- **Ficha (como na especificação de telas, "Ficha do militar"):**
  - identificação;
  - lotação como linha do tempo, com "Registrar transferência";
  - jornada e voluntário JES;
  - "Está no quadro de motoristas?" e cinco botões A a E. As categorias da carteira ficam escuras; as que vêm pela hierarquia ficam tracejadas, com "pela D".
  - afastamentos: tipo (só os ativos), início e fim, o atalho "Mês inteiro" (preenche do dia 1 ao último dia do mês escolhido) e "Apagar".
- O botão "Novo militar" abre o formulário com a primeira lotação.

- [ ] **Passo 1: testes que falham:**
  - `lista mostra situação e pendência`
  - `filtrar por equipe`
  - `categoria pela hierarquia aparece tracejada com "pela D"`
  - `mês inteiro preenche início e fim`
  - `afastamento sobreposto mostra a mensagem da API`
  - `novo militar envia a lotação`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: tela de militares`.

### Task 11: Importação de Militares

**Arquivos:**
- Criar: `apps/api/src/importacao/militares.ts`, `apps/api/test/importacao-militares.test.ts`

**Interfaces:**
- Consome: `categoriasCnh`, `normalizar` e `CICLO_EQUIPES` do `dominio`.
- Aba `MILITARES`, colunas `MATRÍCULA`, `NOME DE GUERRA`, `SEÇÃO`, `POSTO/GRAD`, `JORNADA`, `EQUIPE`, `ANTIG`, `MOTORISTA`, `VOLUNTÁRIO JES` e `CNH`. A leitura segue `lerMilitares_` (`prototipo/matriz.js:168`): SIM, S, X, 1 ou "MOTORISTA" contam como sim; a CNH é lida letra a letra por `categoriasCnh`.
- **Matrícula:**
  - Com 7 dígitos sem hífen, ganha o hífen e gera o aviso "Matrícula 1234567 corrigida para 123456-7".
  - Qualquer outro formato vira o problema "Matrícula inválida", com a solução "Use 6 dígitos, hífen e 1 dígito".
- **Seção:** se for diferente da unidade (pelo `normalizar` da sigla), vira o problema "Militar de outra seção", com a solução "Ele entra quando a seção dele for importada; aqui não é gravado".
- **Posto:** se não existir, vira um problema que lista as siglas válidas.
- **Jornada:** `ADM` vira `adm`; `PRONTO` vira `pronto`.
- **Equipe:** se não existir na unidade, é criada. `ordem_ciclo` segue a posição em `CICLO_EQUIPES` (ALFA = 1 … DELTA = 4), e as demais entram depois.
- **CNH:**
  - Com MOTORISTA = não, a CNH é descartada, com o aviso "CNH ignorada: fora do quadro de motoristas".
  - Categorias inválidas geram aviso, e as válidas ficam.
- **Militar existente:** a chave é a matrícula. Se mudou algum de posto, nome de guerra, antiguidade, motorista, CNH ou voluntário JES, ele conta como alterado, com a lista de mudanças. Equipe ou jornada diferentes da lotação aberta geram nova lotação a partir do mês corrente.
- **Militar novo:** a lotação começa no mês corrente.
- Militares no sistema que não estão na planilha geram só o aviso "N militares do sistema não estão na planilha (nada foi apagado)".

- [ ] **Passo 1: testes que falham**, com planilha fictícia de 6 linhas:
  - `importa militares, equipes e lotações`
  - `matrícula sem hífen é corrigida com aviso`
  - `militar de outra seção vira problema e não grava`
  - `CNH sem motorista é ignorada com aviso`
  - `mudança de equipe gera lotação nova`
  - `importar duas vezes não grava nada` **[foco 1]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação de militares`. Depois, abrir o PR "Fase 3 — Entrega 2: militares e afastamentos" e **parar até o merge**.

---

# Entrega 3 — Atividades, funções e guarnições

Branch `fase3-3-guarnicoes`.

### Task 12: API de Funções e Guarnições

**Arquivos:**
- Criar: `pacotes/contratos/src/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes.ts`, `apps/api/test/guarnicoes.test.ts`

**Interfaces:**
- Produz (contratos):
  - `LinhaComposicao = { funcaoId: uuid; minimo: int>=0; maximo: int>=minimo | null; cnhExigida: 'A'..'E' | null }`
  - `VersaoGuarnicao = { viatura: string | null; tipoViatura: string | null; prioridade: int | null; ativa: boolean; composicao: LinhaComposicao[] }` (com refinamento: funções sem repetição)
  - `NovaGuarnicao = { nome: Nome; atividadeId: uuid | null; vigencia: Mes; versao: VersaoGuarnicao }`
  - `EdicaoGuarnicao = { nome?: Nome; atividadeId?: uuid | null }`
  - `LinhaGuarnicao = { id; nome; atividade: string | null; viatura: string | null; prioridade: number | null; ativa: boolean; vagasObrigatorias: number; pendencias: string[] }` (a pendência possível é `'Sem atividade'`)
  - `FichaGuarnicao = { id; nome; atividadeId; versoes: { vigencia: string; viatura; tipoViatura; prioridade; ativa; composicao: (LinhaComposicao & { funcao: string; ordem: number })[] }[]; usadaEm: { escalaId; escala: string; turnos: string[] }[] }`
  - `Funcao = { id; nome; unidadeSigla: string; herdada: boolean }`
- Produz (rotas):
  - `GET|POST /api/unidades/:u/funcoes` (próprias e herdadas de cima) e `PATCH /api/funcoes/:id`
  - `GET /api/unidades/:u/guarnicoes?mes=` (versão vigente no mês; ordem por prioridade, nulos por último, e nome)
  - `POST /api/unidades/:u/guarnicoes`
  - `GET|PATCH /api/guarnicoes/:id`
  - `PUT /api/guarnicoes/:id/versoes/:mes`: cria ou substitui a versão daquele mês e regrava a composição na ordem recebida.
- Regras:
  - Um mês anterior ao corrente devolve 409 "Versões passadas não se editam. Escolha <mês corrente> ou depois."
  - A função precisa ser do catálogo visível à unidade; se não for, devolve 400 no campo `composicao.N.funcaoId`.
  - A viatura não entra em nenhuma regra.

- [ ] **Passo 1: testes que falham:**
  - `cria guarnição com a primeira versão`
  - `lista do mês usa a versão vigente`
  - `salvar a partir do mês corrente substitui sem duplicar` **[foco 2]**
  - `versão de mês passado é 409` **[foco 2]**
  - `guarnição sem atividade tem a pendência`
  - `função de outra unidade é 400`
  - `função herdada do 2º GB aparece marcada`
  - `máximo menor que o mínimo é 400`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de funções e guarnições`.

### Task 13: Tela de Guarnições

**Arquivos:**
- Criar: `apps/web/src/api/guarnicoes.ts`, `apps/web/src/routes/_app/guarnicoes.tsx`, `.../guarnicoes/index.tsx`, `.../guarnicoes/$id.tsx`, `apps/web/src/__testes__/guarnicoes.test.tsx`
- Modificar: `Trilho.tsx` (liga "Guarnições")

**Interfaces:**
- **Lista:** em ordem de ativação, com aviso nas que estão "Sem atividade".
- **Detalhe:**
  - nome, atividade (lista das ativas) e viatura e tipo de viatura (opcionais, com a dica "Só informativa: não muda as vagas");
  - versões numa linha do tempo;
  - composição com função (seleção, mais "Nova função…" que cria no catálogo da unidade), mínimo e máximo com − e +, e CNH exigida;
  - o botão "Salvar a partir de <mês>", com o mês padrão sendo o corrente;
  - "Onde é usada" (escalas e turnos).

- [ ] **Passo 1: testes que falham:**
  - `lista avisa guarnição sem atividade`
  - `mais e menos mudam o mínimo e não passam do máximo`
  - `salvar a partir de envia PUT no mês escolhido`
  - `nova função cria e já seleciona`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: tela de guarnições`.

### Task 14: Importação de Guarnições

**Arquivos:**
- Criar: `apps/api/src/importacao/guarnicoes.ts`, `apps/api/test/importacao-guarnicoes.test.ts`

**Interfaces:**
- Consome: `resolverGuarnicoes` e `cadgVigencia` do `dominio`, que interpretam a aba como o protótipo.
- Aba `GUARNIÇÕES`, colunas `VIGÊNCIA`, `GUARNIÇÃO`, `VIATURA`, `TIPO`, `ATIVAR`, `PRIORIDADE`, `CNH`, `FUNÇÃO`, `MÍNIMO` e `MÁXIMO`.
- **Versões:** para cada vigência distinta da aba, a vazia virando o mês de criação da unidade, `resolverGuarnicoes(linhas, vigencia)` dá o estado naquele mês. Cada guarnição vira uma versão com essa vigência, e uma versão igual à anterior não é gravada. Os `avisos` do resolvedor viram problemas.
- **Funções:** criadas no catálogo da unidade quando faltam.
- **CNH:** com várias categorias, quando uma é atendida por todas as outras pela hierarquia, fica essa (`['C', 'D']` vira `C`). Senão, vira o problema "CNH "A/B" não cabe numa categoria só", com a solução "Escolha a categoria na tela de Guarnições"; a função entra sem CNH.
- **Atividade:** fica vazia. O aviso final é "N guarnições sem atividade: escolha a atividade de cada uma na tela".
- **Guarnição existente:** a chave é (unidade, nome normalizado), e a versão é comparada campo a campo.

- [ ] **Passo 1: testes que falham:**
  - `importa guarnição com duas vigências`
  - `máximo 0 retira a função`
  - `CNH C/D vira C`
  - `CNH A/B vira problema e a função entra sem CNH`
  - `importar duas vezes não grava nada` **[foco 1]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação de guarnições`. Depois, abrir o PR "Fase 3 — Entrega 3: atividades, funções e guarnições" e **parar até o merge**.

---

# Entrega 4 — Serviços, turnos e escalas

Branch `fase3-4-servicos-escalas`.

### Task 15: Regra do turno padrão no motor

**Arquivos:**
- Criar: `pacotes/dominio/src/voluntariado.ts`, `pacotes/dominio/test/voluntariado.test.ts`
- Modificar: `pacotes/dominio/src/index.ts`

**Interfaces:**
- Consome: `minutosDoDia` (`choques.ts`).
- Produz:
  - `type TurnoPadrao = { dia: -1 | 0 | 1; turno: 'A' | 'B' }`, com o dia relativo ao dia em que o turno do serviço começa.
  - `turnosPadraoExigidos(inicio: string, fim: string): TurnoPadrao[]`. Exemplo: `fim` menor que `inicio` atravessa a meia-noite; igual dá 24h. As janelas são, em minutos a partir das 00h de D: B(−1) = [−240, 480), A(0) = [480, 1200), B(0) = [1200, 1920) e A(+1) = [1920, 2640). Entra toda janela com interseção de tamanho positivo, em ordem cronológica. Horário inválido lança `Horário inválido: "<texto>".`
  - `duracaoMinutos(inicio: string, fim: string): number` (24h = 1440).

Regra só do sistema novo (adendo do design): não grava caso compartilhado e testa só em `pacotes/dominio/test`.

- [ ] **Passo 1: testes que falham** (**[foco 4]**):

```ts
it.each([
  ['08:00', '16:00', [{ dia: 0, turno: 'A' }]],
  ['16:00', '00:00', [{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }]],
  ['00:00', '08:00', [{ dia: -1, turno: 'B' }]],
  ['07:00', '19:00', [{ dia: -1, turno: 'B' }, { dia: 0, turno: 'A' }]],
  ['08:00', '08:00', [{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }]],
  ['20:00', '08:00', [{ dia: 0, turno: 'B' }]],
  ['20:00', '20:00', [{ dia: 0, turno: 'B' }, { dia: 1, turno: 'A' }]],
])('%s às %s', (i, f, esperado) => expect(turnosPadraoExigidos(i, f)).toEqual(esperado));
it('horário inválido', () => expect(() => turnosPadraoExigidos('25:00', '08:00')).toThrow('Horário inválido: "25:00".'));
it('duração de 24h', () => expect(duracaoMinutos('08:00', '08:00')).toBe(1440));
```

- [ ] **Passo 2:** `pnpm --filter dominio test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter dominio test && pnpm --filter dominio typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: turnos padrão exigidos pelo horário (regra do voluntariado)`.

### Task 16: API de Serviços e Escalas

**Arquivos:**
- Criar: `pacotes/contratos/src/servicos.ts`, `pacotes/contratos/src/escalas.ts`, `apps/api/src/cadastros/servicos.ts`, `apps/api/src/cadastros/escalas.ts`, `apps/api/test/servicos.test.ts`, `apps/api/test/escalas.test.ts`

**Interfaces:**
- Consome: `TurnoPadrao`, `turnosPadraoExigidos` e `duracaoMinutos` (Tarefa 15). `contratos` passa a depender de `dominio` (`"dominio": "workspace:*"`) e reexporta o tipo `TurnoPadrao`.
- **Serviços (contratos):**
  - `NovoServico = { nome: Nome; tipo: 'ordinario'|'pjes'|'diaria'; operacao: string | null; rotuloImpressao: string | null; cor: /^#[0-9A-Fa-f]{6}$/ }`. Com refinamento: `operacao` só quando `tipo = 'diaria'`.
  - `EdicaoServico`: os mesmos campos, opcionais, mais `ativo`.
  - `NovoTurno = { letra: 'A'|'B'|'C'|'U'; inicio: Hora; fim: Hora }`
  - `Servico = { id; nome; tipo; operacao; rotuloImpressao; cor; ativo; turnos: { id; letra; inicio; fim; duracaoMinutos; turnosPadrao: TurnoPadrao[] }[] }`
- **Escalas (contratos):**
  - `NovaEscala = { nome: Nome; titulo: Nome; militaresDoc: 'todos'|'escalados'; diasDoc: 'todos'|'com_escalados' }`
  - `ServicosDaEscala = { servicoIds: uuid[] }`, na ordem de preenchimento.
  - `VinculosDaEscala = { itens: { guarnicaoId: uuid; turnoLetra: 'A'|'B'|'C'|'U' | null }[] }`
  - `Escala = { id; nome; titulo; militaresDoc; diasDoc; ativa; servicos: { id; nome; cor }[]; letras: string[]; vinculos: { vigencia: string; itens: { guarnicaoId; guarnicao: string; turnoLetra: string | null }[] }[] }`. `letras` é a união das letras dos turnos dos serviços da escala.
- **Rotas de serviços:**
  - `GET|POST /api/unidades/:u/servicos` e `PATCH /api/servicos/:id`
  - `POST /api/servicos/:id/turnos` e `PATCH|DELETE /api/turnos/:id`
  - Turno com alocação vira 409 pelo `respostaDoErroDoBanco`.
- **Rotas de escalas:**
  - `GET|POST /api/unidades/:u/escalas` e `GET|PATCH /api/escalas/:id`
  - `PUT /api/escalas/:id/servicos`: substitui a lista e regrava `ordem` de 1 em diante. Tirar um serviço que tem alocação na escala devolve 409 "O serviço <nome> já tem militares escalados nesta escala."
  - `PUT /api/escalas/:id/vinculos/:mes`: mesma regra de vigência da guarnição. A letra precisa estar em `letras`; se não estiver, devolve 400.

- [ ] **Passo 1: testes que falham:**
  - Em `servicos.test.ts`:
    - `cria serviço com turnos e devolve duração e turnos padrão` (16:00–00:00 dá 480 min, mais A e B) **[foco 4]**
    - `operação em serviço que não é diária é 400`
    - `letra repetida no serviço é 409`
    - `apagar turno em uso é 409 legível` **[foco 3]**
  - Em `escalas.test.ts`:
    - `cria escala, reúne serviços na ordem`
    - `tirar serviço com alocação é 409`
    - `vínculo com letra fora da escala é 400`
    - `vínculos do mês corrente substituem` **[foco 2]**
    - `vínculo de mês passado é 409`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de serviços, turnos e escalas`.

### Task 17: Telas de Serviços e Escalas

**Arquivos:**
- Criar: `apps/web/src/api/servicos.ts`, `apps/web/src/api/escalas.ts`, `apps/web/src/routes/_app/servicos.tsx` (+ `servicos/index.tsx`, `servicos/$id.tsx`), `apps/web/src/routes/_app/escalas.tsx` (+ `escalas/index.tsx`, `escalas/$id.tsx`), `apps/web/src/lib/turno-padrao.ts`, `apps/web/src/__testes__/servicos.test.tsx`, `apps/web/src/__testes__/escalas.test.tsx`
- Modificar: `Trilho.tsx` (liga "Serviços" e "Escalas")

**Interfaces:**
- Produz (`turno-padrao.ts`): `descreverTurnosPadrao(t: TurnoPadrao[]): string`. Exemplos:
  - `[{0,A}]` → `'A'`
  - `[{-1,B},{0,A}]` → `'B da noite anterior e A'`
  - `[{0,B},{1,A}]` → `'B e A do dia seguinte'`
- **Tela de Serviços:**
  - lista agrupada por tipo (Ordinário, PJES, Diária);
  - detalhe com nome, tipo, operação (só em Diária), nome na impressão e cor;
  - turnos dentro do serviço, com letra, início, fim, duração ("12h") e o bloco como na grade (a cor com a letra dentro);
  - "Pede voluntariado em: …" em cada turno.
- **Tela de Escalas:**
  - serviços reunidos na ordem de preenchimento, com subir e descer;
  - publicação (militares: todos ou só escalados; dias: todos ou só com escalados);
  - matriz guarnição × letra com caixas de marcar, mais uma coluna "Todos os turnos";
  - o botão "Salvar a partir de <mês>".

- [ ] **Passo 1: testes que falham:**
  - `descreverTurnosPadrao` com os três exemplos
  - `turno das 16h às 00h mostra "A e B"`
  - `operação só aparece para diária`
  - `subir serviço muda a ordem enviada`
  - `marcar na matriz envia o vínculo com a letra`
  - `"Todos os turnos" envia turnoLetra null`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: telas de serviços e escalas`.

### Task 18: Importação de Serviços e Escalas

**Arquivos:**
- Criar: `apps/api/src/importacao/servicos-escalas.ts`, `apps/api/test/importacao-servicos-escalas.test.ts`

**Interfaces:**
- É um importador só (`servicos-escalas`) que processa, em ordem, as abas `TURNOS`, `ESCALAS` e `GUARNIÇÕES POR ESCALA`. As escalas dependem dos serviços, e os vínculos dependem das guarnições da entrega 3.
- **TURNOS** (colunas `SERVIÇO`, `TURNO`, `HORÁRIO INÍCIO`, `HORÁRIO FIM`, `TIPO DE SERVIÇO`, `ORIGEM`):
  - **Tipo do serviço:** vem de `TIPO DE SERVIÇO` normalizado (ORDINÁRIO, PRONTO, SALDO ou EXPEDIENTE → `ordinario`; JES ou PJES → `pjes`; DIÁRIA → `diaria`). Sem ela, vem do nome, pelos mesmos termos. Se nada servir, o serviço entra como `diaria` com o aviso "Confira o tipo do serviço <nome>".
  - **Rótulo de impressão:** `ORIGEM`, quando for diferente do nome.
  - **Cor:** pelo nome, com os valores iniciais da especificação de telas (Pronto `#2F8F5B`, JES `#6E56A8`, Saldo `#2B7BB9`, Bioma `#C08A1E`, PE Seguro `#3C5F9C`, Defensoria `#8C4A7A`, Expediente `#8A94A1`). Os demais recebem `#5B6675`.
  - **Letra:** precisa ser A, B, C ou U depois de `normalizar`. Se não for, vira o problema "Turno "<x>" de <serviço>", com a solução "Use A, B, C ou U na coluna TURNO".
- **ESCALAS** (colunas `ESCALA`, `SERVIÇOS`, `TÍTULO`, `MILITARES`, `DIAS`):
  - `SERVIÇOS` é uma lista separada por vírgula, na ordem de preenchimento. Um serviço desconhecido vira problema, e a escala entra sem ele.
  - `MILITARES`: TODOS ou ESCALADOS. `DIAS`: TODOS ou COM ESCALADOS. Valor vazio vira `todos`. O título vazio vira o nome.
- **GUARNIÇÕES POR ESCALA** (colunas `VIGÊNCIA`, `ESCALA`, `TURNO`, `GUARNIÇÃO`): agrupa por (escala, vigência), e a vigência vazia vira o mês de criação da unidade. Uma guarnição desconhecida vira o problema "Guarnição <x> não cadastrada", com a solução "Importe a aba GUARNIÇÕES (tela de Guarnições) e depois esta".
- **Chaves naturais:** serviço é (unidade, nome); turno é (serviço, letra); escala é (unidade, nome); versão de vínculos é (escala, vigência), comparada como conjunto.

- [ ] **Passo 1: testes que falham:**
  - `importa serviços e turnos com cor e tipo`
  - `turno com letra inválida vira problema`
  - `escala reúne serviços na ordem da lista`
  - `vínculo com guarnição desconhecida vira problema com a solução`
  - `importar duas vezes não grava nada` **[foco 1]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação de serviços, turnos e escalas`. Depois, abrir o PR "Fase 3 — Entrega 4: serviços, turnos e escalas" e **parar até o merge**.

---

# Entrega 5 — Cotas e feriados

Branch `fase3-5-cotas-feriados`.

### Task 19: API de Cotas e Feriados

**Arquivos:**
- Criar: `pacotes/contratos/src/cotas-feriados.ts`, `apps/api/src/cadastros/cotas.ts`, `apps/api/src/cadastros/feriados.ts`, `apps/api/test/cotas.test.ts`, `apps/api/test/feriados.test.ts`

**Interfaces:**
- **Feriados (contratos):**
  - `NovoFeriado = { data: Data; descricao: Nome; fixo: boolean }` e `EdicaoFeriado` (os mesmos campos, opcionais)
  - `Feriado = { id; data; descricao; fixo; unidadeSigla: string; herdado: boolean }`
- **Cotas (contratos):**
  - `NovaCota = { mes: Mes; servicoId: uuid; quantidade: int>0; origem: 'interna'|'externa'; prioridade: int>=1; contaMeta: boolean }` e `EdicaoCota` (sem `mes`, campos opcionais)
  - `Cota = NovaCota & { id; servico: string; cor: string; distribuidas: number }`. `distribuidas` conta as alocações do serviço no mês em escalas da unidade; vale 0 até a fase 4.
- **Rotas de feriados:**
  - `GET /api/unidades/:u/feriados?ano=` (próprios e herdados de cima, em ordem de data)
  - `POST /api/unidades/:u/feriados` e `PATCH|DELETE /api/feriados/:id`
  - `POST /api/unidades/:u/feriados/copiar-fixos` `{ de: number, para: number }`: copia só os `fixo` da própria unidade, pula as datas que já existem e devolve `{ copiados: number }`.
- **Rotas de cotas:**
  - `GET|POST /api/unidades/:u/cotas?mes=` (ordem por prioridade) e `PATCH|DELETE /api/cotas/:id`
  - `POST /api/unidades/:u/cotas/copiar` `{ de: Mes, para: Mes }`: copia as do mês `de` e pula a mesma (serviço, origem) já existente.
  - Serviço ordinário vira 409 pela mensagem do gatilho ("Cota só existe para serviço PJES ou diária").

- [ ] **Passo 1: testes que falham:**
  - Em `feriados.test.ts`:
    - `feriado do CBMPE aparece herdado na 1ª SB`
    - `copiar fixos pula o Carnaval e as datas já existentes`
    - `data repetida é 409`
  - Em `cotas.test.ts`:
    - `cria e lista por prioridade`
    - `cota de serviço ordinário é 409 com a mensagem do banco` **[foco 3]**
    - `copiar do mês anterior não duplica`
    - `escalante sem papel é 403`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de cotas e feriados`.

### Task 20: Telas de Cotas e Feriados

**Arquivos:**
- Criar: `apps/web/src/api/cotas.ts`, `apps/web/src/api/feriados.ts`, `apps/web/src/routes/_app/cotas.tsx`, `apps/web/src/routes/_app/feriados.tsx`, `apps/web/src/__testes__/cotas.test.tsx`, `apps/web/src/__testes__/feriados.test.tsx`
- Modificar: `Trilho.tsx` (liga "Cotas" e "Feriados")

**Interfaces:**
- **Cotas** (especificação de telas, "Cotas"):
  - seletor de mês;
  - linhas com prioridade, serviço (na cor), destino, origem e "recebidas e distribuídas", com barra de progresso;
  - "Adicionar cota" e "Copiar do mês anterior".
- **Feriados:**
  - seletor de ano;
  - lista por data, onde os herdados aparecem com a sigla e sem editar;
  - a caixa "Cai no mesmo dia todo ano" (`fixo`);
  - "Copiar feriados fixos de <ano anterior>".

- [ ] **Passo 1: testes que falham:**
  - `barra de progresso com recebidas e distribuídas`
  - `copiar do mês anterior envia de e para`
  - `feriado herdado não tem botão de editar`
  - `copiar fixos mostra quantos foram copiados`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: telas de cotas e feriados`.

### Task 21: Importação de Cotas e Feriados, e fechamento da fase

**Arquivos:**
- Criar: `apps/api/src/importacao/cotas.ts`, `apps/api/src/importacao/feriados.ts`, `apps/api/test/importacao-cotas-feriados.test.ts`
- Modificar: `docs/superpowers/plans/2026-11-16-roadmap-migracao.md` (nota "Como ficou" na fase 3) e `CLAUDE.md` local (estrutura e contagem de testes; o arquivo não é versionado)

**Interfaces:**
- Consome: `servicoDaOperacao` do `dominio` (mesmo critério do protótipo para achar o serviço da operação).
- **COTAS** (colunas `MÊS`, `SB`, `OPERAÇÃO`, `SERVIÇO`, `QUANTIDADE`, `ORIGEM`, `PRIORIDADE`):
  - **Mês:** `aaaa-mm` ou `mm/aaaa`.
  - **SB:** se for diferente da unidade, a linha vira o problema "Cota de outra seção".
  - **Serviço:** vem de `SERVIÇO`. Sem ela, a `OPERAÇÃO` é casada com `servico.operacao` ou com o nome. O serviço precisa ser PJES ou diária.
  - **Origem:** vazia vira `interna`.
  - **Prioridade:** vazia segue a ordem das linhas.
  - **Chave:** (mês, unidade, serviço, origem).
- **FERIADOS** (colunas `DATA`, `DESCRIÇÃO`):
  - **Data:** `dd/mm/aaaa` ou `aaaa-mm-dd`.
  - **fixo:** `false` quando a descrição contém carnaval, cinzas, paixão ou corpus christi (comparação por `normalizar`), com o aviso "Marcado como móvel: <descrição>". Os demais ficam `true`.
  - **Chave:** (unidade, data).

- [ ] **Passo 1: testes que falham:**
  - `cota pela operação acha o serviço da diária`
  - `cota de outra seção vira problema`
  - `Carnaval entra como móvel com aviso`
  - `importar duas vezes não grava nada` **[foco 1]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. Depois, atualizar o roadmap com a nota "Como ficou (data)", no padrão da fase 2.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck && pnpm build:vercel`. Esperado: tudo passa e a saída da Vercel é montada.
- [ ] **Passo 5:** commit `Fase 3: importação de cotas e feriados; fechamento da fase`. Depois, abrir o PR "Fase 3 — Entrega 5: cotas e feriados" e **parar até o merge**.

---

## Fora desta fase

- Equipes e unidades (tela de Estrutura): fase 7. Na fase 3, as equipes nascem da importação e aparecem só para escolher.
- Modelo de impressão da escala e "Gerar documento": fase 4.
- "Ver histórico" da guarnição e tela de Histórico: fase 7. A auditoria já grava tudo.
- Convites e cadastro de usuários: fase 7, junto com o gestor por nível.
- Exposição do motor pela API (pré-escala, distribuições, quem pode ocupar a vaga): fase 4, com as telas que a usam.
