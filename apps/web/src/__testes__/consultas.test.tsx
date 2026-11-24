import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ErroApi } from '@/api/cliente';
import { criarQueryClient, deveTentarDeNovo, deveTentarDeNovoNaBusca } from '@/lib/consultas';

describe('a busca de militares (item 15 da 6.18)', () => {
  it('o 429 do limite de buscas não tenta de novo: tentar só gasta a janela do minuto, e a frase aparece na hora', () => {
    expect(deveTentarDeNovoNaBusca(0, new ErroApi('Muitas buscas em pouco tempo. Espere um minuto e tente de novo.', 429))).toBe(false);
    // o resto segue a regra das consultas
    expect(deveTentarDeNovoNaBusca(0, new ErroApi('x', 503))).toBe(true);
    expect(deveTentarDeNovoNaBusca(0, new ErroApi('x', 408))).toBe(true);
    expect(deveTentarDeNovoNaBusca(0, new ErroApi('x', 404))).toBe(false);
    expect(deveTentarDeNovoNaBusca(2, new ErroApi('x', 503))).toBe(false);
  });
});

describe('quando uma consulta tenta de novo', () => {
  it('erro 4xx não tenta de novo: o erro aparece na hora (Review Focus 3)', () => {
    expect(deveTentarDeNovo(0, new ErroApi('Ficha não encontrada.', 404))).toBe(false);
    expect(deveTentarDeNovo(0, new ErroApi('Sem permissão.', 403))).toBe(false);
    expect(deveTentarDeNovo(0, new ErroApi('Confira os campos.', 400))).toBe(false);
    expect(deveTentarDeNovo(0, new ErroApi('x', 499))).toBe(false);
  });

  it('sem conexão (status 0) e erro 5xx tentam mais duas vezes', () => {
    expect(deveTentarDeNovo(0, new ErroApi('Sem conexão.', 0))).toBe(true);
    expect(deveTentarDeNovo(1, new ErroApi('x', 500))).toBe(true);
    expect(deveTentarDeNovo(2, new ErroApi('x', 500))).toBe(false);
    expect(deveTentarDeNovo(2, new ErroApi('x', 0))).toBe(false);
  });

  it('um erro que não é da API (falha qualquer) também tenta mais duas vezes', () => {
    expect(deveTentarDeNovo(0, new Error('falha'))).toBe(true);
    expect(deveTentarDeNovo(2, new Error('falha'))).toBe(false);
  });

  it('o cliente de consultas do site usa essa regra', () => {
    const cliente = criarQueryClient();
    expect(cliente).toBeInstanceOf(QueryClient);
    expect(cliente.getDefaultOptions().queries?.retry).toBe(deveTentarDeNovo);
  });
});
