// O registro das exceções (tabela `registro_de_alteracao`, migração 0044): a correção do escalante num voluntariado que o próprio militar marcou (7.1) e a alteração
// no passado de uma escala lançada (7.3). Só de acréscimo: a aplicação grava e lê, nunca atualiza nem apaga.
import { mesParaData, type FaixaDeDisponibilidade, type RegistroDeAlteracao } from 'contratos';
import type { Consulta } from './banco/banco.ts';

export type TipoDeRegistro = RegistroDeAlteracao['tipo'];

export async function registrar(
  tx: Consulta,
  r: { usuarioId: string; unidadeId: string; tipo: TipoDeRegistro; militarId?: string; escalaId?: string; mes: string; data?: string; antes: unknown; depois: unknown; justificativa?: string },
): Promise<void> {
  await tx.query(
    `insert into registro_de_alteracao (usuario_id, unidade_id, tipo, militar_id, escala_id, mes, data, antes, depois, justificativa)
     values ($1, $2, $3, $4, $5, $6::date, $7::date, $8::jsonb, $9::jsonb, $10)`,
    [r.usuarioId, r.unidadeId, r.tipo, r.militarId ?? null, r.escalaId ?? null, mesParaData(r.mes), r.data ?? null, JSON.stringify(r.antes ?? null), JSON.stringify(r.depois ?? null), r.justificativa ?? null],
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const mesmaFaixa = (a: FaixaDeDisponibilidade, b: FaixaDeDisponibilidade) => a.data === b.data && a.inicio === b.inicio && a.fim === b.fim;

/** As faixas de `antes` e `depois` são iguais (a ordem não conta)? */
export function mesmasFaixas(antes: FaixaDeDisponibilidade[], depois: FaixaDeDisponibilidade[]): boolean {
  return antes.length === depois.length && antes.every((a) => depois.some((d) => mesmaFaixa(a, d)));
}

/** A frase da correção do voluntariado: "Tirou 2 faixas e pôs 1 em 3 dias" (os dias contam uma vez só). */
export function textoDaCorrecaoDoVoluntariado(antes: FaixaDeDisponibilidade[], depois: FaixaDeDisponibilidade[]): string {
  const tiradas = antes.filter((a) => !depois.some((d) => mesmaFaixa(a, d)));
  const postas = depois.filter((d) => !antes.some((a) => mesmaFaixa(a, d)));
  const dias = new Set([...tiradas, ...postas].map((x) => x.data)).size;
  const emDias = `em ${plural(dias, 'dia', 'dias')}`;
  if (tiradas.length && postas.length) return `Tirou ${plural(tiradas.length, 'faixa', 'faixas')} e pôs ${postas.length} ${emDias}`;
  if (tiradas.length) return `Tirou ${plural(tiradas.length, 'faixa', 'faixas')} ${emDias}`;
  return `Pôs ${plural(postas.length, 'faixa', 'faixas')} ${emDias}`;
}

type Linha = {
  id: string; em: string; patente: string | null; nome_guerra: string | null; tipo: TipoDeRegistro; data: string | null;
  antes: unknown; depois: unknown; justificativa: string | null;
};

/** O registro de um militar (ou de uma escala) num mês, do mais novo para o mais velho. */
export async function lerRegistro(c: Consulta, filtro: { militarId?: string; escalaId?: string; mes: string; tipo?: TipoDeRegistro }): Promise<RegistroDeAlteracao[]> {
  const { rows } = await c.query<Linha>(
    `select r.id, to_char(r.em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as em, p.sigla as patente, m.nome_guerra, r.tipo,
            to_char(r.data, 'YYYY-MM-DD') as data, r.antes, r.depois, r.justificativa
       from registro_de_alteracao r
       left join usuario u on u.id = r.usuario_id
       left join militar m on m.id = u.militar_id
       left join posto_grad p on p.id = m.posto_grad_id
      where r.mes = $1::date and ($2::uuid is null or r.militar_id = $2) and ($3::uuid is null or r.escala_id = $3) and ($4::text is null or r.tipo = $4)
      order by r.em desc, r.id desc`,
    [mesParaData(filtro.mes), filtro.militarId ?? null, filtro.escalaId ?? null, filtro.tipo ?? null],
  );
  return rows.map(
    (r): RegistroDeAlteracao => ({
      id: r.id,
      em: r.em,
      por: r.patente && r.nome_guerra ? { patente: r.patente, nomeGuerra: r.nome_guerra } : null,
      tipo: r.tipo,
      data: r.data,
      antes: r.antes,
      depois: r.depois,
      justificativa: r.justificativa,
      texto:
        r.tipo === 'voluntariado_corrigido'
          ? textoDaCorrecaoDoVoluntariado((r.antes ?? []) as FaixaDeDisponibilidade[], (r.depois ?? []) as FaixaDeDisponibilidade[])
          : (r.justificativa ?? ''),
    }),
  );
}
