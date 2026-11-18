import type { FichaMilitar, LinhaMilitar } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { atualizarMilitares } from '@/api/militares';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

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
  lotacoes: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', ate: null }],
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

describe('ficha do militar', () => {
  it('categoria pela hierarquia aparece tracejada com "pela D"', async () => {
    api();
    abrir('/militares/m1');
    const c = await screen.findByRole('button', { name: /^C\b/ });
    expect(c).toHaveAttribute('data-origem', 'hierarquia');
    expect(within(c).getByText('pela D')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^D\b/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^A\b/ })).toHaveAttribute('data-origem', 'nenhuma');
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

  it('a lotação vem por último e recolhida, com o resumo', async () => {
    api();
    abrir('/militares/m1');
    await screen.findByText('Férias');
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    const pos = (t: string) => titulos.findIndex((x) => x.startsWith(t));
    expect(pos('Motorista')).toBeLessThan(pos('Afastamentos'));
    expect(pos('Afastamentos')).toBeLessThan(pos('Lotação'));
    expect(pos('Lotação')).toBe(titulos.length - 1);
    const botao = screen.getByRole('button', { name: /Lotação/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(botao).getByText('1ª SB, Pronto (Alfa) desde novembro de 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar transferência' })).toBeNull();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Registrar transferência' })).toBeInTheDocument();
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
    const antiga = { ...FICHA, lotacoes: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto' as const, desde: '2020-01-01', ate: null }] };
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

  it('bloco recolhido aponta o conteúdo', async () => {
    api();
    abrir('/militares/m1');
    const botao = await screen.findByRole('button', { name: /Lotação/ });
    const id = botao.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    await userEvent.click(botao);
    expect(within(document.getElementById(id!)!).getByText('1ª SB, Pronto, equipe Alfa')).toBeInTheDocument();
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
