# Entrega 6.23 — Mover o militar pela hierarquia: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** quem tem nível de acesso numa unidade move a lotação de qualquer militar que esteja abaixo dela, em qualquer profundidade, e o sistema registra e mostra quem fez a mudança.

**Architecture:** API em `apps/api/src/cadastros/militares.ts` (`POST /militares/:id/situacao`) e `apps/api/src/acesso.ts`; a lista de destinos (`GET /secoes`); a auditoria que já existe (`auditoria.usuario_id`, gatilho da 0023 no `rastreio`); a ficha (`apps/web/src/componentes/militares/Rastreio.tsx`) e a tela Histórico.

**Tech Stack:** Hono, Postgres (ltree), React, Vitest.

**Spec:** pedido urgente do usuário de 23/11/2026, registrado em `docs/decisoes.md`: "Quem está no nível acima pode mover qualquer um abaixo do seu, na hierarquia. E o rastreio tem que registrar quem moveu."

## Global Constraints

- **Urgente:** a próxima entrega depois da 6.22, antes da 6.17. Branch `fase6-23-mover-pela-hierarquia`, a partir da `main`. Sem migração prevista; se precisar, é a 0035 (a 6.21 passa para a 0036) e o PR leva "tem migração" no título.
- A regra: mudar a lotação pede nível de acesso numa unidade **acima da lotação atual e acima ou na unidade de destino**, em qualquer profundidade (CBMPE, diretoria, grupamento, divisão), nunca só a mãe imediata. Equipe e jornada, com a lotação travada, continuam como hoje. Quem tem nível só na seção continua sem mover a lotação.
- O administrador move qualquer militar.
- Comece pelo `superpowers:systematic-debugging`: reproduza o 403 com o caso do usuário (nível de acesso no CBMPE ou no grupamento, militar numa seção dentro e fora de uma divisão) antes de mudar código, e diga no PR qual era a causa.
- Ative a skill `frontend-design:frontend-design` na parte da tela.
- Antes do PR: `pnpm test && pnpm typecheck && pnpm build:vercel`; conferir no navegador com dados fictícios.

## Review Focus

1. **Seção dentro de uma divisão** (DA ou DivOp): mover de uma divisão para outra, e de seção sem divisão para seção com divisão.
2. **Destino em outro grupamento** sob o mesmo nível de acesso (ex.: nível no CBMPE, de uma SB do 2º GB para uma do 1º GB).
3. **Período aberto já marcado para outra seção** (mudança futura): substituir continua pedindo nível acima das duas.
4. **Auditoria sem autor:** gravação feita sem `app.usuario_id` na transação deixa a linha sem quem fez.
5. **Militar sem lotação hoje** (só período futuro): a regra usa o período aberto.

---

### Task 1: a regra de quem move, em qualquer profundidade

**Files:** Modify `apps/api/src/cadastros/militares.ts` (a rota de situação e `GET /secoes`), `apps/api/src/acesso.ts` se a causa estiver lá; Test `apps/api/test/cadastro-no-tempo.test.ts` (ou um `mover-pela-hierarquia.test.ts` novo)

- [ ] **Step 1: testes:**
  - Nível de gestor no CBMPE: move um militar da 2ª SB para a 1ª SB → 200, e o rastreio novo tem a 1ª SB.
  - Nível no grupamento: move de uma seção da DA para uma da DivOp → 200 (Review Focus 1).
  - Nível no CBMPE: move para uma seção de outro grupamento → 200 (Review Focus 2).
  - Nível de chefe de divisão na DA: move entre duas seções da DA → 200; para uma seção da DivOp → 403.
  - Nível só na seção: mudar a lotação → 403 com a frase de hoje; mudar equipe e jornada → 200.
  - Review Focus 3 e 5.
  - `GET /secoes` lista todas as seções abaixo das unidades em que a pessoa tem nível, de qualquer grupamento, com a sigla do grupamento quando há siglas repetidas ("1ª SB (2º GB)").
- [ ] **Step 2:** rodar; FAIL no caso do usuário.
- [ ] **Step 3:** corrigir a causa encontrada.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `Fase 6.23: quem está acima move o militar em qualquer profundidade`.

### Task 2: quem moveu fica registrado e à vista

**Files:** Modify a rota de situação e as demais que gravam no `rastreio` (conferir que todas fazem a gravação com `app.usuario_id` na transação), `apps/api/src/cadastros/militares.ts` (a ficha devolve o autor de cada período), `pacotes/contratos/src/militares.ts`, `apps/web/src/componentes/militares/Rastreio.tsx`, a tela Histórico; Test os mesmos arquivos de teste, `apps/web/src/__testes__/` da ficha

**Interfaces:**
- Produces: cada período do `rastreio` na ficha ganha `alteradoPor: { patente: string; nomeGuerra: string } | null` e `alteradoEm: string | null` (data e hora, fuso de Recife), tirados da última linha da auditoria daquele período.

- [ ] **Step 1: testes:**
  - Depois de mover, a auditoria do `rastreio` tem o `usuario_id` de quem moveu, na inclusão do período novo e no fechamento do anterior (Review Focus 4). Vale também para a importação do Pecúlio e para o cadastro do militar.
  - A ficha mostra, em cada linha do "Histórico de rastreio", "por {patente} {nome de guerra} em dd/mm/aaaa às hh:mm"; período sem autor (anterior a esta entrega ou carga inicial) não mostra nada.
  - A tela Histórico mostra a mudança de lotação com quem fez.
- [ ] **Step 2:** rodar; FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** PASS; as verificações do fim de entrega.
- [ ] **Step 5:** commit `Fase 6.23: o rastreio registra e mostra quem moveu` e abrir o PR.
