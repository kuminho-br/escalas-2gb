import type { Servico } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const BIOMA: Servico = {
  id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', rotuloImpressao: null, cor: '#C08A1E', tiraDoExpediente: false, ativo: true, fixo: false,
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
const botaoDe = (cor: string) => screen.getByRole('button', { name: `Cor: ${cor}` });

describe('seletor de cor', () => {
  it('escolher na grade e salvar envia a cor', async () => {
    const f = api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cor #4A86E8' }));
    expect(botaoDe('#4A86E8')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'PATCH /api/servicos/s3')).toEqual({ nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', rotuloImpressao: null, cor: '#4A86E8' }),
    );
  });

  it('a cor atual aparece marcada na grade', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    expect(await screen.findByRole('button', { name: 'Cor de Bioma' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cores dos serviços aparecem na grade', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    expect(await screen.findByRole('button', { name: 'Cor de Pronto' })).toBeInTheDocument();
  });

  it('cor personalizada aceita #RRGGBB e recusa outro texto', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    const painel = await screen.findByRole('dialog');
    const campo = within(painel).getByLabelText('Código da cor');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'azul');
    await userEvent.click(within(painel).getByRole('button', { name: 'Usar esta cor' }));
    expect(within(painel).getByText('Use o formato #RRGGBB.')).toBeInTheDocument();
    expect(botaoDe('#C08A1E')).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '#1a2b3c' } });
    await userEvent.click(within(painel).getByRole('button', { name: 'Usar esta cor' }));
    expect(botaoDe('#1A2B3C')).toBeInTheDocument();
  });

  it('o botão mostra só o quadrado, sem o código', async () => {
    api();
    abrir('/servicos/s3');
    const botao = await screen.findByRole('button', { name: 'Cor: #C08A1E' });
    expect(botao.textContent).toBe('');
    expect(botao).toHaveStyle({ backgroundColor: 'rgb(192, 138, 30)' });
  });

  it('a cor fica na mesma linha do nome na impressão', async () => {
    api();
    abrir('/servicos/s3');
    const botao = await screen.findByRole('button', { name: 'Cor: #C08A1E' });
    const campoNome = screen.getByLabelText('Nome na impressão').parentElement!;
    expect(campoNome.parentElement).toBe(botao.parentElement!.parentElement);
  });
});
