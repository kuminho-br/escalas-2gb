// O Laboratório (6.59): o espelho do sistema com dados de teste. A pessoa entra com a própria conta e escolhe um perfil de teste.
import { z } from 'zod';
import { Id } from './comum.ts';

/** Escolher (ou trocar) o perfil de teste. */
export const EscolherPerfil = z.object({ perfilId: Id }).strict();
export type EscolherPerfil = z.infer<typeof EscolherPerfil>;

/** Um perfil de teste: o nome ("Gestor de teste") e o nível de acesso dele. */
export type PerfilDeTesteDto = { perfilId: string; nome: string; nivel: string };

// As ferramentas em teste e o retorno (6.60). As frases dos erros são as que a pessoa lê.
export const LIMITE_DO_RETORNO = 2000;
export const SituacaoDaFerramenta = z.enum(['em_teste', 'encerrada', 'virou_modulo']);
export type SituacaoDaFerramenta = z.infer<typeof SituacaoDaFerramenta>;

const NomeDaFerramenta = z.string().trim().min(1, 'Dê um nome à ferramenta.').max(80, 'O nome tem até 80 caracteres.');
const OQueTestar = z.string().trim().min(1, 'Diga o que testar.').max(500, 'O texto tem até 500 caracteres.');
const Caminho = z
  .string()
  .trim()
  .max(200, 'O caminho tem até 200 caracteres.')
  .refine((c) => c.startsWith('/') && !c.startsWith('//') && !c.includes(':'), 'O caminho começa com / e fica dentro do site.');

/** Cadastrar: o nome, o que testar e, se houver, o caminho da ferramenta dentro do Laboratório. */
export const NovaFerramenta = z.object({ nome: NomeDaFerramenta, oQueTestar: OQueTestar, caminho: Caminho.nullish() }).strict();
export type NovaFerramenta = z.infer<typeof NovaFerramenta>;

/** Mudar: só o que muda (a situação, em geral). `caminho: null` tira o caminho. */
export const MudarFerramenta = z.object({ nome: NomeDaFerramenta, oQueTestar: OQueTestar, caminho: Caminho.nullable(), situacao: SituacaoDaFerramenta }).partial().strict();
export type MudarFerramenta = z.infer<typeof MudarFerramenta>;

export type FerramentaDeTeste = {
  id: string;
  nome: string;
  oQueTestar: string;
  caminho: string | null;
  situacao: SituacaoDaFerramenta;
  inicio: string;
  fim: string | null;
};

/** O retorno: a ferramenta, a tela em que a pessoa estava (o perfil e a conta vêm da sessão, não do corpo), o texto e a nota. */
export const NovoRetorno = z
  .object({
    ferramentaId: Id,
    tela: z.string().trim().min(1, 'Informe a tela.').max(200, 'A tela tem até 200 caracteres.'),
    texto: z.string().trim().min(1, 'Escreva o seu retorno.').max(LIMITE_DO_RETORNO, `O retorno tem até ${LIMITE_DO_RETORNO} caracteres.`),
    nota: z.number('A nota vai de 1 a 5.').int('A nota vai de 1 a 5.').min(1, 'A nota vai de 1 a 5.').max(5, 'A nota vai de 1 a 5.'),
  })
  .strict();
export type NovoRetorno = z.infer<typeof NovoRetorno>;

/** Uma linha da lista de retornos do administrador: com o nome e a matrícula da conta real de quem deixou. */
export type RetornoListado = {
  id: string;
  ferramentaId: string;
  ferramenta: string;
  /** null se a conta de quem deixou foi apagada: o retorno fica, sem autoria */
  conta: { nome: string; matricula: string } | null;
  perfilDeTeste: string;
  tela: string;
  texto: string;
  nota: number;
  criadoEm: string;
};
