import { mesPorExtenso, somarMeses, type FaixaDeDisponibilidade, type VoluntariadoDoMes, type VoluntariadoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { blocosDaSecao } from '../src/voluntariado/leitura.ts';
import { equipePadrao, inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): mês de lançamento = o mês seguinte ao atual; Pronto A (08h às 20h) escalado no último dia do mês atual;
// PE Seguro (diária: 00–08, 08–16, 16–00) e CPRH (PJES: 08–20) cortam o dia em 4 blocos: 00–08, 08–16, 16–20 e 20–24.
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
    matricula: `99${String(6000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome,
  });
  militar[nome] = id;
  await inserir(api.banco, 'rastreio', {
    militar_id: id, unidade_id: api.ids.secao, equipe_id: o.equipe ? equipe[o.equipe] : null, jornada: o.jornada ?? 'pronto', desde: o.desde ?? `${atual}-01`, ate: o.ate ?? null, situacao_id: await situacaoDoMilitar(api.banco, o.ativo === false ? 'Desativado' : 'Ativa'),
  });
}
const marcar = (nome: string, data: string, inicio: number, fim: number, origem = 'manual') =>
  inserir(api.banco, 'disponibilidade', { militar_id: militar[nome], data, inicio_min: inicio, fim_min: fim, origem });
const f = (data: string, inicio: string, fim: string): FaixaDeDisponibilidade => ({ data, inicio, fim });

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-VO', nome: 'Soldado VO', ordem: 932 });
  for (const [i, nome] of ['Alfa', 'Bravo', 'Charlie', 'Delta'].entries()) equipe[nome] = await equipePadrao(api.banco, nome);
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  pronto = s.id;
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id;
  // os serviços que pedem voluntariado: eles dão os cortes do dia
  const pe = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'PE Seguro', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#3C5F9C' })).json()) as { id: string };
  for (const [letra, inicio, fim] of [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']] as const) await api.pedir('escalante', 'POST', `/api/servicos/${pe.id}/turnos`, { letra, inicio, fim });
  const cprh = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'CPRH', tipo: 'pjes', operacao: null, rotuloImpressao: null, cor: '#4A5562' })).json()) as { id: string };
  await api.pedir('escalante', 'POST', `/api/servicos/${cprh.id}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' });
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pronto, pe.id, cprh.id] });
  await criarMilitar('ANDRADE', { equipe: 'Alfa' });
  await criarMilitar('BRAVO1', { equipe: 'Bravo' });
  await criarMilitar('CHARLIE1', { equipe: 'Charlie' });
  await criarMilitar('ADM1', { jornada: 'adm' });
  await criarMilitar('SAINDO', { equipe: 'Delta', ate: `${mes}-15` });
  await criarMilitar('FUTURO', { equipe: 'Delta', desde: `${somarMeses(mes, 1)}-01` });
  await criarMilitar('DESATIVADO', { equipe: 'Delta', ativo: false });
  // o BRAVO1 está de serviço (Pronto A) no último dia do mês atual: no dia 1 do mês seguinte a equipe é a CHARLIE
  await inserir(api.banco, 'alocacao', { militar_id: militar.BRAVO1, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: ultimoDia, origem: 'manual' });
  // disponibilidade do ANDRADE: dia 5 das 08h às 24h (duas faixas encostadas), dia 6 das 08h às 20h; no mês atual, dia 20 das 20h às 24h
  await marcar('ANDRADE', `${mes}-05`, 480, 1200);
  await marcar('ANDRADE', `${mes}-05`, 1200, 1440);
  await marcar('ANDRADE', `${mes}-06`, 480, 1200);
  await marcar('ANDRADE', `${atual}-20`, 1200, 1440);
  await inserir(api.banco, 'voluntariado_lancamento', { militar_id: militar.ANDRADE, mes: `${mes}-01` });
});
afterAll(async () => {
  await api.fechar();
});

describe('voluntariado do mês', () => {
  it('a lista traz quem tem lotação na seção em algum dia do mês, em ordem de nome, com lançado, horas e dias', async () => {
    const r = await doMes();
    expect(r.mes).toBe(mes);
    expect(r.militares.map((m) => m.nomeGuerra)).toEqual(['ADM1', 'ANDRADE', 'BRAVO1', 'CHARLIE1', 'SAINDO']);
    const andrade = r.militares.find((m) => m.nomeGuerra === 'ANDRADE')!;
    expect([andrade.lancado, andrade.horas, andrade.dias, andrade.equipe, andrade.jornada]).toEqual([true, 28, 2, 'Alfa', 'pronto']);
    const bravo = r.militares.find((m) => m.nomeGuerra === 'BRAVO1')!;
    expect([bravo.lancado, bravo.horas, bravo.dias]).toEqual([false, 0, 0]);
    expect(r.militares.find((m) => m.nomeGuerra === 'ADM1')).toMatchObject({ equipe: null, jornada: 'adm' });
  });

  it('quem só chega depois do mês e quem está desativado não aparecem; quem sai no meio do mês aparece (Review Focus 4)', async () => {
    const nomes = (await doMes()).militares.map((m) => m.nomeGuerra);
    expect(nomes).toContain('SAINDO');
    expect(nomes).not.toContain('FUTURO');
    expect(nomes).not.toContain('DESATIVADO');
  });

  it('as faixas do militar vêm unidas e em ordem de data, com as do mês anterior à parte e os blocos do dia', async () => {
    const r = await doMilitar('ANDRADE');
    expect(r.faixas).toEqual([f(`${mes}-05`, '08:00', '24:00'), f(`${mes}-06`, '08:00', '20:00')]);
    expect(r.doMesAnterior).toEqual([f(`${atual}-20`, '20:00', '24:00')]);
    expect(r.blocos).toEqual([{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }, { inicio: '20:00', fim: '24:00' }]);
  });

  it('os blocos saem dos serviços ativos que pedem voluntariado: ordinário não corta; serviço desativado também não; sem nenhum, o dia é um bloco só', async () => {
    // um serviço ativo ordinário (Pronto) e um desativado com turno das 06h às 12h não mudam os cortes
    const velho = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Diária antiga', tipo: 'diaria', cor: '#111111', ativo: false });
    await inserir(api.banco, 'turno', { servico_id: velho, letra: 'A', inicio: '06:00', fim: '12:00' });
    expect(await blocosDaSecao(api.banco, api.ids.secao)).toHaveLength(4);
    const vazia = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEC-Z', nome: 'Seção sem serviços', mae_id: api.ids.gb, desde: '2026-11-01' });
    expect(await blocosDaSecao(api.banco, vazia)).toEqual([{ inicio: 0, fim: 1440 }]);
  });

  describe('as escalas que montam os blocos do dia', () => {
    const marcar = (id: string, montaBlocos: boolean) => api.pedir('admin', 'PATCH', `/api/escalas/${id}/blocos-do-voluntariado`, { montaBlocos });
    const blocos = async () => (await doMilitar('ANDRADE')).blocos;
    const QUATRO = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }, { inicio: '20:00', fim: '24:00' }];

    it('uma escala marcada acrescenta os cortes dos serviços dela; desmarcada ou desativada, eles somem e os quatro blocos voltam', async () => {
      const eleicoes = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Eleições', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#8A5A00' })).json()) as { id: string };
      await api.pedir('escalante', 'POST', `/api/servicos/${eleicoes.id}/turnos`, { letra: 'A', inicio: '07:00', fim: '15:00' });
      const nova = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Eleições' })).json()).id as string;
      await api.pedir('escalante', 'PUT', `/api/escalas/${nova}/servicos`, { servicoIds: [eleicoes.id] });
      expect(await blocos()).toEqual([
        { inicio: '00:00', fim: '07:00' }, { inicio: '07:00', fim: '08:00' }, { inicio: '08:00', fim: '15:00' }, { inicio: '15:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }, { inicio: '20:00', fim: '24:00' },
      ]);
      const tirou = await marcar(nova, false);
      expect(tirou.status).toBe(200);
      expect(await blocos()).toEqual(QUATRO);
      await marcar(nova, true);
      expect(await blocos()).toHaveLength(6);
      await api.pedir('escalante', 'POST', `/api/escalas/${nova}/situacao`, { ativa: false });
      expect(await blocos()).toEqual(QUATRO);
      await marcar(nova, false);
    });

    it('um serviço que não está em nenhuma escala não corta o dia', async () => {
      const solto = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Diária solta', tipo: 'diaria', cor: '#222222' });
      await inserir(api.banco, 'turno', { servico_id: solto, letra: 'A', inicio: '06:00', fim: '12:00' });
      expect(await blocos()).toEqual(QUATRO);
    });

    it('com nenhuma escala marcada, o dia é um bloco só e o lançamento continua funcionando (Review Focus 4)', async () => {
      await marcar(escala, false);
      try {
        expect(await blocos()).toEqual([{ inicio: '00:00', fim: '24:00' }]);
        const r = await api.pedir('escalante', 'PUT', `/api/militares/${militar.BRAVO1}/voluntariado/${mes}`, { faixas: [f(`${mes}-05`, '08:00', '16:00')] });
        expect(r.status).toBe(200);
        expect((await doMilitar('BRAVO1')).faixas).toEqual([f(`${mes}-05`, '08:00', '16:00')]);
      } finally {
        await marcar(escala, true);
      }
      expect(await blocos()).toEqual(QUATRO);
    });
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

const lancar = (nome: string, faixas: FaixaDeDisponibilidade[], quem: 'escalante' | 'semPapel' = 'escalante', m = mes) =>
  api.pedir(quem, 'PUT', `/api/militares/${militar[nome]}/voluntariado/${m}`, { faixas });
const daLista = (r: VoluntariadoDoMes, nome: string) => r.militares.find((x) => x.nomeGuerra === nome)!;

describe('lançar o voluntariado do mês', () => {
  it('lançar grava as faixas, devolve a lista do mês, registra quem lançou e une as encostadas numa só (Review Focus 3)', async () => {
    const r = await lancar('BRAVO1', [f(`${mes}-03`, '08:00', '16:00'), f(`${mes}-03`, '16:00', '20:00'), f(`${mes}-04`, '08:00', '20:00')]);
    expect(r.status).toBe(200);
    const lista: VoluntariadoDoMes = await r.json();
    expect([daLista(lista, 'BRAVO1').lancado, daLista(lista, 'BRAVO1').horas, daLista(lista, 'BRAVO1').dias]).toEqual([true, 24, 2]);
    const quem = (await api.banco.query<{ lancado_por: string }>('select lancado_por from voluntariado_lancamento where militar_id = $1', [militar.BRAVO1])).rows;
    expect(quem).toEqual([{ lancado_por: api.usuarios.escalante }]);
    // 08–16 e 16–20 do dia 3 viraram uma faixa só (480–1200)
    const dia3 = (await api.banco.query<{ i: number; f: number; o: string }>("select inicio_min as i, fim_min as f, origem as o from disponibilidade where militar_id = $1 and data = $2::date", [militar.BRAVO1, `${mes}-03`])).rows;
    expect(dia3).toEqual([{ i: 480, f: 1200, o: 'manual' }]);
  });

  it('lançar de novo substitui o mês inteiro, inclusive o que veio de importação; o mês anterior fica (Review Focus 2)', async () => {
    await marcar('BRAVO1', `${mes}-10`, 480, 1200, 'importacao');
    await marcar('BRAVO1', `${atual}-22`, 480, 1200);
    const r = await lancar('BRAVO1', [f(`${mes}-07`, '20:00', '24:00')]);
    expect(r.status).toBe(200);
    const m = await doMilitar('BRAVO1');
    expect(m.faixas).toEqual([f(`${mes}-07`, '20:00', '24:00')]);
    expect(m.doMesAnterior).toEqual([f(`${atual}-22`, '08:00', '20:00')]);
  });

  it('salvar sem nenhuma faixa conta como lançado, com 0 horas (Review Focus 1)', async () => {
    expect(daLista(await doMes(), 'CHARLIE1').lancado).toBe(false);
    const r = await lancar('CHARLIE1', []);
    expect(r.status).toBe(200);
    const c = daLista(await r.json(), 'CHARLIE1');
    expect([c.lancado, c.horas, c.dias]).toEqual([true, 0, 0]);
    // limpar quem já tinha faixas
    const limpo = daLista(await (await lancar('ANDRADE', [])).json(), 'ANDRADE');
    expect([limpo.lancado, limpo.horas, limpo.dias]).toEqual([true, 0, 0]);
  });

  it('faixa de outro mês é 400 com o campo; fim antes do início também; nada é gravado', async () => {
    const fora = await lancar('BRAVO1', [f(`${mes}-03`, '08:00', '16:00'), f(`${somarMeses(mes, 1)}-01`, '08:00', '16:00')]);
    expect(fora.status).toBe(400);
    expect((await fora.json()).campos).toEqual({ 'faixas.1': `Use um dia de ${mesPorExtenso(mes)}.` });
    const invertida = await lancar('BRAVO1', [f(`${mes}-03`, '16:00', '08:00')]);
    expect(invertida.status).toBe(400);
    expect((await invertida.json()).campos).toEqual({ 'faixas.0.fim': 'O fim precisa ser depois do início.' });
    expect((await doMilitar('BRAVO1')).faixas).toEqual([f(`${mes}-07`, '20:00', '24:00')]);
  });

  it('militar que só chega depois do mês não pode ser lançado: 409 com a frase (Review Focus 4)', async () => {
    const r = await lancar('FUTURO', [f(`${mes}-03`, '08:00', '20:00')]);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Este militar não está lotado na seção em ${mesPorExtenso(mes)}.`);
    expect((await api.banco.query('select 1 from disponibilidade where militar_id = $1', [militar.FUTURO])).rows).toHaveLength(0);
  });

  it('quem não é escalante recebe 403 e nada é gravado', async () => {
    expect((await lancar('BRAVO1', [f(`${mes}-08`, '08:00', '20:00')], 'semPapel')).status).toBe(403);
    expect((await doMilitar('BRAVO1')).faixas).toEqual([f(`${mes}-07`, '20:00', '24:00')]);
  });
});

describe('militar com transferência cadastrada (Fase 4.2, revisão final)', () => {
  it('com a transferência no mês seguinte, o escalante da seção atual ainda lê e lança o mês corrente; no mês da transferência a seção é a outra', async () => {
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB-V', nome: 'Seção V', mae_id: api.ids.gb, desde: '2026-11-01' });
    await criarMilitar('TRANSF', { equipe: 'Delta', ate: `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}` });
    await inserir(api.banco, 'rastreio', { militar_id: militar.TRANSF, unidade_id: outra, jornada: 'adm', desde: `${somarMeses(mes, 1)}-01` });
    expect((await api.pedir('escalante', 'GET', `/api/militares/${militar.TRANSF}/voluntariado/${mes}`)).status).toBe(200);
    const lancou = await lancar('TRANSF', [f(`${mes}-05`, '08:00', '20:00')]);
    expect(lancou.status).toBe(200);
    expect(daLista(await lancou.json(), 'TRANSF').horas).toBe(12);
    // a partir do mês seguinte ele é da outra seção: o escalante desta já não mexe
    expect((await api.pedir('escalante', 'GET', `/api/militares/${militar.TRANSF}/voluntariado/${somarMeses(mes, 1)}`)).status).toBe(403);
    expect((await lancar('TRANSF', [], 'escalante', somarMeses(mes, 1))).status).toBe(403);
  });
});

describe('renomear a equipe 1 não muda as folgas do voluntariado (6.64, Review Focus 2)', () => {
  it('com a posição 1 chamada "Equipe 1", as folgas do militar dessa equipe e de outra são as mesmas de antes', async () => {
    const antesAlfa = (await doMilitar('ANDRADE')).folgas;
    const antesCharlie = (await doMilitar('CHARLIE1')).folgas;
    expect(antesAlfa).not.toBeNull();
    await api.banco.query("update equipe set nome = 'Equipe 1' where id = $1", [equipe.Alfa]);
    try {
      expect((await doMilitar('ANDRADE')).folgas).toEqual(antesAlfa);
      expect((await doMilitar('CHARLIE1')).folgas).toEqual(antesCharlie);
    } finally {
      await api.banco.query("update equipe set nome = 'Alfa' where id = $1", [equipe.Alfa]);
    }
  });
});
