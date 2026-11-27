import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baixarArquivo, enviarArquivo, pedir } from '@/api/cliente';
import { emLaboratorio, entrarNoModo, sairDoModo } from '@/laboratorio/modo';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// 6.59, Task 4: o cartão, a escolha do perfil de teste, a faixa e o prefixo dos pedidos. Dados fictícios (D7).
const PERFIS = [
  { perfilId: 'p-adm', nome: 'Administrador de teste', nivel: 'administrador' },
  { perfilId: 'p-gestor', nome: 'Gestor de teste', nivel: 'gestor' },
  { perfilId: 'p-quinto', nome: 'Quinto nível de teste', nivel: 'gestor_lateral' },
  { perfilId: 'p-aux', nome: 'Auxiliar administrativo de teste', nivel: 'escalante' },
  { perfilId: 'p-mil', nome: 'Militar de teste', nivel: 'militar' },
];
const urlDe = (e: RequestInfo | URL) => (typeof e === 'string' ? e : e instanceof URL ? e.href : e.url);
const chamadas = (f: ReturnType<typeof simularApi>) => f.mock.calls.map(([e, init]) => ({ caminho: new URL(urlDe(e), 'http://localhost').pathname, metodo: (init?.method ?? 'GET').toUpperCase(), cabecalhos: (init?.headers ?? {}) as Record<string, string> }));

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  sairDoModo();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('o modo Laboratório e o prefixo dos pedidos', () => {
  it('fora do modo nenhum pedido leva o prefixo nem o cabeçalho', async () => {
    const f = simularApi({ '/api/militares/1': { status: 200, corpo: {} }, '/api/unidades/u/importacao/peculio': { status: 200, corpo: {} } });
    await pedir('GET', '/api/militares/1');
    await pedir('POST', '/api/unidades/u/importacao/peculio', {});
    await enviarArquivo('/api/unidades/u/importacao/peculio', new File(['x'], 'a.xlsx'));
    for (const c of chamadas(f)) {
      expect(c.caminho.startsWith('/api/lab/'), c.caminho).toBe(false);
      expect(c.cabecalhos['x-laboratorio']).toBeUndefined();
    }
  });

  it('em modo Laboratório todo pedido ao sistema vai para /api/lab/ com o cabeçalho (JSON, envio de arquivo e download)', async () => {
    const f = simularApi({
      '/api/lab/militares/1': { status: 200, corpo: {} },
      '/api/lab/unidades/u/importacao/peculio': { status: 200, corpo: {} },
      '/api/lab/exportacao': { status: 200, corpo: {} },
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    entrarNoModo();
    await pedir('GET', '/api/militares/1');
    await pedir('POST', '/api/unidades/u/importacao/peculio', {});
    await enviarArquivo('/api/unidades/u/importacao/peculio', new File(['x'], 'a.xlsx'));
    await baixarArquivo('/api/exportacao', {}, 'a.xlsx').catch(() => {});
    const feitas = chamadas(f);
    expect(feitas).toHaveLength(4);
    for (const c of feitas) {
      expect(c.caminho.startsWith('/api/lab/'), c.caminho).toBe(true);
      expect(c.cabecalhos['x-laboratorio']).toBe('1');
    }
  });

  it('as rotas do Laboratório no real (/api/laboratorio) e o login (/api/auth) nunca ganham o prefixo, nem em modo Laboratório', async () => {
    const f = simularApi({ '/api/laboratorio/eu': { status: 200, corpo: null }, '/api/auth/get-session': { status: 200, corpo: {} } });
    entrarNoModo();
    await pedir('GET', '/api/laboratorio/eu');
    await pedir('GET', '/api/auth/get-session');
    for (const c of chamadas(f)) {
      expect(c.caminho.startsWith('/api/lab/'), c.caminho).toBe(false);
      expect(c.cabecalhos['x-laboratorio']).toBeUndefined();
    }
  });

  it('o modo vive na aba (sessionStorage), não no navegador: uma aba nova abre no real', () => {
    entrarNoModo();
    expect(emLaboratorio()).toBe(true);
    expect(localStorage.getItem('laboratorio:modo')).toBeNull();
    sessionStorage.clear(); // outra aba: outro sessionStorage
    expect(emLaboratorio()).toBe(false);
  });
});

describe('o cartão, a escolha do perfil e a faixa', () => {
  const rotasDoReal = {
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    '/api/lab/eu': { status: 200, corpo: EU_EXEMPLO },
    '/api/laboratorio/perfis': { status: 200, corpo: PERFIS },
    'PUT /api/laboratorio/perfil': { status: 200, corpo: { perfilId: 'p-gestor', nome: 'Gestor de teste' } },
    'GET /api/laboratorio/eu': { status: 200, corpo: PERFIS[1] },
    'DELETE /api/laboratorio/perfil': { status: 200, corpo: { ok: true } },
  };

  it('a tela inicial tem o cartão com a frase fixa; sem faixa fora do Laboratório', async () => {
    simularApi(rotasDoReal);
    abrir('/');
    const cartao = await screen.findByRole('button', { name: /Laboratório/ });
    expect(cartao).toHaveTextContent('Experimente as ferramentas novas com dados de teste.');
    expect(screen.queryByRole('region', { name: 'Laboratório' })).not.toBeInTheDocument();
  });

  it('escolher o perfil liga o modo, mostra a faixa com o nome e manda os pedidos seguintes para /api/lab/', async () => {
    const f = simularApi(rotasDoReal);
    abrir('/');
    await userEvent.click(await screen.findByRole('button', { name: /Laboratório/ }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getAllByRole('button').map((b) => b.textContent).filter((t) => /teste/.test(t ?? ''))).toEqual(PERFIS.map((p) => p.nome));
    await userEvent.click(within(janela).getByRole('button', { name: 'Gestor de teste' }));
    const faixa = await screen.findByRole('region', { name: 'Laboratório' });
    expect(faixa).toHaveTextContent('Laboratório: dados de teste. Nada aqui vale.');
    expect(await within(faixa).findByRole('button', { name: 'Testando como: Gestor de teste' })).toBeInTheDocument();
    expect(within(faixa).getByRole('button', { name: 'Sair do Laboratório' })).toBeInTheDocument();
    expect(emLaboratorio()).toBe(true);
    expect(chamadas(f).some((c) => c.metodo === 'PUT' && c.caminho === '/api/laboratorio/perfil')).toBe(true);
    // depois de escolher, o sistema fala com o Laboratório: o /eu foi buscado de novo, agora em /api/lab/eu e com o cabeçalho
    await waitFor(() => expect(chamadas(f).some((c) => c.caminho === '/api/lab/eu' && c.cabecalhos['x-laboratorio'] === '1')).toBe(true));
    // e o cartão não aparece dentro do Laboratório
    expect(screen.queryByRole('button', { name: /^Laboratório/ })).not.toBeInTheDocument();
  });

  it('trocar de perfil pela faixa mantém o modo', async () => {
    const f = simularApi({ ...rotasDoReal, 'PUT /api/laboratorio/perfil': { status: 200, corpo: { perfilId: 'p-aux', nome: 'Auxiliar administrativo de teste' } } });
    entrarNoModo();
    abrir('/');
    const faixa = await screen.findByRole('region', { name: 'Laboratório' });
    await userEvent.click(await within(faixa).findByRole('button', { name: /Testando como/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Auxiliar administrativo de teste' }));
    await waitFor(() => expect(chamadas(f).filter((c) => c.metodo === 'PUT')).toHaveLength(1));
    expect(emLaboratorio()).toBe(true);
    expect(await screen.findByRole('region', { name: 'Laboratório' })).toBeInTheDocument();
  });

  it('sair do Laboratório desliga o modo, tira a faixa, busca tudo de novo no real e volta ao cartão', async () => {
    const f = simularApi(rotasDoReal);
    entrarNoModo();
    abrir('/');
    const faixa = await screen.findByRole('region', { name: 'Laboratório' });
    await userEvent.click(within(faixa).getByRole('button', { name: 'Sair do Laboratório' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Laboratório' })).not.toBeInTheDocument());
    expect(emLaboratorio()).toBe(false);
    expect(chamadas(f).some((c) => c.metodo === 'DELETE' && c.caminho === '/api/laboratorio/perfil')).toBe(true);
    expect(await screen.findByRole('button', { name: /Laboratório/ })).toBeInTheDocument();
    // o /eu do real foi pedido depois da saída
    const eus = chamadas(f).filter((c) => c.caminho === '/api/eu');
    expect(eus.length).toBeGreaterThan(0);
    expect(document.documentElement.hasAttribute('data-laboratorio')).toBe(false);
  });

  it('a faixa aparece em toda tela do Laboratório, não só na inicial', async () => {
    simularApi({ ...rotasDoReal, '/api/lab/eu/ficha': { status: 200, corpo: {} } });
    entrarNoModo();
    abrir('/minha-ficha');
    expect(await screen.findByRole('region', { name: 'Laboratório' })).toBeInTheDocument();
    expect(document.documentElement.hasAttribute('data-laboratorio')).toBe(true);
  });

  it('a sessão no Laboratório acabou (outra aba saiu): o modo desliga, a pessoa volta ao real com o aviso', async () => {
    simularApi({ ...rotasDoReal, 'GET /api/laboratorio/eu': { status: 200, corpo: null } });
    entrarNoModo();
    const router = abrir('/');
    expect(await screen.findByText('O Laboratório foi encerrado.')).toBeInTheDocument();
    expect(emLaboratorio()).toBe(false);
    expect(screen.queryByRole('region', { name: 'Laboratório' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('a faixa tem cor e desenho só dela: a classe própria, e as cores vêm dos tokens do laboratório', async () => {
    simularApi(rotasDoReal);
    entrarNoModo();
    abrir('/');
    const faixa = await screen.findByRole('region', { name: 'Laboratório' });
    expect(faixa).toHaveClass('faixa-do-laboratorio', 'sticky', 'top-0');
    expect(faixa.className).not.toMatch(/bg-(pendencia|alerta|vinho|afastado)/);
  });
});

describe('a aba nunca fica presa num Laboratório que o servidor já encerrou', () => {
  const base = { '/api/eu': { status: 200, corpo: EU_EXEMPLO } };

  it('recarregar a aba depois de sair do Laboratório em outra: /api/lab/eu responde 409, a aba volta ao real e diz que o Laboratório foi encerrado', async () => {
    simularApi({ ...base, '/api/lab/eu': { status: 409, corpo: { erro: 'Escolha um perfil de teste.' } } });
    entrarNoModo();
    const router = abrir('/');
    expect(await screen.findByText('O Laboratório foi encerrado.')).toBeInTheDocument();
    expect(emLaboratorio()).toBe(false);
    expect(screen.queryByRole('region', { name: 'Laboratório' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('o espelho em manutenção (503) também devolve a aba ao real, com o aviso, em qualquer tela', async () => {
    simularApi({ ...base, '/api/lab/eu': { status: 503, corpo: { erro: 'O Laboratório está em manutenção.' } }, '/api/eu/ficha': { status: 200, corpo: {} } });
    entrarNoModo();
    const router = abrir('/minha-ficha');
    expect(await screen.findByText('O Laboratório foi encerrado.')).toBeInTheDocument();
    expect(emLaboratorio()).toBe(false);
    expect(router.state.location.pathname).toBe('/');
  });

  it('a sessão da conta acabou dentro do Laboratório (401): o modo desliga e a tela de entrar é a do real', async () => {
    simularApi({ '/api/eu': { status: 401, corpo: { erro: 'Não autenticado' } }, '/api/lab/eu': { status: 401, corpo: { erro: 'Entre no sistema para continuar.' } } });
    entrarNoModo();
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(emLaboratorio()).toBe(false);
  });

  it('com a senha provisória, o Laboratório recusa (403) e a aba volta ao real, que leva à tela de criar a senha', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, trocarSenha: true } }, '/api/lab/eu': { status: 403, corpo: { erro: 'Crie a sua senha para continuar.' } } });
    entrarNoModo();
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/criar-senha'));
    expect(emLaboratorio()).toBe(false);
  });

  it('um pedido que volta 401 no meio do uso (sessão terminou) desliga o modo; o código por e-mail (/api/acesso) é sempre do real', async () => {
    const ir = vi.spyOn(await import('@/api/cliente').then((m) => m.navegador), 'ir').mockImplementation(() => {});
    const f = simularApi({ '/api/lab/qualquer': { status: 401, corpo: { erro: 'Entre no sistema para continuar.' } }, '/api/acesso/codigo': { status: 200, corpo: {} } });
    entrarNoModo();
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(emLaboratorio()).toBe(false);
    expect(ir).toHaveBeenCalled();
    entrarNoModo();
    await pedir('POST', '/api/acesso/codigo', { email: 'a@exemplo.test' });
    expect(chamadas(f).filter((c) => c.caminho === '/api/acesso/codigo').every((c) => !c.cabecalhos['x-laboratorio'])).toBe(true);
  });
});
