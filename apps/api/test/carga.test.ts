import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { cargaExemplo } from '../src/carga/exemplo.ts';
import { bancoDeTeste } from './banco-teste.ts';

let banco: Banco;

beforeAll(async () => {
  banco = await bancoDeTeste();
});
afterAll(async () => {
  await banco.fechar();
});

const n = async (sql: string, params: unknown[] = []) =>
  (await banco.query<{ n: number }>(sql, params)).rows[0]!.n;

describe('carga base', () => {
  it('uma raiz e a cadeia CBMPE ate a 1a SB', async () => {
    const { rows } = await banco.query<{ sigla: string }>('select sigla from unidade where mae_id is null');
    expect(rows.map((r) => r.sigla)).toEqual(['CBMPE']);
    const { rows: cadeia } = await banco.query<{ ok: boolean }>(
      `select sb.caminho <@ gb.caminho and gb.caminho <@ di.caminho and di.caminho <@ dgo.caminho as ok
         from unidade sb, unidade gb, unidade di, unidade dgo
        where sb.sigla = '1ª SB' and gb.sigla = '2º GB' and di.sigla = 'DInter/1' and dgo.sigla = 'DGO'`,
    );
    expect(cadeia[0]!.ok).toBe(true);
    expect(await n("select count(*)::int as n from unidade where tipo = 'diretoria_integrada'")).toBe(3);
  });

  it('postos em ordem', async () => {
    const { rows } = await banco.query<{ sigla: string }>('select sigla from posto_grad order by ordem');
    expect(rows.map((r) => r.sigla)).toEqual([
      'SD BM', 'CB BM', '3º SGT BM', '2º SGT BM', '1º SGT BM', 'ST BM', 'ASP OF BM',
      '2º TEN BM', '1º TEN BM', 'CAP BM', 'MAJ BM', 'TEN CEL BM', 'CEL BM',
    ]);
  });
});

describe('carga de exemplo', () => {
  it('recusa no ambiente de teste', async () => {
    await expect(cargaExemplo(banco, 'teste', '2026-11-01')).rejects.toThrow('Carga de exemplo recusada no ambiente de teste');
    expect(await n('select count(*)::int as n from militar')).toBe(0);
  });

  it('exemplo cria 53 militares', async () => {
    expect(await cargaExemplo(banco, undefined, '2026-11-01')).toEqual({ militares: 53 });
    expect(await n('select count(*)::int as n from militar')).toBe(53);
    expect(await n("select count(*)::int as n from militar where matricula !~ '^990\\d{3}-\\d$'")).toBe(0);
    expect(await n("select count(*)::int as n from lotacao where jornada = 'adm'")).toBe(17);
    expect(await n("select count(*)::int as n from lotacao where jornada = 'pronto'")).toBe(36);
    const { rows } = await banco.query<{ nome: string; ordem_ciclo: number; n: number }>(
      `select e.nome, e.ordem_ciclo, count(l.id)::int as n from equipe e left join lotacao l on l.equipe_id = e.id
        group by e.nome, e.ordem_ciclo order by e.ordem_ciclo`,
    );
    expect(rows).toEqual([
      { nome: 'Alfa', ordem_ciclo: 1, n: 9 },
      { nome: 'Bravo', ordem_ciclo: 2, n: 10 },
      { nome: 'Charlie', ordem_ciclo: 3, n: 9 },
      { nome: 'Delta', ordem_ciclo: 4, n: 8 },
    ]);
    expect(await n('select count(*)::int as n from militar where motorista')).toBe(8);
    expect(await n('select count(*)::int as n from militar where voluntario_jes')).toBe(10);
    expect(await n('select count(distinct nome_guerra)::int as n from militar')).toBe(53);
  });

  it('exemplo e idempotente', async () => {
    await cargaExemplo(banco, undefined, '2026-11-01');
    expect(await n('select count(*)::int as n from militar')).toBe(53);
  });

  it('servicos de exemplo', async () => {
    const { rows } = await banco.query<{ nome: string; tipo: string; operacao: string | null; cor: string; turnos: string }>(
      `select s.nome, s.tipo, s.operacao, s.cor,
              string_agg(t.letra || ' ' || to_char(t.inicio, 'HH24') || '-' || to_char(t.fim, 'HH24'), ', ' order by t.letra) as turnos
         from servico s join turno t on t.servico_id = s.id group by s.id order by s.nome`,
    );
    expect(rows).toEqual([
      { nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E', turnos: 'A 00-08, B 08-16, C 16-00' },
      { nome: 'Defensoria', tipo: 'pjes', operacao: null, cor: '#8C4A7A', turnos: 'U 07-19' },
      { nome: 'Expediente', tipo: 'ordinario', operacao: null, cor: '#8A94A1', turnos: 'U 08-16' },
      { nome: 'JES', tipo: 'pjes', operacao: null, cor: '#6E56A8', turnos: 'A 08-20, B 20-08' },
      { nome: 'PE Seguro', tipo: 'diaria', operacao: 'PE Seguro', cor: '#3C5F9C', turnos: 'A 00-08, B 08-16, C 16-00' },
      { nome: 'Pronto', tipo: 'ordinario', operacao: null, cor: '#2F8F5B', turnos: 'A 08-20, B 20-08' },
      { nome: 'Saldo', tipo: 'ordinario', operacao: null, cor: '#2B7BB9', turnos: 'A 08-20, B 20-08' },
    ]);
  });
});
