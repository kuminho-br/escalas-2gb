import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consultaEu } from '@/api/eu';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { hoje } from '@/lib/meses';
import { EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.57, Task 2: o botão "Baixar as linhas com problema" na prévia e no resultado de toda importação que tenha linha com problema ou célula ignorada. Dados fictícios (D7).
const CAMINHO = '/api/unidades/u-1sb/importacao/militares';
const SEM_PROBLEMA = { novos: [{ chave: '990001-1', descricao: 'SD ANDRADE' }], alterados: [], iguais: 0, ignoradas: [], problemas: [], avisos: [] };
const COM_PROBLEMA = { ...SEM_PROBLEMA, problemas: [{ aba: 'MILITARES', linha: 7, mensagem: 'Matrícula inválida: "12-3".', solucao: 'Use 6 dígitos, hífen e 1 dígito.' }] };
const SO_DA_PLANILHA = { ...SEM_PROBLEMA, problemas: [{ aba: 'MILITARES', linha: 1, mensagem: 'Falta a coluna MATRÍCULA.', solucao: 'Use o modelo desta tela.' }] };
const SO_IGNORADA = { ...SEM_PROBLEMA, ignoradas: [{ linha: 3, chave: '990001-1', coluna: 'TELEFONE', motivo: 'Use no máximo 20 caracteres.' }] };

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(consultaEu.queryKey, EU_EXEMPLO);
  render(
    <QueryClientProvider client={queryClient}>
      <ImportarPlanilha cadastro="militares" rotulo="militares" aoConcluir={vi.fn()} />
    </QueryClientProvider>,
  );
}
async function verPrevia() {
  await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
  await userEvent.upload(screen.getByLabelText('Arquivo da planilha (.xlsx)'), new File(['x'], 'sandbox.xlsx'));
  await userEvent.click(screen.getByRole('button', { name: 'Ver o que vai entrar' }));
}
const BOTAO = 'Baixar as linhas com problema';

function api(previa: unknown, resultado: unknown = { ...(previa as object), gravados: 1 }) {
  const f = simularApi({ [`POST ${CAMINHO}`]: { status: 200, corpo: previa } });
  const padrao = f.getMockImplementation()!;
  f.mockImplementation(async (entrada, init) => {
    const url = String(entrada);
    if (url.endsWith(`${CAMINHO}?confirmar=1`)) return new Response(JSON.stringify(resultado), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith(`${CAMINHO}?erros=1`)) return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    return padrao(entrada, init);
  });
  return f;
}

let baixados: string[];
beforeEach(() => {
  baixados = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    baixados.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('o botão "Baixar as linhas com problema"', () => {
  it('na prévia com linha recusada: aparece, reenvia o mesmo arquivo com ?erros=1 e baixa como {cadastro}-linhas-com-problema-{data}.xlsx', async () => {
    const f = api(COM_PROBLEMA);
    montar();
    await verPrevia();
    await userEvent.click(await screen.findByRole('button', { name: BOTAO }));
    await waitFor(() => expect(baixados).toEqual([`militares-linhas-com-problema-${hoje()}.xlsx`]));
    const chamada = f.mock.calls.find(([e]) => String(e).endsWith(`${CAMINHO}?erros=1`))!;
    expect(chamada[1]!.method).toBe('POST');
    expect((chamada[1]!.body as FormData).get('arquivo')).toBeInstanceOf(File);
  });

  it('na prévia só com célula ignorada (nenhuma linha recusada) também aparece', async () => {
    api(SO_IGNORADA);
    montar();
    await verPrevia();
    expect(await screen.findByRole('button', { name: BOTAO })).toBeInTheDocument();
  });

  it('achado da revisão: com só um problema da planilha inteira (coluna que falta, linha 1), não aparece: o arquivo não teria linha nenhuma', async () => {
    api(SO_DA_PLANILHA);
    montar();
    await verPrevia();
    await screen.findByText(/Falta a coluna MATRÍCULA/);
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull();
  });

  it('sem linha com problema nem célula ignorada, não aparece', async () => {
    api(SEM_PROBLEMA);
    montar();
    await verPrevia();
    await screen.findByRole('button', { name: /^Importar 1/ });
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull();
  });

  it('no resultado da importação (depois de importar) também aparece, quando havia linha com problema', async () => {
    api(COM_PROBLEMA);
    montar();
    await verPrevia();
    await userEvent.click(await screen.findByRole('button', { name: /^Importar 1/ }));
    expect(await screen.findByText('1 registros gravados.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: BOTAO }));
    await waitFor(() => expect(baixados).toHaveLength(1));
  });

  it('no resultado sem problema, não aparece', async () => {
    api(SEM_PROBLEMA);
    montar();
    await verPrevia();
    await userEvent.click(await screen.findByRole('button', { name: /^Importar 1/ }));
    await screen.findByText('1 registros gravados.');
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull();
  });

  it('o erro da API (a planilha de erros recusada) aparece na janela e nada baixa', async () => {
    const f = api(COM_PROBLEMA);
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (entrada, init) => (String(entrada).endsWith('?erros=1') ? new Response(JSON.stringify({ erro: 'Nenhuma linha com problema nesta planilha.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) : padrao(entrada, init)));
    montar();
    await verPrevia();
    await userEvent.click(await screen.findByRole('button', { name: BOTAO }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma linha com problema nesta planilha.');
    expect(baixados).toEqual([]);
  });
});
