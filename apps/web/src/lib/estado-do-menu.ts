// O menu lateral em três estados (6.70): largo (240 px), recolhido (o trilho de 84 px) e escondido (só o botão "Menu"). Fica no navegador, por pessoa.
export type EstadoDoMenu = 'largo' | 'recolhido' | 'escondido';

const ESTADOS: readonly EstadoDoMenu[] = ['largo', 'recolhido', 'escondido'];
const chave = (usuarioId: string) => `menu-lateral:${usuarioId}`;

/** O estado que a pessoa deixou neste navegador; sem nada guardado, com valor estranho ou sem armazenamento (janela privada, dados bloqueados): largo. */
export function lerEstadoDoMenu(usuarioId: string): EstadoDoMenu {
  try {
    const guardado = localStorage.getItem(chave(usuarioId));
    return ESTADOS.find((e) => e === guardado) ?? 'largo';
  } catch {
    return 'largo';
  }
}

/** Guarda o estado; sem armazenamento, o menu continua valendo só até a página recarregar. */
export function guardarEstadoDoMenu(usuarioId: string, estado: EstadoDoMenu): void {
  try {
    localStorage.setItem(chave(usuarioId), estado);
  } catch {
    // sem armazenamento: a escolha vale só nesta página
  }
}
