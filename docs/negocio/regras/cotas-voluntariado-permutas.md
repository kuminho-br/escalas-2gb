# Regras — cotas, voluntariado e permutas

Cotas de PJES e diárias, voluntariado por faixa de horário, distribuição dos extras, situações boas e ruins, permutas (RN-33 a RN-43, RN-45 a RN-48, RN-82, RN-86 a RN-90, RN-105 a RN-107, RN-114, RN-117).

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026. Índice e colunas: [LEIAME](LEIAME.md).

## Cotas de PJES e diárias

A SB recebe cotas de PJES e diárias e é obrigada a executá-las. Cota é o limite mensal de quantas vezes se pode escalar militares num serviço.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-33 | A SB recebe cotas de PJES e diárias, serviços extras além da carga normal, e é obrigada a executá-las. A cota diz quanto serviço extra há num mês, numa SB; não caracteriza o serviço. | Confirmada | Funciona (tela Cotas) | Ambas |
| RN-34 | Cotas externas são serviços que os militares precisam tirar, mas que não entram na cota original da SB. | Confirmada | Funciona | Ambas |
| RN-35 | Cada cota tem mês, SB, serviço (PJES ou diária), quantidade e origem (interna ou externa). A origem é da cota, não do serviço. A cota aponta direto para o serviço; cota de serviço desativado é recusada. | Confirmada | Funciona | Base |
| RN-82 | Cada vaga preenchida (1 militar em 1 turno do serviço) consome 1 cota. | Confirmada | Funciona (na conta das cotas restantes) | Base |
| RN-114 | Cota restante = quantidade da cota do mês − alocações do mês naquele serviço, somando as origens interna e externa. Aparece como "JES: restam 26 de 40" na Escala do mês (cotas dos serviços da escala) e no Efetivo por dia (cotas da seção). | Confirmada | Funciona | Suporte |
| RN-36 | O militar só tira uma diária por dia, contando pela data de início do turno. | Confirmada | Funciona | Ambas |
| RN-37 | Duas diárias em dias diferentes podem ser emendadas (ex.: 16h–00h do dia D + 00h–08h do dia D+1): é a dobradinha, e vale para Pronto e Adm. | Confirmada | Funciona (não é barrada) | Ambas |
| RN-89 | Cumprir as cotas internas vale mais que as externas: quando não dá para atender todas, o sistema preenche primeiro as internas. | Confirmada | Fase 8 | Automação |

## Voluntariado

O voluntariado diz em que horários o militar aceita tirar PJES e diárias. No sistema novo ele é marcado por faixa de horário: hoje o escalante lança; na fase 7, o próprio militar marca.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-39 | O voluntariado é mensal: a cada mês, o militar diz quando pretende tirar JES e diárias. Lançar substitui o mês inteiro daquele militar. | Confirmada | Funciona (lançado pelo escalante); o próprio militar marca na fase 7 | Base |
| RN-105 | O voluntariado é marcado por faixas de horário de cada dia (00h a 24h), não por turno. Um turno vale para o militar se toda a duração estiver coberta; o turno que passa da meia-noite usa o dia seguinte (o Pronto B do dia 5 pede 20h–24h do dia 5 e 00h–08h do dia 6). | Confirmada | Funciona | Base |
| RN-106 | Flexibilidade do voluntariado: parâmetro em horas cheias (0 a 3, padrão 0), em qualquer nível. Com N horas, também fica apto quem deixa até N horas sem cobrir no começo ou no fim do turno; buraco no meio continua barrando. Vale para a lista "Escolher militar" e para a pré-escala (hoje sem efeito nela: a única pré-escala é a do Pronto, que não pede voluntariado). Não afrouxa choque, descanso nem as outras regras. | Confirmada | Funciona | Ambas |
| RN-107 | Os blocos do dia, na tela do voluntariado, vêm dos horários dos turnos dos serviços que pedem voluntariado (PJES e diária, ativos), nas escalas marcadas para montar os blocos. Por padrão, todas entram. | Confirmada | Funciona | Base |
| RN-47 | O militar escolhe o dia e o turno no formulário mensal. | Substituída por RN-105 | — | Base |
| RN-46 | O cadastro do militar tem o atributo "voluntário JES" (sim/não). Só é escalado em JES e PJES quem o tem, inclusive à mão: o sistema bloqueia. Diária não exige o atributo (RN-04). | Confirmada | Funciona | Ambas |
| RN-48 | O escalante pode escalar à mão quem não marcou voluntariado naquele horário, porque combina direto com o militar: a lista mostra esses militares num grupo à parte ("Mostrar"). Só o voluntariado é contornável; as outras regras e o atributo "voluntário JES" continuam valendo. A pré-escala nunca escala quem está fora do voluntariado. | Confirmada | Funciona | Suporte |

## Distribuição dos extras

A escala é montada em três etapas: serviços do Pronto, depois JES do Pronto, depois JES do Adm. Os extras são alocados primeiro entre os voluntários e depois de forma compulsória, até cumprir as cotas. O motor já tem essa distribuição (`distribuirCotas`); falta ligá-la às vagas (fase 8).

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-38 | A montagem segue a ordem: serviços do Pronto, depois JES do Pronto, depois JES do Adm. | Confirmada | Em parte: a pré-escala põe o Pronto nos turnos (6.40); o JES do Pronto, fase 8; o JES do Adm é lançado à mão (a automação dele saiu do plano em 24/11/2026) | Automação |
| RN-40 | Os extras são alocados em duas fases: primeiro a voluntária, respeitando o voluntariado; depois a compulsória, para completar as cotas. | Confirmada | No motor; fase 8 | Automação |
| RN-41 | O voluntário que não marcou voluntariado no mês ainda pode ser escalado de forma compulsória; nesse caso a escala abate a carga padrão dele (RN-16). | Confirmada | No motor; fase 8 (se a compulsória entra já está a decidir) | Automação |
| RN-42 | Na fase compulsória, o sistema equilibra entre os militares as situações boas e ruins que cada um tira. | Confirmada | No motor, só como desempate; o equilíbrio completo, fase 10 | Ambas |
| RN-90 | Funções mais difíceis ou específicas dão preferência a quem as cumpre na distribuição dos extras. Falta definir quais e que preferência (P-18). | A esclarecer | — | Automação |

## Situações boas e ruins

Um serviço é bom ou ruim conforme se encaixa na escala individual do militar, não só pelo serviço em si.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-43 | A qualidade de um serviço é avaliada pela combinação com os demais serviços do militar. Ideia de peso (sem catálogo completo, P-11): −1 para uma vantagem recebida, +1 para uma desvantagem; ser motorista é desvantagem grande (ex.: −3). Quanto mais negativo o saldo, mais preferência na próxima alocação. | Confirmada | Fase 10 | Ambas |
| RN-45 | Existem situações boas e ruins também para o Adm; ainda não levantadas (P-12). | A esclarecer | — | Ambas |
| RN-117 | Na escala dos oficiais, o **dia vermelho** (dia ruim que ninguém quer tirar, marcado pelo escalante, todos com o mesmo peso) só conta quando o lugar é de serviço do **tipo ordinário** (o Saldo). JES, PJES e Diária são extra e pagam a mais, então não contam. Vale para a contagem do mês e para o acumulado dos meses encerrados; o tipo do serviço decide, não o nome. (Decisão de 24/11/2026.) | Confirmada | Funciona (6.44): coluna "Vermelhos" da escala e Painel de saldo | Suporte |

Catálogo de situações (inicial):

| ID | Situação | Composição | Classificação | Jornada |
|---|---|---|---|---|
| S-01 | Dobradinha | Diária 16h–00h (D) + diária 00h–08h (D+1) | Boa | Pronto e Adm |
| S-02 | Saída do Pronto com diária | Pronto 08h (D) → 08h (D+1) + diária 08h–16h (D+1) | Boa | Pronto |

## Permutas

Depois de ver a escala, o militar pode pedir para trocar de serviço com outro. A aprovação é do Chefe, fora do sistema.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-86 | A permuta é sempre entre um par: os dois militares e os dois serviços ficam registrados juntos, e as duas pontas mudam na mesma operação. | Confirmada | Em parte: a Grade geral troca dois ordinários numa transação só, mas ainda não grava a troca como permuta (tabela `permuta` sem uso); o registro é da fase 9. A troca recusa quem tem acúmulo ("Tire os acúmulos antes de trocar") | Base |
| RN-87 | Não há permuta entre serviços de meses diferentes. O limite é parâmetro, porque pode mudar. | Confirmada | Fase 9 | Base |
| RN-88 | O sistema registra só a troca já aprovada pelo Chefe. A permuta só é aceita se a escala resultante respeitar as regras de alocação (choque, voluntário JES, uma diária por dia), e não depende de o dia já ter passado. | Confirmada | Em parte: a troca da Grade geral passa pelas regras; fase 9 | Ambas |
