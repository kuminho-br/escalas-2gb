// A "Tabela com rolagem" do sistema (6.46, e 6.70): a fronteira entre o que fica preso e o que rola é de 3 px na cor `tinta`, em toda tabela, e, ao rolar para os lados,
// uma sombra leve nasce do lado das partes presas (a do estilo.css, ligada pelos atributos do contêiner). Uma peça só: quem tem parte presa usa estas constantes e o gancho.
import { useCallback, useRef } from 'react';

/** A coluna presa à esquerda (o militar, a guarnição): a fronteira à direita dela e a sombra quando a tabela rolou para os lados. */
export const COLUNA_PRESA_ESQUERDA = 'border-r-3 border-r-tinta sombra-presa-esq';
/** O cabeçalho preso no alto: a fronteira embaixo dele. */
export const CABECALHO_PRESO = 'border-b-3 border-b-tinta';
/** A coluna presa à direita (PJES): a fronteira à esquerda dela e a sombra enquanto há mais tabela à direita. */
export const COLUNA_PRESA_DIREITA = 'border-l-3 border-l-tinta sombra-presa-dir';

/**
 * O gancho do contêiner que rola (o que tem `data-rolagem`): devolve a `ref` dele e liga os atributos que acendem a sombra: `data-rolou-x` quando a tabela já rolou para a direita
 * (a coluna presa à esquerda esconde algo por baixo) e `data-resta-x` enquanto há mais tabela à direita. Só atributos: a sombra é CSS, sem animação. Por ser uma `ref` de função,
 * vale também para o contêiner que só aparece depois (quando a lista chega).
 */
export function useSombraDaRolagem(): (el: HTMLElement | null) => void {
  const desligar = useRef<(() => void) | null>(null);
  return useCallback((el: HTMLElement | null) => {
    desligar.current?.();
    desligar.current = null;
    if (!el) return;
    const atualizar = () => {
      el.toggleAttribute('data-rolou-x', el.scrollLeft > 0);
      el.toggleAttribute('data-resta-x', el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    atualizar();
    el.addEventListener('scroll', atualizar, { passive: true });
    // a tabela muda de tamanho (as equipes recolhem, a janela redimensiona): a conta se refaz
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(atualizar);
    observador?.observe(el);
    if (el.firstElementChild) observador?.observe(el.firstElementChild);
    desligar.current = () => {
      el.removeEventListener('scroll', atualizar);
      observador?.disconnect();
    };
  }, []);
}
