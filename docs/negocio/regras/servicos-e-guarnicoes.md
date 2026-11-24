# Regras — serviços, escalas e guarnições

Serviços e escalas, modelos de guarnição, meta de ativação, ordem de escalação e acúmulo (RN-01 a RN-13, RN-81, RN-83, RN-92 a RN-96, RN-100, RN-102 a RN-104, RN-108 a RN-111).

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026. Índice e colunas: [LEIAME](LEIAME.md).

## Serviços e escalas

Serviço é de onde vem a hora (Pronto, JES, Saldo, diária, PJES); escala é o agrupamento de serviços que guarnecem os mesmos modelos de guarnição. No sistema novo os dois são cadastros da seção (telas Serviços e Escalas).

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-01 | Serviços, turnos, horários e durações são cadastro do usuário; tipos e serviços novos são criados sem mudar o código. | Confirmada | Funciona (tela Serviços) | Base |
| RN-02 | Onde o sistema mostra um serviço escalado, mostra o nome do serviço, na cor dele, e o horário (ex.: etiqueta "Bioma" com "08h–16h"). O tipo (Ordinário, PJES, Diária) não aparece; só serve a documentos e relatórios. | Confirmada | Funciona (Escala do mês, Efetivo por dia, Grade geral) | Base |
| RN-03 | O serviço Saldo só pode ser tirado por militar do Adm. A automação não lança Saldo para quem não é do Adm, e a escolha do militar não o oferece. | Confirmada | Funciona (lista "Escolher militar" e gravação) | Ambas |
| RN-04 | As diárias são mandadas pelas cotas: cada cota corresponde a 1 militar num turno (20 cotas = 20 alocações). Só tira diária quem marcou voluntariado no horário (o escalante pode contornar, RN-48); não precisa do atributo "voluntário JES". | Confirmada | Funciona | Base |
| RN-05 | Serviço extraordinário externo é o que vem de uma cota de origem externa: os militares tiram, mas não conta na cota da SB (RN-35). | Confirmada | Funciona (origem da cota) | Base |
| RN-83 | Serviço e turno são cadastros separados: o serviço guarda nome, tipo, cor e seus turnos; cada turno guarda início e fim. Os turnos de um serviço declaram em que janelas ele pode ocorrer, não um horário fixo. Não existe turno único: o serviço de um turno só usa o A. A diária é o próprio serviço; não há campo "operação". | Confirmada | Funciona | Base |
| RN-111 | Pronto, Saldo, JES e Expediente são serviços fixos: o sistema os cria em cada seção, e o usuário não muda nome, tipo nem os exclui. Horários, cor e vínculo com escalas ficam livres. Diárias e PJES são cadastro livre; a regra delas vem do tipo. | Confirmada | Funciona | Base |
| RN-09 | A escala diz quais modelos de guarnição cada faixa de horário guarnece. O vínculo é escala × faixa de horário → modelo, nunca serviço × turno; serviços com a mesma faixa dividem o vínculo. Mudar o horário de um turno deixa órfãos os vínculos da faixa antiga, e a ficha avisa. | Confirmada | Funciona (ficha da escala) | Ambas |
| RN-100 | A demanda é da escala, não de cada serviço: todos os serviços de uma escala contribuem com horas para preencher as mesmas guarnições (ex.: o Ordinário agrupa Pronto, JES e Saldo). Atributos de publicação (título, militares e dias exibidos) pertencem à escala. | Confirmada | Funciona | Base |

Exemplo: os serviços da 1ª SB na planilha do protótipo (15/11/2026). No sistema novo a fonte é a tela Serviços.

| Tipo | Serviço | Turnos |
|---|---|---|
| Ordinário | Pronto | A 08–20, B 20–08 |
| Ordinário | Adm (Expediente) | A 08–16 |
| Ordinário | Saldo | A 08–20, B 20–08 |
| PJES | JES | A 08–20, B 20–08 |
| PJES | Defensoria | A 07–19 |
| PJES | CPRH | A 08–20 |
| Diária | Bioma, PE Seguro | A 00–08, B 08–16, C 16–00 |
| Diária | Eleições | A 07–15, B 15–23 |

## Modelos de guarnição

O modelo de guarnição é o molde do posto operacional: funções com mínimo, máximo e CNH. Fica em Configurações › Modelos de guarnição, com versões por mês. A guarnição do dia é o modelo que ganhou militares num dia.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-10 | Cada função do modelo tem um mínimo; abaixo dele a guarnição não é ativada (RN-109). Há outras causas de não ativação, ainda não catalogadas (viatura indisponível, a operação não ocorre no dia); a lista será cadastrável. | Confirmada | Funciona o mínimo; as causas, fase 10 | Ambas |
| RN-11 | Cada função tem um máximo; acima dele não se aloca mais ninguém. Máximo vazio vale o mínimo; não existe "sem limite". | Confirmada | Funciona | Ambas |
| RN-12 | A CNH é do militar, esteja ou não no quadro de motoristas. Para a escala, a função que exige CNH só aceita militar do quadro de motoristas com a categoria exigida ou outra que a habilite, com ou sem viatura. Hierarquia do CTB, fixa no código: A é isolada; B habilita B; C habilita C e B; D habilita D, C e B; E habilita E, D, C e B. Na ficha marca-se a carteira; as habilitadas aparecem marcadas, mas só a carteira é gravada. | Confirmada | Funciona | Ambas |
| RN-93 | Mínimos e máximos de cada modelo, e o vínculo da escala com os modelos, valem por mês (versões). Mudar a partir de um mês não mexe nos meses anteriores. | Confirmada | Funciona | Base |
| RN-94 | As funções são um catálogo da unidade, não fixo no código; renomear uma função muda o nome em todos os modelos. Funções podem exigir requisitos (CNH) e ter militares escassos. "Motorista 12H" não é função: é o motorista comum num serviço de 12h. | Confirmada | Funciona | Base |
| RN-96 | O Apoio Operacional Aquartelado é guarnição obrigatória do Ordinário: na escala real de outubro/2026, sempre 1 motorista ACO, 2 despachantes e 1 adjunto de dia, preenchidos por militares de origens variadas (Pronto, Saldo, PJES). Existe sem viatura, e a CNH exigida continua valendo. | Confirmada | Funciona (é um modelo cadastrado) | Base |
| RN-81 | Cada turno de uma operação tem vagas por função, vindas do modelo de guarnição que a escala vincula naquela faixa (ex.: PE Seguro: motorista, chefe e 2 socorristas; Defensoria: chefe e auxiliar). | Confirmada | Funciona a composição pelo modelo; as operações por função ainda estão para validar (fase 10) | Base |

## Meta de ativação

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-108 | A meta de ativação é a lista de modelos de guarnição que devem sair num dia, com a ordem de ativação (qual pesa mais quando falta gente). Vale por dia, não por turno. Todo dia nasce com a meta padrão do nível (Configurações); o escalante muda um dia na própria tela (desativar, reativar, adicionar, mover), e o dia pode voltar ao padrão sem desescalar ninguém. Mudar a meta padrão vale dali em diante. Cada nível define a sua meta padrão com os seus modelos: ela não é herdada do nível de cima. | Confirmada | Funciona (Efetivo por dia) | Ambas |
| RN-109 | A guarnição só conta como ativada se fechar ao longo de todo o serviço: cada função obrigatória com o mínimo em todos os momentos dos horários em que o modelo está vinculado no dia. Conta o horário coberto, não cabeças por turno: dois militares de turnos menores fecham a função de um turno maior. O mesmo modelo em duas escalas no mesmo dia é uma guarnição só. | Confirmada | Funciona | Ambas |
| RN-110 | Guarnição escalada fora da meta aparece no painel, depois das da meta, sem contar para ela. Escalar alguém nela não a põe na meta. Desativar uma guarnição tira o militar só dela; se ele acumulava em outra, o acúmulo vira a vaga dele. | Confirmada | Funciona | Suporte |
| RN-07 | O usuário define quais guarnições devem ser ativadas (quantidade e tipo). | Substituída por RN-108 | — | Automação |
| RN-08 | O usuário define a ordem de prioridade de ativação das guarnições, no cadastro da guarnição. | Substituída por RN-102 e RN-108 | A prioridade antiga só vale como ordem padrão da escala sem ordem de escalação | Automação |

## Ordem de escalação, alocação e acúmulo

Ordem de ativação e ordem de escalação são coisas diferentes: uma guarnição ser mais importante não quer dizer que todos os militares dela entram antes. A relação entre as duas está adiada (decisão do usuário, 20/11/2026).

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-102 | Cada escala tem uma ordem de escalação: a sequência em que cada vaga (modelo + função + nº da vaga) é preenchida, inclusive as vagas extras, uma a uma. Vale por mês. Vaga nova fora da ordem é avisada ("Falta: …") e preenchida depois de todas as da ordem. Sem ordem cadastrada, vale a prioridade antiga das guarnições. | Confirmada | Em parte: a tela Ordem de escalação funciona e dá a ordem das vagas na tela; a pré-escala não a usa desde a 6.40; fica para a automação (fase 8) | Automação |
| RN-103 | Na vez de cada vaga, a distribuição automática nas guarnições põe o mais antigo apto. Só os requisitos filtram (CNH, unidade, afastamento, voluntariado, choque). A vaga não tem critério próprio; regras próprias por vaga (graduado de dia, chefe da guarnição) ficam para se a prática pedir. | Confirmada | Não vale hoje: desde a 6.40 a pré-escala só põe nos turnos (RN-22); fica para a automação (fase 8) | Automação |
| RN-13 | A alocação para atingir a meta segue a ordem: ordinário do Pronto, depois JES do Pronto, depois Saldo do Adm. | Confirmada | Em parte: a pré-escala põe o Pronto nos turnos, sem as vagas (6.40); o JES do Pronto, fase 8; o Saldo é lançado à mão (a distribuição automática de saldos saiu do plano em 24/11/2026) | Automação |
| RN-92 | Depois dos mínimos, o efetivo restante completa as guarnições até o máximo, guarnição por guarnição. | Substituída por RN-102 | As vagas extras têm a vez delas na ordem de escalação | Automação |
| RN-104 | Acúmulo de funções: numa vaga vazia, o escalante pode pôr um militar já escalado na mesma faixa da mesma escala, inclusive em outra guarnição. Valem os requisitos da vaga (a CNH é conferida de novo). Horas e serviço contam uma vez; a vaga acumulada conta como preenchida, com a marca "acumula com …". Não há limite de vagas acumuladas. Remover o militar da vaga original remove também os acúmulos dele na faixa (o sistema pergunta antes). A automação nunca acumula. | Confirmada | Funciona (Escala do mês e Efetivo por dia) | Suporte |
