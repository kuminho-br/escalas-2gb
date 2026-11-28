import type { GradeDoMes, LinhaDaGrade } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { periodosDeAfastamento } from '../src/grade/grade.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Dados fictícios (D7). A Grade traz, por linha, os períodos de afastamento com o tipo (6.70, Task 1).
describe('periodosDeAfastamento', () => {
  const dias = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'];
  const tipos: Record<string, string | null> = { '2026-12-01': 'Férias', '2026-12-02': 'Férias', '2026-12-04': 'Férias', '2026-12-05': 'LTS' };

  it('junta os dias seguidos do mesmo tipo, e separa o que tem um dia livre no meio', () => {
    expect(periodosDeAfastamento(dias, (d) => tipos[d] ?? null)).toEqual([
      { tipo: 'Férias', inicio: '2026-12-01', fim: '2026-12-02' },
      { tipo: 'Férias', inicio: '2026-12-04', fim: '2026-12-04' },
      { tipo: 'LTS', inicio: '2026-12-05', fim: '2026-12-05' },
    ]);
  });

  it('dias seguidos de tipos diferentes viram períodos diferentes', () => {
    expect(periodosDeAfastamento(['2026-12-01', '2026-12-02'], (d) => (d === '2026-12-01' ? 'Férias' : 'Curso'))).toEqual([
      { tipo: 'Férias', inicio: '2026-12-01', fim: '2026-12-01' },
      { tipo: 'Curso', inicio: '2026-12-02', fim: '2026-12-02' },
    ]);
  });

  it('sem afastamento, lista vazia; e a lista de dias que a linha vale pode ter buracos (nunca junta dias que não são seguidos)', () => {
    expect(periodosDeAfastamento(dias, () => null)).toEqual([]);
    expect(periodosDeAfastamento(['2026-12-01', '2026-12-03'], () => 'Férias')).toEqual([
      { tipo: 'Férias', inicio: '2026-12-01', fim: '2026-12-01' },
      { tipo: 'Férias', inicio: '2026-12-03', fim: '2026-12-03' },
    ]);
  });
});

let api: ApiDeTeste;
const MES = '2026-12';
const militar: Record<string, string> = {};
const ler = async (): Promise<GradeDoMes> => {
  const r = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${MES}`);
  expect(r.status).toBe(200);
  return r.json();
};
const linhas = (g: GradeDoMes, nome: string): LinhaDaGrade[] => g.grupos.flatMap((x) => x.linhas).filter((l) => l.nomeGuerra === nome);
const tipoId = async (nome: string) => (await api.banco.query<{ id: string }>('select id from tipo_afastamento where nome = $1', [nome])).rows[0]!.id;

beforeAll(async () => {
  api = await montarApi();
  const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', tipo: 'pronto', posicao_ciclo: 1 });
  const bravo = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Bravo', tipo: 'pronto', posicao_ciclo: 2 });
  let seq = 0;
  const criar = async (nome: string, periodos: { equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }[]) => {
    seq++;
    const id = await inserir(api.banco, 'militar', { matricula: `99140${seq}-${seq}`, posto_grad_id: sd, nome_guerra: nome });
    militar[nome] = id;
    for (const p of periodos) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: p.equipe, jornada: p.jornada, desde: p.desde, ate: p.ate });
  };
  await criar('CRUZA', [{ equipe: alfa, jornada: 'pronto', desde: '2026-11-01', ate: null }]);
  await criar('LIVRE', [{ equipe: alfa, jornada: 'pronto', desde: '2026-11-01', ate: null }]);
  await criar('DUAS', [
    { equipe: alfa, jornada: 'pronto', desde: '2026-11-01', ate: '2026-12-14' },
    { equipe: bravo, jornada: 'pronto', desde: '2026-12-15', ate: null },
  ]);
  await criar('MESTODO', [{ equipe: bravo, jornada: 'pronto', desde: '2026-11-01', ate: null }]);
  // atravessa o mês: de 28/11 a 03/12
  await inserir(api.banco, 'afastamento', { militar_id: militar.CRUZA, tipo_afastamento_id: await tipoId('Férias'), inicio: '2026-11-28', fim: '2026-12-03' });
  // no meio da troca de equipe: 10 a 20/12, com a linha da Alfa até o dia 14 e a da Bravo a partir do 15
  await inserir(api.banco, 'afastamento', { militar_id: militar.DUAS, tipo_afastamento_id: await tipoId('LTS'), inicio: '2026-12-10', fim: '2026-12-20' });
  // o mês todo e mais
  await inserir(api.banco, 'afastamento', { militar_id: militar.MESTODO, tipo_afastamento_id: await tipoId('Curso'), inicio: '2026-11-15', fim: '2027-01-15' });
});
afterAll(() => api.fechar());

describe('a Grade traz os afastamentos de cada linha', () => {
  it('quem não tem afastamento traz a lista vazia (sempre presente)', async () => {
    expect(linhas(await ler(), 'LIVRE')[0]!.afastamentos).toEqual([]);
  });

  it('Review Focus 1: o que atravessa o mês vem recortado ao mês (para a marca) e com o período inteiro (para a dica)', async () => {
    expect(linhas(await ler(), 'CRUZA')[0]!.afastamentos).toEqual([{ tipo: 'Férias', inicio: '2026-12-01', fim: '2026-12-03', inicioReal: '2026-11-28', fimReal: '2026-12-03' }]);
  });

  it('o afastamento do mês todo cobre o mês inteiro e traz as datas reais, de fora do mês', async () => {
    expect(linhas(await ler(), 'MESTODO')[0]!.afastamentos).toEqual([{ tipo: 'Curso', inicio: '2026-12-01', fim: '2026-12-31', inicioReal: '2026-11-15', fimReal: '2027-01-15' }]);
  });

  it('Review Focus 1: o militar com duas linhas no mês: cada linha só com os dias dela, e o período inteiro nos dois', async () => {
    const g = await ler();
    const duas = linhas(g, 'DUAS');
    expect(duas).toHaveLength(2);
    const daAlfa = duas.find((l) => g.grupos.find((x) => x.nome === 'Alfa')!.linhas.includes(l))!;
    const daBravo = duas.find((l) => g.grupos.find((x) => x.nome === 'Bravo')!.linhas.includes(l))!;
    expect(daAlfa.afastamentos).toEqual([{ tipo: 'LTS', inicio: '2026-12-10', fim: '2026-12-14', inicioReal: '2026-12-10', fimReal: '2026-12-20' }]);
    expect(daBravo.afastamentos).toEqual([{ tipo: 'LTS', inicio: '2026-12-15', fim: '2026-12-20', inicioReal: '2026-12-10', fimReal: '2026-12-20' }]);
  });

  it('renomear o tipo muda o texto na Grade', async () => {
    await api.banco.query("update tipo_afastamento set nome = 'Licença especial' where nome = 'Curso'");
    expect(linhas(await ler(), 'MESTODO')[0]!.afastamentos[0]!.tipo).toBe('Licença especial');
  });
});
