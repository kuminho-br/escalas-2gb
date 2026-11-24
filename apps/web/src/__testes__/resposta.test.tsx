import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProvedorDeResposta } from '@/componentes/resposta/ProvedorDeResposta';
import { Espera } from '@/componentes/resposta/Espera';
import { useAviso } from '@/componentes/resposta/useAviso';
import { useConfirmar } from '@/componentes/resposta/useConfirmar';
import { Vazio } from '@/componentes/resposta/Vazio';

// Entrega 6.21, Task 4: a resposta do sistema (docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md, "Resposta do sistema").
type Param = Parameters<ReturnType<typeof useAviso>>[0];

function Disparador({ aviso, aviso2 }: { aviso: Param; aviso2?: Param }) {
  const avisar = useAviso();
  return (
    <>
      <button type="button" onClick={() => avisar(aviso)}>avisar</button>
      {aviso2 && <button type="button" onClick={() => avisar(aviso2)}>avisar de novo</button>}
    </>
  );
}
const montar = (aviso: Param, aviso2?: Param) =>
  render(
    <ProvedorDeResposta>
      <Disparador aviso={aviso} aviso2={aviso2} />
    </ProvedorDeResposta>,
  );

describe('o aviso de resultado', () => {
  afterEach(() => vi.useRealTimers());

  it('aparece embaixo, no meio, com role="status", fundo tinta e texto branco', async () => {
    montar({ texto: 'Cota removida.' });
    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Cota removida.');
    expect(aviso).toHaveClass('fixed', 'bottom-4', 'left-1/2', '-translate-x-1/2', 'bg-tinta', 'text-white', 'rounded-controle', 'shadow-por-cima', 'min-h-11');
  });

  it('some em 4 s sem "Desfazer" e em 8 s com "Desfazer"', () => {
    vi.useFakeTimers();
    const { unmount } = montar({ texto: 'Feito.' });
    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3900));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    montar({ texto: 'Removido.', desfazer: async () => {} });
    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    act(() => void vi.advanceTimersByTime(7900));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('não some com o mouse em cima nem com o foco dentro; sai quando o mouse sai', () => {
    vi.useFakeTimers();
    montar({ texto: 'Removido.', desfazer: async () => {} });
    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    const aviso = screen.getByRole('status');
    fireEvent.mouseEnter(aviso);
    act(() => void vi.advanceTimersByTime(30000));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => void vi.advanceTimersByTime(8100));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    fireEvent.focusIn(screen.getByRole('status'));
    act(() => void vi.advanceTimersByTime(30000));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('o de erro espera a pessoa: fundo de superfície, borda de alerta, ícone, "Tentar de novo" e "Fechar"', async () => {
    const tentar = vi.fn();
    montar({ texto: 'Não deu para gravar.', erro: true, tentarDeNovo: tentar });
    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveClass('bg-superficie', 'border-alerta', 'text-tinta');
    expect(aviso.querySelector('svg')).not.toBeNull();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }));
    expect(tentar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('o de erro não some sozinho', () => {
    vi.useFakeTimers();
    montar({ texto: 'Não deu.', erro: true });
    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    act(() => void vi.advanceTimersByTime(60000));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Review Focus 3: duas ações seguidas: o segundo aviso substitui o primeiro, e o "Desfazer" do primeiro deixa de valer', async () => {
    const desfazerPrimeiro = vi.fn(async () => {});
    montar({ texto: 'Primeiro removido.', desfazer: desfazerPrimeiro }, { texto: 'Segundo gravado.' });
    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'avisar de novo' }));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Segundo gravado.');
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
    expect(desfazerPrimeiro).not.toHaveBeenCalled();
  });

  it('"Desfazer" desfaz e fecha o aviso; se o desfazer é recusado, mostra o motivo num aviso de erro (Review Focus 2)', async () => {
    const desfazer = vi.fn(async () => {});
    const { unmount } = montar({ texto: 'Removido.', desfazer });
    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(desfazer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    montar({ texto: 'Removido.', desfazer: async () => { throw new Error('A escala mudou desde então. Não dá mais para desfazer.'); } });
    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    const erro = await screen.findByText('A escala mudou desde então. Não dá mais para desfazer.');
    expect(erro.closest('[role="status"]')).toHaveClass('border-alerta');
  });
});

describe('a confirmação', () => {
  function Pergunta({ aoResponder, opcoes }: { aoResponder: (v: boolean) => void; opcoes?: Partial<Parameters<ReturnType<typeof useConfirmar>>[0]> }) {
    const confirmar = useConfirmar();
    return (
      <button type="button" onClick={() => void confirmar({ titulo: 'Remover a cota?', texto: 'Ela some da lista.', verbo: 'Remover', ...opcoes }).then(aoResponder)}>
        remover
      </button>
    );
  }
  const montarPergunta = (aoResponder: (v: boolean) => void, opcoes?: Partial<Parameters<ReturnType<typeof useConfirmar>>[0]>) =>
    render(
      <ProvedorDeResposta>
        <Pergunta aoResponder={aoResponder} opcoes={opcoes} />
      </ProvedorDeResposta>,
    );

  it('é um diálogo com o título, o texto, "Cancelar" (secundário) e o verbo (principal); o verbo confirma', async () => {
    const aoResponder = vi.fn();
    montarPergunta(aoResponder);
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Remover a cota?' });
    expect(dialogo).toHaveTextContent('Ela some da lista.');
    expect(dialogo).toHaveClass('sm:max-w-110');
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveAttribute('data-variant', 'secundario');
    const verbo = within(dialogo).getByRole('button', { name: 'Remover' });
    expect(verbo).toHaveAttribute('data-variant', 'principal');
    await userEvent.click(verbo);
    expect(aoResponder).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Cancelar" e Esc respondem não, e o foco volta ao botão que abriu a pergunta (Review Focus 4)', async () => {
    const aoResponder = vi.fn();
    montarPergunta(aoResponder);
    const botao = screen.getByRole('button', { name: 'remover' });
    await userEvent.click(botao);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(aoResponder).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(botao).toHaveFocus());
    await userEvent.click(botao);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(aoResponder).toHaveBeenCalledTimes(2);
    expect(aoResponder).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(botao).toHaveFocus());
  });

  it('perigosa: o verbo é o botão perigoso cheio, e "digitar" o deixa apagado até a pessoa digitar o que se pede', async () => {
    const aoResponder = vi.fn();
    montarPergunta(aoResponder, { titulo: 'Apagar o militar?', verbo: 'Apagar', perigoso: true, digitar: '990001-1' });
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Apagar o militar?' });
    const verbo = within(dialogo).getByRole('button', { name: 'Apagar' });
    expect(verbo).toHaveAttribute('data-variant', 'perigoso-cheio');
    expect(verbo).toBeDisabled();
    await userEvent.type(within(dialogo).getByLabelText(/Digite 990001-1/), '990001-1');
    expect(verbo).toBeEnabled();
    await userEvent.click(verbo);
    expect(aoResponder).toHaveBeenCalledWith(true);
  });
});

describe('a espera', () => {
  afterEach(() => vi.useRealTimers());

  it('Review Focus 5: só aparece depois de 200 ms, para a tela não piscar; "Carregando…" é só para leitor de tela', () => {
    vi.useFakeTimers();
    render(<Espera linhas={2} altura={120} />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => void vi.advanceTimersByTime(150));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => void vi.advanceTimersByTime(100));
    const espera = screen.getByRole('status');
    expect(espera).toHaveTextContent('Carregando…');
    expect(within(espera).getByText('Carregando…')).toHaveClass('sr-only');
    expect(espera.querySelectorAll('[data-bloco]')).toHaveLength(2);
    expect(espera.querySelector('[data-bloco]')).toHaveClass('rounded-controle');
  });

  it('ocupa o lugar e a altura do conteúdo desde o começo, para a tela não pular', () => {
    vi.useFakeTimers();
    const { container } = render(<Espera altura={120} />);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('120px');
    act(() => void vi.advanceTimersByTime(300));
    expect((screen.getByRole('status') as HTMLElement).style.minHeight).toBe('120px');
  });
});

describe('o vazio', () => {
  it('tem o título em 20 px, uma frase em apagado e o próximo passo num botão secundário', async () => {
    const aoClicar = vi.fn();
    render(<Vazio titulo="Nenhuma escala ativa" frase="Crie uma escala para montar o mês." acao={{ rotulo: 'Criar escala', aoClicar }} />);
    expect(screen.getByRole('heading', { name: 'Nenhuma escala ativa' })).toHaveClass('font-cond', 'text-bloco', 'font-semibold');
    expect(screen.getByText('Crie uma escala para montar o mês.')).toHaveClass('text-apagado');
    const botao = screen.getByRole('button', { name: 'Criar escala' });
    expect(botao).toHaveAttribute('data-variant', 'secundario');
    await userEvent.click(botao);
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('sem próximo passo, não tem botão', () => {
    render(<Vazio titulo="Sem feriados" frase="Nenhum feriado neste ano." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('a resposta do sistema no site inteiro', () => {
  const RAIZ = join(__dirname, '..');
  const arquivos = (p: string): string[] => readdirSync(p).flatMap((n) => {
    const c = join(p, n);
    if (statSync(c).isDirectory()) return n === '__testes__' ? [] : arquivos(c);
    return /\.tsx?$/.test(n) ? [c] : [];
  });
  // o aviso "Sair mesmo assim?" das alterações não salvas é da barra de salvar das fichas (D3), entrega N5 (a 6.21 deixa de fora)
  const EXCECOES = new Set(['componentes/AlteracoesPendentes.tsx']);

  it('nenhum window.confirm sobra no site (fora das alterações não salvas, que são da entrega das fichas)', () => {
    const usam = arquivos(RAIZ)
      .map((a) => relative(RAIZ, a).split(sep).join('/'))
      .filter((rel) => !EXCECOES.has(rel))
      .filter((rel) => /window\.confirm\(/.test(readFileSync(join(RAIZ, rel), 'utf8')));
    expect(usam).toEqual([]);
  });

  it('nenhuma tela escreve "Carregando…" à mão: a espera é a peça Espera', () => {
    const usam = arquivos(RAIZ)
      .map((a) => relative(RAIZ, a).split(sep).join('/'))
      .filter((rel) => rel !== 'componentes/resposta/Espera.tsx')
      .filter((rel) => /Carregando…/.test(readFileSync(join(RAIZ, rel), 'utf8')));
    expect(usam).toEqual([]);
  });
});
