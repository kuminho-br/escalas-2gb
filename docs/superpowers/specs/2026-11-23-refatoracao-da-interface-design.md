# Refatoração da interface — análise e necessidades de implementação

23/11/2026 · design · **análise concluída; direção e decisões D1 a D4 aprovadas pelo usuário em 23/11/2026 (a alternativa (a) nas quatro).** Os mockups vêm a seguir, começando pelo sistema de estilo.

- Evidências (fotos das telas com as marcas): `docs/telas/analise-da-interface/evidencias.html` e https://claude.ai/artifact/83wEEdCMkqm2VBvj2RJAfZ
- Sistema de estilo (valores e medidas dos blocos N1 e N2): `docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md`, com o mockup em `docs/telas/sistema-de-estilo/mockup.html`
- Identidade e telas de hoje: `docs/superpowers/specs/2026-11-16-telas.md`

## Por quê

O usuário pediu, em 23/11/2026, a refatoração de toda a parte visual, interativa e de experiência de uso, com uma melhoria extrema do padrão de qualidade. Este documento diz o que a análise encontrou, a direção proposta e o que precisa ser implementado. Onde cada entrega entra no roadmap é da PLANEJAMENTO.

## Como a análise foi feita

- O site rodou neste computador com o banco local e a carga de exemplo: 53 militares fictícios da 1ª SB e um administrador de teste.
- Montei uma escala do zero pelas telas: o modelo de guarnição, a escala, o serviço Pronto, as guarnições por turno e a pré-escala de novembro.
- Fotografei cada tela em 1440 × 900 (monitor), 1366 × 768 (notebook) e 390 × 844 (celular), e medi tamanhos na própria página.
- Li o código de `apps/web/src` para contar o que se repete: cores, tamanhos, confirmações, textos de espera.

**Limites.** Não vi as telas com dados reais: com cinco guarnições por turno e vários serviços, as alturas medidas aqui são o piso. Não testei leitor de tela, outros navegadores além do Edge nem a animação do login. Oficiais, Cotas, Feriados e Pecúlio foram vistos vazios ou só em lista.

## O que fica

- A identidade: o vinho, a Barlow, os brasões e a foto do combate dizem de quem é o sistema.
- Os textos: curtos, sem jargão, e os vazios dizem qual botão usar.
- A vaga vazia tracejada e o contador "Faltam N".
- A cor de cada serviço vinda do cadastro.
- O salvar que só acende quando há mudança, e a conferência antes de importar a planilha.
- O cuidado com teclado e leitor de tela nas células da Grade e no menu.

## Achados

Cada achado tem um código, usado nas necessidades mais abaixo. As medidas valem para a carga de exemplo com uma guarnição de uma função.

### Telas de trabalho

| Código | Achado | Medida | Onde |
|---|---|---|---|
| T1 | A Escala do mês é uma coluna só, com dois dias por tela e metade da largura vazia | 8.730 px de altura; 291 px por dia | `routes/_app/escala-do-mes.tsx`, `escala-do-mes/DiaDaEscala.tsx` |
| T2 | Quatro caixas uma dentro da outra: dia, turno, guarnição e função | 4 níveis de borda ou fundo | `escala-do-mes/CardDaGuarnicao.tsx` |
| T3 | "Sem guarnição" lista cada nome seguido de um "Remover" | 542 botões na página, de 62 × 17 px | `escala-do-mes/DiaDaEscala.tsx` |
| T4 | A Grade geral não mostra o mês inteiro, não marca o dia de hoje e não rola até ele | 17 de 30 dias em 1440 px; totais com 240 px | `grade/TabelaDaGrade.tsx`, `routes/_app/grade.tsx` |
| T5 | O painel do dia empurra a tabela da Grade | de 17 para 9 dias à vista | `grade/PainelDoDia.tsx` |
| T6 | Área de clique e letras pequenas na Grade | célula de 48 × 28 px; letra de 11 px | `grade/CelulaDaGrade.tsx` |

### Celular

| Código | Achado | Medida | Onde |
|---|---|---|---|
| C1 | **Defeito:** Configurações passa da largura da tela, e a página inteira rola de lado | 818 px numa tela de 390; abas com 802 px | `routes/_app/configuracoes.tsx`, `ui/tabs.tsx` |
| C2 | As telas de trabalho são as do computador, mais estreitas | Grade: 3 dias; Escala do mês: meio turno por tela | as mesmas de T1 e T4 |
| C3 | A ficha do militar no celular é uma coluna longa | 2.957 px, com os mesmos 5 salvar | `routes/_app/militares/$id.tsx` |

### Fichas e formulários

| Código | Achado | Medida | Onde |
|---|---|---|---|
| F1 | A ficha do militar salva por bloco | 5 botões de salvar; 2.177 px de altura | `componentes/militares/*`, `AlteracoesPendentes.tsx` |
| F2 | Formulário dentro de formulário: criar a função e depois salvar a composição; o erro aparece longe da linha | 2 confirmações para uma linha | `guarnicoes/Composicao.tsx` |
| F3 | Controles pequenos e o salvar apagado com cara de link fraco | mais e menos de 24 px; "Remover" em texto de 13 px | `ui/button.tsx`, `guarnicoes/Composicao.tsx` |
| F4 | Campos do próprio navegador (lista, data, mês, arquivo) com aparência diferente dos outros | 4 tipos de campo sem desenho | `Selecao.tsx`, `CampoDeMes.tsx`, `ImportarPlanilha.tsx` |
| F5 | A tabela de regras estica quatro linhas na largura toda | valor a 600 px do nome; ação a 1.100 px | `routes/_app/configuracoes.tsx` |

### Resposta do sistema

| Código | Achado | Medida | Onde |
|---|---|---|---|
| R1 | Confirmações feitas pela caixa do navegador | 11 usos de `window.confirm` em 10 arquivos | item 1 da entrega 6.6 |
| R2 | A espera é a palavra "Carregando…"; nada guarda o lugar do que vai aparecer | 34 pontos | todas as rotas |
| R3 | Sucesso e erro são frases soltas, sem lugar fixo | 76 `role="alert"` e 9 `role="status"` | todas as rotas |
| R4 | A cor de erro avisa rotina: "Alterações não salvas" em vermelho | 1 componente, em todas as fichas | `AlteracoesPendentes.tsx` |
| R5 | O triângulo de cadastro incompleto aparece em todos os militares da lista | 53 de 53 | `routes/_app/militares.tsx` |
| R6 | A aba do navegador diz sempre "Escalas 2º GB" | 1 título para todas as telas | `apps/web/index.html` |

### Orientação

| Código | Achado | Medida | Onde |
|---|---|---|---|
| O1 | Nenhuma tela mostra a ordem para sair do zero e gerar a primeira escala | 17 ações, 4 telas, 5 salvar diferentes | Configurações, Escalas, Escala do mês |
| O2 | Menu com nomes miúdos e itens sem destino; o item "Turnos" abre a tela dos serviços | 11,5 px; 14 itens, 3 sem destino | `Trilho.tsx`, `lib/modulos.ts` |
| O3 | A tela inicial mostra a foto e corta os módulos num notebook; não diz nada sobre o mês | foto com 512 dos 768 px | `routes/_app/index.tsx` |
| O4 | No par lista e ficha, dois vazios lado a lado | o vazio da ficha ocupa 2/3 da tela | `ListaDetalhe.tsx` |

### Sistema de estilo

| Código | Achado | Medida | Onde |
|---|---|---|---|
| S1 | Cores escritas à mão, fora da paleta | 13 cores em 9 arquivos; 3 cinzas e 4 rosados quase iguais | `apps/web/src` |
| S2 | Tamanhos de letra fora da escala; o título da tela repetido à mão | 9 tamanhos; `text-[28px]` em 13 lugares | `apps/web/src` |
| S3 | Cantos e sombras sem regra | 5 arredondamentos, 8 sombras | `apps/web/src` |
| S4 | Dois contornos de foco, às vezes juntos | o do projeto e o da biblioteca | `estilo.css`, `ui/button.tsx`, `ui/tabs.tsx` |
| S5 | O vinho faz oito papéis, e o vermelho de erro é quase a mesma cor | marca, ação, botão secundário, link, item escolhido, "faltam", fim de semana, setas | `estilo.css` e telas |
| S6 | Filtros e ações mudam de lugar de tela para tela | 3 arranjos | Grade, Cotas, Escalas |

A causa comum de S1 a S6: três camadas convivem sem dono. Os padrões da biblioteca de componentes, os tokens do projeto e os valores escritos em cada tela.

## Direção proposta

**Manter a identidade e refazer o sistema por baixo dela.** O que a análise mediu é problema de estrutura, não de marca. A referência é o quadro de serviço do quartel: nomes em placas, vagas como encaixes, e o que falta visível de longe.

A primeira versão desta proposta era a reforma comum de qualquer sistema de gestão: menu, cartões, gaveta lateral e avisos. Troquei o centro dela pelo que é próprio daqui, a placa e o encaixe, e pelo princípio de que o que está certo fica quieto.

### Princípios

1. **O conteúdo é o quadro.** Nomes e vagas vêm antes das molduras: no máximo uma caixa por nível, e o resto se separa por espaço e linha.
2. **Cada coisa num lugar só.** Título, filtros, ação principal e resposta do sistema ficam no mesmo ponto em todas as telas.
3. **Cor com um sentido só.** Vinho é ação, âmbar é o que falta, vermelho é erro. A cor do serviço fica na etiqueta.
4. **O certo fica quieto.** O que está completo não chama atenção; o que falta aparece de longe.
5. **Toda ação responde.** Salvar, remover, gerar e importar respondem no mesmo lugar, com "Desfazer" quando for possível.
6. **O celular é outro desenho.** Primeiro para quem só consulta; as telas pesadas ganham uma versão de um dia por vez.
7. **O escalante nunca é bloqueado.** O aviso orienta e não impede de fechar a escala (princípio que já vale).

### Tokens

| Papel | Proposta | Hoje |
|---|---|---|
| Vinho `#8E1B1B` | Marca (menu, brasão) e ação principal | Também link, botão secundário, item escolhido, fim de semana e setas |
| Tinta `#1C2430` | Texto e ações secundárias | Só texto |
| Âmbar `#8A5A00` sobre `#FCF1D6` | O que falta: vaga obrigatória vazia, pendência, alteração não salva | Só pendência de cadastro |
| Vermelho `#B3261E` | Só erro e choque, sempre com ícone | Também avisos de rotina |
| Neutros | Fundo `#EDEFF2`, superfície branca, linha `#D8DDE4`, apagado `#5B6675` e um cinza de painel | 3 cinzas de painel e 4 rosados |
| Cor do serviço | Do cadastro; só na etiqueta e na borda da placa | Também no "completa" (verde igual ao do Pronto) |
| Letra | Barlow no texto; Barlow Semi Condensed em nomes, números e títulos; algarismos alinhados | As mesmas famílias |
| Tamanhos | 13, 15, 17, 20, 28 e 40 px | 17 tamanhos, de 10 a 48 px |
| Forma | 2 raios (6 px em controles e placas, 12 px em superfícies), 2 sombras, 1 contorno de foco | 5 raios, 8 sombras, 2 contornos |
| Controles | 36 px de altura no computador e 44 px no toque | de 24 a 46 px |

Os valores exatos de cada token e as medidas de cada componente estão em `2026-11-23-sistema-de-estilo-design.md`.

### A placa e o encaixe

O elemento que dá cara ao sistema. A **placa** é o militar: posto pequeno, nome de guerra em letra estreita e forte, e a cor do serviço na borda esquerda. O **encaixe** é a vaga: tracejado âmbar quando é obrigatória, cinza quando é opcional. O mesmo desenho vale na Grade, na Escala do mês, no Efetivo por dia e na lista de escolha.

### A moldura da tela

```
+------+---------------------------------------------------+
|      | Título da tela          mês       [ação principal] |
| menu +---------------------------------------------------+
|      | filtros (parados ao rolar)                         |
|      +-------------------------------+-------------------+
|      | área de trabalho:             | painel de detalhe  |
|      | a tabela usa a largura toda   | por cima, sem      |
|      |                               | empurrar a tabela  |
+------+-------------------------------+-------------------+
```

Telas de leitura (cadastros e configurações) têm largura limitada; telas de trabalho usam a largura toda. No celular, o painel de detalhe sobe de baixo.

## Diretrizes do usuário

De 23/11/2026. Valem acima de qualquer mockup.

- **Mockup é guia, não gabarito.** As peças da DESIGN dão a direção de desenho e a identidade. Não se copiam inteiras sem avaliação: a DESENVOLVIMENTO adequa ao software que existe, com a skill de design front-end, e registra a diferença no resumo do PR.
- **Posto sem "BM".** "BM" não é posto: só diz que a corporação é o Bombeiro Militar, e o sistema é só de bombeiros. Em toda tela e peça o posto aparece como SD, CB, 3º SGT, 2º TEN, sem "BM". As siglas do cadastro são acertadas na entrega 6.15.
- **Escala do mês com todos os dias na mesma tela.** O escalante preenche o mês inteiro numa tela única, com os dias um depois do outro. "Um dia por vez" só vale para o celular (N6.2).
- **O menu lateral tem ícones.** Eles ajudam a lembrar de cada tela. Os ícones de hoje são redesenhados, num traço só. Ficam antes do nome, na mesma linha; na barra de baixo do celular, acima do nome (escolha da PLANEJAMENTO).

## Decisões do usuário

Aprovadas em 23/11/2026: vale a alternativa **(a)** nas quatro, com as exceções da coluna "Recomendação". N1 e N2 entram antes da fase 7, e a entrega 6.6 é absorvida aqui.

| # | Decisão | Alternativas | Recomendação |
|---|---|---|---|
| D1 | Identidade | (a) manter vinho, Barlow, brasões e fotos e refazer o sistema por baixo; (b) identidade nova | (a): o que foi medido é estrutura, e a marca já é reconhecida |
| D2 | Ritmo | (a) a fundação primeiro e depois uma tela por entrega; (b) tudo de uma vez | (a): cada entrega é validada sozinha e o piloto não espera |
| D3 | Salvar das fichas | (a) um salvar por ficha, numa barra fixa que conta as alterações; (b) um salvar por bloco, redesenhado | (a), com exceção: o bloco que vale "a partir de" um mês mantém a ação própria |
| D4 | Tela inicial | (a) início de trabalho: o que falta no mês e os módulos, com a foto numa faixa baixa; (b) só a foto e os cartões, com o enquadramento corrigido | (a) para quem tem nível de acesso |

Há também um nome a acertar, sem pressa: o item "Turnos" do menu abre a tela em que se cria "Novo serviço".

## Necessidades de implementação

"Mockup" diz se a DESIGN precisa desenhar e o usuário aprovar antes de a DESENVOLVIMENTO começar.

### N0 — Correções que podem entrar já

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N0.1 | Configurações no celular: as abas rolam dentro da própria faixa e a tabela dentro do próprio quadro. Nenhuma tela rola de lado em 390 px | C1 | não |
| N0.2 | Um contorno de foco só, em todos os controles | S4 | não |
| N0.3 | O nome da tela na aba do navegador | R6 | não |
| N0.4 | Grade geral: o dia de hoje marcado e, no mês corrente, a tabela aberta já nele | T4 | não |
| N0.5 | "Alterações não salvas" na cor de pendência | R4 | não |

### N1 — Fundação: o sistema de estilo no código

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N1.1 | Tokens com papel: cores, os 6 tamanhos, 2 raios, 2 sombras, alturas e espaçamento. Saem as cores e os tamanhos escritos à mão | S1, S2, S3, S5 | sim (um só, o do sistema de estilo) |
| N1.2 | Um componente de cada: botão (principal, secundário, discreto, perigoso), campo com rótulo, ajuda e erro, lista de opções, data e mês, envio de arquivo, abas, tabela, etiqueta e diálogo | F3, F4, S4 | o mesmo |
| N1.3 | A placa do militar e o encaixe da vaga, usados em todas as telas | T2, T3, T6 | o mesmo |
| N1.4 | A moldura da tela (título, contexto, ação principal, faixa de filtros) como componente; some o título repetido | S2, S6 | o mesmo |
| N1.5 | Guarda: o teste de estilo recusa cor e tamanho fora dos tokens | S1, S2 | não |

### N2 — Resposta do sistema

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N2.1 | Confirmação em diálogo do sistema, com o verbo no botão. Absorve o item 1 da entrega 6.6 | R1 | junto com N1 |
| N2.2 | Aviso de resultado em lugar fixo, com "Desfazer" quando der: salvar, remover, gerar pré-escala e importar | R3 | junto com N1 |
| N2.3 | Espera que guarda o lugar do conteúdo nas telas de trabalho e nas listas | R2 | junto com N1 |
| N2.4 | O erro junto do campo ou da linha que o causou | F2, R3 | junto com N1 |
| N2.5 | Um vazio só por tela, com o próximo passo | O4 | junto com N1 |

### N3 — Moldura e navegação

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N3.1 | Menu com nomes de 13 px no mínimo, sem os itens que não levam a lugar nenhum | O2 | sim |
| N3.2 | Topo e seletor de unidade. Absorve os itens 2, 3 e 8 da entrega 6.6 | O2 | sim |
| N3.3 | Tela inicial conforme a D4. Absorve o item 4 da entrega 6.6 | O3 | sim |
| N3.4 | Roteiro de preparação: a ordem modelo, escala, serviços, guarnições e pré-escala, com o que já foi feito, na Escala do mês vazia e na tela inicial | O1 | sim |

### N4 — Telas de trabalho, uma entrega por tela

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N4.1 | Grade geral: o mês inteiro à vista em 1440 px, totais compactos e o painel do dia por cima da tabela | T4, T5, T6 | sim |
| N4.2 | Escala do mês: dias compactos, a largura toda usada, uma caixa por nível, "Sem guarnição" em placas com a ação recolhida, e o que falta fixo no alto | T1, T2, T3 | sim |
| N4.3 | Escolher militar: placas, o motivo de quem ficou de fora e uso pelo teclado | T3 | junto com N4.2 |
| N4.4 | Efetivo por dia e Voluntariado na moldura nova, com as placas | S6 | sim, depois das duas primeiras |
| N4.5 | Escala dos oficiais, Cotas e Feriados na moldura nova | S6 | não, se N1 bastar |

### N5 — Fichas e cadastros

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N5.1 | Ficha conforme a D3 | F1, C3 | sim |
| N5.2 | Cadastro incompleto: o campo marcado com a orientação e um filtro de pendências na lista. Absorve os itens 5, 6 e 7 da entrega 6.6 | R5 | o mesmo |
| N5.3 | Sem formulário dentro de formulário: a função nova se cria num passo próprio. A lista do sistema abre para cima quando falta espaço (item 9 da 6.6) | F2, F3 | o mesmo |
| N5.4 | Regras das Configurações em lista de leitura, com largura limitada | F5 | o mesmo |

### N6 — Celular

| Código | O que fazer | Resolve | Mockup |
|---|---|---|---|
| N6.1 | Alvos de toque de 44 px e nenhuma tela rolando de lado | C1, F3 | junto com N1 |
| N6.2 | Grade e Escala do mês no celular: um dia por vez | C2 | sim |
| N6.3 | As telas da fase 7 (Visualização e Minha escala) nascem no sistema novo, desenhadas primeiro para o celular | C2 | sim, com a fase 7 |

## Ordem sugerida

1. **N0 já**, numa entrega pequena: não depende de decisão nem de desenho.
2. **N1 e N2 antes de qualquer tela nova.** A fase 7 traz telas novas para todos os militares; se nascerem no sistema antigo, serão refeitas.
3. **N4.1 e N4.2 antes do piloto** (fase 8): são as telas em que os escalantes vão passar o mês.
4. **N3 e N5** entre as duas, na ordem que couber.
5. **N6.3 junto com a fase 7.**

A entrega 6.6 espera mockups da DESIGN e trata de nove pontos que esta refatoração cobre. Proponho que ela seja absorvida aqui, cada item no bloco indicado acima, em vez de ganhar um desenho no sistema antigo.

## Como saber que ficou pronto

| Medida | Hoje | Meta |
|---|---|---|
| Dias do mês à vista na Grade, em 1440 px | 17 | o mês inteiro |
| Dias por tela na Escala do mês, com uma guarnição por turno | 2 | 5 ou mais |
| Telas que rolam de lado em 390 px | 1 (Configurações) | nenhuma |
| Confirmações pela caixa do navegador | 11 | nenhuma |
| Cores e tamanhos fora dos tokens | 13 e 9 | nenhum, com teste |
| Salvar por ficha | 5 | 1, mais as ações com data |
| Menor alvo de clique | 17 px | 32 px no computador, 44 px no toque |
| Telas que mostram a ordem de preparação | nenhuma | Escala do mês vazia e tela inicial |

## O que cabe a cada sessão

- **DESIGN:** os mockups, na ordem das entregas, começando pelo sistema de estilo (tokens, componentes, placa e moldura numa página só).
- **Usuário:** as decisões D1 a D4 e a aprovação de cada mockup.
- **PLANEJAMENTO:** onde cada bloco entra no roadmap e o plano de cada entrega.
- **DESENVOLVIMENTO:** a implementação, tela por tela, sem mudar regra de negócio.
- **VALIDAÇÃO:** o teste de cada entrega pelo usuário.
- **DOCUMENTAÇÃO:** a atualização de `2026-11-16-telas.md` quando a identidade e as telas mudarem.

## Fora deste documento

- Regras de negócio e o conteúdo das telas da fase 7.
- A animação do login, que tem documento próprio.
- O desenho final de qualquer tela: vem nos mockups.

## Pendências

- Medir a Escala do mês e a Grade com dados reais do banco de teste: as alturas daqui são o piso.
- Conferir com leitor de tela e em outro navegador depois da fundação.
- `2026-11-16-telas.md` descreve a vaga vazia com listras amarelas, e o site usa o tracejado: acertar quando a fundação for aprovada.
