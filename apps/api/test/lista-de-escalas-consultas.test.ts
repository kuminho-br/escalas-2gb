import type { EscalaVisivel } from 'contratos';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.65 (pool 25 c): a lista de Escalas não consulta o nível de acesso por unidade para as escalas publicadas, que toda conta vê: o número de consultas não cresce com elas.
let api: ApiDeTeste;
const mes = `${hojeRecife().slice(0, 7)}`;
let seq = 0;

/** Põe `n` unidades, cada uma com uma escala no estado dado, e devolve quantas consultas ao banco a lista do mês fez para a conta sem nível. */
async function consultasDaLista(n: number, estado: 'publicada' | 'previa'): Promise<{ consultas: number; lista: EscalaVisivel[] }> {
  for (let i = 0; i < n; i++) {
    seq++;
    const unidade = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: `LISTA-${seq}`, nome: `Seção ${seq}`, mae_id: api.ids.gb, desde: '2026-11-01' });
    const escala = await inserir(api.banco, 'escala', { unidade_id: unidade, nome: `Escala ${seq}`, titulo: `Escala ${seq}`, militares_doc: 'todos', dias_doc: 'todos' });
    await inserir(api.banco, 'escala_estado', { escala_id: escala, mes: `${mes}-01`, estado, em_retificacao: false }, 'escala_id');
  }
  const espiao = vi.spyOn(api.banco, 'query');
  const r = await api.pedir('semPapel', 'GET', `/api/visualizacao/escalas/${mes}`);
  const consultas = espiao.mock.calls.length;
  espiao.mockRestore();
  return { consultas, lista: (await r.json()) as EscalaVisivel[] };
}

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('a lista de Escalas do mês', () => {
  it('Review Focus 4: com 60 unidades de escala publicada, o número de consultas é o mesmo que com 5 (não cresce com as escalas)', async () => {
    const poucas = await consultasDaLista(5, 'publicada');
    const muitas = await consultasDaLista(55, 'publicada'); // 5 + 55 = 60 unidades com escala publicada
    expect(poucas.lista.filter((e) => e.unidadeSigla.startsWith('LISTA-'))).toHaveLength(5);
    expect(muitas.lista.filter((e) => e.unidadeSigla.startsWith('LISTA-'))).toHaveLength(60);
    expect(muitas.consultas).toBe(poucas.consultas);
  });
});
