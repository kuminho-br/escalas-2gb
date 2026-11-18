import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

const importacao = () => `/api/unidades/${api.ids.secao}/importacao/militares`;
const MB = 1024 * 1024;

describe('envio malformado e envio grande', () => {
  it('formulário sem fronteira na importação dá 400 com o texto de escolher o arquivo', async () => {
    const r = await api.pedirBruto('escalante', 'POST', importacao(), 'multipart/form-data', 'abc');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Escolha o arquivo .xlsx da planilha.' });
  });

  it('importação com corpo JSON dá 400, não 500', async () => {
    const r = await api.pedirBruto('escalante', 'POST', importacao(), 'application/json', '{"a":1}');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Escolha o arquivo .xlsx da planilha.' });
  });

  it('JSON de 2 MB numa rota comum dá 413', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/militares`, { nome: 'x'.repeat(2 * MB) });
    expect(r.status).toBe(413);
    expect((await r.json()).erro).toMatch(/grande demais/);
  });

  it('arquivo acima de 4 MB na importação dá 413 com a orientação do modelo (a Vercel recusa corpo acima de 4,5 MB antes de chamar a API)', async () => {
    const f = new FormData();
    f.set('arquivo', new File([new Uint8Array(5 * MB)], 'sandbox.xlsx'));
    const r = await api.pedir('escalante', 'POST', importacao(), f);
    expect(r.status).toBe(413);
    expect((await r.json()).erro).toMatch(/modelo/);
  });

  it('arquivo que não é xlsx continua dando 400 com a mensagem de arquivo ilegível', async () => {
    const f = new FormData();
    f.set('arquivo', new File(['isto não é uma planilha'], 'x.xlsx'));
    const r = await api.pedir('escalante', 'POST', importacao(), f);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toMatch(/Não foi possível ler o arquivo/);
  });

  it('arquivo de 3 MB ainda é lido (e recusado por não ser xlsx), sem 413', async () => {
    const f = new FormData();
    f.set('arquivo', new File([new Uint8Array(3 * MB)], 'x.xlsx'));
    const r = await api.pedir('escalante', 'POST', importacao(), f);
    expect(r.status).toBe(400);
  });
});
