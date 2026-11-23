import type { Papel } from '@/api/eu';

/**
 * O nome do nível de acesso nas telas, num lugar só. Os valores do banco e do código (`escalante`, `chefe_divisao`) não mudam: só o texto.
 * "Chefe de divisão" é provisório (o usuário ainda não escolheu o nome): para trocar, basta mudar aqui.
 */
const NOMES: Record<Papel, string> = { administrador: 'Administrador', gestor: 'Gestor', chefe_divisao: 'Chefe de divisão', escalante: 'Auxiliar administrativo' };
export const nomeDoPapel = (p: Papel): string => NOMES[p];
