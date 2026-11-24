import type { EscalaDosOficiais, OficialDoMes, OficialNoSaldo } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { guardarUnidade } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

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
  matricula: '990100-0', quadro: 'QOC', lotacao: '2º GB', semAntiguidade: false, saldoAnterior: 0, dias: 31, devido: 20.5, cota: 21, sobra: false, escolhidos: 0, jes: 0, vermelhos: 0, voluntarioJes: false, afastamentos: [], participa: true, novo: false, ...o,
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

    it('"Escalar: JES | Saldo" no alto do calendário, com o JES escolhido de começo e o que resta da cota de JES da unidade', async () => {
      abrirEscala(escala({ jes: { cota: 30, usados: 4 } }));
      const grupo = await screen.findByRole('radiogroup', { name: 'Escalar:' });
      expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['JES', 'Saldo']);
      expect(servico('JES')).toBeChecked();
      expect(servico('Saldo')).not.toBeChecked();
      expect(within(screen.getByText(/JES restam/).closest('p')!).getByText('26')).toHaveClass('font-cond');
      expect(screen.getByText(/JES restam/).closest('p')).toHaveTextContent('JES restam 26 de 30');
    });

    it('sem cota de JES cadastrada, diz "Sem cota de JES cadastrada no mês."; só aparece com o JES escolhido', async () => {
      abrirEscala(escala({ jes: { cota: null, usados: 3 } }));
      expect(await screen.findByText('Sem cota de JES cadastrada no mês.')).toBeInTheDocument();
      await userEvent.click(servico('Saldo'));
      expect(screen.queryByText('Sem cota de JES cadastrada no mês.')).toBeNull();
    });

    it('com a cota de JES acabada, o número fica âmbar e diz "A cota de JES do mês acabou."; lançar continua permitido', async () => {
      const { f, lancados } = servidorVivo(escala({ jes: { cota: 4, usados: 4 } }));
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
      await screen.findByRole('radiogroup', { name: 'Escalar:' });
      await userEvent.click(doOficial('CAP BRAVO'));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'A', servico: 'jes', militarId: 'm-2' }]));
      expect(await screen.findByText('CAP BRAVO ficou com o turno Dia de 03/01 (JES).')).toBeInTheDocument();
    });

    it('com Saldo, o oficial da vez já vem escolhido: um clique no turno lança como Saldo', async () => {
      const { lancados } = servidorVivo(escala());
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      expect(doOficial('CEL ALFA')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/Escalando/).closest('p')).toHaveTextContent('Escalando CEL ALFA no Saldo: clique nos turnos.');
      await escolher(/^03\/01, Noite/);
      await waitFor(() => expect(lancados).toEqual([{ dia: dia(3), letra: 'B', servico: 'saldo', militarId: 'm-1' }]));
    });

    it('a ordem é só uma sugestão: escolher outro oficial e lançar grava e mostra "Fora da ordem: a vez era de…"', async () => {
      const aviso = 'Fora da ordem: a vez era de CEL ALFA.';
      const f = abrirEscala(escala(), { [URL_LANC]: { status: 200, corpo: { ...escala(), foraDaOrdem: aviso } } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.click(doOficial('CAP CHARLIE'));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(corpoEnviado(f, URL_LANC)).toMatchObject({ militarId: 'm-3', servico: 'saldo' }));
      expect(await screen.findByText(aviso)).toBeInTheDocument();
    });

    it('Review Focus 2: o oficial da vez completa a cota no meio dos cliques e a escolha passa ao próximo, só com Saldo', async () => {
      const curto = escala({ oficiais: [{ ...O1, cota: 2, escolhidos: 1 }, O2, O3] });
      const { lancados } = servidorVivo(curto);
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await escolher(/^03\/01, Dia/);
      await waitFor(() => expect(doOficial('CAP BRAVO')).toHaveAttribute('aria-pressed', 'true'));
      await escolher(/^04\/01, Dia/);
      await waitFor(() => expect(lancados.map((l) => l.militarId)).toEqual(['m-1', 'm-2']));
    });

    it('Review Focus 1: cliques seguidos em vários dias lançam todos, na ordem, uma vez cada (sem esperar a resposta de cada um)', async () => {
      const t = trava();
      const { f, lancados } = servidorVivo(escala(), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      for (const d of [3, 4, 5]) await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^0${d}/01, Dia`) }));
      t.soltar();
      await waitFor(() => expect(lancados.map((l) => l.dia)).toEqual([dia(3), dia(4), dia(5)]));
      expect(chamadasA(f, URL_LANC)).toBe(3);
    });

    it('duplo clique no mesmo turno lança uma vez só', async () => {
      const t = trava();
      const { f } = servidorVivo(escala(), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await userEvent.dblClick(await screen.findByRole('button', { name: /^03\/01, Dia/ }));
      t.soltar();
      await waitFor(() => expect(chamadasA(f, URL_LANC)).toBe(1));
    });

    it('um clique no turno do próprio oficial e serviço escolhidos tira o lançamento', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-1' }) }), { [URL_TIRAR(2, 'A')]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      await escolher(/^02\/01, Dia.*ALFA/);
      await waitFor(() => expect(chamadasA(f, URL_TIRAR(2, 'A'))).toBe(1));
    });

    it('um clique no turno de outro oficial pergunta "Trocar {A} por {B}?": "Cancelar" não lança, "Trocar" lança', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) }), { [URL_LANC]: { status: 200, corpo: escala() } });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
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
      await escolher(/^10\/01, Dia/);
      expect(await screen.findByText('CEL ALFA está afastado em 10/01 (Férias) e não pode ficar com este turno.')).toBeInTheDocument();
      expect(chamadasA(f, URL_LANC)).toBe(0);
    });

    it('revisão final: clicar num turno de outro serviço (JES escolhido, turno de Saldo) avisa na tela, sem perguntar "Trocar" e sem chamar a API', async () => {
      const f = abrirEscala(escala({ turnos: comNome(escala(), { [`${dia(2)}|t-a`]: 'm-2' }) }));
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

    it('revisão final: com Saldo, cliques rápidos passam ao próximo da vez quando o primeiro completa a cota (o oficial é decidido na hora de gravar)', async () => {
      const t = trava();
      const { lancados } = servidorVivo(escala({ oficiais: [{ ...O1, cota: 2, escolhidos: 1 }, O2, O3] }), { esperaDoPost: t.espera });
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
      for (const d of [3, 4, 5]) await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^0${d}/01, Dia`) }));
      t.soltar();
      await waitFor(() => expect(lancados.map((l) => l.militarId)).toEqual(['m-1', 'm-2', 'm-2']));
    });

    it('revisão final: com a escala fechada, a escolha à mão não cai quando o oficial já está na cota (várias coberturas seguidas)', async () => {
      const fechada = escala({ etapa: 'fechada', fechadaEm: '2027-01-05T10:00:00', vez: null, oficiais: [{ ...O1, cota: 2, escolhidos: 2 }, O2, O3] });
      const { lancados } = servidorVivo(fechada);
      await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
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

    it('antes de fechar, a lista mostra todos os elegíveis, cada um com a marca "Participa", e "novo" em quem é novo', async () => {
      abrirEscala(escala({ oficiais: [O1, O2, O3, FORA, NOVO] }));
      const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
      expect(within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' })).toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'MAJ DELTA participa da rodada' })).not.toBeChecked();
      expect(within(lista).getByRole('checkbox', { name: 'CAP ECO participa da rodada' })).not.toBeChecked();
      const eco = within(lista).getByRole('checkbox', { name: 'CAP ECO participa da rodada' }).closest('li')!;
      expect(within(eco).getByText('novo')).toBeInTheDocument();
      expect(within(lista).getByRole('checkbox', { name: 'MAJ DELTA participa da rodada' }).closest('li')!.textContent).not.toContain('novo');
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
});

// ---- a escala dos oficiais refeita (6.22): nome em destaque, fundo calmo, painel largo ----
describe('o calendário compacto (6.29)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const turnoCom = (marcas: Record<string, string | [string, string]>, extra: Partial<EscalaDosOficiais> = {}) => escala({ turnos: comNome(escala(), marcas), ...extra });
  // a dica traz o nome, o turno e o serviço ("CEL ALFA · Dia · Saldo"): acha pelo começo
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

  it('os dias vermelhos têm a legenda de como marcar acima do calendário', async () => {
    abrirEscala(escala());
    const dica = await screen.findByText('Clique no número do dia para marcar ou tirar o dia vermelho.');
    const cal = screen.getByLabelText('Calendário do mês');
    expect(dica.compareDocumentPosition(cal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o turno que acabou de ser lançado fica marcado até o próximo lançamento, e o aviso diz quem ficou com ele', async () => {
    const depois = turnoCom({ [`${dia(3)}|t-b`]: 'm-1' });
    abrirEscala(escala(), { [`POST ${URL_MES}/lancamentos`]: { status: 200, corpo: depois } });
    await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
    await userEvent.click(await screen.findByRole('button', { name: /^03\/01, Noite/ }));
    expect(await screen.findByText('CEL ALFA ficou com o turno Noite de 03/01 (Saldo).')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-recente="true"]')).toHaveClass('ring-2', 'ring-tinta'));
    expect(document.querySelectorAll('[data-recente="true"]')).toHaveLength(1);
    await userEvent.click(await screen.findByRole('button', { name: /^04\/01, Dia/ }));
    expect(await screen.findByText('CEL ALFA ficou com o turno Dia de 04/01 (Saldo).')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('[data-recente="true"]')).toHaveLength(1));
  });

  it('os turnos do oficial escolhido ficam com um contorno de 1 px tinta; os dos outros, não', async () => {
    abrirEscala(turnoCom({ [`${dia(2)}|t-a`]: 'm-1', [`${dia(2)}|t-b`]: 'm-2' }));
    await screen.findByText('2 de 62 turnos com nome');
    await userEvent.click(await screen.findByRole('radio', { name: 'Saldo' }));
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

  it('o oficial da vez tem a linha marcada (borda vinho, fundo âmbar) e a etiqueta "a vez"; o cartão "Vez de escolher" não existe mais', async () => {
    abrirEscala(escala({ oficiais: [{ ...O1, escolhidos: 4 }, O2, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(screen.queryByLabelText('Vez de escolher')).toBeNull();
    const alfa = within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' }).closest('li')!;
    expect(alfa).toHaveClass('border-vinho', 'bg-pendencia-fundo');
    expect(within(alfa).getByText('a vez')).toBeInTheDocument();
    expect(within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')).not.toHaveClass('border-vinho');
  });

  it('o painel não tem texto abaixo de 13 px, e o rodapé continua em 13 px', async () => {
    abrirEscala(escala());
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const painel = lista.closest('aside')!;
    expect(painel.innerHTML).not.toMatch(/text-\[11px\]|text-xs/);
    expect(within(painel).getByText(/62 turnos para a rodada de Saldo no mês/)).toHaveClass('text-apoio');
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

  it('item 34: o número "Dias" sai do painel; a conta da cota não muda; só quem tem menos dias que os outros ganha "cota menor: afastado {n} dias", e a dica da cota diz os dias disponíveis', async () => {
    const afastado = { ...O2, dias: 25 };
    abrirEscala(escala({ oficiais: [O1, afastado, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(within(lista).queryByText('Dias')).toBeNull();
    const bravo = within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')!;
    // sem afastamento que explique, a frase não diz "afastado" (menos dias pode ser chegada ou saída da unidade no meio do mês)
    expect(within(bravo).getByText('cota menor: 6 dias a menos no mês')).toHaveClass('text-apoio', 'text-apagado');
    expect(within(bravo).getByText('Cota').closest('div')).toHaveAttribute('title', '25 dias disponíveis no mês');
    const alfa = within(lista).getByRole('checkbox', { name: 'CEL ALFA participa da rodada' }).closest('li')!;
    expect(within(alfa).queryByText(/cota menor/)).toBeNull();
    expect(within(alfa).getByText('Cota')).toBeInTheDocument();
  });

  it('item 34 (achado da revisão final): com afastamento no mês, a frase diz "afastado {n} dias" pelos dias do afastamento; sem cotas calculadas, nenhuma frase', async () => {
    const afastado = { ...O2, dias: 25, afastamentos: [{ inicio: dia(10), fim: dia(15), tipo: 'Férias' }] };
    abrirEscala(escala({ oficiais: [O1, afastado, O3] }));
    const lista = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    const bravo = within(lista).getByRole('checkbox', { name: 'CAP BRAVO participa da rodada' }).closest('li')!;
    expect(within(bravo).getByText('cota menor: afastado 6 dias')).toBeInTheDocument();
    cleanup();
    abrirEscala(escala({ etapa: 'nao-aberto', abertaEm: null, vez: null, turnos: [], oficiais: [{ ...O1, cota: null, devido: null }, { ...afastado, cota: null, devido: null }, O3] }));
    const antes = await screen.findByRole('list', { name: 'Cotas de janeiro de 2027' });
    expect(within(antes).queryByText(/cota menor/)).toBeNull();
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
  const URL_VERMELHOS = `PUT ${URL_MES}/dias-vermelhos`;
  const diaDoCalendario = (n: number) => screen.findByRole('button', { name: new RegExp(`^Dia vermelho: ${String(n).padStart(2, '0')}/01`) });

  it('o calendário marca o dia vermelho com um ponto e o texto "Dia vermelho" para o leitor de tela; o outro dia fica sem marca', async () => {
    abrirEscala(escala({ diasVermelhos: [dia(5)] }));
    expect(await diaDoCalendario(5)).toHaveAttribute('aria-pressed', 'true');
    expect(await diaDoCalendario(6)).toHaveAttribute('aria-pressed', 'false');
    expect(within(await diaDoCalendario(5)).getByText('Dia vermelho')).toHaveClass('sr-only');
    expect((await diaDoCalendario(5)).querySelector('[data-marca-vermelha]')).not.toBeNull();
    expect((await diaDoCalendario(6)).querySelector('[data-marca-vermelha]')).toBeNull();
  });

  it('um clique no dia marca: a tela manda a lista inteira com o dia a mais', async () => {
    const f = abrirEscala(escala({ diasVermelhos: [dia(5)] }), { [URL_VERMELHOS]: { status: 200, corpo: escala({ diasVermelhos: [dia(5), dia(9)] }) } });
    await userEvent.click(await diaDoCalendario(9));
    await waitFor(() => expect(corpoEnviado(f, URL_VERMELHOS)).toEqual({ dias: [dia(5), dia(9)] }));
  });

  it('um clique no dia vermelho tira a marca: a lista vai sem ele', async () => {
    const f = abrirEscala(escala({ diasVermelhos: [dia(5), dia(9)] }), { [URL_VERMELHOS]: { status: 200, corpo: escala({ diasVermelhos: [dia(9)] }) } });
    await userEvent.click(await diaDoCalendario(5));
    await waitFor(() => expect(corpoEnviado(f, URL_VERMELHOS)).toEqual({ dias: [dia(9)] }));
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
    expect(screen.getByText('Dia vermelho')).toBeInTheDocument();
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

