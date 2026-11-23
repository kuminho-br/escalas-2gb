# Escala do oficial de operações: a tela de escalar — design

23/11/2026 · pedido do usuário no mesmo dia · plano em `docs/superpowers/plans/2026-11-23-fase6-29-oficiais-tela-de-escalar.md` (entrega 6.29) · continua `2026-11-23-oficiais-escala-comum-design.md`

## Por quê

O usuário, sobre a tela da 6.27 e da 6.28: "Está feia." A letra e a proporção não seguem as outras telas de escala; os dias ficam soltos; a explicação das etapas do mês fica no meio da tela, "tudo solto, ninguém entende nada"; e o jeito de escalar está errado: hoje se clica no dia, escolhe-se o serviço e lança-se um por um.

## O jeito de escalar (decisão do usuário, 23/11/2026)

1. O escalante **escolhe qual serviço vai escalar**: JES ou Saldo (normalmente começa pelo JES, mas não é obrigatório). Não é um "modo": é o serviço.
2. **Clica no oficial** e depois **clica nos dias**, um depois do outro, como era antes.
3. Com **JES** escolhido, a tela mostra **quantos JES ainda restam na cota da unidade** no mês.
4. Depois o escalante muda para **Saldo** e distribui pela antiguidade: o oficial da vez já vem escolhido.
5. **Todos os elegíveis do mês são voluntários por natureza** na escala dos oficiais: com JES escolhido, a lista mostra todos. Sai a recusa "JES só para voluntário JES." nesta escala.
6. A explicação do ciclo do mês (abrir, escolhas, fechar, encerrar) **fica recolhida**, aberta por um botão; não aparece o tempo todo.
7. A tela segue as **diretrizes gerais** do Manual de Identidade Visual, como as outras telas de escala.
8. Os **dias vermelhos** (6.28) entram no redesenho.

## Escolhas da PLANEJAMENTO

- **Serviço:** um seletor de dois botões no alto do calendário, "Escalar: JES | Saldo", com o escolhido em `tinta`. Ao lado, com JES escolhido: "JES restam {n} de {cota}" (a cota de JES da unidade no mês, do cadastro de Cotas, menos os JES lançados nas escalas da unidade no mês); sem cota cadastrada: "Sem cota de JES cadastrada no mês." (não impede lançar); com 0 restando, o número fica em âmbar e lançar continua permitido (o escalante nunca é bloqueado), com o aviso "A cota de JES do mês acabou.".
- **Oficial escolhido:** a lista à direita é a de escolha; clicar numa linha a escolhe (contorno `tinta`). Com Saldo, abre escolhido o oficial da vez; quando ele completa a cota, a escolha passa sozinha ao próximo da vez. Com JES, nenhum vem escolhido.
- **Clicar num turno:** livre → lança o oficial escolhido no serviço escolhido; do mesmo oficial e serviço → tira o lançamento; de outro oficial → pergunta "Trocar {patente nome} por {patente nome}?" (com a escala fechada, a troca vira cobertura, como hoje). Sem oficial escolhido, o clique diz "Escolha um oficial na lista.".
- **Dias vermelhos:** o número do dia continua marcando e tirando o dia vermelho; a legenda acima do calendário diz como.
- **Etapas:** a linha de etapas vira uma faixa compacta no cabeçalho: a etapa atual em texto ("Escolhas") e o botão da próxima ação (o único principal da tela); "Como funciona o mês" abre a explicação (as quatro etapas com uma frase cada) num painel recolhível.
- **Proporção:** letra e medidas das diretrizes gerais (`docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md`): nome no turno em 15 px estreita, patente em 13 px; o dia é uma célula compacta, sem caixa própria, com os dois turnos colados; a placa do turno mostra o serviço só como a faixa de cor (sem a etiqueta "Saldo" escrita), e a dica diz o serviço.

## Não objetivos

- Mudar a conta da cota de saldo, a rodada, o fechamento ou o saldo.
- Peso nos dias vermelhos.

## Anti-objetivos

- Bloquear o escalante (cota de JES acabada, fora da vez, sem cota cadastrada: tudo aviso).
- Lançar no turno errado por um clique sem oficial escolhido.
