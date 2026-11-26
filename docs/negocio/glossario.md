# Glossário — Sistema de Gestão - 2º GB

Os termos do domínio na linguagem do sistema novo. Quem cuida: DOCUMENTAÇÃO. Reescrito na segunda conferência, em 25/11/2026 (`main` depois da 7.5); a versão do protótipo, colhida do claude.ai em 20/11/2026, fica no git. Perguntas em aberto: [glossario-pendencias.md](glossario-pendencias.md). As regras citadas estão no [catálogo](regras/LEIAME.md).

## Como ler

- **Situação:** `Em uso` (já está no sistema), `Fase N` (definido, entra na fase N do roadmap) ou `Em aberto (Gx)` (falta confirmar; a pergunta está nas pendências).
- Na tela, diz-se **escala** (nunca "matriz"), **nível de acesso** (nunca "papel"), **patente** na placa do militar (posto ou graduação, sem "BM") e **ADM** para a jornada administrativa.
- Princípio (usuário, 14/11/2026): o sistema deixa o usuário cadastrar, em vez de copiar o modelo atual da escala real. A escala real serve para conferir se o cadastro comporta a realidade.

## Unidades e acesso

| Termo | Definição | Situação |
|---|---|---|
| Árvore de unidades | A estrutura da corporação, da raiz (CBMPE) às seções, editável pela tela Estrutura. Toda unidade se comporta igual, qualquer que seja o tipo (RN-134). | Em uso |
| Unidade | Um nó da árvore: sigla, nome, tipo, unidade de cima, início e fim. A sigla não se repete entre irmãs. Com histórico, é extinta, não apagada. | Em uso |
| Tipo de unidade | Só um nome (Corporação, Grupamento, Divisão, Seção…), num cadastro do administrador. Nenhuma regra depende dele. | Em uso |
| GB | Grupamento de Bombeiros. O uso começa pelo 2º GB; os outros, na fase 11 (RN-27). | Em uso |
| Divisão | Unidade entre o grupamento e as seções: DA (Divisão Administrativa) e DivOp (Divisão Operacional). Conta como unidade acima das suas seções. | Em uso |
| SB | Seção do GB (1ª a 7ª SB). O piloto é a 1ª SB. | Em uso; a sigla, Em aberto (G1) |
| SP | A seção de pessoal: quem tem nível de acesso numa unidade acima da lotação do militar e, por isso, cuida da ficha dele no Pecúlio (RN-135). | Em uso |
| Nível de acesso | O que a pessoa edita: administrador, coordenador, gestor ou auxiliar administrativo, dado numa unidade, válido nela e nas de baixo, por período (RN-115). | Em uso |
| Administrador | Nível dado na raiz, válido em toda a árvore; cuida dos catálogos do sistema. Continua sendo um militar como os outros. | Em uso |
| Coordenador | O quinto nível: edita como o gestor na sua unidade e abaixo, e vê as unidades irmãs. Nome técnico `gestor_lateral`. | Em uso |
| Gestor | Nível de quem chefia a unidade no sistema: o que o auxiliar faz, mais publicar a escala, alterar o passado, abrir a coleta, trazer o externo, a meta padrão e dar níveis. | Em uso |
| Auxiliar administrativo | Nome, na tela, do nível de quem monta a escala. Nos textos de ajuda, é **o escalante**; no banco, `escalante`. | Em uso |
| Militar comum | Quem não tem nível de acesso vigente. Vê o que é dele, a consulta e as escalas que o estado permite. | Em uso |
| Camada de visão | De onde vem o direito de **ver** o que a pessoa não edita: todos, oficial e coordenador. As camadas se somam (RN-133). | Em uso |
| Borda | A tabela de Configurações › Quem vê o quê: que bloco da ficha (Identificação, Contato, Situação…) cada camada vê. | Em uso |
| Módulo | Cartão da tela inicial: Confecção de escalas, Visualização de escalas, Pecúlio, Estrutura, Configurações e Minha ficha. | Em uso |
| Senha provisória | Senha gerada na ficha do militar para o primeiro acesso: aparece uma vez, vale 7 dias e só serve para criar a senha (RS-08). | Em uso |

## O militar

| Termo | Definição | Situação |
|---|---|---|
| Militar | Pessoa do cadastro, identificada pela matrícula. Todo usuário é um militar. | Em uso |
| Matrícula | O identificador do militar. Não diz se o militar é de teste (a faixa `990xxx-x` é de militares reais); no banco, quem diz é a marca `de_teste`. | Em uso |
| Pecúlio | A ficha do militar e o módulo que cuida dela; é a origem dos dados do militar (RN-135). A planilha do Pecúlio importa tudo, e só a matrícula é obrigatória. | Em uso |
| Ficha da escala | A ficha do militar vista no módulo de escalas: a seção edita só as Habilitações e vê o resto. A ficha completa fica no Pecúlio. | Em uso |
| Posto/graduação (patente) | O posto do oficial ou a graduação da praça. Dá a primeira ordem de antiguidade; sigla e nome editáveis pelo administrador. | Em uso |
| Antiguidade | A "Ordem" do Pecúlio, o lugar no ranking do GB. As listas vão do mais antigo ao mais moderno: posto, depois a antiguidade (RN-101, RN-116). | Em uso |
| Quadro | QOC, QOA ou QBMG; todo militar tem um. Os quadros "de oficiais" (QOC e QOA) dão a camada de visão do oficial e a escala dos oficiais (RN-137). | Em uso |
| Rastreio | O histórico do militar por período: lotação, equipe, jornada, quadro e situação. A escala de um dia usa o período daquele dia (RN-136). | Em uso |
| Lotação | Só a unidade em que o militar está, em qualquer ponto da árvore. | Em uso |
| Situação do militar | Ativa, Reserva, Agregado, Adido…: catálogo com "pode ser escalado". Não é o tipo de afastamento. | Em uso |
| Afastamento | Período em que o militar não é escalado: tipo (Férias, LTS, Curso, Adido, Agregado, L.E, DTS, Outro), início e fim, motivo curto (sem diagnóstico) e boletim. | Em uso; os tipos do normativo, Em aberto (G4) |
| Jornada | O regime do militar no período: Pronto ou ADM. | Em uso |
| Pronto | Efetivo operacional, em equipes de 24 h de serviço por 72 h de folga. Na situação padrão emenda os turnos A e B: 08h do dia D às 08h de D+1 (RN-44). | Em uso |
| ADM | Efetivo administrativo, de expediente em dia útil (hoje 08h às 16h). Por ora, o oficial segue a mesma jornada (P-37). | Em uso |
| Equipe | Grupo do Pronto (Alfa, Bravo, Charlie, Delta), da unidade. Vazia para o ADM. O militar externo aparece na equipe "Externo". | Em uso |
| Ciclo de equipes | Uma equipe por dia, em rodízio. A equipe do dia 1 vem dos últimos dias do mês anterior (RN-22). | Em uso |
| Habilitações | Bloco da ficha com o quadro de motoristas e a CNH; o único que a seção edita (RN-12). | Em uso |
| Quadro de motoristas | Marca de quem dirige para a escala. A CNH só vale para a escala com o militar no quadro. | Em uso |
| CNH | A carteira do militar (A a E). Hierarquia do CTB, fixa no código: A é isolada; C habilita B; D habilita C e B; E habilita D, C e B. | Em uso |
| Voluntário JES | Atributo do militar, editado só pela SP. Sem ele, o militar não é escalado em JES nem em PJES, nem à mão (RN-46). | Em uso |
| Militar externo | Militar de outra unidade trazido pelo gestor para tirar serviço aqui, sem mudar a lotação, até alguém tirar (RN-32). | Em uso |

## Serviços e turnos

| Termo | Definição | Situação |
|---|---|---|
| Serviço | De onde vem a hora: Pronto, Expediente, Saldo, JES, as diárias e os PJES. Cadastro da unidade, com nome, tipo, cor e turnos (RN-01, RN-83). | Em uso |
| Serviço fixo | Pronto, Saldo, JES e Expediente: o sistema os cria em cada unidade, e o usuário não muda o nome nem o tipo (RN-111). | Em uso |
| Tipo de serviço | Ordinário, PJES ou Diária. Decide regras (o dia vermelho, o voluntário JES), mas não aparece na marca da escala (RN-02). | Em uso |
| Turno | Letra (A, B, C) com início e fim, dentro de um serviço. A mesma letra tem horários diferentes em serviços diferentes. | Em uso |
| Ordinário | Tipo do serviço regular: Pronto, Expediente e Saldo. | Em uso |
| Expediente | O serviço do ADM em dia útil. A pré-escala o lança, sem escala; o expediente calculado conta para o choque (RN-19, RN-20). | Em uso |
| Saldo | Serviço ordinário em que um militar do ADM cobre um turno do Pronto; só o ADM tira (RN-03). Pode tirar o militar do expediente do dia, com confirmação (RN-25). Na escala dos oficiais, é o serviço da cota de saldo. Não confundir com o saldo do oficial. | Em uso |
| Cota de saldo do ADM | Quantos saldos cada militar do ADM deve tirar no mês (parâmetro, padrão 6), mostrada numa barra ("2/6") que não trava (RN-18). | Em uso |
| PJES | Tipo dos serviços extras de jornada especial: JES, Defensoria, CPRH… Exige o voluntário JES. | Em uso; a sigla, Em aberto (G2) |
| JES | Serviço do tipo PJES de 12 h (A 08–20, B 20–08). Não conta na carga horária (RN-16). | Em uso |
| Diária | Serviço extra pago por cota, em geral de 8 h (Bioma, PE Seguro, Eleições). Uma por dia, pela data de início do turno (RN-36); não exige o voluntário JES (RN-04). A diária é o próprio serviço: não há campo "operação". | Em uso |
| Dobradinha | Duas diárias de dias diferentes emendadas (16h–00h do dia D e 00h–08h de D+1). É permitida (RN-37). | Em uso |

## Escalas e montagem

| Termo | Definição | Situação |
|---|---|---|
| Escala | Agrupamento de serviços que guarnecem os mesmos modelos de guarnição (ex.: o Ordinário agrupa Pronto, JES e Saldo). A demanda é da escala (RN-100). | Em uso |
| Distribuição da escala | Como a escala é preenchida: pela pré-escala (as escalas de praças) ou pela rodada de cotas (a escala dos oficiais). | Em uso |
| Alocação | Um militar num serviço e turno numa data, com guarnição e função quando ocupa uma vaga. | Em uso |
| Modelo de guarnição | O molde de um posto operacional: funções com mínimo, máximo e CNH, com versões por mês (RN-10, RN-11, RN-93). | Em uso |
| Guarnição | O modelo que ganhou militares num dia. Só conta como ativada se cada função tem o mínimo em todo o horário (RN-109). | Em uso |
| Vaga | Um lugar de uma função num modelo (modelo + função + nº da vaga). | Em uso |
| Função | O que o militar faz na vaga (chefe, motorista, socorrista…). Catálogo da unidade (RN-94). Não confundir com a função do militar no Pecúlio. | Em uso |
| Meta de ativação | A lista dos modelos que devem sair num dia, com a ordem de ativação. Nasce da meta padrão do nível e muda por dia (RN-108). | Em uso |
| Ordem de escalação | A sequência das vagas, por escala e mês. A tela existe; quem a usará é a automação da fase 8 (RN-102). | Fase 8 |
| Acúmulo | Um militar já escalado na faixa ocupando também outra vaga vazia, com a marca "acumula com …" (RN-104). | Em uso |
| Pré-escala | A sugestão automática do mês: põe a equipe do dia nos turnos do Pronto e o ADM no expediente; o escalante distribui nas vagas à mão. Gerar de novo só completa lacunas e respeita as remoções (RN-22, RN-112, RN-113). | Em uso |
| Choque | Dois serviços do mesmo militar com horários sobrepostos, em qualquer unidade; o expediente conta. Trava a alocação, não o fechamento da escala (RN-23). | Em uso |
| Emenda | Serviço que começa quando outro termina. JES seguido de Pronto é proibido; Pronto seguido de JES é permitido (RN-24). | Em uso |
| Carga horária mensal | 160 h do Pronto no mês, parâmetro (RN-15); quem a usa são as distribuições. | Fase 8 |
| Escala do mês | Tela de montagem de uma escala, dia a dia, com um cartão por guarnição em cada turno. | Em uso |
| Efetivo por dia | Tela do dia: a meta de ativação e as guarnições ativadas. | Em uso |
| Grade geral | Tela de todos os militares no mês, com a marca de cada dia (a cor é o serviço, a letra é o turno). | Em uso |
| Escala por militar | Tela de militares escolhidos, comparados no mês. | Fase 8 |
| Permuta | Troca de serviço entre um par de militares, no mesmo mês, aprovada pelo chefe fora do sistema (RN-86 a RN-88). | Fase 9 |

## Cotas e voluntariado

| Termo | Definição | Situação |
|---|---|---|
| Cota | Quantas vezes se pode escalar militares num serviço extra (PJES ou diária) num mês; a unidade é obrigada a executá-la. Cada vaga preenchida consome uma (RN-33, RN-82). Não confundir com a cota de saldo. | Em uso |
| Origem da cota | Interna ou externa. A externa os militares tiram, mas não conta na cota da unidade (RN-34, RN-35). | Em uso |
| Cota restante | Quantidade do mês menos as alocações no serviço ("JES: restam 26 de 40") (RN-114). | Em uso |
| Voluntariado | Em que faixas de horário de cada dia o militar aceita tirar JES e diárias, por mês. É do militar e vale em todas as seções que o escalam (RN-105, RN-124). | Em uso |
| Bloco do dia | Faixa de horário pronta para marcar, vinda dos turnos dos serviços que pedem voluntariado (RN-107). | Em uso |
| Outro horário | Botão do dia para marcar faixas fora dos blocos. | Em uso |
| Coleta | O período em que o militar pode marcar o próprio voluntariado de um mês, aberto e fechado pelo gestor da unidade (RN-122). | Em uso |
| Fase voluntária e compulsória | Os extras vão primeiro a quem marcou voluntariado, depois de forma compulsória, até cumprir as cotas (RN-40, RN-41). | Fase 8 |
| Situação boa ou ruim | A qualidade de um serviço pela combinação com os outros do militar, para equilibrar a compulsória (RN-42, RN-43). | Fase 10 |

## Estados da escala

| Termo | Definição | Situação |
|---|---|---|
| Rascunho | A escala em começo, que só quem monta vê. Não tem trava do passado. | Em uso |
| Prévia | A escala mostrada à unidade e às de baixo; ainda pode mudar. | Em uso |
| Publicada | A versão final esperada, vista por toda a corporação. Só o gestor publica. | Em uso |
| Escala em retificação | Etiqueta da escala publicada que mudou e ainda não foi republicada; ela continua visível. | Em uso |
| Retificada | A escala republicada depois de uma correção. | Em uso |
| Remessada | A escala cumprida e enviada aos superiores; só o administrador a altera. | O estado, Em uso; a remessa, Fase 9 |
| Passado | O turno que já começou. Fora do rascunho, só o gestor o altera, com justificativa (RN-85). | Em uso |
| Registro de alteração | O valor antigo, o novo, quem, quando e por quê, de cada exceção: o passado e a correção do voluntariado (RN-120). | Em uso |
| Minha escala | Os próprios serviços do militar no mês, com quem compõe a guarnição (RN-121). | Em uso |
| Escala executada | A escala como foi cumprida, enviada até o dia 5 do mês seguinte. | Fase 9 |

## Escala dos oficiais

| Termo | Definição | Situação |
|---|---|---|
| Rodada de cotas | O jeito de distribuir da escala dos oficiais: JES à mão, o resto em Saldo pela cota de saldo (RN-125, RN-127). | Em uso |
| Elegível e participante | Elegível é o oficial (QOC ou QOA) da unidade ou de baixo; participante é quem o gestor escolhe para o mês (RN-126). | Em uso |
| Cota de saldo (oficiais) | Quantos turnos de Saldo cada oficial deve tirar no mês: o devido arredondado para baixo, com a sobra do mais moderno para o mais antigo. | Em uso |
| Presença e devido | Presença: a parte do mês em que o oficial participa sem afastamento. Devido: os lugares do mês na proporção da presença, com casas decimais. | Em uso |
| Abrir o mês, fechar a escala, encerrar o mês | Os três momentos do mês dos oficiais (RN-128). | Em uso |
| Cobertura | Troca de nome num turno depois de fechada a escala: quem cobre ganha, quem sai não deve. | Em uso |
| Saldo do oficial | O que ele tirou menos o que devia, acumulado entre os meses; pode ser negativo (RN-129). Não é o serviço Saldo. | Em uso |
| Dia vermelho | Dia ruim, que ninguém quer tirar, marcado pelo escalante; conta só no serviço ordinário (RN-117). | Em uso |
| Memorial de cálculo | O registro de cada recálculo das cotas: motivo, quem e a conta (RN-131). | Em uso |

## Configurações

| Termo | Definição | Situação |
|---|---|---|
| Parâmetro | Valor que muda com o tempo (carga mensal, saldos do ADM, flexibilidade do voluntariado…), com vigência, válido na unidade e nas de baixo; a mais próxima vence (RN-28). | Em uso |
| Vigência | O mês a partir do qual um valor vale. Mês passado é recusado. | Em uso |
| Feriado | Data da unidade (ou de uma de cima) que tira o dia do expediente. | Em uso; pontos facultativos, Em aberto (G5) |
| Dia útil | Dia que não é sábado, domingo nem feriado. | Em uso |
| Normativos | A Portaria do Comando Geral nº 314/2025 e o Decreto nº 46.331/2018. As regras tiradas deles (RN-52 a RN-80) aguardam validação (P-15). | Em uso |
| Regra (RN) e requisito (RS) | A regra de negócio vale mesmo sem sistema; o requisito é o que o sistema oferece para cumpri-la. IDs nunca reaproveitados. | Em uso |
| Barreiras | Suporte: o sistema ajuda o escalante a não errar. Automação: o sistema faz sozinho. Base: o cadastro que sustenta as duas. A automação nunca impede o escalante de fechar a escala. | Em uso |
