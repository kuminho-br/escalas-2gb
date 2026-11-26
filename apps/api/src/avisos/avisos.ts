// Os avisos da tela inicial (6.56): quem vê (pela lotação de hoje), a ordem e quem pode alterar.
import type { Aviso } from 'contratos';
import { CADASTRO, papeisVigentes } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';

type Linha = {
  id: string; unidade_id: string; sigla: string; titulo: string; texto: string; fixado: boolean; vale_ate: string | null; publicado_em: string; patente: string; nome_guerra: string; pode_alterar: boolean;
};

const paraAviso = (x: Linha): Aviso => ({
  id: x.id, unidadeId: x.unidade_id, unidadeSigla: x.sigla, titulo: x.titulo, texto: x.texto, fixado: x.fixado, valeAte: x.vale_ate, publicadoEm: x.publicado_em,
  autor: { patente: x.patente, nomeGuerra: x.nome_guerra }, podeAlterar: x.pode_alterar,
});

/** As colunas do aviso e o que se junta a elas: a unidade, o autor (posto e nome de guerra) e se a conta ($1) pode alterá-lo (é a autora, ou tem nível de acesso na unidade do aviso ou numa de cima em $2; $3 são os papéis). */
const SELECIONAR = `select a.id, a.unidade_id, u.sigla, a.titulo, a.texto, a.fixado, to_char(a.vale_ate, 'YYYY-MM-DD') as vale_ate,
         to_char(a.publicado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as publicado_em, p.sigla as patente, m.nome_guerra,
         (a.autor_id = $1 or exists (
            select 1 from papel_usuario pu join unidade pa on pa.id = pu.unidade_id
             where pu.usuario_id = $1 and pu.desde <= $2::date and (pu.ate is null or pu.ate >= $2::date) and pu.papel = any($3) and pa.caminho @> u.caminho
         )) as pode_alterar
    from aviso a
    join unidade u on u.id = a.unidade_id
    join usuario au on au.id = a.autor_id
    join militar m on m.id = au.militar_id
    join posto_grad p on p.id = m.posto_grad_id`;

/**
 * Os avisos que a conta vê: os da unidade em que o militar está lotado hoje e os das de cima dela (o aviso do 2º GB chega a quem está na 1ª SB), sem os retirados e sem os vencidos
 * (`vale_ate` é o último dia em que o aviso aparece). Os fixados primeiro, do mais novo ao mais velho; depois os outros, do mais novo ao mais velho. Sem lotação hoje, nenhum.
 */
export async function avisosVisiveis(c: Consulta, usuarioId: string, hoje: string): Promise<Aviso[]> {
  const { rows } = await c.query<Linha>(
    `${SELECIONAR}
      where a.retirado_em is null and (a.vale_ate is null or a.vale_ate >= $2::date)
        and u.caminho @> (select lu.caminho from rastreio r join usuario x on x.militar_id = r.militar_id join unidade lu on lu.id = r.unidade_id
                           where x.id = $1 and r.desde <= $2::date and (r.ate is null or r.ate >= $2::date) limit 1)
      order by a.fixado desc, a.publicado_em desc, a.id`,
    [usuarioId, hoje, CADASTRO],
  );
  return rows.map(paraAviso);
}

/** Um aviso (não retirado) pelo id, do ponto de vista da conta; null se não existe ou foi retirado. */
export async function umAviso(c: Consulta, usuarioId: string, hoje: string, id: string): Promise<Aviso | null> {
  const { rows } = await c.query<Linha>(`${SELECIONAR} where a.id = $4 and a.retirado_em is null`, [usuarioId, hoje, CADASTRO, id]);
  return rows[0] ? paraAviso(rows[0]) : null;
}

/** A conta tem nível de acesso em alguma unidade? Então vê o botão de publicar. */
export async function podePublicarEmAlgumaUnidade(c: Consulta, usuarioId: string, hoje: string): Promise<boolean> {
  const papeis = await papeisVigentes(c, usuarioId, hoje);
  return papeis.some((p) => (CADASTRO as string[]).includes(p.papel));
}
