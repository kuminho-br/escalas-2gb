import { quadroParaOPosto } from '../cadastros/quadros.ts';
import { hashPassword } from 'better-auth/crypto';
import type { Banco } from '../banco/banco.ts';
import { inicioDoMes } from '../datas.ts';

export interface DadosAdmin {
  matricula: string;
  postoSigla: string;
  nomeGuerra: string;
  email: string;
  senha: string;
  /** 'aaaa-mm-dd', normalmente hojeRecife() */
  hoje: string;
}

/**
 * Cria o administrador (comando de instalação, D3): o militar se ainda não existir, o usuário,
 * a conta com senha e o papel de administrador na unidade raiz, a partir do dia 1 do mês.
 */
export async function criarAdmin(banco: Banco, d: DadosAdmin): Promise<{ usuarioId: string; militarId: string }> {
  const senha = await hashPassword(d.senha);
  return banco.transacao(async (tx) => {
    const repetido = await tx.query('select 1 from usuario where lower(email) = lower($1)', [d.email]);
    if (repetido.rows.length) throw new Error('Já existe usuário com este e-mail');

    const posto = await tx.query<{ id: string }>('select id from posto_grad where sigla = $1', [d.postoSigla]);
    if (!posto.rows[0]) throw new Error(`Posto/graduação não encontrado: ${d.postoSigla}`);

    const quadroEscolhido = await quadroParaOPosto(tx, posto.rows[0].id, undefined, null);
    const quadro = { quadroId: 'erro' in quadroEscolhido ? null : quadroEscolhido.quadroId };

    let militarId = (await tx.query<{ id: string }>('select id from militar where matricula = $1', [d.matricula])).rows[0]?.id;
    militarId ??= (
      await tx.query<{ id: string }>(
        'insert into militar (matricula, posto_grad_id, quadro_id, nome_guerra) values ($1, $2, $3, $4) returning id',
        [d.matricula, posto.rows[0].id, quadro.quadroId, d.nomeGuerra],
      )
    ).rows[0]!.id;

    const usuarioId = (
      await tx.query<{ id: string }>(
        'insert into usuario (nome, email, militar_id) values ($1, lower($2), $3) returning id',
        [`${d.postoSigla} ${d.nomeGuerra}`, d.email, militarId],
      )
    ).rows[0]!.id;

    await tx.query(
      "insert into conta (usuario_id, conta_id, provedor_id, senha) values ($1, $2, 'credential', $3)",
      [usuarioId, usuarioId, senha],
    );
    await tx.query(
      "insert into papel_usuario (usuario_id, unidade_id, papel, desde) select $1, id, 'administrador', $2 from unidade where mae_id is null",
      [usuarioId, inicioDoMes(d.hoje)],
    );
    return { usuarioId, militarId };
  });
}
