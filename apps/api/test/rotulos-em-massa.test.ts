import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// 6.65 (pool 52 d): a exportação e a importação do Pecúlio escrevem a unidade pelo menor caminho sem custo quadrático: com 1.000 unidades, uma exportação e uma prévia saem em poucos décimos de segundo.
let api: ApiDeTeste;
const hoje = hojeRecife();
let militar = '';

beforeAll(async () => {
  api = await montarApi();
  // 26 grupamentos com 40 seções cada (mais de mil unidades): as siglas "1ª SB", "2ª SB"... se repetem entre os grupamentos, e a conta do menor caminho único precisa comparar
  const mae = (await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [api.ids.gb])).rows[0]!.mae_id;
  for (let g = 1; g <= 26; g++) {
    const gb = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: `${g + 20}º GB`, nome: `Grupamento ${g + 20}`, mae_id: mae, desde: '2020-01-01' });
    await api.banco.query(
      `insert into unidade (tipo, sigla, nome, mae_id, desde) select 'secao', n || 'ª SB', 'Seção ' || n, $1, '2020-01-01' from generate_series(1, 40) n`,
      [gb],
    );
  }
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  militar = await inserir(api.banco, 'militar', { matricula: '990601-1', posto_grad_id: posto, nome_guerra: 'MASSA', antiguidade: 1 });
  await inserir(api.banco, 'rastreio', { militar_id: militar, unidade_id: api.ids.secao, jornada: 'adm', desde: `${hoje.slice(0, 7)}-01` });
});
afterAll(async () => {
  await api.fechar();
});

describe('o rótulo da unidade em massa', () => {
  it('as unidades de teste existem (mais de mil em vigor)', async () => {
    expect((await api.banco.query<{ n: number }>('select count(*)::int as n from unidade where ate is null')).rows[0]!.n).toBeGreaterThan(1000);
  });

  it('a exportação com mais de mil unidades sai em menos de 1 s', async () => {
    const t0 = performance.now();
    const r = await api.pedir('gestorGb', 'POST', '/api/consulta/militares/exportar', { ids: [militar], colunas: ['NOME DE GUERRA', 'LOTAÇÃO'] });
    const ms = performance.now() - t0;
    expect(r.status).toBe(200);
    expect(ms).toBeLessThan(1000);
  });

  it('a prévia da importação do Pecúlio com mais de mil unidades sai em menos de 1 s', async () => {
    const arquivo = await planilha({ 'PECÚLIO': [['MATRÍCULA', 'LOTAÇÃO'], ['990601-1', '1ª SB']] });
    const t0 = performance.now();
    // importando na raiz, o alcance da importação é a corporação inteira (as mais de mil unidades)
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.raiz}/importacao/peculio`, formulario(arquivo));
    const ms = performance.now() - t0;
    expect(r.status).toBe(200);
    expect(ms).toBeLessThan(1000);
  });
});
