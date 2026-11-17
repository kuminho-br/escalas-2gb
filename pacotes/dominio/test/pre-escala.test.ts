import { describe, expect, it } from 'vitest';
import { equipeDoDia, gerarPreEscala, type Remocao } from '../src/pre-escala.ts';

const militar = (mat: string, equipe: string) => ({ mat, jornada: 'PRONTO', equipe, secao: '1ª SB' });
const militares = [militar('990001-1', 'ALFA'), militar('990002-2', 'BRAVO'), militar('990003-3', 'CHARLIE'), militar('990004-4', 'DELTA')];
const op = { mes: '2026-11', secao: '1ª SB', equipeDia1: 'ALFA' };
// com ALFA no dia 01, o dia 12 (índice 11) é da DELTA
const doDia12 = '990004-4';
const tem = (novas: { mat: string; dia: string; turno: string }[], mat: string, dia: string, turno: string) =>
  novas.some((n) => n.mat === mat && n.dia === dia && n.turno === turno);

describe('pré-escala com remoções', () => {
  it('o dia 12 é da DELTA', () => {
    expect(equipeDoDia('ALFA', 11)).toBe('DELTA');
  });

  it('removido nao volta', () => {
    const remocoes: Remocao[] = [{ mat: doDia12, dia: '2026-11-12', servico: 'Pronto', turno: 'A' }];
    const r = gerarPreEscala([], militares, { ...op, remocoes });
    expect(tem(r.novas, doDia12, '2026-11-12', 'A')).toBe(false);
    expect(tem(r.novas, doDia12, '2026-11-12', 'B')).toBe(true);
    expect(r.puladas).toContainEqual({ chave: `${doDia12}|2026-11-12|A`, existente: 'removido' });
    expect(r.avisos).toContain('1 vaga(s) foram mantidas sem o militar porque o escalante o removeu.');
    expect(r.avisos.some((a) => a.includes('já estavam ocupadas'))).toBe(false);
  });

  it('removido nao volta mesmo gerando de novo sobre o que já existe', () => {
    const remocoes: Remocao[] = [{ mat: doDia12, dia: '2026-11-12', servico: 'Pronto', turno: 'A' }];
    const primeira = gerarPreEscala([], militares, { ...op, remocoes });
    const segunda = gerarPreEscala(primeira.novas, militares, { ...op, remocoes });
    expect(segunda.novas).toEqual([]);
  });

  it('remocao de outro servico nao bloqueia', () => {
    const remocoes: Remocao[] = [{ mat: doDia12, dia: '2026-11-12', servico: 'Saldo', turno: 'A' }];
    const r = gerarPreEscala([], militares, { ...op, remocoes });
    expect(tem(r.novas, doDia12, '2026-11-12', 'A')).toBe(true);
    expect(r.puladas).toEqual([]);
  });

  it('sem remocoes igual ao protótipo', () => {
    const existentes = [{ mat: '990001-1', dia: '2026-11-01', servico: 'Bioma', turno: 'A' }];
    expect(gerarPreEscala(existentes, militares, { ...op, remocoes: [] })).toEqual(gerarPreEscala(existentes, militares, op));
  });

  it('equipe vazia nao lanca', () => {
    const r = gerarPreEscala([], militares.slice(0, 3), op);
    expect(r.avisos).toContain('A equipe DELTA não tem militares do Pronto na seção "1ª SB"; nenhum serviço foi gerado para os dias dela.');
    expect(r.porEquipe.DELTA.alocacoes).toBe(0);
  });

  it('ciclo atravessa a virada do mês', () => {
    expect(equipeDoDia('ALFA', 28)).toBe('ALFA');
    expect(equipeDoDia('ALFA', 29)).toBe('BRAVO');
    const r = gerarPreEscala([], militares, { mes: '2028-02', secao: '1ª SB', equipeDia1: 'ALFA' });
    expect(r.resumo.dias).toBe(29);
    expect(tem(r.novas, '990001-1', '2028-02-29', 'B')).toBe(true);
  });
});
