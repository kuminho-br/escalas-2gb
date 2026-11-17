import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

let banco: Banco;
let raiz: string;
let secao: string;
let posto: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]?.id
    ?? (await inserir(banco, 'unidade', { tipo: 'corporacao', sigla: 'RAIZ-T', nome: 'Raiz de teste', desde: '2026-11-01' }));
  secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-T', nome: 'Seção de teste', mae_id: raiz, desde: '2026-11-01' });
  posto = await inserir(banco, 'posto_grad', { sigla: 'SD-T', nome: 'Soldado teste', ordem: 901 });
});
afterAll(async () => {
  await banco.fechar();
});

let seq = 0;
function militar(extra: Record<string, unknown> = {}) {
  seq++;
  return inserir(banco, 'militar', {
    matricula: `99${String(8000 + seq).padStart(4, '0')}-${seq % 10}`,
    posto_grad_id: posto,
    nome_guerra: `TESTE${seq}`,
    ...extra,
  });
}

describe('estrutura e pessoas', () => {
  it('matricula fora do formato', async () => {
    await expect(militar({ matricula: '99001-1' })).rejects.toThrow();
  });

  it('cnh sem motorista', async () => {
    await expect(militar({ motorista: false, cnh: ['B'] })).rejects.toThrow();
  });

  it('cnh invalida', async () => {
    await expect(militar({ motorista: true, cnh: ['F'] })).rejects.toThrow();
  });

  it('lotacao sobreposta', async () => {
    const m = await militar();
    await inserir(banco, 'lotacao', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-11-01' });
    await expect(
      inserir(banco, 'lotacao', { militar_id: m, unidade_id: secao, jornada: 'adm', desde: '2026-12-01' }),
    ).rejects.toThrow();
  });

  it('mes fora do dia 1', async () => {
    const m = await militar();
    await expect(
      inserir(banco, 'lotacao', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-11-15' }),
    ).rejects.toThrow();
  });

  it('afastamento com fim antes do inicio', async () => {
    const m = await militar();
    await expect(
      inserir(banco, 'afastamento', { militar_id: m, tipo: 'ferias', inicio: '2026-11-10', fim: '2026-11-09' }),
    ).rejects.toThrow();
  });

  it('mae de nivel maior', async () => {
    await expect(
      inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'X-T', nome: 'X', mae_id: secao, desde: '2026-11-01' }),
    ).rejects.toThrow();
  });

  it('caminho da unidade', async () => {
    const { rows } = await banco.query<{ ok: boolean; filho: boolean }>(
      `select f.caminho <@ r.caminho as ok, nlevel(f.caminho) = nlevel(r.caminho) + 1 as filho
         from unidade f, unidade r where f.id = $1 and r.id = $2`,
      [secao, raiz],
    );
    expect(rows[0]).toEqual({ ok: true, filho: true });
  });

  it('mover unidade move os descendentes', async () => {
    const d1 = await inserir(banco, 'unidade', { tipo: 'diretoria_integrada', sigla: 'D1-T', nome: 'D1', mae_id: raiz, desde: '2026-11-01' });
    const d2 = await inserir(banco, 'unidade', { tipo: 'diretoria_integrada', sigla: 'D2-T', nome: 'D2', mae_id: raiz, desde: '2026-11-01' });
    const gb = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-T', nome: 'GB', mae_id: d1, desde: '2026-11-01' });
    const sb = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SB-T', nome: 'SB', mae_id: gb, desde: '2026-11-01' });
    await banco.query('update unidade set mae_id = $1 where id = $2', [d2, gb]);
    const { rows } = await banco.query<{ ok: boolean }>(
      'select s.caminho <@ d.caminho as ok from unidade s, unidade d where s.id = $1 and d.id = $2',
      [sb, d2],
    );
    expect(rows[0]!.ok).toBe(true);
  });
});
