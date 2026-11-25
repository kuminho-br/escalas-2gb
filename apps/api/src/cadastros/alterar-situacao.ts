// "Alterar situação" (lotação, equipe, jornada, quadro e situação a partir de um dia) como duas funções que a ficha e o lote em massa (6.52) chamam: o lote não pode dar
// mais poder do que a ficha dá. `conferirAlteracaoDeSituacao` diz se a pessoa pode, sem gravar; `aplicarAlteracaoDeSituacao` grava dentro da transação que o chamador abriu.
import type { AlteracaoDeSituacao } from 'contratos';
import { CADASTRO, ehAdministrador, papeisVigentes, siglaDaUnidadeDeCima, temNivelDeCima, temPapel, unidadeDoRegistro } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { periodoAberto } from './periodo-aberto.ts';
import { quadroParaOPosto } from './quadros.ts';

export type MotivoDeRecusa = {
  codigo: 'sem_permissao' | 'sem_periodo' | 'equipe' | 'data' | 'quadro' | 'situacao' | 'nada_muda' | 'nao_achou' | 'mudou';
  texto: string;
  /** O campo da tela a que a recusa se refere (`equipeId`, `situacaoId`, `desde`, `quadroId`). */
  campo?: string;
  status: 400 | 403 | 404 | 409;
};
/** Algo mudou entre a conferência e a gravação (ou a gravação foi recusada): a transação desfaz tudo. */
export class RecusaDaAlteracao extends Error {
  constructor(readonly motivo: MotivoDeRecusa) {
    super(motivo.texto);
  }
}
/** O corpo de erro da API para um motivo: a frase, e o campo quando há. */
export const corpoDaRecusa = (m: MotivoDeRecusa) => ({ erro: m.texto, ...(m.campo ? { campos: { [m.campo]: m.texto } } : {}) });

export const MSG_SITUACAO_DESATIVADA = 'Esta situação está desativada.';
export const MSG_SITUACAO_NAO_ACHADA = 'Situação não encontrada.';
export const MSG_PERIODO_ANTES = (desde: string) => `Use uma data a partir de ${desde.slice(8, 10)}/${desde.slice(5, 7)}/${desde.slice(0, 4)}.`;
export const MSG_EQUIPE_DE_OUTRA = 'Escolha uma equipe da unidade da lotação.';
export const MSG_SITUACAO_MUDOU = 'A situação do militar mudou enquanto você alterava. Recarregue a ficha e tente de novo.';
export const FRASE_DA_RAIZ = 'Esta alteração é de quem tem nível de acesso na própria raiz.';
export const FRASE_CAMPO = (cima: string) => `Este campo é alterado por quem tem nível de acesso no ${cima}.`;
export const FRASE_LOTACAO = (cima: string) => `A lotação é alterada por quem tem nível de acesso no ${cima}.`;

const recusa = (codigo: MotivoDeRecusa['codigo'], texto: string, status: MotivoDeRecusa['status'], campo?: string): MotivoDeRecusa => ({ codigo, texto, status, ...(campo ? { campo } : {}) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A unidade em que o militar está lotado hoje: a do período que cobre hoje; sem ele, a do mais recente. */
export async function unidadeAtualDoMilitar(c: Consulta, militarId: string, hoje: string): Promise<string | null> {
  const { rows } = await c.query<{ unidade_id: string }>(
    `select unidade_id from rastreio where militar_id = $1
      order by (desde <= $2::date and (ate is null or ate >= $2::date)) desc, desde desc limit 1`,
    [militarId, hoje],
  );
  return rows[0]?.unidade_id ?? null;
}

/** As unidades que dão acesso ao militar: as lotações deste mês em diante; sem nenhuma, a lotação mais recente. */
export async function unidadesDoAcesso(c: Consulta, militarId: string): Promise<string[]> {
  const inicioDoMes = `${hojeRecife().slice(0, 7)}-01`;
  const { rows } = await c.query<{ unidade_id: string }>('select distinct unidade_id from rastreio where militar_id = $1 and (ate is null or ate >= $2)', [militarId, inicioDoMes]);
  return rows.length ? rows.map((r) => r.unidade_id) : [(await unidadeDoRegistro(c, 'militar', militarId))!];
}

/** O papel de cadastro na unidade: 404 se ela não existe, 403 com a frase de quem não tem. null = pode. */
export async function papelDeCadastroNaUnidade(c: Consulta, usuarioId: string, unidadeId: string, hoje: string): Promise<MotivoDeRecusa | null> {
  const unidade = UUID.test(unidadeId) ? (await c.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0] : undefined;
  if (!unidade) return recusa('nao_achou', 'Unidade não encontrada.', 404);
  if (await temPapel(c, usuarioId, unidadeId, CADASTRO, hoje)) return null;
  const algum = await papeisVigentes(c, usuarioId, hoje);
  return recusa('sem_permissao', algum.length ? `Você não tem permissão nos cadastros de ${unidade.sigla}.` : 'Esta tela é dos auxiliares administrativos e gestores.', 403);
}

/** O papel de cadastro sobre o militar (numa das unidades das lotações dele deste mês em diante); um militar sem lotação só o administrador abre. */
export async function papelDeCadastroNoMilitar(c: Consulta, usuarioId: string, militarId: string, hoje: string): Promise<MotivoDeRecusa | null> {
  const naoAchou = () => recusa('nao_achou', 'Militar não encontrado.', 404);
  if (!UUID.test(militarId)) return naoAchou();
  if (!(await unidadeDoRegistro(c, 'militar', militarId))) {
    const existe = (await c.query('select 1 from militar where id = $1', [militarId])).rows.length > 0;
    return existe && (await ehAdministrador(c, usuarioId, hoje)) ? null : naoAchou();
  }
  let negado: MotivoDeRecusa | null = null;
  for (const u of await unidadesDoAcesso(c, militarId)) {
    negado = await papelDeCadastroNaUnidade(c, usuarioId, u, hoje);
    if (!negado) return null;
  }
  return negado;
}

/** O "nível de acesso de cima" sobre uma unidade (o dono do Pecúlio dos militares dela); a frase diz de qual unidade. */
export async function donoDoPeculio(c: Consulta, usuarioId: string, unidadeId: string, frase: (cima: string) => string, hoje: string): Promise<MotivoDeRecusa | null> {
  if (await temNivelDeCima(c, usuarioId, unidadeId, CADASTRO, hoje)) return null;
  const cima = await siglaDaUnidadeDeCima(c, unidadeId);
  // a raiz não tem unidade de cima: a frase fala do nível de acesso nela mesma, nunca de um "nível acima"
  return recusa('sem_permissao', cima ? frase(cima) : FRASE_DA_RAIZ, 403);
}

/** O dono do Pecúlio sobre o militar, pela lotação atual dele; sem lotação só o administrador age (409 para os outros). */
export async function donoDoPeculioDoMilitar(c: Consulta, usuarioId: string, militarId: string, frase: (cima: string) => string, hoje: string): Promise<MotivoDeRecusa | null> {
  const ref = await unidadeAtualDoMilitar(c, militarId, hoje);
  if (ref) return donoDoPeculio(c, usuarioId, ref, frase, hoje);
  return (await ehAdministrador(c, usuarioId, hoje)) ? null : recusa('sem_permissao', 'Este militar ainda não tem lotação.', 409);
}

/**
 * Confere se `usuarioId` pode fazer esta alteração neste militar, sem gravar: o papel sobre o militar e na unidade de destino, a equipe da unidade, o papel na unidade do período aberto,
 * ser dono do Pecúlio para mudar lotação, equipe, jornada, quadro ou situação, e a situação escolhida existir e estar ativa. null = pode.
 * Não confere o que só a gravação vê (a data contra o período aberto, o quadro contra o posto): `aplicarAlteracaoDeSituacao` recusa na transação, com a linha travada.
 */
export async function conferirAlteracaoDeSituacao(c: Consulta, usuarioId: string, militarId: string, d: AlteracaoDeSituacao, hoje: string): Promise<MotivoDeRecusa | null> {
  const noMilitar = await papelDeCadastroNoMilitar(c, usuarioId, militarId, hoje);
  if (noMilitar) return noMilitar;
  // a unidade de destino também precisa ser de quem registra
  const noDestino = await papelDeCadastroNaUnidade(c, usuarioId, d.unidadeId, hoje);
  if (noDestino) return noDestino;
  if (d.equipeId) {
    const daUnidade = (await c.query('select 1 from equipe where id = $1 and unidade_id = $2', [d.equipeId, d.unidadeId])).rows.length > 0;
    if (!daUnidade) return recusa('equipe', MSG_EQUIPE_DE_OUTRA, 400, 'equipeId');
  }
  // o período aberto pode ser de outra seção (uma mudança de lotação já marcada): substituí-lo ou fechá-lo também pede papel nela
  const aberta0 = (await c.query<{ unidade_id: string; quadro_id: string | null; situacao_id: string; equipe_id: string | null; jornada: string }>('select unidade_id, quadro_id, situacao_id, equipe_id, jornada from rastreio where militar_id = $1 and ate is null', [militarId])).rows[0];
  const unidadeAberta = aberta0?.unidade_id;
  if (unidadeAberta && unidadeAberta !== d.unidadeId) {
    const naAberta = await papelDeCadastroNaUnidade(c, usuarioId, unidadeAberta, hoje);
    if (naAberta) return naAberta;
  }
  // mudar a LOTAÇÃO (a unidade) é do Pecúlio: papel acima da lotação atual (a SB vê a equipe e a jornada no histórico de rastreio, mas não as muda)
  const lotacaoAtual = await unidadeAtualDoMilitar(c, militarId, hoje);
  if (lotacaoAtual && d.unidadeId !== (unidadeAberta ?? lotacaoAtual)) {
    const naoEDono = await donoDoPeculio(c, usuarioId, lotacaoAtual, FRASE_LOTACAO, hoje);
    if (naoEDono) return naoEDono;
  }
  // o quadro e a situação são do Pecúlio, como a lotação: só quem tem nível de acesso acima da lotação os muda
  const mudaQuadro = d.quadroId !== undefined && d.quadroId !== (aberta0?.quadro_id ?? null);
  const mudaSituacao = d.situacaoId !== undefined && d.situacaoId !== aberta0?.situacao_id;
  const mudaEquipe = (d.equipeId ?? null) !== (aberta0?.equipe_id ?? null);
  const mudaJornada = d.jornada !== aberta0?.jornada;
  if (mudaQuadro || mudaSituacao || mudaEquipe || mudaJornada) {
    const naoEDono = await donoDoPeculioDoMilitar(c, usuarioId, militarId, FRASE_CAMPO, hoje);
    if (naoEDono) return naoEDono;
  }
  if (mudaSituacao) {
    const sit = (await c.query<{ ativo: boolean }>('select ativo from situacao_militar where id = $1', [d.situacaoId]))?.rows[0];
    if (!sit) return recusa('situacao', MSG_SITUACAO_NAO_ACHADA, 400, 'situacaoId');
    if (!sit.ativo) return recusa('situacao', MSG_SITUACAO_DESATIVADA, 400, 'situacaoId');
  }
  return null;
}

/**
 * Grava a alteração dentro da transação `tx`, lendo o período aberto com a linha travada (duas alterações ao mesmo tempo não se atropelam). No dia do período aberto, substitui o período;
 * depois dele, fecha o aberto na véspera e abre outro; antes dele, recusa. Lança `RecusaDaAlteracao` (e a transação desfaz tudo) se algo mudou desde a conferência.
 */
export async function aplicarAlteracaoDeSituacao(tx: Consulta, usuarioId: string, militarId: string, d: AlteracaoDeSituacao): Promise<{ criado: boolean }> {
  const aberta = await periodoAberto(tx, militarId);
  // outra gravação trocou a unidade do período aberto entre a conferência e agora, para uma que a pessoa não alcança: confere de novo
  if (aberta && aberta.unidade_id !== d.unidadeId && (await papelDeCadastroNaUnidade(tx, usuarioId, aberta.unidade_id, hojeRecife()))) throw new RecusaDaAlteracao(recusa('mudou', MSG_SITUACAO_MUDOU, 409));
  if (aberta && d.desde < aberta.desde) throw new RecusaDaAlteracao(recusa('data', MSG_PERIODO_ANTES(aberta.desde), 400, 'desde'));
  // o quadro precisa conter o posto (o posto não tem histórico: vale o de agora)
  let quadroId = aberta?.quadro_id ?? null;
  // sem período aberto (todos fechados), o período novo nasce com o quadro do posto, quando só um serve
  if (d.quadroId !== undefined || !aberta) {
    const posto = (await tx.query<{ posto_grad_id: string }>('select posto_grad_id from militar where id = $1', [militarId])).rows[0]!.posto_grad_id;
    const q = await quadroParaOPosto(tx, posto, d.quadroId, aberta?.quadro_id ?? null);
    if ('erro' in q) throw new RecusaDaAlteracao(recusa('quadro', q.erro, 400, 'quadroId'));
    quadroId = q.quadroId;
  }
  const situacaoId = d.situacaoId ?? aberta?.situacao_id ?? null;
  if (aberta && d.desde === aberta.desde) {
    await tx.query('update rastreio set unidade_id = $2, equipe_id = $3, jornada = $4, quadro_id = $5, situacao_id = coalesce($6, situacao_id) where id = $1', [aberta.id, d.unidadeId, d.equipeId, d.jornada, quadroId, situacaoId]);
    return { criado: false };
  }
  if (aberta) await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [aberta.id, d.desde]);
  await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id, situacao_id) values ($1, $2, $3, $4, $5, $6, $7)', [militarId, d.unidadeId, d.equipeId, d.jornada, d.desde, quadroId, situacaoId]);
  return { criado: true };
}
