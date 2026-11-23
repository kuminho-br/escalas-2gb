import { queryOptions } from '@tanstack/react-query';
import type { UnidadeDeTrabalho } from 'contratos';
import { ErroApi, SEM_CONEXAO } from './cliente';

export type Papel = 'administrador' | 'gestor' | 'gestor_lateral' | 'escalante';

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
  /** Tem nível de acesso vigente, mas só em unidades que foram extintas: a tela "Sem lotação" explica. */
  nivelSoEmUnidadeExtinta: boolean;
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
/** Os níveis que editam como gestor (espelha GESTAO na API): o quinto nível edita como gestor na sua unidade e abaixo dela. */
const GESTAO: Papel[] = ['gestor', 'gestor_lateral', 'administrador'];
/** Quem usa a Escala dos oficiais: gestor, o quinto nível ou administrador (a API confere o nível na unidade de qualquer jeito). */
export const ehGestorOuAdministrador = (eu: EuDaApi) => eu.papeis.some((p) => GESTAO.includes(p.papel));
/**
 * Gestor, quinto nível ou administrador na unidade escolhida (ou acima dela): o nível que vale para as telas daquela unidade. Um nível
 * em outra unidade, que não alcança esta, não conta.
 */
export const ehGestorNaUnidade = (eu: Eu) =>
  eu.papeis.some((p) => {
    if (!GESTAO.includes(p.papel)) return false;
    const dele = eu.unidades.find((u) => u.id === p.unidadeId)?.caminho;
    return dele !== undefined && dele.length <= eu.unidade.caminho.length && dele.every((sigla, i) => eu.unidade.caminho[i] === sigla);
  });
/** Quem muda os parâmetros: os mesmos níveis. */
export const podeMudarParametro = ehGestorOuAdministrador;

/**
 * As unidades de onde a árvore da pessoa começa: cada unidade em que ela tem nível de acesso e que não está abaixo de outra em que ela também tem
 * (quem tem nível numa unidade e na de cima dela só começa pela de cima).
 */
export function raizesDaEstrutura(eu: EuDaApi): UnidadeDeTrabalho[] {
  const dosNiveis = eu.papeis.map((p) => eu.unidades.find((u) => u.id === p.unidadeId)).filter((u): u is UnidadeDeTrabalho => u !== undefined);
  const raizes = dosNiveis.filter((u) => !dosNiveis.some((o) => o.id !== u.id && o.caminho.length < u.caminho.length && o.caminho.every((sigla, i) => u.caminho[i] === sigla)));
  return raizes.filter((u, i) => raizes.findIndex((o) => o.id === u.id) === i);
}
