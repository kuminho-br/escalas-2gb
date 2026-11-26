# Documentação do projeto

Índice dos documentos do Sistema de Escalas 2º GB: o que é cada um, quem cuida e se ainda vale. Quem cuida deste índice é a sessão de DOCUMENTAÇÃO.

## Como a documentação está organizada

- **O repositório é a versão oficial** de todos os documentos. O que existia só no claude.ai (catálogo de regras, glossário, diagrama de atividades, ER da meta de ativação) foi trazido em 20/11/2026 e passa a ser editado aqui.
- Cada documento tem **um lugar só** e **um dono** (coluna "Quem cuida").
- Documento novo entra neste índice no mesmo PR que o cria.
- **Sem adendos** (desde 20/11/2026): a mudança vai direto no texto do documento, que diz como as coisas estão hoje, e a decisão ganha uma linha em [decisoes.md](decisoes.md) no mesmo PR. O histórico fica no registro e no git.
- A situação diz se o documento vale: `vigente`, `em execução`, `concluído` (descreve algo já feito; serve de histórico), `superado` (não usar) ou `rascunho`.

## Para começar

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [CLAUDE.md](../CLAUDE.md) | Instruções para toda sessão: onde está cada coisa, como trabalhar, papéis, princípios | DOCUMENTAÇÃO | vigente |
| [prototipo/CLAUDE.md](../prototipo/CLAUDE.md) | Regras do clasp e da planilha, só para quem mexe no protótipo | DOCUMENTAÇÃO | vigente |
| [casos/LEIAME.md](../casos/LEIAME.md) | Casos gravados do protótipo, referência do motor | DESENVOLVIMENTO | vigente |

## Negócio

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [negocio/regras/LEIAME.md](negocio/regras/LEIAME.md) | Catálogo de regras (RN-XX), dividido por assunto (o LEIAME da pasta lista os arquivos); segunda conferência em 25/11/2026 | DOCUMENTAÇÃO | vigente |
| [negocio/glossario.md](negocio/glossario.md) | Termos do domínio na linguagem do sistema novo (reescrito em 25/11/2026) | DOCUMENTAÇÃO | vigente |
| [negocio/glossario-pendencias.md](negocio/glossario-pendencias.md) | Perguntas em aberto do glossário (G1 a G9) e divergências | DOCUMENTAÇÃO | vigente |
| [negocio/processo-do-mes.md](negocio/processo-do-mes.md) | Diagrama de atividades do mês, do formulário à escala executada | DOCUMENTAÇÃO | rascunho (E1 a E7 em aberto) |

## Sistema

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [decisoes.md](decisoes.md) | Registro de decisões da fase em andamento: uma linha por decisão, da mais nova para a mais velha, com onde está o resultado | PLANEJAMENTO | vigente |
| [decisoes/fases-0-a-4.md](decisoes/fases-0-a-4.md), [decisoes/fase-5.md](decisoes/fase-5.md) e [decisoes/fase-7.md](decisoes/fase-7.md) | Decisões das fases já fechadas (fases 0 a 5, de 16 a 21/11/2026; fase 7, de 24 e 25/11/2026) | PLANEJAMENTO | concluído |
| [superpowers/specs/2026-11-16-migracao-design.md](superpowers/specs/2026-11-16-migracao-design.md) | Como o sistema é pensado hoje: decisões técnicas (D1 a D7), atores, cadastros, montagem da escala e módulos | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-16-esquema-banco.md](superpowers/specs/2026-11-16-esquema-banco.md) | Esquema do banco: diagrama ER e uma seção por tabela | DESENVOLVIMENTO | vigente (em dia até a migração 0022) |
| [superpowers/specs/2026-11-16-telas.md](superpowers/specs/2026-11-16-telas.md) | Identidade visual, navegação e cada tela | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md](superpowers/specs/2026-11-18-ordem-de-escala-e-acumulo-design.md) | Ordem de escala e acúmulo de funções | PLANEJAMENTO | concluído |
| [superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md](superpowers/specs/2026-11-19-voluntariado-por-faixa-design.md) | Voluntariado por faixa de horário, com 4 adendos | PLANEJAMENTO | concluído (a consolidar) |
| [superpowers/specs/2026-11-20-meta-de-ativacao-design.md](superpowers/specs/2026-11-20-meta-de-ativacao-design.md) | Meta de ativação e Efetivo do dia | PLANEJAMENTO | concluído |
| [superpowers/specs/2026-11-20-grade-geral-design.md](superpowers/specs/2026-11-20-grade-geral-design.md) | Grade geral (entrega 4) | PLANEJAMENTO | concluído |
| [superpowers/specs/2026-11-20-grade-geral-ux-design.md](superpowers/specs/2026-11-20-grade-geral-ux-design.md) | Ajustes de interface da grade geral | PLANEJAMENTO | concluído |
| [casos-de-uso.md](casos-de-uso.md) | Quem pode fazer o quê: os módulos, a matriz e um diagrama para o militar comum e cada nível de acesso (auxiliar, gestor, coordenador, administrador) | DOCUMENTAÇÃO | vigente (conferido em 25/11/2026) |
| [superpowers/specs/2026-11-20-sintese-design-e-roadmap-design.md](superpowers/specs/2026-11-20-sintese-design-e-roadmap-design.md) | Intervenção para sintetizar o design e o roadmap | DOCUMENTAÇÃO (desenho); PLANEJAMENTO (execução) | vigente |
| [superpowers/specs/2026-11-20-limpeza-da-fase-3-design.md](superpowers/specs/2026-11-20-limpeza-da-fase-3-design.md) | Limpeza das pendências da fase 3 | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-20-peculio-design.md](superpowers/specs/2026-11-20-peculio-design.md) | Pecúlio do 2º GB (fase 5): estrutura da ficha, rastreio e interface com a escala | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-21-usuarios-e-modulos-design.md](superpowers/specs/2026-11-21-usuarios-e-modulos-design.md) | Usuários e módulos (fase 6): contas, papéis, unidade de trabalho e tela inicial | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-22-escala-dos-oficiais-design.md](superpowers/specs/2026-11-22-escala-dos-oficiais-design.md) | Escala dos oficiais (entrega paralela P1): cota, saldo e regras; mockup em `telas/escala-dos-oficiais/mockup.html` | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-20-transicao-login-design.md](superpowers/specs/2026-11-20-transicao-login-design.md) | Transição do login (as mangueiras), com o mockup em `telas/transicao-login/mockup.html` | DESIGN | mockup aprovado |
| [superpowers/specs/2026-11-23-refatoracao-da-interface-design.md](superpowers/specs/2026-11-23-refatoracao-da-interface-design.md) | Refatoração da interface: achados da análise, direção proposta e necessidades de implementação | DESIGN | vigente (direção e decisões D1 a D4 aprovadas em 23/11/2026) |
| [superpowers/specs/2026-11-23-sistema-de-estilo-design.md](superpowers/specs/2026-11-23-sistema-de-estilo-design.md) | Diretrizes gerais da interface: valores dos tokens e medidas dos componentes (blocos N1 e N2 da refatoração) e a organização dos mockups em áreas | DESIGN | aprovado |
| [superpowers/specs/2026-11-23-camadas-de-visao-design.md](superpowers/specs/2026-11-23-camadas-de-visao-design.md) | Camadas de visão e o chefe de divisão: ver separado de editar, a borda nas Configurações, a consulta e as escalas só para leitura | PLANEJAMENTO | vigente |
| [superpowers/specs/2026-11-23-arvore-generica-design.md](superpowers/specs/2026-11-23-arvore-generica-design.md) | Árvore genérica e configurações gerais | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-23-oficiais-escala-comum-design.md](superpowers/specs/2026-11-23-oficiais-escala-comum-design.md) | Escala dos oficiais como escala comum e dias vermelhos | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-23-oficiais-tela-de-escalar-design.md](superpowers/specs/2026-11-23-oficiais-tela-de-escalar-design.md) | A tela de escalar dos oficiais | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-24-ficha-da-escala-e-militar-externo-design.md](superpowers/specs/2026-11-24-ficha-da-escala-e-militar-externo-design.md) | Ficha do militar na escala, Escala do mês e militar externo | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-24-choque-universal-design.md](superpowers/specs/2026-11-24-choque-universal-design.md) | Choque de horário universal, o expediente do Adm e a cota de saldo à vista | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-24-pre-escala-turnos-e-expediente-design.md](superpowers/specs/2026-11-24-pre-escala-turnos-e-expediente-design.md) | A pré-escala só nos turnos e com o expediente do Adm | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-24-deploy-so-com-codigo-design.md](superpowers/specs/2026-11-24-deploy-so-com-codigo-design.md) | Deploy só quando o código muda (caminho 1 do Vercel) | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-24-peculio-geral-e-atualizacao-em-lote-design.md](superpowers/specs/2026-11-24-peculio-geral-e-atualizacao-em-lote-design.md) | Pecúlio Geral: as views, a pesquisa com filtros e a atualização em lote | PLANEJAMENTO | aprovado |
| [superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md](superpowers/specs/2026-11-25-fase7-visualizacao-de-escalas-design.md) | Fase 7: o militar marca o voluntariado, os estados da escala e a visualização de escalas | PLANEJAMENTO | aprovado |

## Controle da documentação

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [relatorio-documentacao.md](relatorio-documentacao.md) | Último relatório da checagem, feita quando o usuário pede (sobrescrito a cada vez; o histórico está no git) | DOCUMENTAÇÃO | vigente |
| [ferramentas/checar-documentacao.sh](ferramentas/checar-documentacao.sh) | Script que mede a régua abaixo e imprime o relatório | DOCUMENTAÇÃO | vigente |

## Planos

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [superpowers/plans/2026-11-16-roadmap-migracao.md](superpowers/plans/2026-11-16-roadmap-migracao.md) | Roadmap: a ordem das fases, a situação de cada entrega e as pendências conhecidas | PLANEJAMENTO | vigente |
| [pendencias.md](pendencias.md) | Pendências conhecidas, achadas nas revisões e validações, ainda sem entrega | PLANEJAMENTO | vigente |
| [superpowers/plans/2026-11-16-fase1-fundacao.md](superpowers/plans/2026-11-16-fase1-fundacao.md) | Fase 1: fundação | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-17-fase2-motor.md](superpowers/plans/2026-11-17-fase2-motor.md) | Fase 2: motor de regras | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-17-fase3-cadastros.md](superpowers/plans/2026-11-17-fase3-cadastros.md) | Fase 3: cadastros | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-18-revisao-1.md](superpowers/plans/2026-11-18-revisao-1.md) | Revisão 1: pendências de interface | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-18-revisao-3.md](superpowers/plans/2026-11-18-revisao-3.md) | Revisão 3: revisão de código | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-21-fase5-peculio.md](superpowers/plans/2026-11-21-fase5-peculio.md) | Fase 5: Pecúlio (entregas 1 a 3; 1 e 2 detalhadas) | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-21-fase6-usuarios-e-modulos.md](superpowers/plans/2026-11-21-fase6-usuarios-e-modulos.md) | Fase 6: Usuários e módulos (entregas 1 a 3 detalhadas; 4 condicional) | DESENVOLVIMENTO | em execução |
| [superpowers/plans/2026-11-22-p1-escala-dos-oficiais.md](superpowers/plans/2026-11-22-p1-escala-dos-oficiais.md) | Entrega paralela P1: quadros e Escala dos oficiais (P1.1 a P1.3) | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-camadas-de-visao.md](superpowers/plans/2026-11-23-camadas-de-visao.md) | Entregas 6.10 a 6.12: divisões e chefe de divisão, camadas de visão e consulta, escalas só para leitura | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-13-peculio-origem-dos-dados.md](superpowers/plans/2026-11-23-fase6-13-peculio-origem-dos-dados.md) | Entrega 6.13: importação única do Pecúlio, apagar militar e postos editáveis | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-pendencias-antes-da-fase-7.md](superpowers/plans/2026-11-23-fase6-pendencias-antes-da-fase-7.md) | Entregas 6.15 a 6.18: abono e função, e três lotes de acabamento | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fundacao-da-interface.md](superpowers/plans/2026-11-23-fundacao-da-interface.md) | Entregas 6.20 e 6.21: sistema de estilo e resposta do sistema | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-22-escala-dos-oficiais.md](superpowers/plans/2026-11-23-fase6-22-escala-dos-oficiais.md) | Entrega 6.22: Escala dos oficiais refeita (urgente) | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-23-mover-pela-hierarquia.md](superpowers/plans/2026-11-23-fase6-23-mover-pela-hierarquia.md) | Entrega 6.23: mover o militar pela hierarquia e registrar quem moveu (urgente) | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-25-arvore-generica.md](superpowers/plans/2026-11-23-fase6-25-arvore-generica.md) | Entregas 6.25 e 6.26: árvore genérica e configurações gerais | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-27-oficiais-escala-comum.md](superpowers/plans/2026-11-23-fase6-27-oficiais-escala-comum.md) | Entregas 6.27 e 6.28: oficiais como escala comum e dias vermelhos | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-29-oficiais-tela-de-escalar.md](superpowers/plans/2026-11-23-fase6-29-oficiais-tela-de-escalar.md) | Entrega 6.29: a tela de escalar dos oficiais | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-23-fase6-30-oficiais-memorial-e-pendencias.md](superpowers/plans/2026-11-23-fase6-30-oficiais-memorial-e-pendencias.md) | Entrega 6.30: memorial de cálculo e pendências dos oficiais | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-32-ficha-da-escala.md](superpowers/plans/2026-11-24-fase6-32-ficha-da-escala.md) | Entrega 6.32: a ficha do militar na escala e a Escala do mês no ordinário | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-33-militar-externo.md](superpowers/plans/2026-11-24-fase6-33-militar-externo.md) | Entrega 6.33: o militar externo | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-36-ajustes-do-piloto.md](superpowers/plans/2026-11-24-fase6-36-ajustes-do-piloto.md) | Entrega 6.36: RG funcional, Grade sem Voluntariado, militar externo nas configurações | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-37-choque-universal.md](superpowers/plans/2026-11-24-fase6-37-choque-universal.md) | Entregas 6.37 e 6.38: choque universal; resolver o choque e a cota de saldo | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-39-choque-nos-oficiais.md](superpowers/plans/2026-11-24-fase6-39-choque-nos-oficiais.md) | Entrega 6.39: choque na escala dos oficiais | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-40-pre-escala-turnos-e-expediente.md](superpowers/plans/2026-11-24-fase6-40-pre-escala-turnos-e-expediente.md) | Entrega 6.40: a pré-escala só nos turnos e com o expediente | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-41-deploy-so-com-codigo.md](superpowers/plans/2026-11-24-fase6-41-deploy-so-com-codigo.md) | Entrega 6.41: o deploy é pulado quando o PR só mexe em documentação | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-42-tela-inicial.md](superpowers/plans/2026-11-24-fase6-42-tela-inicial.md) | Entrega 6.42: a tela inicial, versão 2 (cena menor e atalhos), no Fable | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-43-sem-previas.md](superpowers/plans/2026-11-24-fase6-43-sem-previas.md) | Entrega 6.43: os PRs não geram prévia no Vercel; só a main faz deploy | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-44-dia-vermelho-so-ordinario.md](superpowers/plans/2026-11-24-fase6-44-dia-vermelho-so-ordinario.md) | Entrega 6.44: o dia vermelho só conta no serviço ordinário | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-45-escolher-unidade-pela-arvore.md](superpowers/plans/2026-11-24-fase6-45-escolher-unidade-pela-arvore.md) | Entrega 6.45: escolher a unidade pela árvore, nó a nó (Topo e fim das listas planas) | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-47-sem-deploy-nas-branches.md](superpowers/plans/2026-11-24-fase6-47-sem-deploy-nas-branches.md) | Entrega 6.47: o Vercel não cria deploy nas branches dos PRs | DESENVOLVIMENTO | planejado |
| [superpowers/plans/2026-11-24-fase6-46-ajustes-da-grade.md](superpowers/plans/2026-11-24-fase6-46-ajustes-da-grade.md) | Entrega 6.46: a fronteira da rolagem, a cota de saldo e os filtros de equipe da Grade | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-24-fase6-48-lista-de-quem-esta-hoje.md](superpowers/plans/2026-11-24-fase6-48-lista-de-quem-esta-hoje.md) | Entrega 6.48 (defeito): a lista de Militares mostra quem está na unidade no dia | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase6-49-historico-de-rastreio.md](superpowers/plans/2026-11-25-fase6-49-historico-de-rastreio.md) | Entrega 6.49: o histórico de rastreio com o quadro "Hoje", uma mudança por bloco e as marcas | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase6-50-peculio-geral-as-telas.md](superpowers/plans/2026-11-25-fase6-50-peculio-geral-as-telas.md) | Entrega 6.50: o Pecúlio Geral, as três telas, a ficha no lugar e a lista | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase6-51-peculio-geral-pesquisa-e-selecao.md](superpowers/plans/2026-11-25-fase6-51-peculio-geral-pesquisa-e-selecao.md) | Entrega 6.51: a pesquisa com filtros, a árvore, o arquivo e a seleção | DESENVOLVIMENTO | mesclado (#246) |
| [superpowers/plans/2026-11-25-fase6-52-atualizacao-em-lote.md](superpowers/plans/2026-11-25-fase6-52-atualizacao-em-lote.md) | Entrega 6.52: a atualização em lote, com prévia | DESENVOLVIMENTO | mesclado (#248) |
| [superpowers/plans/2026-11-25-fase6-53-acabamento-do-piloto.md](superpowers/plans/2026-11-25-fase6-53-acabamento-do-piloto.md) | Entrega 6.53: acabamento do piloto (CNH pela hierarquia, o motivo do passado, textos e controles) | DESENVOLVIMENTO | mesclado (#261) |
| [superpowers/plans/2026-11-25-fase6-54-exportar-militares.md](superpowers/plans/2026-11-25-fase6-54-exportar-militares.md) | Entrega 6.54: exportar militares para Excel e a busca sem corte | DESENVOLVIMENTO | mesclado (#264) |
| [superpowers/specs/2026-11-25-unidade-pelo-caminho-de-siglas-design.md](superpowers/specs/2026-11-25-unidade-pelo-caminho-de-siglas-design.md) | Desenho curto: a unidade pelo caminho de siglas nas planilhas | PLANEJAMENTO | aprovado |
| [superpowers/plans/2026-11-25-fase6-57-caminho-de-siglas-e-planilha-de-erros.md](superpowers/plans/2026-11-25-fase6-57-caminho-de-siglas-e-planilha-de-erros.md) | Entrega 6.57: o caminho de siglas, a planilha das linhas com problema e o trilho sem Histórico e Ajuda | DESENVOLVIMENTO | mesclada (#267) |
| [superpowers/plans/2026-11-26-fase6-55-proximos-servicos.md](superpowers/plans/2026-11-26-fase6-55-proximos-servicos.md) | Entrega 6.55: os próximos serviços em cartões na tela inicial, a cena mais alta, a barra e "Seu próximo serviço" | DESENVOLVIMENTO | mesclada (#275) |
| [superpowers/plans/2026-11-26-fase6-56-quadro-de-avisos.md](superpowers/plans/2026-11-26-fase6-56-quadro-de-avisos.md) | Entrega 6.56: o quadro de avisos na tela inicial, com publicar, editar e retirar | DESENVOLVIMENTO | em execução |
| [superpowers/plans/2026-11-25-fase6-58-espelho-e-separacao-de-dezembro.md](superpowers/plans/2026-11-25-fase6-58-espelho-e-separacao-de-dezembro.md) | Entrega 6.58: o espelho do banco e a separação dos dados de teste antes de dezembro | PLANEJAMENTO | planejada |
| [superpowers/plans/2026-11-25-fase6-59-entrar-no-laboratorio.md](superpowers/plans/2026-11-25-fase6-59-entrar-no-laboratorio.md) | Entrega 6.59: o cartão, o perfil de teste, a faixa e o isolamento do Laboratório | PLANEJAMENTO | planejada |
| [superpowers/plans/2026-11-25-fase6-60-ferramentas-e-retorno.md](superpowers/plans/2026-11-25-fase6-60-ferramentas-e-retorno.md) | Entrega 6.60: as ferramentas em teste e o retorno do Laboratório | PLANEJAMENTO | planejada |
| [superpowers/plans/2026-11-25-fase7-1-api-do-voluntariado-pelo-militar.md](superpowers/plans/2026-11-25-fase7-1-api-do-voluntariado-pelo-militar.md) | Entrega 7.1: a coleta, o militar marca o próprio voluntariado e o registro das correções | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase7-2-telas-do-voluntariado.md](superpowers/plans/2026-11-25-fase7-2-telas-do-voluntariado.md) | Entrega 7.2: Meu voluntariado, outro horário no dia, a coleta e as correções | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase7-3-api-da-escala-previa.md](superpowers/plans/2026-11-25-fase7-3-api-da-escala-previa.md) | Entrega 7.3: lançar a prévia, o passado com justificativa, o registro e as leituras | DESENVOLVIMENTO | mesclado |
| [superpowers/plans/2026-11-25-fase7-3-1-api-dos-estados-da-escala.md](superpowers/plans/2026-11-25-fase7-3-1-api-dos-estados-da-escala.md) | Entrega 7.3.1: os cinco estados da escala, a prévia por unidade, a retificação automática e as leituras | DESENVOLVIMENTO | mesclado (#251) |
| [superpowers/plans/2026-11-25-fase7-4-estados-na-montagem.md](superpowers/plans/2026-11-25-fase7-4-estados-na-montagem.md) | Entrega 7.4: o estado da escala, lançar a prévia, publicar, republicar, o motivo do passado e as alterações no passado | DESENVOLVIMENTO | mesclado (#253) |
| [superpowers/plans/2026-11-25-fase7-5-minha-escala-e-escalas.md](superpowers/plans/2026-11-25-fase7-5-minha-escala-e-escalas.md) | Entrega 7.5: Minha escala e Escalas, no módulo Visualização | DESENVOLVIMENTO | mesclado (#255) |
| [superpowers/plans/2026-11-18-fase4-escala.md](superpowers/plans/2026-11-18-fase4-escala.md) | Fase 4: montagem da escala (entregas 1 a 4.3) | DESENVOLVIMENTO | concluído |
| [superpowers/plans/2026-11-20-roadmap-documentacao.md](superpowers/plans/2026-11-20-roadmap-documentacao.md) | Roadmap da documentação | DOCUMENTAÇÃO | em execução |
| [superpowers/plans/2026-11-24-revisao-da-documentacao.md](superpowers/plans/2026-11-24-revisao-da-documentacao.md) | Revisão geral da documentação de 24/11: o que foi corrigido e o que pede ação | DOCUMENTAÇÃO | vigente |
| [superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md](superpowers/plans/2026-11-24-pool-de-feedbacks-do-piloto.md) | Pool de feedbacks do piloto de dezembro (agrupados até virar plano) | PLANEJAMENTO | ativo |

## Ideias

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [ideias/LEIAME.md](ideias/LEIAME.md) | Ideias novas de domínio ou escopo, antes do roadmap: uma por arquivo, com perguntas em aberto e esboço da estrutura | CONCEPÇÃO | vigente |

## Telas e mockups

| Documento | Para que serve | Quem cuida | Situação |
|---|---|---|---|
| [telas/telas-v12-anonimizado.html](telas/telas-v12-anonimizado.html) | Esboços aprovados das telas (versão 12), com dados anonimizados | PLANEJAMENTO | vigente como referência |
| [telas/login-e-inicio/mockup.html](telas/login-e-inicio/mockup.html) | Login e tela inicial aprovados | PLANEJAMENTO | concluído |
| [telas/mockup-voluntariado-faixas.html](telas/mockup-voluntariado-faixas.html) | Voluntariado por faixa de horário | PLANEJAMENTO | concluído |
| [telas/mockup-entrega-2-4.html](telas/mockup-entrega-2-4.html) | Acabamento do voluntariado e da Escala do mês | PLANEJAMENTO | concluído |
| [telas/analise-da-interface/evidencias.html](telas/analise-da-interface/evidencias.html) | Fotos das telas de 23/11/2026 com as marcas da análise da interface (dados fictícios) | DESIGN | concluído |
| [telas/refatoracao/index.html](telas/refatoracao/index.html) | Manual de Identidade Visual: o índice das seções (uma por tela, mais as diretrizes gerais), com o estado de cada uma | DESIGN | vigente |
| [telas/refatoracao/diretrizes-gerais/index.html](telas/refatoracao/diretrizes-gerais/index.html) | Área "Diretrizes gerais": identidade, cores, letra, ícones, placa e encaixe, componentes, resposta do sistema e moldura da tela (dados fictícios) | DESIGN | aprovado |
| [telas/refatoracao/tela-inicial/index.html](telas/refatoracao/tela-inicial/index.html) | Área "Tela inicial": a cena de combate menor, com a saudação, os próximos serviços em cartões e os avisos; embaixo, os atalhos e o próximo serviço (dados fictícios). A tela em si está em `inicio.css` e `inicio.js`, que a área Entrada reaproveita | DESIGN | versão 3 em revisão pelo usuário |
| [telas/refatoracao/entrada/index.html](telas/refatoracao/entrada/index.html) | Área "Entrada": o login com a foto nova do quartel e a animação das mangueiras, versão 2 (brasas em dobro, que viram cinza), pousando no quadro da tela inicial (dados fictícios) | DESIGN | versão 2 em revisão pelo usuário |
| [telas/refatoracao/historico-de-rastreio/index.html](telas/refatoracao/historico-de-rastreio/index.html) | Área "Histórico de rastreio", seção da ficha do militar: o quadro "Hoje" e a linha do tempo das mudanças, sem os afastamentos (dados fictícios) | DESIGN | em revisão pelo usuário |

As versões v5 a v11 dos esboços ficam só na pasta local `.superpowers/` (fora do git) e estão superadas pela v12.

## Fora do repositório

- `docs/fontes de dados/`: planilhas e PDFs com dados pessoais, **nunca vão para o git** (ignorada no `.gitignore`). Só quem trabalha na máquina do usuário as vê.

## Régua de qualidade

Cada medida é um alerta, não um bloqueio. A DOCUMENTAÇÃO mede quando o usuário pede. Os planos de fase e de revisão (`superpowers/plans/`, menos os roadmaps) ficam fora das medidas de tamanho e de parágrafo: são temporários e se dividem por entrega.

| Medida | Bom | Atenção |
|---|---|---|
| Documento lido inteiro (spec, guia, glossário, índice) | até 25 KB (25.600 bytes, como mede o script) | acima de 50 KB é crítico |
| `CLAUDE.md` da raiz | até 120 linhas, sem "estado atual" datado, sem número que envelhece (contagem de testes ou de arquivos) | |
| Parágrafo (linha de tabela fica de fora) | até 400 caracteres | |
| Adendos num mesmo documento (só os antigos; não se escreve adendo novo) | até 3 | mais de 3: consolidar |
| Caminhos e links citados | todos existem | link quebrado |
| ER × migrações | toda tabela tem um título `###` no esquema do banco | tabela sem título |
| Índice × arquivos | todo `.md` e `.html` de `docs/` aparece aqui ou no LEIAME da sua pasta | arquivo fora do índice |

## Como checar

Da raiz do repositório, no Git Bash: `bash docs/ferramentas/checar-documentacao.sh > docs/relatorio-documentacao.md`.

O script mede tamanho, parágrafos longos, adendos, o `CLAUDE.md` (nota: bom, regular ou insatisfatório), o esquema do banco contra as migrações, o índice contra os arquivos e os links, e as branches `docs-*` e `documentacao-*` sem merge.

A nota do `CLAUDE.md` é "bom" sem falhas, "regular" com uma e "insatisfatório" com duas ou mais.

Para decidir o que fazer com cada alerta, a DOCUMENTAÇÃO traz alternativas e uma recomendação.
