# Roadmap — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026 · reorganizado e sintetizado em 20/11/2026

**Objetivo:** levar o sistema do protótipo em Apps Script + Sheets para uma aplicação própria (banco, API, site), primeiro num ambiente de teste com cerca de 5 escalantes e depois no servidor do Estado.

**O sistema** se chama "Sistema de Gestão - 2º GB" e tem três módulos: Confecção de escalas (fases 3, 4 e 8 em diante), Pecúlio do 2º GB (fase 5) e Visualização de escalas (fase 7). Como ele é pensado: `docs/superpowers/specs/2026-11-16-migracao-design.md`.

**Como ler:**
- Este documento é só o mapa: a ordem das fases, a situação de cada entrega e onde está cada coisa.
- O porquê de cada decisão está em `docs/decisoes.md`.
- Cada fase tem um plano de tarefas, escrito por entrega, só quando ela está para começar. Plano pedido pelo usuário vai direto ao GitHub, é mesclado e vai para a execução (Sonnet executa, Opus revisa).
- Ao terminar uma entrega, a DESENVOLVIMENTO envia o branch; a PLANEJAMENTO abre o PR, mescla e avisa a VALIDAÇÃO, que monta os testes de navegador para o usuário. Uma fase com muitas dependências (a 5) ganha antes um design da fase inteira.
- Não há datas: o desenvolvimento é de uma pessoa, e a ordem importa mais que o prazo.
- O número da entrega é a ordem de execução.

## Princípios

- **O protótipo é o laboratório de regras.** Regra nova ou complexa é validada na sandbox antes de ir para o sistema novo.
- **As regras têm um teste só para os dois sistemas.** Uma regra está portada quando passa nos mesmos casos (`casos/`).
- **Tudo deve ir para o servidor do Estado sem retrabalho.** Postgres padrão, sem recurso exclusivo de fornecedor.
- **A auditoria existe desde o primeiro dia.** O banco grava as alterações desde a fase 1; a tela de Histórico vem na fase 11.
- **Dados reais só com decisão explícita.** O tratamento de dados pessoais é a D7 do design.
- **A validação não trava o roadmap.** Cada entrega é validada na sandbox pela sessão de VALIDAÇÃO enquanto a programação segue. Mesclada não quer dizer validada.
- **O retorno da validação vai para frente:** vira uma entrega nova no fim da fase em andamento; nunca reabre uma fase passada nem passa na frente do que já está previsto.

## Visão geral

| Fase | Entrega | Quem usa | Situação |
|---|---|---|---|
| 0. Decisões e especificação | Design aprovado (D1 a D7), esquema do banco e telas | Você | concluída |
| 1. Fundação | Banco, API e site no ar, com login e auditoria | Você | concluída |
| 2. Motor de regras | Regras do protótipo portadas, com os casos passando | Você | concluída |
| 3. Cadastros | Todas as telas de cadastro, com importação da planilha | Você e os escalantes | concluída |
| Revisões antes da fase 4 | Pendências, testes com pessoas e revisão de código | Você e alguns usuários | concluídas |
| 4. Montagem da escala | Montar e conferir a escala do mês à mão, nas telas de trabalho | Você e os escalantes | concluída |
| 5. Pecúlio | A base de militares do 2º GB inteiro e o módulo Pecúlio | Você e a administração do GB | concluída |
| 6. Usuários e módulos | Tipos de usuário, contas, acesso por lotação, tela inicial | Todos os militares | em execução |
| 7. Visualização de escalas | Publicar a escala, publicações, Minha escala, próprio voluntariado | Todos os militares | planejada |
| 8. Primeiro mês real | Distribuições automáticas, documento, Escala por militar e o piloto | ~5 escalantes (piloto 1ª SB) | planejada |
| 9. Operação diária | Efetivo por dia na operação, permutas, escala executada | Escalantes | planejada |
| 10. Regras novas | Regras validadas no laboratório e a tela de Ajuda | Escalantes | planejada |
| 11. Institucionalização | Níveis acima do GB, Histórico, servidor do Estado | Corporação | planejada |

## Fase 0 — Decisões e especificação · concluída

Decisões técnicas D1 a D7, esquema do banco e telas. PR #8.

- Design: `docs/superpowers/specs/2026-11-16-migracao-design.md`
- Esquema: `docs/superpowers/specs/2026-11-16-esquema-banco.md`
- Telas: `docs/superpowers/specs/2026-11-16-telas.md`
- Questões do ER: Q5 e Q17 resolvidas em 17/11/2026; Q6 (permutas antigas) segue aberta, para a fase 9; Q3, Q7, Q14 e Q18 sem registro de resolução.
- Em aberto: o processo do mês (`docs/negocio/processo-do-mes.md`, E1 a E8).

## Fase 1 — Fundação · concluída

Repositório reorganizado (protótipo em `prototipo/`), banco com o esquema completo e migrações, auditoria pelo banco, site e API no ar com login. PRs #9, #10 e #11. Plano: `docs/superpowers/plans/2026-11-16-fase1-fundacao.md`.

## Fase 2 — Motor de regras · concluída

O motor está em `pacotes/dominio`. Os casos são gravados do protótipo (`pnpm casos:gravar`) e conferidos contra os dois sistemas. A pré-escala, a distribuição do Adm e os parâmetros ganharam testes de caracterização.

A regra das remoções existe só no sistema novo. A exposição do motor pela API ficou para as fases 3 e 4, junto com as telas que a usam. PR #12. Plano: `docs/superpowers/plans/2026-11-17-fase2-motor.md`.

## Fase 3 — Cadastros · concluída

Um cadastro por vez, cada um com API, tela e importação, num PR próprio. Plano: `docs/superpowers/plans/2026-11-17-fase3-cadastros.md`.

Entregas 1 a 5 (configurações, militares e afastamentos, guarnições, serviços e escalas, cotas e feriados), PRs #13 a #24.

A data do contrato recusa dia que não existe no calendário. "Distribuídas" nas cotas valeu 0 até a fase 4, quando a escala passou a gravar alocações.

Os PRs #15 (aviso de migração faltando) e #32 (campo de mês das Cotas) ficaram abertos e foram refeitos na entrega 4.3 (PR #57); os dois estão fechados.

## Revisões antes da fase 4 · concluídas

Pendências de interface, testes com pessoas e revisão de código (2 críticos e 10 importantes, corrigidos com teste): PRs #25 a #27. Planos: `docs/superpowers/plans/2026-11-18-revisao-1.md` e `2026-11-18-revisao-3.md`. O que ficou sem corrigir está em "Pendências conhecidas".

## Fase 4 — Montagem da escala · concluída

Montar e conferir a escala do mês à mão, nas telas de trabalho (Escala do mês, Efetivo por dia, Grade geral). Plano: `docs/superpowers/plans/2026-11-18-fase4-escala.md`.

Entregas 1 a 4.7, PRs #28 a #68: Escala do mês à mão, acúmulo, voluntariado por faixa, ordem de escala, pré-escala do Pronto, meta de ativação, Efetivo por dia, Grade geral e quatro lotes de acabamento. A tabela com cada entrega está no plano da fase.

Specs, em `docs/superpowers/specs/`: `2026-11-18-ordem-de-escala-e-acumulo-design.md`, `2026-11-19-voluntariado-por-faixa-design.md`, `2026-11-20-meta-de-ativacao-design.md`, `2026-11-20-grade-geral-design.md`, `2026-11-20-grade-geral-ux-design.md` e `2026-11-20-limpeza-da-fase-3-design.md`.

**Painel do dia:** medido em 33 consultas na 4.3 e 42 na 4.4 (cresce cerca de 9 por faixa); passou do limite de 40, e "otimizar o painel do dia" entrou na fase 8.

**A fase fechou na 4.7** (21/11/2026), o terceiro lote de pendências simples. Os escalantes conseguem montar e conferir a escala de um mês à mão, sem os tropeços conhecidos.

## Fase 5 — Pecúlio · concluída

A estrutura da ficha do militar que hoje vive na planilha do Pecúlio, e a parte dela que a escala usa. Design: `docs/superpowers/specs/2026-11-20-peculio-design.md`.

Ficha ampliada com dono por bloco, lotação como posição na estrutura, "Histórico de rastreio", CNH separada do quadro, novos tipos de afastamento, as sete seções, a importação do Pecúlio e o módulo. Plano: `docs/superpowers/plans/2026-11-21-fase5-peculio.md`.

| Entrega | O quê | Situação |
|---|---|---|
| 1 | Rastreio e CNH: lotação só a unidade, "Histórico de rastreio", CNH separada do quadro, sete seções | mesclada (#73), migração 0023 aplicada no teste |
| 2 | Ficha ampliada e dono por bloco | mesclada (#79), migração 0024 aplicada no teste |
| 3 | Importação do Pecúlio e o módulo (e a importação de MILITARES respeitando o dono por bloco) | mesclada (#80) |
| 4 | Retorno da validação (Efetivo por dia, Escala do mês, contraste, Grade, CNH, "Turnos", "Importar") | mesclada (#82) |

**Postergado** (não trava a fase): abono de permanência, ativo/inativo, funções e QOD, férias, quem vê cada atributo, jornada dos oficiais, quadro separado do posto, cópia de segurança gerada pelo sistema, data de ingresso e CPF.

## Fase 6 — Usuários e módulos · em execução

Design: `docs/superpowers/specs/2026-11-21-usuarios-e-modulos-design.md`. Plano: `docs/superpowers/plans/2026-11-21-fase6-usuarios-e-modulos.md`.

| Entrega | O que traz | Situação |
|---|---|---|
| 1 | Contas e papéis: senha provisória, troca no primeiro login, papéis na ficha, "Auxiliar administrativo" | mesclada (#86), migração 0025 aplicada no teste |
| 2 | Unidade de trabalho: o seletor substitui a 1ª SB fixa, e o auxiliar gera a senha de um colega auxiliar | mesclada (#88) |
| 3 | Tela inicial e módulos por papel, Minha ficha com o próprio telefone; conta desativada só volta por quem dá o papel | em execução |
| 4 | Transição do login (as mangueiras), se o mockup estiver aprovado | condicional |

**Fora:** envio de e-mail (link de senha e "Esqueci minha senha"), usuários acima do GB (fase 11), Visualização (fase 7).

## Fase 7 — Visualização de escalas · planejada

- Publicar a escala no sistema (o documento em .xlsx é a fase 8).
- As escalas publicadas da unidade.
- A Minha escala: os próprios serviços, com quem compõe cada guarnição. É a Escala por militar com um militar só, e as duas telas são desenhadas juntas (fase 8).
- Na área pessoal, a comparação da própria escala com a de outro militar entra com a Escala por militar (fase 8); a busca por permutantes, na fase 9.
- O próprio militar marca o voluntariado; o lançamento pelo escalante continua.

**A decidir:** se a escala publicada fica travada e como se corrige depois. Junto: o "dia passado travado" (RN-85, pergunta P-17) não existe hoje; escalar e trocar aceitam qualquer data.

## Fase 8 — Primeiro mês real · planejada

- **Distribuições automáticas:** completar com JES num dia ou período escolhido pelo chefe, saldos do Adm, operações pelas cotas e buracos do Pronto. O motor já tem `distribuirCotas` e `distribuirAdm`; falta ligá-los às vagas, no padrão da pré-escala do Pronto.
- **Gerar documento:** modelos de impressão em Configurações, a escala em .xlsx a partir do modelo e o histórico dos documentos.
- **O mesmo modelo de guarnição mais de uma vez no dia.**
- **Otimizar o painel do dia** da Grade geral: 42 consultas com uma escala e três faixas, e cresce com cada faixa.
- **Escala por militar:** militares escolhidos, o mês, comparados. Forma com a Grade geral, a Escala do mês e o Efetivo por dia as quatro telas principais. A Minha escala (fase 7) é o caso de um militar só.
- **Piloto na 1ª SB:** um mês real montado no sistema novo, em paralelo com as planilhas, e comparado no fim.

**A decidir:**
- distribuições: onde se configura a ordem dos buracos do Pronto; o saldo que não cabe; se a cota limita as vagas; se a compulsória (RN-41, RN-43) entra já;
- documento: o modelo atual de impressão; só o Ordinário ou também as operações;
- Escala por militar: o que se compara, quantos militares, se escala ou só mostra, como se liga às outras telas. Hipótese: o uso é a permuta; se for, a tela pode ir junto com as permutas (fase 9).
- `ADM_CUMPRE_CARGA` existe em Configurações, mas nada o lê (o sistema age como desligado, o que bate com a RN-17: desligado, o Adm tira saldos e pode tirar PJES no expediente). Em aberto, sem prioridade (P-34): um segundo parâmetro para "cumpre 160h mas pode tirar PJES no expediente".
- A "prioridade" da cota ordena as operações na distribuição, mas não tem regra no catálogo; o usuário não sabe para que serve e talvez o campo saia (P-35, sem prioridade).

**Pendências técnicas para as distribuições** (achadas na revisão 3):
- `distribuirAdm` ignora as remoções quando a entrada vem sem `servico`;
- `turnosPadraoExigidos` não pede o B de D+1 num turno noturno de 24h;
- nomes de serviço e turno são comparados ora normalizados, ora pelo texto exato.

## Fase 9 — Operação diária · planejada

- Efetivo por dia na operação: operações do período das 08h de D às 08h de D+1, motoristas de serviço, presença e impressão.
- Permutas registradas (a Grade geral já trata a troca entre dois ordinários como permuta).
- **Busca por permutantes** (área pessoal): o militar escolhe um dia do mês e o sistema mostra quem está disponível para permutar com ele. Depende das specs de permutas, feitas no começo desta fase.
- Escala executada: gerar e enviar até o dia 5 do mês seguinte.

**Entrega:** o escalante passa o mês inteiro no sistema, do dia 1 ao envio da escala executada.

## Fase 10 — Regras novas · planejada

- Regras validadas no laboratório, na ordem em que forem aprovadas: operações por função (B38/RN-81), equilíbrio de situações boas e ruins na compulsória (RN-43), causas de não ativação.
- Tela de Ajuda com o roteiro do mês.
- A importação do Google Forms saiu do roadmap; volta só se o voluntariado marcado pelo próprio militar (fase 7) não pegar.

## Fase 11 — Institucionalização · planejada

- Estrutura acima do GB (CBMPE › DGO › Diretorias › GB), com o seletor de unidade.
- Escalas, guarnições e cotas em qualquer nível.
- Acesso por unidade acima do GB, com um gestor por nível.
- Tela de Histórico, sobre a auditoria que existe desde a fase 1.
- Antiguidade acima do GB, pelos almanaques.
- Servidor do Estado: cópia do banco, implantação, retirada do ambiente de teste. CPF e data de nascimento entram aqui (D7).

## Pendências conhecidas

Achadas nas revisões e nas validações. Nenhuma muda quem é escalado. Entram numa entrega quando houver oportunidade.

**Unidade de trabalho (6.2):**
- o vazio da Escala do mês não convida a escolher uma seção;
- "Alterar situação" com o 2º GB escolhido sugere o GB como destino para militar sem rastreio de hoje;
- o recuo do seletor é só visual (o leitor de tela não ouve o nível);
- papel só em unidade extinta cai em `/sem-lotacao` com um texto que não serve;
- trocar de unidade descarta `?mes=` e fecha a ficha;
- "Desativar acesso" aparece sem poder (dá 403);
- papel dado ou encerrado só aparece no seletor depois de recarregar.

**Contas e papéis (6.1):**
- "Encerrar" aparece num papel fora do alcance de quem vê a ficha (dá 403);
- os formulários "Dar papel" e "Encerrar" fecham mesmo com erro;
- a tela "Crie a sua senha" não tem "Sair";
- dar papel numa unidade extinta não é barrado;
- corrida teórica na regra do último gestor e na criação simultânea do usuário;
- a sessão é conferida duas vezes nas rotas de acesso;
- sem decisão: o administrador pode encerrar o próprio último papel de administrador; `/api/auth/change-password` continua aberto com a senha provisória.

**Com alocações gravadas:** mudar a letra de um turno com militares escalados não dá 409.

**API e importação:**
- unicidade de nome só na aplicação ("ABT" e "Abt" ao mesmo tempo);
- importação de guarnições não confere tamanhos de viatura, tipo e nomes;
- importação de CONFIGURAÇÕES e GUARNIÇÕES POR ESCALA grava mês passado que a tela recusa;
- CNH com categoria repetida; nome da aba precisa ser exato;
- número cru do Excel (data serial, matrícula com zero à esquerda) citado diferente do que a pessoa vê;
- milhares de linhas na importação fazem 2 a 3 consultas por linha.

**Site:**
- sessão expirada numa aba aberta há dias diz "Entre no sistema para continuar." sem dizer como;
- erro 4xx de consulta fica uns 7 s em "Carregando…";
- fechar o diálogo de criação descarta o que foi digitado sem perguntar;
- clique duplo em "Copiar" (cotas e feriados) troca a mensagem;
- menu do celular sem Esc e sem levar o foco;
- "Incluir serviço…" age já na mudança da lista;
- nomes acessíveis: X dos diálogos "Close", valores de mínimo e máximo, número da ordem;
- "1 escalas"; criar ou renomear função sem pendência nem trava;
- botão apagado sem explicar quando a consulta de postos ou tipos falha;
- regras repetidas no site (categorias de CNH, jornadas, expressão do mês);
- importação reaberta mostra o resultado anterior; linha de turno recriada quando o mesmo turno muda no servidor.

**Revisão final da revisão 3:**
- `useSincronizar` deixa o campo defasado se a pessoa desfaz a edição depois de dado novo do servidor;
- faltam testes de recarregamento sem pendência em Motorista, Identificação da escala, Identificação da guarnição e Serviços da escala;
- o erro genérico da confirmação da importação manda "enviar de novo" mesmo quando repetir não resolve;
- "está lotado na X" vale também para lotação só marcada para o futuro;
- a migração 0012 conta papéis encerrados e convites vencidos (só se corrige por SQL);
- a tela de falha das rotas sugere problema de conexão para qualquer erro e não leva o foco ao título.

**Motor e contratos:**
- ordem de antiguidade instável quando um lado não tem `ordem`;
- o tipo `Militar` aceita campo errado (`antiguidade` em vez de `antig`);
- o título padrão da escala pode passar de 120;
- horário digitado errado vira horário válido na importação de TURNOS;
- código repetido entre domínio e contratos (`mesVizinho`/`somarMeses`, `TurnoPadrao`, CNH, `proximoMes` sem uso);
- "hoje" calculado de três jeitos (`hojeRecife` na API, o navegador no site, `getFullYear` em feriados);
- testes que passariam com o código quebrado (`distribuicao-adm.test.ts`, `casos.test.ts`, `pre-escala.test.ts`, refine de serviço repetido);
- `postosDoModelo` devolve a lista do modelo, não uma cópia.

**Da entrega 4.3:**
- a mensagem 503 do aviso de migração traz comando de terminal e cita o banco de teste, e devolve os nomes dos arquivos de migração a quem não está logado;
- clicar numa categoria de CNH acesa só pela hierarquia a põe na carteira sem mudar a aparência;
- a recusa da troca diz quem não pode, mas não o que fazer;
- o teste das edições simultâneas do militar não prova a trava no banco em memória;
- a rolagem fixa da Grade só tem teste de classes; a conferência visual (computador e celular de 390 px) é da sandbox.

**Da entrega 4.4** (lista completa no PR #59):
- as colunas finais da Grade não têm largura fixa de verdade;
- "Desfazer" com a alocação promovida já removida diz "Os dados para desfazer não são desta seção." em vez de "a escala mudou desde então";
- faltam testes do "Desfazer" para promovida que mudou de vaga, de outra seção e corpo sem promovidas;
- a busca por matrícula compara com a pontuação;
- os botões "Escalar" têm o mesmo nome acessível;
- a aba ativa do "Adicionar serviço" pode ficar desabilitada depois de uma recusa (409);
- a conferência visual da rolagem (computador de 1440 px e celular de 390 px) e da largura da lista da vaga fica para a sandbox.

**Da entrega 4.5** (lista no PR #61):
- importar planilha com a sessão terminada não leva para entrar;
- um 401 com alteração não salva abre o aviso do navegador "Sair do site?";
- um pedido atendido logo depois do "Sair" pode levar a entrar com o aviso de sessão terminada;
- o aviso "Sua sessão terminou" pode não ser lido pelo leitor de tela;
- o texto do Voluntariado pode ser cortado num mês com muitas horas.

**Da entrega 4.6** (lista no PR #63):
- "Mês já passou" não diz qual chave ou escala é a linha;
- fechar a importação durante a confirmação: o erro que vier depois some, e uma segunda confirmação pode sair;
- pendência fantasma da função nova depois de "Remover"; o "Cancelar" da função nova não trava;
- "Não deu para carregar a lista" aparece também quando a lista já estava carregada e uma nova busca falha;
- 408 e 429 também não tentam de novo;
- um teste de configuração com '1/2031' quebra em fevereiro de 2031.

**Da entrega 4.7** (lista no PR #68):
- depois de salvar, se chegou dado novo do servidor durante a edição, o bloco mostra o valor da outra pessoa até a nova busca voltar;
- se o pedido de "Sair" nunca voltar, um 401 real só mostra "Sessão inválida." no bloco;
- "Mês já passou" mostra a chave técnica da configuração, não o rótulo.

**Da fase 5, entrega 1** (lista no PR #73):
- "Use o mês do período aberto ou um mês depois." não diz qual mês;
- o painel do dia mostra a etiqueta "CNH D" de quem está fora do quadro;
- "Sem a CNH exigida" engana para quem tem CNH fora do quadro ("Fora do quadro de motoristas" seria mais claro);
- no diálogo "Alterar situação", enquanto a lista de seções carrega, a opção provisória pode não bater com o valor enviado;
- a linha do tempo não mostra um intervalo sem período entre dois períodos;
- quem só tem período futuro aparece como "Sem lotação" na situação atual.

**Da fase 5, entregas 2 e 3** (listas nos PRs #79 e #80):
- **decisão do usuário pendente:** na importação do Pecúlio, célula vazia apaga o campo de quem já existe; alternativas: manter, manter com um resumo do que será apagado na prévia, ou exigir uma marca para apagar;
- **pergunta aberta:** "a faixa do serviço fica mais grossa" (lote de 21/11, entrega 4) — qual elemento;
- sem um usuário com papel no 2º GB, só o administrador cadastra militar, registra afastamento e importa o Pecúlio;
- o 400 do contrato vem antes do 403; e-mail com tab ou quebra de linha dá 500; o botão "Novo militar" aparece para quem não pode cadastrar; a validação do navegador fala antes da do contrato no e-mail;
- "Nome completo em falta" conta para todos os que já existiam, inclusive para quem não pode resolver;
- a solução "cadastre pela ficha" na importação de MILITARES aponta para algo que também exige o papel de cima; linha recusada ainda cria a equipe nova na prévia;
- siglas de unidade não são únicas (com outro GB que tenha "1ª SB", a importação pela raiz lotaria errado);
- militar sem período, importado pelo Pecúlio, não ganha rastreio nem aviso; antiguidade repetida não é conferida nessa importação;
- o escalante da seção vê o botão de importar o Pecúlio; aniversariantes incluem inativos; a lista do módulo não tem paginação.

**Da fase 5, entrega 4** (lista no PR #82):
- **texto a decidir:** o contador diz "Faltam 1" no singular (sugestão: "Falta 1");
- a marca da linha na Grade não chega às colunas PJES, Diárias e Voluntariado (presas à direita, em telas largas);
- no toque, o horário do trecho aparece por baixo da janela que o mesmo toque abre; no Safari do iPhone fica aceso até recarregar;
- a legenda da Grade, o quadrado de cor e a lista de cotas mostram a cor crua do serviço, e as células a ajustada (cores próximas podem não bater).

**Regras próprias por vaga** (pendentes desde a ordem de escala, 18/11/2026, sem fase): o graduado de dia é o mais antigo do dia (exceto Adm); o chefe é o mais antigo da guarnição.

**Validação das entregas 3.3 e 4:** o selo "ativada / não ativada" e o tom do aviso "Falta…" no Efetivo por dia.

## Fluxo de uma regra nova

1. A regra é catalogada (RN-XX) pela sessão REGRAS DE NEGÓCIO.
2. É prototipada no Apps Script e validada na sandbox pelo usuário.
3. Os casos validados viram casos compartilhados: `pnpm casos:gravar` e conferir o `git diff casos`.
4. O motor (`pacotes/dominio`) é ajustado até passar nos mesmos casos (`pnpm --filter dominio test`).
5. PR, revisão e merge com a anuência do usuário.

## Riscos

- **As telas da escala são a parte mais cara.** Por isso começaram só com o motor e os cadastros prontos.
- **Os dois sistemas podem divergir.** Os casos compartilhados são a defesa: nenhuma regra é portada sem eles.
- **Ambiente de teste gratuito:** pausa por inatividade e limites do plano (D2).
- **Dados pessoais numa nuvem comercial durante o teste:** D7, revista para o Pecúlio (sem CPF e sem ano de nascimento até o servidor do Estado).
- **O Pecúlio aumenta o escopo de uma seção para o GB inteiro:** 184 militares em nove lotações; o acesso por lotação (fase 6) precisa estar certo antes de o militar comum entrar.
- **A Grade geral não foi validada com o militar comum:** desde a 6.1, a sandbox pode ter auxiliar, gestor e militar comum (senha provisória); falta a VALIDAÇÃO refazer esses testes.
