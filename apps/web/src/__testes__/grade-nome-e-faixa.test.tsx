import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AfastamentoNaGrade, GradeDoMes, GrupoDaGrade, LinhaDaGrade } from 'contratos';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabelaDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// A célula do nome, a faixa da equipe, o filtro dos afastados e as equipes (6.70, Task 4). Dados fictícios (D7).
const MES = '2026-12';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: dia(i + 1), diaDaSemana: (2 + i) % 7, feriado: null }));
const af = (tipo: string, inicio: string, fim: string): AfastamentoNaGrade => ({ tipo, inicio, fim, inicioReal: inicio, fimReal: fim });
const linha = (nomeGuerra: string, extra: Partial<LinhaDaGrade> = {}): LinhaDaGrade => ({
  militarId: `m-${nomeGuerra}`, posto: 'SD', nomeGuerra, matricula: '997001-1', jornada: 'pronto', dias: {}, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra,
});
const grupo = (chave: string, nome: string, linhas: LinhaDaGrade[]): GrupoDaGrade => ({ chave, nome, linhas });
const gradeCom = (grupos: GrupoDaGrade[]): GradeDoMes => ({ mes: MES, dias: DIAS, grupos });
const tabela = (grade: GradeDoMes, aoAbrirFicha?: (id: string) => void) =>
  render(<TabelaDaGrade grade={grade} grupos={grade.grupos} maximos={{ pjes: 0, diarias: 0 }} escolhida={null} aoEscolher={() => undefined} aoAbrirFicha={aoAbrirFicha} recolhidas={new Set()} aoAlternar={() => undefined} />);
const linhaDe = (nome: string) => document.querySelector<HTMLElement>(`tr[data-militar="m-${nome}"]`)!;

describe('a célula do nome', () => {
  const grade = gradeCom([grupo('a', 'Alfa', [linha('CABO')])]);

  it('é um botão só, da borda à borda, sem sublinhado ao passar o mouse: fundo vinho suave e o ícone da ficha no canto', () => {
    tabela(grade, () => undefined);
    const th = linhaDe('CABO').querySelector('th')!;
    const botoes = within(th).getAllByRole('button');
    expect(botoes).toHaveLength(1);
    const b = botoes[0]!;
    expect(b).toHaveAttribute('data-abrir-ficha');
    expect(b).toHaveAccessibleName('Abrir a ficha de SD CABO');
    expect(b).toHaveTextContent('SD');
    expect(b).toHaveTextContent('CABO');
    expect(b).toHaveTextContent('997001-1');
    expect(b.className).not.toContain('hover:underline');
    expect(b.className).toContain('hover:bg-vinho/8');
    expect(b.className).toContain('w-full');
    // o contorno do foco fica por dentro da célula
    expect(b.className).toContain('focus-visible:-outline-offset-4');
    const icone = b.querySelector('[data-icone-da-ficha]')!;
    expect(icone).toHaveAttribute('aria-hidden', 'true');
    const classes = icone.getAttribute('class') ?? '';
    expect(classes).toContain('opacity-0');
    expect(classes).toContain('group-hover/nome:opacity-100');
    expect(classes).toContain('group-focus-visible/nome:opacity-100');
  });

  it('o clique em qualquer lugar do botão abre a ficha', async () => {
    const abrirFicha = vi.fn();
    tabela(grade, abrirFicha);
    await userEvent.click(within(linhaDe('CABO')).getByText('997001-1'));
    expect(abrirFicha).toHaveBeenCalledWith('m-CABO');
  });

  it('quem só consulta a unidade não tem botão', () => {
    tabela(grade);
    expect(within(linhaDe('CABO').querySelector('th')!).queryByRole('button')).toBeNull();
    expect(linhaDe('CABO').querySelector('th')).toHaveTextContent('CABO');
  });
});

describe('a faixa da equipe', () => {
  const original = Element.prototype.scrollIntoView;
  beforeEach(() => {
    // a tabela rola até o dia de hoje ao abrir; o jsdom não tem essa função
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    Element.prototype.scrollIntoView = original;
  });
  const hojeEm = (data: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${data}T15:00:00Z`) });
  const faixaDe = (chave: string) => document.querySelector<HTMLElement>(`tr[data-grupo="${chave}"]`)!;
  const grade = gradeCom([
    grupo('a', 'Alfa', [linha('UM', { afastamentos: [af('Férias', dia(8), dia(12))] }), linha('DOIS', { afastamentos: [af('LTS', dia(1), dia(31))] }), linha('TRES')]),
    grupo('b', 'Bravo', [linha('QUATRO', { afastamentos: [af('Curso', dia(10), dia(10))] }), linha('CINCO', { afastamentos: [af('Férias', dia(20), dia(25))] })]),
    grupo('c', 'Charlie', [linha('SEIS')]),
  ]);

  it('mostra "1 afastado hoje" e "N afastados hoje" só quando há (a conta é dos períodos, pelo dia de hoje)', () => {
    hojeEm(dia(10));
    tabela(grade);
    expect(within(faixaDe('a')).getByText('2 afastados hoje')).toBeInTheDocument();
    expect(within(faixaDe('b')).getByText('1 afastado hoje')).toBeInTheDocument();
    expect(within(faixaDe('c')).queryByText(/afastado/)).toBeNull();
  });

  it('fora do mês corrente, não aparece', () => {
    hojeEm('2026-11-10');
    tabela(grade);
    expect(screen.queryByText(/afastados? hoje/)).toBeNull();
  });

  it('acompanha as linhas que aparecem (a faixa conta só as linhas do grupo na tela)', () => {
    hojeEm(dia(10));
    const sem = gradeCom([grupo('a', 'Alfa', [linha('UM', { afastamentos: [af('Férias', dia(8), dia(12))] })])]);
    tabela(sem);
    expect(within(faixaDe('a')).getByText('1 afastado hoje')).toBeInTheDocument();
  });
});

const GRADE_DA_ROTA = gradeCom([
  grupo('eq-alfa', 'Alfa', [linha('PARTE', { afastamentos: [af('Férias', dia(8), dia(12))] }), linha('MESTODO', { afastamentos: [af('LTS', dia(1), dia(31))] }), linha('LIVRE')]),
  grupo('eq-bravo', 'Bravo', [linha('BRAVO')]),
]);
const apiDaRota = (grade: GradeDoMes) => simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: grade } });
const nomesNaTela = () => [...document.querySelectorAll('tr[data-militar]')].map((tr) => tr.getAttribute('data-militar'));

describe('o filtro dos afastados', () => {
  it('"Esconder quem está afastado o mês todo" tira só quem está afastado em todos os dias do mês, e a contagem da faixa acompanha', async () => {
    apiDaRota(GRADE_DA_ROTA);
    const router = abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect(nomesNaTela()).toEqual(['m-PARTE', 'm-MESTODO', 'm-LIVRE', 'm-BRAVO']);
    const faixaAlfa = () => document.querySelector<HTMLElement>('tr[data-grupo="eq-alfa"]')!;
    expect(faixaAlfa()).toHaveTextContent('3 militares');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Esconder quem está afastado o mês todo' }));
    await waitFor(() => expect(nomesNaTela()).toEqual(['m-PARTE', 'm-LIVRE', 'm-BRAVO']));
    expect(faixaAlfa()).toHaveTextContent('2 militares');
    expect(router.state.location.search).toMatchObject({ esconderAfastados: true });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Esconder quem está afastado o mês todo' }));
    await waitFor(() => expect(nomesNaTela()).toHaveLength(4));
  });

  it('vindo do endereço, o filtro já está ligado', async () => {
    apiDaRota(GRADE_DA_ROTA);
    abrir(`/grade?mes=${MES}&esconderAfastados=true`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect(screen.getByRole('checkbox', { name: 'Esconder quem está afastado o mês todo' })).toBeChecked();
    expect(nomesNaTela()).not.toContain('m-MESTODO');
  });
});

describe('as equipes', () => {
  const equipes = (n: number) => gradeCom(Array.from({ length: n }, (_, i) => grupo(`eq-${i}`, `Equipe ${i + 1}`, [linha(`M${i}`)])));

  it('até seis equipes, botões lado a lado', async () => {
    apiDaRota(equipes(6));
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const grupoDeEquipes = screen.getByRole('group', { name: 'Equipe' });
    expect(within(grupoDeEquipes).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todas', 'Equipe 1', 'Equipe 2', 'Equipe 3', 'Equipe 4', 'Equipe 5', 'Equipe 6']);
    expect(screen.queryByRole('button', { name: 'Equipes' })).toBeNull();
  });

  it('com sete ou mais, um botão "Equipes" com a lista de marcação', async () => {
    apiDaRota(equipes(7));
    const router = abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect(screen.queryByRole('group', { name: 'Equipe' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Equipes' }));
    const lista = await screen.findByRole('group', { name: 'Equipes' });
    expect(within(lista).getAllByRole('checkbox')).toHaveLength(8);
    expect(within(lista).getByRole('checkbox', { name: 'Todas' })).toBeChecked();
    await userEvent.click(within(lista).getByRole('checkbox', { name: 'Equipe 3' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ equipes: ['eq-2'] }));
    expect(within(lista).getByRole('checkbox', { name: 'Equipe 3' })).toBeChecked();
    expect(within(lista).getByRole('checkbox', { name: 'Todas' })).not.toBeChecked();
    // o botão diz quantas valem
    expect(screen.getByRole('button', { name: /Equipes/ })).toHaveTextContent('1');
  });
});
