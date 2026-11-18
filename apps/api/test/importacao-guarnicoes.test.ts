import { mesPorExtenso, type FichaGuarnicao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
let criacao: string; // mês de criação da 1ª SB (aaaa-mm)
const FUTURO = '2099-01';
const CAB = ['VIGÊNCIA', 'GUARNIÇÃO', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'];
type Linha = (string | number | Date)[];

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

  it('máximo vazio vale igual ao mínimo', async () => {
    await importar([['', 'Máximo Vazio', '', '', '', '', '', 'Motorista', 2, '']], true);
    expect((await ficha('Máximo Vazio')).versoes[0]!.composicao[0]).toMatchObject({ minimo: 2, maximo: 2 });
  });

  it('mínimo e máximo vazios ficam de 0 a 0 com aviso', async () => {
    const r = await importar([['', 'Zero Zero', '', '', '', '', '', 'Motorista', '', '']]);
    expect(r.avisos).toContain('Zero Zero: Motorista ficou de 0 a 0 militares; confira MÍNIMO e MÁXIMO.');
    expect(r.avisos.some((a: string) => a.includes('sem atividade'))).toBe(false);
    await importar([['', 'Zero Zero', '', '', '', '', '', 'Motorista', '', '']], true);
    expect((await ficha('Zero Zero')).versoes[0]!.composicao[0]).toMatchObject({ minimo: 0, maximo: 0 });
  });

  it('reimportar a planilha com máximo vazio dá tudo igual', async () => {
    const linhas: Linha[] = [['', 'Reimporta Vazio', '', '', '', '', '', 'Motorista', 1, ''], ['', 'Reimporta Vazio', '', '', '', '', '', 'Combatente', 2, '']];
    await importar(linhas, true);
    expect(await importar(linhas)).toMatchObject({ novos: [], alterados: [], iguais: 1 });
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

  it('a célula de data do Excel continua lida como mês', async () => {
    await importar([[new Date(Date.UTC(2099, 0, 1)), 'Vigência Excel', '', '', '', '', '', 'Motorista', 1, 1]], true);
    expect((await ficha('Vigência Excel')).versoes.map((v) => v.vigencia)).toEqual([FUTURO]);
  });

  it('vigência no formato curto do protótipo (mm/aa) é lida', async () => {
    await importar([['1/99', 'Vigência Curta', '', '', '', '', '', 'Motorista', 1, 1]], true);
    expect((await ficha('Vigência Curta')).versoes.map((v) => v.vigencia)).toEqual([FUTURO]);
  });

  // [foco 4] o ano 0000 passava na prévia e derrubava a confirmação inteira
  it('vigência do ano 0000 vira problema, nunca erro do banco', async () => {
    const linhas: Linha[] = [['0000-05', 'Ano Zero', '', '', '', '', '', 'Motorista', 1, 1]];
    const previa = await importar(linhas);
    expect(previa.problemas).toEqual([{ aba: 'GUARNIÇÕES', linha: 2, mensagem: 'Vigência "0000-05" de Ano Zero', solucao: 'Use aaaa-mm ou mm/aaaa na coluna VIGÊNCIA.' }]);
    expect((await importar(linhas, true)).gravados).toBe(0);
  });

  it('prioridade 0, enorme e tamanhos acima do limite viram problema com a solução', async () => {
    const r = await importar([
      ['', 'Prio Zero', '', '', '', 0, '', 'Motorista', 1, 1],
      ['', 'Prio Enorme', '', '', '', 99999999999, '', 'Motorista', 1, 1],
      ['', 'Tamanho Enorme', '', '', '', 1, '', 'Motorista', 1, 100],
    ]);
    expect(r.problemas).toEqual([
      { aba: 'GUARNIÇÕES', linha: 2, mensagem: 'Prioridade "0" de Prio Zero', solucao: 'Use um número de 1 a 1000.' },
      { aba: 'GUARNIÇÕES', linha: 3, mensagem: 'Prioridade "99999999999" de Prio Enorme', solucao: 'Use um número de 1 a 1000.' },
      { aba: 'GUARNIÇÕES', linha: 4, mensagem: 'Máximo "100" de Tamanho Enorme', solucao: 'Use um número até 99.' },
    ]);
    expect(r.novos).toEqual([]);
    expect((await importar([['', 'Prio Enorme', '', '', '', 99999999999, '', 'Motorista', 1, 1]], true)).gravados).toBe(0);
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

describe('importação de guarnições: versões e funções que já existem', () => {
  const linha = (vigencia: string, guarnicao: string, viatura: string, funcao: string, minimo: number, maximo: number): Linha =>
    [vigencia, guarnicao, viatura, 'Tipo', 'SIM', 1, '', funcao, minimo, maximo];

  it('a planilha com só uma vigência muda essa versão e deixa as outras do sistema como estão', async () => {
    await importar([
      linha('', 'Extras', 'V1', 'Combatente', 1, 1),
      linha('2098-01', 'Extras', 'V2', 'Combatente', 2, 2),
      linha(FUTURO, 'Extras', 'V3', 'Combatente', 3, 3),
    ], true);
    const antes = await ficha('Extras');
    expect(antes.versoes.map((v) => v.vigencia)).toEqual([FUTURO, '2098-01', criacao]);

    const previa = await importar([linha('2098-01', 'Extras', 'V2', 'Combatente', 2, 5)]);
    expect(previa.alterados).toHaveLength(1);
    expect(previa.alterados[0].mudancas.every((m: string) => m.startsWith(mesPorExtenso('2098-01')))).toBe(true);
    await importar([linha('2098-01', 'Extras', 'V2', 'Combatente', 2, 5)], true);

    const depois = await ficha('Extras');
    expect(depois.versoes.map((v) => v.vigencia)).toEqual([FUTURO, '2098-01', criacao]);
    expect(depois.versoes[1]!.composicao[0]).toMatchObject({ minimo: 2, maximo: 5 });
    expect(depois.versoes[0]).toEqual(antes.versoes[0]);
    expect(depois.versoes[2]).toEqual(antes.versoes[2]);
  });

  it('função com e sem acento é a mesma: "Acao" usa a "Ação" do catálogo e "Operação" usa a "Operacao"', async () => {
    await inserir(api.banco, 'funcao', { unidade_id: api.ids.gb, nome: 'Ação' });
    await inserir(api.banco, 'funcao', { unidade_id: api.ids.gb, nome: 'Operacao' });
    const antes = (await api.banco.query<{ n: number }>('select count(*)::int as n from funcao')).rows[0]!.n;
    const previa = await importar([linha('', 'Acentos', 'A1', 'Acao', 1, 1), linha('', 'Acentos', '', 'Operação', 1, 1)]);
    expect(previa.avisos.join(' ')).not.toMatch(/Funções novas/);
    await importar([linha('', 'Acentos', 'A1', 'Acao', 1, 1), linha('', 'Acentos', '', 'Operação', 1, 1)], true);
    expect((await api.banco.query<{ n: number }>('select count(*)::int as n from funcao')).rows[0]!.n).toBe(antes);
    expect(nomes(await ficha('Acentos')).sort()).toEqual(['Ação', 'Operacao']);
  });
});
