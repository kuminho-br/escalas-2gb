# Regras — escopo, cadastros, interface e requisitos do sistema

Escopo, papéis, cadastros, configurações e interface (RN-27 a RN-30, RN-32, RN-101, RN-115, RN-116) e os requisitos RS-01 a RS-04.

Quem cuida: DOCUMENTAÇÃO. Conferido contra o sistema novo em 21/11/2026. Índice e colunas: [LEIAME](LEIAME.md).

## Escopo e papéis

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-27 | O sistema atende hoje a 1ª SB. Na fase 5 passa ao 2º GB inteiro (nove lotações: SEDE, SCSv, 1ª a 7ª SB); acima do GB, na fase 11. Quem assina, cargo e dados da unidade ficam fora do sistema por enquanto. | Confirmada | Funciona para a 1ª SB; fases 5 e 11 | Base |
| RN-115 | Papéis: administrador (só na unidade raiz; edita os catálogos do sistema), gestor (o que o escalante faz, mais a meta padrão e as configurações do nível), escalante (monta as escalas e mantém os cadastros da unidade e das de baixo) e militar comum (vê só o que é dele e as escalas publicadas da unidade). Todo usuário é um militar do cadastro. | Confirmada | Em parte: administrador, gestor e escalante já valem na API (ex.: meta padrão e parâmetros só para gestor); o militar comum, as contas e as telas por papel, fase 6 | Base |
| RN-32 | Militar de outra unidade só é escalado por vínculo de militar externo com a unidade da escala. O gestor da unidade que recebe (ou quem está acima) o traz em Configurações da escala › Voluntariado, até alguém tirar; a lotação dele não muda. Aparece na equipe "Externo" e é lançado à mão em qualquer serviço; não entra na pré-escala nem nas distribuições. O auxiliar administrativo vê, mas não traz nem tira. | Confirmada | Funciona (6.33 e 6.36) | Base |

## Cadastros e configurações

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-28 | Os parâmetros do sistema ficam em Configurações, com vigência por mês, e valem para a unidade e as de baixo (a mais próxima vence). Vigência de mês que já passou é recusada, na tela e na importação. | Confirmada | Funciona | Base |
| RN-116 | Antiguidade repetida só avisa: o sistema não renumera nem bloqueia, e os dois militares ganham a pendência "Antiguidade repetida com <nome>". A partir da fase 5, dentro do GB, a antiguidade vem da "Ordem" do Pecúlio; acima do GB, dos almanaques (fase 11). | Confirmada | Funciona o aviso; fases 5 e 11 | Suporte |

## Interface

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-29 | Os painéis são sucintos, com pouca informação na tela, e os textos não usam jargão. | Confirmada | Funciona (princípio de design) | Suporte |
| RN-30 | A interface não usa o termo "matriz". As telas de trabalho da escala são Escala do mês, Efetivo por dia e Grade geral; a Escala por militar entra na fase 8. | Confirmada | Funciona | Suporte |
| RN-101 | Nas grades e listas de militares, a ordem é do mais antigo ao mais moderno: posto/graduação, depois a antiguidade cadastrada. Na lista "Escolher militar", o Pronto vem antes do Adm. | Confirmada | Em parte: o último desempate hoje é a matrícula (na tela Militares, o nome de guerra), não a ordem do cadastro; a antiguidade completa vem do Pecúlio (fase 5) | Suporte |

## Requisitos do sistema

O ID RS-XX segue a mesma disciplina do RN-XX e nunca é reaproveitado.

| ID | Requisito | Situação | No sistema novo |
|---|---|---|---|
| RS-01 | Documentos em .xlsx e PDF, a partir de um modelo .xlsx editável pelo escalante: escala do mês publicada, escala do dia (atravessa todas as escalas do dia) e escala executada. Formato, campos e ordem da escala do dia em aberto (P-32). | Confirmada | Fase 8 (Gerar documento); escala executada, fase 9 |
| RS-02 | Tela de permutas: o militar pede a troca e o escalante registra a permuta aprovada (RN-86 a RN-88). | Confirmada | Fase 9 |
| RS-03 | Página que mostra ao usuário as regras fixas no código e as regras configuradas por ele, lado a lado, cada uma com o ID do catálogo. | Confirmada | Sem fase (a tela de Ajuda da fase 10 pode recebê-la) |
| RS-04 | Desempenho: otimizar as rotinas mais lentas quando o código estabilizar. Hoje o caso medido é o painel do dia da Grade geral (42 consultas com três faixas). | Confirmada | Fase 8 |
