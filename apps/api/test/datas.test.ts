import { describe, expect, it } from 'vitest';
import { agoraRecife, hojeRecife, inicioDoMes } from '../src/datas.ts';

describe('datas', () => {
  it('hojeRecife usa o fuso de Recife', () => {
    expect(hojeRecife(new Date('2026-11-17T01:30:00Z'))).toBe('2026-11-16');
    expect(hojeRecife(new Date('2026-11-17T03:30:00Z'))).toBe('2026-11-17');
  });

  it('agoraRecife: o dia e os minutos desde a meia-noite, no fuso de Recife (UTC-3)', () => {
    expect(agoraRecife(new Date('2026-11-25T15:30:00Z'))).toEqual({ dia: '2026-11-25', minutos: 12 * 60 + 30 });
    expect(agoraRecife(new Date('2026-11-26T02:59:00Z'))).toEqual({ dia: '2026-11-25', minutos: 23 * 60 + 59 });
    expect(agoraRecife(new Date('2026-11-26T03:00:00Z'))).toEqual({ dia: '2026-11-26', minutos: 0 });
  });

  it('inicioDoMes', () => {
    expect(inicioDoMes('2026-11-17')).toBe('2026-11-01');
  });
});
