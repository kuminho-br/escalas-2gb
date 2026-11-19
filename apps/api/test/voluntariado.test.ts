import { mesPorExtenso, somarMeses, type MarcaDeVoluntariado, type VoluntariadoDoMes, type VoluntariadoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): mês de lançamento = o mês seguinte ao atual; Pronto A (08h às 20h) escalado no último dia do mês atual.
let api: ApiDeTeste;
let posto: string;
let pronto: string;
let turnoA: string;
let escala: string;
const equipe: Record<string, string> = {};
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const secao = () => `/api/unidades/${api.ids.secao}`;
const doMes = async (m = mes): Promise<VoluntariadoDoMes> => (await api.pedir('escalante', 'GET', `${secao()}/voluntariado/${m}`)).json();
const doMilitar = async (nome: string, m = mes): Promise<VoluntariadoDoMilitar> => (await api.pedir('escalante', 'GET', `/api/militares/${militar[nome]}/voluntariado/${m}`)).json();
const diasNoMes = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).getUTCDate();
const ultimoDia = `${atual}-${String(diasNoMes(atual)).padStart(2, '0')}`;

let seq = 0;
async function criarMilitar(nome: string, o: { jornada?: 'pronto' | 'adm'; equipe?: string; desde?: string; ate?: string | null; ativo?: boolean } = {}) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `99${String(6000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, ativo: o.ativo ?? true,
  });
  militar[nome] = id;
  await inserir(api.banco, 'lotacao', {
    militar_id: id, unidade_id: api.ids.secao, equipe_id: o.equipe ? equipe[o.equipe] : null, jornada: o.jornada ?? 'pronto', desde: o.desde ?? `${atual}-01`, ate: o.ate ?? null,
  });
}
const marcar = (nome: string, data: string, turno: 'A' | 'B') => inserir(api.banco, 'voluntariado', { militar_id: militar[nome], data, turno_padrao: turno, origem: 'manual' });

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-VO', nome: 'Soldado VO', ordem: 932 });
  for (const [i, nome] of ['Alfa', 'Bravo', 'Charlie', 'Delta'].entries()) equipe[nome] = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome, ordem_ciclo: i + 1 });
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  pronto = s.id;
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id;
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pronto] });
  await criarMilitar('ANDRADE', { equipe: 'Alfa' });
  await criarMilitar('BRAVO1', { equipe: 'Bravo' });
  await criarMilitar('CHARLIE1', { equipe: 'Charlie' });
  await criarMilitar('ADM1', { jornada: 'adm' });
  await criarMilitar('SAINDO', { equipe: 'Delta', ate: `${mes}-15` });
  await criarMilitar('FUTURO', { equipe: 'Delta', desde: `${somarMeses(mes, 1)}-01` });
  await criarMilitar('DESATIVADO', { equipe: 'Delta', ativo: false });
  // o BRAVO1 está de serviço (Pronto A) no último dia do mês atual: no dia 1 do mês seguinte a equipe é a CHARLIE
  await inserir(api.banco, 'alocacao', { militar_id: militar.BRAVO1, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: ultimoDia, origem: 'manual' });
  // marcações do ANDRADE: 2 turnos no dia 5 e 1 no dia 6 do mês; 1 no mês atual
  await marcar('ANDRADE', `${mes}-05`, 'A');
  await marcar('ANDRADE', `${mes}-05`, 'B');
  await marcar('ANDRADE', `${mes}-06`, 'A');
  await marcar('ANDRADE', `${atual}-20`, 'B');
  await inserir(api.banco, 'voluntariado_lancamento', { militar_id: militar.ANDRADE, mes: `${mes}-01` });
});
afterAll(async () => {
  await api.fechar();
});

describe('voluntariado do mês', () => {
  it('a lista traz quem tem lotação na seção em algum dia do mês, em ordem de nome, com lançado, turnos e dias', async () => {
    const r = await doMes();
    expect(r.mes).toBe(mes);
    expect(r.militares.map((m) => m.nomeGuerra)).toEqual(['ADM1', 'ANDRADE', 'BRAVO1', 'CHARLIE1', 'SAINDO']);
    const andrade = r.militares.find((m) => m.nomeGuerra === 'ANDRADE')!;
    expect([andrade.lancado, andrade.turnos, andrade.dias, andrade.equipe, andrade.jornada]).toEqual([true, 3, 2, 'Alfa', 'pronto']);
    const bravo = r.militares.find((m) => m.nomeGuerra === 'BRAVO1')!;
    expect([bravo.lancado, bravo.turnos, bravo.dias]).toEqual([false, 0, 0]);
    expect(r.militares.find((m) => m.nomeGuerra === 'ADM1')).toMatchObject({ equipe: null, jornada: 'adm' });
  });

  it('quem só chega depois do mês e quem está desativado não aparecem; quem sai no meio do mês aparece (Review Focus 4)', async () => {
    const nomes = (await doMes()).militares.map((m) => m.nomeGuerra);
    expect(nomes).toContain('SAINDO');
    expect(nomes).not.toContain('FUTURO');
    expect(nomes).not.toContain('DESATIVADO');
  });

  it('as marcações do militar vêm em ordem de data e turno, com as do mês anterior à parte', async () => {
    const r = await doMilitar('ANDRADE');
    expect(r.marcas).toEqual([{ data: `${mes}-05`, turno: 'A' }, { data: `${mes}-05`, turno: 'B' }, { data: `${mes}-06`, turno: 'A' }]);
    expect(r.doMesAnterior).toEqual([{ data: `${atual}-20`, turno: 'B' }]);
  });

  it('as folgas vêm do ciclo: com o BRAVO de serviço no último dia, o dia 1 é da CHARLIE e a folga dela é o resto', async () => {
    const r = await doMilitar('CHARLIE1');
    const total = diasNoMes(mes);
    expect(r.folgas).not.toBeNull();
    expect(r.folgas).not.toContain(`${mes}-01`);
    expect(r.folgas).not.toContain(`${mes}-05`);
    expect(r.folgas).toContain(`${mes}-02`);
    expect(r.folgas!.length).toBe(total - (Math.floor((total - 1) / 4) + 1));
    // outra equipe tem folga nos dias da CHARLIE
    const alfa = await doMilitar('ANDRADE');
    expect(alfa.folgas).toContain(`${mes}-01`);
  });

  it('sem folgas para o Adm, nem quando o mês anterior não tem Pronto', async () => {
    expect((await doMilitar('ADM1')).folgas).toBeNull();
    expect((await doMilitar('CHARLIE1', somarMeses(atual, 3))).folgas).toBeNull();
  });

  it('mês inválido é 400 e quem não é escalante recebe 403 nas duas rotas', async () => {
    const ruim = await api.pedir('escalante', 'GET', `${secao()}/voluntariado/2026-13`);
    expect(ruim.status).toBe(400);
    expect((await ruim.json()).erro).toBe('Mês inválido: use o formato aaaa-mm.');
    expect((await api.pedir('semPapel', 'GET', `${secao()}/voluntariado/${mes}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `/api/militares/${militar.ANDRADE}/voluntariado/${mes}`)).status).toBe(403);
  });
});

const lancar = (nome: string, marcas: MarcaDeVoluntariado[], quem: 'escalante' | 'semPapel' = 'escalante', m = mes) =>
  api.pedir(quem, 'PUT', `/api/militares/${militar[nome]}/voluntariado/${m}`, { marcas });
const daLista = (r: VoluntariadoDoMes, nome: string) => r.militares.find((x) => x.nomeGuerra === nome)!;

describe('lançar o voluntariado do mês', () => {
  it('lançar grava as marcações, devolve a lista do mês e registra quem lançou', async () => {
    const r = await lancar('BRAVO1', [{ data: `${mes}-03`, turno: 'A' }, { data: `${mes}-03`, turno: 'B' }, { data: `${mes}-04`, turno: 'A' }]);
    expect(r.status).toBe(200);
    const lista: VoluntariadoDoMes = await r.json();
    expect([daLista(lista, 'BRAVO1').lancado, daLista(lista, 'BRAVO1').turnos, daLista(lista, 'BRAVO1').dias]).toEqual([true, 3, 2]);
    const quem = (await api.banco.query<{ lancado_por: string }>('select lancado_por from voluntariado_lancamento where militar_id = $1', [militar.BRAVO1])).rows;
    expect(quem).toEqual([{ lancado_por: api.usuarios.escalante }]);
    expect((await api.banco.query("select origem from voluntariado where militar_id = $1 and data >= $2::date", [militar.BRAVO1, `${mes}-01`])).rows.every((x) => x.origem === 'manual')).toBe(true);
  });

  it('lançar de novo substitui o mês inteiro, inclusive o que veio de importação; o mês anterior fica (Review Focus 2)', async () => {
    await inserir(api.banco, 'voluntariado', { militar_id: militar.BRAVO1, data: `${mes}-10`, turno_padrao: 'A', origem: 'importacao' });
    await inserir(api.banco, 'voluntariado', { militar_id: militar.BRAVO1, data: `${atual}-22`, turno_padrao: 'A', origem: 'manual' });
    const r = await lancar('BRAVO1', [{ data: `${mes}-07`, turno: 'B' }]);
    expect(r.status).toBe(200);
    const m = await doMilitar('BRAVO1');
    expect(m.marcas).toEqual([{ data: `${mes}-07`, turno: 'B' }]);
    expect(m.doMesAnterior).toEqual([{ data: `${atual}-22`, turno: 'A' }]);
  });

  it('salvar sem nenhuma marcação conta como lançado, com 0 dias (Review Focus 1)', async () => {
    expect(daLista(await doMes(), 'CHARLIE1').lancado).toBe(false);
    const r = await lancar('CHARLIE1', []);
    expect(r.status).toBe(200);
    const c = daLista(await r.json(), 'CHARLIE1');
    expect([c.lancado, c.turnos, c.dias]).toEqual([true, 0, 0]);
    // limpar quem já tinha marcações
    const limpo = daLista(await (await lancar('ANDRADE', [])).json(), 'ANDRADE');
    expect([limpo.lancado, limpo.turnos, limpo.dias]).toEqual([true, 0, 0]);
  });

  it('marcação de outro mês é 400 com o campo; marcação repetida também', async () => {
    const fora = await lancar('BRAVO1', [{ data: `${mes}-03`, turno: 'A' }, { data: `${somarMeses(mes, 1)}-01`, turno: 'A' }]);
    expect(fora.status).toBe(400);
    expect((await fora.json()).campos).toEqual({ 'marcas.1': `Use um dia de ${mesPorExtenso(mes)}.` });
    const repetida = await lancar('BRAVO1', [{ data: `${mes}-03`, turno: 'A' }, { data: `${mes}-03`, turno: 'A' }]);
    expect(repetida.status).toBe(400);
    expect((await repetida.json()).campos.marcas).toBe('Esta marcação aparece duas vezes.');
    // nada foi gravado pelos pedidos recusados
    expect((await doMilitar('BRAVO1')).marcas).toEqual([{ data: `${mes}-07`, turno: 'B' }]);
  });

  it('militar que só chega depois do mês não pode ser lançado: 409 com a frase (Review Focus 4)', async () => {
    const r = await lancar('FUTURO', [{ data: `${mes}-03`, turno: 'A' }]);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Este militar não está lotado na seção em ${mesPorExtenso(mes)}.`);
    expect((await api.banco.query('select 1 from voluntariado where militar_id = $1', [militar.FUTURO])).rows).toHaveLength(0);
  });

  it('quem não é escalante recebe 403 e nada é gravado', async () => {
    expect((await lancar('BRAVO1', [{ data: `${mes}-08`, turno: 'A' }], 'semPapel')).status).toBe(403);
    expect((await doMilitar('BRAVO1')).marcas).toEqual([{ data: `${mes}-07`, turno: 'B' }]);
  });
});

describe('militar com transferência cadastrada (Fase 4.2, revisão final)', () => {
  it('com a transferência no mês seguinte, o escalante da seção atual ainda lê e lança o mês corrente; no mês da transferência a seção é a outra', async () => {
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB-V', nome: 'Seção V', mae_id: api.ids.gb, desde: '2026-11-01' });
    await criarMilitar('TRANSF', { equipe: 'Delta', ate: `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}` });
    await inserir(api.banco, 'lotacao', { militar_id: militar.TRANSF, unidade_id: outra, jornada: 'adm', desde: `${somarMeses(mes, 1)}-01` });
    expect((await api.pedir('escalante', 'GET', `/api/militares/${militar.TRANSF}/voluntariado/${mes}`)).status).toBe(200);
    const lancou = await lancar('TRANSF', [{ data: `${mes}-05`, turno: 'A' }]);
    expect(lancou.status).toBe(200);
    expect(daLista(await lancou.json(), 'TRANSF').turnos).toBe(1);
    // a partir do mês seguinte ele é da outra seção: o escalante desta já não mexe
    expect((await api.pedir('escalante', 'GET', `/api/militares/${militar.TRANSF}/voluntariado/${somarMeses(mes, 1)}`)).status).toBe(403);
    expect((await lancar('TRANSF', [], 'escalante', somarMeses(mes, 1))).status).toBe(403);
  });
});
