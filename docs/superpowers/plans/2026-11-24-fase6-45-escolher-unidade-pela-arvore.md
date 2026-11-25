# Escolher a unidade pela árvore (6.45): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo (decisão do usuário, 24/11/2026): front-end no Fable** (`claude-fable-5-1` ou o Fable que o usuário escolher no `/model`). Se a sessão estiver em outro modelo, avise o usuário antes de começar e espere. Revisão final no Opus.

**Goal:** toda escolha de unidade do sistema passa a ser feita **pela árvore, nó a nó**, com um botão que abre a hierarquia toda; somem as listas planas de unidades.

**Pedidos do usuário (24/11/2026, itens 9, 10 e 11 do pool `docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`):**
1. O seletor de unidade do Topo (CBMPE / DGO / DInter/1 / 2º GB / DivOp / 7ª SB): abrir a hierarquia **nó a nó, um nível por vez**, porque a árvore vai crescer e a lista inteira não cabe; e, no começo, um botão que **abre a hierarquia toda** de uma vez, sem clicar nível a nível. É escolha de quem usa.
2. A caixa "Lotação" do Pecúlio (lista plana: Todas, 1ª SB, 2ª SB, 7ª SB, DGO, DInter/1) não serve mais na árvore genérica (6.25). Revisão geral de quem ainda usa lista plana de unidades.
3. A lotação de destino do "Alterar situação" (lista plana com "DA (1º GB)", "DA (2º GB)"…) segue a lógica da árvore genérica.

**Architecture:** um componente só, `EscolherUnidade`, que recebe as unidades permitidas (com `id`, `sigla`, `maeId`) e monta a árvore no navegador: cada nó com seta para abrir os filhos, o caminho da escolhida sempre aberto, e no alto "Abrir tudo" / "Fechar tudo". As rotas que alimentam as escolhas passam a devolver `maeId` (e a sigla sem o sufixo "(cima)": a árvore já mostra o contexto). O componente entra no Topo e nos cinco lugares de lista plana.

**Tech Stack:** Hono, zod, React, Radix (o menu/painel que já existe), Tailwind 4, Vitest.

## Escolhas da PLANEJAMENTO

- **Unidade fora da lista permitida, mas no caminho:** aparece na árvore como passagem (apagada, não escolhível), para que a filha permitida tenha onde ficar. Ex.: o auxiliar da 7ª SB vê CBMPE › DGO › … › 7ª SB, e só a 7ª SB é escolhível.
- **Abrir tudo:** o botão alterna entre "Abrir tudo" e "Fechar tudo"; a última escolha fica lembrada no navegador (`localStorage['arvore:aberta-toda']`, com `try/catch`). Fechado é o padrão; ao abrir o seletor, o caminho da unidade atual já vem aberto.
- **Busca por sigla** dentro do seletor quando a árvore tem mais de 15 unidades: digitar filtra e mostra as que batem com o caminho delas aberto.
- **Teclado:** setas para cima e para baixo andam entre os nós visíveis; direita abre, esquerda fecha ou sobe ao pai; Enter escolhe (padrão de árvore, `role="tree"` e `role="treeitem"` com `aria-expanded`).
- **No Topo:** o grupo "Só consulta" continua separado, como hoje, com a mesma árvore. O caminho no botão do Topo não muda.
- **Filtros (Pecúlio, Consulta):** escolher um nó filtra por ele e pelas unidades de baixo (a lista do Pecúlio já traz as de baixo; a Consulta ganha o mesmo). "Todas" é o estado sem nó escolhido, com um "Limpar".

## Global Constraints

- Branch `fase6-45-escolher-unidade-pela-arvore`, a partir da `main`. Sem migração.
- Skill `frontend-design:frontend-design`; componentes da 6.20.
- Nenhuma lista plana de unidades sobra no site: conferir com `grep` por `<option` alimentado por unidades e por consultas de unidades (`consultaUnidadesDeLotacao`, `unidadesParaPapel`, `consulta/unidades`, `eu.unidades`). O seletor de equipe, jornada e quadro continua como está.
- Textos fixos: "Abrir tudo", "Fechar tudo", "Buscar unidade", "Limpar".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com uma árvore de dados fictícios de 4 níveis ou mais, em 1440 e 390 px. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Sigla repetida** ("DA" no 1º GB e no 2º GB; "1ª SB" de cada grupamento): na árvore, cada uma no seu lugar, sem sufixo, e o leitor de tela diz o caminho ("DA, em 1º GB").
2. **Unidade permitida cuja mãe não é permitida:** aparece debaixo da mãe apagada; nunca fica solta nem some.
3. **Unidade encerrada** (`ate` no passado): não aparece, como hoje.
4. **Celular (390 px):** a árvore cabe na tela, rola por dentro e não rola de lado.
5. **Trocar de unidade com alteração pendente** (Topo): continua perguntando antes, como hoje.

---

### Task 1: as rotas devolvem a unidade-mãe

**Files:** Modify `apps/api/src/cadastros/militares.ts` (`/unidades-de-lotacao`: devolver `maeId` e a sigla sem sufixo), `apps/api/src/usuarios/rotas.ts` (`unidadesParaPapel`: `maeId`), `apps/api/src/visao/*` (`/consulta/unidades`: `maeId`), a rota de `/api/eu` (`unidades` e `unidadesSoConsulta`: `maeId`); `pacotes/contratos` (os tipos ganham `maeId: string | null`); Test os de cada rota

- [ ] **Step 1: testes:** cada lista traz `maeId` certo; a sigla repetida vem sem "(cima)"; a raiz vem com `maeId: null`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.45: as listas de unidades trazem a unidade-mãe`.

### Task 2: o componente `EscolherUnidade`

**Files:** Create `apps/web/src/componentes/EscolherUnidade.tsx`, `apps/web/src/lib/arvore-de-unidades.ts` (montar a árvore com as passagens); Test `apps/web/src/__testes__/escolher-unidade.test.tsx`

**Interfaces:**
- Produces: `montarArvore(unidades: { id: string; sigla: string; maeId: string | null }[], todas?: { id; sigla; maeId }[]): No[]` (com as passagens apagadas) e `EscolherUnidade({ unidades, valor, aoEscolher, rotulo, permiteLimpar? })`.

- [ ] **Step 1: testes:** abre nó a nó; o caminho da escolhida vem aberto; "Abrir tudo" abre todos os níveis e vira "Fechar tudo"; a escolha fica lembrada (e `localStorage` que lança erro não quebra); a busca por sigla filtra mostrando o caminho; teclado (setas, Enter); passagem apagada não é escolhível (Review Focus 2); sigla repetida com o caminho no nome acessível (Review Focus 1).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.45: escolher a unidade pela árvore`.

### Task 3: o Topo

**Files:** Modify `apps/web/src/componentes/Topo.tsx`; Test `apps/web/src/__testes__/casca.test.tsx`

- [ ] **Step 1: testes:** o seletor abre a árvore nó a nó, com "Abrir tudo"; "Só consulta" continua separado; escolher troca a unidade como hoje (inclusive a pergunta com alteração pendente, Review Focus 5); com uma unidade só, continua só leitura.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.45: o seletor do Topo nó a nó`.

### Task 4: fim das listas planas

**Files:** Modify `apps/web/src/routes/_app/peculio.tsx` (filtro "Lotação"), `apps/web/src/routes/_app/consulta.tsx` ("Lotados em"), `apps/web/src/componentes/militares/Rastreio.tsx` (lotação de destino do "Alterar situação"), `NovoMilitar.tsx` (lotação), `AcessoAoSistema.tsx` (unidade do nível de acesso, mantendo o filtro `aceitaLateral` do quinto nível); Test os de cada tela

- [ ] **Step 1: testes:** cada um dos cinco lugares escolhe pela árvore; no Pecúlio e na Consulta, escolher um nó filtra por ele e pelos de baixo, e "Limpar" volta a "Todas"; nenhuma lista plana de unidades sobra (conferência por busca no código, como nas guardas da 6.20).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar. **Step 5:** commit `Fase 6.45: sem listas planas de unidades` e enviar a branch à PLANEJAMENTO.
