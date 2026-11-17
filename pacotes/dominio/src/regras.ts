// Regras da escala (porte de prototipo/regras_escala.js, sem as funções da planilha).
// Cada regra olha a lista de alocações e devolve as que a violam:
//   RN-03  Saldo só para militar do Adm;
//   RN-36  no máximo uma diária por militar por dia, contada pelo dia em que o turno começa
//          (RN-37: a dobradinha 16h–00h + 00h–08h começa em dias diferentes e é permitida);
//   RN-46  JES só para militar voluntário JES.
// ctx: { adm: { mat: true }, tipos: { 'Serviço': 'Tipo' }, voluntariosJes: { mat: true } | null }
// (voluntariosJes null = o cadastro não informa; a RN-46 fica desligada).
import { chaveAloc, normalizar, TIPO_DIARIA } from './nucleo.ts';

export const SERVICO_SALDO = 'SALDO';

export interface AlocRegra { mat: string; dia: string; servico: string; turno: string; implicito?: boolean }
export interface ContextoRegras {
  adm?: Record<string, unknown> | null;
  tipos?: Record<string, string> | null;
  voluntariosJes?: Record<string, unknown> | null;
}
export interface Violacao { chave: string; mat: string; dia: string; servico: string; turno: string; rn: string; texto: string }

export function ehSaldo(servico: unknown): boolean {
  return normalizar(servico) === SERVICO_SALDO;
}

const violacao = (a: AlocRegra, rn: string, texto: string, chave = chaveAloc(a)): Violacao => ({
  chave, mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, rn, texto,
});

/** RN-03: o Saldo só pode ser lançado para militar do Adm. */
export function violacoesSaldo(alocs: AlocRegra[], ctx: ContextoRegras): Violacao[] {
  const adm = ctx.adm || {};
  const res: Violacao[] = [];
  alocs.forEach((a) => {
    if (!ehSaldo(a.servico) || adm[a.mat]) return;
    res.push(violacao(a, 'RN-03', 'Saldo só para militar do Adm (RN-03)'));
  });
  return res;
}

/** RN-36 / RN-37: duas diárias do mesmo militar com início no mesmo dia (todas são apontadas). */
export function violacoesDiariaUnica(alocs: AlocRegra[], ctx: ContextoRegras): Violacao[] {
  const tipos = ctx.tipos || {};
  const grupos: Record<string, Record<string, AlocRegra>> = Object.create(null);
  alocs.forEach((a) => {
    if (normalizar(tipos[a.servico] || '') !== TIPO_DIARIA) return;
    const g = `${a.mat}|${a.dia}`;
    const k = chaveAloc(a);
    if (!grupos[g]) grupos[g] = Object.create(null);
    if (!(k in grupos[g])) grupos[g][k] = a;
  });
  const res: Violacao[] = [];
  Object.keys(grupos).forEach((g) => {
    const chaves = Object.keys(grupos[g]);
    if (chaves.length < 2) return;
    chaves.forEach((k) => res.push(violacao(grupos[g][k], 'RN-36', 'Duas diárias começando no mesmo dia (RN-36)', k)));
  });
  return res;
}

// serviços que só militar voluntário pode cumprir (RN-46)
export const SERVICOS_SO_VOLUNTARIOS = ['JES'];

export function exigeVoluntarioJes(servico: unknown): boolean {
  return SERVICOS_SO_VOLUNTARIOS.indexOf(normalizar(servico)) >= 0;
}

/** RN-46: JES lançado para militar que não é voluntário. Sem a informação (null) a regra não age. */
export function violacoesJesVoluntario(alocs: AlocRegra[], ctx: ContextoRegras): Violacao[] {
  const vol = ctx.voluntariosJes;
  if (!vol) return [];
  const res: Violacao[] = [];
  alocs.forEach((a) => {
    if (!exigeVoluntarioJes(a.servico) || vol[a.mat]) return;
    res.push(violacao(a, 'RN-46', 'JES só para militar voluntário (VOLUNTÁRIO JES = sim) (RN-46)'));
  });
  return res;
}

/**
 * RN-46: separa as linhas do voluntariado de quem não é voluntário JES ("ignoradas" = não valem
 * para o JES). voluntariosJes null: nenhuma é separada.
 */
export function separarVoluntariado<T extends { mat: string }>(linhas: T[], voluntariosJes?: Record<string, unknown> | null) {
  if (!voluntariosJes) return { linhas: linhas.slice(), ignoradas: {} as Record<string, number> };
  const ignoradas: Record<string, number> = Object.create(null);
  const validas: T[] = [];
  linhas.forEach((l) => {
    if (voluntariosJes[l.mat]) validas.push(l);
    else ignoradas[l.mat] = (ignoradas[l.mat] || 0) + 1;
  });
  return { linhas: validas, ignoradas };
}

/** Todas as verificações, na ordem em que aparecem para o usuário. */
export const VERIFICACOES_ESCALA = [violacoesSaldo, violacoesDiariaUnica, violacoesJesVoluntario];

/** Todas as violações das alocações; ignora o expediente implícito. */
export function violacoesDeRegras(alocs: AlocRegra[], ctx?: ContextoRegras | null): Violacao[] {
  const reais = alocs.filter((a) => !a.implicito);
  let res: Violacao[] = [];
  VERIFICACOES_ESCALA.forEach((v) => {
    res = res.concat(v(reais, ctx || {}));
  });
  return res;
}
