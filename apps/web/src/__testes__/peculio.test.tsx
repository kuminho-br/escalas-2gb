import type { ListaDoPeculio } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Eu } from '@/api/eu';
import { unidadeDoPeculio } from '@/api/peculio';
import { mesAtual } from '@/lib/meses';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

const MES = mesAtual();
const GESTOR_GB: Eu = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }],
};
const LISTA: ListaDoPeculio = {
  militares: [
    { militarId: 'm1', matricula: '990001-1', posto: 'SD BM', nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', lotacao: '1ª SB', telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', pendencias: [] },
    { militarId: 'm2', matricula: '990002-2', posto: 'CB BM', nomeGuerra: 'BARRETO', nomeCompleto: null, lotacao: '2ª SB', telefone: null, email: null, pendencias: ['Nome completo em falta'] },
    { militarId: 'm3', matricula: '990003-3', posto: 'SD BM', nomeGuerra: 'CÁBRAL', nomeCompleto: 'Carlos Cabral Neto', lotacao: '1ª SB', telefone: null, email: null, pendencias: [] },
  ],
  aniversariantes: [
    { militarId: 'm2', posto: 'CB BM', nomeGuerra: 'BARRETO', dia: 5, lotacao: '2ª SB' },
    { militarId: 'm1', posto: 'SD BM', nomeGuerra: 'ANDRADE', dia: 20, lotacao: '1ª SB' },
  ],
};

function api(eu: Eu = GESTOR_GB, lista: ListaDoPeculio = LISTA, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET /api/unidades/u-gb/peculio`]: { status: 200, corpo: lista },
    [`GET /api/unidades/u-1sb/peculio`]: { status: 200, corpo: lista },
    ...extra,
  });
}
const militares = async () => within(await screen.findByRole('list', { name: 'Militares do Pecúlio' }));
const chamadasDaLista = (f: ReturnType<typeof simularApi>) => f.mock.calls.map(([e]) => String(e)).filter((u) => u.includes('/peculio'));

describe('a unidade do módulo', () => {
  it('é a mais alta em que a pessoa tem papel: o 2º GB para quem cuida do pessoal, a 1ª SB para o escalante da seção', () => {
    expect(unidadeDoPeculio(GESTOR_GB)).toEqual({ id: 'u-gb', sigla: '2º GB' });
    expect(unidadeDoPeculio(EU_EXEMPLO)).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
    expect(unidadeDoPeculio({ ...EU_EXEMPLO, papeis: [] })).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
  });
});

describe('módulo Pecúlio', () => {
  it('o menu mostra "Pecúlio" para quem tem papel de cadastro e não para o militar comum', async () => {
    api();
    abrir('/peculio');
    expect(await screen.findByRole('link', { name: 'Pecúlio' })).toHaveAttribute('href', '/peculio');
  });

  it('o militar comum não vê o item no menu', async () => {
    api({ ...EU_EXEMPLO, papeis: [] });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    expect(screen.queryByRole('link', { name: 'Pecúlio' })).toBeNull();
  });

  it('lista os militares da unidade e das de baixo com posto, nome de guerra, nome completo, lotação, telefone, e-mail e as pendências', async () => {
    const f = api();
    abrir('/peculio');
    const lista = await militares();
    const andrade = lista.getByText('ANDRADE').closest('li')!;
    expect(chamadasDaLista(f)[0]).toContain(`/api/unidades/u-gb/peculio?mes=${MES}`);
    expect(within(andrade).getByText('SD BM')).toBeInTheDocument();
    expect(within(andrade).getByText('João da Silva Andrade')).toBeInTheDocument();
    expect(within(andrade).getByText('1ª SB')).toBeInTheDocument();
    expect(within(andrade).getByText('(81) 99999-0001')).toBeInTheDocument();
    expect(within(andrade).getByText('andrade@bombeiros.pe.gov.br')).toBeInTheDocument();
    const barreto = lista.getByText('BARRETO').closest('li')!;
    expect(within(barreto).getByText('2ª SB')).toBeInTheDocument();
    expect(within(barreto).getByLabelText('Cadastro incompleto: Nome completo em falta')).toBeInTheDocument();
    expect(screen.getByText('3 de 3 militares')).toBeInTheDocument();
  });

  it('a busca acha por nome (sem acento) ou matrícula e o filtro por lotação restringe', async () => {
    api();
    abrir('/peculio');
    const lista = await militares();
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), 'cabral');
    expect(lista.queryByText('ANDRADE')).toBeNull();
    expect(lista.getByText('CÁBRAL')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar por nome ou matrícula'));
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), '990002');
    expect(lista.getByText('BARRETO')).toBeInTheDocument();
    expect(lista.queryByText('CÁBRAL')).toBeNull();
    await userEvent.clear(screen.getByLabelText('Buscar por nome ou matrícula'));
    // o filtro traz as lotações que aparecem na lista
    await userEvent.selectOptions(screen.getByLabelText('Lotação'), '2ª SB');
    expect(lista.getByText('BARRETO')).toBeInTheDocument();
    expect(lista.queryByText('ANDRADE')).toBeNull();
    expect(screen.getByText('1 de 3 militares')).toBeInTheDocument();
  });

  it('clicar no militar abre a ficha dele (a mesma ficha)', async () => {
    api(GESTOR_GB, LISTA, { 'GET /api/militares/m1': { status: 404 } });
    const router = abrir('/peculio');
    await userEvent.click((await militares()).getByText('ANDRADE').closest('a')!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares/m1'));
  });

  it('os aniversariantes do mês aparecem em ordem de dia, com o dia e a lotação', async () => {
    api();
    abrir('/peculio');
    const secao = (await screen.findByRole('heading', { name: 'Aniversariantes do mês' })).closest('section')!;
    const itens = within(secao).getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain('BARRETO');
    expect(itens[0]).toContain(`05/${MES.slice(5)}`);
    expect(itens[1]).toContain('ANDRADE');
    expect(itens[1]).toContain(`20/${MES.slice(5)}`);
  });

  it('um mês sem aniversariante diz "Nenhum aniversariante neste mês." (Review Focus 4)', async () => {
    api(GESTOR_GB, { ...LISTA, aniversariantes: [] });
    abrir('/peculio');
    expect(await screen.findByText('Nenhum aniversariante neste mês.')).toBeInTheDocument();
    expect((await militares()).getByText('ANDRADE')).toBeInTheDocument();
  });

  it('o botão "Importar" abre a importação do Pecúlio, com o modelo do Pecúlio da unidade do módulo', async () => {
    api();
    abrir('/peculio');
    await userEvent.click(await screen.findByRole('button', { name: /^Importar/ }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText('Importar o Pecúlio da planilha')).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: 'Baixar modelo' })).toHaveAttribute('href', '/api/unidades/u-gb/importacao/peculio/modelo');
  });

  it('sem militar lotado, a tela diz o que fazer', async () => {
    api(GESTOR_GB, { militares: [], aniversariantes: [] });
    abrir('/peculio');
    expect(await screen.findByText(/Nenhum militar lotado/)).toBeInTheDocument();
  });

  it('a lista que falha mostra o erro', async () => {
    api(GESTOR_GB, LISTA, { 'GET /api/unidades/u-gb/peculio': { status: 500, corpo: { erro: 'Falha ao ler o Pecúlio.' } } });
    abrir('/peculio');
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao ler o Pecúlio.');
  });
});
