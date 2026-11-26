# A unidade pelo caminho de siglas nas planilhas — desenho curto

25/11/2026 · decisão do usuário: caminho A.

## Por quê

A estrutura é uma árvore genérica (0035): o nome do nó, a sigla, não identifica a unidade. "1ª SB" existe em vários grupamentos, e o remendo de hoje, "SIGLA (MÃE)", também se repete numa árvore mais funda (duas "1ª Seção (1ª SB)", uma em cada GB). Além disso, a exportação (6.54) calcula a repetição na corporação inteira, e a importação só no grupamento de quem importa, e uma não reconhece o rótulo da outra (pool, item 31).

O banco já garante que duas irmãs em vigor não têm a mesma sigla (`unidade_sigla_entre_irmas`). Então o caminho de siglas desde a raiz é único.

## Objetivo

- A coluna LOTAÇÃO (e toda coluna que aponte uma unidade numa planilha) identifica a unidade pelo caminho de siglas, escrito com " / ": `2º GB / 1ª SB`.
- Quem digita escreve o mínimo que basta; a exportação escreve o que qualquer importação reconhece.

Fora do objetivo: mudar como as telas mostram a unidade; um código novo da unidade (caminho B fica para quando houver código oficial do CBMPE).

## Caminhos considerados

- **A. O caminho de siglas (escolhido).** Legível, sem migração e sem cadastro novo. Uma planilha antiga deixa de valer se a unidade mudar de lugar ou de sigla: aceitável, porque a importação é contrato e a planilha se exporta de novo.
- **B. Um código próprio da unidade.** O mais estável, mas pede migração, cadastro e que todos saibam os códigos.
- **C. O id interno numa coluna escondida.** A volta perfeita, mas quem digita uma linha nova não tem como preencher, e o arquivo passa a ter dois jeitos de dizer a mesma coisa.

## Como funciona

- **O separador:** a barra só separa unidades quando tem espaço de pelo menos um lado ("2º GB / 1ª SB", "2º GB/ 1ª SB"). Uma barra sem espaço faz parte da sigla: "DInter/1" é uma unidade só (decisão desta sessão, porque essa sigla existe).
- **Na prática** (observação do usuário): cada GB é único, então "GB / Seção" resolve quase todos os casos; a exportação escreve isso naturalmente, porque é o menor pedaço único.
- **Ler (importação):** a célula é dividida pelo separador (sem diferenciar maiúsculas nem acentos, como hoje). Vale qualquer **pedaço final** do caminho que aponte para **uma unidade só** entre as que a importação aceita (a unidade da importação e as de baixo, em vigor). O caminho inteiro desde a raiz também vale.
  - Uma sigla sozinha vale quando é única nesse alcance (como hoje).
  - Mais de uma: a célula é ignorada com "Há mais de uma "{texto}". Escreva com a unidade de cima: {caminhos}." listando os menores caminhos únicos das candidatas.
  - Nenhuma: "Lotação "{texto}" não é desta importação." com a dica de baixar o modelo (a lista está na AJUDA).
- **Escrever (exportação, modelo e AJUDA):** cada unidade sai com o **menor pedaço final do caminho que é único na corporação inteira**. Assim o mesmo arquivo é reconhecido por qualquer importação que alcance aquela unidade.
- **"SIGLA (MÃE)" deixa de existir**, na leitura e na escrita (a importação é contrato: o formato novo substitui o velho, sem tolerância).
- **Uma função só** em `dominio` (ou `apps/api/src/arvore.ts`) para as duas pontas: `menorCaminhoUnico(unidade, todas)` e `acharPeloCaminho(texto, alcance)`, para a leitura e a escrita nunca se desencontrarem.

## Deixado a quem implementa

Onde mais uma planilha aponta uma unidade (as outras importações: guarnições, serviços e escalas, cotas, feriados, configurações) e se elas usam a mesma leitura; o plano lista as que entram.
