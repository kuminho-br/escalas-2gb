import type { EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 7.3.1, Task 1: os estados da escala e as passagens (rascunho, prévia, publicada, retificada, remessada). Cenário fictício (D7): escalas vazias na 1ª SB.
let api: ApiDeTeste;
const atual = hojeRecife().slice(0, 7);
type Quem = 'admin' | 'escalante' | 'gestorGb' | 'semPapel';
const MSG = {
  soGestor: 'Só o gestor publica a escala.',
  jaPublicada: 'Esta escala já foi publicada.',
  aindaNao: 'Esta escala ainda não foi publicada.',
  naoEmRetificacao: 'Esta escala não está em retificação.',
  jaRemessada: 'Esta escala já foi remessada.',
};
let n = 0;
const novaEscala = async () => (await (await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: `Escala ${++n}` })).json()).id as string;
const passar = (quem: Quem, escala: string, passo: 'previa' | 'publicar' | 'republicar', m = atual) => api.pedir(quem, 'POST', `/api/escalas/${escala}/mes/${m}/${passo}`);
const doMes = async (escala: string, quem: Quem = 'escalante', m = atual): Promise<EscalaDoMes> => (await api.pedir(quem, 'GET', `/api/escalas/${escala}/mes/${m}`)).json();
const erro = async (r: Response) => ((await r.json()) as { erro: string }).erro;
const linha = async (escala: string) =>
  (await api.banco.query<{ estado: string; em_retificacao: boolean }>("select estado, em_retificacao from escala_estado where escala_id = $1 and mes = $2::date", [escala, `${atual}-01`])).rows[0];

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('migração 0046: a tabela escala_estado', () => {
  it('uma linha por escala e mês, o mês é o dia 1, o estado é um dos quatro, e a retificação só vale em publicada ou retificada', async () => {
    const e = await novaEscala();
    await inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-01-01', estado: 'previa' });
    await expect(inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-01-01', estado: 'publicada' })).rejects.toMatchObject({ code: '23505' });
    await expect(inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-01-15', estado: 'previa' })).rejects.toMatchObject({ code: '23514' });
    await expect(inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-02-01', estado: 'rascunho' })).rejects.toMatchObject({ code: '23514' });
    await expect(inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-02-01', estado: 'previa', em_retificacao: true })).rejects.toMatchObject({ code: '23514' });
    await expect(inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-02-01', estado: 'remessada', em_retificacao: true })).rejects.toMatchObject({ code: '23514' });
    await inserir(api.banco, 'escala_estado', { escala_id: e, mes: '2031-02-01', estado: 'publicada', em_retificacao: true });
  });

  it('a tabela antiga escala_previa não existe mais, e as passagens entram na auditoria', async () => {
    expect((await api.banco.query("select 1 from information_schema.tables where table_name = 'escala_previa'")).rows).toEqual([]);
    const e = await novaEscala();
    await passar('escalante', e, 'previa');
    await passar('gestorGb', e, 'publicar');
    const id = (await api.banco.query<{ id: string }>('select id from escala_estado where escala_id = $1', [e])).rows[0]!.id;
    const acoes = (await api.banco.query<{ acao: string }>("select acao from auditoria where tabela = 'escala_estado' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'update']);
  });
});

describe('o estado na escala do mês', () => {
  it('sem passagem, é rascunho; quem pode publicar é o gestor, o coordenador e o administrador (o escalante não)', async () => {
    const e = await novaEscala();
    expect((await doMes(e)).estado).toEqual({ estado: 'rascunho', emRetificacao: false, em: null, por: null });
    expect((await doMes(e, 'escalante')).podePublicar).toBe(false);
    expect((await doMes(e, 'gestorGb')).podePublicar).toBe(true);
    expect((await doMes(e, 'admin')).podePublicar).toBe(true);
  });

  it('o estado é por escala e mês: outro mês continua rascunho', async () => {
    const e = await novaEscala();
    await passar('escalante', e, 'previa');
    expect((await doMes(e, 'escalante', '2031-02')).estado.estado).toBe('rascunho');
  });
});

describe('as passagens', () => {
  it('o escalante lança a prévia (e a escala do mês traz quem lançou e quando); lançar de novo não é erro nem muda o que já estava', async () => {
    const e = await novaEscala();
    const r = await passar('escalante', e, 'previa');
    expect(r.status).toBe(200);
    const m = (await r.json()) as EscalaDoMes;
    expect(m.estado).toMatchObject({ estado: 'previa', emRetificacao: false, por: 'SD ESCALANTE' });
    expect(Date.now() - new Date(m.estado.em!).getTime()).toBeLessThan(60_000);
    const de_novo = (await (await passar('escalante', e, 'previa')).json()) as EscalaDoMes;
    expect(de_novo.estado.em).toBe(m.estado.em);
  });

  it('o escalante não publica nem republica (403 com a frase), e o militar comum não passa nada', async () => {
    const e = await novaEscala();
    await passar('escalante', e, 'previa');
    for (const passo of ['publicar', 'republicar'] as const) {
      const r = await passar('escalante', e, passo);
      expect(r.status).toBe(403);
      expect(await erro(r)).toBe(MSG.soGestor);
    }
    for (const passo of ['previa', 'publicar', 'republicar'] as const) expect((await passar('semPapel', e, passo)).status).toBe(403);
    expect((await linha(e))!.estado).toBe('previa');
  });

  it('o gestor publica do rascunho e da prévia; publicar uma publicada não é erro', async () => {
    const direto = await novaEscala();
    expect(((await (await passar('gestorGb', direto, 'publicar')).json()) as EscalaDoMes).estado).toMatchObject({ estado: 'publicada', por: 'SD GESTORGB' });
    const daPrevia = await novaEscala();
    await passar('escalante', daPrevia, 'previa');
    const p = (await (await passar('admin', daPrevia, 'publicar')).json()) as EscalaDoMes;
    expect(p.estado.estado).toBe('publicada');
    const de_novo = await passar('gestorGb', daPrevia, 'publicar');
    expect(de_novo.status).toBe(200);
    expect(((await de_novo.json()) as EscalaDoMes).estado.em).toBe(p.estado.em);
  });

  it('Review Focus 4: republicar sem retificação aberta é 409; em retificação, o gestor republica e a escala vira retificada', async () => {
    const e = await novaEscala();
    await passar('gestorGb', e, 'publicar');
    const sem = await passar('gestorGb', e, 'republicar');
    expect(sem.status).toBe(409);
    expect(await erro(sem)).toBe(MSG.naoEmRetificacao);
    await api.banco.query("update escala_estado set em_retificacao = true where escala_id = $1", [e]);
    expect((await doMes(e)).estado).toMatchObject({ estado: 'publicada', emRetificacao: true });
    const r = await passar('gestorGb', e, 'republicar');
    expect(r.status).toBe(200);
    expect(((await r.json()) as EscalaDoMes).estado).toMatchObject({ estado: 'retificada', emRetificacao: false });
    // republicar de novo, já sem retificação aberta
    expect((await passar('gestorGb', e, 'republicar')).status).toBe(409);
  });

  it('republicar o que ainda é prévia ou rascunho é 409 "ainda não foi publicada"', async () => {
    const e = await novaEscala();
    expect(await erro(await passar('gestorGb', e, 'republicar'))).toBe(MSG.aindaNao);
    await passar('escalante', e, 'previa');
    expect(await erro(await passar('gestorGb', e, 'republicar'))).toBe(MSG.aindaNao);
  });

  it('lançar a prévia de uma escala já publicada é 409; a passagem não volta', async () => {
    const e = await novaEscala();
    await passar('gestorGb', e, 'publicar');
    const r = await passar('escalante', e, 'previa');
    expect(r.status).toBe(409);
    expect(await erro(r)).toBe(MSG.jaPublicada);
    expect((await linha(e))!.estado).toBe('publicada');
  });

  it('remessada: publicar e republicar são 409 "já foi remessada" (a remessa é da fase 9; aqui o estado só existe)', async () => {
    const e = await novaEscala();
    await inserir(api.banco, 'escala_estado', { escala_id: e, mes: `${atual}-01`, estado: 'remessada' });
    expect(await erro(await passar('gestorGb', e, 'publicar'))).toBe(MSG.jaRemessada);
    expect(await erro(await passar('gestorGb', e, 'republicar'))).toBe(MSG.jaRemessada);
    expect((await passar('escalante', e, 'previa')).status).toBe(409);
  });

  it('mês inválido é 400 e escala inexistente é 404; o DELETE antigo da prévia não existe mais', async () => {
    const e = await novaEscala();
    expect((await passar('escalante', e, 'previa', '2026-13')).status).toBe(400);
    expect((await passar('escalante', '00000000-0000-4000-8000-000000000000', 'previa')).status).toBe(404);
    expect((await api.pedir('escalante', 'DELETE', `/api/escalas/${e}/mes/${atual}/previa`)).status).toBe(404);
  });
});
