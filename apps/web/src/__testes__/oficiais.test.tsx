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
  matricula: '990100-0', quadro: 'QOC', lotacao: '2º GB', semAntiguidade: false, saldoAnterior: 0, dias: 31, devido: 20.5, cota: 21, sobra: false, escolhidos: 0, afastamentos: [], ...o,
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
