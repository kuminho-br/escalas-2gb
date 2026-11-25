# Pecúlio Geral: as views, a pesquisa com filtros e a atualização em lote — design

24/11/2026 · decisões do usuário no mesmo dia (feedbacks do piloto e brainstorming) · entregas depois do piloto de dezembro, na fase 7 ou antes dela, a combinar · plano: a escrever · absorve os itens 4, 5 e 6 do pool (`docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`)

## Por quê

Dois problemas apareceram ao preparar a escala de dezembro:

1. **O Pecúlio está invertido.** Ele tem tudo sobre o militar, mas a ficha completa abre na aba Militares do módulo de escalas (`/militares/$id?de=peculio`), e a Consulta de militares é uma tela à parte, com busca só por texto e unidade. Os módulos que usam o Pecúlio deviam ter só o que lhes interessa; o Pecúlio é a busca de militares.
2. **Depois da importação, a lotação precisa ser refeita um a um.** A importação grava a lotação só do militar novo; para quem já existe, manda usar "Alterar situação" na ficha. O sistema antigo lotava de outro jeito, então dezenas de militares chegam na lotação antiga, e mover cada um pela ficha não dá. É preciso selecionar vários, de forma não contígua, e aplicar a mesma mudança a todos.

## Decisões do usuário (24/11/2026)

1. O módulo passa a se chamar **Pecúlio Geral**, com três views:
   - **Pecúlio da unidade** (o Pecúlio de hoje): busca rápida nos militares da unidade de trabalho, com um botão para incluir as unidades de baixo (hoje a lista sempre traz as de baixo).
   - **Pesquisar militares** (a Consulta de hoje): qualquer militar da corporação, com vários filtros.
   - **Aniversários**: um calendário com a distribuição dos aniversários (hoje é um painel ao lado da lista do Pecúlio).
2. **A ficha completa abre no próprio Pecúlio**, sem ir à aba Militares das escalas.
3. **A lista de militares** ganha linha divisória entre os itens, ou vira cartões dentro de um painel.
4. **Atualização em lote, na mesma tela da pesquisa** ("Pesquisar militares"): seleciona-se o conjunto e aplica-se uma operação a todos. É **ferramenta da SP** (quem cuida do Pecúlio); a SB não a tem.
5. **Formas de selecionar:** por arquivo com as chaves (matrículas); por uma unidade, só ela ou com as de baixo; pela árvore, marcando nós; por filtros, usando todos os resultados ou uma parte deles. As formas se combinam, e a seleção pode ser não contígua.
6. **A operação:** escolher **quais campos** mudam e, numa segunda etapa, **o valor** de cada campo. O caso mais comum é um campo com um valor; vários campos de uma vez também.

## Escolhas da PLANEJAMENTO

### A busca, uma só

"Pecúlio da unidade" e "Pesquisar militares" usam **o mesmo componente de busca**, com o mesmo resultado (uma linha por militar, como a lista do Pecúlio de hoje). A diferença é o alcance: a primeira começa na unidade de trabalho; a segunda, na corporação. O arquivo de matrículas e a árvore ficam só na segunda.

**Filtros** (a resposta do usuário aos filtros ainda não veio; esta é a proposta): nome, nome de guerra ou matrícula (texto); lotação (uma unidade, com "e as de baixo"); posto/graduação; quadro; jornada; equipe; situação do militar; voluntário JES; no quadro de motoristas e categoria de CNH; função; afastado hoje; cadastro incompleto. Os filtros se somam. A API devolve no máximo 500 linhas e avisa para afinar a busca quando passa disso.

**A árvore:** a árvore de unidades (a mesma da Estrutura), com uma marca por nó; marcar um nó inclui os militares lotados nele; um segundo controle no nó inclui as unidades de baixo. É uma forma de preencher o filtro de lotação com várias unidades de uma vez.

**O arquivo:** texto (`.txt`, `.csv`) ou planilha com **uma matrícula por linha**, na primeira coluna; cabeçalho opcional. O que não for achado aparece numa lista "não encontrados" e não trava o resto.

**O limite de 30 buscas por minuto** da Consulta continua na busca por texto; os filtros, a árvore e o arquivo entram na mesma rota e no mesmo limite (uma busca com filtros é uma chamada só).

**Duas rotas, um componente.** O "Pecúlio da unidade" continua carregando a lista da unidade de uma vez (`GET /unidades/:u/peculio`, que também calcula as pendências) e filtrando no navegador, como hoje; "incluir as de baixo" vira parâmetro dessa rota. O "Pesquisar militares" vai ao servidor por "Buscar", pela rota da Consulta com os filtros novos. O que é um só é o componente da tela (os filtros, a lista, a seleção), não a rota.

**A borda de visão** (o que cada conta vê de cada militar) continua valendo: a Consulta é para toda conta. Os filtros além de texto e lotação, as colunas de contato e as pendências de cadastro aparecem só para quem tem nível de acesso (gestão ou auxiliar em alguma unidade); o militar comum vê o que a Consulta mostra hoje. A lista de filtros acima é proposta da PLANEJAMENTO; o usuário corrige ao validar.

### A seleção

- Cada linha do resultado tem uma marca; há "Selecionar estes {n}" para o resultado inteiro.
- **A seleção acumula entre buscas:** quem foi marcado continua selecionado quando a pessoa muda os filtros ou carrega um arquivo. Um painel "Selecionados ({n})" mostra quem está dentro, com "Tirar" em cada um e "Limpar". É assim que a seleção fica não contígua: busca-se, marca-se, busca-se de novo, marca-se mais.
- A seleção vive só na tela (some ao sair); não é gravada.

### A atualização em lote

Botão "Atualizar em lote", ativo com pelo menos um selecionado e só para quem tem nível de acesso acima da lotação de **algum** dos selecionados (a regra da SP de hoje, militar a militar) ou o administrador.

Etapas, numa só tela (um painel que avança):

1. **Campos:** marcar o que muda. Na primeira versão: os do "Alterar situação" (**lotação, equipe, jornada, quadro, situação**, com o dia "a partir de", um só para o lote) e os simples do Pecúlio (**voluntário JES, função, abono de permanência, comportamento**). Dados pessoais e contato ficam de fora.
2. **Valores:** um valor por campo marcado. A equipe é da lotação de destino (se a lotação não muda, da lotação de cada um; equipe que não existe na unidade do militar é recusada na prévia). **Lotação marcada sem equipe marcada: todos chegam ao destino sem equipe** (decisão do usuário, 24/11/2026); a prévia diz "{n} chegam sem equipe", e a SB põe a equipe depois, ou um segundo lote faz isso por equipe. A jornada não marcada fica a de cada um.
3. **Prévia** (obrigatória): "{n} militares vão mudar" e a lista de quem **fica de fora e por quê** (sem permissão; sem período aberto no rastreio; equipe que não existe na unidade dele; "a partir de" antes do período aberto). A pessoa confirma com "Aplicar a {n} militares".
4. **Aplicar:** uma transação só. Ou todos os que podem mudam, ou nenhum muda (qualquer erro no meio desfaz tudo). Cada militar recebe a mudança **pelo mesmo caminho da ficha** (a mesma regra do "Alterar situação" e do `PATCH` de hoje, a mesma auditoria com quem fez). O resultado diz quantos mudaram e repete quem ficou de fora.

Não há "Desfazer" do lote: a prévia é a proteção. O histórico de rastreio de cada militar mostra a mudança como qualquer outra.

Decisões da PLANEJAMENTO depois da leitura do construtor (24/11/2026):
- **Permissão no destino:** sem nível de acesso na unidade de destino, o lote inteiro é recusado (é um valor só); a falta de permissão sobre um militar é motivo de exclusão daquele militar na prévia.
- **Teto do lote:** 500 militares (o mesmo da busca), para a transação caber no tempo da função.
- **Reconferir ao aplicar:** a elegibilidade de cada militar é refeita na hora de aplicar, não só na prévia; se algo mudou entre as duas, o lote é recusado com "A lista mudou desde a prévia. Refaça a prévia.".

### A ficha no Pecúlio

Uma rota do Pecúlio Geral (`/peculio/militar/$id`, por exemplo) com "Voltar" para a view de onde veio. **Ela escolhe a ficha pela permissão:** quem tem nível de acesso sobre o militar vê **a ficha completa**, com os mesmos componentes de hoje (`componentes/militares/*`); quem não tem vê **a ficha de consulta** de hoje (`GET /consulta/militares/:id`, filtrada pela borda de visão). Sai o `?de=peculio` da aba Militares; `/consulta` e `/consulta/$id` passam a redirecionar para as rotas novas. A ficha da escala (6.32) continua na aba Militares, enxuta.

### Aniversários

Um calendário do mês (mesmo modelo do mês da Escala do mês), com os aniversariantes em cada dia (patente e nome de guerra), setas para outros meses, e o alcance da view (a unidade de trabalho e as de baixo). Só entram os militares cujo nascimento a pessoa pode ver (como hoje no painel).

### A lista

Linhas com divisória ou cartões num painel: **a DESIGN decide o padrão**, que vale para a lista do Pecúlio e para o resultado da pesquisa.

## Não objetivos

- Lote de dados pessoais, contato ou acesso ao sistema.
- Lote de afastamentos (pode vir depois, na mesma tela).
- "Desfazer" do lote.
- Importação por planilha: continua como está (é o outro caminho para muitas mudanças de uma vez).

## Anti-objetivos

- Gravar um lote pela metade.
- Mudar um militar sobre o qual quem aplica não tem nível de acesso (o lote não pode dar mais poder que a ficha).
- Selecionar por engano a corporação inteira: "Selecionar estes {n}" só vale para o resultado na tela, nunca para "tudo".
- Esconder quem ficou de fora: a prévia e o resultado sempre listam.

## O que fica para o plano

- A divisão em entregas. Sugestão: (a) Pecúlio Geral com as três views, a ficha no lugar e a lista (front-end); (b) a pesquisa com filtros, árvore e arquivo, com a seleção; (c) a atualização em lote (API e tela). A ordem (a), (b), (c), depois do piloto.
- As rotas novas (`POST /peculio/lote/previa`, `POST /peculio/lote/aplicar`, ou nomes equivalentes) e o formato de entrada (ids dos militares, campos e valores, "a partir de").
- Os textos das recusas da prévia.
