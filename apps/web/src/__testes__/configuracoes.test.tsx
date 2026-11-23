import { mesPorExtenso, somarMeses, type Borda, type LinhaEscala, type LinhaGuarnicao, type Parametro, type Quadro, type VersaoDaMetaPadrao } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { hoje } from '@/lib/meses';
import { cleanup } from '@testing-library/react';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const PARAMS = '/api/unidades/u-1sb/parametros';
const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const parametro = (p: Partial<Parametro>): Parametro => ({
  chave: 'CARGA_MENSAL_HORAS', rotulo: 'Carga mensal (horas)', descricao: '', tipo: 'inteiro', valor: 160, vigencia: '',
  normaReferencia: null, origem: 'padrao', unidadeSigla: null, historico: [], ...p,
});

const LISTA = [
  parametro({}),
  parametro({ chave: 'SALDOS_ADM_POR_MILITAR', rotulo: 'Saldos por militar do Adm', valor: 5, vigencia: '2026-11', origem: 'herdada', unidadeSigla: '2º GB', normaReferencia: 'Portaria 12/2026' }),
];
const FLEXIBILIDADE = parametro({
  chave: 'FLEXIBILIDADE_VOLUNTARIADO_HORAS', rotulo: 'Flexibilidade do voluntariado (horas)', valor: 0,
  descricao: 'Horas que podem faltar no começo ou no fim do turno para o militar ainda contar como voluntário. Buraco no meio do turno não conta.',
});
const TIPOS = [{ id: 't1', nome: 'Férias', ativo: true }, { id: 't2', nome: 'Curso', ativo: false }];
const FUNCOES = [{ id: 'fun-chefe', nome: 'Chefe de seção', ativo: true }, { id: 'fun-antiga', nome: 'Função antiga', ativo: false }];

const ESCALAS = '/api/unidades/u-1sb/escalas';
const escalaDaLista = (e: Partial<LinhaEscala>): LinhaEscala => ({ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, ...e });
const ESCALAS_LISTA = [
  escalaDaLista({}),
  escalaDaLista({ id: 'e2', nome: 'CPRH Eleições', servicos: ['CPRH'] }),
  escalaDaLista({ id: 'e3', nome: 'Velha', ativa: false, servicos: [] }),
];

const GESTOR = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] };

function api(extra: Parameters<typeof simularApi>[0] = {}, eu = EU_EXEMPLO) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET ${PARAMS}`]: { status: 200, corpo: LISTA },
    'GET /api/sistema/tipos-afastamento': { status: 200, corpo: TIPOS },
    'GET /api/situacoes-do-militar': { status: 200, corpo: SITUACOES },
    'GET /api/funcoes-do-militar': { status: 200, corpo: FUNCOES },
    ...extra,
  });
}

describe('configurações no celular (N0.1, achado C1)', () => {
  it('no celular não há faixa que rola: o menu vira uma lista de opções no alto (6.26)', async () => {
    api();
    abrir('/configuracoes-da-escala');
    const menu = await screen.findByRole('tablist');
    // o menu vertical só existe do tamanho médio para cima; a faixa horizontal com rolagem acabou
    expect(menu.className).not.toMatch(/overflow-x/);
    expect(menu.className).toMatch(/\bhidden\b/);
    expect(screen.getByRole('combobox', { name: 'Seção das configurações da escala' }).parentElement!.className).toMatch(/md:hidden/);
  });

  it('cada tabela da tela fica dentro de um quadro que rola', async () => {
    api();
    abrir('/configuracoes-da-escala');
    await screen.findByRole('table');
    for (const t of screen.getAllByRole('table')) expect(t.parentElement!.className).toMatch(/\boverflow-x-auto\b/);
  });
});

describe('configurações', () => {
  it('mostra o valor e a origem herdada', async () => {
    api({}, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Saldos por militar do Adm')).closest('tr')!;
    expect(within(linha).getByText('5')).toBeInTheDocument();
    expect(within(linha).getByText('vem do 2º GB')).toBeInTheDocument();
    expect(within(linha).getByText('Portaria 12/2026')).toBeInTheDocument();
    const padrao = screen.getByText('Carga mensal (horas)').closest('tr')!;
    expect(within(padrao).getByText('padrão do sistema')).toBeInTheDocument();
  });

  it('mostra a flexibilidade do voluntariado e o gestor muda a partir de um mês, em horas', async () => {
    const f = api({ [`GET ${PARAMS}`]: { status: 200, corpo: [...LISTA, FLEXIBILIDADE] }, [`POST ${PARAMS}`]: { status: 201, corpo: {} } }, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Flexibilidade do voluntariado (horas)')).closest('tr')!;
    expect(within(linha).getByText(/Buraco no meio do turno não conta/)).toBeInTheDocument();
    expect(within(linha).getByText('padrão do sistema')).toBeInTheDocument();
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    await userEvent.clear(screen.getByLabelText('Novo valor'));
    await userEvent.type(screen.getByLabelText('Novo valor'), '1');
    const proximo = somarMeses(mesAtual(), 1);
    await userEvent.click(screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(proximo)}` }));
    expect(corpoEnviado(f, `POST ${PARAMS}`)).toMatchObject({ chave: 'FLEXIBILIDADE_VOLUNTARIADO_HORAS', valor: '1', vigencia: proximo });
  });

  it('mudar a partir de envia vigencia e norma', async () => {
    const f = api({ [`POST ${PARAMS}`]: { status: 201, corpo: {} } }, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Carga mensal (horas)')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    await userEvent.clear(screen.getByLabelText('Novo valor'));
    await userEvent.type(screen.getByLabelText('Novo valor'), '150');
    await userEvent.type(screen.getByLabelText('Norma de referência'), 'PCG 3/2026');
    const proximo = somarMeses(mesAtual(), 1);
    await userEvent.click(screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(proximo)}` }));
    expect(corpoEnviado(f, `POST ${PARAMS}`)).toEqual({ chave: 'CARGA_MENSAL_HORAS', valor: '150', vigencia: proximo, normaReferencia: 'PCG 3/2026' });
  });

  it('erro 409 aparece junto do formulário', async () => {
    api({ [`POST ${PARAMS}`]: { status: 409, corpo: { erro: 'Só dá para mudar a partir de novembro de 2026.' } } }, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Carga mensal (horas)')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    await userEvent.click(screen.getByRole('button', { name: /^Salvar a partir de/ }));
    expect(await screen.findByText('Só dá para mudar a partir de novembro de 2026.')).toBeInTheDocument();
  });

  it('Configurações da escala não tem a aba Atividades, só as quatro da escala', async () => {
    api();
    abrir('/configuracoes-da-escala');
    await screen.findByRole('tab', { name: 'Regras do processo' });
    expect(screen.queryByRole('tab', { name: 'Atividades' })).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Regras do processo', 'Voluntariado', 'Modelos de guarnição', 'Meta de ativação']);
  });

  it('o endereço antigo com ?aba=atividades abre a primeira aba', async () => {
    api();
    abrir('/configuracoes-da-escala?aba=atividades');
    expect(await screen.findByRole('tab', { name: 'Regras do processo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('escalante não vê os botões dos tipos', async () => {
    api();
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('tab', { name: 'Tipos de afastamento' }));
    expect(await screen.findByText('Férias')).toBeInTheDocument();
    expect(screen.getByText('desativado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incluir' })).toBeNull();
  });

  it('administrador inclui um tipo', async () => {
    const admin = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
    const f = api({ 'POST /api/sistema/tipos-afastamento': { status: 201, corpo: { id: 't3', nome: 'Luto', ativo: true } } }, admin);
    abrir('/configuracoes');
    await userEvent.click(await screen.findByRole('tab', { name: 'Tipos de afastamento' }));
    await userEvent.type(await screen.findByLabelText('Novo tipo de afastamento'), 'Luto');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    expect(corpoEnviado(f, 'POST /api/sistema/tipos-afastamento')).toEqual({ nome: 'Luto' });
  });
});

const SITUACOES = [{ id: 'sit-ativa', nome: 'Ativa', escalavel: true, ativo: true }, { id: 'sit-reserva', nome: 'Reserva', escalavel: false, ativo: true }];
describe('configurações: situações do militar', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
  const abrirAba = async () => userEvent.click(await screen.findByRole('tab', { name: 'Situações do militar' }));

  it('o administrador cria, liga e desliga "Pode ser escalado", renomeia e desativa', async () => {
    const f = api({
      'POST /api/situacoes-do-militar': { status: 201, corpo: { id: 'sit-nova', nome: 'Licença', escalavel: false, ativo: true } },
      'PATCH /api/situacoes-do-militar/sit-reserva': { status: 200, corpo: SITUACOES[1] },
    }, ADMIN);
    abrir('/configuracoes');
    await abrirAba();
    expect(await screen.findByText('Reserva')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nova situação do militar'), 'Licença');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pode ser escalado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/situacoes-do-militar')).toEqual({ nome: 'Licença', escalavel: false }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Reserva: pode ser escalado' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/situacoes-do-militar/sit-reserva')).toEqual({ escalavel: true }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Desativar' })[1]!);
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/situacoes-do-militar/sit-reserva')).toEqual({ ativo: false }));
  });

  it('quem não é administrador só lê a lista', async () => {
    api();
    abrir('/configuracoes');
    await abrirAba();
    expect(await screen.findByText('Reserva')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incluir' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Reserva: pode ser escalado' })).toBeDisabled();
  });
});

describe('configurações: funções do militar (6.15)', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
  const abrirAba = async () => userEvent.click(await screen.findByRole('tab', { name: 'Funções do militar' }));

  it('o administrador inclui, renomeia, desativa e reativa uma função', async () => {
    const f = api({
      'POST /api/funcoes-do-militar': { status: 201, corpo: { id: 'fun-nova', nome: 'Motorista de viatura', ativo: true } },
      'PATCH /api/funcoes-do-militar/fun-chefe': { status: 200, corpo: FUNCOES[0] },
      'PATCH /api/funcoes-do-militar/fun-antiga': { status: 200, corpo: FUNCOES[1] },
    }, ADMIN);
    abrir('/configuracoes');
    await abrirAba();
    expect(await screen.findByText('Chefe de seção')).toBeInTheDocument();
    expect(screen.getByText('desativada')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nova função do militar'), 'Motorista de viatura');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/funcoes-do-militar')).toEqual({ nome: 'Motorista de viatura' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Renomear' })[0]!);
    const campo = screen.getByLabelText('Novo nome de Chefe de seção');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Chefe da seção');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/funcoes-do-militar/fun-chefe')).toEqual({ nome: 'Chefe da seção' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/funcoes-do-militar/fun-chefe')).toEqual({ ativo: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Reativar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/funcoes-do-militar/fun-antiga')).toEqual({ ativo: true }));
  });

  it('nome repetido mostra a mensagem do servidor e a lista continua', async () => {
    api({ 'POST /api/funcoes-do-militar': { status: 409, corpo: { erro: 'Já existe uma função com esse nome.' } } }, ADMIN);
    abrir('/configuracoes');
    await abrirAba();
    await userEvent.type(await screen.findByLabelText('Nova função do militar'), 'Chefe de seção');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    expect(await screen.findByText('Já existe uma função com esse nome.')).toBeInTheDocument();
    expect(screen.getByText('Chefe de seção')).toBeInTheDocument();
  });

  it('quem não é administrador só lê a lista', async () => {
    api();
    abrir('/configuracoes');
    await abrirAba();
    expect(await screen.findByText('Chefe de seção')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Incluir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Renomear' })).toBeNull();
    expect(screen.getByText('Só o administrador altera.', { exact: false })).toBeInTheDocument();
  });
});

describe('configurações: postos e graduações (6.13)', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
  const POSTOS = [
    { id: 'p-sd', sigla: 'SD', nome: 'Soldado', ordem: 1 },
    { id: 'p-cb', sigla: 'CB', nome: 'Cabo', ordem: 2 },
    { id: 'p-3s', sigla: '3º SGT', nome: 'Terceiro-Sargento', ordem: 3 },
  ];
  const comPostos = (extra: Parameters<typeof simularApi>[0] = {}, eu: typeof EU_EXEMPLO = ADMIN) => api({ 'GET /api/postos': { status: 200, corpo: POSTOS }, ...extra }, eu);

  it('quem tem nível de acesso vê a lista, mas só o administrador corrige', async () => {
    comPostos({}, EU_EXEMPLO);
    abrir('/configuracoes?aba=postos');
    await screen.findByRole('list', { name: 'Postos e graduações' });
    expect(screen.queryByRole('button', { name: /Corrigir/ })).toBeNull();
    cleanup();
    comPostos();
    abrir('/configuracoes?aba=postos');
    expect(await screen.findByRole('button', { name: 'Corrigir SD' })).toBeInTheDocument();
  });

  it('lista os postos na ordem, do mais moderno para o mais antigo, como o cadastro', async () => {
    comPostos();
    abrir('/configuracoes?aba=postos');
    const lista = await screen.findByRole('list', { name: 'Postos e graduações' });
    expect(within(lista).getAllByRole('listitem').map((l) => l.querySelector('[data-sigla]')?.textContent)).toEqual(['SD', 'CB', '3º SGT']);
  });

  it('edita a sigla e o nome numa linha por vez, e grava', async () => {
    const f = comPostos({ 'PATCH /api/postos/p-3s': { status: 200, corpo: { ...POSTOS[2], sigla: '3º SGT' } } });
    abrir('/configuracoes?aba=postos');
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir 3º SGT' }));
    // com uma linha aberta, as outras não abrem
    expect(screen.queryByRole('button', { name: 'Corrigir SD' })).toBeNull();
    const sigla = screen.getByLabelText('Sigla');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, '3º SGT');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/postos/p-3s')).toEqual({ sigla: '3º SGT', nome: 'Terceiro-Sargento' }));
  });

  it('a sigla repetida mostra o erro no campo', async () => {
    comPostos({ 'PATCH /api/postos/p-cb': { status: 409, corpo: { erro: 'Já existe um posto com esta sigla.', campos: { sigla: 'Já existe um posto com esta sigla.' } } } });
    abrir('/configuracoes?aba=postos');
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir CB' }));
    const sigla = screen.getByLabelText('Sigla');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, 'SD');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Já existe um posto com esta sigla.')).toBeInTheDocument();
    expect(screen.getByLabelText('Sigla')).toHaveAccessibleDescription('Já existe um posto com esta sigla.');
  });
});

describe('configurações: papéis e campos', () => {
  const ADM_CUMPRE = parametro({ chave: 'ADM_CUMPRE_CARGA', rotulo: 'Adm cumpre a carga mensal', tipo: 'simnao', valor: false });
  const apiComSimNao = (eu = GESTOR, extra: Parameters<typeof simularApi>[0] = {}) =>
    api({ [`GET ${PARAMS}`]: { status: 200, corpo: [...LISTA, ADM_CUMPRE] }, ...extra }, eu);

  it('escalante não vê Mudar a partir de nem Importar', async () => {
    api();
    abrir('/configuracoes-da-escala');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.queryByRole('button', { name: 'Mudar a partir de…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
    expect(screen.getByText(/Só o gestor ou o administrador muda\./)).toBeInTheDocument();
  });

  it('gestor vê Mudar a partir de e Importar', async () => {
    api({}, GESTOR);
    abrir('/configuracoes-da-escala');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.getAllByRole('button', { name: 'Mudar a partir de…' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.queryByText(/Só o gestor ou o administrador muda\./)).toBeNull();
  });

  it('Sim ou Não se escolhe numa lista', async () => {
    const f = apiComSimNao(GESTOR, { [`POST ${PARAMS}`]: { status: 201, corpo: {} } });
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Adm cumpre a carga mensal')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    const campo = screen.getByLabelText('Novo valor');
    expect(campo.tagName).toBe('SELECT');
    expect(campo).toHaveValue('Não');
    expect(within(campo).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sim', 'Não']);
    await userEvent.selectOptions(campo, 'Sim');
    await userEvent.click(screen.getByRole('button', { name: /^Salvar a partir de/ }));
    expect(corpoEnviado(f, `POST ${PARAMS}`)).toMatchObject({ chave: 'ADM_CUMPRE_CARGA', valor: 'Sim' });
  });

  it('número se digita em campo numérico', async () => {
    api({}, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Carga mensal (horas)')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    const campo = screen.getByLabelText('Novo valor');
    expect(campo).toHaveAttribute('type', 'number');
    expect(campo).toHaveAttribute('step', '1');
  });

  it('decimal aceita casas depois da vírgula', async () => {
    api({ [`GET ${PARAMS}`]: { status: 200, corpo: [parametro({ chave: 'FATOR', rotulo: 'Fator', tipo: 'decimal', valor: 1.5 })] } }, GESTOR);
    abrir('/configuracoes-da-escala');
    const linha = (await screen.findByText('Fator')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    expect(screen.getByLabelText('Novo valor')).toHaveAttribute('step', 'any');
  });
});

describe('configurações: blocos do voluntariado', () => {
  const aba = async () => {
    abrir('/configuracoes-da-escala');
    await userEvent.click(await screen.findByRole('tab', { name: 'Voluntariado' }));
  };
  const interruptor = (nome: string) => screen.findByRole('checkbox', { name: `${nome}: entra nos blocos do voluntariado` });

  it('a aba lista as escalas ativas, cada uma com o interruptor ligado; a escala desativada não aparece', async () => {
    api({ [`GET ${ESCALAS}`]: { status: 200, corpo: ESCALAS_LISTA } }, GESTOR);
    await aba();
    expect(await interruptor('Ordinário')).toBeChecked();
    expect(await interruptor('CPRH Eleições')).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /Velha/ })).not.toBeInTheDocument();
  });

  it('o gestor desliga uma escala: manda o PATCH com montaBlocos falso e refaz a lista', async () => {
    const f = api({
      [`GET ${ESCALAS}`]: { status: 200, corpo: ESCALAS_LISTA },
      'PATCH /api/escalas/e2/blocos-do-voluntariado': { status: 200, corpo: { id: 'e2', montaBlocosVoluntariado: false } },
    }, GESTOR);
    await aba();
    await userEvent.click(await interruptor('CPRH Eleições'));
    await vi.waitFor(() => expect(corpoEnviado(f, 'PATCH /api/escalas/e2/blocos-do-voluntariado')).toEqual({ montaBlocos: false }));
    const buscasDaLista = () => f.mock.calls.filter(([e, init]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : e.url).endsWith(ESCALAS) && (init?.method ?? 'GET') === 'GET').length;
    await vi.waitFor(() => expect(buscasDaLista()).toBe(2));
  });

  it('o escalante vê os interruptores desabilitados e a frase de quem pode mudar', async () => {
    api({ [`GET ${ESCALAS}`]: { status: 200, corpo: ESCALAS_LISTA } });
    await aba();
    expect(await interruptor('Ordinário')).toBeDisabled();
    expect(screen.getByText(/Só o gestor ou o administrador muda/)).toBeInTheDocument();
  });

  it('erro da API aparece e o interruptor volta ao que estava', async () => {
    api({
      [`GET ${ESCALAS}`]: { status: 200, corpo: ESCALAS_LISTA },
      'PATCH /api/escalas/e1/blocos-do-voluntariado': { status: 403, corpo: { erro: 'Você não tem permissão nesta seção.' } },
    }, GESTOR);
    await aba();
    await userEvent.click(await interruptor('Ordinário'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão nesta seção.');
    expect(await interruptor('Ordinário')).toBeChecked();
  });
});

describe('meta de ativação', () => {
  const META = '/api/unidades/u-1sb/meta-padrao';
  const modelo = (id: string, nome: string, ativa = true): LinhaGuarnicao => ({ id, nome, viatura: null, prioridade: null, ativa, minimo: 1, maximo: 1, aPartirDe: null });
  const MODELOS = [modelo('g1', 'ABT'), modelo('g2', 'ACO'), modelo('g9', 'Antigo', false)];
  // uma versão em vigor desde 2020 e outra que só começa em 2099
  const VERSOES: VersaoDaMetaPadrao[] = [
    { desde: '2099-01-01', guarnicoes: [{ guarnicaoId: 'g2', nome: 'ACO' }, { guarnicaoId: 'g1', nome: 'ABT' }] },
    { desde: '2020-01-01', guarnicoes: [{ guarnicaoId: 'g1', nome: 'ABT' }] },
  ];
  const abaMeta = (extra: Parameters<typeof simularApi>[0] = {}, eu = EU_EXEMPLO) => {
    const f = api({ [`GET ${META}`]: { status: 200, corpo: VERSOES }, 'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: MODELOS }, ...extra }, eu);
    abrir('/configuracoes-da-escala?aba=meta');
    return f;
  };

  it('lista a meta em vigor e as futuras, cada uma com a ordem de ativação', async () => {
    abaMeta();
    const futura = (await screen.findByText('A partir de 01/01/2099: 1º ACO, 2º ABT')).closest('li')!;
    const vigente = screen.getByText('A partir de 01/01/2020: 1º ABT').closest('li')!;
    expect(within(vigente).getByText('em vigor')).toBeInTheDocument();
    expect(within(futura).queryByText('em vigor')).toBeNull();
  });

  it('o gestor grava a partir de hoje, e o editor começa pela meta em vigor', async () => {
    const f = abaMeta({ [`PUT ${META}`]: { status: 200, corpo: VERSOES } }, GESTOR);
    expect(await screen.findByRole('checkbox', { name: 'ABT' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ACO' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Antigo' })).toBeNull();
    expect(screen.getByLabelText('Vale a partir de')).toHaveValue(hoje());
    await userEvent.click(screen.getByRole('checkbox', { name: 'ACO' }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir ACO' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await vi.waitFor(() => expect(corpoEnviado(f, `PUT ${META}`)).toEqual({ desde: hoje(), guarnicoes: ['g2', 'g1'] }));
  });

  it('a data não aceita dia que já passou', async () => {
    abaMeta({}, GESTOR);
    expect(await screen.findByLabelText('Vale a partir de')).toHaveAttribute('min', hoje());
  });

  it('o escalante só vê a lista, sem o editor nem "Salvar"', async () => {
    abaMeta();
    await screen.findByText('A partir de 01/01/2099: 1º ACO, 2º ABT');
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'ABT' })).toBeNull();
    expect(screen.queryByLabelText('Vale a partir de')).toBeNull();
  });

  it('sem nenhuma meta gravada, diz isso', async () => {
    abaMeta({ [`GET ${META}`]: { status: 200, corpo: [] } });
    expect(await screen.findByText('Nenhuma meta padrão gravada ainda.')).toBeInTheDocument();
  });
});

describe('configurações: quem vê o quê (6.11)', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
  const CHEFE = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor_lateral' as const, unidadeId: 'u-divop', unidadeSigla: 'DivOp' }] };
  // a borda inicial da spec: [todos, oficial, quinto nível]
  const MARCAS: [Borda[number]['bloco'], boolean, boolean, boolean][] = [
    ['identificacao', true, true, true], ['contato', false, true, true], ['situacao', false, true, true], ['afastamentos', false, true, true],
    ['dados_da_escala', false, true, true], ['comportamento', false, false, true], ['escala_em_montagem', false, false, true],
  ];
  const BORDA: Borda = MARCAS.map(([bloco, todos, oficial, gestorLateral]) => ({ bloco, todos, oficial, gestorLateral }));
  const quadro = (id: string, sigla: string, nome: string, oficial: boolean): Quadro => ({ id, sigla, nome, postoGradIds: [], oficial });
  const QUADROS = [quadro('q-qoc', 'QOC', 'Quadro de Oficiais Combatentes', true), quadro('q-qoa', 'QOA', 'Quadro de Oficiais da Administração', true), quadro('q-qbmg', 'QBMG', 'Qualificação Bombeiro Militar Geral', false)];
  const comBorda = (extra: Parameters<typeof simularApi>[0] = {}, eu: typeof EU_EXEMPLO = ADMIN) =>
    api({ 'GET /api/visao': { status: 200, corpo: BORDA }, 'GET /api/quadros': { status: 200, corpo: QUADROS }, ...extra }, eu);
  const marca = (bloco: string, camada: string) => screen.getByRole('checkbox', { name: `${bloco}: ${camada}` }) as HTMLInputElement;
  const NOMES = ['Identificação', 'Contato', 'Situação', 'Afastamentos', 'Dados da escala', 'Comportamento', 'Escala em montagem'];

  it('a aba só aparece para o administrador', async () => {
    for (const [eu, aparece] of [[EU_EXEMPLO, false], [GESTOR, false], [CHEFE, false], [ADMIN, true]] as const) {
      comBorda({}, eu);
      abrir('/configuracoes');
      await screen.findByRole('tab', { name: 'Minhas preferências' });
      expect(screen.queryAllByRole('tab', { name: 'Quem vê o quê' }), String(eu.papeis[0]?.papel)).toHaveLength(aparece ? 1 : 0);
      cleanup();
    }
  });

  it('mostra os sete blocos e as três camadas, com as marcas da borda', async () => {
    comBorda();
    abrir('/configuracoes?aba=quem-ve-o-que');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Bloco', 'Todostodo militar com conta', 'Oficialquem está num quadro de oficiais', 'Coordenadornas unidades irmãs',
    ]);
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas.map((l) => within(l).getAllByRole('rowheader')[0]!.querySelector('span')?.textContent)).toEqual(NOMES);
    for (const [i, [, todos, oficial, chefe]] of MARCAS.entries()) {
      expect(marca(NOMES[i]!, 'Todos').checked, `${NOMES[i]}/Todos`).toBe(todos);
      expect(marca(NOMES[i]!, 'Oficial').checked, `${NOMES[i]}/Oficial`).toBe(oficial);
      expect(marca(NOMES[i]!, 'Coordenador').checked, `${NOMES[i]}/Chefe`).toBe(chefe);
    }
    // o que cada bloco tem fica escrito sob o nome
    expect(within(tabela).getByText('Telefone e e-mail')).toBeInTheDocument();
    // a tabela fica dentro de um quadro que rola (no celular)
    expect(tabela.parentElement!.className).toMatch(/\boverflow-x-auto\b/);
  });

  it('a identificação de "Todos" fica marcada e travada; os outros "Todos" se mexem', async () => {
    comBorda();
    abrir('/configuracoes?aba=quem-ve-o-que');
    await screen.findByRole('table');
    expect(marca('Identificação', 'Todos')).toBeChecked();
    expect(marca('Identificação', 'Todos')).toBeDisabled();
    for (const nome of NOMES.slice(1)) expect(marca(nome, 'Todos'), nome).toBeEnabled();
    expect(screen.getByText(/A identificação de “Todos” fica sempre marcada/)).toBeInTheDocument();
  });

  it('marcar "Todos" marca e trava as outras duas; desmarcar solta, e as marcas ficam', async () => {
    comBorda();
    abrir('/configuracoes?aba=quem-ve-o-que');
    await screen.findByRole('table');
    expect(marca('Comportamento', 'Oficial')).not.toBeChecked();
    await userEvent.click(marca('Comportamento', 'Todos'));
    for (const camada of ['Todos', 'Oficial', 'Coordenador']) expect(marca('Comportamento', camada), camada).toBeChecked();
    expect(marca('Comportamento', 'Oficial')).toBeDisabled();
    expect(marca('Comportamento', 'Coordenador')).toBeDisabled();
    // as outras linhas não mudam
    expect(marca('Contato', 'Todos')).not.toBeChecked();
    expect(marca('Contato', 'Oficial')).toBeEnabled();
    await userEvent.click(marca('Comportamento', 'Todos'));
    expect(marca('Comportamento', 'Oficial')).toBeEnabled();
    expect(marca('Comportamento', 'Oficial')).toBeChecked();
    await userEvent.click(marca('Comportamento', 'Oficial'));
    expect(marca('Comportamento', 'Oficial')).not.toBeChecked();
  });

  it('"Salvar" só liga depois de mudar algo, manda a borda inteira e diz que salvou', async () => {
    const f = comBorda({ 'PUT /api/visao': { status: 200, corpo: BORDA } });
    abrir('/configuracoes?aba=quem-ve-o-que');
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await userEvent.click(marca('Contato', 'Todos'));
    await userEvent.click(marca('Afastamentos', 'Oficial'));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/visao')).toEqual(BORDA.map((l) => (l.bloco === 'contato' ? { ...l, todos: true, oficial: true, gestorLateral: true } : l.bloco === 'afastamentos' ? { ...l, oficial: false } : l))));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('a confirmação "Alterações salvas." continua na tela depois que a borda nova volta do servidor (a tabela recomeça com ela)', async () => {
    const nova = BORDA.map((l) => (l.bloco === 'contato' ? { ...l, todos: true, oficial: true, gestorLateral: true } : l));
    const doServidor = { status: 200, corpo: BORDA as unknown };
    const f = comBorda({ 'GET /api/visao': doServidor, 'PUT /api/visao': { status: 200, corpo: nova } });
    abrir('/configuracoes?aba=quem-ve-o-que');
    await screen.findByRole('table');
    await userEvent.click(marca('Contato', 'Todos'));
    // daqui em diante o servidor devolve a borda gravada, diferente da que a tabela tinha
    doServidor.corpo = nova;
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(f, 'GET /api/visao')).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled());
    expect(screen.getByText('Alterações salvas.')).toBeInTheDocument();
    expect(marca('Contato', 'Oficial')).toBeDisabled();
  });

  it('o erro da API aparece, e a tabela fica como a pessoa deixou', async () => {
    comBorda({ 'PUT /api/visao': { status: 403, corpo: { erro: 'Só o administrador do sistema ajusta quem vê o quê.' } } });
    abrir('/configuracoes?aba=quem-ve-o-que');
    await screen.findByRole('table');
    await userEvent.click(marca('Situação', 'Oficial'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Só o administrador do sistema ajusta quem vê o quê.')).toBeInTheDocument();
    expect(marca('Situação', 'Oficial')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('lista os quadros com a marca "de oficiais", e marcar grava na hora', async () => {
    const f = comBorda({ 'PATCH /api/quadros/q-qbmg': { status: 200, corpo: { ...QUADROS[2], oficial: true } } });
    abrir('/configuracoes?aba=quem-ve-o-que');
    const lista = await screen.findByRole('list', { name: 'Quadros' });
    expect(within(lista).getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent)).toEqual(['QOC', 'QOA', 'QBMG']);
    expect(screen.getByRole('checkbox', { name: 'QOC: de oficiais' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'QOA: de oficiais' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'QBMG: de oficiais' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'QBMG: de oficiais' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/quadros/q-qbmg')).toEqual({ oficial: true }));
  });

  it('o erro ao marcar um quadro aparece', async () => {
    comBorda({ 'PATCH /api/quadros/q-qoc': { status: 403, corpo: { erro: 'Só o administrador do sistema ajusta quem vê o quê.' } } });
    abrir('/configuracoes?aba=quem-ve-o-que');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'QOC: de oficiais' }));
    expect(await screen.findByText('Só o administrador do sistema ajusta quem vê o quê.')).toBeInTheDocument();
  });
});
