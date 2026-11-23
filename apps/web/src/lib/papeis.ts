import type { Papel } from '@/api/eu';

/**
 * O nome do nível de acesso nas telas, num lugar só. Os valores do banco e do código (`escalante`, `gestor_lateral`) não mudam: só o texto.
 * "Coordenador" é provisório (o usuário ainda não escolheu o nome do quinto nível): para trocar, basta mudar aqui.
 */
const NOMES: Record<Papel, string> = { administrador: 'Administrador', gestor: 'Gestor', gestor_lateral: 'Coordenador', escalante: 'Auxiliar administrativo' };
export const nomeDoPapel = (p: Papel): string => NOMES[p];
