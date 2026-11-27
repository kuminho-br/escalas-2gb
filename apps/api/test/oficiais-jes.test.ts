import type { EscalaDosOficiais } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Entrega 6.29, Task 1: JES para todos os elegíveis da escala dos oficiais e a cota de JES do mês. Dados fictícios (D7): oficiais 9907xx-x.
let api: ApiDeTeste;
let rodada: RodadaDeTeste;
let outraEscala: string;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let seq = 0;

async function oficial(nome: string, antiguidade: number, voluntarioJes: boolean) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9907${String(10 + seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade, voluntario_jes: voluntarioJes });
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
const lancarJes = (mes: string, dia: string, letra: string, nome: string) => api.pedir('gestorGb', 'POST', rota(mes, '/lancamentos'), { dia, letra, servico: 'jes', militarId: ids[nome] });
const cotaDeJes = (mes: string, quantidade: number, prioridade = 1) =>
  inserir(api.banco, 'cota', { mes: `${mes}-01`, unidade_id: api.ids.gb, servico_id: rodada.jes, quantidade, prioridade });

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('a', 1, false); // nenhum é voluntário JES no cadastro: na escala dos oficiais, todos podem
  await oficial('b', 2, false);
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
  // outra escala da unidade que também usa o serviço JES
  outraEscala = await inserir(api.banco, 'escala', { unidade_id: api.ids.gb, nome: 'Operações comuns', titulo: 'OPERAÇÕES', militares_doc: 'escalados', dias_doc: 'todos' });
  await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [outraEscala, rodada.jes]);
});
afterAll(async () => {
  await api.fechar();
});

describe('JES para todo elegível', () => {
  it('quem não é voluntário JES no cadastro recebe JES na escala dos oficiais (201/200, sem a recusa de antes)', async () => {
    expect((await abrir('2027-06')).status).toBe(200);
    const r = await lancarJes('2027-06', '2027-06-02', 'A', 'a');
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.turnos.find((t) => t.dia === '2027-06-02' && t.letra === 'A')).toMatchObject({ servico: 'jes', militarId: ids.a });
  });
});

describe('a cota de JES do mês', () => {
  it('sem cota cadastrada: cota null, e os JES lançados contam como usados', async () => {
    const e = await ler('2027-06');
    expect(e.jes).toEqual({ cota: null, usados: 1 });
  });

  it('com cota cadastrada: a cota é a do serviço JES da unidade no mês, e os usados contam os JES de todas as escalas da unidade', async () => {
    await cotaDeJes('2027-06', 15);
    // uma cota de outro mês não entra
    await cotaDeJes('2027-07', 99);
    // um JES lançado em outra escala da unidade no mesmo mês (Review Focus 3)
    const turnoDoJes = rodada.jesA;
    await inserir(api.banco, 'alocacao', { militar_id: ids.b, escala_id: outraEscala, servico_id: rodada.jes, turno_id: turnoDoJes, data: '2027-06-10', origem: 'manual' });
    // e um em outro mês, que não conta
    await inserir(api.banco, 'alocacao', { militar_id: ids.b, escala_id: outraEscala, servico_id: rodada.jes, turno_id: turnoDoJes, data: '2027-07-10', origem: 'manual' });
    const e = await ler('2027-06');
    expect(e.jes).toEqual({ cota: 15, usados: 2 });
  });

  it('com a cota acabada, lançar JES continua valendo (o escalante nunca é bloqueado)', async () => {
    await cotaDeJes('2027-08', 1);
    expect((await abrir('2027-08')).status).toBe(200);
    expect((await lancarJes('2027-08', '2027-08-02', 'A', 'a')).status).toBe(200);
    expect((await lancarJes('2027-08', '2027-08-03', 'A', 'b')).status).toBe(200);
    expect((await ler('2027-08')).jes).toEqual({ cota: 1, usados: 2 });
  });
});
