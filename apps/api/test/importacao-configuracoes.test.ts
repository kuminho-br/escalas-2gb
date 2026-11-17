import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
const CAB = ['CHAVE', 'VALOR', 'VIGÊNCIA (A PARTIR DE)', 'DESCRIÇÃO'];
const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
const importar = async (linhas: (string | number)[][], confirmar = false) => {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/configuracoes${confirmar ? '?confirmar=1' : ''}`,
    formulario(await planilha({ 'CONFIGURAÇÕES': [CAB, ...linhas] })));
  expect(r.status).toBe(200);
  return r.json();
};

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('importação de configurações', () => {
  it('importa as chaves e pula SECAO_PADRAO com aviso', async () => {
    const r = await importar([
      ['CARGA_MENSAL_HORAS', 160, '', 'x'],
      ['SALDOS_ADM_POR_MILITAR', 6, '2026-12', 'x'],
      ['SECAO_PADRAO', '1ª SB', '', 'x'],
    ], true);
    expect(r.novos).toHaveLength(2);
    expect(r.gravados).toBe(2);
    expect(r.avisos).toContain('SECAO_PADRAO não é mais usada: o seletor de unidade substitui.');
    const { rows } = await api.banco.query<{ chave: string; vig: string; valor: unknown }>(
      "select chave, to_char(vigencia_desde, 'YYYY-MM') as vig, valor from parametro where unidade_id = $1 order by chave",
      [api.ids.secao],
    );
    // vigência vazia = mês de criação da unidade (carga base: 2026-11)
    expect(rows).toEqual([
      { chave: 'CARGA_MENSAL_HORAS', vig: '2026-11', valor: 160 },
      { chave: 'SALDOS_ADM_POR_MILITAR', vig: '2026-12', valor: 6 },
    ]);
  });

  it('valor inválido vira problema e o resto entra', async () => {
    const r = await importar([
      ['LINHAS_POR_MILITAR', 'muitas', '', ''],
      ['ADM_CUMPRE_CARGA', 'SIM', '', ''],
    ]);
    expect(r.novos.map((n: { chave: string }) => n.chave)).toEqual(['ADM_CUMPRE_CARGA|2026-11']);
    expect(r.problemas).toEqual([
      { aba: 'CONFIGURAÇÕES', linha: 2, mensagem: 'LINHAS_POR_MILITAR: Use um número inteiro.', solucao: 'Corrija a linha na sandbox e importe de novo.' },
    ]);
  });

  it('valor diferente aparece como alterado', async () => {
    const r = await importar([['CARGA_MENSAL_HORAS', 150, '', '']]);
    expect(r.alterados).toEqual([{ chave: 'CARGA_MENSAL_HORAS|2026-11', descricao: 'Carga mensal (horas) a partir de novembro de 2026', mudancas: ['valor: 160 → 150'] }]);
  });

  it('importar duas vezes: a segunda é toda igual e não grava', async () => {
    const linhas = [['CARGA_MENSAL_HORAS', 160, '', ''], ['SALDOS_ADM_POR_MILITAR', 6, '12/2026', '']];
    const antes = await auditoria();
    const r = await importar(linhas, true);
    expect(r).toMatchObject({ novos: [], alterados: [], iguais: 2, gravados: 0 });
    expect(await auditoria()).toBe(antes);
  });
});
