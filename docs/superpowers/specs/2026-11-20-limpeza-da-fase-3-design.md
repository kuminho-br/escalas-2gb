# Limpeza das pendências da fase 3 (bloco da entrega 3.3)

20/11/2026 · design curto · aguardando aprovação

## Por quê

Os cadastros (fase 3, PRs #13 a #24) foram fechados e revisados, mas ficaram dois PRs abertos e pendências que um escalante pode encontrar no piloto da 1ª SB. O objetivo é chegar ao piloto sem esses tropeços. Decisão do usuário: entra como o **primeiro bloco da entrega 3.3**, antes de alocar no Efetivo do dia, no mesmo branch e PR da 3.3.

**Fora do escopo:** as pendências só de código (testes fracos, código repetido, "hoje" calculado de três jeitos etc., listadas no roadmap em "Menores adiados"); fechar o diálogo de criação sem perguntar (8 telas, ganho pequeno); sessão expirada e "ABT"/"Abt" (sem sinal de que ainda existam; ficam para conferir no piloto).

## Abordagens consideradas

- **Bloco dentro da 3.3 (escolhida pelo usuário).** A 3.3 nasce com o banco avisando migração faltando e com as telas novas da 3.2.1 já arrumadas.
- Entrega própria agora, interrompendo a 3.2.1: mistura duas mudanças num branch com trabalho sem commit.
- No fim da fase 4, logo antes do piloto: a lista cresce e fica para a última hora.

## Os seis itens

### 1. PR #32 — campo de mês das Cotas
A tela de Cotas passa a usar o `CampoDeMes` compartilhado (botões "Mês anterior" e "Próximo mês"; o texto digitado fica como está até virar um mês completo). O PR não tem conflito: entra como está (ou é mesclado antes, se o usuário quiser).

### 2. PR #15 — a API avisa quando falta migração
Refeito em cima da `main` atual (o PR original tem conflitos e é anterior às migrações 0013 a 0020). Comportamento, igual ao do PR:
- o build da Vercel embute a lista de migrações que a versão espera;
- se faltar alguma no banco, a API responde **503** com "O banco de dados está desatualizado…" e a lista das pendentes, em todas as rotas menos `/api/saude`; com o banco em dia, não confere mais; enquanto falta, reconfere a cada 5 s;
- o site mostra a mensagem do servidor no lugar de "Falha ao consultar a sessão";
- o modelo de PR ganha a caixa "tem / não tem migração".

O PR #15 é fechado com referência ao novo.

### 3. CNH — as categorias habilitadas aparecem marcadas (só na tela)
Hoje a ficha (`componentes/militares/Motorista.tsx`) mostra as categorias que vêm pela hierarquia tracejadas, com "pela D". Passa a mostrá-las **marcadas, como as da carteira**: ao clicar em E, acendem D, C e B; ao desmarcar E, apagam (a menos que outra categoria da carteira as habilite). **Nada muda no que é gravado:** a CNH continua guardando só as categorias da carteira, e a hierarquia continua no motor (`cnh.ts`). O A continua isolado. O texto de ajuda da tela muda para dizer isso.

Decisão do builder: o leitor de tela continua dizendo "pela E" nas habilitadas, para a diferença não sumir para quem não vê; clicar numa habilitada que não está na carteira a coloca na carteira.

### 4. Dois escalantes editando o mesmo militar
O que o código faz hoje: os blocos da ficha já gravam separados (o bloco Motorista manda só motorista e CNH; a API completa o que não veio com o valor atual). O risco que sobra é **dentro do bloco Identificação**: ele manda sempre os cinco campos (posto, nome de guerra, antiguidade, voluntário JES, ativo). Se o escalante A muda o nome e o B muda o voluntário JES ao mesmo tempo, quem salva por último desfaz a alteração do outro. Além disso, a API lê os valores atuais fora da transação.

Decisão do usuário: **gravar só os campos que a pessoa mudou.**
- O site manda só os campos alterados desde a última gravação (ou desde o último dado do servidor).
- A API lê os valores atuais dentro da transação, com trava da linha, para dois envios simultâneos não se cruzarem.
- O mesmo campo alterado pelos dois continua valendo o último (aceito; não há aviso de conflito).

### 5. "Desativar agora" pede confirmação
Na ficha do modelo de guarnição (`configuracoes_.modelos-de-guarnicao.$id.tsx`), "Desativar agora" abre uma confirmação curta: "Desativar o modelo X agora? As escalas dos próximos meses deixam de usá-lo." com "Desativar" e "Cancelar". "Desativar a partir de um mês" e "Reativar" seguem sem confirmação.

Decisão do builder: aplicar a mesma confirmação ao "Desativar agora" de serviços e escalas, se o botão existir lá com o mesmo efeito imediato.

### 6. Cota para serviço desativado
Hoje a API de cotas confere só se o serviço é da unidade; a importação já recusa serviço desativado ("Serviço X está desativado. Reative o serviço na tela de Serviços ou use outro."). Decisão do usuário: **a API recusa também**, com a mesma mensagem, ao criar ou editar uma cota. Motivo: a 3.3 distribui as operações pelas cotas, e uma cota de serviço desativado atrapalharia a conta.

Decisão do builder: "Copiar do mês anterior" pula as cotas de serviço desativado e avisa quantas pulou, em vez de falhar inteira. Cotas que já existem para serviço desativado não são apagadas.

## Testes

Cada item com teste que falha antes: #32 (botões e digitação parcial, já no PR); #15 (503 com a lista, `/api/saude` livre, mensagem no site); CNH (clicar em E acende D, C e B e grava só E; A isolado); militar (o corpo enviado tem só o campo mudado; dois PATCHs de campos diferentes preservam os dois); confirmação (cancelar não desativa); cota (criar, editar e copiar com serviço desativado). No fim: `pnpm test && pnpm typecheck && pnpm build:vercel`.

## O que fica para o builder

A ordem das tarefas dentro do bloco, onde o site guarda o "último estado salvo" para comparar, e o texto exato do aviso da cópia de cotas.
