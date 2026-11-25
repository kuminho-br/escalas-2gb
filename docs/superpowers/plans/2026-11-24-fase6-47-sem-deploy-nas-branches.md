# Sem deploy nas branches dos PRs (6.47): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo:** Sonnet (configuração); revisão final no Opus.

**Goal:** o Vercel não cria deploy nenhum nas branches dos PRs; só a `main` faz deploy.

**Por quê:** a 6.43 faz o build da prévia ser pulado (`ignoreCommand`), mas o Vercel **cria o deploy antes** de rodar o script, e esse deploy conta no limite de 100 por dia. Em 24/11/2026, depois da 6.43, os PRs #220, #222 e #223 tiveram a prévia recusada por limite ("Deployment rate limited"). Completa a decisão do usuário de 24/11: desligar as prévias dos PRs.

**Architecture:** a chave `git.deploymentEnabled` do `vercel.json` (no repositório; nada no painel nem no plano do Vercel), ligando o deploy só na `main`. O `ignoreCommand` da 6.41 continua para a `main` (pula o deploy de merge só de documentação).

**Tech Stack:** Vercel `vercel.json`.

## Global Constraints

- Branch `fase6-47-sem-deploy-nas-branches`, a partir da `main`. Sem migração.
- **Conferir a sintaxe na documentação do Vercel** antes de escrever (`git.deploymentEnabled` com um objeto de branches; como "main" e o curinga se combinam). Não chutar: um erro aqui desliga o deploy da `main`.
- A regra de merge da PLANEJAMENTO passa a ser: `testes` verdes (com o `build:vercel` do CI); depois do merge, o deploy de produção do commit mesclado conferido antes de migrar ou mandar roteiro. Os PRs deixam de ter a verificação do Vercel.
- Este PR ainda vai tentar uma prévia (a regra só vale depois do merge); se ela vier recusada por limite, a PLANEJAMENTO mescla com `testes` verdes, porque é exatamente o que este PR corrige.

## Review Focus

1. **A `main` continua fazendo deploy** depois do merge (o primeiro merge seguinte de código prova isso).
2. **Merge só de documentação na `main`** continua sendo pulado pela 6.41.

### Task 1

**Files:** Modify `vercel.json`; Modify `docs/` só se a regra de deploy estiver escrita em algum documento (a decisão de 24/11 em `docs/decisoes.md` ganha a linha nova)

- [ ] **Step 1:** ler a documentação do `git.deploymentEnabled` e escrever no PR o trecho que confirma a combinação usada.
- [ ] **Step 2:** acrescentar a chave em `vercel.json` (deploy só na `main`).
- [ ] **Step 3:** `pnpm test && pnpm typecheck` (o teste do script da 6.41/6.43 continua passando).
- [ ] **Step 4:** commit `Fase 6.47: o Vercel não cria deploy nas branches dos PRs` e enviar a branch à PLANEJAMENTO, uma vez só.
