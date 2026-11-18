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
const escala = (e: Partial<Escala> = {}): Escala => ({
  id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true,
  servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }, { id: 's2', nome: 'JES', cor: '#6E56A8', ativo: true }],
  letras: ['A', 'B'],
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

  it('marcar na matriz envia o vínculo com a letra', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT no turno A'));
    await salvarMatriz();
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/escalas/e1/vinculos/${mes}`)).toEqual({ itens: [{ guarnicaoId: 'g1', turnoLetra: 'A' }] }));
  });

  it('"Todos os turnos" envia turnoLetra null e desmarca as letras da linha', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('APH no turno A'));
    await userEvent.click(screen.getByLabelText('APH em todos os turnos'));
    expect(screen.getByLabelText('APH no turno A')).not.toBeChecked();
    await salvarMatriz();
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/escalas/e1/vinculos/${mes}`)).toEqual({ itens: [{ guarnicaoId: 'g2', turnoLetra: null }] }));
  });

  it('guarnição desativada só aparece vinculada, com a etiqueta', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g3', guarnicao: 'AR', ativaNoMes: false, turnoLetra: 'B' }] }] }));
    abrir('/escalas/e1');
    const linha = (await screen.findByLabelText('AR no turno B')).closest('tr')!;
    expect(screen.getByLabelText('AR no turno B')).toBeChecked();
    expect(within(linha).getByText('desativada')).toBeInTheDocument();
  });

  it('guarnição desativada sem vínculo não aparece na matriz', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByLabelText('ABT no turno A');
    expect(screen.queryByLabelText('AR no turno A')).toBeNull();
  });

  it('vínculo em letra que saiu da escala mostra o aviso', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g1', guarnicao: 'ABT', ativaNoMes: true, turnoLetra: 'C' }] }] }));
    abrir('/escalas/e1');
    expect(await screen.findByText('Turno C não existe mais nos serviços desta escala: ABT. Salve a matriz para tirá-los.')).toBeInTheDocument();
  });
});
