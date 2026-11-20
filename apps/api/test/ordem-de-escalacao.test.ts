import { mesPorExtenso, somarMeses, type OrdemDeEscalacao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): escala Ordinário com Pronto A (08h–20h); ABT (prioridade 1: Motorista 1–1 CNH D, Combatente 1–2) e AR (Chefe 1–1).
let api: ApiDeTeste;
let escalaId: string;
let abt: string;
let ar: string;
let motorista: string;
let combatente: string;
let chefe: string;
const atual = hojeRecife().slice(0, 7);
const mes = (n: number) => somarMeses(atual, n);
const FAIXA_A = { inicio: '08:00', fim: '20:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;
const vaga = (guarnicaoId: string, funcaoId: string, n = 1) => ({ guarnicaoId, funcaoId, vaga: n });
const ler = async (m: string, quem: 'escalante' | 'semPapel' = 'escalante') => api.pedir(quem, 'GET', `/api/escalas/${escalaId}/ordem/${m}`);
const gravar = (m: string, itens: unknown[], quem: 'escalante' | 'semPapel' = 'escalante') => api.pedir(quem, 'PUT', `/api/escalas/${escalaId}/ordem/${m}`, { itens });
const posicoes = (o: OrdemDeEscalacao) => o.vagas.map((v) => `${v.guarnicao} ${v.funcao} ${v.vaga}=${v.posicao ?? '-'}`);

beforeAll(async () => {
  api = await montarApi();
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  chefe = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Chefe' });
  const servico = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  await api.pedir('escalante', 'POST', `/api/servicos/${servico.id}/turnos`, { letra: 'A', ...FAIXA_A });
  const guarnicao = async (nome: string, prioridade: number | null, composicao: unknown[]) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade, ativa: true, composicao } })).json()).id as string;
  abt = await guarnicao('ABT', 1, [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }]);
  ar = await guarnicao('AR', null, [{ funcaoId: chefe, minimo: 1, maximo: 1, cnhExigida: null }]);
  escalaId = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.id] });
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, ...FAIXA_A }, { guarnicaoId: ar, ...FAIXA_A }] })).status).toBe(200);
});
afterAll(async () => {
  await api.fechar();
});

describe('ordem de escalação', () => {
  it('sem ordem cadastrada, a sugestão segue a prioridade antiga das guarnições', async () => {
    const r = await ler(atual);
    expect(r.status).toBe(200);
    const o: OrdemDeEscalacao = await r.json();
    expect(o.vigencia).toBeNull();
    expect(posicoes(o)).toEqual(['ABT Motorista 1=1', 'ABT Combatente 1=2', 'ABT Combatente 2=3', 'AR Chefe 1=4']);
    expect(o.vagas.map((v) => v.obrigatoria)).toEqual([true, true, false, true]);
  });

  it('a ordem gravada a partir de um mês vale nos meses seguintes e não nos anteriores (Review Focus 5)', async () => {
    const g = await gravar(mes(1), [vaga(ar, chefe), vaga(abt, motorista)]);
    expect(g.status).toBe(200);
    expect(posicoes(await g.json())).toEqual(['ABT Motorista 1=2', 'ABT Combatente 1=-', 'ABT Combatente 2=-', 'AR Chefe 1=1']);
    const depois: OrdemDeEscalacao = await (await ler(mes(2))).json();
    expect(depois.vigencia).toBe(mes(1));
    expect(posicoes(depois)).toEqual(['ABT Motorista 1=2', 'ABT Combatente 1=-', 'ABT Combatente 2=-', 'AR Chefe 1=1']);
    const antes: OrdemDeEscalacao = await (await ler(atual)).json();
    expect(antes.vigencia).toBeNull();
  });

  it('gravar de novo no mesmo mês substitui a ordem; lista vazia deixa todas as vagas sem número', async () => {
    await gravar(mes(3), [vaga(abt, combatente, 1)]);
    const g = await gravar(mes(3), []);
    expect(g.status).toBe(200);
    const o: OrdemDeEscalacao = await g.json();
    expect(o.vigencia).toBe(mes(3));
    expect(o.vagas.every((v) => v.posicao === null)).toBe(true);
    expect((await api.banco.query("select 1 from ordem_escala_versao where escala_id = $1 and vigencia_desde = $2::date", [escalaId, `${mes(3)}-01`])).rows).toHaveLength(1);
  });

  it('vaga que não existe é 400 com o campo; vaga repetida também', async () => {
    const fora = await gravar(mes(4), [vaga(ar, chefe), vaga(abt, combatente, 3)]);
    expect(fora.status).toBe(400);
    expect((await fora.json()).campos).toEqual({ 'itens.1': `Esta vaga não existe nesta escala em ${mesPorExtenso(mes(4))}.` });
    const repetida = await gravar(mes(4), [vaga(ar, chefe), vaga(ar, chefe)]);
    expect(repetida.status).toBe(400);
    expect((await repetida.json()).campos.itens).toBe('Esta vaga aparece duas vezes na ordem.');
    expect((await api.banco.query("select 1 from ordem_escala_versao where escala_id = $1 and vigencia_desde = $2::date", [escalaId, `${mes(4)}-01`])).rows).toHaveLength(0);
  });

  it('mês passado não muda (a mesma recusa dos vínculos); mês inválido é 400', async () => {
    const passado = await gravar(mes(-1), [vaga(ar, chefe)]);
    expect(passado.status).toBe(409);
    expect((await passado.json()).erro).toBe(`Só dá para mudar a partir de ${mesPorExtenso(atual)}.`);
    expect((await ler('2026-13')).status).toBe(400);
  });

  it('quem não é escalante recebe 403 e nada é gravado', async () => {
    expect((await ler(atual, 'semPapel')).status).toBe(403);
    expect((await gravar(mes(5), [vaga(ar, chefe)], 'semPapel')).status).toBe(403);
    expect((await api.banco.query("select 1 from ordem_escala_versao where escala_id = $1 and vigencia_desde = $2::date", [escalaId, `${mes(5)}-01`])).rows).toHaveLength(0);
  });
});
