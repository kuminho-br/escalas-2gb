import type { Candidatos, EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.40, Task 3: quem a pré-escala pôs no turno sem guarnição é movido para a vaga (uma alocação só, agora com guarnição e função), sem ser "Já escalado". Cenário fictício (D7).
let api: ApiDeTeste;
let escalaId: string;
let servicoPronto: string;
let turnoPronto: string;
let abt: string;
let motorista: string;
let combatente: string;
const atual = hojeRecife().slice(0, 7);
const dia = `${atual}-20`;
const militar: Record<string, string> = {};
let seq = 0;

async function criar(nome: string, cnh: string[] = []) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `99${String(7300 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, antiguidade: seq, motorista: cnh.length > 0, cnh });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, jornada: 'pronto', desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
  militar[nome] = id;
}
const noTurno = (nome: string, extra: Record<string, unknown> = {}) =>
  inserir(api.banco, 'alocacao', { militar_id: militar[nome], escala_id: escalaId, servico_id: servicoPronto, turno_id: turnoPronto, data: dia, origem: 'pre_escala', ...extra });
const candidatos = async (funcaoId = combatente): Promise<Candidatos> => {
  const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${dia}&inicio=08:00&fim=20:00&guarnicaoId=${abt}&funcaoId=${funcaoId}`);
  expect(r.status).toBe(200);
  return r.json();
};
const escalarNaVaga = (nome: string, funcaoId = combatente) =>
  api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: militar[nome], data: dia, turnoId: turnoPronto, guarnicaoId: abt, funcaoId });
const alocacoesDe = async (nome: string) =>
  (await api.banco.query<{ id: string; guarnicao_id: string | null; funcao_id: string | null }>('select id, guarnicao_id, funcao_id from alocacao where militar_id = $1 and data = $2::date', [militar[nome], dia])).rows;

beforeAll(async () => {
  api = await montarApi();
  servicoPronto = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
  turnoPronto = (await (await api.pedir('admin', 'POST', `/api/servicos/${servicoPronto}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id as string;
  escalaId = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Ordinário' })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servicoPronto] })).status).toBe(200);
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  abt = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/guarnicoes`, {
    nome: 'ABT', vigencia: atual,
    versao: { viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }] },
  })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, inicio: '08:00', fim: '20:00' }] })).status).toBe(200);
  await criar('NOTURNO'); // a pré-escala o pôs no turno, sem guarnição
  await criar('COMVAGA'); // já está numa vaga
  await criar('LIVRE');
  await criar('MOTORISTA', ['D']);
  await noTurno('NOTURNO');
  await noTurno('COMVAGA', { guarnicao_id: abt, funcao_id: combatente });
  await noTurno('MOTORISTA');
});
afterAll(async () => {
  await api.fechar();
});

describe('mover do turno para a vaga (6.40)', () => {
  it('quem está no turno sem guarnição é candidato (não "Já escalado"), vem primeiro e diz o id da alocação que será movida; quem já está numa vaga continua "Já escalado"', async () => {
    const lista = await candidatos();
    expect(lista.aptos.map((a) => a.nomeGuerra)).toEqual(['NOTURNO', 'MOTORISTA', 'LIVRE']);
    const n = lista.aptos[0]!;
    expect(n.noTurno).toEqual({ alocacaoId: (await alocacoesDe('NOTURNO'))[0]!.id });
    expect(n.servicos.map((s) => s.nome)).toEqual(['Pronto']);
    expect('noTurno' in lista.aptos.find((a) => a.nomeGuerra === 'LIVRE')!).toBe(false);
    expect(lista.fora.map((f) => f.motivo)).toContain('Já escalado neste horário');
  });

  it('as regras da vaga continuam valendo para quem está no turno: sem a CNH exigida, ele sai da lista (o motorista com CNH D entra)', async () => {
    await criar('NOTURNOB');
    await noTurno('NOTURNOB');
    const lista = await candidatos(motorista);
    expect(lista.aptos.map((a) => a.nomeGuerra)).toEqual(['MOTORISTA']);
    expect(lista.aptos[0]!.noTurno).toBeDefined();
  });

  it('escolher quem está no turno MOVE: uma alocação só, agora com guarnição e função; sem erro de "já escalado"', async () => {
    const antes = (await alocacoesDe('NOTURNO'))[0]!.id;
    const r = await escalarNaVaga('NOTURNO');
    expect(r.status).toBe(201);
    const depois = await alocacoesDe('NOTURNO');
    expect(depois).toEqual([{ id: antes, guarnicao_id: abt, funcao_id: combatente }]);
    const escala = (await r.json()) as EscalaDoMes;
    const dia20 = escala.dias.find((d) => d.data === dia)!;
    const ocupantes = dia20.faixas.flatMap((f) => f.guarnicoes.flatMap((g) => g.funcoes.flatMap((fn) => fn.ocupantes.map((o) => o.nomeGuerra))));
    expect(ocupantes).toContain('NOTURNO');
  });

  it('quem já está numa vaga continua recusado ao tentar escalar de novo', async () => {
    const r = await escalarNaVaga('COMVAGA');
    expect(r.status).toBe(409);
    expect((await alocacoesDe('COMVAGA')).length).toBe(1);
  });

  it('"Desfazer" (voltar ao turno): devolve a alocação ao turno sem guarnição; 409 se a vaga dele mudou desde então (Review Focus 5)', async () => {
    const a = (await alocacoesDe('NOTURNO'))[0]!;
    const volta = await api.pedir('escalante', 'POST', `/api/alocacoes/${a.id}/voltar-ao-turno`, { guarnicaoId: abt, funcaoId: combatente });
    expect(volta.status).toBe(200);
    expect(await alocacoesDe('NOTURNO')).toEqual([{ id: a.id, guarnicao_id: null, funcao_id: null }]);
    // já está sem guarnição (ou foi para outra vaga): o pedido não encontra mais o que desfazer
    const denovo = await api.pedir('escalante', 'POST', `/api/alocacoes/${a.id}/voltar-ao-turno`, { guarnicaoId: abt, funcaoId: combatente });
    expect(denovo.status).toBe(409);
    expect((await denovo.json()).erro).toBe('A escala mudou desde então. Não dá mais para desfazer.');
  });

  it('a lista que a pré-escala usa (sem vaga) continua dizendo "Já escalado" para quem está no turno: nada de duplicar', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${dia}&inicio=08:00&fim=20:00`);
    const lista = (await r.json()) as Candidatos;
    expect(lista.aptos.map((a) => a.nomeGuerra)).toEqual(['LIVRE']);
  });
});
