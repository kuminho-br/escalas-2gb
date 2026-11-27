import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlocoDaGrade, EscalaDoMes, GradeDoMes, LinhaDaGrade, OpcaoDeServico, OpcoesDeTroca, PainelDoDia } from 'contratos';
import { describe, expect, it } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// O painel do dia com o afastamento, e a troca recusada que diz quem (6.70, Task 5). Dados fictícios (D7).
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', expediente: false };
const CABO: LinhaDaGrade = { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', jornada: 'pronto', dias: { [DIA]: [BLOCO] }, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0 };
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'eq-alfa', nome: 'Alfa', linhas: [CABO] }] };
const opcao: OpcaoDeServico = {
  escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00', guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null,
  servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }], semVoluntariado: false, ordinario: true,
};
const painelCom = (afastamento: PainelDoDia['afastamento']): PainelDoDia => ({
  militar: { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', equipe: 'Alfa', jornada: 'pronto', cnh: [], voluntarioJes: false },
  data: DIA, afastamento, disponibilidade: [], servicos: [], choques: [], opcoes: [opcao],
});
const ESCALA: EscalaDoMes = { escalaId: 'e-ord', nome: 'Ordinário', mes: MES, dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 }, estado: { estado: 'rascunho', emRetificacao: false, em: null, por: null }, podePublicar: false } as unknown as EscalaDoMes;
const ABERTA = `/grade?mes=${MES}&militar=m-CABO&dia=${DIA}`;
const api = (painel: PainelDoDia, extra: Parameters<typeof simularApi>[0] = {}) =>
  simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: GRADE },
    [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: painel },
    'POST /api/escalas/e-ord/alocacoes': { status: 201, corpo: ESCALA },
    'GET /api/escalas/e-ord/mes/2026-12': { status: 200, corpo: ESCALA },
    ...extra,
  });
const painel = () => screen.findByRole('complementary', { name: 'Dia de SD CABO' });

describe('o painel do dia de quem está afastado', () => {
  it('mostra uma faixa âmbar com o tipo e o período inteiro: "Afastado: Férias, de 10 a 19/12/2026"', async () => {
    api(painelCom({ tipo: 'Férias', inicio: '2026-12-10', fim: '2026-12-19' }));
    abrir(ABERTA);
    const p = await painel();
    const faixa = within(p).getByText(/^Afastado:/);
    expect(faixa).toHaveTextContent('Afastado: Férias, de 10 a 19/12/2026');
    expect(faixa.className).toContain('bg-pendencia-fundo');
    expect(faixa.className).toContain('text-pendencia');
  });

  it('o período que atravessa o mês: "de 28/11 a 6/12/2026"; em anos diferentes, com os dois anos', async () => {
    api(painelCom({ tipo: 'Licença', inicio: '2026-11-28', fim: '2026-12-06' }));
    abrir(ABERTA);
    expect(within(await painel()).getByText(/^Afastado:/)).toHaveTextContent('Afastado: Licença, de 28/11 a 6/12/2026');
  });

  it('sem afastamento, não há faixa nem aviso', async () => {
    api(painelCom(null));
    abrir(ABERTA);
    const p = await painel();
    expect(within(p).queryByText(/^Afastado:/)).toBeNull();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    expect(within(p).queryByText(/Dá para escalar mesmo assim/)).toBeNull();
  });

  it('ao adicionar serviço, o aviso fixo aparece (o tipo em minúsculas, a sigla como está) e o "Escalar" continua habilitado, mandando "mesmoAfastado"', async () => {
    const f = api(painelCom({ tipo: 'Férias', inicio: '2026-12-10', fim: '2026-12-19' }));
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    expect(within(p).getByText('Ele está de férias neste dia. Dá para escalar mesmo assim: nada é bloqueado.')).toBeInTheDocument();
    const escalar = within(p).getByRole('button', { name: /^Escalar/ });
    expect(escalar).toBeEnabled();
    await userEvent.click(escalar);
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/escalas/e-ord/alocacoes')).toMatchObject({ militarId: 'm-CABO', data: DIA, turnoId: 't-a', mesmoAfastado: true }));
  });

  it('a sigla do tipo fica como está: "Ele está de LTS neste dia."', async () => {
    api(painelCom({ tipo: 'LTS', inicio: '2026-12-01', fim: '2026-12-31' }));
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    expect(within(p).getByText('Ele está de LTS neste dia. Dá para escalar mesmo assim: nada é bloqueado.')).toBeInTheDocument();
  });

  it('sem afastamento, escalar não manda "mesmoAfastado"', async () => {
    const f = api(painelCom(null));
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    await userEvent.click(within(p).getByRole('button', { name: /^Escalar/ }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/escalas/e-ord/alocacoes')).toMatchObject({ militarId: 'm-CABO' }));
    expect(corpoEnviado(f, 'POST /api/escalas/e-ord/alocacoes')).not.toHaveProperty('mesmoAfastado');
  });
});

describe('a troca recusada que diz quem (6.70)', () => {
  const comServico = (): PainelDoDia => ({ ...painelCom(null), servicos: [{ alocacaoId: 'a-1', escalaId: 'e-ord', escala: 'Ordinário', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: null, funcao: null, acumulaCom: [] }] });
  const TROCAS: OpcoesDeTroca = {
    livres: { aptos: [{ militarId: 'm-livre', posto: 'SD', nomeGuerra: 'CHARLIE', matricula: '997003-3', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto' }] }], semVoluntariado: [], emChoque: [], fora: [], acumular: [] },
    escalados: [{ militarId: 'm-bravo', posto: 'SD', nomeGuerra: 'BRAVO', matricula: '997002-2', alocacoes: [{ alocacaoId: 'a-b1', onde: 'Ordinário, 20h–08h, sem guarnição', permuta: true }] }],
  };
  const abrirTroca = async () => {
    const servico = await screen.findByRole('listitem', { name: 'Pronto A, 08h–20h' });
    await userEvent.click(within(servico).getByRole('button', { name: 'Trocar' }));
    return screen.findByRole('dialog', { name: 'Trocar' });
  };
  const apiDaTroca = (resposta: unknown) => api(comServico(), { 'GET /api/alocacoes/a-1/trocas': { status: 200, corpo: TROCAS }, 'POST /api/alocacoes/a-1/trocar': { status: 409, corpo: resposta } });

  it('volta à lista com o texto da API e a linha do militar que impede marcada com o contorno', async () => {
    apiDaTroca({ erro: 'Não dá para permutar: BRAVO ficaria com o Pronto (08h às 20h) e já está no Bioma deste dia.', militarId: 'm-bravo' });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, sem guarnição' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Fazer a permuta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Não dá para permutar: BRAVO ficaria com o Pronto (08h às 20h) e já está no Bioma deste dia.');
    // de volta à lista: a linha do BRAVO tem o contorno de alerta; a do CHARLIE, não
    const linhaDoBravo = within(d).getByRole('button', { name: 'Ordinário, 20h–08h, sem guarnição' });
    expect(linhaDoBravo).toHaveAttribute('data-impede');
    expect(linhaDoBravo.className).toContain('ring-alerta');
    expect(within(d).getByRole('button', { name: /CHARLIE/ })).not.toHaveAttribute('data-impede');
  });

  it('a recusa de um livre marca a linha dele', async () => {
    apiDaTroca({ erro: 'Não dá para trocar: CHARLIE já tem Saldo das 07h às 13h neste dia.', militarId: 'm-livre' });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: /CHARLIE/ }));
    await userEvent.click(within(d).getByRole('button', { name: 'Trocar' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Não dá para trocar: CHARLIE já tem Saldo das 07h às 13h neste dia.');
    expect(within(d).getByRole('button', { name: /CHARLIE/ })).toHaveAttribute('data-impede');
  });

  it('sem o militarId (as outras recusas), o diálogo continua como antes, na confirmação, com o erro', async () => {
    apiDaTroca({ erro: 'Sem a CNH exigida' });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: /CHARLIE/ }));
    await userEvent.click(within(d).getByRole('button', { name: 'Trocar' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Sem a CNH exigida');
    expect(within(d).getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });
});
