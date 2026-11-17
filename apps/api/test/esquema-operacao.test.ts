import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

let banco: Banco;
let unidade: string;
let posto: string;
let pronto: string;
let turnoA: string;
let jes: string;
let turnoJes: string;
let escala: string;
let funcao: string;
let seq = 0;

async function militar() {
  seq++;
  return inserir(banco, 'militar', {
    matricula: `99${String(7000 + seq).padStart(4, '0')}-${seq % 10}`,
    posto_grad_id: posto,
    nome_guerra: `OP${seq}`,
  });
}

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]?.id
    ?? (await inserir(banco, 'unidade', { tipo: 'corporacao', sigla: 'RAIZ-O', nome: 'Raiz', desde: '2026-11-01' }));
  unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-O', nome: 'Seção', mae_id: raiz, desde: '2026-11-01' });
  posto = await inserir(banco, 'posto_grad', { sigla: 'SD-O', nome: 'Soldado', ordem: 902 });
  pronto = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '08:00', fim: '20:00' });
  jes = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
  turnoJes = await inserir(banco, 'turno', { servico_id: jes, letra: 'A', inicio: '08:00', fim: '20:00' });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(banco, 'escala_servico', { escala_id: escala, servico_id: pronto, ordem: 1 }, 'escala_id');
  funcao = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Motorista' });
});
afterAll(async () => {
  await banco.fechar();
});

function alocacao(militarId: string, extra: Record<string, unknown> = {}) {
  return inserir(banco, 'alocacao', {
    militar_id: militarId, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: '2026-11-05', origem: 'manual', ...extra,
  });
}

describe('erros esperados', () => {
  it('turno repetido no servico', async () => {
    await expect(inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '20:00', fim: '08:00' })).rejects.toThrow();
  });

  it('operacao so em diaria', async () => {
    await expect(
      inserir(banco, 'servico', { unidade_id: unidade, nome: 'X', tipo: 'pjes', operacao: 'Op', cor: '#000000' }),
    ).rejects.toThrow();
  });

  it('voluntariado so A ou B', async () => {
    const m = await militar();
    await expect(
      inserir(banco, 'voluntariado', { militar_id: m, data: '2026-11-05', turno_padrao: 'C', origem: 'manual' }),
    ).rejects.toThrow();
  });

  it('alocacao de servico fora da escala', async () => {
    const m = await militar();
    await expect(alocacao(m, { servico_id: jes, turno_id: turnoJes })).rejects.toThrow(/não faz parte/);
  });

  it('alocacao com turno de outro servico', async () => {
    const m = await militar();
    await expect(alocacao(m, { turno_id: turnoJes })).rejects.toThrow(/não é deste serviço/);
  });

  it('alocacao repetida', async () => {
    const m = await militar();
    await alocacao(m);
    await expect(alocacao(m)).rejects.toThrow();
  });

  it('permuta com um item so', async () => {
    const m = await militar();
    const a = await alocacao(m, { data: '2026-11-06' });
    await expect(
      banco.transacao(async (tx) => {
        const p = await inserir(tx, 'permuta', { mes: '2026-11-01' });
        await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a, militar_original_id: m });
      }),
    ).rejects.toThrow(/exatamente 2/);
  });

  it('cota sem dia 1', async () => {
    await expect(
      inserir(banco, 'cota', { mes: '2026-11-02', unidade_id: unidade, servico_id: jes, quantidade: 1, origem: 'interna', prioridade: 1 }),
    ).rejects.toThrow();
  });

  it('cota de servico ordinario', async () => {
    await expect(
      inserir(banco, 'cota', { mes: '2026-11-01', unidade_id: unidade, servico_id: pronto, quantidade: 1, origem: 'interna', prioridade: 1 }),
    ).rejects.toThrow(/PJES ou diária/);
  });

  it('usuario sem militar', async () => {
    await expect(inserir(banco, 'usuario', { nome: 'X', email: 'x@exemplo.test' })).rejects.toThrow();
  });

  it('composicao com maximo menor que minimo', async () => {
    const g = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'UR-1' });
    const v = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    await expect(inserir(banco, 'composicao', { guarnicao_versao_id: v, funcao_id: funcao, minimo: 2, maximo: 1 })).rejects.toThrow();
  });

  it('cnh_exigida invalida', async () => {
    const g = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'UR-2' });
    const v = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    await expect(
      inserir(banco, 'composicao', { guarnicao_versao_id: v, funcao_id: funcao, minimo: 1, cnh_exigida: 'F' }),
    ).rejects.toThrow();
  });
});

describe('casos validos', () => {
  it('permuta com dois itens', async () => {
    const m1 = await militar();
    const m2 = await militar();
    const a1 = await alocacao(m1, { data: '2026-11-07' });
    const a2 = await alocacao(m2, { data: '2026-11-08' });
    await banco.transacao(async (tx) => {
      const p = await inserir(tx, 'permuta', { mes: '2026-11-01' });
      await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a1, militar_original_id: m1 });
      await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a2, militar_original_id: m2 });
    });
    const { rows } = await banco.query<{ n: number }>('select count(*)::int as n from permuta_item');
    expect(rows[0]!.n).toBe(2);
  });

  it('turno que atravessa a meia-noite', async () => {
    const s = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E' });
    const t = await inserir(banco, 'turno', { servico_id: s, letra: 'C', inicio: '16:00', fim: '00:00' });
    expect(t).toBeTruthy();
  });
});
