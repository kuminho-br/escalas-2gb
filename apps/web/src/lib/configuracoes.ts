/** As abas das configurações da escala (entrega 6.26): valem para a unidade de trabalho e ficam no módulo de escalas. As gerais ficam em /configuracoes. */
export const ABAS_DA_ESCALA = ['regras', 'voluntariado', 'modelos', 'meta'] as const;
export type AbaDaEscala = (typeof ABAS_DA_ESCALA)[number];
