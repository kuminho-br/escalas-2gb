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

/** "Viatura AR, Auto Resgate. Ativada em 2º lugar." — o que a versão em vigor diz da guarnição. */
export function resumoDaGuarnicao(v: VersaoSalva | undefined): string {
  const viatura = v?.viatura ? `Viatura ${v.viatura}${v.tipoViatura ? `, ${v.tipoViatura}` : ''}.` : 'Sem viatura.';
  const ordem = v?.prioridade != null ? `Ativada em ${v.prioridade}º lugar.` : 'Sem prioridade: vai por último na ativação.';
  return `${viatura} ${ordem}`;
}
