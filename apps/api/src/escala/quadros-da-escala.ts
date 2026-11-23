// As telas de escala de praças (Grade, Escala do mês, Efetivo por dia e Voluntariado) mostram o QBMG e quem está sem quadro.
// Os oficiais QOC e QOA têm a escala própria (Oficiais). Quem está sem quadro continua aqui, com a pendência na ficha.

/**
 * Trecho `where` sobre o alias `l` de `rastreio`: o quadro do PERÍODO (o quadro vale por período, como a lotação). Quem está sem quadro continua.
 */
export const SO_QBMG_OU_SEM_QUADRO = "(l.quadro_id is null or l.quadro_id = (select id from quadro where sigla = 'QBMG'))";

/** Trecho `where` sobre o alias `l` de `rastreio`: a situação do período deixa o militar ser escalado (substitui o antigo `ativo`). */
export const PODE_SER_ESCALADO = 'exists (select 1 from situacao_militar sm where sm.id = l.situacao_id and sm.escalavel)';

/** Motivo de um oficial QOC ou QOA numa vaga de praça. */
export const MOTIVO_OFICIAL = 'Oficial: fica na escala dos oficiais.';

/** O quadro (sigla) é de oficial? É a mesma regra do trecho SQL: com quadro e fora do QBMG. */
export const ehOficial = (quadro: string | null): boolean => quadro !== null && quadro !== 'QBMG';
