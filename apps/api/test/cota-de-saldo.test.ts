import type { Candidatos, EscalaDoMes, GradeDoMes } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.38, Task 7: a cota de saldo do Adm à vista (quantos Saldos o militar já tem no mês, de quanto é a cota). Cenário fictício (D7).
let api: ApiDeTeste;
let outraSecao: string;
let escalaId: string;
let servicoSaldo: string;
let turnoSaldo: string;
let servicoPronto: string;
let turnoPronto: string;
let abt: string;
let combatente: string;
const atual = hojeRecife().slice(0, 7);
const dias = diasDoMes(atual);
const fimDeSemana = dias.filter((d) => diaDaSemana(d) === 0 || diaDaSemana(d) === 6); // sem expediente: o Saldo não choca
const militar: Record<string, string> = {};
let seq = 0;

async function criar(nome: string, jornada: 'pronto' | 'adm', unidade = api.ids.secao): Promise<string> {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `99${String(7000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, voluntario_jes: true });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidade, jornada, desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
  militar[nome] = id;
  return id;
}
const saldo = (nome: string, data: string, extra: Record<string, unknown> = {}) =>
  inserir(api.banco, 'alocacao', { militar_id: militar[nome], escala_id: escalaId, servico_id: servicoSaldo, turno_id: turnoSaldo, data, origem: 'manual', ...extra });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  const servico = async (unidadeId: string, nome: string, tipo: string) => {
    const id = ((await (await api.pedir('admin', 'POST', `/api/unidades/${unidadeId}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2B7BB9' })).json()) as { id: string }).id;
    const t = (await (await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id as string;
    return { id, turno: t };
  };
  const s = await servico(api.ids.secao, 'Saldo', 'ordinario');
  servicoSaldo = s.id;
  turnoSaldo = s.turno;
  const p = await servico(api.ids.secao, 'Pronto', 'ordinario');
  servicoPronto = p.id;
  turnoPronto = p.turno;
  escalaId = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Ordinário' })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: [servicoSaldo, servicoPronto] })).status).toBe(200);
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  abt = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/guarnicoes`, {
    nome: 'ABT', vigencia: atual,
    versao: { viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [{ funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }] },
  })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, inicio: '08:00', fim: '20:00' }] })).status).toBe(200);
  expect(fimDeSemana.length).toBeGreaterThanOrEqual(8);
  await criar('ADMDOIS', 'adm');
  await criar('ADMSETE', 'adm');
  await criar('ADMZERO', 'adm');
  await criar('PRONTO', 'pronto');
  await criar('ADMDEFORA', 'adm', outraSecao);
  // dois saldos para o ADMDOIS (um deles numa escala da outra seção conta também: a cota é do militar, não da escala)
  await saldo('ADMDOIS', fimDeSemana[0]!, { guarnicao_id: abt, funcao_id: combatente });
  const saldoDeFora = ((await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/servicos`, { nome: 'Saldo', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2B7BB9' })).json()) as { id: string }).id;
  const turnoDeFora = (await (await api.pedir('admin', 'POST', `/api/servicos/${saldoDeFora}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id as string;
  const escalaDeFora = ((await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/escalas`, { nome: 'Ordinário 2ª SB' })).json()) as { id: string }).id;
  await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [escalaDeFora, saldoDeFora]);
  await inserir(api.banco, 'alocacao', { militar_id: militar.ADMDOIS, escala_id: escalaDeFora, servico_id: saldoDeFora, turno_id: turnoDeFora, data: fimDeSemana[1]!, origem: 'manual' });
  // o Pronto não conta como saldo
  await inserir(api.banco, 'alocacao', { militar_id: militar.ADMDOIS, escala_id: escalaId, servico_id: servicoPronto, turno_id: turnoPronto, data: fimDeSemana[2]!, origem: 'manual' });
  // sete saldos (um acima da cota de 6) para o ADMSETE
  for (let i = 0; i < 7; i++) await saldo('ADMSETE', fimDeSemana[i]!);
});
afterAll(async () => {
  await api.fechar();
});

describe('a cota de saldo na lista de candidatos', () => {
  const candidatos = async (data: string): Promise<Candidatos> => {
    const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${data}&inicio=08:00&fim=20:00&guarnicaoId=${abt}&funcaoId=${combatente}`);
    expect(r.status).toBe(200);
    return r.json();
  };

  it('só o militar do Adm traz a cota: os saldos do mês em qualquer escala e o total do parâmetro (6)', async () => {
    const lista = await candidatos(fimDeSemana[5]!);
    const por = (nome: string) => lista.aptos.find((a) => a.nomeGuerra === nome)!;
    expect(por('ADMDOIS').saldos).toEqual({ feitos: 2, total: 6 });
    expect(por('ADMZERO').saldos).toEqual({ feitos: 0, total: 6 });
    expect('saldos' in por('PRONTO')).toBe(false);
  });

  it('Review Focus 5: acima do total, o número passa (7 de 6): a API não corta nem trava', async () => {
    const lista = await candidatos(fimDeSemana[7]!);
    expect(lista.aptos.find((a) => a.nomeGuerra === 'ADMSETE')!.saldos).toEqual({ feitos: 7, total: 6 });
  });

  it('quem está de expediente (em choque) também traz a cota', async () => {
    const util = dias.find((d) => d > `${atual}-02` && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5)!;
    const lista = await candidatos(util);
    expect(lista.emChoque.find((e) => e.nomeGuerra === 'ADMZERO')!.saldos).toEqual({ feitos: 0, total: 6 });
  });
});

describe('a cota de saldo na escala do mês e na Grade geral', () => {
  it('o ocupante de Saldo do Adm traz a cota ("2/6"); quem não é Saldo não traz', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}`);
    const escala = (await r.json()) as EscalaDoMes;
    const ocupantes = escala.dias.flatMap((d) => d.faixas.flatMap((f) => f.guarnicoes.flatMap((g) => g.funcoes.flatMap((fn) => fn.ocupantes))));
    const doSaldo = ocupantes.find((o) => o.nomeGuerra === 'ADMDOIS' && o.servico.nome === 'Saldo')!;
    expect(doSaldo.saldos).toEqual({ feitos: 2, total: 6 });
    expect(ocupantes.filter((o) => o.servico.nome !== 'Saldo').every((o) => !('saldos' in o))).toBe(true);
  });

  it('a linha do Adm na Grade traz a cota do mês; a do Pronto, não', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}`);
    const grade = (await r.json()) as GradeDoMes;
    const linha = (nome: string) => grade.grupos.flatMap((g) => g.linhas).find((l) => l.nomeGuerra === nome)!;
    expect(linha('ADMDOIS').saldos).toEqual({ feitos: 2, total: 6 });
    expect(linha('ADMSETE').saldos).toEqual({ feitos: 7, total: 6 });
    expect('saldos' in linha('PRONTO')).toBe(false);
  });
});
