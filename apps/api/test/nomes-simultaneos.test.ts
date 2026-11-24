import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.18, Task 7, item 1 (Review Focus 4): o nome de serviço, escala, guarnição e função é único sem diferenciar caixa nem acento, e a conferência
// está no mesmo comando da gravação: dois pedidos ao mesmo tempo, o segundo recebe 409. Dados fictícios (D7).
let api: ApiDeTeste;
const secao = () => `/api/unidades/${api.ids.secao}`;
const atual = hojeRecife().slice(0, 7);

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

const status = async (a: Promise<Response>, b: Promise<Response>) => (await Promise.all([a, b])).map((r) => r.status).sort();

describe('dois pedidos ao mesmo tempo com o mesmo nome (só a caixa muda)', () => {
  it('serviço: um 201 e um 409', async () => {
    const novo = (nome: string) => api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' });
    expect(await status(novo('Corrida Serviço'), novo('CORRIDA SERVIÇO'))).toEqual([201, 409]);
  });

  it('escala: um 201 e um 409', async () => {
    const nova = (nome: string) => api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome });
    expect(await status(nova('Corrida Escala'), nova('corrida escala'))).toEqual([201, 409]);
  });

  it('guarnição: um 201 e um 409', async () => {
    const nova = (nome: string) => api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] } });
    expect(await status(nova('Corrida Guarnição'), nova('CORRIDA GUARNIÇÃO'))).toEqual([201, 409]);
  });

  it('função: um 201 e um 409', async () => {
    const nova = (nome: string) => api.pedir('escalante', 'POST', `${secao()}/funcoes`, { nome });
    expect(await status(nova('Corrida Função'), nova('CORRIDA FUNÇÃO'))).toEqual([201, 409]);
  });

  it('renomear dois serviços para o mesmo nome ao mesmo tempo: um 200 e um 409', async () => {
    const novo = async (nome: string) => (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()).id as string;
    const [a, b] = [await novo('Renomear Um'), await novo('Renomear Dois')];
    const renomear = (id: string, nome: string) => api.pedir('escalante', 'PATCH', `/api/servicos/${id}`, { nome, tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' });
    expect(await status(renomear(a, 'Mesmo Nome'), renomear(b, 'MESMO NOME'))).toEqual([200, 409]);
  });
});
