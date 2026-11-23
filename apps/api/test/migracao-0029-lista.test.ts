import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { lotadosNoMes } from '../src/voluntariado/leitura.ts';
import { inserir } from './banco-teste.ts';

// Entrega 6.16, Task 4, item 7: nenhum militar das telas de escala some com a migração 0029 (quadro e situação por período). Dados fictícios (D7).
// A lista "de antes" é escrita à mão, com a regra do banco antigo (militar.ativo e quadro no militar); a "de depois" vem do código de hoje.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
let secao: string;
const MES = '2026-12';
const antes: string[] = [];

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0029');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-L29', nome: 'Seção L29', mae_id: raiz, desde: '2026-11-01' });
  const posto = async (sigla: string) => (await banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [sigla])).rows[0]!.id;
  const quadro = async (sigla: string) => (await banco.query<{ id: string }>('select id from quadro where sigla = $1', [sigla])).rows[0]!.id;
  const casos: { nome: string; posto: string; quadro: string | null; ativo: boolean; periodos: { desde: string; ate?: string }[] }[] = [
    { nome: 'PRACA', posto: 'SD BM', quadro: 'QBMG', ativo: true, periodos: [{ desde: '2026-11-01' }] },
    { nome: 'SEMQUADRO', posto: 'CB BM', quadro: null, ativo: true, periodos: [{ desde: '2026-12-10' }] },
    { nome: 'INATIVO', posto: 'SD BM', quadro: 'QBMG', ativo: false, periodos: [{ desde: '2026-11-01' }] },
    { nome: 'OFICIAL', posto: 'CAP BM', quadro: 'QOC', ativo: true, periodos: [{ desde: '2026-11-01' }] },
    { nome: 'DOISPERIODOS', posto: 'SD BM', quadro: 'QBMG', ativo: true, periodos: [{ desde: '2026-11-01', ate: '2026-12-14' }, { desde: '2026-12-15' }] },
    { nome: 'ENCERRADO', posto: 'SD BM', quadro: 'QBMG', ativo: true, periodos: [{ desde: '2026-10-01', ate: '2026-11-30' }] },
    { nome: 'SOFUTURO', posto: 'SD BM', quadro: 'QBMG', ativo: true, periodos: [{ desde: '2027-02-01' }] },
  ];
  let n = 0;
  for (const c of casos) {
    n++;
    const id = await inserir(banco, 'militar', { matricula: `99091${n}-${n}`, posto_grad_id: await posto(c.posto), nome_guerra: c.nome, quadro_id: c.quadro ? await quadro(c.quadro) : null, ativo: c.ativo });
    for (const p of c.periodos) await inserir(banco, 'rastreio', { militar_id: id, unidade_id: secao, jornada: 'adm', desde: p.desde, ate: p.ate ?? null });
  }
  // a regra de antes: ativo, praça (QBMG) ou sem quadro, com período na seção em algum dia do mês
  antes.push(
    ...(await banco.query<{ nome_guerra: string }>(
      `select distinct m.nome_guerra from militar m join rastreio l on l.militar_id = m.id and l.unidade_id = $1
        where m.ativo and (m.quadro_id is null or m.quadro_id = (select id from quadro where sigla = 'QBMG'))
          and l.desde <= date '2026-12-31' and (l.ate is null or l.ate >= date '2026-12-01') order by 1`,
      [secao],
    )).rows.map((r) => r.nome_guerra),
  );
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0029: ninguém some das telas de escala', () => {
  it('a lista de lotados no mês, antes e depois da migração, é a mesma', async () => {
    expect(antes).toEqual(['DOISPERIODOS', 'PRACA', 'SEMQUADRO']);
    const depois = (await lotadosNoMes(banco, secao, MES)).map((m) => m.nomeGuerra).sort();
    expect(depois).toEqual(antes);
  });
});
