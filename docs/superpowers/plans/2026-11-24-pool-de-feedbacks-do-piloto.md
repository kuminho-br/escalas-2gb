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
| — | — | — | (vazio: o usuário começa a passar feedbacks ao preparar dezembro) | — | — | — |

## Já conhecidos antes do pool

Pendências que já estavam abertas em 24/11; entram no pool como itens normais quando o usuário pedir.

| # | Pedido | Tipo | Estado | Referência |
|---|---|---|---|---|
| K1 | A tela não mostra como tirar um expediente lançado sem pôr nada no lugar (a API já aceita) | secundária | aberto | 6.40, decisão 2 |
| K2 | Lançar o expediente dos oficiais na pré-escala | secundária | aguarda elucidação | P-37 |
| K3 | Importação com 2.590 linhas fora do esperado | principal | com a SAC | conversa da SAC |
| K4 | Ordem de escalação (RN-102/RN-103) para a automação | secundária | fase 8 | `docs/pendencias.md` |
| K5 | Deploy só com código (caminho 1 do Vercel) | principal | em planejamento (6.41) | `docs/superpowers/plans/2026-11-24-fase6-41-deploy-so-com-codigo.md` |
