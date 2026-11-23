import { mesPorExtenso, somarMeses, type Escala, type Servico } from 'contratos';
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
    expect(await servico('Expediente')).toMatchObject({ tipo: 'ordinario', cor: '#8A94A1', turnos: [{ letra: 'A', inicio: '08:00', fim: '16:00' }] });
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
    expect(e.faixas.map((f) => `${f.inicio}-${f.fim}`)).toEqual(['08:00-16:00', '08:00-20:00', '20:00-08:00']);
    expect(e.comLetra).toBe(false);
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
        { aba: 'TURNOS', linha: 8, mensagem: 'Turno "D" de Pronto', solucao: 'Use A, B ou C na coluna TURNO.' },
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

  it('TURNO vazio ou TODOS vira todas as faixas da escala, e guarnição desativada entra com aviso', async () => {
    const v = [[atual, 'Ordinário', '', 'ABT'], [atual, 'Defensoria', 'TODOS', 'AR'], [atual, 'Ordinário', 'B', 'AR']];
    const previa = await importar({ v });
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos).toContain(`AR está desativada em ${mesPorExtenso(atual)}; o vínculo fica gravado.`);
    await importar({ v }, true);
    const ord = await escala('Ordinário');
    expect(ord.vinculos).toHaveLength(1);
    expect(ord.vinculos[0]).toMatchObject({ vigencia: atual });
    expect(ord.vinculos[0]!.itens.map((i) => [i.guarnicao, `${i.inicio}-${i.fim}`])).toEqual([
      ['ABT', '08:00-16:00'], ['ABT', '08:00-20:00'], ['ABT', '20:00-08:00'], ['AR', '20:00-08:00'],
    ]);
    expect((await escala('Defensoria')).vinculos[0]!.itens).toEqual([expect.objectContaining({ guarnicao: 'AR', inicio: '07:00', fim: '19:00' })]);
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
  it('TODOS junto com uma letra repete a faixa, e a repetição é ignorada com aviso', async () => {
    const v = [[atual, 'Defensoria', 'TODOS', 'ABT'], [atual, 'Defensoria', 'U', 'ABT']];
    const previa = await importar({ v });
    expect(previa.avisos).toContain(`Defensoria: ABT já está na faixa 07h–19h em ${mesPorExtenso(atual)}; a repetição foi ignorada.`);
    await importar({ v }, true);
    expect((await escala('Defensoria')).vinculos[0]!.itens.filter((i) => i.guarnicao === 'ABT')).toHaveLength(1);
  });

  it('letra ambígua vira problema com a solução de escrever a faixa', async () => {
    const previa = await importar({ v: [[atual, 'Ordinário', 'A', 'ABT']] });
    expect(previa.problemas).toContainEqual({
      aba: 'GUARNIÇÕES POR ESCALA', linha: 2,
      mensagem: 'Turno A tem horários diferentes nos serviços da escala Ordinário (08h–16h, 08h–20h)',
      solucao: 'Escreva a faixa na coluna TURNO (ex.: 08:00-20:00).',
    });
  });

  it('faixa escrita na célula é aceita', async () => {
    const v = [[atual, 'Ordinário', '08:00-20:00', 'ABT'], [atual, 'Ordinário', '20h às 08h', 'AR']];
    const previa = await importar({ v });
    expect(previa.problemas).toEqual([]);
    await importar({ v }, true);
    expect((await escala('Ordinário')).vinculos[0]!.itens.map((i) => [i.guarnicao, `${i.inicio}-${i.fim}`])).toEqual([['ABT', '08:00-20:00'], ['AR', '20:00-08:00']]);
  });

  it.each(['08 as 20', '08-20', '08h às 20h', '8 a 20', '08:00 – 20:00', '8h as 20h'])('TURNO %j vira a faixa das 08h às 20h', async (celula) => {
    const previa = await importar({ v: [[atual, 'Ordinário', celula, 'ABT']] });
    expect(previa.problemas).toEqual([]);
  });

  it('TURNO com horário que não existe ou sem sentido vira problema de horário', async () => {
    const previa = await importar({ v: [[atual, 'Ordinário', '08:00-25:00', 'ABT'], [atual, 'Ordinário', '08 até 20 horas', 'AR']] });
    expect(previa.problemas).toEqual([
      { aba: 'GUARNIÇÕES POR ESCALA', linha: 2, mensagem: 'Horário "08:00-25:00" de Ordinário', solucao: 'Escreva a faixa como 08:00-20:00.' },
      { aba: 'GUARNIÇÕES POR ESCALA', linha: 3, mensagem: 'Horário "08 até 20 horas" de Ordinário', solucao: 'Escreva a faixa como 08:00-20:00.' },
    ]);
  });

  it('DIAS COM ESCALADOS e SÓ ESCALADOS viram só os dias com escalados', async () => {
    const e = [...ESCALAS, ['Dias Com', 'Pronto', '', '', 'COM ESCALADOS'], ['Dias Só', 'Pronto', '', '', 'SÓ ESCALADOS'], ['Dias Todos', 'Pronto', '', '', 'TODOS']];
    await importar({ e }, true);
    expect((await escala('Dias Com')).diasDoc).toBe('com_escalados');
    expect((await escala('Dias Só')).diasDoc).toBe('com_escalados');
    expect((await escala('Dias Todos')).diasDoc).toBe('todos');
  });

  it('vínculo de escala que ficou de fora diz por quê', async () => {
    const previa = await importar({ e: [...ESCALAS, ['CPRH', 'CPRH', '', '', '']], v: [['', 'CPRH', 'A', 'ABT'], ['', 'Inexistente', 'A', 'ABT']] });
    expect(previa.problemas).toContainEqual({ aba: 'GUARNIÇÕES POR ESCALA', linha: 2, mensagem: 'Escala CPRH ficou de fora', solucao: 'Resolva o problema dessa escala na aba ESCALAS.' });
    expect(previa.problemas).toContainEqual({ aba: 'GUARNIÇÕES POR ESCALA', linha: 3, mensagem: 'Escala Inexistente não cadastrada', solucao: 'Confira a aba ESCALAS.' });
  });

  it('tipo de serviço desconhecido avisa, e vale o que o nome ou o sistema dizem', async () => {
    const previa = await importar({ t: [...TURNOS, ['Saldo', 'A', '08:00', '20:00', 12, 'XYZ', ''], ['Operação Nova', 'A', '08:00', '20:00', 12, 'XYZ', '']] });
    expect(previa.avisos).toContain('Serviço Saldo: TIPO DE SERVIÇO "XYZ" não reconhecido; vale Ordinário.');
    expect(previa.avisos).toContain('Serviço Operação Nova: TIPO DE SERVIÇO "XYZ" não reconhecido; vale Diária.');
  });

  it('faixa que não existe vira problema', async () => {
    const previa = await importar({ v: [[atual, 'Ordinário', '09:00-21:00', 'ABT']] });
    expect(previa.problemas).toContainEqual({
      aba: 'GUARNIÇÕES POR ESCALA', linha: 2,
      mensagem: 'Faixa 09h–21h não existe nos serviços da escala Ordinário',
      solucao: 'Confira a coluna TURNO ou os horários na aba TURNOS.',
    });
  });

  it('TURNO com várias letras vira um vínculo por faixa', async () => {
    const e = [...ESCALAS, ['Plantão', 'Pronto', '', '', '']];
    const v = [[atual, 'Plantão', 'A, B', 'ABT'], [atual, 'Plantão', 'B', 'AR']];
    const previa = await importar({ e, v });
    expect(previa.problemas).toEqual([]);
    await importar({ e, v }, true);
    expect((await escala('Plantão')).vinculos[0]!.itens.map((i) => [i.guarnicao, `${i.inicio}-${i.fim}`])).toEqual([
      ['ABT', '08:00-20:00'], ['ABT', '20:00-08:00'], ['AR', '20:00-08:00'],
    ]);
  });

  // [foco 17]
  it('reimportar com TURNO vazio dá igual', async () => {
    const v = [[atual, 'Defensoria', '', 'ABT']];
    await importar({ v }, true);
    const antes = await auditoria();
    const previa = await importar({ v });
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
    expect((await importar({ v }, true)).gravados).toBe(0);
    expect(await auditoria()).toBe(antes);
  });

  it('revisão: tipo na prévia aparece por extenso', async () => {
    const t = TURNOS.map((l) => (l[0] === 'Bioma' ? ['Bioma', 'C', '16:00', '24:00', 8, 'PJES', ''] : l));
    const previa = await importar({ t });
    expect(previa.alterados).toContainEqual({ chave: 'Serviço Bioma', descricao: 'Bioma', mudancas: ['Tipo: de Diária para PJES'] });
  });

  it('revisão: serviço só com linhas de problema não é criado e a escala dele é descartada', async () => {
    const previa = await importar({ t: [...TURNOS, ['CPRH', 'D', '08:00', '20:00', 12, '', '']], e: [...ESCALAS, ['CPRH', 'CPRH', '', '', '']] });
    expect(previa.novos.map((n: { chave: string }) => n.chave)).not.toContain('Serviço CPRH');
    expect(previa.problemas).toContainEqual(expect.objectContaining({ aba: 'ESCALAS', mensagem: 'Escala CPRH: o serviço CPRH não existe' }));
  });

  it('revisão: textos maiores que o limite da tela viram problema', async () => {
    const longo = 'X'.repeat(130);
    const previa = await importar({ t: [...TURNOS, [longo, 'A', '08:00', '20:00', 12, 'Diária', ''], ['Saldo', 'A', '08:00', '20:00', 12, 'Ordinário', 'O'.repeat(61)]], e: [...ESCALAS, [longo, 'Pronto', '', '', '']] });
    expect(previa.problemas).toEqual(
      expect.arrayContaining([
        { aba: 'TURNOS', linha: 8, mensagem: `Serviço "${longo.slice(0, 30)}…" tem mais de 120 caracteres`, solucao: 'Encurte o nome na coluna SERVIÇO.' },
        { aba: 'TURNOS', linha: 9, mensagem: 'ORIGEM de Saldo tem mais de 60 caracteres', solucao: 'Encurte o texto na coluna ORIGEM.' },
        { aba: 'ESCALAS', linha: 5, mensagem: `Escala "${longo.slice(0, 30)}…" tem mais de 120 caracteres`, solucao: 'Encurte o nome na coluna ESCALA.' },
      ]),
    );
    expect(previa.novos.map((n: { chave: string }) => n.chave)).not.toContain(`Serviço ${longo}`);
  });

  // revisão final da 4.2: uma linha que deixou de ser válida não pode apagar o vínculo que já estava gravado
  it('revisão: linha com problema mantém os horários que a guarnição já tinha naquele mês', async () => {
    const e = [...ESCALAS, ['Mistura', 'Pronto, Expediente', '', '', '']];
    await importar({ e, v: [[atual, 'Mistura', '08:00-20:00', 'ABT']] }, true);
    // "A" é ambígua na escala (Pronto 08h–20h e Expediente 08h–16h): a linha da ABT vira problema
    const v = [[atual, 'Mistura', 'A', 'ABT'], [atual, 'Mistura', '20:00-08:00', 'AR']];
    const previa = await importar({ e, v });
    expect(previa.problemas.map((p: { linha: number }) => p.linha)).toEqual([2]);
    expect(previa.avisos).toContain(`Mistura: ABT manteve os horários que já tinha em ${mesPorExtenso(atual)}, porque a linha dela tem problema.`);
    await importar({ e, v }, true);
    expect((await escala('Mistura')).vinculos[0]!.itens.map((i) => [i.guarnicao, `${i.inicio}-${i.fim}`])).toEqual([
      ['ABT', '08:00-20:00'],
      ['AR', '20:00-08:00'],
    ]);
  });
});

describe('turno único', () => {
  it('ÚNICO, Único e U, em qualquer caixa, viram o turno A', async () => {
    const t: Celula[][] = [
      ['Serv Maiusculo', 'ÚNICO', '08:00', '16:00', 8, '', ''],
      ['Serv Misto', 'Único', '08:00', '16:00', 8, '', ''],
      ['Serv Letra', 'u', '08:00', '16:00', 8, '', ''],
    ];
    const previa = await importar({ t, e: [] });
    expect(previa.problemas).toEqual([]);
    await importar({ t, e: [] }, true);
    for (const nome of ['Serv Maiusculo', 'Serv Misto', 'Serv Letra']) {
      expect((await servico(nome)).turnos.map((x) => x.letra)).toEqual(['A']);
    }
  });
});

describe('serviço com cotas', () => {
  it('trocar o tipo para ordinário pela planilha vira problema na linha e o serviço fica como está', async () => {
    const t: Celula[][] = [['Operação Cotada', 'A', '08:00', '16:00', 8, 'Diária', '']];
    await importar({ t, e: [] }, true);
    const s = await servico('Operação Cotada');
    await api.banco.query(
      "insert into cota (mes, unidade_id, servico_id, quantidade, origem, prioridade) values ('2026-12-01', $1, $2, 2, 'interna', 1)",
      [api.ids.secao, s.id],
    );
    const trocada: Celula[][] = [['Operação Cotada', 'A', '08:00', '16:00', 8, 'Ordinário', '']];
    const previa = await importar({ t: trocada, e: [] });
    expect(previa.problemas).toEqual([
      { aba: 'TURNOS', linha: 2, mensagem: 'Operação Cotada: o serviço tem 1 cota de operações e não pode virar Ordinário', solucao: 'Apague a cota na tela de Cotas antes de mudar o tipo.' },
    ]);
    expect(previa.alterados).toEqual([]);
    await importar({ t: trocada, e: [] }, true);
    expect((await servico('Operação Cotada')).tipo).toBe('diaria');
  });
});

describe('serviço fixo', () => {
  it('mudar o tipo de um fixo pela planilha vira problema na linha, e o serviço fica como está', async () => {
    await importar({}, true);
    const jesOrdinario = TURNOS.map((t) => (t[0] === 'JES' ? ['JES', 'A', '08:00', '20:00', 12, 'Ordinário', ''] : t));
    const previa = await importar({ t: jesOrdinario });
    expect(previa.problemas).toContainEqual({
      aba: 'TURNOS', linha: 4, mensagem: 'JES: o serviço é fixo e o tipo não muda', solucao: 'Deixe o TIPO DE SERVIÇO de JES como PJES (ou em branco).',
    });
    await importar({ t: jesOrdinario }, true);
    expect((await servico('JES')).tipo).toBe('pjes');
  });

  it('um serviço novo com nome fixo e tipo errado também vira problema, em vez de falhar na gravação', async () => {
    const previa = await importar({ t: [...TURNOS, ['Saldo', 'A', '08:00', '20:00', 12, 'Diária', '']] });
    expect(previa.problemas).toContainEqual({
      aba: 'TURNOS', linha: 8, mensagem: 'Saldo: o serviço é fixo e o tipo não muda', solucao: 'Deixe o TIPO DE SERVIÇO de Saldo como Ordinário (ou em branco).',
    });
  });

  it('um serviço novo com nome fixo e sem tipo entra com o tipo do fixo, sem aviso de "entrou como diária"', async () => {
    const previa = await importar({ t: [...TURNOS, ['Saldo', 'A', '08:00', '20:00', 12, '', '']] }, true);
    expect(previa.avisos.filter((a: string) => a.includes('Saldo'))).toEqual([]);
    expect((await servico('Saldo')).tipo).toBe('ordinario');
  });
});

// por último: grava vínculos em meses futuros, que os outros testes do arquivo não esperam encontrar
describe('mês que já passou nos vínculos (achado da 4.6)', () => {
  it('vigência de um mês que já passou vira problema e não grava; a do mês atual e a de um mês futuro entram (Review Focus 5)', async () => {
    const passado = somarMeses(atual, -1);
    const futuro = somarMeses(atual, 3);
    // o turno A do Ordinário tem dois horários (Pronto e Expediente): as linhas usam a faixa
    const v = [[passado, 'Ordinário', '08:00-20:00', 'ABT'], [atual, 'Ordinário', '20:00-08:00', 'ABT'], [futuro, 'Ordinário', '08:00-20:00', 'ABT']];
    const previa = await importar({ v });
    expect(previa.problemas).toEqual([{ aba: 'GUARNIÇÕES POR ESCALA', linha: 2, mensagem: `Mês já passou na linha 2: Ordinário, ${mesPorExtenso(passado)}`, solucao: 'Use o mês atual ou um mês futuro.' }]);
    await importar({ v }, true);
    const vigencias = (await escala('Ordinário')).vinculos.map((x) => x.vigencia);
    expect(vigencias).toContain(futuro);
    expect(vigencias).toContain(atual);
    expect(vigencias).not.toContain(passado);
  });
});
