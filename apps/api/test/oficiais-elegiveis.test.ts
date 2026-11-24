import type { EscalaDosOficiais } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Entrega 6.29.1: só são elegíveis os lotados na unidade da escala e nas de baixo; quem é de uma unidade acima não aparece, nem no mês já gravado. Dados fictícios (D7).
let api: ApiDeTeste;
let rodada: RodadaDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
const nomes = (e: EscalaDosOficiais) => e.oficiais.map((o) => o.nomeGuerra).sort();

async function oficial(nome: string, unidadeId: string, antiguidade: number) {
  const id = await inserir(api.banco, 'militar', { matricula: `9911${String(antiguidade).padStart(2, '0')}-${antiguidade % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidadeId, jornada: 'adm', desde: '2026-12-01', quadro_id: quadro.QOC });
  ids[nome] = id;
}

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('aqui', api.ids.gb, 1);
  await oficial('embaixo', api.ids.secao, 2);
  await oficial('acima', api.ids.raiz, 3); // lotado numa unidade ACIMA da escala (a escala é do 2º GB)
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
});
afterAll(async () => {
  await api.fechar();
});

describe('os elegíveis são os lotados na unidade da escala e nas de baixo', () => {
  it('quem é lotado numa unidade acima não aparece na lista, e participar dele é 400 "Este oficial não é elegível neste mês."', async () => {
    const e = await ler('2027-01');
    expect(nomes(e)).toEqual(['AQUI', 'EMBAIXO']);
    const r = await api.pedir('gestorGb', 'PUT', rota('2027-01', '/participantes'), { militarIds: [ids.aqui, ids.acima] });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Este oficial não é elegível neste mês.');
  });

  it('no mês já gravado (cota e marca de participação de antes), quem está fora deixa de aparecer; os lançamentos já feitos ficam', async () => {
    await api.pedir('gestorGb', 'PUT', rota('2027-02', '/participantes'), { militarIds: [ids.aqui, ids.embaixo] });
    expect((await api.pedir('gestorGb', 'POST', rota('2027-02', '/abrir'))).status).toBe(200);
    const mesId = (await api.banco.query<{ id: string }>("select id from oficiais_mes where escala_id = $1 and mes = '2027-02-01'", [rodada.escalaId])).rows[0]!.id;
    // de antes da regra: o de cima ficou gravado na rodada
    await api.banco.query('insert into oficiais_participante (mes_id, militar_id) values ($1, $2)', [mesId, ids.acima]);
    await api.banco.query("insert into oficiais_cota (mes_id, militar_id, ordem, dias, devido, cota, sobra) values ($1, $2, 9, 28, 0, 0, false)", [mesId, ids.acima]);
    expect(nomes(await ler('2027-02'))).toEqual(['AQUI', 'EMBAIXO']);
    // com um lançamento já feito, ele continua na lista (o lançamento não some)
    const turno = (await ler('2027-02')).turnos.find((t) => t.dia === '2027-02-03' && t.letra === 'A')!;
    await api.banco.query("insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, origem) values ($1, $2, $3, $4, '2027-02-03', 'manual')", [ids.acima, rodada.escalaId, rodada.jes, rodada.jesA]);
    expect(turno.dia).toBe('2027-02-03');
    expect(nomes(await ler('2027-02'))).toEqual(['ACIMA', 'AQUI', 'EMBAIXO']);
  });
});
