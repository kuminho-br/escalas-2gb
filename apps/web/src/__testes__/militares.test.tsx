import type { FichaMilitar, LinhaMilitar } from 'contratos';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { atualizarMilitares } from '@/api/militares';
import { hoje, mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

const linha = (l: Partial<LinhaMilitar>): LinhaMilitar => ({
  id: 'm1', matricula: '990001-1', posto: 'SD BM', quadro: { id: 'q-qbmg', sigla: 'QBMG' }, nomeGuerra: 'ANDRADE', equipe: 'Alfa', jornada: 'pronto', motorista: null,
  voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [], ...l,
});
const LISTA = [
  linha({}),
  linha({ id: 'm2', matricula: '990002-2', nomeGuerra: 'BARRETO', equipe: 'Bravo', situacao: 'Férias até 12/12', pendencias: ['Sem antiguidade'] }),
  linha({ id: 'm3', matricula: '990003-3', nomeGuerra: 'CABRAL', equipe: null, jornada: 'adm', motorista: 'D' }),
];
const FICHA: FichaMilitar = {
  ...linha({ motorista: 'D' }),
  podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' },
  postoGradId: 'p-sd', cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, situacaoDoMilitar: { id: 'sit-ativa', nome: 'Ativa', escalavel: true }, nomeCompleto: 'João da Silva Andrade', sexo: 'M', nascimento: { dia: 15, mes: 3 }, telefone: '(81) 99999-0000', email: 'andrade@bombeiros.pe.gov.br', comportamento: 'Bom', comportamentoBoletim: 'BG 01/2026', antiguidade: 3, antiguidadeRepetidaCom: [], noQuadroDeMotoristas: true, cnh: ['D'], cnhPorHierarquia: ['C', 'B'],
  rastreio: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', quadro: 'QBMG', situacao: 'Ativa', ate: null }],
  afastamentos: [{ id: 'a1', tipo: 'Férias', tipoAfastamentoId: 't-ferias', inicio: '2026-12-01', fim: '2026-12-10', motivo: null, boletim: null }],
};

const QUADROS = [
  { id: 'q-qoc', sigla: 'QOC', nome: 'Quadro de Oficiais Combatentes', postoGradIds: ['p-maj', 'p-cel'] },
  { id: 'q-qoa', sigla: 'QOA', nome: 'Quadro de Oficiais da Administração', postoGradIds: ['p-maj'] },
  { id: 'q-qbmg', sigla: 'QBMG', nome: 'Qualificação Bombeiro Militar Geral', postoGradIds: ['p-sd', 'p-cb'] },
];
const POSTOS_COM_OFICIAIS = [
  { id: 'p-sd', sigla: 'SD BM', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB BM', nome: 'Cabo', ordem: 2 },
  { id: 'p-maj', sigla: 'MAJ BM', nome: 'Major', ordem: 11 }, { id: 'p-cel', sigla: 'CEL BM', nome: 'Coronel', ordem: 13 },
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/militares': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [{ id: 'e-alfa', nome: 'Alfa', ordemCiclo: 1 }, { id: 'e-bravo', nome: 'Bravo', ordemCiclo: 2 }] },
    'GET /api/postos': { status: 200, corpo: [{ id: 'p-sd', sigla: 'SD BM', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB BM', nome: 'Cabo', ordem: 2 }] },
    'GET /api/quadros': { status: 200, corpo: QUADROS },
    'GET /api/situacoes-do-militar': { status: 200, corpo: [{ id: 'sit-ativa', nome: 'Ativa', escalavel: true, ativo: true }] },
    'GET /api/militares/m1': { status: 200, corpo: FICHA },
    'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [{ id: 't-ferias', nome: 'Férias', ativo: true }, { id: 't-curso', nome: 'Curso', ativo: false }] },
    ...extra,
  });
}

describe('lista de militares', () => {
  it('lista mostra situação e pendência', async () => {
    api();
    abrir('/militares');
    const item = (await screen.findByText('BARRETO')).closest('li')!;
    expect(within(item).getByText('Férias até 12/12')).toBeInTheDocument();
    expect(within(item).getByLabelText('Cadastro incompleto: Sem antiguidade')).toBeInTheDocument();
    const cabral = screen.getByText('CABRAL').closest('li')!;
    expect(within(cabral).getByText('Motorista D')).toBeInTheDocument();
  });

  it('filtrar por equipe', async () => {
    api();
    abrir('/militares');
    await screen.findByText('ANDRADE');
    await userEvent.selectOptions(screen.getByLabelText('Equipe'), 'Bravo');
    expect(screen.queryByText('ANDRADE')).toBeNull();
    expect(screen.getByText('BARRETO')).toBeInTheDocument();
  });

  it('busca por matrícula', async () => {
    api();
    abrir('/militares');
    await screen.findByText('ANDRADE');
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), '990003');
    expect(screen.getByText('CABRAL')).toBeInTheDocument();
    expect(screen.queryByText('ANDRADE')).toBeNull();
  });

});

describe('o quadro e a situação no rastreio', () => {
  const SITUACOES = [
    { id: 'sit-ativa', nome: 'Ativa', escalavel: true, ativo: true },
    { id: 'sit-reserva', nome: 'Reserva', escalavel: false, ativo: true },
    { id: 'sit-antiga', nome: 'Antiga', escalavel: true, ativo: false },
  ];
  const abrirAlterar = async () => {
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: /Histórico de rastreio/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Alterar situação' }));
    return screen.findByRole('dialog');
  };

  it('a Identificação não tem mais "Quadro" nem "Ativo"', async () => {
    api();
    abrir('/militares/m1');
    expect(await screen.findByLabelText('Posto-graduação')).toBeInTheDocument();
    expect(screen.queryByLabelText('Quadro')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Ativo' })).toBeNull();
  });

  it('a situação atual mostra o quadro e a situação', async () => {
    api();
    abrir('/militares/m1');
    expect((await screen.findAllByText(/1ª SB · Equipe Alfa · Pronto · QBMG · Ativa/)).length).toBeGreaterThan(0);
  });

  it('"Alterar situação" tem Quadro (só os do posto) e Situação (só as ativas)', async () => {
    api({ 'GET /api/situacoes-do-militar': { status: 200, corpo: SITUACOES } });
    const caixa = within(await abrirAlterar());
    const quadro = await caixa.findByLabelText('Quadro');
    expect(quadro).toHaveDisplayValue('QBMG');
    expect(within(quadro).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sem quadro', 'QBMG']);
    const situacao = caixa.getByLabelText('Situação');
    await within(situacao).findByRole('option', { name: 'Reserva' });
    expect(situacao).toHaveDisplayValue('Ativa');
    expect(within(situacao).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ativa', 'Reserva']);
  });

  it('trocar a situação manda o quadro e a situação escolhidos', async () => {
    const f = api({ 'GET /api/situacoes-do-militar': { status: 200, corpo: SITUACOES }, 'POST /api/militares/m1/situacao': { status: 200, corpo: FICHA } });
    const caixa = within(await abrirAlterar());
    const situacao = caixa.getByLabelText('Situação');
    await within(situacao).findByRole('option', { name: 'Reserva' });
    await userEvent.selectOptions(situacao, 'Reserva');
    await userEvent.click(caixa.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/situacao')).toMatchObject({ situacaoId: 'sit-reserva' }));
  });

  it('para quem não pode editar o bloco Pecúlio, o quadro e a situação ficam travados', async () => {
    api({
      'GET /api/situacoes-do-militar': { status: 200, corpo: SITUACOES },
      'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, podeEditar: { peculio: false, escala: true, unidadeDeCima: '2º GB' } } },
    });
    const caixa = within(await abrirAlterar());
    expect(await caixa.findByLabelText('Quadro')).toBeDisabled();
    expect(caixa.getByLabelText('Situação')).toBeDisabled();
  });
});

describe('dados pessoais: CPF, nascimento e endereço', () => {
  it('o CPF e o CEP aparecem com a máscara, e a UF é uma lista com as 27 siglas', async () => {
    api({ 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, cpf: '52998224725', endereco: { ...FICHA.endereco, cep: '50030230', uf: 'PE' } } } });
    abrir('/militares/m1');
    expect(await screen.findByLabelText('CPF')).toHaveValue('529.982.247-25');
    expect(screen.getByLabelText('CEP')).toHaveValue('50030-230');
    const uf = screen.getByLabelText('UF');
    expect(uf).toHaveDisplayValue('PE');
    expect(within(uf).getAllByRole('option')).toHaveLength(28);
  });

  it('grava só o que mudou, com o CPF em dígitos e o endereço agrupado', async () => {
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: FICHA } });
    abrir('/militares/m1');
    await userEvent.type(await screen.findByLabelText('CPF'), '52998224725');
    await userEvent.type(screen.getByLabelText('Logradouro'), 'Rua Fictícia');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cpf: '52998224725', endereco: { logradouro: 'Rua Fictícia' } }));
    // depois de gravar, o bloco não fica com alteração pendente (o CPF com a máscara é o mesmo que foi gravado)
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar dados pessoais' })).toBeDisabled();
  });

  it('dígitos a mais no CPF e no CEP não entram', async () => {
    api();
    abrir('/militares/m1');
    const cpf = await screen.findByLabelText('CPF');
    await userEvent.type(cpf, '5299822472599');
    expect(cpf).toHaveValue('529.982.247-25');
    await userEvent.type(screen.getByLabelText('CEP'), '500302309');
    expect(screen.getByLabelText('CEP')).toHaveValue('50030-230');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    expect(screen.queryByText('CPF inválido: confira os 11 dígitos.')).toBeNull();
  });

  it('CPF inválido é recusado no campo, sem ir ao servidor', async () => {
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: FICHA } });
    abrir('/militares/m1');
    await userEvent.type(await screen.findByLabelText('CPF'), '11111111111');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    expect(await screen.findByText('CPF inválido: confira os 11 dígitos.')).toBeInTheDocument();
    expect(chamadasA(f, 'PATCH /api/militares/m1')).toBe(0);
  });

  it('o erro da API (CPF repetido) aparece no campo', async () => {
    api({ 'PATCH /api/militares/m1': { status: 409, corpo: { erro: 'Este CPF já é de BARRETO.', campos: { cpf: 'Este CPF já é de BARRETO.' } } } });
    abrir('/militares/m1');
    await userEvent.type(await screen.findByLabelText('CPF'), '39053344705');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    expect((await screen.findAllByText('Este CPF já é de BARRETO.')).length).toBeGreaterThan(0);
  });
});

describe('listas que não carregam explicam o botão apagado', () => {
  const MSG = 'Não deu para carregar a lista. Recarregue a página.';

  it('postos em 500: a Identificação diz que a lista não carregou, perto do campo Posto', async () => {
    api({ 'GET /api/postos': { status: 500, corpo: { erro: 'Falha.' } } });
    abrir('/militares/m1');
    const campo = await screen.findByLabelText('Posto-graduação');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(MSG);
  });

  it('tipos de afastamento em 500: "Incluir afastamento" diz que a lista não carregou', async () => {
    api({ 'GET /api/sistema/tipos-afastamento': { status: 500, corpo: { erro: 'Falha.' } } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de afastamento')).toHaveAccessibleDescription(MSG);
  });

  it('com as listas carregadas, nada disso aparece', async () => {
    api();
    abrir('/militares/m1');
    await screen.findByLabelText('Posto-graduação');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    expect(screen.queryByText(MSG)).toBeNull();
  });
});

describe('lista já carregada cuja nova busca falha (Review Focus 3)', () => {
  const MSG = 'Não deu para carregar a lista. Recarregue a página.';
  const POSTOS = [{ id: 'p-sd', sigla: 'SD BM', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB BM', nome: 'Cabo', ordem: 2 }];
  const TIPOS = [{ id: 't-ferias', nome: 'Férias', ativo: true }];
  type Rota = { status: number; corpo?: unknown };

  /** a rota passa a responder 500 e a consulta é buscada de novo: a lista que já estava na tela continua com o que veio antes */
  async function buscarDeNovoEFalhar(router: ReturnType<typeof abrir>, rota: Rota, chave: string[]) {
    rota.status = 500;
    rota.corpo = { erro: 'Falha.' };
    const queryClient = (router.options.context as { queryClient: QueryClient }).queryClient;
    await queryClient.invalidateQueries({ queryKey: chave });
    await waitFor(() => expect(queryClient.getQueryState(chave)?.status).toBe('error'));
  }

  it('postos: a Identificação continua com as opções e sem o aviso', async () => {
    const postos: Rota = { status: 200, corpo: POSTOS };
    api({ 'GET /api/postos': postos });
    const router = abrir('/militares/m1');
    const campo = await screen.findByLabelText('Posto-graduação');
    await within(campo).findByRole('option', { name: 'SD BM' });
    await buscarDeNovoEFalhar(router, postos, ['postos']);
    expect(within(campo).getByRole('option', { name: 'SD BM' })).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it('tipos de afastamento: "Incluir afastamento" continua com as opções e sem o aviso', async () => {
    const tipos: Rota = { status: 200, corpo: TIPOS };
    api({ 'GET /api/sistema/tipos-afastamento': tipos });
    const router = abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    const campo = await screen.findByLabelText('Tipo de afastamento');
    await within(campo).findByRole('option', { name: 'Férias' });
    await buscarDeNovoEFalhar(router, tipos, ['catalogo', 'tipos-afastamento']);
    expect(within(campo).getByRole('option', { name: 'Férias' })).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });
});

describe('Motorista: dado novo do servidor (revisão final da revisão 3)', () => {
  type Rota = { status: number; corpo?: unknown };
  const fichaCom = (cnh: string[]) => ({ ...FICHA, noQuadroDeMotoristas: true, cnh, cnhPorHierarquia: [] });
  const botao = (letra: string) => screen.getByRole('button', { name: new RegExp(`^${letra}\\b`) });
  const pressionado = (letra: string) => expect(botao(letra)).toHaveAttribute('aria-pressed');

  it('sem alteração pendente, recarrega o bloco', async () => {
    const ficha: Rota = { status: 200, corpo: fichaCom(['D']) };
    api({ 'GET /api/militares/m1': ficha });
    const router = abrir('/militares/m1');
    expect(await screen.findByRole('button', { name: /^D\b/ })).toHaveAttribute('aria-pressed', 'true');
    ficha.corpo = fichaCom(['A']);
    await act(async () => {
      atualizarMilitares(router.options.context.queryClient);
    });
    await waitFor(() => expect(botao('A')).toHaveAttribute('aria-pressed', 'true'));
    expect(botao('D')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    pressionado('A');
  });

  it('desfazer a edição depois de chegar dado novo do servidor mostra o valor do servidor, não o antigo (Review Focus 4)', async () => {
    const ficha: Rota = { status: 200, corpo: fichaCom(['D']) };
    api({ 'GET /api/militares/m1': ficha });
    const router = abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: /^A\b/ }));
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    // chega dado novo enquanto a edição está pendente: a edição fica
    ficha.corpo = fichaCom(['B']);
    await act(async () => {
      atualizarMilitares(router.options.context.queryClient);
    });
    await new Promise((x) => setTimeout(x, 50));
    expect(botao('A')).toHaveAttribute('aria-pressed', 'true');
    // a pessoa desfaz a edição: o campo passa a mostrar o do servidor (B), não o de antes (D)
    await userEvent.click(botao('A'));
    await waitFor(() => expect(botao('D')).toHaveAttribute('aria-pressed', 'false'));
    expect(botao('B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });
});

describe('ficha do militar', () => {
  it('as categorias que a carteira habilita aparecem marcadas, sem escrever "pela E"; só a carteira é gravada', async () => {
    const f = api({
      'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, noQuadroDeMotoristas: true, cnh: ['E'], cnhPorHierarquia: ['D', 'C', 'B'] } },
      'PATCH /api/militares/m1': { status: 200, corpo: FICHA },
    });
    abrir('/militares/m1');
    const c = await screen.findByRole('button', { name: /^C\b/ });
    for (const letra of ['D', 'C', 'B']) {
      const botao = screen.getByRole('button', { name: new RegExp(`^${letra}\\b`) });
      expect(botao).toHaveAttribute('aria-pressed', 'true');
      expect(botao).toHaveAttribute('data-origem', 'hierarquia');
      // o quadrado não escreve de onde vem (a informação ficou só no nome acessível)
      expect(within(botao).queryByText(/pela/)).toBeNull();
    }
    // o nome acessível continua dizendo de onde vem
    expect(screen.getByRole('button', { name: 'C caminhão pela E' })).toBe(c);
    const a = screen.getByRole('button', { name: /^A\b/ });
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(a).toHaveAttribute('data-origem', 'nenhuma');
    // a habilitada tem a mesma aparência da carteira (preenchida), sem tracejado
    expect(c).toHaveClass('bg-tinta');
    expect(c).not.toHaveClass('border-dashed');
    expect(screen.getByText('Marque as categorias da carteira. As que ela habilita acendem sozinhas (a E acende D, C e B). A moto (A) é separada.')).toBeInTheDocument();
    // tirar a E da carteira apaga as três
    await userEvent.click(screen.getByRole('button', { name: /^E\b/ }));
    for (const letra of ['D', 'C', 'B']) expect(screen.getByRole('button', { name: new RegExp(`^${letra}\\b`) })).toHaveAttribute('aria-pressed', 'false');
    // só a carteira é gravada: com a E de volta e a moto, vai ['A', 'E']
    await userEvent.click(screen.getByRole('button', { name: /^E\b/ }));
    await userEvent.click(screen.getByRole('button', { name: /^A\b/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
    // o quadro não mudou: o salvar manda só o que mudou (a carteira)
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['A', 'E'] }));
  });

  describe('CNH: clicar numa categoria acesa só pela hierarquia', () => {
    const quadrado = (letra: string) => screen.getByRole('button', { name: new RegExp(`^${letra}\\b`) });
    const apagado = (letra: string) => expect(quadrado(letra)).toHaveAttribute('data-origem', 'nenhuma');
    const daCarteira = (letra: string) => expect(quadrado(letra)).toHaveAttribute('data-origem', 'carteira');
    const pelaHierarquia = (letra: string) => expect(quadrado(letra)).toHaveAttribute('data-origem', 'hierarquia');
    const abrirCom = (cnh: string[]) => {
      const f = api({
        'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, noQuadroDeMotoristas: true, cnh, cnhPorHierarquia: [] } },
        'PATCH /api/militares/m1': { status: 200, corpo: FICHA },
      });
      abrir('/militares/m1');
      return f;
    };

    it('com a E na carteira, clicar na C deixa só a C: a E e a D saem, e a B segue acesa pela C', async () => {
      const f = abrirCom(['E']);
      await screen.findByRole('button', { name: /^C\b/ });
      pelaHierarquia('D');
      await userEvent.click(quadrado('C'));
      daCarteira('C');
      pelaHierarquia('B');
      apagado('E');
      apagado('D');
      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['C'] }));
    });

    it('clicar na categoria que está na carteira (E) apaga ela e as que ela acendeu, e a moto fica como estava', async () => {
      abrirCom(['A', 'E']);
      await screen.findByRole('button', { name: /^E\b/ });
      await userEvent.click(quadrado('E'));
      for (const letra of ['E', 'D', 'C', 'B']) apagado(letra);
      daCarteira('A');
    });

    it('a moto é separada: clicar na C com a moto e a E na carteira mexe só na E e na C', async () => {
      const f = abrirCom(['A', 'E']);
      await screen.findByRole('button', { name: /^C\b/ });
      await userEvent.click(quadrado('C'));
      daCarteira('A');
      daCarteira('C');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['A', 'C'] }));
    });

    it('com a E e a D juntas na carteira, clicar na C tira as duas que a acendiam (senão ela continuaria acesa pela D)', async () => {
      const f = abrirCom(['D', 'E']);
      await screen.findByRole('button', { name: /^C\b/ });
      await userEvent.click(quadrado('C'));
      daCarteira('C');
      apagado('D');
      apagado('E');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['C'] }));
    });

    it('carteira que veio com a C e a E juntas: clicar na C deixa só a C (a E sai)', async () => {
      const f = abrirCom(['C', 'E']);
      await screen.findByRole('button', { name: /^C\b/ });
      await userEvent.click(quadrado('C'));
      daCarteira('C');
      apagado('E');
      apagado('D');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['C'] }));
    });

    it('carteira que veio com a C e a E juntas: clicar na E apaga a E e tudo o que ela acendia, inclusive a C', async () => {
      const f = abrirCom(['A', 'C', 'E']);
      await screen.findByRole('button', { name: /^E\b/ });
      await userEvent.click(quadrado('E'));
      for (const letra of ['E', 'D', 'C', 'B']) apagado(letra);
      daCarteira('A');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['A'] }));
    });

    it('clicar numa categoria apagada acende ela; a menor que a carteira já tinha passa a vir dela, e nenhum quadrado escreve "pela X"', async () => {
      const f = abrirCom(['C']);
      await screen.findByRole('button', { name: /^C\b/ });
      await userEvent.click(quadrado('E'));
      daCarteira('E');
      pelaHierarquia('D');
      pelaHierarquia('C');
      pelaHierarquia('B');
      expect(screen.queryByText(/pela [A-E]/)).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ cnh: ['E'] }));
      // a frase de ajuda não muda
      expect(screen.getByText('Marque as categorias da carteira. As que ela habilita acendem sozinhas (a E acende D, C e B). A moto (A) é separada.')).toBeInTheDocument();
    });
  });

  describe('motorista e CNH são independentes', () => {
    const quadro = () => within(screen.getByRole('group', { name: 'Está no quadro de motoristas?' }));

    it('a ficha mostra as categorias da CNH com o quadro desmarcado, e o texto de ajuda diz que a CNH só vale para a escala no quadro', async () => {
      api({ 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, noQuadroDeMotoristas: false, motorista: null, cnh: ['D'], cnhPorHierarquia: ['C', 'B'] } } });
      abrir('/militares/m1');
      const d = await screen.findByRole('button', { name: /^D\b/ });
      expect(d).toHaveAttribute('aria-pressed', 'true');
      expect(d).toHaveAttribute('data-origem', 'carteira');
      expect(screen.getByRole('button', { name: 'C caminhão pela D' })).toHaveAttribute('data-origem', 'hierarquia');
      expect(quadro().getByRole('radio', { name: 'Não' })).toBeChecked();
      expect(screen.getByText('A CNH só vale para a escala com o militar no quadro de motoristas.')).toBeInTheDocument();
    });

    it('desmarcar "Está no quadro de motoristas?" não apaga a carteira e o salvar manda só motorista: false', async () => {
      const f = api({
        'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, noQuadroDeMotoristas: true, cnh: ['D'], cnhPorHierarquia: ['C', 'B'] } },
        'PATCH /api/militares/m1': { status: 200, corpo: FICHA },
      });
      abrir('/militares/m1');
      await screen.findByRole('button', { name: /^D\b/ });
      await userEvent.click(quadro().getByRole('radio', { name: 'Não' }));
      expect(screen.getByRole('button', { name: /^D\b/ })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Salvar motorista' }));
      await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ motorista: false }));
    });
  });

  it('os campos de afastamento só aparecem depois de "Incluir afastamento"', async () => {
    api();
    abrir('/militares/m1');
    expect(await screen.findByText('Férias')).toBeInTheDocument();
    expect(screen.queryByLabelText('Início')).toBeNull();
    expect(screen.queryByLabelText('Mês do atalho')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mês inteiro' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Incluir afastamento' }));
    expect(screen.getByLabelText('Início')).toBeInTheDocument();
  });

  it('só os tipos ativos aparecem para lançar', async () => {
    api();
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    const tipo = await screen.findByLabelText('Tipo de afastamento');
    expect(await within(tipo).findByRole('option', { name: 'Férias' })).toBeInTheDocument();
    expect(within(tipo).queryByRole('option', { name: 'Curso' })).toBeNull();
  });

  it('afastamento sobreposto mostra a mensagem da API', async () => {
    api({ 'POST /api/militares/m1/afastamentos': { status: 409, corpo: { erro: 'As datas se sobrepõem a outro período já cadastrado.' } } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    fireEvent.change(await screen.findByLabelText('Início'), { target: { value: '2026-12-05' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-12-08' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('As datas se sobrepõem a outro período já cadastrado.')).toBeInTheDocument();
    expect(screen.getByLabelText('Início')).toBeInTheDocument();
  });

  it('o formulário fecha depois de gravar', async () => {
    api({ 'POST /api/militares/m1/afastamentos': { status: 201, corpo: FICHA } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    fireEvent.change(await screen.findByLabelText('Início'), { target: { value: '2026-12-15' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-12-16' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByLabelText('Início')).toBeNull());
    expect(screen.getByRole('button', { name: 'Incluir afastamento' })).toBeInTheDocument();
  });

  it('cancelar fecha o formulário sem gravar', async () => {
    api();
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Início')).toBeNull();
  });

  it('o histórico de rastreio vem antes do acesso ao sistema, que é o último bloco, e recolhido, com a situação atual; o bloco de lotação antigo não existe mais', async () => {
    api();
    abrir('/militares/m1');
    await screen.findByText('Férias');
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    const pos = (t: string) => titulos.findIndex((x) => x.startsWith(t));
    expect(pos('Motorista')).toBeLessThan(pos('Afastamentos'));
    expect(pos('Afastamentos')).toBeLessThan(pos('Histórico de rastreio'));
    expect(pos('Histórico de rastreio')).toBeLessThan(pos('Acesso ao sistema'));
    expect(pos('Acesso ao sistema')).toBe(titulos.length - 1);
    expect(titulos.some((t) => t.startsWith('Lotação'))).toBe(false);
    const botao = screen.getByRole('button', { name: /Histórico de rastreio/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(botao).getByText('1ª SB · Equipe Alfa · Pronto · QBMG · Ativa (desde 01/11/2026)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar situação' })).toBeNull();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Alterar situação' })).toBeInTheDocument();
    expect(screen.queryByText('Registrar transferência')).toBeNull();
  });
});

describe('alterar situação', () => {
  const SECOES = [{ id: 'u-1sb', sigla: '1ª SB', nome: '1ª Seção de Bombeiros' }, { id: 'u-2sb', sigla: '2ª SB', nome: '2ª Seção de Bombeiros' }];
  const rotas = (extra: Parameters<typeof simularApi>[0] = {}) =>
    api({
      'GET /api/secoes': { status: 200, corpo: SECOES },
      'GET /api/unidades/u-2sb/equipes': { status: 200, corpo: [{ id: 'e-2sb', nome: 'Delta', ordemCiclo: 1 }] },
      'POST /api/militares/m1/situacao': { status: 200, corpo: FICHA },
      ...extra,
    });
  async function abrirODialogo() {
    await userEvent.click(await screen.findByRole('button', { name: /Histórico de rastreio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Alterar situação' }));
    return within(await screen.findByRole('dialog'));
  }

  it('abre com a situação atual, lotação, equipe (da lotação escolhida), jornada e o mês atual; salvar manda os quatro campos e fecha', async () => {
    const f = rotas();
    abrir('/militares/m1');
    const dialogo = await abrirODialogo();
    expect(dialogo.getByLabelText('Lotação')).toHaveValue('u-1sb');
    await waitFor(() => expect(dialogo.getByLabelText('Equipe')).toHaveValue('e-alfa'));
    expect(dialogo.getByLabelText('Jornada')).toHaveValue('pronto');
    expect(dialogo.getByLabelText('A partir de')).toHaveValue(hoje());
    expect(dialogo.getByLabelText('A partir de')).toHaveAttribute('type', 'date');
    expect(dialogo.getByText('A situação atual termina no dia anterior ao escolhido. No mesmo dia do período aberto, ele é substituído.')).toBeInTheDocument();
    await userEvent.selectOptions(dialogo.getByLabelText('Equipe'), 'Bravo');
    await userEvent.selectOptions(dialogo.getByLabelText('Jornada'), 'Adm');
    await userEvent.click(dialogo.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/situacao')).toEqual({ unidadeId: 'u-1sb', equipeId: 'e-bravo', jornada: 'adm', desde: hoje() }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a situação atual é a de hoje: com uma mudança marcada para depois de hoje, vale a anterior', async () => {
    const amanha = new Date(Date.now() + 86_400_000 * 3).toISOString().slice(0, 10);
    const ficha = { ...FICHA, rastreio: [
      { id: 'l2', unidadeSigla: '1ª SB', equipe: 'Bravo', jornada: 'pronto' as const, desde: amanha, quadro: 'QBMG', situacao: 'Ativa', ate: null },
      { id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto' as const, desde: '2026-11-01', quadro: 'QBMG', situacao: 'Ativa', ate: `${amanha.slice(0, 8)}${String(Number(amanha.slice(8)) - 1).padStart(2, '0')}` },
    ] };
    rotas({ 'GET /api/militares/m1': { status: 200, corpo: ficha } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: /Histórico de rastreio/ }));
    expect(screen.getByText('Situação atual: 1ª SB · Equipe Alfa · Pronto · QBMG · Ativa (desde 01/11/2026)')).toBeInTheDocument();
    // a linha do tempo mostra o dia da mudança
    const dia = `${amanha.slice(8)}/${amanha.slice(5, 7)}/${amanha.slice(0, 4)}`;
    expect(screen.getByText(dia)).toBeInTheDocument();
  });

  it('trocar a lotação traz as equipes da nova lotação e zera a equipe', async () => {
    const f = rotas();
    abrir('/militares/m1');
    const dialogo = await abrirODialogo();
    await userEvent.selectOptions(dialogo.getByLabelText('Lotação'), 'u-2sb');
    await waitFor(() => expect(within(dialogo.getByLabelText('Equipe')).getByRole('option', { name: 'Delta' })).toBeInTheDocument());
    expect(within(dialogo.getByLabelText('Equipe')).queryByRole('option', { name: 'Bravo' })).toBeNull();
    expect(dialogo.getByLabelText('Equipe')).toHaveValue('');
    await userEvent.click(dialogo.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/situacao')).toEqual({ unidadeId: 'u-2sb', equipeId: null, jornada: 'pronto', desde: hoje() }));
  });

  it('dois cliques em Salvar mandam um pedido só e o erro da API aparece no diálogo', async () => {
    const { espera, soltar } = trava();
    const f = rotas({ 'POST /api/militares/m1/situacao': { status: 400, corpo: { erro: 'Use o dia do período aberto ou um dia depois.' }, espera } });
    abrir('/militares/m1');
    const dialogo = await abrirODialogo();
    const salvar = dialogo.getByRole('button', { name: 'Salvar' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    expect(salvar).toBeDisabled();
    soltar();
    expect(await dialogo.findByText('Use o dia do período aberto ou um dia depois.')).toBeInTheDocument();
    expect(chamadasA(f, 'POST /api/militares/m1/situacao')).toBe(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('ficha ampliada (fase 5)', () => {
  const PATCH = 'PATCH /api/militares/m1';
  const comFicha = (extra: Partial<FichaMilitar> = {}, rotas: Parameters<typeof simularApi>[0] = {}) =>
    api({ 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, ...extra } }, [PATCH]: { status: 200, corpo: FICHA }, ...rotas });
  const SEM_PECULIO = { podeEditar: { peculio: false, escala: true, unidadeDeCima: '2º GB' } };
  const FRASE = 'Este bloco é alterado por quem tem nível de acesso em 2º GB.';

  it('Identificação: o nome completo e o sexo aparecem e gravam só o que mudou', async () => {
    const f = comFicha();
    abrir('/militares/m1');
    const nome = await screen.findByLabelText('Nome completo');
    expect(nome).toHaveValue('João da Silva Andrade');
    expect(screen.getByLabelText('Sexo')).toHaveValue('M');
    fireEvent.change(nome, { target: { value: 'João Carlos da Silva Andrade' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ nomeCompleto: 'João Carlos da Silva Andrade' }));
    fireEvent.change(screen.getByLabelText('Sexo'), { target: { value: 'F' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ sexo: 'F' }));
  });

  it('Dados pessoais: o nascimento é dia e mês, com o ano opcional, grava junto e limpar manda null; 31 de fevereiro mostra a mensagem sem chamar a API (Review Focus 4)', async () => {
    const f = comFicha();
    abrir('/militares/m1');
    const dia = await screen.findByLabelText('Dia');
    const mes = screen.getByLabelText('Mês');
    expect(dia).toHaveValue(15);
    expect(mes).toHaveValue(3);
    const ano = screen.getByLabelText('Ano');
    expect(ano).toHaveValue(null);
    fireEvent.change(dia, { target: { value: '31' } });
    fireEvent.change(mes, { target: { value: '2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    expect(await screen.findByText('Esse dia não existe nesse mês.')).toBeInTheDocument();
    expect(chamadasA(f, PATCH)).toBe(0);
    fireEvent.change(dia, { target: { value: '29' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ nascimento: { dia: 29, mes: 2 } }));
    // com o ano, 29 de fevereiro só vale em ano bissexto
    const antes = chamadasA(f, PATCH);
    fireEvent.change(ano, { target: { value: '2023' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    expect(await screen.findByText('Esse dia não existe nesse mês.')).toBeInTheDocument();
    expect(chamadasA(f, PATCH)).toBe(antes);
    fireEvent.change(ano, { target: { value: '2024' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ nascimento: { dia: 29, mes: 2, ano: 2024 } }));
    fireEvent.change(ano, { target: { value: '' } });
    fireEvent.change(dia, { target: { value: '' } });
    fireEvent.change(mes, { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados pessoais' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ nascimento: null }));
  });

  it('Contato: telefone e e-mail gravam só o que mudou; e-mail de outro domínio mostra a mensagem do contrato no campo, sem chamar a API (Review Focus 3)', async () => {
    const f = comFicha();
    abrir('/militares/m1');
    const telefone = await screen.findByLabelText('Telefone');
    const email = screen.getByLabelText('E-mail institucional');
    expect(telefone).toHaveValue('(81) 99999-0000');
    expect(email).toHaveValue('andrade@bombeiros.pe.gov.br');
    fireEvent.change(telefone, { target: { value: '(81) 98888-1111' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar contato' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ telefone: '(81) 98888-1111' }));
    fireEvent.change(email, { target: { value: 'andrade@gmail.com' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar contato' }));
    expect(await screen.findByText('Use o e-mail institucional (@bombeiros.pe.gov.br).')).toBeInTheDocument();
    expect(email).toHaveAccessibleDescription('Use o e-mail institucional (@bombeiros.pe.gov.br).');
    expect(chamadasA(f, PATCH)).toBe(1);
  });

  it('Contato: o e-mail de outro militar volta da API como erro no campo', async () => {
    comFicha({}, { [PATCH]: { status: 409, corpo: { erro: 'Este e-mail já é de outro militar.', campos: { email: 'Este e-mail já é de outro militar.' } } } });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('E-mail institucional'), { target: { value: 'outro@bombeiros.pe.gov.br' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar contato' }));
    expect(await screen.findByText('Este e-mail já é de outro militar.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail institucional')).toHaveAccessibleDescription('Este e-mail já é de outro militar.');
  });

  it('Comportamento: grava o comportamento e o boletim; "Sem informação" limpa', async () => {
    const f = comFicha();
    abrir('/militares/m1');
    const comportamento = await screen.findByLabelText('Comportamento');
    expect(comportamento).toHaveValue('Bom');
    expect(screen.getByLabelText('Boletim')).toHaveValue('BG 01/2026');
    fireEvent.change(comportamento, { target: { value: 'Ótimo' } });
    fireEvent.change(screen.getByLabelText('Boletim'), { target: { value: 'BG 09/2026' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar comportamento' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ comportamento: 'Ótimo', comportamentoBoletim: 'BG 09/2026' }));
    fireEvent.change(comportamento, { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar comportamento' }));
    await waitFor(() => expect(corpoEnviado(f, PATCH)).toEqual({ comportamento: null }));
  });

  // [foco 1] escalante só da seção: o Pecúlio é só leitura, com a frase; a escala segue editável
  it('sem papel acima da lotação, os blocos do Pecúlio ficam só para leitura com a frase e os da escala seguem editáveis', async () => {
    comFicha(SEM_PECULIO);
    abrir('/militares/m1');
    await screen.findByLabelText('Nome completo');
    for (const rotulo of ['Posto-graduação', 'Nome completo', 'Nome de guerra', 'Antiguidade', 'Sexo', 'Dia', 'Mês', 'Telefone', 'E-mail institucional', 'Comportamento', 'Boletim']) {
      expect(screen.getByLabelText(rotulo), rotulo).toBeDisabled();
    }
    // Identificação, Dados pessoais, Contato, Comportamento e Afastamentos
    expect(screen.getAllByText(FRASE)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Incluir afastamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull();
    // o que é da escala continua com quem tem papel na seção
    expect(screen.getByLabelText('Voluntário JES')).toBeEnabled();
    expect(screen.getByRole('button', { name: /^D\b/ })).toBeEnabled();
  });

  it('com papel acima da lotação, nenhum bloco mostra a frase e todos os campos são editáveis', async () => {
    comFicha();
    abrir('/militares/m1');
    await screen.findByLabelText('Nome completo');
    expect(screen.queryByText(FRASE)).toBeNull();
    expect(screen.getByLabelText('Telefone')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Incluir afastamento' })).toBeInTheDocument();
  });

  it('"Alterar situação" trava o campo Lotação sem papel acima da lotação, e a equipe e a jornada seguem editáveis', async () => {
    comFicha(SEM_PECULIO, { 'GET /api/secoes': { status: 200, corpo: [{ id: 'u-1sb', sigla: '1ª SB', nome: '1ª Seção de Bombeiros' }] } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: /Histórico de rastreio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Alterar situação' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByLabelText('Lotação')).toBeDisabled();
    expect(dialogo.getByText('A lotação, o quadro e a situação são alterados por quem tem nível de acesso em 2º GB.')).toBeInTheDocument();
    expect(dialogo.getByLabelText('Equipe')).toBeEnabled();
    expect(dialogo.getByLabelText('Jornada')).toBeEnabled();
  });

  it('a pendência "Nome completo em falta" aparece na lista e na ficha', async () => {
    const pendencias = ['Nome completo em falta'];
    comFicha({ pendencias, nomeCompleto: null }, { 'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [linha({ pendencias })] } });
    abrir('/militares/m1');
    expect(await screen.findByText(/Cadastro incompleto: Nome completo em falta\./)).toBeInTheDocument();
    expect((await screen.findAllByLabelText('Cadastro incompleto: Nome completo em falta')).length).toBeGreaterThan(0);
  });

});

describe('afastamento com motivo e boletim (fase 5)', () => {
  const TIPOS = { 'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [{ id: 't-ferias', nome: 'Férias', ativo: true }, { id: 't-lts', nome: 'LTS', ativo: true }] } };
  const POST = 'POST /api/militares/m1/afastamentos';
  const COM_MOTIVO = { afastamentos: [{ id: 'a1', tipo: 'LTS', tipoAfastamentoId: 't-lts', inicio: '2026-12-01', fim: '2026-12-10', motivo: 'Cirurgia programada', boletim: 'BG 12/2026' }] };

  it('a lista do afastamento mostra o motivo e o boletim, quando há', async () => {
    api({ ...TIPOS, 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, ...COM_MOTIVO } } });
    abrir('/militares/m1');
    expect(await screen.findByText('Motivo: Cirurgia programada')).toBeInTheDocument();
    expect(screen.getByText('Boletim: BG 12/2026')).toBeInTheDocument();
  });

  it('incluir LTS com motivo e boletim manda os dois; o campo motivo traz o aviso "Não escreva diagnóstico."', async () => {
    const f = api({ ...TIPOS, [POST]: { status: 201, corpo: { id: 'a9' } } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    await userEvent.selectOptions(screen.getByLabelText('Tipo de afastamento'), 'LTS');
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2027-01-05' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2027-01-09' } });
    const motivo = screen.getByLabelText('Motivo');
    expect(motivo).toHaveAccessibleDescription('Não escreva diagnóstico.');
    // o campo para de aceitar texto no limite do banco: 200 caracteres no motivo e 60 no boletim
    expect(motivo).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('Boletim do afastamento')).toHaveAttribute('maxlength', '60');
    fireEvent.change(motivo, { target: { value: '  Cirurgia programada ' } });
    fireEvent.change(screen.getByLabelText('Boletim do afastamento'), { target: { value: 'BG 01/2027' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ tipoAfastamentoId: 't-lts', inicio: '2027-01-05', fim: '2027-01-09', motivo: 'Cirurgia programada', boletim: 'BG 01/2027' }));
  });

  it('sem motivo e sem boletim, o pedido vai só com o tipo e as datas', async () => {
    const f = api({ ...TIPOS, [POST]: { status: 201, corpo: { id: 'a9' } } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2027-01-05' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2027-01-09' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ tipoAfastamentoId: 't-ferias', inicio: '2027-01-05', fim: '2027-01-09' }));
  });

  it('a linha do tempo do rastreio mostra o tipo do afastamento, nunca o motivo', async () => {
    api({ ...TIPOS, 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, ...COM_MOTIVO } } });
    abrir('/militares/m1');
    const botao = await screen.findByRole('button', { name: /Histórico de rastreio/ });
    await userEvent.click(botao);
    const bloco = within(document.getElementById(botao.getAttribute('aria-controls')!)!);
    expect(bloco.getByText('Afastamento: LTS (01/12 a 10/12)')).toBeInTheDocument();
    expect(bloco.queryByText(/Cirurgia programada/)).toBeNull();
    expect(bloco.queryByText(/BG 12\/2026/)).toBeNull();
  });
});

describe('depois de gravar', () => {
  it('importação busca de novo equipes e fichas abertas', () => {
    const qc = new QueryClient();
    const espiao = vi.spyOn(qc, 'invalidateQueries');
    atualizarMilitares(qc);
    const chaves = espiao.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(chaves).toEqual(expect.arrayContaining([['militares'], ['equipes'], ['militar']]));
  });
});

describe('ficha em painel único', () => {
  it('a ficha do militar é um painel só com o resumo da lotação', async () => {
    const antiga = { ...FICHA, rastreio: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto' as const, desde: '2020-01-01', quadro: 'QBMG', situacao: 'Ativa', ate: null }] };
    api({ 'GET /api/militares/m1': { status: 200, corpo: antiga } });
    abrir('/militares/m1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: /ANDRADE/ })).closest('[data-ficha]') as HTMLElement;
    expect(ficha).not.toBeNull();
    expect(ficha.tagName).toBe('ARTICLE');
    expect(within(ficha).getByText('1ª SB, Pronto (Alfa) desde 01/01/2020', { selector: 'p' })).toBeInTheDocument();
    // os blocos não têm moldura própria: a ficha é um painel só, com linhas entre eles
    expect(ficha.className).toContain('divide-y');
    for (const s of ficha.querySelectorAll('section')) expect(s.className).not.toContain('border');
  });

  it('o item aberto na lista fica marcado', async () => {
    api();
    abrir('/militares/m1');
    const link = (await screen.findAllByText('ANDRADE')).map((e) => e.closest('a')).find(Boolean)!;
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('shadow-[inset_3px_0_0');
  });

  it('bloco recolhido aponta o conteúdo: a situação atual e a linha do tempo com o rastreio e os afastamentos', async () => {
    api();
    abrir('/militares/m1');
    const botao = await screen.findByRole('button', { name: /Histórico de rastreio/ });
    const id = botao.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    await userEvent.click(botao);
    const bloco = within(document.getElementById(id!)!);
    expect(bloco.getByText('Situação atual: 1ª SB · Equipe Alfa · Pronto · QBMG · Ativa (desde 01/11/2026)')).toBeInTheDocument();
    // do mais novo para o mais velho: o afastamento de dezembro, depois a situação de novembro
    const itens = bloco.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain('Afastamento: Férias (01/12 a 10/12)');
    expect(itens[1]).toContain('1ª SB · Equipe Alfa · Pronto');
  });
});

describe('remover, nomes das ações e erros por campo', () => {
  it('remover afastamento pergunta e, confirmando, envia o DELETE', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const f = api({ 'DELETE /api/afastamentos/a1': { status: 204 } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(confirmar).toHaveBeenCalledWith('Remover o afastamento Férias de 01/12/2026 a 10/12/2026?');
    await waitFor(() => expect(f.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true));
    confirmar.mockRestore();
  });

  it('remover afastamento, cancelando a pergunta, não envia', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const f = api({ 'DELETE /api/afastamentos/a1': { status: 204 } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(confirmar).toHaveBeenCalled();
    expect(f.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    confirmar.mockRestore();
  });

  it('o formulário de afastamento salva com Salvar', async () => {
    api();
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gravar' })).toBeNull();
  });

  it('erro do nome de guerra aparece embaixo do campo', async () => {
    api({ 'PATCH /api/militares/m1': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { nomeGuerra: 'Use até 30 letras.', antiguidade: 'Use um número a partir de 1.' } } } });
    abrir('/militares/m1');
    const campo = await screen.findByLabelText('Nome de guerra');
    fireEvent.change(campo, { target: { value: 'ANDRADE JR' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Use até 30 letras.')).toBeInTheDocument();
    expect(screen.getByText('Use um número a partir de 1.')).toBeInTheDocument();
    expect(campo.parentElement).toContainElement(screen.getByText('Use até 30 letras.'));
  });

});

describe('a tela Militares não cadastra mais (o militar novo é do Pecúlio)', () => {
  it('não tem "Novo militar", e a lista vazia diz onde cadastrar', async () => {
    api({ 'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [] } });
    abrir('/militares');
    expect(await screen.findByText('Nenhum militar lotado. O militar novo é cadastrado no Pecúlio.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo militar' })).toBeNull();
  });

  it('a tela Militares não tem mais botão de importar: os dados do militar vêm do Pecúlio (6.13)', async () => {
    api();
    abrir('/militares');
    await screen.findByText('ANDRADE');
    expect(screen.queryByRole('button', { name: /^Importar/ })).toBeNull();
  });
});

describe('aviso de cadastro incompleto', () => {
  it('o resumo no alto filtra os incompletos', async () => {
    api();
    abrir('/militares');
    expect(await screen.findByText('Cadastro incompleto em 1 militar.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver quais' }));
    expect(screen.queryByText('ANDRADE')).toBeNull();
    expect(screen.getByText('BARRETO')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(await screen.findByText('ANDRADE')).toBeInTheDocument();
  });

  it('sem pendência na lista, o resumo não aparece', async () => {
    api({ 'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [LISTA[0]!] } });
    abrir('/militares');
    await screen.findByText('ANDRADE');
    expect(screen.queryByText(/Cadastro incompleto em/)).toBeNull();
  });

  it('o triângulo da pendência é âmbar, não vermelho', async () => {
    api();
    abrir('/militares');
    const icone = await screen.findByLabelText('Cadastro incompleto: Sem antiguidade');
    expect(icone.getAttribute('class')).toContain('text-pendencia');
    expect(icone.getAttribute('class')).not.toContain('text-alerta');
  });

  it('disponível não aparece na linha; afastado aparece', async () => {
    api();
    abrir('/militares');
    const andrade = (await screen.findByText('ANDRADE')).closest('li')!;
    expect(within(andrade).queryByText('Disponível')).toBeNull();
    expect(within((await screen.findByText('BARRETO')).closest('li')!).getByText('Férias até 12/12')).toBeInTheDocument();
  });

  it('Ver quais mostra os nomes da antiguidade repetida', async () => {
    const nomes = ['AMORIM', 'CORDEIRO', 'DUARTE', 'FALCAO', 'HONORIO'];
    api({ 'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, pendencias: ['Antiguidade repetida com 5 militares'], antiguidadeRepetidaCom: nomes } } });
    abrir('/militares/m1');
    expect(await screen.findByText(/Antiguidade repetida com 5 militares/)).toBeInTheDocument();
    expect(screen.queryByText(nomes.join(', ') + '.')).toBeNull();
    const ficha = screen.getByRole('heading', { level: 2, name: /ANDRADE/ }).closest('[data-ficha]') as HTMLElement;
    await userEvent.click(within(ficha).getByRole('button', { name: 'Ver quais' }));
    expect(screen.getByText(nomes.join(', ') + '.')).toBeInTheDocument();
  });
});

describe('revisão final: filtro dos incompletos', () => {
  it('depois de corrigir o último incompleto, o filtro não deixa a lista vazia sem saída', async () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
      'GET /api/postos': { status: 200, corpo: [] },
    };
    simularApi(rotas);
    const router = abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver quais' }));
    expect(screen.queryByText('ANDRADE')).toBeNull();
    // a pessoa corrige o cadastro: a lista volta sem nenhum incompleto
    rotas['GET /api/unidades/u-1sb/militares'] = { status: 200, corpo: LISTA.map((m) => ({ ...m, pendencias: [] })) };
    await act(async () => {
      atualizarMilitares(router.options.context.queryClient);
    });
    expect(await screen.findByText('Nenhum cadastro incompleto.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(await screen.findByText('ANDRADE')).toBeInTheDocument();
  });
});

describe('revisão 3: menores da tela de militares', () => {
  it('campo com erro da API fica marcado como inválido e ligado ao texto do erro', async () => {
    api({ 'PATCH /api/militares/m1': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { nomeGuerra: 'Use até 30 letras.' } } } });
    abrir('/militares/m1');
    const campo = await screen.findByLabelText('Nome de guerra');
    expect(campo).not.toHaveAttribute('aria-invalid');
    fireEvent.change(campo, { target: { value: 'ANDRADE JR' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    const erro = await screen.findByText('Use até 30 letras.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Use até 30 letras.');
    expect(erro).toBeInTheDocument();
  });

  it('Salvar alterações com dois cliques manda um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: FICHA, espera } });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('Nome de guerra'), { target: { value: 'ANDRADE JR' } });
    const salvar = screen.getByRole('button', { name: 'Salvar alterações' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    expect(salvar).toBeDisabled();
    soltar();
    await waitFor(() => expect(chamadasA(f, 'PATCH /api/militares/m1')).toBe(1));
  });
});

describe('identificação grava só o que mudou', () => {
  it('salvar a identificação manda só o campo alterado', async () => {
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: FICHA } });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('Nome de guerra'), { target: { value: 'silva' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ nomeGuerra: 'SILVA' }));
  });

  it('a segunda gravação manda só o que mudou depois da primeira', async () => {
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: FICHA } });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('Nome de guerra'), { target: { value: 'silva' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(chamadasA(f, 'PATCH /api/militares/m1')).toBe(1));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Voluntário JES'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(chamadasA(f, 'PATCH /api/militares/m1')).toBe(2));
    expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ voluntarioJes: true });
  });

  it('mudar e voltar ao original não deixa nada para salvar', async () => {
    const f = api();
    abrir('/militares/m1');
    const campo = await screen.findByLabelText('Nome de guerra');
    const original = (campo as HTMLInputElement).value;
    fireEvent.change(campo, { target: { value: 'OUTRO' } });
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
    fireEvent.change(campo, { target: { value: original } });
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
    expect(chamadasA(f, 'PATCH /api/militares/m1')).toBe(0);
  });

  it('apagar a antiguidade manda null', async () => {
    const f = api({
      'GET /api/militares/m1': { status: 200, corpo: { ...FICHA, antiguidade: 12 } },
      'PATCH /api/militares/m1': { status: 200, corpo: { ...FICHA, antiguidade: null } },
    });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('Antiguidade'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ antiguidade: null }));
  });
});

describe('revisão 3: o aviso de salvo e o afastamento', () => {
  it('"Alterações salvas." continua na tela depois que a ficha volta do servidor com o valor novo', async () => {
    const novo = { ...FICHA, nomeGuerra: 'ANDRADE JR' };
    const f = api({ 'PATCH /api/militares/m1': { status: 200, corpo: novo } });
    abrir('/militares/m1');
    fireEvent.change(await screen.findByLabelText('Nome de guerra'), { target: { value: 'ANDRADE JR' } });
    // a ficha que o servidor devolve depois de gravar já traz o nome novo
    const original = f.getMockImplementation()!;
    f.mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (new URL(url, 'http://localhost').pathname === '/api/militares/m1') return new Response(JSON.stringify(novo), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return original(entrada, init);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
    await new Promise((ok) => setTimeout(ok, 150));
    expect(screen.getByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('Salvar o afastamento com dois cliques manda um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ 'POST /api/militares/m1/afastamentos': { status: 201, corpo: { id: 'a9' }, espera } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Incluir afastamento' }));
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-12-03' } });
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    soltar();
    await waitFor(() => expect(chamadasA(f, 'POST /api/militares/m1/afastamentos')).toBe(1));
  });
});

describe('apagar um militar (6.13)', () => {
  const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] };
  const JUNTO = { alocacoes: 3, afastamentos: 1, periodosDoRastreio: 2, temConta: true, niveisDeAcesso: 1, outros: 4 };
  const comAdmin = (extra: Parameters<typeof simularApi>[0] = {}) =>
    api({ '/api/eu': { status: 200, corpo: ADMIN }, 'GET /api/militares/m1/exclusao': { status: 200, corpo: JUNTO }, 'GET /api/unidades/u-1sb/peculio': { status: 200, corpo: { militares: [], aniversariantes: [] } }, ...extra });

  it('"Apagar militar" só aparece para o administrador, no fim da ficha', async () => {
    api();
    abrir('/militares/m1');
    await screen.findByLabelText('Posto-graduação');
    expect(screen.queryByRole('button', { name: 'Apagar militar' })).toBeNull();
    cleanup();
    comAdmin();
    abrir('/militares/m1');
    const botao = await screen.findByRole('button', { name: 'Apagar militar' });
    const titulos = [...document.querySelectorAll('h3')].map((h) => h.textContent ?? '');
    expect(titulos.at(-1)).toBe('Apagar militar');
    expect(botao).toBeInTheDocument();
  });

  it('o diálogo lista o que vai junto, avisa que não pode ser desfeito e só liga o botão com a matrícula digitada igual', async () => {
    comAdmin();
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar militar' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(await dialogo.findByText('3 alocações')).toBeInTheDocument();
    for (const t of ['1 afastamento', '2 períodos do rastreio', 'a conta de acesso ao sistema', '1 nível de acesso', '4 outros registros']) expect(dialogo.getByText(t)).toBeInTheDocument();
    expect(dialogo.getByText('Isto não pode ser desfeito.')).toBeInTheDocument();
    const confirmar = dialogo.getByRole('button', { name: 'Apagar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(dialogo.getByLabelText('Digite a matrícula para confirmar.'), '990001-0');
    expect(confirmar).toBeDisabled();
    await userEvent.clear(dialogo.getByLabelText('Digite a matrícula para confirmar.'));
    await userEvent.type(dialogo.getByLabelText('Digite a matrícula para confirmar.'), '990001-1');
    expect(confirmar).toBeEnabled();
  });

  it('depois de apagar, volta para a lista do Pecúlio', async () => {
    const f = comAdmin({ 'DELETE /api/militares/m1': { status: 204 } });
    const router = abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar militar' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.type(await dialogo.findByLabelText('Digite a matrícula para confirmar.'), '990001-1');
    await userEvent.click(dialogo.getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(corpoEnviado(f, 'DELETE /api/militares/m1')).toEqual({ matricula: '990001-1' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio'));
  });

  it('o erro da API aparece no diálogo', async () => {
    comAdmin({ 'DELETE /api/militares/m1': { status: 409, corpo: { erro: 'Você não pode apagar o seu próprio cadastro.' } } });
    abrir('/militares/m1');
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar militar' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.type(await dialogo.findByLabelText('Digite a matrícula para confirmar.'), '990001-1');
    await userEvent.click(dialogo.getByRole('button', { name: 'Apagar' }));
    expect(await dialogo.findByRole('alert')).toHaveTextContent('Você não pode apagar o seu próprio cadastro.');
  });
});
