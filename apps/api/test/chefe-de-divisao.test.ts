import type { AcessoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { temPapel, temPapelAcima, CADASTRO, GESTAO } from '../src/acesso.ts';
import { criarMilitar, divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.10, Task 2: o chefe de divisão edita como gestor na sua divisão e nas seções de dentro. Dados fictícios (D7).
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
const MSG = 'Chefe de divisão só existe numa divisão.';

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb2, da]);
  chefe = await entrarComo(api, { matricula: '990741-1', nome: 'CHEFE', nivel: { papel: 'chefe_divisao', unidadeId: divOp } });
  gestorDaSecao = await entrarComo(api, { matricula: '990742-2', nome: 'GESTORSB', nivel: { papel: 'gestor', unidadeId: sb1 } });
});
afterAll(async () => {
  await api.fechar();
});

describe('o chefe de divisão edita como gestor', () => {
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

  it('o chefe não dá o nível de chefe de divisão, nem na própria divisão', async () => {
    const m = await novoMilitar(sb1);
    const r = await dar(chefe, m, 'chefe_divisao', divOp);
    expect(r.status).toBe(403);
    expect((await dar(chefe, m, 'chefe_divisao', da)).status).toBe(403);
    const acesso: AcessoDoMilitar = await (await chefe.pedir('GET', `/api/militares/${m}/acesso`)).json();
    expect(acesso.papeisQuePodeDar).toEqual(['gestor', 'escalante']);
    // a lista de unidades é a divisão dele e o que está dentro
    expect(acesso.unidadesParaPapel.map((u) => u.sigla)).toEqual(['DivOp', '1ª SB']);
  });

  it('o gestor do grupamento dá o nível de chefe de divisão numa divisão; numa seção ou no grupamento, 400 no campo', async () => {
    const m = await novoMilitar(sb2);
    const r = await dar('gestorGb', m, 'chefe_divisao', da);
    expect(r.status).toBe(201);
    expect(((await r.json()) as AcessoDoMilitar).papeis).toMatchObject([{ papel: 'chefe_divisao', unidadeId: da, unidadeSigla: 'DA' }]);
    for (const unidade of [sb2, api.ids.gb]) {
      const errado = await dar('gestorGb', m, 'chefe_divisao', unidade);
      expect(errado.status).toBe(400);
      expect(await errado.json()).toEqual({ erro: MSG, campos: { unidadeId: MSG } });
    }
  });

  it('o administrador dá o nível de chefe de divisão; o gestor de uma seção e o auxiliar não', async () => {
    const m = await novoMilitar(sb1);
    expect((await dar('admin', m, 'chefe_divisao', divOp)).status).toBe(201);
    expect((await dar(gestorDaSecao, m, 'chefe_divisao', divOp)).status).toBe(403);
    // na própria seção, a resposta é a de que o nível só existe numa divisão
    expect((await dar(gestorDaSecao, m, 'chefe_divisao', sb1)).status).toBe(400);
    const acesso: AcessoDoMilitar = await (await gestorDaSecao.pedir('GET', `/api/militares/${m}/acesso`)).json();
    expect(acesso.papeisQuePodeDar).toEqual(['gestor', 'escalante']);
  });

  it('a lista de unidades traz o tipo de cada uma, e quem pode dar o nível de chefe o vê na lista de níveis', async () => {
    const m = await novoMilitar(sb1);
    const doGestor: AcessoDoMilitar = await (await api.pedir('gestorGb', 'GET', `/api/militares/${m}/acesso`)).json();
    expect(doGestor.papeisQuePodeDar).toEqual(['gestor', 'chefe_divisao', 'escalante']);
    expect(doGestor.unidadesParaPapel.filter((u) => u.tipo === 'divisao').map((u) => u.sigla).sort()).toEqual(['DA', 'DivOp']);
    expect(doGestor.unidadesParaPapel.find((u) => u.id === sb1)!.tipo).toBe('secao');
    // cada unidade diz a sigla da mãe: as divisões de grupamentos diferentes (todas "DA" e "DivOp") não se confundem na lista
    expect(doGestor.unidadesParaPapel.find((u) => u.id === da)!.maeSigla).toBe('2º GB');
    expect(doGestor.unidadesParaPapel.find((u) => u.id === sb1)!.maeSigla).toBe('DivOp');
    expect(doGestor.unidadesParaPapel.find((u) => u.id === api.ids.gb)!.tipo).toBe('grupamento');
    const doAdmin: AcessoDoMilitar = await (await api.pedir('admin', 'GET', `/api/militares/${m}/acesso`)).json();
    expect(doAdmin.papeisQuePodeDar).toEqual(['administrador', 'gestor', 'chefe_divisao', 'escalante']);
  });

  it('o gestor do grupamento encerra o nível de um chefe; o chefe não encerra o próprio nível', async () => {
    const outro = await entrarComo(api, { matricula: '990743-3', nome: 'CHEFEDA', nivel: { papel: 'chefe_divisao', unidadeId: da } });
    const papelId = (await api.banco.query<{ id: string }>('select id from papel_usuario where usuario_id = $1', [outro.usuarioId])).rows[0]!.id;
    expect((await outro.pedir('POST', `/api/papeis/${papelId}/encerrar`, { ate: hoje })).status).toBe(403);
    expect((await api.pedir('gestorGb', 'POST', `/api/papeis/${papelId}/encerrar`, { ate: hoje })).status).toBe(200);
  });

  it('quem é chefe e gestor não encerra o próprio último nível de gestão; com outro vigente, encerra', async () => {
    const duplo = await entrarComo(api, { matricula: '990744-4', nome: 'DUPLO', nivel: { papel: 'chefe_divisao', unidadeId: da } });
    // o nível de chefe não está na mão dele (só de quem está acima); o de gestor da própria divisão está
    const gestorId = (await api.banco.query<{ id: string }>(
      "insert into papel_usuario (usuario_id, unidade_id, papel, desde) values ($1, $2, 'gestor', $3) returning id", [duplo.usuarioId, da, dia1])).rows[0]!.id;
    // com o nível de chefe vigente, o de gestor não é o último nível de gestão dele
    expect((await duplo.pedir('POST', `/api/papeis/${gestorId}/encerrar`, { ate: hoje })).status).toBe(200);
  });
});

describe('/api/eu do chefe de divisão', () => {
  it('traz o nível e, nas unidades, a divisão e as seções de dentro', async () => {
    const eu = await (await chefe.pedir('GET', '/api/eu')).json();
    expect(eu.papeis).toEqual([{ papel: 'chefe_divisao', unidadeId: divOp, unidadeSigla: 'DivOp' }]);
    expect(eu.unidades.map((u: { sigla: string }) => u.sigla)).toEqual(['DivOp', '1ª SB']);
    expect(eu.unidades[1].caminho.slice(-3)).toEqual(['2º GB', 'DivOp', '1ª SB']);
  });
});

describe('os avisos do Pecúlio citam o grupamento, e não a divisão (revisão da 6.10)', () => {
  it('o auxiliar de uma seção que está numa divisão lê "no 2º GB" no aviso do campo, na ficha e na importação', async () => {
    const m = await novoMilitar(sb1);
    const campo = await api.pedir('escalante', 'PATCH', `/api/militares/${m}`, { nomeCompleto: 'Outro Nome Completo' });
    expect(campo.status).toBe(403);
    expect((await campo.json()).erro).toBe('Este campo é alterado por quem tem nível de acesso no 2º GB.');
    expect((await (await api.pedir('escalante', 'GET', `/api/militares/${m}`)).json()).podeEditar.unidadeDeCima).toBe('2º GB');
    const importar = await api.pedir('escalante', 'POST', `/api/unidades/${sb1}/importacao/peculio`, formulario(await planilha({ 'PECÚLIO': [['MATRÍCULA'], ['990753-3']] })));
    expect(importar.status).toBe(403);
    expect((await importar.json()).erro).toBe('A importação do Pecúlio é de quem tem nível de acesso no 2º GB.');
  });

  it('a seção direto no grupamento continua citando o 2º GB', async () => {
    const sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
    const auxiliar = await entrarComo(api, { matricula: '990764-4', nome: 'AUXSB3', nivel: { papel: 'escalante', unidadeId: sb3 } });
    const m = await novoMilitar(sb3);
    const r = await auxiliar.pedir('PATCH', `/api/militares/${m}`, { nomeCompleto: 'Outro Nome Completo' });
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Este campo é alterado por quem tem nível de acesso no 2º GB.');
  });

  it('quem cuida do Pecúlio da divisão (o chefe) altera o campo de um militar de uma seção de dentro', async () => {
    const m = await novoMilitar(sb1);
    expect((await chefe.pedir('PATCH', `/api/militares/${m}`, { nomeCompleto: 'Nome Completo do Militar' })).status).toBe(200);
  });
});
