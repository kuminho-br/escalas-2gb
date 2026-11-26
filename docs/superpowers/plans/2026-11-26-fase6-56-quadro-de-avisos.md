# O quadro de avisos na tela inicial (6.56) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** quem tem nível de acesso publica avisos para uma unidade; os militares lotados nela e nas de baixo os veem na tela inicial, num painel dentro da cena, um por vez; o autor ou quem tem nível de acesso edita, fixa e retira.

**Architecture:** uma tabela nova, `aviso`, com auditoria como as outras. A API lê os avisos visíveis à conta pela lotação de hoje do militar (a unidade do aviso contém a lotação, pelo `caminho` ltree) e grava com a regra de nível de acesso que as outras gravações já usam (`temPapel(…, CADASTRO, …)`). No site, o painel ocupa o lugar que a 6.55 deixou à direita da cena (no celular, logo abaixo dela), e uma janela publica e edita.

**Tech Stack:** Hono, Postgres/PGlite (ltree), zod (`contratos`), React, TanStack Query, o diálogo Radix que já existe, Vitest.

**Spec:** as regras aprovadas pelo usuário em 26/11/2026 (nas Global Constraints e em `docs/decisoes.md`); o painel do mockup v3 da tela inicial, no commit `87f9ab3` da branch `docs-manual-entrada-v2` (`git show 87f9ab3:docs/telas/refatoracao/tela-inicial/index.html`, `inicio.css` e `inicio.js`); a 6.55 (`docs/superpowers/plans/2026-11-26-fase6-55-proximos-servicos.md`), que deixa o lugar do painel.

## Global Constraints

- Branch `fase6-56-quadro-de-avisos`, a partir da `main` com a 6.55 mesclada (ou da branch dela; diga no resumo). **Migração `0047`**; aplicar no banco de teste só com autorização do usuário.
- **O aviso:** título (1 a 80 caracteres), texto (1 a 400), unidade, autor (a conta), quando foi publicado, fixado (sim/não), vale até (data opcional), retirado (quando e por quem; o aviso retirado não some do banco, sai das telas).
- **Quem vê:** os militares lotados hoje na unidade do aviso e nas de baixo (um aviso do 2º GB aparece para quem está na 1ª SB). Conta sem militar ou sem lotação hoje não vê avisos.
- **Quem publica:** quem tem nível de acesso na unidade do aviso ou numa de cima (`temPapel(c, usuarioId, unidadeId, CADASTRO, hoje)`). A unidade escolhida na publicação vem da árvore (o seletor da 6.45), só com as unidades onde a pessoa pode publicar; o padrão é a unidade de trabalho.
- **Editar, fixar e retirar:** o autor, ou quem tem nível de acesso na unidade do aviso ou numa de cima. A unidade não muda na edição (para mudar, retirar e publicar outro).
- **Ordem:** os fixados primeiro, do mais novo para o mais velho; depois os outros, do mais novo para o mais velho.
- **Vale até:** vale até o fim do dia escolhido (Recife); depois some sozinho das telas. Sem data, fica até alguém retirar. A data não pode ser antes de hoje ("A data já passou.").
- **Sem notificação nem e-mail:** o aviso só aparece na tela inicial.
- **O painel** (mockup v3): dentro da cena, à direita, um painel escuro translúcido com a borda de cima em vinho; o título "Avisos" e a contagem; **um aviso por vez**, com setas ("Aviso anterior", "Próximo aviso") e pontos; **não passa sozinho**; o aviso mostra o título, o texto e a linha "{posto} {nome de guerra}, {dd/mm}, {sigla da unidade do aviso}", e a marca "Fixado" quando for. No celular, o painel desce para logo abaixo da cena. Quem pode publicar em alguma unidade vê o botão "Publicar aviso"; no aviso que a pessoa pode alterar, "Editar" e "Retirar".
- **A barra encolhida:** acrescenta o título do primeiro aviso do painel (só no computador, como no mockup).
- **Vazio:** sem aviso, o painel não aparece para quem não pode publicar; para quem pode, aparece com "Nenhum aviso." e "Publicar aviso".
- **Textos fixos da janela:** título "Publicar aviso" (ou "Editar aviso"); campos "Unidade", "Título", "Texto", "Fixar no topo", "Vale até (opcional)"; botões "Publicar" (ou "Salvar") e "Cancelar"; "Retirar" pede confirmação na própria janela: "Retirar este aviso? Ele sai da tela inicial de todos." com "Retirar" e "Cancelar". Erros: "Você não tem nível de acesso nesta unidade.", "A data já passou.", e os limites do título e do texto ("O título tem até 80 caracteres.", "O texto tem até 400 caracteres.").
- Skill `frontend-design:frontend-design`; tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Militar que mudou de lotação:** deixa de ver os avisos da unidade antiga e passa a ver os da nova, no mesmo dia em que a lotação muda (Task 1).
2. **Aviso que vence hoje:** aparece até 23h59 de Recife e some à meia-noite (Task 1).
3. **Gestor da 1ª SB tenta publicar ou retirar no 2º GB** (unidade de cima): 403 com a frase fixa; o administrador da raiz publica em qualquer uma (Task 1).
4. **Texto longo e quebra de linha** (400 caracteres, com linhas em branco): o painel não estoura a cena; o texto cabe com rolagem dentro do aviso ou é cortado com "Ver tudo", sem empurrar a cena (Task 2).
5. **Muitos avisos** (dez): os pontos não passam da largura do painel; as setas dão a volta no último e no primeiro (Task 2).

---

### Task 1: o aviso no banco e na API

**Files:** Create `apps/api/banco/migracoes/0047_aviso.sql`, `apps/api/src/avisos/avisos.ts`, `apps/api/src/avisos/rotas.ts`, `pacotes/contratos/src/avisos.ts`; Modify `apps/api/src/app.ts` (montar as rotas), `pacotes/contratos/src/index.ts`; Test `apps/api/test/avisos.test.ts`

**Interfaces (Produces):**
- Tabela `aviso (id uuid pk default gen_random_uuid(), unidade_id uuid not null references unidade, autor_id uuid not null references usuario, titulo text not null check (char_length(titulo) between 1 and 80), texto text not null check (char_length(texto) between 1 and 400), fixado boolean not null default false, vale_ate date null, publicado_em timestamptz not null default now(), retirado_em timestamptz null, retirado_por uuid null references usuario)`, índice por `unidade_id` onde `retirado_em is null`; o gatilho de auditoria das outras tabelas.
- Contratos: `Aviso = { id, unidadeId, unidadeSigla, titulo, texto, fixado, valeAte: string | null, publicadoEm: string, autor: { patente: string; nomeGuerra: string }, podeAlterar: boolean }`; `NovoAviso = { unidadeId, titulo, texto, fixado, valeAte? }`; `MudarAviso = { titulo?, texto?, fixado?, valeAte?: string | null }`, com as frases fixas nos erros do zod.
- Rotas: `GET /api/avisos` → `{ avisos: Aviso[]; podePublicar: boolean }` (os visíveis à conta, na ordem das Global Constraints; `podePublicar` se a conta tem nível de acesso em alguma unidade); `POST /api/avisos`; `PATCH /api/avisos/:id`; `POST /api/avisos/:id/retirar`. Gravações com `comUsuario` (a auditoria grava quem). 403 "Você não tem nível de acesso nesta unidade."; aviso inexistente ou retirado, 404 "Aviso não encontrado.".
- `avisosVisiveis(c: Consulta, usuarioId: string, hoje: string): Promise<Aviso[]>`: pela lotação de hoje do militar da conta (a mesma regra que `GET /api/eu` usa em `apps/api/src/rotas/eu.ts`), `u.caminho @> lotacao.caminho`, sem os retirados e sem os vencidos (`vale_ate < hoje`).

- [ ] **Step 1: testes (`avisos.test.ts`):** quem vê (lotado na unidade, numa de baixo, numa do lado e numa de cima: só os dois primeiros veem); a mudança de lotação no mesmo dia (Review Focus 1); a ordem com fixados; o vencimento em Recife (Review Focus 2, com relógio injetado); publicar com e sem nível de acesso, na unidade, numa de baixo e numa de cima (Review Focus 3); editar e retirar pelo autor, por quem tem nível de acesso e por quem não tem; a unidade não muda no `PATCH`; data passada recusada; título e texto nos limites (80 e 400 passam, 81 e 401 não); `podeAlterar` certo para cada conta; a auditoria registra a publicação e a retirada com o usuário; conta sem militar: `avisos: []`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.56: o aviso no banco e na API`.

### Task 2: o painel e a janela no site

**Files:** Create `apps/web/src/componentes/inicio/QuadroDeAvisos.tsx`, `apps/web/src/componentes/inicio/JanelaDoAviso.tsx`, `apps/web/src/api/avisos.ts`; Modify `apps/web/src/routes/_app/index.tsx` (o painel no lugar deixado pela 6.55 e o título na barra encolhida); Test `apps/web/src/__testes__/quadro-de-avisos.test.tsx`

**Interfaces (Consumes):** as rotas e os contratos da Task 1; o seletor de unidade da 6.45; o diálogo Radix que já existe.

- [ ] **Step 1: testes:** o painel mostra um aviso por vez, na ordem da API, com a linha do autor e a marca "Fixado"; as setas e os pontos passam e dão a volta (Review Focus 5), e nada passa sozinho (avançar o relógio do teste não muda o aviso); quem pode publicar vê "Publicar aviso"; a janela publica com os campos e textos fixos e fecha; erro da API aparece na janela, que fica aberta; "Editar" e "Retirar" só no aviso com `podeAlterar`; retirar pede a confirmação na janela; o vazio (sem painel para quem não pode publicar; "Nenhum aviso." para quem pode); o texto longo não aumenta a cena (Review Focus 4); a barra encolhida mostra o título do primeiro aviso no computador e não no celular; no celular (390 px) o painel fica abaixo da cena, sem rolagem de lado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador em 1440 e 390 px: publicar um aviso na 1ª SB e outro, fixado, no 2º GB; ver os dois com um militar da 1ª SB; editar; retirar; e o aviso com "vale até" de hoje. **Step 5:** commit `Fase 6.56: o quadro de avisos na tela inicial` e enviar a branch à PLANEJAMENTO.
