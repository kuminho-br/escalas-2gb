import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { cargaExemplo, motivoParaRecusarExemplo } from '../src/carga/exemplo.ts';
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
      'SD', 'CB', '3º SGT', '2º SGT', '1º SGT', 'ST', 'ASP OF',
      '2º TEN', '1º TEN', 'CAP', 'MAJ', 'TEN CEL', 'CEL',
    ]);
  });
});

describe('quando a carga de exemplo pode rodar', () => {
  it('banco local (PGlite, sem DATABASE_URL) pode', () => {
    expect(motivoParaRecusarExemplo({})).toBeNull();
  });
  it('banco remoto sem AMBIENTE é recusado', () => {
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x' })).toMatch(/AMBIENTE=desenvolvimento/);
  });
  it('banco remoto marcado como teste é recusado', () => {
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'teste' })).toMatch(/recusada/);
  });
  it('banco remoto marcado como desenvolvimento pode', () => {
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'desenvolvimento' })).toBeNull();
  });
});

describe('carga de exemplo', () => {
  it('recusa no ambiente de teste', async () => {
    await expect(cargaExemplo(banco, 'teste', '2026-11-01')).rejects.toThrow('Carga de exemplo recusada no ambiente de teste');
    expect(await n('select count(*)::int as n from militar')).toBe(0);
  });

  it('exemplo cria 53 militares', async () => {
    // um militar 990 que não é da carga (ex.: o administrador local) não pode impedir a carga
    const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'CAP'")).rows[0]!.id;
    await banco.query("insert into militar (matricula, posto_grad_id, nome_guerra) values ('990999-9', $1, 'DEV')", [posto]);
    expect(await cargaExemplo(banco, undefined, '2026-11-01')).toEqual({ militares: 53 });
    await banco.query("delete from militar where matricula = '990999-9'");
    expect(await n('select count(*)::int as n from militar')).toBe(53);
    expect(await n("select count(*)::int as n from militar where matricula !~ '^990\\d{3}-\\d$'")).toBe(0);
    expect(await n("select count(*)::int as n from rastreio where jornada = 'adm'")).toBe(17);
    expect(await n("select count(*)::int as n from rastreio where jornada = 'pronto'")).toBe(36);
    const { rows } = await banco.query<{ nome: string; ordem_ciclo: number; n: number }>(
      `select e.nome, e.ordem_ciclo, count(l.id)::int as n from equipe e left join rastreio l on l.equipe_id = e.id
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
      { nome: 'Defensoria', tipo: 'pjes', operacao: null, cor: '#8C4A7A', turnos: 'A 07-19' },
      { nome: 'Expediente', tipo: 'ordinario', operacao: null, cor: '#8A94A1', turnos: 'A 08-16' },
      { nome: 'JES', tipo: 'pjes', operacao: null, cor: '#6E56A8', turnos: 'A 08-20, B 20-08' },
      { nome: 'PE Seguro', tipo: 'diaria', operacao: 'PE Seguro', cor: '#3C5F9C', turnos: 'A 00-08, B 08-16, C 16-00' },
      { nome: 'Pronto', tipo: 'ordinario', operacao: null, cor: '#2F8F5B', turnos: 'A 08-20, B 20-08' },
      { nome: 'Saldo', tipo: 'ordinario', operacao: null, cor: '#2B7BB9', turnos: 'A 08-20, B 20-08' },
    ]);
  });
});
