# Entrega 6.13 — O Pecúlio como origem dos dados: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a planilha do Pecúlio passa a importar todos os dados do militar, com só a matrícula obrigatória; a importação "Dados da escala" deixa de existir; o administrador apaga um militar; e os postos e graduações ficam editáveis nas Configurações.

**Architecture:**
- **Importação:** o importador do Pecúlio deixa de validar a linha inteira e passa a validar célula por célula. Cada coluna vira uma peça com a sua leitura e o seu motivo de recusa. A prévia ganha a lista das células ignoradas.
- **Apagar militar:** uma rota só do administrador, que apaga numa transação tudo o que aponta para o militar, depois de mostrar o que vai junto.
- **Postos:** uma rota de alteração e uma aba nas Configurações, só do administrador.

**Tech Stack:** Hono, Postgres, zod em `pacotes/contratos`, React com TanStack, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-peculio-design.md` ("Importação do Pecúlio" e "Quem edita o quê"), atualizada junto com este plano. As decisões abaixo são do usuário, de 23/11/2026.

**Branch:** `fase6-13-peculio-origem-dos-dados`, a partir da `main`. **Sem migração.** Vem depois da P1.5 e antes da 6.10.

**Fluxo:** o Sonnet executa e o Opus faz a revisão final. A DESENVOLVIMENTO abre o PR; a PLANEJAMENTO confere o CI e mescla.

## Decisões do usuário

1. **O Pecúlio é a origem dos dados do militar.** A planilha dele importa tudo, inclusive o que hoje vem pela "Dados da escala": equipe, jornada, motorista, CNH e voluntário JES.
2. **O módulo de escalas não importa militares.** A importação "Dados da escala" sai do sistema. A edição desses campos na ficha, pelo escalante da seção, não muda.
3. **Só a matrícula é obrigatória.** Qualquer outro dado ausente ou inconsistente não entra no banco, e o resto da linha entra.
4. **Militar novo** precisa de posto/graduação, nome de guerra e lotação válidos. Sem um deles, não é criado, e a prévia diz qual faltou.
5. **O administrador apaga um militar**, com tudo o que é dele. Hoje ninguém apaga, e há registros de teste presos no banco.
6. **Os postos e graduações são editáveis nas Configurações** (a sigla e o nome), pelo administrador.

## Global Constraints

- **Aba:** `PECÚLIO`. **Colunas**, nesta ordem: MATRÍCULA, POSTO/GRAD, NOME COMPLETO, NOME DE GUERRA, ANTIGUIDADE, SEXO, NASCIMENTO, TELEFONE, E-MAIL, COMPORTAMENTO, BOLETIM DO COMPORTAMENTO, CPF, CEP, LOGRADOURO, NÚMERO, COMPLEMENTO, BAIRRO, CIDADE, UF, LOTAÇÃO, QUADRO, SITUAÇÃO, JORNADA, EQUIPE, MOTORISTA, CNH, VOLUNTÁRIO JES.
- **Só a coluna MATRÍCULA precisa existir.** Coluna ausente = o sistema não mexe naquele dado.
- **Célula vazia = o sistema não mexe.** Nenhuma célula apaga um dado. Para apagar, a ficha.
- **Célula inválida = ignorada**, com o motivo na prévia; as outras células da linha valem.
- **O botão de importar nunca trava** por célula ignorada nem por linha recusada.
- **Rastreio de quem já existe** (quadro, situação, jornada, equipe): a mudança vale **a partir de hoje**, pelo período aberto, como o "Alterar situação". A LOTAÇÃO de quem já existe continua sem mudar por aqui, com o aviso de hoje.
- **O CPF nunca aparece inteiro** na prévia nem em mensagem: só os 4 últimos dígitos (`•••.•••.•47-25`).
- **Textos fixos:**
  - "Este CPF já está cadastrado em outro militar."
  - "Militar novo sem {dado}: não foi criado." (`{dado}`: posto/graduação, nome de guerra ou lotação)
  - "Isto não pode ser desfeito."
  - "Digite a matrícula para confirmar."
  - "Você não pode apagar o seu próprio cadastro."
- Quem importa continua sendo quem tem nível de acesso numa unidade acima da lotação do militar (`exigeDonoDoPeculio`).
- Nenhum dado pessoal real: matrículas `990xxx-x` e CPFs fictícios com dígitos válidos.
- No fim: `pnpm test && pnpm typecheck && pnpm build:vercel` e as contagens no `CLAUDE.md` local.

## Review Focus

1. **Planilha antiga, de 20 colunas, sem as sete novas:** importa normalmente, e ninguém perde equipe, jornada, motorista, CNH nem voluntário JES. Task 2.
2. **Sigla de posto renomeada nas Configurações:** a ordem de antiguidade nas escalas não muda, e a importação reconhece a sigla nova. Task 5.
3. **Linha com a equipe preenchida e a jornada ADM:** a equipe é ignorada com o motivo, e a jornada entra. Task 2.
4. **Apagar o militar que tem conta e está logado em outro navegador:** o pedido seguinte dele é recusado com "Entre no sistema para continuar.". Task 4.
5. **Célula NASCIMENTO que o Excel transformou em data:** é ignorada com o motivo, em vez de gravar o ano errado. Task 1.

---

### Task 1: a prévia por célula e as colunas do Pecúlio de hoje

**Files:**
- Modify: `pacotes/contratos/src/importacao.ts`, `apps/api/src/importacao/peculio.ts`
- Create: `apps/api/src/importacao/peculio-colunas.ts` (uma peça por coluna)
- Test: `apps/api/test/importacao-peculio.test.ts`, `apps/api/test/importacao-modelo.test.ts`

**Interfaces:**
- Produces, em `contratos`:
  - `type CelulaIgnorada = { linha: number; chave: string; coluna: string; motivo: string }`;
  - `Previa` ganha `ignoradas: CelulaIgnorada[]` (os outros importadores devolvem `[]`).
- Produces, em `peculio-colunas.ts`:
  - `type Leitura<T> = { vazio: true } | { valor: T } | { motivo: string }`;
  - uma função `ler<Coluna>(texto: string, ctx): Leitura<T>` por coluna, usada pela Task 2 também.

- [ ] **Step 1: testes.**
  - Planilha só com MATRÍCULA e TELEFONE: altera o telefone de quem existe e não toca em mais nada.
  - Célula vazia em cada uma das colunas de hoje: o dado do banco continua igual (um caso por coluna).
  - Telefone inválido e e-mail fora do domínio na mesma linha: os dois em `ignoradas`, com a coluna e o motivo, e o nome completo da mesma linha é gravado.
  - Posto inexistente para quem já existe: ignorado, e o posto atual fica.
  - E-mail de outro militar: ignorado. CPF de outro militar, ou repetido na planilha: ignorado com "Este CPF já está cadastrado em outro militar.", sem o nome do outro.
  - A mudança de CPF na prévia mostra `•••.•••.•47-25`, antes e depois.
  - Militar novo sem posto, sem nome de guerra ou sem lotação (três casos): vai para `problemas` com "Militar novo sem {dado}: não foi criado.", e a importação das outras linhas segue.
  - Militar novo só com os três dados: é criado, com o nome completo vazio.
  - Matrícula inválida ou repetida continua em `problemas`.
  - A regra "tem acesso ao sistema e a planilha está sem e-mail" sai (célula vazia não apaga).
  - **Review Focus 5:** NASCIMENTO vindo como data do Excel (`1985-03-15` ou número de série) é ignorado com "Use dd/mm/aaaa ou dd/mm, em formato de texto.".
  - No modelo, só MATRÍCULA sai como obrigatória, e a aba AJUDA diz: "Só a matrícula é obrigatória. Célula vazia não altera nada. Dado inválido é ignorado e aparece no resumo."
- [ ] **Step 2:** rodar `pnpm --filter api test importacao-peculio importacao-modelo`. Esperado: FAIL.
- [ ] **Step 3:** implementar. O `update` grava só as colunas que vieram com valor. A função `matriculaDe` vem para `peculio-colunas.ts`.
- [ ] **Step 4:** rodar `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.13: importação do Pecúlio célula por célula, só com a matrícula obrigatória"`

### Task 2: os dados da escala, o quadro e a situação na planilha do Pecúlio

**Files:**
- Modify: `apps/api/src/importacao/peculio.ts`, `apps/api/src/importacao/peculio-colunas.ts`, `apps/api/src/cadastros/periodo-aberto.ts`
- Test: `apps/api/test/importacao-peculio.test.ts`, `apps/api/test/cadastro-no-tempo.test.ts`

**Interfaces:**
- Consumes: `Leitura<T>` e `CelulaIgnorada` (Task 1).
- Produces, em `periodo-aberto.ts`: `mudarPeriodoAberto` passa a aceitar também `equipeId?: string | null` e `jornada?: 'pronto' | 'adm'`, com a mesma regra de hoje (corrige o período que começou hoje ou depois; senão fecha na véspera e abre outro).

- [ ] **Step 1: testes.**
  - **QUADRO:** a sigla de um quadro que tem o posto do militar (o da linha, se veio; senão o do banco) muda o período aberto a partir de hoje. Quadro que não tem o posto, ou que não existe, é ignorado com o motivo e a lista dos quadros que servem.
  - Um 2º TEN novo com QUADRO = QOA nasce no QOA; sem a coluna, nasce sem quadro, como hoje.
  - **SITUAÇÃO:** o nome de uma situação ativa do catálogo, sem diferenciar maiúsculas nem acentos; outra coisa é ignorada com a lista.
  - **JORNADA:** PRONTO ou ADM. **EQUIPE:** a equipe da lotação do militar; a que não existe é criada, e a prévia avisa, como a "Dados da escala" fazia.
  - **Review Focus 3:** EQUIPE com JORNADA ADM (da linha ou do banco) é ignorada com "No expediente não há equipe."; passar para ADM esvazia a equipe.
  - **MOTORISTA e VOLUNTÁRIO JES:** SIM, S, X, 1 valem sim; NÃO, NAO, N, 0 valem não; outra coisa é ignorada.
  - **CNH:** as letras juntas (`AD`); letra que não é categoria faz a célula inteira ser ignorada.
  - Militar novo sem essas colunas: Pronto, sem equipe, situação padrão, não motorista, sem CNH, não voluntário.
  - Quatro mudanças de rastreio na mesma linha (quadro, situação, jornada e equipe) geram um período novo só, a partir de hoje.
  - **Review Focus 1:** a planilha de 20 colunas de antes desta entrega importa sem tocar em equipe, jornada, motorista, CNH e voluntário JES.
  - Importar duas vezes a mesma planilha: na segunda, tudo cai em `iguais` e nenhum período novo é aberto.
- [ ] **Step 2:** rodar `pnpm --filter api test importacao-peculio cadastro-no-tempo`. Esperado: FAIL.
- [ ] **Step 3:** implementar. A aba AJUDA lista, da unidade: os postos, as lotações, os quadros, as situações ativas e as equipes de cada seção.
- [ ] **Step 4:** rodar `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.13: a planilha do Pecúlio importa todos os dados do militar"`

### Task 3: sai a importação "Dados da escala"

**Files:**
- Delete: `apps/api/src/importacao/dados-da-escala.ts`, `apps/api/test/importacao-dados-da-escala.test.ts`
- Modify: `apps/api/src/importacao/registro.ts`, `apps/api/test/importacao-modelo.test.ts`, `apps/api/test/corpo.test.ts`, `apps/api/test/isolamento-entre-unidades.test.ts`, `apps/web/src/routes/_app/militares.tsx`, `apps/web/src/componentes/ImportarPlanilha.tsx`, `apps/web/src/routes/_app/peculio.tsx`
- Test: `apps/web/src/__testes__/militares.test.tsx`, o teste do Pecúlio no site

- [ ] **Step 1: testes.**
  - `POST` e o modelo de `/api/unidades/:u/importacao/dados-da-escala` respondem 404.
  - A tela Militares, do módulo de escalas, não tem botão de importar.
  - A tela do Pecúlio mostra, depois da prévia, o bloco "Dados ignorados", com uma linha por célula: a linha da planilha, o militar, a coluna e o motivo. Com a lista vazia, o bloco não aparece.
  - O botão "Importar" fica ligado com células ignoradas e com linhas em `problemas`, desde que haja algo a gravar.
- [ ] **Step 2:** rodar `pnpm --filter api test importacao && pnpm --filter web test militares peculio`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar `pnpm test`. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.13: sai a importação Dados da escala; a prévia mostra os dados ignorados"`

### Task 4: o administrador apaga um militar

**Files:**
- Create: `apps/api/src/cadastros/apagar-militar.ts`, `apps/web/src/componentes/militares/ApagarMilitar.tsx`
- Modify: `apps/api/src/cadastros/militares.ts` (as duas rotas), `pacotes/contratos/src/militares.ts`, `apps/web/src/api/militares.ts`, a rota da ficha no site
- Test: `apps/api/test/apagar-militar.test.ts`, `apps/web/src/__testes__/militares.test.tsx`

**Interfaces:**
- Produces, em `contratos`:
  - `type OQueVaiJunto = { alocacoes: number; afastamentos: number; periodosDoRastreio: number; temConta: boolean; niveisDeAcesso: number; outros: number }`;
  - `ConfirmarExclusao = z.object({ matricula: z.string() }).strict()`.
- Produces, rotas (só o administrador; os outros, 403 "Só o administrador do sistema apaga um militar."):
  - `GET /api/militares/:id/exclusao` → `OQueVaiJunto`;
  - `DELETE /api/militares/:id` (`ConfirmarExclusao`) → 204.
- Produces, em `apagar-militar.ts`: `apagarMilitar(tx: Consulta, militarId: string): Promise<void>`.

- [ ] **Step 1: testes** em `apagar-militar.test.ts`.
  - O gestor e o auxiliar recebem 403; o administrador, 204.
  - A matrícula digitada errada é 400 "Digite a matrícula para confirmar.", e nada é apagado.
  - O administrador não apaga o próprio militar: 409 "Você não pode apagar o seu próprio cadastro.".
  - Um militar com alocações, remoção, acúmulo, afastamento, voluntariado, disponibilidade, três períodos de rastreio, conta com dois níveis de acesso e linhas na escala dos oficiais é apagado inteiro: depois, nenhuma tabela tem linha com o `id` dele. O teste descobre as tabelas pelo catálogo do banco (as chaves estrangeiras para `militar` e para `usuario`), para não envelhecer.
  - Onde a coluna aceita vazio (o turno dos oficiais), a linha fica e o militar sai dela.
  - O `GET` devolve as mesmas contagens que o `DELETE` apaga.
  - Tudo numa transação: com uma falha forçada no meio, nada some.
  - A auditoria guarda o `delete` do militar, com o administrador como autor.
  - **Review Focus 4:** a sessão aberta do militar apagado recebe 401 no pedido seguinte.
  - Os outros militares da mesma escala continuam com as suas alocações.
- [ ] **Step 2: testes** no site: "Apagar militar" só aparece para o administrador, no fim da ficha; o diálogo lista o que vai junto, mostra "Isto não pode ser desfeito." e só liga o botão com a matrícula digitada igual; depois de apagar, volta para a lista do Pecúlio.
- [ ] **Step 3:** rodar `pnpm --filter api test apagar-militar && pnpm --filter web test militares`. Esperado: FAIL.
- [ ] **Step 4:** implementar. A ordem das exclusões segue as chaves estrangeiras; gravar com `comUsuario`.
- [ ] **Step 5:** rodar `pnpm test`. Esperado: PASS.
- [ ] **Step 6:** `git commit -m "Fase 6.13: o administrador apaga um militar"`

### Task 5: postos e graduações nas Configurações

**Files:**
- Modify: `apps/api/src/cadastros/militares.ts` (ou um arquivo novo `cadastros/postos.ts`, se a rota não couber bem lá), `pacotes/contratos/src/militares.ts`, `apps/web/src/routes/_app/configuracoes.tsx`
- Create: `apps/web/src/componentes/configuracoes/Postos.tsx`
- Test: `apps/api/test/postos.test.ts`, `apps/api/test/pre-escala.test.ts`, `apps/web/src/__testes__/configuracoes.test.tsx`

**Interfaces:**
- Produces, em `contratos`: `NovoPosto = z.object({ sigla: z.string().trim().min(1).max(20), nome: z.string().trim().min(1).max(60) })`.
- Produces, rota: `PATCH /api/postos/:id` (`NovoPosto`) → `Posto`. Só o administrador (`exigirAdministradorRaiz`). Sigla repetida, sem diferenciar maiúsculas: 409 "Já existe um posto com esta sigla.".

- [ ] **Step 1: testes.**
  - O administrador muda a sigla e o nome; o gestor recebe 403; a mudança entra na auditoria.
  - A ordem dos postos não muda, e não há rota para criar nem apagar posto.
  - **Review Focus 2:** com "3º SGT BM" renomeado para "3º SGT", a pré-escala e a escala dos oficiais mantêm a mesma ordem de antiguidade de antes, e a importação do Pecúlio aceita "3º SGT". Se a ordem depender da sigla em algum ponto do motor, esse ponto passa a usar a `ordem` do posto.
  - O atalho da importação ("SD" vale como "SD BM") continua valendo só enquanto existir uma sigla terminada em "BM".
  - No site: a aba "Postos e graduações" só aparece para o administrador; lista os postos na ordem; edita a sigla e o nome numa linha por vez; mostra o erro de sigla repetida no campo.
- [ ] **Step 2:** rodar `pnpm --filter api test postos pre-escala && pnpm --filter web test configuracoes`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar `pnpm test && pnpm typecheck && pnpm build:vercel`. Esperado: PASS. Atualizar as contagens.
- [ ] **Step 5:** `git commit -m "Fase 6.13: postos e graduações editáveis nas Configurações"`
- [ ] **Step 6:** atualizar `docs/superpowers/specs/2026-11-16-telas.md` (Pecúlio, Militares e Configurações) e abrir o PR, com a lista para a sandbox:
  - importar uma planilha só com MATRÍCULA e mais uma coluna;
  - importar uma planilha com erros de propósito e ler os "Dados ignorados";
  - importar equipe, jornada e quadro e ver a Grade;
  - apagar um militar de teste;
  - corrigir a sigla de um posto e ver a Grade e a escala dos oficiais.
