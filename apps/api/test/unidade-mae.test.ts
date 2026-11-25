import type { ListaDoPeculio, UnidadeDaConsulta, UnidadeDeLotacao, UnidadeDeTrabalho } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { hojeRecife } from '../src/datas.ts';

// Entrega 6.45: toda lista de unidades traz a unidade-mãe (`maeId`), para o site montar a árvore e a pessoa escolher nó a nó. A sigla que se repete
// vem sem o sufixo "(cima)": a árvore já diz onde ela fica. Dados fictícios (D7).
let api: ApiDeTeste;
let divOp = '';
let outroGb = '';
let sbDoOutroGb = '';
let extinta = '';
const maeDe = async (id: string) => (await api.banco.query<{ mae_id: string | null }>('select mae_id from unidade where id = $1', [id])).rows[0]!.mae_id;

beforeAll(async () => {
  api = await montarApi();
  divOp = (await api.banco.query<{ id: string }>("select id from unidade where sigla = 'DivOp' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  const maeDoGb = await maeDe(api.ids.gb);
  // outro grupamento, com uma seção de sigla repetida ("1ª SB"), e uma unidade extinta
  outroGb = await inserir(api.banco, 'unidade', { sigla: '9º GB', nome: '9º Grupamento', tipo: 'grupamento', mae_id: maeDoGb, desde: '2020-01-01' });
  sbDoOutroGb = await inserir(api.banco, 'unidade', { sigla: '1ª SB', nome: '1ª Seção do 9º GB', tipo: 'secao', mae_id: outroGb, desde: '2020-01-01' });
  // um militar lotado na 1ª SB, para a lista do Pecúlio
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const militar = await inserir(api.banco, 'militar', { matricula: '990645-1', posto_grad_id: posto, nome_guerra: 'ARVORE' });
  await inserir(api.banco, 'rastreio', { militar_id: militar, unidade_id: api.ids.secao, jornada: 'pronto', desde: '2026-01-01' });
  extinta = await inserir(api.banco, 'unidade', { sigla: 'SB-EXT', nome: 'Seção extinta', tipo: 'secao', mae_id: outroGb, desde: '2019-01-01', ate: '2020-01-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('a unidade-mãe em cada lista de unidades (6.45)', () => {
  it('unidades-de-lotacao: cada uma com a mãe; a raiz com null; a sigla repetida vem sem o sufixo da unidade de cima (Review Focus 1)', async () => {
    const lista: UnidadeDeLotacao[] = await (await api.pedir('admin', 'GET', '/api/unidades-de-lotacao')).json();
    const de = (id: string) => lista.find((u) => u.id === id)!;
    expect(de(api.ids.raiz).maeId).toBeNull();
    expect(de(api.ids.gb).maeId).toBe(await maeDe(api.ids.gb));
    expect(de(api.ids.secao).maeId).toBe(await maeDe(api.ids.secao));
    expect(de(sbDoOutroGb)).toMatchObject({ sigla: '1ª SB', maeId: outroGb });
    expect(de(api.ids.secao).sigla).toBe('1ª SB');
    expect(lista.some((u) => u.sigla.includes('('))).toBe(false);
    // a extinta não aparece (Review Focus 3)
    expect(lista.map((u) => u.id)).not.toContain(extinta);
  });

  it('consulta/unidades: a árvore inteira, cada uma com a mãe, sem a extinta', async () => {
    const lista: UnidadeDaConsulta[] = await (await api.pedir('semPapel', 'GET', '/api/consulta/unidades')).json();
    const de = (id: string) => lista.find((u) => u.id === id)!;
    expect(de(api.ids.raiz).maeId).toBeNull();
    expect(de(divOp).maeId).toBe(api.ids.gb);
    expect(de(sbDoOutroGb).maeId).toBe(outroGb);
    expect(lista.map((u) => u.id)).not.toContain(extinta);
    // toda mãe citada está na lista: a árvore fecha
    const ids = new Set(lista.map((u) => u.id));
    expect(lista.every((u) => u.maeId === null || ids.has(u.maeId))).toBe(true);
  });

  it('/api/eu: as unidades de trabalho e a lotação trazem a mãe', async () => {
    const eu: { unidades: UnidadeDeTrabalho[]; unidadesSoConsulta: UnidadeDeTrabalho[]; lotacao: UnidadeDeTrabalho | null } = await (await api.pedir('gestorGb', 'GET', '/api/eu')).json();
    const gb = eu.unidades.find((u) => u.id === api.ids.gb)!;
    expect(gb.maeId).toBe(await maeDe(api.ids.gb));
    expect(eu.unidades.find((u) => u.id === divOp)!.maeId).toBe(api.ids.gb);
    for (const u of [...eu.unidades, ...eu.unidadesSoConsulta, ...(eu.lotacao ? [eu.lotacao] : [])]) expect(u, u.sigla).toHaveProperty('maeId');
    const doAdmin: { unidades: UnidadeDeTrabalho[] } = await (await api.pedir('admin', 'GET', '/api/eu')).json();
    expect(doAdmin.unidades.find((u) => u.id === api.ids.raiz)!.maeId).toBeNull();
  });

  it('unidadesParaPapel (Acesso ao sistema): cada uma com a mãe', async () => {
    const m = (await api.banco.query<{ id: string }>('select militar_id as id from usuario where id = $1', [api.usuarios.escalante])).rows[0]!;
    const acesso: { unidadesParaPapel: { id: string; maeId: string | null }[] } = await (await api.pedir('admin', 'GET', `/api/militares/${m.id}/acesso`)).json();
    const de = (id: string) => acesso.unidadesParaPapel.find((u) => u.id === id)!;
    expect(de(api.ids.raiz).maeId).toBeNull();
    expect(de(divOp).maeId).toBe(api.ids.gb);
    expect(de(sbDoOutroGb).maeId).toBe(outroGb);
  });

  it('Pecúlio: cada militar traz o id da unidade de lotação, para o filtro pela árvore', async () => {
    const lista: ListaDoPeculio = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/peculio?mes=${hojeRecife().slice(0, 7)}`)).json();
    expect(lista.militares.length).toBeGreaterThan(0);
    const siglaDe = new Map((await api.banco.query<{ id: string; sigla: string }>('select id, sigla from unidade')).rows.map((u) => [u.id, u.sigla]));
    for (const m of lista.militares) expect(siglaDe.get(m.lotacaoId), m.nomeGuerra).toBe(m.lotacao);
  });
});
