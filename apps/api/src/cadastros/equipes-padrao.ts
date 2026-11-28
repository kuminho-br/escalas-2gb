// As seis equipes padrão da corporação (6.64): as quatro do Pronto (posição 1 a 4 no ciclo), a ADM e a Externa. A migração 0054 as cria onde já há unidades; esta função
// as garante para as cargas de exemplo (o banco novo e o espelho do Laboratório), sem repetir o que já existe. As unidades as herdam; nenhuma seção ganha equipe própria.
import type { Consulta } from '../banco/banco.ts';

export const EQUIPES_PADRAO: { nome: string; tipo: 'pronto' | 'adm' | 'externa'; posicao: number | null }[] = [
  { nome: 'Alfa', tipo: 'pronto', posicao: 1 },
  { nome: 'Bravo', tipo: 'pronto', posicao: 2 },
  { nome: 'Charlie', tipo: 'pronto', posicao: 3 },
  { nome: 'Delta', tipo: 'pronto', posicao: 4 },
  { nome: 'ADM', tipo: 'adm', posicao: null },
  { nome: 'Externa', tipo: 'externa', posicao: null },
];

/** Garante as seis na unidade raiz e devolve o id de cada uma pelo nome de hoje (as do Pronto, pela posição; a ADM e a Externa, pelo tipo). */
export async function garantirEquipesPadrao(c: Consulta): Promise<Map<string, string>> {
  const raiz = (await c.query<{ id: string }>('select id from unidade where mae_id is null limit 1')).rows[0]?.id;
  if (!raiz) throw new Error('Não há unidade raiz: as equipes padrão da corporação não têm onde ficar.');
  const ids = new Map<string, string>();
  for (const e of EQUIPES_PADRAO) {
    const achada = (
      await c.query<{ id: string }>(
        `select id from equipe where unidade_id = $1 and tipo = $2 and posicao_ciclo is not distinct from $3::int and ($2 <> 'adm' or ativa) order by ativa desc, nome limit 1`,
        [raiz, e.tipo, e.posicao],
      )
    ).rows[0]?.id;
    const id = achada ?? (await c.query<{ id: string }>('insert into equipe (unidade_id, nome, tipo, posicao_ciclo) values ($1, $2, $3, $4) returning id', [raiz, e.nome, e.tipo, e.posicao])).rows[0]!.id;
    ids.set(e.nome, id);
  }
  return ids;
}
