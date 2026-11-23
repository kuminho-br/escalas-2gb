import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navegador } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { abrir, EU_EXEMPLO, simularApi, trava } from './apoio';

const CAMINHO = '/api/unidades/u-1sb/importacao/militares';

function montar(aoConcluir = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(consultaEu.queryKey, EU_EXEMPLO);
  render(
    <QueryClientProvider client={queryClient}>
      <ImportarPlanilha cadastro="militares" rotulo="militares" aoConcluir={aoConcluir} />
    </QueryClientProvider>,
  );
  return aoConcluir;
}

async function enviarArquivo() {
  await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
  const arquivo = new File(['x'], 'sandbox.xlsx');
  await userEvent.upload(screen.getByLabelText('Arquivo da planilha (.xlsx)'), arquivo);
  await userEvent.click(screen.getByRole('button', { name: 'Ver o que vai entrar' }));
}

const PREVIA = {
  novos: [{ chave: '990001-1', descricao: 'SD BM ANDRADE' }, { chave: '990002-2', descricao: 'SD BM BARRETO' }],
  alterados: [],
  iguais: 3,
  ignoradas: [],
  problemas: [{ aba: 'MILITARES', linha: 7, mensagem: 'Matrícula inválida: "12-3".', solucao: 'Use 6 dígitos, hífen e 1 dígito.' }],
  avisos: [],
};

describe('o botão se chama só Importar', () => {
  afterEach(() => vi.restoreAllMocks());

  it('o botão que abre a importação é "Importar", e o título da janela continua dizendo o que se importa', async () => {
    montar();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.queryByText(/Importar da planilha/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.getByRole('heading', { name: 'Importar militares da planilha' })).toBeInTheDocument();
  });

  it.each([
    ['/servicos', 'GET /api/unidades/u-1sb/servicos', 'Nenhum serviço. Use "Novo serviço" ou "Importar".'],
    ['/escalas', 'GET /api/unidades/u-1sb/escalas', 'Nenhuma escala. Use "Nova escala" ou "Importar".'],
  ])('a lista vazia de %s manda para o botão "Importar"', async (rota, api, frase) => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [api]: { status: 200, corpo: [] } });
    abrir(rota);
    expect(await screen.findByText(frase)).toBeInTheDocument();
    expect(screen.queryByText(/Importar da planilha/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
  });
});

describe('importar com a sessão terminada e reabrir limpo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('o envio com 401 leva para entrar, com o aviso e o caminho de volta (Review Focus 1)', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/militares');
    simularApi({ [`POST ${CAMINHO}`]: { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    montar();
    await enviarArquivo();
    await vi.waitFor(() => expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fmilitares'));
  });

  it('a confirmação com 401 também leva para entrar', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/cotas');
    const rotas = simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: PREVIA } });
    montar();
    await enviarArquivo();
    const confirmar = await screen.findByRole('button', { name: 'Importar 2, pular 1' });
    expect(ir).not.toHaveBeenCalled();
    // a prévia veio; a sessão termina antes da confirmação
    rotas.mockImplementation(async () => new Response(JSON.stringify({ erro: 'Sessão inválida.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    await userEvent.click(confirmar);
    await vi.waitFor(() => expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fcotas'));
  });

  it('depois de uma importação feita, abrir de novo começa do zero (Review Focus 2)', async () => {
    simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: { ...PREVIA, gravados: 2 } } });
    montar();
    await enviarArquivo();
    await userEvent.click(await screen.findByRole('button', { name: 'Importar 2, pular 1' }));
    await screen.findByText('2 registros gravados.');
    // dois botões se chamam "Fechar" (o do rodapé e o X do diálogo): o do rodapé vem primeiro
    await userEvent.click(screen.getAllByRole('button', { name: 'Fechar' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.queryByText('2 registros gravados.')).toBeNull();
    const campo = screen.getByLabelText('Arquivo da planilha (.xlsx)') as HTMLInputElement;
    expect(campo.files).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Ver o que vai entrar' })).toBeDisabled();
  });

  it('uma resposta que chega depois de fechar o diálogo não aparece na próxima vez que ele abre', async () => {
    const { espera, soltar } = trava();
    simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: PREVIA, espera } });
    montar();
    await enviarArquivo();
    await userEvent.keyboard('{Escape}');
    soltar();
    await new Promise((ok) => setTimeout(ok, 50));
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.queryByRole('button', { name: 'Importar 2, pular 1' })).toBeNull();
    expect(screen.getByLabelText('Arquivo da planilha (.xlsx)')).toBeInTheDocument();
  });
});

describe('importar da planilha', () => {
  it('tem o link Baixar modelo apontando para o modelo do cadastro', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    const link = screen.getByRole('link', { name: 'Baixar modelo' });
    expect(link).toHaveAttribute('href', `${CAMINHO}/modelo`);
    expect(link).toHaveAttribute('download');
  });

  it('o texto manda colar os dados nas abas do modelo', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.getByText(/cole os dados nas abas dele/)).toBeInTheDocument();
  });

  it('mostra a prévia e o botão com as contas', async () => {
    simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: PREVIA } });
    montar();
    await enviarArquivo();
    expect(await screen.findByRole('button', { name: 'Importar 2, pular 1' })).toBeInTheDocument();
    expect(screen.getByText(/Use 6 dígitos, hífen e 1 dígito\./)).toBeInTheDocument();
    expect(screen.getByText('SD BM ANDRADE')).toBeInTheDocument();
  });

  it('confirmar envia confirmar=1', async () => {
    const fetchFalso = simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: { ...PREVIA, gravados: 2 } } });
    const aoConcluir = montar();
    await enviarArquivo();
    await userEvent.click(await screen.findByRole('button', { name: 'Importar 2, pular 1' }));
    expect(await screen.findByText('2 registros gravados.')).toBeInTheDocument();
    const urls = fetchFalso.mock.calls.map((c) => String(c[0]));
    expect(urls.at(-1)).toBe(`${CAMINHO}?confirmar=1`);
    expect(aoConcluir).toHaveBeenCalled();
  });

  it('erro da API aparece no diálogo', async () => {
    simularApi({ [`POST ${CAMINHO}`]: { status: 400, corpo: { erro: 'A planilha não tem a aba "MILITARES".' } } });
    montar();
    await enviarArquivo();
    expect(await screen.findByText('A planilha não tem a aba "MILITARES".')).toBeInTheDocument();
  });

  it('revisão 3: arquivo acima de 4 MB nem é enviado e a tela manda baixar o modelo', async () => {
    const f = simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: PREVIA } });
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    await userEvent.upload(screen.getByLabelText('Arquivo da planilha (.xlsx)'), new File([new Uint8Array(5 * 1024 * 1024)], 'sandbox.xlsx'));
    await userEvent.click(screen.getByRole('button', { name: 'Ver o que vai entrar' }));
    expect(await screen.findByText(/O arquivo é grande demais \(o limite é 4 MB\)\. Baixe o modelo/)).toBeInTheDocument();
    expect(f.mock.calls.some(([e, init]) => (init?.method ?? 'GET') === 'POST')).toBe(false);
  });

  it('revisão 3: 413 sem corpo JSON (recusa da hospedagem) mostra o texto de envio grande, não "Erro inesperado"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      return url.includes('/importacao/') ? new Response('Request Entity Too Large', { status: 413 }) : new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    montar();
    await enviarArquivo();
    expect(await screen.findByText('O envio é grande demais. Confira os dados e tente de novo.')).toBeInTheDocument();
    expect(screen.queryByText(/Erro inesperado/)).toBeNull();
  });
});

/** A prévia vem certa; a confirmação responde `falha` (ou cai a rede), depois de `espera`, se houver. */
function simularConfirmacao(falha: { status: number; corpo?: unknown } | { status: 200; corpo: unknown } | 'rede', espera?: Promise<void>) {
  const f = vi.fn(async (entrada: RequestInfo | URL) => {
    const confirmar = String(entrada).includes('confirmar=1');
    if (confirmar && espera) await espera;
    if (confirmar && falha === 'rede') throw new TypeError('Failed to fetch');
    const r = confirmar && falha !== 'rede' ? falha : { status: 200, corpo: PREVIA };
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const quantasConfirmacoes = (f: ReturnType<typeof simularConfirmacao>) => f.mock.calls.filter(([e]) => String(e).includes('confirmar=1')).length;

async function confirmar() {
  await userEvent.click(await screen.findByRole('button', { name: 'Importar 2, pular 1' }));
}

describe('importar: fechar durante a confirmação (Review Focus 1)', () => {
  it('se a confirmação falha com o diálogo fechado, ao reabrir a mensagem do erro está lá e dá para tentar de novo', async () => {
    const { espera, soltar } = trava();
    simularConfirmacao({ status: 500, corpo: { erro: 'Não foi possível gravar a importação. Nada foi gravado: envie o arquivo de novo.' } }, espera);
    montar();
    await enviarArquivo();
    await confirmar();
    await userEvent.keyboard('{Escape}');
    soltar();
    await new Promise((ok) => setTimeout(ok, 50));
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em alguns minutos.');
    expect(screen.getByRole('button', { name: 'Importar 2, pular 1' })).toBeEnabled();
  });

  it('enquanto a primeira confirmação não acaba, reabrir não deixa mandar uma segunda', async () => {
    const { espera, soltar } = trava();
    const f = simularConfirmacao({ status: 200, corpo: { ...PREVIA, gravados: 2 } }, espera);
    const aoConcluir = montar();
    await enviarArquivo();
    await confirmar();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    const botao = screen.getByRole('button', { name: 'Importar 2, pular 1' });
    expect(botao).toBeDisabled();
    await userEvent.click(botao);
    expect(quantasConfirmacoes(f)).toBe(1);
    soltar();
    // gravou: a lista por trás atualiza e o diálogo reaberto mostra o resultado
    expect(await screen.findByText('2 registros gravados.')).toBeInTheDocument();
    expect(aoConcluir).toHaveBeenCalledTimes(1);
  });
});

describe('importar: o erro da confirmação diz o que fazer', () => {
  it('5xx: tentar de novo em alguns minutos, sem mandar enviar o arquivo de novo', async () => {
    simularConfirmacao({ status: 500, corpo: { erro: 'Não foi possível gravar a importação. Nada foi gravado: envie o arquivo de novo.' } });
    montar();
    await enviarArquivo();
    await confirmar();
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Tente de novo em alguns minutos.');
    expect(aviso).not.toHaveTextContent(/envie o arquivo de novo/i);
  });

  it('sem conexão: tentar de novo em alguns minutos', async () => {
    simularConfirmacao('rede');
    montar();
    await enviarArquivo();
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em alguns minutos.');
  });

  it('4xx sem mensagem da API: conferir a planilha pelo modelo e enviar de novo', async () => {
    simularConfirmacao({ status: 422 });
    montar();
    await enviarArquivo();
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Confira a planilha pelo modelo e envie de novo.');
  });

  it('4xx com mensagem própria da API (409, duas gravações ao mesmo tempo) fica como a API disse', async () => {
    simularConfirmacao({ status: 409, corpo: { erro: 'Outra gravação aconteceu ao mesmo tempo. Envie o arquivo de novo para ver a prévia atualizada.' } });
    montar();
    await enviarArquivo();
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Outra gravação aconteceu ao mesmo tempo. Envie o arquivo de novo para ver a prévia atualizada.');
  });
});
