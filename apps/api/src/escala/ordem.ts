// Ordem de escala: as vagas de uma escala num mês e a vez de cada uma (regras puras; a leitura e a gravação estão nas rotas).
import type { VagaDaOrdem, VagaNaTela } from 'contratos';

export type ModeloDaGuarnicao = {
  guarnicaoId: string;
  guarnicao: string;
  prioridade: number | null;
  composicao: { funcaoId: string; funcao: string; minimo: number; maximo: number }[];
};
export type VagaDoMes = Omit<VagaNaTela, 'posicao'>;

const chave = (guarnicaoId: string, funcaoId: string, vaga: number) => `${guarnicaoId}|${funcaoId}|${vaga}`;

/**
 * As vagas da escala no mês: cada guarnição uma vez (mesmo em várias faixas), cada função vira `maximo` vagas e as até o mínimo
 * são obrigatórias. Ordem de exibição: prioridade (sem prioridade por último), depois nome; dentro da guarnição, a composição.
 */
export function vagasDoMes(modelos: ModeloDaGuarnicao[]): VagaDoMes[] {
  const unicos = new Map<string, ModeloDaGuarnicao>();
  for (const m of modelos) if (!unicos.has(m.guarnicaoId)) unicos.set(m.guarnicaoId, m);
  const semPrioridade = Number.MAX_SAFE_INTEGER;
  return [...unicos.values()]
    .sort((a, b) => (a.prioridade ?? semPrioridade) - (b.prioridade ?? semPrioridade) || a.guarnicao.localeCompare(b.guarnicao, 'pt-BR'))
    .flatMap((g) =>
      g.composicao.flatMap((f) =>
        Array.from({ length: f.maximo }, (_, i): VagaDoMes => ({
          guarnicaoId: g.guarnicaoId, guarnicao: g.guarnicao, funcaoId: f.funcaoId, funcao: f.funcao, vaga: i + 1, obrigatoria: i + 1 <= f.minimo,
        })),
      ),
    );
}

/**
 * Dá a cada vaga a sua vez. `null` (nenhuma ordem cadastrada) = a ordem de exibição, de 1 a n. Com itens, a vaga recebe a posição
 * relativa do item dela, sem buracos (item de vaga que já não existe é ignorado); vaga sem item fica sem número.
 */
export function aplicarOrdem(vagas: VagaDoMes[], itens: VagaDaOrdem[] | null): VagaNaTela[] {
  if (itens === null) return vagas.map((v, i) => ({ ...v, posicao: i + 1 }));
  const existentes = new Set(vagas.map((v) => chave(v.guarnicaoId, v.funcaoId, v.vaga)));
  const posicao = new Map<string, number>();
  for (const it of itens) {
    const k = chave(it.guarnicaoId, it.funcaoId, it.vaga);
    if (existentes.has(k) && !posicao.has(k)) posicao.set(k, posicao.size + 1);
  }
  return vagas.map((v) => ({ ...v, posicao: posicao.get(chave(v.guarnicaoId, v.funcaoId, v.vaga)) ?? null }));
}

/** A sequência em que a pré-escala preenche: as numeradas por posição e, depois, as sem número na ordem de exibição. */
export function sequenciaDePreenchimento(vagas: VagaNaTela[]): VagaNaTela[] {
  const numeradas = vagas.filter((v) => v.posicao !== null).sort((a, b) => a.posicao! - b.posicao!);
  return [...numeradas, ...vagas.filter((v) => v.posicao === null)];
}
