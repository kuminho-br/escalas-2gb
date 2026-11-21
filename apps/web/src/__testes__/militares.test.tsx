import type { FichaMilitar, LinhaMilitar } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { atualizarMilitares } from '@/api/militares';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

const linha = (l: Partial<LinhaMilitar>): LinhaMilitar => ({
  id: 'm1', matricula: '990001-1', posto: 'SD BM', nomeGuerra: 'ANDRADE', equipe: 'Alfa', jornada: 'pronto', motorista: null,
  voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [], ...l,
});
const LISTA = [
  linha({}),
  linha({ id: 'm2', matricula: '990002-2', nomeGuerra: 'BARRETO', equipe: 'Bravo', situacao: 'Férias até 12/12', pendencias: ['Sem antiguidade'] }),
  linha({ id: 'm3', matricula: '990003-3', nomeGuerra: 'CABRAL', equipe: null, jornada: 'adm', motorista: 'D' }),
];
const FICHA: FichaMilitar = {
  ...linha({ motorista: 'D' }),
  postoGradId: 'p-sd', antiguidade: 3, antiguidadeRepetidaCom: [], noQuadroDeMotoristas: true, cnh: ['D'], cnhPorHierarquia: ['C', 'B'],
  rastreio: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', ate: null }],
  afastamentos: [{ id: 'a1', tipo: 'Férias', tipoAfastamentoId: 't-ferias', inicio: '2026-12-01', fim: '2026-12-10' }],
};

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/militares': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [{ id: 'e-alfa', nome: 'Alfa', ordemCiclo: 1 }, { id: 'e-bravo', nome: 'Bravo', ordemCiclo: 2 }] },
    'GET /api/postos': { status: 200, corpo: [{ id: 'p-sd', sigla: 'SD BM', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB BM', nome: 'Cabo', ordem: 2 }] },
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

  it('novo militar envia a lotação', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/militares': { status: 201, corpo: FICHA } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo militar' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Matrícula'), '990010-0');
    await userEvent.selectOptions(within(dialogo).getByLabelText('Posto ou graduação'), 'CB BM');
    await userEvent.type(within(dialogo).getByLabelText('Nome de guerra'), 'NOVO');
    await userEvent.selectOptions(within(dialogo).getByLabelText('Equipe'), 'Bravo');
    await userEvent.selectOptions(within(dialogo).getByLabelText('Jornada'), 'Adm');
    fireEvent.change(within(dialogo).getByLabelText('Lotado desde'), { target: { value: '2026-12' } });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/militares')).toEqual({
        matricula: '990010-0', postoGradId: 'p-cb', nomeGuerra: 'NOVO', antiguidade: null, motorista: false, cnh: [], voluntarioJes: false,
        lotacao: { equipeId: 'e-bravo', jornada: 'adm', desde: '2026-12' },
      }),
    );
  });
});

describe('listas que não carregam explicam o botão apagado', () => {
  const MSG = 'Não deu para carregar a lista. Recarregue a página.';

  it('postos em 500: a Identificação diz que a lista não carregou, perto do campo Posto', async () => {
    api({ 'GET /api/postos': { status: 500, corpo: { erro: 'Falha.' } } });
    abrir('/militares/m1');
    const campo = await screen.findByLabelText('Posto ou graduação');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(MSG);
  });

  it('postos em 500: o "Novo militar" também', async () => {
    api({ 'GET /api/postos': { status: 500, corpo: { erro: 'Falha.' } } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo militar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(await within(dialogo).findByText(MSG)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Posto ou graduação')).toHaveAccessibleDescription(MSG);
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
    await screen.findByLabelText('Posto ou graduação');
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
    const campo = await screen.findByLabelText('Posto ou graduação');
    await within(campo).findByRole('option', { name: 'SD BM' });
    await buscarDeNovoEFalhar(router, postos, ['postos']);
    expect(within(campo).getByRole('option', { name: 'SD BM' })).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it('postos: o "Novo militar" continua com as opções e sem o aviso', async () => {
    const postos: Rota = { status: 200, corpo: POSTOS };
    api({ 'GET /api/postos': postos });
    const router = abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo militar' }));
    const dialogo = await screen.findByRole('dialog');
    await within(dialogo).findByRole('option', { name: 'CB BM' });
    await buscarDeNovoEFalhar(router, postos, ['postos']);
    expect(within(dialogo).getByRole('option', { name: 'CB BM' })).toBeInTheDocument();
    expect(within(dialogo).queryByText(MSG)).toBeNull();
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
  it('as categorias que a carteira habilita aparecem marcadas, com "pela E"; só a carteira é gravada', async () => {
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
      expect(within(botao).getByText('pela E')).toBeInTheDocument();
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
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/militares/m1')).toEqual({ motorista: true, cnh: ['A', 'E'] }));
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

  it('o histórico de rastreio vem por último e recolhido, com a situação atual; o bloco de lotação antigo não existe mais', async () => {
    api();
    abrir('/militares/m1');
    await screen.findByText('Férias');
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    const pos = (t: string) => titulos.findIndex((x) => x.startsWith(t));
    expect(pos('Motorista')).toBeLessThan(pos('Afastamentos'));
    expect(pos('Afastamentos')).toBeLessThan(pos('Histórico de rastreio'));
    expect(pos('Histórico de rastreio')).toBe(titulos.length - 1);
    expect(titulos.some((t) => t.startsWith('Lotação'))).toBe(false);
    const botao = screen.getByRole('button', { name: /Histórico de rastreio/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(botao).getByText('1ª SB · Equipe Alfa · Pronto (desde 11/2026)')).toBeInTheDocument();
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
    expect(dialogo.getByLabelText('A partir de')).toHaveValue(mesAtual());
    await userEvent.selectOptions(dialogo.getByLabelText('Equipe'), 'Bravo');
    await userEvent.selectOptions(dialogo.getByLabelText('Jornada'), 'Adm');
    await userEvent.click(dialogo.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/situacao')).toEqual({ unidadeId: 'u-1sb', equipeId: 'e-bravo', jornada: 'adm', desde: mesAtual() }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/situacao')).toEqual({ unidadeId: 'u-2sb', equipeId: null, jornada: 'pronto', desde: mesAtual() }));
  });

  it('dois cliques em Salvar mandam um pedido só e o erro da API aparece no diálogo', async () => {
    const { espera, soltar } = trava();
    const f = rotas({ 'POST /api/militares/m1/situacao': { status: 400, corpo: { erro: 'Use o mês do período aberto ou um mês depois.' }, espera } });
    abrir('/militares/m1');
    const dialogo = await abrirODialogo();
    const salvar = dialogo.getByRole('button', { name: 'Salvar' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);
    expect(salvar).toBeDisabled();
    soltar();
    expect(await dialogo.findByText('Use o mês do período aberto ou um mês depois.')).toBeInTheDocument();
    expect(chamadasA(f, 'POST /api/militares/m1/situacao')).toBe(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
    const antiga = { ...FICHA, rastreio: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto' as const, desde: '2020-01-01', ate: null }] };
    api({ 'GET /api/militares/m1': { status: 200, corpo: antiga } });
    abrir('/militares/m1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: /ANDRADE/ })).closest('[data-ficha]') as HTMLElement;
    expect(ficha).not.toBeNull();
    expect(ficha.tagName).toBe('ARTICLE');
    expect(within(ficha).getByText('1ª SB, Pronto (Alfa) desde janeiro de 2020', { selector: 'p' })).toBeInTheDocument();
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
    expect(bloco.getByText('Situação atual: 1ª SB · Equipe Alfa · Pronto (desde 11/2026)')).toBeInTheDocument();
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

  it('novo militar mostra o erro da data de lotação ao lado do campo', async () => {
    api({ 'POST /api/unidades/u-1sb/militares': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { 'lotacao.desde': 'Use um mês válido.', postoGradId: 'Escolha o posto.' } } } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo militar' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Matrícula'), '990010-0');
    await userEvent.type(within(dialogo).getByLabelText('Nome de guerra'), 'NOVO');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    const desde = within(dialogo).getByLabelText('Lotado desde');
    expect(await within(dialogo).findByText('Use um mês válido.')).toBeInTheDocument();
    expect(desde.parentElement).toContainElement(within(dialogo).getByText('Use um mês válido.'));
    expect(within(dialogo).getByLabelText('Posto ou graduação').parentElement).toContainElement(within(dialogo).getByText('Escolha o posto.'));
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
