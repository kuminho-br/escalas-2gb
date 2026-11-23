# Pendências antes da fase 7 (entregas 6.15 a 6.18): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar, antes da fase 7, tudo o que está registrado como pendência e já pode ser feito sem decisão nova do usuário, sem mockup e sem regra nova.

**Architecture:** quatro entregas independentes, uma branch e um PR cada. A 6.15 é funcionalidade nova, já decidida (abono e função). As outras três são lotes de acabamento, agrupados pelo lugar do código, como as entregas 4.5 a 4.7.

**Tech Stack:** Hono, Postgres, zod em `pacotes/contratos`, React com TanStack, Vitest.

**Spec:** a lista de origem é "Pendências conhecidas" do roadmap (`docs/superpowers/plans/2026-11-16-roadmap-migracao.md`) e os resumos dos PRs citados nela. Para a 6.15, `docs/superpowers/specs/2026-11-20-peculio-design.md` (linhas "Abono de permanência" e "Função").

**Pedido do usuário (23/11/2026):** levantar o que pode ser implementado antes da fase 7 e mandar implementar.

**Ordem:** depois da 6.12. Fila completa: P1.5, 6.14, 6.13, 6.10, 6.11, 6.12, 6.15, 6.16, 6.17, 6.18.

| Entrega | Tema | Branch | Migração |
|---|---|---|---|
| 6.15 | Abono de permanência e função do militar | `fase6-15-abono-e-funcao` | sim |
| 6.16 | Acabamento do acesso, das contas e do rastreio | `fase6-16-acabamento-do-acesso` | não |
| 6.17 | Acabamento das telas | `fase6-17-acabamento-das-telas` | não |
| 6.18 | Acabamento da API, da importação e do motor | `fase6-18-acabamento-da-api` | não |

**Fluxo:** o Sonnet executa e o Opus faz a revisão final. A DESENVOLVIMENTO abre o PR; a PLANEJAMENTO confere o CI e mescla; migração no banco de teste só com a autorização do usuário.

## Global Constraints

- **Cada item dos lotes (6.16 a 6.18) segue o mesmo ciclo:** escrever o teste que mostra o defeito; rodar e ver falhar; corrigir; rodar e ver passar. O item vem escrito como "situação → o que deve acontecer".
- **Item que já está resolvido:** se o teste passa sem mudar o código, o teste fica e o item entra no resumo do PR como "já resolvido".
- **Item que se mostrar maior que o previsto** (mexe em mais de três arquivos de produção ou muda um contrato usado por outra tela): não é feito; entra no resumo do PR com o motivo, e volta ao roadmap.
- **Nenhum item muda quem é escalado.**
- Textos sem jargão. Onde o item traz o texto entre aspas, é o texto exato.
- Nenhum dado pessoal real: matrículas `990xxx-x`.
- Um commit por tarefa. No fim de cada entrega: `pnpm test && pnpm typecheck && pnpm build:vercel`, as contagens no `CLAUDE.md` local, e o resumo do PR com a lista dos itens (feito, já resolvido ou devolvido).
- Ao mesclar cada entrega, a PLANEJAMENTO tira do roadmap os itens resolvidos.

## Review Focus

1. **Militar sem função cadastrada:** aparece em todas as telas como antes, sem erro e sem pendência que trave. Task 1.
2. **Função desativada no catálogo:** continua na ficha de quem já a tem, e some das listas de escolha. Task 1.
3. **Sessão que termina com uma alteração não salva:** a pessoa é levada a entrar, sem o aviso "Sair do site?" do navegador, e volta à tela em que estava. Task 5.
4. **Dois nomes iguais com maiúsculas diferentes criados ao mesmo tempo:** o segundo recebe 409, e não erro 500. Task 7.
5. **Planilha com milhares de linhas:** importa no tempo de hoje ou menos, com o mesmo resultado. Task 8.

---

# Entrega 6.15 — Abono de permanência e função do militar

### Task 1: abono e função, do banco à planilha

**Decisões do usuário (22/11/2026):** o abono de permanência é um campo de sim ou não; todo militar tem uma função, tirada de um catálogo das Configurações até o QOD ser modelado.

**Decisões desta entrega** (minhas):
- A função do militar não é a função da guarnição (tabela `funcao`, que continua como está). Na tela, o campo chama "Função"; o catálogo, "Funções do militar".
- A função pode ficar vazia até ser preenchida, como o e-mail.
- Os dois campos são do bloco do Pecúlio: edita quem tem nível de acesso numa unidade acima da lotação.
- Nas camadas de visão (6.11), a função entra no bloco "Situação"; o abono só aparece na ficha completa.

**Files:**
- Create: `apps/api/banco/migracoes/00NN_abono_e_funcao.sql`, `apps/api/src/cadastros/funcoes-do-militar.ts`, `apps/web/src/componentes/configuracoes/FuncoesDoMilitar.tsx`
- Modify: `pacotes/contratos/src/militares.ts`, `apps/api/src/cadastros/militares.ts` (`CAMPOS_DO_PECULIO`, a ficha e o `PATCH`), `apps/api/src/rotas/eu.ts`, `apps/api/src/importacao/peculio.ts` e `peculio-colunas.ts`, `apps/api/src/visao/consulta.ts`, `apps/web/src/routes/_app/configuracoes.tsx`, o bloco de identificação da ficha, `apps/web/src/routes/_app/minha-ficha.tsx`
- Test: `apps/api/test/migracao-00NN.test.ts`, `apps/api/test/funcoes-do-militar.test.ts`, `apps/api/test/militares.test.ts`, `apps/api/test/importacao-peculio.test.ts`, os testes da ficha, da Minha ficha e das Configurações no site

**Interfaces:**
- Produces, banco: `funcao_militar (id uuid, nome text not null, ativo boolean not null default true)`, com o nome único sem diferenciar maiúsculas; `militar.funcao_militar_id uuid` (opcional) e `militar.abono_permanencia boolean not null default false`.
- Produces, em `contratos`: `type FuncaoDoMilitar = { id: string; nome: string; ativo: boolean }`; `NovaFuncaoDoMilitar = z.object({ nome: z.string().trim().min(1).max(80) })`; a ficha e a Minha ficha ganham `funcao: string | null` e `abonoPermanencia: boolean`; o `PATCH` da ficha aceita `funcaoMilitarId: string | null` e `abonoPermanencia: boolean`.
- Produces, rotas: `GET /api/funcoes-do-militar` (qualquer nível de acesso), `POST /api/funcoes-do-militar` e `PATCH /api/funcoes-do-militar/:id` (`{ nome?, ativo? }`), só o administrador.

- [ ] **Step 1: testes.**
  - A migração cria a tabela e as duas colunas; todo militar nasce sem função e sem abono.
  - O catálogo: cria, renomeia, desativa; nome repetido é 409; só o administrador altera.
  - A ficha grava a função e o abono; quem tem nível só na seção recebe 403 com a frase de quem altera.
  - **Review Focus 2:** a função desativada continua na ficha de quem a tem e não vem na lista de escolha.
  - **Review Focus 1:** a Grade, a Escala do mês, o Pecúlio e a consulta abrem com militares sem função.
  - A importação do Pecúlio ganha as colunas FUNÇÃO (o nome de uma função ativa) e ABONO DE PERMANÊNCIA (SIM ou NÃO), opcionais, com a regra da 6.13: vazio não altera, inválido é ignorado com o motivo.
  - A ficha de consulta traz a função dentro do bloco `situacao`, e nunca traz o abono.
  - No site: a aba "Funções do militar" nas Configurações (administrador); o campo "Função" e a marca "Abono de permanência" na ficha; os dois só para leitura na Minha ficha.
  - **Posto sem "BM"** (diretriz do usuário, 23/11/2026): uma segunda migração da entrega, `00NN_postos_sem_bm.sql`, tira o " BM" do fim da sigla de todo posto (`SD BM` → `SD`), sem tocar em sigla que o usuário já mudou para outra forma, e pode rodar de novo. A carga base, a carga de exemplo, o `criar-admin`, o modelo da planilha do Pecúlio e os testes passam a usar as siglas sem "BM". Teste: depois da migração nenhuma sigla termina em " BM"; a planilha com `SD` importa; com `SD BM` a célula é ignorada com o motivo de posto desconhecido (a importação é contrato, sem tolerância ao formato antigo).
- [ ] **Step 2:** rodar `pnpm test`. Esperado: FAIL nos testes novos.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar as verificações do fim de entrega. Esperado: PASS. Atualizar o esquema do banco e a spec do Pecúlio (as duas linhas deixam de dizer "sem entrega").
- [ ] **Step 5:** `git commit -m "Fase 6.15: abono de permanência e função do militar"` e abrir o PR.

---

# Entrega 6.16 — Acabamento do acesso, das contas e do rastreio

### Task 2: contas e níveis de acesso

**Files:** `apps/api/src/usuarios/rotas.ts`, `apps/api/src/rotas/eu.ts`, `apps/api/src/acesso.ts`, o bloco "Acesso ao sistema" da ficha, `apps/web/src/routes/criar-senha.tsx`, `apps/web/src/routes/sem-lotacao.tsx`; Test: `usuarios.test.ts`, `eu.test.ts`, `senha-provisoria.test.ts` e os testes de tela correspondentes

- [ ] **Itens**, cada um com o ciclo das Global Constraints:
  1. "Encerrar" num nível de acesso fora do alcance de quem vê a ficha → o botão não aparece (a API diz, por nível, se quem olha pode encerrar).
  2. "Desativar acesso" sem poder → o botão não aparece.
  3. Dar nível de acesso numa unidade extinta → 400 "Esta unidade foi extinta.", e ela não vem na lista de escolha.
  4. A tela "Crie a sua senha" → tem "Sair".
  5. Com a senha provisória pendente, `PATCH /api/eu/telefone` → 403 com "Crie a sua senha para continuar.", e não 401.
  6. O auxiliar desativa de novo um colega auxiliar já desativado → 200 sem mudar nada, e não 403.
  7. Nível de acesso só em unidade extinta → a tela `/sem-lotacao` diz "Seu nível de acesso é de uma unidade que não existe mais. Procure o gestor do seu grupamento.".
  8. Nível de acesso dado ou encerrado na ficha → o seletor de unidade se atualiza sem recarregar a página.
  9. A sessão conferida duas vezes nas rotas de acesso → uma vez só (conferir com um espião no teste).
  10. `/api/auth/change-password` com a senha provisória pendente → recusado; a troca é só pela rota de criar a senha.
  11. Nível de acesso com "até" no futuro → "Encerrar" funciona antes da data: o "até" passa a ser hoje (decisão de 23/11).
  12. O último gestor vigente de uma unidade com "até" marcado → a ficha e a lista de níveis mostram "Último gestor de {unidade}: o nível termina em dd/mm/aaaa.". É aviso, não bloqueia (decisão de 23/11).
  13. O administrador encerrar ou pôr "até" no próprio último nível de administrador → 409 "Você é o único administrador. Dê o nível a outra pessoa antes." (decisão de 23/11).
- [ ] **Commit** `Fase 6.16: acabamento das contas e dos níveis de acesso`.

### Task 3: unidade de trabalho e navegação

**Files:** `apps/web/src/lib/unidade-de-trabalho.ts`, `apps/web/src/componentes/Topo.tsx`, `apps/web/src/routes/_app.tsx`, `apps/web/src/routes/_app/index.tsx`, `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/routes/_app/militares*.tsx`, `apps/web/src/lib/modulos.ts`; Test: `unidade-de-trabalho.test.tsx`, `casca.test.tsx`, `inicio.test.tsx`, os testes de militares e da Escala do mês

- [ ] **Itens:**
  1. Trocar de unidade no seletor → o `?mes=` da tela continua; a ficha aberta fecha, como hoje.
  2. O seletor → cada opção diz o nível ao leitor de tela ("1ª SB, dentro de 2º GB").
  3. O vazio da Escala do mês com um grupamento escolhido → "Escolha uma seção no seletor de unidade para ver a escala.".
  4. O aviso "Essa área é de outro nível de acesso." → some do endereço depois de mostrado, e não reaparece ao recarregar.
  5. A ficha aberta pelo Pecúlio → clicar em outro militar da lista mantém o `?de=peculio`, e o trilho continua o do Pecúlio.
  6. O item "Oficiais" do trilho → olha o nível de acesso na unidade escolhida, não em qualquer unidade.
- [ ] **Commit** `Fase 6.16: acabamento da unidade de trabalho e da navegação`.

### Task 4: rastreio, quadro e situação

**Files:** `apps/api/src/cadastros/militares.ts`, `apps/api/src/cadastros/periodo-aberto.ts`, `apps/api/src/oficiais/*.ts`, `apps/api/src/grade/*.ts`, `apps/web/src/componentes/militares/Rastreio.tsx`, `apps/web/src/componentes/LinhaDoTempo.tsx`; Test: `cadastro-no-tempo.test.ts`, `rastreio-por-dia.test.ts`, `oficiais.test.ts`, `grade.test.ts`, `militares.test.ts` e o teste do Rastreio no site

- [ ] **Itens:**
  1. "Alterar situação" de militar com todos os períodos fechados → o período novo nasce com o quadro do posto, quando o posto só existe em um, e com a situação padrão.
  2. Oficiais (extras e saldo) → o quadro é o do período do mês consultado, não o do período mais recente.
  3. "Alterar situação" → o formulário sugere o quadro e a situação do período aberto, os mesmos que a API herda.
  4. Antiguidade repetida com um colega que tem dois períodos no mês → o colega aparece uma vez só.
  5. `PATCH` da ficha com o nascimento sem o ano → o ano gravado continua.
  6. Chave desconhecida no `PATCH` da ficha → mensagem em português: "Campo desconhecido: {nome}.".
  7. Teste próprio: nenhum militar das telas de escala some depois da migração 0029 (comparar a lista da Grade antes e depois, no banco de teste em memória).
  8. Militar com período só no futuro → as telas dizem "Lotação a partir de dd/mm/aaaa", e não "Sem lotação".
  9. A linha do tempo da ficha → mostra o intervalo entre dois períodos ("Sem lotação de dd/mm a dd/mm").
  10. "Use o mês do período aberto ou um mês depois." → a mensagem diz a data: "Use uma data a partir de dd/mm/aaaa.".
  11. "está lotado na X" na importação → para lotação só marcada para o futuro, diz "tem lotação marcada na X a partir de dd/mm/aaaa".
  12. "Alterar situação" enquanto a lista de seções carrega → o botão de salvar fica desligado até a lista chegar.
- [ ] **Commit** `Fase 6.16: acabamento do rastreio, do quadro e da situação` e, depois das verificações, abrir o PR.

---

# Entrega 6.17 — Acabamento das telas

### Task 5: sessão, carregamento e falhas

**Files:** `apps/web/src/api/cliente.ts`, `apps/web/src/componentes/TelasDeFalha.tsx`, `apps/web/src/useSair.ts` (ou onde estiver), `apps/web/src/componentes/ImportarPlanilha.tsx`, `apps/web/src/routes/entrar.tsx`, `apps/web/src/lib/transicao-login/*`; Test: os testes de `cliente`, de falhas, de sessão, da importação e da animação do login

- [ ] **Itens:**
  1. Sessão expirada numa aba antiga → a pessoa é levada à tela de entrar com "Sua sessão terminou. Entre de novo.", e volta à tela em que estava.
  2. **Review Focus 3:** um 401 com alteração não salva → sem o aviso "Sair do site?" do navegador.
  3. Importar planilha com a sessão terminada → leva a entrar.
  4. Um pedido atendido logo depois do "Sair" → não mostra o aviso de sessão terminada.
  5. "Sua sessão terminou" → é lido pelo leitor de tela (`role="alert"` presente quando a tela monta).
  6. "Sair" sem resposta do servidor → "Não foi possível sair. Confira a conexão e tente de novo.".
  7. Erro 4xx numa consulta → a mensagem aparece na hora, sem as tentativas que seguram "Carregando…" por 7 s.
  8. 408 e 429 → tentam de novo, como os 5xx.
  9. A tela de falha das rotas → só fala em conexão quando o erro é de rede; nos outros, mostra a mensagem do servidor; o foco vai para o título.
  10. "Não deu para carregar a lista" → só aparece quando não há lista na tela; com lista já carregada, um aviso pequeno "Não deu para atualizar.".
  11. A marca das 12 h da animação com data no futuro → é tratada como se não existisse.
  12. A animação do login → mede a tela pelo `visualViewport` quando ele existe, e o canvas não passa de 2560 px de largura interna.
  13. Testes que faltam na animação: `localStorage` bloqueado; navegador sem `canvas` com a imagem carregada; a camada sumindo em `/criar-senha`.
- [ ] **Commit** `Fase 6.17: sessão, carregamento e telas de falha`.

### Task 6: formulários, diálogos e nomes acessíveis

**Files:** os componentes de `apps/web/src/componentes/` (`ui/dialog`, `ListaDetalhe`, `ImportarPlanilha`, `grade/*`, `escala-do-mes/*`, `oficiais/*`, `militares/*`, `voluntariado/*`) e as rotas de cotas, feriados, escalas e guarnições; Test: o teste de cada tela tocada

- [ ] **Itens:**
  1. Fechar o diálogo de criação com algo digitado → pergunta "Descartar o que foi digitado?".
  2. Clique duplo em "Copiar" (cotas e feriados) → um pedido só, e a mensagem do primeiro.
  3. O menu do celular → fecha com Esc e leva o foco ao primeiro item ao abrir.
  4. "Incluir serviço…" → só age ao confirmar, não na mudança da lista.
  5. O X dos diálogos → "Fechar"; os campos de mínimo e máximo e o número da ordem → com nome que diz de quê.
  6. "1 escalas" → "1 escala"; **"Faltam 1" → "Falta 1"** (o plural continua "Faltam 2").
  7. Criar ou renomear função da guarnição → entra nas alterações pendentes e trava enquanto grava; "Remover" não deixa pendência fantasma; "Cancelar" da função nova trava.
  8. Botão apagado porque a consulta de postos ou de tipos falhou → um texto ao lado: "Não deu para carregar a lista. Recarregue a página.".
  9. Importação reaberta → começa limpa, sem o resultado anterior.
  10. Fechar a importação durante a confirmação → o fechar espera a resposta; não há segunda confirmação.
  11. O erro genérico da confirmação da importação → só manda "enviar de novo" quando o erro é de rede.
  12. "Mês já passou" na importação → diz a linha e o nome da escala ou da configuração, sem a chave técnica.
  13. Categoria de CNH acesa só pela hierarquia → clicar não a põe na carteira; a dica diz "Vale pela categoria {letra}.".
  14. "Sem a CNH exigida" para quem tem a CNH e está fora do quadro → "Fora do quadro de motoristas"; o painel do dia não mostra a etiqueta "CNH D" de quem está fora do quadro.
  15. A recusa da troca → além de quem não pode, diz o que fazer.
  16. Os botões "Escalar" → nome acessível com o militar ("Escalar CB ALMEIDA").
  17. A busca por matrícula → acha com ou sem o hífen.
  18. A aba ativa do "Adicionar serviço" depois de um 409 → volta a ficar ligada.
  19. "Desfazer" com a alocação promovida já removida → "A escala mudou desde então. Não dá mais para desfazer.".
  20. O texto do Voluntariado num mês com muitas horas → quebra a linha em vez de cortar.
  21. Escala dos oficiais: depois de um 409, a tela recarrega os dados; o diálogo de troca e as células dizem ao leitor de tela o dia, o turno e o oficial.
  22. Aniversariantes do Pecúlio → só quem está numa situação que pode ser escalada; o botão de importar o Pecúlio → só para quem pode importar.
  23. A lista do Pecúlio com mais de 100 militares → mostra de 100 em 100, com "Mostrar mais".
  24. `useSincronizar` → o campo não fica defasado quando a pessoa desfaz a edição depois de chegar dado novo; mais os testes de recarregamento sem pendência em Motorista, Identificação da escala, Identificação da guarnição e Serviços da escala.
  25. Escala dos oficiais: a marca "novo" → só em quem participa neste mês e não participou no mês anterior da unidade; sem mês anterior gravado, ninguém é "novo" (decisão de 23/11).
  26. Escala dos oficiais: desmarcar "Participa" de quem já tem turnos escolhidos → o diálogo do sistema pergunta "Tirar {posto e nome} da rodada? Os {n} turnos escolhidos ficam sem ninguém.", com o botão "Tirar da rodada". Sem turnos escolhidos, não pergunta (decisão de 23/11).
  27. Grade geral → sem a marca do dia de hoje (diretriz do usuário, 23/11); no mês corrente a tabela continua abrindo no dia de hoje.
  28. (passou para a entrega 6.22)
  29. Da 6.12: o vazio da Escala do mês no modo só consulta não mostra o link "Crie uma em Escalas".
  30. Da 6.12: no modo só consulta, os trechos ocupados do Efetivo por dia não param o teclado.
  31. No celular, abrir a escolha de militar para uma vaga → o foco não vai para a busca, e o teclado só aparece quando a pessoa toca na caixa de busca (diretriz do usuário, 23/11).
  32. As linhas das listas do Pecúlio e de Militares ganham destaque (pedido do usuário, 23/11; desenho decidido pela PLANEJAMENTO com a DESIGN, aprovado de antemão). Linha 1: patente (13 px, `apagado`) e nome de guerra (17 px, estreita, 600), como hoje. Linha 2: o nome completo em 15 px `tinta` (hoje é apoio apagado). Linha 3: os dados em etiquetas de 24 px de altura, raio 6, 13 px peso 500, cada uma com o seu ícone de 14 px (lucide, traço 1,75): matrícula, telefone e e-mail no Pecúlio; matrícula, jornada e equipe ("Pronto · BRAVO", "Adm") e "Motorista B" em Militares. Etiqueta neutra: fundo `passa`, borda 1 px `linha`, texto `tinta`. Dado que falta: etiqueta âmbar (`pendencia` sobre `pendencia-fundo`), "Sem telefone", "Sem e-mail", junto do aviso de cadastro incompleto que já existe. Sem uma cor por tipo de dado: a cor tem um sentido só (diretriz aprovada). O e-mail longo corta com reticências e a dica mostra inteiro. Teste: as três linhas, a etiqueta âmbar quando falta o dado, e nenhuma rolagem de lado em 390 px.
  33. Escala dos oficiais: as etapas do mês (`MensagensDoMes.tsx`) viram uma linha de processo (pedido do usuário, 23/11; desenho da PLANEJAMENTO, a DESIGN registra no Manual). Quatro passos em `<ol>`, com `aria-current="step"` no atual: "Participantes e cotas" (feito quando as cotas estão calculadas), "Escolhas", "Escala fechada" e "Mês encerrado". Cada passo: círculo de 24 px (feito: visto em `tinta`; atual: fundo `vinho` com o número em branco; por vir: borda `encaixe` e número `apagado`), o nome em 15 px (o atual em peso 600 `tinta`, os outros `apagado`) e, embaixo, uma frase de 13 px do que acontece nele ("Os oficiais escolhem os turnos na ordem", "Trocar é cobrir: fica o registro de quem saiu", "O saldo entra no acumulado"). Entre os passos, uma linha de 2 px com a ponta de seta (`linha` entre os por vir, `tinta` entre os feitos). A ação que leva ao próximo passo ("Calcular cotas", "Fechar a escala", "Encerrar o mês") fica sobre a seta que sai do passo atual, como o botão principal da tela; os botões soltos dessas três ações no alto da tela saem, e "Regras" fica. O movimento: ao avançar, a seta se preenche em 220 ms (parado com `prefers-reduced-motion`). No celular os passos ficam em coluna, com a seta para baixo. A confirmação de fechar e de encerrar continua como hoje. Teste: o passo atual em cada etapa, `aria-current`, a ação certa sobre a seta, e as três ações não aparecem duas vezes.
- [ ] **Commit** `Fase 6.17: formulários, diálogos e nomes acessíveis` e, depois das verificações, abrir o PR.

---

# Entrega 6.18 — Acabamento da API, da importação e do motor

### Task 7: API

**Files:** `apps/api/src/cadastros/*.ts`, `apps/api/src/erros.ts`, `apps/api/src/migracoes-pendentes.ts`, `apps/api/src/escala/rotas.ts`; Test: os testes de cada cadastro, `erros.test.ts`, `migracoes-pendentes.test.ts`, `escala-*.test.ts`

- [ ] **Itens:**
  1. **Review Focus 4:** nomes de serviço, escala, guarnição, função e equipe → únicos sem diferenciar maiúsculas, com a conferência no mesmo comando da gravação; o segundo recebe 409.
  2. Mudar a letra de um turno que tem militares escalados → 409 "Este turno tem militares escalados. Crie outro turno.".
  3. O 403 → vem antes do 400 do contrato (quem não pode não fica sabendo do formato).
  4. E-mail com tab ou quebra de linha → 400 no campo, e não 500.
  5. O aviso de migração pendente (503) → para quem não está logado, só "O sistema está sendo atualizado. Tente de novo em alguns minutos."; os nomes dos arquivos e o comando só aparecem para o administrador.
  6. O título padrão da escala → cortado em 120 caracteres.
  7. Siglas de unidade repetidas em grupamentos diferentes → a importação pela raiz usa a seção que está abaixo da unidade da importação; com duas possíveis, a linha vira problema com as duas no texto.
  8. "hoje" → um jeito só: `hojeRecife` na API; no site, uma função única com o fuso de Recife, usada também em feriados.
  9. O teste das edições simultâneas do militar → passa a provar a trava (duas transações de verdade no banco de teste).
  10. Da 6.10: a função de auditoria usa `codigo` quando a tabela não tem `id` (gravar em `tipo_unidade` não quebra mais, sem desligar o gatilho).
  11. Da 6.10: `PATCH /api/divisoes/:id` numa divisão encerrada → 409 "Esta divisão foi encerrada.".
  12. Da 6.10: a importação do Pecúlio não aceita divisão como lotação ("A lotação é uma seção ou o grupamento.") e resolve a sigla dentro do grupamento da importação.
  13. Da 6.10: seção dentro de divisão extinta → aparece na aba Estrutura direto no grupamento.
  14. Da 6.10: teste de encerrar o próprio nível também no caso recusado.
  15. A busca de militares (`/api/consulta/militares`) → 429 com "Muitas buscas em pouco tempo. Espere um minuto e tente de novo." acima de 30 pedidos por minuto por conta; a tela mostra a mesma frase. A exportação completa do banco não passa por essa rota (decisão de 23/11).
  16. Da 6.16: as listas de Militares e do Pecúlio dizem "Lotação a partir de dd/mm/aaaa" para quem só tem período no futuro (a data do próximo período vem na linha da lista).
  17. Da 6.16: nascimento 29/02 sem ano no `PATCH` da ficha → 400 "Informe o ano: 29/02 só existe em ano bissexto.", sem apagar o ano gravado.
  18. Da 6.16: o aviso do último gestor não aparece quando há gestor vigente numa unidade acima; conta o gestor com início futuro.
  19. Da 6.16: a linha do tempo da ficha mostra o ano quando o intervalo atravessa a virada do ano.
  20. Da 6.16: Salvar do "Alterar situação" não fica preso quando a lista de seções falha (mostra o erro com "Tentar de novo"); `/oficiais` olha o nível de acesso na unidade escolhida; o 403 do telefone vem antes do 400.
- [ ] **Commit** `Fase 6.18: acabamento da API`.

### Task 8: importação

**Files:** `apps/api/src/importacao/*.ts`; Test: os `importacao-*.test.ts`

- [ ] **Itens:**
  1. Importação de guarnições → confere o tamanho dos textos de viatura, tipo e nomes, com a mensagem por linha.
  2. CONFIGURAÇÕES e GUARNIÇÕES POR ESCALA com mês passado → a mesma recusa da tela.
  3. CNH com categoria repetida (`AAD`) → vale como `AD`, com aviso.
  4. O nome da aba → aceito sem diferenciar maiúsculas, acentos e espaços nas pontas.
  5. Número cru do Excel (data serial, matrícula com zero à esquerda) → a mensagem cita o valor como a pessoa vê na planilha.
  6. Horário digitado errado em TURNOS (`25:00`, `8h`) → problema na linha, e não um horário válido.
  7. **Review Focus 5:** as consultas por linha → trocadas por consultas em lote antes do laço; o teste conta as consultas com 2.000 linhas e exige menos de 20.
  8. Linha recusada → não cria equipe nova na prévia.
  9. Antiguidade repetida → a prévia avisa, sem recusar.
  10. NASCIMENTO que chega como data da planilha (Excel ou Google Planilhas) → aceito quando o ano não é o ano corrente; com o ano corrente continua ignorado, com o motivo de hoje (decisão de 23/11).
- [ ] **Commit** `Fase 6.18: acabamento da importação`.

### Task 9: motor e contratos

**Files:** `pacotes/dominio/src/*.ts`, `pacotes/contratos/src/*.ts`, `apps/web/src/lib/*.ts`; Test: `pacotes/dominio/test/*`, os testes de contratos

- [ ] **Itens:**
  1. Ordem de antiguidade com um lado sem `ordem` → estável: quem não tem fica depois, e entre dois sem, vale a matrícula.
  2. O tipo `Militar` do motor → recusa o campo `antiguidade` no lugar de `antig` (erro de tipo, conferido com `@ts-expect-error`).
  3. Código repetido entre domínio e contratos → uma fonte só para `mesVizinho`/`somarMeses`, `TurnoPadrao` e as categorias de CNH; `proximoMes`, sem uso, sai. O site usa as mesmas (categorias de CNH, jornadas e a expressão do mês).
  4. `postosDoModelo` → devolve uma cópia.
  5. Os testes que passariam com o código quebrado (`distribuicao-adm.test.ts`, `casos.test.ts`, `pre-escala.test.ts` e o refine de serviço repetido) → ganham a asserção que falha quando a regra é desligada; para cada um, o resumo do PR diz qual mutação foi tentada.
  6. O teste de configuração com '1/2031' → usa uma data relativa a hoje.
  7. Nenhum caso de `casos/` muda: `pnpm --filter dominio test` passa sem regravar.
- [ ] **Commit** `Fase 6.18: acabamento do motor e dos contratos` e, depois das verificações, abrir o PR.

---

## O que ficou de fora, e por quê

| Pendência | Motivo |
|---|---|
| "A faixa do serviço fica mais grossa" | pergunta aberta: qual elemento |
| Os sete ajustes de interface da entrega 6.6 e a refatoração da interface | esperam a DESIGN |
| Conferências visuais (rolagem e larguras da Grade, selo "ativada", cor crua na legenda) | dependem do olho do usuário ou do desenho novo da DESIGN |
| Regras próprias por vaga (graduado de dia, chefe da guarnição) | regra nova: passa pelo protótipo (fase 10) |
| Pendências técnicas das distribuições, `ADM_CUMPRE_CARGA`, prioridade da cota, painel do dia | são da fase 8 |
| Dia passado travado (RN-85) | decisão da fase 7 |
| Corridas teóricas (último gestor, criação simultânea do usuário) e a migração 0012 | sem caso real; custo maior que o ganho agora |
| Célula vazia e demais itens da importação de militares | resolvidos pela 6.13 |
