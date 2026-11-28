import type { BlocoDaGrade, GradeDoMes, LinhaDaGrade, OpcaoDeServico, PainelDoDia } from 'contratos';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdicionarServico } from '@/componentes/grade/AdicionarServico';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// 6.71: o expediente do Adm é só o serviço "Expediente" lançado pela pré-escala. A Grade e o painel do dia o tratam como qualquer serviço: sem bloco cinza nem item
// "Expediente do ADM" na legenda, e o lançado sai por "Remover". Também fica aqui o defeito do JES que virava Saldo. Dezembro de 2026, o ADM no dia 10 (quinta).
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const EXPEDIENTE = { id: 's-exp', nome: 'Expediente', cor: '#8A94A1', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-exp', servico: EXPEDIENTE, letra: 'A', inicio: '08:00', fim: '16:00' };
const ADM: LinhaDaGrade = {
  militarId: 'm-ADM', posto: 'SD', nomeGuerra: 'ADM', matricula: '100801-1', jornada: 'adm', dias: { [DIA]: [BLOCO] }, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0,
};
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'adm', nome: 'ADM', linhas: [ADM] }] };
const opcao = (o: Partial<OpcaoDeServico>): OpcaoDeServico => ({
  escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00', guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null,
  servicos: [], semVoluntariado: false, ordinario: true, ...o,
});
const pronto = { servicoId: 's-pronto', turnoId: 't-pronto', nome: 'Pronto', semVoluntariado: false };
const jes = { servicoId: 's-jes', turnoId: 't-jes', nome: 'JES', semVoluntariado: true };
const saldo = { servicoId: 's-saldo', turnoId: 't-saldo', nome: 'Saldo', semVoluntariado: false };
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-ADM', posto: 'SD', nomeGuerra: 'ADM', matricula: '100801-1', equipe: null, jornada: 'adm', cnh: [], voluntarioJes: true },
  data: DIA,
  afastamento: null,
  disponibilidade: [],
  servicos: [{ alocacaoId: 'a-exp', escalaId: null, escala: '', servico: EXPEDIENTE, letra: 'A', inicio: '08:00', fim: '16:00', guarnicao: null, funcao: null, acumulaCom: [] }],
  choques: [],
  opcoes: [],
};
const ROTA_GRADE = `GET /api/unidades/u-1sb/grade/${MES}`;
const ROTA_PAINEL = `GET /api/unidades/u-1sb/grade/${MES}/militares/m-ADM/dias/${DIA}`;
const ABERTA = `/grade?mes=${MES}&militar=m-ADM&dia=${DIA}`;
const api = (painel: PainelDoDia, extra: Parameters<typeof simularApi>[0] = {}) =>
  simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA_GRADE]: { status: 200, corpo: GRADE }, [ROTA_PAINEL]: { status: 200, corpo: painel }, ...extra });
const painel = () => screen.findByRole('complementary', { name: 'Dia de SD ADM' });

describe('o expediente lançado no painel do dia (6.71)', () => {
  it('sai por "Remover", como qualquer serviço: sem "Tirar do expediente" e sem janela de confirmação', async () => {
    const f = api(PAINEL, { 'DELETE /api/alocacoes/a-exp': { status: 200, corpo: {} } });
    abrir(ABERTA);
    const servico = within(await painel()).getByRole('listitem', { name: 'Expediente A, 08h–16h' });
    expect(within(servico).queryByRole('button', { name: 'Tirar do expediente' })).toBeNull();
    await userEvent.click(within(servico).getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-exp')).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('não traz a frase da pré-escala, como os outros serviços do painel do dia (6.74)', async () => {
    api(PAINEL);
    abrir(ABERTA);
    const servico = within(await painel()).getByRole('listitem', { name: 'Expediente A, 08h–16h' });
    expect(within(servico).queryByText('Ele não volta para este turno quando a pré-escala for gerada de novo.')).toBeNull();
  });
});

describe('a Grade sem o expediente calculado (6.71)', () => {
  it('o expediente lançado é um quadrado comum, na cor do cadastro; a legenda não tem "Expediente do ADM", só o nome do serviço', async () => {
    api(PAINEL);
    abrir(`/grade?mes=${MES}`);
    const celula = await screen.findByRole('button', { name: 'SD ADM, dia 10: Expediente A' });
    expect(celula).toBeInTheDocument();
    const legenda = await screen.findByRole('list', { name: 'Legenda' });
    expect(within(legenda).queryByText('Expediente do ADM')).toBeNull();
    expect(within(legenda).getByText('Expediente')).toBeInTheDocument();
  });

  it('sem nenhum lançado, a linha do Adm fica vazia: o nome da célula é "sem serviço" e a legenda não aparece', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      [ROTA_GRADE]: { status: 200, corpo: { ...GRADE, grupos: [{ chave: 'adm', nome: 'ADM', linhas: [{ ...ADM, dias: {} }] }] } },
    });
    abrir(`/grade?mes=${MES}`);
    expect(await screen.findByRole('button', { name: 'SD ADM, dia 10: sem serviço' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Legenda' })).toBeNull();
  });
});

describe('o defeito do JES que virava Saldo (6.71)', () => {
  const OPCOES = [opcao({ servicos: [pronto, jes, saldo] })];

  it('o JES escolhido na lista do turno é o que vai no pedido, mesmo depois de as opções chegarem de novo', async () => {
    const chamadas: string[] = [];
    const registrar = (_: OpcaoDeServico, turnoId: string) => chamadas.push(turnoId);
    const { rerender } = render(<AdicionarServico opcoes={OPCOES} salvando={false} aoEscolher={registrar} />);
    const lista = screen.getByLabelText('Serviço de 08h–20h');
    await userEvent.selectOptions(lista, 't-jes');
    // as opções chegam de novo (outra busca do painel): mesmos serviços, outro objeto, a ordem que a API mandar
    rerender(<AdicionarServico opcoes={[opcao({ servicos: [saldo, pronto, jes] })]} salvando={false} aoEscolher={registrar} />);
    expect(screen.getByLabelText('Serviço de 08h–20h')).toHaveValue('t-jes');
    await userEvent.click(screen.getByRole('button', { name: /^Escalar/ }));
    expect(chamadas).toEqual(['t-jes']);
  });

  it('se o serviço escolhido sai da lista, a lista mostra o outro (a pessoa vê a troca) e o pedido leva o que está na tela', async () => {
    const chamadas: string[] = [];
    const registrar = (_: OpcaoDeServico, turnoId: string) => chamadas.push(turnoId);
    const { rerender } = render(<AdicionarServico opcoes={OPCOES} salvando={false} aoEscolher={registrar} />);
    await userEvent.selectOptions(screen.getByLabelText('Serviço de 08h–20h'), 't-jes');
    rerender(<AdicionarServico opcoes={[opcao({ servicos: [pronto, saldo] })]} salvando={false} aoEscolher={registrar} />);
    const lista = screen.getByLabelText('Serviço de 08h–20h');
    await userEvent.click(screen.getByRole('button', { name: /^Escalar/ }));
    expect(chamadas).toEqual([(lista as HTMLSelectElement).value]);
  });

  it('no painel (já sem o expediente, com as opções): escolher JES e escalar manda o turno do JES', async () => {
    const POST = 'POST /api/escalas/e-ord/alocacoes';
    const f = api({ ...PAINEL, servicos: [], opcoes: OPCOES }, { [POST]: { status: 201, corpo: {} } });
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    await userEvent.selectOptions(within(p).getByLabelText('Serviço de 08h–20h'), 't-jes');
    await userEvent.click(within(p).getByRole('button', { name: /^Escalar/ }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-ADM', data: DIA, turnoId: 't-jes', guarnicaoId: null, funcaoId: null }));
  });
});
