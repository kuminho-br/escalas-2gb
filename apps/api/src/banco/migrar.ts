import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepararPapelDoEspelho } from '../laboratorio/espelho.ts';
import { SCHEMA_ESPELHO } from '../laboratorio/constantes.ts';
import type { Banco, Consulta } from './banco.ts';

export const PASTA_MIGRACOES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'banco', 'migracoes');

export { SCHEMA_ESPELHO };

/** Os arquivos .sql da pasta, em ordem de nome, que ainda não estão em `feitas`. */
function pendentesDe(pasta: string, feitas: Set<string>): string[] {
  return readdirSync(pasta)
    .filter((f) => f.endsWith('.sql') && !feitas.has(f))
    .sort();
}

/**
 * Aplica, em ordem de nome, os .sql ainda não aplicados no real e depois no espelho. Cada arquivo numa transação por schema.
 * Devolve os arquivos aplicados no real (o espelho acompanha os mesmos arquivos; veja `migrarEspelho`).
 * `espelho: false` só para os testes que não precisam do espelho (cada banco novo custa o dobro do tempo com ele).
 */
export async function migrar(banco: Banco, pasta = PASTA_MIGRACOES, opcoes: { espelho?: boolean } = {}): Promise<string[]> {
  await banco.exec(
    'create table if not exists migracao_aplicada (nome text primary key, aplicada_em timestamptz not null default now())',
  );
  const { rows } = await banco.query<{ nome: string }>('select nome from migracao_aplicada');
  const pendentes = pendentesDe(pasta, new Set(rows.map((r) => r.nome)));
  for (const nome of pendentes) {
    const sql = readFileSync(join(pasta, nome), 'utf8');
    await banco.transacao(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into migracao_aplicada (nome) values ($1)', [nome]);
    });
  }
  if (opcoes.espelho !== false) {
    await migrarEspelho(banco, pasta);
    await prepararPapelDoEspelho(banco);
  }
  return pendentes;
}

/**
 * Aplica no espelho os mesmos arquivos do real, com o registro de migrações aplicadas dele (`laboratorio.migracao_aplicada`). Cria o schema se não existir.
 * Cada arquivo roda numa transação com `search_path` = espelho, depois `public` (para os tipos e operadores das extensões): tudo o que o arquivo cria sem
 * escrever o schema nasce no espelho. Se um arquivo falha, só aquele arquivo volta atrás no espelho. Devolve os arquivos aplicados no espelho.
 */
export async function migrarEspelho(banco: Banco, pasta = PASTA_MIGRACOES): Promise<string[]> {
  await banco.exec(`create schema if not exists ${SCHEMA_ESPELHO}`);
  await banco.exec(
    `create table if not exists ${SCHEMA_ESPELHO}.migracao_aplicada (nome text primary key, aplicada_em timestamptz not null default now())`,
  );
  const { rows } = await banco.query<{ nome: string }>(`select nome from ${SCHEMA_ESPELHO}.migracao_aplicada`);
  const pendentes = pendentesDe(pasta, new Set(rows.map((r) => r.nome)));
  for (const nome of pendentes) {
    const sql = readFileSync(join(pasta, nome), 'utf8');
    await banco.transacao(async (tx) => {
      await tx.exec(`set local search_path to ${SCHEMA_ESPELHO}, public`);
      await tx.exec(sql);
      await tx.query(`insert into ${SCHEMA_ESPELHO}.migracao_aplicada (nome) values ($1)`, [nome]);
    });
  }
  return pendentes;
}

export interface EstruturaDoSchema {
  tabelas: string[];
  /** "tabela.coluna tipo nulidade" */
  colunas: string[];
  /** "tabela.gatilho" */
  gatilhos: string[];
  /** "tabela.nome definição" (chaves primárias, estrangeiras, únicas, checagens, exclusões) */
  restricoes: string[];
  /** "nome(argumentos)", sem as funções das extensões */
  funcoes: string[];
  indices: string[];
}

/**
 * A estrutura de um schema, ordenada e sem o nome do próprio schema nas definições, para comparar o real com o espelho
 * (o teste de estrutura da 6.58 e a conferência do Laboratório, 6.59).
 */
export async function estruturaDoSchema(c: Consulta, schema: string): Promise<EstruturaDoSchema> {
  const lista = async (sql: string) => {
    const { rows } = await c.query<{ v: string }>(sql, [schema]);
    return rows.map((r) => r.v.replace(new RegExp(`(?<!\\w)${schema}\\.`, 'g'), '')).sort();
  };
  return {
    tabelas: await lista('select tablename as v from pg_tables where schemaname = $1'),
    colunas: await lista(
      `select table_name || '.' || column_name || ' ' || udt_name || ' ' || is_nullable as v
         from information_schema.columns where table_schema = $1`,
    ),
    gatilhos: await lista(
      `select c.relname || '.' || t.tgname as v
         from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and not t.tgisinternal`,
    ),
    restricoes: await lista(
      `select c.relname || '.' || k.conname || ' ' || pg_get_constraintdef(k.oid) as v
         from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1`,
    ),
    funcoes: await lista(
      `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as v
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = $1
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`,
    ),
    indices: await lista('select indexname || \' \' || indexdef as v from pg_indexes where schemaname = $1'),
  };
}
