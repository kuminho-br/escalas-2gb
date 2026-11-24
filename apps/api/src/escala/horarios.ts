// Os horários dos turnos da seção, na forma que o motor de choques recebe (chave "serviço|letra"), e o tipo de cada serviço.
// Usado pela lista "Escolher militar" (elegibilidade) e pela Grade geral.
import { montarHorarios, type Horarios } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

export type Tipo = 'ordinario' | 'pjes' | 'diaria';
export const NOME_DO_TIPO: Record<Tipo, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };
/** Expediente do Adm (08h às 16h), implícito nos dias úteis; vale o turno A do serviço Expediente se a seção o tiver cadastrado. */
export const EXPEDIENTE = { servico: 'Expediente', turno: 'A', ini: 480, fim: 960 };

export type HorariosDeChoque = {
  horarios: Horarios;
  /** o tipo de cada serviço pelo nome ("Ordinário", "PJES", "Diária") */
  tipos: Record<string, string>;
  /** os nomes dos serviços cadastrados com "Pode tirar o militar do Adm do expediente" (a regra nova do `detectarChoques`) */
  tiramDoExpediente: string[];
};

/** Os horários de todos os turnos dos serviços da seção (mais o expediente), o tipo de cada serviço pelo nome e quais deles tiram o militar do expediente. */
export async function horariosDaUnidade(c: Consulta, unidadeId: string): Promise<HorariosDeChoque> {
  const doUnidade = (
    await c.query<{ nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string; tira_do_expediente: boolean }>(
      `select s.nome, s.tipo, s.tira_do_expediente, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from turno t join servico s on s.id = t.servico_id where s.unidade_id = $1`,
      [unidadeId],
    )
  ).rows;
  const horarios = montarHorarios(doUnidade.map((t) => ({ servico: t.nome, turno: t.letra, inicio: t.inicio, fim: t.fim }))).porChave;
  horarios[`${EXPEDIENTE.servico}|${EXPEDIENTE.turno}`] ??= { ini: EXPEDIENTE.ini, fim: EXPEDIENTE.fim, dur: EXPEDIENTE.fim - EXPEDIENTE.ini };
  const tipos = Object.fromEntries(doUnidade.map((t) => [t.nome, NOME_DO_TIPO[t.tipo]]));
  const tiramDoExpediente = [...new Set(doUnidade.filter((t) => t.tira_do_expediente).map((t) => t.nome))];
  return { horarios, tipos, tiramDoExpediente };
}

/**
 * Uma alocação do militar em qualquer unidade (6.37: o choque olha todas). `servico` é o nome do serviço e, quando ele é de outra unidade (`outra`), leva a sigla
 * dela: "JES (2ª SB)" (dois serviços de unidades diferentes podem ter o mesmo nome e horários diferentes).
 */
export type AlocacaoDaJanela = {
  id: string; militarId: string; data: string; servico: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string; tira: boolean; outra: boolean;
  /** para dizer onde o militar está (6.38): o nome do serviço sem a sigla, a escala e a unidade */
  servicoNome: string; escalaId: string | null; escala: string; distribuicao: string; unidadeId: string; unidadeSigla: string;
};

/** As alocações dos militares entre `de` e `ate` em serviços de qualquer unidade (a da seção `unidadeId` e as outras), numa consulta só. */
export async function alocacoesDaJanela(c: Consulta, ids: string[], de: string, ate: string, unidadeId: string): Promise<AlocacaoDaJanela[]> {
  if (!ids.length) return [];
  const { rows } = await c.query<{
    id: string; militar_id: string; data: string; nome: string; sigla: string; outra: boolean; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string; tira: boolean;
    escala_id: string | null; escala: string; distribuicao: string; unidade_id: string;
  }>(
    `select a.id, a.militar_id, to_char(a.data, 'YYYY-MM-DD') as data, s.nome, un.sigla, s.unidade_id <> $4 as outra, s.tipo, s.tira_do_expediente as tira, t.letra,
            to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, e.id as escala_id, coalesce(e.nome, '') as escala, coalesce(e.distribuicao, '') as distribuicao, s.unidade_id
       from alocacao a join servico s on s.id = a.servico_id join unidade un on un.id = s.unidade_id join turno t on t.id = a.turno_id left join escala e on e.id = a.escala_id
      where a.militar_id = any($1::uuid[]) and a.data between $2::date and $3::date`,
    [ids, de, ate, unidadeId],
  );
  return rows.map((r) => ({
    id: r.id, militarId: r.militar_id, data: r.data, servico: r.outra ? `${r.nome} (${r.sigla})` : r.nome, tipo: r.tipo, letra: r.letra, inicio: r.inicio, fim: r.fim, tira: r.tira, outra: r.outra,
    servicoNome: r.nome, escalaId: r.escala_id, escala: r.escala, distribuicao: r.distribuicao, unidadeId: r.unidade_id, unidadeSigla: r.sigla,
  }));
}

/** Junta ao que a unidade já sabe os horários, os tipos e a opção dos serviços das outras unidades da lista (os da unidade valem primeiro). */
export function somarOutrasUnidades(base: HorariosDeChoque, outras: AlocacaoDaJanela[]): void {
  outras = outras.filter((a) => a.outra);
  for (const [k, h] of Object.entries(montarHorarios(outras.map((a) => ({ servico: a.servico, turno: a.letra, inicio: a.inicio, fim: a.fim }))).porChave)) base.horarios[k] ??= h;
  for (const a of outras) {
    base.tipos[a.servico] ??= NOME_DO_TIPO[a.tipo];
    if (a.tira && !base.tiramDoExpediente.includes(a.servico)) base.tiramDoExpediente.push(a.servico);
  }
}
