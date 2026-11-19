import { describe, expect, it } from 'vitest';
import { paramConverter } from '../src/parametros.ts';
import { defDoSistema } from '../src/parametros-sistema-novo.ts';

describe('parâmetros só do sistema novo', () => {
  it('a flexibilidade do voluntariado existe, com padrão 0 e máximo 3', () => {
    const def = defDoSistema('FLEXIBILIDADE_VOLUNTARIADO_HORAS');
    expect(def).not.toBeNull();
    expect(def!.padrao).toBe(0);
    expect(def!.min).toBe(0);
    expect(def!.max).toBe(3);
    expect(def!.tipo).toBe('inteiro');
  });

  it('só aceita horas cheias e até 3', () => {
    const def = defDoSistema('FLEXIBILIDADE_VOLUNTARIADO_HORAS')!;
    expect(paramConverter(def, '1,5')).toMatchObject({ ok: false, erro: 'Use um número inteiro.' });
    expect(paramConverter(def, '4')).toMatchObject({ ok: false, erro: 'O máximo é 3.' });
    expect(paramConverter(def, '2')).toMatchObject({ ok: true, valor: 2 });
  });

  it('um parâmetro do catálogo antigo continua vindo de lá', () => {
    expect(defDoSistema('CARGA_MENSAL_HORAS')?.padrao).toBe(160);
    expect(defDoSistema('NAO_EXISTE')).toBeNull();
  });
});
