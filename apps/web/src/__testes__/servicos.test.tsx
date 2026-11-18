import type { Servico } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { textoDuracao } from '@/lib/turnos';
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

  it('turno não mostra "Pede voluntariado em"', async () => {
    api();
    abrir('/servicos/s3');
    await screen.findByLabelText('Início do turno A');
    expect(screen.queryByText(/Pede voluntariado/)).toBeNull();
  });

  it('duração aparece no bloco com a cor do serviço', async () => {
    api();
    abrir('/servicos/s3');
    const linha = (await screen.findByLabelText('Início do turno A')).closest('li')!;
    const bloco = within(linha).getByText('8h');
    expect(bloco).toHaveStyle({ backgroundColor: 'rgb(192, 138, 30)' });
  });

  it('turno das 16h às 00h mostra a duração de 8h', async () => {
    const f = api({ 'POST /api/servicos/s3/turnos': { status: 201, corpo: BIOMA } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir turno' }));
    fireEvent.change(screen.getByLabelText('Letra do turno novo'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Início do turno novo'), { target: { value: '16:00' } });
    fireEvent.change(screen.getByLabelText('Fim do turno novo'), { target: { value: '00:00' } });
    const linha = screen.getByLabelText('Início do turno novo').closest('li')!;
    expect(within(linha).getByText('8h')).toBeInTheDocument();
    await userEvent.click(within(linha).getByRole('button', { name: 'Salvar turno novo' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/servicos/s3/turnos')).toEqual({ letra: 'C', inicio: '16:00', fim: '00:00' }));
  });

  it('horário incompleto mostra traço', async () => {
    api();
    abrir('/servicos/s3');
    const inicio = await screen.findByLabelText('Início do turno A');
    fireEvent.change(inicio, { target: { value: '' } });
    expect(within(inicio.closest('li')!).getByText('—')).toBeInTheDocument();
  });

  it('régua descreve os turnos do dia', async () => {
    api();
    abrir('/servicos/s3');
    expect(await screen.findByRole('img', { name: 'Turnos do dia: A das 00h às 08h' })).toBeInTheDocument();
  });

  const PRONTO = servico({
    id: 's3', nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E',
    turnos: [
      { id: 't1', letra: 'A', inicio: '08:00', fim: '20:00', duracaoMinutos: 720, turnosPadrao: [] },
      { id: 't2', letra: 'B', inicio: '20:00', fim: '08:00', duracaoMinutos: 720, turnosPadrao: [] },
    ],
  });
  const comTurnos = (turnos: [string, string, string][]) =>
    servico({ id: 's3', nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E', turnos: turnos.map(([letra, inicio, fim], i) => ({ id: `t${i}`, letra: letra as 'A', inicio, fim, duracaoMinutos: 0, turnosPadrao: [] })) });

  it('régua mostra o B até o dia seguinte', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    const regua = await screen.findByRole('img', { name: /Turnos do dia/ });
    const a = within(regua).getByText('A');
    const b = within(regua).getByText('B');
    expect(a).toHaveStyle({ left: '25%', width: '37.5%' });
    expect(b).toHaveStyle({ left: '62.5%', width: '37.5%' });
    expect(screen.getByText('dia seguinte')).toBeInTheDocument();
  });

  it('revisão: a legenda do dia seguinte não quebra nem sai da régua quando o turno passa pouco da meia-noite', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '18:00', '02:00']]) } });
    abrir('/servicos/s3');
    const legenda = await screen.findByText('dia seguinte');
    expect(legenda).toHaveClass('whitespace-nowrap');
    expect(legenda).toHaveClass('right-0');
  });

  it('revisão: com bastante dia seguinte a legenda fica ao lado da linha da meia-noite', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    const legenda = await screen.findByText('dia seguinte');
    expect(legenda).toHaveClass('whitespace-nowrap');
    expect(legenda).not.toHaveClass('right-0');
  });

  it('revisão: só o último rótulo que está no fim da régua fica alinhado à direita', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    // Pronto vai até 32h: a última marca (30h, "06h") fica centrada, não deslocada para a esquerda
    const marca = await screen.findByText('06h');
    expect(marca).toHaveClass('-translate-x-1/2');
    expect(marca).not.toHaveClass('last:-translate-x-full');
  });

  it('revisão: no dia de 24h o rótulo 24h fica alinhado ao fim da régua', async () => {
    api();
    abrir('/servicos/s3');
    expect(await screen.findByText('24h')).toHaveClass('-translate-x-full');
  });

  it('régua sem turno que passe da meia-noite não mostra dia seguinte', async () => {
    api();
    abrir('/servicos/s3');
    await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(screen.queryByText('dia seguinte')).toBeNull();
  });

  it('sobreposição atravessando a meia-noite sai num trecho só', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '20:00', '08:00'], ['B', '22:00', '10:00']]) } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem das 22h às 08h.')).toBeInTheDocument();
  });

  it('dois turnos de 24h sobrepostos dizem o dia todo', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '08:00', '08:00'], ['B', '08:00', '08:00']]) } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem o dia todo.')).toBeInTheDocument();
  });

  it('sobreposição aparece em texto', async () => {
    const SOBREPOE = servico({
      id: 's3', nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E',
      turnos: [
        { id: 't1', letra: 'A', inicio: '07:00', fim: '19:00', duracaoMinutos: 720, turnosPadrao: [] },
        { id: 't2', letra: 'B', inicio: '18:00', fim: '08:00', duracaoMinutos: 840, turnosPadrao: [] },
      ],
    });
    api({ 'GET /api/servicos/s3': { status: 200, corpo: SOBREPOE } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem das 07h às 08h e das 18h às 19h.')).toBeInTheDocument();
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
  it('revisão: a identificação recarrega quando o serviço muda no servidor', async () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: LISTA },
      'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
      'POST /api/servicos/s3/situacao': { status: 200, corpo: BIOMA },
    };
    simularApi(rotas);
    abrir('/servicos/s3');
    expect(await screen.findByLabelText('Tipo')).toHaveValue('diaria');
    // outra gravação (ex.: importação) muda o serviço; a ficha volta a buscar
    rotas['GET /api/servicos/s3'] = { status: 200, corpo: { ...BIOMA, tipo: 'pjes', operacao: null } };
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(screen.getByLabelText('Tipo')).toHaveValue('pjes'));
  });
});
