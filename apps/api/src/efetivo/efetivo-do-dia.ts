// Efetivo do dia: as guarnições da meta do dia (na ordem de ativação) e as que têm gente alocada fora da meta, com quem está em cada
// uma, se ela fechou em todo o horário em que está vinculada e o que falta. Mais as cotas restantes do mês.
import type { CotaRestante, EfetivoDoDia, FaltaNoEfetivo, GuarnicaoNoEfetivo, MilitarNoEfetivo } from 'contratos';
import { avaliarAtivacao, intervaloDoTurno, unirIntervalos, type Intervalo, type Ocupacao } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { cotasDoMes } from '../cadastros/cotas.ts';
import { metaDoDia } from './meta.ts';

type Entrada = MilitarNoEfetivo & { guarnicaoId: string; intervalo: Intervalo };
type VinculoNoDia = { escalaId: string; intervalo: Intervalo };

const ALFABETICA = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Minutos desde as 00h do dia de início de volta ao relógio ("HH:MM"): 1920 (08h do dia seguinte) vira 08:00 e 1440 vira 00:00. */
function horaDoRelogio(minutos: number): string {
  const m = minutos % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Os vínculos de cada guarnição no dia: nas escalas ativas da seção, pela versão de vínculos vigente no mês, com as escalas por nome. */
async function vinculosDoDia(c: Consulta, unidadeId: string, mes: string): Promise<Map<string, VinculoNoDia[]>> {
  const escalas = (await c.query<{ id: string; nome: string }>('select id, nome from escala where unidade_id = $1 and ativa', [unidadeId])).rows.sort((a, b) => ALFABETICA(a.nome, b.nome));
  const porGuarnicao = new Map<string, VinculoNoDia[]>();
  for (const e of escalas) {
    const vigente = (await vinculosDaEscala(c, e.id)).find((v) => v.vigencia <= mes);
    for (const it of vigente?.itens ?? []) {
      porGuarnicao.set(it.guarnicaoId, [...(porGuarnicao.get(it.guarnicaoId) ?? []), { escalaId: e.id, intervalo: intervaloDoTurno(it.inicio, it.fim) }]);
    }
  }
  return porGuarnicao;
}

/** Quem está nas guarnições no dia: as alocações com data no dia (em qualquer escala da seção) e os acúmulos delas, no horário do turno. */
async function entradasDoDia(c: Consulta, unidadeId: string, data: string): Promise<Omit<Entrada, 'funcao'>[]> {
  const alocacoes = (
    await c.query<{
      id: string; militar_id: string; guarnicao_id: string; funcao_id: string; inicio: string; fim: string;
      servico_id: string; servico: string; cor: string; nome_guerra: string; posto: string;
    }>(
      `select a.id, a.militar_id, a.guarnicao_id, a.funcao_id, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim,
              s.id as servico_id, s.nome as servico, s.cor, m.nome_guerra, p.sigla as posto
         from alocacao a
         join escala e on e.id = a.escala_id
         join turno t on t.id = a.turno_id
         join servico s on s.id = a.servico_id
         join militar m on m.id = a.militar_id
         join posto_grad p on p.id = m.posto_grad_id
        where e.unidade_id = $1 and a.data = $2::date and a.guarnicao_id is not null and a.funcao_id is not null`,
      [unidadeId, data],
    )
  ).rows;
  if (!alocacoes.length) return [];
  const acumulos = (
    await c.query<{ alocacao_id: string; guarnicao_id: string; funcao_id: string }>(
      'select alocacao_id, guarnicao_id, funcao_id from alocacao_acumulo where alocacao_id = any($1::uuid[])',
      [alocacoes.map((a) => a.id)],
    )
  ).rows;
  const entrada = (a: (typeof alocacoes)[number], guarnicaoId: string, funcaoId: string, acumulo: boolean) => ({
    guarnicaoId, funcaoId, acumulo, militarId: a.militar_id, posto: a.posto, nomeGuerra: a.nome_guerra, inicio: a.inicio, fim: a.fim,
    servico: { id: a.servico_id, nome: a.servico, cor: a.cor }, intervalo: intervaloDoTurno(a.inicio, a.fim),
  });
  return [
    ...alocacoes.map((a) => entrada(a, a.guarnicao_id, a.funcao_id, false)),
    ...acumulos.map((x) => entrada(alocacoes.find((a) => a.id === x.alocacao_id)!, x.guarnicao_id, x.funcao_id, true)),
  ];
}

/** Soma, por serviço, as cotas do mês (interna e externa) e as alocações já distribuídas nelas, na ordem de prioridade. */
async function cotasRestantes(c: Consulta, unidadeId: string, mes: string): Promise<CotaRestante[]> {
  const porServico = new Map<string, CotaRestante>();
  for (const cota of await cotasDoMes(c, unidadeId, mes)) {
    const atual = porServico.get(cota.servicoId) ?? { servicoId: cota.servicoId, servico: cota.servico, cor: cota.cor, quantidade: 0, usadas: 0 };
    atual.quantidade += cota.quantidade;
    atual.usadas += cota.distribuidas;
    porServico.set(cota.servicoId, atual);
  }
  return [...porServico.values()];
}

export async function montarEfetivoDoDia(c: Consulta, unidadeId: string, data: string): Promise<EfetivoDoDia> {
  const mes = data.slice(0, 7);
  const meta = await metaDoDia(c, unidadeId, data);
  const entradas = await entradasDoDia(c, unidadeId, data);
  const vinculos = await vinculosDoDia(c, unidadeId, mes);

  // as guarnições do painel: as da meta, na ordem de ativação, e depois as de fora da meta que têm gente no dia, pelo nome
  const naMeta = meta.guarnicoes.map((g) => g.guarnicaoId);
  const foraDaMeta = [...new Set(entradas.map((e) => e.guarnicaoId))].filter((id) => !naMeta.includes(id));
  const todas = [...naMeta, ...foraDaMeta];
  if (!todas.length) return { data, meta: { origem: meta.origem, total: 0, ativadas: 0 }, guarnicoes: [], cotas: await cotasRestantes(c, unidadeId, mes) };

  const nomes = new Map((await c.query<{ id: string; nome: string }>('select id, nome from guarnicao where id = any($1::uuid[])', [todas])).rows.map((g) => [g.id, g.nome]));
  const funcoes = new Map(
    (await c.query<{ id: string; nome: string }>('select id, nome from funcao where id = any($1::uuid[])', [[...new Set(entradas.map((e) => e.funcaoId))]])).rows.map((f) => [f.id, f.nome]),
  );
  const versoes = await versoesDasGuarnicoes(c, todas);

  const montar = (guarnicaoId: string, ordem: number | null): GuarnicaoNoEfetivo => {
    const versao = versaoNoMes(versoes.get(guarnicaoId) ?? [], mes);
    // modelo desativado (ou ainda sem versão no mês) não tem horário no dia: aparece como "não ativada", sem faltas
    const composicao = versao?.composicao ?? [];
    const horarios = versao?.ativa ? (vinculos.get(guarnicaoId) ?? []) : [];
    const dela = entradas.filter((e) => e.guarnicaoId === guarnicaoId);
    const ocupacoes: Ocupacao[] = dela.map((e) => ({ ...e.intervalo, funcaoId: e.funcaoId }));
    const { ativada, faltas } = avaliarAtivacao(horarios.map((h) => h.intervalo), composicao.map((f) => ({ funcaoId: f.funcaoId, funcao: f.funcao, minimo: f.minimo })), ocupacoes);
    const posicaoDaFuncao = (funcaoId: string) => {
      const i = composicao.findIndex((f) => f.funcaoId === funcaoId);
      return i < 0 ? composicao.length : i;
    };
    const militares: MilitarNoEfetivo[] = [...dela]
      .sort((a, b) => posicaoDaFuncao(a.funcaoId) - posicaoDaFuncao(b.funcaoId) || a.intervalo.inicio - b.intervalo.inicio || ALFABETICA(a.nomeGuerra, b.nomeGuerra))
      .map(({ guarnicaoId: _g, intervalo: _i, ...m }) => ({ ...m, funcao: composicao.find((f) => f.funcaoId === m.funcaoId)?.funcao ?? funcoes.get(m.funcaoId) ?? '' }));
    const faltasNoPainel: FaltaNoEfetivo[] = faltas.map((f) => ({
      funcao: f.funcao,
      faltam: f.faltam,
      inicio: horaDoRelogio(f.inicio),
      fim: horaDoRelogio(f.fim),
      // as escalas já vêm por nome: vale a primeira cujo vínculo se sobrepõe ao buraco
      escalaId: horarios.find((h) => h.intervalo.inicio < f.fim && f.inicio < h.intervalo.fim)?.escalaId ?? null,
    }));
    return {
      guarnicaoId,
      nome: nomes.get(guarnicaoId) ?? '',
      viatura: versao?.viatura ?? null,
      ordem,
      ativada,
      horarios: unirIntervalos(horarios.map((h) => h.intervalo)).map((i) => ({ inicio: horaDoRelogio(i.inicio), fim: horaDoRelogio(i.fim) })),
      faltas: faltasNoPainel,
      militares,
    };
  };

  const guarnicoes = [
    ...naMeta.map((id, i) => montar(id, i + 1)),
    ...foraDaMeta.sort((a, b) => ALFABETICA(nomes.get(a) ?? '', nomes.get(b) ?? '')).map((id) => montar(id, null)),
  ];
  return {
    data,
    meta: { origem: meta.origem, total: naMeta.length, ativadas: guarnicoes.filter((g) => g.ordem !== null && g.ativada).length },
    guarnicoes,
    cotas: await cotasRestantes(c, unidadeId, mes),
  };
}
