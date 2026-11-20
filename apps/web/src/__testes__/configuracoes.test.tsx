import { mesPorExtenso, somarMeses, type LinhaEscala, type LinhaGuarnicao, type Parametro, type VersaoDaMetaPadrao } from 'contratos';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { hoje } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

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
    'GET /api/sistema/atividades': { status: 200, corpo: [] },
    ...extra,
  });
}

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

describe('configurações: papéis e campos', () => {
  const ADM_CUMPRE = parametro({ chave: 'ADM_CUMPRE_CARGA', rotulo: 'Adm cumpre a carga mensal', tipo: 'simnao', valor: false });
  const apiComSimNao = (eu = GESTOR, extra: Parameters<typeof simularApi>[0] = {}) =>
    api({ [`GET ${PARAMS}`]: { status: 200, corpo: [...LISTA, ADM_CUMPRE] }, ...extra }, eu);

  it('escalante não vê Mudar a partir de nem Importar da planilha', async () => {
    api();
    abrir('/configuracoes');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.queryByRole('button', { name: 'Mudar a partir de…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Importar da planilha' })).toBeNull();
    expect(screen.getByText(/Só o gestor ou o administrador muda\./)).toBeInTheDocument();
  });

  it('gestor vê Mudar a partir de e Importar da planilha', async () => {
    api({}, GESTOR);
    abrir('/configuracoes');
    await screen.findByText('Carga mensal (horas)');
    expect(screen.getAllByRole('button', { name: 'Mudar a partir de…' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Importar da planilha' })).toBeInTheDocument();
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

  it('a grade geral diz que chega na próxima fase', async () => {
    api();
    abrir('/');
    expect(await screen.findByText('A grade geral chega na próxima fase.')).toBeInTheDocument();
    expect(screen.queryByText(/quando houver uma escala cadastrada/)).toBeNull();
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
