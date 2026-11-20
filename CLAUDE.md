# Sistema de Escalas 2º GB

Automação das escalas de serviço da 1ª SB / 2º GB (Corpo de Bombeiros Militar de Pernambuco).

- **Sistema novo (onde está o trabalho):** API Hono + Postgres, site React e um motor de regras em TypeScript. A fase atual e o que vem depois estão em `docs/superpowers/plans/2026-11-16-roadmap-migracao.md`; este arquivo não registra o estado do projeto.
- **Protótipo:** Google Apps Script + Google Sheets, usado como referência das regras. Instruções em `prototipo/CLAUDE.md`.
- Repositório: `kuminho-br/escalas-2gb` (privado). Código local: `C:\projetos\escalas-2gb`.

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| `pacotes/dominio/` | Motor de regras (puro: sem banco, sem tela) |
| `pacotes/contratos/` | Esquemas zod de entrada e saída da API, usados pela API e pelo site |
| `apps/api/` | API: rotas em `src/cadastros`, importação em `src/importacao`, migrações em `banco/migracoes` |
| `apps/web/` | Site: `routes/_app`, componentes, `__testes__` |
| `casos/` | Casos gravados do protótipo, referência do motor (ver `casos/LEIAME.md`) |
| `prototipo/` | Apps Script (escopo global único) |
| `docs/` | Documentação. Comece por `docs/LEIAME.md` |

## Como trabalhar

- Uma branch por entrega, a partir da `main`, com nome `fase4-N-<tema>` ou `docs-<tema>`. Uma entrega por PR. **Merge só com anuência do usuário.**
- Cada sessão trabalha na sua pasta (`C:/projetos/escalas-2gb-<sessão>`, criada com `git worktree`). Nunca trocar de branch na pasta de outra sessão.
- Antes de abrir PR: `pnpm test && pnpm typecheck`; mexeu na API ou no site: `pnpm build:vercel`.
- `pnpm test:prototipo` roda só os testes do protótipo.
- Mudou uma regra no protótipo: `pnpm casos:gravar`, conferir `git diff casos` e `pnpm --filter dominio test`. Regra só do sistema novo não grava caso: testa em `pacotes/dominio/test`.
- Nenhum dado pessoal real em repositório, teste ou CI: matrículas fictícias `990xxx-x`. Nunca ler nem imprimir segredos (`.env*`).

## Sessões

Cada sessão tem um papel; **só a PROGRAMAÇÃO altera código**.

| Sessão | Papel |
|---|---|
| REGRAS DE NEGÓCIO | Catálogo de regras (RN-XX) |
| SECRETARIADO | Board do dia; repassa tarefas à PROGRAMAÇÃO |
| PROGRAMAÇÃO | Implementa e testa |
| PLANEJAMENTO | Specs e planos de cada entrega; boletim de 2 em 2 dias |
| SAC & OUVIDORIA | Dúvidas (D01…) e reclamações (R01…) |
| VALIDAÇÃO | Recebe entregas prontas; o usuário testa à mão e dá o retorno |
| DOCUMENTAÇÃO | Controla os documentos, mede a qualidade e propõe melhorias; relatório a cada 3 dias |

## Domínio, em poucas linhas

- **Serviço:** origem administrativa da hora (Pronto, JES, Saldo, Diária, PJES). **Guarnição:** posto operacional (ABT, APH, ACO…). **Escala:** agrupamento de serviços com a mesma demanda.
- **Saldo:** militar do Adm que cobre um turno do Pronto; é alocado por último.
- **Jornadas:** Adm (expediente em dias úteis) e Pronto (turnos A/B de 12 h).
- Glossário completo: `docs/negocio/glossario.md`. Regras: `docs/negocio/regras/LEIAME.md`.

**CNH** (hierarquia do CTB, fixa no código, decisão de 18/11/2026): A é isolada, não habilita nenhuma outra e nenhuma outra a habilita. B habilita B; C habilita C e B; D habilita D e C; E habilita E e D (e, pela cadeia, C e B).

## Princípios de design

- **Barreira de suporte:** até onde o sistema ajuda o escalante a não errar. **Barreira de automação:** até onde faz sozinho com as entradas certas. A meta é a automação alcançar o suporte.
- O escalante nunca deve ser bloqueado de fechar a escala.
- Painéis sucintos, com pouca informação na tela. Textos sem jargão.
- Preferir cadastro pelo usuário a constante no código (exceção: a hierarquia de CNH).

## Documentação

O repositório é a versão oficial de todos os documentos. Índice, quem cuida de cada um e a régua de qualidade: `docs/LEIAME.md`.
