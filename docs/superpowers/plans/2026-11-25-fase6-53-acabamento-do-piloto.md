# Acabamento do piloto (6.53): CNH pela hierarquia, o motivo do passado sem atrito, textos e controles soltos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Modelo: Sonnet** (o padrão, decisão do usuário de 25/11/2026). Revisão final no Opus.

**Goal:** fechar o que o pool do piloto juntou desde a 6.51: o filtro de CNH segue a hierarquia do CTB; o motivo do passado é pedido uma vez por ação; textos e controles que ainda confundem o escalante e o gestor.

**Architecture:** correções pequenas em telas e rotas que já existem, sem tabela nova e sem migração. A hierarquia da CNH já está no domínio (`CNH_HABILITA` em `pacotes/dominio/src/cnh.ts`); a busca passa a usá-la. O motivo do passado continua interceptado em `pedir` (`apps/web/src/api/cliente.ts`, 7.4).

**Tech Stack:** TypeScript, Hono, Postgres (PGlite nos testes), React, TanStack Query, Vitest.

**Spec:** não há spec nova: cada item vem do pool (`docs/superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md`, itens 16, 20 a 24, 26 e 27) e da decisão do usuário de 25/11/2026 sobre a CNH (`docs/decisoes.md`).

## Global Constraints

- Branch `fase6-53-acabamento-do-piloto`, a partir da `main`. Sem migração.
- **CNH (decisão do usuário, 25/11/2026):** o filtro de CNH da pesquisa de militares segue a hierarquia do CTB, a mesma da escala: pedir uma categoria traz quem tem ela ou uma que a habilite. B traz quem tem B, C, D ou E; C traz C, D ou E; D traz D ou E; E traz só E; A traz só A.
- **Importação é contrato:** trocar "Adm" por "ADM" vale só para o texto mostrado na tela e nas mensagens; os nomes de coluna e os valores aceitos na planilha de importação não mudam.
- Textos fixos: "ADM" (nunca "Adm") em todo texto mostrado; o serviço que termina à meia-noite: "{início} às 24:00"; o rótulo do filtro de CNH ganha a ajuda "Inclui quem tem uma categoria que habilita a escolhida."
- Skill `frontend-design:frontend-design` nas mudanças de tela; componentes e tokens da 6.20.
- Antes de enviar: `pnpm test && pnpm typecheck && pnpm build:vercel`. Enviar a branch uma vez só, no fim.

## Review Focus

1. **"Trocar militar" num turno passado:** o motivo é pedido uma vez; as duas linhas do registro (quem saiu e quem entrou) levam o mesmo motivo; cancelar no meio não deixa a vaga vazia sem aviso (Task 2).
2. **Dois pedidos de motivo ao mesmo tempo** (clique duplo, ou duas telas): o primeiro é cancelado em silêncio e só o segundo fica aberto; nenhuma promessa fica pendurada (Task 2).
3. **Filtro com A e B juntos:** traz quem tem A ou quem tem qualquer categoria que habilite B; militar só com A não aparece no filtro B (Task 1).
4. **Fim "00:00" no "Outro horário" do voluntariado:** aceito como 24:00, em qualquer início do dia; início e fim iguais continuam recusados (Task 4).
5. **Gestor de outra unidade nas Configurações da escala:** vê os blocos do voluntariado e os militares de outras unidades sem poder ligar nem desligar; nenhuma chamada sai para a API levar 403 (Task 4).

---

### Task 1: o filtro de CNH pela hierarquia (pool 23c)

**Files:** Modify `pacotes/dominio/src/cnh.ts`, `apps/api/src/visao/busca.ts:80`, o campo de CNH da pesquisa em `apps/web/src/` (a tela "Pesquisar militares" da 6.51); Test `pacotes/dominio/test/cnh*.test.ts`, `apps/api/test/` (o teste da busca da 6.51)

**Interfaces (Produces):** `categoriasQueHabilitam(pedidas: string[]): string[]` em `dominio`: as categorias cuja lista em `CNH_HABILITA` contém alguma das pedidas. `['B'] → ['B','C','D','E']`; `['A'] → ['A']`; `['E'] → ['E']`.

- [ ] **Step 1: testes:** `categoriasQueHabilitam` com os casos das Global Constraints; a busca com `cnh: ['B']` traz o militar que só tem E e não traz o que só tem A; com `cnh: ['C']` não traz o que só tem B; Review Focus 3; a tela mostra a ajuda fixa sob o filtro.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (a busca troca `r.cnh` por `categoriasQueHabilitam(r.cnh)` no `&&`). **Step 4:** PASS. **Step 5:** commit `Fase 6.53: o filtro de CNH segue a hierarquia`.

### Task 2: o motivo do passado, uma vez por ação (pool 26)

**Files:** Modify `apps/web/src/api/cliente.ts`, `apps/web/src/componentes/JustificarPassado.tsx`, `apps/web/src/routes/_app/escala-do-mes.tsx` (o "Trocar militar"), `apps/web/src/componentes/escala-do-mes/EstadoDaEscala.tsx` (o aviso), `apps/web/src/routes/_app/efetivo-por-dia.tsx`; Test `apps/web/src/__testes__/justificar-passado.test.tsx`, `apps/web/src/__testes__/escala-do-mes*.test.tsx`

- [ ] **Step 1: testes:**
  - (a) "Trocar militar" num turno passado abre o diálogo uma vez; a chamada de escalar sai já com o motivo digitado na de tirar; cancelar o diálogo não tira ninguém (Review Focus 1).
  - (b) um segundo 400 de motivo com o diálogo aberto rejeita o primeiro pedido com `Cancelado` e abre o segundo (Review Focus 2).
  - (c) o aviso "Esta escala está publicada. Ela ficou em retificação até o gestor republicar." aparece só quando a retificação veio de uma gravação feita nesta tela; quando chega por uma nova leitura (outra pessoa mexeu), só a etiqueta acende.
  - (d) uma mudança pelo Efetivo por dia recarrega a lista "Alterações no passado".
  - (e) o "Republicar" leva a escala de "em retificação" a "Retificada"; depois de "Lançar prévia", uma mudança em dia passado abre o diálogo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Para (a), a troca leva adiante o motivo aceito na primeira chamada: `pedir` aceita a justificativa já conhecida no corpo e não abre o diálogo quando ela vem. **Step 4:** PASS. **Step 5:** commit `Fase 6.53: o motivo do passado é pedido uma vez`.

### Task 3: textos (pool 16, 27a e 27b)

**Files:** Modify `apps/api/src/escala/elegibilidade.ts:179` ("Saldo só para militar do ADM"), os rótulos das Configurações da escala, as mensagens da importação do Pecúlio (só o texto, não as colunas), `apps/web/src/routes/_app/minha-escala.tsx:22`, a unidade dos serviços na Minha escala; Test os testes que já conferem esses textos

- [ ] **Step 1: testes:** nenhum texto mostrado contém "Adm" com essa grafia (um teste de varredura nas mensagens da API e no site, como o da 6.46 na Grade); o serviço das 16:00 que termina à meia-noite mostra "16:00 às 24:00", e o das 20:00 às 08:00 continua "20:00 até 08:00 do dia seguinte"; na Minha escala, a unidade com sigla repetida mostra a unidade de cima ("1ª SB, em DivOp"), com a mesma regra da lista de Escalas (7.5).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.53: ADM, 24:00 e a unidade na Minha escala`.

### Task 4: controles soltos (pool 20, 21 e 22)

**Files:** Modify `apps/web/src/componentes/voluntariado/OutroHorario.tsx` (e a validação do horário em `pacotes/contratos`, se o fim "00:00" for recusado lá), as Configurações da escala › Voluntariado, o Pecúlio da unidade (filtro de lotação e "Abrir a ficha completa"); Test os arquivos de teste dessas telas

- [ ] **Step 1: testes:**
  - (20) a linha de "Outro horário" só com o início mostra o erro no campo; o fim "00:00" é aceito como 24:00 (Review Focus 4).
  - (21) o gestor de outra unidade vê os blocos do voluntariado e os militares de outras unidades desligados, sem chamada à API (Review Focus 5), com a mesma regra "gestor na unidade" da 6.49.1; "Ainda não vale" com a fonte da tela.
  - (22) com "Incluir as unidades de baixo" desligado, o filtro de lotação oferece só a unidade; "Abrir a ficha completa" na ficha de consulta leva à ficha completa, não à mesma página.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** commit `Fase 6.53: horário até 24:00, voluntariado só de quem é gestor e o filtro do Pecúlio`.

### Task 5: a atualização em lote (pool 24)

**Files:** Modify a rota da atualização em lote da 6.52 em `apps/api/src/` e a tela dela em `apps/web/src/`; Test os testes da 6.52

- [ ] **Step 1: testes:** (b) a prévia mostra a equipe como está cadastrada ("Alfa"), mesmo digitada "alfa"; (c) a assinatura da prévia guarda o "de" e o "para": se alguém mudar o militar entre a prévia e o aplicar, o aplicar recusa como já recusa hoje pelo "para"; (d) depois de aplicar, a ficha do militar é lida de novo (sem dado velho).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. (a) medir o tempo da prévia e do aplicar com 500 militares fictícios no PGlite e dizer no resumo; se passar de 10 s, agrupar as consultas por unidade antes de enviar. **Step 4:** PASS; as verificações do fim de entrega. **Step 5:** commit `Fase 6.53: o lote com a equipe cadastrada, a assinatura inteira e a ficha relida` e enviar a branch à PLANEJAMENTO.
