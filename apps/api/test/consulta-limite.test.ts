import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.18, Task 7, item 15: a busca de militares da consulta aceita 30 pedidos por minuto por conta; acima disso, 429 com a frase da tela.
let api: ApiDeTeste;
const FRASE = 'Muitas buscas em pouco tempo. Espere um minuto e tente de novo.';
const buscar = (quem: 'semPapel' | 'escalante' | 'gestorGb') => api.pedir(quem, 'GET', '/api/consulta/militares?texto=abc');

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => criarApp({ banco, auth })); // com o limite padrão
});
afterAll(async () => {
  api.fechar();
  vi.restoreAllMocks();
});

describe('o limite de buscas por minuto', () => {
  it('30 buscas passam; a 31ª é 429 com a frase, e outra conta não é afetada', async () => {
    for (let i = 0; i < 30; i++) expect((await buscar('semPapel')).status, `busca ${i + 1}`).toBe(200);
    const r = await buscar('semPapel');
    expect(r.status).toBe(429);
    expect((await r.json()).erro).toBe(FRASE);
    expect((await buscar('escalante')).status).toBe(200);
  });

  it('6.54: a exportação conta no mesmo limite (30 por minuto por conta) e a resposta não fica em cache', async () => {
    const exportar = () => api.pedir('gestorGb', 'POST', '/api/consulta/militares/exportar', { filtros: { texto: 'abc' }, colunas: ['NOME DE GUERRA'] });
    for (let i = 0; i < 30; i++) {
      const r = await exportar();
      expect(r.status, `exportação ${i + 1}`).toBe(200);
      if (i === 0) expect(r.headers.get('cache-control')).toBe('no-store');
    }
    const r = await exportar();
    expect(r.status).toBe(429);
    expect((await r.json()).erro).toBe(FRASE);
  });

  it('o limite é só da lista: a ficha de consulta e as unidades não contam', async () => {
    expect((await api.pedir('semPapel', 'GET', '/api/consulta/unidades')).status).toBe(200);
  });

  it('passado um minuto, a conta volta a buscar', async () => {
    const agora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(agora + 61_000);
    expect((await buscar('semPapel')).status).toBe(200);
  });
});
