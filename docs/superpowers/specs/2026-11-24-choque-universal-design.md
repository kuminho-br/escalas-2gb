# Choque de horário universal, o expediente do Adm e a cota de saldo à vista — design

24/11/2026 · elucidação do domínio pelo usuário no mesmo dia (texto e formulário) · entregas 6.37 e 6.38, **antes da fase 7** · plano: `docs/superpowers/plans/2026-11-24-fase6-37-choque-universal.md`

## Por quê

O usuário, sobre o parâmetro "Adm cumpre a carga mensal": o militar do Adm tinha uma configuração que o deixava chocar horário com o expediente (tirar PJES no expediente), "mas na verdade ela não pode chocar em nenhuma condição, como todos os demais militares". A regra de choque de horário é **universal**. O parâmetro não é lido por nada e sai do domínio.

## A jornada (ontologia, confirmada em 24/11/2026)

- A **jornada** diz quando o militar está preso a uma obrigação. **Adm:** o serviço do tipo Adm (Expediente, 08h–16h) em todo dia útil; a pré-escala o põe ali. **Pronto:** os turnos da equipe.
- Fora da jornada o militar está **livre para extra**: no Adm, o fim de semana e o intervalo das 16h às 8h.
- Ninguém está em dois lugares ao mesmo tempo, e o expediente conta como um lugar.
- A exceção não é da jornada, é do **serviço**: um serviço configurado para isso (o Saldo) pode **tirar o militar do expediente** daquele dia; um extra (JES) não pode.
- **Em aberto:** como a jornada muda o funcionamento das equipes do militar (pergunta P-36).

## Decisões do usuário (24/11/2026)

1. Choque é choque para todos, sem exceção; sai o parâmetro "Adm cumpre a carga mensal" (`ADM_CUMPRE_CARGA`).
2. O choque **trava** a alocação. Na escolha do militar da vaga, quem está em choque aparece com o serviço que choca e um botão para **tirar de lá e escalar aqui**, com alerta e confirmação.
3. Esse botão só vale quando o serviço que choca está numa escala da **mesma unidade ou de uma de baixo** de quem escala; num ramo de cima ou num ramo isolado (unidade irmã), não: só o motivo aparece.
4. O cadastro do serviço ganha uma opção: **"Pode tirar o militar do Adm do expediente"**. Lançar esse serviço no horário do expediente **continua sendo choque**, mas o botão da decisão 2 consegue tirar o militar do expediente do dia e pôr o serviço por cima. Ligada no Saldo; desligada no JES (que é extra) e nos demais.
5. A **cota de saldo do Adm à vista**: uma barra na frente da matrícula dos militares do Adm, que enche conforme os saldos do mês são alocados, na escolha do militar da vaga, na placa da Escala do mês e na Grade geral; e, na visão da escala, perto da etiqueta do Saldo, em número ("2/6").
6. Automação (fase 8): o sistema escala o Adm em todos os dias úteis no expediente; os saldos e os JES são lançados à mão. Sai a distribuição automática de saldos.

## Escolhas da PLANEJAMENTO

- **O expediente continua implícito** enquanto não houver a pré-escala do Adm (fase 8): todo dia útil, para todo militar com jornada Adm, como hoje nas conferências. O expediente do dia **some quando há, no mesmo horário, um serviço com a opção ligada** (hoje o motor faz isso pelo nome "Saldo"; passa a ser pela opção do serviço). Assim, "tirar do expediente" é lançar o serviço por cima depois da confirmação, e tirar o serviço depois devolve o expediente, sem tabela nova. Quando a pré-escala do Adm lançar o expediente de verdade, isso vira a remoção dessa alocação.
- **Choque em todas as unidades:** a conferência de choque olha as alocações do militar em qualquer unidade, não só na da escala (a 6.33 já fazia isso para o externo).
- **"Tirar de lá e escalar aqui"** é uma operação só (as duas coisas ou nenhuma). O aviso depois tem "Desfazer", que desfaz as duas (a remoção devolvível da 6.21). Confirmação: "{patente} {nome} está em {serviço}, {dia} das {início} às {fim} ({escala}). Tirar de lá e escalar aqui?". Para o expediente: "{patente} {nome} está de expediente em {dia}. Tirar do expediente e escalar em {serviço}?".
- **Quem pode:** quem pode escalar na escala de destino e também na escala de onde o militar sai (mesma unidade ou de baixo, decisão 3). O expediente é da lotação do militar: tirá-lo do expediente pede poder na lotação dele.
- **A barra:** total = o parâmetro "Saldos por militar do Adm" (RN-18, hoje 6) do mês; enche com os saldos alocados ao militar no mês, em qualquer escala. Passou do total: a barra fica cheia em âmbar e o número diz ("7/6"); não trava. Leitor de tela: "{n} de {total} saldos no mês". Na placa da Escala do mês, o número "2/6" fica ao lado da etiqueta do Saldo; a barra vai na lista de candidatos e na Grade geral.
- **Saldo no turno A, hoje:** dispensava o expediente sozinho, sem perguntar (RN-25, RN-91). Passa a aparecer como choque na escolha do militar, resolvido pelo botão com confirmação (decisão 4). Os Saldos já gravados continuam valendo, sem migração de dados: o expediente sob eles continua sumindo pelo cálculo.
- **O que a entrega muda para o escalante, em resumo:** o JES, o PJES e o ordinário deixam de passar no expediente do Adm (antes só a Diária era barrada); o Saldo pede confirmação; o choque com uma escala de outra unidade passa a aparecer.

## Não objetivos

- A pré-escala do Adm no expediente (fase 8, automação).
- As regras de descanso da Portaria 314 (fase 10).
- Como a jornada muda as equipes (P-36).

## Anti-objetivos

- Um militar em dois lugares ao mesmo tempo, por qualquer caminho (escolha, troca, importação, desfazer).
- Tirar alguém de uma escala de um ramo de cima ou isolado.
- Tirar de lá sem pôr aqui (ou o contrário) quando a gravação falha no meio.

## Entregas

- **6.37 — choque universal (com migração):** sai o parâmetro; o serviço ganha a opção; o choque olha todas as unidades e o expediente sem exceção; as regras e os testes do motor.
- **6.38 — resolver o choque e a cota de saldo à vista:** o botão na escolha do militar, a confirmação, o "Desfazer" das duas coisas; a barra e o número da cota de saldo.
