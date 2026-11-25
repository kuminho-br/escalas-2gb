import type { FaixaDeDisponibilidade, MilitarDoVoluntariado, RegistroDeAlteracao, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { somarMeses } from 'contratos';
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mesAtual } from '@/lib/meses';
import { abrir, corpoEnviado, EU_EXEMPLO, responderConfirmacao, simularApi } from './apoio';

// Cenário fictício: o CABRAL (m1) preencheu o próprio mês e o escalante já o corrigiu duas vezes; o ESTEVES (m2) preencheu e nunca foi corrigido;
// o DANTAS (m4) foi lançado pelo escalante. O mês é o seguinte ao atual.
const MES = somarMeses(mesAtual(), 1);
const militar = (id: string, nomeGuerra: string, extra: Partial<MilitarDoVoluntariado> = {}): MilitarDoVoluntariado => ({
  militarId: id, posto: 'SD', nomeGuerra, matricula: `99002${id.slice(1)}-1`, equipe: 'Alfa', jornada: 'pronto', voluntarioJes: true, lancado: true, horas: 8, dias: 1, peloMilitar: false, correcoes: 0, ...extra,
});
const LISTA: VoluntariadoDoMes = {
  mes: MES, coletaAberta: true,
  militares: [
    militar('m1', 'CABRAL', { peloMilitar: true, correcoes: 2 }),
    militar('m2', 'ESTEVES', { peloMilitar: true, correcoes: 1 }),
    militar('m4', 'DANTAS'),
    militar('m5', 'FALCAO', { lancado: false, horas: 0, dias: 0 }),
  ],
};
const BLOCOS = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '24:00' }];
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const faixa = (data: string, inicio: string, fim: string): FaixaDeDisponibilidade => ({ data, inicio, fim });
const doMilitar = (id: string, extra: Partial<VoluntariadoDoMilitar> = {}): VoluntariadoDoMilitar => ({ militarId: id, mes: MES, faixas: [faixa(dia(5), '08:00', '16:00')], doMesAnterior: [], blocos: BLOCOS, folgas: null, ...extra });
const REGISTRO: RegistroDeAlteracao[] = [
  { id: 'r2', em: '2026-11-25T14:30:00.000Z', por: { patente: 'SD', nomeGuerra: 'ESCALANTE' }, tipo: 'voluntariado_corrigido', data: null, antes: [], depois: [], justificativa: null, texto: 'Pôs 1 faixa em 1 dia' },
  { id: 'r1', em: '2026-11-24T12:00:00.000Z', por: { patente: 'CAP', nomeGuerra: 'LINS' }, tipo: 'voluntariado_corrigido', data: null, antes: [], depois: [], justificativa: null, texto: 'Tirou 2 faixas e pôs 2 em 3 dias' },
];

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/voluntariado/${MES}`]: { status: 200, corpo: LISTA },
    [`GET /api/militares/m1/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m1') },
    [`GET /api/militares/m2/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m2') },
    [`GET /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m4') },
    [`GET /api/militares/m1/voluntariado/${MES}/registro`]: { status: 200, corpo: REGISTRO },
    ...extra,
  });
}
const calendario = () => screen.getByRole('group', { name: 'Calendário do voluntariado' });
const bloco = (n: number, de: string, ate: string) => within(calendario()).getByRole('button', { name: `Dia ${n}, ${de} às ${ate}` });
const salvar = () => screen.getByRole('button', { name: 'Salvar e ir para o próximo' });
const abrirOMilitar = async (id: string, nome: string) => {
  abrir(`/voluntariado?militar=${id}`);
  await screen.findByRole('heading', { name: `SD ${nome}` });
  await screen.findByRole('group', { name: 'Calendário do voluntariado' });
};

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
});

describe('a lista marca quem preencheu e quantas vezes foi corrigido (7.2)', () => {
  it('"Preenchido pelo militar" e "Corrigido n vez(es)" só em quem tem; quem o escalante lançou fica sem marca', async () => {
    api();
    abrir(`/voluntariado?militar=m5`);
    const lancados = await screen.findByRole('region', { name: 'Já lançados' });
    const linha = (nome: string) => within(lancados).getByText(nome).closest('li')!;
    expect(linha('CABRAL')).toHaveTextContent('Preenchido pelo militar');
    expect(linha('CABRAL')).toHaveTextContent('Corrigido 2 vezes');
    expect(linha('ESTEVES')).toHaveTextContent('Preenchido pelo militar');
    expect(linha('ESTEVES')).toHaveTextContent('Corrigido 1 vez');
    expect(linha('ESTEVES')).not.toHaveTextContent('Corrigido 1 vezes');
    expect(linha('DANTAS')).not.toHaveTextContent('Preenchido pelo militar');
    expect(linha('DANTAS')).not.toHaveTextContent('Corrigido');
  });
});

describe('as correções de um militar (7.2)', () => {
  it('ao abrir quem foi corrigido, a seção "Correções" lista quando, quem e a frase do registro, do mais novo para o mais velho', async () => {
    api();
    await abrirOMilitar('m1', 'CABRAL');
    const secao = await screen.findByRole('region', { name: 'Correções' });
    const itens = await within(secao).findAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Pôs 1 faixa em 1 dia');
    expect(itens[0]).toHaveTextContent('por SD ESCALANTE');
    expect(itens[0]).toHaveTextContent('25/11/2026');
    expect(itens[1]).toHaveTextContent('Tirou 2 faixas e pôs 2 em 3 dias');
    expect(itens[1]).toHaveTextContent('por CAP LINS');
  });

  it('quem nunca foi corrigido não tem a seção (e a tela não busca o registro dele)', async () => {
    const f = api();
    await abrirOMilitar('m4', 'DANTAS');
    expect(screen.queryByRole('region', { name: 'Correções' })).toBeNull();
    expect(f.mock.calls.some(([u]) => String(u).includes('/registro'))).toBe(false);
  });
});

describe('alterar o que o militar preencheu pede confirmação (7.2)', () => {
  it('ao salvar um mês preenchido pelo militar, o aviso diz que a alteração fica registrada; cancelar não salva', async () => {
    const f = api({ [`PUT /api/militares/m1/voluntariado/${MES}`]: { status: 200, corpo: LISTA } });
    await abrirOMilitar('m1', 'CABRAL');
    await userEvent.click(bloco(6, '16h', '24h'));
    await userEvent.click(salvar());
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Este mês foi preenchido pelo militar. A sua alteração fica registrada.');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(f.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    // a marcação continua na tela, para a pessoa decidir de novo
    expect(bloco(6, '16h', '24h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Alterar" salva', async () => {
    const f = api({ [`PUT /api/militares/m1/voluntariado/${MES}`]: { status: 200, corpo: LISTA } });
    await abrirOMilitar('m1', 'CABRAL');
    await userEvent.click(bloco(6, '16h', '24h'));
    await userEvent.click(salvar());
    await responderConfirmacao('Alterar');
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m1/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '08:00', '16:00'), faixa(dia(6), '16:00', '24:00')] }));
  });

  it('um mês que o escalante lançou sozinho salva sem aviso', async () => {
    const f = api({ [`PUT /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: LISTA } });
    await abrirOMilitar('m4', 'DANTAS');
    await userEvent.click(bloco(6, '16h', '24h'));
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m4/voluntariado/${MES}`)).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
