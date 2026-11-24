import type { Feriado } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava, responderConfirmacao } from './apoio';

const ano = new Date().getFullYear();
const feriado = (f: Partial<Feriado>): Feriado => ({ id: 'f1', data: `${ano}-04-21`, descricao: 'Tiradentes', fixo: true, unidadeSigla: '1ª SB', herdado: false, ...f });
const FERIADOS: Feriado[] = [
  feriado({ id: 'f0', data: `${ano}-02-17`, descricao: 'Carnaval', fixo: false }),
  feriado({}),
  feriado({ id: 'f2', data: `${ano}-09-07`, descricao: 'Independência do Brasil', unidadeSigla: 'CBMPE', herdado: true }),
];

function api(extra: Parameters<typeof simularApi>[0] = {}, feriados: Feriado[] = FERIADOS) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/feriados': { status: 200, corpo: feriados },
    ...extra,
  });
}
const linhaDe = async (texto: string) => (await screen.findByText(texto)).closest('li')!;

afterEach(() => vi.restoreAllMocks());

describe('feriados', () => {
  it('lista por data, com o dia da semana, e marca o feriado móvel', async () => {
    api();
    abrir('/feriados');
    const carnaval = await linhaDe('Carnaval');
    expect(within(carnaval).getByText('móvel')).toBeInTheDocument();
    expect(within(carnaval).getByText('17/02')).toBeInTheDocument();
    const ordem = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(ordem.findIndex((t) => t.includes('Carnaval'))).toBeLessThan(ordem.findIndex((t) => t.includes('Tiradentes')));
    expect(ordem.findIndex((t) => t.includes('Tiradentes'))).toBeLessThan(ordem.findIndex((t) => t.includes('Independência')));
  });

  it('feriado herdado mostra a sigla e não tem botão de editar nem de remover', async () => {
    api();
    abrir('/feriados');
    const herdado = await linhaDe('Independência do Brasil');
    expect(within(herdado).getByText('CBMPE')).toBeInTheDocument();
    expect(within(herdado).queryByRole('button')).toBeNull();
    const proprio = await linhaDe('Tiradentes');
    expect(within(proprio).getByRole('button', { name: 'Editar Tiradentes' })).toBeInTheDocument();
    expect(within(proprio).getByRole('button', { name: 'Remover Tiradentes' })).toBeInTheDocument();
  });

  it('copiar fixos envia o ano anterior e o atual e mostra quantos foram copiados', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/feriados/copiar-fixos': { status: 200, corpo: { copiados: 3 } } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: `Copiar feriados fixos de ${ano - 1}` }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/feriados/copiar-fixos')).toEqual({ de: ano - 1, para: ano }));
    expect(await screen.findByText('3 feriados copiados.')).toBeInTheDocument();
  });

  it('dois cliques seguidos em "Copiar feriados fixos" mandam um pedido só; o botão fica desabilitado enquanto copia', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'POST /api/unidades/u-1sb/feriados/copiar-fixos': { status: 200, corpo: { copiados: 3 }, espera } });
    abrir('/feriados');
    const botao = await screen.findByRole('button', { name: `Copiar feriados fixos de ${ano - 1}` });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(botao).toBeDisabled();
    soltar();
    expect(await screen.findByText('3 feriados copiados.')).toBeInTheDocument();
    expect(chamadasA(f, 'POST /api/unidades/u-1sb/feriados/copiar-fixos')).toBe(1);
    await waitFor(() => expect(botao).toBeEnabled());
  });

  it('copiar fixos de um em um e sem nada novo', async () => {
    api({ 'POST /api/unidades/u-1sb/feriados/copiar-fixos': { status: 200, corpo: { copiados: 1 } } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: `Copiar feriados fixos de ${ano - 1}` }));
    expect(await screen.findByText('1 feriado copiado.')).toBeInTheDocument();
  });

  it('copiar fixos sem novidade explica o motivo', async () => {
    api({ 'POST /api/unidades/u-1sb/feriados/copiar-fixos': { status: 200, corpo: { copiados: 0 } } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: `Copiar feriados fixos de ${ano - 1}` }));
    expect(await screen.findByText(`Nenhum feriado novo: os fixos de ${ano - 1} já estão em ${ano}, ou não há nenhum.`)).toBeInTheDocument();
  });

  it('novo feriado envia a data, a descrição e fixo marcado por padrão', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/feriados': { status: 201, corpo: feriado({ id: 'f9' }) } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${ano}-11-15` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Proclamação da República');
    expect(within(dialogo).getByLabelText('Cai no mesmo dia todo ano')).toBeChecked();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/feriados')).toEqual({ data: `${ano}-11-15`, descricao: 'Proclamação da República', fixo: true }),
    );
  });

  it('desmarcar a caixa envia fixo falso (feriado móvel)', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/feriados': { status: 201, corpo: feriado({ id: 'f9' }) } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${ano}-04-03` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Paixão de Cristo');
    await userEvent.click(within(dialogo).getByLabelText('Cai no mesmo dia todo ano'));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/feriados')).toMatchObject({ fixo: false }));
  });

  it('a mensagem da API aparece no diálogo', async () => {
    api({ 'POST /api/unidades/u-1sb/feriados': { status: 409, corpo: { erro: 'Já existe um feriado nesta data: "Tiradentes".' } } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${ano}-04-21` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Outro');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Já existe um feriado nesta data');
  });

  it('a mensagem do campo que a API recusou aparece no diálogo (nada fica sem explicação)', async () => {
    api({ 'POST /api/unidades/u-1sb/feriados': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { descricao: 'Use no máximo 120 caracteres.' } } } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${ano}-04-21` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Algo');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Confira os campos destacados. Use no máximo 120 caracteres.');
  });

  it('a descrição não passa de 120 caracteres na tela', async () => {
    api();
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    expect(within(await screen.findByRole('dialog')).getByLabelText('Descrição')).toHaveAttribute('maxLength', '120');
  });

  it('editar envia a data, a descrição e fixo', async () => {
    const f = api({ 'PATCH /api/feriados/f1': { status: 200, corpo: feriado({ descricao: 'Dia de Tiradentes' }) } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Tiradentes' }));
    const dialogo = await screen.findByRole('dialog');
    const campo = within(dialogo).getByLabelText('Descrição');
    expect(campo).toHaveValue('Tiradentes');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Dia de Tiradentes');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/feriados/f1')).toEqual({ data: `${ano}-04-21`, descricao: 'Dia de Tiradentes', fixo: true }));
  });

  it('remover pergunta antes e apaga', async () => {
    const f = api({ 'DELETE /api/feriados/f1': { status: 204 } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Tiradentes' }));
    expect(await screen.findByRole('dialog', { name: 'Remover o feriado?' })).toHaveTextContent('Tiradentes (21/04).');
    await responderConfirmacao('Remover');
    await waitFor(() => expect(f.mock.calls.some(([e, i]) => String(e).includes('/api/feriados/f1') && i?.method === 'DELETE')).toBe(true));
  });

  it('trocar o ano busca os feriados do ano escolhido', async () => {
    const f = api();
    abrir('/feriados');
    const campo = await screen.findByLabelText('Ano');
    expect(campo).toHaveValue(String(ano));
    fireEvent.change(campo, { target: { value: String(ano + 1) } });
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`ano=${ano + 1}`))).toBe(true));
  });

  it('ano sem feriados mostra o convite', async () => {
    api({}, []);
    abrir('/feriados');
    expect(await screen.findByText(new RegExp(`Nenhum feriado em ${ano}`))).toBeInTheDocument();
  });

  it('a tela traz o botão de importar da planilha', async () => {
    api();
    abrir('/feriados');
    expect(await screen.findByRole('button', { name: 'Importar' })).toBeInTheDocument();
  });
});

describe('feriados: herdado e outro ano', () => {
  it('o selo do herdado explica para o leitor de tela', async () => {
    api();
    abrir('/feriados');
    const herdado = await linhaDe('Independência do Brasil');
    expect(within(herdado).getByText('cadastrado em CBMPE; não se edita aqui')).toHaveClass('sr-only');
  });

  it('salvar feriado de outro ano mostra esse ano', async () => {
    const proximo = ano + 1;
    const novo = feriado({ id: 'f9', data: `${proximo}-01-01`, descricao: 'Confraternização' });
    const rotas: Parameters<typeof simularApi>[0] = {
      'POST /api/unidades/u-1sb/feriados': { status: 201, corpo: novo },
    };
    const f = api(rotas);
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${proximo}-01-01` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Confraternização');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/feriados')).toMatchObject({ data: `${proximo}-01-01` }));
    expect(await screen.findByText(`Feriado salvo em ${proximo}.`)).toBeInTheDocument();
    expect(screen.getByLabelText('Ano')).toHaveValue(String(proximo));
  });

  it('salvar feriado do mesmo ano não troca o ano nem avisa', async () => {
    api({ 'POST /api/unidades/u-1sb/feriados': { status: 201, corpo: feriado({ id: 'f9', data: `${ano}-11-15` }) } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Data'), { target: { value: `${ano}-11-15` } });
    await userEvent.type(within(dialogo).getByLabelText('Descrição'), 'Proclamação');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(/Feriado salvo em/)).toBeNull();
    expect(screen.getByLabelText('Ano')).toHaveValue(String(ano));
  });
});
