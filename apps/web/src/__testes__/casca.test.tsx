import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navegador, pedir, saida } from '@/api/cliente';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';
import type { EuDaApi } from '@/api/eu';

async function clicarSair() {
  await userEvent.click(await screen.findByRole('button', { name: /SD ANDRADE/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
}

describe('sair', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    saida.marcar(false);
  });

  it('sair com sucesso vai para entrar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': { status: 200, corpo: { success: true } } });
    const router = abrir('/');
    await clicarSair();
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('sair sem conexao avisa e continua na tela', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': 'rede' });
    const router = abrir('/');
    await clicarSair();
    expect(await screen.findByText('Não foi possível sair. Confira a conexão e tente de novo.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  // [foco 2] o pedido que ainda estava no ar quando a pessoa saiu volta 401: o "Sair" já leva para entrar, e não é uma sessão que terminou
  it('depois de "Sair", um pedido que volta 401 não leva para entrar com o aviso de sessão terminada', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      '/api/auth/sign-out': { status: 200, corpo: { success: true } },
      'GET /api/qualquer': { status: 401, corpo: { erro: 'Sessão inválida.' } },
    });
    const router = abrir('/');
    await clicarSair();
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(ir).not.toHaveBeenCalled();
  });

  it('se o "Sair" falha, a sessão continua valendo: um 401 depois disso é sessão que terminou, com o aviso', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': 'rede', 'GET /api/qualquer': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    abrir('/');
    await clicarSair();
    await screen.findByText('Não foi possível sair. Confira a conexão e tente de novo.');
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith(expect.stringContaining('sessao=terminou'));
  });
});

describe('sessão que terminou no meio do uso', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('uma consulta com 401 leva para entrar, com o aviso e o caminho de volta', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/militares?busca=x');
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/militares': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    abrir('/militares');
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fmilitares%3Fbusca%3Dx'));
  });

  it('uma gravação (PATCH) com 401 também leva para entrar, e o erro de sempre continua (Review Focus 1)', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/militares/m1');
    simularApi({ 'PATCH /api/militares/m1': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    await expect(pedir('PATCH', '/api/militares/m1', { nomeGuerra: 'X' })).rejects.toMatchObject({ status: 401, message: 'Sessão inválida.' });
    expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fmilitares%2Fm1');
  });

  it('quem nunca entrou (/api/eu com 401) vai para entrar sem o aviso (Review Focus 2)', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(ir).not.toHaveBeenCalled();
  });

  it('já na tela de entrar, um 401 não manda de novo para entrar', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/entrar');
    simularApi({ 'GET /api/qualquer': { status: 401, corpo: { erro: 'Sem sessão.' } } });
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).not.toHaveBeenCalled();
  });
});

describe('casca', () => {
  it('sem sessao vai para entrar', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('casca mostra o militar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    expect(await screen.findByText('SD ANDRADE')).toBeInTheDocument();
    const caminho = screen.getByRole('navigation', { name: 'Unidade' });
    expect(within(caminho).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(within(caminho).getAllByRole('listitem').at(-1)).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('img', { name: 'Brasão do Corpo de Bombeiros Militar de Pernambuco' })).toHaveAttribute('src', '/brasao-cbmpe.png');
    expect(screen.getByRole('link', { name: 'Grade geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Estrutura')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Grade geral', level: 1 })).toBeInTheDocument();
  });

  it('o militar comum em /militares vai para o início com o aviso, sem ver nada da lista (Review Focus 1)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    abrir('/militares');
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    expect(await screen.findByText('SD ANDRADE')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
    expect(screen.queryByText('Militares')).toBeNull();
    expect(screen.queryByText('Configurações da escala')).toBeNull();
  });

  it('o militar comum na Grade geral também volta ao início', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    const router = abrir('/grade');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('o endereço antigo / com ?mes= (favorito da Grade geral) leva à Grade em /grade com o mesmo mês (Review Focus 2)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    const router = abrir('/?mes=2026-10&equipe=Alfa');
    await waitFor(() => expect(router.state.location.pathname).toBe('/grade'));
    expect(router.state.location.search).toMatchObject({ mes: '2026-10', equipes: ['Alfa'] });
  });

  it('o início e a Minha ficha não têm trilho', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD ANDRADE');
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeNull();
  });

  it('dentro do Pecúlio, o trilho tem o Pecúlio e a Consulta de militares, e a ficha aberta por ele continua nesse trilho (Review Focus 4)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/militares/m1?de=peculio');
    await screen.findByText('SD ANDRADE');
    const menu = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(menu).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Pecúlio', 'Consulta de militares']);
    expect(within(menu).queryByText('Militares')).toBeNull();
  });

  it('banco desatualizado mostra a mensagem do servidor', async () => {
    const MSG = 'O banco de dados está desatualizado. Peça ao administrador para aplicar as migrações pendentes.';
    simularApi({ '/api/eu': { status: 503, corpo: { erro: MSG } } });
    abrir('/');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
  });
});

describe('trilho', () => {
  const NOMES = ['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Voluntariado', 'Cotas', 'Militares', 'Turnos', 'Escalas', 'Feriados', 'Configurações da escala', 'Histórico', 'Ajuda'];
  const menu = () => screen.getByRole('navigation', { name: 'Navegação principal' });

  it('no computador o menu é um trilho de 84 px', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    expect(menu().parentElement?.className).toContain('md:grid-cols-[84px_1fr]');
    expect(menu().className).toContain('md:w-[84px]');
  });

  it('cada item do trilho mantém o nome', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] } } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    for (const nome of NOMES) expect(within(menu()).getByText(nome)).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Militares' })).toHaveAttribute('href', '/militares');
    expect(within(menu()).getByRole('link', { name: 'Escala do mês' })).toHaveAttribute('href', '/escala-do-mes');
    expect(within(menu()).getByRole('link', { name: 'Efetivo por dia' })).toHaveAttribute('href', '/efetivo-por-dia');
    // a Estrutura saiu do trilho: é um módulo próprio, na tela inicial
    expect(within(menu()).queryByText('Estrutura')).toBeNull();
  });

  it('o menu do celular abre e fecha', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    expect(menu().className).toContain('-translate-x-full');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(menu().className).toContain('translate-x-0');
    expect(menu().className).not.toContain('-translate-x-full');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(menu().className).toContain('-translate-x-full');
  });

  it('abrir o menu do celular leva o foco ao primeiro item', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    // o foco vai para o primeiro item por um efeito: espera o efeito rodar
    await waitFor(() => expect(within(menu()).getByRole('link', { name: 'Grade geral' })).toHaveFocus());
  });

  it('Esc fecha o menu do celular e devolve o foco ao botão que o abriu', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menu' });
    await userEvent.click(abrirMenu);
    expect(menu().className).not.toContain('-translate-x-full');
    await userEvent.keyboard('{Escape}');
    expect(menu().className).toContain('-translate-x-full');
    expect(abrirMenu).toHaveFocus();
  });

  it('o botão "Fechar menu" também devolve o foco, e clicar fora continua fechando', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menu' });
    await userEvent.click(abrirMenu);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(menu().className).toContain('-translate-x-full');
    expect(abrirMenu).toHaveFocus();
    // clicar fora (no fundo escurecido)
    await userEvent.click(abrirMenu);
    const fundo = document.querySelector<HTMLElement>('.fixed.inset-0[aria-hidden]')!;
    await userEvent.click(fundo);
    expect(menu().className).toContain('-translate-x-full');
  });

  it('no celular o caminho mostra a seção atual', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await screen.findByText('SD ANDRADE');
    expect(document.querySelector('[data-caminho-curto]')).toHaveTextContent('1ª SB');
  });
});

describe('revisão 3: falhas ao abrir o sistema', () => {
  it('endereço que não existe mostra a página em português, com o caminho de volta', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/nao-existe');
    expect(await screen.findByText('Esta página não existe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Not Found')).toBeNull();
  });

  it('erro ao carregar o sistema mostra o texto em português e "Tentar de novo"', async () => {
    simularApi({ '/api/eu': { status: 500, corpo: { erro: 'Servidor fora do ar.' } } });
    abrir('/');
    expect(await screen.findByText('Não foi possível abrir o sistema.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it('sem conexão: diz para conferir a internet, e o foco vai para o título', async () => {
    simularApi({ '/api/eu': 'rede' });
    abrir('/');
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Não foi possível abrir o sistema.' });
    expect(screen.getByText('Sem conexão com o sistema. Confira a internet e tente de novo.')).toBeInTheDocument();
    expect(screen.queryByText(/O sistema encontrou um erro/)).toBeNull();
    // o foco vai para o título por um efeito de montagem: espera o efeito rodar
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('erro do servidor: diz que o sistema errou e para tentar em alguns minutos, e o foco vai para o título', async () => {
    simularApi({ '/api/eu': { status: 500, corpo: {} } });
    abrir('/');
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Não foi possível abrir o sistema.' });
    expect(screen.getByText('O sistema encontrou um erro. Tente de novo em alguns minutos.')).toBeInTheDocument();
    expect(screen.queryByText(/Sem conexão/)).toBeNull();
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('o que o servidor disse (503, banco desatualizado) continua aparecendo no lugar do conselho genérico', async () => {
    simularApi({ '/api/eu': { status: 503, corpo: { erro: 'O sistema está sendo atualizado. Tente de novo em alguns minutos.' } } });
    abrir('/');
    await screen.findByRole('heading', { level: 1, name: 'Não foi possível abrir o sistema.' });
    expect(screen.getByText('O sistema está sendo atualizado. Tente de novo em alguns minutos.')).toBeInTheDocument();
    expect(screen.queryByText(/O sistema encontrou um erro/)).toBeNull();
  });
});

describe('unidade de trabalho (fase 6)', () => {
  const unidade = (id: string, sigla: string, nivel: number) => ({ id, sigla, nivel, caminho: ['CBMPE', 'DGO', 'DInter/1', ...(nivel === 3 ? [] : ['2º GB']), sigla].slice(0, nivel + 1), tipo: nivel === 3 ? 'grupamento' : 'secao', maeId: null as string | null });
  const GB = { id: 'u-gb', sigla: '2º GB', nivel: 3, caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], tipo: 'grupamento', maeId: null };
  const SB1 = { ...EU_EXEMPLO.unidades[0]!, maeId: 'u-gb' };
  const SB2 = { ...unidade('u-2sb', '2ª SB', 4), caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], maeId: 'u-gb' };
  const GESTOR: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1, SB2] };

  afterEach(() => localStorage.clear());

  it('6.45: com mais de uma unidade, o seletor do topo é a árvore, que abre nó a nó, com "Abrir tudo"; a unidade atual vem marcada', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-gb/militares': { status: 200, corpo: [] } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    const arvore = await screen.findByRole('tree', { name: 'Unidade de trabalho' });
    const itens = within(arvore).getAllByRole('treeitem');
    expect(itens.map((i) => i.getAttribute('aria-label'))).toEqual(['2º GB', '1ª SB, em 2º GB', '2ª SB, em 2º GB']);
    expect(itens.map((i) => i.getAttribute('aria-level'))).toEqual(['1', '2', '2']);
    expect(itens[0]).toHaveAttribute('aria-selected', 'true');
    // nó a nó: fechar o grupamento esconde as seções; "Abrir tudo" mostra todas de novo
    await userEvent.click(within(arvore).getByRole('button', { name: 'Fechar 2º GB' }));
    expect(within(arvore).getAllByRole('treeitem')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tudo' }));
    expect(within(arvore).getAllByRole('treeitem')).toHaveLength(3);
  });

  it('6.45: a unidade de cima que a pessoa não alcança entra como passagem, apagada, e dá lugar às dela (com a árvore da corporação)', async () => {
    const arvoreInteira = [
      { id: 'u-cbmpe', sigla: 'CBMPE', nivel: 0, maeId: null }, { id: 'u-gb', sigla: '2º GB', nivel: 1, maeId: 'u-cbmpe' },
      { id: 'u-1sb', sigla: '1ª SB', nivel: 2, maeId: 'u-gb' }, { id: 'u-2sb', sigla: '2ª SB', nivel: 2, maeId: 'u-gb' }, { id: 'u-3sb', sigla: '3ª SB', nivel: 2, maeId: 'u-gb' },
    ];
    const duasSecoes: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }, { papel: 'escalante', unidadeId: 'u-2sb', unidadeSigla: '2ª SB' }], unidades: [SB1, SB2] };
    simularApi({ '/api/eu': { status: 200, corpo: duasSecoes }, 'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [] }, 'GET /api/consulta/unidades': { status: 200, corpo: arvoreInteira } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    const arvore = await screen.findByRole('tree', { name: 'Unidade de trabalho' });
    await waitFor(() => expect(within(arvore).getAllByRole('treeitem').map((i) => i.getAttribute('aria-label'))).toEqual(['CBMPE', '2º GB, em CBMPE', '1ª SB, em 2º GB', '2ª SB, em 2º GB']));
    expect(within(arvore).getByRole('treeitem', { name: '2º GB, em CBMPE' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('escolher outra unidade guarda e leva para a lista da tela', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      'GET /api/unidades/u-gb/militares': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [] },
      'GET /api/militares/abc': { status: 404 },
    });
    const router = abrir('/militares/abc');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    await userEvent.click(await screen.findByRole('treeitem', { name: /^1ª SB/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares'));
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-1sb');
    expect(await screen.findByRole('button', { name: /Unidade de trabalho: CBMPE \/ DGO \/ DInter\/1 \/ 2º GB \/ 1ª SB/ })).toBeInTheDocument();
  });

  it('com alteração pendente, trocar de unidade pergunta antes e, se a pessoa desiste, nada muda', async () => {
    const ficha = {
      id: 'm1', matricula: '990001-1', posto: 'SD', quadro: { id: 'q-qbmg', sigla: 'QBMG' }, nomeGuerra: 'ANDRADE', equipe: null, jornada: 'adm', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
      podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' }, postoGradId: 'p', nomeCompleto: 'João', sexo: null, nascimento: null, cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, situacaoDoMilitar: null, telefone: '', email: null, comportamento: null,
      comportamentoBoletim: null, antiguidade: 1, antiguidadeRepetidaCom: [], funcao: null, funcaoMilitarId: null, abonoPermanencia: false, noQuadroDeMotoristas: false, cnh: [], cnhPorHierarquia: [], rastreio: [], afastamentos: [],
    };
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      'GET /api/militares/m1': { status: 200, corpo: ficha },
      'GET /api/militares/m1/acesso': { status: 200, corpo: { situacao: 'sem-acesso', email: null, senhaProvisoriaAte: null, papeis: [], podeGerarSenha: false, papeisQuePodeDar: [], unidadesParaPapel: [] } },
      'GET /api/postos': { status: 200, corpo: [] },
      'GET /api/unidades/u-gb/equipes': { status: 200, corpo: [] },
      'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [] },
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = abrir('/militares/m1');
    await userEvent.type(await screen.findByLabelText('Telefone'), '(81) 9');
    await userEvent.click(screen.getByRole('button', { name: /Unidade de trabalho/ }));
    await userEvent.click(await screen.findByRole('treeitem', { name: /^1ª SB/ }));
    expect(confirmar).toHaveBeenCalled();
    expect(localStorage.getItem('unidade-de-trabalho')).toBeNull();
    expect(router.state.location.pathname).toBe('/militares/m1');
    expect(screen.getByRole('button', { name: /Unidade de trabalho: CBMPE \/ DGO \/ DInter\/1 \/ 2º GB$/ })).toBeInTheDocument();
    confirmar.mockRestore();
  });

  it('com uma unidade só (o auxiliar de uma seção), não há seletor', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByRole('button', { name: /SD ANDRADE/ });
    expect(screen.queryByRole('button', { name: /Unidade de trabalho/ })).toBeNull();
  });

  it('o militar comum vê o caminho da lotação sem seletor', async () => {
    const comum: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [SB2], lotacao: SB2 };
    simularApi({ '/api/eu': { status: 200, corpo: comum } });
    abrir('/');
    const nav = await screen.findByRole('navigation', { name: 'Unidade' });
    expect(nav).toHaveTextContent('2ª SB');
    expect(screen.queryByRole('button', { name: /Unidade de trabalho/ })).toBeNull();
  });

  it('sem unidade, mostra a orientação e Sair', async () => {
    const sem: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [], lotacao: null };
    const router = (simularApi({ '/api/eu': { status: 200, corpo: sem }, '/api/auth/sign-out': { status: 200, corpo: { success: true } } }), abrir('/'));
    expect(await screen.findByText('Sua lotação não está cadastrada. Procure o auxiliar administrativo da sua seção.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('a Escala do mês com o 2º GB escolhido, sem escalas, diz "Crie uma em Escalas" como em qualquer unidade (6.25)', async () => {
    localStorage.setItem('unidade-de-trabalho', 'u-gb');
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-gb/escalas': { status: 200, corpo: [] } });
    abrir('/escala-do-mes');
    expect(await screen.findByRole('heading', { name: 'Nenhuma escala ativa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para Escalas' })).toBeInTheDocument();
  });
});
