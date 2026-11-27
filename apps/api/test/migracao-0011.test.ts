import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Dados fictícios e não pessoais (D7): serviços, turnos e guarnições da sandbox.
async function bancoAte0010(): Promise<Banco> {
  const banco = await bancoPglite();
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0011')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrar(banco, ate);
  return banco;
}
async function servico(banco: Banco, unidade: string, nome: string, turnos: [string, string, string][]): Promise<string> {
  // o JES é fixo e precisa ser PJES (migração 0020 recusa um JES ordinário)
  const id = await inserir(banco, 'servico', { unidade_id: unidade, nome, tipo: nome === 'JES' ? 'pjes' : 'ordinario', cor: '#2F8F5B' });
  for (const [letra, inicio, fim] of turnos) await inserir(banco, 'turno', { servico_id: id, letra, inicio, fim });
  return id;
}
const faixas = async (banco: Banco, guarnicao: string) =>
  (
    await banco.query<{ inicio: string; fim: string }>(
      `select to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from escala_guarnicao where guarnicao_id = $1 order by inicio, fim`,
      [guarnicao],
    )
  ).rows.map((r) => `${r.inicio}-${r.fim}`);

describe('migração 0011', () => {
  // [foco 16]
  it('o vínculo por letra vira vínculo por faixa e o turno único vira A', async () => {
    const banco = await bancoAte0010();
    const secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
    const pronto = await servico(banco, secao, 'Pronto', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
    const jes = await servico(banco, secao, 'JES', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
    const expediente = await servico(banco, secao, 'Expediente', [['U', '08:00', '16:00']]);
    const escala = await inserir(banco, 'escala', { unidade_id: secao, nome: 'Ordinário', titulo: 'ESCALA', militares_doc: 'todos', dias_doc: 'todos' });
    let ordem = 1;
    for (const s of [pronto, jes, expediente]) await banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, $3)', [escala, s, ordem++]);
    const g1 = await inserir(banco, 'guarnicao', { unidade_id: secao, nome: 'G1' });
    const g2 = await inserir(banco, 'guarnicao', { unidade_id: secao, nome: 'G2' });
    const g3 = await inserir(banco, 'guarnicao', { unidade_id: secao, nome: 'G3' });
    const v = await inserir(banco, 'escala_vinculo_versao', { escala_id: escala, vigencia_desde: '2026-11-01' });
    await inserir(banco, 'escala_guarnicao', { versao_id: v, guarnicao_id: g1, turno_letra: null });
    await inserir(banco, 'escala_guarnicao', { versao_id: v, guarnicao_id: g2, turno_letra: 'A' });
    await inserir(banco, 'escala_guarnicao', { versao_id: v, guarnicao_id: g3, turno_letra: 'C' });

    expect(await migrar(banco)).toContain('0011_faixas.sql');

    // "todos os turnos": uma marcação por faixa, sem duplicar (Pronto e JES têm as mesmas)
    expect(await faixas(banco, g1)).toEqual(['08:00-16:00', '08:00-20:00', '20:00-08:00']);
    expect(await faixas(banco, g2)).toEqual(['08:00-20:00']);
    // vínculo órfão (nenhum serviço da escala tem turno C) some
    expect(await faixas(banco, g3)).toEqual([]);
    expect((await banco.query<{ letra: string }>('select letra from turno where servico_id = $1', [expediente])).rows).toEqual([{ letra: 'A' }]);
    await expect(inserir(banco, 'turno', { servico_id: pronto, letra: 'U', inicio: '08:00', fim: '16:00' })).rejects.toThrow();
    await banco.fechar();
  });

  it('serviço com A e U para a migração com a mensagem', async () => {
    const banco = await bancoAte0010();
    const secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
    await servico(banco, secao, 'Misto', [['A', '08:00', '16:00'], ['U', '16:00', '20:00']]);
    await expect(migrar(banco)).rejects.toThrow('Há serviço com turno A e turno U: troque um deles antes de migrar.');
    await banco.fechar();
  });
});
