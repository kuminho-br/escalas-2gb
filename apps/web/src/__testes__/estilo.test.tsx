import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/componentes/ui/button';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
// o plugin do Tailwind intercepta `?raw` em .css e devolve vazio: lê o arquivo direto
const css = readFileSync(join(process.cwd(), 'src', 'estilo.css'), 'utf8');

describe('estilo', () => {
  it('o tema escuro do sistema não vale', () => {
    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *))');
  });

  it('campos e diálogos usam superfície branca', () => {
    expect(css).toMatch(/--color-background:\s*#FFFFFF/i);
  });

  it('texto pequeno tem 13 px', () => {
    expect(css).toMatch(/--text-xs:\s*0\.8125rem/);
  });

  it('o elástico só é desligado no computador', () => {
    const regra = [...css.matchAll(/overscroll-behavior-y:\s*none/g)];
    expect(regra).toHaveLength(1);
    const aberturas = [...css.matchAll(/@media[^{]*\{/g)].filter((m) => m.index! < regra[0]!.index!);
    expect(aberturas.at(-1)?.[0]).toContain('(min-width: 48rem)');
  });

  it('botão secundário tem texto vinho', () => {
    const { getByRole } = render(<Button variant="outline">Importar</Button>);
    expect(getByRole('button', { name: 'Importar' }).className).toContain('text-vinho');
  });

  it('cor clara ganha borda', () => {
    const { container } = render(
      <>
        <QuadradoDaCor cor="#FFF2CC" />
        <QuadradoDaCor cor="#2F8F5B" />
      </>,
    );
    const [claro, escuro] = Array.from(container.querySelectorAll('span'));
    expect(claro).toHaveAttribute('data-claro');
    expect(escuro).not.toHaveAttribute('data-claro');
  });
});
