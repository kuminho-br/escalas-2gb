# Grade geral — design (entrega 4 da fase 4)

20/11/2026. Decisões do usuário na conversa de 20/11/2026, por cima da especificação de telas de 16/11 (`docs/superpowers/specs/2026-11-16-telas.md`, seção "Grade geral") e do mockup aprovado (`docs/telas/telas-v12-anonimizado.html`, "grade do militar").

## Por que

A Grade geral é a **visão geral de todo o efetivo no mês, agrupado em equipes**. O escalante vê quem está de serviço em cada dia e quanto cada um já tirou de serviços voluntários. Ela funciona como um **painel interativo**: o clique é no militar **num certo dia** (a célula), e não na linha. O clique abre um painel lateral com a situação dele naquele dia, onde o escalante adiciona, troca e remove serviços.

O lugar dela entre as quatro telas principais:

| Tela | Quem | Quando |
|---|---|---|
| Grade geral | todos os militares | o mês |
| Escala do mês | uma escala | o mês |
| Efetivo por dia | todas as escalas | um dia |
| Escala por militar | militares escolhidos | o mês (com a sessão de PLANEJAMENTO) |

## Objetivos

- Uma linha por militar, agrupada por equipe, com o Adm à parte e quem é de outra seção no fim. Uma coluna por dia. O filtro de equipes fica no topo.
- Em cada dia, um bloco por serviço, na cor do serviço, com a letra do turno, em ordem de início. Os blocos não são proporcionais à duração. O turno que atravessa a meia-noite aparece só no dia em que começa. O expediente do Adm é um bloco cinza sem letra.
- Choque: a célula ganha contorno vermelho. Feriado: o número do dia em vermelho. Fim de semana: fundo levemente sombreado.
- Colunas no fim da linha (decisão do usuário):
  - **PJES** e **Diárias:** uma coluna para cada tipo, só esses dois tipos, porque o ordinário depende da equipe. A célula traz o número de serviços daquele tipo que o militar tirou no mês. Atrás do número fica uma barra, cujo máximo é o maior número da coluna; os outros militares aparecem em comparação a ele.
  - **Voluntariado:** as horas que o militar tirou em serviços voluntários, comparadas com as horas que ele pediu no voluntariado do mês. Exemplo: "24h de 60h".
- Clicar numa célula (militar e dia) abre o **painel do dia**:
  - os dados do militar;
  - como ele está naquele dia: afastamento, horários marcados no voluntariado, cada serviço com escala, horário, guarnição e função, e os choques;
  - **Adicionar serviço neste dia**;
  - em cada serviço, **Trocar** e **Remover**.
- **Trocar** (decisão do usuário): põe outro militar na vaga.
  - O outro pode ser um militar **já escalado** naquele dia. Nesse caso, o sistema **mostra onde ele está antes de trocar**, e os dois trocam de lugar.
  - Quando os dois serviços são **ordinários**, a troca é uma **permuta**, e a tela diz isso.
  - Quando o outro militar está livre, o atual sai da vaga, com a marca de remoção, como no "Remover".

## Não objetivos

- **Coluna de horas contra as 160h** (decisão do usuário: não).
- **Comparar militares selecionados.** Isso é da Escala por militar (decisão do usuário).
- **Registro formal da permuta.** A permuta com o próprio registro, mostrada no Efetivo do dia e na escala executada, continua na fase 5. *Minha decisão:* nesta entrega, a permuta troca as duas alocações de lugar e a tela a chama de "permuta". O registro próprio vem depois.

## Anti-objetivos

- **Bloquear o escalante.** Choque e voluntariado são avisos. A API só recusa o que já recusa hoje, sempre com o motivo.
- **Grade que muda de lugar ao filtrar.** O filtro só esconde equipes, e a barra continua comparando com todo o efetivo.

## Abordagens consideradas

- **Leitura com o painel do dia (escolhida, decisão do usuário).** A grade só mostra. O painel lateral do dia é onde se mexe: adicionar, trocar e remover. As ações reaproveitam as rotas da Escala do mês (escalar, remover, candidatos).
- **Editar direto na célula** (arrastar e soltar, menu na célula). Foi descartada: a célula tem 2 a 3 blocos pequenos, e a regra do motor precisa de uma lista filtrada ("Escolher militar") para não errar.

## O que fica decidido

1. **Quem aparece** (decisão do usuário):
   - todos os lotados na seção no mês;
   - quem é de fora e foi escalado na seção, num grupo "Outras seções" no fim;
   - *minha decisão:* a equipe e a jornada de cada militar são as da lotação vigente no dia 1 do mês, ou, se ele chegou depois, as da primeira lotação dele no mês;
   - ordem: as equipes pela ordem do ciclo, depois o Adm, depois "Outras seções"; dentro de cada grupo, por antiguidade.
2. **Expediente do Adm:** bloco cinza nos dias úteis (segunda a sexta, sem feriado), quando o militar está lotado e não está afastado. É implícito, não é uma alocação.
3. **Choques:** os do motor (`detectarChoques`), com o expediente implícito do Adm, como na lista "Escolher militar". A célula dos dois dias envolvidos ganha o contorno. Descanso curto não aparece.
4. **Contagens:**
   - PJES e Diárias: as alocações do mês em serviços do tipo `pjes` e `diaria`, na seção.
   - Voluntariado: horas tiradas são a soma das durações dessas mesmas alocações; horas pedidas são a soma dos horários marcados na disponibilidade do mês.
   - *Minha decisão:* a barra compara com o maior valor da coluna em todo o efetivo da grade, e não só nas equipes filtradas.
5. **Painel do dia:** abre por célula e fica no endereço (`?militar=…&dia=…`), para poder ser compartilhado.
   - No computador, é um painel à direita.
   - No celular, ocupa a tela.
6. **Adicionar serviço neste dia:** a lista mostra só onde ele pode entrar naquele dia, em todas as escalas ativas da seção.
   - Cada opção é escala, horário, guarnição e função, ou "Sem guarnição".
   - Ficam de fora as funções já completas e as que pedem uma CNH que ele não tem.
   - Quando há mais de um serviço possível, ele escolhe o serviço.
   - Quem só não marcou o horário no voluntariado aparece com o aviso "não marcou voluntariado", e mesmo assim pode ser escalado.
7. **Trocar:**
   - **Lista:** de um lado, os militares livres que podem ocupar a vaga (a lista "Escolher militar" de hoje); de outro, "Já escalados neste dia", cada um com onde está.
   - **Confirmação:** escolher um escalado mostra "BRAVO está no Ordinário, 20h–08h, Motorista do ABT". Se os dois serviços são ordinários, aparece "Permuta". O botão diz "Trocar os dois" ou "Fazer a permuta".
   - **Validação:** a troca é feita numa transação, e cada militar passa pelas mesmas regras de "escalar" na vaga do outro. Se uma regra recusa, nada muda e o motivo aparece.
   - *Minha decisão:* se um dos dois tem acúmulo de função, a troca é recusada com "Tire os acúmulos antes de trocar".
8. **Atualizações:** toda ação da grade atualiza a grade, a Escala do mês, o Efetivo por dia e as cotas, e o contrário também vale.

## O que fica para quem for planejar

- **Nomes:** rotas, tipos e arquivos.
- **Horários:** reaproveitar a montagem de horários e tipos da elegibilidade (`montarHorarios` e o expediente), sem duplicar.
- **Celular:** rolagem horizontal com o nome fixo à esquerda.
