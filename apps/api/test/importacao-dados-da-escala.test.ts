import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { somarMeses } from 'contratos';
import { hojeRecife } from '../src/datas.ts';
import { IMPORTADORES } from '../src/importacao/registro.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Dados fictícios (D7). A importação "Dados da escala" atualiza quem já está cadastrado (no Pecúlio) e nunca cria militar nem muda a lotação.
let api: ApiDeTeste;
let outraSecao: string;
let sd: string;
const atual = hojeRecife().slice(0, 7);
const dia1 = `${atual}-01`;
const CAB = ['MATRÍCULA', 'JORNADA', 'EQUIPE', 'MOTORISTA', 'VOLUNTÁRIO JES', 'CNH'];
let seq = 0;

async function militar(nome: string, periodo: { desde: string; ate?: string | null; unidade?: string; equipe?: string | null; jornada?: 'pronto' | 'adm' } | null, extra: Record<string, unknown> = {}) {
  seq++;
  const matricula = `99${2200 + seq}-${seq % 10}`;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: sd, nome_guerra: nome, antiguidade: seq, ...extra });
  if (periodo) {
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: periodo.unidade ?? api.ids.secao, equipe_id: periodo.equipe ?? null, jornada: periodo.jornada ?? 'pronto', desde: periodo.desde, ate: periodo.ate ?? null,
    });
  }
  return { id, matricula };
}
async function importar(linhas: (string | number)[][], confirmar = false, quem: 'gestorGb' | 'escalante' = 'escalante', abas: Record<string, (string | number)[][]> = { 'DADOS DA ESCALA': [CAB, ...linhas] }) {
  const r = await api.pedir(quem, 'POST', `/api/unidades/${api.ids.secao}/importacao/dados-da-escala${confirmar ? '?confirmar=1' : ''}`, formulario(await planilha(abas)));
  return r;
}
const ok = async (r: Response) => {
  expect(r.status).toBe(200);
  return r.json();
};
const periodos = async (id: string) =>
  (await api.banco.query<{ equipe: string | null; jornada: string; desde: string; ate: string | null }>(
    `select e.nome as equipe, l.jornada, to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
       from rastreio l left join equipe e on e.id = l.equipe_id where l.militar_id = $1 order by l.desde`, [id])).rows;
const contagemDeMilitares = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from militar')).rows[0]!.n;

beforeAll(async () => {
  api = await montarApi();
  sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('o modelo', () => {
  it('tem a aba DADOS DA ESCALA e só as seis colunas do contrato, na ordem', async () => {
    const colunas = IMPORTADORES['dados-da-escala']!.modelo.abas;
    expect(colunas.map((a) => a.nome)).toEqual(['DADOS DA ESCALA']);
    expect(colunas[0]!.colunas.map((c) => c.rotulo)).toEqual(CAB);
    expect(colunas[0]!.colunas.filter((c) => c.obrigatoria).map((c) => c.rotulo)).toEqual(['MATRÍCULA', 'JORNADA']);
    const r = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/importacao/dados-da-escala/modelo`);
    expect(r.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await r.arrayBuffer());
    expect(wb.getWorksheet('DADOS DA ESCALA')!.getRow(1).values).toEqual([undefined, ...CAB]);
  });

  it('o importador antigo saiu: o modelo de militares dá 404', async () => {
    expect((await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/importacao/militares/modelo`)).status).toBe(404);
    expect(IMPORTADORES.militares).toBeUndefined();
  });
});

describe('importar os dados da escala', () => {
  it('uma planilha com a aba MILITARES recebe a mensagem de aba faltando', async () => {
    const r = await importar([], false, 'escalante', { MILITARES: [['MATRÍCULA', 'NOME DE GUERRA'], ['990201-1', 'ANDRADE']] });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toContain('A planilha não tem a aba "DADOS DA ESCALA".');
  });

  it('matrícula desconhecida: o problema e a solução fixos, e nada é criado', async () => {
    const antes = await contagemDeMilitares();
    const r = await ok(await importar([['990999-9', 'PRONTO', 'ALFA', '', '', '']], true));
    expect(r.problemas).toEqual([{ aba: 'DADOS DA ESCALA', linha: 2, mensagem: 'A matrícula 990999-9 não está cadastrada.', solucao: 'Cadastre o militar no Pecúlio antes.' }]);
    expect(r.gravados).toBe(0);
    expect(await contagemDeMilitares()).toBe(antes);
  });

  it('militar lotado noutra unidade: o problema fixo, e nada é gravado para ele', async () => {
    const m = await militar('CABRAL', { desde: dia1, unidade: outraSecao });
    const r = await ok(await importar([[m.matricula, 'ADM', '', 'SIM', '', 'D']], true));
    expect(r.problemas).toEqual([
      { aba: 'DADOS DA ESCALA', linha: 2, mensagem: 'CABRAL está lotado na 2ª SB: os dados da escala dele são importados lá.', solucao: 'Confira a matrícula ou importe pela 2ª SB.' },
    ]);
    expect(r.gravados).toBe(0);
    expect(await periodos(m.id)).toEqual([{ equipe: null, jornada: 'pronto', desde: dia1, ate: null }]);
    const motorista = (await api.banco.query<{ motorista: boolean }>('select motorista from militar where id = $1', [m.id])).rows[0]!.motorista;
    expect(motorista).toBe(false);
  });

  it('jornada e equipe novas a partir do mês da importação: fecha o período aberto na véspera do dia 1 e abre outro, com a mesma lotação', async () => {
    const antigo = `${somarMeses(atual, -2)}-01`;
    const m = await militar('DANTAS', { desde: antigo });
    const previa = await ok(await importar([[m.matricula, 'PRONTO', 'ALFA', '', '', '']]));
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([{ chave: m.matricula, descricao: 'SD BM DANTAS', mudancas: ['equipe: sem equipe → ALFA'] }]);
    expect(await periodos(m.id)).toEqual([{ equipe: null, jornada: 'pronto', desde: antigo, ate: null }]);
    await ok(await importar([[m.matricula, 'PRONTO', 'ALFA', '', '', '']], true));
    const vespera = new Date(Date.UTC(Number(atual.slice(0, 4)), Number(atual.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
    expect(await periodos(m.id)).toEqual([
      { equipe: null, jornada: 'pronto', desde: antigo, ate: vespera },
      { equipe: 'ALFA', jornada: 'pronto', desde: dia1, ate: null },
    ]);
  });

  it('período aberto que começa no dia 1 do mesmo mês: substituído, sem período de zero dia', async () => {
    const m = await militar('ESTEVES', { desde: dia1 });
    await ok(await importar([[m.matricula, 'ADM', '', '', '', '']], true));
    expect(await periodos(m.id)).toEqual([{ equipe: null, jornada: 'adm', desde: dia1, ate: null }]);
  });

  it('o militar recém-criado pelo Pecúlio, ainda sem equipe, ganha a equipe e a jornada, sem duplicar o período', async () => {
    // o Pecúlio abre o período no dia do cadastro (depois do dia 1)
    const hoje = hojeRecife();
    const m = await militar('FALCAO', { desde: hoje });
    await ok(await importar([[m.matricula, 'PRONTO', 'BRAVO', '', '', '']], true));
    expect(await periodos(m.id)).toEqual([{ equipe: 'BRAVO', jornada: 'pronto', desde: hoje, ate: null }]);
  });

  it('jornada e equipe iguais às de hoje: nada muda, e a prévia diz "sem mudança"', async () => {
    const m = await militar('GOMES', { desde: dia1, jornada: 'adm' });
    const r = await ok(await importar([[m.matricula, 'ADM', '', 'NÃO', 'NÃO', '']]));
    expect(r.alterados).toEqual([]);
    expect(r.iguais).toBe(1);
    expect(r.gravados ?? 0).toBe(0);
  });

  it('motorista, CNH e voluntário JES são atualizados no militar', async () => {
    const m = await militar('HENRIQUE', { desde: dia1 });
    await ok(await importar([[m.matricula, 'PRONTO', '', 'SIM', 'SIM', 'DB']], true));
    const x = (await api.banco.query<{ motorista: boolean; cnh: string[]; voluntario_jes: boolean }>('select motorista, cnh, voluntario_jes from militar where id = $1', [m.id])).rows[0]!;
    expect(x).toEqual({ motorista: true, cnh: ['B', 'D'], voluntario_jes: true });
  });

  it('o escalante da 1ª SB importa a matrícula de um militar da 2ª SB: problema na linha, nada gravado', async () => {
    const m = await militar('JARDIM', { desde: dia1, unidade: outraSecao });
    const r = await ok(await importar([[m.matricula, 'ADM', '', '', '', '']], true, 'escalante'));
    expect(r.problemas).toHaveLength(1);
    expect(await periodos(m.id)).toEqual([{ equipe: null, jornada: 'pronto', desde: dia1, ate: null }]);
  });

  it('sem período nenhum, o militar não é lotado pela importação: problema na linha', async () => {
    const m = await militar('KLEBER', null);
    const r = await ok(await importar([[m.matricula, 'PRONTO', 'ALFA', '', '', '']], true));
    expect(r.problemas).toEqual([
      { aba: 'DADOS DA ESCALA', linha: 2, mensagem: 'KLEBER não está lotado em nenhuma seção.', solucao: 'Lote o militar pelo Pecúlio antes.' },
    ]);
    expect(await periodos(m.id)).toEqual([]);
  });

  it('reimportar não desfaz a transferência marcada para o mês seguinte', async () => {
    const proximo = somarMeses(atual, 1);
    const m = await militar('LIMA', { desde: dia1 });
    const bravo = (await api.banco.query<{ id: string }>("select id from equipe where nome = 'BRAVO'")).rows[0]!.id;
    expect((await api.pedir('escalante', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: `${proximo}-01` })).status).toBe(201);
    const r = await ok(await importar([[m.matricula, 'PRONTO', 'ALFA', '', '', '']], true));
    expect(r.avisos.some((a: string) => a.includes('tem transferência marcada'))).toBe(true);
    expect((await periodos(m.id)).map((p) => [p.equipe, p.desde])).toEqual([[null, dia1], ['BRAVO', `${proximo}-01`]]);
  });

  it('um militar com dois períodos no mês é comparado com o aberto, e o fechado não é mexido', async () => {
    const m = await militar('MENDES', { desde: dia1 });
    const bravo = (await api.banco.query<{ id: string }>("select id from equipe where nome = 'BRAVO'")).rows[0]!.id;
    const dia = (n: number) => `${atual}-${String(n).padStart(2, '0')}`;
    expect((await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: dia(15) })).status).toBe(201);
    const r = await ok(await importar([[m.matricula, 'PRONTO', 'BRAVO', '', '', '']], true));
    expect(r.alterados.find((x: { chave: string }) => x.chave === m.matricula)).toBeUndefined();
    expect((await periodos(m.id)).map((p) => [p.equipe, p.ate])).toEqual([[null, dia(14)], ['BRAVO', null]]);
  });
});
