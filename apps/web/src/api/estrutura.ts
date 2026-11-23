import { queryOptions } from '@tanstack/react-query';
import type { AlteracaoDeTipoDeUnidade, AlteracaoDeUnidade, EfeitoDeMover, NoDaArvore, NovaUnidade, NovoTipoDeUnidade, TipoDeUnidadeComUso } from 'contratos';
import { pedir } from './cliente';

/** A árvore de unidades a partir de `raiz`; sem ela, a API devolve a mais alta em que a pessoa tem nível de acesso. */
export const consultaEstrutura = (raiz?: string) =>
  queryOptions({ queryKey: ['estrutura', raiz ?? 'automatica'], queryFn: () => pedir<NoDaArvore>('GET', raiz ? `/api/estrutura?raiz=${raiz}` : '/api/estrutura') });

export const criarUnidade = (d: NovaUnidade) => pedir<NoDaArvore>('POST', '/api/unidades', d);
/** Renomeia (sigla, nome e tipo) e move (`maeId`, a unidade de cima nova). */
export const alterarUnidade = (id: string, d: AlteracaoDeUnidade) => pedir<NoDaArvore>('PATCH', `/api/unidades/${id}`, d);
export const extinguirUnidade = (id: string, ate: string) => pedir<{ id: string; ate: string }>('POST', `/api/unidades/${id}/extinguir`, { ate });
export const excluirUnidade = (id: string) => pedir<null>('DELETE', `/api/unidades/${id}`);
/** O aviso antes de mover: o que muda para quem alcança a unidade, o que ela herda e quem passa a ser irmã dela. */
export const consultaEfeitoDeMover = (id: string, maeId: string) =>
  queryOptions({ queryKey: ['estrutura', 'efeito', id, maeId], queryFn: () => pedir<EfeitoDeMover>('GET', `/api/unidades/${id}/efeito-de-mover?maeId=${maeId}`), staleTime: 0, gcTime: 0 });

/** Os tipos de unidade (qualquer conta lê): o nome de cada tipo e, para o administrador, quantas unidades usam. */
export const consultaTiposDeUnidade = queryOptions({ queryKey: ['tipos-de-unidade'], queryFn: () => pedir<TipoDeUnidadeComUso[]>('GET', '/api/tipos-de-unidade') });
export const criarTipoDeUnidade = (d: NovoTipoDeUnidade) => pedir<TipoDeUnidadeComUso>('POST', '/api/tipos-de-unidade', d);
export const alterarTipoDeUnidade = (id: string, d: AlteracaoDeTipoDeUnidade) => pedir<TipoDeUnidadeComUso>('PATCH', `/api/tipos-de-unidade/${id}`, d);
export const excluirTipoDeUnidade = (id: string) => pedir<null>('DELETE', `/api/tipos-de-unidade/${id}`);
