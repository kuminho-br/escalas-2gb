# Regras — serviços, turnos e guarnições
Serviços e turnos, ativação de viaturas e guarnições, e a ordem de alocação para cumprir a meta (RN-01 a RN-13, RN-81, RN-83, RN-92 a RN-96, RN-100).

Fonte: Catálogo de Regras de Negócio do claude.ai (rev. 160, 15/11/2026), colhido em 20/11/2026. Quem cuida: REGRAS DE NEGÓCIO. Índice: [LEIAME](LEIAME.md).

## Serviços e turnos
A aba TURNOS da planilha sandbox cadastra 9 serviços em 5 tipos e 17 turnos; ela é a fonte oficial de horários e durações.

| Tipo | Serviço | Turno | Início | Fim | Duração (h) |
|---|---|---|---|---|---|
| Ordinário | Pronto | A | 08:00 | 20:00 | 12 |
| Ordinário | Pronto | B | 20:00 | 08:00 | 12 |
| Ordinário | Adm | A | 08:00 | 16:00 | 8 |
| Ordinário | Saldo | A | 08:00 | 20:00 | 12 |
| Ordinário | Saldo | B | 20:00 | 08:00 | 12 |
| PJES | JES | A | 08:00 | 20:00 | 12 |
| PJES | JES | B | 20:00 | 08:00 | 12 |
| PJES | Defensoria | A | 07:00 | 19:00 | 12 |
| PJES | CPRH | A | 08:00 | 20:00 | 12 |
| Diária | Bioma | A / B / C | 00:00 / 08:00 / 16:00 | 08:00 / 16:00 / 00:00 | 8 |
| Diária | PE Seguro | A / B / C | 00:00 / 08:00 / 16:00 | 08:00 / 16:00 / 00:00 | 8 |
| Diária | Eleições | A / B | 07:00 / 15:00 | 15:00 / 23:00 | 8 |


| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-01 | Serviços, turnos, horários e durações vêm do cadastro TURNOS; novos tipos e serviços podem ser criados sem mudar o código. | Implementada | Base |
| RN-02 | Na escala exibida ao escalante, cada célula mostra o serviço com o horário (ex.: "Pronto 08–20"). O tipo de serviço (Ordinário, PJES, Diária) não aparece na célula; só é usado em documentos e relatórios. O texto inteiro tem de caber na célula, sem cortes: a coluna do dia será alargada. | Implementada | Base |
| RN-03 | O serviço Saldo só pode ser tirado por militar do Adm. A automação não lança Saldo para quem não é do Adm, e a lista suspensa da escala só oferece Saldo para militar do Adm. | Implementada | Ambas |
| RN-04 | As diárias são mandadas pelas cotas: cada cota de diária corresponde a 1 alocação de militar num turno de operação (ex.: 20 cotas = 20 alocações). Só pode tirar diária quem preencheu o formulário mensal de voluntariado; não precisa ter o status de voluntário de JES. | Implementada | Base |
| RN-05 | Serviço extraordinário externo é o que vem de uma cota de origem externa: os militares tiram, mas não conta na cota da SB (ver RN-35). | Confirmada | Base |
| RN-83 | Serviço e turno são cadastros separados: o serviço guarda nome, tipo e, só quando o tipo é Diária, a operação a que pertence; cada turno aponta para um serviço e guarda horário e duração. O conjunto de turnos de um serviço é o seu espaço de possibilidade temporal: declara em que janelas aquele serviço pode ocorrer, não uma tabela de horários fixos. Serviços que não são diária não têm operação. | Confirmada | Base |


## Ativação de viaturas e guarnições
A meta de ativação passa a ser configurada pelo usuário, viatura a viatura, com prioridade, serviços aceitos e guarnição mínima e máxima. Fica para implementações futuras.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-07 | O usuário define quais guarnições devem ser ativadas (quantidade e tipo). A entidade cadastrada e ativada é a guarnição; a viatura é atributo opcional dela, porque existe guarnição sem viatura (RN-96). “Quantidade e tipo” é a granularidade atual: enquanto não houver mais de uma instância do mesmo tipo numa escala, tipo e instância se confundem sem prejuízo (P-30). | Confirmada | Automação |
| RN-08 | O usuário define a ordem de prioridade de ativação das guarnições. Essa prioridade é propriamente da instância ativada, não do tipo: se a escala ativar 2 guarnições do mesmo tipo, dever-se-ia completar a primeira antes de começar a segunda. Enquanto não houver esse cenário, tipo e instância se confundem sem prejuízo (P-30). Guarnição sem prioridade cadastrada vai por último (comportamento atual do código); manter isso ou exigir o valor no cadastro está em aberto (P-31). | Confirmada | Automação |
| RN-09 | A escala é um agrupamento estrutural de serviços que compartilham uma demanda operacional (ex.: a escala do Ordinário agrupa Pronto, JES e Saldo — os três disputam o mesmo ABT). O vínculo entre escala × turno e as guarnições que podem servi-la é definido pelo usuário na aba GUARNIÇÕES POR ESCALA, como cadastro mensal (RN-93). O vínculo é sempre escala × turno → guarnição, nunca serviço × turno. Substitui a antiga coluna TIPOS DE SERVIÇO da aba GUARNIÇÕES, que é removida. | Implementada | Ambas |
| RN-100 | Uma escala é um agrupamento estrutural de serviços que compartilham uma demanda operacional. Cada serviço de uma escala contribui com horas de militares para preencher as mesmas guarnições; a demanda é da escala, não de cada serviço isoladamente. Atributos de publicação (título da folha, quais militares exibir, quais dias exibir) pertencem à escala, não ao serviço. Exemplo: a escala do Ordinário agrupa Pronto, JES e Saldo. | Implementada | Base |
| RN-10 | Cada guarnição tem um efetivo mínimo por função; abaixo dele a guarnição não é ativada. Esta é uma das causas de não-ativação; há pelo menos outras duas ainda não catalogadas: viatura indisponível para montar a guarnição, e calendário da operação (a operação não ocorre naquele dia). A lista de causas é cadastrável. | Confirmada | Ambas |
| RN-11 | Cada guarnição tem um efetivo máximo por função; acima dele não se aloca mais ninguém. | Confirmada | Ambas |
| RN-12 | A função de motorista exige militar do quadro de motoristas com a categoria de CNH exigida pela guarnição — com ou sem viatura (ex.: motorista do ACO, RN-96). A hierarquia de categorias é regra do CTB, não cadastrável: D habilita C e B; C habilita B; A habilita só A; E habilita D, C e B. Ou seja, o posto aceita quem tem a categoria exigida ou outra que a habilite. A notação concatenada do militar (ex.: "AD" = A e D) continua valendo; a hierarquia se aplica sobre cada letra individualmente. | Implementada | Ambas |
| RN-92 | Depois que cada guarnição obrigatória atinge o efetivo mínimo (na ordem de prioridade da RN-08), o efetivo restante do Pronto e do JES é distribuído para completar até o máximo, guarnição por guarnição, na mesma ordem. Se ainda sobrar efetivo depois de todas chegarem ao máximo, o excedente é distribuído 1 militar por vez em cada composição, seguindo a mesma ordem de prioridade. É assim que o Pronto e o JES cumprem a meta de ativação (RN-49): completando as guarnições obrigatórias. Guarnições de operações extraordinárias (diárias) seguem outra regra (RN-83, RN-33). | Confirmada | Automação |
| RN-93 | Os efetivos mínimo e máximo de cada guarnição — incluindo ABTS, ACO e o efetivo do quartel — são cadastro editável pelo escalante a cada mês, na aba GUARNIÇÕES, aberta pelo painel de Configurações. A vigência mensal vale também para o vínculo da aba GUARNIÇÕES POR ESCALA (RN-09). Uma alteração não retroage: os dias já passados antes da mudança mantêm os valores antigos. | Implementada | Base |
| RN-94 | A lista de funções de cada serviço é cadastro do usuário, não fixa no código, e pode ganhar ou perder funções com o tempo; cada serviço tem sua própria lista (RN-83). Funções especiais, como motorista, podem exigir requisitos (ex.: categoria de CNH — RN-12) e ter militares em número escasso. Acúmulo de função (ex.: "Motorista / Chefe") é permitido quando a guarnição é reduzida (P-25). "Motorista 12H" não é função distinta: é anotação legada de um motorista comum tirando serviço de 12h. As subfunções de combatente (ex.: auxiliar/chefe de 1ª e 2ª linha em Incêndio) já são definidas na escala atual, sem necessidade de cadastro adicional. | Confirmada | Base |
| RN-96 | O Apoio Operacional Aquartelado é um serviço obrigatório do ordinário, ligado à meta de ativação (RN-49). A escala real de 01/10 a 31/10/2026 (ESCALAOP26-RETIFICADA) mostrou, nos 31 dias e nos 2 turnos, sempre a mesma guarnição: 1 motorista ACO, 2 despachantes de centro de operações e 1 adjunto de dia. As vagas são preenchidas por militares de origens variadas (Pronto, Saldo, PJES), a mesma lógica de origem das demais unidades (RN-13). Essa guarnição consta no regulamento, mas pode variar um pouco (RN-93). "Despachante" é uma função dela, cadastrada pelo usuário como as demais; o nome do posto externo (ex.: visto como "SAMU-Recife") não importa para o sistema (P-24 resolvida, 10/11). A guarnição existe mesmo sem viatura (ex.: motorista ACO), e a CNH exigida continua valendo nesse caso (RN-12). | Implementada | Base |


Exemplo de configuração, único informado até agora:

| Guarnição | Mínimo para ativar | Máximo suportado |
|---|---|---|
| AR | 3: motorista, chefe, socorrista | 5: motorista, chefe, 3 socorristas |


## Alocação para cumprir a meta
A meta é preenchida em três camadas, sempre nesta ordem; a ordem não muda.

1.

Serviço ordinário do efetivo do Pronto.
2.

JES do efetivo do Pronto.
3.

Saldo do Adm.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-13 | A alocação para atingir a meta segue a ordem: ordinário do Pronto, depois JES do Pronto, depois Saldo do Adm. | Confirmada | Automação |
