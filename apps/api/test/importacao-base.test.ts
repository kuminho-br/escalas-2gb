import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AmbienteApi } from '../src/acesso.ts';
import { coluna, lerData, lerMes, lerPlanilha } from '../src/importacao/planilha.ts';
import { rotasImportacao } from '../src/importacao/rotas.ts';
import type { Importador } from '../src/importacao/tipos.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// importador falso: cada linha da aba TESTE vira uma atividade
const falso: Importador<string[]> = {
  abas: ['TESTE'],
  modelo: { abas: [{ nome: 'TESTE', colunas: [{ rotulo: 'NOME', obrigatoria: true, ajuda: 'Nome da atividade.' }] }] },
  async planejar(abas, ctx) {
    const c = coluna(abas.TESTE!, 'NOME');
    const existentes = new Set((await ctx.tx.query<{ nome: string }>('select nome from atividade')).rows.map((r) => r.nome));
    const novos = abas.TESTE!.linhas.map((l) => l.celulas[c]!).filter((n) => !existentes.has(n));
    return {
      previa: { novos: novos.map((n) => ({ chave: n, descricao: n })), alterados: [], iguais: abas.TESTE!.linhas.length - novos.length, problemas: [], avisos: [] },
      plano: novos,
    };
  },
  async aplicar(plano, ctx) {
    for (const n of plano) await ctx.tx.query('insert into atividade (nome) values ($1)', [n]);
    return plano.length;
  },
};

// importadores que falham ao gravar, como o banco falharia: unicidade (duas confirmações ao mesmo tempo) e erro sem tradução
const duplicado: Importador<string[]> = { ...falso, aplicar: async () => { throw Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: '23505' }); } };
const quebrado: Importador<string[]> = { ...falso, aplicar: async () => { throw Object.assign(new Error('falha qualquer'), { code: '99999' }); } };

let api: ApiDeTeste;
const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => {
    const app = new Hono<AmbienteApi>();
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.route('/api', rotasImportacao({ banco, auth }, { teste: falso, duplicado: duplicado as Importador<unknown>, quebrado: quebrado as Importador<unknown> }));
    return app;
  });
});
afterAll(async () => {
  await api.fechar();
});

const caminho = (cadastro = 'teste') => `/api/unidades/${api.ids.secao}/importacao/${cadastro}`;
const arquivo = () => planilha({ TESTE: [['NOME'], ['Mergulho'], ['Altura'], ['APH']] });

describe('importação', () => {
  it('prévia não grava', async () => {
    const antes = await auditoria();
    const r = await api.pedir('escalante', 'POST', caminho(), formulario(await arquivo()));
    expect(r.status).toBe(200);
    const previa = await r.json();
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['Mergulho', 'Altura']);
    expect(previa.iguais).toBe(1);
    expect(await auditoria()).toBe(antes);
  });

  it('confirmar grava e devolve gravados', async () => {
    const r = await api.pedir('escalante', 'POST', `${caminho()}?confirmar=1`, formulario(await arquivo()));
    expect(r.status).toBe(200);
    expect((await r.json()).gravados).toBe(2);
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'atividade' order by id desc limit 1");
    expect(rows[0]!.usuario_id).toBe(api.usuarios.escalante);
  });

  it('aba que falta vira 400 com a instrução', async () => {
    const r = await api.pedir('escalante', 'POST', caminho(), formulario(await planilha({ OUTRA: [['X']] })));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A planilha não tem a aba "TESTE". Baixe o modelo na tela de importação e cole os dados nele, ou confira o nome da aba.');
  });

  it('cadastro desconhecido é 404', async () => {
    expect((await api.pedir('escalante', 'POST', caminho('nada'), formulario(await arquivo()))).status).toBe(404);
  });

  it('sem papel é 403', async () => {
    expect((await api.pedir('semPapel', 'POST', caminho(), formulario(await arquivo()))).status).toBe(403);
  });

  it('arquivo que não é planilha é 400', async () => {
    const fd = new FormData();
    fd.append('arquivo', new File(['não sou xlsx'], 'x.xlsx'));
    expect((await api.pedir('escalante', 'POST', caminho(), fd)).status).toBe(400);
  });
});

describe('lerPlanilha', () => {
  it('lerPlanilha lê data e hora como texto', async () => {
    const abas = await lerPlanilha(
      await planilha({ X: [['DATA', 'HORA', 'NUM'], [new Date(Date.UTC(2026, 11, 1)), '08:00', 7], [null, null, null], ['a', '', '']] }),
    );
    expect(abas.X!.cab).toEqual(['DATA', 'HORA', 'NUM']);
    expect(abas.X!.linhas).toEqual([
      // a célula que veio como data do Excel fica marcada (a NASCIMENTO do Pecúlio a ignora)
      { linha: 2, celulas: ['01/12/2026', '08:00', '7'], datas: [true, false, false] },
      { linha: 4, celulas: ['a', '', ''] },
    ]);
  });

  it('coluna aceita prefixo e ignora acento', async () => {
    const abas = await lerPlanilha(await planilha({ C: [['CHAVE', 'VIGÊNCIA (A PARTIR DE)']] }));
    expect(coluna(abas.C!, 'VIGENCIA')).toBe(1);
    expect(coluna(abas.C!, 'NADA')).toBe(-1);
  });
});

describe('leitor de mês e de data da planilha', () => {
  it.each([
    ['2027-01', '2027-01'], ['2027-1', '2027-01'], ['01/2027', '2027-01'], ['1/2027', '2027-01'], ['12/26', '2026-12'], ['1/26', '2026-01'],
    ['15/03/2027', '2027-03'], ['5/3/2027', '2027-03'], [' 2027-05 ', '2027-05'], ['', ''],
    ['0000-01', null], ['13/2027', null], ['2027-13', null], ['abc', null], ['0/2027', null], ['1899-12', null], ['31/02/2027', null],
  ])('lerMes(%j) = %j', (entrada, esperado) => expect(lerMes(entrada)).toBe(esperado));

  it.each([
    ['07/09/2026', '2026-09-07'], ['7/9/2026', '2026-09-07'], ['07/09/26', '2026-09-07'], ['2026-09-07', '2026-09-07'], ['2026-9-7', '2026-09-07'], [' 07/09/2026 ', '2026-09-07'],
    ['31/02/2026', null], ['0000-01-01', null], ['01/01/0000', null], ['abc', null], ['', null], ['29/02/2027', null], ['29/02/2028', '2028-02-29'],
  ])('lerData(%j) = %j', (entrada, esperado) => expect(lerData(entrada)).toBe(esperado));

  it('violação de unicidade ao confirmar vira 409 que manda enviar de novo, sem gravar', async () => {
    const antes = await auditoria();
    const r = await api.pedir('escalante', 'POST', `${caminho('duplicado')}?confirmar=1`, formulario(await arquivo()));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: 'Outra gravação aconteceu ao mesmo tempo. Envie o arquivo de novo para ver a prévia atualizada.' });
    expect(await auditoria()).toBe(antes);
  });

  it('erro do banco sem tradução ao confirmar responde JSON com o que fazer, não texto puro', async () => {
    const r = await api.pedir('escalante', 'POST', `${caminho('quebrado')}?confirmar=1`, formulario(await arquivo()));
    expect(r.status).toBe(500);
    expect(r.headers.get('content-type')).toMatch(/json/);
    expect(await r.json()).toEqual({ erro: 'Não foi possível gravar a importação. Nada foi gravado. Tente de novo em alguns minutos.' });
  });
});

