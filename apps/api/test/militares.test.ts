import { hashPassword } from 'better-auth/crypto';
import { somarMeses, type FichaMilitar, type LinhaMilitar, type ListaDoPeculio, type Posto } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, entrarComo, montarApi, URL_BASE, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

let api: ApiDeTeste;
let sd: string;
let cb: string;
let ferias: string;
let lts: string;
let alfa: string;
let outraSecao: string;
const atual = hojeRecife().slice(0, 7);
const proximo = somarMeses(atual, 1);

const novo = (matricula: string, extra: Record<string, unknown> = {}) => ({
  matricula, postoGradId: sd, nomeCompleto: `Fulano de Tal ${matricula}`, nomeGuerra: `TESTE${matricula.slice(3, 6)}`, antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
  lotacao: { equipeId: alfa, jornada: 'pronto', desde: `${atual}-01` }, ...extra,
});
async function criar(matricula: string, extra: Record<string, unknown> = {}): Promise<FichaMilitar> {
  const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo(matricula, extra));
  expect(r.status).toBe(201);
  return r.json();
}
const ficha = async (id: string): Promise<FichaMilitar> => (await api.pedir('gestorGb', 'GET', `/api/militares/${id}`)).json();

beforeAll(async () => {
  api = await montarApi();
  const postos: Posto[] = await (await api.pedir('gestorGb', 'GET', '/api/postos')).json();
  sd = postos.find((p) => p.sigla === 'SD BM')!.id;
  cb = postos.find((p) => p.sigla === 'CB BM')!.id;
  const tipos = (await api.banco.query<{ id: string; nome: string }>('select id, nome from tipo_afastamento')).rows;
  ferias = tipos.find((t) => t.nome === 'Férias')!.id;
  lts = tipos.find((t) => t.nome === 'LTS')!.id;
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  // a 2ª SB vem da migração 0023 (as sete seções do 2º GB)
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
});
afterAll(async () => {
  await api.fechar();
});

describe('cadastro de militares', () => {
  it('postos em ordem de hierarquia e equipes da unidade', async () => {
    const postos: Posto[] = await (await api.pedir('gestorGb', 'GET', '/api/postos')).json();
    expect(postos[0]!.sigla).toBe('SD BM');
    const equipes = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/equipes`)).json();
    expect(equipes).toEqual([{ id: alfa, nome: 'Alfa', ordemCiclo: 1 }]);
  });

  it('cria militar com a primeira lotação', async () => {
    const f = await criar('990101-1', { motorista: true, cnh: ['B'] });
    expect(f).toMatchObject({ matricula: '990101-1', posto: 'SD BM', equipe: 'Alfa', jornada: 'pronto', motorista: 'B', pendencias: [] });
    expect(f.rastreio).toEqual([{ id: expect.any(String), unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', quadro: 'QBMG', situacao: 'Ativa', desde: `${atual}-01`, ate: null }]);
  });

  it('matrícula repetida é 409', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990101-1'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe um militar com essa matrícula.');
  });

  // a CNH é do militar, esteja ou não no quadro de motoristas (fase 5)
  it('CNH sem quadro de motoristas grava', async () => {
    const f = await criar('990109-9', { cnh: ['B'] });
    expect(f).toMatchObject({ noQuadroDeMotoristas: false, cnh: ['B'], motorista: null });
  });

  it('lista do mês traz situação e pendências', async () => {
    const m = await criar('990102-2', { antiguidade: null, lotacao: { equipeId: null, jornada: 'pronto', desde: `${atual}-01` } });
    await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${atual}-03`, fim: `${atual}-05` });
    const lista: LinhaMilitar[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();
    const linha = lista.find((l) => l.matricula === '990102-2')!;
    expect(linha.situacao).toBe(`LTS de 03/${atual.slice(5)} a 05/${atual.slice(5)}`);
    expect(linha.pendencias).toEqual(['Pronto sem equipe', 'Sem antiguidade']);
  });

  it('lista ordena por posto, antiguidade (vazia por último) e nome', async () => {
    await criar('990103-3', { postoGradId: cb, nomeGuerra: 'ZULU', antiguidade: 2 });
    await criar('990104-4', { postoGradId: cb, nomeGuerra: 'ALFA', antiguidade: null });
    await criar('990105-5', { postoGradId: cb, nomeGuerra: 'BRAVO', antiguidade: 1 });
    const lista: LinhaMilitar[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();
    expect(lista.filter((l) => l.posto === 'CB BM').map((l) => l.nomeGuerra)).toEqual(['BRAVO', 'ZULU', 'ALFA']);
  });
});

describe('seções para a lotação', () => {
  it('o escalante da 1ª SB vê só a 1ª SB; o administrador vê as sete; quem não tem papel não vê nenhuma (403)', async () => {
    const dele: { id: string; sigla: string }[] = await (await api.pedir('escalante', 'GET', '/api/secoes')).json();
    expect(dele.map((x) => x.sigla)).toEqual(['1ª SB']);
    expect(dele[0]!.id).toBe(api.ids.secao);
    const todas: { id: string; sigla: string; nome: string }[] = await (await api.pedir('admin', 'GET', '/api/secoes')).json();
    expect(todas.map((x) => x.sigla)).toEqual(['1ª SB', '2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB']);
    expect(todas[1]).toEqual({ id: outraSecao, sigla: '2ª SB', nome: '2ª Seção de Bombeiros' });
    expect((await api.pedir('semPapel', 'GET', '/api/secoes')).status).toBe(403);
  });
});

describe('alterar situação (rastreio)', () => {
  let bravo: string;
  let equipeDeOutra: string;
  const situacao = (id: string, corpo: Record<string, unknown>, papel: Parameters<ApiDeTeste['pedir']>[0] = 'escalante') => api.pedir(papel, 'POST', `/api/militares/${id}/situacao`, corpo);
  const ultimoDiaDoMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  beforeAll(async () => {
    bravo = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Bravo', ordem_ciclo: 2 });
    equipeDeOutra = await inserir(api.banco, 'equipe', { unidade_id: outraSecao, nome: 'Alfa', ordem_ciclo: 1 });
  });

  it('só a equipe, a partir do mês seguinte: fecha o período aberto no fim do mês e abre outro com a mesma lotação', async () => {
    const m = await criar('990106-6');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: `${proximo}-01` });
    expect(r.status).toBe(201);
    const f = (await r.json()) as FichaMilitar;
    expect(f.rastreio.map((l) => [l.unidadeSigla, l.equipe, l.jornada, l.desde, l.ate])).toEqual([
      ['1ª SB', 'Bravo', 'pronto', `${proximo}-01`, null],
      ['1ª SB', 'Alfa', 'pronto', `${atual}-01`, ultimoDiaDoMes(atual)],
    ]);
  });

  // [foco 3] o mesmo mês do período aberto: troca o período, em vez de deixar um de zero dia
  it('no mesmo mês do período aberto, substitui o período (nenhum fica com zero dia)', async () => {
    const m = await criar('990116-6');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${atual}-01` });
    expect(r.status).toBe(200);
    const f = (await r.json()) as FichaMilitar;
    expect(f.rastreio).toEqual([{ id: expect.any(String), unidadeSigla: '1ª SB', equipe: null, jornada: 'adm', quadro: 'QBMG', situacao: 'Ativa', desde: `${atual}-01`, ate: null }]);
    expect(f).toMatchObject({ jornada: 'adm', equipe: null });
  });

  it('um dia antes do período aberto é 400 com a mensagem no campo "desde", e nada muda', async () => {
    const m = await criar('990107-7');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${somarMeses(atual, -1)}-28` });
    expect(r.status).toBe(400);
    const corpo = await r.json();
    expect(corpo.erro).toBe('Use o dia do período aberto ou um dia depois.');
    expect(corpo.campos.desde).toBe('Use o dia do período aberto ou um dia depois.');
    expect((await ficha(m.id)).rastreio).toHaveLength(1);
  });

  it('alterar a situação no dia 15 fecha o período no dia 14', async () => {
    const m = await criar('990127-7');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: `${proximo}-15` });
    expect(r.status).toBe(201);
    const f = (await r.json()) as FichaMilitar;
    expect(f.rastreio.map((l) => [l.equipe, l.desde, l.ate])).toEqual([
      ['Bravo', `${proximo}-15`, null],
      ['Alfa', `${atual}-01`, `${proximo}-14`],
    ]);
  });

  it('um dia depois do início do período aberto, no mesmo mês, também abre outro período', async () => {
    const m = await criar('990137-7');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${atual}-20` });
    expect(r.status).toBe(201);
    expect(((await r.json()) as FichaMilitar).rastreio.map((l) => [l.jornada, l.desde, l.ate])).toEqual([
      ['adm', `${atual}-20`, null],
      ['pronto', `${atual}-01`, `${atual}-19`],
    ]);
  });

  // [foco 3] no mesmo dia em que o período abriu: substitui, sem criar um de zero dia
  it('no dia em que o período aberto começou, substitui (nenhum fica com zero dia)', async () => {
    const m = await criar('990147-7');
    const abre = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: `${proximo}-15` });
    expect(abre.status).toBe(201);
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${proximo}-15` });
    expect(r.status).toBe(200);
    expect(((await r.json()) as FichaMilitar).rastreio.map((l) => [l.jornada, l.desde, l.ate])).toEqual([
      ['adm', `${proximo}-15`, null],
      ['pronto', `${atual}-01`, `${proximo}-14`],
    ]);
  });

  it('o corpo com mês em vez de data é recusado no campo "desde"', async () => {
    const m = await criar('990157-7');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: proximo });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.desde).toBeTruthy();
  });

  it('o militar novo entra lotado a partir do dia escolhido, não do dia 1', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990169-9', { lotacao: { equipeId: null, jornada: 'pronto', desde: `${atual}-15` } }));
    expect(r.status).toBe(201);
    expect(((await r.json()) as FichaMilitar).rastreio.map((l) => [l.desde, l.ate])).toEqual([[`${atual}-15`, null]]);
  });

  it('o militar novo com mês em vez de data na lotação é recusado no campo', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990179-9', { lotacao: { equipeId: null, jornada: 'pronto', desde: atual } }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos['lotacao.desde']).toBeTruthy();
  });

  it('equipe de outra unidade é 400 no campo equipeId', async () => {
    const m = await criar('990117-7');
    const r = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: equipeDeOutra, jornada: 'pronto', desde: `${proximo}-01` });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.equipeId).toBe('Escolha uma equipe da unidade da lotação.');
    expect((await ficha(m.id)).rastreio).toHaveLength(1);
  });

  it('mudar a lotação (a unidade) vale pelo rastreio: o novo período fica na outra seção', async () => {
    const m = await criar('990118-8');
    const r = await api.pedir('admin', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: equipeDeOutra, jornada: 'pronto', desde: `${proximo}-01` });
    expect(r.status).toBe(201);
    expect(((await r.json()) as FichaMilitar).rastreio.map((l) => [l.unidadeSigla, l.equipe, l.desde])).toEqual([
      ['2ª SB', 'Alfa', `${proximo}-01`],
      ['1ª SB', 'Alfa', `${atual}-01`],
    ]);
  });

  // revisão final: quem só tem papel na seção de origem não mexe no período de outra seção
  it('o escalante da 1ª SB não apaga nem encurta uma mudança de lotação marcada para outra seção (403)', async () => {
    const m = await criar('990178-8');
    const marcada = await api.pedir('admin', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` });
    expect(marcada.status).toBe(201);
    const antes = (await ficha(m.id)).rastreio;
    // no mesmo mês do período da 2ª SB: trocaria a unidade dele para a 1ª SB
    const substitui = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` });
    expect(substitui.status).toBe(403);
    // depois dele: fecharia o período da 2ª SB
    const fecha = await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${somarMeses(proximo, 1)}-01` });
    expect(fecha.status).toBe(403);
    expect((await ficha(m.id)).rastreio).toEqual(antes);
    // quem tem papel nas duas pontas pode (o administrador)
    expect((await situacao(m.id, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${somarMeses(proximo, 1)}-01` }, 'admin')).status).toBe(201);
  });

  it('a rota antiga de transferência saiu', async () => {
    const m = await criar('990119-9');
    const r = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/lotacoes`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: proximo });
    expect(r.status).toBe(404);
  });
});

describe('afastamentos', () => {
  let m: FichaMilitar;
  beforeAll(async () => {
    m = await criar('990108-8');
  });

  it('férias em duas partes no mesmo mês', async () => {
    for (const [i, f] of [['01', '10'], ['20', '28']]) {
      const r = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${proximo}-${i}`, fim: `${proximo}-${f}` });
      expect(r.status).toBe(201);
    }
    expect((await ficha(m.id)).afastamentos).toHaveLength(2);
  });

  it('afastamento sobreposto é 409 legível', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${proximo}-05`, fim: `${proximo}-22` });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('As datas se sobrepõem a outro período já cadastrado.');
  });

  it('fim antes do início é 400', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${proximo}-15`, fim: `${proximo}-14` });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.fim).toBe('O fim precisa ser no mesmo dia do início ou depois.');
  });

  it('editar e apagar afastamento', async () => {
    const [primeiro] = (await ficha(m.id)).afastamentos;
    const ed = await api.pedir('gestorGb', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { fim: `${proximo}-12` });
    expect(ed.status).toBe(200);
    const fimDepoisDoInicio = await api.pedir('gestorGb', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { inicio: `${proximo}-13` });
    expect(fimDepoisDoInicio.status).toBe(400);
    expect((await api.pedir('gestorGb', 'DELETE', `/api/afastamentos/${primeiro!.id}`)).status).toBe(204);
    expect((await ficha(m.id)).afastamentos).toHaveLength(1);
  });
});

describe('afastamento com motivo e boletim (fase 5)', () => {
  let m: FichaMilitar;
  const mes = somarMeses(atual, 6);
  beforeAll(async () => {
    m = await criar('990191-1');
  });
  const incluir = (corpo: Record<string, unknown>) => api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, ...corpo });

  it('incluir LTS com motivo e boletim grava e a ficha devolve os dois', async () => {
    const r = await incluir({ inicio: `${mes}-02`, fim: `${mes}-06`, motivo: 'Cirurgia programada', boletim: 'BG 12/2026' });
    expect(r.status).toBe(201);
    const [a] = (await ficha(m.id)).afastamentos;
    expect(a).toMatchObject({ tipo: 'LTS', motivo: 'Cirurgia programada', boletim: 'BG 12/2026' });
  });

  it('sem motivo e sem boletim, os dois ficam vazios (null)', async () => {
    const r = await incluir({ inicio: `${mes}-10`, fim: `${mes}-12` });
    expect(r.status).toBe(201);
    const sem = (await ficha(m.id)).afastamentos.find((a) => a.inicio === `${mes}-10`)!;
    expect(sem).toMatchObject({ motivo: null, boletim: null });
  });

  // [foco 5] o limite do motivo é conferido antes do banco: 400 no campo, nunca erro do banco
  it('motivo de 201 caracteres é 400 no campo, e boletim com mais de 60 também; nada é gravado', async () => {
    const antes = (await ficha(m.id)).afastamentos.length;
    const motivo = await incluir({ inicio: `${mes}-14`, fim: `${mes}-15`, motivo: 'a'.repeat(201) });
    expect(motivo.status).toBe(400);
    expect((await motivo.json()).campos.motivo).toBe('Use no máximo 200 caracteres.');
    const boletim = await incluir({ inicio: `${mes}-14`, fim: `${mes}-15`, boletim: 'b'.repeat(61) });
    expect(boletim.status).toBe(400);
    expect((await boletim.json()).campos.boletim).toBe('Use no máximo 60 caracteres.');
    expect((await ficha(m.id)).afastamentos).toHaveLength(antes);
    expect((await incluir({ inicio: `${mes}-14`, fim: `${mes}-15`, motivo: 'a'.repeat(200), boletim: 'b'.repeat(60) })).status).toBe(201);
  });

  it('editar muda o motivo e o boletim; null limpa; o que não vem fica como está', async () => {
    const [primeiro] = (await ficha(m.id)).afastamentos;
    const ed = await api.pedir('gestorGb', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { motivo: 'Outro motivo' });
    expect(ed.status).toBe(200);
    expect(await ed.json()).toMatchObject({ motivo: 'Outro motivo', boletim: 'BG 12/2026' });
    const limpa = await api.pedir('gestorGb', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { motivo: null, boletim: null });
    expect(await limpa.json()).toMatchObject({ motivo: null, boletim: null });
    expect((await ficha(m.id)).afastamentos.find((a) => a.id === primeiro!.id)).toMatchObject({ motivo: null, boletim: null });
    const longo = await api.pedir('gestorGb', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { motivo: 'a'.repeat(201) });
    expect(longo.status).toBe(400);
  });

  it('os tipos novos (Adido, Agregado, L.E, DTS) servem para um afastamento', async () => {
    const tipos = (await api.banco.query<{ id: string; nome: string }>("select id, nome from tipo_afastamento where nome in ('Adido', 'Agregado', 'L.E', 'DTS')")).rows;
    expect(tipos).toHaveLength(4);
    let dia = 20;
    for (const t of tipos) {
      const r = await incluir({ tipoAfastamentoId: t.id, inicio: `${mes}-${dia}`, fim: `${mes}-${dia + 1}` });
      expect(r.status, t.nome).toBe(201);
      dia += 2;
    }
  });
});

describe('antiguidade repetida', () => {
  const listaDaSecao = async (): Promise<LinhaMilitar[]> =>
    (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();

  it('dois militares com a mesma antiguidade ganham a pendência e a gravação passa', async () => {
    const a = await criar('990120-0', { nomeGuerra: 'REPETIDOA', antiguidade: 777 });
    const b = await criar('990121-1', { nomeGuerra: 'REPETIDOB', antiguidade: 777 });
    expect(b.pendencias).toContain('Antiguidade repetida com REPETIDOA');
    expect((await ficha(a.id)).pendencias).toContain('Antiguidade repetida com REPETIDOB');
    const lista = await listaDaSecao();
    expect(lista.find((l) => l.id === a.id)!.pendencias).toContain('Antiguidade repetida com REPETIDOB');
    expect(lista.find((l) => l.id === b.id)!.pendencias).toContain('Antiguidade repetida com REPETIDOA');
  });

  it('a ficha traz os nomes da antiguidade repetida, e a pendência vira número com mais de três', async () => {
    const mil = [];
    for (const [i, nome] of ['MULTIA', 'MULTIB', 'MULTIC', 'MULTID', 'MULTIE'].entries()) mil.push(await criar(`99013${i}-${i}`, { nomeGuerra: nome, antiguidade: 888 }));
    const f = await ficha(mil[0]!.id);
    expect(f.antiguidadeRepetidaCom).toEqual(['MULTIB', 'MULTIC', 'MULTID', 'MULTIE']);
    expect(f.pendencias).toContain('Antiguidade repetida com 4 militares');
    const sem = await ficha((await criar('990140-0', { nomeGuerra: 'SOZINHO', antiguidade: 889 })).id);
    expect(sem.antiguidadeRepetidaCom).toEqual([]);
  });

  it('militar inativo não conta como repetido', async () => {
    const c = await criar('990122-2', { nomeGuerra: 'REPETIDOC', antiguidade: 778 });
    const d = await criar('990123-3', { nomeGuerra: 'REPETIDOD', antiguidade: 778 });
    expect((await ficha(c.id)).pendencias).toContain('Antiguidade repetida com REPETIDOD');
    // a situação vale por período: "Desativado" não pode ser escalado, então não conta como repetido
    await api.banco.query("update rastreio set situacao_id = (select id from situacao_militar where nome = 'Desativado') where militar_id = $1", [d.id]);
    expect((await ficha(c.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
  });

  it('desfeita a repetição, a pendência some', async () => {
    const e = await criar('990124-4', { nomeGuerra: 'REPETIDOE', antiguidade: 779 });
    const f = await criar('990125-5', { nomeGuerra: 'REPETIDOF', antiguidade: 779 });
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${f.id}`, { antiguidade: 780 })).status).toBe(200);
    expect((await ficha(e.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
    expect((await ficha(f.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
  });
});

describe('edição só do que mudou', () => {
  it('duas edições ao mesmo tempo em campos diferentes ficam as duas', async () => {
    const m = await criar('990150-0', { nomeGuerra: 'ANTES', voluntarioJes: false });
    const [a, b] = await Promise.all([
      api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nomeGuerra: 'NOVO' }),
      api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { voluntarioJes: true }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await ficha(m.id)).toMatchObject({ nomeGuerra: 'NOVO', voluntarioJes: true });
  });

  it('PATCH com antiguidade null apaga a antiguidade', async () => {
    const m = await criar('990151-1', { antiguidade: 4321 });
    expect(m.antiguidade).toBe(4321);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { antiguidade: null });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ antiguidade: null });
    expect((await ficha(m.id)).antiguidade).toBeNull();
  });
});

describe('motorista e permissões', () => {
  it('desmarcar motorista mantém a CNH gravada (ela só deixa de valer para a escala)', async () => {
    const m = await criar('990110-0', { motorista: true, cnh: ['D'] });
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { motorista: false });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ noQuadroDeMotoristas: false, cnh: ['D'], cnhPorHierarquia: ['C', 'B'], motorista: null });
    expect((await ficha(m.id)).cnh).toEqual(['D']);
  });

  it('marcar a CNH de quem não está no quadro de motoristas também grava', async () => {
    const m = await criar('990177-7');
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { cnh: ['B', 'A'] });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ noQuadroDeMotoristas: false, cnh: ['A', 'B'] });
  });

  it('ficha mostra a CNH pela hierarquia', async () => {
    const m = await criar('990111-1', { motorista: true, cnh: ['D'] });
    expect(m.cnhPorHierarquia).toEqual(['C', 'B']);
  });

  it('escalante de outra unidade não edita (403)', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/militares`, novo('990112-2', { lotacao: { equipeId: null, jornada: 'adm', desde: `${atual}-01` } }));
    expect(r.status).toBe(201);
    const id = (await r.json()).id;
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${id}`, { voluntarioJes: true })).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', `/api/militares/${id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `/api/unidades/${api.ids.secao}/militares`)).status).toBe(403);
  });

  it('a gravação fica na auditoria com o usuário', async () => {
    const m = await criar('990113-3');
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'militar' and registro_id = $1", [m.id]);
    expect(rows[0]!.usuario_id).toBe(api.usuarios.gestorGb);
  });

  it('alterar a situação para unidade sem papel é 403', async () => {
    const m = await criar('990114-4');
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` });
    expect(r.status).toBe(403);
  });

  it('mudança de lotação marcada para o mês seguinte não tira o acesso da seção atual', async () => {
    const m = await criar('990115-5');
    // o administrador registra a ida para a 2ª SB no mês que vem
    expect((await api.pedir('admin', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` })).status).toBe(201);
    expect((await api.pedir('gestorGb', 'GET', `/api/militares/${m.id}`)).status).toBe(200);
    const af = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${atual}-02`, fim: `${atual}-03` });
    expect(af.status).toBe(201);
  });
});

describe('antiguidade fora do que o banco guarda', () => {
  it('antiguidade enorme na criação e na edição dá 400 por campo, não 500', async () => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990970-1', { antiguidade: 3_000_000_000 }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos.antiguidade).toBe('Use um número de 1 a 99999.');
    const f = await criar('990971-1');
    const e = await api.pedir('gestorGb', 'PATCH', `/api/militares/${f.id}`, { antiguidade: 2 ** 31 });
    expect(e.status).toBe(400);
    expect((await e.json()).campos.antiguidade).toBe('Use um número de 1 a 99999.');
    const v = await api.pedir('gestorGb', 'PATCH', `/api/militares/${f.id}`, { antiguidade: 1.5 });
    expect(v.status).toBe(400);
    expect((await v.json()).campos.antiguidade).toBe('Use um número inteiro.');
  });
});

describe('pendência "Nome completo em falta"', () => {
  it('militar que já existia sem nome completo mostra a pendência na lista e na ficha; preencher a tira', async () => {
    const m = await criar('990190-0', { antiguidade: 4321 });
    await api.banco.query('update militar set nome_completo = null where id = $1', [m.id]);
    const lista: LinhaMilitar[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();
    expect(lista.find((l) => l.matricula === '990190-0')!.pendencias).toEqual(['Nome completo em falta']);
    expect((await ficha(m.id)).pendencias).toEqual(['Nome completo em falta']);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nomeCompleto: 'Fulano de Tal Completo' });
    expect(((await r.json()) as FichaMilitar).pendencias).toEqual([]);
  });
});

describe('dono por bloco (Review Focus 1 e 2)', () => {
  const MSG = 'Este campo é alterado por quem tem nível de acesso no 2º GB.';
  const papelEmOutraSecao = async <T>(quem: 'escalante', f: () => Promise<T>) => {
    // o escalante também com papel na 2ª SB: tem as duas pontas da lotação, mas nenhuma unidade acima
    const id = await inserir(api.banco, 'papel_usuario', { usuario_id: api.usuarios[quem], unidade_id: outraSecao, papel: 'escalante', desde: '2026-01-01' });
    try {
      return await f();
    } finally {
      await api.banco.query('delete from papel_usuario where id = $1', [id]);
    }
  };

  it('escalante da 1ª SB: o campo da escala passa; o do Pecúlio é 403 (sozinho ou junto com o da escala) e nada é gravado', async () => {
    const m = await criar('990180-0');
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, { voluntarioJes: true })).status).toBe(200);
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, { motorista: true, cnh: ['B'] })).status).toBe(200);
    const sozinho = await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, { nomeCompleto: 'Outro Nome Completo' });
    expect(sozinho.status).toBe(403);
    expect((await sozinho.json()).erro).toBe(MSG);
    const junto = await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, { nomeCompleto: 'Outro Nome Completo', voluntarioJes: false });
    expect(junto.status).toBe(403);
    expect((await junto.json()).erro).toBe(MSG);
    const depois = await ficha(m.id);
    expect(depois.nomeCompleto).toBe('Fulano de Tal 990180-0');
    expect(depois.voluntarioJes).toBe(true);
    // cada campo do Pecúlio é recusado
    for (const campo of [{ postoGradId: cb }, { nomeGuerra: 'OUTRO' }, { antiguidade: 9 }, { sexo: 'F' }, { nascimento: { dia: 1, mes: 1 } }, { telefone: '(81) 9' }, { email: 'a@bombeiros.pe.gov.br' }, { comportamento: 'Bom' }, { comportamentoBoletim: 'BG 1' }]) {
      expect((await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, campo)).status, JSON.stringify(campo)).toBe(403);
    }
  });

  it('escalante da 1ª SB: alterar situação mudando só equipe e jornada passa; mudar a lotação é 403; criar militar é 403', async () => {
    const m = await criar('990181-1');
    const soEquipe = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${atual}-01` });
    expect(soEquipe.status).toBe(200);
    await papelEmOutraSecao('escalante', async () => {
      const lotacao = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` });
      expect(lotacao.status).toBe(403);
      expect((await lotacao.json()).erro).toBe('A lotação é alterada por quem tem nível de acesso no 2º GB.');
      expect((await ficha(m.id)).rastreio).toHaveLength(1);
    });
    const novoM = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990182-2'));
    expect(novoM.status).toBe(403);
    expect((await novoM.json()).erro).toBe('Cadastrar militar é com quem tem nível de acesso no 2º GB.');
  });

  it('escalante da 1ª SB: incluir, editar e remover afastamento é 403', async () => {
    const m = await criar('990183-3');
    const af = await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${atual}-05`, fim: `${atual}-06` });
    expect(af.status).toBe(201);
    const afId = (await af.json()).id;
    const incluir = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${atual}-10`, fim: `${atual}-11` });
    expect(incluir.status).toBe(403);
    expect((await incluir.json()).erro).toBe('Os afastamentos são alterados por quem tem nível de acesso no 2º GB.');
    expect((await api.pedir('escalante', 'PATCH', `/api/afastamentos/${afId}`, { fim: `${atual}-07` })).status).toBe(403);
    expect((await api.pedir('escalante', 'DELETE', `/api/afastamentos/${afId}`)).status).toBe(403);
    expect((await ficha(m.id)).afastamentos).toHaveLength(1);
  });

  it('o gestor do 2º GB e o administrador alteram tudo, inclusive a lotação no "Alterar situação"', async () => {
    const m = await criar('990184-4');
    for (const quem of ['gestorGb', 'admin'] as const) {
      const r = await api.pedir(quem, 'PATCH', `/api/militares/${m.id}`, { nomeCompleto: `Nome de ${quem}`, voluntarioJes: true });
      expect(r.status, quem).toBe(200);
    }
    expect((await ficha(m.id)).nomeCompleto).toBe('Nome de admin');
    expect((await api.pedir('gestorGb', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: `${proximo}-01` })).status).toBe(201);
    expect((await api.pedir('admin', 'POST', `/api/militares/${m.id}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: `${somarMeses(proximo, 1)}-01` })).status).toBe(201);
  });

  it('a ficha devolve podeEditar certo para o escalante, o gestor do 2º GB e o administrador', async () => {
    const m = await criar('990185-5');
    const de = async (quem: 'escalante' | 'gestorGb' | 'admin') => ((await (await api.pedir(quem, 'GET', `/api/militares/${m.id}`)).json()) as FichaMilitar).podeEditar;
    expect(await de('escalante')).toEqual({ peculio: false, escala: true, unidadeDeCima: '2º GB' });
    expect(await de('gestorGb')).toEqual({ peculio: true, escala: true, unidadeDeCima: '2º GB' });
    expect(await de('admin')).toEqual({ peculio: true, escala: true, unidadeDeCima: '2º GB' });
  });

  it('grava e devolve os campos novos da ficha; null limpa', async () => {
    const m = await criar('990186-6');
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, {
      nomeCompleto: 'Maria de Souza Lima', sexo: 'F', nascimento: { dia: 29, mes: 2 }, telefone: '(81) 99999-0000', email: 'Maria.Lima@bombeiros.pe.gov.br', comportamento: 'Ótimo', comportamentoBoletim: 'BG 05/2026',
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      nomeCompleto: 'Maria de Souza Lima', sexo: 'F', nascimento: { dia: 29, mes: 2 }, telefone: '(81) 99999-0000', email: 'Maria.Lima@bombeiros.pe.gov.br', comportamento: 'Ótimo', comportamentoBoletim: 'BG 05/2026',
    });
    const limpa = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { sexo: null, nascimento: null, telefone: null, email: null, comportamento: null, comportamentoBoletim: null });
    expect(await limpa.json()).toMatchObject({ sexo: null, nascimento: null, telefone: null, email: null, comportamento: null, comportamentoBoletim: null, nomeCompleto: 'Maria de Souza Lima' });
  });

  it('e-mail repetido com maiúsculas diferentes é 409 no campo; de outro domínio é 400 no campo (Review Focus 3)', async () => {
    const a = await criar('990187-7');
    const b = await criar('990188-8');
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${a.id}`, { email: 'Fulano@bombeiros.pe.gov.br' })).status).toBe(200);
    const repetido = await api.pedir('gestorGb', 'PATCH', `/api/militares/${b.id}`, { email: 'fulano@bombeiros.pe.gov.br' });
    expect(repetido.status).toBe(409);
    expect(await repetido.json()).toEqual({ erro: 'Este e-mail já é de outro militar.', campos: { email: 'Este e-mail já é de outro militar.' } });
    const fora = await api.pedir('gestorGb', 'PATCH', `/api/militares/${b.id}`, { email: 'fulano@gmail.com' });
    expect(fora.status).toBe(400);
    expect((await fora.json()).campos.email).toBe('Use o e-mail institucional (@bombeiros.pe.gov.br).');
  });
});

describe('lista do Pecúlio e aniversariantes (módulo)', () => {
  const mesDoAniversario = somarMeses(atual, 2);
  const numeroDoMes = Number(mesDoAniversario.slice(5));
  const outroMes = (numeroDoMes % 12) + 1;
  const peculio = async (u: string, quem: 'gestorGb' | 'escalante' | 'admin' | 'semPapel' = 'gestorGb', mes = mesDoAniversario) =>
    api.pedir(quem, 'GET', `/api/unidades/${u}/peculio?mes=${mes}`);
  const doPeculio = async (u: string, mes = mesDoAniversario): Promise<ListaDoPeculio> => (await peculio(u, 'gestorGb', mes)).json();
  const naSegundaSecao = async (matricula: string, extra: Record<string, unknown> = {}): Promise<FichaMilitar> => {
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${outraSecao}/militares`, novo(matricula, { lotacao: { equipeId: null, jornada: 'adm', desde: `${atual}-01` }, ...extra }));
    expect(r.status).toBe(201);
    return r.json();
  };
  const nasce = async (id: string, dia: number, mes: number) =>
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, { nascimento: { dia, mes } })).status).toBe(200);
  let a1: FichaMilitar;
  let b2: FichaMilitar;
  let c1: FichaMilitar;
  let d1: FichaMilitar;

  beforeAll(async () => {
    a1 = await criar('990501-1', { nomeGuerra: 'ALFAUM', antiguidade: 7001 });
    b2 = await naSegundaSecao('990502-2', { nomeGuerra: 'BRAVODOIS', antiguidade: 7002 });
    c1 = await criar('990503-3', { nomeGuerra: 'CHARLIEUM', antiguidade: 7003 });
    d1 = await criar('990504-4', { nomeGuerra: 'DELTAUM', antiguidade: 7004 });
    // A (20) e B (5) fazem aniversário no mês da consulta; C faz no mês seguinte; D não tem nascimento preenchido
    await nasce(a1.id, 20, numeroDoMes);
    await nasce(b2.id, 5, numeroDoMes);
    await nasce(c1.id, 10, outroMes);
    await api.banco.query('update militar set nome_completo = null where id = $1', [d1.id]);
  });

  it('com o 2º GB traz os militares da 1ª e da 2ª SB, com os dados do Pecúlio; com a 1ª SB, só os dela', async () => {
    const gb = await doPeculio(api.ids.gb);
    const por = (matricula: string) => gb.militares.find((m) => m.matricula === matricula);
    expect(por('990501-1')).toEqual({
      militarId: a1.id, matricula: '990501-1', posto: 'SD BM', nomeGuerra: 'ALFAUM', nomeCompleto: 'Fulano de Tal 990501-1', lotacao: '1ª SB', telefone: null, email: null, pendencias: [],
    });
    expect(por('990502-2')).toMatchObject({ lotacao: '2ª SB', nomeGuerra: 'BRAVODOIS' });
    const daPrimeira = await doPeculio(api.ids.secao);
    expect(daPrimeira.militares.some((m) => m.matricula === '990501-1')).toBe(true);
    expect(daPrimeira.militares.some((m) => m.matricula === '990502-2')).toBe(false);
    expect(daPrimeira.militares.every((m) => m.lotacao === '1ª SB')).toBe(true);
    // o administrador (papel na raiz) também vê
    expect(((await (await peculio(api.ids.gb, 'admin')).json()) as ListaDoPeculio).militares.length).toBe(gb.militares.length);
  });

  it('a lista traz as pendências, inclusive "Nome completo em falta"', async () => {
    const gb = await doPeculio(api.ids.gb);
    expect(gb.militares.find((m) => m.matricula === '990504-4')).toMatchObject({ nomeCompleto: null, pendencias: ['Nome completo em falta'] });
  });

  it('os aniversariantes do mês vêm em ordem de dia; quem não tem nascimento ou faz em outro mês não aparece (Review Focus 5)', async () => {
    const gb = await doPeculio(api.ids.gb);
    expect(gb.aniversariantes).toEqual([
      { militarId: b2.id, posto: 'SD BM', nomeGuerra: 'BRAVODOIS', dia: 5, lotacao: '2ª SB' },
      { militarId: a1.id, posto: 'SD BM', nomeGuerra: 'ALFAUM', dia: 20, lotacao: '1ª SB' },
    ]);
    // quem é só da 1ª SB: só o A
    expect((await doPeculio(api.ids.secao)).aniversariantes!.map((x) => x.nomeGuerra)).toEqual(['ALFAUM']);
  });

  it('um mês sem ninguém faz a lista de aniversariantes vir vazia, e a lista de militares continua', async () => {
    const semNinguem = await doPeculio(api.ids.gb, somarMeses(atual, 4));
    expect(semNinguem.aniversariantes).toEqual([]);
    expect(semNinguem.militares.length).toBeGreaterThan(0);
  });

  it('sem papel na unidade é 403; mês inválido é 400', async () => {
    expect((await peculio(api.ids.gb, 'escalante')).status).toBe(403);
    expect((await peculio(api.ids.secao, 'semPapel')).status).toBe(403);
    expect((await peculio(api.ids.gb, 'gestorGb', '2026-13')).status).toBe(400);
    // o escalante da 1ª SB vê a lista da 1ª SB (leitura): o dono do bloco é quem edita, não quem lê
    expect((await peculio(api.ids.secao, 'escalante')).status).toBe(200);
  });
});

describe('e-mail de entrada igual ao da ficha (fase 6)', () => {
  // o usuário com conta e senha, como a Task 2 vai criá-lo pela API; aqui direto no banco, para testar só o e-mail
  async function comAcesso(matricula: string, email: string | null) {
    const militarId = await criarMilitar(api, { matricula, email, unidadeId: api.ids.secao });
    const usuarioId = await inserir(api.banco, 'usuario', { nome: `SD BM ${matricula}`, email: email ?? `${matricula}@exemplo.test`, militar_id: militarId });
    await inserir(api.banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: await hashPassword('senha-de-teste-123') });
    return { militarId, usuarioId };
  }
  const entrar = (email: string) =>
    api.app.request(`${URL_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: URL_BASE },
      body: JSON.stringify({ email, password: 'senha-de-teste-123' }),
    });
  const emailDoUsuario = async (id: string) => (await api.banco.query<{ email: string }>('select email from usuario where id = $1', [id])).rows[0]!.email;

  it('mudar o e-mail do militar muda o e-mail do usuário, e o login passa a ser pelo novo (Review Focus 4)', async () => {
    const { militarId, usuarioId } = await comAcesso('990701-1', 'antigo@bombeiros.pe.gov.br');
    expect((await entrar('antigo@bombeiros.pe.gov.br')).status).toBe(200);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${militarId}`, { email: 'NOVO@bombeiros.pe.gov.br' });
    expect(r.status).toBe(200);
    expect(await emailDoUsuario(usuarioId)).toBe('novo@bombeiros.pe.gov.br');
    expect((await entrar('novo@bombeiros.pe.gov.br')).status).toBe(200);
    expect((await entrar('antigo@bombeiros.pe.gov.br')).status).toBe(401);
  });

  it('não apaga o e-mail de quem tem usuário', async () => {
    const { militarId, usuarioId } = await comAcesso('990702-2', 'fica@bombeiros.pe.gov.br');
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${militarId}`, { email: null });
    expect(r.status).toBe(409);
    const msg = 'Desative o acesso antes de apagar o e-mail.';
    expect(await r.json()).toEqual({ erro: msg, campos: { email: msg } });
    expect((await ficha(militarId)).email).toBe('fica@bombeiros.pe.gov.br');
    expect(await emailDoUsuario(usuarioId)).toBe('fica@bombeiros.pe.gov.br');
  });

  it('com o acesso desativado, o e-mail pode ser apagado; o usuário guarda o de antes', async () => {
    const { militarId, usuarioId } = await comAcesso('990703-3', 'saiu@bombeiros.pe.gov.br');
    await api.banco.query('update usuario set ativo = false where id = $1', [usuarioId]);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${militarId}`, { email: null });
    expect(r.status).toBe(200);
    expect((await r.json()).email).toBeNull();
    expect(await emailDoUsuario(usuarioId)).toBe('saiu@bombeiros.pe.gov.br');
  });

  it('editar outro campo de quem tem usuário e ficha sem e-mail (o administrador de instalação) não é barrado', async () => {
    const { militarId } = await comAcesso('990704-4', null);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${militarId}`, { nomeGuerra: 'NOVONOME' });
    expect(r.status).toBe(200);
  });
});

describe('CPF, nascimento e endereço são de quem cuida do Pecúlio (6.11)', () => {
  const CPF = '52998224725';
  const RESTRITAS = ['cpf', 'nascimento', 'endereco'];
  const mesDoAniversario = somarMeses(atual, 2);
  const numeroDoMes = Number(mesDoAniversario.slice(5));
  let alvoId: string;
  let doGb: Pessoa;
  const aberta = async (quem: 'escalante' | 'gestorGb' | 'admin') => {
    const r = await api.pedir(quem, 'GET', `/api/militares/${alvoId}`);
    expect(r.status).toBe(200);
    return (await r.json()) as FichaMilitar;
  };

  beforeAll(async () => {
    alvoId = (await criar('990601-1')).id;
    await api.banco.query(
      `update militar set cpf = $2, nascimento_dia = 15, nascimento_mes = $3, nascimento_ano = 1985,
              cep = '50000000', logradouro = 'Rua Fictícia', numero = '10', bairro = 'Centro', cidade = 'Recife', uf = 'PE' where id = $1`,
      [alvoId, CPF, numeroDoMes],
    );
    doGb = await entrarComo(api, { matricula: '990602-2', nome: 'AUXGB', nivel: { papel: 'escalante', unidadeId: api.ids.gb } });
  });

  it('o auxiliar da 1ª SB abre a ficha de um militar da 1ª SB sem o CPF, o nascimento e o endereço: as chaves nem existem', async () => {
    const f = await aberta('escalante');
    expect(f.veDadosRestritos).toBe(false);
    for (const chave of RESTRITAS) expect(chave in f, chave).toBe(false);
    // o resto da ficha continua o mesmo
    expect(f).toMatchObject({ matricula: '990601-1', nomeCompleto: 'Fulano de Tal 990601-1', sexo: null, podeEditar: { peculio: false, escala: true } });
    expect(JSON.stringify(f)).not.toMatch(/52998224725|Rua Fictícia|50000000/);
  });

  it('o gestor do 2º GB, o auxiliar do 2º GB e o administrador recebem os três', async () => {
    for (const f of [await aberta('gestorGb'), await aberta('admin'), (await (await doGb.pedir('GET', `/api/militares/${alvoId}`)).json()) as FichaMilitar]) {
      expect(f.veDadosRestritos).toBe(true);
      expect(f.cpf).toBe(CPF);
      expect(f.nascimento).toEqual({ dia: 15, mes: numeroDoMes, ano: 1985 });
      expect(f.endereco).toMatchObject({ cep: '50000000', logradouro: 'Rua Fictícia', cidade: 'Recife', uf: 'PE' });
    }
  });

  it('a ficha que volta de uma gravação segue a mesma regra', async () => {
    const r = await api.pedir('escalante', 'PATCH', `/api/militares/${alvoId}`, { voluntarioJes: true });
    expect(r.status).toBe(200);
    const f = (await r.json()) as FichaMilitar;
    expect(f.voluntarioJes).toBe(true);
    for (const chave of RESTRITAS) expect(chave in f, chave).toBe(false);
    expect(f.veDadosRestritos).toBe(false);
  });

  const peculio = (quem: 'escalante' | 'gestorGb' | 'admin', u: string) => api.pedir(quem, 'GET', `/api/unidades/${u}/peculio?mes=${mesDoAniversario}`);

  it('a lista do Pecúlio segue a mesma regra: sem o nascimento, não há aniversariantes (a chave nem existe)', async () => {
    const doAuxiliar = await (await peculio('escalante', api.ids.secao)).json();
    expect(doAuxiliar.militares.some((m: { matricula: string }) => m.matricula === '990601-1')).toBe(true);
    expect('aniversariantes' in doAuxiliar).toBe(false);
    expect(JSON.stringify(doAuxiliar)).not.toMatch(/"dia":/);
    for (const quem of ['gestorGb', 'admin'] as const) {
      const lista: ListaDoPeculio = await (await peculio(quem, api.ids.secao)).json();
      expect(lista.aniversariantes!.map((a) => a.nomeGuerra)).toContain('TESTE601');
    }
    const doAuxiliarDoGb: ListaDoPeculio = await (await doGb.pedir('GET', `/api/unidades/${api.ids.secao}/peculio?mes=${mesDoAniversario}`)).json();
    expect(doAuxiliarDoGb.aniversariantes!.map((a) => a.nomeGuerra)).toContain('TESTE601');
  });

  it('o aniversariante é por militar: quem está lotado no próprio 2º GB só aparece para quem está acima do 2º GB', async () => {
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const id = await inserir(api.banco, 'militar', { matricula: '990603-3', posto_grad_id: posto, nome_guerra: 'NOGB', nome_completo: 'Fulano Lotado no Grupamento', nascimento_dia: 7, nascimento_mes: numeroDoMes });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.gb, jornada: 'adm', desde: `${atual}-01` });
    const nomes = async (quem: 'gestorGb' | 'admin') => ((await (await peculio(quem, api.ids.gb)).json()) as ListaDoPeculio).aniversariantes!.map((a) => a.nomeGuerra);
    expect(await nomes('gestorGb')).not.toContain('NOGB');
    expect(await nomes('gestorGb')).toContain('TESTE601');
    expect(await nomes('admin')).toContain('NOGB');
  });
});
