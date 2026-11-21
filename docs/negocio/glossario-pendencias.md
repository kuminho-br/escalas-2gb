# Glossário — pendências e divergências
Fonte: Glossário do claude.ai (v0.9, 15/11/2026), colhido em 20/11/2026. Quem cuida: DOCUMENTAÇÃO. A tabela de versões não veio: o histórico fica no git. Termos: [glossario.md](glossario.md).

## EM ABERTO
Perguntas para levar aos escalantes. Ao responder, marque o item e atualize o status do termo.

- [ ] **P1 — SB:** qual o significado da sigla?
- [ ] **P2 — PJES / JES:** qual o significado das siglas?
- [x] **P3 — Serviço externo:** respondida pela RN-35 (Confirmada): a origem interna/externa é atributo da cota; o tipo "PJES Externo" deixa de existir.
- [x] **P4 — Diárias:** respondida pela RN-04 (Confirmada): cada cota de diária = 1 alocação num turno de operação; tira quem preencheu o formulário do mês, sem precisar ser voluntário JES. Se a cota conta para a meta de ativação é atributo da cota (RN-95). O limite mensal segue na RN-63 (a esclarecer).
- [ ] **P5 — Ordinária × extraordinária:** o critério é o tipo de serviço (Ordinário de um lado; PJES, externo e Diária do outro)?
- [ ] **P6 — "Escala" com dois sentidos:** respondida em parte pelo modelo conceitual de 14/11 — a visão mensal (GRADE GERAL) é saída do sistema, não a entidade; a entidade estrutural é a Escala de serviço, que agrupa um ou mais serviços com demanda operacional compartilhada. Segue aberto: mantém os dois nomes ("Escala" para a visão e "Escala de serviço" para a entidade) ou renomeia um deles?
- [ ] **P7 — Viaturas:** parcial: a entidade ativada é a guarnição, e a viatura é atributo opcional (RN-07, RN-96); a meta é o cadastro mensal da aba GUARNIÇÕES (RN-93). Segue aberto: a sigla é ABT ou ABTS? O que significam ABT, AR, ACO e UT?
- [ ] **P8 — OUTRAS SEÇÕES:** como tratar o militar lotado numa seção e servindo em outra? (RN-32)
- [x] **P9 — Motorista:** respondida pela RN-12 — guarda a categoria da CNH, e a função motorista exige a categoria adequada à viatura.
- [ ] **P10 — Afastamentos:** quais tipos existem (férias, LTS, outros)? Bloqueiam todo serviço, inclusive JES e diária? A RN-52 (a esclarecer) propõe que sim; entram na pré-escala de novembro (Boletim)?
- [ ] **P11 — Permutas:** parcial: o registro é do par de permutantes, com os dois militares e os dois serviços (RN-86). Segue aberto: o que significa cada marcação da planilha antiga (PERMUTA, ENTROU, SÓ 1ºT, SÓ 2ºT)?
- [x] **P12 — Funções:** respondida: a lista é cadastro do usuário (RN-94), e só a função de motorista tem critérios: o quadro de motoristas e a CNH (decisão do usuário, 10/11; RN-12).
- [ ] **P13 — Feriados:** pontos facultativos (Carnaval, Corpus Christi) contam como feriado para o expediente do Adm?
- [x] **P14 — Saldo:** encerrada. A pergunta saiu das pendências do catálogo e a RN-14 foi reescrita (Adm sem carga não tem o serviço Adm lançado). O Saldo segue como 3ª camada da RN-13.
- [x] **P15 — Formulário de voluntariado:** respondida pela RN-47 (Confirmada): o militar escolhe o dia e o turno. Na main (PR #3, 18/10) a aba VOLUNTARIADO tem uma coluna DATA com a data inteira (B31).
- [ ] **P16 — Aba de parâmetros:** o nome oficial é CONFIGURAÇÕES (planilha e código) ou PARÂMETROS (diretriz do PLANEJAMENTO)? Pergunta para o PLANEJAMENTO.
- [x] **P17 — JES para não voluntário:** respondida pelo catálogo (rev. 85): bloqueia (RN-46). A RN-48 vale só para dias fora do formulário, sem bloqueio.
- [x] **P18 — Carga do Adm na pré-escala:** respondida pelo catálogo (rev. 85): a distribuição do Adm só se aplica quando o Adm cumpre as 160h (RN-20 com RN-17 ligada).
- [x] **P19 — Ordem de preenchimento:** respondida pelo catálogo (rev. 122): prevalece a RN-13 (Pronto → JES do Pronto → Saldo do Adm); a ordem do normativo (RN-69) não é usada.
- [ ] **P20 — Operação:** parcial: a operação é característica do serviço do tipo Diária (RN-83), não da cota (RN-35). Segue aberto: ela é a mesma coisa que a Escala de serviço (aba ESCALAS)? Têxtil ainda não está na aba TURNOS.
- [ ] **P21 — Adm hipotecado:** o termo do normativo (RN-69, RN-71) é o mesmo que o Saldo do Adm?
- [x] **P22 — Apoio Operacional Aquartelado:** respondida pelo catálogo (rev. 150) e pela decisão B58: é uma guarnição cadastrada, sem viatura, com motorista que exige CNH (RN-96, RN-12); "Despachante" é função, e o nome do posto externo não importa (P-24 resolvida, 10/11).
- [ ] **P23 — Dias passados:** até onde o passado fica travado e que correções continuam permitidas nele? (RN-85; P-17 do catálogo)
- [ ] **P24 — CNH:** respondida (decisão do usuário, 14/11): a hierarquia fica no código, por ser regra do CTB — E habilita D, C e B; D habilita C e B; C habilita B; A habilita só A. Na main desde a P19 (B71).
- [ ] **P25 — Unidade tática:** INCÊNDIO, PRÉ-HOSPITALAR e SALVAMENTO entram como guarnições cadastradas ou são outra coisa? (P-28 do catálogo)
- [ ] **P26 — Origem:** o termo tem dois sentidos, a origem da cota (interna/externa, RN-35) e a origem do serviço na escala (PRONTO, SALDO, PJES; coluna ORIGEM de TURNOS). Mantém os dois nomes?
- [ ] **P27 — Prioridade vazia:** guarnição sem PRIORIDADE em GUARNIÇÕES continua indo por último na ativação, ou o valor passa a ser obrigatório? (RN-08; P-31 do catálogo, card B73)
- [ ] **P28 — Escala do dia:** em que formato sai (aba, PDF, texto para mensagem), com que campos, em que ordem, e se inclui vagas vazias e militares sem função? (RS-01; P-32 do catálogo, card B76)

### Divergências entre registros
| ID | Onde | Divergência | Situação |
| --- | --- | --- | --- |
| D1 | Tabela MILITARES × Design da Arquitetura | Motorista: categoria da CNH na planilha; "sim/não" no documento. | Resolvida pela RN-12: vale a categoria. |
| D2 | Registros do escalante × Catálogo RN | Viatura escrita "ABT" e "ABTS". | Aberta, ver P7. |
| D3 | Design da Arquitetura × RN-27 | Entidade PARÂMETRO aparece duas vezes e uma delas cita "quem assina", retirado do sistema. | Aberta, para a PROGRAMAÇÃO. |
| D4 | Design da Arquitetura (fluxo mensal) × RN-30 | Passo "Montar matriz" ainda usa o nome antigo; hoje é "Carregar escala". | Aberta, para a PROGRAMAÇÃO. |
| D5 | Diretriz do PLANEJAMENTO × planilha e código | Aba PARÂMETROS e chave saldos\_adm\_mes × aba CONFIGURAÇÕES e chave SALDOS\_ADM\_POR\_MILITAR. | Aberta, ver P16. |
| D6 | Diretriz do PLANEJAMENTO × planilha | Matrículas duplicadas em MILITARES (Armando, Sarah, Ivan). A planilha de 13/10 não tem duplicatas. | Provavelmente já corrigida; confirmar com o PLANEJAMENTO. |
| D7 | Catálogo RN-46 × RN-48 | Bloqueio de JES para não voluntário × princípio de nunca bloquear o escalante. | Resolvida (catálogo rev. 85): RN-46 bloqueia o não voluntário; RN-48 trata de dias fora do formulário e não bloqueia. |
| D8 | Catálogo RN-17 × RN-20 | Adm sem carga de 160h × pré-escala que distribui a carga do Adm. | Resolvida (catálogo rev. 85): RN-20 só se aplica com a RN-17 ligada. |
| D9 | Catálogo RN-13 × RN-69 | Ordem Pronto → JES do Pronto → Saldo do Adm × normativo: jornada especial → Adm hipotecado → PJES da OME → PJES de outras OMEs. | Resolvida (catálogo rev. 122): prevalece a RN-13; a RN-69 não é usada. |
| D10 | Código (main) × Catálogo (RN-35, RN-83) | O código liga a cota a uma escala da aba ESCALAS pela coluna OPERAÇÃO; o catálogo tira a operação da cota e a põe no serviço do tipo Diária. A parte do turno no VOLUNTARIADO foi resolvida pela RN-47. | Aberta, para a PROGRAMAÇÃO; ver P20. |
| D11 | Repositório (main) × Catálogo | RN-50 e RN-51 estão na main desde a P14, mas o catálogo ainda não as marca como Implementada (RN-40 e RN-41 já marcadas na rev. 122). | Parcial (catálogo rev. 160): a RN-51 segue Confirmada de propósito, por estar só em parte no código; a RN-50 não aparece na varredura. Para a REGRAS DE NEGÓCIO. |
| D12 | Repositório (main, PR #3) × Catálogo | RN-03 e RN-36 já são validadas na escala manual (B22, B01), mas seguem Confirmada no catálogo. | Resolvida (catálogo rev. 160): RN-03 e RN-36 marcadas como Implementada. |
| D13 | Código (main) × RN-04 | As diárias só aceitam voluntário JES (separarVoluntariado\_); a RN-04 exige só o formulário do mês. | Resolvida: B50 entregue na P18; RN-04 Implementada (catálogo rev. 160). |
| D14 | Catálogo (P-28) × Repositório | A aba VIATURAS (P16/B38) é citada no catálogo, mas não está no GitHub. | Resolvida: a aba VIATURAS entrou na main como GUARNIÇÕES (PR #4, 10/11). |
| D15 | Repositório (main, PR #4) × Catálogo | RN-07 a RN-12, RN-81, RN-93, RN-94 e RN-96 estão na main desde o PR #4, mas seguem Confirmada no catálogo, à espera do teste na sandbox. | Resolvida (catálogo rev. 160): RN-09, RN-12, RN-81, RN-93 e RN-96 passaram a Implementada; RN-07, RN-08, RN-10, RN-11 e RN-94 ficaram Confirmada de propósito, porque a ativação automática ainda não foi feita ou a regra está só em parte no código. |
| D16 | Catálogo RS-06 × main (B48) | O RS-06 pede coluna Função com lista suspensa na grade; a main mostra a função como nota na célula e a atribui pelo menu "Alocar em Função". | Aberta, para a REGRAS DE NEGÓCIO. |
| D17 | Modelo conceitual de 14/11 × código (main) | O código assume escala 1:1 com serviço, o que só funciona por coincidência de nomes (Defensoria, PE Seguro, Bioma, CPRH); o modelo confirmado pelo usuário é 1:N (a escala do Ordinário agrupa Pronto, JES e Saldo). | Resolvida: escala com N serviços na main desde a P18 (B63); RN-100 Implementada (catálogo rev. 160). |
