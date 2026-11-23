import type { Candidatos, GradeDoMes, VoluntariadoDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { motivoDeFora } from '../src/escala/elegibilidade.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): 1ª SB com Pronto A/B; um SD (QBMG), um MAJ sem quadro e dois CAP (QOC), todos do Pronto da equipe Alfa.
let api: ApiDeTeste;
let escalaId: string;
let servico: string;
let turnoA: string;
const militar: Record<string, string> = {};
const mes = hojeRecife().slice(0, 7);
const dia = `${mes}-10`;
const secao = () => `/api/unidades/${api.ids.secao}`;
const FAIXA = { inicio: '08:00', fim: '20:00' };
let seq = 0;

async function criar(nome: string, postoSigla: string, quadroSigla: string | null, equipe: string) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [postoSigla])).rows[0]!.id;
  const quadro = quadroSigla ? (await api.banco.query<{ id: string }>('select id from quadro where sigla = $1', [quadroSigla])).rows[0]!.id : null;
  const id = await inserir(api.banco, 'militar', { matricula: `9905${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${mes}-01`, quadro_id: quadro });
  militar[nome] = id;
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const bravo = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Bravo', ordem_ciclo: 2 });
  servico = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'A', inicio: FAIXA.inicio, fim: FAIXA.fim });
  await inserir(api.banco, 'turno', { servico_id: servico, letra: 'B', inicio: '20:00', fim: '08:00' });
  escalaId = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(api.banco, 'escala_servico', { escala_id: escalaId, servico_id: servico, ordem: 1 }, 'escala_id');
  await criar('SOLDADO', 'SD BM', 'QBMG', alfa);
  await criar('MAJOR', 'MAJ BM', null, alfa);
  await criar('CAPITAO', 'CAP BM', 'QOC', alfa);
  await criar('CAPOFICIAL', 'CAP BM', 'QOA', alfa);
  await criar('CAPBRAVO', 'CAP BM', 'QOC', bravo); // a equipe Bravo só tem um oficial
});
afterAll(async () => {
  await api.fechar();
});

const nomesDaGrade = (g: GradeDoMes) => g.grupos.flatMap((x) => x.linhas.map((l) => l.nomeGuerra)).sort();

describe('só o QBMG (e quem está sem quadro) nas telas de escala de praças', () => {
  it('a Grade do mês lista o SD e o MAJ, e não os oficiais', async () => {
    const g: GradeDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
    expect(nomesDaGrade(g)).toEqual(['MAJOR', 'SOLDADO']);
  });

  it('o oficial com alocação gravada no mês continua na Grade desse mês', async () => {
    await inserir(api.banco, 'alocacao', { militar_id: militar.CAPITAO, escala_id: escalaId, servico_id: servico, turno_id: turnoA, data: dia, origem: 'manual' });
    const g: GradeDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
    expect(nomesDaGrade(g)).toEqual(['CAPITAO', 'MAJOR', 'SOLDADO']);
    // fica na parte "de fora escalados aqui", e não no grupo da equipe com as praças
    expect(g.grupos.find((x) => x.chave === 'outras')?.linhas.map((l) => l.nomeGuerra)).toEqual(['CAPITAO']);
    expect(g.grupos.filter((x) => x.chave !== 'outras').flatMap((x) => x.linhas.map((l) => l.nomeGuerra))).not.toContain('CAPITAO');
  });

  it('um oficial lotado aqui com alocação só em outra seção não ganha linha na Grade daqui', async () => {
    const outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEC-P14', nome: 'Seção P14', mae_id: api.ids.gb, desde: `${mes}-01` });
    const servicoFora = await inserir(api.banco, 'servico', { unidade_id: outraSecao, nome: 'Pronto fora', tipo: 'ordinario', cor: '#2F8F5B' });
    const turnoFora = await inserir(api.banco, 'turno', { servico_id: servicoFora, letra: 'A', inicio: '08:00', fim: '20:00' });
    const escalaFora = await inserir(api.banco, 'escala', { unidade_id: outraSecao, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
    await inserir(api.banco, 'escala_servico', { escala_id: escalaFora, servico_id: servicoFora, ordem: 1 }, 'escala_id');
    await inserir(api.banco, 'alocacao', { militar_id: militar.CAPOFICIAL, escala_id: escalaFora, servico_id: servicoFora, turno_id: turnoFora, data: `${mes}-11`, origem: 'manual' });
    const g: GradeDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
    expect(nomesDaGrade(g)).not.toContain('CAPOFICIAL');
  });

  it('os candidatos de uma vaga são o SD e o MAJ, sem os oficiais', async () => {
    const q = new URLSearchParams({ data: `${mes}-12`, ...FAIXA });
    const c: Candidatos = await (await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${mes}/candidatos?${q}`)).json();
    const nomes = [...c.aptos, ...c.semVoluntariado].map((x) => x.nomeGuerra).sort();
    expect(nomes).toEqual(['MAJOR', 'SOLDADO']);
  });

  it('a elegibilidade de um oficial numa vaga dá o motivo, sem erro', async () => {
    const m = await motivoDeFora(api.banco, { escalaId, data: `${mes}-12`, ...FAIXA, guarnicaoId: null, funcaoId: null, militarId: militar.CAPOFICIAL!, turnoId: turnoA });
    expect(m).toBe('Oficial: fica na escala dos oficiais.');
  });

  it('a pré-escala não conta oficial como membro da equipe', async () => {
    const alfa = (await api.banco.query<{ id: string }>("select id from equipe where nome = 'Alfa'")).rows[0]!.id;
    const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${mes}/pre-escala?equipe=${alfa}`);
    expect(r.status).toBe(200);
    const previa: { avisos: string[] } = await r.json();
    expect(previa.avisos.some((a) => a.includes('A equipe Bravo não tem militares do Pronto na seção'))).toBe(true);
    expect(previa.avisos.some((a) => a.includes('Alfa'))).toBe(false);
  });

  it('o Voluntariado do mês lista o SD e o MAJ, e não os oficiais', async () => {
    const v: VoluntariadoDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/voluntariado/${mes}`)).json();
    expect(v.militares.map((m) => m.nomeGuerra).sort()).toEqual(['MAJOR', 'SOLDADO']);
  });

  it('o cadastro de Militares continua listando todos os quadros', async () => {
    const r = await api.pedir('gestorGb', 'GET', `${secao()}/militares`);
    expect(r.status).toBe(200);
    const lista: { nomeGuerra: string }[] = await r.json();
    expect(lista.map((m) => m.nomeGuerra).sort()).toEqual(['CAPBRAVO', 'CAPITAO', 'CAPOFICIAL', 'MAJOR', 'SOLDADO']);
  });

  it('promoção de QBMG para QOA: sai das telas dos meses sem alocação', async () => {
    await criar('PROMOVIDO', 'SD BM', 'QBMG', (await api.banco.query<{ id: string }>("select id from equipe where nome = 'Alfa'")).rows[0]!.id);
    const antes: GradeDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
    expect(nomesDaGrade(antes)).toContain('PROMOVIDO');
    const qoa = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QOA'")).rows[0]!.id;
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = '2º TEN BM'")).rows[0]!.id;
    await api.banco.query('update militar set posto_grad_id = $2 where id = $1', [militar.PROMOVIDO, posto]);
    await api.banco.query('update rastreio set quadro_id = $2 where militar_id = $1', [militar.PROMOVIDO, qoa]);
    const depois: GradeDoMes = await (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
    expect(nomesDaGrade(depois)).not.toContain('PROMOVIDO');
  });
});
