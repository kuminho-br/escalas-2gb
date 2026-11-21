# Design — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026 · retrato de hoje, sintetizado em 20/11/2026

Como o sistema novo é pensado hoje. A ordem das fases está no roadmap (`docs/superpowers/plans/2026-11-16-roadmap-migracao.md`); o histórico de cada decisão, em `docs/decisoes.md`. Os detalhes de tela ficam nas specs de cada tema, listadas no fim.

## 1. Decisões técnicas

| # | Decisão | Escolha |
|---|---|---|
| D1 | Linguagem e framework da API | TypeScript + Hono |
| D2 | Banco e hospedagem do teste | Supabase (só Postgres) + Vercel, região São Paulo |
| D3 | Login | Better Auth no nosso Postgres, por convite |
| D4 | Interface | React + Vite, Tailwind + shadcn/ui, TanStack Query, Router e Table |
| D5 | Impressão por modelos | Modelo .xlsx preenchido pela API (ExcelJS); PDF por LibreOffice (Gotenberg) |
| D6 | Repositório | Um repositório, protótipo em `prototipo/`, pnpm workspaces |
| D7 | Dados pessoais no teste | Dados reais no teste (sem CPF e sem ano de nascimento); fictícios no desenvolvimento e no GitHub |

### D1 — TypeScript + Hono

- **Escolha:** API em TypeScript com Hono. As regras ficam num módulo puro (`pacotes/dominio`), sem banco nem tela, portado do protótipo.
- **Por quê:** aproveita as regras e os testes já em JavaScript; o Hono roda igual no Vercel e num servidor Node comum, o que facilita a ida para o servidor do Estado.
- **Descartadas:** Next.js com tudo num app (prende a API ao app); Python + FastAPI (reescrita completa e duas linguagens).
- **Ressalva:** se a TI do Estado exigir outra linguagem, rever antes da fase 11.

### D2 — Supabase + Vercel, em São Paulo

- **Escolha:** Postgres no Supabase, usado só como Postgres (sem Supabase Auth, sem funções, sem o navegador falar com o banco). API e site no Vercel. Tudo em São Paulo.
- **Por quê:** custo zero, dados no Brasil, e a saída para o Estado é uma cópia do banco.
- **Cuidados:** o plano grátis pausa após 7 dias sem uso, então uma tarefa agendada consulta o banco de tempos em tempos. Uma cópia semanal (`pg_dump`) fica guardada, criptografada, fora do Supabase.
- **Descartadas:** Neon + Vercel (sem ganho que justifique a troca); servidor próprio (custo e manutenção).

### D3 — Better Auth, por convite

- **Escolha:** login próprio com Better Auth, integrado à API, com usuários, sessões e senhas no nosso Postgres. Entrada por e-mail e senha.
- **Sem cadastro aberto:** o administrador convida cada usuário por e-mail e define o papel e a unidade. O primeiro administrador é o desenvolvedor. Todo usuário é um militar do cadastro (`usuario.militar_id`, único e obrigatório).
- **Por quê:** os usuários vão junto com o banco para o Estado; "Entrar com Google" ou um login institucional entram depois como opções, sem refazer usuários.
- **Descartadas:** Supabase Auth (prende os usuários ao Supabase); só "Entrar com Google" (depende de contas pessoais).

### D4 — React + Tailwind + shadcn/ui + TanStack

- **Escolha:** site em React com Vite, em TypeScript, com Tailwind e componentes shadcn/ui seguindo os tokens das telas (vinho `#8E1B1B`, Barlow e Barlow Semi Condensed, cor por serviço).
- **TanStack Query** busca e atualiza os dados e invalida o que depende de cada gravação. **Router** dá um endereço a cada visão (mês, escala, dia, militar aberto). **Table** serve aos cadastros e ao Histórico.
- **Sem grade de planilha:** as telas da escala não são editadas como planilha; a edição é pelos painéis e pela lista "Escolher militar". Por isso não há AG Grid.
- **Descartadas:** MUI (visual padrão Google, pesado); componentes feitos à mão (acessibilidade por conta própria).

### D5 — Modelo em Excel, saída em planilha e PDF

- **Documentos:** escala publicada, efetivo do dia, escala executada, em .xlsx e PDF.
- **Modelo:** arquivo .xlsx com marcadores (`{{data}}`, `{{guarnicao}}`, `{{militar}}`…) e uma linha que se repete, editado pelo escalante ou pelo chefe, sem programar. Pode ser desenhado no Google Planilhas e baixado.
- **Geração:** a API copia o modelo e preenche com ExcelJS, preservando cabeçalho, brasão, cores e células mescladas. O PDF sai do LibreOffice num serviço separado (Gotenberg): no teste, no Google Cloud Run (camada gratuita, São Paulo); no Estado, um container ao lado da API.
- **Tela:** Configurações › Modelos de impressão, com envio (que confere os marcadores e recusa o arquivo se faltar algum), "Baixar modelo atual" e versões. Trocar o modelo vale a partir do envio.
- **Garantia:** sem o serviço de PDF, a primeira versão entrega o .xlsx, e o PDF sai pelo "Salvar como PDF" de quem abrir.
- **Descartada:** gerar no Google Planilhas (arquivos em contas pessoais, não vai para o Estado, convida a editar a escala fora do sistema).

### D6 — Um repositório, protótipo em pasta própria

- **Estrutura:** `prototipo/` (Apps Script, com o `.clasp.json` na raiz apontando para ela), `pacotes/dominio/` (regras), `pacotes/contratos/` (esquemas zod da API e do site), `apps/api/`, `apps/web/` e `casos/` (casos gravados do protótipo, que rodam contra os dois sistemas).
- **Ferramentas:** pnpm workspaces, Vitest e testes automáticos a cada envio ao GitHub.
- **Descartadas:** protótipo na raiz com o código novo ao lado (risco de mandar código novo ao Apps Script); dois repositórios (os casos de teste divergiriam).

### D7 — Dados pessoais

- **Teste:** o ambiente usado pelos escalantes recebe dados reais. Hoje são os da 1ª SB; com o Pecúlio (fase 5), os do 2º GB inteiro. Os dados já estão em contas pessoais do Google, então o teste não piora a situação.
- **Campos:** o que o sistema usa e os campos do Pecúlio, **menos o CPF e o ano de nascimento** (o aniversário fica só com dia e mês). CPF e data de nascimento entram só no servidor do Estado (fase 11). TELEFONE não é carregado.
- **Afastamentos:** só período e tipo, sem motivo de saúde (sem CID, sem laudo).
- **Desenvolvimento, testes, GitHub e prévias:** só dados fictícios, com matrículas numa faixa que não existe (começando em `990`). Hoje são 53 militares da 1ª SB; com o Pecúlio, o conjunto cresce para o GB inteiro, nas mesmas proporções. Serviços, guarnições, escalas e estrutura são os reais.
- **Arquivos de origem** (Pecúlio, almanaques) ficam em `docs/fontes de dados/`, fora do Git.
- **Descartadas (Pecúlio):** levar tudo, inclusive CPF e nascimento; levar só o que a escala usa.
- **Salvaguardas não adotadas:** apagar o banco de teste com data marcada; anuência escrita do Chefe da SB.

## 2. Atores e permissões

| Papel | O que faz |
|---|---|
| Administrador | Superusuário do sistema; o papel só existe na unidade raiz. Edita os catálogos do sistema. |
| Gestor (antigo chefe) | O mesmo que o escalante, na unidade dele e nas de baixo, e gerencia o nível (meta padrão, configurações). |
| Escalante (auxiliar administrativo) | Monta as escalas e mantém os cadastros da unidade dele e das de baixo. |
| Militar comum | Quem não tem papel. Vê só o que é dele (os próprios serviços, com quem compõe cada guarnição) e as escalas publicadas da unidade em que está lotado. Não vê cadastros. |

- O militar comum vê o próprio e as publicações porque é o que já circula hoje no documento impresso. Ver tudo foi descartado por expor CNH e afastamentos (D7).
- Os quatro tipos ainda não estão separados nas telas: isso é a fase 6. A decidir lá: quem vê cada módulo e se "auxiliar administrativo" substitui "escalante" nas telas.
- Um gestor por nível cadastra os usuários do seu nível e dos de baixo e define o gestor de cada nível abaixo: dentro do GB na fase 6, acima dele na fase 11. O `papel_usuario` por unidade já comporta isso.

## 3. Modelagem

O esquema completo está em `docs/superpowers/specs/2026-11-16-esquema-banco.md`.

- **Unidades em árvore:** configurações e feriados pertencem a uma unidade e valem para ela e as de baixo; a mais próxima vence.
- **Militar de outra unidade** só é escalado por vínculo de militar externo com a unidade da escala.
- **Permuta:** o sistema registra só a troca já aprovada pelo Chefe (fora do sistema).
- **Auditoria:** o banco grava o registro de alterações em toda tabela de negócio desde a fase 1.

## 4. Cadastros

### Conceitos

- **Serviço** é de onde vem a hora (Pronto, JES, Saldo, Diária, PJES): rege cota, pagamento e quem pode ser escalado. Pronto, Saldo, JES e Expediente são **serviços fixos**, criados pelo sistema e reconhecidos pelo nome.
- **Modelo de guarnição** é o posto operacional: composição (funções com mínimo, máximo e CNH), viatura só informativa e versões por mês. A atividade saiu do cadastro dele.
- **Escala** reúne serviços (que têm os turnos) e diz quais modelos de guarnição cada faixa de horário guarnece.

### Catálogos

- **Funções:** catálogo por unidade (RN-94). Renomear uma função muda o nome em todos os modelos.
- **Tipos de afastamento** (Férias, LTS, Curso, Outro): catálogo do sistema todo, editado pelo administrador em Configurações.
- **Atividades:** nada no sistema as lê desde que saíram do modelo de guarnição. A aba sai das Configurações na 4.4; a tabela fica no banco, sem uso.

### Militares

- **Ficha:** identificação, motorista e CNH, afastamentos e, no fim e recolhida, a lotação com histórico ("1ª SB, Adm desde novembro de 2026").
- **Lotação:** "Registrar transferência" aparece ao abrir o bloco.
- **Afastamentos:** a lista aparece sempre; o formulário fica atrás de "Incluir afastamento" e fecha depois de gravar. Aceita qualquer intervalo (férias em partes). Não há atalho "Mês inteiro".
- **Motorista:** botões por categoria, pequenos (ver CNH, na seção 5).
- **Edição:** cada bloco grava sozinho, e só os campos que mudaram. Dois escalantes mexendo em campos diferentes não se atrapalham; no mesmo campo, vale o último.
- **Antiguidade repetida:** o sistema não renumera nem bloqueia; os dois militares ganham a pendência "Antiguidade repetida com <nome>", na ficha, na lista e na prévia da importação. Renumerar foi descartado porque a antiguidade vem de um ranking do GB que o sistema só tem em parte.
- **Pendência de cadastro** aparece em âmbar; vermelho fica para erro e choque.

### Modelos de guarnição

- Ficam em Configurações, com a ficha e as versões por mês.
- **Máximo vazio vale o mínimo**; não existe "sem limite".
- **Excluir é desativar:** "Desativar agora" (com confirmação) ou "a partir de <mês>". Desativar a partir de um mês vale também para as versões posteriores.
- A composição se lê como frase ("de 1 a 2 militares", "Exige CNH D").

### Serviços e escalas

- **Turnos:** cada serviço tem os seus, com início e fim. Não existe turno único: o serviço de um turno só usa o A.
- **A ficha do serviço** mostra a régua do dia (0h a 24h), com o turno que passa da meia-noite desenhado até onde vai no dia seguinte, e a cor escolhida numa grade como a do Google Planilhas.
- **Vínculo da escala com a guarnição é por faixa de horário**, não por letra. Cada coluna da matriz é uma faixa distinta entre os turnos dos serviços da escala; serviços com a mesma faixa dividem a coluna. A coluna mostra a letra só quando ela não é ambígua.
- **"Todos os turnos" não existe na tela;** cada faixa é marcada separada. Mudar o horário de um turno deixa órfãos os vínculos da faixa antiga, e a ficha avisa.
- **Importação (GUARNIÇÕES POR ESCALA):** a coluna TURNO aceita vazio ou TODOS (todas as faixas da escala), letras ("A", "A, B") quando não são ambíguas na escala, ou a faixa ("08:00-20:00"). Letra ambígua vira problema, com a solução de escrever a faixa.
- **Descartados:** catálogo de turnos com ligação entre serviços (refaria turnos e alocações); vínculo por turno de cada serviço (serviço novo ficaria sem guarnição).
- "Pede voluntariado em" não aparece na tela; a regra fica no motor.

### Cotas e feriados

- **A cota aponta direto para o serviço** (PJES ou diária), sem campo de operação. Cota de serviço desativado é recusada.
- **O feriado é da unidade** e vem herdado de cima. "Copiar feriados fixos" leva só os que caem no mesmo dia todo ano; o de data móvel entra como móvel.

### Importação

- Feita na própria tela, com prévia (novos, alterados, iguais, problemas com a solução). Só grava ao confirmar. Os dados reais vão direto para o banco de teste, sem passar pelo GitHub.
- **Linha com problema é pulada** e o resto entra. Importar o mesmo arquivo de novo não grava nada.
- **Modelo para baixar:** a API gera o .xlsx na hora (`GET /api/unidades/:u/importacao/:cadastro/modelo`), com as abas exigidas, o cabeçalho pronto e a aba `AJUDA` com os valores reais da unidade. Cada importador declara as colunas uma vez, e a leitura e o modelo usam a mesma lista. O modelo não traz linha de exemplo.
- O sistema procura as abas pelo nome exato (`MILITARES`, `CONFIGURAÇÕES`…). A sandbox inteira continua aceita; o modelo é o caminho recomendado, porque o Google Planilhas exporta corrompida uma sandbox muito grande. As mensagens de "aba que falta" e "não foi possível ler" sugerem o modelo.
- A importação de CONFIGURAÇÕES e de GUARNIÇÕES POR ESCALA recusa vigência de mês que já passou, como a tela. Planilha antiga se adapta à regra de hoje: deixa vazia a vigência da linha que vale agora (vale desde a criação da seção) e apaga as antigas.
- As regras da importação de cotas e feriados são mais rígidas que as do protótipo: linha de outra seção, de JES ou com data fora dos formatos aceitos vira problema com a solução.
- **Descartados:** arquivos .xlsx prontos no repositório; gerar o modelo no navegador.

### Telas de cadastro

- A lista fica parada enquanto o detalhe rola. As fichas perguntam antes de sair com alterações não salvas.
- Excluir modelo de guarnição, serviço ou escala é desativar (agora ou a partir de um mês). Serviço e escala ativos mostram só "Desativar", com a explicação na pergunta de confirmação.
- O Salvar de cada bloco fica apagado sem alteração e acende em vinho quando há o que salvar.

## 5. Montagem da escala

- **Barreiras:** o sistema gera a pré-escala e as distribuições (barreira de automação); o escalante trata os casos particulares em cima da prévia (barreira de suporte). Nunca bloqueia o escalante.
- **Gerar de novo não sobrescreve** o que já está escalado: só completa lacunas.
- **Remoção:** gerar de novo não devolve um militar a um dia e turno de onde o escalante o tirou. A remoção vale para o militar (militar, dia, serviço, turno), não para a vaga.
  - Fica numa tabela própria (`remocao`), que a pré-escala e as distribuições consultam.
  - Colocar o militar de volta à mão apaga a remoção, e a ficha oferece "Desfazer remoção".
  - Descartados: marcar a alocação como removida (todo filtro esquecido poria no documento alguém já tirado) e deduzir da auditoria (prende regra ao histórico).
- **Escala do mês:** cada guarnição é um card; a ordem é mês › dia › turno › guarnição › função.
- **Ordem de escalação e acúmulo:** `docs/superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md`.
- **Voluntariado por faixa de horário:** `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`.
- **Meta de ativação e Efetivo por dia:** `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md`.
- **Grade geral:** `docs/superpowers/specs/2026-11-20-grade-geral-design.md` e os ajustes em `docs/superpowers/specs/2026-11-20-grade-geral-ux-design.md`.

### CNH

A hierarquia segue o CTB e fica fixa no código (RN-12), não no cadastro:

- **A** é isolada: não habilita nenhuma outra e nenhuma outra a habilita.
- **B** habilita B; **C** habilita C e B; **D** habilita D, C e B; **E** habilita E, D, C e B.

Na ficha do militar, marca-se a carteira; as categorias que ela habilita aparecem marcadas também, com "pela E". Só a carteira é gravada.

## 6. Nome do sistema, login e módulos

- **Nome:** "Sistema de Gestão - 2º GB".
- **Três módulos:**
  - **Confecção de escalas:** cadastros, voluntariado lançado pelo escalante, Escala do mês, pré-escala, Efetivo por dia, Grade geral e documento;
  - **Pecúlio do 2º GB:** as fichas de registro de todos os militares (fase 5; design em `docs/superpowers/specs/2026-11-20-peculio-design.md`);
  - **Visualização de escalas:** as escalas publicadas da unidade e a área do próprio militar, com a Minha escala e o próprio voluntariado (fase 7).
- **Tela de login** (mockup aprovado em `docs/telas/login-e-inicio/mockup.html`): foto do quartel com a bandeira, coberta de vinho à esquerda, com o brasão do 2º GB e o título; à direita, o cartão de login. No celular, a foto em cima e o cartão subindo sobre ela. O login em si é e-mail e senha.
- **Tela inicial** (fase 6): barra com o brasão, o nome do sistema, o caminho da unidade e "Sair"; faixa de boas-vindas; um cartão por módulo. A faixa recebe a cena final da transição do login (design de 20/11/2026, ainda fora do repositório), no lugar das fotos sorteadas.
- **"Esqueci minha senha"** aparece no mockup, mas ainda não tem função.

## 7. Pendências abertas

- **Pecúlio (fase 5):** como a planilha é usada hoje; ficha única ou duas; fonte dos dados depois da importação; abas extras; como o militar comum entra sem e-mail; quem vê cada informação. Detalhes em `docs/superpowers/specs/2026-11-20-peculio-design.md`.
- **Antiguidade institucional:** dentro do GB, vem da "Ordem" do Pecúlio (fase 5). Acima do GB (fase 11), a ideia é derivá-la dos almanaques, por nível hierárquico. Em aberto: como o almanaque entra (PDF ou digitação) e o que acontece com a antiguidade manual de hoje.
- **Tipos de usuário (fase 6):** quem vê cada módulo e o nome "auxiliar administrativo".
- **Publicação (fase 7):** se a escala publicada fica travada e como se corrige depois.

## 8. Outros documentos

- Telas: `docs/superpowers/specs/2026-11-16-telas.md` (referência visual em `docs/telas/telas-v12-anonimizado.html`, com dados fictícios).
- Esquema do banco: `docs/superpowers/specs/2026-11-16-esquema-banco.md`.
- Registro de decisões: `docs/decisoes.md`.
