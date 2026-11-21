import type { Papel } from '@/api/eu';

/** O nome do papel nas telas. O valor `escalante` do banco e do código não muda: só o texto. */
export function nomeDoPapel(p: Papel): 'Administrador' | 'Gestor' | 'Auxiliar administrativo' {
  return p === 'administrador' ? 'Administrador' : p === 'gestor' ? 'Gestor' : 'Auxiliar administrativo';
}
