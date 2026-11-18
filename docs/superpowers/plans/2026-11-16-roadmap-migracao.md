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
| Revisões antes da fase 4 | Pendências aplicadas, telas testadas com pessoas e código revisado | Você e alguns usuários |
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
   - **2.1 Modelo de planilha e ajustes da ficha (adendo de 17/11/2026):** em toda tela com importação, "Baixar modelo" entrega uma planilha com a aba nomeada, o cabeçalho pronto e uma aba AJUDA; as entregas 3 a 5 já nascem com ele. A ficha ganha lotação recolhida e por último, formulário de afastamento sob demanda, botões de motorista menores e o aviso de antiguidade repetida.
3. **Atividades, funções e guarnições:** guarnição = atividade + composição, com viatura opcional e versões por vigência.
4. **Serviços, turnos e escalas:** turnos dentro do serviço, com "Pede voluntariado em" pelo horário; escalas com serviços reunidos, publicação e guarnições por turno com vigência.
5. **Cotas e feriados.**

A importação é feita na tela, com prévia e confirmação; os dados reais vão direto para o banco de teste (D7). Cada importação oferece o modelo de planilha para baixar.

**Entrega:** os cadastros da 1ª SB conferidos no sistema novo, iguais aos da sandbox.

**Como ficou (18/11/2026):** os cinco cadastros estão no sistema novo, cada um com API (Hono, contratos em zod compartilhados com o site), tela (lista e detalhe) e importação da planilha, com prévia, modelo para baixar e a regra de que linha com problema é pulada e o resto entra; importar o mesmo arquivo de novo não grava nada. O que mudou em relação ao plano acima, por decisão do usuário depois de usar as telas no ambiente de teste:
- **Guarnição é um modelo** (adendo de 17/11/2026): a atividade saiu do cadastro dela, que é só nome, viatura informativa, prioridade e composição por versão. "Sem limite" deixou de existir: máximo vazio vale o mínimo. Excluir virou desativar (agora ou a partir de um mês), nas guarnições, nos serviços e nas escalas.
- **Serviços e turnos:** "Pede voluntariado em" saiu da tela (a regra, `turnosPadraoExigidos`, fica no motor para o voluntariado, fase 4). O turno único deixou de existir: o serviço de um turno só usa o A. A ficha ganhou a régua do dia, que mostra o turno que passa da meia-noite até onde ele vai no dia seguinte, e a cor escolhida numa grade como a do Google Planilhas.
- **Escalas:** o vínculo da guarnição é por faixa de horário, e não por letra de turno (adendo de 18/11/2026): a matriz tem uma coluna por horário distinto entre os serviços, mostra a letra junto quando ela não é ambígua, e "Todos os turnos" não existe mais. As fichas avisam "Alterações não salvas" antes de trocar de ficha ou sair.
- **Cotas e feriados:** a cota aponta direto para o serviço (PJES ou diária), sem o campo operação; o feriado é da unidade e vem herdado de cima, e "Copiar feriados fixos" leva só os que caem no mesmo dia todo ano. A importação lê as abas COTAS e FERIADOS das mesmas colunas do protótipo, com regras mais rígidas (a linha de outra seção, a de JES que o protótipo pulava em silêncio e os formatos de mês e de data fora de aaaa-mm, mm/aaaa, dd/mm/aaaa e aaaa-mm-dd viram problema com a solução, em vez de serem aceitos ou pulados sem aviso), e o feriado de data móvel (Carnaval, Cinzas, Paixão, Sexta-feira Santa, Páscoa, Corpus Christi) entra como móvel, com aviso.
- **Contrato de datas:** a data do contrato recusa dia que não existe no calendário (antes passava e dava erro do banco).

Ficou para as fases seguintes: a exposição do motor pela API (pré-escala, distribuições, quem pode ocupar a vaga) e o modelo de impressão (fase 4), a tela de Estrutura, o Histórico e o cadastro de usuários (fase 7), e a antiguidade institucional pelos almanaques (fase 7). "Distribuídas" nas cotas vale 0 até a fase 4, quando a escala passar a gravar alocações.

## Revisões antes da fase 4 (adendo de 18/11/2026)

Os cadastros estão prontos, mas foram feitos em dez entregas, cada uma com pendências pequenas anotadas no PR. Antes de montar a escala em cima deles, três revisões, nesta ordem (decisão do usuário):

1. **Revisão 1 — pendências.** Aplica a análise de interface de 18/11/2026 (as propostas aceitas estão no adendo do design "Revisões antes da fase 4") e as pendências menores anotadas nos PRs da fase 3 que uma pessoa pode encontrar ao usar as telas. As que já foram resolvidas saem da lista. As que só dizem respeito ao código (testes que faltam, código sem uso, recuo) ficam para a revisão 3. As que só aparecem com várias unidades ou com a escala gravando alocações ficam para as fases 4 e 7. Plano próprio: `docs/superpowers/plans/2026-11-18-revisao-1.md`.
2. **Revisão 2 — testes com pessoas.** Alguns escalantes e militares usam os cadastros no ambiente de teste, com os dados da 1ª SB. O retorno vira uma rodada de ajustes, com plano próprio quando houver o que mudar.
3. **Revisão 3 — revisão de código.** Leitura do sistema novo inteiro (API, site, motor e contratos), com as pendências internas separadas na revisão 1. Os problemas encontrados são corrigidos com teste antes da fase 4.

**Entrega:** a fase 4 começa com os cadastros testados por quem vai usá-los e com o código revisado.

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
- Antiguidade institucional: hoje é o lugar no ranking do 2º GB; com outros níveis hierárquicos, passa a vir dos almanaques, e a antiguidade por nível é derivada pelo sistema (pendência registrada no adendo de 17/11/2026 do design; só pesa quando o escopo for institucional).
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
