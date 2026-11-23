import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.23: quem tem nível de acesso numa unidade acima move o militar para qualquer seção abaixo dela, em qualquer profundidade. Dados fictícios (D7).
let api: ApiDeTeste;
let seq = 0;
const hoje = hojeRecife();
const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const u: Record<string, string> = {};

const secao = (sigla: string, mae: string) => inserir(api.banco, 'unidade', { tipo: 'secao', sigla, nome: `Seção ${sigla}`, mae_id: mae, desde: '2020-01-01' });
async function ator(papel: string, unidadeId: string) {
  seq++;
  return entrarComo(api, { matricula: `990${String(500 + seq).padStart(3, '0')}-${seq % 10}`, nome: `MOVE${seq}`, nivel: { papel, unidadeId } });
}
async function militar(unidadeId: string, periodos?: { desde: string; ate?: string | null; unidadeId: string }[]) {
  seq++;
  const id = await criarMilitar(api, { matricula: `990${String(600 + seq).padStart(3, '0')}-${seq % 10}`, email: null, unidadeId });
  if (periodos) {
    await api.banco.query('delete from rastreio where militar_id = $1', [id]);
    for (const p of periodos) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: p.unidadeId, jornada: 'adm', desde: p.desde, ate: p.ate ?? null });
  }
  return id;
}
const mover = (quem: Pessoa, id: string, unidadeId: string, extra: Record<string, unknown> = {}) =>
  quem.pedir('POST', `/api/militares/${id}/situacao`, { unidadeId, equipeId: null, jornada: 'adm', desde: hoje, ...extra });
const lotacaoAtual = async (id: string) =>
  (await api.banco.query<{ sigla: string }>('select un.sigla from rastreio r join unidade un on un.id = r.unidade_id where r.militar_id = $1 and r.ate is null', [id])).rows[0]?.sigla;

beforeAll(async () => {
  api = await montarApi();
  const { da, divOp } = await divisoesDoGb(api);
  u.gb = api.ids.gb;
  u.secaoSemDivisao = api.ids.secao; // 1ª SB
  u.sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  u.da = da;
  u.divOp = divOp;
  u.naDA = await secao('SB-DA-1', da);
  u.naDA2 = await secao('SB-DA-2', da);
  u.naDivOp = await secao('SB-DIVOP-1', divOp);
  // outro grupamento, ao lado do 2º GB, com uma seção de mesma sigla ("2ª SB")
  const paiDoGb = (await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [u.gb])).rows[0]!.mae_id;
  u.gb1 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '1º GB', nome: 'Primeiro Grupamento', mae_id: paiDoGb, desde: '2020-01-01' });
  u.sbDoOutroGb = await secao('2ª SB', u.gb1);
});
afterAll(async () => {
  await api.fechar();
});

describe('mover a lotação pela hierarquia (6.23)', () => {
  it('o caso do usuário: nível de gestor no CBMPE move um militar da 2ª SB para a 1ª SB', async () => {
    const quem = await ator('gestor', api.ids.raiz);
    const id = await militar(u.sb2);
    const r = await mover(quem, id, u.secaoSemDivisao);
    expect(r.status, JSON.stringify(await r.clone().json())).toBeLessThan(300);
    expect(await lotacaoAtual(id)).toBe('1ª SB');
  });

  it('nível de gestor no grupamento move de uma seção da DA para uma da DivOp (Review Focus 1), e de seção sem divisão para seção com divisão', async () => {
    const quem = await ator('gestor', u.gb);
    const id = await militar(u.naDA);
    expect((await mover(quem, id, u.naDivOp)).status).toBeLessThan(300);
    expect(await lotacaoAtual(id)).toBe('SB-DIVOP-1');
    const outro = await militar(u.secaoSemDivisao);
    expect((await mover(quem, outro, u.naDA)).status).toBeLessThan(300);
    expect(await lotacaoAtual(outro)).toBe('SB-DA-1');
  });

  it('a ficha diz que quem tem nível acima (no CBMPE, no grupamento, na divisão) altera a lotação, e quem tem só a seção não', async () => {
    const id = await militar(u.naDA);
    for (const [papel, unidade] of [['gestor', api.ids.raiz], ['administrador', api.ids.raiz], ['gestor', u.gb], ['chefe_divisao', u.da], ['escalante', u.da]] as const) {
      const quem = await ator(papel, unidade);
      const f = await (await quem.pedir('GET', `/api/militares/${id}`)).json();
      expect(f.podeEditar.peculio, `${papel} em ${unidade}`).toBe(papel !== 'escalante' || unidade !== u.naDA ? papel !== 'escalante' : false);
    }
  });

  it('nível no CBMPE move para uma seção de outro grupamento (Review Focus 2)', async () => {
    const quem = await ator('gestor', api.ids.raiz);
    const id = await militar(u.sb2);
    expect((await mover(quem, id, u.sbDoOutroGb)).status).toBeLessThan(300);
    expect((await api.banco.query<{ mae_id: string }>('select un.mae_id from rastreio r join unidade un on un.id = r.unidade_id where r.militar_id = $1 and r.ate is null', [id])).rows[0]!.mae_id).toBe(u.gb1);
  });

  it('o administrador move qualquer militar', async () => {
    const id = await militar(u.naDA);
    expect((await mover({ pedir: (m, c, b) => api.pedir('admin', m, c, b) } as Pessoa, id, u.sbDoOutroGb)).status).toBeLessThan(300);
  });

  it('chefe de divisão na DA move entre duas seções da DA; para uma seção da DivOp, 403', async () => {
    const quem = await ator('chefe_divisao', u.da);
    const id = await militar(u.naDA);
    expect((await mover(quem, id, u.naDA2)).status).toBeLessThan(300);
    expect((await mover(quem, id, u.naDivOp)).status).toBe(403);
    expect(await lotacaoAtual(id)).toBe('SB-DA-2');
  });

  it('nível só na seção: mudar a lotação é 403 com a frase de sempre; mudar equipe e jornada é 200', async () => {
    const quem = await ator('escalante', u.secaoSemDivisao);
    await api.banco.query("insert into papel_usuario (usuario_id, unidade_id, papel, desde) values ($1, $2, 'escalante', $3)", [quem.usuarioId, u.sb2, `${hoje.slice(0, 7)}-01`]);
    const id = await militar(u.secaoSemDivisao);
    const r = await mover(quem, id, u.sb2);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('A lotação é alterada por quem tem nível de acesso no 2º GB.');
    expect((await mover(quem, id, u.secaoSemDivisao, { jornada: 'pronto' })).status).toBeLessThan(300);
    expect(await lotacaoAtual(id)).toBe('1ª SB');
  });

  it('período aberto já marcado para outra seção: substituir pede nível acima das duas (Review Focus 3)', async () => {
    const id = await militar(u.sb2, [{ desde: mais(-30), ate: mais(9), unidadeId: u.sb2 }, { desde: mais(10), unidadeId: u.sbDoOutroGb }]);
    // gestor do 2º GB não alcança a seção do outro grupamento (onde o período aberto está)
    const doGb = await ator('gestor', u.gb);
    expect((await mover(doGb, id, u.secaoSemDivisao, { desde: mais(10) })).status).toBe(403);
    const doCbmpe = await ator('gestor', api.ids.raiz);
    expect((await mover(doCbmpe, id, u.secaoSemDivisao, { desde: mais(10) })).status).toBeLessThan(300);
  });

  it('militar sem lotação hoje, só com período futuro: a regra usa o período aberto (Review Focus 5)', async () => {
    const id = await militar(u.sb2, [{ desde: mais(15), unidadeId: u.sb2 }]);
    const quem = await ator('gestor', api.ids.raiz);
    expect((await mover(quem, id, u.secaoSemDivisao, { desde: mais(15) })).status).toBeLessThan(300);
    const semNivel = await ator('escalante', u.secaoSemDivisao);
    const outro = await militar(u.sb2, [{ desde: mais(15), unidadeId: u.sb2 }]);
    expect((await mover(semNivel, outro, u.secaoSemDivisao, { desde: mais(15) })).status).toBe(403);
  });
});

describe('a lista de destinos (6.23)', () => {
  it('traz todas as seções abaixo das unidades em que a pessoa tem nível, de qualquer grupamento, com o grupamento quando a sigla se repete', async () => {
    const quem = await ator('gestor', api.ids.raiz);
    const lista: { id: string; sigla: string }[] = await (await quem.pedir('GET', '/api/secoes')).json();
    const siglas = lista.map((s) => s.sigla);
    expect(lista.map((s) => s.id)).toEqual(expect.arrayContaining([u.sb2, u.sbDoOutroGb, u.naDA, u.naDivOp, u.secaoSemDivisao]));
    expect(siglas).toContain('2ª SB (2º GB)');
    expect(siglas).toContain('2ª SB (1º GB)');
    // as que não se repetem ficam só com a sigla
    expect(siglas).toContain('SB-DA-1');
  });

  it('quem tem nível só numa seção vê só ela', async () => {
    const quem = await ator('escalante', u.naDA);
    const lista: { sigla: string }[] = await (await quem.pedir('GET', '/api/secoes')).json();
    expect(lista.map((s) => s.sigla)).toEqual(['SB-DA-1']);
  });
});
