import { LIMITE_DE_PROXIMOS, type MinhaEscala, type ProximosServicos } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// 6.55: os próximos serviços do militar da conta, atravessando o mês, nas escalas que não são rascunho. O relógio é injetado (a hora de Recife é UTC-3, sem horário de verão).
// Cenário fictício (D7): a 1ª SB tem o Pronto (turnos A 19h às 7h e B 7h às 19h, verde) e o JES (turno A 8h às 17h, azul; a letra U não existe mais desde a migração 0011), numa escala publicada, numa em prévia e numa em rascunho.
let api: ApiDeTeste;
let pedro: Pessoa;
let semServico: Pessoa;
let relogio = new Date('2026-11-29T15:00:00Z');
const turno: Record<string, string> = {};
const servico: Record<string, string> = {};
let publicada: string;
let previa: string;
let rascunho: string;

/** O relógio de Recife: dia 'aaaa-mm-dd' e hora 'hh:mm' viram o instante. */
const em = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`);
const proximos = async (quem: Pessoa = pedro): Promise<ProximosServicos> => (await quem.pedir('GET', '/api/eu/proximos-servicos')).json();
const lancar = (escalaId: string, mes: string, t: string, data: string, quem: Pessoa = pedro, s = 'Pronto') =>
  inserir(api.banco, 'alocacao', { militar_id: quem.militarId, escala_id: escalaId, servico_id: servico[s], turno_id: turno[t], data, origem: 'manual' });
const estado = (escalaId: string, mes: string, e: string) => inserir(api.banco, 'escala_estado', { escala_id: escalaId, mes: `${mes}-01`, estado: e }, 'escala_id');

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => criarApp({ banco, auth, limiteDeBuscas: Infinity, agora: () => relogio }));
  servico.Pronto = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  servico.JES = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'JES', tipo: 'pjes', cor: '#3C5F9C' });
  turno.A = await inserir(api.banco, 'turno', { servico_id: servico.Pronto, letra: 'A', inicio: '19:00', fim: '07:00' });
  turno.B = await inserir(api.banco, 'turno', { servico_id: servico.Pronto, letra: 'B', inicio: '07:00', fim: '19:00' });
  turno.J = await inserir(api.banco, 'turno', { servico_id: servico.JES, letra: 'A', inicio: '08:00', fim: '17:00' });
  const escala = async (nome: string) => {
    const id = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome, titulo: nome, militares_doc: 'todos', dias_doc: 'todos' });
    for (const [ordem, s] of [servico.Pronto, servico.JES].entries()) await inserir(api.banco, 'escala_servico', { escala_id: id, servico_id: s, ordem: ordem + 1 }, 'escala_id');
    return id;
  };
  publicada = await escala('Ordinário');
  previa = await escala('Prévia');
  rascunho = await escala('Rascunho');
  for (const mes of ['2026-11', '2026-12']) {
    await estado(publicada, mes, 'publicada');
    await estado(previa, mes, 'previa');
  }
  pedro = await entrarComo(api, { matricula: '990981-1', nome: 'PEDRO' });
  semServico = await entrarComo(api, { matricula: '990982-2', nome: 'VAZIO' });
});
afterAll(async () => {
  await api.fechar();
});

describe('os próximos serviços (6.55)', () => {
  it('até seis, em ordem de data e início, atravessando o mês; o que já passou fica de fora', async () => {
    relogio = em('2026-11-29', '12:00');
    await lancar(publicada, '2026-11', 'B', '2026-11-28'); // ontem: passou
    await lancar(publicada, '2026-11', 'A', '2026-11-30');
    for (const d of ['2026-12-02', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09']) await lancar(publicada, '2026-12', 'B', d);
    const r = await proximos();
    expect(LIMITE_DE_PROXIMOS).toBe(6);
    expect(r.servicos.map((s) => s.data)).toEqual(['2026-11-30', '2026-12-02', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08']);
    expect(r.servicos[0]).toMatchObject({ servico: 'Pronto', inicio: '19:00', fim: '07:00', estado: 'publicada', unidadeSigla: '1ª SB' });
  });

  it('o serviço das 19h às 7h de ontem ainda é o primeiro às 3h, e some depois das 7h', async () => {
    await lancar(publicada, '2026-11', 'A', '2026-11-26');
    relogio = em('2026-11-27', '03:00');
    expect((await proximos()).servicos[0]).toMatchObject({ data: '2026-11-26', turno: 'A' });
    relogio = em('2026-11-27', '07:01');
    expect((await proximos()).servicos.map((s) => s.data)).not.toContain('2026-11-26');
  });

  it('o serviço de hoje que já acabou não aparece, e o que está em andamento aparece', async () => {
    await lancar(publicada, '2026-11', 'B', '2026-11-26'); // 7h às 19h
    relogio = em('2026-11-26', '20:00');
    expect((await proximos()).servicos.map((s) => `${s.data} ${s.inicio}`)).not.toContain('2026-11-26 07:00');
    relogio = em('2026-11-26', '12:00');
    expect((await proximos()).servicos[0]).toMatchObject({ data: '2026-11-26', inicio: '07:00' });
  });

  it('a escala em rascunho não entra; a em prévia entra, marcada como prévia', async () => {
    relogio = em('2026-12-01', '00:30');
    await lancar(rascunho, '2026-12', 'J', '2026-12-03', pedro, 'JES');
    await lancar(previa, '2026-12', 'J', '2026-12-04', pedro, 'JES');
    const r = await proximos();
    expect(r.servicos.map((s) => s.data)).not.toContain('2026-12-03');
    expect(r.servicos.find((s) => s.data === '2026-12-04')).toMatchObject({ estado: 'previa', servico: 'JES', cor: '#3C5F9C', turno: 'A' });
  });

  it('cor e turno vêm certos, também na escala do mês', async () => {
    relogio = em('2026-11-29', '12:00');
    const p = (await proximos()).servicos.find((s) => s.data === '2026-11-30')!;
    expect(p).toMatchObject({ cor: '#2F8F5B', turno: 'A' });
    const m = (await (await pedro.pedir('GET', '/api/eu/escala/2026-11')).json()) as MinhaEscala;
    expect(m.servicos.find((s) => s.data === '2026-11-30')).toMatchObject({ cor: '#2F8F5B', turno: 'A' });
    expect(m.servicos.find((s) => s.servico === 'Pronto' && s.inicio === '07:00')).toMatchObject({ turno: 'B' });
  });

  it('o militar sem serviço recebe a lista vazia', async () => {
    expect(await proximos(semServico)).toEqual({ servicos: [] });
  });

  it('a conta que deixou de ser de um militar recebe 404 com a frase fixa', async () => {
    await api.banco.query('update usuario set ativo = false where id = $1', [semServico.usuarioId]);
    const r = await semServico.pedir('GET', '/api/eu/proximos-servicos');
    expect([401, 404]).toContain(r.status);
    if (r.status === 404) expect(((await r.json()) as { erro: string }).erro).toBe('Esta conta não é de um militar.');
  });

  it('sem sessão, 401', async () => {
    expect((await api.app.request('http://localhost:8787/api/eu/proximos-servicos', { headers: { Origin: 'http://localhost:8787' } })).status).toBe(401);
  });
});
