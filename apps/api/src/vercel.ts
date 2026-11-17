// Ponto de entrada da função da Vercel (runtime Node, assinatura (req, res)).
// Empacotado por scripts/build-vercel.mjs.
import { getRequestListener } from '@hono/node-server';
import { criarAppDoAmbiente } from './app-ambiente.ts';

export default getRequestListener(criarAppDoAmbiente(process.env).fetch);
