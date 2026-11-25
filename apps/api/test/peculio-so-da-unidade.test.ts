import type { ListaDoPeculio } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.50: o Pecúlio da unidade com "Incluir as unidades de baixo" à escolha. `?abaixo=nao` traz só os lotados direto na unidade; o padrão segue trazendo as de baixo.
// Dados fictícios (D7): 9907xx-x. O mês de 2031 mantém o teste igual em qualquer dia em que ele rode (a referência é o dia 1).
const MES = '2031-05';
let api: ApiDeTeste;
let seq = 0;

async function militar(nome: string, unidade: string) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `9907${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidade, jornada: 'pronto', desde: '2031-01-01', ate: null });
  return id;
}
const peculio = async (unidade: string, consulta = ''): Promise<ListaDoPeculio> => (await api.pedir('admin', 'GET', `/api/unidades/${unidade}/peculio?mes=${MES}${consulta}`)).json();
const nomes = (l: ListaDoPeculio) => l.militares.map((m) => m.nomeGuerra).filter((n) => n.startsWith('T50')).sort();

beforeAll(async () => {
  api = await montarApi();
  const { secao, gb } = api.ids;
  await militar('T50NOGB', gb);
  await militar('T50NASB', secao);
});
afterAll(async () => {
  await api.fechar();
});

describe('o Pecúlio da unidade com as unidades de baixo à escolha (6.50)', () => {
  it('sem o parâmetro, a lista traz os lotados na unidade e nas de baixo (o padrão de sempre)', async () => {
    expect(nomes(await peculio(api.ids.gb))).toEqual(['T50NASB', 'T50NOGB']);
  });

  it('abaixo=nao traz só quem está lotado direto na unidade', async () => {
    expect(nomes(await peculio(api.ids.gb, '&abaixo=nao'))).toEqual(['T50NOGB']);
    expect(nomes(await peculio(api.ids.secao, '&abaixo=nao'))).toEqual(['T50NASB']);
  });

  it('abaixo=sim e qualquer outro valor valem o padrão', async () => {
    expect(nomes(await peculio(api.ids.gb, '&abaixo=sim'))).toEqual(['T50NASB', 'T50NOGB']);
    expect(nomes(await peculio(api.ids.gb, '&abaixo=talvez'))).toEqual(['T50NASB', 'T50NOGB']);
  });

  it('Review Focus 4: uma unidade sem ninguém lotado direto nela devolve a lista vazia, mesmo com gente nas de baixo', async () => {
    const divisao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = 'DivOp' limit 1")).rows[0]!.id;
    const so = await peculio(divisao, '&abaixo=nao');
    expect(nomes(so)).toEqual([]);
    expect(so.militares.every((m) => m.lotacaoId === divisao)).toBe(true);
  });

  it('com abaixo=nao a lista continua só de quem a pessoa pode ver: o escalante de outra seção recebe 403', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.gb}/peculio?mes=${MES}&abaixo=nao`);
    expect(r.status).toBe(403);
  });
});
