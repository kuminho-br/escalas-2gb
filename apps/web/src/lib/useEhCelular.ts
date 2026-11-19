// Celular ou computador pela largura da tela (o site inteiro usa 768 px como o ponto de corte do tablet para cima).
// Sem `matchMedia` (ambiente de teste sem layout), vale "computador".
import { useEffect, useState } from 'react';

const CELULAR = '(max-width: 767px)';

export function useEhCelular(): boolean {
  const [celular, setCelular] = useState(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(CELULAR).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(CELULAR);
    const aoMudar = () => setCelular(m.matches);
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  }, []);
  return celular;
}
