# Fase 4 — Montagem da escala: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O escalante monta um mês real da 1ª SB no sistema novo (pré-escala, ajustes, voluntariado, documento), em paralelo com as planilhas, e o militar comum vê a própria escala.

**Architecture:** A `alocacao` é a fonte da verdade da escala. A API lê o mês do banco, traduz para a entrada do motor (`pacotes/dominio`, que trabalha com matrícula, data, nome do serviço e letra do turno) e traduz o resultado de volta para ids. As telas de escala são de leitura; a edição é pela lista "Escolher militar" e pela ficha lateral. Cada entrega é um PR, executada quando o usuário libera; as entregas 2 a 6 são detalhadas neste arquivo antes de começar, como na fase 3.

**Tech Stack:** pnpm monorepo; API Hono + Postgres (PGlite nos testes); site React 19, TanStack Router e Query, Tailwind 4/shadcn; contratos zod 4; motor `pacotes/dominio`; ExcelJS (documento).

**Spec:** `docs/superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md` (entregas 1.1 e 2.1), `docs/superpowers/specs/2026-11-16-migracao-design.md` (adendos de 17/11 "Pré-escala automática e ajustes do escalante" e de 18/11 "Hierarquia de CNH"), `docs/superpowers/specs/2026-11-16-telas.md` (Grade geral, Escala do mês, Minha escala, Voluntariado), `docs/superpowers/specs/2026-11-16-esquema-banco.md` (seção 6 "O mês" e 7 "Configurações e documentos"), `docs/superpowers/plans/2026-11-16-roadmap-migracao.md` (Fase 4 e "Resultado da revisão 3").

## Global Constraints

- Uma entrega por branch e por PR (`fase4-N-<tema>`), a partir da `main`; **parar até o merge** ao fim de cada entrega. Quem mescla é o usuário.
- D7: nenhum dado pessoal real em repositório, teste ou CI; matrículas fictícias `990xxx-x`. Nunca ler nem imprimir segredos (`apps/api/.env.teste`).
- Textos em português, sem jargão; erro diz o que fazer (`{ erro, campos? }`). Vermelho só para erro e choque; pendência em âmbar.
- "O escalante nunca deve ser bloqueado de fechar a escala": a API recusa só o que quebra regra do motor ou do banco, sempre com o motivo; a tela nunca trava a montagem por aviso.
- Datas: dia `aaaa-mm-dd`, mês `aaaa-mm`, "hoje" pelo fuso de Recife (`hojeRecife`). O turno que atravessa a meia-noite pertence ao dia em que começa (`alocacao.data`).
- Hierarquia de CNH fixa no código (`CNH_HABILITA`, `cnhHabilitadas` de `dominio`): A isolada; cadeia B, C, D, E.
- O motor não muda sem caso gravado do protótipo (`pnpm casos:gravar`, conferir `git diff casos`); regra só do sistema novo tem teste em `pacotes/dominio/test`.
- Migração nova: o PR marca "tem migração" e lembra `pnpm --filter api db:migrar:teste` depois do merge.
- Padrões do site já existentes: `FichaPainel`, `AcoesDoBloco`, `useTrava` (Salvar sem clique duplo), `useSincronizar`, `usePendencia`, `Campo`, `mensagemDe`. Toda gravação invalida as consultas que dependem dela (escala do mês, grade geral, minha escala).
- Contagens de partida: protótipo 589, contratos 14, motor 771 (+1 ignorado), API 484, site 270. Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`.
- Commits `Fase 4.N: …`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; descrição do PR terminando com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

As condições que o design implica e que mais podem morder quem monta a escala; cada uma tem teste na tarefa dona (entrega 1):

1. **Turno que atravessa a meia-noite** (20h às 08h): aparece só no dia em que começa; choca com um turno que começa às 06h do dia seguinte; afastamento que começa no dia seguinte não o barra, o que termina no próprio dia o barra. Tarefas 2 e 3.
2. **Virada do mês**: o turno B do último dia termina no mês seguinte; a alocação do dia 31 do mês anterior choca com a manhã do dia 1. Tarefa 3.
3. **Lotação que muda no meio do mês**: o militar transferido só aparece como candidato nos dias em que está lotado na seção da escala. Tarefa 3.
4. **Dois cliques ou dois escalantes na mesma vaga**: a segunda gravação recebe 409 com o motivo, nunca 500; a função não passa do máximo. Tarefa 4.
5. **Guarnição desativada no mês ou vínculo de outra vigência**: o card só aparece nos meses em que a guarnição está ativa e vinculada àquela faixa. Tarefa 2.

---

## Mapa das entregas

| Entrega | O que a pessoa ganha | Depende de |
|---|---|---|
| **1 — Escala do mês, à mão** | Abrir uma escala e um mês, ver dia › turno › cards de guarnição com ícone de completa ou faltando, escolher militar na lista já filtrada (CNH, choque, afastamento, voluntariado, lotação) e remover (com "Desfazer remoção"). | — |
| **1.1 — Acúmulo de funções** | Na vaga vazia, escolher um militar já escalado na mesma faixa (inclusive de outra guarnição) para acumular; a CNH da vaga é conferida; o card mostra "acumula com Chefe ABT". | 1 |
| **2 — Voluntariado lançado à mão** | Calendário do mês por militar com A e B por dia, "já lançados" e "faltam lançar", atalhos e "Salvar e ir para o próximo". | — |
| **2.1 — Ordem de escala** | Tela da escala com as vagas de cada guarnição em quadrados para numerar a vez de cada uma (vigência por mês); os cards da escala do mês seguem a ordem. Substitui a prioridade da guarnição (RN-08). | 1 |
| **3 — Pré-escala e distribuições** | "Gerar pré-escala" (Pronto pelo ciclo das equipes), saldos do Adm e operações pelas cotas, com o que ficou de fora e por quê. Gerar de novo só completa lacunas e respeita as remoções. Os militares entram nas vagas seguindo a ordem de escala à risca (o mais antigo apto em cada vaga). | 1, 2 e 2.1 |
| **4 — Grade geral** | Uma linha por militar, uma coluna por dia, blocos na cor do serviço com a letra, choques em vermelho, pegas de pedidas por PJES e Diária, ficha lateral com Trocar, Remover e Adicionar. | 1, 2 |
| **5 — Gerar documento** | Configurações › Modelos de impressão (enviar e baixar o .xlsx com marcadores) e "Gerar documento" da escala publicada em .xlsx; cada geração fica guardada. | 1 |
| **6 — Minha escala** | O militar comum vê os próprios serviços do mês, com quem compõe a guarnição, e as escalas publicadas da unidade dele. | 1, 5 |

**Marco da fase:** um mês real da 1ª SB montado no sistema, em paralelo com as planilhas, e comparado no fim (o usuário conduz).

**Fora da fase 4 (já no roadmap):** Efetivo do dia, permutas e escala executada (fase 5); importação do Google Forms e regras novas (fase 6); militares externos por vínculo, outros níveis e o próprio militar marcar voluntariado (fase 7). PDF: se o serviço de PDF não estiver pronto, a fase 4 entrega o .xlsx e o PDF sai pelo "Salvar como PDF" de quem abrir (D5).

**Pendências que entram:** mudar letra ou horário de turno com militares escalados passa a dar 409 (entrega 1); `distribuirAdm` sem `servico` com remoções, `turnosPadraoExigidos` no turno noturno de 24h e nomes comparados ora normalizados ora exatos (entrega 3, na camada que traduz para o motor).

---

# Entrega 1 — Escala do mês, à mão

**Branch:** `fase4-1-escala-do-mes`. **Tem migração** (0014).

**Decisões desta entrega (propostas; o usuário revisa no plano):**
- **Serviço de quem entra pela lista:** a faixa da vaga pode corresponder a turnos de mais de um serviço da escala (ex.: Pronto A e JES A, ambos das 08h às 20h). Cada candidato vem com os serviços em que ele pode entrar nessa faixa, na ordem da escala; a lista propõe o primeiro e deixa trocar.
- **Faixa noturna:** a barra é escura quando a faixa atravessa a meia-noite ou começa às 18h ou depois; clara nos demais casos.
- **Militares externos:** ficam para a fase 7 (não há cadastro de vínculo externo); a lista traz só os lotados na seção no dia.
- **Remoção:** "Remover" pede confirmação, apaga a alocação e grava a remoção na mesma transação; a faixa mostra "Removidos: NOME (desfazer)". Escalar o mesmo militar de novo na mesma combinação também desfaz (gatilho do banco).
- **Dias completos recolhidos:** fora desta entrega; "Mostrar só vagas vazias" cobre o uso.
- **Regras do motor na lista (revisão final):** Saldo só para militar do Adm (RN-03; o Adm entra pelo Saldo quando a faixa o tem) e uma diária por dia para o mesmo militar (RN-36) valem na lista e na gravação, com as frases "Saldo só para militar do Adm" e "Já tem uma diária neste dia".
- **"Permitir de novo" (antes "Desfazer"):** na linha "Removidos", o botão só tira a marca de remoção (a pré-escala poderá escalar o militar neste turno de novo); não o põe de volta na vaga. Para ele voltar agora, escolhe-se o militar na vaga (isso também apaga a marca). A tabela `remocao` entra na auditoria.

## Arquivos

- API: criar `apps/api/banco/migracoes/0014_remocao.sql`; criar `apps/api/src/escala/{leitura,elegibilidade,rotas}.ts`; registrar as rotas em `apps/api/src/app.ts`; exportar `vinculosDaEscala` de `cadastros/escalas.ts` e `feriadosDoAno` de `cadastros/feriados.ts`; 409 de turno com alocação em `cadastros/servicos.ts`.
- Contratos: criar `pacotes/contratos/src/escala-do-mes.ts` e exportar em `index.ts`.
- Site: criar `apps/web/src/api/escala-do-mes.ts`, `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/componentes/escala-do-mes/{DiaDaEscala,CardDaGuarnicao,EscolherMilitar}.tsx`; ligar "Escala do mês" no `Trilho.tsx`.
- Testes: `apps/api/test/{migracao-0014,escala-leitura,escala-candidatos,escala-alocacao}.test.ts`, `apps/web/src/__testes__/escala-do-mes.test.tsx`.

### Task 1: Remoções no banco e contratos da escala do mês

**Files:**
- Create: `apps/api/banco/migracoes/0014_remocao.sql`, `pacotes/contratos/src/escala-do-mes.ts`
- Modify: `pacotes/contratos/src/index.ts`
- Test: `apps/api/test/migracao-0014.test.ts` (padrão do `migracao-0013.test.ts`)

**Interfaces:**
- Produces (banco): tabela `remocao (id uuid pk, militar_id, escala_id, servico_id, turno_id, data, removida_por uuid null → usuario, removida_em timestamptz default now(), unique (militar_id, data, servico_id, turno_id))`, como no esquema; gatilho `after insert on alocacao` que apaga a remoção com a mesma chave.
- Produces (contratos), usados pelas tarefas 2 a 6:
  - `NovaAlocacao = z.object({ militarId: Id, data: Data, turnoId: Id, guarnicaoId: Id.nullable(), funcaoId: Id.nullable() })`
  - `type OcupanteDaVaga = { alocacaoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; servico: { id: string; nome: string; cor: string }; letra: LetraTurno }`
  - `type FuncaoNoCard = { funcaoId: string; funcao: string; minimo: number; maximo: number; cnhExigida: CategoriaCnh | null; ocupantes: OcupanteDaVaga[] }`
  - `type CardDaGuarnicao = { guarnicaoId: string; nome: string; viatura: string | null; prioridade: number | null; funcoes: FuncaoNoCard[]; completa: boolean; faltam: string[] }` (`faltam`: frases como "Falta 1 Motorista (CNH D)")
  - `type FaixaDoDia = { inicio: string; fim: string; noturna: boolean; turnos: { turnoId: string; servicoId: string; servico: string; letra: LetraTurno }[]; guarnicoes: CardDaGuarnicao[]; semPosto: OcupanteDaVaga[]; removidos: { remocaoId: string; militarId: string; nomeGuerra: string; servico: string }[] }`
  - `type DiaDaEscala = { data: string; diaDaSemana: number; feriado: string | null; faixas: FaixaDoDia[]; obrigatoriasVazias: number }`
  - `type EscalaDoMes = { escalaId: string; nome: string; mes: string; dias: DiaDaEscala[]; resumo: { preenchidas: number; obrigatorias: number; obrigatoriasVazias: number } }`
  - `type Candidato = { militarId: string; posto: string; nomeGuerra: string; matricula: string; equipe: string | null; jornada: 'pronto' | 'adm'; servicos: { servicoId: string; turnoId: string; nome: string }[] }`
  - `type Candidatos = { aptos: Candidato[]; fora: { motivo: string; quantidade: number }[] }`

- [ ] **Step 1: Write the failing test** `migracao-0014.test.ts`: (a) depois da 0014, gravar `remocao` e depois uma `alocacao` com a mesma chave apaga a remoção; uma alocação com outra data não apaga; (b) duas remoções com a mesma chave dão 23505. Dados fictícios: serviço Pronto com turno A, escala com o serviço, militar `990990-1`.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0014.test.ts`. Expected: FAIL (tabela `remocao` não existe).
- [ ] **Step 3: Implement** a migração (tabela + gatilho `alocacao_desfaz_remocao`) e os contratos acima (só tipos e o esquema `NovaAlocacao`).
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Expected: passa (o teste de esquema que lista tabelas, se houver, ganha `remocao`).
- [ ] **Step 5: Commit** `Fase 4.1: tabela de remoções e contratos da escala do mês`.

### Task 2: Leitura da escala do mês (API)

**Files:**
- Create: `apps/api/src/escala/leitura.ts`, `apps/api/src/escala/rotas.ts`
- Modify: `apps/api/src/app.ts` (registrar `rotasEscalaDoMes`), `apps/api/src/cadastros/escalas.ts` (exportar `vinculosDaEscala`), `apps/api/src/cadastros/feriados.ts` (exportar `feriadosDoAno`)
- Test: `apps/api/test/escala-leitura.test.ts`

**Interfaces:**
- Consumes: `faixasDaEscala`, `vinculosDaEscala` (escalas.ts), `versoesDasGuarnicoes` (guarnicoes.ts), `versaoNoMes` (guarnicoes-regras.ts), `feriadosDoAno`, `diasDoMes`/`diaDaSemana` de `dominio`; contratos da Tarefa 1.
- Produces: `montarEscalaDoMes(c: Consulta, escalaId: string, mes: string): Promise<EscalaDoMes>`; rota `GET /api/escalas/:id/mes/:mes` (sessão; papel de cadastro na unidade da escala; `:mes` pelo contrato `Mes`, inválido → 400; escala inexistente → 404).
- Regras da leitura: para cada dia do mês e cada faixa da escala, os cards são as guarnições do vínculo vigente no mês (`vinculos` com a maior vigência `<= mes`) naquela faixa, cuja versão no mês está ativa, em ordem de prioridade (sem prioridade por último) e depois nome; as funções vêm da composição da versão no mês; uma alocação entra na faixa cujo horário é igual ao do turno dela; com `guarnicao_id` e `funcao_id` vai para a função do card, sem eles vai para `semPosto`. `completa` = toda função tem pelo menos o mínimo. `obrigatorias` = soma dos mínimos; `preenchidas` = ocupantes até o máximo de cada função.

- [ ] **Step 1: Write the failing tests** em `escala-leitura.test.ts` (cenário fictício: escala Ordinário com Pronto A 08h–20h e B 20h–08h; guarnições ABT (Motorista 1–1 CNH D, Combatente 2–3) e AR vinculadas às duas faixas; feriado no dia 15):
  - mês de 30 dias dá 30 dias, cada um com as faixas 08:00–20:00 (`noturna: false`) e 20:00–08:00 (`noturna: true`), e o dia 15 com `feriado` preenchido;
  - sem alocações: cada card `completa: false`, `faltam` com "Falta 1 Motorista (CNH D)" e "Faltam 2 Combatente"; `resumo.obrigatorias` = 30 × 2 faixas × (1+2) × 2 guarnições;
  - uma alocação de Pronto B no dia 3 com guarnição e função aparece só no dia 3, faixa 20:00–08:00 (Review Focus 1), e nunca no dia 4;
  - alocação sem guarnição vai para `semPosto`;
  - guarnição desativada a partir do mês seguinte aparece neste mês e some no seguinte; vínculo gravado só a partir do mês seguinte não aparece neste (Review Focus 5);
  - escala de outra seção → 403; `mes=2026-13` → 400.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/escala-leitura.test.ts`. Expected: FAIL (rota inexistente, 404).
- [ ] **Step 3: Implement** `montarEscalaDoMes` com poucas consultas (escala, faixas, vínculos, versões, alocações do mês com militar/serviço/turno, remoções do mês, feriados) e a montagem em memória; a rota em `escala/rotas.ts`, no padrão das rotas de cadastro (`exigirSessao`, `unidadeDoRegistro(banco, 'escala', id)`, `exigirPapel(c, u, CADASTRO)`).
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa, inclusive `acesso-rotas` e `isolamento-entre-unidades` (a rota nova tem `:id` de escala; registrar o recurso `escalas` já existente cobre a varredura).
- [ ] **Step 5: Commit** `Fase 4.1: leitura da escala do mês`.

### Task 3: Quem pode ocupar a vaga (API)

**Files:**
- Create: `apps/api/src/escala/elegibilidade.ts`
- Modify: `apps/api/src/escala/rotas.ts`
- Test: `apps/api/test/escala-candidatos.test.ts`

**Interfaces:**
- Consumes: `cnhHabilitadas`, `montarHorarios`, `detectarChoques`, `exigeVoluntarioJes`, `turnosPadraoExigidos` de `dominio`; contratos da Tarefa 1.
- Produces: `avaliarCandidatos(c: Consulta, v: { escalaId: string; data: string; inicio: string; fim: string; guarnicaoId: string | null; funcaoId: string | null }): Promise<Candidatos>` e `motivoDeFora(c, v & { militarId: string; turnoId: string }): Promise<string | null>` (usada também na Tarefa 4); rota `GET /api/escalas/:id/mes/:mes/candidatos?data=&inicio=&fim=&guarnicaoId=&funcaoId=`.
- Regras, na ordem (o primeiro motivo que barra é o que conta em `fora`):
  1. `"Não está lotado na seção neste dia"`: sem lotação na unidade da escala cobrindo `data`; `"Desativado"`: militar inativo (Review Focus 3).
  2. `"Afastado"`: afastamento que cobre `data`.
  3. `"Sem a CNH exigida"`: a função exige CNH e a categoria não está em `cnhHabilitadas(militar.cnh)`.
  4. Para cada turno de serviço da escala com o horário da faixa, o militar só entra se: o serviço exige voluntário JES (`exigeVoluntarioJes`) e ele é voluntário JES, senão `"Não é voluntário JES"`; o serviço é JES, PJES ou diária e ele marcou no voluntariado todo turno padrão de `turnosPadraoExigidos(inicio, fim)` (dia relativo à `data`), senão `"Não marcou voluntariado neste horário"`; não há choque (`detectarChoques` com as alocações dele de `data − 1` a `data + 1`, inclusive do mês vizinho, e o expediente implícito do Adm em dia útil), senão `"Choque de horário"` (Review Focus 1 e 2). Os serviços que sobram vão em `servicos`, na ordem da escala; sem nenhum, o militar vai para `fora` com o motivo do primeiro serviço.
  5. Já está nesta faixa, neste dia, em qualquer serviço: `"Já escalado neste horário"`.
- Ordem dos aptos: jornada Pronto da equipe do dia antes, depois os demais; dentro de cada grupo, por posto e antiguidade (`compararAntiguidade` de `dominio`).

- [ ] **Step 1: Write the failing tests** em `escala-candidatos.test.ts` (militares fictícios `990991-x`, lotados na 1ª SB): um apto com Pronto; um afastado no dia (fora "Afastado"); um com CNH B para Motorista CNH D (fora "Sem a CNH exigida"); um com CNH E para CNH D (apto, hierarquia); um com Pronto B do dia anterior (20h–08h) para uma vaga das 06h às 14h (fora "Choque de horário"); um com alocação no dia 31 do mês anterior, faixa B, para a vaga das 08h do dia 1 que começa às 06h (fora "Choque de horário", Review Focus 2); um lotado na seção só a partir do dia 16 (fora no dia 10, apto no dia 20, Review Focus 3); para a vaga 20:00–08:00 do dia 9, um afastado a partir do dia 10 (apto) e um afastado até o dia 9 (fora "Afastado") (Review Focus 1); vaga de JES: voluntário JES com voluntariado marcado A do dia (apto), voluntário sem voluntariado (fora "Não marcou voluntariado neste horário"), não voluntário (fora "Não é voluntário JES"); `fora` agrupado com as quantidades.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/escala-candidatos.test.ts`. Expected: FAIL (rota inexistente).
- [ ] **Step 3: Implement** a tradução banco → motor (matrícula como `mat`, nome do serviço normalizado uma vez, letra do turno, horários de todos os turnos da unidade em `montarHorarios`) e as regras acima.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.1: quem pode ocupar a vaga`.

### Task 4: Escalar, remover e desfazer (API)

**Files:**
- Modify: `apps/api/src/escala/rotas.ts`, `apps/api/src/cadastros/servicos.ts` (PATCH `/turnos/:id`)
- Test: `apps/api/test/escala-alocacao.test.ts`, `apps/api/test/servicos.test.ts`

**Interfaces:**
- Consumes: `NovaAlocacao`, `motivoDeFora` (Tarefa 3), `montarEscalaDoMes` (Tarefa 2).
- Produces:
  - `POST /api/escalas/:id/alocacoes` com `NovaAlocacao` → 201 com o `EscalaDoMes` do mês da `data` (a tela troca o cache inteiro). Recusas com 409 e o motivo: turno que não é de serviço da escala; guarnição que não está vinculada nessa faixa no mês; função que não está na composição; função já no máximo (`"A função Combatente já está completa nesta guarnição."`); `motivoDeFora` não nulo (a frase dele); mesma chave já escalada (23505 → `"Este militar já está escalado neste turno."`, Review Focus 4). Grava `origem = 'manual'`.
  - `DELETE /api/alocacoes/:id` → 200 com o `EscalaDoMes` do mês: apaga a alocação e grava a `remocao` (com `removida_por`) na mesma transação.
  - `DELETE /api/remocoes/:id` → 200 com o `EscalaDoMes`: desfaz a remoção.
  - PATCH `/turnos/:id` que muda letra, início ou fim de um turno com alocações → 409 `"O turno A de Pronto tem 12 militares escalados. Remova-os antes de mudar o horário ou a letra."`.
- Acesso: papel de cadastro na unidade da escala (alocação e remoção pela escala delas; ids de outra unidade → 403).

- [ ] **Step 1: Write the failing tests** em `escala-alocacao.test.ts`: escalar um apto grava e devolve a faixa com o ocupante; o mesmo pedido duas vezes → o segundo 409 com "já está escalado neste turno" (e nenhum 500); três pedidos para uma função de máximo 2 → o terceiro 409 "já está completa"; candidato afastado → 409 "Afastado"; remover → alocação some, `removidos` traz o militar; escalar de novo a mesma combinação → `removidos` vazio; `DELETE /api/remocoes/:id` → `removidos` vazio; escalante de outra seção → 403 nas três rotas. Em `servicos.test.ts`: mudar o horário de um turno com alocação → 409 com a frase; sem alocação → 200.
- [ ] **Step 2: Run** os dois arquivos. Expected: FAIL.
- [ ] **Step 3: Implement** as rotas, com a conferência e a gravação na mesma transação (`comUsuario`), e o 409 do turno.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.1: escalar, remover e desfazer remoção`.

### Task 5: Tela da Escala do mês (leitura)

**Files:**
- Create: `apps/web/src/api/escala-do-mes.ts`, `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/componentes/escala-do-mes/DiaDaEscala.tsx`, `apps/web/src/componentes/escala-do-mes/CardDaGuarnicao.tsx`
- Modify: `apps/web/src/componentes/Trilho.tsx` (`para: '/escala-do-mes'`)
- Test: `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Consumes: `EscalaDoMes` (Tarefa 1), rota da Tarefa 2.
- Produces: `consultaEscalaDoMes(escalaId: string, mes: string)` (queryKey `['escala-do-mes', escalaId, mes]`), `atualizarEscalaDoMes(queryClient, escalaId, mes, dados: EscalaDoMes)`; rota `/escala-do-mes` com busca `?escala=<id>&mes=<aaaa-mm>` (sem escala: a primeira escala ativa da lista; sem mês: o mês atual).
- Tela (spec "Escala do mês"): no topo, seleção de escala (lista das ativas) e de mês, o resumo "N de M vagas obrigatórias preenchidas, K vazias" com o número de vazias em âmbar quando > 0, e o botão "Mostrar só vagas vazias" (alternância; esconde dias e cards completos); por dia, o número grande parado à esquerda durante a rolagem (`sticky`), o dia da semana e o nome do feriado (número em vermelho no feriado); por faixa, uma barra vertical clara (dia) ou escura (`#24324F`, noite) com o horário e as letras; cards em grade responsiva (1 por linha no celular, 3 a 4 em tela larga); no cabeçalho do card, nome, viatura e o ícone: ✓ verde (`aria-label="Completa"`) ou triângulo vermelho (`aria-label` com as frases de `faltam`, também no `title`); por função, as linhas ocupadas (função com a CNH, posto e nome, matrícula, etiqueta do serviço na cor do serviço) e as vagas vazias: até o mínimo, botão "Escolher militar" com listras amarelas (`#F2C200`); acima do mínimo até o máximo, "Escolher militar" tracejado e discreto (mesmo nome acessível, sem rótulo "opcional"); `semPosto` numa linha "Sem guarnição"; `removidos` numa linha discreta "Removidos: NOME (Desfazer)".
- Botão "Gerar documento" fica para a entrega 5 (não aparece agora).

- [ ] **Step 1: Write the failing tests** em `escala-do-mes.test.tsx` com um `EscalaDoMes` fictício de 3 dias: o trilho leva a "Escala do mês"; mostra o resumo "3 de 6 vagas obrigatórias preenchidas, 3 vazias"; o dia com feriado mostra o nome do feriado; a faixa 20:00–08:00 tem `data-noturna`; card incompleto tem `role="img"` com nome "Falta 1 Motorista (CNH D)"; vaga obrigatória vazia é um botão "Escolher militar" com `data-obrigatoria`, a opcional sem; "Mostrar só vagas vazias" esconde o dia sem vagas vazias; trocar o mês muda a busca (`?mes=`) e consulta a rota do mês novo.
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/escala-do-mes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** a rota, a consulta e os dois componentes.
- [ ] **Step 4: Run** `pnpm --filter web test && pnpm typecheck`. Expected: passa (o teste do trilho que conferia "Escala do mês" desabilitado passa a conferir o link).
- [ ] **Step 5: Commit** `Fase 4.1: tela da escala do mês`.

### Task 6: Escolher militar e remover (tela)

**Files:**
- Create: `apps/web/src/componentes/escala-do-mes/EscolherMilitar.tsx`
- Modify: `apps/web/src/componentes/escala-do-mes/CardDaGuarnicao.tsx`, `apps/web/src/api/escala-do-mes.ts`
- Test: `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Consumes: `Candidatos`, `NovaAlocacao`, rotas das Tarefas 3 e 4; `useTrava`.
- Produces: `consultaCandidatos(escalaId, mes, vaga)`, `escalar(escalaId, NovaAlocacao): Promise<EscalaDoMes>`, `remover(alocacaoId): Promise<EscalaDoMes>`, `desfazerRemocao(remocaoId): Promise<EscalaDoMes>`; cada uma grava o `EscalaDoMes` devolvido no cache (`atualizarEscalaDoMes`).
- Diálogo "Escolher militar" (título com dia, faixa, guarnição e função): busca por nome ou matrícula; a lista de aptos (posto e nome, matrícula, equipe ou Adm) com o serviço proposto (o primeiro de `servicos`; um seletor quando houver mais de um); clicar escala (com `useTrava`) e fecha; erro 409 aparece no diálogo com a frase da API; no rodapé, "Ficaram de fora: 3 afastados, 2 sem a CNH exigida, 1 com choque de horário" a partir de `fora`; lista vazia diz "Ninguém pode ocupar esta vaga agora." e mostra o rodapé.
- Linha ocupada ganha "Remover" (pergunta "Remover NOME de <guarnição>, <dia>? Ele não volta para este turno quando a pré-escala for gerada de novo."); "Desfazer" em `removidos` chama `desfazerRemocao`.

- [ ] **Step 1: Write the failing tests**: abrir "Escolher militar" consulta `candidatos` com `data`, `inicio`, `fim`, `guarnicaoId` e `funcaoId` da vaga; mostra os aptos e o rodapé com as quantidades; escolher um manda `POST /api/escalas/e1/alocacoes` com o `NovaAlocacao` certo e a linha passa a mostrar o militar (do `EscalaDoMes` devolvido); dois cliques mandam um pedido só; 409 mostra a frase no diálogo; "Remover" pergunta e manda `DELETE /api/alocacoes/a1`; cancelar a pergunta não manda nada; "Desfazer" manda `DELETE /api/remocoes/r1`.
- [ ] **Step 2: Run** o arquivo de teste. Expected: FAIL.
- [ ] **Step 3: Implement** o diálogo e as ações.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.1: escolher militar e remover`. Revisão final do branch (Opus), correções, push e PR "Fase 4.1: escala do mês, à mão" com: o que entrou, **tem migração (0014)** e o lembrete `pnpm --filter api db:migrar:teste`, o que conferir no ambiente de teste (abrir a escala Ordinário do mês, escolher militar numa vaga com CNH, conferir que o afastado não aparece, remover e desfazer, turno B do último dia) e as decisões desta entrega para o usuário confirmar. **Parar até o merge.**

---

# Entrega 1.1 — Acúmulo de funções

**Branch:** `fase4-1-1-acumulo`, a partir da `main` depois do merge do PR #28. **Tem migração** (0015). Commits `Fase 4.1.1: …`; PR "Fase 4 — Entrega 1.1: acúmulo de funções".

**Spec desta entrega e da 2.1:** `docs/superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md` (Parte 2 aqui, Parte 1 na 2.1). Contagens de partida: protótipo 589, contratos 14, motor 771 (+1 ignorado), API 515, site 293.

**Review Focus das entregas 1.1 e 2.1** (cada uma tem teste na tarefa dona):

1. **Função no máximo por causa de um acúmulo**: escalar ou acumular numa função cujo máximo já está ocupado (contando acúmulos) → 409 "já está completa", nunca passa do máximo. Tarefa 8.
2. **Remover o militar com acúmulos**: a alocação some com os acúmulos dela, a marca de remoção é só da vaga original; tirar só um acúmulo não cria marca e o militar continua na vaga original. Tarefa 8.
3. **Militar escalado na mesma faixa de outra escala** (ou em "Sem guarnição", ou na mesma função da mesma guarnição) não aparece em "Acumular". Tarefa 8.
4. **Guarnição ou composição muda depois de a ordem ser salva**: vaga que deixou de existir sai da lista e as posições se compactam (1, 2, 3… sem buraco); vaga nova fica sem número e vai para "Falta". Tarefa 10.
5. **Ordem entre meses**: ordem salva a partir de dezembro vale em janeiro (`vigencia: '2026-12'`); num mês anterior a qualquer ordem vale a ordem padrão (`vigencia: null`). Tarefa 11.

### Task 7: Acúmulo no banco e nos contratos

**Files:**
- Create: `apps/api/banco/migracoes/0015_acumulo.sql`
- Modify: `pacotes/contratos/src/escala-do-mes.ts`, `apps/api/src/acesso.ts` (`TabelaComUnidade` + `acumulo`)
- Test: `apps/api/test/migracao-0015.test.ts`

**Interfaces:**
- Produces:
  - Tabela `alocacao_acumulo (id uuid pk default gen_random_uuid(), alocacao_id uuid not null references alocacao (id) on delete cascade, guarnicao_id uuid not null references guarnicao (id), funcao_id uuid not null references funcao (id), unique (alocacao_id, guarnicao_id, funcao_id))`, índice em `alocacao_id`, gatilho `auditoria_registro` como na 0014.
  - `NovoAcumulo = z.object({ guarnicaoId: Id, funcaoId: Id })` (a alocação vem na rota).
  - `OcupanteDaVaga` ganha `acumuloId: string | null` (null = vaga original da alocação) e `acumulaCom: string[]` (as outras vagas do mesmo militar na faixa; nome da vaga = função + espaço + guarnição, como `"Chefe ABT"`, ou só o nome da guarnição quando a composição dela tem uma função só, como `"Graduado de dia"`).
  - `Candidatos` ganha `acumular: { alocacaoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; vaga: string }[]` (`vaga` = a vaga original, no mesmo formato `"Chefe ABT"`).
  - `unidadeDoRegistro(c, 'acumulo', id)`: `select e.unidade_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join escala e on e.id = a.escala_id where x.id = $1`.

- [ ] **Step 1: Write the failing test** `migracao-0015.test.ts`: depois de migrar, inserir um acúmulo para uma alocação; inserir o mesmo (alocação, guarnição, função) de novo → erro 23505; apagar a alocação apaga o acúmulo; a gravação aparece em `auditoria`.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0015.test.ts`. Expected: FAIL (tabela não existe).
- [ ] **Step 3: Implement** a migração, os contratos e a linha do `acesso.ts`. Nos lugares que montam `OcupanteDaVaga` hoje (`leitura.ts`), preencher `acumuloId: null, acumulaCom: []` por enquanto; `avaliarCandidatos` devolve `acumular: []`.
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm typecheck`. Expected: passa (ajustar os testes de leitura e do site que comparam objetos inteiros para os campos novos).
- [ ] **Step 5: Commit** `Fase 4.1.1: acúmulo no banco e nos contratos`.

### Task 8: Ler, sugerir, acumular e tirar (API)

**Files:**
- Modify: `apps/api/src/escala/leitura.ts`, `apps/api/src/escala/elegibilidade.ts`, `apps/api/src/escala/alocacoes.ts`, `apps/api/src/escala/rotas.ts`
- Test: `apps/api/test/escala-acumulo.test.ts`, `apps/api/test/isolamento-entre-unidades.test.ts` (fixture do acúmulo)

**Interfaces:**
- Consumes: Tarefa 7.
- Produces:
  - **Leitura**: cada acúmulo do mês vira um ocupante (com `acumuloId`, o mesmo `alocacaoId` e o serviço e letra da alocação) na função do card da guarnição dele, na faixa do turno da alocação; conta em `preenchidas` e tira a vaga das vazias. `acumulaCom` de cada ocupante = as outras vagas do militar na faixa (original e acúmulos), na ordem dos cards. Acúmulo cuja vaga não está em nenhum card da faixa não aparece (o militar continua na vaga original).
  - **Candidatos** (`avaliarCandidatos` com `guarnicaoId` e `funcaoId` preenchidos; sem eles, `acumular: []`): militares com alocação **desta escala** neste dia e nesta faixa **com guarnição e função**, que ainda não ocupam (na original nem em acúmulo) esta mesma função nesta mesma guarnição. Quem cumpre a CNH exigida da vaga (`cnhHabilitadas`) entra em `acumular`, na ordem de antiguidade; quem não cumpre conta em `fora` como `"Sem a CNH exigida"` em vez de `"Já escalado neste horário"`. Os demais escalados na faixa seguem como hoje.
  - `POST /api/alocacoes/:id/acumulos` com `NovoAcumulo` → 201 com o `EscalaDoMes` do mês. Na mesma transação e com a mesma trava (`pg_advisory_xact_lock` da faixa) de `escalar`. Recusas 409: alocação sem guarnição → `"Escolha uma vaga de guarnição para este militar antes de acumular."`; guarnição fora da faixa no mês e função fora da composição (as frases de `escalar`); mesma função na mesma guarnição → `"Este militar já ocupa uma vaga de <função> nesta guarnição."`; CNH → `"Sem a CNH exigida"`; função no máximo → a frase de `escalar`.
  - `escalar` passa a contar acúmulos no máximo da função (Review Focus 1).
  - `DELETE /api/acumulos/:id` → 200 com o `EscalaDoMes`; não grava `remocao`.
  - `DELETE /api/alocacoes/:id` continua igual (a cascata leva os acúmulos; a `remocao` é só da vaga original).
  - Acesso: papel de cadastro na unidade da escala (via `unidadeDoRegistro` de `alocacao` e `acumulo`).

- [ ] **Step 1: Write the failing tests** em `escala-acumulo.test.ts` (faixa 08–20 com ABT e AR; Chefe ABT, Motorista AR com CNH D, Graduado de dia):
  - acumular o Chefe ABT como Graduado de dia → 201; o card do Graduado mostra o mesmo militar com `acumuloId` e `acumulaCom: ['Chefe ABT']`, e o do Chefe ABT mostra `acumulaCom: ['Graduado de dia']` (guarnição de uma função só); `resumo.preenchidas` sobe 1;
  - candidatos do Motorista AR: militar escalado com CNH E aparece em `acumular`; com CNH B não aparece e `fora` traz `"Sem a CNH exigida"`; o mesmo militar em "Sem guarnição" e um escalado na mesma faixa de outra escala não aparecem em `acumular` (Review Focus 3);
  - acumular a mesma função da mesma guarnição → 409 `"Este militar já ocupa uma vaga de Combatente nesta guarnição."`; alocação sem posto → 409 com a frase;
  - função de máximo 1 já ocupada por um acúmulo: `POST /api/escalas/:id/alocacoes` nela → 409 "já está completa" (Review Focus 1);
  - `DELETE /api/acumulos/:id` → o militar some só da vaga acumulada e `removidos` fica vazio; `DELETE /api/alocacoes/:id` da original → somem as duas vagas e `removidos` traz o militar uma vez (Review Focus 2);
  - escalante de outra seção → 403 nas duas rotas novas (também em `isolamento-entre-unidades.test.ts`).
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/escala-acumulo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** leitura, candidatos, as duas rotas e a contagem do máximo.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.1.1: acumular e tirar acúmulo`.

### Task 9: Acumular na tela

**Files:**
- Modify: `apps/web/src/api/escala-do-mes.ts`, `apps/web/src/componentes/escala-do-mes/EscolherMilitar.tsx`, `apps/web/src/componentes/escala-do-mes/CardDaGuarnicao.tsx`
- Test: `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Consumes: Tarefas 7 e 8; `useTrava`.
- Produces: `acumular(queryClient, alocacaoId: string, d: NovoAcumulo): Promise<EscalaDoMes>` e `tirarAcumulo(queryClient, acumuloId: string): Promise<EscalaDoMes>`, no padrão de `escalar` (gravam o `EscalaDoMes` devolvido e invalidam no erro).
- Diálogo "Escolher militar": abaixo dos aptos, a seção **"Acumular com quem já está na faixa"** (só quando `acumular` não está vazio), cada linha com posto e nome, matrícula e "hoje em Chefe ABT"; clicar acumula (com `useTrava`) e fecha; 409 aparece no diálogo. Lista de aptos vazia mas `acumular` com gente: a frase "Ninguém pode ocupar esta vaga agora." não aparece.
- Card: ocupante com `acumulaCom` não vazio ganha, discreto, "acumula com Chefe ABT" (várias: "acumula com Chefe ABT e Graduado de dia"). Na linha de um acúmulo, "Remover" pergunta "Tirar NOME de <vaga>? Ele continua em <primeira de acumulaCom>." e chama `tirarAcumulo`. Na linha original com acúmulos, a pergunta de remover acrescenta "Sai também de: <acumulaCom>.".

- [ ] **Step 1: Write the failing tests**: o diálogo mostra a seção "Acumular com quem já está na faixa" com "hoje em Chefe ABT"; clicar manda `POST /api/alocacoes/a1/acumulos` com `{ guarnicaoId, funcaoId }` da vaga e a vaga passa a mostrar o militar; dois cliques mandam um pedido só; o card mostra "acumula com Chefe ABT"; "Remover" no acúmulo pergunta "Tirar …" e manda `DELETE /api/acumulos/x1`; "Remover" na original com acúmulo mostra "Sai também de: Graduado de dia".
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/escala-do-mes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** as funções da API do site, a seção do diálogo e a marca no card.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.1.1: acumular na tela`. Revisão final do branch (Opus), correções, push e PR com: o que entrou, **tem migração (0015)** e o lembrete `pnpm --filter api db:migrar:teste`, o que conferir no ambiente de teste (acumular o chefe da ABT como graduado de dia; conferir que quem não tem a CNH não aparece para motorista; remover o original e ver os dois sumirem) e as decisões para o usuário. **Parar até o merge.**

---

# Entrega 2.1 — Ordem de escala

**Branch:** `fase4-2-1-ordem-de-escala`, a partir da `main` depois do merge da entrega 2. **Tem migração** (0016; se a entrega 2 criar migração, esta vira a seguinte). Commits `Fase 4.2.1: …`; PR "Fase 4 — Entrega 2.1: ordem de escala".

### Task 10: Ordem de escala no banco, nos contratos e a regra das vagas

**Files:**
- Create: `apps/api/banco/migracoes/0016_ordem_de_escala.sql`, `pacotes/contratos/src/ordem-de-escala.ts` (exportado no `index.ts`), `apps/api/src/escala/ordem.ts`
- Test: `apps/api/test/migracao-0016.test.ts`, `apps/api/test/ordem-de-escala-regras.test.ts`

**Interfaces:**
- Produces:
  - Tabelas `ordem_escala_versao (id uuid pk, escala_id uuid not null references escala (id), vigencia_desde date not null check (extract(day from vigencia_desde) = 1), unique (escala_id, vigencia_desde))` e `ordem_escala_item (versao_id uuid not null references ordem_escala_versao (id) on delete cascade, posicao int not null check (posicao >= 1), guarnicao_id uuid not null references guarnicao (id), funcao_id uuid not null references funcao (id), vaga int not null check (vaga >= 1), primary key (versao_id, posicao), unique (versao_id, guarnicao_id, funcao_id, vaga))`; gatilhos de auditoria.
  - Contratos: `VagaDaOrdem = z.object({ guarnicaoId: Id, funcaoId: Id, vaga: z.number().int().min(1) })`; `OrdemDeEscalaEntrada = z.object({ itens: z.array(VagaDaOrdem) })` com refine "Esta vaga aparece duas vezes na ordem." (posição = índice + 1; lista vazia é aceita); tipo `VagaNaTela = { guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string; vaga: number; obrigatoria: boolean; posicao: number | null }`; tipo `OrdemDeEscala = { escalaId: string; mes: string; vigencia: string | null; vagas: VagaNaTela[] }` (`vigencia` = mês da versão em vigor; `null` = ordem padrão; `vagas` na ordem de exibição: guarnições pela ordem dos cards, funções pela composição, vaga 1, 2…).
  - Em `ordem.ts`, funções puras:
    - `vagasDoMes(modelos: { guarnicaoId: string; guarnicao: string; prioridade: number | null; composicao: { funcaoId: string; funcao: string; minimo: number; maximo: number }[] }[]): Omit<VagaNaTela, 'posicao'>[]` — cada guarnição uma vez (as de todas as faixas juntas), cada função vira `maximo` vagas, `obrigatoria = vaga <= minimo`; ordem de exibição: prioridade (nula por último), depois nome, depois composição.
    - `aplicarOrdem(vagas, itens: VagaDaOrdem[] | null): VagaNaTela[]` — `null` = ordem padrão (posição 1…n na ordem de exibição); com itens, cada vaga existente recebe a posição relativa dos itens, compactada (1, 2, 3… sem buraco, itens de vagas que não existem mais são ignorados); vaga sem item fica `posicao: null`.
    - `sequenciaDePreenchimento(vagas: VagaNaTela[]): VagaNaTela[]` — as numeradas por posição, depois as sem número na ordem de exibição (é o que a pré-escala da entrega 3 percorre).

- [ ] **Step 1: Write the failing tests**: `migracao-0016` (versão única por escala e mês; item repetido → 23505; apagar a versão apaga os itens). `ordem-de-escala-regras`: função de mínimo 2 e máximo 4 → 4 vagas, 2 obrigatórias; guarnição em duas faixas aparece uma vez; sem itens → posições 1…n pela prioridade e nome; itens `[AR Chefe 1, ABT Chefe 1]` → AR Chefe 1 tem posição 1; item de vaga que sumiu (máximo diminuiu) → ignorado e as posições ficam 1, 2, 3 (Review Focus 4); vaga nova sem item → `posicao: null` e entra no fim de `sequenciaDePreenchimento`.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0016.test.ts test/ordem-de-escala-regras.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a migração, os contratos e as três funções.
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.1: ordem de escala no banco e regra das vagas`.

### Task 11: Ler e gravar a ordem (API) e cards na ordem

**Files:**
- Modify: `apps/api/src/escala/rotas.ts` (ou `apps/api/src/cadastros/escalas.ts`, junto dos vínculos), `apps/api/src/escala/leitura.ts`
- Test: `apps/api/test/ordem-de-escala.test.ts`, `apps/api/test/escala-leitura.test.ts`, `apps/api/test/isolamento-entre-unidades.test.ts`

**Interfaces:**
- Consumes: Tarefa 10; `vinculosDaEscala`, `versoesDasGuarnicoes`, `versaoNoMes`, `mesPassado`.
- Produces:
  - `ordemDoMes(c: Consulta, escalaId: string, mes: string): Promise<OrdemDeEscala>` — vínculo vigente no mês e versões das guarnições no mês (ativas), versão da ordem com maior vigência `<= mes`.
  - `GET /api/escalas/:id/ordem/:mes` → 200 `OrdemDeEscala`.
  - `PUT /api/escalas/:id/ordem/:mes` com `OrdemDeEscalaEntrada` → 200 `OrdemDeEscala` do mês; substitui a versão do mesmo mês ou cria uma; mês passado → a recusa de `mesPassado`; item de vaga que não existe no mês → 400 `{ erro: 'Confira os campos destacados.', campos: { 'itens.N': 'Esta vaga não existe nesta escala em <mês por extenso>.' } }`; repetida → 400 do refine. Papel de cadastro na unidade da escala.
  - `montarEscalaDoMes`: os cards de cada faixa passam a seguir a menor posição das vagas da guarnição em `sequenciaDePreenchimento(ordemDoMes(...).vagas)`; sem ordem cadastrada, o resultado é o de hoje (prioridade, depois nome).
- [ ] **Step 1: Write the failing tests** em `ordem-de-escala.test.ts`: GET sem ordem → `vigencia: null` e posições pela prioridade; PUT a partir de `2026-12` → GET de `2027-01` traz `vigencia: '2026-12'` e as posições gravadas, GET de `2026-11` traz `vigencia: null` (Review Focus 5); PUT com vaga 3 de uma função de máximo 2 → 400 com `itens.0`; PUT de mês passado → 400; outra seção → 403. Em `escala-leitura.test.ts`: com a ordem `[AR Chefe 1, ABT Chefe 1]`, o card AR vem antes do ABT; sem ordem, a ordem de hoje se mantém.
- [ ] **Step 2: Run** os arquivos. Expected: FAIL.
- [ ] **Step 3: Implement** `ordemDoMes`, as duas rotas e a ordem dos cards.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.1: ler e gravar a ordem de escala`.

### Task 12: Tela da ordem de escala

**Files:**
- Create: `apps/web/src/api/ordem-de-escala.ts`, `apps/web/src/routes/_app/escalas/$id.ordem.tsx` (busca `?mes=`), `apps/web/src/componentes/escalas/OrdemDeEscala.tsx`
- Modify: `apps/web/src/routes/_app/escalas/$id.tsx` (link "Ordem de escala" na ficha), `apps/web/src/componentes/guarnicoes/Versoes.tsx` e a lista de guarnições (sai o campo e o número de prioridade)
- Test: `apps/web/src/__testes__/ordem-de-escala.test.tsx`, ajustes nos testes de guarnições

**Interfaces:**
- Consumes: Tarefas 10 e 11; `useTrava`, `usePendencia`, `useSincronizar`, `AcoesDoBloco`.
- Produces: `consultaOrdemDeEscala(escalaId, mes)` (queryKey `['ordem-de-escala', escalaId, mes]`), `gravarOrdemDeEscala(queryClient, escalaId, mes, itens: VagaDaOrdem[])` (grava o devolvido no cache e invalida `['escala-do-mes', escalaId]`).
- Tela (spec Parte 1): título "Ordem de escala — <escala>", "Vale a partir de" (mês, padrão o mês atual), "Limpar" e "Salvar"; cada guarnição numa linha com um quadrado por vaga (`button`, nome acessível "Chefe ABT, vaga 1" e, numerada, "…, posição 4"), obrigatórias cheias e extras tracejadas; clicar num sem número dá o próximo número; clicar num numerado tira e os seguintes sobem um; ao lado, a lista numerada com "Subir" e "Descer"; rodapé "9 de 10 vagas na ordem. Falta: Combatente 3 da ABT." (sem falta: "Todas as vagas estão na ordem."); com `vigencia: null`, a frase "Ainda sem ordem cadastrada: a sugestão abaixo segue a prioridade antiga das guarnições."; teclado: setas movem o foco entre quadrados, espaço numera ou tira; alteração pendente avisa ao sair (`usePendencia`).
- Guarnições: o campo "Prioridade" sai do formulário da versão e o número sai da lista (a API continua aceitando o campo para a importação, que alimenta a ordem padrão).
- [ ] **Step 1: Write the failing tests**: a ficha da escala tem o link "Ordem de escala"; a tela mostra os quadrados com as posições do GET; clicar num sem número dá o próximo número e o rodapé muda; clicar num numerado tira e o seguinte sobe; "Descer" troca dois vizinhos; "Salvar" manda `PUT /api/escalas/e1/ordem/2026-12` com `itens` na ordem e dois cliques mandam um pedido só; 400 mostra a frase; `vigencia: null` mostra a frase da sugestão; espaço num quadrado focado numera; o formulário da guarnição não tem mais "Prioridade".
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/ordem-de-escala.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** a rota, a consulta, o componente e a saída da prioridade.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.1: tela da ordem de escala`. Revisão final do branch (Opus), correções, push e PR com: o que entrou, **tem migração** e o lembrete `pnpm --filter api db:migrar:teste`, o que conferir (montar a ordem do Ordinário a partir do mês que vem, conferir os cards na nova ordem, mudar uma composição e ver a vaga nova em "Falta") e as decisões para o usuário. **Parar até o merge.** Lembrar no PR: atualizar o catálogo RN-XX (regra nova da ordem de escala; RN-08 substituída).

---

# Entregas 2 a 6 (a detalhar antes de cada uma)

Cada uma ganha aqui as suas tarefas, no formato da entrega 1, depois do merge da anterior e da conversa com o usuário sobre o que a entrega 1 mostrou em uso.

- **Entrega 2 — Voluntariado lançado à mão:** API de voluntariado do mês (listar por militar, gravar o mês de um militar de uma vez, copiar do mês anterior); tela com "já lançados" e "faltam lançar", calendário com A e B por dia (clicar no turno, no número do dia, arrastar), legenda dos horários, atalhos (fins de semana, folgas da equipe, copiar do mês anterior) e "Salvar e ir para o próximo" pelo teclado. As "pedidas" da grade geral saem daqui.
- **Entrega 3 — Pré-escala e distribuições:** camada que traduz o mês para o motor (militares, alocações de três meses, remoções, horários, voluntariado, cotas, modelos de guarnição pelas faixas) e de volta para ids; "Gerar pré-escala" (equipe do dia 1 detectada por `detectarEquipeInicial`, com escolha manual), saldos do Adm (`distribuirAdm`, com `servico` e `turno` sempre preenchidos), operações pelas cotas (`distribuirCotas` e `diagnosticarOperacoes`) e encaixe nas guarnições (`calcularGuarnicao`); prévia do que entra e do que ficou de fora antes de gravar; nada sobrescreve o que já está escalado. Pendências do motor (`turnosPadraoExigidos` no turno noturno de 24h, nomes normalizados uma vez na entrada) resolvidas aqui, com teste no motor.
- **Entrega 4 — Grade geral:** consulta do mês por militar (agrupada por equipe, Adm à parte), blocos por serviço com a letra em ordem de início, turno que atravessa a meia-noite só no dia em que começa, choques do motor com contorno vermelho, feriados e fins de semana, pegas de pedidas por PJES e Diária; ficha lateral com Trocar, Remover e "Adicionar serviço neste dia", reaproveitando as rotas da entrega 1.
- **Entrega 5 — Gerar documento:** Configurações › Modelos de impressão (enviar com conferência dos marcadores, baixar o atual, versões); geração da escala publicada com ExcelJS a partir do modelo vigente da unidade, respeitando `militares_doc` e `dias_doc` da escala; `documento_gerado` guardado e baixável; PDF fica para quando o serviço existir.
- **Entrega 6 — Minha escala:** rota e tela do militar comum (os próprios serviços do mês, com serviço, turno, horário e quem compõe a guarnição com ele) e acesso às escalas publicadas (documentos gerados) da unidade em que ele está lotado; o trilho do militar comum mostra só isso.
