import { mesPorExtenso, somarMeses, type Cota } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let outraSecao: string;
let jes: string; // pjes
let peSeguro: string; // diária
let bioma: string; // diária
let pronto: string; // ordinário
let alheio: string; // serviço de outra seção
const atual = hojeRecife().slice(0, 7);
const anterior = somarMeses(atual, -1);
const secao = () => `/api/unidades/${api.ids.secao}`;
const lista = async (mes: string): Promise<Cota[]> => (await api.pedir('escalante', 'GET', `${secao()}/cotas?mes=${mes}`)).json();
const corpo = (servicoId: string, extra: Record<string, unknown> = {}) => ({ mes: atual, servicoId, quantidade: 10, origem: 'interna', prioridade: 1, ...extra });
async function criar(servicoId: string, extra: Record<string, unknown> = {}): Promise<Cota> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(servicoId, extra));
  expect(r.status).toBe(201);
  return r.json();
}
const servico = (unidade: string, nome: string, tipo: string, cor: string) => inserir(api.banco, 'servico', { unidade_id: unidade, nome, tipo, cor });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  jes = await servico(api.ids.secao, 'JES', 'pjes', '#6E56A8');
  peSeguro = await servico(api.ids.secao, 'PE Seguro', 'diaria', '#3C5F9C');
  bioma = await servico(api.ids.secao, 'Bioma', 'diaria', '#C08A1E');
  pronto = await servico(api.ids.secao, 'Pronto', 'ordinario', '#2F8F5B');
  alheio = await servico(outraSecao, 'Alheio', 'diaria', '#000000');
});
afterAll(async () => {
  await api.fechar();
});

describe('cotas', () => {
  it('cria e lista por prioridade, com o serviço, a cor e zero distribuídas', async () => {
    await criar(peSeguro, { prioridade: 2, quantidade: 12 });
    await criar(jes, { prioridade: 1, quantidade: 30 });
    const l = await lista(atual);
    expect(l.map((c) => c.servico)).toEqual(['JES', 'PE Seguro']);
    expect(l[0]).toMatchObject({ mes: atual, servicoId: jes, quantidade: 30, origem: 'interna', prioridade: 1, cor: '#6E56A8', distribuidas: 0 });
    expect(l[0]).not.toHaveProperty('contaMeta');
    expect(l[1]).toMatchObject({ servico: 'PE Seguro', quantidade: 12, cor: '#3C5F9C' });
  });

  it('a lista traz só o mês pedido (e o corrente quando o mês não vem)', async () => {
    await criar(bioma, { mes: anterior, quantidade: 5 });
    expect((await lista(anterior)).map((c) => c.servico)).toEqual(['Bioma']);
    expect((await lista(atual)).map((c) => c.servico)).not.toContain('Bioma');
    const sem = await (await api.pedir('escalante', 'GET', `${secao()}/cotas`)).json();
    expect(sem.map((c: Cota) => c.servico)).toEqual(['JES', 'PE Seguro']);
  });

  // [foco 3]
  it('cota de serviço ordinário é 409 com a mensagem do banco', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(pronto));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Cota só existe para serviço PJES ou diária');
    const c = await criar(bioma, { prioridade: 3 });
    const e = await api.pedir('escalante', 'PATCH', `/api/cotas/${c.id}`, { servicoId: pronto });
    expect(e.status).toBe(409);
  });

  it('a mesma cota (serviço e origem) duas vezes no mês é 409; origem diferente passa', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(bioma, { prioridade: 4 }));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe(`Já existe uma cota de Bioma (interna) em ${mesPorExtenso(atual)}.`);
    expect((await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(bioma, { origem: 'externa', prioridade: 4 }))).status).toBe(201);
  });

  it('um cliente antigo que ainda manda contaMeta é atendido, e o campo não volta na leitura', async () => {
    const c = await criar(jes, { mes: somarMeses(atual, 5), contaMeta: false });
    expect(c).not.toHaveProperty('contaMeta');
    const e = await api.pedir('escalante', 'PATCH', `/api/cotas/${c.id}`, { quantidade: 4, contaMeta: true });
    expect(e.status).toBe(200);
    expect(await e.json()).not.toHaveProperty('contaMeta');
  });

  it('editar quantidade, prioridade e origem', async () => {
    const c = await criar(peSeguro, { origem: 'externa', quantidade: 3, prioridade: 5 });
    const e = await api.pedir('escalante', 'PATCH', `/api/cotas/${c.id}`, { quantidade: 8, prioridade: 2 });
    expect(e.status).toBe(200);
    expect(await e.json()).toMatchObject({ quantidade: 8, prioridade: 2, origem: 'externa', servico: 'PE Seguro' });
    const igual = await api.pedir('escalante', 'PATCH', `/api/cotas/${c.id}`, { origem: 'interna' });
    expect(igual.status).toBe(409); // já existe a PE Seguro interna do mês
  });

  it('apagar a cota', async () => {
    const c = await criar(jes, { origem: 'externa', prioridade: 9 });
    expect((await api.pedir('escalante', 'DELETE', `/api/cotas/${c.id}`)).status).toBe(204);
    expect((await lista(atual)).find((x) => x.id === c.id)).toBeUndefined();
  });

  it('serviço de outra seção é 400 no campo servicoId', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(alheio));
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toEqual({ servicoId: 'Use um serviço cadastrado nesta seção.' });
  });

  it('quantidade e prioridade fora do limite são 400, nunca erro do banco', async () => {
    for (const ruim of [{ quantidade: 0 }, { quantidade: 99999999999 }, { prioridade: 0 }, { prioridade: 5000000000 }, { mes: '2026-13' }, { mes: '0000-05' }]) {
      const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, corpo(bioma, { origem: 'externa', ...ruim }));
      expect(r.status).toBe(400);
    }
  });

  it('o mês do ano 0000 é 400 ao listar e ao copiar', async () => {
    expect((await api.pedir('escalante', 'GET', `${secao()}/cotas?mes=0000-01`)).status).toBe(400);
    expect((await api.pedir('escalante', 'POST', `${secao()}/cotas/copiar`, { de: '0000-01', para: atual })).status).toBe(400);
  });

  it('copiar do mês anterior não duplica o que o mês já tem', async () => {
    const dest = somarMeses(atual, 3);
    await criar(jes, { mes: somarMeses(atual, 2), quantidade: 7, prioridade: 1 });
    await criar(peSeguro, { mes: somarMeses(atual, 2), quantidade: 4, prioridade: 2, origem: 'externa' });
    await criar(jes, { mes: dest, quantidade: 99, prioridade: 1 }); // já existe a JES interna no destino
    const r = await api.pedir('escalante', 'POST', `${secao()}/cotas/copiar`, { de: somarMeses(atual, 2), para: dest });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ copiados: 1 });
    const l = await lista(dest);
    expect(l.map((c) => [c.servico, c.origem, c.quantidade])).toEqual([['JES', 'interna', 99], ['PE Seguro', 'externa', 4]]);
    // copiar de novo não duplica
    expect(await (await api.pedir('escalante', 'POST', `${secao()}/cotas/copiar`, { de: somarMeses(atual, 2), para: dest })).json()).toEqual({ copiados: 0 });
  });

  it('distribuídas conta as alocações do serviço no mês, em escalas da seção, na ordem das cotas', async () => {
    const mes = somarMeses(atual, 5);
    const interna = await criar(peSeguro, { mes, quantidade: 2, prioridade: 1 });
    const externa = await criar(peSeguro, { mes, quantidade: 5, prioridade: 2, origem: 'externa' });
    const escala = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Escala PE', titulo: 'ESCALA', militares_doc: 'todos', dias_doc: 'todos' });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [escala, peSeguro]);
    const turno = await inserir(api.banco, 'turno', { servico_id: peSeguro, letra: 'A', inicio: '08:00', fim: '16:00' });
    const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-C', nome: 'Soldado C', ordem: 960 });
    for (const [i, dia] of ['01', '02', '03', '04'].entries()) {
      const militar = await inserir(api.banco, 'militar', { matricula: `99120${i}-${i}`, posto_grad_id: posto, nome_guerra: `COTA${i}` });
      await inserir(api.banco, 'alocacao', { militar_id: militar, escala_id: escala, servico_id: peSeguro, turno_id: turno, data: `${mes}-${dia}`, origem: 'manual' });
    }
    // uma alocação em outro mês não conta
    const fora = await inserir(api.banco, 'militar', { matricula: '991299-9', posto_grad_id: posto, nome_guerra: 'FORA' });
    await inserir(api.banco, 'alocacao', { militar_id: fora, escala_id: escala, servico_id: peSeguro, turno_id: turno, data: `${somarMeses(mes, 1)}-01`, origem: 'manual' });
    const l = await lista(mes);
    expect(l.find((c) => c.id === interna.id)!.distribuidas).toBe(2);
    expect(l.find((c) => c.id === externa.id)!.distribuidas).toBe(2);
  });

  it('sem papel na unidade: 403 em listar, criar, editar, apagar e copiar', async () => {
    const c = await criar(bioma, { mes: somarMeses(atual, 6), prioridade: 1 });
    expect((await api.pedir('semPapel', 'GET', `${secao()}/cotas?mes=${atual}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/cotas`, corpo(bioma, { mes: somarMeses(atual, 7) }))).status).toBe(403);
    expect((await api.pedir('semPapel', 'PATCH', `/api/cotas/${c.id}`, { quantidade: 1 })).status).toBe(403);
    expect((await api.pedir('semPapel', 'DELETE', `/api/cotas/${c.id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/cotas/copiar`, { de: atual, para: somarMeses(atual, 8) })).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/cotas`, corpo(alheio))).status).toBe(403);
  });

  it('cota inexistente é 404 antes de 403', async () => {
    const nada = '00000000-0000-0000-0000-000000000000';
    expect((await api.pedir('semPapel', 'PATCH', `/api/cotas/${nada}`, { quantidade: 1 })).status).toBe(404);
    expect((await api.pedir('semPapel', 'DELETE', `/api/cotas/${nada}`)).status).toBe(404);
  });

  it('quem grava deixa o próprio usuario_id na auditoria', async () => {
    const c = await criar(jes, { mes: somarMeses(atual, 9), prioridade: 1 });
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'cota' and registro_id = $1", [c.id]);
    expect(rows[0]?.usuario_id).toBe(api.usuarios.escalante);
  });
});

describe('copiar sem o índice único (antes da migração 0013 ser aplicada)', () => {
  it('copia do mesmo jeito, sem erro do banco', async () => {
    await api.banco.query('drop index cota_unica');
    try {
      const mes = somarMeses(atual, 20);
      await criar(jes, { mes, quantidade: 3, prioridade: 1 });
      const r = await api.pedir('escalante', 'POST', `${secao()}/cotas/copiar`, { de: mes, para: somarMeses(mes, 1) });
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ copiados: 1 });
    } finally {
      await api.banco.query('create unique index cota_unica on cota (unidade_id, mes, servico_id, origem)');
    }
  });
});

