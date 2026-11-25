import { mesPorExtenso, somarMeses, type MeuVoluntariado, type RegistroDeAlteracao, type VoluntariadoDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { lancar } from '../src/voluntariado/lancamento.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Cenário fictício (D7): o mês de coleta é o mês seguinte ao atual; a seção (1ª SB) tem os blocos de sempre (PE Seguro em três turnos de 8 h).
// O MARCADOR é um militar comum com conta (sem nível de acesso); o GESTORMIL é gestor da seção e também militar lotado nela.
let api: ApiDeTeste;
let posto: string;
let ativa: string;
let outra: string;
let marcador: Pessoa;
let gestorMil: Pessoa;
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const passado = somarMeses(atual, -1);
const secao = () => `/api/unidades/${api.ids.secao}`;
const dia = (m: string, n: number) => `${m}-${String(n).padStart(2, '0')}`;

const fechada = (m: string) => `A coleta de ${mesPorExtenso(m)} está fechada. Fale com o escalante da sua seção.`;
const soAPartirDe = `Só dá para marcar a partir de ${mesPorExtenso(atual)}.`;

const coleta = (quem: 'admin' | 'escalante' | 'gestorGb' | 'semPapel', m: string, aberta: boolean, unidade = api.ids.secao) =>
  api.pedir(quem, 'PUT', `/api/unidades/${unidade}/voluntariado/${m}/coleta`, { aberta });
const abrir = async (m = mes, unidade = api.ids.secao) => expect((await coleta('gestorGb', m, true, unidade)).status).toBe(200);
const fechar = async (m = mes, unidade = api.ids.secao) => expect((await coleta('gestorGb', m, false, unidade)).status).toBe(200);
const meu = async (quem: Pessoa, m = mes): Promise<MeuVoluntariado> => (await quem.pedir('GET', `/api/eu/voluntariado/${m}`)).json();
const marcar = (quem: Pessoa, m: string, faixas: { data: string; inicio: string; fim: string }[]) => quem.pedir('PUT', `/api/eu/voluntariado/${m}`, { faixas });
const doMes = async (m = mes): Promise<VoluntariadoDoMes> => (await api.pedir('escalante', 'GET', `${secao()}/voluntariado/${m}`)).json();
const registros = async (militarId: string) => Number((await api.banco.query<{ n: number }>('select count(*)::int as n from registro_de_alteracao where militar_id = $1', [militarId])).rows[0]!.n);

async function lotar(militarId: string, unidadeId: string, o: { desde?: string; ate?: string | null } = {}) {
  await inserir(api.banco, 'rastreio', { militar_id: militarId, unidade_id: unidadeId, jornada: 'pronto', desde: o.desde ?? `${atual}-01`, ate: o.ate ?? null, situacao_id: ativa });
}

beforeAll(async () => {
  api = await montarApi();
  posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  ativa = await situacaoDoMilitar(api.banco, 'Ativa');
  outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEC-COLETA', nome: 'Seção da outra coleta', mae_id: api.ids.gb, desde: '2026-11-01' });
  const pe = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome: 'PE Seguro', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#3C5F9C' })).json()) as { id: string };
  for (const [letra, inicio, fim] of [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']] as const) await api.pedir('escalante', 'POST', `/api/servicos/${pe.id}/turnos`, { letra, inicio, fim });
  const escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id as string;
  await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pe.id] });
  marcador = await entrarComo(api, { matricula: '990951-1', nome: 'MARCADOR' });
  await lotar(marcador.militarId, api.ids.secao);
  gestorMil = await entrarComo(api, { matricula: '990952-2', nome: 'GESTORMIL', nivel: { papel: 'gestor', unidadeId: api.ids.secao } });
  await lotar(gestorMil.militarId, api.ids.secao);
});
afterAll(async () => {
  await api.fechar();
});

describe('a coleta do voluntariado', () => {
  it('o gestor abre e fecha a coleta do mês; a lista do mês diz se está aberta', async () => {
    expect((await doMes()).coletaAberta).toBe(false);
    const aberta = await coleta('gestorGb', mes, true);
    expect(aberta.status).toBe(200);
    expect(((await aberta.json()) as VoluntariadoDoMes).coletaAberta).toBe(true);
    expect((await doMes()).coletaAberta).toBe(true);
    // abrir de novo não dá erro
    expect((await coleta('gestorGb', mes, true)).status).toBe(200);
    const fechou = await coleta('gestorGb', mes, false);
    expect(((await fechou.json()) as VoluntariadoDoMes).coletaAberta).toBe(false);
    expect((await doMes()).coletaAberta).toBe(false);
  });

  it('quem abriu e quando fica gravado (a coleta entra na auditoria)', async () => {
    await abrir();
    const { rows } = await api.banco.query<{ aberta_por: string }>('select aberta_por from voluntariado_coleta where unidade_id = $1 and mes = $2::date', [api.ids.secao, `${mes}-01`]);
    expect(rows[0]!.aberta_por).toBe(api.usuarios.gestorGb);
    expect(Number((await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'voluntariado_coleta'")).rows[0]!.n)).toBeGreaterThan(0);
    await fechar();
  });

  it('o escalante e o militar comum não ligam a coleta (403); o administrador liga', async () => {
    expect((await coleta('escalante', mes, true)).status).toBe(403);
    expect((await coleta('semPapel', mes, true)).status).toBe(403);
    expect((await coleta('admin', mes, true)).status).toBe(200);
    await fechar();
  });

  it('mês passado não abre (409) e o mês deve estar no formato aaaa-mm (400)', async () => {
    const r = await coleta('gestorGb', passado, true);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { erro: string }).erro).toBe(`A coleta só abre a partir de ${mesPorExtenso(atual)}.`);
    expect((await coleta('gestorGb', '2026-13', true)).status).toBe(400);
    expect((await api.pedir('gestorGb', 'PUT', `${secao()}/voluntariado/${mes}/coleta`, { aberta: 'sim' })).status).toBe(400);
  });
});

describe('o militar marca o próprio voluntariado', () => {
  it('com a coleta fechada ele vê o mês, não marca, e a resposta traz o motivo em texto pronto (409 ao tentar)', async () => {
    await fechar();
    const v = await meu(marcador);
    expect(v).toMatchObject({ militarId: marcador.militarId, mes, coletaAberta: false, podeMarcar: false, motivo: fechada(mes), unidadeSigla: '1ª SB', voluntarioJes: false });
    const r = await marcar(marcador, mes, [{ data: dia(mes, 5), inicio: '08:00', fim: '16:00' }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { erro: string }).erro).toBe(fechada(mes));
  });

  it('com a coleta aberta ele marca; os blocos vêm da seção dele; o escalante vê a marcação como "pelo militar"', async () => {
    await abrir();
    const antes = await meu(marcador);
    expect(antes).toMatchObject({ coletaAberta: true, podeMarcar: true, motivo: null });
    expect(antes.blocos).toEqual([{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '24:00' }]);
    const r = await marcar(marcador, mes, [{ data: dia(mes, 5), inicio: '08:00', fim: '16:00' }, { data: dia(mes, 5), inicio: '16:00', fim: '24:00' }, { data: dia(mes, 6), inicio: '00:00', fim: '08:00' }]);
    expect(r.status).toBe(200);
    const depois = (await r.json()) as MeuVoluntariado;
    // as faixas que se tocam no mesmo dia viram uma só
    expect(depois.faixas).toEqual([{ data: dia(mes, 5), inicio: '08:00', fim: '24:00' }, { data: dia(mes, 6), inicio: '00:00', fim: '08:00' }]);
    const lista = (await doMes()).militares.find((m) => m.militarId === marcador.militarId)!;
    expect(lista).toMatchObject({ lancado: true, horas: 24, dias: 2, peloMilitar: true, correcoes: 0 });
    const origens = (await api.banco.query<{ origem: string }>('select distinct origem from disponibilidade where militar_id = $1', [marcador.militarId])).rows.map((x) => x.origem);
    expect(origens).toEqual(['militar']);
    // a página do militar na tela do escalante lê as mesmas faixas
    const dele = (await (await api.pedir('escalante', 'GET', `/api/militares/${marcador.militarId}/voluntariado/${mes}`)).json()) as { faixas: unknown[] };
    expect(dele.faixas).toHaveLength(2);
  });

  it('marcar de novo substitui o mês; lista vazia vale ("não tenho horário")', async () => {
    await abrir();
    await marcar(marcador, mes, [{ data: dia(mes, 9), inicio: '08:00', fim: '16:00' }]);
    expect((await meu(marcador)).faixas).toEqual([{ data: dia(mes, 9), inicio: '08:00', fim: '16:00' }]);
    expect((await marcar(marcador, mes, [])).status).toBe(200);
    const v = await meu(marcador);
    expect(v.faixas).toEqual([]);
    expect((await doMes()).militares.find((m) => m.militarId === marcador.militarId)).toMatchObject({ lancado: true, horas: 0, peloMilitar: true });
  });

  it('faixa fora dos blocos do dia é aceita e devolvida; faixa em outro mês é recusada (400)', async () => {
    await abrir();
    const r = await marcar(marcador, mes, [{ data: dia(mes, 12), inicio: '09:30', fim: '11:00' }]);
    expect(r.status).toBe(200);
    expect(((await r.json()) as MeuVoluntariado).faixas).toEqual([{ data: dia(mes, 12), inicio: '09:30', fim: '11:00' }]);
    const fora = await marcar(marcador, mes, [{ data: dia(somarMeses(mes, 1), 3), inicio: '08:00', fim: '16:00' }]);
    expect(fora.status).toBe(400);
    expect(((await fora.json()) as { campos: Record<string, string> }).campos['faixas.0']).toBe(`Use um dia de ${mesPorExtenso(mes)}.`);
    expect((await marcar(marcador, mes, [{ data: dia(mes, 12), inicio: '16:00', fim: '08:00' }])).status).toBe(400);
  });

  it('mês passado não aceita marcação, mesmo que haja uma coleta antiga aberta (409)', async () => {
    await inserir(api.banco, 'voluntariado_coleta', { unidade_id: api.ids.secao, mes: `${passado}-01` });
    const v = await meu(marcador, passado);
    expect(v).toMatchObject({ coletaAberta: false, podeMarcar: false, motivo: soAPartirDe });
    const r = await marcar(marcador, passado, [{ data: dia(passado, 5), inicio: '08:00', fim: '16:00' }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { erro: string }).erro).toBe(soAPartirDe);
    await api.banco.query('delete from voluntariado_coleta where unidade_id = $1 and mes = $2::date', [api.ids.secao, `${passado}-01`]);
  });

  it('o voluntário JES continua sendo um atributo do cadastro: marcar não exige, e a tela diz se ele tem', async () => {
    await abrir();
    expect((await meu(marcador)).voluntarioJes).toBe(false);
    await api.banco.query('update militar set voluntario_jes = true where id = $1', [marcador.militarId]);
    expect((await meu(marcador)).voluntarioJes).toBe(true);
    await api.banco.query('update militar set voluntario_jes = false where id = $1', [marcador.militarId]);
  });

  it('sem lotação no mês ele não marca (409), nem vê o mês como marcável', async () => {
    const sem = await entrarComo(api, { matricula: '990953-3', nome: 'SEMLOTACAO' });
    await abrir();
    const v = await sem.pedir('GET', `/api/eu/voluntariado/${mes}`);
    expect(v.status).toBe(409);
    expect(((await v.json()) as { erro: string }).erro).toBe(`Você não está lotado em nenhuma seção em ${mesPorExtenso(mes)}.`);
    const r = await marcar(sem, mes, [{ data: dia(mes, 5), inicio: '08:00', fim: '16:00' }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { erro: string }).erro).toBe(`Você não está lotado em nenhuma seção em ${mesPorExtenso(mes)}.`);
  });

  it('o mês fora do formato é 400, e sem sessão é 401', async () => {
    expect((await marcador.pedir('GET', '/api/eu/voluntariado/2026-13')).status).toBe(400);
    expect((await marcar(marcador, 'dezembro', [])).status).toBe(400);
    const r = await api.app.request('http://localhost:8787/api/eu/voluntariado/' + mes, { headers: { Origin: 'http://localhost:8787' } });
    expect(r.status).toBe(401);
  });

  it('Review Focus 1: o militar que muda de seção no mês marca na seção em que fica o maior trecho, e é a coleta dela que vale', async () => {
    const mudou = await entrarComo(api, { matricula: '990954-4', nome: 'MUDOU' });
    await lotar(mudou.militarId, api.ids.secao, { desde: `${atual}-01`, ate: `${mes}-09` });
    await lotar(mudou.militarId, outra, { desde: `${mes}-10` });
    await abrir(mes, api.ids.secao);
    await fechar(mes, outra);
    const fechadaLa = await mudou.pedir('GET', `/api/eu/voluntariado/${mes}`);
    expect(await fechadaLa.json()).toMatchObject({ unidadeSigla: 'SEC-COLETA', coletaAberta: false, podeMarcar: false });
    expect((await marcar(mudou, mes, [{ data: dia(mes, 20), inicio: '08:00', fim: '16:00' }])).status).toBe(409);
    await abrir(mes, outra);
    const aberta = await mudou.pedir('PUT', `/api/eu/voluntariado/${mes}`, { faixas: [{ data: dia(mes, 20), inicio: '08:00', fim: '16:00' }] });
    expect(aberta.status).toBe(200);
    expect(((await aberta.json()) as MeuVoluntariado).unidadeSigla).toBe('SEC-COLETA');
    // o que ele marcou aparece na lista da seção em que ele está no mês, e não na da outra
    const lista = (await (await api.pedir('admin', 'GET', `/api/unidades/${outra}/voluntariado/${mes}`)).json()) as VoluntariadoDoMes;
    expect(lista.militares.find((m) => m.militarId === mudou.militarId)).toMatchObject({ lancado: true, peloMilitar: true });
    await fechar(mes, api.ids.secao);
    await fechar(mes, outra);
  });

  it('Review Focus 5: o gestor que também é militar marca o próprio pela rota pessoal; conta como militar e não deixa registro', async () => {
    await abrir();
    const r = await marcar(gestorMil, mes, [{ data: dia(mes, 7), inicio: '08:00', fim: '16:00' }]);
    expect(r.status).toBe(200);
    const lista = (await doMes()).militares.find((m) => m.militarId === gestorMil.militarId)!;
    expect(lista).toMatchObject({ peloMilitar: true, correcoes: 0 });
    expect(await registros(gestorMil.militarId)).toBe(0);
    // e a coleta fechada vale para ele também, apesar do nível de acesso
    await fechar();
    expect((await marcar(gestorMil, mes, [])).status).toBe(409);
  });
});

describe('o aviso da coleta aberta em /api/eu', () => {
  it('traz os meses com coleta aberta na lotação da pessoa, do mês atual em diante', async () => {
    await fechar();
    expect(((await (await marcador.pedir('GET', '/api/eu')).json()) as { coletasAbertas: string[] }).coletasAbertas).toEqual([]);
    await abrir(mes);
    await abrir(atual);
    await inserir(api.banco, 'voluntariado_coleta', { unidade_id: api.ids.secao, mes: `${passado}-01` });
    await inserir(api.banco, 'voluntariado_coleta', { unidade_id: outra, mes: `${somarMeses(mes, 1)}-01` });
    const eu = (await (await marcador.pedir('GET', '/api/eu')).json()) as { coletasAbertas: string[] };
    expect(eu.coletasAbertas).toEqual([atual, mes]);
    await fechar(mes);
    await fechar(atual);
    await api.banco.query('delete from voluntariado_coleta where mes = $1::date or unidade_id = $2', [`${passado}-01`, outra]);
  });

  it('quem não tem lotação hoje recebe a lista vazia', async () => {
    const sem = await entrarComo(api, { matricula: '990955-5', nome: 'SEMLOTA' });
    await abrir(mes);
    expect(((await (await sem.pedir('GET', '/api/eu')).json()) as { coletasAbertas: string[] }).coletasAbertas).toEqual([]);
    await fechar(mes);
  });
});

describe('o registro das correções do escalante', () => {
  let alvo: Pessoa;
  let seq = 0;
  const f = (n: number, inicio: string, fim: string) => ({ data: dia(mes, n), inicio, fim });
  const corrigir = (militarId: string, faixas: { data: string; inicio: string; fim: string }[]) => api.pedir('escalante', 'PUT', `/api/militares/${militarId}/voluntariado/${mes}`, { faixas });
  const registro = async (militarId: string): Promise<RegistroDeAlteracao[]> => (await api.pedir('escalante', 'GET', `/api/militares/${militarId}/voluntariado/${mes}/registro`)).json();
  const naLista = async (militarId: string) => (await doMes()).militares.find((m) => m.militarId === militarId)!;

  beforeAll(async () => {
    alvo = await entrarComo(api, { matricula: '990961-1', nome: 'ALVO' });
    await lotar(alvo.militarId, api.ids.secao);
    await abrir();
    await marcar(alvo, mes, [f(5, '08:00', '16:00'), f(5, '16:00', '24:00'), f(6, '00:00', '08:00')]);
  });

  it('a correção do escalante num mês que o militar preencheu cria uma linha: quem, quando, o antes, o depois e a frase pronta', async () => {
    const r = await corrigir(alvo.militarId, [f(5, '08:00', '16:00'), f(7, '08:00', '16:00')]);
    expect(r.status).toBe(200);
    const [linha, ...resto] = await registro(alvo.militarId);
    expect(resto).toEqual([]);
    expect(linha).toMatchObject({
      tipo: 'voluntariado_corrigido',
      por: { patente: 'SD', nomeGuerra: 'ESCALANTE' },
      data: null,
      justificativa: null,
      antes: [f(5, '08:00', '24:00'), f(6, '00:00', '08:00')],
      depois: [f(5, '08:00', '16:00'), f(7, '08:00', '16:00')],
      texto: 'Tirou 2 faixas e pôs 2 em 3 dias',
    });
    expect(Date.now() - new Date(linha!.em).getTime()).toBeLessThan(60_000);
    // o escalante só corrige: o que o militar marcou não some sem rastro, e a lista do mês conta a correção
    expect(await naLista(alvo.militarId)).toMatchObject({ peloMilitar: true, correcoes: 1 });
  });

  it('Review Focus 4: corrigir sem mudar nada (as mesmas faixas) não cria registro', async () => {
    const r = await corrigir(alvo.militarId, [f(7, '08:00', '16:00'), f(5, '08:00', '16:00')]);
    expect(r.status).toBe(200);
    expect((await registro(alvo.militarId)).length).toBe(1);
  });

  it('Review Focus 3: o militar marca de novo depois da correção: o registro antigo fica e a nova marcação não cria outro', async () => {
    const antes = await registro(alvo.militarId);
    expect((await marcar(alvo, mes, [f(10, '08:00', '16:00')])).status).toBe(200);
    expect(await registro(alvo.militarId)).toEqual(antes);
    expect(await naLista(alvo.militarId)).toMatchObject({ peloMilitar: true, correcoes: 1 });
  });

  it('uma segunda correção cria outra linha, e a lista vem da mais nova para a mais velha', async () => {
    expect((await corrigir(alvo.militarId, [f(10, '08:00', '16:00'), f(11, '16:00', '24:00')])).status).toBe(200);
    const linhas = await registro(alvo.militarId);
    expect(linhas.map((l) => l.texto)).toEqual(['Pôs 1 faixa em 1 dia', 'Tirou 2 faixas e pôs 2 em 3 dias']);
    expect(linhas[0]!.antes).toEqual([f(10, '08:00', '16:00')]);
    expect((await naLista(alvo.militarId)).correcoes).toBe(2);
  });

  it('a frase quando só tira faixas', async () => {
    expect((await corrigir(alvo.militarId, [f(10, '08:00', '16:00')])).status).toBe(200);
    expect((await registro(alvo.militarId))[0]!.texto).toBe('Tirou 1 faixa em 1 dia');
  });

  it('Review Focus 2: o escalante que lança um mês que o militar não preencheu fica como hoje: sem registro e sem "pelo militar"', async () => {
    seq++;
    const id = await inserir(api.banco, 'militar', { matricula: `99097${seq}-${seq}`, posto_grad_id: posto, nome_guerra: `SEMCONTA${seq}` });
    await lotar(id, api.ids.secao);
    expect((await corrigir(id, [f(3, '08:00', '16:00')])).status).toBe(200);
    expect((await corrigir(id, [f(4, '08:00', '16:00')])).status).toBe(200);
    expect(await registro(id)).toEqual([]);
    expect(await naLista(id)).toMatchObject({ lancado: true, peloMilitar: false, correcoes: 0 });
  });

  it('só quem lê a escala da seção lê o registro: o escalante lê; o militar comum recebe 403; mês ou militar inválido dão 400 e 404', async () => {
    expect((await marcador.pedir('GET', `/api/militares/${alvo.militarId}/voluntariado/${mes}/registro`)).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', `/api/militares/${alvo.militarId}/voluntariado/2026-13/registro`)).status).toBe(400);
    expect((await api.pedir('escalante', 'GET', `/api/militares/00000000-0000-4000-8000-000000000000/voluntariado/${mes}/registro`)).status).toBe(404);
  });

  it('a gravação do mês trava o par militar e mês até o fim da transação: o escalante e o militar não gravam o mesmo mês ao mesmo tempo', async () => {
    const travas = await api.banco.transacao(async (tx) => {
      await lancar(tx, alvo.militarId, mes, [], api.usuarios.escalante);
      return Number((await tx.query<{ n: number }>("select count(*)::int as n from pg_locks where locktype = 'advisory'")).rows[0]!.n);
    });
    expect(travas).toBeGreaterThan(0);
    const depois = Number((await api.banco.query<{ n: number }>("select count(*)::int as n from pg_locks where locktype = 'advisory'")).rows[0]!.n);
    expect(depois).toBe(0);
  });
});
