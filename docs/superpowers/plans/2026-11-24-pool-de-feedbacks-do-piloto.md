# Pool de feedbacks do piloto de dezembro

24/11/2026 · pedido do usuário: ele vai passar vários feedbacks ao preparar a escala de dezembro no sistema; a PLANEJAMENTO agrupa num pool, e, quando ele crescer, planeja a implementação.

## Como funciona

1. **Entrada:** cada feedback vira uma linha, com a data, quem trouxe (o usuário, ou a VALIDAÇÃO/DESIGN/SAC repassando) e o pedido em poucas palavras, com as palavras do usuário.
2. **Tipo:** **principal** (bloqueia montar a escala de dezembro à mão) ou **secundária** (adendo que não bloqueia). Principal passa na frente da fila.
3. **Estado:** `aberto` → `agrupado` (junto com outros do mesmo tema, numa entrega) → `planejado` (tem spec ou plano) → `em execução` → `entregue` (PR mesclado).
4. **Quando planejar:** quando o pool tiver itens suficientes para uma entrega com sentido, ou quando o usuário pedir. A PLANEJAMENTO escolhe o ponto da fase e avisa o usuário dos agrupamentos antes de despachar.
5. **Dúvida do usuário:** se um feedback depende de uma decisão de base, ela vai ao usuário numa pergunta; o item fica `aberto` até a resposta.

## Pool (ativo)

| # | Data | Quem trouxe | Pedido (resumo) | Tipo | Estado | Entrega |
|---|---|---|---|---|---|---|
| 1 | 24/11 | usuário | Grade geral: linha mais forte separando a área que rola (dias e alocações) da fixa (militar, PJES, Diárias e o cabeçalho das datas); padrão de UI com a DESIGN, para toda tabela com rolagem | secundária | planejado | 6.46 (Fable; DESIGN confere) |
| 2 | 24/11 | usuário | A barra de saldo do Adm fica à direita da matrícula, alinhada à direita na célula do militar (hoje está antes) | secundária | planejado | 6.46 (Fable; DESIGN confere) |
| 3 | 24/11 | usuário | Os filtros de equipe da Grade (Todas, ALFA…) sem identidade visual: repensar; "Adm" vira "ADM" | secundária | planejado | 6.46 (Fable; DESIGN confere) |
| 4 | 24/11 | usuário | Pecúlio reestruturado: o módulo vira "Pecúlio Geral", com as views "Pecúlio da unidade" (a de hoje, com um botão para incluir as unidades de baixo), "Pesquisar militares" (a corporação inteira, com vários filtros) e "Aniversários" (calendário) | secundária | agrupado | spec do Pecúlio Geral e lote |
| 5 | 24/11 | usuário | A lista de militares do Pecúlio precisa de linha divisória entre os itens, ou cartões dentro de um painel | secundária | agrupado | spec do Pecúlio Geral e lote |
| 6 | 24/11 | usuário | A ficha completa aberta pela busca do Pecúlio leva à aba Militares das escalas; deve abrir no próprio Pecúlio | secundária | agrupado | spec do Pecúlio Geral e lote |
| 7 | 24/11 | DESIGN | Tela inicial, versão 2, aprovada: cena menor que encolhe ao rolar e atalhos dos módulos (avisos e próximos serviços ficam para depois) | secundária | planejado | 6.42 (Fable) |
| 8 | 24/11 | usuário | Atualização em lote no Pecúlio Geral: seleção não contígua (filtros, árvore, arquivo de matrículas, unidade com as de baixo) e campos com valores; ferramenta da SP; nasce da relotação depois da importação | secundária | planejado (spec) | spec do Pecúlio Geral e lote |
| 9 | 24/11 | usuário | Seletor de unidade do Topo (CBMPE / DGO / DInter/1 / 2º GB …): abrir a hierarquia nó a nó, um nível por vez (a árvore vai crescer e a lista inteira não cabe), e um botão no começo que abre a hierarquia toda de uma vez, à escolha de quem usa | secundária | planejado | 6.45 (Fable) |
| 10 | 24/11 | usuário | A caixa "Lotação" do Pecúlio (lista plana: Todas, 1ª SB, 2ª SB, 7ª SB, DGO, DInter/1) não serve mais na árvore genérica: sai, e entra a escolha pela árvore. Revisão geral de quem ainda usa a lista plana de unidades: Pecúlio e Consulta ("Lotados em"), ficha (Alterar situação e Novo militar), Acesso ao sistema (unidade do nível de acesso) | secundária | planejado | 6.45 (Fable) |
| 11 | 24/11 | usuário | "Alterar situação" na ficha: a lotação de destino (lista plana com "DA (1º GB)", "DA (2º GB)" …) tem de seguir a lógica da árvore genérica, escolhida nó a nó | secundária | planejado | 6.45 (Fable) |
| 12 | 24/11 | usuário | Escala dos oficiais: o dia vermelho só conta no serviço do tipo ordinário (Saldo); JES, PJES e Diária são extra e não contam | secundária | planejado | 6.44 |
| 13 | 24/11 | usuário | Memorial de cálculo dos oficiais: a frase da sobra lista do mais antigo para o mais moderno; a cota começa pelo mais moderno, então a lista começa por ele | secundária | planejado | 6.44 |
| 14 | 24/11 | usuário | Histórico de rastreio da ficha: mais separação entre as situações; resumo recolhido só com unidade e jornada; resumo some quando aberta; afastamentos saem da linha do tempo; a linha do tempo fica | secundária | mockup da DESIGN (aguarda aprovação) | — |
| 15 | 24/11 | usuário | DEFEITO: a aba Militares da 1ª SB mostra militares que hoje estão lotados acima (quem passou pela unidade no mês); deve mostrar só quem está lá hoje | principal | planejado | 6.48 |

## Já conhecidos antes do pool

Pendências que já estavam abertas em 24/11; entram no pool como itens normais quando o usuário pedir.

| # | Pedido | Tipo | Estado | Referência |
|---|---|---|---|---|
| K1 | A tela não mostra como tirar um expediente lançado sem pôr nada no lugar (a API já aceita) | secundária | aberto | 6.40, decisão 2 |
| K2 | Lançar o expediente dos oficiais na pré-escala | secundária | aguarda elucidação | P-37 |
| K3 | Importação com 2.590 linhas fora do esperado | principal | com a SAC | conversa da SAC |
| K4 | Ordem de escalação (RN-102/RN-103) para a automação | secundária | fase 8 | `docs/pendencias.md` |
| K5 | Deploy só com código (caminho 1 do Vercel) | principal | em planejamento (6.41) | `docs/superpowers/plans/2026-11-24-fase6-41-deploy-so-com-codigo.md` |
