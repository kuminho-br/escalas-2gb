# Entrega paralela P1 — Escala dos oficiais: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o gestor monta a escala mensal dos oficiais QOC e QOA em turnos de 12 h, com a cota proporcional à presença, e acompanha o saldo de cada oficial mês a mês.

**Spec:** `docs/superpowers/specs/2026-11-22-escala-dos-oficiais-design.md`. **Mockup aprovado sem ressalvas** (22/11/2026): `docs/telas/escala-dos-oficiais/mockup.html`. As propostas dos 8 pontos "Em aberto" e as três suposições do mockup valem como decididas (ver "Decisões").

**Linha de entregas:** é a primeira **entrega paralela** (zona "Missões paralelas" do roadmap). Não muda a ordem das fases nem o que existe, fora o quadro do militar (P1.1), que é pré-requisito dela e passa a valer para o Pecúlio.

**Subentregas** (uma branch e um PR cada, nesta ordem):
1. **P1.1 — Quadros no banco:** QOC, QOA e QBMG; o posto-graduação pertence a um quadro; o militar tem um quadro. Migração **0027**.
2. **P1.2 — Motor e API da escala dos oficiais:** as regras puras em `pacotes/dominio`, as tabelas e as rotas. Migração **0028**.
3. **P1.3 — Telas:** o item "Oficiais" no trilho e a tela com as abas Escala do mês, Painel de saldo e Regras.

**Ordem com a fase 6:** os números 0027 e 0028 supõem a entrega 6.5 (migração 0026) mesclada antes. Se a P1.1 for executada antes da 6.5, ela fica com a 0026 e a 6.5 passa a usar o número livre seguinte. A DESENVOLVIMENTO confere isso ao abrir a branch.

**Fluxo:** o Sonnet (esforço high) executa, e o Opus (esforço medium) faz a revisão final de cada branch, com o modelo explícito. Ao terminar cada subentrega, a DESENVOLVIMENTO envia a branch e o resumo à PLANEJAMENTO, sem abrir PR. A PLANEJAMENTO abre o PR e mescla. A migração no banco de teste só roda com a autorização do usuário.

**Tech Stack:** Postgres (ltree, btree_gist), Hono, zod (`pacotes/contratos`), motor puro (`pacotes/dominio`), React + TanStack Router/Query, Vitest.

## Global Constraints

- Nenhum dado pessoal real (D7): matrículas `990xxx-x`, nomes fictícios.
- **O escalante nunca é bloqueado de fechar a escala.** Afastado num turno e turno sem nome geram aviso, nunca recusa no "Fechar a escala".
- **Quem usa:** administrador e gestor da unidade escolhida no seletor (`exigirPapel(c, unidadeId, ['gestor', 'administrador'])`). O auxiliar administrativo não vê o item nem a tela.
- **Quem participa:** militar com quadro QOC ou QOA que tenha período de rastreio na unidade ou em unidade abaixo dela (`caminho <@`), em algum dia do mês.
- **Turnos:** dois por dia, um oficial por turno. Rótulos fixos: "Dia, 07h às 19h" e "Noite, 19h às 07h".
- **Números:** devido e saldo guardados com 6 casas (`numeric(12,6)`); na tela, 2 casas, vírgula, e sinal sempre visível no saldo: `+0,75`, `−0,25` (sinal de menos U+2212), `0,00`.
- **Textos fixos** (do mockup):
  - fechar com turno sem nome: "Ainda há {n} turnos sem nome. Você pode fechar mesmo assim e completar depois; a partir daqui, trocar um nome vira cobertura e fica no registro." Botões "Fechar a escala" e "Voltar";
  - encerrar antes de fechar: "Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.";
  - confirmar o encerramento: "Encerrar {mês}? O saldo do mês é calculado com a escala como está e somado ao acumulado. Depois disso, só um ajuste no painel de saldo muda os números." Botões "Encerrar o mês" e "Voltar";
  - calcular com a escala fechada: "Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.";
  - escala fechada: "Escala fechada em {dd/mm/aaaa}. Clique num turno para trocar o nome: quem cobre ganha o turno, e quem saiu não fica devendo.";
  - mês encerrado: "Mês encerrado em {dd/mm/aaaa}. O saldo de {mês} já está no painel. Correções agora só por ajuste do gestor.";
  - alteração no mês encerrado (API): "O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.";
  - fechar sem cotas (API): "Calcule as cotas antes de fechar a escala.";
  - sem participantes: "Nenhum oficial QOC ou QOA nesta unidade neste mês.";
  - aviso de afastado no turno: "{posto} {nome} está afastado em {dd/mm} ({tipo}) e está no turno {do dia | da noite}. A escala pode ser fechada mesmo assim.";
  - o texto da aba Regras é o do mockup, seção "Regras", palavra por palavra, sem a lista "Pontos em aberto".
- **Vocabulário:** "posto-graduação" é o nome provisório do campo (decisão do usuário, 22/11/2026). No código continua `posto_grad`/`postoGrad`.
- No fim de cada subentrega: `pnpm test && pnpm typecheck && pnpm build:vercel`; as contagens no `CLAUDE.md` local; o esquema (`docs/superpowers/specs/2026-11-16-esquema-banco.md`) atualizado quando houver migração.

## Decisões

Do usuário (entrevista e aprovação do mockup, 22/11/2026):
- Quadros QOC, QOA e QBMG. Todo militar pertence a um quadro. O posto-graduação pertence a quadros, e o mesmo posto-graduação pode estar em mais de um.
- Os 8 pontos "Em aberto" do design, como propostos:
  1. o gestor lança a escolha de cada oficial, na ordem mostrada;
  2. o oficial que chega entra com a média exata dos saldos;
  3. um oficial por turno;
  4. a ordem é o posto, depois a antiguidade; sem antiguidade, o gestor ordena à mão;
  5. o dia do afastamento não é oferecido na escolha; afastamento lançado depois vira aviso, sem travar;
  6. imprevisto sem cobertura vira turno vazio (caso 6), e ninguém ganha;
  7. todos com presença no mês entram na fila da sobra;
  8. a zona de missões paralelas aparece no roadmap e na página do roadmap.
- As suposições do mockup: o item "Oficiais" logo depois de "Efetivo por dia"; cada oficial escolhe todos os seus turnos na sua vez; turnos das 07h às 19h e das 19h às 07h.

Minhas (marcadas para o usuário conferir):
- **Postos por quadro**, tirados do QOD (aba "EFETIVO COMPOSIÇÃO 001"): QOC = CEL, TEN CEL, MAJ, CAP, 1º TEN, 2º TEN; QOA = MAJ, CAP, 1º TEN, 2º TEN; QBMG = ST, 1º SGT, 2º SGT, 3º SGT, CB, SD. **O ASP OF não aparece no QOD; entra no QOC.**
- **Quem já está no banco** recebe o quadro quando o posto só existe em um (praças → QBMG; CEL, TEN CEL e ASP → QOC). MAJ a 2º TEN ficam sem quadro, com a pendência "Sem quadro" na ficha, até alguém escolher.
- **Quadro na ficha e nas importações:** a ficha ganha o campo "Quadro". As planilhas de MILITARES e do PECÚLIO **não ganham coluna**. O quadro é preenchido sozinho quando o posto só existe em um quadro, e fica como estava quando o quadro atual tem o novo posto. Se não, fica vazio, com a pendência.
- **Os quadros são fixos na migração**, como a hierarquia de CNH. O cadastro deles nas Configurações fica para quando o QOD for modelado.
- **A presença usada no saldo é a do último "Calcular cotas"**, gravada com a cota. Afastamento lançado depois de fechar a escala não reduz o devido: quem saiu "fica como se tivesse tirado" (caso 3).
- **Cobertura:** trocar o nome num turno da escala fechada grava quem saiu. Quem saiu conta como tirado, e quem cobriu também. Se o gestor volta ao nome original, a cobertura some. Tirar o nome do turno da escala fechada deixa o turno vazio, e ninguém ganha (ponto 6).
- **Ordem manual** (ponto 4): vale só entre os oficiais sem antiguidade do mesmo posto. Fica guardada no mês e é refeita a cada cálculo.
- **Saldo por unidade:** a escala dos oficiais do 2º GB e a de uma seção, se houver, têm saldos separados.

---

# P1.1 — Quadros no banco

**Architecture:** migração com `quadro` e `quadro_posto_grad`; `militar.quadro_id` com chave composta, que garante que o posto pertence ao quadro. Uma função da API escolhe o quadro quando ele não é informado. A ficha ganha o campo, e a pendência "Sem quadro" entra na lista de pendências que já existe.

**Branch:** `p1-1-quadros`. Commits `P1.1: …`. **Migração 0027:** o resumo avisa `pnpm --filter api db:migrar:teste`.

## Review Focus

- Trocar o posto de um MAJ do QOA para CEL, só existente no QOC: o quadro passa a QOC sozinho, sem erro de chave.
- Trocar o posto de um 2º TEN do QOC para CAP: o quadro continua QOC.
- Escolher QBMG para um CAP: 400 no campo, sem 500 do banco.
- A importação de MILITARES e do PECÚLIO com um MAJ novo grava o militar sem quadro e com a pendência, sem recusar a linha.
- Militar sem quadro continua aparecendo e sendo escalado em todas as telas da escala de praças, como hoje.

### Task 1: migração dos quadros

**Files:**
- Create: `apps/api/banco/migracoes/0027_quadros.sql`
- Test: `apps/api/test/esquema-estrutura.test.ts`

- [ ] **Step 1: testes**, que falham antes da migração:
  - `quadros fixos`: `select sigla from quadro order by ordem` é `['QOC', 'QOA', 'QBMG']`;
  - `postos por quadro`: QOA tem exatamente MAJ BM, CAP BM, 1º TEN BM e 2º TEN BM; ASP OF BM está só no QOC; SD BM está só no QBMG;
  - `militar com posto fora do quadro`: um update de `quadro_id` para QBMG num militar CAP BM falha com o código `23503`;
  - `preenchimento`: depois da migração, num banco com SD, CEL e MAJ inseridos antes dela, o SD fica com QBMG, o CEL com QOC e o MAJ com `null`. Inserir os três antes, aplicando as migrações até a anterior com o apoio que já existe em `banco-teste.ts`. Se o apoio não permitir, testar a instrução de preenchimento isolada.
- [ ] **Step 2:** `pnpm --filter api test esquema-estrutura`. Esperado: FAIL.
- [ ] **Step 3: a migração**, que pode rodar de novo (`if not exists` e inserções sem duplicar):

```sql
create table if not exists quadro (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  ordem int not null unique
);
-- ('QOC', 'Quadro de Oficiais Combatentes', 1), ('QOA', 'Quadro de Oficiais da Administração', 2), ('QBMG', 'Qualificação Bombeiro Militar Geral', 3)
create table if not exists quadro_posto_grad (
  quadro_id uuid not null references quadro (id),
  posto_grad_id uuid not null references posto_grad (id),
  primary key (quadro_id, posto_grad_id)
);
alter table militar add column if not exists quadro_id uuid;
-- chave composta: (quadro_id, posto_grad_id) existe em quadro_posto_grad; quadro_id nulo passa (MATCH SIMPLE)
alter table militar add constraint militar_posto_no_quadro foreign key (quadro_id, posto_grad_id) references quadro_posto_grad (quadro_id, posto_grad_id);
```

  A restrição é recriada com `drop constraint if exists`. O preenchimento: `update militar set quadro_id = (o único quadro do posto) where quadro_id is null and o posto está em exatamente um quadro`. A auditoria do `militar` já existe.
- [ ] **Step 4:** a mesma linha de teste. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.1: quadros QOC, QOA e QBMG, e o quadro do militar"`

### Task 2: o quadro na API e nas importações

**Files:**
- Create: `apps/api/src/cadastros/quadros.ts`
- Modify: `apps/api/src/cadastros/militares.ts`, `apps/api/src/cadastros/militares-regras.ts`, `apps/api/src/importacao/militares.ts`, `apps/api/src/importacao/peculio.ts`, `apps/api/src/app.ts`
- Modify: `pacotes/contratos/src/militares.ts`
- Test: `apps/api/test/quadros.test.ts` (novo), `apps/api/test/importacao-militares.test.ts`, `apps/api/test/importacao-peculio.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/quadros` → `Quadro[]`, com `Quadro = { id: string; sigla: string; nome: string; postoGradIds: string[] }` em `contratos`;
  - `quadroParaOPosto(c: Consulta, postoGradId: string, pedido: string | null | undefined, atual: string | null): Promise<{ quadroId: string | null } | { erro: string }>` em `quadros.ts`;
  - nos contratos: `quadroId: Id.nullable().optional()` em `NovoMilitar` e `EdicaoMilitar`, e `quadro: { id: string; sigla: string } | null` no detalhe e na linha da lista de militares;
  - `pendenciasDoMilitar` recebe `quadro: string | null` e acrescenta "Sem quadro".

- [ ] **Step 1: testes** em `quadros.test.ts`:
  - `pedido que contém o posto vale`: CAP + QOA → QOA;
  - `pedido fora do posto é erro`: CAP + QBMG → `{ erro: 'Este posto-graduação não existe nesse quadro.' }`, e o PATCH da ficha responde 400 com `campos.quadroId` igual a esse texto;
  - `sem pedido, o atual fica se tiver o posto`: atual QOC, posto 2º TEN → QOC;
  - `sem pedido, posto de um quadro só`: atual QOA, posto CEL → QOC;
  - `sem pedido, ambíguo e o atual não serve`: atual QBMG, posto MAJ → `null`;
  - `pedido null limpa`: a ficha aceita apagar o quadro, e a pendência "Sem quadro" aparece;
  - `GET /api/quadros` responde a quem tem sessão, na ordem QOC, QOA, QBMG.

  Nas importações: um MAJ novo entra com `quadro_id` nulo e a pendência; um SD novo entra com QBMG. O quadro segue a mesma regra do posto: só a unidade de cima (dona do Pecúlio) altera.
- [ ] **Step 2:** `pnpm --filter api test quadros importacao`. Esperado: FAIL.
- [ ] **Step 3:** implementar. A ficha (POST e PATCH) e as duas importações passam o posto pelo `quadroParaOPosto` antes de gravar. A rota `/api/quadros` fica junto de `/api/postos`.
- [ ] **Step 4:** a mesma linha. Esperado: PASS. Depois, `pnpm --filter api test`.
- [ ] **Step 5:** `git commit -m "P1.1: o quadro na ficha, nas importações e a pendência Sem quadro"`

### Task 3: o campo "Quadro" na ficha

**Files:**
- Modify: `apps/web/src/componentes/militares/Identificacao.tsx`, `apps/web/src/api/militares.ts`
- Test: `apps/web/src/__testes__/militares.test.tsx`

- [ ] **Step 1: testes:**
  - a ficha mostra o rótulo "Quadro" ao lado de "Posto-graduação", e o rótulo "Posto/graduação" de hoje passa a "Posto-graduação";
  - a lista de quadros só tem os que contêm o posto escolhido;
  - trocar o posto para CEL deixa "QOC" escolhido;
  - com um posto ambíguo e sem quadro, o campo fica "Escolha o quadro", e a pendência "Sem quadro" aparece no bloco, como as outras;
  - para quem não pode editar o bloco Pecúlio, o campo fica só para leitura.
- [ ] **Step 2:** `pnpm --filter web test militares`. Esperado: FAIL.
- [ ] **Step 3:** implementar, com `consultaQuadros` (`queryKey: ['quadros']`).
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.1: campo Quadro na ficha do militar"`

---

# P1.2 — Motor e API da escala dos oficiais

**Architecture:** as regras (ordem, presença, cota, saldo) são funções puras em `pacotes/dominio/src/oficiais.ts`, testadas com o exemplo dos 62 turnos. Quatro tabelas novas guardam o mês, a cota gravada, os turnos e os lançamentos de saldo. As rotas ficam em `apps/api/src/oficiais/` e só leem e gravam: toda conta passa pelo motor.

**Branch:** `p1-2-oficiais-motor-e-api`. Commits `P1.2: …`. **Migração 0028.**

## Review Focus

- Mês sem nenhum participante (soma de presença zero): cotas todas zero, sem divisão por zero, e a leitura responde com a lista vazia.
- Oficial transferido para fora da unidade no meio do mês: conta só os dias em que esteve na unidade ou abaixo dela.
- Afastamento que atravessa a virada do mês: conta só os dias dentro do mês.
- "Calcular cotas" de novo depois de escolhas lançadas: as escolhas ficam. Quem ficou com mais turnos que a nova cota aparece com o aviso, sem perder nada.
- "Encerrar o mês" duas vezes, ou dois pedidos ao mesmo tempo: o segundo responde 409 com "O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.", e nenhum lançamento é duplicado.

### Task 4: o motor

**Files:**
- Create: `pacotes/dominio/src/oficiais.ts`
- Modify: `pacotes/dominio/src/index.ts`
- Test: `pacotes/dominio/test/oficiais.test.ts`

**Interfaces:**
- Produces:

```ts
export type TurnoDeOficial = 'dia' | 'noite';
export interface OficialParaOrdem { militarId: string; postoOrdem: number; antiguidade: number | null; nomeGuerra: string }
/** Posto mais alto primeiro; no mesmo posto, antiguidade crescente; os sem antiguidade depois, na ordem manual e, fora dela, pelo nome de guerra. */
export function ordemDeEscolha(oficiais: OficialParaOrdem[], ordemManual: string[]): string[];
/** Dias do mês (AAAA-MM) cobertos por algum período e fora de todo afastamento. Datas AAAA-MM-DD; `ate` null = em aberto. */
export function diasPresentes(mes: string, periodos: { desde: string; ate: string | null }[], afastamentos: { inicio: string; fim: string }[]): number;
export interface CotaDeOficial { militarId: string; dias: number; devido: number; cota: number; sobra: boolean }
/** `participantes` na ordem de escolha. Devido = turnos × dias ÷ soma dos dias; cota = piso; a sobra, um a um, do mais moderno com dias > 0 para cima. */
export function calcularCotas(turnos: number, participantes: { militarId: string; dias: number }[]): CotaDeOficial[];
export interface TurnoDoMes { dia: string; turno: TurnoDeOficial; militarId: string | null; saiuMilitarId: string | null }
export interface SaldoDoMes { militarId: string; tirado: number; devido: number; valor: number; turnosDia: number; turnosNoite: number }
/** Tirados = turnos com nome. Devido = tirados × dias ÷ soma dos dias (dias da cota gravada). Tirado de cada um = os turnos em que está + os de que saiu (cobertura). */
export function saldoDoMes(turnos: TurnoDoMes[], cotas: { militarId: string; dias: number }[]): SaldoDoMes[];
/** Média exata dos acumulados de quem já tem saldo; lista vazia → 0. */
export function saldoDeEntrada(acumuladosDeQuemJaEsta: number[]): number;
```

- [ ] **Step 1: testes**, com os valores do design:
  - `exemplo dos 62 turnos`: 8 participantes na ordem `a1…a5, f, m1, m2`, todos com 31 dias, menos `f` com 16:
    - `devido` de `a1` ≈ 8,2489 (`toBeCloseTo(62*31/233, 6)`) e de `f` ≈ 4,2575;
    - cotas `[8,8,8,8,8,4,9,9]`;
    - `sobra` só em `m1` e `m2`;
    - soma das cotas 62;
  - `sobra começa pelo mais moderno com presença`: o último da ordem com 0 dias não recebe sobra e fica com cota 0;
  - `ninguém presente`: `calcularCotas(62, [{a, 0}, {b, 0}])` dá cotas 0 e devido 0, sem `NaN`;
  - `diasPresentes`:
    - janeiro de 2027, período de 01/12/2026 em aberto, férias de 11 a 26/01 → 15;
    - período que termina em 10/01 → 10;
    - afastamento de 28/12/2026 a 03/01/2027 → 28;
  - `ordemDeEscolha`:
    - CEL antes de MAJ;
    - no mesmo posto, antiguidade 3 antes de 7;
    - dois 2º TEN sem antiguidade seguem `ordemManual`;
    - sem `ordemManual`, vão pelo nome de guerra;
    - os sem antiguidade vêm depois dos com antiguidade do mesmo posto;
  - `saldoDoMes`, com o exemplo dos 62 turnos todos preenchidos conforme as cotas:
    - `valor` −0,2489 para os cinco mais antigos, +0,7511 para os dois mais modernos e −0,2575 para `f`;
    - com uma cobertura de `a2` por `a3`, `a2` continua com `tirado` 8 e `a3` passa a 9;
    - com um turno vazio, o total tirado é 61 e o `devido` de `a1` vale `61*31/233`;
    - `turnosDia` e `turnosNoite` contam só os turnos em que o militar está;
  - `saldoDeEntrada([1, -0.5, 0.25])` = 0,25; `saldoDeEntrada([])` = 0.
- [ ] **Step 2:** `pnpm --filter dominio test oficiais`. Esperado: FAIL.
- [ ] **Step 3:** implementar. As datas são texto `AAAA-MM-DD`, contadas dia a dia em UTC, como nas outras funções do pacote.
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.2: regras da escala dos oficiais no motor"`

### Task 5: as tabelas

**Files:**
- Create: `apps/api/banco/migracoes/0028_escala_dos_oficiais.sql`
- Test: `apps/api/test/esquema-operacao.test.ts`

- [ ] **Step 1: testes:**
  - o mesmo mês duas vezes na mesma unidade falha com `23505`;
  - `fechada_em` sem `cotas_em` falha com `23514`, e `encerrada_em` sem `fechada_em` também;
  - um ajuste sem motivo falha com `23514`;
  - dois lançamentos `mes` do mesmo militar no mesmo mês falham com `23505`;
  - a auditoria de um update em `oficiais_turno` sai com o `unidade_id` do mês.
- [ ] **Step 2:** `pnpm --filter api test esquema-operacao`. Esperado: FAIL.
- [ ] **Step 3:** a migração:
  - **`oficiais_mes`:** `id`, `unidade_id` (→ unidade), `mes date` (dia 1), `ordem_manual uuid[] not null default '{}'`, `cotas_em`, `fechada_em` e `encerrada_em` (timestamptz). Restrições: `unique (unidade_id, mes)`, `check (fechada_em is null or cotas_em is not null)` e `check (encerrada_em is null or fechada_em is not null)`.
  - **`oficiais_cota`:** `mes_id` (→ `oficiais_mes`, on delete cascade), `militar_id`, `ordem int`, `dias int >= 0`, `devido numeric(12,6)`, `cota int >= 0` e `sobra boolean`. Chave primária `(mes_id, militar_id)`, e `unique (mes_id, ordem)`.
  - **`oficiais_turno`:** `id`, `mes_id`, `dia date`, `turno text check (turno in ('dia', 'noite'))`, `militar_id` nulo e `saiu_militar_id` nulo. Restrições: `check (saiu_militar_id is null or (militar_id is not null and saiu_militar_id <> militar_id))` e `unique (mes_id, dia, turno)`.
  - **`oficiais_saldo`:** `id`, `unidade_id`, `militar_id`, `mes_id` nulo, `tipo text check (tipo in ('mes', 'entrada', 'ajuste'))`, `valor numeric(12,6)`, `tirado int`, `devido numeric(12,6)`, `turnos_dia int`, `turnos_noite int`, `motivo text`, `usuario_id` (→ usuario) e `criado_em timestamptz default now()`. Regras:
    - `check (tipo = 'ajuste' or mes_id is not null)`;
    - `check (tipo <> 'ajuste' or (btrim(coalesce(motivo, '')) <> '' and char_length(motivo) <= 200))`;
    - índice único `(mes_id, militar_id, tipo) where mes_id is not null`.
  - **Gatilhos e auditoria:** `registrar_auditoria` nas quatro tabelas. A função é recriada com um ramo a mais, antes do de `militar_id`: `if unidade is null and r ? 'mes_id' then select m.unidade_id into unidade from oficiais_mes m where m.id = (r ->> 'mes_id')::uuid; end if;`. O resto do corpo é copiado da 0023, sem mudança.
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.2: tabelas da escala dos oficiais"`

### Task 6: as rotas

**Files:**
- Create: `apps/api/src/oficiais/rotas.ts`, `apps/api/src/oficiais/leitura.ts`, `apps/api/src/oficiais/participantes.ts`
- Create: `pacotes/contratos/src/oficiais.ts` (exportado no `index.ts`)
- Modify: `apps/api/src/app.ts` (`app.route('/api', rotasOficiais(comAuth))`)
- Test: `apps/api/test/oficiais.test.ts`

**Interfaces:**
- Consumes: Task 4 (as funções do motor) e Task 5 (as tabelas).
- Produces (contratos):

```ts
export type EtapaDosOficiais = 'sem-cotas' | 'escolhas' | 'fechada' | 'encerrada';
export interface OficialDoMes {
  militarId: string; matricula: string; posto: string; nomeGuerra: string; quadro: 'QOC' | 'QOA'; lotacao: string;
  ordem: number; semAntiguidade: boolean; saldoAnterior: number; dias: number;
  devido: number | null; cota: number | null; sobra: boolean; escolhidos: number;
  afastamentos: { inicio: string; fim: string; tipo: string }[];
}
export interface EscalaDosOficiais {
  mes: string; etapa: EtapaDosOficiais; cotasEm: string | null; fechadaEm: string | null; encerradaEm: string | null;
  oficiais: OficialDoMes[]; vez: string | null;
  turnos: { dia: string; turno: 'dia' | 'noite'; militarId: string | null; saiuMilitarId: string | null }[]; // a forma do TurnoDoMes do motor
  avisos: { dia: string; turno: 'dia' | 'noite'; militarId: string; texto: string }[];
}
export interface OficialNoSaldo {
  militarId: string; matricula: string; posto: string; nomeGuerra: string; quadro: string | null; lotacao: string | null;
  saldo: number; meses: { mes: string; valor: number }[]; turnosDia: number; turnosNoite: number;
  registro: { tipo: 'mes' | 'entrada' | 'ajuste' | 'cobriu' | 'saiu'; data: string; mes: string | null; valor: number | null; texto: string }[];
}
export const TrocaDeTurno = z.object({ militarId: Id.nullable() });
export const OrdemManual = z.object({ militarIds: z.array(Id).max(200) });
export const AjusteDeSaldo = z.object({ militarId: Id, valor: z.number().refine((v) => v !== 0 && Math.abs(v) <= 100), motivo: z.string().trim().min(1).max(200) });
```

- Rotas. Todas exigem gestor ou administrador na unidade `:u`; `:mes` é `AAAA-MM`:
  - `GET /api/unidades/:u/oficiais/:mes` → `EscalaDosOficiais`. Sem linha em `oficiais_mes`, a etapa é `sem-cotas`, e a lista sai dos participantes do momento, com `dias` calculados, `cota` null e `turnos` vazio.
  - `POST /api/unidades/:u/oficiais/:mes/cotas`:
    - cria o mês, se for o caso, e os `2 × dias do mês` turnos vazios na primeira vez;
    - recalcula a ordem, os dias e as cotas, e regrava `oficiais_cota`;
    - mantém as escolhas já lançadas;
    - na etapa `fechada` ou `encerrada`, responde 409 com o texto "Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.".
  - `PUT /api/unidades/:u/oficiais/:mes/ordem` (`OrdemManual`): grava `ordem_manual` e recalcula as cotas como acima. Também responde 409 com a escala fechada.
  - `PUT /api/unidades/:u/oficiais/:mes/turnos/:dia/:turno` (`TrocaDeTurno`):
    - o militar precisa estar em `oficiais_cota` do mês, senão 400 com "Este oficial não está na escala deste mês.";
    - antes de fechar, só grava;
    - com a escala fechada, segue a regra de cobertura de "Decisões";
    - com o mês encerrado, 409.
  - `POST /api/unidades/:u/oficiais/:mes/fechar`: sem cotas, 409 com "Calcule as cotas antes de fechar a escala.". Turno vazio e afastado não impedem.
  - `POST /api/unidades/:u/oficiais/:mes/encerrar`, numa transação com `select … for update` no mês:
    - sem a escala fechada, 409 com o texto de encerrar antes de fechar; já encerrado, 409;
    - grava as `entrada` dos participantes sem lançamento anterior na unidade (só quando outro participante já tem saldo), usando `saldoDeEntrada`;
    - grava as linhas `mes` com `saldoDoMes`;
    - marca `encerrada_em`.
  - `GET /api/unidades/:u/oficiais-saldo` → `OficialNoSaldo[]`: quem tem lançamento na unidade ou participa do mês corrente, ordenado pela ordem de escolha do mês corrente e, fora dela, pelo posto.
  - `POST /api/unidades/:u/oficiais-saldo/ajustes` (`AjusteDeSaldo`): grava um lançamento `ajuste` com o `usuario_id`.
- **Participantes** (`participantes.ts`): `participantesDoMes(c: Consulta, unidadeId: string, mes: string): Promise<{ militarId; postoOrdem; antiguidade; nomeGuerra; …; dias }[]>`. Lê os militares com quadro QOC ou QOA e rastreio sob a unidade no mês, e os afastamentos que tocam o mês. Os `dias` vêm de `diasPresentes`. Se a coluna `militar.ativo` ainda existir, o militar desativado fica de fora.
- **`vez`:** o primeiro da ordem com `escolhidos < cota`; null quando ninguém falta.
- **Avisos:** para cada turno com nome em que o militar está afastado naquele dia, o aviso de afastado no turno, com o texto de "Global Constraints".

- [ ] **Step 1: testes** em `oficiais.test.ts`, com a API de teste e oficiais fictícios no 2º GB e na 1ª SB:
  - o auxiliar (`escalante`) recebe 403 em todas as rotas, e o `gestorGb`, 200 no 2º GB;
  - um 2º SGT (QBMG) e um MAJ sem quadro não aparecem na lista;
  - um CAP lotado na 1ª SB aparece na escala do 2º GB;
  - antes do cálculo, a etapa é `sem-cotas`, com os dias e sem cota;
  - em janeiro de 2027, com 8 oficiais e um de férias em 15 dias, o cálculo grava 62 turnos e as cotas `8,8,8,8,8,4,9,9`;
  - a `vez` aponta o mais antigo, e depois de lançar todos os turnos dele passa ao seguinte;
  - "Calcular cotas" de novo mantém as escolhas;
  - um militar fora da cota é recusado no turno com 400 e o texto;
  - fechar com 10 turnos vazios dá 200; a etapa vira `fechada`; calcular depois disso dá 409 com o texto;
  - trocar A por B na escala fechada grava `saiuMilitarId` A; voltar a A limpa; tirar o nome deixa o turno vazio sem `saiuMilitarId`;
  - encerrar antes de fechar dá 409 com o texto; encerrar grava 8 lançamentos `mes`, com `valor` como na Task 4; o segundo encerrar dá 409, sem duplicar;
  - um oficial que entra no mês seguinte ganha a `entrada` com a média, e o painel mostra esse registro;
  - o ajuste sem motivo dá 400; com motivo, o saldo do painel muda pelo valor;
  - um afastamento lançado depois de lançar o turno gera o aviso do turno, e o fechar continua 200.
- [ ] **Step 2:** `pnpm --filter api test oficiais`. Esperado: FAIL.
- [ ] **Step 3:** implementar, no padrão de `cadastros/feriados.ts`: `exigirSessao`, `comUsuario` para a auditoria, `lerCorpo` e `respostaDoErroDoBanco`.
- [ ] **Step 4:** a mesma linha. Esperado: PASS. Depois, `pnpm test && pnpm typecheck`.
- [ ] **Step 5:** `git commit -m "P1.2: rotas da escala dos oficiais e do saldo"`

---

# P1.3 — Telas

**Architecture:** uma rota `/oficiais` dentro do módulo Confecção de escalas, com três abas, seguindo o mockup (layout, ícones de sol e lua, cores e textos). O trilho ganha o item "Oficiais", só para gestor e administrador.

**Branch:** `p1-3-oficiais-telas`. Commits `P1.3: …`. Sem migração.

## Review Focus

- A tela no celular (largura de 360 px): o calendário e a lista de cotas cabem sem rolagem lateral da página, como no modo "Celular" do mockup.
- Trocar a unidade no seletor com a tela aberta: os dados recarregam, sem mostrar a escala da unidade anterior.
- O auxiliar que digita `/oficiais` volta ao início com o aviso de área de outro papel, como os outros módulos (6.3).
- Um mês sem participantes mostra "Nenhum oficial QOC ou QOA nesta unidade neste mês.", sem botões quebrados.
- Clique duplo rápido num turno livre: lança uma escolha só, sem trocar a `vez` duas vezes.

### Task 7: o item no trilho e a rota

**Files:**
- Modify: `apps/web/src/lib/modulos.ts`
- Create: `apps/web/src/routes/_app/oficiais.tsx`, `apps/web/src/api/oficiais.ts`
- Test: `apps/web/src/__testes__/modulos.test.tsx` (ou o teste do trilho que já existe)

**Interfaces:**
- Produces:
  - `Item` ganha `ve?: (eu: Eu | EuDaApi) => boolean`, e o trilho esconde o item quando `ve` devolve false;
  - `ehGestorOuAdministrador(eu: EuDaApi): boolean` em `api/eu.ts`;
  - na rota, o search `{ mes?: string; aba?: 'escala' | 'saldo' | 'regras' }`; o mês padrão é o seguinte ao de hoje;
  - em `api/oficiais.ts`: `consultaEscalaDosOficiais(u, mes)`, `consultaSaldoDosOficiais(u)` e as mutações `calcularCotas`, `trocarTurno`, `gravarOrdem`, `fecharEscala`, `encerrarMes` e `lancarAjuste`, que invalidam as duas consultas.
- [ ] **Step 1: testes:**
  - o gestor vê "Oficiais" logo depois de "Efetivo por dia", e o auxiliar não vê;
  - o auxiliar em `/oficiais` vai para `/`;
  - a página mostra o título "Escala dos oficiais", o subtítulo "Oficiais QOC e QOA, em dois turnos de 12 horas por dia." e as abas "Escala do mês", "Painel de saldo" e "Regras".
- [ ] **Step 2:** `pnpm --filter web test modulos oficiais`. Esperado: FAIL.
- [ ] **Step 3:** implementar. O ícone do item é escolhido no `lucide-react`, e a escolha vai no resumo da entrega.
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.3: item Oficiais no trilho e a rota da escala dos oficiais"`

### Task 8: a aba Escala do mês

**Files:**
- Create: `apps/web/src/componentes/oficiais/CalendarioDosOficiais.tsx`, `ListaDeCotas.tsx`, `MensagensDoMes.tsx`
- Create: `apps/web/src/lib/numeros-do-saldo.ts` (`formatarSaldo(v: number): string`, `formatarDevido(v: number): string`)
- Test: `apps/web/src/__testes__/oficiais.test.tsx`, `apps/web/src/__testes__/numeros-do-saldo.test.ts`

- [ ] **Step 1: testes:**
  - `formatarSaldo(0.75)` = `+0,75`, `formatarSaldo(-0.2489)` = `−0,25`, `formatarSaldo(0)` = `0,00`; `formatarDevido(8.2489)` = `8,25`.
  - Com a API simulada:
    - **Calendário:** dias de 1 a 31, cada um com "Dia, 07h às 19h" e "Noite, 19h às 07h", e o contador "{n} de 62 turnos com nome".
    - **Etapa `escolhas`:**
      - o quadro "Vez de escolher" mostra o oficial da `vez`, a posição na ordem e "Já lançou {x} de {cota}";
      - um clique num turno livre chama `trocarTurno` com o `militarId` da vez;
      - os dias de afastamento da vez aparecem como "afastado", sem clique;
      - um turno com nome oferece "Tirar {nome} deste turno".
    - **Lista de cotas:**
      - colunas Ordem, Oficial, Saldo, Dias, Cota e Escolhidos;
      - "+1 sobra" em quem tem sobra;
      - "ordenado à mão" em quem não tem antiguidade, com os botões "Subir" e "Descer", que chamam `gravarOrdem`.
    - **Confirmações:**
      - "Fechar a escala" com turnos vazios abre a confirmação com o texto fixo;
      - "Encerrar o mês" na etapa `escolhas` mostra "Feche a escala antes de encerrar o mês…";
      - na etapa `fechada`, "Encerrar o mês" pede a confirmação do encerramento.
    - **Etapa `fechada`:**
      - a mensagem fixa;
      - um clique num turno abre a escolha do oficial (os participantes e "Ninguém");
      - uma cobertura mostra "{quem cobriu} cobriu {quem saiu}";
      - turno vazio mostra "vazio".
    - **Etapa `encerrada`:** a mensagem fixa, e o clique no turno não faz nada.
    - **Avisos:** cada aviso da API aparece acima do calendário, e o turno dele leva a marca de alerta.
- [ ] **Step 2:** `pnpm --filter web test oficiais numeros-do-saldo`. Esperado: FAIL.
- [ ] **Step 3:** implementar seguindo o mockup. As confirmações usam o padrão de diálogo que o site já tem. Se a Entrega 6 já tiver trazido o diálogo do sistema, usar esse; se não, o mesmo componente das outras telas da escala.
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "P1.3: aba Escala do mês dos oficiais"`

### Task 9: o Painel de saldo e as Regras

**Files:**
- Create: `apps/web/src/componentes/oficiais/PainelDeSaldo.tsx`, `RegistroDoOficial.tsx`, `RegrasDosOficiais.tsx`
- Test: `apps/web/src/__testes__/oficiais.test.tsx`

- [ ] **Step 1: testes:**
  - **Painel:**
    - o texto de abertura do mockup ("O saldo mostra quem trabalhou mais ou menos do que devia…");
    - uma linha por oficial, com o saldo em `formatarSaldo`, a barra de mais ou menos, o saldo de cada mês e as contagens de dia e de noite.
  - **Registro:**
    - um clique no oficial abre o registro com "Registro: {posto} {nome} {matrícula}";
    - os lançamentos e as coberturas, do mais novo para o mais velho;
    - "Começou com {valor}, a média dos saldos dos colegas." para quem entrou;
    - "Saldo agora: {valor}".
  - **Ajuste:**
    - abre "Valor do ajuste" e "Motivo (obrigatório)";
    - "Lançar ajuste" com o motivo vazio mostra a mensagem no campo, sem chamar a API;
    - com o motivo, chama `lancarAjuste`;
    - "Cancelar" fecha o formulário.
  - **Regras:** a aba mostra os títulos "Como a escala é montada", "Como a cota é calculada", "O saldo", "O que muda o saldo", "Os dois momentos do mês" e "O que fica registrado", e a tabela do exemplo com `8,25`, `4,26` e `−0,26`.
- [ ] **Step 2:** `pnpm --filter web test oficiais`. Esperado: FAIL.
- [ ] **Step 3:** implementar. O texto das Regras é copiado do mockup.
- [ ] **Step 4:** a mesma linha. Esperado: PASS. Depois, `pnpm test && pnpm typecheck && pnpm build:vercel`.
- [ ] **Step 5:** `git commit -m "P1.3: painel de saldo e regras da escala dos oficiais"`

---

## O que fica para depois (versão 2 em diante, do design)

- O saldo entrando na conta da cota (a sobra para quem tem o menor saldo).
- As permutas, com a fase 9.
- Os dias vermelhos, com peso e saldo próprios.
- O cadastro dos quadros nas Configurações, quando o QOD for modelado.
- A coluna QUADRO nas planilhas de importação, se o usuário quiser.
