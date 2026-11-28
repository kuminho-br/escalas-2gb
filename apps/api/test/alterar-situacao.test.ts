import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarAlteracaoDeSituacao, conferirAlteracaoDeSituacao, RecusaDaAlteracao } from '../src/cadastros/alterar-situacao.ts';
import { comUsuario } from '../src/banco/banco.ts';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.52, Task 1: a regra de "Alterar situação" como duas funções (conferir sem gravar; aplicar na transação). Dados fictícios (D7): matrículas 995xxx-x.
let api: ApiDeTeste;
let gestorGb: Pessoa;
let escalanteSb: Pessoa;
let semPapel: Pessoa;
let sb1: string;
let sb2: string;
let equipeDaSb2: string;
let desativada: string;
let ativa: string;
let quadroOficial: string;
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const m: Record<string, string> = {};

async function militar(chave: string, matricula: string, desde = dia1) {
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: chave, nome_completo: `Fulano ${chave}` });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: sb1, jornada: 'adm', desde });
  m[chave] = id;
  return id;
}
const alteracao = (extra: Record<string, unknown> = {}) => ({ unidadeId: sb1, equipeId: null, jornada: 'adm' as const, desde: hoje, ...extra });
const conferir = (quem: Pessoa, chave: string, d: Record<string, unknown> = {}) => conferirAlteracaoDeSituacao(api.banco, quem.usuarioId, m[chave]!, alteracao(d), hoje);
const aplicar = (chave: string, d: Record<string, unknown> = {}, unidadeAbertaConferida?: string | null) =>
  comUsuario(api.banco, gestorGb.usuarioId, (tx) => aplicarAlteracaoDeSituacao(tx, gestorGb.usuarioId, m[chave]!, alteracao(d), unidadeAbertaConferida));
const periodos = async (chave: string) =>
  (await api.banco.query<{ desde: string; ate: string | null; jornada: string }>("select to_char(desde,'YYYY-MM-DD') as desde, to_char(ate,'YYYY-MM-DD') as ate, jornada from rastreio where militar_id = $1 order by desde", [m[chave]])).rows;

beforeAll(async () => {
  api = await montarApi();
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  equipeDaSb2 = await inserir(api.banco, 'equipe', { unidade_id: sb2, nome: 'Bravo', tipo: 'pronto', posicao_ciclo: 1 });
  ativa = (await api.banco.query<{ id: string }>("select id from situacao_militar where nome = 'Ativa'")).rows[0]!.id;
  desativada = await inserir(api.banco, 'situacao_militar', { nome: 'Situação encerrada', escalavel: false, ativo: false });
  quadroOficial = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QOC'")).rows[0]!.id;
  gestorGb = await entrarComo(api, { matricula: '995001-1', nome: 'CGESTOR', nivel: { papel: 'gestor', unidadeId: api.ids.gb } });
  escalanteSb = await entrarComo(api, { matricula: '995002-2', nome: 'CESCAL', nivel: { papel: 'escalante', unidadeId: sb1 } });
  semPapel = await entrarComo(api, { matricula: '995003-3', nome: 'CSEMPAPEL' });
  for (const [i, c] of ['PODE', 'MESMODIA', 'DEPOIS', 'ANTES', 'QUADRO', 'OUTRO', 'MUDOU'].entries()) await militar(c, `99510${i}-${i}`);
  // ANTES tem o período aberto começando amanhã
  await api.banco.query('update rastreio set desde = $2 where militar_id = $1', [m.ANTES, somarDias(hoje, 1)]);
});
afterAll(async () => {
  await api.fechar();
});

describe('conferirAlteracaoDeSituacao: sem gravar', () => {
  it('quem tem nível de acesso acima da lotação pode: null, e nada é gravado', async () => {
    expect(await conferir(gestorGb, 'PODE', { jornada: 'pronto' })).toBeNull();
    expect((await periodos('PODE'))[0]!.jornada).toBe('adm');
  });

  it('sem_permissao: o escalante da própria seção não muda a jornada (é do Pecúlio, de quem está acima)', async () => {
    const r = await conferir(escalanteSb, 'PODE', { jornada: 'pronto' });
    expect(r).toMatchObject({ codigo: 'sem_permissao', status: 403 });
    expect(r!.texto).toMatch(/^Este campo é alterado por quem tem nível de acesso no /);
  });

  it('sem_permissao: quem não tem nível nenhum recebe a frase da tela; militar que não existe é nao_achou (404)', async () => {
    expect(await conferir(semPapel, 'PODE')).toMatchObject({ codigo: 'sem_permissao', status: 403, texto: 'Esta tela é dos auxiliares administrativos e gestores.' });
    expect(await conferirAlteracaoDeSituacao(api.banco, gestorGb.usuarioId, '00000000-0000-4000-8000-000000000000', alteracao(), hoje)).toMatchObject({ codigo: 'nao_achou', status: 404 });
  });

  it('equipe: a equipe de outra unidade é recusada no campo equipeId', async () => {
    expect(await conferir(gestorGb, 'PODE', { equipeId: equipeDaSb2 })).toMatchObject({ codigo: 'equipe', status: 400, campo: 'equipeId', texto: 'Escolha uma equipe da unidade da lotação.' });
  });

  it('situacao: a que não existe e a desativada são recusadas no campo situacaoId', async () => {
    expect(await conferir(gestorGb, 'PODE', { situacaoId: '00000000-0000-4000-8000-000000000000' })).toMatchObject({ codigo: 'situacao', campo: 'situacaoId', texto: 'Situação não encontrada.' });
    expect(await conferir(gestorGb, 'PODE', { situacaoId: desativada })).toMatchObject({ codigo: 'situacao', texto: 'Esta situação está desativada.' });
  });
});

describe('aplicarAlteracaoDeSituacao: grava na transação', () => {
  it('Review Focus 1, no mesmo dia do período aberto: substitui o período (criado: false)', async () => {
    await api.banco.query('update rastreio set desde = $2 where militar_id = $1', [m.MESMODIA, hoje]);
    expect(await aplicar('MESMODIA', { jornada: 'pronto' })).toEqual({ criado: false });
    expect(await periodos('MESMODIA')).toEqual([{ desde: hoje, ate: null, jornada: 'pronto' }]);
  });

  it('Review Focus 1, em dia posterior: fecha o aberto na véspera e abre outro (criado: true)', async () => {
    expect(await aplicar('DEPOIS', { jornada: 'pronto' })).toEqual({ criado: true });
    expect(await periodos('DEPOIS')).toEqual([{ desde: dia1, ate: somarDias(hoje, -1), jornada: 'adm' }, { desde: hoje, ate: null, jornada: 'pronto' }]);
  });

  it('data: uma data anterior ao período aberto lança a recusa, e nada muda', async () => {
    await expect(aplicar('ANTES')).rejects.toMatchObject({ motivo: { codigo: 'data', status: 400, campo: 'desde' } });
    await expect(aplicar('ANTES')).rejects.toBeInstanceOf(RecusaDaAlteracao);
    expect(await periodos('ANTES')).toEqual([{ desde: somarDias(hoje, 1), ate: null, jornada: 'adm' }]);
  });

  it('quadro: um quadro que não serve ao posto lança a recusa no campo quadroId', async () => {
    // o QOC não tem o soldado
    await expect(aplicar('QUADRO', { quadroId: quadroOficial })).rejects.toMatchObject({ motivo: { codigo: 'quadro', status: 400, campo: 'quadroId' } });
  });

  it('achado da revisão: a unidade do período aberto trocou entre a conferência e a gravação: 409 "mudou", e a transferência de outra pessoa não é desfeita', async () => {
    // a conferência viu o militar na 1ª SB; antes da gravação, outra pessoa o passou para a 2ª SB (onde quem aplica também tem cadastro)
    await api.banco.query('update rastreio set unidade_id = $2 where militar_id = $1 and ate is null', [m.MUDOU, sb2]);
    await expect(aplicar('MUDOU', { unidadeId: sb1 }, sb1)).rejects.toMatchObject({ motivo: { codigo: 'mudou', status: 409 } });
    const aberta = (await api.banco.query<{ unidade_id: string }>('select unidade_id from rastreio where militar_id = $1 and ate is null', [m.MUDOU])).rows;
    expect(aberta).toEqual([{ unidade_id: sb2 }]);
  });

  it('a situação escolhida vale no período novo', async () => {
    await aplicar('OUTRO', { situacaoId: ativa, jornada: 'pronto' });
    const s = (await api.banco.query<{ situacao_id: string }>('select situacao_id from rastreio where militar_id = $1 and ate is null', [m.OUTRO])).rows[0]!;
    expect(s.situacao_id).toBe(ativa);
  });
});
