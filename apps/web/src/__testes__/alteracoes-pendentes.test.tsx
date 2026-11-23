import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EtiquetaPendente } from '@/componentes/AlteracoesPendentes';

// N0.5 (achado R4): "Alterações não salvas" é aviso de rotina, na cor de pendência, e não na de erro.
describe('Alterações não salvas', () => {
  it('usa a cor de pendência e continua sendo um aviso lido (role="status")', () => {
    render(<EtiquetaPendente sujo />);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Alterações não salvas');
    expect(aviso.className).toMatch(/\btext-pendencia\b/);
    expect(aviso.className).not.toMatch(/\btext-alerta\b/);
  });

  it('sem alteração, não aparece', () => {
    render(<EtiquetaPendente sujo={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
