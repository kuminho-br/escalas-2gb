import { describe, expect, it } from 'vitest';
import { montarArvore, type UnidadeDaArvore } from '@/lib/arvore-de-unidades';
import { degrausDoCaminho, proximoNivel } from '@/lib/degraus';

// A unidade em degraus (6.61, Task 2): as regras puras. Hierarquia fictícia: o caminho CBMPE / DGO / DInter/1 / 2º GB / 1ª SB é o do sistema; as vizinhas são inventadas.
const t = (id: string, sigla: string, maeId: string | null, tipoNome: string, nome?: string): UnidadeDaArvore => ({ id, sigla, maeId, tipoNome, ...(nome ? { nome } : {}) });
export const CORPORACAO: UnidadeDaArvore[] = [
  t('cbmpe', 'CBMPE', null, 'Corporação'),
  t('dgo', 'DGO', 'cbmpe', 'Diretoria'),
  t('dinter', 'DInter/1', 'dgo', 'Diretoria regional'),
  t('gb2', '2º GB', 'dinter', 'Grupamento', 'Segundo Grupamento'),
  t('sb1', '1ª SB', 'gb2', 'Seção', 'Caruaru'),
  t('sb2', '2ª SB', 'gb2', 'Seção'),
  t('sb3', '3ª SB', 'gb2', 'Seção'),
  t('gb4', '4º GB', 'dinter', 'Grupamento'),
  t('sb4a', '1ª SB', 'gb4', 'Seção'),
  t('sb4b', '2ª SB', 'gb4', 'Seção'),
];
const pessoa = (...ids: string[]) => CORPORACAO.filter((u) => ids.includes(u.id));

describe('degrausDoCaminho', () => {
  const arvore = montarArvore(pessoa('gb2', 'sb1', 'sb2', 'sb3', 'gb4'), CORPORACAO);

  it('um degrau por nível, do alto até a unidade, cada um com as opções de dentro do anterior', () => {
    const degraus = degrausDoCaminho(arvore, 'sb1');
    expect(degraus.map((d) => d.no.sigla)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(degraus.map((d) => d.opcoes.map((o) => o.sigla))).toEqual([['CBMPE'], ['DGO'], ['DInter/1'], ['2º GB', '4º GB'], ['1ª SB', '2ª SB', '3ª SB']]);
  });

  it('um nível de uma opção só não tem o que escolher (vira texto na tela)', () => {
    const degraus = degrausDoCaminho(arvore, 'sb1');
    expect(degraus.map((d) => d.opcoes.length > 1)).toEqual([false, false, false, true, true]);
  });

  it('só entram as unidades a que a pessoa tem acesso ou que levam a uma delas', () => {
    const soUma = montarArvore(pessoa('sb1'), CORPORACAO);
    const degraus = degrausDoCaminho(soUma, 'sb1');
    expect(degraus.at(-1)!.opcoes.map((o) => o.sigla)).toEqual(['1ª SB']);
  });

  it('a unidade que não está na árvore dá lista vazia', () => {
    expect(degrausDoCaminho(arvore, 'nao-existe')).toEqual([]);
  });

  it('sem a lista da corporação, a árvore começa na unidade mais alta da pessoa', () => {
    const sem = montarArvore(pessoa('gb2', 'sb1'), []);
    expect(degrausDoCaminho(sem, 'sb1').map((d) => d.no.sigla)).toEqual(['2º GB', '1ª SB']);
  });
});

describe('proximoNivel', () => {
  const arvore = montarArvore(pessoa('gb2', 'sb1', 'sb2', 'sb3', 'gb4'), CORPORACAO);
  const achar = (sigla: string) => {
    const procurar = (l: typeof arvore): (typeof arvore)[number] | undefined => l.flatMap((n) => [n, ...(procurar(n.filhos) ? [procurar(n.filhos)!] : [])]).find((n) => n.sigla === sigla);
    return procurar(arvore)!;
  };

  it('o rótulo sai do tipo (do cadastro) das unidades de baixo', () => {
    expect(proximoNivel(achar('2º GB'))).toEqual({ rotulo: 'Seção', obrigatorio: false });
  });

  it('a unidade sem nada embaixo não tem próximo nível', () => {
    expect(proximoNivel(achar('3ª SB'))).toBeNull();
  });

  it('a passagem (a unidade acima das da pessoa, que só serve para descer) dá escolha obrigatória', () => {
    const dgo = achar('DGO');
    expect(dgo.passagem).toBe(true);
    expect(proximoNivel(dgo)).toEqual({ rotulo: 'Diretoria regional', obrigatorio: true });
  });

  it('as de baixo de tipos diferentes viram "Unidade"; sem o tipo (a lista ainda não chegou), também', () => {
    const misto = montarArvore(
      [t('a', 'A', null, 'Grupamento'), t('b', 'B', 'a', 'Seção'), t('c', 'C', 'a', 'Divisão')],
      [],
    );
    expect(proximoNivel(misto[0]!)).toEqual({ rotulo: 'Unidade', obrigatorio: false });
    const semTipo = montarArvore([{ id: 'a', sigla: 'A', maeId: null }, { id: 'b', sigla: 'B', maeId: 'a' }], []);
    expect(proximoNivel(semTipo[0]!)).toEqual({ rotulo: 'Unidade', obrigatorio: false });
  });
});
