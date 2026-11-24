# Registro de decisões — fase 5

Decisões de 21/11/2026: a execução da fase 5 (Pecúlio), o fim da fase 4 e o desenho da fase 6. Da mais nova para a mais velha. As siglas e as regras do registro estão em [decisoes.md](../decisoes.md). A coluna "Onde está" usa caminhos a partir de `docs/`.

| Data | Decisão | Onde está |
|---|---|---|
| 21/11/2026 | O rastreio (lotação, equipe, jornada) vale por dia, como os afastamentos. Substitui "a partir de é o mês" e fecha a pendência de elucidação. Entra na entrega 6.5. | Pecúlio, Rastreio do militar e Telas |
| 21/11/2026 | O "Vale desde" do modelo de guarnição (criar e nova versão) aceita mês passado, inclusive muito antigo; as outras vigências continuam recusando. Entra na entrega 6.5. | Plano da fase 6, Entrega 5 |
| 21/11/2026 | Grade geral: clicar no nome da equipe recolhe ou mostra os militares dela. Entra na entrega 6.5. | Plano da fase 6, Entrega 5 |
| 21/11/2026 | Sete ajustes de interface esperam mockup da DESIGN: confirmações em diálogo do sistema, topo só com o brasão, seletor de unidade nível por nível, enquadramento das boas-vindas, cadastro incompleto no campo, filtro de pendências e motivo do afastamento à direita. | Plano da fase 6, Entrega 6 |
| 21/11/2026 | A folga do auxiliar na senha provisória não vale para conta desativada: só quem pode dar o papel (o gestor ou o administrador) reativa. Entra na entrega 6.3. | Usuários e módulos, Contas |
| 21/11/2026 | Senha provisória e desativar o acesso de quem tem papel: só quem pode dar todos os papéis da pessoa (o gestor para auxiliar e gestor; o administrador para o administrador), com uma folga: o auxiliar também gera a senha de um colega auxiliar da unidade dele ou de baixo. A folga entra na entrega 6.2. | Usuários e módulos, Contas |
| 21/11/2026 | Fase 6, primeiro acesso: senha provisória gerada pelo auxiliar administrativo ou pelo gestor e trocada no primeiro login; o link por e-mail e o "Esqueci minha senha" por e-mail ficam para quando houver serviço de envio testado. | Usuários e módulos, Contas |
| 21/11/2026 | Fase 6, módulos por papel: Confecção para auxiliar, gestor e administrador; Pecúlio para quem tem papel; Visualização e "Minha ficha" (com o próprio telefone) para todos. | Usuários e módulos, Módulos |
| 21/11/2026 | O papel `escalante` aparece nas telas como "Auxiliar administrativo"; nos textos de ajuda, quem monta a escala continua sendo o escalante. | Usuários e módulos, Papéis |
| 21/11/2026 | A transição do login entra como última entrega da fase 6 se o mockup estiver aprovado até lá; senão, passa para a fase seguinte. | Usuários e módulos, Transição do login |
| 21/11/2026 | Com "Adm cumpre a carga mensal" desligado, o Adm tira saldos e pode tirar PJES no horário do expediente. O segundo parâmetro (P-34) e a utilidade da prioridade da cota (P-35, talvez removida) ficam para depois, sem prioridade. | `negocio/regras/carga-expediente-choques.md`, RN-17; `negocio/regras/normativo-a-validar.md`, Pendências |
| 21/11/2026 | "Adm cumpre a carga mensal": ligado, vale a portaria (160h e nenhum extra no horário do expediente); desligado, vale a prática (o Adm reforça com saldos e pode tirar PJES no horário do expediente). Em aberto: os saldos com o parâmetro desligado e um possível segundo parâmetro (P-34). | `negocio/regras/carga-expediente-choques.md`, RN-17 |
| 21/11/2026 | Catálogo de regras conferido contra o sistema novo: cada regra diz se já funciona e onde; entram as regras da fase 4 (RN-102 a RN-116); RN-07, RN-08, RN-47 e RN-92 ficam como substituídas; RN-21, RN-31, RN-95, RS-05, RS-06 e RS-07 saem. | `negocio/regras/LEIAME.md` |
| 21/11/2026 | Vaga vazia na Escala do mês e no Efetivo por dia: opção A do mockup da DESIGN (contorno tracejado; barra vinho na obrigatória; "opcional" na extra; contador "Faltam N"). Entra na entrega 4 da fase 5. | `plans/2026-11-21-fase5-peculio.md`, Entrega 4 |
| 21/11/2026 | O retorno da validação vai para frente: vira entrega nova no fim da fase em andamento, sem reabrir fase passada nem passar na frente do previsto. O lote de 21/11 é a entrega 4 da fase 5. | Roadmap, Princípios e Fase 5 |
| 21/11/2026 | A tela "Serviços" passa a se chamar "Turnos": é como as pessoas pensam; "serviço" fica como entidade interna. "Importar da Planilha" vira "Importar". | Roadmap, Fase 5 (entrega 4) |
| 21/11/2026 | Lotação é só a posição do militar na estrutura (a unidade); equipe e jornada são atributos do militar; o conjunto no tempo é o "rastreio", alterado por "Alterar situação" com "a partir de" e mostrado numa linha do tempo com os afastamentos. | Pecúlio, O modelo e Telas |
| 21/11/2026 | "A partir de" no rastreio é o mês, por enquanto; se vale o dia é pendência de elucidação de requisito. | Design, Pendências abertas |
| 21/11/2026 | A CNH é do militar; para a escala, só vale se ele estiver no quadro de motoristas. | Design, CNH; Pecúlio, Regras da interface |
| 21/11/2026 | Ficha única com dono por bloco: o papel da unidade de cima edita o Pecúlio; o escalante, o que é da escala; o militar, o próprio telefone (fase 6). Futuro: token de atualização de ficha. | Pecúlio, Quem edita o quê |
| 21/11/2026 | Nome completo e nome de guerra são atributos separados. | Pecúlio, O modelo |
| 21/11/2026 | A fase 5 entrega a interface do Pecúlio com a escala e a estrutura decidida; o resto do Pecúlio é postergável. | Pecúlio, Por quê e Não objetivos |
| 21/11/2026 | Área pessoal: comparar a própria escala com a de outro militar (fase 8) e busca por permutantes num dia escolhido (fase 9, depois das specs de permutas). | Roadmap, Fases 7, 8 e 9; Design, Nome do sistema, login e módulos |
| 21/11/2026 | A planilha de importação é o contrato do sistema (DTO): o modelo exportado diz o que se espera, e quem envia se adapta. Por isso a importação continua recusando mês passado. Recusadas: valer a mais recente das antigas e contar a antiga igual como "igual". | Design, Cadastros › Importação |
