# Acabamento das revisões e a ficha pela Grade (6.65) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** fechar os achados menores das revisões que ficaram abertos no pool e acrescentar o pedido do usuário de abrir a ficha do militar pela Grade geral.

**Architecture:** sete lotes independentes, um por área. Cada lote é uma tarefa com o seu teste. Nenhum muda regra de negócio. Os achados que ainda esperam decisão do usuário ficaram de fora (no fim deste plano).

**Tech Stack:** Hono, Postgres/PGlite, React, TanStack Query, Vitest.

**Spec:** o pool (`docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`), itens 17, 18, 25, 27, 30, 31 (h), 34, 35, 36, 51, 52 e K1, com as decisões pequenas desta sessão (marcadas "decidido pela PLANEJAMENTO" abaixo, a confirmar pelo usuário quando voltar).

## Global Constraints

- Branch `fase6-65-acabamento-das-revisoes`, a partir da `main` **com a 6.56 mesclada** (a Task 2 mexe na tela inicial). Sem migração.
- Cada item corrigido cita o número do pool no commit (ex.: "pool 34 (a)").
- Nenhum dado pessoal real em repositório, teste ou CI: as matrículas de teste ficam na faixa `990xxx-x`.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Planilha de erros reenviada duas vezes com problema:** o arquivo devolvido tem um par só de "MOTIVO" e "COMO CORRIGIR", no fim (Task 1).
2. **Trocar de conta na mesma aba:** depois de sair e entrar com outra conta, a tela inicial e a Minha escala nunca mostram, nem por um instante, os serviços da conta anterior (Task 2).
3. **A ficha pela Grade num turno com choque:** abre a mesma ficha da escala (6.32), sem trocar a seleção nem a rolagem da Grade (Task 3).
4. **Lista de Escalas com 60 unidades:** o número de consultas ao banco não cresce com as escalas publicadas (Task 4).
5. **"Outro horário" com o fim vazio:** a mensagem é "Falta a hora do fim." no campo do fim (Task 5).

---

### Task 1: a importação e a planilha das linhas com problema (pool 34)

**Files:** Modify `apps/api/src/importacao/linhas-com-problema.ts`, `apps/api/src/importacao/caminho-da-unidade.ts`, as mensagens de linha repetida do Pecúlio e das Cotas; Test `apps/api/test/linhas-com-problema.test.ts`, `apps/api/test/caminho-da-unidade.test.ts`

- [ ] **Step 1: testes:**
  - (a) Um arquivo que já tem "MOTIVO" e "COMO CORRIGIR" no fim, reenviado com problema, volta com um par só (Review Focus 1). A importação ignora essas duas colunas, como hoje.
  - (b) Linha recusada que também tem célula ignorada: os motivos e as soluções alinhados, um por linha da célula, na mesma ordem. Sem solução, a linha da célula fica vazia.
  - (c) Linha repetida (Pecúlio "Matrícula repetida", Cotas "Cota repetida"): o "COMO CORRIGIR" diz para apagar a linha repetida e manter a certa.
  - (e) Duas irmãs que só se distinguem por "º" e "ª" ("1º SB" e "1ª SB"): o caminho de cada uma é único, e a leitura distingue as duas. Decidido pela PLANEJAMENTO: na comparação de siglas, "º" e "ª" deixam de ser apagados.
  - (d) Se a 6.62 não tiver trazido a correção do desempenho de `menorCaminhoUnico`, ela entra aqui: normalizar uma vez e agrupar pela última sigla. Teste com 1.000 unidades abaixo de 0,2 s.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.65: acabamento da importação (pool 34)`.

### Task 2: a tela inicial e a Minha escala (pool 36)

**Files:** Modify `pacotes/contratos/src/visualizacao.ts`, `apps/web/src/lib/proximos-servicos.ts`, `apps/web/src/componentes/inicio/ProximosServicos.tsx`, o lugar onde o site troca de conta (`useSair` e a entrada); Test os testes da 6.55

- [ ] **Step 1: testes:**
  - (a) O turno do contrato é só `'A' | 'B' | 'C'`: o `U` não existe no banco desde a 0011. O bloco "Seu próximo serviço" perde o ramo do `U`.
  - (c) Ao entrar com uma conta diferente da anterior, o cache de consultas é limpo, além do que `useSair` já faz (Review Focus 2). Decidido pela PLANEJAMENTO: limpar o cache inteiro na troca de conta, e não pôr a conta em cada chave.
  - (d) `fundoDoCartao` usa a conta de contraste de `apps/web/src/lib/cores.ts` e o token da tinta, sem cópia nem cor escrita à mão.
  - (e) A barra de rolagem da fila de cartões só some no celular.
  - (f) A seção e a lista não repetem o `aria-labelledby` (o título é lido uma vez).
  - (g) `horarioCurto('00:00', '00:00')` dá "0h às 24h".
  - (h) O título "Seus próximos serviços" tem contraste de pelo menos 4,5:1 sobre o canto da cena (teste com a cor do fundo da cena no ponto mais claro do degradê).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.65: acabamento da tela inicial (pool 36)`.

### Task 3: a Grade geral (pool 35, 17, 18 e K1)

**Files:** Modify a Grade (`apps/web/src/routes/_app/grade.tsx` e os componentes da coluna do militar e dos filtros de equipe); Test os testes da Grade

- [ ] **Step 1: testes:**
  - (35) Clicar na célula do militar (posto, nome de guerra e matrícula, na coluna fixa) abre a ficha do militar na escala, a mesma que a Escala do mês abre (6.32). O mesmo vale pelo teclado (Enter na célula). A Grade não perde a rolagem nem a seleção (Review Focus 3).
  - (17) O corte do celular dos filtros de equipe passa a 768 px, como o resto do site, e o nome fica centrado no segmento não marcado. Decidido pela PLANEJAMENTO: igualar ao resto do site.
  - (K1) No painel do dia da Grade, o expediente lançado ganha "Tirar do expediente", que tira sem pôr nada no lugar (a API já aceita desde a 6.40, decisão 2: o calculado volta a valer e o choque, se houver, continua). Pede confirmação como as outras remoções do painel. Decidido pela PLANEJAMENTO: o botão fica no painel do dia, onde o expediente já aparece.
  - (18) Os testes do grupo com cinco segmentos e da soma das colunas da faixa da equipe. "ADM" no painel do dia vem da mesma função das outras telas, e não escrito à mão. Os comentários desatualizados da 6.46 são corrigidos.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.65: a ficha pela Grade, tirar o expediente e o acabamento dos filtros (pool 35, 17, 18, K1)`.

### Task 4: as escalas e a Minha escala (pool 25 e 27)

**Files:** Modify `apps/api/src/escala/visualizacao-rotas.ts` (a lista de Escalas), o teste do GET da pré-escala, a lista de Escalas no site; Test os testes da 7.3.1 e da 7.5

- [ ] **Step 1: testes:**
  - (25 c) A lista de Escalas não consulta o nível de acesso por unidade para as escalas publicadas, que toda conta vê. O número de consultas não cresce com elas (Review Focus 4: contar as consultas no teste).
  - (25 e) O teste do GET da pré-escala compara por igualdade.
  - (27 c) O teste da escala aberta só para leitura ganha o caso com vaga vazia.
  - (27 d) Enquanto as unidades carregam, a lista de Escalas mostra o estado de carregamento, e não só a própria lotação.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.65: acabamento das escalas (pool 25, 27)`.

### Task 5: o Pecúlio, a ficha de consulta e o voluntariado (pool 30)

**Files:** Modify a ficha de consulta (`apps/web/src/routes/_app/consulta_.$id.tsx` ou o componente dela), `JustificarPassado.tsx` (o pedido de motivo), o "Outro horário" do voluntariado, o filtro de lotação do Pecúlio da unidade (`apps/web/src/routes/_app/peculio.tsx`); Test os testes de cada um

- [ ] **Step 1: testes:**
  - (30 c) Um segundo pedido de motivo enquanto o primeiro grava não deixa promessa pendurada: o segundo espera o primeiro ou é recusado com aviso.
  - (30 d) A ficha de consulta volta a mostrar "Abrir a ficha completa" para quem pode abri-la (`podeAbrirFichaCompleta`). Para quem não pode, o botão não aparece.
  - (30 e) "Outro horário" com o fim vazio diz "Falta a hora do fim." (Review Focus 5). Com o início vazio, "Falta a hora do início.".
  - (30 f) No Pecúlio, religar "e as de baixo" não traz de volta a lotação escolhida antes; o filtro volta a "Todas".
  - (30 g) A varredura de "Adm" olha também os contratos. O título de teste invertido é corrigido, a variável sem uso sai, e as matrículas de teste 9959xx passam à faixa 990xxx-x. O mesmo para as matrículas fora do padrão nos testes da 6.54 (pool 31 h).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Rodar as verificações do fim de entrega. Conferir no navegador, em 1440 e 390 px: a ficha pela Grade, a tela inicial depois de trocar de conta, a ficha de consulta e o "Outro horário".
- [ ] **Step 5:** commit `Fase 6.65: acabamento do Pecúlio, da consulta e do voluntariado (pool 30)`.

### Task 6: o quadro de avisos (pool 51)

**Files:** Modify `apps/api/src/avisos/avisos.ts`, `apps/api/src/avisos/rotas.ts`, `apps/web/src/componentes/inicio/QuadroDeAvisos.tsx`, `apps/web/src/componentes/inicio/JanelaDoAviso.tsx`; Test `apps/api/test/avisos.test.ts`, `apps/web/src/__testes__/quadro-de-avisos.test.tsx`

- [ ] **Step 1: testes:**
  - (a) Editar ou retirar aviso vencido: 404 "Aviso não encontrado.", como o retirado.
  - (b) A edição concorrente com a retirada não altera o retirado (`retirado_em is null` no update) e responde 404.
  - (c) Publicar em unidade extinta: 400 "Esta unidade não existe mais.". `podePublicar` só conta unidades em vigor.
  - (d) Editar sem mudar nada não grava na auditoria.
  - (e) O painel guarda o aviso exibido pelo id: quem publica passa a ver o próprio aviso; fixar na edição mantém o mesmo à vista; retirar mostra o vizinho, sem contagem errada.
  - (f) Os pontos não são paradas de Tab (as setas bastam). Os botões escuros têm foco visível. A troca de aviso é anunciada ao leitor de tela. Depois de retirar, o foco vai para o painel.
  - (g) O título do aviso na barra aparece a partir de 1024 px, como o painel.
  - (h) A janela não fecha ao cruzar 1024 px (uma instância só do painel).
  - (i) Os testes de largura medem o que dizem, e o erro da API num campo aparece na janela.
  - (k) As alturas de linha e a borda vêm dos tokens.
  - Fica como está: (j), porque o id é um UUID e o risco é baixo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Rodar as verificações do fim de entrega e conferir no navegador o painel em 1100 e 390 px. **Step 5:** commit `Fase 6.65: acabamento do quadro de avisos (pool 51)`.

### Task 7: o Pecúlio e a pesquisa (pool 52)

**Files:** Modify `apps/web/src/componentes/peculio/AtualizarEmLote.tsx`, `apps/web/src/componentes/peculio/Selecao.tsx`, `apps/api/src/visao/exportar.ts`, `apps/api/src/importacao/peculio.ts`, a busca simples (`apps/api/src/visao/`) e a placa da unidade; Test os testes da 6.62

- [ ] **Step 1: testes:**
  - (a) Se a releitura dos selecionados falha, o painel avisa em vez de mostrar a lotação antiga em silêncio.
  - (b) O teste do lote usa matrículas diferentes, e o fetch falso confere o corpo: vão as matrículas certas e a troca é pelo id.
  - (c) Uma busca lê as unidades uma vez só (contar as consultas).
  - (d) A exportação e a importação do Pecúlio usam `rotulosDasUnidades`, sem custo O(n²) (1.000 unidades abaixo de 0,2 s).
  - (f) A unidade extinta entra no cálculo do rótulo.
  - (g) A busca simples do militar comum devolve `lotacaoCaminho`, e a placa mostra o caminho em toda a tela.
  - (h) A placa com caminho longo não espreme o nome em 360 px (o caminho corta com reticências e o nome não encolhe).
  - (i)/(j) Comentário velho corrigido; o `afterAll` usa `esquecerUnidadeDaAba`; teste de tela da abertura padrão do gestor do GB na 1ª SB.
  - Fica como está: (e), enquanto a leitura de todas as unidades não pesar; (k), que espera o usuário.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Rodar as verificações do fim de entrega. **Step 5:** commit `Fase 6.65: acabamento do Pecúlio e da pesquisa (pool 52)`. Enviar a branch à PLANEJAMENTO.

## Fora deste plano (esperam decisão ou outra sessão)

- Pool 23 (d): o arquivo de matrículas em .xlsx.
- Pool 25 (f): a escala publicada de uma unidade extinta abre pela leitura direta. Fica como está, porque é histórico; falta o usuário dizer se quer escondê-la.
- Pool 30 (a): a medição do lote no banco remoto, que é com a VALIDAÇÃO.
- Pool 30 (b): os textos "Adm" do protótipo.
- Pool 34 (f): a planilha refeita depois de gravar. O resultado continua certo para as linhas que não entraram.
- Pool 36 (b): o ramo 404 inalcançável, que fica como defesa.
