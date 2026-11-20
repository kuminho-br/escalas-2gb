# Regras — cotas, voluntariado e permutas
Cotas de PJES e diárias, montagem da escala e voluntariado, situações boas e ruins, permutas (RN-33 a RN-48, RN-86 a RN-90).

Fonte: Catálogo de Regras de Negócio do claude.ai (rev. 160, 15/11/2026), colhido em 20/11/2026. Quem cuida: REGRAS DE NEGÓCIO. Índice: [LEIAME](LEIAME.md).

## Cotas de PJES e diárias
A SB recebe cotas de PJES e diárias e é obrigada a executá-las; serviços de cotas externas também são tirados pelos militares, mas ficam fora da cota da SB.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-33 | A SB recebe cotas de PJES e diárias, serviços extras além da carga horária normal, e é obrigada a executá-las. A cota define a quantidade de serviço extraordinário de um mês numa SB; ela não caracteriza o serviço (RN-35 e RN-83). Os JES e as diárias chegam por SB por mês, como na aba RESUMO da planilha de operações. | Implementada | Ambas |
| RN-34 | Cotas externas são serviços recebidos que os militares precisam tirar, mas que não entram na cota original da SB. | Implementada | Ambas |
| RN-35 | A origem (interna ou externa) é atributo da cota recebida, não do turno nem do serviço: cada cota tem mês, SB, serviço, quantidade e origem. A operação é característica do serviço do tipo Diária (RN-83), não da cota. O tipo "PJES Externo" deixa de existir. | Implementada | Base |
| RN-36 | O militar só pode tirar uma diária por dia, contando pela data de início do turno. | Implementada | Ambas |
| RN-37 | Duas diárias em dias diferentes podem ser emendadas (ex.: 16:00–00:00 do dia D + 00:00–08:00 do dia D+1). Essa combinação se chama dobradinha e vale para Pronto e Adm. | Implementada | Ambas |
| RN-81 | Cada turno de uma operação tem vagas por função. A composição (função, mínimo, máximo, CNH) vem do cadastro da guarnição na aba GUARNIÇÕES; o vínculo entre a escala/turno e as guarnições que a servem fica em GUARNIÇÕES POR ESCALA (RN-09). Ex.: PE Seguro: motorista, chefe e 2 socorristas; Bioma: motorista, chefe e 2 combatentes; Defensoria: chefe e auxiliar. | Implementada | Base |
| RN-82 | Cada vaga preenchida (1 militar em 1 turno de operação) consome 1 cota da operação, para todas as operações, como a planilha de operações conta hoje. | Implementada | Base |
| RN-89 | Cumprir as cotas internas vale mais do que cumprir as externas: quando não dá para atender todas, o sistema preenche primeiro as internas. | Confirmada | Automação |
| RN-95 | Se uma cota de PJES ou diária conta para a meta de ativação de guarnições (RN-49) ou só para a meta de cotas (RN-50) é atributo da cota, definido pelo usuário ao cadastrá-la. Hoje, cotas do tipo JES servem de reforço de efetivo para a meta de ativação. | Confirmada | Base |


## Montagem da escala e voluntariado
A escala é montada em três etapas. Os extras são alocados primeiro entre os voluntários e depois de forma compulsória, até cumprir as cotas.

1.

Alocar os serviços do Pronto.
2.

Distribuir os JES entre os militares do Pronto.
3.

Distribuir os JES dos militares do Adm, que são mais flexíveis.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-38 | A montagem segue a ordem: serviços do Pronto, depois JES do Pronto, depois JES do Adm. | Confirmada | Automação |
| RN-39 | Os militares com status de voluntário preenchem, a cada mês, um formulário indicando quando pretendem tirar JES e diárias. | Implementada | Base |
| RN-40 | Os extras são alocados em duas fases: primeiro a voluntária, respeitando o formulário; depois a compulsória, para completar as cotas. | Implementada | Automação |
| RN-41 | O voluntário que não preencheu o formulário do mês ainda pode ser escalado de forma compulsória; nesse caso a escala abate a carga horária padrão dele (RN-16). | Implementada | Automação |
| RN-42 | Na fase compulsória, o sistema equilibra entre os militares a quantidade de situações boas e ruins que cada um tira. | Confirmada | Ambas |
| RN-46 | O cadastro do militar tem o atributo "voluntário JES" (sim/não). Só pode ser escalado em JES quem tem esse status, inclusive na escalação manual: o sistema bloqueia. | Implementada | Ambas |
| RN-47 | O militar escolhe o dia e o turno no formulário mensal. | Implementada | Base |
| RN-48 | O escalante pode escalar manualmente um voluntário em dias que ele não indicou no formulário; o sistema não bloqueia, pois o escalante precisa fechar a escala. | Implementada | Suporte |
| RN-90 | Funções mais difíceis ou mais específicas dão preferência a quem as cumpre na distribuição dos extras. Falta definir quais funções entram e que preferência elas geram (P-18). | A esclarecer | Automação |


## Situações boas e ruins
Um serviço é bom ou ruim conforme se encaixa na escala individual do militar, não só pelo serviço em si. Por isso as situações serão catalogadas para equilibrar a escala.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-43 | A qualidade de um serviço (boa ou ruim) é avaliada pela combinação com os demais serviços do militar. Ideia de peso (ainda sem catálogo completo das situações — P-11): a cada alocação registra-se -1 para uma vantagem recebida e +1 para uma desvantagem recebida; ser motorista é uma desvantagem grande (ex.: -3). Quanto mais negativo o saldo acumulado do militar, mais preferência ele tem na próxima alocação. As situações ficam num catálogo usado pela RN-42. | Confirmada | Ambas |
| RN-44 | Na situação padrão, o Pronto emenda os turnos A e B: das 08:00 do dia D às 08:00 do dia D+1. | Confirmada | Base |
| RN-45 | Existem situações boas e ruins também para o Adm; ainda não levantadas. | A esclarecer | Ambas |


Catálogo de situações (inicial):

| ID | Situação | Composição | Classificação | Jornada |
|---|---|---|---|---|
| S-01 | Dobradinha | Diária 16:00–00:00 (D) + diária 00:00–08:00 (D+1) | Boa | Pronto e Adm |
| S-02 | Saída do Pronto com diária | Pronto 08:00 (D) → 08:00 (D+1) + diária 08:00–16:00 (D+1) | Boa | Pronto |

## Permutas
Depois de ver a pré-escala, o militar pode pedir para trocar de serviço com outro militar.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-86 | A permuta é sempre entre um par de permutantes: os dois militares e os dois serviços trocados ficam registrados juntos, e as duas pontas mudam na mesma operação. | Confirmada | Base |
| RN-87 | Não há permuta entre serviços de meses diferentes. Esse limite é parâmetro de configuração, porque pode mudar no futuro. | Confirmada | Base |
| RN-88 | A permuta só é aceita se a escala resultante continuar respeitando as regras de alocação (choques, voluntário JES, uma diária por dia). O próprio registro da permuta pelo escalante já é a aprovação dele; o requisito de permuta não depende do dia já ter passado. | Confirmada | Ambas |
