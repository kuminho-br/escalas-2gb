// Quem pode ocupar uma vaga da escala (telas: "Escolher militar"). As regras de choque, CNH e voluntariado vêm do motor
// (`pacotes/dominio`); aqui o banco é traduzido para o que o motor recebe (matrícula = id do militar, serviço = nome, turno = letra).
import type { Candidato, Candidatos } from 'contratos';
import {
  chaveAloc,
  cnhHabilitadas,
  compararAntiguidade,
  detectarChoques,
  diaDaSemana,
  ehSaldo,
  exigeVoluntarioJes,
  turnoCoberto,
  unirFaixas,
  type Faixa,
  violacoesDiariaUnica,
  violacoesSaldo,
  type AlocChoque,
  type Militar,
} from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { parametroEmVigor } from '../cadastros/configuracoes.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { somarDias } from '../datas.ts';
import { EXPEDIENTE, horariosDaUnidade, type Tipo } from './horarios.ts';
import { nomeDaVaga } from './vagas.ts';

export type VagaConsultada = { escalaId: string; data: string; inicio: string; fim: string; guarnicaoId: string | null; funcaoId: string | null };

export type TurnoDaFaixa = { turnoId: string; servicoId: string; nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string };
export type Avaliado = { candidato: Omit<Candidato, 'servicos'>; militarMotivo: string | null; porTurno: { turno: TurnoDaFaixa; motivo: string | null }[]; antig: number | null; cnh: string[] };

const NAO_LOTADO = 'Não está lotado na seção neste dia';
export const JA_ESCALADO = 'Já escalado neste horário';
/** O motivo "só falta marcar o horário": é a última conferência de cada turno, então ele quer dizer que todas as outras regras passaram. */
export const SEM_VOLUNTARIADO = 'Não marcou voluntariado neste horário';

/** Avalia, para uma faixa e um dia, cada militar lotado na seção: o motivo de não poder (ou nulo) e, por turno da faixa, o motivo de cada turno. */
export async function avaliarFaixa(c: Consulta, v: VagaConsultada, somenteMilitar?: string): Promise<{ turnos: TurnoDaFaixa[]; avaliados: Avaliado[] }> {
  const unidadeId = (await c.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [v.escalaId])).rows[0]!.unidade_id;
  const turnos = (
    await c.query<{ id: string; servico_id: string; nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
      `select t.id, s.id as servico_id, s.nome, s.tipo, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from escala_servico es join servico s on s.id = es.servico_id join turno t on t.servico_id = s.id
        where es.escala_id = $1 and t.inicio = $2::time and t.fim = $3::time order by es.ordem, t.letra`,
      [v.escalaId, v.inicio, v.fim],
    )
  ).rows.map((t): TurnoDaFaixa => ({ turnoId: t.id, servicoId: t.servico_id, nome: t.nome, tipo: t.tipo, letra: t.letra, inicio: t.inicio, fim: t.fim }));

  // quem tem lotação na seção em algum momento do mês da vaga (ou só o militar pedido)
  const pool = (
    await c.query<{
      id: string; matricula: string; nome_guerra: string; ativo: boolean; cnh: string[]; voluntario_jes: boolean; posto: string; antiguidade: number | null;
      jornada: 'pronto' | 'adm'; equipe: string | null; lotado_no_dia: boolean;
    }>(
      `select m.id, m.matricula, m.nome_guerra, m.ativo, m.cnh, m.voluntario_jes, p.sigla as posto, m.antiguidade, l.jornada, e.nome as equipe,
              (l.desde <= $2::date and (l.ate is null or l.ate >= $2::date)) as lotado_no_dia
         from militar m join posto_grad p on p.id = m.posto_grad_id
         join rastreio l on l.militar_id = m.id and l.unidade_id = $1
         left join equipe e on e.id = l.equipe_id
        where ($3::uuid is null or m.id = $3)
          and l.desde <= (date_trunc('month', $2::date) + interval '1 month' - interval '1 day')::date
          and (l.ate is null or l.ate >= date_trunc('month', $2::date)::date)`,
      [unidadeId, v.data, somenteMilitar ?? null],
    )
  ).rows;
  // um militar com duas lotações no mês vale pela que cobre o dia
  const porMilitar = new Map<string, (typeof pool)[number]>();
  for (const m of pool) if (!porMilitar.has(m.id) || m.lotado_no_dia) porMilitar.set(m.id, m);
  const militares = [...porMilitar.values()];
  const ids = militares.map((m) => m.id);

  const afastados = new Set(
    ids.length
      ? (await c.query<{ militar_id: string }>('select militar_id from afastamento where militar_id = any($1) and inicio <= $2::date and fim >= $2::date', [ids, v.data])).rows.map((r) => r.militar_id)
      : [],
  );
  const { horarios, tipos } = await horariosDaUnidade(c, unidadeId);

  const janela = ids.length
    ? (
        await c.query<{ militar_id: string; data: string; nome: string; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
          `select a.militar_id, to_char(a.data, 'YYYY-MM-DD') as data, s.nome, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
             from alocacao a join turno t on t.id = a.turno_id join servico s on s.id = a.servico_id
            where a.militar_id = any($1) and a.data between $2::date - 1 and $2::date + 1 and s.unidade_id = $3`,
          [ids, v.data, unidadeId],
        )
      ).rows
    : [];
  // a disponibilidade lançada no dia e no dia seguinte (o turno pertence ao dia em que começa; o que passa da meia-noite usa o dia seguinte)
  const disponibilidade = new Map<string, Faixa[]>();
  if (ids.length) {
    const { rows } = await c.query<{ militar_id: string; data: string; inicio_min: number; fim_min: number }>(
      "select militar_id, to_char(data, 'YYYY-MM-DD') as data, inicio_min, fim_min from disponibilidade where militar_id = any($1) and data between $2::date and $2::date + 1",
      [ids, v.data],
    );
    for (const r of rows) disponibilidade.set(`${r.militar_id}|${r.data}`, [...(disponibilidade.get(`${r.militar_id}|${r.data}`) ?? []), { inicio: r.inicio_min, fim: r.fim_min }]);
  }
  const feriados = new Set<string>();
  for (const ano of new Set([somarDias(v.data, -1), somarDias(v.data, 1)].map((d) => Number(d.slice(0, 4))))) {
    for (const f of await feriadosDoAno(c, unidadeId, ano)) feriados.add(f.data);
  }
  const util = (d: string) => diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5 && !feriados.has(d);
  // flexibilidade do voluntariado (horas cheias que podem faltar nas pontas do turno), em vigor no mês da vaga; só afrouxa o voluntariado
  const flexibilidadeMin = Number(await parametroEmVigor(c, unidadeId, 'FLEXIBILIDADE_VOLUNTARIADO_HORAS', v.data.slice(0, 7))) * 60;

  let exigida: string | null = null;
  if (v.guarnicaoId && v.funcaoId) {
    const versao = versaoNoMes((await versoesDasGuarnicoes(c, [v.guarnicaoId])).get(v.guarnicaoId) ?? [], v.data.slice(0, 7));
    exigida = versao?.composicao.find((f) => f.funcaoId === v.funcaoId)?.cnhExigida ?? null;
  }

  const avaliados = militares.map((m): Avaliado => {
    const base = { militarId: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, matricula: m.matricula, equipe: m.equipe, jornada: m.jornada };
    const pronto = (militarMotivo: string | null, porTurno: Avaliado['porTurno'] = []): Avaliado => ({ candidato: base, militarMotivo, porTurno, antig: m.antiguidade, cnh: m.cnh });
    if (!m.lotado_no_dia) return pronto(NAO_LOTADO);
    if (!m.ativo) return pronto('Desativado');
    if (afastados.has(m.id)) return pronto('Afastado');
    if (exigida && !cnhHabilitadas(m.cnh).includes(exigida)) return pronto('Sem a CNH exigida');
    const dele = janela.filter((a) => a.militar_id === m.id);
    if (dele.some((a) => a.data === v.data && a.inicio === v.inicio && a.fim === v.fim)) return pronto(JA_ESCALADO);
    const existentes: AlocChoque[] = dele.map((a) => ({ mat: m.id, dia: a.data, turno: a.letra, servico: a.nome }));
    const expediente: AlocChoque[] =
      m.jornada === 'adm'
        ? [-1, 0, 1].map((n) => somarDias(v.data, n)).filter(util).map((dia) => ({ mat: m.id, dia, turno: EXPEDIENTE.turno, servico: EXPEDIENTE.servico, implicito: true }))
        : [];
    // o Adm entra pelo Saldo (cobre turno do Pronto): o serviço proposto é o Saldo, quando a faixa o tem
    const ordemDosTurnos = m.jornada === 'adm' ? [...turnos].sort((a, b) => Number(ehSaldo(b.nome)) - Number(ehSaldo(a.nome))) : turnos;
    return pronto(
      null,
      ordemDosTurnos.map((turno) => {
        let motivo: string | null = null;
        // RN-03: o Saldo é do Adm (a regra e a frase são do motor; aqui sem o código da regra)
        if (violacoesSaldo([{ mat: m.id, dia: v.data, servico: turno.nome, turno: turno.letra }], { adm: m.jornada === 'adm' ? { [m.id]: true } : {} }).length) motivo = 'Saldo só para militar do Adm';
        else if ((turno.tipo === 'pjes' || exigeVoluntarioJes(turno.nome)) && !m.voluntario_jes) motivo = 'Não é voluntário JES';
        else {
          const candidata: AlocChoque = { mat: m.id, dia: v.data, turno: turno.letra, servico: turno.nome };
          const chave = chaveAloc(candidata);
          const { choques } = detectarChoques([...existentes, ...expediente, candidata], horarios, { tipos });
          if (choques.some((x) => x.a.chave === chave || x.b.chave === chave)) motivo = 'Choque de horário';
          // RN-36: uma diária por dia para o mesmo militar
          else if (violacoesDiariaUnica([...existentes, candidata], { tipos }).some((x) => x.chave === chave)) motivo = 'Já tem uma diária neste dia';
          // por último: só o voluntariado pode ser contornado pelo escalante (com a flexibilidade do gestor já aplicada)
          else if (turno.tipo !== 'ordinario' && !turnoCoberto((dia) => unirFaixas(disponibilidade.get(`${m.id}|${dia}`) ?? []), v.data, turno.inicio, turno.fim, flexibilidadeMin)) motivo = SEM_VOLUNTARIADO;
        }
        return { turno, motivo };
      }),
    );
  });
  return { turnos, avaliados };
}

const motivoFinal = (a: Avaliado): string | null => a.militarMotivo ?? (a.porTurno.some((t) => t.motivo === null) ? null : (a.porTurno[0]?.motivo ?? 'Não há serviço nesta faixa'));

export const porAntiguidade = (x: Avaliado, y: Avaliado) =>
  compararAntiguidade(
    { mat: x.candidato.matricula, m: { mat: x.candidato.matricula, posto: x.candidato.posto, antig: x.antig } as Militar },
    { mat: y.candidato.matricula, m: { mat: y.candidato.matricula, posto: y.candidato.posto, antig: y.antig } as Militar },
  );

/**
 * Quem já está escalado nesta faixa (desta escala, com vaga de guarnição) e pode acumular esta vaga: cumpre os requisitos dela
 * (a CNH é conferida antes de "já escalado") e ainda não ocupa essa função nessa guarnição, nem como posto nem como acúmulo.
 */
async function quemPodeAcumular(c: Consulta, v: VagaConsultada, avaliados: Avaliado[]): Promise<{ a: Avaliado; alocacaoId: string; vaga: string }[]> {
  const doFaixa = (
    await c.query<{ id: string; militar_id: string; guarnicao_id: string; funcao_id: string }>(
      `select a.id, a.militar_id, a.guarnicao_id, a.funcao_id from alocacao a join turno t on t.id = a.turno_id
        where a.escala_id = $1 and a.data = $2::date and t.inicio = $3::time and t.fim = $4::time and a.guarnicao_id is not null and a.funcao_id is not null`,
      [v.escalaId, v.data, v.inicio, v.fim],
    )
  ).rows;
  if (!doFaixa.length) return [];
  const ocupa = (
    await c.query<{ alocacao_id: string; guarnicao_id: string; funcao_id: string }>('select alocacao_id, guarnicao_id, funcao_id from alocacao_acumulo where alocacao_id = any($1)', [doFaixa.map((a) => a.id)])
  ).rows;
  const guarnicaoIds = [...new Set(doFaixa.map((a) => a.guarnicao_id))];
  const nomes = new Map((await c.query<{ id: string; nome: string }>('select id, nome from guarnicao where id = any($1)', [guarnicaoIds])).rows.map((g) => [g.id, g.nome]));
  const versoes = await versoesDasGuarnicoes(c, guarnicaoIds);
  const mes = v.data.slice(0, 7);
  // só conta como vaga de card a que ainda está vinculada a esta faixa neste mês (a original de quem ficou sem guarnição aparece em "Sem guarnição")
  const vinculo = (await vinculosDaEscala(c, v.escalaId)).find((x) => x.vigencia <= mes);
  const lista: { a: Avaliado; alocacaoId: string; vaga: string }[] = [];
  const jaVistos = new Set<string>();
  for (const al of doFaixa) {
    const a = avaliados.find((x) => x.candidato.militarId === al.militar_id);
    if (!a || a.militarMotivo !== JA_ESCALADO || jaVistos.has(al.militar_id)) continue;
    const mesmaVaga = (g: string, f: string) => g === v.guarnicaoId && f === v.funcaoId;
    if (mesmaVaga(al.guarnicao_id, al.funcao_id) || ocupa.some((x) => x.alocacao_id === al.id && mesmaVaga(x.guarnicao_id, x.funcao_id))) continue;
    if (!vinculo?.itens.some((i) => i.guarnicaoId === al.guarnicao_id && i.inicio === v.inicio && i.fim === v.fim)) continue;
    const versao = versaoNoMes(versoes.get(al.guarnicao_id) ?? [], mes);
    const funcao = versao?.ativa ? versao.composicao.find((f) => f.funcaoId === al.funcao_id) : undefined;
    if (!versao || !funcao) continue;
    jaVistos.add(al.militar_id);
    lista.push({ a, alocacaoId: al.id, vaga: nomeDaVaga(nomes.get(al.guarnicao_id) ?? '', funcao.funcao, versao.composicao.length) });
  }
  return lista.sort((x, y) => porAntiguidade(x.a, y.a));
}

/** Os que podem ocupar a vaga (Pronto antes do Adm, depois por posto e antiguidade), os que podem acumulá-la e quantos ficaram de fora, por motivo. */
export async function avaliarCandidatos(c: Consulta, v: VagaConsultada): Promise<Candidatos> {
  const { avaliados } = await avaliarFaixa(c, v);
  const acumulando = v.guarnicaoId && v.funcaoId ? await quemPodeAcumular(c, v, avaliados) : [];
  const idsAcumulando = new Set(acumulando.map((x) => x.a.candidato.militarId));
  const ordem = (x: Avaliado, y: Avaliado) => Number(x.candidato.jornada === 'adm') - Number(y.candidato.jornada === 'adm') || porAntiguidade(x, y);
  const comServicos = (a: Avaliado, motivo: string | null): Candidato => ({
    ...a.candidato,
    servicos: a.porTurno.filter((t) => t.motivo === motivo).map((t) => ({ servicoId: t.turno.servicoId, turnoId: t.turno.turnoId, nome: t.turno.nome })),
  });
  const aptos = avaliados.filter((a) => motivoFinal(a) === null).sort(ordem).map((a) => comServicos(a, null));
  // sem turno livre, mas com ao menos um turno em que só falta o voluntariado
  const semVoluntariado = avaliados
    .filter((a) => a.militarMotivo === null && motivoFinal(a) !== null && a.porTurno.some((t) => t.motivo === SEM_VOLUNTARIADO))
    .sort(ordem)
    .map((a) => comServicos(a, SEM_VOLUNTARIADO));
  const contagem = new Map<string, number>();
  for (const a of avaliados) {
    if (idsAcumulando.has(a.candidato.militarId)) continue; // quem pode acumular aparece na outra lista, não como "de fora"
    const m = motivoFinal(a);
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const fora = [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, 'pt-BR'));
  const acumular = acumulando.map(({ a, alocacaoId, vaga }) => ({
    alocacaoId, militarId: a.candidato.militarId, posto: a.candidato.posto, nomeGuerra: a.candidato.nomeGuerra, matricula: a.candidato.matricula, vaga,
  }));
  return { aptos, semVoluntariado, fora, acumular };
}

/** Por que o militar não pode ocupar a vaga neste turno (a frase que a tela mostra); null se pode. */
export async function motivoDeFora(c: Consulta, v: VagaConsultada & { militarId: string; turnoId: string }): Promise<string | null> {
  const { avaliados } = await avaliarFaixa(c, v, v.militarId);
  const a = avaliados[0];
  if (!a) return NAO_LOTADO;
  if (a.militarMotivo) return a.militarMotivo;
  const doTurno = a.porTurno.find((t) => t.turno.turnoId === v.turnoId);
  return doTurno ? doTurno.motivo : 'Este turno não é desta faixa';
}
