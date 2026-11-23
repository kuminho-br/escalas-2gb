import type { NoDaEstrutura } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa, type Quem } from './apoio-api.ts';

// Entrega 6.10, Task 3: a estrutura do grupamento (divisões e seções). Só o gestor do grupamento e o administrador. Dados fictícios (D7).
let api: ApiDeTeste;
let da: string;
let divOp: string;
let sb1: string;
let chefe: Pessoa;
let outroGb: string;
let divisaoDeFora: string;
const mes = hojeRecife().slice(0, 7);
const AVISO_SIGLA = 'Já existe uma unidade com esta sigla neste grupamento.';

const arvore = async (quem: Quem = 'gestorGb', u = api.ids.gb) => api.pedir(quem, 'GET', `/api/unidades/${u}/estrutura`);
const mover = (secao: string, divisaoId: string | null, quem: Quem = 'gestorGb') => api.pedir(quem, 'PUT', `/api/secoes/${secao}/divisao`, { divisaoId });
const siglas = (n: NoDaEstrutura) => n.filhas.map((f) => f.sigla);
const filha = (n: NoDaEstrutura, sigla: string) => n.filhas.find((f) => f.sigla === sigla)!;
const auditorias = async () => (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'unidade'")).rows[0]!.n;
const ultimaAuditoria = async () =>
  (await api.banco.query<{ usuario: string; acao: string; registro: string }>(
    "select usuario_id::text as usuario, acao, registro_id as registro from auditoria where tabela = 'unidade' order by id desc limit 1")).rows[0]!;

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  sb1 = api.ids.secao;
  chefe = await entrarComo(api, { matricula: '990761-1', nome: 'CHEFEOP', nivel: { papel: 'chefe_divisao', unidadeId: divOp } });
  outroGb = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
  divisaoDeFora = await inserir(api.banco, 'unidade', { tipo: 'divisao', sigla: 'DivOp', nome: 'Divisão Operacional', mae_id: outroGb, desde: '2026-11-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('ver a estrutura', () => {
  it('a árvore traz o grupamento, com as divisões e as seções na ordem das siglas', async () => {
    const r = await arvore();
    expect(r.status).toBe(200);
    const gb: NoDaEstrutura = await r.json();
    expect(gb).toMatchObject({ id: api.ids.gb, sigla: '2º GB', tipo: 'grupamento' });
    expect(siglas(gb)).toEqual(['1ª SB', '2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB', 'DA', 'DivOp']);
    expect(filha(gb, 'DA')).toEqual({ id: da, sigla: 'DA', nome: 'Divisão Administrativa', tipo: 'divisao', filhas: [], cadastrosProprios: 0 });
    expect(filha(gb, '1ª SB')).toMatchObject({ id: sb1, tipo: 'secao', filhas: [] });
  });

  it('o administrador vê; o chefe de divisão, o auxiliar e o militar comum recebem 403', async () => {
    expect((await arvore('admin')).status).toBe(200);
    expect((await chefe.pedir('GET', `/api/unidades/${api.ids.gb}/estrutura`)).status).toBe(403);
    expect((await arvore('escalante')).status).toBe(403);
    expect((await arvore('semPapel')).status).toBe(403);
  });

  it('a estrutura é a de um grupamento: de outro tipo de unidade, 400', async () => {
    const r = await arvore('admin', sb1);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A estrutura é a de um grupamento.');
    expect((await arvore('admin', '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('a unidade extinta não aparece', async () => {
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    expect(siglas(await (await arvore()).json())).not.toContain('8ª SB');
    await api.banco.query('delete from unidade where id = $1', [extinta]);
  });
});

describe('criar e renomear uma divisão', () => {
  const criar = (corpo: unknown, quem: Quem = 'gestorGb', u = api.ids.gb) => api.pedir(quem, 'POST', `/api/unidades/${u}/divisoes`, corpo);
  const renomear = (id: string, corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'PATCH', `/api/divisoes/${id}`, corpo);

  it('o gestor do grupamento cria uma divisão, vazia, a partir do dia 1 do mês; entra na auditoria', async () => {
    const antes = await auditorias();
    const r = await criar({ sigla: ' DEns ', nome: 'Divisão de Ensino' });
    expect(r.status).toBe(201);
    const nova: NoDaEstrutura = await r.json();
    expect(nova).toEqual({ id: expect.any(String), sigla: 'DEns', nome: 'Divisão de Ensino', tipo: 'divisao', filhas: [], cadastrosProprios: 0 });
    const gravada = (await api.banco.query<{ tipo: string; mae_id: string; desde: string }>("select tipo, mae_id, to_char(desde, 'YYYY-MM-DD') as desde from unidade where id = $1", [nova.id])).rows[0]!;
    expect(gravada).toEqual({ tipo: 'divisao', mae_id: api.ids.gb, desde: `${mes}-01` });
    expect(await auditorias()).toBe(antes + 1);
    expect(await ultimaAuditoria()).toEqual({ usuario: api.usuarios.gestorGb, acao: 'insert', registro: nova.id });
    expect(siglas(await (await arvore()).json())).toContain('DEns');
  });

  it('a sigla repetida no mesmo grupamento, de divisão ou de seção, sem diferenciar maiúsculas, é 409 no campo', async () => {
    for (const sigla of ['da', '1ª sb']) {
      const r = await criar({ sigla, nome: 'Repetida' });
      expect(r.status).toBe(409);
      expect(await r.json()).toEqual({ erro: AVISO_SIGLA, campos: { sigla: AVISO_SIGLA } });
    }
    // a mesma sigla em outro grupamento não atrapalha (a DivOp do 9º GB existe)
    expect((await criar({ sigla: 'DLog', nome: 'Divisão de Logística' }, 'admin', outroGb)).status).toBe(201);
    expect((await criar({ sigla: 'DLog', nome: 'Divisão de Logística' })).status).toBe(201);
  });

  it('sigla ou nome vazios, ou longos demais, são 400', async () => {
    expect((await criar({ sigla: ' ', nome: 'Sem sigla' })).status).toBe(400);
    expect((await criar({ sigla: 'X', nome: '' })).status).toBe(400);
    expect((await criar({ sigla: 'S'.repeat(21), nome: 'Longa' })).status).toBe(400);
  });

  it('só se cria divisão num grupamento', async () => {
    const r = await criar({ sigla: 'DX', nome: 'Divisão X' }, 'admin', sb1);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A estrutura é a de um grupamento.');
  });

  it('renomear muda a sigla e o nome, e entra na auditoria', async () => {
    const id = filha(await (await arvore()).json(), 'DEns').id;
    const r = await renomear(id, { sigla: 'DEI', nome: 'Divisão de Ensino e Instrução' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id, sigla: 'DEI', nome: 'Divisão de Ensino e Instrução', tipo: 'divisao' });
    expect(await ultimaAuditoria()).toEqual({ usuario: api.usuarios.gestorGb, acao: 'update', registro: id });
    // a própria sigla, com outra caixa, não é repetição; a de outra unidade do grupamento é
    expect((await renomear(id, { sigla: 'dei', nome: 'Divisão de Ensino' })).status).toBe(200);
    const repetida = await renomear(id, { sigla: 'DivOp', nome: 'Divisão de Ensino' });
    expect(repetida.status).toBe(409);
    expect(await repetida.json()).toEqual({ erro: AVISO_SIGLA, campos: { sigla: AVISO_SIGLA } });
  });

  it('só divisão se renomeia aqui: seção, grupamento e id que não existe são 404', async () => {
    for (const id of [sb1, api.ids.gb, '00000000-0000-4000-8000-000000000000', 'x'])
      expect((await renomear(id, { sigla: 'Z', nome: 'Z' }, 'admin')).status).toBe(404);
  });

  it('quem não é gestor do grupamento recebe 403, e nada é gravado', async () => {
    const antes = await auditorias();
    const corpo = { sigla: 'DNeg', nome: 'Negada' };
    expect((await chefe.pedir('POST', `/api/unidades/${api.ids.gb}/divisoes`, corpo)).status).toBe(403);
    expect((await criar(corpo, 'escalante')).status).toBe(403);
    // o chefe não renomeia nem a própria divisão; o gestor do 2º GB não mexe na divisão do 9º GB
    expect((await chefe.pedir('PATCH', `/api/divisoes/${divOp}`, corpo)).status).toBe(403);
    expect((await renomear(divisaoDeFora, corpo)).status).toBe(403);
    expect((await criar(corpo, 'gestorGb', outroGb)).status).toBe(403);
    expect(await auditorias()).toBe(antes);
  });
});

describe('pôr uma seção numa divisão', () => {
  const caminhoDentro = async (filhaId: string, maeId: string) =>
    (await api.banco.query<{ ok: boolean }>('select f.caminho <@ m.caminho as ok from unidade f, unidade m where f.id = $1 and m.id = $2', [filhaId, maeId])).rows[0]!.ok;
  const feriado = (dia: string) => ({ data: `${mes}-${dia}`, descricao: `Teste ${dia}`, fixo: false });

  it('mover a 1ª SB para a DivOp: a árvore e o caminho acompanham, e a mudança entra na auditoria', async () => {
    const r = await mover(sb1, divOp);
    expect(r.status).toBe(200);
    const gb: NoDaEstrutura = await r.json();
    expect(gb.id).toBe(api.ids.gb);
    expect(siglas(filha(gb, 'DivOp'))).toEqual(['1ª SB']);
    expect(siglas(gb)).not.toContain('1ª SB');
    expect(await caminhoDentro(sb1, divOp)).toBe(true);
    expect(await caminhoDentro(sb1, api.ids.gb)).toBe(true);
    expect(await ultimaAuditoria()).toEqual({ usuario: api.usuarios.gestorGb, acao: 'update', registro: sb1 });
  });

  it('quem já alcançava a seção de cima continua alcançando: o auxiliar da seção e o gestor do grupamento', async () => {
    expect((await api.pedir('escalante', 'GET', `/api/unidades/${sb1}/feriados`)).status).toBe(200);
    expect((await api.pedir('gestorGb', 'GET', `/api/unidades/${sb1}/feriados`)).status).toBe(200);
  });

  it('com gente logada: o chefe da DivOp edita na 1ª SB; movida para a DA, o pedido seguinte dele é 403, na mesma sessão (Review Focus 1)', async () => {
    const militar = await criarMilitar(api, { matricula: '990762-2', email: null, unidadeId: sb1 });
    expect((await chefe.pedir('POST', `/api/unidades/${sb1}/feriados`, feriado('10'))).status).toBe(201);
    expect((await chefe.pedir('GET', `/api/militares/${militar}`)).status).toBe(200);
    expect((await mover(sb1, da)).status).toBe(200);
    expect((await chefe.pedir('POST', `/api/unidades/${sb1}/feriados`, feriado('11'))).status).toBe(403);
    expect((await chefe.pedir('GET', `/api/unidades/${sb1}/feriados`)).status).toBe(403);
    // os registros de baixo da seção acompanham: a ficha do militar da seção também fecha
    expect((await chefe.pedir('GET', `/api/militares/${militar}`)).status).toBe(403);
    expect((await chefe.pedir('GET', '/api/eu').then((x) => x.json())).unidades.map((u: { sigla: string }) => u.sigla)).toEqual(['DivOp']);
  });

  it('"sem divisão" devolve a seção ao grupamento', async () => {
    const r = await mover(sb1, null);
    expect(r.status).toBe(200);
    const gb: NoDaEstrutura = await r.json();
    expect(siglas(gb)).toContain('1ª SB');
    expect(filha(gb, 'DA').filhas).toEqual([]);
    expect((await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [sb1])).rows[0]!.mae_id).toBe(api.ids.gb);
  });

  it('mover para onde a seção já está não grava nada', async () => {
    const antes = await auditorias();
    expect((await mover(sb1, null)).status).toBe(200);
    expect(await auditorias()).toBe(antes);
  });

  it('divisão de outro grupamento é 400 no campo; o que não é divisão, também', async () => {
    const msg = 'Escolha uma divisão deste grupamento.';
    for (const destino of [divisaoDeFora, api.ids.gb, sb1, '00000000-0000-4000-8000-000000000000']) {
      const r = await mover(sb1, destino, 'admin');
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ erro: msg, campos: { divisaoId: msg } });
    }
    expect((await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [sb1])).rows[0]!.mae_id).toBe(api.ids.gb);
  });

  it('só seção se move: divisão, grupamento e id que não existe são 404', async () => {
    for (const id of [da, api.ids.gb, '00000000-0000-4000-8000-000000000000', 'x'])
      expect((await mover(id, divOp, 'admin')).status).toBe(404);
  });

  it('quem não é gestor do grupamento recebe 403: o chefe, o auxiliar da seção e o gestor só da seção', async () => {
    const gestorDaSecao = await entrarComo(api, { matricula: '990763-3', nome: 'GESTORSEC', nivel: { papel: 'gestor', unidadeId: sb1 } });
    expect((await chefe.pedir('PUT', `/api/secoes/${sb1}/divisao`, { divisaoId: divOp })).status).toBe(403);
    expect((await mover(sb1, divOp, 'escalante')).status).toBe(403);
    expect((await gestorDaSecao.pedir('PUT', `/api/secoes/${sb1}/divisao`, { divisaoId: divOp })).status).toBe(403);
    expect((await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [sb1])).rows[0]!.mae_id).toBe(api.ids.gb);
  });
});

describe('o que a divisão cadastrou e as seções de dentro herdam (revisão da 6.10)', () => {
  const cadastrar = async (caminho: string, corpo: unknown) => expect([200, 201]).toContain((await api.pedir('gestorGb', 'POST', caminho, corpo)).status);

  it('a divisão traz quantos parâmetros, feriados e funções cadastrou; a seção e o grupamento não trazem o campo', async () => {
    const antes: NoDaEstrutura = await (await arvore()).json();
    expect(filha(antes, 'DA').cadastrosProprios).toBe(0);
    expect(filha(antes, 'DivOp').cadastrosProprios).toBe(0);
    expect('cadastrosProprios' in antes).toBe(false);
    expect('cadastrosProprios' in filha(antes, '2ª SB')).toBe(false);
    await cadastrar(`/api/unidades/${da}/parametros`, { chave: 'SALDOS_ADM_POR_MILITAR', valor: '3', vigencia: mes });
    await cadastrar(`/api/unidades/${divOp}/feriados`, { data: `${mes}-20`, descricao: 'Feriado da divisão', fixo: false });
    await cadastrar(`/api/unidades/${divOp}/funcoes`, { nome: 'Função da divisão' });
    const depois: NoDaEstrutura = await (await arvore()).json();
    expect(filha(depois, 'DA').cadastrosProprios).toBe(1);
    expect(filha(depois, 'DivOp').cadastrosProprios).toBe(2);
    // o cadastro de uma seção não entra na conta da divisão
    await cadastrar(`/api/unidades/${sb1}/feriados`, { data: `${mes}-21`, descricao: 'Feriado da seção', fixo: false });
    expect(filha(await (await arvore()).json(), 'DivOp').cadastrosProprios).toBe(2);
  });

  it('renomear a divisão devolve a contagem dela', async () => {
    const r = await api.pedir('gestorGb', 'PATCH', `/api/divisoes/${divOp}`, { sigla: 'DivOp', nome: 'Divisão Operacional' });
    expect(((await r.json()) as NoDaEstrutura).cadastrosProprios).toBe(2);
  });
});
