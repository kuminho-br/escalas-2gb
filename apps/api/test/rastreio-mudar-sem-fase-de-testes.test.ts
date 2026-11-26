import type { FichaMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Com a chave da fase de testes desligada (cadastros/fase-de-testes.ts), nem o administrador mexe no que já vale: só a mudança que ainda não vale. Dados fictícios (D7).
vi.mock('../src/cadastros/fase-de-testes.ts', () => ({ ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO: false }));

let api: ApiDeTeste;
const hoje = hojeRecife();
const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
let militarId: string;
let ids: string[];

beforeAll(async () => {
  api = await montarApi();
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  militarId = await inserir(api.banco, 'militar', { matricula: '997201-1', posto_grad_id: posto, nome_guerra: 'SEMFASE', nome_completo: 'Fulano Sem Fase' });
  ids = [];
  for (const [desde, ate] of [[mais(-60), mais(-11)], [mais(-10), mais(9)], [mais(10), null]] as const) {
    ids.push(await inserir(api.banco, 'rastreio', { militar_id: militarId, unidade_id: api.ids.secao, jornada: 'pronto', desde, ate }));
  }
});
afterAll(async () => {
  await api.fechar();
});

describe('a fase de testes desligada', () => {
  it('o administrador não cancela nem edita o que já vale: 403 com a frase, e nada muda', async () => {
    const cancelar = await api.pedir('admin', 'DELETE', `/api/militares/${militarId}/rastreio/${ids[1]}`);
    expect(cancelar.status).toBe(403);
    expect(((await cancelar.json()) as { erro: string }).erro).toBe('Só dá para mexer numa mudança que ainda não vale.');
    const editar = await api.pedir('admin', 'PUT', `/api/militares/${militarId}/rastreio/${ids[0]}`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: mais(-60) });
    expect(editar.status).toBe(403);
    expect((await api.banco.query('select 1 from rastreio where militar_id = $1', [militarId])).rows).toHaveLength(3);
  });

  it('a mudança que ainda não vale segue valendo para o administrador, e a ficha só oferece ela', async () => {
    const ficha = (await (await api.pedir('admin', 'GET', `/api/militares/${militarId}`)).json()) as FichaMilitar;
    expect(ficha.rastreio.map((p) => [p.desde, p.podeMexer])).toEqual([[mais(10), true], [mais(-10), false], [mais(-60), false]]);
    expect((await api.pedir('admin', 'DELETE', `/api/militares/${militarId}/rastreio/${ids[2]}`)).status).toBe(200);
  });
});
