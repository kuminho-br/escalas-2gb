# Meta de ativação e Efetivo do dia — design

20/11/2026 · decisões do usuário em conversa de 19 e 20/11/2026 · aprovado em 20/11/2026 (o usuário pediu os planos de implementação)

## Por que

A escala ordinária existe para cumprir a **meta de ativação**: um certo número de guarnições que a seção precisa pôr na rua a cada dia. A meta vem de um escalão acima, e a seção pode cumpri-la ou não. Até aqui o sistema girava em torno da "escala", e isso confundia duas coisas: a escala é **publicação e prestação de contas**, mas o que importa no dia a dia é **ativar guarnições**. Os serviços (Pronto, Saldo, JES, diárias) são os meios e as restrições: dizem de onde vem a hora, quem pode cumprir e em que horário.

O chefe da seção configura a meta, e o escalante aloca os militares para cumpri-la. O objetivo é ativar o máximo de guarnições da meta, ao longo do mês, na ordem de ativação.

## Vocabulário (vale a partir de agora)

| Termo | O que é |
|---|---|
| **Meta de ativação** | A lista de guarnições que devem ser ativadas num dia, com a ordem de ativação de cada uma. |
| **Meta padrão** | A meta que todo dia recebe. É configuração do nível hierárquico. |
| **Dia diferente** | Um dia cuja meta o chefe alterou. Ele passa a ter a meta própria. |
| **Ordem de ativação** | A prioridade de cada guarnição dentro da meta: qual pesa mais quando falta gente. |
| **Ordem de escalação** | Novo nome da antiga "ordem de escala": a sequência em que o sistema preenche as vagas para aproveitar melhor os recursos. |
| **Modelo de guarnição** | O que hoje se cadastra em "Guarnições": a composição (funções, mínimo, máximo, CNH). É um molde. |
| **Guarnição (do dia)** | A instância: um modelo que ganhou militares alocados num dia. |
| **Efetivo por dia** (era "Efetivo do dia") | A tela em que o escalante navega pelos dias e escala com a visão diária, atravessando todas as escalas da área. Ver o adendo de 20/11/2026 (depois da 3.2.2). |
| **Escala do dia** | O documento que publica quem está de serviço num dia, incluindo as permutas (módulo de visualização, fora deste design). |
| **Escala** | Agrupamento de serviços para a prestação de contas mensal e lugar onde se diz quais serviços guarnecem quais modelos. A fonte da escala (quem a pede) fica fora do sistema. |
| **Cota** | Limite mensal de quantas vezes se pode escalar militares num serviço de PJES ou diária. |

**Ordem de ativação × ordem de escalação, em uma frase:** uma guarnição ser mais importante que outra não quer dizer que todos os militares da guarnição mais importante devam ser alocados antes. A ordem de escalação atual é tratada como teste, e a relação entre as duas fica **adiada** (decisão do usuário).

## Objetivos

- O chefe configura a meta padrão e altera qualquer dia como quiser, sem preencher 30 dias à mão.
- O escalante vê, no Efetivo do dia, as guarnições da meta, se cada uma foi ativada e, se não, o que falta e em que horário.
- As cotas restantes aparecem na Escala do mês e no Efetivo do dia (barreira de suporte).
- A automação deixa de depender de nomes digitados pelo usuário.

## Não objetivos (desta etapa)

- Alocar militares direto no Efetivo do dia (vai para a 3.3).
- "Completar com JES" num dia ou período escolhido pelo chefe (barreira de automação, vai para a 3.3).
- Relacionar ordem de ativação e ordem de escalação.
- Presença e impressão do efetivo do dia (fase 5) e o documento "escala do dia" (módulo de visualização).
- Reorganizar o menu inteiro (ideia guardada para depois, abaixo).

## Anti-objetivos

- O sistema decidir sozinho em que dias gastar as cotas. Os dias são decisão do chefe.
- Uma guarnição mudar de lugar no painel por não estar ativada. A não ativação não muda a posição dela (decisão do usuário).
- Bloquear o escalante. Guarnição não ativada é aviso, nunca impede de fechar a escala.

## Abordagens consideradas

**Como guardar a meta de cada dia**
- **Meta padrão + dias diferentes (escolhida).** Todo dia nasce com a meta padrão; o chefe altera um dia ou um intervalo, e esses dias guardam a meta própria. Quando a meta padrão muda, vale dali em diante. Os dias passados e os dias alterados à mão não mudam.
- **Copiar a meta para todos os dias do mês.** Funciona, mas cada mudança definitiva obrigaria a reescrever os dias restantes e a decidir o que fazer com os já alterados.
- **Só "a partir de tal dia".** Reprovada pelo usuário: a meta muda de várias formas, e o chefe precisa mexer em qualquer dia.

Custo computacional: dez guarnições por dia são umas 3.650 linhas por seção por ano, bem menos que as alocações. Não pesa.

**Onde ficam os modelos de guarnição**
- **A. Só os modelos vão para Configurações (escolhida para a 3.2).** Saem do menu e entram em Configurações, ao lado da meta padrão. A tela de detalhe com as versões continua, só muda de lugar.
- **B. Reorganizar o menu inteiro.** Serviços, Escalas e Feriados também são configuração; o menu ficaria só com o dia a dia (Escala do mês, Efetivo do dia, Voluntariado, Cotas, Militares). Guardada como ideia para depois, para não inchar a entrega.

**O que o Efetivo do dia faz na 3.2**
- **Só mostra, com atalho para a Escala do mês (escolhida para a 3.2).** Cada buraco abre a Escala do mês daquela escala, naquele dia.
- **Alocar no painel.** Decidido pelo usuário, mas na **3.3**, junto com o "completar", porque as duas usam a mesma peça (escolher militar fora de uma escala e de um turno fixos).

**Como evitar que a automação dependa de nomes**
- **Serviços fixos (escolhida, ideia do usuário).** O sistema cria Pronto, Saldo, JES e Expediente em cada seção, e o usuário não pode mudar o nome deles.
- **Campo "quem cumpre" no serviço ordinário.** Proposta anterior, trocada pela dos serviços fixos, que não pede cadastro novo.

## O que foi decidido

### 1. Meta de ativação

- A meta é uma **lista de modelos de guarnição com a ordem de ativação**. Vale **por dia**, não por turno, porque os turnos variam.
- **Meta padrão:** configuração do nível hierárquico, em Configurações. Mudar a meta padrão vale dali em diante; os dias passados e os dias diferentes não mudam.
- **Dia diferente:** o chefe altera um dia ou um intervalo de dias (acrescenta, tira ou reordena guarnições). Um dia diferente pode voltar ao padrão.
- *Minha decisão:* cada nível hierárquico define a sua meta padrão com os seus próprios modelos, sem herdar a do nível de cima (a meta é de quem ativa as guarnições).
- *Minha decisão:* a meta padrão e os dias diferentes são editados por quem já edita os parâmetros da seção.
- *Minha decisão:* a meta padrão é editada em Configurações, e o dia diferente é editado no próprio Efetivo do dia. **Substituída** no adendo de 20/11/2026 (depois da 3.2.2): o dia diferente nasce da manipulação das guarnições na tela, sem diálogo próprio, e a alteração de um intervalo de dias foi abandonada.

### 2. Quando uma guarnição está ativada

- A guarnição só conta como **ativada** se **fechar ao longo de todo o serviço** (decisão do usuário): toda função obrigatória com o mínimo de militares em todos os momentos.
- *Minha decisão:* "todo o serviço" é a soma dos horários em que o modelo está vinculado naquele dia, em qualquer escala. Um Resgate vinculado ao Ordinário de 08–20 e de 20–08 precisa fechar as 24 horas. O turno que atravessa a meia-noite pertence ao dia em que começa.
- **Uma viatura só:** se o mesmo modelo está vinculado em duas escalas no mesmo dia (ex.: Resgate no Ordinário e no PE Seguro), é uma guarnição só, com militares do Pronto e da diária misturados (decisão do usuário).
- **Dois militares na mesma função:** numa função de um turno maior podem entrar dois militares de turnos menores (decisão do usuário). Ex.: o militar da diária de 08–16 mais outro de 16–00 fecham a vaga do Pronto de 08–20. A conta passa de "cabeças por turno" para "horário coberto". O banco já permite (a alocação não tem número de vaga).
- *Minha decisão:* o acúmulo de funções (entrega 1.1) também cobre a função, no horário da alocação de quem acumula.

### 3. Efetivo do dia (painel do escalante)

- Mostra as guarnições da meta do dia **na ordem de ativação**. A posição não muda pelo estado (ativada ou não).
- Em cada guarnição: se está ativada; se não, qual função falta e em que horário; e cada militar com a função, o horário e o serviço por onde entrou.
- Cada buraco tem um atalho para a Escala do mês da escala que vincula aquela guarnição naquele horário, já no dia.
- No topo, as cotas restantes do mês e quantas guarnições da meta foram ativadas.

```
Efetivo do dia: 12/11        JES: restam 26 de 40 | Bioma: restam 14 de 20
Meta do dia: 3 guarnições, 1 ativada                 [Alterar a meta deste dia]

1º Resgate   ativada
   Motorista   Sd Alfa     08–20   Pronto
   Auxiliar    Sd Bravo    08–16   PE Seguro
               Sd Charlie  16–20   Saldo
2º ABT       não ativada: motorista descoberto 20–08     [Abrir na Escala do mês]
3º ACO       não ativada: faltam 2 auxiliares 08–20      [Abrir na Escala do mês]
```

### 4. Cotas

- As cotas são mensais e dizem quantas vezes se pode escalar militares num serviço. O chefe gerencia esses serviços ao longo do mês para ativar o máximo de guarnições.
- Na 3.2, as **cotas restantes** aparecem na Escala do mês (as dos serviços da escala) e no Efetivo do dia (as da seção), no formato "JES: restam 26 de 40".
- *Minha decisão:* restante = quantidade da cota do mês − alocações do mês naquele serviço, somando as origens interna e externa.
- O campo **"conta para a meta"** da cota sai: todo serviço conta para a meta.
- Na 3.3: o chefe escolhe um dia ou período e pede "completar com JES"; o sistema preenche as guarnições pela ordem de ativação e desconta da cota.

### 5. Serviços fixos

- O sistema cria **Pronto, Saldo, JES e Expediente** em cada seção. O código depende deles: pré-escala (Pronto), saldo do Adm (Saldo), só voluntário e emenda proibida JES → Pronto (JES), e jornada Adm (Expediente).
- **Trava:** nome, tipo e exclusão. **Fica livre:** horários dos turnos, cor e vínculo com escalas. O usuário pode desvincular o serviço de uma escala.
- *Minha decisão:* os que já existem com esses nomes são marcados como fixos, sem criar duplicados; os que faltam são criados.
- Diárias e PJES (Bioma, PE Seguro) continuam cadastro livre; a regra delas vem do tipo.
- Os mecanismos ficam no código: jornada Pronto entra pela equipe, no ciclo; jornada Adm cumpre N saldos por mês (parâmetro); PJES e diária são voluntários, até a cota.

### 6. Modelos de guarnição em Configurações

- "Guarnições" passa a se chamar **"Modelos de guarnição"** e sai do menu para uma aba de Configurações, ao lado da aba **"Meta de ativação"**. A tela de detalhe com versões continua, no novo endereço.
- *Minha decisão:* o endereço antigo redireciona para o novo.

### 7. Ordem de escalação

- "Ordem de escala" passa a se chamar **"ordem de escalação"** em toda a tela e no código (30 ocorrências em 14 arquivos).
- *Minha decisão:* as tabelas do banco mantêm o nome atual, para não ter migração só de nome.

## Divisão em entregas

- **3.2.1 — Arrumação:** serviços fixos, "ordem de escalação" e modelos de guarnição em Configurações. Remove "conta para a meta".
- **3.2.2 — Meta e Efetivo do dia:** meta padrão, dias diferentes, regra de ativação por horário coberto, o painel e as cotas restantes na Escala do mês e no Efetivo do dia.
- **3.3 (era a 3.2):** alocar no Efetivo do dia, "completar com JES" num dia ou período, saldos do Adm, operações pelas cotas, turnos lado a lado na Escala do mês e a tela de login nova.

*Minha decisão:* a tela de login nova acompanha o resto da antiga 3.2 e vai para a 3.3.

## Pendências e ideias guardadas

- Relação entre ordem de ativação e ordem de escalação (adiada pelo usuário).
- Decisões da antiga 3.2, para detalhar a 3.3. A da ordem dos buracos ficou em parte respondida: no modelo atual do Ordinário, o Saldo vem antes do JES, e isso é configuração, não código.
- Reorganização do menu inteiro (opção B).
- **Guarnição escalada sem estar na meta** (decisão do usuário, 20/11/2026): aparece no painel normalmente, sem rótulo e sem contar para a meta. Nada muda por ela não estar na meta, assim como nada muda para a guarnição da meta que não foi ativada (fica na posição comum dela). *Minha decisão:* como não tem ordem de ativação, a posição comum dela é depois das guarnições da meta, na ordem do nome do modelo.

## Adendo de 20/11/2026 — Efetivo por dia (feedback depois da 3.2.2)

A 3.2.2 (PR #39, mesclado em 20/11) entregou o painel como consulta do dia de hoje. O usuário corrigiu a leitura: a tela é de **trabalho**, não de consulta. O motor de ativação, a meta no banco e a API continuam valendo; muda a tela, na **entrega 3.3**.

**1. Nome e propósito (decisão do usuário).** "Efetivo do dia" passa a se chamar **"Efetivo por dia"**. A ideia não é mostrar o dia de hoje: o escalante **navega pelos dias** e **escala com a visão diária**, em vez da mensal. É uma visão transversal da área, atravessando as várias escalas mensais. Escalar na própria tela (já previsto para a 3.3) passa a ser o centro dela.
- *Minha proposta, a confirmar no design da 3.3:* a tela abre no último dia em que o escalante estava; na primeira vez, no dia 1 do mês escolhido, com seletor de mês como o da Escala do mês.

**2. Linha do tempo por guarnição (decisão do usuário).** A lista atual repete o militar a cada turno ("DÁRIO 08h–20h", "DÁRIO 20h–08h") e separa a falta de onde ela acontece. Cada guarnição passa a mostrar **como as funções são ocupadas ao longo do dia**, como na lógica do voluntariado: as **vacâncias aparecem na própria linha do tempo**.

```
1º Incêndio  ABT                                        ativada
            08h               20h         00h        08h
              D                            │  D+1
Chefe        ████ ST DÁRIO ████████████████████████████   Pronto
Motorista    ████ 3º SGT ADEILDO ██████████████████████   Pronto
Aux. linha   ████ IZAIAS ███████████████  ░░ vaga ░░░░░   (falta 20h–08h)
```

- *Minha proposta:* uma linha por vaga (função × mínimo), com a régua D / D+1 que já existe na tela de Serviços (`ReguaDoDia`); quem emenda turnos vira uma barra só; o trecho ocupado leva a cor do serviço; a vaga é um trecho destacado na linha e, na 3.3, é por ela que se escala.
- Isso resolve de passagem o menor adiado "falta de 24h aparece como 08h–08h".

**3. Meta do dia implícita (decisão do usuário).** Sai o botão e o diálogo "Alterar a meta deste dia". A meta do dia passa a ser **consequência da manipulação das guarnições** na tela:

| Ação no Efetivo por dia | Efeito na meta daquele dia |
|---|---|
| Remover uma guarnição | sai da meta do dia. Se houver gente escalada nela, o sistema **pergunta se quer desescalar** também (decisão do usuário, opção b); se não, a guarnição fica na tela fora da meta, sem número |
| Adicionar uma guarnição | entra no fim da meta do dia |
| Mudar a ordem | muda a ordem de ativação do dia |
| Voltar ao padrão (só quando o dia foi mexido) | desfaz a meta própria do dia |

- **Escalar alguém numa guarnição fora da meta não a põe na meta** (decisão do usuário, opção b): ela fica fora da meta até o escalante adicioná-la.
- **Alterar vários dias de uma vez foi abandonado** (decisão do usuário). Mudança que vale por um período vai pela meta padrão com data. *Minha decisão:* o campo "Até" sai da tela; se a API o mantém ou não fica para o plano da 3.3.
- A meta padrão continua em Configurações › Meta de ativação, como na 3.2.2.

**Escopo da 3.3 (decisão do usuário, 20/11/2026):** uma entrega só, com o Efetivo por dia refeito e escalar nele, os turnos lado a lado na Escala do mês e a tela de login nova. "Completar com JES", saldos do Adm e operações pelas cotas saem da 3.3 e esperam entrega marcada. Plano: `docs/superpowers/plans/2026-11-18-fase4-escala.md`, Tarefas 46 a 53.

**4. As quatro telas principais e a "Escala por militar" (decisão do usuário).**

| Tela | Quem | Quando |
|---|---|---|
| Grade geral | todos os militares | o mês |
| Escala do mês | uma escala (operação) | o mês |
| Efetivo por dia | todas as escalas da área | um dia |
| **Escala por militar** (nova) | militares escolhidos | o mês |

Na **Escala por militar**, o escalante seleciona militares e vê como estão distribuídos ao longo do mês, comparando-os (ex.: dois militares e o cruzamento das escalas deles). É uma **entrega maior**, a planejar com cuidado: o usuário pediu à sessão de **PLANEJAMENTO** que comece a trabalhar na estrutura das quatro telas. Não entra na 3.3.

## O que fica para quem for planejar

- Nomes de tabelas e rotas da meta (padrão com vigência por data, dias diferentes por data).
- Como calcular a cobertura por horário: reaproveitar os minutos usados no voluntariado por faixa.
- A forma dos controles de "Alterar a meta deste dia" e da aba "Meta de ativação", seguindo as telas de quadrados da ordem de escalação.

## Adendo de 20/11/2026 — validação da 3.3 (entregas 4.1, 4.2 e 5.1)

O usuário testou a 3.3 na sandbox (sessão de VALIDAÇÃO) e pediu mudanças no Efetivo por dia e na Escala do mês. As decisões abaixo são dele; as minhas estão marcadas.

**Por que:** a meta do dia é uma **diretriz de emprego dos recursos, não uma obrigação rígida**. O escalante precisa ligar e desligar guarnições no dia sem perder o caminho de volta, e ler a tela de relance (muitas guarnições, serviços em cores parecidas).

### Onde entra (regra: o número da entrega é a ordem de execução)

| Entrega | O que entra | Por que nesse momento |
|---|---|---|
| **4.1 — Meta do dia: desativar, reativar e adicionar** | os defeitos da 3.3 na meta e a troca de "Tirar da meta" por "Desativar guarnição" | defeito numa tela do piloto; o "completar com JES" (ainda sem entrega) preenche pela meta do dia e depende desta regra; pequena, sem migração |
| **4.2 — Efetivo por dia e Escala do mês em grade** | grade de cards, régua fora, vaga em faixa única, etiqueta do serviço; Escala do mês com uma barra só e dias em grade | muda o jeito de escalar durante o piloto; a fase 5 constrói em cima desta tela; quase só site, sem migração |
| **5.1 — O mesmo modelo de guarnição mais de uma vez no dia** | duas ABT do mesmo modelo no mesmo dia | muda banco, vínculos, Escala do mês e pré-escala (entrega grande, com migração); até lá, cadastrar um segundo modelo ("ABT 2") resolve. Depende da 4.1 (o "Adicionar guarnição" que lista todos os modelos) |

### Ficam como estão (decisão do usuário)

- **O dia continua sendo o dia do calendário** (00h a 24h, com o que passa da meia-noite indo até o fim do turno). A ideia do "dia de serviço 08h→08h" foi descartada: se o horário padrão de um serviço mudar, toda a estrutura das barras quebra, e a Defensoria (07h) cairia no dia errado por 1h. Onde a escala de uma guarnição não se aplica, a linha fica vazia.
- **Adiados:** o selo "ativada / não ativada" (que confunde com "Desativar") e o tom do aviso "Falta…".

### 4.1 — Meta do dia

- **"Desativar guarnição"** substitui "Tirar da meta". É como dizer "hoje não vai ter essa guarnição":
  - **sempre desescala** quem está nela no dia (as alocações e os acúmulos nela, como no "Tirar e desescalar" da 3.3, com a marca de remoção). Sai a opção "Só tirar da meta";
  - **pede confirmação antes**, só quando há gente escalada: "Desativar a 1ª Incêndio? Quem está escalado nela neste dia será desescalado." com "Desativar" e "Cancelar". Sai a frase "Há N militares escalados no … neste dia.";
  - depois de desativar, aparece por alguns segundos o aviso "Guarnição desativada." com **"Desfazer"**, que volta a meta e as escalações como estavam.
- **"Desativadas hoje"**: a viatura não some. Fica num grupo no fim da tela, em card pequeno (nome, sigla da viatura e **"Reativar"**). *Minha decisão:* são as guarnições da **meta padrão** daquele dia que não estão na meta do dia. "Reativar" põe a guarnição no fim da meta do dia, vazia. Guarnição que só entrou pelo "Adicionar" e foi desativada não volta para esse grupo (basta adicioná-la de novo).
- **"Adicionar guarnição"** lista **todos os modelos de guarnição ativos** da seção (Configurações). Até a 5.1, os que já estão na meta do dia aparecem marcados "já está no dia" e não podem ser escolhidos.
- **"Voltar ao padrão"** fica **sempre visível** para quem escala; apagado (desabilitado) quando o dia já segue o padrão. Hoje ele some quando o dia volta ao padrão, e o escalante não acha o botão. *Minha decisão:* ele pede confirmação ("Voltar este dia à meta padrão?") e **não desescala ninguém** — quem estiver numa guarnição que sai da meta continua escalado, e o card fica fora da meta, sem número, como já acontece.
- "Subir" e "Descer" continuam (na 4.2 viram "Mover antes" e "Mover depois").

### 4.2 — Efetivo por dia

- **Cards em grade:** as guarnições se distribuem em colunas conforme a largura (cerca de três no computador, uma no celular). A ordem da meta vale da esquerda para a direita e depois para baixo; por isso "Subir" e "Descer" viram **"Mover antes" (←)** e **"Mover depois" (→)** (*minha decisão*, aprovada).
- **A régua sai.** As linhas de todos os cards continuam na **mesma escala de horas** (a janela do dia), sem a régua desenhada; as linhas vinho de 00h e 24h e o "D/D+1" saem junto. Cada trecho mostra o horário dentro dele ("08h–20h") quando cabe, e sempre no nome acessível.
- **Vaga em faixa única:** a vaga não vem mais cortada nos horários dos vínculos (o Bioma aparecia em três pedaços de 8h). Cada trecho livre de uma função é **uma faixa só**; ao escalar alguém, a faixa se divide e o que sobra continua clicável.
  - Ao clicar na faixa, se houver mais de um horário possível, o escalante escolhe **"Qual horário?"** entre os **turnos cadastrados** das escalas vinculadas à guarnição que caem na faixa ("08h–20h · Ordinário", "08h–16h · PE Seguro"). A escolha define a escala e substitui o "Por qual escala?". Com um horário só, abre direto o "Escolher militar".
  - Não existe horário digitado à mão.
- **Etiqueta do serviço:** além da cor, cada trecho ocupado mostra o **nome do serviço** num retângulo de bordas arredondadas, como as etiquetas "PJES" e "SALDO" do mockup do usuário.
  - **A cor é a que o usuário cadastrou para o serviço** (não há cor fixa no código). Sobre a barra, que já tem a cor do serviço, a etiqueta é de contorno, na cor de texto legível sobre aquela cor (`corDoTexto`); fora da barra, é cheia (fundo na cor do serviço, letra por `corDoTexto`).

### 4.2 — Escala do mês

- **Uma barra só por dia:** saem as barras coloridas à esquerda de cada turno (hoje marcam dia/noite). Fica uma barra, entre o número do dia e os turnos.
- **Etiqueta do serviço no título de cada turno** ("08h–16h B" + etiqueta "Bioma" na cor do serviço), no mesmo componente do Efetivo por dia.
- **Dias em grade quando a escala tem um turno por dia** (Defensoria, CPRH): os dias ficam lado a lado (três ou quatro por linha no computador, um no celular). Escala com mais de um turno em algum dia do mês (Bioma, Ordinário) continua com um dia por linha. Não é um calendário de 7 colunas: os cards ficariam estreitos demais.

### 5.1 — O mesmo modelo mais de uma vez no dia (só a decisão; design a fazer)

O usuário quer poder pôr o mesmo modelo duas vezes no mesmo dia (ex.: duas ABT). Hoje cada alocação aponta para o modelo (`alocacao.guarnicao_id`) e a meta do dia recusa modelo repetido (`unique (meta_dia_id, guarnicao_id)`), então o sistema não saberia em qual das duas ABT está cada militar. Antes de planejar, decidir com o usuário: como se chamam as duas na tela; de onde vêm as vagas da segunda (os vínculos da escala são por modelo); como a pré-escala e a Escala do mês tratam a segunda; o que acontece com ela no dia seguinte.
