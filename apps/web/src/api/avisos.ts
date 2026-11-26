import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Aviso, MudarAviso, NovoAviso, QuadroDeAvisos } from 'contratos';
import { pedir } from './cliente';

/** Os avisos da tela inicial (6.56): os visíveis à conta e se ela pode publicar. Sem nova tentativa: se a API não responde, o painel some. */
export const consultaAvisos = () => queryOptions({ queryKey: ['avisos'], queryFn: () => pedir<QuadroDeAvisos>('GET', '/api/avisos'), retry: false });

export const publicarAviso = (corpo: NovoAviso) => pedir<Aviso>('POST', '/api/avisos', corpo);
export const mudarAviso = (id: string, corpo: MudarAviso) => pedir<Aviso>('PATCH', `/api/avisos/${id}`, corpo);
export const retirarAviso = (id: string) => pedir<void>('POST', `/api/avisos/${id}/retirar`);

/** Depois de publicar, editar ou retirar: a lista volta a buscar. */
export const atualizarAvisos = (queryClient: QueryClient) => void queryClient.invalidateQueries({ queryKey: ['avisos'] });
