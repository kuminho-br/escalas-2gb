# Escala dos oficiais como escala comum — design

23/11/2026 · pedido do usuário no mesmo dia · plano em `docs/superpowers/plans/2026-11-23-fase6-27-oficiais-escala-comum.md` (entregas 6.27 e 6.28) · atualiza `2026-11-22-escala-dos-oficiais-design.md`

## Por quê

O usuário: "A escala dos oficiais é montada como qualquer outra escala. A estrutura por trás dela é a mesma." Hoje ela tem tabelas próprias: o mês escolhe **um serviço** (a tela tem o campo "Serviço"), os turnos vêm dele, e cada lançamento vai para uma tabela à parte, que o resto do sistema não enxerga. A escala dos oficiais do usuário tem dois serviços, JES e Saldo, e o que se escala é a escala, não um serviço.

## Decisões do usuário (23/11/2026)

1. A escala dos oficiais é uma escala cadastrada em Escalas, com os seus serviços (hoje JES e Saldo, sem Pronto).
2. Os turnos de **JES** são lançados à mão pelo escalante, primeiro. **O que sobra** é distribuído pelo esquema de cotas de hoje, e cada turno dessa distribuição é **Saldo**: a cota dos oficiais é uma cota de saldo.
3. "Cota" aqui não é a "Cota" das operações.
4. A ordem de antiguidade é sugerida: o sistema conduz, não trava.
5. Botão **"Abrir o mês"**: antes dele as cotas não mudam; depois dele, mudam sozinhas quando a participação ou um afastamento muda. Sai o "Calcular cotas".
6. **Dias vermelhos:** dias ruins, que ninguém quer tirar. O escalante marca ao abrir o mês; todos têm o mesmo peso; o sistema conta quantos cada oficial tirou. Nasce nos oficiais, mas serve para outras escalas depois.
7. **Defeito:** mudar a antiguidade não reordena quem já está marcado em "Participa"; hoje é preciso desmarcar e marcar.
8. Sai a aba "Regras" do alto: o botão "Regras" já está à direita.
9. O usuário delegou à PLANEJAMENTO o caminho de montagem e a divisão em entregas ("modo acelerado").

## Escolhas da PLANEJAMENTO

- **Caminho: unificar de verdade.** Cada lançamento vira uma **alocação comum** (escala, serviço, turno, dia, militar), como na Escala do mês. O que é próprio da rodada (mês aberto, participantes, ordem, cota de saldo, dias vermelhos, saldo e coberturas) fica nas tabelas `oficiais_*`, ligadas à escala e não mais a um serviço. Motivo: é o que o usuário descreveu, e os turnos dos oficiais passam a existir para o resto do sistema (Efetivo, a futura Minha escala, as permutas da fase 9). A alternativa (só trocar o serviço do mês pela escala) mantinha a estrutura diferente.
- **Que escala é "dos oficiais":** a escala ganha o jeito de distribuir, `distribuicao`: `pre_escala` (as de hoje) ou `rodada_de_cotas`. A tela Oficiais escolhe, no lugar do "Serviço", uma das escalas da unidade com `rodada_de_cotas`. O campo aparece no cadastro da escala, em Escalas.
- **Os turnos do mês:** cada dia tem um lugar por letra de turno das escalas (dia e noite, hoje). O lugar é preenchido por um lançamento de JES ou de Saldo; o horário vem do turno daquele serviço.
- **Origem da alocação:** JES lançado à mão = `manual`; Saldo da rodada = `distribuicao`.
- **Cota de saldo:** calculada como hoje sobre os lugares que sobram depois dos de JES. Lançar ou tirar um JES, com o mês aberto, refaz as cotas (como a participação).
- **Nome na tela:** o painel "Cotas" passa a "Cota de saldo".
- **Antiguidade sugerida:** o cartão "Vez de escolher" continua e já vem escolhido no lançamento, mas o escalante pode lançar para qualquer participante; a tela avisa "Fora da ordem: a vez era de {patente nome}." sem impedir.
- **Telas de praças:** continuam mostrando só QBMG (decisão de 22/11); as alocações dos oficiais não aparecem na Grade nem na Escala do mês das praças.
- **Dias vermelhos:** marcados e desmarcados enquanto o mês não está encerrado; contam por oficial no mês (no painel) e no acumulado (no Painel de saldo); não mudam a cota.
- **Mês já existente:** a migração cria, para cada unidade com mês de oficiais gravado, a escala "Oficiais de operações" com o serviço que o mês usava e `rodada_de_cotas`, e passa os lançamentos de hoje para alocações, com as coberturas.

## Não objetivos

- O saldo entrar na conta da cota (versão seguinte, como já estava).
- Peso diferente entre dias vermelhos, ou cota de dias vermelhos.
- Dias vermelhos nas outras escalas (o modelo já nasce ligado à escala, para servir depois).
- Permutas (fase 9).

## Anti-objetivos

- Perder lançamentos, coberturas ou saldo dos meses já gravados.
- A cota mudar sozinha antes de "Abrir o mês" ou depois de "Fechar a escala".
- O sistema impedir o escalante de lançar fora da ordem.

## Entregas

- **6.27 — a escala dos oficiais como escala comum** (migração): o modelo novo, JES à mão e Saldo pela rodada, "Abrir o mês" com cotas automáticas, ordem sugerida, defeito da ordem.
- **6.28 — dias vermelhos e acabamento:** dias vermelhos, "Cota de saldo", sai a aba "Regras".
