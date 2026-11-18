import type { Servico } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const BIOMA: Servico = {
  id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', rotuloImpressao: null, cor: '#C08A1E', ativo: true,
  turnos: [{ id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [{ dia: -1, turno: 'B' }] }],
};

function api() {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
    'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
    'PATCH /api/servicos/s3': { status: 200, corpo: BIOMA },
  });
}
const gatilho = () => screen.getByRole('button', { name: 'Cor' });

describe('seletor de cor', () => {
  it('escolher na grade e salvar envia a cor', async () => {
    const f = api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cor #4A86E8' }));
    expect(gatilho()).toHaveTextContent('#4A86E8');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'PATCH /api/servicos/s3')).toEqual({ nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', rotuloImpressao: null, cor: '#4A86E8' }),
    );
  });

  it('a cor atual aparece marcada na grade', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor' }));
    expect(await screen.findByRole('button', { name: 'Cor de Bioma' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cores dos serviços aparecem na grade', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor' }));
    expect(await screen.findByRole('button', { name: 'Cor de Pronto' })).toBeInTheDocument();
  });

  it('cor personalizada aceita #RRGGBB e recusa outro texto', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor' }));
    const painel = await screen.findByRole('dialog');
    const campo = within(painel).getByLabelText('Código da cor');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'azul');
    await userEvent.click(within(painel).getByRole('button', { name: 'Usar esta cor' }));
    expect(within(painel).getByText('Use o formato #RRGGBB.')).toBeInTheDocument();
    expect(gatilho()).toHaveTextContent('#C08A1E');
    fireEvent.change(campo, { target: { value: '#1a2b3c' } });
    await userEvent.click(within(painel).getByRole('button', { name: 'Usar esta cor' }));
    expect(gatilho()).toHaveTextContent('#1A2B3C');
  });
});
