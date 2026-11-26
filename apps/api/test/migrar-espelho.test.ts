import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { estruturaDoSchema, migrar, migrarEspelho, PASTA_MIGRACOES, SCHEMA_ESPELHO } from '../src/banco/migrar.ts';

// 6.58: as migrações valem para o real (public) e para o espelho (laboratorio), no mesmo passo.
let banco: Banco;
let pasta: string;

beforeEach(async () => {
  banco = await bancoPglite();
  pasta = mkdtempSync(join(tmpdir(), 'migracoes-espelho-'));
});
afterEach(async () => {
  await banco.fechar();
});

const nomesAplicados = async (schema: string) =>
  (await banco.query<{ nome: string }>(`select nome from ${schema}.migracao_aplicada order by nome`)).rows.map((r) => r.nome);

describe('as migrações nos dois schemas', () => {
  it('banco novo: o espelho tem a mesma estrutura do real (tabelas, colunas, gatilhos, chaves, funções)', async () => {
    await migrar(banco);
    const real = await estruturaDoSchema(banco, 'public');
    const espelho = await estruturaDoSchema(banco, SCHEMA_ESPELHO);
    expect(real.tabelas.length).toBeGreaterThan(30);
    expect(real.gatilhos.length).toBeGreaterThan(30);
    expect(real.restricoes.length).toBeGreaterThan(30);
    expect(real.funcoes.length).toBeGreaterThan(3);
    expect(espelho.tabelas).toEqual(real.tabelas);
    expect(espelho.colunas).toEqual(real.colunas);
    expect(espelho.gatilhos).toEqual(real.gatilhos);
    expect(espelho.restricoes).toEqual(real.restricoes);
    expect(espelho.funcoes).toEqual(real.funcoes);
    expect(espelho.indices).toEqual(real.indices);
    // o registro de migrações aplicadas é de cada schema, e os dois têm todos os arquivos
    expect(await nomesAplicados(SCHEMA_ESPELHO)).toEqual(await nomesAplicados('public'));
    // a auditoria do espelho é a do espelho: o gatilho dele escreve na tabela dele
    await banco.exec("set search_path to laboratorio, public; insert into unidade (tipo, sigla, nome, mae_id, desde) select 'secao', 'X', 'Prova', id, '2020-01-01' from unidade where mae_id is null");
    await banco.exec('reset search_path');
    expect((await banco.query<{ n: number }>('select count(*)::int as n from laboratorio.auditoria where tabela = $1', ['unidade'])).rows[0]!.n).toBeGreaterThan(0);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from public.auditoria where tabela = $1 and depois ->> $2 = $3', ['unidade', 'sigla', 'X'])).rows[0]!.n).toBe(0);
  });

  it('a segunda execução não aplica nada e nada muda', async () => {
    const primeira = await migrar(banco);
    expect(primeira.length).toBeGreaterThan(40);
    const antes = await estruturaDoSchema(banco, SCHEMA_ESPELHO);
    expect(await migrar(banco)).toEqual([]);
    expect(await migrarEspelho(banco)).toEqual([]);
    expect(await estruturaDoSchema(banco, SCHEMA_ESPELHO)).toEqual(antes);
  });

  it('banco que já tem o real migrado: cria o espelho sem tocar em nada do real', async () => {
    const feitas = await migrar(banco, PASTA_MIGRACOES, { espelho: false });
    expect((await banco.query('select 1 from information_schema.schemata where schema_name = $1', [SCHEMA_ESPELHO])).rows).toHaveLength(0);
    await banco.exec("insert into unidade (tipo, sigla, nome, mae_id, desde) select 'secao', 'R1', 'Unidade real', id, '2020-01-01' from unidade where mae_id is null");
    const realAntes = await estruturaDoSchema(banco, 'public');
    const unidadesAntes = (await banco.query('select * from unidade order by sigla')).rows;
    const auditoriaAntes = (await banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;

    expect(await migrar(banco)).toEqual([]); // nada novo no real
    expect(await nomesAplicados(SCHEMA_ESPELHO)).toEqual(feitas);

    expect(await estruturaDoSchema(banco, 'public')).toEqual(realAntes);
    expect((await banco.query('select * from unidade order by sigla')).rows).toEqual(unidadesAntes);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n).toBe(auditoriaAntes);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from public.migracao_aplicada')).rows[0]!.n).toBe(feitas.length);
    // o espelho nasce com os dados de base das migrações, mas sem a unidade que só existe no real
    expect((await banco.query('select 1 from laboratorio.unidade where sigla = $1', ['R1'])).rows).toHaveLength(0);
  });

  it('um arquivo novo entra nos dois schemas, no mesmo passo', async () => {
    writeFileSync(join(pasta, '0001_prova.sql'), 'create table zz_prova (id int primary key);');
    expect(await migrar(banco, pasta)).toEqual(['0001_prova.sql']);
    for (const schema of ['public', SCHEMA_ESPELHO]) {
      expect((await banco.query<{ t: string | null }>('select to_regclass($1) as t', [`${schema}.zz_prova`])).rows[0]!.t).not.toBeNull();
      expect(await nomesAplicados(schema)).toEqual(['0001_prova.sql']);
    }
    await banco.exec('insert into laboratorio.zz_prova values (1)');
    expect((await banco.query<{ n: number }>('select count(*)::int as n from public.zz_prova')).rows[0]!.n).toBe(0);
  });

  it('se o arquivo falha no espelho, volta atrás só lá: o espelho não fica com tabela pela metade e o real segue aplicado', async () => {
    writeFileSync(
      join(pasta, '0001_so_falha_no_espelho.sql'),
      `create table zz_meio (id int);
       do $$ begin
         if current_schema() = 'laboratorio' then
           create table zz_so_no_espelho (id int);
           raise exception 'falha de prova no espelho';
         end if;
       end $$;`,
    );
    await expect(migrar(banco, pasta)).rejects.toThrow('falha de prova no espelho');
    // o real aplicou e registrou
    expect((await banco.query<{ t: string | null }>("select to_regclass('public.zz_meio') as t")).rows[0]!.t).not.toBeNull();
    expect(await nomesAplicados('public')).toEqual(['0001_so_falha_no_espelho.sql']);
    // o espelho não ficou com nada do arquivo, nem registrado
    for (const t of ['laboratorio.zz_meio', 'laboratorio.zz_so_no_espelho']) {
      expect((await banco.query<{ t: string | null }>('select to_regclass($1) as t', [t])).rows[0]!.t).toBeNull();
    }
    expect(await nomesAplicados(SCHEMA_ESPELHO)).toEqual([]);
    // e nada vazou para o real
    expect((await banco.query<{ t: string | null }>("select to_regclass('public.zz_so_no_espelho') as t")).rows[0]!.t).toBeNull();
  });

  it('uma migração que usa ltree e índice gist funciona no espelho (o search_path inclui o public das extensões)', async () => {
    writeFileSync(
      join(pasta, '0001_arvore.sql'),
      `create extension if not exists ltree;
       create extension if not exists btree_gist;
       create table zz_arvore (id int primary key, caminho ltree not null);
       create index zz_arvore_caminho on zz_arvore using gist (caminho);
       create table zz_periodo (id int, dias daterange, exclude using gist (id with =, dias with &&));`,
    );
    await migrar(banco, pasta);
    await banco.exec("insert into laboratorio.zz_arvore values (1, 'a.b'), (2, 'a.b.c')");
    const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from laboratorio.zz_arvore where caminho <@ 'a.b'::ltree");
    expect(rows[0]!.n).toBe(2);
  });

  it('a migração que pesquisa o catálogo enxerga só o schema dela (current_schema)', async () => {
    // um arquivo que cria uma tabela só se ainda não houver uma de mesmo nome no schema atual
    writeFileSync(
      join(pasta, '0001_a.sql'),
      `do $$ begin
         if not exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = 'zz_unica') then
           create table zz_unica (id int);
         end if;
       end $$;`,
    );
    await migrar(banco, pasta);
    for (const schema of ['public', SCHEMA_ESPELHO]) {
      expect((await banco.query<{ t: string | null }>('select to_regclass($1) as t', [`${schema}.zz_unica`])).rows[0]!.t).not.toBeNull();
    }
  });
});
