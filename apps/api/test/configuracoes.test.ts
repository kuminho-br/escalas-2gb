import { mesPorExtenso, somarMeses, type Parametro } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

const parametros = (u: string, mes = atual) => api.pedir('escalante', 'GET', `/api/unidades/${u}/parametros?mes=${mes}`);
const doCatalogo = (lista: Parametro[], chave: string) => lista.find((p) => p.chave === chave)!;

describe('tipos de afastamento e atividades', () => {
  it('lista os tipos e cria um novo (admin)', async () => {
    const r = await api.pedir('escalante', 'GET', '/api/sistema/tipos-afastamento');
    expect(r.status).toBe(200);
    expect((await r.json()).map((t: { nome: string }) => t.nome)).toEqual(['Curso', 'Férias', 'LTS', 'Outro']);
    const novo = await api.pedir('admin', 'POST', '/api/sistema/tipos-afastamento', { nome: 'Licença especial' });
    expect(novo.status).toBe(201);
    expect(await novo.json()).toMatchObject({ nome: 'Licença especial', ativo: true });
  });

  it('escalante não cria tipo (403)', async () => {
    const r = await api.pedir('escalante', 'POST', '/api/sistema/tipos-afastamento', { nome: 'Outro tipo' });
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Só o administrador do sistema altera esta lista.');
  });

  it('militar comum não lê a lista (403)', async () => {
    expect((await api.pedir('semPapel', 'GET', '/api/sistema/atividades')).status).toBe(403);
  });

  it('renomear para nome existente é 409 legível', async () => {
    const lista = await (await api.pedir('admin', 'GET', '/api/sistema/atividades')).json();
    const aph = lista.find((a: { nome: string }) => a.nome === 'APH');
    const r = await api.pedir('admin', 'PATCH', `/api/sistema/atividades/${aph.id}`, { nome: 'salvamento' });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe um cadastro com esse nome.');
  });

  it('desativar não apaga', async () => {
    const lista = await (await api.pedir('admin', 'GET', '/api/sistema/tipos-afastamento')).json();
    const curso = lista.find((a: { nome: string }) => a.nome === 'Curso');
    const r = await api.pedir('admin', 'PATCH', `/api/sistema/tipos-afastamento/${curso.id}`, { ativo: false });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ nome: 'Curso', ativo: false });
  });

  it('nome vazio é 400 com o campo', async () => {
    const r = await api.pedir('admin', 'POST', '/api/sistema/atividades', { nome: '  ' });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.nome).toBe('Preencha este campo.');
  });
});

describe('parâmetros', () => {
  it('parâmetro sem cadastro mostra o padrão', async () => {
    const r = await parametros(api.ids.secao);
    expect(r.status).toBe(200);
    const lista = await r.json();
    expect(lista.map((p: { chave: string }) => p.chave)).toEqual(['CARGA_MENSAL_HORAS', 'SALDOS_ADM_POR_MILITAR', 'ADM_CUMPRE_CARGA', 'LINHAS_POR_MILITAR']);
    expect(doCatalogo(lista, 'CARGA_MENSAL_HORAS')).toMatchObject({ valor: 160, origem: 'padrao', unidadeSigla: null, rotulo: 'Carga mensal (horas)' });
  });

  it('parâmetro do 2º GB vale para a 1ª SB (herdado, com a sigla)', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.gb}/parametros`, {
      chave: 'SALDOS_ADM_POR_MILITAR', valor: '5', vigencia: atual, normaReferencia: 'Portaria 12/2026',
    });
    expect(r.status).toBe(201);
    const p = doCatalogo(await (await parametros(api.ids.secao)).json(), 'SALDOS_ADM_POR_MILITAR');
    expect(p).toMatchObject({ valor: 5, origem: 'herdada', unidadeSigla: '2º GB', normaReferencia: 'Portaria 12/2026', vigencia: atual });
  });

  it('a unidade mais próxima vence e a vigência futura não vale ainda', async () => {
    await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { chave: 'SALDOS_ADM_POR_MILITAR', valor: '4', vigencia: proximo });
    expect(doCatalogo(await (await parametros(api.ids.secao)).json(), 'SALDOS_ADM_POR_MILITAR')).toMatchObject({ valor: 5, origem: 'herdada' });
    const noProximo = doCatalogo(await (await parametros(api.ids.secao, proximo)).json(), 'SALDOS_ADM_POR_MILITAR');
    expect(noProximo).toMatchObject({ valor: 4, origem: 'propria', unidadeSigla: '1ª SB' });
    expect(noProximo.historico.map((h) => h.valor)).toEqual([5, 4]);
  });

  it('parâmetro com vigência passada é 409', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, {
      chave: 'CARGA_MENSAL_HORAS', valor: '150', vigencia: somarMeses(atual, -1),
    });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Só dá para mudar a partir de ${mesPorExtenso(atual)}.`);
  });

  it('mesma vigência substitui', async () => {
    const corpo = { chave: 'LINHAS_POR_MILITAR', vigencia: proximo };
    await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { ...corpo, valor: '3' });
    await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { ...corpo, valor: '4' });
    const p = doCatalogo(await (await parametros(api.ids.secao, proximo)).json(), 'LINHAS_POR_MILITAR');
    expect(p.valor).toBe(4);
    expect(p.historico).toHaveLength(1);
  });

  it('valor inválido é 400 com a mensagem do catálogo', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { chave: 'CARGA_MENSAL_HORAS', valor: '7,5', vigencia: atual });
    expect(r.status).toBe(400);
    expect((await r.json())).toMatchObject({ erro: 'Use um número inteiro.', campos: { valor: 'Use um número inteiro.' } });
  });

  it('chave que saiu do sistema é 400', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { chave: 'SECAO_PADRAO', valor: '1ª SB', vigencia: atual });
    expect(r.status).toBe(400);
  });

  it('escalante não muda parâmetro (403)', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { chave: 'CARGA_MENSAL_HORAS', valor: '150', vigencia: proximo });
    expect(r.status).toBe(403);
  });

  it('gravação deixa o usuario_id na auditoria', async () => {
    await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/parametros`, { chave: 'ADM_CUMPRE_CARGA', valor: 'SIM', vigencia: proximo });
    const { rows } = await api.banco.query<{ usuario_id: string }>(
      "select usuario_id from auditoria where tabela = 'parametro' order by id desc limit 1",
    );
    expect(rows[0]!.usuario_id).toBe(api.usuarios.admin);
  });
});
