import type { AcessoDoMilitar, FichaMilitar } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, responderConfirmacao } from './apoio';

const FICHA: FichaMilitar = {
  id: 'm1', matricula: '990001-1', posto: 'SD', quadro: { id: 'q-qbmg', sigla: 'QBMG' }, nomeGuerra: 'ANDRADE', equipe: 'Alfa', jornada: 'pronto', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
  podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' },
  postoGradId: 'p-sd', veDadosRestritos: true, cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, situacaoDoMilitar: { id: 'sit-ativa', nome: 'Ativa', escalavel: true }, nomeCompleto: 'João da Silva Andrade', sexo: 'M', nascimento: null, telefone: null, email: 'andrade@bombeiros.pe.gov.br', comportamento: null, comportamentoBoletim: null, antiguidade: 3, antiguidadeRepetidaCom: [], funcao: null, funcaoMilitarId: null, abonoPermanencia: false, noQuadroDeMotoristas: false, cnh: [], cnhPorHierarquia: [],
  rastreio: [{ id: 'l1', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', alteradoPor: null, alteradoEm: null, equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', quadro: 'QBMG', situacao: 'Ativa', ate: null }], afastamentos: [],
};
const ACESSO: AcessoDoMilitar = {
  situacao: 'sem-acesso', email: 'andrade@bombeiros.pe.gov.br', senhaProvisoriaAte: null, papeis: [], podeGerarSenha: true, podeDesativar: true, papeisQuePodeDar: [], unidadesParaPapel: [],
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
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Desativar acesso' }));
    await responderConfirmacao('Cancelar');
    expect(f.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toBe(false);
    await userEvent.click(b.getByRole('button', { name: 'Desativar acesso' }));
    await responderConfirmacao('Desativar');
    await waitFor(() => expect(f.mock.calls.some(([e, i]) => String(e).endsWith('/desativar-acesso') && (i as RequestInit).method === 'POST')).toBe(true));
  });

  it('lista os níveis de acesso com "Auxiliar administrativo" e dá nível de acesso', async () => {
    const dada: AcessoDoMilitar = { ...ACESSO, papeis: [{ id: 'p1', papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', desde: '2026-11-01', ate: null, podeEncerrar: true, ultimoGestorAte: null }] };
    const f = api(
      { papeis: [{ id: 'p0', papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB', desde: '2026-01-01', ate: '2026-06-30', podeEncerrar: true, ultimoGestorAte: null }], papeisQuePodeDar: ['gestor', 'escalante'], unidadesParaPapel: [{ id: 'u-gb', sigla: '2º GB', nivel: 3, tipo: 'grupamento', maeId: null, maeSigla: 'DInter/1', aceitaLateral: false }, { id: 'u-1sb', sigla: '1ª SB', nivel: 4, tipo: 'secao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }] },
      { 'POST /api/militares/m1/papeis': { status: 201, corpo: dada } },
    );
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Gestor')).toBeInTheDocument();
    expect(b.getByText('de 01/01/2026 a 30/06/2026')).toBeInTheDocument();
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.selectOptions(b.getByLabelText('Nível de acesso'), 'Auxiliar administrativo');
    await userEvent.selectOptions(b.getByLabelText('Unidade'), 'u-1sb');
    expect(b.getByLabelText('A partir de')).toBeInTheDocument();
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/papeis')).toMatchObject({ papel: 'escalante', unidadeId: 'u-1sb' }));
  });

  it('escolher o quinto nível deixa na lista só as unidades que o aceitam, com a unidade de cima quando a sigla se repete (6.25)', async () => {
    const unidades = [
      { id: 'u-gb', sigla: '2º GB', nivel: 3, tipo: 'grupamento', maeId: null, maeSigla: 'DInter/1', aceitaLateral: false }, { id: 'u-1sb', sigla: '1ª SB', nivel: 4, tipo: 'secao', maeId: null, maeSigla: '2º GB', aceitaLateral: true },
      { id: 'u-da', sigla: 'DA', nivel: 4, tipo: 'divisao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }, { id: 'u-divop', sigla: 'DivOp', nivel: 4, tipo: 'divisao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }, { id: 'u-3sb', sigla: '3ª SB', nivel: 5, tipo: 'secao', maeId: null, maeSigla: 'DA', aceitaLateral: true },
      // outro grupamento, com as mesmas siglas de divisão
      { id: 'u-gb9', sigla: '9º GB', nivel: 3, tipo: 'grupamento', maeId: null, maeSigla: 'DInter/9', aceitaLateral: false }, { id: 'u-da9', sigla: 'DA', nivel: 4, tipo: 'divisao', maeId: null, maeSigla: '9º GB', aceitaLateral: true },
    ];
    const f = api(
      { papeis: [{ id: 'p0', papel: 'gestor_lateral', unidadeId: 'u-da', unidadeSigla: 'DA', desde: '2026-11-01', ate: null, podeEncerrar: true, ultimoGestorAte: null }], papeisQuePodeDar: ['gestor', 'gestor_lateral', 'escalante'], unidadesParaPapel: unidades },
      { 'POST /api/militares/m1/papeis': { status: 201, corpo: ACESSO } },
    );
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Coordenador')).toBeInTheDocument();
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    const opcoes = () => within(b.getByLabelText('Unidade')).getAllByRole('option').map((o) => o.textContent?.trim());
    // a sigla que se repete (a "DA" de cada grupamento, sem o recuo da árvore) diz de qual unidade de cima é
    expect(opcoes()).toEqual(['2º GB', '1ª SB', 'DA (2º GB)', 'DivOp', '3ª SB', '9º GB', 'DA (9º GB)']);
    await userEvent.selectOptions(b.getByLabelText('Nível de acesso'), 'Coordenador');
    // o grupamento (onde quem dá está dentro, e não acima) fica de fora; as unidades de qualquer tipo ficam
    expect(opcoes()).toEqual(['1ª SB', 'DA (2º GB)', 'DivOp', '3ª SB', 'DA (9º GB)']);
    expect(b.getByLabelText('Unidade')).toHaveValue('u-1sb');
    await userEvent.selectOptions(b.getByLabelText('Unidade'), 'u-divop');
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/papeis')).toMatchObject({ papel: 'gestor_lateral', unidadeId: 'u-divop' }));
    // de volta a "Gestor", a lista inteira volta
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.selectOptions(b.getByLabelText('Nível de acesso'), 'Coordenador');
    await userEvent.selectOptions(b.getByLabelText('Nível de acesso'), 'Gestor');
    expect(opcoes()).toEqual(['2º GB', '1ª SB', 'DA (2º GB)', 'DivOp', '3ª SB', '9º GB', 'DA (9º GB)']);
  });

  it('o erro de "O nível não existe na unidade raiz." aparece no campo da unidade', async () => {
    const msg = 'O nível não existe na unidade raiz.';
    api(
      { papeisQuePodeDar: ['gestor_lateral'], unidadesParaPapel: [{ id: 'u-da', sigla: 'DA', nivel: 4, tipo: 'divisao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }] },
      { 'POST /api/militares/m1/papeis': { status: 400, corpo: { erro: msg, campos: { unidadeId: msg } } } },
    );
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(b.getByLabelText('Unidade')).toHaveAccessibleDescription(msg));
  });

  it('sem níveis de acesso para dar, não aparece "Dar nível de acesso"', async () => {
    api({ papeisQuePodeDar: [] });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Nenhum nível de acesso.');
    expect(b.queryByRole('button', { name: 'Dar nível de acesso' })).toBeNull();
  });
});

describe('um formulário por vez no Acesso ao sistema', () => {
  const DOIS: Partial<AcessoDoMilitar> = {
    papeis: [
      { id: 'p1', papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', desde: '2026-11-01', ate: null, podeEncerrar: true, ultimoGestorAte: null },
      { id: 'p2', papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB', desde: '2026-10-01', ate: null, podeEncerrar: true, ultimoGestorAte: null },
    ],
    papeisQuePodeDar: ['gestor', 'escalante'],
    unidadesParaPapel: [{ id: 'u-gb', sigla: '2º GB', nivel: 3, tipo: 'grupamento', maeId: null, maeSigla: 'DInter/1', aceitaLateral: false }, { id: 'u-1sb', sigla: '1ª SB', nivel: 4, tipo: 'secao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }],
  };
  const encerrar = (b: { getAllByRole: (papel: 'button', o: { name: string }) => HTMLElement[] }) => b.getAllByRole('button', { name: 'Encerrar' }) as HTMLButtonElement[];

  it('abrir "Dar nível de acesso" desliga os "Encerrar"', async () => {
    api(DOIS);
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    expect(encerrar(b).every((x) => !x.disabled)).toBe(true);
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    expect(encerrar(b)).toHaveLength(2);
    expect(encerrar(b).every((x) => x.disabled)).toBe(true);
  });

  it('abrir um "Encerrar" desliga "Dar nível de acesso" e os outros "Encerrar"', async () => {
    api(DOIS);
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(encerrar(b)[0]!);
    expect(b.getByLabelText('Encerrar em')).toBeInTheDocument();
    expect(b.getByRole('button', { name: 'Dar nível de acesso' })).toBeDisabled();
    expect(encerrar(b)).toHaveLength(1);
    expect(encerrar(b)[0]).toBeDisabled();
  });

  it('"Cancelar" libera tudo', async () => {
    api(DOIS);
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(encerrar(b)[0]!);
    await userEvent.click(b.getByRole('button', { name: 'Cancelar' }));
    expect(b.getByRole('button', { name: 'Dar nível de acesso' })).toBeEnabled();
    expect(encerrar(b).every((x) => x.disabled === false)).toBe(true);
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.click(b.getByRole('button', { name: 'Cancelar' }));
    expect(encerrar(b).every((x) => x.disabled === false)).toBe(true);
  });

  it('um erro da API mantém o formulário de dar aberto, com a mensagem, e não libera os "Encerrar"', async () => {
    api(DOIS, { 'POST /api/militares/m1/papeis': { status: 409, corpo: { erro: 'Este nível de acesso já existe.' } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    expect(await b.findByText('Este nível de acesso já existe.')).toBeInTheDocument();
    expect(b.getByLabelText('A partir de')).toBeInTheDocument();
    expect(encerrar(b).every((x) => x.disabled)).toBe(true);
  });

  it('o formulário de dar abre limpo: o "Até" e o nível do anterior não ficam', async () => {
    const dada: AcessoDoMilitar = { ...ACESSO, ...DOIS, papeis: [] };
    api(DOIS, { 'POST /api/militares/m1/papeis': { status: 201, corpo: dada } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    fireEvent.change(b.getByLabelText('Até (opcional)'), { target: { value: '2026-12-31' } });
    await userEvent.selectOptions(b.getByLabelText('Nível de acesso'), 'Auxiliar administrativo');
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(b.queryByLabelText('A partir de')).toBeNull());
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    expect(b.getByLabelText('Até (opcional)')).toHaveValue('');
    expect(b.getByLabelText('Nível de acesso')).toHaveDisplayValue('Gestor');
    // fechar sem dar também limpa
    fireEvent.change(b.getByLabelText('Até (opcional)'), { target: { value: '2026-12-31' } });
    await userEvent.click(b.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    expect(b.getByLabelText('Até (opcional)')).toHaveValue('');
  });

  it('o erro de um formulário não sobra depois do "Cancelar" nem aparece no outro', async () => {
    api(DOIS, { 'POST /api/papeis/p1/encerrar': { status: 400, corpo: { erro: 'O encerramento não pode ser antes do início do nível de acesso.', campos: { ate: 'O encerramento não pode ser antes do início do nível de acesso.' } } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(encerrar(b)[0]!);
    await userEvent.click(b.getByRole('button', { name: 'Confirmar encerramento' }));
    expect(await b.findAllByText(/O encerramento não pode ser antes do início/)).not.toHaveLength(0);
    await userEvent.click(b.getByRole('button', { name: 'Cancelar' }));
    expect(b.queryByText(/O encerramento não pode ser antes do início/)).toBeNull();
    await userEvent.click(b.getByRole('button', { name: 'Dar nível de acesso' }));
    expect(b.queryByText(/O encerramento não pode ser antes do início/)).toBeNull();
  });

  it('um erro ao encerrar mantém o formulário de encerrar aberto', async () => {
    api(DOIS, { 'POST /api/papeis/p1/encerrar': { status: 409, corpo: { erro: 'Este nível de acesso já foi encerrado.' } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    await userEvent.click(encerrar(b)[0]!);
    await userEvent.click(b.getByRole('button', { name: 'Confirmar encerramento' }));
    expect(await b.findByText('Este nível de acesso já foi encerrado.')).toBeInTheDocument();
    expect(b.getByLabelText('Encerrar em')).toBeInTheDocument();
  });
});

describe('o "até" ao dar o nível de acesso (6.8)', () => {
  const PODE: Partial<AcessoDoMilitar> = { papeisQuePodeDar: ['escalante'], unidadesParaPapel: [{ id: 'u-1sb', sigla: '1ª SB', nivel: 4, tipo: 'secao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }] };
  const dada: AcessoDoMilitar = { ...ACESSO, papeis: [{ id: 'p1', papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', desde: '2026-11-01', ate: '2026-12-31', podeEncerrar: true, ultimoGestorAte: null }] };

  it('o campo "Até (opcional)" fica ao lado de "A partir de", e preenchido vai no corpo', async () => {
    const f = api(PODE, { 'POST /api/militares/m1/papeis': { status: 201, corpo: dada } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    expect(b.getByLabelText('A partir de')).toBeInTheDocument();
    expect(b.getByLabelText('Até (opcional)')).toHaveValue('');
    fireEvent.change(b.getByLabelText('Até (opcional)'), { target: { value: '2026-12-31' } });
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/militares/m1/papeis')).toMatchObject({ papel: 'escalante', unidadeId: 'u-1sb', ate: '2026-12-31' }));
  });

  it('sem "até", o corpo não leva o campo', async () => {
    const f = api(PODE, { 'POST /api/militares/m1/papeis': { status: 201, corpo: dada } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(chamadasA(f, 'POST /api/militares/m1/papeis')).toBe(1));
    expect(corpoEnviado(f, 'POST /api/militares/m1/papeis')).not.toHaveProperty('ate');
  });

  it('o erro do fim aparece ao lado do campo', async () => {
    api(PODE, { 'POST /api/militares/m1/papeis': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { ate: 'O fim não pode ser antes do início.' } } } });
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    fireEvent.change(b.getByLabelText('Até (opcional)'), { target: { value: '2020-01-01' } });
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    const campo = b.getByLabelText('Até (opcional)');
    expect(await b.findByText('O fim não pode ser antes do início.')).toBeInTheDocument();
    expect(campo.parentElement).toContainElement(b.getByText('O fim não pode ser antes do início.'));
  });
});


describe('Acesso ao sistema: acabamento (6.16)', () => {
  const nivel = (extra: Partial<AcessoDoMilitar['papeis'][number]> = {}): AcessoDoMilitar['papeis'][number] => ({
    id: 'p1', papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', desde: '2026-01-01', ate: null, podeEncerrar: true, ultimoGestorAte: null, ...extra,
  });

  it('item 1: "Encerrar" só aparece no nível que quem olha pode encerrar (a API diz, por nível)', async () => {
    api({ papeis: [nivel({ id: 'p1', podeEncerrar: false }), nivel({ id: 'p2', papel: 'gestor', unidadeSigla: '2º GB', podeEncerrar: true })], papeisQuePodeDar: ['escalante', 'gestor'] });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Gestor');
    // só o do gestor tem o botão, mesmo que o nível de auxiliar esteja entre os que a pessoa sabe dar
    expect(b.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1);
    expect(b.getByText('Gestor').closest('li')!).toContainElement(b.getByRole('button', { name: 'Encerrar' }));
  });

  it('item 2: sem poder desativar, o botão "Desativar acesso" não aparece', async () => {
    api({ situacao: 'ativo', podeDesativar: false });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('Ativo');
    expect(b.queryByRole('button', { name: 'Desativar acesso' })).toBeNull();
  });

  it('item 11: um nível com "até" no futuro ainda tem "Encerrar"; um que já terminou, não', async () => {
    api({ papeis: [nivel({ id: 'p1', ate: '2999-12-31' }), nivel({ id: 'p2', desde: '2020-01-01', ate: '2021-01-01' })] });
    abrir('/militares/m1');
    const b = within(await bloco());
    await b.findByText('de 01/01/2026 a 31/12/2999');
    expect(b.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1);
  });

  it('item 12: o último gestor com "até" marcado mostra o aviso, que não bloqueia nada', async () => {
    api({ papeis: [nivel({ papel: 'gestor', unidadeSigla: '1ª SB', ate: '2999-12-31', ultimoGestorAte: '2999-12-31' })], papeisQuePodeDar: ['gestor'] });
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByText('Último gestor de 1ª SB: o nível termina em 31/12/2999.')).toBeInTheDocument();
    expect(b.getByRole('button', { name: 'Encerrar' })).toBeEnabled();
  });

  it('item 8: dar ou encerrar um nível atualiza o seletor de unidade (o /api/eu é pedido de novo, sem recarregar a página)', async () => {
    const f = api({ papeis: [nivel()], papeisQuePodeDar: ['escalante'], unidadesParaPapel: [{ id: 'u-1sb', sigla: '1ª SB', nivel: 4, tipo: 'secao', maeId: null, maeSigla: '2º GB', aceitaLateral: true }] }, {
      'POST /api/militares/m1/papeis': { status: 201, corpo: ACESSO },
      'POST /api/papeis/p1/encerrar': { status: 200, corpo: ACESSO },
    });
    abrir('/militares/m1');
    const b = within(await bloco());
    await userEvent.click(await b.findByRole('button', { name: 'Encerrar' }));
    const antes = chamadasA(f, 'GET /api/eu');
    await userEvent.click(b.getByRole('button', { name: 'Confirmar encerramento' }));
    await waitFor(() => expect(chamadasA(f, 'GET /api/eu')).toBeGreaterThan(antes));
    const depoisDeEncerrar = chamadasA(f, 'GET /api/eu');
    await userEvent.click(await b.findByRole('button', { name: 'Dar nível de acesso' }));
    await userEvent.click(b.getAllByRole('button', { name: 'Dar nível de acesso' }).at(-1)!);
    await waitFor(() => expect(chamadasA(f, 'GET /api/eu')).toBeGreaterThan(depoisDeEncerrar));
  });
});

describe('Acesso ao sistema para o auxiliar (6.32)', () => {
  it('o auxiliar só gera a senha: sem "Desativar acesso" e sem "Dar nível de acesso", mesmo com a conta ativa', async () => {
    api({ situacao: 'ativo', podeGerarSenha: true, podeDesativar: false, papeisQuePodeDar: [], papeis: [] });
    abrir('/militares/m1');
    const b = within(await bloco());
    expect(await b.findByRole('button', { name: 'Gerar senha provisória' })).toBeEnabled();
    expect(b.queryByRole('button', { name: 'Desativar acesso' })).toBeNull();
    expect(b.queryByRole('button', { name: 'Dar nível de acesso' })).toBeNull();
  });
});
