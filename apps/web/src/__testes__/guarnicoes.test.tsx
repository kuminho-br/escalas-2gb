import type { FichaGuarnicao, LinhaGuarnicao } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const linha = (l: Partial<LinhaGuarnicao>): LinhaGuarnicao => ({
  id: 'g1', nome: 'Auto Bomba 1', atividade: 'Incêndio', viatura: 'ABT-01', prioridade: 1, ativa: true, vagasObrigatorias: 2, aPartirDe: null, pendencias: [], ...l,
});
const LISTA = [
  linha({}),
  linha({ id: 'g2', nome: 'Resgate', atividade: null, viatura: null, prioridade: null, vagasObrigatorias: 2, pendencias: ['Sem atividade'] }),
  linha({ id: 'g4', nome: 'Futura', prioridade: 3, aPartirDe: '2099-01' }),
];
const FICHA: FichaGuarnicao = {
  id: 'g1', nome: 'Auto Bomba 1', atividadeId: 'at-inc', atividade: 'Incêndio',
  versoes: [
    {
      vigencia: '2026-01', viatura: 'ABT-01', tipoViatura: 'Auto Bomba', prioridade: 1, ativa: true,
      composicao: [
        { funcaoId: 'f-comb', funcao: 'Combatente', minimo: 1, maximo: 3, cnhExigida: null },
        { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D' },
      ],
    },
  ],
  usadaEm: [{ escalaId: 'e1', escala: 'Ordinário', turnos: ['A', 'B'] }],
};
const FUNCOES = [
  { id: 'f-comb', nome: 'Combatente', unidadeSigla: '1ª SB', herdada: false },
  { id: 'f-mot', nome: 'Motorista', unidadeSigla: '2º GB', herdada: true },
];
const ATIVIDADES = [
  { id: 'at-inc', nome: 'Incêndio', ativo: true },
  { id: 'at-aph', nome: 'APH', ativo: true },
  { id: 'at-old', nome: 'Mergulho', ativo: false },
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
    'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
    'GET /api/sistema/atividades': { status: 200, corpo: ATIVIDADES },
    ...extra,
  });
}
const valor = (rotulo: string) => screen.getByLabelText(rotulo);

describe('lista de guarnições', () => {
  it('lista avisa guarnição sem atividade', async () => {
    api();
    abrir('/guarnicoes');
    const item = (await screen.findByText('Resgate')).closest('li')!;
    expect(within(item).getByLabelText('Cadastro incompleto: Sem atividade')).toBeInTheDocument();
    const ok = screen.getByText('Auto Bomba 1').closest('li')!;
    expect(within(ok).queryByLabelText(/Cadastro incompleto/)).toBeNull();
  });

  it('guarnição que começa depois mostra a partir de quando', async () => {
    api();
    abrir('/guarnicoes');
    const item = (await screen.findByText('Futura')).closest('li')!;
    expect(within(item).getByText('a partir de janeiro de 2099')).toBeInTheDocument();
  });

  it('nova guarnição envia a primeira versão vazia e abre a ficha', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/guarnicoes': { status: 201, corpo: FICHA } });
    abrir('/guarnicoes');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova guarnição' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Nome da guarnição'), 'Auto Resgate 2');
    await userEvent.selectOptions(await within(dialogo).findByLabelText('Atividade'), 'APH');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/guarnicoes')).toEqual({
        nome: 'Auto Resgate 2', atividadeId: 'at-aph', vigencia: mesAtual(),
        versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] },
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Auto Bomba 1', level: 2 })).toBeInTheDocument();
  });
});

describe('ficha da guarnição', () => {
  it('mostra onde é usada', async () => {
    api();
    abrir('/guarnicoes/g1');
    const secao = (await screen.findByRole('heading', { name: 'Onde é usada' })).closest('section')!;
    expect(within(secao).getByText('Ordinário')).toBeInTheDocument();
    expect(within(secao).getByText('turnos A, B')).toBeInTheDocument();
  });

  it('mais e menos mudam o mínimo e não passam do máximo', async () => {
    api();
    abrir('/guarnicoes/g1');
    await screen.findByLabelText('Mínimo de Combatente');
    const mais = screen.getByRole('button', { name: 'Aumentar mínimo de Combatente' });
    await userEvent.click(mais);
    await userEvent.click(mais);
    expect(valor('Mínimo de Combatente')).toHaveTextContent('3');
    expect(mais).toBeDisabled();
    const menos = screen.getByRole('button', { name: 'Diminuir mínimo de Motorista' });
    await userEvent.click(menos);
    expect(valor('Mínimo de Motorista')).toHaveTextContent('0');
    expect(menos).toBeDisabled();
    const menosMax = screen.getByRole('button', { name: 'Diminuir máximo de Combatente' });
    await userEvent.click(menosMax);
    expect(valor('Máximo de Combatente')).toHaveTextContent('3');
    expect(menosMax).toBeDisabled();
  });

  it('sem limite deixa o máximo vazio e o mais do mínimo sobe livre', async () => {
    api();
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByLabelText('Sem limite de Combatente'));
    expect(valor('Máximo de Combatente')).toHaveTextContent('sem limite');
    const mais = screen.getByRole('button', { name: 'Aumentar mínimo de Combatente' });
    for (let i = 0; i < 4; i++) await userEvent.click(mais);
    expect(valor('Mínimo de Combatente')).toHaveTextContent('5');
    expect(mais).toBeEnabled();
  });

  it('salvar a partir de envia PUT no mês escolhido com a composição na ordem', async () => {
    const f = api({ 'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Aumentar mínimo de Combatente' }));
    fireEvent.change(screen.getByLabelText('A partir de'), { target: { value: '2099-03' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a partir de março de 2099' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'PUT /api/guarnicoes/g1/versoes/2099-03')).toEqual({
        viatura: 'ABT-01', tipoViatura: 'Auto Bomba', prioridade: 1, ativa: true,
        composicao: [
          { funcaoId: 'f-comb', minimo: 2, maximo: 3, cnhExigida: null },
          { funcaoId: 'f-mot', minimo: 1, maximo: 1, cnhExigida: 'D' },
        ],
      }),
    );
  });

  it('versão de mês passado mostra a mensagem da API', async () => {
    api({ 'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 409, corpo: { erro: 'Só dá para mudar a partir de novembro de 2026.' } } });
    abrir('/guarnicoes/g1');
    await screen.findByLabelText('Mínimo de Combatente');
    fireEvent.change(screen.getByLabelText('A partir de'), { target: { value: '2099-03' } });
    await userEvent.click(screen.getByRole('button', { name: /^Salvar a partir de/ }));
    expect(await screen.findByText('Só dá para mudar a partir de novembro de 2026.')).toBeInTheDocument();
  });

  it('nova função cria e já seleciona', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/funcoes': { status: 201, corpo: { id: 'f-new', nome: 'Socorrista', unidadeSigla: '1ª SB', herdada: false } } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir função' }));
    const escolha = await screen.findByLabelText('Função 3');
    await userEvent.selectOptions(escolha, 'Nova função…');
    await userEvent.type(screen.getByLabelText('Nome da nova função'), 'Socorrista');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/funcoes')).toEqual({ nome: 'Socorrista' }));
    await waitFor(() => expect(screen.getByLabelText('Função 3')).toHaveValue('f-new'));
  });

  it('a função herdada mostra a sigla de onde vem', async () => {
    api();
    abrir('/guarnicoes/g1');
    const escolha = await screen.findByLabelText('Função 2');
    expect(await within(escolha).findByRole('option', { name: 'Motorista (2º GB)' })).toBeInTheDocument();
    expect(within(escolha).getByRole('option', { name: 'Combatente' })).toBeInTheDocument();
  });

  it('atividade só lista as ativas', async () => {
    api();
    abrir('/guarnicoes/g1');
    const atividade = await screen.findByLabelText('Atividade');
    expect(await within(atividade).findByRole('option', { name: 'APH' })).toBeInTheDocument();
    expect(within(atividade).queryByRole('option', { name: 'Mergulho' })).toBeNull();
  });

  it('atividade desativada que já é a da guarnição continua na lista', async () => {
    api({ 'GET /api/guarnicoes/g3': { status: 200, corpo: { ...FICHA, id: 'g3', atividadeId: 'at-old', atividade: 'Mergulho' } } });
    abrir('/guarnicoes/g3');
    const atividade = await screen.findByLabelText('Atividade');
    expect(await within(atividade).findByRole('option', { name: 'Mergulho' })).toBeInTheDocument();
  });
});
