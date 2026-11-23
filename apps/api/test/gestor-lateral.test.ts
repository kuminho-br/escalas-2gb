import type { AcessoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { temPapel, temPapelAcima, CADASTRO, GESTAO } from '../src/acesso.ts';
import { criarMilitar, divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entregas 6.10 e 6.25: o quinto nível (`gestor_lateral`, antes "chefe de divisão") edita como gestor na sua unidade e abaixo dela, em qualquer unidade menos a raiz. Dados fictícios (D7).
let api: ApiDeTeste;
let da: string;
let divOp: string;
let sb1: string; // dentro da DivOp
let sb2: string; // dentro da DA
let chefe: Pessoa;
let gestorDaSecao: Pessoa;
const hoje = hojeRecife();
const mes = hoje.slice(0, 7);
const dia1 = `${mes}-01`;
let seq = 0;
const novoMilitar = (unidadeId: string) => {
  seq++;
  return criarMilitar(api, { matricula: `99075${seq}-${seq}`, email: `chefia${seq}@bombeiros.pe.gov.br`, unidadeId });
};
const MSG_RAIZ = 'O nível não existe na unidade raiz.';

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb2, da]);
  chefe = await entrarComo(api, { matricula: '990741-1', nome: 'CHEFE', nivel: { papel: 'gestor_lateral', unidadeId: divOp } });
  gestorDaSecao = await entrarComo(api, { matricula: '990742-2', nome: 'GESTORSB', nivel: { papel: 'gestor', unidadeId: sb1 } });
});
afterAll(async () => {
  await api.fechar();
});

describe('o quinto nível edita como gestor', () => {
  it('vale na divisão e nas seções de dentro, como gestão e como cadastro; fora dela, não', async () => {
    for (const papeis of [GESTAO, CADASTRO]) {
      expect(await temPapel(api.banco, chefe.usuarioId, divOp, papeis, hoje)).toBe(true);
      expect(await temPapel(api.banco, chefe.usuarioId, sb1, papeis, hoje)).toBe(true);
      expect(await temPapel(api.banco, chefe.usuarioId, sb2, papeis, hoje)).toBe(false);
      expect(await temPapel(api.banco, chefe.usuarioId, da, papeis, hoje)).toBe(false);
      expect(await temPapel(api.banco, chefe.usuarioId, api.ids.gb, papeis, hoje)).toBe(false);
    }
    // está acima das seções da divisão (os blocos do Pecúlio), e não acima da própria divisão
    expect(await temPapelAcima(api.banco, chefe.usuarioId, sb1, CADASTRO, hoje)).toBe(true);
    expect(await temPapelAcima(api.banco, chefe.usuarioId, divOp, CADASTRO, hoje)).toBe(false);
  });

  it('altera um parâmetro numa seção da DivOp, e recebe 403 numa seção da DA', async () => {
    const corpo = { chave: 'SALDOS_ADM_POR_MILITAR', valor: '3', vigencia: mes };
    expect((await chefe.pedir('POST', `/api/unidades/${sb1}/parametros`, corpo)).status).toBe(201);
    const r = await chefe.pedir('POST', `/api/unidades/${sb2}/parametros`, corpo);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Você não tem permissão nos cadastros de 2ª SB.');
  });

  it('altera um cadastro numa seção da DivOp, e recebe 403 numa seção da DA', async () => {
    const feriado = { data: `${mes}-15`, descricao: 'Feriado de teste', fixo: false };
    expect((await chefe.pedir('POST', `/api/unidades/${sb1}/feriados`, feriado)).status).toBe(201);
    expect((await chefe.pedir('POST', `/api/unidades/${sb2}/feriados`, feriado)).status).toBe(403);
    expect((await chefe.pedir('GET', `/api/unidades/${sb2}/feriados`)).status).toBe(403);
  });
});

describe('dar e encerrar níveis de acesso', () => {
  const dar = (quem: Pessoa | 'gestorGb' | 'admin', militarId: string, papel: string, unidadeId: string) => {
    const corpo = { papel, unidadeId, desde: dia1 };
    return typeof quem === 'string' ? api.pedir(quem, 'POST', `/api/militares/${militarId}/papeis`, corpo) : quem.pedir('POST', `/api/militares/${militarId}/papeis`, corpo);
  };

  it('o chefe dá e encerra os níveis de auxiliar e de gestor dentro da DivOp', async () => {
    const m = await novoMilitar(sb1);
    for (const papel of ['escalante', 'gestor']) {
      const r = await dar(chefe, m, papel, sb1);
      expect(r.status).toBe(201);
      const acesso: AcessoDoMilitar = await r.json();
      const dado = acesso.papeis.find((p) => p.papel === papel && p.ate === null)!;
      const fim = await chefe.pedir('POST', `/api/papeis/${dado.id}/encerrar`, { ate: hoje });
      expect(fim.status).toBe(200);
    }
    expect((await dar(chefe, m, 'gestor', divOp)).status).toBe(201);
  });

  it('o chefe não dá níveis fora da DivOp', async () => {
    const m = await novoMilitar(sb1);
    expect((await dar(chefe, m, 'escalante', sb2)).status).toBe(403);
    expect((await dar(chefe, m, 'gestor', api.ids.gb)).status).toBe(403);
  });

  it('o quinto nível não dá o próprio nível, nem na própria unidade', async () => {
    const m = await novoMilitar(sb1);
    const r = await dar(chefe, m, 'gestor_lateral', divOp);
    expect(r.status).toBe(403);
    expect((await dar(chefe, m, 'gestor_lateral', da)).status).toBe(403);
    const acesso: AcessoDoMilitar = await (await chefe.pedir('GET', `/api/militares/${m}/acesso`)).json();
    expect(acesso.papeisQuePodeDar).toEqual(['gestor', 'escalante']);
    // a lista de unidades é a divisão dele e o que está dentro
    expect(acesso.unidadesParaPapel.map((u) => u.sigla)).toEqual(['DivOp', '1ª SB']);
  });

  it('o gestor do grupamento dá o quinto nível numa unidade de qualquer tipo abaixo dele; no próprio grupamento, 403; na raiz, o administrador leva 400 no campo', async () => {
    const m = await novoMilitar(sb2);
    for (const unidade of [da, sb2]) {
      const r = await dar('gestorGb', m, 'gestor_lateral', unidade);
      expect(r.status).toBe(201);
      expect(((await r.json()) as AcessoDoMilitar).papeis.find((p) => p.unidadeId === unidade)).toMatchObject({ papel: 'gestor_lateral' });
    }
    // o gestor do grupamento está NA unidade, não acima dela
    expect((await dar('gestorGb', m, 'gestor_lateral', api.ids.gb)).status).toBe(403);
    const naRaiz = await dar('admin', m, 'gestor_lateral', api.ids.raiz);
    expect(naRaiz.status).toBe(400);
    expect(await naRaiz.json()).toEqual({ erro: MSG_RAIZ, campos: { unidadeId: MSG_RAIZ } });
  });

  it('o administrador dá o quinto nível; o gestor de uma seção e o auxiliar não, nem na própria seção', async () => {
    const m = await novoMilitar(sb1);
    expect((await dar('admin', m, 'gestor_lateral', divOp)).status).toBe(201);
    expect((await dar(gestorDaSecao, m, 'gestor_lateral', divOp)).status).toBe(403);
    expect((await dar(gestorDaSecao, m, 'gestor_lateral', sb1)).status).toBe(403);
    const acesso: AcessoDoMilitar = await (await gestorDaSecao.pedir('GET', `/api/militares/${m}/acesso`)).json();
    expect(acesso.papeisQuePodeDar).toEqual(['gestor', 'escalante']);
  });

  it('a lista de unidades traz o tipo de cada uma e onde o quinto nível pode ser dado', async () => {
    const m = await novoMilitar(sb1);
    const doGestor: AcessoDoMilitar = await (await api.pedir('gestorGb', 'GET', `/api/militares/${m}/acesso`)).json();
    expect(doGestor.papeisQuePodeDar).toEqual(['gestor', 'gestor_lateral', 'escalante']);
    expect(doGestor.unidadesParaPapel.filter((u) => u.tipo === 'divisao').map((u) => u.sigla).sort()).toEqual(['DA', 'DivOp']);
    // o gestor do 2º GB dá o nível em qualquer unidade abaixo do 2º GB, e não no próprio 2º GB
    expect(doGestor.unidadesParaPapel.find((u) => u.id === api.ids.gb)!.aceitaLateral).toBe(false);
    expect(doGestor.unidadesParaPapel.find((u) => u.id === sb1)!.aceitaLateral).toBe(true);
    expect(doGestor.unidadesParaPapel.find((u) => u.id === sb1)!.tipo).toBe('secao');
    // cada unidade diz a sigla da mãe: as divisões de grupamentos diferentes (todas "DA" e "DivOp") não se confundem na lista
    expect(doGestor.unidadesParaPapel.find((u) => u.id === da)!.maeSigla).toBe('2º GB');
    expect(doGestor.unidadesParaPapel.find((u) => u.id === sb1)!.maeSigla).toBe('DivOp');
    expect(doGestor.unidadesParaPapel.find((u) => u.id === api.ids.gb)!.tipo).toBe('grupamento');
    const doAdmin: AcessoDoMilitar = await (await api.pedir('admin', 'GET', `/api/militares/${m}/acesso`)).json();
    expect(doAdmin.unidadesParaPapel.find((u) => u.id === api.ids.raiz)!.aceitaLateral).toBe(false);
    expect(doAdmin.unidadesParaPapel.find((u) => u.id === api.ids.gb)!.aceitaLateral).toBe(true);
    expect(doAdmin.papeisQuePodeDar).toEqual(['administrador', 'gestor', 'gestor_lateral', 'escalante']);
  });

  it('o gestor do grupamento encerra o quinto nível de alguém; a pessoa não encerra o próprio nível', async () => {
    const outro = await entrarComo(api, { matricula: '990743-3', nome: 'CHEFEDA', nivel: { papel: 'gestor_lateral', unidadeId: da } });
    const papelId = (await api.banco.query<{ id: string }>('select id from papel_usuario where usuario_id = $1', [outro.usuarioId])).rows[0]!.id;
    expect((await outro.pedir('POST', `/api/papeis/${papelId}/encerrar`, { ate: hoje })).status).toBe(403);
    expect((await api.pedir('gestorGb', 'POST', `/api/papeis/${papelId}/encerrar`, { ate: hoje })).status).toBe(200);
  });

  it('quem tem o quinto nível e o de gestor não encerra o próprio último nível de gestão; com outro vigente, encerra', async () => {
    const duplo = await entrarComo(api, { matricula: '990744-4', nome: 'DUPLO', nivel: { papel: 'gestor_lateral', unidadeId: da } });
    // o nível de chefe não está na mão dele (só de quem está acima); o de gestor da própria divisão está
    const gestorId = (await api.banco.query<{ id: string }>(
      "insert into papel_usuario (usuario_id, unidade_id, papel, desde) values ($1, $2, 'gestor', $3) returning id", [duplo.usuarioId, da, dia1])).rows[0]!.id;
    // com o nível de chefe vigente, o de gestor não é o último nível de gestão dele
    expect((await duplo.pedir('POST', `/api/papeis/${gestorId}/encerrar`, { ate: hoje })).status).toBe(200);
  });
});

describe('/api/eu do quinto nível', () => {
  it('traz o nível e, nas unidades, a unidade e as de dentro', async () => {
    const eu = await (await chefe.pedir('GET', '/api/eu')).json();
    expect(eu.papeis).toEqual([{ papel: 'gestor_lateral', unidadeId: divOp, unidadeSigla: 'DivOp' }]);
    expect(eu.unidades.map((u: { sigla: string }) => u.sigla)).toEqual(['DivOp', '1ª SB']);
    expect(eu.unidades[1].caminho.slice(-3)).toEqual(['2º GB', 'DivOp', '1ª SB']);
  });
});

describe('os avisos do Pecúlio citam a unidade logo acima (6.25)', () => {
  it('o auxiliar de uma seção que está numa divisão lê "no DivOp" (a unidade logo acima) no aviso do campo, na ficha e na importação', async () => {
    const m = await novoMilitar(sb1);
    const campo = await api.pedir('escalante', 'PATCH', `/api/militares/${m}`, { nomeCompleto: 'Outro Nome Completo' });
    expect(campo.status).toBe(403);
    expect((await campo.json()).erro).toBe('Este campo é alterado por quem tem nível de acesso no DivOp.');
    expect((await (await api.pedir('escalante', 'GET', `/api/militares/${m}`)).json()).podeEditar.unidadeDeCima).toBe('DivOp');
    const importar = await api.pedir('escalante', 'POST', `/api/unidades/${sb1}/importacao/peculio`, formulario(await planilha({ 'PECÚLIO': [['MATRÍCULA'], ['990753-3']] })));
    expect(importar.status).toBe(403);
    expect((await importar.json()).erro).toBe('A importação do Pecúlio é de quem tem nível de acesso no DivOp.');
  });

  it('a seção direto no grupamento continua citando o 2º GB', async () => {
    const sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
    const auxiliar = await entrarComo(api, { matricula: '990764-4', nome: 'AUXSB3', nivel: { papel: 'escalante', unidadeId: sb3 } });
    const m = await novoMilitar(sb3);
    const r = await auxiliar.pedir('PATCH', `/api/militares/${m}`, { nomeCompleto: 'Outro Nome Completo' });
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Este campo é alterado por quem tem nível de acesso no 2º GB.');
  });

  it('quem cuida do Pecúlio da divisão (o quinto nível) altera o campo de um militar de uma seção de dentro', async () => {
    const m = await novoMilitar(sb1);
    expect((await chefe.pedir('PATCH', `/api/militares/${m}`, { nomeCompleto: 'Nome Completo do Militar' })).status).toBe(200);
  });
});
