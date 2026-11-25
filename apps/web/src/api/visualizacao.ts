import { queryOptions } from '@tanstack/react-query';
import type { EscalaDoMes, EscalaVisivel, MinhaEscala } from 'contratos';
import { pedir } from './cliente';

/** Os serviços da própria conta no mês, nas escalas que já saíram do rascunho (7.3.1), com quem compõe cada guarnição. */
export const consultaMinhaEscala = (mes: string) => queryOptions({ queryKey: ['minha-escala', mes], queryFn: () => pedir<MinhaEscala>('GET', `/api/eu/escala/${mes}`) });

/** As escalas do mês que a conta pode ver (a prévia da unidade e das de baixo; a publicada, de toda a corporação). */
export const consultaEscalasVisiveis = (mes: string) => queryOptions({ queryKey: ['escalas-visiveis', mes], queryFn: () => pedir<EscalaVisivel[]>('GET', `/api/visualizacao/escalas/${mes}`) });

/** A escala do mês só para leitura; 404 se ela deixou de estar aberta para a conta. */
export const consultaEscalaEmLeitura = (escalaId: string, mes: string) =>
  queryOptions({ queryKey: ['escala-em-leitura', escalaId, mes], queryFn: () => pedir<EscalaDoMes>('GET', `/api/visualizacao/escalas/${escalaId}/mes/${mes}`), retry: false });
