# Os próximos serviços na tela inicial (6.55) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** a tela inicial mostra, dentro da cena, os próximos serviços do militar em cartões (dia da semana, dia do mês, serviço e horário, no fundo da cor do serviço); a cena fica mais alta; a barra encolhida diz o próximo serviço; embaixo dos atalhos, o detalhe "Seu próximo serviço".

**Architecture:** uma rota nova da API, `GET /api/eu/proximos-servicos`, devolve até seis serviços do militar que ainda não acabaram, atravessando meses, com a mesma origem da Minha escala (7.5: escalas fora do rascunho). O contrato `MeuServico` ganha a cor do serviço e a letra do turno (aditivo, a Minha escala recebe junto). No site, a tela inicial (`apps/web/src/routes/_app/index.tsx`) ganha os cartões na cena, a linha da barra encolhida e o bloco do detalhe, com as contas de texto (dia, horário) numa peça pura e testada.

**Tech Stack:** Hono, Postgres/PGlite, zod (`contratos`), React, TanStack Query, Tailwind com os tokens da 6.20, Vitest.

**Spec:** o mockup v3 da tela inicial da DESIGN, aprovado pelo usuário em 26/11/2026 **sem o cabeçalho novo** (que vira a 6.61). Ele ainda está fora da `main`: ler no commit `87f9ab3` da branch `docs-manual-entrada-v2`, com `git show 87f9ab3:docs/telas/refatoracao/tela-inicial/index.html` (e `inicio.css`, `inicio.js` na mesma pasta). Mockup é guia, não gabarito: adequar ao que o site já tem. Decisão do usuário de 25/11/2026 sobre o cartão em `docs/decisoes.md`.

## Global Constraints

- Branch `fase6-55-proximos-servicos`, a partir da `main`. Sem migração.
- **Fora desta entrega:** o cabeçalho novo (brasão, "Sistema de Gestão - 2º GB", a unidade em degraus), que é a 6.61; os avisos, que são a 6.56 (deixar o lugar deles à direita da cena, sem nada dentro); a animação da Entrada v2, ainda em revisão pelo usuário.
- **A cena:** no computador, 3:1 da largura, até **400 px** (hoje 300); no celular, **250 px** (hoje 200). A barra encolhida continua com 64 px. A animação do login pousa na mesma conta (`apps/web/src/lib/transicao-login/recorte.ts`): mudar a altura num lugar só (`apps/web/src/lib/cena-inicial.ts`).
- **O cartão:** quatro informações, nesta ordem: o dia da semana abreviado em minúsculas ("qui", "sáb"), o dia do mês ("1º" no dia 1, os outros só o número), o nome do serviço (cortado com reticências se não couber) e o horário. Fundo: a cor do serviço com 16% de tinta (`color-mix(in srgb, <cor> 84%, var(--tinta))` ou o equivalente nos tokens), texto branco. 112 px de largura no computador, 104 no celular. O primeiro (o mais próximo) tem contorno branco de 2 px. Até **seis** cartões; no celular a fila rola de lado, sem barra de rolagem visível.
- **O horário:** "7h às 19h"; com minutos, "7h30 às 19h30"; fim à meia-noite é "24h" ("16h às 24h"); turno que vira o dia é escrito como é ("19h às 7h").
- **Leitura de tela:** cada cartão tem o rótulo "{dia da semana por extenso}, {dia}, {serviço}, das {horário}" (ex.: "quinta, 26, Pronto, das 7h às 19h"); a lista tem o título visível "Seus próximos serviços".
- **Quais serviços:** os do militar da conta nas escalas fora do rascunho (as mesmas da Minha escala), que ainda não acabaram agora (horário de Recife; o serviço em andamento conta), em ordem de data e início, até seis, atravessando o mês.
- **A barra encolhida:** a saudação curta e "Próximo serviço: {dia por extenso}, {dia}, {serviço}, {horário}"; no celular, cortada com reticências.
- **"Seu próximo serviço"** (bloco embaixo dos atalhos, o detalhe do primeiro cartão): o dia por extenso, o dia e o mês ("de novembro"); "{serviço}, das {horário}"; "Turno {letra}." (omitido no turno `U`) seguido de "Na {guarnição}, como {função em minúsculas}." quando há guarnição (sem função: "Na {guarnição}."); quem vai junto, com a placa de cada um (`apps/web/src/componentes/Placa.tsx`), o próprio marcado; quando a escala está em prévia, a linha "Escala em prévia: pode mudar."; o elo "Ver minha escala do mês" (para `/minha-escala` no mês do serviço).
- **Sem serviço:** no lugar dos cartões, "Nenhum serviço marcado para você."; sem o bloco do detalhe e sem a linha da barra. **Conta que não é de militar** (a rota responde 404): nada da área aparece, sem mensagem. **Erro da API:** nada da área aparece; a tela inicial nunca quebra por causa dela.
- **Chegada pela animação do login:** os cartões entram junto com a saudação (o mesmo `data-chegada`); nada de animação nova.
- Skill `frontend-design:frontend-design`; tokens e componentes da 6.20. Nenhum dado pessoal real em repositório, teste ou CI (matrículas `990xxx-x`).
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Virada de mês:** no dia 29/11, com serviços em 30/11, 2/12 e 5/12, os cartões mostram os três, e o 2 de dezembro aparece como "2" e o 1º como "1º" (Task 1 e Task 2).
2. **Serviço que vira a noite e está em andamento:** às 3h de 27/11, o serviço de 26/11 das 19h às 7h ainda é o primeiro cartão; às 7h01 já não é (Task 1).
3. **Cor clara do serviço** (como a do Bioma): o texto branco continua legível no cartão; o contraste fica no mínimo de 4,5:1 com a mistura de 16% de tinta, e se uma cor cadastrada não alcançar, a mistura aumenta para essa cor (Task 2).
4. **Nome de serviço comprido** ("Operação Verão Litoral Sul"): corta com reticências e o cartão não alarga (Task 2).
5. **Cena mais alta e a animação do login:** a animação pousa exatamente no quadro novo (400 px no computador largo, 250 no celular), sem salto no fim (Task 3).

---

### Task 1: os próximos serviços na API

**Files:** Modify `pacotes/contratos/src/visualizacao.ts`, `apps/api/src/escala/visualizacao-rotas.ts`; Test `apps/api/test/` (o teste da Minha escala da 7.5 e um novo, `proximos-servicos.test.ts`)

**Interfaces (Produces):**
- Em `MeuServico`, dois campos novos: `cor: string` (a cor do serviço, `#RRGGBB`) e `turno: 'A' | 'B' | 'C' | 'U'` (a letra). A Minha escala passa a devolvê-los também.
- `export type ProximosServicos = { servicos: MeuServico[] }` e `export const LIMITE_DE_PROXIMOS = 6` em `contratos`.
- `GET /api/eu/proximos-servicos` → `ProximosServicos`. Conta sem militar: 404 "Esta conta não é de um militar." (a mesma da Minha escala). Mesma regra de escalas visíveis da Minha escala; a mesma montagem da composição (extrair a parte comum da rota `/eu/escala/:mes` em vez de copiá-la).
- "Ainda não acabou": o fim do serviço é a data mais a hora do fim, e, quando o fim não é depois do início (turno que vira o dia, ou 24 h), a data seguinte. Comparar com o agora de Recife (usar o que `apps/api/src/datas.ts` já oferece; a rota aceita um relógio injetável nos testes, como as outras que dependem de "hoje").

- [ ] **Step 1: testes:** (a) até seis, em ordem de data e início, atravessando o mês (Review Focus 1); (b) o serviço das 19h às 7h de ontem aparece às 3h e some às 7h01 (Review Focus 2); (c) o de hoje que já acabou não aparece; (d) escala em rascunho não entra; em prévia entra, com `estado: 'previa'`; (e) `cor` e `turno` certos, e também na `GET /api/eu/escala/:mes`; (f) conta sem militar, 404 com a frase fixa; (g) militar sem serviço: `{ servicos: [] }`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.55: os próximos serviços na API`.

### Task 2: o texto dos cartões e os cartões

**Files:** Create `apps/web/src/lib/proximos-servicos.ts`, `apps/web/src/componentes/inicio/ProximosServicos.tsx`; Modify `apps/web/src/api/visualizacao.ts` (a consulta nova); Test `apps/web/src/__testes__/proximos-servicos.test.tsx`

**Interfaces (Produces):**
- `apps/web/src/lib/proximos-servicos.ts` (puro, sem React): `diaDaSemanaCurto(data: string): string` ("qui"); `diaDaSemanaLongo(data: string): string` ("quinta"); `diaDoMes(data: string): string` ("1º" ou "26"); `horarioCurto(inicio: string, fim: string): string` ("7h às 19h", "7h30 às 19h30", "16h às 24h", "19h às 7h"); `rotuloDoCartao(s: MeuServico): string` (o rótulo de leitura de tela das Global Constraints); `fundoDoCartao(cor: string): string` (a mistura de 16% de tinta, mais forte se a cor não chegar a 4,5:1 com o branco).
- `consultaProximosServicos` em `apps/web/src/api/visualizacao.ts` (chave `['proximos-servicos']`).
- `ProximosServicos({ servicos }: { servicos: MeuServico[] })`: o título "Seus próximos serviços" e a lista de cartões; vazia, "Nenhum serviço marcado para você.".

- [ ] **Step 1: testes:** as funções de texto com os casos das Global Constraints e do Review Focus 1 e 2; `fundoDoCartao` com as cores do Pronto, do JES e uma cor clara (Review Focus 3: contraste ≥ 4,5:1 com o branco); os cartões: até seis, o primeiro com o contorno, o rótulo de cada um, o nome comprido cortado (Review Focus 4: classe de reticências e largura fixa), a frase do vazio.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.55: os cartões dos próximos serviços`.

### Task 3: a tela inicial com a cena nova, a barra e o detalhe

**Files:** Create `apps/web/src/componentes/inicio/SeuProximoServico.tsx`; Modify `apps/web/src/lib/cena-inicial.ts` (400 e 250), `apps/web/src/routes/_app/index.tsx`, o estilo da cena (onde estiver a classe `cena-inicial`); Test `apps/web/src/__testes__/cena-inicial.test.tsx`, `apps/web/src/__testes__/inicio-proximos.test.tsx`

**Interfaces (Consumes):** `consultaProximosServicos`, `ProximosServicos` e as funções de texto (Task 2).

- [ ] **Step 1: testes:** `alturaDaCena` dá 400 no computador largo (3:1 até 400) e 250 no celular; a cena mostra os cartões embaixo da saudação, à esquerda, com a área dos avisos vazia à direita (sem conteúdo); a barra encolhida mostra "Próximo serviço: …" quando encolhida e nada disso sem serviço; o bloco "Seu próximo serviço" com os textos fixos (turno, guarnição e função; sem guarnição; turno `U`; escala em prévia), as placas e o elo para a Minha escala do mês; conta sem militar (404) e erro da API: nem cartões, nem barra, nem detalhe, e o resto da tela igual; a chegada pela animação: os cartões têm o mesmo `data-chegada` da saudação; a animação do login pousa no quadro novo (Review Focus 5: a conta do recorte usa `alturaDaCena`).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador, com a carga de exemplo e um militar com serviços no fim do mês e no começo do seguinte, em 1440 e 390 px: a cena de 400 e de 250, os cartões (a fila rolando de lado no celular), a barra encolhida ao rolar, o detalhe, a entrada pelo login. **Step 5:** commit `Fase 6.55: a cena, a barra e o seu próximo serviço` e enviar a branch à PLANEJAMENTO.
