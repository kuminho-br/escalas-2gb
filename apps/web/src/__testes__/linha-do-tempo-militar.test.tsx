import type { FichaMilitar } from 'contratos';
import { describe, expect, it } from 'vitest';
import { linhaDoTempoDoMilitar } from '@/lib/linha-do-tempo-militar';

type Periodo = FichaMilitar['rastreio'][number];
const periodo = (id: string, desde: string, ate: string | null, unidadeSigla: string, equipe: string | null, jornada: 'pronto' | 'adm'): Periodo => ({ id, unidadeSigla, equipe, jornada, quadro: 'QBMG', situacao: 'Ativa', desde, ate });
const afastamento = (id: string, tipo: string, inicio: string, fim: string): FichaMilitar['afastamentos'][number] => ({ id, tipo, tipoAfastamentoId: `t-${id}`, inicio, fim, motivo: null, boletim: null });

describe('linhaDoTempoDoMilitar', () => {
  it('dois períodos e um afastamento entre eles saem do mais novo para o mais velho, sem repetir', () => {
    // a API manda o rastreio do mais novo para o mais velho; a função não depende disso
    const rastreio = [periodo('r2', '2026-11-01', null, '1ª SB', 'Bravo', 'pronto'), periodo('r1', '2026-03-01', '2026-10-31', '1ª SB', 'Alfa', 'pronto')];
    const itens = linhaDoTempoDoMilitar(rastreio, [afastamento('a1', 'Férias', '2026-08-01', '2026-08-30')]);
    expect(itens).toEqual([
      { quando: '2026-11-01', tipo: 'situacao', texto: 'Equipe Alfa → Bravo' },
      { quando: '2026-08-01', tipo: 'afastamento', texto: 'Afastamento: Férias (01/08 a 30/08)' },
      { quando: '2026-03-01', tipo: 'situacao', texto: '1ª SB · Equipe Alfa · Pronto · QBMG · Ativa' },
    ]);
    expect(linhaDoTempoDoMilitar([...rastreio].reverse(), [afastamento('a1', 'Férias', '2026-08-01', '2026-08-30')])).toEqual(itens);
  });

  // [foco 4] o afastamento atravessa a mudança de equipe: os dois itens aparecem, cada um uma vez, em ordem
  it('afastamento que atravessa a mudança de equipe aparece uma vez, no mês em que começou, e a mudança também', () => {
    const rastreio = [periodo('r2', '2026-11-01', null, '1ª SB', 'Bravo', 'pronto'), periodo('r1', '2026-03-01', '2026-10-31', '1ª SB', 'Alfa', 'pronto')];
    const itens = linhaDoTempoDoMilitar(rastreio, [afastamento('a1', 'LTS', '2026-10-15', '2026-11-20')]);
    expect(itens.map((i) => [i.quando, i.tipo, i.texto])).toEqual([
      ['2026-11-01', 'situacao', 'Equipe Alfa → Bravo'],
      ['2026-10-15', 'afastamento', 'Afastamento: LTS (15/10 a 20/11)'],
      ['2026-03-01', 'situacao', '1ª SB · Equipe Alfa · Pronto · QBMG · Ativa'],
    ]);
  });

  it('o primeiro período diz a situação inteira; sem equipe, a equipe não aparece', () => {
    expect(linhaDoTempoDoMilitar([periodo('r1', '2026-03-01', null, '2ª SB', null, 'adm')], [])).toEqual([{ quando: '2026-03-01', tipo: 'situacao', texto: '2ª SB · Adm · QBMG · Ativa' }]);
  });

  it('muda a lotação e a jornada juntas: diz só o que mudou, na ordem lotação, equipe, jornada', () => {
    const rastreio = [periodo('r1', '2026-01-01', '2026-02-28', '2ª SB', null, 'adm'), periodo('r2', '2026-03-01', null, '1ª SB', null, 'pronto')];
    expect(linhaDoTempoDoMilitar(rastreio, []).map((i) => i.texto)).toEqual(['Lotação 2ª SB → 1ª SB · Jornada Adm → Pronto', '2ª SB · Adm · QBMG · Ativa']);
  });

  it('mudança só de quadro e de situação diz o que mudou', () => {
    const rastreio = [
      { ...periodo('r1', '2026-01-01', '2026-02-28', '1ª SB', 'Alfa', 'pronto'), quadro: 'QOA', situacao: 'Ativa' },
      { ...periodo('r2', '2026-03-01', null, '1ª SB', 'Alfa', 'pronto'), quadro: 'QOC', situacao: 'Reserva' },
    ];
    expect(linhaDoTempoDoMilitar(rastreio, [])[0]!.texto).toBe('Quadro QOA → QOC · Situação Ativa → Reserva');
  });

  it('equipe que passa a existir ou deixa de existir aparece como "nenhuma"', () => {
    const rastreio = [periodo('r1', '2026-01-01', '2026-02-28', '1ª SB', null, 'pronto'), periodo('r2', '2026-03-01', null, '1ª SB', 'Alfa', 'pronto')];
    expect(linhaDoTempoDoMilitar(rastreio, [])[0]!.texto).toBe('Equipe nenhuma → Alfa');
  });

  it('dois períodos iguais seguidos dizem que nada mudou (em vez de um texto vazio)', () => {
    const rastreio = [periodo('r1', '2026-01-01', '2026-02-28', '1ª SB', 'Alfa', 'pronto'), periodo('r2', '2026-03-01', null, '1ª SB', 'Alfa', 'pronto')];
    expect(linhaDoTempoDoMilitar(rastreio, [])[0]!.texto).toBe('Sem mudança na situação');
  });

  it('afastamento que passa do ano mostra os anos; sem nada, a lista é vazia', () => {
    const itens = linhaDoTempoDoMilitar([], [afastamento('a1', 'Férias', '2026-12-20', '2027-01-10')]);
    expect(itens).toEqual([{ quando: '2026-12-20', tipo: 'afastamento', texto: 'Afastamento: Férias (20/12/2026 a 10/01/2027)' }]);
    expect(linhaDoTempoDoMilitar([], [])).toEqual([]);
  });
});
