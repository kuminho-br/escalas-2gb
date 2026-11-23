import { mesPorExtenso, somarMeses, type LinhaEscala, type LinhaGuarnicao, type NoDaEstrutura, type Parametro, type VersaoDaMetaPadrao } from 'contratos';
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
    ...extra,
  });
}

describe('configurações no celular (N0.1, achado C1)', () => {
  it('a faixa das abas rola dentro dela mesma, sem quebrar o texto das abas', async () => {
    api();
    abrir('/configuracoes');
    const faixa = await screen.findByRole('tablist');
    expect(faixa.className).toMatch(/\boverflow-x-auto\b/);
    expect(faixa.className).toMatch(/\bmax-w-full\b/);
    // o traço de cada aba passa um pouco da faixa: sem isto, a faixa ganha uma rolagem vertical (achado da revisão final)
    expect(faixa.className).toMatch(/\boverflow-y-hidden\b/);
    for (const aba of screen.getAllByRole('tab')) expect(aba.className).toMatch(/\bwhitespace-nowrap\b/);
  });

  it('cada tabela da tela fica dentro de um quadro que rola', async () => {
    api();
    abrir('/configuracoes');
    await screen.findByRole('table');
    for (const t of screen.getAllByRole('table')) expect(t.parentElement!.className).toMatch(/\boverflow-x-auto\b/);
  });
});

describe('configurações', () => {
  it('mostra o valor e a origem herdada', async () => {
    api({}, GESTOR);
    abrir('/configuracoes');
    const linha = (await screen.findByText('Saldos por militar do Adm')).closest('tr')!;
    expect(within(linha).getByText('5')).toBeInTheDocument();
    expect(within(linha).getByText('vem do 2º GB')).toBeInTheDocument();
    expect(within(linha).getByText('Portaria 12/2026')).toBeInTheDocument();
    const padrao = screen.getByText('Carga mensal (horas)').closest('tr')!;
    expect(within(padrao).getByText('padrão do sistema')).toBeInTheDocument();
  });

  it('mostra a flexibilidade do voluntariado e o gestor muda a partir de um mês, em horas', async () => {
    const f = api({ [`GET ${PARAMS}`]: { status: 200, corpo: [...LISTA, FLEXIBILIDADE] }, [`POST ${PARAMS}`]: { status: 201, corpo: {} } }, GESTOR);
    abrir('/configuracoes');
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
    abrir('/configuracoes');
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
    abrir('/configuracoes');
    const linha = (await screen.findByText('Carga mensal (horas)')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    await userEvent.click(screen.getByRole('button', { name: /^Salvar a partir de/ }));
    expect(await screen.findByText('Só dá para mudar a partir de novembro de 2026.')).toBeInTheDocument();
  });

  it('Configurações não tem a aba Atividades', async () => {
    api();
    abrir('/configuracoes');
    await screen.findByRole('tab', { name: 'Tipos de afastamento' });
    expect(screen.queryByRole('tab', { name: 'Atividades' })).toBeNull();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Regras do processo', 'Voluntariado', 'Modelos de guarnição', 'Meta de ativação', 'Tipos de afastamento', 'Situações do militar']);
  });

  it('o endereço antigo com ?aba=atividades abre a primeira aba', async () => {
    api();
    abrir('/configuracoes?aba=atividades');
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

describe('configurações: postos e graduações (6.13)', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }] };
  const POSTOS = [
    { id: 'p-sd', sigla: 'SD BM', nome: 'Soldado', ordem: 1 },
    { id: 'p-cb', sigla: 'CB BM', nome: 'Cabo', ordem: 2 },
    { id: 'p-3s', sigla: '3º SGT BM', nome: 'Terceiro-Sargento', ordem: 3 },
  ];
  const comPostos = (extra: Parameters<typeof simularApi>[0] = {}, eu: typeof EU_EXEMPLO = ADMIN) => api({ 'GET /api/postos': { status: 200, corpo: POSTOS }, ...extra }, eu);

  it('a aba só aparece para o administrador', async () => {
    comPostos({}, EU_EXEMPLO);
    abrir('/configuracoes');
    await screen.findByRole('tab', { name: 'Regras do processo' });
    expect(screen.queryByRole('tab', { name: 'Postos e graduações' })).toBeNull();
  });

  it('lista os postos na ordem, do mais moderno para o mais antigo, como o cadastro', async () => {
    comPostos();
    abrir('/configuracoes?aba=postos');
    const lista = await screen.findByRole('list', { name: 'Postos e graduações' });
    expect(within(lista).getAllByRole('listitem').map((l) => l.querySelector('[data-sigla]')?.textContent)).toEqual(['SD BM', 'CB BM', '3º SGT BM']);
  });

  it('edita a sigla e o nome numa linha por vez, e grava', async () => {
    const f = comPostos({ 'PATCH /api/postos/p-3s': { status: 200, corpo: { ...POSTOS[2], sigla: '3º SGT' } } });
    abrir('/configuracoes?aba=postos');
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir 3º SGT BM' }));
    // com uma linha aberta, as outras não abrem
    expect(screen.queryByRole('button', { name: 'Corrigir SD BM' })).toBeNull();
    const sigla = screen.getByLabelText('Sigla');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, '3º SGT');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/postos/p-3s')).toEqual({ sigla: '3º SGT', nome: 'Terceiro-Sargento' }));
  });

  it('a sigla repetida mostra o erro no campo', async () => {
    comPostos({ 'PATCH /api/postos/p-cb': { status: 409, corpo: { erro: 'Já existe um posto com esta sigla.', campos: { sigla: 'Já existe um posto com esta sigla.' } } } });
    abrir('/configuracoes?aba=postos');
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir CB BM' }));
    const sigla = screen.getByLabelText('Sigla');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, 'SD BM');
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
    abrir('/configuracoes');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.queryByRole('button', { name: 'Mudar a partir de…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
    expect(screen.getByText(/Só o gestor ou o administrador muda\./)).toBeInTheDocument();
  });

  it('gestor vê Mudar a partir de e Importar', async () => {
    api({}, GESTOR);
    abrir('/configuracoes');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.getAllByRole('button', { name: 'Mudar a partir de…' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.queryByText(/Só o gestor ou o administrador muda\./)).toBeNull();
  });

  it('Sim ou Não se escolhe numa lista', async () => {
    const f = apiComSimNao(GESTOR, { [`POST ${PARAMS}`]: { status: 201, corpo: {} } });
    abrir('/configuracoes');
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
    abrir('/configuracoes');
    const linha = (await screen.findByText('Carga mensal (horas)')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    const campo = screen.getByLabelText('Novo valor');
    expect(campo).toHaveAttribute('type', 'number');
    expect(campo).toHaveAttribute('step', '1');
  });

  it('decimal aceita casas depois da vírgula', async () => {
    api({ [`GET ${PARAMS}`]: { status: 200, corpo: [parametro({ chave: 'FATOR', rotulo: 'Fator', tipo: 'decimal', valor: 1.5 })] } }, GESTOR);
    abrir('/configuracoes');
    const linha = (await screen.findByText('Fator')).closest('tr')!;
    await userEvent.click(within(linha).getByRole('button', { name: 'Mudar a partir de…' }));
    expect(screen.getByLabelText('Novo valor')).toHaveAttribute('step', 'any');
  });
});

describe('configurações: blocos do voluntariado', () => {
  const aba = async () => {
    abrir('/configuracoes');
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
    abrir('/configuracoes?aba=meta');
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

describe('configurações: estrutura do grupamento (6.10)', () => {
  const GB = { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento' };
  const DIVOP = { id: 'u-divop', sigla: 'DivOp', caminho: [...GB.caminho, 'DivOp'], nivel: 4, tipo: 'divisao' };
  const SB1 = EU_EXEMPLO.unidades[0]!;
  const GESTOR_GB = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1] };
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }], unidades: [GB, SB1] };
  const CHEFE = { ...EU_EXEMPLO, papeis: [{ papel: 'chefe_divisao' as const, unidadeId: 'u-divop', unidadeSigla: 'DivOp' }], unidades: [DIVOP, SB1] };
  const no = (id: string, sigla: string, nome: string, tipo: NoDaEstrutura['tipo'], filhas: NoDaEstrutura[] = []): NoDaEstrutura => ({ id, sigla, nome, tipo, filhas });
  const ARVORE = no('u-gb', '2º GB', '2º Grupamento de Bombeiros', 'grupamento', [
    no('u-1sb', '1ª SB', '1ª Seção de Bombeiros', 'secao'),
    no('u-da', 'DA', 'Divisão Administrativa', 'divisao', [no('u-3sb', '3ª SB', '3ª Seção de Bombeiros', 'secao')]),
    no('u-divop', 'DivOp', 'Divisão Operacional', 'divisao'),
  ]);
  const COM_CADASTROS = no('u-gb', '2º GB', '2º Grupamento de Bombeiros', 'grupamento', [
    no('u-1sb', '1ª SB', '1ª Seção de Bombeiros', 'secao'),
    { ...no('u-da', 'DA', 'Divisão Administrativa', 'divisao', [no('u-3sb', '3ª SB', '3ª Seção de Bombeiros', 'secao')]), cadastrosProprios: 2 },
    { ...no('u-divop', 'DivOp', 'Divisão Operacional', 'divisao'), cadastrosProprios: 0 },
  ]);
  const ESTRUTURA = 'GET /api/unidades/u-gb/estrutura';
  const comEstrutura = (extra: Parameters<typeof simularApi>[0] = {}, eu: typeof EU_EXEMPLO = GESTOR_GB) => api({ [ESTRUTURA]: { status: 200, corpo: ARVORE }, ...extra }, eu);
  const AVISO = 'Mover a seção muda na hora quem tem acesso a ela.';

  it('a aba só aparece para o gestor do grupamento e o administrador', async () => {
    for (const [eu, aparece] of [[EU_EXEMPLO, false], [GESTOR, false], [CHEFE, false], [GESTOR_GB, true], [ADMIN, true]] as const) {
      comEstrutura({}, eu);
      abrir('/configuracoes');
      await screen.findByRole('tab', { name: 'Regras do processo' });
      expect(screen.queryAllByRole('tab', { name: 'Estrutura' })).toHaveLength(aparece ? 1 : 0);
      cleanup();
    }
  });

  it('mostra o grupamento, as divisões com as seções de dentro, e as seções sem divisão', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    const arvore = await screen.findByRole('list', { name: 'Estrutura de 2º GB' });
    expect(within(arvore).getAllByRole('listitem').map((l) => l.querySelector('[data-sigla]')?.textContent)).toEqual(['DA', '3ª SB', 'DivOp', '1ª SB']);
    expect(within(arvore).getByText('Divisão Administrativa')).toBeInTheDocument();
    // cada seção tem o seletor "Divisão", com a divisão em que ela está
    expect(screen.getByLabelText('Divisão de 3ª SB')).toHaveValue('u-da');
    expect(screen.getByLabelText('Divisão de 1ª SB')).toHaveValue('');
    expect(within(screen.getByLabelText('Divisão de 1ª SB')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sem divisão', 'DA', 'DivOp']);
  });

  it('cria uma divisão', async () => {
    const f = comEstrutura({ 'POST /api/unidades/u-gb/divisoes': { status: 201, corpo: no('u-dens', 'DEns', 'Divisão de Ensino', 'divisao') } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova divisão' }));
    await userEvent.type(screen.getByLabelText('Sigla'), 'DEns');
    await userEvent.type(screen.getByLabelText('Nome'), 'Divisão de Ensino');
    await userEvent.click(screen.getByRole('button', { name: 'Criar divisão' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-gb/divisoes')).toEqual({ sigla: 'DEns', nome: 'Divisão de Ensino' }));
    // o formulário fecha e a árvore é buscada de novo
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Criar divisão' })).toBeNull());
    expect(chamadasA(f, ESTRUTURA)).toBeGreaterThan(1);
  });

  it('renomeia uma divisão, e a sigla repetida mostra o erro no campo', async () => {
    const repetida = 'Já existe uma unidade com esta sigla neste grupamento.';
    const f = comEstrutura({ 'PATCH /api/divisoes/u-da': { status: 409, corpo: { erro: repetida, campos: { sigla: repetida } } } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.click(await screen.findByRole('button', { name: 'Renomear DA' }));
    const sigla = screen.getByLabelText('Sigla');
    expect(sigla).toHaveValue('DA');
    expect(screen.getByLabelText('Nome')).toHaveValue('Divisão Administrativa');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, 'DivOp');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/divisoes/u-da')).toEqual({ sigla: 'DivOp', nome: 'Divisão Administrativa' }));
    expect(await screen.findByText(repetida)).toBeInTheDocument();
    expect(screen.getByLabelText('Sigla')).toHaveAccessibleDescription(repetida);
  });

  it('mover uma seção mostra o aviso e só grava depois de confirmar', async () => {
    const f = comEstrutura({ 'PUT /api/secoes/u-1sb/divisao': { status: 200, corpo: ARVORE } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 1ª SB'), 'u-divop');
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByRole('heading', { name: 'Mover 1ª SB para DivOp?' })).toBeInTheDocument();
    expect(janela.getByText(AVISO)).toBeInTheDocument();
    expect(chamadasA(f, 'PUT /api/secoes/u-1sb/divisao')).toBe(0);
    // cancelar não grava, e o seletor volta ao que estava
    await userEvent.click(janela.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, 'PUT /api/secoes/u-1sb/divisao')).toBe(0);
    expect(screen.getByLabelText('Divisão de 1ª SB')).toHaveValue('');
    await userEvent.selectOptions(screen.getByLabelText('Divisão de 1ª SB'), 'u-divop');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/secoes/u-1sb/divisao')).toEqual({ divisaoId: 'u-divop' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tirar a seção da divisão manda "sem divisão", com o mesmo aviso', async () => {
    const f = comEstrutura({ 'PUT /api/secoes/u-3sb/divisao': { status: 200, corpo: ARVORE } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 3ª SB'), '');
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByRole('heading', { name: 'Tirar 3ª SB de DA?' })).toBeInTheDocument();
    expect(janela.getByText(AVISO)).toBeInTheDocument();
    await userEvent.click(janela.getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/secoes/u-3sb/divisao')).toEqual({ divisaoId: null }));
  });

  it('o erro ao mover aparece na janela, que continua aberta', async () => {
    comEstrutura({ 'PUT /api/secoes/u-1sb/divisao': { status: 403, corpo: { erro: 'Você não tem permissão nos cadastros de 2º GB.' } } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 1ª SB'), 'u-da');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mover' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Você não tem permissão nos cadastros de 2º GB.');
  });
  it('mover mostra também o que a seção herda: o que a divisão de origem cadastrou deixa de valer e o da divisão nova passa a valer', async () => {
    comEstrutura({ [ESTRUTURA]: { status: 200, corpo: COM_CADASTROS } });
    abrir('/configuracoes?aba=estrutura');
    // 3ª SB sai da DA (que tem cadastros) para a DivOp (que não tem): só o que deixa de valer
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 3ª SB'), 'u-divop');
    let janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText(AVISO)).toBeInTheDocument();
    expect(janela.getByText('Os parâmetros, feriados e funções de DA deixam de valer para 3ª SB.')).toBeInTheDocument();
    expect(janela.queryByText(/passam a valer/)).toBeNull();
    await userEvent.click(janela.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // 1ª SB entra na DA: só o que passa a valer
    await userEvent.selectOptions(screen.getByLabelText('Divisão de 1ª SB'), 'u-da');
    janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText('Os parâmetros, feriados e funções de DA passam a valer para 1ª SB.')).toBeInTheDocument();
    expect(janela.queryByText(/deixam de valer/)).toBeNull();
    await userEvent.click(janela.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // 1ª SB entra na DivOp, que não tem cadastros, vindo do grupamento: só o aviso do acesso
    await userEvent.selectOptions(screen.getByLabelText('Divisão de 1ª SB'), 'u-divop');
    janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText(AVISO)).toBeInTheDocument();
    expect(janela.queryByText(/valer/)).toBeNull();
  });

  it('a divisão de origem e a de destino com cadastros: o aviso mostra as duas frases', async () => {
    const dois = no('u-gb', '2º GB', '2º Grupamento de Bombeiros', 'grupamento', [
      { ...no('u-da', 'DA', 'Divisão Administrativa', 'divisao', [no('u-3sb', '3ª SB', '3ª Seção de Bombeiros', 'secao')]), cadastrosProprios: 2 },
      { ...no('u-divop', 'DivOp', 'Divisão Operacional', 'divisao', [no('u-4sb', '4ª SB', '4ª Seção de Bombeiros', 'secao')]), cadastrosProprios: 1 },
    ]);
    comEstrutura({ [ESTRUTURA]: { status: 200, corpo: dois } });
    abrir('/configuracoes?aba=estrutura');
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 3ª SB'), 'u-divop');
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText('Os parâmetros, feriados e funções de DA deixam de valer para 3ª SB.')).toBeInTheDocument();
    expect(janela.getByText('Os parâmetros, feriados e funções de DivOp passam a valer para 3ª SB.')).toBeInTheDocument();
  });

  it('depois de mover, tudo o que a seção herda (parâmetros, feriados, funções) é buscado de novo', async () => {
    comEstrutura({ 'PUT /api/secoes/u-1sb/divisao': { status: 200, corpo: ARVORE } });
    const router = abrir('/configuracoes?aba=estrutura');
    const queryClient = router.options.context.queryClient;
    queryClient.setQueryData(['parametros', 'u-1sb', '2026-11'], []);
    queryClient.setQueryData(['feriados', 'u-1sb', 2026], []);
    queryClient.setQueryData(['funcoes', 'u-1sb'], []);
    await userEvent.selectOptions(await screen.findByLabelText('Divisão de 1ª SB'), 'u-divop');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    for (const chave of [['parametros', 'u-1sb', '2026-11'], ['feriados', 'u-1sb', 2026], ['funcoes', 'u-1sb']]) expect(queryClient.getQueryState(chave)?.isInvalidated).toBe(true);
  });
});
