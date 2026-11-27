# Retorno da Grade (lote 6.71 + 6.72 + 6.73) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet high** executa; **Opus medium** revisa no fim (decisão do usuário). **Um lote:** as três entregas numa branch só, enviadas juntas e mescladas de uma vez (pedido do usuário, 27/11/2026).

**Goal:** o retorno da validação da 6.70: o expediente passa a ser só o lançado (6.71), a cota ganha os dias e perde a origem, e cota esgotada bloqueia (6.72), e quatro acabamentos de tela (6.73).

**Architecture:** 6.71 tira da API o expediente calculado (o "implícito" que a API monta para a jornada Adm) e a ordem fixa "Saldo primeiro"; o motor (`pacotes/dominio/src/choques.ts`) continua aceitando `implicito` (o protótipo e os casos usam), só a API deixa de mandar. 6.72 cria `cota_dia`, junta interna e externa numa cota e põe a conferência da cota numa função pura do motor, usada por `escalar` e por `opcoesDoDia`. 6.73 é só site.

**Tech Stack:** Hono, Postgres/PGlite, zod (`contratos`), React, TanStack, Vitest.

**Spec:** o retorno da VALIDAÇÃO de 27/11/2026 (registrado nas linhas 71, 72 e 73 de `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`) e as respostas do usuário de 27/11: a prioridade da cota **fica**; interna e externa do mesmo serviço e mês **viram uma cota com a soma**.

## Global Constraints

- Branch `fase6-71-73-retorno-da-grade`, a partir da `main`. Migração **`0053_cota_com_dias.sql`** (a 0052 é da 6.64); só roda com a autorização do usuário, no merge. A migração vale para o real e para o espelho (6.58), sem nada a fazer a mais.
- Commits com o prefixo da entrega: `Fase 6.71: …`, `Fase 6.72: …`, `Fase 6.73: …`. Enviar a branch **uma vez só**, no fim do lote.
- **Expediente:** só o serviço "Expediente" cadastrado (turno A), lançado pela pré-escala. Sem pré-escala gerada, nada choca com expediente. `tira_do_expediente` continua valendo, só para o expediente lançado.
- **Cota:** mês, unidade, serviço, quantidade, **prioridade (fica)** e a lista opcional de dias (data, mínimo ≥ 1, máximo opcional ≥ mínimo). Sem origem. Só serviço PJES ou diária tem cota (o gatilho `cota_servico_extra` continua).
- **Cota esgotada bloqueia escalar naquele serviço** (à mão e em qualquer caminho que passe por `escalar`); **não impede fechar a escala**; remover nunca é bloqueado.
- **Textos fixos:**
  - recusa do total: "A cota de {serviço} em {mês por extenso} acabou. Para escalar mais, aumente a cota na tela Cotas."
  - recusa do máximo do dia: "{serviço} já tem o máximo da cota em {dd/mm}."
  - recusa da reserva: "O que resta da cota de {serviço} está reservado para os dias com meta. Para escalar mais, aumente a cota na tela Cotas."
  - aviso do dia abaixo da meta, na Escala do mês: "{serviço}: {escalados} de {mínimo} neste dia."
  - erros dos dias: "A soma das metas dos dias passa da cota do mês."; "O dia precisa ser do mês da cota."; "O máximo não pode ser menor que a meta."
- Skill `frontend-design:frontend-design` nas tarefas de tela; tokens e componentes da 6.20; a cor dos serviços vem do cadastro e não muda.
- Nenhum dado pessoal real em repositório, teste ou CI (matrícula de teste nova: faixa `100xxx-x`). Só PGlite nos testes; nada em banco remoto.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador, em 1440 e 390 px, com dados fictícios.

## Review Focus

1. **Adm sem pré-escala:** nenhum choque com expediente, nenhum bloco cinza na Grade, e o Saldo A entra livre (Task 1).
2. **Adm com o expediente lançado:** o Saldo A dá "De expediente neste dia" com "Tirar do expediente e escalar aqui", que tira o lançado e escala numa transação só; o Pronto continua recusando (Task 1).
3. **Migração com interna e externa do mesmo serviço e mês:** uma cota só, com a soma e a menor prioridade das duas; a contagem das distribuídas não muda (Task 3).
4. **Cota reduzida abaixo do que já foi escalado:** editar passa, remover passa, só escalar mais é recusado (Task 4).
5. **Serviço ordinário (Pronto, Saldo, Expediente) no "Adicionar serviço":** continua aparecendo sem cota nenhuma; só PJES e diária dependem da cota (Task 4).

---

### Task 1 (6.71): o expediente só lançado, na API

**Files:** Modify `apps/api/src/escala/elegibilidade.ts` (~l.165-171: o `expediente` implícito e a ordem `ehSaldo`), `apps/api/src/escala/choque-do-lancamento.ts` (~l.50-57), `apps/api/src/grade/grade.ts` (~l.147-174), `apps/api/src/grade/dia.ts` (~l.113-146), `apps/api/src/escala/alocacoes.ts` (~l.256-264: o ramo do "expediente calculado some sozinho"), `apps/api/src/escala/horarios.ts` (comentário de `EXPEDIENTE`), o contrato do bloco da Grade (o campo `expediente` do bloco sai); Test `apps/api/test/expediente-so-lancado.test.ts` e os testes que hoje esperam o implícito.

**Interfaces (Produces):** o bloco da Grade sem o campo `expediente` (Task 2 consome); `choqueDoTurno` sem mudança de assinatura (recebe `expediente: []`, ou o parâmetro sai, à escolha do executor, desde que os chamadores fiquem coerentes).

- [ ] **Step 1: testes (`expediente-so-lancado.test.ts`):**
  - Adm em dia útil, sem expediente lançado: a Grade do mês não traz bloco de expediente; o dia não tem choque; o Saldo A e o Pronto A aparecem como candidatos sem "De expediente neste dia".
  - Adm com o expediente lançado pela pré-escala: Saldo A dá `DE_EXPEDIENTE` com `podeResolver: true` (serviço com `tira_do_expediente`); escalar com `resolverChoque: { expediente: true }` remove o lançado (remoção devolvível) e grava o Saldo; o Pronto A dá "De expediente neste dia" sem poder resolver.
  - Os candidatos do Adm saem na ordem de escala do cadastro (não mais com o Saldo primeiro).
- [ ] **Step 2:** FAIL. **Step 3:** implementar: tirar as quatro montagens de `implicito: true` da API, a ordem por `ehSaldo` e o ramo do calculado em `escalarResolvendo`; o motor não muda. **Step 4:** PASS, e `pnpm --filter api test` inteiro (ajustar os testes antigos que esperavam o implícito, sem apagar os que tratam do lançado). **Step 5:** commit `Fase 6.71: o expediente só lançado`.

### Task 2 (6.71): o painel do dia e o defeito do JES

**Files:** Modify `apps/web/src/componentes/grade/PainelDoDia.tsx` (l.53-55 e l.130), `apps/web/src/componentes/grade/CelulaDaGrade.tsx` e `LegendaDaGrade.tsx` (o bloco e a legenda do expediente calculado), `apps/web/src/componentes/grade/AdicionarServico.tsx` (se o defeito estiver nele); Test `apps/web/src/__testes__/painel-do-dia-expediente.test.tsx` e, para o defeito, o teste que o reproduzir (site ou API).

- [ ] **Step 1: o defeito primeiro (pedido do usuário: reproduzir antes de corrigir).** Caso: Adm (fictício, `100xxx-x`) em 01/12/2026 com o expediente lançado; no painel do dia, remover o expediente, abrir "Adicionar serviço", escolher **JES** na lista do turno (sem trocar a vaga) e "Escalar": hoje grava **Saldo**. Escrever o teste que mostra isso falhando. Suspeitas, a conferir: `LinhaDoTurno` cai em `opcao.servicos[0]` (o Saldo, primeiro pela ordem que a Task 1 tira) quando o `turnoEscolhido` não está na vaga da hora, por exemplo depois que as opções chegam de novo; ou a API recebe o `turnoId` certo e grava outro. Registrar a causa no commit.
- [ ] **Step 2: testes do painel:** o expediente lançado tem "Remover" (não mais "Tirar do expediente"), com a mesma confirmação dos outros serviços; nenhum bloco cinza "Expediente do ADM" nem item dele na legenda; o JES escolhido é o que vai no pedido (`turnoId` do JES) mesmo depois de as opções chegarem de novo; a escolha nunca troca de serviço sem a pessoa ver.
- [ ] **Step 3:** FAIL. **Step 4:** implementar e PASS. **Step 5:** commit `Fase 6.71: o painel do dia sem o expediente calculado e o JES que virava Saldo`.

### Task 3 (6.72): o banco e a regra da cota

**Files:** Create `apps/api/banco/migracoes/0053_cota_com_dias.sql`, `pacotes/dominio/src/cota-do-mes.ts` (e a exportação em `pacotes/dominio/src/index.ts`); Test `apps/api/test/migracao-0053.test.ts`, `pacotes/dominio/test/cota-do-mes.test.ts`.

**Interfaces (Produces):**
- Tabela `cota_dia (cota_id uuid not null references cota on delete cascade, data date not null, minimo int not null check (minimo >= 1), maximo int check (maximo is null or maximo >= minimo), primary key (cota_id, data))`, com a auditoria de sempre; gatilho que recusa `data` fora do mês da cota.
- Na `cota`: as linhas do mesmo `(unidade_id, mes, servico_id)` viram uma, com `quantidade` somada e `prioridade` = a menor; sai `origem`; `cota_unica` passa a `(unidade_id, mes, servico_id)`.
- `conferirCota(d: { quantidade: number; dias: { data: string; minimo: number; maximo: number | null }[]; escaladosNoMes: number; escaladosPorDia: Record<string, number>; data: string }): null | 'esgotada' | 'maximo_do_dia' | 'reservada'`.

- [ ] **Step 1: testes do motor (`cota-do-mes.test.ts`):** a regra, com estes casos:
  - só o total (sem dias): 10 de 10 → `'esgotada'`; 9 de 10 → `null`.
  - dia com máximo 2 e 2 escalados nele → `'maximo_do_dia'`.
  - reserva: total 10, um dia com meta 3 e nenhum escalado nele, 7 escalados nos outros dias, escalar num dia sem meta → `'reservada'`; escalar no próprio dia da meta → `null`.
  - meta já cumprida não reserva: total 10, meta 3 com 3 escalados, 6 nos outros dias, escalar num dia sem meta → `null`.
  A regra da reserva: `reservado = Σ max(0, mínimo − escalados)` dos dias com meta **diferentes** de `data`; recusa se `escaladosNoMes + reservado >= quantidade` (fora o caso do total, que vem antes).
- [ ] **Step 2: testes da migração (`migracao-0053.test.ts`):** interna 4 (prioridade 2) e externa 3 (prioridade 1) do mesmo serviço e mês viram uma cota de 7 com prioridade 1; cota só interna fica igual; duas unidades não se misturam; `cota_dia` com data de outro mês é recusada; a coluna `origem` não existe mais.
- [ ] **Step 3:** FAIL. **Step 4:** implementar e PASS. **Step 5:** commit `Fase 6.72: a cota com dias e sem origem, no banco e no motor`.

### Task 4 (6.72): a cota na API

**Files:** Modify `pacotes/contratos/src/cotas-feriados.ts` (sai `OrigemCota`; `Cota` ganha `dias`; novo `DiasDaCota`), `apps/api/src/cadastros/cotas.ts` (listar com os dias; `PUT /cotas/:id/dias`; copiar sem os dias), `apps/api/src/importacao/cotas.ts` (sai a coluna ORIGEM e o tipo), `apps/api/src/escala/alocacoes.ts` (`escalar` confere a cota), `apps/api/src/grade/dia.ts` (`opcoesDoDia`), `apps/api/src/escala/leitura.ts` e `pacotes/contratos/src/escala-do-mes.ts` (o aviso do dia); Test `apps/api/test/cota-com-dias.test.ts`, os testes de cotas e da importação.

**Interfaces:**
- Consumes: `conferirCota` (Task 3).
- Produces: `DiaDaCota = { data: string; minimo: number; maximo: number | null }`; `Cota` com `dias: DiaDaCota[]` e sem `origem`; `PUT /api/cotas/:id/dias` com `{ dias: DiaDaCota[] }` (troca a lista toda); `DiaDaEscala.metasAbaixo: { servico: string; minimo: number; escalados: number }[]`.

- [ ] **Step 1: testes (`cota-com-dias.test.ts`):**
  - `PUT /cotas/:id/dias`: grava e devolve os dias; soma das metas acima da quantidade → 400 "A soma das metas dos dias passa da cota do mês."; dia de outro mês → 400 "O dia precisa ser do mês da cota."; máximo menor que a meta → 400 "O máximo não pode ser menor que a meta.".
  - `escalar` num serviço PJES com a cota cheia → 409 com a frase do total; com o máximo do dia → 409 com a frase do máximo; com o resto reservado → 409 com a frase da reserva; remover continua passando; editar a quantidade abaixo do já escalado passa (Review Focus 4).
  - `opcoesDoDia` não mostra serviço PJES ou diária sem cota no mês nem com a cota recusada naquele dia; Pronto, Saldo e Expediente continuam (Review Focus 5).
  - A Escala do mês traz `metasAbaixo` no dia com meta abaixo do mínimo, e fechar a escala continua possível.
  - Importação: a planilha sem ORIGEM importa; o modelo não tem mais a coluna.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; a contagem de escalados é a mesma de `cotasDoMes` (alocações do serviço no mês, em escalas da unidade), mais a do dia. **Step 4:** PASS. **Step 5:** commit `Fase 6.72: a cota com dias na API e a cota esgotada que bloqueia`.

### Task 5 (6.72): a tela Cotas, o aviso e os documentos

**Files:** Modify `apps/web/src/routes/_app/cotas.tsx` e `apps/web/src/lib/cotas.ts` (sai a origem; os dias da cota), o dia da Escala do mês em `apps/web/src/componentes/escala-do-mes/` (o aviso), `docs/negocio/regras/cotas-voluntariado-permutas.md` e `docs/negocio/regras/LEIAME.md` (RN-34 e RN-89 ficam sem efeito, com a data; a RN-50 deixa de citar interna e externa), `docs/negocio/glossario.md` (cota), `docs/decisoes.md`; Test `apps/web/src/__testes__/cotas.test.tsx`, `apps/web/src/__testes__/escala-do-mes.test.tsx`.

- [ ] **Step 1: testes:** a tela Cotas sem o campo e a coluna Origem; em cada cota, "Dias da cota" abre a lista para pôr data e meta (o máximo não aparece na tela por agora); o erro da API fica na janela, com o que foi digitado; a Escala do mês mostra no dia o aviso "{serviço}: {escalados} de {mínimo} neste dia." e o botão de fechar continua ativo; celular (390 px) sem rolagem de lado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: documentos**, três linhas em `docs/decisoes.md` (27/11/2026):
  - "Cota esgotada bloqueia escalar naquele serviço (à mão e na pré-escala): o escalante não cria cota do nada; o caminho é aumentar a cota na tela Cotas. Não impede fechar a escala."
  - "O expediente calculado da jornada Adm sai: expediente é só o serviço Expediente lançado pela pré-escala; sem pré-escala, nada choca com expediente. A regra fixa 'o Adm entra pelo Saldo' sai; vale a ordem de escala do cadastro."
  - "A cota perde a origem (interna/externa): na migração, as duas do mesmo serviço e mês viram uma com a soma; a prioridade fica. A cota ganha os dias (meta e máximo); RN-34 e RN-89 ficam sem efeito."
  Commit `Fase 6.72: a tela Cotas com os dias, o aviso da meta e os documentos`.

### Task 6 (6.73): acabamento das telas

**Files:** Modify `apps/web/src/componentes/DegrausDaUnidade.tsx` (l.~194-208: o nível de uma opção só), `apps/web/src/componentes/Topo.tsx` (o botão da árvore inteira, com o `PainelDaArvore` de `componentes/EscolherUnidade.tsx`, como era antes da 6.61: ver `git show 3dfd793^:apps/web/src/componentes/Topo.tsx`), `apps/web/src/componentes/grade/AdicionarServico.tsx` (a vaga inicial), `apps/web/src/componentes/grade/TabelaDaGrade.tsx` (l.~197: o `bg-passa` do fim de semana e do feriado), `apps/web/src/estilo.css` (`.afastado-traco`, l.~161-178); Test `apps/web/src/__testes__/degraus-da-unidade.test.tsx`, `apps/web/src/__testes__/grade-acabamento.test.tsx` e o teste do "Adicionar serviço".

- [ ] **Step 1: testes:**
  - Degraus: o nível com uma opção só (CBMPE, DGO) é botão quando a pessoa tem acesso a ela; clicar faz dela a unidade de trabalho (com o aviso de alteração pendente, como os outros); sem acesso, continua só texto.
  - O botão "Ver todas as unidades" (ao lado dos degraus) abre a árvore inteira, e escolher nela troca a unidade de trabalho; no celular, dentro do painel dos degraus.
  - "Adicionar serviço": a vaga marcada ao abrir é "Sem guarnição" em todo turno que a tem.
  - Grade: as colunas de fim de semana e feriado não têm fundo (o ponto do feriado no cabeçalho fica).
  - O traço do afastado tem o mesmo desenho em toda célula: o padrão em px fixos (6 px de traço e 4 px de vão), não em % da célula (o teste lê a regra de `estilo.css` e confere que `background-size` não usa %).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim do lote; no navegador, em 1440 e 390 px, conferir a Grade do ADM de dez/2026 com dados fictícios e vários afastados (os traços iguais entre as linhas). **Step 5:** commit `Fase 6.73: os degraus, a vaga sem guarnição, a Grade sem fundo no fim de semana e o traço igual`, e enviar a branch à PLANEJAMENTO com o resumo das três entregas.
