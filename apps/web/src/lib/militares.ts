import type { FichaMilitar } from 'contratos';
import { hoje } from '@/lib/meses';

export const NOME_JORNADA = { pronto: 'Pronto', adm: 'Adm' } as const;

/** Uma linha com a lotação que cobre o dia de hoje. */
export function resumoDaLotacao(lotacoes: FichaMilitar['rastreio']): string {
  const dia = hoje();
  const l = lotacoes.find((x) => x.desde <= dia && (!x.ate || x.ate >= dia));
  if (!l) return 'Sem lotação';
  return `${l.unidadeSigla}, ${NOME_JORNADA[l.jornada]}${l.equipe ? ` (${l.equipe})` : ''} desde ${dataBr(l.desde)}`;
}

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
