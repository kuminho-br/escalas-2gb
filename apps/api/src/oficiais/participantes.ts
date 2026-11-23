// Quem participa da escala dos oficiais num mês: militar dos quadros QOC e QOA (pelo período) com situação que deixa escalar e rastreio na unidade
// (ou abaixo dela) em algum dia do mês. A presença vem do motor (`diasPresentes`).
import { diasPresentes } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

export interface AfastamentoDoMes {
  inicio: string;
  fim: string;
  tipo: string;
}

export interface Participante {
  militarId: string;
  matricula: string;
  posto: string;
  /** Menor = posto mais alto (o motor ordena do menor para o maior). */
  postoOrdem: number;
  nomeGuerra: string;
  antiguidade: number | null;
  quadro: 'QOC' | 'QOA';
  lotacao: string;
  afastamentos: AfastamentoDoMes[];
  dias: number;
}

/** 'CAP BM' -> 'CAP': o texto das telas não carrega o "BM". */
export const postoCurto = (sigla: string) => sigla.replace(/\s*BM$/i, '');

export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/** Afastamentos que tocam o mês, por militar. */
export async function afastamentosDoMes(c: Consulta, ids: string[], mes: string): Promise<Map<string, AfastamentoDoMes[]>> {
  const { inicio, fim } = limitesDoMes(mes);
  const mapa = new Map<string, AfastamentoDoMes[]>();
  if (ids.length === 0) return mapa;
  const { rows } = await c.query<{ militar_id: string; inicio: string; fim: string; tipo: string }>(
    `select a.militar_id, to_char(a.inicio, 'YYYY-MM-DD') as inicio, to_char(a.fim, 'YYYY-MM-DD') as fim, t.nome as tipo
       from afastamento a join tipo_afastamento t on t.id = a.tipo_afastamento_id
      where a.militar_id = any($1::uuid[]) and a.inicio <= $3::date and a.fim >= $2::date
      order by a.inicio`,
    [ids, inicio, fim],
  );
  for (const r of rows) mapa.set(r.militar_id, [...(mapa.get(r.militar_id) ?? []), { inicio: r.inicio, fim: r.fim, tipo: r.tipo }]);
  return mapa;
}

/**
 * Os participantes do mês (AAAA-MM), sem ordem definida: quem ordena é `ordemDeEscolha`. Participa quem tem, na unidade ou abaixo dela, período
 * com quadro QOC ou QOA e situação que deixa escalar; só os dias desses períodos contam (o quadro e a situação valem por período).
 */
export async function participantesDoMes(c: Consulta, unidadeId: string, mes: string): Promise<Participante[]> {
  const { inicio, fim } = limitesDoMes(mes);
  const { rows: rastreios } = await c.query<{ militar_id: string; desde: string; ate: string | null; sigla: string; quadro: 'QOC' | 'QOA' }>(
    `select r.militar_id, to_char(r.desde, 'YYYY-MM-DD') as desde, to_char(r.ate, 'YYYY-MM-DD') as ate, un.sigla, q.sigla as quadro
       from rastreio r
       join unidade un on un.id = r.unidade_id
       join unidade alvo on alvo.id = $1
       join quadro q on q.id = r.quadro_id and q.sigla in ('QOC', 'QOA')
       join situacao_militar sm on sm.id = r.situacao_id and sm.escalavel
      where un.caminho <@ alvo.caminho and r.desde <= $3::date and (r.ate is null or r.ate >= $2::date)
      order by r.desde`,
    [unidadeId, inicio, fim],
  );
  if (rastreios.length === 0) return [];
  const ids = [...new Set(rastreios.map((r) => r.militar_id))];
  const { rows: militares } = await c.query<{ id: string; matricula: string; posto: string; posto_ordem: number; nome_guerra: string; antiguidade: number | null }>(
    `select m.id, m.matricula, p.sigla as posto, -p.ordem as posto_ordem, m.nome_guerra, m.antiguidade
       from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])`,
    [ids],
  );
  const afast = await afastamentosDoMes(c, ids, mes);
  return militares.map((m) => {
    const periodos = rastreios.filter((r) => r.militar_id === m.id);
    const afastamentos = afast.get(m.id) ?? [];
    return {
      militarId: m.id,
      matricula: m.matricula,
      posto: postoCurto(m.posto),
      postoOrdem: m.posto_ordem,
      nomeGuerra: m.nome_guerra,
      antiguidade: m.antiguidade,
      quadro: periodos.at(-1)!.quadro,
      lotacao: periodos.at(-1)?.sigla ?? '',
      afastamentos,
      dias: diasPresentes(mes, periodos.map((p) => ({ desde: p.desde, ate: p.ate })), afastamentos),
    };
  });
}
