import { describe, expect, it } from 'vitest';
import { montarHorarios } from '../src/choques.ts';
import { distribuirCotas, type EntradaCotas } from '../src/distribuicao-cotas.ts';

const dia = '2026-11-12';
const entrada = (extra: Partial<EntradaCotas> = {}): EntradaCotas => ({
  mes: '2026-11',
  operacoes: [{ nome: 'Bioma', servico: 'Bioma', prioridade: 1, dias: [dia], turnos: [{ turno: 'A', vagas: 1 }] }],
  cotas: [{ id: 'c1', operacao: 'Bioma', quantidade: 5, origem: 'interna' }],
  militares: [{ mat: '990001-1' }, { mat: '990002-2' }],
  voluntariado: [
    { mat: '990001-1', dia, turno: 'A', servico: '' },
    { mat: '990002-2', dia, turno: 'A', servico: '' },
  ],
  alocacoes: [],
  expediente: [],
  horarios: montarHorarios([
    { servico: 'Bioma', turno: 'A', inicio: '08:00', fim: '16:00' },
    { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
  ]).porChave,
  tipos: { Bioma: 'Diária', Pronto: 'Ordinário' },
  voluntariosJes: null,
  ...extra,
});
const quem = (r: ReturnType<typeof distribuirCotas>) => r.novas.map((n) => n.mat);

describe('distribuição de cotas com remoções', () => {
  it('sem remoção, o primeiro da ordem fica com a vaga', () => {
    expect(quem(distribuirCotas(entrada()))).toEqual(['990001-1']);
  });

  it('removido nao volta, vaga vai para outro', () => {
    const r = distribuirCotas(entrada({ remocoes: [{ mat: '990001-1', dia, servico: 'Bioma', turno: 'A' }] }));
    expect(quem(r)).toEqual(['990002-2']);
  });

  it('removido nao volta nem na compulsória', () => {
    const r = distribuirCotas(entrada({
      voluntariado: [{ mat: '990001-1', dia: '2026-11-20', turno: 'A', servico: '' }],
      militares: [{ mat: '990001-1' }],
      remocoes: [{ mat: '990001-1', dia, servico: 'Bioma', turno: 'A' }],
    }));
    expect(r.novas).toEqual([]);
    expect(r.vazias[0].motivo).toBe('o escalante removeu o militar dessa vaga');
  });

  it('remocao de outro servico nao bloqueia', () => {
    const r = distribuirCotas(entrada({ remocoes: [{ mat: '990001-1', dia, servico: 'Pronto', turno: 'A' }] }));
    expect(quem(r)).toEqual(['990001-1']);
  });

  it('mes sem cota nao lanca', () => {
    const r = distribuirCotas(entrada({ cotas: [] }));
    expect(r.novas).toEqual([]);
    expect(r.avisos).toContain('"Bioma": não há cota cadastrada para o mês; nada será distribuído.');
  });

  it('sem voluntariado nao lanca', () => {
    const r = distribuirCotas(entrada({ voluntariado: [] }));
    expect(r.novas).toEqual([]);
    expect(r.vazias[0].motivo).toBe('ninguém preencheu o formulário do mês');
  });

  it('serviço e turno da remoção sem diferença de caixa', () => {
    const r = distribuirCotas(entrada({ remocoes: [{ mat: '990001-1', dia, servico: 'BIOMA', turno: 'a' }] }));
    expect(quem(r)).toEqual(['990002-2']);
  });

  it('Pronto B no último dia do mês barra a diária do dia 1 seguinte', () => {
    const r = distribuirCotas(entrada({
      mes: '2026-12',
      operacoes: [{ nome: 'Bioma', servico: 'Bioma', prioridade: 1, dias: ['2026-12-01'], turnos: [{ turno: 'A', vagas: 1 }] }],
      horarios: montarHorarios([
        { servico: 'Bioma', turno: 'A', inicio: '00:00', fim: '08:00' },
        { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
      ]).porChave,
      voluntariado: [
        { mat: '990001-1', dia: '2026-12-01', turno: 'A', servico: '' },
        { mat: '990002-2', dia: '2026-12-01', turno: 'A', servico: '' },
      ],
      alocacoes: [{ mat: '990001-1', dia: '2026-11-30', servico: 'Pronto', turno: 'B' }],
    }));
    expect(quem(r)).toEqual(['990002-2']);
  });
});
