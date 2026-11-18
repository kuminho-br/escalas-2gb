import type { Servico } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { descreverTurnosPadrao, textoDuracao } from '@/lib/turnos';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const servico = (s: Partial<Servico>): Servico => ({
  id: 's1', nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B', ativo: true, turnos: [], ...s,
});
const BIOMA = servico({
  id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E',
  turnos: [{ id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [{ dia: -1, turno: 'B' }] }],
});
const LISTA = [
  servico({ turnos: [{ id: 't0', letra: 'A', inicio: '08:00', fim: '20:00', duracaoMinutos: 720, turnosPadrao: [{ dia: 0, turno: 'A' }] }] }),
  servico({ id: 's2', nome: 'JES', tipo: 'pjes' }),
  BIOMA,
  servico({ id: 's4', nome: 'Antigo', ativo: false }),
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: LISTA },
    'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
    ...extra,
  });
}

describe('textos dos turnos', () => {
  it.each([
    [[{ dia: 0, turno: 'A' }], 'A'],
    [[{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }], 'A e B'],
    [[{ dia: -1, turno: 'B' }], 'B da noite anterior'],
    [[{ dia: -1, turno: 'B' }, { dia: 0, turno: 'A' }], 'B da noite anterior e A'],
    [[{ dia: 0, turno: 'B' }, { dia: 1, turno: 'A' }], 'B e A do dia seguinte'],
  ] as const)('descreverTurnosPadrao %#', (t, texto) => expect(descreverTurnosPadrao([...t])).toBe(texto));
  it.each([[720, '12h'], [510, '8h30'], [1440, '24h']])('textoDuracao(%i)', (m, t) => expect(textoDuracao(m)).toBe(t));
});

describe('serviços', () => {
  it('lista agrupa por tipo e esconde os desativados até marcar', async () => {
    api();
    abrir('/servicos');
    const diaria = (await screen.findByRole('heading', { name: 'Diária' })).closest('section')!;
    expect(within(diaria).getByText('Bioma')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PJES' })).toBeInTheDocument();
    expect(screen.queryByText('Antigo')).toBeNull();
    await userEvent.click(screen.getByLabelText('Mostrar desativados'));
    expect((await screen.findByText('Antigo')).closest('li')).toHaveTextContent('desativado');
  });

  it('ficha mostra turno com duração, bloco e pede voluntariado', async () => {
    api();
    abrir('/servicos/s3');
    const linha = (await screen.findByLabelText('Início do turno A')).closest('li')!;
    expect(within(linha).getByText('8h')).toBeInTheDocument();
    expect(within(linha).getByText('Pede voluntariado em: B da noite anterior')).toBeInTheDocument();
  });

  it('turno das 16h às 00h mostra "A e B" e 8h', async () => {
    const f = api({ 'POST /api/servicos/s3/turnos': { status: 201, corpo: BIOMA } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir turno' }));
    fireEvent.change(screen.getByLabelText('Letra do turno novo'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Início do turno novo'), { target: { value: '16:00' } });
    fireEvent.change(screen.getByLabelText('Fim do turno novo'), { target: { value: '00:00' } });
    const linha = screen.getByLabelText('Início do turno novo').closest('li')!;
    expect(within(linha).getByText('8h')).toBeInTheDocument();
    expect(within(linha).getByText('Pede voluntariado em: A e B')).toBeInTheDocument();
    await userEvent.click(within(linha).getByRole('button', { name: 'Salvar turno novo' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/servicos/s3/turnos')).toEqual({ letra: 'C', inicio: '16:00', fim: '00:00' }));
  });

  it('operação só aparece para diária e some ao trocar o tipo', async () => {
    const f = api({ 'PATCH /api/servicos/s3': { status: 200, corpo: BIOMA } });
    abrir('/servicos/s3');
    expect(await screen.findByLabelText('Operação')).toHaveValue('Guardiões do Bioma');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'pjes' } });
    expect(screen.queryByLabelText('Operação')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'PATCH /api/servicos/s3')).toEqual({ nome: 'Bioma', tipo: 'pjes', operacao: null, rotuloImpressao: null, cor: '#C08A1E' }),
    );
  });

  it('remover turno pede à API e mostra o erro dela', async () => {
    api({ 'DELETE /api/turnos/t1': { status: 409, corpo: { erro: 'O turno A de Bioma já tem militares escalados. Ele pode mudar de horário, mas não pode ser removido.' } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover turno A' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('já tem militares escalados');
  });

  it('desativar envia ativo false', async () => {
    const f = api({ 'POST /api/servicos/s3/situacao': { status: 200, corpo: { ...BIOMA, ativo: false } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/servicos/s3/situacao')).toEqual({ ativo: false }));
  });
});
