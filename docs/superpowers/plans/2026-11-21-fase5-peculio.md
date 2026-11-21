# Fase 5 — Pecúlio: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-11-20-peculio-design.md`.

**Entregas da fase** (o número é a ordem de execução; cada uma ganha as tarefas quando for começar):
1. **Rastreio e CNH:** a lotação passa a ser só a unidade; a tabela de lotação vira o rastreio do militar; o "Histórico de rastreio" com "Alterar situação" e a linha do tempo; a CNH separada do quadro de motoristas; as sete seções do 2º GB. **Mesclada (#73).**
2. **Ficha ampliada e dono por bloco:** nome completo, sexo, nascimento, telefone, e-mail institucional, comportamento; motivo e boletim no afastamento e os tipos novos; quem edita o quê. **Detalhada abaixo.**
3. **Importação do Pecúlio e o módulo:** o modelo `PECÚLIO`, a lista e a ficha do módulo, os aniversariantes do mês. **Detalhada abaixo.**
4. **Retorno da validação** (lote de 21/11/2026; plano escrito quando for começar):
   - Efetivo por dia e Escala do mês: horário do trecho só ao passar o mouse e faixa do serviço mais grossa; "Mostrar só vagas vazias" vira "Ocultar guarnições completas"; cada função com painel próprio; cartões alinhados pelo topo; "Removidos" dentro do painel do dia; vagas até o máximo, as extras marcadas "opcional"; sai a lista "Falta…"; abas Ordinário/Operações na largura toda, com painéis separados.
   - Contraste mínimo de 4,5:1 entre o texto e a cor do serviço.
   - Grade geral: ao clicar numa célula, a linha e a coluna dela ficam marcadas.
   - CNH: sai o "pela X" dos quadrados; clicar numa categoria menor com as maiores marcadas deixa só a menor; clicar na maior apaga ela e as que ela acendeu; a moto (A) continua isolada.
   - Nomes: a tela "Serviços" passa a se chamar "Turnos" (como as pessoas pensam; "serviço" fica como entidade interna), com os textos que citam a tela; "Importar da Planilha" vira "Importar".
   - A vaga vazia (opção A a D do mockup da DESIGN) entra aqui se o usuário escolher antes.

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

---

# Entrega 2 — Ficha ampliada e dono por bloco

**Goal:** a ficha do militar com os atributos do Pecúlio já decididos e cada bloco editado só por quem é dono dele.

**Architecture:** uma migração acrescenta as colunas novas ao militar e ao afastamento e os tipos novos de afastamento. A API ganha a conferência "papel numa unidade acima" e separa, em cada rota do militar, os campos do Pecúlio dos campos da escala. A ficha mostra os blocos novos e trava os que a pessoa não pode editar, dizendo por quê.

**Tech Stack:** Postgres (migração SQL), Hono, zod, React + TanStack, Vitest.

**Branch:** `fase5-2-ficha-e-dono-por-bloco`, a partir da `main` atualizada. Commits `Fase 5.2: …`; PR "Fase 5 — Entrega 2: ficha ampliada e dono por bloco". **Migração 0024.** Sonnet executa; Opus revisa. Ao terminar, enviar o branch e o resumo à PLANEJAMENTO (não abrir PR nem mesclar).

## Global Constraints

- **D7:** sem CPF e sem o ano de nascimento; o nascimento guarda só dia e mês. O motivo do afastamento não guarda diagnóstico (aviso no campo).
- **E-mail institucional:** só `@bombeiros.pe.gov.br` (sem distinção de maiúsculas), único entre os militares, pode ficar vazio.
- **Dono do bloco Pecúlio:** papel de cadastro (escalante, gestor ou administrador) numa unidade **acima** da lotação atual do militar (a unidade mãe ou mais alta). **Dono do bloco da escala:** papel na lotação ou acima, como hoje.
- Bloquear não é esconder: o bloco sem permissão aparece só para leitura, com a frase "Este bloco é alterado por quem tem papel em <unidade de cima>.".
- No fim: esquema do banco (0024 e as colunas), contagens no `CLAUDE.md` local, `pnpm test && pnpm typecheck && pnpm build:vercel`.

**Decisões desta entrega** (do usuário, no design; as minhas marcadas):
- Blocos do Pecúlio: identificação (posto, nome completo, nome de guerra, antiguidade, sexo), dados pessoais (nascimento), contato (telefone, e-mail), comportamento, afastamentos e a mudança de **lotação** no "Alterar situação". Blocos da escala: equipe e jornada (no "Alterar situação", com a lotação travada), motorista e CNH, voluntário JES.
- Criar militar é do Pecúlio (papel acima da unidade onde ele entra).
- Nascimento em duas colunas, `nascimento_dia` e `nascimento_mes` (*minha decisão*, para não guardar ano no teste); a data completa entra só no servidor do Estado.
- Nome completo fica vazio para quem já existe; a lista e a ficha mostram a pendência "Nome completo em falta" (*minha decisão*; para militar novo é obrigatório).
- Comportamento: Excepcional, Ótimo, Bom, Insuficiente, Mau, ou vazio; o boletim é texto livre curto.
- Tipos novos de afastamento: Adido, Agregado, L.E e DTS (LTS já existe), criados pela migração sem duplicar.

## Review Focus

1. **Escalante só da 1ª SB:** vê a ficha inteira, edita equipe, jornada, motorista, CNH e voluntário; os blocos do Pecúlio ficam só para leitura com a frase; a API recusa (403) um PATCH com campo do Pecúlio, mesmo junto com um campo da escala, e não grava nada. Tarefa 2.
2. **Papel no 2º GB:** edita tudo de um militar da 1ª SB, inclusive a lotação no "Alterar situação"; o administrador também. Tarefa 2.
3. **E-mail repetido com maiúsculas diferentes** ("Fulano@bombeiros.pe.gov.br" e "fulano@bombeiros.pe.gov.br"): 409 "Este e-mail já é de outro militar."; e-mail de outro domínio: 400 no campo. Tarefa 1.
4. **Nascimento 31 de fevereiro:** 400 no campo; 29 de fevereiro passa. Tarefa 1.
5. **Afastamento com motivo de 201 caracteres:** 400 no campo, sem erro do banco. Tarefa 4.

---

### Task 1: Migração 0024 e os contratos

**Files:** create `apps/api/banco/migracoes/0024_ficha_do_peculio.sql`; modify `pacotes/contratos/src/militares.ts` (`NovoMilitar`, `EdicaoMilitar`, `FichaMilitar`, `NovoAfastamento`, `EdicaoAfastamento`). **Test:** `apps/api/test/esquema-estrutura.test.ts`, `pacotes/contratos/test/militares.test.ts`.

**Interfaces:**
- Produces (militar): `nome_completo text null`, `sexo text null check (sexo in ('M','F'))`, `nascimento_dia smallint null`, `nascimento_mes smallint null` (os dois juntos, dia válido para o mês, 29/02 aceito), `telefone text null`, `email text null` (único por `lower(email)`, check do domínio), `comportamento text null` (check na lista), `comportamento_boletim text null`.
- Produces (afastamento): `motivo text null` (até 200), `boletim text null` (até 60).
- Produces (contratos): os campos acima em camelCase (`nomeCompleto`, `sexo`, `nascimento: { dia, mes } | null`, `telefone`, `email`, `comportamento`, `comportamentoBoletim`; `motivo`, `boletim`); `Comportamento = z.enum(['Excepcional','Ótimo','Bom','Insuficiente','Mau'])`.

- [ ] **Step 1: Testes:** o banco recusa e-mail fora do domínio e repetido sem distinção de maiúsculas (Review Focus 3), sexo fora de M/F, comportamento fora da lista, dia sem mês; os tipos Adido, Agregado, L.E e DTS existem uma vez só, mesmo rodando a migração duas vezes; no contrato, 31/02 é recusado e 29/02 passa (Review Focus 4), e-mail de outro domínio é recusado com "Use o e-mail institucional (@bombeiros.pe.gov.br).", motivo com mais de 200 caracteres é recusado.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter api test esquema-estrutura` e `pnpm --filter contratos test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.2: migração 0024 e contratos da ficha`.

### Task 2: Dono por bloco na API

**Files:** modify `apps/api/src/acesso.ts` (nova `temPapelAcima`), `apps/api/src/cadastros/militares.ts` (`POST /unidades/:u/militares`, `PATCH /militares/:id`, `POST /militares/:id/situacao`, rotas de afastamento; a ficha devolve `podeEditar`). **Test:** `apps/api/test/militares.test.ts`, `apps/api/test/acesso.test.ts`.

**Interfaces:**
- Produces: `temPapelAcima(c, usuarioId, unidadeId, papeis, hoje): Promise<boolean>` (papel vigente numa unidade cujo caminho contém o da unidade e é diferente dela); `FichaMilitar.podeEditar: { peculio: boolean; escala: boolean }`.

- [ ] **Step 1: Testes** (Review Focus 1 e 2):
  - escalante da 1ª SB: PATCH só com `voluntarioJes` passa; PATCH com `nomeCompleto` (sozinho ou junto com `voluntarioJes`) é 403 "Este campo é alterado por quem tem papel no 2º GB." e nada é gravado; "Alterar situação" mudando só equipe e jornada passa, mudando a lotação é 403; criar militar na 1ª SB é 403; incluir, editar ou remover afastamento é 403;
  - usuário com papel no 2º GB e o administrador: tudo passa;
  - a ficha devolve `podeEditar` certo para os três.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement:** a unidade de referência é a lotação atual do militar (para criar, a unidade da rota); o PATCH confere os campos do Pecúlio e os da escala separadamente, antes de gravar.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS (os testes que criavam militar ou afastamento com escalante da seção passam a usar papel no GB).
- [ ] **Step 5: Commit** `Fase 5.2: dono por bloco na API`.

### Task 3: A ficha ampliada

**Files:** modify `apps/web/src/componentes/militares/Identificacao.tsx` (nome completo, nome de guerra, sexo), create `apps/web/src/componentes/militares/DadosPessoais.tsx` (nascimento dia/mês), `Contato.tsx` (telefone, e-mail), `Comportamento.tsx`; modify `apps/web/src/routes/_app/militares/$id.tsx` (ordem dos blocos e `podeEditar`), `apps/web/src/routes/_app/militares.tsx` (novo militar pede nome completo; pendência "Nome completo em falta" na lista). **Test:** `apps/web/src/__testes__/militares.test.tsx`.

- [ ] **Step 1: Testes:** cada bloco novo grava só o que mudou; com `podeEditar.peculio = false`, os blocos do Pecúlio ficam sem campos editáveis e mostram "Este bloco é alterado por quem tem papel em 2º GB."; e-mail fora do domínio mostra a mensagem do contrato no campo; o militar sem nome completo mostra a pendência na lista e na ficha; "Novo militar" exige nome completo.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** O "Alterar situação" trava o campo Lotação quando `podeEditar.peculio = false`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.2: ficha ampliada`.

### Task 4: Afastamento com motivo e boletim

**Files:** modify `apps/web/src/componentes/militares/Afastamentos.tsx`, `apps/api/src/cadastros/militares.ts` (rotas de afastamento gravam e devolvem `motivo` e `boletim`). **Test:** `militares.test.tsx`, `apps/api/test/militares.test.ts`.

- [ ] **Step 1: Testes:** incluir afastamento do tipo LTS com motivo e boletim grava e mostra os dois; o campo motivo tem o aviso "Não escreva diagnóstico."; motivo com 201 caracteres é 400 no campo (Review Focus 5); a linha do tempo do rastreio mostra o tipo do afastamento (não o motivo).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.2: afastamento com motivo e boletim`. No fim da entrega:
  - esquema do banco (0024);
  - contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - **enviar o branch e o resumo à PLANEJAMENTO**, com o aviso da migração 0024 e a lista curta para a sandbox (lembrar: para testar o dono por bloco, é preciso um usuário com papel no 2º GB além do escalante da 1ª SB).

---

# Entrega 3 — Importação do Pecúlio e o módulo

**Goal:** trazer os dados do Pecúlio pelo modelo próprio e dar ao módulo Pecúlio a sua tela (lista de todos os militares do GB e os aniversariantes do mês), fechando o dono por bloco também na importação.

**Architecture:** um importador novo, `peculio`, no mesmo padrão dos outros (modelo gerado pela API com a aba `AJUDA`, prévia, problemas com a solução, importar de novo sem duplicar), que só quem tem papel numa unidade acima pode usar. O importador de `MILITARES` (da seção) passa a cuidar só do que é da escala para quem já existe. Uma rota de leitura lista os militares de uma unidade e das de baixo, com os aniversariantes do mês, e a tela nova "Pecúlio" no menu.

**Tech Stack:** Hono (API), zod (contratos), ExcelJS (modelo), React + TanStack (site), Vitest.

**Branch:** `fase5-3-importacao-e-modulo`, a partir da `main` depois da entrega 2. Commits `Fase 5.3: …`; PR "Fase 5 — Entrega 3: importação do Pecúlio e o módulo". **Sem migração** (as colunas vieram na 0024). Sonnet executa; Opus revisa. Ao terminar, enviar o branch e o resumo à PLANEJAMENTO (não abrir PR nem mesclar).

**Spec:** `docs/superpowers/specs/2026-11-20-peculio-design.md` (Importação do Pecúlio, Telas, Quem edita o quê).

## Global Constraints

- **A planilha é o contrato:** quem envia se adapta ao modelo; nada de tolerância para planilha antiga. Inconsistência nos dados é problema de quem migra.
- **D7:** a planilha do Pecúlio não leva CPF nem ano de nascimento; o modelo não tem essas colunas.
- **Dono por bloco:** importar o Pecúlio exige papel numa unidade acima das lotações das linhas; a importação de `MILITARES` pela seção não altera campo do Pecúlio de quem já existe.
- No fim: contagens no `CLAUDE.md` local; `pnpm test && pnpm typecheck && pnpm build:vercel`.

**Decisões desta entrega** (do design; as minhas marcadas):
- **Colunas do modelo `PECÚLIO`:** MATRÍCULA, POSTO/GRAD, NOME COMPLETO, NOME DE GUERRA, ANTIGUIDADE, SEXO (M/F), NASCIMENTO (dd/mm), TELEFONE, E-MAIL, COMPORTAMENTO, BOLETIM DO COMPORTAMENTO, LOTAÇÃO (sigla da seção) (*minha decisão*: as colunas são as do modelo do design, na ordem da ficha).
- **Linha nova** (matrícula que não existe) cria o militar com lotação na seção da coluna LOTAÇÃO, a partir do mês atual, jornada Pronto e sem equipe; equipe e jornada ficam com o escalante (*minha decisão*: a planilha do Pecúlio não tem equipe nem jornada).
- **Linha de militar que já existe** atualiza só os campos do Pecúlio; LOTAÇÃO diferente da atual vira um aviso na prévia ("mudar a lotação é pelo Alterar situação"), não uma mudança (*minha decisão*: a lotação pede o "a partir de").
- **Importação de `MILITARES` (da seção)** — resolve o "Importante" da revisão da entrega 2: para quem já existe, deixa de alterar POSTO/GRAD, NOME DE GUERRA e ANTIG; se a planilha trouxer valor diferente, a prévia avisa "Este campo é do Pecúlio: altere pela importação do Pecúlio ou pela ficha." e a linha segue com os campos da escala. Cadastrar militar novo por essa importação continua exigindo o papel de cima, como na ficha (*minha decisão*, alinhada ao dono por bloco já decidido).
- **O módulo:** item "Pecúlio" no menu, para quem tem papel de cadastro; a lista mostra os militares da unidade do usuário e das de baixo, com busca por nome ou matrícula e filtro por lotação; clicar abre a ficha do militar (a mesma ficha, que é única); "Aniversariantes do mês" numa lista na mesma tela, ordenada pelo dia.

## Review Focus

1. **Escalante só da 1ª SB tenta importar o Pecúlio:** 403 com a frase de quem altera; nada é gravado nem mostrado na prévia. Tarefa 1.
2. **Planilha do Pecúlio com a mesma matrícula em duas linhas:** a segunda vira problema ("Matrícula repetida na planilha") e a primeira entra. Tarefa 1.
3. **Importação de MILITARES pela seção com antiguidade diferente da gravada:** a antiguidade não muda; a prévia avisa; os campos da escala da linha entram. Tarefa 2.
4. **Aniversariantes de um mês sem ninguém:** a lista diz "Nenhum aniversariante neste mês." Tarefa 3.
5. **Militar sem nascimento preenchido:** não aparece nos aniversariantes e não quebra a lista. Tarefa 3.

---

### Task 1: O importador do Pecúlio

**Files:** create `apps/api/src/importacao/peculio.ts`; modify `apps/api/src/importacao/registro.ts` (registra `peculio`), `apps/api/src/importacao/rotas.ts` (a conferência do papel de cima para `peculio`), `pacotes/contratos/src/` (o nome `peculio` no tipo de cadastro importável). **Test:** create `apps/api/test/importacao-peculio.test.ts`.

**Interfaces:**
- Consumes: `temPapelAcima` (entrega 2), os contratos da ficha (entrega 2).
- Produces: o cadastro importável `peculio`, com `GET /api/unidades/:u/importacao/peculio/modelo` e as rotas de prévia e confirmação que os outros importadores já têm.

- [ ] **Step 1: Testes:**
  - o modelo tem a aba `PECÚLIO` com as 12 colunas na ordem das Decisões e a aba `AJUDA` (com os valores aceitos de SEXO e COMPORTAMENTO);
  - linha nova cria o militar com os campos e a lotação na seção, a partir do mês atual, jornada Pronto;
  - linha de quem já existe atualiza só os campos do Pecúlio; LOTAÇÃO diferente vira aviso, sem mudar o rastreio;
  - e-mail fora do domínio, NASCIMENTO 31/02, SEXO fora de M/F e COMPORTAMENTO fora da lista viram problema com a solução, e a linha é pulada;
  - matrícula repetida na planilha (Review Focus 2);
  - importar o mesmo arquivo de novo não grava nada;
  - escalante só da seção é 403 (Review Focus 1); gestor do 2º GB e administrador importam.
- [ ] **Step 2: Run** `pnpm --filter api test importacao-peculio`. Expected: FAIL.
- [ ] **Step 3: Implement** no padrão de `importacao/militares.ts` (colunas declaradas uma vez, usadas pelo modelo e pela leitura).
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.3: importação do Pecúlio`.

### Task 2: A importação de MILITARES respeita o dono por bloco

**Files:** modify `apps/api/src/importacao/militares.ts`. **Test:** `apps/api/test/importacao-militares.test.ts`.

- [ ] **Step 1: Testes** (Review Focus 3): escalante da seção importa uma linha de militar que já existe com ANTIG, POSTO/GRAD ou NOME DE GUERRA diferentes: esses campos não mudam, a prévia mostra o aviso "Este campo é do Pecúlio: altere pela importação do Pecúlio ou pela ficha.", e equipe, jornada, motorista, CNH e voluntário JES da linha entram; linha de militar novo com escalante só da seção é problema "Cadastrar militar é de quem tem papel em <unidade de cima>."; o gestor do 2º GB continua podendo cadastrar por essa importação.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** A ajuda do modelo de `MILITARES` diz que posto, nome de guerra e antiguidade de quem já existe vêm do Pecúlio.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.3: importação de militares respeita o dono por bloco`.

### Task 3: A lista do Pecúlio e os aniversariantes (API)

**Files:** modify `apps/api/src/cadastros/militares.ts` (nova rota), `pacotes/contratos/src/militares.ts`. **Test:** `apps/api/test/militares.test.ts`.

**Interfaces:**
- Produces: `GET /api/unidades/:u/peculio?mes=aaaa-mm` → `{ militares: ItemDoPeculio[]; aniversariantes: { militarId: string; posto: string; nomeGuerra: string; dia: number; lotacao: string }[] }`, com `ItemDoPeculio = { militarId; matricula; posto; nomeGuerra; nomeCompleto: string | null; lotacao: string; telefone: string | null; email: string | null; pendencias: string[] }`; lista os militares lotados na unidade `u` e nas de baixo no mês; exige papel de cadastro em `u`.

- [ ] **Step 1: Testes:** com a unidade 2º GB, a lista traz militares da 1ª e da 2ª SB; com a 1ª SB, só os dela; os aniversariantes do mês vêm em ordem de dia (Review Focus 4 e 5: mês sem ninguém traz lista vazia; quem não tem nascimento não aparece); sem papel em `u` é 403.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.3: lista do Pecúlio e aniversariantes na API`.

### Task 4: A tela do módulo Pecúlio

**Files:** create `apps/web/src/routes/_app/peculio.tsx`, `apps/web/src/api/peculio.ts`; modify `apps/web/src/componentes/Trilho.tsx` (item "Pecúlio", para quem tem papel de cadastro). **Test:** create `apps/web/src/__testes__/peculio.test.tsx`.

- [ ] **Step 1: Testes:** o menu mostra "Pecúlio"; a tela lista os militares com posto, nome de guerra, nome completo, lotação, telefone e e-mail, e as pendências; a busca por nome ou matrícula e o filtro por lotação funcionam; clicar no militar abre a ficha dele (`/militares/:id`); a seção "Aniversariantes do mês" mostra a lista ordenada pelo dia, ou "Nenhum aniversariante neste mês." (Review Focus 4); o botão "Importar" abre a importação do Pecúlio.
- [ ] **Step 2: Run** `pnpm --filter web test peculio`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test` e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.3: tela do módulo Pecúlio`. No fim da entrega:
  - contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - **enviar o branch e o resumo à PLANEJAMENTO**, com a lista curta para a sandbox (lembrar: importar o Pecúlio pede um usuário com papel no 2º GB).

---

# Entrega 4 — Retorno da validação (lote de 21/11/2026)

**Goal:** os ajustes que a validação pediu no Efetivo por dia, na Escala do mês, na Grade geral, na CNH e nos nomes, sem mudar nenhuma regra de escala.

**Architecture:** tarefas de tela, cada uma com seu teste, mais um ajuste de cor no `lib/cores.ts` e uma troca de rótulos. Nenhuma migração e nenhuma mudança na API, salvo o rótulo de erro que cita a tela de Serviços.

**Tech Stack:** React + TanStack Query (site), Tailwind, Vitest + Testing Library.

**Branch:** `fase5-4-retorno-da-validacao`, a partir da `main` depois da entrega 2 (e da 3, se já mesclada). Commits `Fase 5.4: …`. **Sem migração.** Modelos: Sonnet executa; Opus revisa o branch no fim. Ao terminar, enviar o branch e o resumo à PLANEJAMENTO (não abrir PR nem mesclar).

**Spec:** sem spec própria; o lote está em "Pendências conhecidas" e no registro de decisões de 21/11/2026 (`docs/decisoes.md`). Itens citados como entrega.item, por exemplo 5.4.3.

## Global Constraints

- Textos em português, sem jargão. A tela passa a se chamar **"Turnos"**; "serviço" fica só como entidade interna, e nenhuma tela ou mensagem mostra "Serviços" depois desta entrega.
- Contraste mínimo de **4,5:1** entre o texto e o fundo de qualquer cor de serviço.
- Nenhuma regra de escala muda (quem pode ocupar a vaga, a CNH que vale, a pré-escala).
- No fim: `pnpm test && pnpm typecheck && pnpm build:vercel`.

**Decisões desta entrega** (minhas, pequenas):
- O ajuste de contraste escurece ou clareia o **fundo** da cor do serviço, em passos de 5%, até 4,5:1 com o texto escolhido por `corDoTexto`. A cor escolhida pelo usuário continua a mesma para quem não é o caso (*minha decisão*: o valor salvo não muda; só a exibição).
- Vaga vazia: **opção A** do mockup da DESIGN (decisão do usuário, 21/11/2026), na Tarefa 8.
- O texto "pela X" some dos quadrados de CNH, e a frase de ajuda fica como está.

## Review Focus

1. **Cor de serviço clara com texto branco:** o texto que sai no quadrado tem contraste de 4,5:1 ou mais, para qualquer cor da paleta. Tarefa 2.
2. **Clicar na categoria menor com as maiores marcadas:** as maiores saem e fica só a menor; clicar na maior marcada apaga ela e as que ela acendeu. Tarefa 5.
3. **Serviço chamado "Turnos" no meio de um texto de erro antigo:** nenhuma mensagem ao usuário cita a tela "Serviços" depois da entrega. Tarefa 6.
4. **Trecho ocupado com horário e sem mouse (toque no celular):** o horário aparece ao tocar, não só ao passar o mouse, para não deixar a informação escondida no celular. Tarefa 1.
5. **Célula sem linha ou coluna para marcar** (militar sem nenhum dia, ou dia sem militar): a marcação não quebra. Tarefa 4.

---

### Task 1: Efetivo por dia e Escala do mês: informação mais leve

**Files:** `apps/web/src/componentes/efetivo-por-dia/CardDoEfetivo.tsx`, `apps/web/src/componentes/escala-do-mes/DiaDaEscala.tsx`, `apps/web/src/routes/_app/escala-do-mes.tsx` (botão). **Test:** `apps/web/src/__testes__/efetivo-por-dia.test.tsx`, `apps/web/src/__testes__/escala-do-mes.test.tsx`.

- [ ] **Step 1: Testes** (Review Focus 4):
  - o horário de um trecho ocupado não aparece no texto visível; aparece no `title` e ao focar o trecho; ao tocar (evento de toque), também aparece;
  - a faixa do serviço tem altura de `h-3` (no lugar da altura atual, menor);
  - o botão de filtro se chama "Ocultar guarnições completas" e tem `aria-pressed`;
  - cada função de uma guarnição é um painel próprio com o cabeçalho da função;
  - "Removidos:" sai da lista do dia e vai para dentro do painel "Removidos" do dia, que cresce para mostrá-lo;
  - as vagas aparecem até o máximo; as que passam do mínimo ficam com a etiqueta "opcional";
  - a frase "Falta…" não aparece em nenhum card.
- [ ] **Step 2: Run** os dois arquivos. Expected: FAIL.
- [ ] **Step 3: Implement.** Os cartões usam `items-start` para alinhar pelo topo.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: efetivo e escala do mês com informação mais leve`.

### Task 2: Contraste de 4,5:1 nas cores de serviço

**Files:** `apps/web/src/lib/cores.ts` (nova `corLegivel(fundo: string): { fundo: string; texto: '#FFFFFF' | '#1C2430' }`). Consumidores: `componentes/grade/CelulaDaGrade.tsx`, `componentes/efetivo-por-dia/*`, `componentes/escala-do-mes/*`, `componentes/grade/AdicionarServico.tsx`. **Test:** `apps/web/src/__testes__/estilo.test.tsx`.

**Interfaces:**
- Produces: `corLegivel(fundo)` devolve o fundo ajustado (igual ao de entrada quando já passa) e a cor do texto que dá no mínimo 4,5:1.

- [ ] **Step 1: Testes** (Review Focus 1): para `#3C78D8` (o caso da validação), `corLegivel` devolve um fundo com texto de contraste ≥ 4,5; para `#2F8F5B` (verde da paleta), devolve o mesmo fundo; uma varredura da paleta `PALETA_PLANILHAS` inteira fica ≥ 4,5 em todas.
- [ ] **Step 2: Run** `pnpm --filter web test estilo`. Expected: FAIL.
- [ ] **Step 3: Implement** o escurecimento ou clareamento em passos de 5% e troque os consumidores para `corLegivel`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: contraste de 4,5:1 nas cores de serviço`.

### Task 3: Abas do "Adicionar serviço" com a largura toda

**Files:** `apps/web/src/componentes/grade/AdicionarServico.tsx`. **Test:** `apps/web/src/__testes__/grade-painel.test.tsx`.

- [ ] **Step 1: Testes:** as abas Ordinário e Operações ocupam a largura do painel (classe `w-full` na lista de abas, cada aba `flex-1`); cada aba tem o seu painel separado com borda.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: abas do adicionar serviço na largura toda`.

### Task 4: Grade geral: linha e coluna marcadas ao clicar

**Files:** `apps/web/src/componentes/grade/TabelaDaGrade.tsx`, `apps/web/src/componentes/grade/CelulaDaGrade.tsx`. **Test:** `apps/web/src/__testes__/grade.test.tsx`.

- [ ] **Step 1: Testes** (Review Focus 5): clicar numa célula põe `data-linha-marcada` na linha do militar e `data-coluna-marcada` nas células da coluna do dia; a marcação sai ao escolher outra célula; uma grade sem linhas ou sem colunas não quebra.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** com um fundo leve na linha e na coluna (usa `escolhida` que já existe em `TabelaDaGrade`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: grade marca a linha e a coluna da célula`.

### Task 5: CNH: sai o "pela X" e o clique na menor

**Files:** `apps/web/src/componentes/militares/Motorista.tsx`. **Test:** `apps/web/src/__testes__/militares.test.tsx`.

- [ ] **Step 1: Testes** (Review Focus 2): com a carteira E marcada (D, C e B acesos pela hierarquia), clicar em C deixa só C na carteira (E sai, D também sai, e C, B continuam pela hierarquia de C); clicar em E apaga E e as que ela acendeu; nenhum quadrado mostra o texto "pela X"; a moto (A) continua separada; a frase de ajuda não muda.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** A regra: clicar numa categoria que está acesa só pela hierarquia tira da carteira a maior categoria que a acende, e ela própria passa a ser a carteira.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: CNH sem o pela X e com o clique na menor`.

### Task 6: "Turnos" no lugar de "Serviços"

**Files:** `apps/web/src/componentes/Trilho.tsx:38` (nome do item e rótulo), `apps/web/src/routes/_app/servicos*.tsx` (título e textos da tela), `apps/api/src/cadastros/cotas.ts:56`, `apps/api/src/importacao/cotas.ts:42,80,137` (textos que citam a tela). **Test:** `apps/web/src/__testes__/casca.test.tsx`, `apps/web/src/__testes__/servicos.test.tsx`, `apps/api/test/cotas.test.ts`, `apps/api/test/importacao-cotas-feriados.test.ts`.

- [ ] **Step 1: Testes** (Review Focus 3): o menu mostra "Turnos"; o título da tela é "Turnos"; a mensagem de cota de serviço desativado diz "na tela de Turnos"; a mensagem de importação de cotas diz "na tela de Turnos".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** A rota `/servicos` continua a mesma (é só o rótulo que muda), para os endereços antigos não quebrarem.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: a tela Serviços passa a se chamar Turnos`.

### Task 7: "Importar" no lugar de "Importar da Planilha"

**Files:** `apps/web/src/componentes/ImportarPlanilha.tsx` e cada tela que o usa. **Test:** `apps/web/src/__testes__/importar.test.tsx`.

- [ ] **Step 1: Teste:** o botão que abre a importação tem o nome "Importar"; nenhuma tela mostra "Importar da Planilha".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: botão Importar`.

### Task 8: Vaga vazia na opção A (contorno tracejado)

**Decisão do usuário (21/11/2026):** a opção A do mockup da DESIGN (`docs/telas/vaga-vazia/mockup.html`), a recomendada.

**Files:** `apps/web/src/componentes/escala-do-mes/` (a vaga da Escala do mês), `apps/web/src/componentes/efetivo-por-dia/CardDoEfetivo.tsx` (a vaga na faixa do Efetivo por dia), `apps/web/src/index.css` ou o estilo das listras (sai a classe das listras amarelas). **Test:** `escala-do-mes.test.tsx`, `efetivo-por-dia.test.tsx`, `estilo.test.tsx`.

- [ ] **Step 1: Testes:**
  - a vaga vazia é um botão com **contorno tracejado** e sem as listras amarelas, nas duas telas;
  - a vaga **obrigatória** (falta para a guarnição sair) tem a barra vinho à esquerda (`data-obrigatoria`); a **extra** (entre o mínimo e o máximo) não tem barra e mostra "opcional" (junto com a Tarefa 1);
  - a cor de serviço aparece só em quem já está escalado; nenhuma vaga vazia usa a cor do serviço;
  - o cabeçalho do card troca o triângulo de alerta pelo contador "Faltam N" (N = vagas obrigatórias vazias), e não mostra nada quando N = 0;
  - ao passar o mouse e com o foco do teclado, a vaga muda de estado visível; o contorno tem contraste de pelo menos 3:1 com o fundo.
- [ ] **Step 2: Run** os três arquivos. Expected: FAIL.
- [ ] **Step 3: Implement** seguindo o mockup (cores e medidas da opção A). A frase "Falta…" da Tarefa 1 continua fora; o contador "Faltam N" é só o número no cabeçalho.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Fase 5.4: vaga vazia na opção A`. No fim da entrega:
  - contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - **enviar o branch e o resumo à PLANEJAMENTO**, com a lista curta para a sandbox e a nota: os testes com escalante ou militar comum não cabem na sandbox, que só tem o administrador (risco já registrado no roadmap).
