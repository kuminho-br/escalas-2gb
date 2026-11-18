import type { Feriado } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let outraSecao: string;
const secao = () => `/api/unidades/${api.ids.secao}`;
const lista = async (ano: number): Promise<Feriado[]> => (await api.pedir('escalante', 'GET', `${secao()}/feriados?ano=${ano}`)).json();
async function criar(data: string, descricao: string, fixo = true): Promise<Feriado> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data, descricao, fixo });
  expect(r.status).toBe(201);
  return r.json();
}

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('feriados', () => {
  it('feriado do CBMPE aparece herdado na 1ª SB, sem aparecer na vizinha', async () => {
    await inserir(api.banco, 'feriado', { unidade_id: api.ids.raiz, data: '2026-09-07', descricao: 'Independência do Brasil', fixo: true });
    await inserir(api.banco, 'feriado', { unidade_id: outraSecao, data: '2026-10-05', descricao: 'Aniversário da cidade vizinha', fixo: true });
    const f = await lista(2026);
    expect(f.find((x) => x.descricao === 'Independência do Brasil')).toMatchObject({ data: '2026-09-07', herdado: true, unidadeSigla: 'CBMPE', fixo: true });
    expect(f.find((x) => x.descricao === 'Aniversário da cidade vizinha')).toBeUndefined();
  });

  it('cria, edita e apaga um feriado próprio; a lista sai em ordem de data', async () => {
    const natal = await criar('2026-12-25', 'Natal');
    const tiradentes = await criar('2026-04-21', 'Tiradentes');
    expect(natal).toMatchObject({ data: '2026-12-25', descricao: 'Natal', fixo: true, herdado: false, unidadeSigla: '1ª SB' });
    const datas = (await lista(2026)).map((f) => f.data);
    expect(datas).toEqual([...datas].sort());
    const e = await api.pedir('escalante', 'PATCH', `/api/feriados/${tiradentes.id}`, { descricao: 'Dia de Tiradentes', fixo: false });
    expect(e.status).toBe(200);
    expect(await e.json()).toMatchObject({ descricao: 'Dia de Tiradentes', fixo: false, data: '2026-04-21' });
    expect((await api.pedir('escalante', 'DELETE', `/api/feriados/${tiradentes.id}`)).status).toBe(204);
    expect((await lista(2026)).find((f) => f.id === tiradentes.id)).toBeUndefined();
  });

  it('a lista traz só o ano pedido', async () => {
    await criar('2027-01-01', 'Confraternização Universal');
    expect((await lista(2026)).every((f) => f.data.startsWith('2026'))).toBe(true);
    expect((await lista(2027)).map((f) => f.descricao)).toContain('Confraternização Universal');
  });

  it('data repetida é 409 com a frase legível', async () => {
    await criar('2026-05-01', 'Dia do Trabalho');
    const r = await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data: '2026-05-01', descricao: 'Outro nome', fixo: true });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe um feriado nesta data: "Dia do Trabalho".');
    const outro = await criar('2026-05-02', 'Dia seguinte');
    const e = await api.pedir('escalante', 'PATCH', `/api/feriados/${outro.id}`, { data: '2026-05-01' });
    expect(e.status).toBe(409);
  });

  it('editar o próprio feriado sem mudar a data não dá conflito', async () => {
    const f = await criar('2026-06-15', 'Feriado local');
    const e = await api.pedir('escalante', 'PATCH', `/api/feriados/${f.id}`, { data: '2026-06-15', descricao: 'Feriado municipal' });
    expect(e.status).toBe(200);
  });

  // [foco 3] data que não existe no calendário
  it('data que não existe é 400, nunca erro do banco', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data: '2026-02-30', descricao: 'Impossível', fixo: true });
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toHaveProperty('data');
  });

  // [foco 3] o ano 0000 não existe no Postgres
  it('data do ano 0000 é 400, nunca erro do banco', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data: '0000-03-01', descricao: 'Antigo', fixo: true });
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toHaveProperty('data');
  });

  it('copiar fixos pula o Carnaval, as datas já existentes e o 29 de fevereiro em ano comum', async () => {
    await criar('2024-04-21', 'Tiradentes', true);
    await criar('2024-12-25', 'Natal', true);
    await criar('2024-02-13', 'Carnaval', false);
    await criar('2024-02-29', 'Dia bissexto', true);
    await criar('2025-12-25', 'Natal (já cadastrado)', true);
    await inserir(api.banco, 'feriado', { unidade_id: api.ids.raiz, data: '2024-09-07', descricao: 'Independência', fixo: true });
    const r = await api.pedir('escalante', 'POST', `${secao()}/feriados/copiar-fixos`, { de: 2024, para: 2025 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ copiados: 1 });
    const f = await lista(2025);
    expect(f.filter((x) => !x.herdado).map((x) => [x.data, x.descricao, x.fixo])).toEqual([
      ['2025-04-21', 'Tiradentes', true],
      ['2025-12-25', 'Natal (já cadastrado)', true],
    ]);
    // o herdado (da raiz) não é copiado para a seção
    expect(f.some((x) => x.data === '2025-09-07')).toBe(false);
    // copiar de novo não duplica
    expect(await (await api.pedir('escalante', 'POST', `${secao()}/feriados/copiar-fixos`, { de: 2024, para: 2025 })).json()).toEqual({ copiados: 0 });
  });

  it('copiar fixos para ano bissexto leva o 29 de fevereiro', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/feriados/copiar-fixos`, { de: 2024, para: 2028 });
    expect(await r.json()).toEqual({ copiados: 3 });
    expect((await lista(2028)).map((f) => f.data)).toEqual(['2028-02-29', '2028-04-21', '2028-12-25']);
  });

  it('sem papel na unidade: 403 em listar, criar, editar, apagar e copiar', async () => {
    const f = await criar('2026-07-04', 'Protegido');
    expect((await api.pedir('semPapel', 'GET', `${secao()}/feriados?ano=2026`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/feriados`, { data: '2026-07-05', descricao: 'X', fixo: true })).status).toBe(403);
    expect((await api.pedir('semPapel', 'PATCH', `/api/feriados/${f.id}`, { descricao: 'Y' })).status).toBe(403);
    expect((await api.pedir('semPapel', 'DELETE', `/api/feriados/${f.id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/feriados/copiar-fixos`, { de: 2026, para: 2027 })).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/feriados`, { data: '2026-07-06', descricao: 'Z', fixo: true })).status).toBe(403);
  });

  it('o feriado herdado não se edita nem se apaga pela seção (403), e feriado inexistente é 404', async () => {
    const herdado = (await lista(2026)).find((f) => f.herdado)!;
    expect((await api.pedir('escalante', 'PATCH', `/api/feriados/${herdado.id}`, { descricao: 'Mudou' })).status).toBe(403);
    expect((await api.pedir('escalante', 'DELETE', `/api/feriados/${herdado.id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'DELETE', '/api/feriados/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('o ano é obrigatório com 4 dígitos; sem ele vale o ano corrente', async () => {
    expect((await api.pedir('escalante', 'GET', `${secao()}/feriados?ano=26`)).status).toBe(400);
    expect((await api.pedir('escalante', 'GET', `${secao()}/feriados`)).status).toBe(200);
  });

  it('quem grava deixa o próprio usuario_id na auditoria', async () => {
    const f = await criar('2026-08-15', 'Auditado');
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'feriado' and registro_id = $1", [f.id]);
    expect(rows[0]?.usuario_id).toBe(api.usuarios.escalante);
  });

  describe('data que já é feriado numa unidade acima', () => {
    it('feriado numa data que vem de cima dá 409 com a unidade, ao criar e ao mudar a data', async () => {
      await inserir(api.banco, 'feriado', { unidade_id: api.ids.raiz, data: '2032-11-15', descricao: 'Proclamação da República', fixo: true });
      const r = await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data: '2032-11-15', descricao: 'De novo', fixo: true });
      expect(r.status).toBe(409);
      expect((await r.json()).erro).toBe('Este dia já é feriado vindo de CBMPE: "Proclamação da República".');
      const outro = await criar('2032-11-16', 'Outro dia');
      const m = await api.pedir('escalante', 'PATCH', `/api/feriados/${outro.id}`, { data: '2032-11-15' });
      expect(m.status).toBe(409);
      expect((await m.json()).erro).toBe('Este dia já é feriado vindo de CBMPE: "Proclamação da República".');
      // mudar só a descrição de um feriado próprio continua valendo
      expect((await api.pedir('escalante', 'PATCH', `/api/feriados/${outro.id}`, { descricao: 'Outro dia, outro nome' })).status).toBe(200);
    });

    it('feriado da unidade vizinha ou de baixo não impede a data', async () => {
      await inserir(api.banco, 'feriado', { unidade_id: outraSecao, data: '2032-12-01', descricao: 'Da vizinha', fixo: true });
      expect((await api.pedir('escalante', 'POST', `${secao()}/feriados`, { data: '2032-12-01', descricao: 'Da 1ª SB', fixo: true })).status).toBe(201);
    });

    it('copiar fixos pula a data que vem de cima, e só conta o que gravou', async () => {
      await inserir(api.banco, 'feriado', { unidade_id: api.ids.raiz, data: '2031-05-01', descricao: 'Dia do Trabalho', fixo: true });
      await criar('2030-05-01', 'Dia do Trabalho (da seção)');
      await criar('2030-06-02', 'Aniversário da seção');
      const r = await api.pedir('escalante', 'POST', `${secao()}/feriados/copiar-fixos`, { de: 2030, para: 2031 });
      expect(await r.json()).toEqual({ copiados: 1 });
      const f = await lista(2031);
      expect(f.filter((x) => x.data === '2031-05-01')).toHaveLength(1);
      expect(f.find((x) => x.data === '2031-05-01')).toMatchObject({ herdado: true });
      expect(f.find((x) => x.data === '2031-06-02')).toMatchObject({ descricao: 'Aniversário da seção', herdado: false });
    });
  });
});
