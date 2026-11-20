// Feriados (por unidade, herdados de cima) e cotas das operações (por mês, por serviço).
import { z } from 'zod';
import { Data, Id, Mes, Nome } from './comum.ts';

const Ano = z.number().int('Use um ano com 4 dígitos.').min(1900, 'Use um ano a partir de 1900.').max(2200, 'Use um ano até 2200.');

export const NovoFeriado = z.object({ data: Data, descricao: Nome, fixo: z.boolean() });
export type NovoFeriado = z.infer<typeof NovoFeriado>;
export const EdicaoFeriado = NovoFeriado.partial();
export type EdicaoFeriado = z.infer<typeof EdicaoFeriado>;

/** "Copiar feriados fixos": os da própria unidade, do ano `de` para o ano `para`. */
export const CopiaDeFeriados = z.object({ de: Ano, para: Ano });
export type CopiaDeFeriados = z.infer<typeof CopiaDeFeriados>;

export type Feriado = {
  id: string;
  /** aaaa-mm-dd */
  data: string;
  descricao: string;
  /** cai no mesmo dia todo ano */
  fixo: boolean;
  /** sigla da unidade que cadastrou */
  unidadeSigla: string;
  /** vem de uma unidade acima: aparece, mas não se edita aqui */
  herdado: boolean;
};

export const OrigemCota = z.enum(['interna', 'externa']);
export type OrigemCota = z.infer<typeof OrigemCota>;

export const NovaCota = z.object({
  mes: Mes,
  servicoId: Id,
  quantidade: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(10000, 'Use no máximo 10000.'),
  origem: OrigemCota,
  prioridade: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(1000, 'Use no máximo 1000.'),
});
export type NovaCota = z.infer<typeof NovaCota>;
export const EdicaoCota = NovaCota.omit({ mes: true }).partial();
export type EdicaoCota = z.infer<typeof EdicaoCota>;

/** "Copiar do mês anterior": as cotas do mês `de` para o mês `para`. */
export const CopiaDeCotas = z.object({ de: Mes, para: Mes });
export type CopiaDeCotas = z.infer<typeof CopiaDeCotas>;

export type Cota = NovaCota & {
  id: string;
  servico: string;
  cor: string;
  /** alocações do serviço no mês, em escalas da unidade, repartidas pelas cotas na ordem de prioridade */
  distribuidas: number;
};

export type ResultadoDaCopia = { copiados: number };

/** A cópia de cotas também diz quantas do mês de origem ficaram de fora por serem de serviço desativado (e o destino ainda não tinha). */
export type ResultadoDaCopiaDeCotas = ResultadoDaCopia & { puladas: number };
