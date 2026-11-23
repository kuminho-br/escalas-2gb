import { BLOCOS, type Bloco, type Borda, type Quadro } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { blocosDaUnidade, blocosDoMilitar, camadasSobreUnidade } from '../src/visao/visao.ts';
import { inserir } from './banco-teste.ts';
import { divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.11, Task 5: a borda das camadas de visão. Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let da: string;
let divOp: string;
let sb1: string; // dentro da DivOp
let sb2: string; // dentro da DA
let sb3: string; // direto no 2º GB, sem divisão
let sb9: string; // de outro grupamento (9º GB), dentro da DivOp de lá
let gb9: string;
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const alvo: Record<string, string> = {};
const quadro: Record<string, string> = {};
const pessoa = {} as Record<'comum' | 'oficial' | 'chefe' | 'chefeOficial', Pessoa>;
const TODOS_OS_BLOCOS = new Set<Bloco>(BLOCOS);
const SO_IDENTIFICACAO = new Set<Bloco>(['identificacao']);
const DO_OFICIAL = new Set<Bloco>(['identificacao', 'contato', 'situacao', 'afastamentos', 'dados_da_escala']);
const ve = (quem: Pessoa, militar: string) => blocosDoMilitar(api.banco, quem.usuarioId, alvo[militar]!, hoje);
const marca = (bloco: string, camada: string, valor: boolean) => api.banco.query('update visao_bloco set ve = $3 where bloco = $1 and camada = $2', [bloco, camada, valor]);

/** Um militar fictício lotado na unidade (período de hoje em diante), com o quadro dado. */
async function lotado(matricula: string, unidadeId: string | null, quadroSigla: string | null = null, posto = 'SD') {
  const postoId = (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [posto])).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: postoId, nome_guerra: `V${matricula.slice(3, 6)}` });
  if (unidadeId) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidadeId, jornada: 'adm', desde: dia1, ...(quadroSigla ? { quadro_id: quadro[quadroSigla] } : {}) });
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb2, da]);
  gb9 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
  const divOp9 = await inserir(api.banco, 'unidade', { tipo: 'divisao', sigla: 'DivOp', nome: 'Divisão Operacional', mae_id: gb9, desde: '2026-11-01' });
  sb9 = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '9ª SB', nome: '9ª Seção', mae_id: divOp9, desde: '2026-11-01' });

  alvo.sb1 = await lotado('990811-1', sb1);
  alvo.sb2 = await lotado('990812-2', sb2);
  alvo.sb3 = await lotado('990813-3', sb3);
  alvo.sb9 = await lotado('990819-9', sb9);
  alvo.semLotacao = await lotado('990810-0', null);

  // quem olha: o militar comum, o oficial (um capitão do QOC, lotado na 3ª SB), o chefe de divisão da DivOp, e o chefe que também é oficial
  pessoa.comum = await entrarComo(api, { matricula: '990801-1', nome: 'VCOMUM' });
  pessoa.oficial = await entrarComo(api, { matricula: '990802-2', nome: 'VOFICIAL', posto: 'CAP' });
  await inserir(api.banco, 'rastreio', { militar_id: pessoa.oficial.militarId, unidade_id: sb3, jornada: 'adm', desde: dia1, quadro_id: quadro.QOC });
  pessoa.chefe = await entrarComo(api, { matricula: '990803-3', nome: 'VCHEFE', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
  pessoa.chefeOficial = await entrarComo(api, { matricula: '990804-4', nome: 'VCHEFEOF', posto: 'MAJ', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
  await inserir(api.banco, 'rastreio', { militar_id: pessoa.chefeOficial.militarId, unidade_id: sb3, jornada: 'adm', desde: dia1, quadro_id: quadro.QOA });
});
afterAll(async () => {
  await api.fechar();
});

describe('as camadas que a pessoa tem sobre uma unidade', () => {
  const camadas = (quem: Pessoa, unidadeId: string | null) => camadasSobreUnidade(api.banco, quem.usuarioId, unidadeId, hoje);

  it('todo mundo tem a camada "todos"; o oficial, a do oficial; o quinto nível, a sua nas unidades irmãs e abaixo delas', async () => {
    expect(await camadas(pessoa.comum, sb1)).toEqual(['todos']);
    expect(await camadas(pessoa.oficial, sb1)).toEqual(['todos', 'oficial']);
    // a camada do quinto nível: na própria unidade e nas irmãs (as da mesma unidade de cima, de qualquer tipo, como a seção direto no grupamento), e em tudo abaixo delas
    for (const unidade of [divOp, sb1, da, sb2, sb3]) expect(await camadas(pessoa.chefe, unidade), unidade).toEqual(['todos', 'gestor_lateral']);
    expect(await camadas(pessoa.chefeOficial, sb2)).toEqual(['todos', 'oficial', 'gestor_lateral']);
  });

  it('o quinto nível não tem a camada dele fora das irmãs: a unidade de cima e as unidades de outra unidade de cima', async () => {
    for (const unidade of [api.ids.gb, gb9, sb9]) expect(await camadas(pessoa.chefe, unidade), unidade).toEqual(['todos']);
  });

  it('sem unidade (militar sem lotação), só "todos" e "oficial"', async () => {
    expect(await camadas(pessoa.chefe, null)).toEqual(['todos']);
    expect(await camadas(pessoa.chefeOficial, null)).toEqual(['todos', 'oficial']);
  });

  it('o quinto nível que já terminou não vale', async () => {
    const velho = await entrarComo(api, { matricula: '990805-5', nome: 'VVELHO', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
    await api.banco.query("update papel_usuario set ate = $2 where usuario_id = $1", [velho.usuarioId, somarDias(hoje, -1)]);
    expect(await camadas(velho, sb2)).toEqual(['todos']);
  });
});

describe('os blocos que a pessoa vê de um militar (a borda inicial)', () => {
  it('o militar comum vê só a identificação de um militar de outra seção e de outro grupamento', async () => {
    for (const militar of ['sb1', 'sb2', 'sb3', 'sb9']) expect(await ve(pessoa.comum, militar), militar).toEqual(SO_IDENTIFICACAO);
  });

  it('o oficial vê contato, situação, afastamentos e dados da escala; não vê comportamento nem escala em montagem', async () => {
    for (const militar of ['sb1', 'sb2', 'sb9']) expect(await ve(pessoa.oficial, militar), militar).toEqual(DO_OFICIAL);
    // na própria seção (3ª SB) ele não é auxiliar nem gestor: continua sendo a camada do oficial
    expect(await ve(pessoa.oficial, 'sb3')).toEqual(DO_OFICIAL);
  });

  it('o quinto nível na DivOp vê os 7 de uma seção da DA, da própria DivOp e da irmã direto no grupamento; de uma seção de outro grupamento, só o que o quadro dele dá', async () => {
    expect(await ve(pessoa.chefe, 'sb2')).toEqual(TODOS_OS_BLOCOS);
    expect(await ve(pessoa.chefe, 'sb1')).toEqual(TODOS_OS_BLOCOS);
    expect(await ve(pessoa.chefe, 'sb9')).toEqual(SO_IDENTIFICACAO);
    expect(await ve(pessoa.chefe, 'sb3')).toEqual(TODOS_OS_BLOCOS);
    // o chefe que também é oficial: de fora da divisão, os blocos do oficial
    expect(await ve(pessoa.chefeOficial, 'sb9')).toEqual(DO_OFICIAL);
  });

  it('o auxiliar da 1ª SB vê os 7 dos militares da 1ª SB (a hierarquia vale por cima) e só a identificação dos outros', async () => {
    const auxiliar = { usuarioId: api.usuarios.escalante } as Pessoa;
    expect(await ve(auxiliar, 'sb1')).toEqual(TODOS_OS_BLOCOS);
    expect(await ve(auxiliar, 'sb2')).toEqual(SO_IDENTIFICACAO);
    expect(await ve(auxiliar, 'sb9')).toEqual(SO_IDENTIFICACAO);
    // o gestor do 2º GB e o administrador veem os 7 de quem está de baixo; o gestor do 2º GB, só a identificação do 9º GB
    const gestor = { usuarioId: api.usuarios.gestorGb } as Pessoa;
    expect(await ve(gestor, 'sb2')).toEqual(TODOS_OS_BLOCOS);
    expect(await ve(gestor, 'sb9')).toEqual(SO_IDENTIFICACAO);
    expect(await ve({ usuarioId: api.usuarios.admin } as Pessoa, 'sb9')).toEqual(TODOS_OS_BLOCOS);
  });

  it('militar sem lotação hoje: só a identificação, para todos, até para o administrador (Review Focus 3)', async () => {
    for (const quem of [pessoa.comum, pessoa.oficial, pessoa.chefe, { usuarioId: api.usuarios.admin } as Pessoa]) expect(await ve(quem, 'semLotacao')).toEqual(SO_IDENTIFICACAO);
  });

  it('uma lotação que só começa no mês que vem não conta: hoje o militar está sem lotação', async () => {
    const futuro = await lotado('990814-4', null);
    await inserir(api.banco, 'rastreio', { militar_id: futuro, unidade_id: sb1, jornada: 'adm', desde: somarDias(hoje, 40) });
    expect(await blocosDoMilitar(api.banco, pessoa.chefe.usuarioId, futuro, hoje)).toEqual(SO_IDENTIFICACAO);
    expect(await blocosDoMilitar(api.banco, api.usuarios.escalante, futuro, hoje)).toEqual(SO_IDENTIFICACAO);
  });
});

describe('a borda se ajusta, e as camadas se somam', () => {
  it('desligar "contato" do oficial e ligar em "todos": o oficial continua vendo (as camadas se somam)', async () => {
    await marca('contato', 'oficial', false);
    await marca('contato', 'todos', true);
    try {
      expect((await ve(pessoa.oficial, 'sb2')).has('contato')).toBe(true);
      expect((await ve(pessoa.comum, 'sb2')).has('contato')).toBe(true);
    } finally {
      await marca('contato', 'oficial', true);
      await marca('contato', 'todos', false);
    }
  });

  it('desligar uma marca tira o bloco de quem só o via por ela', async () => {
    await marca('dados_da_escala', 'oficial', false);
    try {
      expect((await ve(pessoa.oficial, 'sb2')).has('dados_da_escala')).toBe(false);
      // o chefe de divisão continua vendo pela camada dele, e o auxiliar da seção, pela hierarquia
      expect((await ve(pessoa.chefe, 'sb2')).has('dados_da_escala')).toBe(true);
      expect((await ve({ usuarioId: api.usuarios.escalante } as Pessoa, 'sb1')).has('dados_da_escala')).toBe(true);
    } finally {
      await marca('dados_da_escala', 'oficial', true);
    }
  });

  it('a camada do oficial vale pelo quadro de hoje: quem muda para o QBMG no mês que vem ainda a tem hoje (Review Focus 4)', async () => {
    const quemMuda = await entrarComo(api, { matricula: '990806-6', nome: 'VMUDA', posto: 'CAP' });
    await inserir(api.banco, 'rastreio', { militar_id: quemMuda.militarId, unidade_id: sb3, jornada: 'adm', desde: dia1, ate: somarDias(hoje, 29), quadro_id: quadro.QOC });
    await inserir(api.banco, 'rastreio', { militar_id: quemMuda.militarId, unidade_id: sb3, jornada: 'adm', desde: somarDias(hoje, 30), quadro_id: quadro.QBMG });
    expect(await camadasSobreUnidade(api.banco, quemMuda.usuarioId, sb2, hoje)).toEqual(['todos', 'oficial']);
    // e no dia em que a mudança vale, a camada se vai
    expect(await camadasSobreUnidade(api.banco, quemMuda.usuarioId, sb2, somarDias(hoje, 30))).toEqual(['todos']);
  });

  it('desmarcar "de oficiais" num quadro tira a camada de quem está nele', async () => {
    await api.banco.query("update quadro set oficial = false where sigla = 'QOC'");
    try {
      expect(await camadasSobreUnidade(api.banco, pessoa.oficial.usuarioId, sb2, hoje)).toEqual(['todos']);
      expect(await camadasSobreUnidade(api.banco, pessoa.chefeOficial.usuarioId, sb2, hoje)).toEqual(['todos', 'oficial', 'gestor_lateral']);
    } finally {
      await api.banco.query("update quadro set oficial = true where sigla = 'QOC'");
    }
  });
});

describe('a borda e a marca "de oficiais" nas rotas (só o administrador)', () => {
  const ler = async (quem: 'admin' | 'gestorGb' | 'escalante' | 'semPapel' = 'admin') => api.pedir(quem, 'GET', '/api/visao');
  const gravar = (borda: unknown, quem: 'admin' | 'gestorGb' | 'escalante' | 'semPapel' = 'admin') => api.pedir(quem, 'PUT', '/api/visao', borda);
  const auditorias = async () => (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'visao_bloco'")).rows[0]!.n;
  const linha = (borda: Borda, bloco: Bloco) => borda.find((l) => l.bloco === bloco)!;
  const inicial = async (): Promise<Borda> => (await ler()).json();

  it('o administrador lê a borda: sete linhas, na ordem dos blocos, com os valores da spec', async () => {
    const r = await ler();
    expect(r.status).toBe(200);
    const borda: Borda = await r.json();
    expect(borda.map((l) => l.bloco)).toEqual([...BLOCOS]);
    expect(linha(borda, 'identificacao')).toEqual({ bloco: 'identificacao', todos: true, oficial: true, gestorLateral: true });
    expect(linha(borda, 'contato')).toEqual({ bloco: 'contato', todos: false, oficial: true, gestorLateral: true });
    expect(linha(borda, 'comportamento')).toEqual({ bloco: 'comportamento', todos: false, oficial: false, gestorLateral: true });
    expect(linha(borda, 'escala_em_montagem')).toEqual({ bloco: 'escala_em_montagem', todos: false, oficial: false, gestorLateral: true });
  });

  it('o gestor, o auxiliar e o militar comum recebem 403 ao ler e ao gravar, e nada é gravado', async () => {
    const borda = await inicial();
    const antes = await auditorias();
    for (const quem of ['gestorGb', 'escalante', 'semPapel'] as const) {
      expect((await ler(quem)).status, quem).toBe(403);
      expect((await gravar(borda, quem)).status, quem).toBe(403);
    }
    expect(await auditorias()).toBe(antes);
  });

  it('gravar muda só as marcas que mudaram, devolve a borda nova e cada mudança entra na auditoria', async () => {
    const borda = await inicial();
    const antes = await auditorias();
    const nova = borda.map((l) => (l.bloco === 'afastamentos' ? { ...l, oficial: false } : l.bloco === 'comportamento' ? { ...l, oficial: true } : l));
    const r = await gravar(nova);
    expect(r.status).toBe(200);
    const devolvida: Borda = await r.json();
    expect(linha(devolvida, 'afastamentos').oficial).toBe(false);
    expect(linha(devolvida, 'comportamento').oficial).toBe(true);
    expect(await auditorias()).toBe(antes + 2);
    const aud = (await api.banco.query<{ usuario: string }>("select usuario_id::text as usuario from auditoria where tabela = 'visao_bloco' order by id desc limit 1")).rows[0]!;
    expect(aud.usuario).toBe(api.usuarios.admin);
    // a mesma borda de novo não grava nada
    expect((await gravar(nova)).status).toBe(200);
    expect(await auditorias()).toBe(antes + 2);
    // a borda vale na hora para quem consulta
    expect((await ve(pessoa.oficial, 'sb2')).has('afastamentos')).toBe(false);
    expect((await ve(pessoa.oficial, 'sb2')).has('comportamento')).toBe(true);
    expect((await gravar(borda)).status).toBe(200);
  });

  it('marcar "todos" marca as outras duas camadas (as camadas se somam)', async () => {
    const borda = await inicial();
    const r = await gravar(borda.map((l) => (l.bloco === 'escala_em_montagem' ? { ...l, todos: true, oficial: false, gestorLateral: false } : l)));
    expect(r.status).toBe(200);
    expect(linha(await r.json(), 'escala_em_montagem')).toEqual({ bloco: 'escala_em_montagem', todos: true, oficial: true, gestorLateral: true });
    expect((await gravar(borda)).status).toBe(200);
  });

  it('a identificação de "todos" não se desliga: 400, e nada muda', async () => {
    const borda = await inicial();
    const antes = await auditorias();
    const r = await gravar(borda.map((l) => (l.bloco === 'identificacao' ? { ...l, todos: false } : l)));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A identificação de “todos” não se desliga: sem ela a consulta não mostra nada.');
    expect(await auditorias()).toBe(antes);
    expect(linha(await inicial(), 'identificacao').todos).toBe(true);
  });

  it('a borda tem de trazer os sete blocos, cada um uma vez: senão, 400', async () => {
    const borda = await inicial();
    expect((await gravar(borda.slice(1))).status).toBe(400);
    expect((await gravar([...borda.slice(1), borda[1]])).status).toBe(400);
    expect((await gravar(borda.map((l) => (l.bloco === 'contato' ? { ...l, bloco: 'cpf' } : l)))).status).toBe(400);
    expect((await gravar({ contato: true })).status).toBe(400);
  });

  it('o administrador marca e desmarca "de oficiais" num quadro; só ele, e a marca entra na lista de quadros', async () => {
    const quadros = async (): Promise<Quadro[]> => (await api.pedir('admin', 'GET', '/api/quadros')).json();
    expect((await quadros()).map((q) => [q.sigla, q.oficial])).toEqual([['QOC', true], ['QOA', true], ['QBMG', false]]);
    const marcar = (id: string, corpo: unknown, quem: 'admin' | 'gestorGb' | 'escalante' = 'admin') => api.pedir(quem, 'PATCH', `/api/quadros/${id}`, corpo);
    const r = await marcar(quadro.QBMG!, { oficial: true });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ sigla: 'QBMG', oficial: true });
    expect((await quadros()).find((q) => q.sigla === 'QBMG')!.oficial).toBe(true);
    expect((await marcar(quadro.QBMG!, { oficial: false })).status).toBe(200);
    for (const quem of ['gestorGb', 'escalante'] as const) expect((await marcar(quadro.QBMG!, { oficial: true }, quem)).status).toBe(403);
    expect((await marcar('00000000-0000-4000-8000-000000000000', { oficial: true })).status).toBe(404);
    expect((await marcar('x', { oficial: true })).status).toBe(404);
    expect((await marcar(quadro.QBMG!, { oficial: 'sim' })).status).toBe(400);
    expect((await marcar(quadro.QBMG!, {})).status).toBe(400);
    const aud = (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'quadro' and registro_id = $1", [quadro.QBMG])).rows[0]!.n;
    expect(aud).toBe(2);
  });
});
