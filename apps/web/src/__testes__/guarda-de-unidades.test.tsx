import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Entrega 6.45: a guarda das listas de unidades. Toda escolha de unidade é pela árvore (`EscolherUnidade`), nó a nó: nenhum `<option>` do site pode ser
// alimentado por uma lista de unidades. A árvore vai crescer, e a lista plana não diz de qual grupamento é cada "DA" ou "1ª SB".
const RAIZ = join(__dirname, '..');
// os `<option>` que parecem de unidade e não são, cada um com o porquê
const EXCECOES: Record<string, string> = {
  'componentes/PainelComMenu.tsx': 'as "seções" são as partes de um painel (o menu do celular), não unidades',
};
// quem lê a lista de unidades só para escrever o nome (a unidade de cada serviço), sem escolher unidade nenhuma
const SO_LE_O_NOME: Record<string, string> = {
  'routes/_app/minha-escala.tsx': 'a Minha escala escreve a unidade de cada serviço com o nome completo (6.53); não tem escolha de unidade',
};

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n);
    if (statSync(p).isDirectory()) return n === '__testes__' ? [] : arquivos(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}

/** Um `<option>` montado a partir de uma coleção de unidades (unidades, seções, lotações, raízes). */
const OPCAO_DE_UNIDADE = /\b(unidades\w*|secoes\w*|lotacoes|raizes)\b[^\n]*\.map\([^\n]*<option|<option[^\n]*\b(unidades\w*|secoes\w*|lotacoes|raizes)\b[^\n]*\.map\(/i;

describe('a guarda das listas de unidades (6.45)', () => {
  it('nenhuma tela monta <option> com uma lista de unidades: a escolha é pela árvore', () => {
    const achados: string[] = [];
    for (const arquivo of arquivos(RAIZ)) {
      const rel = relative(RAIZ, arquivo).split(sep).join('/');
      if (rel in EXCECOES) continue;
      readFileSync(arquivo, 'utf8').split('\n').forEach((linha, i) => {
        if (OPCAO_DE_UNIDADE.test(linha)) achados.push(`${rel}:${i + 1}: ${linha.trim().slice(0, 120)}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it('as consultas de unidades só alimentam a árvore: quem as usa não tem <select> de unidade', () => {
    // os cinco lugares de lista plana (e o seletor da Estrutura) usam o EscolherUnidade; o Topo, os degraus (6.61)
    const usam = arquivos(RAIZ).filter((a) => /consultaUnidadesDeLotacao|unidadesParaPapel|consultaUnidadesDaBusca|raizesDaEstrutura/.test(readFileSync(a, 'utf8'))).map((a) => relative(RAIZ, a).split(sep).join('/'));
    const semArvore = usam.filter((rel) => !/EscolherUnidade|PainelDaArvore|DegrausDaUnidade/.test(readFileSync(join(RAIZ, rel), 'utf8')) && rel !== 'routes/_app/estrutura.tsx' && !(rel in SO_LE_O_NOME));
    expect(semArvore).toEqual([]);
  });

  it('a regra da guarda acusa a lista plana de antes (prova de que ela enxerga)', () => {
    expect(OPCAO_DE_UNIDADE.test("{secoes.data?.map((s) => <option key={s.id} value={s.id}>{s.sigla}</option>)}")).toBe(true);
    expect(OPCAO_DE_UNIDADE.test("{unidades.map((u) => <option key={u.id} value={u.id}>{u.sigla}</option>)}")).toBe(true);
    expect(OPCAO_DE_UNIDADE.test("{postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}")).toBe(false);
  });
});
