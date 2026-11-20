# Documentação do projeto

Índice dos documentos do Sistema de Escalas 2º GB: o que é cada um, quem cuida e se ainda vale. Quem cuida deste índice é a sessão de DOCUMENTAÇÃO.

## Como a documentação está organizada

- **O repositório é a versão oficial** de todos os documentos. O que existia só no claude.ai (catálogo de regras, glossário, diagrama de atividades, ER da meta de ativação) foi trazido em 20/11/2026 e passa a ser editado aqui.
- Cada documento tem **um lugar só** e **um dono** (coluna "Quem cuida").
- Documento novo entra neste índice no mesmo PR que o cria.
- A situação diz se o documento vale: `vigente`, `em execução`, `concluído` (descreve algo já feito; serve de histórico), `superado` (não usar) ou `rascunho`.

## Para começar

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [CLAUDE.md](../CLAUDE.md) | Instruções para toda sessão: onde está cada coisa, como trabalhar, papéis, princípios | DOCUMENTAÇÃO | vigente |
| [prototipo/CLAUDE.md](../prototipo/CLAUDE.md) | Regras do clasp e da planilha, só para quem mexe no protótipo | DOCUMENTAÇÃO | vigente |
| [casos/LEIAME.md](../casos/LEIAME.md) | Casos gravados do protótipo, referência do motor | PROGRAMAÇÃO | vigente |

## Negócio

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [negocio/regras/LEIAME.md](negocio/regras/LEIAME.md) | Catálogo de regras (RN-XX), dividido por assunto (o LEIAME da pasta lista os arquivos) | REGRAS DE NEGÓCIO | vigente |
| [negocio/glossario.md](negocio/glossario.md) | Termos do domínio, com definição e status | REGRAS DE NEGÓCIO | vigente |
| [negocio/glossario-pendencias.md](negocio/glossario-pendencias.md) | Perguntas em aberto e divergências do glossário | REGRAS DE NEGÓCIO | vigente |
| [negocio/processo-do-mes.md](negocio/processo-do-mes.md) | Diagrama de atividades do mês, do formulário à escala executada | REGRAS DE NEGÓCIO | rascunho (E1 a E8 em aberto) |

## Sistema

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [superpowers/specs/2026-11-16-migracao-design.md](superpowers/specs/2026-11-16-migracao-design.md) | Decisões técnicas (D1 a D7) e adendos de cada etapa | PLANEJAMENTO | vigente (a consolidar) |
| [superpowers/specs/2026-11-16-esquema-banco.md](superpowers/specs/2026-11-16-esquema-banco.md) | Esquema do banco: diagrama ER e uma seção por tabela | PROGRAMAÇÃO | vigente (em dia até a migração 0022) |
| [superpowers/specs/2026-11-16-telas.md](superpowers/specs/2026-11-16-telas.md) | Identidade visual, navegação e cada tela | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md](superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md) | Ordem de escala e acúmulo de funções | PLANEJAMENTO | concluído |
| [superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md](superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md) | Voluntariado por faixa de horário, com 4 adendos | PLANEJAMENTO | concluído (a consolidar) |
| [superpowers/specs/2026-11-20-meta-de-ativacao-design.md](superpowers/specs/2026-11-20-meta-de-ativacao-design.md) | Meta de ativação e Efetivo do dia | PLANEJAMENTO | em execução |
| [superpowers/specs/2026-11-20-grade-geral-design.md](superpowers/specs/2026-11-20-grade-geral-design.md) | Grade geral (entrega 4) | PLANEJAMENTO | em execução |
| [superpowers/specs/2026-11-20-grade-geral-ux-design.md](superpowers/specs/2026-11-20-grade-geral-ux-design.md) | Ajustes de interface da grade geral | PLANEJAMENTO | em execução |
| [superpowers/specs/2026-11-20-limpeza-da-fase-3-design.md](superpowers/specs/2026-11-20-limpeza-da-fase-3-design.md) | Limpeza das pendências da fase 3 | PLANEJAMENTO | vigente |

## Planos

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [superpowers/plans/2026-11-16-roadmap-migracao.md](superpowers/plans/2026-11-16-roadmap-migracao.md) | Roadmap das fases e decisões de cada etapa | PLANEJAMENTO | vigente (a enxugar) |
| [superpowers/plans/2026-11-16-fase1-fundacao.md](superpowers/plans/2026-11-16-fase1-fundacao.md) | Fase 1: fundação | PROGRAMAÇÃO | concluído |
| [superpowers/plans/2026-11-17-fase2-motor.md](superpowers/plans/2026-11-17-fase2-motor.md) | Fase 2: motor de regras | PROGRAMAÇÃO | concluído |
| [superpowers/plans/2026-11-17-fase3-cadastros.md](superpowers/plans/2026-11-17-fase3-cadastros.md) | Fase 3: cadastros | PROGRAMAÇÃO | concluído |
| [superpowers/plans/2026-11-18-revisao-1.md](superpowers/plans/2026-11-18-revisao-1.md) | Revisão 1: pendências de interface | PROGRAMAÇÃO | concluído |
| [superpowers/plans/2026-11-18-revisao-3.md](superpowers/plans/2026-11-18-revisao-3.md) | Revisão 3: revisão de código | PROGRAMAÇÃO | concluído |
| [superpowers/plans/2026-11-18-fase4-escala.md](superpowers/plans/2026-11-18-fase4-escala.md) | Fase 4: montagem da escala (entregas 1 a 4.3) | PROGRAMAÇÃO | em execução (grande demais: dividir) |
| [superpowers/plans/2026-11-20-roadmap-documentacao.md](superpowers/plans/2026-11-20-roadmap-documentacao.md) | Roadmap da documentação | DOCUMENTAÇÃO | em execução |

## Telas e mockups

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [telas/telas-v12-anonimizado.html](telas/telas-v12-anonimizado.html) | Esboços aprovados das telas (versão 12), com dados anonimizados | PLANEJAMENTO | vigente como referência |
| [telas/login-e-inicio/mockup.html](telas/login-e-inicio/mockup.html) | Login e tela inicial aprovados | PLANEJAMENTO | concluído |
| [telas/mockup-voluntariado-faixas.html](telas/mockup-voluntariado-faixas.html) | Voluntariado por faixa de horário | PLANEJAMENTO | concluído |
| [telas/mockup-entrega-2-4.html](telas/mockup-entrega-2-4.html) | Acabamento do voluntariado e da Escala do mês | PLANEJAMENTO | concluído |

As versões v5 a v11 dos esboços ficam só na pasta local `.superpowers/` (fora do git) e estão superadas pela v12.

## Fora do repositório

- `docs/fontes de dados/`: planilhas e PDFs com dados pessoais, **nunca vão para o git** (ignorada no `.gitignore`). Só quem trabalha na máquina do usuário as vê.

## Régua de qualidade

Cada medida é um alerta, não um bloqueio. A DOCUMENTAÇÃO mede a cada 3 dias e relata.

| Medida | Bom | Atenção |
|---|---|---|
| Documento lido inteiro (spec, guia, glossário, índice) | até 25 KB | acima de 50 KB é crítico |
| `CLAUDE.md` da raiz | até 120 linhas, sem "estado atual" datado, sem número que envelhece (contagem de testes ou de arquivos) | |
| Parágrafo (linha de tabela fica de fora) | até 400 caracteres | |
| Adendos num mesmo documento | até 3 | mais de 3: consolidar |
| Caminhos e links citados | todos existem | link quebrado |
| ER × migrações | toda tabela tem um título `###` no esquema do banco | tabela sem título |
| Índice × arquivos | todo `.md` e `.html` de `docs/` aparece aqui ou no LEIAME da sua pasta | arquivo fora do índice |
