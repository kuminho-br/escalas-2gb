import type { Papel } from '@/api/eu';

/**
 * O nome do nível de acesso nas telas, num lugar só. Os valores do banco e do código (`escalante`, `gestor_lateral`) não mudam: só o texto.
 * "Coordenador" é o nome definitivo do quinto nível (escolha do usuário, 23/11/2026); se um dia mudar, é só mudar aqui.
 */
const NOMES: Record<Papel, string> = { administrador: 'Administrador', gestor: 'Gestor', gestor_lateral: 'Coordenador', escalante: 'Auxiliar administrativo' };
export const nomeDoPapel = (p: Papel): string => NOMES[p];
