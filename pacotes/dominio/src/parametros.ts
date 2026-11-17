// Parâmetros do sistema e carga do Adm (porte de prototipo/parametros.js).
// Um parâmetro pode mudar com o tempo: para um mês vale a linha de vigência mais recente que não
// passa do mês (vigência vazia = vale desde sempre).
import { diaDaSemana, diasDoMes, normalizar } from './nucleo.ts';

export type TipoParametro = 'inteiro' | 'decimal' | 'texto' | 'simnao';
export type ValorParametro = number | string | boolean;

export interface DefParametro {
  chave: string;
  grupo?: string;
  rotulo?: string;
  tipo: TipoParametro;
  padrao?: ValorParametro;
  min?: number;
  max?: number;
  descricao?: string;
}

export const PARAM_CATALOGO: DefParametro[] = [
  {
    chave: 'CARGA_MENSAL_HORAS', grupo: 'Carga mensal', rotulo: 'Carga mensal (horas)', tipo: 'inteiro', padrao: 160, min: 1, max: 744,
    descricao: 'Horas que todo militar precisa cumprir no mês.',
  },
  {
    chave: 'SALDOS_ADM_POR_MILITAR', grupo: 'Adm', rotulo: 'Saldos por militar do Adm', tipo: 'inteiro', padrao: 6, min: 0, max: 31,
    descricao: 'Quantos saldos cada militar do Adm tira por mês. O escalante aloca os saldos à mão.',
  },
  {
    chave: 'ADM_CUMPRE_CARGA', grupo: 'Adm', rotulo: 'Adm cumpre a carga mensal', tipo: 'simnao', padrao: false,
    descricao: 'NÃO: o Adm só cumpre os saldos e fica de expediente em todo dia útil (usado para checar choques). SIM: o Adm também cumpre a carga mensal, e a Escala Automática distribui os turnos dele.',
  },
  {
    chave: 'LINHAS_POR_MILITAR', grupo: 'Escala', rotulo: 'Linhas por militar na escala', tipo: 'inteiro', padrao: 2, min: 1, max: 6,
    descricao: 'Quantas linhas cada militar tem na escala do mês: o espaço para o 1º, o 2º... serviço do dia. Vale na próxima vez que a escala for carregada.',
  },
  {
    chave: 'SECAO_PADRAO', grupo: 'Geral', rotulo: 'Seção padrão', tipo: 'texto', padrao: '1ª SB',
    descricao: 'Seção sugerida ao abrir os painéis.',
  },
];

const PARAM_MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface Conversao<T> { ok: boolean; valor: T; erro: string }

export function paramDef(chave: unknown): DefParametro | null {
  const k = normalizar(chave);
  for (const def of PARAM_CATALOGO) if (normalizar(def.chave) === k) return def;
  return null;
}

/** Converte o que veio da tela para o tipo do parâmetro. */
export function paramConverter(def: DefParametro, bruto: unknown): Conversao<ValorParametro | null> {
  const falha = (erro: string) => ({ ok: false, valor: null, erro });
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return falha('Informe um valor.');

  if (def.tipo === 'texto') {
    if (s.length > 120) return falha('Texto longo demais (máximo de 120 caracteres).');
    return { ok: true, valor: s, erro: '' };
  }
  if (def.tipo === 'simnao') {
    const n = normalizar(s);
    if (['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(n) >= 0) return { ok: true, valor: true, erro: '' };
    if (['NAO', 'N', '0', 'FALSE', 'FALSO'].indexOf(n) >= 0) return { ok: true, valor: false, erro: '' };
    return falha('Use SIM ou NÃO.');
  }

  const t = s.replace(',', '.');
  const inteiro = def.tipo === 'inteiro';
  if (!(inteiro ? /^-?\d+(\.0+)?$/ : /^-?\d+(\.\d+)?$/).test(t)) return falha(inteiro ? 'Use um número inteiro.' : 'Use um número.');
  const v = Number(t);
  if (def.min != null && v < def.min) return falha(`O mínimo é ${def.min}.`);
  if (def.max != null && v > def.max) return falha(`O máximo é ${def.max}.`);
  return { ok: true, valor: v, erro: '' };
}

/** '' (vale desde sempre) ou 'aaaa-mm' (aceita também 'mm/aaaa'). */
export function paramVigencia(bruto: unknown): Conversao<string> {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return { ok: true, valor: '', erro: '' };
  if (PARAM_MES_RE.test(s)) return { ok: true, valor: s, erro: '' };
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(s);
  if (m) return { ok: true, valor: `${m[2]}-${m[1]}`, erro: '' };
  return { ok: false, valor: '', erro: 'Mês inválido: use o formato aaaa-mm.' };
}

export interface LinhaParametro { linha: number; chave: unknown; valor: unknown; vigencia: unknown }
export interface LinhaBoa { linha: number; chave: string; def: DefParametro; valor: ValorParametro; vigencia: string }

/** Confere as linhas e separa as boas das ruins (estas viram aviso). */
export function paramValidarLinhas(linhas: LinhaParametro[]): { boas: LinhaBoa[]; avisos: string[] } {
  const boas: LinhaBoa[] = [];
  const avisos: string[] = [];
  linhas.forEach((l) => {
    const nome = `Linha ${l.linha} de CONFIGURAÇÕES`;
    const def = paramDef(l.chave);
    if (!def) { avisos.push(`${nome}: a chave "${l.chave}" não existe; ignorada.`); return; }
    const vig = paramVigencia(l.vigencia);
    if (!vig.ok) { avisos.push(`${nome} (${def.chave}): vigência "${l.vigencia}" inválida; ignorada.`); return; }
    const c = paramConverter(def, l.valor);
    if (!c.ok) { avisos.push(`${nome} (${def.chave}): ${c.erro} Linha ignorada.`); return; }
    boas.push({ linha: l.linha, chave: def.chave, def, valor: c.valor as ValorParametro, vigencia: vig.valor });
  });
  return { boas, avisos };
}

const porVigencia = (a: LinhaBoa, b: LinhaBoa) => (a.vigencia === b.vigencia ? a.linha - b.linha : a.vigencia < b.vigencia ? -1 : 1);

/** Valores em vigor num mês, com a origem de cada um. */
export function resolverParametros(linhas: LinhaParametro[], mes: string) {
  if (!PARAM_MES_RE.test(String(mes))) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const v = paramValidarLinhas(linhas);
  const valores: Record<string, ValorParametro | undefined> = {};
  const origem: Record<string, { vigencia: string; linha: number; padrao: boolean }> = {};
  PARAM_CATALOGO.forEach((def) => {
    const cands = v.boas.filter((b) => b.chave === def.chave && (b.vigencia === '' || b.vigencia <= mes));
    cands.sort(porVigencia);
    const w = cands.length ? cands[cands.length - 1] : null;
    valores[def.chave] = w ? w.valor : def.padrao;
    origem[def.chave] = w ? { vigencia: w.vigencia, linha: w.linha, padrao: false } : { vigencia: '', linha: 0, padrao: true };
  });
  return { valores, origem, avisos: v.avisos };
}

/** Histórico de uma chave, da vigência mais antiga para a mais nova. */
export function historicoParametro(linhas: LinhaParametro[], chave: string) {
  return paramValidarLinhas(linhas)
    .boas.filter((b) => b.chave === chave)
    .sort(porVigencia)
    .map((b) => ({ linha: b.linha, vigencia: b.vigencia, valor: b.valor }));
}

/* ------------------------------------------------------------ carga do Adm */

/** Dias úteis do mês: segunda a sexta, menos os feriados ({ 'aaaa-mm-dd': true }). */
export function diasUteisDoMes(mes: string, feriados?: Record<string, unknown> | null): string[] {
  const f = feriados || {};
  return diasDoMes(mes).filter((d) => {
    const w = diaDaSemana(d);
    return w >= 1 && w <= 5 && !f[d];
  });
}

/**
 * Quanto do mês sobra para o serviço normal do Adm depois dos saldos (horas e contagens).
 * Arredonda os turnos para cima, para nunca ficar abaixo da carga.
 */
export function calcularCargaAdm(p: { carga: number; saldos: number; horasSaldo: number; horasTurnoAdm: number; diasUteis: number }) {
  const horasSaldos = p.saldos * p.horasSaldo;
  const horasNormais = Math.max(0, p.carga - horasSaldos);
  const turnosAdm = p.horasTurnoAdm > 0 ? Math.ceil(horasNormais / p.horasTurnoAdm) : 0;
  return {
    carga: p.carga,
    horasSaldos,
    horasNormais,
    turnosAdm,
    diasUteis: p.diasUteis,
    cabe: turnosAdm <= p.diasUteis,
    saldosDemais: horasSaldos > p.carga,
  };
}

/** Duração de um saldo, lida do catálogo de turnos (porChave de montarHorarios). */
export function horasDoSaldo(porChave: Record<string, { dur: number }>): { horas: number; achou: boolean } {
  const chaves = Object.keys(porChave).filter((k) => normalizar(k.split('|')[0]) === 'SALDO').sort();
  if (!chaves.length) return { horas: 12, achou: false };
  return { horas: porChave[chaves[0]].dur / 60, achou: true };
}
