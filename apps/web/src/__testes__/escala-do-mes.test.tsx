import type { Cota, CardDaGuarnicao, DiaDaEscala, EscalaDoMes, FaixaDoDia, LinhaEscala, OcupanteDaVaga } from 'contratos';
import { somarMeses } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, responderConfirmacao, simularApi, trava } from './apoio';

// Escala fictícia de 3 dias, uma guarnição (ABT: Motorista 1–1 CNH D, Combatente 1–2), duas faixas por dia.
const MES = mesAtual();
const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' }, { id: 'e9', nome: 'Velha', ativa: false, servicos: [], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' }];

const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, acumuloId: null, acumulaCom: [], militarId: `m-${nome}`, posto: 'SD', nomeGuerra: nome, matricula: '990001-1', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
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
  turnos: [{ turnoId: noturna ? 't-b' : 't-a', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: noturna ? 'B' : 'A' }], guarnicoes: [c], semPosto: [], removidos: [], ...extra,
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
  estado: { estado: 'rascunho', emRetificacao: false, em: null, por: null }, podePublicar: false, podeAlterarPassado: false,
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
/** Abre o menu da placa (os três pontos) e escolhe a ação. */
async function agirNaPlaca(escopo: HTMLElement, nome: RegExp | string, acao: string) {
  await userEvent.click(within(escopo).getByRole('button', { name: nome }));
  await userEvent.click(await screen.findByRole('menuitem', { name: acao }));
}

describe('escala do mês', () => {
  it('o trilho leva a "Escala do mês", que abre a primeira escala ativa no mês atual', async () => {
    api();
    const router = abrir('/grade');
    await userEvent.click(await screen.findByRole('link', { name: 'Escala do mês' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/escala-do-mes'));
    expect(await screen.findByRole('heading', { name: 'Escala do mês' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Dia 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Escala')).toHaveValue('e1');
    expect(screen.getByLabelText('Mês')).toHaveValue(MES);
  });

  describe('a escala escolhida ao abrir (6.32)', () => {
    const ESCALAS: LinhaEscala[] = [
      { id: 'e-x', nome: 'Operação X', ativa: true, servicos: ['JES'], montaBlocosVoluntariado: false, distribuicao: 'pre_escala' },
      { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto', 'Saldo'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' },
    ];
    const rotas = (lista: LinhaEscala[]) => ({
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: lista },
      [`GET /api/escalas/e-x/mes/${MES}`]: { status: 200, corpo: { ...ESCALA, escalaId: 'e-x', nome: 'Operação X' } },
    });

    it('com a Operação X (JES) antes do Ordinário (Pronto, Saldo), a tela abre com o Ordinário escolhido', async () => {
      api(ESCALA, rotas(ESCALAS));
      abrir('/escala-do-mes');
      expect(await screen.findByRole('region', { name: 'Dia 1' })).toBeInTheDocument();
      expect(screen.getByLabelText('Escala')).toHaveValue('e1');
    });

    it('sem escala com o Pronto, abre na primeira ativa, como antes', async () => {
      api(ESCALA, rotas([ESCALAS[0]!, { ...ESCALAS[1]!, servicos: ['Saldo'] }]));
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 1' });
      expect(screen.getByLabelText('Escala')).toHaveValue('e-x');
    });

    it('o Pronto inativo (escala desativada) não conta: abre na primeira ativa', async () => {
      api(ESCALA, rotas([ESCALAS[0]!, { ...ESCALAS[1]!, ativa: false }]));
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 1' });
      expect(screen.getByLabelText('Escala')).toHaveValue('e-x');
    });

    it('Review Focus 5: com ?escala=<id> na URL, ela vence sempre', async () => {
      api(ESCALA, rotas(ESCALAS));
      abrir('/escala-do-mes?escala=e-x');
      await screen.findByRole('region', { name: 'Dia 1' });
      expect(screen.getByLabelText('Escala')).toHaveValue('e-x');
    });
  });

  it('a escala de rodada de cotas (a dos oficiais) não aparece aqui: ela é montada em Oficiais (6.27)', async () => {
    api(ESCALA, { 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [{ id: 'e-of', nome: 'Oficiais de operações', ativa: true, servicos: ['JES', 'Saldo'], montaBlocosVoluntariado: false, distribuicao: 'rodada_de_cotas' }, ...LISTA] } });
    abrir('/escala-do-mes');
    const campo = await screen.findByLabelText('Escala');
    await waitFor(() => expect(campo).toHaveValue('e1'));
    expect(within(campo).queryByRole('option', { name: 'Oficiais de operações' })).toBeNull();
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

  it('os cards do turno esticam para ocupar a linha, em qualquer escala: uma guarnição sozinha não deixa coluna vazia', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const grade = d1.querySelector('[data-faixa] [data-cards-do-turno]') as HTMLElement;
    expect(grade).not.toBeNull();
    expect(grade).toHaveClass('grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]');
    expect(grade.className).not.toMatch(/(^|\s)(sm|xl|2xl):grid-cols-/);
  });

  it('no card, as funções ficam uma embaixo da outra (o card cabe numa coluna de ~20rem)', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const funcoes = d1.querySelector('[data-faixa] [data-funcoes]') as HTMLElement;
    expect(funcoes).not.toBeNull();
    expect(funcoes.className).not.toMatch(/auto-fill/);
  });

  it('os turnos do dia ficam lado a lado numa grade de ~20rem, e o turno com uma guarnição não ocupa a linha inteira', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const grade = d1.querySelector('[data-faixas-do-dia]') as HTMLElement;
    expect(grade).not.toBeNull();
    expect(grade).toHaveClass('grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]');
    expect(grade.querySelectorAll(':scope > [data-faixa]')).toHaveLength(2);
    expect(grade.querySelector('[data-larga]')).toBeNull();
  });

  it('o turno com mais de uma guarnição ocupa a linha inteira', async () => {
    const outro = { ...card(true, true), guarnicaoId: 'g-aco', nome: 'ACO' };
    const terceiro = { ...card(true, true), guarnicaoId: 'g-res', nome: 'Resgate' };
    api({ ...ESCALA, dias: [dia(1, null, [faixa(false, card(true, true), { guarnicoes: [card(true, true), outro, terceiro] }), faixa(true, card(true, true))])] });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const faixas = d1.querySelectorAll('[data-faixa]');
    expect(faixas[0]).toHaveAttribute('data-larga');
    expect(faixas[0]).toHaveClass('col-span-full');
    expect(faixas[1]).not.toHaveAttribute('data-larga');
  });

  it('o dia tem uma barra só, entre o número e as faixas, e a faixa não tem barra própria (4.2)', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const barras = d1.querySelectorAll('[data-barra-do-dia]');
    expect(barras).toHaveLength(1);
    expect(barras[0]!.previousElementSibling).toHaveTextContent('1');
    expect(barras[0]!.nextElementSibling).toHaveAttribute('data-faixas-do-dia');
    for (const f of d1.querySelectorAll('[data-faixa]')) expect(f.querySelector(':scope > [aria-hidden]')).toBeNull();
  });

  it('o título do turno mostra a etiqueta do serviço na cor cadastrada, depois do horário e da letra (4.2)', async () => {
    const bioma = { ...faixa(false, card(true, true)), inicio: '08:00', fim: '16:00', turnos: [{ turnoId: 't-bi', servicoId: 's-bioma', servico: 'Bioma', cor: '#C97A00', letra: 'B' as const }] };
    api({ ...ESCALA, dias: [dia(1, null, [bioma])] });
    abrir('/escala-do-mes');
    const f = (await screen.findByRole('region', { name: 'Dia 1' })).querySelector('[data-faixa]') as HTMLElement;
    expect(within(f).getByText('08h–16h')).toBeInTheDocument();
    expect(within(f).getByText('B')).toBeInTheDocument();
    const etiqueta = within(f).getByText('Bioma');
    const caixa = etiqueta.closest('[data-etiqueta]')!;
    expect(caixa).toHaveAttribute('data-tipo', 'servico');
    // a cor do serviço fica só no quadradinho: nunca atrás do texto
    expect(caixa.querySelector('[data-quadradinho]')).toHaveStyle({ backgroundColor: '#C97A00' });
    expect(caixa).not.toHaveStyle({ backgroundColor: '#C97A00' });
  });

  it('uma faixa com vários serviços traz uma etiqueta para cada um', async () => {
    const dupla = { ...faixa(false, card(true, true)), turnos: [
      { turnoId: 't-a', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'A' as const },
      { turnoId: 't-j', servicoId: 's2', servico: 'JES', cor: '#6E56A8', letra: 'A' as const },
      { turnoId: 't-p', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'B' as const },
    ] };
    api({ ...ESCALA, dias: [dia(1, null, [dupla])] });
    abrir('/escala-do-mes');
    const f = (await screen.findByRole('region', { name: 'Dia 1' })).querySelector('[data-faixa]') as HTMLElement;
    expect([...f.querySelectorAll('[data-etiqueta][data-tipo="servico"]')].map((e) => e.textContent)).toEqual(['Pronto', 'JES']);
  });

  it('a escala com um turno por dia em todo o mês põe os dias em grade (Defensoria, CPRH) (4.2)', async () => {
    api({ ...ESCALA, dias: ESCALA.dias.map((d) => ({ ...d, faixas: [d.faixas[0]!] })) });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const grade = document.querySelector('[data-dias-em-grade]') as HTMLElement;
    expect(grade).not.toBeNull();
    expect(grade).toHaveClass('grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]');
    expect(grade.querySelectorAll(':scope > section')).toHaveLength(3);
  });

  it('um único dia com duas faixas tira a grade do mês todo (Review Focus 4)', async () => {
    api({ ...ESCALA, dias: [dia(1, null, [faixa(false, card(true, true))]), dia(2, null, [faixa(false, card(true, true))]), dia(3, 'Feriado com turno extra', [faixa(false, card(true, true)), faixa(true, card(true, true))])] });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    expect(document.querySelector('[data-dias-em-grade]')).toBeNull();
  });

  it('"Ocultar guarnições completas" com dias em grade deixa só os dias com vaga vazia, sem buracos na grade (Review Focus 5)', async () => {
    // dia 1 completo, dia 2 com vaga vazia, dia 3 completo
    const completo = (n: number) => dia(n, null, [faixa(false, card(true, true))]);
    api({ ...ESCALA, dias: [completo(1), dia(2, null, [faixa(false, card(true, false))]), completo(3)] });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar guarnições completas' }));
    const grade = document.querySelector('[data-dias-em-grade]') as HTMLElement;
    expect([...grade.children].map((c) => c.getAttribute('aria-label'))).toEqual(['Dia 2']);
    expect([...grade.children].every((c) => (c.textContent ?? '').trim() !== '')).toBe(true);
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

  it('vaga obrigatória vazia é "Escolher militar"; a vaga extra (entre o mínimo e o máximo) é o encaixe "Vaga opcional"', async () => {
    api();
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    // dia 3, faixa do dia: Motorista (1–1) e Combatente (1–2) com 1 ocupante cada: sobra a vaga opcional do Combatente
    const botoes = within(d3.querySelector('[data-faixa]') as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).not.toHaveAttribute('data-obrigatoria');
    expect(botoes[0]).toHaveTextContent('Vaga opcional');
    const d1 = secaoDoDia(1);
    const noite = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    // Motorista e Combatente vazios (obrigatórias) e a segunda vaga do Combatente (opcional)
    expect(noite.map((b) => b.hasAttribute('data-obrigatoria'))).toEqual([true, true, false]);
    expect(noite.map((b) => b.textContent)).toEqual(['Escolher militar', 'Escolher militar', 'Vaga opcional']);
  });

  it('cada função da guarnição é uma linha do cartão, com o rótulo da função, e os cartões se alinham pelo topo', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const cartaoDoDia = d1.querySelector('[data-cards-do-turno] > [data-cartao]') as HTMLElement;
    const funcoes = cartaoDoDia.querySelectorAll('[data-funcao-do-cartao]');
    expect([...funcoes].map((p) => p.querySelector('[data-cabecalho-funcao]')?.textContent)).toEqual(['MotoristaCNH D', 'Combatente']);
    expect(d1.querySelector('[data-cards-do-turno]')).toHaveClass('items-start');
  });

  it('a frase "Falta 1 Motorista…" não aparece escrita em card nenhum: só o contador, e a frase fica no title e no nome acessível', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    expect(within(d1).queryByText(/^Falta\b.*(Motorista|Combatente)/)).toBeNull();
  });

  it('o cabeçalho do cartão mostra o contador "Faltam N" (N = vagas obrigatórias vazias) numa etiqueta de falta, e o visto de completa quando N é 0', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    // dia 1, faixa do dia: falta 1 Motorista e 1 Combatente
    const etiqueta = within(d1).getByText('Faltam 2');
    expect(etiqueta.closest('[data-etiqueta]')).toHaveAttribute('data-tipo', 'falta');
    const contador = etiqueta.closest('[role="img"]')!;
    expect(contador).toHaveAttribute('title', 'Falta 1 Motorista (CNH D). Falta 1 Combatente');
    expect(contador).toHaveAttribute('aria-label', 'Falta 1 Motorista (CNH D). Falta 1 Combatente');
    expect(d1.querySelector('.lucide-triangle-alert')).toBeNull();
    // o cartão completo não mostra contador nenhum (e segue com o visto de completa)
    const completo = within(d1).getByRole('img', { name: 'Completa' }).closest('[data-cartao]') as HTMLElement;
    expect(within(completo).queryByText(/^Faltam?\b/)).toBeNull();
  });

  it('a vaga vazia é um botão de borda tracejada, sem as listras amarelas e sem a cor de nenhum serviço: a obrigatória tem o fundo de pendência, a extra não tem fundo', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const vagas = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(vagas).toHaveLength(3);
    for (const v of vagas) {
      expect(v.tagName).toBe('BUTTON');
      expect(v).toHaveClass('border-dashed');
      expect(v.className).not.toMatch(/repeating-linear-gradient|F2C200|FFF3B8/);
      // a cor de serviço é só de quem já está escalado: a vaga não leva estilo nenhum
      expect(v).not.toHaveAttribute('style');
    }
    expect(vagas.map((v) => v.classList.contains('bg-pendencia-fundo'))).toEqual([true, true, false]);
  });

  it('a vaga obrigatória é o encaixe de pendência (sem a barra vinho); a extra tem a borda fina de encaixe e diz "Vaga opcional"', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const vagas = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(vagas.map((v) => v.querySelector('[data-barra]') !== null)).toEqual([false, false, false]);
    expect(vagas.map((v) => v.hasAttribute('data-obrigatoria'))).toEqual([true, true, false]);
    expect(vagas[0]).toHaveClass('border-pendencia', 'text-pendencia');
    expect(vagas[2]).toHaveClass('border-encaixe', 'text-apagado');
    expect(vagas[2]).toHaveTextContent('Vaga opcional');
  });

  it('ao passar o mouse o tracejado da vaga vira linha cheia; a opcional ganha também o fundo e o texto escuros', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const [obrigatoria, , extra] = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(obrigatoria).toHaveClass('hover:border-solid');
    expect(extra).toHaveClass('hover:border-solid', 'hover:border-tinta', 'hover:bg-superficie', 'hover:text-tinta');
  });

  it('a placa do ocupante tem patente, nome e matrícula; o nome do serviço só aparece quando não é o Pronto', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const placa = within(d1).getAllByText('MOTOR')[0]!.closest('[data-placa]') as HTMLElement;
    expect(within(placa).getByText('SD')).toBeInTheDocument();
    expect(within(placa).getByText('990001-1')).toBeInTheDocument();
    expect(within(placa).queryByText('Pronto')).toBeNull();
    expect(placa).toHaveAttribute('title', 'SD MOTOR, 990001-1, Pronto');
  });

  it('"Ocultar guarnições completas" esconde o dia sem vagas vazias e os cards completos', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const botao = screen.getByRole('button', { name: 'Ocultar guarnições completas' });
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
    expect(await screen.findByRole('heading', { name: 'Nenhuma escala ativa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para Escalas' })).toHaveAttribute('href', '/escalas');
  });
});

describe('escolher militar e remover', () => {
  const CANDIDATOS = {
    aptos: [
      { militarId: 'm-zulu', posto: 'SD', nomeGuerra: 'ZULU', matricula: '990002-2', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] },
      { militarId: 'm-yuri', posto: 'CB', nomeGuerra: 'YURI', matricula: '990003-3', equipe: null, jornada: 'adm', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }, { servicoId: 's2', turnoId: 't-jes', nome: 'JES' }] },
    ],
    semVoluntariado: [],
    emChoque: [],
    fora: [{ motivo: 'Afastado', quantidade: 3 }, { motivo: 'Sem a CNH exigida', quantidade: 2 }, { motivo: 'Choque de horário', quantidade: 1 }], acumular: [],
  };
  // a escala depois de escalar o ZULU de Combatente no dia 2, faixa do dia
  const COM_ZULU: EscalaDoMes = {
    ...ESCALA,
    dias: ESCALA.dias.map((d, i) => (i !== 1 ? d : { ...d, obrigatoriasVazias: 0, faixas: [faixa(false, (() => { const c = card(true, true); c.funcoes[1]!.ocupantes = [ocupante('ZULU')]; return c; })()), d.faixas[1]!] })),
  };
  const rotaCandidatos = `GET /api/escalas/e1/mes/${MES}/candidatos`;
  const abrirVaga = async () => {
    const faixaDoDia = secaoDoDia(2).querySelector('[data-faixa]') as HTMLElement;
    await userEvent.click(within(faixaDoDia).getAllByRole('button', { name: 'Escolher militar para Combatente de ABT' })[0]!);
    return screen.findByRole('dialog', { name: 'Escolher militar' });
  };

  it('abrir a vaga consulta os candidatos do dia, da faixa, da guarnição e da função, e mostra aptos e quantos ficaram de fora', async () => {
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    expect(await within(dialogo).findByRole('button', { name: /ZULU/ })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: /YURI/ })).toBeInTheDocument();
    expect(within(dialogo).getByText('Ficaram de fora: 3 afastados, 2 sem a CNH exigida, 1 com choque de horário')).toBeInTheDocument();
    const chamada = f.mock.calls.map(([e]) => new URL(String(e), 'http://x')).find((u) => u.pathname.endsWith('/candidatos'))!;
    expect(Object.fromEntries(chamada.searchParams)).toEqual({ data: `${MES}-02`, inicio: '08:00', fim: '20:00', guarnicaoId: 'g-abt', funcaoId: 'f-comb' });
  });

  it('item 31: no celular (toque), abrir a escolha de militar não põe o foco na busca (o teclado só aparece quando a pessoa toca na caixa)', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('pointer: coarse'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await within(dialogo).findByRole('button', { name: /ZULU/ });
    expect(within(dialogo).getByLabelText('Buscar por nome ou matrícula')).not.toHaveFocus();
    vi.unstubAllGlobals();
  });

  it('item 31 (conferência): com mouse, a busca recebe o foco ao abrir, como sempre', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await within(dialogo).findByRole('button', { name: /ZULU/ });
    // o foco vai para a busca quando o diálogo abre (o Radix o move depois de montar): espera
    await waitFor(() => expect(within(dialogo).getByLabelText('Buscar por nome ou matrícula')).toHaveFocus());
  });

  it('escolher manda a alocação, a linha passa a mostrar o militar e o diálogo fecha', async () => {
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/escalas/e1/alocacoes')).toEqual({ militarId: 'm-zulu', data: `${MES}-02`, turnoId: 't-a', guarnicaoId: 'g-abt', funcaoId: 'f-comb' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(secaoDoDia(2)).getAllByText('ZULU').length).toBeGreaterThan(0);
  });

  describe('mover do turno para a vaga (6.40)', () => {
    const NO_TURNO = {
      ...CANDIDATOS,
      aptos: [
        { militarId: 'm-turno', posto: 'SD', nomeGuerra: 'NOTURNO', matricula: '990008-8', equipe: 'Alfa', jornada: 'pronto', noTurno: { alocacaoId: 'a-turno' }, servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] },
        ...CANDIDATOS.aptos,
      ],
    };

    it('quem está no turno sem guarnição vem primeiro, com "No turno, sem guarnição"; os outros não têm a marca', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: NO_TURNO } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      const itens = await within(dialogo).findAllByRole('button', { name: /NOTURNO|ZULU|YURI/ });
      expect(itens[0]).toHaveTextContent('NOTURNO');
      expect(itens[0]).toHaveTextContent('No turno, sem guarnição');
      expect(within(dialogo).getAllByText('No turno, sem guarnição')).toHaveLength(1);
    });

    it('escolher manda a escolha de sempre; o aviso diz que ele foi para a vaga e o "Desfazer" o devolve ao turno sem guarnição', async () => {
      const f = api(ESCALA, {
        [rotaCandidatos]: { status: 200, corpo: NO_TURNO },
        'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU },
        'POST /api/alocacoes/a-turno/voltar-ao-turno': { status: 200, corpo: ESCALA },
      });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await userEvent.click(await within(dialogo).findByRole('button', { name: /NOTURNO/ }));
      await waitFor(() => expect(corpoEnviado(f, 'POST /api/escalas/e1/alocacoes')).toEqual({ militarId: 'm-turno', data: `${MES}-02`, turnoId: 't-a', guarnicaoId: 'g-abt', funcaoId: 'f-comb' }));
      expect(await screen.findByText('SD NOTURNO saiu do turno sem guarnição e foi para a vaga de Combatente na ABT.')).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
      await waitFor(() => expect(corpoEnviado(f, 'POST /api/alocacoes/a-turno/voltar-ao-turno')).toEqual({ guarnicaoId: 'g-abt', funcaoId: 'f-comb' }));
    });

    it('escolher alguém que não estava no turno não ganha aviso nem "Desfazer" (a escolha de sempre)', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: NO_TURNO }, 'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
    });
  });

  describe('a cota de saldo (6.38)', () => {
    it('na lista de candidatos, o militar do Adm traz a barra na frente da matrícula; o do Pronto não', async () => {
      const comCota = {
        ...CANDIDATOS,
        aptos: [CANDIDATOS.aptos[0], { ...CANDIDATOS.aptos[1], saldos: { feitos: 2, total: 6 } }],
      };
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: comCota } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      const yuri = (await within(dialogo).findByRole('button', { name: /YURI/ })).closest('li')!;
      const barra = within(yuri).getByRole('img', { name: '2 de 6 saldos no mês' });
      expect(within(yuri).getByText('990003-3').firstElementChild).toBe(barra);
      expect(within((await within(dialogo).findByRole('button', { name: /ZULU/ })).closest('li')!).queryByRole('img')).toBeNull();
    });

    it('na placa do ocupante de Saldo, o número "2/6" fica ao lado da etiqueta do Saldo; acima do total é "7/6"; o Pronto não traz número', async () => {
      const doSaldo = (nome: string, saldos?: { feitos: number; total: number }): OcupanteDaVaga => ({ ...ocupante(nome), servico: { id: 's3', nome: 'Saldo', cor: '#2B7BB9' }, ...(saldos ? { saldos } : {}) });
      const c = card(true, true);
      c.funcoes[0]!.ocupantes = [doSaldo('MOTOR', { feitos: 2, total: 6 })];
      c.funcoes[1]!.ocupantes = [doSaldo('COMB', { feitos: 7, total: 6 }), ocupante('PRONTOX')];
      const escala: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i !== 1 ? d : { ...d, faixas: [faixa(false, c), d.faixas[1]!] })) };
      api(escala);
      abrir('/escala-do-mes');
      const regiao = await screen.findByRole('region', { name: 'Dia 2' });
      const placa = (nome: string) => within(regiao).getAllByText(nome)[0]!.closest('[data-placa]') as HTMLElement;
      expect(within(placa('MOTOR')).getByText('2/6')).toBeInTheDocument();
      expect(placa('MOTOR').textContent).toMatch(/2\/6/);
      expect(within(placa('COMB')).getByText('7/6')).toHaveClass('text-pendencia');
      expect(within(placa('PRONTOX')).queryByText(/\d\/\d/)).toBeNull();
    });
  });

  describe('resolver o choque (6.38)', () => {
    const doDia = `${MES}-02`;
    const alocacao = (extra: Record<string, unknown> = {}) => ({ tipo: 'alocacao', alocacaoId: 'a-jes', servico: 'JES', data: doDia, inicio: '09:00', fim: '17:00', escala: 'Extra', unidadeSigla: '1ª SB', podeResolver: true, ...extra });
    const EM_CHOQUE = {
      ...CANDIDATOS,
      fora: [],
      emChoque: [
        { militarId: 'm-xavier', posto: 'SD', nomeGuerra: 'XAVIER', matricula: '990004-4', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto', choque: alocacao() }] },
        { militarId: 'm-walter', posto: 'SD', nomeGuerra: 'WALTER', matricula: '990005-5', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto', choque: alocacao({ alocacaoId: 'a-gb', escala: 'Ordinário', unidadeSigla: '2º GB', podeResolver: false }) }] },
        {
          militarId: 'm-admir', posto: 'CB', nomeGuerra: 'ADMIR', matricula: '990006-6', equipe: null, jornada: 'adm', saldos: { feitos: 3, total: 6 },
          servicos: [
            { servicoId: 's3', turnoId: 't-saldo', nome: 'Saldo', choque: { tipo: 'expediente', data: doDia, podeResolver: true } },
            { servicoId: 's1', turnoId: 't-a', nome: 'Pronto', choque: { tipo: 'expediente', data: doDia, podeResolver: false } },
          ],
        },
        { militarId: 'm-jesadm', posto: 'SD', nomeGuerra: 'JESADM', matricula: '990007-7', equipe: null, jornada: 'adm', servicos: [{ servicoId: 's2', turnoId: 't-jes', nome: 'JES', choque: { tipo: 'expediente', data: doDia, podeResolver: false } }] },
      ],
    };
    const linhaDe = (dialogo: HTMLElement, nome: string) => within(dialogo).getByText(nome).closest('li')!;
    const abrirComChoque = async (extra: Parameters<typeof simularApi>[0] = {}) => {
      const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: EM_CHOQUE }, ...extra });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await within(dialogo).findByRole('heading', { name: 'Em choque com esta vaga' });
      return { f, dialogo };
    };

    it('o militar em choque aparece à parte, com o que choca (serviço, horário, escala e unidade); só tem botão quando dá para resolver', async () => {
      const { dialogo } = await abrirComChoque();
      const xavier = linhaDe(dialogo, 'XAVIER');
      expect(xavier).toHaveTextContent('Já está em JES das 09h às 17h (Extra, 1ª SB).');
      expect(within(xavier).getByRole('button', { name: /^Tirar de JES e escalar aqui/ })).toBeInTheDocument();
      const walter = linhaDe(dialogo, 'WALTER');
      expect(walter).toHaveTextContent('Já está em JES das 09h às 17h (Ordinário, 2º GB).');
      expect(within(walter).queryByRole('button')).toBeNull();
      // o Adm: só o Saldo pode tirar do expediente; o Pronto e o JES ficam só com o motivo
      const admir = linhaDe(dialogo, 'ADMIR');
      expect(admir).toHaveTextContent('De expediente neste dia.');
      expect(within(admir).getByRole('img', { name: '3 de 6 saldos no mês' })).toBeInTheDocument();
      expect(within(admir).getByRole('button', { name: /^Tirar do expediente e escalar aqui/ })).toBeInTheDocument();
      const jes = linhaDe(dialogo, 'JESADM');
      expect(jes).toHaveTextContent('De expediente neste dia.');
      expect(within(jes).queryByRole('button')).toBeNull();
    });

    it('o botão pede a confirmação com a frase fixa; Cancelar não manda nada; confirmar manda o pedido, fecha e o aviso tem "Desfazer", que desfaz as duas pontas', async () => {
      const { f, dialogo } = await abrirComChoque({
        'POST /api/escalas/e1/alocacoes': { status: 201, corpo: { ...COM_ZULU, desfazer: { alocacaoId: 'a-nova', remocaoId: 'r-1' } } },
        'POST /api/resolucoes/desfazer': { status: 200, corpo: ESCALA },
      });
      await userEvent.click(within(linhaDe(dialogo, 'XAVIER')).getByRole('button', { name: /^Tirar de JES e escalar aqui/ }));
      const confirmacao = await screen.findByRole('dialog', { name: new RegExp(`SD XAVIER está em JES, 02/${MES.slice(5)} das 09h às 17h \\(Extra\\)\\. Tirar de lá e escalar aqui\\?`) });
      await userEvent.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
      expect(chamadasA(f, 'POST /api/escalas/e1/alocacoes')).toBe(0);
      await userEvent.click(within(linhaDe(screen.getByRole('dialog', { name: 'Escolher militar' }), 'XAVIER')).getByRole('button', { name: /^Tirar de JES e escalar aqui/ }));
      await responderConfirmacao('Tirar e escalar');
      await waitFor(() =>
        expect(corpoEnviado(f, 'POST /api/escalas/e1/alocacoes')).toEqual({ militarId: 'm-xavier', data: doDia, turnoId: 't-a', guarnicaoId: 'g-abt', funcaoId: 'f-comb', resolverChoque: { alocacaoId: 'a-jes' } }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Escolher militar' })).toBeNull());
      expect(await screen.findByText('SD XAVIER saiu de JES e foi escalado aqui.')).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
      await waitFor(() => expect(corpoEnviado(f, 'POST /api/resolucoes/desfazer')).toEqual({ alocacaoId: 'a-nova', remocaoId: 'r-1' }));
    });

    it('do expediente: o botão do Saldo manda o turno do Saldo com `expediente`, e o "Desfazer" vai sem remoção', async () => {
      const { f, dialogo } = await abrirComChoque({
        'POST /api/escalas/e1/alocacoes': { status: 201, corpo: { ...COM_ZULU, desfazer: { alocacaoId: 'a-nova', remocaoId: null } } },
        'POST /api/resolucoes/desfazer': { status: 200, corpo: ESCALA },
      });
      await userEvent.click(within(linhaDe(dialogo, 'ADMIR')).getByRole('button', { name: /^Tirar do expediente e escalar aqui/ }));
      const confirmacao = await screen.findByRole('dialog');
      expect(confirmacao).toHaveTextContent(`CB ADMIR está de expediente em 02/${MES.slice(5)}. Tirar do expediente e escalar em Saldo?`);
      await responderConfirmacao('Tirar e escalar');
      await waitFor(() =>
        expect(corpoEnviado(f, 'POST /api/escalas/e1/alocacoes')).toEqual({ militarId: 'm-admir', data: doDia, turnoId: 't-saldo', guarnicaoId: 'g-abt', funcaoId: 'f-comb', resolverChoque: { expediente: true } }),
      );
      expect(await screen.findByText('CB ADMIR saiu do expediente e foi escalado em Saldo.')).toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
      await waitFor(() => expect(corpoEnviado(f, 'POST /api/resolucoes/desfazer')).toEqual({ alocacaoId: 'a-nova', remocaoId: null }));
    });

    it('a recusa da API (a vaga foi ocupada, a escala mudou) aparece no diálogo, e nada fecha', async () => {
      const { dialogo } = await abrirComChoque({ 'POST /api/escalas/e1/alocacoes': { status: 409, corpo: { erro: 'A função Combatente já está completa nesta guarnição.' } } });
      await userEvent.click(within(linhaDe(dialogo, 'XAVIER')).getByRole('button', { name: /^Tirar de JES e escalar aqui/ }));
      await responderConfirmacao('Tirar e escalar');
      expect(await within(screen.getByRole('dialog', { name: 'Escolher militar' })).findByText('A função Combatente já está completa nesta guarnição.')).toBeInTheDocument();
    });

    it('a busca também filtra quem está em choque', async () => {
      const { dialogo } = await abrirComChoque();
      await userEvent.type(within(dialogo).getByLabelText('Buscar por nome ou matrícula'), 'walt');
      expect(within(dialogo).getByText('WALTER')).toBeInTheDocument();
      expect(within(dialogo).queryByText('XAVIER')).toBeNull();
    });

    it('sem ninguém em choque, a seção nem aparece', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await within(dialogo).findByRole('button', { name: /ZULU/ });
      expect(within(dialogo).queryByRole('heading', { name: 'Em choque com esta vaga' })).toBeNull();
    });
  });

  it('quem pode entrar em mais de um serviço escolhe o serviço; o primeiro vem marcado', async () => {
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    const servico = await within(dialogo).findByLabelText('Serviço de YURI');
    expect(servico).toHaveValue('t-a');
    fireEvent.change(servico, { target: { value: 't-jes' } });
    await userEvent.click(within(dialogo).getByRole('button', { name: /YURI/ }));
    await waitFor(() => expect((corpoEnviado(f, 'POST /api/escalas/e1/alocacoes') as { turnoId: string }).turnoId).toBe('t-jes'));
  });

  it('dois cliques mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU, espera } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    const zulu = await within(dialogo).findByRole('button', { name: /ZULU/ });
    fireEvent.click(zulu);
    fireEvent.click(zulu);
    soltar();
    await waitFor(() => expect(chamadasA(f, 'POST /api/escalas/e1/alocacoes')).toBe(1));
  });

  it('o 409 da API aparece no diálogo, que continua aberto', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/escalas/e1/alocacoes': { status: 409, corpo: { erro: 'A função Combatente já está completa nesta guarnição.' } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('A função Combatente já está completa nesta guarnição.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sem ninguém apto, o diálogo diz isso e ainda mostra por que os outros ficaram de fora', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: { aptos: [], semVoluntariado: [], fora: [{ motivo: 'Afastado', quantidade: 1 }], acumular: [] } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    expect(await within(dialogo).findByText('Ninguém pode ocupar esta vaga agora.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Ficaram de fora: 1 afastado')).toBeInTheDocument();
  });

  describe('quem só não marcou o voluntariado (o escalante pode combinar direto)', () => {
    const SEM_VOL = 'Não marcou voluntariado neste horário';
    const dantas = { militarId: 'm-dantas', posto: 'SD', nomeGuerra: 'DANTAS', matricula: '990004-4', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's2', turnoId: 't-jes', nome: 'JES' }] };
    const COM_GRUPO = { ...CANDIDATOS, semVoluntariado: [dantas], fora: [{ motivo: SEM_VOL, quantidade: 1 }] };

    it('sem ninguém nesse grupo, não há botão "Mostrar"', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await within(dialogo).findByRole('button', { name: /ZULU/ });
      expect(within(dialogo).queryByRole('button', { name: 'Mostrar' })).not.toBeInTheDocument();
    });

    it('com gente no grupo, aparece "Mostrar" junto de "Ficaram de fora" e o grupo começa fechado; tocar abre, e de novo fecha', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: COM_GRUPO } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await within(dialogo).findByRole('button', { name: /ZULU/ });
      expect(within(dialogo).getByText('Ficaram de fora: 1 sem voluntariado neste horário')).toBeInTheDocument();
      expect(within(dialogo).queryByRole('button', { name: /DANTAS/ })).not.toBeInTheDocument();
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Mostrar' }));
      expect(within(dialogo).getByText('Sem voluntariado neste horário')).toBeInTheDocument();
      expect(within(dialogo).getByRole('button', { name: /DANTAS/ })).toBeInTheDocument();
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Esconder' }));
      expect(within(dialogo).queryByRole('button', { name: /DANTAS/ })).not.toBeInTheDocument();
    });

    it('escolher alguém do grupo manda a mesma alocação dos aptos, com o serviço do turno dele', async () => {
      const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: COM_GRUPO }, 'POST /api/escalas/e1/alocacoes': { status: 201, corpo: COM_ZULU } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await userEvent.click(await within(dialogo).findByRole('button', { name: 'Mostrar' }));
      await userEvent.click(within(dialogo).getByRole('button', { name: /DANTAS/ }));
      await waitFor(() =>
        expect(corpoEnviado(f, 'POST /api/escalas/e1/alocacoes')).toEqual({ militarId: 'm-dantas', data: `${MES}-02`, turnoId: 't-jes', guarnicaoId: 'g-abt', funcaoId: 'f-comb' }),
      );
    });

    it('o grupo respeita a busca por nome', async () => {
      api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: COM_GRUPO } });
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Dia 2' });
      const dialogo = await abrirVaga();
      await userEvent.click(await within(dialogo).findByRole('button', { name: 'Mostrar' }));
      await userEvent.type(within(dialogo).getByLabelText('Buscar por nome ou matrícula'), 'zulu');
      expect(within(dialogo).queryByRole('button', { name: /DANTAS/ })).not.toBeInTheDocument();
    });
  });

  it('a busca filtra por nome ou matrícula', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await within(dialogo).findByRole('button', { name: /ZULU/ });
    await userEvent.type(within(dialogo).getByLabelText('Buscar por nome ou matrícula'), '990003');
    expect(within(dialogo).queryByRole('button', { name: /ZULU/ })).toBeNull();
    expect(within(dialogo).getByRole('button', { name: /YURI/ })).toBeInTheDocument();
  });

  it('P1: "Remover da vaga" não pergunta: manda o DELETE, a escala nova entra e o aviso diz quem saiu de onde, com "Desfazer"', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...semMotor, remocaoId: 'r-MOTOR' } } });
    const confirmar = vi.spyOn(window, 'confirm');
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1));
    expect(confirmar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    const aviso = await screen.findByRole('status', { name: '' });
    expect(aviso).toHaveTextContent('SD MOTOR saiu de Motorista da ABT.');
    expect(within(aviso).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await waitFor(() => expect(within(secaoDoDia(1).querySelector('[data-faixa]') as HTMLElement).queryByRole('button', { name: /^Ações de MOTOR/ })).toBeNull());
    confirmar.mockRestore();
  });

  it('P1: "Desfazer" devolve o militar à vaga (POST na remoção) e a escala volta como estava', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...semMotor, remocaoId: 'r-MOTOR' } }, 'POST /api/remocoes/r-MOTOR/desfazer': { status: 200, corpo: ESCALA } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/remocoes/r-MOTOR/desfazer')).toBe(1));
    await waitFor(() => expect(within(secaoDoDia(1).querySelector('[data-faixa]') as HTMLElement).getAllByRole('button', { name: /^Ações de MOTOR/ }).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('P1 (Review Focus 2): se a escala mudou desde então, "Desfazer" mostra o motivo da API e não muda nada', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    api(ESCALA, {
      'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...semMotor, remocaoId: 'r-MOTOR' } },
      'POST /api/remocoes/r-MOTOR/desfazer': { status: 409, corpo: { erro: 'A escala mudou desde então. Não dá mais para desfazer.' } },
    });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    const erro = await screen.findByText('A escala mudou desde então. Não dá mais para desfazer.');
    expect(erro.closest('[role="status"]')).toHaveClass('border-alerta');
  });

  it('P2: "Trocar militar" tira quem está na vaga, sem perguntar, e abre a escolha da mesma vaga em seguida', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...semMotor, remocaoId: 'r-MOTOR' } }, [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Trocar militar');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1));
    const dialogo = await screen.findByRole('dialog', { name: 'Escolher militar' });
    expect(dialogo).toHaveTextContent('Motorista');
    // a escolha é da mesma vaga: a consulta dos candidatos traz o dia, a guarnição e a função de quem saiu
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`/candidatos`) && String(e).includes('funcaoId=f-mot'))).toBe(true));
    // enquanto a escolha está aberta, não há aviso (ele sairia do ar antes de a pessoa decidir)
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('P2: se a pessoa desiste da escolha, a vaga fica vazia e o aviso de quem saiu aparece, com "Desfazer"', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...semMotor, remocaoId: 'r-MOTOR' } }, [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/remocoes/r-MOTOR/desfazer': { status: 200, corpo: ESCALA } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Trocar militar');
    await screen.findByRole('dialog', { name: 'Escolher militar' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('SD MOTOR saiu de Motorista da ABT.');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/remocoes/r-MOTOR/desfazer')).toBe(1));
  });

  it('P2: "Trocar militar" tira quem está na vaga, sem perguntar, e abre a escolha da mesma vaga em seguida', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: semMotor }, [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    const confirmar = vi.spyOn(window, 'confirm');
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Trocar militar');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1));
    expect(confirmar).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog', { name: 'Escolher militar' });
    expect(dialogo).toHaveTextContent('Motorista');
    // a escolha é da mesma vaga: a consulta dos candidatos traz o dia, a guarnição e a função de quem saiu
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`/candidatos`) && String(e).includes('funcaoId=f-mot'))).toBe(true));
    confirmar.mockRestore();
  });

  it('P2: se a troca falha ao tirar quem está na vaga, mostra o erro e não abre a escolha', async () => {
    api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 404, corpo: { erro: 'Alocação não encontrada.' } } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Trocar militar');
    expect(await screen.findByRole('status')).toHaveTextContent('Alocação não encontrada.');
    expect(screen.queryByRole('dialog', { name: 'Escolher militar' })).toBeNull();
  });

  it('"Permitir de novo" na linha dos removidos manda o DELETE da remoção (libera a pré-escala; não escala ninguém)', async () => {
    const comRemovido: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 2 ? { ...d, faixas: [faixa(false, card(true, true), { removidos: [{ remocaoId: 'r1', militarId: 'm-x', nomeGuerra: 'XAVIER', servico: 'Pronto' }] }), d.faixas[1]!] } : d)) };
    const f = api(comRemovido, { 'DELETE /api/remocoes/r1': { status: 200, corpo: ESCALA } });
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    // os removidos vão para o painel "Removidos" do dia (não há mais a linha "Removidos:" solta entre os cards)
    expect(within(d3).queryByText('Removidos:')).toBeNull();
    expect(within(d3).getByRole('region', { name: 'Removidos' })).toHaveTextContent('XAVIER');
    await userEvent.click(within(d3).getByRole('button', { name: 'Permitir de novo XAVIER neste turno' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/remocoes/r1')).toBe(1));
  });

  it('erro ao remover aparece no aviso de erro, que espera a pessoa', async () => {
    api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 404, corpo: { erro: 'Alocação não encontrada.' } } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Alocação não encontrada.');
    expect(aviso).toHaveClass('border-alerta');
  });

  it('quem está em "Sem guarnição" tem "Remover do turno" no menu da placa; o aviso diz que saiu do turno', async () => {
    const solto = ocupante('SOLTO');
    const comSolto: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 2 ? { ...d, faixas: [faixa(false, card(true, true), { semPosto: [solto] }), d.faixas[1]!] } : d)) };
    const f = api(comSolto, { 'DELETE /api/alocacoes/a-SOLTO': { status: 200, corpo: { ...ESCALA, remocaoId: 'r-SOLTO' } } });
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    const grupo = within(d3).getByText('Sem guarnição').closest('div')!;
    expect(grupo).toHaveTextContent('SOLTO');
    await userEvent.click(within(grupo).getByRole('button', { name: 'Ações de SOLTO em Sem guarnição' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Remover do turno']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remover do turno' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-SOLTO')).toBe(1));
    expect(await screen.findByRole('status')).toHaveTextContent('SD SOLTO saiu do turno.');
  });

  it('depois de um 409 ao escalar, a escala e a lista voltam a buscar (o colega pode ter ocupado a vaga)', async () => {
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/escalas/e1/alocacoes': { status: 409, corpo: { erro: 'A função Combatente já está completa nesta guarnição.' } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
    await within(dialogo).findByRole('alert');
    await waitFor(() => expect(chamadasA(f, `GET /api/escalas/e1/mes/${MES}`)).toBe(2));
    await waitFor(() => expect(chamadasA(f, rotaCandidatos)).toBeGreaterThanOrEqual(2));
  });

  it('depois de um erro ao remover, a escala volta a buscar (a linha pode já ter sido tirada por outra pessoa)', async () => {
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 404, corpo: { erro: 'Alocação não encontrada.' } } });
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    await screen.findByRole('status');
    await waitFor(() => expect(chamadasA(f, `GET /api/escalas/e1/mes/${MES}`)).toBe(2));
  });

});


describe('acumular funções', () => {
  const sgt = { alocacaoId: 'a-CHEFE', militarId: 'm-chefe', posto: 'SGT', nomeGuerra: 'CHEFE', matricula: '990010-1', vaga: 'Chefe ABT' };
  const CANDIDATOS = {
    aptos: [{ militarId: 'm-zulu', posto: 'SD', nomeGuerra: 'ZULU', matricula: '990002-2', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] }],
    semVoluntariado: [],
    fora: [],
    acumular: [sgt],
  };
  const rotaCandidatos = `GET /api/escalas/e1/mes/${MES}/candidatos`;
  const abrirVaga = async () => {
    const faixaDoDia = secaoDoDia(2).querySelector('[data-faixa]') as HTMLElement;
    await userEvent.click(within(faixaDoDia).getAllByRole('button', { name: 'Escolher militar para Combatente de ABT' })[0]!);
    return screen.findByRole('dialog', { name: 'Escolher militar' });
  };
  // o dia 2, faixa do dia, depois de o CHEFE acumular o Combatente
  const comAcumulo: EscalaDoMes = {
    ...ESCALA,
    dias: ESCALA.dias.map((d, i) =>
      i !== 1 ? d : { ...d, obrigatoriasVazias: 0, faixas: [faixa(false, (() => { const c = card(true, true); c.funcoes[1]!.ocupantes = [{ ...ocupante('CHEFE'), alocacaoId: 'a-CHEFE', acumuloId: 'x1', acumulaCom: ['Chefe ABT'] }]; return c; })()), d.faixas[1]!] },
    ),
  };

  it('o diálogo oferece "Acumular com quem já está na faixa", com a vaga que o militar já ocupa', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    expect(await within(dialogo).findByText('Acumular com quem já está na faixa')).toBeInTheDocument();
    const linha = within(dialogo).getByRole('button', { name: /CHEFE/ });
    expect(linha).toHaveTextContent('hoje em Chefe ABT');
  });

  it('sem ninguém para acumular, a seção não aparece', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: { ...CANDIDATOS, acumular: [] } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await within(dialogo).findByRole('button', { name: /ZULU/ });
    expect(within(dialogo).queryByText('Acumular com quem já está na faixa')).toBeNull();
  });

  it('só com gente para acumular (nenhum apto), a frase "Ninguém pode ocupar" não aparece', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: { ...CANDIDATOS, aptos: [] } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await within(dialogo).findByRole('button', { name: /CHEFE/ });
    expect(within(dialogo).queryByText('Ninguém pode ocupar esta vaga agora.')).toBeNull();
  });

  it('clicar em quem acumula manda o POST, o diálogo fecha e o card mostra "acumula com Chefe ABT"', async () => {
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/alocacoes/a-CHEFE/acumulos': { status: 201, corpo: comAcumulo } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await userEvent.click(await within(dialogo).findByRole('button', { name: /CHEFE/ }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/alocacoes/a-CHEFE/acumulos')).toEqual({ guarnicaoId: 'g-abt', funcaoId: 'f-comb' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(secaoDoDia(2)).getByText('acumula com Chefe ABT')).toBeInTheDocument();
  });

  it('dois cliques mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/alocacoes/a-CHEFE/acumulos': { status: 201, corpo: comAcumulo, espera } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    const chefe = await within(dialogo).findByRole('button', { name: /CHEFE/ });
    fireEvent.click(chefe);
    fireEvent.click(chefe);
    soltar();
    await waitFor(() => expect(chamadasA(f, 'POST /api/alocacoes/a-CHEFE/acumulos')).toBe(1));
  });

  it('o 409 aparece no diálogo, que continua aberto', async () => {
    api(ESCALA, { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS }, 'POST /api/alocacoes/a-CHEFE/acumulos': { status: 409, corpo: { erro: 'Sem a CNH exigida' } } });
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    const dialogo = await abrirVaga();
    await userEvent.click(await within(dialogo).findByRole('button', { name: /CHEFE/ }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Sem a CNH exigida');
  });

  it('com duas outras vagas, a marca lista as duas', async () => {
    const duas: EscalaDoMes = { ...comAcumulo, dias: comAcumulo.dias.map((d, i) => (i !== 1 ? d : { ...d, faixas: [faixa(false, (() => { const c = card(true, true); c.funcoes[1]!.ocupantes = [{ ...ocupante('CHEFE'), acumuloId: 'x1', acumulaCom: ['Chefe ABT', 'Graduado de dia'] }]; return c; })()), d.faixas[1]!] })) };
    api(duas);
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 2' });
    expect(within(secaoDoDia(2)).getByText('acumula com Chefe ABT e Graduado de dia')).toBeInTheDocument();
  });

  it('P1: tirar um acúmulo não pergunta, manda o DELETE do acúmulo (não o da alocação) e "Desfazer" acumula de novo na mesma vaga', async () => {
    const f = api(comAcumulo, { 'DELETE /api/acumulos/x1': { status: 200, corpo: ESCALA }, 'POST /api/alocacoes/a-CHEFE/acumulos': { status: 201, corpo: comAcumulo } });
    abrir('/escala-do-mes');
    const d2 = await screen.findByRole('region', { name: 'Dia 2' });
    await agirNaPlaca(d2, 'Ações de CHEFE em Combatente ABT', 'Remover da vaga');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/acumulos/x1')).toBe(1));
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-CHEFE')).toBe(0);
    expect(await screen.findByRole('status')).toHaveTextContent('SD CHEFE saiu de Combatente da ABT.');
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/alocacoes/a-CHEFE/acumulos')).toBe(1));
    expect(corpoEnviado(f, 'POST /api/alocacoes/a-CHEFE/acumulos')).toEqual({ guarnicaoId: 'g-abt', funcaoId: 'f-comb' });
  });

  it('remover na vaga original de quem acumula manda o DELETE da alocação (ele sai das duas vagas)', async () => {
    const original: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i !== 2 ? d : { ...d, faixas: [faixa(false, (() => { const c = card(true, true); c.funcoes[0]!.ocupantes = [{ ...ocupante('CHEFE'), alocacaoId: 'a-CHEFE', acumulaCom: ['Graduado de dia'] }]; return c; })()), d.faixas[1]!] })) };
    const f = api(original, { 'DELETE /api/alocacoes/a-CHEFE': { status: 200, corpo: { ...ESCALA, remocaoId: 'r-CHEFE' } } });
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    await agirNaPlaca(d3, /^Ações de CHEFE/, 'Remover da vaga');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-CHEFE')).toBe(1));
  });

});

describe('cotas restantes na escala do mês', () => {
  const cota = (c: Partial<Cota>): Cota => ({ id: 'c1', mes: MES, servicoId: 's-jes', quantidade: 40, origem: 'interna', prioridade: 1, servico: 'JES', cor: '#6E56A8', distribuidas: 2, ...c });
  const COTAS = [cota({}), cota({ id: 'c2', servicoId: 's-bioma', servico: 'Bioma', cor: '#C08A1E', quantidade: 20, distribuidas: 0 })];
  // a escala tem Pronto e JES nos turnos; o Bioma não faz parte dela
  const comJes = (): EscalaDoMes => {
    const turnos = [
      { turnoId: 't-a', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'A' as const },
      { turnoId: 't-j', servicoId: 's-jes', servico: 'JES', cor: '#6E56A8', letra: 'A' as const },
    ];
    return { ...ESCALA, dias: ESCALA.dias.map((d) => ({ ...d, faixas: d.faixas.map((f) => (f.noturna ? f : { ...f, turnos })) })) };
  };

  it('mostra só as cotas dos serviços da escala, como "JES: restam 38 de 40"', async () => {
    api(comJes(), { 'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: COTAS } });
    abrir(`/escala-do-mes?escala=e1&mes=${MES}`);
    expect(await screen.findByText('JES: restam 38 de 40')).toBeInTheDocument();
    expect(screen.queryByText(/Bioma/)).toBeNull();
  });

  it('depois de remover alguém da escala, as cotas são buscadas de novo (o que sobra mudou)', async () => {
    const f = api(comJes(), { 'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: COTAS }, 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: { ...comJes(), remocaoId: 'r-MOTOR' } } });
    abrir(`/escala-do-mes?escala=e1&mes=${MES}`);
    await screen.findByText('JES: restam 38 de 40');
    expect(chamadasA(f, 'GET /api/unidades/u-1sb/cotas')).toBe(1);
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await agirNaPlaca(d1.querySelector('[data-faixa]') as HTMLElement, /^Ações de MOTOR/, 'Remover da vaga');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1));
    await waitFor(() => expect(chamadasA(f, 'GET /api/unidades/u-1sb/cotas')).toBe(2));
  });

  it('sem cotas para os serviços da escala, a linha não aparece', async () => {
    api(ESCALA, { 'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: COTAS } });
    abrir(`/escala-do-mes?escala=e1&mes=${MES}`);
    await screen.findByRole('region', { name: 'Dia 1' });
    expect(screen.queryByRole('list', { name: 'Cotas restantes' })).toBeNull();
  });
});
