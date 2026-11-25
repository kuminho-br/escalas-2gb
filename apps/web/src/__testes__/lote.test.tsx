import type { LinhaDaBusca, PreviaDoLote, ResultadoDaBusca } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, escolherNaArvore, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.52, Task 3: o painel "Atualizar em lote" sobre a seleção da pesquisa. Dados fictícios (D7).
const NIVEL = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };
const linha = (id: string, nomeGuerra: string): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', equipe: null, jornada: 'adm', situacao: 'Ativa', unidadeId: 'u-1sb', podeAlterar: true,
});
const BUSCA: ResultadoDaBusca = { militares: [linha('m1', 'ANDRADE'), linha('m2', 'BARRETO')], haMais: false, naoEncontradas: [] };
const PREVIA: PreviaDoLote = {
  mudam: [
    { id: 'm1', posto: 'SD', nomeGuerra: 'ANDRADE', matricula: '990001-1', de: 'Jornada: ADM', para: 'Jornada: Pronto' },
    { id: 'm2', posto: 'SD', nomeGuerra: 'BARRETO', matricula: '990002-2', de: 'Jornada: ADM', para: 'Jornada: Pronto' },
  ],
  ficamDeFora: [{ id: 'm3', posto: 'CB', nomeGuerra: 'CABRAL', matricula: '990003-3', motivo: 'Nada muda para este militar.' }],
  chegamSemEquipe: 0,
  assinatura: 'abc123',
};
const UNIDADES = [
  { id: 'u-gb', sigla: '2º GB', nome: '2º Grupamento', maeId: null }, { id: 'u-1sb', sigla: '1ª SB', nome: '1ª Seção', maeId: 'u-gb' }, { id: 'u-2sb', sigla: '2ª SB', nome: '2ª Seção', maeId: 'u-gb' },
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: NIVEL },
    'GET /api/consulta/unidades': { status: 200, corpo: [] },
    'POST /api/consulta/militares/buscar': { status: 200, corpo: BUSCA },
    'GET /api/unidades-de-lotacao': { status: 200, corpo: UNIDADES },
    'GET /api/quadros': { status: 200, corpo: [{ id: 'q-bmg', sigla: 'QBMG', nome: 'Praças', oficial: false, postoGradIds: [] }] },
    'GET /api/situacoes-do-militar': { status: 200, corpo: [{ id: 's-ativa', nome: 'Ativa', escalavel: true, ativo: true }] },
    'GET /api/funcoes-do-militar': { status: 200, corpo: [{ id: 'f-chefe', nome: 'Chefe de seção', ativo: true }] },
    'POST /api/peculio/lote/previa': { status: 200, corpo: PREVIA },
    'POST /api/peculio/lote/aplicar': { status: 200, corpo: { mudaram: 2, ficaramDeFora: PREVIA.ficamDeFora } },
    ...extra,
  });
}
const corpos = (f: ReturnType<typeof simularApi>, fim: string) => f.mock.calls.filter(([e, i]) => String(e).endsWith(fim) && i?.method === 'POST').map(([, i]) => JSON.parse(String(i!.body)));
async function selecionarTodos() {
  await userEvent.type(await screen.findByLabelText('Nome, nome de guerra ou matrícula'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 2' }));
  await screen.findByRole('heading', { name: 'Selecionados (2)' });
}
const abrirPainel = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Atualizar em lote' }));
  return within(await screen.findByRole('dialog', { name: 'Atualizar em lote' }));
};

describe('o painel Atualizar em lote (6.52)', () => {
  it('o botão está no painel dos selecionados, e só aparece com alguém selecionado', async () => {
    api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await screen.findByLabelText('Nome, nome de guerra ou matrícula'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(screen.queryByRole('button', { name: 'Atualizar em lote' })).toBeNull();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar SD ANDRADE' }));
    expect(await screen.findByRole('button', { name: 'Atualizar em lote' })).toBeEnabled();
  });

  it('passo 1, Campos: "Continuar" fica travado até marcar um campo', async () => {
    api();
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    expect(p.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    for (const campo of ['Lotação', 'Equipe', 'Jornada', 'Quadro', 'Situação', 'Voluntário JES', 'Função', 'Abono de permanência', 'Comportamento']) {
      expect(p.getByRole('checkbox', { name: campo }), campo).toBeInTheDocument();
    }
    await userEvent.click(p.getByRole('checkbox', { name: 'Jornada' }));
    expect(p.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('passo 2, Valores: um valor por campo marcado; "A partir de" só quando há campo do rastreio', async () => {
    api();
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    let p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    expect(await p.findByLabelText('Voluntário JES')).toBeInTheDocument();
    expect(p.queryByLabelText('A partir de')).toBeNull();
    await userEvent.click(p.getByRole('button', { name: 'Voltar' }));
    await userEvent.click(p.getByRole('checkbox', { name: 'Jornada' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    expect(await p.findByLabelText('A partir de')).toBeInTheDocument();
    expect(p.getByLabelText('Jornada')).toBeInTheDocument();
    p = within(screen.getByRole('dialog', { name: 'Atualizar em lote' }));
  });

  it('passo 3, Prévia: quantos mudam, quantos chegam sem equipe, e quem fica de fora com o motivo; o corpo leva os ids, o dia e os campos', async () => {
    const f = api({ 'POST /api/peculio/lote/previa': { status: 200, corpo: { ...PREVIA, chegamSemEquipe: 2 } } });
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Jornada' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.selectOptions(await p.findByLabelText('Jornada'), 'pronto');
    await userEvent.clear(p.getByLabelText('A partir de'));
    await userEvent.type(p.getByLabelText('A partir de'), '2026-12-01');
    await userEvent.click(p.getByRole('button', { name: 'Ver a prévia' }));
    expect(await p.findByText('2 militares vão mudar')).toBeInTheDocument();
    expect(p.getByText('2 chegam sem equipe')).toBeInTheDocument();
    expect(p.getAllByText('Jornada: ADM → Jornada: Pronto')).toHaveLength(2);
    expect(p.getByText('CABRAL')).toBeInTheDocument();
    expect(p.getByText('Nada muda para este militar.')).toBeInTheDocument();
    expect(corpos(f, '/lote/previa')).toEqual([{ militarIds: ['m1', 'm2'], desde: '2026-12-01', campos: { jornada: 'pronto' } }]);
  });

  it('a lotação se escolhe pela árvore, e "sem equipe" vai como null', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Lotação' }));
    await userEvent.click(p.getByRole('checkbox', { name: 'Equipe' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await escolherNaArvore(await p.findByLabelText('Lotação'), '2ª SB, em 2º GB');
    await userEvent.click(p.getByRole('checkbox', { name: 'Sem equipe' }));
    await userEvent.click(p.getByRole('button', { name: 'Ver a prévia' }));
    await p.findByText('2 militares vão mudar');
    const enviado = corpos(f, '/lote/previa')[0];
    expect(enviado.campos).toEqual({ unidadeId: 'u-2sb', equipe: null });
    expect(enviado.desde).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('passo 4, Aplicar: "Aplicar a {n} militares" manda a assinatura, o resultado diz quantos mudaram, e fechar limpa a seleção e refaz a busca', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.selectOptions(await p.findByLabelText('Voluntário JES'), 'sim');
    await userEvent.click(p.getByRole('button', { name: 'Ver a prévia' }));
    await userEvent.click(await p.findByRole('button', { name: 'Aplicar a 2 militares' }));
    expect(await p.findByText('2 militares alterados')).toBeInTheDocument();
    expect(p.getByText('Nada muda para este militar.')).toBeInTheDocument();
    expect(corpos(f, '/lote/aplicar')).toEqual([{ militarIds: ['m1', 'm2'], campos: { voluntarioJes: true }, assinatura: 'abc123' }]);
    const antes = corpos(f, '/militares/buscar').length;
    await userEvent.click(p.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('heading', { name: /^Selecionados/ })).toBeNull();
    await waitFor(() => expect(corpos(f, '/militares/buscar').length).toBeGreaterThan(antes));
  });

  it('Review Focus 4: o botão fica travado enquanto grava, e o clique duplo manda um pedido só', async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((r) => (liberar = r));
    const f = api({ 'POST /api/peculio/lote/aplicar': { status: 200, corpo: { mudaram: 2, ficaramDeFora: [] }, espera } });
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await p.findByRole('button', { name: 'Ver a prévia' }));
    const aplicar = await p.findByRole('button', { name: 'Aplicar a 2 militares' });
    await userEvent.dblClick(aplicar);
    await waitFor(() => expect(p.getByRole('button', { name: /Aplicando/ })).toBeDisabled());
    expect(corpos(f, '/lote/aplicar')).toHaveLength(1);
    liberar();
    expect(await p.findByText('2 militares alterados')).toBeInTheDocument();
  });

  it('Review Focus 4: o 409 da lista que mudou volta à prévia com o aviso, e a prévia é refeita', async () => {
    const f = api({ 'POST /api/peculio/lote/aplicar': { status: 409, corpo: { erro: 'A lista mudou desde a prévia. Refaça a prévia.' } } });
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await p.findByRole('button', { name: 'Ver a prévia' }));
    await userEvent.click(await p.findByRole('button', { name: 'Aplicar a 2 militares' }));
    expect(await p.findByRole('alert')).toHaveTextContent('A lista mudou desde a prévia. Refaça a prévia.');
    expect(p.getByText('2 militares vão mudar')).toBeInTheDocument();
    await waitFor(() => expect(corpos(f, '/lote/previa')).toHaveLength(2));
    // nada foi dado como alterado
    expect(p.queryByText(/militares alterados/)).toBeNull();
  });

  it('Review Focus 5: com gente de fora na prévia, o lote segue com quem pode, e o motivo dos outros aparece', async () => {
    api({ 'POST /api/peculio/lote/previa': { status: 200, corpo: { ...PREVIA, mudam: [PREVIA.mudam[0]!], ficamDeFora: [{ id: 'm2', posto: 'SD', nomeGuerra: 'BARRETO', matricula: '990002-2', motivo: 'Você não tem nível de acesso sobre este militar.' }] } } });
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await p.findByRole('button', { name: 'Ver a prévia' }));
    expect(await p.findByText('1 militar vai mudar')).toBeInTheDocument();
    expect(p.getByText('Você não tem nível de acesso sobre este militar.')).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Aplicar a 1 militar' })).toBeEnabled();
  });

  it('com ninguém para mudar, não há o que aplicar', async () => {
    api({ 'POST /api/peculio/lote/previa': { status: 200, corpo: { ...PREVIA, mudam: [] } } });
    abrir('/peculio/pesquisar');
    await selecionarTodos();
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(await p.findByRole('button', { name: 'Ver a prévia' }));
    expect(await p.findByText('Nenhum militar vai mudar.')).toBeInTheDocument();
    expect(p.queryByRole('button', { name: /^Aplicar a/ })).toBeNull();
  });
});

describe('depois de aplicar, a ficha lê de novo (6.53, item d)', () => {
  it('a ficha aberta antes do lote não volta com o dado velho: ao abrir de novo, espera a leitura nova', async () => {
    const f = api({ 'GET /api/militares/m1': { status: 403, corpo: { erro: 'sem' } } });
    const base = f.getMockImplementation()!;
    const consultaM1 = (c: unknown) => String(c).endsWith('/api/consulta/militares/m1');
    const ficha = (lotacao: string) => ({ id: 'm1', postoGrad: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: null, matricula: '990001-1', lotacao, quadro: null, podeAbrirFichaCompleta: false });
    let leituras = 0;
    f.mockImplementation(async (c, i) => {
      if (!consultaM1(c)) return base(c, i);
      leituras++;
      // a segunda leitura demora: se a ficha mostrar algo antes dela, é o dado velho
      if (leituras > 1) await new Promise((r) => setTimeout(r, 400));
      return new Response(JSON.stringify(ficha(leituras === 1 ? 'LOTACAO-ANTIGA' : 'LOTACAO-NOVA')), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const router = abrir('/peculio/pesquisar');
    await selecionarTodos();
    await userEvent.click(screen.getByRole('link', { name: /ANDRADE/ }));
    expect(await screen.findByText('LOTACAO-ANTIGA')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('link', { name: 'Voltar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/pesquisar'));
    const p = await abrirPainel();
    await userEvent.click(p.getByRole('checkbox', { name: 'Voluntário JES' }));
    await userEvent.click(p.getByRole('button', { name: 'Continuar' }));
    await userEvent.selectOptions(await p.findByLabelText('Voluntário JES'), 'sim');
    await userEvent.click(p.getByRole('button', { name: 'Ver a prévia' }));
    await userEvent.click(await p.findByRole('button', { name: 'Aplicar a 2 militares' }));
    await p.findByText('2 militares alterados');
    await userEvent.click(p.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // a seleção acabou; abre o militar de novo pela busca
    await userEvent.click(await screen.findByRole('link', { name: /ANDRADE/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m1'));
    expect(screen.queryByText('LOTACAO-ANTIGA')).toBeNull();
    expect(await screen.findByText('LOTACAO-NOVA')).toBeInTheDocument();
  });
});

describe('a pesquisa e a seleção sobrevivem a abrir uma ficha (6.51, item a)', () => {
  it('a seleção, a busca e o que foi montado voltam quando a pessoa abre um militar e volta', async () => {
    api({ 'GET /api/militares/m1': { status: 403, corpo: { erro: 'sem' } }, 'GET /api/consulta/militares/m1': { status: 200, corpo: { id: 'm1', postoGrad: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: null, matricula: '990001-1', lotacao: '1ª SB', quadro: null, podeAbrirFichaCompleta: false } } });
    const router = abrir('/peculio/pesquisar');
    await selecionarTodos();
    await userEvent.click(screen.getByRole('link', { name: /ANDRADE/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m1'));
    await userEvent.click(await screen.findByRole('link', { name: 'Voltar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/pesquisar'));
    expect(await screen.findByRole('heading', { name: 'Selecionados (2)' })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Militares encontrados' })).toBeInTheDocument();
  });

  it('a seleção some ao sair do módulo Pecúlio', async () => {
    api();
    const router = abrir('/peculio/pesquisar');
    await selecionarTodos();
    await router.navigate({ to: '/' });
    await router.navigate({ to: '/peculio/pesquisar' });
    await screen.findByLabelText('Nome, nome de guerra ou matrícula');
    expect(screen.queryByRole('heading', { name: /^Selecionados/ })).toBeNull();
  });

  it('uma unidade marcada sem "e as de baixo" não ganha as de baixo ao voltar da ficha (item b)', async () => {
    const f = api({ 'GET /api/consulta/unidades': { status: 200, corpo: [{ id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: null }, { id: 'u-1sb', sigla: '1ª SB', nivel: 4, maeId: 'u-gb' }] } });
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: 'Pela árvore' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar 2º GB' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '2º GB: e as de baixo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    const link = screen.getAllByRole('link', { name: /ANDRADE/ })[0]!;
    expect(link.getAttribute('href')).not.toContain('unidade=');
    expect(corpos(f, '/militares/buscar')).toEqual([{ unidades: [{ id: 'u-gb', comAsDeBaixo: false }] }]);
  });
});
