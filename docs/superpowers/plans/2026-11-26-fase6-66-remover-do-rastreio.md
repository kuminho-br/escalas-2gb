# Remover uma mudança do histórico de rastreio (6.66) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** o gestor remove da linha do tempo da ficha a mudança que ainda não vale; o administrador remove qualquer linha. Sempre com motivo, registrado com quem removeu.

**Architecture:** a remoção apaga a linha de `rastreio` e grava, na mesma transação, um registro em `registro_de_alteracao` (0044, só de acréscimo), que já tem quem, a unidade, o militar, o `antes` e a `justificativa`. Uma migração só troca o CHECK desse registro para aceitar o tipo novo `rastreio_removido`. Não se mexe na função de auditoria das outras tabelas. (Decidido pela PLANEJAMENTO em 26/11, a pedido da DESENVOLVIMENTO: a auditoria não tem onde guardar o motivo.)

**Tech Stack:** Hono, Postgres/PGlite, zod (`contratos`), React, TanStack Query, Vitest.

**Spec:** decisão do usuário de 26/11/2026 em `docs/decisoes.md` (quem remove do rastreio); pool, item 46.

## Global Constraints

- Branch `fase6-66-remover-do-rastreio`, a partir da `main`. **Migração `0050`**: aplicar no banco de teste só com autorização do usuário (o merge a aplica).
- **Regra** (decisão do usuário de 26/11/2026):
  - quem tem nível de gestão na unidade do registro (`GESTAO`, na unidade ou acima) remove só a linha que **ainda não vale** (início depois de hoje, Recife);
  - o administrador (`ehAdministrador`) remove **qualquer** linha;
  - sempre com o motivo (1 a 200 caracteres), guardado em `registro_de_alteracao.justificativa`, com quem removeu;
  - a linha que não pode ser removida não mostra o botão, e a API responde 403 com "Só o administrador remove uma mudança que já vale." (gestor numa linha que já vale) ou "Você não tem nível de acesso para remover esta mudança." (sem nível);
  - a única linha que cobre hoje não se remove: 400 "Esta é a situação de hoje: altere em vez de remover." (decidido pela PLANEJAMENTO);
  - textos da tela: botão "Remover" na linha; janela "Remover esta mudança?" com o campo "Motivo" e os botões "Remover" e "Cancelar".
- A migração `0050_rastreio_removido.sql` só troca o CHECK de `registro_de_alteracao.tipo` (aceita também `rastreio_removido`) e a regra da justificativa: de 1 a 200 caracteres para o tipo novo; a de `escala_no_passado` continua a mesma. Nada mais.
- Nenhum dado pessoal real em repositório, teste ou CI (matrículas `990xxx-x`). Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **Gestor tenta remover pela API uma linha que já vale:** 403 com a frase fixa, e nada muda (nem a linha, nem o registro).
2. **Remoção que falha no meio:** a linha e o registro voltam juntos (uma transação).
3. **O registro é de acréscimo:** a remoção do rastreio aparece no histórico de exceções com o `antes` completo da linha.
4. **Migração em banco que já tem registros:** os registros antigos continuam válidos.

---

### Task 1: a migração, a rota e a tela

**Files:** Create a rota de remoção junto das rotas que gravam o rastreio (ler `apps/api/src/cadastros/alterar-situacao.ts` e `apps/api/src/cadastros/militares.ts` para achar a tabela e o padrão); Modify `apps/web/src/componentes/militares/Rastreio.tsx`, `pacotes/contratos/src/militares.ts` (o corpo `{ motivo }`); Test `apps/api/test/rastreio-remover.test.ts` e o teste do rastreio no site

**Interfaces (Produces):** `DELETE /api/militares/:id/rastreio/:registroId` com corpo `{ motivo: string }` → 204; as regras e as frases das Global Constraints; a resposta da ficha passa a dizer, por linha, `podeRemover: boolean`.

- [ ] **Step 1: testes (inclui os Review Focus 1 a 4):** gestor remove a linha que ainda não vale; gestor numa linha que já vale: 403 com a frase (Review Focus 5); administrador remove uma linha passada; sem nível: 403; a única linha que cobre hoje: 400; sem motivo ou com 201 caracteres: 400; o registro em `registro_de_alteracao` guarda quem removeu, o motivo e a linha apagada; `podeRemover` certo por linha e por conta; na tela, o botão só onde pode, a janela com o motivo, e a linha some depois de remover.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; as verificações do fim de entrega; conferir no navegador em 1440 e 390 px: o Pecúlio da unidade como administrador, o lote mantendo a seleção, as placas com o caminho e remover uma mudança marcada para dezembro. **Step 5:** commit `Fase 6.66: remover uma mudança do histórico de rastreio` e enviar a branch à PLANEJAMENTO.
