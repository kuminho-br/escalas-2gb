# Fase 7: o militar marca o voluntariado, a escala prévia e a visualização de escalas — design

25/11/2026 · decisões do usuário em 24 e 25/11/2026 (brainstorming) · planos: `docs/superpowers/plans/2026-11-25-fase7-1-…` a `fase7-5-…` · regras tocadas: RN-39, RN-48, RN-105, RN-107, RN-04, RN-46

## Por quê

Hoje o escalante lança o voluntariado de cada militar, e a escala só é vista por quem trabalha no módulo de escalas. A fase 7 abre as duas pontas para o militar: ele diz quando é voluntário, e vê a escala em que foi posto. Ao abrir a escala à corporação, mexer no que já aconteceu deixa de ser coisa do dia a dia: vira exceção, com justificativa e registro.

## Decisões do usuário

### O militar marca o próprio voluntariado (prioridade)

1. O militar marca dias e faixas, **o mesmo dado** que o escalante lança hoje: a página de voluntariado de um militar num mês.
2. Ele marca **na área pessoal**, não na tela do escalante. O módulo de escalas é exclusivo do escalante e do gestor.
3. **A coleta:** o gestor da seção tem, nas configurações do voluntariado, a opção de aceitar o preenchimento de um certo mês. Ele liga e desliga para coletar.
4. **O escalante pode corrigir** o que o militar marcou, mas isso é exceção: a correção fica num registro.
5. **O voluntariado é uma característica do militar:** o que ele preenche na área pessoal vale para todas as seções que querem escalá-lo (a dele e as que o trazem como externo).
6. **O botão do dia:** no quadrado de cada dia, do lado oposto ao número, um botão deixa o militar preencher o dia de forma diferente dos blocos que o gestor configurou, com faixas próprias. O formato do botão ainda não está decidido.
7. **Voluntário JES:** o militar pode marcar mesmo sem o atributo "voluntário JES". Quem barra é a escala: sem o atributo, ele não é escalado no JES nem no PJES (RN-04 e RN-46, que já funcionam).
8. Os blocos do dia, na tela pessoal, vêm das configurações da seção de lotação do militar.

### Escala prévia

9. A escala passa a ser vista pela corporação quando o escalante aperta **"Lançar prévia"** na montagem. Vale para **cada escala num mês**, não para o mês inteiro da seção.
10. Lançada, a prévia **não trava**: continua sendo alterada no mês, e quem olha vê a versão atual.
11. **Qualquer pessoa da corporação vê qualquer prévia lançada**, de qualquer unidade.
12. **A escala dos oficiais** também fica aberta a todos, mas só depois de lançada. Antes disso, só os oficiais a veem (como hoje).
13. **Passado é o turno que já começou.** Alterar o passado é só de gestor, administrador e coordenador; o escalante não altera.
14. **Alterar o passado pede justificativa**, e fica num registro: o valor antigo, o novo, quem alterou, quando e por quê. Só o militar comum não vê o registro.

### Visualização

15. **Minha escala** simples agora: os próprios serviços do mês e quem compõe cada guarnição. A Escala por militar (fase 8) herda o desenho.

## Escolhas da PLANEJAMENTO

O usuário entregou o "como". Cada escolha abaixo é minha e pode ser corrigida na validação.

### Voluntariado

- **A coleta é por unidade e mês.** O militar pode marcar o mês M quando a coleta de M está aberta na unidade em que ele está lotado em M (a mesma conta de lotação que a tela do escalante já usa). Sem data limite: fecha quando o gestor desliga. Mês passado nunca aceita.
- **Coleta fechada:** o militar continua vendo o que marcou, só não altera. A tela diz "A coleta de dezembro está fechada. Fale com o escalante da sua seção.".
- **Quem liga a coleta:** gestor, coordenador ou administrador da unidade (o escalante não).
- **O escalante continua lançando** quem não preencheu, como hoje, sem registro. **Registro só quando ele altera um mês que o próprio militar preencheu.** A correção não pede justificativa (o usuário pediu a justificativa para o passado da escala); o registro guarda as faixas de antes, as de depois, quem e quando.
- **Quem tem nível de acesso e marca o próprio voluntariado** pela área pessoal conta como militar, sem registro.
- **O botão do dia** (proposta, a validar): um botão pequeno com o ícone de relógio abre "Outro horário" daquele dia, com pares "das HH:MM às HH:MM" (um ou mais), além dos blocos. O que foi marcado fora dos blocos aparece no dia como uma linha "08:00 às 12:00". Na tela do escalante, a mesma linha aparece (ele precisa ver o que o militar marcou), e ele também pode usar o botão.
- **O aviso:** a tela inicial mostra "O voluntariado de dezembro está aberto" no atalho do módulo enquanto houver coleta aberta para a pessoa.
- **Conta sem militar** (administrador sem ficha): a tela não aparece.

### Escala prévia

- **"Lançar prévia" e "Recolher prévia"** são do escalante e do gestor da unidade da escala. Recolher existe para o engano; não deixa registro próprio (a auditoria geral guarda).
- **O passado só trava em escala com a prévia lançada.** Antes de lançar, a escala é rascunho que ninguém de fora vê, e o escalante mexe à vontade (princípio: o escalante nunca é bloqueado de fechar a escala). Depois de lançada, toda mudança numa alocação cujo turno já começou (escalar, tirar, trocar, mover, acumular, desfazer) segue a regra 13 e 14.
- **A justificativa** tem no mínimo 10 letras. O escalante recebe "Este turno já começou. Só o gestor altera o passado.".
- **Um registro só** (`registro_de_alteracao`) para as duas exceções: a correção do voluntariado e a alteração do passado. Aparece em dois lugares: na página do voluntariado do militar (tela do escalante) e na Escala do mês ("Alterações no passado").
- **O expediente sem escala** (6.40) e a **rodada dos oficiais** (que tem o seu próprio fechamento e a cobertura) ficam fora da trava do passado nesta fase.
- **O que a corporação vê:** a Escala do mês da prévia, só para leitura, sem os candidatos, as pendências de montagem e os botões. As camadas de visão da "escala em montagem" (6.12) continuam valendo para o que ainda **não** foi lançado.

### Visualização

- O módulo "Visualização de escalas" da tela inicial ganha três telas: **Minha escala**, **Meu voluntariado** e **Escalas** (as prévias lançadas, escolhendo a unidade pela árvore).
- **Minha escala** mostra só o que está em prévia lançada (rascunho não aparece para o militar). Cada serviço: o dia, o horário, o serviço, a escala, a unidade e a guarnição com quem a compõe (patente, nome de guerra e função).

## Não objetivos

- O .xlsx e a impressão (fase 8). A Escala por militar e a comparação com outro militar (fase 8). Permutas e busca por permutantes (fase 9).
- Notificar o militar (e-mail, mensagem) quando a escala muda.
- Prazo automático da coleta.
- Trava do passado na rodada dos oficiais e no expediente sem escala.

## Anti-objetivos

- O militar comum entrar no módulo de escalas, ou ver escala que não foi lançada.
- O militar marcar o voluntariado de outro militar.
- Alteração no passado de uma prévia lançada sem justificativa ou sem registro.
- A correção do escalante apagar o que o militar marcou sem deixar rastro.
- O escalante ser impedido de montar uma escala ainda não lançada.

## Entregas

| Entrega | O que traz | Modelo | Migração |
|---|---|---|---|
| 7.1 | API do voluntariado: a coleta, o militar marca o próprio, o registro das correções | Sonnet | 0044 |
| 7.2 | Telas do voluntariado: Meu voluntariado, o botão do dia, o interruptor da coleta, o registro | Sonnet | — |
| 7.3 | API da prévia: lançar e recolher, a trava do passado com justificativa, o registro, as leituras para a corporação e a Minha escala | Sonnet | 0045 |
| 7.4 | Tela da montagem: "Lançar prévia", a justificativa, "Alterações no passado" | Sonnet | — |
| 7.5 | Módulo Visualização: Minha escala e Escalas | Sonnet | — |

Ordem: 7.1, 7.2, 7.3, 7.4, 7.5. A 7.1 e a 7.2 são a prioridade e já servem ao piloto (coletar o voluntariado de janeiro).

## Regras a atualizar no catálogo (PLANEJAMENTO, quando cada entrega for ao ar)

RN-39 (o próprio militar marca: "Funciona"), RN-107 (faixas fora dos blocos), e regras novas para a coleta, a prévia, o passado com justificativa e o registro.
