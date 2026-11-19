import { mesPorExtenso, type FichaGuarnicao, type LinhaGuarnicao } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MENSAGEM_PENDENTE } from '@/componentes/AlteracoesPendentes';
import { atualizarGuarnicoes } from '@/api/guarnicoes';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

const linha = (l: Partial<LinhaGuarnicao>): LinhaGuarnicao => ({
  id: 'g1', nome: 'Auto Bomba 1', viatura: 'ABT-01', prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null, ...l,
});
const LISTA = [
  linha({}),
  linha({ id: 'g2', nome: 'Resgate', viatura: null, prioridade: null, minimo: 3, maximo: 3 }),
  linha({ id: 'g4', nome: 'Futura', prioridade: 3, aPartirDe: '2099-01' }),
  linha({ id: 'g6', nome: 'PE-Seguro', prioridade: 4, minimo: 0, maximo: 0 }),
  linha({ id: 'g7', nome: 'Desligada', prioridade: 5, ativa: false }),
];
const FICHA: FichaGuarnicao = {
  id: 'g1', nome: 'Auto Bomba 1', desativadaAPartirDe: null,
  versoes: [
    {
      vigencia: '2026-01', viatura: 'ABT-01', tipoViatura: 'Auto Bomba', prioridade: 1, ativa: true,
      composicao: [
        { funcaoId: 'f-comb', funcao: 'Combatente', minimo: 1, maximo: 3, cnhExigida: null },
        { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D' },
      ],
    },
  ],
  usadaEm: [{ escalaId: 'e1', escala: 'Ordinário', faixas: [{ inicio: '08:00', fim: '20:00' }, { inicio: '20:00', fim: '08:00' }] }],
};
const FUNCOES = [
  { id: 'f-comb', nome: 'Combatente', unidadeSigla: '1ª SB', herdada: false },
  { id: 'f-mot', nome: 'Motorista', unidadeSigla: '2º GB', herdada: true },
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
    'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
    ...extra,
  });
}
const valor = (rotulo: string) => screen.getByLabelText(rotulo);
const itemDe = async (nome: string) => (await screen.findByText(nome)).closest('li')!;
async function salvarEm(mes: string, porExtenso: string) {
  fireEvent.change(screen.getByLabelText('A partir de'), { target: { value: mes } });
  await userEvent.click(screen.getByRole('button', { name: `Salvar a partir de ${porExtenso}` }));
}

describe('lista de guarnições', () => {
  it('lista mostra os limites e sem composição', async () => {
    api();
    abrir('/guarnicoes');
    expect(within(await itemDe('Auto Bomba 1')).getByText('de 2 a 4 militares')).toBeInTheDocument();
    expect(within(await itemDe('Resgate')).getByText('3 militares')).toBeInTheDocument();
    expect(within(await itemDe('PE-Seguro')).getByText('sem composição')).toBeInTheDocument();
    expect(screen.queryByText(/vagas obrigatórias/)).toBeNull();
    expect(screen.queryByLabelText(/Cadastro incompleto/)).toBeNull();
  });

  it('guarnição que começa depois mostra a partir de quando', async () => {
    api();
    abrir('/guarnicoes');
    expect(within(await itemDe('Futura')).getByText('a partir de janeiro de 2099')).toBeInTheDocument();
  });

  it('desativada não aparece até marcar mostrar desativadas', async () => {
    api();
    abrir('/guarnicoes');
    await screen.findByText('Auto Bomba 1');
    expect(screen.queryByText('Desligada')).toBeNull();
    await userEvent.click(screen.getByLabelText('Mostrar desativadas'));
    expect(within(await itemDe('Desligada')).getByText('desativada')).toBeInTheDocument();
  });

  it('nova guarnição envia a primeira versão vazia e abre a ficha', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/guarnicoes': { status: 201, corpo: FICHA } });
    abrir('/guarnicoes');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova guarnição' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Nome da guarnição'), 'Auto Resgate 2');
    expect(within(dialogo).queryByLabelText('Atividade')).toBeNull();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/guarnicoes')).toEqual({
        nome: 'Auto Resgate 2', vigencia: mesAtual(),
        versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] },
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Auto Bomba 1', level: 2 })).toBeInTheDocument();
  });
});

describe('ficha da guarnição', () => {
  it('mostra onde é usada e a sigla da viatura, sem atividade', async () => {
    api();
    abrir('/guarnicoes/g1');
    const secao = (await screen.findByRole('heading', { name: 'Onde é usada' })).closest('section')!;
    expect(within(secao).getByText('Ordinário')).toBeInTheDocument();
    expect(within(secao).getByText('08h–20h, 20h–08h')).toBeInTheDocument();
    expect(screen.getByLabelText('Sigla da viatura')).toHaveValue('ABT-01');
    expect(screen.queryByLabelText('Atividade')).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Diminuir máximo de Combatente' })).toBeDisabled();
    expect(screen.queryByLabelText(/Sem limite/)).toBeNull();
  });

  it('exige CNH mostra a lista e envia a categoria; desmarcar envia nulo', async () => {
    const f = api({ 'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    const exige = await screen.findByLabelText('Exige CNH para Combatente');
    expect(exige).not.toBeChecked();
    expect(screen.queryByLabelText('CNH exigida de Combatente')).toBeNull();
    await userEvent.click(exige);
    expect(screen.getByLabelText('CNH exigida de Combatente')).toHaveValue('D');
    await userEvent.selectOptions(screen.getByLabelText('CNH exigida de Combatente'), 'B');
    await userEvent.click(screen.getByLabelText('Exige CNH para Motorista'));
    expect(screen.queryByLabelText('CNH exigida de Motorista')).toBeNull();
    await salvarEm('2099-03', 'março de 2099');
    await waitFor(() =>
      expect((corpoEnviado(f, 'PUT /api/guarnicoes/g1/versoes/2099-03') as { composicao: unknown[] }).composicao).toEqual([
        { funcaoId: 'f-comb', minimo: 1, maximo: 3, cnhExigida: 'B' },
        { funcaoId: 'f-mot', minimo: 1, maximo: 1, cnhExigida: null },
      ]),
    );
  });

  it('remover tira a linha do envio', async () => {
    const f = api({ 'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Motorista' }));
    expect(screen.queryByRole('button', { name: /Retirar/ })).toBeNull();
    await salvarEm('2099-03', 'março de 2099');
    await waitFor(() =>
      expect((corpoEnviado(f, 'PUT /api/guarnicoes/g1/versoes/2099-03') as { composicao: unknown[] }).composicao).toEqual([
        { funcaoId: 'f-comb', minimo: 1, maximo: 3, cnhExigida: null },
      ]),
    );
  });

  it('salvar a partir de envia PUT no mês escolhido com a composição na ordem', async () => {
    const f = api({ 'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Aumentar mínimo de Combatente' }));
    await salvarEm('2099-03', 'março de 2099');
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
    fireEvent.change(valor('Sigla da viatura'), { target: { value: 'ABT-02' } });
    await salvarEm('2099-03', 'março de 2099');
    expect(await screen.findByText('Só dá para mudar a partir de novembro de 2026.')).toBeInTheDocument();
  });

  it('nova função cria e já seleciona', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/funcoes': { status: 201, corpo: { id: 'f-new', nome: 'Socorrista', unidadeSigla: '1ª SB', herdada: false } } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir função' }));
    await userEvent.selectOptions(await screen.findByLabelText('Função 3'), 'Nova função…');
    await userEvent.type(screen.getByLabelText('Nome da nova função'), 'Socorrista');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/funcoes')).toEqual({ nome: 'Socorrista' }));
    await waitFor(() => expect(screen.getByLabelText('Função 3')).toHaveValue('f-new'));
  });

  it('a função herdada mostra a sigla de onde vem e não tem lápis', async () => {
    api();
    abrir('/guarnicoes/g1');
    const escolha = await screen.findByLabelText('Função 2');
    expect(await within(escolha).findByRole('option', { name: 'Motorista (2º GB)' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Renomear Combatente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renomear Motorista' })).toBeNull();
  });

  it('renomear função envia PATCH e fecha o campo', async () => {
    const f = api({ 'PATCH /api/funcoes/f-comb': { status: 200, corpo: { id: 'f-comb', nome: 'Combatente de linha', unidadeSigla: '1ª SB', herdada: false } } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Renomear Combatente' }));
    const campo = screen.getByLabelText('Novo nome de Combatente');
    expect(campo).toHaveValue('Combatente');
    expect(screen.getByText('O nome muda em todas as guarnições.')).toBeInTheDocument();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Combatente de linha');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/funcoes/f-comb')).toEqual({ nome: 'Combatente de linha' }));
    await waitFor(() => expect(screen.queryByLabelText('Novo nome de Combatente')).toBeNull());
  });

  it('desativar agora envia o mês corrente', async () => {
    const f = api({ 'POST /api/guarnicoes/g1/situacao': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar agora' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g1/situacao')).toEqual({ ativa: false, aPartirDe: mesAtual() }));
  });

  it('desativar a partir de envia o mês escolhido', async () => {
    const f = api({ 'POST /api/guarnicoes/g1/situacao': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar a partir de…' }));
    fireEvent.change(screen.getByLabelText('Desativar a partir de'), { target: { value: '2099-05' } });
    await userEvent.click(screen.getByRole('button', { name: 'Desativar a partir de maio de 2099' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g1/situacao')).toEqual({ ativa: false, aPartirDe: '2099-05' }));
  });

  it('depois de desativar, o editor mostra a versão desativada', async () => {
    const inativa: FichaGuarnicao = { ...FICHA, desativadaAPartirDe: '2026-01', versoes: FICHA.versoes.map((v) => ({ ...v, ativa: false })) };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
      'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
      'POST /api/guarnicoes/g1/situacao': { status: 200, corpo: inativa },
    };
    simularApi(rotas);
    abrir('/guarnicoes/g1');
    const desativar = await screen.findByRole('button', { name: 'Desativar agora' });
    rotas['GET /api/guarnicoes/g1'] = { status: 200, corpo: inativa };
    await userEvent.click(desativar);
    await screen.findByText('Desativada desde janeiro de 2026.');
    expect(await screen.findByRole('button', { name: 'Reativar agora' })).toBeInTheDocument();
  });

  it('guarnição desativada mostra reativar agora', async () => {
    const f = api({
      'GET /api/guarnicoes/g8': { status: 200, corpo: { ...FICHA, id: 'g8', desativadaAPartirDe: '2026-01' } },
      'POST /api/guarnicoes/g8/situacao': { status: 200, corpo: FICHA },
    });
    abrir('/guarnicoes/g8');
    expect(await screen.findByText('Desativada desde janeiro de 2026.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reativar agora' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g8/situacao')).toEqual({ ativa: true, aPartirDe: mesAtual() }));
  });

  it('desativação marcada para o futuro pode ser cancelada', async () => {
    const f = api({
      'GET /api/guarnicoes/g9': { status: 200, corpo: { ...FICHA, id: 'g9', desativadaAPartirDe: '2099-01' } },
      'POST /api/guarnicoes/g9/situacao': { status: 200, corpo: FICHA },
    });
    abrir('/guarnicoes/g9');
    expect(await screen.findByText('Será desativada em janeiro de 2099.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar desativação' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g9/situacao')).toEqual({ ativa: true, aPartirDe: '2099-01' }));
  });

  it('revisão 3: versão do mês inativa com uma futura ativa aparece desativada, como na lista', async () => {
    const v = FICHA.versoes[0]!;
    const f = api({
      'GET /api/guarnicoes/g10': { status: 200, corpo: { ...FICHA, id: 'g10', desativadaAPartirDe: null, versoes: [{ ...v, vigencia: '2099-01', ativa: true }, { ...v, vigencia: '2026-01', ativa: false }] } },
      'POST /api/guarnicoes/g10/situacao': { status: 200, corpo: FICHA },
    });
    abrir('/guarnicoes/g10');
    expect(await screen.findByText('Desativada desde janeiro de 2026.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desativar agora' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reativar agora' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g10/situacao')).toEqual({ ativa: true, aPartirDe: mesAtual() }));
  });

  it('guarnição que só começa no futuro propõe salvar a partir do começo dela, sem marcar em vigor', async () => {
    const futura = (v: string) => ({ ...FICHA.versoes[0]!, vigencia: v });
    api({ 'GET /api/guarnicoes/g5': { status: 200, corpo: { ...FICHA, id: 'g5', versoes: [futura('2099-06'), futura('2099-01')] } } });
    abrir('/guarnicoes/g5');
    expect(await screen.findByLabelText('A partir de')).toHaveValue('2099-01');
    expect(screen.queryByText('em vigor')).toBeNull();
  });
});

describe('ficha da guarnição em painel único', () => {
  it('o resumo da guarnição diz só a viatura (a ordem agora é da escala)', async () => {
    const v = FICHA.versoes[0]!;
    api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: { ...FICHA, versoes: [{ ...v, viatura: 'AR', tipoViatura: 'Auto Resgate', prioridade: 2 }] } } });
    abrir('/guarnicoes/g1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Auto Bomba 1' })).closest('[data-ficha]') as HTMLElement;
    expect(within(ficha).getByText('Viatura AR, Auto Resgate.')).toBeInTheDocument();
  });

  it('o resumo sem viatura', async () => {
    const v = FICHA.versoes[0]!;
    api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: { ...FICHA, versoes: [{ ...v, viatura: null, tipoViatura: null, prioridade: null }] } } });
    abrir('/guarnicoes/g1');
    expect(await screen.findByText('Sem viatura.')).toBeInTheDocument();
  });

  it('a situação fica no cabeçalho da ficha', async () => {
    api();
    abrir('/guarnicoes/g1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Auto Bomba 1' })).closest('[data-ficha]') as HTMLElement;
    const cabecalho = ficha.querySelector('header') as HTMLElement;
    expect(within(cabecalho).getByRole('button', { name: 'Desativar agora' })).toBeInTheDocument();
  });

  it('o item aberto na lista fica marcado', async () => {
    api();
    abrir('/guarnicoes/g1');
    const link = (await screen.findAllByText('Auto Bomba 1')).map((e) => e.closest('a')).find(Boolean)!;
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('shadow-[inset_3px_0_0');
  });

  it('todas desativadas, a lista explica o que marcar', async () => {
    api({ 'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA.map((g) => ({ ...g, ativa: false })) } });
    abrir('/guarnicoes');
    expect(await screen.findByText('Todas as guarnições estão desativadas. Marque "Mostrar desativadas" para vê-las.')).toBeInTheDocument();
  });
});

describe('guarnições: singular, ordem, versões e composição', () => {
  it('uma guarnição de um militar diz 1 militar', async () => {
    api({ 'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [linha({ id: 'g9', nome: 'Solo', minimo: 1, maximo: 1 })] } });
    abrir('/guarnicoes');
    expect(within(await itemDe('Solo')).getByText('1 militar')).toBeInTheDocument();
    expect(screen.queryByText('1 militares')).toBeNull();
  });

  it('as versões não têm a caixa Ativa', async () => {
    api();
    abrir('/guarnicoes/g1');
    await screen.findByLabelText('Sigla da viatura');
    expect(screen.queryByRole('checkbox', { name: 'Ativa' })).toBeNull();
  });

  it('a lista já não mostra número de ordem de ativação (a ordem agora é da escala)', async () => {
    api();
    abrir('/guarnicoes');
    expect(within(await itemDe('Auto Bomba 1')).queryByText('1', { selector: 'span' })).toBeNull();
    expect(within(await itemDe('Resgate')).queryByText('–')).toBeNull();
    expect(screen.getByText('4 guarnições')).toBeInTheDocument();
  });

  it('versão futura tem borda tracejada', async () => {
    const v = FICHA.versoes[0]!;
    api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: { ...FICHA, versoes: [{ ...v, vigencia: '2099-01' }, v] } } });
    abrir('/guarnicoes/g1');
    const futura = await screen.findByRole('button', { name: /^janeiro de 2099/ });
    expect(futura).toHaveAttribute('data-futura');
    expect(futura.className).toContain('border-dashed');
    expect(screen.getByRole('button', { name: /^janeiro de 2026/ })).not.toHaveAttribute('data-futura');
  });

  it('salvar num mês novo deixa a versão nova escolhida', async () => {
    const v = FICHA.versoes[0]!;
    const salva: FichaGuarnicao = { ...FICHA, versoes: [{ ...v, vigencia: '2099-03', viatura: 'ABT-02' }, v] };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
      'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
      'PUT /api/guarnicoes/g1/versoes/2099-03': { status: 200, corpo: salva },
    };
    simularApi(rotas);
    abrir('/guarnicoes/g1');
    await screen.findByLabelText('Mínimo de Combatente');
    fireEvent.change(valor('Sigla da viatura'), { target: { value: 'ABT-02' } });
    rotas['GET /api/guarnicoes/g1'] = { status: 200, corpo: salva };
    await salvarEm('2099-03', 'março de 2099');
    const chip = await screen.findByRole('button', { name: /^março de 2099/ });
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByLabelText('Sigla da viatura')).toHaveValue('ABT-02');
  });

  it('a linha da composição é uma grade que não quebra no computador', async () => {
    api();
    abrir('/guarnicoes/g1');
    const linhaMot = (await screen.findByLabelText('Exige CNH para Motorista')).closest('li')!;
    expect(linhaMot.firstElementChild!.className).toContain('sm:grid-cols-[');
  });
});

describe('revisão final: guarnição', () => {
  it('Desativar agora com a composição pendente pergunta e, cancelando, não perde a edição', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const f = api({ 'POST /api/guarnicoes/g1/situacao': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir função' }));
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desativar agora' }));
    expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE);
    expect(f.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    confirmar.mockRestore();
  });

  it('Desativar agora com a composição pendente, confirmando, desativa', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const f = api({ 'POST /api/guarnicoes/g1/situacao': { status: 200, corpo: FICHA } });
    abrir('/guarnicoes/g1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir função' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desativar agora' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/guarnicoes/g1/situacao')).toEqual({ ativa: false, aPartirDe: mesAtual() }));
    confirmar.mockRestore();
  });

  it('uma importação com a ficha aberta recarrega os campos da versão', async () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
      'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
    };
    simularApi(rotas);
    const router = abrir('/guarnicoes/g1');
    expect(await screen.findByLabelText('Sigla da viatura')).toHaveValue('ABT-01');
    rotas['GET /api/guarnicoes/g1'] = { status: 200, corpo: { ...FICHA, versoes: [{ ...FICHA.versoes[0]!, viatura: 'ABT-IMPORTADA', prioridade: 7 }] } };
    await act(async () => {
      atualizarGuarnicoes(router.options.context.queryClient, 'g1');
    });
    await waitFor(() => expect(screen.getByLabelText('Sigla da viatura')).toHaveValue('ABT-IMPORTADA'));
    expect(screen.queryByLabelText('Prioridade')).toBeNull();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('com edição pendente, a importação não apaga o que a pessoa digitou', async () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: FUNCOES },
      'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA },
    };
    simularApi(rotas);
    const router = abrir('/guarnicoes/g1');
    fireEvent.change(await screen.findByLabelText('Sigla da viatura'), { target: { value: 'DIGITADA' } });
    rotas['GET /api/guarnicoes/g1'] = { status: 200, corpo: { ...FICHA, versoes: [{ ...FICHA.versoes[0]!, viatura: 'ABT-IMPORTADA' }] } };
    await act(async () => {
      atualizarGuarnicoes(router.options.context.queryClient, 'g1');
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByLabelText('Sigla da viatura')).toHaveValue('DIGITADA');
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
  });

  it('trazer de volta uma versão antiga deixa salvar a partir do mês escolhido', async () => {
    const v = FICHA.versoes[0]!;
    const velha = { ...v, vigencia: '2020-01', viatura: 'ANTIGA' };
    const vigente = { ...v, vigencia: '2021-01', viatura: 'VIGENTE' };
    api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: { ...FICHA, versoes: [vigente, velha] } } });
    abrir('/guarnicoes/g1');
    const salvar = () => screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(mesAtual())}` });
    expect(await screen.findByLabelText('Sigla da viatura')).toHaveValue('VIGENTE');
    expect(salvar()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^janeiro de 2020/ }));
    expect(screen.getByLabelText('Sigla da viatura')).toHaveValue('ANTIGA');
    expect(salvar()).toBeEnabled();
    // sem nada mudado, não é "alteração não salva": sair da ficha não pergunta
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });
});

describe('revisão 3: menores da tela de guarnições', () => {
  const comMaximo = (maximo: number): FichaGuarnicao => ({
    ...FICHA, id: 'g11',
    versoes: [{ ...FICHA.versoes[0]!, composicao: [{ funcaoId: 'f-comb', funcao: 'Combatente', minimo: 1, maximo, cnhExigida: null }] }],
  });

  it('o botão de aumentar o máximo para no limite do contrato (99)', async () => {
    api({ 'GET /api/guarnicoes/g11': { status: 200, corpo: comMaximo(99) } });
    abrir('/guarnicoes/g11');
    expect(await screen.findByRole('button', { name: 'Aumentar máximo de Combatente' })).toBeDisabled();
  });

  it('abaixo do limite o botão de aumentar o máximo continua ativo', async () => {
    api({ 'GET /api/guarnicoes/g11': { status: 200, corpo: comMaximo(98) } });
    abrir('/guarnicoes/g11');
    expect(await screen.findByRole('button', { name: 'Aumentar máximo de Combatente' })).toBeEnabled();
  });

  it('o formulário da versão não tem mais o campo Prioridade (a ordem agora é da escala)', async () => {
    api({ 'GET /api/guarnicoes/g11': { status: 200, corpo: comMaximo(2) } });
    abrir('/guarnicoes/g11');
    await screen.findByLabelText('Sigla da viatura');
    expect(screen.queryByLabelText('Prioridade')).toBeNull();
  });

  it('a lista diz "1 guarnição" no singular', async () => {
    api({ 'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [linha({})] } });
    abrir('/guarnicoes');
    expect(await screen.findByText('1 guarnição')).toBeInTheDocument();
    expect(screen.queryByText('1 guarnições')).toBeNull();
  });

  it('a versão que só vale no futuro diz isso também para o leitor de tela', async () => {
    const futura = (v: string) => ({ ...FICHA.versoes[0]!, vigencia: v });
    api({ 'GET /api/guarnicoes/g5': { status: 200, corpo: { ...FICHA, id: 'g5', versoes: [futura('2099-06'), futura('2099-01')] } } });
    abrir('/guarnicoes/g5');
    const chip = await screen.findByRole('button', { name: /^janeiro de 2099/ });
    expect(chip).toHaveAccessibleName(expect.stringMatching(/ainda não vale/));
  });

  it('Salvar o nome da guarnição com dois cliques manda um pedido só e trava até a resposta', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA }, 'PATCH /api/guarnicoes/g1': { status: 200, corpo: { ...FICHA, nome: 'Auto Bomba 9' }, espera } });
    abrir('/guarnicoes/g1');
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Auto Bomba 9' } });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    expect(salvar).toBeDisabled();
    soltar();
    await waitFor(() => expect(chamadasA(f, 'PATCH /api/guarnicoes/g1')).toBe(1));
  });

  it('Salvar a versão com dois cliques manda um pedido só', async () => {
    const { espera, soltar } = trava();
    const rota = `PUT /api/guarnicoes/g1/versoes/${mesAtual()}`;
    const f = api({ 'GET /api/guarnicoes/g1': { status: 200, corpo: FICHA }, [rota]: { status: 200, corpo: FICHA, espera } });
    abrir('/guarnicoes/g1');
    fireEvent.change(await screen.findByLabelText('Sigla da viatura'), { target: { value: 'ABT-77' } });
    const salvar = screen.getByRole('button', { name: /Salvar a partir de/ });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    soltar();
    await waitFor(() => expect(chamadasA(f, rota)).toBe(1));
  });
});
