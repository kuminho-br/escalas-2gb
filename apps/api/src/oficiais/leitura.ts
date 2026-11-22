// Leitura da escala dos oficiais e do painel de saldo.
import type { EscalaDosOficiais, EtapaDosOficiais, OficialDoMes, OficialNoSaldo } from 'contratos';
import { ordemDeEscolha } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { afastamentosDoMes, participantesDoMes, postoCurto, type AfastamentoDoMes } from './participantes.ts';

export interface LinhaDoMes {
  id: string;
  ordem_manual: string[];
  cotas_em: string | null;
  fechada_em: string | null;
  encerrada_em: string | null;
}

const ISO = (col: string) => `to_char(${col} at time zone 'America/Recife', 'YYYY-MM-DD"T"HH24:MI:SS')`;

export async function linhaDoMes(c: Consulta, unidadeId: string, mes: string, travar = false): Promise<LinhaDoMes | null> {
  const { rows } = await c.query<LinhaDoMes>(
    `select id, ordem_manual, ${ISO('cotas_em')} as cotas_em, ${ISO('fechada_em')} as fechada_em, ${ISO('encerrada_em')} as encerrada_em
       from oficiais_mes where unidade_id = $1 and mes = $2::date ${travar ? 'for update' : ''}`,
    [unidadeId, `${mes}-01`],
  );
  return rows[0] ?? null;
}

export function etapaDoMes(l: LinhaDoMes | null): EtapaDosOficiais {
  if (!l || !l.cotas_em) return 'sem-cotas';
  if (l.encerrada_em) return 'encerrada';
  if (l.fechada_em) return 'fechada';
  return 'escolhas';
}

const dm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Soma dos lançamentos de saldo de cada militar na unidade antes do mês (os meses anteriores e os ajustes). */
async function saldosAnteriores(c: Consulta, unidadeId: string, mes: string): Promise<Map<string, number>> {
  const { rows } = await c.query<{ militar_id: string; total: string }>(
    `select s.militar_id, sum(s.valor)::text as total
       from oficiais_saldo s left join oficiais_mes m on m.id = s.mes_id
      where s.unidade_id = $1 and (s.mes_id is null or m.mes < $2::date)
      group by s.militar_id`,
    [unidadeId, `${mes}-01`],
  );
  return new Map(rows.map((r) => [r.militar_id, Number(r.total)]));
}

/** A escala do mês: antes do cálculo, os participantes do momento; depois, as cotas gravadas. */
export async function lerEscala(c: Consulta, unidadeId: string, mes: string): Promise<EscalaDosOficiais> {
  const linha = await linhaDoMes(c, unidadeId, mes);
  const etapa = etapaDoMes(linha);
  const participantes = await participantesDoMes(c, unidadeId, mes);
  const anteriores = await saldosAnteriores(c, unidadeId, mes);
  const porId = new Map(participantes.map((p) => [p.militarId, p]));

  type Cota = { militarId: string; ordem: number; dias: number; devido: number; cota: number; sobra: boolean };
  let cotas: Cota[] = [];
  let turnos: EscalaDosOficiais['turnos'] = [];
  if (linha) {
    cotas = (
      await c.query<{ militar_id: string; ordem: number; dias: number; devido: string; cota: number; sobra: boolean }>(
        'select militar_id, ordem, dias, devido::text as devido, cota, sobra from oficiais_cota where mes_id = $1 order by ordem', [linha.id])
    ).rows.map((r) => ({ militarId: r.militar_id, ordem: r.ordem, dias: r.dias, devido: Number(r.devido), cota: r.cota, sobra: r.sobra }));
    turnos = (
      await c.query<{ dia: string; turno: 'dia' | 'noite'; militar_id: string | null; saiu_militar_id: string | null }>(
        "select to_char(dia, 'YYYY-MM-DD') as dia, turno, militar_id, saiu_militar_id from oficiais_turno where mes_id = $1 order by dia, turno", [linha.id])
    ).rows.map((r) => ({ dia: r.dia, turno: r.turno, militarId: r.militar_id, saiuMilitarId: r.saiu_militar_id }));
  }

  // quem está na cota mas já não é participante (saiu da unidade depois do cálculo) mantém os dados do cadastro
  const foraDaLista = cotas.map((x) => x.militarId).filter((id) => !porId.has(id));
  const extras = new Map<string, { matricula: string; posto: string; nomeGuerra: string; antiguidade: number | null; quadro: string | null; afastamentos: AfastamentoDoMes[] }>();
  if (foraDaLista.length > 0) {
    const { rows } = await c.query<{ id: string; matricula: string; posto: string; nome_guerra: string; antiguidade: number | null; quadro: string | null }>(
      `select m.id, m.matricula, p.sigla as posto, m.nome_guerra, m.antiguidade, q.sigla as quadro
         from militar m join posto_grad p on p.id = m.posto_grad_id left join quadro q on q.id = m.quadro_id where m.id = any($1::uuid[])`, [foraDaLista]);
    const afast = await afastamentosDoMes(c, foraDaLista, mes);
    for (const r of rows) extras.set(r.id, { matricula: r.matricula, posto: postoCurto(r.posto), nomeGuerra: r.nome_guerra, antiguidade: r.antiguidade, quadro: r.quadro, afastamentos: afast.get(r.id) ?? [] });
  }

  const escolhidos = (id: string) => turnos.filter((t) => t.militarId === id).length;
  const montar = (militarId: string, ordem: number, cota: Cota | null, dias: number): OficialDoMes => {
    const p = porId.get(militarId);
    const x = extras.get(militarId);
    return {
      militarId,
      matricula: p?.matricula ?? x?.matricula ?? '',
      posto: p?.posto ?? x?.posto ?? '',
      nomeGuerra: p?.nomeGuerra ?? x?.nomeGuerra ?? '',
      quadro: (p?.quadro ?? x?.quadro ?? 'QOA') as 'QOC' | 'QOA',
      lotacao: p?.lotacao ?? '',
      ordem,
      semAntiguidade: (p?.antiguidade ?? x?.antiguidade ?? null) === null,
      saldoAnterior: anteriores.get(militarId) ?? 0,
      dias,
      devido: cota ? cota.devido : null,
      cota: cota ? cota.cota : null,
      sobra: cota ? cota.sobra : false,
      escolhidos: escolhidos(militarId),
      afastamentos: p?.afastamentos ?? x?.afastamentos ?? [],
    };
  };

  let oficiais: OficialDoMes[];
  if (cotas.length > 0) {
    oficiais = cotas.map((x) => montar(x.militarId, x.ordem, x, x.dias));
  } else {
    const ordemIds = ordemDeEscolha(participantes, linha?.ordem_manual ?? []);
    oficiais = ordemIds.map((id, i) => montar(id, i + 1, null, porId.get(id)!.dias));
  }

  const vez = etapa === 'sem-cotas' ? null : (oficiais.find((o) => o.cota !== null && o.escolhidos < o.cota)?.militarId ?? null);

  const avisos: EscalaDosOficiais['avisos'] = [];
  for (const t of turnos) {
    if (!t.militarId) continue;
    const o = oficiais.find((x) => x.militarId === t.militarId);
    const af = o?.afastamentos.find((a) => a.inicio <= t.dia && t.dia <= a.fim);
    if (o && af) {
      avisos.push({
        dia: t.dia, turno: t.turno, militarId: t.militarId,
        texto: `${o.posto} ${o.nomeGuerra} está afastado em ${dm(t.dia)} (${af.tipo}) e está no turno ${t.turno === 'dia' ? 'do dia' : 'da noite'}. A escala pode ser fechada mesmo assim.`,
      });
    }
  }

  return {
    mes,
    etapa,
    cotasEm: linha?.cotas_em ?? null,
    fechadaEm: linha?.fechada_em ?? null,
    encerradaEm: linha?.encerrada_em ?? null,
    oficiais,
    vez,
    turnos,
    avisos,
  };
}

/** O painel de saldo: quem tem lançamento na unidade ou participa do mês corrente. */
export async function lerSaldo(c: Consulta, unidadeId: string, hoje = hojeRecife()): Promise<OficialNoSaldo[]> {
  const mesAtual = hoje.slice(0, 7);
  const participantes = await participantesDoMes(c, unidadeId, mesAtual);
  const linhaAtual = await linhaDoMes(c, unidadeId, mesAtual);
  const ordemIds = ordemDeEscolha(participantes, linhaAtual?.ordem_manual ?? []);

  const { rows: lanc } = await c.query<{
    militar_id: string; tipo: 'mes' | 'entrada' | 'ajuste'; valor: string; tirado: number | null; devido: string | null; turnos_dia: number | null;
    turnos_noite: number | null; motivo: string | null; mes: string | null; encerrada: string | null; criado: string;
  }>(
    `select s.militar_id, s.tipo, s.valor::text as valor, s.tirado, s.devido::text as devido, s.turnos_dia, s.turnos_noite, s.motivo,
            to_char(m.mes, 'YYYY-MM') as mes, to_char(m.encerrada_em at time zone 'America/Recife', 'YYYY-MM-DD') as encerrada,
            to_char(s.criado_em at time zone 'America/Recife', 'YYYY-MM-DD') as criado
       from oficiais_saldo s left join oficiais_mes m on m.id = s.mes_id
      where s.unidade_id = $1
      order by coalesce(m.mes, s.criado_em::date), s.criado_em, s.id`,
    [unidadeId],
  );
  const { rows: coberturas } = await c.query<{ dia: string; militar_id: string; saiu_id: string; mes: string }>(
    `select to_char(t.dia, 'YYYY-MM-DD') as dia, t.militar_id, t.saiu_militar_id as saiu_id, to_char(m.mes, 'YYYY-MM') as mes
       from oficiais_turno t join oficiais_mes m on m.id = t.mes_id
      where m.unidade_id = $1 and t.saiu_militar_id is not null order by t.dia, t.turno`,
    [unidadeId],
  );

  const ids = [...new Set([...ordemIds, ...lanc.map((l) => l.militar_id), ...coberturas.flatMap((t) => [t.militar_id, t.saiu_id])])];
  if (ids.length === 0) return [];
  const { rows: cadastro } = await c.query<{ id: string; matricula: string; posto: string; posto_ordem: number; nome_guerra: string; quadro: string | null }>(
    `select m.id, m.matricula, p.sigla as posto, -p.ordem as posto_ordem, m.nome_guerra, q.sigla as quadro
       from militar m join posto_grad p on p.id = m.posto_grad_id left join quadro q on q.id = m.quadro_id where m.id = any($1::uuid[])`, [ids]);
  const por = new Map(cadastro.map((m) => [m.id, m]));
  const lotacaoDe = new Map(participantes.map((p) => [p.militarId, p.lotacao]));
  const nome = (id: string) => {
    const m = por.get(id);
    return m ? `${postoCurto(m.posto)} ${m.nome_guerra}` : 'outro oficial';
  };
  const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

  const lista: OficialNoSaldo[] = ids.filter((id) => por.has(id)).map((id) => {
    const m = por.get(id)!;
    const meus = lanc.filter((l) => l.militar_id === id);
    const registro: OficialNoSaldo['registro'] = [];
    for (const l of meus) {
      if (l.tipo === 'mes') {
        registro.push({ tipo: 'mes', data: l.encerrada ?? l.criado, mes: l.mes, valor: Number(l.valor), texto: `Devia ${Number(l.devido).toFixed(2).replace('.', ',')}, tirou ${l.tirado}` });
      } else if (l.tipo === 'entrada') {
        registro.push({ tipo: 'entrada', data: l.criado, mes: l.mes, valor: Number(l.valor), texto: 'Entrou com a média dos saldos de quem já estava.' });
      } else {
        registro.push({ tipo: 'ajuste', data: l.criado, mes: null, valor: Number(l.valor), texto: `Ajuste do gestor em ${dataBr(l.criado)}: ${l.motivo}` });
      }
    }
    for (const t of coberturas) {
      if (t.militar_id === id) registro.push({ tipo: 'cobriu', data: t.dia, mes: t.mes, valor: 1, texto: `Cobriu ${nome(t.saiu_id)} em ${dataBr(t.dia)}.` });
      if (t.saiu_id === id) registro.push({ tipo: 'saiu', data: t.dia, mes: t.mes, valor: 0, texto: `Saiu em ${dataBr(t.dia)}; ${nome(t.militar_id)} cobriu. Não fica devendo.` });
    }
    // por mês; no mesmo mês, a entrada vem antes das coberturas e do saldo do mês
    const ordemDoTipo = { entrada: 0, cobriu: 1, saiu: 1, mes: 2, ajuste: 3 } as const;
    registro.sort((a, b) => (a.mes ?? a.data.slice(0, 7)).localeCompare(b.mes ?? b.data.slice(0, 7)) || ordemDoTipo[a.tipo] - ordemDoTipo[b.tipo] || a.data.localeCompare(b.data));
    const doMes = meus.filter((l) => l.tipo === 'mes');
    return {
      militarId: id,
      matricula: m.matricula,
      posto: postoCurto(m.posto),
      nomeGuerra: m.nome_guerra,
      quadro: m.quadro,
      lotacao: lotacaoDe.get(id) ?? null,
      saldo: meus.reduce((s, l) => s + Number(l.valor), 0),
      meses: doMes.map((l) => ({ mes: l.mes!, valor: Number(l.valor) })),
      turnosDia: doMes.reduce((s, l) => s + (l.turnos_dia ?? 0), 0),
      turnosNoite: doMes.reduce((s, l) => s + (l.turnos_noite ?? 0), 0),
      registro,
    };
  });
  const posicao = new Map(ordemIds.map((id, i) => [id, i]));
  const ordemPosto = (id: string) => por.get(id)!.posto_ordem;
  return lista.sort((a, b) => {
    const pa = posicao.get(a.militarId);
    const pb = posicao.get(b.militarId);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return ordemPosto(a.militarId) - ordemPosto(b.militarId) || a.nomeGuerra.localeCompare(b.nomeGuerra, 'pt');
  });
}

