// Voluntariado lançado à mão: a lista do mês (quem já foi lançado e quem falta) e as marcações de um militar.
import { mesParaData, type FaixaDeDisponibilidade, type MilitarDoVoluntariado, type VoluntariadoDoMes, type VoluntariadoDoMilitar } from 'contratos';
import { blocosDoDia, CICLO_EQUIPES, cortesDoDia, detectarEquipeInicial, diasDoMes, equipeDoDia, grupoDoMilitar, mesAnterior, PRE_ESCALA, unirFaixas, type Faixa, type Militar } from 'dominio';
import { unidadeDoRegistro } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';

type Lotado = Omit<MilitarDoVoluntariado, 'lancado' | 'horas' | 'dias'>;

/** 480 -> "08:00"; 1440 -> "24:00". */
export const horaDe = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Os blocos do dia da seção: cortados nos horários dos turnos dos serviços ativos que pedem voluntariado (PJES e diária) e estão em
 * alguma escala ativa que o gestor marcou para montar os blocos; sem nenhum, o dia é um bloco só.
 */
export async function blocosDaSecao(c: Consulta, unidadeId: string): Promise<Faixa[]> {
  const { rows } = await c.query<{ inicio: string; fim: string }>(
    `select to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
       from turno t join servico s on s.id = t.servico_id
      where s.unidade_id = $1 and s.ativo and s.tipo in ('pjes', 'diaria')
        and exists (
          select 1 from escala_servico es join escala e on e.id = es.escala_id
           where es.servico_id = s.id and e.ativa and e.monta_blocos_voluntariado
        )`,
    [unidadeId],
  );
  return blocosDoDia(cortesDoDia(rows));
}

/** Militares ativos com lotação na seção em algum dia do mês; com duas lotações no mês vale a que cobre o maior trecho (empate: a mais recente). */
export async function lotadosNoMes(c: Consulta, unidadeId: string, mes: string, somente?: string): Promise<Lotado[]> {
  const inicio = mesParaData(mes);
  const { rows } = await c.query<{
    id: string; matricula: string; nome_guerra: string; voluntario_jes: boolean; posto: string; jornada: 'pronto' | 'adm'; equipe: string | null; trecho: number; desde: string;
  }>(
    `select m.id, m.matricula, m.nome_guerra, m.voluntario_jes, p.sigla as posto, l.jornada, e.nome as equipe, to_char(l.desde, 'YYYY-MM-DD') as desde,
            (least(coalesce(l.ate, date '9999-12-31'), ($1::date + interval '1 month' - interval '1 day')::date) - greatest(l.desde, $1::date) + 1)::int as trecho
       from militar m join posto_grad p on p.id = m.posto_grad_id
       join rastreio l on l.militar_id = m.id and l.unidade_id = $2
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
  const { rows: faixas } = await c.query<{ militar_id: string; data: string; inicio_min: number; fim_min: number }>(
    `select militar_id, to_char(data, 'YYYY-MM-DD') as data, inicio_min, fim_min from disponibilidade
      where militar_id = any($1) and data >= $2::date and data < ($2::date + interval '1 month')`,
    [ids, inicio],
  );
  // por militar e dia, as faixas unidas: as horas contam uma vez só
  const porDia = new Map<string, Faixa[]>();
  for (const r of faixas) porDia.set(`${r.militar_id}|${r.data}`, [...(porDia.get(`${r.militar_id}|${r.data}`) ?? []), { inicio: r.inicio_min, fim: r.fim_min }]);
  const contagem = new Map<string, { minutos: number; dias: number }>();
  for (const [k, lista] of porDia) {
    const id = k.split('|')[0]!;
    const atual = contagem.get(id) ?? { minutos: 0, dias: 0 };
    contagem.set(id, { minutos: atual.minutos + unirFaixas(lista).reduce((t, f) => t + (f.fim - f.inicio), 0), dias: atual.dias + 1 });
  }
  const lancados = new Set((await c.query<{ militar_id: string }>('select militar_id from voluntariado_lancamento where militar_id = any($1) and mes = $2::date', [ids, inicio])).rows.map((r) => r.militar_id));
  return {
    mes,
    militares: lotados.map((m): MilitarDoVoluntariado => ({ ...m, lancado: lancados.has(m.militarId), horas: (contagem.get(m.militarId)?.minutos ?? 0) / 60, dias: contagem.get(m.militarId)?.dias ?? 0 })),
  };
}

/** A disponibilidade do militar no mês, as faixas de cada dia unidas, em ordem de data. */
async function faixasDoMes(c: Consulta, militarId: string, mes: string): Promise<FaixaDeDisponibilidade[]> {
  const { rows } = await c.query<{ data: string; inicio_min: number; fim_min: number }>(
    `select to_char(data, 'YYYY-MM-DD') as data, inicio_min, fim_min from disponibilidade
      where militar_id = $1 and data >= $2::date and data < ($2::date + interval '1 month') order by data, inicio_min`,
    [militarId, mesParaData(mes)],
  );
  const dias = new Map<string, Faixa[]>();
  for (const r of rows) dias.set(r.data, [...(dias.get(r.data) ?? []), { inicio: r.inicio_min, fim: r.fim_min }]);
  return [...dias.entries()].flatMap(([data, lista]) => unirFaixas(lista).map((f) => ({ data, inicio: horaDe(f.inicio), fim: horaDe(f.fim) })));
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
    faixas: await faixasDoMes(c, militarId, mes),
    doMesAnterior: await faixasDoMes(c, militarId, mesAnterior(mes)),
    blocos: (await blocosDaSecao(c, unidadeId)).map((b) => ({ inicio: horaDe(b.inicio), fim: horaDe(b.fim) })),
    folgas: doMilitar ? await folgasDoMilitar(c, unidadeId, mes, doMilitar) : null,
  };
}

/**
 * A seção em que o militar está no mês: a lotação que cobre o maior trecho dele (empate: a mais recente). Quem tem transferência
 * cadastrada para o mês seguinte continua sendo da seção atual neste mês; sem lotação no mês, vale a última cadastrada.
 */
export async function unidadeDoMilitarNoMes(c: Consulta, militarId: string, mes: string): Promise<string | null> {
  const ultima = await unidadeDoRegistro(c, 'militar', militarId);
  if (!ultima) return null;
  const inicio = mesParaData(mes);
  const { rows } = await c.query<{ unidade_id: string }>(
    `select l.unidade_id from rastreio l
      where l.militar_id = $1 and l.desde <= ($2::date + interval '1 month' - interval '1 day')::date and (l.ate is null or l.ate >= $2::date)
      order by (least(coalesce(l.ate, date '9999-12-31'), ($2::date + interval '1 month' - interval '1 day')::date) - greatest(l.desde, $2::date)) desc, l.desde desc
      limit 1`,
    [militarId, inicio],
  );
  return rows[0]?.unidade_id ?? ultima;
}
