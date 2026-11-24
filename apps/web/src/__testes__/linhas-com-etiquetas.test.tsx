import type { ListaDoPeculio, LinhaMilitar } from 'contratos';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.17, item 32: as linhas das listas do Pecúlio e de Militares com destaque: patente e nome de guerra, o nome completo em 15 px, e os dados em etiquetas
// com ícone (a cor tem um sentido só: falta de dado, em âmbar). Dados fictícios (D7).
const EMAIL_LONGO = 'maria.de.souza.lima.da.silva@bombeiros.pe.gov.br';
const PECULIO: ListaDoPeculio = {
  militares: [
    { militarId: 'm1', matricula: '990001-1', posto: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', lotacao: '1ª SB', telefone: '(81) 99999-0001', email: EMAIL_LONGO, pendencias: [] },
    { militarId: 'm2', matricula: '990002-2', posto: 'CB', nomeGuerra: 'BARRETO', nomeCompleto: 'Maria Barreto', lotacao: '1ª SB', telefone: null, email: null, pendencias: ['Sem telefone'] },
  ],
};
const MILITARES: LinhaMilitar[] = [
  { id: 'm1', matricula: '990001-1', posto: 'SD', quadro: null, nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', equipe: 'Bravo', jornada: 'pronto', motorista: 'B', voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [] },
  { id: 'm2', matricula: '990002-2', posto: 'CB', quadro: null, nomeGuerra: 'BARRETO', nomeCompleto: 'Maria Barreto', equipe: null, jornada: 'adm', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [] },
];
const GESTOR = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] };
const linhaDe = (nome: string) => screen.getByText(nome, { selector: 'span.font-cond' }).closest('a')!;

describe('a lista do Pecúlio', () => {
  it('linha 1: patente e nome de guerra; linha 2: o nome completo em 15 px, tinta; linha 3: etiquetas com ícone (matrícula, telefone, e-mail)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-1sb/peculio': { status: 200, corpo: PECULIO } });
    abrir('/peculio');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    const linha = within(linhaDe('ANDRADE'));
    expect(linha.getByText('João da Silva Andrade')).toHaveClass('text-[15px]', 'text-tinta');
    for (const texto of ['990001-1', '(81) 99999-0001']) {
      const etiqueta = linha.getByText(texto).closest('[data-etiqueta]')!;
      expect(etiqueta).toHaveClass('h-6', 'rounded-md', 'text-[13px]', 'font-medium', 'bg-passa', 'border-linha', 'text-tinta');
      expect(etiqueta.querySelector('svg')).not.toBeNull();
    }
    // o e-mail longo corta com reticências, e a dica mostra inteiro
    const email = linha.getByText(EMAIL_LONGO);
    expect(email).toHaveClass('truncate');
    expect(email.closest('[data-etiqueta]')).toHaveAttribute('title', EMAIL_LONGO);
    // nada abaixo de 13 px na linha
    expect(linhaDe('ANDRADE').innerHTML).not.toMatch(/text-xs|text-\[11px\]|text-\[12px\]/);
  });

  it('o dado que falta vira etiqueta âmbar ("Sem telefone", "Sem e-mail"), sem cor por tipo de dado', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-1sb/peculio': { status: 200, corpo: PECULIO } });
    abrir('/peculio');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    const linha = within(linhaDe('BARRETO'));
    for (const texto of ['Sem telefone', 'Sem e-mail']) {
      expect(linha.getByText(texto).closest('[data-etiqueta]')).toHaveClass('bg-pendencia-fundo', 'text-pendencia');
    }
    // quem tem o dado não ganha etiqueta âmbar
    expect(within(linhaDe('ANDRADE')).queryByText(/^Sem /)).toBeNull();
  });
});

describe('a lista de Militares', () => {
  it('linha 2: o nome completo em 15 px; linha 3: matrícula, jornada e equipe ("Pronto · BRAVO", "Adm") e "Motorista B", em etiquetas com ícone', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: MILITARES },
      'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
    });
    abrir('/militares');
    await screen.findByText('ANDRADE', { selector: 'span.font-cond' });
    const a = within(linhaDe('ANDRADE'));
    expect(a.getByText('João da Silva Andrade')).toHaveClass('text-[15px]', 'text-tinta');
    expect(a.getByText('990001-1').closest('[data-etiqueta]')!.querySelector('svg')).not.toBeNull();
    expect(a.getByText('Pronto · BRAVO').closest('[data-etiqueta]')).toHaveClass('bg-passa', 'border-linha');
    expect(a.getByText('Motorista B').closest('[data-etiqueta]')!.querySelector('svg')).not.toBeNull();
    const b = within(linhaDe('BARRETO'));
    expect(b.getByText('Adm')).toBeInTheDocument();
    expect(b.queryByText(/Motorista/)).toBeNull();
    expect(linhaDe('ANDRADE').innerHTML).not.toMatch(/text-xs|text-\[11px\]|text-\[12px\]/);
  });
});

describe('"Lotação a partir de" nas listas (item 16 da 6.18)', () => {
  it('Pecúlio: quem só começa depois ganha a etiqueta com a data; quem já está lotado não', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      'GET /api/unidades/u-1sb/peculio': { status: 200, corpo: { militares: [PECULIO.militares[0]!, { ...PECULIO.militares[1]!, lotacaoAPartirDe: '2026-12-15' }] } },
    });
    abrir('/peculio');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(within(linhaDe('BARRETO')).getByText('Lotação a partir de 15/12/2026').closest('[data-etiqueta]')).not.toBeNull();
    expect(within(linhaDe('ANDRADE')).queryByText(/Lotação a partir de/)).toBeNull();
  });

  it('Militares: o mesmo', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [MILITARES[0]!, { ...MILITARES[1]!, lotacaoAPartirDe: '2026-12-15' }] },
      'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
    });
    abrir('/militares');
    await screen.findByText('ANDRADE', { selector: 'span.font-cond' });
    expect(within(linhaDe('BARRETO')).getByText('Lotação a partir de 15/12/2026')).toBeInTheDocument();
    expect(within(linhaDe('ANDRADE')).queryByText(/Lotação a partir de/)).toBeNull();
  });
});
