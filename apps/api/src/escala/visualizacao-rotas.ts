// A visualização de escalas para a corporação (fases 7.3 e 7.3.1): a lista do mês, a escala em leitura, o registro das alterações no passado e a escala do próprio militar. Quem vê cada
// estado está em `visibilidade.ts`; não toca nas camadas de visão da "escala em montagem": o rascunho continua só de quem já via.
import { LIMITE_DE_PROXIMOS, Mes, mesParaData, type EscalaDoMes, type EscalaVisivel, type MeuServico, type MinhaEscala, type ProximosServicos } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { agoraRecife, hojeRecife, somarDias } from '../datas.ts';
import { lerRegistro } from '../registro.ts';
import { montarEscalaDoMes } from './leitura.ts';
import { podeVerEscala, visibilidadeDoMes } from './visibilidade.ts';

const MES_INVALIDO = 'Mês inválido: use o formato aaaa-mm.';
const NAO_ABERTA = 'Esta escala não está aberta para você.';

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

const MSG_NAO_E_MILITAR = 'Esta conta não é de um militar.';

type LinhaDoServico = {
  id: string; data: string; inicio: string; fim: string; servico: string; cor: string; turno: MeuServico['turno']; escala: string; sigla: string; unidade_id: string; escala_id: string; turno_id: string;
  guarnicao_id: string | null; guarnicao: string | null; funcao: string | null; estado: MeuServico['estado']; em_retificacao: boolean;
};

/** As colunas dos serviços do militar e o que se junta a elas (as mesmas para a escala do mês e para os próximos serviços); quem chama põe o `where` e a ordem. */
const SERVICOS_DO_MILITAR = `select a.id, to_char(a.data, 'YYYY-MM-DD') as data, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, s.nome as servico, s.cor, t.letra as turno, e.nome as escala, u.sigla, u.id as unidade_id,
              a.escala_id, a.turno_id, a.guarnicao_id, g.nome as guarnicao, f.nome as funcao, k.estado, k.em_retificacao
         from alocacao a join escala e on e.id = a.escala_id
         join escala_estado k on k.escala_id = a.escala_id and k.mes = date_trunc('month', a.data)::date
         join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id join unidade u on u.id = e.unidade_id
         left join guarnicao g on g.id = a.guarnicao_id left join funcao f on f.id = a.funcao_id`;

const minutosDe = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/** O serviço já acabou em `agora`? O fim é o dia mais a hora do fim; quando o fim não é depois do início (o turno que vira o dia, ou termina à meia-noite), é no dia seguinte. */
function jaAcabou(x: { data: string; inicio: string; fim: string }, agora: { dia: string; minutos: number }): boolean {
  const fimNoDiaSeguinte = minutosDe(x.fim) <= minutosDe(x.inicio);
  const diaDoFim = fimNoDiaSeguinte ? somarDias(x.data, 1) : x.data;
  return diaDoFim < agora.dia || (diaDoFim === agora.dia && minutosDe(x.fim) <= agora.minutos);
}

/** O militar da conta, ou null (a conta não é de um militar). */
async function militarDaConta(banco: Banco, usuarioId: string): Promise<string | null> {
  return (await banco.query<{ militar_id: string }>('select militar_id from usuario where id = $1 and ativo', [usuarioId])).rows[0]?.militar_id ?? null;
}

/** Cada linha como serviço do militar, com quem compõe a guarnição daquele turno. */
async function comComposicao(banco: Banco, militarId: string, rows: LinhaDoServico[]): Promise<MeuServico[]> {
  const servicos: MeuServico[] = [];
  for (const x of rows) {
    const composicao = x.guarnicao_id
      ? (
          await banco.query<{ patente: string; nome_guerra: string; funcao: string | null; militar_id: string }>(
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
    servicos.push({ alocacaoId: x.id, data: x.data, inicio: x.inicio, fim: x.fim, servico: x.servico, cor: x.cor, turno: x.turno, escala: x.escala, unidadeSigla: x.sigla, unidadeId: x.unidade_id, estado: x.estado, emRetificacao: x.em_retificacao, guarnicao: x.guarnicao, funcao: x.funcao, composicao });
  }
  return servicos;
}

/** `agora`: o relógio (os testes o trocam). */
export function rotasVisualizacao(dep: { banco: Banco; auth: Auth; agora?: () => Date }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/visualizacao/*', '/eu/escala/*', '/eu/proximos-servicos', '/escalas/:id/mes/:mes/registro']) r.use(caminho, sessao);

  /** As escalas que a conta pode ver no mês (as que já saíram do rascunho e que a regra de `visibilidade.ts` abre para ela), de todas as unidades que não foram extintas. */
  r.get('/visualizacao/escalas/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const { rows } = await dep.banco.query<{ id: string; nome: string; unidade_id: string; sigla: string; estado: EscalaVisivel['estado']; em_retificacao: boolean; em: string; oficiais: boolean }>(
      `select e.id, e.nome, e.unidade_id, u.sigla, k.estado, k.em_retificacao, to_char(k.mudou_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as em, (e.distribuicao <> 'pre_escala') as oficiais
         from escala_estado k join escala e on e.id = k.escala_id join unidade u on u.id = e.unidade_id
        where k.mes = $1::date and (u.ate is null or u.ate >= $2::date)
        order by u.sigla, e.nome`,
      [mesParaData(mes), hojeRecife()],
    );
    const pode = visibilidadeDoMes(dep.banco, c.get('usuarioId'), mes);
    const lista: EscalaVisivel[] = [];
    for (const x of rows) {
      if (await pode({ id: x.id, unidadeId: x.unidade_id, dosOficiais: x.oficiais, estado: x.estado })) {
        lista.push({ escalaId: x.id, nome: x.nome, unidadeId: x.unidade_id, unidadeSigla: x.sigla, mes, estado: x.estado, emRetificacao: x.em_retificacao, em: x.em, dosOficiais: x.oficiais });
      }
    }
    return c.json(lista);
  });

  /** A escala do mês só para leitura; 404 se ela não está aberta para a conta (rascunho, ou prévia fora do alcance). */
  r.get('/visualizacao/escalas/:id/mes/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    if (!(await unidadeDoRegistro(dep.banco, 'escala', id))) return c.json({ erro: 'Escala não encontrada.' }, 404);
    if (!(await podeVerEscala(dep.banco, c.get('usuarioId'), id, mes))) return c.json({ erro: NAO_ABERTA }, 404);
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

  /** Os serviços do militar da conta nas escalas do mês que não são rascunho, em ordem de dia e hora, com quem compõe a guarnição de cada um. */
  r.get('/eu/escala/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const militarId = await militarDaConta(dep.banco, c.get('usuarioId'));
    if (!militarId) return c.json({ erro: MSG_NAO_E_MILITAR }, 404);
    const { rows } = await dep.banco.query<LinhaDoServico>(
      `${SERVICOS_DO_MILITAR}
        where a.militar_id = $1 and a.data >= $2::date and a.data < ($2::date + interval '1 month')
        order by a.data, t.inicio, s.nome`,
      [militarId, mesParaData(mes)],
    );
    const minha: MinhaEscala = { mes, servicos: await comComposicao(dep.banco, militarId, rows) };
    return c.json(minha);
  });

  /** Os próximos serviços do militar da conta (6.55): os que ainda não acabaram em Recife (o em andamento conta), nas mesmas escalas da Minha escala, em ordem de data e início, até `LIMITE_DE_PROXIMOS`, atravessando o mês. */
  r.get('/eu/proximos-servicos', async (c) => {
    const militarId = await militarDaConta(dep.banco, c.get('usuarioId'));
    if (!militarId) return c.json({ erro: MSG_NAO_E_MILITAR }, 404);
    const agora = agoraRecife(dep.agora?.());
    // o que já acabou só pode estar entre ontem (o turno que vira o dia) e hoje: o limite do SQL sobra para os dois dias, e o corte final é feito aqui
    const { rows } = await dep.banco.query<LinhaDoServico>(
      `${SERVICOS_DO_MILITAR}
        where a.militar_id = $1 and a.data >= $2::date
        order by a.data, t.inicio, s.nome
        limit 40`,
      [militarId, somarDias(agora.dia, -1)],
    );
    const proximos = rows.filter((x) => !jaAcabou(x, agora)).slice(0, LIMITE_DE_PROXIMOS);
    const resposta: ProximosServicos = { servicos: await comComposicao(dep.banco, militarId, proximos) };
    return c.json(resposta);
  });

  return r;
}
