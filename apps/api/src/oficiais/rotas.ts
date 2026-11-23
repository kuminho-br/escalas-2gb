// Rotas da escala dos oficiais (QOC e QOA) e do painel de saldo. Só gestor e administrador da unidade.
// A escala dos oficiais é uma escala comum de rodada de cotas (entrega 6.27): cada lançamento é uma alocação de JES (à mão) ou de Saldo (a rodada).
import { AjusteDeSaldo, Lancamento, OrdemManual, Participantes, type OficialNoSaldo } from 'contratos';
import { Mes } from 'contratos';
import { calcularCotas, diasDoMes, ordemDeEscolha, rotuloDoTurno, saldoDeEntrada, saldoDoMes, type TurnoDoMes } from 'dominio';
import { Hono, type Context } from 'hono';
import { GESTAO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { escolherEscala, lancamentosDoMes, lerEscala, lerSaldo, linhaDoMes, servicosDaRodada, turnosDoServico, type LinhaDoMes } from './leitura.ts';
import { copiarMarcasDoMesAnterior, elegiveisDoMes, limitesDoMes, marcasDoMes, postoCurto } from './participantes.ts';

type Ctx = Context<AmbienteApi>;

const MSG_ENCERRADO = 'O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.';
const MSG_COTA_FECHADA = 'Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no lugar: vira cobertura.';
const MSG_NAO_ABERTO = 'Abra o mês para lançar.';
const MSG_ENCERRAR_ANTES_DE_FECHAR = 'Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.';
const MSG_SEM_ESCALA = 'A unidade ainda não tem uma escala com rodada de cotas. Cadastre uma em Escalas.';
const MSG_ESCALA_INVALIDA = 'Escolha uma escala da unidade com rodada de cotas.';
const MSG_SEM_SALDO = 'A escala precisa de um serviço de Saldo, com turnos, para abrir o mês.';
const MSG_SEM_JES = 'Esta escala não tem o serviço JES.';
const MSG_FORA_DA_ESCALA = 'Este oficial não está na escala deste mês.';
const MSG_SEM_PARTICIPANTES = 'Marque quem participa da rodada antes de abrir o mês.';
const MSG_NAO_ELEGIVEL = 'Este oficial não é elegível neste mês.';
const MSG_PARTICIPANTES_FECHADOS = 'Com a escala fechada, os participantes não mudam mais.';
const MSG_SO_VOLUNTARIO = 'JES só para voluntário JES.';
const MSG_LUGAR_FORA_DO_MES = 'Este dia não é do mês escolhido.';
const MSG_LANCAMENTO_FORA_DO_MES = 'Este lançamento não é deste mês.';

class Recusa extends Error {
  constructor(readonly status: 400 | 409, mensagem: string) {
    super(mensagem);
  }
}

interface Rodada {
  unidadeId: string;
  escalaId: string;
  mes: string;
}

/** Garante a linha do mês da escala; ao criá-la, as marcas de quem participa vêm do mês anterior da escala. */
async function garantirMes(tx: Consulta, r: Rodada): Promise<void> {
  const { rows } = await tx.query<{ id: string }>(
    'insert into oficiais_mes (unidade_id, escala_id, mes) values ($1, $2, $3::date) on conflict (escala_id, mes) do nothing returning id',
    [r.unidadeId, r.escalaId, `${r.mes}-01`],
  );
  if (rows[0]) await copiarMarcasDoMesAnterior(tx, r.escalaId, r.mes, rows[0].id);
}

/** Os lugares do mês para a rodada: um por dia e por letra do serviço de Saldo, menos os que os JES já tomaram. */
async function lugaresDeSaldo(tx: Consulta, r: Rodada): Promise<number> {
  const servicos = await servicosDaRodada(tx, r.escalaId);
  if (!servicos.saldo) throw new Recusa(409, MSG_SEM_SALDO);
  const letras = await turnosDoServico(tx, servicos.saldo.id);
  if (letras.length === 0) throw new Recusa(409, MSG_SEM_SALDO);
  const jes = (await lancamentosDoMes(tx, r.escalaId, r.mes)).filter((l) => l.servicoId === servicos.jes?.id).length;
  return Math.max(0, letras.length * diasDoMes(r.mes).length - jes);
}

async function gravarCotas(tx: Consulta, mesId: string, cotas: ReturnType<typeof calcularCotas>): Promise<void> {
  await tx.query('delete from oficiais_cota where mes_id = $1', [mesId]);
  for (const [i, x] of cotas.entries()) {
    await tx.query(
      'insert into oficiais_cota (mes_id, militar_id, ordem, dias, devido, cota, sobra) values ($1, $2, $3, $4, $5, $6, $7)',
      [mesId, x.militarId, i + 1, x.dias, x.devido, x.cota, x.sobra],
    );
  }
}

/**
 * Recalcula a ordem, os dias e as cotas de saldo dos participantes e regrava `oficiais_cota` (o mês precisa estar aberto e a escala não fechada). Mantém
 * os lançamentos de quem continua; os de Saldo de quem saiu da rodada são retirados, e a resposta traz uma frase para cada um ("2 turnos de CAP X ficaram sem ninguém.").
 */
async function refazerCotas(tx: Consulta, r: Rodada, ordemManual?: string[]): Promise<string[]> {
  const linha = (await linhaDoMes(tx, r.escalaId, r.mes, true))!;
  if (linha.fechada_em) throw new Recusa(409, MSG_COTA_FECHADA);
  const total = await lugaresDeSaldo(tx, r);
  const manual = ordemManual ?? linha.ordem_manual;
  const elegiveis = await elegiveisDoMes(tx, r.unidadeId, r.mes);
  const { marcados } = await marcasDoMes(tx, r.escalaId, r.mes, linha.id);
  const participantes = elegiveis.filter((p) => marcados.has(p.militarId));
  if (elegiveis.length > 0 && participantes.length === 0) throw new Recusa(409, MSG_SEM_PARTICIPANTES);
  const ordem = ordemDeEscolha(participantes, manual);
  const porId = new Map(participantes.map((p) => [p.militarId, p]));
  const cotas = calcularCotas(total, ordem.map((id) => ({ militarId: id, dias: porId.get(id)!.dias })));
  await gravarCotas(tx, linha.id, cotas);

  // quem saiu da rodada (desmarcado, desativado, outro quadro, outra unidade) não pode ficar com lugares de Saldo: o devido dos outros contaria lugares sem dono de saldo
  const jesId = (await servicosDaRodada(tx, r.escalaId)).jes?.id ?? null;
  const ficam = cotas.map((x) => x.militarId);
  const { inicio, fim } = limitesDoMes(r.mes);
  const { rows: soltos } = await tx.query<{ n: number; posto: string; nome_guerra: string }>(
    `select count(*)::int as n, p.sigla as posto, m.nome_guerra
       from alocacao a join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id
      where a.escala_id = $1 and a.data between $2::date and $3::date and a.servico_id is distinct from $4::uuid and not (a.militar_id = any($5::uuid[]))
      group by m.id, p.sigla, p.ordem, m.nome_guerra order by p.ordem desc, m.nome_guerra`,
    [r.escalaId, inicio, fim, jesId, ficam],
  );
  const liberados = soltos.map((x) => `${x.n} ${x.n === 1 ? 'turno' : 'turnos'} de ${postoCurto(x.posto)} ${x.nome_guerra} ${x.n === 1 ? 'ficou' : 'ficaram'} sem ninguém.`);
  await tx.query(
    `delete from alocacao where escala_id = $1 and data between $2::date and $3::date and servico_id is distinct from $4::uuid and not (militar_id = any($5::uuid[]))`,
    [r.escalaId, inicio, fim, jesId, ficam],
  );
  await tx.query('update oficiais_mes set ordem_manual = $2::uuid[] where id = $1', [linha.id, manual]);
  return liberados;
}

/**
 * As cotas se refazem sozinhas entre "Abrir o mês" e fechar a escala: a presença (afastamentos), a antiguidade e o posto de quem está na rodada podem ter
 * mudado desde a última vez. Compara o que está gravado com o que sairia agora e só grava se mudou (nenhum participante entra nem sai por aqui).
 */
async function atualizarCotasSeMudaram(banco: Banco, usuarioId: string, r: Rodada): Promise<void> {
  const linha = await linhaDoMes(banco, r.escalaId, r.mes);
  if (!linha?.aberto_em || linha.fechada_em || linha.encerrada_em) return;
  const gravadas = (await banco.query<{ militar_id: string; dias: number; devido: string; cota: number; sobra: boolean }>(
    'select militar_id, dias, devido::text as devido, cota, sobra from oficiais_cota where mes_id = $1 order by ordem', [linha.id])).rows;
  if (gravadas.length === 0) return;
  const membros = new Set(gravadas.map((g) => g.militar_id));
  const elegiveis = (await elegiveisDoMes(banco, r.unidadeId, r.mes)).filter((p) => membros.has(p.militarId));
  const porId = new Map(elegiveis.map((p) => [p.militarId, p]));
  // quem já não é elegível (saiu do quadro ou da unidade) segue com os dias gravados, no fim, na ordem de antes
  const restantes = gravadas.filter((g) => !porId.has(g.militar_id)).map((g) => ({ militarId: g.militar_id, dias: g.dias }));
  const lista = [...ordemDeEscolha(elegiveis, linha.ordem_manual).map((id) => ({ militarId: id, dias: porId.get(id)!.dias })), ...restantes];
  let total: number;
  try {
    total = await lugaresDeSaldo(banco, r);
  } catch (e) {
    if (e instanceof Recusa) return;
    throw e;
  }
  const novas = calcularCotas(total, lista);
  const igual = novas.length === gravadas.length && novas.every((n, i) => {
    const g = gravadas[i]!;
    return n.militarId === g.militar_id && n.dias === g.dias && n.cota === g.cota && n.sobra === g.sobra && Math.abs(n.devido - Number(g.devido)) < 1e-6;
  });
  if (igual) return;
  await comUsuario(banco, usuarioId, async (tx) => {
    const de_novo = await linhaDoMes(tx, r.escalaId, r.mes, true);
    if (de_novo?.aberto_em && !de_novo.fechada_em) await gravarCotas(tx, de_novo.id, novas);
  });
}

/** Os lançamentos do mês como `TurnoDoMes` do motor: só os de Saldo contam para o saldo do oficial (o JES é voluntário e fica fora). */
async function turnosDeSaldoDoMes(c: Consulta, r: Rodada): Promise<TurnoDoMes[]> {
  const jesId = (await servicosDaRodada(c, r.escalaId)).jes?.id;
  return (await lancamentosDoMes(c, r.escalaId, r.mes))
    .filter((l) => l.servicoId !== jesId)
    .map((l) => ({ dia: l.dia, turnoId: l.turnoId, militarId: l.militarId, saiuMilitarId: l.saiuMilitarId }));
}

export function rotasOficiais(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  r.use('/unidades/:u/oficiais/*', sessao);
  r.use('/unidades/:u/oficiais-saldo', sessao);
  r.use('/unidades/:u/oficiais-saldo/*', sessao);

  /**
   * Papel de gestor ou administrador na unidade, o mês válido e a escala da rodada (a `?escala=` da tela; sem ela, a do último mês); devolve a resposta
   * de recusa, se houver. A escala pode ser null só na leitura (a unidade ainda não tem uma).
   */
  async function entrada(c: Ctx, comMes = true): Promise<{ resposta: Response } | { u: string; mes: string; escala: { id: string; nome: string } | null; pedida: string | null }> {
    const u = c.req.param('u')!;
    const negado = await exigirPapel(c, u, GESTAO);
    if (negado) return { resposta: negado };
    const mes = comMes ? c.req.param('mes')! : '';
    if (comMes && !Mes.safeParse(mes).success) return { resposta: c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400) };
    const pedida = c.req.query('escala') ?? null;
    const escala = await escolherEscala(dep.banco, u, pedida);
    if (pedida && !escala) return { resposta: c.json({ erro: MSG_ESCALA_INVALIDA }, 400) };
    return { u, mes, escala, pedida };
  }
  const daEscala = (a: { escala: { id: string } | null }, c: Ctx) => (a.escala ? null : c.json({ erro: MSG_SEM_ESCALA }, 409));

  /** Roda a mudança numa transação e devolve a escala do mês, com os avisos; uma `Recusa` vira 400 ou 409 com a mensagem. */
  async function mudar(c: Ctx, rod: Rodada, fn: (tx: Consulta) => Promise<{ liberados?: string[]; foraDaOrdem?: string } | string[] | void>): Promise<Response> {
    try {
      const escala = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const extra = (await fn(tx)) ?? {};
        const { liberados, foraDaOrdem } = Array.isArray(extra) ? { liberados: extra, foraDaOrdem: undefined } : extra;
        return { ...(await lerEscala(tx, rod.unidadeId, rod.mes, rod.escalaId)), liberados: liberados ?? [], ...(foraDaOrdem ? { foraDaOrdem } : {}) };
      });
      return c.json(escala);
    } catch (e) {
      if (e instanceof Recusa) return c.json({ erro: e.message }, e.status);
      return respostaDoErroDoBanco(c, e);
    }
  }

  r.get('/unidades/:u/oficiais/:mes', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    // as cotas se refazem sozinhas até fechar a escala: a presença e a antiguidade podem ter mudado desde a última vez
    if (a.escala) await atualizarCotasSeMudaram(dep.banco, c.get('usuarioId'), { unidadeId: a.u, escalaId: a.escala.id, mes: a.mes });
    return c.json(await lerEscala(dep.banco, a.u, a.mes, a.escala?.id ?? null));
  });

  // "Abrir o mês": cria o mês, calcula as cotas de saldo e libera os lançamentos; antes dele as cotas não existem, e depois dele se refazem sozinhas
  r.post('/unidades/:u/oficiais/:mes/abrir', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      await garantirMes(tx, rod);
      const linha = (await linhaDoMes(tx, rod.escalaId, rod.mes, true))!;
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (linha.fechada_em) throw new Recusa(409, MSG_COTA_FECHADA);
      if (!linha.aberto_em) await tx.query('update oficiais_mes set aberto_em = now() where id = $1', [linha.id]);
      return refazerCotas(tx, rod);
    });
  });

  r.put('/unidades/:u/oficiais/:mes/ordem', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const corpo = await lerCorpo(c, OrdemManual);
    if (!corpo.ok) return corpo.resposta;
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      await garantirMes(tx, rod);
      const linha = (await linhaDoMes(tx, rod.escalaId, rod.mes, true))!;
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (linha.fechada_em) throw new Recusa(409, MSG_COTA_FECHADA);
      // antes de abrir o mês, a ordem manual só fica guardada; depois, as cotas se refazem com ela
      if (!linha.aberto_em) {
        await tx.query('update oficiais_mes set ordem_manual = $2::uuid[] where id = $1', [linha.id, corpo.dados.militarIds]);
        return;
      }
      return refazerCotas(tx, rod, corpo.dados.militarIds);
    });
  });

  r.put('/unidades/:u/oficiais/:mes/participantes', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const corpo = await lerCorpo(c, Participantes);
    if (!corpo.ok) return corpo.resposta;
    const marcar = [...new Set(corpo.dados.militarIds)];
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      const elegiveis = new Set((await elegiveisDoMes(tx, a.u, a.mes)).map((p) => p.militarId));
      await garantirMes(tx, rod);
      const linha = (await linhaDoMes(tx, rod.escalaId, rod.mes, true))!;
      if (linha.fechada_em) throw new Recusa(409, MSG_PARTICIPANTES_FECHADOS);
      // quem já estava na rodada (marcado ou com cota) e deixou de ser elegível pode vir na lista da tela: ele só sai da rodada.
      // Quem nunca esteve nela e não é elegível é recusado.
      const naRodada = new Set([
        ...(await marcasDoMes(tx, rod.escalaId, a.mes, linha.id)).marcados,
        ...(await tx.query<{ militar_id: string }>('select militar_id from oficiais_cota where mes_id = $1', [linha.id])).rows.map((x) => x.militar_id),
      ]);
      if (marcar.some((id) => !elegiveis.has(id) && !naRodada.has(id))) throw new Recusa(400, MSG_NAO_ELEGIVEL);
      const ficam = marcar.filter((id) => elegiveis.has(id));
      await tx.query('delete from oficiais_participante where mes_id = $1 and not (militar_id = any($2::uuid[]))', [linha.id, ficam]);
      await tx.query('insert into oficiais_participante (mes_id, militar_id) select $1, unnest($2::uuid[]) on conflict do nothing', [linha.id, ficam]);
      // com o mês aberto, mudar quem participa refaz as cotas (os lançamentos de quem continua ficam)
      if (linha.aberto_em) return refazerCotas(tx, rod);
    });
  });

  /**
   * Lançar um oficial num lugar (dia e letra), como JES ou como Saldo. Lugar livre: grava. Lugar do mesmo serviço: troca o nome (com a escala fechada, vira
   * cobertura). Lugar de outro serviço: recusado. Só com o mês aberto. A ordem é sugerida: lançar Saldo fora da vez grava e devolve o aviso.
   */
  r.post('/unidades/:u/oficiais/:mes/lancamentos', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const corpo = await lerCorpo(c, Lancamento);
    if (!corpo.ok) return corpo.resposta;
    const { dia, letra, servico, militarId } = corpo.dados;
    if (!diasDoMes(a.mes).includes(dia)) return c.json({ erro: MSG_LUGAR_FORA_DO_MES }, 400);
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      const linha = await linhaDoMes(tx, rod.escalaId, rod.mes, true);
      if (!linha || !linha.aberto_em) throw new Recusa(409, MSG_NAO_ABERTO);
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      const servicos = await servicosDaRodada(tx, rod.escalaId);
      const alvo = servico === 'jes' ? servicos.jes : servicos.saldo;
      if (!alvo) throw new Recusa(400, servico === 'jes' ? MSG_SEM_JES : MSG_SEM_SALDO);
      const turno = (await turnosDoServico(tx, alvo.id)).find((t) => t.letra === letra);
      if (!turno) throw new Recusa(400, `O serviço ${alvo.nome} desta escala não tem o turno ${letra}.`);
      // quem pode: o Saldo, quem está na rodada do mês (tem cota); o JES, o voluntário JES elegível (ou que já está na rodada)
      const naCota = (await tx.query('select 1 from oficiais_cota where mes_id = $1 and militar_id = $2', [linha.id, militarId])).rows.length > 0;
      if (servico === 'saldo') {
        if (!naCota) throw new Recusa(400, MSG_FORA_DA_ESCALA);
      } else {
        const elegivel = (await elegiveisDoMes(tx, rod.unidadeId, rod.mes)).some((p) => p.militarId === militarId);
        if (!elegivel && !naCota) throw new Recusa(400, MSG_FORA_DA_ESCALA);
        const voluntario = (await tx.query<{ v: boolean }>('select voluntario_jes as v from militar where id = $1', [militarId])).rows[0]?.v;
        if (!voluntario) throw new Recusa(400, MSG_SO_VOLUNTARIO);
      }
      const atual = (await lancamentosDoMes(tx, rod.escalaId, rod.mes)).find((l) => l.dia === dia && l.letra === letra);
      let foraDaOrdem: string | undefined;
      if (servico === 'saldo' && !atual) foraDaOrdem = await avisoDeOrdem(tx, rod, linha, militarId);
      if (!atual) {
        await tx.query(
          'insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, origem) values ($1, $2, $3, $4, $5::date, $6)',
          [militarId, rod.escalaId, alvo.id, turno.id, dia, servico === 'jes' ? 'manual' : 'distribuicao'],
        );
      } else if (atual.servicoId !== alvo.id) {
        const quem = atual.servicoId === servicos.jes?.id ? 'JES' : 'Saldo';
        throw new Recusa(409, `Este lugar já está tomado por ${quem}.`);
      } else if (atual.militarId !== militarId) {
        // com a escala fechada, trocar o nome é uma cobertura: quem saiu conta como tirado, e quem cobriu também; voltar ao nome original desfaz a cobertura
        const original = atual.saiuMilitarId ?? atual.militarId;
        await tx.query('update alocacao set militar_id = $2 where id = $1', [atual.id, militarId]);
        await tx.query('delete from oficiais_cobertura where alocacao_id = $1', [atual.id]);
        if (linha.fechada_em && original !== militarId) await tx.query('insert into oficiais_cobertura (alocacao_id, saiu_militar_id) values ($1, $2)', [atual.id, original]);
      }
      // os lugares de JES mudam a cota de saldo: com a escala aberta (não fechada), as cotas se refazem sozinhas
      if (servico === 'jes' && !linha.fechada_em && (!atual || atual.militarId !== militarId)) return { liberados: await refazerCotas(tx, rod), foraDaOrdem };
      return { foraDaOrdem };
    });
  });

  r.delete('/unidades/:u/oficiais/:mes/lancamentos/:alocacaoId', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const alocacaoId = c.req.param('alocacaoId')!;
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      const linha = await linhaDoMes(tx, rod.escalaId, rod.mes, true);
      if (!linha || !linha.aberto_em) throw new Recusa(409, MSG_NAO_ABERTO);
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      const doMes = (await lancamentosDoMes(tx, rod.escalaId, rod.mes)).find((l) => l.id === alocacaoId);
      if (!doMes) throw new Recusa(400, MSG_LANCAMENTO_FORA_DO_MES);
      const servicos = await servicosDaRodada(tx, rod.escalaId);
      await tx.query('delete from alocacao where id = $1', [alocacaoId]);
      // tirar um JES devolve o lugar para a rodada: as cotas se refazem, mantendo os lançamentos de quem continua
      if (doMes.servicoId === servicos.jes?.id && !linha.fechada_em) return refazerCotas(tx, rod);
    });
  });

  r.post('/unidades/:u/oficiais/:mes/fechar', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      const linha = await linhaDoMes(tx, rod.escalaId, rod.mes, true);
      if (!linha || !linha.aberto_em) throw new Recusa(409, MSG_NAO_ABERTO);
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (!linha.fechada_em) {
        // a última refeita das cotas: a presença pode ter mudado desde a última leitura
        await refazerCotas(tx, rod);
        await tx.query('update oficiais_mes set fechada_em = now() where id = $1', [linha.id]);
      }
    });
  });

  r.post('/unidades/:u/oficiais/:mes/encerrar', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const sem = daEscala(a, c);
    if (sem) return sem;
    const rod = { unidadeId: a.u, escalaId: a.escala!.id, mes: a.mes };
    return mudar(c, rod, async (tx) => {
      const linha = await linhaDoMes(tx, rod.escalaId, rod.mes, true);
      if (linha?.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (!linha || !linha.fechada_em) throw new Recusa(409, MSG_ENCERRAR_ANTES_DE_FECHAR);
      const cotas = (await tx.query<{ militar_id: string; dias: number }>('select militar_id, dias from oficiais_cota where mes_id = $1 order by ordem', [linha.id])).rows
        .map((x) => ({ militarId: x.militar_id, dias: x.dias }));
      const turnos = await turnosDeSaldoDoMes(tx, rod);
      const saldos = saldoDoMes(turnos, cotas);

      // quem chega entra com a média dos acumulados de quem já tem saldo na unidade (só se alguém já tem)
      const acumulados = new Map(
        (await tx.query<{ militar_id: string; total: string }>('select militar_id, sum(valor)::text as total from oficiais_saldo where unidade_id = $1 group by militar_id', [a.u])).rows
          .map((x) => [x.militar_id, Number(x.total)] as const),
      );
      const veteranos = cotas.filter((x) => acumulados.has(x.militarId)).map((x) => acumulados.get(x.militarId)!);
      if (veteranos.length > 0) {
        const media = saldoDeEntrada(veteranos);
        for (const x of cotas.filter((y) => !acumulados.has(y.militarId))) {
          await tx.query("insert into oficiais_saldo (unidade_id, militar_id, mes_id, tipo, valor) values ($1, $2, $3, 'entrada', $4)", [a.u, x.militarId, linha.id, media]);
        }
      }
      const inicios = new Map((await tx.query<{ id: string; inicio: string }>("select id, to_char(inicio, 'HH24:MI') as inicio from turno where id = any($1::uuid[])", [[...new Set(turnos.map((t) => t.turnoId))]])).rows.map((t) => [t.id, t.inicio] as const));
      for (const s of saldos) {
        let dia = 0;
        let noite = 0;
        for (const [turnoId, n] of Object.entries(s.porTurno)) {
          if (rotuloDoTurno(inicios.get(turnoId) ?? '07:00') === 'Noite') noite += n;
          else dia += n;
        }
        await tx.query(
          "insert into oficiais_saldo (unidade_id, militar_id, mes_id, tipo, valor, tirado, devido, turnos_dia, turnos_noite) values ($1, $2, $3, 'mes', $4, $5, $6, $7, $8)",
          [a.u, s.militarId, linha.id, s.valor, s.tirado, s.devido, dia, noite],
        );
      }
      await tx.query('update oficiais_mes set encerrada_em = now() where id = $1', [linha.id]);
    });
  });

  r.get('/unidades/:u/oficiais-saldo', async (c) => {
    const a = await entrada(c, false);
    if ('resposta' in a) return a.resposta;
    return c.json(await lerSaldo(dep.banco, a.u, hojeRecife(), a.escala?.id ?? null));
  });

  r.post('/unidades/:u/oficiais-saldo/ajustes', async (c) => {
    const a = await entrada(c, false);
    if ('resposta' in a) return a.resposta;
    const corpo = await lerCorpo(c, AjusteDeSaldo);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const conhecido = (await lerSaldo(dep.banco, a.u, hojeRecife(), a.escala?.id ?? null)).some((o) => o.militarId === d.militarId);
    if (!conhecido) return c.json({ erro: 'Este oficial não está no painel de saldo desta unidade.' }, 400);
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) =>
      tx.query("insert into oficiais_saldo (unidade_id, militar_id, tipo, valor, motivo, usuario_id) values ($1, $2, 'ajuste', $3, $4, $5)", [a.u, d.militarId, d.valor, d.motivo, c.get('usuarioId')]),
    );
    const lista = await lerSaldo(dep.banco, a.u, hojeRecife(), a.escala?.id ?? null);
    return c.json(lista.find((o) => o.militarId === d.militarId) as OficialNoSaldo, 201);
  });

  return r;
}

/** "Fora da ordem: a vez era de CAP FULANO." quando o Saldo vai para quem não é o da vez; a ordem é só uma sugestão, e o lançamento grava de qualquer jeito. */
async function avisoDeOrdem(tx: Consulta, rod: Rodada, linha: LinhaDoMes, militarId: string): Promise<string | undefined> {
  const { rows } = await tx.query<{ militar_id: string; cota: number; escolhidos: number; posto: string; nome_guerra: string }>(
    `select c.militar_id, c.cota, p.sigla as posto, m.nome_guerra,
            (select count(*)::int from alocacao a join turno t on t.id = a.turno_id
              where a.escala_id = $2 and a.militar_id = c.militar_id and a.data between $3::date and $4::date
                and a.servico_id is distinct from $5::uuid) as escolhidos
       from oficiais_cota c join militar m on m.id = c.militar_id join posto_grad p on p.id = m.posto_grad_id
      where c.mes_id = $1 order by c.ordem`,
    [linha.id, rod.escalaId, ...Object.values(limitesDoMes(rod.mes)), (await servicosDaRodada(tx, rod.escalaId)).jes?.id ?? null],
  );
  const vez = rows.find((x) => x.escolhidos < x.cota);
  if (!vez || vez.militar_id === militarId) return undefined;
  return `Fora da ordem: a vez era de ${postoCurto(vez.posto)} ${vez.nome_guerra}.`;
}
