import type { BlocoDaGrade, EscalaDoMes, GradeDoMes, LinhaDaGrade, OpcaoDeServico, PainelDoDia } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }], semVoluntariado: false, ordinario: true, ...o,
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

  it('ao abrir o painel, a célula escolhida rola para ficar à vista', async () => {
    const rolar = vi.fn();
    // o jsdom não tem scrollIntoView
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: rolar, configurable: true, writable: true });
    try {
      api();
      abrir(ABERTA);
      await painel();
      await waitFor(() => expect(rolar).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' }));
      expect(rolar.mock.contexts.at(-1)).toBe(screen.getByRole('button', { name: 'SD BM CABO, dia 10: Pronto A' }));
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
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

describe('grade geral: teclado e celular (achado da revisão final)', () => {
  const matchMediaOriginal = window.matchMedia;
  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  it('ao abrir, o foco vai para o painel; Esc fecha; ao fechar, o foco volta à célula', async () => {
    api();
    const router = abrir(ABERTA);
    const p = await painel();
    await waitFor(() => expect(p).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('militar'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'SD BM CABO, dia 10: Pronto A' })).toHaveFocus());
  });

  it('"Fechar" também devolve o foco à célula', async () => {
    api();
    abrir(ABERTA);
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'SD BM CABO, dia 10: Pronto A' })).toHaveFocus());
  });

  it('no celular o painel cobre a tela e a grade atrás fica inerte; no computador, não', async () => {
    api();
    window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({ matches: true, media: consulta, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
    abrir(ABERTA);
    await painel();
    expect(document.querySelector('[data-grade]')).toHaveAttribute('inert');
  });

  it('no computador a grade continua ativa', async () => {
    api();
    abrir(ABERTA);
    await painel();
    expect(document.querySelector('[data-grade]')).not.toHaveAttribute('inert');
  });
});

describe('grade geral: adicionar serviço neste dia', () => {
  const POST = 'POST /api/escalas/e-ord/alocacoes';
  const noite = { inicio: '20:00', fim: '08:00' };
  const dia = { inicio: '08:00', fim: '20:00' };
  const pronto = (turnoId: string, semVoluntariado = false) => ({ servicoId: 's-pronto', turnoId, nome: 'Pronto', semVoluntariado });
  const jes = { servicoId: 's-jes', turnoId: 't-jes', nome: 'JES', semVoluntariado: true };
  const vaga = (guarnicaoId: string, guarnicao: string, funcaoId: string, funcao: string) => ({ guarnicaoId, guarnicao, funcaoId, funcao });
  // o Ordinário, com duas guarnições nos dois turnos, e o Bioma (Operações), com uma guarnição só
  const COM_ABAS: PainelDoDia = {
    ...PAINEL,
    opcoes: [
      opcao({ ...noite, ...vaga('g-abt', 'ABT', 'f-mot', 'Motorista'), servicos: [pronto('t-b')] }),
      opcao({ ...noite, ...vaga('g-abt', 'ABT', 'f-comb', 'Combatente'), servicos: [pronto('t-b')] }),
      opcao({ ...noite, ...vaga('g-res', 'Resgate', 'f-chefe', 'Chefe'), servicos: [pronto('t-b')] }),
      opcao({ ...noite, servicos: [pronto('t-b')] }),
      opcao({ ...dia, ...vaga('g-abt', 'ABT', 'f-comb', 'Combatente'), servicos: [pronto('t-a'), jes] }),
      opcao({ ...dia, ...vaga('g-res', 'Resgate', 'f-chefe', 'Chefe'), servicos: [pronto('t-a')] }),
      opcao({ escalaId: 'e-bioma', escala: 'Bioma', ordinario: false, inicio: '00:00', fim: '08:00', ...vaga('g-bio', 'Bioma 1', 'f-mot', 'Motorista'), servicos: [{ servicoId: 's-bioma', turnoId: 't-bio', nome: 'Bioma', semVoluntariado: true }], semVoluntariado: true }),
      opcao({ escalaId: 'e-bioma', escala: 'Bioma', ordinario: false, inicio: '00:00', fim: '08:00', ...vaga('g-bio', 'Bioma 1', 'f-comb', 'Combatente'), servicos: [{ servicoId: 's-bioma', turnoId: 't-bio', nome: 'Bioma', semVoluntariado: true }], semVoluntariado: true }),
      opcao({ escalaId: 'e-bioma', escala: 'Bioma', ordinario: false, inicio: '00:00', fim: '08:00', servicos: [{ servicoId: 's-bioma', turnoId: 't-bio', nome: 'Bioma', semVoluntariado: true }], semVoluntariado: true }),
    ],
  };
  const abrirAdicionar = async (painelDoDia: PainelDoDia, extra: Parameters<typeof simularApi>[0] = {}) => {
    const f = api(painelDoDia, extra);
    abrir(ABERTA);
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Adicionar serviço neste dia' }));
    return { f, p };
  };
  const linhaDe = (p: HTMLElement, faixa: string) => within(p).getByRole('listitem', { name: faixa });
  const textos = (lista: HTMLElement) => within(lista).getAllByRole('option').map((o) => o.textContent);

  it('abas Ordinário e Operações com o número de turnos; abre no Ordinário', async () => {
    const { p } = await abrirAdicionar(COM_ABAS);
    // o Ordinário tem dois turnos (20h–08h e 08h–20h) e o Bioma um (00h–08h)
    expect(within(p).getByRole('tab', { name: 'Ordinário (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(p).getByRole('tab', { name: 'Operações (1)' })).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(within(p).getByRole('tab', { name: 'Operações (1)' }));
    expect(within(p).getByRole('heading', { name: 'Bioma' })).toBeInTheDocument();
  });

  it('com opções só de operações, abre em Operações e o Ordinário fica desabilitado', async () => {
    const soBioma: PainelDoDia = { ...PAINEL, opcoes: COM_ABAS.opcoes.filter((o) => !o.ordinario) };
    const { p } = await abrirAdicionar(soBioma);
    expect(within(p).getByRole('tab', { name: 'Operações (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(p).getByRole('tab', { name: 'Ordinário (0)' })).toBeDisabled();
    expect(within(p).getByRole('heading', { name: 'Bioma' })).toBeInTheDocument();
  });

  it('cada turno é uma linha com a vaga numa lista: "Guarnição · Função" quando há mais de uma guarnição, e "Sem guarnição" por último', async () => {
    const { p } = await abrirAdicionar(COM_ABAS);
    const lista = within(linhaDe(p, '20h–08h')).getByLabelText('Vaga de 20h–08h');
    expect(textos(lista)).toEqual(['ABT · Motorista', 'ABT · Combatente', 'Resgate · Chefe', 'Sem guarnição']);
    expect(within(lista).getByRole('option', { name: 'ABT · Motorista' })).toHaveProperty('selected', true);
    // numa escala de uma guarnição só, a lista mostra só a função
    await userEvent.click(within(p).getByRole('tab', { name: 'Operações (1)' }));
    expect(textos(within(linhaDe(p, '00h–08h')).getByLabelText('Vaga de 00h–08h'))).toEqual(['Motorista', 'Combatente', 'Sem guarnição']);
  });

  it('"Escalar" manda a vaga e o serviço escolhidos', async () => {
    const { f, p } = await abrirAdicionar(COM_ABAS, { [POST]: { status: 201, corpo: ESCALA } });
    await userEvent.selectOptions(within(linhaDe(p, '20h–08h')).getByLabelText('Vaga de 20h–08h'), 'Resgate · Chefe');
    await userEvent.click(within(linhaDe(p, '20h–08h')).getByRole('button', { name: 'Escalar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-CABO', data: DIA, turnoId: 't-b', guarnicaoId: 'g-res', funcaoId: 'f-chefe' }));
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });

  it('a lista do serviço acompanha a vaga, e "não marcou" segue o serviço marcado (Review Focus 4)', async () => {
    const { f, p } = await abrirAdicionar(COM_ABAS, { [POST]: { status: 201, corpo: ESCALA } });
    const linha = linhaDe(p, '08h–20h');
    const servico = () => within(linha).queryByLabelText('Serviço de 08h–20h');
    expect(textos(servico()!)).toEqual(['Pronto', 'JES']);
    expect(within(linha).queryByText('não marcou')).toBeNull();
    await userEvent.selectOptions(servico()!, 't-jes');
    expect(within(linha).getByText('não marcou')).toHaveClass('text-pendencia');
    expect(within(p).queryByText('Não marcou voluntariado neste horário.')).toBeNull();
    // outra vaga, em que só o Pronto é possível: a lista do serviço some e a etiqueta também
    await userEvent.selectOptions(within(linha).getByLabelText('Vaga de 08h–20h'), 'Resgate · Chefe');
    expect(servico()).toBeNull();
    expect(within(linha).queryByText('não marcou')).toBeNull();
    // de volta à primeira vaga, o serviço volta ao primeiro (Pronto)
    await userEvent.selectOptions(within(linha).getByLabelText('Vaga de 08h–20h'), 'ABT · Combatente');
    expect(servico()).toHaveValue('t-a');
    await userEvent.selectOptions(servico()!, 't-jes');
    await userEvent.click(within(linha).getByRole('button', { name: 'Escalar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-CABO', data: DIA, turnoId: 't-jes', guarnicaoId: 'g-abt', funcaoId: 'f-comb' }));
  });

  it('turno com todas as vagas cheias mostra só "Sem guarnição" (Review Focus 3)', async () => {
    const cheio: PainelDoDia = { ...PAINEL, opcoes: [opcao({ ...noite, servicos: [pronto('t-b')] })] };
    const { f, p } = await abrirAdicionar(cheio, { [POST]: { status: 201, corpo: ESCALA } });
    const linha = linhaDe(p, '20h–08h');
    expect(textos(within(linha).getByLabelText('Vaga de 20h–08h'))).toEqual(['Sem guarnição']);
    await userEvent.click(within(linha).getByRole('button', { name: 'Escalar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-CABO', data: DIA, turnoId: 't-b', guarnicaoId: null, funcaoId: null }));
  });

  it('a recusa 409 aparece dentro do painel e a grade volta a ser buscada (Review Focus 5)', async () => {
    const { f, p } = await abrirAdicionar(PAINEL, { [POST]: { status: 409, corpo: { erro: 'Este militar já está escalado neste turno.' } } });
    await userEvent.click(within(linhaDe(p, '20h–08h')).getByRole('button', { name: 'Escalar' }));
    expect(await within(p).findByRole('alert')).toHaveTextContent('Este militar já está escalado neste turno.');
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });

  it('sem nenhuma opção, a frase continua', async () => {
    const { p } = await abrirAdicionar({ ...PAINEL, opcoes: [] });
    expect(within(p).getByText('Nenhum serviço disponível para ele neste dia.')).toBeInTheDocument();
    expect(within(p).queryByRole('tab')).toBeNull();
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
