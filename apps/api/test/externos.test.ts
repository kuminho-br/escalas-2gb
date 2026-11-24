import type { MilitarExterno } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { criarMilitar, montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.33, Task 1: o militar externo, de outra unidade, que o gestor traz para a escala da unidade dele. Dados fictícios (D7).
let api: ApiDeTeste;
let outraSecao: string;
let seq = 0;
const hoje = hojeRecife();
const FRASE_DO_GESTOR = 'Trazer e tirar militar externo é do gestor da unidade.';

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
});
afterAll(async () => {
  await api.fechar();
});

/** Um militar fictício lotado na unidade dada (a 2ª SB por padrão), sem e-mail. */
async function militarDe(unidadeId = outraSecao) {
  seq++;
  return criarMilitar(api, { matricula: `990${String(700 + seq).padStart(3, '0')}-${seq % 10}`, email: null, unidadeId });
}
const trazer = (militarId: string, quem: 'escalante' | 'gestorGb' | 'admin' | 'semPapel' = 'gestorGb', unidadeId = api.ids.secao) =>
  api.pedir(quem, 'POST', `/api/unidades/${unidadeId}/externos`, { militarId });
const externos = async (unidadeId = api.ids.secao, quem: 'escalante' | 'gestorGb' | 'admin' = 'escalante'): Promise<MilitarExterno[]> =>
  (await api.pedir(quem, 'GET', `/api/unidades/${unidadeId}/externos`)).json();

describe('trazer o militar externo para a escala da unidade', () => {
  it('o gestor acima da unidade traz um militar de outra unidade: 201 com os dados dele; a lotação não muda; o auxiliar vê na lista', async () => {
    const id = await militarDe();
    const r = await trazer(id);
    expect(r.status).toBe(201);
    const criado: MilitarExterno = await r.json();
    expect(criado).toMatchObject({ militarId: id, posto: 'SD', lotacaoSigla: '2ª SB', desde: hoje, vinculoId: expect.any(String), nomeGuerra: expect.any(String), matricula: expect.any(String) });
    expect((await externos()).map((e) => e.militarId)).toContain(id);
    // a lotação dele continua a da origem, e o vínculo guarda o dia em que valeu a partir de
    const lotacao = (await api.banco.query<{ unidade_id: string }>('select unidade_id from rastreio where militar_id = $1 and ate is null', [id])).rows;
    expect(lotacao).toEqual([{ unidade_id: outraSecao }]);
    const vinculo = (await api.banco.query<{ desde: string; ate: string | null }>("select to_char(desde, 'YYYY-MM-DD') as desde, ate from vinculo_externo where id = $1", [criado.vinculoId])).rows[0]!;
    expect(vinculo).toEqual({ desde: hoje, ate: null });
  });

  it('a lista traz os externos vigentes hoje, do posto mais alto para o mais baixo', async () => {
    const sd = await militarDe();
    const cb = await militarDe();
    await api.banco.query("update militar set posto_grad_id = (select id from posto_grad where sigla = 'CB') where id = $1", [cb]);
    await trazer(sd);
    await trazer(cb);
    const postos = (await externos()).map((x) => x.posto);
    expect(postos.indexOf('CB')).toBeLessThan(postos.lastIndexOf('SD'));
    expect((await externos()).every((x) => x.desde <= hoje)).toBe(true);
  });

  it('o auxiliar (escalante) não traz: 403 com a frase fixa; quem não tem papel também recebe 403', async () => {
    const id = await militarDe();
    const r = await trazer(id, 'escalante');
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe(FRASE_DO_GESTOR);
    expect((await trazer(id, 'semPapel')).status).toBe(403);
    expect((await externos()).map((e) => e.militarId)).not.toContain(id);
  });

  it('o administrador traz em qualquer unidade (um militar da 1ª SB para a 2ª SB)', async () => {
    const id = await militarDe(api.ids.secao);
    const r = await trazer(id, 'admin', outraSecao);
    expect(r.status).toBe(201);
    expect((await r.json()).lotacaoSigla).toBe('1ª SB');
  });

  it('Review Focus 5: quem já é da unidade, ou de uma unidade de baixo dela, é 400 "Este militar já é desta unidade."', async () => {
    const daUnidade = await militarDe(api.ids.secao);
    const a = await trazer(daUnidade);
    expect(a.status).toBe(400);
    expect((await a.json()).erro).toBe('Este militar já é desta unidade.');
    // o 2º GB recebe um militar lotado na 2ª SB, que é uma unidade de baixo dele
    const deBaixo = await militarDe(outraSecao);
    const b = await trazer(deBaixo, 'gestorGb', api.ids.gb);
    expect(b.status).toBe(400);
    expect((await b.json()).erro).toBe('Este militar já é desta unidade.');
  });

  it('Review Focus 4: com o vínculo aberto, trazer de novo é 409 "Já está na escala de 1ª SB." (nunca erro de banco)', async () => {
    const id = await militarDe();
    expect((await trazer(id)).status).toBe(201);
    const r = await trazer(id);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já está na escala de 1ª SB.');
  });

  it('militar que não existe é 404; corpo sem o militar é 400; unidade que não existe é 404', async () => {
    expect((await trazer('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/externos`, {})).status).toBe(400);
    expect((await trazer(await militarDe(), 'gestorGb', '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});

describe('tirar o militar externo da escala', () => {
  it('o gestor tira: 204, ele some da lista, e trazer de novo depois abre um vínculo novo (o antigo fica com o fim)', async () => {
    const id = await militarDe();
    const primeiro: MilitarExterno = await (await trazer(id)).json();
    // o vínculo valeu desde alguns dias atrás: sair hoje fecha o vínculo no dia anterior
    await api.banco.query('update vinculo_externo set desde = $2::date where id = $1', [primeiro.vinculoId, somarDias(hoje, -5)]);
    const r = await api.pedir('gestorGb', 'DELETE', `/api/unidades/${api.ids.secao}/externos/${primeiro.vinculoId}`);
    expect(r.status).toBe(204);
    expect((await externos()).map((e) => e.militarId)).not.toContain(id);
    const antigo = (await api.banco.query<{ ate: string }>("select to_char(ate, 'YYYY-MM-DD') as ate from vinculo_externo where id = $1", [primeiro.vinculoId])).rows[0]!;
    expect(antigo.ate).toBe(somarDias(hoje, -1));
    const novo = await trazer(id);
    expect(novo.status).toBe(201);
    const segundo: MilitarExterno = await novo.json();
    expect(segundo.vinculoId).not.toBe(primeiro.vinculoId);
    expect((await api.banco.query('select 1 from vinculo_externo where militar_id = $1', [id])).rows).toHaveLength(2);
  });

  it('trazido hoje e tirado hoje: nenhum dia chegou a valer, e trazer de novo no mesmo dia também é 201', async () => {
    const id = await militarDe();
    const v: MilitarExterno = await (await trazer(id)).json();
    expect((await api.pedir('gestorGb', 'DELETE', `/api/unidades/${api.ids.secao}/externos/${v.vinculoId}`)).status).toBe(204);
    expect((await externos()).map((e) => e.militarId)).not.toContain(id);
    expect((await trazer(id)).status).toBe(201);
  });

  it('o auxiliar não tira: 403 com a frase fixa; o vínculo continua; tirar de outra unidade ou o que não existe é 404', async () => {
    const id = await militarDe();
    const v: MilitarExterno = await (await trazer(id)).json();
    const r = await api.pedir('escalante', 'DELETE', `/api/unidades/${api.ids.secao}/externos/${v.vinculoId}`);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe(FRASE_DO_GESTOR);
    expect((await externos()).map((e) => e.militarId)).toContain(id);
    // o vínculo é da 1ª SB: pelo caminho da 2ª SB ele não existe
    expect((await api.pedir('admin', 'DELETE', `/api/unidades/${outraSecao}/externos/${v.vinculoId}`)).status).toBe(404);
    expect((await api.pedir('gestorGb', 'DELETE', `/api/unidades/${api.ids.secao}/externos/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });

  it('tirar não apaga os lançamentos já feitos (a alocação do externo continua)', async () => {
    const id = await militarDe();
    const v: MilitarExterno = await (await trazer(id)).json();
    // a escala não existe neste cenário: a prova é que o DELETE do vínculo não mexe na tabela de alocações
    const antes = (await api.banco.query<{ n: string }>('select count(*) as n from alocacao')).rows[0]!.n;
    await api.pedir('gestorGb', 'DELETE', `/api/unidades/${api.ids.secao}/externos/${v.vinculoId}`);
    expect((await api.banco.query<{ n: string }>('select count(*) as n from alocacao')).rows[0]!.n).toBe(antes);
  });
});
