// Leitura da escala dos oficiais e do painel de saldo.
import type { EscalaDosOficiais, EtapaDosOficiais, OficialDoMes, OficialNoSaldo } from 'contratos';
import { diasDoMes, normalizar, ordemDeEscolha, rotuloDoTurno } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { afastamentosDoMes, elegiveisDoMes, limitesDoMes, marcasDoMes, postoCurto, type AfastamentoDoMes } from './participantes.ts';

export interface LinhaDoMes {
  id: string;
  escala_id: string;
  ordem_manual: string[];
  aberto_em: string | null;
  fechada_em: string | null;
  encerrada_em: string | null;
}

/**
 * O quadro do período que vale no mês: o que cobre o dia de referência (hoje, no mês de hoje; o primeiro dia, num mês futuro; o último, num
 * passado) e, sem ele, o mais recente dentro do mês. `$2` e `$3` são os limites do mês e `$4`, o dia de referência. Um período que só começa
 * depois do mês (um quadro marcado para o mês que vem) não vale para ele.
 */
const QUADRO_DO_MES = `(select q.sigla from rastreio r join quadro q on q.id = r.quadro_id
   where r.militar_id = m.id and r.desde <= $3::date and (r.ate is null or r.ate >= $2::date)
   order by (r.desde <= $4::date and (r.ate is null or r.ate >= $4::date)) desc, r.desde desc limit 1)`;
function referenciaDoMes(mes: string, hoje = hojeRecife()): [string, string, string] {
  const { inicio, fim } = limitesDoMes(mes);
  return [inicio, fim, hoje < inicio ? inicio : hoje > fim ? fim : hoje];
}

const ISO = (col: string) => `to_char(${col} at time zone 'America/Recife', 'YYYY-MM-DD"T"HH24:MI:SS')`;

/** O mês gravado da escala (a linha da rodada); null se ainda não foi gravado. */
export async function linhaDoMes(c: Consulta, escalaId: string, mes: string, travar = false): Promise<LinhaDoMes | null> {
  const { rows } = await c.query<LinhaDoMes>(
    `select id, escala_id, ordem_manual, ${ISO('aberto_em')} as aberto_em, ${ISO('fechada_em')} as fechada_em, ${ISO('encerrada_em')} as encerrada_em
       from oficiais_mes where escala_id = $1 and mes = $2::date ${travar ? 'for update' : ''}`,
    [escalaId, `${mes}-01`],
  );
  return rows[0] ?? null;
}

export function etapaDoMes(l: LinhaDoMes | null): EtapaDosOficiais {
  if (!l || !l.aberto_em) return 'nao-aberto';
  if (l.encerrada_em) return 'encerrada';
  if (l.fechada_em) return 'fechada';
  return 'escolhas';
}

/** As escalas da unidade que são rodada de cotas (a dos oficiais), ativas ou não, por nome. */
export async function escalasDaRodada(c: Consulta, unidadeId: string): Promise<{ id: string; nome: string }[]> {
  return (await c.query<{ id: string; nome: string }>("select id, nome from escala where unidade_id = $1 and distribuicao = 'rodada_de_cotas' order by nome", [unidadeId])).rows;
}

/**
 * A escala em que a tela trabalha: a pedida (se é rodada de cotas da unidade; senão, null); sem pedido, a do último mês gravado da unidade e, sem mês
 * nenhum, a primeira por nome. null se a unidade não tem escala de rodada de cotas.
 */
export async function escolherEscala(c: Consulta, unidadeId: string, pedida?: string | null): Promise<{ id: string; nome: string } | null> {
  const escalas = await escalasDaRodada(c, unidadeId);
  if (pedida) return escalas.find((e) => e.id === pedida) ?? null;
  const ultimo = (await c.query<{ escala_id: string }>('select escala_id from oficiais_mes where unidade_id = $1 order by mes desc, escala_id limit 1', [unidadeId])).rows[0]?.escala_id;
  return escalas.find((e) => e.id === ultimo) ?? escalas[0] ?? null;
}

export interface ServicosDaRodada {
  jes: { id: string; nome: string; cor: string } | null;
  saldo: { id: string; nome: string; cor: string } | null;
}

/** Os dois serviços da rodada: o JES (o de nome "JES", sem diferenciar caixa e acento) e o Saldo (o primeiro dos outros, na ordem da escala). */
export async function servicosDaRodada(c: Consulta, escalaId: string): Promise<ServicosDaRodada> {
  const { rows } = await c.query<{ id: string; nome: string; cor: string }>(
    'select s.id, s.nome, s.cor from escala_servico es join servico s on s.id = es.servico_id where es.escala_id = $1 order by es.ordem', [escalaId]);
  const jes = rows.find((s) => normalizar(s.nome) === 'JES') ?? null;
  return { jes, saldo: rows.find((s) => s.id !== jes?.id) ?? null };
}

/** Os lugares já tomados no mês da rodada: uma alocação por dia e letra, com quem saiu (cobertura), se houver. */
export interface Lancamento {
  id: string;
  dia: string;
  letra: string;
  servicoId: string;
  turnoId: string;
  militarId: string;
  saiuMilitarId: string | null;
}
export async function lancamentosDoMes(c: Consulta, escalaId: string, mes: string): Promise<Lancamento[]> {
  const { inicio, fim } = limitesDoMes(mes);
  const { rows } = await c.query<{ id: string; dia: string; letra: string; servico_id: string; turno_id: string; militar_id: string; saiu: string | null }>(
    `select a.id, to_char(a.data, 'YYYY-MM-DD') as dia, t.letra, a.servico_id, a.turno_id, a.militar_id, cb.saiu_militar_id as saiu
       from alocacao a join turno t on t.id = a.turno_id left join oficiais_cobertura cb on cb.alocacao_id = a.id
      where a.escala_id = $1 and a.data between $2::date and $3::date order by a.data, t.letra`,
    [escalaId, inicio, fim],
  );
  return rows.map((r) => ({ id: r.id, dia: r.dia, letra: r.letra, servicoId: r.servico_id, turnoId: r.turno_id, militarId: r.militar_id, saiuMilitarId: r.saiu }));
}

/** A cota de JES da unidade no mês e quantos JES já foram lançados nele, em todas as escalas da unidade (só informa; nada bloqueia). */
export async function jesDoMes(c: Consulta, unidadeId: string, servicoJesId: string | null, mes: string): Promise<{ cota: number | null; usados: number }> {
  if (!servicoJesId) return { cota: null, usados: 0 };
  const { inicio, fim } = limitesDoMes(mes);
  const cota = (await c.query<{ total: string | null }>('select sum(quantidade)::text as total from cota where unidade_id = $1 and servico_id = $2 and mes = $3::date', [unidadeId, servicoJesId, inicio])).rows[0]!.total;
  const usados = (await c.query<{ n: number }>('select count(*)::int as n from alocacao where servico_id = $1 and data between $2::date and $3::date', [servicoJesId, inicio, fim])).rows[0]!.n;
  return { cota: cota === null ? null : Number(cota), usados };
}

/** Os dias vermelhos da escala no mês, em ordem. */
export async function diasVermelhosDoMes(c: Consulta, escalaId: string, mes: string): Promise<string[]> {
  const { inicio, fim } = limitesDoMes(mes);
  const { rows } = await c.query<{ dia: string }>(
    "select to_char(dia, 'YYYY-MM-DD') as dia from dia_vermelho where escala_id = $1 and dia between $2::date and $3::date order by dia", [escalaId, inicio, fim]);
  return rows.map((r) => r.dia);
}

export interface TurnoDoServico {
  id: string;
  letra: string;
  inicio: string;
  fim: string;
  rotulo: 'Dia' | 'Noite';
}

/** Os turnos do serviço, em ordem de letra; horário HH:MM. */
export async function turnosDoServico(c: Consulta, servicoId: string | null): Promise<TurnoDoServico[]> {
  if (!servicoId) return [];
  const { rows } = await c.query<{ id: string; letra: string; inicio: string; fim: string }>(
    "select id, letra, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where servico_id = $1 order by letra", [servicoId]);
  return rows.map((t) => ({ ...t, rotulo: rotuloDoTurno(t.inicio) }));
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

/**
 * A escala do mês: os elegíveis, cada um com a marca de quem participa. Antes de abrir o mês, os participantes vêm primeiro, na ordem de escolha;
 * depois, as cotas gravadas. Quem não participa vem no fim, sem cota. A vez, as cotas e os lugares só contam participantes. `escalaId` é a escala
 * da rodada em que a tela trabalha (sem ela, a do último mês da unidade).
 */
export async function lerEscala(c: Consulta, unidadeId: string, mes: string, escalaId?: string | null): Promise<EscalaDosOficiais> {
  const escalas = await escalasDaRodada(c, unidadeId);
  const escala = await escolherEscala(c, unidadeId, escalaId);
  const linha = escala ? await linhaDoMes(c, escala.id, mes) : null;
  const etapa = etapaDoMes(linha);
  const servicos = escala ? await servicosDaRodada(c, escala.id) : { jes: null, saldo: null };
  const doServico = await turnosDoServico(c, servicos.saldo?.id ?? null);
  const turnosDoJes = await turnosDoServico(c, servicos.jes?.id ?? null);
  const rotuloDe = new Map([...doServico, ...turnosDoJes].map((t) => [t.id, t.rotulo]));
  const elegiveis = await elegiveisDoMes(c, unidadeId, mes);
  const { marcados, participantesAntes } = await marcasDoMes(c, escala?.id ?? null, mes, linha?.id ?? null);
  const participantes = elegiveis.filter((p) => marcados.has(p.militarId));
  const anteriores = await saldosAnteriores(c, unidadeId, mes);
  const porId = new Map(elegiveis.map((p) => [p.militarId, p]));

  type Cota = { militarId: string; ordem: number; dias: number; devido: number; cota: number; sobra: boolean };
  let cotas: Cota[] = [];
  let lancados: Lancamento[] = [];
  if (linha && escala) {
    cotas = (
      await c.query<{ militar_id: string; ordem: number; dias: number; devido: string; cota: number; sobra: boolean }>(
        'select militar_id, ordem, dias, devido::text as devido, cota, sobra from oficiais_cota where mes_id = $1 order by ordem', [linha.id])
    ).rows.map((r) => ({ militarId: r.militar_id, ordem: r.ordem, dias: r.dias, devido: Number(r.devido), cota: r.cota, sobra: r.sobra }));
  }
  if (escala) lancados = await lancamentosDoMes(c, escala.id, mes);
  const ehJes = (l: Lancamento) => l.servicoId === servicos.jes?.id;
  const diasVermelhos = escala ? await diasVermelhosDoMes(c, escala.id, mes) : [];
  const ehVermelho = new Set(diasVermelhos);

  // quem está na cota mas já não é participante (saiu da unidade depois do cálculo) mantém os dados do cadastro
  const foraDaLista = [...new Set([...cotas.map((x) => x.militarId), ...lancados.map((l) => l.militarId)])].filter((id) => !porId.has(id));
  const extras = new Map<string, { matricula: string; posto: string; nomeGuerra: string; antiguidade: number | null; voluntarioJes: boolean; quadro: string | null; afastamentos: AfastamentoDoMes[] }>();
  if (foraDaLista.length > 0) {
    const { rows } = await c.query<{ id: string; matricula: string; posto: string; nome_guerra: string; antiguidade: number | null; voluntario_jes: boolean; quadro: string | null }>(
      `select m.id, m.matricula, p.sigla as posto, m.nome_guerra, m.antiguidade, m.voluntario_jes, ${QUADRO_DO_MES} as quadro
         from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])`, [foraDaLista, ...referenciaDoMes(mes)]);
    const afast = await afastamentosDoMes(c, foraDaLista, mes);
    for (const r of rows) extras.set(r.id, { matricula: r.matricula, posto: postoCurto(r.posto), nomeGuerra: r.nome_guerra, antiguidade: r.antiguidade, voluntarioJes: r.voluntario_jes, quadro: r.quadro, afastamentos: afast.get(r.id) ?? [] });
  }

  const escolhidos = (id: string) => lancados.filter((l) => l.militarId === id && !ehJes(l)).length;
  const jesDe = (id: string) => lancados.filter((l) => l.militarId === id && ehJes(l)).length;
  const vermelhosDe = (id: string) => lancados.filter((l) => l.militarId === id && ehVermelho.has(l.dia)).length;
  const montar = (militarId: string, ordem: number, cota: Cota | null, dias: number, participa: boolean): OficialDoMes => {
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
      jes: jesDe(militarId),
      vermelhos: vermelhosDe(militarId),
      voluntarioJes: p?.voluntarioJes ?? x?.voluntarioJes ?? false,
      afastamentos: p?.afastamentos ?? x?.afastamentos ?? [],
      participa,
      // "novo" é de quem participa neste mês e não participou no mês anterior da escala; sem mês anterior gravado, ninguém é novo (decisão de 23/11)
      novo: participa && participantesAntes !== null && !participantesAntes.has(militarId),
    };
  };

  let oficiais: OficialDoMes[];
  if (cotas.length > 0) {
    oficiais = cotas.map((x) => montar(x.militarId, x.ordem, x, x.dias, true));
  } else {
    const ordemIds = ordemDeEscolha(participantes, linha?.ordem_manual ?? []);
    oficiais = ordemIds.map((id, i) => montar(id, i + 1, null, porId.get(id)!.dias, true));
  }
  // os elegíveis que não participam vêm depois, na mesma regra de ordem, sem cota
  const naRodada = new Set(oficiais.map((o) => o.militarId));
  const fora = elegiveis.filter((p) => !naRodada.has(p.militarId));
  for (const id of ordemDeEscolha(fora, [])) oficiais.push(montar(id, oficiais.length + 1, null, porId.get(id)!.dias, false));
  // quem tem lançamento mas não é elegível nem está na cota (saiu do quadro) continua na lista, para o lançamento não ficar sem dono
  for (const id of foraDaLista.filter((id) => !naRodada.has(id) && !oficiais.some((o) => o.militarId === id))) oficiais.push(montar(id, oficiais.length + 1, null, 0, false));

  const vez = etapa === 'nao-aberto' ? null : (oficiais.find((o) => o.cota !== null && o.escolhidos < o.cota)?.militarId ?? null);

  // o mês aberto tem um lugar por dia e por letra, tomado por um JES, por um Saldo ou ainda livre
  const turnos: EscalaDosOficiais['turnos'] = [];
  if (etapa !== 'nao-aberto') {
    const ocupado = new Map(lancados.map((l) => [`${l.dia}|${l.letra}`, l] as const));
    for (const dia of diasDoMes(mes)) {
      for (const t of doServico) {
        const l = ocupado.get(`${dia}|${t.letra}`);
        turnos.push({
          dia, letra: t.letra, turnoId: t.id,
          servico: l ? (ehJes(l) ? 'jes' : 'saldo') : null,
          alocacaoId: l?.id ?? null, militarId: l?.militarId ?? null, saiuMilitarId: l?.saiuMilitarId ?? null,
        });
      }
    }
  }
  const lugaresDoMes = doServico.length * diasDoMes(mes).length;
  const lugaresDeSaldo = Math.max(0, lugaresDoMes - lancados.filter(ehJes).length);

  const avisos: EscalaDosOficiais['avisos'] = [];
  for (const t of lancados) {
    const o = oficiais.find((x) => x.militarId === t.militarId);
    const af = o?.afastamentos.find((a) => a.inicio <= t.dia && t.dia <= a.fim);
    if (o && af) {
      avisos.push({
        dia: t.dia, turnoId: doServico.find((d) => d.letra === t.letra)?.id ?? t.turnoId, militarId: t.militarId,
        texto: `${o.posto} ${o.nomeGuerra} está afastado em ${dm(t.dia)} (${af.tipo}) e está no turno ${rotuloDe.get(t.turnoId) === 'Noite' ? 'da noite' : 'do dia'}. A escala pode ser fechada mesmo assim.`,
      });
    }
  }

  return {
    mes,
    etapa,
    abertaEm: linha?.aberto_em ?? null,
    fechadaEm: linha?.fechada_em ?? null,
    encerradaEm: linha?.encerrada_em ?? null,
    escala,
    escalas,
    servicos,
    turnosDoServico: doServico,
    oficiais,
    vez,
    turnos,
    lugaresDeSaldo,
    jes: await jesDoMes(c, unidadeId, servicos.jes?.id ?? null, mes),
    diasVermelhos,
    avisos,
  };
}

/** O painel de saldo: quem tem lançamento na unidade ou participa (está marcado) do mês corrente. */
export async function lerSaldo(c: Consulta, unidadeId: string, hoje = hojeRecife(), escalaId?: string | null): Promise<OficialNoSaldo[]> {
  const mesAtual = hoje.slice(0, 7);
  const escala = await escolherEscala(c, unidadeId, escalaId);
  const linhaAtual = escala ? await linhaDoMes(c, escala.id, mesAtual) : null;
  const { marcados } = await marcasDoMes(c, escala?.id ?? null, mesAtual, linhaAtual?.id ?? null);
  const participantes = (await elegiveisDoMes(c, unidadeId, mesAtual)).filter((p) => marcados.has(p.militarId));
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
    `select to_char(a.data, 'YYYY-MM-DD') as dia, a.militar_id, cb.saiu_militar_id as saiu_id, to_char(m.mes, 'YYYY-MM') as mes
       from oficiais_cobertura cb
       join alocacao a on a.id = cb.alocacao_id
       join oficiais_mes m on m.escala_id = a.escala_id and m.mes = date_trunc('month', a.data)::date
      where m.unidade_id = $1 order by a.data, a.turno_id`,
    [unidadeId],
  );

  // os lugares em dia vermelho que cada oficial tirou nos meses encerrados da escala
  const vermelhosDoOficial = new Map<string, number>();
  if (escala) {
    const { rows } = await c.query<{ militar_id: string; n: number }>(
      `select a.militar_id, count(*)::int as n
         from alocacao a
         join dia_vermelho d on d.escala_id = a.escala_id and d.dia = a.data
         join oficiais_mes m on m.escala_id = a.escala_id and m.mes = date_trunc('month', a.data)::date and m.encerrada_em is not null
        where a.escala_id = $1 group by a.militar_id`,
      [escala.id],
    );
    for (const r of rows) vermelhosDoOficial.set(r.militar_id, r.n);
  }

  const ids = [...new Set([...ordemIds, ...vermelhosDoOficial.keys(), ...lanc.map((l) => l.militar_id), ...coberturas.flatMap((t) => [t.militar_id, t.saiu_id])])];
  if (ids.length === 0) return [];
  const { rows: cadastro } = await c.query<{ id: string; matricula: string; posto: string; posto_ordem: number; nome_guerra: string; quadro: string | null }>(
    `select m.id, m.matricula, p.sigla as posto, -p.ordem as posto_ordem, m.nome_guerra, ${QUADRO_DO_MES} as quadro
       from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])`, [ids, ...referenciaDoMes(mesAtual, hoje)]);
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
      vermelhos: vermelhosDoOficial.get(id) ?? 0,
      turnos: [
        { rotulo: 'Dia' as const, quantidade: doMes.reduce((s, l) => s + (l.turnos_dia ?? 0), 0) },
        { rotulo: 'Noite' as const, quantidade: doMes.reduce((s, l) => s + (l.turnos_noite ?? 0), 0) },
      ],
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

