# O cabeçalho novo e a unidade em degraus (6.61) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o cabeçalho de todas as telas fica como o do mockup v3 da tela inicial:
- um fio vinho no alto, o brasão do 2º GB e o nome "Sistema de Gestão - 2º GB";
- a unidade de trabalho escolhida em degraus, um botão por nível;
- à direita, as iniciais num círculo vinho, o nome e o nível de acesso.

**Architecture:** o Topo (`apps/web/src/componentes/Topo.tsx`) troca o desenho e troca o seletor da árvore numa caixa só (`PainelDaArvore`, da 6.45) por um componente novo de degraus. A regra de escolher continua a mesma de hoje: a função `escolher` do Topo, que guarda a unidade, pergunta se há alteração pendente e leva à lista da tela atual. O `PainelDaArvore` continua existindo para os outros lugares que o usam (filtros do Pecúlio e da pesquisa). A árvore que alimenta os degraus é a mesma de hoje (`montarArvore`, com as passagens).

**Tech Stack:** React, TanStack Router e Query, Radix (Popover, DropdownMenu), Tailwind com os tokens da 6.20, Vitest.

**Spec:** o mockup v3 da tela inicial, aprovado pelo usuário em 26/11/2026: `docs/telas/refatoracao/tela-inicial/index.html` (a linha "Cabeçalho" da tabela "O que muda") e `inicio.js` (o comentário e a função `montarUnidade`, com as regras dos degraus) e `inicio.css` (o desenho do cabeçalho). `docs/decisoes.md` (26/11: o cabeçalho vira a 6.61). Mockup é guia, não gabarito.

## Global Constraints

- Branch `fase6-61-cabecalho-novo`, a partir da `main`. Sem migração.
- **O nome do sistema** passa a ser "Sistema de Gestão - 2º GB" no lugar de "Escalas 2º GB", no Topo e no Trilho (o texto do celular em `apps/web/src/componentes/Trilho.tsx`). O `<title>` do site também, se hoje disser "Escalas 2º GB".
- **O brasão** é o do 2º GB (`docs/telas/refatoracao/img/brasao-2gb.png`, copiado para `apps/web/public/`), com o texto alternativo "Brasão do 2º Grupamento de Bombeiros". O link para o início continua onde está hoje (o brasão e o nome levam a `/`).
- **O fio vinho** no alto do cabeçalho, com o token `vinho`.
- **Os degraus** (as regras do mockup):
  - um botão por nível do caminho da unidade de trabalho, separados por "›";
  - cada degrau abre só as unidades de dentro do degrau anterior;
  - só aparecem as unidades a que a pessoa tem acesso ou que levam a uma delas;
  - um nível com uma opção só vira texto, sem botão;
  - escolhida uma unidade que tem unidades abaixo, o próximo nível abre sozinho, até a pessoa parar numa unidade sua ou chegar à folha;
  - a "passagem" (a unidade acima das da pessoa, que só serve para descer) nunca vira a unidade de trabalho: parado nela, o próximo degrau aparece como obrigatório ("Escolha a {tipo}"), e fechar ali volta à unidade de antes;
  - o próximo nível, quando existe, aparece tracejado com o nome do tipo das unidades de baixo ("Seção");
  - as unidades só de consulta levam a etiqueta "Só consulta" e, escolhidas, viram a unidade de consulta (como hoje).
- **O nome do nível** vem do cadastro: o `tipo_unidade` das unidades daquele nível. Se forem de tipos diferentes, "Unidade". Se a lista de unidades que o site recebe ainda não traz o tipo, acrescentá-lo na API, sem migração. Nada de lista de nomes no código.
- **À direita:** as iniciais do nome de guerra num círculo vinho, o posto e o nome de guerra e, embaixo, o nível de acesso na unidade de trabalho. Usar o rótulo que o site já usa para o nível; procurar antes de criar um. O menu que abre (e-mail e "Sair") não muda.
- **No celular:** só o brasão, a seção atual e as iniciais. Tocar na seção abre os degraus num painel, um embaixo do outro, com as mesmas regras.
- **Teclado:** setas para cima e para baixo na lista aberta; Esc fecha, com a regra da passagem; o foco volta ao último degrau. Leitura de tela: o degrau atual tem `aria-current="location"`; ao trocar, um aviso "Unidade de trabalho: {caminho}".
- **Com uma unidade só** (o militar comum, o auxiliar de uma seção): o caminho fica só para leitura, como hoje, com o desenho novo.
- Skill `frontend-design:frontend-design`; tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Administrador da raiz com centenas de unidades:** o primeiro degrau que se abre mostra as diretorias, e não a árvore inteira; descer até uma seção leva no máximo cinco escolhas (Task 2).
2. **Alteração pendente na tela:** escolher outra unidade nos degraus pergunta antes, e desistir deixa a unidade e os degraus como estavam (Task 2).
3. **Gestor com acesso só ao 2º GB e às seções:** os degraus de cima (CBMPE, DGO, DInter/1) aparecem como texto, porque têm uma opção só, e não abrem listas (Task 2).
4. **Fechar numa passagem:** parar no "4º GB" sem acesso e apertar Esc volta à unidade de antes, sem trocar a unidade de trabalho (Task 2).
5. **Celular, 390 px, com um caminho longo:** o cabeçalho não passa da largura; o painel dos degraus rola por dentro (Task 3).

---

### Task 1: o desenho do cabeçalho

**Files:** Modify `apps/web/src/componentes/Topo.tsx`, `apps/web/src/componentes/Trilho.tsx`, `apps/web/index.html` (o título, se for o caso); Create `apps/web/public/brasao-2gb.png` (cópia do arquivo do Manual); Test o teste do Topo (`apps/web/src/__testes__/`)

- [ ] **Step 1: testes:** o nome "Sistema de Gestão - 2º GB" no Topo e no Trilho, e "Escalas 2º GB" em lugar nenhum do site. O brasão do 2º GB com o texto alternativo. O fio vinho. As iniciais, o nome e o nível de acesso à direita, com o menu de hoje. Com uma unidade só, o caminho só para leitura.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.61: o cabeçalho novo`.

### Task 2: a unidade em degraus

**Files:** Create `apps/web/src/componentes/DegrausDaUnidade.tsx`, `apps/web/src/lib/degraus.ts` (puro); Modify `apps/web/src/componentes/Topo.tsx` (o Popover do `PainelDaArvore` dá lugar aos degraus), a API das unidades, se faltar o tipo; Test `apps/web/src/__testes__/degraus-da-unidade.test.tsx`, `apps/web/src/__testes__/degraus.test.ts`

**Interfaces (Produces):** em `degraus.ts`, sobre os nós de `montarArvore`:
- `degrausDoCaminho(arvore: No[], unidadeId: string): { no: No; opcoes: No[] }[]` (cada nível com as opções de dentro do anterior);
- `proximoNivel(no: No): { rotulo: string; obrigatorio: boolean } | null`.

- [ ] **Step 1: testes:**
  - As funções puras com uma árvore fictícia (CBMPE › DGO › DInter/1 › 2º GB › 1ª SB e vizinhas): um nível de uma opção vira texto; o rótulo do próximo nível sai do tipo; a passagem dá `obrigatorio`.
  - A tela: escolher abre o próximo nível sozinho; escolher uma unidade sua chama a mesma `escolher` de hoje (guardar, `podeDescartar`, ir à lista da tela); "Só consulta" com a etiqueta e o comportamento de hoje.
  - O teclado e a leitura de tela das Global Constraints.
  - Os Review Focus 1 a 4.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.61: a unidade de trabalho em degraus`.

### Task 3: o cabeçalho no celular

**Files:** Modify `apps/web/src/componentes/Topo.tsx`, `apps/web/src/componentes/DegrausDaUnidade.tsx`; Test o teste dos degraus

- [ ] **Step 1: testes:** em 390 px, o cabeçalho mostra só o brasão, a seção atual e as iniciais. Tocar na seção abre os degraus num painel, um embaixo do outro, com as mesmas regras. Fechar devolve o foco à seção. O Review Focus 5.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Rodar as verificações do fim de entrega. Conferir no navegador, em 1440 e 390 px:
  - administrador da raiz descendo até uma seção;
  - gestor do 2º GB;
  - militar comum;
  - trocar de unidade com uma alteração pendente;
  - a passagem com Esc.
- [ ] **Step 5:** commit `Fase 6.61: os degraus no celular`. Enviar a branch à PLANEJAMENTO.
