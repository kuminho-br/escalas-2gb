// Núcleo: funções comuns a todo o motor (porte de prototipo/nucleo.js).
// Datas como no protótipo: dia 'aaaa-mm-dd', mês 'aaaa-mm', aritmética em UTC (sem fuso).

/** Militar como o motor o recebe (campos do cadastro). */
export interface Militar {
  mat: string;
  nome?: string;
  posto?: string;
  secao?: string;
  jornada?: string;
  equipe?: string;
  antig?: unknown;
  /** O campo se chama `antig`: escrever `antiguidade` é um erro de tipo (e não um campo ignorado em silêncio). */
  antiguidade?: never;
  /** A ordem do posto no cadastro (posto_grad.ordem: maior = mais antigo). Com ela, a antiguidade não depende da sigla, que o administrador pode renomear. */
  postoOrdem?: number;
  ordem?: number;
  [campo: string]: unknown;
}

/** 'Seção 1ª SB' e '1ºSB' viram '1SB': comparação sem acento, caixa ou pontuação. */
export function normalizar(s: unknown): string {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** 'aaaa-mm' -> ['aaaa-mm-01', ..., 'aaaa-mm-31']. */
export function diasDoMes(mes: string): string[] {
  const p = mes.split('-').map(Number);
  const total = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) dias.push(`${mes}-${String(d).padStart(2, '0')}`);
  return dias;
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(dia: string): number {
  const p = dia.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

/** Dias corridos desde 1970 de 'aaaa-mm-dd'. */
export function numeroDoDia(dia: string): number {
  const p = dia.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
}

/** 'ADM', a equipe do Pronto (ALFA…DELTA) ou 'SEM EQUIPE'. */
export function grupoDoMilitar(m: { jornada?: unknown; equipe?: unknown }): string {
  const jornada = normalizar(m.jornada);
  const equipe = normalizar(m.equipe);
  if (jornada === 'ADM') return 'ADM';
  if (jornada === 'PRONTO' && ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'].indexOf(equipe) >= 0) return equipe;
  return 'SEM EQUIPE';
}

export function antigNum(v: unknown): number | null {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/** Hierarquia (RN-02), do mais antigo (0) ao mais moderno. */
export const POSTOS_POR_ANTIGUIDADE = ['CEL', 'TC', 'MAJ', 'CAP', '1TEN', '2TEN', 'ASP', 'ST', '1SGT', '2SGT', '3SGT', 'CB', 'SD'];
export const POSTOS_SINONIMOS: Record<string, string> = {
  TENCEL: 'TC', MAJOR: 'MAJ', CAPITAO: 'CAP', ASPOF: 'ASP', SUBTEN: 'ST', SUBTENENTE: 'ST', CABO: 'CB', SOLDADO: 'SD',
};

/** Posição do posto na hierarquia; posto que não se reconhece vai para o fim (Infinity). */
export function ordemDoPosto(posto: unknown): number {
  let k = normalizar(posto).replace(/BM$/, '');
  if (POSTOS_SINONIMOS[k]) k = POSTOS_SINONIMOS[k];
  const i = POSTOS_POR_ANTIGUIDADE.indexOf(k);
  return i < 0 ? Infinity : i;
}

/**
 * Origem de uma alocação (RN-13, RN-94): a ORIGEM cadastrada para o serviço e turno, senão a de
 * qualquer turno do serviço, senão o nome do serviço em maiúsculas.
 * origens = { 'SERVIÇO|TURNO': 'PJES', 'SERVIÇO': 'PJES' }.
 */
export function origemDoServico(servico: unknown, origens?: Record<string, unknown> | null, turno?: unknown): string {
  const mapa = origens || {};
  const nS = normalizar(servico);
  const procura = (chave: unknown): string => {
    const k = Object.keys(mapa).filter(
      (x) => normalizar(x.split('|')[0]) === nS && (chave === null ? x.indexOf('|') < 0 : normalizar(x.split('|')[1]) === normalizar(chave)),
    )[0];
    return k ? String(mapa[k]).trim() : '';
  };
  const achou = (turno ? procura(turno) : '') || procura(null);
  const texto = achou || String(servico == null ? '' : servico).trim();
  return normalizar(texto) === '' ? '' : texto.toUpperCase();
}

/** Alocação como o motor a recebe. */
export interface Alocacao {
  mat: string;
  dia: string;
  servico: string;
  turno: string;
  funcao?: string;
  implicito?: boolean;
  [campo: string]: unknown;
}

/** Chave de uma alocação: matrícula + dia + serviço + turno (porte de chaveAloc_, de sincronia.js). */
export function chaveAloc(a: { mat: string; dia: string; servico: string; turno: string }): string {
  return `${a.mat}|${a.dia}|${a.servico}|${a.turno}`;
}

/** Tipo de serviço (cadastro de turnos) que marca uma diária, já normalizado. */
export const TIPO_DIARIA = 'DIARIA';

/** chave -> { mat, dia, servico, turno }. O serviço é tudo entre o dia e o último "|". */
export function partesDaChave(k: string): { mat: string; dia: string; servico: string; turno: string } {
  const p = k.split('|');
  return { mat: p[0], dia: p[1], servico: p.slice(2, -1).join('|'), turno: p[p.length - 1] };
}
