# Glossário — pendências e divergências

Perguntas em aberto sobre os termos do [glossário](glossario.md). Quem cuida: DOCUMENTAÇÃO. Revisto na segunda conferência, em 25/11/2026: as perguntas que ainda valem ganharam números novos (G1 a G9), e as respondidas ou que eram só do protótipo saíram (abaixo). O texto antigo fica no git.

## Em aberto

Perguntas para levar aos escalantes. Ao responder, a resposta vai para o termo, e a linha sai daqui.

| Nº | Termo | Pergunta | Era |
|---|---|---|---|
| G1 | SB | Qual é o significado da sigla? | P1 |
| G2 | PJES, JES | Qual é o significado das siglas? | P2 |
| G3 | Escala ordinária e extraordinária | O sistema não usa os dois termos: usa o tipo do serviço (Ordinário, PJES, Diária). Os documentos oficiais usam? Se sim, o critério é o tipo do serviço? | P5 |
| G4 | Afastamento | Os tipos do normativo (licenças, LTS, RTS; RN-52) entram todos no catálogo? Hoje todo afastamento tira o militar de qualquer serviço; vale assim para todos os tipos? | P10 |
| G5 | Feriado | Os pontos facultativos (Carnaval, Corpus Christi) contam como feriado para o expediente do ADM? | P13 |
| G6 | Modelo de guarnição | A sigla é ABT ou ABTS? O que significam ABT, AR, ACO e UT? | P7 |
| G7 | Saldo | O "Adm hipotecado" do normativo (RN-69, RN-71) é o mesmo que o Saldo do ADM? | P21 |
| G8 | Modelo de guarnição | INCÊNDIO, PRÉ-HOSPITALAR e SALVAMENTO, blocos do documento oficial, são modelos de guarnição ou outra coisa? O usuário citou de passagem (14/11/2026) as guarnições aquartelado, incêndio, APH e salvamento. | P25 |
| G9 | Serviço | O serviço tem um "rótulo de impressão", herdeiro da coluna ORIGEM do protótipo (o rótulo depois da função no documento: "MOTORISTA - PJES"). Ele continua com esse uso no documento da fase 8? E o nome "origem" fica só para a origem da cota? | P26 |

As marcações da planilha antiga de permutas (PERMUTA, ENTROU, SÓ 1ºT, SÓ 2ºT; era P11) ficam para as specs de permutas, no começo da fase 9. O formato da escala do dia (era P28) é a P-32 do [catálogo](regras/normativo-a-validar.md).

## Divergências abertas

| Nº | Onde | Divergência | Situação |
|---|---|---|---|
| D18 | Código (`apps/api/src/cadastros/servicos.ts`) × RN-83 | O cadastro de serviço ainda tem a coluna `operacao`; a RN-83 e a decisão de 18/11/2026 dizem que a diária é o próprio serviço e que não há campo "operação". | Aberta, para a DESENVOLVIMENTO: ou a coluna é resto sem uso, ou a regra muda. |

## Respondidas ou sem efeito no sistema novo

- **Respondidas pelo catálogo:** P3 (a origem é da cota, RN-35), P4 (diárias, RN-04), P9 (CNH, RN-12), P12 (funções, RN-94), P14 (Saldo, RN-13), P15 e P23 (voluntariado por faixa, RN-105; o passado, RN-85), P17 (JES para não voluntário, RN-46), P19 (ordem de preenchimento, RN-13), P22 (Apoio Operacional Aquartelado, RN-96), P24 (hierarquia da CNH, fixa no código).
- **Respondidas pelo sistema novo:** P6 (a escala é o agrupamento de serviços; as telas têm nomes próprios: Escala do mês, Grade geral), P8 (militar de outra unidade, RN-32), P16 (Configurações, com o painel geral e as da escala), P20 (a diária é o próprio serviço, RN-83; ver a D18), P27 (a prioridade da guarnição não é mais editável; a ordem é a da meta de ativação, RN-108).
- **Sem efeito:** P18 e as divergências D1 a D17 eram entre o protótipo e o catálogo do claude.ai (abas, colunas, cartões de entrega); o sistema novo tem uma fonte só, o banco.
