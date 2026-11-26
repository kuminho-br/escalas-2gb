# Primeiro acesso e "Esqueci minha senha" por código no e-mail (6.68) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o militar cria a própria senha sem depender do auxiliar. Em "Primeiro acesso" ou "Esqueci minha senha", ele digita o e-mail institucional e recebe um código. Com o código, ele cria a senha e entra. A senha provisória gerada pelo auxiliar ou pelo gestor continua existindo, como reserva.

**Architecture:**
- **Na API:** duas rotas públicas novas em `apps/api/src/acesso-por-email/`:
  - pedir o código;
  - criar a senha com o código.
- **Envio:** uma interface `EnviarEmail` injetada em `criarApp`. Em produção ela chama a API do Brevo; nos testes, um envio falso que guarda as mensagens.
- **Banco:** a migração cria duas tabelas:
  - `pedido_de_codigo`: com auditoria, sem o código. Serve para os limites, a cota do dia e o registro do pedido e da conclusão.
  - `codigo_de_acesso`: sem auditoria. Guarda só o resumo (HMAC) do código.
- **No site:** duas telas públicas (`/primeiro-acesso` e `/esqueci-a-senha`) com o mesmo cartão do login. A lista dos requisitos da senha vai também para a tela de criar senha que já existe.

**Tech Stack:** Hono, Postgres/PGlite, better-auth (`hashPassword`), zod (`contratos`), `fetch` para a API do Brevo, React, TanStack Router, Vitest.

**Spec:**
- As decisões do usuário de 26/11/2026, trazidas pela SAC e registradas em `docs/decisoes.md`.
- A pendência de 21/11/2026 em `docs/decisoes/fase-5.md` ("o link por e-mail e o Esqueci minha senha ficam para quando houver serviço de envio testado").
- O pool, itens 49 e 50.

## Global Constraints

- Branch `fase6-68-codigo-de-acesso-por-email`, a partir da `main`.
- **Migração `0051_codigo_de_acesso.sql`.** Se a 6.66 (0050) ainda não tiver entrado, usar o número livre seguinte. Aplicar no banco de teste só com a autorização do usuário.
- **Segredo:** a chave do Brevo vem da variável de ambiente `BREVO_API_KEY`, posta pelo usuário no Vercel.
  - O remetente vem de `EMAIL_REMETENTE` (o endereço verificado no Brevo).
  - O nome do remetente é fixo: "Sistema de Gestão - 2º GB".
  - **Nunca** no repositório, em log, em auditoria, em teste ou em mensagem de erro. Ninguém da equipe lê nem imprime essas variáveis.
  - Sem `BREVO_API_KEY`, o envio fica "fora do ar" (ver abaixo), e o resto do sistema funciona.
- **Para onde vai o código:** só para o e-mail institucional da ficha (`militar.email`, o mesmo do login). O e-mail pessoal (6.18) nunca recebe. Nenhuma tela cadastra ou altera e-mail por este caminho.
- **Quem recebe o código:** o militar cuja ficha tem exatamente o e-mail digitado, sem diferenciar maiúsculas. O acesso dele precisa estar em uma destas situações:
  - sem acesso;
  - senha provisória, no prazo ou vencida;
  - ativo.

  Acesso **desativado** não recebe código: reativar é de quem dá o nível de acesso (decisão de 21/11). Primeiro acesso e esquecimento são **o mesmo mecanismo**; as duas telas só mudam o título e o texto.
- **A resposta nunca revela se o e-mail está cadastrado.** O pedido responde sempre 202 com o mesmo corpo e a mesma frase: "Se este e-mail estiver na ficha de um militar, enviamos um código para ele. Confira também a caixa de spam."
  - **Tempo da resposta:** o envio sai depois da resposta, com `waitUntil` de `@vercel/functions` (no servidor local e nos testes, sem esperar).
  - Assim a resposta leva o mesmo tempo nos dois casos.
  - Erro de envio para um endereço que existe fica no `pedido_de_codigo` como `falhou`, sem o código, e não muda a resposta.
- **Código:**
  - 6 dígitos, sorteados com `crypto.getRandomValues` (sem viés, como a senha provisória);
  - vale **15 minutos**;
  - serve **uma vez**;
  - aceita **5 tentativas erradas**; na quinta, morre, e a pessoa pede outro;
  - um pedido novo invalida o código anterior do mesmo militar.
  - Guardado só como HMAC-SHA-256 com o `BETTER_AUTH_SECRET`; o código em claro só existe na memória do pedido e no e-mail.
- **Limites** (sugestão da PLANEJAMENTO, pedida pelo usuário). Contam no banco, porque cada instância da Vercel tem a própria memória:
  - **por endereço digitado:** 3 pedidos por hora e 6 em 24 horas. Contam exista o e-mail ou não, então a recusa não revela nada;
  - **por origem:** 10 pedidos por hora por endereço de rede. A origem é o primeiro valor de `x-forwarded-for`, guardada só como HMAC, nunca em claro;
  - acima do limite, 429 "Muitos pedidos de código. Tente de novo daqui a uma hora.";
  - **cota do dia:** o plano gratuito do Brevo envia 300 por dia. Com 280 envios no dia (fuso de Recife), o envio fica "fora do ar" até a meia-noite.
- **Envio fora do ar** (sem chave ou com a cota do dia cheia):
  - vale para todos, cadastrados ou não, então não revela nada;
  - 503 "O envio de códigos está fora do ar agora. Peça uma senha provisória ao auxiliar administrativo da sua seção.".
- **Criar a senha com o código:** e-mail, código e senha nova (as regras da `NovaSenha`, pelo menos 10 caracteres).
  - **Se der certo:**
    - cria o usuário e a conta, se faltarem (`garantirUsuario`, como a senha provisória);
    - grava a senha;
    - apaga a senha provisória pendente (`senha_provisoria_ate = null`);
    - derruba as sessões abertas do militar;
    - marca o pedido como concluído;
    - responde 200. O site então entra com o e-mail e a senha nova.
  - **Código errado, vencido, usado ou de e-mail sem código:** a mesma resposta, 400 "Código inválido ou vencido. Peça outro.".
- **Senha provisória e código convivem:** a provisória continua valendo 7 dias e aparecendo uma vez. Concluir com o código anula a provisória. Gerar uma provisória nova invalida o código pendente do militar.
- **Auditoria:** registra só que houve pedido (o `pedido_de_codigo` com a auditoria de sempre) e conclusão (`concluido_em`). Nunca o código, nem o resumo dele. A tabela `codigo_de_acesso` fica **fora** da auditoria.
- **E-mail:**
  - assunto "Seu código de acesso ao Sistema de Gestão - 2º GB";
  - texto: "Seu código é {código}. Ele vale por 15 minutos e serve uma vez. Se você não pediu este código, ignore este e-mail: sua senha não muda.";
  - versão em texto e em HTML simples, sem link e sem imagem.
- **Aviso de spam nas telas** (decisão do usuário; texto definido pela PLANEJAMENTO): "O e-mail sai de um endereço do Gmail e pode cair no spam ou no lixo eletrônico. Se não chegar em 5 minutos, procure lá. Se não chegar de jeito nenhum, peça uma senha provisória ao auxiliar administrativo da sua seção."
- **Requisitos da senha à vista** (pool 49):
  - nas telas de criar senha (a de hoje, `/criar-senha`, e as duas novas), cada requisito aparece numa lista e fica marcado quando cumprido: "Pelo menos 10 caracteres" e "As duas senhas iguais";
  - as regras não mudam: a lista mostra as que já existem.
- **Telas:**
  - o mesmo cartão e o mesmo fundo do login (`entrar.tsx`), com a skill `frontend-design:frontend-design`;
  - no login, "Esqueci minha senha" passa a levar à tela nova (hoje só mostra o texto de pedir ao auxiliar), e entra o link "Primeiro acesso";
  - decidido pela PLANEJAMENTO: sem mockup da DESIGN, porque as telas reaproveitam o cartão do login sem desenho novo. A DESIGN pode revisar depois.
- **Ordem com a 6.67:** as duas mexem em `entrar.tsx`. Quem for depois traz a outra da `main` antes de começar.
- **Nos testes:** nunca chamar o Brevo; o envio falso guarda as mensagens. E-mails fictícios do domínio institucional, só com matrículas da faixa `990xxx-x`.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.
- **Depois do merge** (para a VALIDAÇÃO, com o usuário):
  - o usuário põe `BREVO_API_KEY` e `EMAIL_REMETENTE` no Vercel;
  - pede o código para a própria caixa institucional real e confere se chega, inclusive na caixa de spam.
  - Ninguém da equipe mexe nas configurações da Vercel.

## Review Focus

1. **Endereço cadastrado e não cadastrado:** mesmo corpo, mesmo código de resposta, mesmo tempo (o envio não está no caminho da resposta) (Task 2).
2. **Alguém pede o código para a caixa de outra pessoa sem parar:** no quarto pedido da hora, 429, e a caixa recebe no máximo 3 e-mails por hora e 6 por dia (Task 2).
3. **Militar com senha provisória pendente que usa o código:** a provisória deixa de valer, e as sessões abertas com ela caem (Task 3).
4. **Dois pedidos seguidos:** só o código do segundo funciona (Task 3).
5. **Envio que falha só para um endereço** (o Brevo recusa a caixa): a pessoa vê a mesma frase de sempre, e a tela de digitar o código mantém o caminho da senha provisória à vista (Task 2 e Task 4).

---

### Task 1: as tabelas e o envio pelo Brevo

**Files:** Create `apps/api/banco/migracoes/0051_codigo_de_acesso.sql`, `apps/api/src/acesso-por-email/enviar-email.ts`, `apps/api/src/acesso-por-email/codigo.ts`; Modify `apps/api/src/app.ts` e `apps/api/src/app-ambiente.ts` (o `enviarEmail` entra em `criarApp`), `apps/api/src/servidor.ts`; Test `apps/api/test/acesso-por-email-envio.test.ts`

**Interfaces (Produces):**
- Tabela `pedido_de_codigo`:
  - `id uuid`;
  - `email_resumo text not null` (HMAC do e-mail em minúsculas);
  - `origem_resumo text` (HMAC da origem);
  - `militar_id uuid null` (preenchido só quando o e-mail é de uma ficha que pode receber);
  - `situacao text check in ('enviado', 'nao_enviado', 'falhou', 'concluido')` (`nao_enviado` = o e-mail não é de ninguém que possa receber);
  - `criado_em timestamptz default now()`, `concluido_em timestamptz null`;
  - com o gatilho de auditoria;
  - índices por `(email_resumo, criado_em)` e `(origem_resumo, criado_em)`.
- Tabela `codigo_de_acesso`:
  - `militar_id uuid primary key` (um código vivo por militar: o pedido novo substitui);
  - `pedido_id uuid`;
  - `codigo_resumo text not null`;
  - `vale_ate timestamptz not null`;
  - `tentativas int not null default 0`;
  - **sem** gatilho de auditoria.
- `type EnviarEmail = (m: { para: string; assunto: string; texto: string; html: string }) => Promise<void>` (lança em falha).
  - `enviarPeloBrevo(cfg: { chave: string; remetente: string }): EnviarEmail` faz `POST https://api.brevo.com/v3/smtp/email` com o cabeçalho `api-key` e o corpo `{ sender: { name: 'Sistema de Gestão - 2º GB', email }, to: [{ email }], subject, textContent, htmlContent }`.
  - Resposta fora de 2xx lança um erro **sem** o corpo do pedido.
- `criarApp({ …, enviarEmail?: EnviarEmail | null })`: `null` ou ausente é envio fora do ar. Em `app-ambiente.ts`, monta com `BREVO_API_KEY` e `EMAIL_REMETENTE` quando os dois existem.
- No servidor local (`servidor.ts`, que nunca roda na Vercel), com `ENVIO_DE_TESTE=terminal`, um `EnviarEmail` que escreve a mensagem no terminal, para conferir o fluxo com e-mails fictícios. Sem essa variável, o servidor local fica com o envio fora do ar. Em `app-ambiente.ts` (Vercel) essa opção não existe.
- `aposResponder(tarefa: Promise<void>)`: com `waitUntil` de `@vercel/functions` na Vercel (acrescentar a dependência na API, se faltar); fora dela, deixa a promessa correr com o erro tratado.
- `codigo.ts`:
  - `sortearCodigo(): string` (6 dígitos);
  - `resumir(valor: string, segredo: string): string` (HMAC-SHA-256 em hex);
  - `mensagemDoCodigo(codigo: string): { assunto; texto; html }`, com os textos das Global Constraints.

- [ ] **Step 1: testes:**
  - a migração aplica nos dois schemas (como as outras desde a 6.58);
  - o gatilho de auditoria está em `pedido_de_codigo` e não está em `codigo_de_acesso`;
  - `sortearCodigo` dá sempre 6 dígitos, inclusive com zeros à esquerda;
  - `resumir` é estável e muda com o segredo;
  - `mensagemDoCodigo` tem o assunto e o texto fixos e não tem link;
  - `enviarPeloBrevo` com um `fetch` falso: a URL, o cabeçalho `api-key` e o corpo certos; numa resposta 400, lança, e a mensagem do erro não contém a chave nem o código.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.68: as tabelas do código e o envio pelo Brevo`.

### Task 2: pedir o código

**Files:** Create `apps/api/src/acesso-por-email/rotas.ts`; Modify `apps/api/src/app.ts` (as rotas ficam fora do `exigirSessao`), `pacotes/contratos/src/usuarios.ts`; Test `apps/api/test/acesso-por-email-pedido.test.ts`

**Interfaces (Produces):**
- `PedidoDeCodigo = z.object({ email: z.string().trim().email() })`.
- `POST /api/acesso/codigo`:
  - 202 `{ mensagem }` com a frase fixa das Global Constraints;
  - 429 nos limites;
  - 503 fora do ar;
  - 400 só para e-mail malformado.
- Exporta `FRASE_DO_PEDIDO`, `MSG_MUITOS_PEDIDOS`, `MSG_ENVIO_FORA_DO_AR` em `contratos`, para o site usar os mesmos textos.

- [ ] **Step 1: testes** (com o envio falso):
  - e-mail de ficha com acesso nas situações "sem acesso", "provisória" e "ativo": 202, um e-mail com o código vai para esse endereço, e o pedido fica `enviado`;
  - e-mail que não existe, ou de acesso desativado: 202 com o mesmo corpo, nenhum e-mail, e o pedido fica `nao_enviado` (Review Focus 1: corpos iguais byte a byte);
  - o e-mail pessoal da 6.18 digitado não recebe nada;
  - maiúsculas no e-mail digitado acham a ficha;
  - os limites:
    - quarto pedido na hora para o mesmo endereço, 429 (Review Focus 2);
    - sétimo em 24 h, 429;
    - décimo primeiro da mesma origem na hora, 429;
    - os limites contam também para endereço inexistente;
  - sem `enviarEmail`: 503 para endereço cadastrado e não cadastrado;
  - com 280 envios no dia: 503; no dia seguinte (fuso de Recife), volta;
  - envio que lança: 202 com a mesma frase e o pedido `falhou` (Review Focus 5);
  - nada do código ou do resumo dele aparece em `auditoria` nem nos `console.*` (espiar o console no teste);
  - um pedido novo substitui o código vivo do militar.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (o envio com `waitUntil` quando houver; a resposta não espera o Brevo). **Step 4:** PASS. **Step 5:** commit `Fase 6.68: pedir o código pelo e-mail da ficha`.

### Task 3: criar a senha com o código

**Files:** Modify `apps/api/src/acesso-por-email/rotas.ts`, `apps/api/src/usuarios/rotas.ts` (gerar a provisória apaga o código vivo; `garantirUsuario` exportado se ainda não for), `pacotes/contratos/src/usuarios.ts`; Test `apps/api/test/acesso-por-email-senha.test.ts`

**Interfaces (Produces):**
- `SenhaPeloCodigo = z.object({ email: z.string().trim().email(), codigo: z.string().regex(/^\d{6}$/), novaSenha: NovaSenha.shape.novaSenha })`.
- `POST /api/acesso/senha`:
  - 200 `{ ok: true }`;
  - 400 "Código inválido ou vencido. Peça outro." (`MSG_CODIGO_INVALIDO`, em `contratos`);
  - 400 da senha curta, com o campo.

- [ ] **Step 1: testes:**
  - militar sem acesso: o código cria o usuário e a conta, e depois disso o login com a senha nova funciona;
  - militar ativo que esqueceu: a senha antiga deixa de entrar e a nova entra;
  - Review Focus 3: com a provisória pendente, o código grava a senha, `senha_provisoria_ate` fica nulo, e a sessão aberta com a provisória cai;
  - o código serve uma vez só;
  - vencido aos 15 min e 1 s;
  - a quinta tentativa errada mata o código, e o certo depois disso dá 400;
  - Review Focus 4: dois pedidos seguidos, só o segundo código vale;
  - gerar uma provisória pelo auxiliar invalida o código pendente;
  - o pedido fica `concluido`, com `concluido_em`;
  - acesso desativado entre o pedido e o uso: 400, a mesma frase;
  - nada do código na auditoria.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (a mesma transação e o mesmo `hashPassword` da senha provisória; o `select … for update` no código evita duas conclusões ao mesmo tempo). **Step 4:** PASS. **Step 5:** commit `Fase 6.68: criar a senha com o código`.

### Task 4: as telas

**Files:** Create `apps/web/src/routes/primeiro-acesso.tsx`, `apps/web/src/routes/esqueci-a-senha.tsx`, `apps/web/src/componentes/acesso/CodigoPorEmail.tsx` (o fluxo comum às duas), `apps/web/src/componentes/acesso/RequisitosDaSenha.tsx`; Modify `apps/web/src/routes/entrar.tsx` (os dois links), `apps/web/src/routes/criar-senha.tsx` (a lista de requisitos); Test `apps/web/src/__testes__/codigo-por-email.test.tsx`, `apps/web/src/__testes__/entrar.test.tsx`, o teste de `criar-senha`

**Interfaces:**
- Consumes: as rotas da Task 2 e da Task 3, os textos de `contratos`.
- Produces: `RequisitosDaSenha({ senha, confirmacao })`, uma lista com "Pelo menos 10 caracteres" e "As duas senhas iguais", cada um com o estado cumprido ou não, lido pelo leitor de tela ("cumprido" ou "falta").

O fluxo, nas duas telas (só o título muda: "Primeiro acesso" e "Esqueci minha senha"):
1. **E-mail:** o campo "E-mail institucional" e o botão "Enviar código". Depois do envio, vem a etapa 2 com a frase da API e o aviso de spam.
2. **Código e senha:**
   - os campos "Código (6 números)", "Senha nova" e "Repita a senha nova", com os requisitos;
   - o botão "Criar senha e entrar";
   - os links "Pedir outro código" e "Usar outro e-mail";
   - sempre à vista: "Não chegou? Peça uma senha provisória ao auxiliar administrativo da sua seção.".
3. **Sucesso:** entra com o e-mail e a senha nova e vai para o início, como o login. A animação de entrada segue a regra de hoje.

- [ ] **Step 1: testes:**
  - no login, os links "Primeiro acesso" e "Esqueci minha senha" levam às telas novas;
  - o fluxo inteiro com a API falsa;
  - a frase da API aparece igual para qualquer e-mail;
  - o aviso de spam na etapa 2;
  - 429 e 503 mostram as frases de `contratos`, e o 503 mostra o caminho do auxiliar;
  - o código inválido mostra a frase no campo do código;
  - os requisitos marcam conforme a pessoa digita, inclusive em `/criar-senha`;
  - "Criar senha e entrar" só habilita com os requisitos cumpridos;
  - o foco vai ao primeiro campo de cada etapa e à mensagem de erro;
  - no celular, a tela cabe em 360 px.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (skill de design; o cartão e o fundo do login). **Step 4:** PASS.
- [ ] **Step 5:** rodar as verificações do fim de entrega. Conferir no navegador, em 1440 e 390 px, com a API local e `ENVIO_DE_TESTE=terminal` (Task 1):
  - o primeiro acesso de um militar fictício sem acesso;
  - o "Esqueci minha senha" de um ativo;
  - o código errado cinco vezes;
  - o envio fora do ar.

  Commit `Fase 6.68: as telas de primeiro acesso e esqueci minha senha`. Enviar a branch à PLANEJAMENTO.

## Fora deste plano

- Pool 50, a parte de **trocar a senha estando logado** (na Minha ficha): aguarda o usuário dizer se quer.
- O envio pelo servidor institucional, com domínio próprio e sem o risco de spam: na ida ao servidor do Estado.
- O e-mail pessoal como caminho de reserva: decisão do usuário, só o institucional recebe.
