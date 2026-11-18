import { mesPorExtenso, somarMeses, type FichaGuarnicao, type Funcao, type LinhaGuarnicao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let funcaoGb: string; // "Motorista", do 2º GB (herdada pela 1ª SB)
let funcaoSb: string; // "Combatente", da 1ª SB
let funcaoOutra: string; // "Chefe", de outra seção
let outraSecao: string;
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const passado = somarMeses(atual, -1);

const linha = (funcaoId: string, minimo = 1, maximo = 1, cnhExigida: string | null = null) => ({ funcaoId, minimo, maximo, cnhExigida });
const versao = (composicao: unknown[], extra: Record<string, unknown> = {}) => ({ viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao, ...extra });
const corpo = (nome: string, extra: Record<string, unknown> = {}) => ({
  nome, vigencia: atual, versao: versao([linha(funcaoSb, 1, 3), linha(funcaoGb, 1, 1, 'D')]), ...extra,
});
const secao = () => `/api/unidades/${api.ids.secao}`;
async function criar(nome: string, extra: Record<string, unknown> = {}): Promise<FichaGuarnicao> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, corpo(nome, extra));
  expect(r.status).toBe(201);
  return r.json();
}
const ficha = async (id: string): Promise<FichaGuarnicao> => (await api.pedir('escalante', 'GET', `/api/guarnicoes/${id}`)).json();
const lista = async (mes = atual): Promise<LinhaGuarnicao[]> => (await api.pedir('escalante', 'GET', `${secao()}/guarnicoes?mes=${mes}`)).json();

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  funcaoGb = await inserir(api.banco, 'funcao', { unidade_id: api.ids.gb, nome: 'Motorista' });
  funcaoSb = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  funcaoOutra = await inserir(api.banco, 'funcao', { unidade_id: outraSecao, nome: 'Chefe' });
});
afterAll(async () => {
  await api.fechar();
});

describe('guarnições', () => {
  it('cria guarnição com a primeira versão', async () => {
    const f = await criar('Auto Bomba 1', { versao: versao([linha(funcaoSb, 1, 3), linha(funcaoGb, 1, 1, 'D')], { viatura: 'ABT-01', tipoViatura: 'Auto Bomba Tanque', prioridade: 1 }) });
    expect(f).toMatchObject({ nome: 'Auto Bomba 1' });
    expect(f).not.toHaveProperty('atividade');
    expect(f.versoes).toEqual([
      {
        vigencia: atual, viatura: 'ABT-01', tipoViatura: 'Auto Bomba Tanque', prioridade: 1, ativa: true,
        composicao: [
          { funcaoId: funcaoSb, funcao: 'Combatente', minimo: 1, maximo: 3, cnhExigida: null },
          { funcaoId: funcaoGb, funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D' },
        ],
      },
    ]);
    expect(f.usadaEm).toEqual([]);
  });

  it('lista do mês usa a versão vigente', async () => {
    const f = await criar('Auto Resgate 1', { versao: versao([linha(funcaoSb, 2, 2)], { viatura: 'ABT-01', prioridade: 5 }) });
    expect((await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${proximo}`, versao([linha(funcaoSb, 3, 3)], { viatura: 'ABT-02', prioridade: 5 }))).status).toBe(200);
    const agora = (await lista(atual)).find((g) => g.id === f.id)!;
    const depois = (await lista(proximo)).find((g) => g.id === f.id)!;
    expect(agora).toMatchObject({ viatura: 'ABT-01', minimo: 2, maximo: 2, aPartirDe: null });
    expect(depois).toMatchObject({ viatura: 'ABT-02', minimo: 3, maximo: 3, aPartirDe: null });
  });

  it('lista ordena por prioridade (vazia por último) e nome', async () => {
    await criar('Ordem C', { versao: versao([linha(funcaoSb)], { prioridade: 2 }) });
    await criar('Ordem B', { versao: versao([linha(funcaoSb)], { prioridade: 1 }) });
    await criar('Ordem A', { versao: versao([linha(funcaoSb)], { prioridade: null }) });
    const nomes = (await lista()).filter((g) => g.nome.startsWith('Ordem ')).map((g) => g.nome);
    expect(nomes).toEqual(['Ordem B', 'Ordem C', 'Ordem A']);
  });

  it('guarnição que só começa no mês seguinte aparece com aPartirDe', async () => {
    const f = await criar('Começa depois', { vigencia: proximo, versao: versao([linha(funcaoSb, 2, 2)]) });
    expect((await lista(atual)).find((g) => g.id === f.id)).toMatchObject({ aPartirDe: proximo, minimo: 2, maximo: 2 });
    expect((await lista(proximo)).find((g) => g.id === f.id)!.aPartirDe).toBeNull();
  });

  it('salvar a partir do mês corrente substitui sem duplicar', async () => {
    const f = await criar('Substitui');
    const salvar = (v: unknown) => api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, v);
    expect((await salvar(versao([linha(funcaoSb, 1, 1), linha(funcaoGb, 1, 1)]))).status).toBe(200);
    const r = await salvar(versao([linha(funcaoGb, 2, 4)], { viatura: 'ABT-09' }));
    expect(r.status).toBe(200);
    const depois: FichaGuarnicao = await r.json();
    expect(depois.versoes).toHaveLength(1);
    expect(depois.versoes[0]).toMatchObject({ vigencia: atual, viatura: 'ABT-09', composicao: [{ funcao: 'Motorista', minimo: 2, maximo: 4 }] });
    const n = (await api.banco.query<{ n: number }>(
      'select count(*)::int as n from composicao c join guarnicao_versao v on v.id = c.guarnicao_versao_id where v.guarnicao_id = $1', [f.id],
    )).rows[0]!.n;
    expect(n).toBe(1);
  });

  it('versão de mês passado é 409 com o mês mínimo', async () => {
    const f = await criar('Sem passado');
    const r = await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${passado}`, versao([linha(funcaoSb)]));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Só dá para mudar a partir de ${mesPorExtenso(atual)}.`);
    const nova = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, corpo('Nasce no passado', { vigencia: passado }));
    expect(nova.status).toBe(409);
  });

  it('mês da rota mal formado é 400', async () => {
    const f = await criar('Mês ruim');
    expect((await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/2026-13`, versao([]))).status).toBe(400);
  });

  it('função de outra seção é 400 no campo', async () => {
    const f = await criar('Função alheia');
    const r = await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, versao([linha(funcaoSb), linha(funcaoOutra)]));
    expect(r.status).toBe(400);
    expect((await r.json()).campos['composicao.1.funcaoId']).toBe('Esta função não está no catálogo da seção.');
    const nova = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, corpo('Função alheia 2', { versao: versao([linha(funcaoOutra)]) }));
    expect(nova.status).toBe(400);
    expect((await nova.json()).campos['versao.composicao.0.funcaoId']).toBe('Esta função não está no catálogo da seção.');
  });

  it('função repetida na composição é 400 no campo', async () => {
    const f = await criar('Repetida');
    const r = await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, versao([linha(funcaoSb), linha(funcaoSb)]));
    expect(r.status).toBe(400);
    expect((await r.json()).campos['composicao.1.funcaoId']).toBe('Esta função já está na composição.');
  });

  it('máximo menor que o mínimo é 400', async () => {
    const f = await criar('Máximo ruim');
    const r = await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, versao([linha(funcaoSb, 3, 2)]));
    expect(r.status).toBe(400);
    expect((await r.json()).campos['composicao.0.maximo']).toBe('O máximo precisa ser igual ou maior que o mínimo.');
  });

  it('nome de guarnição repetido com outro acento é 409', async () => {
    await criar('Ação Rápida');
    const r = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, corpo('acao rapida'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe uma guarnição com esse nome.');
    const outra = await criar('Outra Ação');
    const ren = await api.pedir('escalante', 'PATCH', `/api/guarnicoes/${outra.id}`, { nome: 'AÇÃO RÁPIDA' });
    expect(ren.status).toBe(409);
  });

  it('onde é usada lista a escala e as faixas de horário', async () => {
    const f = await criar('Usada');
    const escala = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Ordinário', titulo: 'Escala Ordinária', militares_doc: 'todos', dias_doc: 'todos' });
    const vinculo = await inserir(api.banco, 'escala_vinculo_versao', { escala_id: escala, vigencia_desde: `${atual}-01` });
    await inserir(api.banco, 'escala_guarnicao', { versao_id: vinculo, guarnicao_id: f.id, inicio: '20:00', fim: '08:00' });
    await inserir(api.banco, 'escala_guarnicao', { versao_id: vinculo, guarnicao_id: f.id, inicio: '08:00', fim: '20:00' });
    expect((await ficha(f.id)).usadaEm).toEqual([
      { escalaId: escala, escala: 'Ordinário', faixas: [{ inicio: '08:00', fim: '20:00' }, { inicio: '20:00', fim: '08:00' }] },
    ]);
  });

  it('lista traz o mínimo e o máximo somados', async () => {
    const f = await criar('Somada', { versao: versao([linha(funcaoSb, 1, 3), linha(funcaoGb, 1, 1, 'D')]) });
    const l = (await lista()).find((g) => g.id === f.id)!;
    expect(l).toMatchObject({ minimo: 2, maximo: 4 });
    expect(l).not.toHaveProperty('pendencias');
    expect(l).not.toHaveProperty('vagasObrigatorias');
  });

  it('guarnição sem composição tem mínimo e máximo zero', async () => {
    const f = await criar('Vazia', { versao: versao([]) });
    expect((await lista()).find((g) => g.id === f.id)).toMatchObject({ minimo: 0, maximo: 0 });
  });

  it('máximo nulo é 400 no campo', async () => {
    const f = await criar('Máximo nulo');
    const r = await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, versao([{ funcaoId: funcaoSb, minimo: 1, maximo: null, cnhExigida: null }]));
    expect(r.status).toBe(400);
    expect((await r.json()).campos['composicao.0.maximo']).toBeDefined();
  });

  it('guarnição desconhecida é 404', async () => {
    expect((await api.pedir('escalante', 'GET', '/api/guarnicoes/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('PUT de versão com prioridade acima de 1000 ou tamanho acima de 99 dá 400', async () => {
    const f = await criar('Limites da Tela');
    const salvar = (v: unknown) => api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${atual}`, v);
    const r = await salvar(versao([linha(funcaoSb)], { prioridade: 5000 }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos.prioridade).toBe('Use um número de 1 a 1000.');
    expect((await salvar(versao([linha(funcaoSb)], { prioridade: 99999999999 }))).status).toBe(400);
    const g = await salvar(versao([linha(funcaoSb, 1, 100)]));
    expect(g.status).toBe(400);
    expect((await g.json()).campos['composicao.0.maximo']).toBe('Use um número até 99.');
    expect((await salvar(versao([linha(funcaoSb, 1, 99)], { prioridade: 1000 }))).status).toBe(200);
  });
});

describe('desativar', () => {
  const situacao = (id: string, ativa: boolean, aPartirDe: string) => api.pedir('escalante', 'POST', `/api/guarnicoes/${id}/situacao`, { ativa, aPartirDe });

  it('desativar agora some da lista do mês e marca a ficha', async () => {
    const f = await criar('Desliga agora');
    const r = await situacao(f.id, false, atual);
    expect(r.status).toBe(200);
    const depois: FichaGuarnicao = await r.json();
    expect(depois.desativadaAPartirDe).toBe(atual);
    expect(depois.versoes).toHaveLength(1);
    expect((await lista()).find((g) => g.id === f.id)!.ativa).toBe(false);
  });

  it('desativar a partir do mês seguinte mantém o mês corrente ativo', async () => {
    const f = await criar('Desliga depois');
    const depois: FichaGuarnicao = await (await situacao(f.id, false, proximo)).json();
    expect(depois.desativadaAPartirDe).toBe(proximo);
    expect(depois.versoes.map((v) => [v.vigencia, v.ativa])).toEqual([[proximo, false], [atual, true]]);
    expect((await lista(atual)).find((g) => g.id === f.id)!.ativa).toBe(true);
    expect((await lista(proximo)).find((g) => g.id === f.id)!.ativa).toBe(false);
  });

  it('desativar desliga também as versões futuras já cadastradas', async () => {
    const f = await criar('Desliga futuras');
    expect((await api.pedir('escalante', 'PUT', `/api/guarnicoes/${f.id}/versoes/${proximo}`, versao([linha(funcaoSb, 2, 2)]))).status).toBe(200);
    const depois: FichaGuarnicao = await (await situacao(f.id, false, atual)).json();
    expect(depois.versoes.every((v) => !v.ativa)).toBe(true);
    expect((await lista(proximo)).find((g) => g.id === f.id)!.ativa).toBe(false);
  });

  it('reativar agora volta a guarnição', async () => {
    const f = await criar('Religa');
    await situacao(f.id, false, atual);
    const depois: FichaGuarnicao = await (await situacao(f.id, true, atual)).json();
    expect(depois.desativadaAPartirDe).toBeNull();
    expect((await lista()).find((g) => g.id === f.id)!.ativa).toBe(true);
  });

  it('desativar no mês passado é 409', async () => {
    const f = await criar('Desliga no passado');
    const r = await situacao(f.id, false, passado);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Só dá para mudar a partir de ${mesPorExtenso(atual)}.`);
  });
});

describe('funções', () => {
  it('função herdada do 2º GB aparece marcada', async () => {
    const r = await api.pedir('escalante', 'GET', `${secao()}/funcoes`);
    const funcoes: Funcao[] = await r.json();
    expect(funcoes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: funcaoGb, nome: 'Motorista', unidadeSigla: '2º GB', herdada: true }),
      expect.objectContaining({ id: funcaoSb, nome: 'Combatente', unidadeSigla: '1ª SB', herdada: false }),
    ]));
    expect(funcoes.some((f) => f.id === funcaoOutra)).toBe(false);
  });

  it('cria função na seção', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/funcoes`, { nome: 'Socorrista' });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ nome: 'Socorrista', unidadeSigla: '1ª SB', herdada: false });
  });

  it('nome de função repetido com outra caixa é 409', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/funcoes`, { nome: 'motorista' });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe a função "Motorista" (2º GB).');
    expect((await api.pedir('escalante', 'POST', `${secao()}/funcoes`, { nome: 'COMBATENTE' })).status).toBe(409);
  });
});

describe('renomear função', () => {
  const novaFuncao = async (nome: string): Promise<string> => (await (await api.pedir('escalante', 'POST', `${secao()}/funcoes`, { nome })).json()).id;
  const renomear = (id: string, nome: string, quem: 'escalante' | 'admin' = 'escalante') => api.pedir(quem, 'PATCH', `/api/funcoes/${id}`, { nome });

  it('renomear função muda o nome em todas as guarnições', async () => {
    const id = await novaFuncao('Bombeiro X');
    const a = await criar('Usa X 1', { versao: versao([linha(id)]) });
    const b = await criar('Usa X 2', { versao: versao([linha(id)]) });
    const r = await renomear(id, 'Bombeiro Y');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id, nome: 'Bombeiro Y', unidadeSigla: '1ª SB', herdada: false });
    expect((await ficha(a.id)).versoes[0]!.composicao[0]!.funcao).toBe('Bombeiro Y');
    expect((await ficha(b.id)).versoes[0]!.composicao[0]!.funcao).toBe('Bombeiro Y');
  });

  it('renomear só a caixa do próprio nome é permitido', async () => {
    const id = await novaFuncao('CHEFE TESTE');
    expect((await renomear(id, 'Chefe Teste')).status).toBe(200);
  });

  it('renomear para nome de outra função é 409', async () => {
    const id = await novaFuncao('Auxiliar Z');
    const r = await renomear(id, 'combatente');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe a função "Combatente" (1ª SB).');
  });

  it('função herdada não se renomeia pela seção (403)', async () => {
    expect((await renomear(funcaoGb, 'Condutor')).status).toBe(403);
  });

  it('função desconhecida é 404', async () => {
    expect((await renomear('00000000-0000-0000-0000-000000000000', 'X')).status).toBe(404);
  });
});

describe('permissões', () => {
  it('escalante de outra seção recebe 403 e sem papel também', async () => {
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/guarnicoes`, corpo('Alheia'))).status).toBe(403);
    const alheia = await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/guarnicoes`, corpo('Alheia', { versao: versao([linha(funcaoOutra)]) }));
    expect(alheia.status).toBe(201);
    const id = (await alheia.json()).id;
    expect((await api.pedir('escalante', 'GET', `/api/guarnicoes/${id}`)).status).toBe(403);
    expect((await api.pedir('escalante', 'PUT', `/api/guarnicoes/${id}/versoes/${atual}`, versao([linha(funcaoOutra)]))).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `${secao()}/guarnicoes`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/funcoes`, { nome: 'X' })).status).toBe(403);
  });

  it('a gravação fica na auditoria com o usuário', async () => {
    const f = await criar('Auditada');
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'guarnicao' and registro_id = $1", [f.id]);
    expect(rows[0]!.usuario_id).toBe(api.usuarios.escalante);
  });
});

describe('guarnição que só vale no futuro', () => {
  const situacao = (quem: 'escalante' | 'semPapel', id: string, ativa: boolean, aPartirDe: string) =>
    api.pedir(quem, 'POST', `/api/guarnicoes/${id}/situacao`, { ativa, aPartirDe });

  it('a ficha traz a versão futura e não aparece como desativada', async () => {
    const f = await criar('So no futuro', { vigencia: proximo });
    const lida = await ficha(f.id);
    expect(lida.versoes.map((v) => [v.vigencia, v.ativa])).toEqual([[proximo, true]]);
    expect(lida.desativadaAPartirDe).toBeNull();
    expect(lida.usadaEm).toEqual([]);
    expect((await lista(proximo)).find((g) => g.id === f.id)).toBeDefined();
  });

  it('desativar agora liga só a versão futura (nenhuma versão nova no passado) e reativar volta', async () => {
    const f = await criar('So no futuro 2', { vigencia: proximo });
    const off: FichaGuarnicao = await (await situacao('escalante', f.id, false, atual)).json();
    expect(off.versoes.map((v) => [v.vigencia, v.ativa])).toEqual([[proximo, false]]);
    expect(off.desativadaAPartirDe).toBe(proximo);
    const on: FichaGuarnicao = await (await situacao('escalante', f.id, true, atual)).json();
    expect(on.versoes.map((v) => [v.vigencia, v.ativa])).toEqual([[proximo, true]]);
    expect(on.desativadaAPartirDe).toBeNull();
  });

  it('situação sem papel na unidade é 403 e de guarnição que não existe é 404', async () => {
    const f = await criar('Situacao sem acesso');
    const negada = await situacao('semPapel', f.id, false, atual);
    expect(negada.status).toBe(403);
    expect((await ficha(f.id)).versoes[0]!.ativa).toBe(true);
    const inexistente = await situacao('escalante', '00000000-0000-0000-0000-000000000000', false, atual);
    expect(inexistente.status).toBe(404);
  });
});

