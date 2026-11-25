# API da escala prévia (7.3): lançar a prévia, o passado com justificativa, o registro e as leituras — plano de implementação

> **Refeita em parte pela 7.3.1** (`2026-11-25-fase7-3-1-api-dos-estados-da-escala.md`, 25/11): o modelo "prévia lançada: a corporação vê e o passado trava" deu lugar aos cinco estados da escala. Este plano fica como o registro do que a 7.3 entregou.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (entrega sem tela). Revisão final no Opus.

**Goal:** o escalante lança a prévia de uma escala num mês; a partir daí qualquer conta da corporação lê essa escala, e mexer num turno que já começou passa a ser só de gestor, coordenador e administrador, com justificativa e registro. O militar lê os próprios serviços das prévias lançadas.

**Architecture:** a tabela `escala_previa` (escala e mês; existir a linha é estar lançada). Um conferidor único, `conferirPassado`, chamado por todas as rotas que mudam alocação em `escala/rotas.ts`, decide entre deixar passar, recusar (escalante) ou exigir a justificativa e gravar o registro (`registrar`, da 7.1). As leituras da corporação ficam em rotas novas, `/api/previas/…` e `/api/eu/escala/:mes`, sem tocar nas camadas de visão da escala em montagem.

**Tech Stack:** Hono, Postgres, zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 9 a 15 e "Escolhas › Escala prévia" e "Visualização").

## Global Constraints

- Branch `fase7-3-api-da-escala-previa`, a partir da `main` com a 7.1 mesclada (usa `registro_de_alteracao` e `registrar`). Migração **0045**.
- Nenhuma tela (a 7.4 e a 7.5 fazem). As rotas que já existem continuam aceitando os corpos de hoje: a `justificativa` é campo opcional novo, só exigido no passado de prévia lançada.
- **Passado = o turno já começou:** `data + turno.inicio <= agora`, na hora de Recife. Criar `agoraRecife(): { dia: string; minutos: number }` em `apps/api/src/datas.ts` (ao lado de `hojeRecife`), com o relógio injetável nos testes.
- **Só trava escala com prévia lançada** naquele mês. Fora da trava: alocação sem escala (expediente, 6.40) e as rotas da rodada dos oficiais (`/unidades/:u/oficiais/…`).
- Mensagens fixas: `Este turno já começou. Só o gestor altera o passado.` (403, escalante); `Diga o motivo da alteração (pelo menos 10 letras).` (400, campo `justificativa`); `Esta escala ainda não tem prévia lançada.` (404 nas leituras da corporação).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Troca entre um turno passado e um futuro:** basta um dos dois lados ter começado para a regra do passado valer para a troca inteira (Task 2).
2. **Turno que começa hoje mais tarde:** ainda não é passado; o que começou há um minuto é (Task 2).
3. **"Desfazer" de uma remoção feita no passado:** também é mudança no passado, com a mesma regra (Task 2).
4. **Prévia recolhida:** a trava some, as leituras da corporação voltam a 404, e o registro já gravado continua legível (Task 1 e 3).
5. **Escala dos oficiais:** lançada, qualquer conta lê por `/api/previas`; não lançada, 404 ali, e a leitura de hoje (só oficiais, pelas camadas) não muda (Task 3).

---

### Task 1: migração 0045, lançar e recolher

**Files:** Create `apps/api/banco/migracoes/0045_escala_previa.sql`, `apps/api/src/escala/previa.ts`, `apps/api/test/escala-previa.test.ts`; Modify `apps/api/src/escala/rotas.ts`, `apps/api/src/escala/leitura.ts`, `pacotes/contratos/src/escala-do-mes.ts`

**Interfaces (Produces):**
```sql
create table escala_previa (
  escala_id uuid not null references escala (id), mes date not null check (extract(day from mes) = 1),
  lancada_por uuid references usuario (id), lancada_em timestamptz not null default now(),
  primary key (escala_id, mes));
```
com o gatilho de auditoria.
- `previaLancada(c: Consulta, escalaId: string, mes: string): Promise<{ em: string; por: { patente: string; nomeGuerra: string } | null } | null>`.
- `POST /api/escalas/:id/mes/:mes/previa` e `DELETE` no mesmo caminho (`CADASTRO` na unidade da escala; lançar duas vezes não é erro) → `EscalaDoMes`.
- `EscalaDoMes` ganha `previa: { em: string; por: string | null } | null` e `podeAlterarPassado: boolean` (quem pede é gestor, coordenador ou administrador da unidade).

- [ ] **Step 1: testes:** o escalante lança e recolhe; quem só lê recebe 403; a leitura do mês traz `previa`; Review Focus 4 (parte da trava).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.3: lançar e recolher a prévia da escala (0045)`.

### Task 2: o passado com justificativa e registro

**Files:** Create `apps/api/src/escala/passado.ts`; Modify `apps/api/src/datas.ts`, `apps/api/src/escala/rotas.ts` (todas as rotas que mudam alocação: `POST /escalas/:id/alocacoes`, `POST /alocacoes/:id/voltar-ao-turno`, `POST /resolucoes/desfazer`, `DELETE /alocacoes/:id`, `POST /remocoes/:id/desfazer`, `DELETE /remocoes/:id`, `POST /alocacoes/:id/trocar`, `POST /alocacoes/:id/acumulos`, `DELETE /acumulos/:id`, e o `POST …/pre-escala`), `pacotes/contratos/src/escala-do-mes.ts` (os corpos ganham `justificativa: z.string().trim().optional()`; nos `DELETE`, a justificativa vem no corpo JSON); Test `apps/api/test/escala-passado.test.ts`

**Interfaces (Produces):**
```ts
/** Os turnos que a mudança toca: cada um com a escala, o dia e o começo. */
export type Tocado = { escalaId: string | null; data: string; inicio: string };
/** null = pode seguir sem registro; { registrar } = pode seguir e deve gravar; lança Proibida (403) ou Recusa 400 com o campo `justificativa`. */
export async function conferirPassado(c: Consulta, usuarioId: string, tocados: Tocado[], justificativa: string | undefined, agora = agoraRecife()): Promise<null | { justificativa: string; escalas: { escalaId: string; unidadeId: string; mes: string; data: string }[] }>;
```
Cada rota monta os `Tocado` antes da mudança, chama `conferirPassado` e, se vier o objeto, grava `registrar({ tipo: 'escala_no_passado', antes, depois, justificativa, … })` na mesma transação: `antes` e `depois` são o retrato da vaga `{ data, servico, turno, guarnicao, funcao, militar: { patente, nomeGuerra, matricula } | null }`. A pré-escala (em lote) num mês de prévia lançada só preenche os turnos que ainda não começaram, sem registro.

- [ ] **Step 1: testes**, com o relógio fixo: sem prévia lançada, o escalante muda o passado como hoje; com a prévia, o escalante recebe 403 com a mensagem fixa em cada uma das rotas; o gestor sem justificativa recebe 400 no campo; com justificativa de 10 letras passa e grava uma linha com antes, depois, quem, quando e por quê; o coordenador (`gestor_lateral`) e o administrador também passam; turno futuro não pede nada; Review Focus 1, 2 e 3; alocação sem escala e as rotas dos oficiais não mudam.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.3: alterar o passado de uma prévia pede justificativa e fica no registro`.

### Task 3: as leituras da corporação, o registro e a Minha escala

**Files:** Create `apps/api/src/escala/previas-rotas.ts` (montado em `app.ts`), `pacotes/contratos/src/previas.ts`, `apps/api/test/previas-leitura.test.ts`; Modify `apps/api/src/rotas/eu.ts`, `pacotes/contratos/src/index.ts`

**Interfaces (Produces):**
```ts
export type PreviaDaLista = { escalaId: string; nome: string; unidadeId: string; unidadeSigla: string; mes: string; lancadaEm: string; dosOficiais: boolean };
export type MeuServico = { alocacaoId: string; data: string; inicio: string; fim: string; servico: string; escala: string; unidadeSigla: string; guarnicao: string | null; funcao: string | null; composicao: { patente: string; nomeGuerra: string; funcao: string | null; eu: boolean }[] };
export type MinhaEscala = { mes: string; servicos: MeuServico[] };
```
- `GET /api/previas/:mes` → `PreviaDaLista[]` (toda conta; as lançadas do mês, de todas as unidades não extintas, com `unidadeId` para a árvore).
- `GET /api/previas/escalas/:id/mes/:mes` → `EscalaDoMes` só para leitura (toda conta; 404 com a mensagem fixa se não lançada; sem `podeAlterarPassado`, candidatos nem pendências de montagem).
- `GET /api/escalas/:id/mes/:mes/registro` → `RegistroDeAlteracao[]` do tipo `escala_no_passado` (`exigirAlgumPapel`: só o militar comum não vê); `texto` como "Tirou 2º SGT RAMALHO de ABT-01 (Motorista), dia 03, 08:00".
- `GET /api/eu/escala/:mes` → `MinhaEscala`: as alocações do militar da conta em escalas com prévia lançada no mês, em ordem de dia e hora; `composicao` é a guarnição daquele turno. Conta sem militar: 404 `Esta conta não é de um militar.`.

- [ ] **Step 1: testes:** o militar comum lê a lista, uma prévia lançada e a própria escala; não lê a não lançada (404) nem o registro (403); o serviço em escala não lançada não aparece na Minha escala; o serviço numa unidade que o trouxe como externo aparece; Review Focus 4 e 5.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 5:** commit `Fase 7.3: a corporação lê as prévias lançadas e o militar a própria escala` e enviar a branch à PLANEJAMENTO.
