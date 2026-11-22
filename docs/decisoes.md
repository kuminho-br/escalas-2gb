# Registro de decisões

Uma linha por decisão do projeto, da mais nova para a mais velha. A coluna "Onde está" aponta o documento e a seção que descrevem o resultado hoje. Uma decisão refeita aparece duas vezes: a mais velha diz "substituída em dd/mm".

Regra (20/11/2026): os documentos não ganham mais adendos. Quem muda uma decisão muda o texto do documento e acrescenta uma linha aqui, no mesmo PR. O texto antigo dos documentos fica no git; a síntese de 20/11/2026 partiu do commit `50bf019`.

Siglas dos documentos: **Design** = `superpowers/specs/2026-11-16-migracao-design.md`; **Roadmap** = `superpowers/plans/2026-11-16-roadmap-migracao.md`; **Telas** = `superpowers/specs/2026-11-16-telas.md`; **Pecúlio** = `superpowers/specs/2026-11-20-peculio-design.md`; **Usuários e módulos** = `superpowers/specs/2026-11-21-usuarios-e-modulos-design.md`; **Oficiais** = `superpowers/specs/2026-11-22-escala-dos-oficiais-design.md`.

| Data | Decisão | Onde está |
|---|---|---|
| 22/11/2026 | Entregas paralelas: uma linha de entregas fora das fases ("Missões paralelas"), que não muda a ordem do roadmap. A primeira é a P1, Escala dos oficiais. | Roadmap, Missões paralelas |
| 22/11/2026 | Escala dos oficiais: design e mockup aprovados sem ressalvas; os 8 pontos em aberto ficam como propostos, e o item "Oficiais" vem depois de "Efetivo por dia". | Oficiais, Pontos que estavam em aberto |
| 22/11/2026 | Quadros QOC, QOA e QBMG: todo militar pertence a um quadro; o posto-graduação pertence a quadros, e o mesmo pode estar em mais de um. "Posto-graduação" é o nome provisório do campo. Entra na P1.1. | Pecúlio, Militar; plano da P1 |
| 22/11/2026 | Pecúlio: o abono de permanência é um campo de sim ou não (o militar que já poderia ir para a reserva e continua na ativa, com o bônus); "ativo/inativo" sai do Pecúlio; a função é de todo militar, cadastrada nas Configurações até o QOD ser modelado; o QOD é um domínio à parte, que entra como uma consulta no módulo Pecúlio. | Pecúlio, Militar e Não objetivos |
| 21/11/2026 | O rastreio (lotação, equipe, jornada) vale por dia, como os afastamentos. Substitui "a partir de é o mês" e fecha a pendência de elucidação. Entra na entrega 6.5. | Pecúlio, Rastreio do militar e Telas |
| 21/11/2026 | O "Vale desde" do modelo de guarnição (criar e nova versão) aceita mês passado, inclusive muito antigo; as outras vigências continuam recusando. Entra na entrega 6.5. | Plano da fase 6, Entrega 5 |
| 21/11/2026 | Grade geral: clicar no nome da equipe recolhe ou mostra os militares dela. Entra na entrega 6.5. | Plano da fase 6, Entrega 5 |
| 21/11/2026 | Sete ajustes de interface esperam mockup da DESIGN: confirmações em diálogo do sistema, topo só com o brasão, seletor de unidade nível por nível, enquadramento das boas-vindas, cadastro incompleto no campo, filtro de pendências e motivo do afastamento à direita. | Plano da fase 6, Entrega 6 |
| 21/11/2026 | A folga do auxiliar na senha provisória não vale para conta desativada: só quem pode dar o papel (o gestor ou o administrador) reativa. Entra na entrega 6.3. | Usuários e módulos, Contas |
| 21/11/2026 | Senha provisória e desativar o acesso de quem tem papel: só quem pode dar todos os papéis da pessoa (o gestor para auxiliar e gestor; o administrador para o administrador), com uma folga: o auxiliar também gera a senha de um colega auxiliar da unidade dele ou de baixo. A folga entra na entrega 6.2. | Usuários e módulos, Contas |
| 21/11/2026 | Fase 6, primeiro acesso: senha provisória gerada pelo auxiliar administrativo ou pelo gestor e trocada no primeiro login; o link por e-mail e o "Esqueci minha senha" por e-mail ficam para quando houver serviço de envio testado. | Usuários e módulos, Contas |
| 21/11/2026 | Fase 6, módulos por papel: Confecção para auxiliar, gestor e administrador; Pecúlio para quem tem papel; Visualização e "Minha ficha" (com o próprio telefone) para todos. | Usuários e módulos, Módulos |
| 21/11/2026 | O papel `escalante` aparece nas telas como "Auxiliar administrativo"; nos textos de ajuda, quem monta a escala continua sendo o escalante. | Usuários e módulos, Papéis |
| 21/11/2026 | A transição do login entra como última entrega da fase 6 se o mockup estiver aprovado até lá; senão, passa para a fase seguinte. | Usuários e módulos, Transição do login |
| 21/11/2026 | Com "Adm cumpre a carga mensal" desligado, o Adm tira saldos e pode tirar PJES no horário do expediente. O segundo parâmetro (P-34) e a utilidade da prioridade da cota (P-35, talvez removida) ficam para depois, sem prioridade. | `negocio/regras/carga-expediente-choques.md`, RN-17; `negocio/regras/normativo-a-validar.md`, Pendências |
| 21/11/2026 | "Adm cumpre a carga mensal": ligado, vale a portaria (160h e nenhum extra no horário do expediente); desligado, vale a prática (o Adm reforça com saldos e pode tirar PJES no horário do expediente). Em aberto: os saldos com o parâmetro desligado e um possível segundo parâmetro (P-34). | `negocio/regras/carga-expediente-choques.md`, RN-17 |
| 21/11/2026 | Catálogo de regras conferido contra o sistema novo: cada regra diz se já funciona e onde; entram as regras da fase 4 (RN-102 a RN-116); RN-07, RN-08, RN-47 e RN-92 ficam como substituídas; RN-21, RN-31, RN-95, RS-05, RS-06 e RS-07 saem. | `negocio/regras/LEIAME.md` |
| 21/11/2026 | Vaga vazia na Escala do mês e no Efetivo por dia: opção A do mockup da DESIGN (contorno tracejado; barra vinho na obrigatória; "opcional" na extra; contador "Faltam N"). Entra na entrega 4 da fase 5. | `plans/2026-11-21-fase5-peculio.md`, Entrega 4 |
| 21/11/2026 | O retorno da validação vai para frente: vira entrega nova no fim da fase em andamento, sem reabrir fase passada nem passar na frente do previsto. O lote de 21/11 é a entrega 4 da fase 5. | Roadmap, Princípios e Fase 5 |
| 21/11/2026 | A tela "Serviços" passa a se chamar "Turnos": é como as pessoas pensam; "serviço" fica como entidade interna. "Importar da Planilha" vira "Importar". | Roadmap, Fase 5 (entrega 4) |
| 21/11/2026 | Lotação é só a posição do militar na estrutura (a unidade); equipe e jornada são atributos do militar; o conjunto no tempo é o "rastreio", alterado por "Alterar situação" com "a partir de" e mostrado numa linha do tempo com os afastamentos. | Pecúlio, O modelo e Telas |
| 21/11/2026 | "A partir de" no rastreio é o mês, por enquanto; se vale o dia é pendência de elucidação de requisito. | Design, Pendências abertas |
| 21/11/2026 | A CNH é do militar; para a escala, só vale se ele estiver no quadro de motoristas. | Design, CNH; Pecúlio, Regras da interface |
| 21/11/2026 | Ficha única com dono por bloco: o papel da unidade de cima edita o Pecúlio; o escalante, o que é da escala; o militar, o próprio telefone (fase 6). Futuro: token de atualização de ficha. | Pecúlio, Quem edita o quê |
| 21/11/2026 | Nome completo e nome de guerra são atributos separados. | Pecúlio, O modelo |
| 21/11/2026 | A fase 5 entrega a interface do Pecúlio com a escala e a estrutura decidida; o resto do Pecúlio é postergável. | Pecúlio, Por quê e Não objetivos |
| 21/11/2026 | Área pessoal: comparar a própria escala com a de outro militar (fase 8) e busca por permutantes num dia escolhido (fase 9, depois das specs de permutas). | Roadmap, Fases 7, 8 e 9; Design, Nome do sistema, login e módulos |
| 21/11/2026 | A planilha de importação é o contrato do sistema (DTO): o modelo exportado diz o que se espera, e quem envia se adapta. Por isso a importação continua recusando mês passado. Recusadas: valer a mais recente das antigas e contar a antiga igual como "igual". | Design, Cadastros › Importação |
| 20/11/2026 | Sessões atuais: DESENVOLVIMENTO, PLANEJAMENTO, VALIDAÇÃO, DÚVIDAS, DESIGN (UI e UX) e DOCUMENTAÇÃO. REGRAS DE NEGÓCIO, SECRETARIADO e SAC & OUVIDORIA deixam de existir; os documentos de negócio passam à DOCUMENTAÇÃO. | `CLAUDE.md`, Sessões |
| 20/11/2026 | Fluxo de entrega: a DESENVOLVIMENTO envia o branch; a PLANEJAMENTO abre o PR, mescla e avisa a VALIDAÇÃO, que monta os testes de navegador. | Roadmap, Como ler |
| 20/11/2026 | A entrega 4.6 junta o segundo lote de pendências simples, enquanto o modelo do Pecúlio é fechado. | Roadmap, Fase 4 |
| 20/11/2026 | A entrega 4.5 junta pendências simples, sem decisão aberta, para a programação seguir enquanto o modelo do Pecúlio é fechado. | Roadmap, Fase 4 |
| 20/11/2026 | Plano de entrega pedido pelo usuário já autoriza o PR, o merge e a ordem de execução (Sonnet executa, Opus revisa). | Roadmap, Como ler |
| 20/11/2026 | "Otimizar o painel do dia" entra na fase 8: na 4.4 a medida foi a 42 consultas, acima do limite de 40. | Roadmap, Fase 8 |
| 20/11/2026 | O painel do dia não é otimizado agora (33 consultas medidas na 4.3); entra na fase 8 se passar de 40 consultas ou de 1 s na sandbox. Cumprida na 4.4. | Roadmap, Fase 4 |
| 20/11/2026 | A aba "Atividades" sai das Configurações (nada lê a atividade desde 17/11); a tabela e a coluna ficam no banco, sem migração. Entra na 4.4. | Roadmap, Fase 4; Design, Cadastros › Catálogos |
| 20/11/2026 | Os documentos não ganham mais adendos: muda-se o texto e a decisão entra neste registro. | Este registro (topo) |
| 20/11/2026 | Antes do design do Pecúlio, entra uma pergunta nova: como a planilha é usada hoje (quem atualiza, quem consulta, o que dá trabalho). | Pecúlio, Decisões que faltam |
| 20/11/2026 | A Minha escala (fase 7) e a Escala por militar (fase 8) são desenhadas juntas; se o uso da Escala por militar for a permuta, ela pode ir junto com as permutas (fase 9). | Roadmap, Fases 7 e 8 |
| 20/11/2026 | A correção do "Desativar" da 4.1 entra na 4.4, como primeira tarefa, porque a 4.3 já estava em execução. | Roadmap, Fase 4 |
| 20/11/2026 | Desativar uma guarnição tira o militar só dela; se era a original e ele acumulava em outra, o acúmulo vira a vaga dele. Não existe "acúmulo cruzado" como caso especial. Substitui a regra da 4.1. | `specs/2026-11-20-grade-geral-ux-design.md`, Parte D (PR #53) |
| 20/11/2026 | A busca por nome na Grade e o dia da semana por extenso no Efetivo por dia entram na 4.4. | Roadmap, Fase 4 |
| 20/11/2026 | O retorno da validação da entrega 4 vira a entrega 4.4 (leitura da Grade, "Adicionar serviço" em abas), última da fase 4. | Roadmap, Fase 4; `specs/2026-11-20-grade-geral-ux-design.md` |
| 20/11/2026 | O cabeçalho dos dias fixo fica na 4.3 (Tarefa 72); a 4.4 só confere com o layout novo. | Roadmap, Fase 4 |
| 20/11/2026 | A limpeza das pendências da fase 3 vira a entrega 4.3: PRs #32 e #15, CNH, edição do militar, "Desativar agora", cota de serviço desativado, troca recusada e medida do painel do dia. | Roadmap, Fase 4; `specs/2026-11-20-limpeza-da-fase-3-design.md` |
| 20/11/2026 | O "Voltar ao padrão" sem confirmação (M7) sai da 4.3: a 4.1 já pede confirmação. | Roadmap, Fase 4 |
| 20/11/2026 | Editar o militar grava só os campos que mudaram (dois escalantes não se atrapalham em campos diferentes). | Design, Cadastros › Militares; `specs/2026-11-20-limpeza-da-fase-3-design.md` |
| 20/11/2026 | CNH: as categorias que a carteira habilita aparecem marcadas na tela, mas só a carteira é gravada; o A continua isolado. Substitui a pendência da tela do motorista de 18/11. | Design, Montagem da escala › CNH |
| 20/11/2026 | A API recusa cota de serviço desativado; a cópia do mês anterior pula essas cotas e diz quantas. | `specs/2026-11-20-limpeza-da-fase-3-design.md` |
| 20/11/2026 | "Desativar agora" do modelo de guarnição pede confirmação. | `specs/2026-11-20-limpeza-da-fase-3-design.md` |
| 20/11/2026 | A validação não trava o roadmap: cada entrega é validada em paralelo e o retorno entra no momento oportuno. | Roadmap, Princípios |
| 20/11/2026 | O plano de tarefas é escrito por entrega, só quando ela está para começar; a fase 5 ganha um design da fase inteira. | Roadmap, Como ler |
| 20/11/2026 | Reorganização: depois da fase 4 vêm Pecúlio (5), Usuários e módulos (6), Visualização de escalas (7) e Primeiro mês real (8); as antigas 5, 6 e 7 viram 9, 10 e 11. | Roadmap, Visão geral |
| 20/11/2026 | O Gerar documento (antiga entrega 5) e o mesmo modelo mais de uma vez no dia (5.1) saem da fase 4 e vão para a fase 8. | Roadmap, Fase 8 |
| 20/11/2026 | O piloto passa para a fase 8; continua sendo a diretriz geral, mas não fixa a ordem de tudo. | Roadmap, Fase 8 |
| 20/11/2026 | A importação do Google Forms sai do roadmap: o próprio militar marca o voluntariado na fase 7. Volta só se isso não pegar. | Roadmap, Fases 7 e 10 |
| 20/11/2026 | As unidades dentro do 2º GB (nove lotações) e o cadastro de usuários dentro do GB vêm da fase 11 para as fases 5 e 6. | Roadmap, Fases 5, 6 e 11 |
| 20/11/2026 | Dentro do GB, a antiguidade vem da "Ordem" do Pecúlio; os almanaques ficam só para acima do GB (fase 11). | Pecúlio; Design, Pendências |
| 20/11/2026 | D7 revista para o Pecúlio (opção a): o teste recebe os campos do Pecúlio menos o CPF e o ano de nascimento; os dois entram só no servidor do Estado. | Design, D7 |
| 20/11/2026 | Os problemas que só apareciam com várias unidades passam para o design da fase 5. | Pecúlio, Várias unidades |
| 20/11/2026 | Rota escolhida: Pecúlio primeiro (rota 3). Recusadas: seguir com o documento e o piloto (rota 1) e preparar o piloto antes (rota 2, que virou a ordem da fase 8). | Pecúlio, Por quê |
| 20/11/2026 | A Escala por militar é uma tela nova (militares escolhidos, o mês) e forma, com Grade geral, Escala do mês e Efetivo por dia, as quatro telas principais. Entra na fase 8. | Roadmap, Fase 8 |
| 20/11/2026 | Retorno da validação da 3.3: entregas 4.1 (desativar, reativar e adicionar guarnição na meta do dia) e 4.2 (Efetivo por dia e Escala do mês em grade); o "dia de serviço 08h→08h" foi descartado; o selo "ativada" e o tom do aviso "Falta…" ficaram adiados. | `specs/2026-11-20-meta-de-ativacao-design.md` |
| 20/11/2026 | "Efetivo do dia" vira "Efetivo por dia", tela de trabalho: linha do tempo por guarnição, meta do dia mudada pela própria tela, sem alteração de vários dias de uma vez. | `specs/2026-11-20-meta-de-ativacao-design.md` |
| 20/11/2026 | Escopo da 3.3: Efetivo por dia refeito e escalar nele, turnos lado a lado e login novo. Completar com JES, saldos, operações pelas cotas e buracos do Pronto saem dela (hoje na fase 8). | Roadmap, Fases 4 e 8 |
| 20/11/2026 | Meta de ativação: lista de guarnições por dia com ordem; meta padrão do nível, alterável em qualquer dia. "Ordem de escala" vira "ordem de escalação"; guarnições viram modelos em Configurações; Pronto, Saldo, JES e Expediente viram serviços fixos. | `specs/2026-11-20-meta-de-ativacao-design.md` |
| 20/11/2026 | A entrega 3 passa a 3.1, 3.2.1, 3.2.2 e 3.3 (a antiga 3.2 vira a 3.3, e o login novo vai junto). | Roadmap, Fase 4 |
| 19/11/2026 | A entrega 3 se divide em 3.1 (pré-escala do Pronto) e 3.2 (buracos, saldos e operações). Renumerada em 20/11. | Roadmap, Fase 4 |
| 19/11/2026 | Na Escala do mês, o card da guarnição volta à largura natural e os turnos do mesmo dia ficam lado a lado (pendência da 2.4, feita na 3.3). | `specs/2026-11-19-voluntariado-por-faixa-design.md` |
| 19/11/2026 | Acabamento do voluntariado (entrega 2.4): bloco vazio sempre branco, guia "Como marcar", número do dia com cara de botão, guarnições ajustadas à largura. | `specs/2026-11-19-voluntariado-por-faixa-design.md` |
| 19/11/2026 | Flexibilidade do voluntariado (entrega 2.3), "Mostrar" quem não se voluntariou, modo foco no celular e escalas que montam os blocos do dia. | `specs/2026-11-19-voluntariado-por-faixa-design.md` |
| 19/11/2026 | Voluntariado por faixa de horário (entrega 2.2), no lugar do turno padrão A/B. Substitui a regra de 17/11 do turno padrão. | `specs/2026-11-19-voluntariado-por-faixa-design.md` |
| 19/11/2026 | Tela inicial: cartão por módulo e faixa de boas-vindas com foto sorteada. As fotos sorteadas foram substituídas em 20/11 pela cena da transição do login. | Design, Nome do sistema, login e módulos |
| 19/11/2026 | Os tipos de usuário são quatro: administrador, gestor, auxiliar administrativo (escalante) e militar comum. A tela inicial e a Visualização entram quando eles forem diferenciados (hoje fase 6 e 7). | Design, Atores e permissões |
| 19/11/2026 | A Minha escala sai da fase 4 (era a entrega 6) e vai com a Visualização de escalas (hoje fase 7). | Roadmap, Fase 7 |
| 19/11/2026 | O cadastro de militares será reestruturado com a estrutura da corporação e nasce o módulo Pecúlio, em momento a definir. Substituída em 20/11: o Pecúlio virou a fase 5. | Roadmap, Fase 5 |
| 19/11/2026 | Tela de login nova: muda só a aparência (mockup aprovado em `docs/telas/login-e-inicio/mockup.html`). Feita na 3.3. | Design, Nome do sistema, login e módulos |
| 19/11/2026 | O sistema se chama "Sistema de Gestão - 2º GB" e tem três módulos: Confecção de escalas, Visualização de escalas e Pecúlio do 2º GB. | Design, Nome do sistema, login e módulos |
| 18/11/2026 | Ordem de escala por vaga substitui a prioridade da guarnição (RN-08); acúmulo de funções à mão (entregas 1.1 e 2.1). | `specs/2026-11-18-ordem-de-escala-e-acumulo-design.md` |
| 18/11/2026 | Hierarquia de CNH fixa no código: A isolada; B habilita B; C habilita C e B; D habilita D, C e B; E habilita E, D, C e B. | Design, Montagem da escala › CNH |
| 18/11/2026 | Tela do motorista: marcar uma categoria acende as que ela habilita (como, ficou pendente). Substituída em 20/11. | Design, Montagem da escala › CNH |
| 18/11/2026 | Antes da fase 4, três revisões: pendências (1), testes com pessoas (2) e revisão de código (3). Feitas nos PRs #25 a #27. | Roadmap, Visão geral |
| 18/11/2026 | Revisão 1, aceitas: Salvar que mostra o estado (A), pendência em âmbar (B), ficha num painel só (D), trilho estreito (E), e as correções e detalhes do esboço. | Telas; `plans/2026-11-18-revisao-1.md` |
| 18/11/2026 | Revisão 1, recusadas: botões lado a lado para escolhas curtas (C), marcar o serviço de cada coluna da matriz (F) e quadro "O que falta no cadastro" na página inicial (G). | `plans/2026-11-18-revisao-1.md` (Decisões) |
| 18/11/2026 | O vínculo da escala com a guarnição é por faixa de horário, não por letra; "Todos os turnos" deixa de existir. | Design, Cadastros › Serviços e escalas |
| 18/11/2026 | Não existe turno único: o serviço de um turno só usa o A (U e ÚNICO viram A na importação). | Design, Cadastros › Serviços e escalas |
| 18/11/2026 | "Pede voluntariado em" sai da tela de Serviços; a ficha ganha a régua do dia (0h a 24h) e a cor escolhida numa grade. | Design, Cadastros › Serviços e escalas |
| 18/11/2026 | Nos cadastros, a lista fica parada enquanto o detalhe rola, e as fichas avisam "Alterações não salvas". | Design, Cadastros › Telas de cadastro |
| 18/11/2026 | A cota aponta direto para o serviço (PJES ou diária), sem o campo operação; o feriado é da unidade e vem herdado de cima. | Design, Cadastros › Cotas e feriados |
| 18/11/2026 | Importação de cotas e feriados mais rígida que o protótipo: linha de outra seção, de JES e formato de data errado viram problema com solução; feriado móvel entra como móvel. | Design, Cadastros › Importação e Cotas e feriados |
| 18/11/2026 | Excluir guarnição, serviço ou escala vira desativar (agora ou a partir de um mês). | Design, Cadastros › Telas de cadastro |
| 17/11/2026 | Guarnição é um modelo, definido pela composição: a atividade sai do cadastro dela; máximo vazio vale o mínimo; renomear função vale para todas as guarnições. | Design, Cadastros › Modelos de guarnição e Catálogos |
| 17/11/2026 | Modelo de planilha para importar: a API gera o .xlsx com as abas e a aba AJUDA, com os valores reais da unidade. Recusados: arquivos prontos no repositório e geração no navegador. | Design, Cadastros › Importação |
| 17/11/2026 | Ficha do militar: lotação recolhida no fim, afastamento com formulário sob demanda, sem o atalho "Mês inteiro", botões de motorista menores. | Design, Cadastros › Militares |
| 17/11/2026 | Antiguidade repetida só avisa (pendência nos dois militares), sem renumerar e sem bloquear. | Design, Cadastros › Militares |
| 17/11/2026 | Antiguidade institucional pelos almanaques fica para quando o escopo for institucional. Refeita em 20/11: dentro do GB, vem do Pecúlio. | Design, Pendências |
| 17/11/2026 | Atores: escalante, gestor (antigo chefe), militar comum (sem papel) e administrador (só na raiz). Militar comum vê o que é dele e as publicações da unidade. | Design, Atores e permissões |
| 17/11/2026 | Turno do serviço × turno padrão do voluntariado pelo horário (A 08h–20h, B 20h–08h). Substituída em 19/11 pela faixa de horário. | `specs/2026-11-19-voluntariado-por-faixa-design.md` |
| 17/11/2026 | Cada guarnição é um card; a ordem é mês › dia › turno › guarnição › função. | Design, Montagem da escala |
| 17/11/2026 | Serviço (de onde vem a hora) é diferente de atividade (o que a guarnição faz). | Design, Cadastros |
| 17/11/2026 | Funções: catálogo por unidade (RN-94). Tipos de afastamento e atividades: catálogos do sistema, editados pelo administrador. | Design, Cadastros › Catálogos |
| 17/11/2026 | Importação inicial na própria tela, com prévia; linha com problema é pulada e o resto entra; importar de novo não duplica. | Design, Cadastros › Importação |
| 17/11/2026 | Ordem da fase 3: um cadastro por vez, cada um com API, tela e importação, num PR próprio. | Roadmap, Fase 3 |
| 17/11/2026 | Um gestor por nível cadastra os usuários do seu nível e de baixo. Dentro do GB, passou para a fase 6 em 20/11. | Roadmap, Fases 6 e 11 |
| 17/11/2026 | Gerar a pré-escala de novo não devolve um militar a um dia e turno de onde foi removido (tabela própria de remoções). | Design, Montagem da escala |
| 17/11/2026 | Casos de teste gravados do protótipo (`pnpm casos:gravar`); a regra das remoções existe só no sistema novo; o motor exposto pela API foi para as fases 3 e 4. | Roadmap, Fase 2 |
| 16/11/2026 | D1: API em TypeScript com Hono. | Design, D1 |
| 16/11/2026 | D2: Supabase (só Postgres) e Vercel, em São Paulo. | Design, D2 |
| 16/11/2026 | D3: Better Auth, login por e-mail e senha, por convite. | Design, D3 |
| 16/11/2026 | D4: React, Tailwind, shadcn/ui e TanStack; sem grade de planilha. | Design, D4 |
| 16/11/2026 | D5: modelo de impressão em .xlsx preenchido pela API, PDF por LibreOffice. | Design, D5 |
| 16/11/2026 | D6: um repositório, protótipo em `prototipo/`, pnpm workspaces. | Design, D6 |
| 16/11/2026 | D7: dados reais da 1ª SB no teste, fictícios no desenvolvimento e no GitHub. Revista em 20/11 para o Pecúlio. | Design, D7 |
| 16/11/2026 | Permuta: o sistema registra só a troca já aprovada pelo Chefe. Configurações e feriados valem para a unidade e as de baixo. Militar de fora só por vínculo. Todo usuário é um militar. | Design, Modelagem |
| 16/11/2026 | Roadmap aprovado com as fases 0 a 7. Reorganizado em 20/11. | Roadmap, Visão geral |
