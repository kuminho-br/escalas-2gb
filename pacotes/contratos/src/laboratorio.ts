// O Laboratório (6.59): o espelho do sistema com dados de teste. A pessoa entra com a própria conta e escolhe um perfil de teste.
import { z } from 'zod';
import { Id } from './comum.ts';

/** Escolher (ou trocar) o perfil de teste. */
export const EscolherPerfil = z.object({ perfilId: Id }).strict();
export type EscolherPerfil = z.infer<typeof EscolherPerfil>;

/** Um perfil de teste: o nome ("Gestor de teste") e o nível de acesso dele. */
export type PerfilDeTesteDto = { perfilId: string; nome: string; nivel: string };
