import { somarMeses } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { planejarPreEscala } from '../src/escala/pre-escala.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';

// 6.40, Task 1: o expediente do Adm lançado pela pré-escala (sem escala). Cenário fictício (D7): uma seção com Pronto (A 08h–20h), Expediente (A 08h–16h) e Saldo
// (A 08h–20h, que tira do expediente), a equipe Alfa e os Adm ADM1 a ADM4.
let api: ApiDeTeste;
let escala: string;
let pronto: string;
let expediente: { id: string; turno: string };
let saldo: { id: string; turno: string };
let alfa: string;
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const todos = diasDoMes(mes);
const uteis = todos.filter((d) => diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5);
const fimDeSemana = todos.filter((d) => diaDaSemana(d) === 0 || diaDaSemana(d) === 6);
// os dias usados nas exceções: do 4º dia útil em diante, para não esbarrar uns nos outros
const [, , , diaDoFeriado, diaDoFeriadoDeCima, diaDoSaldo, diaDoAfastamento, diaDaRemocao] = uteis as [string, string, string, string, string, string, string, string];
const secao = () => `/api/unidades/${api.ids.secao}`;
let seq = 0;

async function adm(nome: string, extra: { desde?: string; ate?: string | null; jornada?: 'adm' | 'pronto'; quadro?: string | null; unidade?: string; equipe?: string | null } = {}) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = militar[nome] ?? (await inserir(api.banco, 'militar', { matricula: `99${String(7100 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, antiguidade: seq }));
  militar[nome] = id;
  await inserir(api.banco, 'rastreio', {
    militar_id: id, unidade_id: extra.unidade ?? api.ids.secao, jornada: extra.jornada ?? 'adm', equipe_id: extra.equipe ?? null, desde: extra.desde ?? `${atual}-01`, ate: extra.ate ?? null,
    quadro_id: extra.quadro ?? null, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa'),
  });
  return id;
}
const doDia = (novas: { militarId: string; data: string; servicoId: string }[], d: string) => novas.filter((n) => n.data === d && n.servicoId === expediente.id).map((n) => Object.entries(militar).find(([, v]) => v === n.militarId)![0]).sort();
const expedientes = <T extends { servicoId: string }>(novas: T[]) => novas.filter((n) => n.servicoId === expediente.id);

beforeAll(async () => {
  api = await montarApi();
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const servico = async (nome: string, tipo: string, inicio: string, fim: string) => {
    const id = ((await (await api.pedir('admin', 'POST', `${secao()}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
    const turno = (await (await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio, fim })).json()).turnos[0].id as string;
    return { id, turno };
  };
  pronto = (await servico('Pronto', 'ordinario', '08:00', '20:00')).id;
  expediente = await servico('Expediente', 'ordinario', '08:00', '16:00');
  saldo = await servico('Saldo', 'ordinario', '08:00', '20:00');
  escala = ((await (await api.pedir('admin', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pronto, saldo.id] })).status).toBe(200);
  await adm('ADM1', {});
  await adm('ADM2', {});
  await adm('ADM3', { ate: `${mes}-15` });
  await adm('ADM3', { desde: `${mes}-16`, jornada: 'pronto', equipe: alfa });
  // feriado da unidade e de uma unidade de cima (o 2º GB): os dois tiram o expediente do dia
  await inserir(api.banco, 'feriado', { unidade_id: api.ids.secao, data: diaDoFeriado, descricao: 'Feriado da seção' });
  await inserir(api.banco, 'feriado', { unidade_id: api.ids.gb, data: diaDoFeriadoDeCima, descricao: 'Feriado do grupamento' });
  // ADM1 já tem um Saldo no horário do expediente; ADM2 está afastado
  await inserir(api.banco, 'alocacao', { militar_id: militar.ADM1, escala_id: escala, servico_id: saldo.id, turno_id: saldo.turno, data: diaDoSaldo, origem: 'manual' });
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
  expect((await api.pedir('gestorGb', 'POST', `/api/militares/${militar.ADM2}/afastamentos`, { tipoAfastamentoId: tipo, inicio: diaDoAfastamento, fim: diaDoAfastamento })).status).toBe(201);
});
afterAll(async () => {
  await api.fechar();
});

describe('o expediente do Adm na pré-escala (6.40)', () => {
  it('todo dia útil, para o Adm: sem alocação com escala, do serviço Expediente, e nada no fim de semana', async () => {
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(doDia(novas, uteis[0]!)).toEqual(['ADM1', 'ADM2', 'ADM3']);
    for (const d of fimDeSemana) expect(doDia(novas, d)).toEqual([]);
    expect(expedientes(novas).every((n) => (n as { escalaId?: null }).escalaId === null)).toBe(true);
    expect(previa.entramNoExpediente).toBe(expedientes(novas).length);
  });

  it('feriado da unidade e feriado de uma unidade de cima (Review Focus 2) tiram o expediente do dia', async () => {
    const { novas } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(doDia(novas, diaDoFeriado)).toEqual([]);
    expect(doDia(novas, diaDoFeriadoDeCima)).toEqual([]);
  });

  it('o afastado fica sem expediente só no dia do afastamento, e quem já tem Saldo no horário do expediente fica sem o dia', async () => {
    const { novas } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(doDia(novas, diaDoAfastamento)).toEqual(['ADM1', 'ADM3']);
    expect(doDia(novas, diaDoSaldo)).toEqual(['ADM2', 'ADM3']);
  });

  it('Review Focus 3: a jornada que muda no meio do mês: expediente só até o dia 15; depois ele é do Pronto e não recebe expediente', async () => {
    const { novas } = await planejarPreEscala(api.banco, escala, mes, alfa);
    const adm3 = expedientes(novas).filter((n) => n.militarId === militar.ADM3).map((n) => n.data);
    expect(adm3.length).toBeGreaterThan(0);
    expect(adm3.every((d) => d <= `${mes}-15`)).toBe(true);
    expect(adm3).toContain(uteis.filter((d) => d <= `${mes}-15`).at(-1)!);
  });

  it('o oficial (QOC) e o externo de outra unidade não recebem expediente', async () => {
    const qoc = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QOC'")).rows[0]!.id;
    await adm('OFICIAL', { quadro: qoc });
    const outra = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
    const externo = await adm('EXTERNO', { unidade: outra });
    await api.banco.query('insert into vinculo_externo (militar_id, unidade_id, desde) values ($1, $2, $3::date)', [externo, api.ids.secao, `${atual}-01`]);
    const { novas } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(doDia(novas, uteis[0]!)).toEqual(['ADM1', 'ADM2', 'ADM3']);
  });

  it('Review Focus 4: gerar duas vezes não duplica, e o expediente que o escalante removeu num dia não volta', async () => {
    const url = `/api/escalas/${escala}/mes/${mes}/pre-escala`;
    const primeira = await api.pedir('escalante', 'POST', url, { equipeDia1Id: alfa });
    expect(primeira.status).toBe(201);
    const gravadas = (await primeira.json()).gravadas as number;
    expect(gravadas).toBeGreaterThan(0);
    const noBanco = async () => (await api.banco.query<{ n: number }>("select count(*)::int as n from alocacao where servico_id = $1 and origem = 'pre_escala'", [expediente.id])).rows[0]!.n;
    const antes = await noBanco();
    const segunda = await api.pedir('escalante', 'POST', url, { equipeDia1Id: alfa });
    expect((await segunda.json()).gravadas).toBe(0);
    expect(await noBanco()).toBe(antes);
    // o escalante tira o expediente do ADM1 num dia (a remoção fica registrada): gerar de novo não o devolve
    await api.banco.query('delete from alocacao where militar_id = $1 and data = $2::date and servico_id = $3', [militar.ADM1, diaDaRemocao, expediente.id]);
    await inserir(api.banco, 'remocao', { militar_id: militar.ADM1, escala_id: null, servico_id: expediente.id, turno_id: expediente.turno, data: diaDaRemocao });
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(doDia(novas, diaDaRemocao)).not.toContain('ADM1');
    expect(previa.removidosQueNaoVoltam).toBeGreaterThanOrEqual(1);
  });

  it('a alocação sem escala só vale para o serviço Expediente: qualquer outro serviço é recusado pelo banco', async () => {
    await expect(
      api.banco.query("insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, origem) values ($1, null, $2, $3, $4::date, 'manual')", [militar.ADM1, saldo.id, saldo.turno, uteis[1]!]),
    ).rejects.toThrow(/Expediente/);
  });

  it('uma unidade sem o serviço Expediente gera só o Pronto e avisa', async () => {
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2026-11-01' });
    const equipe8 = await inserir(api.banco, 'equipe', { unidade_id: outra, nome: 'Alfa', ordem_ciclo: 1 });
    const p = ((await (await api.pedir('admin', 'POST', `/api/unidades/${outra}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
    await api.pedir('admin', 'POST', `/api/servicos/${p}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' });
    // as unidades novas já nascem com os serviços fixos? só o Expediente nos interessa: apaga-o, se existir
    await api.banco.query("delete from turno where servico_id in (select id from servico where unidade_id = $1 and lower(btrim(nome)) = 'expediente')", [outra]);
    await api.banco.query("delete from servico where unidade_id = $1 and lower(btrim(nome)) = 'expediente'", [outra]);
    const e8 = ((await (await api.pedir('admin', 'POST', `/api/unidades/${outra}/escalas`, { nome: 'Ordinário 8' })).json()) as { id: string }).id;
    expect((await api.pedir('admin', 'PUT', `/api/escalas/${e8}/servicos`, { servicoIds: [p] })).status).toBe(200);
    const { previa, novas } = await planejarPreEscala(api.banco, e8, mes, equipe8);
    expect(previa.semExpediente).toBe('Sem o serviço Expediente na unidade: o expediente não foi gerado.');
    expect(previa.avisos).toContain('Sem o serviço Expediente na unidade: o expediente não foi gerado.');
    expect(previa.entramNoExpediente).toBe(0);
    expect(novas.every((n) => n.servicoId === p)).toBe(true);
  });
});
