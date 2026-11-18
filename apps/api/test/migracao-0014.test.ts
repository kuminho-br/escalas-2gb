import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Dados fictícios (D7): Pronto com turno A, uma escala e um militar de matrícula inexistente.
let banco: Banco;
let escala: string;
let pronto: string;
let turnoA: string;
let militar: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  const unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-R', nome: 'Seção R', mae_id: raiz, desde: '2026-11-01' });
  const posto = await inserir(banco, 'posto_grad', { sigla: 'SD-R', nome: 'Soldado R', ordem: 903 });
  pronto = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '08:00', fim: '20:00' });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(banco, 'escala_servico', { escala_id: escala, servico_id: pronto, ordem: 1 }, 'escala_id');
  militar = await inserir(banco, 'militar', { matricula: '990990-1', posto_grad_id: posto, nome_guerra: 'REMOVIDO' });
});
afterAll(async () => {
  await banco.fechar();
});

const remocao = (data: string) => inserir(banco, 'remocao', { militar_id: militar, escala_id: escala, servico_id: pronto, turno_id: turnoA, data });
const alocacao = (data: string) =>
  inserir(banco, 'alocacao', { militar_id: militar, escala_id: escala, servico_id: pronto, turno_id: turnoA, data, origem: 'manual' });
const remocoes = async () => (await banco.query<{ data: string }>("select to_char(data, 'YYYY-MM-DD') as data from remocao order by data")).rows.map((r) => r.data);

describe('migração 0014: remoções', () => {
  it('escalar o militar de novo na mesma combinação apaga a remoção; outra data não apaga', async () => {
    await remocao('2026-12-05');
    await remocao('2026-12-06');
    await alocacao('2026-12-07');
    expect(await remocoes()).toEqual(['2026-12-05', '2026-12-06']);
    await alocacao('2026-12-05');
    expect(await remocoes()).toEqual(['2026-12-06']);
  });

  it('a mesma remoção não entra duas vezes', async () => {
    await remocao('2026-12-10');
    await expect(remocao('2026-12-10')).rejects.toMatchObject({ code: '23505' });
  });

  it('a remoção entra na auditoria, na criação e quando é desfeita', async () => {
    const id = await remocao('2026-12-20');
    await banco.query('delete from remocao where id = $1', [id]);
    const acoes = (await banco.query<{ acao: string }>("select acao from auditoria where tabela = 'remocao' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });
});

