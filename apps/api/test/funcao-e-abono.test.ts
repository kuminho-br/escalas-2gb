import type { FichaDeConsulta, FichaMilitar, FuncaoDoMilitar, GradeDoMes, ListaDoPeculio, MinhaFicha } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.15, Task 1: o catálogo "Funções do militar", a função e o abono de permanência na ficha, na Minha ficha e na consulta. Dados fictícios (D7).
let api: ApiDeTeste;
let oficial: Pessoa;
let alvo: string;
const mes = hojeRecife().slice(0, 7);
const NOME_REPETIDO = 'Já existe uma função com esse nome.';
const FRASE = 'Este campo é alterado por quem tem nível de acesso no 2º GB.';
type Quem = 'admin' | 'gestorGb' | 'escalante' | 'semPapel';

const lista = async (quem: Quem = 'admin'): Promise<FuncaoDoMilitar[]> => (await api.pedir(quem, 'GET', '/api/funcoes-do-militar')).json();
const criar = (nome: unknown, quem: Quem = 'admin') => api.pedir(quem, 'POST', '/api/funcoes-do-militar', { nome });
const mudar = (id: string, corpo: unknown, quem: Quem = 'admin') => api.pedir(quem, 'PATCH', `/api/funcoes-do-militar/${id}`, corpo);
const ficha = async (id: string, quem: Quem = 'gestorGb'): Promise<FichaMilitar> => (await api.pedir(quem, 'GET', `/api/militares/${id}`)).json();
const editar = (id: string, corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'PATCH', `/api/militares/${id}`, corpo);
const nova = async (nome: string) => ((await (await criar(nome)).json()) as FuncaoDoMilitar).id;

beforeAll(async () => {
  api = await montarApi();
  alvo = await criarMilitar(api, { matricula: '990871-1', email: null, unidadeId: api.ids.secao });
  oficial = await entrarComo(api, { matricula: '990872-2', nome: 'FOFICIAL', posto: 'CAP' });
  const qoc = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QOC'")).rows[0]!.id;
  await inserir(api.banco, 'rastreio', { militar_id: oficial.militarId, unidade_id: api.ids.secao, jornada: 'adm', desde: `${mes}-01`, quadro_id: qoc });
});
afterAll(async () => {
  await api.fechar();
});

describe('o catálogo "Funções do militar"', () => {
  it('qualquer nível de acesso lê a lista, em ordem de nome; o militar comum recebe 403', async () => {
    await nova('Chefe de seção');
    await nova('Auxiliar de pessoal');
    for (const quem of ['admin', 'gestorGb', 'escalante'] as const) expect((await lista(quem)).map((f) => f.nome), quem).toEqual(['Auxiliar de pessoal', 'Chefe de seção']);
    expect((await api.pedir('semPapel', 'GET', '/api/funcoes-do-militar')).status).toBe(403);
  });

  it('o administrador cria; a função nasce ativa; só ele altera (o gestor e o auxiliar recebem 403)', async () => {
    const r = await criar('  Instrutor  ');
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: expect.any(String), nome: 'Instrutor', ativo: true });
    for (const quem of ['gestorGb', 'escalante'] as const) {
      expect((await criar('Outra função', quem)).status, quem).toBe(403);
      expect((await mudar((await lista()).find((f) => f.nome === 'Instrutor')!.id, { nome: 'X' }, quem)).status, quem).toBe(403);
    }
    expect((await lista()).map((f) => f.nome)).not.toContain('Outra função');
  });

  it('nome repetido, sem diferenciar maiúsculas, é 409; nome vazio ou longo demais é 400', async () => {
    const r = await criar('INSTRUTOR');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(NOME_REPETIDO);
    expect((await criar('   ')).status).toBe(400);
    expect((await criar('x'.repeat(81))).status).toBe(400);
    expect((await criar(7)).status).toBe(400);
  });

  it('renomeia, desativa e reativa; o nome repetido ao renomear é 409; o que não existe é 404; tudo entra na auditoria', async () => {
    const id = await nova('Subchefe');
    const antes = (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'funcao_militar' and registro_id = $1", [id])).rows[0]!.n;
    expect(await (await mudar(id, { nome: 'Subchefe de seção' })).json()).toEqual({ id, nome: 'Subchefe de seção', ativo: true });
    expect(await (await mudar(id, { ativo: false })).json()).toEqual({ id, nome: 'Subchefe de seção', ativo: false });
    expect((await (await mudar(id, { ativo: true })).json()).ativo).toBe(true);
    const repetida = await mudar(id, { nome: 'chefe DE seção' });
    expect(repetida.status).toBe(409);
    expect((await repetida.json()).erro).toBe(NOME_REPETIDO);
    expect((await mudar('00000000-0000-4000-8000-000000000000', { nome: 'Y' })).status).toBe(404);
    expect((await mudar('x', { nome: 'Y' })).status).toBe(404);
    expect((await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'funcao_militar' and registro_id = $1", [id])).rows[0]!.n).toBe(antes + 3);
  });
});

describe('a função e o abono na ficha', () => {
  it('todo militar começa sem função e sem abono: a ficha traz funcao e funcaoMilitarId nulos e o abono falso', async () => {
    const f = await ficha(alvo);
    expect(f).toMatchObject({ funcao: null, funcaoMilitarId: null, abonoPermanencia: false });
  });

  it('o gestor do 2º GB grava a função e o abono; o administrador também', async () => {
    const chefe = await nova('Chefe da seção de pessoal');
    const r = await editar(alvo, { funcaoMilitarId: chefe, abonoPermanencia: true });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ funcao: 'Chefe da seção de pessoal', funcaoMilitarId: chefe, abonoPermanencia: true });
    expect((await ficha(alvo)).abonoPermanencia).toBe(true);
    expect((await editar(alvo, { abonoPermanencia: false }, 'admin')).status).toBe(200);
    expect(await ficha(alvo)).toMatchObject({ funcaoMilitarId: chefe, abonoPermanencia: false });
    // `null` limpa a função; o que não veio fica como está
    expect(await (await editar(alvo, { funcaoMilitarId: null })).json()).toMatchObject({ funcao: null, funcaoMilitarId: null, abonoPermanencia: false });
  });

  it('o auxiliar só da seção recebe 403 com a frase de quem altera, e nada é gravado', async () => {
    const f = await nova('Motorista da seção');
    for (const corpo of [{ funcaoMilitarId: f }, { abonoPermanencia: true }, { funcaoMilitarId: f, voluntarioJes: true }]) {
      const r = await editar(alvo, corpo, 'escalante');
      expect(r.status, JSON.stringify(corpo)).toBe(403);
      expect((await r.json()).erro).toBe(FRASE);
    }
    expect(await ficha(alvo)).toMatchObject({ funcaoMilitarId: null, abonoPermanencia: false, voluntarioJes: false });
  });

  it('função que não existe é 400 no campo; uuid inválido também', async () => {
    for (const funcaoMilitarId of ['00000000-0000-4000-8000-000000000000', 'x']) {
      const r = await editar(alvo, { funcaoMilitarId });
      expect(r.status, funcaoMilitarId).toBe(400);
      expect(Object.keys((await r.json()).campos)).toContain('funcaoMilitarId');
    }
    expect((await editar(alvo, { abonoPermanencia: 'sim' })).status).toBe(400);
  });

  it('função desativada: continua na ficha de quem a tem e na lista (com ativo falso), mas não se dá a mais ninguém (Review Focus 2)', async () => {
    const antiga = await nova('Função antiga');
    const outro = await criarMilitar(api, { matricula: '990873-3', email: null, unidadeId: api.ids.secao });
    expect((await editar(alvo, { funcaoMilitarId: antiga })).status).toBe(200);
    expect((await mudar(antiga, { ativo: false })).status).toBe(200);
    expect(await ficha(alvo)).toMatchObject({ funcao: 'Função antiga', funcaoMilitarId: antiga });
    expect((await lista()).find((f) => f.id === antiga)!.ativo).toBe(false);
    const recusa = await editar(outro, { funcaoMilitarId: antiga });
    expect(recusa.status).toBe(400);
    expect((await recusa.json()).campos.funcaoMilitarId).toBe('Esta função está desativada.');
    // quem já a tem pode gravar a mesma função de novo (a tela manda o campo com o que já estava)
    expect((await editar(alvo, { funcaoMilitarId: antiga, abonoPermanencia: true })).status).toBe(200);
    expect(await ficha(outro)).toMatchObject({ funcao: null });
  });

  it('as telas abrem com militar sem função: a Grade, o Pecúlio e a ficha de consulta (Review Focus 1)', async () => {
    const semFuncao = await criarMilitar(api, { matricula: '990874-4', email: null, unidadeId: api.ids.secao });
    expect((await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/grade/${mes}`)).status).toBe(200);
    const grade: GradeDoMes = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/grade/${mes}`)).json();
    expect(grade.grupos.flatMap((g) => g.linhas).some((l) => l.militarId === semFuncao)).toBe(true);
    const peculio: ListaDoPeculio = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/peculio?mes=${mes}`)).json();
    const linha = peculio.militares.find((m) => m.militarId === semFuncao);
    expect(linha).toBeDefined();
    // faltar a função não vira pendência de cadastro (a função pode ficar vazia até ser preenchida)
    expect(linha!.pendencias.filter((p) => /fun[cç]ão/i.test(p))).toEqual([]);
    expect((await oficial.pedir('GET', `/api/consulta/militares/${semFuncao}`)).status).toBe(200);
  });
});

describe('a função na Minha ficha e na consulta', () => {
  it('a Minha ficha traz a função (pelo nome) e o abono, só para leitura', async () => {
    const id = await nova('Auxiliar do comando');
    const eu = await entrarComo(api, { matricula: '990875-5', nome: 'FEU' });
    await api.banco.query('update militar set funcao_militar_id = $2, abono_permanencia = true where id = $1', [eu.militarId, id]);
    const f: MinhaFicha = await (await eu.pedir('GET', '/api/eu/ficha')).json();
    expect(f).toMatchObject({ funcao: 'Auxiliar do comando', abonoPermanencia: true });
    const sem = await entrarComo(api, { matricula: '990876-6', nome: 'FSEM' });
    expect(await (await sem.pedir('GET', '/api/eu/ficha')).json()).toMatchObject({ funcao: null, abonoPermanencia: false });
  });

  it('a ficha de consulta traz a função dentro do bloco "situação", e nunca traz o abono', async () => {
    const id = await nova('Chefe do almoxarifado');
    await editar(alvo, { funcaoMilitarId: id, abonoPermanencia: true }, 'admin');
    // o oficial vê o bloco situação; o militar comum, não
    const f: FichaDeConsulta = await (await oficial.pedir('GET', `/api/consulta/militares/${alvo}`)).json();
    expect(f.situacao).toMatchObject({ funcao: 'Chefe do almoxarifado' });
    const comum = await entrarComo(api, { matricula: '990877-7', nome: 'FCOMUM' });
    const doComum = await (await comum.pedir('GET', `/api/consulta/militares/${alvo}`)).json();
    expect('situacao' in doComum).toBe(false);
    expect(JSON.stringify(doComum)).not.toMatch(/almoxarifado|funcao/);
    // o abono não sai por nenhuma rota de consulta, nem para o administrador
    for (const resposta of [f, await (await api.pedir('admin', 'GET', `/api/consulta/militares/${alvo}`)).json(), await (await api.pedir('admin', 'GET', '/api/consulta/militares?texto=teste')).json()]) {
      expect(JSON.stringify(resposta)).not.toMatch(/abono/i);
    }
  });
});
