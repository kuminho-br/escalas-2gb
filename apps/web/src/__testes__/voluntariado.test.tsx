import type { MilitarDoVoluntariado, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { somarMeses } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Cenário fictício: 5 militares, 2 já lançados; o mês de lançamento é o mês seguinte ao atual.
const MES = somarMeses(mesAtual(), 1);
const militar = (id: string, nomeGuerra: string, extra: Partial<MilitarDoVoluntariado> = {}): MilitarDoVoluntariado => ({
  militarId: id, posto: 'SD BM', nomeGuerra, matricula: `99002${id.slice(1)}-1`, equipe: 'Alfa', jornada: 'pronto', voluntarioJes: true, lancado: false, turnos: 0, dias: 0, ...extra,
});
const LISTA: VoluntariadoDoMes = {
  mes: MES,
  militares: [
    militar('m3', 'ANDRADE', { voluntarioJes: false }),
    militar('m1', 'CABRAL', { lancado: true, turnos: 12, dias: 9 }),
    militar('m4', 'DANTAS'),
    militar('m2', 'ESTEVES', { lancado: true, turnos: 4, dias: 4 }),
    militar('m5', 'FALCAO'),
  ],
};
const DEPOIS_DO_ANDRADE: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => (m.militarId === 'm3' ? { ...m, lancado: true, turnos: 1, dias: 1 } : m)) };
const doMilitar = (id: string, extra: Partial<VoluntariadoDoMilitar> = {}): VoluntariadoDoMilitar => ({ militarId: id, mes: MES, marcas: [], doMesAnterior: [], folgas: null, ...extra });
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;

function api(extra: Parameters<typeof simularApi>[0] = {}, lista: VoluntariadoDoMes = LISTA) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/voluntariado/${MES}`]: { status: 200, corpo: lista },
    [`GET /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m3') },
    [`GET /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m4') },
    [`GET /api/militares/m1/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m1', { marcas: [{ data: dia(5), turno: 'A' }, { data: dia(5), turno: 'B' }] }) },
    ...extra,
  });
}
const calendario = () => screen.getByRole('group', { name: 'Calendário do voluntariado' });
const turno = (n: number, t: 'A' | 'B') => within(calendario()).getByRole('button', { name: `Dia ${n}, turno ${t}` });
const salvar = () => screen.getByRole('button', { name: 'Salvar e ir para o próximo' });

describe('voluntariado: lista e cabeçalho', () => {
  it('o trilho leva a "Voluntariado", que abre no mês seguinte', async () => {
    const f = api();
    const router = abrir('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Voluntariado' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/voluntariado'));
    expect(await screen.findByRole('heading', { name: 'Voluntariado' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mês')).toHaveValue(MES);
    await waitFor(() => expect(chamadasA(f, `GET /api/unidades/u-1sb/voluntariado/${MES}`)).toBe(1));
  });

  it('a lista separa "Já lançados" (com os dias) de "Faltam lançar", e o primeiro que falta já vem aberto', async () => {
    api();
    abrir('/voluntariado');
    const lancados = await screen.findByRole('region', { name: 'Já lançados' });
    expect(within(lancados).getByText('CABRAL').closest('li')).toHaveTextContent('9 dias');
    expect(within(lancados).getByText('ESTEVES').closest('li')).toHaveTextContent('4 dias');
    const faltam = screen.getByRole('region', { name: 'Faltam lançar' });
    expect(within(faltam).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('ANDRADE'), expect.stringContaining('DANTAS'), expect.stringContaining('FALCAO')]);
    expect(within(faltam).getByText('ANDRADE').closest('li')).toHaveTextContent('lançando');
    expect(await screen.findByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
  });

  it('o cabeçalho diz a equipe, avisa de quem não é voluntário JES e mostra a legenda dos turnos', async () => {
    api();
    abrir('/voluntariado');
    expect(await screen.findByText(/Equipe Alfa\./)).toHaveTextContent('Não é voluntário JES: as marcações valem só para diárias.');
    expect(screen.getByText('A 08h às 20h')).toBeInTheDocument();
    expect(screen.getByText('B 20h às 08h')).toBeInTheDocument();
  });

  it('a busca filtra a lista por nome ou matrícula', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('region', { name: 'Faltam lançar' });
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), 'dant');
    const faltam = screen.getByRole('region', { name: 'Faltam lançar' });
    expect(within(faltam).queryByText('ANDRADE')).toBeNull();
    expect(within(faltam).getByText('DANTAS')).toBeInTheDocument();
  });

  it('abrir um já lançado mostra as marcações dele', async () => {
    api();
    abrir(`/voluntariado?militar=m1`);
    await screen.findByRole('heading', { name: 'SD BM CABRAL' });
    await waitFor(() => expect(turno(5, 'A')).toHaveAttribute('aria-pressed', 'true'));
    expect(turno(5, 'B')).toHaveAttribute('aria-pressed', 'true');
    expect(turno(6, 'A')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2 turnos em 1 dia.')).toBeInTheDocument();
  });
});

describe('voluntariado: calendário e salvar', () => {
  it('clicar num turno marca só ele; o rodapé conta turnos e dias', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(screen.getByText('Nenhum turno marcado.')).toBeInTheDocument();
    await userEvent.click(turno(5, 'A'));
    expect(turno(5, 'A')).toHaveAttribute('aria-pressed', 'true');
    expect(turno(5, 'B')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 turno em 1 dia.')).toBeInTheDocument();
    await userEvent.click(turno(6, 'B'));
    expect(screen.getByText('2 turnos em 2 dias.')).toBeInTheDocument();
  });

  it('clicar no número do dia marca os dois turnos; de novo, desmarca os dois', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(within(calendario()).getByRole('button', { name: 'Dia 7: marcar os dois turnos' }));
    expect(turno(7, 'A')).toHaveAttribute('aria-pressed', 'true');
    expect(turno(7, 'B')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(calendario()).getByRole('button', { name: 'Dia 7: desmarcar os dois turnos' }));
    expect(turno(7, 'A')).toHaveAttribute('aria-pressed', 'false');
    expect(turno(7, 'B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Limpar" zera o que está marcado', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(turno(5, 'A'));
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('Nenhum turno marcado.')).toBeInTheDocument();
  });

  it('"Salvar e ir para o próximo" manda o mês do militar e abre o próximo que falta lançar', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(turno(5, 'A'));
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ marcas: [{ data: dia(5), turno: 'A' }] }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    expect((router.state.location.search as { militar?: string }).militar).toBe('m4');
    const lancados = screen.getByRole('region', { name: 'Já lançados' });
    expect(within(lancados).getByText('ANDRADE').closest('li')).toHaveTextContent('1 dia');
  });

  it('salvar sem nenhuma marcação também lança', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ marcas: [] }));
  });

  it('dois cliques em Salvar mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE, espera } });
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const botao = salvar();
    fireEvent.click(botao);
    fireEvent.click(botao);
    soltar();
    await waitFor(() => expect(chamadasA(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toBe(1));
  });

  it('o erro da API aparece acima dos botões e as marcações ficam', async () => {
    api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 409, corpo: { erro: 'Este militar não está lotado na seção.' } } });
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(turno(5, 'A'));
    await userEvent.click(salvar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Este militar não está lotado na seção.');
    expect(turno(5, 'A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('quando não sobra ninguém para lançar, a tela diz isso e fica no militar', async () => {
    const todos: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => ({ ...m, lancado: true })) };
    api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: todos } }, { ...LISTA, militares: LISTA.militares.map((m) => (m.militarId === 'm3' ? m : { ...m, lancado: true })) });
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(salvar());
    expect(await screen.findByText('Todos os militares deste mês foram lançados.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
  });

  it('trocar de militar com marcação não salva pergunta antes; cancelando, fica no mesmo (Review Focus 5)', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(turno(5, 'A'));
    await userEvent.click(within(screen.getByRole('region', { name: 'Faltam lançar' })).getByRole('link', { name: /DANTAS/ }));
    expect(confirmar).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
    expect((router.state.location.search as { militar?: string }).militar).not.toBe('m4');
    confirmar.mockReturnValue(true);
    await userEvent.click(within(screen.getByRole('region', { name: 'Faltam lançar' })).getByRole('link', { name: /DANTAS/ }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    confirmar.mockRestore();
  });

  it('sem militares na seção no mês, a tela diz isso', async () => {
    api({}, { mes: MES, militares: [] });
    abrir('/voluntariado');
    expect(await screen.findByText('Nenhum militar lotado na seção neste mês.')).toBeInTheDocument();
  });
});
