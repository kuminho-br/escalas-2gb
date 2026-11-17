import type { VersaoSalva } from 'contratos';
import { describe, expect, it } from 'vitest';
import { desativadaAPartirDe, diferencasDeVersao, versaoNoMes } from '../src/cadastros/guarnicoes-regras.ts';

const comp = (funcao: string, minimo = 1, maximo = 1, cnhExigida: string | null = null) => ({ funcaoId: `id-${funcao}`, funcao, minimo, maximo, cnhExigida });
const v = (extra: Partial<VersaoSalva> = {}): VersaoSalva => ({
  vigencia: '2026-11', viatura: 'ABT-01', tipoViatura: null, prioridade: 1, ativa: true, composicao: [comp('Combatente', 2, 3), comp('Motorista', 1, 1, 'D')], ...extra,
});

describe('diferenças entre versões', () => {
  it('antes nulo é nova', () => expect(diferencasDeVersao(null, v())).toEqual(['nova']));
  it('igual não tem diferença', () => expect(diferencasDeVersao(v(), v())).toEqual([]));
  it('viatura: ABT-01 → ABT-02', () => expect(diferencasDeVersao(v(), v({ viatura: 'ABT-02' }))).toEqual(['viatura: ABT-01 → ABT-02']));
  it('viatura vazia vira sem viatura', () => expect(diferencasDeVersao(v(), v({ viatura: null }))).toEqual(['viatura: ABT-01 → sem viatura']));
  it('tipo: nenhum → Auto Resgate', () => expect(diferencasDeVersao(v(), v({ tipoViatura: 'Auto Resgate' }))).toEqual(['tipo: sem tipo → Auto Resgate']));
  it('prioridade: 1 → 2', () => expect(diferencasDeVersao(v(), v({ prioridade: 2 }))).toEqual(['prioridade: 1 → 2']));
  it('prioridade vazia vira sem prioridade', () => expect(diferencasDeVersao(v(), v({ prioridade: null }))).toEqual(['prioridade: 1 → sem prioridade']));
  it('ativa: sim → não', () => expect(diferencasDeVersao(v(), v({ ativa: false }))).toEqual(['ativa: sim → não']));
  it('Socorrista: incluída', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [...v().composicao, comp('Socorrista')] }))).toEqual(['Socorrista: incluída']);
  });
  it('Motorista: retirada', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('Combatente', 2, 3)] }))).toEqual(['Motorista: retirada']);
  });
  it('Combatente: mínimo 2 → 3', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('Combatente', 3, 3), comp('Motorista', 1, 1, 'D')] }))).toEqual(['Combatente: mínimo 2 → 3']);
  });
  it('Combatente: máximo 3 → 4', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('Combatente', 2, 4), comp('Motorista', 1, 1, 'D')] }))).toEqual(['Combatente: máximo 3 → 4']);
  });
  it('Motorista: CNH D → C', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('Combatente', 2, 3), comp('Motorista', 1, 1, 'C')] }))).toEqual(['Motorista: CNH D → C']);
  });
  it('Motorista: CNH D → nenhuma', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('Combatente', 2, 3), comp('Motorista', 1, 1, null)] }))).toEqual(['Motorista: CNH D → nenhuma']);
  });
  it('ordem diferente não é diferença', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [...v().composicao].reverse() }))).toEqual([]);
  });
  it('funções comparadas pelo nome normalizado', () => {
    expect(diferencasDeVersao(v(), v({ composicao: [comp('combatente', 2, 3), comp('MOTORISTA', 1, 1, 'D')] }))).toEqual([]);
  });
});

describe('desativada a partir de', () => {
  const v = (vigencia: string, ativa: boolean) => ({ vigencia, ativa });
  it('tudo ativo é nulo', () => expect(desativadaAPartirDe([v('2026-11', true), v('2027-01', true)])).toBeNull());
  it('só a última inativa', () => expect(desativadaAPartirDe([v('2027-01', false), v('2026-11', true)])).toBe('2027-01'));
  it('as duas últimas inativas dá a primeira delas', () => {
    expect(desativadaAPartirDe([v('2026-11', true), v('2026-12', false), v('2027-01', false)])).toBe('2026-12');
  });
  it('inativa no meio e ativa depois é nulo', () => expect(desativadaAPartirDe([v('2026-11', true), v('2026-12', false), v('2027-01', true)])).toBeNull());
});

describe('versão no mês', () => {
  const versoes = [{ vigencia: '2027-01' }, { vigencia: '2026-11' }];
  it('dezembro pega a de novembro', () => expect(versaoNoMes(versoes, '2026-12')).toEqual({ vigencia: '2026-11' }));
  it('janeiro pega a de janeiro', () => expect(versaoNoMes(versoes, '2027-01')).toEqual({ vigencia: '2027-01' }));
  it('outubro não tem versão', () => expect(versaoNoMes(versoes, '2026-10')).toBeNull());
});
