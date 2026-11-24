import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/componentes/ui/button';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
import { corLegivel, PALETA_PLANILHAS, razaoDeContraste } from '@/lib/cores';
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

  it('o botão tem as cinco variantes do sistema de estilo, cada uma com o token certo (6.20)', () => {
    const { getByRole } = render(
      <>
        <Button variant="principal">Salvar</Button>
        <Button variant="secundario">Importar</Button>
        <Button variant="discreto">Regras</Button>
        <Button variant="perigoso">Remover</Button>
        <Button variant="perigoso-cheio">Apagar</Button>
      </>,
    );
    const classe = (nome: string) => getByRole('button', { name: nome }).className;
    expect(classe('Salvar')).toContain('bg-vinho');
    expect(classe('Salvar')).toContain('text-white');
    expect(classe('Importar')).toContain('border-encaixe');
    expect(classe('Importar')).toContain('text-tinta');
    expect(classe('Regras')).not.toMatch(/border|bg-vinho/);
    expect(classe('Remover')).toContain('border-alerta');
    expect(classe('Remover')).toContain('text-alerta');
    expect(classe('Apagar')).toContain('bg-alerta');
    // a altura é a de controle, e o raio, o de controle
    expect(classe('Salvar')).toContain('h-(--altura-controle)');
    expect(classe('Salvar')).toContain('rounded-controle');
  });

  it('o botão ocupado mostra o verbo no lugar do texto, fica apagado e diz aria-busy', () => {
    const { getByRole } = render(<Button ocupado="Salvando…">Salvar</Button>);
    const b = getByRole('button', { name: 'Salvando…' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(b).not.toHaveTextContent('Salvar');
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

describe('corLegivel: contraste de 4,5:1 nas cores de serviço', () => {
  it('o azul da validação (#3C78D8) ganha um fundo mais escuro, com texto de contraste de pelo menos 4,5', () => {
    // sem o ajuste, nem o branco nem o escuro dão 4,5:1 sobre ele
    expect(razaoDeContraste('#FFFFFF', '#3C78D8')).toBeLessThan(4.5);
    const r = corLegivel('#3C78D8');
    expect(r.fundo).not.toBe('#3C78D8');
    expect(razaoDeContraste(r.texto, r.fundo)).toBeGreaterThanOrEqual(4.5);
    expect(r.texto).toBe('#FFFFFF');
  });

  it('a cor que já passa volta igual (fundo e texto)', () => {
    expect(corLegivel('#1155CC')).toEqual({ fundo: '#1155CC', texto: '#FFFFFF' });
    expect(corLegivel('#6E56A8')).toEqual({ fundo: '#6E56A8', texto: '#FFFFFF' });
    expect(corLegivel('#FFFF00')).toEqual({ fundo: '#FFFF00', texto: '#1C2430' });
  });

  it('o verde da paleta (#2F8F5B) também só dá 4,0:1 com o branco: ganha um fundo um pouco mais escuro, no passo de 5%', () => {
    expect(razaoDeContraste('#FFFFFF', '#2F8F5B')).toBeLessThan(4.5);
    const r = corLegivel('#2F8F5B');
    expect(razaoDeContraste(r.texto, r.fundo)).toBeGreaterThanOrEqual(4.5);
    // escurece misturando com preto em passos de 5% (o valor salvo não muda; só a exibição)
    const comPreto = (parte: number) => '#' + [0, 1, 2].map((i) => Math.round(parseInt('#2F8F5B'.slice(1 + i * 2, 3 + i * 2), 16) * (1 - parte)).toString(16).padStart(2, '0')).join('').toUpperCase();
    const possiveis = Array.from({ length: 20 }, (_, k) => comPreto((k + 1) * 0.05));
    expect(possiveis).toContain(r.fundo);
  });

  it('uma cor clara que dá pouco contraste com o texto escuro é clareada, não escurecida', () => {
    // luminância entre os dois limites: o texto escolhido é o escuro e o contraste ainda não chega a 4,5
    const r = corLegivel('#808080');
    expect(razaoDeContraste(r.texto, r.fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it('a paleta do Planilhas inteira fica com 4,5:1 ou mais, em todas as cores (Review Focus 1)', () => {
    for (const cor of PALETA_PLANILHAS.flat()) {
      const r = corLegivel(cor);
      expect(razaoDeContraste(r.texto, r.fundo), cor).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('vaga vazia (opção A do mockup): as cores do tema', () => {
  const token = (nome: string) => {
    const m = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9A-Fa-f]{6})`));
    expect(m, `--color-${nome} no tema`).not.toBeNull();
    return m![1]!;
  };

  it('o contorno da vaga obrigatória tem 3:1 ou mais com o fundo, e a barra vinho também', () => {
    expect(razaoDeContraste(token('encaixe'), token('superficie'))).toBeGreaterThanOrEqual(3);
    expect(razaoDeContraste(token('vinho'), token('superficie'))).toBeGreaterThanOrEqual(3);
  });

  it('ao passar o mouse, o contorno fica contínuo e escuro (3:1) e o texto segue com 4,5:1 sobre o fundo de passar', () => {
    expect(razaoDeContraste(token('apagado'), token('passa'))).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(token('tinta'), token('passa'))).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(token('apagado'), token('superficie'))).toBeGreaterThanOrEqual(4.5);
  });

  it('o contorno da vaga opcional é o mesmo da obrigatória (a opcional se reconhece pelo tracejado fino e pelo "Vaga opcional")', () => {
    expect(razaoDeContraste(token('encaixe'), token('superficie'))).toBeGreaterThanOrEqual(3);
    expect(css).not.toContain('encaixe-claro');
  });

  it('os tokens novos do sistema de estilo: o fundo de alerta com 5,5:1, os seis tamanhos de letra, os dois raios, as duas sombras e a altura de controle de 44 px no toque', () => {
    expect(razaoDeContraste(token('alerta'), token('alerta-fundo'))).toBeGreaterThanOrEqual(5.5);
    for (const trecho of ['--text-apoio: 0.8125rem', '--text-corpo: 0.9375rem', '--text-nome: 1.0625rem', '--text-bloco: 1.25rem', '--text-titulo: 1.75rem', '--text-abertura: 2.5rem']) expect(css).toContain(trecho);
    for (const trecho of ['--radius-controle: 6px', '--radius-superficie: 12px', '--shadow-apoiada:', '--shadow-por-cima:', '--altura-controle: 36px', '--altura-controle: 44px', '@media (pointer: coarse)']) expect(css).toContain(trecho);
  });
});
