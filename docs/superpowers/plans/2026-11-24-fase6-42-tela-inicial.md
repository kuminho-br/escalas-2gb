# A tela inicial, versão 2: cena menor e atalhos (6.42) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo (decisão do usuário, 24/11/2026): esta entrega é feita no Fable** (`claude-fable-5-2`), como todo o front-end da refatoração. Se a sessão da DESENVOLVIMENTO estiver em outro modelo, ela avisa o usuário **antes de começar** e espera. A revisão final segue no Opus.

**Goal:** a tela inicial com a cena do combate num quadro menor que encolhe ao rolar, e os módulos como uma fila de atalhos com uma linha de situação, no lugar dos cartões grandes.

**Architecture:** só o site. `apps/web/src/routes/_app/index.tsx` troca a faixa de ponta a ponta por um quadro com margens e cantos arredondados (3:1, até 300 px no computador), que encolhe com a rolagem até uma barra de 64 px; o elemento continua marcado com `data-faixa-boas-vindas`, que a animação do login mede para pousar (`lib/transicao-login/cena.ts`), então o pouso acompanha o quadro novo desde que o recorte da imagem siga a mesma conta nos dois lugares. Os cartões viram atalhos.

**Tech Stack:** React, TanStack Router, Tailwind 4, Vitest.

**Spec e mockup:** o mockup aprovado em 24/11/2026, `docs/telas/refatoracao/tela-inicial/index.html` (na branch `docs-manual-tela-inicial`, PR #212, até o merge), com a tabela "O que muda em relação à tela de hoje"; o Manual em `docs/telas/refatoracao/index.html` ("Tela inicial e moldura"); as diretrizes gerais em `docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md`.

## Global Constraints

- Branch `fase6-42-tela-inicial`, a partir da `main`. Sem migração, sem API nova.
- Skill `frontend-design:frontend-design`; o mockup é guia, não gabarito: adequar ao software e aos componentes da 6.20.
- **Fora desta entrega** (dependem de outra coisa, como diz o mockup): os **Avisos** (precisam de cadastro novo: passam pela CONCEPÇÃO e pela PLANEJAMENTO), os **próximos serviços** dentro da cena e o **"Seu próximo serviço"** (dependem da escala prévia, fase 7). Não se reserva espaço vazio para eles.
- **Saem:** os aniversariantes e "O que falta no mês" (se ainda estiverem na tela), e os dois botões da faixa. O aviso "Essa área é de outro nível de acesso." continua.
- A animação do login continua funcionando e pousa no quadro novo; a versão 2 da animação é outra entrega, que o usuário ainda vai liberar.
- Textos dos atalhos: o nome do módulo e uma linha de situação curta, montada com o que já está no contexto da tela (a unidade de trabalho e o mês atual), sem consulta nova; módulo sem rota mostra "Chega com a fase 7" (Visualização) ou "Em breve".
- Movimento: o encolher acompanha a rolagem sem pular; com `prefers-reduced-motion`, o quadro não anima (muda de tamanho sem transição).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador em 1440, 1280 e 390 px, com e sem a animação do login, e fotografar para o PR.

## Review Focus

1. **O pouso da animação** no quadro novo: a imagem fica no mesmo recorte no último quadro da animação e na tela parada (sem salto), em 1440, 1280 e 390 px.
2. **Rolar até o fim e voltar:** o quadro encolhe até 64 px e volta ao tamanho cheio; a saudação continua legível na barra.
3. **Teclado e leitor de tela:** a saudação recebe o foco no pouso (como hoje); cada atalho é um link com o nome do módulo; a ordem do foco segue a tela.
4. **Notebook de 768 px de altura:** a cena não ocupa mais da metade da tela, e o primeiro atalho aparece sem rolar.
5. **Militar comum** (sem nível de acesso): só os atalhos que ele pode usar, como hoje (`MODULOS.filter(m.ve)`).

---

### Task 1: o quadro da cena

**Files:** Modify `apps/web/src/routes/_app/index.tsx` (a seção `data-faixa-boas-vindas`), o CSS da chegada se precisar, e conferir `apps/web/src/lib/transicao-login/cena.ts` e `medidas.ts` (o recorte 300/576 da imagem); Test `apps/web/src/__testes__/inicio*.test.tsx` (ou o arquivo de hoje da tela inicial) e os da transição do login

- [ ] **Step 1: testes:** o quadro tem margens e cantos arredondados e proporção 3:1 limitada a 300 px no computador; ao rolar, a altura cai até 64 px e não passa disso; com movimento reduzido, sem transição; a saudação recebe o foco no pouso; a transição mede o quadro novo (o mesmo `data-faixa-boas-vindas`) (Review Focus 1, 2 e 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.42: a cena da tela inicial num quadro que encolhe ao rolar`.

### Task 2: os atalhos

**Files:** Modify `apps/web/src/routes/_app/index.tsx` (sai `Cartao`, entra a fila de atalhos), `apps/web/src/lib/modulos.ts` se a linha de situação couber lá (uma função por módulo, com o contexto); Test o arquivo da tela inicial

- [ ] **Step 1: testes:** um atalho por módulo que a pessoa pode usar, com o nome e a linha de situação; o módulo sem rota não é link e mostra "Em breve" (ou "Chega com a fase 7" na Visualização); saíram os cartões grandes, os aniversariantes e "O que falta no mês"; nenhuma rolagem de lado em 390 px (Review Focus 4 e 5).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador e fotografar as três larguras. **Step 5:** commit `Fase 6.42: os módulos viram atalhos na tela inicial` e enviar a branch à PLANEJAMENTO.
