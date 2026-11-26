import type { FichaMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { MSG_JA_VALE, MSG_UNICO_REGISTRO } from '../src/cadastros/mudanca-do-rastreio.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';

// Cancelar e editar um período do histórico de rastreio (a mudança marcada para depois; na fase de testes, o administrador mexe em qualquer um). Dados fictícios (D7).
// 1ª SB e 2ª SB são seções do 2º GB: o gestor do 2º GB é o dono do Pecúlio dos militares delas; o escalante da 1ª SB só vê.
let api: ApiDeTeste;
let sb2: string;
let equipeSb1: string;
let equipeSb2: string;
let desativada: string;
let seq = 0;
const hoje = hojeRecife();
const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const brasil = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

type P = { desde: string; ate: string | null; unidade?: string; equipe?: string | null; jornada?: 'pronto' | 'adm' };
/** Um militar com os períodos dados (a unidade padrão é a 1ª SB); devolve o id e os ids dos períodos, do mais velho ao mais novo. */
async function militar(periodos: P[]) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `99${String(7100 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: `MUDA${seq}`, nome_completo: `Fulano ${seq}` });
  const ids: string[] = [];
  for (const p of periodos) {
    ids.push(await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: p.unidade ?? api.ids.secao, equipe_id: p.equipe ?? null, jornada: p.jornada ?? 'pronto', desde: p.desde, ate: p.ate }));
  }
  return { id, ids };
}
const linhas = async (militarId: string) =>
  (await api.banco.query<{ desde: string; ate: string | null; unidade_id: string; equipe_id: string | null; jornada: string }>(
    "select to_char(desde,'YYYY-MM-DD') as desde, to_char(ate,'YYYY-MM-DD') as ate, unidade_id, equipe_id, jornada from rastreio where militar_id = $1 order by desde", [militarId],
  )).rows;
const cancelar = (quem: Quem, militarId: string, periodoId: string) => api.pedir(quem, 'DELETE', `/api/militares/${militarId}/rastreio/${periodoId}`);
const editar = (quem: Quem, militarId: string, periodoId: string, corpo: Record<string, unknown>) =>
  api.pedir(quem, 'PUT', `/api/militares/${militarId}/rastreio/${periodoId}`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'pronto', desde: mais(10), ...corpo });
const texto = async (r: Response) => ((await r.json()) as { erro: string }).erro;

beforeAll(async () => {
  api = await montarApi();
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  equipeSb1 = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  equipeSb2 = await inserir(api.banco, 'equipe', { unidade_id: sb2, nome: 'Bravo', ordem_ciclo: 1 });
  desativada = await inserir(api.banco, 'situacao_militar', { nome: 'Situação encerrada', escalavel: false, ativo: false });
});
afterAll(async () => {
  await api.fechar();
});

describe('cancelar uma mudança que ainda não vale', () => {
  it('o gestor cancela a mudança marcada: a linha some, o período anterior volta a ficar aberto e a auditoria registra', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9), equipe: equipeSb1 }, { desde: mais(10), ate: null, unidade: sb2, equipe: equipeSb2 }]);
    const r = await cancelar('gestorGb', m.id, m.ids[1]!);
    expect(r.status).toBe(200);
    expect(await linhas(m.id)).toEqual([{ desde: mais(-60), ate: null, unidade_id: api.ids.secao, equipe_id: equipeSb1, jornada: 'pronto' }]);
    const ficha = (await r.json()) as FichaMilitar;
    expect(ficha.rastreio.map((p) => p.id)).toEqual([m.ids[0]]);
    const auditoria = (await api.banco.query<{ acao: string; usuario_id: string }>("select acao, usuario_id from auditoria where tabela = 'rastreio' and registro_id = $1 and acao = 'delete'", [m.ids[1]])).rows;
    expect(auditoria).toEqual([{ acao: 'delete', usuario_id: api.usuarios.gestorGb }]);
  });

  it('com uma mudança marcada depois da cancelada, o anterior vai até a véspera dela (não fica aberto sobre ela)', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: mais(19), jornada: 'adm' }, { desde: mais(20), ate: null }]);
    expect((await cancelar('gestorGb', m.id, m.ids[1]!)).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-60), ate: mais(19) }, { desde: mais(20), ate: null }]);
  });

  it('o vão que já existia antes da mudança continua vão: o anterior só reabre se estava colado nela', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(2) }, { desde: mais(10), ate: null }]);
    expect((await cancelar('gestorGb', m.id, m.ids[1]!)).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-60), ate: mais(2) }]);
  });

  it('a mudança que já vale: o gestor leva 403 com a frase, e nada muda; o administrador cancela (fase de testes) e o anterior reabre', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(-11) }, { desde: mais(-10), ate: null, jornada: 'adm' }]);
    const antes = await linhas(m.id);
    const negado = await cancelar('gestorGb', m.id, m.ids[1]!);
    expect(negado.status).toBe(403);
    expect(await texto(negado)).toBe(MSG_JA_VALE);
    expect(await linhas(m.id)).toEqual(antes);
    expect((await cancelar('admin', m.id, m.ids[1]!)).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-60), ate: null, jornada: 'pronto' }]);
  });

  it('o administrador cancela um período do meio que já passou: o anterior cobre o dia dele, sem buraco e sem sobreposição', async () => {
    const m = await militar([{ desde: mais(-90), ate: mais(-61) }, { desde: mais(-60), ate: mais(-31), jornada: 'adm' }, { desde: mais(-30), ate: null }]);
    expect((await cancelar('admin', m.id, m.ids[1]!)).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-90), ate: mais(-31) }, { desde: mais(-30), ate: null }]);
  });

  it('o único registro do militar não se cancela: 400 com a frase, e a linha fica', async () => {
    const m = await militar([{ desde: mais(10), ate: null }]);
    const r = await cancelar('admin', m.id, m.ids[0]!);
    expect(r.status).toBe(400);
    expect(await texto(r)).toBe(MSG_UNICO_REGISTRO);
    expect(await linhas(m.id)).toHaveLength(1);
  });

  it('quem só vê (o escalante da seção) e quem não tem nível de acesso levam 403; o período que não é do militar é 404', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    const outro = await militar([{ desde: mais(-60), ate: null }]);
    expect((await cancelar('escalante', m.id, m.ids[1]!)).status).toBe(403);
    expect((await cancelar('semPapel', m.id, m.ids[1]!)).status).toBe(403);
    expect((await cancelar('gestorGb', m.id, outro.ids[0]!)).status).toBe(404);
    expect((await cancelar('gestorGb', m.id, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await cancelar('gestorGb', m.id, 'nao-e-um-id')).status).toBe(404);
    expect(await linhas(m.id)).toHaveLength(2);
  });
});

describe('editar uma mudança que ainda não vale', () => {
  it('o gestor muda lotação, equipe, jornada e a data: o anterior termina na véspera da nova data', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    const r = await editar('gestorGb', m.id, m.ids[1]!, { unidadeId: sb2, equipeId: equipeSb2, jornada: 'adm', desde: mais(15) });
    expect(r.status).toBe(200);
    expect(await linhas(m.id)).toEqual([
      { desde: mais(-60), ate: mais(14), unidade_id: api.ids.secao, equipe_id: null, jornada: 'pronto' },
      { desde: mais(15), ate: null, unidade_id: sb2, equipe_id: equipeSb2, jornada: 'adm' },
    ]);
    expect(((await r.json()) as FichaMilitar).rastreio.find((p) => p.id === m.ids[1])?.desde).toBe(mais(15));
  });

  it('a data que recua também acerta o fim do anterior', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    expect((await editar('gestorGb', m.id, m.ids[1]!, { desde: mais(3) })).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-60), ate: mais(2) }, { desde: mais(3), ate: null }]);
  });

  it('a data não passa do começo do anterior nem do fim do próprio período: 400 no campo desde, e nada muda', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: mais(30) }, { desde: mais(31), ate: null }]);
    const antes = await linhas(m.id);
    const cedo = await editar('gestorGb', m.id, m.ids[1]!, { desde: mais(-60) });
    expect(cedo.status).toBe(400);
    expect(await texto(cedo)).toBe(`Use uma data a partir de ${brasil(mais(-59))}.`);
    const tarde = await editar('gestorGb', m.id, m.ids[1]!, { desde: mais(31) });
    expect(tarde.status).toBe(400);
    expect(await texto(tarde)).toBe(`Use uma data até ${brasil(mais(30))}.`);
    expect(await linhas(m.id)).toEqual(antes);
  });

  it('sem mudar a data, o anterior não é tocado; o quadro e a situação que não vêm continuam os do período', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    const quadro = (await api.banco.query<{ quadro_id: string | null; situacao_id: string }>('select quadro_id, situacao_id from rastreio where id = $1', [m.ids[1]])).rows[0]!;
    expect((await editar('gestorGb', m.id, m.ids[1]!, { equipeId: equipeSb1 })).status).toBe(200);
    expect((await api.banco.query('select quadro_id, situacao_id, equipe_id from rastreio where id = $1', [m.ids[1]])).rows[0]).toEqual({ ...quadro, equipe_id: equipeSb1 });
    expect((await linhas(m.id))[0]!.ate).toBe(mais(9));
  });

  it('equipe de outra unidade e situação desativada são 400 no campo; nada muda', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    const antes = await linhas(m.id);
    const equipe = await editar('gestorGb', m.id, m.ids[1]!, { equipeId: equipeSb2 });
    expect(equipe.status).toBe(400);
    expect(((await equipe.json()) as { campos: Record<string, string> }).campos.equipeId).toBe('Escolha uma equipe da unidade da lotação.');
    expect((await editar('gestorGb', m.id, m.ids[1]!, { situacaoId: desativada })).status).toBe(400);
    expect(await linhas(m.id)).toEqual(antes);
  });

  it('a mudança que já vale: o gestor leva 403; o administrador edita (fase de testes) e o anterior acompanha a data', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(-11) }, { desde: mais(-10), ate: null }]);
    expect((await editar('gestorGb', m.id, m.ids[1]!, { desde: mais(-5) })).status).toBe(403);
    expect((await editar('admin', m.id, m.ids[1]!, { desde: mais(-5), jornada: 'adm' })).status).toBe(200);
    expect(await linhas(m.id)).toMatchObject([{ desde: mais(-60), ate: mais(-6) }, { desde: mais(-5), ate: null, jornada: 'adm' }]);
  });

  it('quem só vê leva 403; quem não tem nível de acesso, também', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(9) }, { desde: mais(10), ate: null }]);
    expect((await editar('escalante', m.id, m.ids[1]!, {})).status).toBe(403);
    expect((await editar('semPapel', m.id, m.ids[1]!, {})).status).toBe(403);
  });
});

describe('a ficha diz em que período quem pede pode mexer', () => {
  const quais = async (quem: Quem, militarId: string) => ((await (await api.pedir(quem, 'GET', `/api/militares/${militarId}`)).json()) as FichaMilitar).rastreio.map((p) => [p.desde, p.podeMexer]);

  it('o gestor, só na mudança que ainda não vale; o administrador, em todas (fase de testes); o escalante da seção, em nenhuma', async () => {
    const m = await militar([{ desde: mais(-60), ate: mais(-11) }, { desde: mais(-10), ate: mais(9) }, { desde: mais(10), ate: null }]);
    expect(await quais('gestorGb', m.id)).toEqual([[mais(10), true], [mais(-10), false], [mais(-60), false]]);
    expect(await quais('admin', m.id)).toEqual([[mais(10), true], [mais(-10), true], [mais(-60), true]]);
    expect(await quais('escalante', m.id)).toEqual([[mais(10), false], [mais(-10), false], [mais(-60), false]]);
  });
});
