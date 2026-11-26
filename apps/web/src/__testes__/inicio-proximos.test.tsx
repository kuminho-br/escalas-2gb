import { screen, waitFor, within } from '@testing-library/react';
import type { MeuServico } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// 6.55: os próximos serviços na tela inicial: os cartões dentro da cena, a linha na barra encolhida e o bloco "Seu próximo serviço" embaixo dos atalhos. Nomes e datas fictícios.
const transicao = vi.hoisted(() => ({ atual: { fase: 'parada', entrando: false, cartoes: true } as { fase: string; entrando: boolean; cartoes: boolean } }));
vi.mock('@/lib/transicao-login/armazem', async (importar) => ({ ...(await importar<typeof import('@/lib/transicao-login/armazem')>()), useTransicao: () => transicao.atual }));

const ROTA = 'GET /api/eu/proximos-servicos';
const servico = (data: string, extra: Partial<MeuServico> = {}): MeuServico => ({
  alocacaoId: `a-${data}-${extra.inicio ?? '07:00'}`, data, inicio: '07:00', fim: '19:00', servico: 'Pronto', cor: '#2F8F5B', turno: 'B', escala: 'Ordinário', unidadeSigla: '1ª SB', unidadeId: 'u-1sb', estado: 'publicada', emRetificacao: false,
  guarnicao: 'ABT', funcao: 'Combatente', composicao: [
    { patente: 'SD', nomeGuerra: 'ANDRADE', funcao: 'Combatente', eu: true },
    { patente: '3º SGT', nomeGuerra: 'COLEGA', funcao: 'Motorista', eu: false },
  ], ...extra,
});
const abrirComServicos = async (servicos: MeuServico[]) => {
  simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 200, corpo: { servicos } } });
  abrir('/');
  return screen.findByRole('heading', { level: 1 });
};
const rolar = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};

describe('os próximos serviços na tela inicial', () => {
  afterEach(() => {
    rolar(0);
    transicao.atual = { fase: 'parada', entrando: false, cartoes: true };
  });

  it('os cartões ficam dentro da cena, embaixo da saudação, e a área dos avisos fica vazia à direita', async () => {
    const titulo = await abrirComServicos([servico('2026-11-26'), servico('2026-11-27', { inicio: '19:00', fim: '07:00', turno: 'A' })]);
    const cena = titulo.closest<HTMLElement>('[data-faixa-boas-vindas]')!;
    const lista = await within(cena).findByRole('list', { name: 'Seus próximos serviços' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    // a lista vem depois da saudação, na mesma cena
    expect(titulo.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const avisos = cena.querySelector('[data-lugar-dos-avisos]')!;
    expect(avisos).not.toBeNull();
    expect(avisos.childElementCount).toBe(0);
    expect(avisos.textContent).toBe('');
  });

  it('a coluna dos avisos só existe a partir de 1024 px: antes disso a saudação e os cartões têm a largura toda (a 768 px os cartões ficavam cortados)', async () => {
    const titulo = await abrirComServicos([servico('2026-11-26')]);
    const grade = titulo.parentElement!;
    expect(grade.className).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,340px\)\]/);
    expect(grade.className).not.toMatch(/md:grid-cols-/);
    expect(grade.querySelector('[data-lugar-dos-avisos]')!.className).toMatch(/hidden lg:/);
  });

  it('sem serviço, a cena diz que não há nenhum marcado, e não há barra nem detalhe', async () => {
    const titulo = await abrirComServicos([]);
    expect(await screen.findByText('Nenhum serviço marcado para você.')).toBeInTheDocument();
    expect(titulo.closest('[data-faixa-boas-vindas]')!.querySelector('[data-barra-do-servico]')).toBeNull();
    expect(screen.queryByText(/^Próximo serviço:/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Seu próximo serviço' })).toBeNull();
  });

  it('a barra encolhida diz o próximo serviço (o dia por extenso, o dia, o serviço e o horário)', async () => {
    const titulo = await abrirComServicos([servico('2026-11-26'), servico('2026-11-27')]);
    const barra = await waitFor(() => {
      const b = titulo.closest('[data-faixa-boas-vindas]')!.querySelector<HTMLElement>('[data-barra-do-servico]');
      expect(b).not.toBeNull();
      return b!;
    });
    expect(barra).toHaveTextContent('Próximo serviço: quinta, 26, Pronto, 7h às 19h');
    rolar(5000);
    await waitFor(() => expect(titulo.closest<HTMLElement>('[data-faixa-boas-vindas]')!.style.getPropertyValue('--e')).toBe('1'));
    // a barra repete o que os cartões e o detalhe já dizem: a leitura de tela a pula
    expect(barra).toHaveAttribute('aria-hidden', 'true');
  });

  it('no celular a linha da barra fica embaixo da saudação, na largura toda (sem sobrepor o nome); no computador, à direita', async () => {
    const titulo = await abrirComServicos([servico('2026-11-26')]);
    const cena = titulo.closest<HTMLElement>('[data-faixa-boas-vindas]')!;
    const barra = await waitFor(() => {
      const b = cena.querySelector<HTMLElement>('[data-barra-do-servico]');
      expect(b).not.toBeNull();
      return b!;
    });
    expect(cena).toHaveAttribute('data-com-linha');
    expect(barra.className).toMatch(/(^| )left-4( |$)/);
    expect(barra.className).toMatch(/(^| )right-4( |$)/);
    expect(barra.className).toMatch(/md:left-auto/);
    // com o prefixo também no celular: cabe, porque a linha tem a largura toda
    expect(barra.querySelector('.hidden')).toBeNull();
    expect(barra).toHaveTextContent('Próximo serviço: quinta, 26, Pronto, 7h às 19h');
  });

  it('sem serviço a cena não leva a marca da linha (a saudação continua centrada na barra)', async () => {
    const titulo = await abrirComServicos([]);
    await screen.findByText('Nenhum serviço marcado para você.');
    expect(titulo.closest('[data-faixa-boas-vindas]')).not.toHaveAttribute('data-com-linha');
  });

  it('o bloco "Seu próximo serviço" fica embaixo dos atalhos, com o dia, o serviço, o turno, a guarnição e a função', async () => {
    await abrirComServicos([servico('2026-11-26'), servico('2026-11-27')]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    expect(nav.compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bloco).toHaveTextContent('quinta-feira, 26 de novembro');
    expect(bloco).toHaveTextContent('Pronto, das 7h às 19h');
    expect(bloco).toHaveTextContent('Turno B.');
    expect(bloco).toHaveTextContent('Na ABT, como combatente.');
    // é o detalhe do primeiro cartão, e não do segundo
    expect(bloco).not.toHaveTextContent('27 de novembro');
  });

  it('quem vai junto aparece em placas, com o próprio marcado, e o elo leva à Minha escala do mês do serviço', async () => {
    await abrirComServicos([servico('2026-12-01')]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(bloco).toHaveTextContent('terça-feira, 1º de dezembro');
    const junto = within(bloco).getByRole('list', { name: 'Quem vai junto' });
    const placas = junto.querySelectorAll('[data-placa]');
    expect(placas).toHaveLength(2);
    expect(junto).toHaveTextContent('ANDRADE');
    expect(junto).toHaveTextContent('COLEGA');
    expect(within(junto).getByText(/você/)).toBeInTheDocument();
    const elo = within(bloco).getByRole('link', { name: 'Ver minha escala do mês' });
    expect(elo.getAttribute('href')).toContain('/minha-escala');
    expect(elo.getAttribute('href')).toContain('2026-12');
  });

  it('sem guarnição, o detalhe só tem o turno; sem função, "Na ABT."; o turno U não aparece', async () => {
    await abrirComServicos([servico('2026-11-26', { guarnicao: null, funcao: null, composicao: [] })]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(bloco).toHaveTextContent('Turno B.');
    expect(bloco).not.toHaveTextContent(/Na /);
    expect(within(bloco).queryByRole('list', { name: 'Quem vai junto' })).toBeNull();
  });

  it('com guarnição e sem função: "Na ABT."', async () => {
    await abrirComServicos([servico('2026-11-26', { funcao: null })]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(bloco).toHaveTextContent('Na ABT.');
    expect(bloco).not.toHaveTextContent('como');
  });

  it('o turno U não é dito', async () => {
    await abrirComServicos([servico('2026-11-26', { turno: 'U' })]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(bloco).not.toHaveTextContent('Turno');
    expect(bloco).toHaveTextContent('Na ABT, como combatente.');
  });

  it('escala em prévia: o bloco avisa que pode mudar; publicada, não', async () => {
    await abrirComServicos([servico('2026-11-26', { estado: 'previa' })]);
    const previa = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(previa).toHaveTextContent('Escala em prévia: pode mudar.');
  });

  it('escala publicada: sem o aviso de prévia', async () => {
    await abrirComServicos([servico('2026-11-26')]);
    const bloco = (await screen.findByRole('heading', { name: 'Seu próximo serviço' })).closest('section')!;
    expect(bloco).not.toHaveTextContent('prévia');
  });

  it('conta que não é de militar (404): nada da área aparece, sem mensagem, e o resto da tela segue igual', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 404, corpo: { erro: 'Esta conta não é de um militar.' } } });
    abrir('/');
    const titulo = await screen.findByRole('heading', { level: 1 });
    await screen.findByRole('navigation', { name: 'Módulos' });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Seus próximos serviços')).toBeNull();
    expect(screen.queryByText('Nenhum serviço marcado para você.')).toBeNull();
    expect(titulo.closest('[data-faixa-boas-vindas]')!.querySelector('[data-barra-do-servico]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Seu próximo serviço' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('erro da API: nada da área aparece, e a tela inicial não quebra', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 500, corpo: { erro: 'falhou' } } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    await screen.findByRole('navigation', { name: 'Módulos' });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Seus próximos serviços')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Seu próximo serviço' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falha de rede: o mesmo, nada aparece', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: 'rede' });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Seus próximos serviços')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
  });

  it('na chegada pela animação do login, os cartões entram junto com a saudação (o mesmo data-chegada)', async () => {
    transicao.atual = { fase: 'afastando', entrando: false, cartoes: true };
    const titulo = await abrirComServicos([servico('2026-11-26')]);
    const lista = await screen.findByRole('list', { name: 'Seus próximos serviços' });
    const dasaudacao = titulo.closest('[data-chegada]')!;
    expect(dasaudacao).toHaveAttribute('data-chegada', 'escondida');
    expect(lista.closest('[data-chegada]')).toBe(dasaudacao);
    transicao.atual = { fase: 'pousou', entrando: false, cartoes: true };
  });
});
