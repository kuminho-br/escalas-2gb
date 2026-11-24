# Regras — carga horária, Adm, pré-escala e choques

Carga horária e saldos, expediente do Adm, pré-escala, choques de horário (RN-15 a RN-20, RN-22 a RN-26, RN-44, RN-84, RN-85, RN-91, RN-112, RN-113).

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026. Índice e colunas: [LEIAME](LEIAME.md).

## Carga horária e saldos

O Pronto cumpre 160h por mês; o Adm hoje cumpre só a cota de saldos, 6 por militar. Os números são parâmetros em Configurações, com vigência, valendo para a unidade e as de baixo.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-15 | A carga mensal do Pronto é o parâmetro "Carga mensal (horas)" (hoje 160h), não fixa no código. | Confirmada | Parâmetro existe; quem o usa são as distribuições (fase 8) | Ambas |
| RN-16 | JES e diárias não contam na carga horária. Exceção: o voluntário escalado de forma compulsória por não ter marcado voluntariado (RN-41) tem essa escala abatida da carga padrão; o valor do abatimento é parâmetro. | Confirmada | Fase 8 | Ambas |
| RN-17 | Pela portaria, o Adm tem expediente das 08h às 16h e não tira serviço extra no horário do expediente. Na prática, o Adm reforça o operacional com saldos. A regra vale para todos, sem configuração: o militar do Adm não tira nenhum serviço (Pronto, JES, PJES, Diária) no horário do expediente em dia útil. A única exceção é de um **serviço**, e não do militar: o serviço cadastrado com "Pode tirar o militar do Adm do expediente" (hoje o Saldo) pode, depois de o escalante confirmar, tirá-lo do expediente do dia (RN-25). O parâmetro "Adm cumpre a carga mensal" saiu do sistema em 24/11/2026 (decisão do usuário). | Confirmada | Funciona (6.37): o parâmetro saiu e o choque vale para todos; a opção é do cadastro do serviço | Ambas |
| RN-18 | A quantidade de saldos por militar do Adm no mês é parâmetro; padrão 6. | Confirmada | Parâmetro existe; quem o usa é a distribuição de saldos (fase 8) | Ambas |

## Expediente do Adm

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-19 | O Adm está de expediente todo dia útil; o expediente nunca cai em fim de semana ou feriado. | Confirmada | Funciona (expediente implícito nas conferências) | Ambas |
| RN-20 | A pré-escala também lança o expediente do Adm: uma alocação do serviço Expediente, **sem escala**, em cada dia útil, para cada militar lotado na unidade com jornada Adm no período que vale no dia (QBMG e sem quadro; o expediente dos oficiais espera a jornada deles ser elucidada). Não vai no fim de semana, no feriado da unidade nem no de uma unidade de cima, no dia de afastamento nem no dia em que o militar já tem, no horário do expediente, um serviço que tira do expediente (o Saldo). Os saldos e os JES do Adm são lançados à mão; a distribuição automática de saldos saiu do plano (decisão de 24/11/2026). O expediente lançado só o torna visível (Grade e painel do dia); o calculado continua valendo para o choque, e só um serviço com "Pode tirar o militar do Adm do expediente" libera o militar (RN-25). | Confirmada | Funciona (6.40): um botão só, "Pré-escala", gera o Pronto e o expediente; a unidade sem o serviço Expediente gera só o Pronto e avisa | Automação |
| RN-91 | Na pré-escala, o militar do Adm é lançado no expediente em todo dia útil (RN-20). Se no dia ele tiver um serviço que pode tirar do expediente (o Saldo) no mesmo horário, o expediente sai do dia dele e o serviço ocupa o lugar. | Confirmada | Funciona (6.40): o expediente lançado e o calculado somem sob o Saldo | Automação |

## Pré-escala

A pré-escala é uma sugestão automática que o escalante sempre revisa.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-22 | A pré-escala do Pronto segue o rodízio das equipes do ciclo (Alfa, Bravo, Charlie, Delta). A equipe do dia 1 é descoberta pelo Pronto dos últimos dias do mês anterior. A pré-escala põe a equipe do dia **no turno do Pronto, sem guarnição e sem função**: o escalante move cada um para uma vaga depois, à mão (na escolha do militar da vaga, quem já está no turno aparece primeiro, e escolhê-lo move a alocação dele; o "Desfazer" o devolve ao turno). A distribuição nas guarnições fica para a automação da fase 8, se o usuário quiser. | Confirmada | Funciona (pré-escala, entrega 3.1; só nos turnos desde a 6.40) | Automação |
| RN-44 | Na situação padrão, o Pronto emenda os turnos A e B: das 08h do dia D às 08h do dia D+1. | Confirmada | Funciona (pré-escala do Pronto) | Base |
| RN-84 | A pré-escala é um guia, não a escala final: depois dela o escalante altera o que quiser, e as alterações passam pelas mesmas regras de alocação. | Confirmada | Funciona | Ambas |
| RN-113 | Gerar a pré-escala de novo não sobrescreve o que já está escalado: só completa as lacunas (no Pronto e no expediente). | Confirmada | Funciona | Automação |
| RN-112 | Gerar de novo não devolve um militar a um dia e turno de onde o escalante o tirou. A remoção vale para o militar (militar, dia, serviço, turno), não para a vaga; vale também para o expediente. Pôr o militar de volta à mão apaga a remoção. | Confirmada | Funciona | Automação |
| RN-85 | Dias de hoje em diante se alteram livremente; os passados ficam travados, porque o serviço já aconteceu. Falta definir que correções continuam permitidas no passado (P-17). | A esclarecer | Não existe hoje: escalar e trocar aceitam qualquer data (ligado à publicação, fase 7) | Suporte |

## Choques e encadeamento de serviços

Por ora a validação obrigatória é impedir choque de horário; as regras de descanso da Portaria 314 ficam para depois.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-23 | Um militar não pode ter dois serviços com horários sobrepostos, em nenhuma unidade (o choque olha as alocações dele em todas) e sem exceção por jornada. O expediente do Adm conta como um serviço. O acúmulo de funções (RN-104) não é choque: é o mesmo turno. O choque trava a alocação, não o fechamento da escala. | Confirmada | Funciona (6.37): lista "Escolher militar", gravação, troca e Grade geral, em todas as unidades | Ambas |
| RN-24 | O militar não pode tirar JES e emendar com Pronto; pode tirar Pronto e emendar com JES. | Confirmada | Funciona | Ambas |
| RN-25 | O serviço do Adm no horário do expediente em dia útil (janela do turno do serviço Expediente, hoje 08h–16h) é choque, qualquer que seja o tipo do serviço. O serviço cadastrado com a opção "Pode tirar o militar do Adm do expediente" (hoje o Saldo) continua sendo choque ao ser lançado, mas o escalante pode decidir tirar o militar do expediente do dia e pôr o serviço por cima, com alerta e confirmação (6.38). Um Saldo já lançado sobre o expediente tira o expediente do dia: não há choque. O JES e os demais serviços não têm a opção. | Confirmada | Funciona (6.37): o motivo é "De expediente neste dia"; a decisão com confirmação é da 6.38 | Ambas |
| RN-26 | As regras de descanso e de bloco da Portaria do Comando Geral nº 314/2025 serão aplicadas no futuro (RN-57, RN-58). | Confirmada | Fase 10 | Ambas |
