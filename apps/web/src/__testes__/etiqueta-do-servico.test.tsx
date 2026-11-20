import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EtiquetaDoServico } from '@/componentes/EtiquetaDoServico';

// A cor do texto é a de maior contraste sobre a cor cadastrada do serviço (Review Focus 3 da 4.2).
describe('etiqueta do serviço', () => {
  it('cheia: cor clara (#00FF00) usa a letra escura; cor escura (#2E6B1F), a letra clara', () => {
    const { rerender } = render(<EtiquetaDoServico nome="JES" cor="#00FF00" />);
    expect(screen.getByText('JES')).toHaveStyle({ backgroundColor: '#00FF00', color: '#1C2430' });
    rerender(<EtiquetaDoServico nome="JES" cor="#2E6B1F" />);
    expect(screen.getByText('JES')).toHaveStyle({ backgroundColor: '#2E6B1F', color: '#FFFFFF' });
  });

  it('contorno: fundo transparente e borda na cor da letra', () => {
    render(<EtiquetaDoServico nome="Pronto" cor="#2F8F5B" variante="contorno" />);
    const e = screen.getByText('Pronto');
    expect(e).toHaveAttribute('data-etiqueta-servico');
    expect(e).toHaveAttribute('data-variante', 'contorno');
    // o jsdom não calcula o `border-color` nem o `transparent`: confere o que a etiqueta declara
    expect(e.style.backgroundColor).toBe('transparent');
    expect(e.style.color).toBe('rgb(255, 255, 255)');
    expect(e.style.borderColor).toBe('rgb(255, 255, 255)');
  });

  it('a variante cheia é a padrão', () => {
    render(<EtiquetaDoServico nome="Saldo" cor="#2B7BB9" />);
    expect(screen.getByText('Saldo')).toHaveAttribute('data-variante', 'cheia');
  });
});
