# Camadas de visão e o chefe de divisão: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** separar o que a pessoa vê do que ela edita: as divisões na árvore, o nível "chefe de divisão", três camadas de visão com a borda nas Configurações, a consulta de militares para todos e as telas de escala só para leitura.

**Architecture:**
- **A edição não muda de lugar.** As rotas que gravam continuam conferindo o nível de acesso na hierarquia. O chefe de divisão entra nelas como um gestor da sua divisão.
- **A visão é um módulo à parte** (`apps/api/src/visao/`): uma função diz quais blocos uma pessoa vê de um militar ou de uma unidade, lendo a tabela `visao_bloco`. As rotas de consulta são novas, e só as leituras das telas de escala passam a aceitar a visão.
- **No site**, a consulta é um módulo novo, e o "só consulta" das escalas é um modo da unidade escolhida.

**Tech Stack:** Postgres (ltree), Hono, zod em `pacotes/contratos`, React com TanStack Router e Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-camadas-de-visao-design.md`.

**Entregas** (fase 6, depois da P1.5; uma branch e um PR por entrega):

| Entrega | Tema | Branch | Migração |
|---|---|---|---|
| 6.10 | As divisões e o chefe de divisão | `fase6-10-divisoes` | sim |
| 6.11 | As camadas de visão e a consulta de militares | `fase6-11-camadas-de-visao` | sim |
| 6.12 | As escalas só para leitura | `fase6-12-escalas-so-consulta` | não |

As migrações usam o próximo número livre na `main` (a P1.5 usa a 0030).

**Fluxo:** o Sonnet executa e o Opus faz a revisão final da branch. A DESENVOLVIMENTO abre o PR; a PLANEJAMENTO confere o CI e mescla; a migração no banco de teste só com a autorização do usuário.

## Global Constraints

- **Valores do banco:** nível `chefe_divisao`; tipo de unidade `divisao`; camadas `todos`, `oficial`, `chefe_divisao`; blocos `identificacao`, `contato`, `situacao`, `afastamentos`, `dados_da_escala`, `comportamento`, `escala_em_montagem`.
- **Nome na tela:** "Chefe de divisão", num lugar só (o mesmo mapa que traduz `escalante` para "Auxiliar administrativo"). É provisório.
- **Nenhuma camada de visão dá permissão de gravar.**
- **Campo de bloco que a pessoa não vê não vem na resposta da API.** A chave fica ausente; não vem `null` no lugar.
- **CPF, nascimento e endereço** nunca vêm nas rotas de consulta. Na ficha, só para quem tem nível de acesso numa unidade acima da lotação (`temPapelAcima`) e para o administrador.
- **`identificacao` para `todos` não se desliga** (o banco e a API recusam).
- **Borda inicial:** a tabela "Os blocos e a borda inicial" da spec, linha por linha.
- **Textos fixos:**
  - "Só consulta: você não altera nada em {unidade}."
  - "Mover a seção muda na hora quem tem acesso a ela."
  - "Digite pelo menos 3 letras ou escolha uma unidade."
  - "Há mais militares. Refine a busca."
  - "Chefe de divisão só existe numa divisão."
- Nenhum dado pessoal real. Matrículas `990xxx-x` e CPFs fictícios com dígitos válidos.
- No fim de cada entrega: `pnpm test && pnpm typecheck && pnpm build:vercel`, as contagens no `CLAUDE.md` local e o esquema do banco em dia quando houver migração.

## Review Focus

1. **Seção movida para outra divisão com gente logada:** o chefe da divisão antiga perde a edição dela no pedido seguinte, sem precisar sair e entrar. Task 3.
2. **Chefe de divisão cuja divisão não tem irmã:** entra e trabalha normalmente; o grupo "Só consulta" não aparece. Task 9.
3. **Militar sem lotação hoje na consulta:** aparece só com a Identificação, sem erro. Task 6.
4. **Oficial que muda de quadro com data futura:** a camada do oficial vale pelo quadro de hoje, não pelo futuro. Task 5.
5. **Busca com `%` ou `_` no texto:** são tratados como letras, e a busca não devolve a corporação inteira. Task 6.

---

# Entrega 6.10 — As divisões e o chefe de divisão

### Task 1: a migração

**Files:**
- Create: `apps/api/banco/migracoes/00NN_divisoes.sql`
- Test: `apps/api/test/migracao-00NN.test.ts`, `apps/api/test/esquema-estrutura.test.ts`

- [ ] **Step 1: testes.**
  - `tipo_unidade` tem `divisao` com nível 4 e `secao` com nível 5.
  - Cada grupamento ganha duas unidades do tipo `divisao`: "DA" (Divisão Administrativa) e "DivOp" (Divisão Operacional), com `desde` no dia 1 do mês da migração. As seções continuam direto no grupamento.
  - Rodar duas vezes não duplica as divisões.
  - `papel_usuario.papel` aceita `chefe_divisao`.
  - Inserir ou alterar um `chefe_divisao` numa unidade que não é `divisao` falha com "Chefe de divisão só existe numa divisão.".
  - Uma seção aceita como mãe um grupamento ou uma divisão; uma divisão não aceita uma seção como mãe.
- [ ] **Step 2:** rodar `pnpm --filter api test migracao-00NN esquema-estrutura`. Esperado: FAIL.
- [ ] **Step 3:** escrever a migração. O nível é único em `tipo_unidade`: passar a `secao` para 5 antes de inserir a `divisao` com 4. A regra do chefe é um gatilho em `papel_usuario`.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.10: migração das divisões e do nível chefe de divisão"`

### Task 2: o chefe de divisão na API

**Files:**
- Modify: `pacotes/contratos/src/usuarios.ts` (`Papel` ganha `'chefe_divisao'`), `apps/api/src/acesso.ts`, `apps/api/src/usuarios/rotas.ts` (`quemPodeDar` e as rotas de dar e encerrar), `apps/api/src/rotas/eu.ts`
- Test: `apps/api/test/acesso.test.ts`, `apps/api/test/usuarios.test.ts`

**Interfaces:**
- Produces, em `acesso.ts`:
  - `type Papel = 'administrador' | 'gestor' | 'chefe_divisao' | 'escalante'`;
  - `GESTAO: Papel[] = ['gestor', 'chefe_divisao', 'administrador']`, que substitui `ESCREVE_PARAMETRO`;
  - `CADASTRO` ganha `'chefe_divisao'`.

- [ ] **Step 1: testes.**
  - O chefe da DivOp altera um parâmetro e um cadastro de uma seção de dentro da DivOp (200), e recebe 403 numa seção da DA.
  - Ele dá e encerra os níveis de auxiliar e de gestor dentro da DivOp, e não dá `chefe_divisao` (403).
  - O gestor do grupamento dá `chefe_divisao` numa divisão; numa seção, 400 com "Chefe de divisão só existe numa divisão.".
  - O gestor de uma seção não dá `chefe_divisao`.
  - `unidadesParaPapel` de quem escolhe `chefe_divisao` só traz divisões (campo novo `tipo` em cada unidade da lista).
  - `/api/eu` devolve o nível `chefe_divisao` e, em `unidades`, a divisão e as seções de dentro.
- [ ] **Step 2:** rodar `pnpm --filter api test acesso usuarios eu`. Esperado: FAIL.
- [ ] **Step 3:** implementar. Onde o código testa `'gestor'` para editar, passa a usar `GESTAO`. "Ninguém encerra o próprio último nível de gestor" vale também para o chefe de divisão.
- [ ] **Step 4:** rodar `pnpm --filter api test`. Esperado: PASS, com o `isolamento-entre-unidades` sem mudança.
- [ ] **Step 5:** `git commit -m "Fase 6.10: o chefe de divisão edita como gestor na sua divisão"`

### Task 3: a estrutura na API

**Files:**
- Create: `apps/api/src/cadastros/estrutura.ts`, `pacotes/contratos/src/estrutura.ts`
- Modify: `apps/api/src/app.ts`, `pacotes/contratos/src/index.ts`
- Test: `apps/api/test/estrutura.test.ts`

**Interfaces:**
- Produces, em `contratos`:
  - `type NoDaEstrutura = { id: string; sigla: string; nome: string; tipo: 'grupamento' | 'divisao' | 'secao'; filhas: NoDaEstrutura[] }`;
  - `NovaDivisao = z.object({ sigla: z.string().trim().min(1).max(20), nome: z.string().trim().min(1).max(80) })`;
  - `DivisaoDaSecao = z.object({ divisaoId: z.string().uuid().nullable() })`.
- Produces, rotas (só `gestor` ou `administrador` com nível no grupamento; o chefe de divisão recebe 403):
  - `GET /api/unidades/:u/estrutura` → `NoDaEstrutura` (`:u` é um grupamento; outro tipo, 400);
  - `POST /api/unidades/:u/divisoes` (`NovaDivisao`) → 201 `NoDaEstrutura`;
  - `PATCH /api/divisoes/:id` (`NovaDivisao`) → `NoDaEstrutura`;
  - `PUT /api/secoes/:id/divisao` (`DivisaoDaSecao`) → `NoDaEstrutura` do grupamento. `null` devolve a seção ao grupamento.

- [ ] **Step 1: testes.**
  - A árvore traz as divisões e as seções na ordem das siglas.
  - Criar, renomear, e a sigla repetida no mesmo grupamento é 409.
  - Mover a 1ª SB para a DivOp: o caminho da seção e dos registros de baixo acompanha.
  - **Review Focus 1:** com a 1ª SB na DivOp, o chefe da DivOp edita nela; depois de movê-la para a DA, o pedido seguinte dele é 403, com a mesma sessão.
  - Divisão de outro grupamento é 400; quem não é gestor do grupamento, 403; tudo gravado com `comUsuario` (auditoria).
- [ ] **Step 2:** rodar `pnpm --filter api test estrutura`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.10: a estrutura do grupamento na API"`

### Task 4: as telas

**Files:**
- Create: `apps/web/src/api/estrutura.ts`, `apps/web/src/componentes/configuracoes/Estrutura.tsx`
- Modify: `apps/web/src/routes/_app/configuracoes.tsx` (aba "Estrutura"), `apps/web/src/api/eu.ts` (`Papel` e `ehGestorOuAdministrador`, que passa a incluir o chefe de divisão), o bloco "Acesso ao sistema" da ficha
- Test: `apps/web/src/__testes__/configuracoes.test.tsx`, o teste do Acesso ao sistema

- [ ] **Step 1: testes.**
  - A aba "Estrutura" só aparece para o gestor do grupamento e o administrador.
  - Ela mostra o grupamento, as divisões e as seções; cria e renomeia uma divisão.
  - Mover uma seção mostra "Mover a seção muda na hora quem tem acesso a ela." e só grava depois de confirmar.
  - No "Dar nível de acesso", escolher "Chefe de divisão" deixa na lista só as divisões.
  - A lista de níveis da ficha mostra "Chefe de divisão".
- [ ] **Step 2:** rodar `pnpm --filter web test configuracoes militares`. Esperado: FAIL.
- [ ] **Step 3:** implementar. A árvore é uma lista com recuo, sem arrastar: cada seção tem um seletor "Divisão".
- [ ] **Step 4:** rodar `pnpm --filter web test`. Esperado: PASS. Depois, as verificações do fim de entrega e o esquema do banco.
- [ ] **Step 5:** `git commit -m "Fase 6.10: a tela Estrutura e o nível chefe de divisão"`
- [ ] **Step 6:** abrir o PR, com a lista para a sandbox: pôr seções nas duas divisões; dar o nível de chefe de divisão; entrar com ele e alterar algo na própria divisão; tentar na outra.

---

# Entrega 6.11 — As camadas de visão e a consulta de militares

### Task 5: a migração e a borda na API

**Files:**
- Create: `apps/api/banco/migracoes/00NN_camadas_de_visao.sql`, `apps/api/src/visao/visao.ts`, `apps/api/src/visao/rotas.ts`, `pacotes/contratos/src/visao.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/cadastros/quadros.ts`, `pacotes/contratos/src/index.ts`
- Test: `apps/api/test/migracao-00NN.test.ts`, `apps/api/test/visao.test.ts`

**Interfaces:**
- Produces, banco:
  - `quadro.oficial boolean not null default false` (QOC e QOA nascem `true`);
  - `visao_bloco (bloco text, camada text, ve boolean not null, primary key (bloco, camada))`, com `check` nos valores, as 21 linhas da borda inicial, e a regra de que `identificacao`/`todos` não vira `false`.
- Produces, em `contratos`:
  - `Bloco = z.enum([...os 7])`, `Camada = z.enum(['todos', 'oficial', 'chefe_divisao'])`;
  - `type Borda = { bloco: Bloco; todos: boolean; oficial: boolean; chefeDivisao: boolean }[]`;
  - `NovaBorda = z.array(z.object({ bloco: Bloco, todos: z.boolean(), oficial: z.boolean(), chefeDivisao: z.boolean() })).length(7)`.
- Produces, em `visao.ts`:
  - `camadasSobreUnidade(c: Consulta, usuarioId: string, unidadeId: string | null, hoje: string): Promise<Camada[]>` (`todos` sempre; `oficial` pelo quadro do período de hoje de quem pede; `chefe_divisao` quando a unidade está numa divisão irmã de uma em que a pessoa tem o nível vigente, ou abaixo dela);
  - `blocosDaUnidade(c: Consulta, usuarioId: string, unidadeId: string | null, hoje: string): Promise<Set<Bloco>>` (a união das camadas; todos os 7 para quem tem `CADASTRO` na unidade ou acima);
  - `blocosDoMilitar(c: Consulta, usuarioId: string, militarId: string, hoje: string): Promise<Set<Bloco>>` (pela lotação de hoje; sem lotação, só o que as camadas `todos` e `oficial` liberam de `identificacao`).
- Produces, rotas:
  - `GET /api/visao` → `Borda` (administrador);
  - `PUT /api/visao` (`NovaBorda`) → `Borda` (administrador; 400 ao desligar `identificacao` de `todos`);
  - `PATCH /api/quadros/:id` (`{ oficial: boolean }`) (administrador).

- [ ] **Step 1: testes** da migração: as 21 linhas com os valores da spec; QOC e QOA `oficial`; o banco recusa `identificacao`/`todos` = `false`.
- [ ] **Step 2: testes** de `visao.ts`, com a borda inicial:
  - o militar comum vê só `identificacao` de um militar de outra seção e de outro grupamento;
  - o oficial vê `contato`, `situacao`, `afastamentos` e `dados_da_escala`, e não vê `comportamento` nem `escala_em_montagem`;
  - o chefe da DivOp vê os 7 de uma seção da DA, e de uma seção de outro grupamento só o que o quadro dele dá;
  - o auxiliar da 1ª SB vê os 7 dos militares da 1ª SB;
  - desligar `contato` do oficial e ligar em `todos`: o oficial continua vendo (as camadas se somam);
  - **Review Focus 4:** o oficial com mudança para o QBMG marcada para o mês que vem ainda tem a camada hoje.
- [ ] **Step 3: testes** das rotas: só o administrador lê e grava; a gravação entra na auditoria.
- [ ] **Step 4:** rodar `pnpm --filter api test migracao-00NN visao`. Esperado: FAIL.
- [ ] **Step 5:** implementar.
- [ ] **Step 6:** rodar `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 7:** `git commit -m "Fase 6.11: a borda das camadas de visão"`

### Task 6: a consulta e o CPF na API

**Files:**
- Create: `apps/api/src/visao/consulta.ts`, `pacotes/contratos/src/consulta.ts`
- Modify: `apps/api/src/visao/rotas.ts`, `apps/api/src/cadastros/militares.ts` (`carregarFicha` e a lista do Pecúlio), `pacotes/contratos/src/militares.ts`
- Test: `apps/api/test/consulta.test.ts`, `apps/api/test/militares.test.ts`, `apps/api/test/isolamento-entre-unidades.test.ts`

**Interfaces:**
- Consumes: `blocosDoMilitar` (Task 5).
- Produces, em `contratos`:
  - `type LinhaDaConsulta = { id: string; postoGrad: string; nomeGuerra: string; nomeCompleto: string | null; matricula: string; lotacao: string | null; quadro: string | null }`;
  - `type ResultadoDaConsulta = { militares: LinhaDaConsulta[]; haMais: boolean }`;
  - `type FichaDeConsulta = LinhaDaConsulta & { contato?: { telefone: string | null; email: string | null }; situacao?: { equipe: string | null; jornada: 'pronto' | 'adm'; situacaoDoMilitar: string; historico: { desde: string; ate: string | null; lotacao: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacaoDoMilitar: string }[] }; afastamentos?: { tipo: string; inicio: string; fim: string; motivo?: string | null; boletim?: string | null }[]; dadosDaEscala?: { motorista: boolean; cnh: string[]; voluntarioJes: boolean }; comportamento?: { comportamento: string | null; boletim: string | null }; podeAbrirFichaCompleta: boolean }`. `motivo` e `boletim` do afastamento só vêm com o bloco `comportamento`;
  - a ficha completa ganha `veDadosRestritos: boolean`; sem ele, `cpf`, `nascimento` e `endereco` não vêm.
- Produces, rotas (qualquer sessão):
  - `GET /api/consulta/unidades` → a árvore da corporação (`{ id, sigla, nivel }[]`, na ordem da árvore);
  - `GET /api/consulta/militares?texto=&unidadeId=` → `ResultadoDaConsulta`;
  - `GET /api/consulta/militares/:id` → `FichaDeConsulta`.

- [ ] **Step 1: testes** em `consulta.test.ts`.
  - Sem texto de 3 letras e sem unidade: 400 "Digite pelo menos 3 letras ou escolha uma unidade.".
  - Acha por nome de guerra, nome completo e matrícula, sem diferenciar maiúsculas nem acentos; com a unidade, traz ela e as de baixo.
  - 51 resultados: vêm 50 e `haMais: true`.
  - **Review Focus 5:** o texto `%%%` não devolve ninguém.
  - O militar comum recebe a ficha de consulta sem as chaves `contato`, `situacao`, `afastamentos`, `dadosDaEscala` e `comportamento` (conferir com `Object.keys`).
  - O oficial recebe `afastamentos` sem `motivo` e sem `boletim`.
  - **Review Focus 3:** o militar sem lotação aparece na busca e na ficha, só com a identificação.
  - Nenhuma resposta de `/api/consulta/*` contém as chaves `cpf`, `nascimento` ou `endereco`, nem para o administrador.
  - `podeAbrirFichaCompleta` é `true` só para quem tem `CADASTRO` na lotação do militar.
- [ ] **Step 2: testes** em `militares.test.ts`: o auxiliar da 1ª SB abre a ficha de um militar da 1ª SB com `veDadosRestritos: false` e sem `cpf`, `nascimento` e `endereco`; o auxiliar do 2º GB recebe os três; a lista do Pecúlio segue a mesma regra.
- [ ] **Step 3:** no `isolamento-entre-unidades`, as rotas `/api/consulta/*` e `/api/visao` ficam fora da varredura, com o motivo no comentário, como `/api/sistema`.
- [ ] **Step 4:** rodar `pnpm --filter api test consulta militares isolamento`. Esperado: FAIL.
- [ ] **Step 5:** implementar. A busca escapa `%`, `_` e `\` antes do `ilike`.
- [ ] **Step 6:** rodar `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 7:** `git commit -m "Fase 6.11: a consulta de militares e o CPF só para quem cuida do Pecúlio"`

### Task 7: as telas

**Files:**
- Create: `apps/web/src/api/consulta.ts`, `apps/web/src/api/visao.ts`, `apps/web/src/routes/_app/consulta.tsx`, `apps/web/src/routes/_app/consulta_.$id.tsx`, `apps/web/src/componentes/configuracoes/QuemVeOQue.tsx`
- Modify: `apps/web/src/lib/modulos.ts` (módulo `consulta`, "Consulta de militares", visível a todos), `apps/web/src/routes/_app/configuracoes.tsx` (aba "Quem vê o quê"), o bloco de dados pessoais da ficha
- Test: `apps/web/src/__testes__/consulta.test.tsx`, `modulos.test.ts`, `inicio.test.tsx`, `configuracoes.test.tsx`, o teste da ficha

- [ ] **Step 1: testes.**
  - O militar comum vê o cartão "Consulta de militares" na tela inicial.
  - A busca mostra as linhas, o aviso "Há mais militares. Refine a busca." e a mensagem de busca curta.
  - A ficha de consulta mostra só os blocos que vieram, sem botão de editar e sem texto de "sem acesso".
  - "Abrir a ficha completa" só aparece com `podeAbrirFichaCompleta`.
  - "Quem vê o quê": 7 linhas e 3 colunas; marcar "Todos" marca e trava as outras duas; "Identificação" de "Todos" fica travada; a lista de quadros com a marca "de oficiais"; só o administrador vê a aba.
  - Na ficha completa, sem `veDadosRestritos`, CPF, nascimento e Endereço não aparecem.
- [ ] **Step 2:** rodar `pnpm --filter web test consulta modulos inicio configuracoes militares`. Esperado: FAIL.
- [ ] **Step 3:** implementar. A ficha de consulta reaproveita o `Secao` da ficha, só para leitura.
- [ ] **Step 4:** rodar `pnpm --filter web test`. Esperado: PASS. Depois, as verificações do fim de entrega e o esquema do banco.
- [ ] **Step 5:** `git commit -m "Fase 6.11: a consulta de militares e a tela Quem vê o quê"`
- [ ] **Step 6:** abrir o PR, com a lista para a sandbox: buscar um militar de outra seção como militar comum, como oficial e como chefe de divisão; mudar uma marca em "Quem vê o quê" e buscar de novo; abrir a ficha como auxiliar da seção e conferir que o CPF não aparece.

---

# Entrega 6.12 — As escalas só para leitura

### Task 8: as leituras na API

**Files:**
- Modify: `apps/api/src/acesso.ts`, `apps/api/src/rotas/eu.ts`, `pacotes/contratos/src/usuarios.ts`, e os `GET` usados pelas cinco telas em `grade/rotas.ts`, `escala/rotas.ts`, `efetivo/rotas.ts`, `voluntariado/rotas.ts`, `cadastros/cotas.ts`, `cadastros/escalas.ts`, `cadastros/servicos.ts`, `cadastros/guarnicoes.ts`, `cadastros/feriados.ts` e `cadastros/militares.ts` (`/unidades/:u/equipes`)
- Test: `apps/api/test/so-consulta.test.ts`, `apps/api/test/eu.test.ts`

**Interfaces:**
- Consumes: `blocosDaUnidade` (Task 5).
- Produces, em `acesso.ts`: `exigirLeituraDaEscala(c: Context<AmbienteApi>, unidadeId: string): Promise<Response | null>`: passa quem tem `CADASTRO` na unidade ou acima, ou quem vê `escala_em_montagem` dela; senão, o 403 de hoje.
- Produces, em `/api/eu`: `unidadesSoConsulta: UnidadeDeTrabalho[]`, as unidades cuja `escala_em_montagem` a pessoa vê e que não estão em `unidades`, na ordem da árvore.

- [ ] **Step 1: testes** em `so-consulta.test.ts`, com o chefe da DivOp e uma seção da DA.
  - Cada `GET` que as telas Grade geral, Escala do mês, Efetivo por dia, Cotas e Voluntariado chamam responde 200. A lista desses `GET` sai dos arquivos de `apps/web/src/api/` das cinco telas e fica escrita no teste.
  - **Todo** pedido que não é `GET` com a unidade ou um registro da seção da DA responde 403: a mesma varredura do `isolamento-entre-unidades`, com o chefe de divisão no lugar do escalante.
  - Os outros `GET` da seção (Militares, ficha, Pecúlio, Configurações, Oficiais, importações) continuam 403.
  - Nenhuma dessas respostas traz o motivo ou o boletim de um afastamento, CPF, nascimento ou endereço.
  - O oficial comum e o militar comum recebem 403 nos mesmos `GET`, com a borda inicial; com `escala_em_montagem` ligada para `oficial`, o oficial passa.
- [ ] **Step 2: testes** em `eu.test.ts`: o chefe da DivOp tem as unidades da DA em `unidadesSoConsulta`; **Review Focus 2:** sem divisão irmã, a lista vem vazia; o gestor do grupamento tem a lista vazia (tudo já está em `unidades`).
- [ ] **Step 3:** rodar `pnpm --filter api test so-consulta eu`. Esperado: FAIL.
- [ ] **Step 4:** implementar: trocar o `exigirPapel(c, u, CADASTRO)` desses `GET` por `exigirLeituraDaEscala`. Um `GET` que hoje devolve motivo de afastamento ou dado restrito passa a omiti-lo para quem não tem `CADASTRO` na unidade.
- [ ] **Step 5:** rodar `pnpm --filter api test`. Esperado: PASS, com o `isolamento-entre-unidades` sem mudança.
- [ ] **Step 6:** `git commit -m "Fase 6.12: as leituras das escalas aceitam a visão"`

### Task 9: o modo "só consulta" no site

**Files:**
- Modify: `apps/web/src/lib/unidade-de-trabalho.ts`, `apps/web/src/api/eu.ts` (`Eu` ganha `soConsulta: boolean`), `apps/web/src/componentes/Topo.tsx` (o seletor), `apps/web/src/routes/_app.tsx`, `apps/web/src/lib/modulos.ts`, `apps/web/src/componentes/Trilho.tsx`, e as telas `grade.tsx`, `escala-do-mes.tsx`, `efetivo-por-dia.tsx`, `efetivo-do-dia.tsx`, `cotas.tsx`, `voluntariado.tsx`
- Create: `apps/web/src/componentes/FaixaSoConsulta.tsx`
- Test: `apps/web/src/__testes__/unidade-de-trabalho.test.tsx`, `casca.test.tsx`, e os testes das cinco telas

- [ ] **Step 1: testes.**
  - O seletor mostra o grupo "Só consulta" com as unidades de `unidadesSoConsulta`; **Review Focus 2:** com a lista vazia, o grupo não aparece.
  - Com uma unidade só de consulta escolhida: a faixa "Só consulta: você não altera nada em {unidade}." aparece nas cinco telas; o trilho só tem Grade geral, Escala do mês, Efetivo por dia, Voluntariado e Cotas.
  - Em cada uma das cinco telas, nenhum botão ou campo de alterar aparece (um teste por tela, pelos nomes dos botões de hoje).
  - Abrir `/militares` nesse modo leva à Grade geral.
  - A unidade de consulta escolhida não é lembrada na próxima entrada: o sistema abre na última unidade de trabalho.
  - Quem só tem unidades de consulta (o oficial, com a marca ligada) vê o cartão "Confecção de escalas" e entra já no modo de consulta.
- [ ] **Step 2:** rodar `pnpm --filter web test unidade-de-trabalho casca grade escala-do-mes efetivo cotas voluntariado`. Esperado: FAIL.
- [ ] **Step 3:** implementar. As telas leem `eu.soConsulta` num lugar só (um gancho `useSoConsulta()`), em vez de cada botão conferir o nível.
- [ ] **Step 4:** rodar `pnpm --filter web test`. Esperado: PASS. Depois, as verificações do fim de entrega.
- [ ] **Step 5:** `git commit -m "Fase 6.12: as telas de escala no modo só consulta"`
- [ ] **Step 6:** atualizar `docs/superpowers/specs/2026-11-16-telas.md` (navegação, consulta e o modo só consulta) e abrir o PR, com a lista para a sandbox: como chefe de divisão, escolher uma seção da outra divisão e percorrer as cinco telas; tentar alterar algo; voltar à própria divisão e alterar.
