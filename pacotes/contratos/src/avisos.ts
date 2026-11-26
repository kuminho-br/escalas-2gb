// O quadro de avisos da tela inicial (6.56): quem tem nível de acesso publica um aviso para uma unidade; os militares lotados nela e nas de baixo o veem na tela inicial.
import { z } from 'zod';
import { Data, Id } from './comum.ts';

export const LIMITE_DO_TITULO = 80;
export const LIMITE_DO_TEXTO = 400;

const Titulo = z.string().trim().min(1, 'Dê um título ao aviso.').max(LIMITE_DO_TITULO, `O título tem até ${LIMITE_DO_TITULO} caracteres.`);
const Texto = z.string().trim().min(1, 'Escreva o texto do aviso.').max(LIMITE_DO_TEXTO, `O texto tem até ${LIMITE_DO_TEXTO} caracteres.`);

/** Publicar: a unidade do aviso, o título, o texto, se fica fixado no topo e até que dia vale (sem data, vale até alguém retirar). */
export const NovoAviso = z.object({ unidadeId: Id, titulo: Titulo, texto: Texto, fixado: z.boolean(), valeAte: Data.nullish() }).strict();
export type NovoAviso = z.infer<typeof NovoAviso>;

/** Editar: só o que muda. A unidade não muda (para mudar, retire o aviso e publique outro); `valeAte: null` tira a data. */
export const MudarAviso = z.object({ titulo: Titulo, texto: Texto, fixado: z.boolean(), valeAte: Data.nullable() }).partial().strict();
export type MudarAviso = z.infer<typeof MudarAviso>;

/** Um aviso que a conta pode ver. `podeAlterar`: a conta é a autora ou tem nível de acesso na unidade do aviso (ou numa de cima): ela edita, fixa e retira. */
export type Aviso = {
  id: string;
  unidadeId: string;
  unidadeSigla: string;
  titulo: string;
  texto: string;
  fixado: boolean;
  /** aaaa-mm-dd; vale até o fim desse dia (Recife) */
  valeAte: string | null;
  /** instante da publicação (ISO, UTC) */
  publicadoEm: string;
  autor: { patente: string; nomeGuerra: string };
  podeAlterar: boolean;
};

/** Os avisos visíveis à conta (fixados primeiro, do mais novo ao mais velho; depois os outros), e se ela tem nível de acesso em alguma unidade (e então vê o botão de publicar). */
export type QuadroDeAvisos = { avisos: Aviso[]; podePublicar: boolean };
