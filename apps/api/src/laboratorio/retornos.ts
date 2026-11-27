// O retorno do Laboratório (6.60): grava no banco REAL, ligado à conta real de quem testou; o perfil de teste em uso vai junto, como dado. O retorno não se altera nem se apaga (o banco recusa).
import type { NovoRetorno, RetornoListado } from 'contratos';
import type { Consulta } from '../banco/banco.ts';

/**
 * A tela em que a pessoa estava, sem os parâmetros: tira o que vem depois de `?` e de `#`, a barra final, e troca o que parece identificador (um uuid, ou só números)
 * por `:id`, para a tela de uma ficha ser a mesma para todos ("/militares/:id").
 */
export function telaSemParametros(tela: string): string {
  const caminho = (tela.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/';
  const limpo = caminho
    .split('/')
    .map((p) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p) || /^\d+$/.test(p) || /^\d{6}-\d$/.test(p) ? ':id' : p))
    .join('/');
  return limpo.startsWith('/') ? limpo : `/${limpo}`;
}

export async function gravarRetorno(c: Consulta, d: { usuarioId: string; perfilDeTeste: string } & NovoRetorno): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    'insert into retorno_laboratorio (ferramenta_id, usuario_id, perfil_de_teste, tela, texto, nota) values ($1, $2, $3, $4, $5, $6) returning id',
    [d.ferramentaId, d.usuarioId, d.perfilDeTeste, telaSemParametros(d.tela), d.texto, d.nota],
  );
  return rows[0]!.id;
}

export interface FiltroDeRetornos {
  ferramenta?: string;
  de?: string;
  ate?: string;
}

/** A lista do administrador: os mais novos primeiro, com o nome e a matrícula da conta real (`conta` é null se a conta foi apagada: o retorno fica, sem autoria). O período vale pela data de Recife. */
export async function listarRetornos(c: Consulta, f: FiltroDeRetornos): Promise<RetornoListado[]> {
  const { rows } = await c.query<{ id: string; ferramenta_id: string; ferramenta: string; nome: string | null; matricula: string | null; perfil_de_teste: string; tela: string; texto: string; nota: number; criado_em: string }>(
    `select r.id, r.ferramenta_id, f.nome as ferramenta, u.nome, m.matricula, r.perfil_de_teste, r.tela, r.texto, r.nota::int as nota,
            to_char(r.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as criado_em
       from retorno_laboratorio r
       join ferramenta_teste f on f.id = r.ferramenta_id
       left join usuario u on u.id = r.usuario_id
       left join militar m on m.id = u.militar_id
      where ($1::uuid is null or r.ferramenta_id = $1)
        and ($2::date is null or (r.criado_em at time zone 'America/Recife')::date >= $2)
        and ($3::date is null or (r.criado_em at time zone 'America/Recife')::date <= $3)
      order by r.criado_em desc
      limit 500`,
    [f.ferramenta ?? null, f.de ?? null, f.ate ?? null],
  );
  return rows.map((r) => ({
    id: r.id, ferramentaId: r.ferramenta_id, ferramenta: r.ferramenta, conta: r.nome !== null && r.matricula !== null ? { nome: r.nome, matricula: r.matricula } : null,
    perfilDeTeste: r.perfil_de_teste, tela: r.tela, texto: r.texto, nota: r.nota, criadoEm: r.criado_em,
  }));
}
