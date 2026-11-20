# Síntese do design e do roadmap — intervenção da DOCUMENTAÇÃO

Pedido do usuário (20/11/2026): sintetizar o documento de design e o roadmap. A DOCUMENTAÇÃO desenha a intervenção; **a PLANEJAMENTO executa**. Quem cuida dos dois documentos continua sendo a PLANEJAMENTO.

## Por quê

Os dois documentos crescem por adendos e já passaram da régua de qualidade (`docs/LEIAME.md`):

| Documento | Hoje | Régua |
|---|---|---|
| `specs/2026-11-16-migracao-design.md` | 42 KB, 10 adendos, 8 parágrafos com mais de 400 caracteres | até 25 KB, até 3 adendos |
| `plans/2026-11-16-roadmap-migracao.md` | 47 KB, 28 parágrafos com mais de 400 caracteres | até 25 KB |

Para saber como uma regra está hoje, é preciso ler os adendos em ordem: uma decisão de 17/11 pode ter sido refeita em 19/11 mais abaixo. O roadmap é a primeira leitura de quem chega; a seção da fase 4 (13 KB) e a das revisões antes da fase 4 (11 KB) são hoje registro de decisões, não roadmap.

## Objetivo

Cada documento passa a dizer **como as coisas estão hoje**, sem histórico no corpo. O histórico fica em dois lugares: um registro de decisões (uma linha por decisão) e o git.

## Não objetivos

- Não muda nenhuma decisão. É reescrita de forma, não de conteúdo.
- Não mexe nos planos de fase (`plans/2026-11-1*-fase*.md`): são temporários e se dividem por entrega (decisão do usuário, 20/11/2026).
- Não mexe nas outras specs, salvo para mudar um link que apontava para um adendo.

## O que fica decidido

### 1. Registro de decisões, primeiro

Antes de reescrever, criar `docs/decisoes.md`: uma linha por decisão tirada do design e do roadmap, **na ordem do mais novo para o mais velho**.

| Coluna | Conteúdo |
|---|---|
| Data | dd/mm/aaaa |
| Decisão | uma frase, na linguagem do escalante |
| Onde está | o documento e a seção que hoje descrevem o resultado |

Entram: D1 a D7 (e a D7 revista para o Pecúlio), cada "Decisão do usuário (data)" do roadmap, cada adendo do design, as reorganizações de 20/11 e as propostas recusadas na revisão 1 (com "recusada" na frase). Uma decisão refeita entra duas vezes, e a mais velha diz "substituída em dd/mm".

Esse arquivo é o teste da síntese: nenhuma linha dele pode ficar sem lugar no texto novo.

### 2. O design vira o retrato de hoje

Alvo: até 25 KB e nenhum adendo. Estrutura proposta (a PLANEJAMENTO pode ajustar):

1. **Decisões técnicas** D1 a D7, já com o estado atual (a D7 incorpora a revisão do Pecúlio).
2. **Atores e permissões.**
3. **Cadastros:** militares e ficha, modelo de planilha para importar, guarnição como modelo, serviços e escalas (o que hoje está nos adendos de 17 e 18/11).
4. **Montagem da escala:** pré-escala, ajustes do escalante, hierarquia de CNH.
5. **Nome do sistema, login e módulos.**
6. **Pendências abertas:** antiguidade institucional e as decisões que faltam antes do design da fase 5.
7. Links: telas (`specs/2026-11-16-telas.md`) e esquema do banco (`specs/2026-11-16-esquema-banco.md`).

O que sai do corpo:
- "Revisões antes da fase 4" (propostas aceitas, correções, detalhes do esboço, recusadas, pendências menores): o que foi aceito já está nas telas ou no código; vira linhas do registro de decisões.
- "Reorganização do roadmap: Pecúlio primeiro", com o levantamento do Pecúlio: vai para uma spec própria da fase 5 (`specs/AAAA-MM-DD-peculio-design.md`), que é onde a PLANEJAMENTO vai precisar dele.

### 3. O roadmap vira só o mapa

Alvo: até 25 KB e nenhum parágrafo com mais de 400 caracteres. Estrutura proposta:

1. **Princípios** (os 6 de hoje, uma linha cada).
2. **Visão geral:** a tabela das fases, com uma coluna nova "Situação" (`concluída`, `em andamento`, `planejada`).
3. **Uma seção curta por fase:** objetivo em uma frase, a lista das entregas (uma linha cada, com a situação) e o link para o plano e a spec.
4. **Fluxo de uma regra nova** e **Riscos**, como estão.

O que sai do corpo:
- As narrativas "Decisão do usuário (data): …", "Retorno da sandbox…" e "Reorganização de 20/11…": viram linhas do registro de decisões; no roadmap fica só o resultado (a entrega e onde ela está).
- "Revisões antes da fase 4" e "Resultado da revisão 3": viram uma linha na visão geral ("concluídas") e linhas no registro.
- A nota sobre a renumeração das fases 5 a 11: uma linha no registro. Os "(era a 5)" saem dos títulos.

### 4. Regra daqui para a frente

- Nada de "Adendo": a mudança vai direto no texto, e a decisão ganha uma linha em `docs/decisoes.md`.
- Toda decisão nova do usuário entra no registro no mesmo PR que muda o documento.
- Essa regra entra no `docs/LEIAME.md` (régua) e numa linha do `CLAUDE.md` (a DOCUMENTAÇÃO faz essas duas mudanças depois do merge).

## Como conferir

- `bash docs/ferramentas/checar-documentacao.sh`: design e roadmap fora da lista de "Documentos grandes", sem alerta de adendos e sem parágrafos longos.
- Fidelidade: para cada linha de `docs/decisoes.md`, a seção citada em "Onde está" diz o mesmo. A DOCUMENTAÇÃO faz essa conferência na revisão do PR.
- O texto antigo continua acessível: o PR cita o commit anterior à síntese, para quem quiser ler os adendos originais (`git show <commit>:caminho`).
- Links de outros documentos que apontavam para um adendo: o script de checagem acusa os links de arquivo que quebrarem; links para seção (`#…`) precisam ser procurados à mão (`grep -rn 'migracao-design.md#\|roadmap-migracao.md#' docs`).

## Restrições

- Um PR só, de documentação, na pasta da PLANEJAMENTO. Branch `docs-sintese-design-roadmap-exec`.
- Fazer numa janela em que nenhuma outra branch aberta esteja editando os dois arquivos (conferir antes com `git log origin/main..origin/<branch> -- <arquivo>` para as branches abertas).
- Linguagem do escalante; nada de dado pessoal.
- Merge só com anuência do usuário.

## O que fica para quem for planejar

- A estrutura exata das seções e a divisão das entregas da fase 4 na lista do roadmap.
- O nome e a data da spec do Pecúlio.
- Se o registro de decisões ficar acima de 25 KB, dividi-lo por fase.
