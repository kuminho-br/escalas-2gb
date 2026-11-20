// As linhas do tempo de uma guarnição no dia: para cada função, uma linha por vaga ocupada ou aberta, com a vaga na própria linha.
// Quem emenda turnos na mesma função (mesma chave: o mesmo militar no mesmo serviço) vira um trecho só. Regra só do sistema novo
// (adendo "Efetivo por dia" do design de 20/11/2026).
import type { Falta, FuncaoExigida, Intervalo } from './ativacao.ts';

/** `chave` junta o mesmo militar no mesmo serviço; `indice` aponta para a ocupação de quem chama. */
export type OcupacaoNaLinha = Intervalo & { funcaoId: string; funcao: string; chave: string; indice: number };
/** `indices` são as ocupações juntadas no trecho. */
export type TrechoDaLinha = (Intervalo & { tipo: 'ocupado'; indices: number[] }) | (Intervalo & { tipo: 'vaga' });
export type LinhasDaFuncao = { funcaoId: string; funcao: string; minimo: number; linhas: TrechoDaLinha[][] };

/** Ocupações da mesma chave que se encostam (o fim de uma é o início da outra) viram um trecho só. */
function juntar(ocupacoes: OcupacaoNaLinha[]): TrechoDaLinha[] {
  const porChave = new Map<string, OcupacaoNaLinha[]>();
  for (const o of ocupacoes) porChave.set(o.chave, [...(porChave.get(o.chave) ?? []), o]);
  const trechos: TrechoDaLinha[] = [];
  for (const lista of porChave.values()) {
    let atual: (Intervalo & { tipo: 'ocupado'; indices: number[] }) | null = null;
    for (const o of [...lista].sort((a, b) => a.inicio - b.inicio)) {
      if (atual && atual.fim === o.inicio) {
        atual.fim = o.fim;
        atual.indices.push(o.indice);
      } else {
        atual = { inicio: o.inicio, fim: o.fim, tipo: 'ocupado', indices: [o.indice] };
        trechos.push(atual);
      }
    }
  }
  return trechos;
}

/** Por início (no mesmo início, ocupado antes de vaga e o mais longo antes), cada trecho vai para uma linha livre, preferindo a que termina nele. */
function distribuir(trechos: TrechoDaLinha[]): TrechoDaLinha[][] {
  const ordenados = [...trechos].sort((a, b) => a.inicio - b.inicio || (a.tipo === b.tipo ? 0 : a.tipo === 'ocupado' ? -1 : 1) || b.fim - b.inicio - (a.fim - a.inicio));
  const linhas: TrechoDaLinha[][] = [];
  const fimDa = (l: TrechoDaLinha[]) => l[l.length - 1]!.fim;
  for (const t of ordenados) {
    const encostada = linhas.find((l) => fimDa(l) === t.inicio);
    const livre = encostada ?? linhas.find((l) => fimDa(l) <= t.inicio);
    if (livre) livre.push(t);
    else linhas.push([t]);
  }
  return linhas;
}

export function linhasDaGuarnicao(composicao: FuncaoExigida[], ocupacoes: OcupacaoNaLinha[], faltas: Falta[]): LinhasDaFuncao[] {
  const daComposicao = new Set(composicao.map((f) => f.funcaoId));
  const foraDoModelo = new Map<string, string>();
  for (const o of ocupacoes) if (!daComposicao.has(o.funcaoId)) foraDoModelo.set(o.funcaoId, o.funcao);
  const funcoes: FuncaoExigida[] = [
    ...composicao,
    ...[...foraDoModelo].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([funcaoId, funcao]) => ({ funcaoId, funcao, minimo: 0 })),
  ];
  const resultado: LinhasDaFuncao[] = [];
  for (const f of funcoes) {
    const ocupados = juntar(ocupacoes.filter((o) => o.funcaoId === f.funcaoId));
    const vagas: TrechoDaLinha[] = faltas
      .filter((x) => x.funcaoId === f.funcaoId)
      .flatMap((x) => Array.from({ length: x.faltam }, () => ({ inicio: x.inicio, fim: x.fim, tipo: 'vaga' as const })));
    const todos = [...ocupados, ...vagas];
    if (!todos.length) continue;
    resultado.push({ funcaoId: f.funcaoId, funcao: f.funcao, minimo: f.minimo, linhas: distribuir(todos) });
  }
  return resultado;
}
