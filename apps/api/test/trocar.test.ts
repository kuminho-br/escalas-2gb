import type { OpcoesDeTroca } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7), dezembro de 2026. Escala Ordinário: Pronto (A 08–20, B 20–08), Bioma (diária, A 08–16) e JES (PJES, A 08–20), com a
// guarnição ABT (Motorista CNH D, 1 vaga; Combatente, 1 a 2 vagas) vinculada às faixas 08–20 e 20–08. Cada cenário usa o seu dia.
let api: ApiDeTeste;
let outraSecao: string;
let escala: string;
let abt: string;
let motorista: string;
let combatente: string;
const servico: Record<string, { id: string; a: string; b?: string }> = {};
const militar: Record<string, string> = {};
const dia = (n: number) => `2026-12-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;

const servicoComTurnos = async (nome: string, tipo: string, turnos: [string, string, string][]) => {
  const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, cor: '#2F8F5B' });
  const ids: Record<string, string> = {};
  for (const [letra, inicio, fim] of turnos) ids[letra.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
  servico[nome] = { id, a: ids.a!, b: ids.b };
};
const alocar = (nome: string, servicoNome: string, letra: 'a' | 'b', data: string, vaga?: { funcao: string }) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar[nome], escala_id: escala, servico_id: servico[servicoNome]!.id, turno_id: servico[servicoNome]![letra]!, data,
    guarnicao_id: vaga ? abt : null, funcao_id: vaga?.funcao ?? null, origem: 'manual',
  });
const trocas = async (alocacaoId: string, quem: 'escalante' | 'semPapel' = 'escalante'): Promise<Response> => api.pedir(quem, 'GET', `/api/alocacoes/${alocacaoId}/trocas`);
const lerTrocas = async (alocacaoId: string): Promise<OpcoesDeTroca> => {
  const r = await trocas(alocacaoId);
  expect(r.status).toBe(200);
  return r.json();
};
const trocar = (alocacaoId: string, corpo: unknown, quem: 'escalante' | 'semPapel' = 'escalante') => api.pedir(quem, 'POST', `/api/alocacoes/${alocacaoId}/trocar`, corpo);
const de = async (nome: string, data: string) =>
  (
    await api.banco.query<{ id: string; turno_id: string; guarnicao_id: string | null; funcao_id: string | null; servico_id: string }>(
      'select id, turno_id, guarnicao_id, funcao_id, servico_id from alocacao where militar_id = $1 and data = $2::date order by turno_id',
      [militar[nome], data],
    )
  ).rows;
const remocoes = async (nome: string, data: string) => (await api.banco.query('select 1 from remocao where militar_id = $1 and data = $2::date', [militar[nome], data])).rows.length;

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  await servicoComTurnos('Pronto', 'ordinario', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
  await servicoComTurnos('Bioma', 'diaria', [['A', '08:00', '16:00']]);
  await servicoComTurnos('JES', 'pjes', [['A', '08:00', '20:00']]);
  const g = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome: 'ABT', vigencia: '2026-12',
    versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }] },
  });
  abt = (await g.json()).id;
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id as string;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [servico.Pronto!.id, servico.Bioma!.id, servico.JES!.id] })).status).toBe(200);
  const v = await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/vinculos/2026-12`, {
    itens: [{ guarnicaoId: abt, inicio: '08:00', fim: '20:00' }, { guarnicaoId: abt, inicio: '20:00', fim: '08:00' }],
  });
  expect(v.status).toBe(200);
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  let seq = 0;
  const criar = async (nome: string, extra: { cnh?: string[]; jes?: boolean; unidade?: string } = {}) => {
    seq++;
    const id = await inserir(api.banco, 'militar', {
      matricula: `99${String(1400 + seq).padStart(4, "0")}-${seq % 10}`, posto_grad_id: sd, nome_guerra: nome, motorista: (extra.cnh ?? []).length > 0, cnh: extra.cnh ?? [], voluntario_jes: extra.jes ?? false,
    });
    militar[nome] = id;
    await inserir(api.banco, 'lotacao', { militar_id: id, unidade_id: extra.unidade ?? api.ids.secao, equipe_id: extra.unidade ? null : alfa, jornada: 'pronto', desde: '2026-11-01' });
  };
  for (const n of ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'E3', 'F1', 'F2', 'LIVRE']) await criar(n, { cnh: ['E'] });
  await criar('SEMCNH', { cnh: ['B'] });
  await criar('SEMCNH2', { cnh: ['B'] });
  await criar('FORA', { unidade: outraSecao });
});
afterAll(async () => {
  await api.fechar();
});

describe('as opções da troca', () => {
  const d = dia(3);
  let a1: string;
  let b1: string;
  beforeAll(async () => {
    a1 = await alocar('A1', 'Pronto', 'a', d, { funcao: combatente });
    b1 = await alocar('B1', 'Bioma', 'a', d);
    await alocar('B2', 'Pronto', 'b', d, { funcao: combatente });
  });

  it('lista os livres que podem ocupar a vaga e os escalados do dia, com onde estão e se é permuta', async () => {
    const o = await lerTrocas(a1);
    const aptos = o.livres.aptos.map((x) => x.nomeGuerra);
    expect(aptos).toContain('LIVRE');
    expect(aptos).not.toContain('A1');
    expect(aptos).not.toContain('FORA');
    // o do Bioma (diária) e o do Pronto B (ordinário): só o segundo é permuta com um serviço ordinário
    const escalados = Object.fromEntries(o.escalados.map((e) => [e.nomeGuerra, e.alocacoes]));
    expect(Object.keys(escalados).sort()).toEqual(['B1', 'B2']);
    expect(escalados.B1).toEqual([{ alocacaoId: b1, onde: 'Ordinário, 08h–16h, sem guarnição', permuta: false }]);
    expect(escalados.B2).toEqual([{ alocacaoId: expect.any(String), onde: 'Ordinário, 20h–08h, Combatente do ABT', permuta: true }]);
  });

  it('a alocação inexistente é 404 e sem papel é 403', async () => {
    expect((await trocas('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await trocas(a1, 'semPapel')).status).toBe(403);
  });
});

describe('substituir por um militar livre', () => {
  const d = dia(4);
  it('o atual sai com a marca de remoção e o novo entra no turno escolhido, na mesma vaga', async () => {
    const id = await alocar('C1', 'Pronto', 'a', d, { funcao: combatente });
    const r = await trocar(id, { militarId: militar.LIVRE, turnoId: servico.Pronto!.a });
    expect(r.status).toBe(200);
    expect(await de('C1', d)).toEqual([]);
    expect(await remocoes('C1', d)).toBe(1);
    expect(await de('LIVRE', d)).toEqual([expect.objectContaining({ turno_id: servico.Pronto!.a, guarnicao_id: abt, funcao_id: combatente })]);
  });

  it('se o novo não pode ocupar a vaga, é 409 com o motivo e nada muda', async () => {
    const d2 = dia(5);
    const id = await alocar('C2', 'Pronto', 'a', d2, { funcao: motorista });
    const r = await trocar(id, { militarId: militar.SEMCNH, turnoId: servico.Pronto!.a });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Sem a CNH exigida'); // um militar só: o motivo vem puro, sem "não pode ir para a vaga de"
    expect(await de('C2', d2)).toHaveLength(1);
    expect(await remocoes('C2', d2)).toBe(0);
  });

  it('o turno escolhido precisa ser da faixa da vaga', async () => {
    const d2 = dia(6);
    const id = await alocar('D1', 'Pronto', 'a', d2, { funcao: combatente });
    const r = await trocar(id, { militarId: militar.LIVRE, turnoId: servico.Pronto!.b });
    expect(r.status).toBe(409);
    expect(await de('D1', d2)).toHaveLength(1);
  });
});

describe('trocar de lugar com quem já está escalado', () => {
  it('dois ordinários trocam de lugar (permuta) e não há marca de remoção', async () => {
    const d = dia(7);
    const a = await alocar('A2', 'Pronto', 'a', d, { funcao: combatente });
    await alocar('A3', 'Pronto', 'b', d, { funcao: combatente });
    const b = (await de('A3', d))[0]!.id;
    const r = await trocar(a, { comAlocacaoId: b });
    expect(r.status).toBe(200);
    expect((await r.json()).escalas).toEqual([{ escalaId: escala, mes: '2026-12' }]);
    expect(await de('A2', d)).toEqual([expect.objectContaining({ turno_id: servico.Pronto!.b, guarnicao_id: abt, funcao_id: combatente })]);
    expect(await de('A3', d)).toEqual([expect.objectContaining({ turno_id: servico.Pronto!.a, guarnicao_id: abt, funcao_id: combatente })]);
    expect(await remocoes('A2', d)).toBe(0);
    expect(await remocoes('A3', d)).toBe(0);
  });

  it('um ordinário com uma diária também troca de lugar (não é permuta)', async () => {
    const d = dia(8);
    const a = await alocar('E1', 'Pronto', 'a', d, { funcao: combatente });
    const b = await alocar('E2', 'Bioma', 'a', d);
    const o = await lerTrocas(a);
    expect(o.escalados.find((e) => e.nomeGuerra === 'E2')!.alocacoes[0]!.permuta).toBe(false);
    expect((await trocar(a, { comAlocacaoId: b })).status).toBe(200);
    expect(await de('E1', d)).toEqual([expect.objectContaining({ servico_id: servico.Bioma!.id, guarnicao_id: null })]);
    expect(await de('E2', d)).toEqual([expect.objectContaining({ servico_id: servico.Pronto!.id, guarnicao_id: abt, funcao_id: combatente })]);
  });

  it('trocar com quem não tem a CNH da vaga do outro é 409 com o motivo e nada muda (Review Focus 3)', async () => {
    const d = dia(9);
    const motorista1 = await alocar('F1', 'Pronto', 'a', d, { funcao: motorista });
    await alocar('SEMCNH', 'Pronto', 'b', d, { funcao: combatente });
    const b = (await de('SEMCNH', d))[0]!.id;
    const r = await trocar(motorista1, { comAlocacaoId: b });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('SD BM SEMCNH não pode ir para a vaga de SD BM F1: Sem a CNH exigida');
    expect(await de('F1', d)).toEqual([expect.objectContaining({ id: motorista1, funcao_id: motorista })]);
    expect(await de('SEMCNH', d)).toEqual([expect.objectContaining({ id: b, funcao_id: combatente })]);
  });

  it('quando os dois não podem, a mensagem cita o da alocação clicada, e nada muda nos dois (Review Focus 5)', async () => {
    const d = dia(18);
    // os dois ocupam vaga de motorista sem ter a CNH D (alocados direto, como se a CNH tivesse mudado depois)
    const doSemCnh = await alocar('SEMCNH', 'Pronto', 'a', d, { funcao: motorista });
    const doOutro = await alocar('SEMCNH2', 'Pronto', 'b', d, { funcao: motorista });
    for (const [clicada, outra, quem, outro] of [[doSemCnh, doOutro, 'SEMCNH', 'SEMCNH2'], [doOutro, doSemCnh, 'SEMCNH2', 'SEMCNH']] as const) {
      const r = await trocar(clicada, { comAlocacaoId: outra });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe(`SD BM ${quem} não pode ir para a vaga de SD BM ${outro}: Sem a CNH exigida`);
    }
    expect(await de('SEMCNH', d)).toEqual([expect.objectContaining({ id: doSemCnh, turno_id: servico.Pronto!.a, funcao_id: motorista })]);
    expect(await de('SEMCNH2', d)).toEqual([expect.objectContaining({ id: doOutro, turno_id: servico.Pronto!.b, funcao_id: motorista })]);
  });

  it('com acúmulo em qualquer dos dois é 409 "Tire os acúmulos antes de trocar."', async () => {
    const d = dia(10);
    const a = await alocar('F2', 'Pronto', 'a', d, { funcao: combatente });
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: a, guarnicao_id: abt, funcao_id: motorista });
    const b = await alocar('E3', 'Bioma', 'a', d);
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const r = await trocar(x, { comAlocacaoId: y });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('Tire os acúmulos antes de trocar.');
    }
    expect(await de('F2', d)).toEqual([expect.objectContaining({ id: a })]);
  });

  it('quem está em dois serviços no dia aparece com as duas alocações, e a troca usa a escolhida (Review Focus 4)', async () => {
    const d = dia(11);
    const meu = await alocar('D2', 'Pronto', 'a', d, { funcao: combatente });
    await alocar('B1', 'Bioma', 'a', d);
    await alocar('B1', 'Pronto', 'b', d, { funcao: combatente });
    const o = await lerTrocas(meu);
    const dele = o.escalados.find((e) => e.nomeGuerra === 'B1')!;
    expect(dele.alocacoes.map((x) => [x.onde, x.permuta])).toEqual([
      ['Ordinário, 08h–16h, sem guarnição', false],
      ['Ordinário, 20h–08h, Combatente do ABT', true],
    ]);
    // troca com a diária do B1: o D2 vai para o Bioma, o B1 passa a fazer o Pronto A e segue no Pronto B
    expect((await trocar(meu, { comAlocacaoId: dele.alocacoes[0]!.alocacaoId })).status).toBe(200);
    expect((await de('D2', d)).map((x) => x.turno_id)).toEqual([servico.Bioma!.a]);
    expect((await de('B1', d)).map((x) => x.turno_id).sort()).toEqual([servico.Pronto!.a, servico.Pronto!.b!].sort());
  });

  it('a troca que deixaria um dos dois em dois serviços ao mesmo tempo é 409 com o motivo e nada muda', async () => {
    const d = dia(15);
    const meu = await alocar('F1', 'Bioma', 'a', d);
    await alocar('F2', 'Pronto', 'a', d, { funcao: combatente });
    await alocar('F2', 'Pronto', 'b', d, { funcao: combatente });
    const noite = (await de('F2', d)).find((x) => x.turno_id === servico.Pronto!.b)!.id;
    // o F2 iria para o Bioma (08h–16h) e continuaria com o Pronto A (08h–20h)
    const r = await trocar(meu, { comAlocacaoId: noite });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('SD BM F2 não pode ir para a vaga de SD BM F1: Choque de horário');
    expect(await de('F1', d)).toEqual([expect.objectContaining({ id: meu })]);
    expect(await de('F2', d)).toHaveLength(2);
  });

  it('com a outra alocação de outro dia é 409; a mesma alocação, também; a que não existe é 404', async () => {
    const a = await alocar('A1', 'Pronto', 'a', dia(12), { funcao: combatente });
    const outroDia = await alocar('A2', 'Pronto', 'a', dia(13), { funcao: combatente });
    const r = await trocar(a, { comAlocacaoId: outroDia });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('A troca é entre serviços do mesmo dia.');
    expect((await trocar(a, { comAlocacaoId: a })).status).toBe(409);
    expect((await trocar(a, { comAlocacaoId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });
});

describe('outra pessoa mexeu antes (achado da revisão final)', () => {
  it('a troca com uma alocação que já foi apagada é 404 e a outra não muda', async () => {
    const d = dia(16);
    const a = await alocar('A1', 'Pronto', 'a', d, { funcao: combatente });
    const b = await alocar('A2', 'Pronto', 'b', d, { funcao: combatente });
    await api.banco.query('delete from alocacao where id = $1', [b]);
    const r = await trocar(a, { comAlocacaoId: b });
    expect(r.status).toBe(404);
    expect(await de('A1', d)).toEqual([expect.objectContaining({ id: a, turno_id: servico.Pronto!.a })]);
  });

  it('a substituição de uma alocação que já foi apagada é 404 e ninguém entra', async () => {
    const d = dia(17);
    const a = await alocar('C1', 'Pronto', 'a', d, { funcao: combatente });
    await api.banco.query('delete from alocacao where id = $1', [a]);
    const r = await trocar(a, { militarId: militar.LIVRE, turnoId: servico.Pronto!.a });
    expect(r.status).toBe(404);
    expect(await de('LIVRE', d)).toEqual([]);
    expect(await remocoes('C1', d)).toBe(0);
  });
});

describe('acesso e corpo', () => {
  it('sem papel é 403, a alocação inexistente é 404 e o corpo inválido é 400', async () => {
    const id = await alocar('E1', 'Pronto', 'a', dia(14), { funcao: combatente });
    expect((await trocar(id, { militarId: militar.LIVRE, turnoId: servico.Pronto!.a }, 'semPapel')).status).toBe(403);
    expect((await trocar('00000000-0000-4000-8000-000000000000', { militarId: militar.LIVRE, turnoId: servico.Pronto!.a })).status).toBe(404);
    expect((await trocar(id, {})).status).toBe(400);
  });
});
