import type { EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): uma escala Ordinário na 1ª SB, sem guarnições (o que importa aqui é lançar e recolher a prévia).
let api: ApiDeTeste;
let escala: string;
const atual = hojeRecife().slice(0, 7);
const lancar = (quem: 'admin' | 'escalante' | 'gestorGb' | 'semPapel', m = atual, id = escala) => api.pedir(quem, 'POST', `/api/escalas/${id}/mes/${m}/previa`);
const recolher = (quem: 'admin' | 'escalante' | 'gestorGb' | 'semPapel', m = atual, id = escala) => api.pedir(quem, 'DELETE', `/api/escalas/${id}/mes/${m}/previa`);
const doMes = async (quem: 'admin' | 'escalante' | 'gestorGb' = 'escalante', m = atual): Promise<EscalaDoMes> => (await api.pedir(quem, 'GET', `/api/escalas/${escala}/mes/${m}`)).json();

beforeAll(async () => {
  api = await montarApi();
  escala = (await (await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Ordinário' })).json()).id;
});
afterAll(async () => {
  await api.fechar();
});

describe('migração 0045: a prévia da escala', () => {
  it('a mesma escala e mês não entram duas vezes, o mês é o dia 1 e lançar e recolher entram na auditoria', async () => {
    const id = await inserir(api.banco, 'escala_previa', { escala_id: escala, mes: '2031-01-01' });
    await expect(inserir(api.banco, 'escala_previa', { escala_id: escala, mes: '2031-01-01' })).rejects.toMatchObject({ code: '23505' });
    await expect(inserir(api.banco, 'escala_previa', { escala_id: escala, mes: '2031-01-15' })).rejects.toMatchObject({ code: '23514' });
    await api.banco.query('delete from escala_previa where id = $1', [id]);
    const acoes = (await api.banco.query<{ acao: string }>("select acao from auditoria where tabela = 'escala_previa' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });
});

describe('lançar e recolher a prévia', () => {
  it('sem lançar, a escala do mês não tem prévia', async () => {
    expect((await doMes()).previa).toBeNull();
  });

  it('o escalante lança: a escala do mês traz quem lançou e quando; lançar de novo não é erro e não muda o que já estava', async () => {
    const r = await lancar('escalante');
    expect(r.status).toBe(200);
    const e = (await r.json()) as EscalaDoMes;
    expect(e.previa).toMatchObject({ por: 'SD ESCALANTE' });
    expect(Date.now() - new Date(e.previa!.em).getTime()).toBeLessThan(60_000);
    const primeira = e.previa!.em;
    const de_novo = await lancar('escalante');
    expect(de_novo.status).toBe(200);
    expect(((await de_novo.json()) as EscalaDoMes).previa!.em).toBe(primeira);
    expect((await doMes()).previa).toMatchObject({ em: primeira });
  });

  it('a prévia é por escala e mês: outro mês continua sem prévia', async () => {
    expect((await doMes('escalante', '2031-02')).previa).toBeNull();
  });

  it('o escalante recolhe: a prévia some; recolher quando não há também não é erro', async () => {
    const r = await recolher('escalante');
    expect(r.status).toBe(200);
    expect(((await r.json()) as EscalaDoMes).previa).toBeNull();
    expect((await doMes()).previa).toBeNull();
    expect((await recolher('escalante')).status).toBe(200);
  });

  it('o gestor e o administrador também lançam; o militar comum recebe 403 ao lançar e ao recolher', async () => {
    expect((await lancar('gestorGb')).status).toBe(200);
    expect((await recolher('admin')).status).toBe(200);
    expect((await lancar('semPapel')).status).toBe(403);
    await lancar('escalante');
    expect((await recolher('semPapel')).status).toBe(403);
    expect((await doMes()).previa).not.toBeNull();
    await recolher('escalante');
  });

  it('mês inválido é 400 e escala inexistente é 404', async () => {
    expect((await lancar('escalante', '2026-13')).status).toBe(400);
    expect((await lancar('escalante', atual, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('a escala do mês diz se quem pede pode alterar o passado: gestor, coordenador e administrador sim; o escalante não', async () => {
    expect((await doMes('escalante')).podeAlterarPassado).toBe(false);
    expect((await doMes('gestorGb')).podeAlterarPassado).toBe(true);
    expect((await doMes('admin')).podeAlterarPassado).toBe(true);
  });
});
