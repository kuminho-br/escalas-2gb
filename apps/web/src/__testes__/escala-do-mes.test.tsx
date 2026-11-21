import type { Cota, CardDaGuarnicao, DiaDaEscala, EscalaDoMes, FaixaDoDia, LinhaEscala, OcupanteDaVaga } from 'contratos';
import { somarMeses } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Escala fictícia de 3 dias, uma guarnição (ABT: Motorista 1–1 CNH D, Combatente 1–2), duas faixas por dia.
const MES = mesAtual();
const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true }, { id: 'e9', nome: 'Velha', ativa: false, servicos: [], montaBlocosVoluntariado: true }];

const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, acumuloId: null, acumulaCom: [], militarId: `m-${nome}`, posto: 'SD BM', nomeGuerra: nome, matricula: '990001-1', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
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
    const router = abrir('/grade');
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
    expect(etiqueta).toHaveAttribute('data-etiqueta-servico');
    expect(etiqueta).toHaveStyle({ backgroundColor: '#C97A00' });
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
    expect([...f.querySelectorAll('[data-etiqueta-servico]')].map((e) => e.textContent)).toEqual(['Pronto', 'JES']);
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

  it('vaga obrigatória vazia é "Escolher militar"; a vaga extra (entre o mínimo e o máximo) fica com a etiqueta "opcional"', async () => {
    api();
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    // dia 3, faixa do dia: Motorista (1–1) e Combatente (1–2) com 1 ocupante cada: sobra a vaga opcional do Combatente
    const botoes = within(d3.querySelector('[data-faixa]') as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).not.toHaveAttribute('data-obrigatoria');
    expect(within(botoes[0]!).getByText('opcional')).toBeInTheDocument();
    const d1 = secaoDoDia(1);
    const noite = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    // Motorista e Combatente vazios (obrigatórias) e a segunda vaga do Combatente (opcional)
    expect(noite.map((b) => b.hasAttribute('data-obrigatoria'))).toEqual([true, true, false]);
    // só a extra tem a etiqueta
    expect(noite.map((b) => within(b).queryByText('opcional') !== null)).toEqual([false, false, true]);
  });

  it('cada função da guarnição é um painel próprio, com o cabeçalho da função, e os cards se alinham pelo topo', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const cardDoDia = (d1.querySelector('[data-cards-do-turno] > div') as HTMLElement);
    const paineis = cardDoDia.querySelectorAll('[data-painel-funcao]');
    expect([...paineis].map((p) => p.querySelector('[data-cabecalho-funcao]')?.textContent)).toEqual(['Motorista (CNH D)', 'Combatente']);
    expect(d1.querySelector('[data-cards-do-turno]')).toHaveClass('items-start');
  });

  it('a frase "Falta 1 Motorista…" não aparece escrita em card nenhum: só o contador, e a frase fica no title e no nome acessível', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    expect(within(d1).queryByText(/^Falta\b.*(Motorista|Combatente)/)).toBeNull();
  });

  it('o cabeçalho do card mostra o contador "Faltam N" (N = vagas obrigatórias vazias) no lugar do triângulo, e nada quando N é 0', async () => {
    api();
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    // dia 1, faixa do dia: falta 1 Motorista e 1 Combatente
    const contador = within(d1).getByText('Faltam 2');
    expect(contador).toHaveAttribute('title', 'Falta 1 Motorista (CNH D). Falta 1 Combatente');
    expect(contador).toHaveAttribute('aria-label', 'Falta 1 Motorista (CNH D). Falta 1 Combatente');
    expect(d1.querySelector('.lucide-triangle-alert')).toBeNull();
    // o card completo não mostra contador nenhum (e segue com o ícone de completa)
    const completo = within(d1).getByRole('img', { name: 'Completa' }).closest('div[class*="rounded-lg"]') as HTMLElement;
    expect(within(completo).queryByText(/^Faltam?\b/)).toBeNull();
  });

  it('a vaga vazia é um botão de contorno tracejado, sem as listras amarelas e sem a cor de nenhum serviço', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const vagas = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    expect(vagas).toHaveLength(3);
    for (const v of vagas) {
      expect(v.tagName).toBe('BUTTON');
      expect(v).toHaveClass('border-dashed');
      // a barra vinho se apoia na vaga: ela é o ponto de referência da posição
      expect(v).toHaveClass('relative');
      expect(v.className).not.toMatch(/repeating-linear-gradient|F2C200|FFF3B8/);
      // a cor de serviço é só de quem já está escalado: a vaga não leva estilo nenhum
      expect(v).not.toHaveAttribute('style');
      expect(v).toHaveClass('bg-superficie');
    }
  });

  it('a vaga obrigatória tem a barra vinho à esquerda; a extra não tem barra e diz "opcional"', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const vagas = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    // Motorista e Combatente vazios (obrigatórias) e a segunda vaga do Combatente (opcional)
    expect(vagas.map((v) => v.querySelector('[data-barra]') !== null)).toEqual([true, true, false]);
    expect(vagas.map((v) => v.hasAttribute('data-obrigatoria'))).toEqual([true, true, false]);
    expect(vagas[0]!.querySelector('[data-barra]')).toHaveClass('bg-vinho');
    expect(within(vagas[2]!).getByText('opcional')).toBeInTheDocument();
    expect(vagas.slice(0, 2).map((v) => within(v).queryByText('opcional'))).toEqual([null, null]);
  });

  it('ao passar o mouse e com o foco do teclado a vaga muda de estado visível', async () => {
    api();
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const d1 = secaoDoDia(1);
    const [obrigatoria, , extra] = within(d1.querySelectorAll('[data-faixa]')[1] as HTMLElement).getAllByRole('button', { name: /^Escolher militar/ });
    for (const v of [obrigatoria!, extra!]) {
      // mouse: o contorno fica contínuo e escuro, e o fundo escurece um pouco; teclado: o anel escuro de foco do site
      expect(v).toHaveClass('hover:border-solid', 'hover:border-apagado', 'hover:bg-passa', 'hover:text-tinta');
      expect(v).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-tinta');
    }
    // o contorno da obrigatória é o do tema (3:1 com o fundo); o da extra é mais claro
    expect(obrigatoria).toHaveClass('border-encaixe');
    expect(extra).toHaveClass('border-encaixe-claro');
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
    const aviso = await screen.findByText(/Nenhuma escala ativa\./);
    expect(within(aviso).getByRole('link', { name: 'Escalas' })).toHaveAttribute('href', '/escalas');
  });
});

describe('escolher militar e remover', () => {
  const CANDIDATOS = {
    aptos: [
      { militarId: 'm-zulu', posto: 'SD BM', nomeGuerra: 'ZULU', matricula: '990002-2', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] },
      { militarId: 'm-yuri', posto: 'CB BM', nomeGuerra: 'YURI', matricula: '990003-3', equipe: null, jornada: 'adm', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }, { servicoId: 's2', turnoId: 't-jes', nome: 'JES' }] },
    ],
    semVoluntariado: [],
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
    const dantas = { militarId: 'm-dantas', posto: 'SD BM', nomeGuerra: 'DANTAS', matricula: '990004-4', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's2', turnoId: 't-jes', nome: 'JES' }] };
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

  it('Remover pergunta antes; confirmando manda o DELETE e a escala nova entra', async () => {
    const semMotor: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 0 ? { ...d, faixas: [faixa(false, card(false, true)), d.faixas[1]!] } : d)) };
    const f = api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: semMotor } });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    const remover = within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: 'Remover MOTOR' });
    await userEvent.click(remover);
    expect(confirmar).toHaveBeenLastCalledWith('Remover MOTOR de ABT, dia 1? Ele não volta para este turno quando a pré-escala for gerada de novo.');
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(0);
    await userEvent.click(remover);
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1));
    await waitFor(() => expect(within(secaoDoDia(1).querySelector('[data-faixa]') as HTMLElement).queryByRole('button', { name: 'Remover MOTOR' })).toBeNull());
    confirmar.mockRestore();
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

  it('erro ao remover aparece na tela', async () => {
    api(ESCALA, { 'DELETE /api/alocacoes/a-MOTOR': { status: 404, corpo: { erro: 'Alocação não encontrada.' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await userEvent.click(within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: 'Remover MOTOR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alocação não encontrada.');
  });

  it('quem está em "Sem guarnição" também tem Remover', async () => {
    const solto = ocupante('SOLTO');
    const comSolto: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i === 2 ? { ...d, faixas: [faixa(false, card(true, true), { semPosto: [solto] }), d.faixas[1]!] } : d)) };
    const f = api(comSolto, { 'DELETE /api/alocacoes/a-SOLTO': { status: 200, corpo: ESCALA } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    const linha = within(d3).getByText('Sem guarnição:').closest('p')!;
    expect(linha).toHaveTextContent('SOLTO');
    await userEvent.click(within(d3).getByRole('button', { name: 'Remover SOLTO' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-SOLTO')).toBe(1));
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escala-do-mes');
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await userEvent.click(within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: 'Remover MOTOR' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(chamadasA(f, `GET /api/escalas/e1/mes/${MES}`)).toBe(2));
  });
});


describe('acumular funções', () => {
  const sgt = { alocacaoId: 'a-CHEFE', militarId: 'm-chefe', posto: 'SGT BM', nomeGuerra: 'CHEFE', matricula: '990010-1', vaga: 'Chefe ABT' };
  const CANDIDATOS = {
    aptos: [{ militarId: 'm-zulu', posto: 'SD BM', nomeGuerra: 'ZULU', matricula: '990002-2', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] }],
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

  it('Remover num acúmulo pergunta "Tirar…" e manda o DELETE do acúmulo, não o da alocação', async () => {
    const f = api(comAcumulo, { 'DELETE /api/acumulos/x1': { status: 200, corpo: ESCALA } });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escala-do-mes');
    const d2 = await screen.findByRole('region', { name: 'Dia 2' });
    await userEvent.click(within(d2).getByRole('button', { name: 'Tirar CHEFE de Combatente ABT' }));
    expect(confirmar).toHaveBeenLastCalledWith('Tirar CHEFE de Combatente ABT? Ele continua em Chefe ABT.');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/acumulos/x1')).toBe(1));
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-CHEFE')).toBe(0);
  });

  it('Remover na vaga original de quem acumula avisa de onde ele sai também', async () => {
    const original: EscalaDoMes = { ...ESCALA, dias: ESCALA.dias.map((d, i) => (i !== 2 ? d : { ...d, faixas: [faixa(false, (() => { const c = card(true, true); c.funcoes[0]!.ocupantes = [{ ...ocupante('CHEFE'), alocacaoId: 'a-CHEFE', acumulaCom: ['Graduado de dia'] }]; return c; })()), d.faixas[1]!] })) };
    const f = api(original, { 'DELETE /api/alocacoes/a-CHEFE': { status: 200, corpo: ESCALA } });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escala-do-mes');
    const d3 = await screen.findByRole('region', { name: 'Dia 3' });
    await userEvent.click(within(d3).getByRole('button', { name: 'Remover CHEFE' }));
    expect(confirmar).toHaveBeenLastCalledWith('Remover CHEFE de ABT, dia 3? Ele não volta para este turno quando a pré-escala for gerada de novo. Sai também de: Graduado de dia.');
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
    const f = api(comJes(), { 'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: COTAS }, 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: comJes() } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir(`/escala-do-mes?escala=e1&mes=${MES}`);
    await screen.findByText('JES: restam 38 de 40');
    expect(chamadasA(f, 'GET /api/unidades/u-1sb/cotas')).toBe(1);
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await userEvent.click(within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: 'Remover MOTOR' }));
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
