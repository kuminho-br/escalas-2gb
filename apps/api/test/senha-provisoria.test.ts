import { describe, expect, it } from 'vitest';
import { gerarSenhaProvisoria } from '../src/usuarios/senha-provisoria.ts';

describe('senha provisória', () => {
  it('tem 12 caracteres do alfabeto sem letras parecidas, em três grupos', () => {
    // sem 0, o, 1, l e i, que se confundem quando a senha é ditada ou lida
    for (let i = 0; i < 300; i++) expect(gerarSenhaProvisoria()).toMatch(/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){2}$/);
  });

  it('duas senhas seguidas são diferentes', () => {
    expect(gerarSenhaProvisoria()).not.toBe(gerarSenhaProvisoria());
  });

  it('usa o alfabeto todo, sem preferir algumas letras', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 400; i++) for (const c of gerarSenhaProvisoria().replaceAll('-', '')) vistas.add(c);
    expect(vistas.size).toBe(31);
  });
});
