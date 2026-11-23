// Rotas da escala dos oficiais (QOC e QOA) e do painel de saldo. Só gestor e administrador da unidade.
import { AjusteDeSaldo, OrdemManual, Participantes, ServicoDoMes, TrocaDeTurno, type OficialNoSaldo } from 'contratos';
import { Mes } from 'contratos';
import { calcularCotas, diasDoMes, ordemDeEscolha, rotuloDoTurno, saldoDeEntrada, saldoDoMes, type TurnoDoMes } from 'dominio';
import { Hono, type Context } from 'hono';
import { GESTAO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { lerEscala, lerSaldo, linhaDoMes, servicoDoUltimoMes, turnosDoServico } from './leitura.ts';
import { copiarMarcasDoMesAnterior, elegiveisDoMes, limitesDoMes, marcasDoMes, postoCurto } from './participantes.ts';

type Ctx = Context<AmbienteApi>;

const MSG_ENCERRADO = 'O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.';
const MSG_COTA_FECHADA = 'Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.';
const MSG_SEM_COTAS = 'Calcule as cotas antes de fechar a escala.';
const MSG_ENCERRAR_ANTES_DE_FECHAR = 'Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.';
const MSG_SEM_SERVICO = 'Escolha o serviço da escala antes de calcular as cotas.';
const MSG_SERVICO_INVALIDO = 'Escolha um serviço da unidade com turnos cadastrados.';
const MSG_SERVICO_TRAVADO = 'Com as cotas calculadas, o serviço não muda mais.';
const MSG_TURNO_ALHEIO = 'Este turno não é do serviço da escala.';
const MSG_TURNO_FORA_DO_MES = 'Este turno não faz parte da escala deste mês.';
const MSG_FORA_DA_ESCALA = 'Este oficial não está na escala deste mês.';
const MSG_SEM_PARTICIPANTES = 'Marque quem participa da rodada antes de calcular as cotas.';
const MSG_NAO_ELEGIVEL = 'Este oficial não é elegível neste mês.';
const MSG_PARTICIPANTES_FECHADOS = 'Com a escala fechada, os participantes não mudam mais.';

class Recusa extends Error {
  constructor(readonly status: 400 | 409, mensagem: string) {
    super(mensagem);
  }
}

/** O serviço é da unidade, ordinário, ativo e tem turno? */
async function servicoValido(tx: Consulta, servicoId: string, unidadeId: string): Promise<boolean> {
  const { rows } = await tx.query(
    `select 1 from servico s where s.id = $1 and s.unidade_id = $2 and s.tipo = 'ordinario' and s.ativo
        and exists (select 1 from turno t where t.servico_id = s.id)`, [servicoId, unidadeId]);
  return rows.length > 0;
}

/** Garante a linha do mês; ao criá-la, o serviço vem copiado do último mês da unidade, e as marcas de quem participa, do mês anterior. */
async function garantirMes(tx: Consulta, unidadeId: string, mes: string): Promise<void> {
  const { rows } = await tx.query<{ id: string }>(
    'insert into oficiais_mes (unidade_id, mes, servico_id) values ($1, $2::date, $3) on conflict (unidade_id, mes) do nothing returning id',
    [unidadeId, `${mes}-01`, await servicoDoUltimoMes(tx, unidadeId)],
  );
  if (rows[0]) await copiarMarcasDoMesAnterior(tx, unidadeId, mes, rows[0].id);
}

/**
 * Cria o mês (e os turnos vazios) na primeira vez, recalcula a ordem, os dias e as cotas dos participantes e regrava `oficiais_cota`. Mantém as
 * escolhas de quem continua; as de quem saiu da rodada são retiradas, e a resposta traz uma frase para cada um ("2 turnos de CAP X ficaram sem ninguém.").
 */
async function calcularEGravar(tx: Consulta, unidadeId: string, mes: string, ordemManual?: string[]): Promise<string[]> {
  await garantirMes(tx, unidadeId, mes);
  const linha = (await linhaDoMes(tx, unidadeId, mes, true))!;
  if (linha.fechada_em) throw new Recusa(409, MSG_COTA_FECHADA);
  if (!linha.servico_id) throw new Recusa(409, MSG_SEM_SERVICO);
  // o serviço copiado do mês anterior pode ter sido desativado: confere na primeira vez (depois das cotas ele já não muda)
  if (!linha.cotas_em && !(await servicoValido(tx, linha.servico_id, unidadeId))) throw new Recusa(409, MSG_SERVICO_INVALIDO);
  const turnosDoMes = await turnosDoServico(tx, linha.servico_id);
  const manual = ordemManual ?? linha.ordem_manual;
  const elegiveis = await elegiveisDoMes(tx, unidadeId, mes);
  const { marcados } = await marcasDoMes(tx, unidadeId, mes, linha.id);
  const participantes = elegiveis.filter((p) => marcados.has(p.militarId));
  if (elegiveis.length > 0 && participantes.length === 0) throw new Recusa(409, MSG_SEM_PARTICIPANTES);
  const ordem = ordemDeEscolha(participantes, manual);
  const porId = new Map(participantes.map((p) => [p.militarId, p]));
  const cotas = calcularCotas(turnosDoMes.length * diasDoMes(mes).length, ordem.map((id) => ({ militarId: id, dias: porId.get(id)!.dias })));

  await tx.query('delete from oficiais_cota where mes_id = $1', [linha.id]);
  for (const [i, x] of cotas.entries()) {
    await tx.query(
      'insert into oficiais_cota (mes_id, militar_id, ordem, dias, devido, cota, sobra) values ($1, $2, $3, $4, $5, $6, $7)',
      [linha.id, x.militarId, i + 1, x.dias, x.devido, x.cota, x.sobra],
    );
  }
  // quem saiu da rodada (desmarcado, desativado, outro quadro, outra unidade) não pode ficar com turnos: o devido dos outros contaria turnos sem dono de saldo
  const { rows: soltos } = await tx.query<{ n: number; posto: string; nome_guerra: string }>(
    `select count(*)::int as n, p.sigla as posto, m.nome_guerra
       from oficiais_turno t join militar m on m.id = t.militar_id join posto_grad p on p.id = m.posto_grad_id
      where t.mes_id = $1 and not (t.militar_id = any($2::uuid[]))
      group by m.id, p.sigla, p.ordem, m.nome_guerra order by p.ordem desc, m.nome_guerra`,
    [linha.id, cotas.map((x) => x.militarId)],
  );
  const liberados = soltos.map((x) => `${x.n} ${x.n === 1 ? 'turno' : 'turnos'} de ${postoCurto(x.posto)} ${x.nome_guerra} ${x.n === 1 ? 'ficou' : 'ficaram'} sem ninguém.`);
  await tx.query(
    'update oficiais_turno set militar_id = null, saiu_militar_id = null where mes_id = $1 and militar_id is not null and not (militar_id = any($2::uuid[]))',
    [linha.id, cotas.map((x) => x.militarId)],
  );
  const { inicio, fim } = limitesDoMes(mes);
  await tx.query(
    `insert into oficiais_turno (mes_id, dia, turno_id)
       select $1, d::date, t from generate_series($2::date, $3::date, '1 day') d, unnest($4::uuid[]) t
     on conflict (mes_id, dia, turno_id) do nothing`,
    [linha.id, inicio, fim, turnosDoMes.map((t) => t.id)],
  );
  await tx.query('update oficiais_mes set cotas_em = now(), ordem_manual = $2::uuid[] where id = $1', [linha.id, manual]);
  return liberados;
}

async function turnosDoMes(c: Consulta, mesId: string): Promise<TurnoDoMes[]> {
  const { rows } = await c.query<{ dia: string; turno_id: string; militar_id: string | null; saiu_militar_id: string | null }>(
    "select to_char(dia, 'YYYY-MM-DD') as dia, turno_id, militar_id, saiu_militar_id from oficiais_turno where mes_id = $1", [mesId]);
  return rows.map((r) => ({ dia: r.dia, turnoId: r.turno_id, militarId: r.militar_id, saiuMilitarId: r.saiu_militar_id }));
}

export function rotasOficiais(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  r.use('/unidades/:u/oficiais/*', sessao);
  r.use('/unidades/:u/oficiais-saldo', sessao);
  r.use('/unidades/:u/oficiais-saldo/*', sessao);

  /** Papel de gestor ou administrador na unidade e o mês válido; devolve a resposta de recusa, se houver. */
  async function entrada(c: Ctx, comMes = true): Promise<{ resposta: Response } | { u: string; mes: string }> {
    const u = c.req.param('u')!;
    const negado = await exigirPapel(c, u, GESTAO);
    if (negado) return { resposta: negado };
    const mes = comMes ? c.req.param('mes')! : '';
    if (comMes && !Mes.safeParse(mes).success) return { resposta: c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400) };
    return { u, mes };
  }

  /** Roda a mudança numa transação e devolve a escala do mês, com os avisos de turnos que ficaram sem ninguém; uma `Recusa` vira 400 ou 409 com a mensagem. */
  async function mudar(c: Ctx, u: string, mes: string, fn: (tx: Consulta) => Promise<string[] | void>): Promise<Response> {
    try {
      const escala = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const liberados = (await fn(tx)) ?? [];
        return { ...(await lerEscala(tx, u, mes)), liberados };
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
    return c.json(await lerEscala(dep.banco, a.u, a.mes));
  });

  r.put('/unidades/:u/oficiais/:mes/servico', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const corpo = await lerCorpo(c, ServicoDoMes);
    if (!corpo.ok) return corpo.resposta;
    const { servicoId } = corpo.dados;
    return mudar(c, a.u, a.mes, async (tx) => {
      if (!(await servicoValido(tx, servicoId, a.u))) throw new Recusa(400, MSG_SERVICO_INVALIDO);
      await garantirMes(tx, a.u, a.mes);
      const linha = (await linhaDoMes(tx, a.u, a.mes, true))!;
      if (linha.cotas_em) throw new Recusa(409, MSG_SERVICO_TRAVADO);
      await tx.query('update oficiais_mes set servico_id = $2 where id = $1', [linha.id, servicoId]);
    });
  });

  r.post('/unidades/:u/oficiais/:mes/cotas', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    return mudar(c, a.u, a.mes, (tx) => calcularEGravar(tx, a.u, a.mes));
  });

  r.put('/unidades/:u/oficiais/:mes/ordem', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const corpo = await lerCorpo(c, OrdemManual);
    if (!corpo.ok) return corpo.resposta;
    return mudar(c, a.u, a.mes, (tx) => calcularEGravar(tx, a.u, a.mes, corpo.dados.militarIds));
  });

  r.put('/unidades/:u/oficiais/:mes/participantes', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const corpo = await lerCorpo(c, Participantes);
    if (!corpo.ok) return corpo.resposta;
    const marcar = [...new Set(corpo.dados.militarIds)];
    return mudar(c, a.u, a.mes, async (tx) => {
      const elegiveis = new Set((await elegiveisDoMes(tx, a.u, a.mes)).map((p) => p.militarId));
      await garantirMes(tx, a.u, a.mes);
      const linha = (await linhaDoMes(tx, a.u, a.mes, true))!;
      if (linha.fechada_em) throw new Recusa(409, MSG_PARTICIPANTES_FECHADOS);
      // quem já estava na rodada (marcado ou com cota) e deixou de ser elegível pode vir na lista da tela: ele só sai da rodada.
      // Quem nunca esteve nela e não é elegível é recusado.
      const naRodada = new Set([
        ...(await marcasDoMes(tx, a.u, a.mes, linha.id)).marcados,
        ...(await tx.query<{ militar_id: string }>('select militar_id from oficiais_cota where mes_id = $1', [linha.id])).rows.map((r) => r.militar_id),
      ]);
      if (marcar.some((id) => !elegiveis.has(id) && !naRodada.has(id))) throw new Recusa(400, MSG_NAO_ELEGIVEL);
      const ficam = marcar.filter((id) => elegiveis.has(id));
      await tx.query('delete from oficiais_participante where mes_id = $1 and not (militar_id = any($2::uuid[]))', [linha.id, ficam]);
      await tx.query('insert into oficiais_participante (mes_id, militar_id) select $1, unnest($2::uuid[]) on conflict do nothing', [linha.id, ficam]);
      // com as cotas já calculadas, mudar quem participa refaz as cotas (as escolhas de quem continua ficam)
      if (linha.cotas_em) return calcularEGravar(tx, a.u, a.mes);
    });
  });

  r.put('/unidades/:u/oficiais/:mes/turnos/:dia/:turnoId', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    const dia = c.req.param('dia')!;
    const turno = c.req.param('turnoId')!;
    if (!diasDoMes(a.mes).includes(dia)) return c.json({ erro: 'Este dia não é do mês escolhido.' }, 400);
    const corpo = await lerCorpo(c, TrocaDeTurno);
    if (!corpo.ok) return corpo.resposta;
    const novo = corpo.dados.militarId;
    return mudar(c, a.u, a.mes, async (tx) => {
      const linha = await linhaDoMes(tx, a.u, a.mes, true);
      if (!linha || !linha.cotas_em) throw new Recusa(409, 'Calcule as cotas antes de lançar os turnos.');
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      const doServico = await turnosDoServico(tx, linha.servico_id);
      if (!doServico.some((t) => t.id === turno)) throw new Recusa(400, MSG_TURNO_ALHEIO);
      if (novo) {
        const { rows } = await tx.query('select 1 from oficiais_cota where mes_id = $1 and militar_id = $2', [linha.id, novo]);
        if (rows.length === 0) throw new Recusa(400, MSG_FORA_DA_ESCALA);
      }
      const atual = (await tx.query<{ militar_id: string | null; saiu_militar_id: string | null }>(
        'select militar_id, saiu_militar_id from oficiais_turno where mes_id = $1 and dia = $2::date and turno_id = $3 for update', [linha.id, dia, turno])).rows[0];
      // turno cadastrado no serviço depois do cálculo, ou dia fora do mês gravado: não existe na escala
      if (!atual) throw new Recusa(400, MSG_TURNO_FORA_DO_MES);
      let militar: string | null = novo;
      let saiu: string | null = null;
      if (linha.fechada_em && novo) {
        // cobertura: quem saiu conta como tirado, e quem cobriu também; voltar ao nome original desfaz a cobertura
        const original = atual.saiu_militar_id ?? atual.militar_id;
        saiu = original && original !== novo ? original : null;
      }
      await tx.query('update oficiais_turno set militar_id = $4, saiu_militar_id = $5 where mes_id = $1 and dia = $2::date and turno_id = $3', [linha.id, dia, turno, militar, saiu]);
    });
  });

  r.post('/unidades/:u/oficiais/:mes/fechar', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    return mudar(c, a.u, a.mes, async (tx) => {
      const linha = await linhaDoMes(tx, a.u, a.mes, true);
      if (!linha || !linha.cotas_em) throw new Recusa(409, MSG_SEM_COTAS);
      if (linha.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (!linha.fechada_em) await tx.query('update oficiais_mes set fechada_em = now() where id = $1', [linha.id]);
    });
  });

  r.post('/unidades/:u/oficiais/:mes/encerrar', async (c) => {
    const a = await entrada(c);
    if ('resposta' in a) return a.resposta;
    return mudar(c, a.u, a.mes, async (tx) => {
      const linha = await linhaDoMes(tx, a.u, a.mes, true);
      if (linha?.encerrada_em) throw new Recusa(409, MSG_ENCERRADO);
      if (!linha || !linha.fechada_em) throw new Recusa(409, MSG_ENCERRAR_ANTES_DE_FECHAR);
      const cotas = (await tx.query<{ militar_id: string; dias: number }>('select militar_id, dias from oficiais_cota where mes_id = $1 order by ordem', [linha.id])).rows
        .map((x) => ({ militarId: x.militar_id, dias: x.dias }));
      const saldos = saldoDoMes(await turnosDoMes(tx, linha.id), cotas);

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
      const rotulos = new Map((await turnosDoServico(tx, linha.servico_id)).map((t) => [t.id, rotuloDoTurno(t.inicio)] as const));
      for (const s of saldos) {
        let dia = 0;
        let noite = 0;
        for (const [turnoId, n] of Object.entries(s.porTurno)) {
          if (rotulos.get(turnoId) === 'Noite') noite += n;
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
    return c.json(await lerSaldo(dep.banco, a.u));
  });

  r.post('/unidades/:u/oficiais-saldo/ajustes', async (c) => {
    const a = await entrada(c, false);
    if ('resposta' in a) return a.resposta;
    const corpo = await lerCorpo(c, AjusteDeSaldo);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const conhecido = (await lerSaldo(dep.banco, a.u)).some((o) => o.militarId === d.militarId);
    if (!conhecido) return c.json({ erro: 'Este oficial não está no painel de saldo desta unidade.' }, 400);
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) =>
      tx.query("insert into oficiais_saldo (unidade_id, militar_id, tipo, valor, motivo, usuario_id) values ($1, $2, 'ajuste', $3, $4, $5)", [a.u, d.militarId, d.valor, d.motivo, c.get('usuarioId')]),
    );
    const lista = await lerSaldo(dep.banco, a.u, hojeRecife());
    return c.json(lista.find((o) => o.militarId === d.militarId) as OficialNoSaldo, 201);
  });

  return r;
}
