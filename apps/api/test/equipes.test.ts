import { type Equipe } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { garantirEquipesPadrao } from '../src/cadastros/equipes-padrao.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.64, Task 2: o cadastro das equipes herdadas. Cenário fictício: as seis padrão na corporação; o 2º GB e a 1ª SB (abaixo dele) com equipes ADM próprias; uma seção irmã com outra.
let api: ApiDeTeste;
let outraSecao: string;
let padrao: Map<string, string>;
const lista = async (quem: 'admin' | 'gestorGb' | 'escalante' | 'semPapel', unidade: string): Promise<Response> => api.pedir(quem, 'GET', `/api/unidades/${unidade}/equipes`);
const ler = async (unidade: string): Promise<Equipe[]> => (await lista('gestorGb', unidade)).json();
const criar = (quem: 'admin' | 'gestorGb' | 'escalante', unidade: string, corpo: unknown) => api.pedir(quem, 'POST', `/api/unidades/${unidade}/equipes`, corpo);
const mudar = (quem: 'admin' | 'gestorGb' | 'escalante', id: string, corpo: unknown) => api.pedir(quem, 'PATCH', `/api/equipes/${id}`, corpo);
const excluir = (quem: 'admin' | 'gestorGb' | 'escalante', id: string) => api.pedir(quem, 'DELETE', `/api/equipes/${id}`);
const nomes = (l: Equipe[]) => l.map((e) => e.nome);

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  padrao = await garantirEquipesPadrao(api.banco);
  await inserir(api.banco, 'equipe', { unidade_id: api.ids.gb, nome: 'Plantão do GB', tipo: 'adm' });
  await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Apoio da seção', tipo: 'adm' });
  await inserir(api.banco, 'equipe', { unidade_id: outraSecao, nome: 'Da irmã', tipo: 'adm' });
});
afterAll(async () => {
  await api.fechar();
});

describe('as equipes que a unidade vê', () => {
  it('vê as da corporação, as de cima e as suas, e não as de unidade irmã; Pronto pela posição, ADM por nome, depois a Externa; `herdada` diz se não é dela', async () => {
    const l = await ler(api.ids.secao);
    expect(nomes(l)).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta', 'ADM', 'Apoio da seção', 'Plantão do GB', 'Externa']);
    expect(l.map((e) => [e.nome, e.herdada])).toEqual([
      ['Alfa', true], ['Bravo', true], ['Charlie', true], ['Delta', true], ['ADM', true], ['Apoio da seção', false], ['Plantão do GB', true], ['Externa', true],
    ]);
    expect(l[0]).toMatchObject({ tipo: 'pronto', posicaoCiclo: 1, ativa: true, unidadeSigla: 'CBMPE' });
    expect(l.find((e) => e.nome === 'Externa')).toMatchObject({ tipo: 'externa', posicaoCiclo: null });
    // a irmã e a seção não se enxergam; o 2º GB vê a sua, e não as de baixo
    expect(nomes(await ler(outraSecao))).not.toContain('Apoio da seção');
    expect(nomes(await ler(api.ids.gb))).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta', 'ADM', 'Plantão do GB', 'Externa']);
  });

  it('quem não tem nível de cadastro na unidade recebe 403', async () => {
    expect((await lista('semPapel', api.ids.secao)).status).toBe(403);
  });
});

describe('criar', () => {
  it('o gestor cria uma equipe ADM na própria unidade; ela nasce ativa e não é herdada', async () => {
    const r = await criar('gestorGb', api.ids.gb, { nome: 'Plantão extra', tipo: 'adm' });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ nome: 'Plantão extra', tipo: 'adm', posicaoCiclo: null, ativa: true, herdada: false, unidadeSigla: '2º GB' });
  });

  it('só se cria ADM por rota: "pronto" e "externa" são 400, e quem não é gestor é 403', async () => {
    expect((await criar('gestorGb', api.ids.gb, { nome: 'Quinta', tipo: 'pronto' })).status).toBe(400);
    expect((await criar('gestorGb', api.ids.gb, { nome: 'Outra Externa', tipo: 'externa' })).status).toBe(400);
    expect((await criar('gestorGb', api.ids.gb, { nome: 'Sem tipo' })).status).toBe(400);
    expect((await criar('escalante', api.ids.secao, { nome: 'Do escalante', tipo: 'adm' })).status).toBe(403);
  });

  it('o nome não se repete, sem diferenciar maiúsculas nem acentos: contra as que a unidade vê e contra as de baixo dela', async () => {
    const contraVista = await criar('gestorGb', api.ids.gb, { nome: 'PLANTAO DO gb', tipo: 'adm' });
    expect(contraVista.status).toBe(409);
    expect((await contraVista.json()).erro).toBe('Já existe uma equipe com esse nome.');
    // o nome de uma padrão também conta (Alfa vem de cima)
    expect((await criar('gestorGb', api.ids.gb, { nome: 'alfa', tipo: 'adm' })).status).toBe(409);
    // e contra uma equipe de unidade abaixo: "Apoio da seção" é da 1ª SB, e o 2º GB não cria o mesmo nome
    const deBaixo = await criar('gestorGb', api.ids.gb, { nome: 'APOIO DA SEÇÃO', tipo: 'adm' });
    expect(deBaixo.status).toBe(409);
    expect((await deBaixo.json()).campos).toEqual({ nome: 'Já existe uma equipe com esse nome.' });
    // um nome que só uma irmã tem pode ser criado em outra irmã
    expect((await criar('admin', api.ids.secao, { nome: 'Da irmã', tipo: 'adm' })).status).toBe(201);
  });
});

describe('mudar', () => {
  it('o gestor renomeia a da própria unidade; a herdada é 403 com a frase fixa', async () => {
    const propria = nomes(await ler(api.ids.gb)).includes('Plantão do GB') ? (await ler(api.ids.gb)).find((e) => e.nome === 'Plantão do GB')! : null;
    const r = await mudar('gestorGb', propria!.id, { nome: 'Plantão do Grupamento' });
    expect(r.status).toBe(200);
    expect((await r.json()).nome).toBe('Plantão do Grupamento');
    const alfa = padrao.get('Alfa')!;
    const recusada = await mudar('gestorGb', alfa, { nome: 'Equipe 1' });
    expect(recusada.status).toBe(403);
    expect((await recusada.json()).erro).toBe('Esta equipe é de CBMPE; só quem a criou pode mudar.');
  });

  it('o administrador renomeia a Alfa na corporação e a posição e o tipo não mudam; o renome fica na auditoria', async () => {
    const alfa = padrao.get('Alfa')!;
    const r = await mudar('admin', alfa, { nome: 'Equipe 1' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ nome: 'Equipe 1', tipo: 'pronto', posicaoCiclo: 1 });
    const registro = (await api.banco.query<{ acao: string; antes: { nome: string }; depois: { nome: string }; usuario_id: string | null }>("select acao, antes, depois, usuario_id from auditoria where tabela = 'equipe' and registro_id = $1 and acao = 'update' order by id desc limit 1", [alfa])).rows[0]!;
    expect(registro.antes.nome).toBe('Alfa');
    expect(registro.depois.nome).toBe('Equipe 1');
    expect(registro.usuario_id).not.toBeNull();
    // devolve o nome para os outros testes
    await mudar('admin', alfa, { nome: 'Alfa' });
  });

  it('o tipo e a posição não mudam por rota (o corpo só aceita nome e ativa), e um nome repetido é 409', async () => {
    const alfa = padrao.get('Alfa')!;
    expect((await mudar('admin', alfa, {})).status).toBe(400);
    const r = await mudar('admin', alfa, { nome: 'bravo' });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe uma equipe com esse nome.');
    const [a] = ((await (await lista('admin', api.ids.raiz)).json()) as Equipe[]).filter((e) => e.id === alfa);
    expect(a).toMatchObject({ tipo: 'pronto', posicaoCiclo: 1 });
  });

  it('a equipe que não existe é 404', async () => {
    expect((await mudar('admin', '00000000-0000-4000-8000-000000000000', { nome: 'X' })).status).toBe(404);
  });
});

describe('excluir', () => {
  it('sem uso, apaga; com uso em algum mês, desativa e diz isso', async () => {
    const livre = (await (await criar('gestorGb', api.ids.gb, { nome: 'Para apagar', tipo: 'adm' })).json()) as Equipe;
    const r = await excluir('gestorGb', livre.id);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ desativada: false });
    expect((await api.banco.query('select 1 from equipe where id = $1', [livre.id])).rows).toHaveLength(0);

    const usada = (await (await criar('gestorGb', api.ids.gb, { nome: 'Já usada', tipo: 'adm' })).json()) as Equipe;
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const m = await inserir(api.banco, 'militar', { matricula: '100777-7', posto_grad_id: posto, nome_guerra: 'USO', de_teste: true });
    await inserir(api.banco, 'rastreio', { militar_id: m, unidade_id: api.ids.gb, equipe_id: usada.id, jornada: 'adm', desde: '2026-09-01', ate: '2026-09-30', situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
    const d = await excluir('gestorGb', usada.id);
    expect(d.status).toBe(200);
    expect(await d.json()).toEqual({ desativada: true, aviso: 'A equipe já foi usada; ela foi desativada em vez de apagada.' });
    expect((await api.banco.query<{ ativa: boolean }>('select ativa from equipe where id = $1', [usada.id])).rows[0]!.ativa).toBe(false);
    // o histórico fica, e dá para reativar
    expect((await mudar('gestorGb', usada.id, { ativa: true })).status).toBe(200);
  });

  it('as padrão da corporação não se excluem, só se renomeiam', async () => {
    for (const nome of ['Alfa', 'Delta', 'Externa']) {
      const r = await excluir('admin', padrao.get(nome)!);
      expect(r.status, nome).toBe(409);
    }
    // a ADM padrão também, enquanto for a única da corporação
    const adm = padrao.get('ADM')!;
    expect((await excluir('admin', adm)).status).toBe(409);
  });

  it('quem não é gestor da unidade recebe 403', async () => {
    const apoio = (await ler(api.ids.secao)).find((e) => e.nome === 'Apoio da seção')!;
    expect((await excluir('escalante', apoio.id)).status).toBe(403);
  });
});
