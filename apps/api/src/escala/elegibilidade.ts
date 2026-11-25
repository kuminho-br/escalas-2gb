// Quem pode ocupar uma vaga da escala (telas: "Escolher militar"). As regras de choque, CNH e voluntariado vêm do motor
// (`pacotes/dominio`); aqui o banco é traduzido para o que o motor recebe (matrícula = id do militar, serviço = nome, turno = letra).
import type { Candidato, Candidatos, CandidatoEmChoque, ChoqueDoCandidato } from 'contratos';
import {
  chaveAloc,
  cnhParaEscala,
  motivoDaCnh,
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
import { CADASTRO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { parametroEmVigor } from '../cadastros/configuracoes.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { somarDias } from '../datas.ts';
import { alocacoesDaJanela, type AlocacaoDaJanela, EXPEDIENTE, horariosDaUnidade, type HorariosDeChoque, somarOutrasUnidades, type Tipo } from './horarios.ts';
import { cotasDeSaldo } from './cota-de-saldo.ts';
import { nomeDaVaga } from './vagas.ts';

/** `tirarDoExpediente` (6.38): o escalante decidiu pôr o serviço por cima do expediente do dia; vale só para o serviço cadastrado com a opção. */
export type VagaConsultada = { escalaId: string; data: string; inicio: string; fim: string; guarnicaoId: string | null; funcaoId: string | null; tirarDoExpediente?: boolean };

export type TurnoDaFaixa = { turnoId: string; servicoId: string; nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string; tira: boolean };
/** `externo`: veio de outra unidade pelo vínculo (6.33); é candidato em qualquer serviço lançado à mão (6.36), mas a pré-escala e as distribuições automáticas nunca o põem. */
/** O que choca com o militar num turno: as alocações dele que se sobrepõem e se o expediente também (6.38). */
/** `expedienteLancado`: o expediente que a pré-escala lançou (sem escala) está entre o que choca; só um serviço que tira do expediente o tira (6.40). */
export type Conflito = { alocacoes: AlocacaoDaJanela[]; expediente: boolean; expedienteLancado?: AlocacaoDaJanela };
export type Avaliado = {
  externo: boolean; candidato: Omit<Candidato, 'servicos'>; militarMotivo: string | null; porTurno: { turno: TurnoDaFaixa; motivo: string | null; conflito?: Conflito }[];
  antig: number | null; postoOrdem: number; cnh: string[]; lotacaoUnidadeId: string;
  /** a alocação que a pré-escala pôs neste turno sem guarnição (6.40) e o turno dela */
  noTurno?: { alocacaoId: string; turnoId: string };
};

const NAO_LOTADO = 'Não está lotado na seção neste dia';
/** O choque com o expediente do Adm (o militar está de expediente no horário): o serviço que pode tirá-lo de lá tem o botão de resolver (6.38). */
export const DE_EXPEDIENTE = 'De expediente neste dia';
// sufixo do nome da candidata no motor (ver mais abaixo): nunca é igual ao nome de um serviço cadastrado
const NOVA = ' (nova)';
export const JA_ESCALADO = 'Já escalado neste horário';
/** O motivo "só falta marcar o horário": é a última conferência de cada turno, então ele quer dizer que todas as outras regras passaram. */
export const SEM_VOLUNTARIADO = 'Não marcou voluntariado neste horário';

import { ehOficial, MOTIVO_OFICIAL } from './quadros-da-escala.ts';

/** Avalia, para uma faixa e um dia, cada militar lotado na seção: o motivo de não poder (ou nulo) e, por turno da faixa, o motivo de cada turno. */
export async function avaliarFaixa(c: Consulta, v: VagaConsultada, somenteMilitar?: string): Promise<{ turnos: TurnoDaFaixa[]; avaliados: Avaliado[] }> {
  const unidadeId = (await c.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [v.escalaId])).rows[0]!.unidade_id;
  const turnos = (
    await c.query<{ id: string; servico_id: string; nome: string; tipo: Tipo; tira: boolean; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
      `select t.id, s.id as servico_id, s.nome, s.tipo, s.tira_do_expediente as tira, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from escala_servico es join servico s on s.id = es.servico_id join turno t on t.servico_id = s.id
        where es.escala_id = $1 and t.inicio = $2::time and t.fim = $3::time order by es.ordem, t.letra`,
      [v.escalaId, v.inicio, v.fim],
    )
  ).rows.map((t): TurnoDaFaixa => ({ turnoId: t.id, servicoId: t.servico_id, nome: t.nome, tipo: t.tipo, letra: t.letra, inicio: t.inicio, fim: t.fim, tira: t.tira }));

  // quem tem lotação na seção em algum momento do mês da vaga (ou só o militar pedido)
  // (uma consulta só, com os externos em `union all`: o painel do dia conta as consultas)
  // os externos: militares de outra unidade que o gestor trouxe (vinculo_externo) e cujo vínculo vale em algum dia do mês da vaga. Os dados dele (jornada, situação,
  // quadro) são do período de rastreio que vale no dia, na lotação dele; a equipe é "Externo"; `lotado_no_dia` é o vínculo cobrir o dia
  const pool = (
    await c.query<{
      id: string; matricula: string; nome_guerra: string; ativo: boolean; situacao: string; motorista: boolean; cnh: string[]; voluntario_jes: boolean; posto: string; posto_ordem: number; antiguidade: number | null;
      jornada: 'pronto' | 'adm'; equipe: string | null; lotado_no_dia: boolean; quadro: string | null; externo: boolean; lotacao_unidade: string;
    }>(
      `select m.id, m.matricula, m.nome_guerra, sm.escalavel as ativo, sm.nome as situacao, m.motorista, m.cnh, m.voluntario_jes, p.sigla as posto, p.ordem as posto_ordem, m.antiguidade, l.jornada, e.nome as equipe, q.sigla as quadro,
              (l.desde <= $2::date and (l.ate is null or l.ate >= $2::date)) as lotado_no_dia, false as externo, l.unidade_id as lotacao_unidade
         from militar m join posto_grad p on p.id = m.posto_grad_id
         join rastreio l on l.militar_id = m.id and l.unidade_id = $1
         left join equipe e on e.id = l.equipe_id
         join situacao_militar sm on sm.id = l.situacao_id
         left join quadro q on q.id = l.quadro_id
        where ($3::uuid is null or m.id = $3)
          and l.desde <= (date_trunc('month', $2::date) + interval '1 month' - interval '1 day')::date
          and (l.ate is null or l.ate >= date_trunc('month', $2::date)::date)
       union all
       select m.id, m.matricula, m.nome_guerra, sm.escalavel as ativo, sm.nome as situacao, m.motorista, m.cnh, m.voluntario_jes, p.sigla as posto, p.ordem as posto_ordem, m.antiguidade,
              l.jornada, 'Externo' as equipe, q.sigla as quadro, (ve.desde <= $2::date and (ve.ate is null or ve.ate >= $2::date)) as lotado_no_dia, true as externo, l.unidade_id as lotacao_unidade
         from vinculo_externo ve
         join militar m on m.id = ve.militar_id join posto_grad p on p.id = m.posto_grad_id
         join lateral (select r.* from rastreio r where r.militar_id = m.id
                        order by (r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) desc, r.desde desc limit 1) l on true
         join situacao_militar sm on sm.id = l.situacao_id
         left join quadro q on q.id = l.quadro_id
        where ve.unidade_id = $1 and ($3::uuid is null or m.id = $3)
          and ve.desde <= (date_trunc('month', $2::date) + interval '1 month' - interval '1 day')::date
          and (ve.ate is null or ve.ate >= date_trunc('month', $2::date)::date)`,
      [unidadeId, v.data, somenteMilitar ?? null],
    )
  ).rows;
  // um militar com duas lotações no mês vale pela que cobre o dia
  const porMilitar = new Map<string, (typeof pool)[number]>();
  for (const m of pool) if (!porMilitar.has(m.id) || m.lotado_no_dia) porMilitar.set(m.id, m);
  // as telas de praças só pegam o QBMG e quem está sem quadro, pelo quadro do período que vale no dia; o militar pedido pelo id passa (e recebe o motivo)
  const militares = [...porMilitar.values()].filter((m) => somenteMilitar !== undefined || !ehOficial(m.quadro));
  const ids = militares.map((m) => m.id);

  const afastados = new Set(
    ids.length
      ? (await c.query<{ militar_id: string }>('select militar_id from afastamento where militar_id = any($1) and inicio <= $2::date and fim >= $2::date', [ids, v.data])).rows.map((r) => r.militar_id)
      : [],
  );
  const regras = await horariosDaUnidade(c, unidadeId);
  const { horarios, tipos } = regras;

  // as alocações do dia anterior ao seguinte (o turno que passa da meia-noite pega o dia vizinho): as dos serviços da seção e, desde a 6.37, as de todas as outras unidades
  // (o choque vale em qualquer unidade; o serviço de fora entra com a sigla: "Pronto (2ª SB)")
  const todas = await alocacoesDaJanela(c, ids, somarDias(v.data, -1), somarDias(v.data, 1), unidadeId);
  somarOutrasUnidades(regras, todas);
  const porChave = new Map(todas.map((a) => [chaveAloc({ mat: a.militarId, dia: a.data, servico: a.servico, turno: a.letra }), a] as const));
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
    let noTurno: AlocacaoDaJanela | undefined;
    const pronto = (militarMotivo: string | null, porTurno: Avaliado['porTurno'] = []): Avaliado => ({ externo: m.externo, candidato: base, militarMotivo, porTurno, antig: m.antiguidade, postoOrdem: m.posto_ordem, cnh: cnhParaEscala(m), lotacaoUnidadeId: m.lotacao_unidade, ...(noTurno ? { noTurno: { alocacaoId: noTurno.id, turnoId: noTurno.turnoId } } : {}) });
    if (!m.lotado_no_dia) return pronto(NAO_LOTADO);
    if (ehOficial(m.quadro)) return pronto(MOTIVO_OFICIAL);
    if (!m.ativo) return pronto(m.situacao);
    if (afastados.has(m.id)) return pronto('Afastado');
    const motivoCnh = exigida ? motivoDaCnh(m, exigida) : null;
    if (motivoCnh) return pronto(motivoCnh);
    const dele = todas.filter((a) => a.militarId === m.id);
    // quem já está neste horário: "Já escalado". Exceção (6.40): numa vaga de guarnição, quem a pré-escala pôs neste turno desta escala sem guarnição não é "já escalado": é candidato,
    // e escolhê-lo MOVE a alocação dele para a vaga (ela não conta como choque consigo mesma)
    const mesmoHorario = dele.filter((a) => a.data === v.data && a.inicio === v.inicio && a.fim === v.fim);
    const movivel = v.guarnicaoId !== null && mesmoHorario.length > 0 && mesmoHorario.every((a) => a.escalaId === v.escalaId && a.guarnicaoId === null);
    if (mesmoHorario.length && !movivel) return pronto(JA_ESCALADO);
    noTurno = movivel ? mesmoHorario[0] : undefined;
    const existentes: AlocChoque[] = dele.filter((a) => !movivel || !mesmoHorario.includes(a)).map((a) => ({ mat: m.id, dia: a.data, turno: a.letra, servico: a.servico }));
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
        let conflito: Conflito | undefined;
        // o externo (6.36) é candidato em qualquer serviço lançado à mão, com as regras de todos
        // RN-03: o Saldo é do Adm (a regra e a frase são do motor; aqui sem o código da regra)
        if (violacoesSaldo([{ mat: m.id, dia: v.data, servico: turno.nome, turno: turno.letra }], { adm: m.jornada === 'adm' ? { [m.id]: true } : {} }).length) motivo = 'Saldo só para militar do ADM';
        else if ((turno.tipo === 'pjes' || exigeVoluntarioJes(turno.nome)) && !m.voluntario_jes) motivo = 'Não é voluntário JES';
        else {
          const choque = choqueDoTurno({ militarId: m.id, data: v.data, turno, existentes, expediente, regras, porChave, poePorCima: !!v.tirarDoExpediente && turno.tira });
          if (choque) {
            motivo = choque.motivo;
            conflito = choque.conflito;
          }
          // RN-36: uma diária por dia para o mesmo militar
          else if (violacoesDiariaUnica([...existentes, { mat: m.id, dia: v.data, turno: turno.letra, servico: turno.nome }], { tipos }).some((x) => x.chave === chaveAloc({ mat: m.id, dia: v.data, turno: turno.letra, servico: turno.nome }))) motivo = 'Já tem uma diária neste dia';
          // por último: só o voluntariado pode ser contornado pelo escalante (com a flexibilidade do gestor já aplicada)
          // (o externo não marca voluntariado: quem o gestor trouxe já veio para isso)
          else if (turno.tipo !== 'ordinario' && !m.externo && !turnoCoberto((dia) => unirFaixas(disponibilidade.get(`${m.id}|${dia}`) ?? []), v.data, turno.inicio, turno.fim, flexibilidadeMin)) motivo = SEM_VOLUNTARIADO;
        }
        return { turno, motivo, ...(conflito ? { conflito } : {}) };
      }),
    );
  });
  return { turnos, avaliados };
}

/**
 * O choque de um serviço novo com o que o militar já tem (em todas as unidades) e com o expediente do Adm (6.37). A candidata entra no motor com outro nome: o serviço
 * que pode tirar o militar do expediente, lançado agora, continua sendo choque; só o que já está gravado tira o expediente do dia. Com `poePorCima` (o escalante decidiu,
 * 6.38, e o serviço pode), a candidata entra com o nome de verdade e tira o expediente. Quem confere o choque (a escala do mês, a dos oficiais) usa esta função.
 */
export function choqueDoTurno(d: {
  militarId: string; data: string; turno: { nome: string; letra: 'A' | 'B' | 'C' }; existentes: AlocChoque[]; expediente: AlocChoque[];
  regras: HorariosDeChoque; porChave: Map<string, AlocacaoDaJanela>; poePorCima: boolean;
}): { motivo: string; conflito: Conflito } | null {
  const { turno, regras } = d;
  const candidata: AlocChoque = { mat: d.militarId, dia: d.data, turno: turno.letra, servico: d.poePorCima ? turno.nome : `${turno.nome}${NOVA}` };
  regras.horarios[`${candidata.servico}|${turno.letra}`] = regras.horarios[`${turno.nome}|${turno.letra}`]!;
  const chave = chaveAloc(candidata);
  const { choques } = detectarChoques([...d.existentes, ...d.expediente, candidata], regras.horarios, { tiramDoExpediente: regras.tiramDoExpediente });
  const dela = choques.filter((x) => x.a.chave === chave || x.b.chave === chave);
  if (!dela.length) return null;
  const lados = dela.flatMap((x) => [x.a, x.b]).filter((l) => l.chave !== chave && !l.implicito);
  const reais = [...new Map(lados.flatMap((l) => (d.porChave.has(l.chave) ? [[l.chave, d.porChave.get(l.chave)!] as const] : []))).values()];
  // o expediente lançado pela pré-escala (o serviço Expediente) é o expediente: o choque com ele é "De expediente neste dia", e não com um serviço qualquer
  const lancado = reais.find((a) => a.servicoNome.trim().toLowerCase() === 'expediente');
  const expediente = dela.some((x) => x.tipo === 'expediente') || !!lancado;
  return {
    motivo: expediente ? DE_EXPEDIENTE : 'Choque de horário',
    conflito: { alocacoes: reais.filter((a) => a !== lancado), expediente, ...(lancado ? { expedienteLancado: lancado } : {}) },
  };
}

const motivoFinal = (a: Avaliado): string | null => a.militarMotivo ?? (a.porTurno.some((t) => t.motivo === null) ? null : (a.porTurno[0]?.motivo ?? 'Não há serviço nesta faixa'));

export const porAntiguidade = (x: Avaliado, y: Avaliado) =>
  compararAntiguidade(
    { mat: x.candidato.matricula, m: { mat: x.candidato.matricula, posto: x.candidato.posto, postoOrdem: x.postoOrdem, antig: x.antig } as Militar },
    { mat: y.candidato.matricula, m: { mat: y.candidato.matricula, posto: y.candidato.posto, postoOrdem: y.postoOrdem, antig: y.antig } as Militar },
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
export async function avaliarCandidatos(c: Consulta, v: VagaConsultada, quem?: { usuarioId: string; hoje: string }): Promise<Candidatos> {
  const { avaliados } = await avaliarFaixa(c, v);
  const acumulando = v.guarnicaoId && v.funcaoId ? await quemPodeAcumular(c, v, avaliados) : [];
  const idsAcumulando = new Set(acumulando.map((x) => x.a.candidato.militarId));
  // quem já está no turno sem guarnição vem primeiro (6.40); depois o Pronto antes do Adm, por posto e antiguidade
  const ordem = (x: Avaliado, y: Avaliado) => Number(!!y.noTurno) - Number(!!x.noTurno) || Number(x.candidato.jornada === 'adm') - Number(y.candidato.jornada === 'adm') || porAntiguidade(x, y);
  const comServicos = (a: Avaliado, motivo: string | null): Candidato => ({
    ...a.candidato,
    ...(a.noTurno ? { noTurno: { alocacaoId: a.noTurno.alocacaoId } } : {}),
    // quem está no turno só vai para a vaga no serviço em que já está
    servicos: a.porTurno.filter((t) => t.motivo === motivo && (!a.noTurno || t.turno.turnoId === a.noTurno.turnoId)).map((t) => ({ servicoId: t.turno.servicoId, turnoId: t.turno.turnoId, nome: t.turno.nome })),
  });
  // quem está no turno só serve se o turno em que ele já está passa em todas as regras da vaga
  const apto = (a: Avaliado) => motivoFinal(a) === null && (!a.noTurno || a.porTurno.find((t) => t.turno.turnoId === a.noTurno!.turnoId)?.motivo === null);
  const aptos = avaliados.filter(apto).sort(ordem).map((a) => comServicos(a, null));
  // sem turno livre, mas com ao menos um turno em que só falta o voluntariado
  const semVoluntariado = avaliados
    .filter((a) => a.militarMotivo === null && motivoFinal(a) !== null && a.porTurno.some((t) => t.motivo === SEM_VOLUNTARIADO))
    .sort(ordem)
    .map((a) => comServicos(a, SEM_VOLUNTARIADO));
  // em choque (6.38): sem turno livre nem "só falta o voluntariado", e ao menos um turno que só não passa porque choca; aparece com o que choca
  const semVoluntariadoIds = new Set(semVoluntariado.map((x) => x.militarId));
  const emChoqueAvaliados = avaliados.filter(
    (a) => a.militarMotivo === null && motivoFinal(a) !== null && !semVoluntariadoIds.has(a.candidato.militarId) && !idsAcumulando.has(a.candidato.militarId) && a.porTurno.some((t) => t.conflito),
  );
  const idsEmChoque = new Set(emChoqueAvaliados.map((a) => a.candidato.militarId));
  const emChoque = await Promise.all(emChoqueAvaliados.sort(ordem).map((a) => comChoque(c, v, a, quem)));
  const contagem = new Map<string, number>();
  for (const a of avaliados) {
    if (idsAcumulando.has(a.candidato.militarId) || idsEmChoque.has(a.candidato.militarId)) continue; // quem pode acumular ou está em choque aparece nas outras listas, não como "de fora"
    const m = motivoFinal(a);
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const fora = [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, 'pt-BR'));
  const acumular = acumulando.map(({ a, alocacaoId, vaga }) => ({
    alocacaoId, militarId: a.candidato.militarId, posto: a.candidato.posto, nomeGuerra: a.candidato.nomeGuerra, matricula: a.candidato.matricula, vaga,
  }));
  // a cota de saldo do Adm à vista (6.38): só quem é do Adm, numa consulta só
  const doAdm = [...aptos, ...emChoque, ...semVoluntariado].filter((x) => x.jornada === 'adm');
  if (doAdm.length) {
    const unidadeId = (await c.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [v.escalaId])).rows[0]!.unidade_id;
    const cotas = await cotasDeSaldo(c, unidadeId, doAdm.map((x) => x.militarId), v.data.slice(0, 7));
    for (const x of doAdm) x.saldos = cotas.get(x.militarId)!;
  }
  return { aptos, emChoque, semVoluntariado, fora, acumular };
}

/** O militar em choque, com o choque de cada turno em que ele acontece e se quem pede pode resolvê-lo. */
async function comChoque(c: Consulta, v: VagaConsultada, a: Avaliado, quem?: { usuarioId: string; hoje: string }): Promise<CandidatoEmChoque> {
  const unidadeDaEscala = (await c.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [v.escalaId])).rows[0]!.unidade_id;
  const servicos: CandidatoEmChoque['servicos'] = [];
  for (const t of a.porTurno.filter((x) => x.conflito)) {
    const { alocacoes, expediente } = t.conflito!;
    let choque: ChoqueDoCandidato;
    if (alocacoes.length > 0) {
      // o primeiro que choca (o mais cedo); só se resolve quando ele é o único e o expediente não entra na conta
      const l = [...alocacoes].sort((x, y) => `${x.data}${x.inicio}`.localeCompare(`${y.data}${y.inicio}`))[0]!;
      const unico = alocacoes.length === 1 && !expediente;
      choque = { tipo: 'alocacao', alocacaoId: l.id, servico: l.servicoNome, data: l.data, inicio: l.inicio, fim: l.fim, escala: l.escala, unidadeSigla: l.unidadeSigla, podeResolver: unico && !!quem && (await podeTirarDe(c, quem, l, unidadeDaEscala)) };
    } else {
      choque = { tipo: 'expediente', data: v.data, podeResolver: t.turno.tira && !!quem && (await temPapel(c, quem.usuarioId, a.lotacaoUnidadeId, CADASTRO, quem.hoje)) };
    }
    servicos.push({ servicoId: t.turno.servicoId, turnoId: t.turno.turnoId, nome: t.turno.nome, choque });
  }
  return { ...a.candidato, servicos };
}

/**
 * Quem escala aqui pode tirar o militar do serviço de lá (6.38): a escala de lá é de escalante (não é uma rodada de cotas) numa unidade igual à da escala daqui ou
 * abaixo dela, e quem pede tem nível de acesso nela.
 */
export async function podeTirarDe(c: Consulta, quem: { usuarioId: string; hoje: string }, onde: { unidadeId: string; distribuicao: string }, unidadeDaEscalaDeAqui: string): Promise<boolean> {
  if (onde.distribuicao !== 'pre_escala') return false;
  const abaixo = (await c.query<{ ok: boolean }>('select a.caminho @> l.caminho as ok from unidade a, unidade l where a.id = $1 and l.id = $2', [unidadeDaEscalaDeAqui, onde.unidadeId])).rows[0]?.ok;
  return !!abaixo && (await temPapel(c, quem.usuarioId, onde.unidadeId, CADASTRO, quem.hoje));
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
