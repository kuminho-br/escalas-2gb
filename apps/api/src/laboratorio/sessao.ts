// A sessão no Laboratório (6.59): a ligação entre a conta real e o perfil de teste que ela escolheu. A tabela é do real; o perfil é um usuário do espelho.
import { perfisDeTeste } from './espelho.ts';
import type { Consulta } from '../banco/banco.ts';

export const PERFIL_NAO_ENCONTRADO = 'Perfil de teste não encontrado.';
export const EM_MANUTENCAO = 'O Laboratório está em manutenção.';

export interface PerfilEmUso {
  perfilId: string;
  nome: string;
  nivel: string;
}

/** O espelho existe neste banco (o schema `laboratorio` foi criado pelo executor de migrações)? */
export async function espelhoExiste(c: Consulta): Promise<boolean> {
  return (await c.query<{ ok: boolean }>("select to_regclass('laboratorio.usuario') is not null as ok")).rows[0]!.ok;
}

/** Os perfis de teste, com o nome e o nível (a lista que a pessoa vê ao escolher). */
export async function listarPerfis(c: Consulta): Promise<PerfilEmUso[]> {
  return (await perfisDeTeste(c)).map((p) => ({ perfilId: p.usuarioId, nome: p.nome, nivel: p.nivel }));
}

/** Grava (ou troca) o perfil da conta. Devolve `null` se `perfilId` não é um dos perfis de teste do espelho. */
export async function entrarNoLaboratorio(c: Consulta, usuarioId: string, perfilId: string): Promise<{ perfilId: string; nome: string } | null> {
  const perfil = (await listarPerfis(c)).find((p) => p.perfilId === perfilId);
  if (!perfil) return null;
  await c.query(
    `insert into laboratorio_sessao (usuario_id, perfil_id) values ($1, $2)
     on conflict (usuario_id) do update set perfil_id = excluded.perfil_id, desde = now()`,
    [usuarioId, perfilId],
  );
  return { perfilId: perfil.perfilId, nome: perfil.nome };
}

/** O perfil em uso da conta, ou `null` se ela não está no Laboratório (ou o perfil deixou de existir no espelho). */
export async function perfilDoLaboratorio(c: Consulta, usuarioId: string): Promise<PerfilEmUso | null> {
  const sessao = (await c.query<{ perfil_id: string }>('select perfil_id from laboratorio_sessao where usuario_id = $1', [usuarioId])).rows[0];
  if (!sessao) return null;
  return (await listarPerfis(c)).find((p) => p.perfilId === sessao.perfil_id) ?? null;
}

export async function sairDoLaboratorio(c: Consulta, usuarioId: string): Promise<void> {
  await c.query('delete from laboratorio_sessao where usuario_id = $1', [usuarioId]);
}
