import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7). Um banco só (a memória da máquina de teste é curta): a migração falha uma vez, o cenário se conserta e ela roda de novo.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}
const servicos = async (unidade: string) =>
  (await banco.query<{ nome: string; tipo: string; fixo: boolean; ativo: boolean }>('select nome, tipo, fixo, ativo from servico where unidade_id = $1 order by nome', [unidade])).rows;
const turnosDe = async (unidade: string, nome: string) =>
  (
    await banco.query<{ letra: string; inicio: string; fim: string }>(
      `select t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from turno t join servico s on s.id = t.servico_id where s.unidade_id = $1 and s.nome = $2 order by t.letra`,
      [unidade, nome],
    )
  ).rows;

let banco: Banco;
let secao: string;
let vazia: string;
let jes: string;
beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0020');
  secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
  const gb = (await banco.query<{ id: string }>("select id from unidade where sigla = '2º GB'")).rows[0]!.id;
  vazia = await inserir(banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: gb, desde: '2026-11-01' });
  const servico = (nome: string, tipo: string, ativo = true) => inserir(banco, 'servico', { unidade_id: secao, nome, tipo, cor: '#5B6675', ativo });
  await servico('pronto ', 'ordinario', false); // caixa e espaço diferentes, desativado
  await servico('Bioma', 'diaria');
  jes = await servico('JES', 'ordinario'); // tipo errado para um serviço fixo
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0020: serviços fixos', () => {
  it('com um serviço fixo de tipo errado, para dizendo qual e não muda nada', async () => {
    await expect(migrarAte(banco, '9999')).rejects.toThrow(/Há serviço fixo com o tipo errado: JES \(ordinario\)\. Corrija o tipo antes de migrar\./);
    const coluna = await banco.query("select 1 from information_schema.columns where table_name = 'servico' and column_name = 'fixo'");
    expect(coluna.rows).toHaveLength(0);
  });

  it('consertado o tipo, marca os que existem (sem duplicar), reativa e cria os que faltam com turnos', async () => {
    await banco.query("update servico set tipo = 'pjes' where id = $1", [jes]);
    await migrarAte(banco, '9999');
    const lista = await servicos(secao);
    expect(lista.map((s) => s.nome).sort()).toEqual(['Bioma', 'Expediente', 'JES', 'Saldo', 'pronto '].sort());
    expect(lista.find((s) => s.nome === 'pronto ')).toMatchObject({ fixo: true, ativo: true });
    expect(lista.find((s) => s.nome === 'JES')).toMatchObject({ fixo: true, tipo: 'pjes' });
    expect(lista.find((s) => s.nome === 'Saldo')).toMatchObject({ fixo: true, tipo: 'ordinario', ativo: true });
    expect(lista.find((s) => s.nome === 'Expediente')).toMatchObject({ fixo: true, tipo: 'ordinario' });
    expect(lista.find((s) => s.nome === 'Bioma')?.fixo).toBe(false);
    expect(await turnosDe(secao, 'Expediente')).toEqual([{ letra: 'A', inicio: '08:00', fim: '16:00' }]);
    expect(await turnosDe(secao, 'Saldo')).toEqual([{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }]);
  });

  it('a seção que não tinha serviço nenhum continua sem serviços', async () => {
    expect(await servicos(vazia)).toEqual([]);
  });

  it('o banco recusa JES que não seja PJES e marca como fixo o que entra com nome fixo', async () => {
    await expect(inserir(banco, 'servico', { unidade_id: vazia, nome: ' jes', tipo: 'ordinario', cor: '#5B6675' })).rejects.toThrow(/precisa ser do tipo pjes/);
    await inserir(banco, 'servico', { unidade_id: vazia, nome: 'Saldo', tipo: 'ordinario', cor: '#2B7BB9' });
    await inserir(banco, 'servico', { unidade_id: vazia, nome: 'Operação X', tipo: 'diaria', cor: '#5B6675' });
    expect((await servicos(vazia)).map((s) => [s.nome, s.fixo])).toEqual([['Operação X', false], ['Saldo', true]]);
  });

  it('o banco recusa mudar nome, tipo e desativar um serviço fixo, mas aceita cor e rótulo', async () => {
    const frase = /é fixo: o nome, o tipo e a situação não mudam/;
    await expect(banco.query("update servico set nome = 'SALDO' where unidade_id = $1 and nome = 'Saldo'", [vazia])).rejects.toThrow(frase);
    await expect(banco.query("update servico set tipo = 'diaria' where unidade_id = $1 and nome = 'Saldo'", [vazia])).rejects.toThrow(/precisa ser do tipo ordinario/);
    await expect(banco.query("update servico set ativo = false where unidade_id = $1 and nome = 'Saldo'", [vazia])).rejects.toThrow(frase);
    await banco.query("update servico set cor = '#111111', rotulo_impressao = 'SALDO' where unidade_id = $1 and nome = 'Saldo'", [vazia]);
    expect((await banco.query<{ cor: string }>("select cor from servico where unidade_id = $1 and nome = 'Saldo'", [vazia])).rows[0]!.cor).toBe('#111111');
  });
});
