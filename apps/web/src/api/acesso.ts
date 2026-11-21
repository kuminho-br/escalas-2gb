import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { AcessoDoMilitar, NovoPapel, SenhaProvisoria } from 'contratos';
import { pedir } from './cliente';

export const consultaAcesso = (militarId: string) =>
  queryOptions({ queryKey: ['acesso', militarId], queryFn: () => pedir<AcessoDoMilitar>('GET', `/api/militares/${militarId}/acesso`) });

export const gerarSenhaProvisoria = (militarId: string) => pedir<SenhaProvisoria>('POST', `/api/militares/${militarId}/senha-provisoria`);
export const desativarAcesso = (militarId: string) => pedir<AcessoDoMilitar>('POST', `/api/militares/${militarId}/desativar-acesso`);
export const darPapel = (militarId: string, d: NovoPapel) => pedir<AcessoDoMilitar>('POST', `/api/militares/${militarId}/papeis`, d);
export const encerrarPapel = (papelId: string, ate: string) => pedir<AcessoDoMilitar>('POST', `/api/papeis/${papelId}/encerrar`, { ate });
/** A troca da senha provisória pela definitiva (a tela "Crie a sua senha"). */
export const trocarSenha = (novaSenha: string) => pedir<null>('POST', '/api/eu/senha', { novaSenha });

export const atualizarAcesso = (queryClient: QueryClient, militarId: string) => queryClient.invalidateQueries({ queryKey: ['acesso', militarId] });
