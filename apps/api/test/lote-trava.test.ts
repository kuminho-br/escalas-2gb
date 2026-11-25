import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import type { Banco } from '../src/banco/banco.ts';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.52, achado da revisão: ao aplicar, o lote trava as linhas do militar e do período aberto ANTES de calcular o que grava, para que uma alteração pela ficha enquanto o lote roda
// espere em vez de ser desfeita pelo que o lote leu antes dela. O PGlite dos testes tem uma conexão só e serializa as transações, então a corrida em si não se reproduz: o teste confere
// a ordem das consultas da transação do "aplicar" (a trava vem antes da leitura que monta o que vai gravar).
let api: ApiDeTeste;
let gestor: Pessoa;
const dentroDeTransacao: string[] = [];
const hoje = hojeRecife();

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => {
    const registrando: Banco = { ...banco, transacao: (fn) => banco.transacao((tx) => fn({ ...tx, query: ((sql: string, p?: unknown[]) => { dentroDeTransacao.push(sql); return tx.query(sql, p); }) as typeof tx.query })) };
    return criarApp({ banco: registrando, auth, limiteDeBuscas: Infinity });
  });
  gestor = await entrarComo(api, { matricula: '997001-1', nome: 'TGESTOR', nivel: { papel: 'gestor', unidadeId: api.ids.gb } });
});
afterAll(async () => {
  await api.fechar();
});

describe('o lote trava antes de calcular', () => {
  it('na transação do aplicar, a trava das linhas do militar e do período aberto vem antes da leitura que monta o lote', async () => {
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const id = await inserir(api.banco, 'militar', { matricula: `99710${i}-${i}`, posto_grad_id: posto, nome_guerra: `TRAVA${i}`, nome_completo: `Fulano ${i}`, antiguidade: 700 + i });
      await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, jornada: 'adm', desde: `${hoje.slice(0, 7)}-01` });
      ids.push(id);
    }
    const corpo = { militarIds: ids, desde: hoje, campos: { jornada: 'pronto' } };
    const previa = await (await gestor.pedir('POST', '/api/peculio/lote/previa', corpo)).json();
    dentroDeTransacao.length = 0;
    expect((await gestor.pedir('POST', '/api/peculio/lote/aplicar', { ...corpo, assinatura: previa.assinatura })).status).toBe(200);
    const indice = (re: RegExp) => dentroDeTransacao.findIndex((s) => re.test(s));
    const travaMilitar = indice(/from militar where id = any\(\$1::uuid\[\]\) order by id for update/);
    const travaPeriodo = indice(/from rastreio where militar_id = any\(\$1::uuid\[\]\) and ate is null order by id for update/);
    const leitura = indice(/from militar m join posto_grad p on p\.id = m\.posto_grad_id where m\.id = any/);
    expect(travaMilitar).toBeGreaterThanOrEqual(0);
    expect(travaPeriodo).toBeGreaterThan(travaMilitar);
    expect(leitura).toBeGreaterThan(travaPeriodo);
  });
});
