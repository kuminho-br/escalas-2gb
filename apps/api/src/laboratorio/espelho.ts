import type { Banco, Consulta } from '../banco/banco.ts';
import { quadroParaOPosto } from '../cadastros/quadros.ts';
import { cargaExemploEm } from '../carga/exemplo.ts';
import { ESPELHO_PAPEL, SCHEMA_ESPELHO } from './constantes.ts';

export { ESPELHO_PAPEL, SCHEMA_ESPELHO };

/**
 * Cria o papel de banco do espelho e dá a ele só o que é do espelho. É o isolamento feito pelo banco: a API assume este papel ao falar com o
 * espelho (6.59), e qualquer consulta do papel a uma tabela do real é negada, mesmo que o código erre o caminho.
 * - nenhum privilégio sobre as tabelas e sequências do `public`; o uso do schema `public` fica só para os tipos e operadores das extensões
 *   (`ltree`, `btree_gist`);
 * - todos os privilégios sobre o que há no `laboratorio` (menos o registro de migrações dele, que é do executor) e, pelo privilégio padrão, sobre o que as
 *   próximas migrações criarem lá;
 * - toda função do espelho (os gatilhos de auditoria, por exemplo) fixa o `search_path` dele: o nome de tabela sem schema, dentro dela, é sempre o do
 *   espelho, mesmo que a sessão que grava não tenha o caminho do espelho. Uma função recriada por uma migração nova perde o ajuste, e este preparo o refaz;
 * - o usuário que conecta recebe o direito de assumi-lo (`set role`).
 * Pode rodar de novo. Chamada ao fim de `migrar`, depois que o espelho existe.
 */
export async function prepararPapelDoEspelho(c: Consulta): Promise<void> {
  await c.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = '${ESPELHO_PAPEL}') then
        create role ${ESPELHO_PAPEL} nologin;
      end if;
    end $$;
    grant ${ESPELHO_PAPEL} to current_user;
    revoke all on all tables in schema public from ${ESPELHO_PAPEL};
    revoke all on all sequences in schema public from ${ESPELHO_PAPEL};
    grant usage on schema public to ${ESPELHO_PAPEL};
    grant usage on schema ${SCHEMA_ESPELHO} to ${ESPELHO_PAPEL};
    grant all on all tables in schema ${SCHEMA_ESPELHO} to ${ESPELHO_PAPEL};
    grant all on all sequences in schema ${SCHEMA_ESPELHO} to ${ESPELHO_PAPEL};
    grant all on all functions in schema ${SCHEMA_ESPELHO} to ${ESPELHO_PAPEL};
    alter default privileges in schema ${SCHEMA_ESPELHO} grant all on tables to ${ESPELHO_PAPEL};
    alter default privileges in schema ${SCHEMA_ESPELHO} grant all on sequences to ${ESPELHO_PAPEL};
    alter default privileges in schema ${SCHEMA_ESPELHO} grant all on functions to ${ESPELHO_PAPEL};
    revoke all on ${SCHEMA_ESPELHO}.migracao_aplicada from ${ESPELHO_PAPEL};
    do $$ declare f record; begin
      for f in
        select p.proname, pg_get_function_identity_arguments(p.oid) as args
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = '${SCHEMA_ESPELHO}' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      loop
        execute format('alter function %I.%I(%s) set search_path = ${SCHEMA_ESPELHO}, public', '${SCHEMA_ESPELHO}', f.proname, f.args);
      end loop;
    end $$;
  `);
}

type Nivel = 'administrador' | 'gestor' | 'gestor_lateral' | 'escalante' | 'militar';

/** Os usuários de teste, um por nível de acesso. Nomes e matrículas fictícios; ninguém entra com eles, a 6.59 injeta a sessão. Também fazem parte da carga que o `separar-teste` reconhece. */
export const PERFIS_DE_TESTE: { id: string; nome: string; nivel: Nivel; unidade: string | null; posto: string; matricula: string; guerra: string; email: string }[] = [
  { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Administrador de teste', nivel: 'administrador', unidade: null, posto: 'CAP', matricula: '100101-1', guerra: 'TESTE ADM', email: 'administrador@laboratorio.invalid' },
  { id: '00000000-0000-4000-8000-0000000000a2', nome: 'Gestor de teste', nivel: 'gestor', unidade: '2º GB', posto: 'MAJ', matricula: '100102-2', guerra: 'TESTE GESTOR', email: 'gestor@laboratorio.invalid' },
  { id: '00000000-0000-4000-8000-0000000000a3', nome: 'Quinto nível de teste', nivel: 'gestor_lateral', unidade: '1ª SB', posto: '1º TEN', matricula: '100103-3', guerra: 'TESTE QUINTO', email: 'quinto-nivel@laboratorio.invalid' },
  { id: '00000000-0000-4000-8000-0000000000a4', nome: 'Auxiliar administrativo de teste', nivel: 'escalante', unidade: '1ª SB', posto: 'ST', matricula: '100104-4', guerra: 'TESTE AUX', email: 'auxiliar@laboratorio.invalid' },
  { id: '00000000-0000-4000-8000-0000000000a5', nome: 'Militar de teste', nivel: 'militar', unidade: null, posto: 'SD', matricula: '100105-5', guerra: 'TESTE MILITAR', email: 'militar@laboratorio.invalid' },
];

/** Cria os cinco usuários de teste que ainda faltam, lotados na 1ª SB e com o nível dado. Devolve quantos existem. */
async function criarPerfisDeTeste(tx: Consulta, mes: string): Promise<number> {
  const secao = (await tx.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]?.id;
  if (!secao) throw new Error('Unidade 1ª SB não encontrada no espelho.');
  for (const p of PERFIS_DE_TESTE) {
    if ((await tx.query('select 1 from usuario where email = $1', [p.email])).rows.length) continue;
    const posto = (await tx.query<{ id: string }>('select id from posto_grad where sigla = $1', [p.posto])).rows[0]?.id;
    if (!posto) throw new Error(`Posto não encontrado no espelho: ${p.posto}`);
    const militar = (
      await tx.query<{ id: string }>(
        'insert into militar (matricula, posto_grad_id, nome_guerra, antiguidade, de_teste) values ($1, $2, $3, $4, true) returning id',
        [p.matricula, posto, p.guerra, 100 + PERFIS_DE_TESTE.indexOf(p)],
      )
    ).rows[0]!.id;
    const usuario = (
      await tx.query<{ id: string }>('insert into usuario (id, nome, email, militar_id) values ($1, $2, $3, $4) returning id', [p.id, p.nome, p.email, militar])
    ).rows[0]!.id;
    const quadro = await quadroParaOPosto(tx, posto, undefined, null);
    await tx.query("insert into rastreio (militar_id, unidade_id, jornada, desde, quadro_id) values ($1, $2, 'adm', $3, $4)", [
      militar, secao, mes, 'erro' in quadro ? null : quadro.quadroId,
    ]);
    if (p.nivel !== 'militar') {
      await tx.query(
        `insert into papel_usuario (usuario_id, unidade_id, papel, desde)
         select $1::uuid, id, $2, $3::date from unidade where ${p.unidade === null ? 'mae_id is null' : 'sigla = $4'}`,
        p.unidade === null ? [usuario, p.nivel, mes] : [usuario, p.nivel, mes, p.unidade],
      );
    }
  }
  return (await tx.query<{ n: number }>("select count(*)::int as n from usuario where email like '%@laboratorio.invalid'")).rows[0]!.n;
}

/**
 * A carga do espelho: os militares fictícios (a mesma carga de exemplo de sempre) e os cinco usuários de teste, tudo no `laboratorio` e tudo marcado como teste (`de_teste`).
 * Recusa se o espelho não existir: sem ele o `search_path` cairia no `public`, e a carga fictícia nunca vai para o real. Repetível: não duplica.
 */
export async function cargaDoEspelho(banco: Banco, mes: string): Promise<{ militares: number; perfis: number }> {
  return banco.transacao((tx) => cargaDoEspelhoEm(tx, mes));
}

/** O corpo da carga do espelho, sobre a transação dada (a do `recomecarEspelho` a reaproveita). Depois dela a transação segue com o papel do espelho: quem precisa voltar ao dono, faz `reset role`. */
export async function cargaDoEspelhoEm(tx: Consulta, mes: string): Promise<{ militares: number; perfis: number }> {
  await tx.exec(`set local search_path to ${SCHEMA_ESPELHO}, public`);
  const alvo = (await tx.query<{ s: string | null }>('select current_schema() as s')).rows[0]!.s;
  if (alvo !== SCHEMA_ESPELHO) throw new Error('A carga de teste só roda no espelho (schema laboratorio), e ele não existe neste banco.');
  // como o papel do espelho: se a carga escrevesse no real por engano, o banco negaria
  await tx.exec(`set local role ${ESPELHO_PAPEL}`);
  const { militares } = await cargaExemploEm(tx, mes, { deTeste: true });
  const perfis = await criarPerfisDeTeste(tx, mes);
  // no espelho tudo é de teste: o que já estava lá sem a marca (um espelho carregado antes da coluna existir) ganha a marca agora
  await tx.exec('update militar set de_teste = true where not de_teste');
  return { militares, perfis };
}

export interface PerfilDeTeste {
  usuarioId: string;
  nome: string;
  /** o nível de acesso: `administrador`, `gestor`, `gestor_lateral`, `escalante` ou `militar` (militar comum, sem nível) */
  nivel: string;
}

/** Os usuários de teste do espelho, com o nível de cada um, na ordem do mais alto ao militar comum (o seletor de perfil da 6.59). */
export async function perfisDeTeste(c: Consulta): Promise<PerfilDeTeste[]> {
  const { rows } = await c.query<PerfilDeTeste>(
    `select u.id as "usuarioId", u.nome, coalesce(p.papel, 'militar') as nivel
       from ${SCHEMA_ESPELHO}.usuario u left join ${SCHEMA_ESPELHO}.papel_usuario p on p.usuario_id = u.id
      where u.id = any($1::uuid[])
      order by array_position(array['administrador', 'gestor', 'gestor_lateral', 'escalante', 'militar']::text[], coalesce(p.papel, 'militar')), u.nome`,
    // só os cinco perfis (os ids são fixos): um usuário a mais no espelho não vira perfil
    [PERFIS_DE_TESTE.map((p) => p.id)],
  );
  return rows;
}
