import type { EscalaDosOficiais, OficialNoSaldo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Entrega 6.28: os dias vermelhos da escala dos oficiais. Dados fictícios (D7): oficiais 9906xx-x no 2º GB. Março e abril de 2027.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let rodada: RodadaDeTeste;
let seq = 0;

async function oficial(nome: string, antiguidade: number, voluntarioJes = false) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9906${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade, voluntario_jes: voluntarioJes });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada: 'adm', desde: '2026-12-01', quadro_id: quadro.QOC });
  ids[nome] = id;
}

const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
const abrir = async (mes: string) => {
  const e = await ler(mes);
  await api.pedir('gestorGb', 'PUT', rota(mes, '/participantes'), { militarIds: e.oficiais.map((o) => o.militarId) });
  return api.pedir('gestorGb', 'POST', rota(mes, '/abrir'));
};
const marcar = (mes: string, dias: string[]) => api.pedir('gestorGb', 'PUT', rota(mes, '/dias-vermelhos'), { dias });
const lancar = (mes: string, dia: string, letra: string, nome: string, servico: 'jes' | 'saldo' = 'saldo') =>
  api.pedir('gestorGb', 'POST', rota(mes, '/lancamentos'), { dia, letra, servico, militarId: ids[nome] });
const vermelhosDe = (e: EscalaDosOficiais, nome: string) => e.oficiais.find((o) => o.militarId === ids[nome])!.vermelhos;
const painel = async (): Promise<OficialNoSaldo[]> => (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo`)).json();

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('a', 1, true);
  await oficial('b', 2);
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
});
afterAll(async () => {
  await api.fechar();
});

describe('marcar os dias vermelhos', () => {
  it('o auxiliar recebe 403', async () => {
    expect((await api.pedir('escalante', 'PUT', rota('2027-03', '/dias-vermelhos'), { dias: [] })).status).toBe(403);
  });

  it('antes de abrir o mês a tela traz a lista vazia, e cada oficial, zero dias vermelhos', async () => {
    const e = await ler('2027-03');
    expect(e.diasVermelhos).toEqual([]);
    expect(e.oficiais.every((o) => o.vermelhos === 0)).toBe(true);
  });

  it('a lista marcada volta ordenada, sem repetição, e vale para o mês escolhido', async () => {
    expect((await abrir('2027-03')).status).toBe(200);
    const r = await marcar('2027-03', ['2027-03-14', '2027-03-07', '2027-03-07']);
    expect(r.status).toBe(200);
    expect((await r.json()).diasVermelhos).toEqual(['2027-03-07', '2027-03-14']);
    expect((await ler('2027-03')).diasVermelhos).toEqual(['2027-03-07', '2027-03-14']);
    expect((await ler('2027-04')).diasVermelhos).toEqual([]);
  });

  it('marcar de novo troca a lista do mês (desmarca o que saiu) e não mexe nos outros meses', async () => {
    await marcar('2027-04', ['2027-04-03']);
    const r = await marcar('2027-03', ['2027-03-14', '2027-03-21']);
    expect((await r.json()).diasVermelhos).toEqual(['2027-03-14', '2027-03-21']);
    expect((await ler('2027-04')).diasVermelhos).toEqual(['2027-04-03']);
    expect((await marcar('2027-03', [])).status).toBe(200);
    expect((await ler('2027-03')).diasVermelhos).toEqual([]);
    await marcar('2027-04', []);
  });

  it('um dia de outro mês dá 400 com o texto, e nada muda', async () => {
    await marcar('2027-03', ['2027-03-07']);
    const r = await marcar('2027-03', ['2027-03-08', '2027-04-01']);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Este dia não é do mês escolhido.');
    expect((await ler('2027-03')).diasVermelhos).toEqual(['2027-03-07']);
  });

  it('a lista fica ligada à escala, com a auditoria', async () => {
    const { rows } = await api.banco.query<{ escala_id: string; dia: string }>("select escala_id, to_char(dia, 'YYYY-MM-DD') as dia from dia_vermelho order by dia");
    expect(rows).toEqual([{ escala_id: rodada.escalaId, dia: '2027-03-07' }]);
    const a = await api.banco.query("select 1 from auditoria where tabela = 'dia_vermelho' and unidade_id = $1", [api.ids.gb]);
    expect(a.rows.length).toBeGreaterThan(0);
  });
});

describe('a contagem por oficial', () => {
  it('conta os lugares tomados em dia vermelho, de JES ou de Saldo, e não conta os outros dias', async () => {
    await marcar('2027-03', ['2027-03-07', '2027-03-14']);
    expect((await lancar('2027-03', '2027-03-07', 'A', 'a', 'jes')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-14', 'B', 'a')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-15', 'A', 'a')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-07', 'B', 'b')).status).toBe(200);
    const e = await ler('2027-03');
    expect(vermelhosDe(e, 'a')).toBe(2);
    expect(vermelhosDe(e, 'b')).toBe(1);
  });

  it('desmarcar o dia tira da contagem; marcar de novo volta', async () => {
    expect(vermelhosDe(await (await marcar('2027-03', ['2027-03-14'])).json(), 'a')).toBe(1);
    expect(vermelhosDe(await (await marcar('2027-03', ['2027-03-07', '2027-03-14'])).json(), 'a')).toBe(2);
  });

  it('os dias vermelhos não mudam a cota de saldo', async () => {
    const cotas = async () => (await ler('2027-03')).oficiais.map((o) => [o.cota, o.devido, o.sobra]);
    const antes = await cotas();
    await marcar('2027-03', ['2027-03-01', '2027-03-02', '2027-03-03']);
    expect(await cotas()).toEqual(antes);
    await marcar('2027-03', ['2027-03-07', '2027-03-14']);
    expect(await cotas()).toEqual(antes);
  });

  it('com a escala fechada ainda se marca; encerrado o mês, dá 409', async () => {
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/fechar'))).status).toBe(200);
    expect((await marcar('2027-03', ['2027-03-07'])).status).toBe(200);
    expect((await marcar('2027-03', ['2027-03-07', '2027-03-14'])).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/encerrar'))).status).toBe(200);
    const r = await marcar('2027-03', []);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.');
    expect((await ler('2027-03')).diasVermelhos).toEqual(['2027-03-07', '2027-03-14']);
  });
});

describe('o acumulado no painel de saldo', () => {
  it('soma os dias vermelhos tirados nos meses encerrados', async () => {
    const lista = await painel();
    expect(lista.find((o) => o.militarId === ids.a)!.vermelhos).toBe(2);
    expect(lista.find((o) => o.militarId === ids.b)!.vermelhos).toBe(1);
  });

  it('um mês ainda não encerrado não entra no acumulado', async () => {
    await abrir('2027-04');
    await marcar('2027-04', ['2027-04-04']);
    await lancar('2027-04', '2027-04-04', 'A', 'a');
    expect(vermelhosDe(await ler('2027-04'), 'a')).toBe(1);
    expect((await painel()).find((o) => o.militarId === ids.a)!.vermelhos).toBe(2);
  });
});
