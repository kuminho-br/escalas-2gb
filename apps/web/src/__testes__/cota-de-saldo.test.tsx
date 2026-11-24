import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CotaDeSaldo, NumeroDaCota } from '@/componentes/CotaDeSaldo';

// 6.38, Task 7: a cota de saldo do Adm à vista. A barra enche conforme os saldos do mês; passou do total, fica cheia em âmbar e o número diz ("7/6"); nunca trava.
describe('CotaDeSaldo (a barra)', () => {
  it('enche na proporção dos saldos feitos, e o leitor de tela diz "{n} de {total} saldos no mês"', () => {
    render(<CotaDeSaldo feitos={2} total={6} />);
    const barra = screen.getByRole('img', { name: '2 de 6 saldos no mês' });
    expect(barra).toBeInTheDocument();
    const enchimento = barra.querySelector('[data-enchimento]') as HTMLElement;
    expect(parseFloat(enchimento.style.width)).toBeCloseTo(33.33, 1);
    expect(enchimento).toHaveClass('bg-vinho');
    expect(barra).toHaveAttribute('data-estado', 'dentro');
  });

  it('no total certo a barra está cheia, ainda na cor normal', () => {
    render(<CotaDeSaldo feitos={6} total={6} />);
    const enchimento = screen.getByRole('img', { name: '6 de 6 saldos no mês' }).querySelector('[data-enchimento]') as HTMLElement;
    expect(enchimento.style.width).toBe('100%');
    expect(enchimento).toHaveClass('bg-vinho');
  });

  it('Review Focus 5: acima do total (7 de 6) a barra fica cheia, em âmbar, e o leitor de tela diz o número real', () => {
    render(<CotaDeSaldo feitos={7} total={6} />);
    const barra = screen.getByRole('img', { name: '7 de 6 saldos no mês' });
    const enchimento = barra.querySelector('[data-enchimento]') as HTMLElement;
    expect(enchimento.style.width).toBe('100%');
    expect(enchimento).toHaveClass('bg-pendencia');
    expect(barra).toHaveAttribute('data-estado', 'acima');
  });

  it('sem saldo nenhum a barra está vazia; com total 0 qualquer saldo já passa da cota', () => {
    const { rerender } = render(<CotaDeSaldo feitos={0} total={6} />);
    expect((screen.getByRole('img', { name: '0 de 6 saldos no mês' }).querySelector('[data-enchimento]') as HTMLElement).style.width).toBe('0%');
    rerender(<CotaDeSaldo feitos={1} total={0} />);
    expect(screen.getByRole('img', { name: '1 de 0 saldos no mês' })).toHaveAttribute('data-estado', 'acima');
    rerender(<CotaDeSaldo feitos={0} total={0} />);
    expect(screen.getByRole('img', { name: '0 de 0 saldos no mês' })).toHaveAttribute('data-estado', 'dentro');
  });
});

describe('NumeroDaCota (o "2/6" da placa)', () => {
  it('mostra feitos/total, com o nome acessível por extenso, e fica âmbar acima do total', () => {
    const { rerender } = render(<NumeroDaCota feitos={2} total={6} />);
    const n = screen.getByText('2/6');
    expect(n).toHaveClass('text-apagado');
    expect(n).toHaveAttribute('title', '2 de 6 saldos no mês');
    rerender(<NumeroDaCota feitos={7} total={6} />);
    expect(screen.getByText('7/6')).toHaveClass('text-pendencia');
  });
});
