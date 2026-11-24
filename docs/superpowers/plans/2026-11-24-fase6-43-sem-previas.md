# Sem prévias de PR no Vercel (6.43): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (não é front-end); revisão final no Opus.

**Goal:** só a `main` faz deploy no Vercel (o site de teste); os PRs deixam de gerar prévias, que ninguém usa (a VALIDAÇÃO testa no site de teste).

**Architecture:** o script da 6.41 (`scripts/deploy-so-com-codigo.sh`, o `ignoreCommand` do `vercel.json`) passa a pular sempre que `VERCEL_ENV` for `preview`; em produção, segue a regra de hoje (pula só quando o que mudou é documentação).

**Tech Stack:** bash, Vercel `ignoreCommand`.

**Decisão do usuário (24/11/2026):** o ritmo de entregas estourou o limite de 100 deploys por dia; cortar os deploys desligando as prévias dos PRs. O CI já roda `pnpm build:vercel` em todo PR (`.github/workflows/ci.yml`), então o build continua conferido antes do merge.

## Global Constraints

- Branch `fase6-43-sem-previas`, a partir da `main`. Sem migração. Nada no painel nem no plano do Vercel.
- `VERCEL_ENV=preview` → exit 0 (pula), com a mensagem "Prévia de PR: o deploy é pulado (só a main faz deploy)."; `VERCEL_ENV` vazio ou `production` → a regra da 6.41, sem mudança.
- **Regra de merge nova** (para a PLANEJAMENTO): `testes` verdes (inclui o `build:vercel`) e o status do Vercel no PR "ignorado"; depois do merge, conferir o deploy de produção do commit mesclado antes de migrar ou mandar roteiro.
- Este PR ainda gera a prévia dele (o script novo só vale depois do merge).

## Review Focus

1. **Produção nunca é pulada por engano:** `VERCEL_ENV=production` com código mudado faz deploy.
2. **Variável ausente** (build local, outro ambiente): segue a regra da 6.41, não pula tudo.

---

### Task 1: o script

**Files:** Modify `scripts/deploy-so-com-codigo.sh`, `scripts/testar-deploy-so-com-codigo.mjs`

- [ ] **Step 1: testes:** `VERCEL_ENV=preview` com código mudado → exit 0; `VERCEL_ENV=production` com código mudado → exit 1 (Review Focus 1); `VERCEL_ENV=production` só com documentação → exit 0; sem `VERCEL_ENV` → a regra da 6.41 (Review Focus 2); os 13 casos de hoje continuam passando.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck`. **Step 5:** commit `Fase 6.43: os PRs não geram prévia no Vercel; só a main faz deploy` e enviar a branch à PLANEJAMENTO.
