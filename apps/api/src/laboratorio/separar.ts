// A separação dos dados de teste (6.58): lista e tira do banco REAL os militares fictícios (matrícula 990…) e tudo o que depende deles.
// O que sai junto vem do catálogo do banco (as chaves estrangeiras), pelo mesmo caminho do "apagar militar" do sistema: a tabela nova que nascer amanhã
// já entra. O espelho (schema `laboratorio`) não é tocado: ele recebe a carga fictícia por `cargaDoEspelho`, nunca uma cópia do real.
import type { Banco, Consulta } from '../banco/banco.ts';
import { contagemParaVarios } from '../cadastros/apagar-militar.ts';

/** A matrícula de teste: `990` e o resto (`990xxx-x`). Matrícula real nunca começa assim (convenção do repositório). */
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
export async function removerRegistrosDeTeste(banco: Banco): Promise<{ tabela: string; removidos: number }[]> {
  return banco.transacao(async (tx) => {
    const ids = (await militaresDeTeste(tx)).map((m) => m.id);
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
 * Sem `aplicar` nada é apagado.
 */
export async function separarTeste(banco: Banco, opcoes: { aplicar: boolean; escrever: (linha: string) => void }): Promise<ResultadoDaSeparacao> {
  const { aplicar, escrever } = opcoes;
  const matriculas = (await militaresDeTeste(banco)).map((m) => m.matricula);
  const registros = await listarRegistrosDeTeste(banco);
  const auditoriaQueFica = await auditoriaDeTeste(banco);
  if (!registros.length) {
    escrever('Nada de teste no banco real.');
    return { aplicado: aplicar, matriculas, registros, auditoriaQueFica, restantes: aplicar ? 0 : null };
  }
  escrever(`Registros de teste no banco real (${matriculas.length} militares com matrícula 990…):`);
  for (const r of registros) escrever(`  ${r.tabela}: ${r.quantidade}`);
  escrever(`Matrículas: ${matriculas.join(', ')}`);
  escrever(`Linhas da auditoria que citam esses militares (ficam, a auditoria só recebe acréscimos): ${auditoriaQueFica}`);
  if (!aplicar) {
    escrever('Nada foi apagado. Para tirar do banco real, rode de novo com --aplicar, depois de conferir a lista.');
    return { aplicado: false, matriculas, registros, auditoriaQueFica, restantes: null };
  }
  const removidos = await removerRegistrosDeTeste(banco);
  escrever('Removidos:');
  for (const r of removidos) escrever(`  ${r.tabela}: ${r.removidos}`);
  const restantes = (await militaresDeTeste(banco)).length;
  escrever(`Conferência: matrículas 990… no banco real: ${restantes}`);
  return { aplicado: true, matriculas, registros, auditoriaQueFica, restantes };
}
