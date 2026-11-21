# Pecúlio do 2º GB — design da fase 5

20/11/2026 · rascunho: levantamento feito, decisões em aberto

O que se sabe do Pecúlio e o que falta decidir antes do plano da fase 5. A ordem das fases está no roadmap; o histórico das decisões, em `docs/decisoes.md`.

## Por quê

O desenvolvimento andou mais rápido que o previsto: a fase 4 já tem as telas de trabalho e ainda não é hora de montar a escala de um mês real. O Gerar documento só teria uso quando o sistema publicasse uma escala de verdade.

Na leitura do usuário, o que destrava mais coisas é a **base de dados dos militares**, que hoje vive na planilha do Pecúlio:

- os acessos de todos os militares (cada usuário do sistema já é um militar do cadastro, `usuario.militar_id`);
- a diferenciação dos tipos de usuário (fase 6) e a Minha escala (fase 7);
- a antiguidade do GB, pela "Ordem" do Pecúlio;
- os afastamentos sem lançamento à mão (férias, L.E, LTS e DTS);
- o militar marcando o próprio voluntariado (fase 7), o que dispensa a importação do Google Forms.

### Rotas consideradas (20/11/2026)

- **Rota 1, seguir o roadmap** (Gerar documento, depois o piloto). Descartada: no piloto, em paralelo com as planilhas, quem publica é a planilha.
- **Rota 2, preparar o piloto** (estabilidade, distribuições automáticas, importação do voluntariado, piloto, documento). Virou a ordem da fase 8.
- **Rota 3, Pecúlio primeiro (escolhida):** Pecúlio (5), tipos de usuário e módulos (6), Visualização (7) e só então o primeiro mês real (8).

## O que é o Pecúlio hoje (levantamento de 20/11/2026)

Uma planilha, `BACKUP DO PECÚLIO 2ºGB (04NOV26).xlsx`, guardada em `docs/fontes de dados/`, **fora do Git** (`.git/info/exclude`). O levantamento leu só a estrutura (abas, cabeçalhos, contagens e categorias), sem copiar dados pessoais.

**Aba "2ºGB" (a principal):** cerca de 184 militares do 2º GB inteiro, de Ten Cel a Sd, com o cabeçalho na linha 9 e um título institucional em cima. Colunas:

- sexo, **Ordem** (a antiguidade no GB), posto/grad., matrícula, nome completo;
- voluntário PJES, abono de permanência, aniversariantes do mês, aniversário, data de nascimento, **CPF**, data de ingresso;
- **lotação** (SEDE, SCSv, 1ª a 7ª SB), função administrativa (cerca de 49 diferentes) e comportamento (Excepcional, Ótimo, Bom);
- **férias:** BGE, plano, reprogramação do período 2026/2027, reprogramadas e cassada;
- L.E, LTS, DTS e adido/agregado;
- à direita, blocos de resumo por posto (SubTen, 1º Sgt…), que são contas da planilha, não dados de militar.

**Aba "Números efetivo":** previsto, existente e déficit do 2º GB e da 1ª SB, e o existente por SB e por posto.

**Aba "Missões extra por portaria":** missão, publicação, posto, matrícula, nome e funções extras.

**O que o Pecúlio não tem:** e-mail (o login de hoje é por e-mail), CNH, equipe e jornada. Os três últimos continuam vindo da escala.

## Dados pessoais

Vale a D7 revista em 20/11/2026 (design da migração, D7): o teste recebe todos os campos do Pecúlio, **menos o CPF e o ano de nascimento**. O aniversário fica só com dia e mês. O conjunto fictício do desenvolvimento cresce para o GB inteiro, com as nove lotações e os campos novos.

## Escopo previsto da fase 5

- **Estrutura do 2º GB:** as nove lotações viram unidades abaixo do 2º GB.
- **Ficha ampliada e importação** dos militares do GB, no padrão das importações da fase 3 (prévia, problemas com solução, importar de novo sem duplicar).
- **Antiguidade pela "Ordem":** resolve a antiguidade institucional dentro do GB.
- **Afastamentos vindos do Pecúlio:** férias (com o BGE e as reprogramações), L.E, LTS e DTS alimentam os afastamentos que a escala já usa.
- **Telas do módulo Pecúlio:** lista e ficha de todos os militares do GB.

## Várias unidades

Com as nove lotações, aparecem os problemas que antes só existiriam na institucionalização. Entram neste design:

- a transferência vai sempre para a unidade do usuário;
- a antiguidade é comparada no caminho da unidade e na lotação;
- uma função igual pode ser criada na unidade de cima;
- o catálogo de funções vem da unidade do usuário, não da guarnição;
- renomear uma função não confere as unidades de baixo;
- um feriado criado numa unidade de baixo pode repetir a data de um de cima.

## Decisões que faltam (antes do plano)

1. **Uso de hoje:** quem atualiza a planilha e quando, quem consulta e para quê, e o que dá trabalho.
2. **Ficha única ou duas:** a ficha do Pecúlio e a de Militares são a mesma, com mais campos, ou duas coisas separadas?
3. **Fonte dos dados depois da importação:** o sistema (a planilha é aposentada) ou a planilha (importada de novo de tempos em tempos)?
4. **Abas extras:** Números efetivo e Missões extra por portaria entram no módulo?
5. **Como o militar comum entra:** o Pecúlio não tem e-mail. Se a resposta pedir um campo novo, ele nasce na ficha desta fase.
6. **Quem vê cada informação:** por tipo de usuário e por lotação. Fecha junto com a fase 6, mas a ficha já nasce sabendo quais campos são restritos.
