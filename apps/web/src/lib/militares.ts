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

const soDigitos = (v: string) => v.replace(/\D/g, '');
/** "52998224725" → "529.982.247-25" (o que ainda não tem os 11 dígitos aparece até onde foi digitado). */
export function mascararCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/^(\d{1,3})(\d{1,3})?(\d{1,3})?(\d{1,2})?$/, (_, a: string, b?: string, c?: string, e?: string) => a + (b ? `.${b}` : '') + (c ? `.${c}` : '') + (e ? `-${e}` : ''));
}
/** "50030230" → "50030-230". */
export function mascararCep(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
