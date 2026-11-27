import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Dados fictícios (D7). Migra até a 0030, cria um segundo grupamento com uma seção e um gestor, e aplica a 0031.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
let gb: string;
let secao: string;
let usuario: string;
const divisoes = async (grupamento: string) =>
  (await banco.query<{ sigla: string; nome: string; desde: string }>(
    "select sigla, nome, to_char(desde, 'YYYY-MM-DD') as desde from unidade where mae_id = $1 and tipo = 'divisao' order by sigla", [grupamento])).rows;
const idDe = async (sigla: string, mae: string) =>
  (await banco.query<{ id: string }>('select id from unidade where sigla = $1 and mae_id = $2', [sigla, mae])).rows[0]!.id;
const darPapel = (papel: string, unidade: string) => inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: unidade, papel, desde: '2026-11-01' });

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0031');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  gb = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M31', nome: 'Grupamento M31', mae_id: raiz, desde: '2026-11-01' });
  secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-M31', nome: 'Seção M31', mae_id: gb, desde: '2026-11-01' });
  const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  const militar = await inserir(banco, 'militar', { matricula: '990731-1', posto_grad_id: posto, nome_guerra: 'M31' });
  usuario = await inserir(banco, 'usuario', { nome: 'SD BM M31', email: 'm31@exemplo.test', militar_id: militar });
  await darPapel('gestor', secao);
  await migrarAte(banco, '0032'); // só até a 0031: a 0035 muda o que esta migração criou (tipos com nível, chefe de divisão)
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0031: as divisões e o chefe de divisão', () => {
  it('a divisão fica entre o grupamento e a seção', async () => {
    const { rows } = await banco.query<{ codigo: string; nivel: number }>("select codigo, nivel from tipo_unidade where codigo in ('grupamento', 'divisao', 'secao') order by nivel");
    expect(rows).toEqual([{ codigo: 'grupamento', nivel: 3 }, { codigo: 'divisao', nivel: 4 }, { codigo: 'secao', nivel: 5 }]);
  });

  it('cada grupamento ganha a DA e a DivOp, vazias, a partir do dia 1 do mês da migração', async () => {
    const dia1 = (await banco.query<{ d: string }>("select to_char(date_trunc('month', current_date), 'YYYY-MM-DD') as d")).rows[0]!.d;
    const esperadas = [{ sigla: 'DA', nome: 'Divisão Administrativa', desde: dia1 }, { sigla: 'DivOp', nome: 'Divisão Operacional', desde: dia1 }];
    expect(await divisoes(gb)).toEqual(esperadas);
    const gb2 = (await banco.query<{ id: string }>("select id from unidade where sigla = '2º GB'")).rows[0]!.id;
    expect(await divisoes(gb2)).toEqual(esperadas);
    // as seções continuam direto no grupamento, e o nível de acesso que já existia continua lá
    expect((await banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [secao])).rows[0]!.mae_id).toBe(gb);
    expect((await banco.query("select 1 from unidade where tipo = 'secao' and mae_id in (select id from unidade where tipo = 'divisao')")).rows).toHaveLength(0);
    expect((await banco.query("select 1 from papel_usuario where usuario_id = $1 and papel = 'gestor' and unidade_id = $2", [usuario, secao])).rows).toHaveLength(1);
  });

  it('rodar de novo não duplica as divisões, nem recria a que foi renomeada', async () => {
    await banco.query("update unidade set sigla = 'DAdm' where id = $1", [await idDe('DA', gb)]);
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0031_divisoes.sql'), 'utf8'));
    expect((await divisoes(gb)).map((d) => d.sigla)).toEqual(['DAdm', 'DivOp']);
    await banco.query("update unidade set sigla = 'DA' where id = $1", [await idDe('DAdm', gb)]);
    const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from tipo_unidade where codigo = 'divisao'");
    expect(rows[0]!.n).toBe(1);
    const gatilhos = await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'papel_usuario'::regclass and tgname = 'papel_chefe_divisao'");
    expect(gatilhos.rows[0]!.n).toBe(1);
  });

  it('o nível chefe de divisão é aceito, e só numa divisão', async () => {
    const divOp = await idDe('DivOp', gb);
    const id = await darPapel('chefe_divisao', divOp);
    await expect(darPapel('chefe_divisao', secao)).rejects.toThrow('Chefe de divisão só existe numa divisão.');
    await expect(darPapel('chefe_divisao', gb)).rejects.toThrow('Chefe de divisão só existe numa divisão.');
    // alterar a unidade de um chefe para uma seção também falha
    await expect(banco.query('update papel_usuario set unidade_id = $2 where id = $1', [id, secao])).rejects.toThrow('Chefe de divisão só existe numa divisão.');
    // os outros níveis continuam valendo na divisão e fora dela; um nível que não existe continua recusado
    await darPapel('escalante', divOp);
    await darPapel('gestor', gb);
    await expect(darPapel('chefe', divOp)).rejects.toThrow();
  });

  it('a seção aceita como mãe um grupamento ou uma divisão; a divisão não aceita uma seção como mãe', async () => {
    const divOp = await idDe('DivOp', gb);
    await banco.query('update unidade set mae_id = $2 where id = $1', [secao, divOp]);
    const { rows } = await banco.query<{ ok: boolean; nivel: number }>(
      'select s.caminho <@ d.caminho as ok, nlevel(s.caminho) - nlevel(d.caminho) as nivel from unidade s, unidade d where s.id = $1 and d.id = $2', [secao, divOp]);
    expect(rows[0]).toEqual({ ok: true, nivel: 1 });
    await banco.query('update unidade set mae_id = $2 where id = $1', [secao, gb]);
    await expect(inserir(banco, 'unidade', { tipo: 'divisao', sigla: 'DIV-X', nome: 'Divisão X', mae_id: secao, desde: '2026-11-01' })).rejects.toThrow();
    // a divisão também não fica dentro de outra divisão
    await expect(inserir(banco, 'unidade', { tipo: 'divisao', sigla: 'DIV-Y', nome: 'Divisão Y', mae_id: divOp, desde: '2026-11-01' })).rejects.toThrow();
  });
});
