import { describe, expect, it } from 'vitest';
import { novaBaseGuarnicao } from '../src/guarnicao.ts';

describe('novaBaseGuarnicao', () => {
  const base = [
    { mat: '990001-1', dia: '2026-11-12', turno: 'A', servico: 'Pronto', funcao: 'CHEFE', unidade: 'ABT' },
    { mat: '990002-2', dia: '2026-11-12', turno: 'A', servico: 'Pronto', funcao: '', unidade: '' },
    { mat: '990003-3', dia: '2026-11-12', turno: 'A', servico: 'Pronto', funcao: 'AUXILIAR', unidade: 'ABT' },
  ];

  it('só as chaves aplicadas avançam; a removida sai; a nova entra; o resto fica', () => {
    const r = novaBaseGuarnicao(base, {
      aplicadas: [
        { chave: '990002-2|2026-11-12|A', estado: { f: 'MOTORISTA', u: 'ABT' }, servico: 'Pronto' },
        { chave: '990003-3|2026-11-12|A', estado: null, servico: 'Pronto' },
        { chave: '990004-4|2026-11-12|A', estado: { f: 'AUXILIAR', u: 'ABT' }, servico: 'Bioma' },
      ],
    });
    expect(r).toEqual([
      base[0],
      { mat: '990002-2', dia: '2026-11-12', turno: 'A', servico: 'Pronto', funcao: 'MOTORISTA', unidade: 'ABT' },
      { mat: '990004-4', dia: '2026-11-12', turno: 'A', servico: 'Bioma', funcao: 'AUXILIAR', unidade: 'ABT' },
    ]);
  });

  it('sem nada aplicado, a base fica igual (sem repetir a chave)', () => {
    expect(novaBaseGuarnicao([...base, base[0]], { aplicadas: [] })).toEqual(base);
  });
});
