// As prévias lançadas, para a corporação (fase 7.3): a lista do mês, a escala em leitura, o registro das alterações no passado e a escala do próprio militar.
// Não toca nas camadas de visão da "escala em montagem": o que não foi lançado continua só de quem já via.
import { Mes, mesParaData, type EscalaDoMes, type MeuServico, type MinhaEscala, type PreviaDaLista } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerRegistro } from '../registro.ts';
import { montarEscalaDoMes } from './leitura.ts';
import { previaLancada } from './previa.ts';

const MES_INVALIDO = 'Mês inválido: use o formato aaaa-mm.';
const SEM_PREVIA = 'Esta escala ainda não tem prévia lançada.';

/** A escala como a corporação a vê: só quem está onde, sem a matrícula, a cota de saldo, as remoções nem o que falta para a montagem (esses vêm vazios). */
function paraACorporacao(e: EscalaDoMes): EscalaDoMes {
  const sem = <T extends { matricula: string; saldos?: unknown }>(o: T): T => {
    const { saldos: _saldos, ...resto } = o;
    return { ...resto, matricula: '' } as T;
  };
  return {
    ...e,
    podeAlterarPassado: false,
    resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 },
    dias: e.dias.map((d) => ({
      ...d,
      obrigatoriasVazias: 0,
      faixas: d.faixas.map((f) => ({
        ...f,
        removidos: [],
        semPosto: f.semPosto.map(sem),
        guarnicoes: f.guarnicoes.map((g) => ({ ...g, completa: true, faltam: [], funcoes: g.funcoes.map((fn) => ({ ...fn, ocupantes: fn.ocupantes.map(sem) })) })),
      })),
    })),
  };
}

export function rotasPrevias(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/previas/*', '/eu/escala/*', '/escalas/:id/mes/:mes/registro']) r.use(caminho, sessao);

  /** As escalas com a prévia lançada no mês, de todas as unidades que não foram extintas. */
  r.get('/previas/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const { rows } = await dep.banco.query<{ id: string; nome: string; unidade_id: string; sigla: string; em: string; oficiais: boolean }>(
      `select e.id, e.nome, e.unidade_id, u.sigla, to_char(k.lancada_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as em, (e.distribuicao <> 'pre_escala') as oficiais
         from escala_previa k join escala e on e.id = k.escala_id join unidade u on u.id = e.unidade_id
        where k.mes = $1::date and (u.ate is null or u.ate >= $2::date)
        order by u.sigla, e.nome`,
      [mesParaData(mes), hojeRecife()],
    );
    const lista: PreviaDaLista[] = rows.map((x) => ({ escalaId: x.id, nome: x.nome, unidadeId: x.unidade_id, unidadeSigla: x.sigla, mes, lancadaEm: x.em, dosOficiais: x.oficiais }));
    return c.json(lista);
  });

  /** A escala do mês só para leitura; 404 se a prévia não foi lançada. */
  r.get('/previas/escalas/:id/mes/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    if (!(await unidadeDoRegistro(dep.banco, 'escala', id))) return c.json({ erro: 'Escala não encontrada.' }, 404);
    if (!(await previaLancada(dep.banco, id, mes))) return c.json({ erro: SEM_PREVIA }, 404);
    return c.json(paraACorporacao(await montarEscalaDoMes(dep.banco, id, mes)));
  });

  /** As alterações no passado da escala no mês, da mais nova para a mais velha: de quem lê a escala da unidade (nível de acesso nela ou acima, ou a camada de visão da escala em montagem); o militar comum não lê. */
  r.get('/escalas/:id/mes/:mes/registro', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirLeituraDaEscala(c, unidadeId);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    return c.json(await lerRegistro(dep.banco, { escalaId: id, mes, tipo: 'escala_no_passado' }));
  });

  /** Os serviços do militar da conta nas prévias lançadas do mês, em ordem de dia e hora, com quem compõe a guarnição de cada um. */
  r.get('/eu/escala/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const militarId = (await dep.banco.query<{ militar_id: string }>('select militar_id from usuario where id = $1 and ativo', [c.get('usuarioId')])).rows[0]?.militar_id;
    if (!militarId) return c.json({ erro: 'Esta conta não é de um militar.' }, 404);
    const inicio = mesParaData(mes);
    const { rows } = await dep.banco.query<{
      id: string; data: string; inicio: string; fim: string; servico: string; escala: string; sigla: string; escala_id: string; turno_id: string; guarnicao_id: string | null; guarnicao: string | null; funcao: string | null;
    }>(
      `select a.id, to_char(a.data, 'YYYY-MM-DD') as data, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, s.nome as servico, e.nome as escala, u.sigla,
              a.escala_id, a.turno_id, a.guarnicao_id, g.nome as guarnicao, f.nome as funcao
         from alocacao a join escala e on e.id = a.escala_id
         join escala_previa k on k.escala_id = a.escala_id and k.mes = $2::date
         join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id join unidade u on u.id = e.unidade_id
         left join guarnicao g on g.id = a.guarnicao_id left join funcao f on f.id = a.funcao_id
        where a.militar_id = $1 and a.data >= $2::date and a.data < ($2::date + interval '1 month')
        order by a.data, t.inicio, s.nome`,
      [militarId, inicio],
    );
    const servicos: MeuServico[] = [];
    for (const x of rows) {
      const composicao = x.guarnicao_id
        ? (
            await dep.banco.query<{ patente: string; nome_guerra: string; funcao: string | null; militar_id: string }>(
              `select * from (
                 select p.sigla as patente, m.nome_guerra, f.nome as funcao, m.id as militar_id
                   from alocacao a join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id left join funcao f on f.id = a.funcao_id
                  where a.escala_id = $1 and a.data = $2::date and a.turno_id = $3 and a.guarnicao_id = $4
                 union all
                 select p.sigla, m.nome_guerra, f.nome, m.id
                   from alocacao_acumulo y join alocacao a on a.id = y.alocacao_id join militar m on m.id = a.militar_id join posto_grad p on p.id = m.posto_grad_id left join funcao f on f.id = y.funcao_id
                  where a.escala_id = $1 and a.data = $2::date and a.turno_id = $3 and y.guarnicao_id = $4
               ) todos order by nome_guerra, funcao`,
              [x.escala_id, x.data, x.turno_id, x.guarnicao_id],
            )
          ).rows.map((o) => ({ patente: o.patente, nomeGuerra: o.nome_guerra, funcao: o.funcao, eu: o.militar_id === militarId }))
        : [];
      servicos.push({ alocacaoId: x.id, data: x.data, inicio: x.inicio, fim: x.fim, servico: x.servico, escala: x.escala, unidadeSigla: x.sigla, guarnicao: x.guarnicao, funcao: x.funcao, composicao });
    }
    const minha: MinhaEscala = { mes, servicos };
    return c.json(minha);
  });

  return r;
}
