import type { EscalaDosOficiais, OficialDoMes, OficialNoSaldo } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { guardarUnidade } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, responderConfirmacao, simularApi, trava } from './apoio';

// Dados fictícios (D7): o 2º GB, oficiais 990xxx-x.
const UNIDADE = { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento' };
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
    mes: MES, etapa: 'nao-aberto', abertaEm: null, fechadaEm: null, encerradaEm: null, escala: { id: 'e-of', nome: 'Oficiais de operações' }, escalas: [{ id: 'e-of', nome: 'Oficiais de operações' }],
    servicos: { jes: null, saldo: null }, turnosDoServico: [], oficiais: [], vez: null, turnos: [], lugaresDeSaldo: 0, jes: { cota: null, usados: 0 }, diasVermelhos: [], avisos: [],
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
    // o aviso aparece uma vez e sai do endereço (6.16)
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
  });

  it('item 20 (6.18): o gestor de outra seção, que não alcança a unidade escolhida, também volta ao início com o aviso', async () => {
    const outraSecao = { id: 'u-2sb', sigla: '2ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], nivel: 4, tipo: 'secao' };
    const naPrimeira = { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao' };
    // o nível é só na 2ª SB, e a pessoa trabalha na 1ª SB (a unidade guardada na aba)
    guardarUnidade('u-1sb');
    simularApi(rotas({ ...EU_EXEMPLO, papeis: [{ papel: 'gestor', unidadeId: 'u-2sb', unidadeSigla: '2ª SB' }], unidades: [naPrimeira, outraSecao] }));
    const router = abrir(`/oficiais?mes=${MES}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
  });

  it('a página mostra o título, o subtítulo e as duas abas (as regras abrem pelo botão, na Escala do mês)', async () => {
    simularApi(rotas(GESTOR));
    abrir(`/oficiais?mes=${MES}`);
    expect(await screen.findByRole('heading', { name: 'Escala dos oficiais' })).toBeInTheDocument();
    expect(screen.getByText('Oficiais QOC e QOA.')).toBeInTheDocument();
    for (const aba of ['Escala do mês', 'Painel de saldo']) expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Regras' })).toBeNull();
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
const LETRA: Record<string, string> = { 't-a': 'A', 't-b': 'B' };
const vazios = (): EscalaDosOficiais['turnos'] => Array.from({ length: 31 }, (_, i) => i + 1).flatMap((n) => ['t-a', 't-b'].map((turnoId) => ({ dia: dia(n), letra: LETRA[turnoId]!, turnoId, servico: null, alocacaoId: null, militarId: null as string | null, saiuMilitarId: null as string | null })));
const oficial = (o: Partial<OficialDoMes> & Pick<OficialDoMes, 'militarId' | 'nomeGuerra' | 'posto' | 'ordem'>): OficialDoMes => ({
  matricula: '990100-0', quadro: 'QOC', lotacao: '2º GB', semAntiguidade: false, saldoAnterior: 0, saldoPrevisto: o.saldoAnterior ?? 0, dias: 31, devido: 20.5, cota: 21, sobra: false, escolhidos: 0, jes: 0, vermelhos: 0, voluntarioJes: false, afastamentos: [], participa: true, novo: false, ...o,
});
const O1 = oficial({ militarId: 'm-1', nomeGuerra: 'ALFA', posto: 'CEL', ordem: 1, matricula: '990101-1', saldoAnterior: 0.75 });
const O2 = oficial({ militarId: 'm-2', nomeGuerra: 'BRAVO', posto: 'CAP', ordem: 2, matricula: '990102-2', semAntiguidade: true, cota: 21, sobra: true });
const O3 = oficial({ militarId: 'm-3', nomeGuerra: 'CHARLIE', posto: 'CAP', ordem: 3, matricula: '990103-3', semAntiguidade: true, cota: 20, saldoAnterior: -0.25 });
const escala = (e: Partial<EscalaDosOficiais> = {}): EscalaDosOficiais => ({
  mes: MES, etapa: 'escolhas', abertaEm: '2026-12-28T10:12:00', fechadaEm: null, encerradaEm: null,
  escala: { id: 'e-of', nome: 'Oficiais de operações' }, escalas: [{ id: 'e-of', nome: 'Oficiais de operações' }],
  servicos: { jes: { id: 's-jes', nome: 'JES' }, saldo: { id: 's-op', nome: 'Saldo' } }, turnosDoServico: TURNOS_DO_SERVICO,
  oficiais: [O1, O2, O3], vez: 'm-1', turnos: vazios(), lugaresDeSaldo: 62, jes: { cota: 30, usados: 4 }, diasVermelhos: [], avisos: [], ...e,
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
    return m ? { ...t, servico: 'saldo' as const, alocacaoId: `a-${t.dia}-${t.letra}`, militarId: Array.isArray(m) ? m[0] : m, saiuMilitarId: Array.isArray(m) ? m[1] : null } : t;
  });
const celula = (d: number, turno: 'Dia' | 'Noite') => screen.getByRole('button', { name: new RegExp(`^${String(d).padStart(2, '0')}/01, ${turno}, ${turno === 'Dia' ? '07h às 19h' : '19h às 07h'}`) });

describe('a aba Escala do mês', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('a escala', () => {
    it('sem serviço de Saldo, pede para cadastrar e deixa "Abrir o mês" desligado', async () => {
      abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, servicos: { jes: null, saldo: null }, turnosDoServico: [], vez: null, turnos: [] }));
      expect(await screen.findByText('A escala precisa de um serviço de Saldo, com turnos. Cadastre em Escalas.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abrir o mês' })).toBeDisabled();
    });

    it('o campo "Escala" lista as escalas da unidade com rodada de cotas; escolher outra busca de novo, com a escala no endereço', async () => {
      const outra = { id: 'e-2', nome: 'Oficiais da seção' };
      const f = abrirEscala(escala({ escalas: [{ id: 'e-of', nome: 'Oficiais de operações' }, outra] }));
      const campo = await screen.findByLabelText('Escala');
      await waitFor(() => expect(campo).toHaveValue('e-of'));
      expect(within(campo).getAllByRole('option').map((o) => o.textContent)).toEqual(['Oficiais de operações', 'Oficiais da seção']);
      expect(screen.queryByLabelText('Serviço')).toBeNull();
      await userEvent.selectOptions(campo, 'e-2');
      await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes(`${URL_MES}?escala=e-2`))).toBe(true));
    });

    it('sem nenhuma escala com rodada de cotas, diz como cadastrar e leva a Escalas', async () => {
      abrirEscala(escala({ escala: null, escalas: [], etapa: 'nao-aberto', abertaEm: null, servicos: { jes: null, saldo: null }, turnosDoServico: [], oficiais: [], vez: null, turnos: [] }));
      expect(await screen.findByText(/A unidade ainda não tem uma escala com rodada de cotas\./)).toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Escalas' })).toHaveAttribute('href', '/escalas');
    });

    it('o lugar mostra JES ou Saldo na placa, e o leitor de tela ouve qual é', async () => {
      const base = escala();
      const turnos = base.turnos.map((t) => (t.dia === dia(4) && t.letra === 'A' ? { ...t, servico: 'jes' as const, alocacaoId: 'a-jes', militarId: 'm-1' } : t.dia === dia(4) && t.letra === 'B' ? { ...t, servico: 'saldo' as const, alocacaoId: 'a-sal', militarId: 'm-2' } : t));
      abrirEscala(escala({ turnos }));
      await screen.findByText('2 de 62 turnos com nome');
      const cal = screen.getByLabelText('Calendário do mês');
      expect(cal.querySelector('[data-servico="jes"]')).toHaveTextContent('JES');
      expect(cal.querySelector('[data-servico="saldo"]')).toHaveTextContent('Saldo');
      expect(within(cal).getByText('04/01, Dia, 07h às 19h (JES)', { exact: false })).toBeInTheDocument();
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

    it('sem desenho de sol ou lua: nenhuma célula tem ícone, e o Dia e a Noite se distinguem sem o bloco preto', async () => {
      abrirEscala(escala());
      await screen.findByText('0 de 62 turnos com nome');
      const cal = screen.getByLabelText('Calendário do mês');
      expect(cal.querySelectorAll('svg').length).toBe(0);
      expect(celula(1, 'Dia')).toHaveAttribute('data-turno', 'dia');
      expect(celula(1, 'Noite')).toHaveAttribute('data-turno', 'noite');
    });

    it('conta os turnos com nome', async () => {
      const base = escala();
      abrirEscala(escala({ turnos: comNome(base, { [`${dia(1)}|t-a`]: 'm-1', [`${dia(1)}|t-b`]: 'm-1' }) }));
      expect(await screen.findByText('2 de 62 turnos com nome')).toBeInTheDocument();
    });
  });

  describe('escalar por serviço, oficial e clique (6.29)', () => {
    const URL_LANC = `POST ${URL_MES}/lancamentos`;
    const URL_TIRAR = (d: number, letra: string) => `DELETE ${URL_MES}/lancamentos/a-${dia(d)}-${letra}`;
    const escolher = async (nome: RegExp | string) => userEvent.click(await screen.findByRole('button', { name: nome }));
    const lista = () => screen.getByRole('list', { name: 'Cotas de janeiro de 2027' });
    const doOficial = (nome: string) => within(lista()).getByRole('button', { name: new RegExp(nome) });
    const servico = (nome: 'JES' | 'Saldo') => screen.getByRole('radio', { name: nome });

    // um servidor que responde como o de verdade: guarda os lançamentos, conta as cotas e passa a vez
    function servidorVivo(inicial: EscalaDosOficiais, opcoes: { esperaDoPost?: Promise<void> } = {}) {
      let estado = inicial;
      const lancados: { dia: string; letra: string; servico: string; militarId: string }[] = [];
      const f = abrirEscala(inicial);
      const original = f.getMockImplementation()!;
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const recontar = (e0: EscalaDosOficiais): EscalaDosOficiais => {
        const oficiais = e0.oficiais.map((o) => ({
          ...o,
          escolhidos: e0.turnos.filter((t) => t.militarId === o.militarId && t.servico === 'saldo').length + (inicial.oficiais.find((x) => x.militarId === o.militarId)!.escolhidos),
          jes: e0.turnos.filter((t) => t.militarId === o.militarId && t.servico === 'jes').length,
        }));
        return { ...e0, oficiais, vez: oficiais.find((o) => o.cota !== null && o.escolhidos < o.cota)?.militarId ?? null };
      };
      f.mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
        const caminho = new URL(url, 'http://localhost').pathname;
        const metodo = (init?.method ?? 'GET').toUpperCase();
        if (caminho === URL_MES && metodo === 'GET') return json(estado);
        if (caminho === `${URL_MES}/lancamentos` && metodo === 'POST') {
          await opcoes.esperaDoPost;
          const corpo = JSON.parse(String(init!.body)) as { dia: string; letra: string; servico: 'jes' | 'saldo'; militarId: string };
          lancados.push(corpo);
          estado = recontar({ ...estado, turnos: estado.turnos.map((t) => (t.dia === corpo.dia && t.letra === corpo.letra ? { ...t, servico: corpo.servico, alocacaoId: `a-${t.dia}-${t.letra}`, militarId: corpo.militarId } : t)) });
          return json(estado);
        }
        if (metodo === 'DELETE' && caminho.startsWith(`${URL_MES}/lancamentos/`)) {
          const id = caminho.split('/').at(-1)!;
          estado = recontar({ ...estado, turnos: estado.turnos.map((t) => (t.alocacaoId === id ? { ...t, servico: null, alocacaoId: null, militarId: null } : t)) });
          return json(estado);
        }
        return original(entrada, init);
      });
      return { f, lancados, estado: () => estado };
    }

    it('"Escalar: JES | Saldo" no alto do calendário, com o Saldo escolhido de começo; escolhendo JES, mostra o que resta da cota de JES da unidade', async () => {
      abrirEscala(escala({ jes: { cota: 30, usados: 4 } }));
      const grupo = await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['JES', 'Saldo']);
      expect(servico('Saldo')).toBeChecked();
      expect(servico('JES')).not.toBeChecked();
      await userEvent.click(servico('JES'));
      expect(within(screen.getByText(/JES restam/).closest('p')!).getByText('26')).toHaveClass('font-cond');
      expect(screen.getByText(/JES restam/).closest('p')).toHaveTextContent('JES restam 26 de 30');
    });

    it('sem cota de JES cadastrada, diz "Sem cota de JES cadastrada no mês."; só aparece com o JES escolhido', async () => {
      abrirEscala(escala({ jes: { cota: null, usados: 3 } }));
      await userEvent.click(await screen.findByRole('radio', { name: 'JES' }));
      expect(await screen.findByText('Sem cota de JES cadastrada no mês.')).toBeInTheDocument();
      await userEvent.click(servico('Saldo'));
      expect(screen.queryByText('Sem cota de JES cadastrada no mês.')).toBeNull();
    });

    it('com a cota de JES acabada, o número fica âmbar e diz "A cota de JES do mês acabou."; lançar continua permitido', async () => {
      const { f, lancados } = servidorVivo(escala({ jes: { cota: 4, usados: 4 } }));
      await userEvent.click(await screen.findByRole('radio', { name: 'JES' }));
      expect(await screen.findByText('A cota de JES do mês acabou.')).toBeInTheDocument();
      expect(within(screen.getByText(/JES restam/).closest('p')!).getByText('0')).toHaveClass('text-pendencia', 'bg-pendencia-fundo');
      await userEvent.click(doOficial('CAP BRAVO'));
      await userEvent.click(await screen.findByRole('button', { name: /^03\/01, Dia/ }));
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'A', servico: 'jes', militarId: 'm-2' }]));
      expect(chamadasA(f, URL_LANC)).toBe(1);
    });

    it('com o JES escolhido a lista mostra todos os participantes e nenhum vem escolhido; sem oficial escolhido, o clique no turno pede para escolher, sem chamar a API', async () => {
      const f = abrirEscala(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      for (const n of ['CEL ALFA', 'CAP BRAVO', 'CAP CHARLIE']) expect(doOficial(n)).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByText('Escolha um oficial na lista.').length).toBeGreaterThan(0);
      await userEvent.click(await screen.findByRole('button', { name: /^03\/01, Dia/ }));
      expect(screen.getAllByText('Escolha um oficial na lista.').length).toBeGreaterThan(0);
      expect(chamadasA(f, URL_LANC)).toBe(0);
    });

    it('JES vale para qualquer participante (sem a exigência de ser voluntário): escolher o oficial e clicar no turno lança "jes"', async () => {
      const { lancados } = servidorVivo(escala({ oficiais: [O1, { ...O2, voluntarioJes: false }, O3] }));
      await userEvent.click(await screen.findByRole('radio', { name: 'JES' }));
      await userEvent.click(doOficial('CAP BRAVO'));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'A', servico: 'jes', militarId: 'm-2' }]));
    });

    it('com Saldo e o oficial escolhido na lista, um clique no turno lança como Saldo', async () => {
      const { lancados } = servidorVivo(escala());
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      expect(doOficial('CEL ALFA')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/Escalando/).closest('p')).toHaveTextContent('Escalando CEL ALFA no Saldo: clique nos turnos.');
      await escolher(/^03\/01, Noite/);
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'B', servico: 'saldo', militarId: 'm-1' }]));
    });

    it('a ordem é só uma sugestão: escolher outro oficial e lançar grava e mostra "Fora da ordem: a vez era de…"', async () => {
      const aviso = 'Fora da ordem: a vez era de CEL ALFA.';
      const f = abrirEscala(escala(), { [URL_LANC]: { status: 200, corpo: { ...escala(), foraDaOrdem: aviso } } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await userEvent.click(doOficial('CAP CHARLIE'));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(corpoEnviado(f, URL_LANC)).toMatchObject({ militarId: 'm-3', servico: 'saldo' }));
      expect(await screen.findByText(aviso)).toBeInTheDocument();
    });

    it('Review Focus 1: cliques seguidos em vários dias lançam todos, na ordem, uma vez cada (sem esperar a resposta de cada um)', async () => {
      const t = trava();
      const { f, lancados } = servidorVivo(escala(), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      for (const d of [3, 4, 5]) await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^0${d}/01, Dia`) }));
      t.soltar();
      await waitFor(() => expect(lancados.map((l) => l.dia)).toEqual([dia(3), dia(4), dia(5)]));
      expect(chamadasA(f, URL_LANC)).toBe(3);
    });

    it('duplo clique no mesmo turno lança uma vez só', async () => {
      const t = trava();
      const { f } = servidorVivo(escala(), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await userEvent.dblClick(await screen.findByRole('button', { name: /^03\/01, Dia/ }));
      t.soltar();
      await waitFor(() => expect(chamadasA(f, URL_LANC)).toBe(1));
    });

    it('um clique no turno do próprio oficial e serviço escolhidos tira o lançamento', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-1' }) }), { [URL_TIRAR(2, 'A')]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await escolher(/^02\/01, Dia.*ALFA/);
      await waitFor(() => expect(chamadasA(f, URL_TIRAR(2, 'A'))).toBe(1));
    });

    it('um clique no turno de outro oficial pergunta "Trocar {A} por {B}?": "Cancelar" não lança, "Trocar" lança', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) }), { [URL_LANC]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await escolher(/^02\/01, Dia.*BRAVO/);
      const pergunta = within(await screen.findByRole('dialog', { name: 'Trocar CAP BRAVO por CEL ALFA?' }));
      await userEvent.click(pergunta.getByRole('button', { name: 'Cancelar' }));
      expect(chamadasA(f, URL_LANC)).toBe(0);
      await escolher(/^02\/01, Dia.*BRAVO/);
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Trocar' }));
      await waitFor(() => expect(corpoEnviado(f, URL_LANC)).toEqual({ dia: dia(2), letra: 'A', servico: 'saldo', militarId: 'm-1' }));
    });

    it('Review Focus 4: o oficial escolhido afastado naquele dia não é lançado: a tela diz o afastamento, sem chamar a API', async () => {
      const f = abrirEscala(escala({ oficiais: [{ ...O1, afastamentos: [{ inicio: dia(10), fim: dia(11), tipo: 'Férias' }] }, O2, O3] }));
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await escolher(/^10\/01, Dia/);
      expect(await screen.findByText('CEL ALFA está afastado em 10/01 (Férias) e não pode ficar com este turno.')).toBeInTheDocument();
      expect(chamadasA(f, URL_LANC)).toBe(0);
    });

    it('revisão final: clicar num turno de outro serviço (JES escolhido, turno de Saldo) avisa na tela, sem perguntar "Trocar" e sem chamar a API', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) }));
      await userEvent.click(await screen.findByRole('radio', { name: 'JES' }));
      await userEvent.click(await screen.findByRole('button', { name: /^CEL ALFA/ }));
      await escolher(/^02\/01, Dia.*BRAVO/);
      expect(await screen.findByText('Este turno é Saldo. Mude para Saldo para tirar ou trocar.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(chamadasA(f, URL_LANC)).toBe(0);
      // o próprio oficial, em outro serviço, também não vai ao servidor
      await userEvent.click(within(lista()).getByRole('button', { name: /^CAP BRAVO/ }));
      await escolher(/^02\/01, Dia.*BRAVO/);
      expect(await screen.findByText('Este turno é Saldo. Mude para Saldo para tirar ou trocar.')).toBeInTheDocument();
      expect(chamadasA(f, URL_LANC)).toBe(0);
      expect(chamadasA(f, URL_TIRAR(2, 'A'))).toBe(0);
    });

    it('revisão final: com a escala fechada, a escolha à mão não cai quando o oficial já está na cota (várias coberturas seguidas)', async () => {
      const fechada = escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00', vez: null, oficiais: [{ ...O1, cota: 2, escolhidos: 2 }, O2, O3] });
      const { lancados } = servidorVivo(fechada);
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await userEvent.click(within(lista()).getByRole('button', { name: /^CEL ALFA/ }));
      await escolher(/^03\/01, Dia/);
      await escolher(/^04\/01, Dia/);
      await waitFor(() => expect(lancados.map((l) => l.militarId)).toEqual(['m-1', 'm-1']));
      expect(screen.queryByText('Escolha um oficial na lista.', { selector: 'p.font-medium' })).toBeNull();
    });

    it('revisão final: enquanto a fila grava, "Fechar a escala" e as marcas da lista ficam desligadas', async () => {
      const t = trava();
      servidorVivo(escala(), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar a escala' })).toBeDisabled());
      expect(screen.getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeDisabled();
      t.soltar();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar a escala' })).toBeEnabled());
    });

    it('sem o serviço JES na escala, a opção JES fica desligada, com a dica, e o Saldo vem escolhido', async () => {
      abrirEscala(escala({ servicos: { jes: null, saldo: { id: 's-op', nome: 'Saldo' } } }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(servico('JES')).toBeDisabled();
      expect(servico('JES')).toHaveAttribute('title', 'A escala não tem o serviço JES.');
      expect(servico('Saldo')).toBeChecked();
    });

    it('o erro da API (a escala mudou) aparece na tela, e os dados vêm de novo', async () => {
      const f = abrirEscala(escala(), { [URL_LANC]: { status: 409, corpo: { erro: 'A escala mudou. Confira os turnos.' } } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CEL ALFA'));
      const antes = chamadasA(f, `GET ${URL_MES}`);
      await escolher(/^03\/01, Dia/);
      expect(await screen.findByRole('alert')).toHaveTextContent('A escala mudou. Confira os turnos.');
      await waitFor(() => expect(chamadasA(f, `GET ${URL_MES}`)).toBeGreaterThan(antes));
    });

    it('a vez é uma etiqueta na linha do oficial, e escolher um oficial marca a linha dele', async () => {
      abrirEscala(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(within(doOficial('CEL ALFA')).getByText('a vez')).toBeInTheDocument();
      await userEvent.click(doOficial('CAP CHARLIE'));
      expect(doOficial('CAP CHARLIE')).toHaveAttribute('aria-pressed', 'true');
      expect(doOficial('CAP CHARLIE').closest('li')).toHaveClass('ring-2', 'ring-tinta');
    });

  describe('segundo retorno do usuário (6.29.2): escolher, tirar e lançar sem travar a ordem', () => {
    const URL_LANC = `POST ${URL_MES}/lancamentos`;
    const URL_TIRAR = (d: number, letra: string) => `DELETE ${URL_MES}/lancamentos/a-${dia(d)}-${letra}`;
    const lista = () => screen.getByRole('list', { name: 'Cotas de janeiro de 2027' });
    const doOficial = (nome: string) => within(lista()).getByRole('button', { name: new RegExp(nome) });
    const turno = (d: number, t: 'Dia' | 'Noite') => screen.findByRole('button', { name: new RegExp(`^${String(d).padStart(2, '0')}/01, ${t}`) });

    it('o serviço que vem escolhido ao abrir a tela é Saldo, mesmo havendo JES, e ninguém vem escolhido: a vez só fica destacada', async () => {
      abrirEscala(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(screen.getByRole('radio', { name: 'Saldo' })).toBeChecked();
      expect(screen.queryByText(/JES restam/)).toBeNull();
      for (const n of ['CEL ALFA', 'CAP BRAVO', 'CAP CHARLIE']) expect(doOficial(n)).toHaveAttribute('aria-pressed', 'false');
      const alfa = doOficial('CEL ALFA').closest('li')!;
      expect(alfa).toHaveClass('border-vinho', 'bg-vinho/10');
      expect(alfa).not.toHaveClass('ring-2');
      expect(doOficial('CAP BRAVO').closest('li')).not.toHaveClass('border-vinho');
    });

    it('qualquer oficial se escolhe, em qualquer ordem: do mais moderno ao mais antigo e de volta, e cada clique lança o escolhido', async () => {
      const { lancados } = servidorVivo(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      for (const [nome, d] of [['CAP CHARLIE', 3], ['CAP BRAVO', 4], ['CEL ALFA', 5], ['CAP CHARLIE', 6]] as const) {
        await userEvent.click(doOficial(nome));
        expect(doOficial(nome)).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(await turno(d, 'Dia'));
      }
      await waitFor(() => expect(lancados.map((l) => l.militarId)).toEqual(['m-3', 'm-2', 'm-1', 'm-3']));
      // o oficial da vez segue destacado, mas não é o que está escolhido
      expect(doOficial('CEL ALFA').closest('li')).toHaveClass('border-vinho', 'bg-vinho/10');
    });

    it('o oficial que completa a cota continua escolhido (nada passa sozinho para a vez)', async () => {
      const curto = escala({ oficiais: [{ ...O1, cota: 1, escolhidos: 0 }, O2, O3] });
      const { lancados } = servidorVivo(curto);
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(doOficial('CEL ALFA'));
      await userEvent.click(await turno(3, 'Dia'));
      await userEvent.click(await turno(4, 'Dia'));
      await waitFor(() => expect(lancados.map((l) => l.militarId)).toEqual(['m-1', 'm-1']));
      expect(doOficial('CEL ALFA')).toHaveAttribute('aria-pressed', 'true');
    });

    it('depois de lançar, nenhuma placa guarda contorno: o último turno lançado não fica marcado nem avisado', async () => {
      servidorVivo(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(doOficial('CAP BRAVO'));
      await userEvent.click(await turno(3, 'Dia'));
      await waitFor(() => expect(document.querySelector('[data-servico="saldo"]')).not.toBeNull());
      expect(document.querySelector('[data-recente]')).toBeNull();
      expect(screen.queryByText(/ficou com o turno/)).toBeNull();
      for (const placa of screen.getByLabelText('Calendário do mês').querySelectorAll<HTMLElement>('[data-turno]')) {
        expect(placa.className).not.toMatch(/(^|\s)(ring-2|outline-2)(\s|$)/);
        expect(placa.className).not.toMatch(/(^|\s)focus:/);
      }
    });

    it('clicar fora de uma placa (no fundo, no texto, no calendário vazio) tira a escolha do oficial; clicar na placa não tira', async () => {
      servidorVivo(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(doOficial('CAP BRAVO'));
      expect(doOficial('CAP BRAVO')).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(await turno(3, 'Dia'));
      expect(doOficial('CAP BRAVO')).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(screen.getByRole('heading', { name: 'Turnos do mês' }));
      expect(doOficial('CAP BRAVO')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Escolha um oficial na lista.')).toBeInTheDocument();
      await userEvent.click(doOficial('CAP BRAVO'));
      await userEvent.click(screen.getByRole('heading', { name: 'Cota de saldo' }));
      expect(doOficial('CAP BRAVO')).toHaveAttribute('aria-pressed', 'false');
    });

    it('sem oficial escolhido, clicar numa placa preenchida pergunta "Remover … do dia dd/mm (Dia|Noite)?"; "Remover" tira o lançamento e "Cancelar" não faz nada', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-1', [`${dia(2)}|t-b`]: 'm-2' }) }), { [URL_TIRAR(2, 'B')]: { status: 200, corpo: escala() } });
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(await screen.findByRole('button', { name: /^02\/01, Noite.*BRAVO/ }));
      const pergunta = await screen.findByRole('dialog', { name: 'Remover CAP BRAVO do dia 02/01 (Noite)?' });
      await userEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
      expect(chamadasA(f, URL_TIRAR(2, 'B'))).toBe(0);
      await userEvent.click(await screen.findByRole('button', { name: /^02\/01, Dia.*ALFA/ }));
      expect(await screen.findByRole('dialog', { name: 'Remover CEL ALFA do dia 02/01 (Dia)?' })).toBeInTheDocument();
    });

    it('confirmar a remoção chama a API de tirar o lançamento daquele turno', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-b`]: 'm-2' }) }), { [URL_TIRAR(2, 'B')]: { status: 200, corpo: escala() } });
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(await screen.findByRole('button', { name: /^02\/01, Noite.*BRAVO/ }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remover' }));
      await waitFor(() => expect(chamadasA(f, URL_TIRAR(2, 'B'))).toBe(1));
    });

    it('sem oficial escolhido, clicar numa placa livre abre a lista dos participantes com busca por nome (sem acento nem caixa); escolher lança no serviço escolhido', async () => {
      const acento = oficial({ militarId: 'm-4', nomeGuerra: 'JOSÉ', posto: 'TEN', ordem: 4, matricula: '990104-4' });
      const { lancados } = servidorVivo(escala({ oficiais: [O1, O2, O3, acento, oficial({ militarId: 'm-5', nomeGuerra: 'FORA', posto: 'MAJ', ordem: 5, participa: false, cota: null, devido: null })] }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(await turno(3, 'Noite'));
      const janela = await screen.findByRole('dialog', { name: /Escolher oficial/ });
      expect(within(janela).getAllByRole('button', { name: /^(CEL|CAP|TEN) / }).map((b) => b.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('ALFA'), expect.stringContaining('JOSÉ')]));
      expect(within(janela).queryByRole('button', { name: /FORA/ })).toBeNull();
      await userEvent.type(within(janela).getByRole('searchbox', { name: 'Buscar por nome' }), 'jose');
      expect(within(janela).queryByRole('button', { name: /ALFA/ })).toBeNull();
      await userEvent.click(within(janela).getByRole('button', { name: /JOSÉ/ }));
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'B', servico: 'saldo', militarId: 'm-4' }]));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('a busca sem resultado diz "Nenhum oficial com esse nome."; o oficial afastado no dia não é lançado, e a tela diz o afastamento', async () => {
      const f = abrirEscala(escala({ oficiais: [{ ...O1, afastamentos: [{ inicio: dia(10), fim: dia(11), tipo: 'Férias' }] }, O2, O3] }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(await turno(10, 'Dia'));
      const janela = await screen.findByRole('dialog', { name: /Escolher oficial/ });
      await userEvent.type(within(janela).getByRole('searchbox', { name: 'Buscar por nome' }), 'zzz');
      expect(within(janela).getByText('Nenhum oficial com esse nome.')).toBeInTheDocument();
      await userEvent.clear(within(janela).getByRole('searchbox', { name: 'Buscar por nome' }));
      await userEvent.click(within(janela).getByRole('button', { name: /ALFA/ }));
      expect(await screen.findByText('CEL ALFA está afastado em 10/01 (Férias) e não pode ficar com este turno.')).toBeInTheDocument();
      expect(chamadasA(f, URL_LANC)).toBe(0);
    });

    it('com oficial escolhido, clicar na placa livre lança direto, sem abrir a lista', async () => {
      const { lancados } = servidorVivo(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(doOficial('CAP BRAVO'));
      await userEvent.click(await turno(3, 'Dia'));
      await waitFor(() => expect(lancados).toHaveLength(1));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sai a marca "novo" do nome do oficial', async () => {
      abrirEscala(escala({ oficiais: [O1, { ...O2, novo: true }, O3] }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(within(lista()).queryByText('novo')).toBeNull();
    });

    it('a linha do oficial mostra o saldo do mês em prévia: "Saldo 0,00 → −0,50 no mês" (devido 1,5, tirou 1), e muda a cada lançamento', async () => {
      abrirEscala(escala({ oficiais: [{ ...O1, saldoAnterior: 0, devido: 1.5, cota: 2, escolhidos: 1, saldoPrevisto: -0.5 }, O2, O3] }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      const alfa = doOficial('CEL ALFA').closest('li')!;
      expect(within(alfa).getByText('Saldo 0,00 → −0,50 no mês')).toBeInTheDocument();
    });

    it('antes de abrir o mês (sem cota), a linha não traz prévia', async () => {
      abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [], oficiais: [{ ...O1, cota: null, devido: null }, O2, O3] }));
      await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
      expect(screen.queryByText(/→ .* no mês$/)).toBeNull();
    });

    it('os dias vermelhos têm um botão "Marcar dias vermelhos" ao lado do seletor de serviço: ligado, diz "Concluir", e clicar no dia marca ou tira; desligado, o número do dia não é botão', async () => {
      const f = abrirEscala(escala(), { [`POST ${URL_MES}/dias-vermelhos/marcar`]: { status: 200, corpo: escala({ diasVermelhos: [dia(5)] }) } });
      const grupo = await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(screen.queryByRole('button', { name: /^Dia vermelho: / })).toBeNull();
      const botao = screen.getByRole('button', { name: 'Marcar dias vermelhos' });
      expect(botao.compareDocumentPosition(grupo) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(botao).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(botao);
      expect(screen.getByRole('button', { name: 'Concluir' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(screen.getByRole('button', { name: 'Dia vermelho: 05/01' }));
      await waitFor(() => expect(corpoEnviado(f, `POST ${URL_MES}/dias-vermelhos/marcar`)).toEqual({ dia: dia(5), vermelho: true }));
      await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
      expect(screen.queryByRole('button', { name: /^Dia vermelho: / })).toBeNull();
      expect(screen.getByRole('button', { name: 'Marcar dias vermelhos' })).toBeInTheDocument();
    });

    it('6.31: o dia vermelho tem o número em branco dentro de um quadrado vermelho (cor de alerta), e não tem mais a barra; o dia comum não muda', async () => {
      abrirEscala(escala({ diasVermelhos: [dia(5)] }));
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      const dias = screen.getByLabelText('Calendário do mês').querySelectorAll('[data-dia]');
      const cinco = dias[4]!;
      const quadrado = cinco.querySelector('[data-quadrado-vermelho]') as HTMLElement;
      expect(quadrado).toHaveClass('bg-alerta', 'text-white');
      expect(quadrado).toHaveTextContent('5');
      expect(within(cinco as HTMLElement).getByText('Dia vermelho')).toHaveClass('sr-only');
      // sem a barra ao lado das placas, em nenhum dia
      expect(document.querySelector('[data-faixa-vermelha]')).toBeNull();
      // o dia comum: o número sem quadrado e sem a cor de alerta
      expect(dias[5]!.querySelector('[data-quadrado-vermelho]')).toBeNull();
      expect(within(dias[5] as HTMLElement).getByText('6')).not.toHaveClass('text-white', 'bg-alerta');
    });

    it('6.31: no modo de marcar, o quadrado vermelho continua sendo o botão ("Dia vermelho: dd/mm", aria-pressed), com 44 px de toque', async () => {
      abrirEscala(escala({ diasVermelhos: [dia(5)] }));
      await userEvent.click(await screen.findByRole('button', { name: 'Marcar dias vermelhos' }));
      const botao = await screen.findByRole('button', { name: 'Dia vermelho: 05/01' });
      expect(botao).toHaveAttribute('aria-pressed', 'true');
      expect(botao).toHaveClass('min-h-11', 'min-w-11');
      expect(botao.querySelector('[data-quadrado-vermelho]')).toHaveClass('bg-alerta', 'text-white');
      expect((await screen.findByRole('button', { name: 'Dia vermelho: 06/01' })).querySelector('[data-quadrado-vermelho]')).toBeNull();
    });

    it('6.31: a legenda do dia vermelho é um quadradinho vermelho (e não a barra)', async () => {
      abrirEscala(escala());
      const legenda = await screen.findByLabelText('Legenda dos turnos');
      const amostra = legenda.querySelector('[data-amostra-dia-vermelho]') as HTMLElement;
      expect(amostra).toHaveClass('bg-alerta', 'size-[18px]');
      expect(amostra).not.toHaveClass('w-[3px]');
    });

    it('a legenda fica embaixo do calendário e traz Dia, Noite, JES, Saldo e Dia vermelho; a frase "Clique no número do dia…" saiu', async () => {
      abrirEscala(escala());
      const cal = await screen.findByLabelText('Calendário do mês');
      const legenda = screen.getByLabelText('Legenda dos turnos');
      expect(cal.compareDocumentPosition(legenda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      for (const t of ['Dia, 07h às 19h', 'Noite, 19h às 07h', 'JES', 'Saldo', 'Dia vermelho']) expect(within(legenda).getByText(t)).toBeInTheDocument();
      expect(screen.queryByText(/Clique no número do dia/)).toBeNull();
    });

    it('a tela cabe na janela: o painel da direita rola por dentro (sem crescer além do calendário), e no celular a página rola inteira', async () => {
      abrirEscala(escala());
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      const painel = screen.getByRole('heading', { name: 'Cota de saldo' }).closest('section')!;
      expect(painel).toHaveClass('xl:absolute', 'xl:inset-0', 'xl:overflow-y-auto');
      expect(painel.closest('aside')).toHaveClass('xl:relative', 'xl:min-h-96');
    });
  });

  });

  describe('a lista de cotas', () => {
    it('tem as colunas, a sobra e a marca de ordenado à mão', async () => {
      abrirEscala(escala());
      const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
      for (const c of ['Saldo', 'Cota', 'Escolhidos']) expect(within(lista).getAllByText(c).length).toBe(3);
      expect(within(lista).queryByText('Dias')).toBeNull();
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

    it('antes de fechar, a lista mostra todos os elegíveis, cada um com a marca "Participa" (e nenhuma marca "novo")', async () => {
      abrirEscala(escala({ oficiais: [O1, O2, O3, FORA, NOVO] }));
      const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
      expect(within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'MAJ DELTA participa da rodada' })).not.toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'CAP ECO participa da rodada' })).not.toBeChecked();
      expect(within(lista).queryByText('novo')).toBeNull();
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

    it('o aviso também aparece quando os turnos somem no "Abrir o mês" (quem deixou de ser elegível; achado da revisão final)', async () => {
      abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [] }), { [`POST ${URL_MES}/abrir`]: { status: 200, corpo: { ...escala(), liberados: ['1 turno de CAP BRAVO ficou sem ninguém.'] } } });
      await userEvent.click(await screen.findByRole('button', { name: 'Abrir o mês' }));
      expect(await screen.findByText('1 turno de CAP BRAVO ficou sem ninguém.')).toBeInTheDocument();
    });

    it('o erro da API (marcar com a escala fechada em outra aba) aparece na tela', async () => {
      abrirEscala(escala({ oficiais: [O1, O2, O3, FORA] }), { [URL_PART]: { status: 409, corpo: { erro: 'Com a escala fechada, os participantes não mudam mais.' } } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'MAJ DELTA participa da rodada' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Com a escala fechada, os participantes não mudam mais.');
    });

    it('com a escala fechada, a marca fica só para leitura e quem não participa some da lista', async () => {
      abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00', oficiais: [O1, O2, O3, FORA] }));
      const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
      expect(within(lista).queryByRole('checkbox', { name: 'MAJ DELTA participa da rodada' })).toBeNull();
      expect(within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeDisabled();
    });

    it('antes de abrir o mês e sem ninguém marcado, a tela pede para marcar quem participa', async () => {
      abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [], oficiais: [{ ...FORA, ordem: 1 }, { ...NOVO, ordem: 2 }] }));
      expect(await screen.findByText('Marque na lista quem participa da rodada e abra o mês.')).toBeInTheDocument();
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

    it('com a escala fechada, "Encerrar o mês" pede a confirmação do encerramento', async () => {
      const f = abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00' }), { [`POST ${URL_MES}/encerrar`]: { status: 200, corpo: escala({ etapa: 'encerrada' }) } });
      await userEvent.click(await screen.findByRole('button', { name: 'Encerrar o mês' }));
      const caixa = screen.getByRole('region', { name: 'Confirmação' });
      expect(within(caixa).getByText(/Encerrar janeiro de 2027\?/)).toBeInTheDocument();
      expect(within(caixa).getByText(/Depois disso, só um ajuste no painel de saldo muda os números\./)).toBeInTheDocument();
      await userEvent.click(within(caixa).getByRole('button', { name: 'Encerrar o mês' }));
      await waitFor(() => expect(chamadasA(f, `POST ${URL_MES}/encerrar`)).toBe(1));
    });

    it('"Abrir o mês", no passo de abrir, chama a API (e refaz as cotas)', async () => {
      const f = abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [] }), { [`POST ${URL_MES}/abrir`]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('button', { name: 'Abrir o mês' }));
      await waitFor(() => expect(chamadasA(f, `POST ${URL_MES}/abrir`)).toBe(1));
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
      expect(screen.getByTitle(/cobriu BRAVO/)).toBeInTheDocument();
      expect(screen.getAllByText('vazio').length).toBe(60);
    });

    it('escolher o oficial e clicar no turno de outro pergunta antes de trocar, e grava a troca como cobertura', async () => {
      const f = abrirEscala(FECHADA(), { [`POST ${URL_MES}/lancamentos`]: { status: 200, corpo: FECHADA() } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: /^CAP CHARLIE/ }));
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      const pergunta = within(await screen.findByRole('dialog', { name: 'Trocar CEL ALFA por CAP CHARLIE?' }));
      expect(pergunta.getByText(/Quem cobre ganha o turno, e quem saiu não fica devendo\./)).toBeInTheDocument();
      await userEvent.click(pergunta.getByRole('button', { name: 'Trocar' }));
      await waitFor(() => expect(corpoEnviado(f, `POST ${URL_MES}/lancamentos`)).toEqual({ dia: dia(5), letra: 'A', servico: 'saldo', militarId: 'm-3' }));
    });
  });

  describe('o choque de horário (6.39)', () => {
    const LANC = `POST ${URL_MES}/lancamentos`;
    /** Responde cada lançamento pela regra dada (recebe o corpo enviado) e devolve o servidor falso. */
    function comRegra(regra: (corpo: { dia: string; resolverChoque?: unknown }) => { status: number; corpo: unknown }) {
      const f = abrirEscala(escala());
      const original = f.getMockImplementation()!;
      f.mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
        if (new URL(url, 'http://localhost').pathname === `${URL_MES}/lancamentos` && (init?.method ?? 'GET').toUpperCase() === 'POST') {
          const r = regra(JSON.parse(String(init!.body)));
          return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }
        return original(entrada, init);
      });
      return f;
    }
    const escolherAlfa = async () => {
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: /^CEL ALFA/ }));
    };

    it('Review Focus 2: o clique recusado por choque mostra o motivo, o turno continua livre e o clique seguinte lança normalmente', async () => {
      const f = comRegra((c) => (c.dia === dia(5) ? { status: 409, corpo: { erro: 'Já escalado neste horário' } } : { status: 200, corpo: escala() }));
      await escolherAlfa();
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Já escalado neste horário');
      expect(screen.getByRole('button', { name: /^05\/01, Dia/ })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^06\/01, Dia/ }));
      await waitFor(() => expect(chamadasA(f, LANC)).toBe(2));
      expect(corpoEnviado(f, LANC)).toEqual({ dia: dia(6), letra: 'A', servico: 'saldo', militarId: 'm-1' });
    });

    it('o Saldo no expediente pergunta com a frase fixa; Cancelar não manda nada; confirmar repete o pedido com `resolverChoque`', async () => {
      const f = comRegra((c) => (c.resolverChoque ? { status: 200, corpo: escala() } : { status: 409, corpo: { erro: 'De expediente neste dia', resolvivel: 'expediente' } }));
      await escolherAlfa();
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      const pergunta = await screen.findByRole('dialog', { name: 'CEL ALFA está de expediente em 05/01. Tirar do expediente e escalar em Saldo?' });
      await userEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
      expect(chamadasA(f, LANC)).toBe(1);
      await userEvent.click(screen.getByRole('button', { name: /^05\/01, Dia/ }));
      // o segundo clique pergunta de novo (a primeira resposta foi Cancelar); confirmar repete o pedido com a decisão
      await responderConfirmacao('Tirar e escalar');
      await waitFor(() => expect(chamadasA(f, LANC)).toBe(3));
      expect(corpoEnviado(f, LANC)).toEqual({ dia: dia(5), letra: 'A', servico: 'saldo', militarId: 'm-1', resolverChoque: { expediente: true } });
      expect(await screen.findByText('CEL ALFA saiu do expediente e foi escalado em Saldo.')).toBeInTheDocument();
    });

    it('o JES no expediente não tem decisão: só o motivo no aviso de erro, sem pergunta', async () => {
      const f = comRegra(() => ({ status: 409, corpo: { erro: 'De expediente neste dia' } }));
      await userEvent.click(await screen.findByRole('radio', { name: 'JES' }));
      await userEvent.click(within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: /^CEL ALFA/ }));
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('De expediente neste dia');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(chamadasA(f, LANC)).toBe(1);
    });

    it('depois de recusado o pedido de resolver (a API recusa de novo), o motivo aparece no aviso de erro', async () => {
      comRegra((c) => (c.resolverChoque ? { status: 409, corpo: { erro: 'Já escalado neste horário' } } : { status: 409, corpo: { erro: 'De expediente neste dia', resolvivel: 'expediente' } }));
      await escolherAlfa();
      await userEvent.click(await screen.findByRole('button', { name: /^05\/01, Dia/ }));
      await responderConfirmacao('Tirar e escalar');
      expect(await screen.findByRole('alert')).toHaveTextContent('Já escalado neste horário');
    });
  });

  describe('os erros da API', () => {
    it('o erro de um lançamento com a escala fechada aparece na tela', async () => {
      const base = escala();
      const fechada = escala({ etapa: 'fechada', fechadaEm: '2026-12-30T09:00:00', vez: null, turnos: comNome(base, { [`${dia(5)}|t-a`]: 'm-1' }) });
      abrirEscala(fechada, { [`POST ${URL_MES}/lancamentos`]: { status: 400, corpo: { erro: 'Este oficial não está na escala deste mês.' } } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: /^CAP BRAVO/ }));
      await userEvent.click(await screen.findByRole('button', { name: /^06\/01, Dia/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Este oficial não está na escala deste mês.');
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
      expect(chamadasA(f, `POST ${URL_MES}/lancamentos`)).toBe(0);
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
      abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, oficiais: [], vez: null, turnos: [] }));
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
  vermelhos: 3, meses: [{ mes: '2026-11', valor: 0.5 }, { mes: '2026-12', valor: 0.25 }], turnos: [{ rotulo: 'Dia', quantidade: 12 }, { rotulo: 'Noite', quantidade: 10 }],
  registro: [
    reg({ tipo: 'mes', data: '2026-11-30', mes: '2026-11', valor: 0.5, texto: 'Devia 20,50, tirou 21' }),
    reg({ tipo: 'cobriu', data: '2026-12-24', mes: '2026-12', valor: 1, texto: 'Cobriu CAP BRAVO em 24/12/2026.' }),
    reg({ tipo: 'mes', data: '2026-12-31', mes: '2026-12', valor: 0.25, texto: 'Devia 20,75, tirou 21' }),
  ],
};
const S2: OficialNoSaldo = {
  militarId: 'm-2', matricula: '990102-2', posto: 'CAP', nomeGuerra: 'BRAVO', quadro: 'QOA', lotacao: '1ª SB', saldo: -0.25,
  vermelhos: 0, meses: [{ mes: '2026-12', valor: -0.65 }], turnos: [{ rotulo: 'Dia', quantidade: 4 }, { rotulo: 'Noite', quantidade: 5 }],
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

  it('o botão Regras abre os títulos e a tabela do exemplo, numa janela, sem aba', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      [`GET ${URL_MES}`]: { status: 200, corpo: escala() },
      'GET /api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: [] },
      'GET /api/unidades/u-gb/servicos': { status: 200, corpo: [SERVICO] },
    });
    abrir(`/oficiais?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Regras' }));
    for (const t of ['Como a escala é montada', 'Como a cota é calculada', 'Os dias vermelhos', 'O saldo', 'O que muda o saldo', 'Os dois momentos do mês', 'O que fica registrado']) {
      expect(await screen.findByRole('heading', { name: t })).toBeInTheDocument();
    }
    const ex = screen.getByRole('table', { name: 'Exemplo de 62 turnos' });
    for (const n of ['8,25', '4,26', '−0,26']) expect(within(ex).getAllByText(n).length).toBeGreaterThan(0);
  });

  it('6.44: o texto dos dias vermelhos diz que só conta o lugar tirado no Saldo; JES, PJES e Diária não entram na conta', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: GESTOR },
      [`GET ${URL_MES}`]: { status: 200, corpo: escala() },
      'GET /api/unidades/u-gb/oficiais-saldo': { status: 200, corpo: [] },
      'GET /api/unidades/u-gb/servicos': { status: 200, corpo: [SERVICO] },
    });
    abrir(`/oficiais?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Regras' }));
    const secao = (await screen.findByRole('heading', { name: 'Os dias vermelhos' })).closest('section')!;
    expect(secao).toHaveTextContent('Só conta o lugar tirado no Saldo.');
    expect(secao).toHaveTextContent('JES, PJES e Diária são extra e não entram na conta.');
  });
});

// ---- a escala dos oficiais refeita (6.22): nome em destaque, fundo calmo, painel largo ----
describe('o calendário compacto (6.29)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const turnoCom = (marcas: Record<string, string | [string, string]>, extra: Partial<EscalaDosOficiais> = {}) => escala({ turnos: comNome(escala(), marcas), ...extra });
  // a dica traz o nome, o turno e o serviço ("CEL ALFA · Dia · Saldo"): acha pelo começo
  const doOficialDaLista = (nome: string) => within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: new RegExp(nome) });
  const placa = (titulo: string) => screen.getByTitle(new RegExp(`^${titulo}( · |$)`));

  it('o turno com nome mostra a patente (13 px, apagado) e o nome (15 px, estreita, 600) numa placa de 36 px, com a faixa da cor do serviço à esquerda', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: 'm-1', [`${dia(2)}|t-b`]: 'm-2' }, { servicos: { jes: { id: 's-jes', nome: 'JES', cor: '#6E56A8' }, saldo: { id: 's-op', nome: 'Saldo', cor: '#2B7BB9' } } }));
    await screen.findByText('2 de 62 turnos com nome');
    const dia2 = placa('CEL ALFA');
    expect(within(dia2).getByText('CEL', { selector: 'span[aria-hidden]' })).toHaveClass('text-apoio', 'text-apagado');
    expect(within(dia2).getByText('ALFA')).toHaveClass('text-corpo', 'font-cond', 'font-semibold', 'text-tinta');
    expect(dia2).toHaveClass('h-9', 'bg-superficie');
    const faixa = dia2.querySelector('[data-faixa-do-servico]') as HTMLElement;
    expect(faixa).toHaveAttribute('data-faixa-do-servico', 'saldo');
    expect(faixa.style.backgroundColor).toBe('rgb(43, 123, 185)');
    // sem bloco preto nem texto branco no calendário
    expect(screen.getByLabelText('Calendário do mês').innerHTML).not.toMatch(/bg-tinta|text-white/);
  });

  it('a placa não escreve o serviço: a faixa de cor diz, e a dica e o leitor de tela dizem o nome ("JES" ou "Saldo")', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: 'm-1' }));
    await screen.findByText('1 de 62 turnos com nome');
    const dia2 = placa('CEL ALFA');
    expect(dia2).toHaveAttribute('title', 'CEL ALFA · Dia · Saldo');
    expect(within(dia2).getByText('02/01, Dia, 07h às 19h (Saldo)')).toHaveClass('sr-only');
    // nenhuma etiqueta escrita "Saldo" ou "JES" na placa (fora o texto do leitor de tela)
    expect(within(dia2).queryByText('Saldo')).toBeNull();
    expect(dia2.querySelector('[data-servico-escrito]')).toBeNull();
  });

  it('o turno livre mostra só "livre" em 13 px apagado, com borda tracejada e sem fundo cheio', async () => {
    abrirEscala(escala());
    const livre = await screen.findByRole('button', { name: /^05\/01, Dia.*livre/ });
    expect(within(livre).getByText('livre')).toHaveClass('text-apoio', 'text-apagado');
    expect(livre).toHaveClass('border-dashed');
    expect(livre.className).not.toMatch(/bg-superficie|bg-passa|bg-tinta/);
  });

  it('o dia é uma célula sem caixa, com os dois turnos colados; o número em 15 px, 600; o nome do dia da semana só aparece no celular', async () => {
    abrirEscala(escala());
    await screen.findByText('0 de 62 turnos com nome');
    const cal = screen.getByLabelText('Calendário do mês');
    const numero = within(cal).getByText('3', { selector: 'b' });
    expect(numero).toHaveClass('text-corpo', 'font-semibold');
    const caixa = numero.closest('[data-dia]') as HTMLElement;
    expect(caixa.className).not.toMatch(/border|bg-/);
    expect(caixa.querySelectorAll('[data-turno]')).toHaveLength(2);
    expect(caixa.querySelector('[data-dia-da-semana]')).toHaveClass('md:hidden');
  });

  it('nenhum texto do calendário nem da legenda fica abaixo de 13 px', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: ['m-2', 'm-3'] }, { avisos: [{ dia: dia(2), turnoId: 't-a', texto: 'aviso' } as never] }));
    await screen.findByText('1 de 62 turnos com nome');
    expect(screen.getByLabelText('Calendário do mês').innerHTML).not.toMatch(/text-\[11px\]|text-\[12px\]|text-xs/);
    expect(screen.getByLabelText('Legenda dos turnos').innerHTML).not.toMatch(/text-\[11px\]|text-xs/);
  });

  it('a legenda diz o que é cada linha do dia (amostra branca do Dia e cinza da Noite, com o horário) e a cor de cada serviço', async () => {
    abrirEscala(escala());
    const legenda = await screen.findByLabelText('Legenda dos turnos');
    expect(within(legenda).getByText('Dia, 07h às 19h')).toBeInTheDocument();
    expect(within(legenda).getByText('Noite, 19h às 07h')).toBeInTheDocument();
    expect(legenda.querySelector('[data-cor-do-servico="jes"]')).not.toBeNull();
    expect(legenda.querySelector('[data-cor-do-servico="saldo"]')).not.toBeNull();
    expect(within(legenda).getByText('JES')).toBeInTheDocument();
    expect(within(legenda).getByText('Saldo')).toBeInTheDocument();
  });

  it('os turnos do oficial escolhido ficam com um contorno de 1 px tinta; os dos outros, não', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: 'm-1', [`${dia(2)}|t-b`]: 'm-2' }));
    await screen.findByText('2 de 62 turnos com nome');
    await userEvent.click(doOficialDaLista('CEL ALFA'));
    expect(placa('CEL ALFA')).toHaveClass('ring-1', 'ring-tinta');
    expect(placa('CAP BRAVO')).not.toHaveClass('ring-tinta');
  });

  it('nome longo e patente longa: o nome corta com reticências, a patente nunca, e a dica mostra tudo', async () => {
    const longo = oficial({ militarId: 'm-9', nomeGuerra: 'MONTENEGRO-SANTOS', posto: 'SUB TEN', ordem: 4, matricula: '990109-9' });
    abrirEscala(escala({ oficiais: [O1, O2, O3, longo], turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-9' }) }));
    await screen.findByText('1 de 62 turnos com nome');
    const dica = placa('SUB TEN MONTENEGRO-SANTOS');
    expect(within(dica).getByText('SUB TEN', { selector: 'span[aria-hidden]' })).toHaveClass('shrink-0');
    expect(within(dica).getByText('MONTENEGRO-SANTOS')).toHaveClass('truncate');
  });

  it('turno com alerta e turno "cobriu X": o nome continua legível, com a marca de alerta, e a dica e o leitor de tela dizem quem foi coberto', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: ['m-2', 'm-3'] }, { avisos: [{ dia: dia(2), turnoId: 't-a', mensagem: 'x' } as never] }));
    await screen.findByText('1 de 62 turnos com nome');
    const alvo = placa('CAP BRAVO');
    expect(within(alvo).getByText('BRAVO')).toBeInTheDocument();
    expect(within(alvo).getByLabelText('Alerta')).toBeInTheDocument();
    expect(alvo).toHaveAttribute('title', 'CAP BRAVO · Dia · Saldo · cobriu CHARLIE');
    expect(within(alvo).getByText(/cobriu CHARLIE/)).toHaveClass('sr-only');
  });
});

describe('o painel largo, com todos os dados do oficial (6.22)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('a divisão é o calendário (minmax(0,1fr)) e um painel de 20 rem (22 a partir de 1536 px), sem rolagem de lado (6.29)', async () => {
    abrirEscala(escala());
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const grade = lista.closest('aside')!.parentElement!;
    expect(grade.className).toContain('xl:grid-cols-[minmax(0,1fr)_20rem]');
    expect(lista.closest('aside')!.innerHTML).not.toContain('overflow-x-auto');
  });

  it('cada oficial é uma linha com a marca, a ordem, a patente, o nome, o quadro e a lotação, e os números em destaque', async () => {
    abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 4 }, O2, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const alfa = within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' }).closest('li')!;
    expect(within(alfa).getByText('ALFA')).toHaveClass('text-nome', 'font-cond');
    expect(within(alfa).getByText('CEL')).toHaveClass('text-apoio');
    expect(alfa.textContent).toContain('QOC');
    expect(alfa.textContent).toContain('2º GB');
    for (const rotulo of ['Saldo', 'Cota', 'Escolhidos']) expect(within(alfa).getByText(rotulo)).toHaveClass('text-apoio', 'text-apagado');
    expect(within(alfa).getByText('+0,75')).toHaveClass('text-nome', 'tabular-nums');
    expect(within(alfa).getByText('4 de 21')).toHaveClass('text-nome', 'tabular-nums');
    // a barra fina do quanto já foi escolhido
    expect((alfa.querySelector('[data-barra]') as HTMLElement).style.width).toBe('19%');
    const bravo = within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')!;
    expect(within(bravo).getByText('+1 sobra')).toBeInTheDocument();
    expect(within(bravo).getByText(/ordenado à mão/)).toBeInTheDocument();
  });

  it('os afastamentos vêm embaixo, em pendência, e "Escolhidos" acima da cota diz "{n} a mais"', async () => {
    abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 23, afastamentos: [{ inicio: dia(10), fim: dia(11), tipo: 'Férias' }] }, O2, O3] }));
    const alfa = (await screen.findByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).closest('li')!;
    expect(within(alfa).getByText('Férias, 10/01 a 11/01')).toHaveClass('text-pendencia');
    expect(within(alfa).getByText('2 a mais')).toHaveClass('text-pendencia');
    expect((alfa.querySelector('[data-barra]') as HTMLElement).style.width).toBe('100%');
  });

  it('o oficial da vez tem a linha marcada (borda vinho, fundo avermelhado claro) e a etiqueta "a vez"; o cartão "Vez de escolher" não existe mais', async () => {
    abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 4 }, O2, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(screen.queryByLabelText('Vez de escolher')).toBeNull();
    const alfa = within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' }).closest('li')!;
    expect(alfa).toHaveClass('border-vinho', 'bg-vinho/10');
    expect(within(alfa).getByText('a vez')).toBeInTheDocument();
    expect(within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')).not.toHaveClass('border-vinho');
  });

  it('o painel não tem texto abaixo de 13 px, e o parágrafo solto do pé saiu (6.29.1): fica o botão "Como as cotas foram calculadas"', async () => {
    abrirEscala(escala());
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const painel = lista.closest('aside')!;
    expect(painel.innerHTML).not.toMatch(/text-\[11px\]|text-xs/);
    expect(within(painel).queryByText(/turnos para a rodada de Saldo no mês/)).toBeNull();
    expect(within(painel).getByRole('button', { name: 'Como as cotas foram calculadas' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('no celular o painel vem antes do calendário, e nada rola de lado (Review Focus 5)', async () => {
    abrirEscala(escala());
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(lista.closest('aside')).toHaveClass('order-first', 'xl:order-none');
    expect(lista.closest('aside')!.innerHTML).not.toContain('overflow-x-auto');
  });
});

describe('acabamento do painel e da troca de turno (6.17, itens 21, 26 e 34)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('item 34 (6.29.1): o número "Dias" e o texto "cota menor: …" saem da linha do oficial; a dica da cota diz os dias disponíveis', async () => {
    const afastado = { ...O2, dias: 25, afastamentos: [{ inicio: dia(10), fim: dia(15), tipo: 'Férias' }] };
    abrirEscala(escala({ oficiais: [O1, afastado, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(within(lista).queryByText('Dias')).toBeNull();
    expect(within(lista).queryByText(/cota menor/)).toBeNull();
    const bravo = within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')!;
    expect(within(bravo).getByText('Cota').closest('div')).toHaveAttribute('title', '25 dias disponíveis no mês');
  });

  it('"Como as cotas foram calculadas" abre e fecha a conta do mês em frases curtas, e o que saiu da linha (os dias de afastamento) vem aqui', async () => {
    const afastado = { ...O2, dias: 25, afastamentos: [{ inicio: dia(10), fim: dia(15), tipo: 'Férias' }], sobra: true };
    abrirEscala(escala({ oficiais: [{ ...O1, jes: 2 }, afastado, O3], lugaresDeSaldo: 60 }));
    const botao = await screen.findByRole('button', { name: 'Como as cotas foram calculadas' });
    expect(screen.queryByRole('list', { name: 'Como as cotas foram calculadas' })).toBeNull();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const conta = within(screen.getByRole('list', { name: 'Como as cotas foram calculadas' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(conta).toEqual([
      'O mês tem 62 turnos (31 dias, 2 por dia).',
      'Menos 2 de JES, lançados à mão.',
      'Sobram 60 turnos para a rodada de Saldo.',
      'Participam 3 oficiais.',
      'A divisão, pela presença de cada um, dá 59 turnos inteiros e uma parte quebrada.',
      'Depois do arredondamento sobraram 1, entregues aos 1 mais modernos: BRAVO.',
      'BRAVO: cota menor, afastado 6 dias.',
      'O saldo aparece na lista, mas ainda não entra na conta.',
    ]);
    await userEvent.click(botao);
    expect(screen.queryByRole('list', { name: 'Como as cotas foram calculadas' })).toBeNull();
  });

  it('antes de abrir o mês (sem cotas) não há o botão da conta', async () => {
    abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [], oficiais: [{ ...O1, cota: null, devido: null }, O3] }));
    await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(screen.queryByRole('button', { name: 'Como as cotas foram calculadas' })).toBeNull();
  });

  it('item 26: desmarcar "Participa" de quem já tem turnos escolhidos pergunta antes ("Tirar da rodada"); sem turnos, não pergunta', async () => {
    const PART = `PUT ${URL_MES}/participantes`;
    const f = abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 3 }, O2, O3] }), { [PART]: { status: 200, corpo: { ...escala(), liberados: [] } } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'CEL ALFA participa da rodada' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText('Tirar CEL ALFA da rodada?')).toBeInTheDocument();
    expect(dialogo.getByText('Os 3 turnos escolhidos ficam sem ninguém.')).toBeInTheDocument();
    expect(chamadasA(f, PART)).toBe(0);
    await userEvent.click(dialogo.getByRole('button', { name: 'Cancelar' }));
    expect(chamadasA(f, PART)).toBe(0);
    await userEvent.click(screen.getByRole('checkbox', { name: 'CEL ALFA participa da rodada' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tirar da rodada' }));
    await waitFor(() => expect(corpoEnviado(f, PART)).toEqual({ militarIds: ['m-2', 'm-3'] }));
    // sem turnos escolhidos, desmarca direto
    await userEvent.click(await screen.findByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }));
    await waitFor(() => expect(chamadasA(f, PART)).toBe(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('item 21: cada turno diz ao leitor de tela o dia, o turno e o oficial (o nome do botão); depois de um 409 a tela recarrega os dados', async () => {
    const fechada = escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00', turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) });
    const f = abrirEscala(fechada, { [`POST ${URL_MES}/lancamentos`]: { status: 409, corpo: { erro: 'A escala mudou. Confira os turnos.' } } });
    const botao = await screen.findByRole('button', { name: /^02\/01, Dia, 07h às 19h: BRAVO \(Saldo\)/ });
    expect(botao).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Cotas de janeiro de 2027' })).getByRole('button', { name: /^CEL ALFA/ }));
    const antes = chamadasA(f, `GET ${URL_MES}`);
    await userEvent.click(screen.getByRole('button', { name: /^03\/01, Dia.*vazio/ }));
    expect(await screen.findByText('A escala mudou. Confira os turnos.')).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(f, `GET ${URL_MES}`)).toBeGreaterThan(antes));
  });
});

describe('a faixa do mês (6.29)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const faixa = () => screen.getByRole('region', { name: 'Etapa do mês' });
  const acoes = () => ['Abrir o mês', 'Fechar a escala', 'Encerrar o mês'].filter((n) => screen.queryAllByRole('button', { name: n }).length > 0);

  it('a etapa atual vem em texto, com "n de 4", e a ação da próxima etapa é o único botão principal', async () => {
    abrirEscala(escala());
    await screen.findByRole('region', { name: 'Etapa do mês' });
    expect(within(faixa()).getByText('Escolhas')).toBeInTheDocument();
    expect(within(faixa()).getByText('2 de 4')).toBeInTheDocument();
    expect(acoes()).toEqual(['Fechar a escala']);
    expect(within(faixa()).getByRole('button', { name: 'Fechar a escala' })).toBeInTheDocument();
    // os outros botões da faixa são secundários ou discretos: só a ação do mês é cheia (vinho)
    const cheios = within(faixa()).getAllByRole('button').filter((b) => b.className.includes('bg-vinho'));
    expect(cheios.map((b) => b.textContent)).toEqual(['Fechar a escala']);
  });

  it('em cada etapa, a ação certa: abrir, fechar, encerrar; com o mês encerrado, nenhuma, e "Ver o saldo" e "Regras" ficam', async () => {
    abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [] }));
    await screen.findByRole('region', { name: 'Etapa do mês' });
    expect(within(faixa()).getByText('Abrir o mês', { selector: 'b' })).toBeInTheDocument();
    expect(acoes()).toEqual(['Abrir o mês']);
    cleanup();
    abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00' }));
    await screen.findByRole('region', { name: 'Etapa do mês' });
    expect(within(faixa()).getByText('Escala fechada')).toBeInTheDocument();
    expect(acoes()).toEqual(['Encerrar o mês']);
    cleanup();
    abrirEscala(escala({ etapa: 'encerrada', fechadaEm: '2027-01-05T10:00:00', encerradaEm: '2027-02-01T10:00:00' }));
    await screen.findByRole('region', { name: 'Etapa do mês' });
    expect(within(faixa()).getByText('Mês encerrado')).toBeInTheDocument();
    expect(acoes()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Ver o saldo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regras' })).toBeInTheDocument();
  });

  it('"Como funciona o mês" abre e fecha a explicação das quatro etapas; recolhida, ela não aparece', async () => {
    abrirEscala(escala());
    const botao = await screen.findByRole('button', { name: 'Como funciona o mês' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'As quatro etapas do mês' })).toBeNull();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const passos = within(screen.getByRole('list', { name: 'As quatro etapas do mês' })).getAllByRole('listitem');
    expect(passos.map((p) => within(p).getByRole('heading', { level: 3 }).textContent)).toEqual(['Abrir o mês feito', 'Escolhas', 'Escala fechada', 'Mês encerrado']);
    expect(passos.filter((p) => p.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(within(passos[1]!).getByText('JES à mão primeiro; o resto, pela rodada, como Saldo.')).toHaveClass('text-apoio');
    await userEvent.click(botao);
    expect(screen.queryByRole('list', { name: 'As quatro etapas do mês' })).toBeNull();
  });
});

// ---- os dias vermelhos (6.28) ----
describe('os dias vermelhos', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const URL_VERMELHOS = `POST ${URL_MES}/dias-vermelhos/marcar`;
  const diaDoCalendario = async (n: number) => {
    // o clique no dia só vale no modo de marcar dias vermelhos: o botão "Marcar dias vermelhos" liga, e "Concluir" desliga
    if (!screen.queryByRole('button', { name: 'Concluir' })) await userEvent.click(await screen.findByRole('button', { name: 'Marcar dias vermelhos' }));
    return screen.findByRole('button', { name: new RegExp(`^Dia vermelho: ${String(n).padStart(2, '0')}/01`) });
  };

  it('no modo de marcar, o dia vermelho vem marcado (aria-pressed) com o texto "Dia vermelho" para o leitor de tela; o outro dia fica sem marca', async () => {
    abrirEscala(escala({ diasVermelhos: [dia(5)] }));
    expect(await diaDoCalendario(5)).toHaveAttribute('aria-pressed', 'true');
    expect(await diaDoCalendario(6)).toHaveAttribute('aria-pressed', 'false');
    expect(within(await diaDoCalendario(5)).getByText('Dia vermelho')).toHaveClass('sr-only');
  });

  it('um clique no dia marca: a tela manda a lista inteira com o dia a mais', async () => {
    const f = abrirEscala(escala({ diasVermelhos: [dia(5)] }), { [URL_VERMELHOS]: { status: 200, corpo: escala({ diasVermelhos: [dia(5), dia(9)] }) } });
    await userEvent.click(await diaDoCalendario(9));
    await waitFor(() => expect(corpoEnviado(f, URL_VERMELHOS)).toEqual({ dia: dia(9), vermelho: true }));
  });

  it('um clique no dia vermelho tira a marca: a lista vai sem ele', async () => {
    const f = abrirEscala(escala({ diasVermelhos: [dia(5), dia(9)] }), { [URL_VERMELHOS]: { status: 200, corpo: escala({ diasVermelhos: [dia(9)] }) } });
    await userEvent.click(await diaDoCalendario(5));
    await waitFor(() => expect(corpoEnviado(f, URL_VERMELHOS)).toEqual({ dia: dia(5), vermelho: false }));
  });

  it('com a escala fechada ainda se marca', async () => {
    const f = abrirEscala(escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00' }), { [URL_VERMELHOS]: { status: 200, corpo: escala() } });
    await userEvent.click(await diaDoCalendario(3));
    await waitFor(() => expect(chamadasA(f, URL_VERMELHOS)).toBe(1));
  });

  it('com o mês encerrado o dia vermelho só aparece marcado, sem botão', async () => {
    abrirEscala(escala({ etapa: 'encerrada', fechadaEm: '2027-01-05T10:00:00', encerradaEm: '2027-02-01T10:00:00', diasVermelhos: [dia(5)] }));
    await screen.findByRole('group', { name: 'Calendário do mês' });
    expect(screen.queryByRole('button', { name: /^Dia vermelho:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Marcar dias vermelhos' })).toBeNull();
    expect(screen.getAllByText('Dia vermelho').length).toBeGreaterThan(0);
  });

  it('o erro da API aparece na tela, e a lista de antes continua marcada', async () => {
    abrirEscala(escala({ diasVermelhos: [dia(5)] }), { [URL_VERMELHOS]: { status: 409, corpo: { erro: 'O mês já foi encerrado. Correções agora só por ajuste no painel de saldo.' } } });
    await userEvent.click(await diaDoCalendario(9));
    expect(await screen.findByRole('alert')).toHaveTextContent('O mês já foi encerrado.');
    expect(await diaDoCalendario(5)).toHaveAttribute('aria-pressed', 'true');
  });

  it('a lista de cotas mostra quantos dias vermelhos cada oficial tirou, só quando o mês tem dia vermelho', async () => {
    abrirEscala(escala({ diasVermelhos: [dia(5)], oficiais: [{ ...O1, vermelhos: 2 }, O2, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const alfa = within(lista).getByText('ALFA').closest('li')!;
    expect(within(alfa).getByText('Vermelhos')).toBeInTheDocument();
    expect(within(alfa).getByText('Vermelhos').nextElementSibling).toHaveTextContent('2');
    expect(within(lista).getAllByText('Vermelhos')).toHaveLength(3);
  });

  it('sem dia vermelho no mês, a lista de cotas não ganha a coluna', async () => {
    abrirEscala(escala());
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(within(lista).queryByText('Vermelhos')).toBeNull();
  });

  it('o painel das cotas se chama "Cota de saldo"', async () => {
    abrirEscala(escala());
    expect(await screen.findByRole('heading', { name: 'Cota de saldo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cotas' })).toBeNull();
  });

  it('o painel de saldo mostra o acumulado de dias vermelhos de cada oficial', async () => {
    abrirSaldo([S1, S2]);
    const tabela = await screen.findByRole('table', { name: 'Saldo de cada oficial' });
    expect(within(tabela).getByRole('columnheader', { name: 'Dias vermelhos' })).toBeInTheDocument();
    expect(within(within(tabela).getByRole('row', { name: /CEL ALFA/ })).getByLabelText('3 dias vermelhos')).toHaveTextContent('3');
    expect(within(within(tabela).getByRole('row', { name: /CAP BRAVO/ })).getByLabelText('0 dias vermelhos')).toHaveTextContent('0');
  });
});


// ---- o memorial de cálculo (6.30) ----
describe('o memorial de cálculo (6.30)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const CONTA = {
    turnos: 62, jes: 0, rodada: 62, sobraram: 1,
    participantes: [
      { militarId: 'm-1', patente: 'CEL', nomeGuerra: 'ALFA', diasNoMes: 31, afastamentos: [], devido: 20.5, cota: 21, sobra: false },
      { militarId: 'm-2', patente: 'CAP', nomeGuerra: 'BRAVO', diasNoMes: 31, afastamentos: [{ tipo: 'Férias', inicio: '2027-01-17', fim: '2027-01-31' }], devido: 20.5, cota: 21, sobra: true },
    ],
  };
  const REGISTRO = (motivo: string, criadoEm: string, por: { patente: string; nomeGuerra: string } | null = { patente: 'CAP', nomeGuerra: 'VERIF' }) => ({ criadoEm, por, motivo, conta: CONTA });
  const MEMORIAL = {
    contaAtual: CONTA,
    registros: [REGISTRO('Mudou quem participa', '2027-01-05T13:00:00Z'), REGISTRO('Abriu o mês', '2026-12-28T13:00:00Z')],
    servicos: [
      { dia: '2027-01-03', letra: 'A', servico: 'saldo' as const, patente: 'CEL', nomeGuerra: 'ALFA', cobriu: null },
      { dia: '2027-01-04', letra: 'A', servico: 'jes' as const, patente: 'CAP', nomeGuerra: 'BRAVO', cobriu: 'CHARLIE' },
    ],
  };
  const abrirMemorial = async (memorial: unknown) => {
    const f = abrirEscala(escala(), { [`GET ${URL_MES}/memorial`]: { status: 200, corpo: memorial } });
    await userEvent.click(await screen.findByRole('tab', { name: 'Memorial de cálculo' }));
    return f;
  };

  it('a aba "Memorial de cálculo" fica ao lado das outras, e o botão da Escala do mês leva a ela', async () => {
    abrirEscala(escala(), { [`GET ${URL_MES}/memorial`]: { status: 200, corpo: MEMORIAL } });
    await userEvent.click(await screen.findByRole('button', { name: 'Memorial de cálculo' }));
    expect(await screen.findByRole('heading', { name: 'Memorial de cálculo de janeiro de 2027' })).toBeInTheDocument();
  });

  it('a conta atual aparece em frases curtas, com a tabela de cada oficial (devido, cota, sobra e os afastamentos)', async () => {
    await abrirMemorial(MEMORIAL);
    expect(await screen.findByText('O mês tem 62 turnos.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum turno de JES foi lançado.')).toBeInTheDocument();
    expect(screen.getByText('Sobram 62 turnos para a rodada de Saldo.')).toBeInTheDocument();
    expect(screen.getByText('Participam 2 oficiais.')).toBeInTheDocument();
    expect(screen.getByText('Depois do arredondamento sobraram 1, entregues aos mais modernos da ordem: BRAVO.')).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Quanto deu para cada oficial' });
    expect(within(tabela).getAllByText('20,50')).toHaveLength(2);
    expect(within(tabela).getByText('Férias, 17/01 a 31/01')).toBeInTheDocument();
  });

  it('os serviços do mês por oficial: JES, Saldo e coberturas', async () => {
    await abrirMemorial(MEMORIAL);
    const servicos = await screen.findByRole('table', { name: 'Os serviços do mês, por oficial' });
    const bravo = within(servicos).getByText('BRAVO').closest('tr')!;
    expect(within(bravo).getAllByRole('cell').map((c) => c.textContent)).toEqual(['CAP BRAVO', '1', '0', '1']);
    expect(within(within(servicos).getByText('ALFA').closest('tr')!).getAllByRole('cell')[2]).toHaveTextContent('1');
  });

  it('o histórico mostra o último recálculo aberto e os anteriores recolhidos, com quem fez e quando', async () => {
    await abrirMemorial(MEMORIAL);
    expect(await screen.findByText('Mudou quem participa')).toBeInTheDocument();
    const recolhidos = screen.getByText('Ver os 1 recálculos anteriores').closest('details')!;
    expect(recolhidos).not.toHaveAttribute('open');
    expect(within(recolhidos).getByText('Abriu o mês')).toBeInTheDocument();
    expect(screen.getAllByText(/CAP VERIF/)).toHaveLength(2);
  });

  it('um mês gravado antes do memorial (sem registros) mostra a conta atual e a frase de que o histórico começa agora', async () => {
    await abrirMemorial({ ...MEMORIAL, registros: [] });
    expect(await screen.findByText('Cálculo refeito agora: o histórico começa nesta versão.')).toBeInTheDocument();
    expect(screen.getByText('O mês tem 62 turnos.')).toBeInTheDocument();
  });

  it('"Imprimir" chama a impressão do navegador; o botão some na impressão (print:hidden) e o memorial é a área marcada para imprimir', async () => {
    await abrirMemorial(MEMORIAL);
    const imprimir = vi.fn();
    vi.stubGlobal('print', imprimir);
    await userEvent.click(await screen.findByRole('button', { name: 'Imprimir' }));
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Imprimir' })).toHaveClass('print:hidden');
    expect(screen.getByRole('region', { name: 'Memorial de cálculo' })).toHaveClass('memorial-impressao');
  });
});

// ---- as pendências da 6.30 na tela ----
describe('pendências da 6.30 na tela', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('o botão "Regras" aparece mesmo sem escala de rodada na unidade, e abre as regras', async () => {
    abrirEscala(escala({ escala: null, escalas: [], etapa: 'nao-aberto', abertaEm: null, servicos: { jes: null, saldo: null }, turnosDoServico: [], oficiais: [], vez: null, turnos: [] }));
    await screen.findByText(/A unidade ainda não tem uma escala com rodada de cotas\./);
    await userEvent.click(screen.getByRole('button', { name: 'Regras' }));
    expect(await screen.findByRole('dialog', { name: 'Regras da escala dos oficiais' })).toBeInTheDocument();
  });

  it('no modo de marcar dias vermelhos, a área de clique do dia tem 44 px (min-h-11 e min-w-11)', async () => {
    abrirEscala(escala());
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar dias vermelhos' }));
    expect(await screen.findByRole('button', { name: 'Dia vermelho: 05/01' })).toHaveClass('min-h-11', 'min-w-11');
  });

  it('cada clique no dia manda só o dia e a marca (POST .../dias-vermelhos/marcar), e não a lista inteira', async () => {
    const f = abrirEscala(escala(), { [`POST ${URL_MES}/dias-vermelhos/marcar`]: { status: 200, corpo: escala({ diasVermelhos: [dia(7)] }) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar dias vermelhos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Dia vermelho: 07/01' }));
    await waitFor(() => expect(corpoEnviado(f, `POST ${URL_MES}/dias-vermelhos/marcar`)).toEqual({ dia: dia(7), vermelho: true }));
  });
});
