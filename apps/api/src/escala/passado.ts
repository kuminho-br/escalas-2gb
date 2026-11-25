// O passado de uma escala que não é rascunho (fases 7.3 e 7.3.1): um turno que já começou só é alterado por gestor, coordenador ou administrador, com justificativa, e a mudança
// fica no registro (`registro_de_alteracao`); numa escala remessada, qualquer turno só o administrador altera. Escala em rascunho (sem linha em `escala_estado`), alocação sem escala
// (o expediente da pré-escala) e a rodada dos oficiais ficam fora. A mudança numa escala publicada ou retificada também a põe em retificação, na mesma transação.
import { Justificativa } from 'contratos';
import type { Context } from 'hono';
import { z } from 'zod';
import { ehAdministrador, GESTAO, temPapel, type AmbienteApi } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { agoraRecife, hojeRecife } from '../datas.ts';
import { registrar } from '../registro.ts';
import { Proibida, Recusa } from './alocacoes.ts';
import { estadoDoMes, marcarRetificacao, MSG_JA_REMESSADA } from './estado.ts';

export const MSG_SO_GESTOR = 'Este turno já começou. Só o gestor altera o passado.';
export const MSG_DIGA_O_MOTIVO = 'Diga o motivo da alteração (pelo menos 10 letras).';
export const MSG_SO_ADMINISTRADOR = 'Esta escala já foi remessada. Só o administrador altera.';

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

/** Uma escala e mês que a mudança deixa em retificação (a escala está publicada ou retificada). */
export type Retificar = { escalaId: string; mes: string };

/**
 * A trava do passado, por escala e mês tocados, conforme o estado: em **rascunho** nada trava nem se registra; em **prévia, publicada e retificada**, o turno que já começou só passa
 * gestor, coordenador ou administrador da unidade (senão `Proibida`, 403), com justificativa de pelo menos 10 letras (senão `SemJustificativa`, 400); em **remessada**, qualquer turno,
 * passado ou futuro, só passa o administrador (`Proibida`), também com justificativa. Devolve a justificativa e TODOS os turnos tocados das escalas travadas (a troca entre um turno que
 * começou e um que não começou vale inteira, e o registro cobre os dois lados) e quais escalas a mudança põe em retificação (as tocadas que estão publicadas ou retificadas).
 */
export async function conferirPassado(
  c: Consulta, usuarioId: string, tocados: Tocado[], justificativa: string | undefined, agora = agoraRecife(),
): Promise<{ registro: null | { justificativa: string; alvos: Alvo[] }; retificar: Retificar[] }> {
  const alvos = await alvosDe(c, tocados);
  const estados = new Map<string, Awaited<ReturnType<typeof estadoDoMes>>['estado']>();
  for (const a of alvos) {
    const k = `${a.escalaId}|${a.mes}`;
    if (!estados.has(k)) estados.set(k, (await estadoDoMes(c, a.escalaId, a.mes)).estado);
  }
  const travadas = new Set<string>();
  let remessada = false;
  for (const a of alvos) {
    const k = `${a.escalaId}|${a.mes}`;
    const estado = estados.get(k)!;
    if (estado === 'rascunho') continue;
    if (estado === 'remessada') {
      travadas.add(k);
      remessada = true;
    } else if (jaComecou(a.data, a.inicio, agora)) travadas.add(k);
  }
  const retificar: Retificar[] = [...estados].flatMap(([k, estado]) => (estado === 'publicada' || estado === 'retificada' ? [{ escalaId: k.split('|')[0]!, mes: k.split('|')[1]! }] : []));
  if (!travadas.size) return { registro: null, retificar };
  // a troca entre escalas diferentes é um ato só: com um lado travado, o registro cobre também o lado das outras escalas que não são rascunho (a justificativa vale para o ato inteiro)
  const doPassado = alvos.filter((a) => estados.get(`${a.escalaId}|${a.mes}`) !== 'rascunho');
  const hoje = hojeRecife();
  if (remessada && !(await ehAdministrador(c, usuarioId, hoje))) throw new Proibida(MSG_SO_ADMINISTRADOR);
  for (const unidadeId of new Set(doPassado.map((a) => a.unidadeId))) {
    if (!(await temPapel(c, usuarioId, unidadeId, GESTAO, hoje))) throw new Proibida(MSG_SO_GESTOR);
  }
  const motivo = (justificativa ?? '').trim();
  if (motivo.length < 10) throw new SemJustificativa();
  return { registro: { justificativa: motivo, alvos: doPassado }, retificar };
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
  /** Uma linha de registro que o retrato das vagas não pega (o "Permitir de novo"): chamada depois da mudança, só quando há registro. */
  maisRegistro?: (tx: Consulta, registro: { justificativa: string; alvos: Alvo[] }) => Promise<void>,
): Promise<T> {
  const lista = typeof tocar === 'function' ? await tocar(tx) : tocar;
  const { registro, retificar } = await conferirPassado(tx, usuarioId, lista, justificativa, agora);
  const antes = registro ? await retratar(tx, registro.alvos) : null;
  const resultado = await fazer();
  if (registro && antes) {
    await registrarDiferencas(tx, usuarioId, registro.justificativa, antes, await retratar(tx, registro.alvos));
    await maisRegistro?.(tx, registro);
  }
  // a mudança valeu (uma recusada ou desfeita por erro não chega aqui): a escala publicada passa a "em retificação"
  await marcarRetificacao(tx, retificar);
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

/** O que o registro diz de uma remoção que vai ser desfeita ("Permitir de novo"): lido antes de ela sumir. */
export type RemocaoParaORegistro = { escalaId: string; unidadeId: string; data: string; inicio: string; servico: string; turno: string; guarnicao: string | null; funcao: string | null; militar: { patente: string; nomeGuerra: string; matricula: string } };

export async function lerRemocaoParaORegistro(c: Consulta, remocaoId: string): Promise<RemocaoParaORegistro | null> {
  const r = (
    await c.query<{ escala_id: string | null; unidade_id: string; data: string; inicio: string; servico: string; letra: string; guarnicao: string | null; funcao: string | null; patente: string; nome_guerra: string; matricula: string }>(
      `select r.escala_id, e.unidade_id, to_char(r.data, 'YYYY-MM-DD') as data, to_char(t.inicio, 'HH24:MI') as inicio, s.nome as servico, t.letra, g.nome as guarnicao, f.nome as funcao, p.sigla as patente, m.nome_guerra, m.matricula
         from remocao r join escala e on e.id = r.escala_id join turno t on t.id = r.turno_id join servico s on s.id = r.servico_id join militar m on m.id = r.militar_id join posto_grad p on p.id = m.posto_grad_id
         left join guarnicao g on g.id = r.guarnicao_id left join funcao f on f.id = r.funcao_id
        where r.id = $1`,
      [remocaoId],
    )
  ).rows[0];
  if (!r || !r.escala_id) return null;
  return { escalaId: r.escala_id, unidadeId: r.unidade_id, data: r.data, inicio: r.inicio, servico: r.servico, turno: r.letra, guarnicao: r.guarnicao, funcao: r.funcao, militar: { patente: r.patente, nomeGuerra: r.nome_guerra, matricula: r.matricula } };
}

/** Uma linha de registro: "Permitiu de novo SD FULANO em ABT (Motorista), dia 03, 08:00" (a justificativa do "Permitir de novo" no passado). */
export async function registrarPermissao(tx: Consulta, usuarioId: string, justificativa: string, r: RemocaoParaORegistro): Promise<void> {
  await registrar(tx, {
    usuarioId, unidadeId: r.unidadeId, tipo: 'escala_no_passado', escalaId: r.escalaId, mes: r.data.slice(0, 7), data: r.data, antes: null, justificativa,
    depois: { data: r.data, inicio: r.inicio, servico: r.servico, turno: r.turno, guarnicao: r.guarnicao, funcao: r.funcao, militares: [], permitiuDeNovo: r.militar },
  });
}

/** O turno do acúmulo (o da alocação dele). */
export async function tocadoDoAcumulo(c: Consulta, acumuloId: string): Promise<Tocado[]> {
  const { rows } = await c.query<{ escala_id: string | null; data: string; turno_id: string }>(
    "select a.escala_id, to_char(a.data, 'YYYY-MM-DD') as data, a.turno_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id where x.id = $1", [acumuloId],
  );
  return rows.map((r) => ({ escalaId: r.escala_id, data: r.data, turnoId: r.turno_id }));
}

/**
 * A pré-escala (em lote) fora do rascunho só preenche os turnos que ainda não começaram, sem registro; os lançamentos sem escala (o expediente) passam. Numa escala remessada nada entra
 * (`Proibida` para quem não é administrador; para o administrador, `Recusa`: ele altera pelas alocações, com justificativa). `retificar`: as escalas que o preenchimento põe em retificação.
 */
export async function semOsQueJaComecaram<T extends { escalaId?: string | null; data: string; turnoId: string }>(
  c: Consulta, usuarioId: string, escalaId: string, mes: string, novas: T[], agora = agoraRecife(),
): Promise<{ novas: T[]; retificar: Retificar[] }> {
  const estado = (await estadoDoMes(c, escalaId, mes)).estado;
  if (estado === 'rascunho') return { novas, retificar: [] };
  if (estado === 'remessada') {
    if (!(await ehAdministrador(c, usuarioId, hojeRecife()))) throw new Proibida(MSG_SO_ADMINISTRADOR);
    throw new Recusa(`${MSG_JA_REMESSADA} Altere pelas alocações, com justificativa.`);
  }
  const turnos = new Map((await c.query<{ id: string; inicio: string }>("select id, to_char(inicio, 'HH24:MI') as inicio from turno where id = any($1::uuid[])", [[...new Set(novas.map((n) => n.turnoId))]])).rows.map((t) => [t.id, t.inicio]));
  const futuras = novas.filter((n) => n.escalaId === null || !jaComecou(n.data, turnos.get(n.turnoId) ?? '00:00', agora));
  const poeEmRetificacao = (estado === 'publicada' || estado === 'retificada') && futuras.some((n) => n.escalaId !== null);
  return { novas: futuras, retificar: poeEmRetificacao ? [{ escalaId, mes }] : [] };
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
