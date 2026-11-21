# Usuários e módulos — design da fase 6

21/11/2026 · aprovado; plano em `docs/superpowers/plans/2026-11-21-fase6-usuarios-e-modulos.md`

A fase 6 abre o sistema para todos os militares do GB: cada um com a sua conta, cada papel vendo os seus módulos, e cada pessoa trabalhando na unidade a que tem acesso, não mais na 1ª SB fixa. A ordem das fases está no roadmap; o histórico das decisões, em `docs/decisoes.md`.

## Por quê

Hoje só o administrador tem conta (criada por comando), a unidade das telas é fixa na 1ª SB e o site mostra a todos o mesmo trilho. Sem isso:
- o militar comum não entra;
- o auxiliar do 2º GB não trabalha no Pecúlio do GB inteiro pela tela certa;
- a validação não consegue testar com escalante nem com militar comum (risco registrado no roadmap).

A fase 7 (Visualização de escalas) depende desta: o militar precisa entrar para ver a própria escala.

## Objetivos

- **Contas:** o auxiliar administrativo ou o gestor gera uma **senha provisória** na ficha do militar e a entrega a ele; no primeiro login, o militar troca a senha.
- **Papéis:** o gestor dá e tira os papéis de gestor e de auxiliar administrativo na unidade dele e nas de baixo. O administrador, em qualquer unidade.
- **Unidade de trabalho:** um seletor de unidade com as unidades a que a pessoa tem acesso. Ele substitui a 1ª SB fixa.
- **Tela inicial com os módulos**, cada um aparecendo para quem pode usá-lo; o cartão **"Minha ficha"** é para todos.
- **O nome "Auxiliar administrativo"** nas telas, no lugar de "Escalante".
- **A transição do login** (as mangueiras), como última entrega, se o mockup estiver aprovado até lá.

## Não objetivos (desta fase)

- O envio de e-mail: o link para criar a senha e o "Esqueci minha senha" por e-mail. Entram quando um serviço de envio estiver testado com o domínio `@bombeiros.pe.gov.br`.
- Usuários acima do GB (fase 11).
- A Visualização de escalas, a Minha escala e o próprio voluntariado (fase 7). Na fase 6, o cartão da Visualização aparece com "em breve".
- Quem vê cada atributo da ficha de **outro** militar, além do que já vale (D7). O militar comum só vê a própria ficha.
- O token de atualização de ficha (ideia futura do Pecúlio).

## Anti-objetivos

- **Bloquear o escalante** (princípio do projeto). Nenhuma regra de conta trava quem monta a escala.
- **Senha que circula por escrito sem prazo.** A senha provisória vale por pouco tempo e só serve para a troca.
- **Militar comum vendo dados de outro militar.** Ele vê só o que é dele.

## Restrições

- **Login por e-mail institucional:** é o e-mail da ficha (só `@bombeiros.pe.gov.br`, fase 5). Sem e-mail na ficha, não há conta.
- **D7:** nada de dados pessoais reais em teste. Matrículas `990xxx-x`.
- **Os papéis valem para a unidade e as de baixo, por período** (`papel_usuario`, com início e fim), como hoje.
- **O papel de administrador** só existe na unidade raiz (regra já no banco).

## Abordagens consideradas

**Primeiro acesso do militar** (escolha do usuário, 21/11/2026)
- **(1) Senha provisória gerada pelo auxiliar ou pelo gestor. Escolhida.** Não depende de serviço novo, e o piloto é pequeno. "Esqueci minha senha" vira "peça uma senha nova ao auxiliar administrativo da sua seção".
- (2) Link por e-mail. Exige contratar um serviço de envio, e o servidor do Estado pode barrar ou mandar para o spam. Fica para depois.
- (3) As duas na fase 6. Mais trabalho, e a fase ficaria dependendo do serviço de e-mail.

**Quem vê cada módulo** (escolha do usuário, 21/11/2026)
- **(1) Por papel. Escolhida.** Ver "Módulos" abaixo.
- (2) Pecúlio só para a seção de pessoal. O escalante da seção perderia a lista do Pecúlio, que já usa para os blocos da escala.
- (3) Todos os cartões para todos, apagados quando sem acesso. A tela ficaria cheia para o militar comum.

**Nome do papel** (escolha do usuário, 21/11/2026)
- **"Auxiliar administrativo" nas telas. Escolhido.** No 2º GB, o mesmo papel cuida do Pecúlio, não só da escala. Nos textos de ajuda, quem monta a escala continua sendo "o escalante". No banco, o valor `escalante` não muda; só muda o texto que a tela mostra.

**A transição do login** (escolha do usuário, 21/11/2026)
- **Última entrega da fase, se o mockup for aprovado até lá. Escolhida.** A tela inicial sai antes, com a cena final parada na faixa. Se o mockup não estiver aprovado, a animação passa para a fase seguinte sem segurar nada.

## Contas

| Regra | Como fica |
|---|---|
| Quem gera a senha provisória | Auxiliar administrativo ou gestor com papel na lotação do militar ou acima, e o administrador. Para quem tem papel, só quem poderia dar todos os papéis da pessoa: o gestor gera para auxiliar e gestor, e só o administrador gera para o administrador. Exceção: o auxiliar gera para um colega auxiliar **ativo** da unidade dele ou de baixo; conta desativada só volta por quem dá o papel (decisões do usuário, 21/11/2026). Desativar segue a mesma regra |
| Onde | Na ficha do militar, bloco "Acesso ao sistema": a situação da conta (sem conta, senha provisória pendente, ativa, desativada) e o botão **"Gerar senha provisória"** |
| A senha | Gerada pelo sistema, fácil de ler e ditar (sem letras que se confundem). Aparece **uma vez**, na tela, para quem gerou entregar ao militar |
| Prazo | Vale por 7 dias. Vencida, não entra, e a mensagem pede uma senha nova ao auxiliar |
| Primeiro login | Com a senha provisória, o militar cai direto na tela **"Crie a sua senha"** e só segue depois de trocar. Mínimo de 10 caracteres, como hoje |
| Gerar de novo | Invalida a anterior e encerra as sessões abertas daquele militar |
| Sem e-mail na ficha | O botão fica desligado, com o aviso "Preencha o e-mail institucional para dar acesso" |
| E-mail da conta | É o da ficha. Mudar o e-mail na ficha muda o e-mail de entrada |
| Desativar | "Desativar acesso" na mesma ficha, para quem gera a senha. A pessoa deixa de entrar e as sessões dela se encerram. Os papéis ficam no histórico |
| No login | "Esqueci minha senha" mostra: "Peça uma senha nova ao auxiliar administrativo da sua seção." |

## Papéis

| Quem | Pode dar e tirar |
|---|---|
| Administrador | Qualquer papel, em qualquer unidade (administrador só na raiz) |
| Gestor | Gestor e auxiliar administrativo, na unidade dele e nas de baixo |
| Auxiliar administrativo | Nenhum |

- **Onde:** na ficha do militar, no mesmo bloco "Acesso ao sistema": a lista dos papéis com unidade e período, e "Dar papel" (papel, unidade, a partir de). "Encerrar" fecha o período na data escolhida; o papel não é apagado.
- **Dar papel a quem não tem conta** é permitido: o papel passa a valer quando a pessoa entrar.
- **Ninguém encerra o próprio último papel de gestor.** Evita que uma unidade fique sem quem dê papéis por engano. O administrador pode.
- **Na tela, os nomes são** "Administrador", "Gestor" e "Auxiliar administrativo". Sem papel vigente, a pessoa é militar comum, e a tela não chama isso de papel.

## Unidade de trabalho

- **O seletor** fica no topo, onde hoje está o caminho fixo. Ele mostra as unidades a que a pessoa tem acesso: as dos papéis dela e as de baixo. Para o administrador, todas.
- **Ao entrar**, vale a última unidade escolhida neste navegador. Na primeira vez, vale a unidade do papel mais baixo na árvore. Exemplo: um auxiliar com papel na 1ª SB começa na 1ª SB; um gestor do 2º GB, no 2º GB.
- **O militar comum** não tem seletor: o topo mostra o caminho da lotação dele, só para leitura.
- **Cada tela trabalha na unidade escolhida.** As telas que hoje assumem a 1ª SB passam a usar a unidade do seletor.
- **Unidade que não serve para a tela.** Exemplo: a Escala do mês com o 2º GB escolhido, que não tem escalas próprias. A tela mostra o vazio de sempre, com o convite para escolher uma seção. Nada trava.
- **A API não confia na escolha do site:** cada rota continua conferindo o papel na unidade pedida, como hoje.

## Módulos

| Módulo | Quem vê o cartão | Observação |
|---|---|---|
| Confecção de escalas | Auxiliar administrativo, gestor e administrador | Grade geral, Escala do mês, Efetivo, Voluntariado, cadastros etc., como hoje |
| Pecúlio do 2º GB | Quem tem papel | O dono por bloco da fase 5 não muda: a unidade de cima altera os dados do Pecúlio; a seção altera o que é da escala |
| Visualização de escalas | Todos | "Em breve" até a fase 7 |
| Minha ficha | Todos | A pessoa vê os próprios dados e **altera o próprio telefone**. É o item da fase 5 que esperava o login do militar comum |

- **A tela inicial** segue o mockup aprovado (`docs/telas/login-e-inicio/mockup.html`):
  - a barra com o brasão, o nome do sistema, o seletor e "Sair";
  - a faixa de boas-vindas com a **cena final da transição** (`docs/telas/transicao-login/img/combate.jpg`), parada, no lugar das fotos sorteadas;
  - um cartão por módulo visível.
- **Dentro de um módulo**, o trilho mostra só os itens daquele módulo, com uma volta à tela inicial.
- **Quem abre o endereço de um módulo que não vê** recebe a tela inicial, com o aviso de que aquela área é de outro papel.

## Transição do login

Segue o design `docs/superpowers/specs/2026-11-20-transicao-login-design.md`, com o retorno R1 a R6, incluindo **sem som**. Entra como última entrega da fase **se** o usuário tiver aprovado o mockup até lá; se não, passa para a fase seguinte, e a faixa fica com a cena parada.

## Ordem das entregas (proposta)

1. **Contas e papéis.** A senha provisória, a troca obrigatória no primeiro login, desativar, os papéis na ficha e o nome "Auxiliar administrativo". Vem primeiro porque destrava a validação: com ela, a VALIDAÇÃO cria um auxiliar da 1ª SB, um gestor do 2º GB e um militar comum na sandbox.
2. **Unidade de trabalho.** O seletor e as telas usando a unidade escolhida.
3. **Tela inicial e módulos.** Os cartões por papel, o trilho por módulo e a Minha ficha com o telefone.
4. **Transição do login**, se o mockup estiver aprovado.

O retorno da validação que chegar durante a fase entra como entrega nova depois da última prevista.

## O que fica para quem for planejar

- Onde guardar "senha provisória pendente" e o prazo. Pode ser em `usuario` ou numa tabela própria; o `convite` de hoje não tem uso e pode ser aproveitado ou removido.
- Como o site informa a unidade escolhida à API. As rotas já recebem a unidade.
- O endereço da Grade geral, que hoje ocupa `/`, a raiz do site, onde passa a ficar a tela inicial.
- O texto exato das mensagens.
