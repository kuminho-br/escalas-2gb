import { describe, expect, it } from 'vitest';
import { distribuirAdm } from '../src/distribuicao-adm.ts';

const dias = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];

describe('distribuição do Adm com remoções', () => {
  it('removido nao volta', () => {
    const r = distribuirAdm({ dias, turnos: 2, militares: [{ mat: '990001-1', removidos: ['2026-11-12'] }, { mat: '990002-2' }] });
    expect(r.novas.filter((n) => n.mat === '990001-1').map((n) => n.dia)).not.toContain('2026-11-12');
    expect(r.porMilitar['990001-1'].novas).toBe(2);
  });

  it('removido nao volta: o dia que faltar vira faltou', () => {
    const r = distribuirAdm({ dias, turnos: 4, militares: [{ mat: '990001-1', removidos: ['2026-11-12'] }] });
    expect(r.novas.map((n) => n.dia)).toEqual(['2026-11-10', '2026-11-11', '2026-11-13']);
    expect(r.porMilitar['990001-1'].faltou).toBe(1);
  });

  it('remoção de um militar não tira o dia dos outros', () => {
    const r = distribuirAdm({ dias, turnos: 4, militares: [{ mat: '990001-1', removidos: ['2026-11-12'] }, { mat: '990002-2' }] });
    expect(r.novas.filter((n) => n.mat === '990002-2')).toHaveLength(4);
  });

  it('sem militares nao lanca', () => {
    expect(distribuirAdm({ dias, turnos: 2, militares: [] }).novas).toEqual([]);
  });
});
