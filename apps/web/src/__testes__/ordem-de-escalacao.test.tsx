import type { Escala, OrdemDeEscalacao, VagaNaTela } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { atualizarOrdemDeEscalacao } from '@/api/ordem-de-escalacao';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Cenário fictício: ABT (Chefe 1–1, Combatente 2–3) e AR (Chefe 1–1) na escala Ordinário.
const MES = mesAtual();
const vaga = (g: 'ABT' | 'AR', funcao: string, n: number, posicao: number | null, obrigatoria = true): VagaNaTela => ({
  guarnicaoId: g === 'ABT' ? 'g-abt' : 'g-ar', guarnicao: g, funcaoId: funcao === 'Chefe' ? 'f-chefe' : 'f-comb', funcao, vaga: n, obrigatoria, posicao,
});
const ordem = (vigencia: string | null, posicoes: (number | null)[]): OrdemDeEscalacao => ({
  escalaId: 'e1', mes: MES, vigencia,
  vagas: [vaga('ABT', 'Chefe', 1, posicoes[0]!), vaga('ABT', 'Combatente', 1, posicoes[1]!), vaga('ABT', 'Combatente', 2, posicoes[2]!), vaga('ABT', 'Combatente', 3, posicoes[3]!, false), vaga('AR', 'Chefe', 1, posicoes[4]!)],
});
// sem ordem cadastrada: a sugestão numera tudo pela prioridade antiga
const SUGESTAO = ordem(null, [1, 2, 3, 4, 5]);
// ordem cadastrada com duas vagas ainda fora: Combatente 2 e Combatente 3 da ABT
const PARCIAL = ordem(MES, [1, 2, null, null, 3]);
const ficha = { id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true, montaBlocosVoluntariado: true, servicos: [], faixas: [], comLetra: false, vinculos: [] } as Escala;
const rotaOrdem = `/api/escalas/e1/ordem/${MES}`;

function api(corpo: OrdemDeEscalacao = PARCIAL, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/escalas/e1': { status: 200, corpo: ficha },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: [] }] },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
    [`GET ${rotaOrdem}`]: { status: 200, corpo },
    ...extra,
  });
}
const quadrado = (nome: string) => screen.getByRole('button', { name: nome });
const rodape = () => screen.getByTestId('rodape-da-ordem');

describe('ordem de escalação: abrir', () => {
  it('a ficha da escala tem o link "Ordem de escalação"', async () => {
    api();
    abrir('/escalas/e1');
    expect(await screen.findByRole('link', { name: 'Ordem de escalação' })).toHaveAttribute('href', '/escalas/e1/ordem');
  });

  it('a tela mostra um quadrado por vaga, com a posição de cada uma e a legenda de quem é extra', async () => {
    api();
    abrir('/escalas/e1/ordem');
    expect(await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' })).toBeInTheDocument();
    expect(quadrado('Chefe ABT, vaga 1, posição 1')).toHaveTextContent('1');
    expect(quadrado('Combatente ABT, vaga 1, posição 2')).toBeInTheDocument();
    expect(quadrado('Combatente ABT, vaga 2')).not.toHaveAttribute('data-posicao');
    expect(quadrado('Chefe ABT, vaga 1, posição 1')).toHaveAttribute('data-posicao', '1');
    expect(quadrado('Combatente ABT, vaga 3')).toHaveAttribute('data-extra');
    expect(quadrado('Combatente ABT, vaga 2')).not.toHaveAttribute('data-extra');
    expect(quadrado('Chefe AR, vaga 1, posição 3')).toBeInTheDocument();
  });

  it('sem ordem cadastrada, diz que a sugestão segue a prioridade antiga', async () => {
    api(SUGESTAO);
    abrir('/escalas/e1/ordem');
    expect(await screen.findByText('Ainda sem ordem cadastrada: a sugestão abaixo segue a prioridade antiga das guarnições.')).toBeInTheDocument();
    expect(quadrado('Combatente ABT, vaga 3, posição 4')).toBeInTheDocument();
  });

  it('o rodapé conta as vagas na ordem e diz o que falta', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    expect(rodape()).toHaveTextContent('3 de 5 vagas na ordem. Falta: Combatente 2 e Combatente 3 da ABT.');
  });
});

describe('ordem de escalação: montar a ordem', () => {
  it('clicar numa vaga sem número dá o próximo número; com todas na ordem, o rodapé diz isso', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(quadrado('Combatente ABT, vaga 2'));
    expect(quadrado('Combatente ABT, vaga 2, posição 4')).toBeInTheDocument();
    expect(rodape()).toHaveTextContent('4 de 5 vagas na ordem. Falta: Combatente 3 da ABT.');
    await userEvent.click(quadrado('Combatente ABT, vaga 3'));
    expect(rodape()).toHaveTextContent('Todas as vagas estão na ordem.');
  });

  it('clicar numa vaga numerada tira da ordem e as seguintes sobem um', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(quadrado('Chefe ABT, vaga 1, posição 1'));
    expect(quadrado('Chefe ABT, vaga 1')).toBeInTheDocument();
    expect(quadrado('Combatente ABT, vaga 1, posição 1')).toBeInTheDocument();
    expect(quadrado('Chefe AR, vaga 1, posição 2')).toBeInTheDocument();
  });

  it('a lista ao lado traz as vagas na ordem, e "Descer" troca duas vizinhas', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    const lista = screen.getByRole('list', { name: 'Ordem de preenchimento' });
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('Chefe ABT'), expect.stringContaining('Combatente ABT'), expect.stringContaining('Chefe AR')]);
    await userEvent.click(within(lista).getByRole('button', { name: 'Descer Chefe ABT, vaga 1' }));
    expect(quadrado('Chefe ABT, vaga 1, posição 2')).toBeInTheDocument();
    expect(quadrado('Combatente ABT, vaga 1, posição 1')).toBeInTheDocument();
    await userEvent.click(within(lista).getByRole('button', { name: 'Subir Chefe AR, vaga 1' }));
    expect(quadrado('Chefe AR, vaga 1, posição 2')).toBeInTheDocument();
  });

  it('"Limpar" tira todas as vagas da ordem', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(rodape()).toHaveTextContent('0 de 5 vagas na ordem.');
  });

  it('as setas andam entre as vagas e o espaço numera ou tira', async () => {
    api();
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    quadrado('Chefe ABT, vaga 1, posição 1').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(quadrado('Combatente ABT, vaga 1, posição 2'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(quadrado('Combatente ABT, vaga 2'));
    await userEvent.keyboard(' ');
    expect(quadrado('Combatente ABT, vaga 2, posição 4')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(quadrado('Combatente ABT, vaga 1, posição 2'));
  });
});

describe('ordem de escalação: salvar', () => {
  it('"Salvar" manda a ordem na ordem da lista e a tela passa a mostrar a que foi gravada', async () => {
    const gravada = ordem(MES, [1, 2, 3, null, 4]);
    const f = api(PARCIAL, { [`PUT ${rotaOrdem}`]: { status: 200, corpo: gravada } });
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(quadrado('Combatente ABT, vaga 2'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, `PUT ${rotaOrdem}`)).toEqual({
        itens: [{ guarnicaoId: 'g-abt', funcaoId: 'f-chefe', vaga: 1 }, { guarnicaoId: 'g-abt', funcaoId: 'f-comb', vaga: 1 }, { guarnicaoId: 'g-ar', funcaoId: 'f-chefe', vaga: 1 }, { guarnicaoId: 'g-abt', funcaoId: 'f-comb', vaga: 2 }],
      }),
    );
  });

  it('sem ordem cadastrada, dá para aceitar a sugestão com "Salvar"', async () => {
    const f = api(SUGESTAO, { [`PUT ${rotaOrdem}`]: { status: 200, corpo: ordem(MES, [1, 2, 3, 4, 5]) } });
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeEnabled();
    await userEvent.click(salvar);
    await waitFor(() => expect(chamadasA(f, `PUT ${rotaOrdem}`)).toBe(1));
  });

  it('dois cliques em Salvar mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api(PARCIAL, { [`PUT ${rotaOrdem}`]: { status: 200, corpo: PARCIAL, espera } });
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(quadrado('Combatente ABT, vaga 2'));
    const botao = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(botao);
    fireEvent.click(botao);
    soltar();
    await waitFor(() => expect(chamadasA(f, `PUT ${rotaOrdem}`)).toBe(1));
  });

  it('o erro da API aparece na tela e a ordem montada fica', async () => {
    api(PARCIAL, { [`PUT ${rotaOrdem}`]: { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { 'itens.0': 'Esta vaga não existe nesta escala em dezembro de 2026.' } } } });
    abrir('/escalas/e1/ordem');
    await screen.findByRole('heading', { name: 'Ordem de escalação — Ordinário' });
    await userEvent.click(quadrado('Combatente ABT, vaga 2'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Esta vaga não existe nesta escala/);
    expect(quadrado('Combatente ABT, vaga 2, posição 4')).toBeInTheDocument();
  });
});

describe('ordem de escalação: o servidor muda a composição com a tela aberta (revisão final)', () => {
  // o servidor passa a não ter o Combatente 1 da ABT (o máximo da função baixou); as outras vagas se renumeram
  const SEM_COMB_1: OrdemDeEscalacao = {
    escalaId: 'e1', mes: MES, vigencia: MES,
    vagas: [vaga('ABT', 'Chefe', 1, 1), vaga('ABT', 'Combatente', 2, null), vaga('ABT', 'Combatente', 3, null, false), vaga('AR', 'Chefe', 1, 2)],
  };
  const montar = () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/escalas/e1': { status: 200, corpo: ficha },
      [`GET ${rotaOrdem}`]: { status: 200, corpo: PARCIAL },
    };
    const f = simularApi(rotas);
    const router = abrir('/escalas/e1/ordem');
    return { rotas, f, router };
  };

  it('uma vaga numerada que some do servidor não derruba a tela: sem edição, ela acompanha o servidor', async () => {
    const { rotas, router } = montar();
    expect(await screen.findByRole('button', { name: 'Combatente ABT, vaga 1, posição 2' })).toBeInTheDocument();
    rotas[`GET ${rotaOrdem}`] = { status: 200, corpo: SEM_COMB_1 };
    await act(async () => {
      atualizarOrdemDeEscalacao(router.options.context.queryClient, 'e1');
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Combatente ABT, vaga 1/ })).toBeNull());
    expect(quadrado('Chefe AR, vaga 1, posição 2')).toBeInTheDocument();
    expect(rodape()).toHaveTextContent('2 de 4 vagas na ordem.');
  });

  it('com a ordem editada, a vaga que sumiu sai da lista, as posições se fecham e o PUT não a manda', async () => {
    const { rotas, f, router } = montar();
    await screen.findByRole('button', { name: 'Combatente ABT, vaga 1, posição 2' });
    await userEvent.click(quadrado('Combatente ABT, vaga 2')); // pendente: posição 4
    rotas[`GET ${rotaOrdem}`] = { status: 200, corpo: SEM_COMB_1 };
    rotas[`PUT ${rotaOrdem}`] = { status: 200, corpo: SEM_COMB_1 };
    await act(async () => {
      atualizarOrdemDeEscalacao(router.options.context.queryClient, 'e1');
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Combatente ABT, vaga 1/ })).toBeNull());
    // Chefe ABT 1, Chefe AR 1 e Combatente ABT 2: 1, 2 e 3, sem buraco
    expect(quadrado('Chefe ABT, vaga 1, posição 1')).toBeInTheDocument();
    expect(quadrado('Chefe AR, vaga 1, posição 2')).toBeInTheDocument();
    expect(quadrado('Combatente ABT, vaga 2, posição 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, `PUT ${rotaOrdem}`)).toEqual({
        itens: [{ guarnicaoId: 'g-abt', funcaoId: 'f-chefe', vaga: 1 }, { guarnicaoId: 'g-ar', funcaoId: 'f-chefe', vaga: 1 }, { guarnicaoId: 'g-abt', funcaoId: 'f-comb', vaga: 2 }],
      }),
    );
  });
});
