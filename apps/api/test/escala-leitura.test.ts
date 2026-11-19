import { somarMeses, type EscalaDoMes, type FaixaDoDia } from 'contratos';
import { diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): escala Ordinário com Pronto A (08h–20h) e B (20h–08h); guarnições ABT (Motorista 1–1 CNH D,
// Combatente 2–3) e AR (Combatente 1–2) vinculadas às duas faixas.
let api: ApiDeTeste;
let escalaId: string;
let abt: string;
let ar: string;
let nova: string;
let motorista: string;
let combatente: string;
let pronto: { id: string; turnoA: string; turnoB: string };
let militar: string;
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const N = diasDoMes(atual).length;
const FAIXA_A = { inicio: '08:00', fim: '20:00' };
const FAIXA_B = { inicio: '20:00', fim: '08:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;

const criarGuarnicao = async (nome: string, composicao: unknown[]): Promise<string> => {
  const r = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: nome === 'ABT' ? 1 : null, ativa: true, composicao },
  });
  expect(r.status).toBe(201);
  return (await r.json()).id;
};
const ler = async (mes = atual, id = escalaId, quem: 'escalante' | 'semPapel' = 'escalante') => api.pedir(quem, 'GET', `/api/escalas/${id}/mes/${mes}`);
const escalaDoMes = async (mes = atual): Promise<EscalaDoMes> => (await ler(mes)).json();
const faixa = (e: EscalaDoMes, dia: number, f: { inicio: string; fim: string }): FaixaDoDia =>
  e.dias[dia - 1]!.faixas.find((x) => x.inicio === f.inicio && x.fim === f.fim)!;
const cardDe = (e: EscalaDoMes, dia: number, f: { inicio: string; fim: string }, nome: string) => faixa(e, dia, f).guarnicoes.find((g) => g.nome === nome);

beforeAll(async () => {
  api = await montarApi();
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  const servico = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  const turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.id}/turnos`, { letra: 'A', ...FAIXA_A })).json()).turnos[0].id;
  const comB = await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.id}/turnos`, { letra: 'B', ...FAIXA_B })).json();
  pronto = { id: servico.id, turnoA, turnoB: comB.turnos.find((t: { letra: string }) => t.letra === 'B').id };
  abt = await criarGuarnicao('ABT', [
    { funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' },
    { funcaoId: combatente, minimo: 2, maximo: 3, cnhExigida: null },
  ]);
  ar = await criarGuarnicao('AR', [{ funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }]);
  nova = await criarGuarnicao('Nova', [{ funcaoId: combatente, minimo: 1, maximo: 1, cnhExigida: null }]);
  escalaId = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.id] })).status).toBe(200);
  const itens = (...ids: string[]) => ids.flatMap((guarnicaoId) => [{ guarnicaoId, ...FAIXA_A }, { guarnicaoId, ...FAIXA_B }]);
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: itens(abt, ar) })).status).toBe(200);
  // a partir do mês seguinte, a escala passa a ter a guarnição Nova (e só ela e a ABT)
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${proximo}`, { itens: itens(abt, nova) })).status).toBe(200);
  const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-L', nome: 'Soldado L', ordem: 910 });
  militar = await inserir(api.banco, 'militar', { matricula: '990992-2', posto_grad_id: posto, nome_guerra: 'LEITURA' });
  await inserir(api.banco, 'feriado', { unidade_id: api.ids.secao, data: `${atual}-15`, descricao: 'Feriado de teste' });
});
afterAll(async () => {
  await api.fechar();
});

const alocar = (dia: number, turno: string, vaga: { guarnicao: string | null; funcao: string | null }) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar, escala_id: escalaId, servico_id: pronto.id, turno_id: turno, data: `${atual}-${String(dia).padStart(2, '0')}`,
    guarnicao_id: vaga.guarnicao, funcao_id: vaga.funcao, origem: 'manual',
  });

describe('leitura da escala do mês', () => {
  it('um dia por data do mês, com as duas faixas (a noturna marcada) e o feriado', async () => {
    const e = await escalaDoMes();
    expect(e).toMatchObject({ escalaId, nome: 'Ordinário', mes: atual });
    expect(e.dias).toHaveLength(N);
    expect(e.dias[0]!.data).toBe(`${atual}-01`);
    expect(e.dias[0]!.faixas.map((f) => [f.inicio, f.fim, f.noturna])).toEqual([['08:00', '20:00', false], ['20:00', '08:00', true]]);
    expect(e.dias[0]!.faixas[0]!.turnos).toEqual([{ turnoId: pronto.turnoA, servicoId: pronto.id, servico: 'Pronto', letra: 'A' }]);
    expect(e.dias[14]!.feriado).toBe('Feriado de teste');
    expect(e.dias[0]!.feriado).toBeNull();
  });

  it('sem alocações, o card diz o que falta e o resumo conta as vagas obrigatórias', async () => {
    const e = await escalaDoMes();
    const card = cardDe(e, 2, FAIXA_A, 'ABT')!;
    expect(card).toMatchObject({ completa: false, prioridade: 1 });
    expect(card.faltam).toEqual(['Falta 1 Motorista (CNH D)', 'Faltam 2 Combatente']);
    expect(card.funcoes.map((f) => [f.funcao, f.minimo, f.maximo, f.cnhExigida, f.ocupantes.length])).toEqual([['Motorista', 1, 1, 'D', 0], ['Combatente', 2, 3, null, 0]]);
    expect(e.dias[1]!.faixas[0]!.guarnicoes.map((g) => g.nome)).toEqual(['ABT', 'AR']);
    expect(e.resumo).toEqual({ preenchidas: 0, obrigatorias: N * 2 * (1 + 2 + 1), obrigatoriasVazias: N * 2 * (1 + 2 + 1) });
    expect(e.dias[1]!.obrigatoriasVazias).toBe(2 * (1 + 2 + 1));
  });

  it('o turno B que atravessa a meia-noite aparece só no dia em que começa', async () => {
    await alocar(3, pronto.turnoB, { guarnicao: abt, funcao: combatente });
    const e = await escalaDoMes();
    const noDia3 = cardDe(e, 3, FAIXA_B, 'ABT')!.funcoes.find((f) => f.funcao === 'Combatente')!;
    expect(noDia3.ocupantes).toEqual([
      expect.objectContaining({ militarId: militar, posto: 'SD-L', nomeGuerra: 'LEITURA', matricula: '990992-2', letra: 'B', servico: expect.objectContaining({ id: pronto.id, nome: 'Pronto' }) }),
    ]);
    expect(cardDe(e, 3, FAIXA_A, 'ABT')!.funcoes[1]!.ocupantes).toHaveLength(0);
    expect(cardDe(e, 4, FAIXA_B, 'ABT')!.funcoes[1]!.ocupantes).toHaveLength(0);
    expect(cardDe(e, 3, FAIXA_B, 'ABT')!.faltam).toEqual(['Falta 1 Motorista (CNH D)', 'Falta 1 Combatente']);
    expect(e.resumo.preenchidas).toBe(1);
  });

  it('alocação sem guarnição vai para "sem posto"', async () => {
    await alocar(5, pronto.turnoA, { guarnicao: null, funcao: null });
    const e = await escalaDoMes();
    expect(faixa(e, 5, FAIXA_A).semPosto.map((o) => o.nomeGuerra)).toEqual(['LEITURA']);
    expect(cardDe(e, 5, FAIXA_A, 'ABT')!.funcoes.every((f) => f.ocupantes.length === 0)).toBe(true);
  });

  it('guarnição desativada no mês seguinte aparece neste e some no seguinte', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/guarnicoes/${ar}/situacao`, { ativa: false, aPartirDe: proximo });
    expect(r.status).toBe(200);
    expect(cardDe(await escalaDoMes(atual), 1, FAIXA_A, 'AR')).toBeDefined();
    const seguinte = await escalaDoMes(proximo);
    expect(seguinte.dias[0]!.faixas[0]!.guarnicoes.map((g) => g.nome)).not.toContain('AR');
  });

  it('o vínculo que só vale a partir do mês seguinte não aparece neste', async () => {
    expect((await escalaDoMes(atual)).dias[0]!.faixas[0]!.guarnicoes.map((g) => g.nome)).not.toContain('Nova');
    expect((await escalaDoMes(proximo)).dias[0]!.faixas[0]!.guarnicoes.map((g) => g.nome)).toEqual(['ABT', 'Nova']);
  });

  it('escala de outra seção é 403 e mês inválido é 400', async () => {
    expect((await ler(atual, escalaId, 'semPapel')).status).toBe(403);
    const mal = await ler('2026-13');
    expect(mal.status).toBe(400);
    expect((await mal.json()).erro).toBe('Mês inválido: use o formato aaaa-mm.');
  });

  it('a ordem de escala define a ordem dos cards; sem ordem, vale a prioridade e o nome de sempre (Fase 4.2.1)', async () => {
    const nomes = async () => faixa(await escalaDoMes(), 3, FAIXA_A).guarnicoes.map((g) => g.nome);
    expect(await nomes()).toEqual(['ABT', 'AR']);
    // a AR passa na frente: a vez dela (Combatente 1) vem antes da vez do Motorista da ABT
    const g = await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/ordem/${atual}`, { itens: [{ guarnicaoId: ar, funcaoId: combatente, vaga: 1 }, { guarnicaoId: abt, funcaoId: motorista, vaga: 1 }] });
    expect(g.status).toBe(200);
    expect(await nomes()).toEqual(['AR', 'ABT']);
    // o mês seguinte herda a ordem, mas as guarnições são outras (ABT e Nova): a que não está na ordem vai depois
    const proximoMes = faixa(await escalaDoMes(proximo), 3, FAIXA_A).guarnicoes.map((x) => x.nome);
    expect(proximoMes).toEqual(['ABT', 'Nova']);
  });
});
