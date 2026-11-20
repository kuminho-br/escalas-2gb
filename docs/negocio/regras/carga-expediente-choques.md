# Regras — carga horária, Adm e choques
Carga horária e saldos, expediente do Adm e pré-escala, choques de horário (RN-15 a RN-26, RN-84, RN-85, RN-91).

Fonte: Catálogo de Regras de Negócio do claude.ai (rev. 160, 15/11/2026), colhido em 20/11/2026. Quem cuida: REGRAS DE NEGÓCIO. Índice: [LEIAME](LEIAME.md).

## Carga horária e saldos
O Pronto cumpre 160h por mês; o Adm hoje cumpre apenas a cota de saldos, 6 por militar.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-15 | A carga mensal do militar do Pronto não é fixa no código: é o parâmetro "Carga mensal (horas)" do painel de Configurações (hoje 160h). | Implementada | Ambas |
| RN-16 | JES e diárias não contam na carga horária do militar. Exceção: o voluntário que não preencheu o formulário do mês e é escalado de forma compulsória (RN-41) tem essa escala abatida da carga horária padrão dele; o valor do abatimento é parâmetro de configuração. | Confirmada | Ambas |
| RN-17 | Se o militar do Adm cumpre a carga mensal é o parâmetro liga/desliga "Adm cumpre a carga mensal" do painel de Configurações. Hoje está desligado: o Adm cumpre só os saldos. | Implementada | Ambas |
| RN-18 | A quantidade de saldos por militar do Adm no mês é parâmetro do sistema; padrão 6, e o escalante pode digitar outro valor. | Implementada | Ambas |


## Expediente do Adm e pré-escala
A pré-escala é uma sugestão automática que o escalante sempre revisa; o Adm só trabalha em dias úteis.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-19 | O Adm está de expediente todo dia útil; o serviço normal do Adm nunca cai em fim de semana ou feriado. | Implementada | Ambas |
| RN-20 | A distribuição automática do serviço normal do Adm é só uma pré-escala: equaliza a carga entre os militares do Adm e ao longo da semana de cada um, e o escalante ajusta depois. Só se aplica quando o Adm precisa cumprir as 160h mensais (RN-17 ligada). | Confirmada | Automação |
| RN-21 | A distribuição do Adm é uma etapa do painel de pré-escala, não um painel próprio. | Implementada | Automação |
| RN-22 | A pré-escala do Pronto do mês seguinte é gerada a partir do mês atual, seguindo o rodízio das equipes Alfa, Bravo, Charlie e Delta. | Implementada | Automação |
| RN-84 | A pré-escala é um guia, não a escala final: o sistema monta para o escalante não fazer tudo à mão e, depois de pronta, o escalante altera o que quiser, desde que a alteração não quebre as regras de alocação. | Confirmada | Ambas |
| RN-85 | A partir de hoje (inclusive) o escalante altera livremente os dias futuros; de ontem para trás fica travado, porque o serviço já está acontecendo. Falta definir quais correções continuam permitidas nos dias já passados (P-17). | A esclarecer | Suporte |
| RN-91 | Na escala automática do Adm, o militar é lançado em todo dia útil; se nesse dia ele for escalado em Saldo no turno A (08–20), o serviço de Adm sai do dia dele, para não dar choque de horário. | Confirmada | Automação |


## Choques e encadeamento de serviços
Por ora a única validação obrigatória é impedir choque de horários; as regras de descanso da PCG 314 ficam para depois.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-23 | Um militar não pode ter dois serviços com horários sobrepostos (choque de escalas). | Implementada | Ambas |
| RN-24 | O militar não pode tirar JES e emendar com Pronto; pode tirar Pronto e emendar com JES. | Implementada | Ambas |
| RN-25 | O Adm não pode tirar Diária no horário do expediente em dia útil. A janela de bloqueio é o horário do serviço Adm cadastrado em TURNOS (hoje 08:00–16:00). O que conta como Diária é definido pela coluna TIPO DE SERVIÇO de TURNOS: apenas serviços do tipo "Diária" (ex.: Bioma, PE Seguro) são impedidos; serviços do tipo "PJES" (ex.: JES, Defensoria, CPRH) e do tipo "Ordinário" (ex.: Pronto, Saldo) não são impedidos. A regra só se aplica quando RN-17 está desligada (Adm não cumpre a carga mensal); quando está ligada, o expediente aparece na grade e o choque é detectado normalmente (RN-17). O Saldo no mesmo horário ou um Adm real no mesmo dia dispensa o expediente implícito daquele dia. | Implementada | Ambas |
| RN-26 | Regras de descanso e de bloco da Portaria do Comando Geral nº 314/2025 serão aplicadas no futuro. | Confirmada | Ambas |
