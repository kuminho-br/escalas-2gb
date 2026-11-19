import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Dados fictícios (D7): uma escala, uma guarnição e duas funções.
let banco: Banco;
let escala: string;
let guarnicao: string;
let chefe: string;
let motorista: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  const unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-O', nome: 'Seção O', mae_id: raiz, desde: '2026-11-01' });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  guarnicao = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'ABT' });
  chefe = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Chefe' });
  motorista = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Motorista' });
});
afterAll(async () => {
  await banco.fechar();
});

const versao = (vigencia: string) => inserir(banco, 'ordem_escala_versao', { escala_id: escala, vigencia_desde: vigencia });
const item = (versaoId: string, posicao: number, funcao = chefe, vaga = 1) =>
  inserir(banco, 'ordem_escala_item', { versao_id: versaoId, posicao, guarnicao_id: guarnicao, funcao_id: funcao, vaga });
const itens = async (versaoId: string) => Number((await banco.query<{ n: string }>('select count(*)::text as n from ordem_escala_item where versao_id = $1', [versaoId])).rows[0]!.n);

describe('migração 0017: ordem de escala', () => {
  it('uma versão por escala e mês; o mês precisa ser o dia 1', async () => {
    await versao('2026-12-01');
    await expect(versao('2026-12-01')).rejects.toMatchObject({ code: '23505' });
    await expect(versao('2026-12-15')).rejects.toMatchObject({ code: '23514' });
  });

  it('a mesma vaga não entra duas vezes, nem a mesma posição; posição e vaga começam em 1', async () => {
    const v = await versao('2027-01-01');
    await item(v, 1, chefe, 1);
    await expect(item(v, 2, chefe, 1)).rejects.toMatchObject({ code: '23505' });
    await expect(item(v, 1, motorista, 1)).rejects.toMatchObject({ code: '23505' });
    await expect(item(v, 0, motorista, 1)).rejects.toMatchObject({ code: '23514' });
    await expect(item(v, 3, motorista, 0)).rejects.toMatchObject({ code: '23514' });
  });

  it('apagar a versão apaga os itens dela', async () => {
    const v = await versao('2027-02-01');
    await item(v, 1);
    await item(v, 2, motorista);
    expect(await itens(v)).toBe(2);
    await banco.query('delete from ordem_escala_versao where id = $1', [v]);
    expect(await itens(v)).toBe(0);
  });

  it('a versão e os itens entram na auditoria', async () => {
    const v = await versao('2027-03-01');
    const i = await item(v, 1);
    const tabelas = (await banco.query<{ tabela: string }>("select distinct tabela from auditoria where registro_id = any($1)", [[v, i]])).rows.map((r) => r.tabela).sort();
    expect(tabelas).toEqual(['ordem_escala_item', 'ordem_escala_versao']);
  });
});
