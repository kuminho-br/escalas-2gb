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
| **2.2 — Voluntariado por faixa** | A disponibilidade passa a ser marcada em blocos do dia tirados dos horários dos serviços que pedem voluntariado (hoje 00–08, 08–16, 16–20, 20–24), guardada em horários; calendário no computador, um dia por linha no celular. | 2 |
| **2.3 — Ajustes do voluntariado** | Flexibilidade do voluntariado em horas (gestor, qualquer nível); o gestor escolhe as escalas que montam os blocos do dia; "Mostrar" quem ficou de fora só por voluntariado; modo foco no celular. | 2.2 |
| **2.4 — Acabamento do voluntariado e da escala do mês** | Bloco vazio sempre branco; guia "Como marcar"; número do dia com cara de botão; guarnições do mesmo turno se ajustando à largura do painel na Escala do mês, em todas as escalas. | 2.3 |
| **2.1 — Ordem de escala** | Tela da escala com as vagas de cada guarnição em quadrados para numerar a vez de cada uma (vigência por mês); os cards da escala do mês seguem a ordem. Substitui a prioridade da guarnição (RN-08). | 1 |
| **3 — Pré-escala e distribuições (3.1 e 3.2)** | "Gerar pré-escala" (Pronto pelo ciclo das equipes), saldos do Adm e operações pelas cotas, com o que ficou de fora e por quê. Gerar de novo só completa lacunas e respeita as remoções. Os militares entram nas vagas seguindo a ordem de escala à risca (o mais antigo apto em cada vaga). | 1, 2, 2.1, 2.2, 2.3 e 2.4 |
| **4 — Grade geral** | Uma linha por militar, uma coluna por dia, blocos na cor do serviço com a letra, choques em vermelho, pegas de pedidas por PJES e Diária, ficha lateral com Trocar, Remover e Adicionar. | 1, 2 |
| **5 — Gerar documento** | Configurações › Modelos de impressão (enviar e baixar o .xlsx com marcadores) e "Gerar documento" da escala publicada em .xlsx; cada geração fica guardada. | 1 |
| ~~**6 — Minha escala**~~ | **Saiu da fase 4** (decisão do usuário, 19/11/2026). Vai junto com a Visualização de escalas e a tela inicial com os módulos, quando os tipos de usuário forem diferenciados (roadmap, "Etapas sem fase marcada"). | — |

**Marco da fase:** um mês real da 1ª SB montado no sistema, em paralelo com as planilhas, e comparado no fim (o usuário conduz).

**Fora da fase 4 (já no roadmap):** Minha escala, a tela inicial com os módulos e a Visualização de escalas (etapa "Tipos de usuário e módulos", decisão de 19/11/2026); Efetivo do dia, permutas e escala executada (fase 5); importação do Google Forms e regras novas (fase 6); militares externos por vínculo, outros níveis e o próprio militar marcar voluntariado (fase 7). PDF: se o serviço de PDF não estiver pronto, a fase 4 entrega o .xlsx e o PDF sai pelo "Salvar como PDF" de quem abrir (D5).

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
4. **Guarnição ou composição muda depois de a ordem ser salva**: vaga que deixou de existir sai da lista e as posições se compactam (1, 2, 3… sem buraco); vaga nova fica sem número e vai para "Falta". Tarefa 19.
5. **Ordem entre meses**: ordem salva a partir de dezembro vale em janeiro (`vigencia: '2026-12'`); num mês anterior a qualquer ordem vale a ordem padrão (`vigencia: null`). Tarefa 20.

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

# Entrega 2 — Voluntariado lançado à mão

**Branch:** `fase4-2-voluntariado`, a partir da `main` depois do merge do PR #29. **Tem migração** (0016). Commits `Fase 4.2: …`; PR "Fase 4 — Entrega 2: voluntariado lançado à mão".

**Spec:** `docs/superpowers/specs/2026-11-16-telas.md`, seção "Voluntariado" (aba "Lançar à mão"; a aba "Importar do Google Forms" é da fase 6), e o print aprovado pelo usuário (calendário do mês por militar). Contagens de partida: protótipo 589, contratos 14, motor 771 (+1 ignorado), API 526, site 302.

**O que a pessoa ganha:** o escalante lança, militar por militar, os dias e turnos padrão (A 08h às 20h, B 20h às 08h) em que cada um aceita serviço extra no mês; a lista "Escolher militar" passa a usar esses lançamentos (a regra já existe: `voluntariado` + `turnosPadraoExigidos`).

**Review Focus da entrega 2** (cada um tem teste na tarefa dona):

1. **Salvar sem nenhuma marcação**: o militar passa a "já lançados" com 0 dias (não volta para "faltam lançar") e deixa de contar como voluntário em qualquer turno do mês. Tarefa 11.
2. **Lançar de novo substitui, não soma**: o segundo lançamento troca todas as marcações do mês daquele militar (inclusive as que vieram de importação); as de outros meses ficam intactas. Tarefa 11.
3. **"Copiar do mês anterior" entre meses de tamanhos diferentes**: o dia 31 de outubro não vira 31 de novembro; dias que não existem no mês são descartados. Tarefa 13.
4. **Militar transferido no meio do mês**: aparece na lista do mês em que tem lotação na seção (em qualquer dia); quem só chega no mês seguinte não aparece, e lançar para ele dá 409. Tarefas 10 e 11.
5. **Trocar de militar com marcações não salvas**: a tela pergunta antes de descartar (como nos cadastros). Tarefa 12.

### Task 10: Lançamento no banco, contratos e leitura do mês (API)

**Files:**
- Create: `apps/api/banco/migracoes/0016_voluntariado_lancamento.sql`, `pacotes/contratos/src/voluntariado.ts` (exportado no `index.ts`), `apps/api/src/voluntariado/leitura.ts`, `apps/api/src/voluntariado/rotas.ts` (registrado em `app.ts`)
- Test: `apps/api/test/migracao-0016.test.ts`, `apps/api/test/voluntariado.test.ts`

**Interfaces:**
- Produces:
  - Tabela `voluntariado_lancamento (id uuid pk default gen_random_uuid(), militar_id uuid not null references militar (id), mes date not null check (extract(day from mes) = 1), lancado_por uuid references usuario (id), lancado_em timestamptz not null default now(), unique (militar_id, mes))` com gatilho `auditoria_registro` (a auditoria usa a coluna `id`). Serve para "já lançado" mesmo com zero marcações.
  - Contratos: `TurnoPadrao = z.enum(['A', 'B'])`; `MarcaDeVoluntariado = z.object({ data: Data, turno: TurnoPadrao })`; `LancamentoDeVoluntariado = z.object({ marcas: z.array(MarcaDeVoluntariado) })` com refine "Esta marcação aparece duas vezes." (mesma data e turno); tipos `MilitarDoVoluntariado = { militarId: string; posto: string; nomeGuerra: string; matricula: string; equipe: string | null; jornada: 'pronto' | 'adm'; voluntarioJes: boolean; lancado: boolean; turnos: number; dias: number }`, `VoluntariadoDoMes = { mes: string; militares: MilitarDoVoluntariado[] }`, `VoluntariadoDoMilitar = { militarId: string; mes: string; marcas: MarcaDeVoluntariado[]; doMesAnterior: MarcaDeVoluntariado[]; folgas: string[] | null }`.
  - `voluntariadoDoMes(c: Consulta, unidadeId: string, mes: string): Promise<VoluntariadoDoMes>` — militares ativos com lotação na seção em algum dia do mês (a lotação que cobre o maior trecho do mês dá equipe e jornada; empate, a mais recente), em ordem de nome de guerra (`localeCompare('pt-BR')`); `lancado` = há `voluntariado_lancamento` do mês; `turnos` = marcações do mês; `dias` = datas distintas.
  - `voluntariadoDoMilitar(c: Consulta, unidadeId: string, militarId: string, mes: string): Promise<VoluntariadoDoMilitar>` — marcações do mês e do mês anterior em ordem de data e turno; `folgas` = os dias do mês em que a equipe do militar (Pronto, equipe ALFA a DELTA pelo nome, sem caixa) **não** está de serviço, pelo ciclo do motor (`detectarEquipeInicial` com as alocações de Pronto turno A do mês anterior na seção, `equipeDoDia`); `null` quando o militar é do Adm, não tem equipe do ciclo ou a equipe do dia 1 não pôde ser descoberta.
  - `GET /api/unidades/:u/voluntariado/:mes` → 200 `VoluntariadoDoMes`; `GET /api/militares/:id/voluntariado/:mes` → 200 `VoluntariadoDoMilitar`. Papel de cadastro na unidade (o militar pela unidade da lotação, `unidadeDoRegistro('militar')`); mês inválido → 400 "Mês inválido: use o formato aaaa-mm.".

- [ ] **Step 1: Write the failing tests**:
  - `migracao-0016`: o mesmo (militar, mês) não entra duas vezes (23505); mês que não é dia 1 é recusado; a gravação entra na auditoria.
  - `voluntariado.test.ts`, com o mês seguinte ao atual (`somarMeses(atual, 1)`) e militares fictícios: a lista traz quem tem lotação no mês, em ordem de nome, com `lancado`, `turnos` e `dias` certos (2 marcações no mesmo dia = 2 turnos em 1 dia); quem é transferido para a seção no dia 15 aparece; quem só chega no mês depois não aparece (Review Focus 4); `GET` do militar traz `marcas` e `doMesAnterior`; com um militar BRAVO escalado no Pronto turno A no último dia do mês anterior, a equipe do dia 1 é CHARLIE e as `folgas` de um militar CHARLIE não incluem os dias 1, 5, 9…; `folgas` é `null` para o Adm e quando o mês anterior não tem Pronto; escalante de outra seção → 403 nas duas rotas.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0016.test.ts test/voluntariado.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a migração, os contratos, a leitura e as duas rotas `GET`.
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Expected: passa (o teste de isolamento entre unidades cobre as rotas novas sozinho).
- [ ] **Step 5: Commit** `Fase 4.2: voluntariado no banco e leitura do mês`.

### Task 11: Gravar o lançamento (API)

**Files:**
- Create: `apps/api/src/voluntariado/lancamento.ts`
- Modify: `apps/api/src/voluntariado/rotas.ts`
- Test: `apps/api/test/voluntariado.test.ts`, `apps/api/test/escala-candidatos.test.ts`

**Interfaces:**
- Consumes: Tarefa 10.
- Produces:
  - `lancar(tx: Consulta, militarId: string, mes: string, marcas: MarcaDeVoluntariado[], usuarioId: string): Promise<void>` — na mesma transação: apaga **todas** as marcações do militar no mês (qualquer origem), grava as novas com `origem = 'manual'` e grava ou atualiza o `voluntariado_lancamento` (`lancado_por`, `lancado_em = now()`).
  - `PUT /api/militares/:id/voluntariado/:mes` com `LancamentoDeVoluntariado` → 200 `VoluntariadoDoMes` da unidade (a tela troca a lista e passa ao próximo). Marcação fora do mês → 400 `{ erro: 'Confira os campos destacados.', campos: { 'marcas.N': 'Use um dia de <mês por extenso>.' } }`; militar sem lotação na seção em nenhum dia do mês → 409 `"Este militar não está lotado na seção em <mês por extenso>."`; lista vazia é aceita. Qualquer mês é aceito (o escalante corrige o mês corrente se precisar). Papel de cadastro.
  - As alocações já feitas não mudam quando o voluntariado muda (a lista "Escolher militar" passa a refletir o novo lançamento).

- [ ] **Step 1: Write the failing tests** em `voluntariado.test.ts`: lançar 3 marcações → `turnos: 3`, `lancado: true`; lançar de novo com 1 → `turnos: 1` (substitui) e uma marcação de origem `importacao` do mesmo mês também some, a do mês anterior fica (Review Focus 2); lançar `[]` → `lancado: true, turnos: 0, dias: 0` (Review Focus 1); marcação de outro mês → 400 com `marcas.0`; repetida → 400; militar que só chega no mês seguinte → 409 com a frase (Review Focus 4); outra seção → 403. Em `escala-candidatos.test.ts`: um militar não voluntário de uma diária passa a apto depois de lançar A no dia, e volta a "Não marcou voluntariado neste horário" depois de lançar `[]`.
- [ ] **Step 2: Run** os dois arquivos. Expected: FAIL.
- [ ] **Step 3: Implement** `lancar` e a rota `PUT` (`comUsuario`, para a auditoria saber quem lançou).
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2: gravar o lançamento do voluntariado`.

### Task 12: Tela do voluntariado (lista, calendário e salvar)

**Files:**
- Create: `apps/web/src/api/voluntariado.ts`, `apps/web/src/routes/_app/voluntariado.tsx` (busca `?mes=&militar=`), `apps/web/src/componentes/voluntariado/ListaDoVoluntariado.tsx`, `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`
- Modify: `apps/web/src/componentes/Trilho.tsx` (`para: '/voluntariado'`)
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`, ajuste em `casca.test.tsx`

**Interfaces:**
- Consumes: Tarefas 10 e 11; `useTrava`, `usePendencia`, `podeDescartar`, `ProvedorDePendencias`, `mesPorExtenso`, `somarMeses`.
- Produces: `consultaVoluntariadoDoMes(unidadeId, mes)` (queryKey `['voluntariado', unidadeId, mes]`), `consultaVoluntariadoDoMilitar(militarId, mes)` (queryKey `['voluntariado-militar', militarId, mes]`), `lancarVoluntariado(queryClient, unidadeId, militarId, mes, marcas): Promise<VoluntariadoDoMes>` (grava a lista devolvida no cache, invalida `['voluntariado-militar', militarId, mes]` e `['candidatos']`).
- Tela (print aprovado): mês no topo (padrão: **o mês seguinte ao atual**); à esquerda, a busca "Nome ou matrícula" e a lista em duas partes, "Já lançados" (com "N dias") e "Faltam lançar" (o aberto mostra "lançando"); sem `?militar=`, abre o primeiro de "Faltam lançar". À direita: título posto + nome; linha "Equipe Alfa." ou "Adm."; para quem não é voluntário JES, "Não é voluntário JES: as marcações valem só para diárias."; legenda "A 08h às 20h" e "B 20h às 08h"; o calendário de domingo a sábado, um quadro por dia com o número (botão que marca ou desmarca os dois turnos do dia, nome acessível "Dia 5: marcar os dois turnos" ou "…desmarcar…") e os botões A e B (`aria-pressed`, nome "Dia 5, turno A"), fim de semana com o quadro destacado; rodapé "11 turnos em 8 dias." (sem marcação: "Nenhum turno marcado."); "Limpar" (zera) e "Salvar e ir para o próximo" (com `useTrava`): grava e abre o próximo de "Faltam lançar" depois do atual (o seguinte na lista; sem próximo, fica no atual e mostra "Todos os militares deste mês foram lançados."); erro da API aparece acima dos botões.
- Alteração pendente (`usePendencia`): trocar de militar ou de mês com marcações não salvas pergunta antes (`podeDescartar`) (Review Focus 5).

- [ ] **Step 1: Write the failing tests** em `voluntariado.test.ts` (fixtures fictícios: 2 lançados, 3 faltando; mês seguinte com 30 dias): o trilho leva a "Voluntariado" no mês seguinte; a lista mostra "Já lançados" com "9 dias" e "Faltam lançar" com o primeiro como "lançando"; o cabeçalho mostra equipe e o aviso de não voluntário JES; clicar em "Dia 5, turno A" marca (`aria-pressed=true`) e o rodapé diz "1 turno em 1 dia."; clicar no número do dia marca os dois; "Limpar" zera; "Salvar e ir para o próximo" manda `PUT /api/militares/m3/voluntariado/<mês>` com as marcações e abre o seguinte; dois cliques mandam um pedido só; 400 mostra a frase; trocar de militar com marcação pendente chama `window.confirm` e, cancelando, fica no mesmo.
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/voluntariado.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** a rota, as consultas e os dois componentes.
- [ ] **Step 4: Run** `pnpm --filter web test && pnpm typecheck`. Expected: passa (o teste da casca que via "Voluntariado" desabilitado passa a ver o link).
- [ ] **Step 5: Commit** `Fase 4.2: tela do voluntariado`.

### Task 13: Atalhos, arrastar e teclado

**Files:**
- Create: `apps/web/src/lib/voluntariado.ts`
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`, `apps/web/src/routes/_app/voluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`, `apps/web/src/__testes__/voluntariado-regras.test.ts`

**Interfaces:**
- Consumes: Tarefa 12.
- Produces (funções puras em `lib/voluntariado.ts`, sobre `Set<string>` de chaves `aaaa-mm-dd|A`):
  - `fimDeSemana(mes: string): string[]` (sábados e domingos);
  - `marcarDias(marcas: Set<string>, dias: string[]): Set<string>` (acrescenta A e B dos dias);
  - `alternarDia(marcas, dia): Set<string>` (os dois marcados → desmarca os dois; senão marca os dois);
  - `copiarDoMes(anterior: MarcaDeVoluntariado[], mes: string): Set<string>` (o dia N do mês anterior vira o dia N do mês; dias que não existem no mês são descartados).
- Atalhos abaixo do calendário (somam ao que está marcado, menos "Copiar", que substitui): "Todos os sábados e domingos"; "Dias de folga da equipe Alfa" (só aparece com `folgas` não nulo; marca A e B das folgas); "Copiar de <mês anterior por extenso>" (desabilitado sem marcações no mês anterior).
- Arrastar: pressionar no número de um dia e passar por outros aplica a todos a mesma ação do primeiro (marcar os dois turnos ou desmarcar os dois), até soltar (eventos de ponteiro).
- Teclado: o foco anda pelos números dos dias com as setas (esquerda e direita: um dia; cima e baixo: uma semana; sem sair do mês); espaço no número alterna o dia; Enter em qualquer ponto do calendário é "Salvar e ir para o próximo". O rodapé ganha "Atalhos de teclado: setas movem, espaço marca, Enter salva e passa ao próximo.".

- [ ] **Step 1: Write the failing tests**: `voluntariado-regras`: `fimDeSemana('2026-11')` traz os 9 sábados e domingos; `alternarDia` com só A marcado marca os dois; com os dois marcados desmarca; `copiarDoMes` de marcações em 30 e 31 de outubro para `2026-11` traz só o 30 (Review Focus 3); `marcarDias` não duplica. `voluntariado.test.tsx`: "Todos os sábados e domingos" marca A e B dos fins de semana e o rodapé muda; "Dias de folga da equipe Alfa" marca as folgas do `GET` e não aparece para quem tem `folgas: null`; "Copiar de outubro" substitui as marcações; arrastar do dia 3 ao dia 5 (pointerdown no 3, pointerenter no 4 e no 5, pointerup) marca os três dias; com o foco no dia 5, seta para a direita leva ao dia 6 e seta para baixo ao 12; espaço marca o dia focado; Enter manda o `PUT`.
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/voluntariado.test.tsx src/__testes__/voluntariado-regras.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as funções, os atalhos, o arrastar e o teclado.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2: atalhos, arrastar e teclado no voluntariado`. Revisão final do branch (Opus), correções, push e PR com: o que entrou, **tem migração (0016)** e o lembrete `pnpm --filter api db:migrar:teste`, o que conferir no ambiente de teste (lançar um militar, salvar e passar ao próximo, salvar um sem marcação, copiar do mês anterior, ver na "Escolher militar" de uma diária quem marcou o turno) e as decisões para o usuário. **Parar até o merge.**

---

# Entrega 2.2 — Voluntariado por faixa de horário

**Executada depois da 2.1** (a ordem de escala foi executada primeiro; as migrações são 0017 da 2.1 e 0018 desta). **Branch:** `fase4-2-2-voluntariado-por-faixa`, a partir da `main`. **Tem migração** (0018: converte o que existe e troca a tabela `voluntariado` por `disponibilidade`). Commits `Fase 4.2.2: …`; PR "Fase 4 — Entrega 2.2: voluntariado por faixa de horário".

**Spec:** `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md` (e o mockup `docs/telas/mockup-voluntariado-faixas.html`). Contagens de partida: protótipo 589, contratos 14, motor 771 (+1 ignorado), API 543, site 340 (com o PR #32).

**Review Focus da entrega 2.2** (cada um tem teste na tarefa dona):

1. **Turno que atravessa a meia-noite** (20h às 08h, 16h às 00h): pede o dia em que começa até 24h e o dia seguinte desde 00h; no último dia do mês, o dia seguinte é do mês que vem. Tarefas 14 e 16.
2. **Conversão do turno B do último dia do mês**: o pedaço das 00h às 08h vai para o dia 1 do mês seguinte, sem criar "já lançado" e sem perder nada. Tarefa 15.
3. **Faixas encostadas** (08–16 e 16–20 marcadas em separado) cobrem um serviço das 08h às 20h; ao gravar, viram uma faixa só. Tarefas 14 e 15.
4. **Bloco parcial**: com um corte a menos, um bloco maior coberto só em parte aparece listrado e clicar nele marca o bloco inteiro. Tarefa 17.
5. **No celular, deslizar não marca**: só o toque no bloco inteiro; a página rola. Tarefa 18.

### Task 14: Regras da disponibilidade no motor

**Files:**
- Create: `pacotes/dominio/src/disponibilidade.ts` (exportado no `index.ts`)
- Test: `pacotes/dominio/test/disponibilidade.test.ts`

**Interfaces:**
- Produces (funções puras, minutos do dia de 0 a 1440):
  - `type Faixa = { inicio: number; fim: number }`
  - `cortesDoDia(turnos: { inicio: string; fim: string }[]): number[]` — os minutos de início e de fim de cada turno ('00:00' de fim vale 0 e 1440), mais 0 e 1440, sem repetição, em ordem.
  - `blocosDoDia(cortes: number[]): Faixa[]` — os intervalos entre cortes vizinhos.
  - `unirFaixas(faixas: Faixa[]): Faixa[]` — em ordem, unindo as encostadas e as sobrepostas.
  - `turnoCoberto(faixasDoDia: (data: string) => Faixa[], data: string, inicio: string, fim: string): boolean` — o turno começa em `data`; o que passa de 1440 usa o dia seguinte (`somarDias`); usa `duracaoMinutos` (turno de 24h = 1440 minutos).
- Regra só do sistema novo: sem caso gravado do protótipo.

- [ ] **Step 1: Write the failing tests**: `cortesDoDia` dos turnos de hoje (PE Seguro 00–08, 08–16, 16–00; Bioma 08–16; CPRH 08–20) = `[0, 480, 960, 1200, 1440]`; com um turno das 06h às 12h, entram 360 e 720; um turno das 20h às 08h corta em 1200 e 480; `blocosDoDia` dá 4 blocos com as durações 480, 480, 240, 240; `unirFaixas([{960,1200},{480,960},{1200,1440}])` = `[{480,1440}]`; `turnoCoberto` com 08–20 marcado: 08–16 sim, 16–00 não; com 16–24 marcado, 16–00 sim; 20–08 do dia 30/11 com 20–24 do dia 30 e 00–08 de 01/12 sim, sem o dia 01/12 não (Review Focus 1); faixas 480–960 e 960–1200 cobrem 08–20 (Review Focus 3); 08–08 (24h) pede 08–24 do dia e 00–08 do seguinte.
- [ ] **Step 2: Run** `pnpm --filter dominio test`. Expected: FAIL.
- [ ] **Step 3: Implement** as quatro funções.
- [ ] **Step 4: Run** `pnpm --filter dominio test && pnpm --filter dominio typecheck`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.2: regras da disponibilidade no motor`.

### Task 15: Disponibilidade no banco, conversão, contratos e API do voluntariado

**Files:**
- Create: `apps/api/banco/migracoes/0018_disponibilidade.sql`
- Modify: `pacotes/contratos/src/voluntariado.ts`, `apps/api/src/voluntariado/leitura.ts`, `apps/api/src/voluntariado/lancamento.ts`, `apps/api/src/voluntariado/rotas.ts`
- Test: `apps/api/test/migracao-0018.test.ts`, `apps/api/test/voluntariado.test.ts`, `apps/api/test/migracao-0016.test.ts` (se depender de `voluntariado`)

**Interfaces:**
- Consumes: Tarefa 14.
- Produces:
  - Tabela `disponibilidade (id uuid pk, militar_id uuid not null references militar (id), data date not null, inicio_min int not null, fim_min int not null, origem text not null check (origem in ('manual', 'importacao', 'militar')), check (inicio_min >= 0 and inicio_min < fim_min and fim_min <= 1440), unique (militar_id, data, inicio_min))`, índice `(militar_id, data)`, auditoria. A migração copia `voluntariado`: A do dia D → (D, 480, 1200); B do dia D → (D, 1200, 1440) e (D+1, 0, 480), com a origem de origem; depois apaga a tabela `voluntariado`. `voluntariado_lancamento` não muda.
  - Contratos: `Hora24` (como `Hora`, aceitando também `"24:00"`); `FaixaDeDisponibilidade = z.object({ data: Data, inicio: Hora, fim: Hora24 })` com refine "O fim precisa ser depois do início."; `LancamentoDeVoluntariado = z.object({ faixas: z.array(FaixaDeDisponibilidade) })` (sobreposição é aceita: a API une); `MilitarDoVoluntariado` troca `turnos` por `horas: number` (soma das faixas do mês, em horas, depois de unir); `VoluntariadoDoMilitar = { militarId; mes; faixas: FaixaDeDisponibilidade[]; doMesAnterior: FaixaDeDisponibilidade[]; blocos: { inicio: string; fim: string }[]; folgas: string[] | null }` (`blocos` = os blocos do dia em `"HH:MM"`, com `"24:00"`). Saem `LetraDoTurnoPadrao` e `MarcaDeVoluntariado`.
  - `blocosDaSecao(c: Consulta, unidadeId: string): Promise<Faixa[]>` — `blocosDoDia(cortesDoDia(...))` dos turnos dos serviços **ativos** da seção com `tipo` `pjes` ou `diaria`; sem nenhum, um bloco só (0–1440).
  - `lancar(tx, militarId, mes, faixas, usuarioId)`: apaga as faixas do militar com data no mês, grava `unirFaixas` de cada dia (`origem = 'manual'`) e o lançamento, como hoje.
  - `PUT /api/militares/:id/voluntariado/:mes` com `{ faixas }`: faixa com data fora do mês → 400 em `faixas.N` ("Use um dia de <mês por extenso>."); o resto como na entrega 2.

- [ ] **Step 1: Write the failing tests**: `migracao-0018` (antes de migrar, marcações A em 05/11 e B em 05/11 e em 30/11; depois: (05/11, 480–1200), (05/11, 1200–1440), (06/11, 0–480), (30/11, 1200–1440), (01/12, 0–480) — Review Focus 2 —; a tabela `voluntariado` não existe mais; fim antes do início é recusado). Em `voluntariado.test.ts` (adaptar o existente às faixas): `horas` e `dias` certos (08–16 e 16–20 no dia 5 = 12 horas em 1 dia); `GET` do militar traz `faixas` unidas e `blocos` `[00:00–08:00, 08:00–16:00, 16:00–20:00, 20:00–24:00]` com os serviços do cenário; lançar `[08:00–16:00, 16:00–20:00]` grava uma faixa só (480–1200) (Review Focus 3); lançar substitui o mês; faixa de outro mês → 400; `[]` → lançado com 0 horas.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0018.test.ts test/voluntariado.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a migração, os contratos, a leitura, `blocosDaSecao` e o lançamento.
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Expected: a API passa; o site ainda não compila com os contratos novos — rodar `pnpm --filter api typecheck` e `pnpm --filter contratos typecheck` nesta tarefa (o site é a Tarefa 17).
- [ ] **Step 5: Commit** `Fase 4.2.2: disponibilidade por faixa no banco e na API`.

### Task 16: A lista "Escolher militar" usa as faixas

**Files:**
- Modify: `apps/api/src/escala/elegibilidade.ts`
- Test: `apps/api/test/escala-candidatos.test.ts` (o ajudante `voluntariar` passa a gravar faixas), `apps/api/test/escala-acumulo.test.ts` e outros que gravem `voluntariado`

**Interfaces:**
- Consumes: `turnoCoberto` (Tarefa 14), tabela `disponibilidade` (Tarefa 15).
- Produces: para serviço que não é ordinário, o motivo `"Não marcou voluntariado neste horário"` sai quando `turnoCoberto` é falso, com as faixas do dia e do dia seguinte (a consulta lê `data` entre o dia e o dia seguinte). O resto da conferência não muda.

- [ ] **Step 1: Write the failing tests** em `escala-candidatos.test.ts`: uma diária das 16h às 00h — militar com 16–20 e 20–24 marcados é apto; com só 08–20 marcado (o antigo "A") fica "Não marcou voluntariado neste horário" (o defeito que motivou a mudança); um serviço das 00h às 08h no dia 1 é coberto pelo bloco 00–08 do próprio dia 1 (sem depender do mês anterior); um turno 20–08 do último dia pede o 00–08 do dia 1 do mês seguinte (Review Focus 1). Os testes existentes passam a gravar faixas (A = 480–1200; B = 1200–1440 e 0–480 do dia seguinte).
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/escala-candidatos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a troca na elegibilidade.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.2: a lista de candidatos usa as faixas`.

### Task 17: Tela do voluntariado por blocos (computador)

**Files:**
- Modify: `apps/web/src/lib/voluntariado.ts`, `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`, `apps/web/src/api/voluntariado.ts`, `apps/web/src/routes/_app/voluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`, `apps/web/src/__testes__/voluntariado-regras.test.tsx`

**Interfaces:**
- Consumes: Tarefa 15 (contratos e rotas).
- Produces:
  - `lib/voluntariado.ts` sobre faixas por dia (`Map<string, Faixa[]>` em minutos): `estadoDoBloco(faixas, bloco): 'cheio' | 'parcial' | 'vazio'`; `alternarBloco(m, dia, bloco)` (cheio → tira; parcial ou vazio → marca o bloco inteiro); `alternarDia(m, dia)` (dia todo coberto → limpa; senão 0–1440); `marcarDias(m, dias)` (dia inteiro); `copiarDoMes(anterior, mes)` (pelo número do dia, descartando o que não existe); `textoDoRodape(m)`: "N horas em M dias." ("1 hora", "1 dia"; vazio: "Nenhum horário marcado."); `faixasParaEnviar(m)`: as faixas de cada dia unidas, em `"HH:MM"`.
  - Tela (spec "Computador"): acima do calendário, a régua-legenda do dia com os blocos proporcionais e os horários dos cortes; em cada dia, o número e a faixa com os blocos em largura proporcional à duração (`flex` pela duração; noite sombreada), botão por bloco com `aria-pressed` (parcial: `aria-pressed="mixed"`, listrado) e nome "Dia 5, 08h às 16h"; **a dica com o horário** aparece ao passar o mouse e ao focar (texto visível, não só `title`); arrastar marca vários (mesma ação do primeiro); os atalhos, o teclado (setas nos números, espaço, Enter), "Limpar", "Salvar e ir para o próximo", o foco no dia 1 do próximo e o aviso de alteração pendente continuam como na entrega 2; legenda "A 08h às 20h / B 20h às 08h" sai.

- [ ] **Step 1: Write the failing tests**: regras (`estadoDoBloco` com o bloco 08–20 coberto só de 08–16 = parcial — Review Focus 4 —; `alternarBloco` no parcial marca o bloco inteiro; `faixasParaEnviar` une 08–16 e 16–20; rodapé no singular e no plural); tela: os 4 blocos do dia com os nomes "Dia 5, 00h às 08h" … "Dia 5, 20h às 24h"; clicar em "Dia 5, 16h às 20h" marca só ele e o rodapé diz "4 horas em 1 dia."; o número do dia marca os 4 blocos; focar um bloco mostra o texto "16h às 20h"; um bloco parcial vem com `aria-pressed="mixed"`; "Salvar e ir para o próximo" manda `{ faixas: [{ data, inicio: '16:00', fim: '20:00' }] }`; atalhos e arrastar com os blocos.
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/voluntariado.test.tsx src/__testes__/voluntariado-regras.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** a lib e o calendário por blocos.
- [ ] **Step 4: Run** `pnpm --filter web test && pnpm typecheck`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.2: tela do voluntariado por blocos`.

### Task 18: Tela do voluntariado no celular

**Files:**
- Create: `apps/web/src/lib/useEhCelular.ts`
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`

**Interfaces:**
- Consumes: Tarefa 17.
- Produces: `useEhCelular(): boolean` (`matchMedia('(max-width: 767px)')`, atualiza ao mudar; sem `matchMedia`, falso). No celular (spec "Celular"): um dia por linha (número e dia da semana à esquerda, os blocos proporcionais à direita), os **rótulos só dos cortes** (00h, 08h, 16h, 20h, 00h) numa faixa no topo, alinhados aos cortes e parados durante a rolagem (`sticky`); **sem arrastar**: o arrasto só vale para ponteiro de mouse (`pointerType === 'mouse'`), e os blocos usam `touch-action: manipulation` (a página rola). Os atalhos, o rodapé e os botões são os mesmos.

- [ ] **Step 1: Write the failing tests** (com `matchMedia` simulado para celular): a tela mostra um dia por linha (`data-disposicao="linhas"`) e a faixa de rótulos com exatamente os textos "00h", "08h", "16h", "20h", "00h"; tocar num bloco marca só ele; `pointerdown` de toque num bloco seguido de `pointerenter` em outro não marca o segundo (Review Focus 5); sem o simulado (computador), a disposição é o calendário (`data-disposicao="calendario"`).
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement** o gancho e a disposição em linhas.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.2: voluntariado no celular`. Revisão final do branch (Opus), correções, push e PR com: o que entrou, **tem migração (0018)** e o lembrete `pnpm --filter api db:migrar:teste` (converte o que foi lançado em A e B), o que conferir (no computador e no celular: marcar blocos, ver o horário do bloco, dia inteiro pelo número, salvar e passar ao próximo; na "Escolher militar", uma diária das 16h às 00h só aparece para quem marcou 16–20 e 20–24; o dia 1 das 00h às 08h aparece para quem marcou o próprio dia 1) e as decisões para o usuário (cortes só dos serviços que pedem voluntariado; turno B do último dia na conversão). **Parar até o merge.**

---

# Entrega 2.1 — Ordem de escala

**Branch:** `fase4-2-1-ordem-de-escala`, a partir da `main` depois do merge da entrega 2. **Tem migração** (0017). Commits `Fase 4.2.1: …`; PR "Fase 4 — Entrega 2.1: ordem de escala".

### Task 19: Ordem de escala no banco, nos contratos e a regra das vagas

**Files:**
- Create: `apps/api/banco/migracoes/0017_ordem_de_escala.sql`, `pacotes/contratos/src/ordem-de-escala.ts` (exportado no `index.ts`), `apps/api/src/escala/ordem.ts`
- Test: `apps/api/test/migracao-0017.test.ts`, `apps/api/test/ordem-de-escala-regras.test.ts`

**Interfaces:**
- Produces:
  - Tabelas `ordem_escala_versao (id uuid pk, escala_id uuid not null references escala (id), vigencia_desde date not null check (extract(day from vigencia_desde) = 1), unique (escala_id, vigencia_desde))` e `ordem_escala_item (versao_id uuid not null references ordem_escala_versao (id) on delete cascade, posicao int not null check (posicao >= 1), guarnicao_id uuid not null references guarnicao (id), funcao_id uuid not null references funcao (id), vaga int not null check (vaga >= 1), primary key (versao_id, posicao), unique (versao_id, guarnicao_id, funcao_id, vaga))`; gatilhos de auditoria.
  - Contratos: `VagaDaOrdem = z.object({ guarnicaoId: Id, funcaoId: Id, vaga: z.number().int().min(1) })`; `OrdemDeEscalaEntrada = z.object({ itens: z.array(VagaDaOrdem) })` com refine "Esta vaga aparece duas vezes na ordem." (posição = índice + 1; lista vazia é aceita); tipo `VagaNaTela = { guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string; vaga: number; obrigatoria: boolean; posicao: number | null }`; tipo `OrdemDeEscala = { escalaId: string; mes: string; vigencia: string | null; vagas: VagaNaTela[] }` (`vigencia` = mês da versão em vigor; `null` = ordem padrão; `vagas` na ordem de exibição: guarnições pela ordem dos cards, funções pela composição, vaga 1, 2…).
  - Em `ordem.ts`, funções puras:
    - `vagasDoMes(modelos: { guarnicaoId: string; guarnicao: string; prioridade: number | null; composicao: { funcaoId: string; funcao: string; minimo: number; maximo: number }[] }[]): Omit<VagaNaTela, 'posicao'>[]` — cada guarnição uma vez (as de todas as faixas juntas), cada função vira `maximo` vagas, `obrigatoria = vaga <= minimo`; ordem de exibição: prioridade (nula por último), depois nome, depois composição.
    - `aplicarOrdem(vagas, itens: VagaDaOrdem[] | null): VagaNaTela[]` — `null` = ordem padrão (posição 1…n na ordem de exibição); com itens, cada vaga existente recebe a posição relativa dos itens, compactada (1, 2, 3… sem buraco, itens de vagas que não existem mais são ignorados); vaga sem item fica `posicao: null`.
    - `sequenciaDePreenchimento(vagas: VagaNaTela[]): VagaNaTela[]` — as numeradas por posição, depois as sem número na ordem de exibição (é o que a pré-escala da entrega 3 percorre).

- [ ] **Step 1: Write the failing tests**: `migracao-0017` (versão única por escala e mês; item repetido → 23505; apagar a versão apaga os itens). `ordem-de-escala-regras`: função de mínimo 2 e máximo 4 → 4 vagas, 2 obrigatórias; guarnição em duas faixas aparece uma vez; sem itens → posições 1…n pela prioridade e nome; itens `[AR Chefe 1, ABT Chefe 1]` → AR Chefe 1 tem posição 1; item de vaga que sumiu (máximo diminuiu) → ignorado e as posições ficam 1, 2, 3 (Review Focus 4); vaga nova sem item → `posicao: null` e entra no fim de `sequenciaDePreenchimento`.
- [ ] **Step 2: Run** `pnpm --filter api vitest run test/migracao-0017.test.ts test/ordem-de-escala-regras.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a migração, os contratos e as três funções.
- [ ] **Step 4: Run** `pnpm --filter api test && pnpm --filter contratos test && pnpm typecheck`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.1: ordem de escala no banco e regra das vagas`.

### Task 20: Ler e gravar a ordem (API) e cards na ordem

**Files:**
- Modify: `apps/api/src/escala/rotas.ts` (ou `apps/api/src/cadastros/escalas.ts`, junto dos vínculos), `apps/api/src/escala/leitura.ts`
- Test: `apps/api/test/ordem-de-escala.test.ts`, `apps/api/test/escala-leitura.test.ts`, `apps/api/test/isolamento-entre-unidades.test.ts`

**Interfaces:**
- Consumes: Tarefa 19; `vinculosDaEscala`, `versoesDasGuarnicoes`, `versaoNoMes`, `mesPassado`.
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

### Task 21: Tela da ordem de escala

**Files:**
- Create: `apps/web/src/api/ordem-de-escala.ts`, `apps/web/src/routes/_app/escalas/$id.ordem.tsx` (busca `?mes=`), `apps/web/src/componentes/escalas/OrdemDeEscala.tsx`
- Modify: `apps/web/src/routes/_app/escalas/$id.tsx` (link "Ordem de escala" na ficha), `apps/web/src/componentes/guarnicoes/Versoes.tsx` e a lista de guarnições (sai o campo e o número de prioridade)
- Test: `apps/web/src/__testes__/ordem-de-escala.test.tsx`, ajustes nos testes de guarnições

**Interfaces:**
- Consumes: Tarefas 19 e 20; `useTrava`, `usePendencia`, `useSincronizar`, `AcoesDoBloco`.
- Produces: `consultaOrdemDeEscala(escalaId, mes)` (queryKey `['ordem-de-escala', escalaId, mes]`), `gravarOrdemDeEscala(queryClient, escalaId, mes, itens: VagaDaOrdem[])` (grava o devolvido no cache e invalida `['escala-do-mes', escalaId]`).
- Tela (spec Parte 1): título "Ordem de escala — <escala>", "Vale a partir de" (mês, padrão o mês atual), "Limpar" e "Salvar"; cada guarnição numa linha com um quadrado por vaga (`button`, nome acessível "Chefe ABT, vaga 1" e, numerada, "…, posição 4"), obrigatórias cheias e extras tracejadas; clicar num sem número dá o próximo número; clicar num numerado tira e os seguintes sobem um; ao lado, a lista numerada com "Subir" e "Descer"; rodapé "9 de 10 vagas na ordem. Falta: Combatente 3 da ABT." (sem falta: "Todas as vagas estão na ordem."); com `vigencia: null`, a frase "Ainda sem ordem cadastrada: a sugestão abaixo segue a prioridade antiga das guarnições."; teclado: setas movem o foco entre quadrados, espaço numera ou tira; alteração pendente avisa ao sair (`usePendencia`).
- Guarnições: o campo "Prioridade" sai do formulário da versão e o número sai da lista (a API continua aceitando o campo para a importação, que alimenta a ordem padrão).
- [ ] **Step 1: Write the failing tests**: a ficha da escala tem o link "Ordem de escala"; a tela mostra os quadrados com as posições do GET; clicar num sem número dá o próximo número e o rodapé muda; clicar num numerado tira e o seguinte sobe; "Descer" troca dois vizinhos; "Salvar" manda `PUT /api/escalas/e1/ordem/2026-12` com `itens` na ordem e dois cliques mandam um pedido só; 400 mostra a frase; `vigencia: null` mostra a frase da sugestão; espaço num quadrado focado numera; o formulário da guarnição não tem mais "Prioridade".
- [ ] **Step 2: Run** `pnpm --filter web vitest run src/__testes__/ordem-de-escala.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** a rota, a consulta, o componente e a saída da prioridade.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.1: tela da ordem de escala`. Revisão final do branch (Opus), correções, push e PR com: o que entrou, **tem migração** e o lembrete `pnpm --filter api db:migrar:teste`, o que conferir (montar a ordem do Ordinário a partir do mês que vem, conferir os cards na nova ordem, mudar uma composição e ver a vaga nova em "Falta") e as decisões para o usuário. **Parar até o merge.** Lembrar no PR: atualizar o catálogo RN-XX (regra nova da ordem de escala; RN-08 substituída).

---

# Entrega 2.3 — Ajustes do voluntariado

**Branch:** `fase4-2-3-ajustes-do-voluntariado` (já criada a partir da `main` depois do merge do PR #34; o primeiro commit é o adendo do design). **Tem migração** (0019: marca de escala que entra nos blocos). Commits `Fase 4.2.3: …`; PR "Fase 4 — Entrega 2.3: ajustes do voluntariado".

**Spec:** adendo de 19/11/2026 em `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md` (seções "Flexibilidade", "O escalante sempre pode passar por cima", "De onde vêm os blocos", "Celular" e "Outros pontos").

**Execução (decisão do usuário):** executar com **Sonnet, esforço high** (`/model sonnet`, `/effort high`), em linha (superpowers:executing-plans, ledger `.superpowers/sdd/2026-11-18-fase4-escala/progress.md`). A revisão final do branch é uma só, por um Agent com `model: "opus"` e `effort: "medium"` explícitos. Não trocar de modelo no meio da execução.

**Contagens de partida:** protótipo 589, contratos 14, motor 786 (+1 ignorado), API 569, site 349.

**Ambiente desta máquina:** pouca memória. Rodar uma suíte por vez; API com `cd apps/api && npx vitest run --maxWorkers=1`; site com `cd apps/web && npx vitest run --maxWorkers=1`. Se um worker cair (código 134, "PGlite failed to initialize", "scrypt derivation failed", `cannot allocate memory`), é ambiente: rodar de novo o arquivo sozinho e registrar no ledger. Antes do typecheck e do build, conferir se não há `tsc`, `vitest` ou `vite` esquecidos rodando.

**Review Focus da entrega 2.3** (cada um tem teste na tarefa dona):

1. **Flexibilidade num turno que atravessa a meia-noite, no último dia do mês.** Com 1h, o 19h–07h do dia 30/11 é conferido como 20h do dia 30 até 06h do dia 01/12. Tarefas 22 e 23.
2. **Parâmetro herdado e com vigência.** A flexibilidade gravada no GB vale para a seção. Uma mudança com vigência em dezembro não altera a lista de novembro. Tarefa 23.
3. **Quem ficou de fora só por voluntariado, mas tem choque ou é de outra regra, continua de fora.** Não aparece no "Mostrar", e a gravação recusa. Tarefa 25.
4. **Nenhuma escala marcada para os blocos.** O dia vira um bloco só (00h às 24h), e o lançamento continua funcionando. Tarefa 24.
5. **Celular com alteração pendente.** "‹ Militares" e o botão voltar do celular perguntam antes de descartar. No computador nada muda: lista e painel lado a lado, e o primeiro que falta abre sozinho. Tarefa 26.

### Task 22: Flexibilidade no motor e o parâmetro do sistema novo

**Files:**
- Modify: `pacotes/dominio/src/disponibilidade.ts`
- Create: `pacotes/dominio/src/parametros-sistema-novo.ts` (exportar em `pacotes/dominio/src/index.ts`)
- Test: `pacotes/dominio/test/disponibilidade.test.ts`, `pacotes/dominio/test/parametros-sistema-novo.test.ts`

**Interfaces:**
- Produces: `turnoCoberto(faixasDoDia, data, inicio, fim, flexibilidadeMin = 0): boolean`. O trecho conferido vai de `i + flex` a `i + dur − flex`, com `flex = min(flexibilidadeMin, (dur − 60) / 2)` (sempre sobra ao menos 1h no meio). O resto segue igual: o que passa de 24h usa o dia seguinte; buraco no meio barra.
- Produces: `PARAM_SISTEMA_NOVO: DefParametro[]` com `{ chave: 'FLEXIBILIDADE_VOLUNTARIADO_HORAS', grupo: 'Voluntariado', rotulo: 'Flexibilidade do voluntariado (horas)', tipo: 'inteiro', padrao: 0, min: 0, max: 3, descricao: 'Horas que podem faltar no começo ou no fim do turno para o militar ainda contar como voluntário. Buraco no meio do turno não conta.' }` e `defDoSistema(chave): DefParametro | null`, que procura em `PARAM_CATALOGO` e depois em `PARAM_SISTEMA_NOVO`. **Não mexer em `PARAM_CATALOGO`**: ele é porte do protótipo e tem casos gravados (`resolverParametros_`).

- [ ] **Step 1: Write the failing tests** em `disponibilidade.test.ts`:
  - 07:00–15:00, faixas do dia `[480, 960]`: `false` sem flexibilidade e `true` com 60.
  - 08:00–20:00, faixas `[480, 720]` e `[780, 1200]`, flexibilidade 60: `false` (buraco no meio).
  - 19:00–07:00 no dia `2026-11-30`, faixas `[1200, 1440]` no dia 30 e `[0, 360]` em `2026-12-01`, flexibilidade 60: `true`. Com a mesma flexibilidade e o dia 01/12 só `[0, 300]`: `false`.
  - Turno 10:00–16:00 com flexibilidade 180 (o turno tem 6h): `flex = min(180, 150) = 150`, e o trecho conferido é 12h30–13h30. Com faixas `[750, 810]`: `true`. Com `[600, 660]`: `false`.

  Em `parametros-sistema-novo.test.ts`:
  - `defDoSistema('FLEXIBILIDADE_VOLUNTARIADO_HORAS')` existe, com `padrao` 0 e `max` 3.
  - `paramConverter(def, '1,5')` falha com "Use um número inteiro." (só horas cheias); `paramConverter(def, '4')` falha com "O máximo é 3.".
  - `defDoSistema('CARGA_MENSAL_HORAS')` continua vindo do catálogo antigo.
- [ ] **Step 2: Run** `pnpm --filter dominio test`. Expected: FAIL (parâmetro e flexibilidade inexistentes).
- [ ] **Step 3: Implement** os dois.
- [ ] **Step 4: Run** `pnpm --filter dominio test && node casos/reproduzir-prototipo.mjs`. Expected: passa, e os casos continuam ok (nenhum caso gravado muda).
- [ ] **Step 5: Commit** `Fase 4.2.3: flexibilidade do voluntariado no motor`.

### Task 23: A flexibilidade em Configurações e na lista "Escolher militar"

**Files:**
- Modify: `apps/api/src/cadastros/configuracoes.ts` (`CHAVES_SISTEMA` ganha a chave nova; `resolver` percorre `[...PARAM_CATALOGO, ...PARAM_SISTEMA_NOVO]`; o POST usa `defDoSistema`)
- Modify: `apps/api/src/escala/elegibilidade.ts`
- Test: `apps/api/test/configuracoes.test.ts` (ou o arquivo de parâmetros existente), `apps/api/test/escala-candidatos.test.ts`, `apps/web/src/__testes__/configuracoes.test.tsx`

**Interfaces:**
- Consumes: Tarefa 22.
- Produces: `parametroEmVigor(c: Consulta, unidadeId: string, chave: string, mes: string): Promise<ValorParametro>`, exportada de `configuracoes.ts`. Usa a mesma consulta da rota GET, ou seja, o valor da unidade mais próxima com vigência até o mês, ou o padrão. `avaliar` lê `FLEXIBILIDADE_VOLUNTARIADO_HORAS` da unidade da escala no mês da vaga e passa `horas * 60` para `turnoCoberto`.

- [ ] **Step 1: Write the failing tests:**
  - **API, configurações:** GET `/api/unidades/:u/parametros` lista "Flexibilidade do voluntariado (horas)" com valor 0 e origem `padrao`. O POST do gestor com `1` grava; com `1.5` volta 400 ("Use um número inteiro."); o escalante recebe 403.
  - **API, candidatos:** crie no cenário uma diária "Eleições" com turno 07:00–15:00 (fictícia). O militar com 08–16 marcado:
    - fica de fora com "Não marcou voluntariado neste horário" sem flexibilidade;
    - aparece com a flexibilidade 1 gravada **no nível de cima** da seção (Review Focus 2);
    - continua de fora, na lista de novembro, com a flexibilidade gravada em dezembro.
  - **API, virada do mês (Review Focus 1):** com flexibilidade 1, um turno 19:00–07:00 no último dia do mês aparece para quem marcou 20–24 nesse dia e 00–08 no dia 1 do mês seguinte.
  - **API, choque (spec: a flexibilidade não afrouxa choque):** quem está no Pronto B do dia anterior (20h–08h) continua de fora do 07:00–15:00, com "Choque de horário", mesmo com flexibilidade 1.
  - **Site:** a tela Configurações mostra a linha "Flexibilidade do voluntariado (horas)" com o valor.
- [ ] **Step 2: Run** os arquivos da API um por vez e o do site. Expected: FAIL.
- [ ] **Step 3: Implement.** Se a tela de Configurações já desenha qualquer parâmetro vindo da API, o site não precisa de código novo; o teste confirma.
- [ ] **Step 4: Run** `cd apps/api && npx vitest run --maxWorkers=1` e depois `cd apps/web && npx vitest run --maxWorkers=1`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.3: flexibilidade do voluntariado em Configurações e na lista`.

### Task 24: O gestor escolhe as escalas que montam os blocos do dia

**Files:**
- Create: `apps/api/banco/migracoes/0019_escala_blocos_voluntariado.sql`
- Modify: `pacotes/contratos/src/escalas.ts`, `apps/api/src/cadastros/escalas.ts`, `apps/api/src/voluntariado/leitura.ts` (`blocosDaSecao`)
- Modify: `apps/web/src/routes/_app/configuracoes.tsx`, `apps/web/src/api/configuracoes.ts` (ou `api/escalas.ts`)
- Test: `apps/api/test/migracao-0019.test.ts`, `apps/api/test/voluntariado.test.ts`, `apps/api/test/escalas.test.ts` (o de escalas existente), `apps/web/src/__testes__/configuracoes.test.tsx`

**Interfaces:**
- Produces: a coluna `escala.monta_blocos_voluntariado boolean not null default true`, auditada como as outras colunas da escala.
- Produces: `LinhaEscala` e `Escala` ganham `montaBlocosVoluntariado: boolean`, e o contrato ganha `MarcaDeBlocos = z.object({ montaBlocos: z.boolean() })`.
- Produces: a rota `PATCH /api/escalas/:id/blocos-do-voluntariado` com corpo `MarcaDeBlocos`. Papéis em `ESCREVE_PARAMETRO` (gestor e administrador); o escalante recebe 403. Devolve a escala atualizada.
- Produces: `blocosDaSecao` passa a ler os turnos dos serviços `pjes` e `diaria` ativos que estão em `escala_servico` de alguma escala **ativa** da unidade com `monta_blocos_voluntariado`. Sem nenhuma, o dia fica com um bloco (00h às 24h).
- Produces: a tela Configurações ganha a seção "Voluntariado", só leitura para o escalante, com:
  - a flexibilidade (a linha da Tarefa 23);
  - a lista das escalas ativas da unidade, cada uma com um interruptor "Entra nos blocos do voluntariado".

- [ ] **Step 1: Write the failing tests:**
  - **Migração 0019:** escalas existentes ficam com `true`.
  - **Voluntariado:** os blocos do cenário com todas marcadas continuam 00–08, 08–16, 16–20 e 20–24.
    - Uma escala "CPRH Eleições" (fictícia) com uma diária 07:00–15:00 faz aparecer os cortes 07h e 15h.
    - Depois de `PATCH … { montaBlocos: false }` nela, os cortes 07h e 15h somem e os quatro blocos voltam.
    - Com todas desmarcadas, `blocos` é `[{ inicio: '00:00', fim: '24:00' }]` (Review Focus 4), e o PUT do lançamento de uma faixa 08:00–16:00 continua gravando.
  - **Escalas:** o escalante recebe 403 na rota nova; o gestor recebe 200.
  - **Site:** o gestor vê "Voluntariado" com as escalas e o interruptor ligado. Desligar chama a rota com `{ montaBlocos: false }`. O escalante vê o interruptor desabilitado.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** O interruptor grava na hora (sem botão Salvar), com `useTrava`, e invalida a consulta do voluntariado do mês.
- [ ] **Step 4: Run** as suítes da API e do site, uma por vez. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.3: escalas que montam os blocos do voluntariado`.

### Task 25: "Mostrar" quem ficou de fora só por voluntariado

**Files:**
- Modify: `apps/api/src/escala/elegibilidade.ts`, `apps/api/src/escala/alocacoes.ts`, `pacotes/contratos/src/escala-do-mes.ts`
- Modify: `apps/web/src/componentes/escala-do-mes/EscolherMilitar.tsx`
- Test: `apps/api/test/escala-candidatos.test.ts`, `apps/api/test/escala-alocacao.test.ts`, `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Produces: em `avaliar`, a conferência da disponibilidade passa a ser **a última** de cada turno, depois do Saldo, do voluntário JES, do choque e da diária única. Assim o motivo `SEM_VOLUNTARIADO = 'Não marcou voluntariado neste horário'` (constante exportada) quer dizer que todas as outras regras passaram.
- Produces: `Candidatos` ganha `semVoluntariado: Candidato[]`. São os militares sem motivo de militar e sem nenhum turno livre, com ao menos um turno cujo único motivo é `SEM_VOLUNTARIADO`. `servicos` traz esses turnos. A ordem é a mesma dos aptos, e `fora` continua contando esses militares.
- Produces: o POST de escalar (`alocacoes.ts`) aceita quando `motivoDeFora` devolve `SEM_VOLUNTARIADO`, e recusa os outros motivos como hoje.
- Produces: em "Escolher militar", quando `semVoluntariado` não está vazia, a frase "Ficaram de fora…" ganha um botão "Mostrar". Ao tocar, abre o grupo "Sem voluntariado neste horário", com os mesmos botões de escolher dos aptos. O grupo começa fechado.

- [ ] **Step 1: Write the failing tests:**
  - **API, candidatos:** o militar sem disponibilidade, sem choque, vem em `semVoluntariado`. Quem não marcou e também tem choque **não** vem (Review Focus 3), nem quem não é voluntário JES numa vaga de PJES.
  - **API, alocação:** escalar o primeiro dá 201. Escalar o que tem choque dá 409 com "Choque de horário".
  - **Site:** "Mostrar" aparece só com `semVoluntariado` preenchida. Tocar mostra o grupo, e escolher alguém dele manda o mesmo pedido de escalar dos aptos.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** as suítes da API e do site, uma por vez. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.3: escalar quem não marcou voluntariado`.

### Task 26: Modo foco no celular

**Files:**
- Modify: `apps/web/src/routes/_app/voluntariado.tsx`, `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx` (com o `emCelular` que existe)

**Interfaces:**
- Consumes: `useEhCelular()` e `ProvedorDePendencias` (o `useBlocker` já pergunta antes de descartar ao navegar).
- Produces: no celular, conforme a spec, seção "Celular":
  - Sem `?militar=`, só a lista aparece, e nada abre sozinho.
  - Tocar num nome navega para `?militar=` (empilhando no histórico) e entra no modo foco: a lista some, a página vai ao topo, e o painel ganha "‹ Militares" no alto, que navega para a lista sem `militar`.
  - A barra de baixo fica fixa (`sticky bottom-0`), com o rodapé "N horas em M dias." e o botão **"Salvar"**.
  - Salvar grava e volta à lista.
- Produces: no computador, nada muda: lista e painel lado a lado, o primeiro que falta abre sozinho, e o botão continua "Salvar e ir para o próximo".

- [ ] **Step 1: Write the failing tests:**
  - **Celular:**
    - ao abrir `/voluntariado`, a lista aparece e não há calendário;
    - tocar em "DANTAS" mostra só o calendário dele e o botão "‹ Militares", sem a lista;
    - "Salvar" grava (o mesmo PUT) e a lista volta;
    - com uma marcação pendente, "‹ Militares" pergunta antes de descartar (Review Focus 5), e negar mantém o calendário.
  - **Computador:** os testes atuais continuam passando, e o primeiro que falta abre sozinho.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.3: modo foco do voluntariado no celular`.

### Task 27: Barra cinza ao arrastar, menores da revisão da 2.2 e testes da entrega 2 de volta

**Files:**
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`, `apps/web/src/lib/voluntariado.ts`, `apps/web/src/lib/useEhCelular.ts`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`, `apps/web/src/__testes__/voluntariado-regras.test.tsx`

**Interfaces:**
- **Barra cinza no dia 24.** Hipótese principal: é a seleção de texto do navegador ao arrastar com o mouse (cinza-azulado, sem as divisórias). A tela não lê feriados. Use superpowers:systematic-debugging. Se confirmar, o calendário ganha `select-none`; se não, registre a causa achada no ledger antes de corrigir. Teste: o grupo "Calendário do voluntariado" tem `select-none`. No PR, peça ao usuário para conferir na sandbox arrastando sobre um dia.
- **M1.** Arrastar com "desmarcar" sobre um bloco parcial tira o pedaço do bloco. Nova `tirarBloco(m: Marcas, dia: string, b: Faixa): Marcas` em `lib/voluntariado.ts`, usada por `alternarSe` quando a ação é desmarcar.
- **M2.** O último rótulo da régua é "00h", não "24h". O primeiro rótulo fica alinhado à esquerda e o último à direita, sem sair da borda.
- **M4.** O rodapé mostra os minutos quando houver: "7 horas e 30 minutos em 2 dias." (e "1 hora" no singular).
- **M5.** `useEhCelular` usa `addListener`/`removeListener` quando `addEventListener` não existe. O `emCelular` dos testes é restaurado num `afterEach`.
- **Testes da entrega 2 de volta** (achado I3 da revisão da 2.2), reescritos com `bloco(...)` e "Dia N: marcar o dia inteiro":
  - dois cliques em Salvar mandam um pedido só;
  - o erro da API mantém as marcações;
  - "Todos os militares deste mês foram lançados";
  - a pergunta de alteração pendente ao trocar de militar;
  - "Todos os sábados e domingos", "Dias de folga da equipe", "Copiar de <mês>" e "Copiar" desabilitado sem mês anterior;
  - setas, espaço e Enter;
  - "Limpar" e salvar vazio;
  - o foco vai para o dia 1 depois de salvar;
  - abrir sem `?militar=` lança o último que falta;
  - soltar o mouse logo depois de entrar no último dia.

- [ ] **Step 1: Write the failing tests** de M1, M2, M4, M5 e `select-none`. Os testes recolocados devem passar de primeira, porque o comportamento já existe. Para cada um, faça a mutação que o derruba (desligar a trava, apagar o foco no dia 1…) e registre no ledger.
- [ ] **Step 2: Run.** Expected: os novos falham, os recolocados passam.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel` (uma suíte por vez se a memória não deixar; registrar). Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.3: barra ao arrastar, menores da revisão da 2.2 e testes da entrega 2`.

**Fechamento da entrega 2.3:**
- Revisão final do branch por um Agent com `model: "opus"` e `effort: "medium"`. Passe o pacote (`review-package`), o plano, a spec, o Review Focus acima e os `Ruling:` do ledger.
- Uma passada de correções, com teste vermelho → verde.
- Atualizar as contagens no `CLAUDE.md` local.
- Push e PR com:
  - o que entrou;
  - **tem migração (0019)**, com o lembrete `pnpm --filter api db:migrar:teste`;
  - o que conferir:
    - em Configurações › Voluntariado, desligar a escala do CPRH e ver os blocos voltarem a quatro;
    - com flexibilidade 1, quem marcou 08–16 aparece no 07h–15h;
    - "Mostrar" no "Escolher militar";
    - no celular, tocar num nome, salvar e voltar à lista;
    - arrastar no computador sem a barra cinza.
- **Parar até o merge.**

---

# Entrega 2.4 — Acabamento do voluntariado e da escala do mês

**Branch:** `fase4-2-4-acabamento-do-voluntariado` (já criada a partir da `main` depois do merge do PR #35; os primeiros commits são o adendo do design e o mockup). **Sem migração.** Commits `Fase 4.2.4: …`; PR "Fase 4 — Entrega 2.4: acabamento do voluntariado e da escala do mês".

**Spec:** adendo "depois da entrega 2.3" em `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md` (blocos vazios, guia "Como marcar", número do dia, Escala do mês). **Mockup aprovado:** `docs/telas/mockup-entrega-2-4.html`.

**Execução (decisão do usuário):** **Sonnet, esforço high**, em linha (superpowers:executing-plans, ledger `.superpowers/sdd/2026-11-18-fase4-escala/progress.md`). A revisão final do branch é uma só, por um Agent com `model: "opus"` e `effort: "medium"` explícitos. Não trocar de modelo no meio da execução.

**Contagens de partida:** protótipo 589, contratos 14, motor 796 (+1 ignorado), API 593, site 390. Só o site muda nesta entrega.

**Ambiente desta máquina:** pouca memória. Rodar uma suíte por vez; o site com `cd apps/web && npx vitest run --maxWorkers=1`. Antes do typecheck e do build, conferir se não há `tsc`, `vitest` ou `vite` esquecidos rodando. Se um worker cair (134, `cannot allocate memory`), é ambiente: rodar de novo e registrar.

**Review Focus da entrega 2.4** (cada um tem teste na tarefa dona):

1. **Navegador sem armazenamento** (modo privado, `localStorage` lançando erro): o guia aparece, "Entendi" fecha na sessão e nada quebra. Tarefa 30.
2. **Blocos que o gestor mudou** (6 blocos, ou o dia num bloco só de 00h a 24h): o guia desenha os blocos reais, com "00h" no fim. Tarefa 30.
3. **Teclado no número do dia:** Tab chega na tecla; espaço e Enter continuam funcionando como antes (espaço marca o dia; Enter salva); o nome lido continua "Dia N: marcar o dia inteiro". Tarefa 29.
4. **Guarnição sozinha no turno e turno com muitas guarnições:** a sozinha ocupa a linha, com as funções em colunas; cinco guarnições quebram em linhas; turnos diferentes continuam um embaixo do outro. Tarefa 31.
5. **Celular:** a régua parada no topo, o guia e a barra fixa de baixo convivem; o guia some depois do "Entendi" e volta pelo "Como marcar". Tarefa 30.

### Task 28: Bloco vazio sempre branco

**Files:**
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx` (tirar `ehNoturno`, `data-noturno` e a classe `bg-noite`, que nunca existiu no tema)
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`

**Interfaces:**
- Produces: todo bloco vazio usa `bg-superficie`, em qualquer dia e horário. O fim de semana continua só no fundo da célula. Os blocos marcados (vinho) e parciais (listrados) não mudam.

- [ ] **Step 1: Write the failing test** que substitui o teste "a faixa das 20h às 24h do dia 5 é noturna (sombreada)…":
  - "bloco vazio é sempre branco, também à noite e no fim de semana": num dia útil e num sábado do mês do cenário, `bloco(n, '00h', '08h')` e `bloco(n, '20h', '24h')` têm a classe `bg-superficie`;
  - nenhum bloco do calendário tem o atributo `data-noturno`.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run src/__testes__/voluntariado.test.tsx --maxWorkers=1`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o mesmo arquivo. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.4: bloco vazio sempre branco`.

### Task 29: Número do dia com cara de botão

**Files:**
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`

**Interfaces:**
- Produces: o botão do número do dia é uma "tecla", **igual em qualquer estado** (decisão do usuário), como no mockup:
  - borda `border-input`, fundo `bg-superficie`, `rounded-md`, sombra embaixo `shadow-[0_1px_0_var(--color-input)]`;
  - no mouse, `hover:bg-accent`; ao apertar, `active:translate-y-px active:shadow-none`; anel de foco visível;
  - altura mínima de 28px no computador (`min-h-7 min-w-8`) e 40px no celular (`h-10`);
  - `title` "Marcar o dia inteiro" ou "Desmarcar o dia inteiro", conforme o `aria-label`, que não muda.

  No celular, o dia da semana continua dentro da tecla. O `justify-self-start` da 2.3 fica.

- [ ] **Step 1: Write the failing tests:**
  - "o número do dia tem cara de botão": a tecla do dia 5 tem as classes `border`, `bg-superficie`, `rounded-md` e `shadow-[0_1px_0_var(--color-input)]`, e o `title` "Marcar o dia inteiro";
  - "a tecla é igual em qualquer estado": depois de marcar o dia 5 inteiro, o `className` da tecla do dia 5 é igual ao da tecla do dia 6 (vazio), e o `title` vira "Desmarcar o dia inteiro";
  - "no celular, a tecla tem 40px": com `emCelular(true)`, a tecla tem a classe `h-10`.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL nos três.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o arquivo. Expected: passa (os testes de teclado da entrega 2, recolocados na 2.3, continuam passando: Review Focus 3).
- [ ] **Step 5: Commit** `Fase 4.2.4: número do dia com cara de botão`.

### Task 30: Guia "Como marcar" (e a régua só no celular)

**Files:**
- Create: `apps/web/src/componentes/voluntariado/GuiaComoMarcar.tsx`
- Modify: `apps/web/src/componentes/voluntariado/CalendarioDoVoluntariado.tsx`
- Test: `apps/web/src/__testes__/voluntariado.test.tsx`

**Interfaces:**
- Produces: `GuiaComoMarcar({ blocos, celular, aberto, aoFechar })`. É um dia de exemplo **desenhado, não clicável** (`aria-hidden` no desenho), com:
  - uma tecla "5" igual à do número do dia e uma faixa com os blocos reais em largura proporcional;
  - os horários dos cortes embaixo, com "00h" no fim e as pontas na borda (a mesma regra dos rótulos da 2.3);
  - duas frases: "{Clicar|Tocar} no número marca o dia inteiro." e "{Clicar|Tocar} num bloco marca só esse horário.";
  - uma dica: no computador, "Arraste com o mouse para marcar vários de uma vez. Passe o mouse num bloco para ver o horário."; no celular, "Deslizar o dedo rola a página e não marca nada.";
  - o título "Como marcar" e o botão "Entendi".
- Produces: no `CalendarioDoVoluntariado`:
  - o guia fica acima do calendário;
  - no cabeçalho, ao lado da equipe, um botão com aparência de link "Como marcar" reabre o guia;
  - o estado vem de `localStorage['voluntariado.guia'] === 'fechado'` (leitura e escrita em `try/catch`; sem armazenamento, o guia começa aberto e "Entendi" fecha só na sessão);
  - **no computador, a régua de rótulos do topo (`data-rotulos-dos-cortes`) sai**; no celular, ela fica como está.

- [ ] **Step 1: Write the failing tests:**
  - "no computador, a régua do topo saiu e o guia mostra os blocos com os horários": não há `[data-rotulos-dos-cortes]`; o guia (região "Como marcar") tem os horários `['00h', '08h', '16h', '20h', '00h']` e a frase "Clicar no número marca o dia inteiro.". Substitui o teste da legenda do computador da 2.3.
  - "'Entendi' fecha o guia, o navegador lembra, e 'Como marcar' abre de novo": depois de "Entendi", a região some; ao abrir a tela de novo (outro `abrir`), continua fechada; o botão "Como marcar" a mostra outra vez. Limpar o `localStorage` num `afterEach`.
  - "sem armazenamento, o guia aparece e fecha na sessão (Review Focus 1)": `vi.spyOn(Storage.prototype, 'getItem')` e `setItem` lançando erro; a tela abre, o guia aparece, "Entendi" fecha sem erro.
  - "o guia acompanha os blocos do gestor (Review Focus 2)": com `blocos` 00–08, 08–16 e 16–24, os horários do guia são `['00h', '08h', '16h', '00h']`; com o dia num bloco só (00:00–24:00), `['00h', '00h']`.
  - "no celular, a régua fica e o guia fala de toque (Review Focus 5)": com `emCelular(true)`, há `[data-rotulos-dos-cortes]`, o guia diz "Tocar no número marca o dia inteiro." e "Deslizar o dedo rola a página e não marca nada.", e a barra `[data-barra-de-salvar]` continua lá.
  - "o desenho do guia não é clicável e não entra no calendário": o grupo "Calendário do voluntariado" não contém botões do guia, e clicar no desenho não muda o rodapé.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o arquivo. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.4: guia "Como marcar" e régua só no celular`.

### Task 31: Escala do mês — a guarnição ocupa a linha e as funções ficam em colunas

**Files:**
- Modify: `apps/web/src/componentes/escala-do-mes/DiaDaEscala.tsx` (grade dos cards do turno)
- Modify: `apps/web/src/componentes/escala-do-mes/CardDaGuarnicao.tsx` (lista das funções)
- Test: `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Produces: a grade de cards do turno troca `sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` por `grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]`. Com uma guarnição só, o card estica e ocupa a linha; com várias, elas se distribuem pela largura do painel e quebram em linhas. Marque a grade com `data-cards-do-turno`.
- Produces: a lista de funções do card (`<ul>` de primeiro nível) troca `grid gap-2` por `grid gap-x-4 gap-y-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]`, para que as funções fiquem lado a lado quando o card é largo. Marque a lista com `data-funcoes`.
- Turnos diferentes continuam um embaixo do outro (decisão do usuário).

- [ ] **Step 1: Write the failing tests** (o jsdom não calcula layout; os testes fixam a regra das colunas, e a conferência visual fica para o usuário na sandbox):
  - "os cards do turno esticam para ocupar a linha, em qualquer escala": a grade `[data-cards-do-turno]` do dia 2 tem a classe `grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]` e não tem `sm:grid-cols-2`;
  - "dentro do card, as funções ficam em colunas quando cabem": a lista `[data-funcoes]` do card ABT tem `grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]`;
  - "turnos diferentes continuam um embaixo do outro": o contêiner das faixas do dia continua `grid` de uma coluna (sem `grid-cols-` de várias colunas).
- [ ] **Step 2: Run** `cd apps/web && npx vitest run src/__testes__/escala-do-mes.test.tsx --maxWorkers=1`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`, uma suíte por vez se a memória não deixar, e registrar. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.2.4: guarnição ocupa a linha na escala do mês`.

**Fechamento da entrega 2.4:**
- Revisão final do branch por um Agent com `model: "opus"` e `effort: "medium"`. Passe o pacote (`review-package`), o plano, a spec, o mockup, o Review Focus acima e os `Ruling:` do ledger.
- Uma passada de correções, com teste vermelho → verde.
- Atualizar as contagens no `CLAUDE.md` local.
- Push e PR com:
  - o que entrou;
  - **sem migração**;
  - o que conferir na sandbox:
    - fins de semana com os quatro blocos brancos;
    - o número do dia com cara de tecla;
    - o guia "Como marcar" ("Entendi" fecha e "Como marcar" reabre), no computador e no celular;
    - a escala Bioma com o card ocupando a linha e Motorista, Chefe e Combatente lado a lado numa tela larga.
- **Parar até o merge.**

---

# Entrega 3 — Pré-escala e distribuições (dividida em 3.1, 3.2 e 3.3)

Decisão do usuário (19/11/2026): a entrega 3 sai em duas, cada uma com o seu PR. A 3.1 é validada na sandbox antes de a 3.2 começar. **Em 20/11/2026** entrou uma nova 3.2 (meta de ativação e Efetivo do dia), e a 3.2 descrita abaixo passou a ser a **3.3**.

- **3.1 — Pré-escala do Pronto:** a equipe do dia 1 (detectada pelo mês anterior, com escolha manual), o preenchimento das vagas pela ordem de escala (o mais antigo apto em cada vaga), a prévia do que entra e do que fica de fora, e a gravação. Gerar de novo só completa lacunas e respeita as remoções.
- **3.2 — Meta de ativação e Efetivo do dia** (nova, 20/11/2026): em 3.2.1 e 3.2.2, seção própria abaixo.
- **3.3 — Efetivo por dia, turnos lado a lado e login novo** (refeita em 20/11/2026, depois da 3.2.2): o Efetivo por dia refeito (linha do tempo, escalar nele, meta implícita), a disposição da Escala do mês com os turnos lado a lado (pendência da 2.4) e a tela de login nova. Buracos (JES e Saldo), saldos do Adm e operações pelas cotas **saíram da 3.3** e esperam entrega marcada (decisão do usuário). **As regras de negócio da 3.2 ainda dependem do usuário** (lista no fim desta seção); ela é detalhada depois do merge da 3.1, com as respostas.

**Spec:**
- `docs/superpowers/specs/2026-11-16-migracao-design.md`, adendo de 17/11 "Pré-escala automática e ajustes do escalante": gerar de novo nunca sobrescreve; o removido não volta, mas outro militar pode ocupar a vaga.
- `docs/superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md`, Parte 1, "Quem vai em cada vaga":
  - a pré-escala segue a ordem à risca e, na vez de cada vaga, põe o mais antigo apto;
  - quando falta gente, sobram vazias as últimas vagas;
  - numa faixa, valem só as vagas das guarnições presentes nela;
  - as vagas sem número vêm depois das numeradas.
- `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`, adendo "depois da entrega 2.4": a disposição da Escala do mês (3.2).
- `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`, Fase 4.

**Execução (as duas subentregas):** **Sonnet, esforço high**, em linha (superpowers:executing-plans, ledger `.superpowers/sdd/2026-11-18-fase4-escala/progress.md`). A revisão final de cada branch é uma só, por um Agent com `model: "opus"` e `effort: "medium"` explícitos. Não trocar de modelo no meio da execução.

**Ambiente desta máquina:** pouca memória. Rodar uma suíte por vez:
- API: `cd apps/api && npx vitest run --maxWorkers=1`;
- site: `cd apps/web && npx vitest run --maxWorkers=1`.

Se um worker cair (código 134, `scrypt derivation failed`, `cannot allocate memory`), é ambiente: rodar o arquivo sozinho de novo e registrar. Antes do typecheck e do build, conferir se não há `tsc`, `vitest` ou `vite` esquecidos rodando. Depois de mudar exports do `dominio`, rodar `pnpm --filter dominio tipos` (as declarações são ignoradas pelo Git).

**Contagens de partida:** protótipo 589, contratos 14, motor 796 (+1 ignorado), API 593, site 402.

---

# Entrega 3.1 — Pré-escala do Pronto

**Branch:** `fase4-3-1-pre-escala-do-pronto`. Os primeiros commits são a pendência da Escala do mês e este plano. **Sem migração:** `alocacao.origem` já aceita `'pre_escala'`. Commits `Fase 4.3.1: …`; PR "Fase 4 — Entrega 3.1: pré-escala do Pronto".

**Decisões desta entrega** (chamadas da PROGRAMAÇÃO; o usuário revisa no plano):
- **Toda a equipe do dia entra no Pronto A e B**, como no protótipo: o Pronto é o serviço ordinário da equipe. As vagas das guarnições de cada turno são preenchidas na ordem de escala, com o mais antigo apto. Quem da equipe não couber em nenhuma vaga entra no Pronto **sem guarnição** (a linha "Sem guarnição" da Escala do mês já existe).
- **O Pronto é o serviço `ordinario` da escala chamado "Pronto"**, comparado sem caixa nem acento, e seus turnos A e B, como no motor (`PRE_ESCALA`). Uma escala sem esse serviço recebe a prévia vazia, com um aviso.
- **A equipe do dia é a do ciclo** (`equipe.ordem_ciclo` de 1 a 4, igual a ALFA, BRAVO, CHARLIE e DELTA do motor). O dia 1 é detectado pelo mês anterior (`detectarEquipeInicial`). Quando não dá para detectar (mês anterior vazio ou empate), o escalante escolhe. Ele também pode trocar a equipe detectada.
- **Prévia antes de gravar:** a prévia só calcula. A gravação calcula de novo, na mesma transação e com trava, porque a escala pode ter mudado entre as duas.
- **Pendências do motor:** `turnosPadraoExigidos` não é mais usado desde a 2.2 (o voluntariado é por faixa). Os nomes deixam de ser comparados ora normalizados ora exatos porque a tradução trabalha com ids. As duas ficam registradas como resolvidas, sem código.

**Review Focus da entrega 3.1** (cada um tem teste na tarefa dona):

1. **Gerar de novo.** Não duplica, não tira ninguém e não devolve o removido (outro militar pode ocupar a vaga dele). As vagas já ocupadas à mão ficam como estão. Tarefas 33 e 34.
2. **Equipe do dia 1 que não dá para detectar** (mês anterior sem Pronto, ou empate). A prévia vem sem equipe e com o motivo; a tela exige a escolha; gravar sem equipe dá 400. Tarefas 33, 34 e 35.
3. **Militar afastado, transferido ou desativado no meio do mês.** Fica de fora só nos dias em que não pode; nos outros dias a equipe dele entra normalmente. Tarefa 33.
4. **Vaga com CNH exigida.** O mais antigo sem a CNH é pulado nessa vaga e vai para a vaga seguinte ou para "Sem guarnição". Tarefas 32 e 33.
5. **Mais vagas que gente, e mais gente que vagas.** No primeiro caso sobram vazias as últimas da ordem; no segundo sobram militares "Sem guarnição", e a antiguidade decide quem fica com vaga. Uma faixa só considera as guarnições vinculadas a ela. Tarefas 32 e 33.

### Task 32: Preencher as vagas na ordem (motor)

**Files:**
- Create: `pacotes/dominio/src/preencher-vagas.ts` (exportar em `src/index.ts`)
- Test: `pacotes/dominio/test/preencher-vagas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type VagaParaPreencher = { chave: string; cnhExigida: string | null };
  export type CandidatoDaVaga = { id: string; cnh: string[] };
  export function preencherVagas(vagas: VagaParaPreencher[], candidatos: CandidatoDaVaga[]):
    { atribuicoes: { chave: string; id: string }[]; semVaga: string[]; vazias: string[] };
  ```
  - `vagas` chega **na ordem de preenchimento** e já sem as ocupadas.
  - `candidatos` chega **do mais antigo para o mais novo** e já sem os que não podem no turno.
  - Na vez de cada vaga, a função põe o primeiro candidato ainda livre que tenha a CNH exigida (`cnhHabilitadas`, hierarquia do CTB). Sem ninguém assim, a vaga vai para `vazias`.
  - Um candidato ocupa no máximo uma vaga. Quem sobra vai para `semVaga`, na ordem de antiguidade.
  - É regra só do sistema novo: testa em `pacotes/dominio/test`, sem caso gravado.

- [ ] **Step 1: Write the failing tests:**
  - 3 vagas sem CNH e 2 candidatos: os dois primeiros ficam com os candidatos, na ordem (o mais antigo na 1ª vaga); a 3ª vai para `vazias`; `semVaga` fica vazio.
  - 2 vagas e 4 candidatos: o 3º e o 4º vão para `semVaga`, nessa ordem.
  - CNH: a 1ª vaga exige `D`, o 1º candidato tem `['B']` e o 2º tem `['E']`. A 1ª vaga fica com o 2º (E habilita D); o 1º fica com a 2ª vaga (sem CNH).
  - CNH `A` é isolada: candidato com `['E']` não serve para vaga que exige `A`.
  - Lista vazia de vagas: todos os candidatos vão para `semVaga`. Lista vazia de candidatos: todas as vagas vão para `vazias`.
- [ ] **Step 2: Run** `pnpm --filter dominio test`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter dominio test && node casos/reproduzir-prototipo.mjs`. Expected: passa, e os casos continuam ok.
- [ ] **Step 5: Commit** `Fase 4.3.1: preencher as vagas na ordem (motor)`.

### Task 33: A prévia da pré-escala do Pronto (API)

**Files:**
- Create: `apps/api/src/escala/pre-escala.ts`
- Modify: `apps/api/src/escala/elegibilidade.ts` (exportar `avaliar` como `avaliarFaixa`, sem mudar o que faz)
- Create: `pacotes/contratos/src/pre-escala.ts` (exportar em `index.ts`)
- Test: `apps/api/test/pre-escala.test.ts`

**Interfaces:**
- Consumes:
  - `preencherVagas` (Tarefa 32);
  - `avaliarFaixa(c, vaga, somenteMilitar?)` (elegibilidade), com a vaga `{ escalaId, data, inicio, fim, guarnicaoId: null, funcaoId: null }`;
  - `ordemDoMes` e `sequenciaDePreenchimento` (ordem de escala);
  - `vinculosDaEscala` e `versoesDasGuarnicoes`;
  - `detectarEquipeInicial`, `equipeDoDia` e `CICLO_EQUIPES` (motor);
  - `compararAntiguidade` (via `porAntiguidade` de `elegibilidade.ts`).
- Produces (contratos):
  ```ts
  export type PreviaDaPreEscala = {
    mes: string;
    equipes: { id: string; nome: string }[];            // as do ciclo, por ordem_ciclo
    equipeDetectada: { equipeId: string | null; motivo: string };  // motivo '' quando detectou
    equipeUsada: { id: string; nome: string } | null;    // a escolhida ou, sem escolha, a detectada
    entram: number;                                     // serviços de Pronto que a gravação criaria
    vazias: { data: string; faixa: string; vaga: string }[];          // ex.: "08h–20h", "Motorista ABT"
    semGuarnicao: { data: string; faixa: string; nomeGuerra: string }[];
    removidosQueNaoVoltam: number;
    avisos: string[];
  };
  export const NovaPreEscala = z.object({ equipeDia1Id: Id });
  ```
- Produces (API):
  - `equipeDoDia1(c, unidadeId, mes): Promise<{ equipeId: string | null; motivo: string }>`. Traduz o Pronto turno A do mês anterior e as equipes por `ordem_ciclo` para o `detectarEquipeInicial`, e devolve a equipe cadastrada.
  - `planejarPreEscala(c, escalaId, mes, equipeDia1Id: string | null): Promise<{ previa: PreviaDaPreEscala; novas: AlocacaoPlanejada[] }>`, onde `AlocacaoPlanejada = { militarId, data, servicoId, turnoId, guarnicaoId: string | null, funcaoId: string | null }`.

  Para cada dia do mês, a equipe do dia é `equipeDoDia(equipeDia1, i)`. Para cada turno A e B do Pronto:
  - **Vagas:** as da ordem do mês (`sequenciaDePreenchimento`), só das guarnições vinculadas àquela faixa no vínculo vigente. Saem as já ocupadas: as primeiras `n` vagas de cada guarnição e função, onde `n` são os ocupantes, contando acúmulos (a mesma conta de `ocupantesDaFuncao`).
  - **Candidatos:** os militares da equipe do dia (`jornada = 'pronto'`) com `militarMotivo === null` e motivo `null` no turno do Pronto, em `avaliarFaixa`. Saem os removidos daquele dia, serviço e turno. A ordem é de antiguidade.
  - O resultado de `preencherVagas` vira as `novas`: atribuições com guarnição e função; `semVaga` com as duas nulas.

- [ ] **Step 1: Write the failing tests** (cenário fictício, D7: seção com 4 equipes; Pronto A 08–20 e B 20–08; guarnições ABT com Motorista CNH D 1–1 e Combatente 1–2, e AR com Chefe 1–1, vinculadas às duas faixas; ordem cadastrada Motorista ABT → Chefe AR → Combatente ABT 1 → Combatente ABT 2; equipe ALFA com 3 militares, um deles com CNH E):
  - **Equipe do dia 1 detectada:** com o mês anterior tendo Pronto A da BRAVO nos últimos dias, de modo que o dia 1 do mês seja da CHARLIE, `equipeDoDia1` devolve a CHARLIE. Sem alocações no mês anterior, devolve `equipeId: null` e o motivo `'sem Pronto turno A no mês anterior'` (Review Focus 2).
  - **Ordem e antiguidade:** num dia da ALFA, a vaga de Motorista ABT fica com o militar de CNH E, mesmo que ele não seja o mais antigo. O mais antigo fica com o Chefe AR e o terceiro com o Combatente ABT 1. O Combatente ABT 2 vai para `vazias` como "Combatente ABT", com a faixa "08h–20h" (Review Focus 4 e 5).
  - **Mais gente que vagas:** com 5 militares na equipe, os 2 mais novos aparecem em `semGuarnicao` nas duas faixas, e `entram` conta as duas faixas dos 5 (Review Focus 5).
  - **Faixa só com as guarnições dela:** com a AR vinculada só ao turno A, no turno B não há vaga de Chefe AR.
  - **Afastado:** um militar da ALFA afastado do dia 8 ao 12 não aparece nesses dias e aparece nos outros dias da ALFA (Review Focus 3).
  - **Gerar de novo e removidos:**
    - com um militar já escalado à mão no Combatente ABT 1 de um dia, a prévia não mexe nele e não usa aquela vaga;
    - com uma remoção de um militar da ALFA num dia e turno do Pronto, ele não aparece naquele dia e turno, outro ocupa a vaga, e `removidosQueNaoVoltam` conta 1 (Review Focus 1).
  - **Sem Pronto:** uma escala sem o serviço "Pronto" devolve `entram: 0` e o aviso "Esta escala não tem o serviço Pronto: não há o que gerar."
- [ ] **Step 2: Run** `cd apps/api && npx vitest run test/pre-escala.test.ts --maxWorkers=1`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o arquivo novo e `test/escala-candidatos.test.ts` (o `avaliar` só mudou de nome). Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.3.1: prévia da pré-escala do Pronto`.

### Task 34: Rotas da prévia e da gravação

**Files:**
- Modify: `apps/api/src/escala/rotas.ts`, `apps/api/src/escala/pre-escala.ts`
- Test: `apps/api/test/pre-escala.test.ts`

**Interfaces:**
- Consumes: `planejarPreEscala` e `equipeDoDia1` (Tarefa 33); `montarEscalaDoMes` (leitura).
- Produces:
  - `GET /api/escalas/:id/mes/:mes/pre-escala?equipe=<equipeId>` devolve `PreviaDaPreEscala`. Sem `equipe`, usa a detectada; quando não há detectada, `equipeUsada: null`, `entram: 0` e o aviso "Escolha a equipe do dia 1."
  - `POST /api/escalas/:id/mes/:mes/pre-escala` com corpo `NovaPreEscala` devolve `{ escala: EscalaDoMes; gravadas: number }`. Dentro de `comUsuario`:
    - trava a escala e o mês (`pg_advisory_xact_lock(hashtext('pre-escala|<escalaId>|<mes>'))`);
    - chama `planejarPreEscala` de novo;
    - insere as `novas` com `origem = 'pre_escala'` e `on conflict do nothing`.
  - Papéis em `CADASTRO`. Mês inválido dá 400; equipe que não é do ciclo da unidade dá 400 com o campo `equipeDia1Id`; quem não tem papel recebe 403.

- [ ] **Step 1: Write the failing tests:**
  - A prévia pela rota devolve o mesmo resumo da Tarefa 33.
  - Gravar cria as alocações com `origem = 'pre_escala'`, e a Escala do mês devolvida mostra os ocupantes nas vagas e a linha "Sem guarnição".
  - **Gravar duas vezes** (Review Focus 1): a segunda chamada devolve `gravadas: 0`, e o número de alocações não muda.
  - **Gravar ao mesmo tempo:** duas gravações em paralelo (`Promise.all`) somam as alocações de uma só, nunca 500.
  - Sem `equipeDia1Id` dá 400; com uma equipe de outra unidade dá 400 (Review Focus 2); o militar comum recebe 403.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd apps/api && npx vitest run --maxWorkers=1`. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.3.1: gravar a pré-escala do Pronto`.

### Task 35: "Gerar pré-escala" na Escala do mês (site)

**Files:**
- Create: `apps/web/src/componentes/escala-do-mes/GerarPreEscala.tsx`
- Modify: `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/api/escala-do-mes.ts`
- Test: `apps/web/src/__testes__/pre-escala.test.tsx`

**Interfaces:**
- Consumes: as rotas da Tarefa 34.
- Produces:
  - No topo da Escala do mês, ao lado de "Mostrar só vagas vazias", o botão **"Gerar pré-escala"** abre um diálogo com:
    - **"Equipe do dia 1"**, uma seleção com as equipes do ciclo, já com a detectada. Abaixo, a frase "Pelo mês anterior, o dia 1 é da equipe Bravo." ou, sem detecção, "Não deu para saber pelo mês anterior (<motivo>). Escolha a equipe do dia 1."
    - **O resumo da prévia**, refeito ao trocar a equipe: "Entram N serviços de Pronto." e "Ficam V vagas vazias e S militares sem guarnição." Quando houver, "R removidos não voltam."
    - **"Ver o que ficou de fora"**, uma lista recolhível com as vagas vazias e quem ficou sem guarnição, por dia e faixa.
    - Os avisos.
    - **"Gravar pré-escala"**, desabilitado sem equipe e com `useTrava` (dois cliques fazem um pedido só).
  - Gravar fecha o diálogo, atualiza a Escala do mês (as consultas que dependem dela) e mostra "Pré-escala gravada: N serviços."
  - Erro da API aparece no diálogo, e o diálogo fica aberto.

- [ ] **Step 1: Write the failing tests:**
  - O diálogo abre com a equipe detectada e o resumo.
  - Sem detecção: aparece a frase com o motivo, e "Gravar" fica desabilitado até escolher (Review Focus 2).
  - Trocar a equipe refaz a prévia com `?equipe=`.
  - "Gravar" manda `{ equipeDia1Id }`, fecha o diálogo e mostra "Pré-escala gravada: N serviços.".
  - Dois cliques em "Gravar" mandam um pedido só.
  - O erro 400 aparece no diálogo.
  - "Ver o que ficou de fora" lista as vagas vazias e os sem guarnição.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm build:vercel`, uma suíte por vez se a memória não deixar, e registrar. Expected: passa.
- [ ] **Step 5: Commit** `Fase 4.3.1: gerar a pré-escala na tela`.

**Fechamento da entrega 3.1:**
- Revisão final do branch por um Agent com `model: "opus"` e `effort: "medium"`. Passe o pacote, o plano, as specs, o Review Focus acima e os `Ruling:` do ledger.
- Uma passada de correções, com teste vermelho → verde.
- Atualizar as contagens no `CLAUDE.md` local.
- Push e PR com:
  - **sem migração**;
  - as decisões desta entrega para o usuário confirmar;
  - o que conferir na sandbox:
    - gerar a pré-escala do Ordinário de dezembro;
    - conferir a equipe do dia 1;
    - ver as vagas vazias e os sem guarnição;
    - gerar de novo e ver que nada muda;
    - remover um militar, gerar de novo e ver que ele não volta.
- **Parar até o merge.**

---

# Entrega 3.2 — Meta de ativação e Efetivo do dia

Decisão do usuário (20/11/2026). Sai em duas subentregas, cada uma com o seu branch e PR, a partir da `main` atualizada. A 3.2.2 começa depois do merge da 3.2.1.

- **3.2.1 — Arrumação** (Tarefas 36 a 40): serviços fixos, "ordem de escalação", modelos de guarnição em Configurações e a cota sem "conta para a meta".
- **3.2.2 — Meta e Efetivo do dia** (Tarefas 41 a 45): a regra de ativação por horário coberto, a meta (padrão e dias diferentes), o painel Efetivo do dia e as cotas restantes.

**Spec:** `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md` (vocabulário, decisões e "minhas decisões" marcadas). O roadmap e as decisões de 20/11 estão em `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`, Fase 4.

**Execução (as duas subentregas):** **Sonnet, esforço high**, em linha (superpowers:executing-plans, o mesmo ledger `.superpowers/sdd/2026-11-18-fase4-escala/progress.md`). A revisão final de cada branch é uma só, por um Agent com `model: "opus"` e `effort: "medium"` explícitos. Não trocar de modelo no meio da execução. O ambiente e os comandos são os da entrega 3 (uma suíte por vez, `--maxWorkers=1`, `pnpm --filter dominio tipos` depois de mudar exports do motor).

**Contagens de partida:** protótipo 589, contratos 14, motor 802 (+1 ignorado), API 613, site 411.

**Copy fixa (vale nas duas):** "Modelos de guarnição", "Novo modelo", "Ordem de escalação", "Meta de ativação", "Efetivo do dia", "ativada", "não ativada", "Alterar a meta deste dia", "Voltar ao padrão", "Abrir na Escala do mês", "Sem horário vinculado neste dia", e as cotas como "JES: restam 26 de 40".

---

## Entrega 3.2.1 — Arrumação

**Branch:** `fase4-3-2-1-arrumacao`, a partir da `main` atualizada (com a 3.1). O primeiro commit leva os documentos de 20/11 (design, roadmap e este plano). Commits `Fase 4.3.2.1: …`; PR "Fase 4 — Entrega 3.2.1: arrumação para a meta de ativação". **Migrações 0020 e 0021:** o PR avisa `pnpm --filter api db:migrar:teste`.

**Decisões desta entrega** (chamadas da PROGRAMAÇÃO, já no design):
- **Serviço fixo é reconhecido pelo nome**, sem caixa e sem espaços nas pontas: `pronto`, `saldo` e `expediente` (tipo ordinário) e `jes` (tipo PJES). Uma trava no banco marca `fixo` ao gravar e recusa mudar nome, tipo ou situação de um fixo. A API responde antes, com a frase legível.
- **"O sistema cria"** = a migração cria os que faltam em cada seção que já tem algum serviço (a sandbox). Hoje nenhuma tela cria seção. Uma seção sem serviço nenhum (a base dos testes) não recebe nada, e a carga de exemplo continua criando os seus. Os criados vêm com os turnos e as cores da carga de exemplo: Pronto, Saldo e JES com A 08–20 e B 20–08, e Expediente com A 08–16. As cores vêm de `CORES_SERVICO`.
- **Fixo desativado volta a ficar ativo** na migração, porque depois ninguém poderia reativá-lo.
- **Ordem de escalação:** muda na tela, nos nomes do código e nos nomes de arquivo. As tabelas do banco (`ordem_escala_*`) e o endereço `/escalas/:id/ordem` ficam como estão.
- **Modelos de guarnição:** a lista vira uma aba de Configurações (`/configuracoes?aba=modelos`), e a ficha fica em `/configuracoes/modelos-de-guarnicao/:id`. `/guarnicoes` e `/guarnicoes/:id` redirecionam para lá. A coluna "Guarnições" da matriz de Escalas não muda.

**Review Focus da 3.2.1** (cada um tem teste na tarefa dona):
1. **Base com "pronto " (caixa e espaço diferentes).** O serviço é marcado como fixo, sem criar um "Pronto" duplicado. Tarefa 36.
2. **Base com um fixo de tipo errado** (ex.: JES ordinário). A migração para com a frase "Há serviço fixo com o tipo errado: JES (ordinario). Corrija o tipo antes de migrar." Tarefa 36.
3. **Importação da planilha tentando mudar o tipo de um fixo.** A prévia aponta o problema na linha, e nada é gravado. Tarefa 36.
4. **Endereço antigo da guarnição** (favorito ou link da matriz de Escalas). Abre a ficha do modelo. Tarefa 39.
5. **Cliente antigo que ainda manda `contaMeta`.** A cota é gravada (o campo é ignorado) e a lista não mostra mais "não conta para a meta". Tarefa 40.

### Task 36: Serviços fixos no banco e na API

**Files:**
- Create: `apps/api/banco/migracoes/0020_servicos_fixos.sql`
- Modify: `pacotes/contratos/src/servicos.ts` (`Servico.fixo: boolean`), `apps/api/src/cadastros/servicos.ts`, `apps/api/src/importacao/servicos-escalas.ts`
- Test: `apps/api/test/migracao-0020.test.ts`, `apps/api/test/servicos.test.ts`, `apps/api/test/importacao-servicos-escalas.test.ts`

**Interfaces:**
- Produces: `servico.fixo boolean not null`; `Servico.fixo` em toda leitura de serviço; `SERVICOS_FIXOS` em `pacotes/contratos/src/servicos.ts`:
  ```ts
  export const SERVICOS_FIXOS: Record<string, TipoServico> = { pronto: 'ordinario', saldo: 'ordinario', expediente: 'ordinario', jes: 'pjes' };
  export function tipoDoServicoFixo(nome: string): TipoServico | null; // nome.trim().toLowerCase()
  ```
- Migração (ordem): (1) `do $$` que para com a frase do Review Focus 2 se houver um fixo de tipo errado; (2) `add column fixo`; (3) marca os existentes e reativa os desativados; (4) cria os que faltam (com turnos) nas seções que já têm algum serviço; (5) função e gatilho `before insert or update on servico` que define `fixo` pelo nome e recusa com `raise exception`: tipo errado num nome fixo ("O serviço % é fixo e precisa ser do tipo %."), e mudar nome, tipo ou `ativo = false` de um fixo ("O serviço % é fixo: o nome, o tipo e a situação não mudam.").

- [ ] **Step 1: Write the failing tests:**
  - `migracao-0020`, no padrão de `migracao-0019.test.ts` (migrar até `0020`, montar o cenário e migrar o resto). Na 1ª SB, `pronto ` (ordinário, desativado) e `Bioma` (diária); numa segunda seção fictícia, nenhum serviço. Depois da migração:
    - `pronto ` fica `fixo = true` e ativo, e não há outro Pronto;
    - existem `Saldo`, `JES` e `Expediente` fixos, com os turnos da decisão (ex.: Expediente com um turno A 08:00–16:00);
    - `Bioma` fica `fixo = false`;
    - a segunda seção continua sem serviços;
    - inserir `JES` do tipo `ordinario` numa seção falha com "precisa ser do tipo pjes";
    - um cenário à parte com JES ordinário antes da migração faz a migração falhar com "Há serviço fixo com o tipo errado".
  - `servicos.test.ts`:
    - `GET` devolve `fixo: true` para Pronto e `false` para Bioma;
    - `PATCH` mudando o nome (inclusive só a caixa) ou o tipo de um fixo dá 409 com "é fixo";
    - `PATCH` mudando só a cor e o rótulo de um fixo dá 200;
    - turno de um fixo pode ser criado, editado e removido (200);
    - `POST /servicos/:id/situacao {ativo:false}` num fixo dá 409 "O serviço \"Pronto\" é fixo e não pode ser desativado.";
    - `POST` de `jes` com tipo ordinário dá 409 "O serviço \"jes\" é fixo e precisa ser do tipo PJES.".
  - `importacao-servicos-escalas.test.ts`: uma planilha com JES como ordinário, sobre uma base com JES (PJES), dá um problema nessa linha ("O serviço JES é fixo: o tipo não muda."), e aplicar não muda o tipo.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/migracao-0020.test.ts test/servicos.test.ts test/importacao-servicos-escalas.test.ts`. Expected: FAIL (coluna e regras inexistentes).
- [ ] **Step 3: Implement** a migração, as respostas da API (antes do banco, com as frases acima) e o problema na prévia da importação (onde ela decide `mudarDados`).
- [ ] **Step 4: Run** os mesmos testes. Expected: PASS. Depois, a suíte inteira da API em segundo plano (`--no-file-parallelism`). Testes antigos que renomeiam ou desativam "Pronto", "JES", "Saldo" ou "Expediente", ou que os criam com o tipo errado, passam a usar um nome livre (ex.: "Plantão"), com `Ruling:` no ledger.
- [ ] **Step 5: Commit** `Fase 4.3.2.1: serviços fixos no banco e na API`.

### Task 37: Serviços fixos na tela

**Files:**
- Modify: `apps/web/src/routes/_app/servicos/$id.tsx`, `apps/web/src/routes/_app/servicos.tsx` (item da lista)
- Test: `apps/web/src/__testes__/servicos.test.tsx` (o ajudante `servico()` ganha `fixo: false`)

**Interfaces:** Consumes `Servico.fixo` (Tarefa 36).

- [ ] **Step 1: Write the failing tests:**
  - na ficha de um serviço com `fixo: true`, os campos "Nome" e "Tipo" estão desabilitados, aparece "Serviço fixo do sistema: o nome e o tipo não mudam.", e não há botão "Desativar";
  - na lista, o item fixo mostra a marca "fixo";
  - num serviço com `fixo: false`, tudo segue como antes.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/servicos.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Cor, rótulo, operação e turnos seguem editáveis.
- [ ] **Step 4: Run** o mesmo arquivo. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.1: serviços fixos na tela`.

### Task 38: "Ordem de escala" vira "ordem de escalação"

**Files:**
- Rename: `pacotes/contratos/src/ordem-de-escala.ts` → `ordem-de-escalacao.ts`, `apps/web/src/api/ordem-de-escala.ts` → `ordem-de-escalacao.ts`, `apps/web/src/__testes__/ordem-de-escala.test.tsx` → `ordem-de-escalacao.test.tsx`, `apps/api/test/ordem-de-escala.test.ts` → `ordem-de-escalacao.test.ts`, `apps/api/test/ordem-de-escala-regras.test.ts` → `ordem-de-escalacao-regras.test.ts`
- Modify: os arquivos listados por `grep -rln "rdem de escala\|rdemDeEscala\|ordem-de-escala" apps/api/src apps/web/src pacotes` (14 hoje)

**Interfaces:** Produces `OrdemDeEscalacao`, `OrdemDeEscalacaoEntrada`, `consultaOrdemDeEscalacao`, `gravarOrdemDeEscalacao`, `atualizarOrdemDeEscalacao` (os antigos `…OrdemDeEscala…` deixam de existir).

- [ ] **Step 1: Write the failing test:** em `ordem-de-escala.test.tsx`, trocar as expectativas de texto para "Ordem de escalação" (título da tela, link na ficha da escala e na Escala do mês).
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/ordem-de-escala.test.tsx`. Expected: FAIL nos textos.
- [ ] **Step 3: Implement** a troca de textos, nomes e arquivos (inclusive comentários). Ficam de fora as migrações antigas, os nomes de tabela e a URL `/ordem`.
- [ ] **Step 4: Run:**
  - `grep -rnE "rdem de escala([^çc]|$)|rdemDeEscala([^c]|$)|ordem-de-escala([^c]|$)" apps/api/src apps/web/src apps/api/test pacotes/*/src pacotes/*/test` → nada;
  - `pnpm typecheck`;
  - as suítes de contratos, site e API (uma por vez).

  Expected: tudo passa.
- [ ] **Step 5: Commit** `Fase 4.3.2.1: ordem de escalação`.

### Task 39: Modelos de guarnição em Configurações

**Files:**
- Create: `apps/web/src/routes/_app/configuracoes_.modelos-de-guarnicao.$id.tsx` (o conteúdo de `guarnicoes/$id.tsx`, com `voltarPara` em `/configuracoes?aba=modelos`), `apps/web/src/componentes/guarnicoes/ListaDeModelos.tsx` (a lista, "Novo modelo" e "Importar da planilha", vindos de `guarnicoes.tsx`)
- Modify: `apps/web/src/routes/_app/configuracoes.tsx` (`validateSearch` com `aba?: string`, aba controlada, nova aba "Modelos de guarnição" com `value="modelos"`), `apps/web/src/componentes/Trilho.tsx` (sai o item "Guarnições"), `apps/web/src/componentes/escalas/Matriz.tsx` (link novo), `apps/web/src/routes/_app/guarnicoes.tsx` e `guarnicoes/$id.tsx` (viram só `beforeLoad: redirect`), `apps/web/src/routeTree.gen.ts` (regerado pelo plugin do router)
- Delete: `apps/web/src/routes/_app/guarnicoes/index.tsx`
- Test: `apps/web/src/__testes__/guarnicoes.test.tsx` e os demais que abrem `/guarnicoes`

**Interfaces:** Produces as rotas `/configuracoes?aba=modelos` e `/configuracoes/modelos-de-guarnicao/$id`.

- [ ] **Step 1: Write the failing tests:**
  - `abrir('/configuracoes?aba=modelos')` mostra a lista ("N modelos", botão "Novo modelo");
  - clicar num modelo abre a ficha em `/configuracoes/modelos-de-guarnicao/:id` com a composição;
  - "Voltar" volta para a aba;
  - `abrir('/guarnicoes/g1')` termina na ficha nova;
  - o trilho não tem "Guarnições";
  - criar um modelo navega para a ficha nova.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/guarnicoes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Os textos trocam "guarnição" por "modelo" na lista e no diálogo: "Nome do modelo", "Nenhum modelo de guarnição. Use \"Novo modelo\" ou \"Importar da planilha\"." e "Escolha um modelo na lista para ver a composição." (este, se a tela ainda mostrar).
- [ ] **Step 4: Run** a suíte do site e `pnpm --filter web typecheck`. Expected: PASS (atualizar os testes que abriam `/guarnicoes`).
- [ ] **Step 5: Commit** `Fase 4.3.2.1: modelos de guarnição em Configurações`.

### Task 40: Cota sem "conta para a meta"

**Files:**
- Create: `apps/api/banco/migracoes/0021_cota_sem_conta_meta.sql` (`alter table cota drop column conta_meta;`)
- Modify: `pacotes/contratos/src/cotas-feriados.ts` (sai `contaMeta` de `NovaCota`), `apps/api/src/cadastros/cotas.ts`, `apps/api/src/importacao/cotas.ts` (o comentário), `apps/web/src/routes/_app/cotas.tsx`
- Test: `apps/api/test/cotas.test.ts`, `apps/web/src/__testes__/cotas.test.tsx`, os que citam `contaMeta` (`isolamento-entre-unidades`, `importacao-cotas-feriados`)

- [ ] **Step 1: Write the failing tests:**
  - API: `POST` com `contaMeta: false` extra dá 201, e a cota lida não tem `contaMeta`. A cópia do mês anterior continua copiando.
  - Site: a lista não mostra "não conta para a meta", o diálogo não tem a caixa "Conta para a meta de ativação", e o corpo enviado não tem `contaMeta`.
- [ ] **Step 2: Run** os dois arquivos. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** as suítes de contratos, API e site (uma por vez) e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.1: cota sem "conta para a meta"`. No fim da subentrega: atualizar as contagens no `CLAUDE.md` local e rodar `pnpm test && pnpm typecheck && pnpm build:vercel` antes do PR.

---

## Entrega 3.2.2 — Meta e Efetivo do dia

**Branch:** `fase4-3-2-2-meta-e-efetivo`, a partir da `main` depois do merge da 3.2.1. Commits `Fase 4.3.2.2: …`; PR "Fase 4 — Entrega 3.2.2: meta de ativação e Efetivo do dia". **Migração 0022:** o PR avisa `pnpm --filter api db:migrar:teste`.

**Decisões desta entrega** (do design; as marcadas como "minha decisão" lá valem aqui):
- **Minutos do dia:** um horário vira minutos a partir das 00h do dia em que o turno começa. O turno que atravessa a meia-noite vai além de 1440 (20:00–08:00 = 1200–1920), e o turno de 24h vai de 480 a 1920. Na tela, os horários aparecem como "20h–08h".
- **Horários da guarnição no dia:** a união das faixas em que ela está vinculada, nas escalas ativas da seção, pela versão de vínculo vigente no mês do dia.
- **Quem cobre:** as alocações daquele dia (data = o dia) com essa guarnição e função, em qualquer escala da seção, e os acúmulos nessa guarnição e função, com o horário do turno da alocação.
- **Composição:** a versão do modelo vigente no mês. Função com mínimo 0 não pesa na ativação.
- **Ativada** = tem horário vinculado no dia e nenhuma falta. Sem horário vinculado (sem vínculo no dia, ou modelo desativado), a guarnição aparece como "não ativada", com "Sem horário vinculado neste dia".
- **Ordem no painel:** primeiro as guarnições da meta, na ordem de ativação (com o número, "1º", "2º"…). Depois, as que têm alguém alocado no dia e não estão na meta, pelo nome do modelo, sem número e sem contar. O estado nunca muda a posição.
- **Meta padrão:** versões com `desde` (uma data), cada uma com uma lista ordenada de modelos da própria seção. A que vale num dia é a de maior `desde` até ele. Gravar exige `desde` a partir de hoje (Recife), e gravar de novo no mesmo `desde` substitui a lista.
- **Dia diferente:** uma lista própria para o dia, que pode ser vazia (dia sem meta). Gravar aceita "até" (no máximo 31 dias, contando o primeiro), e "Voltar ao padrão" apaga a lista de um dia.
- **Quem edita:** gestor e administrador (`ESCREVE_PARAMETRO`). **Quem lê:** `CADASTRO`.
- **Cotas restantes:** por serviço, a soma das quantidades das cotas do mês e a soma das distribuídas (`cotasDoMes`), como "JES: restam 26 de 40".

**Review Focus da 3.2.2** (cada um tem teste na tarefa dona):
1. **Turno que atravessa a meia-noite.** O buraco de 20:00 às 08:00 é calculado e mostrado como "20h–08h", e quem entra às 20h do dia anterior não cobre o dia. Tarefas 41 e 43.
2. **O mesmo modelo em duas escalas no mesmo dia** (Ordinário e PE Seguro). Aparece um card só, com militares das duas, e a diária de 08–16 mais o Saldo de 16–20 fecham a função do Pronto de 08–20. Tarefa 43.
3. **Modelo da meta sem vínculo no dia, ou desativado.** Não quebra o painel: aparece como "não ativada", com "Sem horário vinculado neste dia". Tarefas 43 e 44.
4. **Mudar a meta padrão com dias diferentes já gravados.** Os dias diferentes e os dias antes do novo `desde` não mudam. Tarefa 42.
5. **Alocações que se encostam ou se sobrepõem** (08–16 e 16–20; duas pessoas em 08–20 para mínimo 1). Encostar não abre buraco, e sobrar gente não gera falta nem conta em dobro. Tarefa 41.

### Task 41: Horário coberto e ativação (motor)

**Files:**
- Create: `pacotes/dominio/src/ativacao.ts` (exportar em `src/index.ts`)
- Test: `pacotes/dominio/test/ativacao.test.ts` (regra só do sistema novo, sem caso gravado)

**Interfaces:**
- Produces:
  ```ts
  export type Intervalo = { inicio: number; fim: number }; // minutos desde 00h do dia; fim pode passar de 1440
  export function intervaloDoTurno(inicio: string, fim: string): Intervalo;
  export type FuncaoExigida = { funcaoId: string; funcao: string; minimo: number };
  export type Ocupacao = Intervalo & { funcaoId: string };
  export type Falta = Intervalo & { funcaoId: string; funcao: string; faltam: number };
  export function avaliarAtivacao(horarios: Intervalo[], composicao: FuncaoExigida[], ocupacoes: Ocupacao[]): { ativada: boolean; faltas: Falta[] };
  ```
  - `horarios` pode vir com sobreposição: vale a união.
  - Uma falta é um trecho contínuo, dentro dos horários, em que a função tem menos que o mínimo, com o mesmo número faltando.
  - As faltas vêm na ordem da composição e depois por início. A ocupação fora dos horários é ignorada.

- [ ] **Step 1: Write the failing tests:**
  - `intervaloDoTurno('20:00','08:00')` → `{inicio:1200, fim:1920}`; `('08:00','08:00')` → `{480, 1920}`; `('08:00','16:00')` → `{480, 960}`.
  - Horários `[08–20, 20–08]`, motorista mínimo 1 coberto só 08–20 → não ativada, uma falta `{funcao:'Motorista', faltam:1, inicio:1200, fim:1920}`.
  - Horário 08–20, auxiliar mínimo 1 coberto por 08–16 e 16–20 → ativada, sem faltas.
  - Mínimo 2 com 08–20 e 08–14 → falta `faltam:1` de 840 a 1200.
  - Duas pessoas em 08–20 para mínimo 1 → ativada.
  - Função com mínimo 0 e ninguém → não gera falta.
  - Horários vazios → `{ativada:false, faltas:[]}`.
  - Ocupação de 06–08 com horário 08–20 → não cobre nada.
- [ ] **Step 2: Run** `pnpm --filter dominio test`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** varrendo os pontos de início e fim dentro da união.
- [ ] **Step 4: Run** `pnpm --filter dominio test && pnpm --filter dominio tipos`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.2: horário coberto e ativação (motor)`.

### Task 42: Meta no banco, nos contratos e na API

**Files:**
- Create: `apps/api/banco/migracoes/0022_meta_de_ativacao.sql`, `pacotes/contratos/src/meta.ts` (exportar em `index.ts`), `apps/api/src/efetivo/meta.ts`, `apps/api/src/efetivo/rotas.ts` (`rotasEfetivo`, registrada em `apps/api/src/app.ts`)
- Test: `apps/api/test/meta.test.ts`

**Interfaces:**
- Tabelas (com o gatilho `auditoria_registro` em todas, como na 0017):
  - `meta_padrao_versao (id, unidade_id, desde date, unique (unidade_id, desde))`;
  - `meta_padrao_item (id, versao_id on delete cascade, guarnicao_id, ordem int >= 1, unique (versao_id, guarnicao_id), unique (versao_id, ordem))`;
  - `meta_dia (id, unidade_id, data date, unique (unidade_id, data))`;
  - `meta_dia_item (id, meta_dia_id on delete cascade, guarnicao_id, ordem, os mesmos unique)`.
- Contratos:
  ```ts
  export const NovaMetaPadrao = z.object({ desde: Data, guarnicoes: z.array(Id).max(100) }); // sem ids repetidos (refine, path guarnicoes)
  export const NovaMetaDoDia = z.object({ ate: Data.optional(), guarnicoes: z.array(Id).max(100) }); // idem
  export type ItemDaMeta = { guarnicaoId: string; nome: string };
  export type VersaoDaMetaPadrao = { desde: string; guarnicoes: ItemDaMeta[] };
  export type MetaDoDia = { data: string; origem: 'padrao' | 'dia'; guarnicoes: ItemDaMeta[] };
  ```
- API (`apps/api/src/efetivo/meta.ts`): `metaDoDia(c: Consulta, unidadeId: string, data: string): Promise<MetaDoDia>` e as rotas:
  - `GET /api/unidades/:u/meta-padrao` → `VersaoDaMetaPadrao[]`, da mais nova para a mais antiga;
  - `PUT /api/unidades/:u/meta-padrao` → a mesma lista;
  - `GET /api/unidades/:u/meta-do-dia/:data` → `MetaDoDia`;
  - `PUT /api/unidades/:u/meta-do-dia/:data` → `MetaDoDia` do `:data`;
  - `DELETE /api/unidades/:u/meta-do-dia/:data` → `MetaDoDia` (agora do padrão).

- [ ] **Step 1: Write the failing tests** (`meta.test.ts`, com modelos fictícios ABT, ACO e Resgate na 1ª SB):
  - **Sem nada gravado:** `GET meta-do-dia` → `origem:'padrao'`, `guarnicoes:[]`.
  - **Meta padrão:**
    - admin grava a meta padrão desde hoje com [Resgate, ABT]; `GET meta-do-dia` de amanhã devolve essa lista, nessa ordem;
    - gravar desde daqui a 10 dias com [ABT] não muda os dias antes disso, e muda os de depois;
    - gravar de novo no mesmo `desde` substitui a lista;
    - `desde` ontem → 400 em `desde` com "A meta padrão muda de hoje em diante.";
    - modelo de outra seção → 400 em `guarnicoes` com "Use modelos de guarnição desta seção.";
    - id repetido → 400.
  - **Dia diferente:**
    - `PUT meta-do-dia` com [ACO] e `ate` 2 dias depois grava os 3 dias (`origem:'dia'`);
    - depois disso, mudar a meta padrão não muda esses dias;
    - lista vazia grava um dia sem meta (`origem:'dia'`, `guarnicoes:[]`);
    - `ate` antes de `data`, ou intervalo com mais de 31 dias → 400 em `ate`;
    - `DELETE` volta o dia ao padrão.
  - **Acesso:**
    - escalante lê (200) e não grava (403);
    - militar sem papel → 403;
    - outra seção → 403 (como em `isolamento-entre-unidades`).
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/meta.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (a gravação numa transação com `comUsuario`, para a auditoria).
- [ ] **Step 4: Run** o arquivo e depois `test/migrar.test.ts test/auditoria.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.2: meta de ativação no banco e na API`.

### Task 43: Efetivo do dia (API)

**Files:**
- Create: `pacotes/contratos/src/efetivo-do-dia.ts` (exportar em `index.ts`), `apps/api/src/efetivo/efetivo-do-dia.ts`
- Modify: `apps/api/src/efetivo/rotas.ts` (a rota), `apps/api/src/cadastros/cotas.ts` (exportar `cotasDoMes`)
- Test: `apps/api/test/efetivo-do-dia.test.ts` (cenários montados como em `escala-leitura.test.ts` e `pre-escala.test.ts`)

**Interfaces:**
- Consumes: `avaliarAtivacao` e `intervaloDoTurno` (Tarefa 41); `metaDoDia` (Tarefa 42); `vinculosDaEscala`, `versoesDasGuarnicoes`, `versaoNoMes` e `cotasDoMes`.
- Produces:
  ```ts
  export type CotaRestante = { servicoId: string; servico: string; cor: string; quantidade: number; usadas: number };
  export type MilitarNoEfetivo = { militarId: string; posto: string; nomeGuerra: string; funcaoId: string; funcao: string; inicio: string; fim: string; servico: { id: string; nome: string; cor: string }; acumulo: boolean };
  export type FaltaNoEfetivo = { funcao: string; faltam: number; inicio: string; fim: string; escalaId: string | null };
  export type GuarnicaoNoEfetivo = { guarnicaoId: string; nome: string; viatura: string | null; ordem: number | null; ativada: boolean; horarios: { inicio: string; fim: string }[]; faltas: FaltaNoEfetivo[]; militares: MilitarNoEfetivo[] };
  export type EfetivoDoDia = { data: string; meta: { origem: 'padrao' | 'dia'; total: number; ativadas: number }; guarnicoes: GuarnicaoNoEfetivo[]; cotas: CotaRestante[] };
  export async function montarEfetivoDoDia(c: Consulta, unidadeId: string, data: string): Promise<EfetivoDoDia>;
  ```
  - Rota `GET /api/unidades/:u/efetivo-do-dia/:data` (`CADASTRO`).
  - `ordem` é a posição na meta (1, 2…), ou `null` fora da meta.
  - `FaltaNoEfetivo.escalaId` é a primeira escala, pelo nome, cujo vínculo da guarnição se sobrepõe ao buraco (é o atalho "Abrir na Escala do mês").
  - Os militares vêm na ordem da composição e depois por início.
  - Horários em "HH:MM", com o fim depois da meia-noite já de volta ao relógio (1920 → "08:00").

- [ ] **Step 1: Write the failing tests:**
  - **Resgate na meta com vínculo no Ordinário de 08–20 e de 20–08, e motorista só de 08–20:**
    - não ativada;
    - falta `{funcao:'Motorista', faltam:1, inicio:'20:00', fim:'08:00'}`, com o `escalaId` do Ordinário;
    - um motorista alocado às 20h **do dia anterior** não muda isso.
  - **Resgate também vinculado ao PE Seguro (diária 08–16):**
    - um card só;
    - auxiliar da diária 08–16 e Saldo 16–20 cobrem o auxiliar do dia;
    - com o motorista cobrindo 24h, fica ativada;
    - os militares aparecem com o serviço de cada um.
  - **Acúmulo:** um militar do Pronto que acumula a função de auxiliar no Resgate cobre o horário do turno dele (`acumulo: true`).
  - **Ordem:**
    - meta [ACO, Resgate], com ACO não ativada e Resgate ativado → ordem [ACO 1, Resgate 2];
    - ABT, fora da meta e com alguém alocado, vem depois, com `ordem:null`;
    - `meta.total` 2 e `meta.ativadas` 1.
  - **Modelo da meta sem vínculo no dia:** `ativada:false`, `horarios:[]`, `faltas:[]`.
  - **Cotas:** com uma cota JES de 40 no mês e 2 alocações de JES → `{servico:'JES', quantidade:40, usadas:2}`.
  - **Acesso:** escalante 200; militar sem papel e outra seção → 403.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/efetivo-do-dia.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o arquivo e depois a suíte inteira da API em segundo plano. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.2: efetivo do dia (API)`.

### Task 44: Tela do Efetivo do dia

**Files:**
- Create:
  - `apps/web/src/routes/_app/efetivo-do-dia.tsx` (`validateSearch` com `data?: string`; sem data, é hoje);
  - `apps/web/src/api/efetivo-do-dia.ts`: `consultaEfetivoDoDia`, `consultaMetaPadrao`, `gravarMetaPadrao`, `gravarMetaDoDia` e `voltarMetaAoPadrao`. Ao gravar, invalida `['efetivo-do-dia']` e `['meta-padrao']`;
  - `apps/web/src/componentes/efetivo-do-dia/CardDoEfetivo.tsx`;
  - `apps/web/src/componentes/efetivo-do-dia/AlterarMetaDoDia.tsx`;
  - `apps/web/src/componentes/CotasRestantes.tsx` (`CotasRestantes({ cotas }: { cotas: CotaRestante[] })`, usado também na Tarefa 45).
- Modify:
  - `apps/web/src/componentes/Trilho.tsx` ("Efetivo do dia" com `para: '/efetivo-do-dia'`, `soCadastro: true`);
  - `apps/web/src/routes/_app/escala-do-mes.tsx` (`dia?: string` na busca, rolando até o dia ao carregar);
  - `apps/web/src/componentes/escala-do-mes/DiaDaEscala.tsx` (`id={`dia-${data}`}` no bloco do dia);
  - `apps/web/src/lib/meses.ts` (`hoje(): string`, se ainda não existir);
  - `routeTree.gen.ts`.
- Test: `apps/web/src/__testes__/efetivo-do-dia.test.tsx`

**Interfaces:** Consumes `EfetivoDoDia`, `MetaDoDia` e as rotas das Tarefas 42 e 43.

O que a tela mostra, de cima para baixo (esboço no design, seção 3):
1. Data, com dia anterior e seguinte.
2. "Meta do dia: N guarnições, M ativadas". Quando a origem é `'dia'`, também "Meta alterada neste dia" e o botão "Voltar ao padrão".
3. `CotasRestantes`, como "JES: restam 26 de 40".
4. Os cards, nesta ordem. Cada card tem:
   - o número (só na meta) e o nome;
   - "ativada" ou "não ativada";
   - cada falta como "Falta 1 Motorista 20h–08h", com o link "Abrir na Escala do mês" (`/escala-do-mes?escala=…&mes=…&dia=…`);
   - os militares, com função, horário e serviço (com a cor);
   - sem horário vinculado, "Sem horário vinculado neste dia".
5. "Alterar a meta deste dia", só para quem pode mudar parâmetro. É um diálogo com:
   - os modelos ativos da seção para marcar;
   - "Subir" e "Descer" para ordenar;
   - "Até" (data opcional);
   - o botão "Salvar".

- [ ] **Step 1: Write the failing tests** (com `simularApi`):
  - **Os cards:**
    - aparecem na ordem da API, com "1º ACO", "não ativada" e "Falta 1 Motorista 20h–08h";
    - o link da falta aponta para `/escala-do-mes?escala=e-ord&mes=2026-12&dia=2026-12-12`;
    - o card fora da meta não tem número;
    - o card sem horário mostra "Sem horário vinculado neste dia".
  - **O topo:**
    - mostra "Meta do dia: 2 guarnições, 1 ativada" e "JES: restam 38 de 40";
    - o dia seguinte troca a data na busca e pede a rota do novo dia.
  - **A meta do dia:**
    - o gestor altera a meta do dia, marcando dois modelos e subindo o segundo; o corpo enviado é `{ guarnicoes: ['g2','g1'] }`;
    - "Voltar ao padrão" chama o `DELETE`;
    - o escalante não vê "Alterar a meta deste dia".
  - **Navegação:**
    - o trilho leva a `/efetivo-do-dia`;
    - abrir `/escala-do-mes?…&dia=2026-12-12` rola até `#dia-2026-12-12` (`scrollIntoView` chamado).
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/efetivo-do-dia.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, no visual das telas atuais (cards como os da Escala do mês, celular primeiro).
- [ ] **Step 4: Run** a suíte do site e `pnpm --filter web typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.2: tela do efetivo do dia`.

### Task 45: Meta padrão em Configurações e cotas restantes na Escala do mês

**Files:**
- Create: `apps/web/src/componentes/configuracoes/MetaDeAtivacao.tsx`
- Modify: `apps/web/src/routes/_app/configuracoes.tsx` (aba "Meta de ativação", `value="meta"`), `apps/web/src/routes/_app/escala-do-mes.tsx` (`CotasRestantes` com as cotas dos serviços da escala)
- Test: `apps/web/src/__testes__/configuracoes.test.tsx`, `apps/web/src/__testes__/escala-do-mes.test.tsx`

**Interfaces:**
- Consumes: `consultaMetaPadrao` e `gravarMetaPadrao` (Tarefa 44); `consultaCotas` (existente); `CotasRestantes` (Tarefa 44).
- Produces: `restantesPorServico(cotas: Cota[], servicoIds?: string[]): CotaRestante[]` em `apps/web/src/lib/cotas.ts`. Agrupa por serviço (soma `quantidade` e `distribuidas`) e filtra pelos serviços dados.

**A aba "Meta de ativação"** mostra a meta padrão que vale hoje e as futuras, cada uma como "A partir de 20/11/2026: 1º Resgate, 2º ABT". O editor tem:
- os modelos ativos para marcar;
- "Subir" e "Descer" para ordenar;
- "Vale a partir de", uma data que começa em hoje e não aceita dia passado;
- o botão "Salvar".

Quem não pode mudar parâmetro só vê.

**Na Escala do mês**, a linha de cotas fica abaixo do resumo das vagas. Os serviços da escala são os que aparecem nos turnos das faixas do mês.

- [ ] **Step 1: Write the failing tests:**
  - **Configurações › Meta de ativação:**
    - lista as versões;
    - o gestor grava [g2, g1] a partir de hoje, e o corpo é `{ desde: hoje, guarnicoes: ['g2','g1'] }`;
    - o escalante não vê "Salvar".
  - **Escala do mês:**
    - com cotas de JES (40, 2 distribuídas) e Bioma (escala sem Bioma), mostra só "JES: restam 38 de 40";
    - sem cotas para os serviços da escala, não mostra a linha.
  - **`restantesPorServico`** (teste de unidade): duas cotas de JES (interna 30 e externa 10, com 5 e 0 distribuídas) viram uma só, com `quantidade` 40 e `usadas` 5.
- [ ] **Step 2: Run** os dois arquivos. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site, `pnpm typecheck` e `pnpm build:vercel`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.2.2: meta padrão em Configurações e cotas restantes`. No fim da subentrega: atualizar as contagens no `CLAUDE.md` local e rodar `pnpm test && pnpm typecheck` antes do PR.

---

# Entrega 3.3 — Efetivo por dia, Escala do mês com turnos lado a lado e login novo

**Branch:** `fase4-3-3-efetivo-por-dia`, a partir da `main` (depois do PR #40). Commits `Fase 4.3.3: …`; PR "Fase 4 — Entrega 3.3: Efetivo por dia, turnos lado a lado e login novo". **Sem migração.** Uma entrega só, sem subentregas (decisão do usuário, 20/11/2026).

**Spec:** adendo "Efetivo por dia" de `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md`; adendo "depois da entrega 2.4" de `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md` (turnos lado a lado); adendo "Login, tela inicial, módulos e Pecúlio" de `docs/superpowers/specs/2026-11-16-migracao-design.md` e o mockup `docs/telas/login-e-inicio/mockup.html`.

**Saíram da 3.3** (decisão do usuário, 20/11/2026): "completar com JES", saldos do Adm, operações pelas cotas e os buracos do Pronto. Ficam sem entrega marcada, com as quatro decisões que faltavam (no fim desta seção).

**Decisões desta entrega** (do usuário, no adendo; as minhas estão marcadas):
- **Nome e endereço:** a tela é **"Efetivo por dia"**, em `/efetivo-por-dia`. O endereço antigo `/efetivo-do-dia` redireciona, levando a data. *Minha decisão:* a API mantém `efetivo-do-dia/:data` (é o efetivo de um dia; renomear só mexeria em código).
- **Dia ao abrir** (*minha decisão*, proposta do adendo simplificada): sem `data` no endereço, abre no último dia que o escalante viu nesta tela (guardado no navegador, chave `efetivo-por-dia:ultimo-dia`, leitura e escrita em `try/catch`); sem ele, hoje. Continuam "Dia anterior", "Dia seguinte" e o campo de data.
- **Linha do tempo:** cada guarnição mostra uma linha por vaga ocupada ou aberta de cada função, numa régua comum a toda a página. A vaga aparece na própria linha (âmbar listrado, como as vagas vazias da Escala do mês). Quem emenda turnos na mesma função e no mesmo serviço vira uma barra só. O trecho ocupado tem a cor do serviço.
- **Régua** (*minha decisão*, seguindo o pedido de 19/11 para Serviços): vai do menor início ao maior fim do dia (horários vinculados e alocações); marca só os pontos de interesse (os inícios e fins dos horários vinculados), com uma linha vinho cheia em 00h e em 24h quando caem dentro da régua, e "D" e "D+1" embaixo quando passa da meia-noite. Uma marca a menos de 4% da anterior não é escrita.
- **Escalar na vaga:** clicar na vaga abre a lista "Escolher militar" (o mesmo componente da Escala do mês) daquela escala e daquela faixa. Se a vaga cai em vínculos de mais de uma escala ou faixa (ex.: Ordinário 08h–20h e PE Seguro 08h–16h), primeiro se escolhe "Por qual escala?".
- **Remover:** clicar num trecho ocupado mostra as alocações dele (uma por turno emendado) com "Remover" (ou "Tirar acúmulo", se for acúmulo), as mesmas ações da Escala do mês.
- **Meta implícita:** saem o botão e o diálogo "Alterar a meta deste dia" e o campo "Até".
  - "Tirar da meta" (no card da meta): sem ninguém escalado na guarnição no dia, tira direto. Com gente, pergunta: "Tirar e desescalar", "Só tirar da meta" ou "Cancelar" (decisão 1-b). "Só tirar" deixa o card fora da meta, sem número.
  - "Adicionar guarnição" (no fim da lista): os modelos ativos da seção que não estão na meta do dia; entra no fim.
  - "Subir" e "Descer" no card da meta: mudam a ordem de ativação do dia.
  - "Voltar ao padrão" continua, quando o dia tem meta própria.
  - Escalar numa guarnição fora da meta não a põe na meta (decisão 2-b).
- **Quem mexe na meta do dia** (*minha decisão*): quem escala (`CADASTRO`), porque a meta do dia passou a ser consequência de escalar; a meta padrão continua com gestor e administrador (`ESCREVE_PARAMETRO`).
- **Vínculo sem turno** (menor M3 adiado da 3.2.2): um vínculo cuja faixa não é mais a de nenhum turno dos serviços da escala não conta no dia. Assim a vaga nunca leva a uma faixa que a lista "Escolher militar" recusa.
- **Sai o atalho "Abrir na Escala do mês"** do card (*minha decisão*): a vaga escala ali mesmo. O parâmetro `dia` da Escala do mês continua.
- **Escala do mês:** os turnos do dia fluem numa grade de ~20rem; o turno com mais de uma guarnição ocupa a linha inteira; o card tem largura natural e as funções voltam a ficar uma embaixo da outra (proposta do adendo de 19/11, já registrada no roadmap).
- **Login:** só a aparência muda, como no mockup aprovado; o login segue igual (e-mail, senha, as mesmas mensagens).

**Review Focus da 3.3** (cada um tem teste na tarefa dona):
1. **Vaga em duas escalas** (Ordinário 08–20 e PE Seguro 08–16 no mesmo modelo): a vaga de 08–16 oferece as duas; a de 16–20, só o Ordinário. Tarefas 47 e 50.
2. **Vínculo cuja faixa não é mais turno da escala:** não gera horário, falta nem opção de vaga. Tarefa 47.
3. **Militar que emenda os turnos A e B na mesma função:** uma barra só (08h–08h), e "Remover" mostra as duas alocações, cada uma com o seu horário. Tarefas 46, 47 e 50.
4. **Tirar e desescalar uma guarnição em que alguém está por acúmulo** (escalado em outra guarnição): sai só o acúmulo, e ele continua na outra; as alocações da guarnição saem com a marca de remoção, como na Escala do mês. Tarefa 48.
5. **Tirar da meta num dia que ainda segue o padrão, ou tirar a última guarnição:** o dia passa a ter meta própria (o padrão sem ela), e a lista pode ficar vazia; "Voltar ao padrão" desfaz. Tarefa 48.

### Task 46: As linhas de cada função (motor)

**Files:**
- Create: `pacotes/dominio/src/linhas-do-tempo.ts` (exportar em `src/index.ts`; depois, `pnpm --filter dominio tipos`)
- Test: `pacotes/dominio/test/linhas-do-tempo.test.ts` (regra só do sistema novo, sem caso gravado)

**Interfaces:**
- Consumes: `Intervalo`, `FuncaoExigida`, `Falta` de `ativacao.ts` (Tarefa 41).
- Produces:
  ```ts
  export type OcupacaoNaLinha = Intervalo & { funcaoId: string; funcao: string; chave: string; indice: number };
  export type TrechoDaLinha = (Intervalo & { tipo: 'ocupado'; indices: number[] }) | (Intervalo & { tipo: 'vaga' });
  export type LinhasDaFuncao = { funcaoId: string; funcao: string; minimo: number; linhas: TrechoDaLinha[][] };
  export function linhasDaGuarnicao(composicao: FuncaoExigida[], ocupacoes: OcupacaoNaLinha[], faltas: Falta[]): LinhasDaFuncao[];
  ```
  `chave` junta o mesmo militar no mesmo serviço; `indice` aponta para a ocupação de quem chama; `indices` são as ocupações juntadas no trecho.

**A regra:**
1. Funções na ordem da composição; depois as que só aparecem nas ocupações (fora do modelo), pelo nome, com `minimo` 0. Função sem ocupação e sem falta não entra.
2. Ocupações da mesma função e da mesma `chave` que se encostam (o fim de uma é o início da outra) viram um trecho só.
3. Cada falta vira `faltam` trechos de vaga com o horário dela.
4. Os trechos, por início (no mesmo início: ocupado antes de vaga, o mais longo antes), vão para a primeira linha livre (último fim ≤ início), preferindo a que termina exatamente no início dele; sem linha livre, abre uma nova. Assim o número de linhas é o máximo de trechos ao mesmo tempo.

- [ ] **Step 1: Write the failing tests:**
  - `junta o militar que emenda turnos`: Motorista mínimo 1, ocupações `{480–1200, chave 'm1|pronto'}` e `{1200–1920, chave 'm1|pronto'}` → uma linha com um trecho `{ inicio: 480, fim: 1920, tipo: 'ocupado', indices: [0, 1] }`.
  - `não junta serviços diferentes, mas mantém na mesma linha`: `{480–960, 'm1|diaria'}` e `{960–1200, 'm2|saldo'}` → uma linha, dois trechos.
  - `a vaga entra na linha livre`: Auxiliar mínimo 2, horários 480–1920, uma ocupação 480–1200; faltas `[{480–1200, faltam 1}, {1200–1920, faltam 2}]` → duas linhas, e cada uma cobre de 480 a 1920 sem buraco.
  - `gente além do mínimo abre linha`: Chefe mínimo 1, três ocupações 480–1200 de chaves diferentes → três linhas.
  - `função fora do modelo vem depois, com mínimo 0`.
  - `função sem ninguém e sem falta não aparece` (mínimo 0).
- [ ] **Step 2: Run** `pnpm --filter dominio test -- linhas-do-tempo`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** em `linhas-do-tempo.ts`.
- [ ] **Step 4: Run** `pnpm --filter dominio test` e `pnpm --filter dominio tipos`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: linhas do tempo das funções (motor)`.

### Task 47: Efetivo do dia com linhas, vagas que escalam e vínculos só de turnos que existem (API)

**Files:**
- Modify: `pacotes/contratos/src/efetivo-do-dia.ts`, `apps/api/src/efetivo/efetivo-do-dia.ts`
- Test: `apps/api/test/efetivo-do-dia.test.ts`

**Interfaces:**
- Consumes: `linhasDaGuarnicao` (Tarefa 46); `avaliarAtivacao`, `intervaloDoTurno`, `unirIntervalos` (Tarefa 41).
- Produces (contratos):
  ```ts
  export type AlocacaoNoTrecho = { alocacaoId: string; acumuloId: string | null; inicio: string; fim: string }; // HH:MM do turno
  export type OpcaoDaVaga = { escalaId: string; escala: string; inicio: string; fim: string };          // a faixa do vínculo, HH:MM
  export type TrechoNoEfetivo = {
    inicio: number; fim: number;                       // minutos desde 00h do dia (passa de 1440 depois da meia-noite)
    ocupante: { militarId: string; posto: string; nomeGuerra: string; servico: { id: string; nome: string; cor: string }; acumulo: boolean; alocacoes: AlocacaoNoTrecho[] } | null;
    opcoes: OpcaoDaVaga[];                             // só na vaga: os vínculos da guarnição que se sobrepõem a ela, escalas pelo nome
  };
  export type FuncaoNoEfetivo = { funcaoId: string; funcao: string; minimo: number; cnhExigida: string | null; linhas: TrechoNoEfetivo[][] };
  ```
  Em `GuarnicaoNoEfetivo`: entra `funcoes: FuncaoNoEfetivo[]` e `alocados: number` (quantas alocações e acúmulos do dia estão nela, para a pergunta do "Tirar da meta"); sai `militares`; `FaltaNoEfetivo` perde `escalaId`. `MilitarNoEfetivo` sai do pacote.

**Como montar:**
- `vinculosDoDia` guarda também o nome da escala e a faixa (`inicio`, `fim` em HH:MM) e **descarta o vínculo cuja faixa não é a de nenhum turno dos serviços daquela escala** (`escala_servico` × `turno`, mesma consulta da rota de candidatos).
- `entradasDoDia` passa a trazer `alocacao_id` e, no acúmulo, o `acumulo_id`.
- `chave` da ocupação = `militarId|servicoId|acumulo` (acúmulo não se junta com a vaga original).
- A vaga recebe em `opcoes` os vínculos cujo intervalo se sobrepõe ao trecho dela.

- [ ] **Step 1: Write the failing tests** (no arquivo existente, ajustando os que liam `militares` e `escalaId`):
  - `linhas: o militar dos turnos A e B vira um trecho só com as duas alocações` — Resgate no Ordinário 08–20 e 20–08, Motorista ALFA nos dois turnos → `funcoes[0].linhas` = `[[{ inicio: 480, fim: 1920, ocupante.nomeGuerra: 'ALFA', alocacoes.length: 2 }]]`.
  - `vaga com as escalas que a cobrem` — mesmo modelo no Ordinário (08–20) e no PE Seguro (08–16), Auxiliar sem ninguém → a vaga de 480 a 960 tem `opcoes` com as duas escalas (pelo nome) e a de 960 a 1200 só o Ordinário.
  - `vínculo sem turno não conta` — vínculo do Bioma em 00:00–00:00 sem turno com essa faixa → a guarnição fica "Sem horário vinculado" (`horarios` vazio), sem faltas e sem linhas de vaga.
  - `alocados conta alocações e acúmulos do dia na guarnição`.
  - `trecho de acúmulo traz o acumuloId`.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/efetivo-do-dia.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 3b: Ajuste mínimo no site** para o typecheck não ficar vermelho: o `CardDoEfetivo` atual deixa de listar `militares` e de usar `escalaId` (mostra só as faltas, sem atalho), e os testes do site que liam esses campos são ajustados. A tela nova vem na Tarefa 49.
- [ ] **Step 4: Run** o arquivo, a suíte da API (`--no-file-parallelism`), a suíte do site e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: efetivo do dia com linhas e vagas (API)`.

### Task 48: Meta do dia sem intervalo, de quem escala, e "Tirar da meta" (API)

**Files:**
- Modify: `pacotes/contratos/src/meta.ts`, `apps/api/src/efetivo/meta.ts`, `apps/api/src/efetivo/rotas.ts`
- Test: `apps/api/test/meta.test.ts`

**Interfaces:**
- Produces:
  - `NovaMetaDoDia = z.object({ guarnicoes: z.array(Id).max(100) })` com a mesma recusa de repetidos (sai `ate`).
  - `TirarDaMeta = z.object({ guarnicaoId: Id, desescalar: z.boolean() })`.
  - `gravarMetaDoDia(tx, unidadeId, data, guarnicoes): Promise<void>` (um dia só); saem `MAXIMO_DE_DIAS_DA_META` e `diasContados`.
  - `tirarDaMeta(tx, unidadeId, data, guarnicaoId, desescalar, usuarioId): Promise<void>`.
  - Rota `POST /unidades/:u/meta-do-dia/:data/tirar` → devolve `EfetivoDoDia` (`montarEfetivoDoDia`).
  - `PUT` e `DELETE /unidades/:u/meta-do-dia/:data` passam a `CADASTRO`; `PUT /meta-padrao` continua `ESCREVE_PARAMETRO`.

**`tirarDaMeta`, numa transação:**
1. A meta do dia (`metaDoDia`); se a guarnição não está nela: `Recusa('Esta guarnição não está na meta deste dia.')` → 409.
2. Grava a meta do dia sem ela (mesmo que o dia seguisse o padrão; pode ficar vazia).
3. Com `desescalar`: os acúmulos nessa guarnição de alocações do dia saem (`tirarAcumulo`), e depois as alocações do dia nessa guarnição, em qualquer escala da seção, saem com `remover(tx, id, usuarioId)` (com a marca de remoção, como na Escala do mês).

- [ ] **Step 1: Write the failing tests** (ajustando os testes de "Até", que saem):
  - `PUT meta-do-dia com 'ate' é ignorado` (zod sem o campo; grava só o dia) e `o escalante grava a meta do dia` (200; antes era 403).
  - `o escalante não grava a meta padrão` (403, continua).
  - `tirar num dia que segue o padrão`: padrão [g1, g2] → tirar g1 → `metaDoDia` = origem `'dia'`, [g2]; o dia seguinte continua no padrão.
  - `tirar a última guarnição deixa o dia sem meta` (origem `'dia'`, lista vazia).
  - `tirar sem desescalar mantém as alocações` e a resposta traz a guarnição fora da meta (`ordem: null`).
  - `tirar e desescalar`: ALFA alocado em g1 (marca de remoção criada) e BRAVO alocado em g2 com acúmulo em g1 → ALFA sai; BRAVO continua em g2 sem o acúmulo.
  - `tirar guarnição que não está na meta` → 409 com a frase.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/meta.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte da API e `pnpm --filter api typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: meta do dia de quem escala e tirar da meta (API)`.

### Task 49: Tela "Efetivo por dia" com a linha do tempo

**Files:**
- Create:
  - `apps/web/src/routes/_app/efetivo-por-dia.tsx` (`validateSearch` com `data?: string`);
  - `apps/web/src/componentes/efetivo-por-dia/LinhaDoTempoDaGuarnicao.tsx`;
  - `apps/web/src/componentes/efetivo-por-dia/ReguaDoEfetivo.tsx`;
  - `apps/web/src/lib/efetivo.ts`: `janelaDoDia(guarnicoes: GuarnicaoNoEfetivo[]): { inicio: number; fim: number } | null` e `marcasDoDia(guarnicoes, janela): number[]` (pontos de interesse, sem marca a menos de 4% da anterior); `ultimoDiaVisto(): string | null` e `guardarUltimoDia(data: string): void` (try/catch).
- Modify:
  - `apps/web/src/routes/_app/efetivo-do-dia.tsx` vira só o redirecionamento para `/efetivo-por-dia` com a mesma `data`;
  - `apps/web/src/componentes/Trilho.tsx` ("Efetivo por dia", `para: '/efetivo-por-dia'`);
  - mover `componentes/efetivo-do-dia/` para `componentes/efetivo-por-dia/` (`CardDoEfetivo` refeito, `EditorDaMeta` continua usado por Configurações);
  - `routeTree.gen.ts`.
- Test: `apps/web/src/__testes__/efetivo-por-dia.test.tsx` (renomeia e refaz `efetivo-do-dia.test.tsx`), `apps/web/src/__testes__/casca.test.tsx` (nome no trilho).

**Interfaces:** Consumes `EfetivoDoDia`, `FuncaoNoEfetivo`, `TrechoNoEfetivo` (Tarefa 47); `textoMinutos` de `lib/turnos.ts`; `corDoTexto`.

**O que a tela mostra:**
- Título "Efetivo por dia".
- A navegação de hoje: anterior, data e seguinte.
- A linha "Meta do dia…" e as cotas restantes.
- A régua, uma vez, acima dos cards.
- Os cards um embaixo do outro, na largura toda.

**Cada card** tem o número (só na meta), o nome, a viatura e "ativada" ou "não ativada". Embaixo vem uma linha por `linhas[i]`:
- o nome da função, só na primeira linha dela;
- os trechos posicionados em `%` da janela.

**Os trechos:**
- **Ocupado:** fundo da cor do serviço, com "POSTO NOME" cortado com reticências. Nome acessível: "Motorista: SD BM ALFA, 08h–08h, Pronto".
- **Vaga:** âmbar listrado. Nome acessível: "Motorista: vaga 20h–08h".
- Os dois são botões; a ação deles entra nas Tarefas 50 e 51. Nesta tarefa, são botões sem ação.

**As faltas** continuam escritas embaixo da linha do tempo, como hoje ("Falta 1 Motorista 20h–08h"), sem o atalho.

**No celular:** o nome da função fica acima da barra.

- [ ] **Step 1: Write the failing tests** (`simularApi`, com o `EfetivoDoDia` novo):
  - **Navegação e nome:**
    - o trilho mostra "Efetivo por dia" e leva a `/efetivo-por-dia`;
    - `/efetivo-do-dia?data=2026-12-12` vai para `/efetivo-por-dia?data=2026-12-12`.
  - **Dia ao abrir:**
    - sem `data`, com `localStorage['efetivo-por-dia:ultimo-dia'] = '2026-12-12'`, pede a rota de 2026-12-12;
    - sem nada guardado, pede a de hoje;
    - ir para o dia seguinte guarda `2026-12-13`.
  - **Linha do tempo:**
    - o card mostra o botão "Motorista: SD BM ALFA, 08h–08h, Pronto" e o "Motorista: vaga 20h–08h";
    - a régua marca "08h" e "20h" e mostra "D" e "D+1" quando a janela passa de 1440.
  - **Cards:**
    - fora da meta, o card não tem número;
    - "Sem horário vinculado neste dia" continua.
  - **Unidade:** `janelaDoDia` e `marcasDoDia`, em que uma marca a 2% da anterior some.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/efetivo-por-dia.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `frontend-design` para a linha do tempo (o resto segue o visual das telas atuais). Vermelho só para erro; vaga em âmbar.
- [ ] **Step 4: Run** a suíte do site e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: tela Efetivo por dia com a linha do tempo`.

### Task 50: Escalar e remover no Efetivo por dia

**Files:**
- Create: `apps/web/src/componentes/efetivo-por-dia/EscolherEscalaDaVaga.tsx`, `apps/web/src/componentes/efetivo-por-dia/AlocacoesDoTrecho.tsx`
- Modify: `apps/web/src/componentes/efetivo-por-dia/LinhaDoTempoDaGuarnicao.tsx`, `apps/web/src/routes/_app/efetivo-por-dia.tsx`
- Test: `apps/web/src/__testes__/efetivo-por-dia.test.tsx`

**Interfaces:**
- Consumes:
  - `EscolherMilitar({ escalaId, vaga, aoFechar })` e `VagaDaTela` (existentes);
  - `removerAlocacao` e `tirarAcumulo` de `api/escala-do-mes.ts` (já invalidam `['efetivo-do-dia']`);
  - `TrechoNoEfetivo.opcoes` e `.ocupante.alocacoes` (Tarefa 47).
- **Vaga clicada:**
  - Com uma opção, abre direto `EscolherMilitar` com `escalaId` e `vaga = { data, inicio, fim, guarnicaoId, guarnicao, funcaoId, funcao, cnhExigida }`. `inicio` e `fim` são os da opção (a faixa do vínculo).
  - Com mais de uma opção, abre primeiro "Por qual escala?", com um botão por opção ("Ordinário 08h–20h").
- **Trecho ocupado clicado:** abre um diálogo com o militar e uma linha por alocação: "08h–20h" e o botão "Remover", ou "Tirar acúmulo" quando `acumuloId`.

- [ ] **Step 1: Write the failing tests:**
  - **Vaga:**
    - com uma opção, clicar em "Motorista: vaga 20h–08h" pede os candidatos de `/api/escalas/e-ord/mes/2026-12/candidatos?data=2026-12-12&inicio=20:00&fim=08:00&guarnicaoId=g2&funcaoId=f-Motorista`;
    - escolher um apto faz `POST /api/escalas/e-ord/alocacoes` e pede o efetivo do dia de novo;
    - com duas opções, aparece "Por qual escala?" com "Ordinário 08h–20h" e "PE Seguro 08h–16h", e a escolhida define a escala dos candidatos.
  - **Trecho ocupado:**
    - mostra as duas alocações de ALFA (08h–20h e 20h–08h), e "Remover" na segunda chama `DELETE /api/alocacoes/a-2`;
    - num trecho de acúmulo, "Tirar acúmulo" chama `DELETE /api/acumulos/ac-1`.
  - **Fora da meta:** escalar na vaga de uma guarnição fora da meta não faz nenhum `PUT` na meta do dia (decisão 2-b).
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site e `pnpm --filter web typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: escalar e remover no Efetivo por dia`.

### Task 51: Meta do dia pela própria tela

**Files:**
- Create: `apps/web/src/componentes/efetivo-por-dia/TirarDaMeta.tsx`, `apps/web/src/componentes/efetivo-por-dia/AdicionarGuarnicao.tsx`
- Delete: `componentes/efetivo-por-dia/AlterarMetaDoDia.tsx`
- Modify: `apps/web/src/api/efetivo-do-dia.ts`, `apps/web/src/componentes/efetivo-por-dia/CardDoEfetivo.tsx`, `apps/web/src/routes/_app/efetivo-por-dia.tsx`
- Test: `apps/web/src/__testes__/efetivo-por-dia.test.tsx`

**Interfaces:**
- Consumes:
  - `PUT /meta-do-dia/:data` com `{ guarnicoes }` e `POST /meta-do-dia/:data/tirar` (Tarefa 48);
  - `GuarnicaoNoEfetivo.alocados` (Tarefa 47);
  - `consultaGuarnicoes` (existente, para os modelos ativos da seção no mês do dia).
- Produces, em `api/efetivo-do-dia.ts`:
  - `gravarMetaDoDia(queryClient, unidadeId, data, guarnicoes: string[])`, sem `ate`;
  - `tirarDaMeta(queryClient, unidadeId, data, guarnicaoId, desescalar)`, que invalida `['efetivo-do-dia']`, `['escala-do-mes']`, `['cotas']` e `['candidatos']`.
- **No card da meta**, para quem escala:
  - "Subir" e "Descer", com o mesmo cuidado de foco do `EditorDaMeta`. Gravam a lista do dia com a guarnição trocada de lugar.
  - "Tirar da meta":
    - com `alocados === 0`, grava direto;
    - com gente, abre o diálogo "Há 3 militares escalados no Resgate neste dia." com os botões "Tirar e desescalar", "Só tirar da meta" e "Cancelar".
- **No fim da lista**, "Adicionar guarnição". Mostra os modelos ativos que não estão na meta do dia, inclusive os de fora da meta que já têm gente. O escolhido entra no fim.
- **"Voltar ao padrão"** aparece para quem escala.

- [ ] **Step 1: Write the failing tests:**
  - **Subir e tirar sem gente:**
    - "Subir" no 2º envia `{ guarnicoes: ['g3','g2'] }`;
    - "Tirar da meta" num card com `alocados: 0` envia o `POST …/tirar` com `{ guarnicaoId, desescalar: false }`, sem perguntar.
  - **Tirar com gente:**
    - com `alocados: 3`, aparece a pergunta;
    - "Tirar e desescalar" envia `desescalar: true`;
    - "Só tirar da meta" envia `false`;
    - "Cancelar" não envia nada.
  - **Adicionar guarnição:**
    - lista o ABT, que está fora da meta mas tem gente;
    - não lista os que já estão na meta;
    - o ABT escolhido vai para o fim (`['g2','g3','g1']`).
  - **Permissões e o que saiu:**
    - um usuário só com papel de escalante vê "Tirar da meta", "Subir" e "Adicionar guarnição";
    - "Alterar a meta deste dia" não existe mais.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: meta do dia pela própria tela`.

### Task 52: Escala do mês com os turnos lado a lado

**Files:**
- Modify: `apps/web/src/componentes/escala-do-mes/DiaDaEscala.tsx`, `apps/web/src/componentes/escala-do-mes/CardDaGuarnicao.tsx`
- Test: `apps/web/src/__testes__/escala-do-mes.test.tsx`

**A disposição** (adendo de 19/11 depois da 2.4):
- As faixas do dia vão num contêiner `data-faixas-do-dia` com `grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]`.
- A faixa com mais de uma guarnição recebe `data-larga` e `col-span-full`.
- Dentro da faixa, os cards ficam lado a lado, como hoje, com `minmax(min(100%,18rem),1fr)`.
- No card, as funções voltam a uma coluna (`data-funcoes` sem a grade de 11rem).

O jsdom não mede largura, então os testes conferem a estrutura.

- [ ] **Step 1: Write the failing tests:**
  - **Bioma** (três faixas, uma guarnição cada): as três faixas ficam no mesmo `data-faixas-do-dia`, e nenhuma tem `data-larga`.
  - **Ordinário** (faixa 08–20 com três guarnições): a faixa tem `data-larga`.
  - **Card:** `data-funcoes` não tem a classe `auto-fill`.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/escala-do-mes.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: turnos do dia lado a lado na Escala do mês`.

### Task 53: Tela de login nova

**Files:**
- Create:
  - `apps/web/public/brasao-2gb.png`, copiado de `docs/telas/login-e-inicio/img/brasao-2gb.png`;
  - `apps/web/public/quartel.png`, copiado de `docs/telas/login-e-inicio/img/quartel-mastro.png`, a foto do quartel com a bandeira.
- Modify: `apps/web/src/routes/entrar.tsx`
- Test: `apps/web/src/__testes__/entrar.test.tsx`

Siga o mockup `docs/telas/login-e-inicio/mockup.html` (leia-o inteiro antes).

**Computador:**
- Fundo: a foto, coberta de vinho do lado esquerdo.
- Lado esquerdo: o brasão do 2º GB, o título "Sistema de Gestão - 2º GB" e a linha "2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco".
- Lado direito: o cartão de login atual.

**Celular:**
- A foto em cima, com o brasão e o título.
- O cartão sobe sobre a foto, com campos e botão mais altos.

O login segue igual: e-mail, senha e as mesmas mensagens de erro. Ficam de fora "Esqueci minha senha" e a tela inicial com os módulos.

- [ ] **Step 1: Write the failing tests:**
  - a tela tem o título "Sistema de Gestão - 2º GB";
  - o brasão tem `alt` "Brasão do 2º GB";
  - os testes de login que já existem continuam iguais.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/entrar.test.tsx`. Expected: FAIL no título.
- [ ] **Step 3: Implement.** O tamanho das imagens entra no `build:vercel`; se a foto passar de ~500 KB, gere uma versão `.jpg` menor.
- [ ] **Step 4: Run** a suíte do site, `pnpm typecheck` e `pnpm build:vercel`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.3.3: tela de login nova`. No fim da entrega:
  - atualizar as contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - PR com a lista curta para a sandbox.

**Fora da 3.3, sem entrega marcada** (decisão do usuário, 20/11/2026). Continuam valendo as decisões que faltavam:
1. **Ordem dos buracos do Pronto.** Em parte respondida em 20/11/2026: o Saldo vem antes do JES no Ordinário, e isso é configuração. Falta decidir onde essa ordem se configura.
2. **Saldo que não cabe.** O militar do Adm fica com menos saldos (com aviso), ou o saldo vai para "Sem guarnição"?
3. **Cota contra vaga, nas operações.** A cota limita quantas vagas a seção preenche, e as que sobram ficam vazias?
4. **Voluntária e compulsória.** A compulsória iguala quem tem menos (RN-41, RN-43), ou nesta versão entra só a voluntária?

Os itens que esperam essas decisões:
- **"Completar com JES":** o chefe escolhe o dia ou o período, e o sistema preenche pela ordem de ativação, descontando da cota.
- **Completar os buracos do Pronto.**
- **Saldos do Adm:** `distribuirAdm` passa a trabalhar com vagas, sempre com `servico` e `turno` preenchidos.
- **Operações pelas cotas:** `distribuirCotas` e `diagnosticarOperacoes` passam a usar vagas e o voluntariado por faixa.

---


# Entrega 4 — Grade geral

**Branch:** `fase4-4-grade-geral`, a partir da `main` (depois do PR #42). Commits `Fase 4.4: …`; PR "Fase 4 — Entrega 4: Grade geral". **Sem migração.**

**Spec:** `docs/superpowers/specs/2026-11-20-grade-geral-design.md`. Ela vale por cima da seção "Grade geral" de `docs/superpowers/specs/2026-11-16-telas.md`. O visual de base é o do mockup `docs/telas/telas-v12-anonimizado.html`, na parte "grade do militar".

**Decisões desta entrega** (do design; as marcadas como "minha decisão" lá valem aqui):
- **A grade é leitura.** O clique é na célula (militar e dia) e abre o painel do dia, onde se adiciona, troca e remove. As ações reaproveitam as rotas da Escala do mês: `POST /escalas/:e/alocacoes`, `DELETE /alocacoes/:id`, `DELETE /acumulos/:id` e a lista de candidatos.
- **Colunas finais:**
  - PJES (número de alocações do tipo `pjes` no mês);
  - Diárias (número de alocações do tipo `diaria`);
  - Voluntariado, no formato "24h de 60h": horas tiradas nesses dois tipos contra as horas marcadas na disponibilidade do mês.
  - Nas colunas PJES e Diárias, a barra atrás do número tem como máximo o maior valor da coluna em todo o efetivo da grade.
- **Grupos:** as equipes pela `ordem_ciclo`, depois o Adm (jornada `adm`), depois "Outras seções" (escalados aqui, lotados em outra unidade). Dentro de cada grupo, por antiguidade (`compararAntiguidade` de `dominio`). A lotação que vale é a do dia 1 do mês; se não houver, a primeira lotação dele no mês.
- **Filtro de equipes:** chips "Todas", um por equipe, "Adm" e "Outras seções". Fica na busca (`equipe`). Só esconde grupos.
- **Expediente do Adm:** bloco implícito cinza nos dias úteis (segunda a sexta, sem feriado), quando ele está lotado e não está afastado.
- **Choques:** `detectarChoques` com o expediente implícito do Adm, com a mesma montagem de horários e tipos da elegibilidade. As células dos dias envolvidos ganham contorno vermelho.
- **Trocar com um militar já escalado** troca as duas alocações de lugar, numa transação, e cada militar passa pelo `escalar` na vaga do outro. Com os dois serviços ordinários, a tela chama a troca de "Permuta"; o registro formal da permuta fica para a fase 5. Com um militar livre, é uma substituição: o atual sai com a marca de remoção (`remover`) e o novo entra (`escalar`). Um acúmulo em qualquer das alocações recusa a troca com "Tire os acúmulos antes de trocar."
- **Atualizações:** as gravações da Escala do mês e do Efetivo por dia passam a invalidar também `['grade']`. As da grade invalidam `['grade']`, `['escala-do-mes']`, `['efetivo-do-dia']`, `['cotas']` e `['candidatos']`.

**Review Focus da entrega 4** (cada um tem teste na tarefa dona):
1. **Turno que atravessa a meia-noite e a virada do mês:** o turno B do dia 31 aparece só no dia 31. O choque dele com a manhã do dia 1 do mês seguinte não quebra a grade. O choque entre o dia 30 e o dia 31 marca as duas células. Tarefa 54.
2. **Militar transferido no meio do mês, e militar de outra seção escalado aqui:** cada um aparece uma vez, no grupo certo. Tarefa 54.
3. **Trocar com quem não pode ocupar a vaga do outro** (sem a CNH, ou não voluntário JES para PJES): 409 com o motivo, e nada muda, nem o primeiro lado da troca. Tarefa 56.
4. **Trocar com quem está em dois serviços no dia:** a lista mostra os dois lugares, e o escalante escolhe qual troca. Tarefas 56 e 59.
5. **Painel do dia aberto quando outra pessoa já mexeu:** a recusa (404 ou 409) aparece dentro do painel e a grade volta a ser buscada. Tarefas 58 e 59.

### Task 54: A grade do mês (API)

**Files:**
- Create: `pacotes/contratos/src/grade.ts` (exportar no `index.ts`), `apps/api/src/grade/grade.ts`, `apps/api/src/grade/rotas.ts` (registrar em `apps/api/src/app.ts`)
- Modify: `apps/api/src/escala/elegibilidade.ts`. Extrair para `apps/api/src/escala/horarios.ts`: `horariosDaUnidade(c, unidadeId): Promise<{ horarios: Horarios; tipos: Record<string, string> }>`, com o expediente, e `EXPEDIENTE`. A elegibilidade passa a usar os dois.
- Test: `apps/api/test/grade.test.ts`

**Interfaces:**
- Produces (contratos):
  ```ts
  export type BlocoDaGrade = { alocacaoId: string | null; servico: { id: string; nome: string; cor: string; tipo: 'ordinario' | 'pjes' | 'diaria' } | null; letra: string | null; inicio: string; fim: string; expediente: boolean };
  export type LinhaDaGrade = {
    militarId: string; posto: string; nomeGuerra: string; matricula: string; jornada: 'pronto' | 'adm';
    dias: Record<string, BlocoDaGrade[]>;   // só os dias com bloco; blocos por início
    choques: string[];                      // datas com choque
    pjes: number; diarias: number; horasTiradas: number; horasPedidas: number; // horas em minutos
  };
  export type GrupoDaGrade = { chave: string; nome: string; linhas: LinhaDaGrade[] }; // chave = equipeId | 'adm' | 'outras'
  export type GradeDoMes = { mes: string; dias: { data: string; diaDaSemana: number; feriado: string | null }[]; grupos: GrupoDaGrade[] };
  ```
- Rota `GET /api/unidades/:u/grade/:mes` (`CADASTRO`). Mês inválido: 400 "Mês inválido: use o formato aaaa-mm.".

- [ ] **Step 1: Write the failing tests** (cenário fictício D7, como em `efetivo-do-dia.test.ts`):
  - `agrupa por equipe na ordem do ciclo, depois Adm, depois Outras seções, e por antiguidade dentro do grupo`.
  - `o turno B do último dia aparece só no último dia, com a letra e a cor do serviço`.
  - `o expediente do Adm é um bloco sem letra nos dias úteis, nem no feriado nem no afastamento`.
  - `choque entre dois serviços no mesmo dia marca o dia; o B do dia 30 com o A das 06h do dia 31 marca os dois` (Review Focus 1).
  - `militar transferido no dia 15 aparece uma vez, na equipe da lotação do dia 1; o de outra seção escalado aqui vai para Outras seções` (Review Focus 2).
  - `pjes, diarias, horasTiradas (minutos) e horasPedidas (minutos da disponibilidade do mês)`.
  - `mês inválido é 400; sem papel é 403`.
  - A suíte da elegibilidade (`candidatos`, `escalar`) continua passando depois da extração.
- [ ] **Step 2: Run** `cd apps/api && npx vitest run --maxWorkers=1 test/grade.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Primeiro a extração dos horários, com a suíte da elegibilidade verde; depois `montarGradeDoMes(c, unidadeId, mes): Promise<GradeDoMes>`.
  - A janela de alocações para os choques vai do último dia do mês anterior ao primeiro do seguinte.
  - Passar `mes` a `detectarChoques`, que relata só os choques que tocam o mês.
- [ ] **Step 4: Run** o arquivo, a suíte da API (`--no-file-parallelism`) e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: grade do mês (API)`.

### Task 55: O painel do dia (API)

**Files:**
- Create: `apps/api/src/grade/dia.ts`
- Modify: `pacotes/contratos/src/grade.ts`, `apps/api/src/grade/rotas.ts`
- Test: `apps/api/test/grade-dia.test.ts`

**Interfaces:**
- Consumes: `avaliarFaixa(c, vaga, somenteMilitar)` e `SEM_VOLUNTARIADO` (elegibilidade); `cnhHabilitadas` de `dominio`; `vinculosDaEscala`, `versaoNoMes`, `versoesDasGuarnicoes`.
- Produces:
  ```ts
  export type ServicoNoDia = { alocacaoId: string; escalaId: string; escala: string; servico: { id: string; nome: string; cor: string; tipo: string }; letra: string; inicio: string; fim: string; guarnicao: string | null; funcao: string | null; acumulaCom: string[] };
  export type OpcaoDeServico = { escalaId: string; escala: string; inicio: string; fim: string; guarnicaoId: string | null; guarnicao: string | null; funcaoId: string | null; funcao: string | null; servicos: { servicoId: string; turnoId: string; nome: string }[]; semVoluntariado: boolean };
  export type PainelDoDia = {
    militar: { militarId: string; posto: string; nomeGuerra: string; matricula: string; equipe: string | null; jornada: 'pronto' | 'adm'; cnh: string[]; voluntarioJes: boolean };
    data: string; afastamento: string | null;           // "Férias", "Licença", "Afastado"
    disponibilidade: { inicio: string; fim: string }[]; // HH:MM, o que ele marcou no voluntariado
    servicos: ServicoNoDia[]; choques: string[];         // frases do motor, sem código de regra
    opcoes: OpcaoDeServico[];                           // "Adicionar serviço neste dia"
  };
  ```
- Rota `GET /api/unidades/:u/grade/:mes/militares/:militarId/dias/:data` (`CADASTRO`). A data precisa ser do mês: 400 "A data precisa ser do mês da grade.".
- **Opções:** para cada escala ativa da seção e cada faixa dos turnos dela, chamar `avaliarFaixa` uma vez com `guarnicaoId: null` e `somenteMilitar`. Os turnos aproveitáveis são os que têm `motivo` null ou `SEM_VOLUNTARIADO`, e este último marca `semVoluntariado`. Depois cruzar com as guarnições vinculadas àquela faixa no mês:
  - uma opção por função da composição, tirando as completas (ocupantes ≥ máximo) e as de CNH que ele não tem;
  - mais a opção "Sem guarnição" (`guarnicaoId: null`).

- [ ] **Step 1: Write the failing tests:**
  - `traz o militar, os serviços do dia com escala, horário, guarnição, função e acumulaCom, e os horários marcados`.
  - `afastado no dia mostra o afastamento e nenhuma opção`.
  - `as opções são só as que ele pode: sem a função de CNH D para quem só tem B, sem função completa, com "Sem guarnição"`.
  - `quem não marcou o horário aparece com semVoluntariado; o Saldo só aparece para o Adm`.
  - `um choque do dia vem como frase`.
  - `data de outro mês é 400`.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement** `montarPainelDoDia(c, unidadeId, militarId, data): Promise<PainelDoDia>`.
- [ ] **Step 4: Run** o arquivo, a suíte da API e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: painel do dia (API)`.

### Task 56: Trocar (API)

**Files:**
- Create: `apps/api/src/escala/trocar.ts`
- Modify: `pacotes/contratos/src/escala-do-mes.ts`, `apps/api/src/escala/rotas.ts`
- Test: `apps/api/test/trocar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const Troca = z.union([
    z.object({ militarId: Id, turnoId: Id }),   // substituir por um militar livre
    z.object({ comAlocacaoId: Id }),            // trocar de lugar com quem já está escalado
  ]);
  export type EscaladoNoDia = { militarId: string; posto: string; nomeGuerra: string; matricula: string;
    alocacoes: { alocacaoId: string; onde: string; permuta: boolean }[] }; // onde = "Ordinário, 20h–08h, Motorista do ABT"
  export type OpcoesDeTroca = { livres: Candidatos; escalados: EscaladoNoDia[] };
  ```
- `GET /api/alocacoes/:id/trocas`:
  - `livres` = `avaliarCandidatos` da vaga da alocação, sem o próprio militar;
  - `escalados` = os outros militares com alocação na seção no mesmo dia, por antiguidade;
  - `permuta` = os dois serviços são do tipo `ordinario`.
- `POST /api/alocacoes/:id/trocar` → 200 com `{ escalaId, mes }` das escalas mexidas; a tela invalida as consultas.
  - Substituição: `remover(tx, id, usuario)` e depois `escalar(tx, escala, { militarId, data, turnoId, guarnicaoId, funcaoId })`, tudo numa transação.
  - Troca: recusa se alguma das duas alocações tem acúmulo. Depois apaga as duas (sem marca de remoção) e chama `escalar` duas vezes, cada militar na vaga do outro (escala, data, turno, guarnição e função da outra alocação). Uma `Recusa` desfaz tudo e vira 409.
  - A alocação inexistente é 404, e as duas precisam ser da mesma seção.

- [ ] **Step 1: Write the failing tests:**
  - `trocas lista os livres e os escalados do dia com onde e permuta`.
  - `substituir: o atual sai com marca de remoção e o novo entra no turno escolhido`.
  - `trocar dois ordinários troca os lugares (permuta) sem marca de remoção`.
  - `trocar com quem não tem a CNH da vaga do outro é 409 com o motivo e nada muda` (Review Focus 3).
  - `com acúmulo é 409 "Tire os acúmulos antes de trocar."`.
  - `quem está em dois serviços no dia aparece com as duas alocações, e a troca usa a escolhida` (Review Focus 4).
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** o arquivo, a suíte da API e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: trocar (API)`.

### Task 57: Tela da Grade geral

**Files:**
- Create:
  - `apps/web/src/api/grade.ts` (`consultaGrade(unidadeId, mes)`, chave `['grade', unidadeId, mes]`);
  - `apps/web/src/componentes/grade/TabelaDaGrade.tsx`;
  - `apps/web/src/componentes/grade/CelulaDaGrade.tsx`;
  - `apps/web/src/componentes/grade/BarraComparativa.tsx`.
- Modify:
  - `apps/web/src/routes/_app/index.tsx`, que deixa de ser o aviso. `validateSearch`: `mes?`, `equipe?`, `militar?` e `dia?`.
  - `apps/web/src/api/escala-do-mes.ts` e `apps/web/src/api/efetivo-do-dia.ts`: as gravações invalidam também `['grade']`.
- Test: `apps/web/src/__testes__/grade.test.tsx`

**Interfaces:** Consumes `GradeDoMes` (Tarefa 54).

**A tela:**
- **Topo:** título "Grade geral", o seletor de mês (como o da Escala do mês) e os chips de equipe.
- **Tabela:**
  - o nome fica fixo à esquerda (posto, nome de guerra);
  - uma coluna por dia, com o número (vermelho no feriado) e a inicial do dia da semana;
  - uma linha de grupo por equipe;
  - no fim, as colunas PJES, Diárias e Voluntariado.
- **Célula:** um botão com os blocos em ordem.
  - Nome acessível: "SD BM ALFA, dia 12: Pronto A, JES A", ou "SD BM ALFA, dia 12: sem serviço".
  - Com choque, contorno vermelho e ", choque" no nome.
  - Fim de semana com fundo sombreado.
  - A célula escolhida (busca `militar` e `dia`) fica destacada.
- **`BarraComparativa({ valor, maximo })`:** o número sobre uma barra de largura `valor / maximo` (0 quando o máximo é 0).
- **Celular:** rolagem horizontal com o nome fixo.

- [ ] **Step 1: Write the failing tests:**
  - **Estrutura:**
    - `mostra os grupos na ordem da API e as linhas com os blocos (letra e cor)`;
    - `o feriado tem o número em vermelho e o fim de semana o fundo sombreado`;
    - `a célula com choque tem contorno e "choque" no nome`;
    - `o expediente é um bloco sem letra`.
  - **Colunas finais:**
    - `PJES e Diárias mostram o número com a barra proporcional ao maior da coluna em toda a grade`, por exemplo 4 de máximo 8 dá 50%;
    - `Voluntariado mostra "24h de 60h"`.
  - **Filtro:** `o chip "Equipe B" esconde os outros grupos e mantém a barra comparando com todos; fica na busca`.
  - **Clique:** `clicar na célula põe militar e dia na busca`.
  - **Invalidação:** `escalar na Escala do mês invalida a grade`. Escalar com `simularApi` e conferir uma segunda busca de `/grade/` com a grade aberta.
- [ ] **Step 2: Run** `cd apps/web && npx vitest run --maxWorkers=1 src/__testes__/grade.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `frontend-design` para a tabela. Siga o mockup v12 e os tokens atuais: vermelho só para choque e erro, âmbar para pendência.
- [ ] **Step 4: Run** a suíte do site e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: tela da grade geral`.

### Task 58: O painel do dia na grade (ver, adicionar e remover)

**Files:**
- Create: `apps/web/src/componentes/grade/PainelDoDia.tsx`, `apps/web/src/componentes/grade/AdicionarServico.tsx`
- Modify: `apps/web/src/api/grade.ts` (`consultaPainelDoDia(unidadeId, mes, militarId, data)`, chave `['grade', 'dia', …]`), `apps/web/src/routes/_app/index.tsx`
- Test: `apps/web/src/__testes__/grade.test.tsx`

**Interfaces:** Consumes `PainelDoDia` e `OpcaoDeServico` (Tarefa 55); `escalar`, `removerAlocacao` e `tirarAcumulo` de `api/escala-do-mes.ts`.

**O painel:**
- Fica à direita no computador e ocupa a tela no celular, no estilo do `FichaPainel`. Fecha com "Fechar", tirando `militar` e `dia` da busca.
- **Título:** posto e nome, com a matrícula ao lado. Em seguida, a equipe e a jornada, e as etiquetas de motorista (CNH) e de voluntário JES.
- **O dia:** a data por extenso; o afastamento, se houver; os horários marcados ("Marcou 08h–20h", ou "Não marcou voluntariado neste dia"); os choques em vermelho.
- **Cada serviço:** escala, serviço (com a cor), horário, guarnição e função, com "Trocar" (Tarefa 59) e "Remover" ou "Tirar acúmulo". Os avisos são os mesmos do Efetivo por dia: "Ele não volta para este turno…" e "Sai também de…".
- **"Adicionar serviço neste dia":**
  - as opções agrupadas por escala, como "08h–20h · ABT · Motorista";
  - com mais de um serviço, um seletor;
  - "não marcou voluntariado" quando for o caso;
  - escolher chama `escalar` (`POST /escalas/:e/alocacoes`);
  - sem opções: "Nenhum serviço disponível para ele neste dia.".
- **Erro:** aparece dentro do painel (`role="alert"`).

- [ ] **Step 1: Write the failing tests:**
  - **Abertura:** `abrir /?militar=m1&dia=… mostra o painel com os dados, os horários marcados e os serviços`.
  - **Adicionar:**
    - `"Adicionar serviço neste dia" lista as opções; escolher a do ABT Motorista manda o POST certo e busca a grade de novo`;
    - `com dois serviços na opção, o seletor escolhe o turno`.
  - **Remover:** `"Remover" chama o DELETE e mostra os avisos`.
  - **Erros:** `a recusa 409 ao adicionar aparece dentro do painel e a grade volta a ser buscada` (Review Focus 5).
  - **Fechar:** `"Fechar" tira militar e dia da busca`.
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site e `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: painel do dia na grade`.

### Task 59: Trocar no painel do dia

**Files:**
- Create: `apps/web/src/componentes/grade/TrocarServico.tsx`
- Modify: `apps/web/src/api/escala-do-mes.ts` (`consultaTrocas(alocacaoId)`, `trocar(queryClient, alocacaoId, troca)`), `apps/web/src/componentes/grade/PainelDoDia.tsx`
- Test: `apps/web/src/__testes__/grade.test.tsx`

**Interfaces:**
- Consumes: `OpcoesDeTroca` e `Troca`, mais `GET /alocacoes/:id/trocas` e `POST /alocacoes/:id/trocar` (Tarefa 56).
- `trocar` invalida `['grade']`, `['escala-do-mes']`, `['efetivo-do-dia']`, `['cotas']` e `['candidatos']`.

**O diálogo "Trocar":**
- Mostra duas listas:
  - "Livres", como em "Escolher militar", com o serviço quando há mais de um;
  - "Já escalados neste dia", cada um com os lugares onde está.
- **Escolher um livre:** confirmação "Trocar ALFA por CHARLIE?".
- **Escolher um lugar de um escalado:**
  - confirmação "BRAVO está no Ordinário, 20h–08h, Motorista do ABT.";
  - com `permuta`, a etiqueta "Permuta" e o botão "Fazer a permuta";
  - sem `permuta`, o botão "Trocar os dois".
- **Recusa (409):** aparece no diálogo.

- [ ] **Step 1: Write the failing tests:**
  - **Lista:** `"Trocar" lista livres e escalados`.
  - **Substituir:** `escolher um livre e confirmar manda { militarId, turnoId }`.
  - **Permuta:** `escolher o lugar de um escalado mostra onde ele está e "Permuta" quando os dois são ordinários; confirmar manda { comAlocacaoId }`.
  - **Dois lugares:** `quem está em dois lugares mostra os dois, e a troca usa o escolhido` (Review Focus 4).
  - **Recusa:** `a recusa aparece no diálogo` (Review Focus 5).
- [ ] **Step 2: Run** o arquivo. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** a suíte do site, `pnpm typecheck` e `pnpm build:vercel`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 4.4: trocar no painel do dia`. No fim da entrega:
  - atualizar as contagens no `CLAUDE.md` local;
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - revisão final (Opus);
  - PR com a lista curta para a sandbox.

---

# Entregas 3 a 6 (a detalhar antes de cada uma)

Cada uma ganha aqui as suas tarefas, no formato da entrega 1, depois do merge da anterior e da conversa com o usuário sobre o que a entrega 1 mostrou em uso.

- **Entrega 2.3 — Ajustes do voluntariado:** detalhada acima (Tarefas 22 a 27). A pré-escala (3) usa a flexibilidade ao filtrar quem pode ocupar cada vaga e nunca escala quem está fora do voluntariado.
- **Entrega 2.4 — Acabamento do voluntariado e da escala do mês:** detalhada acima (Tarefas 28 a 31).
- **Entrega 3 — Pré-escala e distribuições:** 3.1 (Tarefas 32 a 35), 3.2.1 (Tarefas 36 a 40), 3.2.2 (Tarefas 41 a 45) e 3.3 (Efetivo por dia, turnos lado a lado e login novo, Tarefas 46 a 53). "Completar com JES", saldos do Adm, operações pelas cotas e buracos do Pronto saíram da 3.3 e esperam entrega marcada (lista no fim da 3.3).
- **Entrega 4 — Grade geral:** detalhada acima (Tarefas 54 a 59), com o design de 20/11/2026 (`docs/superpowers/specs/2026-11-20-grade-geral-design.md`): painel interativo, clique na célula (militar e dia), filtro de equipes, colunas PJES, Diárias e Voluntariado, e "Trocar" (com permuta entre ordinários).
- **Entrega 5 — Gerar documento:** Configurações › Modelos de impressão (enviar com conferência dos marcadores, baixar o atual, versões); geração da escala publicada com ExcelJS a partir do modelo vigente da unidade, respeitando `militares_doc` e `dias_doc` da escala; `documento_gerado` guardado e baixável; PDF fica para quando o serviço existir.
- ~~**Entrega 6 — Minha escala**~~: saiu da fase 4 (decisão do usuário, 19/11/2026). O conteúdo previsto continua valendo e vai para a etapa "Tipos de usuário e módulos" do roadmap: a rota e a tela do militar comum (os próprios serviços do mês, com serviço, turno, horário e quem compõe a guarnição com ele) e o acesso às escalas publicadas da unidade em que ele está lotado.
