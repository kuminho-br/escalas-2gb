// A estrutura de um grupamento (entrega 6.10): as divisões e as seções. A tela "Estrutura" cria e renomeia divisões e põe as seções dentro delas.
import { z } from 'zod';

export type TipoDoNo = 'grupamento' | 'divisao' | 'secao';
/** Um nó da árvore do grupamento, com as filhas na ordem das siglas. */
export type NoDaEstrutura = { id: string; sigla: string; nome: string; tipo: TipoDoNo; filhas: NoDaEstrutura[] };

export const NovaDivisao = z.object({
  sigla: z.string().trim().min(1, 'Informe a sigla.').max(20, 'Use no máximo 20 caracteres.'),
  nome: z.string().trim().min(1, 'Informe o nome.').max(80, 'Use no máximo 80 caracteres.'),
});
export type NovaDivisao = z.infer<typeof NovaDivisao>;

/** A divisão de uma seção; `null` devolve a seção ao grupamento. */
export const DivisaoDaSecao = z.object({ divisaoId: z.string().uuid('Escolha a divisão.').nullable() });
export type DivisaoDaSecao = z.infer<typeof DivisaoDaSecao>;
