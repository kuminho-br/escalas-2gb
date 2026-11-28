import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal } from './banco-teste.ts';

// Dados fictícios (D7). A migração 0053 junta a cota interna e a externa do mesmo serviço e mês numa só (soma e menor prioridade), tira a origem e cria os dias da cota.
async function bancoAte0052(): Promise<Banco> {
  const banco = await bancoPglite();
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0053')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrarReal(banco, ate);
  return banco;
}
const unidade = async (banco: Banco, sigla: string) => (await banco.query<{ id: string }>('select id from unidade where sigla = $1', [sigla])).rows[0]!.id;
const cotas = async (banco: Banco) =>
  (await banco.query<{ unidade: string; servico: string; mes: string; quantidade: number; prioridade: number }>(
    `select u.sigla as unidade, s.nome as servico, to_char(c.mes, 'YYYY-MM') as mes, c.quantidade, c.prioridade
       from public.cota c join unidade u on u.id = c.unidade_id join servico s on s.id = c.servico_id order by u.sigla, s.nome, c.mes`,
  )).rows;

describe('migração 0053', () => {
  it('interna 4 (prioridade 2) e externa 3 (prioridade 1) do mesmo serviço e mês viram uma cota de 7 com prioridade 1; a que estava sozinha fica igual; duas unidades não se misturam', async () => {
    const banco = await bancoAte0052();
    try {
      const secao = await unidade(banco, '1ª SB');
      const outra = await unidade(banco, '2ª SB');
      const jes = await inserir(banco, 'servico', { unidade_id: secao, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
      const bioma = await inserir(banco, 'servico', { unidade_id: secao, nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E' });
      const jesDeFora = await inserir(banco, 'servico', { unidade_id: outra, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
      const cota = (u: string, s: string, mes: string, quantidade: number, origem: string, prioridade: number) => inserir(banco, 'cota', { mes, unidade_id: u, servico_id: s, quantidade, origem, prioridade });
      await cota(secao, jes, '2026-12-01', 4, 'interna', 2);
      await cota(secao, jes, '2026-12-01', 3, 'externa', 1);
      await cota(secao, jes, '2027-01-01', 5, 'externa', 3);
      await cota(secao, bioma, '2026-12-01', 2, 'interna', 4);
      await cota(outra, jesDeFora, '2026-12-01', 9, 'interna', 1);

      expect(await migrar(banco)).toContain('0053_cota_com_dias.sql');
      expect(await cotas(banco)).toEqual([
        { unidade: '1ª SB', servico: 'Bioma', mes: '2026-12', quantidade: 2, prioridade: 4 },
        { unidade: '1ª SB', servico: 'JES', mes: '2026-12', quantidade: 7, prioridade: 1 },
        { unidade: '1ª SB', servico: 'JES', mes: '2027-01', quantidade: 5, prioridade: 3 },
        { unidade: '2ª SB', servico: 'JES', mes: '2026-12', quantidade: 9, prioridade: 1 },
      ]);
    } finally {
      await banco.fechar();
    }
  }, 90000);

  it('a coluna origem não existe mais, nos dois schemas, e a cota repetida (mesma unidade, mês e serviço) é recusada', async () => {
    const banco = await bancoAte0052();
    try {
      await migrar(banco);
      for (const schema of ['public', 'laboratorio']) {
        const { rows } = await banco.query("select 1 from information_schema.columns where table_schema = $1 and table_name = 'cota' and column_name = 'origem'", [schema]);
        expect(rows, schema).toHaveLength(0);
      }
      const secao = await unidade(banco, '1ª SB');
      const jes = await inserir(banco, 'servico', { unidade_id: secao, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
      await inserir(banco, 'cota', { mes: '2026-12-01', unidade_id: secao, servico_id: jes, quantidade: 2, prioridade: 1 });
      await expect(inserir(banco, 'cota', { mes: '2026-12-01', unidade_id: secao, servico_id: jes, quantidade: 3, prioridade: 2 })).rejects.toMatchObject({ code: '23505' });
    } finally {
      await banco.fechar();
    }
  }, 90000);

  it('cota_dia: a data de outro mês é recusada; o mínimo é de 1 em diante; o máximo não é menor que o mínimo; o dia não se repete; apagar a cota apaga os dias', async () => {
    const banco = await bancoAte0052();
    try {
      await migrar(banco);
      const secao = await unidade(banco, '1ª SB');
      const jes = await inserir(banco, 'servico', { unidade_id: secao, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
      const cota = await inserir(banco, 'cota', { mes: '2026-12-01', unidade_id: secao, servico_id: jes, quantidade: 10, prioridade: 1 });
      const dia = (data: string, minimo: number, maximo: number | null) => inserir(banco, 'cota_dia', { cota_id: cota, data, minimo, maximo });
      await expect(dia('2027-01-05', 1, null)).rejects.toThrow('O dia precisa ser do mês da cota.');
      await expect(dia('2026-12-05', 0, null)).rejects.toMatchObject({ code: '23514' });
      await expect(dia('2026-12-05', 3, 2)).rejects.toMatchObject({ code: '23514' });
      await dia('2026-12-05', 3, null);
      await dia('2026-12-06', 1, 2);
      await expect(dia('2026-12-05', 2, null)).rejects.toMatchObject({ code: '23505' });
      await banco.query('delete from cota where id = $1', [cota]);
      expect((await banco.query<{ n: number }>('select count(*)::int as n from public.cota_dia')).rows[0]!.n).toBe(0);
    } finally {
      await banco.fechar();
    }
  }, 90000);

  it('a cota_dia existe também no espelho, e a mudança dos dias fica na auditoria', async () => {
    const banco = await bancoAte0052();
    try {
      await migrar(banco);
      expect((await banco.query('select 1 from information_schema.tables where table_schema = $1 and table_name = $2', ['laboratorio', 'cota_dia'])).rows).toHaveLength(1);
      const secao = await unidade(banco, '1ª SB');
      const jes = await inserir(banco, 'servico', { unidade_id: secao, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
      const cota = await inserir(banco, 'cota', { mes: '2026-12-01', unidade_id: secao, servico_id: jes, quantidade: 10, prioridade: 1 });
      await inserir(banco, 'cota_dia', { cota_id: cota, data: '2026-12-05', minimo: 2 });
      expect((await banco.query("select 1 from public.auditoria where tabela = 'cota_dia' and acao = 'insert'")).rows).toHaveLength(1);
    } finally {
      await banco.fechar();
    }
  }, 90000);
});
