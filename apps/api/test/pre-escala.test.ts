import { somarMeses } from 'contratos';
import { diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { equipeDoDia1, planejarPreEscala } from '../src/escala/pre-escala.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir } from './banco-teste.ts';

// Cenário fictício (D7): seção com 4 equipes do ciclo, Pronto A (08h–20h) e B (20h–08h), guarnições ABT (Motorista CNH D 1–1,
// Combatente 1–2) e AR (Chefe 1–1) nas duas faixas, e a ordem Motorista ABT → Chefe AR → Combatente ABT 1 → Combatente ABT 2.
// ALFA: A1 (CNH B), A2 (CNH E) e A3, nesta antiguidade. BRAVO: 5 sem CNH D. CHARLIE: ninguém. DELTA: D1 e D2.
let api: ApiDeTeste;
let escala: string;
let escalaSoNoA: string;
let escalaSemPronto: string;
let pronto: string;
let turnoA: string;
let turnoB: string;
let abt: string;
let ar: string;
let motorista: string;
let combatente: string;
let chefe: string;
const equipe: Record<string, string> = {};
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const dia = (n: number) => `${mes}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;
const A = { inicio: '08:00', fim: '20:00' };
const B = { inicio: '20:00', fim: '08:00' };

let seq = 0;
async function criarMilitar(nome: string, daEquipe: string, antiguidade: number, cnh: string[] = []) {
  seq++;
  militar[nome] = await inserir(api.banco, 'militar', {
    matricula: `99${String(5000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, motorista: cnh.length > 0, cnh, voluntario_jes: false, ativo: true, antiguidade,
  });
  await inserir(api.banco, 'lotacao', { militar_id: militar[nome], unidade_id: api.ids.secao, equipe_id: equipe[daEquipe], jornada: 'pronto', desde: `${atual}-01` });
}
let posto: string;
const nomeDe = (id: string) => Object.entries(militar).find(([, v]) => v === id)![0];
const noTurno = (novas: { data: string; turnoId: string; militarId: string; guarnicaoId: string | null; funcaoId: string | null }[], d: number, turnoId: string) =>
  Object.fromEntries(novas.filter((x) => x.data === dia(d) && x.turnoId === turnoId).map((x) => [nomeDe(x.militarId), x]));

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-PE', nome: 'Soldado PE', ordem: 940 });
  for (const [i, nome] of ['Alfa', 'Bravo', 'Charlie', 'Delta'].entries()) equipe[nome] = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome, ordem_ciclo: i + 1 });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  chefe = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Chefe' });
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  pronto = s.id;
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'A', ...A })).json()).turnos[0].id;
  turnoB = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'B', ...B })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  const guarnicao = async (nome: string, prioridade: number, composicao: unknown[]) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade, ativa: true, composicao } })).json()).id as string;
  abt = await guarnicao('ABT', 1, [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }]);
  ar = await guarnicao('AR', 2, [{ funcaoId: chefe, minimo: 1, maximo: 1, cnhExigida: null }]);
  const novaEscala = async (nome: string, servicoIds: string[]) => {
    const id = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome })).json()).id as string;
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${id}/servicos`, { servicoIds })).status).toBe(200);
    return id;
  };
  escala = await novaEscala('Ordinário', [pronto]);
  escalaSoNoA = await novaEscala('Ordinário curto', [pronto]);
  escalaSemPronto = await novaEscala('Sem Pronto', []);
  const vinculos = (id: string, itens: unknown[]) => api.pedir('escalante', 'PUT', `/api/escalas/${id}/vinculos/${mes}`, { itens });
  expect((await vinculos(escala, [{ guarnicaoId: abt, ...A }, { guarnicaoId: abt, ...B }, { guarnicaoId: ar, ...A }, { guarnicaoId: ar, ...B }])).status).toBe(200);
  expect((await vinculos(escalaSoNoA, [{ guarnicaoId: abt, ...A }, { guarnicaoId: abt, ...B }, { guarnicaoId: ar, ...A }])).status).toBe(200);
  const ordem = [[abt, motorista, 1], [ar, chefe, 1], [abt, combatente, 1], [abt, combatente, 2]] as const;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/ordem/${mes}`, { itens: ordem.map(([guarnicaoId, funcaoId, vaga]) => ({ guarnicaoId, funcaoId, vaga })) })).status).toBe(200);
  await criarMilitar('A1', 'Alfa', 1, ['B']);
  await criarMilitar('A2', 'Alfa', 2, ['E']);
  await criarMilitar('A3', 'Alfa', 3);
  for (const [i, nome] of ['B1', 'B2', 'B3', 'B4', 'B5'].entries()) await criarMilitar(nome, 'Bravo', 10 + i);
  await criarMilitar('D1', 'Delta', 20);
  await criarMilitar('D2', 'Delta', 21);
});
afterAll(async () => {
  await api.fechar();
});

describe('a equipe do dia 1', () => {
  it('sem Pronto no mês anterior não dá para saber: sem equipe e com o motivo; a prévia pede a escolha (Review Focus 2)', async () => {
    expect(await equipeDoDia1(api.banco, api.ids.secao, mes)).toEqual({ equipeId: null, motivo: 'sem Pronto turno A no mês anterior' });
    const { previa, novas } = await planejarPreEscala(api.banco, escala, mes, null);
    expect(previa.equipeUsada).toBeNull();
    expect(previa.entram).toBe(0);
    expect(novas).toEqual([]);
    expect(previa.avisos).toContain('Escolha a equipe do dia 1.');
    expect(previa.equipes.map((e) => e.nome)).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta']);
  });

  it('com o Pronto A da BRAVO nos últimos dias do mês anterior, o dia 1 é da CHARLIE', async () => {
    const ultimo = diasDoMes(atual).at(-1)!;
    const quatroAntes = diasDoMes(atual).at(-5)!;
    for (const d of [ultimo, quatroAntes]) {
      await inserir(api.banco, 'alocacao', { militar_id: militar.B1, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: d, origem: 'manual' });
    }
    expect(await equipeDoDia1(api.banco, api.ids.secao, mes)).toEqual({ equipeId: equipe.Charlie, motivo: '' });
    const { previa } = await planejarPreEscala(api.banco, escala, mes, null);
    expect(previa.equipeDetectada).toEqual({ equipeId: equipe.Charlie, motivo: '' });
    expect(previa.equipeUsada).toEqual({ id: equipe.Charlie, nome: 'Charlie' });
  });

  it('uma equipe que não é do ciclo desta seção é recusada', async () => {
    await expect(planejarPreEscala(api.banco, escala, mes, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/equipe/i);
  });
});

describe('quem entra em cada vaga (equipe do dia 1 = ALFA: dias 1, 5, 9… ALFA; 2, 6… BRAVO; 3, 7… CHARLIE; 4, 8… DELTA)', () => {
  it('a ordem decide a vez, a CNH decide quem pode e a antiguidade decide entre os aptos (Review Focus 4)', async () => {
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    const a = noTurno(novas, 1, turnoA);
    // A2 tem a CNH E (serve para o Motorista); o mais antigo entre os outros (A1) fica com o Chefe AR e A3 com o Combatente 1
    expect(a.A2).toMatchObject({ guarnicaoId: abt, funcaoId: motorista });
    expect(a.A1).toMatchObject({ guarnicaoId: ar, funcaoId: chefe });
    expect(a.A3).toMatchObject({ guarnicaoId: abt, funcaoId: combatente });
    expect(Object.keys(a)).toHaveLength(3);
    // menos gente que vagas: sobra vazia a última da ordem, nas duas faixas
    expect(previa.vazias).toContainEqual({ data: dia(1), faixa: '08h–20h', vaga: 'Combatente ABT' });
    expect(previa.vazias).toContainEqual({ data: dia(1), faixa: '20h–08h', vaga: 'Combatente ABT' });
    expect(previa.entram).toBe(novas.length);
  });

  it('mais gente que vagas: sem ninguém com a CNH do Motorista, a vaga fica vazia e os dois mais novos ficam sem guarnição (Review Focus 5)', async () => {
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    const dois = noTurno(novas, 2, turnoA);
    expect(Object.keys(dois)).toHaveLength(5);
    expect(dois.B1).toMatchObject({ guarnicaoId: ar, funcaoId: chefe });
    expect(dois.B2).toMatchObject({ guarnicaoId: abt, funcaoId: combatente });
    expect(dois.B4).toMatchObject({ guarnicaoId: null, funcaoId: null });
    expect(dois.B5).toMatchObject({ guarnicaoId: null, funcaoId: null });
    expect(previa.vazias).toContainEqual({ data: dia(2), faixa: '08h–20h', vaga: 'Motorista ABT' });
    expect(previa.semGuarnicao.filter((x) => x.data === dia(2) && x.faixa === '08h–20h').map((x) => x.nomeGuerra)).toEqual(['B4', 'B5']);
  });

  it('o dia de uma equipe sem ninguém não gera nada, e a prévia avisa', async () => {
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    expect(novas.filter((x) => x.data === dia(3))).toEqual([]);
    expect(previa.avisos).toContain('A equipe Charlie não tem militares do Pronto na seção; nenhum serviço foi gerado para os dias dela.');
  });

  it('uma faixa só considera as guarnições vinculadas a ela (nesta escala a AR só existe no turno A: sem ordem cadastrada a ABT enche primeiro)', async () => {
    const { previa } = await planejarPreEscala(api.banco, escalaSoNoA, mes, equipe.Alfa!);
    const doDia1 = previa.vazias.filter((x) => x.data === dia(1));
    expect(doDia1).toContainEqual({ data: dia(1), faixa: '08h–20h', vaga: 'AR' });
    expect(doDia1.filter((x) => x.faixa === '20h–08h')).toEqual([]);
  });

  it('o afastado fica de fora só nos dias do afastamento; nos outros dias a equipe dele entra (Review Focus 3)', async () => {
    const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
    expect((await api.pedir('escalante', 'POST', `/api/militares/${militar.D2}/afastamentos`, { tipoAfastamentoId: tipo, inicio: dia(8), fim: dia(12) })).status).toBe(201);
    const { novas } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    expect(noTurno(novas, 4, turnoA)).toHaveProperty('D2');
    expect(noTurno(novas, 8, turnoA)).not.toHaveProperty('D2');
    expect(noTurno(novas, 8, turnoA)).toHaveProperty('D1');
    expect(noTurno(novas, 12, turnoA)).not.toHaveProperty('D2');
    expect(noTurno(novas, 16, turnoA)).toHaveProperty('D2');
  });

  it('uma escala sem o serviço Pronto não tem o que gerar, e a prévia avisa', async () => {
    const { novas, previa } = await planejarPreEscala(api.banco, escalaSemPronto, mes, equipe.Alfa!);
    expect(novas).toEqual([]);
    expect(previa.entram).toBe(0);
    expect(previa.avisos).toContain('Esta escala não tem o serviço Pronto: não há o que gerar.');
  });
});

describe('gerar de novo (Review Focus 1)', () => {
  it('quem já está escalado à mão não é mexido e a vaga dele não é usada de novo', async () => {
    await inserir(api.banco, 'alocacao', { militar_id: militar.A3, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: dia(1), guarnicao_id: abt, funcao_id: combatente, origem: 'manual' });
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    const a = noTurno(novas, 1, turnoA);
    expect(a).not.toHaveProperty('A3');
    expect(a.A2).toMatchObject({ guarnicaoId: abt, funcaoId: motorista });
    expect(a.A1).toMatchObject({ guarnicaoId: ar, funcaoId: chefe });
    expect(Object.values(a).some((x) => x.funcaoId === combatente)).toBe(false);
    expect(previa.vazias).toContainEqual({ data: dia(1), faixa: '08h–20h', vaga: 'Combatente ABT' });
    // no turno B do mesmo dia ninguém estava escalado: A3 entra normalmente
    expect(noTurno(novas, 1, turnoB)).toHaveProperty('A3');
  });

  it('a vaga ocupada à mão sai da lista mesmo sobrando gente: com o Combatente 1 da BRAVO ocupado, só um combatente é completado e o resto fica sem guarnição', async () => {
    await inserir(api.banco, 'alocacao', { militar_id: militar.B2, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: dia(2), guarnicao_id: abt, funcao_id: combatente, origem: 'manual' });
    const { novas } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    const dois = noTurno(novas, 2, turnoA);
    expect(dois).not.toHaveProperty('B2');
    expect(dois.B1).toMatchObject({ guarnicaoId: ar, funcaoId: chefe });
    expect(dois.B3).toMatchObject({ guarnicaoId: abt, funcaoId: combatente });
    expect(dois.B4).toMatchObject({ guarnicaoId: null, funcaoId: null });
    expect(dois.B5).toMatchObject({ guarnicaoId: null, funcaoId: null });
  });

  it('o removido não volta ao dia e turno de onde saiu, mas outro militar pode ocupar a vaga dele', async () => {
    await inserir(api.banco, 'remocao', { militar_id: militar.A1, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: dia(5) });
    const { novas, previa } = await planejarPreEscala(api.banco, escala, mes, equipe.Alfa!);
    const a = noTurno(novas, 5, turnoA);
    expect(a).not.toHaveProperty('A1');
    expect(a.A2).toMatchObject({ guarnicaoId: abt, funcaoId: motorista });
    expect(a.A3).toMatchObject({ guarnicaoId: ar, funcaoId: chefe });
    expect(noTurno(novas, 5, turnoB)).toHaveProperty('A1');
    expect(previa.removidosQueNaoVoltam).toBe(1);
  });
});
