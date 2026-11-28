import type { LinhaMilitar, ListaDoPeculio } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.48 (defeito do piloto): com a 1ª SB escolhida, a lista de Militares trazia quem hoje está numa unidade de cima. A importação lotou todos na
// seção em 01/11 e a relotação veio depois: o período antigo, que toca o mês, punha o militar na lista. A lista mostra só quem está na unidade (ou numa
// de baixo) no dia de referência, e quem chega nela depois desse dia, ainda no mês. Dados fictícios (D7): 9906xx-x.
// O dia de referência de um mês passado é o último dia dele; o de um mês futuro, o primeiro: assim o teste não depende do dia em que roda.
const PASSADO = '2026-03'; // referência: 31/03/2026
const FUTURO = '2031-05'; // referência: 01/05/2031
let api: ApiDeTeste;
let irma = '';
let seq = 0;

/** Um militar com os períodos dados (unidade, desde, até). */
async function militar(nome: string, periodos: [string, string, string | null][]) {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `9906${String(seq).padStart(2, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome });
  for (const [unidade, desde, ate] of periodos) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidade, jornada: 'pronto', desde, ate });
  return id;
}
const lista = async (unidade: string, mes: string): Promise<LinhaMilitar[]> => (await api.pedir('admin', 'GET', `/api/unidades/${unidade}/militares?mes=${mes}`)).json();
const peculio = async (unidade: string, mes: string): Promise<ListaDoPeculio> => (await api.pedir('admin', 'GET', `/api/unidades/${unidade}/peculio?mes=${mes}`)).json();
const nomes = (linhas: { nomeGuerra: string }[]) => linhas.map((m) => m.nomeGuerra).filter((n) => n.startsWith('T48')).sort();

beforeAll(async () => {
  api = await montarApi();
  irma = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  const { secao, gb } = api.ids;
  // março de 2026 (referência 31/03)
  await militar('T48FICA', [[secao, '2026-01-01', null]]);
  await militar('T48SUBIU', [[secao, '2026-03-01', '2026-03-19'], [gb, '2026-03-20', null]]);
  await militar('T48IRMA', [[secao, '2026-03-01', '2026-03-19'], [irma, '2026-03-20', null]]);
  await militar('T48SAIU', [[secao, '2026-01-01', '2026-03-19']]);
  // maio de 2031 (referência 01/05): chega à seção no dia 20, vindo do grupamento
  await militar('T48CHEGA', [[gb, '2031-01-01', '2031-05-19'], [secao, '2031-05-20', null]]);
  // externo: lotado na seção irmã, trazido para a escala da 1ª SB
  const externo = await militar('T48EXTERNO', [[irma, '2026-01-01', null]]);
  await inserir(api.banco, 'vinculo_externo', { militar_id: externo, unidade_id: secao, desde: '2026-03-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('a lista de Militares mostra quem está na unidade no dia de referência (6.48)', () => {
  it('Review Focus 1 e 4: quem subiu para a unidade de cima no meio do mês some da lista da seção e aparece na de cima (mês passado: vale o último dia)', async () => {
    const daSecao = nomes(await lista(api.ids.secao, PASSADO));
    expect(daSecao).not.toContain('T48SUBIU');
    expect(daSecao).toContain('T48FICA');
    const doGb = nomes(await lista(api.ids.gb, PASSADO));
    expect(doGb).toEqual(expect.arrayContaining(['T48SUBIU', 'T48FICA']));
  });

  it('Review Focus 2: quem foi para uma seção irmã some da lista daqui e aparece na de lá', async () => {
    expect(nomes(await lista(api.ids.secao, PASSADO))).not.toContain('T48IRMA');
    expect(nomes(await lista(irma, PASSADO))).toContain('T48IRMA');
  });

  it('quem saiu e não tem período no dia de referência não aparece', async () => {
    expect(nomes(await lista(api.ids.secao, PASSADO))).not.toContain('T48SAIU');
    expect(nomes(await lista(api.ids.gb, PASSADO))).not.toContain('T48SAIU');
  });

  it('Review Focus 3: quem chega depois do dia de referência, ainda no mês, aparece com "Lotação a partir de"', async () => {
    const daSecao = await lista(api.ids.secao, FUTURO);
    const chega = daSecao.find((m) => m.nomeGuerra === 'T48CHEGA');
    expect(chega).toMatchObject({ lotacaoAPartirDe: '2031-05-20' });
    // no grupamento ele está no dia de referência (no próprio grupamento), sem a marca de chegada
    const noGb = (await lista(api.ids.gb, FUTURO)).find((m) => m.nomeGuerra === 'T48CHEGA');
    expect(noGb).toBeDefined();
    expect(noGb!.lotacaoAPartirDe ?? null).toBeNull();
  });

  it('Review Focus 5: o externo continua aparecendo pela regra dele, uma vez só', async () => {
    const externos = (await lista(api.ids.secao, PASSADO)).filter((m) => m.nomeGuerra === 'T48EXTERNO');
    expect(externos).toHaveLength(1);
    expect(externos[0]).toMatchObject({ equipe: 'Externa', externo: { lotacaoSigla: '2ª SB' } });
  });

  it('a lista inteira da seção em março: só quem está lá no último dia, e o externo', async () => {
    expect(nomes(await lista(api.ids.secao, PASSADO))).toEqual(['T48EXTERNO', 'T48FICA']);
  });
});

describe('a antiguidade repetida da ficha segue a mesma regra (6.48)', () => {
  it('o colega de mesma antiguidade que já saiu da unidade não é mais acusado na ficha; o que continua, é', async () => {
    const { secao, gb } = api.ids;
    const a = await militar('ANTIG48A', [[secao, '2026-01-01', null]]);
    const saiu = await militar('ANTIG48B', [[secao, '2026-03-01', '2026-03-19'], [gb, '2026-03-20', null]]);
    const ficou = await militar('ANTIG48C', [[secao, '2026-01-01', null]]);
    await api.banco.query('update militar set antiguidade = 9648 where id = any($1::uuid[])', [[a, saiu, ficou]]);
    const ficha = await (await api.pedir('admin', 'GET', `/api/militares/${a}?mes=${PASSADO}`)).json();
    expect(ficha.antiguidadeRepetidaCom).toEqual(['ANTIG48C']);
  });
});

describe('a lista do Pecúlio segue a mesma regra (6.48)', () => {
  it('quem subiu, foi para a irmã ou saiu não aparece no Pecúlio da seção; quem subiu aparece no do grupamento, com a lotação de lá', async () => {
    expect(nomes((await peculio(api.ids.secao, PASSADO)).militares)).toEqual(['T48FICA']);
    const doGb = (await peculio(api.ids.gb, PASSADO)).militares;
    expect(nomes(doGb)).toEqual(['T48EXTERNO', 'T48FICA', 'T48IRMA', 'T48SUBIU']);
    expect(doGb.find((m) => m.nomeGuerra === 'T48SUBIU')!.lotacao).toBe('2º GB');
    expect(doGb.find((m) => m.nomeGuerra === 'T48IRMA')!.lotacao).toBe('2ª SB');
  });

  it('quem chega depois do dia de referência, no mesmo mês, aparece no Pecúlio da seção com a data da chegada', async () => {
    expect((await peculio(api.ids.secao, FUTURO)).militares.find((m) => m.nomeGuerra === 'T48CHEGA')).toMatchObject({ lotacaoAPartirDe: '2031-05-20' });
  });
});
