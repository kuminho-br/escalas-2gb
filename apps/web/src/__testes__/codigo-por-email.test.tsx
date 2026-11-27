import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AVISO_DO_CODIGO, FRASE_DO_PEDIDO, MSG_CODIGO_INVALIDO, MSG_ENVIO_FORA_DO_AR, MSG_MUITOS_PEDIDOS } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO } from './apoio';

// Primeiro acesso e "Esqueci minha senha" (6.68, Task 4): a API é falsa; dados fictícios (D7).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Rota = { status: number; corpo?: unknown };
/** A API do fluxo: o `/api/eu` só vira "logado" depois do login; o resto das rotas da casca responde vazio. */
function apiDoFluxo(rotas: { codigo?: Rota | Rota[]; senha?: Rota; login?: Rota } = {}) {
  let logou = false;
  const filaDoCodigo = Array.isArray(rotas.codigo) ? [...rotas.codigo] : [rotas.codigo ?? { status: 202, corpo: { mensagem: FRASE_DO_PEDIDO } }];
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const caminho = new URL(url, 'http://localhost').pathname;
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const responder = (r: Rota) => new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    if (metodo === 'POST' && caminho === '/api/acesso/codigo') return responder(filaDoCodigo.length > 1 ? filaDoCodigo.shift()! : filaDoCodigo[0]!);
    if (metodo === 'POST' && caminho === '/api/acesso/senha') return responder(rotas.senha ?? { status: 200, corpo: { ok: true } });
    if (metodo === 'POST' && caminho === '/api/auth/sign-in/email') {
      const r = rotas.login ?? { status: 200, corpo: { user: {} } };
      logou = r.status === 200;
      return responder(r);
    }
    if (caminho === '/api/eu') return logou ? responder({ status: 200, corpo: EU_EXEMPLO }) : responder({ status: 401 });
    return responder({ status: 200, corpo: caminho.includes('/grade/') ? { mes: '2026-11', dias: [], grupos: [] } : [] });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}

const EMAIL = 'fulano@bombeiros.pe.gov.br';
const SENHA = 'senha-nova-12345';

async function pedirOCodigo(email = EMAIL) {
  await userEvent.type(await screen.findByLabelText('E-mail institucional'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
}
async function preencherEtapa2(codigo = '048213', senha = SENHA, repita = senha) {
  await userEvent.type(await screen.findByLabelText('Código (6 números)'), codigo);
  await userEvent.type(screen.getByLabelText('Senha nova'), senha);
  await userEvent.type(screen.getByLabelText('Repita a senha nova'), repita);
}

describe('no login', () => {
  it('os links "Primeiro acesso" e "Esqueci minha senha" levam às telas novas', async () => {
    apiDoFluxo();
    const router = abrir('/entrar');
    const primeiro = await screen.findByRole('link', { name: 'Primeiro acesso' });
    expect(primeiro).toHaveAttribute('href', '/primeiro-acesso');
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/esqueci-a-senha');
    await userEvent.click(primeiro);
    await waitFor(() => expect(router.state.location.pathname).toBe('/primeiro-acesso'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Primeiro acesso' })).toBeInTheDocument();
  });
});

describe.each([
  { rota: '/primeiro-acesso', titulo: 'Primeiro acesso' },
  { rota: '/esqueci-a-senha', titulo: 'Esqueci minha senha' },
])('$titulo', ({ rota, titulo }) => {
  it('o fluxo inteiro: e-mail, código e senha nova, entra e vai para o início', async () => {
    const f = apiDoFluxo();
    const router = abrir(rota);
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument();
    await pedirOCodigo();
    expect(corpoEnviado(f, 'POST /api/acesso/codigo')).toEqual({ email: EMAIL });
    await preencherEtapa2();
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(corpoEnviado(f, 'POST /api/acesso/senha')).toEqual({ email: EMAIL, codigo: '048213', novaSenha: SENHA });
    expect(corpoEnviado(f, 'POST /api/auth/sign-in/email')).toMatchObject({ email: EMAIL, password: SENHA });
    expect(await screen.findByText('SD ANDRADE')).toBeInTheDocument();
  });

  it('a etapa 2 mostra a frase da API, igual para qualquer e-mail, e o aviso do spam', async () => {
    apiDoFluxo();
    abrir(rota);
    await pedirOCodigo('quem-quer@bombeiros.pe.gov.br');
    const frase = await screen.findByText(FRASE_DO_PEDIDO);
    expect(frase).not.toHaveTextContent('quem-quer');
    expect(screen.getByText(AVISO_DO_CODIGO)).toBeInTheDocument();
    // o aviso fica à vista enquanto a pessoa preenche (não some ao digitar)
    await preencherEtapa2();
    expect(screen.getByText(AVISO_DO_CODIGO)).toBeInTheDocument();
  });

  it('o foco vai ao e-mail na etapa 1 e ao código na etapa 2', async () => {
    apiDoFluxo();
    abrir(rota);
    expect(await screen.findByLabelText('E-mail institucional')).toHaveFocus();
    await pedirOCodigo();
    await waitFor(() => expect(screen.getByLabelText('Código (6 números)')).toHaveFocus());
  });

  it('429 mostra a frase dos limites e fica na etapa 1', async () => {
    apiDoFluxo({ codigo: { status: 429, corpo: { erro: MSG_MUITOS_PEDIDOS } } });
    abrir(rota);
    await pedirOCodigo();
    expect(await screen.findByRole('alert')).toHaveTextContent(MSG_MUITOS_PEDIDOS);
    expect(screen.queryByLabelText('Código (6 números)')).toBeNull();
    expect(screen.getByLabelText('E-mail institucional')).toHaveValue(EMAIL);
  });

  it('503 manda procurar a Seção de Pessoal', async () => {
    apiDoFluxo({ codigo: { status: 503, corpo: { erro: MSG_ENVIO_FORA_DO_AR } } });
    abrir(rota);
    await pedirOCodigo();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MSG_ENVIO_FORA_DO_AR);
    expect(alerta).toHaveTextContent('Seção de Pessoal');
  });

  it('e-mail malformado: a frase do campo, vinda da API', async () => {
    apiDoFluxo({ codigo: { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { email: 'Digite o e-mail institucional completo.' } } } });
    abrir(rota);
    await pedirOCodigo('isto-nao-e-email');
    expect(await screen.findByText('Digite o e-mail institucional completo.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail institucional')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sem conexão: a frase de sempre, e a pessoa pode tentar de novo', async () => {
    const f = apiDoFluxo();
    f.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    abrir(rota);
    await pedirOCodigo();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor. Tente de novo.');
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeEnabled();
  });

  it('o código inválido mostra a frase no campo do código, mantém o que foi digitado e devolve o foco ao código', async () => {
    apiDoFluxo({ senha: { status: 400, corpo: { erro: MSG_CODIGO_INVALIDO, campos: { codigo: MSG_CODIGO_INVALIDO } } } });
    abrir(rota);
    await pedirOCodigo();
    await preencherEtapa2();
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));
    const campo = screen.getByLabelText('Código (6 números)');
    expect(await screen.findByText(MSG_CODIGO_INVALIDO)).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(campo).toHaveFocus());
    expect(campo).toHaveValue('048213');
    expect(screen.getByLabelText('Senha nova')).toHaveValue(SENHA);
  });

  it('os requisitos marcam enquanto a pessoa digita, e o botão só habilita com todos cumpridos', async () => {
    apiDoFluxo();
    abrir(rota);
    await pedirOCodigo();
    const botao = await screen.findByRole('button', { name: 'Criar senha e entrar' });
    const lista = screen.getByRole('list', { name: 'Requisitos da senha' });
    expect(within(lista).getByText(/Pelo menos 10 caracteres/).closest('li')).toHaveTextContent('falta');
    expect(within(lista).getByText(/As duas senhas iguais/).closest('li')).toHaveTextContent('falta');
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Senha nova'), 'curta');
    expect(within(lista).getByText(/Pelo menos 10 caracteres/).closest('li')).toHaveTextContent('falta');
    await userEvent.clear(screen.getByLabelText('Senha nova'));
    await userEvent.type(screen.getByLabelText('Senha nova'), SENHA);
    expect(within(lista).getByText(/Pelo menos 10 caracteres/).closest('li')).toHaveTextContent('cumprido');
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Repita a senha nova'), 'senha-diferente');
    expect(within(lista).getByText(/As duas senhas iguais/).closest('li')).toHaveTextContent('falta');
    expect(botao).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Repita a senha nova'));
    await userEvent.type(screen.getByLabelText('Repita a senha nova'), SENHA);
    expect(within(lista).getByText(/As duas senhas iguais/).closest('li')).toHaveTextContent('cumprido');
    expect(botao).toBeEnabled();
  });

  it('"Pedir outro código" pede de novo para o mesmo e-mail; "Usar outro e-mail" volta à etapa 1', async () => {
    const f = apiDoFluxo();
    abrir(rota);
    await pedirOCodigo();
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir outro código' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/acesso/codigo')).toBe(2));
    expect(corpoEnviado(f, 'POST /api/acesso/codigo')).toEqual({ email: EMAIL });
    await userEvent.click(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(await screen.findByLabelText('E-mail institucional')).toHaveFocus();
    expect(screen.queryByLabelText('Código (6 números)')).toBeNull();
  });

  it('se o pedido de outro código for recusado, a frase aparece e a etapa 2 continua', async () => {
    apiDoFluxo({ codigo: [{ status: 202, corpo: { mensagem: FRASE_DO_PEDIDO } }, { status: 429, corpo: { erro: MSG_MUITOS_PEDIDOS } }] });
    abrir(rota);
    await pedirOCodigo();
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir outro código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MSG_MUITOS_PEDIDOS);
    expect(screen.getByLabelText('Código (6 números)')).toBeInTheDocument();
  });

  it('a senha foi criada mas o login falhou: diz para entrar com a senha nova, sem perder o caminho', async () => {
    apiDoFluxo({ login: { status: 500, corpo: {} } });
    abrir(rota);
    await pedirOCodigo();
    await preencherEtapa2();
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua senha foi criada. Entre com o e-mail e a senha nova.');
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/entrar');
  });
});
