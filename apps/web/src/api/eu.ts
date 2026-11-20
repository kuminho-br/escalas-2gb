import { queryOptions } from '@tanstack/react-query';
import { ErroApi } from './cliente';

export type Papel = 'administrador' | 'gestor' | 'escalante';

/** Resposta de GET /api/eu (mesmo formato de apps/api/src/rotas/eu.ts). */
export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** Unidade em que as telas trabalham (fixa na fase de teste). */
  unidade: { id: string; sigla: string; caminho: string[] };
}

/** Quem está logado; null se não houver sessão. */
export async function buscarEu(): Promise<Eu | null> {
  const r = await fetch('/api/eu', { credentials: 'include' });
  if (r.status === 401) return null;
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    // a mensagem do servidor (ex.: banco desatualizado, 503) chega à tela de falha
    throw corpo?.erro ? new ErroApi(corpo.erro, r.status) : new Error(`Falha ao consultar a sessão (${r.status})`);
  }
  return (await r.json()) as Eu;
}

export const consultaEu = queryOptions({ queryKey: ['eu'], queryFn: buscarEu, staleTime: 60_000 });

export const ehAdministrador = (eu: Eu) => eu.papeis.some((p) => p.papel === 'administrador');
export const ehMilitarComum = (eu: Eu) => eu.papeis.length === 0;
/** Quem muda os parâmetros: gestor ou administrador (espelha ESCREVE_PARAMETRO na API). */
export const podeMudarParametro = (eu: Eu) => eu.papeis.some((p) => p.papel === 'gestor' || p.papel === 'administrador');
