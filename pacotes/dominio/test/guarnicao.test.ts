import { describe, expect, it } from 'vitest';
import { chaveSlot, compararAntiguidade, novaBaseGuarnicao, postosDoModelo, type Modelos } from '../src/guarnicao.ts';

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

describe('compararAntiguidade: a ordem de antiguidade é a mesma em qualquer posição de entrada', () => {
  const sd = (mat: string, extra: { ordem?: number } = {}) => ({ mat, m: { mat, posto: 'SD BM', antig: 5, ...extra } });

  it('mesmo posto e antiguidade, um com ordem e outro sem: o sem ordem fica por último nas duas posições', () => {
    const com = sd('990002-2', { ordem: 7 });
    const sem = sd('990001-1');
    expect(compararAntiguidade(com, sem)).toBe(-1);
    expect(compararAntiguidade(sem, com)).toBe(1);
    expect([com, sem].sort(compararAntiguidade).map((x) => x.mat)).toEqual(['990002-2', '990001-1']);
    expect([sem, com].sort(compararAntiguidade).map((x) => x.mat)).toEqual(['990002-2', '990001-1']);
  });

  it('dois sem ordem empatam pela matrícula', () => {
    const a = sd('990001-1');
    const b = sd('990002-2');
    expect([b, a].sort(compararAntiguidade).map((x) => x.mat)).toEqual(['990001-1', '990002-2']);
    expect(compararAntiguidade(a, b)).toBe(-1);
    expect(compararAntiguidade(b, a)).toBe(1);
  });
});

describe('postosDoModelo devolve uma cópia', () => {
  it('mudar o objeto devolvido não muda o modelo', () => {
    const mod: Pick<Modelos, 'escalas'> = {
      escalas: {
        ORD: {
          nome: 'ORD', servicos: ['Pronto'], titulo: 'ESCALA ORD', militares: 'TODOS', dias: 'TODOS', turnos: ['A'], usaUnidade: false,
          slots: { A: [{ unidade: 'ABT', funcao: 'MOTORISTA', vagas: 1, exigeCnh: true, cnh: ['D'] }] },
        },
      },
    };
    const postos = postosDoModelo(mod);
    const k = chaveSlot('ABT', 'MOTORISTA');
    postos[k]!.cnh.push('E');
    postos[k]!.exigeCnh = false;
    expect(mod.escalas.ORD!.slots.A![0]).toMatchObject({ exigeCnh: true, cnh: ['D'] });
    expect(postosDoModelo(mod)[k]).toEqual({ exigeCnh: true, cnh: ['D'] });
  });
});
