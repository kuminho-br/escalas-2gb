# Grade geral redesenhada e menu lateral novo (6.70, entrega B) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

> Reescrito em 26/11/2026 com o mockup aprovado. Substitui a versão "Afastados na Grade geral".

**Goal:** a Grade geral e o menu lateral do mockup aprovado em 26/11/2026: o afastado à vista na tabela, a borda escura entre o que rola e o que fica preso (em toda tabela com rolagem), a célula do nome clicável, a legenda acima, o painel do dia com o afastamento, a tela cheia, o celular com a folha que sobe, e o menu largo que recolhe e se esconde.

**Architecture:** a API da Grade passa a mandar, por linha, os períodos de afastamento com o tipo; tudo o mais (a marca, a contagem "afastados hoje", o filtro, a dica) sai deles no site, sem consulta nova. O padrão "Tabela com rolagem" vira uma peça única (constantes e um gancho de sombra) usada por toda tabela com partes presas. O menu ganha três estados (largo, recolhido, escondido), guardados por pessoa. Sem migração.

**Tech Stack:** Hono, `contratos`, React, TanStack Router e Query, Tailwind, Vitest.

**Spec:** o mockup aprovado `docs/telas/refatoracao/grade-geral/` (index.html: a tabela "O que muda" e "O que você decidiu"; grade.css: medidas, cores e estados; grade.js: comportamento) e a linha de 26/11 em `docs/decisoes.md`. **O mockup é guia, não gabarito:** ative a skill `frontend-design:frontend-design` e adeque ao site, com os tokens e componentes da 6.20.

## Global Constraints

- Branch `fase6-70-grade-e-menu`, a partir da `main` **com a entrega A (6.61 e 6.67) já mesclada**: o cabeçalho da 6.61 fica, sem a marca, que dentro do módulo passa ao topo do menu. **Sem migração.** Nada roda em banco remoto. Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; fotos em 1440, 1100 e 390 px (Grade normal, tela cheia, painel aberto, menu nos três estados). Enviar a branch uma vez só, no fim.
- **Nenhuma cor de serviço muda**, nem a do expediente: a cor é cadastro do usuário em Configurações.
- **Afastado:** tracejado âmbar no meio da célula, cor `#A06C0A`, 3 px, traço de 62% e intervalo de 38% num período de um quarto da largura do dia, para emendar sem quebra de uma célula para a outra; contínuo entre dias seguidos; o tipo escrito no primeiro dia do período ("Férias"), na cor `pendencia`. Quem está afastado em **todos** os dias do mês mostrado tem o nome em tom apagado. A mesma marca na legenda e na faixa da equipe. Fica atrás dos quadrados de serviço; não esconde letra nem o contorno do choque. A cor entra como token (`afastado`), não como valor solto.
- **Borda da área que rola:** 3 px na cor `tinta` (hoje 2 px em `encaixe`), à direita da coluna Militar, embaixo do cabeçalho dos dias e à esquerda de PJES; ao rolar, uma sombra leve nasce do lado das partes presas. **Vale para toda tabela com rolagem do sistema** (muda o padrão da 6.46).
- **Textos fixos:** dica "Férias: 10 a 19/12" (o período inteiro, também quando atravessa o mês: "Licença: 28/11 a 6/12"); faixa da equipe "1 afastado hoje" / "N afastados hoje" (só quando há); filtro "Esconder quem está afastado o mês todo"; painel "Afastado: Férias, de 10 a 19/12/2026"; aviso ao adicionar serviço a afastado "Ele está de férias neste dia. Dá para escalar mesmo assim: nada é bloqueado." (o tipo em minúsculas no lugar de "férias"); dica de rolagem, só no computador: "Para rolar para os lados, segure Shift e gire a roda do mouse."; menu: "Recolher", "Abrir", "Esconder", "Menu"; tela cheia: "Expandir grade", "Recolher grade"; recusa da troca: "Não dá para trocar: {NOME} já tem {serviço} das {hh}h às {hh}h neste dia." e "Não dá para permutar: {NOME} ficaria com o {serviço} ({hh}h às {hh}h) e já está no {serviço} deste dia.".
- **Menu:** largo de 240 px, com o brasão e o nome da unidade no alto, rótulos ao lado e o item ativo em destaque (fundo branco, texto vinho). Itens: Grade geral, Escala do mês, Efetivo por dia, Oficiais | Voluntariado, Cotas | Militares, Turnos, Escalas, Feriados | Configurações da escala. **Sem** Estrutura, Histórico e Ajuda. Logo abaixo da unidade, **no alto**: "Recolher" (volta ao trilho de 84 px de hoje, onde o botão vira "Abrir") e "Esconder" (tira o menu da tela). Escondido: botão flutuante "Menu" (vinho, ícone e nome) **no alto, à esquerda**, antes da unidade, que traz o menu de volta como estava.
- **O menu lembra a escolha de cada pessoa** (largo, recolhido, escondido) ao trocar de tela e no próximo acesso: guardado no navegador, por usuário (chave com o id do usuário), com `try/catch` (sem o guardado, abre largo). *Decisão da PLANEJAMENTO:* no navegador e não no banco, porque é preferência de tela e não precisa de migração.
- Nenhum dado pessoal real em repositório, teste, CI ou foto (os nomes do mockup são inventados).

## Review Focus

1. **Afastamento que atravessa o mês e militar com duas linhas no mês:** a marca cobre só os dias da linha e do mês; a dica diz o período inteiro (Task 1 e 3).
2. **Afastado com serviço no dia e com choque:** o quadrado e a letra continuam visíveis e o contorno do choque continua (Task 3).
3. **Outras tabelas com rolagem:** a borda nova e a sombra aparecem nelas sem quebrar o que já existe (Task 2).
4. **Menu guardado:** trocar de tela e recarregar mantém o estado; sem armazenamento (navegação privada) abre largo e não quebra; pessoa diferente no mesmo navegador não herda a escolha (Task 6).
5. **Celular:** a folha do painel não cobre a linha escolhida nem o cabeçalho dos dias, e "Adicionar serviço neste dia" fica alcançável sem rolar (Task 8).

---

### Task 1: a API manda os períodos de afastamento; a recusa da troca diz quem

**Files:** Modify `pacotes/contratos/src/grade.ts`, `apps/api/src/grade/grade.ts`, a rota que o `TrocarServico` chama (e o contrato da recusa dela); Test o teste da Grade na API (ou `apps/api/test/grade-afastados.test.ts`) e o da troca.

**Interfaces (Produces):**
- `AfastamentoNaGrade = { tipo: string; inicio: string; fim: string; inicioReal: string; fimReal: string }`: `inicio`/`fim` recortados ao mês e aos dias que a linha vale (para a marca); `inicioReal`/`fimReal` o período inteiro (para a dica e o painel). `LinhaDaGrade.afastamentos: AfastamentoNaGrade[]` (sempre presente).
- Em `grade.ts`: a leitura dos afastamentos traz `tipo_afastamento.nome`, em ordem de início; `periodosDeAfastamento(dias, tipoDoDia)` (pura, exportada) junta dias seguidos do mesmo tipo; respeita `dentro(d)` da linha. O expediente continua tirado nos dias de afastamento.
- **Recusa da troca e da permuta:** a resposta de recusa traz `{ erro: string; militarId: string }`, com o texto fixo que nomeia o militar e o motivo; o diálogo marca a linha desse militar (Task 5).

- [ ] **Step 1: testes.** `periodosDeAfastamento` (seguidos, separados, tipos diferentes, vazio). Grade: afastamento de 28/10 a 03/11 dá `inicio` 01/11 e `inicioReal` 28/10; militar com duas linhas no mês: cada linha só com os seus dias (Review Focus 1); dois afastamentos no mesmo dia: um período, o que começou antes; renomear o tipo muda o texto. Troca: recusa por conflito do outro militar devolve o `militarId` dele e o texto com o nome, o serviço e o horário; a permuta, o texto da permuta.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS e `pnpm --filter api typecheck`. **Step 5:** commit `Fase 6.70: a Grade traz os afastamentos e a recusa da troca diz quem`.

### Task 2: a borda da rolagem em toda tabela

**Files:** Create `apps/web/src/lib/tabela-com-rolagem.ts` (as classes da fronteira e o gancho `useSombraDaRolagem(ref)` que liga `data-rolou-x`/`data-rolou-y` no contêiner); Modify `apps/web/src/componentes/grade/TabelaDaGrade.tsx` e toda tabela com partes presas (procurar `sticky` em `apps/web/src/componentes`: `escalas/Matriz.tsx`, `escala-do-mes/DiaDaEscala.tsx`, `voluntariado/CalendarioDoVoluntariado.tsx`, `ListaDetalhe.tsx`, e conferir as outras); tokens no CSS do tema; Test `apps/web/src/__testes__/tabela-com-rolagem.test.tsx`.

- [ ] **Step 1: testes.** As fronteiras usam 3 px em `tinta` (não sobra `border-r-2 border-r-encaixe` nem `border-b-2 border-b-encaixe` em `apps/web/src`); ao rolar para os lados, o contêiner ganha `data-rolou-x` e a sombra aparece do lado da coluna presa; sem rolagem, nada; nas outras tabelas presas, a fronteira é a mesma peça (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. A sombra é só CSS sobre o atributo (sem animação contínua; respeitar `prefers-reduced-motion`). **Step 4:** PASS e fotos das tabelas mexidas. **Step 5:** commit `Fase 6.70: a borda da rolagem em toda tabela`.

### Task 3: o afastado, o fim de semana e a legenda na tabela

**Files:** Modify `CelulaDaGrade.tsx`, `TabelaDaGrade.tsx`, `LegendaDaGrade.tsx` (sobe para cima da tabela); Create `apps/web/src/lib/afastamento-na-grade.ts`; Test `apps/web/src/__testes__/grade-afastados.test.tsx` e os da Grade.

**Interfaces:** `afastamentoDoDia(afastamentos, data): { tipo; comeca: boolean; termina: boolean; inicioReal; fimReal } | null`; `afastadoNoMesTodo(afastamentos, dias): boolean`; `dicaDoAfastamento(a): string` ("Férias: 10 a 19/12"; atravessando o mês, as duas datas com o mês). `nomeDaCelula(..., afastado?)` termina em ", afastado: Férias".

- [ ] **Step 1: testes.** Célula do dia afastado tem o tracejado (`data-afastado`, `aria-hidden` no traço), a dica com o período inteiro e o nome acessível com o afastamento; o primeiro dia do período escreve o tipo; com serviço, a letra continua no DOM e o traço vem antes (atrás); com choque, o contorno continua (Review Focus 2). Militar afastado o mês todo tem o nome com a classe do tom apagado; afastado só em parte, não. Coluna de sábado, domingo e feriado com o fundo mais escuro (`data-fim-de-semana` e `data-feriado` nas células do corpo, não só no cabeçalho), o feriado com o ponto vinho no cabeçalho. Legenda acima da tabela, com os quadradinhos na cor ajustada (`estiloDaCor`, a mesma das células) e a letra, o traço do afastado e o contorno do choque; a dica do Shift só no computador.
- [ ] **Step 2:** FAIL. **Step 3:** implementar pelo `grade.css` do mockup. **Step 4:** PASS e fotos. **Step 5:** commit `Fase 6.70: o afastado, o fim de semana e a legenda`.

### Task 4: a célula do nome, a faixa da equipe, o filtro e as equipes

**Files:** Modify `TabelaDaGrade.tsx`, `apps/web/src/routes/_app/grade.tsx` (filtros), `apps/web/src/lib/busca-da-grade.ts` se for o caso; Test os da Grade.

- [ ] **Step 1: testes.** A célula do nome inteira é **um** botão que abre a ficha (sem `hover:underline`); ao passar o mouse, fundo vinho a 8% e o ícone da ficha no canto de cima, à direita; foco com contorno por dentro; quem só consulta a unidade não tem botão. A faixa da equipe mostra "1 afastado hoje"/"N afastados hoje" só quando há (conta pelos períodos e pelo dia de hoje; fora do mês corrente, não aparece). O filtro "Esconder quem está afastado o mês todo" tira só quem está afastado em todos os dias do mês mostrado, e a contagem da faixa acompanha. Equipes: até 6, botões lado a lado; com 7 ou mais, um botão "Equipes" com lista de marcação (prepara a 6.64; hoje os nomes vêm dos grupos do mês).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.70: o nome, a faixa da equipe e o filtro dos afastados`.

### Task 5: o painel do dia e a troca

**Files:** Modify `PainelDoDia.tsx`, `AdicionarServico.tsx`, `TrocarServico.tsx`, `apps/api/src/grade/dia.ts` (o período do afastamento do dia); Test os do painel e da troca.

- [ ] **Step 1: testes.** O painel mostra o afastamento numa faixa âmbar com o período ("Afastado: Férias, de 10 a 19/12/2026"); ao abrir "Adicionar serviço neste dia" para quem está afastado, o aviso fixo aparece e o botão "Escalar" continua habilitado (nada bloqueia); sem afastamento, nada disso. Na troca recusada, o texto vem da API e a linha do militar que impede (`militarId`) ganha o contorno e o motivo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (o painel lê o período pelo `dia.ts`, que hoje só devolve o nome do tipo). **Step 4:** PASS. **Step 5:** commit `Fase 6.70: o painel do dia mostra o afastamento e a troca diz quem`.

### Task 6: o menu largo, recolhido e escondido

**Files:** Modify `apps/web/src/routes/_app.tsx`, `apps/web/src/componentes/Trilho.tsx` (ou o componente do menu de hoje), `apps/web/src/componentes/Moldura.tsx` se for ele que monta a casa; Create `apps/web/src/lib/estado-do-menu.ts`; Test `apps/web/src/__testes__/menu.test.tsx`.

**Interfaces:** `type EstadoDoMenu = 'largo' | 'recolhido' | 'escondido'`; `lerEstadoDoMenu(usuarioId): EstadoDoMenu` e `guardarEstadoDoMenu(usuarioId, e)`, com `try/catch` (sem armazenamento: `'largo'`).

- [ ] **Step 1: testes.** Os itens são os da lista fixa, na ordem e nos grupos dela; não há Estrutura, Histórico nem Ajuda. Largo: brasão e unidade no alto, rótulos ao lado, ativo com fundo branco e texto vinho; "Recolher" e "Esconder" logo abaixo da unidade. Recolher: trilho de 84 px e o botão vira "Abrir". Esconder: o menu sai e o botão flutuante "Menu" aparece no alto, à esquerda; clicar nele devolve o estado anterior (largo ou recolhido). O estado sobrevive à troca de tela e à recarga; outro usuário no mesmo navegador começa do seu próprio; com o armazenamento lançando erro, abre largo (Review Focus 4). Abrir o painel do dia em tela mais estreita que 1440 px recolhe o menu e fechar devolve; escondido continua escondido. No celular, o menu abre de lado com a mesma lista. Navegação pelo teclado: os botões têm nome e foco visível; o flutuante não cobre o cabeçalho.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. A marca do cabeçalho da 6.61 sai de dentro do módulo e fica só no topo do menu. **Step 4:** PASS e fotos dos três estados. **Step 5:** commit `Fase 6.70: o menu largo, recolhido e escondido`.

### Task 7: a tela cheia da Grade

**Files:** Modify `apps/web/src/routes/_app/grade.tsx`, `TabelaDaGrade.tsx`; Test os da Grade.

- [ ] **Step 1: testes.** "Expandir grade", ao lado do título, tira o menu, o cabeçalho, o título e os filtros e deixa uma barra fina com o mês, as equipes que valem e "Recolher grade"; no computador ficam também a legenda e o painel do dia. "Recolher grade" volta ao normal, com o menu no estado guardado. A tecla Esc também recolhe. Na tela cheia, célula abre o dia e nome abre a ficha, como fora dela.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS e fotos. **Step 5:** commit `Fase 6.70: a tela cheia da Grade`.

### Task 8: o celular

**Files:** Modify `PainelDoDia.tsx` (folha), `TabelaDaGrade.tsx`, `grade.tsx`; Test os da Grade em 390 px.

- [ ] **Step 1: testes.** Em tela de celular (abaixo de 768 px, o corte do site): o painel do dia é uma folha que sobe de baixo, até 64% da altura; acima ficam o cabeçalho dos dias e a linha escolhida, rolada para a vista; "Adicionar serviço neste dia" fica fixo no pé da folha (Review Focus 5); os alvos de toque têm 44 px; PJES e Diárias não ficam presas e rolam com a tabela. Na tela cheia do celular, a coluna do militar estreita (112 px, o posto em cima do nome, sem a matrícula) e cabem 6 dias.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS e fotos em 390 px (folha aberta com um afastado e com um choque). **Step 5:** commit `Fase 6.70: o celular`.

### Task 9: fechamento

- [ ] **Step 1:** `pnpm test && pnpm typecheck && pnpm build:vercel`. **Step 2:** conferir as fotos contra o mockup (1440, 1100 e 390 px): o tracejado emenda entre os dias, a borda e a sombra, os três estados do menu, a tela cheia, a folha. **Step 3:** commit `Fase 6.70: fechamento` e enviar a branch e o resumo à PLANEJAMENTO, com o que ficou diferente do mockup e por quê.

## Fora desta entrega

- O afastado na pré-escala e na lista de candidatos (só na Grade e no painel do dia).
- As equipes do cadastro (6.64): a Task 4 só prepara os botões para mais de 6.
- Guardar o estado do menu no banco (fica no navegador).
