import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { abaixoDe, montarArvore, type UnidadeDaArvore } from '@/lib/arvore-de-unidades';

// Entrega 6.45: toda escolha de unidade é pela árvore, nó a nó. Dados fictícios: uma árvore de 5 níveis, com siglas repetidas ("DA" e "1ª SB" em dois grupamentos).
const u = (id: string, sigla: string, maeId: string | null): UnidadeDaArvore => ({ id, sigla, maeId });
const TODAS = [
  u('cbmpe', 'CBMPE', null),
  u('dgo', 'DGO', 'cbmpe'),
  u('di1', 'DInter/1', 'dgo'),
  u('gb1', '1º GB', 'di1'),
  u('gb2', '2º GB', 'di1'),
  u('da1', 'DA', 'gb1'),
  u('da2', 'DA', 'gb2'),
  u('divop', 'DivOp', 'gb2'),
  u('sb1-gb1', '1ª SB', 'gb1'),
  u('sb1', '1ª SB', 'divop'),
  u('sb2', '2ª SB', 'divop'),
  u('sb10', '10ª SB', 'divop'),
];
const siglas = (nos: { sigla: string }[]) => nos.map((n) => n.sigla);

describe('montar a árvore', () => {
  it('cada unidade fica debaixo da mãe, os irmãos pela sigla (2ª antes de 10ª), e a raiz no alto', () => {
    const [raiz, ...outras] = montarArvore(TODAS);
    expect(outras).toEqual([]);
    expect(raiz).toMatchObject({ sigla: 'CBMPE', nivel: 0, passagem: false, caminho: ['CBMPE'] });
    const gb2 = raiz!.filhos[0]!.filhos[0]!.filhos[1]!;
    expect(gb2).toMatchObject({ sigla: '2º GB', nivel: 3 });
    expect(siglas(gb2.filhos)).toEqual(['DA', 'DivOp']);
    expect(siglas(gb2.filhos[1]!.filhos)).toEqual(['1ª SB', '2ª SB', '10ª SB']);
    expect(gb2.filhos[1]!.filhos[0]!.caminho).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', 'DivOp', '1ª SB']);
  });

  it('Review Focus 2: a unidade permitida cuja mãe não é permitida fica debaixo da mãe, que vira passagem (não escolhível); nunca solta nem some', () => {
    const arvore = montarArvore([u('sb1', '1ª SB', 'divop')], TODAS);
    const linha: { sigla: string; passagem: boolean }[] = [];
    for (let no = arvore[0]; no; no = no.filhos[0]) linha.push({ sigla: no.sigla, passagem: no.passagem });
    expect(linha).toEqual([
      { sigla: 'CBMPE', passagem: true }, { sigla: 'DGO', passagem: true }, { sigla: 'DInter/1', passagem: true },
      { sigla: '2º GB', passagem: true }, { sigla: 'DivOp', passagem: true }, { sigla: '1ª SB', passagem: false },
    ]);
    // só o caminho até a permitida: as irmãs que a pessoa não alcança não aparecem
    expect(arvore[0]!.filhos[0]!.filhos[0]!.filhos).toHaveLength(1);
  });

  it('sem a árvore inteira (a lista das mães não chegou), a unidade sem mãe conhecida fica no alto: não some', () => {
    expect(siglas(montarArvore([u('sb1', '1ª SB', 'divop'), u('sb2', '2ª SB', 'divop')]))).toEqual(['1ª SB', '2ª SB']);
  });

  it('a unidade e as de baixo: o filtro por um nó pega a subárvore', () => {
    expect([...abaixoDe(TODAS, 'gb2')].sort()).toEqual(['da2', 'divop', 'gb2', 'sb1', 'sb10', 'sb2']);
    expect([...abaixoDe(TODAS, 'sb1')]).toEqual(['sb1']);
  });
});

function Caixa({ unidades = TODAS, todas, inicial = '', permiteLimpar = false }: { unidades?: UnidadeDaArvore[]; todas?: UnidadeDaArvore[]; inicial?: string; permiteLimpar?: boolean }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="un">Unidade</label>
      <EscolherUnidade id="un" rotulo="Unidade" unidades={unidades} todas={todas} valor={valor} aoEscolher={setValor} permiteLimpar={permiteLimpar} textoVazio="Todas" />
      <output data-testid="valor">{valor}</output>
    </>
  );
}
const abrirCaixa = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Unidade' }));
  return screen.findByRole('tree', { name: 'Unidade' });
};
const itens = (arvore: HTMLElement) => within(arvore).getAllByRole('treeitem').map((i) => i.getAttribute('aria-label'));

describe('EscolherUnidade', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('abre nó a nó: de início só a raiz e o primeiro nível; a seta abre os filhos de um nó por vez', async () => {
    render(<Caixa />);
    const arvore = await abrirCaixa();
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE']);
    await userEvent.click(within(arvore).getByRole('button', { name: 'Abrir DGO' }));
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE', 'DInter/1, em DGO']);
    expect(within(arvore).getByRole('treeitem', { name: 'DGO, em CBMPE' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(within(arvore).getByRole('button', { name: 'Fechar DGO' }));
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE']);
  });

  it('o caminho da escolhida já vem aberto, e ela vem marcada; o botão mostra a sigla com a unidade de cima', async () => {
    render(<Caixa inicial="sb2" />);
    expect(screen.getByRole('combobox', { name: 'Unidade' })).toHaveTextContent('DivOp / 2ª SB');
    const arvore = await abrirCaixa();
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE', 'DInter/1, em DGO', '1º GB, em DInter/1', '2º GB, em DInter/1', 'DA, em 2º GB', 'DivOp, em 2º GB', '1ª SB, em DivOp', '2ª SB, em DivOp', '10ª SB, em DivOp']);
    expect(within(arvore).getByRole('treeitem', { name: '2ª SB, em DivOp' })).toHaveAttribute('aria-selected', 'true');
  });

  it('escolher um nó fecha a caixa e devolve o id', async () => {
    render(<Caixa inicial="sb2" />);
    const arvore = await abrirCaixa();
    await userEvent.click(within(arvore).getByText('10ª SB'));
    expect(screen.getByTestId('valor')).toHaveTextContent('sb10');
    expect(screen.queryByRole('tree')).toBeNull();
  });

  it('"Abrir tudo" abre todos os níveis e vira "Fechar tudo"; a escolha fica lembrada para a próxima vez', async () => {
    render(<Caixa />);
    let arvore = await abrirCaixa();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tudo' }));
    expect(within(arvore).getAllByRole('treeitem')).toHaveLength(TODAS.length);
    expect(screen.queryByRole('button', { name: 'Abrir tudo' })).toBeNull();
    expect(localStorage.getItem('arvore:aberta-toda')).toBe('1');
    cleanup();
    render(<Caixa />);
    arvore = await abrirCaixa();
    expect(within(arvore).getAllByRole('treeitem')).toHaveLength(TODAS.length);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar tudo' }));
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE']);
    expect(localStorage.getItem('arvore:aberta-toda')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir tudo' })).toBeInTheDocument();
  });

  it('se o navegador recusa guardar (localStorage lança erro), "Abrir tudo" funciona do mesmo jeito', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    render(<Caixa />);
    const arvore = await abrirCaixa();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tudo' }));
    expect(within(arvore).getAllByRole('treeitem')).toHaveLength(TODAS.length);
  });

  it('a busca por sigla aparece nas árvores grandes (mais de 15), filtra sem acento nem maiúscula e mostra o caminho de cada achada', async () => {
    const grande = [...TODAS, ...['3ª', '4ª', '5ª', '6ª', '7ª'].map((n, i) => u(`sbx${i}`, `${n} SB`, 'divop'))];
    render(<Caixa unidades={grande} />);
    const arvore = await abrirCaixa();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar unidade' }), 'da');
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE', 'DInter/1, em DGO', '1º GB, em DInter/1', 'DA, em 1º GB', '2º GB, em DInter/1', 'DA, em 2º GB']);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar unidade' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar unidade' }), 'zzz');
    expect(screen.queryAllByRole('treeitem')).toEqual([]);
    expect(screen.getByText('Nenhuma unidade com essa sigla.')).toBeInTheDocument();
  });

  it('a árvore pequena não tem busca', async () => {
    render(<Caixa />);
    await abrirCaixa();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('teclado: as setas andam entre os nós visíveis, a direita abre, a esquerda fecha ou sobe à mãe, e o Enter escolhe', async () => {
    render(<Caixa />);
    const arvore = await abrirCaixa();
    const focado = () => document.activeElement?.getAttribute('aria-label');
    within(arvore).getByRole('treeitem', { name: 'CBMPE' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(focado()).toBe('DGO, em CBMPE');
    await userEvent.keyboard('{ArrowRight}');
    expect(itens(arvore)).toContain('DInter/1, em DGO');
    await userEvent.keyboard('{ArrowRight}');
    expect(focado()).toBe('DInter/1, em DGO');
    await userEvent.keyboard('{ArrowLeft}');
    expect(focado()).toBe('DGO, em CBMPE');
    await userEvent.keyboard('{ArrowLeft}');
    expect(itens(arvore)).not.toContain('DInter/1, em DGO');
    await userEvent.keyboard('{ArrowUp}');
    expect(focado()).toBe('CBMPE');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('dgo');
  });

  it('Review Focus 2: a passagem aparece apagada e não é escolhível (nem com o clique, nem com o Enter); a filha permitida é', async () => {
    render(<Caixa unidades={[u('sb1', '1ª SB', 'divop'), u('sb2', '2ª SB', 'divop')]} todas={TODAS} />);
    const arvore = await abrirCaixa();
    // as passagens já vêm abertas: o que a pessoa pode escolher fica à vista
    expect(itens(arvore)).toEqual(['CBMPE', 'DGO, em CBMPE', 'DInter/1, em DGO', '2º GB, em DInter/1', 'DivOp, em 2º GB', '1ª SB, em DivOp', '2ª SB, em DivOp']);
    const divop = within(arvore).getByRole('treeitem', { name: 'DivOp, em 2º GB' });
    expect(divop).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(within(divop).getByText('DivOp'));
    divop.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('');
    expect(screen.getByRole('tree')).toBeInTheDocument();
    await userEvent.click(within(arvore).getByText('2ª SB'));
    expect(screen.getByTestId('valor')).toHaveTextContent('sb2');
  });

  it('se a árvore da corporação chega com a caixa já aberta (rede lenta), as passagens novas vêm abertas: o que é escolhível continua à vista', async () => {
    const permitidas = [u('sb1', '1ª SB', 'divop'), u('sb2', '2ª SB', 'divop')];
    const { rerender } = render(<Caixa unidades={permitidas} />);
    const arvore = await abrirCaixa();
    expect(itens(arvore)).toEqual(['1ª SB', '2ª SB']);
    rerender(<Caixa unidades={permitidas} todas={TODAS} />);
    expect(itens(screen.getByRole('tree', { name: 'Unidade' }))).toEqual(['CBMPE', 'DGO, em CBMPE', 'DInter/1, em DGO', '2º GB, em DInter/1', 'DivOp, em 2º GB', '1ª SB, em DivOp', '2ª SB, em DivOp']);
  });

  it('sem nenhuma unidade (a lista ainda não chegou, ou falhou), a caixa diz que não há o que escolher, em vez de abrir vazia', async () => {
    render(<Caixa unidades={[]} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Unidade' }));
    expect(await screen.findByText('Nenhuma unidade para escolher.')).toBeInTheDocument();
  });

  it('o campo diz ao leitor de tela que abre uma caixa, e a caixa tem o nome do campo', async () => {
    render(<Caixa />);
    expect(screen.getByRole('combobox', { name: 'Unidade' })).toHaveAttribute('aria-haspopup', 'dialog');
    await abrirCaixa();
    expect(screen.getByRole('dialog', { name: 'Unidade' })).toBeInTheDocument();
  });

  it('Review Focus 1: a sigla repetida fica cada uma no seu lugar, sem sufixo, e o nome para o leitor de tela diz a unidade de cima', async () => {
    render(<Caixa inicial="da1" />);
    expect(screen.getByRole('combobox', { name: 'Unidade' })).toHaveTextContent('1º GB / DA');
    const arvore = await abrirCaixa();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tudo' }));
    expect(within(arvore).getByRole('treeitem', { name: 'DA, em 1º GB' })).toHaveAttribute('aria-selected', 'true');
    expect(within(arvore).getByRole('treeitem', { name: 'DA, em 2º GB' })).toHaveAttribute('aria-selected', 'false');
    expect(within(arvore).queryByText(/\(/)).toBeNull();
  });

  it('com "Limpar", o filtro volta ao estado sem unidade; sem unidade escolhida o botão diz o texto vazio e não há o que limpar', async () => {
    render(<Caixa inicial="gb2" permiteLimpar />);
    await abrirCaixa();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByTestId('valor')).toHaveTextContent('');
    expect(screen.getByRole('combobox', { name: 'Unidade' })).toHaveTextContent('Todas');
    await abrirCaixa();
    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull();
  });
});
