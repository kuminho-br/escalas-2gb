import { mesPorExtenso, somarMeses, type Escala, type LinhaEscala, type Servico } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let outraSecao: string;
let pronto: Servico; // A e B
let expediente: Servico; // U
let bioma: Servico; // A, B e C
let servicoAlheio: string;
let abt: string; // guarnição ativa
let ar: string; // guarnição desativada
let guarnicaoAlheia: string;
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const passado = somarMeses(atual, -1);
const F1 = { inicio: '08:00', fim: '20:00' };
const F2 = { inicio: '20:00', fim: '08:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;

async function servico(nome: string, tipo: string, turnos: [string, string, string][]): Promise<Servico> {
  let s: Servico = await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json();
  for (const [letra, inicio, fim] of turnos) s = await (await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra, inicio, fim })).json();
  return s;
}
async function guarnicao(nome: string, ativa = true): Promise<string> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa, composicao: [] },
  });
  return (await r.json()).id;
}
async function criar(nome: string): Promise<Escala> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome });
  expect(r.status).toBe(201);
  return r.json();
}
const servicosDa = (id: string, servicoIds: string[]) => api.pedir('escalante', 'PUT', `/api/escalas/${id}/servicos`, { servicoIds });
const vinculos = (id: string, mes: string, itens: unknown[]) => api.pedir('escalante', 'PUT', `/api/escalas/${id}/vinculos/${mes}`, { itens });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  pronto = await servico('Pronto', 'ordinario', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
  expediente = await servico('Expediente', 'ordinario', [['A', '08:00', '16:00']]);
  bioma = await servico('Bioma', 'diaria', [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']]);
  servicoAlheio = await inserir(api.banco, 'servico', { unidade_id: outraSecao, nome: 'Alheio', tipo: 'ordinario', cor: '#000000' });
  abt = await guarnicao('ABT');
  ar = await guarnicao('AR', false);
  guarnicaoAlheia = await inserir(api.banco, 'guarnicao', { unidade_id: outraSecao, nome: 'Alheia' });
});
afterAll(async () => {
  await api.fechar();
});

describe('escalas', () => {
  it('nova escala nasce com título ESCALA <NOME>, só escalados e todos os dias', async () => {
    const e = await criar('Defensoria');
    expect(e).toMatchObject({ nome: 'Defensoria', titulo: 'ESCALA DEFENSORIA', militaresDoc: 'escalados', diasDoc: 'todos', ativa: true, servicos: [], faixas: [], comLetra: true, vinculos: [], montaBlocosVoluntariado: true });
    const lista: LinhaEscala[] = await (await api.pedir('escalante', 'GET', `${secao()}/escalas`)).json();
    expect(lista.find((x) => x.id === e.id)).toEqual({ id: e.id, nome: 'Defensoria', ativa: true, servicos: [], montaBlocosVoluntariado: true });
  });

  it('editar identificação', async () => {
    const e = await criar('CPRH');
    const r = await api.pedir('escalante', 'PATCH', `/api/escalas/${e.id}`, { nome: 'CPRH', titulo: 'ESCALA DE SERVIÇO CPRH', militaresDoc: 'todos', diasDoc: 'com_escalados' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ titulo: 'ESCALA DE SERVIÇO CPRH', militaresDoc: 'todos', diasDoc: 'com_escalados' });
  });

  it('reúne serviços na ordem e devolve as faixas', async () => {
    const e = await criar('Ordinário');
    const r = await servicosDa(e.id, [expediente.id, pronto.id]);
    expect(r.status).toBe(200);
    const f: Escala = await r.json();
    expect(f.servicos.map((s) => s.nome)).toEqual(['Expediente', 'Pronto']);
    // o A do Expediente (08h–16h) e o A do Pronto (08h–20h) têm horários diferentes: a letra deixa de acompanhar as colunas
    expect(f.faixas.map((x) => `${x.inicio}-${x.fim}`)).toEqual(['08:00-16:00', '08:00-20:00', '20:00-08:00']);
    expect(f.comLetra).toBe(false);
    const outra: Escala = await (await servicosDa(e.id, [pronto.id, expediente.id])).json();
    expect(outra.servicos.map((s) => s.nome)).toEqual(['Pronto', 'Expediente']);
    const lista: LinhaEscala[] = await (await api.pedir('escalante', 'GET', `${secao()}/escalas`)).json();
    expect(lista.find((x) => x.id === e.id)?.servicos).toEqual(['Pronto', 'Expediente']);
  });

  it('serviço de outra unidade é 400', async () => {
    const e = await criar('Com Alheio');
    const r = await servicosDa(e.id, [servicoAlheio]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toHaveProperty('servicoIds');
  });

  it('tirar serviço com alocação é 409', async () => {
    const e = await criar('Com Gente');
    await servicosDa(e.id, [pronto.id, expediente.id]);
    const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-E', nome: 'Soldado E', ordem: 951 });
    const militar = await inserir(api.banco, 'militar', { matricula: '990998-2', posto_grad_id: posto, nome_guerra: 'ESCALADO' });
    await inserir(api.banco, 'alocacao', { militar_id: militar, escala_id: e.id, servico_id: expediente.id, turno_id: expediente.turnos[0]!.id, data: '2026-12-01', origem: 'manual' });
    const r = await servicosDa(e.id, [pronto.id]);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('O serviço Expediente já tem militares escalados nesta escala.');
  });

  it('tirar serviço sem alocação deixa o vínculo da faixa que sumiu', async () => {
    const e = await criar('Órfã');
    await servicosDa(e.id, [bioma.id]);
    expect((await vinculos(e.id, atual, [{ guarnicaoId: abt, inicio: '16:00', fim: '00:00' }])).status).toBe(200);
    const f: Escala = await (await servicosDa(e.id, [pronto.id])).json();
    expect(f.faixas.map((x) => `${x.inicio}-${x.fim}`)).toEqual(['08:00-20:00', '20:00-08:00']);
    expect(f.vinculos[0]!.itens).toEqual([{ guarnicaoId: abt, guarnicao: 'ABT', ativaNoMes: true, inicio: '16:00', fim: '00:00' }]);
  });

  it('vínculo com faixa fora da escala é 400', async () => {
    const e = await criar('Letra Fora');
    await servicosDa(e.id, [pronto.id]);
    const r = await vinculos(e.id, atual, [{ guarnicaoId: abt, inicio: '16:00', fim: '00:00' }]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toEqual({ 'itens.0.inicio': 'A faixa 16h–00h não existe nos serviços desta escala.' });
  });

  it('a mesma faixa duas vezes para a guarnição é 400', async () => {
    const e = await criar('Repetida');
    await servicosDa(e.id, [pronto.id]);
    const r = await vinculos(e.id, atual, [{ guarnicaoId: abt, ...F1 }, { guarnicaoId: abt, ...F1 }]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toEqual({ 'itens.1.inicio': 'Esta guarnição já está nesta faixa.' });
  });

  it('guarnição de outra unidade é 400', async () => {
    const e = await criar('Guarnição Alheia');
    await servicosDa(e.id, [pronto.id]);
    const r = await vinculos(e.id, atual, [{ guarnicaoId: guarnicaoAlheia, ...F1 }]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toHaveProperty('itens.0.guarnicaoId');
  });

  it('vínculo com guarnição desativada é gravado e volta com ativaNoMes false', async () => {
    const e = await criar('Desativada');
    await servicosDa(e.id, [pronto.id]);
    const r = await vinculos(e.id, atual, [{ guarnicaoId: ar, ...F2 }, { guarnicaoId: abt, ...F1 }]);
    expect(r.status).toBe(200);
    const f: Escala = await r.json();
    expect(f.vinculos).toEqual([
      { vigencia: atual, itens: [
        { guarnicaoId: abt, guarnicao: 'ABT', ativaNoMes: true, ...F1 },
        { guarnicaoId: ar, guarnicao: 'AR', ativaNoMes: false, ...F2 },
      ] },
    ]);
  });

  it('vínculos do mês corrente substituem', async () => {
    const e = await criar('Substitui');
    await servicosDa(e.id, [pronto.id]);
    await vinculos(e.id, atual, [{ guarnicaoId: abt, ...F1 }]);
    await vinculos(e.id, proximo, [{ guarnicaoId: abt, ...F2 }]);
    const f: Escala = await (await vinculos(e.id, atual, [{ guarnicaoId: abt, ...F1 }, { guarnicaoId: abt, ...F2 }])).json();
    expect(f.vinculos.map((v) => v.vigencia)).toEqual([proximo, atual]);
    expect(f.vinculos[1]!.itens.map((i) => `${i.inicio}-${i.fim}`)).toEqual(['08:00-20:00', '20:00-08:00']);
  });

  it('vínculo de mês passado é 409 com o mês mínimo', async () => {
    const e = await criar('Passado');
    await servicosDa(e.id, [pronto.id]);
    const r = await vinculos(e.id, passado, [{ guarnicaoId: abt, ...F1 }]);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Só dá para mudar a partir de ${mesPorExtenso(atual)}.`);
  });

  it('nome repetido com outra caixa é 409', async () => {
    await criar('Bioma Escala');
    const r = await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'BIOMA ESCALA' });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe a escala "Bioma Escala".');
  });

  it('desativar e reativar a escala', async () => {
    const e = await criar('Sazonal');
    const d = await api.pedir('escalante', 'POST', `/api/escalas/${e.id}/situacao`, { ativa: false });
    expect((await d.json()).ativa).toBe(false);
    const r = await api.pedir('escalante', 'POST', `/api/escalas/${e.id}/situacao`, { ativa: true });
    expect((await r.json()).ativa).toBe(true);
  });

  it('sem papel na unidade: 403 em criar, serviços, vínculos e situação', async () => {
    const e = await criar('Protegida');
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/escalas`, { nome: 'X' })).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `${secao()}/escalas`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `/api/escalas/${e.id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'PUT', `/api/escalas/${e.id}/servicos`, { servicoIds: [] })).status).toBe(403);
    expect((await api.pedir('semPapel', 'PUT', `/api/escalas/${e.id}/vinculos/${atual}`, { itens: [] })).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `/api/escalas/${e.id}/situacao`, { ativa: false })).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', '/api/escalas/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('escalas que montam os blocos do voluntariado', () => {
  const marca = (id: string, corpo: unknown, quem: 'admin' | 'escalante' = 'admin') => api.pedir(quem, 'PATCH', `/api/escalas/${id}/blocos-do-voluntariado`, corpo);

  it('o administrador tira e põe a escala dos blocos; a escala e a lista mostram a marca', async () => {
    const e = await criar('Blocos');
    const tirou = await marca(e.id, { montaBlocos: false });
    expect(tirou.status).toBe(200);
    expect(await tirou.json()).toMatchObject({ id: e.id, montaBlocosVoluntariado: false });
    const lista: LinhaEscala[] = await (await api.pedir('escalante', 'GET', `${secao()}/escalas`)).json();
    expect(lista.find((x) => x.id === e.id)?.montaBlocosVoluntariado).toBe(false);
    expect((await (await marca(e.id, { montaBlocos: true })).json()).montaBlocosVoluntariado).toBe(true);
  });

  it('o escalante não muda a marca (403) e nada é gravado', async () => {
    const e = await criar('Blocos do escalante');
    expect((await marca(e.id, { montaBlocos: false }, 'escalante')).status).toBe(403);
    expect((await (await api.pedir('escalante', 'GET', `/api/escalas/${e.id}`)).json()).montaBlocosVoluntariado).toBe(true);
  });

  it('corpo inválido é 400 e escala que não existe é 404', async () => {
    const e = await criar('Blocos inválidos');
    expect((await marca(e.id, { montaBlocos: 'sim' })).status).toBe(400);
    expect((await marca('00000000-0000-0000-0000-000000000000', { montaBlocos: false })).status).toBe(404);
  });
});

