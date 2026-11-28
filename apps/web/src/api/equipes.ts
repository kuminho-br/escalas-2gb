import type { Equipe, ResultadoDaExclusaoDeEquipe } from 'contratos';
import { pedir } from './cliente';

// O cadastro das equipes (6.64): a unidade vê as da corporação, as de cima e as dela (`consultaEquipes`, em `militares.ts`); aqui o que o gestor muda.

/** Por rota só se cria equipe do tipo ADM (as do Pronto e a Externa são as padrão da corporação). */
export const incluirEquipe = (unidadeId: string, nome: string) => pedir<Equipe>('POST', `/api/unidades/${unidadeId}/equipes`, { nome, tipo: 'adm' });
export const renomearEquipe = (id: string, nome: string) => pedir<Equipe>('PATCH', `/api/equipes/${id}`, { nome });
export const reativarEquipe = (id: string) => pedir<Equipe>('PATCH', `/api/equipes/${id}`, { ativa: true });
/** A equipe usada em algum mês não se apaga: a API a desativa e diz isso em `aviso`. */
export const excluirEquipe = (id: string) => pedir<ResultadoDaExclusaoDeEquipe>('DELETE', `/api/equipes/${id}`);
