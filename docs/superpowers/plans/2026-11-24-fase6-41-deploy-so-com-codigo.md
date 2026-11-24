# Deploy só quando o código muda (6.41): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um PR que só mexe em documentação não gasta deploy do Vercel; qualquer alteração de código continua fazendo o deploy normal.

**Architecture:** um script `scripts/deploy-so-com-codigo.sh` lista os arquivos mudados desde o último deploy (`VERCEL_GIT_PREVIOUS_SHA`) e sai com 0 (pular) só se todos forem documentos; `vercel.json` chama esse script pela chave `ignoreCommand`.

**Tech Stack:** bash (o script roda no ambiente de build do Vercel), Vercel `vercel.json`.

**Spec:** `docs/superpowers/specs/2026-11-24-deploy-so-com-codigo-design.md`.

## Global Constraints

- Branch `fase6-41-deploy-so-com-codigo`, a partir da `main`. Sem migração. Não se mexe no painel do Vercel nem no plano.
- Regra de "só documento": `docs/**`, `**/*.md`, `docs/telas/**`. Qualquer outro caminho faz deploy.
- Sem `VERCEL_GIT_PREVIOUS_SHA` (primeiro deploy ou referência ausente): deploy.
- Antes do PR: `pnpm test && pnpm typecheck`; e o teste do script (Task 2).
- Este PR contém código (script e `vercel.json`): ele mesmo faz deploy, como qualquer código. Mesclar só com tudo verde, Vercel inclusive.

## Review Focus

1. **PR misto** (documento e código no mesmo commit): deploy, nunca pulado.
2. **Renomear um arquivo de código para `.md`**: conta como documento só se o caminho novo for documento e o antigo também sair do código; o script compara os dois lados, então um arquivo de código removido já é código e faz deploy.
3. **Primeiro deploy sem referência anterior:** deploy, sem erro do script.

---

### Task 1: o script

**Files:** Create `scripts/deploy-so-com-codigo.sh`; Modify `vercel.json` (acrescentar `"ignoreCommand": "bash scripts/deploy-so-com-codigo.sh"`)

**Interfaces:**
- Produces: `scripts/deploy-so-com-codigo.sh` — sem argumentos; lê `VERCEL_GIT_PREVIOUS_SHA`; sai com 0 se todos os arquivos de `git diff --name-only $VERCEL_GIT_PREVIOUS_SHA HEAD` forem de documento (regra da spec); sai com 1 em qualquer outro caso (inclusive sem referência anterior).

- [ ] **Step 1: testes (script, com repositório temporário):** um commit só de `docs/x.md` → exit 0; um commit com `docs/x.md` e `apps/api/src/a.ts` → exit 1; um commit só de `CLAUDE.md` → exit 0; um commit que mexe em `vercel.json` → exit 1; `VERCEL_GIT_PREVIOUS_SHA` vazio → exit 1 (Review Focus 3); arquivo de código removido e outro `.md` criado → exit 1 (Review Focus 2).
- [ ] **Step 2:** FAIL. **Step 3:** implementar o script e acrescentar a chave em `vercel.json`. **Step 4:** PASS. **Step 5:** commit `Fase 6.41: o deploy é pulado quando o PR só mexe em documentação`.

### Task 2: verificação no GitHub

- [ ] **Step 1:** depois do merge da Task 1, abrir um PR só de documentação de teste (pode ser um ajuste de vírgula) e anotar o status que o GitHub dá ao Vercel. Se for "ignorado" (ou equivalente), o caminho vale; se for falha, parar e avisar a PLANEJAMENTO.
- [ ] **Step 2:** conferir que o número de deploys do dia não sobe com esse PR (Vercel `list_deployments`).
- [ ] **Step 3:** commit de registro (sem mudança de código, o próprio PR de teste pode ser fechado): `Fase 6.41: caminho verificado no GitHub`.
