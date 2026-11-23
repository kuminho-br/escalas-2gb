import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';

// Entrega 6.11, Task 5: a migração das camadas de visão. Dados fictícios (D7).
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
const marcas = async () =>
  (await banco.query<{ bloco: string; camada: string; ve: boolean }>('select bloco, camada, ve from visao_bloco order by bloco, camada')).rows;
const ve = async (bloco: string, camada: string) =>
  (await banco.query<{ ve: boolean }>('select ve from visao_bloco where bloco = $1 and camada = $2', [bloco, camada])).rows[0]!.ve;

// a borda inicial da spec ("Os blocos e a borda inicial"): [todos, oficial, chefe_divisao]
const INICIAL: Record<string, [boolean, boolean, boolean]> = {
  identificacao: [true, true, true],
  contato: [false, true, true],
  situacao: [false, true, true],
  afastamentos: [false, true, true],
  dados_da_escala: [false, true, true],
  comportamento: [false, false, true],
  escala_em_montagem: [false, false, true],
};

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0032');
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0032: as camadas de visão', () => {
  it('QOC e QOA nascem "de oficiais"; o QBMG, não', async () => {
    const { rows } = await banco.query<{ sigla: string; oficial: boolean }>('select sigla, oficial from quadro order by ordem');
    expect(rows).toEqual([{ sigla: 'QOC', oficial: true }, { sigla: 'QOA', oficial: true }, { sigla: 'QBMG', oficial: false }]);
  });

  it('a borda inicial tem as 21 linhas da spec, linha por linha', async () => {
    const linhas = await marcas();
    expect(linhas).toHaveLength(21);
    for (const [bloco, [todos, oficial, chefe]] of Object.entries(INICIAL)) {
      expect(await ve(bloco, 'todos'), `${bloco}/todos`).toBe(todos);
      expect(await ve(bloco, 'oficial'), `${bloco}/oficial`).toBe(oficial);
      expect(await ve(bloco, 'chefe_divisao'), `${bloco}/chefe_divisao`).toBe(chefe);
    }
  });

  it('o banco recusa bloco ou camada que não existe', async () => {
    await expect(banco.query("insert into visao_bloco (bloco, camada, ve) values ('cpf', 'todos', true)")).rejects.toThrow();
    await expect(banco.query("insert into visao_bloco (bloco, camada, ve) values ('contato', 'coronel', true)")).rejects.toThrow();
  });

  it('a identificação não se desliga para todos (nem por alteração nem por apagar e pôr de novo)', async () => {
    await expect(banco.query("update visao_bloco set ve = false where bloco = 'identificacao' and camada = 'todos'")).rejects.toThrow();
    expect(await ve('identificacao', 'todos')).toBe(true);
    // as outras camadas da identificação, e os outros blocos de todos, mudam à vontade
    await banco.query("update visao_bloco set ve = false where bloco = 'identificacao' and camada = 'oficial'");
    await banco.query("update visao_bloco set ve = true where bloco = 'identificacao' and camada = 'oficial'");
    await banco.query("update visao_bloco set ve = true where bloco = 'contato' and camada = 'todos'");
    await banco.query("update visao_bloco set ve = false where bloco = 'contato' and camada = 'todos'");
    await expect(banco.query("delete from visao_bloco where bloco = 'identificacao' and camada = 'todos'; insert into visao_bloco (bloco, camada, ve) values ('identificacao', 'todos', false)")).rejects.toThrow();
  });

  it('cada bloco e camada existe uma vez só', async () => {
    await expect(banco.query("insert into visao_bloco (bloco, camada, ve) values ('contato', 'todos', true)")).rejects.toThrow();
  });

  it('pode rodar de novo sem duplicar nem desfazer o que o administrador ajustou', async () => {
    await banco.query("update visao_bloco set ve = false where bloco = 'contato' and camada = 'oficial'");
    await banco.query("update quadro set oficial = false where sigla = 'QOA'");
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0032_camadas_de_visao.sql'), 'utf8'));
    expect(await marcas()).toHaveLength(21);
    expect(await ve('contato', 'oficial')).toBe(false);
    expect((await banco.query<{ oficial: boolean }>("select oficial from quadro where sigla = 'QOA'")).rows[0]!.oficial).toBe(false);
    expect((await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'visao_bloco'::regclass and tgname = 'auditoria_registro'")).rows[0]!.n).toBe(1);
    expect((await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'quadro'::regclass and tgname = 'auditoria_registro'")).rows[0]!.n).toBe(1);
  });

  it('mudar uma marca entra na auditoria', async () => {
    const antes = (await banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'visao_bloco'")).rows[0]!.n;
    await banco.query("update visao_bloco set ve = true where bloco = 'comportamento' and camada = 'oficial'");
    const depois = (await banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'visao_bloco'")).rows[0]!.n;
    expect(depois).toBe(antes + 1);
  });
});
