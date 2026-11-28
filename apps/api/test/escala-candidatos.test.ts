import { somarMeses, type Candidatos } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { avaliarCandidatos, motivoDeFora } from '../src/escala/elegibilidade.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): seção com Pronto A/B (08h–20h, 20h–08h), "Madrugada" (06h–14h), JES (PJES, 09h–17h) e Bioma
// (diária, 08h–16h) e o serviço Expediente (08h–16h, fora da escala: só a pré-escala o lança, 6.71); militares 990993-x em situações diferentes.
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
async function criarMilitar(nome: string, extra: { cnh?: string[]; jes?: boolean; ativo?: boolean; desde?: string; jornada?: string; posto?: string; foraDoQuadro?: boolean } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `99${String(3000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: extra.posto, nome_guerra: nome,
    motorista: !extra.foraDoQuadro && (extra.cnh ?? []).length > 0, cnh: extra.cnh ?? [], voluntario_jes: extra.jes ?? false,
  });
  militar[nome] = id;
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: extra.jornada === 'adm' ? null : equipe, jornada: extra.jornada ?? 'pronto', desde: extra.desde ?? `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, extra.ativo === false ? 'Desativado' : 'Ativa') });
  return id;
}
let equipe: string;
const alocar = (nome: string, servicoNome: string, letra: string, data: string) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar[nome], escala_id: escalaId, servico_id: servico[servicoNome], turno_id: turno[`${servicoNome} ${letra}`], data, origem: 'manual',
  });
// 6.71: o expediente do Adm é só o serviço Expediente lançado pela pré-escala (sem escala)
const lancarExpediente = (nome: string, data: string) =>
  inserir(api.banco, 'alocacao', { militar_id: militar[nome], escala_id: null, servico_id: servico.Expediente, turno_id: turno['Expediente A'], data, origem: 'pre_escala' });
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
  turno['JES B'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.JES}/turnos`, { letra: 'B', inicio: '17:00', fim: '21:00' })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  turno['Bioma C'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.Bioma}/turnos`, { letra: 'C', ...FAIXA.BIOMA_C })).json()).turnos.find((t: { letra: string }) => t.letra === 'C').id;
  await criarServico('Saldo', 'ordinario', 'A', FAIXA.A);
  await criarServico('Expediente', 'ordinario', 'A', FAIXA.BIOMA);
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
  await criarMilitar('ADMJES', { ...p, jornada: 'adm', jes: true });
  await criarMilitar('DIARIAS', p);
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
  expect((await api.pedir('gestorGb', 'POST', `/api/militares/${militar.AFASTADO}/afastamentos`, { tipoAfastamentoId: tipo, inicio: dia(8), fim: dia(12) })).status).toBe(201);
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
    // 6.71: sem o expediente lançado, o Adm também é apto (não há mais expediente calculado)
    expect(nomes(r)).toEqual(['ADMIN', 'ADMJES', 'APTO', 'CHOQUE', 'CNHB', 'CNHE', 'DIARIAS', 'JESSEM', 'JESVOL', 'NAOJES', 'VIRADA'].sort());
    expect(r.aptos.find((a) => a.nomeGuerra === 'APTO')).toMatchObject({ matricula: expect.stringMatching(/^99\d{4}-\d$/), jornada: 'pronto', equipe: 'Alfa', servicos: [{ servicoId: servico.Pronto, turnoId: T('Pronto A'), nome: 'Pronto' }] });
    // quem só entra na seção no mês seguinte não pesa na contagem de "ficaram de fora"
    expect(r.fora).toEqual([{ motivo: 'Afastado', quantidade: 1 }, { motivo: 'Desativado', quantidade: 1 }]);
    // 6.38: quem só não pode porque choca aparece à parte, com o que choca; sem expediente lançado, ninguém está em choque aqui
    expect(r.emChoque.map((e) => e.nomeGuerra).sort()).toEqual([]);
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

  it('6.37 e 6.71: o expediente lançado do Adm choca com qualquer serviço (Diária, Pronto, JES); o dia sem expediente lançado, útil ou não, não choca', async () => {
    const util = diasDoMes(atual).find((d) => d > dia(16) && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    const semLancado = diasDoMes(atual).find((d) => d > util && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    const fim = diasDoMes(atual).find((d) => d > dia(16) && (diaDaSemana(d) === 0 || diaDaSemana(d) === 6))!;
    for (const d of [util, semLancado, fim]) await voluntariar('ADMIN', d, 'A');
    await faixaMarcada('ADMJES', util, 1020, 1260);
    await faixaMarcada('ADMJES', semLancado, 540, 1020);
    await voluntariar('ADMJES', fim, 'A');
    await lancarExpediente('ADMIN', util);
    await lancarExpediente('ADMJES', util);
    // a faixa da Madrugada (06h às 14h) pega o expediente (08h às 16h) sem ser o mesmo horário (o mesmo horário seria "Já escalado")
    expect(await motivo('ADMIN', util, FAIXA.MADRUGADA, T('Madrugada A'))).toBe('De expediente neste dia');
    // um dia útil sem o expediente lançado e um fim de semana: nada choca com expediente
    expect(await motivo('ADMIN', semLancado, FAIXA.MADRUGADA, T('Madrugada A'))).toBeNull();
    expect(await motivo('ADMIN', fim, FAIXA.MADRUGADA, T('Madrugada A'))).toBeNull();
    // o Pronto e o JES também esbarram no expediente lançado
    expect(await motivo('ADMIN', util, FAIXA.A, T('Pronto A'))).toBe('De expediente neste dia');
    expect(await motivo('ADMJES', util, FAIXA.JES, T('JES A'))).toBe('De expediente neste dia');
    expect(await motivo('ADMJES', semLancado, FAIXA.JES, T('JES A'))).toBeNull();
    expect(await motivo('ADMJES', fim, FAIXA.JES, T('JES A'))).toBeNull();
    // o JES depois das 16h (sem tocar o expediente) passa: o horário é que decide
    expect(await motivo('ADMJES', util, { inicio: '17:00', fim: '21:00' }, T('JES B'))).toBeNull();
  });

  it('6.37: o Saldo, que pode tirar do expediente, continua sendo choque com o expediente lançado (a resolução vem na 6.38)', async () => {
    const util = diasDoMes(atual).find((d) => d > dia(22) && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    expect(await motivo('ADMIN', util, FAIXA.A, T('Saldo A'))).toBeNull();
    await lancarExpediente('ADMIN', util);
    expect(await motivo('ADMIN', util, FAIXA.A, T('Saldo A'))).toBe('De expediente neste dia');
  });

  it('6.37 (Review Focus 2): um Saldo já gravado: o JES depois dele choca com o Saldo (sem expediente lançado no dia)', async () => {
    const util = diasDoMes(atual).find((d) => d > dia(22) && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    await alocar('ADMJES', 'Saldo', 'A', util);
    // o JES das 09h às 17h choca com o Saldo (08h às 20h)
    expect(await motivo('ADMJES', util, FAIXA.JES, T('JES A'))).toBe('Choque de horário');
    // o JES das 17h às 21h também choca com o Saldo (até as 20h)
    expect(await motivo('ADMJES', util, { inicio: '17:00', fim: '21:00' }, T('JES B'))).toBe('Choque de horário');
  });

  it('6.37 (Review Focus 1): gravar o Adm num JES no horário do expediente lançado é 409 com o motivo, e nada é gravado; o do fim de semana passa', async () => {
    const util = diasDoMes(atual).find((d) => d > dia(24) && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    const fim = diasDoMes(atual).find((d) => d > dia(24) && (diaDaSemana(d) === 0 || diaDaSemana(d) === 6))!;
    await lancarExpediente('ADMJES', util);
    const pedir = (data: string) => api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: militar.ADMJES, data, turnoId: T('JES A'), guarnicaoId: null, funcaoId: null });
    const barrado = await pedir(util);
    expect(barrado.status).toBe(409);
    expect((await barrado.json()).erro).toBe('De expediente neste dia');
    expect((await api.banco.query('select 1 from alocacao where militar_id = $1 and data = $2::date and escala_id is not null', [militar.ADMJES, util])).rows).toHaveLength(0);
    expect((await pedir(fim)).status).toBe(201);
  });

  it('quem já está nesta faixa, neste dia, não aparece de novo', async () => {
    // já está numa vaga (com guarnição) neste horário; quem está no turno sem guarnição é movido para a vaga (6.40) e tem teste próprio
    await inserir(api.banco, 'alocacao', { militar_id: militar.APTO, escala_id: escalaId, servico_id: servico.Pronto, turno_id: turno['Pronto A'], data: dia(20), guarnicao_id: abt, funcao_id: motorista, origem: 'manual' });
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
  it('o Saldo é recusado para quem não é do Adm e, para o Adm, no fim de semana (sem expediente) é aceito', async () => {
    const fim = diasDoMes(atual).find((d) => d > dia(16) && (diaDaSemana(d) === 0 || diaDaSemana(d) === 6))!;
    expect(await motivo('APTO', D, FAIXA.A, T('Saldo A'))).toBe('Saldo só para militar do ADM');
    expect(await motivo('ADMIN', fim, FAIXA.A, T('Saldo A'))).toBeNull();
  });

  it('na lista, o Adm vem com os serviços na ordem de escala do cadastro (Pronto, Saldo) e o do Pronto só com o Pronto (6.71: o Saldo não vem mais primeiro)', async () => {
    const fim = diasDoMes(atual).find((d) => d > dia(16) && (diaDaSemana(d) === 0 || diaDaSemana(d) === 6))!;
    const r = await avaliarCandidatos(api.banco, vaga(fim, FAIXA.A));
    expect(r.aptos.find((a) => a.nomeGuerra === 'ADMIN')!.servicos.map((s) => s.nome)).toEqual(['Pronto', 'Saldo']);
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

describe('quem ficou de fora só por falta de voluntariado (o escalante pode combinar direto com o militar)', () => {
  const SEM_VOLUNTARIADO = 'Não marcou voluntariado neste horário';

  it('vem em semVoluntariado, com o serviço do turno, e continua contado em "ficaram de fora"', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.JES));
    // ADMJES (voluntário JES e do Adm) também não marcou o dia: sem expediente calculado (6.71), ele é candidato como qualquer um
    expect(r.semVoluntariado.map((c) => c.nomeGuerra).sort()).toEqual(['ADMJES', 'JESSEM']);
    expect(r.semVoluntariado.find((c) => c.nomeGuerra === 'JESSEM')).toMatchObject({ servicos: [{ servicoId: servico.JES, turnoId: T('JES A'), nome: 'JES' }] });
    expect(nomes(r)).toEqual(['JESVOL']);
    expect(r.fora).toContainEqual({ motivo: SEM_VOLUNTARIADO, quantidade: 2 });
  });

  it('quem não é voluntário JES numa vaga de PJES não vem, mesmo sem ter marcado nada', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.JES));
    expect(r.semVoluntariado.map((c) => c.nomeGuerra)).not.toContain('NAOJES');
    expect(await motivo('NAOJES', D, FAIXA.JES, T('JES A'))).toBe('Não é voluntário JES');
  });

  it('quem não marcou e também tem choque de horário fica de fora de vez (Review Focus 3)', async () => {
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD-C'")).rows[0]!.id;
    await criarMilitar('SEMCHOQUE', { posto, jes: true });
    await alocar('SEMCHOQUE', 'Madrugada', 'A', dia(24));
    expect(await motivo('SEMCHOQUE', dia(24), FAIXA.JES, T('JES A'))).toBe('Choque de horário');
    const r = await avaliarCandidatos(api.banco, vaga(dia(24), FAIXA.JES));
    expect(r.semVoluntariado.map((c) => c.nomeGuerra)).not.toContain('SEMCHOQUE');
    expect(nomes(r)).not.toContain('SEMCHOQUE');
  });

  it('a rota devolve semVoluntariado junto dos aptos', async () => {
    const q = `data=${D}&inicio=${FAIXA.JES.inicio}&fim=${FAIXA.JES.fim}&guarnicaoId=${abt}&funcaoId=${combatente}`;
    const corpo = await (await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?${q}`)).json();
    const sem = corpo.semVoluntariado.map((c: { nomeGuerra: string }) => c.nomeGuerra);
    expect(sem).toContain('JESSEM');
    expect(sem).not.toContain('JESVOL');
    expect(sem).not.toContain('NAOJES');
  });
});

describe('militar fora do quadro de motoristas, com CNH D (Review Focus 2)', () => {
  it('não vale para a vaga de motorista: "Fora do quadro de motoristas" (tem a carteira, falta o quadro); para a de combatente, que não exige CNH, segue apto', async () => {
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD-C'")).rows[0]!.id;
    await criarMilitar('FORAQUADRO', { posto, cnh: ['D'], foraDoQuadro: true });
    await criarMilitar('NOQUADRO', { posto, cnh: ['D'] });
    expect(await motivo('FORAQUADRO', D, FAIXA.A, T('Pronto A'), true)).toBe('Fora do quadro de motoristas');
    expect(await motivo('NOQUADRO', D, FAIXA.A, T('Pronto A'), true)).toBeNull();
    expect(await motivo('FORAQUADRO', D, FAIXA.A, T('Pronto A'))).toBeNull();
    // a lista de quem pode ocupar a vaga de motorista também deixa o militar de fora, com o motivo
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.A, true));
    expect(r.aptos.map((c) => c.nomeGuerra)).toContain('NOQUADRO');
    expect(r.aptos.map((c) => c.nomeGuerra)).not.toContain('FORAQUADRO');
  });
});

describe('o militar externo como candidato (6.33)', () => {
  let outraSecao: string;
  let outraEscala: string;
  const externo: Record<string, string> = {};
  const idsDosExternos = () => Object.values(externo);
  let seqExt = 0;
  /** Um militar da 2ª SB, trazido para a escala da 1ª SB pelo vínculo (desde o dia 1 do mês; `ate` fecha o vínculo). */
  async function criarExterno(nome: string, extra: { jes?: boolean; ate?: string | null } = {}) {
    seqExt++;
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD-C'")).rows[0]!.id;
    const id = await inserir(api.banco, 'militar', { matricula: `99${String(5000 + seqExt).padStart(4, '0')}-${seqExt % 10}`, posto_grad_id: posto, nome_guerra: nome, voluntario_jes: extra.jes ?? false });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: outraSecao, jornada: 'pronto', desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
    await api.banco.query('insert into vinculo_externo (militar_id, unidade_id, desde, ate) values ($1, $2, $3::date, $4::date)', [id, api.ids.secao, `${atual}-01`, extra.ate ?? null]);
    externo[nome] = id;
    return id;
  }
  const motivoExt = (nome: string, data: string, faixa: { inicio: string; fim: string }, turnoId: string) =>
    motivoDeFora(api.banco, { ...vaga(data, faixa), militarId: externo[nome]!, turnoId });

  beforeAll(async () => {
    outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
    await criarExterno('EXTJES', { jes: true });
    await criarExterno('EXTNAO', { jes: false });
    await criarExterno('EXTCHOQUE', { jes: true });
    await criarExterno('EXTSAIU', { jes: true, ate: dia(9) });
    // a 2ª SB tem a escala dela, com o Pronto (08h às 20h): é onde o EXTCHOQUE tem serviço no dia 10
    outraEscala = (await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/escalas`, { nome: 'Ordinário 2ª SB' })).json()).id;
    const s = (await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
    const turnoDela = (await (await api.pedir('admin', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'A', ...FAIXA.A })).json()).turnos[0].id;
    await api.pedir('admin', 'PUT', `/api/escalas/${outraEscala}/servicos`, { servicoIds: [s.id] });
    await inserir(api.banco, 'alocacao', { militar_id: externo.EXTCHOQUE, escala_id: outraEscala, servico_id: s.id, turno_id: turnoDela, data: D, origem: 'manual' });
  });

  it('o externo vigente aparece na vaga de JES, elegível sem voluntariado marcado, com a equipe "Externo"; quem não é voluntário JES fica de fora', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.JES));
    expect(nomes(r)).toEqual(expect.arrayContaining(['EXTJES', 'JESVOL']));
    expect(r.aptos.find((a) => a.nomeGuerra === 'EXTJES')).toMatchObject({ equipe: 'Externo', jornada: 'pronto' });
    expect(nomes(r)).not.toContain('EXTNAO');
    expect(await motivoExt('EXTNAO', D, FAIXA.JES, T('JES A'))).toBe('Não é voluntário JES');
    expect(await motivoExt('EXTJES', D, FAIXA.JES, T('JES A'))).toBeNull();
  });

  it('na vaga de Diária, o externo também é apto sem voluntariado marcado', async () => {
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.BIOMA));
    expect(nomes(r)).toEqual(expect.arrayContaining(['EXTJES', 'EXTNAO']));
    expect(await motivoExt('EXTNAO', D, FAIXA.BIOMA, T('Bioma A'))).toBeNull();
  });

  it('6.36: no Pronto o externo também é candidato, com as regras de todos; no Saldo vale a regra do Adm', async () => {
    expect(await motivoExt('EXTJES', D, FAIXA.A, T('Pronto A'))).toBeNull();
    expect(await motivoExt('EXTNAO', D, FAIXA.A, T('Pronto A'))).toBeNull();
    expect(await motivoExt('EXTJES', D, FAIXA.A, T('Saldo A'))).toBe('Saldo só para militar do ADM');
    const r = await avaliarCandidatos(api.banco, vaga(D, FAIXA.A));
    expect(nomes(r)).toEqual(expect.arrayContaining(['EXTJES', 'EXTNAO']));
    expect(r.fora.map((f) => f.motivo)).not.toContain('Externo só em serviço extra');
  });

  it('Review Focus 1: o serviço do externo na própria unidade conta: no mesmo horário ou por cima dele é choque, mesmo noutra seção', async () => {
    // o EXTCHOQUE está no Pronto da 2ª SB, das 08h às 20h do dia 10; o JES daqui é das 09h às 17h: choca
    expect(await motivoExt('EXTCHOQUE', D, FAIXA.JES, T('JES A'))).toBe('Choque de horário');
    // e na mesma faixa (08h às 20h) é "já escalado neste horário"
    expect(await motivoExt('EXTCHOQUE', D, FAIXA.A, T('Pronto A'))).toBe('Já escalado neste horário');
    // em outro dia ele está livre
    expect(await motivoExt('EXTCHOQUE', dia(12), FAIXA.JES, T('JES A'))).toBeNull();
  });

  it('Review Focus 3: o vínculo tirado no meio do mês: antes da saída ele é candidato; depois, "Não está lotado na seção neste dia"', async () => {
    expect(await motivoExt('EXTSAIU', dia(9), FAIXA.JES, T('JES A'))).toBeNull();
    expect(await motivoExt('EXTSAIU', dia(11), FAIXA.JES, T('JES A'))).toBe('Não está lotado na seção neste dia');
    expect(nomes(await avaliarCandidatos(api.banco, vaga(dia(11), FAIXA.JES)))).not.toContain('EXTSAIU');
  });

  it('escalar o externo à mão: num JES e no Pronto passa (201), no Saldo de quem não é do Adm é 409 com o motivo; tirar o vínculo depois não apaga o lançamento', async () => {
    const ok = await api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: externo.EXTJES, data: dia(15), turnoId: T('JES A'), guarnicaoId: null, funcaoId: null });
    expect(ok.status).toBe(201);
    // 6.36: no Pronto, à mão, também passa (a escala dele na unidade de origem e o voluntariado não entram)
    const pronto = await api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: externo.EXTJES, data: dia(16), turnoId: T('Pronto A'), guarnicaoId: null, funcaoId: null });
    expect(pronto.status).toBe(201);
    const saldo = await api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: externo.EXTJES, data: dia(17), turnoId: T('Saldo A'), guarnicaoId: null, funcaoId: null });
    expect(saldo.status).toBe(409);
    expect((await saldo.json()).erro).toBe('Saldo só para militar do ADM');
    const vinculo = (await api.banco.query<{ id: string }>('select id from vinculo_externo where militar_id = $1', [externo.EXTJES])).rows[0]!.id;
    expect((await api.pedir('admin', 'DELETE', `/api/unidades/${api.ids.secao}/externos/${vinculo}`)).status).toBe(204);
    expect((await api.banco.query('select 1 from alocacao where militar_id = $1 and data = $2::date', [externo.EXTJES, dia(15)])).rows).toHaveLength(1);
  });

  it('6.37: o choque olha todas as unidades, também para quem é da unidade: o serviço de outra seção no mesmo horário é "Já escalado", e sobreposto é choque', async () => {
    const multi = await criarMilitar('MULTI', { jes: true, posto: (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD-C'")).rows[0]!.id });
    const sPronto = (await api.banco.query<{ id: string }>('select id from servico where unidade_id = $1 and nome = $2', [outraSecao, 'Pronto'])).rows[0]!.id;
    const tPronto = (await api.banco.query<{ id: string }>('select id from turno where servico_id = $1', [sPronto])).rows[0]!.id;
    await inserir(api.banco, 'alocacao', { militar_id: multi, escala_id: outraEscala, servico_id: sPronto, turno_id: tPronto, data: dia(12), origem: 'manual' });
    // o Pronto da 2ª SB (08h às 20h) no dia 12: o Pronto daqui no mesmo horário é "Já escalado", e o JES das 09h às 17h é choque
    expect(await motivo('MULTI', dia(12), FAIXA.A, T('Pronto A'))).toBe('Já escalado neste horário');
    expect(await motivo('MULTI', dia(12), FAIXA.JES, T('JES A'))).toBe('Choque de horário');
    expect(nomes(await avaliarCandidatos(api.banco, vaga(dia(12), FAIXA.A)))).not.toContain('MULTI');
    // em outro dia ele está livre
    expect(await motivo('MULTI', dia(13), FAIXA.A, T('Pronto A'))).toBeNull();
  });

  it('Review Focus 2: a pré-escala do Pronto nunca põe um externo, mesmo com o vínculo vigente e o voluntariado marcado', async () => {
    // o JES marcado para os externos, e o vínculo da ABT à faixa do dia: a pré-escala tem o que planejar
    await api.banco.query('update vinculo_externo set ate = null where militar_id = any($1) and ate is not null', [[externo.EXTJES!]]);
    await inserir(api.banco, 'disponibilidade', { militar_id: externo.EXTNAO, data: D, inicio_min: 480, fim_min: 1200, origem: 'manual' });
    const itens = [{ guarnicaoId: abt, ...FAIXA.A }, { guarnicaoId: abt, ...FAIXA.B }];
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens })).status).toBe(200);
    const { planejarPreEscala } = await import('../src/escala/pre-escala.ts');
    const plano = await planejarPreEscala(api.banco, escalaId, atual, equipe);
    expect(plano.novas.length).toBeGreaterThan(0);
    expect(plano.novas.filter((n) => idsDosExternos().includes(n.militarId))).toEqual([]);
  });
});
