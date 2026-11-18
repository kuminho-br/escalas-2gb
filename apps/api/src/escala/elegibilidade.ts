// Quem pode ocupar uma vaga da escala (telas: "Escolher militar"). As regras de choque, CNH e voluntariado vêm do motor
// (`pacotes/dominio`); aqui o banco é traduzido para o que o motor recebe (matrícula = id do militar, serviço = nome, turno = letra).
import type { Candidato, Candidatos } from 'contratos';
import {
  chaveAloc,
  cnhHabilitadas,
  compararAntiguidade,
  detectarChoques,
  diaDaSemana,
  exigeVoluntarioJes,
  montarHorarios,
  turnosPadraoExigidos,
  type AlocChoque,
  type Militar,
} from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';

export type VagaConsultada = { escalaId: string; data: string; inicio: string; fim: string; guarnicaoId: string | null; funcaoId: string | null };

type Tipo = 'ordinario' | 'pjes' | 'diaria';
type TurnoDaFaixa = { turnoId: string; servicoId: string; nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string };
type Avaliado = { candidato: Omit<Candidato, 'servicos'>; militarMotivo: string | null; porTurno: { turno: TurnoDaFaixa; motivo: string | null }[]; antig: number | null };

const NOME_DO_TIPO: Record<Tipo, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };
const NAO_LOTADO = 'Não está lotado na seção neste dia';
/** Expediente do Adm (08h às 16h), implícito nos dias úteis; vale o turno A do serviço Expediente se a seção o tiver cadastrado. */
const EXPEDIENTE = { servico: 'Expediente', turno: 'A', ini: 480, fim: 960 };

const somarDias = (data: string, n: number) => new Date(new Date(`${data}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

async function avaliar(c: Consulta, v: VagaConsultada, somenteMilitar?: string): Promise<{ turnos: TurnoDaFaixa[]; avaliados: Avaliado[] }> {
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
         join lotacao l on l.militar_id = m.id and l.unidade_id = $1
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
  const doUnidade = (
    await c.query<{ nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
      `select s.nome, s.tipo, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from turno t join servico s on s.id = t.servico_id where s.unidade_id = $1`,
      [unidadeId],
    )
  ).rows;
  const horarios = montarHorarios(doUnidade.map((t) => ({ servico: t.nome, turno: t.letra, inicio: t.inicio, fim: t.fim }))).porChave;
  const chaveExpediente = `${EXPEDIENTE.servico}|${EXPEDIENTE.turno}`;
  horarios[chaveExpediente] ??= { ini: EXPEDIENTE.ini, fim: EXPEDIENTE.fim, dur: EXPEDIENTE.fim - EXPEDIENTE.ini };
  const tipos = Object.fromEntries(doUnidade.map((t) => [t.nome, NOME_DO_TIPO[t.tipo]]));

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
  const voluntariado = new Set(
    ids.length
      ? (
          await c.query<{ militar_id: string; data: string; turno_padrao: string }>(
            "select militar_id, to_char(data, 'YYYY-MM-DD') as data, turno_padrao from voluntariado where militar_id = any($1) and data between $2::date - 1 and $2::date + 1",
            [ids, v.data],
          )
        ).rows.map((r) => `${r.militar_id}|${r.data}|${r.turno_padrao}`)
      : [],
  );
  const feriados = new Set<string>();
  for (const ano of new Set([somarDias(v.data, -1), somarDias(v.data, 1)].map((d) => Number(d.slice(0, 4))))) {
    for (const f of await feriadosDoAno(c, unidadeId, ano)) feriados.add(f.data);
  }
  const util = (d: string) => diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5 && !feriados.has(d);

  let exigida: string | null = null;
  if (v.guarnicaoId && v.funcaoId) {
    const versao = versaoNoMes((await versoesDasGuarnicoes(c, [v.guarnicaoId])).get(v.guarnicaoId) ?? [], v.data.slice(0, 7));
    exigida = versao?.composicao.find((f) => f.funcaoId === v.funcaoId)?.cnhExigida ?? null;
  }

  const avaliados = militares.map((m): Avaliado => {
    const base = { militarId: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, matricula: m.matricula, equipe: m.equipe, jornada: m.jornada };
    const pronto = (militarMotivo: string | null, porTurno: Avaliado['porTurno'] = []): Avaliado => ({ candidato: base, militarMotivo, porTurno, antig: m.antiguidade });
    if (!m.lotado_no_dia) return pronto(NAO_LOTADO);
    if (!m.ativo) return pronto('Desativado');
    if (afastados.has(m.id)) return pronto('Afastado');
    if (exigida && !cnhHabilitadas(m.cnh).includes(exigida)) return pronto('Sem a CNH exigida');
    const dele = janela.filter((a) => a.militar_id === m.id);
    if (dele.some((a) => a.data === v.data && a.inicio === v.inicio && a.fim === v.fim)) return pronto('Já escalado neste horário');
    const existentes: AlocChoque[] = dele.map((a) => ({ mat: m.id, dia: a.data, turno: a.letra, servico: a.nome }));
    const expediente: AlocChoque[] =
      m.jornada === 'adm'
        ? [-1, 0, 1].map((n) => somarDias(v.data, n)).filter(util).map((dia) => ({ mat: m.id, dia, turno: EXPEDIENTE.turno, servico: EXPEDIENTE.servico, implicito: true }))
        : [];
    return pronto(
      null,
      turnos.map((turno) => {
        let motivo: string | null = null;
        if ((turno.tipo === 'pjes' || exigeVoluntarioJes(turno.nome)) && !m.voluntario_jes) motivo = 'Não é voluntário JES';
        else if (turno.tipo !== 'ordinario' && !turnosPadraoExigidos(turno.inicio, turno.fim).every((p) => voluntariado.has(`${m.id}|${somarDias(v.data, p.dia)}|${p.turno}`))) {
          motivo = 'Não marcou voluntariado neste horário';
        } else {
          const candidata: AlocChoque = { mat: m.id, dia: v.data, turno: turno.letra, servico: turno.nome };
          const chave = chaveAloc(candidata);
          const { choques } = detectarChoques([...existentes, ...expediente, candidata], horarios, { tipos });
          if (choques.some((x) => x.a.chave === chave || x.b.chave === chave)) motivo = 'Choque de horário';
        }
        return { turno, motivo };
      }),
    );
  });
  return { turnos, avaliados };
}

const motivoFinal = (a: Avaliado): string | null => a.militarMotivo ?? (a.porTurno.some((t) => t.motivo === null) ? null : (a.porTurno[0]?.motivo ?? 'Não há serviço nesta faixa'));

/** Os que podem ocupar a vaga (Pronto antes do Adm, depois por posto e antiguidade) e quantos ficaram de fora, por motivo. */
export async function avaliarCandidatos(c: Consulta, v: VagaConsultada): Promise<Candidatos> {
  const { avaliados } = await avaliar(c, v);
  const aptos = avaliados
    .filter((a) => motivoFinal(a) === null)
    .sort(
      (x, y) =>
        Number(x.candidato.jornada === 'adm') - Number(y.candidato.jornada === 'adm') ||
        compararAntiguidade(
          { mat: x.candidato.matricula, m: { mat: x.candidato.matricula, posto: x.candidato.posto, antig: x.antig } as Militar },
          { mat: y.candidato.matricula, m: { mat: y.candidato.matricula, posto: y.candidato.posto, antig: y.antig } as Militar },
        ),
    )
    .map((a): Candidato => ({
      ...a.candidato,
      servicos: a.porTurno.filter((t) => t.motivo === null).map((t) => ({ servicoId: t.turno.servicoId, turnoId: t.turno.turnoId, nome: t.turno.nome })),
    }));
  const contagem = new Map<string, number>();
  for (const a of avaliados) {
    const m = motivoFinal(a);
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const fora = [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, 'pt-BR'));
  return { aptos, fora };
}

/** Por que o militar não pode ocupar a vaga neste turno (a frase que a tela mostra); null se pode. */
export async function motivoDeFora(c: Consulta, v: VagaConsultada & { militarId: string; turnoId: string }): Promise<string | null> {
  const { avaliados } = await avaliar(c, v, v.militarId);
  const a = avaliados[0];
  if (!a) return NAO_LOTADO;
  if (a.militarMotivo) return a.militarMotivo;
  const doTurno = a.porTurno.find((t) => t.turno.turnoId === v.turnoId);
  return doTurno ? doTurno.motivo : 'Este turno não é desta faixa';
}
