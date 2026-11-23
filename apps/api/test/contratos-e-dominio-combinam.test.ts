import { CategoriaCnh, somarMeses, TurnoPadrao } from 'contratos';
import { CNH_CATEGORIAS, mesVizinho, turnosPadraoExigidos } from 'dominio';
import { describe, expect, it } from 'vitest';

// Entrega 6.18, Task 9, item 3: o contrato e o motor têm cada um a sua cópia de poucas definições (os pacotes não dependem um do outro); este teste não deixa
// as cópias se separarem: se uma mudar, a outra tem de mudar junto.
describe('as cópias do contrato e do motor dizem a mesma coisa', () => {
  it('somarMeses (contrato) e mesVizinho (motor) dão o mesmo mês, para frente e para trás, na virada do ano', () => {
    for (const mes of ['2026-01', '2026-11', '2026-12', '2027-06']) {
      for (const n of [-14, -13, -12, -1, 0, 1, 2, 12, 13, 25]) expect(somarMeses(mes, n), `${mes} ${n}`).toBe(mesVizinho(mes, n));
    }
  });

  it('as categorias da carteira do contrato são as do motor, na mesma ordem', () => {
    expect(CategoriaCnh.options.join('')).toBe(CNH_CATEGORIAS);
  });

  it('o turno padrão que o motor devolve passa pelo esquema do contrato', () => {
    for (const [inicio, fim] of [['08:00', '20:00'], ['20:00', '08:00'], ['00:00', '08:00'], ['16:00', '24:00']] as const) {
      for (const t of turnosPadraoExigidos(inicio, fim)) expect(TurnoPadrao.safeParse(t).success, `${inicio}-${fim}`).toBe(true);
    }
  });
});
