import { describe, expect, it } from 'vitest';
import { distribuidasPorCota } from '../src/cadastros/cotas-regras.ts';

const cota = (id: string, servicoId: string, quantidade: number) => ({ id, servicoId, quantidade });

describe('alocações distribuídas por cota', () => {
  it('uma cota por serviço recebe a contagem do serviço', () => {
    const r = distribuidasPorCota([cota('c1', 's1', 10), cota('c2', 's2', 5)], new Map([['s1', 4], ['s2', 5]]));
    expect(r.get('c1')).toBe(4);
    expect(r.get('c2')).toBe(5);
  });

  it('duas cotas do mesmo serviço consomem na ordem recebida (prioridade)', () => {
    const r = distribuidasPorCota([cota('interna', 's1', 6), cota('externa', 's1', 4)], new Map([['s1', 8]]));
    expect(r.get('interna')).toBe(6);
    expect(r.get('externa')).toBe(2);
  });

  it('o que passa da soma das cotas fica na última, para a tela mostrar o estouro', () => {
    const r = distribuidasPorCota([cota('interna', 's1', 6), cota('externa', 's1', 4)], new Map([['s1', 13]]));
    expect(r.get('interna')).toBe(6);
    expect(r.get('externa')).toBe(7);
  });

  it('serviço sem alocação fica em zero', () => {
    expect(distribuidasPorCota([cota('c1', 's1', 3)], new Map()).get('c1')).toBe(0);
  });
});
