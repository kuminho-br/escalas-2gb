import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, simularApi } from './apoio';

// A foto nova do quartel e a marca, um enquadramento por plataforma (6.67, Task 1). O que o jsdom não desenha (o enquadramento) está no CSS, e o teste lê o CSS.
const css = readFileSync(join(process.cwd(), 'src', 'estilo.css'), 'utf8');
const bloco = (seletor: string) => {
  const i = css.indexOf(seletor);
  expect(i, `o CSS tem ${seletor}`).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
};
const TELAS = [
  { rota: '/entrar', nome: 'o login' },
  { rota: '/primeiro-acesso', nome: 'o primeiro acesso' },
  { rota: '/esqueci-a-senha', nome: 'o esqueci minha senha' },
];

describe.each(TELAS)('$nome', ({ rota }) => {
  it('o fundo usa /quartel.jpg, o brasão e a marca são os de sempre, e a etiqueta "Quartel do 2º GB" não existe mais', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir(rota);
    const brasao = await screen.findByRole('img', { name: 'Brasão do 2º GB' });
    expect(brasao).toHaveAttribute('src', '/brasao-2gb.png');
    const principal = screen.getByRole('main');
    expect(principal.querySelector('.cenario-login__fundo img')).toHaveAttribute('src', '/quartel.jpg');
    expect(principal).toHaveTextContent('Sistema de Gestão - 2º GB');
    expect(principal).toHaveTextContent('2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco');
    expect(screen.queryByText('Quartel do 2º GB')).toBeNull();
  });

  it('Review Focus 2: se a foto não carrega, a tela continua utilizável (o fundo é vinho liso)', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir(rota);
    await screen.findByRole('img', { name: 'Brasão do 2º GB' });
    const foto = screen.getByRole('main').querySelector('.cenario-login__fundo img')!;
    fireEvent.error(foto);
    const formulario = screen.getByRole('main').querySelector('form')!;
    expect(formulario).toBeInTheDocument();
    // o primeiro campo aceita o que a pessoa digita; no login, o botão Entrar continua habilitado (nas outras telas ele espera o e-mail)
    expect(formulario.querySelector('input')).toBeEnabled();
    if (rota === '/entrar') expect(formulario.querySelector('button[type="submit"]')).toBeEnabled();
  });
});

describe('os arquivos', () => {
  it('/quartel.png saiu: o arquivo não existe mais e nenhum arquivo do site o cita', () => {
    expect(existsSync(join(process.cwd(), 'public', 'quartel.png'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'public', 'quartel.jpg'))).toBe(true);
    const citam: string[] = [];
    const varrer = (pasta: string) => {
      for (const n of readdirSync(pasta)) {
        const p = join(pasta, n);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.(tsx?|css|html)$/.test(n) && !p.includes('__testes__') && readFileSync(p, 'utf8').includes('quartel.png')) citam.push(p);
      }
    };
    varrer(join(process.cwd(), 'src'));
    expect(readFileSync(join(process.cwd(), 'index.html'), 'utf8')).not.toContain('quartel.png');
    expect(citam).toEqual([]);
  });
});

describe('o enquadramento por plataforma (o CSS do cenário)', () => {
  it('a marca só vai para baixo no computador: no celular e no tablet ela ocupa a largura, em vez de encostar à direita (achado da revisão)', () => {
    expect(bloco('.cenario-login__marca {')).not.toContain('align-self');
    const computador = css.slice(css.indexOf('@media (min-width: 64rem)'));
    expect(computador.slice(0, computador.indexOf('@media (max-width')) ).toMatch(/\.cenario-login__marca\s*{[^}]*align-self:\s*end/);
  });

  it('o fundo é vinho liso por baixo da foto', () => {
    expect(bloco('.cenario-login__fundo {')).toMatch(/background:\s*var\(--color-vinho/);
  });

  it('computador: as bandeiras livres no céu (center 18%) e o véu de azul-escuro claro a vinho a 90% embaixo, mais o véu vinho à esquerda', () => {
    expect(css).toMatch(/\.cenario-login__fundo img\s*{[^}]*object-position:\s*center 18%/);
    const veu = bloco('.cenario-login__fundo::after {');
    expect(veu).toContain('linear-gradient(180deg');
    expect(veu).toContain('linear-gradient(90deg');
    expect(veu).toMatch(/90%/);
  });

  it('celular (abaixo de 1024 px): a fachada, a estátua e o jardim, a foto ampliada 1,06 vez e deslocada pela largura da tela (em porcentagem, não em pixels)', () => {
    const celular = css.slice(css.indexOf('@media (max-width: 63.999rem)'));
    expect(celular).toContain('.cenario-login__fundo img');
    // 1280 x 1,06 / 390 = 347,9% da largura; o pedaço x 500-870, y 430-960 cai em cima: deslocamentos de 39,06% e 44,79% do tamanho da própria foto
    expect(celular).toMatch(/width:\s*347\.9%/);
    expect(celular).toMatch(/translate\(\s*-39\.06%\s*,\s*-44\.79%\s*\)/);
  });

  it('celular: o nome e a linha de baixo à esquerda e o brasão à direita (72 px; nome em 28 px, linha em 13 px)', () => {
    const celular = css.slice(css.indexOf('@media (max-width: 63.999rem)'));
    expect(celular).toMatch(/grid-template-areas:\s*"nome brasao" "linha brasao"/);
    expect(celular).toMatch(/\.cenario-login__marca img\s*{[^}]*width:\s*72px/);
    expect(celular).toMatch(/\.cenario-login__marca \.nome\s*{[^}]*font-size:\s*28px/);
    expect(celular).toMatch(/\.cenario-login__marca \.linha\s*{[^}]*font-size:\s*13px/);
  });

  it('o nome e a linha de baixo têm sombra de texto: o branco nunca fica sobre o céu aberto', () => {
    expect(css).toMatch(/\.cenario-login__marca :is\(\.nome, \.linha\)\s*{[^}]*text-shadow:\s*0 1px 3px/);
  });
});
