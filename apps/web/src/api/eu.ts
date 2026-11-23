import { queryOptions } from '@tanstack/react-query';
import type { UnidadeDeTrabalho } from 'contratos';
import { ErroApi, SEM_CONEXAO } from './cliente';

export type Papel = 'administrador' | 'gestor' | 'chefe_divisao' | 'escalante';

/** Resposta de GET /api/eu (mesmo formato de apps/api/src/rotas/eu.ts). */
export interface EuDaApi {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** As unidades em que a pessoa pode trabalhar, na ordem da árvore (o militar comum: só a lotação). */
  unidades: UnidadeDeTrabalho[];
  /** As unidades que a pessoa só consulta (a "Escala em montagem" vem das camadas de visão): as telas de escala abrem nelas sem nenhum botão de alterar. */
  unidadesSoConsulta: UnidadeDeTrabalho[];
  /** A unidade do período do rastreio de hoje; null sem lotação. */
  lotacao: UnidadeDeTrabalho | null;
  /** Entrou com a senha provisória: só a tela de criar a senha abre até a troca. */
  trocarSenha: boolean;
}

/**
 * Quem está logado, com a unidade em que as telas trabalham agora (a escolhida no seletor, calculada no `_app`). `soConsulta`: essa unidade é só de
 * consulta (a pessoa a vê e não a altera), então as telas de escala abrem sem os botões de alterar.
 */
export type Eu = EuDaApi & { unidade: UnidadeDeTrabalho; soConsulta: boolean };

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
/** Os níveis que editam como gestor (espelha GESTAO na API): o chefe de divisão é um gestor da sua divisão. */
const GESTAO: Papel[] = ['gestor', 'chefe_divisao', 'administrador'];
/** Quem usa a Escala dos oficiais: gestor, chefe de divisão ou administrador (a API confere o nível na unidade de qualquer jeito). */
export const ehGestorOuAdministrador = (eu: EuDaApi) => eu.papeis.some((p) => GESTAO.includes(p.papel));
/** Quem muda os parâmetros: os mesmos níveis. */
export const podeMudarParametro = ehGestorOuAdministrador;

/**
 * Os grupamentos cuja estrutura (divisões e seções) a pessoa gere: os que ela alcança como administrador, ou como gestor do próprio
 * grupamento ou de uma unidade acima dele. O chefe de divisão e o gestor de uma seção não gerem a estrutura.
 */
export function grupamentosQueGere(eu: EuDaApi): UnidadeDeTrabalho[] {
  const grupamentos = eu.unidades.filter((u) => u.tipo === 'grupamento');
  if (ehAdministrador(eu)) return grupamentos;
  const dosGestores = eu.papeis.filter((p) => p.papel === 'gestor').map((p) => eu.unidades.find((u) => u.id === p.unidadeId)?.caminho).filter((c) => c !== undefined);
  return grupamentos.filter((g) => dosGestores.some((c) => c.length <= g.caminho.length && c.every((sigla, i) => g.caminho[i] === sigla)));
}
