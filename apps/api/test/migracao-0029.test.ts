import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7). Migra até a 0028, insere militares com quadro e com `ativo` à moda antiga e aplica a 0029 em diante.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}
const postoId = async (sigla: string) => (await banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [sigla])).rows[0]!.id;
const quadroId = async (sigla: string) => (await banco.query<{ id: string }>('select id from quadro where sigla = $1', [sigla])).rows[0]!.id;
const periodos = async (militarId: string) =>
  (await banco.query<{ quadro: string | null; situacao: string }>(
    `select q.sigla as quadro, s.nome as situacao from rastreio r left join quadro q on q.id = r.quadro_id join situacao_militar s on s.id = r.situacao_id
      where r.militar_id = $1 order by r.desde`, [militarId])).rows;

let banco: Banco;
let secao: string;
let ativo: string;
let inativo: string;
let semPeriodo: string;
beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0029');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-M29', nome: 'Seção M29', mae_id: raiz, desde: '2026-11-01' });
  const mil = async (n: number, posto: string, quadro: string | null, ativoDoMilitar: boolean) => {
    const id = await inserir(banco, 'militar', {
      matricula: `99070${n}-${n}`, posto_grad_id: await postoId(posto), nome_guerra: `TESTE${n}`, quadro_id: quadro ? await quadroId(quadro) : null, ativo: ativoDoMilitar,
    });
    return id;
  };
  ativo = await mil(1, 'SD BM', 'QBMG', true);
  inativo = await mil(2, 'CB BM', 'QBMG', false);
  semPeriodo = await mil(3, 'CEL BM', 'QOC', true);
  // o ativo tem dois períodos (o quadro vai para os dois); o inativo, um; o terceiro não tem nenhum
  await inserir(banco, 'rastreio', { militar_id: ativo, unidade_id: secao, jornada: 'pronto', desde: '2026-11-01', ate: '2026-11-30' });
  await inserir(banco, 'rastreio', { militar_id: ativo, unidade_id: secao, jornada: 'adm', desde: '2026-12-01' });
  await inserir(banco, 'rastreio', { militar_id: inativo, unidade_id: secao, jornada: 'pronto', desde: '2026-11-01' });
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0029: quadro e situação no rastreio', () => {
  it('o catálogo traz Ativa, Reserva, Agregado, Adido e Desativado, e só a Ativa pode ser escalada', async () => {
    const { rows } = await banco.query<{ nome: string; escalavel: boolean; ativo: boolean }>('select nome, escalavel, ativo from situacao_militar order by nome');
    expect(rows).toEqual([
      { nome: 'Adido', escalavel: false, ativo: true },
      { nome: 'Agregado', escalavel: false, ativo: true },
      { nome: 'Ativa', escalavel: true, ativo: true },
      { nome: 'Desativado', escalavel: false, ativo: true },
      { nome: 'Reserva', escalavel: false, ativo: true },
    ]);
  });

  it('os períodos são preservados, e o quadro do militar vai para todos os períodos dele', async () => {
    expect(await periodos(ativo)).toEqual([{ quadro: 'QBMG', situacao: 'Ativa' }, { quadro: 'QBMG', situacao: 'Ativa' }]);
  });

  it('quem estava com ativo = false fica em "Desativado" nos períodos', async () => {
    expect(await periodos(inativo)).toEqual([{ quadro: 'QBMG', situacao: 'Desativado' }]);
  });

  it('militar sem período continua existindo (o quadro dele fica sem onde morar)', async () => {
    expect((await banco.query('select 1 from militar where id = $1', [semPeriodo])).rows).toHaveLength(1);
    expect(await periodos(semPeriodo)).toEqual([]);
  });

  it('militar.ativo e militar.quadro_id não existem mais, nem a chave do posto no quadro', async () => {
    const { rows } = await banco.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'militar' and column_name in ('ativo', 'quadro_id')");
    expect(rows).toEqual([]);
    const c = await banco.query("select 1 from pg_constraint where conname = 'militar_posto_no_quadro'");
    expect(c.rows).toHaveLength(0);
  });

  it('um período novo sem situação nasce "Ativa"', async () => {
    const id = await inserir(banco, 'rastreio', { militar_id: semPeriodo, unidade_id: secao, jornada: 'pronto', desde: '2026-12-01' });
    expect(id).toBeTruthy();
    expect(await periodos(semPeriodo)).toEqual([{ quadro: null, situacao: 'Ativa' }]);
  });

  it('pode rodar de novo sem duplicar o catálogo nem mexer nos períodos', async () => {
    const antes = (await banco.query('select id, quadro_id, situacao_id from rastreio order by id')).rows;
    // o arquivo inteiro de novo, direto (o `migrar` pularia o que já está registrado)
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0029_cadastro_no_tempo.sql'), 'utf8'));
    expect((await banco.query('select 1 from situacao_militar')).rows).toHaveLength(5);
    expect((await banco.query('select id, quadro_id, situacao_id from rastreio order by id')).rows).toEqual(antes);
  });

  it('a situação padrão é marcada, e não achada pelo nome: renomear "Ativa" não quebra o período novo', async () => {
    expect((await banco.query<{ nome: string }>('select nome from situacao_militar where padrao')).rows).toEqual([{ nome: 'Ativa' }]);
    await banco.query("update situacao_militar set nome = 'Na ativa' where padrao");
    const m = await inserir(banco, 'militar', { matricula: '990777-7', posto_grad_id: (await banco.query<{ id: string }>('select id from posto_grad limit 1')).rows[0]!.id, nome_guerra: 'RENOMEADA' });
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-12-01' });
    expect(await periodos(m)).toEqual([{ quadro: null, situacao: 'Na ativa' }]);
    // rodar de novo depois de renomear não cria outra "Ativa" nem outra padrão
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0029_cadastro_no_tempo.sql'), 'utf8'));
    expect((await banco.query('select 1 from situacao_militar where padrao')).rows).toHaveLength(1);
    expect((await banco.query('select 1 from situacao_militar')).rows).toHaveLength(5);
    await banco.query("update situacao_militar set nome = 'Ativa' where padrao");
  });
});

describe('migração 0029: dados pessoais', () => {
  const militar = (n: number, extra: Record<string, unknown>) =>
    inserir(banco, 'militar', { matricula: `99${7100 + n}-${n % 10}`, posto_grad_id: undefined, nome_guerra: `DADOS${n}`, ...extra });
  const comPosto = async (n: number, extra: Record<string, unknown>) => militar(n, { posto_grad_id: await postoId('SD BM'), ...extra });
  const CPF = '52998224725';

  it('CPF com 10 dígitos falha (23514), com 11 grava, e repetido falha (23505)', async () => {
    await expect(comPosto(1, { cpf: '5299822472' })).rejects.toMatchObject({ code: '23514' });
    await comPosto(2, { cpf: CPF });
    await expect(comPosto(3, { cpf: CPF })).rejects.toMatchObject({ code: '23505' });
  });

  it('nascimento com ano: 30/02 falha; 29/02 só em ano bissexto; sem ano continua valendo 29/02', async () => {
    await expect(comPosto(4, { nascimento_dia: 30, nascimento_mes: 2, nascimento_ano: 1990 })).rejects.toMatchObject({ code: '23514' });
    await expect(comPosto(5, { nascimento_dia: 29, nascimento_mes: 2, nascimento_ano: 1991 })).rejects.toMatchObject({ code: '23514' });
    await comPosto(6, { nascimento_dia: 29, nascimento_mes: 2, nascimento_ano: 1992 });
    await comPosto(7, { nascimento_dia: 29, nascimento_mes: 2 });
    await expect(comPosto(8, { nascimento_ano: 1990 })).rejects.toMatchObject({ code: '23514' });
  });

  it('UF fora das 27 siglas falha, CEP com 8 dígitos grava', async () => {
    await expect(comPosto(9, { uf: 'XX' })).rejects.toMatchObject({ code: '23514' });
    await expect(comPosto(10, { cep: '5000000' })).rejects.toMatchObject({ code: '23514' });
    await comPosto(11, { cep: '50000000', uf: 'PE', logradouro: 'Rua Fictícia', numero: '10', cidade: 'Recife', bairro: 'Centro' });
  });
});
