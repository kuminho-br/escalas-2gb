# Revisão geral da documentação — 24/11/2026

Pedido do usuário (24/11/2026), depois do aviso da PLANEJAMENTO sobre o choque de horário universal (6.37 e 6.38). Feita pela DOCUMENTAÇÃO sobre a `main` no commit `4269d08`, pela régua de `docs/LEIAME.md` e por leitura. Quem cuida: DOCUMENTAÇÃO.

## Resumo

- A checagem tinha 30 alertas (eram 12 em 21/11). Depois das correções desta revisão, 27. O `CLAUDE.md` voltou a "bom".
- Os documentos novos da fase 6 (specs, planos, decisões, roadmap) estão em dia e no índice.
- **O que ficou para trás são os documentos de negócio:** o catálogo de regras, o glossário e os casos de uso não acompanharam as decisões de 22 a 24/11, salvo o choque universal.
- Quatro documentos passaram do tamanho: o registro de decisões (42 KB), o esquema do banco (43 KB), as telas (25 KB) e o roadmap, encostado no limite.

## Corrigido nesta revisão

| Onde | O quê |
|---|---|
| `negocio/regras/carga-expediente-choques.md` | RN-18 passa a dizer que o parâmetro é o total da barra da cota de saldo (6.38), não da distribuição de saldos, que saiu do plano; RN-25 com a 6.38 já feita; data da revisão no cabeçalho |
| `negocio/regras/sistema-e-interface.md` | RN-32 (militar externo) passa de "fase 5, nada usa" a "Funciona (6.33 e 6.36)", com quem traz, onde aparece e o que o auxiliar pode |
| `LEIAME.md` | Situação "concluído" para os planos das fases 4 e 5 e as specs da meta de ativação e da grade geral; os dois mockups citados pelo caminho completo; o limite de 25 KB dito em bytes (25.600), como o script mede |
| `ferramentas/checar-documentacao.sh` | Caminho de modelo com `<…>` (ex.: `docs/ideias/<tema>.md`) não conta mais como caminho quebrado no `CLAUDE.md` |

## O que pede ação

Em ordem de prioridade. Cada item traz alternativas e a recomendação.

### 1. Documentos de negócio atrasados frente à fase 6

Desde 21/11, só a 6.37 mexeu no catálogo e no glossário. Ficaram de fora, entre outras, estas decisões:

- níveis de acesso no lugar de papéis, com o quinto nível (coordenador) e as camadas de visão (todos, oficial, chefe de divisão);
- a árvore genérica (CBMPE, divisões DA e DivOp, tipos de unidade em cadastro, militar lotado em qualquer unidade);
- a escala dos oficiais como escala comum (rodada de cotas, JES e Saldo, dias vermelhos, memorial de cálculo);
- a escala prévia e quem altera o passado, que responde a P-17 e tira a RN-85 de "A esclarecer";
- o Pecúlio como origem dos dados (a importação só exige a matrícula) e a Consulta de militares;
- a ficha da escala: "Habilitações" no lugar de "Motorista"; o voluntário JES, a equipe e a jornada só a SP edita.

O que isso causa: quem perguntar uma regra pelo catálogo recebe a resposta de 21/11. Os casos de uso ainda falam em quatro "papéis" e não têm o coordenador. O glossário ainda descreve o protótipo (abas, colunas e cartões B/P em 35 linhas).

- **(a) Segunda conferência completa, como a de 21/11 (recomendada).** Catálogo, casos de uso e glossário de uma vez, com as regras novas a partir da RN-117. Fica de fora só o que a 6.40 (em execução) muda: RN-13, RN-20, RN-22, RN-38, RN-91, RN-102 e RN-103, para depois do merge dela.
- (b) Só o catálogo agora e o glossário depois. É mais rápido, mas o glossário continua do protótipo e já está no limite de tamanho.
- (c) Esperar o fim da fase 6. Os documentos ficam errados até lá, justamente durante o piloto.

O glossário, na opção (a), seria reescrito na linguagem do sistema novo, sem abas nem cartões do protótipo. Ele cabe em 25 KB se os termos técnicos e o histórico saírem para o git.

### 2. A 6.40 muda o sentido da ordem de escalação

A spec da 6.40 diz que a pré-escala deixa de pôr militares nas vagas: põe só nos turnos, e o escalante distribui à mão. Hoje a RN-102 (ordem de escalação) e a RN-103 (o mais antigo apto em cada vaga) existem para a pré-escala preencher as vagas. Depois da 6.40, a tela "Ordem de escalação" fica sem quem a use.

**Pergunta para a PLANEJAMENTO, antes da conferência:** a ordem de escalação continua (para a automação da fase 8) ou sai? A resposta decide se a RN-102 e a RN-103 ficam "para a fase 8" ou vão para "Regras que saíram".

### 3. Registro de decisões com 42 KB

O desenho da síntese (`specs/2026-11-20-sintese-design-e-roadmap-design.md`) previa dividi-lo acima de 25 KB.

- **(a) Um arquivo por fase, com `decisoes.md` como índice (recomendada).** As fases 0 a 4 numa pasta `docs/decisoes/` e a fase em andamento no arquivo principal. Quem procura uma decisão antiga sabe a fase pelo roadmap.
- (b) Um arquivo por semana. É simples de cortar, mas não diz nada a quem procura.
- (c) Manter um arquivo só. Ele cresce cerca de 10 KB por dia nesta fase.

Ele é editado em quase todo PR. A divisão precisa de uma janela sem branch aberta mexendo nele, combinada com a PLANEJAMENTO.

### 4. Roadmap encostado no limite

O roadmap tem 24.936 bytes. A seção "Pendências conhecidas" ocupa cerca de 130 das 330 linhas e é uma lista de trabalho, não o mapa.

- **(a) Levar "Pendências conhecidas" para `docs/pendencias.md` (recomendada).** O roadmap volta a ser só o mapa e fica bem abaixo do limite.
- (b) Continuar sintetizando as fases concluídas a cada vez. Resolve por pouco tempo: hoje ele passou do limite duas vezes.

### 5. Esquema do banco com 43 KB e 11 tabelas sem título

Tabelas sem título: `convite`, `dia_vermelho`, `funcao_militar`, `lotacao` e as sete `oficiais_*`. A última migração citada também não é a `0042`. O documento é da DESENVOLVIMENTO.

- **(a) Dividir por assunto (recomendada):** pessoas, estrutura e acesso; escala; oficiais. Os títulos que faltam entram junto.
- (b) Só acrescentar os títulos. O documento passa de 45 KB e se aproxima do crítico (50 KB).

### 6. Telas com 25 KB e 13 parágrafos longos

A spec de telas é de 16/11, e a refatoração da interface e o sistema de estilo (23/11) mudaram boa parte dela. Proposta para a DESIGN e a PLANEJAMENTO: marcar, em cada seção, o que vale e o que foi substituído, e levar o que vale para as specs novas. Assim a spec de telas pode virar "superado".

### 7. Parágrafos longos nas specs novas

Há parágrafos longos nas specs de 23 e 24/11: choque universal (2), oficiais como escala comum (2), tela de escalar dos oficiais (1) e pré-escala nos turnos (1). São poucos. A recomendação é a PLANEJAMENTO quebrá-los na próxima vez que mexer em cada uma. As specs concluídas não precisam ser revistas.

### 8. Tabela de sessões do `CLAUDE.md`

Hoje existem sessões SAC e MISSÕES PARALELAS, que não estão na tabela, e a tabela tem DÚVIDAS, que não aparece mais entre as sessões abertas. **Pergunta ao usuário:** a SAC substituiu a DÚVIDAS? A MISSÕES PARALELAS entra na tabela?

### 9. A conferir pela DESENVOLVIMENTO

O cadastro de serviço ainda tem a coluna `operacao` (`apps/api/src/cadastros/servicos.ts`). A RN-83 e a decisão de 18/11 dizem que a diária é o próprio serviço e que não há campo "operação". Ou a coluna é resto sem uso, ou a regra precisa mudar.

### 10. Branches

- `docs-manual-tela-inicial` e `docs-numeros-das-migracoes` estão sem merge, mas são recentes.
- `docs-ignorar-planilhas-de-dados` (da DOCUMENTAÇÃO) manda o git ignorar planilhas, para o Pecúlio real não entrar no repositório. Ela está pronta só nesta máquina e vai à PLANEJAMENTO junto com esta revisão.
