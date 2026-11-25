# API dos estados da escala (7.3.1): rascunho, prévia, publicada, retificada e remessada — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (entrega sem tela). Revisão final no Opus.

**Goal:** a escala de cada mês passa por cinco estados. A prévia só é vista pela unidade e pelas de baixo, a publicada por toda a corporação. A trava do passado vale em qualquer estado menos o rascunho. Mexer numa escala publicada acende sozinho "Escala em retificação" até o gestor republicar.

**Architecture:** a tabela `escala_previa` (7.3) vira `escala_estado`, com uma linha por escala e mês (sem linha é rascunho). `conferirPassado` deixa de olhar "prévia lançada" e passa a olhar o estado; ele também devolve quais escalas entram em retificação, e a rota marca na mesma transação. As leituras da corporação saem de `/api/previas` e ganham a regra de quem vê cada estado.

**Tech Stack:** Hono, Postgres, zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões 9 a 18 e "Escolhas › Estados da escala"). Refaz a parte da 7.3 que supunha "prévia lançada: a corporação vê e o passado trava".

## Global Constraints

- Branch `fase7-3-1-estados-da-escala`, a partir da `main` (a 7.3 já está nela). Migração **0046**. Não aplique a migração no banco de teste: a PLANEJAMENTO pede a autorização do usuário depois do merge.
- Nenhuma tela (a 7.4 e a 7.5 fazem). As rotas de alocação continuam aceitando os corpos de hoje.
- **Quem pode o quê:** lançar a prévia, `CADASTRO` na unidade da escala; publicar e republicar, `GESTAO` (gestor, coordenador, administrador); depois de remessada, só `administrador`.
- **Estado por escala e mês.** Sem linha em `escala_estado` é rascunho. O estado vive na linha: `previa`, `publicada`, `retificada`, `remessada`; mais `em_retificacao` (só verdadeiro em `publicada` ou `retificada`).
- **Passado = o turno já começou** (`agoraRecife`, da 7.3). **Rascunho não trava.** Fora da trava, como na 7.3: alocação sem escala (expediente, 6.40) e a rodada dos oficiais (`/unidades/:u/oficiais/…`).
- Mensagens fixas: `Este turno já começou. Só o gestor altera o passado.` (403, escalante); `Diga o motivo da alteração (pelo menos 10 letras).` (400, campo `justificativa`); `Esta escala já foi remessada. Só o administrador altera.` (403); `Só o gestor publica a escala.` (403); `Esta escala já foi publicada.` (409, lançar prévia depois de publicada); `Esta escala ainda não foi publicada.` (409, republicar); `Esta escala não está em retificação.` (409); `Esta escala já foi remessada.` (409, publicar ou republicar); `Esta escala não está aberta para você.` (404 nas leituras da corporação, para rascunho e para prévia fora do alcance).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Rascunho livre:** o escalante troca e tira alocações de dias passados sem justificativa e sem registro; na primeira mudança depois de "Lançar prévia", o mesmo gesto passa a pedir o gestor e a justificativa (Task 2).
2. **A retificação acende só quando a mudança vale:** o escalante altera um turno futuro de escala publicada e ela passa a `em_retificacao` sem registro; a mudança recusada (403 por ser passado) não acende nada; mudança em prévia nunca acende (Task 2).
3. **Quem vê a prévia:** o militar lotado na unidade ou abaixo dela vê; o lotado em unidade acima ou irmã não vê; o de outra unidade escalado nela vê; na escala dos oficiais, o militar não oficial não vê, mesmo lotado na unidade (Task 3).
4. **Republicar:** só o gestor; sem retificação aberta responde 409; depois de republicar (`retificada`), uma nova mudança acende de novo (Task 1 e 2).
5. **Remessada:** gestor e escalante recebem 403 em qualquer mudança, de turno passado ou futuro; o administrador passa com justificativa e deixa registro (Task 2).

---

### Task 1: migração 0046, o estado e as passagens

**Files:** Create `apps/api/banco/migracoes/0046_escala_estado.sql`, `apps/api/src/escala/estado.ts`, `apps/api/test/escala-estado.test.ts`; Modify `apps/api/src/escala/rotas.ts` (sai o `DELETE …/previa`), `apps/api/src/escala/leitura.ts`, `apps/api/src/escala/previa.ts` (removido: o que ele fazia passa para `estado.ts`), `pacotes/contratos/src/escala-do-mes.ts`

**Interfaces (Produces):**
```sql
create table escala_estado (
  id uuid not null unique default gen_random_uuid(),
  escala_id uuid not null references escala (id),
  mes date not null check (extract(day from mes) = 1),
  estado text not null check (estado in ('previa','publicada','retificada','remessada')),
  em_retificacao boolean not null default false check (not em_retificacao or estado in ('publicada','retificada')),
  mudou_por uuid references usuario (id), mudou_em timestamptz not null default now(),
  primary key (escala_id, mes));
```
com o gatilho de auditoria. A mesma migração copia cada linha de `escala_previa` para `escala_estado` como `previa` (`mudou_por` = `lancada_por`, `mudou_em` = `lancada_em`) e apaga `escala_previa` com o gatilho dela.
```ts
// contratos
export const EstadoDaEscala = z.enum(['rascunho', 'previa', 'publicada', 'retificada', 'remessada']);
export type EstadoDoMes = { estado: z.infer<typeof EstadoDaEscala>; emRetificacao: boolean; em: string | null; por: string | null };
// estado.ts
export async function estadoDoMes(c: Consulta, escalaId: string, mes: string): Promise<EstadoDoMes>; // sem linha: { estado: 'rascunho', emRetificacao: false, em: null, por: null }
export async function mudarEstado(tx: Consulta, escalaId: string, mes: string, para: 'previa' | 'publicada' | 'republicar', usuarioId: string): Promise<void>; // lança Conflito (409) com a mensagem fixa da passagem recusada
```
- `POST /api/escalas/:id/mes/:mes/previa` (`CADASTRO`), `POST …/publicar` e `POST …/republicar` (`GESTAO`; escalante recebe `Só o gestor publica a escala.`) → `EscalaDoMes`. Passagens: rascunho→prévia; rascunho ou prévia→publicada; publicada ou retificada com `em_retificacao`→retificada. Repetir a mesma passagem não é erro (lançar a prévia de uma prévia, publicar uma publicada); passagem que volta ou pula a regra responde 409 com a mensagem fixa.
- `EscalaDoMes` perde `previa` e ganha `estado: EstadoDoMes` e `podePublicar: boolean` (quem pede é `GESTAO` na unidade da escala); `podeAlterarPassado` continua.

- [ ] **Step 1: testes:** o escalante lança a prévia e não publica (403); o gestor publica do rascunho e da prévia; republicar sem retificação aberta é 409; lançar a prévia de escala já publicada é 409; a leitura do mês traz `estado` e `podePublicar`; a migração leva a linha de `escala_previa` para `previa`; o `DELETE` antigo não existe mais.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 7.3.1: os estados da escala e as passagens (0046)`.

### Task 2: a trava do passado por estado e a retificação automática

**Files:** Modify `apps/api/src/escala/passado.ts`, `apps/api/src/escala/rotas.ts` (as mesmas rotas de alocação da 7.3, mais `POST …/pre-escala`), `apps/api/src/escala/estado.ts`; Test `apps/api/test/escala-passado.test.ts` (ajustar os da 7.3), `apps/api/test/escala-estado.test.ts`

**Interfaces (Produces):**
```ts
export async function conferirPassado(c: Consulta, usuarioId: string, tocados: Tocado[], justificativa: string | undefined, agora = agoraRecife()):
  Promise<{ registro: null | { justificativa: string; alvos: Alvo[] }; retificar: { escalaId: string; mes: string }[] }>;
export async function marcarRetificacao(tx: Consulta, escalas: { escalaId: string; mes: string }[]): Promise<void>; // em_retificacao = true onde o estado é publicada ou retificada
```
Regras de `conferirPassado`, por escala e mês tocados: **rascunho** (sem linha): nada trava e nada se registra. **Prévia, publicada e retificada:** turno que já começou segue a regra da 7.3 (escalante 403; `GESTAO` com justificativa de 10 letras grava o registro). **Remessada:** qualquer turno, passado ou futuro, só passa o `administrador`, com justificativa e registro; os outros recebem `Esta escala já foi remessada. Só o administrador altera.`. `retificar` traz as escalas tocadas que estão em `publicada` ou `retificada`; cada rota, depois de mudar, chama `marcarRetificacao` na mesma transação (mudança recusada ou desfeita por erro não acende nada).

- [ ] **Step 1: testes**, com o relógio fixo: Review Focus 1, 2 e 5; em prévia, publicada e retificada o escalante recebe 403 no passado em cada rota e o gestor passa com a justificativa (a regra da 7.3 por estado); troca entre um turno passado e um futuro vale inteira; a pré-escala em lote numa escala publicada só preenche turnos que não começaram e a deixa em retificação; expediente sem escala e rodada dos oficiais seguem fora.
- [ ] **Step 2:** FAIL. **Step 3:** implementar e ligar nas rotas. **Step 4:** PASS. **Step 5:** commit `Fase 7.3.1: o passado trava fora do rascunho e a escala publicada entra em retificação`.

### Task 3: quem vê cada estado e as leituras da corporação

**Files:** Create `apps/api/src/escala/visibilidade.ts`, `apps/api/test/visualizacao-leitura.test.ts`; Modify `apps/api/src/escala/previas-rotas.ts` (renomear para `visualizacao-rotas.ts`), `apps/api/src/app.ts`, `pacotes/contratos/src/previas.ts` (renomear para `visualizacao.ts`), `pacotes/contratos/src/index.ts`, `apps/api/test/previas-leitura.test.ts` (removido: os casos passam para o teste novo)

**Interfaces (Produces):**
```ts
export async function podeVerEscala(c: Consulta, usuarioId: string, escalaId: string, mes: string): Promise<boolean>;
export type EscalaVisivel = { escalaId: string; nome: string; unidadeId: string; unidadeSigla: string; mes: string; estado: 'previa' | 'publicada' | 'retificada' | 'remessada'; emRetificacao: boolean; em: string; dosOficiais: boolean };
// MeuServico ganha: estado: EscalaVisivel['estado']; emRetificacao: boolean;  (PreviaDaLista deixa de existir)
```
Regra de `podeVerEscala`: publicada, retificada e remessada, toda conta de militar. **Prévia:** o militar da conta lotado hoje na unidade da escala ou em unidade abaixo dela (a árvore que o código já tem, a mesma do "e as de baixo" do Pecúlio), ou escalado na escala naquele mês; na escala dos oficiais (`distribuicao <> 'pre_escala'`), só se o militar é oficial (o mesmo critério da camada Oficial da 6.12). Quem já lê a escala em montagem por nível de acesso (`exigirLeituraDaEscala`) continua lendo em qualquer estado. **Rascunho:** só esse último caminho. A lista não calcula a lotação do militar nem a árvore uma vez por escala: uma vez por pedido.
- `GET /api/visualizacao/escalas/:mes` → `EscalaVisivel[]` (as que a conta pode ver, de unidades não extintas; `unidadeId` para a árvore da tela).
- `GET /api/visualizacao/escalas/:id/mes/:mes` → `EscalaDoMes` só para leitura, como a 7.3 devolvia em `/api/previas/escalas/…` (sem candidatos, pendências, matrícula nem cota), agora com `estado`; 404 `Esta escala não está aberta para você.` se `podeVerEscala` for falso.
- `GET /api/escalas/:id/mes/:mes/registro` e `GET /api/eu/escala/:mes` continuam; a Minha escala traz as alocações do militar nas escalas que não são rascunho, cada serviço com `estado` e `emRetificacao`.

- [ ] **Step 1: testes:** Review Focus 3 inteiro; publicada: qualquer militar com conta lê; rascunho: o militar comum recebe 404 e quem tem nível de acesso na unidade lê pela rota de hoje; a lista traz só o que a conta vê; a Minha escala traz o serviço em prévia com `estado: 'previa'` e o em retificação com `emRetificacao: true`; o serviço em rascunho não aparece; conta sem militar: 404 `Esta conta não é de um militar.`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 5:** commit `Fase 7.3.1: a prévia só para a unidade e as de baixo, a publicada para a corporação`.

### Task 4: o acabamento da 7.3

**Files:** os que as correções pedirem; Test os mesmos da 7.3.

Leia a linha 19 de `docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md` e resolva cada ponto que ainda existe depois das Tasks 1 a 3: "permitir de novo" que pede justificativa mas não grava linha; troca entre escalas diferentes que deixa o lado futuro fora do registro; a frase "em sem guarnição"; o `GET` da pré-escala que conta turnos já começados; as lacunas de teste. O que deixou de existir com os estados, diga no resumo.

- [ ] **Step 1:** um teste que falha para cada ponto que ainda vale. **Step 2:** FAIL. **Step 3:** corrigir. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 5:** commit `Fase 7.3.1: o acabamento da 7.3` e enviar a branch à PLANEJAMENTO.
