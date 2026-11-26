import type { Aviso, QuadroDeAvisos } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// 6.56: o quadro de avisos. Cenário fictício (D7): o 2º GB tem a 1ª SB (com a SUB embaixo) e a SEC-OUTRA, irmã dela. O relógio é injetado, em 2027, depois do dia em que os papéis passam a valer.
let api: ApiDeTeste;
let relogio = new Date('2027-03-10T15:00:00Z');
const dia = (d: string, hora = '12:00') => new Date(`${d}T${hora}:00-03:00`);
const ids: Record<string, string> = {};
const gente: Record<string, Pessoa> = {};
let seq = 0;
const FRASE_403 = 'Você não tem nível de acesso nesta unidade.';

/** Uma conta fictícia, lotada na unidade (ou sem lotação) e com ou sem nível de acesso. */
async function pessoa(nome: string, lotada: string | null, nivel?: { papel: string; unidade: string }) {
  seq++;
  const p = await entrarComo(api, { matricula: `990${String(700 + seq)}-${seq % 10}`, nome, nivel: nivel ? { papel: nivel.papel, unidadeId: ids[nivel.unidade]! } : undefined });
  if (lotada) await inserir(api.banco, 'rastreio', { militar_id: p.militarId, unidade_id: ids[lotada], jornada: 'pronto', desde: '2020-01-01' });
  gente[nome] = p;
  return p;
}
const quadro = async (quem: string): Promise<QuadroDeAvisos> => (await gente[quem]!.pedir('GET', '/api/avisos')).json();
const titulos = async (quem: string) => (await quadro(quem)).avisos.map((a) => a.titulo);
const publicar = (quem: string, unidade: string, extra: Record<string, unknown> = {}) =>
  gente[quem]!.pedir('POST', '/api/avisos', { unidadeId: ids[unidade], titulo: 'Aviso', texto: 'Texto do aviso.', fixado: false, ...extra });

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => criarApp({ banco, auth, limiteDeBuscas: Infinity, agora: () => relogio }));
  ids.GB = api.ids.gb;
  ids.SB = api.ids.secao;
  ids.RAIZ = api.ids.raiz;
  ids.SUB = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SUB', nome: 'Subseção', mae_id: ids.SB, desde: '2020-01-01' });
  ids.OUTRA = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEC-OUTRA', nome: 'Seção ao lado', mae_id: ids.GB, desde: '2020-01-01' });
  await pessoa('NASB', 'SB');
  await pessoa('NASUB', 'SUB');
  await pessoa('NAOUTRA', 'OUTRA');
  await pessoa('NOGB', 'GB');
  await pessoa('SEMLOTACAO', null);
  await pessoa('ESCSB', 'SB', { papel: 'escalante', unidade: 'SB' });
  await pessoa('GESTORSB', 'SB', { papel: 'gestor', unidade: 'SB' });
  await pessoa('GESTORDOGB', 'GB', { papel: 'gestor', unidade: 'GB' });
  await pessoa('RAIZADM', 'RAIZ', { papel: 'administrador', unidade: 'RAIZ' });
});
afterAll(async () => {
  await api.fechar();
});

describe('quem vê os avisos', () => {
  it('o aviso da 1ª SB é visto por quem está nela e nas de baixo; quem está ao lado ou em cima não vê', async () => {
    expect((await publicar('ESCSB', 'SB', { titulo: 'Da 1ª SB' })).status).toBe(201);
    expect(await titulos('NASB')).toEqual(['Da 1ª SB']);
    expect(await titulos('NASUB')).toEqual(['Da 1ª SB']);
    expect(await titulos('NAOUTRA')).toEqual([]);
    expect(await titulos('NOGB')).toEqual([]);
  });

  it('o aviso do 2º GB aparece para quem está na 1ª SB, na SUB, ao lado e no próprio 2º GB', async () => {
    expect((await publicar('GESTORDOGB', 'GB', { titulo: 'Do 2º GB' })).status).toBe(201);
    for (const quem of ['NASB', 'NASUB', 'NAOUTRA', 'NOGB']) expect(await titulos(quem), quem).toContain('Do 2º GB');
  });

  it('a conta sem lotação hoje não vê avisos', async () => {
    expect(await quadro('SEMLOTACAO')).toEqual({ avisos: [], podePublicar: false });
  });

  it('o militar que mudou de lotação deixa de ver os avisos da unidade antiga e passa a ver os da nova, no mesmo dia', async () => {
    const mudou = await pessoa('MUDOU', 'SB');
    expect(await titulos('MUDOU')).toContain('Da 1ª SB');
    expect(await publicar('GESTORDOGB', 'OUTRA', { titulo: 'Da seção ao lado' }).then((r) => r.status)).toBe(201);
    expect(await titulos('MUDOU')).not.toContain('Da seção ao lado');
    await api.banco.query("update rastreio set ate = '2027-03-09' where militar_id = $1", [mudou.militarId]);
    await inserir(api.banco, 'rastreio', { militar_id: mudou.militarId, unidade_id: ids.OUTRA, jornada: 'pronto', desde: '2027-03-10' });
    const depois = await titulos('MUDOU');
    expect(depois).toContain('Da seção ao lado');
    expect(depois).not.toContain('Da 1ª SB');
    expect(depois).toContain('Do 2º GB');
  });
});

describe('a ordem e o vencimento', () => {
  it('os fixados vêm primeiro, do mais novo para o mais velho; depois os outros, do mais novo para o mais velho', async () => {
    const criar = async (titulo: string, fixado: boolean, em: string) => {
      const a = (await (await publicar('GESTORDOGB', 'SB', { titulo, fixado })).json()) as Aviso;
      await api.banco.query('update aviso set publicado_em = $2 where id = $1', [a.id, em]);
    };
    await criar('Ordem A (velho)', false, '2027-03-01T10:00:00Z');
    await criar('Ordem B (fixado velho)', true, '2027-03-02T10:00:00Z');
    await criar('Ordem C (novo)', false, '2027-03-08T10:00:00Z');
    await criar('Ordem D (fixado novo)', true, '2027-03-07T10:00:00Z');
    const ordem = (await titulos('NASB')).filter((t) => t.startsWith('Ordem'));
    expect(ordem).toEqual(['Ordem D (fixado novo)', 'Ordem B (fixado velho)', 'Ordem C (novo)', 'Ordem A (velho)']);
  });

  it('o aviso que vence hoje aparece até 23h59 de Recife e some à meia-noite', async () => {
    expect((await publicar('GESTORDOGB', 'SB', { titulo: 'Vence hoje', valeAte: '2027-03-10' })).status).toBe(201);
    relogio = dia('2027-03-10', '23:59');
    expect(await titulos('NASB')).toContain('Vence hoje');
    relogio = dia('2027-03-11', '00:00');
    expect(await titulos('NASB')).not.toContain('Vence hoje');
    relogio = dia('2027-03-10', '12:00');
  });

  it('sem data, o aviso fica até alguém retirar', async () => {
    relogio = dia('2030-01-01');
    expect(await titulos('NASB')).toContain('Da 1ª SB');
    relogio = dia('2027-03-10', '12:00');
  });
});

describe('quem publica', () => {
  it('quem tem nível de acesso na unidade, ou numa de cima, publica; o 403 traz a frase fixa', async () => {
    expect((await publicar('ESCSB', 'SB')).status).toBe(201);
    expect((await publicar('ESCSB', 'SUB')).status).toBe(201);
    expect((await publicar('GESTORDOGB', 'SB')).status).toBe(201);
    expect((await publicar('RAIZADM', 'OUTRA')).status).toBe(201);
    expect((await publicar('RAIZADM', 'RAIZ')).status).toBe(201);
  });

  it('o gestor da 1ª SB não publica no 2º GB (unidade de cima) nem ao lado: 403 com a frase fixa', async () => {
    for (const unidade of ['GB', 'OUTRA']) {
      const r = await publicar('GESTORSB', unidade);
      expect(r.status).toBe(403);
      expect(((await r.json()) as { erro: string }).erro).toBe(FRASE_403);
    }
  });

  it('o militar sem nível de acesso não publica; a unidade que não existe é 404; o corpo desconhecido é 400', async () => {
    expect((await publicar('NASB', 'SB')).status).toBe(403);
    expect((await gente.ESCSB!.pedir('POST', '/api/avisos', { unidadeId: '00000000-0000-4000-8000-000000000000', titulo: 'x', texto: 'y', fixado: false })).status).toBe(404);
    expect((await gente.ESCSB!.pedir('POST', '/api/avisos', { unidadeId: ids.SB, titulo: 'x', texto: 'y', fixado: false, autor: 'outro' })).status).toBe(400);
  });

  it('a data que já passou é recusada ("A data já passou."); hoje vale', async () => {
    const r = await publicar('ESCSB', 'SB', { valeAte: '2027-03-09' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos.valeAte).toBe('A data já passou.');
    expect((await publicar('ESCSB', 'SB', { valeAte: '2027-03-10' })).status).toBe(201);
  });

  it('o título e o texto têm limites: 80 e 400 passam; 81 e 401 não, com a frase', async () => {
    expect((await publicar('ESCSB', 'SB', { titulo: 'T'.repeat(80), texto: 'x'.repeat(400) })).status).toBe(201);
    const t = await publicar('ESCSB', 'SB', { titulo: 'T'.repeat(81) });
    expect(t.status).toBe(400);
    expect(((await t.json()) as { campos: Record<string, string> }).campos.titulo).toBe('O título tem até 80 caracteres.');
    const x = await publicar('ESCSB', 'SB', { texto: 'x'.repeat(401) });
    expect(x.status).toBe(400);
    expect(((await x.json()) as { campos: Record<string, string> }).campos.texto).toBe('O texto tem até 400 caracteres.');
    expect((await publicar('ESCSB', 'SB', { titulo: '   ' })).status).toBe(400);
  });

  it('o texto guarda as quebras de linha', async () => {
    const a = (await (await publicar('ESCSB', 'SB', { titulo: 'Com linhas', texto: 'Primeira\n\nSegunda' })).json()) as Aviso;
    expect(a.texto).toBe('Primeira\n\nSegunda');
  });
});

describe('editar, fixar e retirar', () => {
  let aviso: Aviso;
  beforeAll(async () => {
    aviso = (await (await publicar('ESCSB', 'SB', { titulo: 'Para editar' })).json()) as Aviso;
  });

  it('o autor edita; quem tem nível de acesso na unidade ou acima edita; quem não tem, 403', async () => {
    expect((await gente.ESCSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { titulo: 'Editado pelo autor' })).status).toBe(200);
    expect((await gente.GESTORSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { fixado: true })).status).toBe(200);
    expect((await gente.GESTORDOGB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { texto: 'Editado de cima' })).status).toBe(200);
    const r = await gente.NASB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { titulo: 'Intruso' });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { erro: string }).erro).toBe(FRASE_403);
    const visto = (await quadro('NASB')).avisos.find((a) => a.id === aviso.id)!;
    expect(visto).toMatchObject({ titulo: 'Editado pelo autor', fixado: true, texto: 'Editado de cima' });
  });

  it('a unidade não muda no PATCH, e a data passada é recusada; null tira a data', async () => {
    expect((await gente.ESCSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { unidadeId: ids.GB })).status).toBe(400);
    const passada = await gente.ESCSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { valeAte: '2027-03-09' });
    expect(passada.status).toBe(400);
    expect(((await passada.json()) as { campos: Record<string, string> }).campos.valeAte).toBe('A data já passou.');
    expect((await gente.ESCSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { valeAte: '2027-04-01' })).status).toBe(200);
    expect(((await (await gente.ESCSB!.pedir('PATCH', `/api/avisos/${aviso.id}`, { valeAte: null })).json()) as Aviso).valeAte).toBeNull();
  });

  it('o gestor da 1ª SB não retira aviso do 2º GB; o autor perde o nível e ainda retira o seu', async () => {
    const doGb = (await (await publicar('GESTORDOGB', 'GB', { titulo: 'Só do GB' })).json()) as Aviso;
    const r = await gente.GESTORSB!.pedir('POST', `/api/avisos/${doGb.id}/retirar`);
    expect(r.status).toBe(403);
    expect(((await r.json()) as { erro: string }).erro).toBe(FRASE_403);
    const proprio = (await (await publicar('ESCSB', 'SB', { titulo: 'Do escalante' })).json()) as Aviso;
    await api.banco.query('delete from papel_usuario where usuario_id = $1', [gente.ESCSB!.usuarioId]);
    expect((await gente.ESCSB!.pedir('POST', `/api/avisos/${proprio.id}/retirar`)).status).toBe(204);
    await api.banco.query("insert into papel_usuario (usuario_id, papel, unidade_id, desde) values ($1, 'escalante', $2, '2020-01-01')", [gente.ESCSB!.usuarioId, ids.SB]);
  });

  it('retirar tira o aviso das telas, mas não do banco; retirar de novo ou editar o retirado é 404', async () => {
    const a = (await (await publicar('ESCSB', 'SB', { titulo: 'A retirar' })).json()) as Aviso;
    expect(await titulos('NASB')).toContain('A retirar');
    expect((await gente.GESTORSB!.pedir('POST', `/api/avisos/${a.id}/retirar`)).status).toBe(204);
    expect(await titulos('NASB')).not.toContain('A retirar');
    const linha = (await api.banco.query<{ retirado_em: string | null; retirado_por: string | null }>('select retirado_em, retirado_por from aviso where id = $1', [a.id])).rows[0]!;
    expect(linha.retirado_em).not.toBeNull();
    expect(linha.retirado_por).toBe(gente.GESTORSB!.usuarioId);
    const de_novo = await gente.GESTORSB!.pedir('POST', `/api/avisos/${a.id}/retirar`);
    expect(de_novo.status).toBe(404);
    expect(((await de_novo.json()) as { erro: string }).erro).toBe('Aviso não encontrado.');
    expect((await gente.GESTORSB!.pedir('PATCH', `/api/avisos/${a.id}`, { titulo: 'x' })).status).toBe(404);
    expect((await gente.GESTORSB!.pedir('POST', '/api/avisos/00000000-0000-4000-8000-000000000000/retirar')).status).toBe(404);
    expect((await gente.GESTORSB!.pedir('POST', '/api/avisos/nao-e-id/retirar')).status).toBe(404);
  });
});

describe('o que a conta pode', () => {
  it('podeAlterar: o autor e quem tem nível de acesso na unidade (ou acima) sim; o militar comum não', async () => {
    const a = (await (await publicar('ESCSB', 'SB', { titulo: 'Para o podeAlterar' })).json()) as Aviso;
    expect(a.podeAlterar).toBe(true);
    const de = async (quem: string) => (await quadro(quem)).avisos.find((x) => x.id === a.id)?.podeAlterar;
    expect(await de('ESCSB')).toBe(true);
    expect(await de('GESTORSB')).toBe(true);
    expect(await de('GESTORDOGB')).toBe(undefined); // o gestor do GB está lotado no GB: o aviso da 1ª SB não é dele para ver
    expect(await de('RAIZADM')).toBe(undefined);
    expect(await de('NASB')).toBe(false);
    expect(await de('NASUB')).toBe(false);
  });

  it('podePublicar é verdadeiro só para quem tem nível de acesso em alguma unidade', async () => {
    expect((await quadro('ESCSB')).podePublicar).toBe(true);
    expect((await quadro('GESTORDOGB')).podePublicar).toBe(true);
    expect((await quadro('RAIZADM')).podePublicar).toBe(true);
    expect((await quadro('NASB')).podePublicar).toBe(false);
  });

  it('o autor aparece com o posto e o nome de guerra', async () => {
    const a = (await quadro('NASB')).avisos.find((x) => x.titulo === 'Da 1ª SB')!;
    expect(a.autor).toEqual({ patente: 'SD', nomeGuerra: 'ESCSB' });
    expect(a.unidadeSigla).toBe('1ª SB');
    expect(a.unidadeId).toBe(ids.SB);
  });

  it('sem sessão, 401', async () => {
    expect((await api.app.request('http://localhost:8787/api/avisos', { headers: { Origin: 'http://localhost:8787' } })).status).toBe(401);
  });
});

describe('a auditoria', () => {
  it('registra a publicação e a retirada com o usuário', async () => {
    const a = (await (await publicar('ESCSB', 'SB', { titulo: 'Auditado' })).json()) as Aviso;
    await gente.GESTORSB!.pedir('POST', `/api/avisos/${a.id}/retirar`);
    const linhas = (await api.banco.query<{ acao: string; usuario_id: string }>("select acao, usuario_id from auditoria where tabela = 'aviso' and registro_id = $1 order by id", [a.id])).rows;
    expect(linhas).toEqual([
      { acao: 'insert', usuario_id: gente.ESCSB!.usuarioId },
      { acao: 'update', usuario_id: gente.GESTORSB!.usuarioId },
    ]);
  });
});
