// O passado de uma escala com prévia lançada (fase 7.3): um turno que já começou só é alterado por gestor, coordenador ou administrador, com justificativa, e a mudança
// fica no registro (`registro_de_alteracao`). Escala sem prévia lançada naquele mês, alocação sem escala (o expediente da pré-escala) e a rodada dos oficiais ficam fora.
import { Justificativa } from 'contratos';
import type { Context } from 'hono';
import { z } from 'zod';
import { GESTAO, temPapel, type AmbienteApi } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { agoraRecife, hojeRecife } from '../datas.ts';
import { registrar } from '../registro.ts';
import { Proibida } from './alocacoes.ts';

export const MSG_SO_GESTOR = 'Este turno já começou. Só o gestor altera o passado.';
export const MSG_DIGA_O_MOTIVO = 'Diga o motivo da alteração (pelo menos 10 letras).';

/** A justificativa que faltou (ou é curta demais): 400 no campo `justificativa`. */
export class SemJustificativa extends Error {
  constructor() {
    super(MSG_DIGA_O_MOTIVO);
  }
}

/** Um turno de um dia que a mudança toca (o turno diz o serviço e o horário). */
export type Tocado = { escalaId: string | null; data: string; turnoId: string };

const minutosDe = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

type Alvo = Tocado & { escalaId: string; unidadeId: string; mes: string; inicio: string };

/** Os turnos tocados que pertencem a uma escala (a alocação sem escala não entra), sem repetir, com a unidade e o começo do turno. */
async function alvosDe(c: Consulta, tocados: Tocado[]): Promise<Alvo[]> {
  const unicos = new Map<string, Tocado & { escalaId: string }>();
  for (const t of tocados) if (t.escalaId) unicos.set(`${t.escalaId}|${t.data}|${t.turnoId}`, { ...t, escalaId: t.escalaId });
  if (!unicos.size) return [];
  const turnos = (await c.query<{ id: string; inicio: string }>("select id, to_char(inicio, 'HH24:MI') as inicio from turno where id = any($1::uuid[])", [[...new Set([...unicos.values()].map((t) => t.turnoId))]])).rows;
  const escalas = (await c.query<{ id: string; unidade_id: string }>('select id, unidade_id from escala where id = any($1::uuid[])', [[...new Set([...unicos.values()].map((t) => t.escalaId))]])).rows;
  return [...unicos.values()].flatMap((t) => {
    const turno = turnos.find((x) => x.id === t.turnoId);
    const escala = escalas.find((x) => x.id === t.escalaId);
    return turno && escala ? [{ ...t, unidadeId: escala.unidade_id, mes: t.data.slice(0, 7), inicio: turno.inicio }] : [];
  });
}

/** O turno de `data` com início `inicio` já começou em `agora`? (A hora em que ele começa já conta: o que começou há um minuto é passado.) */
export const jaComecou = (data: string, inicio: string, agora: { dia: string; minutos: number }): boolean => data < agora.dia || (data === agora.dia && minutosDe(inicio) <= agora.minutos);

/** A escala tem a prévia lançada no mês? */
async function previaDoMes(c: Consulta, escalaId: string, mes: string): Promise<boolean> {
  return (await c.query('select 1 from escala_previa where escala_id = $1 and mes = $2::date', [escalaId, `${mes}-01`])).rows.length > 0;
}

/**
 * Quais dos turnos tocados já começaram numa escala com a prévia lançada naquele mês? Nenhum: null (pode seguir sem registro). Algum: só gestor, coordenador ou administrador
 * da unidade da escala seguem (senão `Proibida`, 403), e com a justificativa de pelo menos 10 letras (senão `SemJustificativa`, 400); devolve a justificativa e TODOS os turnos tocados
 * das escalas travadas (a troca entre um turno que começou e um que não começou vale inteira, e o registro cobre os dois lados).
 */
export async function conferirPassado(
  c: Consulta, usuarioId: string, tocados: Tocado[], justificativa: string | undefined, agora = agoraRecife(),
): Promise<null | { justificativa: string; alvos: Alvo[] }> {
  const alvos = await alvosDe(c, tocados);
  const travadas = new Set<string>();
  for (const a of alvos) if (jaComecou(a.data, a.inicio, agora) && (await previaDoMes(c, a.escalaId, a.mes))) travadas.add(`${a.escalaId}|${a.mes}`);
  if (!travadas.size) return null;
  const doPassado = alvos.filter((a) => travadas.has(`${a.escalaId}|${a.mes}`));
  const hoje = hojeRecife();
  for (const unidadeId of new Set(doPassado.map((a) => a.unidadeId))) {
    if (!(await temPapel(c, usuarioId, unidadeId, GESTAO, hoje))) throw new Proibida(MSG_SO_GESTOR);
  }
  const motivo = (justificativa ?? '').trim();
  if (motivo.length < 10) throw new SemJustificativa();
  return { justificativa: motivo, alvos: doPassado };
}

type Ocupante = { militarId: string; patente: string; nomeGuerra: string; matricula: string };
type Vaga = { guarnicaoId: string | null; funcaoId: string | null; guarnicao: string | null; funcao: string | null; servico: string; letra: string; militares: Ocupante[] };
type Retrato = Map<string, { alvo: Alvo; vagas: Map<string, Vaga> }>;

/** O retrato dos turnos tocados: por turno, as vagas (guarnição e função; "sem guarnição" é a vaga nula) com quem as ocupa, acúmulos incluídos. */
async function retratar(c: Consulta, alvos: Alvo[]): Promise<Retrato> {
  const retrato: Retrato = new Map();
  for (const a of alvos) {
    const { rows } = await c.query<{
      militar_id: string; guarnicao_id: string | null; funcao_id: string | null; guarnicao: string | null; funcao: string | null; servico: string; letra: string; patente: string; nome_guerra: string; matricula: string;
    }>(
      `select * from (
         select a.militar_id, a.guarnicao_id, a.funcao_id, g.nome as guarnicao, f.nome as funcao, s.nome as servico, t.letra, p.sigla as patente, m.nome_guerra, m.matricula
           from alocacao a join turno t on t.id = a.turno_id join servico s on s.id = a.servico_id join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id
           left join guarnicao g on g.id = a.guarnicao_id left join funcao f on f.id = a.funcao_id
          where a.escala_id = $1 and a.data = $2::date and a.turno_id = $3
         union all
         select a.militar_id, x.guarnicao_id, x.funcao_id, g.nome, f.nome, s.nome, t.letra, p.sigla, m.nome_guerra, m.matricula
           from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join turno t on t.id = a.turno_id join servico s on s.id = a.servico_id
           join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id
           left join guarnicao g on g.id = x.guarnicao_id left join funcao f on f.id = x.funcao_id
          where a.escala_id = $1 and a.data = $2::date and a.turno_id = $3
       ) todos order by patente, nome_guerra`,
      [a.escalaId, a.data, a.turnoId],
    );
    const vagas = new Map<string, Vaga>();
    for (const r of rows) {
      const k = `${r.guarnicao_id}|${r.funcao_id}`;
      const v = vagas.get(k) ?? { guarnicaoId: r.guarnicao_id, funcaoId: r.funcao_id, guarnicao: r.guarnicao, funcao: r.funcao, servico: r.servico, letra: r.letra, militares: [] };
      v.militares.push({ militarId: r.militar_id, patente: r.patente, nomeGuerra: r.nome_guerra, matricula: r.matricula });
      vagas.set(k, v);
    }
    retrato.set(`${a.escalaId}|${a.data}|${a.turnoId}`, { alvo: a, vagas });
  }
  return retrato;
}

/** Uma linha do registro por vaga cujos ocupantes mudaram: o que a vaga tinha, o que tem agora, com a guarnição, a função, o dia e a hora. */
async function registrarDiferencas(tx: Consulta, usuarioId: string, justificativa: string, antes: Retrato, depois: Retrato): Promise<void> {
  for (const [chave, { alvo, vagas: depoisDoTurno }] of depois) {
    const antesDoTurno = antes.get(chave)?.vagas ?? new Map<string, Vaga>();
    const chaves = new Set([...antesDoTurno.keys(), ...depoisDoTurno.keys()]);
    for (const k of chaves) {
      const a = antesDoTurno.get(k);
      const d = depoisDoTurno.get(k);
      const idsAntes = new Set((a?.militares ?? []).map((m) => m.militarId));
      const idsDepois = new Set((d?.militares ?? []).map((m) => m.militarId));
      if (idsAntes.size === idsDepois.size && [...idsAntes].every((m) => idsDepois.has(m))) continue;
      const base = (d ?? a)!;
      const retratoDaVaga = (v: Vaga | undefined) => ({
        data: alvo.data, inicio: alvo.inicio, servico: base.servico, turno: base.letra, guarnicao: base.guarnicao, funcao: base.funcao,
        militares: (v?.militares ?? []).map((m) => ({ patente: m.patente, nomeGuerra: m.nomeGuerra, matricula: m.matricula })),
      });
      await registrar(tx, {
        usuarioId, unidadeId: alvo.unidadeId, tipo: 'escala_no_passado', escalaId: alvo.escalaId, mes: alvo.mes, data: alvo.data, antes: retratoDaVaga(a), depois: retratoDaVaga(d), justificativa,
      });
    }
  }
}

/**
 * Faz `fazer` (as mudanças, na transação `tx`) conferindo a trava do passado antes e gravando o registro depois. `tocar` diz os turnos que a mudança toca (um turno da lista é lido
 * antes da mudança, quando a alocação ainda existe). Sem trava a aplicar, só chama `fazer`.
 */
export async function comPassado<T>(
  tx: Consulta, usuarioId: string, tocar: Tocado[] | ((tx: Consulta) => Promise<Tocado[]>), justificativa: string | undefined, fazer: () => Promise<T>, agora = agoraRecife(),
): Promise<T> {
  const lista = typeof tocar === 'function' ? await tocar(tx) : tocar;
  const trava = await conferirPassado(tx, usuarioId, lista, justificativa, agora);
  if (!trava) return fazer();
  const antes = await retratar(tx, trava.alvos);
  const resultado = await fazer();
  await registrarDiferencas(tx, usuarioId, trava.justificativa, antes, await retratar(tx, trava.alvos));
  return resultado;
}

/** O turno da alocação (escala, dia e turno), ou nada se ela já não existe. */
export async function tocadoDaAlocacao(c: Consulta, alocacaoId: string): Promise<Tocado[]> {
  const { rows } = await c.query<{ escala_id: string | null; data: string; turno_id: string }>("select escala_id, to_char(data, 'YYYY-MM-DD') as data, turno_id from alocacao where id = $1", [alocacaoId]);
  return rows.map((r) => ({ escalaId: r.escala_id, data: r.data, turnoId: r.turno_id }));
}

/** O turno de uma remoção (escala, dia e turno), ou nada se ela já não existe. */
export async function tocadoDaRemocao(c: Consulta, remocaoId: string): Promise<Tocado[]> {
  const { rows } = await c.query<{ escala_id: string | null; data: string; turno_id: string }>("select escala_id, to_char(data, 'YYYY-MM-DD') as data, turno_id from remocao where id = $1", [remocaoId]);
  return rows.map((r) => ({ escalaId: r.escala_id, data: r.data, turnoId: r.turno_id }));
}

/** O turno do acúmulo (o da alocação dele). */
export async function tocadoDoAcumulo(c: Consulta, acumuloId: string): Promise<Tocado[]> {
  const { rows } = await c.query<{ escala_id: string | null; data: string; turno_id: string }>(
    "select a.escala_id, to_char(a.data, 'YYYY-MM-DD') as data, a.turno_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id where x.id = $1", [acumuloId],
  );
  return rows.map((r) => ({ escalaId: r.escala_id, data: r.data, turnoId: r.turno_id }));
}

/** A pré-escala (em lote) numa escala com a prévia lançada só preenche os turnos que ainda não começaram, sem registro; os lançamentos sem escala (o expediente) passam. */
export async function semOsQueJaComecaram<T extends { escalaId?: string | null; data: string; turnoId: string }>(c: Consulta, escalaId: string, mes: string, novas: T[], agora = agoraRecife()): Promise<T[]> {
  if (!(await previaDoMes(c, escalaId, mes))) return novas;
  const turnos = new Map((await c.query<{ id: string; inicio: string }>("select id, to_char(inicio, 'HH24:MI') as inicio from turno where id = any($1::uuid[])", [[...new Set(novas.map((n) => n.turnoId))]])).rows.map((t) => [t.id, t.inicio]));
  return novas.filter((n) => n.escalaId === null || !jaComecou(n.data, turnos.get(n.turnoId) ?? '00:00', agora));
}

/** A resposta para a trava do passado (403 se não é gestor; 400 no campo da justificativa); null se o erro é outro. */
export function respostaDoPassado(c: Context<AmbienteApi>, e: unknown): Response | null {
  if (e instanceof Proibida) return c.json({ erro: e.message }, 403);
  if (e instanceof SemJustificativa) return c.json({ erro: e.message, campos: { justificativa: e.message } }, 400);
  return null;
}

/** A justificativa do corpo das rotas que não têm corpo de dados (os DELETE e os POST de desfazer): opcional, e ignorada se o corpo não vier. */
export async function justificativaDoCorpo(c: Context<AmbienteApi>): Promise<string | undefined> {
  try {
    const r = z.object({ justificativa: Justificativa }).safeParse(await c.req.json());
    return r.success ? r.data.justificativa : undefined;
  } catch {
    return undefined;
  }
}
