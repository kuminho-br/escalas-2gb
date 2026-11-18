# Fase 3 — Cadastros: plano de implementação

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** todos os cadastros da 1ª SB editáveis no sistema novo, com importação da planilha sandbox, para a entrega "cadastros conferidos no sistema novo, iguais aos da sandbox".

**Arquitetura:** um cadastro por vez (opção A), cada um com API (Hono), tela (React) e importação (.xlsx enviado na tela). Os contratos de entrada e saída ficam num pacote compartilhado (`pacotes/contratos`, zod) usado pela API para validar e pelo site para tipar. Toda gravação passa por `comUsuario`, para a auditoria registrar quem fez. A importação é sem estado: a prévia e a confirmação recebem o mesmo arquivo, e a confirmação refaz o plano antes de gravar.

**Tecnologia:** Hono 4, Postgres (PGlite nos testes), zod 4, ExcelJS 4.4, React 19, TanStack Router/Query, Tailwind + shadcn/ui, Vitest 5.

**Especificação:** `docs/superpowers/specs/2026-11-16-migracao-design.md` (adendos "Cadastros (fase 3)" e "Modelo de planilha e ajustes da ficha do militar", D7), `docs/superpowers/specs/2026-11-16-esquema-banco.md`, `docs/superpowers/specs/2026-11-16-telas.md` (seções "Cadastros" e "Configurações").

## Restrições globais

- **D7:** nenhum dado pessoal real no repositório, na CI ou nos testes. Matrículas de teste no formato `990xxx-x`, nomes fictícios. Planilhas de teste são montadas com ExcelJS dentro do próprio teste.
- **Gravação:** toda escrita roda dentro de `comUsuario(banco, usuarioId, tx => …)` (`apps/api/src/banco/banco.ts`).
- **Migrações:** arquivos novos numerados (`0009_…`). Nunca se edita uma migração já aplicada. Tabela nova recebe o gatilho `auditoria_registro` na mesma migração.
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
- **O escalante nunca é bloqueado:** linha com problema na importação é pulada e o resto entra. Antiguidade repetida só avisa.
- **Modelo de planilha (entrega 2.1):** todo importador declara `modelo` (Tarefa 12) e lê as colunas pelos mesmos rótulos. Os importadores das entregas 3 a 5 já nascem com ele. O modelo nunca traz linha de dados, e o nome da aba continua exato (`MILITARES`, não "MILITARES (colar)").
- **Testes:** API com `bancoDeTeste()` (PGlite em memória). Site com `simularApi`. Vitest com `maxWorkers: 2`. O comando da suíte é `pnpm test`, e o typecheck é `pnpm typecheck`.
- **Commits:** em português, no estilo `Fase 3: <o quê>`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PRs:** um por entrega, com o merge só após a anuência do usuário. O executor para ao fim de cada entrega, depois de abrir o PR.

## Foco da revisão

1. **Importar o mesmo arquivo duas vezes:** a segunda prévia mostra tudo como "igual", e a confirmação não grava nada (nem auditoria).
2. **Vigência passada na tela:** "Salvar a partir de" com um mês anterior ao corrente devolve 409 com o mês mínimo na mensagem; o mês corrente substitui a versão existente sem criar outra.
3. **Conflitos do banco:** afastamento sobreposto, nome repetido ou turno em uso devolvem 409 com uma frase legível, nunca 500 nem o texto do Postgres.
4. **Turnos que atravessam a meia-noite e de 24h:** a duração e o "Pede voluntariado em" saem certos para `16:00–00:00`, `00:00–08:00`, `08:00–08:00` e `20:00–20:00`.
5. **Usuário sem papel na unidade:** recebe 403 em toda escrita, e quem tem papel deixa o próprio `usuario_id` na auditoria.
6. **Modelo e leitura sempre em sincronia:** um teste percorre todos os importadores e confere que cada coluna do modelo é achada pela leitura, e que importar o modelo vazio não grava nada.
7. **Antiguidade repetida não bloqueia:** gravar o segundo militar com o mesmo número passa (201); os dois ganham a pendência.
8. **Nome repetido com outra caixa ou acento** (guarnição, função, serviço, escala): 409 com frase legível, nunca 500 do índice único.
9. **Função repetida na composição:** 400 no campo da repetição, nunca 500 da restrição `unique (guarnicao_versao_id, funcao_id)`.
10. **Guarnição que só começa num mês futuro:** aparece na lista do mês corrente com "a partir de", em vez de sumir depois de criada.
11. **Dados gravados antes da 3.1 com máximo vazio:** depois da migração, reimportar a mesma planilha dá tudo "igual".
12. **ESCALAS como a sandbox escreve:** "SÓ ESCALADOS", MILITARES vazio e TÍTULO vazio dão o mesmo resultado que o protótipo (dias só com escalados, militares só escalados e título "ESCALA <NOME>").
13. **Hora digitada de vários jeitos:** "8:00", "24:00" e a célula de hora do Excel viram "08:00" e "00:00". Texto inválido vira problema com solução, nunca 500.
14. **Serviço tirado da escala com a letra ainda na matriz:** a gravação passa e a ficha avisa dos vínculos órfãos, sem apagá-los em silêncio.
15. **Vínculo com guarnição desativada** (tela ou importação): fica gravado, com aviso, e a matriz mostra a guarnição com a etiqueta "desativada".
16. **Migração 0011 com os dados reais:** "todos os turnos" numa escala com serviços de faixas iguais (Pronto, JES, Saldo) vira uma marcação por faixa, sem duplicar; o órfão some; serviço com A e U para a migração com a mensagem.
17. **Reimportar a sandbox depois da 0011:** os vínculos com TURNO vazio dão "igual".
18. **Turno de 24h e turno que atravessa a meia-noite na régua:** os segmentos saem certos e não há sobreposição falsa entre segmentos do mesmo turno.
19. **Cor clara no bloco da duração** (amarelo, branco): o texto continua legível.
20. **Trocar de escala com alteração pendente** pergunta antes; salvar limpa o aviso sem perguntar.

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
  cadastros/<cadastro>.ts   # rotas de cada cadastro; regras puras em cadastros/<cadastro>-regras.ts
  importacao/planilha.ts, importacao/rotas.ts, importacao/tipos.ts, importacao/modelo.ts, importacao/<cadastro>.ts
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
  - afastamentos: tipo (só os ativos), início e fim, o atalho "Mês inteiro" (preenche do dia 1 ao último dia do mês escolhido) e "Apagar". *(Substituído na entrega 2.1: a lista fica à vista, o formulário abre por "Incluir afastamento" e o atalho sai.)*
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

# Entrega 2.1 — Modelo de planilha e ajustes da ficha

Branch `fase3-2-1-modelo`, a partir da `main` com a entrega 2 (PR #16 já mergeado). Especificação: adendo "Modelo de planilha e ajustes da ficha do militar" do design. As importações das entregas 3 a 5 nascem já com o modelo, por isso esta entrega vem antes da 3.

### Task 12: Modelo de planilha na API

**Arquivos:**
- Criar: `apps/api/src/importacao/modelo.ts`, `apps/api/test/importacao-modelo.test.ts`
- Modificar: `apps/api/src/importacao/{tipos.ts,rotas.ts,configuracoes.ts,militares.ts}`

**Interfaces:**
- Produz (`tipos.ts`):
  - `type ColunaModelo = { rotulo: string; obrigatoria: boolean; ajuda: string; opcoes?: string[] }`. `opcoes` é só para valor fechado e curto (vira lista de opções na célula).
  - `type AbaModelo = { nome: string; colunas: ColunaModelo[] }`
  - `Importador<P>` ganha `modelo: { abas: AbaModelo[]; valores?(ctx: Contexto): Promise<{ titulo: string; itens: string[] }[]> }`. Os nomes em `modelo.abas` são exatamente os de `abas`, na mesma ordem.
- **Uma lista só:** cada importador lê as colunas pelos rótulos declarados em `modelo` (por exemplo, uma constante `COLUNAS` usada tanto em `modelo` quanto em `coluna(aba, COLUNAS.mat.rotulo)`). Modelo e leitura não podem divergir.
- Produz (`modelo.ts`): `gerarModelo(imp: Importador<unknown>, ctx: Contexto): Promise<ArrayBuffer>`, com ExcelJS.
  - Uma aba por `modelo.abas`: só o cabeçalho (negrito, linha congelada, largura pelo rótulo); nenhuma linha de dados. Colunas com `opcoes` recebem lista de opções nas linhas 2 a 1001.
  - Aba `AJUDA`, sempre a última: (1) para que serve; (2) como preencher: colar a partir da sandbox ou digitar, sem mudar o nome da aba nem do cabeçalho; (3) tabela com uma linha por coluna: aba, coluna, "obrigatória" ou "opcional", o que escrever, valores aceitos; (4) um bloco por item de `valores(ctx)`; (5) "O que o sistema faz": mostra tudo antes de gravar; linha com problema é pulada e o resto entra; importar de novo não duplica; nada é apagado.
  - Os importadores ignoram a aba `AJUDA`.
- Produz (`rotas.ts`): `GET /api/unidades/:u/importacao/:cadastro/modelo`.
  - Mesmo controle de acesso da importação do cadastro (`papeis ?? CADASTRO` na unidade). Cadastro desconhecido é 404.
  - Resposta: o arquivo, com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e `Content-Disposition: attachment; filename="modelo-<cadastro>.xlsx"`.
  - As mensagens de erro da importação mudam: aba que falta → `A planilha não tem a aba "X". Baixe o modelo na tela de importação e cole os dados nele, ou confira o nome da aba.`; arquivo ilegível → `Não foi possível ler o arquivo. Se ele veio da sandbox inteira, o Google Planilhas pode ter exportado com defeito: baixe o modelo e cole só as abas nele.`
- **Importadores existentes:**
  - `militares`: colunas `MATRÍCULA`, `NOME DE GUERRA`, `SEÇÃO`, `POSTO/GRAD`, `JORNADA` (opções PRONTO e ADM), `EQUIPE`, `ANTIG`, `MOTORISTA` e `VOLUNTÁRIO JES` (opções SIM e NÃO), `CNH`. Obrigatórias: matrícula, nome de guerra, seção, posto, jornada. `valores`: os postos (siglas, em ordem de hierarquia) e as equipes da unidade.
  - `configuracoes`: colunas `CHAVE`, `VALOR`, `VIGÊNCIA`, `DESCRIÇÃO`. Obrigatórias: chave e valor. `valores`: as chaves de parâmetro que o sistema usa, cada uma com a descrição.

- [ ] **Passo 1: testes que falham** (`importacao-modelo.test.ts`, percorrendo `IMPORTADORES` de `registro.ts`, para valer também para os importadores das próximas entregas):
  - `o modelo tem as abas do importador e a AJUDA por último`
  - `o cabeçalho do modelo é achado pela leitura, coluna a coluna` **[foco 6]**: para cada coluna, `coluna(aba, rotulo)` devolve o índice dela.
  - `importar o modelo vazio não grava nem dá problema` **[foco 6]**: `planejar` sobre o modelo lido devolve prévia sem novos, alterados nem problemas.
  - `o modelo não traz linha de dados`: cada aba de dados tem só o cabeçalho.
  - `a AJUDA de militares traz os postos e as equipes da unidade`
  - `JORNADA tem lista de opções` (a célula da linha 2 tem validação com PRONTO e ADM).
  - `a rota entrega o .xlsx com o nome do cadastro`
  - `modelo de configurações é 403 para escalante e 200 para gestor` **[foco 5]**
  - `cadastro desconhecido é 404`
  - `aba que falta sugere o modelo` e `arquivo ilegível sugere colar só as abas no modelo`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test && pnpm typecheck`. Esperado: PASSA, e os testes de importação das entregas 1 e 2 continuam passando.
- [ ] **Passo 5:** commit `Fase 3: modelo de planilha na API`.

### Task 13: Baixar modelo no site

**Arquivos:**
- Modificar: `apps/web/src/componentes/ImportarPlanilha.tsx`, `apps/web/src/__testes__/importar.test.tsx`

**Interfaces:**
- Consome: a rota `GET <caminho>/modelo` da Tarefa 12, com o mesmo `caminho` que a importação já usa.
- No primeiro passo do diálogo entra o link "Baixar modelo" (âncora com `href` e `download`, que leva o cookie da sessão). O texto de apoio passa a ser: "Baixe o modelo, cole os dados nas abas dele e envie o arquivo aqui. A planilha sandbox baixada em .xlsx também serve." O botão de escolher o arquivo não muda.

- [ ] **Passo 1: testes que falham:**
  - `tem o link Baixar modelo apontando para o modelo do cadastro` (`href` termina em `/importacao/militares/modelo`).
  - `o texto manda colar os dados nas abas do modelo`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: Baixar modelo na importação`.

### Task 14: Ajustes da ficha do militar

**Arquivos:**
- Modificar: `apps/web/src/routes/_app/militares/$id.tsx`, `apps/web/src/componentes/militares/{Secao,Lotacoes,Afastamentos,Motorista}.tsx`, `apps/web/src/__testes__/militares.test.tsx`

**Interfaces:**
- `Secao` ganha `recolhida?: boolean` e `resumo?: string`. Com `recolhida`, o título é um botão (`aria-expanded`) que mostra o `resumo` ao lado; o conteúdo e as `acoes` só aparecem depois de aberto.
- Ordem das seções na ficha: identificação, motorista, afastamentos, lotação.
- **Lotação:** recolhida, com `resumo` = `<sigla>, <Jornada>[ (<equipe>)] desde <mês por extenso>` da lotação aberta (exemplo: "1ª SB, Adm desde novembro de 2026"), ou "Sem lotação". Aberta, mostra a linha do tempo e "Registrar transferência", como hoje.
- **Afastamentos:** a lista fica sempre. O botão "Incluir afastamento" abre o formulário (tipo, início, fim), cujo botão de gravar passa a se chamar "Gravar" e ao lado há "Cancelar". Depois de gravar com sucesso o formulário fecha e os campos voltam ao vazio. Sai o campo "Mês do atalho", o botão "Mês inteiro" e a função `ultimoDia`.
- **Motorista:** mesmo desenho, com metade do tamanho: o conjunto de botões ocupa metade da largura e cada botão metade da altura; a letra cai um ponto. Confira no navegador (jsdom não mede tamanho).

- [ ] **Passo 1: testes que falham** (em `militares.test.tsx`):
  - Remover `mês inteiro preenche início e fim`.
  - `os campos de afastamento só aparecem depois de "Incluir afastamento"`: a lista (com "Férias") aparece de cara e `queryByLabelText('Início')` é nulo até o clique.
  - `o formulário fecha depois de gravar`
  - `a lotação vem por último e recolhida, com o resumo`: o resumo aparece, "Registrar transferência" não, até clicar no título.
  - Adaptar `só os tipos ativos aparecem para lançar` e `afastamento sobreposto mostra a mensagem da API` para abrir o formulário antes e gravar por "Gravar".
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: ajustes da ficha do militar`.

### Task 15: Aviso de antiguidade repetida

**Arquivos:**
- Modificar: `apps/api/src/cadastros/{militares.ts,militares-regras.ts}`, `apps/api/src/importacao/militares.ts`, `apps/api/test/{militares.test.ts,militares-regras.test.ts,importacao-militares.test.ts}`

**Interfaces:**
- Produz (`militares-regras.ts`, puro):
  - `repetidasPorAntiguidade(militares: { id: string; nomeGuerra: string; antiguidade: number | null }[]): Map<string, string[]>`: para cada militar com antiguidade, os nomes de guerra dos outros que têm o mesmo número. Antiguidade vazia nunca repete.
  - `pendenciasDoMilitar` ganha o campo opcional `repetidaCom?: string[]` e, quando não vazio, acrescenta no fim `Antiguidade repetida com <nomes separados por ", ">`.
- A lista compara os militares ativos que ela mesma traz (lotados na unidade e abaixo no mês). A ficha compara os ativos lotados na unidade da lotação que cobre o mês corrente; sem lotação, não compara. A gravação nunca é bloqueada.
- Importação: antiguidade repetida entre linhas da planilha vira o aviso `Antiguidade <n> repetida na planilha: <NOME> (<matrícula>) e <NOME> (<matrícula>).`, e as linhas entram normalmente.
- A lista e a ficha do site já mostram `pendencias`; não há mudança no site.

- [ ] **Passo 1: testes que falham:**
  - `militares-regras.test.ts`: `repetidasPorAntiguidade` com nenhuma repetição, um par, um trio e antiguidade vazia; o texto da pendência.
  - `militares.test.ts`: `dois militares com a mesma antiguidade ganham a pendência e a gravação passa` **[foco 7]** (o segundo `POST` devolve 201; a lista e a ficha dos dois trazem `Antiguidade repetida com <o outro>`); `militar inativo não conta como repetido`; `desfeita a repetição, a pendência some`.
  - `importacao-militares.test.ts`: `antiguidade repetida na planilha vira aviso e as linhas entram`.
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: aviso de antiguidade repetida`. Depois, abrir o PR "Fase 3 — Entrega 2.1: modelo de planilha e ajustes da ficha" e **parar até o merge**. Lembrar o usuário de que **não há migração** nesta entrega.

---

# Entrega 3 — Atividades, funções e guarnições

Branch `fase3-3-guarnicoes`, a partir da `main` com a entrega 2.1 (PR #17 mergeado).

**Sem migração.** As tabelas `funcao`, `guarnicao` (com `atividade_id`), `guarnicao_versao`, `composicao`, `escala_vinculo_versao` e `escala_guarnicao` já existem (migrações 0003 e 0009), com o gatilho de auditoria.

**Decisões desta entrega** (tomadas ao detalhar o plano, sobre o que a especificação não fixa):
- A lista mostra as guarnições **da própria unidade**. Guarnições de unidades acima entram com as escalas em qualquer nível (fase 7). As funções, ao contrário, são herdadas de cima já agora (RN-94).
- Nome de guarnição e de função é único por unidade **sem diferenciar caixa nem acento** (comparação por `normalizar`), conferido na API; o banco só garante o nome exato. Função com nome igual a uma herdada também é recusada.
- A mensagem de versão em mês passado é a mesma dos parâmetros: `Só dá para mudar a partir de <mês por extenso>.` (409).
- Guarnição criada para um mês futuro aparece na lista do mês corrente com "a partir de <mês>", para não sumir depois de criada.
- Não há tela de catálogo de funções: a função nasce em "Nova função…" na composição ou na importação. Renomear função fica para quando houver essa tela (sai a rota `PATCH /api/funcoes/:id` do plano anterior).
- "Ver histórico" fica para a fase 7 (já está em "Fora desta fase").

### Task 16: API de funções e guarnições

**Arquivos:**
- Criar: `pacotes/contratos/src/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes-regras.ts`, `apps/api/test/guarnicoes.test.ts`, `apps/api/test/guarnicoes-regras.test.ts`
- Modificar: `pacotes/contratos/src/index.ts` (exporta), `apps/api/src/app.ts` (`app.route('/api', rotasGuarnicoes(comAuth))`)

**Interfaces:**
- Produz (contratos, zod):
  - `Cnh = z.enum(['A','B','C','D','E'])`
  - `LinhaComposicao = { funcaoId: Id; minimo: int >= 0; maximo: int >= 0 | null; cnhExigida: Cnh | null }`, com refinamento: `maximo >= minimo` (mensagem no campo `maximo`: "O máximo precisa ser igual ou maior que o mínimo.").
  - `VersaoGuarnicao = { viatura: string (trim, até 40) | null; tipoViatura: string (trim, até 60) | null; prioridade: int >= 1 | null; ativa: boolean; composicao: LinhaComposicao[] }`, com refinamento: função repetida na composição dá, no campo `composicao.<i>.funcaoId` da repetição, "Esta função já está na composição." Texto vazio em viatura e tipo vira `null`.
  - `NovaGuarnicao = { nome: Nome; atividadeId: Id | null; vigencia: Mes; versao: VersaoGuarnicao }`
  - `EdicaoGuarnicao = { nome?: Nome; atividadeId?: Id | null }`
  - `NovaFuncao = { nome: Nome }`
  - `Funcao = { id: string; nome: string; unidadeSigla: string; herdada: boolean }`
  - `ComposicaoSalva = { funcaoId: string; funcao: string; minimo: number; maximo: number | null; cnhExigida: string | null }` (na ordem gravada)
  - `VersaoSalva = { vigencia: string /* aaaa-mm */; viatura: string | null; tipoViatura: string | null; prioridade: number | null; ativa: boolean; composicao: ComposicaoSalva[] }`
  - `LinhaGuarnicao = { id; nome; atividade: string | null; viatura: string | null; prioridade: number | null; ativa: boolean; vagasObrigatorias: number; aPartirDe: string | null; pendencias: string[] }`. `vagasObrigatorias` é a soma dos mínimos; `aPartirDe` é o mês da primeira versão quando nenhuma vale ainda no mês consultado (senão `null`); a pendência possível é `'Sem atividade'`.
  - `FichaGuarnicao = { id; nome; atividadeId: string | null; atividade: string | null; versoes: VersaoSalva[] /* mais recente primeiro */; usadaEm: { escalaId: string; escala: string; turnos: string[] }[] }`
- Produz (`guarnicoes-regras.ts`, puro):
  - `diferencasDeVersao(antes: VersaoSalva | null, depois: VersaoSalva): string[]`. Textos: `'viatura: ABT-01 → ABT-02'` (vazio vira `sem viatura`), `'tipo: …'`, `'prioridade: 1 → 2'` (vazio vira `sem prioridade`), `'ativa: sim → não'`, `'Combatente: incluída'`, `'Combatente: retirada'`, `'Combatente: mínimo 2 → 3'`, `'Combatente: máximo 3 → sem limite'`, `'Motorista: CNH D → C'` (vazio vira `nenhuma`). As funções são comparadas pelo nome normalizado. Com `antes = null`, devolve `['nova']`. Ordem da composição não conta como diferença.
  - `versaoNoMes<T extends { vigencia: string }>(versoes: T[], mes: string): T | null`: a de maior `vigencia <= mes`.
- Produz (`guarnicoes.ts`, além das rotas, para a Task 18):
  - `funcoesVisiveis(c: Consulta, unidadeId: string): Promise<(Funcao & { chave: string })[]>`: as da unidade e das de cima (`caminho @>`), `chave = normalizar(nome)`, em ordem de nome.
  - `versoesDasGuarnicoes(c: Consulta, ids: string[]): Promise<Map<string, VersaoSalva[]>>`: mais recente primeiro.
  - `gravarVersao(tx: Consulta, guarnicaoId: string, vigencia: string, v: VersaoGuarnicao): Promise<void>`: `insert … on conflict (guarnicao_id, vigencia_desde) do update`, depois apaga a composição da versão e insere de novo com `ordem` = posição na lista.
- Produz (rotas, todas com `CADASTRO` na unidade; para as rotas por id, a unidade vem de `unidadeDoRegistro(…, 'guarnicao', id)` e id desconhecido é 404 "Guarnição não encontrada."):
  - `GET /api/unidades/:u/funcoes` → `Funcao[]`; `POST /api/unidades/:u/funcoes` (`NovaFuncao`) → 201 `Funcao`. Nome igual (normalizado) a uma função visível dá 409 `Já existe a função "<nome>" (<sigla>).`
  - `GET /api/unidades/:u/guarnicoes?mes=` (mês corrente se faltar; inválido é 400) → `LinhaGuarnicao[]`, por prioridade (vazia por último), depois nome. Usa a versão vigente no mês ou, se não houver, a primeira (com `aPartirDe`).
  - `POST /api/unidades/:u/guarnicoes` (`NovaGuarnicao`) → 201 `FichaGuarnicao`.
  - `GET /api/guarnicoes/:id` → `FichaGuarnicao`; `PATCH /api/guarnicoes/:id` (`EdicaoGuarnicao`) → `FichaGuarnicao`.
  - `PUT /api/guarnicoes/:id/versoes/:mes` (corpo `VersaoGuarnicao`) → `FichaGuarnicao`. Cria ou substitui a versão daquele mês.
- Regras:
  - Vigência (no `POST` e no `PUT`) anterior ao mês corrente (`hojeRecife()`) dá 409 `Só dá para mudar a partir de <mês por extenso>.`; `:mes` mal formado dá 400.
  - Função fora do catálogo visível à unidade da guarnição dá 400 no campo `composicao.<i>.funcaoId`: "Esta função não está no catálogo da seção."
  - Atividade inativa (ou inexistente) escolhida dá 400 no campo `atividadeId`: "Escolha uma atividade ativa." Manter a atividade que já estava, mesmo desativada, é permitido (o `PATCH` só confere quando o valor muda).
  - Nome de guarnição igual (normalizado) a outra da mesma unidade dá 409 "Já existe uma guarnição com esse nome."
  - `usadaEm`: escalas cuja versão de vínculos vigente no mês corrente inclui a guarnição; `turnos` é a lista de letras em ordem, e o vínculo sem letra vira `'todos'`.
  - A viatura não entra em nenhuma regra.

- [ ] **Passo 1: testes que falham:**
  - `guarnicoes-regras.test.ts`: um `it` por texto de `diferencasDeVersao` acima, mais `antes nulo é nova`, `ordem diferente não é diferença`, e `versaoNoMes` com versões de 2026-11 e 2027-01 (dezembro pega a de novembro; outubro dá `null`).
  - `guarnicoes.test.ts` (fixtures com `inserir`: uma função "Motorista" no 2º GB, uma função da 1ª SB e uma de outra seção):
    - `cria guarnição com a primeira versão` (201; a ficha traz a versão do mês com a composição na ordem enviada)
    - `lista do mês usa a versão vigente` (versão de agora e outra do mês seguinte: o mês seguinte mostra a nova viatura)
    - `guarnição que só começa no mês seguinte aparece com aPartirDe` **[foco 10]**
    - `salvar a partir do mês corrente substitui sem duplicar` **[foco 2]** (dois `PUT` no mesmo mês deixam uma versão só, com a composição do segundo)
    - `versão de mês passado é 409 com o mês mínimo` **[foco 2]**
    - `guarnição sem atividade tem a pendência`
    - `função de outra seção é 400 no campo`
    - `função repetida na composição é 400 no campo` **[foco 9]**
    - `máximo menor que o mínimo é 400`
    - `função herdada do 2º GB aparece marcada e pode compor`
    - `nome de função repetido com outra caixa é 409` **[foco 8]** (`motorista` com "Motorista" no 2º GB)
    - `nome de guarnição repetido com outro acento é 409` **[foco 8]**
    - `atividade desativada não pode ser escolhida`
    - `onde é usada lista a escala e os turnos` (insere escala, versão de vínculos do mês e dois `escala_guarnicao` com A e B)
    - `escalante de outra unidade recebe 403 e sem papel também` **[foco 5]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA (módulos inexistentes).
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de funções e guarnições`.

### Task 17: Tela de Guarnições

**Arquivos:**
- Criar: `apps/web/src/api/guarnicoes.ts`, `apps/web/src/routes/_app/guarnicoes.tsx`, `apps/web/src/routes/_app/guarnicoes/index.tsx`, `apps/web/src/routes/_app/guarnicoes/$id.tsx`, `apps/web/src/componentes/guarnicoes/{Composicao.tsx,Versoes.tsx}`, `apps/web/src/__testes__/guarnicoes.test.tsx`
- Modificar: `apps/web/src/componentes/Trilho.tsx` (`para: '/guarnicoes'` em "Guarnições")

**Interfaces:**
- Consome: as rotas e os tipos da Task 16; `consultaCatalogo('atividades')` de `api/configuracoes.ts`; `ListaDetalhe`, `ImportarPlanilha` (cadastro `guarnicoes`), `Secao`, `Selecao`.
- Produz (`api/guarnicoes.ts`): `consultaGuarnicoes(unidadeId, mes)` (chave `['guarnicoes', unidadeId, mes]`), `consultaGuarnicao(id)` (`['guarnicao', id]`), `consultaFuncoes(unidadeId)` (`['funcoes', unidadeId]`), `criarGuarnicao`, `editarGuarnicao`, `salvarVersao(id, mes, v)`, `criarFuncao(unidadeId, nome)`, e `atualizarGuarnicoes(queryClient, id?)`, que invalida `guarnicoes`, `funcoes` e `guarnicao`.
- **Lista** (como a de militares): ordem da API; cada item mostra nome, viatura, atividade, "inativa" quando for o caso, "a partir de <mês por extenso>" quando `aPartirDe`, e o ícone de aviso com `aria-label` "Cadastro incompleto: Sem atividade". Ações: "Importar da planilha" e "Nova guarnição" (diálogo com nome, atividade e mês de início, que cria a primeira versão vazia e abre a ficha).
- **Ficha:**
  - **Identificação:** nome e atividade (só as ativas, mais a atual se estiver desativada), com "Salvar" (`PATCH`).
  - **Versões** (`Versoes.tsx`): a linha do tempo das vigências, a vigente em destaque; clicar numa carrega o editor com ela. O editor tem viatura e tipo de viatura (com a dica "Só informativa: não muda as vagas"), prioridade, "Ativa", a composição e, no fim, o mês (`type="month"`, `min` = mês corrente, padrão = mês corrente) e o botão "Salvar a partir de <mês por extenso>" (`PUT`). O erro da API aparece abaixo do botão.
  - **Composição** (`Composicao.tsx`), uma linha por função, na ordem:
    - função (`Selecao` com as funções; as herdadas mostram a sigla entre parênteses; a última opção é "Nova função…", que abre um campo e o botão "Criar"; criada, já fica escolhida);
    - mínimo com − e + (`aria-label` "Diminuir mínimo de <função>" / "Aumentar mínimo de <função>"): não desce de 0 e não passa do máximo;
    - máximo com − e + e a caixa "Sem limite": o − não desce do mínimo; marcar "Sem limite" põe `null`; desmarcar põe o mínimo;
    - CNH exigida (`Selecao`: "Nenhuma", A a E);
    - "Retirar".
    - Abaixo, "Incluir função" acrescenta uma linha (função vazia, mínimo 1, máximo 1, sem CNH). Não há reordenação: a ordem é a das linhas.
  - **Onde é usada:** as escalas com os turnos, ou "Ainda não está em nenhuma escala."

- [ ] **Passo 1: testes que falham** (`guarnicoes.test.tsx`, com `simularApi`):
  - `lista avisa guarnição sem atividade`
  - `guarnição que começa depois mostra a partir de quando`
  - `mais e menos mudam o mínimo e não passam do máximo`
  - `sem limite deixa o máximo vazio e o mais do mínimo sobe livre`
  - `salvar a partir de envia PUT no mês escolhido com a composição na ordem` (confere o corpo com `corpoEnviado`)
  - `versão de mês passado mostra a mensagem da API`
  - `nova função cria e já seleciona`
  - `atividade só lista as ativas e mantém a atual desativada`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: tela de guarnições`.

### Task 18: Importação de guarnições

**Arquivos:**
- Criar: `apps/api/src/importacao/guarnicoes.ts`, `apps/api/test/importacao-guarnicoes.test.ts`
- Modificar: `apps/api/src/importacao/registro.ts` (`guarnicoes`), `apps/api/src/importacao/planilha.ts` (recebe `mesDaCelula`), `apps/api/src/importacao/configuracoes.ts` (passa a usar `mesDaCelula`)

**Interfaces:**
- Consome: `resolverGuarnicoes`, `CNH_HABILITA` e `normalizar` do `dominio`; `funcoesVisiveis`, `versoesDasGuarnicoes`, `gravarVersao` (Task 16); `diferencasDeVersao` (Task 16); `ColunaModelo` e `Importador` (Task 12).
- Produz (`planilha.ts`): `mesDaCelula(t: string): string`, que transforma `'01/12/2026'` (data digitada que o Planilhas converte) em `'2026-12'` e devolve o resto como veio. É o `vigenciaDaCelula` que hoje está em `configuracoes.ts`, movido.
- Produz (`importacao/guarnicoes.ts`): `cnhUnica(cats: string[]): { cnh: string | null } | { conflito: true }`. Lista vazia → `{ cnh: null }`; uma categoria → ela; várias → a categoria `c` da lista que todas as outras habilitam pela hierarquia (`CNH_HABILITA[o]` contém `c`), senão `{ conflito: true }`. Exemplos: `['C','D']` → `C`; `['B','C','D']` → `B`; `['A','B']` → conflito.
- **Modelo:** aba `GUARNIÇÕES`, colunas na ordem `VIGÊNCIA`, `GUARNIÇÃO`, `VIATURA`, `TIPO`, `ATIVAR` (opções SIM e NÃO), `PRIORIDADE`, `CNH`, `FUNÇÃO`, `MÍNIMO`, `MÁXIMO`. Obrigatórias: guarnição e função. A ajuda de `GUARNIÇÃO` diz que a atividade se escolhe depois, na tela; a de `MÁXIMO`, que 0 retira a função naquela vigência e vazio é sem limite; a de `VIGÊNCIA`, que vazio vale desde a criação da seção. `valores`: as funções visíveis à unidade (com a sigla quando herdada) e as guarnições já cadastradas.
- **Leitura:** cada linha da aba vira a entrada de `resolverGuarnicoes` (o tipo `LinhaGuarnicao` do `dominio`; importe-o com outro nome, como `LinhaDaAba`, porque `contratos` também tem um `LinhaGuarnicao`), com a vigência passada por `mesDaCelula`. Sem a coluna `GUARNIÇÃO`, a prévia traz só o problema "Falta a coluna GUARNIÇÃO.", com a solução "Use o modelo desta tela."
- **Versões:** as vigências distintas da aba (a vazia vira o mês de criação da unidade, `unidade.desde`). Para cada uma, em ordem, `resolverGuarnicoes(linhas, vigencia)` dá o estado no mês. Para cada guarnição, uma versão igual (por `diferencasDeVersao(...).length === 0`) à da vigência anterior da própria planilha é descartada.
- **Forma das versões da planilha:** cada uma é montada como `VersaoSalva` (viatura e tipo vazios viram `null`, `ativar` vira `ativa`). Função que ainda não existe fica com `funcaoId` vazio; a comparação de `diferencasDeVersao` é pelo nome, então isso não atrapalha. No `aplicar`, depois de criar as funções novas, os nomes viram ids para chamar `gravarVersao`.
- **Comparação com o sistema:** a chave da guarnição é `normalizar(nome)` entre as da unidade. Cada versão da planilha é comparada com a versão do sistema **da mesma vigência**: não existe → entra; existe e difere → substitui; igual → conta como igual. Versões do sistema em outras vigências não são tocadas.
- **Prévia:** guarnição nova vai em `novos` (`descricao`: nome e quantas versões); guarnição existente com alguma versão nova ou diferente vai em `alterados`, com `mudancas` = `'<mês por extenso>: <diferença>'` para cada diferença; o resto soma em `iguais` (uma por guarnição).
- **Funções:** casadas por `normalizar` com `funcoesVisiveis`; as que faltam são criadas no catálogo da unidade, com o aviso `Funções novas: <nomes>.`
- **CNH:** por `cnhUnica`. Conflito vira o problema `CNH "<A/B>" não cabe numa categoria só (<guarnição>, <função>).`, solução `Escolha a categoria na tela de Guarnições.`, na primeira linha da aba com essa guarnição, essa função e CNH preenchida. A função entra sem CNH (a linha não é pulada).
- **Avisos do resolvedor:** viram problemas, sem repetir (o mesmo aviso sai uma vez por vigência). A linha vem do `linha N` do texto; a mensagem tira o prefixo `GUARNIÇÕES, linha N` e qualquer código interno (`B58`, `RN-12` e parênteses que fiquem vazios); a solução é `Corrija a linha na planilha e importe de novo.`
- **Atividade:** nunca vem da planilha. O aviso final é `<N> guarnições sem atividade: escolha a atividade de cada uma na tela de Guarnições.`, contando as importadas (novas e existentes) que estão sem atividade.
- **Aplicar:** cria as funções novas e as guarnições novas (`atividade_id` nulo), depois `gravarVersao` para cada versão nova ou diferente.

- [ ] **Passo 1: testes que falham** (`importacao-guarnicoes.test.ts`, planilha fictícia; o mês de criação vem do banco):
  - `importa guarnição com duas vigências` (linhas sem vigência e uma linha de 2027-01 que muda o máximo do Combatente: duas versões, a segunda com máximo 4)
  - `máximo 0 retira a função`
  - `CNH C/D vira C`
  - `CNH A/B vira problema e a função entra sem CNH`
  - `função nova entra no catálogo da seção, e a herdada do 2º GB é usada`
  - `guarnição sem atividade gera o aviso`
  - `linha com mínimo inválido vira problema, sem códigos internos` (a mensagem não casa com `/RN-|B\d{2}/`)
  - `vigência digitada como data é lida como mês`
  - `importar duas vezes não grava nada` **[foco 1]**
  - `mudança numa vigência aparece campo a campo na prévia`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA (o teste do modelo da Task 12 também passa a cobrir `guarnicoes` assim que ela entra no registro).
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação de guarnições`. Depois, abrir o PR "Fase 3 — Entrega 3: atividades, funções e guarnições" e **parar até o merge**. No PR, dizer que **não há migração** e que a ordem de importação no ambiente de teste é: Guarnições (aba GUARNIÇÕES); a atividade de cada guarnição se escolhe depois, na tela.

---

# Entrega 3.1 — Ajustes de guarnições

Branch `fase3-3-1-guarnicoes`, a partir da `main` com a entrega 3 (PR #18 mergeado). Especificação: adendo "Guarnição como modelo (entrega 3.1)" do design.

**Com migração (`0010_maximo_obrigatorio.sql`).** Depois do merge, o usuário roda `pnpm --filter api db:migrar:teste`: as composições importadas com máximo vazio passam a ter o máximo igual ao mínimo.

**Decisões do usuário (17/11/2026):**
- Guarnição é um **modelo**, instanciado com militares ao longo das escalas: a atividade sai da guarnição (tela, contratos, pendência e importação). A coluna `guarnicao.atividade_id` fica no banco, sem uso, e o catálogo de Atividades em Configurações não muda.
- Guarnição sem nenhuma função mostra "sem composição".
- A linha da composição: `Chefe   de [−] 1 [+] a [−] 1 [+] militares   □ Exige CNH   Remover`; marcada "Exige CNH", aparece a lista de categorias ao lado.
- Não existe "sem limite": **máximo vazio é igual ao mínimo** (na importação, na migração dos dados já gravados e no contrato, que passa a exigir o máximo). O protótipo continua com a regra dele (vazio = sem limite); a mudança vale só para o sistema novo.
- "Retirar" vira "Remover"; "Viatura" vira "Sigla da viatura".
- Desativar: "Desativar agora" (a partir do mês corrente) e "Desativar a partir de…" (mês escolhido). Desativada no mês, a guarnição some da lista.
- Renomear função pelo lápis ao lado dela, na composição. Padronizar nomes é escolha do usuário.
- A caixa "Ativa" da versão continua.

**Decisões minhas, ao detalhar** (o usuário pode mudar na revisão do plano):
- A lista ganha, no rodapé, "Mostrar desativadas" (desligado por padrão): sem isso não haveria como abrir uma guarnição desativada para reativá-la.
- Desativar a partir de M grava `ativa = false` na versão de M (criada como cópia da que vale em M, se não existir) **e em todas as versões posteriores**. Senão uma versão futura já cadastrada religaria a guarnição sem aviso. Reativar faz o mesmo com `ativa = true`.
- Na importação, função com mínimo e máximo vazios fica "de 0 a 0" e gera o aviso `<guarnição>: <função> ficou de 0 a 0 militares; confira MÍNIMO e MÁXIMO.`
- O lápis só aparece para funções da própria seção; as herdadas do 2º GB mostram a sigla e não se renomeiam pela seção (a API devolve 403).

### Task 19: API — guarnição sem atividade, máximo obrigatório

**Arquivos:**
- Criar: `apps/api/banco/migracoes/0010_maximo_obrigatorio.sql`
- Modificar: `pacotes/contratos/src/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes-regras.ts`, `apps/api/src/importacao/guarnicoes.ts`, e os testes `apps/api/test/{guarnicoes.test.ts,guarnicoes-regras.test.ts,importacao-guarnicoes.test.ts}`

**Interfaces:**
- Migração: `update composicao set maximo = minimo where maximo is null;` e `alter table composicao alter column maximo set not null;`.
- Contratos:
  - `LinhaComposicao.maximo`: inteiro `>= 0`, obrigatório (sem `null`), com o mesmo refinamento `maximo >= minimo`.
  - Saem `NovaGuarnicao.atividadeId`, `EdicaoGuarnicao.atividadeId`, `LinhaGuarnicao.atividade`, `LinhaGuarnicao.pendencias`, `FichaGuarnicao.atividadeId` e `FichaGuarnicao.atividade`.
  - `LinhaGuarnicao.vagasObrigatorias` vira `minimo: number` e `maximo: number` (somas da composição da versão mostrada).
  - `ComposicaoSalva.maximo: number`.
- `diferencasDeVersao`: sai o texto "sem limite" (o máximo é sempre número).
- Rotas: `POST`/`PATCH` de guarnição sem atividade; a lista sem pendências.
- Importação:
  - Máximo vazio vira o mínimo, depois de `resolverGuarnicoes` (que continua tratando o 0 como "retira a função").
  - Função que fica de 0 a 0 gera o aviso acima e entra assim.
  - Sai o aviso de guarnições sem atividade.
  - Ajudas do modelo: `GUARNIÇÃO` = "Nome da guarnição."; `MÁXIMO` = "Máximo de militares na função. Vazio vale igual ao mínimo; 0 retira a função naquela vigência."

- [ ] **Passo 1: testes que falham** (adaptar os que citam atividade, pendência, `vagasObrigatorias` ou `null` no máximo):
  - `guarnicoes.test.ts`:
    - `lista traz o mínimo e o máximo somados` (Combatente 1 a 3 + Motorista 1 a 1 → `minimo: 2, maximo: 4`)
    - `guarnição sem composição tem mínimo e máximo zero`
    - `máximo nulo é 400 no campo` (`composicao.0.maximo`)
    - Saem `guarnição sem atividade tem a pendência` e `atividade desativada não pode ser escolhida…`.
  - `guarnicoes-regras.test.ts`: sai `Combatente: máximo 3 → sem limite`; entra `Combatente: máximo 3 → 4`.
  - `importacao-guarnicoes.test.ts`:
    - `máximo vazio vale igual ao mínimo` (MÍNIMO 2, MÁXIMO vazio → 2 a 2)
    - `mínimo e máximo vazios ficam de 0 a 0 com aviso`
    - `reimportar a planilha com máximo vazio depois da migração dá tudo igual` **[foco 11]**
    - Sai o teste do aviso de atividade.
  - Teste da migração em `guarnicoes.test.ts`: `a migração preenche o máximo vazio com o mínimo` (insere, com `inserir`, uma composição com `maximo: null` num banco com as migrações até a 0009, aplica a 0010 e confere). Se o apoio de testes não permitir parar na 0009, verificar a regra com um `update` igual ao da migração e registrar a decisão no ledger.
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test && pnpm typecheck`. Esperado: a API passa; o typecheck do site pode falhar até a Task 21 (os tipos mudaram). Registre no ledger e siga.
- [ ] **Passo 5:** commit `Fase 3: guarnição sem atividade e máximo obrigatório`.

### Task 20: API — desativar guarnição e renomear função

**Arquivos:**
- Modificar: `pacotes/contratos/src/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes.ts`, `apps/api/src/cadastros/guarnicoes-regras.ts`, `apps/api/test/guarnicoes.test.ts`, `apps/api/test/guarnicoes-regras.test.ts`

**Interfaces:**
- Contratos:
  - `SituacaoGuarnicao = { ativa: boolean; aPartirDe: Mes }`
  - `EdicaoFuncao = { nome: Nome }`
  - `FichaGuarnicao.desativadaAPartirDe: string | null`
- Regras (puro): `desativadaAPartirDe(versoes: { vigencia: string; ativa: boolean }[]): string | null`. É a menor vigência V tal que todas as versões com vigência `>= V` estão inativas; `null` se a versão mais recente está ativa.
- Rotas:
  - `POST /api/guarnicoes/:id/situacao` (`SituacaoGuarnicao`) → `FichaGuarnicao`.
    - Mês anterior ao corrente: 409 `Só dá para mudar a partir de <mês por extenso>.`
    - Se há versão em vigor em `aPartirDe` e nenhuma começa nesse mês, cria uma cópia dela em `aPartirDe` (`gravarVersao`).
    - Depois, `ativa` em todas as versões com vigência `>= aPartirDe`.
    - Sem versão em vigor em `aPartirDe` (a guarnição só começa depois), só atualiza as posteriores.
  - `PATCH /api/funcoes/:id` (`EdicaoFuncao`) → `Funcao`.
    - Papel `CADASTRO` na unidade da função (`unidadeDoRegistro(…, 'funcao', id)`); função desconhecida é 404 "Função não encontrada."; herdada, para quem só tem papel embaixo, é 403.
    - Nome igual (normalizado) a outra função visível à unidade dela é 409 `Já existe a função "<nome>" (<sigla>).`; mudar só a caixa ou o acento do próprio nome é permitido.

- [ ] **Passo 1: testes que falham:**
  - `guarnicoes-regras.test.ts`: `desativadaAPartirDe` com tudo ativo (`null`); só a última inativa; duas últimas inativas (a primeira delas); inativa no meio e ativa depois (`null`).
  - `guarnicoes.test.ts`:
    - `desativar agora some da lista do mês e marca a ficha` (`ativa: false` na lista do mês corrente; `desativadaAPartirDe` = mês corrente)
    - `desativar a partir do mês seguinte mantém o mês corrente ativo`
    - `desativar desliga também as versões futuras já cadastradas`
    - `reativar agora volta a guarnição`
    - `desativar no mês passado é 409`
    - `renomear função muda o nome em todas as guarnições`
    - `renomear só a caixa do próprio nome é permitido` (`CHEFE` → `Chefe`)
    - `renomear para nome de outra função é 409`
    - `função herdada não se renomeia pela seção (403)`
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: desativar guarnição e renomear função`.

### Task 21: Tela de Guarnições — ajustes

**Arquivos:**
- Modificar: `apps/web/src/api/guarnicoes.ts` (`mudarSituacao`, `renomearFuncao`), `apps/web/src/routes/_app/guarnicoes.tsx`, `apps/web/src/routes/_app/guarnicoes/$id.tsx`, `apps/web/src/componentes/guarnicoes/{Composicao.tsx,Versoes.tsx}`, `apps/web/src/__testes__/guarnicoes.test.tsx`

**Interfaces:**
- Consome: os contratos e as rotas das Tasks 19 e 20.
- **Lista:**
  - Cada item mostra a sigla da viatura e `de <minimo> a <maximo> militares`; com mínimo igual ao máximo, `<n> militares`; sem composição, `sem composição`.
  - Sai o ícone de aviso.
  - As desativadas no mês ficam escondidas. No rodapé da lista, a caixa "Mostrar desativadas" mostra as desativadas, com o rótulo "desativada".
  - "Em ordem de ativação · N guarnições" ganha borda inferior e `pb-2`, separado da lista que rola.
- **Ficha:**
  - **Identificação:** só o nome, com "Salvar".
  - **Cabeçalho**, conforme `desativadaAPartirDe`:
    - `null`: botões "Desativar agora" e "Desativar a partir de…". O segundo abre um campo de mês (`min` = mês corrente) e o botão "Desativar a partir de <mês por extenso>".
    - Mês `<=` corrente: "Desativada desde <mês por extenso>." e "Reativar agora".
    - Mês `>` corrente: "Será desativada em <mês por extenso>." e "Cancelar desativação" (reativa a partir desse mês).
  - **Versões:** o campo "Viatura" passa a se chamar "Sigla da viatura".
- **Composição**, uma linha por função:
  - função (`Selecao` `aria-label="Função <n>"`) e, se a função escolhida é da seção, o lápis (`aria-label="Renomear <função>"`). O lápis abre o campo `aria-label="Novo nome de <função>"`, o aviso "O nome muda em todas as guarnições.", e os botões "Salvar nome" e "Cancelar". Salvo, invalida `funcoes` e `guarnicao` e fecha o campo; o erro da API aparece abaixo.
  - `de [−] n [+] a [−] n [+] militares`, com as mesmas regras de hoje (o mínimo não passa do máximo nem desce de 0; o máximo não desce do mínimo). Saem a caixa "Sem limite" e o rótulo `sem limite`.
  - "Exige CNH" (caixa, `aria-label="Exige CNH para <função>"`). Desmarcada, nenhuma lista aparece e `cnhExigida` vai `null`. Marcada, a lista `aria-label="CNH exigida de <função>"` aparece, com A a E e a D pré-escolhida.
  - "Remover" (`aria-label="Remover <função>"`).
  - "Incluir função" acrescenta uma linha de 1 a 1, sem CNH.

- [ ] **Passo 1: testes que falham** (adaptar os atuais que dependem de atividade, "Sem limite", "Retirar" ou "CNH: nenhuma"):
  - `lista mostra os limites e sem composição` (`de 2 a 4 militares`, `3 militares`, `sem composição`)
  - `desativada não aparece até marcar mostrar desativadas`
  - `exige CNH mostra a lista e envia a categoria; desmarcar envia nulo`
  - `remover tira a linha do envio`
  - `renomear função envia PATCH e fecha o campo`
  - `função herdada não tem lápis`
  - `desativar agora envia o mês corrente`
  - `desativar a partir de envia o mês escolhido`
  - `guarnição desativada mostra reativar agora`
  - Sai `sem limite deixa o máximo vazio…`; o de "atividade" sai.
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: ajustes da tela de guarnições`. Depois, abrir o PR "Fase 3 — Entrega 3.1: ajustes de guarnições" e **parar até o merge**. O PR lembra: **rodar `pnpm --filter api db:migrar:teste` depois do merge**.

---

# Entrega 4 — Serviços, turnos e escalas

Branch `fase3-4-servicos-escalas`, a partir da `main` já com a 3.1 (merge do PR #19).

**Revisão de 17/11/2026, depois das entregas 1 a 3.1.** Esta entrega não tem migração: as tabelas `servico`, `turno`, `escala`, `escala_servico`, `escala_vinculo_versao` e `escala_guarnicao` existem desde a `0003`, e a auditoria já cobre todas elas (`0006`). Estas são as mudanças em relação à primeira versão desta entrega:
- **Excluir vira desativar** (decisão da 3.1 para a guarnição). Serviço e escala ganham "Desativar" e "Reativar". O desativado some da lista e volta com "Mostrar desativados". Turno se remove ("Remover"), mas só enquanto ninguém foi escalado nele.
- **Nome repetido com outra caixa ou acento** vira 409 legível antes de chegar ao índice do banco (o índice só compara o texto exato). É o padrão de `nomeJaUsado` em `cadastros/guarnicoes.ts`, e vale para serviço e escala.
- **ESCALAS lida como no protótipo** (`prototipo/guarnicao.js`, `montarModelosGuarnicao` no motor). A sandbox escreve "SÓ ESCALADOS", e não "COM ESCALADOS". MILITARES vazio vale ESCALADOS. TÍTULO vazio vale "ESCALA <NOME>". Um serviço desconhecido descarta a escala inteira. A primeira versão do plano dizia outra coisa nesses quatro pontos.
- **Vínculos como as versões da guarnição:** chips por vigência, "em vigor" só até o mês corrente, mês padrão do "Salvar a partir de" igual ao da versão quando ela é futura, editor recarregado depois de gravar (chave pela assinatura das versões). Na importação vale a regra do "redundante" (Tarefa 18).
- **Vínculo com guarnição desativada:** fica gravado, com aviso, como a linha com ATIVAR = NÃO no protótipo. A matriz mostra a guarnição marcada "desativada".
- **`TurnoPadrao` fica no `contratos`** como esquema próprio, e o `contratos` não passa a depender do `dominio`. A API converte a saída do motor, que tem o mesmo formato.
- **Importação:** um importador (`servicos-escalas`) com as três abas no modelo, e o botão "Importar da planilha" nas duas telas. Coluna obrigatória ausente vira problema e nada é planejado (Tarefa 18). Os avisos do motor perdem os códigos internos (`problemaDoAviso`).

**Decisões minhas, ao detalhar** (o usuário pode mudar na revisão do plano):
- **Desativar o serviço ou a escala vale na hora**, sem vigência, porque as tabelas só têm `ativo`/`ativa`. A escala desativada some da lista; o serviço desativado continua nas escalas que já o reúnem.
- **Serviço e escala são só os da própria seção.** Ao contrário das funções, não se herdam de unidades acima. Na matriz entram só as guarnições da própria seção.
- **Escala nasce vazia.** O diálogo "Nova escala" pede só o nome. O título padrão é "ESCALA <NOME>", com militares "só escalados" e dias "todos", como no protótipo. Escala sem serviço mostra "sem serviços" na lista.
- **"Todos os turnos" exclui as letras na mesma linha.** Marcar a coluna desmarca as letras da guarnição. A API recusa a mistura com 400.
- **Vínculo órfão:** tirar da escala o serviço que trazia a letra C não apaga os vínculos em C. A ficha avisa "Turno C não existe mais nos serviços desta escala: <guarnições>. Salve a matriz para tirá-los." O bloqueio (409) fica só para o serviço com militares escalados, como antes.
- **Mudar o horário de um turno com militares escalados** é permitido nesta fase. Na fase 3 ainda não há alocação feita pela tela, e a fase 4 decide (ver "Fora desta fase").
- **Na importação, TURNOS nunca apaga nada:** turno ou serviço que está no sistema e falta na planilha fica como está. A cor de serviço que já existe não muda, porque a cor é editada na tela. A operação (Diária) não vem da planilha, e o escalante a preenche na tela.
- **A coluna DURAÇÃO da sandbox é ignorada.** Vale o início e o fim, e a tela mostra a duração calculada.

### Task 22: Regra do turno padrão no motor

**Arquivos:**
- Criar: `pacotes/dominio/src/voluntariado.ts`, `pacotes/dominio/test/voluntariado.test.ts`
- Modificar: `pacotes/dominio/src/index.ts`

**Interfaces:**
- Consome: `minutosDoDia` (`choques.ts`).
- Produz:
  - `type TurnoPadrao = { dia: -1 | 0 | 1; turno: 'A' | 'B' }`, com o dia relativo ao dia em que o turno do serviço começa.
  - `turnosPadraoExigidos(inicio: string, fim: string): TurnoPadrao[]`:
    - `fim` menor que `inicio` atravessa a meia-noite, e igual dá 24h;
    - janelas em minutos a partir das 00h de D: B(−1) = [−240, 480), A(0) = [480, 1200), B(0) = [1200, 1920), A(+1) = [1920, 2640);
    - entra toda janela com interseção de tamanho positivo, em ordem cronológica;
    - horário inválido lança `Horário inválido: "<texto>".`
  - `duracaoMinutos(inicio: string, fim: string): number` (24h = 1440).
  - `normalizarHora(texto: string): string | null`: `'8:00'` → `'08:00'`, `'24:00'` → `'00:00'`, inválido → `null`. É usada pela importação (Tarefa 25).

Regra só do sistema novo (adendo do design): não grava caso compartilhado e testa só em `pacotes/dominio/test`.

- [ ] **Passo 1: testes que falham** (**[foco 4]**, **[foco 13]**):

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
it.each([['8:00', '08:00'], ['24:00', '00:00'], ['07:30', '07:30'], ['8h', null], ['', null]])('normalizarHora(%s)', (t, esperado) =>
  expect(normalizarHora(t)).toBe(esperado));
```

- [ ] **Passo 2:** `pnpm --filter dominio test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter dominio test && pnpm --filter dominio typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: turnos padrão exigidos pelo horário (regra do voluntariado)`.

### Task 23: API de Serviços e Escalas

**Arquivos:**
- Criar: `pacotes/contratos/src/servicos.ts`, `pacotes/contratos/src/escalas.ts`, `apps/api/src/cadastros/servicos.ts`, `apps/api/src/cadastros/escalas.ts`, `apps/api/test/servicos.test.ts`, `apps/api/test/escalas.test.ts`
- Modificar: `pacotes/contratos/src/index.ts`, `apps/api/src/app.ts` (monta as duas rotas como `rotasGuarnicoes`)

**Interfaces:**
- Consome:
  - `turnosPadraoExigidos` e `duracaoMinutos` (Tarefa 22);
  - de `cadastros/guarnicoes.ts`: `versoesDasGuarnicoes` e a regra `mesPassado`, que passa a ser exportada de lá sem mudar o texto;
  - `exigirPapel`, `unidadeDoRegistro` (`'servico' | 'turno' | 'escala'`, que já existem), `respostaDoErroDoBanco`, `lerCorpo` e `comUsuario`.
- **Contratos de serviços:**
  - `TipoServico = z.enum(['ordinario', 'pjes', 'diaria'])` e `LetraTurno = z.enum(['A', 'B', 'C', 'U'])`.
  - `TurnoPadrao = z.object({ dia: z.union([z.literal(-1), z.literal(0), z.literal(1)]), turno: z.enum(['A', 'B']) })`.
  - `DadosServico = { nome: Nome; tipo: TipoServico; operacao: string | null; rotuloImpressao: string | null; cor: /^#[0-9A-Fa-f]{6}$/ }`. Texto vazio vira `null`, como `viatura` em `VersaoGuarnicao`. O refinamento põe "Operação só existe em serviço de diária." no campo `operacao`.
  - `NovoServico = DadosServico`; `EdicaoServico = DadosServico`, com o objeto inteiro: a tela limpa a operação ao trocar o tipo.
  - `SituacaoServico = { ativo: boolean }`.
  - `DadosTurno = { letra: LetraTurno; inicio: Hora; fim: Hora }`.
  - `TurnoSalvo = { id; letra; inicio; fim; duracaoMinutos: number; turnosPadrao: TurnoPadrao[] }`.
  - `Servico = { id; nome; tipo; operacao; rotuloImpressao; cor; ativo; turnos: TurnoSalvo[] }`, com os turnos na ordem A, B, C, U.
- **Contratos de escalas:**
  - `DadosEscala = { nome: Nome; titulo: Nome; militaresDoc: 'todos'|'escalados'; diasDoc: 'todos'|'com_escalados' }`.
  - `NovaEscala = { nome: Nome }`. O resto sai com os padrões da decisão acima.
  - `EdicaoEscala = DadosEscala`; `SituacaoEscala = { ativa: boolean }`.
  - `ServicosDaEscala = { servicoIds: Id[] }`, na ordem de preenchimento. Id repetido dá 400.
  - `VinculosDaEscala = { itens: { guarnicaoId: Id; turnoLetra: LetraTurno | null }[] }`. O superRefine recusa:
    - o par repetido: "Esta guarnição já está neste turno.";
    - `null` junto com letra na mesma guarnição: "Com "Todos os turnos", não marque turnos avulsos.".
  - `LinhaEscala = { id; nome; ativa; servicos: string[] }`, com os nomes na ordem.
  - `Escala = { id; nome; titulo; militaresDoc; diasDoc; ativa; servicos: { id; nome; cor; ativo }[]; letras: LetraTurno[]; vinculos: { vigencia: Mes; itens: { guarnicaoId; guarnicao: string; ativaNoMes: boolean; turnoLetra: LetraTurno | null }[] }[] }`:
    - `letras` é a união das letras dos turnos dos serviços, na ordem A, B, C, U;
    - `vinculos` vem da vigência mais recente para a mais antiga, como `FichaGuarnicao.versoes`;
    - `ativaNoMes` diz se a guarnição está ativa na vigência daquela versão.
- **Rotas de serviços** (todas com `CADASTRO`, 404 antes de 403):
  - `GET|POST /api/unidades/:u/servicos`: a lista traz os inativos também, e a tela filtra.
  - `GET|PATCH /api/servicos/:id`
  - `POST /api/servicos/:id/situacao`
  - `POST /api/servicos/:id/turnos` e `PATCH|DELETE /api/turnos/:id`
- **Rotas de escalas:**
  - `GET|POST /api/unidades/:u/escalas`, `GET|PATCH /api/escalas/:id` e `POST /api/escalas/:id/situacao`.
  - `PUT /api/escalas/:id/servicos`: substitui a lista e regrava `ordem` de 1 em diante, apagando e inserindo na mesma transação por causa do `unique (escala_id, ordem)`. Serviço de outra unidade dá 400 no campo `servicoIds`.
  - `PUT /api/escalas/:id/vinculos/:mes`: tem a mesma regra de vigência da guarnição (`mesPassado`), e grava por upsert da versão, apagando e inserindo os itens. Recusa com 400:
    - letra que não está em `letras`: "O turno <x> não existe nos serviços desta escala.";
    - guarnição de outra unidade.
    Guarnição desativada no mês é aceita.
- **Mensagens:**

| Caso | Código | Mensagem |
|---|---|---|
| Nome de serviço repetido (normalizado) | 409 | `Já existe o serviço "<nome>".` |
| Nome de escala repetido (normalizado) | 409 | `Já existe a escala "<nome>".` |
| Letra de turno repetida no serviço | 409 | `Este serviço já tem o turno <letra>.` (código `23505` em `respostaDoErroDoBanco`) |
| Apagar turno com alocação | 409 | `O turno <letra> de <serviço> já tem militares escalados. Ele pode mudar de horário, mas não pode ser removido.` |
| Tirar da escala serviço com alocação nela | 409 | `O serviço <nome> já tem militares escalados nesta escala.` |

- [ ] **Passo 1: testes que falham:**
  - Em `servicos.test.ts`:
    - `cria serviço com turnos e devolve duração e turnos padrão` (16:00 a 00:00 dá 480 min, mais `[{0,A},{0,B}]`) **[foco 4]**
    - `operação em serviço que não é diária é 400 no campo operacao`
    - `nome repetido com outra caixa ou acento é 409` (`"Pé Seguro"` contra `"PE SEGURO"`) **[foco 8]**
    - `letra repetida no serviço é 409 legível`
    - `apagar turno com alocação é 409 legível` **[foco 3]**
    - `desativar e reativar o serviço`
    - `sem papel na unidade: 403 em criar, editar, situação e turnos` **[foco 5]**
    - `serviço inexistente é 404 antes de 403`
  - Em `escalas.test.ts`:
    - `nova escala nasce com título ESCALA <NOME>, só escalados e todos os dias`
    - `reúne serviços na ordem e devolve as letras` (Pronto A/B mais Expediente U dá `['A','B','U']`)
    - `tirar serviço com alocação é 409`
    - `tirar serviço sem alocação deixa o vínculo da letra que sumiu` **[foco 14]**
    - `vínculo com letra fora da escala é 400`
    - `"Todos os turnos" junto com letra na mesma guarnição é 400`
    - `vínculo com guarnição desativada é gravado e volta com ativaNoMes false` **[foco 15]**
    - `vínculos do mês corrente substituem` **[foco 2]**
    - `vínculo de mês passado é 409 com o mês mínimo`
    - `nome repetido com outra caixa é 409` **[foco 8]**
    - `sem papel na unidade: 403 em criar, serviços, vínculos e situação` **[foco 5]**
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar. Exportar `mesPassado` de `cadastros/guarnicoes.ts` sem mudar o comportamento.
- [ ] **Passo 4:** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: API de serviços, turnos e escalas`.

### Task 24: Telas de Serviços e Escalas

**Arquivos:**
- Criar:
  - `apps/web/src/api/servicos.ts` e `apps/web/src/api/escalas.ts`;
  - `apps/web/src/routes/_app/servicos.tsx`, `servicos/index.tsx` e `servicos/$id.tsx`;
  - `apps/web/src/routes/_app/escalas.tsx`, `escalas/index.tsx` e `escalas/$id.tsx`;
  - `apps/web/src/componentes/servicos/Turnos.tsx`;
  - `apps/web/src/componentes/escalas/Matriz.tsx` e `apps/web/src/componentes/escalas/ServicosDaEscala.tsx`;
  - `apps/web/src/componentes/LinhaDoTempo.tsx`, com os chips de vigência tirados de `guarnicoes/Versoes.tsx`;
  - `apps/web/src/lib/turnos.ts`;
  - `apps/web/src/__testes__/servicos.test.tsx` e `apps/web/src/__testes__/escalas.test.tsx`.
- Modificar:
  - `apps/web/src/componentes/guarnicoes/Versoes.tsx`, que passa a usar `LinhaDoTempo`;
  - `apps/web/src/componentes/Trilho.tsx`, que liga "Serviços" e "Escalas";
  - `routeTree.gen.ts` (gerado e commitado).

**Interfaces:**
- Consome: as rotas e os contratos da Tarefa 23, mais `consultaGuarnicoes(unidadeId, mes)` (`api/guarnicoes.ts`), que dá as linhas da matriz.
- Produz:
  - `lib/turnos.ts`:
    - `descreverTurnosPadrao(t: TurnoPadrao[]): string`:
      - `[{0,A}]` → `'A'`;
      - `[{0,A},{0,B}]` → `'A e B'`;
      - `[{-1,B}]` → `'B da noite anterior'`;
      - `[{-1,B},{0,A}]` → `'B da noite anterior e A'`;
      - `[{0,B},{1,A}]` → `'B e A do dia seguinte'`.
    - `textoDuracao(min: number): string`: `720` → `'12h'`, `510` → `'8h30'`, `1440` → `'24h'`.
  - `LinhaDoTempo` recebe `{ vigencias: string[]; escolhida: string; aoEscolher(v: string): void }`. Marca "em vigor" só na vigente que já começou (vigência ≤ mês corrente).
- **Tela de Serviços:**
  - **Lista:** agrupada por tipo (Ordinário, PJES, Diária), com o bloco de cor e as letras dos turnos ("A B"). Os inativos ficam escondidos e voltam com "Mostrar desativados" no rodapé, como em Guarnições. O cabeçalho do grupo tem o mesmo respiro (`pb-2`) do cabeçalho de Guarnições.
  - **"Novo serviço":** diálogo com nome e tipo. A cor sugerida é a da especificação de telas quando o nome bate, e `#5B6675` nos demais.
  - **Detalhe, Identificação:** nome, tipo, operação (só em Diária, e some e se limpa ao trocar o tipo), nome na impressão e cor (seletor de cor mais as sete cores da especificação como atalhos), com "Salvar".
  - **Detalhe, Situação:** "Desativar" ou "Reativar".
  - **Detalhe, Turnos:** uma linha por turno, assim:
    `[A ▾]  08:00  às  20:00   12h   ▣A   Pede voluntariado em: A   Salvar  Remover`
    - o bloco `▣A` é a cor do serviço com a letra dentro, como na grade;
    - "Incluir turno" abre uma linha em branco;
    - um erro da API aparece na própria linha.
- **Tela de Escalas:**
  - **Lista:** nome e serviços ("Pronto, JES, Saldo" ou "sem serviços"). As desativadas ficam escondidas, com "Mostrar desativadas".
  - **"Nova escala":** diálogo só com o nome; abre a ficha depois de criar.
  - **Detalhe, Identificação:** nome, título, militares (todos ou só escalados) e dias (todos ou só com escalados), com "Salvar".
  - **Detalhe, Situação:** "Desativar" ou "Reativar".
  - **Detalhe, Serviços:** lista na ordem de preenchimento, com subir, descer e "Remover", mais "Incluir serviço" (os serviços ativos que ainda não estão na escala) e "Salvar serviços".
  - **Detalhe, Guarnições por turno:**
    - `LinhaDoTempo` mais a matriz. As linhas são as guarnições ativas no mês da versão, em ordem de ativação, mais as já vinculadas (com a etiqueta "desativada"). As colunas são as `letras` mais "Todos os turnos".
    - Marcar "Todos os turnos" desmarca as letras da linha, e marcar uma letra desmarca "Todos os turnos".
    - Embaixo, o mês ("Vale a partir de"), com padrão igual ao da Tarefa 17, e o botão "Salvar a partir de <mês>". A matriz recarrega depois de gravar (chave pela assinatura das versões).
    - O aviso de vínculo órfão aparece acima da matriz quando algum item tem letra fora de `letras`.
  - O botão "Importar da planilha" aparece nas duas telas, com o mesmo importador (`cadastro="servicos-escalas"`, rótulo "os serviços, turnos e escalas"). Ao concluir, atualiza serviços, escalas e guarnições.

- [ ] **Passo 1: testes que falham:**
  - `descreverTurnosPadrao` com os cinco exemplos e `textoDuracao` com os três
  - `turno das 16h às 00h mostra "A e B" e 8h`
  - `operação só aparece para diária e some ao trocar o tipo`
  - `serviço desativado some da lista e volta com "Mostrar desativados"`
  - `subir serviço muda a ordem enviada`
  - `marcar na matriz envia o vínculo com a letra`
  - `"Todos os turnos" envia turnoLetra null e desmarca as letras da linha`
  - `guarnição vinculada e desativada aparece com a etiqueta` **[foco 15]**
  - `vínculo em letra que saiu da escala mostra o aviso` **[foco 14]**
  - Os testes de `guarnicoes.test.tsx` continuam passando com `LinhaDoTempo`.
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: telas de serviços e escalas`.

### Task 25: Importação de Serviços e Escalas

**Arquivos:**
- Criar: `apps/api/src/importacao/servicos-escalas.ts` e `apps/api/test/importacao-servicos-escalas.test.ts`
- Modificar: `apps/api/src/importacao/registro.ts` (chave `'servicos-escalas'`)

**Interfaces:**
- Consome:
  - `normalizarHora` (Tarefa 22) e `normalizar`, `cadgVigencia` do motor;
  - `coluna`, `mesDaCelula` (`planilha.ts`);
  - a forma de `problemaDoAviso`, da marca `redundante` e do problema de coluna obrigatória ausente, de `importacao/guarnicoes.ts`. O que for igual vira função exportada de lá, sem mudar o comportamento.
- **Importador único** (`servicos-escalas`), com `abas: ['TURNOS', 'ESCALAS', 'GUARNIÇÕES POR ESCALA']` nessa ordem e uma só transação. Cada `COLUNAS` é declarada uma vez e usada pela leitura e pelo modelo. `valores(ctx)` lista os serviços (com o tipo), as escalas e as guarnições ativas da seção.
- **TURNOS:**
  - **Colunas:** `SERVIÇO`*, `TURNO`*, `HORÁRIO INÍCIO`*, `HORÁRIO FIM`*, `TIPO DE SERVIÇO` (opções ORDINÁRIO, PJES, DIÁRIA) e `ORIGEM`. O asterisco marca as obrigatórias.
  - **Tipo:** vem de `TIPO DE SERVIÇO` normalizado:
    - ORDINÁRIO, PRONTO, SALDO ou EXPEDIENTE → `ordinario`;
    - JES ou PJES → `pjes`;
    - DIÁRIA → `diaria`.
    Sem a coluna, o tipo sai do nome, pelos mesmos termos. Se nada servir, o serviço entra como `diaria`, com o aviso "Confira o tipo do serviço <nome>".
  - **Valores repetidos:** tipo e `ORIGEM` diferentes em linhas do mesmo serviço geram um aviso, e vale o primeiro.
  - **Rótulo de impressão:** `ORIGEM`, quando for diferente do nome.
  - **Cor de serviço novo:** pelo nome, com os valores da especificação de telas: Pronto `#2F8F5B`, JES `#6E56A8`, Saldo `#2B7BB9`, Bioma `#C08A1E`, PE Seguro `#3C5F9C`, Defensoria `#8C4A7A` e Expediente `#8A94A1`. Os demais recebem `#5B6675`. Serviço que já existe mantém a cor.
  - **Letra:** normalizada; ÚNICO ou UNICO vira `U`. Fora de A, B, C ou U, é o problema "Turno "<x>" de <serviço>", com a solução "Use A, B, C ou U na coluna TURNO".
  - **Horário:** passa por `normalizarHora`. Se for inválido, é o problema "Horário "<x>" de <serviço> <letra>", com a solução "Use HH:MM (ex.: 08:00)".
  - **Comparação:** o turno que já existe é comparado por início e fim. Nada é apagado.
- **ESCALAS:**
  - **Colunas:** `ESCALA`*, `SERVIÇOS`, `TÍTULO`, `MILITARES` (opções TODOS, ESCALADOS) e `DIAS` (opções TODOS, SÓ ESCALADOS).
  - **Agrupamento e serviços:**
    - as linhas se agrupam pelo nome normalizado;
    - `SERVIÇOS` é uma lista separada por `,` ou `;`, na ordem de preenchimento, somando todas as linhas da escala;
    - vazia, vale o serviço com o nome da escala;
    - a busca de serviço olha a aba TURNOS desta planilha e os serviços do sistema;
    - serviço desconhecido descarta a escala, com o problema "Escala <e>: o serviço <s> não existe" e a solução "Cadastre o serviço na aba TURNOS ou corrija o nome em SERVIÇOS".
  - **MILITARES:** TODOS → `todos`; qualquer outro valor, inclusive vazio, → `escalados`. Valor que não seja TODOS nem ESCALADOS gera aviso.
  - **DIAS:** começa por SO depois de `normalizar` (SÓ ESCALADOS), ou é COM ESCALADOS → `com_escalados`; qualquer outro valor → `todos`.
  - **TÍTULO:** vazio vira `ESCALA <NOME EM MAIÚSCULAS>`.
  - **Valores diferentes entre linhas da mesma escala:** aviso, e vale o primeiro.
  - **Escala que já existe:** é comparada por título, militares, dias e lista ordenada de serviços. Se tirar um serviço que já tem alocação nela, a escala inteira fica igual e vira problema com a mensagem da Tarefa 23.
- **GUARNIÇÕES POR ESCALA:**
  - **Colunas:** `VIGÊNCIA` (acha "VIGÊNCIA (A PARTIR DE)" pelo prefixo), `ESCALA`*, `TURNO` e `GUARNIÇÃO`*.
  - **Turno:** vazio ou TODOS → `null`. Letra fora das `letras` da escala (como ficou depois da aba ESCALAS) é o problema "Turno <x> não existe nos serviços da escala <e>", com a solução "Confira a coluna TURNO ou os SERVIÇOS da escala".
  - **Escala desconhecida** (nem na planilha nem no sistema, ou descartada acima): problema "Escala <e> não cadastrada", com a solução "Confira a aba ESCALAS".
  - **Guarnição desconhecida:** problema "Guarnição <x> não cadastrada", com a solução "Importe a aba GUARNIÇÕES (tela de Guarnições) e depois esta".
  - **Guarnição desativada no mês:** entra, com o aviso "<g> está desativada em <mês>; o vínculo fica gravado".
  - **Linha repetida:** aviso, e a repetição é ignorada.
  - **Versões:**
    - as linhas se agrupam por (escala, vigência), e a vigência vazia vira o mês de criação da unidade (`unidade.desde`), como em GUARNIÇÕES;
    - a versão é comparada como conjunto de pares (guarnição, letra);
    - a versão igual à anterior da própria planilha é `redundante` e só é comparada se o sistema tiver versão naquele mês (como na Tarefa 18).
- **Chaves naturais:** serviço é (unidade, nome normalizado); turno é (serviço, letra); escala é (unidade, nome normalizado); versão de vínculos é (escala, vigência).
- **Ordem do `aplicar`:** serviços novos, depois turnos, depois escalas novas, depois serviços das escalas, depois versões de vínculos. Os ids dos criados passam adiante por nome normalizado.

- [ ] **Passo 1: testes que falham** (planilhas montadas com ExcelJS no teste, só com dados fictícios ou não pessoais):
  - `importa serviços e turnos com cor, tipo e rótulo de impressão` (JES com ORIGEM PJES → `rotuloImpressao` PJES)
  - `hora como texto e como hora do Excel` ("8:00" e uma célula de hora do Excel → "08:00") **[foco 13]**
  - `turno com letra inválida e horário inválido viram problemas com a solução`
  - `serviço que já existe mantém a cor`
  - `escala da sandbox: SÓ ESCALADOS, MILITARES vazio e TÍTULO vazio` (→ `com_escalados`, `escalados`, `ESCALA DEFENSORIA`) **[foco 12]**
  - `escala reúne serviços na ordem, em várias linhas`
  - `serviço desconhecido descarta a escala com a solução`
  - `vínculo com guarnição desconhecida vira problema com a solução`
  - `vínculo com guarnição desativada entra com aviso` **[foco 15]**
  - `TURNO vazio ou TODOS vira todos os turnos`
  - `falta a coluna GUARNIÇÃO: problema e nada planejado`
  - `importar duas vezes não grava nada (nem auditoria)` **[foco 1]**
  - O teste de sincronia entre modelo e leitura (Tarefa 12) passa a cobrir este importador sem mudança **[foco 6]**.
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: importação de serviços, turnos e escalas`. Depois, abrir o PR "Fase 3 — Entrega 4: serviços, turnos e escalas" e **parar até o merge**. Esta entrega não tem migração.

---

# Entrega 4.1 — Tela de Serviços e rolagem dos cadastros

Branch `fase3-4-1-servicos-tela`, a partir da `main` já com a entrega 4 (merge do PR #20). Só tela, sem migração. Especificação: adendo "Serviços e escalas depois do uso (entregas 4.1 e 4.2)" do design, de 18/11/2026.

**Decisões do usuário (18/11/2026):**
- "Pede voluntariado em" sai da tela.
- A duração ganha destaque: o bloco com a cor do serviço passa a mostrar a duração, e a letra depois dela sai.
- A cor se escolhe numa grade como a do Google Planilhas.
- Nos cadastros, a lista da esquerda e o detalhe têm rolagens independentes, em todas as telas.
- Melhoria aceita: régua do dia na ficha do serviço.

**Decisões minhas, ao detalhar** (o usuário pode mudar na revisão do plano):
- **Rolagem:** a lista vira um painel fixo (sticky), com rolagem própria, abaixo da barra do topo. O detalhe rola com a página. Para quem usa, as duas rolagens são independentes, e no celular nada muda, porque lá aparece um painel por vez.
- **Régua do dia:** desenha os turnos gravados, não os que estão em edição. Sobreposição de turnos gera um aviso, sem bloquear. Buraco entre turnos não gera aviso, porque é o normal em diárias de um turno só.
- **Texto do bloco:** fica branco ou escuro, o que tiver mais contraste com a cor do serviço. Com horário incompleto, o bloco mostra "—" em cinza.
- **Grade de cores:** traz as 80 cores do Google Planilhas (10 colunas), a linha "Cores dos serviços" e "Personalizada…" (código #RRGGBB, mais o seletor do navegador).
- **Remoções:** `descreverTurnosPadrao` e `Bloco` saem do site, porque ficam sem uso. A API continua devolvendo `turnosPadrao`, que o voluntariado vai usar.

### Task 26: Rolagens independentes nos cadastros

**Arquivos:**
- Modificar: `apps/web/src/componentes/ListaDetalhe.tsx`
- Modificar: `apps/web/src/routes/_app/{militares,guarnicoes,servicos,escalas}.tsx`, para tirar a altura máxima e o `overflow` das listas internas.

**Interfaces:**
- `ListaDetalhe` não muda de props.
- A coluna da lista ganha estas classes, em telas grandes:
  - `lg:sticky lg:top-20` (a barra do topo tem `h-14`, mais o respiro de 1,5rem);
  - `lg:max-h-[calc(100dvh-6.5rem)]`;
  - `lg:overflow-y-auto`.
- Os rodapés "Mostrar desativadas" e "Mostrar desativados" ficam `sticky bottom-0 bg-superficie` dentro da coluna.

- [ ] **Passo 1:** sem teste novo. É só CSS, e o jsdom não calcula layout. Ledger: `Ruling: sem teste automático para a rolagem — conferência visual no ambiente de teste`.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA. A suíte existente continua verde.
- [ ] **Passo 4:** commit `Fase 3: lista dos cadastros com rolagem própria`.

### Task 27: Turnos com a duração em destaque e régua do dia

**Arquivos:**
- Criar: `apps/web/src/lib/cores.ts`, `apps/web/src/componentes/servicos/ReguaDoDia.tsx` e `apps/web/src/__testes__/turnos-lib.test.ts`
- Modificar: `pacotes/contratos/src/servicos.ts`, `apps/web/src/lib/turnos.ts`, `apps/web/src/componentes/servicos/Turnos.tsx` e `apps/web/src/__testes__/servicos.test.tsx`
- Apagar: `apps/web/src/componentes/servicos/Bloco.tsx`, mais `descreverTurnosPadrao` e o teste dela.

**Interfaces:**
- **Produz (`contratos`)**, usado também na entrega 4.2:
  - `textoHora(hhmm: string): string`: `'08:00'` → `'08h'`, `'07:30'` → `'07h30'`, `'00:00'` → `'00h'`.
  - `textoFaixa(inicio: string, fim: string): string`: `'08:00','20:00'` → `'08h–20h'`, com traço meia-risca.
- **Produz (`lib/cores.ts`):** `corDoTexto(fundo: string): '#FFFFFF' | '#1C2430'`. Escolhe o de maior contraste pela luminância relativa (WCAG).
- **Produz (`lib/turnos.ts`):**
  - `segmentosDoDia(turnos: { letra: string; inicio: string; fim: string }[]): { letra: string; ini: number; fim: number }[]`:
    - minutos de 0 a 1440, ordenados por `ini`;
    - um turno que atravessa a meia-noite vira dois segmentos;
    - 24h vira um só, `{ini: 0, fim: 1440}`.
  - `sobreposicoes(turnos): { letras: [string, string]; ini: number; fim: number }[]`: interseções de tamanho positivo entre segmentos de turnos diferentes, ordenadas por `ini`.
- **Tela:** a linha do turno fica assim:
  `[A ▾]  08:00 às 20:00  ▐ 12h ▌  Salvar  Remover`
  - **Bloco:** `font-cond text-base font-semibold rounded px-2.5 py-0.5`, com fundo na cor do serviço e texto em `corDoTexto`.
  - **Régua no topo da seção Turnos:**
    - marcas em 0h, 6h, 12h, 18h e 24h, e cada segmento na cor do serviço, com a letra dentro;
    - `role="img"` e `aria-label` como "Turnos do dia: A das 08h às 20h; B das 20h às 08h";
    - embaixo, para cada par sobreposto: "Os turnos A e B se sobrepõem das 07h às 08h." (`role="status"`).

- [ ] **Passo 1: testes que falham:**

```ts
// turnos-lib.test.ts
it('textoHora e textoFaixa', () => {
  expect(textoHora('07:30')).toBe('07h30');
  expect(textoFaixa('08:00', '20:00')).toBe('08h–20h');
});
// [foco 19]
it('corDoTexto', () => {
  expect(corDoTexto('#6E56A8')).toBe('#FFFFFF');
  expect(corDoTexto('#000000')).toBe('#FFFFFF');
  expect(corDoTexto('#FFFF00')).toBe('#1C2430');
  expect(corDoTexto('#FFFFFF')).toBe('#1C2430');
});
it('segmentos do Pronto', () =>
  expect(segmentosDoDia([{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }])).toEqual([
    { letra: 'B', ini: 0, fim: 480 }, { letra: 'A', ini: 480, fim: 1200 }, { letra: 'B', ini: 1200, fim: 1440 },
  ]));
// [foco 18]
it('turno de 24h é um segmento só', () => expect(segmentosDoDia([{ letra: 'A', inicio: '08:00', fim: '08:00' }])).toEqual([{ letra: 'A', ini: 0, fim: 1440 }]));
it('sobreposição dos dois lados da meia-noite', () =>
  expect(sobreposicoes([{ letra: 'A', inicio: '07:00', fim: '19:00' }, { letra: 'B', inicio: '18:00', fim: '08:00' }])).toEqual([
    { letras: ['A', 'B'], ini: 420, fim: 480 }, { letras: ['A', 'B'], ini: 1080, fim: 1140 },
  ]));
it('segmentos do mesmo turno não se sobrepõem', () => expect(sobreposicoes([{ letra: 'B', inicio: '20:00', fim: '08:00' }])).toEqual([]));
```

  Em `servicos.test.tsx`, sai o teste de "Pede voluntariado em" e entram:
  - `turno não mostra "Pede voluntariado em"`: `queryByText(/Pede voluntariado/)` é `null`.
  - `duração aparece no bloco com a cor do serviço`: com BIOMA, `getByText('8h')` tem `style.backgroundColor === 'rgb(192, 138, 30)'`.
  - `horário incompleto mostra traço`: depois de limpar "Início do turno A", aparece `'—'`.
  - `régua descreve os turnos do dia`: `getByRole('img', { name: 'Turnos do dia: A das 00h às 08h' })`.
  - `sobreposição aparece em texto`: um serviço com A de 07h às 19h e B de 18h às 08h mostra "Os turnos A e B se sobrepõem das 07h às 08h e das 18h às 19h.". Vários trechos do mesmo par vão numa frase só.
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm --filter contratos test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: turnos com duração em destaque e régua do dia`.

### Task 28: Seletor de cor como o do Google Planilhas

**Arquivos:**
- Criar: `apps/web/src/componentes/SeletorDeCor.tsx` e `apps/web/src/__testes__/seletor-cor.test.tsx`
- Modificar: `apps/web/src/lib/cores.ts` e `apps/web/src/routes/_app/servicos/$id.tsx`, onde o seletor substitui a cor atual.

**Interfaces:**
- **Consome:** `CORES_SERVICO` (`contratos`) e `Popover` de `radix-ui` (já é dependência).
- **Produz `PALETA_PLANILHAS: string[][]`** em `lib/cores.ts`, com 8 linhas de 10:
  - `#000000 #434343 #666666 #999999 #B7B7B7 #CCCCCC #D9D9D9 #EFEFEF #F3F3F3 #FFFFFF`
  - `#980000 #FF0000 #FF9900 #FFFF00 #00FF00 #00FFFF #4A86E8 #0000FF #9900FF #FF00FF`
  - `#E6B8AF #F4CCCC #FCE5CD #FFF2CC #D9EAD3 #D0E0E3 #C9DAF8 #CFE2F3 #D9D2E9 #EAD1DC`
  - `#DD7E6B #EA9999 #F9CB9C #FFE599 #B6D7A8 #A2C4C9 #A4C2F4 #9FC5E8 #B4A7D6 #D5A6BD`
  - `#CC4125 #E06666 #F6B26B #FFD966 #93C47D #76A5AF #6D9EEB #6FA8DC #8E7CC3 #C27BA0`
  - `#A61C00 #CC0000 #E69138 #F1C232 #6AA84F #45818E #3C78D8 #3D85C6 #674EA7 #A64D79`
  - `#85200C #990000 #B45F06 #BF9000 #38761D #134F5C #1155CC #0B5394 #351C75 #741B47`
  - `#5B0F00 #660000 #783F04 #7F6000 #274E13 #0C343D #1C4587 #073763 #20124D #4C1130`
- **Produz `SeletorDeCor({ id, valor, aoMudar }: { id: string; valor: string; aoMudar: (cor: string) => void })`:**
  - **Gatilho:** um botão com a amostra da cor atual e uma seta, com `id` para o `<Label htmlFor>` "Cor".
  - **Grade:** botões `aria-label="Cor #RRGGBB"`, com `aria-pressed` e um visto na cor escolhida. Escolher uma fecha a grade.
  - **Cores dos serviços:** uma linha à parte, com `aria-label="Cor de <serviço>"`.
  - **Personalizada…:** um campo `aria-label="Código da cor"`, mais o seletor nativo e o botão "Usar esta cor". Texto fora de `#RRGGBB` mostra "Use o formato #RRGGBB." e não muda a cor.
  - A cor sai sempre em maiúsculas.

- [ ] **Passo 1: testes que falham** (`seletor-cor.test.tsx`, montando a ficha do serviço como em `servicos.test.tsx`):
  - `escolher na grade e salvar envia a cor`: clica em "Cor", depois em "Cor #4A86E8", depois em "Salvar". O corpo do PATCH tem `cor: '#4A86E8'`.
  - `cores dos serviços aparecem na grade`: `getByRole('button', { name: 'Cor de Pronto' })`.
  - `cor personalizada aceita #RRGGBB e recusa outro texto`: "azul" mostra a mensagem; "#1a2b3c" e "Usar esta cor" mudam a amostra para `#1A2B3C`.
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: seletor de cor como o do Google Planilhas`. Depois, abrir o PR "Fase 3 — Entrega 4.1: tela de serviços e rolagem dos cadastros" e **parar até o merge**.

---

# Entrega 4.2 — Vínculo por faixa de horário

Branch `fase3-4-2-faixas`, a partir da `main` já com a 4.1. **Tem migração (0011):** o PR lembra de rodar `pnpm --filter api db:migrar:teste` depois do merge. Especificação: o mesmo adendo de 18/11/2026.

**Decisões do usuário (18/11/2026):**
- Sem turno único: o U vira A.
- O vínculo da escala é por faixa de horário (abordagem A).
- Quando nenhuma letra é ambígua, a coluna mostra a letra e a faixa; havendo ambiguidade, só a faixa.
- Cada turno se marca separado, e "Todos os turnos" deixa de existir.
- Melhorias aceitas: totais na matriz e aviso de alteração não salva.

**Decisões minhas, ao detalhar:**
- **A regra da letra vale para a matriz inteira:** `comLetra` só é verdadeiro se cada letra tem uma faixa só e cada faixa uma letra só. Assim não se misturam colunas com e sem letra.
- **Ordem das colunas:** pelo início e, empatando, pelo fim.
- **Migração:**
  - o "todos os turnos" vira uma marcação para cada faixa dos serviços da escala;
  - a letra vira uma marcação para cada faixa com aquela letra;
  - o vínculo órfão (letra sem turno nos serviços) é descartado, porque a tela já o avisava como algo a tirar;
  - um serviço com A e U ao mesmo tempo para a migração com uma mensagem. Nos dados de teste, só Expediente e Defensoria têm U, e nenhum tem A.
- **Mínimo da coluna:** soma o mínimo das guarnições marcadas naquela faixa, pela composição em vigor no mês da versão da matriz. Ele recalcula enquanto se marca.
- **Alterações não salvas:** valem nas fichas de serviço e de escala. As de militar e guarnição ficam como estão. A pergunta é a do navegador (`confirm`): "Há alterações não salvas nesta ficha. Sair mesmo assim?".
- **"Onde é usada"** (ficha da guarnição) passa a listar as faixas ("08h–20h, 20h–08h").

### Task 29: Banco, API e importação por faixa

**Arquivos:**
- Criar:
  - `apps/api/banco/migracoes/0011_faixas.sql`;
  - `apps/api/src/cadastros/escalas-regras.ts`;
  - `apps/api/test/migracao-0011.test.ts` e `apps/api/test/escalas-regras.test.ts`.
- Modificar:
  - `pacotes/contratos/src/{servicos,escalas,guarnicoes}.ts`;
  - `apps/api/src/cadastros/{servicos,escalas,guarnicoes}.ts`;
  - `apps/api/src/importacao/servicos-escalas.ts` e `apps/api/src/carga/exemplo.ts` (U vira A);
  - os testes de API que usam `turnoLetra`, `letras` ou a letra U.

**Interfaces:**
- **Migração `0011_faixas.sql`:**
  1. Cria `escala_guarnicao.inicio` e `escala_guarnicao.fim`, preenchidos a partir de `turno_letra`:
     - num `create temp table`, entram as faixas distintas de `turno` dos serviços da escala (via `escala_servico`) cuja letra é igual a `turno_letra`, ou todas, se `turno_letra` for nulo;
     - depois apaga `escala_guarnicao`, remove `turno_letra` (a restrição única antiga cai junto), torna `inicio` e `fim` `not null`, cria `unique (versao_id, guarnicao_id, inicio, fim)` e reinsere.
  2. Se algum serviço tem os turnos A e U, gera o erro `Há serviço com turno A e turno U: troque um deles antes de migrar.`.
  3. `update turno set letra = 'A' where letra = 'U'` e recria `turno_letra_check` com `('A', 'B', 'C')`.
- **Contratos:**
  - `LetraTurno = z.enum(['A', 'B', 'C'])` e `Faixa = z.object({ inicio: Hora, fim: Hora })`.
  - `VinculosDaEscala = { itens: { guarnicaoId: Id; inicio: Hora; fim: Hora }[] }`. O refinamento recusa a repetição com "Esta guarnição já está nesta faixa.".
  - `FaixaDaEscala = { inicio: string; fim: string; letras: LetraTurno[]; servicos: string[] }`.
  - `Escala`: sai `letras`; entram `faixas: FaixaDaEscala[]` e `comLetra: boolean`.
  - `VinculoSalvo = { guarnicaoId; guarnicao; ativaNoMes; inicio; fim }`.
  - `FichaGuarnicao.usadaEm = { escalaId; escala; faixas: { inicio: string; fim: string }[] }[]`.
- **`escalas-regras.ts`:** `faixasDosTurnos(turnos: { servico: string; letra: LetraTurno; inicio: string; fim: string }[]): { faixas: FaixaDaEscala[]; comLetra: boolean }`, com a ordem e a regra da letra descritas acima.
- **API:**
  - `PUT /api/escalas/:id/vinculos/:mes` recusa com 400 em `itens.<i>.inicio` a faixa que não está em `faixas`: "A faixa 16h–00h não existe nos serviços desta escala." (`textoFaixa`).
  - Os itens saem em ordem de nome da guarnição e depois de início.
  - `gravarVinculos(tx, escalaId, vigencia, itens: { guarnicaoId: string; inicio: string; fim: string }[])`.
- **Importação:**
  - **TURNOS:** U e ÚNICO viram A. As opções passam a A, B e C, e a ajuda diz: "Letra do turno: A, B ou C. Serviço de um turno só usa A.".
  - **GUARNIÇÕES POR ESCALA, coluna TURNO** (sem lista de opções). A ajuda diz: "Vazio ou TODOS: todas as faixas da escala. Letra (A, B, C) quando ela tem um horário só na escala, ou a faixa (ex.: 08:00-20:00). Várias, separadas por vírgula.".
  - **Leitura da célula:** primeiro separa por `,` e `;`. Cada parte é uma faixa se casar `^(.+?)\s*(?:-|–|às|a)\s*(.+)$`, com as duas horas passando por `normalizarHora`; senão, é uma lista de letras separada por espaço ou `/`.
  - **Problemas:**
    - letra sem faixa na escala: o problema atual ("Turno X não existe nos serviços da escala E");
    - letra com mais de uma faixa: "Turno A tem horários diferentes nos serviços da escala E (00h–08h, 08h–20h)", com a solução "Escreva a faixa na coluna TURNO (ex.: 08:00-20:00).";
    - faixa ausente: "Faixa 09h–21h não existe nos serviços da escala E", com a solução "Confira a coluna TURNO ou os horários na aba TURNOS.".
  - **Remoções e comparação:** sai a regra "TODOS e letra avulsa"; a expansão já tira as repetições. A assinatura da versão passa a ser o conjunto de (guarnição, início, fim).

- [ ] **Passo 1: testes que falham:**
  - `migracao-0011.test.ts` **[foco 16]**, no mesmo molde da 0010, com o banco migrado até a 0010:
    - serviços Pronto (A 08–20, B 20–08), Expediente (U 08–16) e Bioma (A 00–08, B 08–16, C 16–00);
    - escala com Pronto e Expediente, e uma versão com g1 `null`, g2 `'A'` e g3 `'C'`;
    - depois da 0011:
      - g1 fica com 08:00–16:00, 08:00–20:00 e 20:00–08:00;
      - g2 fica com 08:00–20:00;
      - g3 não fica com nada;
      - o turno do Expediente tem letra A;
      - `insert` de turno com letra U é rejeitado.
  - O mesmo arquivo testa `serviço com A e U para a migração com a mensagem`.
  - `escalas-regras.test.ts`:
    - Pronto A/B mais JES A 08–20 dá `[{08:00–20:00, letras [A], servicos [Pronto, JES]}, {20:00–08:00, [B], [Pronto]}]`, com `comLetra` true;
    - somando Bioma A 00–08, `comLetra` fica false e a ordem passa a 00–08, 08–20, 20–08.
  - `escalas.test.ts`:
    - `reúne serviços e devolve as faixas`;
    - `vínculo com faixa fora da escala é 400`;
    - `tirar serviço deixa o vínculo da faixa que sumiu`;
    - saem os testes de "Todos os turnos" e da letra U.
  - `servicos.test.ts`: `letra U é 400`.
  - `importacao-servicos-escalas.test.ts`:
    - `U e ÚNICO viram A`;
    - `TURNO vazio vira todas as faixas da escala`;
    - `letra ambígua vira problema com a solução de escrever a faixa`;
    - `faixa escrita na célula é aceita` ("08:00-20:00" e "20h às 08h");
    - `faixa que não existe vira problema`;
    - `reimportar com TURNO vazio dá igual` **[foco 17]**.
- [ ] **Passo 2:** `pnpm --filter api test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter api test && pnpm --filter contratos test && pnpm --filter api typecheck`. Esperado: PASSA. O site ainda não compila com os contratos novos; o ledger registra isso, como na Tarefa 19.
- [ ] **Passo 5:** commit `Fase 3: vínculo da escala por faixa de horário (migração 0011)`.

### Task 30: Matriz por faixa com totais

**Arquivos:**
- Criar: `apps/web/src/lib/guarnicoes.ts`, com `limites(g)` tirado de `routes/_app/guarnicoes.tsx`.
- Modificar:
  - `apps/web/src/componentes/escalas/Matriz.tsx`;
  - `apps/web/src/routes/_app/guarnicoes.tsx` e `guarnicoes/$id.tsx` ("Onde é usada");
  - `apps/web/src/lib/turnos.ts` (sem U);
  - `apps/web/src/__testes__/{escalas,guarnicoes}.test.tsx`.

**Interfaces:**
- **Consome:** `Escala.faixas`, `Escala.comLetra` e `VinculoSalvo` com faixa (Tarefa 29), mais `textoFaixa` (Tarefa 27).
- **Cabeçalho da coluna:** com `comLetra`, a letra (`font-cond text-base font-semibold`) e, embaixo, a faixa (`text-xs`); sem `comLetra`, só a faixa. A caixa tem `aria-label` "`<guarnição>` em A (08h–20h)", ou "`<guarnição>` em 08h–20h" sem letra.
- **Linha:** nome, a etiqueta "desativada" quando for o caso e, em `text-xs text-apagado`, `limites(g)` ("de 4 a 5 militares", "3 militares", "sem composição").
- **Rodapé:** em cada coluna, "mín. N", com a soma do `minimo` das guarnições marcadas naquela faixa. Guarnição sem linha na lista conta 0.
- **Órfão:** "A faixa 16h–00h não existe mais nos serviços desta escala: ABT. Salve a matriz para tirá-la."
- **Gravar:** envia `{ guarnicaoId, inicio, fim }` por marcação.

- [ ] **Passo 1: testes que falham**, com fixtures no formato novo:
  - `colunas mostram letra e faixa quando não há ambiguidade` (`'A'` e `'08h–20h'` no cabeçalho)
  - `com letra ambígua, colunas mostram só a faixa`
  - `não há coluna Todos os turnos`
  - `marcar envia a faixa`
  - `mínimo da coluna soma as guarnições marcadas` (ABT, mínimo 2, mais APH, mínimo 2, dão "mín. 4")
  - `linha mostra o tamanho da guarnição`
  - `faixa que saiu da escala mostra o aviso`
  - `onde é usada mostra as faixas` (guarnicoes.test.tsx)
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm --filter web test && pnpm typecheck`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Fase 3: matriz da escala por faixa, com totais`.

### Task 31: Aviso de alteração não salva

**Arquivos:**
- Criar: `apps/web/src/componentes/AlteracoesPendentes.tsx` e `apps/web/src/__testes__/pendentes.test.tsx`
- Modificar:
  - `apps/web/src/routes/_app/servicos/$id.tsx`, `apps/web/src/componentes/servicos/Turnos.tsx`;
  - `apps/web/src/routes/_app/escalas/$id.tsx`, `apps/web/src/componentes/escalas/{ServicosDaEscala,Matriz}.tsx`.

**Interfaces:**
- **Produz:**
  - `ProvedorDePendencias({ children })`: guarda as chaves com alteração pendente e usa `useBlocker` do TanStack Router, com `shouldBlockFn` que pergunta por `window.confirm(MENSAGEM_PENDENTE)` quando há pendência e `enableBeforeUnload` nas mesmas condições.
  - `usePendencia(chave: string, sujo: boolean): void`.
  - `EtiquetaPendente({ sujo }: { sujo: boolean })`: mostra "Alterações não salvas" (`role="status"`, `text-xs text-alerta`), ao lado do botão de salvar do bloco.
  - `MENSAGEM_PENDENTE = 'Há alterações não salvas nesta ficha. Sair mesmo assim?'`.
- **Quando um bloco está sujo:** o estado é diferente dos dados com que ele abriu. Isso vale para a identificação, cada linha de turno (e a linha nova), os serviços da escala e as marcações da matriz. O mês "Vale a partir de" não conta. Depois de gravar, a `key` por dados remonta o bloco limpo.

- [ ] **Passo 1: testes que falham** **[foco 20]**:
  - `mudar o título mostra Alterações não salvas`
  - `trocar de escala com alteração pendente pergunta e fica ao cancelar` (`vi.spyOn(window, 'confirm').mockReturnValue(false)`; clicar em outra escala da lista; o campo "Título no documento" mantém o texto digitado)
  - `confirmando, troca de escala`
  - `sem alteração, troca sem perguntar` (`confirm` não é chamado)
  - `mudar o horário de um turno mostra Alterações não salvas`
  - `depois de salvar, o aviso some sem perguntar`
- [ ] **Passo 2:** `pnpm --filter web test`. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm test && pnpm typecheck`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `Fase 3: aviso de alteração não salva nas fichas de serviço e escala`. Depois, abrir o PR "Fase 3 — Entrega 4.2: vínculo por faixa de horário" e **parar até o merge**. O PR lembra: **rodar `pnpm --filter api db:migrar:teste` depois do merge**.

---

# Entrega 5 — Cotas e feriados

Branch `fase3-5-cotas-feriados`.

### Task 32: API de Cotas e Feriados

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

### Task 33: Telas de Cotas e Feriados

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

### Task 34: Importação de Cotas e Feriados, e fechamento da fase

**Arquivos:**
- Criar: `apps/api/src/importacao/cotas.ts`, `apps/api/src/importacao/feriados.ts`, `apps/api/test/importacao-cotas-feriados.test.ts`
- Modificar: `docs/superpowers/plans/2026-11-16-roadmap-migracao.md` (nota "Como ficou" na fase 3) e `CLAUDE.md` local (estrutura e contagem de testes; o arquivo não é versionado)

**Interfaces:**
- Consome: `servicoDaOperacao` do `dominio` (mesmo critério do protótipo para achar o serviço da operação); `modelo` e `valores` (Tarefa 12).
- **Modelo:** cada importador (`cotas` e `feriados`) declara a aba com as colunas abaixo; `valores` traz os serviços PJES e diária da unidade.
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
- Antiguidade institucional (base nos almanaques, antiguidade por nível derivada pelo sistema): fase 7, só quando o escopo for institucional. Registrada no adendo "Modelo de planilha e ajustes da ficha" do design, sem implementação.
- Convites e cadastro de usuários: fase 7, junto com o gestor por nível.
- Mudar o horário de um turno que já tem militares escalados (versão do turno ou bloqueio): fase 4, quando a escala passar a gravar alocações pela tela.
- Exposição do motor pela API (pré-escala, distribuições, quem pode ocupar a vaga): fase 4, com as telas que a usam.
