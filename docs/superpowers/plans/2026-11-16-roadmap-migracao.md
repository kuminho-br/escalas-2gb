# Roadmap — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026

**Nome e módulos (19/11/2026):** o sistema inteiro se chama **"Sistema de Gestão - 2º GB"** e tem três módulos.
- **Confecção de escalas:** fases 3 e 4, e de novo da fase 8 em diante.
- **Pecúlio do 2º GB:** as fichas de registro de todos os militares. Fase 5.
- **Visualização de escalas:** as publicações e a área do próprio militar (voluntariado, Minha escala). Fase 7, depois dos tipos de usuário (fase 6).

A tela de login nova entrou na entrega 3.3 da fase 4. Os detalhes estão nos adendos de 19/11 do design da migração ("Nome do sistema e módulos" e "Login, tela inicial, módulos e Pecúlio"). O mockup aprovado está em `docs/telas/login-e-inicio/mockup.html`.

**Reorganização de 20/11/2026 (decisão do usuário):** o desenvolvimento andou mais rápido que o previsto e ainda não é hora de montar a escala de um mês real. Antes de voltar à Confecção, entram o **Pecúlio** (a base de dados dos militares do 2º GB inteiro), os **tipos de usuário** com a tela inicial dos módulos e a **Visualização de escalas**. O Gerar documento e as distribuições automáticas passam para a fase 8 (primeiro mês real). O piloto continua sendo a diretriz geral, mas não fixa a ordem de tudo. Motivo e abordagens: adendo "Reorganização do roadmap: Pecúlio primeiro" em `docs/superpowers/specs/2026-11-16-migracao-design.md`.

**Objetivo:** levar o sistema do protótipo em Apps Script + Sheets para uma aplicação própria (banco relacional, API, interface web), primeiro numa fase de teste com cerca de 5 escalantes e depois no servidor institucional do Estado.

**Como ler:** cada fase termina numa entrega que dá para usar ou conferir. Cada fase ganha o seu próprio plano detalhado (tarefas, testes, commits) só quando for começar. Não há datas: o desenvolvimento é de uma pessoa, e a ordem importa mais que o prazo.

## Princípios

- **O protótipo continua sendo o laboratório de regras.** Uma regra nova ou complexa é prototipada e validada na sandbox do Apps Script. Só depois de aprovada ela é portada para o sistema novo.
- **As regras têm um teste só para os dois sistemas.** Os casos de teste viram arquivos de dados (entrada e resultado esperado) que rodam contra o protótipo e contra o sistema novo. Uma regra é considerada portada quando passa nos mesmos casos.
- **Tudo deve poder ir para o servidor do Estado sem retrabalho.** Banco Postgres padrão, sem depender de recursos exclusivos de um fornecedor de nuvem.
- **A auditoria existe desde o primeiro dia.** O registro de alterações é gravado pelo banco desde a fase 1, mesmo que a tela de histórico só chegue na fase 11.
- **Dados reais só com decisão explícita.** O tratamento de dados pessoais na fase de teste é uma decisão da fase 0.
- **A validação não trava o roadmap** (decisão do usuário, 20/11/2026). Cada entrega é validada na sandbox pela sessão de VALIDAÇÃO, ao mesmo tempo em que a programação segue para a próxima. O retorno da validação (pendências e ajustes) entra no roadmap no momento mais oportuno, como a 4.1 e a 4.2 entraram depois da validação da 3.3. Uma entrega "mesclada" não quer dizer "validada", e o roadmap não espera uma para começar a outra.

## Visão geral

| Fase | Entrega | Quem usa |
|---|---|---|
| 0. Decisões e especificação | Documento de design aprovado | Você |
| 1. Fundação | Banco, API e site no ar, com login e auditoria | Você |
| 2. Motor de regras | Regras do Apps Script portadas, com os testes passando | Você |
| 3. Cadastros | Todas as telas de cadastro, com carga inicial da planilha | Você e os escalantes |
| Revisões antes da fase 4 | Pendências aplicadas, telas testadas com pessoas e código revisado | Você e alguns usuários |
| 4. Montagem da escala | Montar e conferir a escala do mês à mão, nas quatro telas de trabalho | Você e os escalantes |
| 5. Pecúlio | A base de militares do 2º GB inteiro, importada do Pecúlio, e o módulo Pecúlio | Você e a administração do GB |
| 6. Usuários e módulos | Os quatro tipos de usuário, contas para os militares, acesso por lotação e a tela inicial com os módulos | Todos os militares |
| 7. Visualização de escalas | Publicar a escala no sistema, as publicações, a Minha escala e o próprio voluntariado | Todos os militares |
| 8. Primeiro mês real | Distribuições automáticas, Gerar documento, Escala por militar e o **piloto** | **~5 escalantes (piloto 1ª SB)** |
| 9. Operação diária (era a 5) | Efetivo por dia na operação, permutas, escala executada | Escalantes |
| 10. Regras novas (era a 6) | Regras validadas no laboratório e a tela de Ajuda | Escalantes |
| 11. Institucionalização (era a 7) | Níveis acima do GB, histórico, servidor do Estado | Corporação |

As fases 5 a 11 foram reorganizadas em 20/11/2026. Até então, a fase 5 era a Operação diária, a 6 os Insumos automáticos e a 7 a Institucionalização, e o Pecúlio e os tipos de usuário não tinham fase.

## Fase 0 — Decisões e especificação

Decidir uma coisa de cada vez, com opções e recomendação, e registrar cada decisão no documento de design.

**Decisões técnicas**
- D1. Linguagem e framework da API. O peso maior é reaproveitar as ~2,5 mil linhas de regras já escritas em JavaScript.
- D2. Banco e hospedagem do teste (Supabase/Vercel ou outro), região dos dados e plano gratuito (o Supabase grátis pausa após 7 dias sem uso).
- D3. Login para ~5 usuários, sem prender a solução a um fornecedor.
- D4. Biblioteca de interface e grade (a lista de "Escolher militar", os blocos da grade geral).
- D5. Impressão por modelos: formato do modelo (planilha, documento ou PDF) e ferramenta para preencher.
- D6. Organização do repositório: um repositório com protótipo e sistema novo lado a lado, ou dois.
- D7. Dados pessoais no teste: usar dados reais ou fictícios, quais campos levar (TELEFONE não é usado) e quem pode ver.

**Especificação**
- Telas: as decisões dos esboços (versão 12), com cópia anonimizada guardada no repositório.
- Esquema do banco: o ER proposto mais unidades em árvore, lotação com vigência e registro de auditoria.

**Pendências de negócio que tocam as fases seguintes**
- Voluntariado: formato do formulário e o que se marca por dia (turnos A, B e C). Bloqueia a fase 6; na fase 4 o lançamento é à mão.
- Diagrama de atividades: E1 a E8 (quem dispara o formulário, assinatura do Chefe, aprovação da permuta, envio da escala executada).
- ER: Q3, Q5 (tipos de afastamento), Q6 (permutas antigas), Q7 (militar de outra seção), Q14 (cota × operação), Q17, Q18. Em 17/11/2026 ficaram resolvidas Q5, Q17, RN-94 e a ligação do turno do serviço com o turno padrão (adendo do design, "Cadastros"); seguem abertas Q6 (fase 5) e o formato do formulário (fase 6).

**Entrega:** documento de design aprovado (`docs/superpowers/specs/`), que serve de base para os planos das fases 1 a 4.

## Fase 1 — Fundação

- Repositório organizado conforme a D6, com testes rodando a cada envio (CI).
- Banco com o esquema completo e migrações versionadas: unidades, militares e lotação, afastamentos, serviços e turnos, guarnições e composição com vigência, escalas e vínculos, cotas, feriados, configurações, alocações, voluntariado, permutas e auditoria.
- Auditoria gravada pelo próprio banco em toda tabela de negócio.
- Site e API publicados no ambiente de teste, com login.
- Carga de exemplo para desenvolvimento.

**Entrega:** você entra no site, vê uma tela vazia autenticada, e cada alteração feita direto no banco aparece no registro de auditoria.

## Fase 2 — Motor de regras

- Portar a lógica de domínio (`nucleo`, `regras_escala`, `choques`, `pre_escala`, `distribuicao_adm`, `distribuicao_cotas`, `guarnicao`, `cadastro_guarnicoes`, `parametros`) para um módulo que não conhece banco nem tela.
- Converter os 389 testes atuais em casos de dados compartilhados, rodando contra o protótipo e contra o módulo novo.
- Expor o motor pela API: gerar pré-escala, distribuir operações, verificar choques, listar quem pode ocupar uma vaga.

**Entrega:** os mesmos casos passam nos dois sistemas.

**Como ficou (17/11/2026):** o motor está em `pacotes/dominio`. Os casos compartilhados não foram reescritos à mão: `pnpm casos:gravar` roda os testes do protótipo e grava cada chamada às funções do motor em `casos/<funcao_>.json`; `pnpm casos:prototipo` confere o protótipo contra eles e o Vitest do `dominio` confere o código novo. A pré-escala, a distribuição do Adm e os parâmetros não tinham teste no protótipo; ganharam testes de caracterização (`prototipo/testes/teste_motor.js`). A regra nova das remoções (adendo de 17/11/2026) está só no sistema novo, com testes próprios. A exposição do motor pela API passou para as fases 3 e 4, junto com as telas que a usam.

## Fase 3 — Cadastros

Atores (adendo do design): escalante, gestor (antigo chefe; vale para a unidade e as de baixo), militar comum (só leitura do que é dele e das publicações da unidade; não vê cadastros) e administrador (superusuário, na raiz).

Um cadastro por vez, cada um com API, tela e importação da sandbox, num PR próprio que você confere no ambiente de teste (adendo do design, "Cadastros"):

1. **Configurações e tipos de afastamento:** parâmetros com norma de referência; catálogos do sistema (tipos de afastamento, atividades), editados pelo administrador.
2. **Militares e afastamentos:** identificação, lotação com histórico, jornada, quadro de motoristas e CNH com hierarquia, afastamentos com tipo.
   - **2.1 Modelo de planilha e ajustes da ficha (adendo de 17/11/2026):** em toda tela com importação, "Baixar modelo" entrega uma planilha com a aba nomeada, o cabeçalho pronto e uma aba AJUDA; as entregas 3 a 5 já nascem com ele. A ficha ganha lotação recolhida e por último, formulário de afastamento sob demanda, botões de motorista menores e o aviso de antiguidade repetida.
3. **Atividades, funções e guarnições:** guarnição = atividade + composição, com viatura opcional e versões por vigência.
4. **Serviços, turnos e escalas:** turnos dentro do serviço, com "Pede voluntariado em" pelo horário; escalas com serviços reunidos, publicação e guarnições por turno com vigência.
5. **Cotas e feriados.**

A importação é feita na tela, com prévia e confirmação; os dados reais vão direto para o banco de teste (D7). Cada importação oferece o modelo de planilha para baixar.

**Entrega:** os cadastros da 1ª SB conferidos no sistema novo, iguais aos da sandbox.

**Como ficou (18/11/2026):** os cinco cadastros estão no sistema novo, cada um com API (Hono, contratos em zod compartilhados com o site), tela (lista e detalhe) e importação da planilha, com prévia, modelo para baixar e a regra de que linha com problema é pulada e o resto entra; importar o mesmo arquivo de novo não grava nada. O que mudou em relação ao plano acima, por decisão do usuário depois de usar as telas no ambiente de teste:
- **Guarnição é um modelo** (adendo de 17/11/2026): a atividade saiu do cadastro dela, que é só nome, viatura informativa, prioridade e composição por versão. "Sem limite" deixou de existir: máximo vazio vale o mínimo. Excluir virou desativar (agora ou a partir de um mês), nas guarnições, nos serviços e nas escalas.
- **Serviços e turnos:** "Pede voluntariado em" saiu da tela (a regra, `turnosPadraoExigidos`, fica no motor para o voluntariado, fase 4). O turno único deixou de existir: o serviço de um turno só usa o A. A ficha ganhou a régua do dia, que mostra o turno que passa da meia-noite até onde ele vai no dia seguinte, e a cor escolhida numa grade como a do Google Planilhas.
- **Escalas:** o vínculo da guarnição é por faixa de horário, e não por letra de turno (adendo de 18/11/2026): a matriz tem uma coluna por horário distinto entre os serviços, mostra a letra junto quando ela não é ambígua, e "Todos os turnos" não existe mais. As fichas avisam "Alterações não salvas" antes de trocar de ficha ou sair.
- **Cotas e feriados:** a cota aponta direto para o serviço (PJES ou diária), sem o campo operação; o feriado é da unidade e vem herdado de cima, e "Copiar feriados fixos" leva só os que caem no mesmo dia todo ano. A importação lê as abas COTAS e FERIADOS das mesmas colunas do protótipo, com regras mais rígidas (a linha de outra seção, a de JES que o protótipo pulava em silêncio e os formatos de mês e de data fora de aaaa-mm, mm/aaaa, dd/mm/aaaa e aaaa-mm-dd viram problema com a solução, em vez de serem aceitos ou pulados sem aviso), e o feriado de data móvel (Carnaval, Cinzas, Paixão, Sexta-feira Santa, Páscoa, Corpus Christi) entra como móvel, com aviso.
- **Contrato de datas:** a data do contrato recusa dia que não existe no calendário (antes passava e dava erro do banco).

Ficou para as fases seguintes: a exposição do motor pela API (pré-escala, distribuições, quem pode ocupar a vaga) e o modelo de impressão (fase 4), a tela de Estrutura, o Histórico e o cadastro de usuários (fase 7), e a antiguidade institucional pelos almanaques (fase 7). "Distribuídas" nas cotas vale 0 até a fase 4, quando a escala passar a gravar alocações.

## Revisões antes da fase 4 (adendo de 18/11/2026)

Os cadastros estão prontos, mas foram feitos em dez entregas, cada uma com pendências pequenas anotadas no PR. Antes de montar a escala em cima deles, três revisões, nesta ordem (decisão do usuário):

1. **Revisão 1 — pendências.** Aplica a análise de interface de 18/11/2026 (as propostas aceitas estão no adendo do design "Revisões antes da fase 4") e as pendências menores anotadas nos PRs da fase 3 que uma pessoa pode encontrar ao usar as telas. As que já foram resolvidas saem da lista. As que só dizem respeito ao código (testes que faltam, código sem uso, recuo) ficam para a revisão 3. As que só aparecem com várias unidades ou com a escala gravando alocações ficam para as fases 4 e 7. Plano próprio: `docs/superpowers/plans/2026-11-18-revisao-1.md`. **Feita:** PRs #25 e #26, mesclados em 18/11/2026, sem migração.
2. **Revisão 2 — testes com pessoas.** Alguns escalantes e militares usam os cadastros no ambiente de teste, com os dados da 1ª SB. O retorno vira uma rodada de ajustes, com plano próprio quando houver o que mudar. **Feita:** os testadores usaram o ambiente de teste e o retorno foi aplicado nos PRs #25 e #26 (régua do dia, caminho da unidade, brasão, ajustes de cadastro); nenhum plano próprio foi necessário.
3. **Revisão 3 — revisão de código.** Leitura do sistema novo inteiro (API, site, motor e contratos), com as pendências internas separadas na revisão 1. Os problemas encontrados são corrigidos com teste antes da fase 4. Plano próprio: `docs/superpowers/plans/2026-11-18-revisao-3.md`. **Feita** em 18/11/2026 (PR da revisão 3, com as migrações 0012 e 0013): as pendências conhecidas foram fechadas e três leituras do código (API; site; motor e contratos) acharam 2 problemas críticos e 10 importantes, todos corrigidos com teste. O resultado está na seção "Resultado da revisão 3", abaixo.

**Entrega:** a fase 4 começa com os cadastros testados por quem vai usá-los e com o código revisado.

### Pendências registradas depois da revisão 1 (18/11/2026)

**Revisão 3 (17 itens do código, mais a leitura do sistema inteiro):**
- Corpo de envio malformado dá 500 (a importação lê o formulário sem tratar erro) e nenhuma rota limita o tamanho do envio.
- `?mes` inválido no PATCH do militar dá 500 (as outras rotas respondem 400).
- `importadores[cadastro]` usa objeto comum: `constructor` e `__proto__` dão 500.
- A migração 0009 criou a regra "administrador só na raiz" por gatilho, que só vale para gravações novas: não confere administradores que já existiam fora da raiz.
- Importação de guarnições: vigência vazia quando há vigência explícita anterior à criação da seção (regra `cadgVigencia`), e lista e ficha divergindo quando só a versão do mês está inativa e uma futura volta a ativa (sobra a importação com ATIVAR=NÃO).
- Testes que faltam: versões extras intocadas na importação de guarnições; "Ação" × "Acao"; guarnição futura na ficha; `/situacao` com 403, 404 e guarnição futura; "ÚNICO vira A" na importação de serviços.
- Pequenos: recuo em `importacao-guarnicoes.test.ts:48`; `textoHora('8')`; testes de rolagem que conferem estrutura em vez de comportamento; erros do editor num checkout novo antes de gerar os tipos (a confirmar).
- Menores adiados da revisão 1: a tela deixa o máximo passar de 99 e a prioridade de 1000; "1 guarnições" no cabeçalho da lista; erro de campo sem `aria-describedby`/`aria-invalid`; número da ordem no nome do link da guarnição e versão futura sem texto para leitor de tela; `salvando` de `AcoesDoBloco` sem uso (dois cliques mandam dois pedidos); código morto (`?? vigBruta`, linha em branco dupla em `contratos/servicos.ts`).

**Fases 4 e 7 (6 itens, só aparecem com várias unidades ou com alocações gravadas):** transferência sempre para a unidade do usuário (7); antiguidade comparada no caminho da unidade e na lotação (7); função igual criada na unidade de cima (7); catálogo de funções pela unidade do usuário, não da guarnição (7); renomear função sem conferir as unidades de baixo (7); mudar a letra de turno com militares escalados sem 409 (4, quando houver alocações). Também na fase 7: feriado criado numa unidade de baixo numa data que a de cima já tem, e a antiguidade institucional pelos almanaques.

*Reorganização de 20/11/2026:* os itens marcados "(7)" acima passam a aparecer **na fase 5**, quando o 2º GB ganhar as nove lotações, e entram no design dela: transferência, antiguidade no caminho da unidade, funções na unidade de cima, catálogo de funções, renomear função e feriado repetido. A antiguidade pelos almanaques continua na fase 11, só acima do GB.

### Resultado da revisão 3 (18/11/2026)

**Corrigido, cada item com teste que falhava antes:**
- Usuário desativado com a sessão aberta continuava usando a API (só o `/api/eu` barrava).
- A importação de militares alterava militar lotado só no futuro em outra seção.
- Envio malformado e envio grande davam 500 (agora 400 e 413, com limites de 1 MB nas rotas comuns e 4 MB na importação, abaixo dos 4,5 MB que a hospedagem aceita; a tela avisa antes de enviar); `?mes` inválido no PATCH do militar e `constructor`/`__proto__` como nome de importação davam 500; erro do banco na confirmação da importação voltava como texto puro.
- Antiguidade enorme dava 500 (contrato de 1 a 99999).
- Serviço com cotas virando ordinário deixava cotas que ninguém editava; cota repetida (clique duplo em "Copiar do mês anterior") agora é barrada pelo banco (migração 0013, que para se já houver repetidas).
- Migração 0012 confere administradores fora da raiz.
- Site: dado novo do servidor apagava a edição pendente e o aviso "salvo" (hook `useSincronizar`); "Incluir afastamento" fora das pendências e sem trava de clique duplo; erro de "Desativar" de um registro aparecendo na ficha de outro; telas de erro e de página inexistente em inglês; `textoHora('8')`; ficha da guarnição divergindo da lista; limites 99 e 1000, "1 guarnição", acessibilidade dos erros e das versões, Salvar sem clique duplo.
- Testes novos: toda rota exige sessão; isolamento entre unidades em toda rota com `:u` ou `:id`; importação de guarnições, situação e turno único.

**Decisão do usuário (18/11/2026): hierarquia de CNH.** A é uma categoria isolada: não habilita nenhuma outra e nenhuma outra a habilita. As demais seguem a cadeia B, C, D, E (regra do CTB): B habilita B; C habilita C e B; D habilita D e C (e, pela cadeia, B); E habilita E e D (e, pela cadeia, C e B). O motor (`cnh.ts`) e o protótipo (decisão de 14/11) já faziam assim; `CLAUDE.md` e `docs/superpowers/specs/2026-11-16-esquema-banco.md` diziam que D, C e B habilitavam A, e foram corrigidos. **Pendente (tela do motorista):** o usuário quer não precisar marcar categoria por categoria: ao clicar em E, as categorias que ela habilita (D, C e B) já ficam marcadas. Hoje a tela guarda só as categorias da carteira e mostra as que vêm pela hierarquia tracejadas ("pela D"). Falta definir se o clique em E também marca o A (o pedido cita "A, B, C e D", mas A é isolada pela regra) e se as categorias habilitadas aparecem marcadas só na tela ou são gravadas.

**Para a fase 4 (comprovados, sem chamador ainda):** `distribuirAdm` ignora todas as remoções quando a entrada vem sem `servico` (tornar obrigatório ou lançar erro); `turnosPadraoExigidos` não pede o B de D+1 num turno noturno de 24h (os tipos `TurnoPadrao` do domínio e dos contratos não representam); nomes de serviço e turno comparados ora normalizados ora pelo texto exato (decidir ids ou normalização única na entrada do motor, o protótipo faz igual).

**Menores adiados (nenhum muda quem é escalado):**
- API: cota ou cópia para serviço desativado (a importação recusa, a API aceita); edição parcial do militar regrava todas as colunas (duas pessoas editando o mesmo militar ao mesmo tempo perdem alteração); unicidade de nome só na aplicação ("ABT" e "Abt" simultâneos); importação de guarnições não confere tamanhos de viatura, tipo e nomes; importação de CONFIGURAÇÕES e GUARNIÇÕES POR ESCALA grava mês passado que a tela recusa; CNH com categoria repetida; nome da aba da planilha precisa ser exato; número cru do Excel (data serial, matrícula com zero à esquerda) citado diferente do que a pessoa vê; milhares de linhas na importação (2 a 3 consultas por linha).
- Site: sessão expirada numa aba aberta há dias ("Entre no sistema para continuar." sem dizer como); erro 4xx de consulta fica uns 7 s em "Carregando…"; fechar diálogo de criação descarta o digitado sem perguntar; clique duplo em "Copiar" (cotas e feriados) troca a mensagem; menu do celular sem Esc e sem levar o foco; "Incluir serviço…" age já na mudança do select; nomes acessíveis (X dos diálogos "Close", valores de mínimo e máximo, número da ordem); "1 escalas"; criar ou renomear função sem pendência nem trava; botão apagado sem explicar quando a consulta de postos ou tipos falha; regras repetidas no site (categorias de CNH, jornadas, expressão do mês); "Desativar agora" da guarnição sem confirmação; importação reaberta mostra o resultado anterior; linha de turno recriada quando o mesmo turno muda no servidor.
- Revisão final do branch: `useSincronizar` deixa o campo defasado se a pessoa desfaz a edição depois de dado novo do servidor (só atualizar `visto` quando não há alteração pendente); faltam testes de recarregamento sem pendência em Motorista, Identificação da escala, Identificação da guarnição e Serviços da escala; o erro genérico da confirmação da importação manda "enviar de novo" mesmo quando repetir não resolve; a mensagem "está lotado na X" vale também para lotação só marcada para o futuro; a migração 0012 conta papéis encerrados e convites vencidos (só se corrige por SQL, e então a 0013 também não roda); a tela de falha das rotas sugere problema de conexão para qualquer erro e não leva o foco ao título.
- Motor e contratos: ordem de antiguidade instável quando um lado não tem `ordem`; tipo `Militar` aceita campo errado (`antiguidade` em vez de `antig`); título padrão da escala pode passar de 120; horário digitado errado vira horário válido na importação de TURNOS; código repetido entre domínio e contratos (`mesVizinho`/`somarMeses`, `TurnoPadrao`, CNH, `proximoMes` sem uso); "hoje" calculado de três jeitos (`hojeRecife` na API, o navegador no site, `getFullYear` em feriados); testes que passariam com o código quebrado (`distribuicao-adm.test.ts`, `casos.test.ts`, `pre-escala.test.ts`, refine de serviço repetido); `postosDoModelo` devolve a lista do modelo, não cópia; `CLAUDE.md` local diz `LINHAS_POR_MILITAR = 3` e o código e o protótipo usam 2.

## Fase 4 — Montagem da escala (1ª versão para os testadores)

- Escala do mês: gerar pré-escala, tabela dia › turno › cards de guarnição, ícones de situação, "Escolher militar" com a lista já filtrada, vagas vazias em listras.
- Grade geral (entrega 4; design de 20/11/2026 em `docs/superpowers/specs/2026-11-20-grade-geral-design.md`): visão de todo o efetivo por equipe, como painel interativo; o clique é na célula (militar e dia) e abre o painel do dia com Adicionar, Trocar e Remover; filtro de equipes; colunas PJES e Diárias (número com barra comparativa) e Voluntariado (horas tiradas de pedidas); "Trocar" pode ser com quem já está escalado (mostra onde ele está), e entre dois ordinários é uma permuta.
- Voluntariado lançado à mão: calendário com marcação rápida e "Salvar e ir para o próximo".
- Gerar documento: escala publicada a partir do modelo de impressão. **Passou para a fase 8** (reorganização de 20/11/2026).
- Tela de login nova, com o brasão do 2º GB e a foto do quartel (entrega 3.3).
- Meta de ativação e Efetivo do dia do escalante (entrega 3.2, decisão de 20/11/2026); a tela vira **Efetivo por dia**, de trabalho, na entrega 3.3 (decisão de 20/11/2026, depois da 3.2.2).

Plano próprio: `docs/superpowers/plans/2026-11-18-fase4-escala.md` (cinco entregas; a 1 detalhada, as demais detalhadas antes de cada uma começar).

**Decisão do usuário (19/11/2026): login, módulos e Minha escala.**
- A tela de login ganha o visual do mockup aprovado na **entrega 3.3** (era a 3.2). Muda só a aparência.
- A **Minha escala** (era a entrega 6) **sai da fase 4**. Ela vai junto com a Visualização de escalas e a tela inicial com os módulos, no momento em que os tipos de usuário forem diferenciados (hoje a fase 7, Visualização de escalas, depois dos tipos de usuário na fase 6).
- A fase 4 termina na entrega 5, e o piloto continua sendo dos escalantes. *Mudou em 20/11/2026:* a fase 4 fecha na 4.3, e o Gerar documento e o piloto vão para a fase 8.

Design: adendo "Login, tela inicial, módulos e Pecúlio" em `docs/superpowers/specs/2026-11-16-migracao-design.md`.

**Decisão do usuário (18/11/2026): ordem de escala e acúmulo de funções.** A prioridade de ativação passa a ser a **ordem de escala**: uma lista por escala, com vigência por mês, da vez de cada vaga (guarnição + função + nº da vaga), editável numa tela de quadrados; a pré-escala segue a ordem à risca (o mais antigo apto em cada vaga) e substitui a prioridade da guarnição (RN-08). Quando falta gente, o escalante **acumula funções** à mão num militar já escalado na mesma faixa, inclusive de outra guarnição, com a CNH da vaga conferida. Entram como entregas 1.1 (acúmulo) e 2.1 (ordem), antes da 3. Design: `docs/superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md`. Pendente para depois: regras próprias por vaga (graduado de dia = o mais antigo do dia, exceto Adm; chefe = o mais antigo da guarnição).

**Decisão do usuário (19/11/2026): voluntariado por faixa de horário.** Depois de conversar com os militares: a disponibilidade deixa de ser turno padrão A/B e passa a ser marcada em blocos do dia tirados dos horários dos serviços que pedem voluntariado (hoje 00–08, 08–16, 16–20, 20–24), guardada em horários (início e fim) por dia; o militar não escolhe operação. Calendário com blocos proporcionais no computador; um dia por linha, só toque, no celular. Entra como entrega 2.2, depois da 2.1 (a ordem de escala foi executada primeiro). Design: `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`; mockup: `docs/telas/mockup-voluntariado-faixas.html`.

**Decisão do usuário (19/11/2026, depois da 2.2): ajustes do voluntariado.** Os turnos do CPRH e das eleições (07h, 15h, 19h, 23h) encheram o dia de faixinhas de 1h. Entra a **flexibilidade do voluntariado**: horas escolhidas pelo gestor, em Configurações, em qualquer nível hierárquico; o turno é conferido sem as N primeiras e as N últimas horas; buraco no meio continua barrando; não afrouxa choque nem descanso; a pré-escala segue a flexibilidade. O escalante sempre pode escalar quem não se voluntariou: hoje a lista esconde essa pessoa, então ganha um "Mostrar". No celular, entra o **modo foco**: ao abrir um militar, a lista some; ao salvar, volta. Os blocos do dia vêm das escalas: o gestor escolhe quais escalas entram na montagem (uma escala "fantasma", sem ninguém escalado, é só um jeito de usar isso). A flexibilidade vale só em horas cheias. Entra como **entrega 2.3, antes da 3**, porque a pré-escala já nasce usando a flexibilidade. Design: adendo de 19/11 em `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`.

**Retorno da sandbox da 2.3 (19/11/2026): acabamento do voluntariado e da escala do mês.** São cinco pontos:
- a barra cinza do dia 24 sumiu (confirmado);
- os blocos da noite ficam cinzas no fim de semana porque a cor `bg-noite` nunca existiu; a proposta é bloco vazio sempre branco;
- no computador, a régua de horários sai e entra um guia "Como marcar", com um dia de exemplo, que vale nas duas telas;
- o número do dia passa a parecer um botão, igual em qualquer estado;
- na Escala do mês, as guarnições do mesmo turno se ajustam à largura do painel, em todas as escalas.

Entra como **entrega 2.4, antes da 3**, porque a pré-escala é montada nessa tela. As propostas foram aprovadas com o mockup (`docs/telas/mockup-entrega-2-4.html`), e o plano está no plano da fase 4 (Tarefas 28 a 31). Design: adendo "depois da entrega 2.3" em `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`.

**Pendência da 2.4 para a entrega 3 (19/11/2026): a Escala do mês de verdade.** Na sandbox, o usuário corrigiu o que queria: o card da guarnição **não** deve ocupar a linha inteira (o que a 2.4 fez). Numa escala com uma guarnição por turno, como a Bioma, os **turnos do mesmo dia devem se agrupar na horizontal, de forma responsiva**. A proposta é uma grade de turnos de ~20rem, em que o turno com várias guarnições (Ordinário) ocupa a linha inteira, e o card volta a ter largura natural. Entra na entrega 3, porque a pré-escala é montada nesta tela. Design: adendo "depois da entrega 2.4" em `docs/superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md`.

**Decisão do usuário (19/11/2026): a entrega 3 sai em duas.**
- **3.1 — pré-escala do Pronto:** equipe do dia 1, vagas pela ordem de escala com o mais antigo apto, prévia e gravação.
- **3.2 — buracos, saldos e operações:** JES e Saldo nas vagas que sobraram, operações pelas cotas e a disposição da Escala do mês com os turnos lado a lado.

A 3.1 é validada na sandbox antes de a 3.2 começar, e a 3.2 tem quatro decisões de regra pendentes, listadas no plano da fase 4.

**Decisão do usuário (20/11/2026): meta de ativação e Efetivo do dia; a antiga 3.2 vira 3.3.** A escala ordinária existe para cumprir a **meta de ativação**: a lista de guarnições que a seção deve ativar em cada dia, com a ordem de ativação. A meta padrão é configuração do nível hierárquico, e o chefe altera qualquer dia como quiser. A guarnição só está ativada se fechar ao longo de todo o serviço, e dois militares de turnos menores podem fechar juntos a função de um turno maior. "Ordem de escala" passa a se chamar **ordem de escalação**. "Guarnições" passam a ser **modelos de guarnição** e vão para Configurações. Pronto, Saldo, JES e Expediente viram **serviços fixos**, criados pelo sistema. A entrega 3 fica assim:
- **3.2.1 — arrumação:** serviços fixos, ordem de escalação, modelos de guarnição em Configurações, sem "conta para a meta" na cota.
- **3.2.2 — meta e Efetivo do dia:** meta padrão e dias diferentes, o painel do escalante (só mostra, com atalho para a Escala do mês) e as cotas restantes na Escala do mês e no Efetivo do dia.
- **3.3 (era a 3.2):** alocar no Efetivo do dia, "completar com JES" num dia ou período escolhido pelo chefe, saldos do Adm, operações pelas cotas, turnos lado a lado e a tela de login nova.

Design: `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md`.

**Decisão do usuário (20/11/2026, depois da 3.2.2): Efetivo por dia e Escala por militar.** A 3.2.2 foi mesclada (PR #39), mas o painel nasceu como consulta do dia de hoje, e a leitura estava errada. O motor, a meta no banco e a API continuam valendo; a tela é refeita na **3.3**:
- "Efetivo do dia" passa a se chamar **Efetivo por dia**. É uma tela de trabalho: o escalante navega pelos dias e escala com a visão diária, atravessando todas as escalas da área.
- Cada guarnição mostra uma **linha do tempo das funções ao longo do dia**, como no voluntariado, com as vacâncias na própria linha. Sai a lista que repetia o militar a cada turno.
- A **meta do dia muda de forma implícita**, pela manipulação das guarnições na tela: remover tira da meta do dia (e pergunta se quer desescalar quem está nela); adicionar põe no fim; reordenar muda a ordem de ativação. Sai o diálogo "Alterar a meta deste dia". Escalar numa guarnição fora da meta não a põe na meta. A alteração de vários dias de uma vez foi abandonada.
- A 3.3 fica assim (escopo fechado pelo usuário em 20/11/2026, numa entrega só): **Efetivo por dia refeito (linha do tempo, meta implícita) e escalar nele**, turnos lado a lado na Escala do mês e a tela de login nova. **Saíram da 3.3:** "completar com JES", saldos do Adm, operações pelas cotas e os buracos do Pronto; esperam entrega marcada, com as quatro decisões de regra que faltam (plano da fase 4, fim da 3.3).
- **Escala por militar** (tela nova): escolher militares e ver como estão distribuídos no mês, comparando-os (ex.: o cruzamento das escalas de dois militares). Com a Grade geral, a Escala do mês e o Efetivo por dia, forma as **quatro telas principais**. É uma entrega maior, **sem fase marcada**: a sessão de PLANEJAMENTO vai estudar a estrutura das quatro telas e propor onde ela entra.

Design: adendo "Efetivo por dia" em `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md`.

**Retorno da validação da 3.3 (20/11/2026): entregas 4.1, 4.2 e 5.1.** O número da entrega é a ordem de execução; o pedido foi dividido pelo momento mais oportuno de cada parte:
- **4.1 — Meta do dia: desativar, reativar e adicionar** (depois da 4, antes da 5): "Desativar guarnição" no lugar de "Tirar da meta" (sempre desescala, com confirmação e "Desfazer"), grupo "Desativadas hoje" com "Reativar", "Adicionar guarnição" com todos os modelos e "Voltar ao padrão" sempre visível. Vem antes do "completar com JES", que preenche pela meta do dia.
- **4.2 — Efetivo por dia e Escala do mês em grade** (depois da 4.1, antes da 5): cards em grade, régua fora, vaga em faixa única com escolha do turno cadastrado, etiqueta do serviço na cor cadastrada; na Escala do mês, uma barra só por dia e dias em grade nas escalas de um turno por dia. Vem antes da fase 5, que constrói em cima do Efetivo por dia.
- **5.1 — O mesmo modelo de guarnição mais de uma vez no dia** (depois da 5, fechando a fase 4): tem migração e mexe na Escala do mês e na pré-escala; o design ainda será feito com o usuário. Até lá, um segundo modelo cadastrado ("ABT 2") resolve.
- Descartado: o "dia de serviço 08h→08h" no Efetivo por dia (o dia continua o do calendário). Adiados: o selo "ativada / não ativada" e o tom do aviso "Falta…".

Design: adendo "validação da 3.3" em `docs/superpowers/specs/2026-11-20-meta-de-ativacao-design.md`.

**Reorganização de 20/11/2026: como a fase 4 fecha.** A entrega 4 (Grade geral, PR #44) foi mesclada e segue em validação, sem travar a ordem (princípio acima). A fase 4 fecha com:
- **4.1 e 4.2**, do retorno da validação da 3.3 (meta do dia: desativar, reativar e adicionar; Efetivo por dia e Escala do mês em grade). Plano no PR #45.
- **4.3 — limpeza das pendências da fase 3**, que estava prevista para a 3.3 e ficou de fora: o campo de mês das Cotas (PR #32), o aviso de migração faltando (refazer o PR #15), a CNH habilitada marcada só na tela, a edição do militar gravando só o que mudou, a confirmação do "Desativar agora" e a cota recusada para serviço desativado. Design: `docs/superpowers/specs/2026-11-20-limpeza-da-fase-3-design.md`. Entram junto os menores da mesma natureza que a validação das entregas 3.2.2 e 4 listou: "Voltar ao padrão" sem confirmação (M7), troca recusada sem dizer de qual dos dois militares é o problema e o cabeçalho dos dias da Grade sem ficar fixo ao rolar. Também entra a medição do tempo de abertura do painel do dia (100 a 200 consultas). Plano: Tarefas 65 a 73 do plano da fase 4. O "Voltar ao padrão" sem confirmação (M7) saiu da lista, porque a 4.1 já pede confirmação. **Medida (Tarefa 73):** painel do dia: 33 consultas no cenário de teste (31 para um militar do Pronto e 33 para um do Adm, com dois serviços no dia, véspera, dia seguinte e feriado, numa escala com duas faixas e uma guarnição), bem abaixo das 100 a 200 que se temia; o número cresce com escalas, faixas e funções. **Limite:** acima de 40 consultas, ou se a validação na sandbox achar a abertura do painel lenta (mais de 1 s), entra um item "otimizar o painel do dia" na fase 8; até lá, nada muda no código.

**Saíram da fase 4 e foram para a fase 8 (primeiro mês real):**
- a **entrega 5, Gerar documento**;
- a **5.1, o mesmo modelo mais de uma vez no dia** (PR #45);
- as **distribuições automáticas**: completar com JES, saldos do Adm, operações pelas cotas e buracos do Pronto, com as quatro decisões de regra que faltam.

**Entrega:** os escalantes conseguem montar e conferir a escala de um mês à mão, nas quatro telas de trabalho, sem os tropeços conhecidos. O piloto passou para a fase 8.

## Fase 5 — Pecúlio (reorganização de 20/11/2026)

O Pecúlio do 2º GB hoje é uma planilha (`BACKUP DO PECÚLIO 2ºGB (04NOV26).xlsx`, guardada em `docs/fontes de dados/`, fora do Git). Ele é a base de dados dos militares do GB inteiro, e é dela que dependem os acessos (fase 6) e a Minha escala (fase 7): cada usuário do sistema já é um militar do cadastro (`usuario.militar_id`). Levantamento da planilha e decisões no adendo "Reorganização do roadmap: Pecúlio primeiro" do design da migração.

- **Estrutura do 2º GB:** as nove lotações do Pecúlio (SEDE, SCSv e 1ª a 7ª SB) viram unidades abaixo do 2º GB. É a parte da Estrutura que estava na fase 7, limitada ao GB.
- **Ficha do militar ampliada e importação do Pecúlio:** os cerca de 184 militares do GB, com os campos do Pecúlio, menos o CPF e o ano de nascimento (decisão D7 revista, opção a). A importação segue o padrão da fase 3: prévia, problemas com solução e importar de novo sem duplicar.
- **Antiguidade pela "Ordem" do Pecúlio:** a antiguidade no 2º GB passa a vir da coluna "Ordem". Resolve a pendência da antiguidade institucional dentro do GB; acima do GB, segue na fase 11.
- **Afastamentos vindos do Pecúlio:** férias (com o BGE e as reprogramações), L.E, LTS e DTS passam a alimentar os afastamentos que a escala já usa, sem lançamento à mão.
- **Telas do módulo Pecúlio:** lista e ficha de todos os militares do GB. O que mais entra (aniversariantes, números do efetivo com previsto, existente e déficit, missões extra por portaria) é decidido no design da fase.

**Decisões que faltam antes do design:**
1. A ficha do Pecúlio e a ficha de Militares são a mesma ficha, com mais campos, ou duas coisas separadas?
2. Depois da importação, quem é a fonte dos dados: o sistema (a planilha é aposentada) ou a planilha (importada de novo de tempos em tempos)?
3. Quais abas além da principal entram no módulo (Números efetivo; Missões extra por portaria).
4. Como o militar comum vai entrar no sistema: o Pecúlio não tem e-mail, e o login hoje é por e-mail. Se a resposta pedir um campo novo (e-mail, por exemplo), ele já nasce na ficha desta fase.

**Entrega:** os militares do 2º GB inteiro no sistema, com a ficha do Pecúlio, a antiguidade e os afastamentos, conferidos contra a planilha.

## Fase 6 — Usuários e módulos (reorganização de 20/11/2026)

- **Os quatro tipos de usuário:** administrador, gestor, auxiliar administrativo (escalante) e militar comum. Hoje escalante, gestor e administrador já estão gravados, e o militar comum é quem não tem papel.
- **Contas para os militares:** cada militar do Pecúlio pode ter acesso, pelo jeito decidido na fase 5 (decisão 4).
- **Cadastro de usuários:** o gestor cadastra os usuários do seu nível e de todos os de baixo e define o gestor de cada nível abaixo. Vem da fase 7 antiga, limitado ao 2º GB.
- **Acesso por lotação:** cada um vê a sua unidade e as de baixo; o seletor de unidade no topo deixa de ser fixo na 1ª SB para quem tem acesso a mais de uma.
- **Tela inicial com os módulos,** do mockup aprovado (`docs/telas/login-e-inicio/mockup.html`), com a **transição do login** das mangueiras (design de 20/11/2026, `docs/superpowers/specs/2026-11-20-transicao-login-design.md`). As fotos sorteadas das boas-vindas saíram: a cena final da transição ocupa o lugar delas.

**A decidir no design da fase:** quem vê cada módulo (por exemplo, se o militar comum vê a Confecção) e se "auxiliar administrativo" substitui "escalante" nas telas.

**Entrega:** qualquer militar do 2º GB entra no sistema e vê os módulos do seu tipo de usuário.

## Fase 7 — Visualização de escalas (reorganização de 20/11/2026)

- **Publicar a escala no sistema:** o passo que torna a escala do mês visível para os militares. Se a escala publicada fica travada e como se corrige depois de publicada é decidido no design da fase. O documento em .xlsx continua na fase 8.
- **Publicações da unidade:** as escalas publicadas da unidade em que o militar está lotado.
- **Minha escala:** os próprios serviços no mês, dia a dia, com quem compõe cada guarnição. É a Escala por militar com um militar só, e a tela das duas é desenhada junto (fase 8).
- **O próprio voluntariado:** o militar marca a sua disponibilidade no calendário por faixa de horário que o escalante já usa. O lançamento à mão pelo escalante continua. Com isso, a importação do Google Forms (fase 6 antiga) deixa de ser necessária.

**Entrega:** o militar vê a escala publicada e a sua própria escala, e marca o próprio voluntariado.

## Fase 8 — Primeiro mês real (reorganização de 20/11/2026)

- **Distribuições automáticas:** completar com JES num dia ou período escolhido pelo chefe, saldos do Adm, operações pelas cotas e buracos do Pronto. O motor já tem `distribuirCotas` e `distribuirAdm` portados e conferidos contra o protótipo; falta ligá-los às vagas, com prévia e gravação no padrão da pré-escala do Pronto (3.1). Antes, as quatro decisões de regra do plano da fase 4 (ordem dos buracos, saldo que não cabe, cota contra vaga, compulsória).
- **Gerar documento** (era a entrega 5 da fase 4): modelos de impressão em Configurações, a escala publicada em .xlsx a partir do modelo vigente e o histórico dos documentos gerados. Antes, as respostas sobre o modelo atual de impressão e sobre se a escala publicada traz só o Ordinário ou também as operações.
- **O mesmo modelo mais de uma vez no dia** (era a 5.1 da fase 4).
- **Escala por militar,** a quarta tela principal (seção própria abaixo).

**Entrega e marco:** piloto na 1ª SB. Um mês real montado no sistema novo, em paralelo com as planilhas atuais, e comparado no fim.

### Escala por militar e as quatro telas principais (decisão de 20/11/2026)

Tela nova: o escalante seleciona militares e vê como estão distribuídos ao longo do mês, comparando-os (ex.: dois militares e o cruzamento das escalas deles). Com ela, as telas principais são quatro:

| Tela | Quem | Quando |
|---|---|---|
| Grade geral | todos os militares | o mês |
| Escala do mês | uma escala (operação) | o mês |
| Efetivo por dia | todas as escalas da área | um dia |
| Escala por militar | militares escolhidos | o mês |

A Minha escala (fase 7) é o caso de um militar só, e a Grade geral (entrega 4) já dá a base da linha por militar. A decidir no design: o que se compara entre os militares (serviços, folgas, choques, horas), quantos militares por vez, se a tela também escala ou só mostra, e como as quatro telas se ligam entre si. Hipótese a conferir com o usuário: o cruzamento de dois militares lembra a **permuta** (fase 9); se for esse o uso, a tela pode ir junto com as permutas.

## Fase 9 — Operação diária (era a fase 5)

- Efetivo por dia na operação (a tela de trabalho do escalante nasceu nas entregas 3.2 e 3.3 da fase 4): turnos A e B lado a lado, operações do período das 08h de D às 08h de D+1, motoristas de serviço, marcação de presença, impressão.
- Permutas registradas e mostradas no Efetivo por dia. A Grade geral já trata a troca entre dois ordinários como permuta (entrega 4); aqui entra o registro formal.
- Escala executada: gerar e enviar até o dia 5 do mês seguinte.

**Entrega:** o escalante passa o mês inteiro no sistema, do dia 1 ao envio da escala executada.

## Fase 10 — Regras novas (era a fase 6)

- Regras validadas no laboratório entram aqui, na ordem em que forem aprovadas: distribuição de operações por função (B38/RN-81), equilíbrio de situações boas e ruins na compulsória (RN-43), causas de não ativação (viatura, calendário).
- Tela de Ajuda com o roteiro do mês.
- **Saiu (20/11/2026):** a importação do Google Forms. O próprio militar marca o voluntariado na fase 7. Ela só volta se a marcação pelo militar não pegar.

**Entrega:** cada regra nova chega já com os casos de teste compartilhados.

## Fase 11 — Institucionalização (era a fase 7)

- Estrutura acima do GB: árvore CBMPE › DGO › Diretorias › GB, com o seletor de unidade no topo das telas. As unidades dentro do 2º GB entram na fase 5.
- Escalas, guarnições e cotas em qualquer nível, como a operação do GB.
- Acesso por unidade acima do GB, com um gestor por nível (diretor e acima). Dentro do GB, o cadastro de usuários e o gestor por nível entram na fase 6.
- Tela de Histórico, sobre o registro que existe desde a fase 1.
- Antiguidade institucional acima do GB, pelos almanaques, com a antiguidade por nível derivada pelo sistema (pendência do adendo de 17/11/2026 do design). Dentro do GB, ela vem da "Ordem" do Pecúlio (fase 5).
- Migração para o servidor do Estado: cópia do banco, implantação e retirada do ambiente de teste. É aqui que o CPF e a data de nascimento completa entram (D7, revisão de 20/11/2026).

**Entrega:** sistema em produção institucional.

## Fluxo de uma regra nova (vale a partir da fase 2)

1. A regra é catalogada (RN-XX) pela sessão REGRAS DE NEGÓCIO.
2. É prototipada no Apps Script e validada na sandbox por você.
3. Os casos validados viram arquivos de teste compartilhados: `pnpm casos:gravar` e conferir o `git diff casos`.
4. O módulo novo (`pacotes/dominio`) é ajustado até passar nos mesmos casos (`pnpm --filter dominio test`).
5. PR, revisão e merge com a sua anuência.

## Riscos

- **A interface da Escala do mês e da Grade geral é a parte mais cara.** Por isso ela só começa na fase 4, com o motor e os cadastros prontos.
- **Os dois sistemas podem divergir.** Os casos de teste compartilhados são a defesa: nenhuma regra é portada sem eles.
- **Ambiente de teste gratuito:** pausa por inatividade e limites do plano. Isso é tratado na D2.
- **Dados pessoais numa nuvem comercial durante o teste.** Isso é tratado na D7, revista em 20/11/2026 para o Pecúlio: sem CPF e sem o ano de nascimento até o servidor do Estado.
- **O Pecúlio aumenta o escopo de uma seção para o GB inteiro.** São 184 militares em nove lotações, e o acesso por lotação (fase 6) precisa estar certo antes de o militar comum entrar.
- **O militar comum ainda não tem como entrar.** O login é por e-mail e o Pecúlio não tem e-mail. É a decisão 4 da fase 5.
