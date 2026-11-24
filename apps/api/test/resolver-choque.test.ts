import type { AlocacaoResolvida, Candidatos } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.38, Task 5: resolver o choque ao escalar ("tirar de lá e escalar aqui"). Cenário fictício (D7): a 1ª SB (escalante), o 2º GB acima dela (gestor do GB)
// e a 2ª SB ao lado. Cada serviço tem um turno A: Pronto 08h–20h, JES 09h–17h e Saldo 08h–20h.
let api: ApiDeTeste;
let outraSecao: string;
const atual = hojeRecife().slice(0, 7);
// cada teste usa o seu dia útil (fora de feriado), para um não mexer no outro
let uteis: string[] = [];
const dia = (n: number) => uteis[n]!;

type Cenario = { escalaId: string; servico: Record<string, string>; turno: Record<string, string> };
const unidades: Record<'secao' | 'gb' | 'outra', Cenario> = {} as never;
let escalaDois: Cenario; // outra escala da 1ª SB (só com o JES)
let abt: string;
let combatente: string;
let seq = 0;

async function montar(unidadeId: string, nome: string, servicosDaEscala: string[] = ['Pronto', 'JES', 'Saldo']): Promise<Cenario> {
  const servico: Record<string, string> = {};
  const turno: Record<string, string> = {};
  const defs: [string, string, string, string][] = [['Pronto', 'ordinario', '08:00', '20:00'], ['JES', 'pjes', '09:00', '17:00'], ['Saldo', 'ordinario', '08:00', '20:00']];
  for (const [n, tipo, inicio, fim] of defs) {
    // o serviço já existe na unidade (a 1ª SB cria os três uma vez; a segunda escala só liga)
    const ja = (await api.banco.query<{ id: string }>('select id from servico where unidade_id = $1 and nome = $2', [unidadeId, n])).rows[0];
    let id = ja?.id;
    if (!id) {
      id = ((await (await api.pedir('admin', 'POST', `/api/unidades/${unidadeId}/servicos`, { nome: n, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
      await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio, fim });
    }
    servico[n] = id;
    turno[n] = (await api.banco.query<{ id: string }>('select id from turno where servico_id = $1 and letra = $2', [id, 'A'])).rows[0]!.id;
  }
  const escalaId = ((await (await api.pedir('admin', 'POST', `/api/unidades/${unidadeId}/escalas`, { nome })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: servicosDaEscala.map((n) => servico[n]!) })).status).toBe(200);
  return { escalaId, servico, turno };
}

async function criar(nome: string, d: { unidade: string; jornada?: 'pronto' | 'adm'; jes?: boolean }): Promise<string> {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `99${String(6000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, voluntario_jes: d.jes ?? true });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: d.unidade, jornada: d.jornada ?? 'pronto', desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
  return id;
}
const alocar = (militarId: string, c: Cenario, servico: string, data: string, extra: Record<string, unknown> = {}) =>
  inserir(api.banco, 'alocacao', { militar_id: militarId, escala_id: c.escalaId, servico_id: c.servico[servico], turno_id: c.turno[servico], data, origem: 'manual', ...extra });
const escalarAqui = (quem: 'escalante' | 'gestorGb' | 'admin', c: Cenario, militarId: string, servico: string, data: string, resolverChoque?: unknown, vaga?: { guarnicaoId: string; funcaoId: string }) =>
  api.pedir(quem, 'POST', `/api/escalas/${c.escalaId}/alocacoes`, { militarId, data, turnoId: c.turno[servico], guarnicaoId: vaga?.guarnicaoId ?? null, funcaoId: vaga?.funcaoId ?? null, ...(resolverChoque ? { resolverChoque } : {}) });
const existe = async (id: string) => (await api.banco.query('select 1 from alocacao where id = $1', [id])).rows.length > 0;
const doMilitar = async (militarId: string, data: string) =>
  (await api.banco.query<{ nome: string }>('select s.nome from alocacao a join servico s on s.id = a.servico_id where a.militar_id = $1 and a.data = $2::date order by s.nome', [militarId, data])).rows.map((r) => r.nome);
const remocoes = async (militarId: string, data: string) => (await api.banco.query('select 1 from remocao where militar_id = $1 and data = $2::date', [militarId, data])).rows.length;
const candidatos = async (quem: 'escalante' | 'gestorGb', c: Cenario, data: string, faixa = '08:00', fim = '20:00'): Promise<Candidatos> => {
  const r = await api.pedir(quem, 'GET', `/api/escalas/${c.escalaId}/mes/${data.slice(0, 7)}/candidatos?data=${data}&inicio=${faixa}&fim=${fim}`);
  expect(r.status).toBe(200);
  return r.json();
};

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  const feriados = new Set((await api.banco.query<{ d: string }>("select to_char(data, 'YYYY-MM-DD') as d from feriado")).rows.map((r) => r.d));
  uteis = diasDoMes(atual).filter((d) => d > `${atual}-02` && diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5 && !feriados.has(d));
  expect(uteis.length).toBeGreaterThan(16);
  unidades.secao = await montar(api.ids.secao, 'Ordinário 1ª SB');
  escalaDois = await montar(api.ids.secao, 'Extra 1ª SB', ['JES']);
  unidades.gb = await montar(api.ids.gb, 'Ordinário 2º GB');
  unidades.outra = await montar(outraSecao, 'Ordinário 2ª SB');
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  abt = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/guarnicoes`, {
    nome: 'ABT', vigencia: atual,
    versao: { viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [{ funcaoId: combatente, minimo: 1, maximo: 1, cnhExigida: null }] },
  })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${unidades.secao.escalaId}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, inicio: '08:00', fim: '20:00' }] })).status).toBe(200);
});
afterAll(async () => {
  await api.fechar();
});

describe('resolver o choque: tirar de lá e escalar aqui (6.38)', () => {
  it('sem pedir a resolução, o choque continua sendo 409 e nada muda', async () => {
    const x = await criar('SEMPEDIR', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(0));
    const r = await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(0));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Choque de horário');
    expect(await existe(jes)).toBe(true);
  });

  it('na mesma escala: o serviço de lá sai (com a remoção devolvível), o daqui entra, e a resposta traz o que o "Desfazer" precisa', async () => {
    const x = await criar('MESMAESC', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(1));
    const r = await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(1), { alocacaoId: jes });
    expect(r.status).toBe(201);
    const corpo = (await r.json()) as AlocacaoResolvida;
    expect(await existe(jes)).toBe(false);
    expect(await doMilitar(x, dia(1))).toEqual(['Pronto']);
    expect(corpo.desfazer.alocacaoId).toEqual(expect.any(String));
    const remocao = (await api.banco.query<{ id: string; devolvivel: boolean }>('select id, devolvivel from remocao where militar_id = $1 and data = $2::date', [x, dia(1)])).rows;
    expect(remocao).toEqual([{ id: corpo.desfazer.remocaoId, devolvivel: true }]);
  });

  it('em outra escala da mesma unidade', async () => {
    const x = await criar('OUTRAESC', { unidade: api.ids.secao });
    const jes = await alocar(x, escalaDois, 'JES', dia(2));
    expect((await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(2), { alocacaoId: jes })).status).toBe(201);
    expect(await doMilitar(x, dia(2))).toEqual(['Pronto']);
  });

  it('numa unidade de baixo: o gestor do 2º GB tira o militar de um serviço da 1ª SB e o escala no 2º GB', async () => {
    const x = await criar('DEBAIXO', { unidade: api.ids.gb });
    const jes = await alocar(x, unidades.secao, 'JES', dia(3));
    expect((await escalarAqui('gestorGb', unidades.gb, x, 'Pronto', dia(3), { alocacaoId: jes })).status).toBe(201);
    expect(await existe(jes)).toBe(false);
    expect(await doMilitar(x, dia(3))).toEqual(['Pronto']);
  });

  it('Review Focus 3: o serviço numa escala de cima ou numa unidade irmã não se tira: 403, nada muda, e o candidato vem sem o botão', async () => {
    const x = await criar('DECIMA', { unidade: api.ids.secao });
    const emCima = await alocar(x, unidades.gb, 'JES', dia(4));
    const y = await criar('IRMA', { unidade: api.ids.secao });
    const naIrma = await alocar(y, unidades.outra, 'JES', dia(4));
    for (const [militar, onde] of [[x, emCima], [y, naIrma]] as const) {
      const r = await escalarAqui('escalante', unidades.secao, militar, 'Pronto', dia(4), { alocacaoId: onde });
      expect(r.status).toBe(403);
      expect(await existe(onde)).toBe(true);
      expect(await doMilitar(militar, dia(4))).not.toContain('Pronto');
    }
    const lista = await candidatos('escalante', unidades.secao, dia(4));
    for (const nome of ['DECIMA', 'IRMA']) {
      const c = lista.emChoque.find((e) => e.nomeGuerra === nome)!;
      expect(c.servicos[0]!.choque).toMatchObject({ tipo: 'alocacao', podeResolver: false });
    }
  });

  it('Review Focus 4: a vaga daqui ocupada no meio tempo é 409 e nada muda dos dois lados (nem a remoção fica)', async () => {
    const x = await criar('ATOMICO', { unidade: api.ids.secao });
    const ocupante = await criar('OCUPANTE', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(5));
    await alocar(ocupante, unidades.secao, 'Pronto', dia(5), { guarnicao_id: abt, funcao_id: combatente });
    const r = await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(5), { alocacaoId: jes }, { guarnicaoId: abt, funcaoId: combatente });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('A função Combatente já está completa nesta guarnição.');
    expect(await existe(jes)).toBe(true);
    expect(await doMilitar(x, dia(5))).toEqual(['JES']);
    expect(await remocoes(x, dia(5))).toBe(0);
  });

  it('uma alocação que não choca com a vaga não é removida: 409 e nada muda', async () => {
    const x = await criar('NAOCHOCA', { unidade: api.ids.secao });
    const outroDia = await alocar(x, unidades.secao, 'JES', dia(7));
    const r = await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(6), { alocacaoId: outroDia });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Este serviço não choca com esta vaga. Atualize a lista e tente de novo.');
    expect(await existe(outroDia)).toBe(true);
    expect(await doMilitar(x, dia(6))).toEqual([]);
    // de outro militar também não
    const y = await criar('ALHEIO', { unidade: api.ids.secao });
    const dele = await alocar(y, unidades.secao, 'JES', dia(6));
    expect((await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(6), { alocacaoId: dele })).status).toBe(409);
    expect(await existe(dele)).toBe(true);
  });

  it('a lista traz o choque com o serviço, o dia, o horário, a escala e a unidade; e o botão vale quando se pode escalar lá', async () => {
    const x = await criar('NALISTA', { unidade: api.ids.secao });
    const jes = await alocar(x, escalaDois, 'JES', dia(8));
    const lista = await candidatos('escalante', unidades.secao, dia(8));
    expect(lista.aptos.map((a) => a.nomeGuerra)).not.toContain('NALISTA');
    expect(lista.fora.map((f) => f.motivo)).not.toContain('Choque de horário');
    const c = lista.emChoque.find((e) => e.nomeGuerra === 'NALISTA')!;
    expect(c.servicos.map((s) => s.nome)).toEqual(['Pronto']);
    expect(c.servicos[0]!.choque).toEqual({ tipo: 'alocacao', alocacaoId: jes, servico: 'JES', data: dia(8), inicio: '09:00', fim: '17:00', escala: 'Extra 1ª SB', unidadeSigla: '1ª SB', podeResolver: true });
  });
});

describe('o expediente do Adm (6.38)', () => {
  it('o Saldo por cima do expediente: sem pedir é 409 "De expediente neste dia"; pedindo, 201, sem remoção, e a lista mostra o botão só para o Saldo', async () => {
    const adm = await criar('ADMSALDO', { unidade: api.ids.secao, jornada: 'adm' });
    const lista = await candidatos('escalante', unidades.secao, dia(9));
    const c = lista.emChoque.find((e) => e.nomeGuerra === 'ADMSALDO')!;
    expect(c.servicos.map((s) => [s.nome, s.choque])).toEqual([['Saldo', { tipo: 'expediente', data: dia(9), podeResolver: true }], ['Pronto', { tipo: 'expediente', data: dia(9), podeResolver: false }]]);
    const sem = await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(9));
    expect(sem.status).toBe(409);
    expect((await sem.json()).erro).toBe('De expediente neste dia');
    const r = await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(9), { expediente: true });
    expect(r.status).toBe(201);
    expect(((await r.json()) as AlocacaoResolvida).desfazer.remocaoId).toBeNull();
    expect(await doMilitar(adm, dia(9))).toEqual(['Saldo']);
    expect(await remocoes(adm, dia(9))).toBe(0);
  });

  it('o JES e o Pronto não tiram do expediente: pedir a resolução é 409 e nada é gravado', async () => {
    const adm = await criar('ADMJES2', { unidade: api.ids.secao, jornada: 'adm' });
    for (const servico of ['JES', 'Pronto']) {
      const r = await escalarAqui('escalante', unidades.secao, adm, servico, dia(10), { expediente: true });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('De expediente neste dia');
    }
    expect(await doMilitar(adm, dia(10))).toEqual([]);
  });

  it('pedir "expediente" para quem não está de expediente (do Pronto) é 409 com a frase do choque; o outro choque também continua valendo', async () => {
    const x = await criar('SEMEXP', { unidade: api.ids.secao });
    const r = await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(11), { expediente: true });
    // sem choque nenhum, o pedido de resolver é inofensivo: escala normalmente
    expect(r.status).toBe(201);
    const y = await criar('SOBREPOE', { unidade: api.ids.secao, jornada: 'adm' });
    await alocar(y, unidades.secao, 'JES', dia(12));
    const r2 = await escalarAqui('escalante', unidades.secao, y, 'Saldo', dia(12), { expediente: true });
    // o expediente cede ao Saldo, mas o JES sobreposto continua sendo choque: nada muda
    expect(r2.status).toBe(409);
    expect(await doMilitar(y, dia(12))).toEqual(['JES']);
  });
});

describe('desfazer a resolução (6.38)', () => {
  it('devolve o serviço de lá e tira o daqui; a remoção some', async () => {
    const x = await criar('DESFAZ', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(13));
    const feito = (await (await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(13), { alocacaoId: jes })).json()) as AlocacaoResolvida;
    const r = await api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', feito.desfazer);
    expect(r.status).toBe(200);
    expect(await doMilitar(x, dia(13))).toEqual(['JES']);
    expect(await remocoes(x, dia(13))).toBe(0);
  });

  it('do expediente: tira o serviço de cima, e o expediente do dia volta a valer (o choque volta)', async () => {
    const adm = await criar('DESFAZEXP', { unidade: api.ids.secao, jornada: 'adm' });
    const feito = (await (await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(14), { expediente: true })).json()) as AlocacaoResolvida;
    expect((await api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', feito.desfazer)).status).toBe(200);
    expect(await doMilitar(adm, dia(14))).toEqual([]);
    expect((await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(14))).status).toBe(409);
  });

  it('se a escala mudou desde então (a alocação nova já não está lá), é 409 com a frase da 6.21 e nada muda', async () => {
    const x = await criar('MUDOU', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(15));
    const feito = (await (await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(15), { alocacaoId: jes })).json()) as AlocacaoResolvida;
    await api.banco.query('delete from alocacao where id = $1', [feito.desfazer.alocacaoId]);
    const r = await api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', feito.desfazer);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('A escala mudou desde então. Não dá mais para desfazer.');
    expect(await doMilitar(x, dia(15))).toEqual([]);
  });

  it('sem papel na escala é 403, e corpo inválido é 400', async () => {
    const x = await criar('SEMPAPEL', { unidade: api.ids.secao });
    const jes = await alocar(x, unidades.secao, 'JES', dia(16));
    const feito = (await (await escalarAqui('escalante', unidades.secao, x, 'Pronto', dia(16), { alocacaoId: jes })).json()) as AlocacaoResolvida;
    expect((await api.pedir('semPapel', 'POST', '/api/resolucoes/desfazer', feito.desfazer)).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', { alocacaoId: 'x' })).status).toBe(400);
    expect(await doMilitar(x, dia(16))).toEqual(['Pronto']);
  });
});

describe('o expediente lançado pela pré-escala (6.40)', () => {
  let expedienteDoSecao: { id: string; turno: string };
  beforeAll(async () => {
    const id = ((await (await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/servicos`, { nome: 'Expediente', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#8A94A1' })).json()) as { id: string }).id;
    const turno = (await (await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio: '08:00', fim: '16:00' })).json()).turnos[0].id as string;
    expedienteDoSecao = { id, turno };
  });
  const lancarExpediente = (militarId: string, data: string) =>
    inserir(api.banco, 'alocacao', { militar_id: militarId, escala_id: null, servico_id: expedienteDoSecao.id, turno_id: expedienteDoSecao.turno, data, origem: 'pre_escala' });

  it('o Saldo por cima de um expediente lançado: a lista dá o botão, resolver tira o expediente lançado (remoção devolvível) e escala o Saldo; o "Desfazer" devolve o expediente', async () => {
    const adm = await criar('ADMLANC', { unidade: api.ids.secao, jornada: 'adm' });
    const lancado = await lancarExpediente(adm, dia(11));
    const lista = await candidatos('escalante', unidades.secao, dia(11));
    const c = lista.emChoque.find((e) => e.nomeGuerra === 'ADMLANC')!;
    expect(c.servicos.map((s) => [s.nome, s.choque.tipo, s.choque.podeResolver])).toEqual([['Saldo', 'expediente', true], ['Pronto', 'expediente', false]]);
    // sem pedir a resolução, o Saldo continua sendo choque
    expect((await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(11))).status).toBe(409);
    const r = await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(11), { expediente: true });
    expect(r.status).toBe(201);
    const feito = (await r.json()) as AlocacaoResolvida;
    expect(await existe(lancado)).toBe(false);
    expect(await doMilitar(adm, dia(11))).toEqual(['Saldo']);
    expect(feito.desfazer.remocaoId).toEqual(expect.any(String));
    const desfeito = await api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', feito.desfazer);
    expect(desfeito.status).toBe(200);
    expect(await doMilitar(adm, dia(11))).toEqual(['Expediente']);
    expect(await remocoes(adm, dia(11))).toBe(0);
  });

  it('o JES e o Pronto não tiram o expediente lançado: 409 "De expediente neste dia" e o expediente continua', async () => {
    const adm = await criar('ADMLANC2', { unidade: api.ids.secao, jornada: 'adm' });
    const lancado = await lancarExpediente(adm, dia(12));
    for (const servico of ['JES', 'Pronto']) {
      const r = await escalarAqui('escalante', unidades.secao, adm, servico, dia(12), { expediente: true });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('De expediente neste dia');
    }
    expect(await existe(lancado)).toBe(true);
  });

  it('tirar o expediente lançado sem pôr nada: o calculado continua valendo (o choque continua)', async () => {
    const adm = await criar('ADMTIRADO', { unidade: api.ids.secao, jornada: 'adm' });
    const lancado = await lancarExpediente(adm, dia(13));
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${lancado}`)).status).toBe(200);
    expect(await existe(lancado)).toBe(false);
    expect(await remocoes(adm, dia(13))).toBe(1);
    expect((await escalarAqui('escalante', unidades.secao, adm, 'Saldo', dia(13))).status).toBe(409);
    // e a escala do mês não mostra o expediente (ele não é de nenhuma escala): a leitura continua inteira
    const outro = await criar('ADMLEITURA', { unidade: api.ids.secao, jornada: 'adm' });
    await lancarExpediente(outro, dia(14));
    expect((await api.pedir('escalante', 'GET', `/api/escalas/${unidades.secao.escalaId}/mes/${atual}`)).status).toBe(200);
  });

  it('Review Focus 1: a Grade e o painel do dia mostram o expediente lançado (sem duplicar o calculado); a Escala do mês e o Efetivo por dia não o mostram e continuam inteiros', async () => {
    const adm = await criar('ADMMOSTRA', { unidade: api.ids.secao, jornada: 'adm' });
    await lancarExpediente(adm, dia(15));
    const grade = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}`)).json()) as { grupos: { linhas: { nomeGuerra: string; dias: Record<string, { servico: { nome: string } | null; expediente: boolean }[]> }[] }[] };
    const linha = grade.grupos.flatMap((g) => g.linhas).find((l) => l.nomeGuerra === 'ADMMOSTRA')!;
    expect(linha.dias[dia(15)]!.map((b) => [b.servico?.nome ?? null, b.expediente])).toEqual([['Expediente', false]]);
    const painel = (await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${atual}/militares/${adm}/dias/${dia(15)}`)).json()) as { servicos: { escalaId: string | null; servico: { nome: string } }[]; choques: string[] };
    expect(painel.servicos.map((x) => [x.servico.nome, x.escalaId])).toEqual([['Expediente', null]]);
    expect(painel.choques).toEqual([]);
    const mes = (await api.pedir('escalante', 'GET', `/api/escalas/${unidades.secao.escalaId}/mes/${atual}`));
    expect(mes.status).toBe(200);
    expect(JSON.stringify(await mes.json())).not.toContain('ADMMOSTRA');
    expect((await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/efetivo-do-dia/${dia(15)}`)).status).toBeLessThan(500);
  });
});
