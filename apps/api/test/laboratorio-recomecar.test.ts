import { copyFileSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { hojeRecife } from '../src/datas.ts';
import { recomecarEspelho } from '../src/laboratorio/recomecar.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.59, Task 3: "Recomeçar" refaz o espelho. Dados fictícios (D7).
let api: ApiDeTeste;
const LAB = { 'x-laboratorio': '1' };
const MES = `${hojeRecife().slice(0, 7)}-01`;
const n = async (sql: string, params: unknown[] = []) => (await api.banco.query<{ n: number }>(sql, params)).rows[0]!.n;
const perfis = async () => (await api.banco.query<{ id: string }>('select id from laboratorio.usuario order by id')).rows.map((r) => r.id);

async function fotoDoReal() {
  const foto: Record<string, string> = {};
  const tabelas = (await api.banco.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((r) => r.tablename);
  for (const t of tabelas.filter((x) => x !== 'sessao')) {
    const r = (await api.banco.query<{ n: number; h: string }>(`select count(*)::int as n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from public."${t}" x`)).rows[0]!;
    foto[t] = `${r.n}:${r.h}`;
  }
  return foto;
}

beforeAll(async () => {
  api = await montarApi(undefined, { espelho: true });
}, 600000);
afterAll(async () => {
  await api.fechar();
});

describe('recomeçar o espelho', () => {
  it('depois de bagunçar o Laboratório, volta exatamente ao estado da carga, com os mesmos ids de perfil e a sessão de quem testava ainda valendo; o real não muda', async () => {
    const ids = await perfis();
    expect(ids).toHaveLength(5);
    const admin = (await (await api.pedir('semPapel', 'GET', '/api/laboratorio/perfis')).json()) as { perfilId: string; nivel: string }[];
    const perfilAdmin = admin.find((p) => p.nivel === 'administrador')!.perfilId;
    expect((await api.pedir('semPapel', 'PUT', '/api/laboratorio/perfil', { perfilId: perfilAdmin })).status).toBe(200);
    // bagunça: um militar a mais, um a menos, uma escala, e uma tabela de referência mexida
    const secao = (await api.banco.query<{ id: string }>("select id from laboratorio.unidade where sigla = '1ª SB'")).rows[0]!.id;
    const sd = (await api.banco.query<{ id: string }>("select id from laboratorio.posto_grad where sigla = 'SD'")).rows[0]!.id;
    const comLab = (m: string, c: string, corpo?: unknown) => api.pedir('semPapel', m, `/api/lab${c}`, corpo, LAB);
    expect((await comLab('POST', `/unidades/${secao}/militares`, {
      matricula: '990941-1', postoGradId: sd, nomeCompleto: 'Fulano de Tal', nomeGuerra: 'BAGUNCA', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
      lotacao: { equipeId: null, jornada: 'adm', desde: MES },
    })).status).toBe(201);
    await api.banco.query("delete from laboratorio.afastamento");
    await api.banco.query("update laboratorio.unidade set nome = 'MEXIDA' where sigla = '1ª SB'");
    const real = await fotoDoReal();

    const r = await api.pedir('admin', 'POST', '/api/laboratorio/recomecar');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ militares: 53, perfis: 5 });

    expect(await perfis()).toEqual(ids);
    expect(await n('select count(*)::int as n from laboratorio.militar')).toBe(58);
    expect(await n('select count(*)::int as n from laboratorio.militar where de_teste')).toBe(58);
    expect(await n("select count(*)::int as n from laboratorio.militar where matricula = '990941-1'")).toBe(0);
    expect(await n("select count(*)::int as n from laboratorio.unidade where nome = 'MEXIDA'")).toBe(0);
    expect(await n('select count(*)::int as n from laboratorio.papel_usuario')).toBe(4);
    // a sessão de quem testava continua valendo, no mesmo perfil
    expect(await (await api.pedir('semPapel', 'GET', '/api/laboratorio/eu')).json()).toMatchObject({ perfilId: perfilAdmin, nivel: 'administrador' });
    expect((await comLab('GET', '/postos')).status).toBe(200);
    expect(await fotoDoReal()).toEqual(real);
    // o papel e os privilégios do espelho foram refeitos: o perfil grava de novo
    const secao2 = (await api.banco.query<{ id: string }>("select id from laboratorio.unidade where sigla = '1ª SB'")).rows[0]!.id;
    const sd2 = (await api.banco.query<{ id: string }>("select id from laboratorio.posto_grad where sigla = 'SD'")).rows[0]!.id;
    expect((await comLab('POST', `/unidades/${secao2}/militares`, {
      matricula: '990942-2', postoGradId: sd2, nomeCompleto: 'Fulano de Tal', nomeGuerra: 'DEPOIS', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
      lotacao: { equipeId: null, jornada: 'adm', desde: MES },
    })).status).toBe(201);
  }, 180000);

  it('só o administrador da conta real recomeça: militar comum e gestor, 403 (o perfil de administrador de teste não vale)', async () => {
    const antes = await n('select count(*)::int as n from laboratorio.militar');
    expect((await api.pedir('semPapel', 'POST', '/api/laboratorio/recomecar')).status).toBe(403);
    expect((await api.pedir('gestorGb', 'POST', '/api/laboratorio/recomecar')).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', '/api/laboratorio/recomecar')).status).toBe(403);
    expect(await n('select count(*)::int as n from laboratorio.militar')).toBe(antes);
  });

  it('se um passo falha no meio, o espelho fica como estava (nada de espelho vazio)', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
    for (const f of readdirSync(PASTA_MIGRACOES).filter((x) => x.endsWith('.sql'))) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
    writeFileSync(join(pasta, '9999_falha.sql'), 'select 1 / 0;');
    const antes = { militares: await n('select count(*)::int as n from laboratorio.militar'), ids: await perfis() };
    await expect(recomecarEspelho(api.banco, MES, pasta)).rejects.toThrow(/division by zero/);
    expect(await n('select count(*)::int as n from laboratorio.militar')).toBe(antes.militares);
    expect(await perfis()).toEqual(antes.ids);
    expect((await api.banco.query<{ u: string }>('select current_user as u')).rows[0]!.u).not.toBe('laboratorio_app');
  }, 180000);
});
