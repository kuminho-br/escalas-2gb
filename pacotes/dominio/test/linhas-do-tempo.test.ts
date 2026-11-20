import { describe, expect, it } from 'vitest';
import type { FuncaoExigida } from '../src/ativacao.ts';
import { linhasDaGuarnicao, type OcupacaoNaLinha, type TrechoDaLinha } from '../src/linhas-do-tempo.ts';

// Minutos desde 00h do dia: 08h = 480, 16h = 960, 20h = 1200, 08h do dia seguinte = 1920.
const MOTORISTA: FuncaoExigida = { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1 };
const AUXILIAR: FuncaoExigida = { funcaoId: 'f-aux', funcao: 'Auxiliar', minimo: 2 };
const CHEFE: FuncaoExigida = { funcaoId: 'f-che', funcao: 'Chefe', minimo: 1 };

let proximo = 0;
const oc = (f: FuncaoExigida, inicio: number, fim: number, chave: string): OcupacaoNaLinha => ({ funcaoId: f.funcaoId, funcao: f.funcao, inicio, fim, chave, indice: proximo++ });

/** Os trechos de uma linha cobrem [de, ate) sem buraco. */
function cobre(linha: TrechoDaLinha[], de: number, ate: number): boolean {
  let pos = de;
  for (const t of [...linha].sort((a, b) => a.inicio - b.inicio)) {
    if (t.inicio !== pos) return false;
    pos = t.fim;
  }
  return pos === ate;
}

describe('linhasDaGuarnicao', () => {
  it('junta o militar que emenda turnos', () => {
    proximo = 0;
    const r = linhasDaGuarnicao([MOTORISTA], [oc(MOTORISTA, 480, 1200, 'm1|pronto'), oc(MOTORISTA, 1200, 1920, 'm1|pronto')], []);
    expect(r).toEqual([{ funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, linhas: [[{ inicio: 480, fim: 1920, tipo: 'ocupado', indices: [0, 1] }]] }]);
  });

  it('não junta serviços diferentes, mas mantém na mesma linha', () => {
    proximo = 0;
    const r = linhasDaGuarnicao([MOTORISTA], [oc(MOTORISTA, 480, 960, 'm1|diaria'), oc(MOTORISTA, 960, 1200, 'm2|saldo')], []);
    expect(r[0]!.linhas).toEqual([
      [
        { inicio: 480, fim: 960, tipo: 'ocupado', indices: [0] },
        { inicio: 960, fim: 1200, tipo: 'ocupado', indices: [1] },
      ],
    ]);
  });

  it('a vaga entra na linha livre', () => {
    proximo = 0;
    const r = linhasDaGuarnicao(
      [AUXILIAR],
      [oc(AUXILIAR, 480, 1200, 'm1|pronto')],
      [
        { funcaoId: 'f-aux', funcao: 'Auxiliar', inicio: 480, fim: 1200, faltam: 1 },
        { funcaoId: 'f-aux', funcao: 'Auxiliar', inicio: 1200, fim: 1920, faltam: 2 },
      ],
    );
    expect(r[0]!.linhas).toHaveLength(2);
    for (const linha of r[0]!.linhas) expect(cobre(linha, 480, 1920)).toBe(true);
    // a vaga de 480–1200 e a de 1200–1920 que cai na mesma linha viram uma só (4.2: vaga em faixa única); a outra vaga de 1200–1920 fica na outra linha
    expect(r[0]!.linhas.flat().filter((t) => t.tipo === 'vaga')).toHaveLength(2);
  });

  it('gente além do mínimo abre linha', () => {
    proximo = 0;
    const r = linhasDaGuarnicao([CHEFE], [oc(CHEFE, 480, 1200, 'a'), oc(CHEFE, 480, 1200, 'b'), oc(CHEFE, 480, 1200, 'c')], []);
    expect(r[0]!.linhas).toHaveLength(3);
  });

  it('vagas que se encostam na mesma linha viram uma só (4.2)', () => {
    proximo = 0;
    const r = linhasDaGuarnicao(
      [MOTORISTA],
      [],
      [
        { funcaoId: 'f-mot', funcao: 'Motorista', inicio: 0, fim: 480, faltam: 1 },
        { funcaoId: 'f-mot', funcao: 'Motorista', inicio: 480, fim: 960, faltam: 1 },
        { funcaoId: 'f-mot', funcao: 'Motorista', inicio: 960, fim: 1440, faltam: 1 },
      ],
    );
    expect(r[0]!.linhas).toEqual([[{ inicio: 0, fim: 1440, tipo: 'vaga' }]]);
  });

  it('um ocupado no meio separa as vagas (4.2)', () => {
    proximo = 0;
    const r = linhasDaGuarnicao(
      [MOTORISTA],
      [oc(MOTORISTA, 480, 960, 'm1|diaria')],
      [
        { funcaoId: 'f-mot', funcao: 'Motorista', inicio: 0, fim: 480, faltam: 1 },
        { funcaoId: 'f-mot', funcao: 'Motorista', inicio: 960, fim: 1440, faltam: 1 },
      ],
    );
    expect(r[0]!.linhas).toEqual([
      [
        { inicio: 0, fim: 480, tipo: 'vaga' },
        { inicio: 480, fim: 960, tipo: 'ocupado', indices: [0] },
        { inicio: 960, fim: 1440, tipo: 'vaga' },
      ],
    ]);
  });

  it('função fora do modelo vem depois, com mínimo 0', () => {
    proximo = 0;
    const despachante: FuncaoExigida = { funcaoId: 'f-des', funcao: 'Despachante', minimo: 1 };
    const r = linhasDaGuarnicao([MOTORISTA], [oc(despachante, 480, 1200, 'x'), oc(MOTORISTA, 480, 1200, 'y')], []);
    expect(r.map((f) => [f.funcao, f.minimo])).toEqual([
      ['Motorista', 1],
      ['Despachante', 0],
    ]);
  });

  it('função sem ninguém e sem falta não aparece', () => {
    proximo = 0;
    const opcional: FuncaoExigida = { funcaoId: 'f-op', funcao: 'Opcional', minimo: 0 };
    const r = linhasDaGuarnicao([MOTORISTA, opcional], [oc(MOTORISTA, 480, 1200, 'y')], []);
    expect(r.map((f) => f.funcao)).toEqual(['Motorista']);
  });
});
