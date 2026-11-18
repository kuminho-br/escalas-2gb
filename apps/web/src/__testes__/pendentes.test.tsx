import type { Escala, LinhaEscala, LinhaGuarnicao, Servico } from 'contratos';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_PENDENTE } from '@/componentes/AlteracoesPendentes';
import { mesAtual } from '@/lib/meses';
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

  it('revisão: sair do sistema com alteração pendente pergunta antes de encerrar a sessão', async () => {
    const f = simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
      'GET /api/escalas/e1': { status: 200, corpo: escala({}) },
      '/api/auth/sign-out': { status: 200, corpo: { success: true } },
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await trocarTitulo();
    await userEvent.click(await screen.findByRole('button', { name: /SD BM ANDRADE/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
    const chamouSaida = f.mock.calls.some(([e]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : (e as Request).url).includes('sign-out'));
    expect(chamouSaida).toBe(false);
    expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA DO ORDINÁRIO');
  });

  it('revisão: salvar um turno não descarta a edição pendente de outro', async () => {
    const DOIS: Servico = {
      ...BIOMA,
      turnos: [
        { id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [] },
        { id: 't2', letra: 'B', inicio: '08:00', fim: '16:00', duracaoMinutos: 480, turnosPadrao: [] },
      ],
    };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [DOIS] },
      'GET /api/servicos/s3': { status: 200, corpo: DOIS },
      'PATCH /api/turnos/t1': { status: 200, corpo: DOIS },
    };
    simularApi(rotas);
    abrir('/servicos/s3');
    fireEvent.change(await screen.findByLabelText('Início do turno B'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Início do turno A'), { target: { value: '01:00' } });
    // o servidor passa a devolver o turno A gravado
    rotas['GET /api/servicos/s3'] = { status: 200, corpo: { ...DOIS, turnos: [{ ...DOIS.turnos[0]!, inicio: '01:00' }, DOIS.turnos[1]!] } };
    await userEvent.click(screen.getByRole('button', { name: 'Salvar turno A' }));
    await waitFor(() => expect(screen.getByLabelText('Início do turno A')).toHaveValue('01:00'));
    expect(screen.getByLabelText('Início do turno B')).toHaveValue('09:00');
  });

  it('revisão: salvar os serviços da escala não descarta as marcações da matriz', async () => {
    const mes = mesAtual();
    const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto'] };
    const NOITE = { inicio: '20:00', fim: '08:00', letras: ['B' as const], servicos: ['Pronto'] };
    const g: LinhaGuarnicao = { id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [g] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'GET /api/escalas/e1': { status: 200, corpo: escala({ faixas: [DIA, NOITE] }) },
      'PUT /api/escalas/e1/servicos': { status: 200, corpo: escala({}) },
    };
    simularApi(rotas);
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    // salvar os serviços muda as faixas que o servidor devolve
    rotas['GET /api/escalas/e1'] = { status: 200, corpo: escala({ faixas: [DIA] }) };
    await userEvent.click(screen.getByRole('button', { name: 'Salvar serviços' }));
    await waitFor(() => expect(screen.queryByLabelText('ABT em B (20h–08h)')).toBeNull());
    expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked();
    expect(mes).toBeTruthy();
  });

  it('revisão: trocar de versão com marcações pendentes pergunta e fica ao cancelar', async () => {
    const mes = mesAtual();
    const proximo = `${Number(mes.slice(0, 4)) + 1}-01`;
    const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto'] };
    const g: LinhaGuarnicao = { id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null };
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [g] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'GET /api/escalas/e1': {
        status: 200,
        corpo: escala({ faixas: [DIA], vinculos: [{ vigencia: proximo, itens: [] }, { vigencia: mes, itens: [] }] }),
      },
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`janeiro de ${proximo.slice(0, 4)}`) }));
    expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE);
    expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked();
  });
});
