import type { Escala, LinhaEscala, LinhaGuarnicao } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { mesPorExtenso } from 'contratos';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const LISTA: LinhaEscala[] = [
  { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto', 'JES'] },
  { id: 'e2', nome: 'Nova', ativa: true, servicos: [] },
  { id: 'e3', nome: 'Velha', ativa: false, servicos: [] },
];
const guarnicao = (g: Partial<LinhaGuarnicao>): LinhaGuarnicao => ({
  id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null, ...g,
});
const GUARNICOES = [guarnicao({}), guarnicao({ id: 'g2', nome: 'APH', prioridade: 2 }), guarnicao({ id: 'g3', nome: 'AR', ativa: false, prioridade: 3 })];
const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto', 'JES'] };
const NOITE = { inicio: '20:00', fim: '08:00', letras: ['B' as const], servicos: ['Pronto'] };
const escala = (e: Partial<Escala> = {}): Escala => ({
  id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true,
  servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }, { id: 's2', nome: 'JES', cor: '#6E56A8', ativo: true }],
  faixas: [DIA, NOITE],
  comLetra: true,
  vinculos: [],
  ...e,
});
const mes = mesAtual();

function api(ficha: Escala = escala(), extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: GUARNICOES },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
    'GET /api/escalas/e1': { status: 200, corpo: ficha },
    [`PUT /api/escalas/e1/vinculos/${mes}`]: { status: 200, corpo: ficha },
    'PUT /api/escalas/e1/servicos': { status: 200, corpo: ficha },
    ...extra,
  });
}
const salvarMatriz = () => userEvent.click(screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(mes)}` }));

describe('escalas', () => {
  it('lista mostra os serviços e esconde as desativadas', async () => {
    api();
    abrir('/escalas');
    expect((await screen.findByText('Ordinário')).closest('li')).toHaveTextContent('Pronto, JES');
    expect(screen.getByText('Nova').closest('li')).toHaveTextContent('sem serviços');
    expect(screen.queryByText('Velha')).toBeNull();
    await userEvent.click(screen.getByLabelText('Mostrar desativadas'));
    expect(await screen.findByText('Velha')).toBeInTheDocument();
  });

  it('nova escala envia só o nome', async () => {
    const f = api(escala(), { 'POST /api/unidades/u-1sb/escalas': { status: 201, corpo: escala() } });
    abrir('/escalas');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova escala' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/escalas')).toEqual({ nome: 'CPRH' }));
  });

  it('subir serviço muda a ordem enviada', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByRole('button', { name: 'Subir JES' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar serviços' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/escalas/e1/servicos')).toEqual({ servicoIds: ['s2', 's1'] }));
  });

  it('colunas mostram letra e faixa quando não há ambiguidade', async () => {
    api();
    abrir('/escalas/e1');
    const coluna = (await screen.findByText('08h–20h')).closest('th')!;
    expect(within(coluna).getByText('A')).toBeInTheDocument();
    const noite = screen.getByText('20h–08h').closest('th')!;
    expect(within(noite).getByText('B')).toBeInTheDocument();
  });

  it('com letra ambígua, colunas mostram só a faixa', async () => {
    const madrugada = { inicio: '00:00', fim: '08:00', letras: ['A' as const], servicos: ['Bioma'] };
    api(escala({ faixas: [madrugada, DIA], comLetra: false }));
    abrir('/escalas/e1');
    const coluna = (await screen.findByText('00h–08h')).closest('th')!;
    expect(within(coluna).queryByText('A')).toBeNull();
    expect(screen.getByLabelText('ABT em 00h–08h')).toBeInTheDocument();
  });

  it('não há coluna Todos os turnos', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByText('08h–20h');
    expect(screen.queryByText('Todos os turnos')).toBeNull();
    expect(screen.queryByLabelText(/em todos os turnos/)).toBeNull();
  });

  it('marcar envia a faixa', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    await userEvent.click(screen.getByLabelText('ABT em B (20h–08h)'));
    await salvarMatriz();
    await waitFor(() =>
      expect(corpoEnviado(f, `PUT /api/escalas/e1/vinculos/${mes}`)).toEqual({
        itens: [{ guarnicaoId: 'g1', inicio: '08:00', fim: '20:00' }, { guarnicaoId: 'g1', inicio: '20:00', fim: '08:00' }],
      }),
    );
  });

  it('mínimo da coluna soma as guarnições marcadas', async () => {
    api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    expect(screen.getAllByText('mín. 0')).toHaveLength(1); // só a coluna da noite continua em zero
    await userEvent.click(screen.getByLabelText('APH em A (08h–20h)'));
    expect(screen.getByText('mín. 4')).toBeInTheDocument();
  });

  it('linha mostra o tamanho da guarnição', async () => {
    api();
    abrir('/escalas/e1');
    const linha = (await screen.findByLabelText('ABT em A (08h–20h)')).closest('tr')!;
    expect(within(linha).getByText('de 2 a 4 militares')).toBeInTheDocument();
  });

  it('guarnição desativada só aparece vinculada, com a etiqueta', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g3', guarnicao: 'AR', ativaNoMes: false, ...NOITE }] }] }));
    abrir('/escalas/e1');
    const caixa = await screen.findByLabelText('AR em B (20h–08h)');
    expect(caixa).toBeChecked();
    expect(within(caixa.closest('tr')!).getByText('desativada')).toBeInTheDocument();
  });

  it('guarnição desativada sem vínculo não aparece na matriz', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByLabelText('ABT em A (08h–20h)');
    expect(screen.queryByLabelText('AR em A (08h–20h)')).toBeNull();
  });

  it('faixa que saiu da escala mostra o aviso', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g1', guarnicao: 'ABT', ativaNoMes: true, inicio: '16:00', fim: '00:00' }] }] }));
    abrir('/escalas/e1');
    expect(await screen.findByText('A faixa 16h–00h não existe mais nos serviços desta escala: ABT. Salve a matriz para tirá-la.')).toBeInTheDocument();
  });
});
