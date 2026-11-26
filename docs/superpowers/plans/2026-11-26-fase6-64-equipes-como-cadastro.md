# Equipes como cadastro (6.64) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus, com atenção à migração (Task 1) e à regra do externo (Task 4).

**Goal:** as equipes deixam de ser texto no código: cada uma tem **tipo** (Pronto, ADM ou Externa) e, no Pronto, a **posição no ciclo** (1 a 4); vêm da corporação e as unidades as herdam; o externo ganha uma equipe de verdade e só é escalado nas operações.

**Architecture:** a tabela `equipe` (hoje uma linha por unidade, com `ordem_ciclo`) ganha `tipo`, `posicao_ciclo` (a coluna renomeada) e `ativa`; `unidade_id` passa a dizer **onde a equipe foi criada** (a corporação, para as padrão). O rastreio aceita uma equipe da própria unidade ou de uma de cima (a mesma herança dos feriados: `caminho @>`). O motor continua com os quatro rótulos internos do ciclo (`CICLO_EQUIPES`), mas a API os escolhe pela **posição**, nunca pelo nome cadastrado: renomear a Alfa não muda nada no cálculo. A conferência jornada×tipo é uma função pura no domínio, usada em todo lugar que grava a equipe.

**Tech Stack:** Postgres/PGlite (migração `0052`; se o número estiver ocupado, o próximo livre), Hono, zod (`contratos`), React/TanStack, Vitest.

**Spec:** `docs/ideias/equipes.md` (modelagem da CONCEPÇÃO, 26/11/2026) e a linha de 26/11 em `docs/decisoes.md`.

## Global Constraints

- Branch `fase6-64-equipes-como-cadastro`, a partir da `main`. **A migração só roda com autorização explícita do usuário**; o PR não é mesclado pelo roteiro automático sem ela. Nada roda em banco remoto; só PGlite nos testes. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Fotos da tela nova em 1440 e 390 px. Enviar a branch uma vez só, no fim.
- **A migração é escrita sem `public.`** e, ao consultar o catálogo, usa `current_schema()` (as migrações valem para o real e para o espelho, 6.58); o teste de estrutura igual do espelho tem de continuar verde.
- **Nenhum nome de equipe no código.** `CICLO_EQUIPES` fica só como os quatro **rótulos internos do motor, por posição**; nenhuma rota, importação ou tela compara nome com `ALFA`, `BRAVO`… nem escreve "Externo" à mão. Os casos gravados do protótipo (`casos/`) não mudam.
- **Tipos fixos no código** (`pronto`, `adm`, `externa`), porque cada um tem comportamento no motor; o que se cadastra são as equipes.
- **Herança:** a unidade vê as equipes da corporação, as das unidades acima e as suas. O nome não se repete entre as que ela vê, sem diferenciar maiúsculas nem acentos. O gestor cria, renomeia e exclui só as da própria unidade; as herdadas, só quem as criou (o administrador, na corporação).
- **Pronto:** exatamente quatro posições (1 a 4). A unidade **não** cria equipe do tipo Pronto (proposta da CONCEPÇÃO, aceita: com o ciclo fixo, uma quinta não teria dia). **ADM:** a corporação tem uma padrão; a unidade pode criar outras do tipo ADM; **a equipe é opcional para o ADM** (aceita: sem ela, a etiqueta âmbar de falta que os outros dados que faltam já têm). **Externa:** uma só, da corporação; a unidade não cria outra.
- **Conferência jornada×tipo:** equipe Pronto só para jornada Pronto; ADM só para ADM; Externa nunca no rastreio. Na ficha: 400 por campo. Na **importação e no lote**: vira aviso na prévia e a linha **não grava a equipe** (não trava).
- **Externo:** só entra na Externa pelo "Trazer" (6.33); só é candidato em serviço com `servico.tipo` diferente de `ordinario`; nunca no Pronto, no Saldo nem no Expediente. **Muda a decisão de 24/11.**
- **Textos fixos:** "Já existe uma equipe com esse nome." · "A equipe do Pronto só vale para quem é do Pronto." · "A equipe do ADM só vale para quem é do ADM." · "A Externa só se põe pelo botão Trazer." · "Esta equipe é de {unidade}; só quem a criou pode mudar." · "A equipe já foi usada; ela foi desativada em vez de apagada." · "Militar externo só entra em operações." · "A equipe '{nome}' não existe ou não combina com a jornada; a equipe não foi gravada." (aviso da prévia).
- Skill `frontend-design:frontend-design` na tela (Task 5); tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI.

## Review Focus

1. **Migração sem perder histórico:** o rastreio de meses passados continua com a mesma equipe depois da migração (agora a da corporação, pela posição); nenhuma linha de rastreio fica sem equipe que tinha, e a equipe que sobra sem casar fica desativada, não apagada (Task 1).
2. **Renomear a Alfa não muda a pré-escala:** com a equipe da posição 1 chamada "Equipe 1", a prévia, o voluntariado e a Grade dão o mesmo resultado de antes (Task 3).
3. **Herança no rastreio:** gravar uma equipe de uma unidade que não é a do militar nem de cima dela é recusado; a de cima vale (Task 1 e 2).
4. **Externo fora do ordinário:** o externo não aparece como candidato no Pronto, no Saldo nem no Expediente, e a gravação direta é recusada com a frase fixa; aparece em PJES e Diária (Task 4).
5. **Importação com equipe que não combina:** "ALFA" para jornada ADM, "EXTERNA" na planilha e um nome que não existe viram aviso na prévia, a linha grava o resto e não grava a equipe (Task 3).

---

### Task 1: a tabela, a migração e a herança no rastreio

**Files:** Create `apps/api/banco/migracoes/0052_equipes_como_cadastro.sql`; Modify `pacotes/dominio/src/` (novo `equipes.ts`, exportado no índice), `pacotes/contratos/src/militares.ts`; Test `apps/api/test/migracao-0052.test.ts`, `pacotes/dominio/test/equipes.test.ts`.

**Interfaces (Produces):**
- Domínio: `TIPOS_DE_EQUIPE = ['pronto', 'adm', 'externa'] as const`, `type TipoDeEquipe`; `conferirEquipeEJornada(tipo: TipoDeEquipe, jornada: 'pronto' | 'adm'): string | null` (a frase fixa do desencontro, ou `null` se combina); `rotuloDoCiclo(posicao: number): string` (`CICLO_EQUIPES[posicao - 1]`, o rótulo interno do motor).
- Contrato: `Equipe = { id; nome; tipo: TipoDeEquipe; posicaoCiclo: number | null; ativa: boolean; unidadeId: string; herdada: boolean }` (no lugar do `ordemCiclo`).
- Banco: `equipe.tipo text not null check (tipo in ('pronto','adm','externa'))`; `equipe.posicao_ciclo` (a coluna `ordem_ciclo` renomeada); `equipe.ativa boolean not null default true`; `check ((tipo = 'pronto') = (posicao_ciclo is not null))` e `posicao_ciclo between 1 and 4`; `unique (unidade_id, posicao_ciclo)` continua; o gatilho `rastreio_equipe_da_unidade` passa a exigir: a equipe é da unidade do período **ou de uma acima** (`caminho @>`), o tipo não é `externa`, e (em inserção e quando a equipe muda) a equipe está ativa.
- **Migração de dados:** (1) criar na unidade raiz da corporação as seis padrão: Alfa (pronto, 1), Bravo (2), Charlie (3), Delta (4), ADM (adm) e Externa (externa); (2) para cada equipe por-unidade antiga com `ordem_ciclo` de 1 a 4, apontar o rastreio dela para a padrão da **mesma posição** e apagar a linha antiga; (3) as que sobram (posição maior que 4 ou sem casar) viram `tipo = 'adm'`, `posicao_ciclo = null`, `ativa = false` e **continuam** com o rastreio apontando para elas (histórico); (4) a migração termina com um `raise notice` que lista, por unidade, as equipes que sobraram e as que tinham nome diferente do padrão (é o relatório de quem migra; casar as linhas é dele, decisão de 21/11). Sem `public.`; idempotente.

- [ ] **Step 1: testes.** Domínio: `conferirEquipeEJornada` (as quatro combinações e a Externa), `rotuloDoCiclo(1)` é o primeiro rótulo e `rotuloDoCiclo(5)` lança. Migração (`migracao-0052.test.ts`, no estilo dos outros `migracao-00NN.test.ts`: aplicar até a 0051, semear, aplicar a 0052): duas unidades com ALFA a DELTA e rastreio em meses diferentes, uma equipe "TURMA X" de ordem 5 em uso e uma de ordem 6 sem uso: depois, existem seis padrão na raiz; o rastreio das duas unidades aponta para as padrão da mesma posição; "TURMA X" ficou desativada e o rastreio dela continua apontando para ela; nenhuma linha de rastreio perdeu a equipe (Review Focus 1); rodar de novo não muda nada. Gatilho: equipe de unidade irmã é recusada, a da raiz e a de um ancestral valem (Review Focus 3); equipe `externa` no rastreio é recusada; equipe desativada não entra num rastreio novo.
- [ ] **Step 2:** rodar e ver FALHAR. **Step 3:** implementar. **Step 4:** PASS, `pnpm --filter dominio test` e o teste de estrutura igual do espelho (6.58). **Step 5:** commit `Fase 6.64: a equipe ganha tipo, posição e herança`.

### Task 2: o cadastro das equipes (API)

**Files:** Create `apps/api/src/cadastros/equipes.ts` (rotas); Modify `apps/api/src/app.ts` (montar as rotas), `apps/api/src/cadastros/militares.ts` (a rota `GET /unidades/:u/equipes` sai dali); Test `apps/api/test/equipes.test.ts`.

**Interfaces (Produces):**
- `equipesVisiveis(c: Consulta, unidadeId: string): Promise<Equipe[]>`: as da corporação, as de cima e as da unidade, ativas e desativadas, ordenadas: Pronto pela posição, depois ADM por nome, depois a Externa; `herdada` verdadeiro quando `unidade_id` não é a da unidade pedida. Exportada para as outras tarefas.
- `GET /api/unidades/:u/equipes` (quem tem papel de cadastro na unidade, como hoje); `POST /api/unidades/:u/equipes` `{ nome, tipo: 'adm' }` (as quatro do Pronto e a Externa são só as padrão, criadas pela migração; **por rota só se cria `adm`**, o gestor na própria unidade e o administrador na corporação); `PATCH /api/equipes/:id` `{ nome?, ativa? }`; `DELETE /api/equipes/:id`.
- Regras: nome único entre as equipes que a unidade vê (e, ao criar na raiz, entre as de todas as que a veem: a conferência olha as unidades de baixo também, para não criar um nome que já exista lá embaixo; se existir, recusa com a frase "Já existe uma equipe com esse nome."); só quem criou muda (a herdada devolve 403 com "Esta equipe é de {unidade}; só quem a criou pode mudar."); excluir apaga só se nenhum rastreio, em mês nenhum, a usou; senão desativa e responde com "A equipe já foi usada; ela foi desativada em vez de apagada."; as seis padrão não se excluem, só se renomeiam (a posição e o tipo não mudam por rota).
- Auditoria: o gatilho genérico da tabela `equipe` já existe; conferir que ele guarda quem mexeu.

- [ ] **Step 1: testes.** Visíveis: a unidade vê as da raiz, as de cima e as suas, e não as de unidade irmã; ordem; `herdada`. Criar: gestor cria ADM na própria unidade; `tipo: 'pronto'` e `'externa'` são recusados (400); nome repetido sem diferenciar maiúsculas e acentos é recusado, inclusive contra uma equipe de unidade abaixo. Mudar: gestor renomeia a sua, é recusado na herdada (403 e a frase fixa); o administrador renomeia a Alfa na raiz e a posição não muda. Excluir: sem uso apaga; com uso desativa e devolve a frase; as padrão não se excluem. Papel: quem não tem cadastro na unidade recebe 403. Auditoria registra o renome.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (o modelo de herança é o de `apps/api/src/cadastros/feriados.ts`). **Step 4:** PASS e `pnpm --filter api typecheck`. **Step 5:** commit `Fase 6.64: o cadastro das equipes herdadas`.

### Task 3: o motor, a pré-escala, a importação, o lote e a ficha leem tipo e posição

**Files:** Modify `apps/api/src/escala/pre-escala.ts`, `apps/api/src/voluntariado/leitura.ts`, `apps/api/src/grade/grade.ts`, `apps/api/src/grade/dia.ts`, `apps/api/src/importacao/peculio.ts`, `apps/api/src/importacao/peculio-colunas.ts`, `apps/api/src/cadastros/lote.ts`, `apps/api/src/cadastros/alterar-situacao.ts`, `apps/api/src/cadastros/mudanca-do-rastreio.ts`, `apps/api/src/visao/exportar.ts`, `apps/api/src/visao/busca.ts`, `apps/api/src/cadastros/militares.ts`; Test os testes existentes desses arquivos e `apps/api/test/equipes-no-motor.test.ts`.

**Interfaces:**
- Consumes: `equipesVisiveis` (Task 2), `conferirEquipeEJornada` e `rotuloDoCiclo` (Task 1).
- `pre-escala.ts`: `equipesDoCiclo` lê `tipo = 'pronto'` e `posicao_ciclo` (de qualquer nível visível à unidade), e `cicloDaEquipe` vira `rotuloDoCiclo(e.posicaoCiclo)`. O resto do cálculo (descoberta da equipe do dia 1, `equipeDoDia`) não muda.
- `voluntariado/leitura.ts` (`folgasDoMilitar`): o grupo do militar vem do rótulo da posição, não do nome; equipe ADM ou sem equipe segue sem ciclo (retorna `null`, como hoje).
- **Importação do Pecúlio (coluna EQUIPE) e lote 6.52:** o nome é procurado em `equipesVisiveis(unidade da lotação)`; a importação **deixa de criar equipe** (some o `equipeDe` que cria por nome e o `CICLO_EQUIPES.indexOf`); nome que não existe, que não combina com a jornada (`conferirEquipeEJornada`) ou "Externa" vira aviso (frase fixa do aviso da prévia) e a linha não grava a equipe, grava o resto. A exportação escreve o nome cadastrado. O lote lista, na escolha de equipe, as que a unidade vê, separadas por tipo, sem a Externa.
- **Ficha ("Alterar situação" e editar mudança da 6.69):** a combinação errada é 400 por campo com a frase fixa; a lista de escolha é filtrada pela jornada escolhida (Pronto → as quatro; ADM → as do tipo ADM). O aviso "Sem equipe, o militar não entra na pré-escala do Pronto." da 6.69 continua.
- **Grade e lista de militares:** os filtros e a faixa de equipe vêm das equipes que a unidade vê, na ordem do ciclo, depois por nome, a Externa por último; o rótulo "Externo" escrito à mão em `militares.ts`, `elegibilidade.ts` e na Grade passa a ser o nome da equipe Externa visível (`equipesVisiveis`, tipo `externa`).

- [ ] **Step 1: testes.** (a) Renomear a posição 1 para "Equipe 1" não muda a prévia da pré-escala, as folgas do voluntariado nem os grupos da Grade (Review Focus 2). (b) Importação: planilha com EQUIPE "ALFA" para jornada Pronto grava; "ALFA" para jornada ADM, "EXTERNA" e "INEXISTENTE" viram aviso e a linha grava sem equipe (Review Focus 5); a importação não cria equipe. (c) Lote: equipe do tipo errado vira aviso na prévia e não grava; a escolha não oferece a Externa. (d) Ficha: Pronto com equipe ADM é 400; ADM com equipe nenhuma é aceito. (e) Exportação escreve o nome cadastrado, inclusive depois de renomear. (f) A Grade e a lista de militares mostram o nome da Externa cadastrada no externo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Procurar por `CICLO_EQUIPES`, `ordem_ciclo`, `ordemCiclo`, `'Externo'` e `equipe_id` em `apps/api/src` e `apps/web/src` para não esquecer ponta. **Step 4:** PASS, `pnpm test` da API e do domínio. **Step 5:** commit `Fase 6.64: o motor e as pontas leem o tipo e a posição`.

### Task 4: o externo só nas operações

**Files:** Modify `apps/api/src/escala/elegibilidade.ts`, a rota que grava a alocação (a mesma que hoje confere a elegibilidade; achar por `externo` em `apps/api/src/escala/rotas.ts` e `apps/api/src/grade/`); Test `apps/api/test/externo-so-em-operacoes.test.ts`.

- [ ] **Step 1: testes.** Com um externo de vínculo aberto: no serviço Pronto, no Saldo e no Expediente (`servico.tipo = 'ordinario'`) ele **não é candidato** (some da lista) e a gravação direta da alocação é recusada com 400 "Militar externo só entra em operações."; em PJES e Diária ele é candidato como hoje (6.36) e a gravação vale; a pré-escala e as distribuições automáticas continuam não o pondo (6.33); o painel do dia da Grade não oferece serviço ordinário ao externo (Review Focus 4). O externo que já tinha alocação ordinária lançada antes: continua aparecendo (não se apaga dado), com o motivo "Militar externo só entra em operações." na lista de problemas da escala.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (o filtro é por `servico.tipo`, nunca por nome de serviço). **Step 4:** PASS. **Step 5:** commit `Fase 6.64: o externo só entra nas operações`.

### Task 5: a tela das equipes

**Files:** Create `apps/web/src/componentes/configuracoes/EquipesDaUnidade.tsx`, `apps/web/src/api/equipes.ts`; Modify `apps/web/src/routes/_app/configuracoes.tsx` (nova aba "Equipes"), `apps/web/src/componentes/militares/Rastreio.tsx` e `apps/web/src/componentes/peculio/AtualizarEmLote.tsx` (a lista de equipes vem de `GET /api/unidades/:u/equipes`, filtrada pela jornada); Test `apps/web/src/__testes__/equipes.test.tsx`.

- [ ] **Step 1: testes.** A aba "Equipes" em Configurações lista as equipes que a unidade vê, por tipo (Pronto, ADM, Externa), com a marca "da corporação" nas herdadas e sem botão de mudar nelas para quem não as criou; o gestor cria uma equipe ADM (campo de nome, sem escolha de tipo), renomeia e exclui as da unidade; o administrador, na raiz, renomeia as padrão; o erro de nome repetido aparece junto do campo com a frase fixa; "A equipe já foi usada…" aparece como aviso depois de excluir uma em uso. Sem equipe cadastrada além das padrão, o estado vazio diz "Esta unidade só usa as equipes da corporação.". A escolha de equipe na ficha mostra só as do tipo da jornada. Nenhuma tela escreve Alfa, Bravo, Charlie, Delta ou Externo à mão.
- [ ] **Step 2:** FAIL. **Step 3:** implementar com a skill `frontend-design:frontend-design`, nos tokens da 6.20; sem mockup da DESIGN: segue o padrão das outras abas de Configurações (Funções, Situações). **Step 4:** PASS, `pnpm --filter web typecheck`, fotos em 1440 e 390 px. **Step 5:** commit `Fase 6.64: a aba Equipes das configurações`.

### Task 6: a carga de exemplo e o fechamento

**Files:** Modify `apps/api/src/carga/exemplo.ts`, `apps/api/src/laboratorio/espelho.ts` (a carga do espelho); o texto de como migrar, se citar equipe por unidade.

- [ ] **Step 1:** a carga de exemplo cria as seis equipes padrão **na corporação** (não por seção) e os militares fictícios apontam para elas; o teste da carga confere as seis e que nenhuma seção ganha equipe própria. A carga do espelho (6.58) idem. **Step 2:** `pnpm test && pnpm typecheck && pnpm build:vercel` (o espelho: o teste de estrutura igual continua verde com a 0052). **Step 3:** commit `Fase 6.64: fechamento` e enviar a branch e o resumo à PLANEJAMENTO, com a lista do `raise notice` da migração testada no PGlite. **Não** rodar a migração em banco remoto.

## Fora desta entrega

- Mudar o ciclo do Pronto (continua 1×3 com quatro equipes) e juntar jornada e equipe num campo só.
- Pôr na Externa um militar da própria unidade.
- Trocar os rótulos internos do motor (`CICLO_EQUIPES`) e regravar `casos/`.
