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

1. **O cronograma é registrado pelo responsável** da unidade, e as instruções são personalizáveis (o tema, o período e o material são livres, sem lista fixa no código).
2. **O militar precisa ler e registrar:** abre a instrução, lê o material e marca que leu.
3. **O militar participa no dia em que está de serviço.** A participação é da instrução vigente naquele dia.
4. **Quem registra a participação é o adjunto (graduado) de dia.** Ele recebe a lista dos militares de serviço do dia, preenche o checklist e envia o registro.
5. **O envio de fotos comprovando fica fora da primeira etapa.** A estrutura deixa o lugar pronto.
6. **O painel está aprovado** e é modelado aqui.
7. **O quiz da semana está aprovado**, mas será projetado mais à frente.

### Como está hoje

- **O adjunto de dia já existe:** é uma vaga do Apoio Operacional Aquartelado (RN-96). O sistema sabe quem é o adjunto de cada dia e quem está escalado.
- **A árvore de unidades e os níveis de acesso** já dizem quem publica e quem vê.
- **O sistema não guarda arquivos.** Por isso a primeira etapa usa só links para o material, e as fotos ficam para quando houver o depósito de arquivos (que o Acervo também vai pedir).

### Esboço da estrutura

Só entidades, colunas e relações. Nomes provisórios.

- **Instrução** (uma linha por tema e período): unidade, título, objetivo, início e fim da vigência (uma semana é o comum; o período é livre), quem ministra (texto livre), quem cadastrou.
- **Material da instrução** (várias linhas por instrução): instrução, título, link. Mais tarde, pode apontar para um documento do Acervo.
- **Leitura:** instrução, militar, quando marcou. Uma por militar e instrução.
- **Aplicação** (o registro do adjunto, uma por unidade, instrução e dia): instrução, dia, unidade, adjunto que registrou, quando enviou, observação.
- **Participação** (uma linha por militar de serviço no dia): aplicação, militar, presente (sim ou não), motivo (se não). A lista nasce da escala do dia e fica guardada como estava ao abrir o registro.
- **Foto da aplicação (etapa seguinte):** aplicação, referência do arquivo, quem enviou.
- **Depois:** o baralho do quiz poderá apontar para a instrução.

### Painel

Mostra, por unidade e semana, e nunca guarda dado próprio (tudo sai das tabelas acima):

- **Leitura:** quantos militares da unidade leram a instrução vigente.
- **Participação:** dos dias de serviço da semana, quantos têm registro do adjunto, e quais ficaram sem.
- **Militares pendentes:** quem esteve de serviço e não aparece como presente, e quem ainda não leu.
- Painel sucinto, com pouca informação na tela. Nada trava: o painel só mostra, não bloqueia o fechamento da escala.

## Perguntas em aberto

1. **Quem é o "responsável"** que registra o cronograma: o gestor da unidade, o escalante, ou um nível novo?
2. **Que serviços contam como "de serviço"** para a participação: só o Pronto, ou também o Expediente, o Saldo e as operações?
3. **O que o painel faz com quem faltou ao serviço** (afastamento, troca): sai da lista de pendentes sozinho?
4. **O militar sem acesso ao sistema** (sem conta): quem marca a leitura por ele?
5. **Quando o adjunto não registra:** o dia fica "sem registro" no painel, ou há prazo e aviso?

## Para o Laboratório

A área nasce como ferramenta em teste (ver `laboratorio.md`): o retorno do efetivo já tem lugar. Sugestão de corte da primeira etapa: cronograma, material por link, leitura, aplicação e participação, e o painel. Ficam de fora fotos, Acervo e Quiz.
