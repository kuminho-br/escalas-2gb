import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlocoDaGrade, GradeDoMes, LinhaDaGrade, PainelDoDia } from 'contratos';
import { describe, expect, it } from 'vitest';
import { guardarEstadoDoMenu } from '@/lib/estado-do-menu';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// A tela cheia da Grade (6.70, Task 7). Dados fictícios (D7).
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00' };
const linha = (nome: string, extra: Partial<LinhaDaGrade> = {}): LinhaDaGrade => ({ militarId: `m-${nome}`, posto: 'SD', nomeGuerra: nome, matricula: '997001-1', jornada: 'pronto', dias: {}, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra });
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'eq-alfa', nome: 'Alfa', linhas: [linha('CABO', { dias: { [DIA]: [BLOCO] } })] }, { chave: 'eq-bravo', nome: 'Bravo', linhas: [linha('DELTA')] }] };
const PAINEL: PainelDoDia = { militar: { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', equipe: 'Alfa', jornada: 'pronto', cnh: [], voluntarioJes: false }, data: DIA, afastamento: null, disponibilidade: [], servicos: [], choques: [], opcoes: [] };
const entrar = async (caminho: string) => {
  simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: GRADE },
    [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: PAINEL },
  });
  const router = abrir(caminho);
  await screen.findByRole('heading', { name: 'Grade geral', level: 1 });
  return router;
};
const menu = () => screen.queryByRole('navigation', { name: 'Navegação principal' });
const cabecalho = () => screen.queryByRole('navigation', { name: 'Unidade' });

describe('"Expandir grade"', () => {
  it('fica ao lado do título e leva à tela cheia: saem o menu, o cabeçalho, o título e os filtros', async () => {
    const router = await entrar(`/grade?mes=${MES}`);
    await screen.findByRole('button', { name: 'Abrir a ficha de SD CABO' });
    expect(menu()).not.toBeNull();
    expect(screen.getByLabelText('Buscar militar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir grade' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ cheia: true }));
    expect(menu()).toBeNull();
    expect(cabecalho()).toBeNull();
    expect(screen.queryByLabelText('Buscar militar')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Equipe' })).toBeNull();
    // o título continua para o leitor de tela, mas não aparece
    expect(screen.getByRole('heading', { name: 'Grade geral', level: 1 }).className).toContain('sr-only');
    // a tabela continua
    expect(screen.getByRole('button', { name: 'Abrir a ficha de SD CABO' })).toBeInTheDocument();
  });

  it('a barra fina: o mês, as equipes que valem e "Recolher grade"', async () => {
    await entrar(`/grade?mes=${MES}&cheia=true&equipes=%5B%22eq-bravo%22%5D`);
    const barra = await screen.findByRole('region', { name: 'Barra da tela cheia' });
    expect(within(barra).getByText('dez. 2026')).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
    expect(await within(barra).findByText('Bravo')).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Recolher grade' })).toBeInTheDocument();
  });

  it('sem equipe escolhida a barra diz "Todas as equipes"; com busca, ela vem entre aspas', async () => {
    await entrar(`/grade?mes=${MES}&cheia=true&busca=cabo`);
    const barra = await screen.findByRole('region', { name: 'Barra da tela cheia' });
    expect(barra).toHaveTextContent('Todas as equipes, "cabo"');
    // a legenda fica no computador, abaixo da barra
    expect(await screen.findByRole('list', { name: 'Legenda' })).toBeInTheDocument();
  });

  it('o mês da barra troca o mês da tela cheia', async () => {
    const router = await entrar(`/grade?mes=${MES}&cheia=true`);
    await userEvent.click(within(await screen.findByRole('region', { name: 'Barra da tela cheia' })).getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ mes: '2027-01', cheia: true }));
  });
});

describe('"Recolher grade"', () => {
  it('volta ao normal, com o menu no estado guardado', async () => {
    guardarEstadoDoMenu('u1', 'recolhido');
    const router = await entrar(`/grade?mes=${MES}&cheia=true`);
    expect(menu()).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Recolher grade' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('cheia'));
    expect(menu()!.className).toContain('md:w-[84px]');
    expect(cabecalho()).not.toBeNull();
    expect(screen.getByLabelText('Buscar militar')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Barra da tela cheia' })).toBeNull();
  });

  it('a tecla Esc também recolhe', async () => {
    const router = await entrar(`/grade?mes=${MES}&cheia=true`);
    await screen.findByRole('button', { name: 'Recolher grade' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('cheia'));
  });

  it('com o painel do dia aberto, o Esc fecha o painel e a tela cheia continua', async () => {
    const router = await entrar(`/grade?mes=${MES}&cheia=true&militar=m-CABO&dia=${DIA}`);
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('militar'));
    expect(router.state.location.search).toMatchObject({ cheia: true });
    expect(painel).not.toBeInTheDocument();
  });
});

describe('dentro da tela cheia', () => {
  it('a célula abre o dia (com o painel ao lado) e o nome abre a ficha, como fora dela', async () => {
    const router = await entrar(`/grade?mes=${MES}&cheia=true`);
    await screen.findByRole('button', { name: 'Abrir a ficha de SD CABO' });
    const linhaDoCabo = document.querySelector<HTMLElement>('tr[data-militar="m-CABO"]')!;
    await userEvent.click(linhaDoCabo.querySelector<HTMLElement>(`[data-data="${DIA}"]`)!);
    await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    expect(router.state.location.search).toMatchObject({ cheia: true, militar: 'm-CABO', dia: DIA });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir a ficha de SD CABO' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ ficha: 'm-CABO' }));
  });
});
