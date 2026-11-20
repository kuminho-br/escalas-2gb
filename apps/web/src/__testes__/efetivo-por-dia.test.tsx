import type { AlocacaoNoTrecho, DiaDaEscala, EfetivoDoDia, EscalaDoMes, GuarnicaoNoEfetivo, LinhaEscala, LinhaGuarnicao, TrechoNoEfetivo } from 'contratos';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { janelaDoDia, marcasDoDia } from '@/lib/efetivo';
import { hoje, mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Dia fictício 12/12/2026. Meta: ACO (1º, não ativada: falta motorista das 20h às 08h) e Resgate (2º, ativada). ABT fora da meta, com gente.
// Antigo (desativado) também fora da meta, sem horário vinculado.
const DIA = '2026-12-12';
const SEGUINTE = '2026-12-13';
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B' };
const ocupado = (nomeGuerra: string, inicio: number, fim: number, alocacoes: AlocacaoNoTrecho[] = [{ alocacaoId: `a-${nomeGuerra}`, acumuloId: null, inicio: '08:00', fim: '20:00', acumulaCom: [] }]): TrechoNoEfetivo => ({
  inicio, fim, opcoes: [], ocupante: { militarId: `m-${nomeGuerra}`, posto: 'SD BM', nomeGuerra, servico: PRONTO, acumulo: false, alocacoes },
});
const vaga = (inicio: number, fim: number, opcoes = [{ escalaId: 'e-ord', escala: 'Ordinário', inicio: '20:00', fim: '08:00' }]): TrechoNoEfetivo => ({ inicio, fim, ocupante: null, opcoes });
const guarnicao = (g: Partial<GuarnicaoNoEfetivo> & Pick<GuarnicaoNoEfetivo, 'guarnicaoId' | 'nome'>): GuarnicaoNoEfetivo => ({
  viatura: null, ordem: null, ativada: true, horarios: [{ inicio: '08:00', fim: '20:00' }], faltas: [], funcoes: [], alocados: 0, ...g,
});
const EFETIVO: EfetivoDoDia = {
  data: DIA,
  meta: { origem: 'padrao', total: 2, ativadas: 1 },
  guarnicoes: [
    guarnicao({
      guarnicaoId: 'g2', nome: 'ACO', ordem: 1, ativada: false, horarios: [{ inicio: '08:00', fim: '08:00' }],
      faltas: [{ funcao: 'Motorista', faltam: 1, inicio: '20:00', fim: '08:00' }],
      funcoes: [{
        funcaoId: 'f-Motorista', funcao: 'Motorista', minimo: 2, cnhExigida: 'D',
        linhas: [
          [ocupado('ALFA', 480, 1920, [{ alocacaoId: 'a-1', acumuloId: null, inicio: '08:00', fim: '20:00', acumulaCom: [] }, { alocacaoId: 'a-2', acumuloId: null, inicio: '20:00', fim: '08:00', acumulaCom: ['Chefe ABT'] }])],
          [ocupado('BRAVO', 480, 1200), vaga(1200, 1920)],
        ],
      }],
      alocados: 3,
    }),
    guarnicao({
      guarnicaoId: 'g3', nome: 'Resgate', ordem: 2, viatura: 'ABS-12',
    }),
    guarnicao({ guarnicaoId: 'g1', nome: 'ABT' }),
    guarnicao({ guarnicaoId: 'g9', nome: 'Antigo', ativada: false, horarios: [] }),
  ],
  desativadas: [],
  cotas: [{ servicoId: 's-jes', servico: 'JES', cor: '#6E56A8', quantidade: 40, usadas: 2 }],
};
const VAZIO: EfetivoDoDia = { data: DIA, meta: { origem: 'padrao', total: 0, ativadas: 0 }, guarnicoes: [], desativadas: [], cotas: [] };
const MODELOS: LinhaGuarnicao[] = [
  { id: 'g1', nome: 'ABT', viatura: null, prioridade: null, ativa: true, minimo: 1, maximo: 1, aPartirDe: null },
  { id: 'g2', nome: 'ACO', viatura: null, prioridade: null, ativa: true, minimo: 1, maximo: 1, aPartirDe: null },
  { id: 'g9', nome: 'Antigo', viatura: null, prioridade: null, ativa: false, minimo: 1, maximo: 1, aPartirDe: null },
];
const META_DO_DIA = { data: DIA, origem: 'dia', guarnicoes: [] };

function api(efetivo: EfetivoDoDia = EFETIVO, eu = EU_EXEMPLO, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET /api/unidades/u-1sb/efetivo-do-dia/${DIA}`]: { status: 200, corpo: efetivo },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: MODELOS },
    ...extra,
  });
}
const cartao = (nome: string) => screen.getByRole('region', { name: nome });
afterEach(() => window.localStorage.clear());

describe('efetivo por dia: os cards', () => {
  it('aparecem na ordem da API, com o número só na meta, o estado e a falta', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await screen.findByRole('heading', { name: '1º ACO' });
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['1º ACO', '2º Resgate', 'ABT', 'Antigo']);
    const aco = cartao('1º ACO');
    expect(within(aco).getByText('não ativada')).toBeInTheDocument();
    expect(within(aco).getByText('Falta 1 Motorista 20h–08h')).toBeInTheDocument();
    expect(within(cartao('2º Resgate')).getByText('ativada')).toBeInTheDocument();
  });

  it('o card fora da meta não tem número, e a falta de ativação não muda a posição dele', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await screen.findByRole('region', { name: 'ABT' });
    expect(screen.getByRole('heading', { name: 'ABT' })).toBeInTheDocument();
    expect(screen.queryByText(/fora da meta/i)).toBeNull();
  });

  it('o card sem horário vinculado diz isso, em vez de faltas', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    const antigo = await screen.findByRole('region', { name: 'Antigo' });
    expect(within(antigo).getByText('Sem horário vinculado neste dia')).toBeInTheDocument();
    expect(within(antigo).queryByText(/Falta/)).toBeNull();
  });
});

describe('efetivo por dia: a linha do tempo', () => {
  it('o militar que emenda turnos é uma barra só, e a vaga aparece na linha', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    const aco = await screen.findByRole('region', { name: '1º ACO' });
    expect(within(aco).getByRole('button', { name: 'Motorista: SD BM ALFA, 08h–08h, Pronto' })).toBeInTheDocument();
    expect(within(aco).getByRole('button', { name: 'Motorista: SD BM BRAVO, 08h–20h, Pronto' })).toBeInTheDocument();
    expect(within(aco).getByRole('button', { name: 'Motorista: vaga 20h–08h' })).toBeInTheDocument();
    // o nome da função só na primeira linha dela
    expect(within(aco).getAllByText('Motorista', { selector: '[data-funcao]' })).toHaveLength(1);
  });

  it('a régua marca os horários vinculados e mostra D e D+1 quando passa da meia-noite', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    const regua = await screen.findByTestId('regua-do-dia');
    expect(within(regua).getAllByText('08h')).toHaveLength(2);
    expect(within(regua).getByText('20h')).toBeInTheDocument();
    expect(within(regua).getByText('D')).toBeInTheDocument();
    expect(within(regua).getByText('D+1')).toBeInTheDocument();
  });

  it('sem guarnição no dia, não há régua', async () => {
    api(VAZIO);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await screen.findByText('Nenhuma guarnição na meta nem escalada neste dia.');
    expect(screen.queryByTestId('regua-do-dia')).toBeNull();
  });
});

describe('efetivo por dia: régua (unidade)', () => {
  const g = (horarios: { inicio: string; fim: string }[], linhas: TrechoNoEfetivo[][] = []): GuarnicaoNoEfetivo =>
    guarnicao({ guarnicaoId: 'x', nome: 'X', horarios, funcoes: linhas.length ? [{ funcaoId: 'f', funcao: 'F', minimo: 1, cnhExigida: null, linhas }] : [] });

  it('a janela vai do menor início ao maior fim dos horários e dos trechos', () => {
    expect(janelaDoDia([g([{ inicio: '08:00', fim: '20:00' }]), g([{ inicio: '20:00', fim: '08:00' }], [[vaga(1200, 1920)]])])).toEqual({ inicio: 480, fim: 1920 });
    expect(janelaDoDia([g([])])).toBeNull();
  });

  it('as marcas são os inícios e fins dos horários, e uma a menos de 4% da anterior some', () => {
    const janela = { inicio: 0, fim: 1440 };
    expect(marcasDoDia([g([{ inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }])], janela)).toEqual([480, 960, 1200]);
    // 08:20 está a 20 min de 08:00 (1,4% de 24h): some
    expect(marcasDoDia([g([{ inicio: '08:00', fim: '20:00' }]), g([{ inicio: '08:20', fim: '20:00' }])], janela)).toEqual([480, 1200]);
  });
});

describe('efetivo por dia: o topo', () => {
  it('mostra a meta do dia e as cotas restantes', async () => {
    api();
    abrir(`/efetivo-por-dia?data=${DIA}`);
    expect(await screen.findByText('Meta do dia: 2 guarnições, 1 ativada')).toBeInTheDocument();
    expect(screen.getByText('JES: restam 38 de 40')).toBeInTheDocument();
    expect(screen.queryByText('Meta alterada neste dia')).toBeNull();
  });

  it('o dia seguinte troca a data na busca e pede o efetivo do novo dia', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, { [`GET /api/unidades/u-1sb/efetivo-do-dia/${SEGUINTE}`]: { status: 200, corpo: { ...VAZIO, data: SEGUINTE } } });
    const router = abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Dia seguinte' }));
    await waitFor(() => expect((router.state.location.search as { data?: string }).data).toBe(SEGUINTE));
    await waitFor(() => expect(chamadasA(f, `GET /api/unidades/u-1sb/efetivo-do-dia/${SEGUINTE}`)).toBe(1));
    expect(await screen.findByText('Nenhuma guarnição na meta nem escalada neste dia.')).toBeInTheDocument();
  });

  it('sem data na busca e sem dia guardado, vale hoje', async () => {
    const f = simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      [`GET /api/unidades/u-1sb/efetivo-do-dia/${hoje()}`]: { status: 200, corpo: { ...VAZIO, data: hoje() } },
    });
    abrir('/efetivo-por-dia');
    await screen.findByText('Nenhuma guarnição na meta nem escalada neste dia.');
    expect(chamadasA(f, `GET /api/unidades/u-1sb/efetivo-do-dia/${hoje()}`)).toBe(1);
  });

  it('sem data na busca, abre no último dia visto nesta tela', async () => {
    window.localStorage.setItem('efetivo-por-dia:ultimo-dia', DIA);
    const f = api();
    abrir('/efetivo-por-dia');
    await screen.findByRole('heading', { name: '1º ACO' });
    expect(chamadasA(f, `GET /api/unidades/u-1sb/efetivo-do-dia/${DIA}`)).toBe(1);
  });

  it('ir para o dia seguinte guarda o dia', async () => {
    api(EFETIVO, EU_EXEMPLO, { [`GET /api/unidades/u-1sb/efetivo-do-dia/${SEGUINTE}`]: { status: 200, corpo: { ...VAZIO, data: SEGUINTE } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Dia seguinte' }));
    await waitFor(() => expect(window.localStorage.getItem('efetivo-por-dia:ultimo-dia')).toBe(SEGUINTE));
  });
});

describe('efetivo por dia: a meta do dia pela própria tela', () => {
  const PUT = `PUT /api/unidades/u-1sb/meta-do-dia/${DIA}`;
  const DESATIVAR = `POST /api/unidades/u-1sb/meta-do-dia/${DIA}/desativar`;
  const DESFAZER = `POST /api/unidades/u-1sb/meta-do-dia/${DIA}/desfazer-desativacao`;
  const VOLTAR = `DELETE /api/unidades/u-1sb/meta-do-dia/${DIA}`;
  const MODELOS_DO_MES = [...MODELOS, { id: 'g3', nome: 'Resgate', viatura: null, prioridade: null, ativa: true, minimo: 1, maximo: 1, aPartirDe: null }];
  const O_QUE_TIROU = { guarnicaoId: 'g3', metaAntes: { origem: 'padrao' as const, guarnicoes: ['g2', 'g3'] }, alocacoes: [], acumulos: [] };
  const rotas = {
    [PUT]: { status: 200, corpo: META_DO_DIA },
    [DESATIVAR]: { status: 200, corpo: { efetivo: EFETIVO, desfazer: O_QUE_TIROU } },
    [DESFAZER]: { status: 200, corpo: EFETIVO },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: MODELOS_DO_MES },
  };

  it('"Subir" no 2º troca a ordem de ativação do dia', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Subir Resgate' }));
    await waitFor(() => expect(corpoEnviado(f, PUT)).toEqual({ guarnicoes: ['g3', 'g2'] }));
  });

  it('o botão do card é "Desativar guarnição"; não existe "Tirar da meta"', async () => {
    api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    const resgate = await screen.findByRole('region', { name: '2º Resgate' });
    expect(within(resgate).getByRole('button', { name: 'Desativar guarnição' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar da meta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Só tirar da meta' })).toBeNull();
  });

  it('sem ninguém escalado, desativa direto, sem perguntar, e mostra "Desfazer"', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }));
    await waitFor(() => expect(corpoEnviado(f, DESATIVAR)).toEqual({ guarnicaoId: 'g3' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const aviso = await screen.findByRole('status');
    expect(within(aviso).getByText('Resgate desativada.')).toBeInTheDocument();
    expect(within(aviso).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('com gente escalada, pergunta "Desativar a ACO?"; "Desativar" envia e "Cancelar" não', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '1º ACO' })).getByRole('button', { name: 'Desativar guarnição' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Desativar a ACO?' });
    expect(within(dialogo).getByText('Quem está escalado nela neste dia será desescalado.')).toBeInTheDocument();
    expect(within(dialogo).queryByText(/militares escalados/)).toBeNull();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, DESATIVAR)).toBe(0);
    await userEvent.click(within(screen.getByRole('region', { name: '1º ACO' })).getByRole('button', { name: 'Desativar guarnição' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(corpoEnviado(f, DESATIVAR)).toEqual({ guarnicaoId: 'g2' }));
  });

  it('"Desfazer" manda de volta o que a desativação devolveu; com 409, a frase aparece no aviso', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, { ...rotas, [DESFAZER]: { status: 409, corpo: { erro: 'Não deu para desfazer: alguém já ocupa um desses lugares.' } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }));
    const aviso = await screen.findByRole('status');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(corpoEnviado(f, DESFAZER)).toEqual(O_QUE_TIROU));
    expect(await within(screen.getByRole('status')).findByText('Não deu para desfazer: alguém já ocupa um desses lugares.')).toBeInTheDocument();
  });

  it('o "Desfazer" bem-sucedido some com o aviso', async () => {
    api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }));
    await userEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('o aviso some ao trocar de dia e depois de outra ação de meta', async () => {
    api(EFETIVO, EU_EXEMPLO, { ...rotas, [`GET /api/unidades/u-1sb/efetivo-do-dia/${SEGUINTE}`]: { status: 200, corpo: { ...VAZIO, data: SEGUINTE } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }));
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: 'Dia seguinte' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('o aviso some sozinho depois de 10 segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      api(EFETIVO, EU_EXEMPLO, rotas);
      abrir(`/efetivo-por-dia?data=${DIA}`);
      await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }), { delay: null });
      await screen.findByRole('status');
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('enquanto o "Desfazer" está em andamento o aviso não some sozinho, e o erro do 409 aparece (achado da revisão final)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let soltar!: () => void;
      const espera = new Promise<void>((r) => (soltar = r));
      api(EFETIVO, EU_EXEMPLO, { ...rotas, [DESFAZER]: { status: 409, corpo: { erro: 'Não deu para desfazer: alguém já ocupa um desses lugares.' }, espera } });
      abrir(`/efetivo-por-dia?data=${DIA}`);
      await userEvent.click(within(await screen.findByRole('region', { name: '2º Resgate' })).getByRole('button', { name: 'Desativar guarnição' }), { delay: null });
      await userEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Desfazer' }), { delay: null });
      // a resposta demora mais que os 10 segundos do aviso
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      expect(screen.getByRole('status')).toBeInTheDocument();
      await act(async () => {
        soltar();
      });
      expect(await within(screen.getByRole('status')).findByText('Não deu para desfazer: alguém já ocupa um desses lugares.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a recusa ao desativar aparece dentro do diálogo', async () => {
    api(EFETIVO, EU_EXEMPLO, { ...rotas, [DESATIVAR]: { status: 409, corpo: { erro: 'Esta guarnição não está na meta deste dia.' } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(within(await screen.findByRole('region', { name: '1º ACO' })).getByRole('button', { name: 'Desativar guarnição' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desativar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Esta guarnição não está na meta deste dia.');
  });

  it('"Desativadas hoje": cada uma tem "Reativar", que grava a meta do dia com ela no fim (Review Focus 3)', async () => {
    const f = api({ ...EFETIVO, meta: { origem: 'dia', total: 2, ativadas: 1 }, desativadas: [{ guarnicaoId: 'g1', nome: 'ABT', viatura: 'ABT-01' }] }, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    const grupo = await screen.findByRole('region', { name: 'Desativadas hoje' });
    expect(within(grupo).getByText('ABT')).toBeInTheDocument();
    expect(within(grupo).getByText('ABT-01')).toBeInTheDocument();
    await userEvent.click(within(grupo).getByRole('button', { name: 'Reativar ABT' }));
    await waitFor(() => expect(corpoEnviado(f, PUT)).toEqual({ guarnicoes: ['g2', 'g3', 'g1'] }));
  });

  it('sem desativadas, o grupo não aparece', async () => {
    api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await screen.findByRole('region', { name: '1º ACO' });
    expect(screen.queryByRole('region', { name: 'Desativadas hoje' })).toBeNull();
  });

  it('"Adicionar guarnição" lista todos os modelos ativos; o que já está na meta aparece "já está no dia" e desabilitado; o escolhido vai para o fim', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar guarnição' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Adicionar guarnição' });
    expect(await within(dialogo).findByRole('button', { name: 'ABT' })).toBeEnabled();
    const aco = within(dialogo).getByRole('button', { name: /^ACO/ });
    expect(aco).toBeDisabled();
    expect(within(aco).getByText('já está no dia')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: /^Resgate/ })).toBeDisabled();
    expect(within(dialogo).queryByRole('button', { name: /Antigo/ })).toBeNull();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'ABT' }));
    await waitFor(() => expect(corpoEnviado(f, PUT)).toEqual({ guarnicoes: ['g2', 'g3', 'g1'] }));
  });

  it('a recusa ao adicionar aparece dentro do diálogo', async () => {
    api(EFETIVO, EU_EXEMPLO, { ...rotas, [PUT]: { status: 400, corpo: { erro: 'Confira os campos destacados.' } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar guarnição' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Adicionar guarnição' });
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'ABT' }));
    expect(await within(dialogo).findByRole('alert')).toBeInTheDocument();
  });

  it('"Voltar ao padrão" está sempre lá; com o dia no padrão fica desabilitado (Review Focus 5)', async () => {
    api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    expect(await screen.findByRole('button', { name: 'Voltar ao padrão' })).toBeDisabled();
  });

  it('com meta própria, "Voltar ao padrão" pergunta, e "Voltar" envia o DELETE sem desescalar ninguém; "Cancelar" não envia', async () => {
    const f = api({ ...EFETIVO, meta: { origem: 'dia', total: 2, ativadas: 1 } }, EU_EXEMPLO, { ...rotas, [VOLTAR]: { status: 200, corpo: { ...META_DO_DIA, origem: 'padrao' } } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    expect(await screen.findByText('Meta alterada neste dia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Voltar este dia à meta padrão?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, VOLTAR)).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(chamadasA(f, VOLTAR)).toBe(1));
    expect(chamadasA(f, DESATIVAR)).toBe(0);
  });

  it('"Alterar a meta deste dia" e "Tirar da meta" não existem mais', async () => {
    api(EFETIVO, EU_EXEMPLO, rotas);
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await screen.findByRole('region', { name: '1º ACO' });
    expect(screen.queryByRole('button', { name: 'Alterar a meta deste dia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tirar da meta' })).toBeNull();
  });
});

describe('efetivo por dia: a navegação', () => {
  it('o trilho leva a "Efetivo por dia"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [`GET /api/unidades/u-1sb/efetivo-do-dia/${hoje()}`]: { status: 200, corpo: { ...VAZIO, data: hoje() } } });
    const router = abrir('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Efetivo por dia' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/efetivo-por-dia'));
    expect(await screen.findByRole('heading', { name: 'Efetivo por dia' })).toBeInTheDocument();
  });

  it('o endereço antigo vai para o novo, levando a data', async () => {
    api();
    const router = abrir(`/efetivo-do-dia?data=${DIA}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/efetivo-por-dia'));
    expect((router.state.location.search as { data?: string }).data).toBe(DIA);
    expect(await screen.findByRole('heading', { name: '1º ACO' })).toBeInTheDocument();
  });

  describe('a Escala do mês com o dia na busca', () => {
    const original = Element.prototype.scrollIntoView;
    afterEach(() => {
      Element.prototype.scrollIntoView = original;
    });
    const MES = mesAtual();
    const dia = (n: number): DiaDaEscala => ({ data: `${MES}-0${n}`, diaDaSemana: n % 7, feriado: null, faixas: [], obrigatoriasVazias: 0 });
    const ESCALA: EscalaDoMes = { escalaId: 'e1', nome: 'Ordinário', mes: MES, dias: [dia(1), dia(2), dia(3)], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } };
    const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true }];

    it('rola até o dia pedido, e sem "dia" na busca não rola', async () => {
      const rolar = vi.fn();
      Element.prototype.scrollIntoView = rolar;
      simularApi({
        '/api/eu': { status: 200, corpo: EU_EXEMPLO },
        'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
        [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: ESCALA },
      });
      abrir(`/escala-do-mes?escala=e1&mes=${MES}&dia=${MES}-02`);
      await screen.findByRole('region', { name: 'Dia 2' });
      await waitFor(() => expect(rolar).toHaveBeenCalled());
      expect((rolar.mock.contexts.at(-1) as HTMLElement).id).toBe(`dia-${MES}-02`);
    });

    it('sem "dia" na busca, a página não rola', async () => {
      const rolar = vi.fn();
      Element.prototype.scrollIntoView = rolar;
      simularApi({
        '/api/eu': { status: 200, corpo: EU_EXEMPLO },
        'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
        [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: ESCALA },
      });
      abrir(`/escala-do-mes?escala=e1&mes=${MES}`);
      await screen.findByRole('region', { name: 'Dia 2' });
      expect(rolar).not.toHaveBeenCalled();
    });
  });
});

describe('efetivo por dia: escalar e remover', () => {
  const ROTA = `GET /api/unidades/u-1sb/efetivo-do-dia/${DIA}`;
  const CANDIDATOS = {
    aptos: [{ militarId: 'm-zulu', posto: 'SD BM', nomeGuerra: 'ZULU', matricula: '990099-9', equipe: null, jornada: 'pronto', servicos: [{ servicoId: 's-pronto', turnoId: 't-b', nome: 'Pronto' }] }],
    semVoluntariado: [], fora: [], acumular: [],
  };
  const ESCALA_VAZIA = (escalaId: string) => ({ escalaId, nome: 'Ordinário', mes: '2026-12', dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } });
  const comVaga = (opcoes: TrechoNoEfetivo['opcoes']): EfetivoDoDia => ({
    ...EFETIVO,
    guarnicoes: [guarnicao({ guarnicaoId: 'g7', nome: 'Resgate', ordem: null, funcoes: [{ funcaoId: 'f-aux', funcao: 'Auxiliar', minimo: 1, cnhExigida: null, linhas: [[vaga(480, 960, opcoes)]] }] })],
  });
  const chamadaDosCandidatos = (f: ReturnType<typeof simularApi>) => {
    const u = f.mock.calls.map(([e]) => new URL(String(e), 'http://x')).find((x) => x.pathname.endsWith('/candidatos'))!;
    return [u.pathname, Object.fromEntries(u.searchParams)];
  };

  it('a vaga com uma escala só abre direto a lista de candidatos daquela escala e daquela faixa', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, {
      'GET /api/escalas/e-ord/mes/2026-12/candidatos': { status: 200, corpo: CANDIDATOS },
      'POST /api/escalas/e-ord/alocacoes': { status: 201, corpo: ESCALA_VAZIA('e-ord') },
    });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Motorista: vaga 20h–08h' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Escolher militar' });
    await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
    expect(chamadaDosCandidatos(f)).toEqual([
      '/api/escalas/e-ord/mes/2026-12/candidatos',
      { data: DIA, inicio: '20:00', fim: '08:00', guarnicaoId: 'g2', funcaoId: 'f-Motorista' },
    ]);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/escalas/e-ord/alocacoes')).toEqual({ militarId: 'm-zulu', data: DIA, turnoId: 't-b', guarnicaoId: 'g2', funcaoId: 'f-Motorista' }));
    await waitFor(() => expect(chamadasA(f, ROTA)).toBe(2));
  });

  it('a vaga coberta por duas escalas pergunta "Por qual escala?", e a escolhida define a lista', async () => {
    const f = api(comVaga([
      { escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00' },
      { escalaId: 'e-pe', escala: 'PE Seguro', inicio: '08:00', fim: '16:00' },
    ]), EU_EXEMPLO, { 'GET /api/escalas/e-pe/mes/2026-12/candidatos': { status: 200, corpo: CANDIDATOS } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Auxiliar: vaga 08h–16h' }));
    const pergunta = await screen.findByRole('dialog', { name: 'Por qual escala?' });
    expect(within(pergunta).getByRole('button', { name: 'Ordinário 08h–20h' })).toBeInTheDocument();
    await userEvent.click(within(pergunta).getByRole('button', { name: 'PE Seguro 08h–16h' }));
    await screen.findByRole('dialog', { name: 'Escolher militar' });
    await waitFor(() => expect(chamadaDosCandidatos(f)).toEqual([
      '/api/escalas/e-pe/mes/2026-12/candidatos',
      { data: DIA, inicio: '08:00', fim: '16:00', guarnicaoId: 'g7', funcaoId: 'f-aux' },
    ]));
  });

  it('escalar na vaga de uma guarnição fora da meta não mexe na meta do dia (decisão 2-b)', async () => {
    const f = api(comVaga([{ escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00' }]), EU_EXEMPLO, {
      'GET /api/escalas/e-ord/mes/2026-12/candidatos': { status: 200, corpo: CANDIDATOS },
      'POST /api/escalas/e-ord/alocacoes': { status: 201, corpo: ESCALA_VAZIA('e-ord') },
    });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Auxiliar: vaga 08h–16h' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Escolher militar' });
    await userEvent.click(await within(dialogo).findByRole('button', { name: /ZULU/ }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/escalas/e-ord/alocacoes')).toBe(1));
    expect(chamadasA(f, `PUT /api/unidades/u-1sb/meta-do-dia/${DIA}`)).toBe(0);
  });

  it('o trecho ocupado mostra as alocações dele, e "Remover" tira a escolhida', async () => {
    const f = api(EFETIVO, EU_EXEMPLO, { 'DELETE /api/alocacoes/a-2': { status: 200, corpo: ESCALA_VAZIA('e-ord') } });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Motorista: SD BM ALFA, 08h–08h, Pronto' }));
    const dialogo = await screen.findByRole('dialog', { name: 'SD BM ALFA' });
    expect(within(dialogo).getByText('08h–20h')).toBeInTheDocument();
    // os mesmos avisos da Escala do mês (achado da revisão final)
    expect(within(dialogo).getAllByText('Ele não volta para este turno quando a pré-escala for gerada de novo.')).toHaveLength(2);
    expect(within(dialogo).getByText('Sai também de: Chefe ABT.')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover 20h–08h' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-2')).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('no trecho de acúmulo, "Tirar acúmulo" tira só o acúmulo', async () => {
    const acumulo: TrechoNoEfetivo = { ...ocupado('ECHO', 480, 1200, [{ alocacaoId: 'a-9', acumuloId: 'ac-1', inicio: '08:00', fim: '20:00', acumulaCom: ['Motorista ABT'] }]) };
    acumulo.ocupante!.acumulo = true;
    const f = api({ ...EFETIVO, guarnicoes: [guarnicao({ guarnicaoId: 'g7', nome: 'Resgate', funcoes: [{ funcaoId: 'f-aux', funcao: 'Auxiliar', minimo: 1, cnhExigida: null, linhas: [[acumulo]] }] })] }, EU_EXEMPLO, {
      'DELETE /api/acumulos/ac-1': { status: 200, corpo: ESCALA_VAZIA('e-ord') },
    });
    abrir(`/efetivo-por-dia?data=${DIA}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Auxiliar: SD BM ECHO, 08h–20h, Pronto' }));
    const dialogo = await screen.findByRole('dialog', { name: 'SD BM ECHO' });
    expect(within(dialogo).queryByRole('button', { name: /^Remover/ })).toBeNull();
    expect(within(dialogo).getByText('Ele continua em Motorista ABT.')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Tirar acúmulo 08h–20h' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/acumulos/ac-1')).toBe(1));
  });
});
