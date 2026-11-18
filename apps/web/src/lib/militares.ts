import { mesPorExtenso, type FichaMilitar } from 'contratos';
import { mesAtual } from '@/lib/meses';

export const NOME_JORNADA = { pronto: 'Pronto', adm: 'Adm' } as const;

/** Uma linha com a lotação que cobre o mês corrente. */
export function resumoDaLotacao(lotacoes: FichaMilitar['lotacoes']): string {
  const mes = mesAtual();
  const l = lotacoes.find((x) => x.desde.slice(0, 7) <= mes && (!x.ate || x.ate.slice(0, 7) >= mes));
  if (!l) return 'Sem lotação';
  return `${l.unidadeSigla}, ${NOME_JORNADA[l.jornada]}${l.equipe ? ` (${l.equipe})` : ''} desde ${mesPorExtenso(l.desde.slice(0, 7))}`;
}
