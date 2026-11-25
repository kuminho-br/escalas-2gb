// A consulta de militares (entrega 6.11): a busca e a ficha de consulta. A busca alcança a corporação inteira e mostra só a Identificação; a
// ficha mostra só os blocos que a borda das camadas libera para quem pede (a chave de um bloco que a pessoa não vê fica ausente). CPF,
// nascimento e endereço nem são lidos do banco aqui: não há como vazarem por esta rota.
import type { FichaDeConsulta, LinhaDaConsulta, PeriodoDaConsulta, ResultadoDaConsulta, UnidadeDaConsulta } from 'contratos';
import { CADASTRO, ehAdministrador, GESTAO, temPapel } from '../acesso.ts';
import { COM_CAMINHO, paraUnidade, porCaminho, type LinhaDaUnidade } from '../arvore.ts';
import type { Consulta } from '../banco/banco.ts';
import { blocosDaUnidade } from './visao.ts';

/** A busca traz no máximo isto; com mais, avisa (a pessoa refina). */
export const LIMITE_DA_BUSCA = 50;
const MAXIMO_DE_PALAVRAS = 8;

// Maiúsculas sem acento, igual no texto da busca (aqui) e no nome guardado (no banco, com translate + upper): os acentos que o português usa.
const GRUPOS: [string, string][] = [['ÁÀÂÃÄáàâãä', 'A'], ['ÉÈÊËéèêë', 'E'], ['ÍÌÎÏíìîï', 'I'], ['ÓÒÔÕÖóòôõö', 'O'], ['ÚÙÛÜúùûü', 'U'], ['Çç', 'C'], ['Ññ', 'N']];
const COM_ACENTO = GRUPOS.map(([letras]) => letras).join('');
const SEM_ACENTO = GRUPOS.map(([letras, base]) => base.repeat(letras.length)).join('');
const semAcento = (t: string) => [...t].map((ch) => { const i = COM_ACENTO.indexOf(ch); return i >= 0 ? SEM_ACENTO[i]! : ch; }).join('').replace(/[a-z]/g, (x) => x.toUpperCase());
/** `%`, `_` e `\` valem como letras na busca: sem isto, "%%%" acharia a corporação inteira. */
const comoLetras = (t: string) => t.replace(/[\\%_]/g, '\\$&');

/** As palavras do texto da busca, prontas para comparar (maiúsculas, sem acento, com `%`, `_` e `\` escapados). */
export function palavrasDaBusca(texto: string): string[] {
  return semAcento(texto.trim()).split(/\s+/).filter(Boolean).slice(0, MAXIMO_DE_PALAVRAS).map(comoLetras);
}

/** A árvore da corporação, para a pessoa escolher a unidade da busca: as vigentes, na ordem da árvore. */
export async function unidadesDaConsulta(c: Consulta, hoje: string): Promise<UnidadeDaConsulta[]> {
  const { rows } = await c.query<LinhaDaUnidade>(`${COM_CAMINHO} where u.ate is null or u.ate >= $1::date`, [hoje]);
  return rows.map(paraUnidade).sort(porCaminho).map((u) => ({ id: u.id, sigla: u.sigla, nivel: u.nivel, maeId: u.maeId }));
}

type LinhaBanco = { id: string; posto: string; nome_guerra: string; nome_completo: string | null; matricula: string; lotacao: string | null; quadro: string | null; da_unidade?: boolean | null };
const paraLinha = (m: LinhaBanco): LinhaDaConsulta => ({ id: m.id, postoGrad: m.posto, nomeGuerra: m.nome_guerra, nomeCompleto: m.nome_completo, matricula: m.matricula, lotacao: m.lotacao, quadro: m.quadro, ...(m.da_unidade == null ? {} : { daUnidade: m.da_unidade }) });

/** O período de hoje, com a sigla da unidade e a do quadro: a lotação e o quadro que a consulta mostra. */
const DO_MILITAR_HOJE = `
  from militar m
  join posto_grad p on p.id = m.posto_grad_id
  left join rastreio r on r.militar_id = m.id and r.desde <= $1::date and (r.ate is null or r.ate >= $1::date)
  left join unidade un on un.id = r.unidade_id
  left join quadro q on q.id = r.quadro_id`;
const COLUNAS = 'm.id, p.sigla as posto, m.nome_guerra, m.nome_completo, m.matricula, un.sigla as lotacao, q.sigla as quadro';

/**
 * Busca militares da corporação pelo nome de guerra, o nome completo ou a matrícula (todas as palavras do texto precisam aparecer), sem
 * diferenciar maiúsculas nem acentos; a matrícula acha com ou sem o hífen (990001-1 ou 9900011). Com `unidadeId`, só quem está lotado hoje nela ou numa de baixo.
 */
export async function buscarMilitares(c: Consulta, d: { texto: string; unidadeId: string | null; hoje: string; unidadeDeTrabalho?: string | null }): Promise<ResultadoDaConsulta> {
  const { rows } = await c.query<LinhaBanco>(
    // com a unidade de trabalho (6.36), cada linha diz se o militar já é dela (lotado nela ou numa de baixo): quem já é não precisa ser trazido
    `select ${COLUNAS}, case when $6::uuid is null then null else coalesce(un.caminho <@ (select caminho from unidade where id = $6::uuid), false) end as da_unidade ${DO_MILITAR_HOJE}
      where ($2::uuid is null or un.caminho <@ (select caminho from unidade where id = $2::uuid))
        and not exists (
          select 1 from unnest($3::text[]) as w(t)
           where upper(translate(m.nome_guerra || ' ' || coalesce(m.nome_completo, '') || ' ' || m.matricula || ' ' || replace(m.matricula, '-', ''), $4, $5)) not like '%' || w.t || '%' escape '\\')
      order by m.nome_guerra, m.matricula
      limit ${LIMITE_DA_BUSCA + 1}`,
    [d.hoje, d.unidadeId, palavrasDaBusca(d.texto), COM_ACENTO, SEM_ACENTO, d.unidadeDeTrabalho ?? null],
  );
  return { militares: rows.slice(0, LIMITE_DA_BUSCA).map(paraLinha), haMais: rows.length > LIMITE_DA_BUSCA };
}

type LinhaDaFicha = LinhaBanco & {
  funcao: string | null; unidade_id: string | null; telefone: string | null; email: string | null; email_pessoal: string | null; comportamento: string | null; comportamento_boletim: string | null;
  motorista: boolean; cnh: string[]; voluntario_jes: boolean;
};

/** A ficha de consulta de um militar, só com os blocos que `usuarioId` vê; null se o militar não existe. */
export async function fichaDeConsulta(c: Consulta, usuarioId: string, militarId: string, hoje: string, unidadeDeTrabalho?: string): Promise<FichaDeConsulta | null> {
  const m = (await c.query<LinhaDaFicha>(
    `select ${COLUNAS}, (select f.nome from funcao_militar f where f.id = m.funcao_militar_id) as funcao, un.id as unidade_id, m.telefone, m.email, m.email_pessoal, m.comportamento, m.comportamento_boletim, m.motorista, m.cnh, m.voluntario_jes
       ${DO_MILITAR_HOJE} where m.id = $2`,
    [hoje, militarId],
  )).rows[0];
  if (!m) return null;
  const blocos = await blocosDaUnidade(c, usuarioId, m.unidade_id, hoje);
  const ficha: FichaDeConsulta = { ...paraLinha(m), // sem lotação (o militar recém-criado, o administrador da instalação) só o administrador abre a ficha, para dar a primeira
    podeAbrirFichaCompleta: m.unidade_id ? await temPapel(c, usuarioId, m.unidade_id, CADASTRO, hoje) : await ehAdministrador(c, usuarioId, hoje) };

  // o militar externo: o gestor da unidade de trabalho (ou acima) vê o botão de trazer ou tirar, desde que o militar não seja da unidade nem de uma de baixo
  if (unidadeDeTrabalho && m.unidade_id && (await temPapel(c, usuarioId, unidadeDeTrabalho, GESTAO, hoje))) {
    const alvo = (await c.query<{ sigla: string; da_unidade: boolean }>('select a.sigla, u.caminho <@ a.caminho as da_unidade from unidade a join unidade u on u.id = $2 where a.id = $1', [unidadeDeTrabalho, m.unidade_id])).rows[0];
    if (alvo && !alvo.da_unidade) {
      const vinculo = (await c.query<{ id: string }>('select id from vinculo_externo where militar_id = $1 and unidade_id = $2 and desde <= $3::date and (ate is null or ate >= $3::date)', [militarId, unidadeDeTrabalho, hoje])).rows[0];
      ficha.externo = { unidadeSigla: alvo.sigla, vinculoId: vinculo?.id ?? null };
    }
  }

  if (blocos.has('contato')) ficha.contato = { telefone: m.telefone, email: m.email, emailPessoal: m.email_pessoal };

  if (blocos.has('situacao')) {
    const { rows } = await c.query<{ desde: string; ate: string | null; lotacao: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacao: string; atual: boolean }>(
      `select to_char(r.desde, 'YYYY-MM-DD') as desde, to_char(r.ate, 'YYYY-MM-DD') as ate, un.sigla as lotacao, e.nome as equipe, r.jornada, q.sigla as quadro,
              sm.nome as situacao, (r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) as atual
         from rastreio r
         join unidade un on un.id = r.unidade_id
         join situacao_militar sm on sm.id = r.situacao_id
         left join equipe e on e.id = r.equipe_id
         left join quadro q on q.id = r.quadro_id
        where r.militar_id = $1 order by r.desde desc`,
      [militarId, hoje],
    );
    const atual = rows.find((r) => r.atual);
    if (atual) {
      const historico: PeriodoDaConsulta[] = rows.map((r) => ({ desde: r.desde, ate: r.ate, lotacao: r.lotacao, equipe: r.equipe, jornada: r.jornada, quadro: r.quadro, situacaoDoMilitar: r.situacao }));
      ficha.situacao = { equipe: atual.equipe, jornada: atual.jornada, situacaoDoMilitar: atual.situacao, funcao: m.funcao, historico };
    }
  }

  if (blocos.has('afastamentos')) {
    // o motivo e o boletim do afastamento são do bloco "Comportamento": sem ele, a chave nem existe
    const comMotivo = blocos.has('comportamento');
    const { rows } = await c.query<{ tipo: string; inicio: string; fim: string; motivo: string | null; boletim: string | null }>(
      `select t.nome as tipo, to_char(a.inicio, 'YYYY-MM-DD') as inicio, to_char(a.fim, 'YYYY-MM-DD') as fim, a.motivo, a.boletim
         from afastamento a join tipo_afastamento t on t.id = a.tipo_afastamento_id
        where a.militar_id = $1 order by a.inicio`,
      [militarId],
    );
    ficha.afastamentos = rows.map((a) => ({ tipo: a.tipo, inicio: a.inicio, fim: a.fim, ...(comMotivo ? { motivo: a.motivo, boletim: a.boletim } : {}) }));
  }

  if (blocos.has('dados_da_escala')) ficha.dadosDaEscala = { motorista: m.motorista, cnh: [...m.cnh].sort(), voluntarioJes: m.voluntario_jes };
  if (blocos.has('comportamento')) ficha.comportamento = { comportamento: m.comportamento, boletim: m.comportamento_boletim };
  return ficha;
}
