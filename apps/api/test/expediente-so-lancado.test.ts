import type { Candidatos } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';

// 6.71: o expediente do Adm é só o serviço "Expediente" lançado pela pré-escala. Sem pré-escala, nada choca com expediente; a API não monta mais o expediente calculado.
// Cenário fictício: uma seção com Pronto (A 08h–20h), JES (A 08h–20h, na mesma faixa), Saldo (A 08h–20h, que tira do expediente) e Expediente (A 08h–16h).
let api: ApiDeTeste;
let escalaId: string;
const servico: Record<string, { id: string; turno: string }> = {};
const atual = hojeRecife().slice(0, 7);
let uteis: string[] = [];
const dia = (n: number) => uteis[n]!;
let seq = 0;

async function criar(nome: string, jornada: 'pronto' | 'adm' = 'adm'): Promise<string> {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `100${String(700 + seq).padStart(3, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, voluntario_jes: true, de_teste: true });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, jornada, desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
  return id;
}
const lancarExpediente = (militarId: string, data: string) =>
  inserir(api.banco, 'alocacao', { militar_id: militarId, escala_id: null, servico_id: servico.Expediente!.id, turno_id: servico.Expediente!.turno, data, origem: 'pre_escala' });
const escalarAqui = (militarId: string, nome: string, data: string, resolverChoque?: unknown) =>
  api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId, data, turnoId: servico[nome]!.turno, guarnicaoId: null, funcaoId: null, ...(resolverChoque ? { resolverChoque } : {}) });
const candidatos = async (data: string): Promise<Candidatos> => {
  const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${data.slice(0, 7)}/candidatos?data=${data}&inicio=08:00&fim=20:00`);
  expect(r.status).toBe(200);
  return r.json();
};
const doMilitar = async (militarId: string, data: string) =>
  (await api.banco.query<{ nome: string }>('select s.nome from alocacao a join servico s on s.id = a.servico_id where a.militar_id = $1 and a.data = $2::date order by s.nome', [militarId, data])).rows.map((r) => r.nome);

beforeAll(async () => {
  api = await montarApi();
  const feriados = new Set((await api.banco.query<{ d: string }>("select to_char(data, 'YYYY-MM-DD') as d from feriado")).rows.map((r) => r.d));
  uteis = diasDoMes(atual).filter((d) => d > `${atual}-02` && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5 && !feriados.has(d));
  expect(uteis.length).toBeGreaterThan(10);
  const defs: [string, string, string, string][] = [['Pronto', 'ordinario', '08:00', '20:00'], ['JES', 'pjes', '08:00', '20:00'], ['Saldo', 'ordinario', '08:00', '20:00'], ['Expediente', 'ordinario', '08:00', '16:00']];
  for (const [nome, tipo, inicio, fim] of defs) {
    const id = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
    const turno = (await (await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio, fim })).json()).turnos[0].id as string;
    servico[nome] = { id, turno };
  }
  escalaId = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Ordinário' })).json()) as { id: string }).id;
  // a ordem de escala do cadastro: Pronto, JES, Saldo (o Expediente não é da escala: é lançado pela pré-escala)
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servico.Pronto!.id, servico.JES!.id, servico.Saldo!.id] })).status).toBe(200);
});
afterAll(async () => {
  await api.fechar();
});

describe('Adm sem o expediente lançado (6.71)', () => {
  it('a Grade do mês não traz bloco de expediente e o dia não tem choque', async () => {
    const adm = await criar('ADMLIVRE');
    const grade = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}`)).json()) as { grupos: { linhas: { nomeGuerra: string; dias: Record<string, unknown[]>; choques: string[] }[] }[] };
    const linha = grade.grupos.flatMap((g) => g.linhas).find((l) => l.nomeGuerra === 'ADMLIVRE')!;
    expect(Object.keys(linha.dias)).toEqual([]);
    expect(linha.choques).toEqual([]);
    const painel = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}/militares/${adm}/dias/${dia(3)}`)).json()) as { choques: string[] };
    expect(painel.choques).toEqual([]);
  });

  it('o Saldo e o Pronto aparecem como candidatos livres, sem "De expediente neste dia", na ordem de escala do cadastro', async () => {
    await criar('ADMCANDIDATO');
    const lista = await candidatos(dia(4));
    expect(lista.emChoque.find((e) => e.nomeGuerra === 'ADMCANDIDATO')).toBeUndefined();
    const c = lista.aptos.find((e) => e.nomeGuerra === 'ADMCANDIDATO')!;
    expect(c).toBeDefined();
    expect(c.servicos.map((s) => s.nome)).toEqual(['Pronto', 'Saldo']);
  });

  it('o defeito do JES que virava Saldo: depois de tirar o expediente lançado, o JES escolhido na lista do turno grava JES', async () => {
    const adm = await criar('ADMJES');
    const lancado = await lancarExpediente(adm, dia(9));
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${lancado}`)).status).toBe(200);
    const painel = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}/militares/${adm}/dias/${dia(9)}`)).json()) as { opcoes: { inicio: string; fim: string; servicos: { turnoId: string; nome: string }[] }[] };
    const opcao = painel.opcoes.find((o) => o.inicio === '08:00' && o.fim === '20:00')!;
    expect(opcao.servicos.map((s) => s.nome)).toEqual(['Pronto', 'JES', 'Saldo']);
    const jes = opcao.servicos.find((s) => s.nome === 'JES')!;
    const r = await escalarAqui(adm, 'JES', dia(9));
    expect(r.status).toBe(201);
    expect(jes.turnoId).toBe(servico.JES!.turno);
    expect(await doMilitar(adm, dia(9))).toEqual(['JES']);
  });

  it('o Saldo A entra livre (201), sem tirar nada de ninguém', async () => {
    const adm = await criar('ADMSALDOLIVRE');
    const r = await escalarAqui(adm, 'Saldo', dia(5));
    expect(r.status).toBe(201);
    expect(await doMilitar(adm, dia(5))).toEqual(['Saldo']);
  });
});

describe('Adm com o expediente lançado pela pré-escala (6.71)', () => {
  it('o Saldo dá "De expediente neste dia" com poder de resolver; resolver tira o lançado (remoção devolvível) e escala o Saldo numa transação só', async () => {
    const adm = await criar('ADMLANCADO');
    const lancado = await lancarExpediente(adm, dia(6));
    const c = (await candidatos(dia(6))).emChoque.find((e) => e.nomeGuerra === 'ADMLANCADO')!;
    expect(c.servicos.map((s) => [s.nome, s.choque.tipo, s.choque.podeResolver])).toEqual([['Pronto', 'expediente', false], ['JES', 'expediente', false], ['Saldo', 'expediente', true]]);
    const sem = await escalarAqui(adm, 'Saldo', dia(6));
    expect(sem.status).toBe(409);
    expect((await sem.json()).erro).toBe('De expediente neste dia');
    const r = await escalarAqui(adm, 'Saldo', dia(6), { expediente: true });
    expect(r.status).toBe(201);
    expect((await api.banco.query('select 1 from alocacao where id = $1', [lancado])).rows).toHaveLength(0);
    expect(await doMilitar(adm, dia(6))).toEqual(['Saldo']);
    expect((await api.banco.query('select 1 from remocao where militar_id = $1 and data = $2::date', [adm, dia(6)])).rows).toHaveLength(1);
  });

  it('o Pronto e o JES continuam recusando: 409 "De expediente neste dia" e o expediente fica', async () => {
    const adm = await criar('ADMLANCADO2');
    const lancado = await lancarExpediente(adm, dia(7));
    for (const nome of ['Pronto', 'JES']) {
      const r = await escalarAqui(adm, nome, dia(7), { expediente: true });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('De expediente neste dia');
    }
    expect((await api.banco.query('select 1 from alocacao where id = $1', [lancado])).rows).toHaveLength(1);
  });

  it('a Grade mostra o expediente lançado como um serviço comum (sem o campo do expediente calculado)', async () => {
    const adm = await criar('ADMGRADE');
    await lancarExpediente(adm, dia(8));
    const grade = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}`)).json()) as { grupos: { linhas: { nomeGuerra: string; dias: Record<string, Record<string, unknown>[]> }[] }[] };
    const linha = grade.grupos.flatMap((g) => g.linhas).find((l) => l.nomeGuerra === 'ADMGRADE')!;
    const blocos = linha.dias[dia(8)]!;
    expect(blocos).toHaveLength(1);
    expect((blocos[0]!.servico as { nome: string }).nome).toBe('Expediente');
    expect('expediente' in blocos[0]!).toBe(false);
  });
});
