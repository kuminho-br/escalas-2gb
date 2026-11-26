import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MinhaFicha } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const FICHA: MinhaFicha = {
  postoGrad: 'SD',
  nomeGuerra: 'ANDRADE',
  nomeCompleto: 'João da Silva Andrade',
  matricula: '990001-1',
  telefone: '(81) 99999-0001',
  emailPessoal: 'andrade.pessoal@exemplo.test',
  email: 'andrade@bombeiros.pe.gov.br',
  sexo: 'M',
  nascimento: { dia: 3, mes: 7 },
  cpf: '52998224725',
  endereco: { cep: '50030230', logradouro: 'Rua Fictícia', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Recife', uf: 'PE' },
  comportamento: 'Bom',
  comportamentoBoletim: 'BG 12/2026',
  situacao: { lotacao: '1ª SB', equipe: 'Alfa', jornada: 'pronto', quadro: 'QBMG', situacaoDoMilitar: 'Ativa' },
  motorista: true,
  cnh: ['D'],
  cnhPorHierarquia: ['B', 'C'],
  voluntarioJes: true,
  funcao: 'Chefe de seção',
  abonoPermanencia: false,
};

const api = (extra: Parameters<typeof simularApi>[0] = {}) =>
  simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } }, 'GET /api/eu/ficha': { status: 200, corpo: FICHA }, ...extra });

describe('Minha ficha', () => {
  it('mostra a função e o abono de permanência, só para leitura (6.15)', async () => {
    api();
    abrir('/minha-ficha');
    const bloco = (await screen.findByRole('heading', { name: 'Identificação' })).closest('section')!;
    expect(within(bloco).getByText('Função').nextSibling).toHaveTextContent('Chefe de seção');
    expect(within(bloco).getByText('Abono de permanência').nextSibling).toHaveTextContent('Não');
  });

  it('mostra os próprios dados só para leitura, menos o telefone', async () => {
    api();
    abrir('/minha-ficha');
    expect(await screen.findByRole('heading', { level: 1, name: 'Minha ficha' })).toBeInTheDocument();
    const principal = within(screen.getByRole('main'));
    for (const texto of ['João da Silva Andrade', '990001-1', 'andrade@bombeiros.pe.gov.br', '03/07', '529.982.247-25', '50030-230', 'Rua Fictícia, 10', 'Recife / PE', 'QBMG', 'Ativa', 'Bom', 'BG 12/2026', '1ª SB', 'Alfa']) expect(principal.getByText(texto)).toBeInTheDocument();
    // o e-mail pessoal aparece só para leitura (6.18, item 23)
    expect(principal.getByText('andrade.pessoal@exemplo.test')).toBeInTheDocument();
    // o telefone é o único campo editável
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByLabelText('Telefone')).toHaveValue('(81) 99999-0001');
  });

  it('salva o telefone', async () => {
    const f = api({ 'PATCH /api/eu/telefone': { status: 200, corpo: { ...FICHA, telefone: '(81) 98888-0000' } } });
    abrir('/minha-ficha');
    const campo = await screen.findByLabelText('Telefone');
    await userEvent.clear(campo);
    await userEvent.type(campo, '81988880000');
    expect(campo).toHaveValue('(81) 98888-0000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/eu/telefone')).toEqual({ telefone: '(81) 98888-0000' }));
    expect(await screen.findByText('Telefone salvo.')).toBeInTheDocument();
  });

  it('apagar o telefone limpa o campo no servidor', async () => {
    const f = api({ 'PATCH /api/eu/telefone': { status: 200, corpo: { ...FICHA, telefone: null } } });
    abrir('/minha-ficha');
    await userEvent.clear(await screen.findByLabelText('Telefone'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/eu/telefone')).toEqual({ telefone: null }));
  });

  it('telefone inválido mostra a mensagem no campo e não grava (Review Focus 3)', async () => {
    const f = api();
    abrir('/minha-ficha');
    const campo = await screen.findByLabelText('Telefone');
    await userEvent.clear(campo);
    await userEvent.type(campo, '8199668');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Use o DDD e o número: 10 ou 11 dígitos.')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(f.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('a mensagem do servidor para o telefone também aparece no campo', async () => {
    api({ 'PATCH /api/eu/telefone': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { telefone: 'Telefone recusado.' } } } });
    abrir('/minha-ficha');
    await userEvent.type(await screen.findByLabelText('Telefone'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await within(await screen.findByRole('main')).findByText('Telefone recusado.')).toBeInTheDocument();
  });
});

describe('Minha ficha: trocar a senha (6.68, Task 5)', () => {
  const SENHA_NOVA = 'senha-trocada-456';
  const abrirTroca = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar senha' }));
    return within(await screen.findByRole('dialog'));
  };
  const preencher = async (janela: ReturnType<typeof within>, atual = 'senha-atual-123456', nova = SENHA_NOVA, repita = nova) => {
    await userEvent.type(janela.getByLabelText('Senha atual'), atual);
    await userEvent.type(janela.getByLabelText('Senha nova'), nova);
    await userEvent.type(janela.getByLabelText('Repita a senha nova'), repita);
  };

  it('o bloco "Senha" tem o botão "Trocar senha", que abre a janela com os três campos e os requisitos', async () => {
    api();
    abrir('/minha-ficha');
    expect(await screen.findByRole('heading', { name: 'Senha' })).toBeInTheDocument();
    const janela = await abrirTroca();
    expect(janela.getByRole('heading', { name: 'Trocar senha' })).toBeInTheDocument();
    for (const campo of ['Senha atual', 'Senha nova', 'Repita a senha nova']) expect(janela.getByLabelText(campo)).toBeInTheDocument();
    expect(janela.getByRole('list', { name: 'Requisitos da senha' })).toBeInTheDocument();
    expect(janela.getByLabelText('Senha atual')).toHaveFocus();
  });

  it('os requisitos marcam enquanto digita, e "Trocar senha" só habilita com eles cumpridos e a senha atual preenchida', async () => {
    api();
    abrir('/minha-ficha');
    const janela = await abrirTroca();
    const enviar = janela.getByRole('button', { name: 'Trocar senha' });
    expect(enviar).toBeDisabled();
    await userEvent.type(janela.getByLabelText('Senha atual'), 'senha-atual-123456');
    await userEvent.type(janela.getByLabelText('Senha nova'), 'curta');
    await userEvent.type(janela.getByLabelText('Repita a senha nova'), 'curta');
    expect(janela.getByText(/Pelo menos 10 caracteres/).closest('li')).toHaveTextContent('falta');
    expect(janela.getByText(/As duas senhas iguais/).closest('li')).toHaveTextContent('cumprido');
    expect(enviar).toBeDisabled();
    await userEvent.clear(janela.getByLabelText('Senha nova'));
    await userEvent.clear(janela.getByLabelText('Repita a senha nova'));
    await userEvent.type(janela.getByLabelText('Senha nova'), SENHA_NOVA);
    await userEvent.type(janela.getByLabelText('Repita a senha nova'), SENHA_NOVA);
    expect(janela.getByText(/Pelo menos 10 caracteres/).closest('li')).toHaveTextContent('cumprido');
    expect(enviar).toBeEnabled();
  });

  it('sucesso: chama a troca do better-auth com as outras sessões revogadas, fecha a janela e avisa', async () => {
    const f = api({ 'POST /api/auth/change-password': { status: 200, corpo: { status: true } } });
    abrir('/minha-ficha');
    const janela = await abrirTroca();
    await preencher(janela);
    await userEvent.click(janela.getByRole('button', { name: 'Trocar senha' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(corpoEnviado(f, 'POST /api/auth/change-password')).toEqual({ currentPassword: 'senha-atual-123456', newPassword: SENHA_NOVA, revokeOtherSessions: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Senha trocada. As outras sessões abertas foram encerradas.');
  });

  it('senha atual errada: "A senha atual não confere." no campo, e a janela fica aberta com o que foi digitado', async () => {
    api({ 'POST /api/auth/change-password': { status: 400, corpo: { message: 'Invalid password', code: 'INVALID_PASSWORD' } } });
    abrir('/minha-ficha');
    const janela = await abrirTroca();
    await preencher(janela);
    await userEvent.click(janela.getByRole('button', { name: 'Trocar senha' }));
    expect(await janela.findByText('A senha atual não confere.')).toBeInTheDocument();
    expect(janela.getByLabelText('Senha atual')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(janela.getByLabelText('Senha atual')).toHaveFocus());
    expect(janela.getByLabelText('Senha nova')).toHaveValue(SENHA_NOVA);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('outra falha (rede, servidor): a frase na janela, sem fechar', async () => {
    api({ 'POST /api/auth/change-password': { status: 500, corpo: {} } });
    abrir('/minha-ficha');
    const janela = await abrirTroca();
    await preencher(janela);
    await userEvent.click(janela.getByRole('button', { name: 'Trocar senha' }));
    expect(await janela.findByRole('alert')).toHaveTextContent('Não foi possível trocar a senha. Tente de novo.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
