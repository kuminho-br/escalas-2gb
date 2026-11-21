# Regras — carga horária, Adm, pré-escala e choques

Carga horária e saldos, expediente do Adm, pré-escala, choques de horário (RN-15 a RN-20, RN-22 a RN-26, RN-44, RN-84, RN-85, RN-91, RN-112, RN-113).

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026. Índice e colunas: [LEIAME](LEIAME.md).

## Carga horária e saldos

O Pronto cumpre 160h por mês; o Adm hoje cumpre só a cota de saldos, 6 por militar. Os três números são parâmetros em Configurações, com vigência, valendo para a unidade e as de baixo.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-15 | A carga mensal do Pronto é o parâmetro "Carga mensal (horas)" (hoje 160h), não fixa no código. | Confirmada | Parâmetro existe; quem o usa são as distribuições (fase 8) | Ambas |
| RN-16 | JES e diárias não contam na carga horária. Exceção: o voluntário escalado de forma compulsória por não ter marcado voluntariado (RN-41) tem essa escala abatida da carga padrão; o valor do abatimento é parâmetro. | Confirmada | Fase 8 | Ambas |
| RN-17 | Pela portaria, o Adm tem expediente das 08h às 16h, cumpre 160h por mês e não tira serviço extra no horário do expediente. Na prática, o Adm reforça o operacional com saldos e, em troca, pode tirar PJES (ex.: JES) mesmo quando choca com o expediente. O parâmetro "Adm cumpre a carga mensal" escolhe entre os dois: ligado, vale a portaria (carga de 160h, nenhum extra no horário do expediente); desligado, vale a prática (o Adm tira saldos e pode tirar PJES no horário do expediente). Hoje desligado. Se é preciso separar a carga da liberação do PJES está em aberto (P-34), sem prioridade agora. | A esclarecer | Parâmetro existe; nada o lê ainda (fase 8): o sistema age como se estivesse desligado | Ambas |
| RN-18 | A quantidade de saldos por militar do Adm no mês é parâmetro; padrão 6. | Confirmada | Parâmetro existe; quem o usa é a distribuição de saldos (fase 8) | Ambas |

## Expediente do Adm

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-19 | O Adm está de expediente todo dia útil; o expediente nunca cai em fim de semana ou feriado. | Confirmada | Funciona (expediente implícito nas conferências) | Ambas |
| RN-20 | A distribuição automática do expediente do Adm é só uma pré-escala: equaliza a carga entre os militares do Adm e ao longo da semana. Só se aplica quando o Adm cumpre as 160h (RN-17 ligada). | Confirmada | No motor (`distribuirAdm`); fase 8 | Automação |
| RN-91 | Na escala automática do Adm, o militar é lançado em todo dia útil; se no dia ele tiver Saldo no turno A, o expediente sai do dia dele, para não dar choque. | Confirmada | No motor; fase 8 | Automação |

## Pré-escala

A pré-escala é uma sugestão automática que o escalante sempre revisa.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-22 | A pré-escala do Pronto segue o rodízio das equipes do ciclo (Alfa, Bravo, Charlie, Delta). A equipe do dia 1 é descoberta pelo Pronto dos últimos dias do mês anterior. | Confirmada | Funciona (pré-escala do Pronto, entrega 3.1) | Automação |
| RN-44 | Na situação padrão, o Pronto emenda os turnos A e B: das 08h do dia D às 08h do dia D+1. | Confirmada | Funciona (pré-escala do Pronto) | Base |
| RN-84 | A pré-escala é um guia, não a escala final: depois dela o escalante altera o que quiser, e as alterações passam pelas mesmas regras de alocação. | Confirmada | Funciona | Ambas |
| RN-113 | Gerar a pré-escala de novo não sobrescreve o que já está escalado: só completa as lacunas. | Confirmada | Funciona | Automação |
| RN-112 | Gerar de novo não devolve um militar a um dia e turno de onde o escalante o tirou. A remoção vale para o militar (militar, dia, serviço, turno), não para a vaga. Pôr o militar de volta à mão apaga a remoção. | Confirmada | Funciona | Automação |
| RN-85 | Dias de hoje em diante se alteram livremente; os passados ficam travados, porque o serviço já aconteceu. Falta definir que correções continuam permitidas no passado (P-17). | A esclarecer | Não existe hoje: escalar e trocar aceitam qualquer data (ligado à publicação, fase 7) | Suporte |

## Choques e encadeamento de serviços

Por ora a validação obrigatória é impedir choque de horário; as regras de descanso da Portaria 314 ficam para depois.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-23 | Um militar não pode ter dois serviços com horários sobrepostos. O acúmulo de funções (RN-104) não é choque: é o mesmo turno. | Confirmada | Funciona (lista "Escolher militar", gravação e troca) | Ambas |
| RN-24 | O militar não pode tirar JES e emendar com Pronto; pode tirar Pronto e emendar com JES. | Confirmada | Funciona | Ambas |
| RN-25 | O Adm não pode tirar diária no horário do expediente em dia útil (janela do turno do serviço Expediente, hoje 08h–16h). Só os serviços do tipo Diária são impedidos; PJES e Ordinário não. Vale quando a RN-17 está desligada. Um Saldo no mesmo horário dispensa o expediente do dia. | Confirmada | Funciona, sempre: o sistema ainda não lê a RN-17 | Ambas |
| RN-26 | As regras de descanso e de bloco da Portaria do Comando Geral nº 314/2025 serão aplicadas no futuro (RN-57, RN-58). | Confirmada | Fase 10 | Ambas |
