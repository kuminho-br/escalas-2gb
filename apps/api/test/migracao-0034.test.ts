import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { migrarReal as migrar } from './banco-teste.ts';

// Entrega 6.15: o posto aparece sem "BM" (diretriz do usuário, 23/11/2026). "BM" não é posto: só diz que a corporação é o Bombeiro Militar.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
const siglas = async () => (await banco.query<{ sigla: string }>('select sigla from posto_grad order by ordem')).rows.map((r) => r.sigla);
const id = async (sigla: string) => (await banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [sigla])).rows[0]!.id;

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0034');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0034: o posto sem "BM"', () => {
  it('antes dela, as siglas ainda trazem o "BM" (a carga base é história e não muda)', async () => {
    expect((await siglas()).slice(0, 3)).toEqual(['SD BM', 'CB BM', '3º SGT BM']);
  });

  it('tira o " BM" do fim da sigla de todos os postos, e a ordem, o nome e os quadros ficam como estavam', async () => {
    const quadroDoCapitao = (await banco.query<{ quadro: string }>(
      `select q.sigla as quadro from quadro_posto_grad qp join quadro q on q.id = qp.quadro_id where qp.posto_grad_id = $1 order by q.ordem`, [await id('CAP BM')])).rows.map((r) => r.quadro);
    const idDoSoldado = await id('SD BM');
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0034_postos_sem_bm.sql'), 'utf8'));
    expect(await siglas()).toEqual(['SD', 'CB', '3º SGT', '2º SGT', '1º SGT', 'ST', 'ASP OF', '2º TEN', '1º TEN', 'CAP', 'MAJ', 'TEN CEL', 'CEL']);
    // a mesma linha, só com outra sigla
    expect(await id('SD')).toBe(idDoSoldado);
    expect((await banco.query<{ nome: string }>("select nome from posto_grad where sigla = 'SD'")).rows[0]!.nome).toBe('Soldado');
    const depois = (await banco.query<{ quadro: string }>(
      `select q.sigla as quadro from quadro_posto_grad qp join quadro q on q.id = qp.quadro_id where qp.posto_grad_id = $1 order by q.ordem`, [await id('CAP')])).rows.map((r) => r.quadro);
    expect(depois).toEqual(quadroDoCapitao);
    expect(depois).toEqual(['QOC', 'QOA']);
    expect((await banco.query('select 1 from posto_grad where sigla like \'% BM\'')).rows).toHaveLength(0);
  });

  it('roda de novo sem mexer em nada, e não toca em sigla que o usuário já mudou para outra forma', async () => {
    await banco.query("update posto_grad set sigla = 'Soldado BM-PE' where sigla = 'SD'");
    await banco.query("update posto_grad set sigla = 'Cabo' where sigla = 'CB'");
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0034_postos_sem_bm.sql'), 'utf8'));
    const lista = await siglas();
    expect(lista.slice(0, 2)).toEqual(['Soldado BM-PE', 'Cabo']);
    expect(lista).toHaveLength(13);
  });

  it('não cria sigla repetida: se já existe "XX" quando "XX BM" é renomeado, a sigla com "BM" fica como está', async () => {
    await banco.query("update posto_grad set sigla = 'CEL BM' where sigla = 'CEL'");
    await banco.query("update posto_grad set sigla = 'CEL' where sigla = 'TEN CEL'");
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0034_postos_sem_bm.sql'), 'utf8'));
    const lista = await siglas();
    expect(lista).toContain('CEL BM');
    expect(lista.filter((s) => s === 'CEL')).toHaveLength(1);
  });
});
