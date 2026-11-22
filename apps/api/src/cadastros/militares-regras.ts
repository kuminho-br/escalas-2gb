// Regras de exibição da lista de militares (especificação de telas, "Militares").
import { diasDoMes } from 'dominio';

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** 'Disponível', 'Férias até 12/12', 'LTS de 03/12 a 20/12', 'Curso desde 10/12' ou 'Férias o mês todo'. */
export function situacaoNoMes(afast: { tipo: string; inicio: string; fim: string }[], mes: string): string {
  const dias = diasDoMes(mes);
  const primeiro = dias[0]!;
  const ultimo = dias[dias.length - 1]!;
  const textos = afast
    .filter((a) => a.inicio <= ultimo && a.fim >= primeiro)
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
    .map((a) => {
      const comecaAntes = a.inicio <= primeiro;
      const terminaDepois = a.fim >= ultimo;
      if (comecaAntes && terminaDepois) return `${a.tipo} o mês todo`;
      if (comecaAntes) return `${a.tipo} até ${ddmm(a.fim)}`;
      if (terminaDepois) return `${a.tipo} desde ${ddmm(a.inicio)}`;
      return `${a.tipo} de ${ddmm(a.inicio)} a ${ddmm(a.fim)}`;
    });
  return textos.length ? textos.join(' · ') : 'Disponível';
}

/** Avisos de cadastro incompleto. */
export function pendenciasDoMilitar(m: {
  motorista: boolean;
  cnh: string[];
  jornada: string | null;
  equipe: string | null;
  antiguidade: number | null;
  /** o nome completo é obrigatório para militar novo; quem já existia fica sem, e a pendência lembra de preencher */
  nomeCompleto: string | null;
  /** id do quadro (QOC, QOA ou QBMG); sem ele, a pendência "Sem quadro" */
  quadro: string | null;
  /** nomes de guerra dos outros militares com a mesma antiguidade */
  repetidaCom?: string[];
}): string[] {
  const p: string[] = [];
  if (m.motorista && m.cnh.length === 0) p.push('Motorista sem categoria de CNH');
  if (m.jornada === 'pronto' && !m.equipe) p.push('Pronto sem equipe');
  if (m.jornada === null) p.push('Sem lotação');
  if (m.antiguidade === null) p.push('Sem antiguidade');
  if (!m.nomeCompleto?.trim()) p.push('Nome completo em falta');
  if (!m.quadro) p.push('Sem quadro');
  // com muitos repetidos, os nomes não cabem: a ficha lista quais são e a pendência dá só o número
  if (m.repetidaCom?.length) p.push(m.repetidaCom.length > 3 ? `Antiguidade repetida com ${m.repetidaCom.length} militares` : `Antiguidade repetida com ${m.repetidaCom.join(', ')}`);
  return p;
}

/** Para cada militar que divide a antiguidade com outros, os nomes de guerra desses outros. */
export function repetidasPorAntiguidade(militares: { id: string; nomeGuerra: string; antiguidade: number | null }[]): Map<string, string[]> {
  const porNumero = new Map<number, typeof militares>();
  for (const m of militares) {
    if (m.antiguidade !== null) porNumero.set(m.antiguidade, [...(porNumero.get(m.antiguidade) ?? []), m]);
  }
  const repetidas = new Map<string, string[]>();
  for (const grupo of porNumero.values()) {
    if (grupo.length < 2) continue;
    for (const m of grupo) repetidas.set(m.id, grupo.filter((o) => o.id !== m.id).map((o) => o.nomeGuerra));
  }
  return repetidas;
}

const ORDEM_CNH = ['E', 'D', 'C', 'B', 'A'];

/** A categoria mais alta da carteira (E > D > C > B > A); null sem carteira. */
export function categoriaMaisAlta(cnh: string[]): string | null {
  return ORDEM_CNH.find((c) => cnh.includes(c)) ?? null;
}
