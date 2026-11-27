import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import type { GradeDoMes } from 'contratos';
import { describe, expect, it } from 'vitest';
import { TabelaDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { COLUNA_PRESA_DIREITA, COLUNA_PRESA_ESQUERDA, CABECALHO_PRESO, useSombraDaRolagem } from '@/lib/tabela-com-rolagem';

// A borda da rolagem em toda tabela (6.70, Task 2): 3 px em tinta, e uma sombra leve do lado das partes presas quando há mais para os lados.
const css = readFileSync(join(process.cwd(), 'src', 'estilo.css'), 'utf8');
const arquivosDoSite = (pasta: string): string[] =>
  readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n);
    if (statSync(p).isDirectory()) return n === '__testes__' ? [] : arquivosDoSite(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });

describe('a fronteira da rolagem', () => {
  it('as fronteiras são de 3 px em tinta, uma peça só: não sobra a de 2 px em encaixe em arquivo nenhum do site', () => {
    expect(COLUNA_PRESA_ESQUERDA).toContain('border-r-3 border-r-tinta');
    expect(CABECALHO_PRESO).toContain('border-b-3 border-b-tinta');
    expect(COLUNA_PRESA_DIREITA).toContain('border-l-3 border-l-tinta');
    const velhas = arquivosDoSite(join(process.cwd(), 'src')).filter((a) => /border-[rbl]-2 (min-\[1440px\]:)?border-[rbl]-encaixe|border-[rbl]-2 border-[rbl]-encaixe/.test(readFileSync(a, 'utf8')));
    expect(velhas).toEqual([]);
  });

  it('a sombra é só CSS sobre o atributo do contêiner: aparece do lado das partes presas, sem animação', () => {
    expect(css).toMatch(/@utility sombra-presa-esq\s*{\s*\[data-rolagem\]\[data-rolou-x\] &\s*{[^}]*box-shadow/);
    expect(css).toMatch(/@utility sombra-presa-dir\s*{\s*\[data-rolagem\]\[data-resta-x\] &\s*{[^}]*box-shadow/);
    expect(css).not.toMatch(/@utility sombra-presa-[a-z]+\s*{[^@]*transition/);
  });
});

function Caixa() {
  const ref = useSombraDaRolagem();
  return <div ref={ref} data-rolagem="teste" data-testid="caixa" />;
}
const medir = (el: HTMLElement, m: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
  for (const [k, v] of Object.entries(m)) Object.defineProperty(el, k, { value: v, configurable: true, writable: true });
};

describe('useSombraDaRolagem', () => {
  it('sem rolagem nenhuma (cabe tudo), nada; ao rolar para os lados, o contêiner ganha data-rolou-x, e data-resta-x enquanto há mais à direita', () => {
    render(<Caixa />);
    const caixa = screen.getByTestId('caixa');
    medir(caixa, { scrollWidth: 800, clientWidth: 800, scrollLeft: 0 });
    act(() => void caixa.dispatchEvent(new Event('scroll')));
    expect(caixa).not.toHaveAttribute('data-rolou-x');
    expect(caixa).not.toHaveAttribute('data-resta-x');
    medir(caixa, { scrollWidth: 1600, clientWidth: 800, scrollLeft: 0 });
    act(() => void caixa.dispatchEvent(new Event('scroll')));
    expect(caixa).not.toHaveAttribute('data-rolou-x');
    expect(caixa).toHaveAttribute('data-resta-x');
    medir(caixa, { scrollWidth: 1600, clientWidth: 800, scrollLeft: 300 });
    act(() => void caixa.dispatchEvent(new Event('scroll')));
    expect(caixa).toHaveAttribute('data-rolou-x');
    expect(caixa).toHaveAttribute('data-resta-x');
    medir(caixa, { scrollWidth: 1600, clientWidth: 800, scrollLeft: 800 });
    act(() => void caixa.dispatchEvent(new Event('scroll')));
    expect(caixa).toHaveAttribute('data-rolou-x');
    expect(caixa).not.toHaveAttribute('data-resta-x');
  });
});

describe('nas tabelas com partes presas', () => {
  const grade: GradeDoMes = {
    mes: '2026-12',
    dias: [{ data: '2026-12-01', diaDaSemana: 2, feriado: null }, { data: '2026-12-02', diaDaSemana: 3, feriado: null }],
    grupos: [{ chave: 'a', nome: 'Alfa', linhas: [{ militarId: 'm1', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', jornada: 'pronto', dias: {}, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0 }] }],
  };

  it('Review Focus 3: a Grade usa as constantes da peça: a coluna do militar e o cabeçalho, e o contêiner liga a sombra', () => {
    render(<TabelaDaGrade grade={grade} grupos={grade.grupos} maximos={{ pjes: 0, diarias: 0 }} escolhida={null} aoEscolher={() => undefined} recolhidas={new Set()} aoAlternar={() => undefined} />);
    const cabecalhoDoMilitar = screen.getByRole('columnheader', { name: 'Militar' });
    expect(cabecalhoDoMilitar.className).toContain('border-r-3 border-r-tinta');
    expect(cabecalhoDoMilitar.className).toContain('border-b-3 border-b-tinta');
    expect(cabecalhoDoMilitar.className).toContain('sombra-presa-esq');
    expect(screen.getByRole('columnheader', { name: 'PJES' }).className).toContain('min-[1440px]:border-l-3');
    expect(screen.getByRole('columnheader', { name: 'PJES' }).className).toContain('min-[1440px]:sombra-presa-dir');
    expect(screen.getByRole('table').closest('[data-rolagem]')).not.toBeNull();
  });

  it('Review Focus 3: a matriz das escalas, com a coluna presa, usa a mesma peça', () => {
    const matriz = readFileSync(join(process.cwd(), 'src', 'componentes', 'escalas', 'Matriz.tsx'), 'utf8');
    expect(matriz).toContain("from '@/lib/tabela-com-rolagem'");
    expect(matriz).toContain('data-rolagem');
    expect(matriz).toContain('COLUNA_PRESA_ESQUERDA');
  });
});
