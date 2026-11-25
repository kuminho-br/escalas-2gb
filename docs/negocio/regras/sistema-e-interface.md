# Regras — escopo, acesso, cadastros, interface e requisitos do sistema

Escopo e árvore de unidades, níveis de acesso e camadas de visão, cadastro do militar (Pecúlio, rastreio, quadros), configurações e interface (RN-27 a RN-30, RN-32, RN-101, RN-115, RN-116, RN-132 a RN-137) e os requisitos RS-01 a RS-04 e RS-08.

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026; segunda conferência em 25/11/2026, com as fases 5 a 7. Índice e colunas: [LEIAME](LEIAME.md).

## Escopo e árvore de unidades

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-27 | O sistema atende a corporação pela árvore de unidades, com a raiz no CBMPE; o militar pode ser lotado em qualquer unidade, e as telas de escala funcionam em qualquer unidade que tenha escalas. O uso começa pelo 2º GB (a 1ª SB no piloto). Os outros grupamentos, a antiguidade pelos almanaques e o servidor do Estado são da fase 11. Quem assina, cargo e dados da unidade ficam fora do sistema por enquanto. | Confirmada | Funciona (fase 5 e 6.25); acima do GB, fase 11 | Base |
| RN-134 | A árvore é genérica: toda unidade se comporta igual, qualquer que seja o tipo. Os tipos (Corporação, Grupamento, Divisão, Seção…) são um cadastro só de nome, e qualquer tipo fica abaixo de qualquer tipo; nenhuma regra depende do tipo. A sigla não se repete entre irmãs; em lugares diferentes pode, e a lista mostra a de cima ("1ª SB (2º GB)"). Uma unidade nunca fica abaixo de si mesma. Unidade com histórico (militar que já foi lotado, escala, nível de acesso, configuração, feriado) não é apagada: é extinta a partir de uma data, e o passado fica. O administrador edita a árvore inteira e os tipos; o gestor e o coordenador criam abaixo da sua unidade, renomeiam a sua e as de baixo, e movem, extinguem e excluem só as de baixo, sem tirar nada da sua árvore. A raiz não muda. Toda escolha de unidade é pela árvore, nó a nó. | Confirmada | Funciona (6.25, 6.26 e 6.45): módulo Estrutura | Base |

## Níveis de acesso e camadas de visão

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-115 | Todo usuário é um militar do cadastro, e o que ele **edita** vem do nível de acesso, dado numa unidade e válido nela e nas de baixo, por período. Níveis: **administrador** (dado na raiz; vale em toda a árvore, edita os catálogos do sistema e não muda o militar, que aparece em buscas e escalas como qualquer outro); **coordenador** (edita como o gestor na sua unidade e abaixo, e vê as unidades irmãs e o que está abaixo delas; não vale na raiz); **gestor** (o que o auxiliar faz, mais a meta padrão, as configurações do nível, publicar a escala, abrir a coleta do voluntariado, trazer o militar externo, alterar o passado e a rodada dos oficiais); **auxiliar administrativo** (o escalante: monta as escalas e mantém os cadastros da escala da unidade e das de baixo). Sem nível vigente, a pessoa é **militar comum**: vê o que é dela, a consulta e as escalas que o estado permite (RN-118). Nas telas diz-se "nível de acesso", nunca "papel". | Confirmada | Funciona (fase 6) | Base |
| RN-132 | Quem dá e encerra níveis: o administrador, qualquer nível em qualquer unidade; o gestor e o coordenador, os de gestor e de auxiliar na sua unidade e abaixo; o coordenador é dado pelo gestor de uma unidade acima ou pelo administrador, e quem o tem não o dá. O auxiliar não dá nível a ninguém, nem muda o próprio. Ninguém encerra o próprio último nível de gestor (o administrador pode), e o único administrador não encerra o próprio. Dar nível a quem ainda não tem conta é permitido: vale quando a pessoa entrar. Encerrar fecha o período; o nível não é apagado. | Confirmada | Funciona (fase 6): bloco "Acesso ao sistema" da ficha | Base |
| RN-133 | Ver é separado de editar. Editar segue a hierarquia (RN-115). Ver vem de três camadas que se somam, para a corporação inteira: **todos** (todo militar com conta), **oficial** (quem está num quadro marcado "de oficiais") e **coordenador** (nas unidades irmãs e abaixo delas). O que cada camada vê de cada bloco (Identificação, Contato, Situação, Afastamentos, Dados da escala, Comportamento, Escala em montagem) é a borda, ajustada pelo administrador em Configurações › Quem vê o quê; a Identificação para todos não se desliga. Quem tem nível na lotação do militar, ou acima, vê todos os blocos. Nenhuma camada dá permissão de gravar, e o que a pessoa não vê não vem na resposta. CPF, nascimento e endereço ficam fora da borda: só quem tem nível numa unidade acima da lotação (a divisão conta), o administrador e o próprio militar. | Confirmada | Funciona (6.10 a 6.12): Consulta de militares e escalas "Só consulta" | Base |
| RN-32 | Militar de outra unidade só é escalado por vínculo de militar externo com a unidade da escala. O gestor da unidade que recebe (ou quem está acima) o traz em Configurações da escala › Voluntariado, até alguém tirar; a lotação dele não muda. Aparece na equipe "Externo" e é lançado à mão em qualquer serviço; não entra na pré-escala nem nas distribuições. O voluntariado que ele marca vale aqui também (RN-124). O auxiliar administrativo vê, mas não traz nem tira. | Confirmada | Funciona (6.33 e 6.36) | Base |

## Cadastro do militar

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-135 | O Pecúlio é a origem dos dados do militar, e cada bloco da ficha tem dono. A **SP** (quem tem nível de acesso numa unidade acima da lotação do militar) e o administrador editam identificação, contato, dados pessoais, comportamento, afastamentos, o rastreio (RN-136) e o voluntário JES. A **seção** (nível na lotação) edita só as **Habilitações** (quadro de motoristas e CNH, RN-12) e vê o resto na ficha da escala. O próprio militar altera o telefone na Minha ficha. Militar novo só entra pelo Pecúlio (a ficha ou a importação); só o administrador apaga um militar, com tudo o que é dele. Na importação do Pecúlio só a matrícula é obrigatória: célula vazia não altera e dado inválido é ignorado, sem travar; militar novo exige posto/graduação, nome de guerra e lotação. | Confirmada | Funciona (fase 5, 6.7, 6.13 e 6.32) | Base |
| RN-136 | O rastreio guarda, por período (do dia ao dia, sem sobreposição), a lotação (só a unidade), a equipe, a jornada, o quadro e a situação do militar. Mudar qualquer um fecha o período e abre outro. A escala de um dia usa o período daquele dia. A situação (Ativa, Reserva, Agregado, Adido…) é um catálogo com "pode ser escalado"; não confundir com o tipo de afastamento. As listas de Militares e do Pecúlio mostram quem está na unidade (ou nas de baixo) no dia de referência do mês; a Grade mostra, dia a dia, quem esteve no mês. Quem tem nível numa unidade move a lotação de qualquer militar abaixo dela, e o rastreio registra quem moveu. | Confirmada | Funciona (fase 5, 6.9, 6.23 e 6.48) | Base |
| RN-137 | Todo militar pertence a um quadro (QOC, QOA ou QBMG), e o posto/graduação dele precisa estar no quadro; o mesmo posto pode estar em mais de um. A escala dos oficiais mostra só QOC e QOA (RN-126); as outras telas de escala, o QBMG e quem está sem quadro (com a pendência). A marca "de oficiais" fica no cadastro do quadro e define a camada de visão do oficial (RN-133). | Confirmada | Funciona (P1.1, P1.4 e 6.9) | Base |
| RN-116 | A antiguidade é a "Ordem" do Pecúlio (o lugar no ranking do GB). Antiguidade repetida só avisa: o sistema não renumera nem bloqueia, e os dois militares ganham a pendência "Antiguidade repetida com <nome>". Acima do GB, a antiguidade virá dos almanaques. | Confirmada | Funciona (fase 5); almanaques, fase 11 | Suporte |

## Configurações

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-28 | Os parâmetros do sistema ficam nas configurações, com vigência por mês, e valem para a unidade e as de baixo (a mais próxima vence); uma divisão pode ter parâmetros, feriados e funções próprios, que as unidades de baixo herdam. Vigência de mês que já passou é recusada, na tela e na importação. As configurações gerais (estrutura, catálogos, quem vê o quê, preferências) ficam num painel aberto pela tela inicial; as de escala, no módulo ("Configurações da escala"). | Confirmada | Funciona (6.26) | Base |

## Interface

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-29 | Os painéis são sucintos, com pouca informação na tela, e os textos não usam jargão. | Confirmada | Funciona (princípio de design) | Suporte |
| RN-30 | A interface não usa o termo "matriz" nem "papel" (diz "nível de acesso"); a jornada Adm é escrita "ADM". As telas de trabalho da escala são Escala do mês, Efetivo por dia e Grade geral; o militar vê a Minha escala e as Escalas (RN-121); a Escala por militar entra na fase 8. | Confirmada | Funciona | Suporte |
| RN-101 | Nas grades e listas de militares, a ordem é do mais antigo ao mais moderno: posto/graduação, depois a antiguidade (RN-116). Na lista "Escolher militar", quem já está no turno vem primeiro, e o Pronto vem antes do Adm. | Confirmada | Funciona; o último desempate é a matrícula nas telas de escala e o nome de guerra nas listas de Militares e do Pecúlio | Suporte |

## Requisitos do sistema

O ID RS-XX segue a mesma disciplina do RN-XX e nunca é reaproveitado.

| ID | Requisito | Situação | No sistema novo |
|---|---|---|---|
| RS-01 | Documentos em .xlsx e PDF, a partir de um modelo .xlsx editável pelo escalante: escala do mês publicada, escala do dia (atravessa todas as escalas do dia) e escala executada. Formato, campos e ordem da escala do dia em aberto (P-32). | Confirmada | Fase 8 (Gerar documento); escala executada, fase 9 |
| RS-02 | Tela de permutas: o militar pede a troca e o escalante registra a permuta aprovada (RN-86 a RN-88). | Confirmada | Fase 9 |
| RS-03 | Página que mostra ao usuário as regras fixas no código e as regras configuradas por ele, lado a lado, cada uma com o ID do catálogo. | Confirmada | Sem fase (a tela de Ajuda da fase 10 pode recebê-la) |
| RS-04 | Desempenho: otimizar as rotinas mais lentas quando o código estabilizar. Hoje o caso medido é o painel do dia da Grade geral (42 consultas com três faixas). | Confirmada | Fase 8 |
| RS-08 | Contas sem envio de e-mail: o login é o e-mail institucional da ficha (só `@bombeiros.pe.gov.br`; sem e-mail, sem conta). Quem pode (o auxiliar ou o gestor com nível na lotação do militar ou acima, e o administrador) gera na ficha uma senha provisória, que aparece uma vez, vale 7 dias e só serve para criar a senha no primeiro login (mínimo de 10 caracteres). Gerar de novo invalida a anterior e encerra as sessões. "Esqueci minha senha" manda pedir uma senha nova ao auxiliar da seção. | Confirmada | Funciona (6.1) |
