import type { EscalaDosOficiais, MemorialDaEscala } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Entrega 6.30: o memorial de cálculo. Cada recálculo das cotas grava um registro (motivo, quem e a conta inteira); a rota devolve os registros e os serviços
// do mês. Dados fictícios (D7): oficiais 9907xx-x no 2º GB. Meses de 2027, um por teste, para não se misturarem.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let rodada: RodadaDeTeste;
let seq = 0;

async function oficial(nome: string, antiguidade: number) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9907${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada: 'adm', desde: '2026-12-01', quadro_id: quadro.QOC });
  ids[nome] = id;
}

const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
const memorial = async (mes: string): Promise<MemorialDaEscala> => (await api.pedir('gestorGb', 'GET', rota(mes, '/memorial'))).json();
const marcar = (mes: string, nomes: string[]) => api.pedir('gestorGb', 'PUT', rota(mes, '/participantes'), { militarIds: nomes.map((n) => ids[n]) });
const abrir = async (mes: string) => {
  const e = await ler(mes);
  await marcar(mes, e.oficiais.map((o) => o.nomeGuerra.toLowerCase()));
  return api.pedir('gestorGb', 'POST', rota(mes, '/abrir'));
};
const lancar = (mes: string, dia: string, letra: string, nome: string, servico: 'jes' | 'saldo' = 'saldo') =>
  api.pedir('gestorGb', 'POST', rota(mes, '/lancamentos'), { dia, letra, servico, militarId: ids[nome] });

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

describe('o registro do memorial', () => {
  it('abrir o mês grava o primeiro registro, com o motivo "Abriu o mês" e a conta inteira (turnos, JES, rodada, participantes com devido e cota)', async () => {
    expect((await abrir('2027-05')).status).toBe(200);
    const m = await memorial('2027-05');
    expect(m.registros).toHaveLength(1);
    const [r] = m.registros;
    expect(r!.motivo).toBe('Abriu o mês');
    expect(r!.conta.turnos).toBe(62);
    expect(r!.conta.rodada).toBe(62);
    expect(r!.conta.jes).toBe(0);
    expect(r!.conta.participantes.map((p) => p.nomeGuerra)).toEqual(['A', 'B']);
    expect(r!.conta.participantes.reduce((s, p) => s + p.cota, 0)).toBe(62);
    expect(r!.conta.participantes[0]).toMatchObject({ patente: 'CAP', diasNoMes: 31, afastamentos: [] });
    expect(new Date(r!.criadoEm).toString()).not.toBe('Invalid Date');
  });

  it('o memorial é lido do mais novo para o mais antigo, e a conta atual vem junto', async () => {
    await marcar('2027-05', ['a']);
    await marcar('2027-05', ['a', 'b']);
    const m = await memorial('2027-05');
    expect(m.registros.map((r) => r.motivo)).toEqual(['Mudou quem participa', 'Mudou quem participa', 'Abriu o mês']);
    expect(m.registros[0]!.criadoEm >= m.registros[2]!.criadoEm).toBe(true);
    expect(m.contaAtual?.participantes.map((p) => p.nomeGuerra)).toEqual(['A', 'B']);
  });

  it('marcar quem participa (com o mês aberto) grava "Mudou quem participa"; sem o mês aberto, não grava', async () => {
    await marcar('2027-06', ['a']);
    expect((await memorial('2027-06')).registros).toHaveLength(0);
    await abrir('2027-06');
    await marcar('2027-06', ['a', 'b']);
    expect((await memorial('2027-06')).registros.map((r) => r.motivo)).toEqual(['Mudou quem participa', 'Abriu o mês']);
  });

  it('lançar JES (com a escala aberta) grava "Lançou JES"; lançar Saldo não refaz a cota e não grava', async () => {
    await abrir('2027-07');
    const antes = (await memorial('2027-07')).registros.length;
    expect((await lancar('2027-07', '2027-07-02', 'A', 'a', 'saldo')).status).toBe(200);
    expect((await memorial('2027-07')).registros).toHaveLength(antes);
    expect((await lancar('2027-07', '2027-07-03', 'A', 'b', 'jes')).status).toBe(200);
    const m = await memorial('2027-07');
    expect(m.registros[0]!.motivo).toBe('Lançou JES');
    expect(m.registros[0]!.conta.jes).toBe(1);
    expect(m.registros[0]!.conta.rodada).toBe(61);
  });

  it('fechar a escala grava "Fechou a escala" e encerrar o mês grava "Encerrou o mês"', async () => {
    await abrir('2027-08');
    expect((await api.pedir('gestorGb', 'POST', rota('2027-08', '/fechar'))).status).toBe(200);
    expect((await memorial('2027-08')).registros[0]!.motivo).toBe('Fechou a escala');
    expect((await api.pedir('gestorGb', 'POST', rota('2027-08', '/encerrar'))).status).toBe(200);
    expect((await memorial('2027-08')).registros[0]!.motivo).toBe('Encerrou o mês');
  });

  it('muitos recálculos no mesmo mês ficam todos guardados, sem apagar nenhum (Review Focus 1)', async () => {
    await abrir('2027-09');
    for (let i = 0; i < 6; i++) await marcar('2027-09', i % 2 ? ['a'] : ['a', 'b']);
    expect((await memorial('2027-09')).registros).toHaveLength(7);
  });

  it('um mês gravado antes desta entrega (sem registros) mostra a conta atual e nenhum histórico', async () => {
    await abrir('2027-10');
    await api.banco.query('delete from oficiais_memorial where mes_id in (select id from oficiais_mes where mes = $1::date)', ['2027-10-01']);
    const m = await memorial('2027-10');
    expect(m.registros).toEqual([]);
    expect(m.contaAtual?.rodada).toBe(62);
  });

  it('quando a leitura refaz as cotas sozinha (um afastamento que tira dias do oficial), o registro sai com o motivo "Afastamento de CAP A"', async () => {
    await abrir('2027-12');
    expect((await memorial('2027-12')).registros.map((r) => r.motivo)).toEqual(['Abriu o mês']);
    const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    const afastamento = await inserir(api.banco, 'afastamento', { militar_id: ids.a, tipo_afastamento_id: ferias, inicio: '2027-12-10', fim: '2027-12-20' });
    try {
      // a leitura do mês confere a presença e refaz as cotas, gravando o motivo automático
      await ler('2027-12');
      const m = await memorial('2027-12');
      expect(m.registros.map((r) => r.motivo)).toEqual(['Afastamento de CAP A', 'Abriu o mês']);
      expect(m.registros[0]!.conta.participantes.find((p) => p.nomeGuerra === 'A')!.afastamentos).toEqual([{ tipo: 'Férias', inicio: '2027-12-10', fim: '2027-12-20' }]);
    } finally {
      await api.banco.query('delete from afastamento where id = $1', [afastamento]);
    }
  });

  it('os serviços do mês vêm com dia, letra, serviço e o nome de quem ficou com o lugar', async () => {
    await abrir('2027-11');
    await lancar('2027-11', '2027-11-04', 'B', 'b', 'saldo');
    await lancar('2027-11', '2027-11-05', 'A', 'a', 'jes');
    const m = await memorial('2027-11');
    expect(m.servicos).toEqual(expect.arrayContaining([
      { dia: '2027-11-04', letra: 'B', servico: 'saldo', patente: 'CAP', nomeGuerra: 'B', cobriu: null },
      { dia: '2027-11-05', letra: 'A', servico: 'jes', patente: 'CAP', nomeGuerra: 'A', cobriu: null },
    ]));
  });
});
