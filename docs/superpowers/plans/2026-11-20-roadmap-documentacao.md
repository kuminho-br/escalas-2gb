# Documentação — Roadmap de estruturação: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a documentação do projeto fácil de achar, com uma versão oficial só (no repositório) e enxuta o bastante para cada parte ser entendida sem ler tudo.

**Architecture:** Modelo B agora: cada sessão segue trabalhando onde já trabalha. Depois da colheita do claude.ai, a versão oficial de cada documento é a do repositório, e um índice único (`docs/LEIAME.md`) diz o que é cada documento, quem cuida e se está valendo. Perto do fim do projeto, tudo passa a ser editado direto no repositório (modelo A).

**Tech Stack:** Markdown no repositório, com diagramas em Mermaid (o GitHub e o VS Code desenham); artifacts do claude.ai lidos pela ferramenta Artifact; pasta própria (git worktree) `C:/projetos/escalas-2gb-documentacao`; `gh` para os PRs.

**Spec:** não há spec separada. As decisões estão na seção "Decisões" (conversa de 20/11/2026 com a sessão de DOCUMENTAÇÃO), e o levantamento do mesmo dia está em "Ponto de partida".

**Modelo:** execução no Sonnet, esforço high; revisão final de cada entrega no Opus, esforço medium (`model: "opus"`, `effort: "medium"` no Agent).

## Decisões

- **D1** — Modelo B agora; modelo A perto do fim do projeto (usuário, 20/11/2026).
- **D2** — Primeiro a colheita: ler o que existe no claude.ai, ver o que é útil ou melhora o projeto e trazer para o repositório. Depois desse merge, vale o que está no repositório (usuário, 20/11/2026).
- **D3** — Decidida pelo usuário (20/11/2026): o claude.ai deixa de ser usado; vale só o repositório. A DOCUMENTAÇÃO se ocupa de **trazer** a informação útil e não acompanha o que as sessões fazem no claude.ai. Fica de fora do plano: aposentar cópias, avisar nos artifacts e checar mudanças lá.
- **D4** — Só documentos: esta trilha não altera código (`apps/`, `pacotes/`, `scripts/`, `prototipo/*.js`, `prototipo/*.html`). O que precisar de código vira tarefa para a PROGRAMAÇÃO.
- **D5** — Specs e planos de fase continuam com quem os escreve (PLANEJAMENTO e PROGRAMAÇÃO, em `docs/superpowers/`). A DOCUMENTAÇÃO não muda esses arquivos de lugar: indexa, mede e propõe consolidação.

## Ponto de partida (20/11/2026)

- `CLAUDE.md`: insatisfatório (estado de 14/11, metade sobre o protótipo) e **fora do git**. Por isso as sessões que trabalham em `escalas-2gb-planejamento` e `escalas-2gb-validacao` abrem sem ele.
- `esquema-banco.md`: o ER e as tabelas param em 18/11; faltam 9 tabelas do domínio e 4 do login.
- Crescimento por adendos: design com 8 adendos (42 KB), voluntariado com 4, roadmap com 48 KB (era 38 KB de manhã).
- Plano da fase 4 com 207 KB.
- claude.ai: 16 artifacts do projeto, com cópias de roadmap (2), ER (3) e catálogo de regras (3 endereços).
- Não existem: índice, manual do usuário, roteiro do administrador, registro de decisões.

## Global Constraints

- Trabalhar só em `C:/projetos/escalas-2gb-documentacao`. Nunca trocar de branch em `C:/projetos/escalas-2gb` (é da PROGRAMAÇÃO) nem nas pastas de planejamento e validação.
- Uma entrega por branch e por PR (`documentacao-N-<tema>`), a partir da `origin/main`. Título do PR: `Documentação — Entrega N: <tema>`. Quem mescla é o usuário; parar até o merge ao fim de cada entrega.
- Nenhum dado pessoal real no repositório (nome, matrícula, telefone, CPF), inclusive no que vier do claude.ai (D7 do design). Matrícula fictícia é `990xxx-x`.
- Português, na linguagem do escalante; código interno (RN-94, Q17) só com o que ele é dito ao lado.
- **Régua de qualidade** (todo documento novo ou reescrito; fica escrita no índice, Tarefa 4):
  - documento lido inteiro (spec, guia, glossário, índice): até 25 KB; acima de 50 KB é crítico;
  - `CLAUDE.md` da raiz: até 120 linhas, sem "estado atual" datado, sem número que envelhece (contagem de testes ou de arquivos);
  - parágrafos de até 400 caracteres (linha de tabela fica de fora);
  - mais de 3 adendos: consolidar;
  - todo caminho citado existe.
- Diagramas em Mermaid dentro do próprio `.md`.
- Comandos de verificação rodam no Git Bash, a partir de `C:/projetos/escalas-2gb-documentacao`.

## Review Focus

1. **Dado pessoal vindo do claude.ai.** "Militares Externos" e "Board do Dia" podem ter nomes e matrículas reais. Esperado: nada disso entra no repositório. Verificação na Tarefa 2 e na revisão da Tarefa 5.
2. **Versão do claude.ai mais nova que a do repositório** (ex.: "ER da meta de ativação", de 20/11). Esperado: comparar pelo conteúdo; a regra "vale o repositório" só começa depois do merge. Coluna "mais novo onde?" no mapa da Tarefa 1.
3. **`CLAUDE.md` solto na pasta da PROGRAMAÇÃO.** Quando a entrega 1 (que já leva o `CLAUDE.md`) entrar na `main`, o git recusa atualizar aquela pasta enquanto o arquivo não versionado existir. Esperado: combinar a retirada antes. Passo na Tarefa 9.
4. **Arquivo que o PLANEJAMENTO está editando numa branch aberta** (ex.: `docs-reorganizacao-roadmap`). Esperado: não editar o mesmo arquivo em paralelo. Verificação na Tarefa 3, antes de mexer em `esquema-banco.md`.
5. **Caminho citado que não existe** (índice ou `CLAUDE.md` apontando para arquivo movido). Verificação nas Tarefas 4 e 7.

---

## Mapa das entregas

| Entrega | O que entrega | Quando | Detalhe |
|---|---|---|---|
| 1 | Colheita do claude.ai, ER em dia, índice da documentação e `CLAUDE.md` enxuto no git | agora | detalhada |
| 2 | Fechamento: retirar o `CLAUDE.md` solto da pasta da PROGRAMAÇÃO e decidir o `pr_p16.md` | logo depois do merge da 1 | Tarefa 9 |
| 3 | Checagem de 3 dias com relatório | depois da 2 | detalhar antes de começar |
| 4 | Consolidar o que cresceu por adendos; registro de decisões | entre duas entregas da fase 4, combinado com o PLANEJAMENTO | detalhar antes |
| 5 | Guia do escalante e notas de versão para os testadores | antes do piloto da fase 4 | detalhar antes |
| 6 | Roteiro do administrador | antes do piloto | detalhar antes |
| 7 | Casos de uso e guia visual | quando a etapa "Tipos de usuário e módulos" for planejada | detalhar antes |
| 8 | Virada para o modelo A | perto do fim do projeto (fase 7) | detalhar antes |

Fora do roadmap, por não valer o custo neste projeto: diagrama de classes (o código não é orientado a objetos), concept-arts (os mockups cumprem o papel) e diagramas de sequência (só se um fluxo gerar dúvida).

---

# Entrega 1 — Colheita do claude.ai, ER em dia e índice

Branch `documentacao-1-colheita`. Por pedido do usuário, esta entrega também leva o `CLAUDE.md` (Tarefas 7 e 8), que o plano previa na entrega 2.

## Arquivos

- Criar: `docs/LEIAME.md` — índice, onde mora cada coisa, régua de qualidade.
- Criar: `docs/negocio/glossario.md`.
- Criar: `docs/negocio/processo-do-mes.md` — diagrama de atividades do mês.
- Criar, se o mapa aprovar: `docs/negocio/regras/<assunto>.md` (catálogo de regras dividido por assunto para caber na régua) e os demais destinos do mapa.
- Modificar: `docs/superpowers/specs/2026-11-16-esquema-banco.md`.

### Task 1: Colheita — ler o claude.ai e montar o mapa

**Files:** nenhum no repositório; o mapa aprovado vai para a descrição do PR (Tarefa 5).

**Interfaces:**
- Produces: o mapa aprovado, uma linha por artifact, com `Destino` (caminho no repositório) e `Ação` (`trazer` | `já coberto` | `fora` | `perguntar`). As Tarefas 2, 3 e 6 seguem esse mapa.

- [ ] **Step 1: Branch da entrega**

Run: `git fetch origin && git switch -c documentacao-1-colheita origin/main`
Expected: `Switched to a new branch 'documentacao-1-colheita'`, e `git status --short` vazio.

- [ ] **Step 2: Perguntar ao usuário se há documentos do Project fora da lista abaixo** (tarefas para a PROGRAMAÇÃO, boletins do PLANEJAMENTO), com os links. Os que ele passar entram na lista.

- [ ] **Step 3: Ler cada artifact do projeto** com `Artifact(action: "read", url)`. Página grande: procurar no arquivo salvo que a leitura indica, em vez de carregar tudo.

| Artifact | Data | Endereço |
|---|---|---|
| Catálogo de Regras de Negócio — Escalas 1ª SB/2º GB | 15/11 | https://claude.ai/artifact/N5kvGmtcq6cvJvaXKBsMgL |
| Catálogo (link citado no `CLAUDE.md`) | ? | https://claude.ai/code/artifact/aab9f3e1-ec51-4981-8439-4e0a92e95469 |
| Catálogo de regras das escalas (rascunho para validação) | 07/10 | https://claude.ai/artifact/EPADGT9dSSy9rK4ZtsZTZu |
| Glossário — Sistema de Escalas 2º GB | 16/11 | https://claude.ai/artifact/E8GDV8xFTRoKjG1W4a4aQ1 |
| Diagrama de Atividades — Montagem das Escalas | 16/11 | https://claude.ai/artifact/1HdKC72ormKLxi13q3sPTV |
| Modelo ER — Sistema de Escalas 2º GB | 16/11 | https://claude.ai/artifact/HXRNbfPf57CwKuJpfwaaYX |
| ER da meta de ativação | 20/11 | https://claude.ai/artifact/P8K2tqf9cV72nmCC3sdces |
| Roadmap da migração | 16/11 | https://claude.ai/artifact/TBMEk6rYAftmocU8DZs7R5 |
| Sistema de Escalas 2º GB — Design da Arquitetura | 11/10 | https://claude.ai/artifact/2Tbg1UyVJDhP4reZXWaDYs |
| Proposta: Escalas de Serviço (guarnições e funções) | 11/10 | https://claude.ai/artifact/X3oMNMYainS6riYPhohZuj |
| P13 — Grade da escala sem turno na linha | 13/10 | https://claude.ai/artifact/E8C6sCrYgDBcK6rnL394N6 |
| Sistema de Gestão 2º GB | 19/11 | https://claude.ai/artifact/73ExwJ1S3TZJVKC1pbmt5S |
| Serviço de Operações · 2º GB | 18/11 | https://claude.ai/artifact/2hfyhMLzgnYh9NGFBBGnZm |
| Board do Dia | 18/10 | https://claude.ai/artifact/WjdzRNxNHUp7Q3qfL6UW4G |
| Militares Externos — Serviço no 2º GB (Nov/2026) | 11/11 | https://claude.ai/artifact/TRLmM279ktnWsYexNUQvdS |
| Untitled | 15/10 | https://claude.ai/artifact/19Zo1wCNGdeE6xfYzCwEwL |

Os artifacts de outros assuntos (Despachante, Registro de Ocorrências, pessoais) ficam de fora.

- [ ] **Step 4: Montar o mapa** com as colunas: Artifact · Equivalente no repositório · Mais novo onde? · O que tem de útil que o repositório não tem · Destino · Ação.

Proposta inicial de destino (o mapa pode mudar):
- os três catálogos → `docs/negocio/regras/`, um arquivo por assunto; regra que aparece em mais de um fica com a versão mais nova;
- Glossário → `docs/negocio/glossario.md`, unido com "Conceitos-chave" do `CLAUDE.md` e "Vocabulário" da spec da meta de ativação; divergências listadas para o usuário;
- Diagrama de Atividades → `docs/negocio/processo-do-mes.md`, dizendo quais das pendências E1 a E8 do roadmap já foram resolvidas;
- os dois ERs → alimentam a Tarefa 3, sem arquivo próprio;
- Roadmap da migração → `já coberto`, salvo o que faltar no roadmap do repositório;
- Design da Arquitetura, Proposta de guarnições e P13 (era do protótipo) → `já coberto`, salvo o que faltar; um diagrama de arquitetura que ainda valha vai para `docs/arquitetura.md`;
- Board do Dia (ferramenta do SECRETARIADO) e Militares Externos (dados pessoais) → `fora`;
- Sistema de Gestão, Serviço de Operações e Untitled → classificar depois de ler.

- [ ] **Step 5: Apresentar o mapa ao usuário** (tabela no chat) e ajustar até ele aprovar.
Expected: toda linha com `Ação` preenchida e nenhuma `perguntar` sobrando.

### Task 2: Trazer o negócio para o repositório

**Files:** os destinos com `Ação: trazer` no mapa (no mínimo `docs/negocio/glossario.md` e `docs/negocio/processo-do-mes.md`).

**Interfaces:**
- Consumes: o mapa aprovado (Tarefa 1).
- Produces: `docs/negocio/glossario.md` (a Tarefa 7 aponta para ele) e os demais arquivos de `docs/negocio/`.

- [ ] **Step 1: Escrever cada arquivo do mapa.** Cabeçalho de três linhas: o que é; `Fonte: <artifact> (<data>), colhido em <data da colheita>`; `Quem cuida: <sessão>`. Diagramas viram Mermaid. Arquivo acima de 25 KB é dividido por assunto.

- [ ] **Step 2: Conferir a régua**

Run: `find docs/negocio -name '*.md' -size +25k; awk 'length($0)>400{print FILENAME": "FNR}' $(find docs/negocio -name '*.md')`
Expected: saída vazia.

- [ ] **Step 3: Conferir dados pessoais**

Run: `grep -rnE '\b[0-9]{3}\.?[0-9]{3}-[0-9X]\b|\(?[0-9]{2}\)? ?9?[0-9]{4}-[0-9]{4}' docs/negocio | grep -v '990'`
Expected: saída vazia. Depois, ler os arquivos procurando nomes de pessoas reais; nome de militar só se for fictício.

- [ ] **Step 4: Commit**

```bash
git add docs/negocio
git commit -m "Documentação 1: negócio trazido do claude.ai (glossário, processo do mês e o que o mapa aprovou)"
```

### Task 3: ER e tabelas do banco em dia

**Files:** Modify `docs/superpowers/specs/2026-11-16-esquema-banco.md`.

**Interfaces:**
- Consumes: as migrações `apps/api/banco/migracoes/*.sql` (fonte da verdade) e os ERs colhidos na Tarefa 1.
- Produces: o comando de cobertura do Step 2, reaproveitado na checagem de 3 dias (entrega 3).

- [ ] **Step 1: Conferir que ninguém está editando o arquivo noutra branch**

Run: `for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD); do git log --oneline origin/main..$b -- docs/superpowers/specs/2026-11-16-esquema-banco.md | sed "s|^|$b: |"; done`
Expected: saída vazia. Se aparecer branch, parar e perguntar ao usuário.

- [ ] **Step 2: Rodar a cobertura e ver que falha**

Run: `grep -hoiE 'create table (if not exists )?[a-z_."]+' apps/api/banco/migracoes/*.sql | awk '{print $NF}' | tr -d '"' | sed 's/.*\.//' | sort -u | while read t; do grep -qE "^### .*\b$t\b" docs/superpowers/specs/2026-11-16-esquema-banco.md || echo "$t"; done`
Expected hoje: 13 nomes (as 9 tabelas das entregas 4.x e as 4 do login). Título combinado (`### a e b`) conta como coberto.

- [ ] **Step 3: Escrever o que falta.**
  - Cada tabela ganha um `### <tabela>` no grupo certo, no formato das vizinhas: colunas da migração, para que serve (uma linha) e a migração que a criou.
  - As quatro do login (`usuario`, `sessao`, `conta`, `verificacao`) ficam num grupo próprio: "tabela do Better Auth; não editar à mão".
  - O diagrama Mermaid ganha as ligações novas.
  - Abaixo do título: `Em dia com as migrações até a <última>.sql`.

- [ ] **Step 4: Rodar a cobertura de novo**

Run: o comando do Step 2.
Expected: saída vazia.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-11-16-esquema-banco.md
git commit -m "Documentação 1: ER e tabelas em dia com as migrações"
```

### Task 4: Índice da documentação

**Files:** Create `docs/LEIAME.md`.

**Interfaces:**
- Produces: `docs/LEIAME.md` com a seção "Régua de qualidade" (a Tarefa 7 e a entrega 3 apontam para ela).

- [ ] **Step 1: Rodar a cobertura do índice e ver que falha**

Run: `git ls-files docs | grep -E '\.(md|html)$' | while read f; do grep -qF "$(basename "$f")" docs/LEIAME.md 2>/dev/null || echo "fora do índice: $f"; done`
Expected: todos os documentos listados (o índice ainda não existe).

- [ ] **Step 2: Escrever `docs/LEIAME.md`** com três partes:
  1. **Como a documentação está organizada**, em até 6 linhas: D1 a D3 em linguagem simples, e "o repositório é a versão oficial".
  2. **Documentos**, em tabelas por grupo. Colunas: Documento (link) · Para que serve · Quem cuida · Situação (`vigente` | `em execução` | `concluído` | `superado` | `rascunho`).
     - Grupos: Para começar (`CLAUDE.md`, este índice); Negócio; Sistema (design, banco, telas, specs); Planos; Telas e mockups; Fora do repositório (artifacts que ficam no claude.ai, com o motivo).
     - Mockups: cada HTML com a situação; as versões v5 a v11 ficam só na pasta local `.superpowers/` e não valem.
     - Quem cuida: branch `docs-*` → PLANEJAMENTO; `fase*` → PROGRAMAÇÃO; `docs/negocio/` → conforme o mapa; índice e `CLAUDE.md` → DOCUMENTAÇÃO.
  3. **Régua de qualidade**, copiada das Global Constraints deste plano.

A pasta local `docs/fontes de dados/` (dados pessoais, fora do git) é citada só pelo nome, sem o conteúdo.

- [ ] **Step 3: Rodar a cobertura do índice de novo**

Run: o comando do Step 1.
Expected: saída vazia.

- [ ] **Step 4: Conferir os links e o tamanho**

Run: `grep -oE '\]\([^)#]+' docs/LEIAME.md | sed 's/^](//' | grep -v '^http' | while read p; do [ -e "docs/$p" ] || echo "quebrado: $p"; done; wc -c docs/LEIAME.md`
Expected: nenhum "quebrado", e até 25600 bytes.

- [ ] **Step 5: Commit**

```bash
git add docs/LEIAME.md
git commit -m "Documentação 1: índice da documentação e régua de qualidade"
```

### Task 5: PR e revisão final

- [ ] **Step 1: Push e PR**

Run: `git push -u origin documentacao-1-colheita && gh pr create --base main --title "Documentação — Entrega 1: colheita do claude.ai, ER e índice" --body-file <arquivo com: o que mudou, o mapa aprovado e a saída das verificações>`
Expected: link do PR.

- [ ] **Step 2: Revisão final** com o Agent (`model: "opus"`, `effort: "medium"`), lendo o diff contra este plano: dado pessoal, régua, links, cobertura do ER e do índice, e se algo útil do mapa ficou de fora. Corrigir os achados num commit só.

- [ ] **Step 3: Pedir o merge ao usuário.** Parar até o merge.

### Task 6: (retirada)

Aposentar as cópias no claude.ai saiu do plano: o claude.ai deixa de ser usado (D3).

---

# Entrega 2 — `CLAUDE.md` enxuto e no git (antecipada para a entrega 1)

As Tarefas 7 e 8 foram feitas na branch `documentacao-1-colheita`. A Tarefa 9 (arquivo solto) fica para depois do merge.

### Task 7: `CLAUDE.md` da raiz e do protótipo (feita na entrega 1)

**Files:**
- Create (no git): `CLAUDE.md`
- Create: `prototipo/CLAUDE.md`
- Modify: `.gitignore` (linha `docs/fontes de dados/`)

**Interfaces:**
- Consumes: o `CLAUDE.md` solto em `C:/projetos/escalas-2gb/CLAUDE.md` (copiar, não mover); `docs/LEIAME.md` e `docs/negocio/glossario.md` (entrega 1).

- [ ] **Step 1: Branch e cópia do arquivo atual**

Run: `git fetch origin && git switch -c documentacao-2-claude-md origin/main && cp C:/projetos/escalas-2gb/CLAUDE.md CLAUDE.md`

- [ ] **Step 2: Reescrever o `CLAUDE.md` da raiz**, até 120 linhas, nesta ordem:
  1. **O projeto**, em 3 linhas: sistema novo (API Hono, site React, Postgres) em construção, e o protótipo Apps Script como referência das regras. A fase atual não é escrita: o arquivo aponta para o roadmap.
  2. **Onde está cada coisa**: o sistema novo primeiro (`pacotes/dominio`, `pacotes/contratos`, `apps/api`, `apps/web`); depois `casos/`, `prototipo/` (→ `prototipo/CLAUDE.md`) e `docs/` (→ `docs/LEIAME.md`).
  3. **Como trabalhar**: branch por entrega a partir da `main`; pasta própria por sessão (`C:/projetos/escalas-2gb-<sessão>`); merge só com anuência do usuário; os comandos `pnpm test`, `pnpm typecheck` e `pnpm build:vercel` (quando mexer na API ou no site); regra mudada no protótipo → `pnpm casos:gravar`, `git diff casos` e `pnpm --filter dominio test`.
  4. **Sessões**: as sete (REGRAS DE NEGÓCIO, SECRETARIADO, PROGRAMAÇÃO, PLANEJAMENTO, SAC & OUVIDORIA, VALIDAÇÃO, DOCUMENTAÇÃO), uma linha cada; só a PROGRAMAÇÃO altera código.
  5. **Domínio**: até 5 linhas e o link para o glossário. A hierarquia de CNH continua aqui, porque é regra fixa no código.
  6. **Princípios de design**: os atuais, sem os que são só do Apps Script.
  7. **Documentação**: link para o índice; o repositório é a versão oficial.

Saem: "Estado atual (14/11/2026)", "Decisões pendentes", contagens de testes, abas da planilha, regras do clasp e parâmetros (vão para `prototipo/CLAUDE.md`), e o link do catálogo no claude.ai (vai para o índice).

- [ ] **Step 3: Escrever `prototipo/CLAUDE.md`** com o que saiu da raiz e é só do protótipo:
  - stack Apps Script; escopo global único, sem `require()`;
  - regras do clasp (`C:\` maiúsculo, `rootDir`, `.claspignore`, `clasp show-file-status`);
  - o usuário faz o `clasp push` e valida na sandbox (com o link da planilha sandbox);
  - abas da planilha, com os nomes antigos que não se usam; parâmetros de CONFIGURAÇÕES;
  - testes do protótipo: `node scripts/testes-prototipo.mjs`.

- [ ] **Step 4: Ignorar a pasta de dados pessoais.** Acrescentar a linha `docs/fontes de dados/` ao `.gitignore`.

- [ ] **Step 5: Conferir a régua**

```bash
wc -l CLAUDE.md
grep -nE 'Estado atual|[0-9]+ ok|[0-9]{2}/[0-9]{2}/20[0-9]{2}' CLAUDE.md
grep -ohE '`(apps|pacotes|docs|prototipo|casos|scripts)/[^`]*`' CLAUDE.md prototipo/CLAUDE.md \
  | tr -d '`' | while read p; do [ -e "$p" ] || echo "não existe: $p"; done
grep -c '^\*\.md$' .claspignore
git check-ignore -v "docs/fontes de dados/x.xlsx"
```

Expected: até 120 linhas; nenhuma linha do `grep` de datas e contagens; nenhum "não existe"; `1` (o clasp não envia `.md`, então `prototipo/CLAUDE.md` não vai para o Apps Script); o `check-ignore` cita o `.gitignore`.

- [ ] **Step 6: Mostrar ao usuário** os dois arquivos e o que saiu do antigo. Ajustar até ele aprovar o texto.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md prototipo/CLAUDE.md .gitignore
git commit -m "Documentação 2: CLAUDE.md enxuto no git e CLAUDE.md do protótipo"
```

### Task 8: Memória da sessão de validação

**Files:** Modify `~/.claude/projects/c--projetos-escalas-2gb/memory/sessao-de-validacao.md` (fora do git).

- [ ] **Step 1:** Trocar "Esta sessão recebe…" por "Existe uma sessão de VALIDAÇÃO que recebe…" na descrição e no texto, e a linha correspondente do `MEMORY.md`. O resto fica igual.

Run: `grep -n 'Esta sessão' ~/.claude/projects/c--projetos-escalas-2gb/memory/sessao-de-validacao.md`
Expected: saída vazia.

### Task 9: PR, merge e o arquivo solto

- [ ] **Step 1: Push, PR e revisão final**, como na Tarefa 5. Título: `Documentação — Entrega 2: CLAUDE.md enxuto e no git`.

- [ ] **Step 2: Combinar com o usuário o arquivo solto.** O `CLAUDE.md` não versionado em `C:/projetos/escalas-2gb` impede o git de trazer o novo para aquela pasta. Antes de a PROGRAMAÇÃO atualizar a pasta com a `main`, o arquivo solto precisa ser apagado (o conteúdo novo está no PR). Perguntar também sobre o `pr_p16.md` solto na raiz (resumo do P16, de 10/11): apagar ou guardar.

- [ ] **Step 3: Pedir o merge ao usuário.** Depois do merge e da atualização da pasta:

Run: `git -C C:/projetos/escalas-2gb status --short CLAUDE.md`
Expected: saída vazia (o arquivo agora é do git).

---

# Entregas 3 a 8 (resumo; cada uma é detalhada antes de começar)

## Entrega 3 — Checagem de 3 dias com relatório

- Decidir como roda: rotina na nuvem (recomendada depois da entrega 2, porque o `CLAUDE.md` já estará no git), tarefa agendada do Windows, ou à mão. Decidir também onde o relatório chega (recomendado: página privada no claude.ai).
- Acrescentar a `docs/LEIAME.md` a seção "Como checar", com os comandos das Tarefas 2, 3, 4 e 7 (tamanho, linhas longas, adendos, ER × migrações, índice × arquivos, caminhos e régua do `CLAUDE.md`), mais: branches `docs-*` abertas há mais de 3 dias e artifacts do claude.ai alterados depois da última colheita (D3).
- O relatório traz: nota do `CLAUDE.md` (bom, regular ou insatisfatório), o que piorou desde o anterior, o que mudou no claude.ai para trazer e sugestões com alternativas.

## Entrega 4 — Consolidar e registrar decisões

- `migracao-design.md`: reescrito como está hoje; os adendos ficam no histórico do git.
- `roadmap-migracao.md`: só fases, entregas e situação; as decisões vão para `docs/decisoes.md` (uma linha por decisão: data, o que foi decidido, onde está o detalhe).
- Spec do voluntariado por faixa: os 4 adendos consolidados.
- Proposta ao PLANEJAMENTO: plano novo com um arquivo por entrega.
- São os arquivos que o PLANEJAMENTO mais edita: a janela é combinada com ele.

## Entrega 5 — Guia do escalante e notas de versão

- `docs/manuais/guia-do-escalante.md`: o mês do escalante passo a passo (lançar o voluntariado, gerar a pré-escala, ajustar, conferir na grade geral, gerar o documento), com as telas reais. Ponto de partida: os roteiros da VALIDAÇÃO.
- `docs/manuais/notas-de-versao.md`: o que mudou em cada entrega, para os testadores.

## Entrega 6 — Roteiro do administrador

- `docs/manuais/roteiro-do-administrador.md`: publicar, aplicar migração, criar administrador e convidar usuário, importar as planilhas, cópia de segurança, o que fazer quando o banco pausa. Fontes: planos das fases 1 e 3. Nenhum segredo no texto.

## Entrega 7 — Casos de uso e guia visual

- Casos de uso em Mermaid, um por tipo de usuário, quando a etapa "Tipos de usuário e módulos" for planejada.
- `docs/guia-visual.md`: as regras de "Identidade visual" de `telas.md`, conferidas com as cores reais de `apps/web/src/estilo.css`.

## Entrega 8 — Virada para o modelo A

- As sessões do claude.ai passam a ler e propor direto no repositório.
- Os artifacts restantes são aposentados.
- A checagem de 3 dias deixa de olhar o claude.ai.
