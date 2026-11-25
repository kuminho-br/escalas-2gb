import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Dados fictícios (D7): militar de matrícula inexistente, uma seção e uma escala só para os testes.
let banco: Banco;
let militar: string;
let usuario: string;
let unidade: string;
let escala: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-44', nome: 'Seção 44', mae_id: raiz, desde: '2026-11-01' });
  const posto = await inserir(banco, 'posto_grad', { sigla: 'SD-44', nome: 'Soldado 44', ordem: 944 });
  militar = await inserir(banco, 'militar', { matricula: '990944-4', posto_grad_id: posto, nome_guerra: 'COLETA' });
  usuario = await inserir(banco, 'usuario', { nome: 'Coleta', email: 'coleta44@exemplo.test', militar_id: militar });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
});
afterAll(async () => {
  await banco.fechar();
});

const coleta = (mes: string, extra: Record<string, unknown> = {}) => inserir(banco, 'voluntariado_coleta', { unidade_id: unidade, mes, ...extra });
const registro = (extra: Record<string, unknown>) =>
  inserir(banco, 'registro_de_alteracao', { usuario_id: usuario, unidade_id: unidade, mes: '2026-12-01', antes: '[]', depois: '[]', ...extra });

describe('migração 0044: a coleta do voluntariado', () => {
  it('a mesma unidade e mês não entram duas vezes', async () => {
    await coleta('2026-12-01');
    await expect(coleta('2026-12-01')).rejects.toMatchObject({ code: '23505' });
    await coleta('2027-01-01');
  });

  it('o mês precisa ser o dia 1', async () => {
    await expect(coleta('2026-12-15')).rejects.toMatchObject({ code: '23514' });
  });

  it('abrir e fechar a coleta entram na auditoria', async () => {
    const id = await coleta('2027-02-01', { aberta_por: usuario });
    await banco.query('delete from voluntariado_coleta where id = $1', [id]);
    const acoes = (await banco.query<{ acao: string }>("select acao from auditoria where tabela = 'voluntariado_coleta' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });
});

describe('migração 0044: o lançamento pelo militar', () => {
  it('o lançamento nasce como feito pelo escalante (pelo_militar falso)', async () => {
    const id = await inserir(banco, 'voluntariado_lancamento', { militar_id: militar, mes: '2026-12-01' });
    const { rows } = await banco.query<{ pelo_militar: boolean }>('select pelo_militar from voluntariado_lancamento where id = $1', [id]);
    expect(rows[0]!.pelo_militar).toBe(false);
  });
});

describe('migração 0044: o registro de alterações', () => {
  it('aceita a correção do voluntariado de um militar, sem justificativa', async () => {
    await registro({ tipo: 'voluntariado_corrigido', militar_id: militar });
  });

  it('a correção do voluntariado precisa dizer de qual militar', async () => {
    await expect(registro({ tipo: 'voluntariado_corrigido' })).rejects.toMatchObject({ code: '23514' });
  });

  it('a alteração no passado da escala pede a escala e uma justificativa de pelo menos 10 letras', async () => {
    await expect(registro({ tipo: 'escala_no_passado', escala_id: escala, data: '2026-12-02' })).rejects.toMatchObject({ code: '23514' });
    await expect(registro({ tipo: 'escala_no_passado', escala_id: escala, data: '2026-12-02', justificativa: '   curta   ' })).rejects.toMatchObject({ code: '23514' });
    await expect(registro({ tipo: 'escala_no_passado', data: '2026-12-02', justificativa: 'Trocou por motivo de saúde' })).rejects.toMatchObject({ code: '23514' });
    await registro({ tipo: 'escala_no_passado', escala_id: escala, data: '2026-12-02', justificativa: 'Trocou por motivo de saúde' });
  });

  it('o tipo é um dos dois e o mês é o dia 1', async () => {
    await expect(registro({ tipo: 'outro', militar_id: militar })).rejects.toMatchObject({ code: '23514' });
    await expect(registro({ tipo: 'voluntariado_corrigido', militar_id: militar, mes: '2026-12-10' })).rejects.toMatchObject({ code: '23514' });
  });
});
