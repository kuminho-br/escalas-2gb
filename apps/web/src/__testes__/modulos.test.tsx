import { describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { MODULOS, moduloDoEndereco } from '@/lib/modulos';
import { EU_EXEMPLO } from './apoio';

const comPapel = (papel: 'administrador' | 'gestor' | 'gestor_lateral' | 'escalante'): EuDaApi => ({ ...EU_EXEMPLO, papeis: [{ papel, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] });
const COMUM: EuDaApi = { ...EU_EXEMPLO, papeis: [] };
const quemVe = (eu: EuDaApi) => MODULOS.filter((m) => m.ve({ ...eu, unidade: eu.unidades[0]! })).map((m) => m.id);

describe('os módulos e quem os vê', () => {
  it('o militar comum vê o Pecúlio Geral (só a pesquisa), a Visualização, a Minha ficha e as Configurações', () => {
    expect(quemVe(COMUM)).toEqual(['peculio', 'visualizacao', 'minha-ficha', 'configuracoes']);
  });

  it('o auxiliar, o quinto nível, o gestor e o administrador veem os seis', () => {
    for (const papel of ['escalante', 'gestor_lateral', 'gestor', 'administrador'] as const) expect(quemVe(comPapel(papel))).toEqual(['escalas', 'peculio', 'estrutura', 'visualizacao', 'minha-ficha', 'configuracoes']);
  });

  it('cada módulo tem a sua rota (a Visualização abre em Minha escala, 7.5)', () => {
    expect(MODULOS.map((m) => [m.id, m.rota])).toEqual([['escalas', '/grade'], ['peculio', '/peculio'], ['estrutura', '/estrutura'], ['visualizacao', '/minha-escala'], ['minha-ficha', '/minha-ficha'], ['configuracoes', '/configuracoes']]);
  });
});

describe('o módulo de cada endereço', () => {
  const id = (caminho: string, busca: Record<string, unknown> = {}) => moduloDoEndereco(caminho, busca)?.id ?? null;

  it('as telas de escala são da Confecção, e o Pecúlio é do Pecúlio', () => {
    for (const c of ['/grade', '/escala-do-mes', '/efetivo-por-dia', '/oficiais', '/voluntariado', '/cotas', '/servicos', '/escalas/e1/ordem', '/feriados', '/configuracoes-da-escala', '/militares', '/configuracoes/modelos-de-guarnicao/g1']) expect(id(c)).toBe('escalas');
    expect(id('/estrutura')).toBe('estrutura');
    expect(MODULOS.find((m) => m.id === 'estrutura')!.itens).toEqual([]);
    // as configurações gerais são do módulo Configurações, sem trilho
    for (const c of ['/configuracoes', '/Configuracoes']) expect(id(c), c).toBe('configuracoes');
    expect(MODULOS.find((m) => m.id === 'configuracoes')!.itens).toEqual([]);
    expect(id('/peculio')).toBe('peculio');
  });

  it('/militares/x é da Confecção, e com ?de=peculio é do Pecúlio', () => {
    expect(id('/militares/m1')).toBe('escalas');
    expect(id('/militares/m1', { de: 'peculio' })).toBe('peculio');
    expect(id('/militares/m1', { de: 'outra-coisa' })).toBe('escalas');
  });

  it('a Consulta e a ficha de consulta são do Pecúlio (uma tela dele), e o endereço com maiúsculas vale o mesmo', () => {
    for (const c of ['/consulta', '/consulta/m1', '/Consulta', '/CONSULTA/m1']) expect(id(c), c).toBe('peculio');
    expect(MODULOS.find((m) => m.id === 'consulta' as never)).toBeUndefined();
  });

  it('/ e /minha-ficha não têm trilho', () => {
    expect(id('/')).toBeNull();
    const minha = moduloDoEndereco('/minha-ficha', {})!;
    expect(minha.id).toBe('minha-ficha');
    expect(minha.itens).toEqual([]);
    expect(MODULOS.find((m) => m.id === 'visualizacao')!.itens.map((b) => b.map((i) => i.nome))).toEqual([['Minha escala', 'Meu voluntariado', 'Escalas']]);
    expect(id('/meu-voluntariado')).toBe('visualizacao');
    expect(id('/minha-escala')).toBe('visualizacao');
    expect(id('/escalas-da-corporacao')).toBe('visualizacao');
    expect(id('/escalas-da-corporacao/e1')).toBe('visualizacao');
  });

  it('o endereço com maiúsculas vale o mesmo (o roteador não diferencia), então a barreira também pega', () => {
    expect(id('/Militares')).toBe('escalas');
    expect(id('/PECULIO')).toBe('peculio');
    expect(id('/Grade')).toBe('escalas');
    expect(id('/Minha-Ficha')).toBe('minha-ficha');
    expect(id('/Militares/m1', { de: 'peculio' })).toBe('peculio');
  });

  it('um endereço que não existe não é de nenhum módulo', () => {
    expect(id('/nao-existe')).toBeNull();
  });

  it('o trilho da Confecção tem os blocos de hoje e o do Pecúlio Geral, as três telas (6.50)', () => {
    const nomes = (m: string) => MODULOS.find((x) => x.id === m)!.itens.flat().map((i) => i.nome);
    expect(nomes('escalas')).toEqual(['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Oficiais', 'Voluntariado', 'Cotas', 'Militares', 'Turnos', 'Escalas', 'Feriados']);
    expect(nomes('peculio')).toEqual(['Pecúlio da unidade', 'Pesquisar militares', 'Aniversários']);
  });
});
