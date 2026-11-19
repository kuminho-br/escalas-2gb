# Ordem de escala e acúmulo de funções — design

Data: 18/11/2026. Decidido em conversa com o usuário (escalante da 1ª SB / 2º GB).
Entra na Fase 4 como **entrega 1.1 (acúmulo de funções)** e **entrega 2.1 (ordem de escala)**, antes da entrega 3 (pré-escala), que passa a usar a ordem.

## Por quê

O usuário quer que o preenchimento do mês comece o mais automatizado possível. Para a pré-escala acertar, ela precisa saber **em que vez cada vaga é preenchida**, e essa vez não é por guarnição em bloco: o escalante começa pelo graduado de dia (o mais antigo do operacional), depois os motoristas, o chefe da ABT, os combatentes da ABT, o chefe da AR, os resgatistas, e assim por diante. Hoje o sistema só tem a prioridade da guarnição inteira (RN-08), que não expressa isso.

Nas escalas reais de SBs com pouco efetivo (2ª, 3ª, 5ª, 6ª SB, novembro/2026, em `docs/fontes de dados`), quando falta gente um militar **acumula funções**: a linha sai como "MOTORISTA / CHEFE / GRADUADO", "MOTORISTA / CHEFE", "CHEFE / GRADUADO". O sistema precisa permitir isso sem que a automação tente adivinhar.

## Objetivos

- O escalante define, por escala, a **ordem de escala**: a sequência em que cada vaga (guarnição + função + nº da vaga) é preenchida. Totalmente editável.
- A pré-escala (entrega 3) segue a ordem **à risca**: de cima para baixo, o mais antigo apto disponível em cada vaga; quando falta gente, sobram vazias as últimas vagas da ordem.
- O escalante resolve à mão os casos esparsos, inclusive **acumulando funções** num militar já escalado.

## Não objetivos

- A automação não acumula funções, não "protege" guarnições incompletas e não troca a ordem sozinha.
- Não há lista de acúmulos permitidos (decisão do usuário: acúmulo livre, só com requisitos). Pode entrar depois se aparecerem erros na prática.
- A ordem dos nomes das funções acumuladas no documento fica para a entrega 5 (gerar documento), combinada com o usuário.

## Anti-objetivos

- O escalante nunca fica bloqueado de fechar a escala: vaga fora da ordem, ordem desatualizada ou acúmulo nunca impedem salvar.
- A tela da ordem não pode virar um cadastro pesado: um clique por vaga para montar, setas para ajustar.

## Abordagens consideradas

**Como guardar a ordem de escala**

1. **Ordem com vigência própria, na escala** — escolhida pelo usuário. Cadastro separado dos vínculos de guarnição, com "vale a partir de" (mês). Cada edição muda sozinha: mexer na ordem não cria versão de vínculos e vice-versa. Custo: duas vigências na mesma escala.
2. Ordem dentro da versão do vínculo de guarnições. Tudo num lugar, mas mexer só na ordem criaria versão nova dos vínculos e mexer nos vínculos obrigaria a refazer a ordem na mesma gravação. Recusada.
3. Ordem na própria guarnição (como a prioridade de hoje). Descartada: a ordem cruza guarnições e pertence à escala.

**Como modelar o acúmulo**

- A. Função composta cadastrada ("Motorista / Chefe / Graduado") com composição reduzida. Recusada: explosão de combinações e requisitos (CNH) repetidos.
- **B. Acúmulo como escolha do escalante entre vagas, com os requisitos de cada uma** — escolhida. Funções continuam separadas; o documento junta os nomes.
- C. Formações por efetivo (completa, reduzida, mínima) por guarnição. Recusada: muito cadastro e repete parte do problema da A.

A guarnição fundida da 5ª e 6ª SB ("UNIDADE TÁTICA DE INC/APH/SALV") é só uma guarnição cadastrada com esse nome, sem regra nova (aprovado).

## Parte 1 — Ordem de escala (entrega 2.1)

### Regras

- **Uma ordem por escala**, não por faixa. Cada vaga de uma guarnição tem **a mesma vez em qualquer turno** em que a guarnição sai nessa escala. Numa faixa, a pré-escala considera só as vagas das guarnições presentes nela, mantendo a ordem relativa.
- **Item da ordem = vaga**: guarnição + função + número da vaga dentro da função (1º combatente, 2º combatente…). Uma função de mínimo 2 e máximo 4 dá 4 vagas: 2 obrigatórias e 2 extras. **Extras também são ordenados** individualmente (ex.: o 3º combatente da ABT pode vir depois de todos os mínimos da AR).
- **Vigência por mês**, como os vínculos: a ordem em vigor num mês é a de maior "vale a partir de" até ele. Mudar a partir de dezembro não mexe em novembro.
- **Vagas sem número**: quando a escala ganha uma guarnição (vínculo novo) ou uma composição aumenta, as vagas novas ficam fora da ordem. A tela avisa ("Falta: …") e a pré-escala as preenche **depois de todas as vagas da ordem**, na ordem atual de exibição (guarnição, depois composição). Vagas que deixaram de existir (guarnição saiu, máximo diminuiu) somem da lista sem erro.
- **Substitui a prioridade da guarnição (RN-08)**: o campo `prioridade` deixa de ser editável na guarnição. Enquanto uma escala não tiver ordem cadastrada, vale a prioridade antiga como ordem padrão (guarnição por prioridade, depois as funções na ordem da composição), para não quebrar o que já existe. A tela da escala do mês passa a ordenar os cards pela primeira vaga de cada guarnição na ordem.
- O catálogo RN-XX deve ganhar a regra nova (ordem de escala por vaga) e marcar a RN-08 como substituída — o usuário atualiza o catálogo; a PROGRAMAÇÃO registra no roadmap.

### Quem vai em cada vaga (decisão do usuário, 18/11)

- **Critério único para todas as vagas**: na vez de cada vaga, a pré-escala põe **o mais antigo apto** (antiguidade já cadastrada). Só os requisitos da vaga filtram (CNH pela hierarquia do CTB, lotação, afastamento, voluntariado etc.). A vaga **não** tem critério próprio.
- O escalante resolve a maior parte do dilema **montando a ordem pensando na antiguidade** (ex.: chefe da ABT antes do motorista, se o chefe deve ser mais antigo).
- **Pendência registrada (não implementar agora)**: algumas vagas têm regra própria na prática — graduado de dia = o mais antigo de todos do dia (exceto Adm); chefe de guarnição = o mais antigo dentro da guarnição; motorista = regra de CNH (essa já existe). Modelar regras por vaga de forma genérica, a cargo do usuário, fica para depois, se a prática mostrar necessidade.
- **A confirmar na entrega 3** (não muda a 2.1): a pré-escala percorre a ordem inteira com o Pronto da equipe do dia, depois completa os buracos com JES e por último com Saldo (o "tapa-buraco").

### Tela "Ordem de escala"

Acesso pela ficha da escala (escalante, gestor, administrador da unidade). No estilo do calendário do voluntariado:

```
Ordem de escala — Ordinário        Vale a partir de [dez/2026]   [Limpar] [Salvar]

Graduado de dia   [1 Graduado]
ABT               [4 Chefe] [2 Motorista] [5 Combatente] [6 Combatente] [ Combatente+ ]
AR                [7 Chefe] [3 Motorista] [8 Resgatista] [9 Resgatista]

Clique nos quadrados na ordem em que devem ser preenchidos.
Clique num quadrado numerado para tirá-lo da ordem (os seguintes sobem um).
9 de 10 vagas na ordem. Falta: Combatente+ da ABT.
```

- Cada guarnição da escala aparece **uma vez** (todas as faixas juntas), com um quadrado por vaga; obrigatórias cheias, extras tracejadas.
- Clique num quadrado sem número: recebe o próximo número. Clique num numerado: sai da ordem e os seguintes sobem um.
- Ao lado, **a mesma ordem em lista** (1, 2, 3…) com setas subir/descer para ajustar sem refazer tudo.
- "Limpar" zera a ordem pendente; "Salvar" grava a partir do mês escolhido. Segue os padrões dos cadastros (alterações pendentes, sem clique duplo).
- Teclado: setas movem entre quadrados, espaço numera/tira (como no voluntariado).

## Parte 2 — Acúmulo de funções (entrega 1.1)

### Regras

- **Livre com requisitos**: na escala do mês, para uma vaga vazia, o escalante pode escolher um militar **já escalado na mesma faixa de horário da mesma escala**, inclusive em outra guarnição. Ele passa a ocupar as duas vagas. Não há limite de quantas (as escalas reais mostram três).
- **Requisitos de cada vaga valem**: a CNH exigida da vaga acumulada é conferida (hierarquia do CTB já implementada). Os demais motivos de "fora" que dependem do militar e do horário (lotação, afastamento, voluntário JES, voluntariado no horário) já foram satisfeitos pela vaga original, porque é o mesmo turno; a CNH e quaisquer requisitos próprios da função são conferidos de novo.
- **Contagem**: horas e serviço contam **uma vez** (é um turno só). No resumo "N de M", cada vaga acumulada conta como preenchida. A conferência de choque de horário não acusa acúmulo.
- **A automação nunca acumula.**
- **Quem pode acumular** (chamada da PROGRAMAÇÃO): só quem já ocupa uma vaga de guarnição na faixa. Quem está em "Sem guarnição" não aparece em "Acumular" (o escalante remove e escala na vaga). O mesmo militar não acumula duas vagas da mesma função na mesma guarnição (não é 1º e 2º combatente ao mesmo tempo).
- **Remover**: remover o militar da vaga original remove também os acúmulos dele naquela faixa (pergunta antes, listando). Remover só um acúmulo tira só aquela vaga. Remover um acúmulo não cria marca de remoção (o militar continua no turno).

### Na tela da escala do mês

- No diálogo "Escolher militar" de uma vaga, uma seção **"Acumular com quem já está na faixa"** lista os militares escalados na faixa que cumprem os requisitos da vaga, com a vaga que já ocupam. Os que não cumprem entram no "ficaram de fora" com o motivo (ex.: "Sem a CNH exigida").
- No card, a linha do militar numa vaga acumulada leva uma marca discreta: **"acumula com Chefe ABT"** (aprovado pelo usuário).
- No documento (entrega 5), a linha junta as funções ("MOTORISTA / CHEFE / GRADUADO"); a ordem dos nomes será combinada.

### Guardar o acúmulo (proposta de modelagem, a confirmar no plano)

A tabela `alocacao` tem `unique (militar_id, data, servico_id, turno_id)`: o mesmo militar não pode ter duas alocações no mesmo turno do mesmo serviço. Por isso o acúmulo **não** é uma segunda alocação: é uma tabela de **vagas a mais de uma alocação** (`alocacao_acumulo`: alocação, guarnição, função), apagada junto com a alocação. Assim as horas contam uma vez por construção e o choque de horário não muda. Fica com o construtor confirmar no plano; o comportamento acima é o que vale.

## Sequência das entregas (chamada da PROGRAMAÇÃO)

1.1 → 2 → 2.1 → 3, cada uma num branch novo saído da `main` depois do merge da anterior (a entrega 1 está no PR #28). As duas mexem em `escala/leitura.ts`; a sequência evita conflito e fixa a numeração das migrações.

## Importação e tela da ordem (chamadas da PROGRAMAÇÃO)

- A importação da planilha continua lendo PRIORIDADE só para a **ordem padrão** (quando a escala não tem ordem cadastrada); não grava ordem de escala.
- A tela da ordem mostra as vagas dos vínculos e composições **em vigor no mês do "vale a partir de"** escolhido. Se num mês seguinte a composição mudar, as vagas novas aparecem como "Falta: …" ao abrir a ordem nesse mês.

## Restrições

- Sistema novo (API Hono + Postgres, site React); o protótipo Apps Script não muda.
- Dados fictícios nos testes (D7).
- Uma entrega = um PR; o usuário valida no ambiente de teste e faz o merge. Migração nova é avisada no PR.
- Hierarquia de CNH hardcoded (decisão de 18/11).
- Painéis sucintos; o escalante nunca é bloqueado de fechar a escala.

## Deixado ao construtor

- Nomes de tabelas, colunas e rotas; formato do contrato zod.
- Como a tela da ordem identifica uma vaga estável entre versões da guarnição (ex.: guarnição + função + nº), desde que vagas que continuam existindo mantenham o número.
- Detalhes visuais da tela da ordem dentro do padrão do site (cores do voluntariado, foco visível, celular).
- Mensagens de aviso, seguindo o tom dos cadastros existentes.
