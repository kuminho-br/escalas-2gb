import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Entrega 6.27, Task 1: a escala dos oficiais vira escala comum. Migra até a 0035, grava um mês completo do jeito antigo (escolhas, cobertura, mês encerrado
// com saldo) e aplica a 0036. Dados fictícios (D7).
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
let unidade: string;
let servico: string;
let turnoA: string;
let turnoB: string;
let mes: string;
let mesVazio: string;
let capitao: string;
let major: string;
let tenente: string;
let servicoNovo: string;
const q = async <T>(sql: string, p: unknown[] = []) => (await banco.query<T>(sql, p)).rows;

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0036');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  unidade = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M36', nome: 'Grupamento M36', mae_id: raiz, desde: '2026-01-01' });
  servico = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Oficiais', tipo: 'ordinario', cor: '#336699' });
  turnoA = await inserir(banco, 'turno', { servico_id: servico, letra: 'A', inicio: '07:00', fim: '19:00' });
  turnoB = await inserir(banco, 'turno', { servico_id: servico, letra: 'B', inicio: '19:00', fim: '07:00' });
  const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'CAP'")).rows[0]!.id;
  const novo = (m: string, n: string) => inserir(banco, 'militar', { matricula: m, posto_grad_id: posto, nome_guerra: n });
  [capitao, major, tenente] = [await novo('990736-1', 'CAPITAO'), await novo('990736-2', 'MAJOR'), await novo('990736-3', 'TENENTE')];
  // um mês encerrado: cotas, três turnos (um com cobertura, um vazio), saldo
  mes = await inserir(banco, 'oficiais_mes', { unidade_id: unidade, mes: '2026-09-01', servico_id: servico, cotas_em: '2026-08-25T12:00:00Z', fechada_em: '2026-08-30T12:00:00Z', encerrada_em: '2026-10-01T12:00:00Z' });
  for (const [i, m] of [capitao, major].entries()) {
    await banco.query('insert into oficiais_cota (mes_id, militar_id, ordem, dias, devido, cota, sobra) values ($1, $2, $3, 30, 1, 1, false)', [mes, m, i + 1]);
    await banco.query('insert into oficiais_participante (mes_id, militar_id) values ($1, $2)', [mes, m]);
  }
  await banco.query("insert into oficiais_turno (mes_id, dia, turno_id, militar_id) values ($1, '2026-09-01', $2, $3), ($1, '2026-09-01', $4, null)", [mes, turnoA, capitao, turnoB]);
  await banco.query("insert into oficiais_turno (mes_id, dia, turno_id, militar_id, saiu_militar_id) values ($1, '2026-09-02', $2, $3, $4)", [mes, turnoA, major, capitao]);
  await banco.query("insert into oficiais_saldo (unidade_id, militar_id, mes_id, tipo, valor, tirado, devido, turnos_dia, turnos_noite) values ($1, $2, $3, 'mes', 0.5, 1, 0.5, 1, 0)", [unidade, capitao, mes]);
  await banco.query("insert into oficiais_saldo (unidade_id, militar_id, tipo, valor, motivo) values ($1, $2, 'ajuste', 2, 'Ajuste de teste')", [unidade, major]);
  // um mês mais novo, ainda sem cotas, com outro serviço escolhido: o serviço de Saldo da escala passa a ser o do mês mais recente
  servicoNovo = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Oficiais 2', tipo: 'ordinario', cor: '#339966' });
  await inserir(banco, 'turno', { servico_id: servicoNovo, letra: 'A', inicio: '07:00', fim: '19:00' });
  mesVazio = await inserir(banco, 'oficiais_mes', { unidade_id: unidade, mes: '2026-12-01', servico_id: servicoNovo });
  await banco.query('insert into oficiais_participante (mes_id, militar_id) values ($1, $2)', [mesVazio, tenente]);
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0036: a escala dos oficiais como escala comum', () => {
  it('cada unidade com mês gravado ganha a escala "Oficiais de operações", de rodada de cotas, com o serviço que os meses usavam', async () => {
    const escalas = await q<{ id: string; nome: string; distribuicao: string; monta: boolean }>(
      'select id, nome, distribuicao, monta_blocos_voluntariado as monta from escala where unidade_id = $1', [unidade]);
    expect(escalas).toEqual([{ id: expect.any(String), nome: 'Oficiais de operações', distribuicao: 'rodada_de_cotas', monta: false }]);
    expect((await q<{ servico_id: string }>('select servico_id from escala_servico where escala_id = $1 order by ordem', [escalas[0]!.id])).map((r) => r.servico_id)).toEqual([servicoNovo, servico]);
    // as escalas de antes seguem como pré-escala
    expect((await q('select 1 from escala where distribuicao <> $1 and unidade_id <> $2 limit 1', ['pre_escala', unidade]))).toHaveLength(0);
  });

  it('os meses passam a ser da escala: o que tinha cotas vira aberto, e as datas e as marcas ficam iguais', async () => {
    const meses = await q<{ id: string; mes: string; aberto: boolean; fechada: boolean; encerrada: boolean; escala: string }>(
      "select id, to_char(mes, 'YYYY-MM') as mes, aberto_em is not null as aberto, fechada_em is not null as fechada, encerrada_em is not null as encerrada, escala_id as escala from oficiais_mes where unidade_id = $1 order by mes", [unidade]);
    expect(meses).toEqual([
      { id: mes, mes: '2026-09', aberto: true, fechada: true, encerrada: true, escala: expect.any(String) },
      { id: mesVazio, mes: '2026-12', aberto: false, fechada: false, encerrada: false, escala: expect.any(String) },
    ]);
    expect(meses[0]!.escala).toBe(meses[1]!.escala);
    expect((await q('select 1 from oficiais_participante where mes_id = $1', [mes]))).toHaveLength(2);
    expect((await q('select 1 from oficiais_participante where mes_id = $1 and militar_id = $2', [mesVazio, tenente]))).toHaveLength(1);
    expect((await q('select 1 from oficiais_cota where mes_id = $1', [mes]))).toHaveLength(2);
  });

  it('cada turno com nome vira uma alocação de origem "distribuicao"; o lugar vazio some; a troca de nome vira cobertura', async () => {
    const alocacoes = await q<{ militar: string; dia: string; turno_id: string; origem: string; saiu: string | null }>(
      `select a.militar_id as militar, to_char(a.data, 'YYYY-MM-DD') as dia, a.turno_id, a.origem, c.saiu_militar_id as saiu
         from alocacao a join escala e on e.id = a.escala_id left join oficiais_cobertura c on c.alocacao_id = a.id
        where e.unidade_id = $1 order by a.data, a.turno_id`, [unidade]);
    expect(alocacoes).toEqual([
      { militar: capitao, dia: '2026-09-01', turno_id: turnoA, origem: 'distribuicao', saiu: null },
      { militar: major, dia: '2026-09-02', turno_id: turnoA, origem: 'distribuicao', saiu: capitao },
    ]);
    expect((await q("select 1 from information_schema.tables where table_name = 'oficiais_turno'"))).toHaveLength(0);
  });

  it('o saldo do mês encerrado e o ajuste continuam, ligados ao mesmo mês', async () => {
    const saldos = await q<{ tipo: string; valor: string; mes_id: string | null }>('select tipo, valor::text, mes_id from oficiais_saldo where unidade_id = $1 order by tipo', [unidade]);
    expect(saldos).toEqual([{ tipo: 'ajuste', valor: '2.000000', mes_id: null }, { tipo: 'mes', valor: '0.500000', mes_id: mes }]);
  });

  it('o mês é único por escala; o serviço e o "cotas_em" saem do mês', async () => {
    const colunas = (await q<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'oficiais_mes' order by column_name")).map((c) => c.column_name);
    expect(colunas).toEqual(expect.arrayContaining(['escala_id', 'aberto_em']));
    expect(colunas).not.toContain('servico_id');
    expect(colunas).not.toContain('cotas_em');
    const escala = (await q<{ escala_id: string }>('select escala_id from oficiais_mes where id = $1', [mes]))[0]!.escala_id;
    await expect(inserir(banco, 'oficiais_mes', { unidade_id: unidade, mes: '2026-09-01', escala_id: escala })).rejects.toThrow();
  });

  it('a auditoria da cobertura fica ligada, e rodar de novo não duplica nada', async () => {
    const antes = (await q<{ n: number }>('select count(*)::int as n from alocacao')).at(0)!.n;
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0036_oficiais_escala_comum.sql'), 'utf8'));
    expect((await q<{ n: number }>('select count(*)::int as n from alocacao')).at(0)!.n).toBe(antes);
    expect((await q('select 1 from escala where unidade_id = $1', [unidade]))).toHaveLength(1);
    expect((await q("select 1 from pg_trigger where tgrelid = 'oficiais_cobertura'::regclass and tgname = 'auditoria_registro'"))).toHaveLength(1);
    expect((await q('select 1 from oficiais_cobertura'))).toHaveLength(1);
  });
});
