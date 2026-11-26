import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { comUsuario, type Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Entrega 6.25, Task 1: a migração da árvore genérica. Dados fictícios (D7). Migra até a 0034, cria dados com o nível antigo e aplica a 0035.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
let raiz: string;
let gb: string;
let divisao: string;
let secao: string;
let usuario: string;
let papelAntigo: string;
let blocosAntes: number;
const darPapel = (papel: string, unidade: string) => inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: unidade, papel, desde: '2026-11-01' });
const unidade = (tipo: string, sigla: string, mae: string | null) => inserir(banco, 'unidade', { tipo, sigla, nome: `Unidade ${sigla}`, mae_id: mae, desde: '2026-11-01' });

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0035');
  raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  gb = await unidade('grupamento', 'GB-M35', raiz);
  divisao = await unidade('divisao', 'DIV-M35', gb);
  secao = await unidade('secao', 'SEC-M35', divisao);
  const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const militar = await inserir(banco, 'militar', { matricula: '990735-1', posto_grad_id: posto, nome_guerra: 'M35' });
  usuario = await inserir(banco, 'usuario', { nome: 'SD M35', email: 'm35@exemplo.test', militar_id: militar });
  papelAntigo = await darPapel('chefe_divisao', divisao);
  blocosAntes = (await banco.query<{ n: number }>('select count(*)::int as n from visao_bloco')).rows[0]!.n;
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0035: a árvore genérica', () => {
  it('o nível chefe_divisao vira gestor_lateral, nas linhas e na regra, sem perder nenhuma', async () => {
    const { rows } = await banco.query<{ papel: string; unidade_id: string }>('select papel, unidade_id from papel_usuario where id = $1', [papelAntigo]);
    expect(rows).toEqual([{ papel: 'gestor_lateral', unidade_id: divisao }]);
    expect((await banco.query("select 1 from papel_usuario where papel = 'chefe_divisao'")).rows).toHaveLength(0);
    await expect(darPapel('chefe_divisao', divisao)).rejects.toThrow();
  });

  it('a camada da borda troca de nome e nenhuma linha se perde', async () => {
    const { rows } = await banco.query<{ camada: string; n: number }>('select camada, count(*)::int as n from visao_bloco group by camada order by camada');
    expect(rows).toEqual([{ camada: 'gestor_lateral', n: 7 }, { camada: 'oficial', n: 7 }, { camada: 'todos', n: 7 }]);
    expect(blocosAntes).toBe(21);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from visao_bloco')).rows[0]!.n).toBe(21);
    expect((await banco.query<{ ve: boolean }>("select ve from visao_bloco where bloco = 'comportamento' and camada = 'gestor_lateral'")).rows).toEqual([{ ve: true }]);
  });

  it('o nível não existe na raiz, mas vale em qualquer outro tipo de unidade', async () => {
    await expect(darPapel('gestor_lateral', raiz)).rejects.toThrow('O nível não existe na unidade raiz.');
    await darPapel('gestor_lateral', secao);
    await darPapel('gestor_lateral', gb);
    await expect(banco.query('update papel_usuario set unidade_id = $2 where id = $1', [papelAntigo, raiz])).rejects.toThrow('O nível não existe na unidade raiz.');
  });

  it('uma seção pode ficar acima de um grupamento, e nenhum tipo prende o outro', async () => {
    const sec = await unidade('secao', 'SEC-ACIMA', raiz);
    const gbAbaixo = await unidade('grupamento', 'GB-ABAIXO', sec);
    const cima = await unidade('corporacao', 'CORP-ABAIXO', gbAbaixo);
    const { rows } = await banco.query<{ ok: boolean; nivel: number }>('select c.caminho <@ s.caminho as ok, nlevel(c.caminho) - nlevel(s.caminho) as nivel from unidade c, unidade s where c.id = $1 and s.id = $2', [cima, sec]);
    expect(rows[0]).toEqual({ ok: true, nivel: 2 });
  });

  it('o ciclo continua recusado, direto e em dois passos', async () => {
    const a = await unidade('secao', 'CIC-A', gb);
    const b = await unidade('secao', 'CIC-B', a);
    const c = await unidade('secao', 'CIC-C', b);
    await expect(banco.query('update unidade set mae_id = $2 where id = $1', [a, a])).rejects.toThrow('Uma unidade não pode ficar abaixo de si mesma');
    await expect(banco.query('update unidade set mae_id = $2 where id = $1', [a, c])).rejects.toThrow('Uma unidade não pode ficar abaixo de si mesma');
    // com a do meio extinta, o caminho ainda vale
    await banco.query("update unidade set ate = '2026-11-30' where id = $1", [b]);
    await expect(banco.query('update unidade set mae_id = $2 where id = $1', [a, c])).rejects.toThrow('Uma unidade não pode ficar abaixo de si mesma');
  });

  it('duas irmãs ativas não repetem a sigla (sem diferenciar maiúsculas); em outra mãe, repete', async () => {
    await unidade('secao', '1ª SB', gb);
    await expect(unidade('secao', '1ª sb', gb)).rejects.toThrow();
    await unidade('secao', '1ª SB', divisao);
    // a extinta deixa a sigla livre
    const velha = await unidade('secao', 'REUSA', gb);
    await banco.query("update unidade set ate = '2026-11-30' where id = $1", [velha]);
    await unidade('secao', 'REUSA', gb);
  });

  it('a migração rodada de novo não quebra, e deixa um gatilho só', async () => {
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0035_arvore_generica.sql'), 'utf8'));
    const gatilhos = (await banco.query<{ tgname: string }>("select tgname from pg_trigger where tgrelid = 'papel_usuario'::regclass and not tgisinternal order by tgname")).rows.map((r) => r.tgname);
    expect(gatilhos.filter((g) => g === 'papel_gestor_lateral')).toHaveLength(1);
    expect(gatilhos).not.toContain('papel_chefe_divisao');
    expect((await banco.query('select 1 from papel_usuario where id = $1', [papelAntigo])).rows).toHaveLength(1);
  });

  it('o tipo tem id, ordem, e uma linha nova grava a auditoria com quem fez', async () => {
    const cols = (await banco.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'tipo_unidade' order by column_name")).rows.map((r) => r.column_name);
    expect(cols).toEqual(['codigo', 'id', 'nome', 'ordem']);
    // a ordem não é mais única
    await comUsuario(banco, usuario, (tx) => tx.query("insert into tipo_unidade (codigo, nome, ordem) values ('pelotao', 'Pelotão', 5)"));
    const { rows } = await banco.query<{ usuario_id: string; acao: string; registro_id: string }>(
      "select a.usuario_id, a.acao, a.registro_id from auditoria a join tipo_unidade t on t.id::text = a.registro_id where a.tabela = 'tipo_unidade' and t.codigo = 'pelotao'");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ usuario_id: usuario, acao: 'insert' });
  });
});
