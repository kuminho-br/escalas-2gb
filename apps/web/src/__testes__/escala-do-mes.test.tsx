import type { CardDaGuarnicao, DiaDaEscala, EscalaDoMes, FaixaDoDia, LinhaEscala, OcupanteDaVaga } from 'contratos';
import { somarMeses } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Escala fictícia de 3 dias, uma guarnição (ABT: Motorista 1–1 CNH D, Combatente 1–2), duas faixas por dia.
const MES = mesAtual();
const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'] }, { id: 'e9', nome: 'Velha', ativa: false, servicos: [] }];

const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, militarId: `m-${nome}`, posto: 'SD BM', nomeGuerra: nome, matricula: '990001-1', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
});
const card = (motorista: boolean, combatente: boolean): CardDaGuarnicao => {
  const faltam = [...(motorista ? [] : ['Falta 1 Motorista (CNH D)']), ...(combatente ? [] : ['Falta 1 Combatente'])];
  return {
    guarnicaoId: 'g-abt', nome: 'ABT', viatura: 'ABT-01', prioridade: 1, completa: faltam.length === 0, faltam,
    funcoes: [
      { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D', ocupantes: motorista ? [ocupante('MOTOR')] : [] },
      { funcaoId: 'f-comb', funcao: 'Combatente', minimo: 1, maximo: 2, cnhExigida: null, ocupantes: combatente ? [ocupante('COMB')] : [] },
    ],
  };
};
const faixa = (noturna: boolean, c: CardDaGuarnicao, extra: Partial<FaixaDoDia> = {}): FaixaDoDia => ({
  inicio: noturna ? '20:00' : '08:00', fim: noturna ? '08:00' : '20:00', noturna,
  turnos: [{ turnoId: noturna ? 't-b' : 't-a', servicoId: 's1', servico: 'Pronto', letra: noturna ? 'B' : 'A' }], guarnicoes: [c], semPosto: [], removidos: [], ...extra,
});
const dia = (n: number, feriado: string | null, faixas: FaixaDoDia[]): DiaDaEscala => ({
  data: `${MES}-0${n}`, diaDaSemana: n % 7, feriado, faixas, obrigatoriasVazias: faixas.reduce((s, f) => s + f.guarnicoes.reduce((t, g) => t + g.faltam.length, 0), 0),
});
const ESCALA: EscalaDoMes = {
  escalaId: 'e1', nome: 'Ordinário', mes: MES,
  dias: [
    dia(1, 'Dia do Teste', [faixa(false, card(true, true)), faixa(true, card(false, false))]),
    dia(2, null, [faixa(false, card(true, false)), faixa(true, card(true, true))]),
    dia(3, null, [faixa(false, card(true, true)), faixa(true, card(true, true))]),
  ],
  resumo: { preenchidas: 9, obrigatorias: 12, obrigatoriasVazias: 3 },
};

function api(escala: EscalaDoMes = ESCALA, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: escala },
    ...extra,
  });
}
const secaoDoDia = (n: number) => screen.getByRole('region', { name: `Dia ${n}` });

describe('escala do mês', () => {
  it('o trilho leva a "Escala do mês", que abre a primeira escala ativa no mês atual', async () => {
    api();
    const router = abrir('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Escala do mês' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/escala-do-mes'));
    expect(await screen.findByRole('heading', { name: 'Escala do mês' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Dia 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Escala')).toHaveValue('e1');
    expect(screen.getByLabelText('Mês')).toHaveValue(MES);
  });

  it('mostra o resumo das vagas obrigatórias, com as vazias em âmbar', async () => {
    api();
    abrir('/escala-do-mes');
    expect(await screen.findByText((_, el) => el?.tagName === 'P' && el.textContent === '9 de 12 vagas obrigatórias preenchidas, 3 vazias')).toBeInTheDocument();
    expect(screen.getByText('3 vazias')).toHaveClass('text-pendencia');
  });

  it('o dia mostra o número, o dia da semana e o nome do feriado (número em vermelho)', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    expect(within(d1).getByText('Dia do Teste')).toBeInTheDocument();
    expect(within(d1).getByText('1')).toHaveClass('text-alerta');
    expect(within(secaoDoDia(2)).getByText('2')).not.toHaveClass('text-alerta');
  });

  it('a faixa da noite fica marcada e a do dia não', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const faixas = d1.querySelectorAll('[data-faixa]');
    expect(faixas).toHaveLength(2);
    expect(faixas[0]).not.toHaveAttribute('data-noturna');
    expect(faixas[1]).toHaveAttribute('data-noturna');
    expect(within(faixas[0] as HTMLElement).getByText('08h–20h')).toBeInTheDocument();
    expect(within(faixas[1] as HTMLElement).getByText('20h–08h')).toBeInTheDocument();
  });

  it('o card diz com o ícone se está completo ou o que falta', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    expect(within(d1).getByRole('img', { name: 'Completa' })).toBeInTheDocument();
    const falta = within(d1).getByRole('img', { name: 'Falta 1 Motorista (CNH D). Falta 1 Combatente' });
    expect(falta).toHaveAttribute('title', 'Falta 1 Motorista (CNH D). Falta 1 Combatente');
  });

  it('vaga obrigatória vazia é "Escolher militar" com listras; a opcional é discreta e sem rótulo de opcional', async () => {
    api();
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    // dia 3, faixa do dia: Motorista (1–1) e Combatente (1–2) com 1 ocupante cada: sobra a vaga opcional do Combatente
    const botoes = within(d3.querySelector('[data-faixa]') as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).not.toHaveAttribute('data-obrigatoria');
    expect(within(d3).queryByText(/opcional/i)).toBeNull();
    const d1 = secaoDoDia(1);
    const noite = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    // Motorista e Combatente vazios (obrigatórias) e a segunda vaga do Combatente (opcional)
    expect(noite.map((b) => b.hasAttribute('data-obrigatoria'))).toEqual([true, true, false]);
  });

  it('a linha do ocupante tem posto, nome, matrícula e a etiqueta do serviço', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const linha = within(d1).getAllByText('MOTOR')[0]!.closest('li')!;
    expect(within(linha).getByText('SD BM')).toBeInTheDocument();
    expect(within(linha).getByText('990001-1')).toBeInTheDocument();
    expect(within(linha).getByText('Pronto')).toBeInTheDocument();
  });

  it('"Mostrar só vagas vazias" esconde o dia sem vagas vazias e os cards completos', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const botao = screen.getByRole('button', { name: 'Mostrar só vagas vazias' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: 'Dia 3' })).toBeNull();
    expect(within(secaoDoDia(2)).getAllByRole('img')).toHaveLength(1);
    expect(within(secaoDoDia(1)).queryByRole('img', { name: 'Completa' })).toBeNull();
  });

  it('trocar o mês muda o endereço e consulta a escala do mês novo', async () => {
    const proximo = somarMeses(MES, 1);
    const f = api(ESCALA, { [`GET /api/escalas/e1/mes/${proximo}`]: { status: 200, corpo: { ...ESCALA, mes: proximo, dias: [] } } });
    const router = abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mês'), { target: { value: proximo } });
    });
    await waitFor(() => expect((router.state.location.search as { mes?: string }).mes).toBe(proximo));
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`/api/escalas/e1/mes/${proximo}`))).toBe(true));
  });

  it('sem escala ativa, a tela manda criar uma', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] } });
    abrir('/escala-do-mes');
    const aviso = await screen.findByText(/Nenhuma escala ativa\./);
    expect(within(aviso).getByRole('link', { name: 'Escalas' })).toHaveAttribute('href', '/escalas');
  });
});
