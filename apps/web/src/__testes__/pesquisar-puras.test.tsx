import type { LinhaDaBusca } from 'contratos';
import { describe, expect, it } from 'vitest';
import { agruparSelecionados } from '@/lib/agrupar-selecionados';
import { marcarTrecho } from '@/lib/marcar-trecho';

// 6.63: as duas funções puras da tela. Dados fictícios.
const linha = (nomeGuerra: string, extra: Partial<LinhaDaBusca> = {}): LinhaDaBusca => ({
  id: nomeGuerra, postoGrad: 'SD', nomeGuerra, nomeCompleto: null, matricula: `1007${nomeGuerra.length}-1`, lotacao: '1ª SB', quadro: null, lotacaoCaminho: '2º GB / 1ª SB',
  equipe: 'ALFA', jornada: 'pronto', situacao: null, unidadeId: 'u1', podeAlterar: true, ...extra,
});

describe('marcarTrecho', () => {
  it('marca sem diferenciar maiúsculas nem acentos e devolve os pedaços na grafia original', () => {
    expect(marcarTrecho('JÚLIO', ['julio'])).toEqual([{ texto: 'JÚLIO', marcado: true }]);
    expect(marcarTrecho('Maria Júlio da Silva', ['júlio'])).toEqual([{ texto: 'Maria ', marcado: false }, { texto: 'Júlio', marcado: true }, { texto: ' da Silva', marcado: false }]);
  });

  it('marca cada palavra onde ela aparece e junta trechos vizinhos', () => {
    expect(marcarTrecho('José Carlos da Silva', ['jose', 'silva'])).toEqual([
      { texto: 'José', marcado: true }, { texto: ' Carlos da ', marcado: false }, { texto: 'Silva', marcado: true },
    ]);
  });

  it('a palavra só de dígitos acha a matrícula com ou sem o traço, e marca o traço junto', () => {
    expect(marcarTrecho('100601-1', ['10060'])).toEqual([{ texto: '10060', marcado: true }, { texto: '1-1', marcado: false }]);
    expect(marcarTrecho('100601-1', ['6011'])).toEqual([{ texto: '100', marcado: false }, { texto: '601-1', marcado: true }]);
  });

  it('sem palavra, sem achado e texto vazio não marcam nada', () => {
    expect(marcarTrecho('SOUZA', [])).toEqual([{ texto: 'SOUZA', marcado: false }]);
    expect(marcarTrecho('SOUZA', ['xyz'])).toEqual([{ texto: 'SOUZA', marcado: false }]);
    expect(marcarTrecho('', ['a'])).toEqual([]);
  });
});

describe('agruparSelecionados', () => {
  const linhas = [
    linha('ZE', { unidadeId: 'u2', lotacaoCaminho: '2º GB / 2ª SB', equipe: 'BRAVO', postoGrad: 'CB' }),
    linha('ANA', { unidadeId: 'u1', equipe: 'ALFA', postoGrad: '1º SGT' }),
    linha('BIA', { unidadeId: 'u1', equipe: null, postoGrad: 'SD' }),
    linha('CAIO', { unidadeId: null, lotacaoCaminho: null, lotacao: null, equipe: 'ALFA', postoGrad: 'CB' }),
  ];
  const ordem = { unidades: ['u1', 'u2'], postos: ['1º SGT', 'CB', 'SD'] };
  const resumo = (g: ReturnType<typeof agruparSelecionados>) => g.map((x) => [x.titulo, x.linhas.map((l) => l.nomeGuerra)]);

  it('por unidade: pela ordem da árvore, "Sem lotação" por último, e dentro do grupo por nome de guerra', () => {
    expect(resumo(agruparSelecionados(linhas, 'unidade', ordem))).toEqual([['2º GB / 1ª SB', ['ANA', 'BIA']], ['2º GB / 2ª SB', ['ZE']], ['Sem lotação', ['CAIO']]]);
  });

  it('por equipe: em ordem alfabética, "Sem equipe" por último', () => {
    expect(resumo(agruparSelecionados(linhas, 'equipe'))).toEqual([['Equipe ALFA', ['ANA', 'CAIO']], ['Equipe BRAVO', ['ZE']], ['Sem equipe', ['BIA']]]);
  });

  it('por posto: pela ordem dos postos', () => {
    expect(resumo(agruparSelecionados(linhas, 'posto', ordem))).toEqual([['1º SGT', ['ANA']], ['CB', ['CAIO', 'ZE']], ['SD', ['BIA']]]);
  });

  it('sem grupo: um grupo só, sem título, em ordem de nome de guerra e matrícula', () => {
    expect(resumo(agruparSelecionados(linhas, 'nenhum'))).toEqual([[null, ['ANA', 'BIA', 'CAIO', 'ZE']]]);
  });
});
