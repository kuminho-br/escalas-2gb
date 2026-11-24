import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Moldura } from '@/componentes/Moldura';

// Entrega 6.20, Task 3: a moldura da tela (docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md, "Moldura da tela").
describe('Moldura', () => {
  it('o título é o único h1 da tela: 28 px estreita no computador e 20 px no celular, à esquerda', () => {
    render(<Moldura titulo="Cotas">conteúdo</Moldura>);
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Cotas');
    expect(titulos[0]).toHaveClass('font-cond', 'font-semibold', 'text-bloco', 'md:text-titulo');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('o mês (contexto) e a ação principal ficam à direita do título, no cabeçalho', () => {
    render(
      <Moldura titulo="Escala do mês" contexto={<span>mês aqui</span>} acaoPrincipal={<button type="button">Gerar pré-escala</button>}>
        x
      </Moldura>,
    );
    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByText('mês aqui')).toBeInTheDocument();
    expect(within(cabecalho).getByRole('button', { name: 'Gerar pré-escala' })).toBeInTheDocument();
    expect(cabecalho.firstElementChild).toContainElement(screen.getByRole('heading', { level: 1 }));
  });

  it('os filtros ficam numa faixa de superfície, com linha em cima e embaixo, 52 px de altura mínima e parada ao rolar; sem filtros, não há faixa', () => {
    const { rerender } = render(<Moldura titulo="Grade geral">x</Moldura>);
    expect(document.querySelector('[data-filtros]')).toBeNull();
    rerender(<Moldura titulo="Grade geral" filtros={<span>filtro</span>}>x</Moldura>);
    const faixa = document.querySelector('[data-filtros]') as HTMLElement;
    expect(faixa).toHaveClass('bg-superficie', 'border-y', 'border-linha', 'min-h-13', 'sticky', 'top-0');
    expect(within(faixa).getByText('filtro')).toBeInTheDocument();
  });

  it('o texto abaixo do título (subtítulo) e o que vem antes (voltar) acompanham o título', () => {
    render(<Moldura titulo="Escala dos oficiais" antes={<a href="/">Voltar</a>} subtitulo="Oficiais QOC e QOA.">x</Moldura>);
    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByText('Voltar')).toBeInTheDocument();
    expect(within(cabecalho).getByText('Oficiais QOC e QOA.')).toHaveClass('text-corpo', 'text-apagado');
  });
});

describe('o título de cada tela vem da Moldura', () => {
  const RAIZ = join(__dirname, '..', 'routes', '_app');
  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? arquivos(join(pasta, d.name)) : /\.tsx$/.test(d.name) ? [join(pasta, d.name)] : []));
  // a tela inicial tem a saudação animada no lugar do título (6.18): é o único h1 que não vem da moldura
  const EXCECOES = new Set(['index.tsx']);

  it('nenhuma tela de routes/_app escreve o seu <h1>: usa a Moldura', () => {
    const escrevem = arquivos(RAIZ)
      .map((a) => relative(RAIZ, a).split(sep).join('/'))
      .filter((rel) => !EXCECOES.has(rel))
      .filter((rel) => /<h1[\s>]/.test(readFileSync(join(RAIZ, rel), 'utf8')));
    expect(escrevem).toEqual([]);
  });
});

// o menu lateral: o ícone de 20 px antes do nome, num traço só (6.20, Task 3)
describe('o menu lateral', () => {
  it('cada item tem o ícone de 20 px, de traço de 1,75, antes do nome', async () => {
    const { abrir, EU_EXEMPLO, simularApi } = await import('./apoio');
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    const menu = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const itens = within(menu).getAllByRole('link').filter((a) => a.querySelector('svg:not(img)') && a.textContent);
    expect(itens.length).toBeGreaterThan(2);
    for (const item of itens) {
      const icone = item.querySelector('svg')!;
      expect(icone, item.textContent ?? '').toHaveClass('size-5');
      expect(icone, item.textContent ?? '').toHaveAttribute('stroke-width', '1.75');
      // o ícone vem antes do nome, na mesma linha
      expect(item.firstElementChild).toBe(icone);
    }
  });
});
