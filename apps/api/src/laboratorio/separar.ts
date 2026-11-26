// A separação dos dados de teste (6.58): lista e tira do banco REAL os militares fictícios (matrícula 990…) e tudo o que depende deles.
// O que sai junto vem do catálogo do banco (as chaves estrangeiras), pelo mesmo caminho do "apagar militar" do sistema: a tabela nova que nascer amanhã
// já entra. O espelho (schema `laboratorio`) não é tocado: ele recebe a carga fictícia por `cargaDoEspelho`, nunca uma cópia do real.
import type { Banco, Consulta } from '../banco/banco.ts';
import { contagemParaVarios, referenciasQueViramVazias } from '../cadastros/apagar-militar.ts';
import { hojeRecife } from '../datas.ts';

/** A matrícula de teste: `990xxx-x` (convenção do repositório: matrícula real nunca é assim; o banco só aceita o formato dddddd-d). */
const MATRICULA_DE_TESTE = '990%';

export interface RegistrosDeTeste {
  tabela: string;
  quantidade: number;
}

/** Os militares de teste do real, pela matrícula, em ordem. */
async function militaresDeTeste(c: Consulta): Promise<{ id: string; matricula: string }[]> {
  const { rows } = await c.query<{ id: string; matricula: string }>('select id, matricula from public.militar where matricula like $1 order by matricula', [
    MATRICULA_DE_TESTE,
  ]);
  return rows;
}

/** As linhas que FICAM no real mas perdem a referência a um militar de teste (a coluna vira vazia). Só lê. */
export async function referenciasQueSoPerdemAutoria(c: Consulta): Promise<{ tabela: string; coluna: string; quantidade: number }[]> {
  return referenciasQueViramVazias(c, (await militaresDeTeste(c)).map((m) => m.id));
}

/** Os níveis de acesso que as contas de teste têm (quantas contas por nível). */
async function contasDeTesteComNivel(c: Consulta): Promise<{ nivel: string; contas: number }[]> {
  const ids = (await militaresDeTeste(c)).map((m) => m.id);
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
  const ids = (await militaresDeTeste(c)).map((m) => m.id);
  const { rows } = await c.query<{ n: number }>(
    `select count(distinct u.id)::int as n
       from public.usuario u join public.papel_usuario p on p.usuario_id = u.id
      where p.papel = 'administrador' and u.ativo and p.desde <= $1 and (p.ate is null or p.ate >= $1) and not (u.militar_id = any($2))`,
    [hojeRecife(), ids],
  );
  return rows[0]!.n;
}

/**
 * O que é de teste no `public`: os militares 990… e tudo o que depende deles (rastreio, afastamentos, alocações, voluntariado, vínculos de escala,
 * contas e níveis de acesso, e o que mais as chaves estrangeiras ligarem). Só lê. Na ordem da exclusão: o que depende vem antes do que é dependido.
 */
export async function listarRegistrosDeTeste(c: Consulta): Promise<RegistrosDeTeste[]> {
  const ids = (await militaresDeTeste(c)).map((m) => m.id);
  const contagem = await contagemParaVarios(c, ids, false);
  return [...contagem].filter(([, q]) => q > 0).map(([tabela, quantidade]) => ({ tabela, quantidade }));
}

/**
 * Tira do `public`, numa transação só, os militares de teste e o que depende deles, filhos primeiro. Se uma exclusão falha, nada fica pela metade.
 * Não apaga da `auditoria` (ela é só de acréscimo): as linhas dela que citam os removidos ficam, e só carregam dados fictícios; as exclusões acrescentam as suas.
 */
export async function removerRegistrosDeTeste(banco: Banco, militaresEsperados?: number): Promise<{ tabela: string; removidos: number }[]> {
  return banco.transacao(async (tx) => {
    const ids = (await militaresDeTeste(tx)).map((m) => m.id);
    // a lista conferida pode ter mudado desde que foi mostrada: nada é apagado se a quantidade de militares não é a que foi conferida
    if (militaresEsperados !== undefined && ids.length !== militaresEsperados) {
      throw new Error(`A lista mudou: agora são ${ids.length} militares de teste, e não ${militaresEsperados}. Nada foi apagado; rode de novo para ver a lista.`);
    }
    const contagem = await contagemParaVarios(tx, ids, true);
    return [...contagem].filter(([, q]) => q > 0).map(([tabela, removidos]) => ({ tabela, removidos }));
  });
}

/** As linhas da auditoria que citam os militares de teste (ficam depois da limpeza). */
async function auditoriaDeTeste(c: Consulta): Promise<number> {
  const { rows } = await c.query<{ n: number }>(
    `select count(*)::int as n from public.auditoria
      where coalesce(depois, antes) ->> 'matricula' like $1
         or coalesce(depois, antes) ->> 'militar_id' in (select id::text from public.militar where matricula like $1)`,
    [MATRICULA_DE_TESTE],
  );
  return rows[0]!.n;
}

export interface ResultadoDaSeparacao {
  aplicado: boolean;
  matriculas: string[];
  registros: RegistrosDeTeste[];
  auditoriaQueFica: number;
  /** quantas matrículas 990… restam no real depois de aplicar (a conferência; deve ser 0) */
  restantes: number | null;
}

/**
 * O que o script faz: imprime a lista (só tabela, contagem e as matrículas fictícias, nunca nome nem dado pessoal) e, com `aplicar`, tira e confere.
 * Sem `aplicar` nada é apagado. Para aplicar é preciso dizer a quantidade de militares da lista (`confirmarMilitares`, o `--aplicar=N` do script):
 * quem aplica confere a lista, e a lista que mudou no meio não é apagada. Recusa deixar o sistema sem nenhum administrador.
 */
export async function separarTeste(
  banco: Banco,
  opcoes: { aplicar: boolean; confirmarMilitares?: number; escrever: (linha: string) => void },
): Promise<ResultadoDaSeparacao> {
  const { aplicar, escrever } = opcoes;
  const matriculas = (await militaresDeTeste(banco)).map((m) => m.matricula);
  const registros = await listarRegistrosDeTeste(banco);
  const auditoriaQueFica = await auditoriaDeTeste(banco);
  if (!registros.length) {
    escrever('Nada de teste no banco real.');
    return { aplicado: aplicar, matriculas, registros, auditoriaQueFica, restantes: aplicar ? 0 : null };
  }
  escrever(`Registros de teste no banco real (${matriculas.length} militares com matrícula 990xxx-x):`);
  for (const r of registros) escrever(`  ${r.tabela}: ${r.quantidade}`);
  escrever(`Matrículas: ${matriculas.join(', ')}`);
  const contas = await contasDeTesteComNivel(banco);
  escrever(`Contas de teste com nível de acesso: ${contas.length ? contas.map((c) => `${c.nivel}: ${c.contas}`).join(', ') : 'nenhuma'}`);
  const anuladas = await referenciasQueSoPerdemAutoria(banco);
  if (anuladas.length) {
    escrever('Linhas que ficam no banco real e só perdem a autoria (a coluna fica vazia):');
    for (const a of anuladas) escrever(`  ${a.tabela}.${a.coluna}: ${a.quantidade}`);
  }
  escrever(`Linhas da auditoria que citam esses militares (ficam, a auditoria só recebe acréscimos): ${auditoriaQueFica}`);
  if (!aplicar) {
    escrever(`Nada foi apagado. Para tirar do banco real, confira a lista e rode de novo com --aplicar=${matriculas.length}.`);
    return { aplicado: false, matriculas, registros, auditoriaQueFica, restantes: null };
  }
  if (opcoes.confirmarMilitares !== matriculas.length) {
    throw new Error(`Confira a lista acima e rode de novo com --aplicar=${matriculas.length} (a quantidade de militares da lista). Nada foi apagado.`);
  }
  if (contas.some((c) => c.nivel === 'administrador') && (await administradoresQueFicam(banco)) === 0) {
    throw new Error('A limpeza deixaria o sistema sem nenhum administrador (as contas de teste com esse nível sairiam). Crie antes uma conta de administrador de verdade e rode de novo. Nada foi apagado.');
  }
  const removidos = await removerRegistrosDeTeste(banco, opcoes.confirmarMilitares);
  escrever('Removidos:');
  for (const r of removidos) escrever(`  ${r.tabela}: ${r.removidos}`);
  const restantes = (await banco.query<{ n: number }>('select count(*)::int as n from public.militar where matricula like $1', [MATRICULA_DE_TESTE])).rows[0]!.n;
  escrever(`Conferência: matrículas 990… no banco real: ${restantes}`);
  return { aplicado: true, matriculas, registros, auditoriaQueFica, restantes };
}
