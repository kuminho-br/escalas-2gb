import { mesPorExtenso, type Escala, type Servico } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Serviços, turnos, escalas e guarnições não são dados pessoais (D7); os nomes seguem a sandbox.
let api: ApiDeTeste;
let criacao: string;
const atual = hojeRecife().slice(0, 7);
const CAB_T = ['SERVIÇO', 'TURNO', 'HORÁRIO INÍCIO', 'HORÁRIO FIM', 'DURAÇÃO', 'TIPO DE SERVIÇO', 'ORIGEM'];
const CAB_E = ['ESCALA', 'SERVIÇOS', 'TÍTULO', 'MILITARES', 'DIAS'];
const CAB_V = ['VIGÊNCIA (A PARTIR DE)', 'ESCALA', 'TURNO', 'GUARNIÇÃO'];
type Celula = string | number | Date | null;
type Abas = { t?: Celula[][]; e?: Celula[][]; v?: Celula[][]; cabV?: string[] };
const hora = (h: number) => new Date(Date.UTC(1899, 11, 30, h, 0, 0));

const TURNOS: Celula[][] = [
  ['Pronto', 'A', '08:00', '20:00', 12, 'Ordinário', ''],
  ['Pronto', 'B', '20:00', '08:00', 12, 'Ordinário', ''],
  ['JES', 'A', '08:00', '20:00', 12, 'PJES', 'PJES'],
  ['Expediente', 'Único', '8:00', '16:00', 8, '', ''],
  ['Defensoria', 'U', hora(7), hora(19), 12, 'PJES', ''],
  ['Bioma', 'C', '16:00', '24:00', 8, 'Diária', ''],
];
const ESCALAS: Celula[][] = [
  ['Ordinário', 'Pronto, JES', 'ESCALA ORDINÁRIA', 'TODOS', 'TODOS'],
  ['Ordinário', 'Expediente', '', '', ''],
  ['Defensoria', '', '', '', 'SÓ ESCALADOS'],
];

const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
async function importar(abas: Abas, confirmar = false) {
  const arquivo = await planilha({
    TURNOS: [CAB_T, ...(abas.t ?? TURNOS)],
    ESCALAS: [CAB_E, ...(abas.e ?? ESCALAS)],
    'GUARNIÇÕES POR ESCALA': [abas.cabV ?? CAB_V, ...(abas.v ?? [])],
  });
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/servicos-escalas${confirmar ? '?confirmar=1' : ''}`, formulario(arquivo));
  expect(r.status).toBe(200);
  return r.json();
}
async function servico(nome: string): Promise<Servico> {
  const lista: Servico[] = await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/servicos`)).json();
  return lista.find((s) => s.nome === nome)!;
}
async function escala(nome: string): Promise<Escala> {
  const id = (await api.banco.query<{ id: string }>('select id from escala where unidade_id = $1 and nome = $2', [api.ids.secao, nome])).rows[0]!.id;
  return (await api.pedir('escalante', 'GET', `/api/escalas/${id}`)).json();
}
async function guarnicao(nome: string, ativa = true) {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/guarnicoes`, {
    nome, vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa, composicao: [] },
  });
  expect(r.status).toBe(201);
}

beforeAll(async () => {
  api = await montarApi();
  criacao = (await api.banco.query<{ mes: string }>("select to_char(desde, 'YYYY-MM') as mes from unidade where id = $1", [api.ids.secao])).rows[0]!.mes;
  await guarnicao('ABT');
  await guarnicao('AR', false);
});
afterAll(async () => {
  await api.fechar();
});

describe('importação de serviços, turnos e escalas', () => {
  it('importa serviços e turnos com cor, tipo e rótulo de impressão', async () => {
    const previa = await importar({});
    expect(previa.problemas).toEqual([]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(
      expect.arrayContaining(['Serviço Pronto', 'Serviço JES', 'Serviço Expediente', 'Serviço Defensoria', 'Serviço Bioma', 'Escala Ordinário', 'Escala Defensoria']),
    );
    await importar({}, true);
    expect(await servico('Pronto')).toMatchObject({ tipo: 'ordinario', cor: '#2F8F5B', rotuloImpressao: null, turnos: [{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }] });
    expect(await servico('JES')).toMatchObject({ tipo: 'pjes', cor: '#6E56A8', rotuloImpressao: 'PJES' });
    expect(await servico('Expediente')).toMatchObject({ tipo: 'ordinario', cor: '#8A94A1', turnos: [{ letra: 'U', inicio: '08:00', fim: '16:00' }] });
    expect(await servico('Bioma')).toMatchObject({ tipo: 'diaria', operacao: null, turnos: [{ letra: 'C', inicio: '16:00', fim: '00:00', duracaoMinutos: 480 }] });
  });

  it('hora como texto e como hora do Excel', async () => {
    expect((await servico('Expediente')).turnos[0]).toMatchObject({ inicio: '08:00' });
    expect((await servico('Defensoria')).turnos[0]).toMatchObject({ inicio: '07:00', fim: '19:00' });
  });

  it('escala da sandbox: SÓ ESCALADOS, MILITARES vazio e TÍTULO vazio', async () => {
    expect(await escala('Defensoria')).toMatchObject({ titulo: 'ESCALA DEFENSORIA', militaresDoc: 'escalados', diasDoc: 'com_escalados', servicos: [{ nome: 'Defensoria' }] });
  });

  it('escala reúne serviços na ordem, em várias linhas', async () => {
    const e = await escala('Ordinário');
    expect(e).toMatchObject({ titulo: 'ESCALA ORDINÁRIA', militaresDoc: 'todos', diasDoc: 'todos' });
    expect(e.servicos.map((s) => s.nome)).toEqual(['Pronto', 'JES', 'Expediente']);
    expect(e.letras).toEqual(['A', 'B', 'U']);
  });

  it('serviço que já existe mantém a cor', async () => {
    const s = await servico('Pronto');
    await api.pedir('escalante', 'PATCH', `/api/servicos/${s.id}`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#123456' });
    const previa = await importar({});
    expect(previa.alterados).toEqual([]);
    expect((await servico('Pronto')).cor).toBe('#123456');
  });

  it('turno com letra inválida e horário inválido viram problemas com a solução', async () => {
    const previa = await importar({ t: [...TURNOS, ['Pronto', 'D', '08:00', '20:00', 12, '', ''], ['JES', 'B', '25:00', '08:00', 12, '', '']] });
    expect(previa.problemas).toEqual(
      expect.arrayContaining([
        { aba: 'TURNOS', linha: 8, mensagem: 'Turno "D" de Pronto', solucao: 'Use A, B, C ou U na coluna TURNO.' },
        { aba: 'TURNOS', linha: 9, mensagem: 'Horário "25:00" de JES B', solucao: 'Use HH:MM (ex.: 08:00).' },
      ]),
    );
  });

  it('serviço desconhecido descarta a escala com a solução', async () => {
    const previa = await importar({ e: [...ESCALAS, ['CPRH', 'CPRH', '', '', '']] });
    expect(previa.problemas).toContainEqual({ aba: 'ESCALAS', linha: 5, mensagem: 'Escala CPRH: o serviço CPRH não existe', solucao: 'Cadastre o serviço na aba TURNOS ou corrija o nome em SERVIÇOS.' });
    expect(previa.novos.map((n: { chave: string }) => n.chave)).not.toContain('Escala CPRH');
  });

  it('vínculo com guarnição desconhecida vira problema com a solução', async () => {
    const previa = await importar({ v: [['', 'Ordinário', 'A', 'Fantasma']] });
    expect(criacao <= atual).toBe(true);
    expect(previa.problemas).toContainEqual({ aba: 'GUARNIÇÕES POR ESCALA', linha: 2, mensagem: 'Guarnição Fantasma não cadastrada', solucao: 'Importe a aba GUARNIÇÕES (tela de Guarnições) e depois esta.' });
  });

  it('turno fora da escala e escala desconhecida viram problemas', async () => {
    const previa = await importar({ v: [['', 'Ordinário', 'C', 'ABT'], ['', 'Inexistente', 'A', 'ABT']] });
    expect(previa.problemas).toEqual(
      expect.arrayContaining([
        { aba: 'GUARNIÇÕES POR ESCALA', linha: 2, mensagem: 'Turno C não existe nos serviços da escala Ordinário', solucao: 'Confira a coluna TURNO ou os SERVIÇOS da escala.' },
        { aba: 'GUARNIÇÕES POR ESCALA', linha: 3, mensagem: 'Escala Inexistente não cadastrada', solucao: 'Confira a aba ESCALAS.' },
      ]),
    );
  });

  it('TURNO vazio ou TODOS vira todos os turnos, e guarnição desativada entra com aviso', async () => {
    const v = [[atual, 'Ordinário', '', 'ABT'], [atual, 'Defensoria', 'TODOS', 'AR'], [atual, 'Ordinário', 'B', 'AR']];
    const previa = await importar({ v });
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos).toContain(`AR está desativada em ${mesPorExtenso(atual)}; o vínculo fica gravado.`);
    await importar({ v }, true);
    const ord = await escala('Ordinário');
    expect(ord.vinculos).toHaveLength(1);
    expect(ord.vinculos[0]).toMatchObject({ vigencia: atual });
    expect(ord.vinculos[0]!.itens.map((i) => [i.guarnicao, i.turnoLetra])).toEqual([['ABT', null], ['AR', 'B']]);
    expect((await escala('Defensoria')).vinculos[0]!.itens).toEqual([expect.objectContaining({ guarnicao: 'AR', turnoLetra: null })]);
  });

  it('falta a coluna GUARNIÇÃO: problema e nada planejado', async () => {
    const previa = await importar({ cabV: ['VIGÊNCIA', 'ESCALA', 'TURNO'], v: [['', 'Ordinário', 'A']] });
    expect(previa.problemas).toEqual([{ aba: 'GUARNIÇÕES POR ESCALA', linha: 1, mensagem: 'Falta a coluna GUARNIÇÃO.', solucao: 'Use o modelo desta tela.' }]);
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
  });

  it('importar duas vezes não grava nada (nem auditoria)', async () => {
    const v = [[atual, 'Ordinário', '', 'ABT'], [atual, 'Defensoria', 'TODOS', 'AR'], [atual, 'Ordinário', 'B', 'AR']];
    await importar({ v }, true);
    const antes = await auditoria();
    const previa = await importar({ v });
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBeGreaterThan(0);
    const r = await importar({ v }, true);
    expect(r.gravados).toBe(0);
    expect(await auditoria()).toBe(antes);
  });

  it('mudança de horário aparece como alterado', async () => {
    const t = TURNOS.map((l) => (l[0] === 'JES' ? ['JES', 'A', '07:00', '19:00', 12, 'PJES', 'PJES'] : l));
    const previa = await importar({ t });
    expect(previa.alterados).toEqual([{ chave: 'Serviço JES', descricao: 'JES', mudancas: ['Turno A: de 08:00–20:00 para 07:00–19:00'] }]);
  });
});
