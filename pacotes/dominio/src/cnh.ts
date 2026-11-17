// CNH e cadastro de guarnições (porte de prototipo/cadastro_guarnicoes.js).
// O cadastro tem uma linha por GUARNIÇÃO + FUNÇÃO, com vigência (RN-93: alteração não retroage).
import { normalizar } from './nucleo.ts';

const CADG_MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** '' (desde sempre) ou 'aaaa-mm'. Aceita também mm/aaaa. */
function cadgVigencia(bruto: unknown): { ok: boolean; valor: string } {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return { ok: true, valor: '' };
  if (CADG_MES_RE.test(s)) return { ok: true, valor: s };
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(s);
  return m ? { ok: true, valor: `${m[2]}-${m[1]}` } : { ok: false, valor: '' };
}

/** SIM/NÃO; vazio ou texto desconhecido devolve o padrão. */
function cadgSimNao(bruto: unknown, padrao: boolean): boolean {
  const n = normalizar(bruto);
  if (n === '') return padrao;
  if (['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(n) >= 0) return true;
  if (['NAO', 'N', '0', 'FALSE', 'FALSO', '-'].indexOf(n) >= 0) return false;
  return padrao;
}

/** Lista separada por vírgula, ponto e vírgula ou barra -> ['B','D'] (sem acento/caixa, sem repetir). */
function cadgLista(bruto: unknown): string[] {
  return String(bruto == null ? '' : bruto)
    .split(/[,;/]+/)
    .map((x) => normalizar(x))
    .filter((x, i, a) => x !== '' && a.indexOf(x) === i);
}

/** Inteiro >= 0; '' devolve null (não informado); outro texto devolve NaN. */
function cadgInteiro(bruto: unknown): number | null {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}

/** Só existem as categorias A, B, C, D e E. */
export const CNH_CATEGORIAS = 'ABCDE';

/** Hierarquia do CTB (RN-12), fixa no código: cada categoria -> as que ela habilita. */
export const CNH_HABILITA: Record<string, string[]> = { E: ['E', 'D', 'C', 'B'], D: ['D', 'C', 'B'], C: ['C', 'B'], B: ['B'], A: ['A'] };

/** As categorias que o militar pode dirigir, pela hierarquia. ['A','D'] -> ['A','D','C','B']. */
export function cnhHabilitadas(doMilitar: unknown[] | null | undefined): string[] {
  const out: string[] = [];
  (doMilitar || []).forEach((x) => {
    const c = normalizar(x);
    (CNH_HABILITA[c] || [c]).forEach((h) => {
      if (out.indexOf(h) < 0) out.push(h);
    });
  });
  return out;
}

/** Categorias da coluna CNH do militar: "AD" é A + D; pedaços que não são categoria voltam em invalidas. */
export function categoriasCnh(bruto: unknown): { categorias: string[]; invalidas: string[] } {
  const categorias: string[] = [];
  const invalidas: string[] = [];
  String(bruto == null ? '' : bruto)
    .split(/[,;/\s]+/)
    .forEach((pedaco) => {
      const p = String(pedaco).trim();
      if (!p || p === '-') return;
      const n = normalizar(p);
      if (!/^[A-Z]+$/.test(n) || n.split('').some((ch) => CNH_CATEGORIAS.indexOf(ch) < 0)) {
        invalidas.push(p);
        return;
      }
      n.split('').forEach((ch) => {
        if (categorias.indexOf(ch) < 0) categorias.push(ch);
      });
    });
  return { categorias, invalidas };
}

/** RN-12: a CNH do militar atende alguma das exigidas (pela hierarquia)? Nenhuma exigida = atende. */
export function cnhAtende(doMilitar: unknown[] | null | undefined, exigidas: unknown[] | null | undefined): boolean {
  const ex = (exigidas || []).slice();
  if (ex.length === 0) return true;
  const tem = cnhHabilitadas(doMilitar);
  return ex.some((c) => tem.indexOf(normalizar(c)) >= 0);
}

export interface LinhaGuarnicao {
  linha: number;
  vigencia?: unknown;
  guarnicao?: unknown;
  viatura?: unknown;
  tipo?: unknown;
  ativar?: unknown;
  prioridade?: unknown;
  cnh?: unknown;
  funcao?: unknown;
  minimo?: unknown;
  maximo?: unknown;
}

export interface FuncaoGuarnicao { funcao: string; minimo: number; maximo: number | null; cnh: string[] }

export interface Guarnicao {
  id: string;
  viatura: string;
  tipo: string;
  ativar: boolean;
  prioridade: number | null;
  cnh: string[];
  funcoes: FuncaoGuarnicao[];
}

export interface Guarnicoes { guarnicoes: Guarnicao[]; porId: Record<string, Guarnicao>; avisos: string[] }

interface FuncaoEmMontagem { funcao: string; minimo: number; maximo: number | null; cnh: string[] | null; ordem: number }
interface GuarnicaoEmMontagem {
  id: string;
  viatura: string | null;
  tipo: string;
  ativar: boolean | null;
  prioridade: number | null;
  funcoes: FuncaoEmMontagem[];
  f: Record<string, FuncaoEmMontagem>;
  cnhSemFuncao: { linha: number; cnh: string[] } | null;
}

const texto = (v: unknown) => String(v == null ? '' : v).trim();

/**
 * Valores em vigor num mês, por guarnição, em ordem de prioridade de ativação (RN-08) e, empatando,
 * pelo nome. As funções saem na ordem das linhas do cadastro.
 */
export function resolverGuarnicoes(linhas: LinhaGuarnicao[], mes: string): Guarnicoes {
  if (!CADG_MES_RE.test(String(mes))) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const avisos: string[] = [];
  const montagem: Record<string, GuarnicaoEmMontagem> = Object.create(null);
  const ordemEntrada: string[] = [];

  // só o que já está em vigor no mês (RN-93: o que vier depois não retroage)
  const validas: { linha: number; vig: string; id: string; chave: string; l: LinhaGuarnicao; min: number | null; max: number | null; prio: number | null }[] = [];
  linhas.forEach((l) => {
    const onde = `GUARNIÇÕES, linha ${l.linha}`;
    const id = texto(l.guarnicao);
    if (!id) return;
    const vig = cadgVigencia(l.vigencia);
    if (!vig.ok) {
      avisos.push(`${onde}: vigência "${l.vigencia}" inválida (use aaaa-mm); linha ignorada.`);
      return;
    }
    const min = cadgInteiro(l.minimo);
    const max = cadgInteiro(l.maximo);
    const prio = cadgInteiro(l.prioridade);
    if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(prio)) {
      avisos.push(`${onde} (${id}): MÍNIMO, MÁXIMO e PRIORIDADE precisam ser números inteiros; linha ignorada.`);
      return;
    }
    if (min !== null && max !== null && max < min) {
      avisos.push(`${onde} (${id}${l.funcao ? `, ${l.funcao}` : ''}): o máximo (${max}) é menor que o mínimo (${min}); linha ignorada.`);
      return;
    }
    if (vig.valor !== '' && vig.valor > mes) return;
    validas.push({ linha: l.linha, vig: vig.valor, id, chave: normalizar(id), l, min, max, prio });
  });

  // mais recente primeiro: a linha que vale é a primeira que informou cada dado
  validas.sort((a, b) => (a.vig === b.vig ? b.linha - a.linha : a.vig < b.vig ? 1 : -1));

  validas.forEach((r) => {
    let g = montagem[r.chave];
    if (!g) {
      g = montagem[r.chave] = { id: r.id, viatura: null, tipo: '', ativar: null, prioridade: null, funcoes: [], f: Object.create(null), cnhSemFuncao: null };
      ordemEntrada.push(r.chave);
    }
    // dados da guarnição: vale o último informado até o mês (campo por campo)
    if (g.viatura === null && texto(r.l.viatura) !== '') g.viatura = texto(r.l.viatura);
    if (g.tipo === '' && texto(r.l.tipo) !== '') g.tipo = texto(r.l.tipo);
    if (g.ativar === null && normalizar(r.l.ativar) !== '') g.ativar = cadgSimNao(r.l.ativar, true); // RN-07
    if (g.prioridade === null && r.prio !== null) g.prioridade = r.prio; // RN-08
    // mínimo e máximo por função (RN-10, RN-11); a CNH também é por função (RN-12)
    const f = texto(r.l.funcao);
    const cnh = cadgLista(r.l.cnh);
    if (f) {
      const kf = normalizar(f);
      if (!(kf in g.f)) g.f[kf] = { funcao: f, minimo: r.min === null ? 0 : r.min, maximo: r.max, cnh: null, ordem: r.linha };
      const fx = g.f[kf];
      if (fx.cnh === null && cnh.length) fx.cnh = cnh;
      if (r.linha < fx.ordem) fx.ordem = r.linha;
    } else if (cnh.length && g.cnhSemFuncao === null) {
      g.cnhSemFuncao = { linha: r.linha, cnh };
    }
  });

  const porId: Record<string, Guarnicao> = Object.create(null);
  const guarnicoes = ordemEntrada.map((k) => {
    const m = montagem[k];
    const funcoes = Object.keys(m.f)
      .map((kf) => m.f[kf])
      .filter((f) => f.maximo !== 0) // MÁXIMO 0 = função retirada dessa guarnição
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => ({ funcao: f.funcao, minimo: f.minimo, maximo: f.maximo, cnh: f.cnh || [] }));
    const cnh: string[] = []; // só para resumo: as categorias que alguma função exige
    funcoes.forEach((f) => f.cnh.forEach((c) => {
      if (cnh.indexOf(c) < 0) cnh.push(c);
    }));
    if (m.cnhSemFuncao) {
      avisos.push(`GUARNIÇÕES, linha ${m.cnhSemFuncao.linha} (${m.id}): CNH "${m.cnhSemFuncao.cnh.join('/')}" numa linha sem FUNÇÃO. A CNH é exigida de quem ocupa uma função (B58, RN-12): ponha a categoria na linha da função de condutor. Esta não vale para posto nenhum.`);
    }
    const g: Guarnicao = {
      id: m.id,
      viatura: m.viatura || '', // vazio = guarnição sem viatura (RN-96)
      tipo: m.tipo,
      ativar: m.ativar === null ? true : m.ativar, // RN-07: sem dizer nada, é para ativar
      prioridade: m.prioridade,
      cnh,
      funcoes,
    };
    porId[k] = g;
    return g;
  });
  // RN-08: prioridade 1 primeiro; sem prioridade vai por último
  guarnicoes.sort((a, b) => {
    const pa = a.prioridade === null ? Infinity : a.prioridade;
    const pb = b.prioridade === null ? Infinity : b.prioridade;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { guarnicoes, porId, avisos };
}

/** Guarnição pelo nome (o texto da coluna GUARNIÇÃO / da UNIDADE das alocações). */
export function guarnicaoPorNome(res: Guarnicoes | null | undefined, nome: unknown): Guarnicao | null {
  const k = normalizar(nome);
  return k && res && res.porId[k] ? res.porId[k] : null;
}

/** RN-10 / RN-11: confere a guarnição montada contra o mínimo e o máximo do cadastro. */
export function avaliarGuarnicao(g: Pick<Guarnicao, 'funcoes'> | null | undefined, contagem: Record<string, number> | null | undefined) {
  const tem: Record<string, number> = Object.create(null);
  const c = contagem || {};
  Object.keys(c).forEach((k) => {
    tem[normalizar(k)] = c[k];
  });
  const faltando: { funcao: string; minimo: number; tem: number; falta: number }[] = [];
  const excedendo: { funcao: string; maximo: number; tem: number }[] = [];
  const vagas: Record<string, number | null> = Object.create(null);
  (g ? g.funcoes : []).forEach((f) => {
    const n = tem[normalizar(f.funcao)] || 0;
    if (n < f.minimo) faltando.push({ funcao: f.funcao, minimo: f.minimo, tem: n, falta: f.minimo - n });
    if (f.maximo !== null && n > f.maximo) excedendo.push({ funcao: f.funcao, maximo: f.maximo, tem: n });
    vagas[f.funcao] = f.maximo === null ? null : Math.max(0, f.maximo - n);
  });
  return { ativa: faltando.length === 0, faltando, excedendo, vagas };
}
