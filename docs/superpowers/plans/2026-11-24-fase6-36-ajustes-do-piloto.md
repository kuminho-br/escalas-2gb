# Ajustes do piloto (6.36): RG funcional, a Grade sem Voluntariado e o militar externo nas configurações — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** três pedidos do usuário de 24/11/2026: o campo RG funcional nos dados pessoais, a Grade geral sem a coluna Voluntariado, e o militar externo trazido em Configurações da escala > Voluntariado e lançado à mão em qualquer serviço.

**Architecture:** uma coluna nova no militar (migração 0041), lida e gravada como os outros dados pessoais (do Pecúlio, restritos); a coluna da Grade sai; as rotas de `/api/unidades/:u/externos` (6.33) ganham uma tela própria nas configurações da escala, e a avaliação dos candidatos deixa de recusar o externo fora dos serviços extras.

**Tech Stack:** Postgres, Hono, zod, React, TanStack Query, Vitest.

**Spec:** este plano (pedidos curtos, sem spec à parte) e `docs/superpowers/specs/2026-11-24-ficha-da-escala-e-militar-externo-design.md` (parte 3, que esta entrega atualiza).

## Global Constraints

- Branch `fase6-36-ajustes-do-piloto`, a partir da `main`. **Tem migração: 0041**; o PR leva "tem migração" no título.
- Ative a skill `frontend-design:frontend-design` e use os componentes da 6.20 e a resposta do sistema da 6.21 (aviso, confirmação).
- Textos fixos: rótulo "RG funcional"; ajuda do campo "Registro geral do militar nos órgãos estaduais de segurança pública."; recusa "Este RG funcional já é de {nome de guerra}."; seção "Militares de outras unidades"; busca "Buscar militar de outra unidade por nome ou matrícula"; botões "Trazer" e "Tirar"; confirmação "Tirar {patente} {nome} da escala de {sigla}? Os serviços já lançados ficam."; vazio "Nenhum militar de outra unidade na escala de {sigla}.".
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios (nenhum RG real).

## Review Focus

1. **RG funcional repetido** em dois militares: 409 no campo, com o nome de guerra do outro; nunca erro de banco.
2. **Quem não vê os dados restritos** (o auxiliar): a chave `rgFuncional` nem sai na ficha, como o CPF.
3. **Externo numa vaga de Pronto lançada à mão:** aceito; e a pré-escala do mês continua sem pô-lo.
4. **Busca de militar de outra unidade** que já está lotado na unidade (ou numa de baixo): aparece sem o botão "Trazer", com "Já é desta unidade.".
5. **A Grade em 1440 px** sem a coluna: PJES e Diárias continuam presas à direita, sem buraco.

---

### Task 1: RG funcional

**Files:** Create `apps/api/banco/migracoes/0041_rg_funcional.sql`; Modify `apps/api/src/cadastros/militares.ts` (`CAMPOS_DO_PECULIO`, leitura da ficha com `veDadosRestritos`, gravação, 409), `pacotes/contratos/src/militares.ts` (`FichaMilitar.rgFuncional?: string | null`, `EdicaoMilitar.rgFuncional`), `apps/web/src/componentes/militares/DadosPessoais.tsx`; Test `apps/api/test/militares.test.ts`, `apps/web/src/__testes__/militares.test.tsx`

- Migração: `militar.rg_funcional text` (sem espaços nas pontas, 1 a 20 caracteres, letras, números, ponto e hífen), único quando preenchido (índice parcial). A auditoria segue o gatilho de hoje da tabela `militar`.
- Campo opcional; `null` limpa.

- [ ] **Step 1: testes:** a SP grava e lê o RG funcional; o auxiliar não recebe a chave e recebe 403 ao gravar; RG repetido → 409 com a frase fixa (Review Focus 1); texto com caractere fora do permitido → 400 no campo; na ficha do Pecúlio, o campo aparece em Dados pessoais com o rótulo e a ajuda fixos.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.36: RG funcional nos dados pessoais`.

### Task 2: a Grade geral sem a coluna Voluntariado

**Files:** Modify `apps/web/src/componentes/grade/TabelaDaGrade.tsx` (sai a entrada de `COLUNAS_FINAIS` e as células; PJES passa a `right-16`, Diárias a `right-0`), e a API da Grade se o campo `horasTiradas`/`horasPedidas` só servir a essa coluna (conferir antes de tirar); Test `apps/web/src/__testes__/grade*.test.tsx`

- [ ] **Step 1: testes:** o cabeçalho da Grade não tem "Voluntariado"; PJES e Diárias continuam as últimas colunas (Review Focus 5).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.36: sai a coluna Voluntariado da Grade geral`.

### Task 3: o militar externo nas configurações e em qualquer serviço à mão

**Files:** Modify `apps/web/src/routes/_app/configuracoes-da-escala.tsx` (aba Voluntariado ganha a seção), Create `apps/web/src/componentes/configuracoes/MilitaresDeOutrasUnidades.tsx`; Modify `apps/web/src/routes/_app/consulta_.$id.tsx` (saem os botões de trazer e tirar), `apps/api/src/escala/elegibilidade.ts` (sai o motivo "Externo só em serviço extra"); Test `apps/api/test/externos.test.ts`, `apps/api/test/elegibilidade*.test.ts`, `apps/web/src/__testes__/configuracoes.test.tsx`

**Interfaces:** Consumes: `GET/POST/DELETE /api/unidades/:u/externos` (6.33) e a busca que a tela Consulta já usa.

- Na aba Voluntariado, abaixo dos blocos: a lista dos externos vigentes (patente, nome, matrícula, "lotado em {sigla}", desde), com "Tirar" para o gestor; a busca por nome ou matrícula, com "Trazer" em cada resultado de outra unidade. O auxiliar vê a lista, sem busca e sem botões.
- Elegibilidade: o externo vigente passa a ser candidato em qualquer serviço lançado à mão, inclusive Pronto, Saldo e Expediente, com as regras de todos (afastamento, CNH, voluntário JES no JES e no PJES, choque e descanso em todas as unidades). O voluntariado marcado continua dispensado. A pré-escala e qualquer distribuição automática continuam sem ele.

- [ ] **Step 1: testes:** o gestor busca, traz e tira pela aba Voluntariado, com a confirmação fixa e o aviso; o auxiliar vê a lista e nenhum botão; militar da unidade na busca aparece com "Já é desta unidade." (Review Focus 4); a Consulta não tem mais os botões; externo é candidato e é aceito numa vaga de Pronto à mão (Review Focus 3); a pré-escala com externo vigente não o põe.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador como gestor e como auxiliar. **Step 5:** commit `Fase 6.36: o militar externo nas configurações da escala e em qualquer serviço à mão` e enviar a branch à PLANEJAMENTO.
