# Pendências conhecidas

Achadas nas revisões e nas validações, ainda sem entrega. Quem cuida: PLANEJAMENTO. Saíram do roadmap em 24/11/2026, para ele ficar só com o mapa das fases. Quando uma pendência vira entrega e é mesclada, sai daqui.

Nenhuma muda quem é escalado. As que já podem ser feitas viraram as entregas 6.15 a 6.18, e saem daqui quando cada uma for mesclada.

**Rastreio por dia (6.5)** (PR #104): Grade sem choque na virada do período; período só futuro = "Sem lotação".

**Escala dos oficiais (P1.3)** (lista no PR #102): a tela não recarrega após um 409; o item "Oficiais" não olha o papel na unidade escolhida; o diálogo de troca e as células com pouca informação para o leitor de tela; pequenas diferenças do mockup.

**Tela inicial e módulos (6.3):**
- a ficha aberta pelo Pecúlio aparece dentro da tela Militares, e clicar na lista perde o `?de`;
- com a senha provisória pendente, `GET /api/eu/ficha` responde e `PATCH /api/eu/telefone` dá 401 (o certo seria 403 com orientação);
- o auxiliar não consegue desativar de novo um colega já desativado (dá 403);
- `?aviso=outro-papel` reaparece ao recarregar.

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
- dado novo do servidor durante a edição aparece até a nova busca; "Sair" sem resposta mostra só "Sessão inválida."; "Mês já passou" mostra a chave técnica.

**Da fase 5, entrega 1** (lista no PR #73):
- "Use o mês do período aberto ou um mês depois." não diz qual mês;
- o painel do dia mostra a etiqueta "CNH D" de quem está fora do quadro;
- "Sem a CNH exigida" engana para quem tem CNH fora do quadro ("Fora do quadro de motoristas" seria mais claro);
- no diálogo "Alterar situação", enquanto a lista de seções carrega, a opção provisória pode não bater com o valor enviado;
- a linha do tempo não mostra o intervalo entre dois períodos.

**Da fase 5, entregas 2 e 3** (listas nos PRs #79 e #80):
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
- a marca da linha não chega às colunas fixas da Grade; no toque, o horário fica por baixo da janela (aceso no iPhone);
- a legenda e as cotas mostram a cor crua do serviço, e as células a ajustada.

**Regras próprias por vaga** (pendentes desde a ordem de escala, 18/11/2026, sem fase): o graduado de dia é o mais antigo do dia (exceto Adm); o chefe é o mais antigo da guarnição.

**Validação das entregas 3.3 e 4:** o selo "ativada" e o tom do "Falta…" no Efetivo por dia.
