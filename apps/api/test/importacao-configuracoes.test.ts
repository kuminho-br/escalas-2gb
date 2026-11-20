import { somarMeses } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
// os meses das linhas contam a partir de hoje (a importação recusa mês que já passou): fixos, os testes quebrariam com o calendário
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);
const mmaaaa = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
const CAB = ['CHAVE', 'VALOR', 'VIGÊNCIA (A PARTIR DE)', 'DESCRIÇÃO'];
const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
const importar = async (linhas: (string | number | Date)[][], confirmar = false) => {
  const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.secao}/importacao/configuracoes${confirmar ? '?confirmar=1' : ''}`,
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
      ['SALDOS_ADM_POR_MILITAR', 6, proximo, 'x'],
      ['SECAO_PADRAO', '1ª SB', '', 'x'],
      ['LINHAS_POR_MILITAR', 3, '', 'x'],
    ], true);
    expect(r.novos).toHaveLength(2);
    expect(r.gravados).toBe(2);
    expect(r.avisos).toEqual([
      'SECAO_PADRAO não é mais usada: o seletor de unidade substitui.',
      'LINHAS_POR_MILITAR era da planilha e não se aplica ao sistema novo.',
    ]);
    expect(r.problemas).toEqual([]);
    const { rows } = await api.banco.query<{ chave: string; vig: string; valor: unknown }>(
      "select chave, to_char(vigencia_desde, 'YYYY-MM') as vig, valor from parametro where unidade_id = $1 order by chave",
      [api.ids.secao],
    );
    // vigência vazia = mês de criação da unidade (carga base: 2026-11)
    expect(rows).toEqual([
      { chave: 'CARGA_MENSAL_HORAS', vig: '2026-11', valor: 160 },
      { chave: 'SALDOS_ADM_POR_MILITAR', vig: proximo, valor: 6 },
    ]);
  });

  it('valor inválido vira problema e o resto entra', async () => {
    const r = await importar([
      ['SALDOS_ADM_POR_MILITAR', 'muitos', '2027-02', ''],
      ['ADM_CUMPRE_CARGA', 'SIM', '', ''],
    ]);
    expect(r.novos.map((n: { chave: string }) => n.chave)).toEqual(['ADM_CUMPRE_CARGA|2026-11']);
    expect(r.problemas).toEqual([
      { aba: 'CONFIGURAÇÕES', linha: 2, mensagem: 'SALDOS_ADM_POR_MILITAR: Use um número inteiro.', solucao: 'Corrija a linha na sandbox e importe de novo.' },
    ]);
  });

  it('valor diferente aparece como alterado', async () => {
    const r = await importar([['CARGA_MENSAL_HORAS', 150, '', '']]);
    expect(r.alterados).toEqual([{ chave: 'CARGA_MENSAL_HORAS|2026-11', descricao: 'Carga mensal (horas) a partir de novembro de 2026', mudancas: ['valor: 160 → 150'] }]);
  });

  it('importar duas vezes: a segunda é toda igual e não grava', async () => {
    const linhas = [['CARGA_MENSAL_HORAS', 160, '', ''], ['SALDOS_ADM_POR_MILITAR', 6, mmaaaa(proximo), '']];
    const antes = await auditoria();
    const r = await importar(linhas, true);
    expect(r).toMatchObject({ novos: [], alterados: [], iguais: 2, gravados: 0 });
    expect(await auditoria()).toBe(antes);
  });

  it('escalante não importa configurações (403)', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/configuracoes?confirmar=1`,
      formulario(await planilha({ 'CONFIGURAÇÕES': [CAB, ['CARGA_MENSAL_HORAS', 120, '', '']] })));
    expect(r.status).toBe(403);
  });

  it('vigência que a planilha guardou como data', async () => {
    const daqui2 = somarMeses(atual, 2);
    const r = await importar([['SALDOS_ADM_POR_MILITAR', 3, new Date(Date.UTC(Number(daqui2.slice(0, 4)), Number(daqui2.slice(5)) - 1, 1)), '']]);
    expect(r.problemas).toEqual([]);
    expect(r.novos.map((n: { chave: string }) => n.chave)).toEqual([`SALDOS_ADM_POR_MILITAR|${daqui2}`]);
  });

  // a importação recusa mês que já passou, como a tela ("Só dá para mudar a partir de…"); vigência vazia vale desde a criação da seção
  it('vigência de um mês que já passou vira problema e não grava; a do mês atual e a de um mês futuro entram (Review Focus 5)', async () => {
    const passado = somarMeses(atual, -2);
    const futuro = somarMeses(atual, 4);
    const linhas = [['CARGA_MENSAL_HORAS', 150, passado, ''], ['SALDOS_ADM_POR_MILITAR', 7, atual, ''], ['ADM_CUMPRE_CARGA', 'SIM', futuro, '']];
    const previa = await importar(linhas);
    expect(previa.problemas).toEqual([{ aba: 'CONFIGURAÇÕES', linha: 2, mensagem: 'Mês já passou', solucao: 'Use o mês atual ou um mês futuro.' }]);
    expect([...previa.novos, ...previa.alterados].map((n: { chave: string }) => n.chave).sort()).toEqual([`ADM_CUMPRE_CARGA|${futuro}`, `SALDOS_ADM_POR_MILITAR|${atual}`].sort());
    expect((await importar(linhas, true)).gravados).toBe(2);
    const { rows } = await api.banco.query<{ vig: string }>("select to_char(vigencia_desde, 'YYYY-MM') as vig from parametro where unidade_id = $1 and chave = 'CARGA_MENSAL_HORAS'", [api.ids.secao]);
    expect(rows.map((r) => r.vig)).not.toContain(passado);
  });

  // [foco 4] o ano 0000 passava e derrubava a confirmação inteira
  it('vigência do ano 0000 vira problema, nunca erro do banco', async () => {
    const linhas = [['CARGA_MENSAL_HORAS', 150, '0000-05', 'x']];
    const previa = await importar(linhas);
    expect(previa.problemas).toEqual([
      { aba: 'CONFIGURAÇÕES', linha: 2, mensagem: 'CARGA_MENSAL_HORAS: vigência "0000-05" inválida.', solucao: 'Corrija a linha na sandbox e importe de novo.' },
    ]);
    expect((await importar(linhas, true)).gravados).toBe(0);
  });

  it('vigência no formato do protótipo (m/aaaa) e a data do Excel são lidas', async () => {
    const r = await importar([['CARGA_MENSAL_HORAS', 150, '1/2031', 'x'], ['SALDOS_ADM_POR_MILITAR', 4, new Date(Date.UTC(2031, 5, 1)), 'x']], true);
    expect(r.problemas).toEqual([]);
    const { rows } = await api.banco.query<{ chave: string; vig: string }>(
      "select chave, to_char(vigencia_desde, 'YYYY-MM') as vig from parametro where unidade_id = $1 and vigencia_desde >= '2031-01-01' order by chave",
      [api.ids.secao],
    );
    expect(rows).toEqual([{ chave: 'CARGA_MENSAL_HORAS', vig: '2031-01' }, { chave: 'SALDOS_ADM_POR_MILITAR', vig: '2031-06' }]);
  });
});
