// Preencher as vagas de uma faixa na ordem de escala (entrega 3.1, regra só do sistema novo).
// Na vez de cada vaga entra o mais antigo que ainda não foi usado e tem a CNH que ela exige (hierarquia do CTB).
import { cnhAtende } from './cnh.ts';

export type VagaParaPreencher = { chave: string; cnhExigida: string | null };
export type CandidatoDaVaga = { id: string; cnh: string[] };

/**
 * `vagas` chega na ordem de preenchimento e já sem as ocupadas; `candidatos`, do mais antigo para o mais novo e já sem
 * quem não pode no turno. Um candidato ocupa no máximo uma vaga. Quem sobra vai para `semVaga`, na ordem de antiguidade;
 * a vaga sem ninguém com a CNH exigida vai para `vazias`.
 */
export function preencherVagas(
  vagas: VagaParaPreencher[],
  candidatos: CandidatoDaVaga[],
): { atribuicoes: { chave: string; id: string }[]; semVaga: string[]; vazias: string[] } {
  const usados = new Set<string>();
  const atribuicoes: { chave: string; id: string }[] = [];
  const vazias: string[] = [];
  for (const v of vagas) {
    const quem = candidatos.find((c) => !usados.has(c.id) && cnhAtende(c.cnh, v.cnhExigida ? [v.cnhExigida] : []));
    if (!quem) {
      vazias.push(v.chave);
      continue;
    }
    usados.add(quem.id);
    atribuicoes.push({ chave: v.chave, id: quem.id });
  }
  return { atribuicoes, semVaga: candidatos.filter((c) => !usados.has(c.id)).map((c) => c.id), vazias };
}
