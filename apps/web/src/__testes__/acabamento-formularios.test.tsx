import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { correspondeABusca } from '@/lib/texto';
import { textoDoContador } from '@/componentes/escala-do-mes/CardDaGuarnicao';

// Entrega 6.17, Task 6: formulários, diálogos e nomes acessíveis (itens pequenos).
void screen;
void within;

describe('item 6: "Falta 1" e "Faltam 2"', () => {
  it('o contador do card da guarnição concorda com o número', () => {
    expect(textoDoContador(1)).toBe('Falta 1');
    expect(textoDoContador(2)).toBe('Faltam 2');
    expect(textoDoContador(10)).toBe('Faltam 10');
  });
});

describe('item 17: a busca por matrícula acha com ou sem o hífen', () => {
  it('"9900011" e "990001-1" acham a matrícula 990001-1; um nome continua sendo achado; outra matrícula não', () => {
    const item = 'ANDRADE João da Silva 990001-1';
    expect(correspondeABusca(item, '990001-1')).toBe(true);
    expect(correspondeABusca(item, '9900011')).toBe(true);
    expect(correspondeABusca(item, '99000')).toBe(true);
    expect(correspondeABusca(item, 'andrade')).toBe(true);
    expect(correspondeABusca(item, 'joao')).toBe(true);
    expect(correspondeABusca(item, '990002-2')).toBe(false);
    expect(correspondeABusca(item, '')).toBe(true);
    // só dígitos e hífen valem como matrícula: "andr-1" não vira busca de número
    expect(correspondeABusca(item, 'x1')).toBe(false);
  });
});
