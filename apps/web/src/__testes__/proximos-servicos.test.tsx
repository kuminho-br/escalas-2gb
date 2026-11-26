import { render, screen, within } from '@testing-library/react';
import type { MeuServico } from 'contratos';
import { describe, expect, it } from 'vitest';
import { ProximosServicos } from '@/componentes/inicio/ProximosServicos';
import { diaDaSemanaCurto, diaDaSemanaLongo, diaDoMes, fundoDoCartao, horarioCurto, rotuloDoCartao } from '@/lib/proximos-servicos';

// 6.55: o texto dos cartões dos próximos serviços e os cartões. Datas e nomes fictícios.
const servico = (data: string, extra: Partial<MeuServico> = {}): MeuServico => ({
  alocacaoId: `a-${data}`, data, inicio: '07:00', fim: '19:00', servico: 'Pronto', cor: '#2F8F5B', turno: 'B', escala: 'Ordinário', unidadeSigla: '1ª SB', unidadeId: 'u-1sb', estado: 'publicada', emRetificacao: false,
  guarnicao: 'ABT', funcao: 'Combatente', composicao: [], ...extra,
});

describe('o texto dos cartões', () => {
  it('o dia da semana, curto e por extenso', () => {
    expect(diaDaSemanaCurto('2026-11-26')).toBe('qui');
    expect(diaDaSemanaCurto('2026-11-28')).toBe('sáb');
    expect(diaDaSemanaCurto('2026-11-29')).toBe('dom');
    expect(diaDaSemanaLongo('2026-11-26')).toBe('quinta');
    expect(diaDaSemanaLongo('2026-11-28')).toBe('sábado');
  });

  it('o dia do mês: "1º" no dia 1, nos outros só o número (a virada de mês)', () => {
    expect(diaDoMes('2026-12-01')).toBe('1º');
    expect(diaDoMes('2026-12-02')).toBe('2');
    expect(diaDoMes('2026-11-30')).toBe('30');
    expect(diaDoMes('2026-11-26')).toBe('26');
  });

  it('o horário: sem minutos, com minutos, fim à meia-noite e turno que vira o dia', () => {
    expect(horarioCurto('07:00', '19:00')).toBe('7h às 19h');
    expect(horarioCurto('07:30', '19:30')).toBe('7h30 às 19h30');
    expect(horarioCurto('16:00', '00:00')).toBe('16h às 24h');
    expect(horarioCurto('19:00', '07:00')).toBe('19h às 7h');
    expect(horarioCurto('08:05', '17:00')).toBe('8h05 às 17h');
  });

  it('o rótulo de leitura de tela: dia da semana por extenso, dia, serviço e horário', () => {
    expect(rotuloDoCartao(servico('2026-11-26'))).toBe('quinta, 26, Pronto, das 7h às 19h');
    expect(rotuloDoCartao(servico('2026-12-01', { servico: 'JES', inicio: '08:00', fim: '17:00' }))).toBe('terça, 1º, JES, das 8h às 17h');
  });
});

describe('o fundo do cartão', () => {
  /** O contraste com o branco do fundo que `fundoDoCartao` manda (a mistura em sRGB da cor com a tinta #1C2430). */
  const contraste = (fundo: string) => {
    const m = /color-mix\(in srgb, (#[0-9A-Fa-f]{6}) (\d+)%, var\(--color-tinta\)\)/.exec(fundo);
    expect(m, fundo).not.toBeNull();
    const p = Number(m![2]) / 100;
    const cor = [1, 3, 5].map((i) => parseInt(m![1]!.slice(i, i + 2), 16));
    const tinta = [0x1c, 0x24, 0x30];
    const canal = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = cor.map((c, i) => canal(Math.round(c * p + tinta[i]! * (1 - p))));
    const luz = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    return 1.05 / (luz + 0.05);
  };

  it('a cor do serviço com 16% de tinta (84% da cor) quando o texto branco já lê bem', () => {
    expect(fundoDoCartao('#2F8F5B')).toBe('color-mix(in srgb, #2F8F5B 84%, var(--color-tinta))');
    expect(contraste(fundoDoCartao('#2F8F5B'))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(fundoDoCartao('#3C5F9C'))).toBeGreaterThanOrEqual(4.5);
  });

  it('a cor clara (como a do Bioma) ganha mais tinta, até o texto branco chegar a 4,5:1', () => {
    for (const clara of ['#9BD15A', '#F2C14E', '#FFFFFF', '#7FDBFF']) {
      const fundo = fundoDoCartao(clara);
      expect(contraste(fundo), clara).toBeGreaterThanOrEqual(4.5);
      expect(Number(/ (\d+)%/.exec(fundo)![1])).toBeLessThan(84);
    }
  });
});

describe('os cartões', () => {
  it('mostra o título, um cartão por serviço com o rótulo de leitura e as quatro informações', () => {
    render(<ProximosServicos servicos={[servico('2026-11-26'), servico('2026-12-01', { inicio: '19:00', fim: '07:00', turno: 'A' })]} />);
    expect(screen.getByText('Seus próximos serviços')).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Seus próximos serviços' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    const primeiro = within(lista).getByRole('listitem', { name: 'quinta, 26, Pronto, das 7h às 19h' });
    expect(primeiro).toHaveTextContent('qui');
    expect(primeiro).toHaveTextContent('26');
    expect(primeiro).toHaveTextContent('Pronto');
    expect(primeiro).toHaveTextContent('7h às 19h');
    expect(within(lista).getByRole('listitem', { name: 'terça, 1º, Pronto, das 19h às 7h' })).toHaveTextContent('1º');
  });

  it('só o primeiro tem o contorno branco de 2 px', () => {
    render(<ProximosServicos servicos={[servico('2026-11-26'), servico('2026-11-27'), servico('2026-11-28')]} />);
    const itens = screen.getAllByRole('listitem');
    expect(itens[0]!.className).toMatch(/ring-2/);
    expect(itens[0]!.className).toMatch(/ring-white/);
    expect(itens[1]!.className).not.toMatch(/ring-2/);
    expect(itens[2]!.className).not.toMatch(/ring-2/);
  });

  it('o fundo de cada cartão é a cor do serviço com a tinta, e o texto é branco', () => {
    render(<ProximosServicos servicos={[servico('2026-11-26', { cor: '#3C5F9C' })]} />);
    const cartao = screen.getByRole('listitem');
    expect(cartao.style.background).toContain('#3C5F9C');
    expect(cartao.className).toMatch(/text-white/);
  });

  it('o nome comprido é cortado com reticências e o cartão tem largura fixa (112 px no computador, 104 no celular)', () => {
    render(<ProximosServicos servicos={[servico('2026-11-26', { servico: 'Operação Verão Litoral Sul' })]} />);
    const cartao = screen.getByRole('listitem');
    expect(cartao.className).toMatch(/w-\[104px\]/);
    expect(cartao.className).toMatch(/md:w-\[112px\]/);
    expect(cartao.className).toMatch(/flex-none|shrink-0/);
    const nome = within(cartao).getByText('Operação Verão Litoral Sul');
    expect(nome.className).toMatch(/truncate/);
  });

  it('a fila rola de lado, sem barra de rolagem visível', () => {
    render(<ProximosServicos servicos={[servico('2026-11-26')]} />);
    const lista = screen.getByRole('list', { name: 'Seus próximos serviços' });
    expect(lista.className).toMatch(/overflow-x-auto/);
    expect(lista.className).toMatch(/\[scrollbar-width:none\]/);
  });

  it('só desenha até seis, mesmo que cheguem mais', () => {
    const sete = Array.from({ length: 7 }, (_, i) => servico(`2026-11-${String(20 + i).padStart(2, '0')}`));
    render(<ProximosServicos servicos={sete} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('sem serviço, diz que não há nenhum marcado, no lugar dos cartões', () => {
    render(<ProximosServicos servicos={[]} />);
    expect(screen.getByText('Nenhum serviço marcado para você.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
