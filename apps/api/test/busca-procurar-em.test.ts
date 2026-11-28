import type { ResultadoDaBusca } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.63, Task 1: onde o texto da busca procura (`procurarEm`). Matrícula e nome de guerra ligados por padrão; o nome completo, desligado. Dados fictícios: matrículas 1006xx-x.
let api: ApiDeTeste;
const ROTA = '/api/consulta/militares/buscar';
const ROTA_SEM_CORTE = '/api/consulta/militares/buscar/todos';
const FRASE = 'Ligue pelo menos um lugar para o texto procurar.';
const todos = { matricula: true, nomeDeGuerra: true, nomeCompleto: true };

async function militar(guerra: string, completo: string, matricula: string) {
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  await inserir(api.banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: guerra, nome_completo: completo, antiguidade: 1, de_teste: true });
}
const buscar = async (corpo: unknown, rota = ROTA): Promise<ResultadoDaBusca> => {
  const r = await api.pedir('admin', 'POST', rota, corpo);
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return r.json();
};
const nomes = (r: ResultadoDaBusca) => r.militares.map((m) => m.nomeGuerra).sort();

beforeAll(async () => {
  api = await montarApi();
  await militar('JÚLIO', 'Fulano de Tal', '100601-1');
  await militar('MARIA', 'Maria Júlio da Silva', '100602-2');
  await militar('PEDRO', 'Pedro Júlio Costa', '100603-3');
});
afterAll(async () => {
  await api.fechar();
});

describe('onde o texto procura (6.63)', () => {
  it('o caso que motivou o pedido: "JÚLIO" com o padrão traz só quem tem o nome no nome de guerra; ligando o nome completo, os outros aparecem', async () => {
    expect(nomes(await buscar({ texto: 'JÚLIO' }))).toEqual(['JÚLIO']);
    expect(nomes(await buscar({ texto: 'julio', procurarEm: todos }))).toEqual(['JÚLIO', 'MARIA', 'PEDRO']);
  });

  it('`procurarEm` ausente vale o padrão: matrícula e nome de guerra ligados, nome completo desligado', async () => {
    const padrao = { matricula: true, nomeDeGuerra: true, nomeCompleto: false };
    expect(nomes(await buscar({ texto: 'JÚLIO', procurarEm: padrao }))).toEqual(nomes(await buscar({ texto: 'JÚLIO' })));
    expect(nomes(await buscar({ texto: '100602' }))).toEqual(['MARIA']);
  });

  it('só o nome de guerra ligado não acha pela matrícula; só a matrícula ligada acha com ou sem o traço', async () => {
    const soGuerra = { matricula: false, nomeDeGuerra: true, nomeCompleto: false };
    expect(nomes(await buscar({ texto: '100601', procurarEm: soGuerra }))).toEqual([]);
    const soMatricula = { matricula: true, nomeDeGuerra: false, nomeCompleto: false };
    expect(nomes(await buscar({ texto: '1006011', procurarEm: soMatricula }))).toEqual(['JÚLIO']);
    expect(nomes(await buscar({ texto: '100601-1', procurarEm: soMatricula }))).toEqual(['JÚLIO']);
    expect(nomes(await buscar({ texto: 'JÚLIO', procurarEm: soMatricula }))).toEqual([]);
  });

  it('só o nome completo ligado acha pelo nome completo e não pelo de guerra', async () => {
    const soCompleto = { matricula: false, nomeDeGuerra: false, nomeCompleto: true };
    expect(nomes(await buscar({ texto: 'Júlio da Silva', procurarEm: soCompleto }))).toEqual(['MARIA']);
    expect(nomes(await buscar({ texto: 'MARIA', procurarEm: soCompleto }))).toEqual(['MARIA']);
    expect(nomes(await buscar({ texto: 'JÚLIO', procurarEm: soCompleto }))).toEqual(['MARIA', 'PEDRO']);
  });

  it('todos desligados é 400 com a frase fixa', async () => {
    const r = await api.pedir('admin', 'POST', ROTA, { texto: 'JÚLIO', procurarEm: { matricula: false, nomeDeGuerra: false, nomeCompleto: false } });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe(FRASE);
  });

  it('a busca sem corte (6.54) e a exportação aceitam o campo do mesmo jeito', async () => {
    expect(nomes(await buscar({ texto: 'JÚLIO' }, ROTA_SEM_CORTE))).toEqual(['JÚLIO']);
    expect(nomes(await buscar({ texto: 'JÚLIO', procurarEm: todos }, ROTA_SEM_CORTE))).toEqual(['JÚLIO', 'MARIA', 'PEDRO']);
    const r = await api.pedir('admin', 'POST', ROTA_SEM_CORTE, { texto: 'JÚLIO', procurarEm: { matricula: false, nomeDeGuerra: false, nomeCompleto: false } });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe(FRASE);
  });
});
