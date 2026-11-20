import type { BlocoDaGrade, EscalaDoMes, GradeDoMes, LinhaDaGrade, OpcaoDeServico, PainelDoDia } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// O painel do dia da Grade geral: dezembro de 2026, o CABO no dia 10 (quinta), de Pronto A (ABT, Combatente) com o acúmulo de Motorista do ABT.
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', expediente: false };
const CABO: LinhaDaGrade = {
  militarId: 'm-CABO', posto: 'SD BM', nomeGuerra: 'CABO', matricula: '990001-1', jornada: 'pronto', dias: { [DIA]: [BLOCO] }, choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0,
};
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'eq-alfa', nome: 'Alfa', linhas: [CABO] }] };
const opcao = (o: Partial<OpcaoDeServico>): OpcaoDeServico => ({
  escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00', guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null,
  servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }], semVoluntariado: false, ...o,
});
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-CABO', posto: 'SD BM', nomeGuerra: 'CABO', matricula: '990001-1', equipe: 'Alfa', jornada: 'pronto', cnh: ['D'], voluntarioJes: true },
  data: DIA,
  afastamento: null,
  disponibilidade: [{ inicio: '08:00', fim: '20:00' }],
  servicos: [
    {
      alocacaoId: 'a-1', escalaId: 'e-ord', escala: 'Ordinário', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: 'ABT', funcao: 'Combatente', acumulaCom: ['Motorista ABT'],
    },
  ],
  choques: [],
  opcoes: [
    opcao({ inicio: '20:00', fim: '08:00', guarnicaoId: 'g-abt', guarnicao: 'ABT', funcaoId: 'f-mot', funcao: 'Motorista', servicos: [{ servicoId: 's-pronto', turnoId: 't-b', nome: 'Pronto', semVoluntariado: false }] }),
    opcao({ servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }, { servicoId: 's-jes', turnoId: 't-jes', nome: 'JES', semVoluntariado: true }] }),
  ],
};
const ROTA_GRADE = `GET /api/unidades/u-1sb/grade/${MES}`;
const ROTA_PAINEL = `GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`;
const ESCALA: EscalaDoMes = { escalaId: 'e-ord', nome: 'Ordinário', mes: MES, dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } };
const ABERTA = `/?mes=${MES}&militar=m-CABO&dia=${DIA}`;

function api(painel: PainelDoDia = PAINEL, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [ROTA_GRADE]: { status: 200, corpo: GRADE },
    [ROTA_PAINEL]: { status: 200, corpo: painel },
    ...extra,
  });
}
const painel = () => screen.findByRole('complementary', { name: 'Dia de SD BM CABO' });

describe('grade geral: o painel do dia', () => {
  it('abrir com militar e dia na busca mostra o militar, os horários marcados e os serviços', async () => {
    api();
    abrir(ABERTA);
    const p = await painel();
    expect(within(p).getByRole('heading', { name: 'SD BM CABO' })).toBeInTheDocument();
    expect(within(p).getByText(/990001-1/)).toBeInTheDocument();
    expect(within(p).getByText(/Alfa/)).toBeInTheDocument();
    expect(within(p).getByText('CNH D')).toBeInTheDocument();
    expect(within(p).getByText('Voluntário JES')).toBeInTheDocument();
    expect(within(p).getByText('quinta, 10/12/2026')).toBeInTheDocument();
    expect(within(p).getByText('Marcou 08h–20h no voluntariado.')).toBeInTheDocument();
    const servico = within(p).getByRole('listitem', { name: 'Pronto A, 08h–20h' });
    expect(within(servico).getByText('Ordinário · ABT, Combatente')).toBeInTheDocument();
    expect(within(servico).getByText('Acumula Motorista ABT.')).toBeInTheDocument();
    // a célula escolhida da grade fica marcada
    expect(screen.getByRole('button', { name: 'SD BM CABO, dia 10: Pronto A' })).toHaveAttribute('data-escolhida');
  });

  it('sem nada marcado, afastado e com choque: as frases do dia', async () => {
    api({ ...PAINEL, disponibilidade: [], afastamento: 'Férias', choques: ['Choque de horário: Pronto A (08h–20h) com JES A (08h–20h)'], opcoes: [] });
    abrir(ABERTA);
    const p = await painel();
    expect(within(p).getByText('Não marcou voluntariado neste dia.')).toBeInTheDocument();
    expect(within(p).getByText('Afastado: Férias')).toBeInTheDocument();
    expect(within(p).getByText('Choque de horário: Pronto A (08h–20h) com JES A (08h–20h)')).toHaveClass('text-alerta');
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    expect(await within(p).findByText('Nenhum serviço disponível para ele neste dia.')).toBeInTheDocument();
  });

  it('"Fechar" tira militar e dia da busca', async () => {
    api();
    const router = abrir(ABERTA);
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('militar'));
    expect(router.state.location.search).not.toHaveProperty('dia');
    expect(screen.queryByRole('complementary', { name: 'Dia de SD BM CABO' })).toBeNull();
  });
});

describe('grade geral: adicionar serviço neste dia', () => {
  const POST = 'POST /api/escalas/e-ord/alocacoes';

  it('lista as opções por escala; escolher a do ABT Motorista manda o POST certo e busca a grade de novo', async () => {
    const f = api(PAINEL, { [POST]: { status: 201, corpo: ESCALA } });
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    expect(within(p).getByRole('heading', { name: 'Ordinário' })).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: '20h–08h · ABT · Motorista' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-CABO', data: DIA, turnoId: 't-b', guarnicaoId: 'g-abt', funcaoId: 'f-mot' }));
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });

  it('com dois serviços na opção, o seletor escolhe o turno e avisa quando só falta marcar o horário', async () => {
    const f = api(PAINEL, { [POST]: { status: 201, corpo: ESCALA } });
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    const seletor = within(p).getByLabelText('Serviço de 08h–20h · Sem guarnição');
    expect(seletor).toHaveValue('t-a');
    expect(within(p).queryByText('Não marcou voluntariado neste horário.')).toBeNull();
    await userEvent.selectOptions(seletor, 't-jes');
    expect(within(p).getByText('Não marcou voluntariado neste horário.')).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: '08h–20h · Sem guarnição' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-CABO', data: DIA, turnoId: 't-jes', guarnicaoId: null, funcaoId: null }));
  });

  it('a recusa 409 aparece dentro do painel e a grade volta a ser buscada (Review Focus 5)', async () => {
    const f = api(PAINEL, { [POST]: { status: 409, corpo: { erro: 'Este militar já está escalado neste turno.' } } });
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    await userEvent.click(within(p).getByRole('button', { name: '20h–08h · ABT · Motorista' }));
    expect(await within(p).findByRole('alert')).toHaveTextContent('Este militar já está escalado neste turno.');
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });
});

describe('grade geral: remover', () => {
  it('mostra os avisos do "Remover", e o botão chama o DELETE e busca a grade de novo', async () => {
    const f = api(PAINEL, { 'DELETE /api/alocacoes/a-1': { status: 200, corpo: ESCALA } });
    abrir(ABERTA);
    const servico = within(await painel()).getByRole('listitem', { name: 'Pronto A, 08h–20h' });
    expect(within(servico).getByText('Ele não volta para este turno quando a pré-escala for gerada de novo.')).toBeInTheDocument();
    expect(within(servico).getByText('Sai também de: Motorista ABT.')).toBeInTheDocument();
    await userEvent.click(within(servico).getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-1')).toBe(1));
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });

  it('a recusa ao remover aparece dentro do painel', async () => {
    api(PAINEL, { 'DELETE /api/alocacoes/a-1': { status: 404, corpo: { erro: 'Alocação não encontrada.' } } });
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Remover' }));
    expect(await within(p).findByRole('alert')).toHaveTextContent('Alocação não encontrada.');
  });
});

describe('grade geral: o painel do dia quando o militar não existe', () => {
  it('o 404 aparece no painel', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      [ROTA_GRADE]: { status: 200, corpo: GRADE },
      [ROTA_PAINEL]: { status: 404, corpo: { erro: 'Militar não encontrado nesta seção.' } },
    });
    abrir(ABERTA);
    const p = await screen.findByRole('complementary', { name: 'Dia do militar' });
    expect(await within(p).findByRole('alert')).toHaveTextContent('Militar não encontrado nesta seção.');
  });
});
