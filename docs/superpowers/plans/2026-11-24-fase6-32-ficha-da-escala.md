# A ficha do militar na escala e a Escala do mês no ordinário (6.32): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a ficha aberta pela aba Militares do módulo de escalas mostra só o que serve à escala, a SB edita só Habilitações, toda seção recolhe, o auxiliar só gera a senha, e a Escala do mês abre no ordinário.

**Architecture:** a API passa o voluntário JES e a equipe e jornada para a regra do Pecúlio e tira do auxiliar o "Desativar acesso"; o site esconde Dados pessoais e Comportamento na ficha da escala (`de` ≠ `peculio`), troca "Motorista" por "Habilitações", põe o botão de recolher em toda `Secao` (com memória no navegador) e escolhe o ordinário na Escala do mês.

**Tech Stack:** Hono, zod, React, TanStack Router/Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-ficha-da-escala-e-militar-externo-design.md`, partes 1 e 2. A parte 3 (militar externo) fica para outra entrega.

## Global Constraints

- Branch `fase6-32-ficha-da-escala`, a partir da `main` (depois da 6.21). Sem migração.
- Ative a skill `frontend-design:frontend-design`; siga as diretrizes gerais (`docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md`, e os componentes da 6.20 quando já estiverem na `main`).
- A ficha aberta pelo Pecúlio (`?de=peculio`) continua completa, como hoje.
- Quem tem nível de acesso acima da lotação do militar (a SP) e o administrador continuam editando tudo, pelas duas fichas.
- Bloquear não é esconder: bloco sem permissão aparece só para leitura, com `DonoDoBloco`.
- Textos fixos: título "Habilitações"; botão "Salvar habilitações"; recusa da API ao auxiliar que tenta desativar: "Desativar o acesso é de quem dá o nível de acesso.".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios, logado como auxiliar (escalante) e como gestor acima da lotação.

## Review Focus

1. **Minha ficha:** o militar continua editando o próprio Contato pela Minha ficha (mesmos componentes); nada desta entrega tira isso.
2. **Militar sem lotação** (recém-criado): o administrador continua alterando a situação e a equipe dele (hoje `podeEditar.peculio` = admin nesse caso).
3. **A ficha aberta pelo Pecúlio** continua com Dados pessoais e Comportamento, e trocar de militar na lista mantém `de=peculio`.
4. **Navegador sem armazenamento** (janela anônima, `localStorage` que lança erro): a ficha abre com tudo aberto, sem quebrar.
5. **Unidade sem escala com Pronto** ou com o Pronto inativo: a Escala do mês cai na primeira ativa, como hoje; e `?escala=` na URL sempre vence.

---

### Task 1: a API (voluntário JES, equipe e jornada só da SP; o auxiliar não desativa)

**Files:** Modify `apps/api/src/cadastros/militares.ts` (`CAMPOS_DO_PECULIO` ganha `voluntarioJes`; o `POST /militares/:id/situacao` exige o dono do Pecúlio também para mudar equipe e jornada), `apps/api/src/usuarios/rotas.ts` (`podeMexerNaConta(..., paraDesativar=true)` não aceita a folga do auxiliar; `podeDesativar` falso para quem só é escalante), `pacotes/contratos/src/militares.ts` (comentário de `podeEditar`: `escala` = motorista e CNH); Test `apps/api/test/militares.test.ts`, `apps/api/test/acesso-rotas.test.ts`

- [ ] **Step 1: testes:**
  - O escalante da lotação manda `PATCH /militares/:id { voluntarioJes: true }` → 403 com a frase de hoje do campo do Pecúlio; o gestor acima da lotação → 200.
  - O escalante da lotação manda `{ motorista: true, cnh: ['B'] }` → 200 (Habilitações continuam da SB).
  - O escalante da lotação manda `POST /militares/:id/situacao` mudando só a equipe ou só a jornada → 403; o gestor acima → 201/200 como hoje; o administrador num militar sem lotação → passa (Review Focus 2).
  - `GET /militares/:id/acesso` pelo escalante, num militar comum com acesso ativo: `podeGerarSenha: true`, `podeDesativar: false`, `papeisQuePodeDar: []`; `POST .../desativar` (a rota de hoje) pelo escalante → 403 "Desativar o acesso é de quem dá o nível de acesso."; pelo gestor → como hoje.
  - O escalante continua gerando a senha provisória de um militar comum e a de um colega escalante com a conta ativa (folga de 21/11/2026).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.32: voluntário JES, equipe e jornada só da SP; o auxiliar não desativa acesso`.

### Task 2: a ficha da escala (blocos, Habilitações, rastreio)

**Files:** Modify `apps/web/src/routes/_app/militares/$id.tsx`, `apps/web/src/componentes/militares/Motorista.tsx` (título e botão), `Identificacao.tsx` (voluntário JES só com `podeEditar.peculio`), `Rastreio.tsx` ("Alterar situação" só com `podeEditar.peculio`), `AcessoAoSistema.tsx` (sem "Desativar acesso" quando `podeDesativar` é falso, se ainda não for assim); Test `apps/web/src/__testes__/militares.test.tsx`, `acesso-ao-sistema.test.tsx`

**Interfaces:** Consumes: `FichaMilitar.podeEditar`, `AcessoDoMilitar.podeDesativar` (Task 1).

- [ ] **Step 1: testes:**
  - Ficha aberta por `/militares/$id` (sem `de`), mesmo para quem `veDadosRestritos`: as seções, nesta ordem, são Identificação, Contato, Habilitações, Afastamentos, Histórico de rastreio, Acesso ao sistema; não há "Dados pessoais" nem "Comportamento".
  - Com `?de=peculio`: Dados pessoais (para quem vê) e Comportamento continuam (Review Focus 3).
  - "Motorista" não aparece; "Habilitações" tem o quadro de motoristas e as categorias de CNH, e o botão "Salvar habilitações"; sem `podeEditar.escala`, só leitura.
  - Sem `podeEditar.peculio`: o voluntário JES aparece só para leitura; o botão "Alterar situação" não aparece; com `podeEditar.peculio`, aparece.
  - Acesso ao sistema para o escalante: "Gerar senha provisória" ativo, sem "Desativar acesso" e sem "Dar nível de acesso".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.32: a ficha da escala com Habilitações e só o que a SB edita`.

### Task 3: toda seção recolhe, e a ficha lembra

**Files:** Modify `apps/web/src/componentes/militares/Secao.tsx`; Test `apps/web/src/__testes__/militares.test.tsx`

**Interfaces:** Produces: `Secao` sem a prop `recolhida` como modo à parte: o título é sempre o botão (`aria-expanded`); começa aberta, salvo o que a pessoa deixou recolhido. A memória fica em `localStorage['ficha:recolhidas']` (lista de títulos), lida e gravada dentro de `try/catch`. Quem usa `recolhida` hoje passa a usar `recolhidaDeInicio` (o padrão quando não há memória). `acoes` aparecem só com a seção aberta, como hoje.

- [ ] **Step 1: testes:** clicar no título de "Afastamentos" fecha e abre a seção; recolher "Contato", desmontar e montar a ficha de outro militar → "Contato" continua recolhido; `localStorage.getItem` lançando erro → a ficha abre com tudo aberto (Review Focus 4); o `resumo` aparece no título com a seção recolhida.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.32: toda seção da ficha recolhe e a tela lembra`.

### Task 4: a Escala do mês abre no ordinário

**Files:** Modify `apps/web/src/routes/_app/escala-do-mes.tsx:49`; Test `apps/web/src/__testes__/escala-do-mes.test.tsx`

- [ ] **Step 1: testes:** com as escalas ativas "Operação X" (JES) e "Ordinário" (Pronto, Saldo), nessa ordem, a tela abre com "Ordinário" escolhida; sem escala com Pronto, a primeira ativa; com `?escala=<id>` na URL, ela (Review Focus 5).
- [ ] **Step 2:** FAIL. **Step 3:** `escalaId = busca.escala ?? ativas.find((e) => e.servicos.some((s) => s.trim().toLowerCase() === 'pronto'))?.id ?? ativas[0]?.id` (o Pronto é reconhecido pelo nome, como os outros serviços fixos em `SERVICOS_FIXOS`). **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador. **Step 5:** commit `Fase 6.32: a Escala do mês abre no ordinário` e enviar a branch à PLANEJAMENTO.
