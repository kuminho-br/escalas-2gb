// Leitura da escala do mês: dia > faixa de horário > cards de guarnição > função > ocupantes (RN da tela "Escala do mês").
import {
  mesParaData,
  type CardDaGuarnicao,
  type DiaDaEscala,
  type EscalaDoMes,
  type FaixaDoDia,
  type FuncaoNoCard,
  type OcupanteDaVaga,
} from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { GESTAO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { cotasDeSaldo } from './cota-de-saldo.ts';
import { ordemDoMes } from './ordem-do-mes.ts';
import { estadoDoMes } from './estado.ts';
import { sequenciaDePreenchimento } from './ordem.ts';
import { nomeDaVaga } from './vagas.ts';

type TurnoDaEscala = { id: string; servicoId: string; servico: string; cor: string; letra: 'A' | 'B' | 'C'; inicio: string; fim: string };
type AlocacaoDoMes = OcupanteDaVaga & { data: string; turnoId: string; guarnicaoId: string | null; funcaoId: string | null };
type RemocaoDoMes = { remocaoId: string; militarId: string; nomeGuerra: string; servico: string; data: string; turnoId: string };

const chaveDaFaixa = (inicio: string, fim: string) => `${inicio}|${fim}`;
/** Atravessa a meia-noite (o fim é antes ou igual ao início) ou começa às 18h ou depois. */
const ehNoturna = (inicio: string, fim: string) => fim <= inicio || inicio >= '18:00';

function frasesDoQueFalta(funcoes: FuncaoNoCard[]): string[] {
  return funcoes.flatMap((f) => {
    const falta = f.minimo - f.ocupantes.length;
    if (falta <= 0) return [];
    return [`${falta === 1 ? 'Falta 1' : `Faltam ${falta}`} ${f.funcao}${f.cnhExigida ? ` (CNH ${f.cnhExigida})` : ''}`];
  });
}

/** `usuarioId`: quem pede (para `podeAlterarPassado`); sem ele, falso. */
export async function montarEscalaDoMes(c: Consulta, escalaId: string, mes: string, usuarioId?: string): Promise<EscalaDoMes> {
  const escala = (await c.query<{ id: string; nome: string; unidade_id: string }>('select id, nome, unidade_id from escala where id = $1', [escalaId])).rows[0]!;
  const servicos = (
    await c.query<{ id: string; nome: string; cor: string }>(
      'select s.id, s.nome, s.cor from escala_servico es join servico s on s.id = es.servico_id where es.escala_id = $1 order by es.ordem',
      [escalaId],
    )
  ).rows;
  const turnos: TurnoDaEscala[] = servicos.length
    ? (
        await c.query<{ id: string; servico_id: string; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
          `select id, servico_id, letra, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where servico_id = any($1)`,
          [servicos.map((s) => s.id)],
        )
      ).rows.map((t) => {
        const s = servicos.find((x) => x.id === t.servico_id)!;
        return { id: t.id, servicoId: s.id, servico: s.nome, cor: s.cor, letra: t.letra, inicio: t.inicio, fim: t.fim };
      })
    : [];

  // faixas: horários distintos dos turnos, em ordem de início e depois de fim; turnos na ordem dos serviços da escala
  const ordemDoServico = new Map(servicos.map((s, i) => [s.id, i]));
  const turnosPorFaixa = new Map<string, TurnoDaEscala[]>();
  for (const t of [...turnos].sort((a, b) => ordemDoServico.get(a.servicoId)! - ordemDoServico.get(b.servicoId)! || a.letra.localeCompare(b.letra))) {
    const k = chaveDaFaixa(t.inicio, t.fim);
    turnosPorFaixa.set(k, [...(turnosPorFaixa.get(k) ?? []), t]);
  }
  const faixas = [...turnosPorFaixa.entries()]
    .map(([k, ts]) => ({ k, inicio: ts[0]!.inicio, fim: ts[0]!.fim, ts }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));
  const faixaDoTurno = new Map(turnos.map((t) => [t.id, chaveDaFaixa(t.inicio, t.fim)]));

  // vínculo vigente no mês (a maior vigência até ele) e a versão de cada guarnição no mês
  const vinculo = (await vinculosDaEscala(c, escalaId)).find((v) => v.vigencia <= mes);
  const versoes = await versoesDasGuarnicoes(c, [...new Set((vinculo?.itens ?? []).map((i) => i.guarnicaoId))]);
  const modeloPorFaixa = new Map<string, { guarnicaoId: string; nome: string; viatura: string | null; prioridade: number | null; composicao: { funcaoId: string; funcao: string; minimo: number; maximo: number; cnhExigida: string | null }[] }[]>();
  for (const it of vinculo?.itens ?? []) {
    const v = versaoNoMes(versoes.get(it.guarnicaoId) ?? [], mes);
    if (!v?.ativa) continue;
    const k = chaveDaFaixa(it.inicio, it.fim);
    modeloPorFaixa.set(k, [...(modeloPorFaixa.get(k) ?? []), { guarnicaoId: it.guarnicaoId, nome: it.guarnicao, viatura: v.viatura, prioridade: v.prioridade, composicao: v.composicao }]);
  }
  // os cards seguem a ordem de escalação: a guarnição vale pela primeira vez das vagas dela (sem ordem cadastrada: prioridade e nome, como sempre)
  const vezDaGuarnicao = new Map<string, number>();
  sequenciaDePreenchimento((await ordemDoMes(c, escalaId, mes)).vagas).forEach((v, i) => {
    if (!vezDaGuarnicao.has(v.guarnicaoId)) vezDaGuarnicao.set(v.guarnicaoId, i);
  });
  const ultima = Number.MAX_SAFE_INTEGER;
  for (const lista of modeloPorFaixa.values()) {
    lista.sort((a, b) => (vezDaGuarnicao.get(a.guarnicaoId) ?? ultima) - (vezDaGuarnicao.get(b.guarnicaoId) ?? ultima) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  const inicioDoMes = mesParaData(mes);
  const alocacoes = (
    await c.query<{
      id: string; militar_id: string; data: string; turno_id: string; guarnicao_id: string | null; funcao_id: string | null;
      nome_guerra: string; matricula: string; posto: string;
    }>(
      `select a.id, a.militar_id, to_char(a.data, 'YYYY-MM-DD') as data, a.turno_id, a.guarnicao_id, a.funcao_id,
              m.nome_guerra, m.matricula, p.sigla as posto
         from alocacao a join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id
        where a.escala_id = $1 and a.data >= $2::date and a.data < ($2::date + interval '1 month')`,
      [escalaId, inicioDoMes],
    )
  ).rows.flatMap((a): AlocacaoDoMes[] => {
    const t = turnos.find((x) => x.id === a.turno_id);
    if (!t) return [];
    return [{
      alocacaoId: a.id, acumuloId: null, acumulaCom: [], militarId: a.militar_id, posto: a.posto, nomeGuerra: a.nome_guerra, matricula: a.matricula,
      servico: { id: t.servicoId, nome: t.servico, cor: t.cor }, letra: t.letra, data: a.data, turnoId: a.turno_id, guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id,
    }];
  });
  // acúmulos: cada um vira mais um ocupante (na vaga acumulada) do mesmo militar e da mesma alocação
  const acumulos = alocacoes.length
    ? (
        await c.query<{ id: string; alocacao_id: string; guarnicao_id: string; funcao_id: string }>(
          'select id, alocacao_id, guarnicao_id, funcao_id from alocacao_acumulo where alocacao_id = any($1)',
          [alocacoes.map((a) => a.alocacaoId)],
        )
      ).rows
    : [];
  const modeloDaGuarnicao = new Map([...modeloPorFaixa.values()].flat().map((g) => [g.guarnicaoId, g]));
  // posição de uma vaga na faixa: guarnições na ordem dos cards, funções na ordem da composição (só vale o que aparece num card dessa faixa)
  const posicaoNaFaixa = (k: string, guarnicaoId: string | null, funcaoId: string | null): number | null => {
    const modelos = modeloPorFaixa.get(k) ?? [];
    const gi = modelos.findIndex((g) => g.guarnicaoId === guarnicaoId);
    const fi = gi < 0 ? -1 : modelos[gi]!.composicao.findIndex((f) => f.funcaoId === funcaoId);
    return gi < 0 || fi < 0 ? null : gi * 1000 + fi;
  };
  const nomeDaVagaNaFaixa = (k: string, guarnicaoId: string, funcaoId: string): string => {
    const m = (modeloPorFaixa.get(k) ?? []).find((g) => g.guarnicaoId === guarnicaoId)!;
    return nomeDaVaga(m.nome, m.composicao.find((f) => f.funcaoId === funcaoId)!.funcao, m.composicao.length);
  };
  const ocupantes: AlocacaoDoMes[] = alocacoes.flatMap((a) => {
    const k = faixaDoTurno.get(a.turnoId)!;
    const vagas = [
      { acumuloId: null as string | null, guarnicaoId: a.guarnicaoId, funcaoId: a.funcaoId },
      ...acumulos.filter((x) => x.alocacao_id === a.alocacaoId).flatMap((x) => (posicaoNaFaixa(k, x.guarnicao_id, x.funcao_id) === null ? [] : [{ acumuloId: x.id, guarnicaoId: x.guarnicao_id as string | null, funcaoId: x.funcao_id as string | null }])),
    ];
    // as vagas do militar na faixa que aparecem num card, na ordem dos cards: "acumula com" lista as outras
    const comCard = vagas.flatMap((v) => {
      const pos = posicaoNaFaixa(k, v.guarnicaoId, v.funcaoId);
      return pos === null ? [] : [{ ...v, pos, nome: nomeDaVagaNaFaixa(k, v.guarnicaoId!, v.funcaoId!) }];
    }).sort((x, y) => x.pos - y.pos);
    return vagas.map((v) => ({
      ...a,
      acumuloId: v.acumuloId,
      guarnicaoId: v.guarnicaoId,
      funcaoId: v.funcaoId,
      acumulaCom: comCard.filter((o) => o.acumuloId !== v.acumuloId).map((o) => o.nome),
    }));
  });
  // a cota de saldo à vista (6.38): o ocupante de Saldo do Adm traz o "2/6" para a placa
  const doSaldo = ocupantes.filter((o) => o.servico.nome.trim().toLowerCase() === 'saldo');
  if (doSaldo.length) {
    const cotas = await cotasDeSaldo(c, escala.unidade_id, doSaldo.map((o) => o.militarId), mes);
    for (const o of doSaldo) o.saldos = cotas.get(o.militarId)!;
  }
  const remocoes: RemocaoDoMes[] = (
    await c.query<{ id: string; militar_id: string; nome_guerra: string; servico: string; data: string; turno_id: string }>(
      `select r.id, r.militar_id, m.nome_guerra, s.nome as servico, to_char(r.data, 'YYYY-MM-DD') as data, r.turno_id
         from remocao r join militar m on m.id = r.militar_id join servico s on s.id = r.servico_id
        where r.escala_id = $1 and r.data >= $2::date and r.data < ($2::date + interval '1 month') order by m.nome_guerra`,
      [escalaId, inicioDoMes],
    )
  ).rows.map((r) => ({ remocaoId: r.id, militarId: r.militar_id, nomeGuerra: r.nome_guerra, servico: r.servico, data: r.data, turnoId: r.turno_id }));
  const feriados = new Map<string, string>();
  for (const f of await feriadosDoAno(c, escala.unidade_id, Number(mes.slice(0, 4)))) if (!feriados.has(f.data)) feriados.set(f.data, f.descricao);

  let obrigatorias = 0;
  let preenchidas = 0;
  let obrigatoriasVazias = 0;
  const dias: DiaDaEscala[] = diasDoMes(mes).map((data) => {
    let vaziasDoDia = 0;
    const doDia = ocupantes.filter((a) => a.data === data);
    const faixasDoDia: FaixaDoDia[] = faixas.map((f) => {
      const daFaixa = doDia.filter((a) => faixaDoTurno.get(a.turnoId) === f.k);
      const guarnicoes: CardDaGuarnicao[] = (modeloPorFaixa.get(f.k) ?? []).map((g) => {
        const funcoes: FuncaoNoCard[] = g.composicao.map((fn) => ({
          funcaoId: fn.funcaoId, funcao: fn.funcao, minimo: fn.minimo, maximo: fn.maximo, cnhExigida: fn.cnhExigida as FuncaoNoCard['cnhExigida'],
          ocupantes: daFaixa.filter((a) => a.guarnicaoId === g.guarnicaoId && a.funcaoId === fn.funcaoId).map(({ data: _d, turnoId: _t, guarnicaoId: _g, funcaoId: _f, ...o }) => o),
        }));
        for (const fn of funcoes) {
          obrigatorias += fn.minimo;
          preenchidas += Math.min(fn.ocupantes.length, fn.maximo);
          vaziasDoDia += Math.max(0, fn.minimo - fn.ocupantes.length);
        }
        const faltam = frasesDoQueFalta(funcoes);
        return { guarnicaoId: g.guarnicaoId, nome: g.nome, viatura: g.viatura, prioridade: g.prioridade, funcoes, completa: faltam.length === 0, faltam };
      });
      // quem está na faixa sem vaga num card (sem guarnição, ou guarnição que já não aparece aqui) fica em "sem posto"
      const noCard = new Set(guarnicoes.flatMap((g) => g.funcoes.flatMap((fn) => fn.ocupantes.map((o) => `${o.alocacaoId}|${o.acumuloId}`))));
      return {
        inicio: f.inicio,
        fim: f.fim,
        noturna: ehNoturna(f.inicio, f.fim),
        turnos: f.ts.map((t) => ({ turnoId: t.id, servicoId: t.servicoId, servico: t.servico, cor: t.cor, letra: t.letra })),
        guarnicoes,
        semPosto: daFaixa.filter((a) => a.acumuloId === null && !noCard.has(`${a.alocacaoId}|${a.acumuloId}`)).map(({ data: _d, turnoId: _t, guarnicaoId: _g, funcaoId: _f, ...o }) => o),
        removidos: remocoes.filter((r) => r.data === data && faixaDoTurno.get(r.turnoId) === f.k).map((r) => ({ remocaoId: r.remocaoId, militarId: r.militarId, nomeGuerra: r.nomeGuerra, servico: r.servico })),
      };
    });
    obrigatoriasVazias += vaziasDoDia;
    return { data, diaDaSemana: diaDaSemana(data), feriado: feriados.get(data) ?? null, faixas: faixasDoDia, obrigatoriasVazias: vaziasDoDia };
  });
  const estado = await estadoDoMes(c, escalaId, mes);
  // quem pede é do nível de gestão da unidade: publica, republica e altera o passado
  const ehGestor = usuarioId ? await temPapel(c, usuarioId, escala.unidade_id, GESTAO, hojeRecife()) : false;
  return {
    escalaId, nome: escala.nome, mes, dias, resumo: { preenchidas, obrigatorias, obrigatoriasVazias },
    estado,
    podePublicar: ehGestor,
    podeAlterarPassado: ehGestor,
  };
}
