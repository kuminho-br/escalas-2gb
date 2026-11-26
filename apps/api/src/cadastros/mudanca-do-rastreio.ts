// Cancelar e editar um período do histórico de rastreio (a mudança marcada para depois, e, na fase de testes, qualquer um). Como "Alterar situação" (alterar-situacao.ts),
// as duas funções rodam dentro da transação do chamador, com todos os períodos do militar travados, e lançam `RecusaDaAlteracao` (a transação desfaz tudo).
import type { AlteracaoDeSituacao } from 'contratos';
import { CADASTRO, ehAdministrador, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { somarDias } from '../datas.ts';
import {
  donoDoPeculioDoMilitar, FRASE_CAMPO, MSG_EQUIPE_DE_OUTRA, MSG_PERIODO_ANTES, MSG_SITUACAO_DESATIVADA, MSG_SITUACAO_NAO_ACHADA, papelDeCadastroNaUnidade, papelDeCadastroNoMilitar,
  RecusaDaAlteracao, type MotivoDeRecusa,
} from './alterar-situacao.ts';
import { ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO } from './fase-de-testes.ts';
import { quadroParaOPosto } from './quadros.ts';

export const MSG_JA_VALE = ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO ? 'Só o administrador mexe numa mudança que já vale.' : 'Só dá para mexer numa mudança que ainda não vale.';
export const MSG_DATA_DEPOIS_DE_HOJE = 'Use uma data depois de hoje.';
export const MSG_PERIODO_NAO_ACHADO = 'Mudança não encontrada.';
export const MSG_UNICO_REGISTRO = 'Este é o único registro do militar. Use "Alterar situação" no lugar de apagá-lo.';
export const MSG_DATA_ATE = (ate: string) => `Use uma data até ${ate.slice(8, 10)}/${ate.slice(5, 7)}/${ate.slice(0, 4)}.`;

/** Quem pode mexer num período que começa em `desde`: qualquer um, se ainda não vale; o que já vale, só o administrador, e só na fase de testes. */
export const podeMexerNoPeriodo = (administrador: boolean, desde: string, hoje: string): boolean => desde > hoje || (ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO && administrador);

type Periodo = { id: string; desde: string; ate: string | null; unidade_id: string; equipe_id: string | null; jornada: 'pronto' | 'adm'; quadro_id: string | null; situacao_id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recusa = (codigo: MotivoDeRecusa['codigo'], texto: string, status: MotivoDeRecusa['status'], campo?: string): RecusaDaAlteracao => new RecusaDaAlteracao({ codigo, texto, status, ...(campo ? { campo } : {}) });

/** Todos os períodos do militar, do mais velho ao mais novo, com as linhas travadas para a transação. */
async function periodosTravados(tx: Consulta, militarId: string): Promise<Periodo[]> {
  return (
    await tx.query<Periodo>(
      `select id, to_char(desde, 'YYYY-MM-DD') as desde, to_char(ate, 'YYYY-MM-DD') as ate, unidade_id, equipe_id, jornada, quadro_id, situacao_id
         from rastreio where militar_id = $1 order by desde for update`,
      [militarId],
    )
  ).rows;
}

/**
 * Confere quem pode mexer neste período (o mesmo nível de acesso de "Alterar situação": papel de cadastro sobre o militar, na unidade do período e na do período vizinho que a mudança toca,
 * e ser dono do Pecúlio dele) e devolve o período com o anterior e o seguinte. Lança a recusa, com a frase da tela, se não pode.
 */
async function conferirAcesso(tx: Consulta, usuarioId: string, militarId: string, periodoId: string, hoje: string): Promise<{ todos: Periodo[]; p: Periodo; anterior?: Periodo; seguinte?: Periodo; administrador: boolean }> {
  const noMilitar = await papelDeCadastroNoMilitar(tx, usuarioId, militarId, hoje);
  if (noMilitar) throw new RecusaDaAlteracao(noMilitar);
  const todos = UUID.test(periodoId) ? await periodosTravados(tx, militarId) : [];
  const i = todos.findIndex((x) => x.id === periodoId);
  if (i < 0) throw recusa('nao_achou', MSG_PERIODO_NAO_ACHADO, 404);
  const p = todos[i]!;
  const anterior = todos[i - 1];
  const seguinte = todos[i + 1];
  const administrador = await ehAdministrador(tx, usuarioId, hoje);
  if (!podeMexerNoPeriodo(administrador, p.desde, hoje)) throw recusa('ja_vale', MSG_JA_VALE, 403);
  for (const u of new Set([p.unidade_id, anterior?.unidade_id].filter((x): x is string => Boolean(x)))) {
    const negado = await papelDeCadastroNaUnidade(tx, usuarioId, u, hoje);
    if (negado) throw new RecusaDaAlteracao(negado);
  }
  const naoEDono = await donoDoPeculioDoMilitar(tx, usuarioId, militarId, FRASE_CAMPO, hoje);
  if (naoEDono) throw new RecusaDaAlteracao(naoEDono);
  return { todos, p, anterior, seguinte, administrador };
}

/** O anterior é contíguo ao período (termina na véspera do começo dele). */
const colado = (anterior: Periodo | undefined, p: Periodo) => Boolean(anterior?.ate && anterior.ate === somarDias(p.desde, -1));

/**
 * Cancela o período: apaga a linha e, se o anterior terminava na véspera dela, o reabre: o fim dele passa a ser o do período cancelado (sem fim, se o cancelado era o aberto; a véspera
 * do seguinte, se havia). Um vão que já existia antes do período continua vão. O único registro do militar não se cancela.
 */
export async function cancelarPeriodo(tx: Consulta, usuarioId: string, militarId: string, periodoId: string, hoje: string): Promise<void> {
  const { todos, p, anterior } = await conferirAcesso(tx, usuarioId, militarId, periodoId, hoje);
  if (todos.length === 1) throw recusa('unico', MSG_UNICO_REGISTRO, 400);
  await tx.query('delete from rastreio where id = $1', [p.id]);
  if (anterior && colado(anterior, p)) await tx.query('update rastreio set ate = $2 where id = $1', [anterior.id, p.ate]);
}

/**
 * Edita o período com os valores de `d` (lotação, equipe, jornada, quadro, situação e a data em que começa). Mudar a data acerta o fim do anterior (a véspera da nova data); a data
 * fica depois do começo do anterior e não passa do fim do próprio período. Quadro e situação que `d` não traz continuam os do período.
 */
export async function editarPeriodo(tx: Consulta, usuarioId: string, militarId: string, periodoId: string, d: AlteracaoDeSituacao, hoje: string): Promise<void> {
  const { p, anterior, administrador } = await conferirAcesso(tx, usuarioId, militarId, periodoId, hoje);
  // a mudança que ainda não vale não vai para uma data que já passou: isso reescreveria o histórico (só o administrador, na fase de testes)
  if (!(ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO && administrador) && d.desde <= hoje) throw recusa('data', MSG_DATA_DEPOIS_DE_HOJE, 400, 'desde');
  const noDestino = await papelDeCadastroNaUnidade(tx, usuarioId, d.unidadeId, hoje);
  if (noDestino) throw new RecusaDaAlteracao(noDestino);
  if (d.equipeId) {
    const daUnidade = (await tx.query('select 1 from equipe where id = $1 and unidade_id = $2', [d.equipeId, d.unidadeId])).rows.length > 0;
    if (!daUnidade) throw recusa('equipe', MSG_EQUIPE_DE_OUTRA, 400, 'equipeId');
  }
  const situacaoId = d.situacaoId ?? p.situacao_id;
  if (situacaoId !== p.situacao_id) {
    const sit = (await tx.query<{ ativo: boolean }>('select ativo from situacao_militar where id = $1', [situacaoId])).rows[0];
    if (!sit) throw recusa('situacao', MSG_SITUACAO_NAO_ACHADA, 400, 'situacaoId');
    if (!sit.ativo) throw recusa('situacao', MSG_SITUACAO_DESATIVADA, 400, 'situacaoId');
  }
  let quadroId = p.quadro_id;
  if (d.quadroId !== undefined) {
    const posto = (await tx.query<{ posto_grad_id: string }>('select posto_grad_id from militar where id = $1', [militarId])).rows[0]!.posto_grad_id;
    const q = await quadroParaOPosto(tx, posto, d.quadroId, p.quadro_id);
    if ('erro' in q) throw recusa('quadro', q.erro, 400, 'quadroId');
    quadroId = q.quadroId;
  }
  if (anterior && d.desde <= anterior.desde) throw recusa('data', MSG_PERIODO_ANTES(somarDias(anterior.desde, 1)), 400, 'desde');
  if (p.ate && d.desde > p.ate) throw recusa('data', MSG_DATA_ATE(p.ate), 400, 'desde');
  const gravar = () =>
    tx.query('update rastreio set unidade_id = $2, equipe_id = $3, jornada = $4, quadro_id = $5, situacao_id = $6, desde = $7 where id = $1', [p.id, d.unidadeId, d.equipeId, d.jornada, quadroId, situacaoId, d.desde]);
  // o fim do anterior acompanha a data: contíguo, segue a nova data; com vão, só recua se a nova data entrar nele. Os períodos de um militar não se sobrepõem nem por um instante,
  // então a ordem importa: a data que avança muda primeiro o período, a que recua muda primeiro o anterior.
  const novoFim = anterior?.ate && (colado(anterior, p) || anterior.ate >= d.desde) ? somarDias(d.desde, -1) : null;
  const acertaOAnterior = () => (anterior && novoFim ? tx.query('update rastreio set ate = $2 where id = $1', [anterior.id, novoFim]) : Promise.resolve());
  if (d.desde === p.desde) {
    await gravar();
  } else if (d.desde > p.desde) {
    await gravar();
    await acertaOAnterior();
  } else {
    await acertaOAnterior();
    await gravar();
  }
}

/** Dos períodos da ficha, os que quem pede pode cancelar ou editar (os mesmos critérios das duas funções acima, sem travar nada): o botão só aparece onde a rota aceita. */
export async function periodosQueQuemPedePodeMexer(c: Consulta, usuarioId: string, periodos: { id: string; unidadeId: string; desde: string }[], dono: boolean, administrador: boolean, hoje: string): Promise<Set<string>> {
  const pode = new Set<string>();
  if (!dono) return pode;
  const ordem = [...periodos].sort((a, b) => (a.desde < b.desde ? -1 : 1));
  const temNaUnidade = new Map<string, boolean>();
  const papel = async (u: string) => {
    if (!temNaUnidade.has(u)) temNaUnidade.set(u, administrador || (await temPapel(c, usuarioId, u, CADASTRO, hoje)));
    return temNaUnidade.get(u)!;
  };
  for (const [i, p] of ordem.entries()) {
    if (!podeMexerNoPeriodo(administrador, p.desde, hoje)) continue;
    if ((await papel(p.unidadeId)) && (!ordem[i - 1] || (await papel(ordem[i - 1]!.unidadeId)))) pode.add(p.id);
  }
  return pode;
}
