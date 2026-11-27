// Feriados (por unidade, herdados de cima) e cotas das operações (por mês, por serviço, com os dias opcionais).
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

export const NovaCota = z.object({
  mes: Mes,
  servicoId: Id,
  quantidade: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(10000, 'Use no máximo 10000.'),
  prioridade: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(1000, 'Use no máximo 1000.'),
});
export type NovaCota = z.infer<typeof NovaCota>;
export const EdicaoCota = NovaCota.omit({ mes: true }).partial();
export type EdicaoCota = z.infer<typeof EdicaoCota>;

/** "Copiar do mês anterior": as cotas do mês `de` para o mês `para`. */
export const CopiaDeCotas = z.object({ de: Mes, para: Mes });
export type CopiaDeCotas = z.infer<typeof CopiaDeCotas>;

/**
 * Um dia da cota (6.72): o dia obrigatório (`minimo` 1) ou com meta (`minimo` N). `maximo` é o teto do dia (fica no banco e na regra; a tela não o mostra por agora).
 * O resto do total do mês vale nos outros dias.
 */
export const DiaDaCota = z.object({
  data: Data,
  minimo: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(10000, 'Use no máximo 10000.'),
  maximo: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').max(10000, 'Use no máximo 10000.').nullable(),
});
export type DiaDaCota = z.infer<typeof DiaDaCota>;

/** Trocar os dias de uma cota: a lista nova substitui a inteira (vazia, limpa). */
export const DiasDaCota = z.object({ dias: z.array(DiaDaCota).max(31, 'Use no máximo 31 dias.') });
export type DiasDaCota = z.infer<typeof DiasDaCota>;

export type Cota = NovaCota & {
  id: string;
  servico: string;
  cor: string;
  /** alocações do serviço no mês, em escalas da unidade */
  distribuidas: number;
  /** os dias com meta, em ordem de data; vazio quando só o total do mês vale */
  dias: DiaDaCota[];
};

export type ResultadoDaCopia = { copiados: number };

/** A cópia de cotas também diz quantas do mês de origem ficaram de fora por serem de serviço desativado (e o destino ainda não tinha). */
export type ResultadoDaCopiaDeCotas = ResultadoDaCopia & { puladas: number };
