# API do voluntariado pelo militar (7.1): a coleta, o militar marca o próprio e o registro das correções — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (entrega sem tela). Revisão final no Opus.

**Goal:** o militar com conta marca o próprio voluntariado do mês enquanto a coleta da sua unidade está aberta; o gestor abre e fecha a coleta; a correção do escalante num mês preenchido pelo militar fica num registro.

**Architecture:** o dado não muda (`disponibilidade` e `voluntariado_lancamento`, com a origem `militar`, que a tabela já aceita). Entram: a tabela `voluntariado_coleta` (unidade e mês; existir a linha é estar aberta), a coluna `voluntariado_lancamento.pelo_militar` e a tabela `registro_de_alteracao`, que a 7.3 também usa. As rotas do próprio militar ficam em `/api/eu/voluntariado`; a do escalante (`PUT /militares/:id/voluntariado/:mes`) passa a gravar o registro quando corrige.

**Tech Stack:** Hono, Postgres, zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 1 a 8 e "Escolhas › Voluntariado").

## Global Constraints

- Branch `fase7-1-api-do-voluntariado-pelo-militar`, a partir da `main`. Migração **0044** (a PLANEJAMENTO aplica no banco de teste depois do merge, com a autorização do usuário).
- Nenhuma tela nesta entrega (a 7.2 faz as telas). O site continua compilando: os tipos novos de `contratos` só acrescentam.
- Matrículas fictícias `990xxx-x` nos testes. Textos sem jargão.
- Mensagens fixas: `A coleta de {mês por extenso} está fechada. Fale com o escalante da sua seção.` (409); `Só dá para marcar a partir de {mês atual por extenso}.` (409, mês passado); `Esta conta não é de um militar.` (404); `Você não está lotado em nenhuma seção em {mês por extenso}.` (409).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Militar que muda de lotação no meio do mês:** vale a unidade de `unidadeDoMilitarNoMes` (a mesma da tela do escalante) para a coleta e para os blocos (Task 2).
2. **Escalante lança um mês que o militar não preencheu:** sem registro, como hoje; e `pelo_militar` continua falso (Task 3).
3. **Escalante corrige e o militar marca de novo depois:** o registro antigo fica; a nova marcação do militar não cria registro (Task 3).
4. **Correção que não muda nada** (mesmas faixas): não cria registro (Task 3).
5. **Gestor que é militar marca o próprio pela rota `/eu`:** conta como militar, `pelo_militar` verdadeiro, sem registro, mesmo com nível de acesso (Task 2).

---

### Task 1: migração 0044 e os contratos

**Files:** Create `apps/api/banco/migracoes/0044_coleta_do_voluntariado_e_registro.sql`; Modify `pacotes/contratos/src/voluntariado.ts`, `apps/api/test/esquema-operacao.test.ts` (ou o teste de esquema que cobre o voluntariado)

**Interfaces (Produces):**
```sql
create table voluntariado_coleta (
  unidade_id uuid not null references unidade (id), mes date not null check (extract(day from mes) = 1),
  aberta_por uuid references usuario (id), aberta_em timestamptz not null default now(),
  primary key (unidade_id, mes));
alter table voluntariado_lancamento add column pelo_militar boolean not null default false;
create table registro_de_alteracao (
  id uuid primary key default gen_random_uuid(), em timestamptz not null default now(),
  usuario_id uuid not null references usuario (id), unidade_id uuid not null references unidade (id),
  tipo text not null check (tipo in ('voluntariado_corrigido', 'escala_no_passado')),
  militar_id uuid references militar (id), escala_id uuid references escala (id),
  mes date not null check (extract(day from mes) = 1), data date,
  antes jsonb, depois jsonb, justificativa text,
  check (tipo <> 'escala_no_passado' or (escala_id is not null and char_length(btrim(justificativa)) >= 10)),
  check (tipo <> 'voluntariado_corrigido' or militar_id is not null));
create index registro_de_alteracao_escala on registro_de_alteracao (escala_id, mes);
create index registro_de_alteracao_militar on registro_de_alteracao (militar_id, mes);
```
Com o gatilho de auditoria em `voluntariado_coleta` (o registro não precisa: ele próprio é o histórico; sem `update` nem `delete` pela aplicação).
```ts
// contratos/voluntariado.ts
export const ColetaDoVoluntariado = z.object({ aberta: z.boolean() });
export type MeuVoluntariado = VoluntariadoDoMilitar & { coletaAberta: boolean; podeMarcar: boolean; motivo: string | null; voluntarioJes: boolean; unidadeSigla: string };
export type RegistroDeAlteracao = { id: string; em: string; por: { patente: string; nomeGuerra: string } | null; tipo: 'voluntariado_corrigido' | 'escala_no_passado'; data: string | null; antes: unknown; depois: unknown; justificativa: string | null; texto: string };
```
`VoluntariadoDoMes` ganha `coletaAberta: boolean`, e `MilitarDoVoluntariado` ganha `peloMilitar: boolean` e `correcoes: number`.

- [ ] **Step 1: teste de esquema:** as tabelas e os `check` (registro `escala_no_passado` sem justificativa de 10 letras é recusado; a coleta repetida da mesma unidade e mês é recusada).
- [ ] **Step 2:** FAIL. **Step 3:** a migração e os contratos. **Step 4:** PASS. **Step 5:** commit `Fase 7.1: a coleta do voluntariado e o registro de alterações (0044)`.

### Task 2: a coleta e as rotas do próprio militar

**Files:** Create `apps/api/src/voluntariado/coleta.ts`, `apps/api/test/voluntariado-pelo-militar.test.ts`; Modify `apps/api/src/voluntariado/rotas.ts`, `apps/api/src/voluntariado/lancamento.ts`, `apps/api/src/voluntariado/leitura.ts`, `apps/api/src/rotas/eu.ts` (a `Eu` ganha `coletasAbertas: string[]`, os meses com coleta aberta para a lotação da pessoa, do mês atual em diante)

**Interfaces (Produces):**
- `coletaAberta(c: Consulta, unidadeId: string, mes: string): Promise<boolean>`; `mudarColeta(tx, unidadeId, mes, aberta: boolean, usuarioId): Promise<void>`.
- `lancar(tx, militarId, mes, faixas, usuarioId, origem: 'manual' | 'militar' = 'manual')`: a origem das faixas e `pelo_militar = (origem === 'militar')` só quando a origem é `militar`; o lançamento manual não zera `pelo_militar` (Task 3 decide o registro).
- `PUT /api/unidades/:u/voluntariado/:mes/coleta` (corpo `ColetaDoVoluntariado`; `GESTAO`; mês passado: 409) → `VoluntariadoDoMes`.
- `GET /api/eu/voluntariado/:mes` → `MeuVoluntariado` (os blocos de `blocosDaSecao` da unidade de `unidadeDoMilitarNoMes`; `podeMarcar` falso com o `motivo` das mensagens fixas).
- `PUT /api/eu/voluntariado/:mes` (corpo `LancamentoDeVoluntariado`) → `MeuVoluntariado`: o militar da conta (`usuario.militar_id`), a coleta aberta, o mês não passado, as faixas no mês; grava com a origem `militar`.

- [ ] **Step 1: testes:** o gestor abre e fecha, o escalante recebe 403; o militar comum marca com a coleta aberta e recebe 409 com a mensagem fixa fechada; mês passado 409; conta sem militar 404; o que ele marca aparece em `GET /unidades/:u/voluntariado/:mes` com `peloMilitar: true`, e a elegibilidade de outra unidade (militar externo) lê as mesmas faixas; faixa fora dos blocos (ex.: 09:30 às 11:00) é aceita e devolvida; Review Focus 1 e 5; `GET /api/eu` traz `coletasAbertas`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.1: o militar marca o próprio voluntariado com a coleta aberta`.

### Task 3: o registro das correções do escalante

**Files:** Create `apps/api/src/registro.ts`; Modify `apps/api/src/voluntariado/rotas.ts` (o `PUT /militares/:id/voluntariado/:mes`), `apps/api/src/voluntariado/leitura.ts`; Test `apps/api/test/voluntariado-pelo-militar.test.ts`

**Interfaces (Produces):**
- `registrar(tx: Consulta, r: { usuarioId: string; unidadeId: string; tipo: 'voluntariado_corrigido' | 'escala_no_passado'; militarId?: string; escalaId?: string; mes: string; data?: string; antes: unknown; depois: unknown; justificativa?: string }): Promise<void>` (a 7.3 usa a mesma função).
- `lerRegistro(c: Consulta, filtro: { militarId?: string; escalaId?: string; mes: string; tipo: … }): Promise<RegistroDeAlteracao[]>`, do mais novo para o mais velho; `texto` é a frase pronta ("Tirou 2 faixas e pôs 1 em 3 dias", para o voluntariado).
- `GET /api/militares/:id/voluntariado/:mes/registro` → `RegistroDeAlteracao[]` (quem lê a escala da unidade: `exigirLeituraDaEscala`).
- No `PUT` do escalante: se `pelo_militar` é verdadeiro e as faixas mudam, grava `voluntariado_corrigido` com `antes` e `depois` como listas `{ data, inicio, fim }`, na mesma transação do lançamento.

- [ ] **Step 1: testes:** Review Focus 2, 3 e 4; a correção cria uma linha com quem e quando; `correcoes` do militar na lista do mês conta as linhas; o militar comum não lê o registro (403).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 5:** commit `Fase 7.1: a correção do escalante fica no registro` e enviar a branch à PLANEJAMENTO.
