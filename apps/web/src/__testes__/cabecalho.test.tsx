import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { iniciaisDe, papelNaUnidade } from '@/lib/papeis';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// O cabeçalho novo (6.61, Task 1): o mockup v3 da tela inicial. Dados fictícios (D7).
const GB = { id: 'u-gb', sigla: '2º GB', nivel: 3, caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], tipo: 'grupamento', maeId: null as string | null };
const SB1 = { ...EU_EXEMPLO.unidades[0]!, maeId: 'u-gb' };
const SB2 = { id: 'u-2sb', sigla: '2ª SB', nivel: 4, caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], tipo: 'secao', maeId: 'u-gb' };
const GESTOR: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1, SB2] };
const COMUM: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [SB2], lotacao: SB2 };

describe('as funções do cabeçalho', () => {
  it('iniciaisDe: a primeira letra do nome de guerra e, se houver mais de uma palavra, a da última', () => {
    expect(iniciaisDe('ANDRADE')).toBe('A');
    expect(iniciaisDe('Da Silva')).toBe('DS');
    expect(iniciaisDe('  maria  de souza  ')).toBe('MS');
    expect(iniciaisDe('')).toBe('?');
  });

  it('papelNaUnidade: o nível mais alto que cobre a unidade de trabalho; um nível em outra unidade não conta; sem nível, null', () => {
    const eu = (papeis: EuDaApi['papeis'], unidade = SB1) => ({ ...GESTOR, papeis, unidade, soConsulta: false });
    expect(papelNaUnidade(eu([{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }]))).toBe('gestor');
    expect(papelNaUnidade(eu([{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }, { papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }]))).toBe('gestor');
    expect(papelNaUnidade(eu([{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }], SB2))).toBeNull();
    expect(papelNaUnidade(eu([{ papel: 'administrador', unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }]))).toBe('administrador');
    expect(papelNaUnidade(eu([]))).toBeNull();
  });
});

describe('o cabeçalho', () => {
  it('na tela inicial: o brasão do 2º GB e o nome do sistema levam ao início', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    const inicio = await screen.findByRole('link', { name: 'Ir para o início' });
    expect(within(inicio).getByRole('img', { name: 'Brasão do 2º Grupamento de Bombeiros' })).toHaveAttribute('src', '/brasao-2gb.png');
    expect(inicio).toHaveTextContent('Sistema de Gestão - 2º GB');
    expect(inicio).toHaveAttribute('href', '/');
  });

  it('o fio vinho no alto', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    const topo = (await screen.findByRole('banner'));
    const fio = topo.querySelector('[data-fio-vinho]');
    expect(fio).not.toBeNull();
    expect(fio!.className).toContain('bg-vinho');
  });

  it('à direita: as iniciais, o posto e o nome de guerra, e o nível de acesso na unidade de trabalho', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    const pessoa = await screen.findByRole('button', { name: /SD ANDRADE/ });
    expect(within(pessoa).getByText('A')).toHaveAttribute('aria-hidden', 'true');
    expect(within(pessoa).getByText('SD ANDRADE')).toBeInTheDocument();
    expect(within(pessoa).getByText('Auxiliar administrativo')).toBeInTheDocument();
  });

  it('o gestor vê "Gestor"; o militar comum não vê nível nenhum', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/consulta/unidades': { status: 200, corpo: [] } });
    abrir('/');
    expect(within(await screen.findByRole('button', { name: /SD ANDRADE/ })).getByText('Gestor')).toBeInTheDocument();
  });

  it('o militar comum: sem nível de acesso embaixo do nome', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM } });
    abrir('/');
    const pessoa = await screen.findByRole('button', { name: /SD ANDRADE/ });
    expect(pessoa).not.toHaveTextContent('Auxiliar administrativo');
    expect(pessoa).not.toHaveTextContent('Gestor');
  });

  it('o menu da pessoa não mudou: o e-mail e "Sair"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await userEvent.click(await screen.findByRole('button', { name: /SD ANDRADE/ }));
    expect(await screen.findByText('andrade@exemplo.test')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();
  });

  it('com uma unidade só, o caminho fica só para leitura, sem botão de unidade', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM } });
    abrir('/');
    const nav = await screen.findByRole('navigation', { name: 'Unidade' });
    expect(nav).toHaveTextContent('2ª SB');
    expect(within(nav).queryByRole('button')).toBeNull();
  });
});

describe('o nome do sistema', () => {
  it('no menu do celular (o Trilho) também é "Sistema de Gestão - 2º GB"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    const trilho = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(trilho).getByText('Sistema de Gestão - 2º GB')).toBeInTheDocument();
  });

  it('"Escalas 2º GB" não aparece em lugar nenhum do site', () => {
    const achados: string[] = [];
    const varrer = (pasta: string) => {
      for (const n of readdirSync(pasta)) {
        const p = join(pasta, n);
        if (statSync(p).isDirectory()) {
          if (n !== '__testes__' && n !== 'node_modules') varrer(p);
        } else if (/\.(tsx?|css|html)$/.test(n) && readFileSync(p, 'utf8').includes('Escalas 2º GB')) achados.push(p);
      }
    };
    varrer(join(process.cwd(), 'src'));
    expect(readFileSync(join(process.cwd(), 'index.html'), 'utf8')).not.toContain('Escalas 2º GB');
    expect(achados).toEqual([]);
  });
});
