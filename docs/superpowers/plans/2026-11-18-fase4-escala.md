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

# Entrega 3 — Pré-escala e distribuições (dividida em 3.1 e 3.2)

Decisão do usuário (19/11/2026): a entrega 3 sai em duas, cada uma com o seu PR. A 3.1 é validada na sandbox antes de a 3.2 começar.

- **3.1 — Pré-escala do Pronto:** a equipe do dia 1 (detectada pelo mês anterior, com escolha manual), o preenchimento das vagas pela ordem de escala (o mais antigo apto em cada vaga), a prévia do que entra e do que fica de fora, e a gravação. Gerar de novo só completa lacunas e respeita as remoções.
- **3.2 — Buracos, saldos e operações:** completar as vagas que sobraram (JES e Saldo), as operações pelas cotas e a disposição da Escala do mês com os turnos lado a lado (pendência da 2.4). **As regras de negócio da 3.2 ainda dependem do usuário** (lista no fim desta seção); ela é detalhada depois do merge da 3.1, com as respostas.

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

# Entrega 3.2 — Buracos, saldos, operações e a disposição da Escala do mês (a detalhar depois da 3.1)

**Branch:** `fase4-3-2-distribuicoes`, a partir da `main` depois do merge da 3.1. As tarefas se detalham com as respostas do usuário às decisões abaixo. As tarefas previstas, a partir da Tarefa 36:

- **Completar os buracos do Pronto.** As vagas que a 3.1 deixou vazias são completadas na mesma ordem de escala, com quem pode no turno. A prévia e a gravação seguem o padrão da 3.1, e a flexibilidade do voluntariado já vale aqui.
- **Saldos do Adm.** `distribuirAdm` é adaptado às vagas, sempre com `servico` e `turno` preenchidos (pendência do motor).
- **Operações pelas cotas.** As escalas de PJES e diária são preenchidas pelas cotas do mês. `distribuirCotas` é adaptado às vagas das guarnições e ao voluntariado por faixa; `diagnosticarOperacoes` explica o que ficou de fora.
- **Disposição da Escala do mês** (pendência da 2.4, já decidida):
  - os turnos do dia passam a uma grade responsiva de ~20rem;
  - o turno com várias guarnições ocupa a linha inteira;
  - o card volta à largura natural, com as funções uma embaixo da outra.

**Decisões que faltam (do usuário, antes de detalhar a 3.2):**
1. **Ordem dos buracos do Pronto.** O design marca como "a confirmar": depois do Pronto da equipe, primeiro o JES e por último o Saldo (o "tapa-buraco")? Ou o Saldo, que é a obrigação de 6 por militar do Adm, entra antes do JES?
2. **Saldo que não cabe.** Se as vagas acabarem antes de o militar do Adm completar os 6 saldos do mês, ele fica com menos (e a prévia avisa)? Ou o saldo entra em "Sem guarnição", como o Pronto que sobra?
3. **Cota contra vaga, nas operações.** A cota (ex.: Bioma, N turnos no mês para a 1ª SB) limita quantas vagas da escala da operação a seção preenche? Quando a cota acaba antes das vagas, as vagas que sobram ficam vazias?
4. **Voluntária e compulsória.** Primeiro quem marcou o horário no voluntariado (com a flexibilidade) e, se a cota não fechar, a compulsória entre quem pode, igualando quem tem menos, como no protótipo (RN-41 e RN-43)? Ou só a voluntária nesta versão?

---

# Entregas 3 a 6 (a detalhar antes de cada uma)

Cada uma ganha aqui as suas tarefas, no formato da entrega 1, depois do merge da anterior e da conversa com o usuário sobre o que a entrega 1 mostrou em uso.

- **Entrega 2.3 — Ajustes do voluntariado:** detalhada acima (Tarefas 22 a 27). A pré-escala (3) usa a flexibilidade ao filtrar quem pode ocupar cada vaga e nunca escala quem está fora do voluntariado.
- **Entrega 2.4 — Acabamento do voluntariado e da escala do mês:** detalhada acima (Tarefas 28 a 31).
- **Entrega 3 — Pré-escala e distribuições:** dividida em 3.1 (detalhada acima, Tarefas 32 a 35) e 3.2 (tarefas previstas e decisões que faltam acima).
- **Entrega 4 — Grade geral:** consulta do mês por militar (agrupada por equipe, Adm à parte), blocos por serviço com a letra em ordem de início, turno que atravessa a meia-noite só no dia em que começa, choques do motor com contorno vermelho, feriados e fins de semana, pegas de pedidas por PJES e Diária; ficha lateral com Trocar, Remover e "Adicionar serviço neste dia", reaproveitando as rotas da entrega 1.
- **Entrega 5 — Gerar documento:** Configurações › Modelos de impressão (enviar com conferência dos marcadores, baixar o atual, versões); geração da escala publicada com ExcelJS a partir do modelo vigente da unidade, respeitando `militares_doc` e `dias_doc` da escala; `documento_gerado` guardado e baixável; PDF fica para quando o serviço existir.
- **Entrega 6 — Minha escala:** rota e tela do militar comum (os próprios serviços do mês, com serviço, turno, horário e quem compõe a guarnição com ele) e acesso às escalas publicadas (documentos gerados) da unidade em que ele está lotado; o trilho do militar comum mostra só isso.
