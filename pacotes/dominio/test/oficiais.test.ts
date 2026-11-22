import { describe, expect, it } from 'vitest';
import { calcularCotas, diasPresentes, ordemDeEscolha, saldoDeEntrada, saldoDoMes, type TurnoDoMes } from '../src/oficiais.ts';

const NOMES = ['a1', 'a2', 'a3', 'a4', 'a5', 'f', 'm1', 'm2'];
const PARTICIPANTES = NOMES.map((militarId) => ({ militarId, dias: militarId === 'f' ? 16 : 31 }));
const COTAS = [8, 8, 8, 8, 8, 4, 9, 9];

/** Os 62 turnos de janeiro lançados conforme as cotas, em ordem de escolha. */
function turnosCheios(): TurnoDoMes[] {
  const turnos: TurnoDoMes[] = [];
  let i = 0;
  const donos = NOMES.flatMap((id, k) => Array<string>(COTAS[k]).fill(id));
  for (let d = 1; d <= 31; d++) {
    for (const turno of ['dia', 'noite'] as const) {
      turnos.push({ dia: `2027-01-${String(d).padStart(2, '0')}`, turno, militarId: donos[i++], saiuMilitarId: null });
    }
  }
  return turnos;
}

describe('oficiais: cotas (exemplo dos 62 turnos)', () => {
  const r = calcularCotas(62, PARTICIPANTES);

  it('devido proporcional à presença', () => {
    expect(r[0].devido).toBeCloseTo((62 * 31) / 233, 6);
    expect(r[0].devido).toBeCloseTo(8.2489, 4);
    expect(r[5].devido).toBeCloseTo(4.2575, 4);
  });

  it('cotas 8,8,8,8,8,4,9,9, sobra só nos dois mais modernos, soma 62', () => {
    expect(r.map((x) => x.cota)).toEqual(COTAS);
    expect(r.map((x) => x.sobra)).toEqual([false, false, false, false, false, false, true, true]);
    expect(r.reduce((s, x) => s + x.cota, 0)).toBe(62);
  });

  it('a sobra começa pelo mais moderno com presença', () => {
    const c = calcularCotas(10, [
      { militarId: 'a', dias: 10 },
      { militarId: 'b', dias: 10 },
      { militarId: 'c', dias: 10 },
      { militarId: 'z', dias: 0 },
    ]);
    // 10/3 = 3,33 → pisos 3,3,3; sobra 1 vai para 'c', nunca para 'z'
    expect(c.map((x) => x.cota)).toEqual([3, 3, 4, 0]);
    expect(c[3].sobra).toBe(false);
  });

  it('ninguém presente: tudo zero, sem NaN', () => {
    const c = calcularCotas(62, [{ militarId: 'a', dias: 0 }, { militarId: 'b', dias: 0 }]);
    expect(c.map((x) => x.cota)).toEqual([0, 0]);
    expect(c.map((x) => x.devido)).toEqual([0, 0]);
    expect(c.every((x) => !x.sobra)).toBe(true);
  });
});

describe('oficiais: dias presentes', () => {
  it('período em aberto menos as férias', () => {
    expect(diasPresentes('2027-01', [{ desde: '2026-12-01', ate: null }], [{ inicio: '2027-01-11', fim: '2027-01-26' }])).toBe(15);
  });
  it('período que termina em 10/01', () => {
    expect(diasPresentes('2027-01', [{ desde: '2026-12-01', ate: '2027-01-10' }], [])).toBe(10);
  });
  it('afastamento que atravessa a virada do mês conta só os dias dentro do mês', () => {
    expect(diasPresentes('2027-01', [{ desde: '2026-01-01', ate: null }], [{ inicio: '2026-12-28', fim: '2027-01-03' }])).toBe(28);
  });
  it('período que começa no meio do mês', () => {
    expect(diasPresentes('2027-01', [{ desde: '2027-01-20', ate: null }], [])).toBe(12);
  });
});

describe('oficiais: ordem de escolha', () => {
  const of = (militarId: string, postoOrdem: number, antiguidade: number | null, nomeGuerra = militarId) => ({ militarId, postoOrdem, antiguidade, nomeGuerra });

  it('posto mais alto primeiro', () => {
    expect(ordemDeEscolha([of('maj', 2, 1), of('cel', 0, 9)], [])).toEqual(['cel', 'maj']);
  });
  it('no mesmo posto, antiguidade crescente', () => {
    expect(ordemDeEscolha([of('x', 3, 7), of('y', 3, 3)], [])).toEqual(['y', 'x']);
  });
  it('os sem antiguidade vêm depois dos com antiguidade do mesmo posto', () => {
    expect(ordemDeEscolha([of('s', 5, null), of('c', 5, 40)], [])).toEqual(['c', 's']);
  });
  it('sem antiguidade segue a ordem manual', () => {
    expect(ordemDeEscolha([of('a', 5, null, 'ANA'), of('b', 5, null, 'BIA')], ['b', 'a'])).toEqual(['b', 'a']);
  });
  it('sem ordem manual, pelo nome de guerra', () => {
    expect(ordemDeEscolha([of('b', 5, null, 'BIA'), of('a', 5, null, 'ANA')], [])).toEqual(['a', 'b']);
  });
  it('a ordem manual não mexe no posto', () => {
    expect(ordemDeEscolha([of('t', 5, null), of('m', 2, null)], ['t', 'm'])).toEqual(['m', 't']);
  });
});

describe('oficiais: saldo do mês', () => {
  const cotas = PARTICIPANTES;
  const por = (r: ReturnType<typeof saldoDoMes>, id: string) => r.find((x) => x.militarId === id)!;

  it('exemplo dos 62 turnos: saldos conforme o design', () => {
    const r = saldoDoMes(turnosCheios(), cotas);
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) expect(por(r, id).valor).toBeCloseTo(-0.2489, 4);
    expect(por(r, 'm1').valor).toBeCloseTo(0.7511, 4);
    expect(por(r, 'm2').valor).toBeCloseTo(0.7511, 4);
    expect(por(r, 'f').valor).toBeCloseTo(-0.2575, 4);
    expect(por(r, 'a1').tirado).toBe(8);
  });

  it('cobertura: quem saiu continua com o tirado, quem cobriu também', () => {
    const turnos = turnosCheios();
    const t = turnos.find((x) => x.militarId === 'a2')!;
    t.militarId = 'a3';
    t.saiuMilitarId = 'a2';
    const r = saldoDoMes(turnos, cotas);
    expect(por(r, 'a2').tirado).toBe(8);
    expect(por(r, 'a3').tirado).toBe(9);
    // os turnos "em que está" não incluem o de que saiu
    expect(por(r, 'a2').turnosDia + por(r, 'a2').turnosNoite).toBe(7);
  });

  it('turno vazio: ninguém ganha, o total cai para 61', () => {
    const turnos = turnosCheios();
    turnos[0].militarId = null;
    const r = saldoDoMes(turnos, cotas);
    expect(por(r, 'a1').devido).toBeCloseTo((61 * 31) / 233, 6);
    expect(por(r, 'a1').tirado).toBe(7);
  });

  it('conta turnos do dia e da noite', () => {
    const turnos: TurnoDoMes[] = [
      { dia: '2027-01-01', turno: 'dia', militarId: 'a1', saiuMilitarId: null },
      { dia: '2027-01-01', turno: 'noite', militarId: 'a1', saiuMilitarId: null },
      { dia: '2027-01-02', turno: 'noite', militarId: 'a1', saiuMilitarId: null },
    ];
    const a1 = por(saldoDoMes(turnos, cotas), 'a1');
    expect([a1.turnosDia, a1.turnosNoite]).toEqual([1, 2]);
  });
});

describe('oficiais: saldo de entrada', () => {
  it('média exata dos acumulados', () => expect(saldoDeEntrada([1, -0.5, 0.25])).toBeCloseTo(0.25, 10));
  it('lista vazia dá 0', () => expect(saldoDeEntrada([])).toBe(0));
});
