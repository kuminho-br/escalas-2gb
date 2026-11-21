import { describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { MODULOS, moduloDoEndereco } from '@/lib/modulos';
import { EU_EXEMPLO } from './apoio';

const comPapel = (papel: 'administrador' | 'gestor' | 'escalante'): EuDaApi => ({ ...EU_EXEMPLO, papeis: [{ papel, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] });
const COMUM: EuDaApi = { ...EU_EXEMPLO, papeis: [] };
const quemVe = (eu: EuDaApi) => MODULOS.filter((m) => m.ve({ ...eu, unidade: eu.unidades[0]! })).map((m) => m.id);

describe('os módulos e quem os vê', () => {
  it('o militar comum vê Visualização e Minha ficha', () => {
    expect(quemVe(COMUM)).toEqual(['visualizacao', 'minha-ficha']);
  });

  it('o auxiliar, o gestor e o administrador veem os quatro', () => {
    for (const papel of ['escalante', 'gestor', 'administrador'] as const) expect(quemVe(comPapel(papel))).toEqual(['escalas', 'peculio', 'visualizacao', 'minha-ficha']);
  });

  it('só a Visualização não tem rota', () => {
    expect(MODULOS.map((m) => [m.id, m.rota])).toEqual([['escalas', '/grade'], ['peculio', '/peculio'], ['visualizacao', null], ['minha-ficha', '/minha-ficha']]);
  });
});

describe('o módulo de cada endereço', () => {
  const id = (caminho: string, busca: Record<string, unknown> = {}) => moduloDoEndereco(caminho, busca)?.id ?? null;

  it('as telas de escala são da Confecção, e o Pecúlio é do Pecúlio', () => {
    for (const c of ['/grade', '/escala-do-mes', '/efetivo-por-dia', '/voluntariado', '/cotas', '/servicos', '/escalas/e1/ordem', '/feriados', '/configuracoes', '/militares']) expect(id(c)).toBe('escalas');
    expect(id('/peculio')).toBe('peculio');
  });

  it('/militares/x é da Confecção, e com ?de=peculio é do Pecúlio', () => {
    expect(id('/militares/m1')).toBe('escalas');
    expect(id('/militares/m1', { de: 'peculio' })).toBe('peculio');
    expect(id('/militares/m1', { de: 'outra-coisa' })).toBe('escalas');
  });

  it('/ e /minha-ficha não têm trilho', () => {
    expect(id('/')).toBeNull();
    const minha = moduloDoEndereco('/minha-ficha', {})!;
    expect(minha.id).toBe('minha-ficha');
    expect(minha.itens).toEqual([]);
    expect(MODULOS.find((m) => m.id === 'visualizacao')!.itens).toEqual([]);
  });

  it('um endereço que não existe não é de nenhum módulo', () => {
    expect(id('/nao-existe')).toBeNull();
  });

  it('o trilho da Confecção tem os blocos de hoje e o do Pecúlio só o Pecúlio', () => {
    const nomes = (m: string) => MODULOS.find((x) => x.id === m)!.itens.flat().map((i) => i.nome);
    expect(nomes('escalas')).toEqual(['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Voluntariado', 'Cotas', 'Militares', 'Turnos', 'Escalas', 'Feriados']);
    expect(nomes('peculio')).toEqual(['Pecúlio']);
  });
});
