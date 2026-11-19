import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7): um militar de matrícula inexistente com marcações A e B lançadas antes da migração.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}
async function cenario(banco: Banco) {
  const posto = await inserir(banco, 'posto_grad', { sigla: 'SD-M', nome: 'Soldado M', ordem: 906 });
  const militar = await inserir(banco, 'militar', { matricula: '990993-1', posto_grad_id: posto, nome_guerra: 'CONVERTIDO' });
  const marca = (data: string, turno_padrao: string, origem = 'manual') => inserir(banco, 'voluntariado', { militar_id: militar, data, turno_padrao, origem });
  await marca('2026-11-05', 'A');
  await marca('2026-11-05', 'B');
  await marca('2026-11-30', 'B', 'importacao');
  await inserir(banco, 'voluntariado_lancamento', { militar_id: militar, mes: '2026-11-01' });
  return militar;
}
const faixas = async (banco: Banco, militar: string) =>
  (await banco.query<{ d: string; i: number; f: number; o: string }>("select to_char(data, 'YYYY-MM-DD') as d, inicio_min as i, fim_min as f, origem as o from disponibilidade where militar_id = $1 order by data, inicio_min", [militar])).rows;

// um banco só (a memória da máquina de teste é curta): o cenário entra antes da 0018 e os demais testes usam o banco já migrado
let banco: Banco;
let convertido: string;
beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0018');
  convertido = await cenario(banco);
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});
const novoMilitar = async (sigla: string, ordem: number, matricula: string, nome: string) => {
  const posto = await inserir(banco, 'posto_grad', { sigla, nome: `Soldado ${sigla}`, ordem });
  return inserir(banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: nome });
};

describe('migração 0018: disponibilidade por faixa', () => {
  it('converte o que foi lançado: A vira 08h às 20h; B vira 20h às 24h do dia e 00h às 08h do dia seguinte, mesmo no mês seguinte (Review Focus 2)', async () => {
    expect(await faixas(banco, convertido)).toEqual([
      { d: '2026-11-05', i: 480, f: 1200, o: 'manual' },
      { d: '2026-11-05', i: 1200, f: 1440, o: 'manual' },
      { d: '2026-11-06', i: 0, f: 480, o: 'manual' },
      { d: '2026-11-30', i: 1200, f: 1440, o: 'importacao' },
      { d: '2026-12-01', i: 0, f: 480, o: 'importacao' },
    ]);
    // o registro de "já lançado" não muda e a conversão não cria "lançado" no mês seguinte
    const lancados = (await banco.query<{ mes: string }>("select to_char(mes, 'YYYY-MM') as mes from voluntariado_lancamento where militar_id = $1", [convertido])).rows;
    expect(lancados).toEqual([{ mes: '2026-11' }]);
  });

  it('a tabela antiga sai', async () => {
    expect((await banco.query<{ t: string | null }>("select to_regclass('public.voluntariado')::text as t")).rows[0]!.t).toBeNull();
  });

  it('a faixa precisa ficar dentro do dia e ter o fim depois do início; o mesmo início não entra duas vezes no dia', async () => {
    const militar = await novoMilitar('SD-N', 907, '990994-1', 'FAIXAS');
    const faixa = (inicio_min: number, fim_min: number) => inserir(banco, 'disponibilidade', { militar_id: militar, data: '2026-12-10', inicio_min, fim_min, origem: 'manual' });
    await expect(faixa(600, 500)).rejects.toMatchObject({ code: '23514' });
    await expect(faixa(600, 1500)).rejects.toMatchObject({ code: '23514' });
    await expect(faixa(-5, 100)).rejects.toMatchObject({ code: '23514' });
    await faixa(480, 960);
    await expect(faixa(480, 1200)).rejects.toMatchObject({ code: '23505' });
  });

  it('a faixa entra na auditoria', async () => {
    const militar = await novoMilitar('SD-O', 908, '990995-1', 'AUDITADO');
    const id = await inserir(banco, 'disponibilidade', { militar_id: militar, data: '2026-12-11', inicio_min: 0, fim_min: 480, origem: 'manual' });
    await banco.query('delete from disponibilidade where id = $1', [id]);
    const acoes = (await banco.query<{ acao: string }>("select acao from auditoria where tabela = 'disponibilidade' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });
});
