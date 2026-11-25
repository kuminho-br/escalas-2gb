import { somarMeses, type EscalaDoMes, type EscalaVisivel, type MinhaEscala, type RegistroDeAlteracao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { registrar } from '../src/registro.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 7.3.1, Task 3: quem vê cada estado da escala. Cenário fictício (D7): a 1ª SB tem duas escalas (a Ordinário, que terá a prévia lançada, e a Rascunho, que não), a dos oficiais e a ABT
// (Motorista e Combatente); a SEC-OUTRA, irmã dela, tem a escala "Da outra", que traz o militar PEDRO da 1ª SB como externo. O PEDRO tem conta e não tem nível de acesso (o militar comum).
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
const MSG_NAO_ABERTA = 'Esta escala não está aberta para você.';
const lancar = (id: string, m = mes) => api.pedir('escalante', 'POST', `/api/escalas/${id}/mes/${m}/previa`);
const publicar = (id: string, m = mes) => api.pedir('gestorGb', 'POST', `/api/escalas/${id}/mes/${m}/publicar`);
/** Volta a escala do mês a rascunho (apaga a linha do estado): a API não tem essa passagem, só o teste precisa dela para reusar o cenário. */
const rascunhar = (id: string, m = mes) => api.banco.query('delete from escala_estado where escala_id = $1 and mes = $2::date', [id, `${m}-01`]);
const poNoEstado = (id: string, estado: string, emRetificacao = false) =>
  api.banco.query('insert into escala_estado (escala_id, mes, estado, em_retificacao) values ($1, $2::date, $3, $4) on conflict (escala_id, mes) do update set estado = $3, em_retificacao = $4', [id, `${mes}-01`, estado, emRetificacao]);
const lista = async (quem: Pessoa = pedro, m = mes): Promise<EscalaVisivel[]> => (await quem.pedir('GET', `/api/visualizacao/escalas/${m}`)).json();
const daPrevia = (quem: Pessoa, id: string, m = mes) => quem.pedir('GET', `/api/visualizacao/escalas/${id}/mes/${m}`);
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

describe('o que a conta lê de cada estado', () => {
  it('rascunho: a lista do mês é vazia e a escala não abre para o militar comum (404 com a frase fixa)', async () => {
    expect(await lista()).toEqual([]);
    const r = await daPrevia(pedro, ordinario);
    expect(r.status).toBe(404);
    expect(((await r.json()) as { erro: string }).erro).toBe(MSG_NAO_ABERTA);
  });

  it('prévia: o militar lotado na unidade vê na lista (com a unidade, o mês, o estado e quando) e abre a escala em leitura; o rascunho continua escondido', async () => {
    expect((await lancar(ordinario)).status).toBe(200);
    const l = await lista();
    expect(l).toEqual([expect.objectContaining({ escalaId: ordinario, nome: 'Ordinário', unidadeId: api.ids.secao, unidadeSigla: '1ª SB', mes, estado: 'previa', emRetificacao: false, dosOficiais: false })]);
    expect(Date.now() - new Date(l[0]!.em).getTime()).toBeLessThan(60_000);
    const r = await daPrevia(pedro, ordinario);
    expect(r.status).toBe(200);
    const e = (await r.json()) as EscalaDoMes;
    expect(e).toMatchObject({ escalaId: ordinario, mes, podeAlterarPassado: false, podePublicar: false, estado: { estado: 'previa' } });
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
    expect((await api.app.request(`http://localhost:8787/api/visualizacao/escalas/${mes}`, { headers: { Origin: 'http://localhost:8787' } })).status).toBe(401);
  });

  it('o mês fora do formato é 400; escala inexistente é 404', async () => {
    expect((await pedro.pedir('GET', '/api/visualizacao/escalas/2026-13')).status).toBe(400);
    expect((await daPrevia(pedro, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await daPrevia(pedro, ordinario, '2026-13')).status).toBe(400);
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

  it('o registro já gravado continua legível em qualquer estado (aqui, com a escala publicada)', async () => {
    await poNoEstado(ordinario, 'publicada');
    expect((await (await api.pedir('escalante', 'GET', `/api/escalas/${ordinario}/mes/${mes}/registro`)).json() as unknown[]).length).toBe(2);
    await poNoEstado(ordinario, 'previa');
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

  it('o serviço numa escala em rascunho não aparece; na prévia, passa a aparecer com o estado, e em retificação traz a marca', async () => {
    expect((await minha()).servicos.some((x) => x.escala === 'Rascunho')).toBe(false);
    await lancar(rascunho);
    const naPrevia = (await minha()).servicos.find((x) => x.data === dia(7))!;
    expect(naPrevia).toMatchObject({ estado: 'previa', emRetificacao: false });
    await publicar(rascunho);
    expect((await minha()).servicos.find((x) => x.data === dia(7))).toMatchObject({ estado: 'publicada', emRetificacao: false });
    await poNoEstado(rascunho, 'publicada', true);
    expect((await minha()).servicos.find((x) => x.data === dia(7))).toMatchObject({ estado: 'publicada', emRetificacao: true });
    await rascunhar(rascunho);
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

describe('quem vê cada estado (Review Focus 3)', () => {
  let acima: Pessoa;
  let irma: Pessoa;
  let oficialDaSecao: Pessoa;
  let naSecao: Pessoa;
  beforeAll(async () => {
    const lotar = async (p: Pessoa, unidadeId: string, quadro: string | null = null) =>
      inserir(api.banco, 'rastreio', { militar_id: p.militarId, unidade_id: unidadeId, jornada: 'adm', desde: `${atual}-01`, ...(quadro ? { quadro_id: quadro } : {}) });
    acima = await entrarComo(api, { matricula: '990991-1', nome: 'ACIMA' });
    await lotar(acima, api.ids.gb);
    irma = await entrarComo(api, { matricula: '990992-2', nome: 'IRMA' });
    await lotar(irma, outra);
    naSecao = await entrarComo(api, { matricula: '990993-3', nome: 'NASECAO' });
    await lotar(naSecao, api.ids.secao);
    oficialDaSecao = await entrarComo(api, { matricula: '990994-4', nome: 'OFICIAL', posto: 'CAP' });
    const qoc = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QOC'")).rows[0]!.id;
    await lotar(oficialDaSecao, api.ids.secao, qoc);
  });

  it('prévia: o militar lotado na unidade (ou abaixo dela) vê; o lotado em unidade acima ou irmã não vê', async () => {
    await poNoEstado(ordinario, 'previa');
    expect((await daPrevia(naSecao, ordinario)).status).toBe(200);
    expect((await lista(naSecao)).some((x) => x.escalaId === ordinario)).toBe(true);
    for (const quem of [acima, irma]) {
      const r = await daPrevia(quem, ordinario);
      expect(r.status).toBe(404);
      expect(((await r.json()) as { erro: string }).erro).toBe(MSG_NAO_ABERTA);
      expect((await lista(quem)).some((x) => x.escalaId === ordinario)).toBe(false);
    }
  });

  it('prévia: o militar de OUTRA unidade que está escalado nela naquele mês vê (o PEDRO, da 1ª SB, na escala da SEC-OUTRA)', async () => {
    await poNoEstado(daOutra, 'previa');
    expect((await daPrevia(pedro, daOutra)).status).toBe(200);
    expect((await lista(pedro)).some((x) => x.escalaId === daOutra)).toBe(true);
    // quem é da 1ª SB e não está escalado nela não vê
    expect((await daPrevia(naSecao, daOutra)).status).toBe(404);
  });

  it('prévia dos oficiais: só o oficial lotado na unidade vê; o militar não oficial lotado na mesma unidade, não', async () => {
    await poNoEstado(oficiais, 'previa');
    expect((await daPrevia(oficialDaSecao, oficiais)).status).toBe(200);
    expect((await lista(oficialDaSecao)).find((x) => x.escalaId === oficiais)).toMatchObject({ dosOficiais: true, estado: 'previa' });
    expect((await daPrevia(naSecao, oficiais)).status).toBe(404);
    expect((await lista(naSecao)).some((x) => x.escalaId === oficiais)).toBe(false);
  });

  it('publicada, retificada e remessada: toda conta lê (a de cima, a irmã, o não oficial até a escala dos oficiais), e a lista traz o estado e a etiqueta de retificação', async () => {
    for (const [estado, emRetificacao] of [['publicada', false], ['retificada', false], ['publicada', true], ['remessada', false]] as const) {
      await poNoEstado(ordinario, estado, emRetificacao);
      await poNoEstado(oficiais, estado, emRetificacao);
      for (const quem of [acima, irma, naSecao]) {
        expect((await daPrevia(quem, ordinario)).status, `${estado} ordinário`).toBe(200);
        expect((await daPrevia(quem, oficiais)).status, `${estado} oficiais`).toBe(200);
        expect((await lista(quem)).find((x) => x.escalaId === ordinario), estado).toMatchObject({ estado, emRetificacao });
      }
      expect(((await (await daPrevia(irma, ordinario)).json()) as EscalaDoMes).estado).toMatchObject({ estado, emRetificacao });
    }
    await poNoEstado(ordinario, 'previa');
    await poNoEstado(oficiais, 'previa');
  });

  it('rascunho: o militar comum recebe 404, e quem tem nível de acesso na unidade lê pela rota de montagem de hoje', async () => {
    await rascunhar(rascunho);
    expect((await daPrevia(pedro, rascunho)).status).toBe(404);
    expect((await daPrevia(naSecao, rascunho)).status).toBe(404);
    expect((await lista(pedro)).some((x) => x.escalaId === rascunho)).toBe(false);
    expect((await api.pedir('escalante', 'GET', `/api/escalas/${rascunho}/mes/${mes}`)).status).toBe(200);
  });

  it('quem lê a escala em montagem por nível de acesso lê em qualquer estado (aqui, o escalante pela rota da corporação, até na prévia de outra seção)', async () => {
    await poNoEstado(ordinario, 'previa');
    expect((await api.pedir('escalante', 'GET', `/api/visualizacao/escalas/${ordinario}/mes/${mes}`)).status).toBe(200);
    expect((await api.pedir('escalante', 'GET', `/api/visualizacao/escalas/${rascunho}/mes/${mes}`)).status).toBe(200);
  });
});
