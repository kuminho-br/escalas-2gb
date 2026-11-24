# A pré-escala só nos turnos e com o expediente do Adm — design

24/11/2026 · decisões do usuário no mesmo dia (texto e formulário) · entrega 6.40, antes da fase 7 · plano: `docs/superpowers/plans/2026-11-24-fase6-40-pre-escala-turnos-e-expediente.md` · continua `2026-11-24-choque-universal-design.md`

## Por quê

O usuário quer automatizar a escala do Pronto e do expediente antes da fase 8 (o piloto de dezembro continua testando só a escala feita à mão). Hoje a pré-escala do Pronto (entrega 3.1) põe a equipe do dia nas vagas das guarnições, e o expediente do Adm não é lançado: o sistema só o calcula para conferir choque.

## Decisões do usuário (24/11/2026)

1. **Um botão só**, "Pré-escala": gera o Pronto e o expediente de uma vez. Não há botão próprio do expediente.
2. **A pré-escala não aloca guarnições, só turnos:** a equipe do dia entra no turno do Pronto, sem guarnição e sem função; o escalante põe cada um numa vaga depois, à mão. (Hoje ela preenche as vagas; isto muda.)
3. **O expediente fica sem escala** (não entra em nenhuma escala publicada) por enquanto.
4. **O Adm não recebe expediente** no fim de semana, no feriado da unidade, no dia de afastamento e no dia em que já tem, no horário do expediente, um serviço que tira do expediente (o Saldo).

## Escolhas da PLANEJAMENTO

- **O expediente lançado e o calculado:** o expediente continua sendo uma obrigação da jornada Adm (spec do choque universal). O lançado pela pré-escala só o torna visível; o calculado continua valendo para a conferência de choque, e some sob o lançado (o motor já faz isso, "sob o Adm real do dia"). Tirar o expediente lançado sem pôr nada no lugar não libera o militar: o calculado volta. Liberar é sempre por um serviço que tira do expediente (6.38).
- **"Tirar de lá e escalar aqui" com o expediente lançado:** só um serviço com "Pode tirar o militar do Adm do expediente" tira um expediente lançado (o JES continua não podendo); quem pode é quem tem poder na lotação do militar (o expediente não tem escala).
- **Alocação sem escala:** o banco passa a aceitar alocação sem escala **só** do serviço Expediente (o serviço fixo de nome "Expediente"). Toda tela e consulta que junta alocação com escala passa a tolerar isso.
- **Onde o expediente aparece:** na Grade geral (é o dia do militar) e no painel do dia; não aparece na Escala do mês, que é de uma escala.
- **Quem recebe expediente:** os militares lotados na unidade com jornada Adm no período que vale no dia, com o mesmo filtro de quadro da pré-escala de praças (QBMG e sem quadro); o expediente dos oficiais espera a jornada dos oficiais ser elucidada (postergado no roadmap).
- **Sem o serviço Expediente** cadastrado na unidade, a pré-escala gera só o Pronto e avisa "Sem o serviço Expediente na unidade: o expediente não foi gerado.".
- **Gerar de novo:** como hoje no Pronto, só acrescenta o que falta; o expediente tirado pelo escalante num dia (a remoção) não volta.
- **Mover para a vaga:** na escolha do militar de uma vaga, quem já está **no mesmo turno sem guarnição** aparece primeiro, com "No turno, sem guarnição", e escolhê-lo **move** a alocação dele para a vaga (não é choque). A prévia da pré-escala passa a dizer quantos entram no turno do Pronto e quantos no expediente; somem da prévia as vagas vazias e o "sem guarnição".

## Não objetivos

- Distribuir automaticamente nas guarnições (fica para a automação da fase 8, se o usuário quiser).
- O expediente dos oficiais.
- Uma escala do expediente para publicar.

## Anti-objetivos

- Um militar em dois lugares (o choque universal vale para o expediente lançado como para o calculado).
- A pré-escala pôr o externo ou o militar de outra jornada no Pronto.
- O expediente lançado num dia de afastamento, feriado ou fim de semana.
