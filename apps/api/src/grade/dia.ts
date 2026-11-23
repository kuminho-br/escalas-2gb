// O painel do dia da Grade geral: como o militar está num dia (afastamento, horários marcados, serviços, choques) e onde ele pode
// entrar ("Adicionar serviço neste dia"), em todas as escalas ativas da seção.
import type { OpcaoDeServico, PainelDoDia, ServicoNoDia } from 'contratos';
import { textoFaixa, tipoDoServicoFixo } from 'contratos';
import { cnhParaEscala, detectarChoques, diaDaSemana, unirFaixas, type AlocChoque, type Choque } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { somarDias } from '../datas.ts';
import { ocupantesDaFuncao } from '../escala/alocacoes.ts';
import { avaliarFaixa, SEM_VOLUNTARIADO } from '../escala/elegibilidade.ts';
import { EXPEDIENTE, horariosDaUnidade } from '../escala/horarios.ts';

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const diaMes = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

type Dados = {
  id: string; matricula: string; nome_guerra: string; posto: string; motorista: boolean; cnh: string[]; voluntario_jes: boolean;
  jornada: 'pronto' | 'adm' | null; equipe: string | null; desde: string | null; ate: string | null;
};

/** O militar da seção no mês da data: lotado nela (a lotação que cobre o dia, ou a do mês) ou escalado nela no mês. Null se não é daqui. */
async function dadosDoMilitar(c: Consulta, unidadeId: string, militarId: string, data: string): Promise<Dados | null> {
  const mes = data.slice(0, 7);
  const { rows } = await c.query<Dados>(
    `select m.id, m.matricula, m.nome_guerra, p.sigla as posto, m.motorista, m.cnh, m.voluntario_jes, l.jornada, e.nome as equipe,
            to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
       from militar m join posto_grad p on p.id = m.posto_grad_id
       left join rastreio l on l.militar_id = m.id and l.unidade_id = $2
            and l.desde <= (date_trunc('month', $3::date) + interval '1 month' - interval '1 day')::date and (l.ate is null or l.ate >= date_trunc('month', $3::date)::date)
       left join equipe e on e.id = l.equipe_id
      where m.id = $1
      order by (l.desde <= $3::date and (l.ate is null or l.ate >= $3::date)) desc nulls last
      limit 1`,
    [militarId, unidadeId, data],
  );
  const d = rows[0];
  if (!d) return null;
  if (d.jornada) return d;
  const escalado = (
    await c.query(
      `select 1 from alocacao a join servico s on s.id = a.servico_id where a.militar_id = $1 and s.unidade_id = $2 and to_char(a.data, 'YYYY-MM') = $3 limit 1`,
      [militarId, unidadeId, mes],
    )
  ).rows.length;
  return escalado ? d : null;
}

export async function montarPainelDoDia(c: Consulta, unidadeId: string, militarId: string, data: string): Promise<PainelDoDia | null> {
  const mes = data.slice(0, 7);
  const m = await dadosDoMilitar(c, unidadeId, militarId, data);
  if (!m) return null;
  const jornada = m.jornada ?? 'pronto';

  const afastamento =
    (
      await c.query<{ nome: string }>(
        'select ta.nome from afastamento a join tipo_afastamento ta on ta.id = a.tipo_afastamento_id where a.militar_id = $1 and a.inicio <= $2::date and a.fim >= $2::date limit 1',
        [militarId, data],
      )
    ).rows[0]?.nome ?? null;

  const marcadas = (
    await c.query<{ inicio_min: number; fim_min: number }>('select inicio_min, fim_min from disponibilidade where militar_id = $1 and data = $2::date', [militarId, data])
  ).rows;
  const disponibilidade = unirFaixas(marcadas.map((r) => ({ inicio: r.inicio_min, fim: r.fim_min }))).map((f) => ({ inicio: hhmm(f.inicio), fim: hhmm(f.fim) }));

  // os serviços do dia
  const doDia = (
    await c.query<{
      id: string; escala_id: string; escala: string; servico_id: string; servico: string; cor: string; tipo: string; letra: string; inicio: string; fim: string;
      guarnicao: string | null; funcao: string | null;
    }>(
      `select a.id, a.escala_id, e.nome as escala, s.id as servico_id, s.nome as servico, s.cor, s.tipo, t.letra,
              to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, g.nome as guarnicao, f.nome as funcao
         from alocacao a join escala e on e.id = a.escala_id join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
         left join guarnicao g on g.id = a.guarnicao_id left join funcao f on f.id = a.funcao_id
        where a.militar_id = $1 and a.data = $2::date and s.unidade_id = $3
        order by t.inicio, s.nome`,
      [militarId, data, unidadeId],
    )
  ).rows;
  const acumulos = doDia.length
    ? (
        await c.query<{ alocacao_id: string; guarnicao: string; funcao: string }>(
          `select x.alocacao_id, g.nome as guarnicao, f.nome as funcao from alocacao_acumulo x join guarnicao g on g.id = x.guarnicao_id join funcao f on f.id = x.funcao_id
            where x.alocacao_id = any($1::uuid[]) order by f.nome, g.nome`,
          [doDia.map((a) => a.id)],
        )
      ).rows
    : [];
  const servicos: ServicoNoDia[] = doDia.map((a) => ({
    alocacaoId: a.id, escalaId: a.escala_id, escala: a.escala,
    servico: { id: a.servico_id, nome: a.servico, cor: a.cor, tipo: a.tipo },
    letra: a.letra, inicio: a.inicio, fim: a.fim, guarnicao: a.guarnicao, funcao: a.funcao,
    acumulaCom: acumulos.filter((x) => x.alocacao_id === a.id).map((x) => `${x.funcao} ${x.guarnicao}`),
  }));

  const { horarios, tipos } = await horariosDaUnidade(c, unidadeId);
  const choques = await frasesDeChoque(c, unidadeId, militarId, jornada, data, horarios, tipos);

  const opcoes = afastamento ? [] : await opcoesDoDia(c, unidadeId, militarId, data, mes, cnhParaEscala(m));

  return {
    militar: { militarId: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, matricula: m.matricula, equipe: m.equipe, jornada, cnh: m.motorista ? m.cnh : [], voluntarioJes: m.voluntario_jes },
    data, afastamento, disponibilidade, servicos, choques, opcoes,
  };
}

/** Os choques que tocam o dia, como frases. Usa as alocações do dia anterior ao seguinte e o expediente implícito do Adm. */
async function frasesDeChoque(
  c: Consulta, unidadeId: string, militarId: string, jornada: 'pronto' | 'adm', data: string,
  horarios: Record<string, { ini: number; fim: number; dur: number }>, tipos: Record<string, string>,
): Promise<string[]> {
  const janela = (
    await c.query<{ data: string; nome: string; letra: string }>(
      `select to_char(a.data, 'YYYY-MM-DD') as data, s.nome, t.letra from alocacao a join turno t on t.id = a.turno_id join servico s on s.id = a.servico_id
        where a.militar_id = $1 and s.unidade_id = $2 and a.data between $3::date and $4::date`,
      [militarId, unidadeId, somarDias(data, -1), somarDias(data, 1)],
    )
  ).rows;
  const existentes: AlocChoque[] = janela.map((a) => ({ mat: militarId, dia: a.data, turno: a.letra, servico: a.nome }));
  const expediente: AlocChoque[] = [];
  if (jornada === 'adm') {
    const feriados = new Set<string>();
    for (const ano of new Set([somarDias(data, -1), somarDias(data, 1)].map((d) => Number(d.slice(0, 4))))) for (const f of await feriadosDoAno(c, unidadeId, ano)) feriados.add(f.data);
    const afastados = (
      await c.query<{ inicio: string; fim: string }>(
        "select to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim from afastamento where militar_id = $1 and inicio <= $3::date and fim >= $2::date",
        [militarId, somarDias(data, -1), somarDias(data, 1)],
      )
    ).rows;
    for (const n of [-1, 0, 1]) {
      const d = somarDias(data, n);
      if (diaDaSemana(d) < 1 || diaDaSemana(d) > 5 || feriados.has(d) || afastados.some((a) => a.inicio <= d && a.fim >= d)) continue;
      expediente.push({ mat: militarId, dia: d, turno: EXPEDIENTE.turno, servico: EXPEDIENTE.servico, implicito: true });
    }
  }
  const faixa = (servico: string, turno: string) => {
    const h = horarios[`${servico}|${turno}`];
    return h ? textoFaixa(hhmm(h.ini % 1440), hhmm((h.ini + h.dur) % 1440)) : '';
  };
  const lado = (l: Choque['a']) => `${l.servico} ${l.turno} (${faixa(l.servico, l.turno)})${l.dia === data ? '' : ` do dia ${diaMes(l.dia)}`}`;
  return detectarChoques([...existentes, ...expediente], horarios, { tipos })
    .choques.filter((x) => x.a.dia === data || x.b.dia === data)
    .map((x) => {
      if (x.tipo === 'expediente') return `Choque com o expediente (${faixa(EXPEDIENTE.servico, EXPEDIENTE.turno)}): ${lado(x.a.implicito ? x.b : x.a)}`;
      if (x.tipo === 'emenda') return `Emenda proibida: ${lado(x.a)} termina quando ${lado(x.b)} começa`;
      return `Choque de horário: ${lado(x.a)} com ${lado(x.b)}`;
    });
}

/** "Adicionar serviço neste dia": para cada escala ativa e cada faixa dos turnos dela, onde ele entra (vagas com função livre e CNH que vale para a escala, e "Sem guarnição"). */
async function opcoesDoDia(c: Consulta, unidadeId: string, militarId: string, data: string, mes: string, habilitadas: string[]): Promise<OpcaoDeServico[]> {
  const escalas = (await c.query<{ id: string; nome: string }>("select id, nome from escala where unidade_id = $1 and ativa and distribuicao = 'pre_escala' order by nome", [unidadeId])).rows;
  const resultado: OpcaoDeServico[] = [];
  for (const e of escalas) {
    const faixas = (
      await c.query<{ inicio: string; fim: string }>(
        `select distinct to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
           from escala_servico es join turno t on t.servico_id = es.servico_id where es.escala_id = $1 order by 1, 2`,
        [e.id],
      )
    ).rows;
    const vinculo = (await vinculosDaEscala(c, e.id)).find((v) => v.vigencia <= mes);
    for (const f of faixas) {
      const { avaliados } = await avaliarFaixa(c, { escalaId: e.id, data, inicio: f.inicio, fim: f.fim, guarnicaoId: null, funcaoId: null }, militarId);
      const a = avaliados[0];
      if (!a || a.militarMotivo) continue;
      const possiveis = a.porTurno
        .filter((t) => t.motivo === null || t.motivo === SEM_VOLUNTARIADO)
        .map((t) => ({ servicoId: t.turno.servicoId, turnoId: t.turno.turnoId, nome: t.turno.nome, semVoluntariado: t.motivo === SEM_VOLUNTARIADO }));
      if (!possiveis.length) continue;
      // as vagas da faixa em que ele entra: guarnição e função com lugar e com a CNH que ele tem
      const guarnicaoIds = (vinculo?.itens ?? []).filter((i) => i.inicio.slice(0, 5) === f.inicio && i.fim.slice(0, 5) === f.fim).map((i) => i.guarnicaoId);
      const vagas: { guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string }[] = [];
      if (guarnicaoIds.length) {
        const versoes = await versoesDasGuarnicoes(c, guarnicaoIds);
        const nomes = new Map((await c.query<{ id: string; nome: string }>('select id, nome from guarnicao where id = any($1::uuid[])', [guarnicaoIds])).rows.map((g) => [g.id, g.nome]));
        for (const gid of guarnicaoIds) {
          const versao = versaoNoMes(versoes.get(gid) ?? [], mes);
          if (!versao?.ativa) continue;
          for (const fn of versao.composicao) {
            if (fn.cnhExigida && !habilitadas.includes(fn.cnhExigida as never)) continue;
            if ((await ocupantesDaFuncao(c, e.id, data, f, gid, fn.funcaoId)) >= fn.maximo) continue;
            vagas.push({ guarnicaoId: gid, guarnicao: nomes.get(gid) ?? '', funcaoId: fn.funcaoId, funcao: fn.funcao });
          }
        }
      }
      // da aba Ordinário só os serviços fixos (Pronto, Saldo, Expediente, JES); uma diária reunida na mesma escala, mesmo na mesma faixa, é opção
      // própria das Operações: separar os dois grupos evita que a diária leve o Pronto junto para a outra aba
      const fixos = possiveis.filter((x) => tipoDoServicoFixo(x.nome) !== null);
      const outros = possiveis.filter((x) => tipoDoServicoFixo(x.nome) === null);
      for (const [servicos, ordinario] of [[fixos, true], [outros, false]] as const) {
        if (!servicos.length) continue;
        const base = { escalaId: e.id, escala: e.nome, inicio: f.inicio, fim: f.fim, servicos, semVoluntariado: servicos[0]!.semVoluntariado, ordinario };
        for (const v of vagas) resultado.push({ ...base, ...v });
        resultado.push({ ...base, guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null });
      }
    }
  }
  return resultado;
}
