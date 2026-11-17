import { describe, expect, it } from 'vitest';
import { distribuirAdm } from '../src/distribuicao-adm.ts';

const dias = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const doAdm = { servico: 'Adm', turno: 'A' };

describe('distribuição do Adm com remoções', () => {
  it('removido nao volta', () => {
    const r = distribuirAdm({ dias, turnos: 2, ...doAdm, militares: [{ mat: '990001-1' }, { mat: '990002-2' }],
      remocoes: [{ mat: '990001-1', dia: '2026-11-12', servico: 'Adm', turno: 'A' }] });
    expect(r.novas.filter((n) => n.mat === '990001-1').map((n) => n.dia)).not.toContain('2026-11-12');
    expect(r.porMilitar['990001-1'].novas).toBe(2);
  });

  it('removido nao volta: o dia que faltar vira faltou', () => {
    const r = distribuirAdm({ dias, turnos: 4, ...doAdm, militares: [{ mat: '990001-1' }],
      remocoes: [{ mat: '990001-1', dia: '2026-11-12', servico: 'adm', turno: 'A' }] });
    expect(r.novas.map((n) => n.dia)).toEqual(['2026-11-10', '2026-11-11', '2026-11-13']);
    expect(r.porMilitar['990001-1'].faltou).toBe(1);
  });

  it('remocao de outro servico nao bloqueia o Adm', () => {
    const r = distribuirAdm({ dias, turnos: 4, ...doAdm, militares: [{ mat: '990001-1' }],
      remocoes: [{ mat: '990001-1', dia: '2026-11-12', servico: 'Bioma', turno: 'A' }] });
    expect(r.novas.map((n) => n.dia)).toContain('2026-11-12');
    expect(r.porMilitar['990001-1'].faltou).toBe(0);
  });

  it('remoção de um militar não tira o dia dos outros', () => {
    const r = distribuirAdm({ dias, turnos: 4, ...doAdm, militares: [{ mat: '990001-1' }, { mat: '990002-2' }],
      remocoes: [{ mat: '990001-1', dia: '2026-11-12', servico: 'Adm', turno: 'A' }] });
    expect(r.novas.filter((n) => n.mat === '990002-2')).toHaveLength(4);
  });

  it('sem militares nao lanca', () => {
    expect(distribuirAdm({ dias, turnos: 2, militares: [] }).novas).toEqual([]);
  });
});
