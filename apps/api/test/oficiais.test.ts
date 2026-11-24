import type { EscalaDosOficiais, OficialNoSaldo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { escalaDaRodada, type RodadaDeTeste } from './apoio-oficiais.ts';

// Dados fictícios (D7): oficiais 990400-x em diante, no 2º GB e na 1ª SB.
let api: ApiDeTeste;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const ids: Record<string, string> = {};
let rodada: RodadaDeTeste;
let escalaDeOutraUnidade: string;
let escalaSemServicos: string;
const NOMES = ['a1', 'a2', 'a3', 'a4', 'a5', 'f', 'm1', 'm2'];
const COTAS = [8, 8, 8, 8, 8, 4, 9, 9];
let seq = 0;

async function oficial(nome: string, antiguidade: number | null, opcoes: { posto?: string; quadro?: string | null; unidade?: string; desde?: string } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `9904${String(seq).padStart(2, '0')}-${seq % 10}`,
    posto_grad_id: posto[opcoes.posto ?? 'CAP'],
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
// até a P1.5 todo elegível participava: estes testes marcam todos os elegíveis do mês antes de abrir (com a escala aberta)
const abrir = async (mes: string) => {
  const e = await ler(mes);
  if (e.etapa === 'nao-aberto' || e.etapa === 'escolhas') await api.pedir('gestorGb', 'PUT', rota(mes, '/participantes'), { militarIds: e.oficiais.map((o) => o.militarId) });
  return api.pedir('gestorGb', 'POST', rota(mes, '/abrir'));
};
const lancar = (mes: string, dia: string, letra: string, militarId: string, servico: 'jes' | 'saldo' = 'saldo') =>
  api.pedir('gestorGb', 'POST', rota(mes, '/lancamentos'), { dia, letra, servico, militarId });
const tirar = async (mes: string, dia: string, letra: string) => {
  const t = (await ler(mes)).turnos.find((x) => x.dia === dia && x.letra === letra)!;
  return api.pedir('gestorGb', 'DELETE', rota(mes, `/lancamentos/${t.alocacaoId}`));
};
const painel = async (): Promise<OficialNoSaldo[]> => (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo`)).json();
// quem fica com cada lugar: a ordem das cotas, com quatro lugares do F trocados com quatro do A3 (que estão nos dias em que ele está presente). A contagem de
// cada um não muda, e o saldo só conta lugares; a API recusa o lugar de quem está de férias no dia (6.30)
const DONOS = NOMES.flatMap((n, k) => Array<string>(COTAS[k]!).fill(n));
for (let k = 0; k < 4; k++) [DONOS[16 + k], DONOS[40 + k]] = [DONOS[40 + k]!, DONOS[16 + k]!];
const dono = (i: number) => DONOS[i]!;
const posicao = (i: number) => ({ dia: `2027-01-${String(Math.floor(i / 2) + 1).padStart(2, '0')}`, letra: i % 2 === 0 ? 'A' : 'B' });
const doLugar = (e: EscalaDosOficiais, dia: string, letra: string) => e.turnos.find((t) => t.dia === dia && t.letra === letra)!;

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  for (const [k, nome] of NOMES.entries()) {
    // m2 é lotado na 1ª SB, abaixo do 2º GB: também entra na escala dele; m1 é do QOA
    await oficial(nome, k + 1, { quadro: nome === 'm1' ? 'QOA' : 'QOC', unidade: nome === 'm2' ? api.ids.secao : api.ids.gb });
  }
  await oficial('praca', 1, { posto: '2º SGT', quadro: 'QBMG' });
  await oficial('semquadro', 2, { posto: 'MAJ', quadro: null });
  rodada = await escalaDaRodada(api.banco, api.ids.gb);
  // a escala de outra unidade e uma sem serviços não servem a esta tela
  escalaDeOutraUnidade = (await escalaDaRodada(api.banco, api.ids.secao)).escalaId;
  escalaSemServicos = await inserir(api.banco, 'escala', { unidade_id: api.ids.gb, nome: 'Sem serviços', titulo: 'SEM SERVIÇOS', militares_doc: 'escalados', dias_doc: 'todos', distribuicao: 'rodada_de_cotas' });
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
      ['POST', `${t}/oficiais/2027-01/abrir`, undefined],
      ['PUT', `${t}/oficiais/2027-01/ordem`, { militarIds: [] }],
      ['POST', `${t}/oficiais/2027-01/lancamentos`, { dia: '2027-01-01', letra: 'A', servico: 'saldo', militarId: ids.a1 }],
      ['DELETE', `${t}/oficiais/2027-01/lancamentos/${ids.a1}`, undefined],
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

describe('a escala da rodada', () => {
  it('a unidade sem escala de rodada de cotas lê vazio, e abrir o mês dá 409 com o texto', async () => {
    const url = (resto = '') => `/api/unidades/${api.ids.raiz}/oficiais/2027-01${resto}`;
    const e: EscalaDosOficiais = await (await api.pedir('admin', 'GET', url())).json();
    expect(e.escala).toBeNull();
    expect(e.escalas).toEqual([]);
    const r = await api.pedir('admin', 'POST', url('/abrir'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('A unidade ainda não tem uma escala com rodada de cotas. Cadastre uma em Escalas.');
  });

  it('a tela traz as escalas da unidade com rodada de cotas, com os serviços JES e Saldo e os lugares do dia', async () => {
    const e = await ler('2027-01');
    expect(e.escalas.map((x) => x.nome)).toEqual(['Oficiais de operações', 'Sem serviços']);
    expect(e.escala).toEqual({ id: rodada.escalaId, nome: 'Oficiais de operações' });
    expect(e.servicos).toEqual({ jes: { id: rodada.jes, nome: 'JES', cor: '#6E56A8' }, saldo: { id: rodada.saldo, nome: 'Saldo', cor: '#2B7BB9' } });
    expect(e.turnosDoServico).toEqual([
      { id: rodada.saldoA, letra: 'A', inicio: '07:00', fim: '19:00', rotulo: 'Dia' },
      { id: rodada.saldoB, letra: 'B', inicio: '19:00', fim: '07:00', rotulo: 'Noite' },
    ]);
  });

  it('a escala pedida precisa ser uma da unidade com rodada de cotas: a de outra unidade, a que não existe e uma pré-escala dão 400', async () => {
    const preEscala = await inserir(api.banco, 'escala', { unidade_id: api.ids.gb, nome: 'Pré-escala comum', titulo: 'PRÉ', militares_doc: 'escalados', dias_doc: 'todos' });
    for (const id of [escalaDeOutraUnidade, preEscala, '00000000-0000-4000-8000-000000000000']) {
      const r = await api.pedir('gestorGb', 'GET', `${rota('2027-01')}?escala=${id}`);
      expect(r.status, id).toBe(400);
      expect((await r.json()).erro).toBe('Escolha uma escala da unidade com rodada de cotas.');
    }
    expect((await api.pedir('gestorGb', 'GET', `${rota('2027-01')}?escala=${rodada.escalaId}`)).status).toBe(200);
  });

  it('a rodada de cotas não tem pré-escala: gerar a pré-escala dela dá 409', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/escalas/${rodada.escalaId}/mes/2027-01/pre-escala`, { equipeDia1Id: '00000000-0000-4000-8000-000000000000' });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Esta escala é uma rodada de cotas: ela é montada em Oficiais, e não tem pré-escala.');
  });

  it('abrir o mês numa escala sem serviço de Saldo dá 409 com o texto, e nada é aberto', async () => {
    const r = await api.pedir('gestorGb', 'POST', `${rota('2027-01', '/abrir')}?escala=${escalaSemServicos}`);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('A escala precisa de um serviço de Saldo, com turnos, para abrir o mês.');
    expect((await api.banco.query('select 1 from oficiais_mes where escala_id = $1 and aberto_em is not null', [escalaSemServicos])).rows).toHaveLength(0);
  });
});

describe('antes de abrir o mês', () => {
  it('só os oficiais QOC e QOA da unidade e de baixo dela; a etapa é nao-aberto, com os dias e sem cota', async () => {
    const e = await ler('2027-01');
    expect(e.etapa).toBe('nao-aberto');
    expect(e.oficiais.map((o) => o.nomeGuerra)).toEqual(NOMES.map((n) => n.toUpperCase()));
    expect(e.oficiais.map((o) => o.dias)).toEqual([31, 31, 31, 31, 31, 16, 31, 31]);
    expect(e.oficiais.every((o) => o.cota === null && o.devido === null)).toBe(true);
    expect(e.turnos).toEqual([]);
    expect(e.oficiais.find((o) => o.nomeGuerra === 'M2')!.lotacao).toBe('1ª SB');
    expect(e.oficiais[5]!.afastamentos).toEqual([{ inicio: '2027-01-17', fim: '2027-01-31', tipo: 'Férias' }]);
  });

  it('lançar antes de abrir dá 409 com o texto "Abra o mês para lançar."', async () => {
    const r = await lancar('2027-01', '2027-01-01', 'A', ids.a1!);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Abra o mês para lançar.');
    expect((await api.pedir('gestorGb', 'DELETE', rota('2027-01', `/lancamentos/${ids.a1}`))).status).toBe(409);
  });

  it('as cotas não existem antes de abrir: ler não grava o mês', async () => {
    expect((await api.banco.query("select 1 from oficiais_mes where mes = '2027-01-01'")).rows).toHaveLength(0);
  });

  it('mês sem participantes: lista vazia, sem divisão por zero, e os 62 lugares nascem ao abrir', async () => {
    const e = await ler('2026-10');
    expect(e.oficiais).toEqual([]);
    expect((await abrir('2026-10')).status).toBe(200);
    const depois = await ler('2026-10');
    expect(depois.oficiais).toEqual([]);
    expect(depois.turnos).toHaveLength(62);
    expect(depois.etapa).toBe('escolhas');
  });
});

describe('o mês de janeiro de 2027', () => {
  it('abrir o mês grava as cotas de saldo 8,8,8,8,8,4,9,9, e o mês tem 62 lugares livres', async () => {
    const r = await abrir('2027-01');
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.etapa).toBe('escolhas');
    expect(e.turnos).toHaveLength(62);
    expect(e.turnos.every((t) => t.servico === null && t.militarId === null && t.alocacaoId === null)).toBe(true);
    expect(new Set(e.turnos.map((t) => t.turnoId))).toEqual(new Set([rodada.saldoA, rodada.saldoB]));
    expect(e.lugaresDeSaldo).toBe(62);
    expect(e.oficiais.map((o) => o.cota)).toEqual(COTAS);
    expect(e.oficiais.map((o) => o.sobra)).toEqual([false, false, false, false, false, false, true, true]);
    expect(e.vez).toBe(ids.a1);
  });

  it('um oficial fora da cota é recusado no lugar de Saldo', async () => {
    for (const quem of ['praca', 'semquadro']) {
      const r = await lancar('2027-01', '2027-01-01', 'A', ids[quem]!);
      expect(r.status).toBe(400);
      expect((await r.json()).erro).toBe('Este oficial não está na escala deste mês.');
    }
  });

  it('um dia de outro mês e uma letra que o serviço não tem dão 400', async () => {
    expect((await lancar('2027-01', '2027-02-01', 'A', ids.a1!)).status).toBe(400);
    const r = await lancar('2027-01', '2027-01-01', 'C', ids.a1!);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('O serviço Saldo desta escala não tem o turno C.');
  });

  it('a vez passa ao seguinte quando o mais antigo lança toda a cota; o lançamento é uma alocação comum da escala', async () => {
    for (let i = 0; i < 8; i++) expect((await lancar('2027-01', posicao(i).dia, posicao(i).letra, ids.a1!)).status).toBe(200);
    expect((await ler('2027-01')).vez).toBe(ids.a2);
    const { rows } = await api.banco.query<{ origem: string; servico_id: string; n: number }>(
      'select origem, servico_id, count(*)::int as n from alocacao where escala_id = $1 and militar_id = $2 group by origem, servico_id', [rodada.escalaId, ids.a1]);
    expect(rows).toEqual([{ origem: 'distribuicao', servico_id: rodada.saldo, n: 8 }]);
  });

  it('abrir de novo mantém os lançamentos', async () => {
    const e: EscalaDosOficiais = await (await abrir('2027-01')).json();
    expect(e.oficiais[0]!.escolhidos).toBe(8);
    expect(e.turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(8);
  });

  it('a ordem manual refaz as cotas e também mantém os lançamentos', async () => {
    const r = await api.pedir('gestorGb', 'PUT', rota('2027-01', '/ordem'), { militarIds: [ids.a1!] });
    expect(r.status).toBe(200);
    expect((await ler('2027-01')).turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(8);
  });

  it('um afastamento lançado depois do lugar gera o aviso, e fechar continua 200', async () => {
    // lança a4 no dia 20 (ainda sem afastamento) e depois o afastamento cai em cima do lugar: o aviso aparece, e a API não recusa o que já estava lançado
    expect((await lancar('2027-01', '2027-01-20', 'A', ids.a4!)).status).toBe(200);
    const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    const af = await inserir(api.banco, 'afastamento', { militar_id: ids.a4, tipo_afastamento_id: ferias, inicio: '2027-01-20', fim: '2027-01-20' });
    const e = await ler('2027-01');
    expect(e.avisos).toEqual([
      { dia: '2027-01-20', turnoId: rodada.saldoA, militarId: ids.a4, texto: 'CAP A4 está afastado em 20/01 (Férias) e está no turno do dia. A escala pode ser fechada mesmo assim.' },
    ]);
    await api.banco.query('delete from afastamento where id = $1', [af]);
    // devolve o lugar: o resto do roteiro lança as cotas certas
    expect((await tirar('2027-01', '2027-01-20', 'A')).status).toBe(200);
  });

  it('lança todos os lugares menos 10 e fecha: 200, etapa fechada, e abrir depois dá 409', async () => {
    for (let i = 8; i < 52; i++) expect((await lancar('2027-01', posicao(i).dia, posicao(i).letra, ids[dono(i)]!)).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-01', '/encerrar'))).status).toBe(409);
    const r = await api.pedir('gestorGb', 'POST', rota('2027-01', '/fechar'));
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.etapa).toBe('fechada');
    expect(e.turnos.filter((t) => t.militarId === null)).toHaveLength(10);
    const de_novo = await abrir('2027-01');
    expect(de_novo.status).toBe(409);
    expect((await de_novo.json()).erro).toBe('Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.');
    expect((await api.pedir('gestorGb', 'PUT', rota('2027-01', '/ordem'), { militarIds: [] })).status).toBe(409);
  });

  it('Review Focus 4: um afastamento lançado depois de fechar não muda a cota; só avisa', async () => {
    const antes = await ler('2027-01');
    const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    const af = await inserir(api.banco, 'afastamento', { militar_id: ids.a3, tipo_afastamento_id: ferias, inicio: '2027-01-10', fim: '2027-01-14' });
    const depois = await ler('2027-01');
    expect(depois.oficiais.map((o) => [o.cota, o.dias])).toEqual(antes.oficiais.map((o) => [o.cota, o.dias]));
    // os lugares que a3 já tem nesses dias avisam
    expect(depois.avisos.some((x) => x.militarId === ids.a3)).toBe(true);
    await api.banco.query('delete from afastamento where id = $1', [af]);
  });

  it('cobertura: A por B grava quem saiu; voltar a A limpa; tirar o nome deixa o lugar vazio', async () => {
    const { dia, letra } = posicao(10); // lugar de a2
    const lugar = async () => doLugar(await ler('2027-01'), dia, letra);
    expect(doLugar(await (await lancar('2027-01', dia, letra, ids.a3!)).json(), dia, letra)).toMatchObject({ militarId: ids.a3, saiuMilitarId: ids.a2 });
    await lancar('2027-01', dia, letra, ids.a2!);
    expect(await lugar()).toMatchObject({ militarId: ids.a2, saiuMilitarId: null });
    expect((await tirar('2027-01', dia, letra)).status).toBe(200);
    expect(await lugar()).toMatchObject({ militarId: null, saiuMilitarId: null, alocacaoId: null });
    await lancar('2027-01', dia, letra, ids.a2!);
    expect(await lugar()).toMatchObject({ militarId: ids.a2, saiuMilitarId: null });
  });

  it('completa os 10 lugares vazios depois de fechar e encerra: 8 lançamentos mes com os valores do motor', async () => {
    for (let i = 52; i < 62; i++) await lancar('2027-01', posicao(i).dia, posicao(i).letra, ids[dono(i)]!);
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
    expect((await lancar('2027-01', '2027-01-01', 'A', ids.a1!)).status).toBe(409);
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

  it('fechar sem abrir dá 409 com o texto', async () => {
    const r = await api.pedir('gestorGb', 'POST', rota('2027-02', '/fechar'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Abra o mês para lançar.');
  });

  it('um oficial que entra no mês seguinte ganha a entrada com a média, e o painel mostra o registro', async () => {
    await oficial('novato', 9, { quadro: 'QOA', desde: '2027-02-01' });
    // sem mês gravado, a escala é a do último mês da unidade
    expect((await ler('2027-02')).escala).toEqual({ id: rodada.escalaId, nome: 'Oficiais de operações' });
    expect((await abrir('2027-02')).status).toBe(200);
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
    expect((await abrir('2027-03')).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-05', 'A', ids.a2!)).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-03', '/fechar'))).status).toBe(200);
    expect((await lancar('2027-03', '2027-03-05', 'A', ids.a3!)).status).toBe(200);
    const lista = await painel();
    expect(lista.find((o) => o.militarId === ids.a3)!.registro.some((x) => x.tipo === 'cobriu' && x.texto === 'Cobriu CAP A2 em 05/03/2027.')).toBe(true);
    expect(lista.find((o) => o.militarId === ids.a2)!.registro.some((x) => x.tipo === 'saiu' && x.texto === 'Saiu em 05/03/2027; CAP A3 cobriu. Não fica devendo.')).toBe(true);
  });

  it('dois encerramentos ao mesmo tempo: um só vale', async () => {
    expect((await abrir('2027-04')).status).toBe(200);
    expect((await api.pedir('gestorGb', 'POST', rota('2027-04', '/fechar'))).status).toBe(200);
    const [a, b] = await Promise.all([api.pedir('gestorGb', 'POST', rota('2027-04', '/encerrar')), api.pedir('gestorGb', 'POST', rota('2027-04', '/encerrar'))]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const { rows } = await api.banco.query<{ n: number }>("select count(*)::int as n from oficiais_saldo s join oficiais_mes m on m.id = s.mes_id where m.mes = '2027-04-01' and s.tipo = 'mes'");
    expect(rows[0]!.n).toBe(9);
  });
});

describe('JES à mão e Saldo pela rodada (6.27)', () => {
  // maio de 2027: 31 dias, 62 lugares; o mês é aberto com os 9 oficiais (8 de antes e o novato)
  const voluntarios = ['a1', 'a2', 'f'];

  it('abrir o mês de maio: sem JES, a cota de saldo reparte os 62 lugares', async () => {
    await api.banco.query('update militar set voluntario_jes = true where id = any($1::uuid[])', [voluntarios.map((n) => ids[n])]);
    const e: EscalaDosOficiais = await (await abrir('2027-05')).json();
    expect(e.lugaresDeSaldo).toBe(62);
    expect(e.oficiais.reduce((s, o) => s + (o.cota ?? 0), 0)).toBe(62);
  });

  it('JES vale para todo elegível (na escala dos oficiais todos são voluntários por natureza, 6.29) e grava como alocação manual do serviço JES', async () => {
    const r = await lancar('2027-05', '2027-05-03', 'B', ids.a3!, 'jes');
    expect(r.status).toBe(200);
    expect((await tirar('2027-05', '2027-05-03', 'B')).status).toBe(200);
    const ok = await lancar('2027-05', '2027-05-03', 'A', ids.a1!, 'jes');
    expect(ok.status).toBe(200);
    const { rows } = await api.banco.query<{ origem: string; servico_id: string; turno_id: string }>(
      "select origem, servico_id, turno_id from alocacao where escala_id = $1 and data = '2027-05-03'", [rodada.escalaId]);
    expect(rows).toEqual([{ origem: 'manual', servico_id: rodada.jes, turno_id: rodada.jesA }]);
  });

  it('lançar JES refaz a cota de saldo sozinho: os lugares que sobram são 61, e o lugar mostra JES na placa', async () => {
    const e = await ler('2027-05');
    expect(e.lugaresDeSaldo).toBe(61);
    expect(e.oficiais.reduce((s, o) => s + (o.cota ?? 0), 0)).toBe(61);
    expect(doLugar(e, '2027-05-03', 'A')).toMatchObject({ servico: 'jes', militarId: ids.a1, turnoId: rodada.saldoA });
    expect(e.oficiais.find((o) => o.militarId === ids.a1)).toMatchObject({ jes: 1, escolhidos: 0, voluntarioJes: true });
    expect(e.oficiais.find((o) => o.militarId === ids.a3)!.voluntarioJes).toBe(false);
  });

  it('Review Focus 1: JES num lugar já tomado por Saldo, e Saldo num lugar de JES, são recusados e nada muda', async () => {
    expect((await lancar('2027-05', '2027-05-04', 'B', ids.a2!)).status).toBe(200); // Saldo de a2
    const jesNoSaldo = await lancar('2027-05', '2027-05-04', 'B', ids.a1!, 'jes');
    expect(jesNoSaldo.status).toBe(409);
    expect((await jesNoSaldo.json()).erro).toBe('Este lugar já está tomado por Saldo.');
    const saldoNoJes = await lancar('2027-05', '2027-05-03', 'A', ids.a2!);
    expect(saldoNoJes.status).toBe(409);
    expect((await saldoNoJes.json()).erro).toBe('Este lugar já está tomado por JES.');
    const e = await ler('2027-05');
    expect(doLugar(e, '2027-05-04', 'B')).toMatchObject({ servico: 'saldo', militarId: ids.a2 });
    expect(doLugar(e, '2027-05-03', 'A')).toMatchObject({ servico: 'jes', militarId: ids.a1 });
    expect(e.lugaresDeSaldo).toBe(61);
  });

  it('Review Focus 2: tirar um JES com o mês aberto devolve o lugar à rodada e refaz as cotas, mantendo as escolhas de quem continua', async () => {
    const r = await tirar('2027-05', '2027-05-03', 'A');
    expect(r.status).toBe(200);
    const e: EscalaDosOficiais = await r.json();
    expect(e.liberados).toEqual([]);
    expect(e.lugaresDeSaldo).toBe(62);
    expect(e.oficiais.reduce((s, o) => s + (o.cota ?? 0), 0)).toBe(62);
    expect(doLugar(e, '2027-05-03', 'A')).toMatchObject({ servico: null, militarId: null });
    expect(e.oficiais.find((o) => o.militarId === ids.a2)!.escolhidos).toBe(1);
  });

  it('a ordem é só uma sugestão: Saldo fora da vez grava e devolve o aviso; para o da vez, sem aviso', async () => {
    // a vez é de a1 (nenhum Saldo lançado por ele em maio)
    const fora = await lancar('2027-05', '2027-05-10', 'A', ids.a3!);
    expect(fora.status).toBe(200);
    const e: EscalaDosOficiais = await fora.json();
    expect(e.foraDaOrdem).toBe('Fora da ordem: a vez era de CAP A1.');
    expect(doLugar(e, '2027-05-10', 'A')).toMatchObject({ militarId: ids.a3 });
    const certo: EscalaDosOficiais = await (await lancar('2027-05', '2027-05-10', 'B', ids.a1!)).json();
    expect(certo.foraDaOrdem).toBeUndefined();
  });

  it('Review Focus 3: mudar a antiguidade de quem já participa refaz a ordem na hora, sem desmarcar e marcar', async () => {
    const antes = (await ler('2027-05')).oficiais.map((o) => o.nomeGuerra);
    expect(antes.slice(0, 5)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    // a5 passa à frente de a1 (mesmo posto, antiguidade menor)
    await api.banco.query('update militar set antiguidade = 0 where id = $1', [ids.a5]);
    const depois = await ler('2027-05');
    expect(depois.oficiais.map((o) => o.nomeGuerra).slice(0, 5)).toEqual(['A5', 'A1', 'A2', 'A3', 'A4']);
    expect(depois.oficiais[0]!.ordem).toBe(1);
    // voltando a antiguidade, a ordem volta
    await api.banco.query('update militar set antiguidade = 5 where id = $1', [ids.a5]);
    expect((await ler('2027-05')).oficiais.map((o) => o.nomeGuerra).slice(0, 5)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });

  it('um afastamento lançado com o mês aberto refaz as cotas sozinho (a presença do oficial muda)', async () => {
    const antes = (await ler('2027-05')).oficiais.find((o) => o.militarId === ids.a4)!;
    const ferias = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    const af = await inserir(api.banco, 'afastamento', { militar_id: ids.a4, tipo_afastamento_id: ferias, inicio: '2027-05-01', fim: '2027-05-15' });
    const depois = (await ler('2027-05')).oficiais.find((o) => o.militarId === ids.a4)!;
    expect(depois.dias).toBe(antes.dias - 15);
    expect(depois.cota!).toBeLessThan(antes.cota!);
    await api.banco.query('delete from afastamento where id = $1', [af]);
    expect((await ler('2027-05')).oficiais.find((o) => o.militarId === ids.a4)!.dias).toBe(antes.dias);
  });
});

describe('revisão final da 6.27', () => {
  it('as telas das praças não mostram nem mexem na escala dos oficiais: Grade, Escala do mês, remover e trocar', async () => {
    // a3 tem Saldo em 2027-05-10 (nos testes de maio)
    const aloc = (await api.banco.query<{ id: string }>("select id from alocacao where escala_id = $1 and militar_id = $2 and data = '2027-05-10'", [rodada.escalaId, ids.a3])).rows[0]!.id;
    const grade = JSON.stringify(await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/grade/2027-05`)).json());
    expect(grade).not.toContain('"A3"');
    const aviso = 'Esta escala é uma rodada de cotas: os lançamentos dela são feitos em Oficiais.';
    for (const [m, c, corpo] of [
      ['POST', `/api/escalas/${rodada.escalaId}/alocacoes`, { militarId: ids.a3, servicoId: rodada.saldo, turnoId: rodada.saldoA, data: '2027-05-11' }],
      ['DELETE', `/api/alocacoes/${aloc}`, undefined],
      ['POST', `/api/alocacoes/${aloc}/trocar`, { militarId: ids.a2 }],
      ['POST', `/api/alocacoes/${aloc}/acumulos`, {}],
    ] as const) {
      const r = await api.pedir('gestorGb', m, c, corpo);
      expect(r.status, `${m} ${c}`).toBe(409);
      expect((await r.json()).erro).toBe(aviso);
    }
    expect((await api.banco.query('select 1 from alocacao where id = $1', [aloc])).rows).toHaveLength(1);
  });

  it('fechar a escala e lançar JES não apagam o Saldo de quem deixou de ser elegível: só refazem a cota dos que estão na rodada', async () => {
    expect((await abrir('2027-09')).status).toBe(200);
    for (const dia of ['2027-09-01', '2027-09-02']) expect((await lancar('2027-09', dia, 'A', ids.a1!)).status).toBe(200);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Desativado') where militar_id = $1", [ids.a1]);
    // um JES lançado agora refaz a cota, mas o Saldo de a1 fica onde estava
    const jes = await lancar('2027-09', '2027-09-05', 'A', ids.a2!, 'jes');
    expect(jes.status).toBe(200);
    expect(((await jes.json()) as EscalaDosOficiais).liberados).toEqual([]);
    const fechada: EscalaDosOficiais = await (await api.pedir('gestorGb', 'POST', rota('2027-09', '/fechar'))).json();
    expect(fechada.liberados).toEqual([]);
    expect(fechada.turnos.filter((t) => t.militarId === ids.a1)).toHaveLength(2);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Ativa') where militar_id = $1", [ids.a1]);
  });

  it('um lançamento de um serviço antigo da escala (migrado) conta como Saldo: trocar o nome nele funciona', async () => {
    const antigo = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Oficial antigo', tipo: 'ordinario', cor: '#336699' });
    const turnoAntigo = await inserir(api.banco, 'turno', { servico_id: antigo, letra: 'A', inicio: '07:00', fim: '19:00' });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 3)', [rodada.escalaId, antigo]);
    expect((await abrir('2027-10')).status).toBe(200);
    await inserir(api.banco, 'alocacao', { militar_id: ids.a2, escala_id: rodada.escalaId, servico_id: antigo, turno_id: turnoAntigo, data: '2027-10-03', origem: 'distribuicao' });
    const r = await lancar('2027-10', '2027-10-03', 'A', ids.a3!);
    expect(r.status).toBe(200);
    expect(doLugar(await r.json(), '2027-10-03', 'A')).toMatchObject({ servico: 'saldo', militarId: ids.a3 });
  });
});

describe('correções da revisão final', () => {
  it('quem sai da lista num novo cálculo não deixa lugares com o nome dele: os lugares ficam vazios', async () => {
    expect((await abrir('2027-07')).status).toBe(200);
    for (const dia of ['2027-07-01', '2027-07-02']) expect((await lancar('2027-07', dia, 'A', ids.a1!)).status).toBe(200);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Desativado') where militar_id = $1", [ids.a1]);
    const e: EscalaDosOficiais = await (await abrir('2027-07')).json();
    expect(e.oficiais.some((o) => o.militarId === ids.a1)).toBe(false);
    expect(e.turnos.filter((t) => t.militarId === ids.a1 || t.saiuMilitarId === ids.a1)).toHaveLength(0);
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Ativa') where militar_id = $1", [ids.a1]);
  });
});
