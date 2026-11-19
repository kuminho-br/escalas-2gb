import { describe, expect, it } from 'vitest';
import { alternarBloco, copiarDoMes, estadoDoBloco, faixasParaEnviar, fimDeSemana, marcarDias, proximoQueFalta, textoDoRodape, tirarBloco, type Marcas } from '@/lib/voluntariado';

// Cenário fictício: os blocos da 1ª SB de hoje são 00–08, 08–16, 16–20 e 20–24 (cortes 0, 480, 960, 1200 e 1440).
const BLOCO_08_20 = { inicio: 480, fim: 1200 };
const BLOCO_08_16 = { inicio: 480, fim: 960 };
const BLOCO_16_20 = { inicio: 960, fim: 1200 };
const vazio = (): Marcas => new Map();
const com = (dia: string, ...faixas: { inicio: number; fim: number }[]): Marcas => new Map([[dia, faixas]]);

describe('estado e alternância dos blocos', () => {
  it('um bloco inteiro é "cheio"; um bloco coberto só em parte é "parcial" e aparece como tal (Review Focus 4)', () => {
    const m = com('2026-11-05', { inicio: 480, fim: 960 });
    expect(estadoDoBloco(m, '2026-11-05', BLOCO_08_16)).toBe('cheio');
    expect(estadoDoBloco(m, '2026-11-05', BLOCO_16_20)).toBe('vazio');
    expect(estadoDoBloco(com('2026-11-05', { inicio: 480, fim: 1100 }), '2026-11-05', BLOCO_16_20)).toBe('parcial');
  });

  it('alternar um bloco cheio tira só ele; vazio ou parcial marca o bloco inteiro', () => {
    const cheio = alternarBloco(com('2026-11-05', BLOCO_08_16), '2026-11-05', BLOCO_08_16);
    expect(estadoDoBloco(cheio, '2026-11-05', BLOCO_08_16)).toBe('vazio');
    const parcial = alternarBloco(com('2026-11-05', { inicio: 480, fim: 1100 }), '2026-11-05', BLOCO_16_20);
    expect(estadoDoBloco(parcial, '2026-11-05', BLOCO_16_20)).toBe('cheio');
    expect(estadoDoBloco(parcial, '2026-11-05', BLOCO_08_16)).toBe('cheio');
  });

  it('o que se enviou é a união das faixas por dia, em horas "HH:MM" (08–16 e 16–20 viram 08:00–20:00)', () => {
    const m = com('2026-11-05', BLOCO_08_16, BLOCO_16_20);
    expect(faixasParaEnviar(m)).toEqual([{ data: '2026-11-05', inicio: '08:00', fim: '20:00' }]);
    expect(faixasParaEnviar(com('2026-11-06', { inicio: 1200, fim: 1440 }))).toEqual([{ data: '2026-11-06', inicio: '20:00', fim: '24:00' }]);
  });

  it('marcar dias acrescenta o dia inteiro e não tira o que já está marcado', () => {
    const r = marcarDias(com('2026-11-02', BLOCO_08_16), ['2026-11-02', '2026-11-03']);
    expect(faixasParaEnviar(r)).toEqual([{ data: '2026-11-02', inicio: '00:00', fim: '24:00' }, { data: '2026-11-03', inicio: '00:00', fim: '24:00' }]);
  });
});

describe('atalhos e rodapé', () => {
  it('fimDeSemana traz os sábados e domingos (novembro de 2026 começa num domingo: 9 dias)', () => {
    expect(fimDeSemana('2026-11')).toEqual(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']);
  });

  it('copiarDoMes leva o dia N do mês anterior para o dia N e descarta o que não existe no mês (Review Focus 3)', () => {
    const anterior = [{ data: '2026-10-30', inicio: '08:00', fim: '20:00' }, { data: '2026-10-31', inicio: '20:00', fim: '24:00' }];
    expect(faixasParaEnviar(copiarDoMes(anterior, '2026-11'))).toEqual([{ data: '2026-11-30', inicio: '08:00', fim: '20:00' }]);
  });

  it('o rodapé conta horas e dias, no singular quando é um só', () => {
    expect(textoDoRodape(vazio())).toBe('Nenhum horário marcado.');
    expect(textoDoRodape(com('2026-11-05', BLOCO_16_20))).toBe('4 horas em 1 dia.');
    expect(textoDoRodape(com('2026-11-05', { inicio: 480, fim: 540 }))).toBe('1 hora em 1 dia.');
    expect(textoDoRodape(new Map([['2026-11-05', [BLOCO_08_16]], ['2026-11-06', [BLOCO_16_20]]]))).toBe('12 horas em 2 dias.');
  });

  it('proximoQueFalta: o primeiro depois do atual; sem nenhum depois, o primeiro do começo; ninguém, null', () => {
    const militar = (id: string, lancado: boolean) => ({ militarId: id, lancado }) as Parameters<typeof proximoQueFalta>[0][number];
    const lista = [militar('a', false), militar('b', true), militar('c', false), militar('d', true), militar('e', false)];
    expect(proximoQueFalta(lista, 'a')).toBe('c');
    expect(proximoQueFalta(lista, 'e')).toBe('a');
    expect(proximoQueFalta(lista.map((x) => ({ ...x, lancado: x.militarId !== 'c' })), 'c')).toBeNull();
  });
});

describe('tirar um bloco (arrastar para desmarcar, achado M1 da revisão da 2.2)', () => {
  const BLOCO_16_24 = { inicio: 960, fim: 1440 };

  it('sobre um bloco parcial, tira o pedaço marcado em vez de marcar o bloco inteiro', () => {
    const parcial = com('2026-11-06', BLOCO_16_20);
    expect(estadoDoBloco(parcial, '2026-11-06', BLOCO_16_24)).toBe('parcial');
    const tirado = tirarBloco(parcial, '2026-11-06', BLOCO_16_24);
    expect(estadoDoBloco(tirado, '2026-11-06', BLOCO_16_24)).toBe('vazio');
  });

  it('tira só o bloco: o que está marcado ao lado fica', () => {
    const tirado = tirarBloco(com('2026-11-06', BLOCO_08_20), '2026-11-06', BLOCO_16_24);
    expect(faixasParaEnviar(tirado)).toEqual([{ data: '2026-11-06', inicio: '08:00', fim: '16:00' }]);
  });

  it('bloco vazio não muda nada', () => {
    const m = com('2026-11-06', BLOCO_08_16);
    expect(faixasParaEnviar(tirarBloco(m, '2026-11-06', BLOCO_16_20))).toEqual(faixasParaEnviar(m));
  });
});

describe('o rodapé mostra os minutos quando há (achado M4 da revisão da 2.2)', () => {
  const rodape = (minutos: number) => textoDoRodape(com('2026-11-05', { inicio: 480, fim: 480 + minutos }));

  it('7 horas e 30 minutos; 1 hora e 30 minutos; 30 minutos; 1 hora; 8 horas', () => {
    expect(rodape(450)).toBe('7 horas e 30 minutos em 1 dia.');
    expect(rodape(90)).toBe('1 hora e 30 minutos em 1 dia.');
    expect(rodape(30)).toBe('30 minutos em 1 dia.');
    expect(rodape(60)).toBe('1 hora em 1 dia.');
    expect(rodape(480)).toBe('8 horas em 1 dia.');
  });
});

