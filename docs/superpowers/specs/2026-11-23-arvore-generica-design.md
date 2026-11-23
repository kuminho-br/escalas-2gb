# Árvore genérica e configurações gerais — design

23/11/2026 · decisões do usuário no mesmo dia · plano em `docs/superpowers/plans/2026-11-23-fase6-25-arvore-generica.md` (entregas 6.25 e 6.26)

## Por quê

O usuário, ao ver a tela Estrutura da 6.10: "A divisão é um nível hierárquico como qualquer outro. As unidades hierárquicas se comportam da mesma forma, é uma estrutura genérica, e toda a estrutura hierárquica pode ser editada pelo usuário."

Hoje a árvore não é genérica. Os tipos de unidade e a ordem entre eles estão fixos no banco (uma seção não fica acima de um grupamento), o código decide coisas pelo tipo em mais de 30 lugares, o militar só é lotado em seção, o nível de chefe de divisão só existe em divisão, e a tela Estrutura só cria divisões e põe seções nelas.

## Decisões do usuário (23/11/2026)

1. O militar pode ser lotado em qualquer unidade da árvore.
2. Os tipos de unidade (grupamento, divisão, seção, pelotão…) viram um cadastro: o usuário cria, renomeia e exclui. O tipo é só um nome.
3. O quinto nível de acesso (hoje "Chefe de divisão") vale em qualquer unidade, porque outras pessoas além dos chefes de divisão recebem essa permissão. O nome ainda será escolhido pelo usuário.
4. O administrador edita a árvore inteira; o gestor edita da sua unidade para baixo.
5. As configurações gerais vão para um painel próprio, aberto pela tela inicial; as de escala ficam no módulo de escalas. Cada pessoa vê o que o seu nível permite: o militar comum muda só as próprias preferências (a animação de entrada, por exemplo). Onde cada configuração fica é escolha da PLANEJAMENTO, e o usuário ajusta depois.
6. O controle de acesso personalizado (o gestor cria regras de acesso para militares específicos) fica para uma fase posterior; a CONCEPÇÃO modela.
7. Ordem: depois da 6.17 e antes da fundação da interface (6.20 e 6.21).

## Objetivos

- Uma árvore só, em que toda unidade se comporta igual, qualquer que seja o tipo.
- Criar, renomear, mover, extinguir e excluir unidades pela tela, com o alcance de cada nível de acesso.
- Lotação, níveis de acesso, camadas de visão e telas de escala sem nenhuma regra presa ao tipo.
- Um painel de configurações gerais na tela inicial, separado das configurações de escala.

## Não objetivos

- O organograma com vagas e funções (QOD).
- O controle de acesso personalizado por militar (decisão 6).
- O brasão por unidade (ideia na CONCEPÇÃO; a árvore genérica é a base dele).
- A tela "Histórico" do menu.

## Anti-objetivos

- **Perder histórico.** Uma unidade com algo ligado (militar que já foi lotado nela, escala, nível de acesso, configuração, feriado) não é apagada: é extinta, e o passado continua de pé.
- **Ciclo na árvore.** Uma unidade nunca fica abaixo de si mesma.
- **O gestor alcançar o que está fora da sua árvore** por mover uma unidade para dentro ou para fora dela.
- **Ver virar editar**, como nas camadas de visão.

## Regras da árvore

- **A unidade** tem sigla, nome, tipo, unidade de cima, início e fim. A raiz (CBMPE) não muda de lugar, não é extinta e não é excluída.
- **Qualquer tipo fica abaixo de qualquer tipo.** Sai a regra do banco que obrigava o tipo de baixo a ter nível maior. A ordem dos tipos serve só para ordenar listas.
- **A sigla não se repete entre irmãs** (unidades ativas com a mesma unidade de cima), sem diferenciar maiúsculas. Entre unidades de lugares diferentes pode repetir; nas listas, a sigla repetida aparece com a unidade de cima: "1ª SB (2º GB)".
- **Criar:** uma unidade nova abaixo de outra, com sigla, nome, tipo e o mês de início.
- **Renomear:** sigla, nome e tipo.
- **Mover:** trocar a unidade de cima. Antes de salvar, a tela diz o efeito: quem passa a alcançar a unidade e quem deixa de alcançar (pelos níveis de acesso de cima), o que ela passa a herdar (parâmetros, feriados, funções) e quais unidades passam a ser irmãs dela.
- **Extinguir:** a unidade deixa de valer a partir de uma data e some das escolhas; o histórico fica. Só se extingue sem unidade ativa abaixo e sem militar lotado nela a partir da data; a tela lista o que precisa ser movido antes.
- **Excluir:** só para unidade sem nada ligado. Com algo ligado, a tela oferece "Extinguir" e diz o que está ligado.
- **Quem edita:** o administrador, tudo. O gestor (e o quinto nível, que edita como gestor) cria unidades abaixo da sua e das de baixo, renomeia a sua e as de baixo, e move, extingue e exclui só as de baixo, nunca a própria; o destino de um "mover" fica dentro da sua árvore. O auxiliar administrativo e o militar comum só veem.
- **Auditoria:** toda mudança na árvore e nos tipos registra quem fez.

## Tipos de unidade

- Cadastro com nome e ordem. Os de hoje viram as primeiras linhas: Corporação, Diretoria Geral, Diretoria Integrada, Grupamento, Divisão e Seção.
- Criar, renomear, reordenar e excluir; excluir só quando nenhuma unidade, nem extinta, usa o tipo. Quem: o administrador.
- Nenhuma regra do sistema depende do tipo.

## Lotação em qualquer unidade

- Cadastro do militar, "Alterar situação", importação do Pecúlio e o `criar-admin` aceitam qualquer unidade ativa. Saem as mensagens "Escolha uma seção." (6.23) e "A lotação é uma seção ou o grupamento." (6.18).
- As telas de escala funcionam em qualquer unidade e usam os militares lotados nela, como hoje na seção. A unidade sem escalas mostra o vazio de hoje com "Crie uma em Escalas.", no lugar de "Escolha uma seção no seletor de unidade para ver a escala.".
- As mensagens do Pecúlio ("quem tem nível de acesso no {X}") citam a unidade logo acima da lotação, sem o desvio que pulava a divisão.

## O quinto nível de acesso

- Pode ser dado em qualquer unidade, menos na raiz (que não tem irmãs).
- Edita como o gestor na sua unidade e abaixo; vê as unidades irmãs (mesma unidade de cima) e tudo abaixo delas, sem editar, pela camada própria da borda de "Quem vê o quê".
- Quem dá: o gestor de uma unidade acima e o administrador. Ele não dá o próprio nível.
- No banco e no código passa a se chamar `gestor_lateral` (nome técnico, que não aparece na tela). O nome na tela fica num lugar só (`apps/web/src/lib/papeis.ts`): "Coordenador" (aprovado pelo usuário em 23/11/2026).

## Configurações gerais

**Onde fica cada uma** (escolha da PLANEJAMENTO; o usuário ajusta depois):

| Configuração | Lugar | Quem vê | Quem altera |
|---|---|---|---|
| Minhas preferências (a animação de entrada; sai da Minha ficha) | Geral | todos | cada um, a sua |
| Estrutura (a árvore) | Geral | quem tem nível de acesso | gestor (da sua unidade para baixo) e administrador |
| Tipos de unidade | Geral | administrador | administrador |
| Postos e graduações, Funções do militar, Situações do militar, Tipos de afastamento | Geral | quem tem nível de acesso | administrador |
| Quem vê o quê | Geral | administrador | administrador |
| Regras do processo, Voluntariado, Modelos de guarnição, Meta de ativação | Escala (no módulo, "Configurações da escala") | como hoje | como hoje |

- A tela inicial ganha o cartão "Configurações", para todos, que abre o painel geral. Cada seção do painel só aparece para quem a vê; o militar comum vê só "Minhas preferências".
- No módulo de escalas, o item "Configurações" do trilho passa a ser "Configurações da escala".
- Os endereços antigos das abas levam ao lugar novo.

## Abordagens consideradas

- (A) Manter os tipos fixos e só trocar a tela Estrutura por uma árvore: rápido, mas a divisão continuaria diferente do resto, que é o que o usuário recusou.
- **(B) Tipos como cadastro de nome, e nenhum comportamento preso ao tipo. Escolhida** (decisão 2).
- (C) Tirar os tipos: a árvore perderia a leitura ("Divisão Operacional"), e o usuário preferiu (B).

## Testes

- **Árvore:** criar, renomear, mover, extinguir e excluir, com e sem permissão; ciclo recusado; sigla repetida entre irmãs recusada e aceita em lugares diferentes; a raiz não se move.
- **Alcance:** depois de mover, quem tem nível acima ganha ou perde a unidade na hora (vale o teste da 6.10).
- **Nada preso ao tipo:** um teste de busca no código falha se alguma regra comparar o tipo da unidade com um tipo fixo.
- **Lotação:** militar lotado num grupamento aparece nas listas e na escala do grupamento.
- **Quinto nível:** numa seção, vê as seções irmãs e o que está abaixo delas; não alcança irmãs de outra unidade de cima; recusado na raiz.
- **Configurações:** cada nível vê só as seções do quadro acima.

## O que fica para quem for planejar

- O número da migração, as rotas e os nomes técnicos (o plano já fixa).
- O desenho da árvore editável (a DESENVOLVIMENTO adequa com a skill de design; a DESIGN registra no Manual).
