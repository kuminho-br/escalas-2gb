# Árvore genérica (6.25) e configurações gerais (6.26): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a árvore de unidades vira genérica e editável pela tela, sem nenhuma regra presa ao tipo de unidade, e as configurações gerais saem do módulo de escalas para um painel aberto pela tela inicial.

**Architecture:** uma migração (0035) solta a ordem dos tipos, dá `id` ao tipo, renomeia `chefe_divisao` para `gestor_lateral` e troca as regras de banco presas a tipo. A API troca as rotas de divisão por rotas genéricas de unidade e de tipo. Tudo o que hoje compara `tipo` com um valor fixo passa a olhar a árvore (unidade de cima, irmãs, abaixo). No site, a tela Estrutura vira uma árvore editável e, na 6.26, vai com as outras configurações gerais para o painel novo.

**Tech Stack:** Postgres (ltree), Hono, zod (`pacotes/contratos`), React, TanStack Router e Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-arvore-generica-design.md`.

## Global Constraints

- Ordem: depois da 6.17, antes da 6.18, da 6.20 e da 6.21. Branches `fase6-25-arvore-generica` e `fase6-26-configuracoes-gerais`, a partir da `main`.
- **A 6.25 tem migração: 0035** (`0035_arvore_generica.sql`); o PR leva "tem migração" no título. Se a 6.21 precisar de migração, usa o próximo número livre.
- Nenhuma regra compara o tipo da unidade com um valor fixo (`'secao'`, `'divisao'`, `'grupamento'`, `'corporacao'`, `'diretoria…'`). O tipo só é lido para mostrar o nome.
- `gestor_lateral` é o nome técnico do quinto nível. O nome na tela fica só em `apps/web/src/lib/papeis.ts`: provisório **"Coordenador"**, até o usuário escolher.
- Textos fixos: "Já existe {sigla} abaixo de {sigla de cima}."; "Uma unidade não pode ficar abaixo de si mesma."; "A unidade raiz não muda de lugar."; "Esta unidade tem histórico ({o que está ligado}). Extinga em vez de excluir."; "Antes de extinguir, mova {n} unidades e {m} militares lotados."; "Você não tem nível de acesso de gestor acima desta unidade."; "Há unidades deste tipo.".
- Ative a skill `frontend-design:frontend-design` nas tasks de tela; não há mockup: adeque à identidade atual e registre as escolhas no PR.
- Nenhum dado pessoal real; matrículas fictícias `990xxx-x`.
- Antes de cada PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios, em 1280 e 390 px.

## Review Focus

1. **Mover uma unidade para dentro de uma das suas filhas** (ciclo, também em dois passos e com unidades extintas no meio): recusado, e nada muda.
2. **Gestor tirando uma unidade da própria árvore** (mover para fora, ou para dentro vinda de fora): recusado nas duas pontas.
3. **Excluir unidade com histórico só no passado** (militar que já saiu, escala de meses passados, nível de acesso encerrado): conta como histórico e é recusado.
4. **Sigla repetida** só entre irmãs ativas, sem diferenciar maiúsculas; a mesma sigla abaixo de outra unidade é aceita, e as listas a mostram com a de cima.
5. **Quinto nível na raiz ou numa unidade sem irmãs:** na raiz é recusado; sem irmãs, só não vê nada a mais.

---

# Entrega 6.25 — Árvore genérica

### Task 1: a migração 0035

**Files:** Create `apps/api/banco/migracoes/0035_arvore_generica.sql`, `apps/api/test/migracao-0035.test.ts`; Modify o documento do esquema do banco

**Interfaces:**
- Produces: `tipo_unidade (codigo text pk, id uuid unique not null default gen_random_uuid(), nome text not null, ordem int not null)`, com `nivel` renomeado para `ordem` e sem `unique`; a auditoria de `tipo_unidade` ligada (sem o desliga-liga da 0031); `unidade_montar_caminho` sem a regra de nível (fica a do ciclo); índice único de sigla entre irmãs ativas: `(mae_id, upper(sigla)) where ate is null`; em `papel_usuario`, `chefe_divisao` → `gestor_lateral` (linhas e `check`), sai o gatilho `papel_chefe_na_divisao` e entra `papel_gestor_lateral_fora_da_raiz` ("O nível não existe na unidade raiz."); em `visao_bloco`, a camada `chefe_divisao` → `gestor_lateral`.

- [ ] **Step 1: testes da migração:** roda de novo sem erro; as linhas de `papel_usuario` e `visao_bloco` trocam de nome sem perder nenhuma; uma seção pode ficar acima de um grupamento; o ciclo continua recusado; duas irmãs ativas com "1ª SB" e "1ª sb" são recusadas e a mesma sigla em outra mãe é aceita; `gestor_lateral` na raiz é recusado; uma linha nova em `tipo_unidade` grava a auditoria com quem fez.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** escrever a migração. Antes do índice de sigla, conferir que não há irmãs ativas repetidas no banco de teste (só contar, sem imprimir dados); se houver, a migração para com a mensagem que diz quais siglas.
- [ ] **Step 4:** PASS; esquema do banco atualizado.
- [ ] **Step 5:** commit `Fase 6.25: migração da árvore genérica`.

### Task 2: as rotas da árvore e dos tipos

**Files:** Modify `apps/api/src/cadastros/estrutura.ts` (troca as rotas de divisão), `pacotes/contratos/src/estrutura.ts`; Create `apps/api/src/cadastros/tipos-de-unidade.ts`; Test `apps/api/test/estrutura.test.ts`, `apps/api/test/tipos-de-unidade.test.ts`

**Interfaces:**
- Produces, contratos: `TipoDeUnidade = { codigo: string; nome: string; ordem: number }`; `NoDaArvore = { id; sigla; nome; tipo: TipoDeUnidade; desde; ate: string | null; filhas: NoDaArvore[]; podeEditar: boolean; ligados: { unidades: number; militaresHoje: number; historico: string[] } }`; `NovaUnidade = { maeId, tipo, sigla, nome, desde }`; `AlteracaoDeUnidade = { sigla?, nome?, tipo?, maeId? }`.
- Produces, rotas: `GET /api/estrutura?raiz={id}` (a árvore a partir da unidade; sem `raiz`, a mais alta em que a pessoa tem gestão, ou a raiz para o administrador); `POST /api/unidades`; `PATCH /api/unidades/:id`; `POST /api/unidades/:id/extinguir` (`{ ate }`); `DELETE /api/unidades/:id`; `GET /api/tipos-de-unidade` (qualquer conta), `POST`, `PATCH /:id` e `DELETE /:id` (administrador). Saem `/api/divisoes*` e a rota de pôr seção em divisão.

- [ ] **Step 1: testes:** cada operação com administrador, gestor da unidade de cima, gestor da própria unidade (renomeia; não move, não extingue, não exclui a si), auxiliar e militar comum (403); Review Focus 1 a 4; extinguir com filha ativa ou militar lotado devolve 409 com as contagens; excluir sem nada ligado apaga, com histórico devolve 409 e a lista do que está ligado; tipo em uso não é excluído.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar; o `codigo` do tipo novo sai do nome (minúsculas, sem acento, `_`), único.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `Fase 6.25: rotas da árvore e dos tipos de unidade`.

### Task 3: nada preso ao tipo

**Files:** Modify `apps/api/src/acesso.ts` (`Papel`, `CADASTRO`, `GESTAO`, `siglaDaUnidadeDeCima`), `apps/api/src/cadastros/militares.ts` (`/secoes` vira `/unidades-de-lotacao`; sai `MSG_SO_SECAO`; sigla repetida pela árvore), `apps/api/src/usuarios/criar-admin.ts`, `apps/api/src/usuarios/rotas.ts` (quem dá e onde vale o `gestor_lateral`), `apps/api/src/visao/visao.ts` e `visao/rotas.ts` (irmãs = mesma unidade de cima), `apps/api/src/importacao/peculio.ts` (lotação em qualquer unidade, sigla resolvida abaixo da unidade da importação), `pacotes/contratos/src/usuarios.ts`, `visao.ts`, `apps/web/src/api/eu.ts`, `apps/web/src/lib/papeis.ts`, `apps/web/src/routes/_app/escala-do-mes.tsx`, `apps/web/src/componentes/militares/NovoMilitar.tsx`, `AcessoAoSistema.tsx`, `configuracoes/QuemVeOQue.tsx`; Create `apps/api/test/nada-preso-ao-tipo.test.ts`; Test os arquivos de teste de cada um

- [ ] **Step 1: testes:**
  - A guarda: o teste de busca percorre `apps/*/src` e `pacotes/*/src` e falha se achar comparação de tipo com valor fixo (`tipo === 'secao'`, `tipo = 'divisao'`, `'grupamento'`…), e se achar `chefe_divisao`.
  - Lotação: um militar lotado no 2º GB aparece em Militares e no Pecúlio do 2º GB e na Grade do 2º GB; "Alterar situação", o cadastro, a importação e o `criar-admin --lotacao "2º GB"` aceitam o grupamento.
  - Mensagem do Pecúlio: com a seção dentro de uma divisão, cita a divisão (a unidade logo acima).
  - Quinto nível dado numa seção: vê as seções irmãs e o que há abaixo delas, edita a sua; não alcança irmãs de outra unidade de cima; Review Focus 5.
  - Escala do mês numa unidade sem escalas: o vazio com "Crie uma em Escalas.".
  - A lista de destino da lotação e o seletor mostram "1ª SB (2º GB)" quando a sigla se repete.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar. O item 12 da Task 8 da 6.18 fica coberto aqui.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `Fase 6.25: lotação, níveis e visão sem regra presa ao tipo`.

### Task 4: a tela da árvore e dos tipos

**Files:** Modify `apps/web/src/componentes/configuracoes/Estrutura.tsx` (reescrita), `apps/web/src/api/` (estrutura e tipos); Create `apps/web/src/componentes/configuracoes/TiposDeUnidade.tsx`; Test `apps/web/src/__testes__/estrutura.test.tsx`, `tipos-de-unidade.test.tsx`

- [ ] **Step 1: testes:**
  - A árvore aparece com recuo, recolhe e abre por unidade; cada linha tem sigla, nome, o tipo numa etiqueta neutra e quantos militares estão lotados hoje.
  - O menu da linha tem só o que a pessoa pode fazer: "Nova unidade abaixo", "Renomear", "Mover para…", "Extinguir", "Excluir". Excluir só aparece quando não há nada ligado; senão, "Extinguir" diz o que está ligado.
  - "Mover para…" abre a árvore de destino (só as unidades permitidas, sem a própria e as de baixo) e, antes de salvar, o aviso do efeito: quem passa a alcançar e quem deixa de alcançar, o que muda na herança e as irmãs novas.
  - A aba "Tipos de unidade" (administrador): criar, renomear, mudar a ordem e excluir.
  - Nenhuma rolagem de lado em 390 px.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar, ainda dentro das Configurações de hoje (a 6.26 muda de lugar).
- [ ] **Step 4:** PASS; verificações do fim de entrega; conferir no navegador.
- [ ] **Step 5:** commit `Fase 6.25: a árvore editável e os tipos de unidade` e abrir o PR, com "tem migração 0035" no título.

---

# Entrega 6.26 — Configurações gerais na tela inicial

Branch `fase6-26-configuracoes-gerais`, a partir da 6.25. Sem migração.

### Task 5: o painel geral e as configurações da escala

**Files:** Create `apps/web/src/routes/_app/configuracoes-da-escala.tsx` (as quatro abas de escala); Modify `apps/web/src/routes/_app/configuracoes.tsx` (vira o painel geral), `apps/web/src/lib/modulos.ts` (cartão "Configurações" na tela inicial; o item do trilho de escalas vira "Configurações da escala"), `apps/web/src/routes/_app/minha-ficha.tsx` (sai a preferência da animação), `apps/web/src/routes/_app/index.tsx`; Test `apps/web/src/__testes__/configuracoes*.test.tsx`, `casca.test.tsx`, `minha-ficha.test.tsx`

**Interfaces:**
- Produces: `/configuracoes` = painel geral, com as seções "Minhas preferências", "Estrutura", "Tipos de unidade", "Postos e graduações", "Funções do militar", "Situações do militar", "Tipos de afastamento" e "Quem vê o quê"; `/configuracoes-da-escala` = "Regras do processo", "Voluntariado", "Modelos de guarnição" e "Meta de ativação". `/configuracoes?aba=regras|voluntariado|modelos|meta` redireciona para `/configuracoes-da-escala` com a mesma aba.

- [ ] **Step 1: testes:**
  - O cartão "Configurações" aparece na tela inicial para todos.
  - Militar comum: o painel mostra só "Minhas preferências", e a escolha da animação (sempre, a cada 12 h, nunca) funciona como na 6.14.
  - Auxiliar administrativo: preferências e os catálogos (Postos, Funções, Situações, Tipos de afastamento) só para leitura, e a Estrutura só para leitura.
  - Gestor: também a Estrutura, editável da sua unidade para baixo.
  - Administrador: tudo, inclusive Tipos de unidade e Quem vê o quê.
  - O trilho de escalas tem "Configurações da escala", com as quatro abas e as permissões de hoje.
  - A Minha ficha não tem mais a preferência da animação.
  - O endereço antigo de cada aba leva ao lugar novo.
- [ ] **Step 1b: mudanças do usuário (23/11/2026), com teste:**
  - "Coordenador" é o nome definitivo do quinto nível.
  - Estrutura vira **módulo próprio na tela inicial** (cartão "Estrutura", para quem tem nível de acesso), com a árvore e a aba "Tipos de unidade" (administrador); sai das Configurações gerais e sai o item "Estrutura" do trilho de escalas.
  - Na árvore, a contagem de lotados **acumula** a unidade e todas as de baixo; a dica diz quantos estão na própria unidade ("1 lotado aqui").
  - As Configurações (geral e da escala) usam **menu vertical à esquerda** no lugar das abas; no celular, uma lista de opções no alto.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** PASS; verificações do fim de entrega; conferir no navegador.
- [ ] **Step 5:** commit `Fase 6.26: configurações gerais na tela inicial` e abrir o PR.
