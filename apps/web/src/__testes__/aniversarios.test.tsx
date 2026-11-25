import type { AniversarianteDoMes, ListaDoPeculio } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { diasDoMesComAniversariantes } from '@/lib/aniversarios';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.50, Task 4: a tela "Aniversários" do Pecúlio Geral (o calendário do mês). Dados fictícios (D7).
const GESTOR_GB: EuDaApi = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }],
  unidades: [{ id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null }, ...EU_EXEMPLO.unidades],
};
const a = (militarId: string, nomeGuerra: string, dia: number, posto = 'SD', lotacao = '1ª SB'): AniversarianteDoMes => ({ militarId, posto, nomeGuerra, dia, lotacao });
const ROTA = '/api/unidades/u-gb/peculio';
const vazia: ListaDoPeculio = { militares: [] };

/** Cada mês tem a sua resposta (a simulação ignora a query, então o `mes` do pedido é olhado aqui). */
function api(porMes: Record<string, ListaDoPeculio | undefined>, eu: EuDaApi = GESTOR_GB) {
  const f = simularApi({ '/api/eu': { status: 200, corpo: eu }, [`GET ${ROTA}`]: { status: 200, corpo: vazia } });
  const padrao = f.getMockImplementation()!;
  f.mockImplementation(async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url.includes(ROTA)) {
      const mes = new URL(url, 'http://localhost').searchParams.get('mes') ?? '';
      return new Response(JSON.stringify(porMes[mes] ?? vazia), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return padrao(entrada, init);
  });
  return f;
}
const mesesPedidos = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.map(([e]) => String(e)).filter((u) => u.includes(ROTA)).map((u) => new URL(u, 'http://localhost').searchParams.get('mes'));

afterEach(() => vi.unstubAllGlobals());

describe('diasDoMesComAniversariantes (6.50)', () => {
  it('agrupa por dia, na ordem do mês, e mantém a ordem de quem veio no mesmo dia', () => {
    const dias = diasDoMesComAniversariantes('2026-12', [a('m1', 'ANDRADE', 20), a('m2', 'BARRETO', 5), a('m3', 'CAMPOS', 20, 'CB')]);
    expect(dias.map((d) => d.data)).toEqual(['2026-12-05', '2026-12-20']);
    expect(dias[1]!.quem.map((q) => q.nomeGuerra)).toEqual(['ANDRADE', 'CAMPOS']);
  });

  it('Review Focus 5: quem nasceu em 29 de fevereiro aparece em 28 de fevereiro no ano sem dia 29, e em 29 no ano que tem', () => {
    const lista = [a('m1', 'BISSEXTO', 29), a('m2', 'DO28', 28)];
    const comum = diasDoMesComAniversariantes('2027-02', lista);
    expect(comum.map((d) => d.data)).toEqual(['2027-02-28']);
    expect(comum[0]!.quem.map((q) => q.nomeGuerra)).toEqual(['BISSEXTO', 'DO28']);
    expect(diasDoMesComAniversariantes('2028-02', lista).map((d) => d.data)).toEqual(['2028-02-28', '2028-02-29']);
  });

  it('um dia que o mês não tem (31 de abril, dado ruim) não vira dia nenhum: cai no último dia do mês', () => {
    expect(diasDoMesComAniversariantes('2026-04', [a('m1', 'X', 31)]).map((d) => d.data)).toEqual(['2026-04-30']);
  });

  it('sem aniversariantes, nenhum dia', () => {
    expect(diasDoMesComAniversariantes('2026-12', [])).toEqual([]);
  });
});

describe('a tela Aniversários (6.50)', () => {
  it('mostra o calendário do mês pedido, com cada aniversariante no seu dia e o nome levando à ficha', async () => {
    const f = api({ '2026-12': { militares: [], aniversariantes: [a('m2', 'BARRETO', 5, 'CB', '2º GB'), a('m1', 'ANDRADE', 20)] } });
    abrir('/peculio/aniversarios?mes=2026-12');
    expect(await screen.findByRole('heading', { name: 'Aniversários' })).toBeInTheDocument();
    const dia5 = await screen.findByRole('listitem', { name: 'Dia 5' });
    expect(within(dia5).getByRole('link', { name: /CB BARRETO/ })).toHaveAttribute('href', '/peculio/militar/m2');
    expect(within(screen.getByRole('listitem', { name: 'Dia 20' })).getByText(/ANDRADE/)).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Dia 6' })).queryByRole('link')).toBeNull();
    expect(mesesPedidos(f)).toContain('2026-12');
  });

  it('as setas trocam o mês, e a tela pede o mês novo', async () => {
    const f = api({
      '2026-12': { militares: [], aniversariantes: [a('m1', 'ANDRADE', 20)] },
      '2027-01': { militares: [], aniversariantes: [a('m2', 'BARRETO', 3)] },
    });
    const router = abrir('/peculio/aniversarios?mes=2026-12');
    const calendario = async () => within(await screen.findByRole('list', { name: /^Aniversários de/ }));
    expect((await calendario()).getByText(/ANDRADE/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(async () => expect((await calendario()).getByText(/BARRETO/)).toBeInTheDocument());
    expect((await calendario()).queryByText(/ANDRADE/)).toBeNull();
    expect(router.state.location.search).toMatchObject({ mes: '2027-01' });
    expect(mesesPedidos(f)).toContain('2027-01');
  });

  it('Review Focus 5: em fevereiro de ano sem dia 29, quem nasceu em 29 aparece no dia 28', async () => {
    api({ '2027-02': { militares: [], aniversariantes: [a('m1', 'BISSEXTO', 29)] } });
    abrir('/peculio/aniversarios?mes=2027-02');
    const dia28 = await screen.findByRole('listitem', { name: 'Dia 28' });
    expect(within(dia28).getByText(/BISSEXTO/)).toBeInTheDocument();
  });

  it('um mês sem aniversário diz "Nenhum aniversário em {mês}."', async () => {
    api({ '2026-12': { militares: [], aniversariantes: [] } });
    abrir('/peculio/aniversarios?mes=2026-12');
    expect(await screen.findByText('Nenhum aniversário em dezembro de 2026.')).toBeInTheDocument();
  });

  it('sem poder ver o nascimento de ninguém (a chave não vem), a tela diz isso e não afirma que ninguém faz aniversário', async () => {
    api({ '2026-12': { militares: [] } });
    abrir('/peculio/aniversarios?mes=2026-12');
    expect(await screen.findByText('Você não tem acesso às datas de nascimento desta unidade.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum aniversário em/)).toBeNull();
  });

  it('no celular, vira uma lista por dia: só os dias com aniversário, cada um com a lotação', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    api({ '2026-12': { militares: [], aniversariantes: [a('m2', 'BARRETO', 5, 'CB', '2º GB'), a('m1', 'ANDRADE', 20)] } });
    abrir('/peculio/aniversarios?mes=2026-12');
    await screen.findByRole('listitem', { name: 'Dia 5' });
    expect(screen.getAllByRole('listitem').filter((l) => l.getAttribute('aria-label')?.startsWith('Dia '))).toHaveLength(2);
    expect(within(screen.getByRole('listitem', { name: 'Dia 5' })).getByText('2º GB')).toBeInTheDocument();
  });

  it('o militar comum (sem nível de acesso) não abre a tela: volta ao início com o aviso', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    const router = abrir('/peculio/aniversarios');
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
