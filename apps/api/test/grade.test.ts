import type { GradeDoMes, GrupoDaGrade, LinhaDaGrade } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7), dezembro de 2026 (dia 1 = terça; dia 5 = sábado; dia 8 = feriado de teste; 31 = quinta).
// Serviços: Pronto (A 08–20, B 20–08), Madrugada (06–14), JES (PJES, 08–20), Bioma (diária, 08–16) e Saldo (A 08–20).
// Equipes: Alfa (CABO, SD1, SD2, TRANSF) e Bravo (BRAVO); Adm (ADM); de outra seção, escalado aqui (FORA).
// 6.71: o expediente do Adm é só o serviço Expediente (A 08–16) lançado pela pré-escala; o ADM o tem nos dias 2, 22, 24 e 29.
let api: ApiDeTeste;
let outraSecao: string;
let escala: string;
const servico: Record<string, { id: string; cor: string; a: string; b?: string }> = {};
const militar: Record<string, string> = {};
const MES = '2026-12';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;

const grade = async (mes = MES, quem: 'escalante' | 'semPapel' = 'escalante', unidade = api.ids.secao) => api.pedir(quem, 'GET', `/api/unidades/${unidade}/grade/${mes}`);
const ler = async (): Promise<GradeDoMes> => {
  const r = await grade();
  expect(r.status).toBe(200);
  return r.json();
};
const linhaDe = (g: GradeDoMes, nome: string): LinhaDaGrade => g.grupos.flatMap((x) => x.linhas).find((l) => l.nomeGuerra === nome)!;
const grupoDe = (g: GradeDoMes, chave: string): GrupoDaGrade => g.grupos.find((x) => x.chave === chave)!;
const alocar = (nome: string, servicoNome: string, letra: 'a' | 'b', data: string) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar[nome], escala_id: escala, servico_id: servico[servicoNome]!.id, turno_id: servico[servicoNome]![letra]!, data, origem: 'manual',
  });
const servicoComTurnos = async (nome: string, tipo: string, cor: string, turnos: [string, string, string][]) => {
  const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, cor });
  const ids: Record<string, string> = {};
  for (const [letra, inicio, fim] of turnos) ids[letra.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
  servico[nome] = { id, cor, a: ids.a!, b: ids.b };
};
const faixa = (nome: string, data: string, inicio: number, fim: number) =>
  inserir(api.banco, 'disponibilidade', { militar_id: militar[nome], data, inicio_min: inicio, fim_min: fim, origem: 'manual' });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB' and mae_id = $1", [api.ids.gb])).rows[0]!.id; // a 2ª SB da carga base (a sigla não se repete entre irmãs)
  await servicoComTurnos('Pronto', 'ordinario', '#2F8F5B', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
  await servicoComTurnos('Madrugada', 'ordinario', '#1F6F8B', [['A', '06:00', '14:00']]);
  await servicoComTurnos('JES', 'pjes', '#6E56A8', [['A', '08:00', '20:00']]);
  await servicoComTurnos('Bioma', 'diaria', '#C97A00', [['A', '08:00', '16:00']]);
  await servicoComTurnos('Saldo', 'ordinario', '#2B7BB9', [['A', '08:00', '20:00']]);
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id as string;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: Object.values(servico).map((x) => x.id) })).status).toBe(200);
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const bravo = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Bravo', ordem_ciclo: 2 });
  await inserir(api.banco, 'feriado', { unidade_id: api.ids.secao, data: dia(8), descricao: 'Feriado de teste' });
  const cb = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'CB'")).rows[0]!.id;
  const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  let seq = 0;
  const criar = async (nome: string, posto: string, antiguidade: number | null, lotacao: { unidade?: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde?: string; ate?: string | null }) => {
    seq++;
    const id = await inserir(api.banco, 'militar', { matricula: `99120${seq}-${seq}`, posto_grad_id: posto, nome_guerra: nome, antiguidade });
    militar[nome] = id;
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: lotacao.unidade ?? api.ids.secao, equipe_id: lotacao.equipe, jornada: lotacao.jornada, desde: lotacao.desde ?? '2026-11-01', ate: lotacao.ate ?? null,
    });
  };
  // fora da ordem de antiguidade de propósito
  await criar('SD2', sd, 2, { equipe: alfa, jornada: 'pronto' });
  await criar('TRANSF', sd, 3, { equipe: alfa, jornada: 'pronto', ate: dia(14) });
  await criar('SD1', sd, 1, { equipe: alfa, jornada: 'pronto' });
  await criar('CABO', cb, null, { equipe: alfa, jornada: 'pronto' });
  await criar('BRAVO', sd, 1, { equipe: bravo, jornada: 'pronto' });
  await criar('ADM', sd, 1, { equipe: null, jornada: 'adm' });
  await criar('FORA', sd, 1, { unidade: outraSecao, equipe: null, jornada: 'pronto', desde: '2026-01-01' });

  const tipo = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
  await inserir(api.banco, 'afastamento', { militar_id: militar.ADM, tipo_afastamento_id: tipo, inicio: dia(14), fim: dia(16) });

  // CABO: Pronto A (2), JES (10 e 17), Bioma (22), Pronto B no dia 31 (vai até as 08h de 1º de janeiro) e Madrugada em 1º de janeiro (choque)
  await alocar('CABO', 'Pronto', 'a', dia(2));
  await alocar('CABO', 'JES', 'a', dia(10));
  await alocar('CABO', 'JES', 'a', dia(17));
  await alocar('CABO', 'Bioma', 'a', dia(22));
  await alocar('CABO', 'Pronto', 'b', dia(31));
  await alocar('CABO', 'Madrugada', 'a', '2027-01-01');
  // SD1: o B do dia 30 e a Madrugada do dia 31 se sobrepõem (06h às 08h)
  await alocar('SD1', 'Pronto', 'b', dia(30));
  await alocar('SD1', 'Madrugada', 'a', dia(31));
  await alocar('SD2', 'Pronto', 'a', dia(5));
  await alocar('BRAVO', 'JES', 'a', dia(11));
  await alocar('BRAVO', 'Pronto', 'a', dia(8));
  await alocar('FORA', 'Pronto', 'a', dia(3));
  // ADM: o expediente lançado pela pré-escala (sem escala) nos dias 2, 22, 24 e 29; uma diária no dia 22 (choca com ele); um Saldo no dia 23, sem expediente lançado
  const expediente = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Expediente', tipo: 'ordinario', cor: '#8A94A1' });
  const turnoDoExpediente = await inserir(api.banco, 'turno', { servico_id: expediente, letra: 'A', inicio: '08:00', fim: '16:00' });
  for (const d of [2, 22, 24, 29]) {
    await inserir(api.banco, 'alocacao', { militar_id: militar.ADM, escala_id: null, servico_id: expediente, turno_id: turnoDoExpediente, data: dia(d), origem: 'pre_escala' });
  }
  await alocar('ADM', 'Bioma', 'a', dia(22));
  await alocar('ADM', 'Madrugada', 'a', dia(22));
  await alocar('ADM', 'Saldo', 'a', dia(23));
  // 6.37: o JES num dia útil choca com o expediente (antes só a diária chocava); o Pronto de outra seção (08h às 20h), no dia 29, também
  await alocar('ADM', 'JES', 'a', dia(24));
  const escalaDeFora = (await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/escalas`, { nome: 'Ordinário 2ª SB' })).json()).id as string;
  const prontoDeFora = await inserir(api.banco, 'servico', { unidade_id: outraSecao, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  const turnoDeFora = await inserir(api.banco, 'turno', { servico_id: prontoDeFora, letra: 'A', inicio: '08:00', fim: '20:00' });
  await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [escalaDeFora, prontoDeFora]);
  await inserir(api.banco, 'alocacao', { militar_id: militar.ADM, escala_id: escalaDeFora, servico_id: prontoDeFora, turno_id: turnoDeFora, data: dia(29), origem: 'manual' });

  // o que o CABO marcou no voluntariado: 12h + 12h + 8h + 8h em dezembro (e uma faixa de novembro, que não conta)
  await faixa('CABO', dia(10), 480, 1200);
  await faixa('CABO', dia(17), 480, 1200);
  await faixa('CABO', dia(22), 480, 960);
  await faixa('CABO', dia(23), 480, 960);
  await faixa('CABO', '2026-11-30', 1200, 1440);
});
afterAll(async () => {
  await api.fechar();
});

describe('grupos e ordem', () => {
  it('agrupa por equipe na ordem do ciclo, depois o Adm, depois Outras seções, e por antiguidade dentro do grupo', async () => {
    const g = await ler();
    expect(g.grupos.map((x) => x.nome)).toEqual(['Alfa', 'Bravo', 'ADM', 'Outras seções']);
    expect(g.grupos.slice(2).map((x) => x.chave)).toEqual(['adm', 'outras']);
    expect(grupoDe(g, g.grupos[0]!.chave).linhas.map((l) => l.nomeGuerra)).toEqual(['CABO', 'SD1', 'SD2', 'TRANSF']);
    expect(g.grupos[1]!.linhas.map((l) => l.nomeGuerra)).toEqual(['BRAVO']);
  });

  it('o transferido no meio do mês aparece uma vez, na equipe da lotação do dia 1, e o de outra seção escalado aqui vai para Outras seções', async () => {
    const g = await ler();
    expect(g.grupos.flatMap((x) => x.linhas).filter((l) => l.nomeGuerra === 'TRANSF')).toHaveLength(1);
    expect(grupoDe(g, 'outras').linhas.map((l) => l.nomeGuerra)).toEqual(['FORA']);
    expect(linhaDe(g, 'FORA').dias[dia(3)]).toHaveLength(1);
  });

  it('os dias do mês, com o dia da semana e o feriado', async () => {
    const g = await ler();
    expect(g.mes).toBe(MES);
    expect(g.dias).toHaveLength(31);
    expect(g.dias[7]).toEqual({ data: dia(8), diaDaSemana: 2, feriado: 'Feriado de teste' });
    expect(g.dias[4]).toEqual({ data: dia(5), diaDaSemana: 6, feriado: null });
  });
});

describe('blocos', () => {
  it('o turno B do último dia aparece só no último dia, com a letra e a cor do serviço', async () => {
    const l = linhaDe(await ler(), 'CABO');
    expect(l.dias[dia(31)]).toEqual([
      { alocacaoId: expect.any(String), servico: { id: servico.Pronto!.id, nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' }, letra: 'B', inicio: '20:00', fim: '08:00' },
    ]);
    expect(Object.keys(l.dias).every((d) => d.startsWith(MES))).toBe(true);
    expect(l.dias['2027-01-01']).toBeUndefined();
  });

  it('o expediente do Adm é só o lançado: um bloco do serviço Expediente, com a letra do turno; os outros dias úteis, o fim de semana, o feriado e o afastamento não têm bloco', async () => {
    const l = linhaDe(await ler(), 'ADM');
    expect(l.dias[dia(2)]).toEqual([{ alocacaoId: expect.any(String), servico: { id: expect.any(String), nome: 'Expediente', cor: '#8A94A1', tipo: 'ordinario' }, letra: 'A', inicio: '08:00', fim: '16:00' }]);
    for (const d of [1, 3, 4, 5, 6, 8, 14, 15, 16]) expect(l.dias[dia(d)]).toBeUndefined();
    // sem expediente lançado, o Saldo do dia 23 é o único bloco
    expect(l.dias[dia(23)]!.map((b) => b.servico.nome)).toEqual(['Saldo']);
  });

  it('os blocos do dia vêm em ordem de início', async () => {
    const l = linhaDe(await ler(), 'ADM');
    expect(l.dias[dia(22)]!.map((b) => b.inicio)).toEqual(['06:00', '08:00', '08:00']);
  });
});

describe('choques (Review Focus 1)', () => {
  it('o B do dia 30 com a Madrugada do dia 31 marca os dois dias', async () => {
    expect(linhaDe(await ler(), 'SD1').choques).toEqual([dia(30), dia(31)]);
  });

  it('o choque do B do dia 31 com a manhã de 1º de janeiro marca o dia 31 e não quebra a grade', async () => {
    const l = linhaDe(await ler(), 'CABO');
    expect(l.choques).toEqual([dia(31)]);
  });

  it('a diária, o JES e o serviço de outra seção chocam com o expediente lançado do Adm (dias 22, 24 e 29); sem expediente lançado, nada choca', async () => {
    expect(linhaDe(await ler(), 'ADM').choques).toEqual([dia(22), dia(24), dia(29)]);
  });

  it('o Saldo de um dia sem expediente lançado não é choque, e quem não tem choque vem com a lista vazia', async () => {
    const g = await ler();
    expect(linhaDe(g, 'SD2').choques).toEqual([]);
    expect(linhaDe(g, 'ADM').choques).not.toContain(dia(23));
  });
});

describe('colunas finais', () => {
  it('PJES, Diárias, horas tiradas e horas pedidas (em minutos), só do mês', async () => {
    const l = linhaDe(await ler(), 'CABO');
    expect(l).toMatchObject({ pjes: 2, diarias: 1, horasTiradas: 12 * 60 * 2 + 8 * 60, horasPedidas: 12 * 60 * 2 + 8 * 60 * 2 });
    expect(linhaDe(await ler(), 'BRAVO')).toMatchObject({ pjes: 1, diarias: 0, horasTiradas: 12 * 60, horasPedidas: 0 });
    expect(linhaDe(await ler(), 'SD2')).toMatchObject({ pjes: 0, diarias: 0, horasTiradas: 0 });
  });
});

describe('acesso', () => {
  it('mês inválido é 400; sem papel e outra seção são 403', async () => {
    const r = await grade('2026-13');
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Mês inválido: use o formato aaaa-mm.');
    expect((await grade(MES, 'semPapel')).status).toBe(403);
    expect((await grade(MES, 'escalante', outraSecao)).status).toBe(403);
  });
});
