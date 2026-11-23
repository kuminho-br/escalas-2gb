import type { EscalaDosOficiais, OficialDoMes, OficialNoSaldo } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Dados fictícios (D7): o 2º GB, oficiais 990xxx-x.
const UNIDADE = { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3 };
const comPapel = (papel: 'administrador' | 'gestor' | 'escalante'): EuDaApi => ({
  ...EU_EXEMPLO,
  papeis: [{ papel, unidadeId: 'u-gb', unidadeSigla: '2º GB' }],
  unidades: [UNIDADE],
});
const GESTOR = comPapel('gestor');
const MES = '2027-01';

describe('o item Oficiais e a rota', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const SEM_ESCALA: EscalaDosOficiais = {
    mes: MES, etapa: 'sem-cotas', cotasEm: null, fechadaEm: null, encerradaEm: null, servico: null, turnosDoServico: [], oficiais: [], vez: null, turnos: [], avisos: [],
  };
  const rotas = (eu: EuDaApi) => ({
    '/api/eu': { status: 200, corpo: eu },
    [`/api/unidades/u-gb/oficiais/${MES}`]: { status: 200, corpo: SEM_ESCALA },
    '/api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: [] },
    '/api/unidades/u-gb/servicos': { status: 200, corpo: [] },
  });

  it('o gestor vê "Oficiais" logo depois de "Efetivo por dia", e o auxiliar não vê', async () => {
    simularApi(rotas(GESTOR));
    abrir('/grade');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const nomes = within(nav).getAllByRole('link').map((l) => l.textContent);
    expect(nomes.indexOf('Oficiais')).toBe(nomes.indexOf('Efetivo por dia') + 1);
    cleanup();
    simularApi(rotas(comPapel('escalante')));
    abrir('/grade');
    const nav2 = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav2).queryByRole('link', { name: 'Oficiais' })).toBeNull();
  });

  it('o administrador também vê o item', async () => {
    simularApi(rotas(comPapel('administrador')));
    abrir('/grade');
    expect(await within(await screen.findByRole('navigation', { name: 'Navegação principal' })).findByRole('link', { name: 'Oficiais' })).toBeInTheDocument();
  });

  it('o auxiliar em /oficiais volta ao início, com o aviso de outra área', async () => {
    simularApi(rotas(comPapel('escalante')));
    const router = abrir(`/oficiais?mes=${MES}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.search).toMatchObject({ aviso: 'outro-papel' });
  });

  it('a página mostra o título, o subtítulo e as três abas', async () => {
    simularApi(rotas(GESTOR));
    abrir(`/oficiais?mes=${MES}`);
    expect(await screen.findByRole('heading', { name: 'Escala dos oficiais' })).toBeInTheDocument();
    expect(screen.getByText('Oficiais QOC e QOA.')).toBeInTheDocument();
    for (const aba of ['Escala do mês', 'Painel de saldo', 'Regras']) expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
  });
});

// ---- a aba Escala do mês ----
const TURNO_A = { id: 't-a', letra: 'A', inicio: '07:00', fim: '19:00', duracaoMinutos: 720, turnosPadrao: [] };
const TURNO_B = { id: 't-b', letra: 'B', inicio: '19:00', fim: '07:00', duracaoMinutos: 720, turnosPadrao: [] };
const SERVICO = { id: 's-op', nome: 'Oficial de operações', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B', ativo: true, fixo: false, turnos: [TURNO_A, TURNO_B] };
const TURNOS_DO_SERVICO = [
  { id: 't-a', letra: 'A', inicio: '07:00', fim: '19:00', rotulo: 'Dia' as const },
  { id: 't-b', letra: 'B', inicio: '19:00', fim: '07:00', rotulo: 'Noite' as const },
];
const dia = (n: number) => `2027-01-${String(n).padStart(2, '0')}`;
const vazios = () => Array.from({ length: 31 }, (_, i) => i + 1).flatMap((n) => ['t-a', 't-b'].map((turnoId) => ({ dia: dia(n), turnoId, militarId: null as string | null, saiuMilitarId: null as string | null })));
const oficial = (o: Partial<OficialDoMes> & Pick<OficialDoMes, 'militarId' | 'nomeGuerra' | 'posto' | 'ordem'>): OficialDoMes => ({
  matricula: '990100-0', quadro: 'QOC', lotacao: '2º GB', semAntiguidade: false, saldoAnterior: 0, dias: 31, devido: 20.5, cota: 21, sobra: false, escolhidos: 0, afastamentos: [], participa: true, novo: false, ...o,
});
const O1 = oficial({ militarId: 'm-1', nomeGuerra: 'ALFA', posto: 'CEL', ordem: 1, matricula: '990101-1', saldoAnterior: 0.75 });
const O2 = oficial({ militarId: 'm-2', nomeGuerra: 'BRAVO', posto: 'CAP', ordem: 2, matricula: '990102-2', semAntiguidade: true, cota: 21, sobra: true });
const O3 = oficial({ militarId: 'm-3', nomeGuerra: 'CHARLIE', posto: 'CAP', ordem: 3, matricula: '990103-3', semAntiguidade: true, cota: 20, saldoAnterior: -0.25 });
const escala = (e: Partial<EscalaDosOficiais> = {}): EscalaDosOficiais => ({
  mes: MES, etapa: 'escolhas', cotasEm: '2026-12-28T10:12:00', fechadaEm: null, encerradaEm: null,
  servico: { id: 's-op', nome: 'Oficial de operações' }, turnosDoServico: TURNOS_DO_SERVICO,
  oficiais: [O1, O2, O3], vez: 'm-1', turnos: vazios(), avisos: [], ...e,
});
const URL_MES = `/api/unidades/u-gb/oficiais/${MES}`;
function abrirEscala(e: EscalaDosOficiais, extra: Record<string, { status: number; corpo?: unknown; espera?: Promise<unknown> }> = {}) {
  const f = simularApi({
    '/api/eu': { status: 200, corpo: GESTOR },
    [`GET ${URL_MES}`]: { status: 200, corpo: e },
    'GET /api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: [] },
    'GET /api/unidades/u-gb/servicos': { status: 200, corpo: [SERVICO] },
    ...extra,
  });
  abrir(`/oficiais?mes=${MES}`);
  return f;
}
const comNome = (e: EscalaDosOficiais, marcas: Record<string, string | [string, string]>) =>
  e.turnos.map((t) => {
    const m = marcas[`${t.dia}|${t.turnoId}`];
    return m ? { ...t, militarId: Array.isArray(m) ? m[0] : m, saiuMilitarId: Array.isArray(m) ? m[1] : null } : t;
  });
const celula = (d: number, turno: 'Dia' | 'Noite') => screen.getByRole('button', { name: new RegExp(`^${String(d).padStart(2, '0')}/01, ${turno}, ${turno === 'Dia' ? '07h às 19h' : '19h às 07h'}`) });

describe('a aba Escala do mês', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('o serviço', () => {
    it('sem serviço, pede para escolher e deixa "Calcular cotas" desligado', async () => {
      abrirEscala(escala({ etapa: 'sem-cotas', cotasEm: null, servico: null, turnosDoServico: [], vez: null, turnos: [] }));
      expect(await screen.findByText('Escolha o serviço da escala. Ele vem do cadastro de serviços (tela Turnos).')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Calcular cotas' })).toBeDisabled();
      const campo = screen.getByLabelText('Serviço');
      expect(within(campo).getByRole('option', { name: 'Oficial de operações' })).toBeInTheDocument();
    });

    it('escolher o serviço chama a API', async () => {
      const f = abrirEscala(
        escala({ etapa: 'sem-cotas', cotasEm: null, servico: null, turnosDoServico: [], vez: null, turnos: [] }),
        { [`PUT ${URL_MES}/servico`]: { status: 200, corpo: escala() } },
      );
      await screen.findByRole('option', { name: 'Oficial de operações' });
      await userEvent.selectOptions(screen.getByLabelText('Serviço'), 's-op');
      await waitFor(() => expect(corpoEnviado(f, `PUT ${URL_MES}/servico`)).toEqual({ servicoId: 's-op' }));
    });

    it('com as cotas calculadas, o campo fica só para leitura', async () => {
      abrirEscala(escala());
      await waitFor(() => expect(screen.getByLabelText('Serviço')).toHaveValue('s-op'));
      expect(screen.getByLabelText('Serviço')).toBeDisabled();
    });
  });

  describe('o calendário', () => {
    it('mostra os 31 dias com os turnos do serviço, a legenda e o contador', async () => {
      abrirEscala(escala());
      expect(await screen.findByText('0 de 62 turnos com nome')).toBeInTheDocument();
      const legenda = screen.getByLabelText('Legenda dos turnos');
      expect(within(legenda).getByText('Dia, 07h às 19h')).toBeInTheDocument();
      expect(within(legenda).getByText('Noite, 19h às 07h')).toBeInTheDocument();
      expect(celula(1, 'Dia')).toBeInTheDocument();
      expect(celula(31, 'Noite')).toBeInTheDocument();
    });

    it('sem desenho de sol ou lua: nenhuma célula tem ícone, e a Noite é de tom escuro', async () => {
      abrirEscala(escala());
      await screen.findByText('0 de 62 turnos com nome');
      const cal = screen.getByLabelText('Calendário do mês');
      expect(cal.querySelectorAll('svg').length).toBe(0);
      expect(celula(1, 'Dia')).toHaveAttribute('data-tom', 'claro');
      expect(celula(1, 'Noite')).toHaveAttribute('data-tom', 'escuro');
    });

    it('conta os turnos com nome', async () => {
      const base = escala();
      abrirEscala(escala({ turnos: comNome(base, { [`${dia(1)}|t-a`]: 'm-1', [`${dia(1)}|t-b`]: 'm-1' }) }));
      expect(await screen.findByText('2 de 62 turnos com nome')).toBeInTheDocument();
    });
  });

  describe('as escolhas', () => {
    it('o quadro "Vez de escolher" mostra o oficial, a posição e quanto já lançou', async () => {
      const base = escala();
      abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 4 }, O2, O3], turnos: comNome(base, {}) }));
      const quadro = await screen.findByLabelText('Vez de escolher');
      expect(within(quadro).getByText('CEL ALFA, 1º na ordem')).toBeInTheDocument();
      expect(within(quadro).getByText(/Já lançou 4 de 21/)).toBeInTheDocument();
    });

    it('um clique num turno livre lança a escolha da vez', async () => {
      const f = abrirEscala(escala(), { [`PUT ${URL_MES}/turnos/${dia(3)}/t-b`]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('button', { name: /^03\/01, Noite/ }));
      await waitFor(() => expect(corpoEnviado(f, `PUT ${URL_MES}/turnos/${dia(3)}/t-b`)).toEqual({ militarId: 'm-1' }));
    });

    it('clique duplo rápido num turno livre lança uma escolha só', async () => {
      const t = trava();
      const f = abrirEscala(escala(), { [`PUT ${URL_MES}/turnos/${dia(3)}/t-a`]: { status: 200, corpo: escala(), espera: t.espera } });
      const botao = await screen.findByRole('button', { name: /^03\/01, Dia/ });
      await userEvent.dblClick(botao);
      t.soltar();
      await waitFor(() => expect(chamadasA(f, `PUT ${URL_MES}/turnos/${dia(3)}/t-a`)).toBe(1));
    });

    it('os dias de afastamento da vez aparecem como "afastado", sem clique', async () => {
      abrirEscala(escala({ oficiais: [{ ...O1, afastamentos: [{ inicio: dia(10), fim: dia(11), tipo: 'Férias' }] }, O2, O3] }));
      await screen.findByText('0 de 62 turnos com nome');
      expect(screen.queryByRole('button', { name: /^10\/01, Dia/ })).toBeNull();
      expect(screen.getAllByText('afastado').length).toBe(4);
      expect(celula(12, 'Dia')).toBeInTheDocument();
    });

    it('um turno com nome oferece "Tirar {nome} deste turno"', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) }), { [`PUT ${URL_MES}/turnos/${dia(2)}/t-a`]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('button', { name: 'Tirar BRAVO deste turno' }));
      await waitFor(() => expect(corpoEnviado(f, `PUT ${URL_MES}/turnos/${dia(2)}/t-a`)).toEqual({ militarId: null }));
    });

    it('quando ninguém falta, diz que todos escolheram', async () => {
      abrirEscala(escala({ vez: null }));
      expect(await screen.findByText('Todos escolheram')).toBeInTheDocument();
    });
  });

  describe('a lista de cotas', () => {
    it('tem as colunas, a sobra e a marca de ordenado à mão', async () => {
      abrirEscala(escala());
      const lista = await screen.findByRole('table', { name: 'Cotas de janeiro de 2027' });
      for (const c of ['Ordem', 'Oficial', 'Saldo', 'Dias', 'Cota', 'Escolhidos']) expect(within(lista).getByRole('columnheader', { name: c })).toBeInTheDocument();
      expect(within(lista).getByText('+1 sobra')).toBeInTheDocument();
      expect(within(lista).getAllByText(/ordenado à mão/).length).toBe(2);
      expect(within(lista).getByText('+0,75')).toBeInTheDocument();
      expect(within(lista).getByText('−0,25')).toBeInTheDocument();
    });

    it('Subir e Descer gravam a ordem à mão', async () => {
      const f = abrirEscala(escala(), { [`PUT ${URL_MES}/ordem`]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('button', { name: 'Subir CHARLIE' }));
      await waitFor(() => expect(corpoEnviado(f, `PUT ${URL_MES}/ordem`)).toEqual({ militarIds: ['m-3', 'm-2'] }));
      expect(screen.queryByRole('button', { name: 'Subir BRAVO' })).toBeNull();
    });
  });

  describe('quem participa da rodada', () => {
    const FORA = oficial({ militarId: 'm-4', nomeGuerra: 'DELTA', posto: 'MAJ', ordem: 4, matricula: '990104-4', participa: false, cota: null, devido: null });
    const NOVO = oficial({ militarId: 'm-5', nomeGuerra: 'ECO', posto: 'CAP', ordem: 5, matricula: '990105-5', participa: false, novo: true, cota: null, devido: null });
    const URL_PART = `PUT ${URL_MES}/participantes`;

    it('antes de fechar, a lista mostra todos os elegíveis, cada um com a marca "Participa", e "novo" em quem é novo', async () => {
      abrirEscala(escala({ oficiais: [O1, O2, O3, FORA, NOVO] }));
      const lista = await screen.findByRole('table', { name: 'Cotas de janeiro de 2027' });
      expect(within(lista).getByRole('columnheader', { name: 'Participa' })).toBeInTheDocument();
      expect(within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'MAJ DELTA participa da rodada' })).not.toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'CAP ECO participa da rodada' })).not.toBeChecked();
      const eco = within(lista).getByRole('checkbox', { name: 'CAP ECO participa da rodada' }).closest('tr')!;
      expect(within(eco).getByText('novo')).toBeInTheDocument();
      expect(within(lista).getByRole('checkbox', { name: 'MAJ DELTA participa da rodada' }).closest('tr')!.textContent).not.toContain('novo');
    });

    it('marcar ou desmarcar grava a lista inteira de quem participa', async () => {
      const f = abrirEscala(escala({ oficiais: [O1, O2, O3, FORA] }), { [URL_PART]: { status: 200, corpo: { ...escala({ oficiais: [O1, O2, O3, FORA] }), liberados: [] } } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'MAJ DELTA participa da rodada' }));
      await waitFor(() => expect(corpoEnviado(f, URL_PART)).toEqual({ militarIds: ['m-1', 'm-2', 'm-3', 'm-4'] }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }));
      await waitFor(() => expect(corpoEnviado(f, URL_PART)).toEqual({ militarIds: ['m-1', 'm-3'] }));
    });

    it('o aviso dos turnos que ficaram sem ninguém aparece depois de desmarcar', async () => {
      abrirEscala(escala(), { [URL_PART]: { status: 200, corpo: { ...escala(), liberados: ['3 turnos de CAP BRAVO ficaram sem ninguém.'] } } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }));
      expect(await screen.findByText('3 turnos de CAP BRAVO ficaram sem ninguém.')).toBeInTheDocument();
    });

    it('o aviso também aparece quando os turnos somem no "Calcular cotas" (quem deixou de ser elegível; achado da revisão final)', async () => {
      abrirEscala(escala(), { [`POST ${URL_MES}/cotas`]: { status: 200, corpo: { ...escala(), liberados: ['1 turno de CAP BRAVO ficou sem ninguém.'] } } });
      await userEvent.click(await screen.findByRole('button', { name: 'Calcular cotas' }));
      expect(await screen.findByText('1 turno de CAP BRAVO ficou sem ninguém.')).toBeInTheDocument();
    });

    it('o erro da API (marcar com a escala fechada em outra aba) aparece na tela', async () => {
      abrirEscala(escala({ oficiais: [O1, O2, O3, FORA] }), { [URL_PART]: { status: 409, corpo: { erro: 'Com a escala fechada, os participantes não mudam mais.' } } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'MAJ DELTA participa da rodada' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Com a escala fechada, os participantes não mudam mais.');
    });

    it('com a escala fechada, a marca fica só para leitura e quem não participa some da lista e do diálogo do turno', async () => {
      abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00', oficiais: [O1, O2, O3, FORA] }));
      const lista = await screen.findByRole('table', { name: 'Cotas de janeiro de 2027' });
      expect(within(lista).queryByRole('checkbox', { name: 'MAJ DELTA participa da rodada' })).toBeNull();
      expect(within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeDisabled();
      await userEvent.click(celula(2, 'Dia'));
      const dialogo = within(await screen.findByRole('dialog'));
      expect(dialogo.queryByRole('button', { name: 'MAJ DELTA' })).toBeNull();
      expect(dialogo.getByRole('button', { name: 'CEL ALFA' })).toBeInTheDocument();
    });

    it('sem cotas e sem ninguém marcado, a tela pede para marcar quem participa', async () => {
      abrirEscala(escala({ etapa: 'sem-cotas', cotasEm: null, vez: null, turnos: [], oficiais: [{ ...FORA, ordem: 1 }, { ...NOVO, ordem: 2 }] }));
      expect(await screen.findByText('Marque na lista quem participa da rodada e calcule as cotas.')).toBeInTheDocument();
    });
  });

  describe('as confirmações', () => {
    it('"Fechar a escala" com turnos vazios pede a confirmação com o texto fixo', async () => {
      const f = abrirEscala(escala(), { [`POST ${URL_MES}/fechar`]: { status: 200, corpo: escala({ etapa: 'fechada' }) } });
      await userEvent.click(await screen.findByRole('button', { name: 'Fechar a escala' }));
      expect(screen.getByText(/Ainda há 62 turnos sem nome\./)).toBeInTheDocument();
      expect(screen.getByText(/Você pode fechar mesmo assim e completar depois; a partir daqui, trocar um nome vira cobertura e fica no registro\./)).toBeInTheDocument();
      expect(chamadasA(f, `POST ${URL_MES}/fechar`)).toBe(0);
      await userEvent.click(within(screen.getByRole('region', { name: 'Confirmação' })).getByRole('button', { name: 'Fechar a escala' }));
      await waitFor(() => expect(chamadasA(f, `POST ${URL_MES}/fechar`)).toBe(1));
    });

    it('"Voltar" desiste de fechar', async () => {
      const f = abrirEscala(escala());
      await userEvent.click(await screen.findByRole('button', { name: 'Fechar a escala' }));
      await userEvent.click(within(screen.getByRole('region', { name: 'Confirmação' })).getByRole('button', { name: 'Voltar' }));
      expect(screen.queryByRole('region', { name: 'Confirmação' })).toBeNull();
      expect(chamadasA(f, `POST ${URL_MES}/fechar`)).toBe(0);
    });

    it('"Encerrar o mês" antes de fechar explica, sem chamar a API', async () => {
      const f = abrirEscala(escala());
      await userEvent.click(await screen.findByRole('button', { name: 'Encerrar o mês' }));
      expect(screen.getByText('Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.')).toBeInTheDocument();
      expect(chamadasA(f, `POST ${URL_MES}/encerrar`)).toBe(0);
    });

    it('com a escala fechada, "Encerrar o mês" pede a confirmação do encerramento', async () => {
      const f = abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00' }), { [`POST ${URL_MES}/encerrar`]: { status: 200, corpo: escala({ etapa: 'encerrada' }) } });
      await userEvent.click(await screen.findByRole('button', { name: 'Encerrar o mês' }));
      const caixa = screen.getByRole('region', { name: 'Confirmação' });
      expect(within(caixa).getByText(/Encerrar janeiro de 2027\?/)).toBeInTheDocument();
      expect(within(caixa).getByText(/Depois disso, só um ajuste no painel de saldo muda os números\./)).toBeInTheDocument();
      await userEvent.click(within(caixa).getByRole('button', { name: 'Encerrar o mês' }));
      await waitFor(() => expect(chamadasA(f, `POST ${URL_MES}/encerrar`)).toBe(1));
    });

    it('"Calcular cotas" com a escala fechada explica, sem chamar a API', async () => {
      const f = abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Calcular cotas' }));
      expect(screen.getByText('Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.')).toBeInTheDocument();
      expect(chamadasA(f, `POST ${URL_MES}/cotas`)).toBe(0);
    });

    it('"Calcular cotas" nas escolhas chama a API', async () => {
      const f = abrirEscala(escala(), { [`POST ${URL_MES}/cotas`]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('button', { name: 'Calcular cotas' }));
      await waitFor(() => expect(chamadasA(f, `POST ${URL_MES}/cotas`)).toBe(1));
    });
  });

  describe('a escala fechada', () => {
    const FECHADA = () => {
      const base = escala();
      return escala({
        etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00', vez: null,
        turnos: comNome(base, { [`${dia(5)}|t-a`]: 'm-1', [`${dia(6)}|t-a`]: ['m-3', 'm-2'] }),
      });
    };

    it('mostra a mensagem fixa, a cobertura e o turno vazio', async () => {
      abrirEscala(FECHADA());
      expect(await screen.findByText('Escala fechada em 30/12/2026. Clique num turno para trocar o nome: quem cobre ganha o turno, e quem saiu não fica devendo.')).toBeInTheDocument();
      expect(screen.getByText('cobriu BRAVO')).toBeInTheDocument();
      expect(screen.getAllByText('vazio').length).toBe(60);
    });

    it('um clique num turno abre a escolha do oficial, com "Ninguém", e grava a troca', async () => {
      const f = abrirEscala(FECHADA(), { [`PUT ${URL_MES}/turnos/${dia(5)}/t-a`]: { status: 200, corpo: FECHADA() } });
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      const caixa = screen.getByRole('dialog');
      for (const n of ['CEL ALFA', 'CAP BRAVO', 'CAP CHARLIE', 'Ninguém']) expect(within(caixa).getByRole('button', { name: n })).toBeInTheDocument();
      await userEvent.click(within(caixa).getByRole('button', { name: 'CAP CHARLIE' }));
      await waitFor(() => expect(corpoEnviado(f, `PUT ${URL_MES}/turnos/${dia(5)}/t-a`)).toEqual({ militarId: 'm-3' }));
    });
  });

  describe('os erros da API', () => {
    it('o erro de uma troca com a escala fechada aparece dentro do diálogo, que continua aberto', async () => {
      const base = escala();
      const fechada = escala({ etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00', vez: null, turnos: comNome(base, { [`${dia(5)}|t-a`]: 'm-1' }) });
      abrirEscala(fechada, { [`PUT ${URL_MES}/turnos/${dia(5)}/t-a`]: { status: 400, corpo: { erro: 'Este oficial não está na escala deste mês.' } } });
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      const caixa = screen.getByRole('dialog');
      await userEvent.click(within(caixa).getByRole('button', { name: 'CAP BRAVO' }));
      expect(await within(screen.getByRole('dialog')).findByText('Este oficial não está na escala deste mês.')).toBeInTheDocument();
    });

    it('as confirmações são anunciadas (região ao vivo)', async () => {
      abrirEscala(escala());
      await userEvent.click(await screen.findByRole('button', { name: 'Fechar a escala' }));
      expect(screen.getByRole('region', { name: 'Confirmação' }).closest('[aria-live]')).not.toBeNull();
    });
  });

  describe('o mês encerrado', () => {
    it('mostra a mensagem fixa, e o clique no turno não faz nada', async () => {
      const f = abrirEscala(escala({ etapa: 'encerrada', fechadaEm: '2026-12-30T09:00:00', encerradaEm: '2027-02-01T08:00:00', vez: null }));
      expect(await screen.findByText('Mês encerrado em 01/02/2027. O saldo de janeiro de 2027 já está no painel. Correções agora só por ajuste do gestor.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^01\/01, Dia/ })).toBeNull();
      expect(chamadasA(f, `PUT ${URL_MES}/turnos/${dia(1)}/t-a`)).toBe(0);
    });
  });

  describe('os avisos e o mês vazio', () => {
    it('cada aviso da API aparece acima do calendário, e o turno dele leva a marca de alerta', async () => {
      const texto = 'CAP BRAVO está afastado em 22/01 (Férias) e está no turno do dia. A escala pode ser fechada mesmo assim.';
      const base = escala();
      abrirEscala(escala({ turnos: comNome(base, { [`${dia(22)}|t-a`]: 'm-2' }), avisos: [{ dia: dia(22), turnoId: 't-a', militarId: 'm-2', texto }] }));
      expect(await screen.findByText(texto)).toBeInTheDocument();
      expect(screen.getByLabelText('Calendário do mês').querySelector('[data-alerta="true"]')).not.toBeNull();
    });

    it('um mês sem participantes mostra a frase, sem botões quebrados', async () => {
      abrirEscala(escala({ etapa: 'sem-cotas', cotasEm: null, oficiais: [], vez: null, turnos: [] }));
      expect(await screen.findByText('Nenhum oficial QOC ou QOA nesta unidade neste mês.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Calcular cotas' })).toBeNull();
      expect(screen.queryByLabelText('Calendário do mês')).toBeNull();
    });
  });
});

// ---- o painel de saldo e as regras ----
const reg = (r: OficialNoSaldo['registro'][number]) => r;
const S1: OficialNoSaldo = {
  militarId: 'm-1', matricula: '990101-1', posto: 'CEL', nomeGuerra: 'ALFA', quadro: 'QOC', lotacao: '2º GB', saldo: 0.75,
  meses: [{ mes: '2026-11', valor: 0.5 }, { mes: '2026-12', valor: 0.25 }], turnos: [{ rotulo: 'Dia', quantidade: 12 }, { rotulo: 'Noite', quantidade: 10 }],
  registro: [
    reg({ tipo: 'mes', data: '2026-11-30', mes: '2026-11', valor: 0.5, texto: 'Devia 20,50, tirou 21' }),
    reg({ tipo: 'cobriu', data: '2026-12-24', mes: '2026-12', valor: 1, texto: 'Cobriu CAP BRAVO em 24/12/2026.' }),
    reg({ tipo: 'mes', data: '2026-12-31', mes: '2026-12', valor: 0.25, texto: 'Devia 20,75, tirou 21' }),
  ],
};
const S2: OficialNoSaldo = {
  militarId: 'm-2', matricula: '990102-2', posto: 'CAP', nomeGuerra: 'BRAVO', quadro: 'QOA', lotacao: '1ª SB', saldo: -0.25,
  meses: [{ mes: '2026-12', valor: -0.65 }], turnos: [{ rotulo: 'Dia', quantidade: 4 }, { rotulo: 'Noite', quantidade: 5 }],
  registro: [
    reg({ tipo: 'entrada', data: '2026-12-10', mes: '2026-12', valor: 0.4, texto: 'Entrou com a média dos saldos de quem já estava.' }),
    reg({ tipo: 'mes', data: '2026-12-31', mes: '2026-12', valor: -0.65, texto: 'Devia 9,65, tirou 9' }),
  ],
};
function abrirSaldo(lista: OficialNoSaldo[], extra: Record<string, { status: number; corpo?: unknown }> = {}) {
  const f = simularApi({
    '/api/eu': { status: 200, corpo: GESTOR },
    [`GET ${URL_MES}`]: { status: 200, corpo: escala() },
    'GET /api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: lista },
    'GET /api/unidades/u-gb/servicos': { status: 200, corpo: [SERVICO] },
    ...extra,
  });
  abrir(`/oficiais?mes=${MES}&aba=saldo`);
  return f;
}

describe('o painel de saldo', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('abre com o texto do mockup e uma linha por oficial, com o saldo, os meses e as contagens escritas', async () => {
    abrirSaldo([S1, S2]);
    expect(await screen.findByText(/O saldo mostra quem trabalhou mais ou menos do que devia, somando todos os meses\./)).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Saldo de cada oficial' });
    const linha = within(tabela).getByRole('row', { name: /CEL ALFA/ });
    expect(within(linha).getByText('+0,75')).toBeInTheDocument();
    expect(within(linha).getByText('+0,50')).toBeInTheDocument();
    expect(within(linha).getByText('Dia 12')).toBeInTheDocument();
    expect(within(linha).getByText('Noite 10')).toBeInTheDocument();
    expect(within(within(tabela).getByRole('row', { name: /CAP BRAVO/ })).getByText('−0,25')).toBeInTheDocument();
    expect(tabela.querySelectorAll('svg').length).toBe(0);
  });

  it('um clique no oficial abre o registro: do mais novo para o mais velho, com a entrada e o saldo agora', async () => {
    abrirSaldo([S1, S2]);
    await userEvent.click(await screen.findByRole('button', { name: 'CAP BRAVO' }));
    const painel = screen.getByRole('region', { name: 'Registro' });
    expect(within(painel).getByText('Registro: CAP BRAVO 990102-2')).toBeInTheDocument();
    expect(painel).toHaveTextContent('Começou com +0,40, a média dos saldos dos colegas.');
    expect(painel).toHaveTextContent('Saldo agora: −0,25');
    await userEvent.click(screen.getByRole('button', { name: 'CEL ALFA' }));
    const itens = within(screen.getByRole('region', { name: 'Registro' })).getAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Devia 20,75, tirou 21');
    expect(itens[1]).toHaveTextContent('Cobriu CAP BRAVO em 24/12/2026.');
    expect(itens[2]).toHaveTextContent('Devia 20,50, tirou 21');
  });

  it('o ajuste sem motivo mostra a mensagem no campo, sem chamar a API; com motivo, lança', async () => {
    const f = abrirSaldo([S1], { 'POST /api/unidades/u-gb/oficiais-saldo/ajustes': { status: 201, corpo: S1 } });
    await userEvent.click(await screen.findByRole('button', { name: 'CEL ALFA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste manual' }));
    await userEvent.type(screen.getByLabelText('Valor do ajuste'), '0,5');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar ajuste' }));
    expect(await screen.findByText('Diga o motivo do ajuste.')).toBeInTheDocument();
    expect(chamadasA(f, 'POST /api/unidades/u-gb/oficiais-saldo/ajustes')).toBe(0);
    await userEvent.type(screen.getByLabelText('Motivo (obrigatório)'), 'Dispensa médica lançada depois');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar ajuste' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-gb/oficiais-saldo/ajustes')).toEqual({ militarId: 'm-1', valor: 0.5, motivo: 'Dispensa médica lançada depois' }));
  });

  it('o valor zero ou que não é número é recusado no campo', async () => {
    const f = abrirSaldo([S1]);
    await userEvent.click(await screen.findByRole('button', { name: 'CEL ALFA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste manual' }));
    await userEvent.type(screen.getByLabelText('Motivo (obrigatório)'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar ajuste' }));
    expect(await screen.findByText('Informe um valor diferente de zero, de até 100.')).toBeInTheDocument();
    expect(chamadasA(f, 'POST /api/unidades/u-gb/oficiais-saldo/ajustes')).toBe(0);
  });

  it('"Cancelar" fecha o formulário', async () => {
    abrirSaldo([S1]);
    await userEvent.click(await screen.findByRole('button', { name: 'CEL ALFA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajuste manual' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Valor do ajuste')).toBeNull();
  });

  it('sem nenhum oficial no painel, diz que não há saldo ainda', async () => {
    abrirSaldo([]);
    expect(await screen.findByText('Ainda não há saldo: ele aparece quando o primeiro mês for encerrado.')).toBeInTheDocument();
  });
});

describe('as regras', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('mostra os títulos e a tabela do exemplo', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      [`GET ${URL_MES}`]: { status: 200, corpo: escala() },
      'GET /api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: [] },
      'GET /api/unidades/u-gb/servicos': { status: 200, corpo: [SERVICO] },
    });
    abrir(`/oficiais?mes=${MES}&aba=regras`);
    for (const t of ['Como a escala é montada', 'Como a cota é calculada', 'O saldo', 'O que muda o saldo', 'Os dois momentos do mês', 'O que fica registrado']) {
      expect(await screen.findByRole('heading', { name: t })).toBeInTheDocument();
    }
    const ex = screen.getByRole('table', { name: 'Exemplo de 62 turnos' });
    for (const n of ['8,25', '4,26', '−0,26']) expect(within(ex).getAllByText(n).length).toBeGreaterThan(0);
  });
});
