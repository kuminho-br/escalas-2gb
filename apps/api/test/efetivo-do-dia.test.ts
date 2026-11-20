import type { EfetivoDoDia, GuarnicaoNoEfetivo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7). Escala Ordinário: Pronto A (08–20) e B (20–08), Saldo C (16–20) e JES A (08–20). Escala PE Seguro: diária A (08–16).
// Modelos: Salvamento (Motorista 1), Resgate (Motorista 1 e Auxiliar 1–2), ACO (Auxiliar 1), ABT (Motorista 1), Praia (Auxiliar 1), Mergulho
// (sem vínculo) e Antigo (desativado). Cada cenário usa um dia próprio, para um não mexer no outro.
let api: ApiDeTeste;
let outraSecao: string;
let ordinario: string;
let peSeguro: string;
let pronto: { id: string; a: string; b: string };
let saldo: { id: string; c: string };
let jes: { id: string; a: string };
let diaria: { id: string; a: string };
let motorista: string;
let auxiliar: string;
let salvamento: string;
let resgate: string;
let aco: string;
let abt: string;
let praia: string;
let mergulho: string;
let antigo: string;
const militares: Record<string, string> = {};
const HOJE = hojeRecife();
const atual = HOJE.slice(0, 7);
const dia = (n: number): string => new Date(Date.parse(`${HOJE}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const secao = () => `/api/unidades/${api.ids.secao}`;
const FAIXA_A = { inicio: '08:00', fim: '20:00' };
const FAIXA_B = { inicio: '20:00', fim: '08:00' };
const FAIXA_DIARIA = { inicio: '08:00', fim: '16:00' };

const efetivo = (data: string, quem: 'escalante' | 'semPapel' = 'escalante', unidade = api.ids.secao) => api.pedir(quem, 'GET', `/api/unidades/${unidade}/efetivo-do-dia/${data}`);
const ler = async (data: string): Promise<EfetivoDoDia> => {
  const r = await efetivo(data);
  expect(r.status).toBe(200);
  return r.json();
};
const card = (e: EfetivoDoDia, nome: string): GuarnicaoNoEfetivo => e.guarnicoes.find((g) => g.nome === nome)!;
const definirMeta = async (data: string, guarnicoes: string[]) => expect((await api.pedir('admin', 'PUT', `${secao()}/meta-do-dia/${data}`, { guarnicoes })).status).toBe(200);
const resumo = (g: GuarnicaoNoEfetivo) => g.militares.map((m) => [m.funcao, m.nomeGuerra, m.inicio, m.fim, m.servico.nome, m.acumulo]);

const servicoComTurnos = async (nome: string, tipo: string, cor: string, turnos: [string, string, string][]) => {
  const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, cor });
  const ids: Record<string, string> = {};
  for (const [letra, inicio, fim] of turnos) ids[letra.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
  return { id, ...ids };
};
const alocar = (militar: string, escala: string, servico: string, turno: string, data: string, guarnicao: string | null, funcao: string | null) =>
  inserir(api.banco, 'alocacao', { militar_id: militares[militar], escala_id: escala, servico_id: servico, turno_id: turno, data, guarnicao_id: guarnicao, funcao_id: funcao, origem: 'manual' });
const criarModelo = async (nome: string, composicao: { funcaoId: string; minimo: number; maximo: number }[]): Promise<string> => {
  const r = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: composicao.map((f) => ({ ...f, cnhExigida: null })) },
  });
  expect(r.status).toBe(201);
  return (await r.json()).id;
};
const criarEscala = async (nome: string, servicoIds: string[], vinculos: { guarnicaoId: string; inicio: string; fim: string }[]): Promise<string> => {
  const id = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome })).json()).id as string;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${id}/servicos`, { servicoIds })).status).toBe(200);
  const v = await api.pedir('escalante', 'PUT', `/api/escalas/${id}/vinculos/${atual}`, { itens: vinculos });
  expect(v.status).toBe(200);
  return id;
};

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  auxiliar = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Auxiliar' });
  pronto = await servicoComTurnos('Pronto', 'ordinario', '#2F8F5B', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]) as typeof pronto;
  saldo = await servicoComTurnos('Saldo', 'ordinario', '#2B7BB9', [['C', '16:00', '20:00']]) as typeof saldo;
  jes = await servicoComTurnos('JES', 'pjes', '#6E56A8', [['A', '08:00', '20:00']]) as typeof jes;
  diaria = await servicoComTurnos('PE Seguro', 'diaria', '#3C5F9C', [['A', '08:00', '16:00']]) as typeof diaria;
  const um = { minimo: 1, maximo: 1 };
  salvamento = await criarModelo('Salvamento', [{ funcaoId: motorista, ...um }]);
  resgate = await criarModelo('Resgate', [{ funcaoId: motorista, ...um }, { funcaoId: auxiliar, minimo: 1, maximo: 2 }]);
  aco = await criarModelo('ACO', [{ funcaoId: auxiliar, ...um }]);
  abt = await criarModelo('ABT', [{ funcaoId: motorista, ...um }]);
  praia = await criarModelo('Praia', [{ funcaoId: auxiliar, ...um }]);
  mergulho = await criarModelo('Mergulho', [{ funcaoId: motorista, ...um }]);
  antigo = await criarModelo('Antigo', [{ funcaoId: motorista, ...um }]);
  const nas = (guarnicaoId: string, ...faixas: { inicio: string; fim: string }[]) => faixas.map((f) => ({ guarnicaoId, ...f }));
  ordinario = await criarEscala('Ordinário', [pronto.id, saldo.id, jes.id], [
    ...nas(salvamento, FAIXA_A, FAIXA_B), ...nas(resgate, FAIXA_A, FAIXA_B), ...nas(aco, FAIXA_A), ...nas(abt, FAIXA_A), ...nas(antigo, FAIXA_A),
  ]);
  peSeguro = await criarEscala('PE Seguro', [diaria.id], [...nas(resgate, FAIXA_DIARIA), ...nas(praia, FAIXA_DIARIA)]);
  expect((await api.pedir('escalante', 'POST', `/api/guarnicoes/${antigo}/situacao`, { ativa: false, aPartirDe: atual })).status).toBe(200);
  const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-E', nome: 'Soldado E', ordem: 920 });
  for (const [i, nome] of ['MOT-A', 'MOT-B', 'AUX-DIA', 'AUX-SALDO', 'AUX-NOITE', 'MOT-ABT', 'COTA-1', 'COTA-2'].entries()) {
    militares[nome] = await inserir(api.banco, 'militar', { matricula: `99081${i}-${i}`, posto_grad_id: posto, nome_guerra: nome });
  }
});
afterAll(async () => {
  await api.fechar();
});

describe('o turno que atravessa a meia-noite (Review Focus 1)', () => {
  const d = dia(1);
  beforeAll(async () => {
    await definirMeta(d, [salvamento]);
    await alocar('MOT-A', ordinario, pronto.id, pronto.a, d, salvamento, motorista);
    // 20h do dia anterior: entra às 20h de ontem e sai às 08h de hoje, mas pertence a ontem
    await alocar('MOT-B', ordinario, pronto.id, pronto.b, dia(0), salvamento, motorista);
  });

  it('o buraco de 20h às 08h aparece, com a escala que vincula o horário, e quem entra às 20h do dia anterior não cobre o dia', async () => {
    const e = await ler(d);
    const g = card(e, 'Salvamento');
    expect(g).toMatchObject({ ordem: 1, ativada: false, viatura: null });
    expect(g.horarios).toEqual([{ inicio: '08:00', fim: '08:00' }]);
    expect(g.faltas).toEqual([{ funcao: 'Motorista', faltam: 1, inicio: '20:00', fim: '08:00', escalaId: ordinario }]);
    expect(resumo(g)).toEqual([['Motorista', 'MOT-A', '08:00', '20:00', 'Pronto', false]]);
    expect(e.meta).toEqual({ origem: 'dia', total: 1, ativadas: 0 });
  });
});

describe('o mesmo modelo em duas escalas, e a ordem do painel (Review Focus 2)', () => {
  const d = dia(2);
  beforeAll(async () => {
    await definirMeta(d, [aco, resgate]);
    await alocar('MOT-A', ordinario, pronto.id, pronto.a, d, resgate, motorista);
    await alocar('MOT-B', ordinario, pronto.id, pronto.b, d, resgate, motorista);
    await alocar('AUX-DIA', peSeguro, diaria.id, diaria.a, d, resgate, auxiliar);
    await alocar('AUX-SALDO', ordinario, saldo.id, saldo.c, d, resgate, auxiliar);
    await alocar('AUX-NOITE', ordinario, pronto.id, pronto.b, d, resgate, auxiliar);
    await alocar('MOT-ABT', ordinario, pronto.id, pronto.a, d, abt, motorista);
  });

  it('um card só para o Resgate, com a diária de 08–16 e o Saldo de 16–20 fechando o auxiliar, e cada militar com o serviço dele', async () => {
    const e = await ler(d);
    expect(e.guarnicoes.filter((g) => g.nome === 'Resgate')).toHaveLength(1);
    const g = card(e, 'Resgate');
    expect(g.ativada).toBe(true);
    expect(g.faltas).toEqual([]);
    expect(resumo(g)).toEqual([
      ['Motorista', 'MOT-A', '08:00', '20:00', 'Pronto', false],
      ['Motorista', 'MOT-B', '20:00', '08:00', 'Pronto', false],
      ['Auxiliar', 'AUX-DIA', '08:00', '16:00', 'PE Seguro', false],
      ['Auxiliar', 'AUX-SALDO', '16:00', '20:00', 'Saldo', false],
      ['Auxiliar', 'AUX-NOITE', '20:00', '08:00', 'Pronto', false],
    ]);
    expect(g.militares[2]!.servico).toMatchObject({ id: diaria.id, nome: 'PE Seguro', cor: '#3C5F9C' });
    expect(g.militares[0]).toMatchObject({ posto: 'SD-E', funcaoId: motorista, militarId: militares['MOT-A'] });
  });

  it('a ordem é a da meta, com o número; o que está fora da meta vem depois, sem número, e a não ativação não muda a posição', async () => {
    const e = await ler(d);
    expect(e.guarnicoes.map((g) => [g.nome, g.ordem, g.ativada])).toEqual([['ACO', 1, false], ['Resgate', 2, true], ['ABT', null, true]]);
    expect(e.meta).toEqual({ origem: 'dia', total: 2, ativadas: 1 });
    expect(card(e, 'ACO')).toMatchObject({ horarios: [{ inicio: '08:00', fim: '20:00' }], militares: [] });
    expect(card(e, 'ACO').faltas).toEqual([{ funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '20:00', escalaId: ordinario }]);
  });
});

describe('acúmulo (decisão do design)', () => {
  const d = dia(3);
  beforeAll(async () => {
    await definirMeta(d, [aco]);
    const alocacaoId = await alocar('MOT-A', ordinario, pronto.id, pronto.a, d, abt, motorista);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alocacaoId, guarnicao_id: aco, funcao_id: auxiliar });
  });

  it('o militar do Pronto que acumula a função de auxiliar cobre o horário do turno dele', async () => {
    const e = await ler(d);
    expect(card(e, 'ACO').ativada).toBe(true);
    expect(resumo(card(e, 'ACO'))).toEqual([['Auxiliar', 'MOT-A', '08:00', '20:00', 'Pronto', true]]);
    expect(resumo(card(e, 'ABT'))).toEqual([['Motorista', 'MOT-A', '08:00', '20:00', 'Pronto', false]]);
    expect(e.meta.ativadas).toBe(1);
  });
});

describe('modelo da meta sem horário no dia (Review Focus 3)', () => {
  const d = dia(4);
  beforeAll(async () => {
    await definirMeta(d, [mergulho, antigo]);
  });

  it('o modelo sem vínculo e o desativado aparecem como não ativados, sem horários nem faltas, e não quebram o painel', async () => {
    const e = await ler(d);
    expect(e.guarnicoes.map((g) => [g.nome, g.ordem, g.ativada, g.horarios, g.faltas])).toEqual([
      ['Mergulho', 1, false, [], []],
      ['Antigo', 2, false, [], []],
    ]);
    expect(e.meta).toEqual({ origem: 'dia', total: 2, ativadas: 0 });
  });
});

describe('faltas de uma guarnição em duas escalas', () => {
  const d = dia(6);
  beforeAll(async () => {
    await definirMeta(d, [resgate, praia]);
  });

  it('os horários das duas escalas viram um trecho só, e a falta aponta para a primeira escala, pelo nome, que vincula o horário', async () => {
    const e = await ler(d);
    expect(card(e, 'Resgate').horarios).toEqual([{ inicio: '08:00', fim: '08:00' }]);
    expect(card(e, 'Resgate').faltas).toEqual([
      { funcao: 'Motorista', faltam: 1, inicio: '08:00', fim: '08:00', escalaId: ordinario },
      { funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '08:00', escalaId: ordinario },
    ]);
    expect(card(e, 'Praia').faltas).toEqual([{ funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '16:00', escalaId: peSeguro }]);
  });
});

describe('cotas restantes', () => {
  const d = dia(5);
  it('traz por serviço a soma das cotas do mês e das alocações já distribuídas', async () => {
    expect((await ler(d)).cotas).toEqual([]);
    const cota = await api.pedir('escalante', 'POST', `${secao()}/cotas`, { mes: d.slice(0, 7), servicoId: jes.id, quantidade: 40, origem: 'interna', prioridade: 1 });
    expect(cota.status).toBe(201);
    await alocar('COTA-1', ordinario, jes.id, jes.a, d, null, null);
    await alocar('COTA-2', ordinario, jes.id, jes.a, d, null, null);
    expect((await ler(d)).cotas).toEqual([{ servicoId: jes.id, servico: 'JES', cor: '#6E56A8', quantidade: 40, usadas: 2 }]);
  });
});

describe('acesso', () => {
  it('o escalante lê; o militar sem papel e outra seção são 403; a data precisa existir', async () => {
    expect((await efetivo(dia(1))).status).toBe(200);
    expect((await efetivo(dia(1), 'semPapel')).status).toBe(403);
    expect((await efetivo(dia(1), 'escalante', outraSecao)).status).toBe(403);
    expect((await efetivo('2026-02-30')).status).toBe(400);
  });

  it('um dia sem nada é um painel vazio, e a meta padrão vazia não quebra', async () => {
    expect(await ler(dia(30))).toEqual({ data: dia(30), meta: { origem: 'padrao', total: 0, ativadas: 0 }, guarnicoes: [], cotas: [] });
  });
});
