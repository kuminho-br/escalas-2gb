import type { AcessoDoMilitar, FichaMilitar } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const FICHA: FichaMilitar = {
  id: 'm1', matricula: '990001-1', posto: 'SD BM', nomeGuerra: 'ANDRADE', equipe: 'Alfa', jornada: 'pronto', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
  podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' },
  postoGradId: 'p-sd', nomeCompleto: 'João da Silva Andrade', sexo: 'M', nascimento: null, telefone: null, email: 'andrade@bombeiros.pe.gov.br', comportamento: null, comportamentoBoletim: null, antiguidade: 3, antiguidadeRepetidaCom: [], noQuadroDeMotoristas: false, cnh: [], cnhPorHierarquia: [],
  rastreio: [{ id: 'l1', unidadeSigla: '1ª SB', equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', ate: null }], afastamentos: [],
};
const ACESSO: AcessoDoMilitar = {
  situacao: 'sem-acesso', email: 'andrade@bombeiros.pe.gov.br', senhaProvisoriaAte: null, papeis: [], podeGerarSenha: true, papeisQuePodeDar: [], unidadesParaPapel: [],
};

function api(acesso: Partial<AcessoDoMilitar> = {}, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/militares/m1': { status: 200, corpo: FICHA },
    'GET /api/militares/m1/acesso': { status: 200, corpo: { ...ACESSO, ...acesso } },
    'GET /api/postos': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
    'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [] },
    ...extra,
  });
}
const bloco = async () => (await screen.findByRole('heading', { name: 'Acesso ao sistema' })).closest('section')!;

describe('Acesso ao sistema', () => {
  it('mostra a situação e gera a senha, que aparece uma vez', async () => {
    const f = api({}, { 'POST /api/militares/m1/senha-provisoria': { status: 201, corpo: { senha: 'k7mq-3tav-p9xe', validaAte: '2026-12-01T15:00:00.000Z' } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Sem acesso')).toBeInTheDocument();
    expect(b.getByText('andrade@bombeiros.pe.gov.br', { exact: false })).toBeInTheDocument();
    await userEvent.click(b.getByRole('button', { name: 'Gerar senha provisória' }));
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText('k7mq-3tav-p9xe')).toBeInTheDocument();
    expect(janela.getByText('Vale até 01/12/2026')).toBeInTheDocument();
    expect(f).toHaveBeenCalled();
    await userEvent.click(janela.getByRole('button', { name: 'Já entreguei' }));
    await waitFor(() => expect(screen.queryByText('k7mq-3tav-p9xe')).toBeNull());
  });

  it('a senha não volta ao reabrir a ficha', async () => {
    api({}, { 'POST /api/militares/m1/senha-provisoria': { status: 201, corpo: { senha: 'k7mq-3tav-p9xe', validaAte: '2026-12-01T15:00:00.000Z' } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Gerar senha provisória' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Já entreguei' }));
    abrir('/militares/m1');
    await screen.findAllByRole('heading', { name: 'Acesso ao sistema' });
    expect(screen.queryByText('k7mq-3tav-p9xe')).toBeNull();
  });

  it('com senha provisória no prazo, mostra até quando vale', async () => {
    api({ situacao: 'provisoria', senhaProvisoriaAte: '2026-12-01T15:00:00.000Z' });
    abrir('/militares/m1');
    expect(await within(await bloco()).findByText('Senha provisória até 01/12/2026')).toBeInTheDocument();
  });

  it('sem e-mail, o botão fica desligado com o aviso', async () => {
    api({ email: null, podeGerarSenha: false });
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Preencha o e-mail institucional para dar acesso.')).toBeInTheDocument();
    expect(b.getByRole('button', { name: 'Gerar senha provisória' })).toBeDisabled();
  });

  it('desativar pede confirmação', async () => {
    const f = api({ situacao: 'ativo' }, { 'POST /api/militares/m1/desativar-acesso': { status: 200, corpo: { ...ACESSO, situacao: 'desativado' } } });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Desativar acesso' }));
    expect(f.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toBe(false);
    await userEvent.click(b.getByRole('button', { name: 'Desativar acesso' }));
    await waitFor(() => expect(f.mock.calls.some(([e, i]) => String(e).endsWith('/desativar-acesso') && (i as RequestInit).method === 'POST')).toBe(true));
    expect(confirmar).toHaveBeenCalledTimes(2);
    confirmar.mockRestore();
  });

  it('lista os papéis com "Auxiliar administrativo" e dá papel', async () => {
    const dada: AcessoDoMilitar = { ...ACESSO, papeis: [{ id: 'p1', papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', desde: '2026-11-01', ate: null }] };
    const f = api(
      { papeis: [{ id: 'p0', papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB', desde: '2026-01-01', ate: '2026-06-30' }], papeisQuePodeDar: ['gestor', 'escalante'], unidadesParaPapel: [{ id: 'u-gb', sigla: '2º GB', nivel: 3 }, { id: 'u-1sb', sigla: '1ª SB', nivel: 4 }] },
      { 'POST /api/militares/m1/papeis': { status: 201, corpo: dada } },
    );
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Gestor')).toBeInTheDocument();
    expect(b.getByText('de 01/01/2026 a 30/06/2026')).toBeInTheDocument();
    await userEvent.click(b.getByRole('button', { name: 'Dar papel' }));
    await userEvent.selectOptions(b.getByLabelText('Papel'), 'Auxiliar administrativo');
    await userEvent.selectOptions(b.getByLabelText('Unidade'), 'u-1sb');
    expect(b.getByLabelText('A partir de')).toBeInTheDocument();
    await userEvent.click(b.getAllByRole('button', { name: 'Dar papel' }).at(-1)!);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/papeis')).toMatchObject({ papel: 'escalante', unidadeId: 'u-1sb' }));
  });

  it('sem papéis para dar, não aparece "Dar papel"', async () => {
    api({ papeisQuePodeDar: [] });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Nenhum papel.');
    expect(b.queryByRole('button', { name: 'Dar papel' })).toBeNull();
  });
});
