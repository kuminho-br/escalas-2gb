import type { ResultadoDaBusca } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.51, Task 1: a busca de militares com filtros (POST /api/consulta/militares/buscar). Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let divOp: string;
let da: string;
let sb1: string; // dentro da DivOp
let sb2: string; // dentro da DA
let sb3: string; // direto no 2º GB
let sb9: string; // de outro grupamento
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const quadro: Record<string, string> = {};
const alvo: Record<string, string> = {};
let escalante1sb: Pessoa;
const ROTA = '/api/consulta/militares/buscar';

type Quem = 'admin' | 'gestorGb' | 'semPapel' | Pessoa;
const enviar = (quem: Quem, corpo: unknown) => (typeof quem === 'string' ? api.pedir(quem, 'POST', ROTA, corpo) : quem.pedir('POST', ROTA, corpo));
const buscar = async (quem: Quem, corpo: unknown): Promise<ResultadoDaBusca> => {
  const r = await enviar(quem, corpo);
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return r.json();
};
const nomes = (r: ResultadoDaBusca) => r.militares.map((m) => m.nomeGuerra).sort();

type Extra = { jornada?: string; equipe?: string; situacao?: string; quadro?: string | null; posto?: string; mil?: Record<string, unknown> };
async function militar(chave: string, matricula: string, unidadeId: string | null, e: Extra = {}) {
  const postoId = (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [e.posto ?? 'SD'])).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: postoId, nome_guerra: chave, nome_completo: `Fulano ${chave}`, antiguidade: 1 + Object.keys(alvo).length, ...e.mil });
  if (unidadeId) {
    const q = e.quadro === undefined ? 'QBMG' : e.quadro;
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: unidadeId, jornada: e.jornada ?? 'adm', desde: dia1,
      ...(q ? { quadro_id: quadro[q] } : {}), ...(e.equipe ? { equipe_id: e.equipe } : {}), ...(e.situacao ? { situacao_id: e.situacao } : {}),
    });
  }
  alvo[chave] = id;
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb2, da]);
  const gb9 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
  sb9 = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '9ª SB', nome: '9ª Seção', mae_id: gb9, desde: '2026-11-01' });

  const equipeA = await inserir(api.banco, 'equipe', { unidade_id: sb1, nome: 'Alfa', ordem_ciclo: 1 });
  const afastada = (await api.banco.query<{ id: string }>("select id from situacao_militar where nome <> 'Ativa' limit 1")).rows[0]!.id;
  const funcao = await inserir(api.banco, 'funcao_militar', { nome: 'Chefe de seção' });
  const tipo = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'LTS'")).rows[0]!.id;

  // completos e em dia
  await militar('ALFA1', '995901-1', sb1, { jornada: 'pronto', equipe: equipeA, mil: { motorista: true, cnh: ['D'], voluntario_jes: true, funcao_militar_id: funcao } });
  await militar('ALFA2', '995902-2', sb1, { jornada: 'pronto', equipe: equipeA, posto: 'CB', mil: { cnh: ['B'] } });
  await militar('ADM1', '995903-3', sb2, { jornada: 'adm' });
  await militar('DOGB', '995904-4', sb3, { jornada: 'adm', posto: '3º SGT' });
  await militar('OUTRO', '995905-5', sb9, { jornada: 'adm', mil: { voluntario_jes: true } });
  // cada pendência de cadastro, sozinha
  await militar('SEMEQUIPE', '995911-1', sb1, { jornada: 'pronto' });
  await militar('SEMQUADRO', '995912-2', sb1, { jornada: 'adm', quadro: null });
  await militar('MOTSEMCNH', '995913-3', sb1, { jornada: 'adm', mil: { motorista: true, cnh: [] } });
  await militar('SEMNOME', '995914-4', sb1, { jornada: 'adm', mil: { nome_completo: null } });
  await militar('SEMANTIG', '995915-5', sb1, { jornada: 'adm', mil: { antiguidade: null } });
  await militar('SEMLOTACAO', '995916-6', null);
  await militar('DESATIVADO', '995917-7', sb1, { jornada: 'adm', situacao: afastada });
  await inserir(api.banco, 'afastamento', { militar_id: alvo.ALFA2, tipo_afastamento_id: tipo, inicio: somarDias(hoje, -2), fim: somarDias(hoje, 5) });
  await inserir(api.banco, 'afastamento', { militar_id: alvo.ADM1, tipo_afastamento_id: tipo, inicio: somarDias(hoje, 10), fim: somarDias(hoje, 15) });

  escalante1sb = await entrarComo(api, { matricula: '995931-1', nome: 'CESCAL', nivel: { papel: 'escalante', unidadeId: sb1 } });
});
afterAll(async () => {
  await api.fechar();
});

describe('a busca com filtros: o corpo', () => {
  it('sem nenhum filtro: 400 "Escolha pelo menos um filtro."', async () => {
    for (const corpo of [{}, { texto: '' }, { texto: 'ab' }, { unidades: [] }]) {
      const r = await enviar('gestorGb', corpo);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
      expect((await r.json()).erro).toBe('Escolha pelo menos um filtro.');
    }
  });

  it('corpo fora do formato é 400, e unidade que não existe é 404', async () => {
    expect((await enviar('gestorGb', { unidades: [{ id: 'xx', comAsDeBaixo: true }] })).status).toBe(400);
    expect((await enviar('gestorGb', { unidades: [{ id: '00000000-0000-4000-8000-000000000000', comAsDeBaixo: true }] })).status).toBe(404);
  });

  it('a linha traz a identificação, a situação e se quem pede pode alterar; a rota antiga continua respondendo', async () => {
    const r = await buscar('gestorGb', { texto: 'ALFA1' });
    expect(r.militares).toHaveLength(1);
    expect(r.militares[0]).toMatchObject({ nomeGuerra: 'ALFA1', matricula: '995901-1', postoGrad: 'SD', lotacao: expect.any(String), quadro: 'QBMG', equipe: 'Alfa', jornada: 'pronto', unidadeId: sb1, podeAlterar: true });
    expect(r.haMais).toBe(false);
    expect(r.naoEncontradas).toEqual([]);
    expect((await api.pedir('gestorGb', 'GET', '/api/consulta/militares?texto=ALFA1')).status).toBe(200);
  });
});

describe('cada filtro, sozinho', () => {
  it('lotação: a unidade só, ou com as de baixo; várias somam', async () => {
    expect(nomes(await buscar('gestorGb', { unidades: [{ id: sb3, comAsDeBaixo: false }] }))).toEqual(['DOGB']);
    expect(nomes(await buscar('gestorGb', { unidades: [{ id: divOp, comAsDeBaixo: false }] }))).toEqual([]);
    const comBaixo = nomes(await buscar('gestorGb', { unidades: [{ id: divOp, comAsDeBaixo: true }] }));
    expect(comBaixo).toContain('ALFA1');
    expect(comBaixo).not.toContain('ADM1');
    expect(nomes(await buscar('gestorGb', { unidades: [{ id: sb3, comAsDeBaixo: false }, { id: sb9, comAsDeBaixo: false }] }))).toEqual(['DOGB', 'OUTRO']);
  });

  it('Review Focus 5: a unidade "e as de baixo" junto com uma filha marcada sozinha traz o militar uma vez só', async () => {
    const r = await buscar('gestorGb', { unidades: [{ id: divOp, comAsDeBaixo: true }, { id: sb1, comAsDeBaixo: false }] });
    expect(r.militares.filter((m) => m.nomeGuerra === 'ALFA1')).toHaveLength(1);
  });

  it('posto, quadro, jornada, equipe, situação, JES, motorista, CNH, função', async () => {
    const unidade = { unidades: [{ id: api.ids.raiz, comAsDeBaixo: true }] };
    const ids = async (sql: string, p: unknown[] = []) => (await api.banco.query<{ id: string }>(sql, p)).rows.map((x) => x.id);
    expect(nomes(await buscar('gestorGb', { ...unidade, postoGradIds: await ids("select id from posto_grad where sigla = 'CB'") }))).toEqual(['ALFA2']);
    expect(nomes(await buscar('gestorGb', { ...unidade, quadroIds: [quadro.QOC!] }))).toEqual([]);
    expect(nomes(await buscar('gestorGb', { ...unidade, jornada: 'pronto' }))).toEqual(['ALFA1', 'ALFA2', 'SEMEQUIPE']);
    expect(nomes(await buscar('gestorGb', { ...unidade, equipe: 'alfa' }))).toEqual(['ALFA1', 'ALFA2']);
    expect(nomes(await buscar('gestorGb', { ...unidade, situacaoIds: await ids("select id from situacao_militar where nome <> 'Ativa' limit 1") }))).toEqual(['DESATIVADO']);
    // JES e motorista: o OUTRO (9º GB) é voluntário e está fora do alcance de quem é gestor do 2º GB, então não vem
    expect(nomes(await buscar('gestorGb', { ...unidade, voluntarioJes: true }))).toEqual(['ALFA1']);
    expect(nomes(await buscar('admin', { ...unidade, voluntarioJes: true }))).toEqual(['ALFA1', 'OUTRO']);
    expect(nomes(await buscar('gestorGb', { ...unidade, motorista: true }))).toEqual(['ALFA1', 'MOTSEMCNH']);
    expect(nomes(await buscar('gestorGb', { ...unidade, cnh: ['B', 'C'] }))).toEqual(['ALFA2']);
    expect(nomes(await buscar('gestorGb', { ...unidade, funcaoIds: await ids("select id from funcao_militar where nome = 'Chefe de seção'") }))).toEqual(['ALFA1']);
  });

  it('afastado hoje: só quem tem afastamento que cobre hoje (o que começa depois não conta); false traz os outros', async () => {
    const unidade = { unidades: [{ id: api.ids.gb, comAsDeBaixo: true }] };
    expect(nomes(await buscar('gestorGb', { ...unidade, afastadoHoje: true }))).toEqual(['ALFA2']);
    const fora = nomes(await buscar('gestorGb', { ...unidade, afastadoHoje: false }));
    expect(fora).toContain('ADM1');
    expect(fora).not.toContain('ALFA2');
  });

  it('cadastro incompleto: cada pendência de cadastro é achada, e quem está em dia não', async () => {
    const r = nomes(await buscar('gestorGb', { unidades: [{ id: api.ids.gb, comAsDeBaixo: true }], cadastroIncompleto: true }));
    expect(r).toEqual(['MOTSEMCNH', 'SEMANTIG', 'SEMEQUIPE', 'SEMNOME', 'SEMQUADRO'].sort());
    const emDia = nomes(await buscar('gestorGb', { unidades: [{ id: api.ids.gb, comAsDeBaixo: true }], cadastroIncompleto: false }));
    expect(emDia).toEqual(expect.arrayContaining(['ALFA1', 'ALFA2', 'ADM1', 'DOGB']));
    for (const n of r) expect(emDia).not.toContain(n);
  });

  it('dois filtros somam: pronto e motorista', async () => {
    expect(nomes(await buscar('gestorGb', { unidades: [{ id: api.ids.gb, comAsDeBaixo: true }], jornada: 'pronto', motorista: true }))).toEqual(['ALFA1']);
  });
});

describe('o arquivo de matrículas', () => {
  it('acha com e sem pontuação, repetidas e linhas vazias valem uma vez, e o que não existe vai em naoEncontradas', async () => {
    const r = await buscar('admin', { matriculas: ['995901-1', '9959011', ' 995901-1 ', '995902-2', '995999-9', '9959999', 'abc'] });
    expect(nomes(r)).toEqual(['ALFA1', 'ALFA2']);
    expect(r.naoEncontradas).toEqual(['995999-9', 'abc']);
  });

  it('com outro filtro, quem sai pelo outro filtro não vira "não encontrado"', async () => {
    const r = await buscar('admin', { matriculas: ['995901-1', '995902-2'], jornada: 'adm' });
    expect(nomes(r)).toEqual([]);
    expect(r.naoEncontradas).toEqual([]);
  });
});

describe('o teto de 500 linhas', () => {
  it('com mais de 500, devolve 500 e haMais', async () => {
    const postoId = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const gb9 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '9º GB'")).rows[0]!.id;
    await api.banco.query(
      `insert into militar (matricula, posto_grad_id, nome_guerra)
       select '98' || lpad(g::text, 4, '0') || '-' || (g % 10), $1, 'LOTE' || g from generate_series(1, 520) g`,
      [postoId],
    );
    await api.banco.query(
      `insert into rastreio (militar_id, unidade_id, jornada, desde) select id, $1, 'adm', $2 from militar where nome_guerra like 'LOTE%'`,
      [gb9, dia1],
    );
    const r = await buscar('admin', { unidades: [{ id: gb9, comAsDeBaixo: true }] });
    expect(r.militares).toHaveLength(500);
    expect(r.haMais).toBe(true);
  });

  it('o militar comum recebe no máximo 50 linhas por busca, como na rota antiga (a varredura da corporação por esta rota não rende mais)', async () => {
    const gb9 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '9º GB'")).rows[0]!.id;
    const r = await buscar('semPapel', { unidades: [{ id: gb9, comAsDeBaixo: true }] });
    expect(r.militares).toHaveLength(50);
    expect(r.haMais).toBe(true);
  });
});

describe('a borda de visão', () => {
  it('Review Focus 4: o militar comum manda filtro restrito e ele é ignorado (nem erro, nem vazamento)', async () => {
    const r = await buscar('semPapel', { unidades: [{ id: api.ids.gb, comAsDeBaixo: true }], voluntarioJes: true, cadastroIncompleto: true, jornada: 'pronto', motorista: true, matriculas: ['995901-1'] });
    // só a lotação vale: vem quem está no 2º GB, voluntário ou não, com cadastro em dia ou não
    expect(nomes(r)).toEqual(expect.arrayContaining(['ALFA1', 'ALFA2', 'ADM1', 'DOGB', 'SEMEQUIPE', 'SEMQUADRO']));
    expect(r.naoEncontradas).toEqual([]);
    // sem nenhum filtro que valha (só os restritos): 400
    expect((await enviar('semPapel', { voluntarioJes: true })).status).toBe(400);
    expect((await enviar('semPapel', { matriculas: ['995901-1'] })).status).toBe(400);
  });

  it('o militar comum não recebe a situação dos militares nem pode alterar nenhum', async () => {
    const r = await buscar('semPapel', { texto: 'ALFA1' });
    expect(r.militares[0]).toMatchObject({ nomeGuerra: 'ALFA1', equipe: null, jornada: null, situacao: null, podeAlterar: false });
  });

  it('filtro restrito só enxerga quem está no alcance da pessoa: o escalante da 1ª SB não descobre quem é voluntário em outra unidade', async () => {
    const r = await buscar(escalante1sb, { unidades: [{ id: api.ids.raiz, comAsDeBaixo: true }], voluntarioJes: true });
    expect(nomes(r)).toEqual(['ALFA1']);
  });

  it('podeAlterar: o escalante da própria seção não altera (nível acima da lotação); o gestor do 2º GB e o administrador sim', async () => {
    const dele = await buscar(escalante1sb, { texto: 'ALFA1' });
    expect(dele.militares[0]!.podeAlterar).toBe(false);
    expect(dele.militares[0]!.equipe).toBe('Alfa'); // vê a situação de quem é da seção dele
    expect((await buscar('gestorGb', { texto: 'ALFA1' })).militares[0]!.podeAlterar).toBe(true);
    expect((await buscar('admin', { texto: 'ALFA1' })).militares[0]!.podeAlterar).toBe(true);
  });

  it('quem não tem lotação: só o administrador pode alterar', async () => {
    expect((await buscar('admin', { texto: 'SEMLOTACAO' })).militares[0]).toMatchObject({ lotacao: null, unidadeId: null, podeAlterar: true });
    expect((await buscar('gestorGb', { texto: 'SEMLOTACAO' })).militares[0]).toMatchObject({ podeAlterar: false });
  });
});
