import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7). Um banco só: migra até a 0025, insere militares sem quadro e aplica as demais.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}
const postoId = async (sigla: string) => (await banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [sigla])).rows[0]!.id;
const quadroId = async (sigla: string) => (await banco.query<{ id: string }>('select id from quadro where sigla = $1', [sigla])).rows[0]!.id;
const quadroDe = async (id: string) => (await banco.query<{ sigla: string | null }>('select q.sigla from militar m left join quadro q on q.id = m.quadro_id where m.id = $1', [id])).rows[0]!.sigla;

let banco: Banco;
let sd: string;
let cel: string;
let maj: string;
let cap: string;
beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0026');
  const mil = async (n: number, posto: string) => inserir(banco, 'militar', { matricula: `99060${n}-${n}`, posto_grad_id: await postoId(posto), nome_guerra: `TESTE${n}` });
  sd = await mil(1, 'SD BM');
  cel = await mil(2, 'CEL BM');
  maj = await mil(3, 'MAJ BM');
  cap = await mil(4, 'CAP BM');
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0026: quadros', () => {
  it('quadros fixos', async () => {
    const { rows } = await banco.query<{ sigla: string }>('select sigla from quadro order by ordem');
    expect(rows.map((r) => r.sigla)).toEqual(['QOC', 'QOA', 'QBMG']);
  });

  it('postos por quadro', async () => {
    const postos = async (q: string) => (await banco.query<{ sigla: string }>(
      'select p.sigla from quadro_posto_grad qp join posto_grad p on p.id = qp.posto_grad_id join quadro q on q.id = qp.quadro_id where q.sigla = $1 order by p.ordem', [q])).rows.map((r) => r.sigla);
    expect(await postos('QOA')).toEqual(['2º TEN BM', '1º TEN BM', 'CAP BM', 'MAJ BM']);
    expect(await postos('QOC')).toEqual(['ASP OF BM', '2º TEN BM', '1º TEN BM', 'CAP BM', 'MAJ BM', 'TEN CEL BM', 'CEL BM']);
    expect(await postos('QBMG')).toEqual(['SD BM', 'CB BM', '3º SGT BM', '2º SGT BM', '1º SGT BM', 'ST BM']);
  });

  it('preenchimento: posto de um quadro só recebe o quadro; ambíguo fica sem', async () => {
    expect(await quadroDe(sd)).toBe('QBMG');
    expect(await quadroDe(cel)).toBe('QOC');
    expect(await quadroDe(maj)).toBeNull();
  });

  it('militar com posto fora do quadro', async () => {
    await expect(banco.query('update militar set quadro_id = $1 where id = $2', [await quadroId('QBMG'), cap])).rejects.toMatchObject({ code: '23503' });
    await banco.query('update militar set quadro_id = $1 where id = $2', [await quadroId('QOA'), cap]);
    expect(await quadroDe(cap)).toBe('QOA');
  });

  it('pode rodar de novo sem duplicar', async () => {
    await migrarAte(banco, '9999');
    expect((await banco.query('select 1 from quadro')).rows).toHaveLength(3);
  });
});
