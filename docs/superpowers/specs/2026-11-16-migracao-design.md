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
- **Revista em 20/11/2026 para o Pecúlio:** ver o adendo "Reorganização do roadmap: Pecúlio primeiro", no fim deste documento.

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

## Adendo (17/11/2026) — Guarnição como modelo (entrega 3.1)

Decisões do usuário depois de usar a tela de Guarnições no ambiente de teste.

- **Guarnição é um modelo**, instanciado com militares ao longo das escalas. Por isso a atividade sai do cadastro da guarnição. Isto substitui, no adendo "Cadastros", a frase "Guarnição. Definida pela atividade e pela composição": agora ela é definida pela composição. A coluna `guarnicao.atividade_id` fica no banco, sem uso. O catálogo de Atividades em Configurações fica, e onde a atividade entra se decide quando a escala instanciar as guarnições (fase 4).
- **Máximo vazio é igual ao mínimo.** Não há mais "sem limite" no sistema novo: o contrato exige o máximo, a importação preenche o vazio com o mínimo, e a migração 0010 corrige o que já foi gravado. O protótipo mantém a regra dele.
- **Desativar:** "Desativar agora" ou "Desativar a partir de <mês>". A guarnição desativada no mês some da lista; "Mostrar desativadas" a traz de volta para reativar. Desativar a partir de um mês vale também para as versões posteriores já cadastradas.
- **Renomear função:** pelo lápis ao lado da função, na composição. O nome muda em todas as guarnições. Padronizar os nomes é escolha do usuário.
- **Tela:** a composição se lê como frase ("de 1 a 2 militares"), com "Exige CNH" antes da categoria, e "Remover". A lista mostra os limites ("de 4 a 5 militares") ou "sem composição". "Viatura" passa a "Sigla da viatura".

## Adendo (18/11/2026) — Serviços e escalas depois do uso (entregas 4.1 e 4.2)

Decisões do usuário depois de usar as telas de Serviços e Escalas no ambiente de teste.

- **Sem turno único.** A letra U deixa de existir: o serviço de um turno só tem o turno A. A migração 0011 troca U por A nos turnos (Expediente e Defensoria), e a importação lê U e ÚNICO como A.
- **O vínculo da escala é por faixa de horário, não por letra.**
  - **Problema:** a mesma letra pode ter horários diferentes em serviços da mesma escala (o A do Pronto vai das 08h às 20h; o A do Bioma, das 00h às 08h). Gravado pela letra, o vínculo juntava os dois.
  - **Abordagens consideradas:**
    - (A, escolhida) o vínculo guarda a faixa (início e fim). Cada coluna da matriz é uma faixa distinta entre os turnos dos serviços da escala, e serviços com a mesma faixa compartilham a coluna (Pronto, JES e Saldo das 08h às 20h).
    - (B) catálogo de turnos com ligação M:N entre serviços e turnos, descartada por refazer turnos, alocações, a tela de Serviços e a importação, com o risco de um horário mudar em vários serviços sem querer.
    - (C) vínculo por turno de cada serviço, descartada porque um serviço novo na escala ficaria sem guarnição até a matriz ser salva de novo.
  - **Cabeçalho da coluna:** quando nenhuma letra é ambígua na escala (cada letra tem uma faixa só e cada faixa uma letra só), a coluna mostra a letra e a faixa ("A", "08h–20h"). Havendo ambiguidade, todas as colunas mostram só a faixa. As colunas vêm em ordem de início.
  - **"Todos os turnos" deixa de existir.** Cada faixa é marcada separada. A migração 0011 expande o "todos os turnos" gravado em uma marcação por faixa, e o vínculo por letra numa marcação por cada faixa com aquela letra. Vínculo cuja letra já não existe nos serviços da escala (o órfão avisado na tela) é descartado.
  - **Importação (GUARNIÇÕES POR ESCALA):** a coluna TURNO aceita vazio ou TODOS (todas as faixas da escala), letras ("A", "A, B"), quando não são ambíguas na escala, ou a faixa ("08:00-20:00"). Letra ambígua vira problema, com a solução de escrever a faixa.
  - **Custo aceito:** mudar o horário de um turno deixa órfãos os vínculos da faixa antiga. A ficha da escala avisa, como já avisava para a letra.
- **Serviços:** "Pede voluntariado em" sai da tela (a regra continua no motor, para o voluntariado). A duração ganha destaque no bloco com a cor do serviço, no lugar da letra. A ficha ganha uma régua do dia (0h a 24h) com os turnos desenhados e o aviso de sobreposição. A cor se escolhe numa grade como a do Google Planilhas, com as cores dos serviços e "Personalizada…".
- **Cadastros:** a lista à esquerda fica parada enquanto o detalhe rola (as duas rolagens são independentes), em todas as telas de cadastro.
- **Escalas:** a matriz mostra, em cada linha, o tamanho da guarnição ("de 4 a 5") e, embaixo de cada coluna, o mínimo de militares das guarnições marcadas. As fichas de serviço e de escala avisam "Alterações não salvas" e perguntam antes de sair com alterações pendentes.

### Ajustes da entrega 4.1 (18/11/2026, entrega 4.1.1)

- **Régua do dia:** desenha sempre o dia de 0h a 24h e pinta só onde há turno. O turno que passa da meia-noite continua pelo dia seguinte até onde vai (o B das 20h às 08h é uma barra só, com o fim às 08h do dia seguinte). Substitui o desenho em duas partes da 4.1.
- **Seletor de cor:** só o quadrado da cor no botão, na linha do "Nome na impressão".
- **Rolagem dos cadastros:** a página não estica ao passar do fim, e a rolagem da lista não passa para a página.

## Adendo (18/11/2026) — Revisões antes da fase 4

Entre a fase 3 e a fase 4 entram três revisões (roadmap, "Revisões antes da fase 4"): pendências, testes com pessoas e revisão de código. Este adendo registra o que a revisão 1 muda nas telas, a partir da análise de interface de 18/11/2026 (código, esboços `telas-v12` e fotos das telas em 1366 px e 390 px).

### Propostas aceitas

- **Botão Salvar que mostra o estado (A).** Em cada bloco da ficha, o Salvar fica apagado quando não há alteração e acende em vinho quando há o que salvar. Na linha de turno, ele só aparece quando a linha muda. O aviso "Salvo" some na primeira alteração seguinte, para não aparecer junto de "Alterações não salvas". Cada bloco continua gravando sozinho.
- **Aviso de cadastro incompleto (B).** Pendência é âmbar; vermelho fica para erro e choque. No alto da lista de militares, um resumo ("Cadastro incompleto em 9 militares. Ver quais") filtra a lista. Na ficha, a antiguidade repetida com mais de três militares vira "Antiguidade repetida com 20 militares. Ver quais", que abre os nomes. A lista mostra a situação no mês só de quem não está disponível.
- **Ficha num painel só (D).** A ficha é um painel único, com os blocos separados por uma linha fina e, embaixo do nome, um resumo de uma linha (ex.: "Viatura AR, Auto Resgate. Ativada em 2º lugar."). "Desativar" e "Reativar" vão para o cabeçalho da ficha.
- **Trilho estreito (E).** No computador, o menu vira um trilho de 84 px, com o ícone e o nome pequeno embaixo, como no esboço. No celular, continua o menu que abre pelo botão.

### Correções (cada uma com uma saída só)

- Campos, botões secundários e caixas de diálogo ficam brancos em qualquer tema do Windows. O site não tem modo escuro, e o tema escuro do sistema deixa de mudar só uma parte das cores. O botão secundário é branco com texto vinho.
- Serviço e escala ativos mostram só "Desativar"; a explicação vai na pergunta de confirmação. Desativados, mostram "Desativado" e "Reativar".
- "1 militar" no singular.
- As fichas de militar e de guarnição também perguntam antes de sair com alterações não salvas.
- Remover turno e remover afastamento perguntam antes.
- A caixa "Ativa" sai das versões da guarnição; desativar fica só em "Desativar agora / a partir de…".
- Configurações: Sim e Não numa lista que abre (não se escreve mais), e número em campo numérico.
- Grade geral: "A grade geral chega na próxima fase."
- Celular: o caminho da unidade corta pelo começo, para a seção atual ficar à vista; a coluna das guarnições da matriz fica parada ao rolar para o lado.
- A frase da composição da guarnição cabe numa linha por função, no computador.
- A mesma ação tem o mesmo nome: Salvar (não Gravar), Remover (não Apagar), Criar (não Cadastrar).

### Detalhes do esboço recuperados

- O item aberto na lista tem fundo rosado e uma barra vinho à esquerda.
- As versões ficam ligadas por uma linha, em ordem; a que só vale no futuro tem borda tracejada.
- A lista de guarnições mostra o número da ordem de ativação (ou "–" sem prioridade).
- Os nomes levam à ficha: escalas em "Onde é usada" da guarnição, serviços e guarnições na ficha da escala. O serviço ganha "Usado nas escalas …".
- Os textos de apoio passam de 12 px para 13 px.

### Recusadas

- Botões lado a lado para as escolhas curtas (C): as caixas, bolinhas e listas ficam como estão, e "Ativo" continua na Identificação do militar.
- Marcar de qual serviço vem cada coluna da matriz (F).
- Quadro "O que falta no cadastro" na página inicial (G).

### Pendências menores dos PRs

As pendências anotadas nos PRs da fase 3 são separadas em quatro grupos: as que uma pessoa pode encontrar nas telas entram na revisão 1; as já resolvidas saem; as internas (testes, código sem uso, recuo) vão para a revisão 3; as que só aparecem com várias unidades ou com alocações gravadas vão para as fases 4 e 7. A lista de cada grupo fica no plano da revisão 1.

## Adendo (18/11/2026) — Hierarquia de CNH

Decisão do usuário, que fecha a divergência achada na revisão 3 entre os documentos e o motor. A hierarquia vale como regra do CTB e fica fixa no código (RN-12), não no cadastro:

- **A** é uma categoria isolada: não habilita nenhuma outra e nenhuma outra a habilita.
- **B** habilita B; **C** habilita C e B; **D** habilita D e C; **E** habilita E e D. Pela cadeia B, C, D, E, D também habilita B, e E habilita D, C e B.

O motor (`CNH_HABILITA`, `cnhHabilitadas`) e o protótipo já seguiam isso; o `CLAUDE.md` e o esquema do banco diziam, por engano, que D, C e B habilitavam A.

**Tela do motorista (pendente de definição):** o usuário não quer marcar categoria por categoria (A, e depois B, C, D e E): ao clicar em E, as categorias que ela habilita devem já aparecer marcadas. Hoje a ficha guarda só as categorias da carteira e mostra as habilitadas tracejadas ("pela D"). A definir antes de mexer na tela: se o clique em E também marca o A, dado que A é isolada, e se as habilitadas ficam marcadas só na tela ou passam a ser gravadas.

## Adendo (19/11/2026) — Nome do sistema e módulos

Registro do usuário, para lembrar no futuro:

- **O nome do sistema inteiro é "Sistema de Gestão - 2º GB".**
- **O módulo em desenvolvimento agora é o de confecção de escalas:** cadastros, voluntariado lançado pelo escalante, escala do mês, pré-escala, grade geral e documento.
- **O módulo previsto depois é o de visualização de escalas**, com duas partes:
  - **as publicações**, ou seja, as escalas publicadas da unidade;
  - **a área do próprio militar**, onde ele marca o próprio voluntariado e vê as próprias escalas ("Minha escala").

A "Minha escala" e o militar marcando o próprio voluntariado já são as primeiras peças desse segundo módulo. Quando cada uma entra está no adendo seguinte.

## Adendo (19/11/2026) — Login, tela inicial, módulos e Pecúlio

Decisões do usuário depois dos mockups de login e de tela inicial. O mockup aprovado está em `docs/telas/login-e-inicio/mockup.html`, nas versões de computador e de celular.

**Os três módulos do sistema:**
- **Confecção de escalas:** o que está sendo feito nas fases 3 a 6.
- **Visualização de escalas:** as escalas publicadas da unidade e a área do próprio militar (Minha escala e o próprio voluntariado).
- **Pecúlio do 2º GB:** o lugar onde ficam as fichas de registro de todos os militares, com várias informações de cada um.

### 1. Tela de login nova — entrega 3.2 da fase 4

Muda só a aparência. O login continua o mesmo: e-mail, senha e as mesmas mensagens de erro.
- **Fundo:** a foto do quartel do 2º GB com a bandeira, sempre a mesma, coberta de vinho do lado esquerdo.
- **Lado esquerdo:** o brasão do 2º GB, o título **"Sistema de Gestão - 2º GB"** e a linha "2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco".
- **Lado direito:** o cartão de login de hoje, com o cabeçalho vinho, "Entrar" e "Use o e-mail cadastrado pela sua seção".
- **No celular:** a foto fica em cima, com o brasão e o título, e o cartão sobe um pouco sobre ela. Os campos e o botão ficam mais altos, para o toque.
- **Cores e fontes:** as do site (vinho, Barlow e Barlow Semi Condensed).
- **Arquivos:** o brasão do 2º GB e a foto do quartel vão para `apps/web/public`. A foto que o usuário enviou tem resolução baixa (471 × 585). Ela serve no teste, mas uma versão maior fica melhor com a foto ocupando a tela toda.
- **"Esqueci minha senha":** aparece no mockup, mas ainda não tem função. Fica fora da 3.2.

### 2. Tela inicial com os módulos e Visualização de escalas — quando os tipos de usuário forem diferenciados

Os tipos de usuário são quatro: **administrador, gestor, auxiliar administrativo (escalante) e militar comum**. A tela inicial com os módulos e o módulo de Visualização de escalas entram juntos, no momento em que esses tipos forem diferenciados. A **Minha escala** sai da fase 4 (era a entrega 6) e vai junto com a Visualização.

O motivo: só com os tipos separados faz sentido mostrar a cada pessoa os módulos que ela pode abrir. Mostrar a Minha escala antes disso seria fazer essa tela duas vezes. Na fase 4, o piloto é dos escalantes.

Hoje os papéis já existem em parte: escalante, gestor e administrador estão gravados, e o militar comum é quem não tem papel. O cadastro de usuários estava previsto para a fase 7. Em que fase entra esse momento é decisão do usuário, ainda em aberto.

- **Tela inicial (mockup):**
  - uma barra branca com o brasão do 2º GB, o nome do sistema, o caminho da unidade e o usuário com "Sair";
  - uma faixa de boas-vindas com foto ("Bom dia, Cb Almeida" e a data);
  - um cartão por módulo, com ícone, nome, descrição e uma linha de situação.
- **No celular:** o topo fica fixo ao rolar, o "Sair" vira só ícone e os cartões viram uma lista.
- **Fotos sorteadas:** a cada login, a faixa de boas-vindas mostra uma foto diferente, sorteada de um banco de fotos de militares do próprio quartel. Até chegarem as fotos reais, o mockup usa fotos de exemplo de licença livre, do Wikimedia Commons, com o crédito na própria foto.
- **A decidir nesse momento:**
  - quem vê cada módulo (por exemplo, se o militar comum vê a Confecção);
  - quem envia as fotos do banco e onde elas ficam guardadas;
  - se o nome "auxiliar administrativo" substitui "escalante" nas telas.

### 3. Reestruturação do cadastro de militares e módulo Pecúlio — momento ainda sem fase

Hoje o cadastro de militares é simples. Num momento futuro, o usuário vai reestruturá-lo, importando a estrutura de dados real usada na corporação, e o módulo Pecúlio nasce nesse mesmo momento.

Antes dessa entrega, é preciso decidir:
- se a ficha do Pecúlio e a ficha de Militares são a mesma ficha, com mais campos, ou duas coisas separadas;
- quem vê cada informação, porque a ficha completa traz mais dados pessoais (D7).

*Atualizado em 20/11/2026:* o Pecúlio ganhou fase (a 5), antes dos tipos de usuário (6) e da Visualização (7). Ver o adendo seguinte.

## Adendo (20/11/2026) — Reorganização do roadmap: Pecúlio primeiro

### Por quê

O desenvolvimento andou mais rápido que o previsto: a fase 4 já tem as quatro telas de trabalho (Escala do mês, Efetivo por dia, Grade geral e, a desenhar, a Escala por militar), e ainda não é hora de montar a escala de um mês real. A próxima etapa do roadmap era o Gerar documento (entrega 5 da fase 4), mas ele só tem uso quando o sistema publicar uma escala de verdade. Na leitura do usuário, o que destrava mais coisas é a **base de dados dos militares**, que hoje vive na planilha do Pecúlio: ela é a base dos acessos (cada usuário já é um militar do cadastro, `usuario.militar_id`, único e obrigatório), da Minha escala e da diferenciação dos tipos de usuário.

O piloto continua sendo a diretriz geral do projeto, mas não fixa a ordem de tudo (decisão do usuário).

### Abordagens consideradas

- **Rota 1 — seguir o roadmap (Gerar documento, depois o piloto).** Fecha a fase 4 como estava escrita. Descartada: no piloto, em paralelo com as planilhas, quem publica é a planilha, e o documento do sistema novo ficaria sem uso.
- **Rota 2 — preparar o piloto (estabilidade, distribuições automáticas, importação do voluntariado, piloto, documento).** Coloca o sistema novo no mesmo nível de automação do protótipo antes do mês real. Ficou como a ordem da fase 8: o mês real ainda não chegou.
- **Rota 3 — Pecúlio primeiro (escolhida).** Pecúlio (fase 5), tipos de usuário e módulos (6), Visualização de escalas (7) e só então o primeiro mês real (8). Usa o tempo que sobrou para construir a base que destrava o resto:
  - os acessos de todos os militares;
  - a antiguidade do GB, pela "Ordem" do Pecúlio;
  - os afastamentos sem lançamento à mão (férias, L.E, LTS e DTS);
  - o militar marcando o próprio voluntariado, o que dispensa a importação do Google Forms.

A fase 4 fecha antes, com a validação da entrega 4, as entregas 4.1 e 4.2 e uma 4.3 de limpeza (as pendências da fase 3 que ficaram de fora da 3.3). A ordem completa está no roadmap.

### O que é o Pecúlio hoje (levantamento de 20/11/2026)

Uma planilha, `BACKUP DO PECÚLIO 2ºGB (04NOV26).xlsx`, guardada em `docs/fontes de dados/`, **fora do Git** (`.git/info/exclude`). O levantamento leu só a estrutura (abas, cabeçalhos, contagens e categorias), sem copiar dados pessoais.

- **Aba "2ºGB" (a principal):** cerca de 184 militares do 2º GB inteiro, de Ten Cel a Sd, com o cabeçalho na linha 9 e um título institucional em cima. Colunas:
  - sexo, **Ordem** (a antiguidade no GB), posto/grad., matrícula, nome completo;
  - voluntário PJES, abono de permanência, aniversariantes do mês, aniversário, data de nascimento, **CPF**, data de ingresso;
  - **lotação** (SEDE, SCSv, 1ª a 7ª SB), função administrativa (cerca de 49 diferentes) e comportamento (Excepcional, Ótimo, Bom);
  - **férias**: BGE, plano, reprogramação do período 2026/2027, reprogramadas e cassada;
  - L.E, LTS, DTS e adido/agregado;
  - à direita, blocos de resumo por posto (SubTen, 1º Sgt…), que são contas da planilha, não dados de militar.
- **Aba "Números efetivo":** previsto, existente e déficit do 2º GB e da 1ª SB, e o existente por SB e por posto.
- **Aba "Missões extra por portaria":** missão, publicação, posto, matrícula, nome e funções extras.

**O que o Pecúlio não tem:** e-mail (o login de hoje é por e-mail), CNH, equipe e jornada. Esses três últimos continuam vindo da escala.

### D7 revista para o Pecúlio (decisão do usuário, opção a)

- **Escolha:** o banco de teste recebe **todos os campos do Pecúlio, menos o CPF e o ano de nascimento**. O aniversário fica só com dia e mês. Os dados completos (CPF e data de nascimento) entram só no servidor do Estado (fase 11).
- **Continua valendo da D7 original:** afastamento sem motivo de saúde (sem CID, sem laudo), TELEFONE fora, desenvolvimento e testes com dados fictícios.
- **Consequência para o desenvolvimento:** o conjunto fictício (hoje 53 militares da 1ª SB) cresce para o GB inteiro, com as nove lotações e os campos novos, nas mesmas proporções do Pecúlio.
- **Alternativas descartadas:**
  - (b) levar tudo: põe o CPF e a data de nascimento de 184 pessoas numa nuvem comercial ainda de teste;
  - (c) só o que a escala usa e mais as férias: seguro, mas o Pecúlio vira só um apoio da escala.

### Decisões que faltam (antes do design da fase 5)

1. **Ficha única ou duas:** a ficha do Pecúlio e a de Militares são a mesma, com mais campos, ou duas coisas separadas?
2. **Fonte dos dados depois da importação:** o sistema (a planilha é aposentada) ou a planilha (importada de novo de tempos em tempos)?
3. **Abas extras no módulo:** Números efetivo e Missões extra por portaria entram?
4. **Como o militar comum entra:** o Pecúlio não tem e-mail. Se a resposta pedir um campo novo, ele nasce na ficha da fase 5.
5. **Quem vê cada informação do Pecúlio:** por tipo de usuário e por lotação. Fecha junto com a fase 6, mas a ficha da fase 5 já nasce sabendo quais campos são restritos.

Também entram no design da fase 5 os problemas que só apareciam com várias unidades (roadmap, "Fases 4 e 7"): transferência, antiguidade no caminho da unidade, funções na unidade de cima, catálogo de funções, renomear função e feriado repetido.

