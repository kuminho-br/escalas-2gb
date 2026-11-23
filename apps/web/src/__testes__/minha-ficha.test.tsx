import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MinhaFicha } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const FICHA: MinhaFicha = {
  postoGrad: 'SD BM',
  nomeGuerra: 'ANDRADE',
  nomeCompleto: 'João da Silva Andrade',
  matricula: '990001-1',
  telefone: '(81) 99999-0001',
  email: 'andrade@bombeiros.pe.gov.br',
  sexo: 'M',
  nascimento: { dia: 3, mes: 7 },
  cpf: '52998224725',
  endereco: { cep: '50030230', logradouro: 'Rua Fictícia', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Recife', uf: 'PE' },
  comportamento: 'Bom',
  comportamentoBoletim: 'BG 12/2026',
  situacao: { lotacao: '1ª SB', equipe: 'Alfa', jornada: 'pronto', quadro: 'QBMG', situacaoDoMilitar: 'Ativa' },
  motorista: true,
  cnh: ['D'],
  cnhPorHierarquia: ['B', 'C'],
  voluntarioJes: true,
};

const api = (extra: Parameters<typeof simularApi>[0] = {}) =>
  simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } }, 'GET /api/eu/ficha': { status: 200, corpo: FICHA }, ...extra });

describe('Minha ficha: a animação de entrada (6.14)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('mostra o bloco com "Uma vez a cada 12 horas" marcada na primeira vez; escolher outra grava e continua marcada ao reabrir', async () => {
    api();
    abrir('/minha-ficha');
    const bloco = within(await screen.findByRole('radiogroup', { name: 'Animação de entrada' }));
    expect(bloco.getByRole('radio', { name: 'Uma vez a cada 12 horas' })).toBeChecked();
    expect(screen.getByText('Vale para este navegador.')).toBeInTheDocument();
    await userEvent.click(bloco.getByRole('radio', { name: 'Nunca' }));
    expect(localStorage.getItem('escalas2gb.login-animacao-quando')).toBe('nunca');
    cleanup();
    api();
    abrir('/minha-ficha');
    expect(within(await screen.findByRole('radiogroup', { name: 'Animação de entrada' })).getByRole('radio', { name: 'Nunca' })).toBeChecked();
  });

  it('com menos movimento, o aviso aparece', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    api();
    abrir('/minha-ficha');
    expect(await screen.findByText('Seu aparelho pede menos movimento, então a animação não toca.')).toBeInTheDocument();
  });
});

describe('Minha ficha', () => {
  it('mostra os próprios dados só para leitura, menos o telefone', async () => {
    api();
    abrir('/minha-ficha');
    expect(await screen.findByRole('heading', { level: 1, name: 'Minha ficha' })).toBeInTheDocument();
    const principal = within(screen.getByRole('main'));
    for (const texto of ['João da Silva Andrade', '990001-1', 'andrade@bombeiros.pe.gov.br', '03/07', '529.982.247-25', '50030-230', 'Rua Fictícia, 10', 'Recife / PE', 'QBMG', 'Ativa', 'Bom', 'BG 12/2026', '1ª SB', 'Alfa']) expect(principal.getByText(texto)).toBeInTheDocument();
    // o telefone é o único campo editável
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('Telefone')).toHaveValue('(81) 99999-0001');
  });

  it('salva o telefone', async () => {
    const f = api({ 'PATCH /api/eu/telefone': { status: 200, corpo: { ...FICHA, telefone: '(81) 98888-0000' } } });
    abrir('/minha-ficha');
    const campo = await screen.findByLabelText('Telefone');
    await userEvent.clear(campo);
    await userEvent.type(campo, '(81) 98888-0000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/eu/telefone')).toEqual({ telefone: '(81) 98888-0000' }));
    expect(await screen.findByText('Telefone salvo.')).toBeInTheDocument();
  });

  it('apagar o telefone limpa o campo no servidor', async () => {
    const f = api({ 'PATCH /api/eu/telefone': { status: 200, corpo: { ...FICHA, telefone: null } } });
    abrir('/minha-ficha');
    await userEvent.clear(await screen.findByLabelText('Telefone'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/eu/telefone')).toEqual({ telefone: null }));
  });

  it('telefone inválido mostra a mensagem no campo e não grava (Review Focus 3)', async () => {
    const f = api();
    abrir('/minha-ficha');
    const campo = await screen.findByLabelText('Telefone');
    await userEvent.clear(campo);
    await userEvent.type(campo, '1'.repeat(21));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Use no máximo 20 caracteres.')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(f.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('a mensagem do servidor para o telefone também aparece no campo', async () => {
    api({ 'PATCH /api/eu/telefone': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { telefone: 'Telefone recusado.' } } } });
    abrir('/minha-ficha');
    await userEvent.type(await screen.findByLabelText('Telefone'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await within(await screen.findByRole('main')).findByText('Telefone recusado.')).toBeInTheDocument();
  });
});
