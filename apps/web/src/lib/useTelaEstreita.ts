// A tela é mais estreita que 1440 px? Então abrir o painel do dia recolhe o menu (6.70). Sem `matchMedia` (testes sem layout), vale larga.
import { useEffect, useState } from 'react';

const ESTREITA = '(max-width: 1439px)';

export function useTelaEstreita(): boolean {
  const sabe = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [estreita, setEstreita] = useState(() => (sabe ? window.matchMedia(ESTREITA).matches : false));
  useEffect(() => {
    if (!sabe) return;
    const m = window.matchMedia(ESTREITA);
    const aoMudar = () => setEstreita(m.matches);
    if (typeof m.addEventListener === 'function') {
      m.addEventListener('change', aoMudar);
      return () => m.removeEventListener('change', aoMudar);
    }
    m.addListener(aoMudar);
    return () => m.removeListener(aoMudar);
  }, [sabe]);
  return estreita;
}
