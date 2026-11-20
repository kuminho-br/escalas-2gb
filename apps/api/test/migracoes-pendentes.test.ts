import { readdirSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../src/app.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { exigirMigracoesEmDia } from '../src/migracoes-pendentes.ts';
import { montarApi } from './apoio-api.ts';
import { bancoDeTeste } from './banco-teste.ts';
import type { Banco } from '../src/banco/banco.ts';

const reais = readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql')).sort();
let banco: Banco;

beforeAll(async () => {
  banco = await bancoDeTeste();
});
afterAll(async () => {
  await banco.fechar();
});

const app = (esperadas: string[], extra: { intervaloMs?: number } = {}) =>
  criarApp({ banco, migracoesEsperadas: esperadas, ...extra });

// o escalante lê esta frase: sem comando de terminal e sem a lista dos arquivos (a lista vai para o log do servidor)
const FRASE = 'O sistema está sendo atualizado. Tente de novo em alguns minutos; se continuar, avise o administrador.';
const noLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});
afterEach(() => vi.restoreAllMocks());

describe('migrações pendentes', () => {
  it('banco em dia: a rota responde normalmente', async () => {
    const a = criarApp({ banco, auth: undefined, migracoesEsperadas: reais });
    expect((await a.request('/api/saude')).status).toBe(200);
  });

  it('migração pendente: 503 com a mensagem e a lista; saúde continua', async () => {
    const log = noLog();
    const a = app([...reais, '9999_futura.sql']);
    const r = await a.request('/api/sistema/qualquer');
    expect(r.status).toBe(503);
    // só a frase: sem `pendentes` no corpo e sem comando de terminal
    expect(await r.json()).toEqual({ erro: FRASE });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('9999_futura.sql'));
    expect((await a.request('/api/saude')).status).toBe(200);
  });

  it('duas requisições no mesmo intervalo conferem uma vez e registram a lista uma vez', async () => {
    const log = noLog();
    const a = app([...reais, '9999_futura.sql']);
    expect((await a.request('/api/sistema/a')).status).toBe(503);
    expect((await a.request('/api/sistema/b')).status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('banco sem a tabela de controle: tudo pendente', async () => {
    const log = noLog();
    const vazio = await bancoPglite();
    try {
      const a = criarApp({ banco: vazio, migracoesEsperadas: ['0001_a.sql', '0002_b.sql'] });
      const r = await a.request('/api/qualquer');
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ erro: FRASE });
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/0001_a\.sql.*0002_b\.sql/));
    } finally {
      await vazio.fechar();
    }
  });

  it('depois de aplicada, a próxima conferência libera', async () => {
    const mw = exigirMigracoesEmDia(banco, [...reais, '9998_depois.sql'], { intervaloMs: 0 });
    const chamar = async () => {
      let passou = false;
      const resposta = await mw({ req: { path: '/api/x' }, json: (c: unknown, s: number) => new Response(JSON.stringify(c), { status: s }) } as never, async () => {
        passou = true;
      });
      return { passou, status: resposta?.status };
    };
    expect(await chamar()).toEqual({ passou: false, status: 503 });
    await banco.query("insert into migracao_aplicada (nome) values ('9998_depois.sql')");
    expect((await chamar()).passou).toBe(true);
  });

  it('sem lista esperada, não confere (testes e dev local)', async () => {
    const a = criarApp({ banco });
    expect((await a.request('/api/saude')).status).toBe(200);
  });
});

describe('as rotas da fase 4 também passam pela conferência', () => {
  it('com migração faltando, a grade e o efetivo do dia respondem 503 com a frase; a saúde continua', async () => {
    noLog();
    const a = app([...reais, '9999_futura.sql']);
    for (const caminho of ['/api/unidades/u1/grade/2026-12', '/api/unidades/u1/efetivo-do-dia/2026-12-01']) {
      const r = await a.request(caminho);
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ erro: FRASE });
    }
    expect((await a.request('/api/saude')).status).toBe(200);
  });

  it('sem a lista, nada é conferido: a grade responde normalmente', async () => {
    const api = await montarApi();
    try {
      const r = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/2026-12`);
      expect(r.status).toBe(200);
    } finally {
      await api.fechar();
    }
  });
});
