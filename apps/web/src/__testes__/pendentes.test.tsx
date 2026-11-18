import type { Escala, LinhaEscala, Servico } from 'contratos';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_PENDENTE } from '@/componentes/AlteracoesPendentes';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

const LISTA: LinhaEscala[] = [
  { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'] },
  { id: 'e2', nome: 'Nova', ativa: true, servicos: [] },
];
const escala = (e: Partial<Escala>): Escala => ({
  id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true,
  servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }], faixas: [], comLetra: true, vinculos: [], ...e,
});
const BIOMA: Servico = {
  id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#C08A1E', ativo: true,
  turnos: [{ id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [] }],
};

function api() {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
    'GET /api/escalas/e1': { status: 200, corpo: escala({}) },
    'GET /api/escalas/e2': { status: 200, corpo: escala({ id: 'e2', nome: 'Nova', titulo: 'ESCALA NOVA', servicos: [] }) },
    'PATCH /api/escalas/e1': { status: 200, corpo: escala({ titulo: 'ESCALA NOVA DO ORDINÁRIO' }) },
    'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
  });
}
const trocarTitulo = async () => {
  const campo = await screen.findByLabelText('Título no documento');
  fireEvent.change(campo, { target: { value: 'ESCALA NOVA DO ORDINÁRIO' } });
  return campo;
};
const irParaNova = () => userEvent.click(screen.getByRole('link', { name: /^Nova/ }));

afterEach(() => vi.restoreAllMocks());

describe('alterações não salvas', () => {
  // [foco 20]
  it('mudar o título mostra Alterações não salvas', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByLabelText('Título no documento');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    await trocarTitulo();
    expect(screen.getAllByText('Alterações não salvas')).toHaveLength(1);
  });

  it('trocar de escala com alteração pendente pergunta e fica ao cancelar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    const campo = await trocarTitulo();
    await irParaNova();
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
    expect(screen.getByLabelText('Título no documento')).toBe(campo);
    expect(campo).toHaveValue('ESCALA NOVA DO ORDINÁRIO');
  });

  it('confirmando, troca de escala', async () => {
    api();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escalas/e1');
    await trocarTitulo();
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
  });

  it('sem alteração, troca sem perguntar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await screen.findByLabelText('Título no documento');
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('mudar o horário de um turno mostra Alterações não salvas', async () => {
    api();
    abrir('/servicos/s3');
    const inicio = await screen.findByLabelText('Início do turno A');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    fireEvent.change(inicio, { target: { value: '01:00' } });
    expect(screen.getAllByText('Alterações não salvas')).toHaveLength(1);
    fireEvent.change(inicio, { target: { value: '00:00' } });
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('depois de salvar, o aviso some sem perguntar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await trocarTitulo();
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0]!);
    await waitFor(() => expect(screen.queryByText('Alterações não salvas')).toBeNull());
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
    expect(confirmar).not.toHaveBeenCalled();
  });
});
