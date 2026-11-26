# Roadmap — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026 · reorganizado e sintetizado em 20/11/2026

**Objetivo:** levar o sistema do protótipo em Apps Script + Sheets para uma aplicação própria (banco, API, site), primeiro num ambiente de teste com cerca de 5 escalantes e depois no servidor do Estado.

**O sistema** se chama "Sistema de Gestão - 2º GB" e tem três módulos: Confecção de escalas (fases 3, 4 e 8 em diante), Pecúlio do 2º GB (fase 5) e Visualização de escalas (fase 7). Como ele é pensado: `docs/superpowers/specs/2026-11-16-migracao-design.md`.

**Como ler:**
- Este documento é só o mapa: a ordem das fases, a situação de cada entrega e onde está cada coisa.
- O porquê de cada decisão está em `docs/decisoes.md`.
- Cada fase tem um plano de tarefas, escrito por entrega, só quando ela está para começar. Plano pedido pelo usuário vai direto ao GitHub e é mesclado; vai para a execução só quando o usuário mandar (Sonnet executa, Opus revisa).
- Ao terminar uma entrega, a DESENVOLVIMENTO envia o branch; a PLANEJAMENTO abre o PR, mescla e avisa a VALIDAÇÃO, que monta os testes de navegador para o usuário.
- Não há datas: a ordem importa mais que o prazo.

## Princípios

- **O protótipo é o laboratório de regras.** Regra nova ou complexa é validada na sandbox antes de ir para o sistema novo.
- **As regras têm um teste só para os dois sistemas.** Uma regra está portada quando passa nos mesmos casos (`casos/`).
- **Tudo deve ir para o servidor do Estado sem retrabalho.** Postgres padrão, sem recurso exclusivo de fornecedor.
- **A auditoria existe desde o primeiro dia.** O banco grava as alterações desde a fase 1; a tela de Histórico vem na fase 11.
- **Dados reais só com decisão explícita.** O tratamento de dados pessoais é a D7 do design.
- **A validação não trava o roadmap.** Cada entrega é validada na sandbox pela sessão de VALIDAÇÃO enquanto a programação segue. Mesclada não quer dizer validada.
- **O retorno da validação vai para frente:** vira uma entrega nova no fim da fase em andamento; nunca reabre uma fase passada nem passa na frente do que já está previsto.

## Visão geral

| Fase | Entrega | Quem usa | Situação |
|---|---|---|---|
| 0. Decisões e especificação | Design aprovado (D1 a D7), esquema do banco e telas | Você | concluída |
| 1. Fundação | Banco, API e site no ar, com login e auditoria | Você | concluída |
| 2. Motor de regras | Regras do protótipo portadas, com os casos passando | Você | concluída |
| 3. Cadastros | Todas as telas de cadastro, com importação da planilha | Você e os escalantes | concluída |
| Revisões antes da fase 4 | Pendências, testes com pessoas e revisão de código | Você e alguns usuários | concluídas |
| 4. Montagem da escala | Montar e conferir a escala do mês à mão, nas telas de trabalho | Você e os escalantes | concluída |
| 5. Pecúlio | A base de militares do 2º GB inteiro e o módulo Pecúlio | Você e a administração do GB | concluída |
| 6. Usuários e módulos | Tipos de usuário, contas, acesso por lotação, tela inicial | Todos os militares | em execução (ajustes do piloto) |
| 7. Visualização de escalas | Estados da escala (prévia, publicada, retificada), Minha escala, próprio voluntariado | Todos os militares | concluída |
| 8. Primeiro mês real | Distribuições automáticas, documento, Escala por militar e o piloto | ~5 escalantes (piloto 1ª SB) | planejada |
| 9. Operação diária | Efetivo por dia na operação, permutas, escala executada | Escalantes | planejada |
| 10. Regras novas | Regras validadas no laboratório e a tela de Ajuda | Escalantes | planejada |
| 11. Institucionalização | Níveis acima do GB, Histórico, servidor do Estado | Corporação | planejada |

## Fase 0 — Decisões e especificação · concluída

Decisões técnicas D1 a D7, esquema do banco e telas. PR #8.

Documentos: o design, o esquema e as telas, em `docs/superpowers/specs/2026-11-16-*`. Em aberto: Q6 (permutas antigas, fase 9) e o processo do mês (`docs/negocio/processo-do-mes.md`, E1 a E8).

## Fase 1 — Fundação · concluída

Repositório reorganizado (protótipo em `prototipo/`), banco com o esquema completo e migrações, auditoria pelo banco, site e API no ar com login. PRs #9, #10 e #11. Plano: `docs/superpowers/plans/2026-11-16-fase1-fundacao.md`.

## Fase 2 — Motor de regras · concluída

O motor está em `pacotes/dominio`. Os casos são gravados do protótipo (`pnpm casos:gravar`) e conferidos contra os dois sistemas. A pré-escala, a distribuição do Adm e os parâmetros ganharam testes de caracterização.

A regra das remoções existe só no sistema novo. PR #12. Plano: `docs/superpowers/plans/2026-11-17-fase2-motor.md`.

## Fase 3 — Cadastros · concluída

Um cadastro por vez, cada um com API, tela e importação, num PR próprio. Plano: `docs/superpowers/plans/2026-11-17-fase3-cadastros.md`.

Entregas 1 a 5 (configurações, militares e afastamentos, guarnições, serviços e escalas, cotas e feriados), PRs #13 a #24.

## Revisões antes da fase 4 · concluídas

Pendências de interface, testes com pessoas e revisão de código (2 críticos e 10 importantes, corrigidos com teste): PRs #25 a #27. Planos: `docs/superpowers/plans/2026-11-18-revisao-1.md` e `2026-11-18-revisao-3.md`. O que ficou sem corrigir está em "Pendências conhecidas".

## Fase 4 — Montagem da escala · concluída

Montar e conferir a escala do mês à mão, nas telas de trabalho (Escala do mês, Efetivo por dia, Grade geral). Plano: `docs/superpowers/plans/2026-11-18-fase4-escala.md`.

Entregas 1 a 4.7, PRs #28 a #68: Escala do mês à mão, acúmulo, voluntariado por faixa, ordem de escala, pré-escala do Pronto, meta de ativação, Efetivo por dia, Grade geral e quatro lotes de acabamento. A tabela com cada entrega está no plano da fase.

**A fase fechou na 4.7** (21/11/2026), o terceiro lote de pendências simples. Os escalantes conseguem montar e conferir a escala de um mês à mão, sem os tropeços conhecidos.

## Fase 5 — Pecúlio · concluída

A estrutura da ficha do militar que hoje vive na planilha do Pecúlio, e a parte dela que a escala usa. Design: `docs/superpowers/specs/2026-11-20-peculio-design.md`.

Ficha com dono por bloco, rastreio, CNH separada do quadro, sete seções, importação e módulo. Plano: `docs/superpowers/plans/2026-11-21-fase5-peculio.md`.

Entregas: 1 rastreio e CNH (#73, migração 0023); 2 ficha e dono por bloco (#79, 0024); 3 importação e módulo (#80); 4 retorno da validação (#82). Migrações aplicadas no teste.

**Postergado:** abono de permanência e função (decididos em 22/11), QOD, férias, quem vê cada atributo, jornada dos oficiais, cópia de segurança, data de ingresso e CPF.

## Fase 6 — Usuários e módulos · ajustes do piloto

Design: `docs/superpowers/specs/2026-11-21-usuarios-e-modulos-design.md`. Plano: `docs/superpowers/plans/2026-11-21-fase6-usuarios-e-modulos.md`.

| Entrega | O que traz | Situação |
|---|---|---|
| 1 a 5, 7 a 14 | Contas, unidade de trabalho, tela inicial, transição do login, retornos da validação, Pecúlio, níveis de acesso, divisões, camadas de visão, consulta, escalas só para leitura, animação | mescladas (#86 a #143) |
| 6 | Retorno da validação com mockup | absorvida na refatoração |
| 15 a 18 | Pendências antes da fase 7: abono e função; três lotes de acabamento | mescladas (#146, #149, #166, #175, #178) |
| 19 | Correções de interface sem desenho (N0) | mesclada (#128) |
| 20 e 21 | Fundação da interface: sistema de estilo (N1); resposta do sistema (N2, 0040) | mescladas (#190, #191) |
| 25 e 26 | Árvore genérica (0035); configurações gerais | mescladas (#167, #171) |
| 22 a 24, 27 a 31 | Oficiais (refeitos, escala comum 0036, dias vermelhos 0037, tela de escalar, memorial 0039); mover na hierarquia; admin como militar; raiz sem "nível acima" | mescladas (#157 a #185) |
| 32 a 36 | Ficha na escala; Escala do mês no ordinário; militar externo; testes instáveis; RG funcional (0041), Grade sem Voluntariado | mescladas (#192 a #199) |
| 37 a 40 | Choque universal (0042); resolver o choque; cota de saldo; choque nos Oficiais; pré-escala só nos turnos e com o expediente (0043) | mescladas (#201 a #212) |
| 41 a 45, 47, 48 | Deploy só com código e só da `main`; tela inicial; dia vermelho só no ordinário; escolher a unidade pela árvore; lista de quem está hoje | mescladas (até #230) |
| 46 e 49 | Ajustes da Grade; histórico de rastreio pelo mockup | mescladas (#233, #239, #242 o acabamento) |
| 50 a 52 | Pecúlio Geral: as três telas e a ficha no lugar; a pesquisa com filtros, árvore, arquivo e seleção; a atualização em lote | 50, 51 e 52 mescladas (#244, #246, #248) |
| 53 | Acabamento do piloto: o filtro de CNH pela hierarquia, o motivo do passado uma vez por ação, "ADM" e "24:00", controles soltos do voluntariado e do Pecúlio, a atualização em lote | mesclada (#261) |
| 54 | Exportar militares para Excel em Pesquisar militares (os campos escolhidos, com as colunas da importação) e a busca sem corte para "Selecionar estes N" | mesclada (#264) |
| 55 | Tela inicial: os próximos serviços do militar (cartão com dia da semana, dia, serviço e horário, na cor do serviço), sobre a Minha escala da 7.5 | mesclada (#275) |
| 56 | Tela inicial: o quadro de avisos, com o cadastro de avisos (a modelagem do aviso passa pela CONCEPÇÃO antes do plano) | mesclada (#280), migração 0047 aplicada no teste |
| 57 | Planilhas: a unidade pelo caminho de siglas ("2º GB / 1ª SB"); toda importação devolve a planilha das linhas com problema, com o motivo; o trilho sem Histórico e Ajuda | mesclada (#267) |
| 58 | Laboratório 1: o espelho do banco (schema `laboratorio`, mesma estrutura do real, só dados de teste) e a separação: os militares fictícios `990…` saem do banco real. **Tem prazo: antes da montagem de dezembro** | plano pronto; aguarda a ordem do usuário para a DESENVOLVIMENTO |
| 59 | Laboratório 2: o cartão na tela inicial, o perfil de teste, a faixa "Laboratório: dados de teste. Nada aqui vale." e o sistema inteiro sobre o espelho, com o isolamento provado; "Recomeçar" | plano pronto; depois da 6.58 |
| 60 | Laboratório 3: as ferramentas em teste e o retorno (texto e nota de 1 a 5), com a lista de retornos para o administrador | plano pronto; depois da 6.59 |
| 61 | Cabeçalho novo do mockup v3 da tela inicial: fio vinho, brasão do 2º GB, o nome "Sistema de Gestão - 2º GB" e a unidade em degraus (um botão por nível, cada um abre só as unidades de dentro do anterior), no lugar do seletor da 6.45 | plano pronto; aguarda a ordem do usuário |
| 62 | Pecúlio: o Pecúlio da unidade abre na unidade do Topo (defeito), o lote não desfaz a seleção (defeito), a unidade pelo menor caminho na pesquisa | mesclada (#284) |
| 63 | Pesquisar militares, segunda versão: "Selecionados" em painel lateral, com a matrícula e o agrupamento; "Exportar" perto de "Importar"; o botão "Critérios de pesquisa", com o nome completo desligado por padrão e a marca dos filtros ativos; Importar e Exportar no alto | plano pronto (mockup aprovado em 26/11); depois da 6.62; aguarda a ordem do usuário |
| 64 | Equipes como cadastro: a tabela `equipe` ganha tipo (Pronto, ADM, Externa) e posição no ciclo, herdada da corporação; Alfa a Delta e a Externa deixam de ser texto no código; o externo só é escalado nas operações | modelada (CONCEPÇÃO, 26/11); plano pronto; traz a migração 0052 (aguarda a autorização); aguarda a ordem do usuário |
| 65 | Acabamento das revisões (os menores das 6.46, 6.53, 6.55, 6.57 e da 7.x) e a ficha do militar pela Grade geral | mesclada (#290); sem migração |
| 66 | ~~Remover uma mudança do histórico de rastreio com motivo (migração 0050)~~ | **descartada em 26/11**: o motivo deixou de ser obrigatório e a 6.69 já cancela e edita a mudança |
| 67 | Entrada v2 (login): a foto nova do quartel por plataforma, as brasas que esfriam até virar cinza (59, por 4,2 s), mais fracas sobre a saudação, e o pouso no quadro da tela inicial v3 | plano pronto (mockup aprovado em 26/11); junto com a 6.61; aguarda a ordem do usuário |
| 68 | Primeiro acesso e "Esqueci minha senha" por código no e-mail institucional (Brevo), e trocar a senha estando logado, na Minha ficha: o militar cria a própria senha; a senha provisória fica como reserva; os requisitos da senha à vista (migração 0051) | plano pronto; o usuário põe a chave do Brevo no Vercel antes da validação; aguarda a ordem do usuário |
| 69 | Histórico de rastreio: "Cancelar" e "Editar mudança" (na fase de testes o administrador mexe em qualquer período) e o aviso de militar do Pronto sem equipe, na pré-escala e em "Alterar situação" | mesclada (#292); sem migração |
| 70 | Grade geral redesenhada e menu lateral novo: o afastado (traço no dia, com o período na dica), a célula do nome clicável, a borda espessa e escura entre a área fixa e a que rola, a legenda com a cor certa e o menu pelo mockup da DESIGN (com os itens de hoje) | plano a reescrever: aguarda o redesenho da DESIGN (pedido do usuário, 26/11); sem migração |

**Ordem de execução das entregas com plano pronto** (26/11/2026, a pedido do usuário; o critério é o piloto de dezembro). Cada uma só começa quando o usuário mandar:

1. **6.58** Laboratório 1: tem prazo (antes da montagem de dezembro); exige a autorização do banco.
2. **6.65** Acabamento: defeitos já vistos e a ficha pela Grade; sem migração.
3. **6.68** Código por e-mail: para os militares criarem a própria senha no piloto; antes da validação o usuário põe a chave do Brevo no Vercel; migração 0051.
4. ~~**6.66** Remover do rastreio~~: descartada em 26/11 (a 6.69 cobre).
5. **6.63** Pesquisar militares v2: melhora o uso, não trava o piloto.
6. **6.61 e 6.67** Cabeçalho novo e Entrada v2: só visual; vão juntas, porque a animação pousa com o cabeçalho novo em volta.
7. **6.59 e 6.60** Laboratório 2 e 3: sem prazo; dependem da 6.58.
- **6.64** Equipes: modelada em 26/11 e com plano; é urgente, então entra logo depois da 6.58 e da 6.68 (migração).
- Os números das migrações não impõem ordem: o executor aplica os arquivos pendentes por nome, e cada plano manda usar o próximo número livre se houver colisão.

## Refatoração da interface · fundação concluída

Spec: `docs/superpowers/specs/2026-11-23-refatoracao-da-interface-design.md`. N0 = 6.19; N1 e N2 = 6.20 e 6.21 (plano `2026-11-23-fundacao-da-interface.md`). As telas seguem as áreas do Manual de Identidade Visual: Grade geral e Escala do mês antes do piloto; moldura, fichas e celular entre as duas.

## Fase 7 — Visualização de escalas · concluída

Design: `docs/superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md` (decisões do usuário de 24 e 25/11).

| Entrega | O que traz | Situação |
|---|---|---|
| 1 | API do voluntariado: a coleta por unidade e mês, o militar marca o próprio, o registro das correções (0044) | mesclada (#235) |
| 2 | Telas: Meu voluntariado (área pessoal), outro horário no dia, o interruptor da coleta, as correções | mesclada (#240) |
| 3 | API da prévia: lançar e recolher por escala e mês, o passado com justificativa e registro, as leituras da corporação (0045) | mesclada (#238); refeita pela 3.1 |
| 3.1 | API dos estados da escala: rascunho, prévia (unidade e as de baixo), publicada, retificada e remessada; a trava do passado fora do rascunho; a retificação automática; as leituras (0046) | mesclada (#251) |
| 4 | Montagem: o estado da escala, "Lançar prévia", "Publicar", "Republicar", o motivo do passado, as alterações no passado | mesclada (#253) |
| 5 | Módulo Visualização: Minha escala e Escalas, com o estado | mesclada (#255) |

Planos: `docs/superpowers/plans/2026-11-25-fase7-1-…` a `fase7-5-…` (a 3.1 é `fase7-3-1-…`). **Os estados da escala:** rascunho (só quem monta vê), prévia (a unidade e as de baixo; o passado trava), publicada (toda a corporação; mudança vira retificação, com a etiqueta "Escala em retificação" até o gestor republicar), retificada e remessada (a remessa aos superiores é da fase 9). Só o gestor publica. A 1 e a 2 são a prioridade. O .xlsx é a fase 8; a comparação com outro militar entra com a Escala por militar (fase 8) e a busca por permutantes, na fase 9.

## Fase 8 — Primeiro mês real · planejada

- **Distribuições automáticas:** JES num dia ou período escolhido pelo chefe, o expediente do Adm em todo dia útil (os saldos são à mão, 24/11), operações pelas cotas e buracos do Pronto. O motor já tem `distribuirCotas` e `distribuirAdm`; falta ligá-los às vagas, no padrão da pré-escala do Pronto.
- **Gerar documento:** modelos de impressão em Configurações, a escala em .xlsx a partir do modelo e o histórico dos documentos.
- **O mesmo modelo de guarnição mais de uma vez no dia.**
- **Otimizar o painel do dia** da Grade geral: 42 consultas com uma escala e três faixas, e cresce com cada faixa.
- **Escala por militar:** militares escolhidos, o mês, comparados. Forma com a Grade geral, a Escala do mês e o Efetivo por dia as quatro telas principais. A Minha escala (fase 7) é o caso de um militar só.
- **Piloto na 1ª SB:** dezembro de 2026, em paralelo com as planilhas, **só à mão**: saber se o sistema faz a escala como hoje se faz (24/11). A automação fica para uma rodada seguinte.

**A decidir:**
- distribuições: onde se configura a ordem dos buracos do Pronto; o saldo que não cabe; se a cota limita as vagas; se a compulsória (RN-41, RN-43) entra já;
- documento: o modelo atual de impressão; só o Ordinário ou também as operações;
- Escala por militar: o que se compara, quantos militares, se escala ou só mostra, como se liga às outras telas. Hipótese: o uso é a permuta; se for, a tela pode ir junto com as permutas (fase 9).
- `ADM_CUMPRE_CARGA` existe em Configurações, mas nada o lê (age como desligado, como na RN-17). Sem prioridade (P-34): um parâmetro para "cumpre 160h mas pode tirar PJES no expediente".
- A "prioridade" da cota ordena as operações na distribuição, sem regra no catálogo; talvez o campo saia (P-35, sem prioridade).

**Pendências técnicas para as distribuições** (achadas na revisão 3):
- `distribuirAdm` ignora as remoções quando a entrada vem sem `servico`;
- `turnosPadraoExigidos` não pede o B de D+1 num turno noturno de 24h;
- nomes de serviço e turno são comparados ora normalizados, ora pelo texto exato.

## Fase 9 — Operação diária · planejada

- Efetivo por dia na operação: operações do período das 08h de D às 08h de D+1, motoristas de serviço, presença e impressão.
- Permutas registradas (a Grade geral já trata a troca entre dois ordinários como permuta).
- **Busca por permutantes** (área pessoal): o militar escolhe um dia do mês e o sistema mostra quem está disponível para permutar com ele. Depende das specs de permutas, feitas no começo desta fase.
- Escala executada: gerar e enviar até o dia 5 do mês seguinte.
- **Remessar a escala** (estado "remessada", criado na 7.3.1): o botão que envia a escala cumprida aos superiores, para comprovar carga horária ou cotas; depois dele só o administrador altera.

**Entrega:** o escalante passa o mês inteiro no sistema, do dia 1 ao envio da escala executada.

## Fase 10 — Regras novas · planejada

- Regras validadas no laboratório, na ordem em que forem aprovadas: operações por função (B38/RN-81), equilíbrio de situações boas e ruins na compulsória (RN-43), causas de não ativação.
- A ajuda distribuída pelas telas, onde for necessária (não há tela de Ajuda), incluindo o roteiro do mês.
- A importação do Google Forms saiu do roadmap; volta só se o voluntariado marcado pelo próprio militar (fase 7) não pegar.

## Fase 11 — Institucionalização · planejada

- Estrutura acima do GB (CBMPE › DGO › Diretorias › GB), com o seletor de unidade.
- Escalas, guarnições e cotas em qualquer nível.
- Acesso por unidade acima do GB, com um gestor por nível.
- Tela de Histórico, sobre a auditoria que existe desde a fase 1 (fora do trilho do módulo de escala; o lugar se decide na fase 11).
- Antiguidade acima do GB, pelos almanaques.
- Servidor do Estado: cópia do banco, implantação, retirada do ambiente de teste. CPF e data de nascimento entram aqui (D7).

## Missões paralelas

Entregas fora das fases, numeradas P1, P2…: usam os dados do projeto, mas não mudam a ordem do roadmap.

| Entrega | O que traz | Situação |
|---|---|---|
| P1.1 | Quadros QOC, QOA e QBMG no banco; o quadro na ficha | mesclada (#94), migração 0026 aplicada no teste |
| P1.2 | Escala dos oficiais: motor, tabelas e API, com o serviço cadastrado | mesclada (#99), migração 0027 aplicada no teste |
| P1.4 | Só o QBMG nas outras telas de escala | mesclada (#101) |
| P1.3 | Escala dos oficiais: telas (escala do mês, saldo, regras), dia e noite só por cor | mesclada (#102) |
| P1.5 | Quem participa da rodada (o gestor escolhe entre os elegíveis) | mesclada (#125) |

Design: `docs/superpowers/specs/2026-11-22-escala-dos-oficiais-design.md`. Plano: `docs/superpowers/plans/2026-11-22-p1-escala-dos-oficiais.md`.

## Pendências conhecidas

Ficam em [`docs/pendencias.md`](../../pendencias.md) desde 24/11/2026: achadas nas revisões e nas validações, saem de lá quando viram entrega mesclada.

## Fluxo de uma regra nova

1. A regra é catalogada (RN-XX) pela DOCUMENTAÇÃO; a ideia nova que muda o domínio passa antes pela CONCEPÇÃO e pela PLANEJAMENTO (ver `CLAUDE.md`).
2. É prototipada no Apps Script e validada na sandbox pelo usuário.
3. Os casos validados viram casos compartilhados: `pnpm casos:gravar` e conferir o `git diff casos`.
4. O motor (`pacotes/dominio`) é ajustado até passar nos mesmos casos (`pnpm --filter dominio test`).
5. PR, revisão e merge com a anuência do usuário.

## Riscos

- **As telas da escala são a parte mais cara.** Por isso começaram só com o motor e os cadastros prontos.
- **Os dois sistemas podem divergir.** Os casos compartilhados são a defesa: nenhuma regra é portada sem eles.
- **Ambiente de teste gratuito:** pausa por inatividade e limites do plano (D2).
- **Dados pessoais numa nuvem comercial durante o teste:** desde 22/11/2026 (D7 revista), CPF, nascimento e endereço no banco de teste.
- **O Pecúlio aumenta o escopo de uma seção para o GB inteiro:** 184 militares em nove lotações; o acesso por lotação (fase 6) precisa estar certo antes de o militar comum entrar.
- **A Grade geral não foi validada com o militar comum:** desde a 6.1, a sandbox pode ter auxiliar, gestor e militar comum (senha provisória); falta a VALIDAÇÃO refazer esses testes.
