import type { Servico } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { textoDuracao } from '@/lib/turnos';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava, responderConfirmacao } from './apoio';

const servico = (s: Partial<Servico>): Servico => ({
  id: 's1', nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B', tiraDoExpediente: false, ativo: true, fixo: false, turnos: [], ...s,
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
  it('a tela se chama Turnos (o endereço continua /servicos)', async () => {
    api();
    abrir('/servicos');
    expect(await screen.findByRole('heading', { level: 1, name: 'Turnos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Serviços' })).toBeNull();
  });

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
    // a letra fica num span dentro do segmento, que leva a posição
    const a = within(regua).getByText('A').parentElement!;
    const b = within(regua).getByText('B').parentElement!;
    expect(a).toHaveStyle({ left: '25%', width: '37.5%' });
    expect(b).toHaveStyle({ left: '62.5%', width: '37.5%' });
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('D+1')).toBeInTheDocument();
    expect(screen.queryByText('dia seguinte')).toBeNull();
  });

  it('revisão: o início e o fim do dia têm linha vinho cheia, mesmo sem D+1', async () => {
    api();
    abrir('/servicos/s3');
    await screen.findByRole('img', { name: /Turnos do dia/ });
    const linhas = [...document.querySelectorAll('[data-limite-do-dia]')];
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveStyle({ left: '0%' });
    expect(linhas[1]).toHaveStyle({ left: '100%' });
    for (const l of linhas) {
      expect(l).toHaveClass('bg-vinho');
      expect(l).not.toHaveClass('border-dashed');
    }
  });

  it('revisão: com D+1 a linha do fim do dia fica nas 24h', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(document.querySelectorAll('[data-limite-do-dia]')[1]).toHaveStyle({ left: '75%' });
  });

  it('revisão: passar o mouse num turno mostra os horários dele', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    const regua = await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(screen.queryByRole('tooltip')).toBeNull();
    const b = within(regua).getByText('B').parentElement!;
    await userEvent.hover(b);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Turno B, das 20h às 08h');
    await userEvent.unhover(b);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('revisão: o D+1 não quebra nem sai da régua quando o turno passa pouco da meia-noite', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '18:00', '02:00']]) } });
    abrir('/servicos/s3');
    const legenda = await screen.findByText('D+1');
    expect(legenda).toHaveClass('whitespace-nowrap');
    expect(legenda).toHaveClass('right-0');
  });

  it('revisão: com bastante D+1 o D e o D+1 ficam centrados embaixo do seu trecho', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    const legenda = await screen.findByText('D+1');
    expect(legenda).toHaveClass('whitespace-nowrap');
    expect(legenda).not.toHaveClass('right-0');
    // Pronto vai até 32h: o D+1 (24h a 32h) centra em 87,5%; o D (0h a 24h) em 37,5%
    expect(legenda).toHaveStyle({ left: '87.5%' });
    expect(screen.getByText('D')).toHaveStyle({ left: '37.5%' });
  });

  it('revisão: só o último rótulo que está no fim da régua fica alinhado à direita', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: PRONTO } });
    abrir('/servicos/s3');
    // Pronto vai até 32h: a última marca (30h, "06h") fica centrada, não deslocada para a esquerda
    const marca = (await screen.findAllByText('06h')).at(-1)!;
    expect(marca).toHaveClass('-translate-x-1/2');
    expect(marca).not.toHaveClass('last:-translate-x-full');
  });

  it('revisão: no dia de 24h o rótulo 24h fica alinhado ao fim da régua', async () => {
    api();
    abrir('/servicos/s3');
    expect(await screen.findByText('24h')).toHaveClass('-translate-x-full');
  });

  it('régua sem turno que passe da meia-noite não mostra D nem D+1', async () => {
    api();
    abrir('/servicos/s3');
    await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(screen.queryByText('D')).toBeNull();
    expect(screen.queryByText('D+1')).toBeNull();
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
      expect(corpoEnviado(f, 'PATCH /api/servicos/s3')).toEqual({ nome: 'Bioma', tipo: 'pjes', operacao: null, rotuloImpressao: null, cor: '#C08A1E', tiraDoExpediente: false }),
    );
  });

  it('6.37: a opção "Pode tirar o militar do ADM do expediente" vem com a ajuda, mostra o que está gravado e grava ao ligar', async () => {
    const f = api({ 'PATCH /api/servicos/s3': { status: 200, corpo: { ...BIOMA, tiraDoExpediente: true } } });
    abrir('/servicos/s3');
    const opcao = await screen.findByRole('checkbox', { name: 'Pode tirar o militar do ADM do expediente' });
    expect(opcao).not.toBeChecked();
    expect(screen.getByText('Ligada: lançar este serviço no horário do expediente tira o militar do expediente do dia, depois de confirmar. Desligada: é choque.')).toBeInTheDocument();
    await userEvent.click(opcao);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/servicos/s3')).toMatchObject({ tiraDoExpediente: true }));
  });

  it('6.37: o Saldo, que vem ligado, aparece marcado', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: servico({ id: 's3', nome: 'Saldo', tiraDoExpediente: true, fixo: true }) } });
    abrir('/servicos/s3');
    expect(await screen.findByRole('checkbox', { name: 'Pode tirar o militar do ADM do expediente' })).toBeChecked();
  });

  it('remover turno pede à API e mostra o erro dela', async () => {
    api({ 'DELETE /api/turnos/t1': { status: 409, corpo: { erro: 'O turno A de Bioma já tem militares escalados. Ele pode mudar de horário, mas não pode ser removido.' } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover turno A' }));
    await responderConfirmacao('Remover');
    expect(await screen.findByRole('status')).toHaveTextContent('já tem militares escalados');
  });

  it('desativar envia ativo false', async () => {
    const f = api({ 'POST /api/servicos/s3/situacao': { status: 200, corpo: { ...BIOMA, ativo: false } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await responderConfirmacao('Desativar');
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
    await responderConfirmacao('Desativar');
    await waitFor(() => expect(screen.getByLabelText('Tipo')).toHaveValue('pjes'));
  });
});

describe('ficha do serviço em painel único', () => {
  it('o resumo do serviço diz tipo, operação e turnos', async () => {
    api();
    abrir('/servicos/s3');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Bioma' })).closest('[data-ficha]') as HTMLElement;
    expect(within(ficha).getByText('Diária da operação Guardiões do Bioma, 1 turno.')).toBeInTheDocument();
  });

  it('o resumo do serviço sem turnos', async () => {
    api({ 'GET /api/servicos/s2': { status: 200, corpo: LISTA[1] } });
    abrir('/servicos/s2');
    expect(await screen.findByText('PJES, sem turnos.')).toBeInTheDocument();
  });

  it('serviço ativo não diz Desativado', async () => {
    api();
    abrir('/servicos/s3');
    await screen.findByRole('heading', { level: 2, name: 'Bioma' });
    expect(screen.queryByText(/Desativado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
  });

  it('Desativar pergunta e, confirmando, desativa', async () => {
    const f = api({ 'POST /api/servicos/s3/situacao': { status: 200, corpo: { ...BIOMA, ativo: false } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByRole('dialog', { name: 'Desativar o serviço?' })).toHaveTextContent('Bioma some da lista e continua nas escalas que já o reúnem.');
    await responderConfirmacao('Desativar');
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/servicos/s3/situacao')).toEqual({ ativo: false }));
  });

  it('cancelando a pergunta, nada é enviado', async () => {
    const f = api({ 'POST /api/servicos/s3/situacao': { status: 200, corpo: { ...BIOMA, ativo: false } } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await responderConfirmacao('Cancelar');
    expect(f.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('serviço desativado mostra a etiqueta e Reativar, sem perguntar', async () => {
    const f = api({
      'GET /api/servicos/s3': { status: 200, corpo: { ...BIOMA, ativo: false } },
      'POST /api/servicos/s3/situacao': { status: 200, corpo: BIOMA },
    });
    abrir('/servicos/s3');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Bioma' })).closest('[data-ficha]') as HTMLElement;
    expect(within(ficha).getByText('desativado')).toBeInTheDocument();
    await userEvent.click(within(ficha).getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/servicos/s3/situacao')).toEqual({ ativo: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o item aberto na lista fica marcado', async () => {
    api();
    abrir('/servicos/s3');
    const link = (await screen.findAllByText('Bioma')).map((e) => e.closest('a')).find(Boolean)!;
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('shadow-[inset_3px_0_0');
  });

  it('todos desativados, a lista explica o que marcar', async () => {
    api({ 'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: LISTA.map((s) => ({ ...s, ativo: false })) } });
    abrir('/servicos');
    expect(await screen.findByText('Todos os serviços estão desativados. Marque "Mostrar desativados" para vê-los.')).toBeInTheDocument();
  });
});

describe('remover turno', () => {
  it('remover turno pergunta e, cancelando, não envia', async () => {
    const f = api({ 'DELETE /api/turnos/t1': { status: 200, corpo: BIOMA } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover turno A' }));
    expect(await screen.findByRole('dialog', { name: 'Remover o turno?' })).toHaveTextContent('Turno A (00h–08h) de Bioma.');
    await responderConfirmacao('Cancelar');
    expect(f.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });
});

describe('sobreposição: frases', () => {
  const comTurnos = (turnos: [string, string, string][]) =>
    servico({ id: 's3', nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E', turnos: turnos.map(([letra, inicio, fim], i) => ({ id: `t${i}`, letra: letra as 'A', inicio, fim, duracaoMinutos: 0, turnosPadrao: [] })) });

  it('um turno de 24h com um que cruza a meia-noite diz só o trecho que se sobrepõe', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '08:00', '08:00'], ['B', '20:00', '08:00']]) } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem das 20h às 08h.')).toBeInTheDocument();
  });

  it('um turno de 24h inteiro com um que cruza a meia-noite junta os dois lados da meia-noite', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '00:00', '00:00'], ['B', '20:00', '08:00']]) } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem das 20h às 08h.')).toBeInTheDocument();
  });

  it('dois turnos de 24h com horários diferentes dizem o dia todo', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '00:00', '00:00'], ['B', '12:00', '12:00']]) } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Os turnos A e B se sobrepõem o dia todo.')).toBeInTheDocument();
  });
});

describe('régua e seletor de cor', () => {
  const comTurnos = (turnos: [string, string, string][]) =>
    servico({ id: 's3', nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E', turnos: turnos.map(([letra, inicio, fim], i) => ({ id: `t${i}`, letra: letra as 'A', inicio, fim, duracaoMinutos: 0, turnosPadrao: [] })) });

  it('as marcas da régua têm sempre duas casas', async () => {
    api();
    abrir('/servicos/s3');
    const regua = (await screen.findByRole('img', { name: /Turnos do dia/ })).closest('div.mb-4') as HTMLElement;
    for (const h of ['00h', '06h', '12h', '18h', '24h']) expect(within(regua).getByText(h)).toBeInTheDocument();
    expect(within(regua).queryByText('0h')).toBeNull();
    expect(within(regua).queryByText('6h')).toBeNull();
  });

  it('turno de uma hora não mostra a letra na régua, e continua no nome acessível', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['A', '08:00', '09:00'], ['B', '12:00', '20:00']]) } });
    abrir('/servicos/s3');
    const regua = await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(regua).toHaveAccessibleName(/A das 08h às 09h/);
    expect(within(regua).queryByText('A')).toBeNull();
    expect(within(regua).getByText('B')).toBeInTheDocument();
  });

  it('a letra fica acima da linha da meia-noite', async () => {
    api({ 'GET /api/servicos/s3': { status: 200, corpo: comTurnos([['B', '20:00', '08:00']]) } });
    abrir('/servicos/s3');
    const regua = await screen.findByRole('img', { name: /Turnos do dia/ });
    expect(within(regua).getByText('B').className).toContain('z-20');
    expect(regua.parentElement!.querySelectorAll('[data-limite-do-dia]')[1]!.className).toContain('z-10');
  });

  it('o gatilho anuncia a cor atual', async () => {
    api();
    abrir('/servicos/s3');
    expect(await screen.findByRole('button', { name: 'Cor: #C08A1E' })).toBeInTheDocument();
  });

  it('o seletor nativo aplica a cor sem Usar esta cor, e o painel continua aberto', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    fireEvent.change(await screen.findByLabelText('Escolher no seletor do navegador'), { target: { value: '#112233' } });
    expect(await screen.findByRole('button', { name: 'Cor: #112233' })).toBeInTheDocument();
    expect(screen.getByLabelText('Código da cor')).toBeInTheDocument();
  });

  it('a grade de cores tem uma parada de Tab e anda pelas setas', async () => {
    api();
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Cor: #C08A1E' }));
    const celulas = await screen.findAllByRole('button', { name: /^Cor #/ });
    expect(celulas).toHaveLength(80);
    expect(celulas.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(celulas[0]).toHaveAttribute('tabindex', '0');
    celulas[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(celulas[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(celulas[11]).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(celulas[0]).toHaveFocus();
    expect(celulas.filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('o serviço mostra as escalas que o reúnem', async () => {
    api({
      'GET /api/unidades/u-1sb/escalas': {
        status: 200,
        corpo: [
          { id: 'e1', nome: 'Guardiões do Bioma', ativa: true, servicos: ['Bioma'] },
          { id: 'e2', nome: 'Ordinário', ativa: true, servicos: ['Pronto', 'JES'] },
        ],
      },
    });
    abrir('/servicos/s3');
    const link = await screen.findByRole('link', { name: 'Guardiões do Bioma' });
    expect(link).toHaveAttribute('href', '/escalas/e1');
    expect(screen.queryByRole('link', { name: 'Ordinário' })).toBeNull();
  });

  it('serviço que nenhuma escala reúne diz isso', async () => {
    api({ 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [{ id: 'e2', nome: 'Ordinário', ativa: true, servicos: ['Pronto'] }] } });
    abrir('/servicos/s3');
    expect(await screen.findByText('Ainda não está em nenhuma escala.')).toBeInTheDocument();
  });
});

describe('revisão 3: Salvar do turno sem clique duplo', () => {
  it('turno novo com dois cliques manda um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'POST /api/servicos/s3/turnos': { status: 201, corpo: BIOMA, espera } });
    abrir('/servicos/s3');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir turno' }));
    const salvar = screen.getByRole('button', { name: 'Salvar turno novo' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    expect(salvar).toBeDisabled();
    soltar();
    await waitFor(() => expect(chamadasA(f, 'POST /api/servicos/s3/turnos')).toBe(1));
  });

  it('turno existente com dois cliques manda um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'PATCH /api/turnos/t1': { status: 200, corpo: BIOMA, espera } });
    abrir('/servicos/s3');
    fireEvent.change(await screen.findByLabelText('Fim do turno A'), { target: { value: '09:00' } });
    const salvar = screen.getByRole('button', { name: 'Salvar turno A' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    soltar();
    await waitFor(() => expect(chamadasA(f, 'PATCH /api/turnos/t1')).toBe(1));
  });
});

describe('revisão 3: o erro de Desativar fica na ficha em que aconteceu', () => {
  it('serviço: voltar a outro serviço que já estava no cache não traz o erro do anterior', async () => {
    api({ 'GET /api/servicos/s1': { status: 200, corpo: LISTA[0] }, 'POST /api/servicos/s3/situacao': { status: 409, corpo: { erro: 'Falhou ao desativar Bioma.' } } });
    const router = abrir('/servicos/s1');
    await screen.findByRole('heading', { name: 'Pronto' });
    await act(() => router.navigate({ to: '/servicos/$id', params: { id: 's3' } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await responderConfirmacao('Desativar');
    expect(await screen.findByText('Falhou ao desativar Bioma.')).toBeInTheDocument();
    await act(() => router.navigate({ to: '/servicos/$id', params: { id: 's1' } }));
    await screen.findByRole('heading', { name: 'Pronto' });
    expect(screen.queryByText('Falhou ao desativar Bioma.')).toBeNull();
  });
});

describe('serviços fixos', () => {
  const FIXO = servico({ id: 's5', nome: 'Saldo', fixo: true, cor: '#2B7BB9' });
  const comFixo = () => api({ 'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [...LISTA, FIXO] }, 'GET /api/servicos/s5': { status: 200, corpo: FIXO } });

  it('na ficha de um fixo, nome e tipo ficam travados, com a explicação, e não há "Desativar"', async () => {
    comFixo();
    abrir('/servicos/s5');
    expect(await screen.findByLabelText('Nome')).toBeDisabled();
    expect(screen.getByLabelText('Tipo')).toBeDisabled();
    expect(screen.getByText('Serviço fixo do sistema: o nome e o tipo não mudam.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
    expect(screen.getByLabelText('Cor')).toBeInTheDocument();
  });

  it('na lista, o item fixo mostra a marca "fixo" e os outros não', async () => {
    comFixo();
    abrir('/servicos');
    expect((await screen.findByText('Saldo')).closest('li')).toHaveTextContent('fixo');
    expect(screen.getByText('Bioma').closest('li')).not.toHaveTextContent('fixo');
  });

  it('num serviço comum tudo segue editável, com o botão "Desativar"', async () => {
    api();
    abrir('/servicos/s3');
    expect(await screen.findByLabelText('Nome')).toBeEnabled();
    expect(screen.getByLabelText('Tipo')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    expect(screen.queryByText(/Serviço fixo do sistema/)).toBeNull();
  });
});
