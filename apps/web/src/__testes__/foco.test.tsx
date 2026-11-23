import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/componentes/ui/tabs';

// N0.2 (achado S4): um contorno de foco só, o do projeto (estilo.css: 2 px, cor tinta, afastado 2 px). Os componentes da biblioteca não põem o deles.
const PASTA_UI = join(__dirname, '..', 'componentes', 'ui');
const DA_BIBLIOTECA = /focus-visible:(ring|border-ring|outline-ring|outline-1)/;

describe('um contorno de foco só', () => {
  it('nenhum componente de componentes/ui tem o anel de foco da biblioteca', () => {
    const comAnel = readdirSync(PASTA_UI)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => DA_BIBLIOTECA.test(readFileSync(join(PASTA_UI, f), 'utf8')));
    expect(comAnel).toEqual([]);
  });

  it('um botão, uma aba e um campo recebem o foco pelo teclado sem as classes do anel da biblioteca', async () => {
    render(
      <>
        <Button>Salvar</Button>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Primeira</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input aria-label="Nome" />
      </>,
    );
    for (const alvo of [screen.getByRole('button', { name: 'Salvar' }), screen.getByRole('tab', { name: 'Primeira' }), screen.getByRole('textbox', { name: 'Nome' })]) {
      await userEvent.tab();
      expect(alvo).toHaveFocus();
      expect(alvo.className).not.toMatch(DA_BIBLIOTECA);
      // `outline-none` apagaria o contorno do projeto (a classe vence a regra base do estilo.css)
      expect(alvo.className).not.toMatch(/outline-(none|hidden)/);
    }
  });

  it('o contorno do projeto continua no estilo.css', () => {
    const css = readFileSync(join(__dirname, '..', 'estilo.css'), 'utf8');
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--color-tinta\);\s*outline-offset:\s*2px;/);
  });
});
