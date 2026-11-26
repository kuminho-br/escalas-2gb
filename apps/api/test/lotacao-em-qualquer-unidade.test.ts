import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.25, Task 3: o militar é lotado em qualquer unidade da árvore, de qualquer tipo; as telas de escala funcionam em qualquer unidade.
// Dados fictícios (D7).
let api: ApiDeTeste;
let postoSd: string;
let lateralNaSecao: Pessoa;
let sb2: string;
let sb3: string;
let sbEmDivisao: string;
const hoje = hojeRecife();
const mes = hoje.slice(0, 7);
const lotacoes = async (matricula: string) =>
  (await api.banco.query<{ sigla: string; unidade_id: string }>(
    'select un.sigla, un.id as unidade_id from rastreio r join militar m on m.id = r.militar_id join unidade un on un.id = r.unidade_id where m.matricula = $1 order by r.desde', [matricula],
  )).rows;
const idDe = async (sigla: string) => (await api.banco.query<{ id: string }>('select id from unidade where sigla = $1 and mae_id = $2', [sigla, api.ids.gb])).rows[0]!.id;

beforeAll(async () => {
  api = await montarApi();
  postoSd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  sb2 = await idDe('2ª SB');
  sb3 = await idDe('3ª SB');
  // uma divisão com uma seção dentro, para o quinto nível numa seção (as irmãs dela são as da divisão)
  const da = await idDe('DA');
  sbEmDivisao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SB-DA-1', nome: 'Seção da DA 1', mae_id: da, desde: '2026-11-01' });
  await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SB-DA-2', nome: 'Seção da DA 2', mae_id: da, desde: '2026-11-01' });
  lateralNaSecao = await entrarComo(api, { matricula: '990795-5', nome: 'LATSEC', nivel: { papel: 'gestor_lateral', unidadeId: sbEmDivisao } });
});
afterAll(async () => {
  await api.fechar();
});

describe('lotar um militar em qualquer unidade', () => {
  const novo = (matricula: string, nomeGuerra: string) => ({
    matricula, postoGradId: postoSd, nomeCompleto: `${nomeGuerra} de Tal`, nomeGuerra, antiguidade: 7000 + Number(matricula.slice(3, 6)), motorista: false, cnh: [], voluntarioJes: false,
    lotacao: { equipeId: null, jornada: 'pronto', desde: `${mes}-01` },
  });

  it('o cadastro de um militar aceita o grupamento, e ele aparece em Militares, no Pecúlio e na Grade do grupamento', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.gb}/militares`, novo('990781-1', 'NOGRUPAMENTO'));
    expect(r.status).toBe(201);
    expect((await lotacoes('990781-1')).map((l) => l.sigla)).toEqual(['2º GB']);
    const militares = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.gb}/militares?mes=${mes}`)).json();
    expect(militares.map((m: { nomeGuerra: string }) => m.nomeGuerra)).toContain('NOGRUPAMENTO');
    const peculio = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.gb}/peculio?mes=${mes}`)).json();
    expect(peculio.militares.map((m: { nomeGuerra: string; lotacao: string }) => [m.nomeGuerra, m.lotacao])).toContainEqual(['NOGRUPAMENTO', '2º GB']);
    const grade = await api.pedir('admin', 'GET', `/api/unidades/${api.ids.gb}/grade/${mes}`);
    expect(grade.status).toBe(200);
    expect(JSON.stringify(await grade.json())).toContain('NOGRUPAMENTO');
  });

  it('"Alterar situação" aceita o grupamento, uma divisão e uma seção', async () => {
    const criado = await (await api.pedir('admin', 'POST', `/api/unidades/${sb2}/militares`, novo('990782-2', 'MUDA'))).json();
    for (const destino of [api.ids.gb, await idDe('DA'), sb3]) {
      const r = await api.pedir('admin', 'POST', `/api/militares/${criado.id}/situacao`, { unidadeId: destino, equipeId: null, jornada: 'pronto', desde: hoje });
      expect(r.status, destino).toBeLessThan(300);
      expect((await lotacoes('990782-2')).at(-1)!.unidade_id).toBe(destino);
    }
  });

  it('o criar-admin aceita a sigla do grupamento na lotação', async () => {
    const r = await criarAdmin(api.banco, { matricula: '990783-3', postoSigla: 'CEL', nomeGuerra: 'ADMGB', email: 'admgb@exemplo.test', senha: 'senha-de-teste-123', hoje, lotacao: '2º GB' });
    expect(r.lotado).toBe(true);
    expect((await lotacoes('990783-3')).map((l) => l.sigla)).toEqual(['2º GB']);
  });

  it('a importação do Pecúlio resolve a LOTAÇÃO em qualquer unidade abaixo da importada; a sigla repetida pede o caminho com a unidade de cima (6.57)', async () => {
    const gb9 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '1ª SB', nome: '1ª Seção do 9º GB', mae_id: gb9, desde: '2026-11-01' });
    const cab = ['MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'LOTAÇÃO'];
    const linhas = [
      ['990784-4', 'SD', 'Um de Tal', 'UMGB', '2º GB'],
      ['990785-5', 'SD', 'Dois de Tal', 'DOISDA', 'DA'],
      ['990786-6', 'SD', 'Tres de Tal', 'TRESAMB', '1ª SB'],
      ['990787-7', 'SD', 'Quatro de Tal', 'QUATRO', '9º GB / 1ª SB'],
    ];
    const enviar = async (confirmar: boolean) =>
      api.pedir('admin', 'POST', `/api/unidades/${api.ids.raiz}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`, formulario(await planilha({ 'PECÚLIO': [cab, ...linhas] })));
    const previa = await (await enviar(false)).json();
    // a ambígua não cria o militar: a prévia diz para usar a sigla com a unidade de cima
    expect(previa.ignoradas.find((i: { chave: string }) => i.chave === '990786-6').motivo).toContain('Há mais de uma "1ª SB"');
    expect(previa.ignoradas.find((i: { chave: string }) => i.chave === '990786-6').motivo).toContain('2º GB / 1ª SB');
    expect(previa.problemas.map((p: { mensagem: string }) => p.mensagem).join(' ')).toContain('sem lotação');
    expect((await (await enviar(true)).json()).gravados).toBe(3);
    expect((await lotacoes('990784-4')).map((l) => l.sigla)).toEqual(['2º GB']);
    expect((await lotacoes('990785-5')).map((l) => l.sigla)).toEqual(['DA']);
    expect((await lotacoes('990787-7')).map((l) => l.sigla)).toEqual(['1ª SB']);
    expect((await lotacoes('990787-7'))[0]!.unidade_id).not.toBe(api.ids.secao);
    expect((await lotacoes('990786-6'))).toEqual([]);
  });

  it('a lista de unidades para a lotação traz a sigla como é, e a que se repete se distingue pela unidade de cima (maeId), que monta a árvore (6.45)', async () => {
    const lista: { sigla: string; maeId: string | null }[] = await (await api.pedir('admin', 'GET', '/api/unidades-de-lotacao')).json();
    expect(lista.map((u) => u.sigla)).toEqual(expect.arrayContaining(['1ª SB', '2º GB', 'DA']));
    const repetidas = lista.filter((u) => u.sigla === '1ª SB');
    expect(repetidas.length).toBeGreaterThanOrEqual(2);
    expect(new Set(repetidas.map((u) => u.maeId)).size).toBe(repetidas.length);
  });
});

describe('o quinto nível numa seção', () => {
  it('vê as seções irmãs e o que há abaixo delas, edita a sua, e não alcança irmãs de outra unidade de cima', async () => {
    const [irma] = (await api.banco.query<{ id: string }>("select id from unidade where sigla = 'SB-DA-2'")).rows;
    // a irmã (outra seção da mesma divisão): só para consulta
    expect((await lateralNaSecao.pedir('GET', `/api/unidades/${irma!.id}/grade/${mes}`)).status).toBe(200);
    expect((await lateralNaSecao.pedir('GET', `/api/unidades/${irma!.id}/militares?mes=${mes}`)).status).toBe(403);
    // a seção dele, ele edita como gestor
    expect((await lateralNaSecao.pedir('GET', `/api/unidades/${sbEmDivisao}/militares?mes=${mes}`)).status).toBe(200);
    // uma seção direto no grupamento não é irmã (a unidade de cima é outra)
    expect((await lateralNaSecao.pedir('GET', `/api/unidades/${sb3}/grade/${mes}`)).status).toBe(403);
    // o quinto nível na raiz não existe
    const naRaiz = await api.pedir('admin', 'POST', `/api/militares/${lateralNaSecao.militarId}/papeis`, { papel: 'gestor_lateral', unidadeId: api.ids.raiz, desde: `${mes}-01` });
    expect(naRaiz.status).toBe(400);
  });
});
