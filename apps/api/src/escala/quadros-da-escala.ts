// As telas de escala de praças (Grade, Escala do mês, Efetivo por dia e Voluntariado) mostram o QBMG e quem está sem quadro.
// Os oficiais QOC e QOA têm a escala própria (Oficiais). Quem está sem quadro continua aqui, com a pendência na ficha.

/** Trecho `where` sobre o alias `m` de `militar`. */
export const SO_QBMG_OU_SEM_QUADRO = "(m.quadro_id is null or m.quadro_id = (select id from quadro where sigla = 'QBMG'))";

/** Motivo de um oficial QOC ou QOA numa vaga de praça. */
export const MOTIVO_OFICIAL = 'Oficial: fica na escala dos oficiais.';

/** O quadro (sigla) é de oficial? */
export const ehOficial = (quadro: string | null): boolean => quadro === 'QOC' || quadro === 'QOA';
