import { mesPorExtenso, somarMeses, type Cota, type Servico } from 'contratos';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restantesPorServico } from '@/lib/cotas';
import { mesAtual } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const mes = mesAtual();
const anterior = somarMeses(mes, -1);
const cota = (c: Partial<Cota>): Cota => ({
  id: 'c1', mes, servicoId: 'sv-jes', quantidade: 30, origem: 'interna', prioridade: 1, servico: 'JES', cor: '#6E56A8', distribuidas: 12, ...c,
});
const COTAS: Cota[] = [
  cota({}),
  cota({ id: 'c2', servicoId: 'sv-pe', servico: 'PE Seguro', cor: '#3C5F9C', quantidade: 10, origem: 'externa', prioridade: 2, distribuidas: 13 }),
];
const servico = (s: Partial<Servico>): Servico => ({ id: 'x', nome: 'X', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#000000', ativo: true, fixo: false, turnos: [], ...s });
const SERVICOS = [
  servico({ id: 'sv-jes', nome: 'JES', tipo: 'pjes' }),
  servico({ id: 'sv-pe', nome: 'PE Seguro', tipo: 'diaria' }),
  servico({ id: 'sv-pronto', nome: 'Pronto', tipo: 'ordinario' }),
  servico({ id: 'sv-velho', nome: 'Diária antiga', tipo: 'diaria', ativo: false }),
];

function api(extra: Parameters<typeof simularApi>[0] = {}, cotas: Cota[] = COTAS) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: cotas },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: SERVICOS },
    ...extra,
  });
}
const linhaDe = async (nome: string) => (await screen.findByText(nome)).closest('tr')!;

afterEach(() => vi.restoreAllMocks());

describe('cotas', () => {
  it('lista as cotas do mês com serviço, origem e prioridade', async () => {
    api();
    abrir('/cotas');
    const jes = await linhaDe('JES');
    expect(within(jes).getByText('Interna')).toBeInTheDocument();
    expect(within(jes).getByText('1')).toBeInTheDocument();
    const pe = await linhaDe('PE Seguro');
    expect(within(pe).getByText('Externa')).toBeInTheDocument();
    expect(screen.queryByText('não conta para a meta')).toBeNull();
  });

  it('barra de progresso com recebidas e distribuídas', async () => {
    api();
    abrir('/cotas');
    const jes = await linhaDe('JES');
    const barra = within(jes).getByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '12');
    expect(barra).toHaveAttribute('aria-valuemax', '30');
    expect(within(jes).getByText('12 de 30')).toBeInTheDocument();
  });

  it('distribuídas acima da cota enchem a barra e avisam', async () => {
    api();
    abrir('/cotas');
    const pe = await linhaDe('PE Seguro');
    const barra = within(pe).getByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '10');
    expect(barra).toHaveAttribute('aria-valuetext', '13 de 10: passou da cota');
    expect(within(pe).getByText('13 de 10')).toBeInTheDocument();
  });

  it('mês sem cotas mostra o convite para adicionar ou copiar', async () => {
    api({}, []);
    abrir('/cotas');
    expect(await screen.findByText(/Nenhuma cota em/)).toBeInTheDocument();
  });

  it('copiar do mês anterior envia de e para e mostra quantas entraram', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 2, puladas: 0 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/cotas/copiar')).toEqual({ de: anterior, para: mes }));
    expect(await screen.findByText(`2 cotas copiadas de ${mesPorExtenso(anterior)}.`)).toBeInTheDocument();
  });

  it('copiar sem nada novo explica o motivo', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 0, puladas: 0 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    expect(await screen.findByText(`Nenhuma cota nova: ${mesPorExtenso(anterior)} não tem cotas, ou elas já estão em ${mesPorExtenso(mes)}.`)).toBeInTheDocument();
  });

  it('copiar com cota de serviço desativado diz quantas ficaram de fora', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 1, puladas: 1 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    expect(await screen.findByText(`1 cota copiada de ${mesPorExtenso(anterior)}. 1 de serviço desativado ficou de fora.`)).toBeInTheDocument();
  });

  it('com várias de fora o texto vai para o plural', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 2, puladas: 2 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    expect(await screen.findByText(`2 cotas copiadas de ${mesPorExtenso(anterior)}. 2 de serviço desativado ficaram de fora.`)).toBeInTheDocument();
  });

  // o texto vale mesmo quando o mês tem outras cotas que o destino já tinha (copiar uma segunda vez): só diz o que ficou de fora
  it('copiar quando as que faltam são de serviço desativado explica o motivo e o que fazer', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 0, puladas: 2 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    expect(await screen.findByText('Nenhuma cota copiada: 2 de serviço desativado ficaram de fora. Reative o serviço na tela de Serviços para copiá-las.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma cota nova/)).toBeNull();
  });

  it('com uma só de serviço desativado, o texto fica no singular', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas/copiar': { status: 200, corpo: { copiados: 0, puladas: 1 } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar do mês anterior' }));
    expect(await screen.findByText('Nenhuma cota copiada: 1 de serviço desativado ficou de fora. Reative o serviço na tela de Serviços para copiá-la.')).toBeInTheDocument();
  });

  it('adicionar cota envia o mês, o serviço, a quantidade, a origem e a prioridade', async () => {
    const f = api({ 'POST /api/unidades/u-1sb/cotas': { status: 201, corpo: cota({ id: 'c3' }) } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cota' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(await within(dialogo).findByLabelText('Serviço'), { target: { value: 'sv-pe' } });
    await userEvent.type(within(dialogo).getByLabelText('Quantidade'), '8');
    expect(within(dialogo).getByLabelText('Prioridade')).toHaveValue(3); // a seguinte às que já existem
    expect(within(dialogo).queryByLabelText('Conta para a meta de ativação')).toBeNull();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/cotas')).toEqual({ mes, servicoId: 'sv-pe', quantidade: 8, origem: 'interna', prioridade: 3 }),
    );
  });

  it('o serviço da cota só pode ser PJES ou diária, e ativo', async () => {
    api();
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cota' }));
    const opcoes = (await within(await screen.findByRole('dialog')).findAllByRole('option')).map((o) => o.textContent);
    expect(opcoes).toEqual(['JES', 'PE Seguro']);
  });

  it('a mensagem da API aparece no diálogo', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas': { status: 409, corpo: { erro: `Já existe uma cota de JES (interna) em ${mesPorExtenso(mes)}.` } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cota' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Quantidade'), '8');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Já existe uma cota de JES (interna)');
  });

  it('a mensagem do campo que a API recusou aparece no diálogo', async () => {
    api({ 'POST /api/unidades/u-1sb/cotas': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { servicoId: 'Use um serviço cadastrado nesta seção.' } } } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cota' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Quantidade'), '8');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Confira os campos destacados. Use um serviço cadastrado nesta seção.');
  });

  it('editar a cota envia só o que a tela mostra', async () => {
    const f = api({ 'PATCH /api/cotas/c1': { status: 200, corpo: cota({ quantidade: 40 }) } });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar cota de JES (interna)' }));
    const dialogo = await screen.findByRole('dialog');
    const qtd = within(dialogo).getByLabelText('Quantidade');
    expect(qtd).toHaveValue(30);
    await userEvent.clear(qtd);
    await userEvent.type(qtd, '40');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'PATCH /api/cotas/c1')).toEqual({ servicoId: 'sv-jes', quantidade: 40, origem: 'interna', prioridade: 1 }),
    );
  });

  it('remover pergunta antes e apaga a cota', async () => {
    const f = api({ 'DELETE /api/cotas/c1': { status: 204 } });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover cota de JES (interna)' }));
    expect(confirmar).toHaveBeenCalledWith(`Remover a cota de JES (interna) de ${mesPorExtenso(mes)}?`);
    await waitFor(() => expect(f.mock.calls.some(([e, i]) => String(e).includes('/api/cotas/c1') && i?.method === 'DELETE')).toBe(true));
  });

  it('desistir da pergunta não apaga', async () => {
    const f = api();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover cota de JES (interna)' }));
    expect(f.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
  });

  it('trocar o mês busca as cotas do mês escolhido', async () => {
    const f = api();
    abrir('/cotas');
    const campo = await screen.findByLabelText('Mês');
    expect(campo).toHaveValue(mes);
    const outro = somarMeses(mes, 2);
    fireEvent.change(campo, { target: { value: outro } });
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`mes=${outro}`))).toBe(true));
  });

  it('"Mês anterior" e "Próximo mês" trocam o mês e buscam as cotas dele', async () => {
    const f = api();
    abrir('/cotas');
    await screen.findByLabelText('Mês');
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes(`mes=${anterior}`))).toBe(true));
    expect(screen.getByLabelText('Mês')).toHaveValue(anterior);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect(screen.getByLabelText('Mês')).toHaveValue(mes));
  });

  it('em navegador que mostra o campo como texto, digitar um mês pela metade não volta ao mês de antes', async () => {
    api();
    abrir('/cotas');
    const campo = await screen.findByLabelText('Mês');
    // como o Firefox de computador, que não tem o campo de mês e o mostra como texto (o React reaplica type="month" a cada renderização: trava a propriedade)
    campo.setAttribute('type', 'text');
    Object.defineProperty(campo, 'type', { get: () => 'text', set: () => {}, configurable: true });
    fireEvent.change(campo, { target: { value: `${anterior.slice(0, 4)}-0` } });
    expect(campo).toHaveValue(`${anterior.slice(0, 4)}-0`);
    fireEvent.change(campo, { target: { value: anterior } });
    await waitFor(() => expect(campo).toHaveValue(anterior));
  });

  it('a tela traz o botão de importar da planilha', async () => {
    api();
    abrir('/cotas');
    expect(await screen.findByRole('button', { name: /Importar da planilha/ })).toBeInTheDocument();
  });
});

describe('restantesPorServico', () => {
  const jes = (c: Partial<Cota>) => cota({ servicoId: 'sv-jes', servico: 'JES', ...c });

  it('soma a interna e a externa do mesmo serviço numa só', () => {
    const r = restantesPorServico([jes({ id: 'a', quantidade: 30, distribuidas: 5 }), jes({ id: 'b', origem: 'externa', quantidade: 10, distribuidas: 0 })]);
    expect(r).toEqual([{ servicoId: 'sv-jes', servico: 'JES', cor: '#6E56A8', quantidade: 40, usadas: 5 }]);
  });

  it('mantém os serviços na ordem das cotas e filtra pelos serviços pedidos', () => {
    const todas = [jes({ id: 'a' }), cota({ id: 'b', servicoId: 'sv-pe', servico: 'PE Seguro', quantidade: 10, distribuidas: 3 })];
    expect(restantesPorServico(todas).map((r) => r.servico)).toEqual(['JES', 'PE Seguro']);
    expect(restantesPorServico(todas, ['sv-pe']).map((r) => r.servico)).toEqual(['PE Seguro']);
    expect(restantesPorServico(todas, [])).toEqual([]);
  });
});
