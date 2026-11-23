# Camadas de visão e o chefe de divisão — design

23/11/2026 · fechado com o usuário (caminho B) · plano em `docs/superpowers/plans/2026-11-23-camadas-de-visao.md` (entregas 6.10 a 6.12)

## Por quê

Hoje o sistema só conhece um tipo de acesso: o nível de acesso numa unidade, que vale para ela e as de baixo, e que dá ver e editar juntos. Ninguém enxerga para o lado, e o militar comum só vê a própria ficha.

Na corporação não é assim. Existe um mínimo de informação que todo militar conhece sobre todos. Os oficiais conhecem mais, da corporação inteira. E os chefes das divisões controlam a sua divisão, mas precisam enxergar a outra por inteiro.

Por isso o acesso passa a ter duas perguntas separadas: **o que a pessoa edita** (pela hierarquia, como hoje) e **o que a pessoa vê** (por camadas que se somam).

## Objetivos

1. As **divisões** entram na árvore de unidades, entre o grupamento e as seções.
2. Um quinto nível de acesso, o **chefe de divisão**: controla a sua divisão e vê a hierarquia das divisões irmãs, sem editar.
3. Três **camadas de visão**, que valem para a corporação inteira: a de todos, a do oficial e a do chefe de divisão.
4. A **borda** (o que cada camada vê) fica numa tabela das Configurações, ajustada pelo administrador, sem nova entrega.
5. Uma tela de **consulta** para todo militar, e as telas de escala **só para leitura** para quem vê uma unidade sem poder editá-la.

## Não objetivos

- O organograma completo (o QOD, as vagas e as funções). Esta entrega só cria as divisões e deixa mover as seções para dentro delas.
- A escala publicada para o militar comum. Ela chega com o módulo "Visualização de escalas" (fase 7), que ganha a sua linha na tabela da borda.
- Mudar o que cada nível de acesso **edita**. Nada muda na edição, fora o que está em "CPF, nascimento e endereço".
- Borda por pessoa ou por unidade. A tabela é uma só, do sistema.

## Anti-objetivos

- **Vazar dado pela lista.** Uma coluna que a pessoa não pode ver não pode vir na resposta da API, nem escondida na tela.
- **Ver virar editar.** Nenhuma camada de visão dá permissão de gravar.
- **Abrir o CPF por um clique errado.** O CPF, o nascimento e o endereço ficam fora da tabela ajustável.
- Bloquear o escalante.

## Conceitos

| Conceito | O que é |
|---|---|
| **Nível de acesso** | O que já existe: administrador, gestor, auxiliar administrativo; agora também chefe de divisão. Vale numa unidade e nas de baixo, por período. Dá **editar** |
| **Camada de visão** | De onde vem o direito de **ver** um bloco de dados de um militar ou de uma unidade que a pessoa não edita |
| **Bloco** | Um grupo de dados que se libera junto (por exemplo, "Contato") |
| **Borda** | A tabela que diz quais blocos cada camada vê |

## As divisões

- Tipo de unidade novo, **Divisão**, entre o Grupamento e a Seção. Uma seção pode ficar direto no grupamento ou dentro de uma divisão.
- As padrão são a **Divisão Administrativa** (sigla **DA**) e a **Divisão Operacional** (sigla **DivOp**). A migração cria as duas em cada grupamento, vazias. Quais seções vão para cada uma é dado: quem decide é o gestor do grupamento, na tela.
- **Tela "Estrutura"**, nas Configurações, para o gestor do grupamento e o administrador: ver a árvore do grupamento, criar e renomear uma divisão, e pôr uma seção dentro de uma divisão (ou tirá-la).
- Mover uma seção muda na hora quem a alcança pela hierarquia. A tela avisa isso antes de salvar.
- Uma divisão com seções dentro não é apagada. Não há "apagar" nesta versão: a divisão vazia fica.

## O chefe de divisão

- **Nome provisório.** O usuário ainda não escolheu o nome. Nas telas aparece "Chefe de divisão"; no banco, `chefe_divisao`. O texto fica num lugar só, para trocar depois.
- **Só existe numa divisão.** O nível não pode ser dado numa seção nem no grupamento (regra no banco, como a do administrador na raiz).
- **Edita como o gestor**, na sua divisão e nas seções de dentro: tudo o que o gestor edita, inclusive dar e encerrar os níveis de auxiliar e de gestor.
- **Quem dá o nível:** o gestor de uma unidade acima da divisão (o do grupamento) e o administrador. Um chefe de divisão não dá o próprio nível a outra pessoa.
- **O que ele vê a mais:** a camada "chefe de divisão", nas divisões irmãs (as que têm a mesma unidade mãe) e em tudo abaixo delas.

## As camadas de visão

| Camada | Quem tem | Sobre quem vale |
|---|---|---|
| **Todos** | Todo militar com conta | Todos os militares da corporação |
| **Oficial** | Quem está, hoje, num quadro marcado como "de oficiais" (QOC e QOA) | Todos os militares da corporação |
| **Chefe de divisão** | Quem tem esse nível vigente | Os militares e as unidades das divisões irmãs e de baixo delas |

Regras:

- **As camadas se somam.** A pessoa vê um bloco se alguma camada dela libera o bloco. O oficial tem também a camada de todos; o chefe de divisão tem as três (a do oficial, se for oficial).
- **A hierarquia continua valendo por cima.** Quem tem nível de acesso na lotação do militar, ou acima, vê todos os blocos ajustáveis dele, como hoje.
- **O próprio militar** vê tudo de si na Minha ficha, como hoje.
- **"De oficiais" é uma marca no cadastro do quadro**, não uma lista no código. Vale o quadro do período do rastreio de hoje.
- **Militar sem lotação hoje** aparece na consulta só com o bloco "Identificação".

## Os blocos e a borda inicial

A borda inicial é um ponto de partida, proposto pela PLANEJAMENTO. O administrador muda na tela.

| Bloco | O que tem | Todos | Oficial | Chefe de divisão |
|---|---|---|---|---|
| Identificação | Posto, nome de guerra, nome completo, matrícula, lotação e quadro | vê | vê | vê |
| Contato | Telefone e e-mail | não | vê | vê |
| Situação | Equipe, jornada, situação do militar e o histórico de rastreio | não | vê | vê |
| Afastamentos | Tipo e período, sem motivo e sem boletim | não | vê | vê |
| Dados da escala | Motorista, CNH e voluntário JES | não | vê | vê |
| Comportamento | Comportamento e boletim; motivo e boletim dos afastamentos | não | não | vê |
| Escala em montagem | Grade geral, Escala do mês, Efetivo por dia, Cotas e Voluntariado da unidade, só para leitura | não | não | vê |

- **A lista de blocos é fixa no código**, porque cada bloco é um grupo de colunas e de telas. O que se ajusta é quem vê.
- **"Identificação" para todos não se desliga:** sem ela a consulta não mostra nada. A tela mostra a marca travada.
- **Marcar "Todos" marca as outras duas**, travadas, porque as camadas se somam.

## CPF, nascimento e endereço

Ficam **fora da borda**, com regra fixa. Vê e edita quem cuida do Pecúlio, ou seja, quem tem nível de acesso numa **unidade acima** da lotação do militar, além do administrador. O próprio militar vê na Minha ficha.

Isso muda um comportamento de hoje: quem tem nível de acesso só na seção deixa de ver esses três dados na ficha. Era a pergunta aberta da entrega 6.9, respondida aqui. O sexo continua no bloco de dados pessoais da ficha, visível como hoje.

## Telas

**Consulta de militares** (módulo novo na tela inicial, para todos):

```
Consulta de militares
[ nome, nome de guerra ou matrícula      ] [ unidade ▾ ]   [Buscar]

CB ALMEIDA · 990123-4 · 1ª SB · QBMG
3º SGT BRITO · 990456-7 · 3ª SB · QBMG
```

- A busca exige um texto de pelo menos 3 caracteres ou uma unidade. A lista traz no máximo 50 linhas e avisa quando há mais.
- A linha mostra só a Identificação. Abrir leva à **ficha de consulta**: só os blocos que a pessoa vê daquele militar, sem nenhum botão de editar.
- Um bloco que a pessoa não vê **não aparece**. A tela não diz "você não tem acesso a isto".
- Quem tem nível de acesso na lotação do militar vê, na ficha de consulta, o atalho "Abrir a ficha completa".

**Escalas só para leitura:**

- O seletor de unidade ganha um segundo grupo, **"Só consulta"**, com as unidades cuja "Escala em montagem" a pessoa vê e não edita.
- Com uma unidade dessas escolhida, as telas Grade geral, Escala do mês, Efetivo por dia, Cotas e Voluntariado abrem com a faixa **"Só consulta: você não altera nada em {unidade}."** e sem os botões de alterar.
- As outras telas do módulo (Militares, Turnos, Escalas, Feriados, Oficiais, Configurações) não aparecem no trilho nesse modo.
- Essas telas mostram o que já mostram ao escalante: nome, equipe, jornada, alocações e os afastamentos, sem o motivo. O bloco "Escala em montagem" carrega isso consigo, só para os militares daquela unidade.

**Configurações:**

- **"Quem vê o quê"** (administrador): a tabela da borda, com uma marca por bloco e camada, e "Salvar".
- **"Estrutura"** (gestor do grupamento e administrador): ver "As divisões".
- **Quadros:** a marca "de oficiais" entra junto, na aba "Quem vê o quê", numa lista dos quadros.

## Abordagens consideradas

**A borda**
- (A) Fixa no código: mais simples, mas exige hoje uma precisão que o usuário não tem, e cada ajuste vira entrega.
- **(B) Mecanismo fixo e borda nas Configurações. Escolhida** (usuário, 23/11/2026).
- (C) Só o quinto nível agora: deixaria de fora as camadas e seria refeito depois.

**Onde a visão é aplicada**
- (1) Afrouxar as rotas de hoje, uma a uma: cada rota de cadastro passaria a decidir entre ver e editar. Arriscado: um erro abre a edição.
- **(2) Rotas de consulta à parte, e só as leituras das telas de escala aceitam a visão. Escolhida.** As rotas que gravam não mudam, e o teste de isolamento entre unidades continua valendo para elas.

**A divisão**
- (1) Um rótulo nas seções ("administrativa" ou "operacional"): rápido, mas não serve de base ao organograma.
- **(2) Unidade de verdade na árvore. Escolhida:** o nível de acesso e as lotações já funcionam com a árvore.

## Decisões da PLANEJAMENTO

As seis foram aprovadas pelo usuário em 23/11/2026.

1. Nome completo e matrícula estão em "Identificação", vista por todos.
2. O chefe de divisão dá e encerra níveis de auxiliar e de gestor na sua divisão, como o gestor.
3. A migração cria as duas divisões vazias em cada grupamento.
4. Quem tem nível só na seção deixa de ver CPF, nascimento e endereço.
5. A busca da consulta alcança a corporação inteira, não só o 2º GB.
6. A auditoria não registra as consultas, só as gravações, como hoje.

## Testes

- **Borda:** cada bloco, para cada camada, com a marca ligada e desligada; a soma das camadas; a hierarquia por cima.
- **Vazamento:** a resposta da API não traz o campo de um bloco que a pessoa não vê; nunca traz CPF, nascimento ou endereço na consulta.
- **Chefe de divisão:** edita na sua divisão; nas irmãs lê e recebe 403 ao gravar; não alcança a divisão de outro grupamento.
- **Isolamento:** o teste de hoje continua passando para todas as rotas que gravam.
- **Estrutura:** mover uma seção muda o alcance na hora; uma seção não entra numa divisão de outro grupamento.

## O que fica para quem for planejar

- Os nomes técnicos das tabelas e das rotas, e o número das migrações.
- A ordem das entregas (sugestão: a estrutura e o nível; depois as camadas e a consulta; depois as escalas só para leitura).
- O texto exato das mensagens.
