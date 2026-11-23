# Fase 6 — Usuários e módulos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-11-21-usuarios-e-modulos-design.md`. Na entrega 4, também `docs/superpowers/specs/2026-11-20-transicao-login-design.md`.

**Entregas da fase** (o número é a ordem de execução):
1. **Contas e papéis:** a senha provisória, a troca obrigatória no primeiro login, desativar o acesso, os papéis na ficha e o nome "Auxiliar administrativo". **Mesclada (#86), migração 0025 aplicada no teste.**
2. **Unidade de trabalho:** o seletor de unidade substitui a 1ª SB fixa; antes, a folga do auxiliar na senha provisória (decisão de 21/11/2026). **Mesclada (#88).**
3. **Tela inicial e módulos:** os cartões por papel, o trilho por módulo e a Minha ficha com o próprio telefone; antes, a conta desativada só volta por quem dá o papel (decisão de 21/11/2026). **Mesclada (#90).**
4. **Transição do login** (as mangueiras): o mockup foi aprovado pelo usuário em 22/11/2026. **Detalhada abaixo** (Tasks 26 e 27); sem migração.
5. **Retorno da validação, parte sem mockup** (lote de 21/11/2026): recolher equipe na Grade geral, rastreio por dia e "Vale desde" do modelo de guarnição aceitando mês passado. **Detalhada abaixo. Começa depois da P1.3 e da P1.4** (entrega paralela, decisão do usuário de 22/11/2026).
6. **Retorno da validação, parte com mockup** (mesmo lote): sete ajustes de interface que esperam o mockup da DESIGN. Lista no fim; as tarefas são escritas quando o mockup for aprovado.
7. **Militares só no Pecúlio** (decisão do usuário, 22/11/2026): o "Novo militar" passa ao Pecúlio, e a importação de MILITARES vira a importação "Dados da escala", que atualiza e não cria. **Detalhada abaixo.**
8. **Acesso ao sistema e busca do Pecúlio** (pool 3 da validação, 22/11/2026): "nível de acesso" no lugar de "papel", um formulário por vez, o "até" ao dar o nível de acesso e o Enter na busca do Pecúlio. **Detalhada abaixo.**
9. **Pendências de cadastro** (decisões do usuário, 22/11/2026): quadro e situação do militar com data, no rastreio; o catálogo de situações; ano de nascimento, CPF e endereço na ficha e na importação do Pecúlio. **Detalhada abaixo.**
10. a 12. **Camadas de visão e o chefe de divisão** (decisão do usuário, 23/11/2026): as divisões e o quinto nível de acesso; a borda do que cada um vê e a consulta de militares; as escalas só para leitura. **Plano à parte:** `docs/superpowers/plans/2026-11-23-camadas-de-visao.md`.
13. **O Pecúlio como origem dos dados** (decisões do usuário, 23/11/2026): a planilha do Pecúlio importa tudo, só com a matrícula obrigatória; sai a importação "Dados da escala" da entrega 7; o administrador apaga um militar; postos editáveis. **Executada antes da 10.** Plano à parte: `docs/superpowers/plans/2026-11-23-fase6-13-peculio-origem-dos-dados.md`.
14. **A animação de entrada como preferência** (pedido do usuário, 23/11/2026): cada pessoa escolhe se a animação toca em toda entrada, uma vez a cada 12 h ou nunca. **Detalhada no fim.** Pequena e independente: executada logo depois da P1.5, antes da 13.

O retorno da validação que chegar durante a fase vira uma entrega depois da última prevista.

**Fluxo:** o Sonnet executa e o Opus faz a revisão final do branch. Ao terminar cada entrega, a DESENVOLVIMENTO envia o branch e o resumo à PLANEJAMENTO, sem abrir PR nem mesclar. A PLANEJAMENTO abre o PR, mescla e avisa a VALIDAÇÃO.

**Valem para todas as entregas:**
- Nenhum dado pessoal real (D7). Matrículas `990xxx-x`; e-mails `@bombeiros.pe.gov.br` fictícios nos testes da ficha. O `apoio-api.ts` continua com `@exemplo.test` para os usuários de teste.
- O escalante nunca é bloqueado de fechar a escala.
- Textos sem jargão, em frases curtas.
- No fim de cada entrega:
  - `pnpm test && pnpm typecheck && pnpm build:vercel`;
  - as contagens no `CLAUDE.md` local;
  - o esquema (`docs/superpowers/specs/2026-11-16-esquema-banco.md`) atualizado quando houver migração.

---

# Entrega 1 — Contas e papéis

**Goal:** o auxiliar ou o gestor dá acesso a um militar com uma senha provisória, e o gestor dá e tira papéis, tudo na ficha. O militar entra e troca a senha antes de qualquer outra tela.

**Architecture:**
- **Migração:** o usuário ganha o prazo da senha provisória, e um gatilho mantém o e-mail de entrada igual ao da ficha.
- **API:** rotas novas em `apps/api/src/usuarios/`, que conferem o papel com as funções de `acesso.ts`. O `/api/eu` diz quando a senha precisa ser trocada, e a sessão fica restrita até a troca.
- **Site:** um bloco "Acesso ao sistema" no fim da ficha e a tela "Crie a sua senha".

**Tech Stack:** Postgres, Hono, Better Auth (`hashPassword` de `better-auth/crypto`), zod (`pacotes/contratos`), React + TanStack, Vitest.

**Branch:** `fase6-1-contas-e-papeis`. Commits `Fase 6.1: …`. **Migração 0025:** o resumo avisa `pnpm --filter api db:migrar:teste`.

## Global Constraints

- **Nomes dos papéis nas telas e nas mensagens:** "Administrador", "Gestor", "Auxiliar administrativo". O valor `escalante` no banco e no código não muda.
- **Senha provisória:**
  - 12 letras e números do alfabeto `abcdefghjkmnpqrstuvwxyz23456789`, sem 0, o, 1, l e i, em três grupos de quatro separados por hífen (ex.: `k7mq-3tav-p9xe`);
  - vale **7 dias**;
  - aparece **uma vez**.
- **Senha definitiva:** mínimo de 10 caracteres, como hoje.
- **Textos fixos:**
  - sem e-mail: "Preencha o e-mail institucional para dar acesso.";
  - senha provisória vencida: "Sua senha provisória venceu. Peça uma senha nova ao auxiliar administrativo da sua seção.";
  - "Esqueci minha senha": "Peça uma senha nova ao auxiliar administrativo da sua seção.";
  - último papel de gestor: "Você não pode encerrar o seu último papel de gestor. Peça a outro gestor ou ao administrador.";
  - antes da troca: "Crie a sua senha antes de continuar.".

**Decisões desta entrega** (do usuário, no design; as minhas estão marcadas):
- O prazo fica em `usuario.senha_provisoria_ate` (timestamptz; null = senha definitiva). A tabela `convite`, sem uso, é removida. *Minha decisão:* uma coluna basta, e o `convite` só confundiria.
- O e-mail de entrada é o da ficha. O gatilho `militar_email_para_usuario` copia `lower(militar.email)` para `usuario.email`. Apagar o e-mail de quem tem usuário é barrado: 409 no campo, com "Desative o acesso antes de apagar o e-mail.". *Minha decisão:* o login exige e-mail.
- Dar papel a quem não tem conta cria o `usuario` sem senha. A situação continua "sem acesso" até a primeira senha provisória.
- Gerar a senha numa conta desativada reativa a conta.
- O militar comum continua sem rota nova nesta entrega. A Minha ficha é da entrega 3.

## Review Focus

1. **Senha provisória gerada duas vezes:** a primeira deixa de entrar, a segunda entra, e a sessão aberta com a primeira cai. Task 2.
2. **Militar com senha provisória chama uma rota de cadastro direto, sem passar pela tela de troca:** recebe 403 com "Crie a sua senha antes de continuar.". Task 2.
3. **Gestor da 1ª SB tenta dar papel no 2º GB, ou dar papel de administrador:** 403, e nada é gravado. Task 3.
4. **Mudar o e-mail na ficha de quem tem conta:** o login passa a ser pelo e-mail novo, e o antigo deixa de entrar. Task 1.
5. **Senha provisória vencida, com a senha certa:** a tela de entrar mostra a mensagem de vencida, não "E-mail ou senha incorretos.". Task 2 (API) e Task 4 (site).

---

### Task 1: Migração 0025, o e-mail de entrada e o apoio dos testes

**Files:**
- Create: `apps/api/banco/migracoes/0025_contas_e_papeis.sql`
- Modify: `apps/api/src/cadastros/militares.ts` (PATCH: 409 do e-mail apagado com usuário)
- Modify: `apps/api/test/apoio-api.ts` (função para criar um militar com e-mail e lotação, usada pelas tasks 2 e 3)
- Test: `apps/api/test/esquema-estrutura.test.ts`, `apps/api/test/militares.test.ts`

**Interfaces:**
- Produces:
  - coluna `usuario.senha_provisoria_ate timestamptz null`;
  - gatilho `militar_email_para_usuario`, que atualiza `usuario.email` e barra o e-mail nulo com a mensagem `email_obrigatorio_com_acesso`;
  - em `apoio-api.ts`: `criarMilitar(api: ApiDeTeste, d: { matricula: string; email: string | null; unidadeId: string }): Promise<string>`, que devolve o `militar.id`.

- [ ] **Step 1: Testes.**
  - `it('o convite saiu e o usuário tem o prazo da senha provisória')`.
  - `it('mudar o e-mail do militar muda o e-mail do usuário')`: grava `NOVO@bombeiros.pe.gov.br`; `usuario.email` fica `novo@bombeiros.pe.gov.br`.
  - `it('não apaga o e-mail de quem tem usuário')`: o PATCH com `email: null` responde 409, com `campos.email = 'Desative o acesso antes de apagar o e-mail.'`. Review Focus 4.
- [ ] **Step 2: Run** `pnpm --filter api test esquema-estrutura militares`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - A migração: `drop table if exists convite`; a coluna; a função e o gatilho `after update of email on militar`.
  - O PATCH reconhece a exceção do gatilho pela mensagem e responde 409 no campo.
- [ ] **Step 4: Run** de novo. Expected: PASS. Rodar também `pnpm --filter api test`.
- [ ] **Step 5: Commit** `Fase 6.1: migração 0025 e o e-mail de entrada igual ao da ficha`.

### Task 2: Senha provisória, troca obrigatória e desativar

**Files:**
- Create: `apps/api/src/usuarios/senha-provisoria.ts` (gerar a senha)
- Create: `apps/api/src/usuarios/rotas.ts` (rotas do acesso), ligada em `apps/api/src/app.ts`
- Modify: `apps/api/src/auth.ts` (o gancho de sessão barra a senha provisória vencida)
- Modify: `apps/api/src/acesso.ts` (`exigirSessao` barra quem ainda não trocou)
- Modify: `apps/api/src/rotas/eu.ts` (`trocarSenha` e `POST /api/eu/senha`)
- Create: `pacotes/contratos/src/usuarios.ts` (exportado no índice)
- Test: `apps/api/test/usuarios.test.ts`, `apps/api/test/senha-provisoria.test.ts`

**Interfaces:**
- Consumes: `criarMilitar` (Task 1); `exigirPapelNoRegistro(c, 'militar', id)`, a mesma regra do GET da ficha: auxiliar, gestor ou administrador na lotação do militar ou acima.
- Produces:
  - `gerarSenhaProvisoria(): string`, com `crypto.getRandomValues`;
  - contratos:
    - `SituacaoDoAcesso = z.enum(['sem-acesso', 'provisoria', 'provisoria-vencida', 'ativo', 'desativado'])`;
    - `AcessoDoMilitar = { situacao, email: string | null, papeis: PapelDoMilitar[], podeGerarSenha: boolean, papeisQuePodeDar: Papel[], unidadesParaPapel: { id: string; sigla: string; nivel: number }[] }`;
    - `PapelDoMilitar = { id, papel: Papel, unidadeId, unidadeSigla, desde: Data, ate: Data | null }`;
    - `NovaSenha = z.object({ novaSenha: z.string().min(10) })`;
  - rotas:
    - `GET /api/militares/:id/acesso` → `AcessoDoMilitar`;
    - `POST /api/militares/:id/senha-provisoria` → 201 `{ senha: string, validaAte: string }` (ISO);
    - `POST /api/militares/:id/desativar-acesso` → `AcessoDoMilitar`;
    - `POST /api/eu/senha` (`NovaSenha`) → 204;
  - `Eu` (API e `apps/web/src/api/eu.ts`) ganha `trocarSenha: boolean`.

- [ ] **Step 1: Testes** em `senha-provisoria.test.ts`.
  - `it('tem 12 caracteres do alfabeto sem letras parecidas, em três grupos')`: casa com `/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){2}$/`.
  - `it('duas senhas seguidas são diferentes')`.
- [ ] **Step 2: Testes** em `usuarios.test.ts`, com o `montarApi` e um militar da 1ª SB criado por `criarMilitar`.
  - `it('o auxiliar da seção gera a senha e o militar entra com ela')`: 201; o login por `/api/auth/sign-in/email` dá 200; `GET /api/eu` traz `trocarSenha: true` e `papeis: []`.
  - `it('sem e-mail na ficha não gera senha')`: 400 com "Preencha o e-mail institucional para dar acesso.". O `GET …/acesso` traz `podeGerarSenha: false`.
  - `it('gerar de novo invalida a anterior e derruba a sessão')`: depois do segundo POST, entrar com a primeira dá 401; a sessão aberta com a primeira recebe 401 em `/api/eu`. Review Focus 1.
  - `it('antes de trocar, as rotas respondem 403')`: com a sessão de senha provisória, `GET /api/unidades/:secao/militares` dá 403 com "Crie a sua senha antes de continuar."; `GET /api/eu` dá 200. Review Focus 2.
  - `it('trocar a senha libera a sessão e apaga o prazo')`: `POST /api/eu/senha` dá 204; `trocarSenha` fica `false`; a senha nova entra e a provisória não. Senha de 9 caracteres dá 400. `POST /api/eu/senha` sem senha provisória pendente dá 409.
  - `it('senha provisória vencida não entra, com a mensagem própria')`: com `senha_provisoria_ate` no passado, o login com a senha certa dá 403, e a mensagem é a de vencida. Review Focus 5.
  - `it('desativar derruba a sessão e gerar de novo reativa')`.
  - `it('o militar comum e o auxiliar de outra seção recebem 403')`.
- [ ] **Step 3: Run** `pnpm --filter api test usuarios senha-provisoria`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - **Gerar a senha:** numa transação com `comUsuario` (para a auditoria):
    - cria o `usuario` se faltar (`nome` = `posto nomeGuerra`, `email` da ficha, `militar_id`);
    - faz o upsert da `conta` com `provedor_id = 'credential'`, `conta_id = usuario.id` e `senha = await hashPassword(senha)`;
    - grava `senha_provisoria_ate = now() + interval '7 days'` e `ativo = true`;
    - apaga as `sessao` do usuário.
  - **Desativar:** `ativo = false` e apaga as sessões.
  - **Situação:**
    - sem `conta` com senha → `sem-acesso`;
    - `ativo = false` → `desativado`;
    - prazo no futuro → `provisoria`;
    - prazo vencido → `provisoria-vencida`;
    - sem prazo → `ativo`.
  - **Gancho `session.create.before`** em `auth.ts`: além do `ativo`, com o prazo vencido lança `APIError('FORBIDDEN', { message: <texto de vencida> })` (de `better-auth/api`).
  - **`exigirSessao`:** com prazo não nulo, responde 403 com o texto da troca.
  - **`POST /api/eu/senha`:** confere a sessão por conta própria, como o GET do `/api/eu`, porque fica fora de `exigirSessao`. Grava o hash e zera o prazo.
- [ ] **Step 5: Run** de novo e `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 6: Commit** `Fase 6.1: senha provisória, troca obrigatória e desativar o acesso`.

### Task 3: Papéis na ficha

**Files:**
- Modify: `apps/api/src/usuarios/rotas.ts`
- Modify: `apps/api/src/acesso.ts` (as duas mensagens "Esta tela é dos escalantes e gestores." passam a "Esta tela é dos auxiliares administrativos e gestores.")
- Modify: `pacotes/contratos/src/usuarios.ts`
- Test: `apps/api/test/usuarios.test.ts`, mais os testes que conferem a mensagem antiga

**Interfaces:**
- Consumes: `temPapel` (`acesso.ts`) e `AcessoDoMilitar` (Task 2).
- Produces:
  - `NovoPapel = z.object({ papel: Papel, unidadeId: z.string().uuid(), desde: Data })`;
  - `EncerrarPapel = z.object({ ate: Data })`;
  - `POST /api/militares/:id/papeis` (`NovoPapel`) → 201 `AcessoDoMilitar`;
  - `POST /api/papeis/:id/encerrar` (`EncerrarPapel`) → `AcessoDoMilitar`.
- **Regras:**
  - `gestor` e `escalante` exigem `temPapel(…, unidadeId, ['gestor', 'administrador'])`;
  - `administrador` exige ser administrador, com `unidadeId` na raiz (a regra do banco continua);
  - `papeisQuePodeDar` e `unidadesParaPapel` (as unidades em que a pessoa é gestora e as de baixo; para o administrador, todas) seguem as mesmas regras.

- [ ] **Step 1: Testes.**
  - `it('o gestor do 2º GB dá papel de auxiliar na 1ª SB')`: 201; o papel aparece em `papeis`.
  - `it('o auxiliar não dá papel')`: 403; `papeisQuePodeDar: []`.
  - `it('gestor fora da unidade ou dando administrador recebe 403')`. Review Focus 3.
  - `it('dar papel a quem não tem conta cria o usuário sem acesso')`: situação `sem-acesso`.
  - `it('encerrar fecha o período e não apaga')`: `ate` gravado; a linha continua.
  - `it('ninguém encerra o próprio último papel de gestor; o administrador pode')`: 409 com o texto fixo.
  - `ate` antes de `desde` dá 400.
- [ ] **Step 2: Run** `pnpm --filter api test usuarios`. Expected: FAIL.
- [ ] **Step 3: Implement** as duas rotas e as listas de `AcessoDoMilitar`, gravando com `comUsuario`. Trocar a mensagem em `acesso.ts` e nos testes que a conferem.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.1: papéis dados e encerrados na ficha`.

### Task 4: O site: Acesso ao sistema, Crie a sua senha e Esqueci minha senha

**Files:**
- Create: `apps/web/src/lib/papeis.ts` (`nomeDoPapel`)
- Create: `apps/web/src/api/acesso.ts` (consultas e mutações das rotas das tasks 2 e 3)
- Create: `apps/web/src/componentes/militares/AcessoAoSistema.tsx`, no fim da ficha, depois do Rastreio, em `routes/_app/militares/$id.tsx`
- Create: `apps/web/src/routes/criar-senha.tsx` (fora do `_app`)
- Modify: `apps/web/src/routes/_app.tsx` (com `eu.trocarSenha`, `redirect({ to: '/criar-senha' })`)
- Modify: `apps/web/src/routes/entrar.tsx` ("Esqueci minha senha" e a mensagem de vencida)
- Modify: `apps/web/src/routes/_app/index.tsx` ("A grade geral é dos auxiliares administrativos e gestores.") e os outros textos visíveis que dão "escalante" como nome de papel (procurar com `rg -i escalante apps/web/src`)
- Test: `apps/web/src/__testes__/acesso-ao-sistema.test.tsx`, `apps/web/src/__testes__/criar-senha.test.tsx`, `apps/web/src/__testes__/entrar.test.tsx`

**Interfaces:**
- Consumes: as rotas e os contratos das tasks 2 e 3.
- Produces: `nomeDoPapel(p: Papel): 'Administrador' | 'Gestor' | 'Auxiliar administrativo'`.

- [ ] **Step 1: Testes.**
  - **`acesso-ao-sistema.test.tsx`:**
    - `it('mostra a situação e gera a senha, que aparece uma vez')`: clicar em "Gerar senha provisória" mostra a senha e "Vale até dd/mm/aaaa"; depois de "Já entreguei", ela some e não volta ao reabrir a ficha.
    - `it('sem e-mail, o botão fica desligado com o aviso')`.
    - `it('desativar pede confirmação')`.
    - `it('lista os papéis com "Auxiliar administrativo" e dá papel')`: o formulário mostra papel, unidade e "A partir de".
    - `it('sem papéis para dar, não aparece "Dar papel"')`.
  - **`criar-senha.test.tsx`:**
    - `it('as duas senhas precisam ser iguais e ter 10 caracteres')`;
    - `it('salvar leva para o início')`.
  - **`entrar.test.tsx`:**
    - `it('Esqueci minha senha mostra a orientação')`;
    - `it('senha provisória vencida mostra a mensagem do servidor')`, com resposta 403 e a mensagem de vencida. Review Focus 5.
- [ ] **Step 2: Run** `pnpm --filter web test acesso-ao-sistema criar-senha entrar`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **O bloco** usa o `Secao` dos outros blocos da ficha:
    - situação em palavras ("Sem acesso", "Senha provisória até dd/mm", "Senha provisória vencida", "Ativo", "Desativado");
    - o e-mail de entrada;
    - os botões;
    - a lista de papéis com "Encerrar" (pede a data, sugerindo hoje);
    - "Dar papel".
  - **A senha** aparece num diálogo com "Copiar" e "Já entreguei".
  - **A tela "Crie a sua senha"** segue o visual do login:
    - campos "Nova senha" e "Repita a nova senha";
    - botão "Salvar senha";
    - ao salvar, invalida o `eu` e navega para `/`.
- [ ] **Step 4: Run** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.1: acesso ao sistema na ficha e a tela de criar a senha`.
- [ ] **Step 6: Fechar a entrega.**
  - `pnpm test && pnpm typecheck && pnpm build:vercel`.
  - Esquema atualizado (o `usuario`, o gatilho, sai o `convite`) e as contagens.
  - Enviar à PLANEJAMENTO o branch, o resumo e a lista curta para a sandbox:
    - gerar a senha de um militar da 1ª SB e entrar com ela;
    - trocar a senha;
    - dar papel de auxiliar na 1ª SB e de gestor no 2º GB;
    - encerrar um papel.

---

# Entrega 2 — Unidade de trabalho

**Goal:** cada pessoa trabalha na unidade que escolhe entre as que tem acesso; a 1ª SB deixa de ser fixa.

**Architecture:**
- **API:** o `/api/eu` passa a devolver a lista de unidades acessíveis e a lotação; sai o `unidade-atual.ts`.
- **Site:** a unidade escolhida é calculada no `beforeLoad` do `_app` e posta no contexto como `eu.unidade`. As telas que já leem `eu.unidade.id` não mudam.
- **Topo:** ganha o seletor.

**Branch:** `fase6-2-unidade-de-trabalho`. Commits `Fase 6.2: …`. Sem migração.

## Global Constraints

- **A escolha vale por navegador.** Fica guardada em `localStorage['unidade-de-trabalho']`, com leitura e escrita em `try/catch`.
- **Na primeira vez**, vale a unidade do papel mais baixo na árvore (maior profundidade; empate pela sigla).
- **O militar comum** não tem seletor. O topo mostra o caminho da lotação dele.
- **A API continua conferindo o papel em cada rota.** A escolha do site não dá acesso a nada.

**Decisões desta entrega** (minhas):
- `GET /api/eu` troca `unidade` por:
  - `unidades: UnidadeDeTrabalho[]`, com as unidades dos papéis vigentes e as de baixo, sem repetir, em ordem de caminho (o administrador recebe todas);
  - `lotacao: UnidadeDeTrabalho | null`, a unidade do período do rastreio de hoje.
- Para o militar comum, `unidades = lotacao ? [lotacao] : []`.
- Sem nenhuma unidade, o `_app` mostra "Sua lotação não está cadastrada. Procure o auxiliar administrativo da sua seção." e "Sair".
- Trocar de unidade navega para a lista da tela atual, o primeiro trecho do endereço: `/militares/abc` vai para `/militares`. Uma ficha de outra unidade não fica aberta.

## Review Focus

1. **Unidade guardada que deixou de ser acessível** (o papel foi encerrado): vale a regra da primeira vez, sem erro. Task 7.
2. **Gestor do 2º GB abre a Escala do mês com o 2º GB escolhido:** a tela mostra o vazio de sempre, sem erro e sem travar. Task 7.
3. **`localStorage` bloqueado** (janela privada): o seletor funciona na sessão e a tela não quebra. Task 7.
4. **Administrador:** o seletor lista a árvore inteira, com o recuo de cada nível. Task 7.
5. **Auxiliar com papel em duas seções:** o seletor mostra as duas, e cada tela troca os dados ao escolher. Task 6 (API) e Task 7 (site).

### Task 5: A folga do auxiliar na senha provisória

Decisão do usuário (21/11/2026, `docs/decisoes.md`): o auxiliar também gera a senha provisória, e desativa o acesso, de um **colega auxiliar** da unidade dele ou de baixo. Para quem tem papel de gestor ou de administrador, continua valendo só quem pode dar o papel.

**Files:**
- Modify: `apps/api/src/usuarios/rotas.ts` (`podeMexerNaConta`)
- Test: `apps/api/test/usuarios.test.ts`

- [ ] **Step 1: Testes.**
  - `it('o auxiliar da 1ª SB gera a senha de outro auxiliar da 1ª SB')`: 201.
  - `it('o auxiliar da 1ª SB não gera a senha de um auxiliar do 2º GB nem de um gestor')`: 403 com o texto de hoje.
  - `it('o auxiliar desativa o acesso de um colega auxiliar da unidade dele')`.
  - O `podeGerarSenha` do `GET …/acesso` acompanha a regra nos três casos.
- [ ] **Step 2: Run** `pnpm --filter api test usuarios`. Expected: FAIL.
- [ ] **Step 3: Implement.** Em `podeMexerNaConta`, um papel `escalante` da pessoa também passa quando quem pede tem `temPapel(…, p.unidade_id, ['escalante'], hoje)`. Os papéis `gestor` e `administrador` continuam em `podeNaUnidade`. Fazer o `podeGerarSenha` usar a mesma função.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.2: o auxiliar gera a senha de um colega auxiliar`.

### Task 6: `/api/eu` com as unidades e a lotação

**Files:**
- Modify: `apps/api/src/rotas/eu.ts`
- Delete: `apps/api/src/unidade-atual.ts`
- Test: `apps/api/test/eu.test.ts` (criar, se não existir, ou estender o teste do `/api/eu`)

**Interfaces:**
- Produces: `UnidadeDeTrabalho = { id: string; sigla: string; caminho: string[]; nivel: number }`, em que `caminho` são as siglas desde a raiz e `nivel = caminho.length - 1`. `Eu` sem `unidade` e com `unidades` e `lotacao`.

- [ ] **Step 1: Testes.**
  - `it('o auxiliar da 1ª SB tem só a 1ª SB')`.
  - `it('o gestor do 2º GB tem o 2º GB e as sete seções, em ordem')`.
  - `it('o administrador tem todas')`.
  - `it('papel em duas seções dá as duas')`. Review Focus 5.
  - `it('o militar comum tem a lotação de hoje, ou nada')`.
- [ ] **Step 2: Run** `pnpm --filter api test eu`. Expected: FAIL.
- [ ] **Step 3: Implement** com uma consulta por `caminho <@` sobre as unidades dos papéis vigentes (`papeisVigentes`). Apagar `unidade-atual.ts`.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.2: o /api/eu com as unidades acessíveis e a lotação`.

### Task 7: O seletor e a unidade escolhida no site

**Files:**
- Create: `apps/web/src/lib/unidade-de-trabalho.ts`
- Modify: `apps/web/src/api/eu.ts` (`EuDaApi` é a resposta do servidor; `Eu = EuDaApi & { unidade: UnidadeDeTrabalho }`)
- Modify: `apps/web/src/routes/_app.tsx` (calcula `eu.unidade`; sem unidade, a tela da lotação não cadastrada)
- Modify: `apps/web/src/componentes/Topo.tsx` (seletor)
- Test: `apps/web/src/__testes__/unidade-de-trabalho.test.ts`, `apps/web/src/__testes__/casca.test.tsx`

**Interfaces:**
- Consumes: `UnidadeDeTrabalho` (Task 6).
- Produces:
  - `escolherUnidade(eu: EuDaApi, guardada: string | null): UnidadeDeTrabalho | null`;
  - `lerUnidadeGuardada(): string | null`;
  - `guardarUnidade(id: string): void`.

- [ ] **Step 1: Testes** em `unidade-de-trabalho.test.ts`.
  - `it('vale a guardada se ainda for acessível')`.
  - `it('guardada inacessível cai no papel mais baixo')`. Review Focus 1.
  - `it('sem guardada, vale o papel mais baixo; empate pela sigla')`.
  - `it('militar comum fica na lotação')`.
  - `it('sem unidades, devolve null')`.
  - `it('localStorage que lança erro não quebra')`. Review Focus 3.
- [ ] **Step 2: Testes** em `casca.test.tsx`.
  - `it('com mais de uma unidade, o topo tem o seletor com recuo por nível')`. Review Focus 4.
  - `it('escolher outra unidade guarda e leva para a lista da tela')`.
  - `it('o militar comum vê o caminho da lotação sem seletor')`.
  - `it('sem unidade, mostra a orientação e Sair')`.
  - Na Escala do mês com o 2º GB, o vazio de sempre aparece. Review Focus 2.
- [ ] **Step 3: Run** `pnpm --filter web test unidade-de-trabalho casca`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - **O seletor** é um `DropdownMenu`, como o menu do usuário no `Topo`:
    - o gatilho é o caminho atual, como hoje (no celular, só a sigla atual);
    - os itens recuam pelo `nivel`, relativo ao menor nível da lista.
  - **Ao escolher:** `guardarUnidade`, `router.invalidate()` e `navigate` para o primeiro trecho do endereço atual.
  - Atualizar `apoio.tsx` dos testes do site para o `Eu` novo.
- [ ] **Step 5: Run** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 6: Commit** `Fase 6.2: o seletor de unidade substitui a 1ª SB fixa`.
- [ ] **Step 7: Fechar a entrega** (verificações, contagens). Enviar à PLANEJAMENTO, com a lista curta para a sandbox:
  - o gestor do 2º GB troca entre o 2º GB e a 1ª SB;
  - o auxiliar da 1ª SB não vê o seletor, porque tem uma unidade só.

---

# Entrega 3 — Tela inicial e módulos

**Goal:** quem entra cai na tela inicial do mockup aprovado, com um cartão por módulo que pode usar. Dentro de um módulo, o trilho mostra só os itens dele. Todos têm a Minha ficha, onde alteram o próprio telefone.

**Architecture:**
- **Módulos:** uma lista em `apps/web/src/lib/modulos.ts` define os módulos, quem os vê e os itens de cada um. O `_app` deriva o módulo do endereço, barra quem não vê e passa o módulo ao `Trilho`.
- **Endereços:** a Grade geral sai de `/` para `/grade`; `/` vira a tela inicial.
- **API:** duas rotas novas para a própria ficha.

**Branch:** `fase6-3-inicio-e-modulos`. Commits `Fase 6.3: …`. Sem migração.

## Global Constraints

- **Módulos e quem vê:**

  | Módulo | Rota | Quem vê |
  |---|---|---|
  | "Confecção de escalas" | `/grade` | auxiliar, gestor e administrador |
  | "Pecúlio do 2º GB" | `/peculio` | quem tem papel |
  | "Visualização de escalas" | sem rota | todos; cartão sem clique, com a etiqueta "Em breve" |
  | "Minha ficha" | `/minha-ficha` | todos |

- **O visual da tela inicial** é o do mockup `docs/telas/login-e-inicio/mockup.html`: barra, faixa de boas-vindas e cartões, no computador e no celular.
- **A faixa usa a cena final** `docs/telas/transicao-login/img/combate.jpg`, copiada para `apps/web/public/boas-vindas.jpg`. Ela é cortada como no design da transição:
  - no computador, 8:3, linhas 300 a 876 da imagem;
  - no celular, 16:9, a parte da direita.
- **Saudação:** "Bom dia" até 11h59, "Boa tarde" até 17h59, "Boa noite" depois, no fuso de Recife, seguida de `posto nomeGuerra` e da data por extenso.
- **Quem abre o endereço de um módulo que não vê** vai para `/` com `?aviso=outro-papel`, e a tela inicial mostra "Essa área é de outro papel.".
- **Na Minha ficha, só o telefone é editável**, com a mesma validação do `Telefone` dos contratos.

**Decisões desta entrega** (minhas):
- **Os itens de cada módulo:**
  - **Confecção:** os blocos de hoje do `Trilho`: Grade geral (`/grade`), Escala do mês, Efetivo por dia, Voluntariado, Cotas, Militares, Turnos, Escalas, Feriados e o pé.
  - **Pecúlio:** "Pecúlio" (`/peculio`). A ficha aberta pelo Pecúlio continua em `/militares/$id`, que pertence aos dois módulos. Por isso o módulo de `/militares/…` é o da origem: lido do parâmetro `?de=peculio`, ou Confecção por padrão.
- **Na tela inicial e na Minha ficha** não há trilho; a barra tem a volta ao início pelo brasão.
- **`GET /api/eu/ficha`** devolve só os dados do próprio militar:
  - identificação (posto, nome de guerra, nome completo, matrícula);
  - contato (telefone, e-mail);
  - dados pessoais (sexo, nascimento dia/mês);
  - comportamento e boletim;
  - situação de hoje (lotação, equipe, jornada);
  - motorista e CNH;
  - voluntário JES.
- **`PATCH /api/eu/telefone`** grava com `comUsuario`, para a auditoria.

## Review Focus

1. **Militar comum digita `/militares` no endereço:** vai para o início com o aviso, sem ver nada da lista. Task 10.
2. **Endereço antigo `/` com `?mes=…`** (favorito da Grade geral): leva à Grade geral em `/grade` com o mesmo mês. Task 10.
3. **Telefone inválido na Minha ficha:** a mensagem aparece no campo e nada é gravado. Task 9 (API) e Task 11 (site).
4. **Ficha aberta pelo Pecúlio:** o trilho continua o do Pecúlio, e "Voltar" volta ao Pecúlio. Task 10.
5. **Auxiliar abre a Minha ficha:** vê os próprios dados, não os de quem está selecionado na unidade. Task 9.

### Task 8: Conta desativada só volta por quem dá o papel

Decisão do usuário (21/11/2026, `docs/decisoes.md`): a folga do auxiliar (Task 5) **não vale para uma conta desativada**. Gerar a senha de um auxiliar desativado, o que reativaria a conta, fica só para quem pode dar o papel: o gestor da unidade ou o administrador. Para uma conta ativa, a folga continua.

**Files:**
- Modify: `apps/api/src/usuarios/rotas.ts` (`podeMexerNaConta` e o `podeGerarSenha`)
- Test: `apps/api/test/usuarios.test.ts`

- [ ] **Step 1: Testes.**
  - `it('o auxiliar não reativa um colega auxiliar desativado')`: 403 com o texto de hoje; `podeGerarSenha: false`.
  - `it('o gestor reativa o auxiliar desativado')`: 201.
  - `it('o auxiliar continua gerando a senha de um colega auxiliar ativo')`.
- [ ] **Step 2: Run** `pnpm --filter api test usuarios`. Expected: FAIL.
- [ ] **Step 3: Implement.** A folga do `escalante` em `podeMexerNaConta` só passa com `usuario.ativo = true`.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.3: conta desativada só volta por quem dá o papel`.

### Task 9: A própria ficha na API

**Files:**
- Modify: `apps/api/src/rotas/eu.ts` (as rotas `/ficha` e `/telefone`, com sessão conferida como no GET)
- Modify: `pacotes/contratos/src/usuarios.ts` (`MinhaFicha`, `NovoTelefone = z.object({ telefone: Telefone.nullable() })`)
- Test: `apps/api/test/eu.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/eu/ficha` → `MinhaFicha`;
  - `PATCH /api/eu/telefone` (`NovoTelefone`) → `MinhaFicha`.

- [ ] **Step 1: Testes.**
  - `it('o militar comum lê a própria ficha')`.
  - `it('o auxiliar lê a própria ficha, não a de outro')`. Review Focus 5.
  - `it('altera o próprio telefone e fica na auditoria')`.
  - `it('telefone inválido é 400 no campo e não grava')`. Review Focus 3.
  - `it('o corpo com outro campo além do telefone é 400')`.
- [ ] **Step 2: Run** `pnpm --filter api test eu`. Expected: FAIL.
- [ ] **Step 3: Implement** as duas rotas, reaproveitando a leitura da ficha de `cadastros/militares.ts`, que já monta os mesmos campos.
- [ ] **Step 4: Run** `pnpm --filter api test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.3: a própria ficha e o próprio telefone na API`.

### Task 10: Módulos, endereços e o trilho por módulo

**Files:**
- Create: `apps/web/src/lib/modulos.ts`
- Rename: `apps/web/src/routes/_app/index.tsx` → `apps/web/src/routes/_app/grade.tsx` (`createFileRoute('/_app/grade')`); trocar os `to: '/'` da Grade por `/grade`
- Modify: `apps/web/src/componentes/Trilho.tsx` (recebe o `Modulo` e mostra os itens dele; sem módulo, não aparece)
- Modify: `apps/web/src/routes/_app.tsx` (deriva o módulo, barra quem não vê, esconde o trilho fora dos módulos)
- Test: `apps/web/src/__testes__/modulos.test.ts`, `apps/web/src/__testes__/casca.test.tsx`, os testes da Grade com o endereço novo

**Interfaces:**
- Produces:
  - `type IdModulo = 'escalas' | 'peculio' | 'visualizacao' | 'minha-ficha'`;
  - `interface Modulo { id: IdModulo; nome: string; descricao: string; rota: string | null; ve(eu: Eu): boolean; itens: Item[][] }`;
  - `MODULOS: Modulo[]`;
  - `moduloDoEndereco(caminho: string, busca: Record<string, unknown>): Modulo | null`.

- [ ] **Step 1: Testes** em `modulos.test.ts`.
  - `it('o militar comum vê Visualização e Minha ficha')`.
  - `it('o auxiliar vê os quatro')`.
  - `it('/militares/x é da Confecção, e com ?de=peculio é do Pecúlio')`. Review Focus 4.
  - `it('/ e /minha-ficha não têm trilho')`.
- [ ] **Step 2: Testes** em `casca.test.tsx`.
  - `it('o militar comum em /militares vai para o início com o aviso')`. Review Focus 1.
  - `it('/ com ?mes= vai para /grade com o mesmo mês')`. Review Focus 2.
  - `it('dentro do Pecúlio, o trilho só tem o Pecúlio')`.
- [ ] **Step 3: Run** `pnpm --filter web test modulos casca grade`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - A volta de `/` com parâmetros da Grade (`mes`, `equipes`, `busca`, `militar`, `dia`) redireciona no `beforeLoad` da rota `/`.
  - As fichas abertas pela lista do Pecúlio levam `?de=peculio`, e o "Voltar" da ficha segue a origem.
- [ ] **Step 5: Run** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 6: Commit** `Fase 6.3: módulos, a Grade em /grade e o trilho por módulo`.

### Task 11: Tela inicial e Minha ficha

**Files:**
- Create: `apps/web/src/routes/_app/index.tsx` (tela inicial)
- Create: `apps/web/src/routes/_app/minha-ficha.tsx`
- Create: `apps/web/src/api/minha-ficha.ts`
- Create: `apps/web/public/boas-vindas.jpg` (cópia de `docs/telas/transicao-login/img/combate.jpg`)
- Modify: `apps/web/src/componentes/Topo.tsx` (o brasão com o nome do sistema, que leva a `/`)
- Test: `apps/web/src/__testes__/inicio.test.tsx`, `apps/web/src/__testes__/minha-ficha.test.tsx`

**Interfaces:**
- Consumes: `MODULOS` (Task 10); `MinhaFicha` e as rotas (Task 9).
- Produces: `saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite'`, em `apps/web/src/lib/saudacao.ts`, no fuso de Recife.

- [ ] **Step 1: Testes.**
  - **`inicio.test.tsx`:**
    - `it('mostra a saudação com posto e nome de guerra')`; `saudacao` nos limites 11:59, 12:00, 17:59 e 18:00;
    - `it('mostra um cartão por módulo visível; Visualização sem link e com "Em breve"')`;
    - `it('com ?aviso=outro-papel, mostra o aviso')`.
  - **`minha-ficha.test.tsx`:**
    - `it('mostra os próprios dados só para leitura, menos o telefone')`;
    - `it('salva o telefone')`;
    - `it('telefone inválido mostra a mensagem no campo')`. Review Focus 3.
- [ ] **Step 2: Run** `pnpm --filter web test inicio minha-ficha`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Tela inicial:** seguir o mockup, com a faixa mais alta para caber a cena e o texto no canto superior esquerdo, sobre um degradê escuro.
  - **Minha ficha:** reaproveitar o `Secao` dos blocos da ficha, só para leitura, e um campo de telefone com "Salvar".
- [ ] **Step 4: Run** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.3: tela inicial com os módulos e a Minha ficha`.
- [ ] **Step 6: Fechar a entrega.**
  - Verificações e contagens.
  - Atualizar `docs/superpowers/specs/2026-11-16-telas.md`, seção "Navegação": tela inicial, módulos, trilho por módulo e a Grade em `/grade`.
  - Enviar à PLANEJAMENTO, com a lista curta para a sandbox:
    - o militar comum entra e vê dois cartões;
    - o auxiliar vê quatro;
    - a Minha ficha altera o telefone;
    - um endereço proibido volta ao início com o aviso.

---

# Entrega 4 — Transição do login

**Goal:** no clique em **Entrar**, a animação das mangueiras toca por cima do login e termina na faixa de boas-vindas da tela inicial, como no mockup aprovado pelo usuário em 22/11/2026 (`docs/telas/transicao-login/mockup.html`).

**Branch:** `fase6-4-transicao-login`, a partir da `main`. **Sem migração e sem mudança na API.**

**Spec:** `docs/superpowers/specs/2026-11-20-transicao-login-design.md`. O mockup é a referência do desenho: o código da cena é **portado dele**, sem redesenhar.

**Architecture:**
- **Uma camada por cima das duas telas.** O `canvas` da animação é montado no `__root.tsx`, fora das rotas, para continuar na tela enquanto o site troca `/entrar` por `/`. A tela de login só manda nela por um pequeno armazém (`iniciar`, `aprovar`, `recusar`).
- **Três peças, uma responsabilidade cada:**
  - `regra.ts`: quando toca inteira (12 h, menos movimento);
  - `linha-do-tempo.ts`: em que quadro a cena está, dado o tempo desde o clique. Pura, sem tela;
  - `cena.ts`: o desenho de um quadro no `canvas`, portado do script do mockup.
- **O pouso:** a faixa da tela inicial tem a marca `data-faixa-boas-vindas`. No afastamento da câmera, a camada mede essa faixa e encolhe até ela. Sem a faixa na tela (a pessoa volta para outra página, ou vai criar a senha), a camada some em 0,3 s.

**Global Constraints** (valores da spec):
- Batida aos **0,50 s** do clique, sempre. A água nunca começa antes de **0,90 s**. Com a aprovação depois disso, as boas-vindas aparecem **1,7 s** depois dela.
- Erro (senha errada, conta recusada ou servidor fora) nunca antes de **0,85 s**; o recuo das mangueiras dura **0,5 s**; só depois o cartão volta, com a mensagem de hoje e os campos preenchidos.
- "Entrando…" aparece **1,6 s** depois do clique, se o servidor ainda não respondeu.
- Brasas sobre a faixa por **4 s** depois do pouso; depois a tela fica parada.
- Inteira só se passaram mais de **12 h** desde a última vez em que tocou inteira **neste navegador**. O intervalo fica numa constante só.
- **Entrada curta** (sem cena e sem efeitos; o botão mostra "Entrando…" e o login se desfaz em 0,3 s) quando:
  - a inteira tocou há menos de 12 h;
  - o aparelho pede menos movimento (`prefers-reduced-motion`);
  - a imagem não carregou, ou o navegador não tem `canvas`;
  - o destino não é a tela inicial (`voltar` preenchido).
- Sem som. Sem biblioteca de animação. Nenhuma dependência nova no site.
- Medidas da imagem (1536 × 1024): junta em (310, 741); faixa no computador, linhas 300 a 876 (8:3); no celular, 16:9 pela direita.

**Decisões desta entrega** (minhas):
- **A marca das 12 h** fica no `localStorage`, na chave `escalas2gb.login-animacao`, com o instante em milissegundos. É gravada quando a animação inteira chega às boas-vindas; a que termina em erro não conta.
- **Navegador que bloqueia o `localStorage`:** a animação toca inteira toda vez, sem erro.
- **Resolução do `canvas`:** a densidade de pixels é limitada a 2, para o celular fraco.
- **A imagem** passa a JPG de até 500 KB em `apps/web/public/boas-vindas.jpg`, no lugar da antiga, e é carregada quando a tela de login abre.
- **Foco:** no erro, vai para o campo da senha; no sucesso, para a saudação. O `canvas` fica fora da leitura de tela, e "Entrando…" é um aviso lido (`role="status"`).

## Review Focus

1. **Servidor fora do ar no meio da animação:** as mangueiras recuam e o cartão volta com "Não foi possível falar com o servidor. Tente de novo.", com o e-mail e a senha preenchidos. Task 27.
2. **Senha provisória vencida (403):** mesmo recuo, com a mensagem que o servidor mandou. Task 27.
3. **Resposta que chega antes da batida:** nada é cortado; a água começa aos 0,90 s e o erro aos 0,85 s. Task 26.
4. **Sessão que terminou e a pessoa volta para outra página:** entrada curta, e ela cai na página em que estava. Task 27.
5. **Navegador sem `localStorage` ou sem `canvas`:** entra normalmente. Tasks 26 e 27.

### Task 26: a regra e a linha do tempo

**Files:**
- Create: `apps/web/src/lib/transicao-login/regra.ts`, `apps/web/src/lib/transicao-login/linha-do-tempo.ts`
- Test: `apps/web/src/__testes__/transicao-login.test.ts`

**Interfaces:**
- Produces, em `regra.ts`:
  - `INTERVALO_DA_ANIMACAO_MS = 12 * 60 * 60 * 1000`;
  - `type Entrada = 'inteira' | 'curta'`;
  - `entradaDaVez(o: { agora: number; ultimaInteira: number | null; menosMovimento: boolean; cenaPronta: boolean; destinoEhOInicio: boolean }): Entrada`;
  - `lerUltimaInteira(): number | null` e `marcarInteira(agora: number): void`, que nunca lançam erro.
- Produces, em `linha-do-tempo.ts` (tempos em segundos desde o clique):
  - `type Resposta = { tipo: 'aprovada' | 'recusada'; em: number } | null`;
  - `type Quadro = 'clique' | 'chegada' | 'batida' | 'espera' | 'agua' | 'afastamento' | 'boas-vindas' | 'recuo' | 'fim-do-erro'`;
  - `inicioDaAgua(resposta: Resposta): number | null` → `max(0,90; em)`;
  - `inicioDoRecuo(resposta: Resposta): number | null` → `max(0,85; em)`;
  - `quadroEm(t: number, resposta: Resposta): Quadro`;
  - `mostraEntrando(t: number, resposta: Resposta): boolean`.

- [ ] **Step 1: testes** de `entradaDaVez`:
  - nunca tocou → `inteira`; tocou há 11 h 59 min → `curta`; há 12 h e 1 min → `inteira`;
  - menos movimento, cena não pronta ou destino diferente do início → `curta`, mesmo sem nunca ter tocado;
  - `lerUltimaInteira` com o `localStorage` lançando erro devolve `null`, e `marcarInteira` não lança. Review Focus 5.
- [ ] **Step 2: testes** da linha do tempo:
  - aprovada aos 0,2 s → a água começa aos 0,90 s; aprovada aos 3 s → aos 3 s, e `boas-vindas` aos 4,7 s;
  - recusada aos 0,1 s → o recuo começa aos 0,85 s, e `fim-do-erro` aos 1,35 s. Review Focus 3;
  - sem resposta: `batida` aos 0,5 s, `espera` aos 0,8 s e aos 30 s;
  - `mostraEntrando`: falso em 1,5 s, verdadeiro em 1,7 s sem resposta, falso depois da aprovação.
- [ ] **Step 3:** rodar `pnpm --filter web test transicao-login`. Esperado: FAIL.
- [ ] **Step 4:** implementar os dois arquivos.
- [ ] **Step 5:** rodar. Esperado: PASS.
- [ ] **Step 6:** `git commit -m "Fase 6.4: a regra das 12 h e a linha do tempo da transição do login"`

### Task 27: a cena, a camada e o login

**Files:**
- Create: `apps/web/src/lib/transicao-login/cena.ts` (o desenho, portado do `<script>` do mockup), `apps/web/src/lib/transicao-login/armazem.ts`, `apps/web/src/componentes/TransicaoDoLogin.tsx`
- Modify: `apps/web/src/routes/__root.tsx` (monta a camada), `apps/web/src/routes/entrar.tsx`, `apps/web/src/routes/_app/index.tsx` (a marca na faixa e o foco na saudação)
- Replace: `apps/web/public/boas-vindas.jpg` (a partir de `docs/telas/transicao-login/img/combate-storz.png`)
- Test: `apps/web/src/__testes__/entrar.test.tsx`, `apps/web/src/__testes__/inicio.test.tsx`

**Interfaces:**
- Consumes: tudo da Task 26.
- Produces, em `cena.ts`: `desenhar(ctx: CanvasRenderingContext2D, o: { t: number; resposta: Resposta; largura: number; altura: number; faixa: DOMRect | null; imagem: HTMLImageElement }): void`. Cada quadro depende só de `t` e do tamanho atual: redimensionar a janela não faz as peças saltarem.
- Produces, em `armazem.ts`:
  - `preparar(): void` (carrega a imagem; chamado quando o login abre);
  - `cenaPronta(): boolean`;
  - `iniciar(): void`, `aprovar(): void`, `recusar(): Promise<void>` (resolve quando o recuo acaba).

- [ ] **Step 1: testes** em `entrar.test.tsx`. O jsdom não tem `canvas`, então os testes de hoje passam a cobrir a entrada curta; os da animação usam uma cena pronta de mentira e relógio falso.
  - Os três de hoje continuam: senha certa navega; senha errada mostra a mensagem; servidor fora mostra a mensagem.
  - `it('na entrada curta, o botão mostra "Entrando…"')`.
  - `it('com a animação, o cartão some no clique e a mensagem de erro só aparece depois do recuo')`, com o e-mail e a senha ainda preenchidos e o foco na senha. Review Focus 1.
  - `it('o 403 do servidor mostra a mensagem dele depois do recuo')`. Review Focus 2.
  - `it('com "voltar", a entrada é curta e a pessoa cai na página em que estava')`. Review Focus 4.
  - `it('só marca as 12 h quando a animação inteira chega às boas-vindas')`.
  - `it('com menos movimento, não inicia a animação')`.
- [ ] **Step 2: teste** em `inicio.test.tsx`: `it('a faixa tem a marca do pouso e usa /boas-vindas.jpg')`.
- [ ] **Step 3:** rodar `pnpm --filter web test entrar inicio`. Esperado: FAIL.
- [ ] **Step 4: implementar.**
  - **Cena:** portar do mockup as medidas (os contornos do anel, da luva e das garras, as bordas da mangueira e o ponto de foco) e os efeitos, sem os controles de teste e sem a legenda do quadro. A linha do tempo vem da Task 26, e não dos números soltos do script.
  - **Camada:** `canvas` fixo, cobrindo a tela, fora da leitura de tela e sem receber cliques depois do pouso; um quadro por `requestAnimationFrame`; some quando a cena acaba. A tela inicial não recebe foco enquanto a camada cobre tudo.
  - **Login:** o `enviar` escolhe a entrada com `entradaDaVez`. Na inteira, chama `iniciar` no clique, `aprovar` antes de navegar e `await recusar()` antes de mostrar o erro.
  - **Imagem:** converter para JPG com o que já houver na máquina, sem pôr dependência no projeto.
- [ ] **Step 5:** rodar `pnpm --filter web test`. Esperado: PASS.
- [ ] **Step 6:** conferir no navegador, no computador e no celular, ao lado do mockup: a chegada, a batida, a espera com o servidor lento (limitar a rede nas ferramentas do navegador), a senha errada e o pouso na faixa, sem emenda entre a cena e a foto.
- [ ] **Step 7:** `git commit -m "Fase 6.4: a transição do login para as boas-vindas"`
- [ ] **Step 8: fechar a entrega.**
  - `pnpm test && pnpm typecheck && pnpm build:vercel` e as contagens.
  - Atualizar `docs/superpowers/specs/2026-11-16-telas.md` (a entrada no sistema).
  - Enviar à PLANEJAMENTO o resumo, com o que foi visto no navegador, a taxa de quadros medida num celular (ou no modo de celular lento do navegador) e o tamanho final da imagem.

---

# Entrega 5 — Retorno da validação, parte sem mockup

**Goal:** três ajustes que o usuário decidiu ao validar (21/11/2026) e que não dependem de desenho novo.

**Branch:** `fase6-5-retorno-da-validacao`. Commits `Fase 6.5: …`. **Migração:** o número livre seguinte (a P1 usou 0026 e 0027; se nada mais entrar antes, é a 0028). O resumo avisa `pnpm --filter api db:migrar:teste`.

## Global Constraints

- **O rastreio passa a valer por dia**, como os afastamentos. "A partir de" é uma data, sugerida a de hoje.
- **Textos fixos do rastreio:**
  - data anterior ao período aberto: "Use o dia do período aberto ou um dia depois.";
  - descrição do formulário: "A situação atual termina no dia anterior ao escolhido. No mesmo dia do período aberto, ele é substituído.".
- **Só o "Vale desde" do modelo de guarnição** (criar modelo e nova versão) aceita mês passado. As outras vigências continuam recusando: Configurações, Escalas, a matriz e o "desativar a partir de" do próprio modelo.
- **A importação de MILITARES e a do PECÚLIO não mudam:** a planilha continua informando o mês, que vale como o dia 1. *Minha decisão:* a planilha é contrato, e o lote não pediu mudança nela.

**Decisões desta entrega** (do usuário, na validação; as minhas estão marcadas):
- Rastreio por dia: substitui a decisão provisória "a partir de é o mês" e fecha a pendência de elucidação.
- "Vale desde" antigo: no teste, o usuário monta os modelos-padrão antes do lançamento, e o primeiro modelo vale "de muito tempo atrás". Em operação real isso altera guarnições antigas, e o usuário aceita.
- Recolher equipe (*minhas*):
  - o estado de cada equipe vale enquanto a pessoa estiver na tela, inclusive ao trocar de mês; não fica guardado entre visitas;
  - com texto na busca, as equipes com resultado aparecem abertas;
  - a faixa mostra quantos militares a equipe tem.

## Review Focus

1. **Militar que muda de equipe no dia 15:** na Grade geral ele aparece nas duas equipes, cada linha valendo só nos dias do seu período; a lista "Escolher militar" de um dia usa a equipe e a jornada daquele dia. Task 13.
2. **Pré-escala do Pronto com mudança de equipe no meio do mês:** o militar entra pela equipe antiga até o dia 14 e pela nova a partir do dia 15. Task 13.
3. **"Alterar situação" com a data de hoje no mesmo dia em que o período abriu:** substitui o período, sem criar um de zero dia. Task 13.
4. **Banco já com períodos no dia 1:** depois da migração, as escalas dos meses passados mostram as mesmas equipes e jornadas. Task 13.
5. **Equipe recolhida com o militar escolhido dentro:** a linha some, o painel do dia continua aberto, e abrir a equipe mostra a linha marcada. Task 12.

### Task 12: Grade geral: recolher e mostrar a equipe

**Files:**
- Modify: `apps/web/src/componentes/grade/TabelaDaGrade.tsx`, `apps/web/src/routes/_app/grade.tsx` (o estado das equipes recolhidas)
- Test: `apps/web/src/__testes__/grade.test.tsx`

**Interfaces:**
- Produces: `TabelaDaGrade` ganha `recolhidas: Set<string>` (as chaves dos grupos) e `aoAlternar(chave: string): void`.

- [ ] **Step 1: Testes.**
  - `it('clicar no nome da equipe esconde e mostra os militares dela')`: o nome é um botão com `aria-expanded`; recolhida, as linhas do grupo não estão na tabela.
  - `it('a faixa mostra quantos militares a equipe tem')`.
  - `it('com busca, a equipe com resultado aparece aberta')`.
  - `it('recolher a equipe do militar escolhido não fecha o painel do dia')`. Review Focus 5.
  - `it('trocar de mês mantém as equipes recolhidas')`.
- [ ] **Step 2: Run** `pnpm --filter web test grade`. Expected: FAIL.
- [ ] **Step 3: Implement.** O estado fica na rota (`useState<Set<string>>`). Os totais e os máximos continuam contando todos os militares.
- [ ] **Step 4: Run** `pnpm --filter web test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.5: recolher e mostrar a equipe na Grade geral`.

### Task 13: Rastreio por dia

**Files:**
- Create: `apps/api/banco/migracoes/00NN_rastreio_por_dia.sql`, com o número livre seguinte (tira o `check (extract(day from desde) = 1)` do `rastreio`, procurando o nome em `pg_constraint`; o da `unidade` fica)
- Modify: `pacotes/contratos/src/militares.ts` (`AlteracaoDeSituacao.desde` passa de `Mes` para `Data`)
- Modify: `apps/api/src/cadastros/militares.ts` (`POST /api/militares/:id/situacao` e a mensagem `MSG_PERIODO_ANTES`)
- Modify: `apps/api/src/escala/pre-escala.ts` (a equipe do militar em cada dia)
- Modify: `apps/web/src/componentes/militares/Rastreio.tsx`, a linha do tempo da ficha e `apps/web/src/lib/militares.ts` (`resumoDaLotacao`)
- Test: `apps/api/test/esquema-estrutura.test.ts`, `apps/api/test/militares.test.ts`, `apps/api/test/grade.test.ts`, `apps/api/test/escala-candidatos.test.ts`, o teste da pré-escala, `apps/web/src/__testes__/militares.test.tsx`, `apps/web/src/__testes__/linha-do-tempo-militar.test.tsx`

**Interfaces:**
- Produces: `AlteracaoDeSituacao = { unidadeId, equipeId, jornada, desde: Data }`.
- **Regra da rota:**
  - `desde` igual ao início do período aberto: substitui o período;
  - `desde` depois: fecha o período aberto no dia anterior e abre outro;
  - `desde` antes: 400 no campo, com o texto fixo.
- A ficha devolvida usa o mês de `desde`.

- [ ] **Step 1: Testes da API.**
  - `it('o rastreio aceita começar em qualquer dia')` (esquema); período sobreposto continua barrado.
  - `it('alterar a situação no dia 15 fecha o período no dia 14')`.
  - `it('no mesmo dia do período aberto, substitui')`. Review Focus 3.
  - `it('antes do período aberto é 400 com a mensagem')`.
  - `it('quem muda de equipe no dia 15 tem duas linhas na Grade, cada uma nos seus dias')`. Review Focus 1.
  - `it('Escolher militar usa a equipe e a jornada do dia')`: no dia 10, a antiga; no dia 20, a nova. Review Focus 1.
  - `it('a pré-escala do Pronto segue a equipe de cada dia')`. Review Focus 2.
  - `it('períodos que começam no dia 1 continuam como antes')`: o resultado da Grade de um mês passado não muda. Review Focus 4.
- [ ] **Step 2: Testes do site.**
  - `it('"A partir de" é uma data, sugerida a de hoje')`.
  - `it('a situação atual mostra "desde dd/mm/aaaa" e é a de hoje')`: com mudança marcada para depois de hoje, vale a anterior.
  - `it('a linha do tempo mostra o dia da mudança')`.
- [ ] **Step 3: Run** `pnpm --filter api test` e `pnpm --filter web test militares linha-do-tempo`. Expected: FAIL nos casos novos.
- [ ] **Step 4: Implement.**
  - A migração e a rota.
  - Conferir cada consulta ao `rastreio` em `apps/api/src` (`rg "rastreio" apps/api/src`): as que escolhem "o período do mês" passam a escolher o período do dia quando a pergunta é sobre um dia; as listas do mês continuam mostrando quem tem período no mês.
  - Na pré-escala, cada dia usa o período que o cobre.
  - No site: `type="date"`, as datas por extenso curto e os textos fixos.
- [ ] **Step 5: Run** `pnpm --filter api test && pnpm --filter web test`. Expected: PASS.
- [ ] **Step 6: Commit** `Fase 6.5: o rastreio vale por dia`.

### Task 14: "Vale desde" do modelo de guarnição aceita mês passado

**Files:**
- Modify: `apps/api/src/cadastros/guarnicoes.ts` (sai o `mesPassado` de `POST /api/unidades/:u/guarnicoes` e de `PUT /api/guarnicoes/:id/versoes/:mes`; fica o de `POST /api/guarnicoes/:id/situacao`)
- Modify: `apps/web/src/componentes/guarnicoes/ListaDeModelos.tsx` e `apps/web/src/componentes/guarnicoes/Versoes.tsx` (sai o `min` do campo)
- Test: `apps/api/test/guarnicoes.test.ts`, `apps/web/src/__testes__/guarnicoes.test.tsx`

- [ ] **Step 1: Testes.**
  - `it('cria um modelo valendo desde 1926-11')`: 201.
  - `it('grava uma versão num mês passado')`: 200.
  - `it('desativar a partir de um mês passado continua 409')`.
  - No site: os dois campos "Vale desde" aceitam um mês anterior ao atual.
- [ ] **Step 2: Run** `pnpm --filter api test guarnicoes` e `pnpm --filter web test guarnicoes`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Fase 6.5: o "Vale desde" do modelo de guarnição aceita mês passado`.
- [ ] **Step 6: Fechar a entrega.**
  - `pnpm test && pnpm typecheck && pnpm build:vercel`; contagens; o esquema com a migração nova.
  - Enviar à PLANEJAMENTO o branch, o resumo e a lista curta para a sandbox:
    - recolher e abrir uma equipe na Grade;
    - alterar a situação de um militar a partir de um dia no meio do mês e ver a Grade e a pré-escala;
    - criar um modelo de guarnição valendo de um mês antigo.

---

# Entrega 6 — Retorno da validação, parte com mockup (aguardando a DESIGN)

Do mesmo lote de 21/11/2026. Cada item espera o mockup da DESIGN e a aprovação do usuário; as tarefas são escritas depois disso.

1. **Confirmações em diálogo do sistema**, no lugar da janela do navegador (`window.confirm`, 11 usos): desativar modelo, remover turno, afastamento, cota e feriado, desativar escala, serviço e acesso, e a pergunta de alteração não salva.
2. **Topo:** só o brasão, sem o texto "Escalas 2º GB"; uma linha separando o brasão dos itens do menu; o brasão com aparência de clicável.
3. **Seletor de unidade:** navegar nível por nível (CBMPE, DGO, DInter/1, 2º GB, seção), em vez da lista única com a árvore inteira.
4. **Tela inicial:** o enquadramento da imagem de boas-vindas.
5. **Ficha com cadastro incompleto:** sai a faixa âmbar do topo. O dado que falta vira campo vermelho com a orientação dentro; o conflito (ex.: antiguidade repetida) fica como aviso na ficha e na lista.
6. **Lista de militares:** um botão de aviso filtra só quem tem pendência, no lugar do "Ver quais".
7. **Lista de militares:** o motivo do afastamento ("Adido o mês todo", "Curso desde 18/11") alinhado à direita da linha.
8. **Seletor de unidade em trilha** (pool 3, 22/11/2026): "nível 1 > nível 2 > …", com mais espaço em volta do separador; cada nível abre a lista dos irmãos. A barra "/" confunde com o nome "DInter/1". Junta-se ao item 3.
9. **Acesso ao sistema:** a lista de níveis não passa da borda da tela; um seletor do sistema que abre para cima quando falta espaço (pool 3).

---

# Entrega 7 — Militares só no Pecúlio

**Goal:** o militar novo entra só pelo módulo Pecúlio. O módulo de escalas atualiza o que é da escala, um a um pela ficha ou em lote pela importação "Dados da escala", sem criar militar.

**Architecture:**
- **Diálogo "Novo militar":** sai da tela Militares e vai para um componente próprio, usado pela tela do Pecúlio.
- **Importação:** o importador `militares` vira `dados-da-escala`. Sai tudo o que é do Pecúlio e sai a criação.
- **Sem migração.**

**Branch:** `fase6-7-militares-so-no-peculio`. Commits `Fase 6.7: …`.

## Global Constraints

- **Contrato da planilha** (decisão do usuário, 22/11/2026, opção b):
  - aba `DADOS DA ESCALA`;
  - colunas `MATRÍCULA` (obrigatória), `JORNADA` (obrigatória: PRONTO ou ADM), `EQUIPE`, `MOTORISTA`, `VOLUNTÁRIO JES` e `CNH`, com as mesmas ajudas e opções de hoje;
  - saem `NOME DE GUERRA`, `SEÇÃO`, `POSTO/GRAD` e `ANTIG`;
  - a planilha antiga, com a aba `MILITARES`, recebe a mensagem de aba faltando que já existe. Quem envia se adapta.
- **A importação nunca cria militar nem muda a lotação.**
- **A importação muda equipe e jornada a partir do dia 1 do mês escolhido na importação**, como hoje. Se o período aberto começa nesse mesmo dia, ele é substituído; se começou antes, ele é fechado na véspera e outro é aberto.
- **Textos fixos:**
  - matrícula desconhecida: "A matrícula {matrícula} não está cadastrada." Solução: "Cadastre o militar no Pecúlio antes.";
  - militar de outra unidade: "{NOME} está lotado na {sigla}: os dados da escala dele são importados lá." Solução: "Confira a matrícula ou importe pela {sigla}.";
  - lista vazia na tela Militares: "Nenhum militar lotado. O militar novo é cadastrado no Pecúlio.";
  - nome no cartão e no botão de importar da tela Militares: "Dados da escala".
- **O militar novo** (diálogo no Pecúlio) traz os campos do Pecúlio e a lotação:
  - os campos do Pecúlio são matrícula, posto-graduação, quadro, nome completo, nome de guerra e antiguidade;
  - a lotação são "Seção" e "Lotado desde", este uma data sugerida com a de hoje;
  - o resto entra como na importação do Pecúlio: jornada Pronto, sem equipe, fora do quadro de motoristas, sem CNH e não voluntário. A seção ajusta depois.

## Review Focus

- Importar "Dados da escala" com a matrícula de um militar recém-criado pelo Pecúlio, ainda sem equipe: ele ganha a equipe e a jornada, sem duplicar o período.
- Uma linha com a jornada igual à de hoje e a equipe igual: nada muda, e a prévia diz "sem mudança".
- O escalante da 1ª SB importando a matrícula de um militar da 2ª SB: problema na linha, e nada é gravado para ele.
- O auxiliar só da seção abre o Pecúlio: não vê "Novo militar" (o cadastro é de quem tem nível de acesso na unidade de cima).
- A ficha aberta pela tela Militares continua editando motorista, CNH, voluntário, equipe e jornada.

### Task 15: o "Novo militar" no Pecúlio

**Files:**
- Create: `apps/web/src/componentes/militares/NovoMilitar.tsx` (o diálogo que hoje está em `routes/_app/militares.tsx`)
- Modify: `apps/web/src/routes/_app/militares.tsx` (sai o botão, o diálogo e o texto da lista vazia), `apps/web/src/routes/_app/peculio.tsx` (entra o botão "Novo militar")
- Modify: `pacotes/contratos/src/militares.ts` (`NovoMilitar.lotacao.desde`: `Mes` → `Data`)
- Modify: `apps/api/src/cadastros/militares.ts` (o POST grava o `desde` do dia)
- Test: `apps/web/src/__testes__/militares.test.tsx`, `apps/web/src/__testes__/peculio.test.tsx`, `apps/api/test/militares.test.ts` (ou o teste que hoje cobre o POST)

- [ ] **Step 1: testes:**
  - a tela Militares não tem "Novo militar", e a lista vazia mostra o texto fixo;
  - no Pecúlio, quem tem nível de acesso na unidade de cima vê "Novo militar"; o auxiliar só da seção não vê;
  - o diálogo pede Seção e "Lotado desde" e não pede equipe, jornada, motorista, CNH nem voluntário;
  - salvar chama `POST /api/unidades/{seção escolhida}/militares` com `lotacao: { equipeId: null, jornada: 'pronto', desde: 'AAAA-MM-DD' }`;
  - na API, o POST com `desde` 2026-11-15 grava o rastreio a partir de 15/11.
- [ ] **Step 2:** `pnpm --filter web test militares peculio` e `pnpm --filter api test militares`. Esperado: FAIL.
- [ ] **Step 3:** implementar. A lista de seções vem de `/api/secoes`.
- [ ] **Step 4:** a mesma linha. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.7: o Novo militar passa ao Pecúlio"`

### Task 16: a importação "Dados da escala"

**Files:**
- Rename: `apps/api/src/importacao/militares.ts` → `apps/api/src/importacao/dados-da-escala.ts` (`importadorDadosDaEscala`)
- Modify: `apps/api/src/importacao/registro.ts` (sai `militares`, entra `'dados-da-escala'`)
- Modify: `apps/web/src/routes/_app/militares.tsx` (o importar usa `dados-da-escala`, com o nome "Dados da escala")
- Rename: `apps/api/test/importacao-militares.test.ts` → `apps/api/test/importacao-dados-da-escala.test.ts`

- [ ] **Step 1: testes:**
  - o modelo baixado tem a aba `DADOS DA ESCALA` e só as seis colunas do contrato, na ordem;
  - matrícula desconhecida: o problema e a solução fixos, e nada criado;
  - militar lotado noutra unidade: o problema fixo;
  - jornada e equipe novas a partir do mês da importação: fecha o período aberto na véspera do dia 1 e abre outro, com a mesma lotação;
  - período aberto que começa no dia 1 do mesmo mês: substituído, sem período de zero dia;
  - motorista, CNH e voluntário: atualizados no militar;
  - uma planilha com a aba `MILITARES` recebe a mensagem de aba faltando;
  - `/api/unidades/:u/importacao/militares/modelo` responde 404.
- [ ] **Step 2:** `pnpm --filter api test importacao-dados-da-escala`. Esperado: FAIL.
- [ ] **Step 3:** implementar. Sai do código tudo o que cria militar, lota, confere a seção, o posto, o nome de guerra e a antiguidade.
- [ ] **Step 4:** a mesma linha. Esperado: PASS. Depois, `pnpm --filter api test` e `pnpm --filter web test militares`.
- [ ] **Step 5:** `git commit -m "Fase 6.7: importação Dados da escala, que atualiza e não cria"`

### Task 17: fechar a entrega

- [ ] `pnpm test && pnpm typecheck && pnpm build:vercel`; as contagens no `CLAUDE.md` local.
- [ ] Na ajuda da importação do Pecúlio, onde ela cita a de MILITARES, trocar para "Dados da escala".
- [ ] Enviar à PLANEJAMENTO a branch e o resumo, com a lista curta para a sandbox:
  - criar um militar pelo Pecúlio;
  - importar os dados da escala dele pela tela Militares;
  - conferir que a tela Militares não cadastra mais.

---

# Entrega 8 — Acesso ao sistema e busca do Pecúlio

**Goal:** os quatro ajustes sem mockup do pool 3 da validação (22/11/2026).

**Architecture:**
- **Textos:** trocados no site e nas mensagens da API.
- **O "até":** entra no contrato e na rota de dar o nível de acesso. O banco já guarda início e fim em `papel_usuario`.
- **Sem migração.**

**Branch:** `fase6-8-acesso-e-busca`. Commits `Fase 6.8: …`.

## Global Constraints

- **Vocabulário** (decisão do usuário):
  - nas telas e nas mensagens, "papel" vira **"nível de acesso"** e "papéis", **"níveis de acesso"**;
  - **ficam como estão:** o código, os nomes de rota (`/papeis`), a tabela `papel_usuario`, o valor `escalante` e o parâmetro `?aviso=outro-papel`.
- **Textos novos:**
  - no Acesso ao sistema: o título "Níveis de acesso", "Nenhum nível de acesso.", o botão "Dar nível de acesso" e o rótulo "Nível de acesso";
  - nos avisos: "Essa área é de outro nível de acesso."; "Este bloco é alterado por quem tem nível de acesso em {unidade}."; "A lotação é alterada por quem tem nível de acesso em {unidade}.";
  - nas mensagens da API, o mesmo troca-troca. Exemplos: "Você não pode encerrar o seu último nível de acesso de gestor. Peça a outro gestor ou ao administrador."; "Este nível de acesso já foi encerrado."; "Nível de acesso não encontrado."; "Você só dá e encerra níveis de acesso na sua unidade e nas de baixo.".
- **Um formulário por vez:** com "Dar nível de acesso" aberto, os botões "Encerrar" ficam desligados; com um "Encerrar" aberto, ficam desligados "Dar nível de acesso" e os outros "Encerrar".
- **"Até":**
  - campo opcional ao lado de "A partir de", com o rótulo "Até (opcional)";
  - fim antes do início dá 400 no campo, com "O fim não pode ser antes do início.";
  - "Encerrar" continua existindo.
- **Busca do Pecúlio:**
  - com um resultado só, ele fica em destaque e o Enter no campo de busca abre a ficha (`/militares/$id?de=peculio`);
  - com zero ou vários resultados, o Enter não faz nada;
  - a ficha nunca abre sozinha.

## Review Focus

- O gestor dá o nível de gestor com "até" em 31/12 a quem já tem um nível de gestor aberto: vale a regra de hoje para nível repetido, e a mensagem usa "nível de acesso".
- A regra do último gestor conta um nível com "até" no futuro como vigente até o dia do "até".
- Com o formulário de dar aberto, um erro da API não fecha o formulário e não libera os "Encerrar".
- Na busca, digitar até sobrar um resultado e apagar uma letra: o destaque some e o Enter não abre.
- Nenhum texto de tela ou mensagem da API continua com "papel" ou "papéis". Conferir com `grep -rniE "[\"'\`>][^\"'\`<]*pap(el|éis)" apps/web/src apps/api/src`, que só pode achar código, nomes de rota e o `?aviso`.

### Task 18: "nível de acesso" nas telas e nas mensagens

**Files:**
- Modify: `apps/web/src/componentes/militares/AcessoAoSistema.tsx`, `Rastreio.tsx`, `Secao.tsx`, `apps/web/src/routes/_app/index.tsx`
- Modify: `apps/api/src/usuarios/rotas.ts`, `apps/api/src/usuarios/mensagens.ts`, `apps/api/src/acesso.ts`, `apps/api/src/cadastros/militares.ts`, `apps/api/src/importacao/peculio.ts`, e a importação da escala, se a 6.7 já estiver mesclada
- Test: os testes que conferem esses textos, no site e na API

- [ ] **Step 1:** trocar os textos esperados nos testes pelos novos. Esperado: FAIL.
- [ ] **Step 2:** trocar os textos no código. Rodar `pnpm test`. Esperado: PASS, e o `grep` do Review Focus limpo.
- [ ] **Step 3:** `git commit -m "Fase 6.8: nível de acesso no lugar de papel"`

### Task 19: um formulário por vez

**Files:** `apps/web/src/componentes/militares/AcessoAoSistema.tsx`; Test: `apps/web/src/__testes__/acesso-ao-sistema.test.tsx`

- [ ] **Step 1: testes:**
  - abrir "Dar nível de acesso" desliga os "Encerrar";
  - abrir um "Encerrar" desliga "Dar nível de acesso" e os outros "Encerrar";
  - "Cancelar" libera tudo;
  - um erro da API mantém o formulário aberto.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** um estado só, `aberto: { tipo: 'dar' } | { tipo: 'encerrar'; papelId: string } | null`, no `AcessoAoSistema`.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.8: um formulário por vez no Acesso ao sistema"`

### Task 20: o "até" ao dar o nível de acesso

**Files:** `pacotes/contratos/src/usuarios.ts` (`NovoPapel` ganha `ate: Data.nullable().optional()`), `apps/api/src/usuarios/rotas.ts` (`POST /militares/:id/papeis`), `AcessoAoSistema.tsx`; Test: `apps/api/test/acesso-rotas.test.ts`, `acesso-ao-sistema.test.tsx`

- [ ] **Step 1: testes:**
  - dar com "até" grava o fim, e a lista mostra o período;
  - "até" antes de "a partir de" dá 400 em `campos.ate`, com o texto fixo;
  - sem "até", tudo fica como hoje;
  - um nível com "até" vencido não dá acesso (`temPapel` já olha o fim) e não conta para a regra do último gestor.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.8: até opcional ao dar o nível de acesso"`

### Task 21: Enter na busca do Pecúlio

**Files:** `apps/web/src/routes/_app/peculio.tsx`; Test: `apps/web/src/__testes__/peculio.test.tsx`

- [ ] **Step 1: testes:**
  - com um resultado, o item tem `aria-current="true"`, e o Enter no campo navega para a ficha dele com `?de=peculio`;
  - com dois resultados, o Enter não navega;
  - a navegação nunca acontece só por digitar.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar. Esperado: PASS. Depois, `pnpm test && pnpm typecheck && pnpm build:vercel`.
- [ ] **Step 5:** `git commit -m "Fase 6.8: Enter abre a ficha quando a busca do Pecúlio deixa um resultado"`
- [ ] **Step 6:** enviar à PLANEJAMENTO a branch e o resumo, com a lista curta para a sandbox:
  - os textos de nível de acesso;
  - um formulário por vez;
  - o "até";
  - o Enter no Pecúlio.

---

# Entrega 9 — Pendências de cadastro

**Goal:** o quadro e a situação do militar passam a valer por período, como a lotação. A ficha ganha o ano de nascimento, o CPF e o endereço.

**Architecture:**
- **Migração:**
  - o rastreio ganha `quadro_id` e `situacao_id`;
  - nasce o catálogo `situacao_militar`;
  - saem `militar.quadro_id` e `militar.ativo`;
  - o militar ganha `nascimento_ano`, `cpf` e o endereço.
- **API:** toda consulta que lia `m.ativo` ou `m.quadro_id` passa a ler o período do rastreio do dia (ou do mês). As escalas usam a regra "a situação deixa escalar".
- **Site:**
  - "Alterar situação" ganha Quadro e Situação;
  - o "Ativo" sai da ficha;
  - a ficha ganha os campos novos;
  - Configurações ganha o catálogo "Situações do militar".

**Branch:** `fase6-9-pendencias-de-cadastro`. Commits `Fase 6.9: …`. **Migração 0029.**

## Global Constraints

- **Situação do militar** (decisão do usuário):
  - é um catálogo editado nas Configurações, como os tipos de afastamento. Cada valor tem nome, "Pode ser escalado" (sim ou não) e ativo;
  - a carga é "Ativa" (pode ser escalado), "Reserva", "Agregado" e "Adido" (não podem). *Minha decisão:* quem hoje está com `ativo = false` vai para um valor "Desativado" (não pode), para nada se perder; o administrador renomeia ou junta depois;
  - **são duas colunas diferentes, com sentidos diferentes:** Adido e Agregado podem existir como situação e como tipo de afastamento ao mesmo tempo. O catálogo de afastamentos não muda.
- **Quadro e situação no rastreio** (decisão do usuário):
  - mudar qualquer um fecha o período e abre outro, por "Alterar situação", como a lotação;
  - os dois são do Pecúlio: só quem tem nível de acesso numa unidade acima altera, como a lotação. Para quem tem nível só na seção, os dois ficam travados.
- **O posto continua sem histórico.** O posto do militar precisa estar no quadro do período aberto. Isso deixa de ser chave do banco e passa a ser regra da API (`quadroParaOPosto`). Os períodos fechados não são conferidos.
- **Para as escalas, no dia:**
  - o militar entra se a situação do período **pode ser escalado**; isso substitui o `ativo`;
  - as telas de praças pegam o QBMG e quem está sem quadro, pelo quadro do período do dia;
  - a escala dos oficiais pega QOC e QOA pelo quadro do período.
- **Dados pessoais** (decisão do usuário, 22/11/2026, que revê a D7): o banco passa a guardar:
  - **o ano de nascimento:** `nascimento_ano`, opcional, com o dia e o mês de hoje. Com o ano, a data precisa existir (29/02 só em ano bissexto);
  - **o CPF:** 11 dígitos, guardado sem pontuação, único e validado pelos dígitos verificadores. Na tela aparece como `000.000.000-00`;
  - **o endereço:** CEP (8 dígitos, na tela `00000-000`), logradouro, número, complemento, bairro, cidade e UF (uma das 27 siglas).
  - **Quem vê e quem altera:** os mesmos de hoje para os campos do Pecúlio. A Minha ficha mostra os próprios, só para leitura.
  - **Nos testes e no CI**, só CPF fictício com os dígitos verificadores válidos (ex.: `529.982.247-25`), nunca real.
- **Planilha do Pecúlio** (contrato):
  - NASCIMENTO aceita `dd/mm/aaaa` ou `dd/mm`;
  - entram as colunas `CPF`, `CEP`, `LOGRADOURO`, `NÚMERO`, `COMPLEMENTO`, `BAIRRO`, `CIDADE` e `UF`, depois de `BOLETIM DO COMPORTAMENTO`;
  - a regra "faltam as colunas" vale para as novas também;
  - vazio limpa o campo, como nas outras colunas;
  - o militar novo entra com a situação "Ativa" e o quadro escolhido pela regra da P1.1.
- **Textos fixos:**
  - CPF inválido: "CPF inválido: confira os 11 dígitos.";
  - CPF repetido: "Este CPF já é de {NOME}.";
  - UF: "Use a sigla do estado (ex.: PE).";
  - CEP: "O CEP tem 8 dígitos.";
  - situação desativada no catálogo: "Esta situação está desativada.".
- **Voluntário PJES do Pecúlio é o voluntário JES da escala** (decisão do usuário): o campo continua um só. Nada muda no código.

## Review Focus

- Um militar com QBMG até o dia 14 e QOA a partir do dia 15:
  - aparece nas telas de praças até o dia 14;
  - entra como elegível na escala dos oficiais com os dias a partir do 15;
  - a escala de um mês passado continua com o quadro de então.
- Situação "Reserva" a partir do dia 10: o militar deixa de ser candidato do dia 10 em diante, e a Grade mostra o que já estava escalado antes.
- Trocar o posto de um 2º TEN do QOA para CEL na ficha: o quadro do período aberto vai para o QOC sozinho, com um período novo a partir de hoje e sem erro.
- Importar o Pecúlio com o CPF de um militar já existente noutra linha: problema na linha, com o texto fixo, e nada gravado.
- A migração:
  - preserva os períodos;
  - copia o quadro do militar para todos os períodos dele;
  - põe "Ativa" ou "Desativado" conforme o `ativo`;
  - não perde nenhum militar das telas de escala de hoje.

### Task 22: a migração

**Files:** Create `apps/api/banco/migracoes/0029_cadastro_no_tempo.sql`; Test `apps/api/test/esquema-estrutura.test.ts`

- [ ] **Step 1: testes:**
  - o catálogo traz Ativa, Reserva, Agregado, Adido e Desativado, com "pode ser escalado" só na Ativa;
  - depois da migração:
    - um militar com `ativo = false` fica com os períodos em "Desativado";
    - um militar com QBMG fica com QBMG em todos os períodos;
    - `militar.ativo` e `militar.quadro_id` não existem mais;
  - CPF com 10 dígitos falha (`23514`);
  - CPF repetido falha (`23505`);
  - `nascimento_ano` com 30/02 falha;
  - UF "XX" falha.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** a migração, que pode rodar de novo:
  - cria `situacao_militar` (`id`, `nome` único sem caixa, `escalavel boolean`, `ativo boolean`), com a auditoria;
  - em `rastreio`, `quadro_id` (→ quadro, nulo) e `situacao_id` (→ `situacao_militar`, `not null`, preenchido antes);
  - em `militar`: `nascimento_ano smallint`, a regra da data com o ano, `cpf text check (cpf ~ '^\d{11}$')` com índice único, `cep text check (cep ~ '^\d{8}$')`, `logradouro`, `numero`, `complemento`, `bairro` e `cidade` (texto, até 120 caracteres) e `uf` (uma das 27 siglas);
  - por último, tira a chave composta `militar_posto_no_quadro`, `militar.quadro_id` e `militar.ativo`.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.9: quadro e situação no rastreio, e os dados pessoais"`

### Task 23: a API lê o período

**Files:**
- Modify: os arquivos que liam `m.ativo` ou `m.quadro_id`. Hoje são:
  - `cadastros/militares.ts`, `cadastros/quadros.ts`;
  - `escala/elegibilidade.ts`, `escala/pre-escala.ts`, `escala/quadros-da-escala.ts`;
  - `grade/grade.ts`;
  - `oficiais/participantes.ts`, `oficiais/leitura.ts`;
  - `voluntariado/leitura.ts`;
  - `usuarios/rotas.ts`, `usuarios/criar-admin.ts`, `carga/exemplo.ts`;
  - `importacao/peculio.ts`.
- Modify: `pacotes/contratos/src/militares.ts`:
  - `AlteracaoDeSituacao` ganha `quadroId` e `situacaoId`;
  - sai o `ativo` de `EdicaoMilitar`;
  - o detalhe ganha `situacao`, `cpf` e `endereco`;
  - `nascimento` ganha o ano opcional.
- Create: `apps/api/src/cadastros/situacoes.ts` (`GET`/`POST`/`PATCH /api/situacoes-do-militar`, só o administrador edita, como os tipos de afastamento)
- Test: `apps/api/test/quadros-nas-escalas.test.ts`, `oficiais.test.ts`, `rastreio-por-dia.test.ts`, `militares.test.ts` e o novo `situacoes.test.ts`

- [ ] **Step 1: testes:** os cinco casos do Review Focus, mais:
  - o PATCH com `ativo` dá 400 (o campo saiu);
  - "Alterar situação" com quadro ou situação, por quem só tem nível na seção, dá 403 com o texto do Pecúlio;
  - o CPF inválido e o CPF repetido, com os textos fixos;
  - a situação desativada recusada.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar. A situação "pode ser escalado" e o quadro saem do período que cobre o dia. Onde a consulta é do mês, sai dos períodos do mês, como a equipe na 6.5.
- [ ] **Step 4:** `pnpm --filter api test`. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.9: as escalas leem o quadro e a situação do período"`

### Task 24: a importação do Pecúlio

**Files:** `apps/api/src/importacao/peculio.ts`; Test `apps/api/test/importacao-peculio.test.ts`

- [ ] **Step 1: testes:**
  - o modelo tem as colunas novas na ordem do contrato;
  - NASCIMENTO `15/03/1985` grava o ano, e `15/03` grava sem ano;
  - CPF, CEP e UF inválidos dão problema na linha, com o texto fixo;
  - a coluna CPF vazia limpa o CPF de quem já existe;
  - uma planilha sem as colunas novas recebe "Faltam as colunas …".
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** `git commit -m "Fase 6.9: CPF, ano de nascimento e endereço na importação do Pecúlio"`

### Task 25: as telas

**Files:** `apps/web/src/componentes/militares/Identificacao.tsx` (saem o "Ativo" e o campo Quadro, que passa a aparecer na situação atual), `Rastreio.tsx` (Quadro e Situação em "Alterar situação" e na linha do tempo), o bloco de dados pessoais da ficha (CPF, ano de nascimento e o bloco "Endereço"), `routes/_app/minha-ficha.tsx`, `routes/_app/configuracoes.tsx` (o catálogo "Situações do militar"); Test os testes de militares, minha-ficha e configurações

- [ ] **Step 1: testes:**
  - **Situação atual:** mostra lotação, equipe, jornada, quadro e situação ("1ª SB · Alfa · Pronto · QBMG · Ativa (desde dd/mm/aaaa)").
  - **"Alterar situação":**
    - tem Quadro (só os do posto) e Situação (só as ativas do catálogo);
    - os dois ficam travados para quem tem nível só na seção.
  - **Dados pessoais e endereço:**
    - o CPF aparece com a máscara, e o CEP também;
    - a UF é uma lista com as 27 siglas;
    - os erros da API aparecem no campo.
  - **Minha ficha:** mostra CPF e endereço só para leitura.
  - **Configurações:** "Situações do militar" lista, cria, renomeia, liga e desliga "Pode ser escalado" e desativa, só para o administrador.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar. Esperado: PASS. Depois, `pnpm test && pnpm typecheck && pnpm build:vercel`, as contagens e o esquema do banco com a 0029.
- [ ] **Step 5:** `git commit -m "Fase 6.9: telas do quadro e da situação no tempo, e dos dados pessoais"`
- [ ] **Step 6:** enviar à PLANEJAMENTO a branch e o resumo, com a lista curta para a sandbox:
  - mudar o quadro e a situação no dia 15 e ver a Grade e a escala dos oficiais;
  - preencher CPF e endereço;
  - importar um Pecúlio com as colunas novas;
  - criar uma situação nas Configurações.

---

# Entrega 14 — A animação de entrada como preferência

**Goal:** a pessoa escolhe, na Minha ficha, quando a animação do login toca: em toda entrada, uma vez a cada 12 h (o padrão de hoje) ou nunca.

**Branch:** `fase6-14-preferencia-da-animacao`, a partir da `main`. Sem migração e sem mudança na API.

**Decisões desta entrega** (minhas):
- **A preferência é de cada pessoa, e fica no navegador** (`localStorage`, chave `escalas2gb.login-animacao-quando`). A animação começa no clique em **Entrar**, antes de o servidor dizer quem é a pessoa, então a escolha precisa estar no aparelho. Em outro navegador ou aparelho, vale o padrão até a pessoa escolher de novo.
- **Valores:** `sempre`, `12h` (padrão) e `nunca`.
- **Onde:** na Minha ficha, um bloco "Animação de entrada", com três opções: "Em toda entrada", "Uma vez a cada 12 horas" e "Nunca". Embaixo, o texto: "Vale para este navegador."
- **"Reduzir movimento" do aparelho continua mandando:** com ele ligado, não há animação, qualquer que seja a escolha, e o bloco avisa: "Seu aparelho pede menos movimento, então a animação não toca."
- **"Sempre" não muda a marca das 12 h:** ela continua sendo gravada, para a volta ao padrão funcionar.

### Task 28: a preferência

**Files:**
- Modify: `apps/web/src/lib/transicao-login/regra.ts`, `apps/web/src/routes/entrar.tsx`, `apps/web/src/routes/_app/minha-ficha.tsx`
- Test: o teste da regra da transição, `apps/web/src/__testes__/minha-ficha.test.tsx`, o teste da animação do login

**Interfaces:**
- Produces, em `regra.ts`:
  - `type Quando = 'sempre' | '12h' | 'nunca'`;
  - `lerQuando(): Quando` (padrão `'12h'`; valor estranho ou `localStorage` bloqueado também dão `'12h'`) e `gravarQuando(q: Quando): void`, que nunca lançam erro;
  - `entradaDaVez` ganha o campo `quando: Quando`.

- [ ] **Step 1: testes** da regra.
  - `sempre`: inteira mesmo tendo tocado há 1 minuto.
  - `nunca`: curta mesmo sem nunca ter tocado.
  - `12h`: os casos de hoje, sem mudança.
  - Menos movimento, cena não pronta ou destino diferente do início continuam dando curta com `sempre`.
- [ ] **Step 2: testes** de tela.
  - A Minha ficha mostra o bloco com "Uma vez a cada 12 horas" marcada na primeira vez; escolher outra grava e continua marcada ao reabrir.
  - Com menos movimento, o aviso aparece.
  - No login, com `nunca` gravado, a animação não inicia; com `sempre`, inicia duas vezes seguidas.
- [ ] **Step 3:** rodar `pnpm --filter web test`. Esperado: FAIL nos testes novos.
- [ ] **Step 4:** implementar.
- [ ] **Step 5:** rodar `pnpm test && pnpm typecheck && pnpm build:vercel`. Esperado: PASS. Atualizar as contagens.
- [ ] **Step 6:** `git commit -m "Fase 6.14: a animação de entrada como preferência"` e abrir o PR, com a lista para a sandbox: escolher "Em toda entrada" e entrar duas vezes; escolher "Nunca" e entrar.

