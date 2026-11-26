# Laboratório

25/11/2026 · no roadmap (6.58 a 6.60) · CONCEPÇÃO · origem: usuário (25/11/2026) · documento de requisitos

## A ideia

Um módulo novo, o **Laboratório**: uma área onde o usuário coloca as ferramentas que ainda estão em ideia ou em construção, para as pessoas testarem com **dados falsos**, que não tocam no banco real, e deixarem um retorno sobre o que testaram.

Diferente das outras ideias, esta não fica no pool: vai direto para a PLANEJAMENTO, que faz o plano de implementação com a DESENVOLVIMENTO (usuário, 25/11/2026).

## Por quê

- As escalas de **dezembro de 2026** (o piloto) serão **dados reais**. Os dados de teste precisam sair do caminho delas, já.
- As ferramentas novas precisam de um lugar para serem experimentadas por quem vai usá-las antes de entrarem no sistema de verdade, e o retorno dessas pessoas guia o que se constrói.

## Decisões do usuário (25/11/2026)

1. O nome é **Laboratório**.
2. **A separação dos dados é para agora.** Uma parte do banco atual vira um **espelho**: a mesma estrutura do banco real, com outros registros. Quando a estrutura do banco real muda, a do espelho muda junto.
3. Os dados do mês de teste (dezembro) são reais; os dados do Laboratório ficam separados deles.
4. Quem testa entra **com a própria conta** e, dentro do Laboratório, escolhe com que nível de acesso quer testar. O retorno sai com o nome real da pessoa.
5. A CONCEPÇÃO só documenta os requisitos; o plano é da PLANEJAMENTO com a DESENVOLVIMENTO.

## Objetivos

1. Um espelho do banco, no mesmo banco de hoje, com a estrutura sempre igual à do real e registros só de teste.
2. Os militares fictícios (matrículas `990…`) e qualquer outro registro de teste saem do banco real e passam a viver no espelho, **antes do piloto de dezembro**.
3. O cartão **Laboratório** na tela inicial, que abre o sistema sobre o espelho.
4. Uma lista das ferramentas em teste dentro do Laboratório.
5. Um retorno em cada ferramenta, com o nome de quem testou, que o administrador lê numa lista.

## Não objetivos

- Um segundo banco (outro projeto no Supabase). Fica para quando o espelho no mesmo banco não bastar.
- Copiar registros reais para o espelho, mesmo anonimizados.
- Levar algo do espelho para o banco real ("promover" um dado de teste).
- Um construtor de ferramentas para o usuário: cada ferramenta continua sendo feita pela DESENVOLVIMENTO.

## Anti-objetivos

- **Um dado de teste aparecer no real**, ou uma gravação feita no Laboratório chegar ao banco real. É a falha que não pode acontecer.
- **Um dado real aparecer no Laboratório**, em especial CPF, nascimento e endereço.
- **Confundir as duas áreas:** a pessoa achar que está no real quando está no Laboratório, ou o contrário.
- A estrutura do espelho ficar para trás da do real e as ferramentas quebrarem por isso.
- Bloquear o escalante: nada no Laboratório atrapalha a escala de verdade.

## O espelho

- **Onde fica:** uma área à parte dentro do banco atual, com todas as tabelas do real.
- **A estrutura acompanha o real:** toda migração vale para o real e para o espelho, no mesmo passo. Não há migração só de um lado.
- **Os registros são só de teste:** a carga do espelho é a dos dados fictícios de hoje (militares `990…`, unidades, serviços, guarnições, escalas), mais o que as ferramentas em teste precisarem.
- **Usuários de teste:** o espelho tem um usuário de teste por nível de acesso (administrador, gestor, quinto nível, auxiliar administrativo e militar comum), já lotados e com os níveis dados.
- **Recomeçar (proposta da CONCEPÇÃO):** o administrador pode repor o espelho à carga inicial, quando os testes o deixarem bagunçado.

## A separação para dezembro

- **Conferir o banco real:** listar o que é registro de teste (militares `990…` e o que estiver ligado a eles, contas e escalas de teste).
- **Levar ao espelho e tirar do real**, antes de começar a montagem de dezembro.
- Depois disso, o banco real só recebe dados reais. Os testes automáticos e as prévias continuam com dados fictícios, como hoje.
- **Prazo:** antes do piloto. É o único ponto desta ideia que corre junto com dezembro.

## Como a pessoa entra

- **Cartão "Laboratório"** na tela inicial. Proposta da CONCEPÇÃO: para todo militar com conta, porque o objetivo é ouvir quem vai usar as ferramentas. A PLANEJAMENTO pode restringir.
- A pessoa entra **com o login de sempre**. Ao abrir o Laboratório, escolhe o **perfil de teste**: com qual dos usuários de teste vai agir (um por nível de acesso).
- Dentro do Laboratório, tudo o que ela vê e grava é do espelho, e ela age com o nível do perfil escolhido, não com o seu.
- Pode trocar de perfil sem sair do Laboratório.
- Qualquer pessoa pode escolher qualquer perfil, inclusive o de administrador: o perfil só vale no espelho e não dá nenhum acesso no real.
- Ao sair, volta ao sistema real com a própria conta e o próprio nível.

```
┌──────────────────────────────────────────────────────────┐
│ Laboratório: dados de teste. Nada aqui vale.   [Sair]    │
│ Testando como: Gestor de teste ▾                         │
├──────────────────────────────────────────────────────────┤
│ Ferramentas em teste                                     │
│  ▸ Controle de alterações do Pecúlio   em teste          │
│  ▸ Consulta de militares (nova)        em teste          │
│                                                          │
│                               [Deixar retorno]           │
└──────────────────────────────────────────────────────────┘
```

O desenho acima é só para mostrar a ideia; a tela é com a DESIGN e a DESENVOLVIMENTO.

## A faixa

- Em toda tela do Laboratório, uma faixa fixa e bem visível: **"Laboratório: dados de teste. Nada aqui vale."**, com o perfil de teste em uso e o botão de sair.
- A faixa tem cor e lugar próprios, diferentes de qualquer aviso do sistema real.

## As ferramentas em teste

- O Laboratório lista as ferramentas em teste. Cada uma tem nome, o que testar (um texto curto para quem vai experimentar) e situação: **em teste**, **encerrada** ou **virou módulo**.
- Quem cadastra e muda a situação: o administrador.
- Uma ferramenta pode ser um módulo inteiro novo ou uma versão nova de uma tela que já existe.
- Os módulos de hoje também abrem no Laboratório, sobre o espelho, para dar base às ferramentas em teste (uma ferramenta de escala precisa de militares e escalas).

## O retorno

- Em cada ferramenta, o botão **"Deixar retorno"**: um texto e uma nota de 1 a 5 (a nota é proposta da CONCEPÇÃO).
- O retorno guarda a ferramenta, a tela em que a pessoa estava, o perfil de teste em uso, a **conta real** da pessoa e a data.
- **O retorno fica no banco real**, não no espelho: é dado de trabalho, ligado à conta real, e não pode sumir quando o espelho é reposto.
- **Lista de retornos** para o administrador, com filtro por ferramenta e por período. A PLANEJAMENTO e a DESIGN usam essa lista para decidir o que muda.

## Esboço da estrutura

- **Espelho:** as mesmas tabelas do real, numa área à parte. Nenhuma tabela nova para o espelho em si.
- **Perfil de teste** (no espelho): os usuários de teste, um por nível de acesso, com os níveis já dados.
- **Ferramenta em teste** (no real): nome, o que testar, situação, início e fim.
- **Retorno** (no real): a ferramenta, a conta de quem deixou, o perfil de teste usado, a tela, o texto, a nota e quando.
- **Sessão no Laboratório** (decisão técnica da PLANEJAMENTO): a ligação entre a conta real e o perfil de teste escolhido, enquanto a pessoa está no Laboratório.

## Abordagens consideradas

**Onde ficam os dados de teste**
- **(1) Espelho dentro do banco atual. Escolhida** (usuário, 25/11/2026): custa nada a mais e a estrutura acompanha o real pelas mesmas migrações.
- (2) Um segundo banco no Supabase: isola melhor, mas é mais uma conta, mais um custo e outra rotina de migração.
- (3) Dados de teste e reais juntos, marcados: descartada, porque é justamente o risco de dezembro.

**Como a pessoa entra**
- **(a) Própria conta, com perfil de teste. Escolhida** (usuário, 25/11/2026): o retorno diz quem testou, sem senha nova.
- (b) Contas de teste próprias ("gestor.teste"): mais simples, mas o retorno fica anônimo e as senhas circulam.

## Testes

- **Isolamento:** nenhuma gravação feita no Laboratório chega ao banco real; nenhuma leitura no Laboratório traz registro do real. As exceções são só a lista de ferramentas em teste (leitura) e o retorno (gravação), que ficam no real.
- **Estrutura:** depois de cada migração, o espelho tem as mesmas tabelas e colunas do real.
- **Separação para dezembro:** depois da limpeza, o banco real não tem nenhuma matrícula `990…`.
- **Perfil de teste:** com cada perfil, o Laboratório mostra o que aquele nível vê; a conta real não ganha nenhum acesso no sistema real.
- **Recomeçar:** repor o espelho não apaga nenhum retorno.

## Relação com outras ideias

- **Soluções personalizadas** (`solucoes-personalizadas.md`, em rascunho): a parte de "área de testes" daquela ideia passa a ser o Laboratório.
- **Controle de alterações do Pecúlio** e as outras ideias do pool podem nascer no Laboratório antes de virarem módulo.

## O que fica para quem for planejar

- Como a área do espelho é criada e como a API escolhe entre o real e o espelho a cada pedido, com a garantia de isolamento acima.
- Como as migrações passam a valer para os dois lados.
- A carga inicial do espelho e o "Recomeçar".
- Os nomes técnicos, a ordem das entregas (sugestão: primeiro a separação para dezembro; depois o cartão, o perfil de teste e a faixa; depois as ferramentas e o retorno) e o texto exato das telas.
- A linha desta decisão em `docs/decisoes.md`.
