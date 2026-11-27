import type { Eu, Papel } from '@/api/eu';

/**
 * O nome do nível de acesso nas telas, num lugar só. Os valores do banco e do código (`escalante`, `gestor_lateral`) não mudam: só o texto.
 * "Coordenador" é o nome definitivo do quinto nível (escolha do usuário, 23/11/2026); se um dia mudar, é só mudar aqui.
 */
const NOMES: Record<Papel, string> = { administrador: 'Administrador', gestor: 'Gestor', gestor_lateral: 'Coordenador', escalante: 'Auxiliar administrativo' };
export const nomeDoPapel = (p: Papel): string => NOMES[p];

/** O nível mais alto primeiro: o que o cabeçalho mostra quando a pessoa tem mais de um que vale na unidade de trabalho. */
const DO_MAIS_ALTO_AO_MAIS_BAIXO: Papel[] = ['administrador', 'gestor', 'gestor_lateral', 'escalante'];

/**
 * O nível de acesso da pessoa na unidade de trabalho: o mais alto entre os níveis que cobrem a unidade (a do nível ou uma acima dela). Um nível em outra
 * unidade, que não alcança esta, não conta; sem nenhum (o militar comum, a unidade só de consulta), null.
 */
export function papelNaUnidade(eu: Eu): Papel | null {
  const cobrem = eu.papeis.filter((p) => {
    const dele = eu.unidades.find((u) => u.id === p.unidadeId)?.caminho;
    return dele !== undefined && dele.length <= eu.unidade.caminho.length && dele.every((sigla, i) => eu.unidade.caminho[i] === sigla);
  });
  return DO_MAIS_ALTO_AO_MAIS_BAIXO.find((alto) => cobrem.some((p) => p.papel === alto)) ?? null;
}

/** As iniciais do nome de guerra para o círculo do cabeçalho: a letra da primeira palavra e, se houver mais de uma, a da última ("Da Silva" → "DS"). */
export function iniciaisDe(nomeGuerra: string): string {
  const palavras = nomeGuerra.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '?';
  const letra = (p: string) => p.charAt(0).toLocaleUpperCase('pt-BR');
  return palavras.length === 1 ? letra(palavras[0]!) : letra(palavras[0]!) + letra(palavras.at(-1)!);
}
