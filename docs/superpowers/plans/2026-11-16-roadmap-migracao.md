# Roadmap — Migração do Sistema de Escalas 2º GB

16/11/2026 · aprovado em 16/11/2026

**Objetivo:** levar o sistema do protótipo em Apps Script + Sheets para uma aplicação própria (banco relacional, API, interface web), primeiro numa fase de teste com cerca de 5 escalantes e depois no servidor institucional do Estado.

**Como ler:** cada fase termina numa entrega que dá para usar ou conferir. Cada fase ganha o seu próprio plano detalhado (tarefas, testes, commits) só quando for começar. Não há datas: o desenvolvimento é de uma pessoa, e a ordem importa mais que o prazo.

## Princípios

- **O protótipo continua sendo o laboratório de regras.** Uma regra nova ou complexa é prototipada e validada na sandbox do Apps Script. Só depois de aprovada ela é portada para o sistema novo.
- **As regras têm um teste só para os dois sistemas.** Os casos de teste viram arquivos de dados (entrada e resultado esperado) que rodam contra o protótipo e contra o sistema novo. Uma regra é considerada portada quando passa nos mesmos casos.
- **Tudo deve poder ir para o servidor do Estado sem retrabalho.** Banco Postgres padrão, sem depender de recursos exclusivos de um fornecedor de nuvem.
- **A auditoria existe desde o primeiro dia.** O registro de alterações é gravado pelo banco desde a fase 1, mesmo que a tela de histórico só chegue na fase 7.
- **Dados reais só com decisão explícita.** O tratamento de dados pessoais na fase de teste é uma decisão da fase 0.

## Visão geral

| Fase | Entrega | Quem usa |
|---|---|---|
| 0. Decisões e especificação | Documento de design aprovado | Você |
| 1. Fundação | Banco, API e site no ar, com login e auditoria | Você |
| 2. Motor de regras | Regras do Apps Script portadas, com os testes passando | Você |
| 3. Cadastros | Todas as telas de cadastro, com carga inicial da planilha | Você e os escalantes |
| 4. Montagem da escala (**1ª versão**) | Montar, conferir e publicar a escala do mês | **~5 escalantes (piloto 1ª SB)** |
| 5. Operação diária | Efetivo do dia, permutas, escala executada | Escalantes |
| 6. Insumos automáticos e regras novas | Importação do Google Forms; regras validadas no laboratório | Escalantes |
| 7. Institucionalização | Estrutura em vários níveis, acesso por unidade, histórico, servidor do Estado | Corporação |

## Fase 0 — Decisões e especificação

Decidir uma coisa de cada vez, com opções e recomendação, e registrar cada decisão no documento de design.

**Decisões técnicas**
- D1. Linguagem e framework da API. O peso maior é reaproveitar as ~2,5 mil linhas de regras já escritas em JavaScript.
- D2. Banco e hospedagem do teste (Supabase/Vercel ou outro), região dos dados e plano gratuito (o Supabase grátis pausa após 7 dias sem uso).
- D3. Login para ~5 usuários, sem prender a solução a um fornecedor.
- D4. Biblioteca de interface e grade (a lista de "Escolher militar", os blocos da grade geral).
- D5. Impressão por modelos: formato do modelo (planilha, documento ou PDF) e ferramenta para preencher.
- D6. Organização do repositório: um repositório com protótipo e sistema novo lado a lado, ou dois.
- D7. Dados pessoais no teste: usar dados reais ou fictícios, quais campos levar (TELEFONE não é usado) e quem pode ver.

**Especificação**
- Telas: as decisões dos esboços (versão 12), com cópia anonimizada guardada no repositório.
- Esquema do banco: o ER proposto mais unidades em árvore, lotação com vigência e registro de auditoria.

**Pendências de negócio que tocam as fases seguintes**
- Voluntariado: formato do formulário e o que se marca por dia (turnos A, B e C). Bloqueia a fase 6; na fase 4 o lançamento é à mão.
- Diagrama de atividades: E1 a E8 (quem dispara o formulário, assinatura do Chefe, aprovação da permuta, envio da escala executada).
- ER: Q3, Q5 (tipos de afastamento), Q6 (permutas antigas), Q7 (militar de outra seção), Q14 (cota × operação), Q17, Q18. Em 17/11/2026 ficaram resolvidas Q5, Q17, RN-94 e a ligação do turno do serviço com o turno padrão (adendo do design, "Cadastros"); seguem abertas Q6 (fase 5) e o formato do formulário (fase 6).

**Entrega:** documento de design aprovado (`docs/superpowers/specs/`), que serve de base para os planos das fases 1 a 4.

## Fase 1 — Fundação

- Repositório organizado conforme a D6, com testes rodando a cada envio (CI).
- Banco com o esquema completo e migrações versionadas: unidades, militares e lotação, afastamentos, serviços e turnos, guarnições e composição com vigência, escalas e vínculos, cotas, feriados, configurações, alocações, voluntariado, permutas e auditoria.
- Auditoria gravada pelo próprio banco em toda tabela de negócio.
- Site e API publicados no ambiente de teste, com login.
- Carga de exemplo para desenvolvimento.

**Entrega:** você entra no site, vê uma tela vazia autenticada, e cada alteração feita direto no banco aparece no registro de auditoria.

## Fase 2 — Motor de regras

- Portar a lógica de domínio (`nucleo`, `regras_escala`, `choques`, `pre_escala`, `distribuicao_adm`, `distribuicao_cotas`, `guarnicao`, `cadastro_guarnicoes`, `parametros`) para um módulo que não conhece banco nem tela.
- Converter os 389 testes atuais em casos de dados compartilhados, rodando contra o protótipo e contra o módulo novo.
- Expor o motor pela API: gerar pré-escala, distribuir operações, verificar choques, listar quem pode ocupar uma vaga.

**Entrega:** os mesmos casos passam nos dois sistemas.

**Como ficou (17/11/2026):** o motor está em `pacotes/dominio`. Os casos compartilhados não foram reescritos à mão: `pnpm casos:gravar` roda os testes do protótipo e grava cada chamada às funções do motor em `casos/<funcao_>.json`; `pnpm casos:prototipo` confere o protótipo contra eles e o Vitest do `dominio` confere o código novo. A pré-escala, a distribuição do Adm e os parâmetros não tinham teste no protótipo; ganharam testes de caracterização (`prototipo/testes/teste_motor.js`). A regra nova das remoções (adendo de 17/11/2026) está só no sistema novo, com testes próprios. A exposição do motor pela API passou para as fases 3 e 4, junto com as telas que a usam.

## Fase 3 — Cadastros

Atores (adendo do design): escalante, gestor (antigo chefe; vale para a unidade e as de baixo), militar comum (só leitura do que é dele e das publicações da unidade; não vê cadastros) e administrador (superusuário, na raiz).

Um cadastro por vez, cada um com API, tela e importação da sandbox, num PR próprio que você confere no ambiente de teste (adendo do design, "Cadastros"):

1. **Configurações e tipos de afastamento:** parâmetros com norma de referência; catálogos do sistema (tipos de afastamento, atividades), editados pelo administrador.
2. **Militares e afastamentos:** identificação, lotação com histórico, jornada, quadro de motoristas e CNH com hierarquia, afastamentos com tipo.
3. **Atividades, funções e guarnições:** guarnição = atividade + composição, com viatura opcional e versões por vigência.
4. **Serviços, turnos e escalas:** turnos dentro do serviço, com "Pede voluntariado em" pelo horário; escalas com serviços reunidos, publicação e guarnições por turno com vigência.
5. **Cotas e feriados.**

A importação é feita na tela, com prévia e confirmação; os dados reais vão direto para o banco de teste (D7).

**Entrega:** os cadastros da 1ª SB conferidos no sistema novo, iguais aos da sandbox.

## Fase 4 — Montagem da escala (1ª versão para os testadores)

- Escala do mês: gerar pré-escala, tabela dia › turno › cards de guarnição, ícones de situação, "Escolher militar" com a lista já filtrada, vagas vazias em listras.
- Grade geral: blocos coloridos com a letra do turno, choques, cotas pegas de pedidas por PJES e Diária, ficha lateral com Trocar, Remover e Adicionar.
- Voluntariado lançado à mão: calendário com marcação rápida e "Salvar e ir para o próximo".
- Gerar documento: escala publicada a partir do modelo de impressão.
- Minha escala, para o militar comum: os próprios serviços dia a dia, com quem compõe cada guarnição com ele, e as escalas publicadas da unidade dele.

**Entrega e marco:** piloto na 1ª SB. Um mês real montado no sistema novo, em paralelo com as planilhas atuais, e comparado no fim.

## Fase 5 — Operação diária

- Efetivo do dia: turnos A e B lado a lado, operações do período das 08h de D às 08h de D+1, motoristas de serviço, marcação de presença, impressão.
- Permutas registradas na Grade geral e mostradas no Efetivo do dia.
- Escala executada: gerar e enviar até o dia 5 do mês seguinte.

**Entrega:** o escalante passa o mês inteiro no sistema, do dia 1 ao envio da escala executada.

## Fase 6 — Insumos automáticos e regras novas

- Importação do Google Forms em quatro passos (enviar, ligar colunas, conferir, importar), com a ligação de colunas guardada. Depende da pendência do formato do formulário.
- Regras validadas no laboratório entram aqui, na ordem em que forem aprovadas: distribuição de operações por função (B38/RN-81), equilíbrio de situações boas e ruins na compulsória (RN-43), causas de não ativação (viatura, calendário).
- Tela de Ajuda com o roteiro do mês.

**Entrega:** o voluntariado do mês entra pela importação, e cada regra nova chega já com os casos de teste compartilhados.

## Fase 7 — Institucionalização

- Estrutura: árvore CBMPE › DGO › Diretorias › GB › Seção, com o seletor de unidade no topo das telas.
- Escalas, guarnições e cotas em qualquer nível, como a operação do GB.
- Acesso por unidade, com um gestor por nível (chefe, diretor) que cadastra os usuários do seu nível e de todos os de baixo e define o gestor de cada nível abaixo.
- Tela de Histórico, sobre o registro que existe desde a fase 1.
- Marcação de voluntariado pelo próprio militar.
- Migração para o servidor do Estado: cópia do banco, implantação e retirada do ambiente de teste.

**Entrega:** sistema em produção institucional.

## Fluxo de uma regra nova (vale a partir da fase 2)

1. A regra é catalogada (RN-XX) pela sessão REGRAS DE NEGÓCIO.
2. É prototipada no Apps Script e validada na sandbox por você.
3. Os casos validados viram arquivos de teste compartilhados: `pnpm casos:gravar` e conferir o `git diff casos`.
4. O módulo novo (`pacotes/dominio`) é ajustado até passar nos mesmos casos (`pnpm --filter dominio test`).
5. PR, revisão e merge com a sua anuência.

## Riscos

- **A interface da Escala do mês e da Grade geral é a parte mais cara.** Por isso ela só começa na fase 4, com o motor e os cadastros prontos.
- **Os dois sistemas podem divergir.** Os casos de teste compartilhados são a defesa: nenhuma regra é portada sem eles.
- **Ambiente de teste gratuito:** pausa por inatividade e limites do plano. Isso é tratado na D2.
- **Dados pessoais numa nuvem comercial durante o teste.** Isso é tratado na D7.
