import type { PainelDoDia } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Consulta } from '../src/banco/banco.ts';
import { montarPainelDoDia } from '../src/grade/dia.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7), dezembro de 2026 (dia 10 = quinta). Escala Ordinário: Pronto (A 08–20, B 20–08), JES (PJES, 08–20) e Saldo (08–20),
// e a diária Bioma (08–16, sem guarnição), com a guarnição ABT (Motorista CNH D, 1 vaga; Combatente, 1 a 2 vagas) vinculada às faixas 08–20 e 20–08.
let api: ApiDeTeste;
let outraSecao: string;
let escala: string;
let abt: string;
let motorista: string;
let combatente: string;
const servico: Record<string, { id: string; a: string; b?: string }> = {};
const militar: Record<string, string> = {};
const MES = '2026-12';
const DIA = `${MES}-10`;
const secao = () => `/api/unidades/${api.ids.secao}`;

const painel = async (nome: string, data = DIA, quem: 'escalante' | 'semPapel' = 'escalante', unidade = api.ids.secao, id = militar[nome]) =>
  api.pedir(quem, 'GET', `/api/unidades/${unidade}/grade/${data.slice(0, 7)}/militares/${id}/dias/${data}`);
const ler = async (nome: string, data = DIA): Promise<PainelDoDia> => {
  const r = await painel(nome, data);
  expect(r.status).toBe(200);
  return r.json();
};
const opcoes = (p: PainelDoDia, faixa: string) =>
  p.opcoes.filter((o) => `${o.inicio}-${o.fim}` === faixa).map((o) => [o.guarnicao ? `${o.funcao} ${o.guarnicao}` : 'Sem guarnição', o.servicos.map((s) => s.nome)]);
const servicoComTurnos = async (nome: string, tipo: string, turnos: [string, string, string][]) => {
  const id = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, cor: '#2F8F5B' });
  const ids: Record<string, string> = {};
  for (const [letra, inicio, fim] of turnos) ids[letra.toLowerCase()] = await inserir(api.banco, 'turno', { servico_id: id, letra, inicio, fim });
  servico[nome] = { id, a: ids.a!, b: ids.b };
};
const alocar = (nome: string, servicoNome: string, letra: 'a' | 'b', data: string, vaga?: { guarnicao: string; funcao: string }) =>
  inserir(api.banco, 'alocacao', {
    militar_id: militar[nome], escala_id: escala, servico_id: servico[servicoNome]!.id, turno_id: servico[servicoNome]![letra]!, data,
    guarnicao_id: vaga?.guarnicao ?? null, funcao_id: vaga?.funcao ?? null, origem: 'manual',
  });
const faixa = (nome: string, data: string, inicio: number, fim: number) =>
  inserir(api.banco, 'disponibilidade', { militar_id: militar[nome], data, inicio_min: inicio, fim_min: fim, origem: 'manual' });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  await servicoComTurnos('Pronto', 'ordinario', [['A', '08:00', '20:00'], ['B', '20:00', '08:00']]);
  await servicoComTurnos('JES', 'pjes', [['A', '08:00', '20:00']]);
  await servicoComTurnos('Saldo', 'ordinario', [['A', '08:00', '20:00']]);
  await servicoComTurnos('Bioma', 'diaria', [['A', '08:00', '16:00']]);
  const g = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
    nome: 'ABT', vigencia: MES,
    versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }] },
  });
  abt = (await g.json()).id;
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id as string;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [servico.Pronto!.id, servico.JES!.id, servico.Saldo!.id, servico.Bioma!.id] })).status).toBe(200);
  const v = await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/vinculos/${MES}`, {
    itens: [{ guarnicaoId: abt, inicio: '08:00', fim: '20:00' }, { guarnicaoId: abt, inicio: '20:00', fim: '08:00' }],
  });
  expect(v.status).toBe(200);
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  let seq = 0;
  const criar = async (nome: string, extra: { cnh?: string[]; jes?: boolean; jornada?: 'pronto' | 'adm'; unidade?: string; foraDoQuadro?: boolean } = {}) => {
    seq++;
    const id = await inserir(api.banco, 'militar', {
      matricula: `99130${seq}-${seq}`, posto_grad_id: sd, nome_guerra: nome, motorista: !extra.foraDoQuadro && (extra.cnh ?? []).length > 0, cnh: extra.cnh ?? [], voluntario_jes: extra.jes ?? false,
    });
    militar[nome] = id;
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: extra.unidade ?? api.ids.secao, equipe_id: extra.jornada === 'adm' || extra.unidade ? null : alfa, jornada: extra.jornada ?? 'pronto', desde: '2026-11-01',
    });
  };
  await criar('ALFA', { cnh: ['E'] });
  await criar('CNHB', { cnh: ['B'], jes: true });
  await criar('DRV', { cnh: ['D'] });
  await criar('DRV2', { cnh: ['D'] });
  await criar('FORAQUADRO', { cnh: ['D'], foraDoQuadro: true });
  await criar('AFAST');
  await criar('ADM', { jornada: 'adm' });
  await criar('CHOQ', { jes: true });
  await criar('FORA', { unidade: outraSecao });

  // ALFA: Combatente do ABT no Pronto A do dia 10, com o acúmulo de Motorista do ABT; marcou 08h às 20h no voluntariado
  const alocacaoAlfa = await alocar('ALFA', 'Pronto', 'a', DIA, { guarnicao: abt, funcao: combatente });
  await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alocacaoAlfa, guarnicao_id: abt, funcao_id: motorista });
  await faixa('ALFA', DIA, 480, 1200);
  // DRV ocupa o Motorista do ABT às 08h–20h (a função está completa)
  await alocar('DRV', 'Pronto', 'a', DIA, { guarnicao: abt, funcao: motorista });
  const tipo = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
  await inserir(api.banco, 'afastamento', { militar_id: militar.AFAST, tipo_afastamento_id: tipo, inicio: '2026-12-08', fim: '2026-12-12' });
  // CHOQ: o Pronto A e o JES A, ao mesmo tempo
  await alocar('CHOQ', 'Pronto', 'a', DIA);
  await alocar('CHOQ', 'JES', 'a', DIA);
});
afterAll(async () => {
  await api.fechar();
});

describe('o dia do militar', () => {
  it('traz o militar, os serviços do dia com escala, horário, guarnição, função e acumulaCom, e os horários marcados', async () => {
    const p = await ler('ALFA');
    expect(p.data).toBe(DIA);
    expect(p.militar).toMatchObject({ militarId: militar.ALFA, posto: 'SD BM', nomeGuerra: 'ALFA', equipe: 'Alfa', jornada: 'pronto', cnh: ['E'], voluntarioJes: false });
    expect(p.afastamento).toBeNull();
    expect(p.disponibilidade).toEqual([{ inicio: '08:00', fim: '20:00' }]);
    expect(p.servicos).toEqual([
      {
        alocacaoId: expect.any(String), escalaId: escala, escala: 'Ordinário', servico: { id: servico.Pronto!.id, nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' },
        letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: 'ABT', funcao: 'Combatente', acumulaCom: ['Motorista ABT'],
      },
    ]);
    expect(p.choques).toEqual([]);
  });

  it('um choque do dia vem como frase, sem código de regra', async () => {
    const p = await ler('CHOQ');
    expect(p.choques).toHaveLength(1);
    expect(p.choques[0]).toMatch(/^Choque de horário: /);
    expect(p.choques[0]).toContain('Pronto');
    expect(p.choques[0]).toContain('JES');
  });
});

describe('uma diária na mesma faixa do Pronto (achado da revisão final da 4.4)', () => {
  it('o Pronto e o JES continuam do Ordinário e a diária vira opção própria, nas Operações', async () => {
    await servicoComTurnos('Diária 12h', 'diaria', [['A', '08:00', '20:00']]);
    const todos = [servico.Pronto!.id, servico.JES!.id, servico.Saldo!.id, servico.Bioma!.id, servico['Diária 12h']!.id];
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: todos })).status).toBe(200);
    try {
      const p = await ler('DRV2');
      const naFaixa = p.opcoes.filter((o) => o.inicio === '08:00' && o.fim === '20:00');
      const nomes = (ordinario: boolean) => naFaixa.filter((o) => o.ordinario === ordinario).flatMap((o) => o.servicos.map((s) => s.nome));
      // o Ordinário não perde o Pronto por causa da diária da mesma faixa
      expect(nomes(true).length).toBeGreaterThan(0);
      expect(nomes(true).every((n) => ['Pronto', 'JES', 'Saldo'].includes(n))).toBe(true);
      expect(nomes(true)).toContain('Pronto');
      expect([...new Set(nomes(false))]).toEqual(['Diária 12h']);
      // as vagas do Ordinário (com guarnição) continuam, e a diária também pode ser "Sem guarnição"
      expect(naFaixa.filter((o) => o.ordinario && o.guarnicao).length).toBeGreaterThan(0);
      expect(naFaixa.some((o) => !o.ordinario && o.guarnicaoId === null)).toBe(true);
    } finally {
      expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: todos.slice(0, 4) })).status).toBe(200);
    }
  });
});

describe('Adicionar serviço neste dia', () => {
  it('as opções dizem se são do Ordinário: Pronto, JES e Saldo sim, uma diária não', async () => {
    const p = await ler('DRV2');
    const faixas = (ordinario: boolean) => [...new Set(p.opcoes.filter((o) => o.ordinario === ordinario).map((o) => `${o.inicio}-${o.fim}`))].sort();
    expect(faixas(true)).toEqual(['08:00-20:00', '20:00-08:00']);
    expect(faixas(false)).toEqual(['08:00-16:00']);
    // a opção da diária só tem o Bioma; as do Ordinário, só serviços fixos
    expect(p.opcoes.filter((o) => !o.ordinario).flatMap((o) => o.servicos.map((s) => s.nome))).toEqual(['Bioma']);
    expect(p.opcoes.filter((o) => o.ordinario).flatMap((o) => o.servicos.map((s) => s.nome)).every((n) => ['Pronto', 'JES', 'Saldo'].includes(n))).toBe(true);
  });

  it('afastado no dia mostra o afastamento e nenhuma opção', async () => {
    const p = await ler('AFAST');
    expect(p.afastamento).toBe('Férias');
    expect(p.opcoes).toEqual([]);
  });

  it('as opções são só as que ele pode: sem a função de CNH D para quem só tem B, e com "Sem guarnição"', async () => {
    const p = await ler('CNHB');
    expect(opcoes(p, '08:00-20:00')).toEqual([
      ['Combatente ABT', ['Pronto', 'JES']],
      ['Sem guarnição', ['Pronto', 'JES']],
    ]);
    expect(opcoes(p, '20:00-08:00')).toEqual([
      ['Combatente ABT', ['Pronto']],
      ['Sem guarnição', ['Pronto']],
    ]);
    expect(p.opcoes.every((o) => o.escalaId === escala && o.escala === 'Ordinário')).toBe(true);
  });

  it('fora do quadro de motoristas, a CNH D não vale: o painel não oferece a vaga de motorista (Review Focus 2)', async () => {
    const p = await ler('FORAQUADRO');
    expect(p.militar.cnh).toEqual(['D']);
    expect(opcoes(p, '20:00-08:00').map((o) => o[0])).toEqual(['Combatente ABT', 'Sem guarnição']);
    const noQuadro = await ler('DRV2');
    expect(opcoes(noQuadro, '20:00-08:00').map((o) => o[0])).toContain('Motorista ABT');
  });

  it('a função completa não aparece (o Motorista do ABT às 08h–20h já tem DRV), e à noite ela está livre', async () => {
    const p = await ler('DRV2');
    expect(opcoes(p, '08:00-20:00').map((o) => o[0])).toEqual(['Combatente ABT', 'Sem guarnição']);
    expect(opcoes(p, '20:00-08:00').map((o) => o[0])).toEqual(['Motorista ABT', 'Combatente ABT', 'Sem guarnição']);
  });

  it('quem não marcou o horário aparece com semVoluntariado no serviço que pede voluntariado', async () => {
    const p = await ler('CNHB');
    const o = p.opcoes.find((x) => x.inicio === '08:00' && x.guarnicao === 'ABT')!;
    expect(o.servicos.map((s) => [s.nome, s.semVoluntariado])).toEqual([['Pronto', false], ['JES', true]]);
    expect(o.semVoluntariado).toBe(false);
    expect(o.servicos[0]).toMatchObject({ servicoId: servico.Pronto!.id, turnoId: servico.Pronto!.a });
  });

  it('o Saldo só aparece para o Adm, e vem antes do Pronto', async () => {
    const adm = await ler('ADM');
    expect(opcoes(adm, '08:00-20:00')[0]![1]).toEqual(expect.arrayContaining(['Saldo']));
    expect((opcoes(adm, '08:00-20:00')[0]![1] as string[])[0]).toBe('Saldo');
    const outro = await ler('CNHB');
    expect(outro.opcoes.flatMap((o) => o.servicos.map((s) => s.nome))).not.toContain('Saldo');
  });
});

describe('acesso', () => {
  it('a data precisa ser do mês da rota, o militar precisa ser da seção, e sem papel é 403', async () => {
    const r = await api.pedir('escalante', 'GET', `${secao()}/grade/2026-11/militares/${militar.ALFA}/dias/${DIA}`);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('A data precisa ser do mês da grade.');
    expect((await painel('FORA')).status).toBe(404);
    expect((await painel('ALFA', DIA, 'semPapel')).status).toBe(403);
    expect((await painel('ALFA', DIA, 'escalante', outraSecao)).status).toBe(403);
    expect((await painel('ALFA', '2026-02-30')).status).toBe(400);
  });
});

describe('quanto custa abrir o painel', () => {
  // O painel faz as consultas em série, uma escala e uma faixa por vez. Este teste fixa quantas são no cenário mais cheio do arquivo, para que
  // uma mudança que as aumente apareça aqui. Acima de 40 (ou, na sandbox, mais de 1 s para abrir) entra um item "otimizar o painel do dia" na fase 8.
  async function contar(nome: string, data: string): Promise<number> {
    let n = 0;
    const contador = { query: (sql: string, params?: unknown[]) => { n++; return api.banco.query(sql, params); }, exec: (sql: string) => api.banco.exec(sql) } as Consulta;
    const p = await montarPainelDoDia(contador, api.ids.secao, militar[nome]!, data);
    expect(p).not.toBeNull();
    return n;
  }

  it('o painel do dia faz no máximo 42 consultas no cenário mais cheio (40 para o Pronto, 42 para o Adm)', async () => {
    const natal = `${MES}-25`;
    await inserir(api.banco, 'feriado', { unidade_id: api.ids.secao, data: natal, descricao: 'Natal' });
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const alfa = (await api.banco.query<{ id: string }>("select id from equipe where unidade_id = $1 and nome = 'Alfa'", [api.ids.secao])).rows[0]!.id;
    const criarCheio = async (nome: string, matricula: string, jornada: 'pronto' | 'adm') => {
      militar[nome] = await inserir(api.banco, 'militar', { matricula, posto_grad_id: sd, nome_guerra: nome, motorista: true, cnh: ['E'], voluntario_jes: true });
      await inserir(api.banco, 'rastreio', { militar_id: militar[nome], unidade_id: api.ids.secao, equipe_id: jornada === 'adm' ? null : alfa, jornada, desde: '2026-11-01' });
    };
    // dois serviços no dia, um na véspera e um no dia seguinte, em dia de feriado: o pronto (com guarnição) e o do Adm (que também lê feriados e afastamentos)
    await criarCheio('CHEIO', '991390-0', 'pronto');
    await criarCheio('CHEIOADM', '991391-1', 'adm');
    for (const nome of ['CHEIO', 'CHEIOADM']) {
      await alocar(nome, 'Pronto', 'b', natal, nome === 'CHEIO' ? { guarnicao: abt, funcao: combatente } : undefined);
      await alocar(nome, 'JES', 'a', natal);
      await alocar(nome, 'Pronto', 'a', `${MES}-24`);
      await alocar(nome, 'Pronto', 'a', `${MES}-26`);
    }
    const nPronto = await contar('CHEIO', natal);
    const nAdm = await contar('CHEIOADM', natal);
    // medido com uma escala, três faixas (08–20, 20–08 e a do Bioma, 08–16) e uma guarnição: cada faixa custa cerca de 9 consultas, então o
    // número cresce com escalas, faixas e funções. Acima de 40 (o Adm já passa) entra "otimizar o painel do dia" na fase 8; nada muda no código agora.
    expect(nPronto).toBeLessThanOrEqual(40);
    expect(nAdm).toBeLessThanOrEqual(42);
  });
});
