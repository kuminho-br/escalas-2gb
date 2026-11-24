import type { EscalaDosOficiais } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Entrega 6.30, pendências das entregas 6.27 a 6.29.1. Dados fictícios (D7): oficiais 9908xx-x no 2º GB. Meses de 2027, um por teste.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let rodada: RodadaDeTeste;
let seq = 0;

async function oficial(nome: string, antiguidade: number) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9908${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada: 'pronto', desde: '2026-12-01', quadro_id: quadro.QOC });
  ids[nome] = id;
}
const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
const abrir = async (mes: string) => {
  const e = await ler(mes);
  await api.pedir('gestorGb', 'PUT', rota(mes, '/participantes'), { militarIds: e.oficiais.map((o) => o.militarId) });
  return api.pedir('gestorGb', 'POST', rota(mes, '/abrir'));
};
const lancar = (mes: string, dia: string, letra: string, nome: string) => api.pedir('gestorGb', 'POST', rota(mes, '/lancamentos'), { dia, letra, servico: 'saldo', militarId: ids[nome] });

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('a', 1);
  await oficial('b', 2);
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
});
afterAll(async () => {
  await api.fechar();
});

describe('o afastado não pega turno (também na API)', () => {
  it('lançar um oficial no dia do afastamento dá 409 com a mesma frase da tela, e nada é gravado', async () => {
    await abrir('2027-03');
    const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    const af = await inserir(api.banco, 'afastamento', { militar_id: ids.a, tipo_afastamento_id: ferias, inicio: '2027-03-10', fim: '2027-03-11' });
    try {
      const r = await lancar('2027-03', '2027-03-10', 'A', 'a');
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('CAP A está afastado em 10/03 (Férias) e não pode ficar com este turno.');
      expect((await ler('2027-03')).turnos.find((t) => t.dia === '2027-03-10' && t.letra === 'A')!.militarId).toBeNull();
      expect((await lancar('2027-03', '2027-03-12', 'A', 'a')).status).toBe(200);
    } finally {
      await api.banco.query('delete from afastamento where id = $1', [af]);
    }
  });
});

describe('os dias vermelhos marcados um por vez', () => {
  const marcarUm = (mes: string, dia: string, vermelho: boolean) => api.pedir('gestorGb', 'POST', rota(mes, '/dias-vermelhos/marcar'), { dia, vermelho });

  it('duas telas abertas marcando dias diferentes guardam as duas marcas (a segunda não apaga a primeira)', async () => {
    await abrir('2027-04');
    // a primeira tela marca o dia 5; a segunda, com a lista de antes (vazia), marca o dia 9 e não manda a lista inteira
    expect((await marcarUm('2027-04', '2027-04-05', true)).status).toBe(200);
    const r = await marcarUm('2027-04', '2027-04-09', true);
    expect(r.status).toBe(200);
    expect((await r.json()).diasVermelhos).toEqual(['2027-04-05', '2027-04-09']);
  });

  it('desmarcar um dia tira só ele; um dia fora do mês dá 400', async () => {
    const r = await marcarUm('2027-04', '2027-04-05', false);
    expect((await r.json()).diasVermelhos).toEqual(['2027-04-09']);
    expect((await marcarUm('2027-04', '2027-05-01', true)).status).toBe(400);
  });
});

describe('o painel de saldo conta a escala escolhida (coberturas e dias vermelhos)', () => {
  it('uma cobertura feita na escala A não aparece no painel da escala B', async () => {
    // a segunda escala de rodada da unidade usa os mesmos serviços (o nome do serviço é único na unidade)
    const outra = await inserir(api.banco, 'escala', { unidade_id: api.ids.gb, nome: 'Oficiais da seção', titulo: 'ESCALA SEÇÃO', militares_doc: 'escalados', dias_doc: 'com_escalados', distribuicao: 'rodada_de_cotas', monta_blocos_voluntariado: false });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) select $1, servico_id, ordem from escala_servico where escala_id = $2', [outra, rodada.escalaId]);
    const na = (id: string) => `?escala=${id}`;
    const mes = '2027-02';
    await api.pedir('gestorGb', 'PUT', rota(mes, `/participantes${na(rodada.escalaId)}`), { militarIds: [ids.a, ids.b] });
    await api.pedir('gestorGb', 'POST', rota(mes, `/abrir${na(rodada.escalaId)}`));
    await api.pedir('gestorGb', 'POST', rota(mes, `/lancamentos${na(rodada.escalaId)}`), { dia: '2027-02-01', letra: 'A', servico: 'saldo', militarId: ids.a });
    expect((await api.pedir('gestorGb', 'POST', rota(mes, `/fechar${na(rodada.escalaId)}`))).status).toBe(200);
    // a cobertura: b toma o lugar de a na escala A
    expect((await api.pedir('gestorGb', 'POST', rota(mes, `/lancamentos${na(rodada.escalaId)}`), { dia: '2027-02-01', letra: 'A', servico: 'saldo', militarId: ids.b })).status).toBe(200);
    const painel = async (escalaId: string) => (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo${na(escalaId)}`)).json() as Promise<{ militarId: string; registro: { tipo: string }[] }[]>;
    const daA = await painel(rodada.escalaId);
    expect(daA.find((o) => o.militarId === ids.b)!.registro.map((r) => r.tipo)).toContain('cobriu');
    const daB = await painel(outra);
    expect(daB.flatMap((o) => o.registro.map((r) => r.tipo))).not.toContain('cobriu');
  });
});
