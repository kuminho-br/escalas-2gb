import { somarMeses, type EscalaDoMes, type MinhaEscala, type PreviaDaLista, type RegistroDeAlteracao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { registrar } from '../src/registro.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Cenário fictício (D7): a 1ª SB tem duas escalas (a Ordinário, que terá a prévia lançada, e a Rascunho, que não) e a ABT (Motorista e Combatente); a SEC-OUTRA, irmã dela,
// tem a escala "Da outra", que traz o militar PEDRO da 1ª SB como externo. O PEDRO tem conta e não tem nível de acesso (o militar comum).
let api: ApiDeTeste;
let ordinario: string;
let rascunho: string;
let daOutra: string;
let oficiais: string;
let outra: string;
let turnoA: string;
let turnoOutra: string;
let abt: string;
let motorista: string;
let combatente: string;
let pedro: Pessoa;
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const dia = (n: number) => `${mes}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;
const A = { inicio: '08:00', fim: '20:00' };
const MSG_SEM_PREVIA = 'Esta escala ainda não tem prévia lançada.';
const lancar = (id: string, m = mes) => api.pedir('escalante', 'POST', `/api/escalas/${id}/mes/${m}/previa`);
const recolher = (id: string, m = mes) => api.pedir('escalante', 'DELETE', `/api/escalas/${id}/mes/${m}/previa`);
const lista = async (quem: Pessoa = pedro, m = mes): Promise<PreviaDaLista[]> => (await quem.pedir('GET', `/api/previas/${m}`)).json();
const daPrevia = (quem: Pessoa, id: string, m = mes) => quem.pedir('GET', `/api/previas/escalas/${id}/mes/${m}`);
const minha = async (quem: Pessoa = pedro, m = mes): Promise<MinhaEscala> => (await quem.pedir('GET', `/api/eu/escala/${m}`)).json();

let seq = 0;
async function criarMilitar(nome: string, unidadeId = api.ids.secao, cnh: string[] = []) {
  seq++;
  militar[nome] = await inserir(api.banco, 'militar', {
    matricula: `99${String(9000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, motorista: cnh.length > 0, cnh, voluntario_jes: false,
  });
  await inserir(api.banco, 'rastreio', { militar_id: militar[nome], unidade_id: unidadeId, equipe_id: null, jornada: 'pronto', desde: `${atual}-01` });
}
let posto: string;
const escalar = (escalaId: string, nome: string, d: number, o: { turno?: string; guarnicao?: string | null; funcao?: string | null } = {}) =>
  api.pedir('admin', 'POST', `/api/escalas/${escalaId}/alocacoes`, {
    militarId: militar[nome], data: dia(d), turnoId: o.turno ?? turnoA, guarnicaoId: o.guarnicao === undefined ? abt : o.guarnicao, funcaoId: o.funcao === undefined ? combatente : o.funcao,
  });

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-PV', nome: 'Soldado PV', ordem: 942 });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'A', ...A })).json()).turnos[0].id;
  abt = (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome: 'ABT', vigencia: mes, versao: { viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }] },
  })).json()).id;
  const escala = async (nome: string) => {
    const id = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome })).json()).id as string;
    await api.pedir('escalante', 'PUT', `/api/escalas/${id}/servicos`, { servicoIds: [s.id] });
    await api.pedir('escalante', 'PUT', `/api/escalas/${id}/vinculos/${mes}`, { itens: [{ guarnicaoId: abt, ...A }] });
    return id;
  };
  ordinario = await escala('Ordinário');
  rascunho = await escala('Rascunho');
  // a escala dos oficiais é uma escala comum de rodada de cotas
  oficiais = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Oficiais', titulo: 'Oficiais', militares_doc: 'todos', dias_doc: 'todos', distribuicao: 'rodada_de_cotas' });
  await inserir(api.banco, 'escala_servico', { escala_id: oficiais, servico_id: s.id, ordem: 1 }, 'escala_id');
  // a seção irmã, que traz o PEDRO como externo
  outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEC-OUTRA', nome: 'Seção da outra escala', mae_id: api.ids.gb, desde: '2026-11-01' });
  const so = await inserir(api.banco, 'servico', { unidade_id: outra, nome: 'Plantão', tipo: 'ordinario', cor: '#3C5F9C' });
  turnoOutra = await inserir(api.banco, 'turno', { servico_id: so, letra: 'A', inicio: '08:00', fim: '20:00' });
  daOutra = await inserir(api.banco, 'escala', { unidade_id: outra, nome: 'Da outra', titulo: 'Da outra', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(api.banco, 'escala_servico', { escala_id: daOutra, servico_id: so, ordem: 1 }, 'escala_id');
  for (const nome of ['MOTORISTA', 'COLEGA', 'SEMGUARNICAO']) await criarMilitar(nome, api.ids.secao, nome === 'MOTORISTA' ? ['D'] : []);
  pedro = await entrarComo(api, { matricula: '990981-1', nome: 'PEDRO' });
  await inserir(api.banco, 'rastreio', { militar_id: pedro.militarId, unidade_id: api.ids.secao, jornada: 'pronto', desde: `${atual}-01` });
  militar.PEDRO = pedro.militarId;
  // a ABT do dia 6: o PEDRO (Combatente), o COLEGA (Combatente) e o MOTORISTA; o PEDRO também no dia 9 sem guarnição; e na escala Rascunho (dia 7)
  expect((await escalar(ordinario, 'PEDRO', 6)).status).toBe(201);
  expect((await escalar(ordinario, 'COLEGA', 6)).status).toBe(201);
  expect((await escalar(ordinario, 'MOTORISTA', 6, { funcao: motorista })).status).toBe(201);
  expect((await escalar(ordinario, 'PEDRO', 9, { guarnicao: null, funcao: null })).status).toBe(201);
  expect((await escalar(rascunho, 'PEDRO', 7)).status).toBe(201);
  await inserir(api.banco, 'alocacao', { militar_id: pedro.militarId, escala_id: daOutra, servico_id: (await api.banco.query<{ servico_id: string }>('select servico_id from turno where id = $1', [turnoOutra])).rows[0]!.servico_id, turno_id: turnoOutra, data: dia(12), origem: 'manual' });
  await inserir(api.banco, 'alocacao', { militar_id: pedro.militarId, escala_id: oficiais, servico_id: (await api.banco.query<{ servico_id: string }>('select servico_id from turno where id = $1', [turnoA])).rows[0]!.servico_id, turno_id: turnoA, data: dia(15), origem: 'manual' });
});
afterAll(async () => {
  await api.fechar();
});

describe('as prévias lançadas, lidas por qualquer conta', () => {
  it('sem prévia lançada, a lista do mês é vazia e a escala não abre (404 com a frase fixa)', async () => {
    expect(await lista()).toEqual([]);
    const r = await daPrevia(pedro, ordinario);
    expect(r.status).toBe(404);
    expect(((await r.json()) as { erro: string }).erro).toBe(MSG_SEM_PREVIA);
  });

  it('lançada, o militar comum vê na lista (com a unidade, o mês e quando) e abre a escala em leitura; a que não foi lançada continua escondida', async () => {
    expect((await lancar(ordinario)).status).toBe(200);
    const l = await lista();
    expect(l).toEqual([expect.objectContaining({ escalaId: ordinario, nome: 'Ordinário', unidadeId: api.ids.secao, unidadeSigla: '1ª SB', mes, dosOficiais: false })]);
    expect(Date.now() - new Date(l[0]!.lancadaEm).getTime()).toBeLessThan(60_000);
    const r = await daPrevia(pedro, ordinario);
    expect(r.status).toBe(200);
    const e = (await r.json()) as EscalaDoMes;
    expect(e).toMatchObject({ escalaId: ordinario, mes, podeAlterarPassado: false });
    const combatentes = e.dias[5]!.faixas[0]!.guarnicoes[0]!.funcoes.find((f) => f.funcao === 'Combatente')!.ocupantes.map((o) => o.nomeGuerra).sort();
    expect(combatentes).toEqual(['COLEGA', 'PEDRO']);
    expect((await daPrevia(pedro, rascunho)).status).toBe(404);
  });

  it('a leitura da corporação não traz a matrícula, a cota de saldo, as pendências de montagem nem as remoções', async () => {
    const e = (await (await daPrevia(pedro, ordinario)).json()) as EscalaDoMes;
    const todos = e.dias.flatMap((d) => d.faixas.flatMap((f) => [...f.guarnicoes.flatMap((g) => g.funcoes.flatMap((fn) => fn.ocupantes)), ...f.semPosto]));
    expect(todos.length).toBeGreaterThan(0);
    for (const o of todos) {
      expect(o.matricula).toBe('');
      expect(o.saldos).toBeUndefined();
    }
    expect(e.dias.every((d) => d.obrigatoriasVazias === 0 && d.faixas.every((f) => f.removidos.length === 0 && f.guarnicoes.every((g) => g.completa && g.faltam.length === 0)))).toBe(true);
    expect(e.resumo).toEqual({ preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 });
  });

  it('sem sessão, 401', async () => {
    expect((await api.app.request(`http://localhost:8787/api/previas/${mes}`, { headers: { Origin: 'http://localhost:8787' } })).status).toBe(401);
  });

  it('o mês fora do formato é 400; escala inexistente é 404', async () => {
    expect((await pedro.pedir('GET', '/api/previas/2026-13')).status).toBe(400);
    expect((await daPrevia(pedro, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await daPrevia(pedro, ordinario, '2026-13')).status).toBe(400);
  });

  it('Review Focus 5: a escala dos oficiais, lançada, aparece como "dos oficiais" e qualquer conta a lê; não lançada, 404', async () => {
    expect((await daPrevia(pedro, oficiais)).status).toBe(404);
    expect((await lancar(oficiais)).status).toBe(200);
    expect((await lista()).find((x) => x.escalaId === oficiais)).toMatchObject({ dosOficiais: true });
    expect((await daPrevia(pedro, oficiais)).status).toBe(200);
    await recolher(oficiais);
  });

  it('Review Focus 4: recolhida, a escala some da lista e a leitura volta a 404', async () => {
    expect((await recolher(ordinario)).status).toBe(200);
    expect(await lista()).toEqual([]);
    expect((await daPrevia(pedro, ordinario)).status).toBe(404);
    await lancar(ordinario);
  });

  it('a lista é do mês pedido, de todas as unidades que não foram extintas', async () => {
    expect(await lista(pedro, somarMeses(mes, 1))).toEqual([]);
    expect((await api.pedir('admin', 'POST', `/api/escalas/${daOutra}/mes/${mes}/previa`)).status).toBe(200);
    expect((await lista()).map((x) => x.unidadeSigla).sort()).toEqual(['1ª SB', 'SEC-OUTRA']);
    await api.banco.query('update unidade set ate = $2 where id = $1', [outra, '2026-11-02']);
    expect((await lista()).map((x) => x.unidadeSigla)).toEqual(['1ª SB']);
    await api.banco.query('update unidade set ate = null where id = $1', [outra]);
  });
});

describe('o registro das alterações no passado', () => {
  let usuario: string;
  beforeAll(async () => {
    usuario = api.usuarios.gestorGb;
    const vaga = (militares: string[]) => ({ data: dia(6), inicio: '08:00', servico: 'Pronto', turno: 'A', guarnicao: 'ABT', funcao: 'Combatente', militares: militares.map((n) => ({ patente: 'SD-PV', nomeGuerra: n, matricula: '990000-0' })) });
    await registrar(api.banco, { usuarioId: usuario, unidadeId: api.ids.secao, tipo: 'escala_no_passado', escalaId: ordinario, mes, data: dia(6), antes: vaga(['COLEGA']), depois: vaga([]), justificativa: 'Afastado por motivo de saúde' });
    await registrar(api.banco, { usuarioId: usuario, unidadeId: api.ids.secao, tipo: 'escala_no_passado', escalaId: ordinario, mes, data: dia(6), antes: vaga([]), depois: vaga(['PEDRO']), justificativa: 'Cobertura de afastamento' });
  });

  it('quem tem nível de acesso na unidade lê, do mais novo para o mais velho, com a frase pronta e o motivo', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/escalas/${ordinario}/mes/${mes}/registro`);
    expect(r.status).toBe(200);
    const linhas = (await r.json()) as RegistroDeAlteracao[];
    expect(linhas.map((l) => l.texto)).toEqual(['Pôs SD-PV PEDRO em ABT (Combatente), dia 06, 08:00', 'Tirou SD-PV COLEGA de ABT (Combatente), dia 06, 08:00']);
    expect(linhas[0]).toMatchObject({ tipo: 'escala_no_passado', justificativa: 'Cobertura de afastamento', por: { nomeGuerra: 'GESTORGB' } });
  });

  it('o escalante de outra seção também não lê o registro (isolamento entre unidades): 403', async () => {
    const outroEscalante = await entrarComo(api, { matricula: '990984-4', nome: 'DEOUTRA', nivel: { papel: 'escalante', unidadeId: outra } });
    expect((await outroEscalante.pedir('GET', `/api/escalas/${ordinario}/mes/${mes}/registro`)).status).toBe(403);
    expect((await outroEscalante.pedir('GET', `/api/escalas/${daOutra}/mes/${mes}/registro`)).status).toBe(200);
  });

  it('o militar comum não lê o registro (403), mas lê a prévia', async () => {
    expect((await pedro.pedir('GET', `/api/escalas/${ordinario}/mes/${mes}/registro`)).status).toBe(403);
    expect((await daPrevia(pedro, ordinario)).status).toBe(200);
  });

  it('o registro é só da escala e do mês pedidos; escala inexistente é 404 e mês inválido é 400', async () => {
    expect(((await (await api.pedir('escalante', 'GET', `/api/escalas/${rascunho}/mes/${mes}/registro`)).json()) as unknown[])).toEqual([]);
    expect(((await (await api.pedir('escalante', 'GET', `/api/escalas/${ordinario}/mes/${somarMeses(mes, 1)}/registro`)).json()) as unknown[])).toEqual([]);
    expect((await api.pedir('escalante', 'GET', '/api/escalas/00000000-0000-4000-8000-000000000000/mes/' + mes + '/registro')).status).toBe(404);
    expect((await api.pedir('escalante', 'GET', `/api/escalas/${ordinario}/mes/2026-13/registro`)).status).toBe(400);
  });

  it('Review Focus 4: recolhida a prévia, o registro já gravado continua legível', async () => {
    await recolher(ordinario);
    expect((await (await api.pedir('escalante', 'GET', `/api/escalas/${ordinario}/mes/${mes}/registro`)).json() as unknown[]).length).toBe(2);
    await lancar(ordinario);
  });
});

describe('a minha escala', () => {
  it('traz os serviços do militar em prévias lançadas, em ordem de dia e hora, com a guarnição e quem a compõe (ele marcado)', async () => {
    const m = await minha();
    expect(m.mes).toBe(mes);
    // o dia 6 (ABT, Combatente), o dia 9 (sem guarnição) e o dia 12 (da outra seção, que traz o PEDRO como externo): a Rascunho (dia 7) e a dos oficiais (dia 15, não lançada) ficam de fora
    expect(m.servicos.map((x) => [x.data, x.escala, x.unidadeSigla])).toEqual([[dia(6), 'Ordinário', '1ª SB'], [dia(9), 'Ordinário', '1ª SB'], [dia(12), 'Da outra', 'SEC-OUTRA']]);
    expect(m.servicos[0]).toMatchObject({ inicio: '08:00', fim: '20:00', servico: 'Pronto', guarnicao: 'ABT', funcao: 'Combatente' });
    expect(m.servicos[0]!.composicao.map((c) => [c.nomeGuerra, c.funcao, c.eu]).sort()).toEqual([['COLEGA', 'Combatente', false], ['MOTORISTA', 'Motorista', false], ['PEDRO', 'Combatente', true]]);
    expect(m.servicos[0]!.composicao.map((c) => [c.nomeGuerra, c.patente]).sort()).toEqual([['COLEGA', 'SD-PV'], ['MOTORISTA', 'SD-PV'], ['PEDRO', 'SD']]);
    expect(m.servicos[1]).toMatchObject({ guarnicao: null, funcao: null, composicao: [] });
  });

  it('o serviço numa escala que não foi lançada não aparece; lançada, passa a aparecer; recolhida, some de novo', async () => {
    expect((await minha()).servicos.some((x) => x.escala === 'Rascunho')).toBe(false);
    await lancar(rascunho);
    expect((await minha()).servicos.map((x) => x.data)).toContain(dia(7));
    await recolher(rascunho);
    expect((await minha()).servicos.map((x) => x.data)).not.toContain(dia(7));
  });

  it('quem não tem serviço no mês recebe a lista vazia; o mês fora do formato é 400', async () => {
    const sem = await entrarComo(api, { matricula: '990982-2', nome: 'SEMSERVICO' });
    expect(await minha(sem)).toEqual({ mes, servicos: [] });
    expect((await pedro.pedir('GET', '/api/eu/escala/2026-13')).status).toBe(400);
  });

  it('cada conta lê só a própria escala', async () => {
    const outro = await entrarComo(api, { matricula: '990983-3', nome: 'OUTRO' });
    expect((await minha(outro)).servicos).toEqual([]);
  });
});
