# Equipes como cadastro

26/11/2026 · modelada · CONCEPÇÃO · origem: usuário, via VALIDAÇÃO e PLANEJAMENTO (pool do piloto, item 47) · no roadmap: 6.64 · urgente

## A ideia

As equipes viram uma **configuração da unidade, herdada da corporação**, nunca texto no código. Três tipos:

- **Pronto** (Alfa, Bravo, Charlie e Delta): tiram o Pronto, revezando 1 dia de serviço e 3 de descanso.
- **ADM**: a jornada ADM, com o expediente.
- **Externa**: os militares de outras unidades postos à disposição das escalas da unidade, sem estarem sob o controle dela. Só são escalados em operações.

## Como está hoje

- **Já existe uma tabela de equipes** (`equipe`: unidade, nome, ordem no ciclo), uma linha por unidade, e o rastreio do militar aponta para ela. O que é texto solto está nas pontas:
- **O motor** tem fixo no código o ciclo `ALFA → BRAVO → CHARLIE → DELTA` e reconhece a equipe pelo nome (`pacotes/dominio/src/pre-escala.ts`).
- **A importação e o lote** acham a equipe pelo nome digitado.
- **"Externo" é só um rótulo** que a lista de militares põe no militar trazido de fora (6.33); não existe equipe com esse nome.
- **Quem é do ADM fica sem equipe.**

## Decisões do usuário (26/11/2026)

1. **Jornada e equipe continuam dois campos separados.** O sistema confere a combinação: equipe do tipo Pronto só para jornada Pronto; equipe do tipo ADM só para jornada ADM.
2. **Herança:** o administrador cadastra as equipes padrão na corporação, e todas as unidades as herdam. O gestor pode criar outras só para a sua unidade e as de baixo, como já acontece com parâmetros, feriados e funções.
3. **O ciclo do Pronto continua fixo em 1×3:** quatro equipes, 1 dia de serviço e 3 de descanso. O cadastro guarda o nome e a posição de cada uma no ciclo.
4. **Externa é só para quem vem de fora.** Pôr na Externa é o "Trazer" de hoje (6.33).
5. **O militar só entra na escala como externo depois de ser posto na Externa**; ele nunca é lançado do nada.
6. **O externo só é escalado nas operações**, nunca no ordinário (Pronto e Saldo). Isto muda a decisão de 24/11/2026, que deixava em qualquer serviço.

## Objetivos

- Uma lista de equipes por unidade, que soma as herdadas e as próprias, sem nenhum nome de equipe no código.
- O tipo de cada equipe (Pronto, ADM ou Externa) dizendo o que ela pode fazer.
- A conferência de jornada e equipe em todo lugar onde se grava a equipe.
- O externo com uma equipe de verdade e preso às operações.

## Não objetivos

- Mudar o ciclo do Pronto (continua 1×3, com quatro equipes).
- Juntar jornada e equipe num campo só.
- Pôr na Externa um militar lotado na própria unidade.
- Mudar como o externo é trazido e tirado (o vínculo da 6.33 continua igual).

## Anti-objetivos

- **Um nome de equipe no código.** O motor e as telas leem o tipo e a posição no ciclo, nunca o nome.
- **Travar a importação ou o lote** por combinação errada de jornada e equipe: vira aviso na prévia, e a linha não grava a equipe.
- **Perder o histórico:** a equipe que um militar teve num mês passado continua de pé, mesmo que a equipe mude de nome.
- Bloquear o escalante.

## Regras

**Tipos**
- Os três tipos são fixos no código (Pronto, ADM e Externa), porque cada um tem um comportamento no motor. O que se cadastra são as equipes de cada tipo.

**Herança**
- Uma unidade vê as equipes da corporação, as das unidades acima dela e as suas. É a mesma herança dos parâmetros, feriados e funções.
- O gestor cria, renomeia e exclui só as equipes da própria unidade. As herdadas, só quem as criou lá em cima (o administrador, na corporação).
- O nome não se repete entre as equipes que uma unidade vê, sem diferenciar maiúsculas.
- Excluir só se nenhum militar teve a equipe em nenhum mês; senão, a equipe é desativada e some das escolhas.

**Pronto**
- Há exatamente quatro posições no ciclo (1 a 4), cada uma com uma equipe do tipo Pronto. Por padrão, as quatro são as da corporação: Alfa, Bravo, Charlie e Delta.
- A pré-escala usa a posição no ciclo, não o nome.
- **Proposta da CONCEPÇÃO:** a unidade cria equipes do tipo ADM, mas não do tipo Pronto. Com o ciclo fixo em quatro, uma quinta equipe do Pronto não teria dia. A PLANEJAMENTO pode rever.

**ADM**
- A corporação tem uma equipe ADM padrão. A unidade pode criar outras do tipo ADM (subgrupos do expediente).
- **Proposta da CONCEPÇÃO:** a equipe continua opcional para quem é do ADM. Sem equipe, o militar aparece com a etiqueta âmbar de "falta", como os outros dados que faltam.

**Externa**
- A corporação tem uma equipe Externa padrão. A unidade não cria outras.
- Ninguém é posto na Externa pela ficha, pela importação nem pelo lote: só pelo "Trazer" (o vínculo externo). Enquanto o vínculo está aberto, o militar aparece na Externa da unidade que o trouxe. A lotação e a equipe dele na unidade de origem não mudam.
- **Só nas operações:** o externo é candidato só em serviços que não sejam do tipo ordinário (no banco, `servico.tipo` diferente de `ordinario`: hoje, PJES e Diária). Nunca no Pronto, no Saldo nem no Expediente.
- Continua lançado à mão, fora da pré-escala e das distribuições automáticas (6.33).
- A conferência de jornada não vale para a Externa: o externo traz a jornada da unidade de origem.

## Esboço da estrutura

**Equipe** (a tabela `equipe` de hoje, ampliada)

| Coluna | Regra |
|---|---|
| id | |
| unidade_id | onde foi criada: a corporação (padrão) ou uma unidade |
| nome | único entre as equipes que uma unidade vê, sem diferenciar maiúsculas |
| tipo | `pronto`, `adm` ou `externa` |
| posicao_ciclo | 1 a 4, só no tipo `pronto`; vazio nos outros |
| ativa | desativada some das escolhas e guarda o histórico |

**Rastreio** (o de hoje): `equipe_id` passa a aceitar uma equipe da própria unidade ou de uma de cima. A conferência de tipo e jornada vale na gravação; o tipo `externa` nunca entra no rastreio.

**Vínculo externo** (o de hoje): nada muda na tabela. O militar com vínculo aberto aparece na equipe do tipo `externa` que a unidade vê.

**Serviço** (o de hoje): o `tipo` (`ordinario`, `pjes`, `diaria`) é o que separa o ordinário das operações para a regra do externo.

## Impactos

- **Importação e exportação do Pecúlio (coluna EQUIPE):** o nome é procurado entre as equipes que a unidade da lotação vê. Um nome que não existe, ou que não combina com a jornada, vira aviso na prévia e não grava a equipe. "Externa" na planilha é ignorada, com aviso. A exportação escreve o nome cadastrado.
- **Atualização em lote (6.52):** a escolha de equipe lista as que a unidade vê, separadas por tipo. A combinação errada aparece na prévia.
- **Grade (filtros e faixa de equipe):** os filtros saem das equipes cadastradas que a unidade vê, na ordem do ciclo e depois por nome, com a Externa por último. Nada de nome fixo na tela.
- **Motor e pré-escala:** o ciclo vem das quatro posições do tipo Pronto, não da lista fixa `CICLO_EQUIPES`. A descoberta da equipe do dia 01 continua igual, comparando a posição.
- **Elegibilidade:** o externo deixa de ser candidato nos serviços do tipo ordinário.
- **Lista de militares e ficha:** o rótulo "Externo" passa a ser o nome da equipe Externa cadastrada.
- **Dados de exemplo e testes:** a carga de exemplo cria as equipes na corporação, não por seção.
- **Migração:** as equipes de hoje, uma linha por unidade, passam para as equipes padrão da corporação. Casar as linhas antigas com as novas é trabalho de quem migra (decisão de 21/11/2026: dado ruim nas linhas é de quem migra).

## Abordagens consideradas

**Jornada e equipe**
- (1) A equipe define a jornada: um campo a menos e sem contradição, mas muda a jornada em todo o sistema.
- **(2) Separadas, com conferência. Escolhida** (usuário, 26/11/2026).

**Herança**
- **(1) Herda e a unidade pode criar. Escolhida** (usuário, 26/11/2026).
- (2) Só a lista da corporação: mais simples, mas sem saída para uma unidade organizada de outro jeito.

**Ciclo**
- (1) No cadastro, com duração pelo número de equipes do Pronto.
- **(2) Fixo em 1×3, com a posição no cadastro. Escolhida** (usuário, 26/11/2026).

## O que fica para quem for planejar

- Os nomes técnicos e o número da migração.
- Onde fica a tela das equipes (configurações da escala, com as herdadas só para ver).
- O texto exato dos avisos.
- Rever as duas propostas da CONCEPÇÃO: a unidade não cria equipe do Pronto; a equipe é opcional para o ADM.
- A linha da decisão em `docs/decisoes.md`, que inclui a mudança da decisão de 24/11 sobre o externo.
