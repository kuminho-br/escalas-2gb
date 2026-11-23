import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { AlteracaoDeSituacao, EdicaoAfastamento, EdicaoMilitar, Equipe, FichaMilitar, FuncaoDoMilitar, LinhaMilitar, NovoAfastamento, NovoMilitar, NovoPosto, Posto, OQueVaiJunto, Quadro, SecaoDeLotacao, SituacaoDoMilitar } from 'contratos';
import { pedir } from './cliente';

export const consultaMilitares = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['militares', unidadeId, mes], queryFn: () => pedir<LinhaMilitar[]>('GET', `/api/unidades/${unidadeId}/militares?mes=${mes}`) });

export const consultaFicha = (id: string) => queryOptions({ queryKey: ['militar', id], queryFn: () => pedir<FichaMilitar>('GET', `/api/militares/${id}`) });

export const consultaEquipes = (unidadeId: string) =>
  queryOptions({ queryKey: ['equipes', unidadeId], queryFn: () => pedir<Equipe[]>('GET', `/api/unidades/${unidadeId}/equipes`), staleTime: 300_000 });

export const consultaPostos = queryOptions({ queryKey: ['postos'], queryFn: () => pedir<Posto[]>('GET', '/api/postos'), staleTime: Infinity });
export const consultaQuadros = queryOptions({ queryKey: ['quadros'], queryFn: () => pedir<Quadro[]>('GET', '/api/quadros'), staleTime: Infinity });

/** As seções em que a pessoa pode lotar um militar. */
export const consultaSecoes = queryOptions({ queryKey: ['secoes'], queryFn: () => pedir<SecaoDeLotacao[]>('GET', '/api/secoes'), staleTime: 300_000 });

export const criarMilitar = (unidadeId: string, d: NovoMilitar) => pedir<FichaMilitar>('POST', `/api/unidades/${unidadeId}/militares`, d);
export const editarMilitar = (id: string, d: EdicaoMilitar) => pedir<FichaMilitar>('PATCH', `/api/militares/${id}`, d);
export const consultaSituacoesDoMilitar = queryOptions({ queryKey: ['situacoes-do-militar'], queryFn: () => pedir<SituacaoDoMilitar[]>('GET', '/api/situacoes-do-militar') });
export const consultaFuncoesDoMilitar = queryOptions({ queryKey: ['funcoes-do-militar'], queryFn: () => pedir<FuncaoDoMilitar[]>('GET', '/api/funcoes-do-militar') });
/** O que sai junto quando o administrador apaga o militar, e a exclusão (com a matrícula digitada). */
export const consultaExclusao = (id: string) => queryOptions({ queryKey: ['militar', id, 'exclusao'], queryFn: () => pedir<OQueVaiJunto>('GET', `/api/militares/${id}/exclusao`), staleTime: 0 });
export const apagarMilitar = (id: string, matricula: string) => pedir('DELETE', `/api/militares/${id}`, { matricula });
export const editarPosto = (id: string, d: NovoPosto) => pedir<Posto>('PATCH', `/api/postos/${id}`, d);
export const alterarSituacao = (id: string, d: AlteracaoDeSituacao) => pedir<FichaMilitar>('POST', `/api/militares/${id}/situacao`, d);
export const criarAfastamento = (militarId: string, d: NovoAfastamento) => pedir('POST', `/api/militares/${militarId}/afastamentos`, d);
export const editarAfastamento = (id: string, d: EdicaoAfastamento) => pedir('PATCH', `/api/afastamentos/${id}`, d);
export const apagarAfastamento = (id: string) => pedir('DELETE', `/api/afastamentos/${id}`);

/** Depois de gravar: lista, equipes (a importação cria) e fichas voltam a buscar. */
export function atualizarMilitares(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ['militares'] });
  void queryClient.invalidateQueries({ queryKey: ['equipes'] });
  void queryClient.invalidateQueries({ queryKey: id ? ['militar', id] : ['militar'] });
}
