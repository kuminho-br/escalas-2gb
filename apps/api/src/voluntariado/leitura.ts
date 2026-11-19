// Voluntariado lançado à mão: a lista do mês (quem já foi lançado e quem falta) e as marcações de um militar.
import { mesParaData, type MarcaDeVoluntariado, type MilitarDoVoluntariado, type VoluntariadoDoMes, type VoluntariadoDoMilitar } from 'contratos';
import { CICLO_EQUIPES, detectarEquipeInicial, diasDoMes, equipeDoDia, grupoDoMilitar, mesAnterior, PRE_ESCALA, type Militar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

type Lotado = Omit<MilitarDoVoluntariado, 'lancado' | 'turnos' | 'dias'>;

/** Militares ativos com lotação na seção em algum dia do mês; com duas lotações no mês vale a que cobre o maior trecho (empate: a mais recente). */
export async function lotadosNoMes(c: Consulta, unidadeId: string, mes: string, somente?: string): Promise<Lotado[]> {
  const inicio = mesParaData(mes);
  const { rows } = await c.query<{
    id: string; matricula: string; nome_guerra: string; voluntario_jes: boolean; posto: string; jornada: 'pronto' | 'adm'; equipe: string | null; trecho: number; desde: string;
  }>(
    `select m.id, m.matricula, m.nome_guerra, m.voluntario_jes, p.sigla as posto, l.jornada, e.nome as equipe, to_char(l.desde, 'YYYY-MM-DD') as desde,
            (least(coalesce(l.ate, date '9999-12-31'), ($1::date + interval '1 month' - interval '1 day')::date) - greatest(l.desde, $1::date) + 1)::int as trecho
       from militar m join posto_grad p on p.id = m.posto_grad_id
       join lotacao l on l.militar_id = m.id and l.unidade_id = $2
       left join equipe e on e.id = l.equipe_id
      where m.ativo and ($3::uuid is null or m.id = $3)
        and l.desde <= ($1::date + interval '1 month' - interval '1 day')::date and (l.ate is null or l.ate >= $1::date)`,
    [inicio, unidadeId, somente ?? null],
  );
  const melhor = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const atual = melhor.get(r.id);
    if (!atual || r.trecho > atual.trecho || (r.trecho === atual.trecho && r.desde > atual.desde)) melhor.set(r.id, r);
  }
  return [...melhor.values()]
    .map((r): Lotado => ({ militarId: r.id, posto: r.posto, nomeGuerra: r.nome_guerra, matricula: r.matricula, equipe: r.equipe, jornada: r.jornada, voluntarioJes: r.voluntario_jes }))
    .sort((a, b) => a.nomeGuerra.localeCompare(b.nomeGuerra, 'pt-BR') || a.matricula.localeCompare(b.matricula));
}

export async function voluntariadoDoMes(c: Consulta, unidadeId: string, mes: string): Promise<VoluntariadoDoMes> {
  const lotados = await lotadosNoMes(c, unidadeId, mes);
  if (!lotados.length) return { mes, militares: [] };
  const ids = lotados.map((m) => m.militarId);
  const inicio = mesParaData(mes);
  const contagem = new Map(
    (
      await c.query<{ militar_id: string; turnos: number; dias: number }>(
        `select militar_id, count(*)::int as turnos, count(distinct data)::int as dias from voluntariado
          where militar_id = any($1) and data >= $2::date and data < ($2::date + interval '1 month') group by militar_id`,
        [ids, inicio],
      )
    ).rows.map((r) => [r.militar_id, r]),
  );
  const lancados = new Set((await c.query<{ militar_id: string }>('select militar_id from voluntariado_lancamento where militar_id = any($1) and mes = $2::date', [ids, inicio])).rows.map((r) => r.militar_id));
  return {
    mes,
    militares: lotados.map((m): MilitarDoVoluntariado => ({ ...m, lancado: lancados.has(m.militarId), turnos: contagem.get(m.militarId)?.turnos ?? 0, dias: contagem.get(m.militarId)?.dias ?? 0 })),
  };
}

async function marcasDoMes(c: Consulta, militarId: string, mes: string): Promise<MarcaDeVoluntariado[]> {
  const { rows } = await c.query<MarcaDeVoluntariado>(
    `select to_char(data, 'YYYY-MM-DD') as data, turno_padrao as turno from voluntariado
      where militar_id = $1 and data >= $2::date and data < ($2::date + interval '1 month') order by data, turno_padrao`,
    [militarId, mesParaData(mes)],
  );
  return rows;
}

/** Os dias do mês em que a equipe do militar não está de serviço, pelo ciclo do motor; null quando não dá para saber. */
async function folgasDoMilitar(c: Consulta, unidadeId: string, mes: string, doMilitar: Lotado): Promise<string[] | null> {
  const grupo = grupoDoMilitar({ jornada: doMilitar.jornada, equipe: doMilitar.equipe });
  if (!CICLO_EQUIPES.includes(grupo)) return null;
  const anterior = mesAnterior(mes);
  // a equipe de cada militar no mês anterior e o Pronto turno A que ele cumpriu (o motor vota pelos últimos dias)
  const militares = (await lotadosNoMes(c, unidadeId, anterior)).map((m): Militar => ({ mat: m.militarId, jornada: m.jornada, equipe: m.equipe ?? '' }));
  const { rows } = await c.query<{ mat: string; dia: string; servico: string; turno: string }>(
    `select a.militar_id as mat, to_char(a.data, 'YYYY-MM-DD') as dia, s.nome as servico, t.letra as turno
       from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
      where s.unidade_id = $1 and s.nome = $2 and t.letra = 'A' and a.data >= $3::date and a.data < ($3::date + interval '1 month')`,
    [unidadeId, PRE_ESCALA.SERVICO, mesParaData(anterior)],
  );
  const { equipe } = detectarEquipeInicial(rows, militares, { mes });
  if (!equipe) return null;
  return diasDoMes(mes).filter((_, i) => equipeDoDia(equipe, i) !== grupo);
}

export async function voluntariadoDoMilitar(c: Consulta, unidadeId: string, militarId: string, mes: string): Promise<VoluntariadoDoMilitar> {
  const doMilitar = (await lotadosNoMes(c, unidadeId, mes, militarId))[0];
  return {
    militarId,
    mes,
    marcas: await marcasDoMes(c, militarId, mes),
    doMesAnterior: await marcasDoMes(c, militarId, mesAnterior(mes)),
    folgas: doMilitar ? await folgasDoMilitar(c, unidadeId, mes, doMilitar) : null,
  };
}
