// O Laboratório (6.59): escolher o perfil de teste, ver o perfil em uso e sair. Estas rotas são do REAL: o `cliente` nunca as manda para `/api/lab/`.
import { queryOptions } from '@tanstack/react-query';
import type { PerfilDeTesteDto } from 'contratos';
import { pedir } from './cliente';

export type PerfilDeTeste = PerfilDeTesteDto;

export const consultaPerfisDeTeste = () => queryOptions({ queryKey: ['laboratorio', 'perfis'], queryFn: () => pedir<PerfilDeTeste[]>('GET', '/api/laboratorio/perfis'), retry: false });
/** O perfil em uso, ou `null` se a sessão no Laboratório acabou (a faixa volta a pessoa para o real). */
export const buscarPerfilEmUso = () => pedir<PerfilDeTeste | null>('GET', '/api/laboratorio/eu');
export const escolherPerfilDeTeste = (perfilId: string) => pedir<{ perfilId: string; nome: string }>('PUT', '/api/laboratorio/perfil', { perfilId });
export const encerrarSessaoNoLaboratorio = () => pedir<{ ok: true }>('DELETE', '/api/laboratorio/perfil');
