import type { Hono } from 'hono';
import { somarMeses } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';
import { criarRegistrosAlheios, rotasDaVarredura } from './registros-alheios.ts';

// Entrega 6.12, Task 8: as leituras das telas de escala aceitam a visão (a camada "Escala em montagem"), e só elas. Dados fictícios (D7).
let api: ApiDeTeste;
let hono: Hono;
let da: string;
let divOp: string;
let sb1: string; // dentro da DivOp
let outra: string; // dentro da DA, com um registro de cada tipo
let ids: Record<string, string>;
let chefe: Pessoa;
let oficial: Pessoa;
// o militar comum: sem nível de acesso nenhum (o `semPapel` do `montarApi` ganha um nível na seção alheia dos registros de teste)
let comum: Pessoa;
const hoje = hojeRecife();
const mes = hoje.slice(0, 7);
const dia1 = `${mes}-01`;
const proximo = somarMeses(mes, 1);
const quadro: Record<string, string> = {};

/** Os GET das cinco telas (Grade geral, Escala do mês, Efetivo por dia, Cotas e Voluntariado): saem de `apps/web/src/api/` (grade, escala-do-mes, efetivo-do-dia, cotas e voluntariado) e do que as telas pedem só para ler. */
const LEITURAS = [
  '/api/unidades/:u/grade/:mes',
  '/api/unidades/:u/grade/:mes/militares/:militarId/dias/:data',
  '/api/unidades/:u/escalas',
  '/api/escalas/:id/mes/:mes',
  '/api/unidades/:u/cotas',
  '/api/unidades/:u/efetivo-do-dia/:data',
  '/api/unidades/:u/voluntariado/:mes',
  '/api/militares/:id/voluntariado/:mes',
];
/** Os mesmos GET, com os endereços de verdade da seção alheia. */
const enderecos = () => [
  `/api/unidades/${outra}/grade/${mes}`,
  `/api/unidades/${outra}/grade/${mes}/militares/${ids.militares}/dias/${mes}-05`,
  `/api/unidades/${outra}/escalas`,
  `/api/escalas/${ids.escalas}/mes/${mes}`,
  `/api/unidades/${outra}/cotas?mes=${proximo}`,
  `/api/unidades/${outra}/efetivo-do-dia/${mes}-05`,
  `/api/unidades/${outra}/voluntariado/${mes}`,
  `/api/militares/${ids.militares}/voluntariado/${mes}`,
];
const ler = (quem: Pessoa | 'admin' | 'gestorGb' | 'escalante' | 'semPapel', caminho: string) =>
  typeof quem === 'string' ? api.pedir(quem, 'GET', caminho) : quem.pedir('GET', caminho);
const statusDasLeituras = async (quem: Parameters<typeof ler>[0]) => {
  const r: Record<string, number> = {};
  for (const e of enderecos()) r[e.replace(outra, 'OUTRA').replace(ids.escalas!, 'ESCALA').replace(ids.militares!, 'MILITAR')] = (await ler(quem, e)).status;
  return r;
};
const todas = (status: number) => Object.fromEntries(enderecos().map((e) => [e.replace(outra, 'OUTRA').replace(ids.escalas!, 'ESCALA').replace(ids.militares!, 'MILITAR'), status]));
const marca = (bloco: string, camada: string, valor: boolean) => api.banco.query('update visao_bloco set ve = $3 where bloco = $1 and camada = $2', [bloco, camada, valor]);

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => (hono = criarApp({ banco, auth })));
  ({ da, divOp } = await divisoesDoGb(api));
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  sb1 = api.ids.secao;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: da, desde: '2026-11-01' });
  ids = await criarRegistrosAlheios(api, outra);
  // o que as telas não podem mostrar de quem só consulta: o motivo e o boletim do afastamento, o CPF, o nascimento e o endereço
  await api.banco.query("update afastamento set motivo = 'Tratamento de saúde', boletim = 'BG 99/2026' where id = $1", [ids.afastamentos]);
  await api.banco.query(
    `update militar set cpf = '52998224725', nascimento_dia = 15, nascimento_mes = 3, nascimento_ano = 1985,
            cep = '50000000', logradouro = 'Rua Fictícia', numero = '10', bairro = 'Centro', cidade = 'Recife', uf = 'PE',
            telefone = '(81) 99999-0001', email = 'alheio@bombeiros.pe.gov.br' where id = $1`,
    [ids.militares],
  );
  chefe = await entrarComo(api, { matricula: '990851-1', nome: 'SCHEFE', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
  comum = await entrarComo(api, { matricula: '990854-4', nome: 'SCOMUM' });
  oficial = await entrarComo(api, { matricula: '990852-2', nome: 'SOFICIAL', posto: 'CAP' });
  await inserir(api.banco, 'rastreio', { militar_id: oficial.militarId, unidade_id: sb1, jornada: 'adm', desde: dia1, quadro_id: quadro.QOC });
});
afterAll(async () => {
  await api.fechar();
});

describe('as leituras das cinco telas, para quem vê a escala em montagem', () => {
  it('o quinto nível lê as cinco telas de uma seção da unidade irmã (200 em cada GET)', async () => {
    expect(await statusDasLeituras(chefe)).toEqual(todas(200));
  });

  it('as leituras de uma unidade que ele não alcança por nenhuma camada continuam 403: a de outro grupamento e a unidade de cima', async () => {
    const gb9 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    const sb9 = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '9ª SB', nome: '9ª Seção', mae_id: gb9, desde: '2026-11-01' });
    const sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
    for (const unidade of [sb9, gb9, api.ids.gb]) {
      expect((await chefe.pedir('GET', `/api/unidades/${unidade}/grade/${mes}`)).status, unidade).toBe(403);
      expect((await chefe.pedir('GET', `/api/unidades/${unidade}/cotas?mes=${proximo}`)).status, unidade).toBe(403);
    }
    // a seção direto no grupamento é irmã da DivOp (mesma unidade de cima): o tipo não conta, e ele a lê
    expect((await chefe.pedir('GET', `/api/unidades/${sb3}/grade/${mes}`)).status).toBe(200);
  });

  it('quem tem nível de acesso na unidade continua lendo como antes: o auxiliar da seção, o gestor do grupamento e o administrador', async () => {
    for (const [quem, unidade] of [['escalante', sb1], ['gestorGb', outra], ['admin', outra]] as const) {
      expect((await ler(quem, `/api/unidades/${unidade}/grade/${mes}`)).status, quem).toBe(200);
      expect((await ler(quem, `/api/unidades/${unidade}/cotas?mes=${proximo}`)).status, quem).toBe(200);
    }
    // a unidade que não existe, ou um id que nem é uuid, segue 404, e não 403
    expect((await chefe.pedir('GET', `/api/unidades/00000000-0000-4000-8000-000000000000/grade/${mes}`)).status).toBe(404);
    expect((await chefe.pedir('GET', `/api/unidades/x/grade/${mes}`)).status).toBe(404);
    // a própria divisão irmã também se lê (a camada vale na divisão e abaixo dela)
    expect((await chefe.pedir('GET', `/api/unidades/${da}/cotas?mes=${proximo}`)).status).toBe(200);
  });

  it('todo pedido que não é um desses GET, na seção da outra unidade irmã, responde 403 ao quinto nível (a mesma varredura do isolamento)', async () => {
    const rotas = rotasDaVarredura(hono, ids, outra);
    // a lista escrita acima existe de verdade nas rotas do sistema (um erro de digitação deixaria uma rota de leitura sem teste)
    for (const modelo of LEITURAS) expect(rotas.some((r) => r.metodo === 'GET' && r.modelo === modelo), modelo).toBe(true);
    const fora = rotas.filter((r) => !(r.metodo === 'GET' && LEITURAS.includes(r.modelo)));
    expect(fora.length).toBeGreaterThan(30);
    const diferentes: string[] = [];
    for (const r of fora) {
      const resp = await chefe.pedir(r.metodo, r.caminho, r.metodo === 'GET' || r.metodo === 'DELETE' ? undefined : {});
      if (resp.status !== 403) diferentes.push(`${r.metodo} ${r.caminho} → ${resp.status}`);
    }
    expect(diferentes).toEqual([]);
  });

  it('os outros GET da seção (Militares, ficha, Pecúlio, Configurações, Oficiais, importações) continuam 403', async () => {
    const outros = [
      `/api/unidades/${outra}/militares?mes=${mes}`, `/api/militares/${ids.militares}`, `/api/militares/${ids.militares}/acesso`, `/api/unidades/${outra}/peculio?mes=${mes}`,
      `/api/unidades/${outra}/parametros?mes=${mes}`, `/api/unidades/${outra}/oficiais/${mes}`, `/api/unidades/${outra}/servicos`, `/api/unidades/${outra}/guarnicoes?mes=${mes}`,
      `/api/unidades/${outra}/feriados?ano=${mes.slice(0, 4)}`, `/api/unidades/${outra}/equipes`, `/api/unidades/${outra}/meta-padrao`, `/api/unidades/${outra}/importacao/peculio/modelo`,
      `/api/escalas/${ids.escalas}`, `/api/escalas/${ids.escalas}/ordem/${mes}`, `/api/escalas/${ids.escalas}/mes/${mes}/pre-escala`, `/api/alocacoes/${ids.alocacoes}/trocas`,
    ];
    for (const e of outros) expect((await chefe.pedir('GET', e)).status, e).toBe(403);
  });

  it('nenhuma dessas respostas traz o motivo ou o boletim de um afastamento, CPF, nascimento, endereço, telefone ou e-mail', async () => {
    const corpos: unknown[] = [];
    for (const e of enderecos()) {
      const r = await chefe.pedir('GET', e);
      expect(r.status, e).toBe(200);
      corpos.push(await r.json());
    }
    const texto = JSON.stringify(corpos);
    // a tela mostra o que mostra ao escalante: nome, equipe, jornada, alocações e os afastamentos, sem o motivo
    expect(texto).toContain('ALHEIO');
    expect(texto).not.toMatch(/Tratamento de saúde|BG 99\/2026|52998224725|Rua Fictícia|50000000|99999-0001|alheio@bombeiros/);
    const chaves = new Set<string>();
    const colher = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(colher);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { chaves.add(k); colher(x); }
    };
    colher(corpos);
    for (const proibida of ['cpf', 'nascimento', 'endereco', 'telefone', 'email', 'nascimentoDia', 'nascimentoMes']) expect(chaves.has(proibida), proibida).toBe(false);
  });
});

describe('a visão pela borda: o oficial e o militar comum', () => {
  it('com a borda inicial, o oficial e o militar comum recebem 403 nos mesmos GET', async () => {
    expect(await statusDasLeituras(oficial)).toEqual(todas(403));
    expect(await statusDasLeituras(comum)).toEqual(todas(403));
  });

  it('com "Escala em montagem" ligada para o oficial, o oficial lê em qualquer unidade e o militar comum continua sem; ligada para todos, o comum também lê', async () => {
    await marca('escala_em_montagem', 'oficial', true);
    try {
      expect(await statusDasLeituras(oficial)).toEqual(todas(200));
      expect(await statusDasLeituras(comum)).toEqual(todas(403));
      // a camada do oficial é pelo quadro de hoje: desmarcado o quadro, a leitura se vai na hora
      await api.banco.query("update quadro set oficial = false where sigla = 'QOC'");
      expect(await statusDasLeituras(oficial)).toEqual(todas(403));
      await api.banco.query("update quadro set oficial = true where sigla = 'QOC'");
      await marca('escala_em_montagem', 'todos', true);
      expect(await statusDasLeituras(comum)).toEqual(todas(200));
    } finally {
      await marca('escala_em_montagem', 'todos', false);
      await marca('escala_em_montagem', 'oficial', false);
      await api.banco.query("update quadro set oficial = true where sigla = 'QOC'");
    }
    expect(await statusDasLeituras(oficial)).toEqual(todas(403));
  });

  it('quem só vê não grava: com a camada ligada para todos, todo pedido que não é leitura continua 403', async () => {
    await marca('escala_em_montagem', 'todos', true);
    try {
      const fora = rotasDaVarredura(hono, ids, outra).filter((r) => !(r.metodo === 'GET' && LEITURAS.includes(r.modelo)));
      const diferentes: string[] = [];
      for (const r of fora) {
        const resp = await comum.pedir(r.metodo, r.caminho, r.metodo === 'GET' || r.metodo === 'DELETE' ? undefined : {});
        if (resp.status !== 403) diferentes.push(`${r.metodo} ${r.caminho} → ${resp.status}`);
      }
      expect(diferentes).toEqual([]);
    } finally {
      await marca('escala_em_montagem', 'todos', false);
    }
  });
});

describe('/api/eu: as unidades só para consulta', () => {
  const eu = async (quem: Parameters<typeof ler>[0]) => (await (await ler(quem, '/api/eu')).json()) as { unidades: { sigla: string; id: string; nivel: number; tipo: string; caminho: string[] }[]; unidadesSoConsulta: { sigla: string; id: string; nivel: number; tipo: string; caminho: string[] }[] };
  const siglas = (l: { sigla: string }[]) => l.map((u) => u.sigla);

  it('o quinto nível na DivOp tem a DivOp e a 1ª SB para trabalhar, e as irmãs (a DA, as seções direto no 2º GB) e o que há abaixo delas só para consulta, na ordem da árvore', async () => {
    const r = await eu(chefe);
    expect(siglas(r.unidades)).toEqual(['DivOp', '1ª SB']);
    // as irmãs da DivOp (todas as filhas do 2º GB, de qualquer tipo: as seções direto nele também) e o que há abaixo delas, na ordem da árvore
    expect(siglas(r.unidadesSoConsulta)).toEqual(['2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB', 'DA', '2ª SB']);
    expect(r.unidadesSoConsulta[6]).toMatchObject({ id: da, tipo: 'divisao', nivel: r.unidades[0]!.nivel });
    expect(r.unidadesSoConsulta[7]!.caminho.slice(-3)).toEqual(['2º GB', 'DA', '2ª SB']);
    // nenhuma unidade está nas duas listas
    expect(r.unidadesSoConsulta.filter((u) => r.unidades.some((x) => x.id === u.id))).toEqual([]);
  });

  it('chefe de divisão cuja divisão não tem irmã: a lista vem vazia, e ele trabalha normalmente (Review Focus 2)', async () => {
    const gb7 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '7º GB', nome: '7º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    const unica = await inserir(api.banco, 'unidade', { tipo: 'divisao', sigla: 'DivÚnica', nome: 'Divisão única', mae_id: gb7, desde: '2026-11-01' });
    await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '7ª SB', nome: '7ª Seção', mae_id: unica, desde: '2026-11-01' });
    const solitario = await entrarComo(api, { matricula: '990853-3', nome: 'SSOLO', nivel: { papel: 'gestor_lateral', unidadeId: unica } });
    const r = await eu(solitario);
    expect(siglas(r.unidades)).toEqual(['DivÚnica', '7ª SB']);
    expect(r.unidadesSoConsulta).toEqual([]);
  });

  it('o gestor do grupamento e o administrador têm a lista vazia (tudo já está nas unidades deles)', async () => {
    expect((await eu('gestorGb')).unidadesSoConsulta).toEqual([]);
    expect((await eu('admin')).unidadesSoConsulta).toEqual([]);
  });

  it('o auxiliar de uma seção e o militar comum, com a borda inicial: lista vazia', async () => {
    expect((await eu('escalante')).unidadesSoConsulta).toEqual([]);
    expect((await eu(comum)).unidadesSoConsulta).toEqual([]);
    expect((await eu(oficial)).unidadesSoConsulta).toEqual([]);
  });

  it('o oficial, com a marca ligada, tem a corporação inteira para consulta, na ordem da árvore; as unidades extintas não entram', async () => {
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    await marca('escala_em_montagem', 'oficial', true);
    try {
      const r = await eu(oficial);
      const vigentes = (await api.banco.query<{ n: number }>('select count(*)::int as n from unidade where ate is null or ate >= $1::date', [hoje])).rows[0]!.n;
      expect(r.unidadesSoConsulta).toHaveLength(vigentes);
      expect(r.unidadesSoConsulta[0]).toMatchObject({ sigla: 'CBMPE', nivel: 0 });
      expect(r.unidadesSoConsulta.map((u) => u.id)).not.toContain(extinta);
      // o pai antes dos filhos
      const posicao = (s: string) => siglas(r.unidadesSoConsulta).indexOf(s);
      expect(posicao('DivOp')).toBeLessThan(posicao('1ª SB'));
    } finally {
      await marca('escala_em_montagem', 'oficial', false);
    }
  });

  it('com a marca ligada para o chefe de divisão desligada, ele não tem unidade só para consulta', async () => {
    await marca('escala_em_montagem', 'gestor_lateral', false);
    try {
      expect((await eu(chefe)).unidadesSoConsulta).toEqual([]);
      expect((await ler(chefe, `/api/unidades/${outra}/grade/${mes}`)).status).toBe(403);
    } finally {
      await marca('escala_em_montagem', 'gestor_lateral', true);
    }
  });
});
