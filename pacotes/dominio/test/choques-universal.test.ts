import { describe, expect, it } from 'vitest';
import { detectarChoques, montarHorarios } from '../src/choques.ts';

// 6.37, Task 1: o choque vale para todos, com o expediente do Adm sem exceção. A regra nova entra pela opção `tiramDoExpediente`
// (os nomes dos serviços cadastrados com "Pode tirar o militar do Adm do expediente"); sem a opção, vale a regra do protótipo (casos gravados).
const { porChave } = montarHorarios([
  { servico: 'Expediente', turno: 'A', inicio: '08:00', fim: '16:00' },
  { servico: 'JES', turno: 'A', inicio: '09:00', fim: '17:00' },
  { servico: 'JES', turno: 'B', inicio: '17:00', fim: '21:00' },
  { servico: 'PJES', turno: 'A', inicio: '10:00', fim: '14:00' },
  { servico: 'Pronto', turno: 'A', inicio: '08:00', fim: '20:00' },
  { servico: 'Saldo', turno: 'A', inicio: '08:00', fim: '20:00' },
  { servico: 'Diária', turno: 'A', inicio: '08:00', fim: '12:00' },
]);
const MAT = '990001-1';
const UTIL = '2026-11-24'; // terça-feira
const SABADO = '2026-11-28';
const expediente = (dia = UTIL) => ({ mat: MAT, dia, servico: 'Expediente', turno: 'A', implicito: true });
const real = (servico: string, dia = UTIL, turno = 'A') => ({ mat: MAT, dia, servico, turno });
const UNIVERSAL = { tiramDoExpediente: ['Saldo'] };

describe('o choque universal com o expediente do Adm (6.37)', () => {
  it.each(['JES', 'PJES', 'Pronto', 'Diária'])('%s às horas do expediente, num dia útil, é choque do tipo expediente', (servico) => {
    const { choques } = detectarChoques([expediente(), real(servico)], porChave, UNIVERSAL);
    expect(choques).toHaveLength(1);
    expect(choques[0]!.tipo).toBe('expediente');
    expect([choques[0]!.a.implicito, choques[0]!.b.implicito].sort()).toEqual([false, true]);
  });

  it('o serviço que tira do expediente (Saldo), sobreposto a ele, não choca, e o expediente some do dia', () => {
    expect(detectarChoques([expediente(), real('Saldo')], porChave, UNIVERSAL).choques).toEqual([]);
    // o expediente que sumiu não choca com mais ninguém no dia: o JES, que antes pegava o expediente, agora só choca com o Saldo
    const comJes = detectarChoques([expediente(), real('Saldo'), real('JES')], porChave, UNIVERSAL).choques;
    expect(comJes.map((c) => c.tipo)).toEqual(['sobreposicao']);
  });

  it('a lista de tipos do protótipo é ignorada com a regra nova: o JES choca mesmo quando só a Diária chocaria', () => {
    const tipos = { JES: 'extra', 'Diária': 'Diária' };
    expect(detectarChoques([expediente(), real('JES')], porChave, { ...UNIVERSAL, tipos }).choques.map((c) => c.tipo)).toEqual(['expediente']);
  });

  it('o nome do serviço da lista não diferencia maiúsculas nem acentos', () => {
    expect(detectarChoques([expediente(), real('Saldo')], porChave, { tiramDoExpediente: ['SALDO'] }).choques).toEqual([]);
    expect(detectarChoques([expediente(), real('Diária')], porChave, { tiramDoExpediente: ['diaria'] }).choques).toEqual([]);
  });

  it('com a lista vazia ninguém tira do expediente: o Saldo também choca', () => {
    expect(detectarChoques([expediente(), real('Saldo')], porChave, { tiramDoExpediente: [] }).choques.map((c) => c.tipo)).toEqual(['expediente']);
  });

  it('o serviço que tira só vale se se sobrepõe ao expediente: o JES das 17h às 21h passa, com ou sem Saldo no dia', () => {
    expect(detectarChoques([expediente(), real('JES', UTIL, 'B')], porChave, UNIVERSAL).choques).toEqual([]);
  });

  it('o expediente de verdade (o serviço Adm lançado no dia) substitui o implícito', () => {
    expect(detectarChoques([expediente(), { mat: MAT, dia: UTIL, servico: 'Expediente', turno: 'A' }], porChave, UNIVERSAL).choques).toEqual([]);
  });

  it('fim de semana não tem expediente: o JES não choca', () => {
    expect(detectarChoques([real('JES', SABADO)], porChave, UNIVERSAL).choques).toEqual([]);
  });

  it('o expediente de um dia só choca com o que cai no mesmo dia (o outro militar também não entra)', () => {
    const outro = { mat: '990002-2', dia: UTIL, servico: 'JES', turno: 'A' };
    expect(detectarChoques([expediente(), outro], porChave, UNIVERSAL).choques).toEqual([]);
  });

  it('dois expedientes implícitos não chocam entre si', () => {
    expect(detectarChoques([expediente(), expediente('2026-11-25')], porChave, UNIVERSAL).choques).toEqual([]);
  });
});

describe('sem a opção, a regra do protótipo continua (casos gravados)', () => {
  it('com a lista de tipos, o expediente implícito só choca com Diária', () => {
    const tipos = { JES: 'extra', 'Diária': 'Diária' };
    expect(detectarChoques([expediente(), real('JES')], porChave, { tipos }).choques).toEqual([]);
    expect(detectarChoques([expediente(), real('Diária')], porChave, { tipos }).choques).toHaveLength(1);
  });

  it('o Saldo substitui o expediente pelo nome, como antes', () => {
    expect(detectarChoques([expediente(), real('Saldo')], porChave, {}).choques).toEqual([]);
  });
});
