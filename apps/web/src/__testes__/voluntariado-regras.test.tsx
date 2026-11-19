import type { MilitarDoVoluntariado } from 'contratos';
import { describe, expect, it } from 'vitest';
import { alternarDia, copiarDoMes, fimDeSemana, marcarDias, proximoQueFalta, textoDoRodape } from '@/lib/voluntariado';

const m = (id: string, lancado: boolean): MilitarDoVoluntariado => ({ militarId: id, posto: 'SD BM', nomeGuerra: id.toUpperCase(), matricula: '990000-0', equipe: null, jornada: 'pronto', voluntarioJes: true, lancado, turnos: 0, dias: 0 });

describe('regras do calendário do voluntariado', () => {
  it('fimDeSemana traz os sábados e domingos do mês (novembro de 2026 começa num domingo: 9 dias)', () => {
    expect(fimDeSemana('2026-11')).toEqual(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']);
  });

  it('alternarDia: só um turno marcado marca os dois; os dois marcados desmarca os dois', () => {
    const so = alternarDia(new Set(['2026-11-05|A']), '2026-11-05');
    expect([...so].sort()).toEqual(['2026-11-05|A', '2026-11-05|B']);
    expect(alternarDia(so, '2026-11-05').size).toBe(0);
  });

  it('marcarDias acrescenta A e B dos dias sem duplicar e sem tirar o que já está marcado', () => {
    const r = marcarDias(new Set(['2026-11-05|A', '2026-11-02|B']), ['2026-11-02', '2026-11-03']);
    expect([...r].sort()).toEqual(['2026-11-02|A', '2026-11-02|B', '2026-11-03|A', '2026-11-03|B', '2026-11-05|A']);
  });

  it('copiarDoMes leva o dia N do mês anterior para o dia N e descarta o que não existe no mês (Review Focus 3)', () => {
    const r = copiarDoMes([{ data: '2026-10-30', turno: 'A' }, { data: '2026-10-31', turno: 'B' }, { data: '2026-10-05', turno: 'B' }], '2026-11');
    expect([...r].sort()).toEqual(['2026-11-05|B', '2026-11-30|A']);
    // de um mês de 30 dias para um de 31 não perde nada
    expect([...copiarDoMes([{ data: '2026-11-30', turno: 'B' }], '2026-12')]).toEqual(['2026-12-30|B']);
  });

  it('o rodapé conta turnos e dias, no singular quando é um só', () => {
    expect(textoDoRodape(new Set())).toBe('Nenhum turno marcado.');
    expect(textoDoRodape(new Set(['2026-11-05|A']))).toBe('1 turno em 1 dia.');
    expect(textoDoRodape(new Set(['2026-11-05|A', '2026-11-05|B', '2026-11-06|A']))).toBe('3 turnos em 2 dias.');
  });

  it('proximoQueFalta: o primeiro depois do atual; sem nenhum depois, o primeiro do começo; ninguém, null', () => {
    const lista = [m('a', false), m('b', true), m('c', false), m('d', true), m('e', false)];
    expect(proximoQueFalta(lista, 'a')).toBe('c');
    expect(proximoQueFalta(lista, 'c')).toBe('e');
    expect(proximoQueFalta(lista, 'e')).toBe('a');
    expect(proximoQueFalta(lista.map((x) => ({ ...x, lancado: x.militarId !== 'c' })), 'c')).toBeNull();
  });
});
