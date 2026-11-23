import type { EscalaDosOficiais, OficialNoSaldo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// P1.5: ser QOC ou QOA torna o oficial elegível; quem participa do mês é o gestor que marca.
// Dados fictícios (D7): oficiais 9905xx-x no 2º GB. Março de 2027 é o primeiro mês da unidade; abril e maio copiam o anterior.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let servico: string;
let turnoA: string;
let turnoB: string;
let seq = 0;

async function oficial(nome: string, antiguidade: number, opcoes: { posto?: string; quadro?: string; desde?: string } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `9905${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto[opcoes.posto ?? 'CAP'], nome_guerra: nome.toUpperCase(), antiguidade });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada: 'adm', desde: opcoes.desde ?? '2026-12-01', quadro_id: quadro[opcoes.quadro ?? 'QOC'] });
  ids[nome] = id;
  return id;
}

type Resposta = EscalaDosOficiais & { liberados?: string[] };
const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
const marcar = (mes: string, nomes: string[], quem: 'gestorGb' | 'escalante' = 'gestorGb') => api.pedir(quem, 'PUT', rota(mes, '/participantes'), { militarIds: nomes.map((n) => ids[n]) });
const calcular = (mes: string) => api.pedir('gestorGb', 'POST', rota(mes, '/cotas'));
const lancar = (mes: string, dia: string, turno: string, nome: string | null) => api.pedir('gestorGb', 'PUT', rota(mes, `/turnos/${dia}/${turno}`), { militarId: nome ? ids[nome] : null });
const de = (e: EscalaDosOficiais, nome: string) => e.oficiais.find((o) => o.militarId === ids[nome]);
const resumo = (e: EscalaDosOficiais) => e.oficiais.map((o) => [o.nomeGuerra, o.participa, o.novo]);
const MSG_MARQUE = 'Marque quem participa da rodada antes de calcular as cotas.';

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  await oficial('a', 1);
  await oficial('b', 2);
  await oficial('c', 3);
  await oficial('praca', 1, { posto: '2º SGT', quadro: 'QBMG' });
  servico = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Oficial de operações', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'A', inicio: '07:00', fim: '19:00' });
  turnoB = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'B', inicio: '19:00', fim: '07:00' });
  expect((await api.pedir('gestorGb', 'PUT', rota('2027-03', '/servico'), { servicoId: servico })).status).toBe(200);
});
afterAll(async () => {
  await api.fechar();
});

describe('o primeiro mês da unidade', () => {
  it('lista os elegíveis, ninguém vem marcado e ninguém é "novo"', async () => {
    expect(resumo(await ler('2027-03'))).toEqual([['A', false, false], ['B', false, false], ['C', false, false]]);
  });

  it('com elegíveis e nenhum participante marcado, calcular as cotas dá 409 com o texto (Review Focus 3)', async () => {
    const r = await calcular('2027-03');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(MSG_MARQUE);
  });

  it('o auxiliar não marca participantes (403)', async () => {
    expect((await marcar('2027-03', ['a'], 'escalante')).status).toBe(403);
  });

  it('um militar que não é elegível no mês dá 400 com o texto, e nada é gravado', async () => {
    const r = await marcar('2027-03', ['a', 'praca']);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Este oficial não é elegível neste mês.');
    expect(resumo(await ler('2027-03')).filter((x) => x[1])).toEqual([]);
  });

  it('o gestor marca A e B: só eles entram nas cotas e na vez; C continua na lista, sem cota', async () => {
    const r = await marcar('2027-03', ['a', 'b']);
    expect(r.status).toBe(200);
    expect(resumo(await r.json())).toEqual([['A', true, false], ['B', true, false], ['C', false, false]]);
    expect((await calcular('2027-03')).status).toBe(200);
    const e = await ler('2027-03');
    expect(e.etapa).toBe('escolhas');
    expect([de(e, 'a')!.cota, de(e, 'b')!.cota, de(e, 'c')!.cota]).toEqual([31, 31, null]);
    expect(de(e, 'c')).toMatchObject({ participa: false, devido: null, escolhidos: 0 });
    expect(e.vez).toBe(ids.a);
  });

  it('quem não participa não recebe turno (400)', async () => {
    expect((await lancar('2027-03', '2027-03-01', turnoA, 'c')).status).toBe(400);
  });
});

describe('mudar os participantes depois das cotas', () => {
  it('desmarcar quem já tinha turnos: os turnos ficam vazios, a resposta avisa quantos e as cotas dos outros são refeitas (Review Focus 1)', async () => {
    expect((await lancar('2027-03', '2027-03-02', turnoA, 'b')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-03', turnoB, 'b')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-01', turnoA, 'a')).status).toBe(200);
    const r = await marcar('2027-03', ['a']);
    expect(r.status).toBe(200);
    const e: Resposta = await r.json();
    expect(e.liberados).toEqual(['2 turnos de CAP B ficaram sem ninguém.']);
    expect(de(e, 'a')).toMatchObject({ cota: 62, escolhidos: 1, participa: true });
    expect(de(e, 'b')).toMatchObject({ cota: null, escolhidos: 0, participa: false });
    expect(e.turnos.filter((t) => t.militarId === ids.b)).toEqual([]);
    expect(e.turnos.filter((t) => t.militarId === ids.a)).toHaveLength(1);
  });

  it('marcar de volta refaz as cotas e mantém as escolhas de quem continua, sem aviso', async () => {
    const e: Resposta = await (await marcar('2027-03', ['a', 'b'])).json();
    expect(e.liberados).toEqual([]);
    expect([de(e, 'a')!.cota, de(e, 'b')!.cota]).toEqual([31, 31]);
    expect(de(e, 'a')!.escolhidos).toBe(1);
  });

  it('um turno só usa o singular no aviso', async () => {
    expect((await lancar('2027-03', '2027-03-05', turnoA, 'b')).status).toBe(200);
    const e: Resposta = await (await marcar('2027-03', ['a'])).json();
    expect(e.liberados).toEqual(['1 turno de CAP B ficou sem ninguém.']);
  });

  it('desmarcar todos depois das cotas dá 409 e nada muda', async () => {
    const r = await marcar('2027-03', []);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(MSG_MARQUE);
    expect(de(await ler('2027-03'), 'a')).toMatchObject({ participa: true, cota: 62 });
  });

  it('com a escala fechada, os participantes não mudam mais (409 com o texto)', async () => {
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/fechar'))).status).toBe(200);
    const r = await marcar('2027-03', ['a', 'b']);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Com a escala fechada, os participantes não mudam mais.');
    expect(de(await ler('2027-03'), 'b')!.participa).toBe(false);
  });
});

describe('o mês seguinte', () => {
  it('encerrado março só com A, o saldo de B e de C fica parado: nenhum lançamento para eles', async () => {
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/encerrar'))).status).toBe(200);
    const painel: OficialNoSaldo[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo`)).json();
    expect(painel.filter((o) => o.registro.some((r) => r.tipo === 'mes')).map((o) => o.nomeGuerra)).toEqual(['A']);
  });

  it('sem mês gravado, abril vem com a cópia de março: A marcado; B e C desmarcados; quem chegou em abril é "novo"', async () => {
    await oficial('d', 4, { desde: '2027-04-01' });
    expect(resumo(await ler('2027-04'))).toEqual([['A', true, false], ['B', false, false], ['C', false, false], ['D', false, true]]);
    // ler não grava o mês
    expect((await api.banco.query("select 1 from oficiais_mes where mes = '2027-04-01'")).rows).toHaveLength(0);
  });

  it('calcular abril sem mexer usa a cópia: só A tem cota', async () => {
    expect((await calcular('2027-04')).status).toBe(200);
    const e = await ler('2027-04');
    expect(e.oficiais.filter((o) => o.cota !== null).map((o) => o.nomeGuerra)).toEqual(['A']);
    expect(de(e, 'd')).toMatchObject({ participa: false, novo: true });
  });

  it('quem nunca participou e é marcado entra com a média no encerramento, e deixa de ser "novo" (Review Focus 4)', async () => {
    const e: Resposta = await (await marcar('2027-04', ['a', 'd'])).json();
    expect(de(e, 'd')).toMatchObject({ participa: true, novo: false });
    expect((await api.pedir('gestorGb', 'POST', rota('2027-04', '/fechar'))).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-04', '/encerrar'))).status).toBe(200);
    const { rows } = await api.banco.query<{ tipo: string }>(
      "select s.tipo from oficiais_saldo s join oficiais_mes m on m.id = s.mes_id where s.militar_id = $1 and m.mes = '2027-04-01' order by s.tipo", [ids.d]);
    expect(rows.map((r) => r.tipo)).toEqual(['entrada', 'mes']);
    // B continua parado: nada em abril
    expect((await api.banco.query('select 1 from oficiais_saldo where militar_id = $1', [ids.b])).rows).toHaveLength(0);
  });
});

describe('o elegível que deixa de ser elegível', () => {
  it('marcado e com turno, muda de quadro no mês: no cálculo seguinte sai da rodada, com o mesmo aviso (Review Focus 2)', async () => {
    // maio copia abril: A e D
    expect((await calcular('2027-05')).status).toBe(200);
    expect((await lancar('2027-05', '2027-05-02', turnoA, 'd')).status).toBe(200);
    await api.banco.query('update rastreio set quadro_id = $2 where militar_id = $1', [ids.d, quadro.QBMG]);
    const r = await calcular('2027-05');
    expect(r.status).toBe(200);
    const e: Resposta = await r.json();
    expect(e.liberados).toEqual(['1 turno de CAP D ficou sem ninguém.']);
    expect(de(e, 'd')).toBeUndefined();
    expect(de(e, 'a')!.cota).toBe(62);
    expect(e.turnos.filter((t) => t.militarId === ids.d)).toEqual([]);
  });

  it('quem deixou de ser elegível mas ainda tem cota não trava a marcação: a lista da tela vai com o nome dele, e ele sai da rodada (achado da revisão final)', async () => {
    expect((await calcular('2027-07')).status).toBe(200);
    await oficial('e', 5, { desde: '2027-07-01' });
    expect((await marcar('2027-07', ['a', 'e'])).status).toBe(200);
    expect((await lancar('2027-07', '2027-07-03', turnoA, 'e')).status).toBe(200);
    await api.banco.query('update rastreio set quadro_id = $2 where militar_id = $1', [ids.e, quadro.QBMG]);
    // a tela ainda mostra E marcado (tem cota): marcar ou desmarcar outro manda a lista inteira, com ele
    const r = await marcar('2027-07', ['a', 'e']);
    expect(r.status).toBe(200);
    const e: Resposta = await r.json();
    expect(e.liberados).toEqual(['1 turno de CAP E ficou sem ninguém.']);
    expect(de(e, 'e')).toBeUndefined();
    expect(de(e, 'a')!.cota).toBe(62);
    // quem nunca esteve na rodada nem é elegível continua dando 400
    expect((await marcar('2027-07', ['a', 'praca'])).status).toBe(400);
  });

  it('a marca de quem deixou de ser elegível não volta sozinha: junho copia maio só com quem é elegível', async () => {
    expect(resumo(await ler('2027-06')).filter((x) => x[1]).map((x) => x[0])).toEqual(['A']);
  });
});
