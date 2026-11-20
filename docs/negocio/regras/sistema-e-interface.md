# Regras — escopo, interface e requisitos do sistema
Escopo do sistema, configurações, interface (RN-27 a RN-32, RN-101) e os requisitos RS-01 a RS-07.

Fonte: Catálogo de Regras de Negócio do claude.ai (rev. 160, 15/11/2026), colhido em 20/11/2026. Quem cuida: REGRAS DE NEGÓCIO. Índice: [LEIAME](LEIAME.md).

## Escopo, configurações e interface
O sistema atende só a 1ª SB nesta fase, com parâmetros num painel de configurações e telas enxutas.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-27 | O sistema atende só a 1ª SB. Quem assina, cargo e dados da unidade ficam fora do sistema por enquanto. | Confirmada | Base |
| RN-28 | Os parâmetros do sistema, atuais e futuros, ficam num painel de configurações. | Implementada | Base |
| RN-29 | Os painéis são sucintos, com pouca informação na tela. | Confirmada | Suporte |
| RN-30 | A interface nunca usa o termo "matriz". A visão mensal de todos os militares é a GRADE GERAL, aberta pelo menu "Mostrar Grade Geral" (botão "Carregar grade geral"); a geração automática fica no menu "Escala Automática" (nomes definidos pelo usuário em 14/11, B66). Diálogo com título "Escala de [mês] de [ano] da ? SB". | Confirmada | Suporte |
| RN-31 | A escala exibida fica sincronizada com a tabela de alocações: o que muda numa aparece na outra. | Implementada | Base |
| RN-32 | Militares de outras seções ficam no bloco "OUTRAS SEÇÕES" da escala; o tratamento deles ainda será definido. | A esclarecer | Base |
| RN-101 | Nas grades e listas de militares (GRADE GERAL e lista "sem função" da aba ESCALA), a ordem é do mais antigo ao mais moderno: posto/graduação, depois ANTIG. (2ºGB), depois a ordem do cadastro. A ANTIG. só desempata dentro do mesmo posto (P17, P19). | Implementada | Suporte |

## Requisitos do sistema
Regra de negócio (RN) é como o serviço funciona no quartel: valeria mesmo sem sistema. Requisito de sistema (RS) é o que o sistema tem de oferecer para dar conta dessas regras: telas, documentos, desempenho. O ID RS-XX segue a mesma disciplina do RN-XX e nunca é reaproveitado.

| ID | Requisito | Status |
|---|---|---|
| RS-01 | Emissão de documentos em PDF ou Docs, salvos no Drive: prévia da escala mensal (escolhe o mês e a escala) e escala do dia (escolhe o dia e sai o efetivo escalado nele). A escala do dia atravessa todas as escalas daquele dia (Ordinário, Bioma, PE Seguro, Defensoria, CPRH...), card B76. Não confundir com a visualização mensal do Ordinário no formato do documento oficial (B40), descartada pelo usuário em 14/11 e removida na P19. Formato, campos e ordenação da escala do dia em aberto (P-32). | Confirmada |
| RS-02 | Tela de controle de permutas: o militar pede a troca a partir da pré-escala e o escalante acompanha os pedidos (RN-86 a RN-88). | Confirmada |
| RS-03 | Página que mostra ao usuário as regras fixas no código e as regras configuradas por ele, lado a lado, cada uma com o ID do catálogo. | Confirmada |
| RS-04 | Desempenho: o tempo de execução das rotinas está alto. Quando o código estabilizar, otimizar as rotinas mais lentas. | Confirmada |
| RS-05 | Cadastro de cota com campo para marcar se ela conta para a meta de ativação de guarnições (RN-95). | Confirmada |
| RS-06 | Coluna Função na grade de alocações, após a coluna Equipe: ao clicar na célula, abre uma lista suspensa com as funções cadastradas para aquele serviço/turno (RN-81, RN-94). | Confirmada |
| RS-07 | Menu Escalas - 2º GB > Atualizar estrutura: único ponto do sistema que cria ou altera a estrutura da planilha (abas, colunas, renomeações, conversões de formato). Roda as migrações pendentes de forma idempotente, com uma confirmação, e mostra um relatório por passo (feito, já estava no formato atual, atenção ou o erro). Os painéis não têm mais botões de estrutura (B69, P19). | Implementada |
