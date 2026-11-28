# Módulo de instruções

28/11/2026 · modelada (estrutura) · CONCEPÇÃO · origem: usuário (25/11/2026), esclarecida em 28/11/2026

## A ideia

Um módulo novo, com foco em aprendizado, em três áreas:

1. **Instrução do dia:** o cronograma de instruções da unidade, para publicar o que há de estudo e instrução em cada semana. É a área detalhada neste documento.
2. **Acervo:** documentos arquivados para consulta. Fica para um próximo documento.
3. **Quiz:** perguntas e respostas em cartões, no estilo Kahoot. Fica para depois: a Instrução do dia já deixa o gancho (um baralho ligado ao tema da semana).

## Instrução do dia

**Para que serve:** publicar o cronograma. Hoje cada unidade tem mais ou menos um tema por semana, ministrado durante o serviço. O sistema mostra o que há nesta semana, qual é o material de estudo, e registra quem leu e quem participou.

**Quem vê o quê:** a árvore de unidades decide. Cada unidade tem o seu cronograma.

### Decisões do usuário (28/11/2026)

1. **O cronograma é registrado pelo responsável** da unidade: o efetivo da SICT (Seção de Instrução e Coordenação Técnica), isto é, o gestor e o auxiliar administrativo. Tema, período e material são livres, sem lista fixa no código.
2. **Quem ministra é texto livre,** não um militar do cadastro: pode ser o adjunto de dia, o mais antigo do dia, funcionários de uma empresa, o secretário de defesa social etc. Vale no cronograma e no registro do adjunto.
3. **O material tem arquivo ou link:** ao cadastrar, o responsável envia o arquivo ou anexa um link.
4. **O militar precisa ler e registrar:** abre a instrução, lê o material e marca que leu. Todos os militares têm conta; quem ainda não criou o acesso tem a leitura registrada pela SICT, por ele.
5. **O militar participa no dia em que está de serviço.** O adjunto (graduado) de dia recebe a lista, preenche a presença e envia o registro.
6. **Quem conta como "de serviço"** é quem estava de serviço no horário em que a instrução foi ministrada. O adjunto registra o horário; o sistema vê, pelo efetivo do dia, quem já tinha assumido o serviço nesse horário.
7. **Quem faltou:** o efetivo previsto é o da escala do dia. Quem não foi fica ausente, com o motivo, conforme o caso.
8. **Adjunto que não registra:** o dia fica "sem registro" no painel. Nada mais.
9. **O envio de fotos de comprovação fica fora da primeira etapa.** A estrutura deixa o lugar pronto.
10. **O painel está aprovado** e é modelado aqui. **O quiz da semana está aprovado,** mas será projetado mais à frente.

### Como está hoje

- **O adjunto de dia já existe:** é uma vaga do Apoio Operacional Aquartelado (RN-96). O sistema sabe quem é o adjunto de cada dia e quem está escalado.
- **A árvore de unidades e os níveis de acesso** já dizem quem publica e quem vê.
- **O sistema não guarda arquivos.** Com a decisão 3, o depósito de arquivos entra já na primeira etapa, para o material. Ele também servirá às fotos e ao Acervo.

### Esboço da estrutura

Só entidades, colunas e relações. Nomes provisórios.

- **Instrução** (uma linha por tema e período): unidade, título, objetivo, início e fim da vigência (uma semana é o comum; o período é livre), quem ministra (texto livre), quem cadastrou.
- **Material da instrução** (várias linhas por instrução): instrução, título, **link ou arquivo** (um dos dois). Mais tarde, pode apontar para um documento do Acervo.
- **Arquivo** (depósito, novo): referência do arquivo, nome, tipo, tamanho, quem enviou e quando. O Material o usa; as fotos e o Acervo usarão depois.
- **Leitura:** instrução, militar, quando marcou, e **quem registrou** (o próprio militar ou o responsável da SICT, por ele). Uma por militar e instrução.
- **Aplicação** (o registro do adjunto, uma por unidade, instrução e dia): instrução, dia, **horário em que foi ministrada**, **quem ministrou** (texto livre), unidade, adjunto que registrou, quando enviou, observação.
- **Participação** (uma linha por militar previsto): aplicação, militar, presente (sim ou não), motivo (se não). A lista nasce da escala do dia: quem estava de serviço no horário informado. Fica guardada como estava ao abrir o registro.
- **Foto da aplicação (etapa seguinte):** aplicação, arquivo, quem enviou.
- **Depois:** o baralho do quiz poderá apontar para a instrução.

### Painel

Mostra, por unidade e semana, e nunca guarda dado próprio (tudo sai das tabelas acima):

- **Leitura:** quantos militares da unidade leram a instrução vigente.
- **Participação:** dos dias de serviço da semana, quantos têm registro do adjunto, e quais ficaram sem.
- **Militares pendentes:** quem esteve de serviço e não aparece como presente, e quem ainda não leu.
- Painel sucinto, com pouca informação na tela. Nada trava: o painel só mostra, não bloqueia o fechamento da escala.

## Perguntas em aberto

1. **Como a SICT entra nos níveis de acesso:** o "gestor" já existe; o "auxiliar administrativo" é um nível novo, uma função, ou o escalante da unidade?
2. **O afastado** (licença, férias) sai das contas do painel sozinho? A DESIGN propôs que sim, a confirmar.
3. **Limite do depósito:** tamanho e tipos de arquivo aceitos no material (decisão técnica, da PLANEJAMENTO com a DESENVOLVIMENTO).

## Mockups

A DESIGN desenhou as telas (militar, adjunto de dia, responsável e painel, no computador e no celular) na área "Instrução do dia" do Manual de Identidade Visual e em `docs/telas/refatoracao/instrucoes/` (branch `docs-manual-instrucoes`). Estão em revisão pelo usuário; a DESIGN marca como aprovada.

## Para o Laboratório

A área nasce como ferramenta em teste (ver `laboratorio.md`): o retorno do efetivo já tem lugar. Sugestão de corte da primeira etapa: cronograma, material com arquivo ou link, leitura, aplicação e participação, e o painel. Ficam de fora fotos, Acervo e Quiz.
