import type { LinhaGuarnicao, VersaoSalva } from 'contratos';

/** "de 2 a 4 militares", "3 militares" ou "sem composição". */
export function limites(g: Pick<LinhaGuarnicao, 'minimo' | 'maximo'>): string {
  if (g.maximo === 0) return 'sem composição';
  return g.minimo === g.maximo ? `${g.minimo} ${g.minimo === 1 ? 'militar' : 'militares'}` : `de ${g.minimo} a ${g.maximo} militares`;
}

/** A versão em vigor no mês; sem nenhuma ainda, a primeira. As versões vêm da mais recente para a mais antiga. */
export function versaoVigente(versoes: VersaoSalva[], mes: string): VersaoSalva | undefined {
  return versoes.find((v) => v.vigencia <= mes) ?? versoes[versoes.length - 1];
}

/** "Viatura AR, Auto Resgate." — o que a versão em vigor diz da guarnição (a ordem de ativação agora é da escala). */
export function resumoDaGuarnicao(v: VersaoSalva | undefined): string {
  return v?.viatura ? `Viatura ${v.viatura}${v.tipoViatura ? `, ${v.tipoViatura}` : ''}.` : 'Sem viatura.';
}
