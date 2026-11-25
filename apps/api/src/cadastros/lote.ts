// A atualização em lote do Pecúlio (6.52): a mesma mudança para vários militares, com prévia. Cada militar muda pelo mesmo caminho da ficha (a regra de "Alterar situação" de
// `alterar-situacao.ts` e o update dos campos simples do PATCH), então o lote não dá mais poder do que a ficha dá. `previa` não grava; `aplicar` refaz a conferência dentro da
// transação (com uma trava para quem aplica ao mesmo tempo), compara com a prévia e grava tudo ou nada.
import { createHash } from 'node:crypto';
import { AplicarLote, LoteDeMilitares, type AlteracaoDeSituacao, type PreviaDoLote, type ResultadoDoLote } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, papeisVigentes, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import {
  aplicarAlteracaoDeSituacao, conferirAlteracaoDeSituacao, donoDoPeculioDoMilitar, FRASE_CAMPO, papelDeCadastroNaUnidade, papelDeCadastroNoMilitar, RecusaDaAlteracao,
} from './alterar-situacao.ts';
import { quadroParaOPosto } from './quadros.ts';

const MSG_SEM_NIVEL = 'Você não tem nível de acesso sobre este militar.';
const MSG_LISTA_MUDOU = 'A lista mudou desde a prévia. Refaça a prévia.';
const MSG_SEM_DESDE = 'Informe o dia a partir do qual a mudança vale.';
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const nomeDaJornada = (j: string) => (j === 'pronto' ? 'Pronto' : 'ADM');

/** Uma recusa do lote inteiro (não de um militar): o status e a frase vão como estão para quem pediu. */
class RecusaDoLote extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, mensagem: string) {
    super(mensagem);
  }
}

/** Dentro de um cálculo só (que não grava), a mesma consulta repetida (o dono do Pecúlio da mesma unidade, a mesma equipe) vai ao banco uma vez. */
function comCache(c: Consulta): Consulta {
  const feitas = new Map<string, Promise<{ rows: unknown[] }>>();
  return {
    ...c,
    query: ((sql: string, params?: unknown[]) => {
      const chave = `${sql}\u0000${JSON.stringify(params ?? [])}`;
      if (!feitas.has(chave)) feitas.set(chave, c.query(sql, params));
      return feitas.get(chave)!;
    }) as Consulta['query'],
  };
}

type Mil = { id: string; posto: string; posto_grad_id: string; nome_guerra: string; matricula: string; voluntario_jes: boolean; funcao_militar_id: string | null; abono_permanencia: boolean; comportamento: string | null };
type Aberto = { militar_id: string; unidade_id: string; equipe_id: string | null; jornada: 'pronto' | 'adm'; quadro_id: string | null; situacao_id: string; desde: string };
type Simples = { voluntarioJes?: boolean; funcao?: { id: string | null }; abonoPermanencia?: boolean; comportamento?: string };
type Item = { id: string; rastreio?: AlteracaoDeSituacao; /** a unidade do período aberto que o cálculo viu */ unidadeAberta?: string; simples?: Simples };
type Calculo = { previa: PreviaDoLote; itens: Item[] };

const linhaDe = (m: Pick<Mil, 'id' | 'posto' | 'nome_guerra' | 'matricula'>) => ({ id: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, matricula: m.matricula });

/** Os nomes que a prévia mostra (unidade, quadro, situação, função), lidos uma vez. */
async function nomesDe(c: Consulta) {
  const mapa = async (sql: string) => new Map((await c.query<{ id: string; nome: string }>(sql)).rows.map((r) => [r.id, r.nome]));
  return {
    unidades: await mapa('select id, sigla as nome from unidade'),
    quadros: await mapa('select id, sigla as nome from quadro'),
    situacoes: await mapa('select id, nome from situacao_militar'),
    funcoes: await mapa('select id, nome from funcao_militar'),
  };
}

/** Quem muda, quem fica de fora e por quê, sem gravar. Lança `RecusaDoLote` para o que recusa o lote inteiro. */
async function calcular(c: Consulta, usuarioId: string, lote: LoteDeMilitares, hoje: string): Promise<Calculo> {
  if (!(await papeisVigentes(c, usuarioId, hoje)).length) throw new RecusaDoLote(403, 'Esta tela é dos auxiliares administrativos e gestores.');
  const k = lote.campos;
  const mexeNoRastreio = k.unidadeId !== undefined || k.equipe !== undefined || k.jornada !== undefined || k.quadroId !== undefined || k.situacaoId !== undefined;
  if (mexeNoRastreio && !lote.desde) throw new RecusaDoLote(400, MSG_SEM_DESDE);
  // o que vale para o lote inteiro: o destino é de quem aplica, e os valores escolhidos existem
  if (k.unidadeId) {
    const noDestino = await papelDeCadastroNaUnidade(c, usuarioId, k.unidadeId, hoje);
    if (noDestino) throw new RecusaDoLote(noDestino.status, noDestino.texto);
  }
  if (k.situacaoId) {
    const s = (await c.query<{ ativo: boolean }>('select ativo from situacao_militar where id = $1', [k.situacaoId])).rows[0];
    if (!s) throw new RecusaDoLote(400, 'Situação não encontrada.');
    if (!s.ativo) throw new RecusaDoLote(400, 'Esta situação está desativada.');
  }
  if (k.quadroId && !(await c.query('select 1 from quadro where id = $1', [k.quadroId])).rows.length) throw new RecusaDoLote(400, 'Quadro não encontrado.');
  if (k.funcaoMilitarId) {
    const f = (await c.query<{ ativo: boolean }>('select ativo from funcao_militar where id = $1', [k.funcaoMilitarId])).rows[0];
    if (!f) throw new RecusaDoLote(400, 'Escolha uma função da lista.');
    if (!f.ativo) throw new RecusaDoLote(400, 'Esta função está desativada.');
  }

  const ids = [...new Set(lote.militarIds)];
  const militares = (await c.query<Mil>(
    `select m.id, p.sigla as posto, m.posto_grad_id, m.nome_guerra, m.matricula, m.voluntario_jes, m.funcao_militar_id, m.abono_permanencia, m.comportamento
       from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[]) order by m.nome_guerra, m.matricula`,
    [ids],
  )).rows;
  const abertos = new Map((await c.query<Aberto>(
    "select militar_id, unidade_id, equipe_id, jornada, quadro_id, situacao_id, to_char(desde, 'YYYY-MM-DD') as desde from rastreio where militar_id = any($1::uuid[]) and ate is null", [ids],
  )).rows.map((a) => [a.militar_id, a]));
  const nomes = await nomesDe(c);

  const mudam: PreviaDoLote['mudam'] = [];
  const ficamDeFora: PreviaDoLote['ficamDeFora'] = [];
  const itens: Item[] = [];
  let chegamSemEquipe = 0;
  const achados = new Set(militares.map((m) => m.id));
  for (const id of ids) if (!achados.has(id)) ficamDeFora.push({ id, posto: '', nomeGuerra: 'Militar não encontrado', matricula: '', motivo: MSG_SEM_NIVEL });

  for (const m of militares) {
    const fora = (motivo: string) => void ficamDeFora.push({ ...linhaDe(m), motivo });
    if (await papelDeCadastroNoMilitar(c, usuarioId, m.id, hoje)) { fora(MSG_SEM_NIVEL); continue; }
    const aberto = abertos.get(m.id);
    const de: string[] = [];
    const para: string[] = [];
    const item: Item = { id: m.id };
    let semEquipe = false;

    if (mexeNoRastreio) {
      if (!aberto) { fora('Sem lotação em aberto.'); continue; }
      if (lote.desde! < aberto.desde) { fora(`A data é anterior à lotação atual dele (${dataBr(aberto.desde)}).`); continue; }
      const unidadeId = k.unidadeId ?? aberto.unidade_id;
      const mudaUnidade = unidadeId !== aberto.unidade_id;
      let equipeId: string | null = aberto.equipe_id;
      // o nome da equipe como está cadastrado ("Alfa"), mesmo que o lote tenha sido digitado "alfa"
      let equipeNova: string | null = null;
      if (k.equipe !== undefined) {
        if (k.equipe === null) equipeId = null;
        else {
          const e = (await c.query<{ id: string; nome: string }>('select id, nome from equipe where unidade_id = $1 and upper(nome) = upper($2)', [unidadeId, k.equipe])).rows[0];
          if (!e) { fora(`A equipe ${k.equipe} não existe em ${nomes.unidades.get(unidadeId) ?? 'a unidade'}.`); continue; }
          equipeId = e.id;
          equipeNova = e.nome;
        }
      } else if (mudaUnidade) {
        // lotação marcada sem equipe marcada: todos chegam sem equipe (decisão do usuário, 24/11/2026)
        equipeId = null;
        semEquipe = true;
      }
      const jornada = k.jornada ?? aberto.jornada;
      const quadroId = k.quadroId === undefined ? aberto.quadro_id : k.quadroId;
      const situacaoId = k.situacaoId ?? aberto.situacao_id;
      if (k.quadroId) {
        const q = await quadroParaOPosto(c, m.posto_grad_id, k.quadroId, aberto.quadro_id);
        if ('erro' in q) { fora(`O quadro ${nomes.quadros.get(k.quadroId) ?? ''} não serve ao posto dele.`); continue; }
      }
      const muda = { unidade: mudaUnidade, equipe: equipeId !== aberto.equipe_id, jornada: jornada !== aberto.jornada, quadro: quadroId !== aberto.quadro_id, situacao: situacaoId !== aberto.situacao_id };
      if (Object.values(muda).some(Boolean)) {
        const d: AlteracaoDeSituacao = { unidadeId, equipeId, jornada, desde: lote.desde!, ...(k.quadroId === undefined ? {} : { quadroId: k.quadroId }), ...(k.situacaoId === undefined ? {} : { situacaoId: k.situacaoId }) };
        const recusa = await conferirAlteracaoDeSituacao(c, usuarioId, m.id, d, hoje);
        if (recusa) { fora(recusa.codigo === 'sem_permissao' || recusa.codigo === 'nao_achou' ? MSG_SEM_NIVEL : recusa.texto); continue; }
        item.rastreio = d;
        item.unidadeAberta = aberto.unidade_id;
        if (muda.unidade) { de.push(`Lotação: ${nomes.unidades.get(aberto.unidade_id)}`); para.push(`Lotação: ${nomes.unidades.get(unidadeId)}`); }
        if (muda.equipe) { de.push(`Equipe: ${aberto.equipe_id ? ((await c.query<{ nome: string }>('select nome from equipe where id = $1', [aberto.equipe_id])).rows[0]?.nome ?? '—') : 'sem equipe'}`); para.push(`Equipe: ${equipeNova ?? 'sem equipe'}`); }
        if (muda.jornada) { de.push(`Jornada: ${nomeDaJornada(aberto.jornada)}`); para.push(`Jornada: ${nomeDaJornada(jornada)}`); }
        if (muda.quadro) { de.push(`Quadro: ${aberto.quadro_id ? nomes.quadros.get(aberto.quadro_id) : 'sem quadro'}`); para.push(`Quadro: ${quadroId ? nomes.quadros.get(quadroId) : 'sem quadro'}`); }
        if (muda.situacao) { de.push(`Situação: ${nomes.situacoes.get(aberto.situacao_id)}`); para.push(`Situação: ${nomes.situacoes.get(situacaoId)}`); }
      }
    }

    const simples: Simples = {};
    const sim = (b: boolean) => (b ? 'Sim' : 'Não');
    if (k.voluntarioJes !== undefined && k.voluntarioJes !== m.voluntario_jes) { simples.voluntarioJes = k.voluntarioJes; de.push(`Voluntário JES: ${sim(m.voluntario_jes)}`); para.push(`Voluntário JES: ${sim(k.voluntarioJes)}`); }
    if (k.funcaoMilitarId !== undefined && k.funcaoMilitarId !== m.funcao_militar_id) {
      simples.funcao = { id: k.funcaoMilitarId };
      de.push(`Função: ${m.funcao_militar_id ? nomes.funcoes.get(m.funcao_militar_id) : 'sem função'}`);
      para.push(`Função: ${k.funcaoMilitarId ? nomes.funcoes.get(k.funcaoMilitarId) : 'sem função'}`);
    }
    if (k.abonoPermanencia !== undefined && k.abonoPermanencia !== m.abono_permanencia) { simples.abonoPermanencia = k.abonoPermanencia; de.push(`Abono de permanência: ${sim(m.abono_permanencia)}`); para.push(`Abono de permanência: ${sim(k.abonoPermanencia)}`); }
    if (k.comportamento !== undefined && k.comportamento !== m.comportamento) { simples.comportamento = k.comportamento; de.push(`Comportamento: ${m.comportamento ?? '—'}`); para.push(`Comportamento: ${k.comportamento}`); }
    if (Object.keys(simples).length) {
      // os campos simples são do Pecúlio, como a lotação: quem tem nível de acesso acima da lotação os muda
      if (await donoDoPeculioDoMilitar(c, usuarioId, m.id, FRASE_CAMPO, hoje)) { fora(MSG_SEM_NIVEL); continue; }
      item.simples = simples;
    }
    if (!item.rastreio && !item.simples) { fora('Nada muda para este militar.'); continue; }
    if (semEquipe && item.rastreio) chegamSemEquipe++;
    itens.push(item);
    mudam.push({ ...linhaDe(m), de: de.join(' · '), para: para.join(' · ') });
  }
  const assinatura = createHash('sha256').update(JSON.stringify({ campos: k, desde: lote.desde ?? null, mudam: mudam.map((x) => [x.id, x.de, x.para]).sort() })).digest('hex');
  return { previa: { mudam, ficamDeFora, chegamSemEquipe, assinatura }, itens };
}

export function rotasDoLote(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/peculio/lote/*', exigirSessao(dep.banco, dep.auth));

  r.post('/peculio/lote/previa', async (c) => {
    const corpo = await lerCorpo(c, LoteDeMilitares);
    if (!corpo.ok) return corpo.resposta;
    try {
      return c.json((await calcular(comCache(dep.banco), c.get('usuarioId'), corpo.dados, hojeRecife())).previa);
    } catch (e) {
      if (e instanceof RecusaDoLote) return c.json({ erro: e.message }, e.status);
      throw e;
    }
  });

  r.post('/peculio/lote/aplicar', async (c) => {
    const corpo = await lerCorpo(c, AplicarLote);
    if (!corpo.ok) return corpo.resposta;
    const usuarioId = c.get('usuarioId');
    const { assinatura, ...lote } = corpo.dados;
    try {
      const resultado = await comUsuario(dep.banco, usuarioId, async (tx): Promise<ResultadoDoLote> => {
        // dois "Aplicar" ao mesmo tempo (clique duplo, duas pessoas) esperam um pelo outro: o segundo refaz a conferência já com o que o primeiro gravou, e a prévia dele deixa de valer
        await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['peculio-lote']);
        // as linhas que o lote vai ler e gravar ficam travadas ANTES do cálculo: uma alteração pela ficha enquanto o lote roda espera, em vez de ser desfeita pelo que o lote leu antes dela
        const ids = [...new Set(lote.militarIds)];
        await tx.query('select id from militar where id = any($1::uuid[]) order by id for update', [ids]);
        await tx.query('select id from rastreio where militar_id = any($1::uuid[]) and ate is null order by id for update', [ids]);
        const calculo = await calcular(comCache(tx), usuarioId, lote, hojeRecife());
        if (calculo.previa.assinatura !== assinatura) throw new RecusaDoLote(409, MSG_LISTA_MUDOU);
        for (const it of calculo.itens) {
          if (it.rastreio) await aplicarAlteracaoDeSituacao(tx, usuarioId, it.id, it.rastreio, it.unidadeAberta);
          if (it.simples) {
            const s = it.simples;
            await tx.query(
              `update militar set voluntario_jes = case when $2::boolean is null then voluntario_jes else $2::boolean end,
                      funcao_militar_id = case when $3::boolean then $4::uuid else funcao_militar_id end,
                      abono_permanencia = case when $5::boolean is null then abono_permanencia else $5::boolean end,
                      comportamento = coalesce($6::text, comportamento)
                where id = $1`,
              [it.id, s.voluntarioJes ?? null, s.funcao !== undefined, s.funcao?.id ?? null, s.abonoPermanencia ?? null, s.comportamento ?? null],
            );
          }
        }
        return { mudaram: calculo.itens.length, ficaramDeFora: calculo.previa.ficamDeFora };
      });
      return c.json(resultado);
    } catch (e) {
      if (e instanceof RecusaDoLote) return c.json({ erro: e.message }, e.status);
      // algo mudou entre a conferência e a gravação (outra alteração no período aberto): a lista da prévia deixou de valer
      if (e instanceof RecusaDaAlteracao) return c.json({ erro: MSG_LISTA_MUDOU }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  return r;
}
