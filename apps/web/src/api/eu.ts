import { queryOptions } from '@tanstack/react-query';
import type { UnidadeDeTrabalho } from 'contratos';
import { ErroApi, SEM_CONEXAO } from './cliente';

export type Papel = 'administrador' | 'gestor' | 'escalante';

/** Resposta de GET /api/eu (mesmo formato de apps/api/src/rotas/eu.ts). */
export interface EuDaApi {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** As unidades em que a pessoa pode trabalhar, na ordem da árvore (o militar comum: só a lotação). */
  unidades: UnidadeDeTrabalho[];
  /** A unidade do período do rastreio de hoje; null sem lotação. */
  lotacao: UnidadeDeTrabalho | null;
  /** Entrou com a senha provisória: só a tela de criar a senha abre até a troca. */
  trocarSenha: boolean;
}

/** Quem está logado, com a unidade em que as telas trabalham agora (a escolhida no seletor, calculada no `_app`). */
export type Eu = EuDaApi & { unidade: UnidadeDeTrabalho };

/** Quem está logado; null se não houver sessão. */
export async function buscarEu(): Promise<EuDaApi | null> {
  let r: Response;
  try {
    r = await fetch('/api/eu', { credentials: 'include' });
  } catch {
    // a tela de falha diferencia "sem conexão" de "erro do sistema"
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  if (r.status === 401) return null;
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    // a mensagem do servidor (ex.: banco desatualizado, 503) chega à tela de falha
    throw corpo?.erro ? new ErroApi(corpo.erro, r.status) : new Error(`Falha ao consultar a sessão (${r.status})`);
  }
  return (await r.json()) as EuDaApi;
}

export const consultaEu = queryOptions({ queryKey: ['eu'], queryFn: buscarEu, staleTime: 60_000 });

export const ehAdministrador = (eu: EuDaApi) => eu.papeis.some((p) => p.papel === 'administrador');
export const ehMilitarComum = (eu: EuDaApi) => eu.papeis.length === 0;
/** Quem muda os parâmetros: gestor ou administrador (espelha ESCREVE_PARAMETRO na API). */
export const podeMudarParametro = (eu: EuDaApi) => eu.papeis.some((p) => p.papel === 'gestor' || p.papel === 'administrador');
