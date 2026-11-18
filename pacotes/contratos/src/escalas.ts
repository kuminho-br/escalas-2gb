// Escalas: serviços reunidos na ordem de preenchimento, publicação e guarnições por turno (versões).
import { z } from 'zod';
import { Id, Nome } from './comum.ts';
import { LetraTurno } from './servicos.ts';

export const MilitaresDoc = z.enum(['todos', 'escalados']);
export const DiasDoc = z.enum(['todos', 'com_escalados']);

export const DadosEscala = z.object({ nome: Nome, titulo: Nome, militaresDoc: MilitaresDoc, diasDoc: DiasDoc });
export type DadosEscala = z.infer<typeof DadosEscala>;

export const NovaEscala = z.object({ nome: Nome });
export type NovaEscala = z.infer<typeof NovaEscala>;
export const EdicaoEscala = DadosEscala;
export type EdicaoEscala = DadosEscala;

export const SituacaoEscala = z.object({ ativa: z.boolean() });
export type SituacaoEscala = z.infer<typeof SituacaoEscala>;

export const ServicosDaEscala = z
  .object({ servicoIds: z.array(Id) })
  .refine((s) => new Set(s.servicoIds).size === s.servicoIds.length, { path: ['servicoIds'], message: 'Este serviço já está na escala.' });
export type ServicosDaEscala = z.infer<typeof ServicosDaEscala>;

export const VinculosDaEscala = z
  .object({ itens: z.array(z.object({ guarnicaoId: Id, turnoLetra: LetraTurno.nullable() })) })
  .superRefine((v, ctx) => {
    const vistos = new Set<string>();
    v.itens.forEach((it, i) => {
      const k = `${it.guarnicaoId}|${it.turnoLetra ?? ''}`;
      if (vistos.has(k)) ctx.addIssue({ code: 'custom', path: ['itens', i, 'turnoLetra'], message: 'Esta guarnição já está neste turno.' });
      vistos.add(k);
      const misturou = v.itens.some((o) => o.guarnicaoId === it.guarnicaoId && (o.turnoLetra === null) !== (it.turnoLetra === null));
      if (misturou && it.turnoLetra !== null)
        ctx.addIssue({ code: 'custom', path: ['itens', i, 'turnoLetra'], message: 'Com "Todos os turnos", não marque turnos avulsos.' });
    });
  });
export type VinculosDaEscala = z.infer<typeof VinculosDaEscala>;

export type LinhaEscala = { id: string; nome: string; ativa: boolean; servicos: string[] };

export type VinculoSalvo = { guarnicaoId: string; guarnicao: string; ativaNoMes: boolean; turnoLetra: LetraTurno | null };

export type Escala = {
  id: string;
  nome: string;
  titulo: string;
  militaresDoc: z.infer<typeof MilitaresDoc>;
  diasDoc: z.infer<typeof DiasDoc>;
  ativa: boolean;
  servicos: { id: string; nome: string; cor: string; ativo: boolean }[];
  /** união das letras dos turnos dos serviços, na ordem A, B, C, U */
  letras: LetraTurno[];
  /** da vigência mais recente para a mais antiga */
  vinculos: { vigencia: string; itens: VinculoSalvo[] }[];
};

/** Título padrão de uma escala nova (como no protótipo). */
export const tituloPadraoEscala = (nome: string): string => `ESCALA ${nome.trim().toUpperCase()}`;
