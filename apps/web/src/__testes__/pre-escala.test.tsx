import type { EscalaDoMes, LinhaEscala, PreviaDaPreEscala } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Dados fictícios (D7): a escala do mês vazia e a prévia da pré-escala do Pronto.
const MES = mesAtual();
const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' }];
const ESCALA: EscalaDoMes = { escalaId: 'e1', nome: 'Ordinário', mes: MES, dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } };
const EQUIPES = [{ id: 'q1', nome: 'Alfa' }, { id: 'q2', nome: 'Bravo' }, { id: 'q3', nome: 'Charlie' }, { id: 'q4', nome: 'Delta' }];
const previa = (extra: Partial<PreviaDaPreEscala> = {}): PreviaDaPreEscala => ({
  mes: MES, equipes: EQUIPES, equipeDetectada: { equipeId: 'q2', motivo: '' }, equipeNoMes: null, equipeUsada: { id: 'q2', nome: 'Bravo' }, entramNoTurno: 24, entramNoExpediente: 10,
  removidosQueNaoVoltam: 0, avisos: [], ...extra,
});
const ROTA = `/api/escalas/e1/mes/${MES}/pre-escala`;

function api(p: PreviaDaPreEscala = previa(), extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: ESCALA },
    [`GET ${ROTA}`]: { status: 200, corpo: p },
    ...extra,
  });
}
async function abrirDialogo() {
  abrir('/escala-do-mes');
  await userEvent.click(await screen.findByRole('button', { name: 'Gerar pré-escala' }));
  return screen.findByRole('dialog', { name: 'Gerar pré-escala' });
}

describe('gerar pré-escala', () => {
  it('o botão abre o diálogo com a equipe detectada e o resumo da prévia', async () => {
    api();
    const d = await abrirDialogo();
    expect(await within(d).findByText('Pelo mês anterior, o dia 1 é da equipe Bravo.')).toBeInTheDocument();
    expect(within(d).getByLabelText('Equipe do dia 1')).toHaveValue('q2');
    expect(within(d).getByText('Entram 24 militares no turno do Pronto e 10 no expediente.')).toBeInTheDocument();
    // a pré-escala só põe gente nos turnos: não fala mais de vagas vazias nem de quem ficou sem guarnição (6.40)
    expect(within(d).queryByText(/vaga obrigatória/)).toBeNull();
    expect(within(d).queryByText(/sem guarnição/)).toBeNull();
    expect(within(d).queryByRole('button', { name: 'Ver o que ficou de fora' })).toBeNull();
  });

  it('sem detecção, diz o motivo, pede a escolha e só deixa gravar depois dela (Review Focus 2)', async () => {
    const f = api(previa({ equipeDetectada: { equipeId: null, motivo: 'empate entre ALFA e BRAVO' }, equipeUsada: null, entramNoTurno: 0, entramNoExpediente: 0, avisos: ['Escolha a equipe do dia 1.'] }));
    const d = await abrirDialogo();
    expect(await within(d).findByText('Não deu para saber pelo mês anterior (empate entre ALFA e BRAVO). Escolha a equipe do dia 1.')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Gravar pré-escala' })).toBeDisabled();
    await userEvent.selectOptions(within(d).getByLabelText('Equipe do dia 1'), 'q1');
    expect(within(d).getByRole('button', { name: 'Gravar pré-escala' })).toBeEnabled();
    expect(f).toBeDefined();
  });

  it('trocar a equipe refaz a prévia com ?equipe=', async () => {
    const f = api();
    const d = await abrirDialogo();
    await within(d).findByText('Entram 24 militares no turno do Pronto e 10 no expediente.');
    await userEvent.selectOptions(within(d).getByLabelText('Equipe do dia 1'), 'q3');
    await waitFor(() =>
      expect(f.mock.calls.some(([e]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : e.url).includes(`${ROTA}?equipe=q3`))).toBe(true),
    );
  });

  it('"Gravar pré-escala" manda a equipe, fecha o diálogo e conta os serviços gravados', async () => {
    const f = api(previa(), { [`POST ${ROTA}`]: { status: 201, corpo: { escala: ESCALA, gravadas: 22 } } });
    const d = await abrirDialogo();
    await within(d).findByText('Entram 24 militares no turno do Pronto e 10 no expediente.');
    await userEvent.click(within(d).getByRole('button', { name: 'Gravar pré-escala' }));
    await waitFor(() => expect(corpoEnviado(f, `POST ${ROTA}`)).toEqual({ equipeDia1Id: 'q2' }));
    expect(await screen.findByText('Pré-escala gravada: 22 serviços.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Gerar pré-escala' })).not.toBeInTheDocument());
  });

  it('dois cliques em "Gravar" mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api(previa(), { [`POST ${ROTA}`]: { status: 201, corpo: { escala: ESCALA, gravadas: 22 }, espera } });
    const d = await abrirDialogo();
    await within(d).findByText('Entram 24 militares no turno do Pronto e 10 no expediente.');
    const gravar = within(d).getByRole('button', { name: 'Gravar pré-escala' });
    await userEvent.click(gravar);
    await userEvent.click(gravar);
    soltar();
    await waitFor(() => expect(chamadasA(f, `POST ${ROTA}`)).toBe(1));
  });

  it('o erro da API aparece no diálogo, que fica aberto', async () => {
    api(previa(), { [`POST ${ROTA}`]: { status: 400, corpo: { erro: 'Esta equipe não é do ciclo desta seção.' } } });
    const d = await abrirDialogo();
    await within(d).findByText('Entram 24 militares no turno do Pronto e 10 no expediente.');
    await userEvent.click(within(d).getByRole('button', { name: 'Gravar pré-escala' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Esta equipe não é do ciclo desta seção.');
    expect(screen.getByRole('dialog', { name: 'Gerar pré-escala' })).toBeInTheDocument();
  });

  it('mostra os removidos que não voltam e os avisos da API, entre eles o do expediente sem serviço', async () => {
    api(previa({
      removidosQueNaoVoltam: 2, semExpediente: 'Sem o serviço Expediente na unidade: o expediente não foi gerado.',
      avisos: ['A equipe Charlie não tem militares do Pronto na seção; nenhum serviço foi gerado para os dias dela.', 'Sem o serviço Expediente na unidade: o expediente não foi gerado.'],
    }));
    const d = await abrirDialogo();
    expect(await within(d).findByText('2 removidos não voltam.')).toBeInTheDocument();
    expect(within(d).getByText(/A equipe Charlie não tem militares/)).toBeInTheDocument();
    expect(within(d).getByText('Sem o serviço Expediente na unidade: o expediente não foi gerado.')).toBeInTheDocument();
  });

  it('com o Pronto do mês já gravado, a frase diz a equipe do mês (gerar de novo não troca de equipe)', async () => {
    api(previa({ equipeNoMes: { id: 'q1', nome: 'Alfa' }, equipeUsada: { id: 'q1', nome: 'Alfa' } }));
    const d = await abrirDialogo();
    expect(await within(d).findByText('O Pronto deste mês já começa com a equipe Alfa no dia 1.')).toBeInTheDocument();
    expect(within(d).getByLabelText('Equipe do dia 1')).toHaveValue('q1');
  });

  it('trocar a equipe mantém a seleção e o resumo na tela enquanto a prévia nova carrega (achado da revisão final)', async () => {
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: ESCALA },
      [`GET ${ROTA}`]: { status: 200, corpo: previa() },
    };
    simularApi(rotas);
    const d = await abrirDialogo();
    await within(d).findByText('Entram 24 militares no turno do Pronto e 10 no expediente.');
    rotas[`GET ${ROTA}`] = { status: 200, corpo: previa(), espera: new Promise(() => {}) };
    await userEvent.selectOptions(within(d).getByLabelText('Equipe do dia 1'), 'q3');
    expect(within(d).getByLabelText('Equipe do dia 1')).toHaveValue('q3');
    expect(within(d).getByText('Entram 24 militares no turno do Pronto e 10 no expediente.')).toBeInTheDocument();
    expect(within(d).getByText('Atualizando…')).toBeInTheDocument();
  });
});

