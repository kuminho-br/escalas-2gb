# Regras — estados da escala, passado e visualização

Os estados da escala no mês, quem passa de um a outro, a alteração do passado, o registro e o que o militar vê (RN-85, RN-118 a RN-121).

Quem cuida: DOCUMENTAÇÃO. Escrito na segunda conferência, em 25/11/2026, com a fase 7 mesclada (entregas 7.3.1, 7.4 e 7.5). Índice e colunas: [LEIAME](LEIAME.md).

## Estados da escala

Cada escala, em cada mês, está num estado. O estado diz quem vê a escala e o que acontece quando ela muda.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-118 | Estados da escala de um mês e quem vê cada um. **Rascunho**: só quem monta vê (pelas camadas de visão, RN-133). **Prévia**: dá uma noção da distribuição e ainda pode mudar; vê quem está lotado na unidade da escala ou numa de baixo, e quem é de fora e está escalado nela no mês; ninguém acima vê sem nível de acesso. **Publicada**: a versão final esperada; toda a corporação vê. **Retificada**: republicada depois de uma correção. **Remessada**: cumprida e enviada aos superiores, para comprovar carga horária ou cotas. Na escala dos oficiais, a prévia só é vista pelos oficiais da unidade e das de baixo. | Confirmada | Funciona (7.3.1 a 7.5); o botão de remessa é da fase 9 | Base |
| RN-119 | Passagens entre os estados. O mês começa em rascunho. O escalante (ou o gestor) lança a prévia. **Só o gestor, o coordenador ou o administrador da unidade publica**, inclusive direto do rascunho, e republica. A primeira mudança numa escala publicada ou retificada a põe sozinha "em retificação": ela continua visível, com a etiqueta "Escala em retificação", até o gestor republicar; o escalante nunca é impedido de corrigir. A prévia muda à vontade, sem etiqueta. Não há volta da prévia para o rascunho. Depois de remessada, só o administrador altera. | Confirmada | Funciona (7.3.1 e 7.4): botões "Lançar prévia", "Publicar" e "Republicar" na Escala do mês | Suporte |

## Passado e registro

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-85 | **Passado é o turno que já começou** (a hora de início já conta). A trava não depende do estado da escala, e sim da data da mudança, exceto no rascunho, que não tem trava. Fora do rascunho, alterar um turno que já começou é só do gestor, do coordenador ou do administrador, com justificativa de pelo menos 10 letras ("Este turno já começou. Só o gestor altera o passado."). Numa escala remessada, qualquer turno só o administrador altera. A pré-escala gerada fora do rascunho só preenche os turnos que ainda não começaram. Exemplo do usuário: lançada no dia 25 do mês anterior e retificada no dia 3, o escalante altera do dia 4 em diante; o gestor também altera os três primeiros dias, com a necessidade demonstrada. Ficam fora da trava, por ora, o expediente sem escala e a rodada dos oficiais. | Confirmada | Funciona (7.3.1 e 7.4); responde a P-17 | Suporte |
| RN-120 | Toda exceção fica num registro: o valor antigo, o novo, quem alterou, quando e por quê. Vale para a alteração do passado (RN-85) e para a correção do voluntariado que o próprio militar marcou (RN-123). Só o militar comum não vê o registro. Ele aparece na Escala do mês ("Alterações no passado") e na página do voluntariado do militar. | Confirmada | Funciona (7.1, 7.3.1 e 7.4) | Suporte |

## Visualização

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-121 | O militar vê as escalas no módulo Visualização de escalas, só para leitura, sem os candidatos, as pendências e os botões da montagem. **Minha escala**: os próprios serviços do mês, cada um com o dia, o horário, o serviço, a escala, a unidade, o estado ("Pode mudar até o dia do serviço" na prévia; a etiqueta "Escala em retificação" quando for o caso) e a guarnição com quem a compõe (patente, nome de guerra e função). **Escalas**: as escalas que a pessoa pode ver no mês (RN-118), escolhendo a unidade pela árvore. O rascunho nunca aparece para o militar. | Confirmada | Funciona (7.5); a Escala por militar, que herda o desenho, é da fase 8 | Suporte |
