// O modo Laboratório do site (6.59). Vive na ABA (`sessionStorage`): duas abas, uma no real e outra no Laboratório, não se misturam, e uma aba nova abre sempre no real.
// É o `cliente.ts` quem decide o endereço de todo pedido: com o modo ligado, o pedido vai para `/api/lab/…` e leva o cabeçalho do Laboratório.
const CHAVE = 'laboratorio:modo';
const EVENTO = 'laboratorio:modo-mudou';
export const CABECALHO = 'x-laboratorio';

export function emLaboratorio(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function mudar(ligado: boolean) {
  try {
    if (ligado) sessionStorage.setItem(CHAVE, '1');
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento da aba (modo privado restrito): o modo não liga, e a pessoa continua no real
  }
  window.dispatchEvent(new Event(EVENTO));
}

export const entrarNoModo = () => mudar(true);
export const sairDoModo = () => mudar(false);

/** Quem avisa o React quando o modo muda (`useSyncExternalStore`). */
export function aoMudarModo(f: () => void): () => void {
  window.addEventListener(EVENTO, f);
  return () => window.removeEventListener(EVENTO, f);
}

/** As rotas do Laboratório no REAL (escolher o perfil, ver o perfil em uso, sair, recomeçar) e o login nunca ganham o prefixo, nem em modo Laboratório. */
const DO_REAL = ['/api/laboratorio', '/api/auth', '/api/acesso'];

/** O endereço do pedido: em modo Laboratório, `/api/x` vira `/api/lab/x`; fora do modo (e nas rotas do real), igual. */
export function caminhoDoModo(caminho: string): string {
  if (!emLaboratorio() || !caminho.startsWith('/api/') || caminho.startsWith('/api/lab/')) return caminho;
  if (DO_REAL.some((r) => caminho === r || caminho.startsWith(`${r}/`))) return caminho;
  return `/api/lab/${caminho.slice('/api/'.length)}`;
}

/** O cabeçalho que marca o pedido como do Laboratório: só nos pedidos que foram para `/api/lab/`. */
export function cabecalhosDoModo(caminhoFinal: string): Record<string, string> {
  return caminhoFinal.startsWith('/api/lab/') ? { [CABECALHO]: '1' } : {};
}

// o Laboratório acabou por trás (a aba voltou ao real sem a pessoa pedir): a tela inicial diz isso uma vez
let encerrado = false;
export const marcarEncerrado = () => { encerrado = true; };
export function consumirEncerrado(): boolean {
  const foi = encerrado;
  encerrado = false;
  return foi;
}
