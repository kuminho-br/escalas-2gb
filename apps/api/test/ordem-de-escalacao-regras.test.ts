import { describe, expect, it } from 'vitest';
import { aplicarOrdem, sequenciaDePreenchimento, vagasDoMes } from '../src/escala/ordem.ts';

// Cenário fictício (D7): ABT (prioridade 1) com Chefe 1–1 e Combatente 2–4; AR (prioridade 2) com Chefe 1–1 e Resgatista 1–2.
const composicaoAbt = [{ funcaoId: 'f-chefe', funcao: 'Chefe', minimo: 1, maximo: 1 }, { funcaoId: 'f-comb', funcao: 'Combatente', minimo: 2, maximo: 4 }];
const composicaoAr = [{ funcaoId: 'f-chefe', funcao: 'Chefe', minimo: 1, maximo: 1 }, { funcaoId: 'f-res', funcao: 'Resgatista', minimo: 1, maximo: 2 }];
const ABT = { guarnicaoId: 'g-abt', guarnicao: 'ABT', prioridade: 1, composicao: composicaoAbt };
const AR = { guarnicaoId: 'g-ar', guarnicao: 'AR', prioridade: 2, composicao: composicaoAr };
const rotulo = (v: { guarnicao: string; funcao: string; vaga: number }) => `${v.guarnicao} ${v.funcao} ${v.vaga}`;
const vaga = (guarnicaoId: string, funcaoId: string, n: number) => ({ guarnicaoId, funcaoId, vaga: n });

describe('vagas do mês', () => {
  it('cada função vira tantas vagas quanto o máximo; as até o mínimo são obrigatórias', () => {
    const vagas = vagasDoMes([ABT]);
    expect(vagas.map((v) => [rotulo(v), v.obrigatoria])).toEqual([
      ['ABT Chefe 1', true], ['ABT Combatente 1', true], ['ABT Combatente 2', true], ['ABT Combatente 3', false], ['ABT Combatente 4', false],
    ]);
  });

  it('a guarnição que está em duas faixas aparece uma vez', () => {
    expect(vagasDoMes([ABT, AR, ABT]).filter((v) => v.guarnicao === 'ABT')).toHaveLength(5);
  });

  it('a ordem de exibição é prioridade (sem prioridade por último), depois nome', () => {
    const semPrioridade = { ...AR, guarnicaoId: 'g-z', guarnicao: 'Zebra', prioridade: null };
    const antes = { ...AR, guarnicaoId: 'g-a', guarnicao: 'Alfa', prioridade: null };
    expect([...new Set(vagasDoMes([semPrioridade, AR, antes, ABT]).map((v) => v.guarnicao))]).toEqual(['ABT', 'AR', 'Alfa', 'Zebra']);
  });
});

describe('aplicar a ordem', () => {
  const vagas = vagasDoMes([ABT, AR]);

  it('sem ordem cadastrada, as posições seguem a ordem de exibição (1 a n)', () => {
    const r = aplicarOrdem(vagas, null);
    expect(r.map((v) => v.posicao)).toEqual(r.map((_, i) => i + 1));
    expect(rotulo(r[0]!)).toBe('ABT Chefe 1');
  });

  it('a ordem cadastrada dá a vez de cada vaga; quem não está nela fica sem número', () => {
    const r = aplicarOrdem(vagas, [vaga('g-ar', 'f-chefe', 1), vaga('g-abt', 'f-chefe', 1)]);
    const pos = (g: string, f: string, n: number) => r.find((v) => v.guarnicaoId === g && v.funcaoId === f && v.vaga === n)!.posicao;
    expect(pos('g-ar', 'f-chefe', 1)).toBe(1);
    expect(pos('g-abt', 'f-chefe', 1)).toBe(2);
    expect(pos('g-abt', 'f-comb', 1)).toBeNull();
    // continua na ordem de exibição
    expect(rotulo(r[0]!)).toBe('ABT Chefe 1');
  });

  it('vaga que deixou de existir (máximo diminuiu) é ignorada e as posições ficam sem buraco (Review Focus 4)', () => {
    const r = aplicarOrdem(vagas, [vaga('g-abt', 'f-chefe', 1), vaga('g-abt', 'f-comb', 9), vaga('g-abt', 'f-comb', 2), vaga('g-ar', 'f-chefe', 1)]);
    expect(r.filter((v) => v.posicao !== null).map((v) => [rotulo(v), v.posicao])).toEqual([['ABT Chefe 1', 1], ['ABT Combatente 2', 2], ['AR Chefe 1', 3]]);
  });

  it('vaga nova, sem item, fica sem número e entra no fim da sequência de preenchimento', () => {
    const r = aplicarOrdem(vagas, [vaga('g-ar', 'f-chefe', 1), vaga('g-abt', 'f-chefe', 1)]);
    const seq = sequenciaDePreenchimento(r);
    expect(seq.slice(0, 2).map(rotulo)).toEqual(['AR Chefe 1', 'ABT Chefe 1']);
    // as sem número vêm depois, na ordem de exibição
    expect(seq.slice(2).map(rotulo)).toEqual(r.filter((v) => v.posicao === null).map(rotulo));
    expect(seq).toHaveLength(vagas.length);
  });
});
