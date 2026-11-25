# Regras — escala dos oficiais

A escala dos oficiais como escala comum: quem participa, a cota de saldo, os momentos do mês, o saldo de cada oficial, os dias vermelhos e o memorial de cálculo (RN-117, RN-125 a RN-131).

Quem cuida: DOCUMENTAÇÃO. Escrito na segunda conferência, em 25/11/2026, a partir das specs `superpowers/specs/2026-11-22-escala-dos-oficiais-design.md` e `2026-11-23-oficiais-escala-comum-design.md` e das entregas P1, 6.22 a 6.30 e 6.44. Índice e colunas: [LEIAME](LEIAME.md).

A jornada dos oficiais (choque com o expediente) está na RN-17 e na RN-19, com a pendência P-37.

## A escala e quem participa

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-125 | A escala dos oficiais é uma escala comum, cadastrada em Escalas, com a distribuição "rodada de cotas" (as outras usam a pré-escala). Os serviços são cadastro do usuário (hoje JES e Saldo, sem Pronto). Cada dia tem um lugar por letra de turno (hoje dia e noite, um oficial por turno), preenchido por um lançamento de JES ou de Saldo; o horário vem do turno daquele serviço. Os lançamentos são alocações como as das outras escalas e contam para o choque (RN-23). | Confirmada | Funciona (6.27 e 6.28) | Base |
| RN-126 | São elegíveis os militares dos quadros QOC e QOA lotados na unidade da escala ou nas de baixo, nunca nas de cima. O gestor escolhe, entre eles, quem participa da rodada do mês; o mês novo vem com os participantes do anterior. As telas de escala das praças mostram só o QBMG e quem está sem quadro (RN-137). | Confirmada | Funciona (P1.5 e 6.29.1) | Base |
| RN-130 | A ordem de antiguidade (o mais antigo escolhe primeiro) é sugerida, não trava: a tela destaca de quem é a vez, e o escalante lança para qualquer participante, com o aviso "Fora da ordem: a vez era de …". A antiguidade dá a ordem de escolha, não a quantidade. | Confirmada | Funciona (6.27 e 6.29.2) | Suporte |

## Cota de saldo e momentos do mês

"Cota", aqui, não é a cota de PJES e diárias das operações (RN-33): é quantos turnos de Saldo cada oficial deve tirar no mês.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-127 | O JES é lançado à mão, primeiro. Os lugares que sobram formam a cota de saldo, rateada pela presença: presença = dias do mês em que o oficial participa e não está afastado ÷ dias do mês (todo tipo de afastamento reduz); devido = lugares × presença ÷ soma das presenças; cota = devido arredondado para baixo. A sobra do arredondamento é entregue um a um, do mais moderno para o mais antigo. Afastado não tira serviço nos dias do afastamento. Lançar ou tirar um JES refaz as cotas. Por ora, o saldo acumulado (RN-129) aparece, mas não entra na conta. | Confirmada | Funciona (P1.2 e 6.27); o saldo entrar na cota espera decisão do usuário | Automação |
| RN-128 | Três momentos do mês. **Abrir o mês**: antes dele, as cotas não mudam; depois, mudam sozinhas quando muda a participação, um afastamento ou um JES. **Fechar a escala**: as escolhas estão feitas; trocar o nome num turno passa a ser uma cobertura, e o registro guarda quem saiu e quem cobriu. **Encerrar o mês**: o saldo do mês é calculado e somado ao acumulado; depois disso, só ajuste manual, com motivo, no registro. | Confirmada | Funciona (P1.3 e 6.27): a linha de processo do mês com a ação do próximo passo | Suporte |
| RN-131 | Memorial de cálculo: cada recálculo das cotas guarda o motivo, quem fez e a conta. O memorial tem aba própria, imprimível, com os serviços do mês; a frase das sobras lista os nomes do mais moderno para o mais antigo, a ordem em que a sobra é entregue. A conta do mês aparece também no painel recolhível "Como as cotas foram calculadas". | Confirmada | Funciona (6.29.1, 6.30 e 6.44) | Suporte |

## Saldo e dias vermelhos

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-129 | O saldo de um oficial é o que ele tirou menos o que devia tirar, somado mês a mês; tem casas decimais, pode ser negativo e nunca é zerado. Casos: o arredondamento e o afastamento deixam a parte quebrada no saldo; numa cobertura, **quem cobre ganha e quem sai não deve**; o turno que fica sem ninguém não conta para ninguém (o devido é refeito sobre os turnos tirados); o oficial que entra depois começa com a média exata dos saldos de quem já está; o que sai fica com o saldo guardado e parado, e retoma se voltar; afastamento lançado depois do mês encerrado vira ajuste manual. A soma dos saldos não é zero, porque cada cobertura acrescenta um turno. A permuta, na fase 9. | Confirmada | Funciona (P1.2 e P1.3): Painel de saldo, com a evolução mês a mês e a contagem de turnos de dia e de noite | Ambas |
| RN-117 | O **dia vermelho** é um dia ruim, que ninguém quer tirar. O escalante marca enquanto o mês não está encerrado; todos têm o mesmo peso e não mudam a cota. Só conta quando o lugar é de serviço do **tipo ordinário** (o Saldo): JES, PJES e Diária são extra e pagam a mais, então não contam. Vale para a contagem do mês e para o acumulado dos meses encerrados; o tipo do serviço decide, não o nome. Nasce nos oficiais, e o modelo, ligado à escala, serve depois às outras escalas. (Decisão de 24/11/2026.) | Confirmada | Funciona (6.28 e 6.44): coluna "Vermelhos" da escala e Painel de saldo | Suporte |
