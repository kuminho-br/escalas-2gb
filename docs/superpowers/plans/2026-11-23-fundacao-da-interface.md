# Fundação da interface (entregas 6.20 e 6.21): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pôr no código as diretrizes gerais aprovadas (N1, o sistema de estilo) e a resposta do sistema (N2), com as propostas P1 e P2 aceitas, sem redesenhar nenhuma tela inteira.

**Architecture:** os tokens ficam em `apps/web/src/estilo.css` (Tailwind 4, `@theme`) e cada componente de `apps/web/src/componentes/ui/` passa a ser a peça única daquele tipo. As telas trocam o que escrevem à mão pelas peças, sem mudar o arranjo (o arranjo de cada tela é das entregas N3 a N5). A resposta do sistema é um provedor único (aviso, confirmação, espera, vazio) usado por todas as telas.

**Tech Stack:** React, TanStack Router e Query, Tailwind 4, class-variance-authority, lucide-react, Vitest e Testing Library; Hono na API (só a P1).

**Spec:** `docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md` (valores e medidas, aprovado em 23/11/2026) e `docs/superpowers/specs/2026-11-23-refatoracao-da-interface-design.md` (blocos N1 e N2, "Diretrizes do usuário"). Mockup: `docs/telas/refatoracao/diretrizes-gerais/index.html`.

## Global Constraints

- **O mockup é guia, não gabarito** (diretriz do usuário). Ative a skill `frontend-design:frontend-design` em toda task. Onde a peça divergir do software, adeque, registre a diferença no resumo do PR e siga.
- Os valores das tabelas da spec do sistema de estilo valem como estão (cores, letra, forma, placa, componentes, resposta, moldura). Só `alerta-fundo` é token novo; saem `encaixe-claro`, os rosados do botão de contorno, o `#F6F7F9` e o verde de "completa".
- Nenhum texto abaixo de 13 px. Algarismos `tabular-nums` em todo o site.
- Patente sem "BM" (já no cadastro desde a 6.15). Nas telas e textos, a palavra é "patente"; no código o nome interno não muda.
- **P5 negada:** a matrícula continua em cada linha da guarnição. **P6 negada:** o mês vazio não sugere gerar a pré-escala. **P3** (escolher militar num painel ao lado) é da entrega da Escala do mês, não desta. **P7** (menu do celular numa barra embaixo) está pendente com o usuário: não implementar; o menu do celular continua como hoje.
- A Grade geral fica sem a marca do dia de hoje (entrega 6.17). A marca da Grade é provisória: não redesenhar a Grade aqui.
- Não mudar regra de negócio nem o arranjo das telas. Não mudar contrato da API, fora da P1.
- Nenhum dado pessoal real; matrículas fictícias `990xxx-x`.
- Antes de cada PR: `pnpm test && pnpm typecheck && pnpm build:vercel`. Conferir no navegador, com dados fictícios, em 1440 e 390 px.

## Review Focus

1. **Tela que deixa de rolar de lado no celular depois da troca de altura de controle (44 px no toque):** nenhuma tela rola de lado em 390 px. Teste na Task 3.
2. **Aviso de resultado com "Desfazer" depois que a escala mudou:** o desfazer não pode apagar a escolha de outra pessoa; responde "A escala mudou desde então. Não dá mais para desfazer." Teste na Task 5.
3. **Duas ações seguidas antes de o primeiro aviso sumir:** o segundo aviso substitui o primeiro, e o "Desfazer" do primeiro deixa de valer. Teste na Task 4.
4. **Foco depois de fechar confirmação e menu da placa com Esc:** volta ao botão que abriu. Teste nas Tasks 2 e 4.
5. **Espera que pisca em resposta rápida:** a espera só aparece depois de 200 ms, para a tela não piscar. Teste na Task 4.

---

# Entrega 6.20 — Sistema de estilo (N1)

Branch `fase6-20-sistema-de-estilo`, a partir da `main` depois da 6.18. Sem migração.

### Task 1: tokens e a guarda de estilo

**Files:** Modify `apps/web/src/estilo.css`; Create `apps/web/src/__testes__/guarda-de-estilo.test.ts`

**Interfaces:**
- Produces: os tokens da spec com os nomes de hoje (`--color-vinho`, `--color-tinta`, `--color-apagado`, `--color-encaixe`, `--color-linha`, `--color-fundo`, `--color-passa`, `--color-superficie`, `--color-pendencia`, `--color-pendencia-fundo`, `--color-alerta`, `--color-alerta-fundo`), os 6 tamanhos de letra (`--text-abertura` 40/44, `--text-titulo` 28/32, `--text-bloco` 20/26, `--text-nome` 17/24, `--text-base` 15/22, `--text-apoio` 13/18), `--radius-controle` 6 px, `--radius-superficie` 12 px, `--shadow-apoiada`, `--shadow-por-cima`, `--altura-controle` (36 px; 44 px com `pointer: coarse` e abaixo de 768 px).

- [ ] **Step 1: o teste da guarda** (N1.5): percorre `apps/web/src/**/*.{tsx,ts,css}` e falha quando acha cor escrita à mão (`#rgb`, `#rrggbb`, `rgb(` fora de `estilo.css`), tamanho arbitrário de letra (`text-[`) ou raio arbitrário (`rounded-[`). Lista de exceções no próprio teste, vazia ao fim da entrega, fora das cores do serviço (vêm do cadastro).
- [ ] **Step 2:** rodar; esperado FAIL com a lista do que está escrito à mão hoje.
- [ ] **Step 3:** os tokens em `estilo.css`; os aliases do shadcn (`--color-primary`, `--color-secondary`, `--color-input`…) apontam para os tokens; saem os tokens que a spec tira.
- [ ] **Step 4:** a guarda continua falhando só nos arquivos das Tasks 2 e 3 (anotar a lista).
- [ ] **Step 5:** commit `Fase 6.20: tokens do sistema de estilo e a guarda`.

### Task 2: os componentes

**Files:** Modify `apps/web/src/componentes/ui/*.tsx`, `Campo.tsx`, `CampoDeMes.tsx`, `Selecao.tsx`, `EtiquetaDoServico.tsx`, `ImportarPlanilha.tsx` (envio de arquivo); Create `apps/web/src/componentes/ui/contador.tsx`, `apps/web/src/componentes/ui/marcar.tsx` se não houver equivalente; Test: `apps/web/src/__testes__/componentes-ui.test.tsx`

**Interfaces:**
- Produces: `Button` com `variant: 'principal' | 'secundario' | 'discreto' | 'perigoso' | 'perigoso-cheio'` e `ocupado?: string` (o verbo, "Salvando…"); `Campo` com `rotulo`, `ajuda?`, `erro?`, `opcional?` (o erro ligado por `aria-describedby`); `Etiqueta` com `tipo: 'servico' | 'falta' | 'erro' | 'neutra'`; as abas, a tabela, a lista de opções, a data, o mês, marcar e escolher, o contador e o envio de arquivo com as medidas da spec, seção "Componentes".

- [ ] **Step 1: testes:** cada variante do botão tem a classe do token certo; o botão ocupado mostra o verbo e fica `aria-busy`; o campo com erro liga a frase por `aria-describedby`; o rótulo do opcional diz "(opcional)"; a lista de opções abre para cima quando falta espaço; a tabela rola dentro do próprio quadro.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar as peças. Os nomes de `variant` antigos (`default`, `outline`, `destructive`, `ghost`) são trocados nos usos; não ficam como sinônimos.
- [ ] **Step 4:** PASS, e os testes de tela que já existiam continuam passando.
- [ ] **Step 5:** commit `Fase 6.20: um componente de cada`.

### Task 3: a placa, o encaixe, o cartão, a moldura e o menu da placa (com a P2)

**Files:** Create `apps/web/src/componentes/Placa.tsx`, `Encaixe.tsx`, `CartaoDaGuarnicao.tsx`, `Moldura.tsx`; Modify `VagaVazia.tsx` (vira `Encaixe`), os componentes de `escala-do-mes/`, `grade/`, `efetivo-por-dia/`, `oficiais/` que desenham militar e vaga, `Trilho.tsx` (ícones), as rotas de `routes/_app/` (título pela `Moldura`); Test: `placa.test.tsx`, `moldura.test.tsx`, os testes das telas tocadas

**Interfaces:**
- Produces: `Placa({ patente, nome, matricula?, servico?: { nome, cor, origem }, acumulaCom?, estado?: 'normal' | 'escolhida' | 'choque', choque?: string, acoes?: AcaoDaPlaca[] })`; `AcaoDaPlaca = { rotulo: 'Trocar militar' | 'Remover da vaga' | 'Remover do turno'; aoEscolher: () => void }`; `Encaixe({ obrigatorio: boolean, aoEscolher })`; `CartaoDaGuarnicao({ nome, viatura?, faltam: number, children })`; `Moldura({ titulo, contexto?, acaoPrincipal?, filtros?, children })`.

- [ ] **Step 1: testes:**
  - A placa mostra patente e nome; o nome do serviço só quando a origem não é Pronto (conferir no contrato se o cartão da guarnição traz a origem; se não trouxer, acrescentar no contrato e na API, sem mudar o resto).
  - O botão das ações (três pontos) está sempre à mostra; com pouca largura, quem corta é o nome; a dica traz patente, nome, matrícula e serviço.
  - **P5 negada:** a matrícula continua visível na linha da guarnição.
  - O menu da placa tem "Trocar militar" e "Remover da vaga"; fecha com Esc e devolve o foco à placa (Review Focus 4).
  - **P2:** "Trocar militar" remove o militar e abre a escolha da mesma vaga em seguida; cancelar a escolha deixa a vaga vazia, com o aviso da Task 5.
  - O cartão diz "Falta 1" / "Faltam N" ou tem o visto com "Completa" para leitor de tela; com menos de 340 px, o rótulo da função sobe para cima dos lugares.
  - O título da tela aparece uma vez só, vindo da `Moldura`.
  - Os itens do menu lateral têm o ícone de 20 px antes do nome, os desenhos de hoje refeitos num traço só (lucide com `strokeWidth={1.75}`, ou o desenho próprio do mockup).
  - **Review Focus 1:** nenhuma tela de `routes/_app/` rola de lado em 390 px (teste de largura com o conteúdo de exemplo).
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar; trocar nas telas o desenho à mão pelas peças, sem mudar o arranjo nem a ordem dos blocos.
- [ ] **Step 4:** PASS; a guarda de estilo da Task 1 passa sem exceções; verificações do fim de entrega; conferir no navegador.
- [ ] **Step 5:** commit `Fase 6.20: placa, encaixe, cartão e moldura` e abrir o PR.

---

# Entrega 6.21 — Resposta do sistema (N2, com a P1)

Branch `fase6-21-resposta-do-sistema`, a partir da 6.20. Sem migração prevista; se a P1 precisar guardar a vaga de origem da remoção, a migração é a 0040 (a próxima livre) e o PR leva "tem migração" no título.

### Task 4: aviso, confirmação, espera, erro junto e vazio

**Files:** Create `apps/web/src/componentes/resposta/ProvedorDeResposta.tsx`, `useAviso.ts`, `useConfirmar.ts`, `Espera.tsx`, `Vazio.tsx`; Modify as telas com `window.confirm` (11 usos hoje), as que mostram "Carregando…" em texto, as que mostram erro no pé do formulário e os vazios; Test: `resposta.test.tsx` e os testes das telas tocadas

**Interfaces:**
- Produces: `useAviso(): (a: { texto: string; desfazer?: () => Promise<void>; erro?: boolean }) => void`; `useConfirmar(): (c: { titulo: string; texto?: string; verbo: string; perigoso?: boolean; digitar?: string }) => Promise<boolean>`; `Espera({ linhas?: number; altura?: number })`; `Vazio({ titulo, frase, acao?: { rotulo, aoClicar } })`.

- [ ] **Step 1: testes:**
  - Nenhum `window.confirm` sobra no site (teste de busca no código); a confirmação tem "Cancelar" e o verbo no botão; Esc cancela e devolve o foco (Review Focus 4).
  - Aviso: embaixo, no meio, `role="status"`; 8 s com "Desfazer", 4 s sem; não some com o mouse em cima nem em foco; o de erro espera a pessoa e tem "Tentar de novo".
  - **Review Focus 3:** duas ações seguidas: o segundo aviso substitui o primeiro, e o "Desfazer" do primeiro some.
  - **Review Focus 5:** a espera só aparece depois de 200 ms; ocupa o lugar e a altura do conteúdo; "Carregando…" só para leitor de tela.
  - O erro aparece no campo ou na linha que o causou, não no pé.
  - Cada tela tem um vazio só, com título, frase e o próximo passo num botão secundário. **P6 negada:** o vazio da Escala do mês não sugere gerar a pré-escala.
  - A barra de salvar das fichas (D3) **não** entra aqui: é da entrega das fichas (N5).
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar o provedor no casco (`routes/_app.tsx`) e trocar os usos tela a tela. Salvar, remover, gerar pré-escala e importar passam a responder pelo aviso.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `Fase 6.21: aviso, confirmação, espera e vazio`.

### Task 5: P1, remover da vaga com "Desfazer"

**Files:** Modify `apps/api/src/escala/alocacoes.ts`, `apps/api/src/escala/rotas.ts`, `pacotes/contratos/src/` (o contrato do desfazer), `apps/web/src/api/escala-do-mes.ts`, `apps/web/src/routes/_app/escala-do-mes.tsx` e `componentes/escala-do-mes/*`; Test: `apps/api/test/escala-*.test.ts` (o arquivo do remover), `apps/web/src/__testes__/escala-do-mes*.test.tsx`

**Interfaces:**
- Produces: o desfazer da remoção devolve o militar à mesma vaga (dia, turno, guarnição, função e lugar) e tira a marca de removido, numa transação; responde 409 `"A escala mudou desde então. Não dá mais para desfazer."` quando a vaga já foi ocupada ou a guarnição mudou.

- [ ] **Step 1: testes:**
  - API: remover e desfazer devolve o militar ao mesmo lugar e tira a marca; com a vaga ocupada por outro depois da remoção, 409 com a frase, e nada muda (**Review Focus 2**); quem não pode alterar a escala recebe 403.
  - Site: remover não pergunta; mostra o aviso "{patente} {nome} saiu de {função} da {guarnição}." com "Desfazer"; desfazer devolve à vaga; "Removidos" e "Permitir de novo" continuam como hoje.
  - No celular, abrir a escolha de militar para uma vaga **não** põe o foco na busca: o teclado só aparece quando a pessoa toca na caixa de busca (diretriz do usuário, 23/11/2026; o item também está na 6.17 e, se já estiver feito, só manter o teste).
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar. Se a marca de remoção já guarda a vaga, usar; senão, a migração 0040 acrescenta as colunas da vaga de origem.
- [ ] **Step 4:** PASS; verificações do fim de entrega; conferir no navegador.
- [ ] **Step 5:** commit `Fase 6.21: remover com Desfazer (P1)` e abrir o PR.

---

## Depois desta fundação

As áreas de tela (Grade geral, Escala do mês com a P3, moldura e navegação, fichas, celular) entram uma por vez, conforme a DESIGN entregar e o usuário aprovar.
