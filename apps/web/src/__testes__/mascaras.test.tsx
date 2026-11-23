import { describe, expect, it } from 'vitest';
import { DOMINIO_DO_EMAIL, erroDoTelefone, mascararTelefone, usuarioDoEmail } from '@/lib/mascaras';

// Entrega 6.18, Task 7, item 22: as máscaras de contato (telefone e e-mail institucional).
describe('mascararTelefone', () => {
  it('11 dígitos: (81) 99668-1232; 10 dígitos: (81) 3333-4444', () => {
    expect(mascararTelefone('81996681232')).toBe('(81) 99668-1232');
    expect(mascararTelefone('8133334444')).toBe('(81) 3333-4444');
  });

  it('vai mascarando enquanto a pessoa digita, e ignora o que não é número', () => {
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('8')).toBe('(8');
    expect(mascararTelefone('81')).toBe('(81');
    expect(mascararTelefone('819')).toBe('(81) 9');
    expect(mascararTelefone('81996')).toBe('(81) 996');
    expect(mascararTelefone('(81) 9966-8123')).toBe('(81) 9966-8123');
    expect(mascararTelefone('81 99668 1232')).toBe('(81) 99668-1232');
  });

  it('não passa de 11 dígitos', () => {
    expect(mascararTelefone('819966812329999')).toBe('(81) 99668-1232');
  });
});

describe('erroDoTelefone', () => {
  it('vazio vale (limpa); 10 e 11 dígitos valem; outra quantidade é erro com a frase da tela', () => {
    expect(erroDoTelefone('')).toBeNull();
    expect(erroDoTelefone('(81) 99668-1232')).toBeNull();
    expect(erroDoTelefone('(81) 3333-4444')).toBeNull();
    expect(erroDoTelefone('(81) 9966')).toBe('Use o DDD e o número: 10 ou 11 dígitos.');
    expect(erroDoTelefone('81996681')).toBe('Use o DDD e o número: 10 ou 11 dígitos.');
  });
});

describe('usuarioDoEmail', () => {
  it('só o usuário passa como está', () => {
    expect(usuarioDoEmail('joao.silva')).toEqual({ usuario: 'joao.silva', erro: null });
  });

  it('um e-mail inteiro do domínio institucional fica só com o usuário, em qualquer caixa', () => {
    expect(usuarioDoEmail('joao.silva@bombeiros.pe.gov.br')).toEqual({ usuario: 'joao.silva', erro: null });
    expect(usuarioDoEmail('Joao.Silva@BOMBEIROS.PE.GOV.BR')).toEqual({ usuario: 'Joao.Silva', erro: null });
  });

  it('de outro domínio: erro "Use só o usuário do e-mail institucional.", e o texto fica como está', () => {
    expect(usuarioDoEmail('joao@gmail.com')).toEqual({ usuario: 'joao@gmail.com', erro: 'Use só o usuário do e-mail institucional.' });
    expect(usuarioDoEmail('joao@')).toEqual({ usuario: 'joao@', erro: 'Use só o usuário do e-mail institucional.' });
  });

  it('o domínio fixo é @bombeiros.pe.gov.br', () => {
    expect(DOMINIO_DO_EMAIL).toBe('@bombeiros.pe.gov.br');
  });
});
