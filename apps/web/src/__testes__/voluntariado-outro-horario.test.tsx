import type { FaixaDeDisponibilidade, MilitarDoVoluntariado, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { somarMeses } from 'contratos';
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { diasDoMes } from 'dominio';
import { mesAtual } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Cenário fictício: o militar ANDRADE (m3) e os blocos de sempre (00–08, 08–16, 16–20, 20–24). O mês é o seguinte ao atual.
const MES = somarMeses(mesAtual(), 1);
const militar = (id: string, nomeGuerra: string, extra: Partial<MilitarDoVoluntariado> = {}): MilitarDoVoluntariado => ({
  militarId: id, posto: 'SD', nomeGuerra, matricula: `99002${id.slice(1)}-1`, equipe: 'Alfa', jornada: 'pronto', voluntarioJes: true, lancado: false, horas: 0, dias: 0, peloMilitar: false, correcoes: 0, ...extra,
});
const LISTA: VoluntariadoDoMes = { mes: MES, coletaAberta: false, militares: [militar('m3', 'ANDRADE')] };
const BLOCOS = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }, { inicio: '20:00', fim: '24:00' }];
const doMilitar = (extra: Partial<VoluntariadoDoMilitar> = {}): VoluntariadoDoMilitar => ({ militarId: 'm3', mes: MES, faixas: [], doMesAnterior: [], blocos: BLOCOS, folgas: null, ...extra });
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const faixa = (data: string, inicio: string, fim: string): FaixaDeDisponibilidade => ({ data, inicio, fim });

function api(extra: Parameters<typeof simularApi>[0] = {}, dados: VoluntariadoDoMilitar = doMilitar()) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/voluntariado/${MES}`]: { status: 200, corpo: LISTA },
    [`GET /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: dados },
    [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: LISTA },
    ...extra,
  });
}
const calendario = () => screen.getByRole('group', { name: 'Calendário do voluntariado' });
const celaDoDia = (n: number) => calendario().querySelector<HTMLElement>(`[data-linha-do-dia="${dia(n)}"]`)!;
const botaoDoDia = (n: number) => within(celaDoDia(n)).getByRole('button', { name: `Outro horário do dia ${n}` });
const bloco = (n: number, de: string, ate: string) => within(celaDoDia(n)).getByRole('button', { name: `Dia ${n}, ${de} às ${ate}` });
const salvar = () => screen.getByRole('button', { name: 'Salvar e ir para o próximo' });
const abrirOPainel = async (n: number) => {
  await userEvent.click(botaoDoDia(n));
  return within(await screen.findByRole('dialog', { name: `Horários extras do dia ${n}` }));
};
async function preencher(painel: ReturnType<typeof within>, linha: number, inicio: string, fim: string) {
  const i = painel.getByLabelText(`Início do horário ${linha}`);
  const f = painel.getByLabelText(`Fim do horário ${linha}`);
  await userEvent.clear(i);
  await userEvent.type(i, inicio);
  await userEvent.clear(f);
  await userEvent.type(f, fim);
}
const abrirOMilitar = async () => {
  abrir('/voluntariado?militar=m3');
  await screen.findByRole('heading', { name: 'SD ANDRADE' });
};

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
});

describe('o botão do dia: "Outro horário" (7.2)', () => {
  it('cada dia do mês tem o botão, depois do número do dia (do lado oposto)', async () => {
    api();
    await abrirOMilitar();
    expect(within(calendario()).getAllByRole('button', { name: /^Outro horário do dia / })).toHaveLength(diasDoMes(MES).length);
    const numero = within(celaDoDia(5)).getByRole('button', { name: /^Dia 5: / });
    expect(numero.compareDocumentPosition(botaoDoDia(5)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('abre um painel com "Adicionar horário"; cada horário tem "das" e "às" e se pode tirar', async () => {
    api();
    await abrirOMilitar();
    const painel = await abrirOPainel(5);
    expect(painel.getByText(/Nenhum horário fora dos blocos/)).toBeInTheDocument();
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    expect(painel.getByLabelText('Início do horário 1')).toBeInTheDocument();
    expect(painel.getByLabelText('Fim do horário 1')).toBeInTheDocument();
    expect(painel.getByText('das')).toBeInTheDocument();
    expect(painel.getByText('às')).toBeInTheDocument();
    await userEvent.click(painel.getByRole('button', { name: 'Tirar o horário 1' }));
    expect(painel.queryByLabelText('Início do horário 1')).toBeNull();
  });

  it('o horário marcado aparece no dia como texto, o bloco que ele toca fica parcial, e o salvar manda a faixa', async () => {
    const f = api();
    await abrirOMilitar();
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await preencher(painel, 1, '09:30', '11:00');
    expect(within(celaDoDia(5)).getByText('09:30 às 11:00')).toBeInTheDocument();
    expect(bloco(5, '08h', '16h')).toHaveAttribute('data-estado', 'parcial');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '09:30', '11:00')] }));
  });

  it('Review Focus 2: a faixa fora dos blocos já gravada aparece no dia e não some ao salvar outra mudança', async () => {
    const f = api({}, doMilitar({ faixas: [faixa(dia(12), '09:30', '11:00')] }));
    await abrirOMilitar();
    expect(within(celaDoDia(12)).getByText('09:30 às 11:00')).toBeInTheDocument();
    await userEvent.click(bloco(5, '20h', '24h'));
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '20:00', '24:00'), faixa(dia(12), '09:30', '11:00')] }));
  });

  it('um horário que é exatamente um bloco vira o bloco marcado, sem linha de texto repetida', async () => {
    api();
    await abrirOMilitar();
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await preencher(painel, 1, '08:00', '16:00');
    expect(bloco(5, '08h', '16h')).toHaveAttribute('data-estado', 'cheio');
    expect(within(celaDoDia(5)).queryByText('08:00 às 16:00')).toBeNull();
  });

  it('Review Focus 3: um horário que encosta ou cobre um bloco marcado não duplica: o dia mostra a união e o salvar manda uma faixa só', async () => {
    const f = api();
    await abrirOMilitar();
    await userEvent.click(bloco(5, '08h', '16h'));
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    // 07:00 às 09:00 pega o começo do bloco marcado; 15:00 às 18:00 pega o fim e passa dele
    await preencher(painel, 1, '07:00', '09:00');
    expect(within(celaDoDia(5)).getByText('07:00 às 16:00')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '07:00', '16:00')] }));
  });

  describe('Review Focus 4: horário inválido', () => {
    it('o fim antes do começo mostra o erro no campo e o salvar não sai', async () => {
      const f = api();
      await abrirOMilitar();
      const painel = await abrirOPainel(5);
      await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
      await preencher(painel, 1, '10:00', '09:00');
      expect(painel.getByRole('alert')).toHaveTextContent('O fim precisa ser depois do início.');
      expect(painel.getByLabelText('Fim do horário 1')).toHaveAttribute('aria-invalid', 'true');
      await userEvent.keyboard('{Escape}');
      await userEvent.click(salvar());
      expect(await screen.findByText(/Corrija os horários/)).toBeInTheDocument();
      expect(f.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    });

    it('uma hora que não existe (25:00) também: o erro diz como escrever, e corrigir libera o salvar', async () => {
      const f = api();
      await abrirOMilitar();
      const painel = await abrirOPainel(5);
      await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
      await preencher(painel, 1, '25:00', '11:00');
      expect(painel.getByRole('alert')).toHaveTextContent('Use a hora no formato HH:MM.');
      await preencher(painel, 1, '09:00', '11:00');
      expect(painel.queryByRole('alert')).toBeNull();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(salvar());
      await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '09:00', '11:00')] }));
    });
  });

  it('tirar o horário no painel tira o texto do dia', async () => {
    api({}, doMilitar({ faixas: [faixa(dia(12), '09:30', '11:00')] }));
    await abrirOMilitar();
    const painel = await abrirOPainel(12);
    await userEvent.click(painel.getByRole('button', { name: 'Tirar o horário 1' }));
    expect(within(celaDoDia(12)).queryByText('09:30 às 11:00')).toBeNull();
  });
});

describe('achados da revisão da 7.2', () => {
  it('C1: editar o "outro horário" depois de ele ter encostado num bloco marcado não desmarca o bloco', async () => {
    api();
    await abrirOMilitar();
    await userEvent.click(bloco(5, '08h', '16h'));
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await preencher(painel, 1, '07:00', '09:00');
    expect(within(celaDoDia(5)).getByText('07:00 às 16:00')).toBeInTheDocument();
    // corrigir o fim passa por um estado inválido ("09:0"): o bloco continua marcado em todo o caminho
    const fim = painel.getByLabelText('Fim do horário 1');
    await userEvent.clear(fim);
    await userEvent.type(fim, '0930');
    expect(bloco(5, '08h', '16h')).toHaveAttribute('data-estado', 'cheio');
    expect(within(celaDoDia(5)).getByText('07:00 às 16:00')).toBeInTheDocument();
    // tirar o horário devolve o dia ao que o bloco marcava
    await userEvent.click(painel.getByRole('button', { name: 'Tirar o horário 1' }));
    expect(bloco(5, '08h', '16h')).toHaveAttribute('data-estado', 'cheio');
    expect(celaDoDia(5).querySelector('[data-outras]')).toBeNull();
  });

  it('C2: no celular só se digitam números: "0930" vira 09:30 sozinho, e o horário vale', async () => {
    const f = api();
    await abrirOMilitar();
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await userEvent.type(painel.getByLabelText('Início do horário 1'), '0930');
    await userEvent.type(painel.getByLabelText('Fim do horário 1'), '1100');
    expect(painel.getByLabelText('Início do horário 1')).toHaveValue('09:30');
    expect(painel.getByLabelText('Fim do horário 1')).toHaveValue('11:00');
    expect(painel.queryByRole('alert')).toBeNull();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '09:30', '11:00')] }));
  });

  it('I1: Enter dentro do painel não salva o mês', async () => {
    const f = api();
    await abrirOMilitar();
    const painel = await abrirOPainel(5);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await userEvent.type(painel.getByLabelText('Início do horário 1'), '0930{Enter}');
    await userEvent.type(painel.getByLabelText('Fim do horário 1'), '1100{Enter}');
    expect(f.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    // e o Enter no botão do relógio abre o painel, em vez de salvar
    await userEvent.keyboard('{Escape}');
    botaoDoDia(6).focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Horários extras do dia 6' })).toBeInTheDocument();
    expect(f.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('I2: "Limpar" desfaz também os outros horários e o erro que ficou num painel: o salvar sai e o painel reabre vazio', async () => {
    const f = api({}, doMilitar({ faixas: [faixa(dia(12), '09:30', '11:00')] }));
    await abrirOMilitar();
    const painel = await abrirOPainel(12);
    await userEvent.click(painel.getByRole('button', { name: 'Adicionar horário' }));
    await userEvent.type(painel.getByLabelText('Início do horário 2'), '13');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(within(celaDoDia(12)).queryByText('09:30 às 11:00')).toBeNull();
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [] }));
    const reaberto = await abrirOPainel(12);
    expect(reaberto.queryByLabelText('Início do horário 1')).toBeNull();
  });

  it('uma faixa gravada que mistura blocos e horário solto (07:00 às 16:00) abre separada: o bloco 08–16 marcado e o "outro horário" 07:00 às 08:00 no painel', async () => {
    api({}, doMilitar({ faixas: [faixa(dia(5), '07:00', '16:00')] }));
    await abrirOMilitar();
    expect(within(celaDoDia(5)).getByText('07:00 às 16:00')).toBeInTheDocument();
    expect(bloco(5, '08h', '16h')).toHaveAttribute('data-estado', 'cheio');
    const painel = await abrirOPainel(5);
    expect(painel.getByLabelText('Início do horário 1')).toHaveValue('07:00');
    expect(painel.getByLabelText('Fim do horário 1')).toHaveValue('08:00');
  });
});
