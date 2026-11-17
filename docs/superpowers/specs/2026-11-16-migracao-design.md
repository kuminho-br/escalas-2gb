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
