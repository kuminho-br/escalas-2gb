import type { UnidadeDaConsulta, UnidadeDeTrabalho } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { guardarUnidade, guardarUnidadeDeConsulta, lerUnidadeDeConsulta, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// A pergunta "há alterações pendentes?" é a do site (`podeDescartar`): aqui a resposta é a do teste.
const pendencia = vi.hoisted(() => ({ pode: true }));
vi.mock('@/componentes/AlteracoesPendentes', async (original) => ({ ...(await original<typeof import('@/componentes/AlteracoesPendentes')>()), podeDescartar: () => pendencia.pode }));

// A unidade em degraus (6.61, Task 2). Hierarquia fictícia: o caminho CBMPE / DGO / DInter/1 / 2º GB / 1ª SB é o do sistema; as vizinhas são inventadas.
const U = (id: string, sigla: string, mae: string | null, tipo: string, caminho: string[]): UnidadeDeTrabalho => ({ id, sigla, nivel: caminho.length - 1, tipo, caminho, maeId: mae });
const CAM = ['CBMPE', 'DGO', 'DInter/1'];
const GB = U('u-gb', '2º GB', 'u-dinter', 'grupamento', [...CAM, '2º GB']);
const SB1 = U('u-1sb', '1ª SB', 'u-gb', 'secao', [...GB.caminho, '1ª SB']);
const SB2 = U('u-2sb', '2ª SB', 'u-gb', 'secao', [...GB.caminho, '2ª SB']);
const GB4 = U('u-gb4', '4º GB', 'u-dinter', 'grupamento', [...CAM, '4º GB']);
const SB4A = U('u-4sb-a', '1ª SB', 'u-gb4', 'secao', [...GB4.caminho, '1ª SB']);
const SB4B = U('u-4sb-b', '2ª SB', 'u-gb4', 'secao', [...GB4.caminho, '2ª SB']);
const c = (id: string, sigla: string, mae: string | null, nivel: number, tipoNome: string, nome?: string): UnidadeDaConsulta => ({ id, sigla, nivel, maeId: mae, tipoNome, ...(nome ? { nome } : {}) });
/** A árvore inteira da corporação (a lista que o site pede para dar lugar às unidades de cima, as passagens). */
const CORPORACAO: UnidadeDaConsulta[] = [
  c('u-cbmpe', 'CBMPE', null, 0, 'Corporação'), c('u-dgo', 'DGO', 'u-cbmpe', 1, 'Diretoria'), c('u-dinter', 'DInter/1', 'u-dgo', 2, 'Diretoria regional'),
  c('u-gb', '2º GB', 'u-dinter', 3, 'Grupamento', 'Segundo Grupamento'), c('u-1sb', '1ª SB', 'u-gb', 4, 'Seção', 'Caruaru'), c('u-2sb', '2ª SB', 'u-gb', 4, 'Seção'),
  c('u-gb4', '4º GB', 'u-dinter', 3, 'Grupamento'), c('u-4sb-a', '1ª SB', 'u-gb4', 4, 'Seção'), c('u-4sb-b', '2ª SB', 'u-gb4', 4, 'Seção'),
];
const GESTOR: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1, SB2] };
/** Auxiliar de duas seções de grupamentos diferentes: o 2º GB e o 4º GB são só passagem. */
const DUAS_SECOES: EuDaApi = {
  ...EU_EXEMPLO, papeis: [{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }, { papel: 'escalante', unidadeId: 'u-4sb-a', unidadeSigla: '1ª SB' }], unidades: [SB1, SB4A],
};
/** O gestor do 2º GB que também consulta o 4º GB e as seções dele. */
const COM_CONSULTA: EuDaApi = { ...GESTOR, unidadesSoConsulta: [GB4, SB4A, SB4B] };
const LISTAS = Object.fromEntries(['u-gb', 'u-1sb', 'u-2sb', 'u-gb4', 'u-4sb-a', 'u-4sb-b'].map((id) => [`GET /api/unidades/${id}/militares`, { status: 200, corpo: [] }]));
const api = (eu: EuDaApi, extra: Parameters<typeof simularApi>[0] = {}) => simularApi({ '/api/eu': { status: 200, corpo: eu }, 'GET /api/consulta/unidades': { status: 200, corpo: CORPORACAO }, ...LISTAS, ...extra });

afterEach(() => {
  pendencia.pode = true;
  localStorage.clear();
  guardarUnidadeDeConsulta(null);
  vi.restoreAllMocks();
});

const nav = async () => screen.findByRole('navigation', { name: 'Unidade de trabalho' });
/** Os degraus da tela: o texto de cada um, em ordem (o botão ou o texto fixo). */
const itensDosDegraus = (n: HTMLElement) => within(n).getAllByRole('listitem').filter((li) => !li.hasAttribute('data-todas-as-unidades'));
const degraus = (n: HTMLElement) => itensDosDegraus(n).map((li) => li.textContent!.replace(/^›/, '').replace(/Só consulta/g, '').trim());
const botao = (n: HTMLElement, nome: string | RegExp) => within(n).getByRole('button', { name: nome });
const opcoes = () => within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent!.replace(/\s+/g, ' ').trim());

describe('os degraus', () => {
  it('Review Focus 3: gestor do 2º GB: os degraus de cima são só texto (uma opção só), e só o das seções é botão', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']));
    const botoes = within(n).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    // 6.73: o 2º GB, de uma opção só mas com acesso, também é botão; os de cima (sem acesso) seguem texto
    expect(botoes.filter((b) => !b!.startsWith('Unidade de trabalho:') && b !== 'Ver todas as unidades')).toEqual(['2º GB', '1ª SB']);
    // o último degrau é o atual
    expect(itensDosDegraus(n).at(-1)!.querySelector('[aria-current="location"]')).not.toBeNull();
  });

  it('o degrau abre só as unidades de dentro do degrau de cima, com a atual marcada, e escolher uma irmã guarda, leva à lista da tela e avisa', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    const router = abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '1ª SB'));
    expect(screen.getByRole('listbox', { name: 'Unidades dentro de 2º GB' })).toBeInTheDocument();
    expect(opcoes()).toEqual(['1ª SBCaruaru', '2ª SB']);
    expect(screen.getByRole('option', { name: /^1ª SB/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('option', { name: /^2ª SB/ }));
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-2sb'));
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-2sb');
    expect(router.state.location.pathname).toBe('/militares');
    expect(await screen.findByRole('status')).toHaveTextContent('Unidade de trabalho: CBMPE / DGO / DInter/1 / 2º GB / 2ª SB');
    await waitFor(() => expect(degraus(n).at(-1)).toBe('2ª SB'));
  });

  it('o próximo nível vem tracejado com o nome do tipo das unidades de baixo, e escolher uma delas é a mesma escolha de hoje', async () => {
    guardarUnidade('u-gb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    const proximo = await within(n).findByRole('button', { name: 'Seção' });
    expect(proximo.className).toContain('border-dashed');
    await userEvent.click(proximo);
    expect(opcoes()).toEqual(['1ª SBCaruaru', '2ª SB']);
    await userEvent.click(screen.getByRole('option', { name: /^1ª SB/ }));
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-1sb'));
  });

  it('escolher uma unidade que tem unidades abaixo escolhe a unidade e abre o próximo nível sozinho; Esc deixa a pessoa na unidade escolhida', async () => {
    guardarUnidade('u-1sb');
    api(COM_CONSULTA);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '2º GB'));
    expect(opcoes()).toEqual(['2º GBSegundo Grupamento', '4º GBSó consulta']);
    await userEvent.click(screen.getByRole('option', { name: /^4º GB/ }));
    // o 4º GB é só consulta: vira a unidade de consulta, e o próximo nível (as seções dele) abre sozinho
    expect(lerUnidadeDeConsulta()).toBe('u-gb4');
    expect(await screen.findByRole('listbox', { name: 'Unidades dentro de 4º GB' })).toBeInTheDocument();
    expect(opcoes()).toEqual(['1ª SBSó consulta', '2ª SBSó consulta']);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    // o 4º GB é o último degrau, e as seções dele vêm como o próximo nível, tracejado
    await waitFor(() => expect(degraus(n).slice(-2)).toEqual(['4º GB', 'Seção']));
    expect(lerUnidadeDeConsulta()).toBe('u-gb4');
  });

  it('"Só consulta" leva a etiqueta na lista, e escolher a unidade vale só nesta aba (não é guardada para a próxima entrada)', async () => {
    guardarUnidade('u-1sb');
    api(COM_CONSULTA);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '2º GB'));
    expect(within(screen.getByRole('option', { name: /^4º GB/ })).getByText('Só consulta')).toBeInTheDocument();
    expect(within(screen.getByRole('option', { name: /^2º GB/ })).queryByText('Só consulta')).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: /^4º GB/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^2ª SB/ }));
    expect(lerUnidadeDeConsulta()).toBe('u-4sb-b');
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
  });

  it('Review Focus 4: a passagem nunca vira a unidade de trabalho: parar nela mostra o próximo nível como obrigatório, e Esc volta à unidade de antes', async () => {
    guardarUnidade('u-1sb');
    api(DUAS_SECOES);
    const router = abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']));
    await userEvent.click(botao(n, '2º GB'));
    expect(opcoes()).toEqual(['2º GBSegundo Grupamento', '4º GB']);
    await userEvent.click(screen.getByRole('option', { name: /^4º GB/ }));
    // o 4º GB é passagem: nada se guarda, a unidade de trabalho continua a de antes, e a escolha da seção é obrigatória
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
    expect(await within(n).findByRole('button', { name: 'Escolha: seção' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Unidades dentro de 4º GB' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await waitFor(() => expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']));
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
    expect(router.state.location.pathname).toBe('/militares');
    expect(await screen.findByRole('status')).not.toHaveTextContent('4º GB');
  });

  it('Review Focus 2: com alteração pendente, escolher outra unidade pergunta antes, e desistir deixa a unidade e os degraus como estavam', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    // com alteração pendente, a pergunta é negada (a pessoa desiste)
    pendencia.pode = false;
    await userEvent.click(botao(n, '1ª SB'));
    await userEvent.click(screen.getByRole('option', { name: /^2ª SB/ }));
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(botao(n, '1ª SB')).toHaveAttribute('aria-expanded', 'false');
  });

  it('o teclado: as setas percorrem as unidades da lista, Esc fecha e o foco volta ao degrau; o degrau atual leva aria-current', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    const degrau = botao(n, '1ª SB');
    expect(degrau).toHaveAttribute('aria-current', 'location');
    expect(degrau).toHaveAttribute('aria-haspopup', 'listbox');
    await userEvent.click(degrau);
    await waitFor(() => expect(screen.getByRole('option', { name: /^1ª SB/ })).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /^2ª SB/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /^1ª SB/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: /^2ª SB/ })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(botao(n, '1ª SB')).toHaveFocus();
  });

  it('a lista rola por dentro no computador (muitas unidades não passam do fim da tela, com o cabeçalho parado)', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '1ª SB'));
    const lista = screen.getByRole('listbox');
    expect(lista.className).toContain('md:max-h-[min(26rem,calc(100dvh-5rem))]');
    expect(lista.className).toContain('md:overflow-y-auto');
  });

  it('um clique fora fecha a lista, sem trocar de unidade', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '1ª SB'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
  });

  it('Review Focus 1: o administrador da raiz: o primeiro degrau que se abre mostra só as diretorias, e descer até uma seção leva no máximo cinco escolhas', async () => {
    const muitas: UnidadeDaConsulta[] = [c('u-cbmpe', 'CBMPE', null, 0, 'Corporação')];
    const unidades: UnidadeDeTrabalho[] = [U('u-cbmpe', 'CBMPE', null, 'corporacao', ['CBMPE'])];
    for (const d of ['DGO', 'DGP', 'DAL']) {
      muitas.push(c(`u-${d}`, d, 'u-cbmpe', 1, 'Diretoria'));
      unidades.push(U(`u-${d}`, d, 'u-cbmpe', 'diretoria_geral', ['CBMPE', d]));
      for (const r of ['1', '2']) {
        const idR = `u-${d}-${r}`;
        muitas.push(c(idR, `DInter/${r}`, `u-${d}`, 2, 'Diretoria regional'));
        unidades.push(U(idR, `DInter/${r}`, `u-${d}`, 'diretoria_integrada', ['CBMPE', d, `DInter/${r}`]));
        for (const g of ['1', '2', '3']) {
          const idG = `${idR}-${g}`;
          muitas.push(c(idG, `${g}º GB`, idR, 3, 'Grupamento'));
          unidades.push(U(idG, `${g}º GB`, idR, 'grupamento', ['CBMPE', d, `DInter/${r}`, `${g}º GB`]));
          for (const s of ['1', '2']) {
            muitas.push(c(`${idG}-${s}`, `${s}ª SB`, idG, 4, 'Seção'));
            unidades.push(U(`${idG}-${s}`, `${s}ª SB`, idG, 'secao', ['CBMPE', d, `DInter/${r}`, `${g}º GB`, `${s}ª SB`]));
          }
        }
      }
    }
    guardarUnidade('u-DGO-1-1');
    const admin: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-cbmpe', unidadeSigla: 'CBMPE' }], unidades };
    api(admin, { 'GET /api/consulta/unidades': { status: 200, corpo: muitas } });
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n).at(-2)).toBe('1º GB'));
    // o degrau das diretorias: só as três diretorias, e não a árvore inteira
    await userEvent.click(botao(n, 'DGO'));
    expect(opcoes()).toEqual(['DGO', 'DGP', 'DAL'].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })));
    let escolhas = 0;
    await userEvent.click(screen.getByRole('option', { name: /^DGP/ }));
    escolhas++;
    // a unidade escolhida (DGP) tem unidades abaixo: o próximo nível abre sozinho, até uma seção
    for (const alvo of [/^DInter\/2/, /^3º GB/, /^2ª SB/]) {
      await userEvent.click(await screen.findByRole('option', { name: alvo }));
      escolhas++;
    }
    expect(escolhas).toBeLessThanOrEqual(5);
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-DGP-2-3-2'));
  });

  it('antes de a lista da corporação chegar, os níveis de cima continuam à vista (do caminho da unidade) e depois seguem iguais', async () => {
    guardarUnidade('u-1sb');
    let chegou!: () => void;
    const segura = new Promise<void>((r) => (chegou = r));
    api(GESTOR, { 'GET /api/consulta/unidades': { status: 200, corpo: CORPORACAO, espera: segura } });
    abrir('/militares');
    const n = await nav();
    // com a lista da corporação ainda no ar, só há a árvore da pessoa (2º GB e as seções): CBMPE, DGO e DInter/1 vêm do caminho da unidade, só para leitura
    await waitFor(() => expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']));
    expect(within(n).queryByRole('button', { name: 'CBMPE' })).toBeNull();
    // 6.73: o 2º GB (uma opção só, com acesso) também é botão
    expect(within(n).getAllByRole('button').filter((b) => b.hasAttribute('data-degrau')).map((b) => b.textContent)).toEqual(['2º GB', '1ª SB']);
    chegou();
    await waitFor(() => expect(itensDosDegraus(n).length).toBe(5));
    expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
  });
});

describe('o cabeçalho com uma unidade só', () => {
  it('o auxiliar de uma seção vê o caminho só para leitura, sem degraus', async () => {
    api(EU_EXEMPLO);
    abrir('/militares');
    const leitura = await screen.findByRole('navigation', { name: 'Unidade' });
    expect(within(leitura).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Unidade de trabalho' })).toBeNull();
  });
});

describe('o nível de uma opção só e a árvore inteira (6.73)', () => {
  it('o nível de uma opção só é botão quando a pessoa tem acesso a ele: clicar faz dele a unidade de trabalho e abre o nível de baixo; sem acesso, continua texto', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    for (const semAcesso of ['CBMPE', 'DGO', 'DInter/1']) expect(within(n).queryByRole('button', { name: semAcesso })).toBeNull();
    await userEvent.click(botao(n, '2º GB'));
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-gb'));
    expect(await screen.findByRole('status')).toHaveTextContent('Unidade de trabalho: CBMPE / DGO / DInter/1 / 2º GB');
    expect(screen.getByRole('listbox', { name: 'Unidades dentro de 2º GB' })).toBeInTheDocument();
  });

  it('com alteração pendente, a pessoa desiste e a unidade fica como estava', async () => {
    guardarUnidade('u-1sb');
    pendencia.pode = false;
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, '2º GB'));
    expect(lerUnidadeGuardada()).toBe('u-1sb');
  });

  it('"Ver todas as unidades" abre a árvore inteira, e escolher nela troca a unidade de trabalho', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    const router = abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, 'Ver todas as unidades'));
    const arvore = await screen.findByRole('tree', { name: 'Unidade de trabalho' });
    await userEvent.click(within(arvore).getByRole('treeitem', { name: /^2ª SB/ }));
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-2sb'));
    expect(router.state.location.pathname).toBe('/militares');
    await waitFor(() => expect(screen.queryByRole('tree')).toBeNull());
  });

  it('a árvore traz, num grupo à parte, as unidades só de consulta', async () => {
    guardarUnidade('u-1sb');
    api(COM_CONSULTA);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    await userEvent.click(botao(n, 'Ver todas as unidades'));
    expect(await screen.findByRole('tree', { name: 'Só consulta' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Unidade de trabalho' })).toBeInTheDocument();
  });

  it('no celular, o botão fica dentro do painel dos degraus (só aparece com o painel aberto)', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await waitFor(() => expect(degraus(n)).toHaveLength(5));
    const lista = within(n).getByRole('list');
    expect(lista).toContainElement(botao(n, 'Ver todas as unidades'));
    expect(lista.className).toContain('max-md:hidden');
    await userEvent.click(botao(n, /^Unidade de trabalho:/));
    expect(lista.className).not.toContain('max-md:hidden');
  });
});

describe('os degraus no celular (6.61, Task 3)', () => {
  // o jsdom não aplica as classes de largura: o que se confere é a estrutura que o CSS usa (o botão só do celular, o painel que abre e rola por dentro)
  const gatilho = (n: HTMLElement) => within(n).getByRole('button', { name: /^Unidade de trabalho:/ });
  const lista = (n: HTMLElement) => within(n).getByRole('list');

  it('fechado, o celular mostra só o botão da unidade atual (a sigla), e os degraus ficam escondidos', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    const botaoDaUnidade = gatilho(n);
    expect(botaoDaUnidade).toHaveAttribute('aria-label', 'Unidade de trabalho: CBMPE / DGO / DInter/1 / 2º GB / 1ª SB');
    expect(botaoDaUnidade).toHaveAttribute('aria-expanded', 'false');
    expect(botaoDaUnidade).toHaveTextContent('1ª SB');
    expect(botaoDaUnidade.className).toContain('md:hidden');
    expect(lista(n).className).toContain('max-md:hidden');
  });

  it('tocar na unidade abre os degraus num painel, um embaixo do outro, que rola por dentro (Review Focus 5)', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    expect(gatilho(n)).toHaveAttribute('aria-expanded', 'true');
    const painel = lista(n);
    expect(painel.className).not.toContain('max-md:hidden');
    for (const classe of ['max-md:absolute', 'max-md:flex-col', 'max-md:overflow-y-auto', 'max-md:max-h-[70dvh]']) expect(painel.className).toContain(classe);
    // os degraus de cima aparecem todos no painel (como texto), e o das seções continua sendo um botão
    expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    // o cabeçalho não passa da largura: a unidade é um botão que encolhe e a lista ocupa o painel
    expect(n.className).toContain('min-w-0');
    expect(gatilho(n).className).toContain('max-w-full');
  });

  it('no painel, tocar num degrau abre a lista embaixo dele, e escolher funciona como no computador', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    await userEvent.click(botao(n, '1ª SB'));
    expect(screen.getByRole('listbox').className).toContain('max-md:static');
    await userEvent.click(screen.getByRole('option', { name: /^2ª SB/ }));
    await waitFor(() => expect(lerUnidadeGuardada()).toBe('u-2sb'));
    // escolhida uma folha, o painel fecha
    await waitFor(() => expect(gatilho(n)).toHaveAttribute('aria-expanded', 'false'));
  });

  it('Esc (ou um toque fora) fecha o painel, e o foco volta ao botão da unidade', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    await userEvent.keyboard('{Escape}');
    expect(gatilho(n)).toHaveAttribute('aria-expanded', 'false');
    expect(gatilho(n)).toHaveFocus();
    await userEvent.click(gatilho(n));
    await userEvent.click(document.body);
    expect(gatilho(n)).toHaveAttribute('aria-expanded', 'false');
  });

  it('tocar de novo no botão fecha o painel', async () => {
    guardarUnidade('u-1sb');
    api(GESTOR);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    await userEvent.click(gatilho(n));
    expect(gatilho(n)).toHaveAttribute('aria-expanded', 'false');
  });

  it('o painel mostra a unidade só de consulta com a etiqueta, e a passagem continua obrigatória', async () => {
    guardarUnidade('u-1sb');
    api(DUAS_SECOES);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    await userEvent.click(botao(n, '2º GB'));
    await userEvent.click(screen.getByRole('option', { name: /^4º GB/ }));
    expect(await within(n).findByRole('button', { name: 'Escolha: seção' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']));
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
  });

  it('Review Focus 4 no celular: tocar de novo no botão com o painel aberto numa passagem fecha e volta à unidade de antes', async () => {
    guardarUnidade('u-1sb');
    api(DUAS_SECOES);
    abrir('/militares');
    const n = await nav();
    await userEvent.click(gatilho(n));
    await userEvent.click(botao(n, '2º GB'));
    await userEvent.click(screen.getByRole('option', { name: /^4º GB/ }));
    expect(await within(n).findByRole('button', { name: 'Escolha: seção' })).toBeInTheDocument();
    // fecha pelo botão da unidade: nada a meio caminho fica guardado
    await userEvent.click(gatilho(n));
    expect(gatilho(n)).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(gatilho(n));
    expect(degraus(n)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
  });
});
