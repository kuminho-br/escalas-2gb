import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.58 (Task 5): a marca `militar.de_teste` é só do banco e do script de separação. A API nunca a lê, nunca a grava e nunca a devolve.
// Dados fictícios (D7): a matrícula 990xxx-x aqui não quer dizer "teste"; é só a convenção dos testes.
let api: ApiDeTeste;
let sd: string;
const atual = hojeRecife().slice(0, 7);

const novo = (matricula: string, extra: Record<string, unknown> = {}) => ({
  matricula, postoGradId: sd, nomeCompleto: `Fulano de Tal ${matricula}`, nomeGuerra: `TESTE${matricula.slice(3, 6)}`, antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
  lotacao: { equipeId: null, jornada: 'adm', desde: `${atual}-01` }, ...extra,
});
const marca = async (id: string) => (await api.banco.query<{ de_teste: boolean }>('select de_teste from militar where id = $1', [id])).rows[0]!.de_teste;
const temMarca = (texto: string) => /de_?teste/i.test(texto);

beforeAll(async () => {
  api = await montarApi();
  const postos: { id: string; sigla: string }[] = await (await api.pedir('gestorGb', 'GET', '/api/postos')).json();
  sd = postos.find((p) => p.sigla === 'SD')!.id;
});
afterAll(async () => {
  await api.fechar();
});

describe('a marca de teste não vaza pela API', () => {
  it('criar militar grava sem marca, mesmo quando a requisição manda a marca; a resposta não traz o campo', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990411-1', { de_teste: true, deTeste: true }));
    expect(r.status).toBe(201);
    const texto = await r.text();
    expect(temMarca(texto)).toBe(false);
    const id = (JSON.parse(texto) as { id: string }).id;
    expect(await marca(id)).toBe(false);
  });

  it('editar militar não grava a marca: a requisição que a manda é recusada ou ignorada, e a ficha e a lista não a trazem', async () => {
    const criado = await (await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990412-2'))).json();
    const comMarca = await api.pedir('gestorGb', 'PATCH', `/api/militares/${criado.id}`, { antiguidade: 7, de_teste: true, deTeste: true });
    expect([200, 400]).toContain(comMarca.status);
    expect(await marca(criado.id)).toBe(false);
    // a edição de sempre: a resposta não traz a marca
    const editado = await api.pedir('gestorGb', 'PATCH', `/api/militares/${criado.id}`, { antiguidade: 7 });
    expect(editado.status).toBe(200);
    expect(temMarca(await editado.text())).toBe(false);
    expect(await marca(criado.id)).toBe(false);
    // se o militar tem a marca (posta pelo script), editar não a tira nem a mostra
    await api.banco.query('update militar set de_teste = true where id = $1', [criado.id]);
    const outra = await api.pedir('gestorGb', 'PATCH', `/api/militares/${criado.id}`, { antiguidade: 8 });
    expect(outra.status).toBe(200);
    expect(temMarca(await outra.text())).toBe(false);
    expect(await marca(criado.id)).toBe(true);
    const tentaTirar = await api.pedir('gestorGb', 'PATCH', `/api/militares/${criado.id}`, { de_teste: false });
    expect([200, 400]).toContain(tentaTirar.status);
    expect(await marca(criado.id)).toBe(true);
    const ficha = await api.pedir('gestorGb', 'GET', `/api/militares/${criado.id}?mes=${atual}`);
    expect(temMarca(await ficha.text())).toBe(false);
    const lista = await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`);
    expect(lista.status).toBe(200);
    expect(temMarca(await lista.text())).toBe(false);
  });
});
