import type { Candidatos, GradeDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { planejarPreEscala } from '../src/escala/pre-escala.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7), dezembro de 2026: MUDA é da equipe Alfa até o dia 14 e da Bravo a partir do dia 15 (o rastreio vale por dia).
// FIXO está na Alfa desde 01/11 (período que começa no dia 1, como sempre foi).
let api: ApiDeTeste;
let escala: string;
let alfa: string;
let bravo: string;
let pronto: { id: string; a: string; b: string };
let jes: { id: string; a: string };
const militar: Record<string, string> = {};
const MES = '2026-12';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;

const alocar = (nome: string, s: { id: string; a: string }, data: string) =>
  inserir(api.banco, 'alocacao', { militar_id: militar[nome], escala_id: escala, servico_id: s.id, turno_id: s.a, data, origem: 'manual' });

beforeAll(async () => {
  api = await montarApi();
  const servicoComTurnos = async (nome: string, tipo: string, turnos: [string, string, string][]) => {
    const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, cor: '#2F8F5B' });
    const t: Record<string, string> = {};
    for (const [letra, inicio, fim] of turnos) t[letra.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
    return { id, a: t.a!, b: t.b! };
  };
  pronto = await servicoComTurnos('Pronto', 'ordinario', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
  jes = await servicoComTurnos('JES', 'pjes', [['A', '08:00', '20:00']]);
  escala = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(api.banco, 'escala_servico', { escala_id: escala, servico_id: pronto.id, ordem: 1 }, 'escala_id');
  await inserir(api.banco, 'escala_servico', { escala_id: escala, servico_id: jes.id, ordem: 2 }, 'escala_id');
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  bravo = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Bravo', ordem_ciclo: 2 });
  const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  let seq = 0;
  const criar = async (nome: string, periodos: { equipe: string; desde: string; ate?: string }[]) => {
    seq++;
    const id = await inserir(api.banco, 'militar', { matricula: `99130${seq}-${seq}`, posto_grad_id: sd, nome_guerra: nome, antiguidade: seq });
    militar[nome] = id;
    for (const p of periodos) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: p.equipe, jornada: 'pronto', desde: p.desde, ate: p.ate ?? null });
  };
  await criar('MUDA', [{ equipe: alfa, desde: '2026-11-01', ate: dia(14) }, { equipe: bravo, desde: dia(15) }]);
  await criar('FIXO', [{ equipe: alfa, desde: '2026-11-01' }]);
  await alocar('MUDA', jes, dia(10));
  await alocar('MUDA', jes, dia(20));
  await alocar('FIXO', jes, dia(10));
  // VOLTA: Alfa, depois Bravo de 15 a 19 e de novo Alfa a partir do dia 20 (o escalante desistiu da mudança)
  await criar('VOLTA', [{ equipe: alfa, desde: '2026-11-01', ate: dia(14) }, { equipe: bravo, desde: dia(15), ate: dia(19) }, { equipe: alfa, desde: dia(20) }]);
  await alocar('VOLTA', jes, dia(5));
  await alocar('VOLTA', jes, dia(17));
  await alocar('VOLTA', jes, dia(25));
});
afterAll(async () => {
  await api.fechar();
});

const lerGrade = async (mes = MES): Promise<GradeDoMes> => (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
const linhas = (g: GradeDoMes, chave: string, nome: string) => g.grupos.find((x) => x.chave === chave)?.linhas.filter((l) => l.nomeGuerra === nome) ?? [];

describe('o rastreio por dia', () => {
  it('quem muda de equipe no dia 15 tem duas linhas na Grade, cada uma nos seus dias e com os seus totais', async () => {
    const g = await lerGrade();
    const naAlfa = linhas(g, alfa, 'MUDA');
    const naBravo = linhas(g, bravo, 'MUDA');
    expect(naAlfa).toHaveLength(1);
    expect(naBravo).toHaveLength(1);
    expect(Object.keys(naAlfa[0]!.dias)).toEqual([dia(10)]);
    expect(Object.keys(naBravo[0]!.dias)).toEqual([dia(20)]);
    expect([naAlfa[0]!.pjes, naBravo[0]!.pjes]).toEqual([1, 1]);
  });

  it('quem muda de equipe e volta à mesma tem uma linha só nela, com os dias dos dois períodos', async () => {
    const g = await lerGrade();
    const naAlfa = linhas(g, alfa, 'VOLTA');
    expect(naAlfa).toHaveLength(1);
    expect(Object.keys(naAlfa[0]!.dias)).toEqual([dia(5), dia(25)]);
    expect(naAlfa[0]!.pjes).toBe(2);
    expect(linhas(g, bravo, 'VOLTA').map((l) => Object.keys(l.dias))).toEqual([[dia(17)]]);
  });

  it('quem não muda continua com uma linha só, com tudo o que tirou', async () => {
    const g = await lerGrade();
    expect(linhas(g, alfa, 'FIXO')).toHaveLength(1);
    expect(Object.keys(linhas(g, alfa, 'FIXO')[0]!.dias)).toEqual([dia(10)]);
    expect(g.grupos.flatMap((x) => x.linhas).filter((l) => l.nomeGuerra === 'FIXO')).toHaveLength(1);
  });

  it('períodos que começam no dia 1 continuam como antes: o mês anterior mostra MUDA só na Alfa', async () => {
    const g = await lerGrade('2026-11');
    expect(linhas(g, alfa, 'MUDA')).toHaveLength(1);
    expect(g.grupos.flatMap((x) => x.linhas).filter((l) => l.nomeGuerra === 'MUDA')).toHaveLength(1);
  });

  it('"Escolher militar" usa a equipe do dia: a antiga no dia 10, a nova no dia 20', async () => {
    const candidatos = async (data: string): Promise<Candidatos> => {
      const q = new URLSearchParams({ data, inicio: '08:00', fim: '20:00' });
      return (await api.pedir('escalante', 'GET', `/api/escalas/${escala}/mes/${MES}/candidatos?${q}`)).json();
    };
    const no10 = [...(await candidatos(dia(11))).aptos, ...(await candidatos(dia(11))).semVoluntariado].find((c) => c.nomeGuerra === 'MUDA');
    const no20 = [...(await candidatos(dia(21))).aptos, ...(await candidatos(dia(21))).semVoluntariado].find((c) => c.nomeGuerra === 'MUDA');
    expect(no10?.equipe).toBe('Alfa');
    expect(no20?.equipe).toBe('Bravo');
  });

  it('a pré-escala do Pronto segue a equipe de cada dia', async () => {
    const { novas } = await planejarPreEscala(api.banco, escala, MES, alfa);
    const dias = (nome: string) => [...new Set(novas.filter((n) => n.militarId === militar[nome]).map((n) => Number(n.data.slice(8))))].sort((x, y) => x - y);
    // ciclo de quatro equipes com a Alfa no dia 1: a Alfa trabalha nos dias 1, 5, 9, 13, 17…; a Bravo, nos dias 2, 6, 10, 14, 18…
    expect(dias('MUDA')).toEqual([1, 5, 9, 13, 18, 22, 26, 30]);
    expect(dias('FIXO')).toEqual([1, 5, 9, 13, 17, 21, 25, 29]);
  });
});

// as listas e a ficha mostram uma situação só por militar: a do dia de hoje (se o mês é o de hoje) ou a do primeiro dia do mês (mês futuro)
describe('uma linha por militar nas listas', () => {
  const hoje = hojeRecife();
  const mesDeHoje = hoje.slice(0, 7);
  const daquiAQuatorze = `${mesDeHoje}-14`;

  it('quem muda de equipe no meio do mês aparece uma vez na lista de Militares, com a equipe de hoje, e a ficha mostra desde quando', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const id = await inserir(api.banco, 'militar', { matricula: '991399-9', posto_grad_id: sd, nome_guerra: 'MUDOU', antiguidade: 9 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: alfa, jornada: 'pronto', desde: `${mesDeHoje}-01`, ate: daquiAQuatorze });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: bravo, jornada: 'pronto', desde: `${mesDeHoje}-15` });
    const esperada = hoje <= daquiAQuatorze ? 'Alfa' : 'Bravo';
    const lista: { nomeGuerra: string; equipe: string | null }[] = await (await api.pedir('escalante', 'GET', `${secao()}/militares?mes=${mesDeHoje}`)).json();
    expect(lista.filter((m) => m.nomeGuerra === 'MUDOU').map((m) => m.equipe)).toEqual([esperada]);
    const peculio: { militares: { nomeGuerra: string }[] } = await (await api.pedir('gestorGb', 'GET', `${secao()}/peculio?mes=${mesDeHoje}`)).json();
    expect(peculio.militares.filter((m) => m.nomeGuerra === 'MUDOU')).toHaveLength(1);
    const ficha = await (await api.pedir('escalante', 'GET', `/api/militares/${id}?mes=${mesDeHoje}`)).json();
    expect(ficha.equipe).toBe(esperada);
    expect(ficha.rastreio).toHaveLength(2);
  });
});
