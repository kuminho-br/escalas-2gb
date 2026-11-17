import { mesPorExtenso, type FichaGuarnicao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
let criacao: string; // mês de criação da 1ª SB (aaaa-mm)
const FUTURO = '2099-01';
const CAB = ['VIGÊNCIA', 'GUARNIÇÃO', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'];
type Linha = (string | number)[];

const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
async function importar(linhas: Linha[], confirmar = false, cab: string[] = CAB) {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/guarnicoes${confirmar ? '?confirmar=1' : ''}`,
    formulario(await planilha({ 'GUARNIÇÕES': [cab, ...linhas] })));
  expect(r.status).toBe(200);
  return r.json();
}
async function ficha(nome: string): Promise<FichaGuarnicao> {
  const id = (await api.banco.query<{ id: string }>('select id from guarnicao where unidade_id = $1 and nome = $2', [api.ids.secao, nome])).rows[0]!.id;
  return (await api.pedir('escalante', 'GET', `/api/guarnicoes/${id}`)).json();
}
const nomes = (f: FichaGuarnicao, i = 0) => f.versoes[i]!.composicao.map((c) => c.funcao);

beforeAll(async () => {
  api = await montarApi();
  criacao = (await api.banco.query<{ mes: string }>("select to_char(desde, 'YYYY-MM') as mes from unidade where id = $1", [api.ids.secao])).rows[0]!.mes;
  await inserir(api.banco, 'funcao', { unidade_id: api.ids.gb, nome: 'Motorista' });
});
afterAll(async () => {
  await api.fechar();
});

const BASE: Linha[] = [
  ['', 'Auto Bomba 1', 'ABT-01', 'Auto Bomba', 'SIM', 1, 'D', 'Motorista', 1, 1],
  ['', 'Auto Bomba 1', '', '', '', '', '', 'Combatente', 2, 3],
  [FUTURO, 'Auto Bomba 1', '', '', '', '', '', 'Combatente', 2, 4],
];

describe('importação de guarnições', () => {
  it('importa guarnição com duas vigências', async () => {
    const previa = await importar(BASE);
    expect(previa.novos).toEqual([{ chave: 'Auto Bomba 1', descricao: 'Auto Bomba 1 (2 versões)' }]);
    const r = await importar(BASE, true);
    expect(r.gravados).toBe(1);
    const f = await ficha('Auto Bomba 1');
    expect(f.atividadeId).toBeNull();
    expect(f.versoes.map((v) => v.vigencia)).toEqual([FUTURO, criacao]);
    expect(f.versoes[1]).toMatchObject({
      viatura: 'ABT-01', tipoViatura: 'Auto Bomba', prioridade: 1, ativa: true,
      composicao: [
        { funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D' },
        { funcao: 'Combatente', minimo: 2, maximo: 3, cnhExigida: null },
      ],
    });
    expect(f.versoes[0]!.composicao.find((c) => c.funcao === 'Combatente')).toMatchObject({ minimo: 2, maximo: 4 });
  });

  it('função nova entra no catálogo da seção, e a herdada do 2º GB é usada', async () => {
    await importar([['', 'Catálogo 1', '', '', '', '', '', 'Motorista', 1, 1], ['', 'Catálogo 1', '', '', '', '', '', 'Rapel', 1, 1]], true);
    const { rows } = await api.banco.query<{ nome: string; unidade_id: string }>("select nome, unidade_id from funcao where nome in ('Motorista', 'Rapel')");
    expect(rows.filter((r) => r.nome === 'Motorista')).toHaveLength(1);
    expect(rows.find((r) => r.nome === 'Rapel')!.unidade_id).toBe(api.ids.secao);
  });

  it('prévia avisa as funções novas e não grava', async () => {
    const antes = await auditoria();
    const r = await importar([['', 'Prévia 1', '', '', '', '', '', 'Socorrista', 1, 2]]);
    expect(r.avisos).toContain('Funções novas: Socorrista.');
    expect(await auditoria()).toBe(antes);
  });

  it('máximo 0 retira a função', async () => {
    await importar([
      ['', 'Retira', '', '', '', '', '', 'Motorista', 1, 1],
      ['', 'Retira', '', '', '', '', '', 'Combatente', 1, 2],
      [FUTURO, 'Retira', '', '', '', '', '', 'Combatente', 0, 0],
    ], true);
    const f = await ficha('Retira');
    expect(nomes(f, 1)).toEqual(['Motorista', 'Combatente']);
    expect(nomes(f, 0)).toEqual(['Motorista']);
  });

  it('CNH C/D vira C', async () => {
    await importar([['', 'Cnh Ok', '', '', '', '', 'C/D', 'Motorista', 1, 1], ['', 'Cnh Ok 2', '', '', '', '', 'B, C, D', 'Motorista', 1, 1]], true);
    expect((await ficha('Cnh Ok')).versoes[0]!.composicao[0]!.cnhExigida).toBe('C');
    expect((await ficha('Cnh Ok 2')).versoes[0]!.composicao[0]!.cnhExigida).toBe('B');
  });

  it('CNH A/B vira problema e a função entra sem CNH', async () => {
    const linhas: Linha[] = [['', 'Cnh Ruim', '', '', '', '', '', 'Combatente', 1, 2], ['', 'Cnh Ruim', '', '', '', '', 'A/B', 'Motorista', 1, 1]];
    const previa = await importar(linhas);
    expect(previa.problemas).toEqual([
      { aba: 'GUARNIÇÕES', linha: 3, mensagem: 'CNH "A/B" não cabe numa categoria só (Cnh Ruim, Motorista).', solucao: 'Escolha a categoria na tela de Guarnições.' },
    ]);
    await importar(linhas, true);
    expect((await ficha('Cnh Ruim')).versoes[0]!.composicao.find((c) => c.funcao === 'Motorista')!.cnhExigida).toBeNull();
  });

  it('guarnição sem atividade gera o aviso', async () => {
    const r = await importar([
      ['', 'Sem Ativ 1', '', '', '', '', '', 'Motorista', 1, 1],
      ['', 'Sem Ativ 2', '', '', '', '', '', 'Motorista', 1, 1],
    ]);
    expect(r.avisos).toContain('2 guarnições sem atividade: escolha a atividade de cada uma na tela de Guarnições.');
  });

  it('linha com mínimo inválido vira problema, sem códigos internos', async () => {
    const r = await importar([
      ['', 'Mínimo Ruim', '', '', '', '', '', 'Motorista', 'x', 1],
      ['', 'Mínimo Ruim', '', '', '', '', 'D', '', '', ''],
    ]);
    expect(r.problemas).toEqual([
      { aba: 'GUARNIÇÕES', linha: 2, mensagem: 'Mínimo Ruim: MÍNIMO, MÁXIMO e PRIORIDADE precisam ser números inteiros; linha ignorada.', solucao: 'Corrija a linha na planilha e importe de novo.' },
      expect.objectContaining({ aba: 'GUARNIÇÕES', linha: 3, mensagem: expect.stringMatching(/^Mínimo Ruim: CNH "D" numa linha sem FUNÇÃO\./) }),
    ]);
    for (const p of r.problemas) expect(p.mensagem).not.toMatch(/RN-|B\d{2}/);
  });

  it('vigência digitada como data é lida como mês', async () => {
    await importar([['01/01/2099', 'Vigência Data', '', '', '', '', '', 'Motorista', 1, 1]], true);
    expect((await ficha('Vigência Data')).versoes.map((v) => v.vigencia)).toEqual([FUTURO]);
  });

  it('sem a coluna GUARNIÇÃO a prévia diz como corrigir', async () => {
    const r = await importar([['x']], false, ['VIATURA']);
    expect(r.problemas).toEqual([
      { aba: 'GUARNIÇÕES', linha: 1, mensagem: 'Falta a coluna GUARNIÇÃO.', solucao: 'Use o modelo desta tela.' },
      { aba: 'GUARNIÇÕES', linha: 1, mensagem: 'Falta a coluna FUNÇÃO.', solucao: 'Use o modelo desta tela.' },
    ]);
  });

  it('correção que iguala a versão anterior da planilha ainda atualiza o mês do sistema', async () => {
    const JUNHO = '2099-06';
    const antes: Linha[] = [['', 'Corrige', '', '', '', '', '', 'Motorista', 1, 1], [JUNHO, 'Corrige', '', '', '', '', '', 'Motorista', 2, 2]];
    await importar(antes, true);
    expect((await ficha('Corrige')).versoes.map((v) => v.vigencia)).toEqual([JUNHO, criacao]);
    const depois: Linha[] = [antes[0]!, [JUNHO, 'Corrige', '', '', '', '', '', 'Motorista', 1, 1]];
    const r = await importar(depois);
    expect(r.alterados).toEqual([
      { chave: 'Corrige', descricao: 'Corrige', mudancas: [`${mesPorExtenso(JUNHO)}: Motorista: mínimo 2 → 1`, `${mesPorExtenso(JUNHO)}: Motorista: máximo 2 → 1`] },
    ]);
    await importar(depois, true);
    const junho = (await ficha('Corrige')).versoes.find((v) => v.vigencia === JUNHO)!;
    expect(junho.composicao).toMatchObject([{ funcao: 'Motorista', minimo: 1, maximo: 1 }]);
  });

  it('sem a coluna FUNÇÃO a prévia diz como corrigir e não retira funções', async () => {
    const r = await importar([['', 'Auto Bomba 1']], false, ['VIGÊNCIA', 'GUARNIÇÃO']);
    expect(r.problemas).toEqual([{ aba: 'GUARNIÇÕES', linha: 1, mensagem: 'Falta a coluna FUNÇÃO.', solucao: 'Use o modelo desta tela.' }]);
    expect(r).toMatchObject({ novos: [], alterados: [], iguais: 0 });
  });

  it('importar duas vezes não grava nada', async () => {
    await importar(BASE, true);
    const antes = await auditoria();
    const r = await importar(BASE);
    expect(r).toMatchObject({ novos: [], alterados: [], iguais: 1 });
    const confirmada = await importar(BASE, true);
    expect(confirmada.gravados).toBe(0);
    expect(await auditoria()).toBe(antes);
  });

  it('mudança numa vigência aparece campo a campo na prévia', async () => {
    const mudada: Linha[] = [BASE[0]!, ['', 'Auto Bomba 1', '', '', '', '', '', 'Combatente', 2, 5], BASE[2]!];
    const r = await importar(mudada);
    expect(r.alterados).toEqual([{ chave: 'Auto Bomba 1', descricao: 'Auto Bomba 1', mudancas: [`${mesPorExtenso(criacao)}: Combatente: máximo 3 → 5`] }]);
    await importar(mudada, true);
    expect((await ficha('Auto Bomba 1')).versoes.find((v) => v.vigencia === criacao)!.composicao.find((c) => c.funcao === 'Combatente')!.maximo).toBe(5);
  });
});
