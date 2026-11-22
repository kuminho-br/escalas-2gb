# Pecúlio do 2º GB — design da fase 5

20/11/2026 · revisto em 21/11/2026 · pronto para o plano

A fase 5 traz para o sistema a **estrutura** da ficha do militar que hoje vive na planilha do Pecúlio, e deixa funcional a parte dela que a escala usa. A ordem das fases está no roadmap; o histórico das decisões, em `docs/decisoes.md`.

## Por quê

A planilha do Pecúlio é mantida pela seção de pessoal, e as outras seções têm planilhas próprias, desligadas dela: o mesmo militar aparece com dados que não batem. Com a ficha no sistema, **o banco passa a ser a fonte única** dos dados do militar, e as outras seções (a escala primeiro) leem dele. A planilha vira só cópia de segurança da seção de pessoal.

O Pecúlio fica na interface de vários domínios. A escala é um deles. **A modelagem completa do Pecúlio não precisa estar fechada para a interface com a escala funcionar**: a fase 5 entrega essa interface e a estrutura já decidida; o resto amadurece depois, sem mexer na parte da escala (decisão do usuário, 21/11/2026).

Rotas consideradas para o roadmap (20/11/2026): seguir com o documento e o piloto (rota 1, recusada); preparar o piloto antes (rota 2, virou a ordem da fase 8); **Pecúlio primeiro (rota 3, escolhida)**.

## Objetivos

- A ficha do militar com os atributos já decididos, num formulário só, cada bloco com o seu dono.
- A **lotação** com o sentido da corporação: a posição do militar na estrutura organizacional (a unidade), e só isso.
- Equipe e jornada como atributos do próprio militar, com histórico junto da lotação, para a escala de um mês passado continuar certa.
- A CNH separada do quadro de motoristas, com a regra da escala explícita.
- A importação do Pecúlio por um modelo de planilha próprio, que é o contrato.
- As telas do módulo Pecúlio: lista e ficha dos militares do GB, e os aniversariantes do mês.

## Não objetivos (desta fase)

Ficam para depois, sem bloquear a interface com a escala:

- o abono de permanência (decidido: um campo de sim ou não; falta a entrega);
- a função do militar (decidido: todo militar tem uma, cadastrada nas Configurações até o QOD ser modelado; falta a entrega) e as missões extras;
- o QOD, que é um domínio à parte: cada função com as vagas e os postos-graduações que podem ocupá-la, a árvore de órgãos e o previsto por posto. Entra como uma consulta no módulo Pecúlio; a modelagem fica pendente;
- férias (rascunho, módulo à parte);
- quem vê cada atributo (pesa quando o militar comum entrar, na fase 6; na fase 5 a ficha é usada por quem tem papel);
- a jornada dos oficiais (pesa nas distribuições, na fase 8; até lá, oficial continua Adm);
- a grafia das siglas em Configurações;
- a cópia de segurança gerada pelo sistema no formato do Pecúlio;
- data de ingresso e CPF (o CPF só no servidor do Estado);
- o militar editando o próprio telefone (precisa do login do militar comum, fase 6);
- o token de atualização de ficha (ideia futura, abaixo).

## Anti-objetivos

- **Moldar a estrutura aos dados da planilha.** Inconsistência nas linhas é problema de quem migra; o design cuida das colunas, entidades e relações (decisão do usuário, 21/11/2026).
- **Tolerar planilha fora do modelo.** A planilha de importação é o contrato; quem envia se adapta.
- **Chamar de "lotação" qualquer coisa além da unidade.** É termo da corporação.
- Bloquear o escalante.

## Restrições

- **D7 (dados pessoais):** no teste, sem CPF e sem o ano de nascimento (o aniversário fica com dia e mês); o telefone entra; afastamento sem diagnóstico.
- **E-mail institucional:** só o domínio `@bombeiros.pe.gov.br`; é o e-mail de entrada no sistema.
- **Dados de hoje:** os militares que já estão no banco de teste e ficarem sem lugar na mudança de estrutura ficam na 1ª SB, por enquanto.
- **"A partir de" é o dia**, como nos afastamentos (decisão do usuário, 21/11/2026; até a entrega 6.5 o sistema usa o mês).

## Abordagens consideradas

**Onde guardar lotação, equipe e jornada no tempo**
- **(1) A tabela de hoje vira o "rastreio do militar" (escolhida).** Cada período guarda unidade, equipe e jornada, com início e fim; mudar qualquer um fecha o período e abre outro. A escala já sabe olhar o período de cada data: muda o nome e a tela, não a lógica.
- (2) Três históricos separados (lotação, equipe, jornada): mais tabelas, e a escala juntaria três consultas para o mesmo resultado.
- (3) O valor atual no militar e o histórico só pela auditoria: a escala de um mês passado erraria, e regra não se tira da auditoria (decisão de 17/11/2026). Descartada.

**A ficha do Pecúlio e a de Militares**
- **Uma ficha só, com dono por bloco (escolhida).** Duas fichas para o mesmo militar recriariam dentro do sistema o problema de integridade que a fase quer acabar.

## O modelo

### Militar (tabela `militar`, ampliada)

| Atributo | Regra | Dono |
|---|---|---|
| Matrícula | já existe; a chave do militar | Pecúlio |
| Posto-graduação | já existe; nome provisório do campo (um militar tem um posto ou uma graduação) | Pecúlio |
| Quadro | novo (P1.1); QOC, QOA ou QBMG; o posto-graduação precisa pertencer ao quadro, e o mesmo posto pode estar em mais de um quadro | Pecúlio |
| Nome completo | novo; obrigatório | Pecúlio |
| Nome de guerra | já existe; atributo próprio (pode ser abreviação de um dos nomes) | Pecúlio |
| Antiguidade | já existe; é a "Ordem" do Pecúlio (lugar no ranking do GB) | Pecúlio |
| Sexo | novo | Pecúlio |
| Data de nascimento | nova; no teste, só dia e mês (D7) | Pecúlio |
| Telefone | novo | Pecúlio |
| E-mail institucional | novo; único; só `@bombeiros.pe.gov.br`; pode ficar vazio até ser preenchido | Pecúlio |
| Comportamento | novo; um da lista (Excepcional, Ótimo, Bom, Insuficiente, Mau) | Pecúlio |
| Boletim do comportamento | novo; o boletim (BGE) que publicou a última mudança | Pecúlio |
| Quadro de motoristas | já existe | Escala |
| CNH | já existe; **independente do quadro** (sai a regra que a apagava) | Escala |
| Voluntário JES | já existe; é o "Voluntário PJES" do Pecúlio | Escala |
| Abono de permanência | decidido, sem entrega: sim ou não | Pecúlio |
| Função | decidida, sem entrega: de todo militar, de um catálogo nas Configurações (depois, do QOD) | Pecúlio |

O histórico das mudanças de comportamento fica na auditoria (relação de um comportamento para muitos militares, com o boletim da última publicação no próprio militar; decisão do usuário).

### Rastreio do militar (a tabela `lotacao` renomeada)

| Atributo | Regra |
|---|---|
| Lotação | a unidade (posição na estrutura organizacional) |
| Equipe | da mesma unidade; opcional |
| Jornada | Pronto ou Adm |
| Desde / até | por dia; sem períodos sobrepostos por militar |

"Lotação", na tela e nos textos, passa a ser **só a unidade**. O conjunto (lotação, equipe, jornada no tempo) é o **rastreio**.

### Afastamento (tabela `afastamento`, ampliada)

- **Tipos novos no catálogo do sistema:** Adido, Agregado, L.E, LTS e DTS, ao lado de Férias, Curso e Outro. O catálogo continua editado pelo administrador.
- **Motivo:** texto curto e opcional, com o aviso "não escreva diagnóstico" (D7).
- **Boletim:** texto opcional, com a publicação do afastamento.
- A escala continua usando o tipo e o período, como hoje.

### Estrutura do 2º GB

- As **sete seções** (1ª a 7ª SB) existem como unidades abaixo do 2º GB.
- A árvore completa do QOD fica para depois.

## Regras da interface com a escala

- **CNH:** para a escala (lista de quem pode ocupar a vaga, escalar, acumular, trocar e o painel do dia), a CNH só vale se o militar estiver no quadro de motoristas. Quem não está no quadro não ocupa vaga que exige CNH, mesmo tendo a carteira.
- **Lotação, equipe e jornada de um mês** vêm do período do rastreio daquele mês, como hoje.
- **Voluntário JES** e **afastamentos** continuam lidos como hoje.

## Quem edita o quê

**Militar novo** só entra pelo módulo Pecúlio, pela ficha ou pela importação do Pecúlio; o módulo de escalas não cadastra militar (decisão do usuário, 22/11/2026; entrega 6.7).

| Bloco | Quem edita |
|---|---|
| Identificação, contato, dados pessoais, comportamento, afastamentos e o rastreio (lotação) | gestor ou auxiliar administrativo (escalante) com papel numa **unidade acima** da lotação do militar (a "seção de pessoal" é o papel da unidade de cima) |
| Equipe, jornada, quadro de motoristas, CNH e voluntário JES | escalante ou gestor com papel na lotação do militar ou acima (como hoje) |
| Telefone (o próprio) | o militar, quando o login do militar comum existir (fase 6) |

O rastreio junta lotação (do Pecúlio) e equipe/jornada (da escala) no mesmo formulário: quem tem papel na unidade de cima altera os três; quem tem papel só na seção altera equipe e jornada, com a lotação travada.

## Telas

```
Ficha do militar
  Identificação · Contato · Dados pessoais · Comportamento
  Motorista e CNH · Voluntário JES
  Afastamentos

  ── Histórico de rastreio ─────────────────────── [Alterar situação]
  Situação atual: 1ª SB · Equipe Alfa · Pronto   (desde 01/03/2026)
  01/03/2026  Lotação 2ª SB → 1ª SB · Jornada Adm → Pronto
  01/08/2026  Afastamento: Férias (01/08 a 30/08)
  18/11/2026  Equipe Bravo → Alfa
```

- **"Alterar situação"** abre um formulário flutuante com lotação, equipe, jornada e "a partir de" (data, sugerida a de hoje). Salvar fecha o período aberto no dia anterior e abre outro.
- **A linha do tempo** junta as mudanças do rastreio e os afastamentos, do mais novo para o mais velho.
- **Módulo Pecúlio:** a lista dos militares das unidades a que o usuário tem acesso (com busca e filtro por lotação) e a ficha. **Aniversariantes do mês:** uma lista na tela do módulo.

## Importação do Pecúlio

- Um **modelo de planilha próprio** (aba `PECÚLIO`), gerado pela API como os outros, com a aba `AJUDA`. As colunas são as do modelo acima: nome completo e nome de guerra em colunas separadas.
- A matrícula liga a linha ao militar que já existe; o resto segue o padrão das importações (prévia, problemas com a solução, importar de novo sem duplicar).
- Quem envia adapta a planilha ao modelo.

## Ideias futuras (registradas, fora da fase 5)

- **Token de atualização de ficha:** o escalante ou o gestor escolhe um militar e emite um token dizendo quais campos do próprio registro ele pode editar e até quando (a expiração do token).
- **Área pessoal do militar** (ver o design da migração e o roadmap): a escala pessoal, a comparação da própria escala com a de outro militar e a busca por permutantes.

## O que fica para quem for planejar

- A ordem das entregas da fase (sugestão: estrutura e regra da CNH primeiro; depois a ficha e o rastreio; depois a importação e o módulo).
- Os nomes técnicos das colunas novas e da tabela renomeada, e a migração que preserva os períodos de hoje.
- O texto exato da aba `AJUDA` e das mensagens.
