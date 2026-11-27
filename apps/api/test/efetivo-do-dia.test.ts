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
/** Os trechos ocupados, por função, linha e início: [função, nome, início, fim (minutos), serviço, acúmulo]. */
const resumo = (g: GuarnicaoNoEfetivo) =>
  g.funcoes.flatMap((f) => f.linhas.flatMap((l) => l.filter((t) => t.ocupante).map((t) => [f.funcao, t.ocupante!.nomeGuerra, t.inicio, t.fim, t.ocupante!.servico.nome, t.ocupante!.acumulo])));
/** As vagas: [função, início, fim, opções "Escala HH:MM–HH:MM"]. */
const vagas = (g: GuarnicaoNoEfetivo) =>
  g.funcoes.flatMap((f) => f.linhas.flatMap((l) => l.filter((t) => !t.ocupante).map((t) => [f.funcao, t.inicio, t.fim, t.opcoes.map((o) => `${o.escala} ${o.inicio}–${o.fim}`)])))
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1]));

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
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB' and mae_id = $1", [api.ids.gb])).rows[0]!.id; // a 2ª SB da carga base (a sigla não se repete entre irmãs)
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
    expect(g.faltas).toEqual([{ funcao: 'Motorista', faltam: 1, inicio: '20:00', fim: '08:00' }]);
    expect(resumo(g)).toEqual([['Motorista', 'MOT-A', 480, 1200, 'Pronto', false]]);
    expect(vagas(g)).toEqual([['Motorista', 1200, 1920, ['Ordinário 20:00–08:00']]]);
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
      ['Motorista', 'MOT-A', 480, 1200, 'Pronto', false],
      ['Motorista', 'MOT-B', 1200, 1920, 'Pronto', false],
      ['Auxiliar', 'AUX-DIA', 480, 960, 'PE Seguro', false],
      ['Auxiliar', 'AUX-SALDO', 960, 1200, 'Saldo', false],
      ['Auxiliar', 'AUX-NOITE', 1200, 1920, 'Pronto', false],
    ]);
    // diária e Saldo se encostam: a mesma linha
    expect(g.funcoes[1]!.linhas).toHaveLength(1);
    expect(g.funcoes[1]!.linhas[0]![0]!.ocupante!.servico).toMatchObject({ id: diaria.id, nome: 'PE Seguro', cor: '#3C5F9C' });
    expect(g.funcoes[0]!.linhas[0]![0]!.ocupante).toMatchObject({ posto: 'SD-E', militarId: militares['MOT-A'], acumulo: false });
    expect(g.funcoes[0]).toMatchObject({ funcaoId: motorista, funcao: 'Motorista', minimo: 1, cnhExigida: null });
  });

  it('a ordem é a da meta, com o número; o que está fora da meta vem depois, sem número, e a não ativação não muda a posição', async () => {
    const e = await ler(d);
    expect(e.guarnicoes.map((g) => [g.nome, g.ordem, g.ativada])).toEqual([['ACO', 1, false], ['Resgate', 2, true], ['ABT', null, true]]);
    expect(e.meta).toEqual({ origem: 'dia', total: 2, ativadas: 1 });
    expect(card(e, 'ACO')).toMatchObject({ horarios: [{ inicio: '08:00', fim: '20:00' }], alocados: 0 });
    expect(resumo(card(e, 'ACO'))).toEqual([]);
    expect(card(e, 'ACO').faltas).toEqual([{ funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '20:00' }]);
  });

  it('alocados conta as alocações e os acúmulos do dia na guarnição', async () => {
    const e = await ler(d);
    expect(card(e, 'Resgate').alocados).toBe(5);
    expect(card(e, 'ABT').alocados).toBe(1);
  });
});

describe('acúmulo (decisão do design)', () => {
  const d = dia(3);
  let alocacaoId: string;
  let acumuloId: string;
  beforeAll(async () => {
    await definirMeta(d, [aco]);
    alocacaoId = await alocar('MOT-A', ordinario, pronto.id, pronto.a, d, abt, motorista);
    acumuloId = await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alocacaoId, guarnicao_id: aco, funcao_id: auxiliar });
  });

  it('o militar do Pronto que acumula a função de auxiliar cobre o horário do turno dele', async () => {
    const e = await ler(d);
    expect(card(e, 'ACO').ativada).toBe(true);
    expect(resumo(card(e, 'ACO'))).toEqual([['Auxiliar', 'MOT-A', 480, 1200, 'Pronto', true]]);
    expect(resumo(card(e, 'ABT'))).toEqual([['Motorista', 'MOT-A', 480, 1200, 'Pronto', false]]);
    expect(e.meta.ativadas).toBe(1);
  });

  it('o trecho de acúmulo traz o acumuloId, e o da vaga original não', async () => {
    const e = await ler(d);
    // acumulaCom: no acúmulo, a vaga original; na vaga original, os acúmulos (os avisos do "Remover", como na Escala do mês)
    expect(card(e, 'ACO').funcoes[0]!.linhas[0]![0]!.ocupante!.alocacoes).toEqual([{ alocacaoId, acumuloId, inicio: '08:00', fim: '20:00', acumulaCom: ['Motorista ABT'] }]);
    expect(card(e, 'ABT').funcoes[0]!.linhas[0]![0]!.ocupante!.alocacoes).toEqual([{ alocacaoId, acumuloId: null, inicio: '08:00', fim: '20:00', acumulaCom: ['Auxiliar ACO'] }]);
    expect(card(e, 'ACO').alocados).toBe(1);
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

  it('os horários das duas escalas viram um trecho só nas faltas', async () => {
    const e = await ler(d);
    expect(card(e, 'Resgate').horarios).toEqual([{ inicio: '08:00', fim: '08:00' }]);
    expect(card(e, 'Resgate').faltas).toEqual([
      { funcao: 'Motorista', faltam: 1, inicio: '08:00', fim: '08:00' },
      { funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '08:00' },
    ]);
    expect(card(e, 'Praia').faltas).toEqual([{ funcao: 'Auxiliar', faltam: 1, inicio: '08:00', fim: '16:00' }]);
  });

  it('a vaga é uma faixa só, com todos os vínculos que a tocam, pelo nome da escala (4.2: vaga em faixa única)', async () => {
    const e = await ler(d);
    expect(vagas(card(e, 'Resgate')).filter((v) => v[0] === 'Auxiliar')).toEqual([
      ['Auxiliar', 480, 1920, ['Ordinário 08:00–20:00', 'Ordinário 20:00–08:00', 'PE Seguro 08:00–16:00']],
    ]);
    expect(card(e, 'Resgate').funcoes[1]!.linhas).toHaveLength(1);
    expect(card(e, 'Resgate').funcoes[1]!.linhas[0]![0]!.opcoes[0]).toMatchObject({ escalaId: ordinario, escala: 'Ordinário' });
  });
});

describe('Bioma: três vínculos de 8h (Review Focus 1 e 2 da 4.2)', () => {
  const d = dia(600);
  let bioma: { id: string; a: string; b?: string; c?: string };
  let biomaMod: string;
  let escalaBioma: string;
  beforeAll(async () => {
    const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'BiomaT', tipo: 'diaria', cor: '#C97A00' });
    const turnos: Record<string, string> = {};
    for (const [letra, inicio, fim] of [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']]) turnos[letra!.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
    bioma = { id, a: turnos.a!, b: turnos.b, c: turnos.c };
    biomaMod = await criarModelo('Bioma modelo', [{ funcaoId: auxiliar, minimo: 1, maximo: 1 }]);
    escalaBioma = await criarEscala('Bioma 3 turnos', [id], [
      { guarnicaoId: biomaMod, inicio: '00:00', fim: '08:00' }, { guarnicaoId: biomaMod, inicio: '08:00', fim: '16:00' }, { guarnicaoId: biomaMod, inicio: '16:00', fim: '00:00' },
    ]);
    await definirMeta(d, [biomaMod]);
  });

  it('sem ninguém, cada função tem uma linha com uma vaga só (0–1440) e as opções trazem os três horários', async () => {
    const g = card(await ler(d), 'Bioma modelo');
    expect(g.funcoes[0]!.linhas).toHaveLength(1);
    expect(g.funcoes[0]!.linhas[0]).toHaveLength(1);
    expect(vagas(g)).toEqual([['Auxiliar', 0, 1440, ['Bioma 3 turnos 00:00–08:00', 'Bioma 3 turnos 08:00–16:00', 'Bioma 3 turnos 16:00–00:00']]]);
  });

  it('escalar alguém no 08h–16h deixa duas vagas na mesma linha, cada uma só com os vínculos que a tocam', async () => {
    const d2 = dia(601);
    await definirMeta(d2, [biomaMod]);
    await inserir(api.banco, 'alocacao', { militar_id: militares['MOT-A'], escala_id: escalaBioma, servico_id: bioma.id, turno_id: bioma.b, data: d2, guarnicao_id: biomaMod, funcao_id: auxiliar, origem: 'manual' });
    const g = card(await ler(d2), 'Bioma modelo');
    expect(g.funcoes[0]!.linhas).toHaveLength(1);
    expect(vagas(g)).toEqual([
      ['Auxiliar', 0, 480, ['Bioma 3 turnos 00:00–08:00']],
      ['Auxiliar', 960, 1440, ['Bioma 3 turnos 16:00–00:00']],
    ]);
    expect(resumo(g)).toEqual([['Auxiliar', 'MOT-A', 480, 960, 'BiomaT', false]]);
  });
});
describe('o militar que emenda os turnos A e B (Review Focus 3)', () => {
  const d = dia(7);
  beforeAll(async () => {
    await definirMeta(d, [salvamento]);
    await alocar('MOT-A', ordinario, pronto.id, pronto.a, d, salvamento, motorista);
    await alocar('MOT-A', ordinario, pronto.id, pronto.b, d, salvamento, motorista);
  });

  it('vira um trecho só, com as duas alocações, cada uma com o horário dela', async () => {
    const g = card(await ler(d), 'Salvamento');
    expect(g.ativada).toBe(true);
    expect(g.funcoes[0]!.linhas).toHaveLength(1);
    const t = g.funcoes[0]!.linhas[0]!;
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ inicio: 480, fim: 1920, opcoes: [] });
    expect(t[0]!.ocupante!.nomeGuerra).toBe('MOT-A');
    expect(t[0]!.ocupante!.alocacoes.map((a) => [a.inicio, a.fim])).toEqual([['08:00', '20:00'], ['20:00', '08:00']]);
  });
});

describe('vínculo cuja faixa não é mais turno da escala (Review Focus 2)', () => {
  const d = dia(8);
  let fantasma: string;
  beforeAll(async () => {
    fantasma = await criarModelo('Fantasma', [{ funcaoId: motorista, minimo: 1, maximo: 1 }]);
    const bioma = await servicoComTurnos('Bioma', 'diaria', '#5B8C3A', [['A', '08:00', '16:00']]);
    await criarEscala('Bioma', [bioma.id], [{ guarnicaoId: fantasma, inicio: '08:00', fim: '16:00' }]);
    // o turno foi editado depois do vínculo: a faixa 08–16 já não existe na escala
    await api.banco.query(`update turno set inicio = '00:00', fim = '08:00' where servico_id = $1`, [bioma.id]);
    await definirMeta(d, [fantasma]);
  });

  it('não gera horário, falta nem vaga', async () => {
    const g = card(await ler(d), 'Fantasma');
    expect(g).toMatchObject({ horarios: [], faltas: [], funcoes: [], ativada: false });
  });
});

describe('desativadas hoje (Review Focus 3 da 4.1)', () => {
  const d = dia(501);
  beforeAll(async () => {
    // a meta padrão vale do dia 500 em diante (o dia 400, do teste do painel vazio, não é afetado)
    expect((await api.pedir('admin', 'PUT', `${secao()}/meta-padrao`, { desde: dia(500), guarnicoes: [aco, resgate] })).status).toBe(200);
  });

  it('um dia que segue o padrão não tem desativadas; depois de desativar, a guarnição aparece nelas e o dia seguinte continua no padrão', async () => {
    expect((await ler(d)).desativadas).toEqual([]);
    expect((await api.pedir('escalante', 'POST', `${secao()}/meta-do-dia/${d}/desativar`, { guarnicaoId: aco })).status).toBe(200);
    const e = await ler(d);
    expect(e.desativadas).toEqual([{ guarnicaoId: aco, nome: 'ACO', viatura: null }]);
    expect(e.guarnicoes.map((g) => g.nome)).toEqual(['Resgate']);
    expect((await ler(dia(502))).desativadas).toEqual([]);
  });

  it('um dia com meta própria que ainda tem toda a meta padrão não tem desativadas, e a que sobrou da própria meta não entra', async () => {
    const outro = dia(503);
    expect((await api.pedir('admin', 'PUT', `${secao()}/meta-do-dia/${outro}`, { guarnicoes: [resgate, abt] })).status).toBe(200);
    // ACO está no padrão e fora do dia: desativada; ABT está no dia e fora do padrão: não é desativada
    expect((await ler(outro)).desativadas.map((x) => x.nome)).toEqual(['ACO']);
  });
});

describe('cotas restantes', () => {
  const d = dia(5);
  it('traz por serviço a soma das cotas do mês e das alocações já distribuídas', async () => {
    expect((await ler(d)).cotas).toEqual([]);
    const cota = await api.pedir('escalante', 'POST', `${secao()}/cotas`, { mes: d.slice(0, 7), servicoId: jes.id, quantidade: 40, prioridade: 1 });
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
    // bem longe do dia da cota (dia(5)), para nunca cair no mesmo mês dela
    expect(await ler(dia(400))).toEqual({ data: dia(400), meta: { origem: 'padrao', total: 0, ativadas: 0 }, guarnicoes: [], desativadas: [], cotas: [] });
  });
});
