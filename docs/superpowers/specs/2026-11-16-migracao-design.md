# Design — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026 (fase 0 do roadmap)

Roadmap: `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`

## Decisões técnicas

| # | Decisão | Escolha | Data |
|---|---|---|---|
| D1 | Linguagem e framework da API | TypeScript + Hono | 16/11/2026 |
| D2 | Banco e hospedagem do teste | Supabase (só Postgres) + Vercel, região São Paulo | 16/11/2026 |
| D3 | Login | Better Auth no nosso Postgres, por convite | 16/11/2026 |
| D4 | Biblioteca de interface e grade | React + Vite, Tailwind + shadcn/ui, TanStack Query, Router e Table | 16/11/2026 |
| D5 | Impressão por modelos | Modelo .xlsx preenchido pela API (ExcelJS); PDF por LibreOffice (Gotenberg) | 16/11/2026 |
| D6 | Organização do repositório | Um repositório, protótipo em `prototipo/`, pnpm workspaces | 16/11/2026 |
| D7 | Dados pessoais no teste | Dados reais no teste; fictícios no desenvolvimento e no GitHub | 16/11/2026 |

### D1 — TypeScript + Hono

- **Escolha:** API em TypeScript com Hono. As regras de domínio viram um módulo puro, sem dependência de banco nem de tela, portado dos arquivos `.js` atuais. A interface web é um projeto separado (ver D4).
- **Por quê:** aproveita as ~2,5 mil linhas de regras e os 389 testes já em JavaScript; mantém a API como peça independente, consumível por outras ferramentas; o Hono roda igual no Vercel e num servidor Node comum, o que facilita a ida para o servidor do Estado.
- **Alternativas descartadas:** Next.js com tudo num app (prende a API ao app e carrega o framework inteiro no servidor); Python + FastAPI (reescrita completa das regras e duas linguagens).
- **Ressalva:** se a TI do Estado exigir uma linguagem para sistemas internos, rever esta decisão antes da fase 7.

### D2 — Supabase + Vercel, em São Paulo

- **Escolha:** banco Postgres no Supabase (região São Paulo), usado só como Postgres: sem Supabase Auth, sem funções do Supabase, sem o navegador falar direto com o banco. API e site no Vercel, região São Paulo.
- **Por quê:** custo zero, dados no Brasil, e a saída para o servidor do Estado é uma cópia do banco.
- **Cuidados:** o plano grátis pausa o projeto após 7 dias sem uso; uma tarefa agendada consulta o banco a cada poucos dias para mantê-lo ativo. O plano grátis não restaura por data; uma cópia automática semanal (`pg_dump`) fica guardada fora do Supabase.
- **Alternativas descartadas:** Neon + Vercel (boa, mas sem ganho que justifique trocar a preferência inicial); servidor virtual próprio (custo mensal e manutenção do servidor).

### D3 — Better Auth, por convite

- **Escolha:** login próprio com a biblioteca Better Auth, integrada à API Hono, com usuários, sessões e senhas (com hash próprio para senha) em tabelas do nosso Postgres. Entrada por e-mail e senha.
- **Sem cadastro aberto:** o administrador convida cada usuário por e-mail e define o perfil (escalante, chefe, administrador) e a unidade. O primeiro administrador é o desenvolvedor.
- **Por quê:** os usuários vão junto com o banco para o servidor do Estado; "Entrar com Google" e um login institucional futuro (gov.br, rede do Estado) entram como opções extras, sem refazer usuários; mantém a D2 (Supabase só como Postgres).
- **Alternativas descartadas:** Supabase Auth (prende os usuários ao Supabase); só "Entrar com Google" (depende de contas pessoais e não serve no Estado).

### D4 — React + Tailwind + shadcn/ui + TanStack

- **Escolha:** site em React com Vite, em TypeScript. Visual com Tailwind e componentes shadcn/ui (copiados para o projeto, sobre Radix), seguindo os tokens dos esboços: vinho `#8E1B1B`, fundo `#EDEFF2`, tinta `#1C2430`, fontes Barlow e Barlow Semi Condensed, cores por serviço.
- **TanStack Query:** busca e atualização de dados da API, cache, espera e erro; ao salvar, invalida o que depende do dado (ex.: alocações do mês atualizam Grade geral, Escala do mês e Efetivo do dia).
- **TanStack Router:** endereço próprio para cada visão (mês, escala, dia, militar aberto), validação do endereço, carga de dados antes de abrir a tela, bloqueio de telas por perfil.
- **TanStack Table:** filtro, ordenação, busca e paginação nas tabelas de cadastro e no Histórico.
- **Sem grade de planilha:** Grade geral e Escala do mês são de leitura; a edição é pela ficha lateral e pela lista "Escolher militar". Por isso não há AG Grid nem similar.
- **Alternativas descartadas:** MUI (puxa para o visual padrão Google e é pesado); componentes feitos à mão (acessibilidade por conta própria).

### D5 — Modelo em Excel, saída em planilha e PDF

- **Documentos:** escala publicada, efetivo do dia, escala executada. Saem nos dois formatos: .xlsx e PDF.
- **Modelo:** arquivo .xlsx com marcadores (`{{data}}`, `{{guarnicao}}`, `{{militar}}` etc.) e uma linha que se repete. Quem edita é o escalante ou o chefe, sem programar. Como a seção usa Google Planilhas, o modelo pode ser desenhado lá e baixado como .xlsx.
- **Geração:** a API copia o modelo e preenche com ExcelJS, preservando cabeçalho, brasão, cores e células mescladas. O PDF sai da planilha preenchida, convertida pelo LibreOffice num serviço separado (Gotenberg): no teste, Google Cloud Run (camada gratuita, região São Paulo); no Estado, um container ao lado da API.
- **Tela:** Configurações › Modelos de impressão, com "Enviar modelo" e "Baixar modelo atual" e versões; trocar o modelo vale a partir do envio. No envio, o sistema confere os marcadores e recusa o arquivo se faltar algum.
- **Garantia da fase 4:** se o serviço de PDF não estiver pronto, a primeira versão entrega o .xlsx e o PDF sai pelo "Salvar como PDF" de quem abrir.
- **Por quê:** um único modelo para os dois formatos, editável por quem usa, sem prender o sistema a um fornecedor.
- **Alternativa descartada (D5):** modelo e geração no Google Planilhas. Arquivos ficariam em contas pessoais, a solução não iria para o servidor do Estado, e a planilha gerada convidaria a editar a escala fora do sistema, separando o documento do que o sistema registra.

### D6 — Um repositório, protótipo em pasta própria

- **Estrutura:**
  - `prototipo/`: arquivos `.gs`/`.js` e `.html` atuais do Apps Script; o `.clasp.json` continua na raiz, com `rootDir` apontando para `prototipo/`, e o comando de `clasp push` não muda.
  - `pacotes/dominio/`: regras de negócio em TypeScript, sem banco nem tela.
  - `apps/api/`: API Hono.
  - `apps/web/`: site React.
  - `casos/`: casos de teste compartilhados (entrada e resultado esperado), rodando contra o protótipo e contra `pacotes/dominio`; nasce a partir da pasta `testes/` atual.
- **Ferramentas:** pnpm workspaces; Vitest no código novo; testes automáticos a cada envio ao GitHub.
- **Cuidados (tarefas da fase 1):** a movimentação é feita numa branch e só entra na `main` depois de um `clasp push` validado pelo usuário na sandbox; CLAUDE.md e as sessões do claude.ai são avisados dos caminhos novos.
- **Por quê:** os casos compartilhados, centro do fluxo de regras, ficam no mesmo lugar dos dois sistemas; o histórico do Git acompanha os arquivos movidos.
- **Alternativas descartadas:** protótipo na raiz com código novo ao lado (risco contínuo de mandar código novo ao Apps Script); dois repositórios (casos de teste copiados entre eles acabam divergindo).

### D7 — Dados reais no teste, fictícios no desenvolvimento

- **Escolha:** o ambiente de teste usado pelos escalantes recebe os dados reais da 1ª SB, para testar em paralelo com o processo atual. Os dados hoje já estão em plataformas de terceiros (contas pessoais do Google), então o teste não piora a situação atual.
- **Campos:** só o que o sistema usa (matrícula, posto, nome de guerra, unidade, equipe, jornada, quadro de motoristas e CNH, voluntário JES, afastamentos). TELEFONE não é carregado.
- **Afastamentos:** guardados só com período e tipo genérico (Férias, Licença, Outro), sem motivo de saúde (dado sensível pela LGPD).
- **Salvaguardas mantidas:**
  - Desenvolvimento local, testes automáticos, GitHub e prévias usam um conjunto fictício: 53 militares inventados da 1ª SB com as proporções da sandbox, matrículas numa faixa inexistente (começando em `990`). Serviços, turnos, guarnições, escalas, cotas, feriados, configurações e estrutura são os reais, por não serem dados pessoais. A matrícula e o nome reais que estavam em `testes/teste_p18.js` e `testes/teste_p19.js` foram trocados na criação de `casos/` (fase 2).
  - A cópia semanal do banco (D2) é guardada criptografada fora do Supabase.
- **Salvaguardas não adotadas:** apagar o banco de teste com data marcada; anuência escrita do Chefe da SB.

## Esquema do banco

Ver `docs/superpowers/specs/2026-11-16-esquema-banco.md` (v0.1). Decisões de modelagem tomadas com o usuário em 16/11/2026:

- Permuta: o sistema registra só a troca já aprovada pelo Chefe (fora do sistema).
- Configurações e feriados pertencem a uma unidade e valem para ela e as de baixo; a mais próxima vence.
- Militar de outra unidade só é escalado mediante vínculo de militar externo com a unidade da escala.
- Todo usuário do sistema é um militar cadastrado.

## Telas

Ver `docs/superpowers/specs/2026-11-16-telas.md` (v0.1) e a referência visual `docs/telas/telas-v12-anonimizado.html` (dados fictícios).

## Adendo (17/11/2026) — Pré-escala automática e ajustes do escalante

- **Intenção:** como no protótipo, o sistema gera a pré-escala e distribui saldos e operações (barreira de automação); o escalante trata os casos particulares em cima da prévia (barreira de suporte). Gerar de novo nunca sobrescreve o que já está escalado: só completa lacunas.
- **Decisão do usuário:** gerar de novo **não devolve** um militar a um dia e turno de onde o escalante o removeu. A remoção vale para o militar (militar + dia + serviço + turno), não para a vaga: outro militar pode ocupar a vaga na próxima geração.
- **Abordagens consideradas:** (A, escolhida) tabela própria de remoções, que a pré-escala e as distribuições consultam; (B) marcar a alocação como removida, descartada porque toda consulta teria de filtrar as removidas e um filtro esquecido poria no documento alguém já tirado; (C) deduzir da auditoria, descartada porque prende regra de negócio ao registro de histórico.
- **Desfazer:** colocar o militar de volta à mão na mesma combinação apaga a remoção; a ficha também oferece "Desfazer remoção".
- **Onde entra:** tabela `remocao` no esquema; regra no motor (fase 2: pré-escala, distribuição do Adm e distribuição de cotas pulam as combinações removidas); "Remover" e "Desfazer remoção" nas telas (fase 4).

## Adendo (17/11/2026) — Cadastros (fase 3)

Decisões tomadas com o usuário antes do plano da fase 3. O esquema e as telas já estão atualizados.

- **Turno do serviço × turno padrão do voluntariado.** Não há ligação cadastrada: vale o horário. O militar precisa ter marcado todo turno padrão que o turno do serviço toca (A = 08h às 20h; B = 20h às 08h). Uma operação das 16h às 00h pede A e B; uma das 00h às 08h pede o B da noite anterior. A regra é só do sistema novo e fica no motor (`pacotes/dominio`), com testes próprios.
- **Cards da escala.** Cada guarnição é um card. A ordem é mês › dia › turno › guarnição › função/militar. Não há agrupamento de cards.
- **Serviço × atividade.** **Serviço** é de onde vem a hora (Pronto, PJES, Saldo, Diária): rege cota, pagamento e quem pode ser escalado. **Atividade** é o que a guarnição faz (Incêndio, APH, Salvamento, Incêndio em vegetação, Apoio operacional). A escala reúne serviços (que têm os turnos) e guarnições (que têm atividade e funções).
- **Guarnição.** Definida pela atividade e pela composição (funções com mínimo, máximo e CNH). A viatura continua no cadastro, opcional e só informativa: muda no dia e durante o serviço, falta em algumas guarnições e serve a atividades diferentes. Por isso não define mínimo nem máximo.
  - Abordagens consideradas: (A, escolhida) guarnição ligada à escala, preenchida por qualquer serviço dela, com a atividade como atributo; (B) guarnição ligada a cada serviço, descartada porque o mesmo card é preenchido por Pronto, PJES e Saldo e exigiria uma ligação por serviço; (C) composição definida pela viatura, descartada pelos motivos acima.
  - Os documentos atuais confirmam a escolha: o card é a unidade tática, mistura serviços e não cita viatura.
- **Funções.** Catálogo por unidade (RN-94). As funções de um serviço saem das guarnições das escalas dele.
- **Tipos de afastamento e atividades.** Catálogos do sistema todo, editados pelo administrador em Configurações. Tipos iniciais: Férias, LTS, Curso, Outro. Afastamento aceita qualquer intervalo (férias podem ser em partes).
- **Importação inicial (D7).** Feita na própria tela: o escalante baixa a sandbox em .xlsx e envia; o sistema mostra a prévia (novos, alterados, iguais, problemas com solução) e só grava ao confirmar. Os dados reais vão direto para o banco de teste, sem passar pelo GitHub. Linhas com problema são puladas, sem bloquear as demais. Importar de novo não duplica.
- **Ordem da fase 3 (opção A, escolhida).** Um cadastro por vez, cada um com API, tela e importação, num PR próprio que o usuário confere no ambiente de teste: (1) Configurações e tipos de afastamento; (2) Militares e afastamentos; (3) Atividades, funções e guarnições; (4) Serviços, turnos e escalas; (5) Cotas e feriados. Alternativas descartadas: (B) camada por camada, que só deixaria conferir no fim; (C) importação primeiro com telas só de leitura, que deixaria o escalante sem corrigir nada no sistema novo por um tempo.
- **Para a fase 7 (registrado, não implementado agora).** Um gestor por nível da estrutura (chefe, diretor) cadastra os usuários do seu nível e de todos os de baixo, e define quem é o gestor de cada nível abaixo. O `papel_usuario` por unidade já comporta isso.
- **Atores (decidido em 17/11/2026).**
  - **Escalante:** monta as escalas com o apoio do sistema e mantém os cadastros da unidade dele e das de baixo.
  - **Gestor** (antigo papel `chefe`): faz o mesmo que o escalante, também na unidade dele e em todas as de baixo, e gerencia o nível. Cadastrar usuários e definir os gestores abaixo fica para a fase 7.
  - **Militar comum:** não tem papel cadastrado. É o usuário sem papel de escalante, gestor ou administrador. Vê só o que é dele: os próprios serviços ao longo dos dias, com quem compõe cada guarnição em que vai tirar serviço, e as escalas publicadas da unidade em que está lotado. Não vê cadastros. Abordagens consideradas: (C, escolhida) o que é dele mais as publicações da unidade, que é o que já circula hoje no documento impresso; (A) só o que é dele, descartada porque ele já recebe a escala publicada; (B) tudo para leitura, descartada por expor CNH, afastamentos e dados de todos (D7).
  - **Administrador:** superusuário do sistema todo; o papel só existe na unidade raiz.

## Adendo (17/11/2026) — Modelo de planilha e ajustes da ficha do militar

Decisões tomadas com o usuário depois de ver as entregas 1 e 2 funcionando no ambiente de teste.

### Modelo de planilha para importar

- **Intenção:** em toda tela com importação, o escalante baixa uma planilha `.xlsx` pronta: a aba de dados com o nome certo e o cabeçalho pronto, e uma aba `AJUDA` com as instruções escritas para o envio dar certo.
- **Por quê:** a sandbox inteira em .xlsx falhou no ambiente de teste (`Não foi possível ler o arquivo`). A causa foi do Google Planilhas, que exporta corrompida uma sandbox muito grande. Com o modelo, cola-se só a aba que interessa e a importação funcionou (52 de 52 militares). O modelo evita o erro, em vez de só explicá-lo.
- **Metas:** o escalante nunca precisa adivinhar nome de aba nem de coluna; a ajuda traz os valores que valem de verdade naquela unidade; modelo e leitura não podem divergir.
- **Fora de escopo:** o modelo não traz linha de exemplo nem dado preenchido, porque a linha de exemplo seria importada. Não se muda o nome da aba: o sistema continua procurando exatamente `MILITARES`, `CONFIGURAÇÕES` etc. (decisão do usuário; "MILITARES (colar)" foi um caso isolado).
- **Abordagens consideradas:**
  - (A, escolhida) A API gera o arquivo na hora, com ExcelJS, e cada importador declara suas colunas uma só vez; a leitura e o modelo usam a mesma lista. Permite a aba `AJUDA` com os valores reais da unidade (por exemplo, postos e equipes no cadastro de militares; as chaves de parâmetro nas configurações).
  - (B) Arquivos `.xlsx` prontos guardados no repositório. Descartada: divergem do código a cada coluna nova e não conhecem as equipes nem os tipos da unidade.
  - (C) Gerar o arquivo no navegador. Descartada: repete no site o conhecimento das colunas e pesa mais o pacote do site.
- **Onde fica a rota:** `GET /api/unidades/:u/importacao/:cadastro/modelo`, com a unidade, para a `AJUDA` listar os valores dela. Exige o mesmo papel da importação do cadastro. Alternativa descartada: rota sem unidade, que só permitiria ajuda genérica.
- **Conteúdo do arquivo:**
  - Uma aba por aba exigida pelo importador (por exemplo `TURNOS`, `ESCALAS` e `GUARNIÇÕES POR ESCALA` no importador de serviços e escalas), só com o cabeçalho, em negrito, linha congelada e largura razoável. Colunas de valor fechado e curto (JORNADA, MOTORISTA, VOLUNTÁRIO JES) vêm com lista de opções na célula.
  - A aba `AJUDA`, por último: para que serve o arquivo; como preencher (colar a partir da sandbox ou digitar); uma tabela com uma linha por coluna (nome, obrigatória ou não, o que escrever, valores aceitos); os valores reais da unidade; e o que o sistema faz (linha com problema é pulada e o resto entra; importar de novo não duplica; a prévia mostra tudo antes de gravar). As importadoras ignoram a aba `AJUDA`.
- **Mensagens de erro:** "aba que falta" passa a sugerir o modelo; "não foi possível ler" passa a dizer que sandbox grande pode sair corrompida do Google Planilhas e sugere colar só as abas no modelo.
- **Sandbox inteira continua aceita.** O modelo é o caminho recomendado, não o único.
- **Onde entra:** entrega 2.1 do plano da fase 3 (antes da entrega 3, porque as importações de guarnições, serviços e escalas, e cotas e feriados já nascem com o modelo). Importações das entregas 1 e 2 são adaptadas na mesma entrega.

### Ficha do militar — ajustes

Pedidos depois de usar a ficha:

- **Lotação** vai para o fim da ficha e começa recolhida. O título mostra a lotação atual numa linha ("1ª SB, Adm desde novembro de 2026"). "Registrar transferência" aparece ao abrir. É informação de consulta, não de uso o tempo todo.
- **Afastamentos:** a lista aparece sempre; o formulário de inclusão fica atrás do botão "Incluir afastamento" e fecha depois de gravar. O atalho "Mês inteiro" (e o campo "Mês do atalho") sai: poluía a tela por pouco uso. Isto substitui o que o adendo "Cadastros" e a especificação de telas diziam sobre o atalho.
- **Motorista:** o desenho dos botões fica, com a metade do tamanho.
- **Antiguidade repetida:** duas pessoas não podem ter a mesma antiguidade, mas o sistema **não renumera ninguém**: avisa. Os dois militares ganham a pendência "Antiguidade repetida com <nome de guerra>", mostrada na ficha e na lista; a gravação não é bloqueada (o escalante nunca é bloqueado). A comparação vale entre os militares lotados na mesma unidade no mês. A importação mostra o mesmo caso como aviso na prévia.
  - Abordagens consideradas: (A, escolhida) só avisar; (B) renumerar os demais ao mudar um, descartada porque a antiguidade vem de um ranking do 2º GB inteiro e o sistema só tem parte dos militares: renumerar quebraria a correspondência com o ranking e seria desfeito na próxima importação; (C) bloquear a gravação, descartada pelo princípio de nunca bloquear o escalante.

### Pendência registrada — antiguidade institucional (não implementar agora)

- **Situação hoje:** a antiguidade cadastrada é o lugar do militar no ranking do 2º GB, numérico e sem repetição, vindo da sandbox.
- **Problema:** com a institucionalização (fase 7) entram outros níveis hierárquicos (diretorias, DGO), e a antiguidade "no 2º GB" deixa de servir como critério em certos contextos.
- **Ideia do usuário:** tomar como base a antiguidade dos postos e graduações nos almanaques (documentos institucionais; cópias locais em `docs/fontes de dados/`, que não vão para o repositório, por conterem dados pessoais — D7), e o sistema estabelecer a antiguidade no nível hierárquico em que a pessoa estiver.
- **Por que fica para depois:** só pesa quando o escopo for institucional. Enquanto o sistema tratar uma seção ou um GB, a antiguidade da sandbox basta.
- **Perguntas em aberto para quando chegar a hora:** como o almanaque entra (importação do PDF ou digitação), como a antiguidade por nível é derivada, e o que acontece com a antiguidade manual cadastrada hoje.
