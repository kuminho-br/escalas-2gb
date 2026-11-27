import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Dados fictícios (D7). O gatilho da 0009 só vale para gravações novas: aqui ele é desligado para
// reproduzir um banco que já tinha administrador fora da raiz antes da regra existir.
async function bancoAte0011(): Promise<Banco> {
  const banco = await bancoPglite();
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0012')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrar(banco, ate);
  return banco;
}
const aplicar0012 = async (banco: Banco) => {
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql'))) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrar(banco, ate);
};
async function usuario(banco: Banco, matricula: string): Promise<string> {
  const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  const militar = await inserir(banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: 'FICTICIO' });
  return inserir(banco, 'usuario', { nome: 'Fictício', email: `${matricula}@exemplo.test`, militar_id: militar });
}
const unidade = async (banco: Banco, sigla: string) => (await banco.query<{ id: string }>('select id from unidade where sigla = $1', [sigla])).rows[0]!.id;

// cada teste fecha o banco no fim: três bancos em memória abertos ao mesmo tempo derrubavam a inicialização do terceiro em máquina com pouca RAM
async function comBanco(teste: (banco: Banco) => Promise<void>) {
  const banco = await bancoAte0011();
  try {
    await teste(banco);
  } finally {
    await banco.fechar();
  }
}

describe('migração 0012', () => {
  it('num banco sem administrador fora da raiz, passa', () => comBanco(async (banco) => {
    const u = await usuario(banco, '990960-1');
    await inserir(banco, 'papel_usuario', { usuario_id: u, unidade_id: await unidade(banco, 'CBMPE'), papel: 'administrador', desde: '2026-01-01' });
    await expect(aplicar0012(banco)).resolves.not.toThrow();
  }));

  it('administrador numa unidade filha, já gravado, faz a migração parar dizendo quantos', () => comBanco(async (banco) => {
    const u = await usuario(banco, '990961-1');
    await banco.query('alter table papel_usuario disable trigger papel_administrador');
    await inserir(banco, 'papel_usuario', { usuario_id: u, unidade_id: await unidade(banco, '1ª SB'), papel: 'administrador', desde: '2026-01-01' });
    await expect(aplicar0012(banco)).rejects.toThrow(/administrador fora da unidade raiz.*1/);
  }));

  it('convite de administrador numa unidade filha também faz parar', () => comBanco(async (banco) => {
    const u = await usuario(banco, '990962-1');
    const convidado = await usuario(banco, '990963-1');
    const militar = (await banco.query<{ militar_id: string }>('select militar_id from usuario where id = $1', [convidado])).rows[0]!.militar_id;
    await banco.query('alter table convite disable trigger convite_administrador');
    await inserir(banco, 'convite', {
      email: 'c@exemplo.test', militar_id: militar, unidade_id: await unidade(banco, '1ª SB'), papel: 'administrador', enviado_por: u, expira_em: '2030-01-01',
    });
    await expect(aplicar0012(banco)).rejects.toThrow(/administrador fora da unidade raiz/);
  }));
});
