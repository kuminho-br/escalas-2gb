import type { FaixaDeDisponibilidade, MeuVoluntariado } from 'contratos';
import { mesPorExtenso, somarMeses } from 'contratos';
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EuDaApi } from '@/api/eu';
import { mesAtual } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Cenário fictício: o militar comum (sem nível de acesso), lotado na 1ª SB, com a coleta de MES aberta.
const MES = somarMeses(mesAtual(), 1);
const UNIDADE = EU_EXEMPLO.unidades[0]!;
const COMUM: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [UNIDADE], lotacao: UNIDADE, coletasAbertas: [MES] };
const BLOCOS = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '24:00' }];
const dia = (n: number, mes = MES) => `${mes}-${String(n).padStart(2, '0')}`;
const faixa = (data: string, inicio: string, fim: string): FaixaDeDisponibilidade => ({ data, inicio, fim });
const meu = (extra: Partial<MeuVoluntariado> = {}, mes = MES): MeuVoluntariado => ({
  militarId: 'm-eu', mes, faixas: [], doMesAnterior: [], blocos: BLOCOS, folgas: null,
  coletaAberta: true, podeMarcar: true, motivo: null, voluntarioJes: true, unidadeSigla: '1ª SB', ...extra,
});
const FECHADA = (mes = MES) => `A coleta de ${mesPorExtenso(mes)} está fechada. Fale com o escalante da sua seção.`;

function api(extra: Parameters<typeof simularApi>[0] = {}, eu: EuDaApi = COMUM, dados: MeuVoluntariado = meu()) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET /api/eu/voluntariado/${MES}`]: { status: 200, corpo: dados },
    ...extra,
  });
}
const calendario = () => screen.getByRole('group', { name: 'Calendário do voluntariado' });
/** A tela carregou: o título vem antes dos dados, e o calendário só depois. */
const carregada = async () => {
  await screen.findByRole('heading', { name: 'Meu voluntariado' });
  await screen.findByRole('group', { name: 'Calendário do voluntariado' });
};
const bloco = (n: number, de: string, ate: string) => within(calendario()).getByRole('button', { name: `Dia ${n}, ${de} às ${ate}` });

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
});

describe('Meu voluntariado (7.2)', () => {
  it('abre no primeiro mês com coleta aberta, diz que está aberta e mostra o calendário com os blocos e o que já foi marcado', async () => {
    api({}, COMUM, meu({ faixas: [faixa(dia(5), '08:00', '16:00')] }));
    abrir('/meu-voluntariado');
    await carregada();
    expect(screen.getByLabelText('Mês')).toHaveValue(MES);
    expect(screen.getByText(`A coleta de ${mesPorExtenso(MES)} está aberta. Marque os dias e horários em que você aceita tirar serviço extra.`)).toBeInTheDocument();
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(5, '00h', '08h')).toHaveAttribute('aria-pressed', 'false');
  });

  it('sem coleta aberta em nenhum mês, abre no mês atual', async () => {
    const mes = mesAtual();
    simularApi({ '/api/eu': { status: 200, corpo: { ...COMUM, coletasAbertas: [] } }, [`GET /api/eu/voluntariado/${mes}`]: { status: 200, corpo: meu({ coletaAberta: false, podeMarcar: false, motivo: FECHADA(mes) }, mes) } });
    abrir('/meu-voluntariado');
    await carregada();
    expect(screen.getByLabelText('Mês')).toHaveValue(mes);
  });

  it('marcar e salvar manda o mês pelo PUT /api/eu/voluntariado e diz que salvou; o botão é só "Salvar"', async () => {
    const f = api({ [`PUT /api/eu/voluntariado/${MES}`]: { status: 200, corpo: meu({ faixas: [faixa(dia(5), '08:00', '16:00')] }) } });
    abrir('/meu-voluntariado');
    await carregada();
    await userEvent.click(bloco(5, '08h', '16h'));
    expect(screen.queryByRole('button', { name: 'Salvar e ir para o próximo' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/eu/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '08:00', '16:00')] }));
    expect(await screen.findByRole('status')).toHaveTextContent(`Voluntariado de ${mesPorExtenso(MES)} salvo.`);
  });

  it('o erro da API aparece e as marcações ficam (por exemplo, a coleta fechou enquanto a pessoa marcava)', async () => {
    api({ [`PUT /api/eu/voluntariado/${MES}`]: { status: 409, corpo: { erro: FECHADA() } } });
    abrir('/meu-voluntariado');
    await carregada();
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FECHADA());
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Review Focus 1: com a coleta fechada, o militar vê o que marcou, tudo desabilitado, com a frase do motivo e sem botão de salvar', async () => {
    api({}, COMUM, meu({ coletaAberta: false, podeMarcar: false, motivo: FECHADA(), faixas: [faixa(dia(5), '08:00', '16:00')] }));
    abrir('/meu-voluntariado');
    await carregada();
    expect(screen.getByText(FECHADA())).toBeInTheDocument();
    expect(screen.queryByText(/está aberta\. Marque/)).toBeNull();
    expect(screen.getByRole('img', { name: 'Dia 5, 08h às 16h: marcado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Salvar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull();
    expect(within(calendario()).queryByRole('button', { name: /^Dia 5, / })).toBeNull();
  });

  it('quem não tem o atributo de voluntário JES lê o aviso (o que marcar vale para diárias)', async () => {
    api({}, COMUM, meu({ voluntarioJes: false }));
    abrir('/meu-voluntariado');
    await carregada();
    expect(screen.getByText('Você não tem o atributo de voluntário JES: o que marcar vale para diárias. Para JES e PJES, fale com quem cuida do seu cadastro.')).toBeInTheDocument();
  });

  it('quem é voluntário JES não vê o aviso', async () => {
    api();
    abrir('/meu-voluntariado');
    await carregada();
    expect(screen.queryByText(/atributo de voluntário JES/)).toBeNull();
  });

  it('outro mês: a seta muda o mês e a tela pede o mês novo', async () => {
    const seguinte = somarMeses(MES, 1);
    const f = api({ [`GET /api/eu/voluntariado/${seguinte}`]: { status: 200, corpo: meu({ coletaAberta: false, podeMarcar: false, motivo: FECHADA(seguinte) }, seguinte) } });
    abrir('/meu-voluntariado');
    await carregada();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes(`/api/eu/voluntariado/${seguinte}`))).toBe(true));
    expect(await screen.findByText(FECHADA(seguinte))).toBeInTheDocument();
  });

  it('o militar comum abre a tela e continua sem ver o módulo de escalas: o endereço do voluntariado do escalante volta ao início', async () => {
    api();
    const router = abrir('/voluntariado');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.getByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
  });

  it('o trilho do módulo tem "Meu voluntariado"', async () => {
    api();
    abrir('/meu-voluntariado');
    await screen.findByRole('heading', { name: 'Meu voluntariado' });
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal' })).getByRole('link', { name: 'Meu voluntariado' })).toBeInTheDocument();
  });
});

describe('o atalho da Visualização na tela inicial (7.2)', () => {
  it('é um link para Minha escala (7.5), e a situação avisa quando há coleta aberta', async () => {
    api();
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    const atalho = screen.getByText('Visualização de escalas').closest('a')!;
    expect(atalho).toHaveAttribute('href', '/minha-escala');
    expect(within(atalho).getByText(/^O voluntariado de .+ está aberto$/)).toBeInTheDocument();
  });

  it('sem coleta aberta, a situação é "Sua escala e o seu voluntariado"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...COMUM, coletasAbertas: [] } } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    const atalho = screen.getByText('Visualização de escalas').closest('a')!;
    expect(within(atalho).getByText('Sua escala e o seu voluntariado')).toBeInTheDocument();
  });
});
