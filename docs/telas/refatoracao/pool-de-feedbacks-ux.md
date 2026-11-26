# Pool de feedbacks de UI/UX

26/11/2026 · pedido do usuário. A DESIGN junta aqui o que o usuário nota na interface. Quando o pool de feedbacks chega a 5, a DESIGN desenha os 5 no Manual de Identidade Visual. Com a aprovação do usuário, cada item passa ao pool de aprovações. Quando as aprovações chegam a 10, a DESIGN envia o lote à PLANEJAMENTO.

## Como funciona

1. **Entrada:** cada feedback vira uma linha, com a data e o pedido nas palavras do usuário. Se o pedido muda o comportamento da tela de hoje, a linha diz isso.
2. **Pool de feedbacks (limite 5):** estado `aberto`. Com 5 itens, a DESIGN desenha todos no Manual, numa área própria, sobre a tela real.
3. **Aprovação:** o usuário aprova item por item. O aprovado sai do pool de feedbacks e entra no pool de aprovações; o que ele não aprovar volta ao ajuste. O pool de feedbacks libera vagas para novos itens.
4. **Pool de aprovações (limite 10):** estado `aprovado`. Com 10 itens, a DESIGN envia a branch à PLANEJAMENTO, que planeja a entrega.
5. **Dúvida:** o que depende de uma decisão de base vai ao usuário numa pergunta, e o item fica `aberto` até a resposta.

## Pool de feedbacks (2 de 5)

| # | Data | Tela | Pedido | Muda o comportamento? | Estado |
|---|---|---|---|---|---|
| 1 | 26/11 | Grade geral | A célula inteira do nome do militar é clicável (hoje só o texto do nome e a matrícula respondem). Ao passar o mouse, não sublinhar o nome: marcar a célula toda de outro jeito. | Sim: o clique vale na célula inteira. | aberto |
| 2 | 26/11 | Grade geral | Marcar quem está afastado. Nos dias de afastamento, um traço (ou marca parecida) na célula do dia. Hoje o afastamento só aparece no painel do dia, depois do clique. | Sim: a Grade passa a mostrar o afastamento. **A API da Grade precisa trazer o afastamento por dia** (hoje só o painel do dia traz). | aberto |

Observação do item 1: na tela de hoje o sublinhado vem de `hover:underline` no botão do nome (`TabelaDaGrade.tsx`); o botão ocupa só o texto, e não a célula.

## Pool de aprovações (0 de 10)

| # | Item do pool de feedbacks | Aprovado em | Onde está no Manual |
|---|---|---|---|
| (vazio) | | | |
