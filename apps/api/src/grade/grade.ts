// Grade geral: o mês de todo o efetivo da seção. Uma linha por militar (agrupada por equipe, o Adm à parte e, no fim, quem é de outra
// unidade e foi escalado aqui), uma coluna por dia. Leitura: quem escala é o painel do dia.
import type { BlocoDaGrade, GradeDoMes, GrupoDaGrade, LinhaDaGrade } from 'contratos';
import {
  compararAntiguidade,
  detectarChoques,
  diaDaSemana,
  diasDoMes,
  normalizar,
  intervaloDoTurno,
  type AlocChoque,
  type Militar,
} from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { somarDias } from '../datas.ts';
import { alocacoesDaJanela, EXPEDIENTE, horariosDaUnidade, somarOutrasUnidades, type Tipo } from '../escala/horarios.ts';
import { PODE_SER_ESCALADO, SO_QBMG_OU_SEM_QUADRO } from '../escala/quadros-da-escala.ts';

type Pessoa = { id: string; matricula: string; nomeGuerra: string; posto: string; postoOrdem: number; antiguidade: number | null; ativo: boolean };
type Lotado = Pessoa & { jornada: 'pronto' | 'adm'; equipeId: string | null; equipe: string | null; ordemCiclo: number | null; desde: string; ate: string | null };
type Alocacao = { id: string; militarId: string; data: string; servicoId: string; nome: string; cor: string; tipo: Tipo; letra: string; inicio: string; fim: string };

/** O dia de 'aaaa-mm-dd' pertence ao mês 'aaaa-mm'? */
const doMes = (d: string, mes: string) => d.slice(0, 7) === mes;

export async function montarGradeDoMes(c: Consulta, unidadeId: string, mes: string): Promise<GradeDoMes> {
  const dias = diasDoMes(mes);
  const primeiro = dias[0]!;
  const ultimo = dias[dias.length - 1]!;
  const antes = somarDias(primeiro, -1);
  const depois = somarDias(ultimo, 1);

  const feriados = new Map<string, string>();
  for (const ano of new Set([antes, depois].map((d) => Number(d.slice(0, 4))))) {
    for (const f of await feriadosDoAno(c, unidadeId, ano)) if (!feriados.has(f.data)) feriados.set(f.data, f.descricao);
  }

  const lotados = (
    await c.query<{
      id: string; matricula: string; nome_guerra: string; posto: string; posto_ordem: number; antiguidade: number | null; ativo: boolean; jornada: 'pronto' | 'adm';
      equipe_id: string | null; equipe: string | null; ordem_ciclo: number | null; desde: string; ate: string | null;
    }>(
      `select m.id, m.matricula, m.nome_guerra, p.sigla as posto, p.ordem as posto_ordem, m.antiguidade, ${PODE_SER_ESCALADO} as ativo, l.jornada, l.equipe_id, e.nome as equipe, e.ordem_ciclo,
              to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
         from rastreio l join militar m on m.id = l.militar_id join posto_grad p on p.id = m.posto_grad_id
         left join equipe e on e.id = l.equipe_id
        where l.unidade_id = $1 and l.desde <= $3::date and (l.ate is null or l.ate >= $2::date)
          and ${SO_QBMG_OU_SEM_QUADRO}`,
      [unidadeId, primeiro, ultimo],
    )
  ).rows.map((r): Lotado => ({
    id: r.id, matricula: r.matricula, nomeGuerra: r.nome_guerra, posto: r.posto, postoOrdem: r.posto_ordem, antiguidade: r.antiguidade, ativo: r.ativo,
    jornada: r.jornada, equipeId: r.equipe_id, equipe: r.equipe, ordemCiclo: r.ordem_ciclo, desde: r.desde, ate: r.ate,
  }));

  // as alocações do mês e do dia antes e do dia depois: o turno do dia 31 que vai até as 08h de 1º enxerga o que vem depois
  const alocacoes = (
    await c.query<{ id: string; militar_id: string; data: string; servico_id: string; nome: string; cor: string; tipo: Tipo; letra: string; inicio: string; fim: string }>(
      `select a.id, a.militar_id, to_char(a.data, 'YYYY-MM-DD') as data, s.id as servico_id, s.nome, s.cor, s.tipo, t.letra,
              to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id join escala e on e.id = a.escala_id
        where s.unidade_id = $1 and a.data between $2::date and $3::date and e.distribuicao = 'pre_escala'`,
      [unidadeId, antes, depois],
    )
  ).rows.map((r): Alocacao => ({ id: r.id, militarId: r.militar_id, data: r.data, servicoId: r.servico_id, nome: r.nome, cor: r.cor, tipo: r.tipo, letra: r.letra, inicio: r.inicio, fim: r.fim }));

  // quem foi escalado aqui sem lotação na seção no mês: vai para "Outras seções"
  const idsLotados = new Set(lotados.map((l) => l.id));
  const idsDeFora = [...new Set(alocacoes.filter((a) => doMes(a.data, mes) && !idsLotados.has(a.militarId)).map((a) => a.militarId))];
  const deFora: Pessoa[] = idsDeFora.length
    ? (
        await c.query<{ id: string; matricula: string; nome_guerra: string; posto: string; posto_ordem: number; antiguidade: number | null; ativo: boolean }>(
          'select m.id, m.matricula, m.nome_guerra, p.sigla as posto, p.ordem as posto_ordem, m.antiguidade, true as ativo from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])',
          [idsDeFora],
        )
      ).rows.map((r) => ({ id: r.id, matricula: r.matricula, nomeGuerra: r.nome_guerra, posto: r.posto, postoOrdem: r.posto_ordem, antiguidade: r.antiguidade, ativo: r.ativo }))
    : [];

  const ids = [...idsLotados, ...idsDeFora];
  const afastamentos = ids.length
    ? (
        await c.query<{ militar_id: string; inicio: string; fim: string }>(
          "select militar_id, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim from afastamento where militar_id = any($1::uuid[]) and inicio <= $3::date and fim >= $2::date",
          [ids, antes, depois],
        )
      ).rows
    : [];
  const pedidasPorDia = new Map<string, { data: string; minutos: number }[]>();
  if (ids.length) {
    const { rows } = await c.query<{ militar_id: string; data: string; minutos: number }>(
      "select militar_id, to_char(data, 'YYYY-MM-DD') as data, sum(fim_min - inicio_min)::int as minutos from disponibilidade where militar_id = any($1::uuid[]) and data between $2::date and $3::date group by militar_id, data",
      [ids, primeiro, ultimo],
    );
    for (const r of rows) pedidasPorDia.set(r.militar_id, [...(pedidasPorDia.get(r.militar_id) ?? []), { data: r.data, minutos: r.minutos }]);
  }
  const pedidas = new Map([...pedidasPorDia].map(([id, lista]) => [id, lista.reduce((soma, x) => soma + x.minutos, 0)] as const));
  const regras = await horariosDaUnidade(c, unidadeId);
  const { horarios } = regras;
  // 6.37: o choque olha todas as unidades. Os serviços das outras unidades não aparecem na grade (só os da seção), mas entram na conta dos choques
  const deOutras = (await alocacoesDaJanela(c, ids, antes, depois, unidadeId)).filter((a) => a.outra);
  somarOutrasUnidades(regras, deOutras);
  const tiram = new Set(regras.tiramDoExpediente.map(normalizar));

  const util = (d: string) => diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5 && !feriados.has(d);
  const afastado = (id: string, d: string) => afastamentos.some((a) => a.militar_id === id && a.inicio <= d && a.fim >= d);

  /** `soDoPeriodo`: o militar tem mais de um período no mês (mudou de equipe ou de jornada); cada linha vale só nos dias do seu período. */
  function montarLinha(p: Pessoa, jornada: 'pronto' | 'adm', lotacao: { desde: string; ate: string | null; ativo: boolean }[] | null, soDoPeriodo = false): LinhaDaGrade {
    const cobre = (d: string) => !!lotacao?.some((x) => x.desde <= d && (x.ate === null || x.ate >= d));
    // o expediente só vale nos dias de um período em que ele pode ser escalado (não nos da Reserva, por exemplo)
    const podeNoDia = (d: string) => !!lotacao?.some((x) => x.ativo && x.desde <= d && (x.ate === null || x.ate >= d));
    const dentro = (d: string) => !soDoPeriodo || !lotacao || cobre(d);
    const dele = alocacoes.filter((a) => a.militarId === p.id && dentro(a.data));
    const duracao = (a: Alocacao) => {
      const i = intervaloDoTurno(a.inicio, a.fim);
      return i.fim - i.inicio;
    };
    const blocos: Record<string, BlocoDaGrade[]> = {};
    for (const a of dele.filter((x) => doMes(x.data, mes))) {
      (blocos[a.data] ??= []).push({
        alocacaoId: a.id, servico: { id: a.servicoId, nome: a.nome, cor: a.cor, tipo: a.tipo }, letra: a.letra, inicio: a.inicio, fim: a.fim, expediente: false,
      });
    }

    // o expediente do Adm: implícito nos dias úteis em que ele está lotado e não está afastado; um Saldo que o cobre ou um serviço
    // Expediente de verdade o substituem
    const expediente: AlocChoque[] = [];
    if (jornada === 'adm' && lotacao) {
      for (let n = -1; n <= dias.length; n++) {
        const d = somarDias(primeiro, n);
        if (!util(d) || !podeNoDia(d) || afastado(p.id, d)) continue;
        expediente.push({ mat: p.id, dia: d, turno: EXPEDIENTE.turno, servico: EXPEDIENTE.servico, implicito: true });
        const doDia = dele.filter((a) => a.data === d);
        const substituido = [...doDia, ...deOutras.filter((a) => a.militarId === p.id && a.data === d).map((a) => ({ nome: a.servico, letra: a.letra }))].some((a) => {
          if (a.nome === EXPEDIENTE.servico) return true;
          const h = horarios[`${a.nome}|${a.letra}`];
          return tiram.has(normalizar(a.nome)) && !!h && h.ini < EXPEDIENTE.fim && EXPEDIENTE.ini < h.ini + h.dur;
        });
        if (doMes(d, mes) && !substituido) {
          (blocos[d] ??= []).push({ alocacaoId: null, servico: null, letra: null, inicio: '08:00', fim: '16:00', expediente: true });
        }
      }
    }
    for (const lista of Object.values(blocos)) lista.sort((x, y) => x.inicio.localeCompare(y.inicio) || Number(y.expediente) - Number(x.expediente));

    // choques: do motor, com o expediente implícito (que choca com qualquer serviço, de qualquer unidade); as células dos dois lados dentro do mês são marcadas
    const existentes: AlocChoque[] = [
      ...dele.map((a) => ({ mat: p.id, dia: a.data, turno: a.letra, servico: a.nome })),
      ...deOutras.filter((a) => a.militarId === p.id && dentro(a.data)).map((a) => ({ mat: p.id, dia: a.data, turno: a.letra, servico: a.servico })),
    ];
    const marcados = new Set<string>();
    for (const x of detectarChoques([...existentes, ...expediente], horarios, { mes, tiramDoExpediente: regras.tiramDoExpediente }).choques) {
      for (const lado of [x.a.dia, x.b.dia]) if (doMes(lado, mes)) marcados.add(lado);
    }

    const doTipo = dele.filter((a) => doMes(a.data, mes) && (a.tipo === 'pjes' || a.tipo === 'diaria'));
    return {
      militarId: p.id, posto: p.posto, nomeGuerra: p.nomeGuerra, matricula: p.matricula, jornada,
      dias: blocos, choques: [...marcados].sort(),
      pjes: doTipo.filter((a) => a.tipo === 'pjes').length,
      diarias: doTipo.filter((a) => a.tipo === 'diaria').length,
      horasTiradas: doTipo.reduce((soma, a) => soma + duracao(a), 0),
      horasPedidas: soDoPeriodo ? (pedidasPorDia.get(p.id) ?? []).filter((x) => dentro(x.data)).reduce((soma, x) => soma + x.minutos, 0) : (pedidas.get(p.id) ?? 0),
    };
  }

  // a ordem do posto vem do cadastro: a antiguidade não depende da sigla, que o administrador pode renomear
  const ordemDoPostoDe = new Map([...lotados, ...deFora].map((p) => [p.id, p.postoOrdem]));
  const antiguidade = (x: LinhaDaGrade & { antig: number | null }, y: LinhaDaGrade & { antig: number | null }) =>
    compararAntiguidade(
      { mat: x.matricula, m: { mat: x.matricula, posto: x.posto, postoOrdem: ordemDoPostoDe.get(x.militarId), antig: x.antig } as Militar },
      { mat: y.matricula, m: { mat: y.matricula, posto: y.posto, postoOrdem: ordemDoPostoDe.get(y.militarId), antig: y.antig } as Militar },
    );

  // quem aparece: lotados no mês (um militar inativo só se foi escalado) e, no fim, os de fora escalados aqui
  const temAlocacaoNoMes = (id: string) => alocacoes.some((a) => a.militarId === id && doMes(a.data, mes));
  const periodosDoMilitar = new Map<string, number>();
  for (const l of lotados) periodosDoMilitar.set(l.id, (periodosDoMilitar.get(l.id) ?? 0) + 1);
  const grupos = new Map<string, { nome: string; ordem: number; linhas: (LinhaDaGrade & { antig: number | null })[] }>();
  const poe = (chave: string, nome: string, ordem: number, linha: LinhaDaGrade, antig: number | null) => {
    const g = grupos.get(chave) ?? { nome, ordem, linhas: [] };
    g.linhas.push({ ...linha, antig });
    grupos.set(chave, g);
  };
  // quem volta à mesma equipe (ou fica no Adm) no mês tem uma linha só nela, valendo nos dias de todos os períodos dela
  const chaveDoGrupo = (l: Lotado) => (l.jornada === 'adm' ? 'adm' : (l.equipeId ?? 'sem-equipe'));
  const porLinha = new Map<string, { l: Lotado; periodos: { desde: string; ate: string | null; ativo: boolean }[] }>();
  for (const l of lotados) {
    const k = `${l.id}|${chaveDoGrupo(l)}`;
    const e = porLinha.get(k) ?? { l, periodos: [] };
    e.periodos.push({ desde: l.desde, ate: l.ate, ativo: l.ativo });
    porLinha.set(k, e);
  }
  for (const { l, periodos } of porLinha.values()) {
    // a linha fica se ele pode ser escalado em algum dos períodos dela (ou se já tem escala no mês)
    if (!periodos.some((p) => p.ativo) && !temAlocacaoNoMes(l.id)) continue;
    const linha = montarLinha(l, l.jornada, periodos, periodosDoMilitar.get(l.id)! > 1);
    if (l.jornada === 'adm') poe('adm', 'Adm', 1_000_000, linha, l.antiguidade);
    else if (l.equipeId) poe(l.equipeId, l.equipe ?? '', l.ordemCiclo ?? 0, linha, l.antiguidade);
    else poe('sem-equipe', 'Sem equipe', 999_999, linha, l.antiguidade);
  }
  for (const p of deFora) poe('outras', 'Outras seções', 2_000_000, montarLinha(p, 'pronto', null), p.antiguidade);

  const ordenados: GrupoDaGrade[] = [...grupos.entries()]
    .sort((x, y) => x[1].ordem - y[1].ordem)
    .map(([chave, g]) => ({ chave, nome: g.nome, linhas: g.linhas.sort(antiguidade).map(({ antig: _antig, ...linha }) => linha) }));

  return {
    mes,
    dias: dias.map((data) => ({ data, diaDaSemana: diaDaSemana(data), feriado: feriados.get(data) ?? null })),
    grupos: ordenados,
  };
}
