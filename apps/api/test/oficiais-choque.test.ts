import type { EscalaDosOficiais } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// 6.39: a escala dos oficiais confere o choque como as outras (6.37) e o Saldo no expediente se resolve com a decisão do escalante (6.38). Dados fictícios (D7).
// Setembro de 2027: dia 1 = quarta; 4 e 5 = fim de semana; 6 e 8 a 10 = dias úteis (o 7 é feriado nacional).
let api: ApiDeTeste;
let rodada: RodadaDeTeste;
let outraEscala: string;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
const MES = '2027-09';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
let seq = 0;

async function oficial(nome: string, jornada: 'adm' | 'pronto', antiguidade: number) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9908${String(10 + seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto.CAP, nome_guerra: nome.toUpperCase(), antiguidade });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada, desde: '2026-12-01', quadro_id: quadro.QOC });
  ids[nome] = id;
}
const rota = (resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${MES}${resto}`;
const ler = async (): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota())).json();
const lancar = (d: string, letra: string, servico: 'jes' | 'saldo', nome: string, resolverChoque?: { expediente: true }) =>
  api.pedir('gestorGb', 'POST', rota('/lancamentos'), { dia: d, letra, servico, militarId: ids[nome], ...(resolverChoque ? { resolverChoque } : {}) });
const doLugar = (e: EscalaDosOficiais, d: string, letra: string) => e.turnos.find((t) => t.dia === d && t.letra === letra)!;
const alocacoes = async (nome: string, d: string) => (await api.banco.query('select 1 from alocacao where militar_id = $1 and data = $2::date', [ids[nome], d])).rows.length;

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('adm', 'adm', 1);
  await oficial('adm2', 'adm', 2);
  await oficial('pronto', 'pronto', 3);
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
  // outra escala da unidade que também usa o serviço JES (o JES lançado lá conta para o choque)
  outraEscala = await inserir(api.banco, 'escala', { unidade_id: api.ids.gb, nome: 'Operações comuns', titulo: 'OPERAÇÕES', militares_doc: 'escalados', dias_doc: 'todos' });
  await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [outraEscala, rodada.jes]);
  const e = await ler();
  await api.pedir('gestorGb', 'PUT', rota('/participantes'), { militarIds: e.oficiais.map((o) => o.militarId) });
  expect((await api.pedir('gestorGb', 'POST', rota('/abrir'))).status).toBe(200);
});
afterAll(async () => {
  await api.fechar();
});

describe('a escala dos oficiais confere o choque (6.39)', () => {
  it('Review Focus 1: o oficial com JES em outra escala no mesmo horário é recusado ("Já escalado neste horário") e nada muda; sobreposto é "Choque de horário"', async () => {
    // fim de semana, sem expediente: só o choque entre serviços
    await inserir(api.banco, 'alocacao', { militar_id: ids.pronto, escala_id: outraEscala, servico_id: rodada.jes, turno_id: rodada.jesA, data: dia(4), origem: 'manual' });
    const igual = await lancar(dia(4), 'A', 'jes', 'pronto');
    expect(igual.status).toBe(409);
    expect((await igual.json()).erro).toBe('Já escalado neste horário');
    // o Saldo B (19h às 07h) do mesmo dia começa quando o JES A (07h às 19h) termina: emendar não é choque
    expect((await lancar(dia(4), 'B', 'saldo', 'pronto')).status).toBe(200);
    // um serviço de outra escala da unidade das 06h às 14h (sábado 11): o JES A (07h às 19h) se sobrepõe a ele
    const extra = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Madrugada', tipo: 'ordinario', cor: '#1F6F8B' });
    const turnoExtra = await inserir(api.banco, 'turno', { servico_id: extra, letra: 'A', inicio: '06:00', fim: '14:00' });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 2)', [outraEscala, extra]);
    await inserir(api.banco, 'alocacao', { militar_id: ids.pronto, escala_id: outraEscala, servico_id: extra, turno_id: turnoExtra, data: dia(11), origem: 'manual' });
    const sobre = await lancar(dia(11), 'A', 'saldo', 'pronto');
    expect(sobre.status).toBe(409);
    expect((await sobre.json()).erro).toBe('Choque de horário');
    expect(doLugar(await ler(), dia(11), 'A').militarId).toBeNull();
  });

  it('o oficial com jornada Adm, num dia útil: o JES no horário do expediente é 409 "De expediente neste dia" (e não pode ser resolvido); em fim de semana passa', async () => {
    const r = await lancar(dia(8), 'A', 'jes', 'adm');
    expect(r.status).toBe(409);
    const corpo = await r.json();
    expect(corpo.erro).toBe('De expediente neste dia');
    expect('resolvivel' in corpo).toBe(false);
    expect(await alocacoes('adm', dia(8))).toBe(0);
    expect((await lancar(dia(5), 'A', 'jes', 'adm')).status).toBe(200);
  });

  it('o Saldo no expediente: 409 que diz que dá para resolver; com `resolverChoque: { expediente: true }` grava', async () => {
    const sem = await lancar(dia(9), 'A', 'saldo', 'adm');
    expect(sem.status).toBe(409);
    expect(await sem.json()).toMatchObject({ erro: 'De expediente neste dia', resolvivel: 'expediente' });
    expect(await alocacoes('adm', dia(9))).toBe(0);
    const com = await lancar(dia(9), 'A', 'saldo', 'adm', { expediente: true });
    expect(com.status).toBe(200);
    expect(doLugar(await com.json(), dia(9), 'A')).toMatchObject({ servico: 'saldo', militarId: ids.adm });
  });

  it('o pedido de passar por cima do expediente não vale para o JES: continua 409', async () => {
    const r = await lancar(dia(10), 'A', 'jes', 'adm2', { expediente: true });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('De expediente neste dia');
    expect(await alocacoes('adm2', dia(10))).toBe(0);
  });

  it('o oficial sem jornada Adm não tem expediente: JES e Saldo num dia útil passam', async () => {
    expect((await lancar(dia(6), 'A', 'jes', 'pronto')).status).toBe(200);
    expect((await lancar(dia(6), 'B', 'saldo', 'pronto')).status).toBe(200);
  });

  it('trocar o nome do lugar para um oficial em choque é 409 e o lugar continua com o primeiro', async () => {
    expect((await lancar(dia(5), 'B', 'jes', 'pronto')).status).toBe(200);
    // o adm2 já tem JES em outra escala no mesmo horário
    await inserir(api.banco, 'alocacao', { militar_id: ids.adm2, escala_id: outraEscala, servico_id: rodada.jes, turno_id: rodada.jesB, data: dia(5), origem: 'manual' });
    const r = await lancar(dia(5), 'B', 'jes', 'adm2');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já escalado neste horário');
    expect(doLugar(await ler(), dia(5), 'B').militarId).toBe(ids.pronto);
  });

  it('Review Focus 3: o JES recusado por choque não refaz a rodada (os lugares de Saldo não mudam); o gravado refaz', async () => {
    const antes = (await ler()).lugaresDeSaldo;
    expect((await lancar(dia(8), 'A', 'jes', 'adm2')).status).toBe(409);
    expect((await ler()).lugaresDeSaldo).toBe(antes);
    // o B (19h às 07h) começa depois do expediente: passa, e cada JES lançado tira um lugar da rodada de Saldo
    expect((await lancar(dia(8), 'B', 'jes', 'adm')).status).toBe(200);
    expect((await ler()).lugaresDeSaldo).toBe(antes - 1);
  });
});
