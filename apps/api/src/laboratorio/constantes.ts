/** O espelho do banco (Laboratório, 6.58): a mesma estrutura do real, só com dados de teste. O real continua no `public`, onde ficam também as extensões. */
export const SCHEMA_ESPELHO = 'laboratorio';

/** O papel de banco que a API assume ao falar com o espelho: sem privilégio algum sobre as tabelas do real. */
export const ESPELHO_PAPEL = 'laboratorio_app';
