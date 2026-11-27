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

// As ferramentas em teste e o retorno (6.60): rotas do REAL (o cliente nunca as manda para /api/lab/), mesmo com o site em modo Laboratório.
import type { FerramentaDeTeste, MudarFerramenta, NovaFerramenta, NovoRetorno, RetornoListado } from 'contratos';

export type { FerramentaDeTeste, RetornoListado };

export const consultaFerramentas = () =>
  queryOptions({ queryKey: ['laboratorio', 'ferramentas'], queryFn: () => pedir<FerramentaDeTeste[]>('GET', '/api/laboratorio/ferramentas'), retry: false });

export interface FiltroDeRetornos {
  ferramenta?: string;
  de?: string;
  ate?: string;
}
export const consultaRetornos = (f: FiltroDeRetornos) => {
  const busca = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  return queryOptions({ queryKey: ['laboratorio', 'retornos', f], queryFn: () => pedir<RetornoListado[]>('GET', `/api/laboratorio/retornos${busca ? `?${busca}` : ''}`), retry: false });
};

export const cadastrarFerramenta = (d: NovaFerramenta) => pedir<FerramentaDeTeste>('POST', '/api/laboratorio/ferramentas', d);
export const mudarFerramentaDeTeste = (id: string, d: MudarFerramenta) => pedir<FerramentaDeTeste>('PATCH', `/api/laboratorio/ferramentas/${id}`, d);
export const enviarRetorno = (d: NovoRetorno) => pedir<{ ok: true }>('POST', '/api/laboratorio/retornos', d);
