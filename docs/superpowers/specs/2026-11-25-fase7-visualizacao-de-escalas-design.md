# Fase 7: o militar marca o voluntariado, os estados da escala e a visualização de escalas — design

25/11/2026 · decisões do usuário em 24 e 25/11/2026 (brainstorming) · planos: `docs/superpowers/plans/2026-11-25-fase7-1-…` a `fase7-5-…`, mais a `fase7-3-1-…` · regras tocadas: RN-39, RN-48, RN-105, RN-107, RN-04, RN-46

## Por quê

Hoje o escalante lança o voluntariado de cada militar, e a escala só é vista por quem trabalha no módulo de escalas. A fase 7 abre as duas pontas para o militar: ele diz quando é voluntário, e vê a escala em que foi posto. Ao abrir a escala à corporação, mexer no que já aconteceu deixa de ser coisa do dia a dia: vira exceção, com justificativa e registro.

## Decisões do usuário

### O militar marca o próprio voluntariado (prioridade)

1. O militar marca dias e faixas, **o mesmo dado** que o escalante lança hoje: a página de voluntariado de um militar num mês.
2. Ele marca **na área pessoal**, não na tela do escalante. O módulo de escalas é exclusivo do escalante e do gestor.
3. **A coleta:** o gestor da seção tem, nas configurações do voluntariado, a opção de aceitar o preenchimento de um certo mês. Ele liga e desliga para coletar.
4. **O escalante pode corrigir** o que o militar marcou, mas isso é exceção: a correção fica num registro.
5. **O voluntariado é uma característica do militar:** o que ele preenche na área pessoal vale para todas as seções que querem escalá-lo (a dele e as que o trazem como externo).
6. **O botão do dia:** no quadrado de cada dia, do lado oposto ao número, um botão deixa o militar preencher o dia de forma diferente dos blocos que o gestor configurou, com faixas próprias. O formato do botão ainda não está decidido.
7. **Voluntário JES:** o militar pode marcar mesmo sem o atributo "voluntário JES". Quem barra é a escala: sem o atributo, ele não é escalado no JES nem no PJES (RN-04 e RN-46, que já funcionam).
8. Os blocos do dia, na tela pessoal, vêm das configurações da seção de lotação do militar.

### Os estados da escala

Cada escala, em cada mês, está num destes estados (decisão de 25/11, no fim do dia; substitui "Lançar prévia" e "Recolher prévia" do início do dia):

9. **Rascunho:** o escalante começa a lançar e não quer que ninguém saiba ainda como está, porque é muito precário. Só quem monta a escala vê.
10. **Prévia:** a escala foi mostrada para dar uma noção da distribuição. Os militares sabem que ela ainda pode sofrer alterações pontuais. Só a unidade da escala e as que estão abaixo dela veem; ninguém acima.
11. **Publicada:** a versão final esperada. Todo o efetivo da corporação vê. Daqui para frente, qualquer modificação é uma **retificação**.
12. **Retificada:** a escala teve de ser republicada por causa de um erro ou de algo que precisou ser consertado. Enquanto a correção não é republicada, a escala **continua visível**, marcada com a etiqueta **"Escala em retificação"** (ela não some da publicação).
13. **Remessada:** a escala foi totalmente cumprida e remetida aos superiores, para comprovar carga horária ou cotas.
14. **Quem faz o quê:** o escalante lança a prévia; **só o gestor publica** (e republica).
15. **A trava do passado não depende do estado da escala. Depende da data da mudança:** o turno que já começou só é alterado por gestor, coordenador ou administrador, com justificativa e registro. **Exceção: escala em rascunho não tem trava.** Exemplo do usuário: a escala foi lançada no dia 25 do mês anterior e é retificada no dia 3; o escalante só altera do dia 4 em diante, e o gestor também altera os três primeiros dias, com grandes ressalvas e a necessidade demonstrada (por exemplo, um erro do escalante que só foi percebido no dia do serviço).
16. **Passado é o turno que já começou.** Alterá-lo pede justificativa, e a mudança fica num registro: o valor antigo, o novo, quem alterou, quando e por quê. Só o militar comum não vê o registro.
17. **A escala dos oficiais** só fica aberta a todos depois de publicada; na prévia, só os oficiais da unidade e das de baixo a veem.

### Visualização

18. **Minha escala** simples agora: os próprios serviços do mês e quem compõe cada guarnição. A Escala por militar (fase 8) herda o desenho.

## Escolhas da PLANEJAMENTO

O usuário entregou o "como". Cada escolha abaixo é minha e pode ser corrigida na validação.

### Voluntariado

- **A coleta é por unidade e mês.** O militar pode marcar o mês M quando a coleta de M está aberta na unidade em que ele está lotado em M (a mesma conta de lotação que a tela do escalante já usa). Sem data limite: fecha quando o gestor desliga. Mês passado nunca aceita.
- **Coleta fechada:** o militar continua vendo o que marcou, só não altera. A tela diz "A coleta de dezembro está fechada. Fale com o escalante da sua seção.".
- **Quem liga a coleta:** gestor, coordenador ou administrador da unidade (o escalante não).
- **O escalante continua lançando** quem não preencheu, como hoje, sem registro. **Registro só quando ele altera um mês que o próprio militar preencheu.** A correção não pede justificativa; o registro guarda as faixas de antes, as de depois, quem e quando.
- **Quem tem nível de acesso e marca o próprio voluntariado** pela área pessoal conta como militar, sem registro.
- **O botão do dia** (proposta, a validar): um botão pequeno com o ícone de relógio abre "Outro horário" daquele dia, com pares "das HH:MM às HH:MM" (um ou mais), além dos blocos. O que foi marcado fora dos blocos aparece no dia como uma linha "08:00 às 12:00". Na tela do escalante, a mesma linha aparece (ele precisa ver o que o militar marcou), e ele também pode usar o botão.
- **O aviso:** a tela inicial mostra "O voluntariado de dezembro está aberto" no atalho do módulo enquanto houver coleta aberta para a pessoa.
- **Conta sem militar** (administrador sem ficha): a tela não aparece.

### Estados da escala

**Passagens** (a escala de um mês começa em rascunho; a linha só existe depois da primeira passagem):

| Passagem | Quem faz | Como |
|---|---|---|
| rascunho → prévia | escalante ou gestor da unidade da escala | botão "Lançar prévia" |
| rascunho ou prévia → publicada | só o gestor, coordenador ou administrador da unidade da escala | botão "Publicar" (pode publicar direto do rascunho) |
| publicada ou retificada → em retificação | automática | a primeira mudança numa alocação da escala já publicada acende a etiqueta "Escala em retificação" |
| em retificação → retificada | só o gestor, coordenador ou administrador da unidade | botão "Republicar" |
| publicada ou retificada → remessada | fase 9 | o botão de remessa nasce na fase 9; a 7.3.1 só guarda o estado e a regra |

- **A retificação abre sozinha.** O escalante nunca é impedido de corrigir uma escala publicada; a etiqueta avisa a corporação e pede ao gestor que republique. Não há confirmação antes de mexer.
- **A prévia muda à vontade**, sem etiqueta: é para isso que ela existe. A trava do passado (decisão 15) vale nela.
- **Não há volta de prévia para rascunho** nesta fase. Quem lançou por engano corrige a escala, que ainda é prévia. Se o piloto pedir a volta, entra como entrega nova.
- **Depois de remessada**, só o administrador altera, com justificativa e registro (o gestor e o escalante recebem "Esta escala já foi remessada. Só o administrador altera.").
- **Quem vê a prévia:** quem tem conta de militar lotado hoje na unidade da escala ou numa unidade abaixo dela, e o militar de outra unidade que está escalado nela naquele mês. Quem já lê a escala em montagem por nível de acesso (as camadas da 6.12) continua lendo; a prévia só acrescenta os militares. Na escala dos oficiais, só o oficial.
- **Quem vê a publicada, a retificada e a remessada:** toda conta de militar.
- **O que a corporação vê:** a Escala do mês, só para leitura, sem os candidatos, as pendências de montagem e os botões, com o estado e a etiqueta. As camadas de visão da "escala em montagem" (6.12) continuam valendo para o rascunho.
- **A justificativa** tem no mínimo 10 letras. O escalante recebe "Este turno já começou. Só o gestor altera o passado.".
- **Um registro só** (`registro_de_alteracao`) para as duas exceções: a correção do voluntariado e a alteração do passado. Aparece em dois lugares: na página do voluntariado do militar (tela do escalante) e na Escala do mês ("Alterações no passado").
- **O expediente sem escala** (6.40) e a **rodada dos oficiais** (que tem o seu próprio fechamento e a cobertura) ficam fora da trava do passado nesta fase.

### Visualização

- O módulo "Visualização de escalas" da tela inicial ganha três telas: **Minha escala**, **Meu voluntariado** e **Escalas** (as escalas que a pessoa pode ver no mês, escolhendo a unidade pela árvore).
- **Minha escala** mostra só o que a pessoa pode ver (rascunho não aparece para o militar). Cada serviço: o dia, o horário, o serviço, a escala, a unidade, o estado (a prévia diz "Pode mudar até o dia do serviço"; a etiqueta "Escala em retificação" aparece quando é o caso) e a guarnição com quem a compõe (patente, nome de guerra e função).

## Não objetivos

- O .xlsx e a impressão (fase 8). A Escala por militar e a comparação com outro militar (fase 8). Permutas e busca por permutantes (fase 9).
- O botão de remessa e o envio aos superiores (fase 9); nesta fase o estado existe, mas nada o aciona.
- Voltar de prévia para rascunho.
- Notificar o militar (e-mail, mensagem) quando a escala é publicada ou retificada.
- Prazo automático da coleta.
- Trava do passado na rodada dos oficiais e no expediente sem escala.

## Anti-objetivos

- O militar comum entrar no módulo de escalas, ou ver escala em rascunho, ou prévia de outra unidade.
- Quem está acima da unidade enxergar a prévia sem ter nível de acesso nela.
- O militar marcar o voluntariado de outro militar.
- Alteração no passado de uma escala que não é rascunho sem justificativa ou sem registro.
- A correção do escalante apagar o que o militar marcou sem deixar rastro.
- O escalante ser impedido de montar a escala ou de corrigir uma escala publicada.
- Uma escala publicada mudar sem a etiqueta "Escala em retificação".

## Entregas

| Entrega | O que traz | Modelo | Migração |
|---|---|---|---|
| 7.1 | API do voluntariado: a coleta, o militar marca o próprio, o registro das correções | Sonnet | 0044 |
| 7.2 | Telas do voluntariado: Meu voluntariado, o botão do dia, o interruptor da coleta, o registro | Sonnet | — |
| 7.3 | API da prévia (versão do início do dia: lançar e recolher, a trava do passado com justificativa, o registro) | Sonnet | 0045 |
| 7.3.1 | API dos estados da escala: rascunho, prévia, publicada, retificada e remessada; visibilidade por unidade; a trava do passado fora do rascunho; a retificação automática; as leituras da corporação e a Minha escala | Sonnet | 0046 |
| 7.4 | Tela da montagem: o estado da escala, "Lançar prévia", "Publicar", "Republicar", a etiqueta, a justificativa, "Alterações no passado" | Sonnet | — |
| 7.5 | Módulo Visualização: Minha escala e Escalas, com o estado | Sonnet | — |

Ordem: 7.1, 7.2, 7.3, 7.3.1, 7.4, 7.5. A 7.1 e a 7.2 são a prioridade e já servem ao piloto (coletar o voluntariado de janeiro).

## Regras a atualizar no catálogo (PLANEJAMENTO, quando cada entrega for ao ar)

RN-39 (o próprio militar marca: "Funciona"), RN-107 (faixas fora dos blocos), e regras novas para a coleta, os estados da escala, o passado com justificativa e o registro.
