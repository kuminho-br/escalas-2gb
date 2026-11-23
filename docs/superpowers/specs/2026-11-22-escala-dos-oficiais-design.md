# Escala dos oficiais — design da versão 1

22/11/2026 · fechado com o usuário · mockup aprovado sem ressalvas (`docs/telas/escala-dos-oficiais/mockup.html`) · plano em `docs/superpowers/plans/2026-11-22-p1-escala-dos-oficiais.md` (entrega paralela P1)


## O que é e por quê

Uma tela nova na Confecção de escalas para montar a escala mensal dos oficiais e acompanhar, ao longo dos meses, se o serviço está bem dividido entre eles.

O problema de hoje: os oficiais escolhem os dias por antiguidade, e não há controle de quanto cada um tirou no longo prazo. Quem entra depois não pode começar "zerado", porque pareceria dever tudo o que os outros já tiraram.

## Como entra no projeto

- É uma **missão paralela**: usa os dados do projeto e pode gravar no banco, mas não muda o fluxo principal nem a ordem das fases.
- No roadmap, entra numa zona própria, "missões paralelas" (pendentes), que ainda não existe. O usuário quer que essa zona apareça também no artefato do roadmap.
- É a **entrega paralela P1**, a primeira dessa zona (pedido do usuário, 22/11/2026).

## Objetivos da versão 1

1. Montar a escala do mês dos oficiais, nos turnos do serviço do oficial de operações (hoje, dois de 12 h por dia: dia e noite).
2. Calcular a cota de cada oficial no mês.
3. Guardar o registro de cada serviço tirado.
4. Manter o **saldo** de cada oficial, contínuo entre os meses, e mostrá-lo num painel.
5. Explicar as regras numa tela de "Regras", em linguagem simples.

## Fora da versão 1

- **Saldo interferindo na cota.** Na versão 1 o saldo só aparece. O primeiro mês é piloto. Na versão seguinte, a sobra passa a ir para quem tem o menor saldo, e define-se quanto o saldo desconta da cota.
- **Permutas.** Entram junto com a fase 9. Serão só entre os oficiais desta escala.
- **Dias vermelhos** (fins de semana, feriados e outros dias problemáticos). Ficam para a versão 2 ou 3: o escalante marcará no calendário do mês quais dias são vermelhos e o peso de cada um; haverá um saldo próprio de serviços vermelhos, com níveis; pode haver escala só de dias vermelhos. A princípio, os dias vermelhos não alteram a quantidade de cotas do mês.
- **Peso diferente para dia e noite.** Não há. O painel só mostra a contagem separada.

## O que não pode acontecer

- Atrapalhar o fluxo principal do roadmap ou mudar o que já existe no projeto.
- Regras que o oficial comum não consiga entender: por isso a tela de Regras.
- O sistema "esquecer" a parte quebrada da cota: ela sempre vai para o saldo.

## Quem usa e quem participa

- **Quem vê a tela:** administrador e gestor da unidade. Fica dentro do módulo Confecção de escalas, não é um módulo novo na tela inicial.
- **Quem participa da escala:** os militares dos quadros QOC e QOA lotados na unidade atual e nas de baixo são **elegíveis**; o gestor escolhe, entre eles, quem participa da rodada do mês (correção do usuário, 22/11/2026; P1.5). O mês novo vem com os participantes do anterior. As outras telas de escala mostram só o QBMG e quem está sem quadro (decisão do usuário, 22/11/2026).

## Regras

### Escala do mês

- O ciclo é mensal, como as demais escalas.
- Os turnos são os do **serviço do oficial de operações**, cadastrado como qualquer serviço e escolhido na tela, por mês. O usuário o cadastra como o Pronto: dois turnos de 12 h, dia e noite. Nada de turno fixo no código (decisão do usuário, 22/11/2026).
- A ordem de escolha dos dias é a antiguidade (o mais antigo escolhe primeiro).
- Quem está afastado não tira serviço nos dias do afastamento.
- A antiguidade dá a ordem de escolha, não a quantidade: todos tiram a cota calculada.

### Cota do mês (botão "Calcular cotas")

1. **Presença** de cada oficial: dias do mês em que participa da escala e não está afastado, dividido pelos dias do mês. Todo tipo de afastamento reduz a presença, sem distinção.
2. **Devido** de cada um: turnos do mês × presença dele ÷ soma das presenças. É um número com casas decimais.
3. **Cota:** o devido arredondado para baixo.
4. **Sobra:** os turnos que restam depois do arredondamento são entregues um a um, começando pelo **mais moderno**. Os mais antigos ficam com um a menos.

O botão mostra, por oficial, o saldo acumulado até o mês anterior, os dias presentes e a cota. Na versão 1 o saldo aparece na lista, mas não entra na conta.

Exemplo: 62 turnos, 8 oficiais, um de férias em 15 dos 31 dias.

| Quem | Devido | Cota | Saldo do mês |
|---|---|---|---|
| 5 mais antigos | 8,25 | 8 | −0,25 |
| 2 mais modernos | 8,25 | 9 | +0,75 |
| O de férias (16 dias presentes) | 4,26 | 4 | −0,26 |

### Saldo

O saldo de um oficial é o que ele tirou menos o que devia tirar, somado mês a mês. Tem casas decimais e pode ser negativo.

- **Positivo:** trabalhou mais do que devia.
- **Negativo:** deixou de trabalhar o que devia.

O saldo persiste entre os meses e não é zerado.

### O que muda o saldo

| # | Caso | Efeito |
|---|---|---|
| 1 | Afastamento deixa o devido quebrado | A parte que não foi tirada entra como negativo |
| 2 | A divisão tem resto | Quem tirou o turno a mais fica positivo; quem tirou a menos, negativo |
| 3 | Imprevisto depois da escala fechada (alguém sai e outro cobre) | **Quem cobre ganha, quem sai não deve.** Quem cobriu recebe o turno; quem saiu fica como se tivesse tirado. Vale para todo imprevisto (a regra vem do afastamento por doença; por ora não se distingue o motivo) |
| 4 | Oficial entra depois | Entra com a média dos saldos de quem já está; no mês de entrada deve só o proporcional aos dias em que esteve |
| 5 | Oficial sai (transferência, mudança de quadro) | O saldo dele fica guardado e parado; se voltar, retoma. O dos outros não muda |
| 6 | Turno que ficou sem ninguém | Ninguém ganha; o devido de todos é recalculado sobre os turnos de fato tirados |
| 7 | Afastamento lançado depois do mês encerrado, ou erro | O mês encerrado não é recalculado; o gestor lança um ajuste manual, com motivo, que fica no registro |
| 8 | Permuta (fase 9) | Troca de um turno por outro no mesmo mês não muda o saldo; o resto se decide na fase 9 |

Por causa do caso 3, a soma dos saldos não é zero: cada cobertura acrescenta um turno ao total. Por isso o novato entra com a média, e não com zero.

### Os dois momentos do mês

- **Fechar a escala:** as escolhas estão feitas. Antes dele, um afastamento reduz a cota (caso 1). Depois dele, trocar o nome num turno é uma cobertura (caso 3), e o registro guarda quem saiu e quem cobriu.
- **Encerrar o mês:** o saldo do mês é calculado com a escala como ficou e somado ao acumulado. Depois disso, só ajuste manual (caso 7).

### Registro de serviços

Cada serviço tirado fica gravado: quem, o dia, o turno (dia ou noite) e, quando for cobertura, de quem. Os ajustes manuais ficam no mesmo histórico, com o motivo.

## Telas

- **Escala dos oficiais:** o mês, com os dois turnos de cada dia; os botões "Calcular cotas", "Fechar a escala", "Encerrar o mês" e "Regras".
- **Painel de saldo:** por oficial, o saldo acumulado e a evolução mês a mês, e a contagem de turnos de dia e de noite.
- **Regras:** todas as regras acima, em texto simples, com o exemplo.

O desenho das telas não foi feito. Segue os princípios do projeto: painéis sucintos e textos sem jargão.

## Caminhos considerados

| Decisão | Caminhos | Escolhido |
|---|---|---|
| Onde fica | (a) módulo novo na tela inicial; (b) tela dentro da Confecção de escalas | **(b)**: é só mais um tipo de escala, e reaproveita o modelo das demais |
| Como medir o equilíbrio | (a) pilha de inteiros, tirando 1 de todos quando ninguém está em zero, com a parte quebrada à parte; (b) saldo com casas decimais, positivo ou negativo | **(b)**: guarda a parte quebrada sem regra extra |
| Quando o saldo interfere | (a) só aparece na versão 1; (b) já entra na conta, com uma chave para ligar | **(a)**: o usuário quer ver um ou dois meses de números reais antes |

## Dependências

- **Quadro QOC/QOA no banco.** Entra na própria P1, como subentrega P1.1: quadros QOC, QOA e QBMG; o posto-graduação pertence a quadros; todo militar tem um quadro (decisão do usuário, 22/11/2026).
- **Fase 9** para as permutas.

## O que o projeto já tem

- Afastamento com período e tipo (`afastamento`, `tipo_afastamento`).
- Árvore de unidades, para "esta e as de baixo".
- Níveis de acesso administrador e gestor.
- Posto/graduação com ordem e o campo de antiguidade na ficha do militar (pode estar vazio).
- Cadastro de escalas, serviços e turnos; lista de telas do módulo em `apps/web/src/lib/modulos.ts`.

A versão 1 precisa de tabelas novas, só dela (escala do mês dos oficiais, registro, saldo e ajustes). Nada do que existe muda.

## Pontos que estavam em aberto

O mockup seguiu a proposta de cada ponto e foi aprovado sem ressalvas (22/11/2026). Com isso, eles ficam decididos assim:

1. **Quem registra as escolhas:** o gestor lança a escolha de cada oficial, na ordem que o sistema mostra. Cada oficial escolhe todos os seus turnos na sua vez.
2. **Média do novato:** média exata, com casas decimais.
3. **Oficiais por turno:** um. Turnos das 07h às 19h e das 19h às 07h.
4. **Antiguidade vazia:** posto primeiro, depois o campo de antiguidade; sem o campo, o gestor ordena à mão.
5. **Afastado num dia escolhido:** o dia não é oferecido na escolha; afastamento lançado depois aparece como aviso, sem travar.
6. **Imprevisto sem cobertura:** o turno fica vazio (caso 6), e ninguém ganha.
7. **Férias em parte do mês e a sobra:** todos com presença no mês entram na fila.
8. **Onde aparece a zona de missões paralelas:** no roadmap e na página do roadmap.

O item "Oficiais" fica no trilho do módulo, logo depois de "Efetivo por dia".
