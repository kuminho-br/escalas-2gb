import type { Escala, FichaGuarnicao, FichaMilitar, LinhaEscala, LinhaGuarnicao, LinhaMilitar, Servico } from 'contratos';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atualizarMilitares } from '@/api/militares';
import { MENSAGEM_PENDENTE } from '@/componentes/AlteracoesPendentes';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const LISTA: LinhaEscala[] = [
  { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' },
  { id: 'e2', nome: 'Nova', ativa: true, servicos: [], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' },
];
const escala = (e: Partial<Escala>): Escala => ({
  id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true, montaBlocosVoluntariado: true, distribuicao: 'pre_escala',
  servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }], faixas: [], comLetra: true, vinculos: [], ...e,
});
const BIOMA: Servico = {
  id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#C08A1E', tiraDoExpediente: false, ativo: true, fixo: false,
  turnos: [{ id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [] }],
};

function api() {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
    'GET /api/escalas/e1': { status: 200, corpo: escala({}) },
    'GET /api/escalas/e2': { status: 200, corpo: escala({ id: 'e2', nome: 'Nova', titulo: 'ESCALA NOVA', servicos: [] }) },
    'PATCH /api/escalas/e1': { status: 200, corpo: escala({ titulo: 'ESCALA NOVA DO ORDINÁRIO' }) },
    'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
  });
}
const trocarTitulo = async () => {
  const campo = await screen.findByLabelText('Título no documento');
  fireEvent.change(campo, { target: { value: 'ESCALA NOVA DO ORDINÁRIO' } });
  return campo;
};
const irParaNova = () => userEvent.click(screen.getByRole('link', { name: /^Nova/ }));

afterEach(() => vi.restoreAllMocks());

describe('alterações não salvas', () => {
  // [foco 20]
  it('mudar o título mostra Alterações não salvas', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByLabelText('Título no documento');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    await trocarTitulo();
    expect(screen.getAllByText('Alterações não salvas')).toHaveLength(1);
  });

  it('trocar de escala com alteração pendente pergunta e fica ao cancelar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    const campo = await trocarTitulo();
    await irParaNova();
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
    expect(screen.getByLabelText('Título no documento')).toBe(campo);
    expect(campo).toHaveValue('ESCALA NOVA DO ORDINÁRIO');
  });

  it('confirmando, troca de escala', async () => {
    api();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/escalas/e1');
    await trocarTitulo();
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
  });

  it('sem alteração, troca sem perguntar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await screen.findByLabelText('Título no documento');
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('mudar o horário de um turno mostra Alterações não salvas', async () => {
    api();
    abrir('/servicos/s3');
    const inicio = await screen.findByLabelText('Início do turno A');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    fireEvent.change(inicio, { target: { value: '01:00' } });
    expect(screen.getAllByText('Alterações não salvas')).toHaveLength(1);
    fireEvent.change(inicio, { target: { value: '00:00' } });
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('depois de salvar, o aviso some sem perguntar', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await trocarTitulo();
    await userEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0]!);
    await waitFor(() => expect(screen.queryByText('Alterações não salvas')).toBeNull());
    await irParaNova();
    await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('revisão: sair do sistema com alteração pendente pergunta antes de encerrar a sessão', async () => {
    const f = simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
      'GET /api/escalas/e1': { status: 200, corpo: escala({}) },
      '/api/auth/sign-out': { status: 200, corpo: { success: true } },
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await trocarTitulo();
    await userEvent.click(await screen.findByRole('button', { name: /SD ANDRADE/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
    const chamouSaida = f.mock.calls.some(([e]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : (e as Request).url).includes('sign-out'));
    expect(chamouSaida).toBe(false);
    expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA DO ORDINÁRIO');
  });

  it('revisão: salvar um turno não descarta a edição pendente de outro', async () => {
    const DOIS: Servico = {
      ...BIOMA,
      turnos: [
        { id: 't1', letra: 'A', inicio: '00:00', fim: '08:00', duracaoMinutos: 480, turnosPadrao: [] },
        { id: 't2', letra: 'B', inicio: '08:00', fim: '16:00', duracaoMinutos: 480, turnosPadrao: [] },
      ],
    };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [DOIS] },
      'GET /api/servicos/s3': { status: 200, corpo: DOIS },
      'PATCH /api/turnos/t1': { status: 200, corpo: DOIS },
    };
    simularApi(rotas);
    abrir('/servicos/s3');
    fireEvent.change(await screen.findByLabelText('Início do turno B'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Início do turno A'), { target: { value: '01:00' } });
    // o servidor passa a devolver o turno A gravado
    rotas['GET /api/servicos/s3'] = { status: 200, corpo: { ...DOIS, turnos: [{ ...DOIS.turnos[0]!, inicio: '01:00' }, DOIS.turnos[1]!] } };
    await userEvent.click(screen.getByRole('button', { name: 'Salvar turno A' }));
    await waitFor(() => expect(screen.getByLabelText('Início do turno A')).toHaveValue('01:00'));
    expect(screen.getByLabelText('Início do turno B')).toHaveValue('09:00');
  });

  it('revisão: salvar os serviços da escala não descarta as marcações da matriz', async () => {
    const mes = mesAtual();
    const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto'] };
    const NOITE = { inicio: '20:00', fim: '08:00', letras: ['B' as const], servicos: ['Pronto'] };
    const g: LinhaGuarnicao = { id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null };
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [g] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'GET /api/escalas/e1': {
        status: 200,
        corpo: escala({ faixas: [DIA, NOITE], servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }, { id: 's2', nome: 'JES', cor: '#6E56A8', ativo: true }] }),
      },
      'PUT /api/escalas/e1/servicos': { status: 200, corpo: escala({}) },
    };
    simularApi(rotas);
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    // mudar a ordem dos serviços é o que acende o Salvar dos serviços
    await userEvent.click(screen.getByRole('button', { name: 'Descer Pronto' }));
    // salvar os serviços muda as faixas que o servidor devolve
    rotas['GET /api/escalas/e1'] = { status: 200, corpo: escala({ faixas: [DIA] }) };
    await userEvent.click(screen.getByRole('button', { name: 'Salvar serviços' }));
    await waitFor(() => expect(screen.queryByLabelText('ABT em B (20h–08h)')).toBeNull());
    expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked();
    expect(mes).toBeTruthy();
  });

  it('revisão: trocar de versão com marcações pendentes pergunta e fica ao cancelar', async () => {
    const mes = mesAtual();
    const proximo = `${Number(mes.slice(0, 4)) + 1}-01`;
    const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto'] };
    const g: LinhaGuarnicao = { id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null };
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [g] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'GET /api/escalas/e1': {
        status: 200,
        corpo: escala({ faixas: [DIA], vinculos: [{ vigencia: proximo, itens: [] }, { vigencia: mes, itens: [] }] }),
      },
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`janeiro de ${proximo.slice(0, 4)}`) }));
    expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE);
    expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked();
  });
});

describe('Salvar que mostra o estado', () => {
  const rotasDoServico = () => ({ ...apiRotas(), 'PATCH /api/servicos/s3': { status: 200, corpo: BIOMA } });
  function apiRotas(): Parameters<typeof simularApi>[0] {
    return {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] },
      'GET /api/servicos/s3': { status: 200, corpo: BIOMA },
    };
  }

  it('sem alteração, o Salvar fica apagado', async () => {
    simularApi(rotasDoServico());
    abrir('/servicos/s3');
    await screen.findByLabelText('Nome');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('com alteração, o Salvar acende', async () => {
    simularApi(rotasDoServico());
    abrir('/servicos/s3');
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Bioma 2' } });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeEnabled();
    expect(salvar).toHaveAttribute('data-variant', 'principal');
  });

  it('o aviso de salvo some ao mexer de novo', async () => {
    simularApi(rotasDoServico());
    abrir('/servicos/s3');
    const nome = await screen.findByLabelText('Nome');
    fireEvent.change(nome, { target: { value: 'Bioma 2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    fireEvent.change(nome, { target: { value: 'Bioma 3' } });
    expect(screen.queryByText('Alterações salvas.')).toBeNull();
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
  });

  it('a linha de turno só mostra Salvar quando muda', async () => {
    simularApi(rotasDoServico());
    abrir('/servicos/s3');
    const inicio = await screen.findByLabelText('Início do turno A');
    expect(screen.queryByRole('button', { name: 'Salvar turno A' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remover turno A' })).toBeInTheDocument();
    fireEvent.change(inicio, { target: { value: '01:00' } });
    expect(screen.getByRole('button', { name: 'Salvar turno A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover turno A' })).toBeInTheDocument();
  });

  describe('matriz da escala', () => {
    const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto'] };
    const g: LinhaGuarnicao = { id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null };
    const rotas = (e: Escala): Parameters<typeof simularApi>[0] => ({
      ...apiRotas(),
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [g] },
      'GET /api/escalas/e1': { status: 200, corpo: e },
      'GET /api/escalas/e2': { status: 200, corpo: escala({ id: 'e2', nome: 'Nova', titulo: 'ESCALA NOVA', servicos: [] }) },
      'PUT /api/escalas/e1/vinculos/2099-01': { status: 200, corpo: e },
    });

    it('na matriz, trocar só o mês não acende o Salvar', async () => {
      simularApi(rotas(escala({ faixas: [DIA] })));
      abrir('/escalas/e1');
      const caixa = await screen.findByLabelText('ABT em A (08h–20h)');
      fireEvent.change(screen.getByLabelText('Vale a partir de'), { target: { value: '2099-01' } });
      const salvar = screen.getByRole('button', { name: 'Salvar a partir de janeiro de 2099' });
      expect(salvar).toBeDisabled();
      await userEvent.click(caixa);
      expect(screen.getByRole('button', { name: 'Salvar a partir de janeiro de 2099' })).toBeEnabled();
    });

    it('salvar a matriz num mês novo não pergunta ao trocar de escala', async () => {
      const salva = escala({
        faixas: [DIA],
        vinculos: [{ vigencia: '2099-01', itens: [{ guarnicaoId: 'g1', guarnicao: 'ABT', inicio: '08:00', fim: '20:00', ativaNoMes: true }] }],
      });
      const r = rotas(escala({ faixas: [DIA] }));
      const f = simularApi(r);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      abrir('/escalas/e1');
      await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
      fireEvent.change(screen.getByLabelText('Vale a partir de'), { target: { value: '2099-01' } });
      r['GET /api/escalas/e1'] = { status: 200, corpo: salva };
      await userEvent.click(screen.getByRole('button', { name: 'Salvar a partir de janeiro de 2099' }));
      await waitFor(() => expect(corpoEnviado(f, 'PUT /api/escalas/e1/vinculos/2099-01')).toEqual({ itens: [{ guarnicaoId: 'g1', inicio: '08:00', fim: '20:00' }] }));
      await irParaNova();
      await waitFor(() => expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA'));
      expect(confirmar).not.toHaveBeenCalled();
    });
  });

  describe('fichas de militar e de guarnição', () => {
    const linhaM = (l: Partial<LinhaMilitar>): LinhaMilitar => ({
      id: 'm1', matricula: '990001-1', posto: 'SD', quadro: null, nomeGuerra: 'ANDRADE', equipe: 'Alfa', jornada: 'pronto', motorista: null,
      voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [], ...l,
    });
    const FICHA_M: FichaMilitar = {
      ...linhaM({}), podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' }, postoGradId: 'p-sd', veDadosRestritos: true, cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, situacaoDoMilitar: { id: 'sit-ativa', nome: 'Ativa', escalavel: true }, nomeCompleto: 'João da Silva Andrade', sexo: 'M', nascimento: { dia: 15, mes: 3 }, telefone: '(81) 99999-0000', email: 'andrade@bombeiros.pe.gov.br', comportamento: 'Bom', comportamentoBoletim: 'BG 01/2026', antiguidade: 3, antiguidadeRepetidaCom: [], funcao: null, funcaoMilitarId: null, abonoPermanencia: false, noQuadroDeMotoristas: false, cnh: [], cnhPorHierarquia: [],
      rastreio: [{ id: 'l1', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', alteradoPor: null, alteradoEm: null, podeMexer: false, equipe: 'Alfa', jornada: 'pronto', desde: '2020-01-01', quadro: 'QBMG', situacao: 'Ativa', ate: null }], afastamentos: [],
    };
    const rotasM = (): Parameters<typeof simularApi>[0] => ({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [linhaM({}), linhaM({ id: 'm2', matricula: '990002-2', nomeGuerra: 'BARRETO' })] },
      'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
      'GET /api/postos': { status: 200, corpo: [{ id: 'p-sd', sigla: 'SD', nome: 'Soldado', ordem: 1 }] },
      'GET /api/militares/m1': { status: 200, corpo: FICHA_M },
      'GET /api/militares/m2': { status: 200, corpo: { ...FICHA_M, id: 'm2', nomeGuerra: 'BARRETO', matricula: '990002-2' } },
      'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [] },
    });

    it('trocar de militar com a identificação pendente pergunta', async () => {
      simularApi(rotasM());
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      abrir('/militares/m1');
      const campo = await screen.findByLabelText('Nome de guerra');
      fireEvent.change(campo, { target: { value: 'ANDRADE JR' } });
      await userEvent.click(screen.getByRole('link', { name: /BARRETO/ }));
      await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
      expect(screen.getByLabelText('Nome de guerra')).toHaveValue('ANDRADE JR');
    });

    it('com a ficha do militar aberta, uma gravação de fora recarrega os campos', async () => {
      const r = rotasM();
      simularApi(r);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const router = abrir('/militares/m1');
      expect(await screen.findByLabelText('Nome de guerra')).toHaveValue('ANDRADE');
      r['GET /api/militares/m1'] = { status: 200, corpo: { ...FICHA_M, nomeGuerra: 'ANDRADE NOVO' } };
      await act(async () => {
        atualizarMilitares(router.options.context.queryClient, 'm1');
      });
      await waitFor(() => expect(screen.getByLabelText('Nome de guerra')).toHaveValue('ANDRADE NOVO'));
      expect(confirmar).not.toHaveBeenCalled();
    });

    it('revisão 3: dado novo do servidor com a identificação pendente não apaga o que a pessoa digitou', async () => {
      const r = rotasM();
      const f = simularApi(r);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const router = abrir('/militares/m1');
      const campo = await screen.findByLabelText('Nome de guerra');
      fireEvent.change(campo, { target: { value: 'ANDRADE JR' } });
      const antes = chamadasA(f, 'GET /api/militares/m1');
      r['GET /api/militares/m1'] = { status: 200, corpo: { ...FICHA_M, nomeGuerra: 'ANDRADE NOVO' } };
      await act(async () => {
        atualizarMilitares(router.options.context.queryClient, 'm1');
      });
      await waitFor(() => expect(chamadasA(f, 'GET /api/militares/m1')).toBeGreaterThan(antes));
      await new Promise((ok) => setTimeout(ok, 50));
      expect(screen.getByLabelText('Nome de guerra')).toHaveValue('ANDRADE JR');
      expect(screen.getAllByText('Alterações não salvas').length).toBeGreaterThan(0);
      expect(confirmar).not.toHaveBeenCalled();
    });

    it('revisão 3: incluir afastamento com as datas digitadas pergunta antes de trocar de militar', async () => {
      const r = rotasM();
      r['GET /api/sistema/tipos-afastamento'] = { status: 200, corpo: [{ id: 't-ferias', nome: 'Férias', ativo: true }] };
      simularApi(r);
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      abrir('/militares/m1');
      await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
      fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-12-01' } });
      await userEvent.click(screen.getByRole('link', { name: /BARRETO/ }));
      await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
      expect(screen.getByLabelText('Início')).toHaveValue('2026-12-01');
    });

    it('trocar de guarnição com a composição pendente pergunta', async () => {
      const ficha: FichaGuarnicao = {
        id: 'g1', nome: 'Auto Bomba 1', desativadaAPartirDe: null,
        versoes: [{ vigencia: '2026-01', viatura: null, tipoViatura: null, prioridade: 1, ativa: true, composicao: [] }], usadaEm: [],
      };
      const lista = (id: string, nome: string): LinhaGuarnicao => ({ id, nome, viatura: null, prioridade: 1, ativa: true, minimo: 0, maximo: 0, aPartirDe: null });
      simularApi({
        '/api/eu': { status: 200, corpo: EU_EXEMPLO },
        'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [lista('g1', 'Auto Bomba 1'), lista('g2', 'Resgate')] },
        'GET /api/unidades/u-1sb/funcoes': { status: 200, corpo: [] },
        'GET /api/guarnicoes/g1': { status: 200, corpo: ficha },
        'GET /api/guarnicoes/g2': { status: 200, corpo: { ...ficha, id: 'g2', nome: 'Resgate' } },
      });
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      abrir('/configuracoes/modelos-de-guarnicao/g1');
      await userEvent.click(await screen.findByRole('button', { name: 'Incluir função' }));
      await userEvent.click(screen.getByRole('link', { name: /Resgate/ }));
      await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
      expect(screen.getByRole('heading', { level: 2, name: 'Auto Bomba 1' })).toBeInTheDocument();
    });
  });
});
