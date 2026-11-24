# Ficha do militar na escala, Escala do mês e militar externo — design

24/11/2026 · decisões do usuário no mesmo dia (formulário) · plano das partes 1 e 2: `docs/superpowers/plans/2026-11-24-fase6-32-ficha-da-escala.md` (entrega 6.32); parte 3: `docs/superpowers/plans/2026-11-24-fase6-33-militar-externo.md` (entrega 6.33) · para o piloto das escalas de dezembro de 2026

## Por quê

O usuário vai montar as escalas de dezembro no sistema, em paralelo ao processo normal, a partir de 25/11. Três pendências atrapalham:

1. A ficha do militar na aba Militares do módulo de escalas mostra todos os dados do Pecúlio. Ali é lugar de informação da escala: os dados são cadastrados pela SP (quem cuida do Pecúlio, nível acima da lotação), e a SB, na maior parte, só vê. Alguns dados nem são pertinentes.
2. A Escala do mês abre sem a escala do ordinário escolhida.
3. Não há como trazer um militar de outra unidade para tirar serviço extra aqui.

## 1. A ficha do militar no módulo de escalas

| Seção | Fica? | Quem edita |
|---|---|---|
| Identificação | fica | só a SP (a SB vê) |
| Contato | fica | só a SP e o próprio militar na Minha ficha (a SB vê) |
| Dados pessoais (CPF, nascimento, endereço, sexo) | **sai** | — |
| Comportamento | **sai** | — |
| **Habilitações** (era "Motorista") | fica | **a SB edita** |
| Afastamentos | fica | só a SP (a SB vê) |
| Histórico de rastreio | fica | só a SP (a SB vê; sem "Alterar situação" para o auxiliar nem para o militar comum) |
| Acesso ao sistema | fica | o auxiliar administrativo só gera a senha de primeiro acesso; não muda nível de acesso de ninguém, nem o dele |

- **Habilitações:** só o nome muda agora. Dentro dela, Motorista e as categorias de CNH, como hoje. Outras habilitações (um catálogo) ficam para depois do piloto. O **voluntário JES** sai da edição da SB: passa a ser só da SP, e a SB vê.
- **Equipe e jornada** também ficam só com a SP (a SB vê no histórico de rastreio).
- **Toda seção recolhe e abre** por um botão no título, e a tela lembra, no navegador, o que cada pessoa deixou recolhido.
- A ficha completa continua no Pecúlio, para a SP. Esta é a ficha "da escala".
- Quem tem nível de acesso numa unidade acima da lotação do militar (a SP) e o administrador continuam editando tudo, também por esta ficha.

## 2. Escala do mês

- Ao abrir a tela, a escala escolhida é a do **ordinário** (a escala com o serviço Pronto). Sem ela, a primeira da lista, como hoje.

## 3. Militar externo

- **Quem:** um militar de outra unidade que vem tirar **serviço extra** (JES, Diária, PJES) aqui.
- **Como entra:** o **gestor da unidade que recebe** (ou quem está acima dele, como o administrador) acha o militar na Consulta de militares (módulo Pecúlio) e clica em **"Trazer para a escala de {unidade}"**. A lotação dele não muda.
- **Por quanto tempo:** **até alguém tirar**. O gestor desfaz quando quiser ("Tirar da escala de {unidade}").
- **Onde aparece:** na unidade que recebe, numa equipe chamada **"Externo"**, nas telas de escala. Só pode ser lançado nos **serviços extras** (JES, Diária e PJES), à mão; não entra no Pronto nem na pré-escala do ordinário.
- **O auxiliar** vê quem foi trazido, mas não traz nem tira.
- **Banco:** a tabela `vinculo_externo` (militar, unidade, início, fim, observação), criada na migração 0001 e nunca usada, serve para isso: "até alguém tirar" é o fim vazio; tirar grava o fim. Decisão antiga que isto cumpre: "Militar de fora só por vínculo" (16/11/2026).

## Não objetivos

- O catálogo de habilitações.
- O militar externo no Pronto ou na pré-escala.
- Mudar a ficha do Pecúlio.

## Anti-objetivos

- Esconder da SB um dado de que ela precisa para escalar (CNH, afastamentos, equipe).
- O externo sair da escala da unidade de origem.

## O que fica para o plano

- Como a regra "só serviço extra" é conferida (pelo tipo do serviço ou pelo nome, enquanto os serviços não forem padronizados).
- O texto exato das mensagens.
