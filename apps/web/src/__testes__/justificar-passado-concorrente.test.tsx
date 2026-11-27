import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cancelado, pedir } from '@/api/cliente';
import { JustificarPassado } from '@/componentes/JustificarPassado';

// 6.65 (pool 30 c): um segundo pedido de motivo enquanto o primeiro grava não deixa promessa pendurada.
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('o motivo do passado com dois pedidos', () => {
  it('o segundo pedido, com o primeiro gravando, é recusado com aviso; o primeiro termina e nenhuma promessa fica pendurada', async () => {
    let liberar!: () => void;
    const lenta = new Promise<void>((r) => { liberar = r; });
    vi.stubGlobal('fetch', vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const corpo = init?.body ? (JSON.parse(String(init.body)) as { justificativa?: string }) : {};
      if (!corpo.justificativa) return json(400, { erro: 'Diga o motivo.', campos: { justificativa: 'Diga o motivo.' } });
      if (url.endsWith('/primeira')) await lenta;
      return json(200, { ok: true });
    }));
    render(<JustificarPassado><p>tela</p></JustificarPassado>);

    const primeira = pedir<{ ok: boolean }>('POST', '/api/primeira', { a: 1 });
    await userEvent.type(await screen.findByLabelText('Motivo'), 'Troca combinada com o comando.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('button', { name: 'Registrando…' }); // gravando

    // o segundo pedido chega agora: não pode cancelar o primeiro nem ficar sem resposta
    const segunda = pedir<{ ok: boolean }>('POST', '/api/segunda', { b: 2 });
    await expect(segunda).rejects.toThrow('Espere o registro do motivo anterior terminar e tente de novo.');
    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeInTheDocument(); // o diálogo do primeiro continua

    liberar();
    await expect(primeira).resolves.toEqual({ ok: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('com o diálogo aberto e ninguém gravando, o segundo pedido continua cancelando o primeiro em silêncio (como antes)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_entrada: RequestInfo | URL, init?: RequestInit) => {
      const corpo = init?.body ? (JSON.parse(String(init.body)) as { justificativa?: string }) : {};
      return corpo.justificativa ? json(200, { ok: true }) : json(400, { erro: 'Diga o motivo.', campos: { justificativa: 'Diga o motivo.' } });
    }));
    render(<JustificarPassado><p>tela</p></JustificarPassado>);
    const primeira = pedir('POST', '/api/primeira', { a: 1 });
    await screen.findByLabelText('Motivo');
    const segunda = pedir<{ ok: boolean }>('POST', '/api/segunda', { b: 2 });
    await expect(primeira).rejects.toBeInstanceOf(Cancelado);
    await userEvent.type(await screen.findByLabelText('Motivo'), 'Motivo da segunda.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await expect(segunda).resolves.toEqual({ ok: true });
  });
});
