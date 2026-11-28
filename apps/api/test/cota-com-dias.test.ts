import { mesPorExtenso, type Cota, type EscalaDoMes, type PainelDoDia } from 'contratos';
import { diasDoMes } from 'dominio';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';

// 6.72: a cota com dias e a cota esgotada que bloqueia. Cenário fictício: uma seção com Pronto (ordinário), JES (PJES, A 08h–20h) e Bioma (diária, A 08h–20h),
// numa escala só, e militares 100xxx-x (voluntários JES) lotados na seção.
let api: ApiDeTeste;
let escalaId: string;
const servico: Record<string, { id: string; turno: string }> = {};
const atual = hojeRecife().slice(0, 7);
let uteis: string[] = []; // os dias do mês a usar (dia(0) é o dia 3)
const dia = (n: number) => uteis[n]!;
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
let seq = 0;
const secao = () => `/api/unidades/${api.ids.secao}`;

async function criar(nome: string): Promise<string> {
  seq++;
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: `100${String(800 + seq).padStart(3, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, voluntario_jes: true, de_teste: true });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, jornada: 'pronto', desde: `${atual}-01`, situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
  return id;
}
const escalarNo = (militarId: string, nome: string, data: string) =>
  api.pedir('escalante', 'POST', `/api/escalas/${escalaId}/alocacoes`, { militarId, data, turnoId: servico[nome]!.turno, guarnicaoId: null, funcaoId: null });
const criarCota = async (nome: string, quantidade: number, prioridade = 1): Promise<Cota> => {
  const r = await api.pedir('escalante', 'POST', `${secao()}/cotas`, { mes: atual, servicoId: servico[nome]!.id, quantidade, prioridade });
  expect(r.status).toBe(201);
  return r.json();
};
const trocarDias = (cotaId: string, dias: { data: string; minimo: number; maximo?: number | null }[]) =>
  api.pedir('escalante', 'PUT', `/api/cotas/${cotaId}/dias`, { dias: dias.map((d) => ({ maximo: null, ...d })) });
const lista = async (): Promise<Cota[]> => (await api.pedir('escalante', 'GET', `${secao()}/cotas?mes=${atual}`)).json();
const painel = async (militarId: string, data: string): Promise<PainelDoDia> => (await api.pedir('escalante', 'GET', `${secao()}/grade/${atual}/militares/${militarId}/dias/${data}`)).json();
const nomesDasOpcoes = (p: PainelDoDia) => [...new Set(p.opcoes.flatMap((o) => o.servicos.map((s) => s.nome)))].sort();

beforeAll(async () => {
  api = await montarApi();
  // a cota não depende do dia da semana: valem todos os dias do mês, do dia 3 em diante
  uteis = diasDoMes(atual).filter((d) => d > `${atual}-02`);
  expect(uteis.length).toBeGreaterThan(24);
  for (const [nome, tipo] of [['Pronto', 'ordinario'], ['JES', 'pjes'], ['Bioma', 'diaria'], ['Saldo', 'ordinario']] as const) {
    const id = ((await (await api.pedir('admin', 'POST', `${secao()}/servicos`, { nome, tipo, operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string }).id;
    const turno = (await (await api.pedir('admin', 'POST', `/api/servicos/${id}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' })).json()).turnos[0].id as string;
    servico[nome] = { id, turno };
  }
  escalaId = ((await (await api.pedir('admin', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()) as { id: string }).id;
  expect((await api.pedir('admin', 'PUT', `/api/escalas/${escalaId}/servicos`, { servicoIds: ['Pronto', 'JES', 'Bioma', 'Saldo'].map((n) => servico[n]!.id) })).status).toBe(200);
});
beforeEach(async () => {
  // cada teste parte de um mês sem nada escalado: a contagem da cota é a das alocações do serviço no mês
  await api.banco.query('delete from alocacao where escala_id = $1', [escalaId]);
});
afterAll(async () => {
  await api.fechar();
});

describe('os dias da cota (PUT /api/cotas/:id/dias)', () => {
  it('grava a lista, devolve a cota com os dias em ordem de data e a lista de cotas os traz', async () => {
    const cota = await criarCota('JES', 10);
    expect(cota).toMatchObject({ quantidade: 10, dias: [] });
    expect(cota).not.toHaveProperty('origem');
    const r = await trocarDias(cota.id, [{ data: dia(5), minimo: 2 }, { data: dia(3), minimo: 1, maximo: 3 }]);
    expect(r.status).toBe(200);
    const depois = (await r.json()) as Cota;
    expect(depois.dias).toEqual([{ data: dia(3), minimo: 1, maximo: 3 }, { data: dia(5), minimo: 2, maximo: null }]);
    expect((await lista()).find((c) => c.id === cota.id)!.dias).toEqual(depois.dias);
    // a lista nova troca a antiga inteira; vazia, limpa
    expect(((await (await trocarDias(cota.id, [{ data: dia(7), minimo: 4 }])).json()) as Cota).dias).toEqual([{ data: dia(7), minimo: 4, maximo: null }]);
    expect(((await (await trocarDias(cota.id, [])).json()) as Cota).dias).toEqual([]);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('a soma das metas acima da cota é 400 com a frase; o dia de outro mês e o máximo menor que a meta também; nada muda', async () => {
    const cota = await criarCota('Bioma', 5);
    await trocarDias(cota.id, [{ data: dia(3), minimo: 1 }]);
    const soma = await trocarDias(cota.id, [{ data: dia(4), minimo: 3 }, { data: dia(5), minimo: 3 }]);
    expect(soma.status).toBe(400);
    expect((await soma.json()).erro).toBe('A soma das metas dos dias passa da cota do mês.');
    const outroMes = await trocarDias(cota.id, [{ data: '2030-01-10', minimo: 1 }]);
    expect(outroMes.status).toBe(400);
    expect((await outroMes.json()).erro).toBe('O dia precisa ser do mês da cota.');
    const maximo = await trocarDias(cota.id, [{ data: dia(6), minimo: 3, maximo: 2 }]);
    expect(maximo.status).toBe(400);
    expect((await maximo.json()).erro).toBe('O máximo não pode ser menor que a meta.');
    expect((await lista()).find((c) => c.id === cota.id)!.dias).toEqual([{ data: dia(3), minimo: 1, maximo: null }]);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('o mesmo dia duas vezes, a meta zero e o corpo sem lista são 400; sem nível de acesso é 403; a cota que não existe é 404', async () => {
    const cota = await criarCota('Bioma', 5);
    expect((await trocarDias(cota.id, [{ data: dia(3), minimo: 1 }, { data: dia(3), minimo: 2 }])).status).toBe(400);
    expect((await trocarDias(cota.id, [{ data: dia(3), minimo: 0 }])).status).toBe(400);
    expect((await api.pedir('escalante', 'PUT', `/api/cotas/${cota.id}/dias`, {})).status).toBe(400);
    expect((await api.pedir('semPapel', 'PUT', `/api/cotas/${cota.id}/dias`, { dias: [] })).status).toBe(403);
    expect((await trocarDias('00000000-0000-4000-8000-000000000999', [])).status).toBe(404);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('copiar do mês anterior leva a cota e deixa os dias de fora (os dias são do mês)', async () => {
    const cota = await criarCota('JES', 6);
    await trocarDias(cota.id, [{ data: dia(3), minimo: 2 }]);
    const proximo = mesSeguinte(atual);
    const r = await api.pedir('escalante', 'POST', `${secao()}/cotas/copiar`, { de: atual, para: proximo });
    expect(r.status).toBe(200);
    const copiadas = (await (await api.pedir('escalante', 'GET', `${secao()}/cotas?mes=${proximo}`)).json()) as Cota[];
    expect(copiadas.find((c) => c.servicoId === servico.JES!.id)).toMatchObject({ quantidade: 6, dias: [] });
    await api.banco.query('delete from cota where mes = $1::date', [`${proximo}-01`]);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });
});

function mesSeguinte(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

describe('a cota esgotada bloqueia escalar (6.72)', () => {
  it('com a cota cheia o próximo é 409 com a frase do total; remover continua passando; sem a cota (ou com mais vagas) escala de novo', async () => {
    const cota = await criarCota('JES', 2);
    const [a, b, c] = [await criar('COTA1'), await criar('COTA2'), await criar('COTA3')];
    const da = await escalarNo(a, 'JES', dia(8));
    expect(da.status).toBe(201);
    expect((await escalarNo(b, 'JES', dia(9))).status).toBe(201);
    const cheia = await escalarNo(c, 'JES', dia(10));
    expect(cheia.status).toBe(409);
    expect((await cheia.json()).erro).toBe(`A cota de JES em ${mesPorExtenso(atual)} acabou. Para escalar mais, aumente a cota na tela Cotas.`);
    // remover nunca é bloqueado, e libera a vaga da cota
    const alocacao = (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date', [a, dia(8)])).rows[0]!.id;
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${alocacao}`)).status).toBe(200);
    expect((await escalarNo(c, 'JES', dia(10))).status).toBe(201);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('Review Focus 4: a cota reduzida abaixo do que já foi escalado: editar passa, remover passa, só escalar mais é recusado', async () => {
    const cota = await criarCota('Bioma', 3);
    const [a, b] = [await criar('REDUZ1'), await criar('REDUZ2')];
    expect((await escalarNo(a, 'Bioma', dia(11))).status).toBe(201);
    expect((await escalarNo(b, 'Bioma', dia(12))).status).toBe(201);
    const reduzida = await api.pedir('escalante', 'PATCH', `/api/cotas/${cota.id}`, { quantidade: 1 });
    expect(reduzida.status).toBe(200);
    expect(await reduzida.json()).toMatchObject({ quantidade: 1, distribuidas: 2 });
    expect((await escalarNo(await criar('REDUZ3'), 'Bioma', dia(13))).status).toBe(409);
    const alocacao = (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date', [a, dia(11)])).rows[0]!.id;
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${alocacao}`)).status).toBe(200);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('o máximo do dia: o dia com máximo 1 recusa o segundo, com a frase do dia; os outros dias seguem', async () => {
    const cota = await criarCota('JES', 6);
    await trocarDias(cota.id, [{ data: dia(14), minimo: 1, maximo: 1 }]);
    const [a, b, c] = [await criar('MAX1'), await criar('MAX2'), await criar('MAX3')];
    expect((await escalarNo(a, 'JES', dia(14))).status).toBe(201);
    const segundo = await escalarNo(b, 'JES', dia(14));
    expect(segundo.status).toBe(409);
    expect((await segundo.json()).erro).toBe(`JES já tem o máximo da cota em ${diaMes(dia(14))}.`);
    expect((await escalarNo(c, 'JES', dia(15))).status).toBe(201);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('a reserva: o que resta está guardado para os dias com meta; escalar no próprio dia da meta passa', async () => {
    const cota = await criarCota('JES', 3);
    await trocarDias(cota.id, [{ data: dia(16), minimo: 2 }]);
    const [a, b, c] = [await criar('RES1'), await criar('RES2'), await criar('RES3')];
    // total 3, meta de 2 no dia 16: sobra 1 para os outros dias
    expect((await escalarNo(a, 'JES', dia(17))).status).toBe(201);
    const reservada = await escalarNo(b, 'JES', dia(18));
    expect(reservada.status).toBe(409);
    expect((await reservada.json()).erro).toBe('O que resta da cota de JES está reservado para os dias com meta. Para escalar mais, aumente a cota na tela Cotas.');
    expect((await escalarNo(b, 'JES', dia(16))).status).toBe(201);
    expect((await escalarNo(c, 'JES', dia(16))).status).toBe(201);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('serviço sem nenhuma cota no mês não é conferido (a cota só limita onde existe), e o ordinário nunca depende dela', async () => {
    const x = await criar('SEMCOTA');
    expect((await escalarNo(x, 'Bioma', dia(19))).status).toBe(201);
    const pronto = await escalarNo(x, 'Pronto', dia(20));
    expect({ status: pronto.status, corpo: pronto.status === 201 ? null : await pronto.json() }).toEqual({ status: 201, corpo: null });
  });
});

describe('"Adicionar serviço" e a cota (6.72)', () => {
  it('só mostra serviço PJES ou diária com cota no mês que aceita o dia; Pronto e Saldo continuam, sem cota nenhuma (Review Focus 5)', async () => {
    const adm = await criar('OPCOES');
    await api.banco.query("update rastreio set jornada = 'adm' where militar_id = $1", [adm]);
    // sem cota nenhuma: só os ordinários
    expect(nomesDasOpcoes(await painel(adm, dia(2)))).toEqual(['Pronto', 'Saldo']);
    const cota = await criarCota('JES', 1);
    const bioma = await criarCota('Bioma', 5);
    expect(nomesDasOpcoes(await painel(adm, dia(2)))).toEqual(['Bioma', 'JES', 'Pronto', 'Saldo']);
    // o dia do máximo batido esconde só o serviço dele
    await trocarDias(bioma.id, [{ data: dia(2), minimo: 1, maximo: 1 }]);
    await escalarNo(await criar('OCUPA'), 'Bioma', dia(2));
    expect(nomesDasOpcoes(await painel(adm, dia(2)))).toEqual(['JES', 'Pronto', 'Saldo']);
    // a cota esgotada some da lista
    await escalarNo(await criar('GASTA'), 'JES', dia(4));
    expect(nomesDasOpcoes(await painel(adm, dia(2)))).toEqual(['Pronto', 'Saldo']);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${bioma.id}`);
  });
});

describe('revisão do Opus (6.72)', () => {
  it('baixar a quantidade da cota abaixo da soma das metas dos dias é 400 com a frase; acima dela passa', async () => {
    const cota = await criarCota('Bioma', 10);
    await trocarDias(cota.id, [{ data: dia(3), minimo: 4 }, { data: dia(4), minimo: 4 }]);
    const baixa = await api.pedir('escalante', 'PATCH', `/api/cotas/${cota.id}`, { quantidade: 5 });
    expect(baixa.status).toBe(400);
    expect((await baixa.json()).erro).toBe('A soma das metas dos dias passa da cota do mês.');
    expect((await api.pedir('escalante', 'PATCH', `/api/cotas/${cota.id}`, { quantidade: 8 })).status).toBe(200);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });

  it('a troca de militar não é bloqueada quando a cota foi reduzida abaixo do que já estava escalado', async () => {
    const cota = await criarCota('Bioma', 3);
    const [a, b, c] = [await criar('TROCA1'), await criar('TROCA2'), await criar('TROCA3')];
    expect((await escalarNo(a, 'Bioma', dia(5))).status).toBe(201);
    expect((await escalarNo(b, 'Bioma', dia(6))).status).toBe(201);
    expect((await api.pedir('escalante', 'PATCH', `/api/cotas/${cota.id}`, { quantidade: 1 })).status).toBe(200);
    const alocacao = (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date', [a, dia(5)])).rows[0]!.id;
    const troca = await api.pedir('escalante', 'POST', `/api/alocacoes/${alocacao}/trocar`, { militarId: c, turnoId: servico.Bioma!.turno, justificativa: 'teste' });
    expect(troca.status).toBeLessThan(300);
    expect((await api.banco.query('select 1 from alocacao where militar_id = $1 and data = $2::date', [c, dia(5)])).rows).toHaveLength(1);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });
});

describe('o aviso do dia abaixo da meta na Escala do mês (6.72)', () => {
  it('o dia com meta e menos escalados traz o aviso; o dia que cumpriu não; e fechar a escala continua possível', async () => {
    const cota = await criarCota('JES', 20);
    await trocarDias(cota.id, [{ data: dia(21), minimo: 3 }, { data: dia(22), minimo: 1 }]);
    await escalarNo(await criar('META1'), 'JES', dia(21));
    await escalarNo(await criar('META2'), 'JES', dia(22));
    const leitura = await api.pedir('escalante', 'GET', `/api/escalas/${escalaId}/mes/${atual}`);
    expect(leitura.status).toBe(200);
    const escala = (await leitura.json()) as EscalaDoMes;
    const diaDe = (d: string) => escala.dias.find((x) => x.data === d)!;
    expect(diaDe(dia(21)).metasAbaixo).toEqual([{ servico: 'JES', minimo: 3, escalados: 1 }]);
    expect(diaDe(dia(22)).metasAbaixo).toEqual([]);
    expect(diaDe(dia(3)).metasAbaixo).toEqual([]);
    // fechar a escala (publicar) não é bloqueado pela meta
    const publicada = await api.pedir('gestorGb', 'POST', `/api/escalas/${escalaId}/mes/${atual}/publicar`);
    expect(publicada.status).toBeLessThan(300);
    await api.pedir('escalante', 'DELETE', `/api/cotas/${cota.id}`);
  });
});
