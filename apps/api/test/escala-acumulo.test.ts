import type { Candidatos, EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): faixa 08h às 20h com a ABT (Chefe 1–1, Motorista 1–1 CNH D, Combatente 1–2) e a guarnição de uma função só "Graduado de dia" (Graduado 1–1).
let api: ApiDeTeste;
let escalaId: string;
let outraEscalaId: string;
let abt: string;
let grad: string;
let chefe: string;
let motorista: string;
let combatente: string;
let graduado: string;
let pronto: string;
let turnoA: string;
let posto: string;
let equipe: string;
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const dia = (n: number) => `${atual}-${String(n).padStart(2, '0')}`;
const FAIXA = { inicio: '08:00', fim: '20:00' };
const secao = () => `/api/unidades/${api.ids.secao}`;
const VAGAS = () => ({ chefe: { guarnicaoId: abt, funcaoId: chefe }, motorista: { guarnicaoId: abt, funcaoId: motorista }, combatente: { guarnicaoId: abt, funcaoId: combatente }, graduado: { guarnicaoId: grad, funcaoId: graduado } });

const escalar = (nome: string, data: string, vaga: { guarnicaoId: string | null; funcaoId: string | null }) =>
  api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId: militar[nome], data, turnoId: turnoA, ...vaga });
const alocacaoDe = async (nome: string, data: string) =>
  (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date and escala_id = $3', [militar[nome], data, escalaId])).rows[0]!.id;
const acumular = async (nome: string, data: string, vaga: { guarnicaoId: string; funcaoId: string }, quem: 'escalante' | 'semPapel' = 'escalante') =>
  api.pedir(quem, 'POST', `/api/alocacoes/${await alocacaoDe(nome, data)}/acumulos`, vaga);
const mesCompleto = async (): Promise<EscalaDoMes> => (await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}`)).json();
const faixa = (e: EscalaDoMes, d: number) => e.dias[d - 1]!.faixas.find((f) => f.inicio === FAIXA.inicio)!;
const ocupantes = (e: EscalaDoMes, d: number, guarnicao: string, funcao: string) =>
  faixa(e, d).guarnicoes.find((g) => g.nome === guarnicao)!.funcoes.find((f) => f.funcao === funcao)!.ocupantes;
const candidatos = async (d: number, vaga: { guarnicaoId: string; funcaoId: string }): Promise<Candidatos> =>
  (
    await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${dia(d)}&inicio=${FAIXA.inicio}&fim=${FAIXA.fim}&guarnicaoId=${vaga.guarnicaoId}&funcaoId=${vaga.funcaoId}`)
  ).json();

let seq = 0;
async function criarMilitar(nome: string, cnh: string[] = [], foraDoQuadro = false) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `99${String(5000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, motorista: !foraDoQuadro && cnh.length > 0, cnh,
  });
  militar[nome] = id;
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${atual}-01` });
}

beforeAll(async () => {
  api = await montarApi();
  chefe = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Chefe' });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  graduado = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Graduado' });
  equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-AC', nome: 'Soldado AC', ordem: 931 });
  const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  pronto = s.id;
  turnoA = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'A', ...FAIXA })).json()).turnos[0].id;
  const guarnicao = async (nome: string, prioridade: number, composicao: unknown[]) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade, ativa: true, composicao } })).json()).id as string;
  abt = await guarnicao('ABT', 1, [
    { funcaoId: chefe, minimo: 1, maximo: 1, cnhExigida: null },
    { funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' },
    { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null },
  ]);
  grad = await guarnicao('Graduado de dia', 2, [{ funcaoId: graduado, minimo: 1, maximo: 1, cnhExigida: null }]);
  const escala = async (nome: string) => (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome })).json()).id as string;
  escalaId = await escala('Ordinário');
  outraEscalaId = await escala('Outra');
  for (const id of [escalaId, outraEscalaId]) {
    await api.pedir('escalante', 'PUT', `/api/escalas/${id}/servicos`, { servicoIds: [pronto] });
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${id}/vinculos/${atual}`, { itens: [{ guarnicaoId: abt, ...FAIXA }, { guarnicaoId: grad, ...FAIXA }] })).status).toBe(200);
  }
  for (const nome of ['CHEFE', 'OUTRO', 'COMB', 'SEMPOSTO', 'NAOUTRA', 'ESCALADOR']) await criarMilitar(nome, nome === 'SEMPOSTO' || nome === 'NAOUTRA' ? ['D'] : []);
  await criarMilitar('MOTE', ['E']);
  await criarMilitar('MOTB', ['B']);
});
afterAll(async () => {
  await api.fechar();
});

describe('acumular funções', () => {
  it('o chefe da ABT acumula o graduado de dia: o mesmo militar aparece nas duas vagas, marcado, e a vaga conta como preenchida', async () => {
    expect((await escalar('CHEFE', dia(10), VAGAS().chefe)).status).toBe(201);
    const antes = (await mesCompleto()).resumo;
    const r = await acumular('CHEFE', dia(10), VAGAS().graduado);
    expect(r.status).toBe(201);
    const e: EscalaDoMes = await r.json();
    const noGraduado = ocupantes(e, 10, 'Graduado de dia', 'Graduado');
    expect(noGraduado.map((o) => [o.nomeGuerra, o.acumulaCom, o.acumuloId !== null])).toEqual([['CHEFE', ['Chefe ABT'], true]]);
    const noChefe = ocupantes(e, 10, 'ABT', 'Chefe');
    expect(noChefe.map((o) => [o.nomeGuerra, o.acumulaCom, o.acumuloId])).toEqual([['CHEFE', ['Graduado de dia'], null]]);
    expect(e.resumo.preenchidas).toBe(antes.preenchidas + 1);
    expect(e.resumo.obrigatoriasVazias).toBe(antes.obrigatoriasVazias - 1);
    // é um turno só: uma alocação e um acúmulo
    expect((await api.banco.query('select 1 from alocacao where militar_id = $1', [militar.CHEFE])).rows).toHaveLength(1);
    expect((await api.banco.query('select 1 from alocacao_acumulo')).rows.length).toBeGreaterThanOrEqual(1);
  });

  it('quem pode acumular: só escalado na faixa desta escala, com vaga de guarnição, que cumpre a CNH e ainda não ocupa essa função na guarnição', async () => {
    const dd = dia(11);
    await escalar('MOTE', dd, VAGAS().combatente);
    await escalar('MOTB', dd, VAGAS().combatente);
    await escalar('SEMPOSTO', dd, { guarnicaoId: null, funcaoId: null });
    // NAOUTRA está escalado, no mesmo horário, na outra escala
    await api.banco.query(
      "insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, guarnicao_id, funcao_id, origem) values ($1, $2, $3, $4, $5::date, $6, $7, 'manual')",
      [militar.NAOUTRA, outraEscalaId, pronto, turnoA, dd, abt, combatente],
    );
    const c = await candidatos(11, VAGAS().motorista);
    expect(c.acumular.map((x) => [x.nomeGuerra, x.vaga])).toEqual([['MOTE', 'Combatente ABT']]);
    // MOTB (CNH B) fica de fora por CNH; quem está na outra escala segue como "já escalado"; quem está no turno sem posto (6.40) é candidato a ser movido para a vaga (aqui sem a CNH D, fica de fora por ela); quem aparece em "acumular" não conta como de fora
    const fora = Object.fromEntries(c.fora.map((f) => [f.motivo, f.quantidade]));
    expect(fora['Já escalado neste horário']).toBe(1);
    expect(fora['Sem a CNH exigida']).toBeGreaterThanOrEqual(1);
    // quem já é Combatente da ABT não pode acumular Combatente da ABT
    const mesmaFuncao = await candidatos(11, VAGAS().combatente);
    expect(mesmaFuncao.acumular.map((x) => x.nomeGuerra)).not.toContain('MOTE');
    // sem vaga na consulta, não há acúmulo a sugerir
    const semVaga: Candidatos = await (await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}/candidatos?data=${dd}&inicio=${FAIXA.inicio}&fim=${FAIXA.fim}`)).json();
    expect(semVaga.acumular).toEqual([]);
  });

  it('recusas com o motivo: mesma função na mesma guarnição, alocação sem posto, CNH', async () => {
    const dd = dia(12);
    await escalar('COMB', dd, VAGAS().combatente);
    await escalar('SEMPOSTO', dd, { guarnicaoId: null, funcaoId: null });
    const mesma = await acumular('COMB', dd, VAGAS().combatente);
    expect(mesma.status).toBe(409);
    expect((await mesma.json()).erro).toBe('Este militar já ocupa uma vaga de Combatente nesta guarnição.');
    const semPosto = await acumular('SEMPOSTO', dd, VAGAS().graduado);
    expect(semPosto.status).toBe(409);
    expect((await semPosto.json()).erro).toBe('Escolha uma vaga de guarnição para este militar antes de acumular.');
    const semCnh = await acumular('COMB', dd, VAGAS().motorista);
    expect(semCnh.status).toBe(409);
    expect((await semCnh.json()).erro).toBe('Sem a CNH exigida');
    expect((await api.banco.query('select 1 from alocacao_acumulo a join alocacao l on l.id = a.alocacao_id where l.data = $1::date', [dd])).rows).toHaveLength(0);
  });

  it('o acúmulo conta no máximo da função: escalar ou acumular numa função cheia por causa dele é 409, nunca passa do máximo', async () => {
    await escalar('CHEFE', dia(13), VAGAS().chefe);
    expect((await acumular('CHEFE', dia(13), VAGAS().graduado)).status).toBe(201);
    const cheia = await escalar('OUTRO', dia(13), VAGAS().graduado);
    expect(cheia.status).toBe(409);
    expect((await cheia.json()).erro).toBe('A função Graduado já está completa nesta guarnição.');
    // no sentido contrário: o graduado já tem dono (alocação original) e o acúmulo não cabe
    await escalar('OUTRO', dia(14), VAGAS().graduado);
    await escalar('CHEFE', dia(14), VAGAS().chefe);
    const cabe = await acumular('CHEFE', dia(14), VAGAS().graduado);
    expect(cabe.status).toBe(409);
    expect((await cabe.json()).erro).toBe('A função Graduado já está completa nesta guarnição.');
  });

  it('tirar o acúmulo tira só a vaga acumulada e não cria remoção; remover a original leva os acúmulos e guarda uma remoção só', async () => {
    const dd = dia(15);
    await escalar('CHEFE', dd, VAGAS().chefe);
    const e1: EscalaDoMes = await (await acumular('CHEFE', dd, VAGAS().graduado)).json();
    const acumuloId = ocupantes(e1, 15, 'Graduado de dia', 'Graduado')[0]!.acumuloId!;
    const tirou = await api.pedir('escalante', 'DELETE', `/api/acumulos/${acumuloId}`);
    expect(tirou.status).toBe(200);
    const e2: EscalaDoMes = await tirou.json();
    expect(ocupantes(e2, 15, 'Graduado de dia', 'Graduado')).toEqual([]);
    expect(ocupantes(e2, 15, 'ABT', 'Chefe').map((o) => [o.nomeGuerra, o.acumulaCom])).toEqual([['CHEFE', []]]);
    expect(faixa(e2, 15).removidos).toEqual([]);
    // acumula de novo e remove a original
    await acumular('CHEFE', dd, VAGAS().graduado);
    const original = await alocacaoDe('CHEFE', dd);
    const removeu: EscalaDoMes = await (await api.pedir('escalante', 'DELETE', `/api/alocacoes/${original}`)).json();
    expect(ocupantes(removeu, 15, 'ABT', 'Chefe')).toEqual([]);
    expect(ocupantes(removeu, 15, 'Graduado de dia', 'Graduado')).toEqual([]);
    expect(faixa(removeu, 15).removidos.map((r) => r.nomeGuerra)).toEqual(['CHEFE']);
  });

  it('uma alocação sem a vaga no card não esconde o acúmulo nem é escondida por ele', async () => {
    const dd = dia(16);
    await escalar('ESCALADOR', dd, { guarnicaoId: null, funcaoId: null });
    const e = await mesCompleto();
    expect(faixa(e, 16).semPosto.map((o) => o.nomeGuerra)).toEqual(['ESCALADOR']);
  });

  it('guarnição que saiu da faixa no mês: a original vai para "Sem guarnição" e não acumula; o acúmulo de uma guarnição que saiu some sem esconder a original', async () => {
    const vinculos = (...guarnicoes: string[]) =>
      api.pedir('escalante', 'PUT', `/api/escalas/${escalaId}/vinculos/${atual}`, { itens: guarnicoes.map((guarnicaoId) => ({ guarnicaoId, ...FAIXA })) });
    await escalar('CHEFE', dia(18), VAGAS().chefe);
    expect((await acumular('CHEFE', dia(18), VAGAS().graduado)).status).toBe(201);
    await escalar('COMB', dia(19), VAGAS().combatente);
    try {
      // a ABT sai da faixa neste mês: os chefes e combatentes dela passam a "Sem guarnição"
      expect((await vinculos(grad)).status).toBe(200);
      const e = await mesCompleto();
      expect(faixa(e, 18).semPosto.map((o) => o.nomeGuerra)).toEqual(['CHEFE']);
      expect(ocupantes(e, 18, 'Graduado de dia', 'Graduado').map((o) => [o.nomeGuerra, o.acumuloId !== null])).toEqual([['CHEFE', true]]);
      // quem está sem vaga de guarnição não é oferecido para acumular nem aceito
      expect((await candidatos(19, VAGAS().graduado)).acumular).toEqual([]);
      const recusa = await acumular('COMB', dia(19), VAGAS().graduado);
      expect(recusa.status).toBe(409);
      expect((await recusa.json()).erro).toBe('Escolha uma vaga de guarnição para este militar antes de acumular.');
      // o contrário: o "Graduado de dia" sai da faixa; o acúmulo some da tela e a original continua na ABT
      expect((await vinculos(abt)).status).toBe(200);
      const depois = await mesCompleto();
      expect(ocupantes(depois, 18, 'ABT', 'Chefe').map((o) => [o.nomeGuerra, o.acumulaCom])).toEqual([['CHEFE', []]]);
      expect(faixa(depois, 18).guarnicoes.find((g) => g.nome === 'Graduado de dia')).toBeUndefined();
      expect(faixa(depois, 18).semPosto).toEqual([]);
    } finally {
      expect((await vinculos(abt, grad)).status).toBe(200);
    }
  });

  it('acesso: quem não é escalante recebe 403 nas duas rotas e o acúmulo que não existe dá 404', async () => {
    await escalar('CHEFE', dia(17), VAGAS().chefe);
    const r = await acumular('CHEFE', dia(17), VAGAS().graduado, 'semPapel');
    expect(r.status).toBe(403);
    const feito: EscalaDoMes = await (await acumular('CHEFE', dia(17), VAGAS().graduado)).json();
    const acumuloId = ocupantes(feito, 17, 'Graduado de dia', 'Graduado')[0]!.acumuloId!;
    expect((await api.pedir('semPapel', 'DELETE', `/api/acumulos/${acumuloId}`)).status).toBe(403);
    expect((await api.pedir('escalante', 'DELETE', '/api/acumulos/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});

describe('militar fora do quadro de motoristas, com CNH D (Review Focus 2)', () => {
  it('não aparece para acumular a vaga de motorista e a recusa é 409 com "Fora do quadro de motoristas"', async () => {
    await criarMilitar('FORAQUADRO', ['D'], true);
    const dd = dia(27);
    await escalar('FORAQUADRO', dd, VAGAS().combatente);
    const c = await candidatos(27, VAGAS().motorista);
    expect(c.acumular.map((x) => x.nomeGuerra)).not.toContain('FORAQUADRO');
    const r = await acumular('FORAQUADRO', dd, VAGAS().motorista);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Fora do quadro de motoristas');
  });
});
