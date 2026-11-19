import type { EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): escala Ordinário com Pronto A/B e a guarnição ABT (Motorista 1–1 CNH D, Combatente 1–2).
let api: ApiDeTeste;
let escalaId: string;
let abt: string;
let outra: string;
let motorista: string;
let combatente: string;
let pronto: string;
let turnoA: string;
let turnoB: string;
let turnoJes: string;
let jes: string;
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const dia = (n: number) => `${atual}-${String(n).padStart(2, '0')}`;
const FAIXA_A = { inicio: '08:00', fim: '20:00' };
const FAIXA_B = { inicio: '20:00', fim: '08:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;
const escalar = (nome: string, data: string, extra: Record<string, unknown> = {}, quem: 'escalante' | 'semPapel' = 'escalante') =>
  api.pedir(quem, 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: militar[nome], data, turnoId: turnoA, guarnicaoId: abt, funcaoId: combatente, ...extra });
const ocupantes = (e: EscalaDoMes, d: number, funcao: string, faixa = FAIXA_A) =>
  e.dias[d - 1]!.faixas.find((f) => f.inicio === faixa.inicio)!.guarnicoes.find((g) => g.nome === 'ABT')!.funcoes.find((f) => f.funcao === funcao)!.ocupantes.map((o) => o.nomeGuerra);
const faixaA = (e: EscalaDoMes, d: number) => e.dias[d - 1]!.faixas.find((f) => f.inicio === FAIXA_A.inicio)!;
const alocacoes = async (nome: string) => (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1', [militar[nome]])).rows;

let seq = 0;
async function criarMilitar(nome: string, cnh: string[] = [], voluntarioJes = false) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `99${String(4000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, motorista: cnh.length > 0, cnh, voluntario_jes: voluntarioJes,
  });
  militar[nome] = id;
  await inserir(api.banco, 'lotacao', { militar_id: id, unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${atual}-01` });
}
let posto: string;
let equipe: string;

beforeAll(async () => {
  api = await montarApi();
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-A', nome: 'Soldado A', ordem: 930 });
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  pronto = s.id;
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'A', ...FAIXA_A })).json()).turnos[0].id;
  turnoB = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'B', ...FAIXA_B })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  const guarnicao = async (nome: string, composicao: unknown[]) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: nome === 'ABT' ? 1 : 2, ativa: true, composicao } })).json()).id as string;
  abt = await guarnicao('ABT', [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }]);
  outra = await guarnicao('Outra', [{ funcaoId: combatente, minimo: 1, maximo: 1, cnhExigida: null }]);
  escalaId = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  // um PJES na mesma faixa do dia: pede voluntariado e o atributo "voluntário JES"
  jes = ((await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'JES', tipo: 'pjes', operacao: null, rotuloImpressao: null, cor: '#6E56A8' })).json()) as { id: string }).id;
  turnoJes = (await (await api.pedir('escalante', 'POST', `/api/servicos/${jes}/turnos`, { letra: 'A', ...FAIXA_A })).json()).turnos[0].id;
  await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [pronto, jes] });
  // a ABT está nas duas faixas; a Outra só na do dia
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, ...FAIXA_A }, { guarnicaoId: abt, ...FAIXA_B }, { guarnicaoId: outra, ...FAIXA_A }] })).status).toBe(200);
  for (const nome of ['UM', 'DOIS', 'TRES', 'QUATRO', 'REMOVIDO', 'VOLTA']) await criarMilitar(nome);
  await criarMilitar('CNHB', ['B']);
  await criarMilitar('CNHD', ['D']);
  await criarMilitar('AFASTADO');
  await criarMilitar('JESSEM', [], true);
  await criarMilitar('NAOJES');
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
  await api.pedir('escalante', 'POST', `/api/militares/${militar.AFASTADO}/afastamentos`, { tipoAfastamentoId: tipo, inicio: dia(1), fim: dia(28) });
});
afterAll(async () => {
  await api.fechar();
});

describe('escalar quem não marcou voluntariado', () => {
  it('o escalante pode: quem é voluntário JES e não marcou o horário é escalado no PJES (201), com o serviço certo', async () => {
    const r = await escalar('JESSEM', dia(26), { turnoId: turnoJes });
    expect(r.status).toBe(201);
    const linha = (await api.banco.query<{ servico_id: string }>('select servico_id from alocacao where militar_id = $1', [militar.JESSEM])).rows;
    expect(linha).toEqual([{ servico_id: jes }]);
  });

  it('as outras regras continuam: quem não é voluntário JES é recusado no PJES (409) e nada é gravado', async () => {
    const r = await escalar('NAOJES', dia(26), { turnoId: turnoJes });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Não é voluntário JES');
    expect(await alocacoes('NAOJES')).toEqual([]);
  });
});

describe('escalar', () => {
  it('escalar um apto grava e devolve a escala do mês com ele na vaga', async () => {
    const r = await escalar('UM', dia(10));
    expect(r.status).toBe(201);
    const e: EscalaDoMes = await r.json();
    expect(e.mes).toBe(atual);
    expect(ocupantes(e, 10, 'Combatente')).toEqual(['UM']);
    const linha = (await api.banco.query<{ origem: string; servico_id: string }>('select origem, servico_id from alocacao where militar_id = $1', [militar.UM])).rows;
    expect(linha).toEqual([{ origem: 'manual', servico_id: pronto }]);
  });

  it('o mesmo pedido duas vezes: o segundo é 409 e nada é gravado de novo (nunca 500)', async () => {
    expect((await escalar('DOIS', dia(11))).status).toBe(201);
    const segundo = await escalar('DOIS', dia(11));
    expect(segundo.status).toBe(409);
    expect((await segundo.json()).erro).toBe('Este militar já está escalado neste turno.');
    expect(await alocacoes('DOIS')).toHaveLength(1);
  });

  it('a função não passa do máximo: o terceiro para uma função de máximo 2 é 409', async () => {
    expect((await escalar('UM', dia(12))).status).toBe(201);
    expect((await escalar('DOIS', dia(12))).status).toBe(201);
    const terceiro = await escalar('TRES', dia(12));
    expect(terceiro.status).toBe(409);
    expect((await terceiro.json()).erro).toBe('A função Combatente já está completa nesta guarnição.');
    expect(await alocacoes('TRES')).toHaveLength(0);
  });

  it('quem não pode ocupar a vaga recebe a frase do motivo: afastado, sem a CNH exigida', async () => {
    const afastado = await escalar('AFASTADO', dia(13));
    expect(afastado.status).toBe(409);
    expect((await afastado.json()).erro).toBe('Afastado');
    const semCnh = await escalar('CNHB', dia(13), { funcaoId: motorista });
    expect(semCnh.status).toBe(409);
    expect((await semCnh.json()).erro).toBe('Sem a CNH exigida');
    expect((await escalar('CNHD', dia(13), { funcaoId: motorista })).status).toBe(201);
  });

  it('vaga que não existe nesta escala é 409 com o motivo; guarnição sem função é 400', async () => {
    const outraFaixa = await escalar('TRES', dia(14), { turnoId: turnoB, guarnicaoId: outra });
    expect(outraFaixa.status).toBe(409);
    expect((await outraFaixa.json()).erro).toBe('Esta guarnição não está nesta faixa neste mês.');
    const fora = await escalar('TRES', dia(14), { funcaoId: motorista, guarnicaoId: outra });
    expect(fora.status).toBe(409);
    expect((await fora.json()).erro).toBe('Esta função não está na composição da guarnição.');
    const meia = await escalar('TRES', dia(14), { funcaoId: null });
    expect(meia.status).toBe(400);
    const semPosto = await escalar('TRES', dia(14), { guarnicaoId: null, funcaoId: null });
    expect(semPosto.status).toBe(201);
    expect(faixaA((await semPosto.json()) as EscalaDoMes, 14).semPosto.map((o) => o.nomeGuerra)).toEqual(['TRES']);
  });
});

describe('remover e desfazer', () => {
  it('remover apaga a alocação e guarda a remoção; escalar de novo, ou desfazer, apaga a remoção', async () => {
    const criada: EscalaDoMes = await (await escalar('REMOVIDO', dia(20))).json();
    const alocacaoId = faixaA(criada, 20).guarnicoes[0]!.funcoes[1]!.ocupantes[0]!.alocacaoId;
    const r = await api.pedir('escalante', 'DELETE', `/api/alocacoes/${alocacaoId}`);
    expect(r.status).toBe(200);
    const depois: EscalaDoMes = await r.json();
    expect(ocupantes(depois, 20, 'Combatente')).toEqual([]);
    expect(faixaA(depois, 20).removidos).toEqual([expect.objectContaining({ militarId: militar.REMOVIDO, nomeGuerra: 'REMOVIDO', servico: 'Pronto' })]);
    const rem = (await api.banco.query<{ removida_por: string }>('select removida_por from remocao where militar_id = $1', [militar.REMOVIDO])).rows;
    expect(rem).toEqual([{ removida_por: api.usuarios.escalante }]);

    // escalar o mesmo militar na mesma combinação desfaz a remoção
    const de_novo: EscalaDoMes = await (await escalar('REMOVIDO', dia(20))).json();
    expect(faixaA(de_novo, 20).removidos).toEqual([]);

    // remover de novo e desfazer pela rota
    const idNovo = faixaA(de_novo, 20).guarnicoes[0]!.funcoes[1]!.ocupantes[0]!.alocacaoId;
    const removida: EscalaDoMes = await (await api.pedir('escalante', 'DELETE', `/api/alocacoes/${idNovo}`)).json();
    const remocaoId = faixaA(removida, 20).removidos[0]!.remocaoId;
    const desfeita = await api.pedir('escalante', 'DELETE', `/api/remocoes/${remocaoId}`);
    expect(desfeita.status).toBe(200);
    expect(faixaA((await desfeita.json()) as EscalaDoMes, 20).removidos).toEqual([]);
    expect((await api.pedir('escalante', 'DELETE', `/api/remocoes/${remocaoId}`)).status).toBe(404);
  });
});

describe('acesso', () => {
  it('quem não é da seção recebe 403 ao escalar, remover e desfazer', async () => {
    expect((await escalar('VOLTA', dia(22), {}, 'semPapel')).status).toBe(403);
    const ok: EscalaDoMes = await (await escalar('VOLTA', dia(22))).json();
    const alocacaoId = faixaA(ok, 22).guarnicoes[0]!.funcoes[1]!.ocupantes[0]!.alocacaoId;
    expect((await api.pedir('semPapel', 'DELETE', `/api/alocacoes/${alocacaoId}`)).status).toBe(403);
    const removida: EscalaDoMes = await (await api.pedir('escalante', 'DELETE', `/api/alocacoes/${alocacaoId}`)).json();
    expect((await api.pedir('semPapel', 'DELETE', `/api/remocoes/${faixaA(removida, 22).removidos[0]!.remocaoId}`)).status).toBe(403);
  });
});
