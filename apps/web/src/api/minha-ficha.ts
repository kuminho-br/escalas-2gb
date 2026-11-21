import { queryOptions } from '@tanstack/react-query';
import type { MinhaFicha } from 'contratos';
import { pedir } from './cliente';

export const consultaMinhaFicha = queryOptions({ queryKey: ['minha-ficha'], queryFn: () => pedir<MinhaFicha>('GET', '/api/eu/ficha') });

/** Só o telefone se altera; vazio (null) apaga. */
export const alterarTelefone = (telefone: string | null) => pedir<MinhaFicha>('PATCH', '/api/eu/telefone', { telefone });
