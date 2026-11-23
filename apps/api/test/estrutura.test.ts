import type { EfeitoDeMover, NoDaArvore } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa, type Quem } from './apoio-api.ts';

// Entrega 6.25, Task 2: a árvore genérica, editável pela tela. Dados fictícios (D7).
let api: ApiDeTeste;
let da: string;
let divOp: string;
let sb1: string;
let gestorSecao: Pessoa;
let lateral: Pessoa;
let outroGb: string;
let secaoDeFora: string;
const mes = hojeRecife().slice(0, 7);
const AINDA = '00000000-0000-4000-8000-000000000000';

const arvore = async (quem: Quem = 'gestorGb', consulta = '') => api.pedir(quem, 'GET', `/api/estrutura${consulta}`);
const criar = (corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'POST', '/api/unidades', corpo);
const alterar = (id: string, corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'PATCH', `/api/unidades/${id}`, corpo);
const extinguir = (id: string, ate: string, quem: Quem = 'gestorGb') => api.pedir(quem, 'POST', `/api/unidades/${id}/extinguir`, { ate });
const excluir = (id: string, quem: Quem = 'gestorGb') => api.pedir(quem, 'DELETE', `/api/unidades/${id}`);
const efeito = (id: string, maeId: string, quem: Quem = 'gestorGb') => api.pedir(quem, 'GET', `/api/unidades/${id}/efeito-de-mover?maeId=${maeId}`);
const siglas = (n: NoDaArvore) => n.filhas.map((f) => f.sigla);
const filha = (n: NoDaArvore, sigla: string) => n.filhas.find((f) => f.sigla === sigla)!;
const nova = (sigla: string, mae: string, tipo = 'secao') => inserir(api.banco, 'unidade', { tipo, sigla, nome: `Unidade ${sigla}`, mae_id: mae, desde: '2026-11-01' });
const maeDe = async (id: string) => (await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [id])).rows[0]!.mae_id;
const caminhoDe = async (id: string) => (await api.banco.query<{ c: string }>('select caminho::text as c from unidade where id = $1', [id])).rows[0]!.c;
const existe = async (id: string) => (await api.banco.query('select 1 from unidade where id = $1', [id])).rows.length === 1;
const ultimaAuditoria = async (id: string) =>
  (await api.banco.query<{ usuario: string; acao: string }>("select usuario_id::text as usuario, acao from auditoria where tabela = 'unidade' and registro_id = $1 order by id desc limit 1", [id])).rows[0];

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  sb1 = api.ids.secao;
  gestorSecao = await entrarComo(api, { matricula: '990761-1', nome: 'GESTORSEC', nivel: { papel: 'gestor', unidadeId: sb1 } });
  lateral = await entrarComo(api, { matricula: '990762-2', nome: 'LATERAL', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
  outroGb = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
  secaoDeFora = await nova('9ª SB', outroGb);
});
afterAll(async () => {
  await api.fechar();
});

describe('ver a árvore', () => {
  it('o gestor vê a árvore desde a unidade mais alta dele, com tipo, datas e o que ele pode fazer em cada nó', async () => {
    const r = await arvore();
    expect(r.status).toBe(200);
    const gb: NoDaArvore = await r.json();
    expect(gb).toMatchObject({ id: api.ids.gb, sigla: '2º GB', tipo: { codigo: 'grupamento', nome: 'Grupamento' }, ate: null, podeEditar: true, podeReorganizar: false });
    expect(siglas(gb)).toEqual(['1ª SB', '2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB', 'DA', 'DivOp']);
    expect(filha(gb, 'DA')).toMatchObject({ id: da, tipo: { codigo: 'divisao' }, filhas: [], podeEditar: true, podeReorganizar: true });
    expect(filha(gb, '1ª SB')).toMatchObject({ id: sb1, tipo: { codigo: 'secao' }, podeEditar: true, podeReorganizar: true });
    expect(gb.ligados).toEqual({ unidades: 9, militaresHoje: 0, historico: expect.arrayContaining(['9 unidades abaixo']) });
  });

  it('o administrador vê a partir da raiz, e pode pedir uma unidade mais baixa', async () => {
    const r = await arvore('admin');
    const raiz: NoDaArvore = await r.json();
    expect(raiz).toMatchObject({ id: api.ids.raiz, sigla: 'CBMPE', podeEditar: true, podeReorganizar: false });
    const so = await arvore('admin', `?raiz=${api.ids.gb}`);
    expect(await so.json()).toMatchObject({ id: api.ids.gb, podeReorganizar: true });
  });

  it('o auxiliar vê a sua unidade, sem poder editar; quem não tem nível, ou pede uma árvore que não é a sua, recebe 403', async () => {
    const aux: NoDaArvore = await (await arvore('escalante')).json();
    expect(aux).toMatchObject({ id: sb1, podeEditar: false, podeReorganizar: false });
    expect((await arvore('semPapel')).status).toBe(403);
    expect((await arvore('gestorGb', `?raiz=${outroGb}`)).status).toBe(403);
    expect((await arvore('admin', `?raiz=${AINDA}`)).status).toBe(404);
  });

  it('o gestor de uma seção vê só a seção dele e edita a própria, sem mexer na posição dela', async () => {
    const sec: NoDaArvore = await (await gestorSecao.pedir('GET', '/api/estrutura')).json();
    expect(sec).toMatchObject({ id: sb1, podeEditar: true, podeReorganizar: false });
  });

  it('a unidade extinta não aparece; a que vai ser extinta ainda aparece, com a data', async () => {
    const velha = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    const futura = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2026-01-01', ate: '2999-12-31' });
    const gb: NoDaArvore = await (await arvore()).json();
    expect(gb.filhas.filter((f) => f.sigla === '8ª SB').map((f) => f.id)).toEqual([futura]);
    expect(filha(gb, '8ª SB').ate).toBe('2999-12-31');
    await api.banco.query('delete from unidade where id = any($1)', [[velha, futura]]);
  });
});

describe('criar uma unidade', () => {
  it('o gestor cria abaixo da sua unidade, de qualquer tipo, a partir do dia 1 do mês; entra na auditoria', async () => {
    const r = await criar({ maeId: da, tipo: 'secao', sigla: ' DSeg ', nome: 'Seção de Segurança', desde: `${mes}-17` });
    expect(r.status).toBe(201);
    const criada: NoDaArvore = await r.json();
    expect(criada).toMatchObject({ sigla: 'DSeg', nome: 'Seção de Segurança', tipo: { codigo: 'secao' }, desde: `${mes}-01`, ate: null, filhas: [] });
    expect(await maeDe(criada.id)).toBe(da);
    expect(await ultimaAuditoria(criada.id)).toEqual({ usuario: api.usuarios.gestorGb, acao: 'insert' });
    // qualquer tipo fica abaixo de qualquer tipo: um grupamento dentro de uma seção
    expect((await criar({ maeId: criada.id, tipo: 'grupamento', sigla: 'GB-X', nome: 'Grupamento X', desde: `${mes}-01` })).status).toBe(201);
  });

  it('a sigla repetida entre irmãs ativas, sem diferenciar maiúsculas, é 409 no campo; em outra unidade de cima, pode', async () => {
    const aviso = 'Já existe 1ª SB abaixo de 2º GB.';
    const r = await criar({ maeId: api.ids.gb, tipo: 'secao', sigla: '1ª sb', nome: 'Repetida', desde: `${mes}-01` });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: aviso, campos: { sigla: aviso } });
    const abaixoDaDa = await criar({ maeId: da, tipo: 'secao', sigla: '1ª SB', nome: 'Em outra unidade', desde: `${mes}-01` });
    expect(abaixoDaDa.status).toBe(201);
  });

  it('quem não é gestor de cima, ou de dentro de outra árvore, recebe 403 e nada é gravado', async () => {
    const corpo = { tipo: 'secao', sigla: 'NEG', nome: 'Negada', desde: `${mes}-01` };
    expect((await criar({ ...corpo, maeId: api.ids.gb }, 'escalante')).status).toBe(403);
    expect((await criar({ ...corpo, maeId: api.ids.gb }, 'semPapel')).status).toBe(403);
    expect((await gestorSecao.pedir('POST', '/api/unidades', { ...corpo, maeId: api.ids.gb })).status).toBe(403);
    expect((await criar({ ...corpo, maeId: outroGb })).status).toBe(403);
    expect((await api.banco.query("select 1 from unidade where sigla = 'NEG'")).rows).toHaveLength(0);
    // o gestor da seção cria abaixo da própria seção
    expect((await gestorSecao.pedir('POST', '/api/unidades', { ...corpo, maeId: sb1 })).status).toBe(201);
  });

  it('o tipo que não existe, a sigla vazia ou longa e a unidade de cima inexistente ou extinta são recusados', async () => {
    const base = { maeId: api.ids.gb, tipo: 'secao', sigla: 'OK', nome: 'Ok', desde: `${mes}-01` };
    expect((await criar({ ...base, tipo: 'nao-existe' })).status).toBe(400);
    expect((await criar({ ...base, sigla: ' ' })).status).toBe(400);
    expect((await criar({ ...base, sigla: 'S'.repeat(21) })).status).toBe(400);
    expect((await criar({ ...base, maeId: AINDA })).status).toBe(404);
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'EXT-C', nome: 'Extinta', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    const r = await criar({ ...base, maeId: extinta });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Esta unidade foi extinta: escolha uma em vigor.');
  });
});

describe('renomear e mover', () => {
  it('renomear muda sigla, nome e tipo; o gestor da própria unidade renomeia, mas não a move', async () => {
    const id = await nova('REN', da);
    const r = await alterar(id, { sigla: 'REN2', nome: 'Renomeada', tipo: 'divisao' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id, sigla: 'REN2', nome: 'Renomeada', tipo: { codigo: 'divisao' } });
    expect(await ultimaAuditoria(id)).toEqual({ usuario: api.usuarios.gestorGb, acao: 'update' });
    expect((await gestorSecao.pedir('PATCH', `/api/unidades/${sb1}`, { nome: '1ª Seção de Bombeiros' })).status).toBe(200);
    const semPoder = await gestorSecao.pedir('PATCH', `/api/unidades/${sb1}`, { maeId: da });
    expect(semPoder.status).toBe(403);
    expect((await semPoder.json()).erro).toBe('Você não tem nível de acesso de gestor acima desta unidade.');
    expect(await maeDe(sb1)).toBe(api.ids.gb);
  });

  it('a sigla de uma irmã ativa é 409, a própria sigla com outra caixa não é repetição, e o corpo vazio ou com campo estranho é 400', async () => {
    const id = await nova('REP', da);
    const repetida = await alterar(id, { sigla: 'DivOp' });
    // DivOp é filha do 2º GB, e REP é filha da DA: outra unidade de cima, pode
    expect(repetida.status).toBe(200);
    const aviso = 'Já existe 1ª SB abaixo de 2º GB.';
    const r = await alterar(await nova('REP-B', api.ids.gb), { sigla: '1ª sb' });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: aviso, campos: { sigla: aviso } });
    expect((await alterar(sb1, { sigla: '1ª sb' })).status).toBe(200);
    await alterar(sb1, { sigla: '1ª SB' });
    expect((await alterar(id, {})).status).toBe(400);
    expect((await alterar(id, { caminho: 'x' })).status).toBe(400);
  });

  it('mover troca a unidade de cima, leva as de baixo e entra na auditoria; quem tinha nível acima passa a alcançá-la na hora', async () => {
    const mover = await nova('MOVE', api.ids.gb);
    const filhaDela = await nova('MOVE-F', mover);
    expect((await lateral.pedir('GET', `/api/estrutura?raiz=${mover}`)).status).toBe(403);
    const r = await alterar(mover, { maeId: divOp });
    expect(r.status).toBe(200);
    expect(await maeDe(mover)).toBe(divOp);
    expect(await caminhoDe(filhaDela)).toContain(await caminhoDe(mover));
    expect(await ultimaAuditoria(mover)).toEqual({ usuario: api.usuarios.gestorGb, acao: 'update' });
    // o nível lateral na DivOp passa a editar a unidade que entrou nela
    expect((await lateral.pedir('GET', `/api/estrutura?raiz=${mover}`)).status).toBe(200);
    expect((await lateral.pedir('PATCH', `/api/unidades/${mover}`, { nome: 'Movida' })).status).toBe(200);
  });

  it('Review Focus 1: mover para dentro de uma filha, direto, em dois passos ou com uma extinta no meio, é recusado e nada muda', async () => {
    const a = await nova('CIC-A', da);
    const b = await nova('CIC-B', a);
    const c = await nova('CIC-C', b);
    const antes = [await caminhoDe(a), await caminhoDe(b), await caminhoDe(c)];
    const recusado = async (id: string, destino: string) => {
      const r = await alterar(id, { maeId: destino });
      expect(r.status).toBe(400);
      expect((await r.json()).erro).toBe('Uma unidade não pode ficar abaixo de si mesma.');
    };
    await recusado(a, a);
    await recusado(a, c);
    // em dois passos: sobe C para o lado de A, depois tenta pôr A abaixo de C
    expect((await alterar(c, { maeId: da })).status).toBe(200);
    await recusado(a, b);
    expect((await alterar(c, { maeId: b })).status).toBe(200);
    // com a do meio extinta (B termina antes de hoje), o caminho de C ainda passa por ela
    await api.banco.query("update unidade set desde = '2020-01-01', ate = '2020-12-31' where id = $1", [b]);
    await recusado(a, c);
    expect([await caminhoDe(a), await caminhoDe(b)]).toEqual([antes[0], antes[1]]);
  });

  it('a raiz não muda de lugar, e o destino extinto ou que não existe é recusado', async () => {
    const r = await alterar(api.ids.raiz, { maeId: api.ids.gb }, 'admin');
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A unidade raiz não muda de lugar.');
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'EXT-M', nome: 'Extinta', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    const id = await nova('PARA-EXT', da);
    expect((await alterar(id, { maeId: extinta })).status).toBe(400);
    expect((await alterar(id, { maeId: AINDA })).status).toBe(404);
    expect((await alterar(AINDA, { nome: 'X' })).status).toBe(404);
  });

  it('Review Focus 2: o gestor não tira uma unidade da própria árvore, nem traz uma de fora para dentro', async () => {
    const dentro = await nova('FORA-1', da);
    const sai = await alterar(dentro, { maeId: outroGb });
    expect(sai.status).toBe(403);
    expect((await sai.json()).erro).toBe('Você não tem nível de acesso de gestor no destino.');
    const entra = await alterar(secaoDeFora, { maeId: da });
    expect(entra.status).toBe(403);
    expect((await entra.json()).erro).toBe('Você não tem nível de acesso de gestor acima desta unidade.');
    expect([await maeDe(dentro), await maeDe(secaoDeFora)]).toEqual([da, outroGb]);
    // o administrador passa entre as duas árvores
    expect((await alterar(dentro, { maeId: outroGb }, 'admin')).status).toBe(200);
  });

  it('o aviso antes de mover diz quem passa a alcançar, quem deixa, quem passa a ver, o que herda e as irmãs novas', async () => {
    const mover = await nova('EFEITO', api.ids.gb);
    await inserir(api.banco, 'feriado', { unidade_id: divOp, data: '2026-12-08', descricao: 'Feriado da DivOp' });
    const r = await efeito(mover, divOp);
    expect(r.status).toBe(200);
    const e: EfeitoDeMover = await r.json();
    expect(e.passamAAlcancar).toEqual([{ nome: 'SD LATERAL', papel: 'gestor_lateral', unidadeSigla: 'DivOp' }]);
    expect(e.deixamDeAlcancar).toEqual([]);
    // ele já a alcança por cima: não é "deixa de ver"
    expect(e.deixamDeVer).toEqual([]);
    expect(e.passamAVer).toEqual([]);
    expect(e.passaAHerdar).toEqual([{ unidadeSigla: 'DivOp', parametros: 0, feriados: 1, funcoes: 0 }]);
    expect(e.deixaDeHerdar).toEqual([]);
    await nova('EFEITO-F', divOp);
    expect((await (await efeito(mover, divOp)).json()).irmasNovas).toContain('EFEITO-F');
    // sair do lado do nível lateral: ele a via como irmã, e deixa de ver
    const emDa = (await (await efeito(mover, da)).json()) as EfeitoDeMover;
    expect(emDa.deixamDeVer).toEqual([{ nome: 'SD LATERAL', papel: 'gestor_lateral', unidadeSigla: 'DivOp' }]);
    // e quem estava longe e vira irmã dele passa a ver
    const naDa = await nova('EFEITO-DA', da);
    const voltando = (await (await efeito(naDa, api.ids.gb)).json()) as EfeitoDeMover;
    expect(voltando.passamAVer).toEqual([{ nome: 'SD LATERAL', papel: 'gestor_lateral', unidadeSigla: 'DivOp' }]);
    // a mesma conta vale para o destino fora da árvore de quem pergunta: 403
    expect((await efeito(mover, outroGb)).status).toBe(403);
    expect((await efeito(mover, divOp, 'escalante')).status).toBe(403);
  });
});

describe('extinguir', () => {
  it('extingue a unidade sem nada ativo abaixo e sem ninguém lotado, e ela some da árvore; o histórico fica', async () => {
    const id = await nova('EXT-OK', da);
    const r = await extinguir(id, `${mes}-28`);
    expect(r.status).toBe(200);
    expect((await api.banco.query<{ ate: string }>("select to_char(ate, 'YYYY-MM-DD') as ate from unidade where id = $1", [id])).rows[0]!.ate).toBe(`${mes}-28`);
    expect(await ultimaAuditoria(id)).toEqual({ usuario: api.usuarios.gestorGb, acao: 'update' });
    const passado = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'EXT-PASSADO', nome: 'Passada', mae_id: da, desde: '2020-01-01' });
    expect((await extinguir(passado, '2025-12-31')).status).toBe(200);
    expect(siglas(filha(await (await arvore()).json(), 'DA'))).not.toContain('EXT-PASSADO');
  });

  it('com unidade ativa abaixo ou militar lotado depois da data, é 409 com as contagens', async () => {
    const id = await nova('EXT-409', da);
    await nova('EXT-409-F', id);
    await criarMilitar(api, { matricula: '990771-1', email: null, unidadeId: id });
    const r = await extinguir(id, `${mes}-28`);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Antes de extinguir, mova 1 unidades e 1 militares lotados.');
    expect((await api.banco.query('select 1 from unidade where id = $1 and ate is null', [id])).rows).toHaveLength(1);
  });

  it('a raiz não se extingue, o gestor não extingue a própria unidade, e a data antes do início é 400', async () => {
    const raiz = await extinguir(api.ids.raiz, `${mes}-28`, 'admin');
    expect(raiz.status).toBe(400);
    expect((await raiz.json()).erro).toBe('A unidade raiz não é extinta.');
    const propria = await gestorSecao.pedir('POST', `/api/unidades/${sb1}/extinguir`, { ate: `${mes}-28` });
    expect(propria.status).toBe(403);
    expect((await propria.json()).erro).toBe('Você não tem nível de acesso de gestor acima desta unidade.');
    const id = await nova('EXT-DATA', da);
    expect((await extinguir(id, '2025-01-31')).status).toBe(400);
  });
});

describe('excluir', () => {
  it('exclui a unidade sem nada ligado', async () => {
    const id = await nova('EXC-OK', da);
    expect((await excluir(id)).status).toBe(204);
    expect(await existe(id)).toBe(false);
  });

  it('com unidades abaixo, ainda que extintas, é 409', async () => {
    const id = await nova('EXC-F', da);
    const filhaExtinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'EXC-FF', nome: 'Extinta', mae_id: id, desde: '2020-01-01', ate: '2020-12-31' });
    const r = await excluir(id);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Esta unidade tem histórico (1 unidade abaixo). Extinga em vez de excluir.');
    expect(filhaExtinta).toBeTruthy();
    expect(await existe(id)).toBe(true);
  });

  it('Review Focus 3: o histórico só no passado conta (militar que saiu, escala antiga, nível de acesso encerrado)', async () => {
    const militar = await nova('EXC-M', da);
    const m = await criarMilitar(api, { matricula: '990772-2', email: null, unidadeId: militar });
    await api.banco.query("update rastreio set desde = '2025-01-01', ate = '2025-12-31' where militar_id = $1", [m]);
    const r = await excluir(militar);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Esta unidade tem histórico (1 militar que já foi lotado). Extinga em vez de excluir.');

    const escala = await nova('EXC-E', da);
    await inserir(api.banco, 'escala', { unidade_id: escala, nome: 'Escala antiga', titulo: 'Escala antiga', militares_doc: 'todos', dias_doc: 'todos', ativa: false });
    expect((await (await excluir(escala)).json()).erro).toBe('Esta unidade tem histórico (1 escala). Extinga em vez de excluir.');

    const nivel = await nova('EXC-N', da);
    await api.banco.query(
      "insert into papel_usuario (usuario_id, unidade_id, papel, desde, ate) values ($1, $2, 'escalante', '2025-01-01', '2025-06-30')", [api.usuarios.semPapel, nivel]);
    expect((await (await excluir(nivel)).json()).erro).toBe('Esta unidade tem histórico (1 nível de acesso). Extinga em vez de excluir.');
    for (const id of [militar, escala, nivel]) expect(await existe(id)).toBe(true);
  });

  it('a raiz não se exclui, o gestor não exclui a própria unidade, e o 404 vale para a que não existe', async () => {
    const raiz = await excluir(api.ids.raiz, 'admin');
    expect(raiz.status).toBe(400);
    expect((await raiz.json()).erro).toBe('A unidade raiz não é excluída.');
    expect((await gestorSecao.pedir('DELETE', `/api/unidades/${sb1}`)).status).toBe(403);
    expect((await excluir(AINDA)).status).toBe(404);
    expect((await excluir(da, 'escalante')).status).toBe(403);
  });
});
