import { somarMeses } from 'contratos';
import { diasDoMes } from 'dominio';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { avaliarCandidatos, motivoDeFora } from '../src/escala/elegibilidade.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir } from './banco-teste.ts';

// Cenário fictício (D7): seção com Pronto A/B (08h–20h, 20h–08h), "Eleições" (diária, 07h–15h) e "Plantão" (diária, 19h–07h).
// A flexibilidade do voluntariado é um parâmetro em horas cheias; vale a da unidade mais próxima, com vigência até o mês da vaga.
let api: ApiDeTeste;
let escalaId: string;
const turno: Record<string, string> = {};
const servico: Record<string, string> = {};
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const D = `${atual}-10`;
const ULTIMO = diasDoMes(atual).at(-1)!;
const amanha = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
const ontem = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
const ELEICOES = { inicio: '07:00', fim: '15:00' };
const PLANTAO = { inicio: '19:00', fim: '07:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;
const FLEX = 'FLEXIBILIDADE_VOLUNTARIADO_HORAS';

async function criarServico(nome: string, tipo: string, letra: string, faixa: { inicio: string; fim: string }) {
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  const comTurno = await (await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra, ...faixa })).json();
  servico[nome] = s.id;
  turno[`${nome} ${letra}`] = comTurno.turnos.find((t: { letra: string }) => t.letra === letra).id;
}
const faixaMarcada = (nome: string, data: string, inicio: number, fim: number) =>
  inserir(api.banco, 'disponibilidade', { militar_id: militar[nome], data, inicio_min: inicio, fim_min: fim, origem: 'manual' });
const flexibilidade = (unidadeId: string, vigencia: string, horas: number) =>
  inserir(api.banco, 'parametro', { chave: FLEX, unidade_id: unidadeId, vigencia_desde: `${vigencia}-01`, valor: JSON.stringify(horas) });
const vaga = (data: string, faixa: { inicio: string; fim: string }) => ({ escalaId, data, ...faixa, guarnicaoId: null, funcaoId: null });
const motivo = (nome: string, data: string, faixa: { inicio: string; fim: string }, turnoId: string) =>
  motivoDeFora(api.banco, { ...vaga(data, faixa), militarId: militar[nome]!, turnoId });

beforeAll(async () => {
  api = await montarApi();
  const equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  await criarServico('Pronto', 'ordinario', 'A', { inicio: '08:00', fim: '20:00' });
  turno['Pronto B'] = (await (await api.pedir('escalante', 'POST', `/api/servicos/${servico.Pronto}/turnos`, { letra: 'B', inicio: '20:00', fim: '08:00' })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  await criarServico('Eleições', 'diaria', 'A', ELEICOES);
  await criarServico('Plantão', 'diaria', 'A', PLANTAO);
  escalaId = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.Pronto, servico['Eleições'], servico['Plantão']] })).status).toBe(200);
  const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-F', nome: 'Soldado F', ordem: 930 });
  let seq = 0;
  for (const nome of ['OITO16', 'CHOQUE', 'VIRADA', 'VIRADACURTA']) {
    seq++;
    militar[nome] = await inserir(api.banco, 'militar', { matricula: `99${String(4000 + seq).padStart(4, '0')}-${seq}`, posto_grad_id: posto, nome_guerra: nome, motorista: false, cnh: [], voluntario_jes: false, ativo: true });
    await inserir(api.banco, 'rastreio', { militar_id: militar[nome], unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${atual}-01` });
  }
  await faixaMarcada('OITO16', D, 480, 960);
  await faixaMarcada('CHOQUE', D, 480, 960);
  await inserir(api.banco, 'alocacao', { militar_id: militar.CHOQUE, escala_id: escalaId, servico_id: servico.Pronto, turno_id: turno['Pronto B'], data: ontem(D), origem: 'manual' });
  await faixaMarcada('VIRADA', ULTIMO, 1200, 1440);
  await faixaMarcada('VIRADA', amanha(ULTIMO), 0, 360);
  await faixaMarcada('VIRADACURTA', ULTIMO, 1200, 1440);
  await faixaMarcada('VIRADACURTA', amanha(ULTIMO), 0, 300);
});
beforeEach(async () => {
  await api.banco.query('delete from parametro where chave = $1', [FLEX]);
});
afterAll(async () => {
  await api.fechar();
});

const SEM_VOLUNTARIADO = 'Não marcou voluntariado neste horário';

describe('flexibilidade do voluntariado na lista "Escolher militar"', () => {
  it('sem a flexibilidade (padrão 0h), quem marcou 08–16 não cabe no turno das 07h às 15h', async () => {
    expect(await motivo('OITO16', D, ELEICOES, turno['Eleições A']!)).toBe(SEM_VOLUNTARIADO);
    expect((await avaliarCandidatos(api.banco, vaga(D, ELEICOES))).aptos.map((a) => a.nomeGuerra)).not.toContain('OITO16');
  });

  it('com 1h gravada no nível de cima (o GB), a seção herda e o militar aparece (Review Focus 2)', async () => {
    await flexibilidade(api.ids.gb, atual, 1);
    expect(await motivo('OITO16', D, ELEICOES, turno['Eleições A']!)).toBeNull();
    expect((await avaliarCandidatos(api.banco, vaga(D, ELEICOES))).aptos.map((a) => a.nomeGuerra)).toContain('OITO16');
  });

  it('uma mudança com vigência no mês seguinte não altera a lista deste mês (Review Focus 2)', async () => {
    await flexibilidade(api.ids.secao, proximo, 1);
    expect(await motivo('OITO16', D, ELEICOES, turno['Eleições A']!)).toBe(SEM_VOLUNTARIADO);
  });

  it('o valor da seção vale mais que o do nível de cima', async () => {
    await flexibilidade(api.ids.gb, atual, 1);
    await flexibilidade(api.ids.secao, atual, 0);
    expect(await motivo('OITO16', D, ELEICOES, turno['Eleições A']!)).toBe(SEM_VOLUNTARIADO);
  });

  it('turno que atravessa a meia-noite no último dia do mês: com 1h, o 19h às 07h confere 20h até 06h do dia 1 (Review Focus 1)', async () => {
    await flexibilidade(api.ids.secao, atual, 1);
    expect(await motivo('VIRADA', ULTIMO, PLANTAO, turno['Plantão A']!)).toBeNull();
    expect(await motivo('VIRADACURTA', ULTIMO, PLANTAO, turno['Plantão A']!)).toBe(SEM_VOLUNTARIADO);
  });

  it('a flexibilidade não afrouxa choque: quem sai do Pronto B às 08h continua de fora do turno das 07h (spec)', async () => {
    await flexibilidade(api.ids.secao, atual, 1);
    expect(await motivo('CHOQUE', D, ELEICOES, turno['Eleições A']!)).toBe('Choque de horário');
  });

  it('turno que começa às 23h (como o das eleições): com 1h, quem só marcou 00h–06h do dia seguinte é apto (achado da revisão final)', async () => {
    await criarServico('Noite23', 'diaria', 'A', { inicio: '23:00', fim: '07:00' });
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.Pronto, servico['Eleições'], servico['Plantão'], servico.Noite23] })).status).toBe(200);
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD-F'")).rows[0]!.id;
    militar.MEIANOITE = await inserir(api.banco, 'militar', { matricula: '994099-9', posto_grad_id: posto, nome_guerra: 'MEIANOITE', motorista: false, cnh: [], voluntario_jes: false, ativo: true });
    await inserir(api.banco, 'rastreio', { militar_id: militar.MEIANOITE, unidade_id: api.ids.secao, equipe_id: (await api.banco.query<{ id: string }>('select id from equipe limit 1')).rows[0]!.id, jornada: 'pronto', desde: `${atual}-01` });
    await faixaMarcada('MEIANOITE', amanha(D), 0, 360);
    const noite = { inicio: '23:00', fim: '07:00' };
    expect(await motivo('MEIANOITE', D, noite, turno['Noite23 A']!)).toBe(SEM_VOLUNTARIADO);
    await flexibilidade(api.ids.secao, atual, 1);
    expect(await motivo('MEIANOITE', D, noite, turno['Noite23 A']!)).toBeNull();
  });
});

