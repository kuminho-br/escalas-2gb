import { somarMeses, type FichaMilitar, type LinhaMilitar, type Posto } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

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
  matricula, postoGradId: sd, nomeGuerra: `TESTE${matricula.slice(3, 6)}`, antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
  lotacao: { equipeId: alfa, jornada: 'pronto', desde: atual }, ...extra,
});
async function criar(matricula: string, extra: Record<string, unknown> = {}): Promise<FichaMilitar> {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo(matricula, extra));
  expect(r.status).toBe(201);
  return r.json();
}
const ficha = async (id: string): Promise<FichaMilitar> => (await api.pedir('escalante', 'GET', `/api/militares/${id}`)).json();

beforeAll(async () => {
  api = await montarApi();
  const postos: Posto[] = await (await api.pedir('escalante', 'GET', '/api/postos')).json();
  sd = postos.find((p) => p.sigla === 'SD BM')!.id;
  cb = postos.find((p) => p.sigla === 'CB BM')!.id;
  const tipos = (await api.banco.query<{ id: string; nome: string }>('select id, nome from tipo_afastamento')).rows;
  ferias = tipos.find((t) => t.nome === 'Férias')!.id;
  lts = tipos.find((t) => t.nome === 'LTS')!.id;
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('cadastro de militares', () => {
  it('postos em ordem de hierarquia e equipes da unidade', async () => {
    const postos: Posto[] = await (await api.pedir('escalante', 'GET', '/api/postos')).json();
    expect(postos[0]!.sigla).toBe('SD BM');
    const equipes = await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/equipes`)).json();
    expect(equipes).toEqual([{ id: alfa, nome: 'Alfa', ordemCiclo: 1 }]);
  });

  it('cria militar com a primeira lotação', async () => {
    const f = await criar('990101-1', { motorista: true, cnh: ['B'] });
    expect(f).toMatchObject({ matricula: '990101-1', posto: 'SD BM', equipe: 'Alfa', jornada: 'pronto', motorista: 'B', pendencias: [] });
    expect(f.lotacoes).toEqual([{ id: expect.any(String), unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', desde: `${atual}-01`, ate: null }]);
  });

  it('matrícula repetida é 409', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990101-1'));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe um militar com essa matrícula.');
  });

  it('CNH sem quadro de motoristas é 400', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo('990109-9', { cnh: ['B'] }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos.cnh).toBe('Marque o quadro de motoristas antes de escolher a CNH.');
  });

  it('lista do mês traz situação e pendências', async () => {
    const m = await criar('990102-2', { antiguidade: null, lotacao: { equipeId: null, jornada: 'pronto', desde: atual } });
    await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${atual}-03`, fim: `${atual}-05` });
    const lista: LinhaMilitar[] = await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();
    const linha = lista.find((l) => l.matricula === '990102-2')!;
    expect(linha.situacao).toBe(`LTS de 03/${atual.slice(5)} a 05/${atual.slice(5)}`);
    expect(linha.pendencias).toEqual(['Pronto sem equipe', 'Sem antiguidade']);
  });

  it('lista ordena por posto, antiguidade (vazia por último) e nome', async () => {
    await criar('990103-3', { postoGradId: cb, nomeGuerra: 'ZULU', antiguidade: 2 });
    await criar('990104-4', { postoGradId: cb, nomeGuerra: 'ALFA', antiguidade: null });
    await criar('990105-5', { postoGradId: cb, nomeGuerra: 'BRAVO', antiguidade: 1 });
    const lista: LinhaMilitar[] = await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();
    expect(lista.filter((l) => l.posto === 'CB BM').map((l) => l.nomeGuerra)).toEqual(['BRAVO', 'ZULU', 'ALFA']);
  });
});

describe('lotações', () => {
  it('transferência fecha a lotação anterior no último dia do mês', async () => {
    const m = await criar('990106-6');
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/lotacoes`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: proximo });
    expect(r.status).toBe(201);
    const f = await ficha(m.id);
    const ultimoDia = new Date(Date.UTC(Number(proximo.slice(0, 4)), Number(proximo.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
    expect(f.lotacoes.map((l) => [l.desde, l.ate, l.jornada])).toEqual([
      [`${proximo}-01`, null, 'adm'],
      [`${atual}-01`, ultimoDia, 'pronto'],
    ]);
  });

  it('transferência antes da lotação aberta é 409', async () => {
    const m = await criar('990107-7');
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/lotacoes`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: atual });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/^A transferência precisa ser depois de /);
  });
});

describe('afastamentos', () => {
  let m: FichaMilitar;
  beforeAll(async () => {
    m = await criar('990108-8');
  });

  it('férias em duas partes no mesmo mês', async () => {
    for (const [i, f] of [['01', '10'], ['20', '28']]) {
      const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${proximo}-${i}`, fim: `${proximo}-${f}` });
      expect(r.status).toBe(201);
    }
    expect((await ficha(m.id)).afastamentos).toHaveLength(2);
  });

  it('afastamento sobreposto é 409 legível', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${proximo}-05`, fim: `${proximo}-22` });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('As datas se sobrepõem a outro período já cadastrado.');
  });

  it('fim antes do início é 400', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: lts, inicio: `${proximo}-15`, fim: `${proximo}-14` });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.fim).toBe('O fim precisa ser no mesmo dia do início ou depois.');
  });

  it('editar e apagar afastamento', async () => {
    const [primeiro] = (await ficha(m.id)).afastamentos;
    const ed = await api.pedir('escalante', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { fim: `${proximo}-12` });
    expect(ed.status).toBe(200);
    const fimDepoisDoInicio = await api.pedir('escalante', 'PATCH', `/api/afastamentos/${primeiro!.id}`, { inicio: `${proximo}-13` });
    expect(fimDepoisDoInicio.status).toBe(400);
    expect((await api.pedir('escalante', 'DELETE', `/api/afastamentos/${primeiro!.id}`)).status).toBe(204);
    expect((await ficha(m.id)).afastamentos).toHaveLength(1);
  });
});

describe('antiguidade repetida', () => {
  const listaDaSecao = async (): Promise<LinhaMilitar[]> =>
    (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${atual}`)).json();

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
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${d.id}`, { ativo: false })).status).toBe(200);
    expect((await ficha(c.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
  });

  it('desfeita a repetição, a pendência some', async () => {
    const e = await criar('990124-4', { nomeGuerra: 'REPETIDOE', antiguidade: 779 });
    const f = await criar('990125-5', { nomeGuerra: 'REPETIDOF', antiguidade: 779 });
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${f.id}`, { antiguidade: 780 })).status).toBe(200);
    expect((await ficha(e.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
    expect((await ficha(f.id)).pendencias.some((p) => p.startsWith('Antiguidade repetida'))).toBe(false);
  });
});

describe('motorista e permissões', () => {
  it('desmarcar motorista limpa a CNH', async () => {
    const m = await criar('990110-0', { motorista: true, cnh: ['D'] });
    const r = await api.pedir('escalante', 'PATCH', `/api/militares/${m.id}`, { motorista: false });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ noQuadroDeMotoristas: false, cnh: [], motorista: null });
  });

  it('ficha mostra a CNH pela hierarquia', async () => {
    const m = await criar('990111-1', { motorista: true, cnh: ['D'] });
    expect(m.cnhPorHierarquia).toEqual(['C', 'B']);
  });

  it('escalante de outra unidade não edita (403)', async () => {
    const r = await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/militares`, novo('990112-2', { lotacao: { equipeId: null, jornada: 'adm', desde: atual } }));
    expect(r.status).toBe(201);
    const id = (await r.json()).id;
    expect((await api.pedir('escalante', 'PATCH', `/api/militares/${id}`, { nomeGuerra: 'MUDOU' })).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', `/api/militares/${id}`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `/api/unidades/${api.ids.secao}/militares`)).status).toBe(403);
  });

  it('a gravação fica na auditoria com o usuário', async () => {
    const m = await criar('990113-3');
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'militar' and registro_id = $1", [m.id]);
    expect(rows[0]!.usuario_id).toBe(api.usuarios.escalante);
  });

  it('transferência para unidade sem papel é 403', async () => {
    const m = await criar('990114-4');
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/lotacoes`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: proximo });
    expect(r.status).toBe(403);
  });

  it('transferência marcada para o mês seguinte não tira o acesso da seção atual', async () => {
    const m = await criar('990115-5');
    // o administrador registra a ida para a 2ª SB no mês que vem
    expect((await api.pedir('admin', 'POST', `/api/militares/${m.id}/lotacoes`, { unidadeId: outraSecao, equipeId: null, jornada: 'adm', desde: proximo })).status).toBe(201);
    expect((await api.pedir('escalante', 'GET', `/api/militares/${m.id}`)).status).toBe(200);
    const af = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/afastamentos`, { tipoAfastamentoId: ferias, inicio: `${atual}-02`, fim: `${atual}-03` });
    expect(af.status).toBe(201);
  });
});
