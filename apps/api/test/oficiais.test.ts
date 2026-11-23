import type { EscalaDosOficiais, OficialNoSaldo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Dados fictícios (D7): oficiais 990400-x em diante, no 2º GB e na 1ª SB.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let servico: string;
let turnoA: string;
let turnoB: string;
let servicoDeOutraUnidade: string;
let servicoSemTurno: string;
const NOMES = ['a1', 'a2', 'a3', 'a4', 'a5', 'f', 'm1', 'm2'];
const COTAS = [8, 8, 8, 8, 8, 4, 9, 9];
let seq = 0;

async function oficial(nome: string, antiguidade: number | null, opcoes: { posto?: string; quadro?: string | null; unidade?: string; desde?: string } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `9904${String(seq).padStart(2, '0')}-${seq % 10}`,
    posto_grad_id: posto[opcoes.posto ?? 'CAP BM'],
    nome_guerra: nome.toUpperCase(),
    antiguidade,
  });
  // o quadro vale por período
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: opcoes.unidade ?? api.ids.gb, jornada: 'adm', desde: opcoes.desde ?? '2026-12-01', quadro_id: opcoes.quadro === null ? null : quadro[opcoes.quadro ?? 'QOC'] });
  ids[nome] = id;
  return id;
}

const rota = (mes: string, resto = '') => `/api/unidades/${api.ids.gb}/oficiais/${mes}${resto}`;
const ler = async (mes: string): Promise<EscalaDosOficiais> => (await api.pedir('gestorGb', 'GET', rota(mes))).json();
// até a P1.5 todo elegível participava: estes testes marcam todos os elegíveis do mês antes de calcular (com a escala aberta)
const calcular = async (mes: string) => {
  const e = await ler(mes);
  if (e.etapa === 'sem-cotas' || e.etapa === 'escolhas') await api.pedir('gestorGb', 'PUT', rota(mes, '/participantes'), { militarIds: e.oficiais.map((o) => o.militarId) });
  return api.pedir('gestorGb', 'POST', rota(mes, '/cotas'));
};
const lancar = (mes: string, dia: string, turno: string, militarId: string | null) => api.pedir('gestorGb', 'PUT', rota(mes, `/turnos/${dia}/${turno}`), { militarId });
const painel = async (): Promise<OficialNoSaldo[]> => (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo`)).json();
const dono = (i: number) => NOMES.flatMap((n, k) => Array<string>(COTAS[k]!).fill(n))[i]!;
const posicao = (i: number) => ({ dia: `2027-01-${String(Math.floor(i / 2) + 1).padStart(2, '0')}`, turno: i % 2 === 0 ? turnoA : turnoB });
const escolherServico = (mes: string, servicoId: string) => api.pedir('gestorGb', 'PUT', rota(mes, '/servico'), { servicoId });

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  for (const [k, nome] of NOMES.entries()) {
    // m2 é lotado na 1ª SB, abaixo do 2º GB: também entra na escala dele; m1 é do QOA
    await oficial(nome, k + 1, { quadro: nome === 'm1' ? 'QOA' : 'QOC', unidade: nome === 'm2' ? api.ids.secao : api.ids.gb });
  }
  await oficial('praca', 1, { posto: '2º SGT BM', quadro: 'QBMG' });
  await oficial('semquadro', 2, { posto: 'MAJ BM', quadro: null });
  servico = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Oficial de operações', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'A', inicio: '07:00', fim: '19:00' });
  turnoB = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'B', inicio: '19:00', fim: '07:00' });
  servicoDeOutraUnidade = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Oficial da seção', tipo: 'ordinario', cor: '#2F8F5B' });
  await inserir(api.banco, 'turno', { servico_id: servicoDeOutraUnidade, letra: 'A', inicio: '07:00', fim: '19:00' });
  servicoSemTurno = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Sem turno', tipo: 'ordinario', cor: '#2F8F5B' });
  const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
  await inserir(api.banco, 'afastamento', { militar_id: ids.f, tipo_afastamento_id: ferias, inicio: '2027-01-17', fim: '2027-01-31' });
});
afterAll(async () => {
  await api.fechar();
});

describe('acesso', () => {
  it('o auxiliar recebe 403 em todas as rotas, e o gestor do 2º GB, 200', async () => {
    const t = `/api/unidades/${api.ids.gb}`;
    for (const [m, c, corpo] of [
      ['GET', `${t}/oficiais/2027-01`, undefined],
      ['POST', `${t}/oficiais/2027-01/cotas`, undefined],
      ['PUT', `${t}/oficiais/2027-01/ordem`, { militarIds: [] }],
      ['PUT', `${t}/oficiais/2027-01/turnos/2027-01-01/dia`, { militarId: null }],
      ['POST', `${t}/oficiais/2027-01/fechar`, undefined],
      ['POST', `${t}/oficiais/2027-01/encerrar`, undefined],
      ['GET', `${t}/oficiais-saldo`, undefined],
      ['POST', `${t}/oficiais-saldo/ajustes`, { militarId: ids.a1, valor: 1, motivo: 'x' }],
    ] as const) {
      expect((await api.pedir('escalante', m, c, corpo)).status, `${m} ${c}`).toBe(403);
    }
    expect((await api.pedir('gestorGb', 'GET', `${t}/oficiais/2027-01`)).status).toBe(200);
    expect((await api.pedir('admin', 'GET', `${t}/oficiais/2027-01`)).status).toBe(200);
  });

  it('mês inválido dá 400', async () => {
    expect((await api.pedir('gestorGb', 'GET', rota('2027-13'))).status).toBe(400);
  });
});

describe('antes do cálculo', () => {
  it('só os oficiais QOC e QOA da unidade e de baixo dela; a etapa é sem-cotas, com os dias e sem cota', async () => {
    const e = await ler('2027-01');
    expect(e.etapa).toBe('sem-cotas');
    expect(e.oficiais.map((o) => o.nomeGuerra)).toEqual(NOMES.map((n) => n.toUpperCase()));
    expect(e.oficiais.map((o) => o.dias)).toEqual([31, 31, 31, 31, 31, 16, 31, 31]);
    expect(e.oficiais.every((o) => o.cota === null && o.devido === null)).toBe(true);
    expect(e.turnos).toEqual([]);
    expect(e.servico).toBeNull();
    expect(e.turnosDoServico).toEqual([]);
    expect(e.oficiais.find((o) => o.nomeGuerra === 'M2')!.lotacao).toBe('1ª SB');
    expect(e.oficiais[5]!.afastamentos).toEqual([{ inicio: '2027-01-17', fim: '2027-01-31', tipo: 'Férias' }]);
  });

  it('calcular sem serviço dá 409 com o texto', async () => {
    const r = await calcular('2027-01');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Escolha o serviço da escala antes de calcular as cotas.');
  });

  it('um serviço sem turno, de outra unidade, que não existe ou que não é ordinário dá 400', async () => {
    const outro = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Operação especial', tipo: 'diaria', cor: '#2F8F5B' });
    await inserir(api.banco, 'turno', { servico_id: outro, letra: 'A', inicio: '07:00', fim: '19:00' });
    for (const id of [servicoSemTurno, servicoDeOutraUnidade, outro, '00000000-0000-4000-8000-000000000000']) {
      const r = await escolherServico('2027-01', id);
      expect(r.status, id).toBe(400);
      expect((await r.json()).erro).toBe('Escolha um serviço da unidade com turnos cadastrados.');
    }
  });

  it('escolher o serviço mostra os turnos com o rótulo pelo horário', async () => {
    const r = await escolherServico('2027-01', servico);
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.servico).toEqual({ id: servico, nome: 'Oficial de operações' });
    expect(e.turnosDoServico).toEqual([
      { id: turnoA, letra: 'A', inicio: '07:00', fim: '19:00', rotulo: 'Dia' },
      { id: turnoB, letra: 'B', inicio: '19:00', fim: '07:00', rotulo: 'Noite' },
    ]);
    expect(e.etapa).toBe('sem-cotas');
  });

  it('mês sem participantes: lista vazia, sem divisão por zero', async () => {
    const e = await ler('2026-10');
    expect(e.oficiais).toEqual([]);
    expect((await escolherServico('2026-10', servico)).status).toBe(200);
    expect((await calcular('2026-10')).status).toBe(200);
    const depois = await ler('2026-10');
    expect(depois.oficiais).toEqual([]);
    expect(depois.turnos).toHaveLength(62);
  });
});

describe('o mês de janeiro de 2027', () => {
  it('calcular grava 62 turnos e as cotas 8,8,8,8,8,4,9,9', async () => {
    const r = await calcular('2027-01');
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.etapa).toBe('escolhas');
    expect(e.turnos).toHaveLength(62);
    expect(new Set(e.turnos.map((t) => t.turnoId))).toEqual(new Set([turnoA, turnoB]));
    expect(e.oficiais.map((o) => o.cota)).toEqual(COTAS);
    expect(e.oficiais.map((o) => o.sobra)).toEqual([false, false, false, false, false, false, true, true]);
    expect(e.vez).toBe(ids.a1);
  });

  it('trocar o serviço depois das cotas dá 409; um turno de outro serviço dá 400', async () => {
    const r = await escolherServico('2027-01', servico);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Com as cotas calculadas, o serviço não muda mais.');
    const alheio = (await api.banco.query<{ id: string }>('select id from turno where servico_id = $1', [servicoDeOutraUnidade])).rows[0]!.id;
    const t = await lancar('2027-01', '2027-01-01', alheio, ids.a1!);
    expect(t.status).toBe(400);
    expect((await t.json()).erro).toBe('Este turno não é do serviço da escala.');
  });

  it('um oficial fora da cota é recusado no turno', async () => {
    for (const quem of ['praca', 'semquadro']) {
      const r = await lancar('2027-01', '2027-01-01', turnoA, ids[quem]!);
      expect(r.status).toBe(400);
      expect((await r.json()).erro).toBe('Este oficial não está na escala deste mês.');
    }
  });

  it('a vez passa ao seguinte quando o mais antigo lança toda a cota', async () => {
    for (let i = 0; i < 8; i++) expect((await lancar('2027-01', posicao(i).dia, posicao(i).turno, ids.a1!)).status).toBe(200);
    expect((await ler('2027-01')).vez).toBe(ids.a2);
  });

  it('calcular de novo mantém as escolhas', async () => {
    const e: EscalaDosOficiais = await (await calcular('2027-01')).json();
    expect(e.oficiais[0]!.escolhidos).toBe(8);
    expect(e.turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(8);
  });

  it('a ordem manual regrava as cotas e também mantém as escolhas', async () => {
    const r = await api.pedir('gestorGb', 'PUT', rota('2027-01', '/ordem'), { militarIds: [ids.a1!] });
    expect(r.status).toBe(200);
    expect((await ler('2027-01')).turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(8);
  });

  it('um afastamento lançado depois do turno gera o aviso, e fechar continua 200', async () => {
    // o turno de a2 no dia 17 não existe ainda: lança f no dia 20 (já de férias) para ver o aviso
    expect((await lancar('2027-01', '2027-01-20', turnoA, ids.f!)).status).toBe(200);
    const e = await ler('2027-01');
    expect(e.avisos).toEqual([
      { dia: '2027-01-20', turnoId: turnoA, militarId: ids.f, texto: 'CAP F está afastado em 20/01 (Férias) e está no turno do dia. A escala pode ser fechada mesmo assim.' },
    ]);
    // devolve o turno: o resto do roteiro lança as cotas certas
    await lancar('2027-01', '2027-01-20', turnoA, null);
  });

  it('lança todos os turnos menos 10 e fecha: 200, etapa fechada, e calcular depois dá 409', async () => {
    for (let i = 8; i < 52; i++) expect((await lancar('2027-01', posicao(i).dia, posicao(i).turno, ids[dono(i)]!)).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-01', '/encerrar'))).status).toBe(409);
    const r = await api.pedir('gestorGb', 'POST', rota('2027-01', '/fechar'));
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.etapa).toBe('fechada');
    expect(e.turnos.filter((t) => t.militarId === null)).toHaveLength(10);
    const de_novo = await calcular('2027-01');
    expect(de_novo.status).toBe(409);
    expect((await de_novo.json()).erro).toBe('Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.');
    expect((await api.pedir('gestorGb', 'PUT', rota('2027-01', '/ordem'), { militarIds: [] })).status).toBe(409);
  });

  it('cobertura: A por B grava quem saiu; voltar a A limpa; tirar o nome deixa o turno vazio', async () => {
    const { dia, turno } = posicao(10); // turno de a2
    const turnoDe = async () => (await ler('2027-01')).turnos.find((t) => t.dia === dia && t.turnoId === turno)!;
    expect(await (await lancar('2027-01', dia, turno, ids.a3!)).json().then((e: EscalaDosOficiais) => e.turnos.find((t) => t.dia === dia && t.turnoId === turno))).toMatchObject({ militarId: ids.a3, saiuMilitarId: ids.a2 });
    await lancar('2027-01', dia, turno, ids.a2!);
    expect(await turnoDe()).toMatchObject({ militarId: ids.a2, saiuMilitarId: null });
    await lancar('2027-01', dia, turno, null);
    expect(await turnoDe()).toMatchObject({ militarId: null, saiuMilitarId: null });
    await lancar('2027-01', dia, turno, ids.a2!);
    expect(await turnoDe()).toMatchObject({ militarId: ids.a2, saiuMilitarId: null });
  });

  it('completa os 10 turnos vazios depois de fechar e encerra: 8 lançamentos mes com os valores do motor', async () => {
    for (let i = 52; i < 62; i++) await lancar('2027-01', posicao(i).dia, posicao(i).turno, ids[dono(i)]!);
    const r = await api.pedir('gestorGb', 'POST', rota('2027-01', '/encerrar'));
    expect(r.status).toBe(200);
    expect(((await r.json()) as EscalaDosOficiais).etapa).toBe('encerrada');
    const { rows } = await api.banco.query<{ militar_id: string; valor: string }>("select militar_id, valor::text from oficiais_saldo where tipo = 'mes'");
    expect(rows).toHaveLength(8);
    const valor = (n: string) => Number(rows.find((x) => x.militar_id === ids[n])!.valor);
    expect(valor('a1')).toBeCloseTo(-0.2489, 4);
    expect(valor('m1')).toBeCloseTo(0.7511, 4);
    expect(valor('f')).toBeCloseTo(-0.2575, 4);
  });

  it('encerrar de novo dá 409, sem duplicar; lançar depois do encerramento também', async () => {
    const r = await api.pedir('gestorGb', 'POST', rota('2027-01', '/encerrar'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.');
    const { rows } = await api.banco.query<{ n: number }>("select count(*)::int as n from oficiais_saldo where tipo = 'mes'");
    expect(rows[0]!.n).toBe(8);
    expect((await lancar('2027-01', '2027-01-01', turnoA, ids.a1!)).status).toBe(409);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-01', '/fechar'))).status).toBe(409);
  });

  it('o painel mostra o saldo, a evolução e as contagens de dia e noite', async () => {
    const lista = await painel();
    expect(lista).toHaveLength(8);
    const a1 = lista.find((o) => o.militarId === ids.a1)!;
    expect(a1.saldo).toBeCloseTo(-0.2489, 4);
    expect(a1.meses).toEqual([{ mes: '2027-01', valor: a1.saldo }]);
    expect(a1.turnos.map((x) => x.rotulo)).toEqual(['Dia', 'Noite']);
    expect(a1.turnos.reduce((n, x) => n + x.quantidade, 0)).toBe(8);
    expect(a1.registro[0]).toMatchObject({ tipo: 'mes', mes: '2027-01' });
    expect(lista.map((o) => o.nomeGuerra)[0]).toBe('A1');
  });
});

describe('depois de janeiro', () => {
  it('encerrar antes de fechar dá 409 com o texto', async () => {
    const r = await api.pedir('gestorGb', 'POST', rota('2027-02', '/encerrar'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.');
  });

  it('fechar sem cotas dá 409 com o texto', async () => {
    const r = await api.pedir('gestorGb', 'POST', rota('2027-02', '/fechar'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Calcule as cotas antes de fechar a escala.');
  });

  it('um oficial que entra no mês seguinte ganha a entrada com a média, e o painel mostra o registro', async () => {
    await oficial('novato', 9, { quadro: 'QOA', desde: '2027-02-01' });
    // sem mês gravado, o serviço vem copiado do último mês da unidade
    expect((await ler('2027-02')).servico).toEqual({ id: servico, nome: 'Oficial de operações' });
    expect((await calcular('2027-02')).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-02', '/fechar'))).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-02', '/encerrar'))).status).toBe(200);
    const { rows } = await api.banco.query<{ valor: string }>("select valor::text from oficiais_saldo where tipo = 'mes' and mes_id in (select id from oficiais_mes where mes = '2027-01-01')");
    const media = rows.reduce((s, x) => s + Number(x.valor), 0) / rows.length;
    const novato = (await painel()).find((o) => o.militarId === ids.novato)!;
    expect(novato.saldo).toBeCloseTo(media, 5);
    expect(novato.registro[0]).toMatchObject({ tipo: 'entrada', texto: 'Entrou com a média dos saldos de quem já estava.' });
  });

  it('ajuste sem motivo dá 400; com motivo, o saldo do painel muda pelo valor', async () => {
    const antes = (await painel()).find((o) => o.militarId === ids.a1)!.saldo;
    const url = `/api/unidades/${api.ids.gb}/oficiais-saldo/ajustes`;
    expect((await api.pedir('gestorGb', 'POST', url, { militarId: ids.a1, valor: 0.5, motivo: '  ' })).status).toBe(400);
    expect((await api.pedir('gestorGb', 'POST', url, { militarId: ids.a1, valor: 0, motivo: 'zero' })).status).toBe(400);
    expect((await api.pedir('gestorGb', 'POST', url, { militarId: ids.praca, valor: 1, motivo: 'fora' })).status).toBe(400);
    const r = await api.pedir('gestorGb', 'POST', url, { militarId: ids.a1, valor: 0.5, motivo: 'Férias lançadas depois' });
    expect(r.status).toBe(201);
    const depois = (await painel()).find((o) => o.militarId === ids.a1)!;
    expect(depois.saldo).toBeCloseTo(antes + 0.5, 6);
    const ajuste = depois.registro.find((x) => x.tipo === 'ajuste')!;
    expect(ajuste).toMatchObject({ valor: 0.5 });
    expect(ajuste.texto).toContain('Férias lançadas depois');
  });

  it('o painel registra cobertura e quem saiu', async () => {
    // a cobertura de janeiro (a2 por a3 e de volta) foi desfeita: o registro não tem cobertura; cria uma em março
    expect((await calcular('2027-03')).status).toBe(200);
    expect((await api.pedir('gestorGb', 'PUT', rota('2027-03', `/turnos/2027-03-05/${turnoA}`), { militarId: ids.a2 })).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/fechar'))).status).toBe(200);
    expect((await api.pedir('gestorGb', 'PUT', rota('2027-03', `/turnos/2027-03-05/${turnoA}`), { militarId: ids.a3 })).status).toBe(200);
    const lista = await painel();
    expect(lista.find((o) => o.militarId === ids.a3)!.registro.some((x) => x.tipo === 'cobriu' && x.texto === 'Cobriu CAP A2 em 05/03/2027.')).toBe(true);
    expect(lista.find((o) => o.militarId === ids.a2)!.registro.some((x) => x.tipo === 'saiu' && x.texto === 'Saiu em 05/03/2027; CAP A3 cobriu. Não fica devendo.')).toBe(true);
  });

  it('dois encerramentos ao mesmo tempo: um só vale', async () => {
    expect((await calcular('2027-04')).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-04', '/fechar'))).status).toBe(200);
    const [a, b] = await Promise.all([api.pedir('gestorGb', 'POST', rota('2027-04', '/encerrar')), api.pedir('gestorGb', 'POST', rota('2027-04', '/encerrar'))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const { rows } = await api.banco.query<{ n: number }>("select count(*)::int as n from oficiais_saldo s join oficiais_mes m on m.id = s.mes_id where m.mes = '2027-04-01' and s.tipo = 'mes'");
    expect(rows[0]!.n).toBe(9);
  });
});

describe('correções da revisão final', () => {
  it('um turno cadastrado no serviço depois das cotas não vira 500: dá 400, antes e depois de fechar', async () => {
    expect((await calcular('2027-05')).status).toBe(200);
    const novo = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'C', inicio: '12:00', fim: '18:00' });
    const antes = await lancar('2027-05', '2027-05-03', novo, ids.a1!);
    expect(antes.status).toBe(400);
    expect((await antes.json()).erro).toBe('Este turno não faz parte da escala deste mês.');
    expect((await api.pedir('gestorGb', 'POST', rota('2027-05', '/fechar'))).status).toBe(200);
    const depois = await lancar('2027-05', '2027-05-03', novo, ids.a1!);
    expect(depois.status).toBe(400);
    await api.banco.query('delete from turno where id = $1', [novo]);
  });

  it('quem sai da lista num novo cálculo não deixa turnos com o nome dele: os turnos ficam vazios', async () => {
    expect((await calcular('2027-06')).status).toBe(200);
    for (const dia of ['2027-06-01', '2027-06-02']) expect((await lancar('2027-06', dia, turnoA, ids.a1!)).status).toBe(200);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Desativado') where militar_id = $1", [ids.a1]);
    const e: EscalaDosOficiais = await (await calcular('2027-06')).json();
    expect(e.oficiais.some((o) => o.militarId === ids.a1)).toBe(false);
    expect(e.turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(0);
    expect(e.turnos.filter((t) => t.militarId === ids.a1 || t.saiuMilitarId === ids.a1)).toHaveLength(0);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Ativa') where militar_id = $1", [ids.a1]);
  });

  it('o serviço copiado do último mês é conferido no cálculo', async () => {
    const x = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Oficial reserva', tipo: 'ordinario', cor: '#2F8F5B' });
    await inserir(api.banco, 'turno', { servico_id: x, letra: 'A', inicio: '07:00', fim: '19:00' });
    expect((await escolherServico('2027-07', x)).status).toBe(200);
    await api.banco.query('update servico set ativo = false where id = $1', [x]);
    const r = await calcular('2027-08');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Escolha um serviço da unidade com turnos cadastrados.');
    // o gestor escolhe outro e segue
    expect((await escolherServico('2027-08', servico)).status).toBe(200);
    expect((await calcular('2027-08')).status).toBe(200);
  });
});
