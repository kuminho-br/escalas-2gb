// As camadas de visão (entrega 6.11): o que cada camada vê de um militar ou de uma unidade. Quem EDITA continua pela hierarquia (o nível de
// acesso); aqui é só quem VÊ. A lista de blocos é fixa (cada bloco é um grupo de colunas e de telas); o que o administrador ajusta é quem vê.
import { z } from 'zod';

/** Um grupo de dados que se libera junto. A ordem é a da tela "Quem vê o quê". */
export const BLOCOS = ['identificacao', 'contato', 'situacao', 'afastamentos', 'dados_da_escala', 'comportamento', 'escala_em_montagem'] as const;
export const Bloco = z.enum(BLOCOS);
export type Bloco = z.infer<typeof Bloco>;

/** De onde vem o direito de ver: todo militar com conta, quem está num quadro "de oficiais", e o quinto nível de acesso (nas unidades irmãs da dele). */
export const CAMADAS = ['todos', 'oficial', 'gestor_lateral'] as const;
export const Camada = z.enum(CAMADAS);
export type Camada = z.infer<typeof Camada>;

/** A borda: uma linha por bloco, com uma marca por camada. */
export type Borda = { bloco: Bloco; todos: boolean; oficial: boolean; gestorLateral: boolean }[];

const LinhaDaBorda = z.object({ bloco: Bloco, todos: z.boolean(), oficial: z.boolean(), gestorLateral: z.boolean() });
/** A borda inteira: os 7 blocos, cada um uma vez. */
export const NovaBorda = z
  .array(LinhaDaBorda)
  .length(BLOCOS.length, 'Envie os sete blocos.')
  .refine((linhas) => new Set(linhas.map((l) => l.bloco)).size === BLOCOS.length, 'Envie cada bloco uma vez.');
export type NovaBorda = z.infer<typeof NovaBorda>;

/** A marca "de oficiais" de um quadro (QOC e QOA nascem marcados). */
export const MarcaDeOficiais = z.object({ oficial: z.boolean() }).strict();
export type MarcaDeOficiais = z.infer<typeof MarcaDeOficiais>;
