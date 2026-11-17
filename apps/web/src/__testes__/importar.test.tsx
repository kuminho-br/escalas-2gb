import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { consultaEu } from '@/api/eu';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { EU_EXEMPLO, simularApi } from './apoio';

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
  await userEvent.click(screen.getByRole('button', { name: 'Importar da planilha' }));
  const arquivo = new File(['x'], 'sandbox.xlsx');
  await userEvent.upload(screen.getByLabelText('Arquivo da planilha (.xlsx)'), arquivo);
  await userEvent.click(screen.getByRole('button', { name: 'Ver o que vai entrar' }));
}

const PREVIA = {
  novos: [{ chave: '990001-1', descricao: 'SD BM ANDRADE' }, { chave: '990002-2', descricao: 'SD BM BARRETO' }],
  alterados: [],
  iguais: 3,
  problemas: [{ aba: 'MILITARES', linha: 7, mensagem: 'Matrícula inválida: "12-3".', solucao: 'Use 6 dígitos, hífen e 1 dígito.' }],
  avisos: [],
};

describe('importar da planilha', () => {
  it('tem o link Baixar modelo apontando para o modelo do cadastro', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Importar da planilha' }));
    const link = screen.getByRole('link', { name: 'Baixar modelo' });
    expect(link).toHaveAttribute('href', `${CAMINHO}/modelo`);
    expect(link).toHaveAttribute('download');
  });

  it('o texto manda colar os dados nas abas do modelo', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Importar da planilha' }));
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
});
