import { somarMeses, type Candidatos } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { avaliarCandidatos, motivoDeFora } from '../src/escala/elegibilidade.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): seção com Pronto A/B (08h–20h, 20h–08h), "Madrugada" (06h–14h), JES (PJES, 09h–17h) e Bioma
// (diária, 08h–16h); militares 990993-x em situações diferentes.
let api: ApiDeTeste;
let escalaId: string;
let abt: string;
let combatente: string;
let motorista: string;
const turno: Record<string, string> = {};
const T = (k: string) => turno[k]!;
const servico: Record<string, string> = {};
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const dia = (n: number) => `${atual}-${String(n).padStart(2, '0')}`;
const D = dia(10);
const ontem = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
const FAIXA = { BIOMA_C: { inicio: '16:00', fim: '00:00' }, A: { inicio: '08:00', fim: '20:00' }, B: { inicio: '20:00', fim: '08:00' }, MADRUGADA: { inicio: '06:00', fim: '14:00' }, JES: { inicio: '09:00', fim: '17:00' }, BIOMA: { inicio: '08:00', fim: '16:00' } };
const secao = () => `/api/unidades/${api.ids.secao}`;
const vaga = (data: string, faixa: { inicio: string; fim: string }, comMotorista = false) => ({
  escalaId, data, ...faixa, guarnicaoId: abt, funcaoId: comMotorista ? motorista : combatente,
});
const nomes = (c: Candidatos) => c.aptos.map((a) => a.nomeGuerra).sort();
const motivo = (nome: string, data: string, faixa: { inicio: string; fim: string }, turnoId: string, comMotorista = false) =>
  motivoDeFora(api.banco, { ...vaga(data, faixa, comMotorista), militarId: militar[nome]!, turnoId });

async function criarServico(nome: string, tipo: string, letra: string, faixa: { inicio: string; fim: string }) {
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  const comTurno = await (await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra, ...faixa })).json();
  servico[nome] = s.id;
  turno[`${nome} ${letra}`] = comTurno.turnos.find((t: { letra: string }) => t.letra === letra).id;
}
let seq = 0;
async function criarMilitar(nome: string, extra: { cnh?: string[]; jes?: boolean; ativo?: boolean; desde?: string; jornada?: string; posto?: string } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `99${String(3000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: extra.posto, nome_guerra: nome,
    motorista: (extra.cnh ?? []).length > 0, cnh: extra.cnh ?? [], voluntario_jes: extra.jes ?? false, ativo: extra.ativo ?? true,
  });
  militar[nome] = id;
  await inserir(api.banco, 'lotacao', { militar_id: id, unidade_id: api.ids.secao, equipe_id: extra.jornada === 'adm' ? null : equipe, jornada: extra.jornada ?? 'pronto', desde: extra.desde ?? `${atual}-01` });
  return id;
}
let equipe: string;
const alocar = (nome: string, servicoNome: string, letra: string, data: string) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar[nome], escala_id: escalaId, servico_id: servico[servicoNome], turno_id: turno[`${servicoNome} ${letra}`], data, origem: 'manual',
  });
const amanha = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
const faixaMarcada = (nome: string, data: string, inicio: number, fim: number) =>
  inserir(api.banco, 'disponibilidade', { militar_id: militar[nome], data, inicio_min: inicio, fim_min: fim, origem: 'manual' });
// o que antes era o turno padrão A (08h às 20h) e B (20h às 08h) vira faixas: B = 20h às 24h do dia e 00h às 08h do dia seguinte
const voluntariar = async (nome: string, data: string, padrao: 'A' | 'B') => {
  if (padrao === 'A') await faixaMarcada(nome, data, 480, 1200);
  else {
    await faixaMarcada(nome, data, 1200, 1440);
    await faixaMarcada(nome, amanha(data), 0, 480);
  }
};

beforeAll(async () => {
  api = await montarApi();
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  await criarServico('Pronto', 'ordinario', 'A', FAIXA.A);
  turno['Pronto B'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.Pronto}/turnos`, { letra: 'B', ...FAIXA.B })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  await criarServico('Madrugada', 'ordinario', 'A', FAIXA.MADRUGADA);
  await criarServico('JES', 'pjes', 'A', FAIXA.JES);
  await criarServico('Bioma', 'diaria', 'A', FAIXA.BIOMA);
  turno['Bioma C'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.Bioma}/turnos`, { letra: 'C', ...FAIXA.BIOMA_C })).json()).turnos.find((t: { letra: string }) => t.letra === 'C').id;
  await criarServico('Saldo', 'ordinario', 'A', FAIXA.A);
  // PE Seguro: diária com turno A das 00h às 08h e B das 20h às 08h
  await criarServico('PE Seguro', 'diaria', 'A', { inicio: '00:00', fim: '08:00' });
  turno['PE Seguro B'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico['PE Seguro']}/turnos`, { letra: 'B', inicio: '20:00', fim: '08:00' })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  const g = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome: 'ABT', vigencia: atual,
    versao: { viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 2, maximo: 3, cnhExigida: null }] },
  });
  abt = (await g.json()).id;
  escalaId = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.Pronto, servico.Madrugada, servico.JES, servico.Bioma, servico.Saldo, servico['PE Seguro']] })).status).toBe(200);
  const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-C', nome: 'Soldado C', ordem: 920 });
  const p = { posto };
  await criarMilitar('APTO', p);
  await criarMilitar('AFASTADO', p);
  await criarMilitar('CNHB', { ...p, cnh: ['B'] });
  await criarMilitar('CNHE', { ...p, cnh: ['E'] });
  await criarMilitar('CHOQUE', p);
  await criarMilitar('VIRADA', p);
  await criarMilitar('FUTURO', { ...p, desde: `${proximo}-01` });
  await criarMilitar('JESVOL', { ...p, jes: true });
  await criarMilitar('JESSEM', { ...p, jes: true });
  await criarMilitar('NAOJES', p);
  await criarMilitar('INATIVO', { ...p, ativo: false });
  await criarMilitar('ADMIN', { ...p, jornada: 'adm' });
  await criarMilitar('DIARIAS', p);
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
  expect((await api.pedir('escalante', 'POST', `/api/militares/${militar.AFASTADO}/afastamentos`, { tipoAfastamentoId: tipo, inicio: dia(8), fim: dia(12) })).status).toBe(201);
  await alocar('CHOQUE', 'Pronto', 'B', ontem(D));
  await alocar('VIRADA', 'Pronto', 'B', ontem(dia(1)));
  await voluntariar('JESVOL', D, 'A');
  await voluntariar('NAOJES', D, 'A');
});
afterAll(async () => {
  await api.fechar();
});

describe('quem pode ocupar a vaga', () => {
  it('o apto vem com o serviço da faixa; os demais ficam fora com o motivo agrupado', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.A));
    expect(nomes(r)).toEqual(['APTO', 'CHOQUE', 'CNHB', 'CNHE', 'DIARIAS', 'JESSEM', 'JESVOL', 'NAOJES', 'VIRADA'].concat(['ADMIN']).sort());
    expect(r.aptos.find((a) => a.nomeGuerra === 'APTO')).toMatchObject({ matricula: expect.stringMatching(/^99\d{4}-\d$/), jornada: 'pronto', equipe: 'Alfa', servicos: [{ servicoId: servico.Pronto, turnoId: T('Pronto A'), nome: 'Pronto' }] });
    // quem só entra na seção no mês seguinte não pesa na contagem de "ficaram de fora"
    expect(r.fora).toEqual([{ motivo: 'Afastado', quantidade: 1 }, { motivo: 'Desativado', quantidade: 1 }]);
  });

  it('a CNH exigida vale pela hierarquia: B não basta para D, E basta', async () => {
    expect(await motivo('CNHB', D, FAIXA.A, T('Pronto A'), true)).toBe('Sem a CNH exigida');
    expect(await motivo('CNHE', D, FAIXA.A, T('Pronto A'), true)).toBeNull();
    expect(await motivo('CNHB', D, FAIXA.A, T('Pronto A'))).toBeNull();
  });

  it('o turno B do dia anterior (até as 08h) choca com uma vaga que começa às 06h', async () => {
    expect(await motivo('CHOQUE', D, FAIXA.MADRUGADA, T('Madrugada A'))).toBe('Choque de horário');
    expect(await motivo('APTO', D, FAIXA.MADRUGADA, T('Madrugada A'))).toBeNull();
    // emendar sem sobrepor não é choque: o B termina às 08h e o A começa às 08h
    expect(await motivo('CHOQUE', D, FAIXA.A, T('Pronto A'))).toBeNull();
  });

  it('na virada do mês, a alocação do último dia do mês anterior enxerga o dia 1', async () => {
    expect(await motivo('VIRADA', dia(1), FAIXA.MADRUGADA, T('Madrugada A'))).toBe('Choque de horário');
  });

  it('afastamento que cobre o dia barra; o do dia seguinte ao fim não', async () => {
    expect(await motivo('AFASTADO', D, FAIXA.A, T('Pronto A'))).toBe('Afastado');
    expect(await motivo('AFASTADO', dia(13), FAIXA.A, T('Pronto A'))).toBeNull();
    expect(await motivo('AFASTADO', dia(7), FAIXA.A, T('Pronto A'))).toBeNull();
  });

  it('lotado só a partir do mês seguinte: fora neste mês, apto no outro', async () => {
    expect(await motivo('FUTURO', D, FAIXA.A, T('Pronto A'))).toBe('Não está lotado na seção neste dia');
    expect(await motivo('FUTURO', `${proximo}-10`, FAIXA.A, T('Pronto A'))).toBeNull();
    expect(await motivo('INATIVO', D, FAIXA.A, T('Pronto A'))).toBe('Desativado');
  });

  it('JES: só voluntário JES, e com o voluntariado marcado para o horário', async () => {
    expect(await motivo('JESVOL', D, FAIXA.JES, T('JES A'))).toBeNull();
    expect(await motivo('JESSEM', D, FAIXA.JES, T('JES A'))).toBe('Não marcou voluntariado neste horário');
    expect(await motivo('NAOJES', D, FAIXA.JES, T('JES A'))).toBe('Não é voluntário JES');
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.JES));
    expect(nomes(r)).toEqual(['JESVOL']);
  });

  it('o voluntariado lançado à mão vale na hora para a lista, e lançar vazio tira (Fase 4.2)', async () => {
    const lancar = (faixas: { data: string; inicio: string; fim: string }[]) => api.pedir('escalante', 'PUT', `/api/militares/${militar.JESSEM}/voluntariado/${atual}`, { faixas });
    expect(await motivo('JESSEM', D, FAIXA.JES, T('JES A'))).toBe('Não marcou voluntariado neste horário');
    expect((await lancar([{ data: D, inicio: '08:00', fim: '20:00' }])).status).toBe(200);
    expect(await motivo('JESSEM', D, FAIXA.JES, T('JES A'))).toBeNull();
    expect((await lancar([])).status).toBe(200);
    expect(await motivo('JESSEM', D, FAIXA.JES, T('JES A'))).toBe('Não marcou voluntariado neste horário');
  });

  it('o expediente do Adm só choca com diária, e só em dia útil', async () => {
    const util = diasDoMes(atual).find((d) => d > dia(16) && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    const fim = diasDoMes(atual).find((d) => d > dia(16) && (diaDaSemana(d) === 0 || diaDaSemana(d) === 6))!;
    await voluntariar('ADMIN', util, 'A');
    await voluntariar('ADMIN', fim, 'A');
    expect(await motivo('ADMIN', util, FAIXA.BIOMA, T('Bioma A'))).toBe('Choque de horário');
    expect(await motivo('ADMIN', fim, FAIXA.BIOMA, T('Bioma A'))).toBeNull();
    // no Pronto o Adm entra como Saldo: o expediente não o barra
    expect(await motivo('ADMIN', util, FAIXA.A, T('Pronto A'))).toBeNull();
  });

  it('quem já está nesta faixa, neste dia, não aparece de novo', async () => {
    await alocar('APTO', 'Pronto', 'A', dia(20));
    expect(await motivo('APTO', dia(20), FAIXA.A, T('Pronto A'))).toBe('Já escalado neste horário');
    expect(nomes(await avaliarCandidatos(api.banco, vaga(dia(20), FAIXA.A)))).not.toContain('APTO');
  });

  it('a rota devolve os candidatos para o escalante, 403 para quem não tem papel e 400 para faixa que não existe', async () => {
    const q = `data=${D}&inicio=${FAIXA.A.inicio}&fim=${FAIXA.A.fim}&guarnicaoId=${abt}&funcaoId=${combatente}`;
    const ok = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?${q}`);
    expect(ok.status).toBe(200);
    expect(nomes(await ok.json())).toContain('APTO');
    expect((await api.pedir('semPapel', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?${q}`)).status).toBe(403);
    const sem = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${D}&inicio=01:00&fim=02:00`);
    expect(sem.status).toBe(400);
    expect((await sem.json()).erro).toBe('Esta faixa não existe nesta escala.');
  });
});

describe('regras do motor que a lista aplica: Saldo só para o Adm (RN-03) e uma diária por dia (RN-36)', () => {
  it('o Saldo é recusado para quem não é do Adm e aceito para o Adm', async () => {
    expect(await motivo('APTO', D, FAIXA.A, T('Saldo A'))).toBe('Saldo só para militar do Adm');
    expect(await motivo('ADMIN', D, FAIXA.A, T('Saldo A'))).toBeNull();
  });

  it('na lista, o Adm vem com o Saldo como primeiro serviço e o do Pronto só com o Pronto', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.A));
    expect(r.aptos.find((a) => a.nomeGuerra === 'ADMIN')!.servicos.map((s) => s.nome)).toEqual(['Saldo', 'Pronto']);
    expect(r.aptos.find((a) => a.nomeGuerra === 'APTO')!.servicos.map((s) => s.nome)).toEqual(['Pronto']);
  });

  it('o horário das faixas decide o voluntariado: quem só marcou 08h às 20h não cobre a diária das 16h às 00h (o defeito que motivou a mudança)', async () => {
    const d = dia(21);
    await faixaMarcada('DIARIAS', d, 480, 1200);
    expect(await motivo('DIARIAS', d, FAIXA.BIOMA_C, T('Bioma C'))).toBe('Não marcou voluntariado neste horário');
    await faixaMarcada('DIARIAS', d, 1200, 1440);
    expect(await motivo('DIARIAS', d, FAIXA.BIOMA_C, T('Bioma C'))).toBeNull();
  });

  it('um serviço das 00h às 08h do dia 1 é coberto pelo bloco 00–08 do próprio dia 1, sem depender do mês anterior (Review Focus 1)', async () => {
    const d = dia(1);
    await faixaMarcada('DIARIAS', d, 0, 480);
    // a madrugada das 00h às 08h é o turno A do PE Seguro (diária): pede voluntariado
    const madrugada = { inicio: '00:00', fim: '08:00' };
    expect(await motivo('DIARIAS', d, madrugada, T('PE Seguro A'))).toBeNull();
  });

  it('um turno de diária das 20h às 08h do último dia pede o 00–08 do dia 1 do mês seguinte (Review Focus 1)', async () => {
    const ultimo = dia(new Date(Date.UTC(Number(atual.slice(0, 4)), Number(atual.slice(5)), 0)).getUTCDate());
    await faixaMarcada('DIARIAS', ultimo, 1200, 1440);
    expect(await motivo('DIARIAS', ultimo, FAIXA.B, T('PE Seguro B'))).toBe('Não marcou voluntariado neste horário');
    await faixaMarcada('DIARIAS', amanha(ultimo), 0, 480);
    expect(await motivo('DIARIAS', ultimo, FAIXA.B, T('PE Seguro B'))).toBeNull();
  });

  it('duas diárias começando no mesmo dia: a segunda é recusada; em outro dia passa', async () => {
    const d = dia(18);
    await voluntariar('DIARIAS', d, 'A');
    await voluntariar('DIARIAS', d, 'B');
    expect(await motivo('DIARIAS', d, FAIXA.BIOMA_C, T('Bioma C'))).toBeNull();
    await alocar('DIARIAS', 'Bioma', 'A', d);
    expect(await motivo('DIARIAS', d, FAIXA.BIOMA_C, T('Bioma C'))).toBe('Já tem uma diária neste dia');
    await voluntariar('DIARIAS', dia(19), 'A');
    await voluntariar('DIARIAS', dia(19), 'B');
    expect(await motivo('DIARIAS', dia(19), FAIXA.BIOMA_C, T('Bioma C'))).toBeNull();
  });
});

