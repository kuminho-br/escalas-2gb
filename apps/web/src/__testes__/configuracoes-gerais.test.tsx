import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.26: as configurações gerais saem do módulo de escalas para um painel aberto pela tela inicial; as de escala ficam no módulo. Dados fictícios.
const GB = { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento' };
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const AUXILIAR = EU_EXEMPLO;
const GESTOR = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, ...EU_EXEMPLO.unidades] };
const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }], unidades: [{ id: 'raiz', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao' }, GB, ...EU_EXEMPLO.unidades] };
const NO = { id: 'u-gb', sigla: '2º GB', nome: '2º Grupamento', tipo: { codigo: 'grupamento', nome: 'Grupamento', ordem: 3 }, desde: '2026-01-01', ate: null, filhas: [], podeEditar: true, podeReorganizar: false, ligados: { unidades: 0, militaresHoje: 0, historico: [] } };

function api(eu: typeof EU_EXEMPLO, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/estrutura': { status: 200, corpo: NO },
    'GET /api/tipos-de-unidade': { status: 200, corpo: [] },
    'GET /api/postos': { status: 200, corpo: [{ id: 'p1', sigla: 'SD', nome: 'Soldado', ordem: 1 }] },
    'GET /api/funcoes-do-militar': { status: 200, corpo: [{ id: 'f1', nome: 'Chefe de seção', ativo: true }] },
    'GET /api/situacoes-do-militar': { status: 200, corpo: [{ id: 's1', nome: 'Ativa', podeSerEscalado: true, ativo: true }] },
    'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [{ id: 't1', nome: 'Férias', ativo: true }] },
    'GET /api/quadros': { status: 200, corpo: [] },
    'GET /api/visao/borda': { status: 200, corpo: [] },
    ...extra,
  });
}
const abas = async () => (await screen.findAllByRole('tab')).map((t) => t.textContent);

afterEach(() => localStorage.clear());

describe('a tela inicial e o painel geral (6.26)', () => {
  it('o cartão "Configurações" aparece para todos, inclusive para o militar comum, e leva ao painel', async () => {
    for (const eu of [COMUM, AUXILIAR, GESTOR, ADMIN]) {
      api(eu);
      abrir('/');
      expect(await screen.findByRole('link', { name: /Configurações/ }), JSON.stringify(eu.papeis)).toHaveAttribute('href', '/configuracoes');
      cleanup();
    }
  });

  it('o militar comum vê só "Minhas preferências", e a animação de entrada (sempre, a cada 12 h, nunca) grava como na 6.14', async () => {
    api(COMUM);
    abrir('/configuracoes');
    expect(screen.queryByRole('tab')).toBeNull();
    const grupo = within(await screen.findByRole('radiogroup', { name: 'Animação de entrada' }));
    expect(grupo.getByRole('radio', { name: 'Uma vez a cada 12 horas' })).toBeChecked();
    expect(screen.getByText('Vale para este navegador.')).toBeInTheDocument();
    await userEvent.click(grupo.getByRole('radio', { name: 'Nunca' }));
    expect(localStorage.getItem('escalas2gb.login-animacao-quando')).toBe('nunca');
    await userEvent.click(grupo.getByRole('radio', { name: 'Em toda entrada' }));
    expect(localStorage.getItem('escalas2gb.login-animacao-quando')).toBe('sempre');
  });

  it('revisão final: o endereço de uma seção que a pessoa não vê abre as preferências, e não uma tela em branco', async () => {
    api(COMUM);
    abrir('/configuracoes?aba=postos');
    expect(await screen.findByRole('radiogroup', { name: 'Animação de entrada' })).toBeInTheDocument();
    cleanup();
    api(AUXILIAR);
    abrir('/configuracoes?aba=quem-ve-o-que');
    expect(await screen.findByRole('radiogroup', { name: 'Animação de entrada' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Minhas preferências' })).toHaveAttribute('aria-selected', 'true');
  });

  it('com menos movimento, o aviso aparece nas preferências', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    api(COMUM);
    abrir('/configuracoes');
    expect(await screen.findByText('Seu aparelho pede menos movimento, então a animação não toca.')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('o auxiliar vê as preferências e os catálogos só para leitura', async () => {
    api(AUXILIAR);
    abrir('/configuracoes');
    expect(await abas()).toEqual(['Minhas preferências', 'Postos e graduações', 'Funções do militar', 'Situações do militar', 'Tipos de afastamento']);
    await userEvent.click(screen.getByRole('tab', { name: 'Postos e graduações' }));
    expect(await screen.findByRole('list', { name: 'Postos e graduações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Corrigir/ })).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Funções do militar' }));
    expect(await screen.findByText('Chefe de seção')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renomear' })).toBeNull();
    expect(screen.getByText(/Só o administrador altera/)).toBeInTheDocument();
  });

  it('o gestor vê as mesmas seções do auxiliar; os catálogos continuam só para leitura, e a Estrutura não está mais aqui', async () => {
    api(GESTOR);
    abrir('/configuracoes');
    expect(await abas()).toEqual(['Minhas preferências', 'Postos e graduações', 'Funções do militar', 'Situações do militar', 'Tipos de afastamento']);
    expect(screen.queryByRole('tab', { name: 'Estrutura' })).toBeNull();
  });

  it('o administrador vê também Quem vê o quê, e edita os catálogos', async () => {
    api(ADMIN);
    abrir('/configuracoes');
    expect(await abas()).toEqual(['Minhas preferências', 'Postos e graduações', 'Funções do militar', 'Situações do militar', 'Tipos de afastamento', 'Quem vê o quê']);
    await userEvent.click(screen.getByRole('tab', { name: 'Postos e graduações' }));
    expect(await screen.findByRole('button', { name: 'Corrigir SD' })).toBeInTheDocument();
  });

  it('o menu é vertical, com a seção escolhida marcada; no celular a lista de opções fica no alto e muda a seção', async () => {
    api(ADMIN);
    abrir('/configuracoes');
    const menu = await screen.findByRole('tablist', { name: 'Seção das configurações' });
    expect(menu).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('tab', { name: 'Minhas preferências' })).toHaveAttribute('aria-selected', 'true');
    // no celular o menu some e a lista de opções aparece (as classes decidem; os dois existem na página)
    expect(menu.className).toMatch(/\bhidden\b/);
    const lista = screen.getByRole('combobox', { name: 'Seção das configurações' });
    expect(lista.parentElement!.className).toMatch(/md:hidden/);
    expect(within(lista).getAllByRole('option').map((o) => o.textContent)).toEqual(['Minhas preferências', 'Postos e graduações', 'Funções do militar', 'Situações do militar', 'Tipos de afastamento', 'Quem vê o quê']);
    await userEvent.selectOptions(lista, 'funcoes');
    expect(await screen.findByText('Chefe de seção')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Funções do militar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('com uma seção só (o militar comum), não há menu nem lista de opções', async () => {
    api(COMUM);
    abrir('/configuracoes');
    await screen.findByRole('radiogroup', { name: 'Animação de entrada' });
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('a Minha ficha não tem mais a preferência da animação', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: COMUM },
      'GET /api/eu/ficha': { status: 200, corpo: { postoGrad: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: null, matricula: '990001-1', telefone: null, email: null, sexo: null, nascimento: null, cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, comportamento: null, comportamentoBoletim: null, situacao: null, motorista: false, cnh: [], cnhPorHierarquia: [], voluntarioJes: false, funcao: null, abonoPermanencia: false } },
    });
    abrir('/minha-ficha');
    await screen.findByRole('heading', { level: 1, name: 'Minha ficha' });
    expect(screen.queryByRole('radiogroup', { name: 'Animação de entrada' })).toBeNull();
  });
});

describe('as configurações da escala ficam no módulo de escalas (6.26)', () => {
  const PARAMS = '/api/unidades/u-1sb/parametros';
  const escala = (eu: typeof EU_EXEMPLO) => api(eu, { [`GET ${PARAMS}`]: { status: 200, corpo: [] }, 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] }, 'GET /api/unidades/u-1sb/meta-padrao': { status: 200, corpo: [] } });

  it('o trilho de escalas tem "Configurações da escala", e a tela tem as quatro abas', async () => {
    escala(AUXILIAR);
    abrir('/grade');
    const trilho = await screen.findByRole('navigation', { name: 'Navegação principal' });
    await userEvent.click(await within(trilho).findByRole('link', { name: 'Configurações da escala' }));
    expect(await abas()).toEqual(['Regras do processo', 'Voluntariado', 'Modelos de guarnição', 'Meta de ativação']);
    expect(screen.getByRole('tablist', { name: 'Seção das configurações da escala' })).toHaveAttribute('aria-orientation', 'vertical');
    expect(await screen.findByRole('heading', { level: 1, name: 'Configurações da escala' })).toBeInTheDocument();
    // o item do trilho não é mais "Configurações" (esse é o cartão da tela inicial)
    expect(within(trilho).queryByRole('link', { name: /^Configurações$/ })).toBeNull();
  });

  it('as permissões de hoje continuam: o auxiliar não muda regra; o gestor muda', async () => {
    escala(AUXILIAR);
    abrir('/configuracoes-da-escala');
    await screen.findByRole('tab', { name: 'Regras do processo' });
    expect(screen.queryByRole('button', { name: 'Importar planilha' })).toBeNull();
    cleanup();
    escala({ ...AUXILIAR, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] });
    abrir('/configuracoes-da-escala');
    await screen.findByRole('tab', { name: 'Regras do processo' });
    expect(await screen.findByRole('button', { name: /Importar/ })).toBeInTheDocument();
  });

  it('o endereço antigo de cada aba leva ao lugar novo, com a mesma aba', async () => {
    for (const aba of ['regras', 'voluntariado', 'modelos', 'meta']) {
      escala(AUXILIAR);
      const router = abrir(`/configuracoes?aba=${aba}`);
      await waitFor(() => expect(router.state.location.pathname).toBe('/configuracoes-da-escala'));
      expect(router.state.location.search).toMatchObject({ aba });
      cleanup();
    }
  });

  it('uma unidade só de consulta não abre as configurações da escala (volta à Grade geral)', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: { ...COMUM, unidadesSoConsulta: EU_EXEMPLO.unidades } },
      'GET /api/unidades/u-1sb/grade/2026-11': { status: 200, corpo: { dias: [] } },
    });
    const router = abrir('/configuracoes-da-escala');
    await waitFor(() => expect(router.state.location.pathname).toBe('/grade'));
  });
});
