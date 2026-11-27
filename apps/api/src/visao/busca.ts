// A busca de "Pesquisar militares" com filtros (entrega 6.51): POST /api/consulta/militares/buscar. A Consulta é de toda conta; só `texto` e `unidades` (a lotação) valem para
// todas. Os outros filtros existem para quem tem nível de acesso em alguma unidade (para os demais são ignorados, sem erro) e, quando revelam o que a Identificação não mostra
// (jornada, equipe, situação, voluntário JES, motorista e CNH, função, afastamento, cadastro incompleto), só enxergam os militares lotados onde a pessoa tem nível de acesso
// (ou abaixo): assim ninguém descobre por um filtro o que a ficha não lhe mostra.
import { categoriasQueHabilitam } from 'dominio';
import { LIMITE_DA_BUSCA_COM_FILTROS, LIMITE_DA_BUSCA_SEM_CORTE, type FiltrosDaBusca, type LinhaDaBusca, type ResultadoDaBusca } from 'contratos';
import { ehAdministrador, papeisVigentes } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { rotulosDoBanco } from '../importacao/caminho-da-unidade.ts';
import { COM_ACENTO, LIMITE_DA_BUSCA, palavrasDaBusca, SEM_ACENTO } from './consulta.ts';

/** O que a busca devolve, ou o erro que a rota repete (com o status). */
export type RespostaDaBusca = { ok: true; resultado: ResultadoDaBusca } | { ok: false; status: 400 | 403 | 404; erro: string };

/** A matrícula só com os dígitos: "100012-3" e "1000123" são a mesma; sem dígito nenhum, vale o texto (vai para as não encontradas). */
const chaveDaMatricula = (m: string) => m.replace(/\D/g, '') || m;

type Linha = {
  id: string; posto: string; nome_guerra: string; nome_completo: string | null; matricula: string; lotacao: string | null; quadro: string | null;
  equipe: string | null; jornada: 'pronto' | 'adm' | null; situacao: string | null; unidade_id: string | null; pode_alterar: boolean;
};

/**
 * `semCorte` (6.54): a lista inteira do filtro, sem o corte de 500 (para "Selecionar todos" e para a exportação). Só de quem tem nível de acesso (403 para os outros) e até 5000
 * militares (acima, 400 pedindo para afinar a busca).
 */
export async function buscarComFiltros(c: Consulta, usuarioId: string, f: FiltrosDaBusca, hoje: string, opcoes: { semCorte?: boolean } = {}): Promise<RespostaDaBusca> {
  const admin = await ehAdministrador(c, usuarioId, hoje);
  const temNivel = admin || (await papeisVigentes(c, usuarioId, hoje)).length > 0;
  const texto = (f.texto ?? '').trim();
  // quem tem nível de acesso recebe até 500 linhas; o militar comum, as 50 de sempre da Consulta (a varredura da corporação não rende mais por esta rota)
  if (opcoes.semCorte && !temNivel) return { ok: false, status: 403, erro: 'Só quem tem nível de acesso vê o resultado inteiro.' };
  const limite = opcoes.semCorte ? LIMITE_DA_BUSCA_SEM_CORTE : temNivel ? LIMITE_DA_BUSCA_COM_FILTROS : LIMITE_DA_BUSCA;
  const unidades = f.unidades ?? [];
  // o que só quem tem nível de acesso usa; os arrays vazios valem como "sem filtro"
  const restritos = temNivel
    ? { ...f, matriculas: f.matriculas?.length ? f.matriculas : undefined, postoGradIds: f.postoGradIds?.length ? f.postoGradIds : undefined, quadroIds: f.quadroIds?.length ? f.quadroIds : undefined,
        situacaoIds: f.situacaoIds?.length ? f.situacaoIds : undefined, cnh: f.cnh?.length ? f.cnh : undefined, funcaoIds: f.funcaoIds?.length ? f.funcaoIds : undefined }
    : {};
  const r = restritos as FiltrosDaBusca;
  const dadosRestritos = [r.jornada, r.equipe, r.situacaoIds, r.voluntarioJes, r.motorista, r.cnh, r.funcaoIds, r.afastadoHoje, r.cadastroIncompleto].some((v) => v !== undefined);
  const algumRestrito = dadosRestritos || [r.matriculas, r.postoGradIds, r.quadroIds].some((v) => v !== undefined);
  if (!(unidades.length > 0 || texto.length >= 3 || algumRestrito)) return { ok: false, status: 400, erro: 'Escolha pelo menos um filtro.' };

  if (unidades.length) {
    const ids = [...new Set(unidades.map((u) => u.id))];
    const achadas = (await c.query<{ n: number }>('select count(*)::int as n from unidade where id = any($1::uuid[])', [ids])).rows[0]!.n;
    if (achadas !== ids.length) return { ok: false, status: 404, erro: 'Unidade não encontrada.' };
  }

  const p: unknown[] = [];
  const par = (v: unknown, tipo = '') => { p.push(v); return `$${p.length}${tipo}`; };
  const pHoje = par(hoje, '::date');
  const pUsuario = par(usuarioId, '::uuid');
  const pAdmin = par(admin, '::boolean');
  // quem pede tem nível de acesso na unidade do militar ou acima (`soAcima`: só acima, ou na própria se for a raiz: o "nível de cima" do Pecúlio)
  const nivel = (soAcima: boolean) =>
    `exists (select 1 from papel_usuario pu join unidade a on a.id = pu.unidade_id
              where pu.usuario_id = ${pUsuario} and pu.desde <= ${pHoje} and (pu.ate is null or pu.ate >= ${pHoje}) and a.caminho @> un.caminho${soAcima ? ' and (a.id <> un.id or un.mae_id is null)' : ''})`;
  const noAlcance = `(${pAdmin} or (un.id is not null and ${nivel(false)}))`;
  const podeAlterar = `(${pAdmin} or (un.id is not null and ${nivel(true)}))`;

  const onde: string[] = [];
  if (texto) {
    onde.push(`not exists (select 1 from unnest(${par(palavrasDaBusca(texto), '::text[]')}) as w(t)
      where upper(translate(m.nome_guerra || ' ' || coalesce(m.nome_completo, '') || ' ' || m.matricula || ' ' || replace(m.matricula, '-', ''), ${par(COM_ACENTO)}, ${par(SEM_ACENTO)})) not like '%' || w.t || '%' escape '\\')`);
  }
  if (unidades.length) {
    const soEla = [...new Set(unidades.filter((u) => !u.comAsDeBaixo).map((u) => u.id))];
    const comBaixo = [...new Set(unidades.filter((u) => u.comAsDeBaixo).map((u) => u.id))];
    const partes: string[] = [];
    if (soEla.length) partes.push(`un.id = any(${par(soEla, '::uuid[]')})`);
    if (comBaixo.length) partes.push(`exists (select 1 from unidade ub where ub.id = any(${par(comBaixo, '::uuid[]')}) and un.caminho <@ ub.caminho)`);
    onde.push(`(${partes.join(' or ')})`);
  }
  // o arquivo: as matrículas sem pontuação; quem não é achado volta em `naoEncontradas`
  const chaves = r.matriculas ? [...new Set(r.matriculas.map((m) => m.trim()).filter(Boolean).map(chaveDaMatricula))] : [];
  if (r.matriculas) onde.push(`regexp_replace(m.matricula, '[^0-9]', '', 'g') = any(${par(chaves, '::text[]')})`);
  if (r.postoGradIds) onde.push(`m.posto_grad_id = any(${par(r.postoGradIds, '::uuid[]')})`);
  if (r.quadroIds) onde.push(`r.quadro_id = any(${par(r.quadroIds, '::uuid[]')})`);
  if (dadosRestritos) onde.push(noAlcance);
  if (r.jornada) onde.push(`r.jornada = ${par(r.jornada)}`);
  if (r.equipe) onde.push(`upper(e.nome) = upper(${par(r.equipe)})`);
  if (r.situacaoIds) onde.push(`r.situacao_id = any(${par(r.situacaoIds, '::uuid[]')})`);
  if (r.voluntarioJes !== undefined) onde.push(`m.voluntario_jes = ${par(r.voluntarioJes)}`);
  if (r.motorista !== undefined) onde.push(`m.motorista = ${par(r.motorista)}`);
  // a CNH pela hierarquia do CTB (decisão de 25/11/2026): pedir B traz quem tem B ou uma categoria que a habilite (C, D, E); A só A
  if (r.cnh) onde.push(`m.cnh && ${par(categoriasQueHabilitam(r.cnh), '::text[]')}`);
  if (r.funcaoIds) onde.push(`m.funcao_militar_id = any(${par(r.funcaoIds, '::uuid[]')})`);
  if (r.afastadoHoje !== undefined) {
    onde.push(`${r.afastadoHoje ? '' : 'not '}exists (select 1 from afastamento af where af.militar_id = m.id and af.inicio <= ${pHoje} and af.fim >= ${pHoje})`);
  }
  if (r.cadastroIncompleto !== undefined) {
    // as pendências de cadastro de `pendenciasDoMilitar`, menos "antiguidade repetida" (essa depende dos outros militares da unidade)
    const incompleto = `((m.motorista and cardinality(m.cnh) = 0) or (r.jornada = 'pronto' and r.equipe_id is null) or r.id is null or m.antiguidade is null or btrim(coalesce(m.nome_completo, '')) = '' or r.quadro_id is null)`;
    onde.push(r.cadastroIncompleto ? incompleto : `not ${incompleto}`);
  }

  const { rows } = await c.query<Linha>(
    `select m.id, p.sigla as posto, m.nome_guerra, m.nome_completo, m.matricula, un.sigla as lotacao, q.sigla as quadro,
            case when ${noAlcance} then e.nome end as equipe, case when ${noAlcance} then r.jornada end as jornada, case when ${noAlcance} then sm.nome end as situacao,
            un.id as unidade_id, ${podeAlterar} as pode_alterar
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join rastreio r on r.militar_id = m.id and r.desde <= ${pHoje} and (r.ate is null or r.ate >= ${pHoje})
       left join unidade un on un.id = r.unidade_id
       left join quadro q on q.id = r.quadro_id
       left join equipe e on e.id = r.equipe_id
       left join situacao_militar sm on sm.id = r.situacao_id
      where ${onde.join(' and ')}
      order by m.nome_guerra, m.matricula
      limit ${limite + 1}`,
    p,
  );
  if (opcoes.semCorte && rows.length > limite) return { ok: false, status: 400, erro: `Mais de ${LIMITE_DA_BUSCA_SEM_CORTE} militares. Afine a busca.` };
  // a unidade de cada militar pelo menor caminho que a identifica; o cálculo é feito uma vez por busca, para as unidades da corporação
  const rotulos = rows.some((m) => m.unidade_id) ? await rotulosDoBanco(c, hoje, rows.map((m) => m.unidade_id)) : new Map<string, string>();
  const militares: LinhaDaBusca[] = rows.slice(0, limite).map((m) => ({
    id: m.id, postoGrad: m.posto, nomeGuerra: m.nome_guerra, nomeCompleto: m.nome_completo, matricula: m.matricula, lotacao: m.lotacao, quadro: m.quadro,
    equipe: m.equipe, jornada: m.jornada, situacao: m.situacao, unidadeId: m.unidade_id, lotacaoCaminho: m.unidade_id ? (rotulos.get(m.unidade_id) ?? m.lotacao) : null, podeAlterar: m.pode_alterar,
  }));

  let naoEncontradas: string[] = [];
  if (r.matriculas) {
    const achadas = new Set((await c.query<{ n: string }>(`select regexp_replace(matricula, '[^0-9]', '', 'g') as n from militar where regexp_replace(matricula, '[^0-9]', '', 'g') = any($1::text[])`, [chaves])).rows.map((x) => x.n));
    const vistas = new Set<string>();
    for (const bruta of r.matriculas.map((m) => m.trim()).filter(Boolean)) {
      const chave = chaveDaMatricula(bruta);
      if (achadas.has(chave) || vistas.has(chave)) continue;
      vistas.add(chave);
      naoEncontradas.push(bruta);
    }
  }
  return { ok: true, resultado: { militares, haMais: rows.length > limite, naoEncontradas } };
}
