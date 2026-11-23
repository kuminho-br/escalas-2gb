// As camadas de visão (entrega 6.11): quais blocos de dados uma pessoa VÊ de um militar ou de uma unidade. Quem EDITA continua pelo nível de
// acesso (a hierarquia, em acesso.ts); aqui nada dá permissão de gravar. As camadas se somam: a pessoa vê um bloco se alguma camada dela o libera.
import { BLOCOS, CAMADAS, type Bloco, type Borda, type Camada } from 'contratos';
import { CADASTRO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';

/** Os blocos que cada camada vê, como está na tabela `visao_bloco`. */
export type BordaPorCamada = Record<Camada, Set<Bloco>>;

export async function carregarBorda(c: Consulta): Promise<BordaPorCamada> {
  const { rows } = await c.query<{ bloco: Bloco; camada: Camada }>('select bloco, camada from visao_bloco where ve');
  const borda: BordaPorCamada = { todos: new Set(), oficial: new Set(), chefe_divisao: new Set() };
  for (const r of rows) borda[r.camada].add(r.bloco);
  return borda;
}

/** A borda como a tela "Quem vê o quê" a mostra: uma linha por bloco, na ordem fixa dos blocos. */
export async function lerBorda(c: Consulta): Promise<Borda> {
  const porCamada = await carregarBorda(c);
  return BLOCOS.map((bloco) => ({ bloco, todos: porCamada.todos.has(bloco), oficial: porCamada.oficial.has(bloco), chefeDivisao: porCamada.chefe_divisao.has(bloco) }));
}

/** Está, hoje, num quadro marcado como "de oficiais"? Vale o quadro do período do rastreio de hoje: uma mudança marcada para depois não conta ainda. */
async function ehOficial(c: Consulta, usuarioId: string, hoje: string): Promise<boolean> {
  const { rows } = await c.query<{ ok: boolean }>(
    `select exists (
       select 1 from usuario u
         join rastreio r on r.militar_id = u.militar_id
         join quadro q on q.id = r.quadro_id
        where u.id = $1 and q.oficial and r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)
     ) as ok`,
    [usuarioId, hoje],
  );
  return rows[0]!.ok;
}

/**
 * A unidade está numa divisão irmã de uma em que a pessoa é chefe de divisão (vigente), ou abaixo dela? Divisão irmã é a que tem a mesma
 * unidade mãe (o grupamento); a própria divisão da pessoa entra na conta, mas lá a hierarquia já dá tudo. Seção direto no grupamento, o
 * grupamento e as unidades de outro grupamento ficam de fora.
 */
async function ehChefeSobre(c: Consulta, usuarioId: string, unidadeId: string, hoje: string): Promise<boolean> {
  const { rows } = await c.query<{ ok: boolean }>(
    `select exists (
       select 1
         from papel_usuario pu
         join unidade x on x.id = pu.unidade_id
         join unidade d on d.tipo = 'divisao' and d.mae_id = x.mae_id
         join unidade alvo on alvo.id = $3 and d.caminho @> alvo.caminho
        where pu.usuario_id = $1 and pu.papel = 'chefe_divisao' and pu.desde <= $2::date and (pu.ate is null or pu.ate >= $2::date)
     ) as ok`,
    [usuarioId, hoje, unidadeId],
  );
  return rows[0]!.ok;
}

/**
 * As camadas que a pessoa tem sobre uma unidade (ou sobre quem não tem lotação, com `unidadeId` null): `todos` sempre; `oficial` pelo quadro
 * do período de hoje de quem pede; `chefe_divisao` quando a unidade está numa divisão irmã de uma em que ela é chefe, ou abaixo.
 */
export async function camadasSobreUnidade(c: Consulta, usuarioId: string, unidadeId: string | null, hoje: string): Promise<Camada[]> {
  const camadas: Camada[] = ['todos'];
  if (await ehOficial(c, usuarioId, hoje)) camadas.push('oficial');
  if (unidadeId && (await ehChefeSobre(c, usuarioId, unidadeId, hoje))) camadas.push('chefe_divisao');
  return camadas.sort((a, b) => CAMADAS.indexOf(a) - CAMADAS.indexOf(b));
}

/**
 * Os blocos que a pessoa vê de quem está lotado na unidade: a união das camadas dela, e todos os blocos para quem tem nível de acesso na
 * unidade ou acima (a hierarquia vale por cima). Sem unidade, só a identificação, se a borda a libera para `todos` ou `oficial`.
 */
export async function blocosDaUnidade(c: Consulta, usuarioId: string, unidadeId: string | null, hoje: string): Promise<Set<Bloco>> {
  if (unidadeId && (await temPapel(c, usuarioId, unidadeId, CADASTRO, hoje))) return new Set(BLOCOS);
  const borda = await carregarBorda(c);
  const blocos = new Set<Bloco>();
  for (const camada of await camadasSobreUnidade(c, usuarioId, unidadeId, hoje)) for (const b of borda[camada]) blocos.add(b);
  // sem lotação não há unidade para ligar o militar a nenhum outro bloco
  return unidadeId ? blocos : new Set(blocos.has('identificacao') ? (['identificacao'] as const) : []);
}

/** A unidade em que o militar está lotado hoje: a do período que cobre hoje; null se não há. */
export async function lotacaoDeHoje(c: Consulta, militarId: string, hoje: string): Promise<string | null> {
  const { rows } = await c.query<{ unidade_id: string }>(
    'select unidade_id from rastreio where militar_id = $1 and desde <= $2::date and (ate is null or ate >= $2::date) limit 1',
    [militarId, hoje],
  );
  return rows[0]?.unidade_id ?? null;
}

/** Os blocos que a pessoa vê de um militar, pela lotação de hoje dele. */
export async function blocosDoMilitar(c: Consulta, usuarioId: string, militarId: string, hoje: string): Promise<Set<Bloco>> {
  return blocosDaUnidade(c, usuarioId, await lotacaoDeHoje(c, militarId, hoje), hoje);
}
