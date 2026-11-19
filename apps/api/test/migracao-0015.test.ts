import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Dados fictícios (D7): uma escala, uma guarnição com duas funções e um militar de matrícula inexistente.
let banco: Banco;
let alocacao: string;
let guarnicao: string;
let chefe: string;
let motorista: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  const unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-A', nome: 'Seção A', mae_id: raiz, desde: '2026-11-01' });
  const posto = await inserir(banco, 'posto_grad', { sigla: 'SD-A', nome: 'Soldado A', ordem: 904 });
  const pronto = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  const turnoA = await inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '08:00', fim: '20:00' });
  const escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(banco, 'escala_servico', { escala_id: escala, servico_id: pronto, ordem: 1 }, 'escala_id');
  guarnicao = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'ABT' });
  chefe = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Chefe' });
  motorista = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Motorista' });
  const militar = await inserir(banco, 'militar', { matricula: '990991-1', posto_grad_id: posto, nome_guerra: 'ACUMULA' });
  alocacao = await inserir(banco, 'alocacao', {
    militar_id: militar, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: '2026-12-05', guarnicao_id: guarnicao, funcao_id: chefe, origem: 'manual',
  });
});
afterAll(async () => {
  await banco.fechar();
});

const acumulo = (funcao = motorista) => inserir(banco, 'alocacao_acumulo', { alocacao_id: alocacao, guarnicao_id: guarnicao, funcao_id: funcao });
const quantos = async () => Number((await banco.query<{ n: string }>('select count(*)::text as n from alocacao_acumulo where alocacao_id = $1', [alocacao])).rows[0]!.n);

describe('migração 0015: acúmulo de funções', () => {
  it('o mesmo acúmulo (alocação, guarnição e função) não entra duas vezes', async () => {
    await acumulo(motorista);
    await expect(acumulo(motorista)).rejects.toMatchObject({ code: '23505' });
  });

  it('o acúmulo entra na auditoria, na criação e quando é tirado', async () => {
    const id = await acumulo(chefe);
    await banco.query('delete from alocacao_acumulo where id = $1', [id]);
    const acoes = (await banco.query<{ acao: string }>("select acao from auditoria where tabela = 'alocacao_acumulo' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });

  it('apagar a alocação apaga os acúmulos dela', async () => {
    expect(await quantos()).toBe(1);
    await banco.query('delete from alocacao where id = $1', [alocacao]);
    expect(await quantos()).toBe(0);
  });
});
