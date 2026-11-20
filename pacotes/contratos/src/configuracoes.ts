// Configurações: o catálogo do sistema (tipos de afastamento) e parâmetros por unidade.
import { z } from 'zod';
import { Mes, Nome } from './comum.ts';

export type ItemCatalogo = { id: string; nome: string; ativo: boolean };

export const NovoItemCatalogo = z.object({ nome: Nome });
export type NovoItemCatalogo = z.infer<typeof NovoItemCatalogo>;

export const EdicaoItemCatalogo = z.object({ nome: Nome.optional(), ativo: z.boolean().optional() });
export type EdicaoItemCatalogo = z.infer<typeof EdicaoItemCatalogo>;

export const NovoParametro = z.object({
  chave: z.string(),
  valor: z.string(),
  vigencia: Mes,
  normaReferencia: z.string().trim().max(200, 'Use no máximo 200 caracteres.').optional(),
});
export type NovoParametro = z.infer<typeof NovoParametro>;

export type Parametro = {
  chave: string;
  rotulo: string;
  descricao: string;
  tipo: 'inteiro' | 'decimal' | 'texto' | 'simnao';
  valor: number | string | boolean;
  vigencia: string;
  normaReferencia: string | null;
  origem: 'padrao' | 'propria' | 'herdada';
  unidadeSigla: string | null;
  historico: { vigencia: string; valor: unknown; normaReferencia: string | null; unidadeSigla: string }[];
};
