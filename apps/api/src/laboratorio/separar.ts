// A separação dos dados de teste (6.58): marca, lista e tira do banco REAL os militares fictícios e tudo o que depende deles.
// O que é de teste é dito pela marca `militar.de_teste`, NUNCA pela matrícula: 990xxx-x é matrícula de militar real (decisão do usuário, 26/11/2026).
// O que sai junto vem do catálogo do banco (as chaves estrangeiras), pelo mesmo caminho do "apagar militar" do sistema: a tabela nova que nascer amanhã
// já entra. O espelho (schema `laboratorio`) não é tocado: ele recebe a carga fictícia por `cargaDoEspelho`, nunca uma cópia do real.
import type { Banco, Consulta } from '../banco/banco.ts';
import { contagemParaVarios, referenciasQueViramVazias } from '../cadastros/apagar-militar.ts';
import { MILITARES_DA_CARGA } from '../carga/exemplo.ts';
import { hojeRecife } from '../datas.ts';
import { PERFIS_DE_TESTE } from './espelho.ts';

/** Quem pode ser marcado: matrícula e nome de guerra, juntos, de um da carga de exemplo ou dos cinco perfis de teste. A lista vem do código da carga. */
const DA_CARGA = [...MILITARES_DA_CARGA, ...PERFIS_DE_TESTE.map((p) => ({ matricula: p.matricula, nomeGuerra: p.guerra }))];

export interface RegistrosDeTeste {
  tabela: string;
  quantidade: number;
}

export interface Candidato {
  id: string;
  matricula: string;
}

export interface Suspeito extends Candidato {
  motivo: string;
}

/** Os militares marcados como teste no real, em ordem. */
async function militaresMarcados(c: Consulta): Promise<Candidato[]> {
  return (await c.query<Candidato>('select id, matricula from public.militar where de_teste order by matricula')).rows;
}

/**
 * Quem pode ser marcado no real, ainda sem a marca: só o militar cuja matrícula e nome batem, juntos, com uma linha da carga (ou dos cinco perfis).
 * É **seguro** se o primeiro registro da auditoria dele é a inclusão, já com a matrícula e o nome da carga (nasceu fictício). Qualquer outro caso é
 * **suspeito** (sem inclusão na auditoria, ou nasceu com outro nome e foi alterado para o da carga: pode ser militar real sobrescrito): o script nunca o marca.
 * Só lê.
 */
export async function candidatosDeTeste(c: Consulta): Promise<{ seguros: Candidato[]; suspeitos: Suspeito[] }> {
  const { rows } = await c.query<{ id: string; matricula: string; nome_guerra: string; acao: string | null; matricula_inicial: string | null; nome_inicial: string | null }>(
    `select m.id, m.matricula, m.nome_guerra, i.acao, i.matricula as matricula_inicial, i.nome as nome_inicial
       from public.militar m
       join unnest($1::text[], $2::text[]) as k(matricula, nome) on k.matricula = m.matricula and k.nome = m.nome_guerra
       left join lateral (
         select a.acao, a.depois ->> 'matricula' as matricula, a.depois ->> 'nome_guerra' as nome
           from public.auditoria a where a.tabela = 'militar' and a.registro_id = m.id::text order by a.id limit 1
       ) i on true
      where not m.de_teste
      order by m.matricula`,
    [DA_CARGA.map((m) => m.matricula), DA_CARGA.map((m) => m.nomeGuerra)],
  );
  const seguros: Candidato[] = [];
  const suspeitos: Suspeito[] = [];
  for (const r of rows) {
    const quem = { id: r.id, matricula: r.matricula };
    if (r.acao === 'insert' && r.matricula_inicial === r.matricula && r.nome_inicial === r.nome_guerra) seguros.push(quem);
    else if (r.acao === null) suspeitos.push({ ...quem, motivo: 'sem registro de inclusão na auditoria' });
    else if (r.acao !== 'insert') suspeitos.push({ ...quem, motivo: 'o primeiro registro da auditoria não é a inclusão' });
    else suspeitos.push({ ...quem, motivo: 'nasceu com outro nome ou outra matrícula e foi alterado para os da carga' });
  }
  return { seguros, suspeitos };
}

/**
 * Marca como teste os candidatos seguros, numa transação só. `esperados` é a quantidade que a lista mostrou (o `--marcar=N` do script): a transação
 * confere de novo e, se a lista mudou ou o número está errado, não marca nada. O suspeito nunca é marcado. Devolve quantos marcou.
 */
export async function marcarSeguros(banco: Banco, esperados: number): Promise<number> {
  return banco.transacao(async (tx) => {
    const { seguros } = await candidatosDeTeste(tx);
    if (seguros.length !== esperados) {
      throw new Error(`Confira a lista: são ${seguros.length} candidatos seguros, e não ${esperados}. Rode de novo com --marcar=${seguros.length}. Nada foi marcado.`);
    }
    if (!seguros.length) return 0;
    await tx.query('update public.militar set de_teste = true where id = any($1::uuid[]) and not de_teste', [seguros.map((s) => s.id)]);
    return seguros.length;
  });
}

/** As linhas que FICAM no real mas perdem a referência a um militar de teste (a coluna vira vazia). Só lê. */
export async function referenciasQueSoPerdemAutoria(c: Consulta): Promise<{ tabela: string; coluna: string; quantidade: number }[]> {
  return referenciasQueViramVazias(c, (await militaresMarcados(c)).map((m) => m.id));
}

/** Os níveis de acesso que as contas de teste têm (quantas contas por nível). */
async function contasDeTesteComNivel(c: Consulta): Promise<{ nivel: string; contas: number }[]> {
  const ids = (await militaresMarcados(c)).map((m) => m.id);
  const { rows } = await c.query<{ nivel: string; contas: number }>(
    `select p.papel as nivel, count(distinct u.id)::int as contas
       from public.usuario u join public.papel_usuario p on p.usuario_id = u.id
      where u.militar_id = any($1) group by p.papel order by p.papel`,
    [ids],
  );
  return rows;
}

/** Quantos administradores com o nível vigente hoje NÃO são de teste, ou seja, ficam depois da limpeza. */
async function administradoresQueFicam(c: Consulta): Promise<number> {
  const ids = (await militaresMarcados(c)).map((m) => m.id);
  const { rows } = await c.query<{ n: number }>(
    `select count(distinct u.id)::int as n
       from public.usuario u join public.papel_usuario p on p.usuario_id = u.id
      where p.papel = 'administrador' and u.ativo and p.desde <= $1 and (p.ate is null or p.ate >= $1) and not (u.militar_id = any($2))`,
    [hojeRecife(), ids],
  );
  return rows[0]!.n;
}

/**
 * O que é de teste no `public`: os militares marcados e tudo o que depende deles (rastreio, afastamentos, alocações, voluntariado, vínculos de escala,
 * contas e níveis de acesso, e o que mais as chaves estrangeiras ligarem). Só lê. Na ordem da exclusão: o que depende vem antes do que é dependido.
 */
export async function listarRegistrosDeTeste(c: Consulta): Promise<RegistrosDeTeste[]> {
  const ids = (await militaresMarcados(c)).map((m) => m.id);
  const contagem = await contagemParaVarios(c, ids, false);
  return [...contagem].filter(([, q]) => q > 0).map(([tabela, quantidade]) => ({ tabela, quantidade }));
}

/**
 * Tira do `public`, numa transação só, os militares marcados como teste e o que depende deles, filhos primeiro. Se uma exclusão falha, nada fica pela metade.
 * Não apaga da `auditoria` (ela é só de acréscimo): as linhas dela que citam os removidos ficam, e só carregam dados fictícios; as exclusões acrescentam as suas.
 */
export async function removerRegistrosDeTeste(banco: Banco, militaresEsperados?: number): Promise<{ tabela: string; removidos: number }[]> {
  return banco.transacao(async (tx) => {
    const ids = (await militaresMarcados(tx)).map((m) => m.id);
    // a lista conferida pode ter mudado desde que foi mostrada: nada é apagado se a quantidade de militares não é a que foi conferida
    if (militaresEsperados !== undefined && ids.length !== militaresEsperados) {
      throw new Error(`A lista mudou: agora são ${ids.length} militares marcados como teste, e não ${militaresEsperados}. Nada foi apagado; rode de novo para ver a lista.`);
    }
    const contagem = await contagemParaVarios(tx, ids, true);
    return [...contagem].filter(([, q]) => q > 0).map(([tabela, removidos]) => ({ tabela, removidos }));
  });
}

/** As linhas da auditoria que citam os militares marcados (ficam depois da limpeza). */
async function auditoriaDeTeste(c: Consulta, ids: string[]): Promise<number> {
  const { rows } = await c.query<{ n: number }>(
    `select count(*)::int as n from public.auditoria
      where (tabela = 'militar' and registro_id = any($1::text[])) or coalesce(depois, antes) ->> 'militar_id' = any($1::text[])`,
    [ids],
  );
  return rows[0]!.n;
}

export type Passo = 'listar' | 'marcar' | 'aplicar';

/** Os argumentos do script: nenhum lista; `--marcar=N` marca os seguros; `--aplicar=N` tira os marcados. Um passo por vez. */
export function passoDoScript(args: string[]): { passo: Passo; confirmar: number | undefined } {
  const pega = (nome: string) => args.find((a) => a === `--${nome}` || a.startsWith(`--${nome}=`));
  const marcar = pega('marcar');
  const aplicar = pega('aplicar');
  if (marcar && aplicar) throw new Error('--marcar e --aplicar são passos separados: um passo por vez. Rode primeiro --marcar=N, confira, e só depois --aplicar=N.');
  const arg = marcar ?? aplicar;
  const texto = arg?.split('=')[1];
  return { passo: marcar ? 'marcar' : aplicar ? 'aplicar' : 'listar', confirmar: texto !== undefined && /^\d+$/.test(texto) ? Number(texto) : undefined };
}

export interface ResultadoDaSeparacao {
  passo: Passo;
  /** as matrículas dos candidatos seguros (ainda sem a marca) */
  seguros: string[];
  suspeitos: { matricula: string; motivo: string }[];
  /** quantos militares estão marcados como teste (antes do passo; no `marcar`, depois dele ficam estes mais os recém-marcados) */
  marcados: number;
  registros: RegistrosDeTeste[];
  auditoriaQueFica: number;
  /** no passo `marcar`, quantos foram marcados agora */
  marcadosAgora: number | null;
  /** quantos militares marcados restam no real depois de aplicar (a conferência; deve ser 0) */
  restantes: number | null;
}

/**
 * O que o script faz, em três passos, cada um com conferência de quantidade. Imprime só tabela, contagem e matrículas (nunca nome nem e-mail):
 * - `listar` (o padrão): os candidatos seguros, os suspeitos com o motivo, os já marcados e o que depende deles. Nada é alterado.
 * - `marcar` (`--marcar=N`, N = quantidade de seguros da lista): marca os seguros como teste.
 * - `aplicar` (`--aplicar=N`, N = quantidade de marcados): tira os marcados e o que depende deles; confere que não restou nenhum marcado.
 * Recusa o `aplicar` que deixaria o sistema sem nenhum administrador.
 */
export async function separarTeste(
  banco: Banco,
  opcoes: { passo?: Passo; confirmar?: number; escrever: (linha: string) => void },
): Promise<ResultadoDaSeparacao> {
  const { escrever } = opcoes;
  const passo = opcoes.passo ?? 'listar';
  const { seguros, suspeitos } = await candidatosDeTeste(banco);
  const marcados = await militaresMarcados(banco);
  const registros = await listarRegistrosDeTeste(banco);
  const auditoriaQueFica = await auditoriaDeTeste(banco, marcados.map((m) => m.id));
  const base = {
    passo,
    seguros: seguros.map((s) => s.matricula),
    suspeitos: suspeitos.map((s) => ({ matricula: s.matricula, motivo: s.motivo })),
    marcados: marcados.length,
    registros,
    auditoriaQueFica,
    marcadosAgora: null,
  };
  if (!seguros.length && !suspeitos.length && !marcados.length) {
    escrever('Nada de teste no banco real.');
    return { ...base, restantes: passo === 'aplicar' ? 0 : null };
  }
  if (seguros.length || suspeitos.length) {
    escrever('Candidatos a teste no banco real (matrícula e nome iguais aos da carga de exemplo, ainda sem a marca):');
    escrever(`  seguros (a auditoria mostra que nasceram com o nome da carga): ${seguros.length}`);
    if (seguros.length) escrever(`    matrículas: ${seguros.map((s) => s.matricula).join(', ')}`);
    escrever(`  suspeitos (o script nunca marca; confira à mão): ${suspeitos.length}`);
    for (const s of suspeitos) escrever(`    ${s.matricula}: ${s.motivo}`);
  }
  escrever(`${marcados.length} militares marcados como teste no banco real${marcados.length ? ':' : '.'}`);
  for (const r of registros) escrever(`  ${r.tabela}: ${r.quantidade}`);
  const contas = await contasDeTesteComNivel(banco);
  if (marcados.length) {
    escrever(`Contas de teste com nível de acesso: ${contas.length ? contas.map((c) => `${c.nivel}: ${c.contas}`).join(', ') : 'nenhuma'}`);
    const anuladas = await referenciasQueSoPerdemAutoria(banco);
    if (anuladas.length) {
      escrever('Linhas que ficam no banco real e só perdem a autoria (a coluna fica vazia):');
      for (const a of anuladas) escrever(`  ${a.tabela}.${a.coluna}: ${a.quantidade}`);
    }
    escrever(`Linhas da auditoria que citam esses militares (ficam, a auditoria só recebe acréscimos): ${auditoriaQueFica}`);
  }

  if (passo === 'listar') {
    escrever('Nada foi alterado.');
    if (seguros.length) escrever(`Para marcar os ${seguros.length} candidatos seguros como teste, confira a lista e rode com --marcar=${seguros.length}.`);
    if (marcados.length) escrever(`Para tirar os ${marcados.length} militares marcados do banco real, rode com --aplicar=${marcados.length}.`);
    return { ...base, restantes: null };
  }

  if (passo === 'marcar') {
    if (opcoes.confirmar !== seguros.length) {
      throw new Error(`Confira a lista acima e rode de novo com --marcar=${seguros.length} (a quantidade de candidatos seguros da lista). Nada foi marcado.`);
    }
    const marcadosAgora = await marcarSeguros(banco, opcoes.confirmar);
    escrever(`Marcados como teste agora: ${marcadosAgora}. Para tirar do banco real, rode sem argumentos e depois com --aplicar=N.`);
    return { ...base, marcadosAgora, restantes: null };
  }

  if (opcoes.confirmar !== marcados.length) {
    throw new Error(`Confira a lista acima e rode de novo com --aplicar=${marcados.length} (a quantidade de militares marcados da lista). Nada foi apagado.`);
  }
  if (contas.some((c) => c.nivel === 'administrador') && (await administradoresQueFicam(banco)) === 0) {
    throw new Error('A limpeza deixaria o sistema sem nenhum administrador (as contas de teste com esse nível sairiam). Crie antes uma conta de administrador de verdade e rode de novo. Nada foi apagado.');
  }
  const removidos = await removerRegistrosDeTeste(banco, opcoes.confirmar);
  escrever('Removidos:');
  for (const r of removidos) escrever(`  ${r.tabela}: ${r.removidos}`);
  const restantes = (await banco.query<{ n: number }>('select count(*)::int as n from public.militar where de_teste')).rows[0]!.n;
  escrever(`Conferência: militares marcados como teste no banco real: ${restantes}`);
  return { ...base, restantes };
}
