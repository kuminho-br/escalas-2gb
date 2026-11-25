import type { LinhaDaBusca, ResultadoDaBusca } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.51, Task 3: a seleção de militares na pesquisa, que acumula entre buscas e é a entrada da 6.52. Dados fictícios (D7).
const NIVEL = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const linha = (id: string, nomeGuerra: string, extra: Partial<LinhaDaBusca> = {}): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', equipe: null, jornada: 'adm', situacao: 'Ativa', unidadeId: 'u-1sb', podeAlterar: true, ...extra,
});
const resultado = (militares: LinhaDaBusca[], haMais = false): ResultadoDaBusca => ({ militares, haMais, naoEncontradas: [] });

/** Cada "Buscar" recebe a próxima resposta da fila (a última se repete). */
function api(fila: ResultadoDaBusca[], eu: unknown = NIVEL) {
  const f = simularApi({ '/api/eu': { status: 200, corpo: eu }, 'GET /api/consulta/unidades': { status: 200, corpo: [] }, 'GET /api/consulta/militares': { status: 200, corpo: { militares: [linha('c1', 'COMUM1')], haMais: false } } });
  const padrao = f.getMockImplementation()!;
  let n = 0;
  f.mockImplementation(async (entrada, init) => {
    if (String(entrada).includes('/api/consulta/militares/buscar')) {
      const corpo = fila[Math.min(n++, fila.length - 1)]!;
      return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return padrao(entrada, init);
  });
  return f;
}
const buscar = async (texto: string) => {
  const campo = await screen.findByLabelText('Nome, nome de guerra ou matrícula');
  await userEvent.clear(campo);
  await userEvent.type(campo, texto);
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
};
const marca = (nome: string) => screen.findByRole('checkbox', { name: `Selecionar ${nome}` });
const painel = () => screen.queryByRole('region', { name: /^Selecionados/ });

describe('a seleção na pesquisa (6.51)', () => {
  it('Review Focus 1: a seleção acumula entre buscas, e quem saiu do resultado continua selecionado', async () => {
    api([resultado([linha('m1', 'ANDRADE'), linha('m2', 'BARRETO'), linha('m3', 'CABRAL')]), resultado([linha('m4', 'DANTAS'), linha('m5', 'ESTEVES')])]);
    abrir('/peculio/pesquisar');
    await buscar('abc');
    for (const n of ['SD ANDRADE', 'SD BARRETO', 'SD CABRAL']) await userEvent.click(await marca(n));
    expect(await screen.findByRole('heading', { name: 'Selecionados (3)' })).toBeInTheDocument();
    await buscar('def');
    await userEvent.click(await marca('SD DANTAS'));
    await userEvent.click(await marca('SD ESTEVES'));
    expect(await screen.findByRole('heading', { name: 'Selecionados (5)' })).toBeInTheDocument();
    // o ANDRADE não está mais no resultado, e segue no painel
    expect(screen.queryByRole('checkbox', { name: 'Selecionar SD ANDRADE' })).toBeNull();
    expect(within(painel()!).getByText('ANDRADE')).toBeInTheDocument();
  });

  it('marcar de novo desmarca; "Tirar" tira um do painel (e a marca da linha acompanha); "Limpar" esvazia', async () => {
    api([resultado([linha('m1', 'ANDRADE'), linha('m2', 'BARRETO')])]);
    abrir('/peculio/pesquisar');
    await buscar('abc');
    const a = await marca('SD ANDRADE');
    await userEvent.click(a);
    await userEvent.click(a);
    expect(painel()).toBeNull();
    await userEvent.click(a);
    await userEvent.click(await marca('SD BARRETO'));
    await screen.findByRole('heading', { name: 'Selecionados (2)' });
    await userEvent.click(within(painel()!).getByRole('button', { name: 'Tirar SD ANDRADE' }));
    expect(await screen.findByRole('heading', { name: 'Selecionados (1)' })).toBeInTheDocument();
    expect(await marca('SD ANDRADE')).not.toBeChecked();
    await userEvent.click(within(painel()!).getByRole('button', { name: 'Limpar' }));
    await waitFor(() => expect(painel()).toBeNull());
    expect(await marca('SD BARRETO')).not.toBeChecked();
  });

  it('"Selecionar estes {n}" marca o resultado inteiro, sem repetir quem já estava', async () => {
    api([resultado([linha('m1', 'ANDRADE'), linha('m2', 'BARRETO'), linha('m3', 'CABRAL')])]);
    abrir('/peculio/pesquisar');
    await buscar('abc');
    await userEvent.click(await marca('SD ANDRADE'));
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 3' }));
    expect(await screen.findByRole('heading', { name: 'Selecionados (3)' })).toBeInTheDocument();
  });

  /** `buscar/todos` (6.54): a lista inteira do filtro; o `fila` da `api` só atende o `buscar` cortado. */
  function comTodos(f: ReturnType<typeof api>, resposta: { status: number; corpo: unknown }) {
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (entrada, init) => {
      if (String(entrada).endsWith('/api/consulta/militares/buscar/todos')) return new Response(JSON.stringify(resposta.corpo), { status: resposta.status, headers: { 'Content-Type': 'application/json' } });
      return padrao(entrada, init);
    });
  }

  it('Review Focus 3 (6.54): com "mais de 500", o botão é "Selecionar todos": busca a lista inteira do filtro, seleciona os que a pessoa pode alterar, e a frase "Só os 500 mostrados" some', async () => {
    const quinhentos = Array.from({ length: 500 }, (_, i) => linha(`m${i}`, `M${i}`));
    const inteira = [...Array.from({ length: 520 }, (_, i) => linha(`m${i}`, `M${i}`)), linha('x1', 'FORA1', { podeAlterar: false })];
    const f = api([resultado(quinhentos, true)]);
    comTodos(f, { status: 200, corpo: resultado(inteira) });
    abrir('/peculio/pesquisar');
    await buscar('abc');
    expect(screen.queryByRole('button', { name: /Selecionar estes/ })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar todos' }));
    expect(await screen.findByRole('heading', { name: 'Selecionados (520)' })).toBeInTheDocument();
    expect(screen.queryByText(/Só os 500 mostrados/)).toBeNull();
    const chamada = f.mock.calls.find(([e]) => String(e).endsWith('/api/consulta/militares/buscar/todos'))!;
    expect(JSON.parse(String(chamada[1]!.body))).toMatchObject({ texto: 'abc' });
    expect(await screen.findByText('1 militar fica de fora: você não tem nível de acesso sobre ele.')).toBeInTheDocument();
  });

  it('achado da revisão (6.54): com mais de 500 selecionados, "Atualizar em lote" fica travado com a frase do limite (a atualização vai até 500)', async () => {
    const quinhentos = Array.from({ length: 500 }, (_, i) => linha(`m${i}`, `M${i}`));
    const inteira = Array.from({ length: 520 }, (_, i) => linha(`m${i}`, `M${i}`));
    const f = api([resultado(quinhentos, true)]);
    comTodos(f, { status: 200, corpo: resultado(inteira) });
    abrir('/peculio/pesquisar');
    await buscar('abc');
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar todos' }));
    await screen.findByRole('heading', { name: 'Selecionados (520)' });
    expect(screen.getByRole('button', { name: 'Atualizar em lote' })).toBeDisabled();
    expect(screen.getByText('A atualização em lote vai até 500 militares. Tire alguns da seleção.')).toBeInTheDocument();
    for (let i = 0; i < 20; i++) await userEvent.click(screen.getByRole('button', { name: `Tirar SD M${i}` }));
    await screen.findByRole('heading', { name: 'Selecionados (500)' });
    expect(screen.getByRole('button', { name: 'Atualizar em lote' })).toBeEnabled();
    expect(screen.queryByText(/vai até 500 militares/)).toBeNull();
  });

  it('"Selecionar todos" com mais de 5000: a mensagem da API aparece e a seleção não muda', async () => {
    const quinhentos = Array.from({ length: 500 }, (_, i) => linha(`m${i}`, `M${i}`));
    const f = api([resultado(quinhentos, true)]);
    comTodos(f, { status: 400, corpo: { erro: 'Mais de 5000 militares. Afine a busca.' } });
    abrir('/peculio/pesquisar');
    await buscar('abc');
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar todos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mais de 5000 militares. Afine a busca.');
    expect(screen.queryByRole('heading', { name: /^Selecionados/ })).toBeNull();
  });

  it('quem o usuário não pode alterar aparece sem marca para usar, e fica fora de "Selecionar estes"', async () => {
    api([resultado([linha('m1', 'ANDRADE'), linha('m2', 'BARRETO', { podeAlterar: false })])]);
    abrir('/peculio/pesquisar');
    await buscar('abc');
    expect(await marca('SD BARRETO')).toBeDisabled();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 1' }));
    expect(await screen.findByRole('heading', { name: 'Selecionados (1)' })).toBeInTheDocument();
    expect(screen.getByText('1 militar fica de fora: você não tem nível de acesso sobre ele.')).toBeInTheDocument();
  });

  it('a seleção some ao sair do módulo Pecúlio (abrir uma ficha e voltar não a perde: ver lote.test.tsx)', async () => {
    api([resultado([linha('m1', 'ANDRADE')])]);
    const router = abrir('/peculio/pesquisar');
    await buscar('abc');
    await userEvent.click(await marca('SD ANDRADE'));
    await screen.findByRole('heading', { name: 'Selecionados (1)' });
    await router.navigate({ to: '/' });
    await router.navigate({ to: '/peculio/pesquisar' });
    await buscar('abc');
    await marca('SD ANDRADE');
    expect(painel()).toBeNull();
  });

  it('o militar comum não vê marca, painel nem "Selecionar estes"', async () => {
    api([], COMUM);
    abrir('/peculio/pesquisar');
    await buscar('abc');
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Selecionar estes/ })).toBeNull();
    expect(painel()).toBeNull();
  });

  it('a linha e a marca são controles separados: clicar na marca não abre a ficha, e o leitor de tela ouve "Selecionar {patente} {nome}"', async () => {
    api([resultado([linha('m1', 'ANDRADE', { postoGrad: '3º SGT' })])]);
    const router = abrir('/peculio/pesquisar');
    await buscar('abc');
    await userEvent.click(await marca('3º SGT ANDRADE'));
    expect(router.state.location.pathname).toBe('/peculio/pesquisar');
  });
});
